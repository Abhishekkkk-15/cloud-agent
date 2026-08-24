import time

import httpx
from authlib.jose import JsonWebKey, jwt
from dotenv import load_dotenv

load_dotenv()

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {
    "https://accounts.google.com",
    "accounts.google.com",
}

_jwks_cache: dict | None = None
_jwks_fetched_at = 0.0
_JWKS_TTL_SECONDS = 3600


async def _google_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and now - _jwks_fetched_at < _JWKS_TTL_SECONDS:
        return _jwks_cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(GOOGLE_JWKS_URL)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_fetched_at = now
        return _jwks_cache


async def verify_google_id_token(id_token: str, client_id: str) -> dict:
    jwks = await _google_jwks()
    key_set = JsonWebKey.import_key_set(jwks)
    claims = jwt.decode(id_token, key_set)
    claims.validate(leeway=60)

    if claims.get("aud") != client_id:
        raise ValueError("Invalid Google token audience")
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise ValueError("Invalid Google token issuer")
    if not claims.get("email"):
        raise ValueError("Google token is missing email")
    verified = claims.get("email_verified")
    if verified in (False, "false", "False"):
        raise ValueError("Google email is not verified")

    return dict(claims)
