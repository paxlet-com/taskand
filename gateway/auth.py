import os
import pathlib
import fnmatch
from typing import Optional, Tuple, Dict, Any

try:
    import yaml
except ImportError:
    yaml = None

# Tokeny z repozytorium są publicznie znane — akceptowane tylko, gdy gateway słucha na loopback
DEFAULT_TOKENS = {"taskand-admin-key", "taskand-operator-key", "taskand-guest-key"}


def bind_address() -> str:
    return os.environ.get("TASKAND_BIND", "127.0.0.1")


def is_loopback_bind() -> bool:
    return bind_address() in ("127.0.0.1", "localhost", "::1")


BASE = pathlib.Path("/taskand") if pathlib.Path("/taskand/generated").exists() else pathlib.Path(__file__).resolve().parent.parent

def _parse_simple_yaml(text: str) -> dict:
    data = {"users": {}}
    curr_user = None
    curr_list = None
    for line in text.splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#"):
            continue
        if line.startswith("  ") and not line.startswith("    ") and clean.endswith(":"):
            curr_user = clean[:-1].strip()
            data["users"][curr_user] = {"allowed_uris": [], "allowed_actions": []}
            curr_list = None
        elif line.startswith("    ") and curr_user:
            if ":" in clean and not clean.startswith("-"):
                k, v = clean.split(":", 1)
                k = k.strip()
                v = v.strip().strip("\"").strip("'")
                if k in ["allowed_uris", "allowed_actions"]:
                    curr_list = k
                else:
                    data["users"][curr_user][k] = v
                    curr_list = None
            elif clean.startswith("- ") and curr_list:
                item = clean[2:].strip().strip("\"").strip("'")
                data["users"][curr_user][curr_list].append(item)
    return data

def load_grants() -> Dict[str, Any]:
    grants_path = BASE / "grants.yaml"
    data = {"users": {}}
    if grants_path.exists():
        try:
            with open(grants_path, "r", encoding="utf-8") as f:
                content = f.read()
                if yaml:
                    loaded = yaml.safe_load(content)
                    if isinstance(loaded, dict):
                        data = loaded
                if not data.get("users"):
                    data = _parse_simple_yaml(content)
        except Exception:
            pass

    # Dynamic environment override: TASKAND_AUTH_TOKEN maps to admin
    env_token = os.environ.get("TASKAND_AUTH_TOKEN", "").strip()
    if env_token:
        data.setdefault("users", {})["admin"] = {
            "token": env_token,
            "role": "administrator",
            "allowed_uris": ["proc://taskand.dev/*"],
            "allowed_actions": ["*"]
        }
    return data

def check_auth(headers) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Validates Authorization: Bearer <token> or X-Taskand-Key: <token>.
    Returns (is_authenticated, user_dict_or_none).
    """
    auth_header = headers.get("Authorization", "").strip()
    api_key_header = headers.get("X-Taskand-Key", "").strip()

    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    elif api_key_header:
        token = api_key_header

    if not token:
        return False, None

    if token in DEFAULT_TOKENS and not is_loopback_bind():
        return False, None

    grants = load_grants()
    users = grants.get("users", {})
    for uname, udata in users.items():
        if isinstance(udata, dict) and udata.get("token") == token:
            user_info = {
                "name": uname,
                "role": udata.get("role", "user"),
                "allowed_uris": udata.get("allowed_uris", []),
                "allowed_actions": udata.get("allowed_actions", ["*"])
            }
            return True, user_info

    return False, None

def check_grant(user: Dict[str, Any], target_uri: str, action: str = "call") -> bool:
    """
    Checks if authenticated user has permission for target_uri and action.
    Supports wildcards via fnmatch (e.g. proc://taskand.dev/*).
    """
    if not user:
        return False

    allowed_actions = user.get("allowed_actions", [])
    if "*" not in allowed_actions and action not in allowed_actions:
        return False

    allowed_uris = user.get("allowed_uris", [])
    for pattern in allowed_uris:
        if pattern == "*" or fnmatch.fnmatch(target_uri, pattern):
            return True

    return False


def require_grant(request_handler, target_uri: str, action: str = "call") -> Optional[Dict[str, Any]]:
    """Zwraca użytkownika albo wysyła 401/403 i zwraca None."""
    is_auth, user = check_auth(request_handler.headers)
    if not is_auth:
        request_handler._send(401, {"ok": False, "statusCode": 401, "error": "Unauthorized: wymagany nagłówek Authorization: Bearer <token>"})
        return None
    if not check_grant(user, target_uri, action):
        request_handler._send(403, {"ok": False, "statusCode": 403, "error": f"Forbidden: '{user.get('name')}' ({user.get('role')}) nie ma grantu '{action}' do {target_uri}"})
        return None
    return user
