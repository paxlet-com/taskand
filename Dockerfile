# syntax=docker/dockerfile:1
# taskand · v0.4 — JEDEN Dockerfile, DWA tryby:
#   docker run -it …  → tryb shell: 4 konkretne pytania; KAŻDY krok instalacji
#                       wykonuje się jako osobny proces-Dockerfile (install-*)
#   docker compose    → tryb daemon: pętla zadań (nucleus) sterująca compose
# Oba w kontenerach — od pierwszej sekundy nic nie działa na hoście bez dockera.

FROM docker:27-cli

LABEL org.taskand.role="bootstrap+controller" \
      org.taskand.version="0.4.0"

WORKDIR /taskand

COPY <<'ENTRY' /usr/local/bin/taskand-entry
#!/bin/sh
set -eu
if [ -t 0 ]; then exec /usr/local/bin/onboarding; fi
exec /usr/local/bin/nucleus
ENTRY

COPY <<'ONB' /usr/local/bin/onboarding
#!/bin/sh
# tryb shell — pierwsze uruchomienie (pytania + instalacja procesami)
set -eu
TD=/taskand
EVO="$TD/evolution"
COMPOSE="$TD/docker-compose.yaml"
HOSTDIR="$TASKAND_HOST_DIR"
HOSTHOME="$TASKAND_HOST_HOME"
[ -n "$HOSTDIR" ]  || HOSTDIR="$TD"
[ -n "$HOSTHOME" ] || HOSTHOME=/root
mkdir -p "$TD/answers" "$TD/tasks" "$TD/log" "$EVO"
touch "$TD/tasks/inbox.yaml"
chmod -R a+rwX "$TD/answers" "$TD/tasks" "$TD/log" "$EVO"

say(){ printf '\ntaskand ❯ %s\n' "$1"; }
say "pierwsze uruchomienie taskand v0.4 — 4 pytania"
say "każdy krok instalacji wykonam jako proces-Dockerfile (evolution/install-*)"

printf '\n1/4 · cel systemu [asystent-tekstu | ci-cd | agent-danych]: '
read -r CEL;   [ -n "$CEL" ]   || CEL=asystent-tekstu
printf '2/4 · organizacja GitHub dla zadań gh [- pomija]: '
read -r ORG;   [ -n "$ORG" ]   || ORG=-
printf '3/4 · limit wersji przed handoverem [4]: '
read -r LIMIT; [ -n "$LIMIT" ] || LIMIT=4
printf '4/4 · klucz GLM-5.3 wklejony do .env? [tak|nie]: '
read -r LLM;   [ -n "$LLM" ]   || LLM=nie

# ——— krok 1/3 · install-cache: proces-Dockerfile ———
D="$EVO/install-cache"; mkdir -p "$D"
cat > "$D/Dockerfile" <<'EOF'
# taskand · install-cache — podgrzewa obrazy dla potomków
FROM alpine:3.20
RUN echo "cache: alpine:3.20 gotowy dla zadań"
EOF
docker build -q -t taskand/install-cache "$D" >/dev/null
docker run --rm taskand/install-cache
printf 'taskand ❯ install-cache ✓ (evolution/install-cache/Dockerfile)\n'

# ——— krok 2/3 · install-ghauth: proces-Dockerfile, auth hosta (ro) ———
if [ "$ORG" != "-" ]; then
  D="$EVO/install-ghauth"; mkdir -p "$D"
  cat > "$D/Dockerfile" <<'EOF'
# taskand · install-ghauth — sprawdza uwierzytelnienie gh hosta
FROM alpine:3.20
RUN apk add --no-cache github-cli
ENTRYPOINT ["gh", "auth", "status"]
EOF
  docker build -q -t taskand/install-ghauth "$D" >/dev/null
  docker run --rm -v "$HOSTHOME/.config/gh:/root/.config/gh:ro" taskand/install-ghauth \
    || printf 'taskand ❯ gh nie zalogowane — zaloguj na hoście: gh auth login\n'
  printf 'taskand ❯ install-ghauth ✓ (evolution/install-ghauth/Dockerfile)\n'
else
  printf 'taskand ❯ org „-”: pomijam gh — zadania github będą czekać\n'
fi

# ——— krok 3/3 · install-answers: odpowiedzi zapisuje PROCES ———
D="$EVO/install-answers"; mkdir -p "$D"
sed -e "s/@CEL@/$CEL/" -e "s/@ORG@/$ORG/" -e "s/@LIMIT@/$LIMIT/" -e "s/@LLM@/$LLM/" \
  > "$D/Dockerfile" <<'EOF'
# taskand · install-answers — answers.yaml pisze proces, nie skrypt hosta
FROM alpine:3.20
WORKDIR /taskand
COPY <<'W' /entry.sh
#!/bin/sh
cat > /taskand/answers/taskand.answers.yaml <<'A'
# taskand · answers · bootstrap v0.4
cel: @CEL@
org: @ORG@
limit_wersji: @LIMIT@
llm: @LLM@
A
cat /taskand/answers/taskand.answers.yaml
W
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
EOF
docker build -q -t taskand/install-answers "$D" >/dev/null
docker run --rm -v "$HOSTDIR":/taskand taskand/install-answers
printf 'taskand ❯ install-answers ✓ (evolution/install-answers/Dockerfile)\n'

# ——— start systemu — od teraz docker-compose prowadzi ———
if [ -f "$COMPOSE" ]; then
  docker compose -f "$COMPOSE" up -d --build
  say "system działa — od teraz docker-compose prowadzi"
  printf '  docker compose ps · docker compose logs -f nucleus\n'
  printf '  zadania: tasks/inbox.yaml · START-HERE.md na dysku\n'
  say "pierwsze zdanie (gotowe do wklejenia):"
  printf '  printf -- "- id: t001\n  typ: github-projekt\n  z: stwórz projekt w organizacji %s z README\n" >> tasks/inbox.yaml\n' "$ORG"
else
  say "brak docker-compose.yaml — pobierz pełny pakiet i powtórz instalację"
fi
ONB

COPY <<'NUC' /usr/local/bin/nucleus
#!/bin/sh
# tryb daemon — pętla zadań (planista GLM-5.3 + ścieżka gh + handover)
set -eu
umask 0000
TD=/taskand
COMPOSE="$TD/docker-compose.yaml"
EVO="$TD/evolution"
INBOX="$TD/tasks/inbox.yaml"
LOG="$TD/log/evolution.log"
VER=0.4
ROLE=controller
ANS="$TD/answers/taskand.answers.yaml"
[ -f "$ANS" ] || ANS="$TD/answers.yaml"

yget(){ awk -F': *' -v k="$2" '{gsub(/^[ \t-]+/, "", $1)} $1==k{print $2; exit}' "$1"; }
log(){ printf '[taskand v%s · %s] %s\n' "$VER" "$ROLE" "$1" | tee -a "$LOG"; }

ENDPOINT="$TASKAND_LLM_ENDPOINT"; [ -n "$ENDPOINT" ] || ENDPOINT=https://api.z.ai/api/paas/v4/chat/completions
MODEL="$TASKAND_LLM_MODEL";         [ -n "$MODEL" ]    || MODEL=glm-5.3
HOSTHOME="$TASKAND_HOST_HOME";      [ -n "$HOSTHOME" ] || HOSTHOME=/root
HOSTDIR="$TASKAND_HOST_DIR";        [ -n "$HOSTDIR" ]  || HOSTDIR="$TD"
GHCONF="$HOSTHOME/.config/gh"
ORG=$(yget "$ANS" org);         [ -n "$ORG" ]   || ORG=-
LIMIT=$(yget "$ANS" limit_wersji); [ -n "$LIMIT" ] || LIMIT=4

log "gotowy · zadania: tasks/inbox.yaml (shell) albo POST :8077/tasks · org=$ORG · limit=$LIMIT"
if [ -n "$TASKAND_LLM_API_KEY" ]; then log "planista: $MODEL (klucz z .env — runtime)"; else log "planista: plan lokalny (brak klucza w .env)"; fi

plan(){
  if [ -z "$TASKAND_LLM_API_KEY" ]; then
    printf 'REPO: taskand\nORG: %s\nREADME_START\n# taskand\n\nproces, który sam się rozrasta.\nREADME_END\n' "$ORG"
    return 0
  fi
  ZJ=$(printf '%s' "$1" | sed 's/"/\\"/g')
  BODY=$(printf '{"model":"%s","messages":[{"role":"system","content":"Planista taskand. Odpowiedz DOKŁADNIE:\\nREPO: nazwa\\nORG: organizacja albo -\\nREADME_START\\n<markdown README: co to, filozofia, szybki start, bezpieczeństwo>\\nREADME_END"},{"role":"user","content":"%s"}],"temperature":0.3,"max_tokens":1200}' "$MODEL" "$ZJ")
  wget -qO- --header="Content-Type: application/json" \
       --header="Authorization: Bearer $TASKAND_LLM_API_KEY" \
       --post-data="$BODY" "$ENDPOINT" 2>> "$LOG" \
    | sed 's/\\n/\n/g' > /tmp/plan.raw || true
  [ -s /tmp/plan.raw ] || printf 'REPO: taskand\nORG: %s\nREADME_START\n# taskand\nREADME_END\n' "$ORG"
}

gh_child(){
  sed -e "s/@ID@/$1/g" -e "s/@ORG@/$2/g" -e "s/@REPO@/$3/g" <<'EOF'
# taskand · task-@ID@ · github-projekt · ręce: gh (auth hosta, read-only)
FROM alpine:3.20
RUN apk add --no-cache git github-cli
ENV TASKAND_ORG=@ORG@
ENV TASKAND_REPO=@REPO@
WORKDIR /work
COPY README.md /work/README.md
COPY <<'TSK' /entry.sh
#!/bin/sh
set -eu
ORG="$TASKAND_ORG"; REPO="$TASKAND_REPO"
if [ -n "$ORG" ] && [ "$ORG" != "-" ]; then FULL="$ORG/$REPO"; else FULL="$REPO"; fi
git config --global user.name "taskand"
git config --global user.email "taskand@local"
gh auth setup-git 2>/dev/null || true
git init -q -b main . && git add README.md
git commit -qm "taskand: README od planisty"
gh repo create "$FULL" --public 2>/dev/null || echo "repo istnieje — push"
git remote add origin "https://github.com/$FULL.git"
git push -q -u origin main
echo "[task-@ID@] repo gotowe: https://github.com/$FULL"
TSK
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
EOF
}

SPAWNED=0
while :; do
  [ -s "$INBOX" ] || { sleep 3; continue; }
  T=$(mktemp)
  awk '/^- id:/{if(n++)exit} n' "$INBOX" > "$T"
  [ -s "$T" ] || { sleep 3; continue; }
  TID=$(yget "$T" id);   [ -n "$TID" ]  || TID=t$(date +%s)
  TTYP=$(yget "$T" typ); [ -n "$TTYP" ] || TTYP=obserwuj
  TZ=$(yget "$T" z);     [ -n "$TZ" ]   || TZ=-
  LINE=$(grep -n '^- id:' "$INBOX" | sed -n '2p' | cut -d: -f1)
  if [ -n "$LINE" ]; then tail -n +"$LINE" "$INBOX" > "$INBOX.next"; else : > "$INBOX.next"; fi
  mv "$INBOX.next" "$INBOX"
  D="$EVO/$TID"; mkdir -p "$D"
  if [ "$TTYP" = "handover" ]; then
    log "zadanie $TID: HANDOVER żądany"
    echo "- id: $TID · typ: $TTYP · $(date '+%F %T')" >> "$TD/tasks/done.yaml"
    break
  fi
  if [ "$TTYP" = "github-projekt" ]; then
    plan "$TZ" > /tmp/plan.txt
    PREPO=$(sed -n 's/^REPO: *//p' /tmp/plan.txt | head -1); [ -n "$PREPO" ] || PREPO=taskand
    PORG=$(sed -n 's/^ORG: *//p' /tmp/plan.txt | head -1);   [ -n "$PORG" ] || PORG="$ORG"
    log "zadanie $TID: plan ($MODEL): repo=$PREPO org=$PORG"
    awk '/^README_START/{f=1;next} /^README_END/{f=0} f' /tmp/plan.txt > "$D/README.md"
    [ -s "$D/README.md" ] || printf '# taskand\n\nproces w Dockerfile.\n' > "$D/README.md"
    gh_child "$TID" "$PORG" "$PREPO" > "$D/Dockerfile"
    printf '\n  task-%s:\n    build: ./evolution/%s\n    volumes:\n      - %s:/root/.config/gh:ro\n    restart: "no"\n' "$TID" "$TID" "$GHCONF" >> "$COMPOSE"
    docker compose -f "$COMPOSE" up -d --build "task-$TID"
    log "zadanie $TID: compose: task-$TID up · gh tworzy $PORG/$PREPO"
    echo "- id: $TID · typ: $TTYP · $(date '+%F %T')" >> "$TD/tasks/done.yaml"
  elif [ "$TTYP" = "git-push" ] || [ "$TTYP" = "git-sync" ]; then
    log "zadanie $TID: rozpoczęto proces synchronizacji Git ($TZ)"
    cat > "$D/Dockerfile" <<'DOCKER_SPEC'
# taskand · task-@ID@ · proces-Dockerfile synchronizacji repozytorium z GitHub
FROM alpine:3.20
RUN apk add --no-cache git github-cli
WORKDIR /project
COPY <<'TSK' /entry.sh
#!/bin/sh
set -eu
ORG="@ORG@"; REPO="@REPO@"
[ -n "$REPO" ] || REPO="taskand"
if [ -n "$ORG" ] && [ "$ORG" != "-" ]; then FULL="$ORG/$REPO"; else FULL="$REPO"; fi

echo "[task-@ID@] konfiguracja poświadczeń git i katalogu..."
git config --global user.name "taskand"
git config --global user.email "taskand@local"
git config --global --add safe.directory /project
gh auth setup-git 2>/dev/null || true

cd /project
if [ ! -d ".git" ]; then
  echo "[task-@ID@] inicjalizacja repozytorium git w projekcie..."
  git init -b main
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[task-@ID@] dodawanie remote origin: https://github.com/$FULL.git"
  git remote add origin "https://github.com/$FULL.git"
fi

echo "[task-@ID@] sprawdzanie zmian i commit..."
git add -A
if git diff --cached --quiet; then
  echo "[task-@ID@] brak nowych zmian do zatwierdzenia."
else
  git commit -m "taskand: synchronizacja projektu [task-@ID@]"
  echo "[task-@ID@] utworzono commit."
fi

echo "[task-@ID@] wypychanie zmian do GitHub ($FULL)..."
git push -u origin main || git push origin main --force
echo "[task-@ID@] synchronizacja git zakończona sukcesem ✓: https://github.com/$FULL"
TSK
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
DOCKER_SPEC
    sed -i -e "s/@ID@/$TID/g" -e "s/@ORG@/$ORG/g" -e "s/@REPO@/taskand/g" "$D/Dockerfile"
    docker build -q -t "taskand/task-$TID" "$D" >/dev/null
    docker run --rm \
      -v "$HOSTDIR":/project \
      -v "$GHCONF":/root/.config/gh:ro \
      "taskand/task-$TID" 2>&1 | tee -a "$LOG"
    echo "- id: $TID · typ: $TTYP · $(date '+%F %T')" >> "$TD/tasks/done.yaml"
    log "zadanie $TID: synchronizacja git zakończona sukcesem ✓"
  elif [ "$TTYP" = "czyszczenie" ] || [ "$TTYP" = "cleanup" ]; then
    log "zadanie $TID: rozpoczęto proces czyszczenia ($TZ)"
    cat > "$D/Dockerfile" <<'DOCKER_SPEC'
# taskand · task-@ID@ · proces-Dockerfile usuwający zbędne duplikaty
FROM alpine:3.20
WORKDIR /project
COPY <<'TSK' /entry.sh
#!/bin/sh
set -eu
if [ -d "/project/taskand" ]; then
  echo "[task-@ID@] wykryto zbędny podkatalog /project/taskand — usuwanie..."
  rm -rf /project/taskand
  echo "[task-@ID@] ✓ podkatalog taskand usunięty pomyślnie."
else
  echo "[task-@ID@] brak podkatalogu taskand do usunięcia."
fi
echo "[task-@ID@] czyszczenie zakończone sukcesem ✓"
TSK
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
DOCKER_SPEC
    sed -i "s/@ID@/$TID/g" "$D/Dockerfile"
    docker build -q -t "taskand/task-$TID" "$D" >/dev/null
    docker run --rm -v "$HOSTDIR":/project "taskand/task-$TID" 2>&1 | tee -a "$LOG"
    echo "- id: $TID · typ: $TTYP · $(date '+%F %T')" >> "$TD/tasks/done.yaml"
    log "zadanie $TID: czyszczenie zakończone sukcesem ✓"
  else
    sed -e "s/@ID@/$TID/g" -e "s/@TYP@/$TTYP/g" > "$D/Dockerfile" <<'DOCKER_SPEC'
FROM alpine:3.20
COPY <<'RUNSH' /entry.sh
#!/bin/sh
while :; do echo "[task-@ID@] @TYP@ · $(date +%H:%M:%S)"; sleep 60; done
RUNSH
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
DOCKER_SPEC
    printf '\n  task-%s:\n    build: ./evolution/%s\n    restart: unless-stopped\n' "$TID" "$TID" >> "$COMPOSE"
    docker compose -f "$COMPOSE" up -d --build "task-$TID"
    log "zadanie $TID: typ=$TTYP · compose up"
    echo "- id: $TID · typ: $TTYP · $(date '+%F %T')" >> "$TD/tasks/done.yaml"
  fi
  SPAWNED=$((SPAWNED + 1))
  if [ "$SPAWNED" -ge "$LIMIT" ]; then log "limit $LIMIT osiągnięty → handover"; break; fi
done

# ——— handover: następca przejmuje controller ———
O="$EVO/orchestrator"; mkdir -p "$O"
cat > "$O/Dockerfile" <<'EOF'
# taskand · orkiestrator — następca nucleus v0.4
FROM docker:27-cli
COPY <<'OSH' /entry.sh
#!/bin/sh
set -eu
echo "[orchestrator] kontrola compose i pętli zadań przejęta"
while :; do docker compose -f /taskand/docker-compose.yaml ps || true; sleep 60; done
OSH
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
EOF
printf '\n  orchestrator:\n    build: ./evolution/orchestrator\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n      - ./docker-compose.yaml:/taskand/docker-compose.yaml\n      - ./tasks:/taskand/tasks\n      - ./evolution:/taskand/evolution\n      - ./log:/taskand/log\n    restart: unless-stopped\n' >> "$COMPOSE"
docker compose -f "$COMPOSE" up -d --build orchestrator
ROLE=handover
log "HANDOVER · controller → taskand-orchestrator · nucleus kończy"
NUC

RUN chmod +x /usr/local/bin/taskand-entry /usr/local/bin/onboarding /usr/local/bin/nucleus

# montarze (docker run -it / compose — patrz taskand.sh):
#   docker.sock → jedyne uprzywilejowane · projekt → compose/tasks/evolution/log/answers
ENTRYPOINT ["/usr/local/bin/taskand-entry"]
