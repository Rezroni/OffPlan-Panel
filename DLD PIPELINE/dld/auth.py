"""OAuth2 client_credentials against the Data.Dubai gateway, with an on-disk
token cache so repeated `python -m dld fetch` invocations within the token's
lifetime (confirmed via live call: expires_in=3600s) don't re-auth every run.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests

from .config import TOKEN_CACHE_PATH, load_env, request_timeout_seconds, require, write_text_atomically

SAFETY_MARGIN_S = 120  # refresh a bit before the server-side expiry


def _cached_token() -> str | None:
    if not TOKEN_CACHE_PATH.exists():
        return None
    try:
        cached = json.loads(TOKEN_CACHE_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    if cached.get("expires_at", 0) > time.time():
        return cached.get("access_token")
    return None


def _store_token(access_token: str, expires_in: int) -> None:
    payload = {
        "access_token": access_token,
        "expires_at": time.time() + max(expires_in - SAFETY_MARGIN_S, 60),
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    write_text_atomically(TOKEN_CACHE_PATH, json.dumps(payload), mode=0o600)


def get_access_token(force_refresh: bool = False) -> str:
    if not force_refresh:
        cached = _cached_token()
        if cached:
            return cached

    env = load_env()
    base_url = env.get("DATA_DUBAI_API_BASE_URL", "https://apis.data.dubai/")
    token_path = env.get(
        "DATA_DUBAI_TOKEN_PATH",
        "/secure/ssis/dubaiai/gatewaytoken/1.0.0/getAccessToken",
    )
    grant_type = env.get("DATA_DUBAI_TOKEN_GRANT_TYPE", "client_credentials")
    timeout_seconds = request_timeout_seconds(env)

    client_id = require(env, "DATA_DUBAI_CLIENT_ID")
    client_secret = require(env, "DATA_DUBAI_CLIENT_SECRET")
    security_id = require(env, "DATA_DUBAI_SECURITY_APPLICATION_IDENTIFIER")

    response = requests.post(
        urljoin(base_url, token_path),
        json={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": grant_type,
        },
        headers={
            "x-DDA-SecurityApplicationIdentifier": security_id,
            "Content-Type": "application/json",
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    try:
        body = response.json()
        access_token = body["access_token"]
        expires_in = int(body.get("expires_in", 1500))
    except (KeyError, TypeError, ValueError, requests.JSONDecodeError) as error:
        raise RuntimeError("Data Dubai token response is missing a valid access token") from error
    if not isinstance(access_token, str) or not access_token:
        raise RuntimeError("Data Dubai token response contains an empty access token")
    _store_token(access_token, expires_in)
    return access_token


def security_application_identifier() -> str:
    env = load_env()
    return require(env, "DATA_DUBAI_SECURITY_APPLICATION_IDENTIFIER")
