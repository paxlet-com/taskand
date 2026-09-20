"""Bounded, non-retrying requests to one operator-configured gateway."""

import asyncio
from dataclasses import dataclass, field
import ipaddress
import json
import os
import re
from urllib.parse import urlsplit

import httpx

MAX_INPUT_BYTES = 256 * 1024
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_PROCESSES = 1000
URI_PATTERN = r"proc://[a-z0-9][a-z0-9.-]*/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*/v[0-9]+"


class GatewayError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def validate_uri(uri: str) -> None:
    if len(uri) > 256 or re.fullmatch(URI_PATTERN, uri) is None:
        raise GatewayError("INVALID_URI", "Expected a versioned proc:// process URI.")


def encode(value: dict) -> bytes:
    try:
        return json.dumps(value, ensure_ascii=True, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError) as exc:
        raise GatewayError("INVALID_JSON", "Input must be a finite JSON object.") from exc


def reject_constant(value: str):
    raise ValueError("Non-finite JSON constant")


@dataclass(frozen=True)
class Settings:
    url: str = "http://127.0.0.1:8077"
    token: str = field(default="", repr=False)

    def __post_init__(self):
        try:
            parsed = urlsplit(self.url)
            host = parsed.hostname
            port = parsed.port
            loopback = host == "localhost"
            if host and not loopback:
                try:
                    loopback = ipaddress.ip_address(host).is_loopback
                except ValueError:
                    pass
            valid = (host and parsed.scheme in {"http", "https"}
                     and (parsed.scheme == "https" or loopback)
                     and not parsed.username and not parsed.password
                     and not parsed.query and not parsed.fragment
                     and parsed.path in {"", "/"} and port != 0
                     and not any(ord(c) <= 32 or ord(c) == 127 for c in self.url))
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("TASKAND_MCP_GATEWAY_URL must be an HTTPS origin or loopback HTTP origin.")
        if any(ord(c) <= 32 or ord(c) >= 127 for c in self.token):
            raise ValueError("TASKAND_MCP_TOKEN must contain only printable ASCII without spaces.")

    @classmethod
    def from_env(cls):
        # No .env loading, inherited administrator token or default credentials.
        return cls(os.getenv("TASKAND_MCP_GATEWAY_URL", cls.url),
                   os.getenv("TASKAND_MCP_TOKEN", ""))


class Gateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def request(self, path: str, payload: dict | None = None,
                      timeout: float = 30) -> dict:
        body = None if payload is None else encode(payload)
        if body is not None and len(body) > MAX_INPUT_BYTES:
            raise GatewayError("INPUT_TOO_LARGE", "Request exceeds 256 KiB.")
        headers = {"Accept": "application/json", "Accept-Encoding": "identity"}
        if self.settings.token:
            headers["Authorization"] = "Bearer " + self.settings.token
        if body is not None:
            headers["Content-Type"] = "application/json"
        try:
            async with asyncio.timeout(timeout):
                async with httpx.AsyncClient(trust_env=False, follow_redirects=False,
                                             timeout=timeout) as client:
                    async with client.stream("GET" if body is None else "POST",
                                             self.settings.url.rstrip("/") + path,
                                             headers=headers, content=body) as response:
                        if response.status_code != 200:
                            raise GatewayError(f"HTTP_{response.status_code}",
                                               f"Gateway returned HTTP {response.status_code}; request was not retried.")
                        if response.headers.get("content-encoding", "identity") != "identity":
                            raise GatewayError("INVALID_RESPONSE", "Compressed gateway responses are not accepted.")
                        raw = bytearray()
                        async for chunk in response.aiter_raw():
                            if len(raw) + len(chunk) > MAX_RESPONSE_BYTES:
                                raise GatewayError("RESPONSE_TOO_LARGE", "Gateway response exceeds 1 MiB; do not retry a mutating call blindly.")
                            raw.extend(chunk)
            result = json.loads(raw, parse_constant=reject_constant)
            if not isinstance(result, dict) or not isinstance(result.get("ok"), bool):
                raise ValueError("Missing boolean ok envelope")
            return result
        except (TimeoutError, httpx.TimeoutException) as exc:
            raise GatewayError("OUTCOME_UNKNOWN", "Gateway deadline exceeded; execution may have started. No automatic retry.") from exc
        except httpx.HTTPError as exc:
            # Never return request headers, proxy settings or raw transport errors.
            raise GatewayError("TRANSPORT_ERROR", "Gateway connection failed; execution outcome may be unknown. No automatic retry.") from exc
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise GatewayError("INVALID_RESPONSE", "Gateway did not return a valid JSON object with boolean ok.") from exc

    async def catalog(self) -> list[dict]:
        value = await self.request("/.well-known/catalog.json")
        rows = value.get("processes")
        if value["ok"] is not True or not isinstance(rows, list) or len(rows) > MAX_PROCESSES:
            raise GatewayError("INVALID_CATALOG", "Gateway catalog is unavailable or too large.")
        seen = set()
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("uri"), str):
                raise GatewayError("INVALID_CATALOG", "Invalid process record.")
            validate_uri(row["uri"])
            if row["uri"] in seen:
                raise GatewayError("INVALID_CATALOG", "Duplicate process URI.")
            seen.add(row["uri"])
        return sorted(rows, key=lambda row: row["uri"])

    async def call(self, uri: str, input_data: dict, timeout_seconds: int) -> dict:
        validate_uri(uri)
        if not self.settings.token:
            raise GatewayError("AUTH_REQUIRED", "Set TASKAND_MCP_TOKEN to an explicitly granted gateway credential.")
        if type(timeout_seconds) is not int or not 1 <= timeout_seconds <= 300:
            raise GatewayError("INVALID_TIMEOUT", "timeout_seconds must be an integer from 1 to 300.")
        result = await self.request("/api/proc/call", {"uri": uri, "data": input_data,
                                    "timeout": timeout_seconds}, timeout_seconds + 5)
        if not isinstance(result.get("result"), dict):
            raise GatewayError("INVALID_RESPONSE", "Gateway call envelope has no process result object.")
        return result
