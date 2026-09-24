#!/usr/bin/env python3
"""Explicit, one-request provider probe; generated code is compiled, never run."""
import argparse
import contextlib
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import urlsplit


def probe(env_file):
    from dotenv import dotenv_values
    from nl_dsl_sh import Engine, LLMConfig, LiteLLMClient

    values = dotenv_values(env_file, interpolate=False)
    endpoint = values.get("TASKAND_LLM_ENDPOINT", "")
    parsed = urlsplit(endpoint)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Expected HTTPS provider endpoint without embedded credentials")
    if not endpoint.endswith("/chat/completions"):
        raise ValueError("Expected an OpenAI-compatible chat completions endpoint")
    model, key = values.get("TASKAND_LLM_MODEL"), values.get("TASKAND_LLM_API_KEY")
    if not model or not key:
        raise ValueError("Taskand provider model/key missing")
    config = LLMConfig(model="openai/" + model, api_base=endpoint.removesuffix("/chat/completions"),
                       api_key=key, timeout=45, max_tokens=3000, json_mode=True)
    engine = Engine(llm=LiteLLMClient(config), repair_attempts=0)
    # Third-party diagnostics may include request data; never send them to receipts.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        plan = engine.plan("Create one Python step that only prints the literal Taskand live provider probe. "
                           "No imports, file access, network access, commands or other effects.", language="python")
        artifact = engine.compile(plan)
    return {"ok": True, "providerHost": parsed.hostname, "model": model,
            "maxTokens": config.max_tokens, "repairAttempts": 0, "executed": False,
            "plan": plan.model_dump(), "scriptSha256": hashlib.sha256(artifact.script.encode()).hexdigest()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--taskand-env", type=Path, required=True,
                        help="Explicit existing Taskand provider configuration; never copied")
    args = parser.parse_args()
    try:
        print(json.dumps(probe(args.taskand_env), indent=2))
    except Exception as error:
        # Exception messages can contain provider credentials or bodies.
        print(json.dumps({"ok": False, "errorType": type(error).__name__, "executed": False}))
        raise SystemExit(1)
