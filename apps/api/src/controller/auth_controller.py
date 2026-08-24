import os
import re
from datetime import UTC, datetime

from fastapi import HTTPException, status

from src.models.users import User
from src.repository.user import UserRepo
from src.schemas.auth import (
    GoogleAuthRequest,
    PublicUser,
    RefreshTokenRequest,
    TokenPairResponse,
)
from src.utils.google_auth import verify_google_id_token
from src.utils.jwt_utils import create_token_pair, decode_refresh_token
from fastapi.responses import JSONResponse
from pydantic_core import to_jsonable_python


def to_public_user(user: User) -> PublicUser:
    if not user.id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User is missing an id",
        )
    return PublicUser(
        id=user.id,
        name=user.name,
        email=user.email,
        username=user.username,
        avatarUrl=user.avatar_url,
        plan=user.plan,
    )


def _username_from_email(email: str) -> str:
    local = email.split("@")[0].lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", local).strip("-")
    return slug[:80] or "user"


async def google_login(body: GoogleAuthRequest, repo: UserRepo) -> TokenPairResponse:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID is not configured",
        )

    try:
        claims = await verify_google_id_token(body.credential, client_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google credential: {exc}",
        ) from exc

    google_id = str(claims.get("sub") or "")
    email = str(claims.get("email") or "").lower()
    name = str(claims.get("name") or email.split("@")[0])
    picture = claims.get("picture")
    avatar_url = str(picture) if isinstance(picture, str) else None

    if not google_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google profile is incomplete",
        )

    user = await repo.find_by_google_id(google_id) or await repo.find_by_email(email)
    now = datetime.now(UTC)

    if user is None:
        user = User(
            name=name[:100],
            email=email,
            username=_username_from_email(email),
            password=None,
            google_id=google_id,
            avatar_url=avatar_url,
            plan="free",
            is_active=True,
            is_verified=True,
            created_at=now,
            updated_at=now,
        )
        user = await repo.create(user)
    else:
        user.google_id = user.google_id or google_id
        user.name = name[:100] or user.name
        user.avatar_url = avatar_url or user.avatar_url
        user.is_verified = True
        user.updated_at = now
        user = await repo.save(user)

    if not user.id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist user",
        )

    # 1. Generate tokens from your generator dictionary
    tokens = create_token_pair(user.id)
    
    # 2. Build the final Pydantic model response structure
    token_pair = TokenPairResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        user=to_public_user(user),
    )
    
    # 3. Serialize your complete Pydantic model structure to dict

    response_data = to_jsonable_python(token_pair)

    # 4. Initialize the custom JSON response with your content
    response = JSONResponse(
        content=response_data,
        status_code=status.HTTP_200_OK
    )
    print(response_data)
    # 5. Extract refresh token safely from dictionary and map to cookie
    response.set_cookie(
        key="ca_refresh_token",
        value=tokens["refresh_token"],  # Fixed: Reference key from dictionary
        httponly=True,       
        secure=True,         
        samesite="lax",      
        max_age=604800       
    )
    response.set_cookie(
        key="ca_access_token",
        value=tokens["access_token"],  # Fixed: Reference key from dictionary
        httponly=True,       
        secure=True,         
        samesite="lax",      
        max_age=604800       
    )
    
    # 6. Return the configured response instance
    return response

async def refresh_tokens(body: RefreshTokenRequest, repo: UserRepo) -> TokenPairResponse:
    try:
        user_id = decode_refresh_token(body.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = await repo.find_by_id(user_id)
    if user is None or not user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    tokens = create_token_pair(user.id)
    return TokenPairResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        user=to_public_user(user),
    )
