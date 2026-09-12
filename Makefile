# taskand v1.0 Makefile
.PHONY: help bootstrap up down restart ps status logs logs-all tasks add add-watch web gateway-health install-cli check clean history show rollback snapshot clean-duplicates test pack verify run observe extract deploy conformance

SHELL := /bin/sh
PORT ?= 8090
URI ?= proc://taskand.dev/flow/login/v1

help: ## Wyświetla pomoc i listę dostępnych celów
	@echo "taskand-glm53 v1.0 — Standard Paczki i Procesów URI"
	@echo "Web Cockpit: http://localhost:8090 · Gateway REST API: http://localhost:8077"
	@echo ""
	@echo "Dostępne komendy:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Aktualny stan usług:"
	@docker compose ps 2>/dev/null || true

conformance: ## Sprawdza 9/9 punktów listy konformacji Standardu v1.0
	@node scripts/verify-conformance.mjs

test: ## Testy kontraktu wszystkich procesów URI (fail-closed)
	@node proc/browser/session/taskand.dev/v1/test.mjs
	@node proc/web/navigate/taskand.dev/v1/test.mjs
	@node proc/web/analyze/taskand.dev/v1/test.mjs
	@node proc/flow/login/taskand.dev/v1/test.mjs
	@echo "✓ Wszystkie procesy URI spełniają kontrakt (fail-closed)"

packages-test: ## Testy i konformacja wszystkich wydzielonych paczek (developer, chat, web, demo)
	@for pkg in packages/*; do \
		if [ -d "$$pkg" ]; then \
			echo "=== Testowanie paczki $$pkg ==="; \
			(cd "$$pkg" && make conformance && make test && make verify && make run) || exit 1; \
		fi; \
	done
	@echo "✓ Wszystkie wydzielone paczki przeszły pomyślnie testy i konformację!"

pack: ## Tworzy archiwum paczki w dist/ z testem offline
	@mkdir -p dist
	@tar -czf dist/taskand-glm53-v1.0.0.tgz proc/ schemas/ capsule.yaml grants.yaml proc-catalog.json
	@tar -tzf dist/taskand-glm53-v1.0.0.tgz >/dev/null && echo "pack ✓ (archiwum dist/taskand-glm53-v1.0.0.tgz gotowe)"

verify: ## Weryfikuje sumy SHA-256 w proc-catalog.json i konformację
	@node verify-catalog.mjs
	@node scripts/verify-conformance.mjs

run: ## Wykonuje proces URI przez uniwersalny launcher: make run [URI=proc://...]
	@printf '%s' '{"task":{"site":"semcod.com"}}' | node scripts/taskand-runner.mjs $(URI)

observe: ## Podgląd definicji procesu (proc.yaml): make observe [URI=proc://...]
	@node --input-type=module -e 'import {readFileSync} from "node:fs"; const m = "$(URI)".match(/^proc:\/\/([^/]+)\/(.+)\/(v\d+)$$/); if(m) console.log(readFileSync("proc/"+m[2]+"/"+m[1]+"/"+m[3]+"/proc.yaml","utf8"));'

extract: ## Ekstrakcja artefaktów z niemodyfikowalnej rewizji
	@mkdir -p dist/extracted
	@cp -r schemas/ dist/extracted/
	@echo "extract ✓ (wyekstrahowano artefakty do dist/extracted)"

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
	@curl -s http://localhost:8077/api/health | grep -q '"ok": true' && echo "✓ Gateway REST API działa (port 8077)" || echo "✗ Gateway nie odpowiada"

web: ## Uruchamia stronę landing page i Web Cockpit na porcie 8090: make web
	@docker compose up -d landing && echo "✓ Web Cockpit działa pod adresem: http://localhost:8090" || sh landing/serve.sh $(PORT)

check: ## Weryfikuje składnię wszystkich plików Dockerfile
	@docker build --check .
	@docker build --check -f gateway/Dockerfile gateway/
	@echo "✓ Wszystkie Dockerfile poprawne składniowo"

history: ## Wyświetla historię zadań i listę migawek z sumami SHA-256
	@./taskand.cli history

show: ## Wyświetla szczegóły i kod Dockerfile procesu: make show ID=t123_lub_snap_xxx
	@./taskand.cli show $(ID)

twin: ## Testuje proces w cyfrowym bliźniaku (Digital Twin Sandbox): make twin ID=t123 [DESC="opis"]
	@./taskand.cli twin $(ID) "$(DESC)"

rollback: ## Przywraca stan z wybranej migawki: make rollback ID=snap-xxx
	@./taskand.cli rollback $(ID)

snapshot: ## Tworzy ręczną migawkę katalogu lub pliku: make snapshot TARGET=katalog DESC="opis"
	@./taskand.cli snapshot "$(TARGET)" "$(DESC)"

clean-duplicates: ## Uruchamia proces czyszczenia zbędnych duplikatów (podkatalog taskand)
	@./taskand.cli clean

clean: ## Zatrzymuje kontenery i czyści zasoby
	@docker compose down -v
	@echo "✓ Kontenery zatrzymane i wyczyszczone"
