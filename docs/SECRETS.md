# Zarządzanie Sekretami i Hasłami w Procesach Dockerfile (taskand-glm53)

## 1. Fundamentalna zasada bezpieczeństwa

> **NIGDY nie umieszczaj haseł, kluczy API, tokenów ani poświadczeń bezpośrednio w treści wygenerowanego pliku `Dockerfile`.**

### Dlaczego?
1. **Wyciek do repozytorium Git**: Pliki `evolution/<task_id>/Dockerfile` są rejestrowane w gicie. Każde hasło w pliku trafi do historii repozytorium (`git log`, commity, zdalne repozytoria na GitHubie).
2. **Wyciek do warstw obrazu Dockera**: Dyrektywy takie jak `ENV PASSWORD="tajne"` lub `RUN curl -u user:password` są utrwalane w metadanych obrazu i widoczne w poleceniach `docker history` oraz `docker inspect`.
3. **Naruszenie immutability**: Proces staje się nieprzenośny między środowiskami (test, staging, prod).

---

## 2. Trzy zatwierdzone wzorce przekazywania sekretów do procesu-Dockerfile

### Wzorzec 1: Wstrzykiwanie w fazie wykonania kontenera (Runtime Environment)
Najprostszy i najbezpieczniejszy standard dla procesów realizowanych w `docker compose` lub `docker run`.

* **Gdzie są sekrety?**
  * Na hoście w pliku `.env` (który jest w `.gitignore` i nie trafia do gita), LUB:
  * W menedżerze sekretów (**HashiCorp Vault**, AWS Secrets Manager, Doppler, 1Password CLI, pass).
* **Jak proces w `Dockerfile` z nich korzysta?**
  W pliku `Dockerfile` proces deklaruje jedynie zmienną (bez podawania wartości) lub odwołuje się do niej w skrypcie:
  ```dockerfile
  # evolution/<task_id>/Dockerfile
  FROM alpine:3.20
  RUN apk add --no-cache curl postgresql-client
  COPY entry.sh /entry.sh
  ENTRYPOINT ["/entry.sh"]
  ```
  W `entry.sh`:
  ```sh
  #!/bin/sh
  set -eu
  # Pobiera hasło ze zmiennej środowiskowej wstrzykniętej do kontenera w runtime
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -c "SELECT 1;"
  ```
* **Jak kontroler / compose przekazuje sekret?**
  W `docker-compose.yaml` lub poleceniu `docker run`:
  ```yaml
  task-t123:
    build: ./evolution/t123
    environment:
      - DB_PASSWORD=${DB_PASSWORD}
      - VAULT_TOKEN=${VAULT_TOKEN}
      - STRIPE_KEY=${STRIPE_KEY}
  ```
  W ten sposób wygenerowany `Dockerfile` jest w 100% czysty i bezpieczny do commitu do Git.

---

### Wzorzec 2: HashiCorp Vault / Dynamic Secrets (Standard korporacyjny)
Jeśli proces potrzebuje poświadczeń o ograniczonym czasie życia (TTL) lub dynamicznych haseł bazodanowych:

1. **Przekazanie tożsamości do kontenera**:
   Kontener procesu otrzymuje w runtime zmienne:
   ```env
   VAULT_ADDR=https://vault.internal:8200
   VAULT_ROLE=taskand-worker
   VAULT_TOKEN=${VAULT_TOKEN}  # lub zamontowany token z Vault Agent
   ```
2. **Pobranie sekretu wewnątrz skryptu startowego `/entry.sh`**:
   ```sh
   #!/bin/sh
   # Pobranie sekretu bezpośrednio do pamięci procesu (RAM), nigdy na dysk
   SECRET_JSON=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/secret/data/database")
   DB_PASS=$(echo "$SECRET_JSON" | jq -r '.data.data.password')
   ```
3. Po zakończeniu zadania poświadczenie może wygasnąć (lease revocation).

---

### Wzorzec 3: Docker BuildKit Secrets (`--mount=type=secret`)
Używany wtedy, gdy hasło lub token jest potrzebne **w trakcie budowania obrazu** (np. pobranie prywatnego modułu Go/Python/NPM z prywatnego rejestru):

* **W pliku `Dockerfile`**:
  ```dockerfile
  # syntax=docker/dockerfile:1
  FROM alpine:3.20
  RUN apk add --no-cache curl
  # Sekret jest montowany tylko w RAM na czas tego jednego kroku i NIE trafia do warstw obrazu
  RUN --mount=type=secret,id=registry_token \
      TOKEN=$(cat /run/secrets/registry_token) && \
      curl -H "Authorization: Bearer $TOKEN" -o /app/private-asset.tar.gz https://repo.internal/asset.tar.gz
  ```
* **Budowanie kontenera**:
  ```bash
  docker build --secret id=registry_token,src=.env.secret -t task-image .
  ```

---

### Wzorzec 4: Montowanie poświadczeń hosta tylko do odczytu (Read-Only Mount)
Wzorzec zastosowany już w `taskand-glm53` dla autoryzacji z GitHubem:
* Poświadczenia hosta (`~/.config/gh`) są montowane do kontenera z flagą `:ro` (read-only):
  `-v ~/.config/gh:/root/.config/gh:ro`
* Kontener może wykonywać operacje w imieniu hosta, ale żaden klucz ani token nie jest kopiowany do obrazu ani zapisywany w plikach projektu.

---

## 3. Podsumowanie macierzy decyzyjnej

| Przypadek użycia | Rekomendowany mechanizm | Gdzie jest sekret? | Czy hasło trafia do Dockerfile? |
|---|---|---|---|
| Połączenie z bazą / API w trakcie działania | Zmienna środowiskowa (`environment`) | `.env` na hoście lub Vault | **NIE** (tylko `$NAZWA_ZMIENNEJ`) |
| Korporacyjne zarządzanie dostępem | Vault Secret / Token | HashiCorp Vault Server | **NIE** (pobierany w RAM) |
| Pobieranie prywatnych zależności przy `build` | Docker BuildKit Secret (`--mount=type=secret`) | Plik sekretu na hoście | **NIE** (montowany w locie) |
| Narzędzia CLI hosta (np. GitHub CLI) | Wolumen read-only (`-v ...:ro`) | Bezpieczny katalog hosta | **NIE** |
