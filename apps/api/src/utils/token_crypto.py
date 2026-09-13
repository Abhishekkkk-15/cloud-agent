from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from src.utils.config import config


def _fernet() -> Fernet:
    raw = config.github_token_encryption_key.strip()
    if not raw:
        raise RuntimeError("GITHUB_TOKEN_ENCRYPTION_KEY is not configured")
    # Accept a Fernet key, or derive one from any secret string.
    try:
        return Fernet(raw.encode("utf-8"))
    except (ValueError, TypeError):
        digest = hashlib.sha256(raw.encode("utf-8")).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(token_enc: str) -> str:
    try:
        return _fernet().decrypt(token_enc.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt GitHub token") from exc
