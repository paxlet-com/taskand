# taskand v0.4 Makefile
.PHONY: help bootstrap up down restart ps status logs logs-all tasks add add-watch web gateway-health install-cli check clean history show rollback snapshot clean-duplicates

SHELL := /bin/sh
PORT ?= 8080

help: ## Wyświetla pomoc i listę dostępnych celów
	@echo "taskand v0.4 — System zadań i planista GLM-5.3"
	@echo ""
	@echo "Dostępne komendy:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Aktualny stan usług:"
	@docker compose ps 2>/dev/null || true

bootstrap: ## Uruchamia interaktywny onboarding i instalację (taskand.sh)
	@sh taskand.sh

install-cli: ## Instaluje/podpina narzędzie CLI 'taskand' do ~/.local/bin/taskand
	@mkdir -p ~/.local/bin
	@chmod +x taskand.cli
	@ln -sf "$(shell pwd)/taskand.cli" ~/.local/bin/taskand
	@ln -sf "$(shell pwd)/taskand.cli" "$(shell pwd)/taskand"
	@echo "✓ Narzędzie 'taskand' zainstalowane w ~/.local/bin/taskand"

up: ## Uruchamia kontenery taskand w tle (docker compose)
	@docker compose up -d

down: ## Zatrzymuje kontenery taskand
	@docker compose down

restart: ## Restartuje kontenery taskand
	@docker compose restart

status: ## Sprawdza stan kontenerów (docker compose ps)
	@docker compose ps

ps: status

logs: ## Śledzi logi kontrolera nucleus (planisty) na żywo
	@docker compose logs -f nucleus

logs-all: ## Śledzi logi wszystkich usług (nucleus + gateway)
	@docker compose logs -f

tasks: ## Wyświetla kolejkę zadań (tasks/inbox.yaml) oraz historię (tasks/done.yaml)
	@echo "\033[33m=== Oczekujące zadania (tasks/inbox.yaml) ===\033[0m"
	@if [ -s tasks/inbox.yaml ]; then cat tasks/inbox.yaml; else echo "(brak zadań w kolejce)"; fi
	@echo ""
	@echo "\033[32m=== Wykonane zadania (tasks/done.yaml) ===\033[0m"
	@if [ -s tasks/done.yaml ]; then cat tasks/done.yaml; else echo "(brak wykonanych zadań)"; fi

add: ## Dodaje zadanie typu github-projekt: make add TASK="opis zadania"
	@if [ -z "$(TASK)" ]; then \
		echo "Błąd: podaj treść zadania, np.: make add TASK=\"stwórz projekt w organizacji semcod z README\""; \
		exit 1; \
	fi
	@./taskand.cli add "$(TASK)"

add-watch: ## Dodaje zadanie typu obserwuj: make add-watch TASK="opis"
	@if [ -z "$(TASK)" ]; then \
		echo "Błąd: podaj treść zadania, np.: make add-watch TASK=\"monitoruj stan usług\""; \
		exit 1; \
	fi
	@./taskand.cli add -t obserwuj "$(TASK)"

gateway-health: ## Sprawdza stan bramki HTTP (port 8077)
	@curl -s http://localhost:8077/health | grep -q '"ok": true' && echo "✓ Gateway HTTP działa (port 8077)" || echo "✗ Gateway nie odpowiada"

web: ## Uruchamia serwer landing page (domyślnie port 8080): make web PORT=8080
	@sh serve.sh $(PORT)

check: ## Weryfikuje składnię wszystkich plików Dockerfile
	@docker build --check .
	@docker build --check -f gateway/Dockerfile gateway/
	@echo "✓ Wszystkie Dockerfile poprawne składniowo"

history: ## Wyświetla historię zadań i listę migawek z sumami SHA-256
	@./taskand.cli history

show: ## Wyświetla szczegóły i kod Dockerfile procesu: make show ID=t123_lub_snap_xxx
	@./taskand.cli show $(ID)

rollback: ## Przywraca stan z wybranej migawki: make rollback ID=snap-xxx
	@./taskand.cli rollback $(ID)

snapshot: ## Tworzy ręczną migawkę katalogu lub pliku: make snapshot TARGET=katalog DESC="opis"
	@./taskand.cli snapshot "$(TARGET)" "$(DESC)"

clean-duplicates: ## Uruchamia proces czyszczenia zbędnych duplikatów (podkatalog taskand)
	@./taskand.cli clean

clean: ## Zatrzymuje kontenery i czyści zasoby
	@docker compose down -v
	@echo "✓ Kontenery zatrzymane i wyczyszczone"
