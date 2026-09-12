# taskand v2.0 Makefile — Minimalny, auto-mnożący się system
.PHONY: all up down status test test-contracts test-negative integration catalog gateway bootstrap clean

all: test

up:
	docker compose up -d

down:
	docker compose down

status:
	docker compose ps
	@./bin/taskand status

test: test-contracts test-negative

test-contracts:
	@echo "=== Weryfikacja kontraktów procesów taskand v2.2 (fail-closed) ==="
	@passed=0; total=0; \
	for bin in $$(find generated -name "bin.mjs" | sort); do \
		total=$$((total + 1)); \
		if echo '{}' | node "$$bin" >/dev/null 2>&1; then \
			echo "  $$bin: PASS ✓"; \
			passed=$$((passed + 1)); \
		else \
			echo "  $$bin: FAIL ✗"; \
			fi \
	done; \
	echo "Wynik kontraktów: $$passed/$$total PASS ✓"; \
	[ "$$passed" -eq "$$total" ]

test-negative:
	@node tests/negative_tests.mjs

integration:
	@node tests/integration_test.mjs

# Przelicza bindingHash w proc-catalog.json po ręcznej zmianie procesu
catalog:
	@node generated/_lib/catalog.mjs rehash

bootstrap:
	docker compose run --rm bootstrap

gateway:
	python3 gateway.py

clean:
	rm -rf log/events.jsonl
