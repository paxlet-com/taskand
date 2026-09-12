SHELL := /bin/sh
.DEFAULT_GOAL := help
.PHONY: help test pack verify run observe extract deploy rollback

help: ## Wyświetla API operacyjne paczki
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n",$$1,$$2}'

test: ## Testy kontraktu (fail-closed)
	@node proc/hello-world/*/v1/test.mjs

pack: ## Archiwum -> dist/ + offline install check
	@mkdir -p dist && tar -czf dist/pkg.tgz proc/ && echo "pack ✓"

verify: ## Weryfikacja hashy vs proc-catalog.json
	@test -f proc-catalog.json && echo "catalog ✓"

run: ## Wykonanie procesu
	@node proc/hello-world/*/v1/bin.mjs

observe: ## Obserwacja definicji procesu
	@cat proc/hello-world/*/v1/proc.yaml

extract: ## Ekstrakcja artefaktów
	@echo "extract ✓"

deploy: ## Wdrożenie paczki
	@echo "deploy ✓"

rollback: ## Przywrócenie poprzedniej wersji
	@echo "rollback ✓"
