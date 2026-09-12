% ── Project Metadata ─────────────────────────────────────
project_metadata('glm53', '0.0.0', 'python').

% ── Project Files ────────────────────────────────────────
project_file('app.doql.less', 97, 'less').
project_file('gateway/__init__.py', 49, 'python').
project_file('gateway/auth.py', 125, 'python').
project_file('gateway/handlers/__init__.py', 1, 'python').
project_file('gateway/handlers/chat.py', 139, 'python').
project_file('gateway/handlers/doctor.py', 17, 'python').
project_file('gateway/handlers/federation.py', 26, 'python').
project_file('gateway/handlers/health.py', 12, 'python').
project_file('gateway/handlers/orchestrator.py', 50, 'python').
project_file('gateway/handlers/planner.py', 30, 'python').
project_file('gateway/handlers/proc.py', 66, 'python').
project_file('gateway/middleware/__init__.py', 1, 'python').
project_file('gateway/middleware/cors.py', 5, 'python').
project_file('gateway/middleware/logging.py', 23, 'python').
project_file('gateway/router.py', 28, 'python').
project_file('gateway/utils.py', 57, 'python').
project_file('gateway.py', 18, 'python').
project_file('generated/_lib/catalog.mjs', 110, 'javascript').
project_file('generated/_lib/proc.mjs', 59, 'javascript').
project_file('generated/admin/chat/taskand.dev/v1/bin.mjs', 10, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v1/bin.mjs', 292, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v1/test.mjs', 6, 'javascript').
project_file('generated/alert/telegram/taskand.dev/v1/bin.mjs', 60, 'javascript').
project_file('generated/alert/telegram/taskand.dev/v1/test.mjs', 19, 'javascript').
project_file('generated/browser/session/taskand.dev/v1/bin.mjs', 24, 'javascript').
project_file('generated/chat/message/taskand.dev/v1/bin.mjs', 25, 'javascript').
project_file('generated/dev/act/taskand.dev/v1/bin.mjs', 80, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/bin.mjs', 17, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/dispatch.mjs', 83, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/intent.mjs', 37, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('generated/dev/codegen/taskand.dev/v1/bin.mjs', 18, 'javascript').
project_file('generated/dev/composite/taskand.dev/v1/bin.mjs', 83, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/bin.mjs', 77, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/contract.mjs', 62, 'javascript').
project_file('generated/dev/execute/taskand.dev/v1/bin.mjs', 42, 'javascript').
project_file('generated/dev/execute/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('generated/dev/file-router/taskand.dev/v1/bin.mjs', 18, 'javascript').
project_file('generated/dev/llm/taskand.dev/v1/bin.mjs', 60, 'javascript').
project_file('generated/dev/llm/taskand.dev/v1/context.mjs', 17, 'javascript').
project_file('generated/developer/spawn/taskand.dev/v1/bin.mjs', 20, 'javascript').
project_file('generated/doctor/diagnose/taskand.dev/v1/bin.mjs', 51, 'javascript').
project_file('generated/doctor/prescribe/taskand.dev/v1/bin.mjs', 20, 'javascript').
project_file('generated/file/ops/taskand.dev/v1/bin.mjs', 21, 'javascript').
project_file('generated/hw/monitor/taskand.dev/v1/bin.mjs', 113, 'javascript').
project_file('generated/monitor/cpu/taskand.dev/v1/bin.mjs', 49, 'javascript').
project_file('generated/monitor/cpu/taskand.dev/v1/test.mjs', 15, 'javascript').
project_file('generated/orchestrator/execute/taskand.dev/v1/bin.mjs', 243, 'javascript').
project_file('generated/orchestrator/execute/taskand.dev/v1/test.mjs', 42, 'javascript').
project_file('generated/planner/plan/taskand.dev/v1/bin.mjs', 158, 'javascript').
project_file('generated/planner/plan/taskand.dev/v1/test.mjs', 15, 'javascript').
project_file('generated/validator/resolve/taskand.dev/v1/bin.mjs', 213, 'javascript').
project_file('generated/validator/resolve/taskand.dev/v1/test.mjs', 38, 'javascript').
project_file('generated/vault/secrets/taskand.dev/v1/bin.mjs', 21, 'javascript').
project_file('generated/web/serve/taskand.dev/v1/bin.mjs', 11, 'javascript').
project_file('generated/web/serve/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('project.sh', 59, 'shell').
project_file('tests/integration_test.mjs', 76, 'javascript').
project_file('tests/negative_tests.mjs', 148, 'javascript').

% ── Python Functions ─────────────────────────────────────
python_function('gateway/__init__.py', 'main', 0, 2, 8).
python_function('gateway/auth.py', '_parse_simple_yaml', 1, 14, 6).
python_function('gateway/auth.py', 'load_grants', 0, 7, 9).
python_function('gateway/auth.py', 'check_auth', 1, 8, 7).
python_function('gateway/auth.py', 'check_grant', 3, 7, 2).
python_function('gateway/handlers/chat.py', 'llm_env', 0, 2, 2).
python_function('gateway/handlers/chat.py', 'handle_chat', 2, 29, 14).
python_function('gateway/handlers/doctor.py', 'handle_doctor', 2, 4, 7).
python_function('gateway/handlers/federation.py', 'handle_federation', 2, 8, 12).
python_function('gateway/handlers/health.py', 'handle_healthz', 2, 2, 5).
python_function('gateway/handlers/orchestrator.py', 'handle_orchestrator', 2, 6, 11).
python_function('gateway/handlers/planner.py', 'handle_planner', 2, 5, 8).
python_function('gateway/handlers/proc.py', 'handle_proc_call', 2, 9, 12).
python_function('gateway/middleware/cors.py', 'add_cors_headers', 1, 1, 1).
python_function('gateway/middleware/logging.py', 'log_event', 2, 2, 6).
python_function('gateway/router.py', 'dispatch', 4, 3, 4).
python_function('gateway/utils.py', 'proc_hash', 1, 5, 7).
python_function('gateway/utils.py', 'find_proc_bin', 1, 9, 6).

% ── Python Classes ───────────────────────────────────────
python_class('gateway/__init__.py', 'GatewayHTTPHandler').
python_method('GatewayHTTPHandler', '_send', 2, 1, 9).
python_method('GatewayHTTPHandler', 'do_OPTIONS', 0, 1, 3).
python_method('GatewayHTTPHandler', 'do_GET', 0, 1, 1).
python_method('GatewayHTTPHandler', 'do_POST', 0, 4, 6).
python_method('GatewayHTTPHandler', 'log_message', 1, 2, 3).

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('all', '').
makefile_target('up', '').
makefile_target('down', '').
makefile_target('status', '').
makefile_target('test', '').
makefile_target('test-contracts', '').
makefile_target('test-negative', '').
makefile_target('integration', '').
makefile_target('catalog', 'Przelicza bindingHash w proc-catalog.json po ręcznej zmianie procesu').
makefile_target('bootstrap', '').
makefile_target('gateway', '').
makefile_target('clean', '').

% ── Taskfile Tasks ───────────────────────────────────────

% ── Environment Variables ────────────────────────────────
env_variable('TASKAND_LLM_API_KEY', '*(not set)*', '.env trzymaj poza git (.gitignore) — wchodzi tylko do runtime nucleusa').
env_variable('TASKAND_LLM_ENDPOINT', 'https://api.z.ai/api/paas/v4/chat/completions', '').
env_variable('TASKAND_LLM_MODEL', 'glm-5.3', '').

% ── TestQL Scenarios ─────────────────────────────────────
testql_scenario('generated-api-smoke.testql.toon.yaml', 'api').

% ── Semantic Facts from SUMD.md ──────────────────────────
sumd_declared_file('app.doql.less', 'doql').
sumd_declared_file('testql-scenarios/generated-api-smoke.testql.toon.yaml', 'testql').
sumd_declared_file('project/map.toon.yaml', 'analysis').
sumd_declared_file('project/logic.pl', 'analysis').
sumd_declared_file('project/calls.toon.yaml', 'analysis').
sumd_interface('web', '').
sumd_workflow('up', 'manual').
sumd_workflow_step('up', 1, 'docker compose up -d').
sumd_workflow('down', 'manual').
sumd_workflow_step('down', 1, 'docker compose down').
sumd_workflow('status', 'manual').
sumd_workflow_step('status', 1, 'docker compose ps').
sumd_workflow_step('status', 2, './bin/taskand status').
sumd_workflow('test', 'manual').
sumd_workflow('test-contracts', 'manual').
sumd_workflow_step('test-contracts', 1, 'echo "=== Weryfikacja kontraktów procesów taskand v2.2 (fail-closed) ==="').
sumd_workflow_step('test-contracts', 2, 'passed=0').
sumd_workflow_step('test-contracts', 3, 'for bin in $$(find generated -name "bin.mjs" | sort)').
sumd_workflow_step('test-contracts', 4, 'total=$$((total + 1))').
sumd_workflow('test-negative', 'manual').
sumd_workflow_step('test-negative', 1, 'node tests/negative_tests.mjs').
sumd_workflow('integration', 'manual').
sumd_workflow_step('integration', 1, 'node tests/integration_test.mjs').
sumd_workflow('catalog', 'manual').
sumd_workflow_step('catalog', 1, 'node generated/_lib/catalog.mjs rehash').
sumd_workflow('bootstrap', 'manual').
sumd_workflow_step('bootstrap', 1, 'docker compose run --rm bootstrap').
sumd_workflow('gateway', 'manual').
sumd_workflow_step('gateway', 1, 'python3 gateway.py').
sumd_workflow('clean', 'manual').
sumd_workflow_step('clean', 1, 'rm -rf log/events.jsonl').

