% ── Project Metadata ─────────────────────────────────────
project_metadata('glm53', '0.0.0', 'python').

% ── Project Files ────────────────────────────────────────
project_file('app.doql.less', 157, 'less').
project_file('landing/serve.sh', 22, 'shell').
project_file('project.sh', 59, 'shell').
project_file('scripts/digital_twin.py', 250, 'python').
project_file('scripts/dod_validator.py', 80, 'python').
project_file('scripts/history.py', 310, 'python').
project_file('serve.sh', 22, 'shell').
project_file('taskand.sh', 60, 'shell').
project_file('tree.sh', 2, 'shell').

% ── Python Functions ─────────────────────────────────────
python_function('scripts/digital_twin.py', 'load_env', 0, 6, 5).
python_function('scripts/digital_twin.py', 'log', 2, 1, 1).
python_function('scripts/digital_twin.py', 'create_twin_environment', 1, 5, 9).
python_function('scripts/digital_twin.py', 'run_twin_verification', 3, 9, 8).
python_function('scripts/digital_twin.py', 'ask_llm_for_repair', 4, 8, 15).
python_function('scripts/digital_twin.py', 'verify_and_evolve', 3, 6, 14).
python_function('scripts/dod_validator.py', 'run_cmd', 2, 1, 3).
python_function('scripts/dod_validator.py', 'validate_dod', 3, 19, 5).
python_function('scripts/history.py', 'ensure_dirs', 0, 2, 4).
python_function('scripts/history.py', 'compute_dir_hash', 1, 3, 10).
python_function('scripts/history.py', 'create_snapshot', 3, 9, 20).
python_function('scripts/history.py', 'list_history', 0, 21, 16).
python_function('scripts/history.py', 'show_details', 1, 12, 11).
python_function('scripts/history.py', 'rollback', 1, 20, 22).

% ── Python Classes ───────────────────────────────────────

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('SHELL', '').
makefile_target('help', '').
makefile_target('bootstrap', '').
makefile_target('install-cli', '').
makefile_target('up', '').
makefile_target('down', '').
makefile_target('restart', '').
makefile_target('status', '').
makefile_target('ps', '').
makefile_target('logs', '').
makefile_target('logs-all', '').
makefile_target('tasks', '').
makefile_target('add', '').
makefile_target('add-watch', '').
makefile_target('gateway-health', '').
makefile_target('web', '').
makefile_target('check', '').
makefile_target('history', '').
makefile_target('show', '').
makefile_target('twin', '').
makefile_target('rollback', '').
makefile_target('snapshot', '').
makefile_target('clean-duplicates', '').
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
sumd_workflow('bootstrap', 'manual').
sumd_workflow_step('bootstrap', 1, 'sh taskand.sh').
sumd_workflow('install-cli', 'manual').
sumd_workflow_step('install-cli', 1, 'mkdir -p ~/.local/bin').
sumd_workflow_step('install-cli', 2, 'chmod +x taskand.cli').
sumd_workflow_step('install-cli', 3, 'ln -sf "$(shell pwd)/taskand.cli" ~/.local/bin/taskand').
sumd_workflow_step('install-cli', 4, 'ln -sf "$(shell pwd)/taskand.cli" "$(shell pwd)/taskand"').
sumd_workflow_step('install-cli', 5, 'echo "✓ Narzędzie \'taskand\' zainstalowane w ~/.local/bin/taskand"').
sumd_workflow('up', 'manual').
sumd_workflow_step('up', 1, 'docker compose up -d').
sumd_workflow('down', 'manual').
sumd_workflow_step('down', 1, 'docker compose down').
sumd_workflow('restart', 'manual').
sumd_workflow_step('restart', 1, 'docker compose restart').
sumd_workflow('status', 'manual').
sumd_workflow_step('status', 1, 'docker compose ps').
sumd_workflow('ps', 'manual').
sumd_workflow('logs', 'manual').
sumd_workflow_step('logs', 1, 'docker compose logs -f nucleus').
sumd_workflow('logs-all', 'manual').
sumd_workflow_step('logs-all', 1, 'docker compose logs -f').
sumd_workflow('tasks', 'manual').
sumd_workflow_step('tasks', 1, 'echo "\033[33m=== Oczekujące zadania (tasks/inbox.yaml) ===\033[0m"').
sumd_workflow_step('tasks', 2, 'if [ -s tasks/inbox.yaml ]').
sumd_workflow_step('tasks', 3, 'echo ""').
sumd_workflow_step('tasks', 4, 'echo "\033[32m=== Wykonane zadania (tasks/done.yaml) ===\033[0m"').
sumd_workflow_step('tasks', 5, 'if [ -s tasks/done.yaml ]').
sumd_workflow('add', 'manual').
sumd_workflow_step('add', 1, 'if [ -z "$(TASK)" ]').
sumd_workflow_step('add', 2, 'echo "Błąd: podaj treść zadania, np.: make add TASK=\"stwórz projekt w organizacji semcod z README\""').
sumd_workflow_step('add', 3, 'exit 1').
sumd_workflow_step('add', 4, 'fi').
sumd_workflow_step('add', 5, './taskand.cli add "$(TASK)"').
sumd_workflow('add-watch', 'manual').
sumd_workflow_step('add-watch', 1, 'if [ -z "$(TASK)" ]').
sumd_workflow_step('add-watch', 2, 'echo "Błąd: podaj treść zadania, np.: make add-watch TASK=\"monitoruj stan usług\""').
sumd_workflow_step('add-watch', 3, 'exit 1').
sumd_workflow_step('add-watch', 4, 'fi').
sumd_workflow_step('add-watch', 5, './taskand.cli add -t obserwuj "$(TASK)"').
sumd_workflow('gateway-health', 'manual').
sumd_workflow_step('gateway-health', 1, 'curl -s http://localhost:8077/api/health | grep -q \'"ok": true\' && echo "✓ Gateway REST API działa (port 8077)" || echo "✗ Gateway nie odpowiada"').
sumd_workflow('web', 'manual').
sumd_workflow_step('web', 1, 'docker compose up -d landing && echo "✓ Web Cockpit działa pod adresem: http://localhost:8090" || sh landing/serve.sh $(PORT)').
sumd_workflow('check', 'manual').
sumd_workflow_step('check', 1, 'docker build --check .').
sumd_workflow_step('check', 2, 'docker build --check -f gateway/Dockerfile gateway/').
sumd_workflow_step('check', 3, 'echo "✓ Wszystkie Dockerfile poprawne składniowo"').
sumd_workflow('history', 'manual').
sumd_workflow_step('history', 1, './taskand.cli history').
sumd_workflow('show', 'manual').
sumd_workflow_step('show', 1, './taskand.cli show $(ID)').
sumd_workflow('twin', 'manual').
sumd_workflow_step('twin', 1, './taskand.cli twin $(ID) "$(DESC)"').
sumd_workflow('rollback', 'manual').
sumd_workflow_step('rollback', 1, './taskand.cli rollback $(ID)').
sumd_workflow('snapshot', 'manual').
sumd_workflow_step('snapshot', 1, './taskand.cli snapshot "$(TARGET)" "$(DESC)"').
sumd_workflow('clean-duplicates', 'manual').
sumd_workflow_step('clean-duplicates', 1, './taskand.cli clean').
sumd_workflow('clean', 'manual').
sumd_workflow_step('clean', 1, 'docker compose down -v').
sumd_workflow_step('clean', 2, 'echo "✓ Kontenery zatrzymane i wyczyszczone"').

