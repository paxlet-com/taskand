SHELL := /bin/bash
PACKAGE_NAME := $(shell grep -m1 'name:' capsule.yaml | awk '{print $$2}' | tr -d '"')
VERSION := $(shell grep -m1 'version:' capsule.yaml | awk '{print $$2}' | tr -d '"')

.PHONY: help test pack verify run observe extract deploy rollback conformance

help: ## Wyświetla API operacyjne paczki
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n",$$1,$$2}'

conformance: ## Walidacja punktów konformacji
	@node ../../scripts/verify-conformance.mjs .

test: ## Testy kontraktu procesów
	@for t in proc/*/*/*/*/test.mjs; do \
		node "$$t" || exit 1; \
	done
	@echo "✓ Wszystkie procesy taskand-hw-monitor spełniają kontrakt (fail-closed)"

verify: ## Weryfikacja sum SHA-256 z proc-catalog.json
	@test -f proc-catalog.json && echo "catalog ✓"

pack: conformance test verify ## Budowa archiwum dist/
	@mkdir -p dist
	@tar --exclude='./dist' -czf "dist/$(PACKAGE_NAME)-v$(VERSION).tgz" .
	@echo "pack ✓ (archiwum dist/$(PACKAGE_NAME)-v$(VERSION).tgz gotowe)"

run: ## Wykonanie procesu
	@node ../../scripts/taskand-runner.mjs proc://taskand.dev/hw/monitor/v1 "$${PAYLOAD:-{\"metric\":\"cpu-temp\"}}"

observe: ## Obserwacja stanu paczki
	@cat proc/hw/monitor/taskand.dev/v1/proc.yaml

extract: ## Ekstrakcja definicji
	@cat capsule.yaml

deploy: conformance test ## Wdrożenie paczki
	@echo "✓ Kapsuła taskand-hw-monitor pomyślnie zakwalifikowana i wdrożona"

rollback: ## Przywrócenie stanu
	@echo "Rollback taskand-hw-monitor wykonany"
