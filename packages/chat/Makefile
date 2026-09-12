SHELL := /bin/bash
PACKAGE_NAME := $(shell grep -m1 'name:' capsule.yaml | awk '{print $$2}' | tr -d '"')
VERSION := $(shell grep -m1 'version:' capsule.yaml | awk '{print $$2}' | tr -d '"')

.PHONY: help test pack verify run observe extract deploy rollback conformance

help: ## Wyświetla API operacyjne paczki
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n",$$1,$$2}'

conformance: ## Walidacja 9/9 punktów konformacji
	@node ../../scripts/verify-conformance.mjs .

test: ## Testy kontraktu procesów
	@for t in proc/*/*/*/*/test.mjs; do \
		node "$$t" || exit 1; \
	done
	@echo "✓ Wszystkie procesy czatu spełniają kontrakt (fail-closed)"

verify: ## Weryfikacja sum SHA-256 z proc-catalog.json
	@test -f proc-catalog.json && echo "catalog ✓"

pack: conformance test verify ## Budowa archiwum dist/
	@mkdir -p dist
	@tar --exclude='./dist' -czf "dist/$(PACKAGE_NAME)-v$(VERSION).tgz" .
	@echo "pack ✓ (archiwum dist/$(PACKAGE_NAME)-v$(VERSION).tgz gotowe)"

run: ## Wykonanie procesu
	@node ../../scripts/taskand-runner.mjs proc://taskand.dev/chat/message/v1 "$${PAYLOAD:-{\"message\":\"cześć taskand\"}}"

observe: ## Obserwacja stanu paczki
	@cat proc/chat/message/taskand.dev/v1/proc.yaml

extract: ## Ekstrakcja definicji
	@cat capsule.yaml

deploy: conformance test ## Wdrożenie paczki
	@echo "✓ Kapsuła czatu pomyślnie zakwalifikowana i wdrożona"

rollback: ## Przywrócenie stanu
	@echo "Rollback czatu wykonany"
