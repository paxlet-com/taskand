# Standard taskand v1.6 — Multi-Device + Digital Twin + noVNC

> Bootstrap na stacji roboczej powołuje bootstrapy na RPi5, serwerach i wirtualnych maszynach. Przez nie kontroluje sprzęt, usługi, pliki i przeglądarki (noVNC). Historia zdarzeń i rollback dostępne z dowolnego węzła. Komunikacja równoległa (mesh). Testy na digital twin zanim cokolwiek trafi na prawdziwy sprzęt.

---

## Spis treści

**Część I — Fundament multi-device**
1. [Zasady nadrzędne (18 reguł)](#cz-i--1)
2. [Architektura: master ↔ worker ↔ VM](#cz-i--2)
3. [Genom multi-device (genome.yaml z hostami)](#cz-i--3)
4. [Cross-bootstrap: powoływanie na zdalnych urządzeniach](#cz-i--4)

**Część II — Zasoby zdalne**
5. [Browser/noVNC: zdalna przeglądarka](#cz-ii--5)
6. [File-ops: dostęp do plików na urządzeniu](#cz-ii--6)
7. [Hardware-monitor: GPIO, CPU, temperatura](#cz-ii--7)
8. [Cross-device event log + rollback](#cz-ii--8)

**Część III — Digital Twin**
9. [Wirtualne maszyny w Docker Compose](#cz-iii--9)
10. [Test-first: symulacja przed wdrożeniem](#cz-iii--10)

**Część IV — Operacje**
11. [Pełny scenariusz: user → RPi5 → noVNC → screenshot](#cz-iv--11)
12. [CLI multi-device](#cz-iv--12)
13. [Struktura plików + konformacja (14 punktów)](#cz-iv--13)

**Część V — Pliki do pobrania**
14. [docker-compose.yaml, bin.mjs, spawn-remote.sh, Dockerfile](#cz-v--14)

---

<a id="cz-i--1"></a>
## Cz. I · 1 · Zasady nadrzędne (18)

| # | Zasada |
|---|--------|
| 1 | URI = tożsamość, nie adres |
| 2 | Ewolucja = nowa wersja (commit + tag, immutable) |
| 3 | Brak wiedzy blokuje strategię |
| 4 | Wykonanie ≠ wersjonowanie |
| 5 | Zero importów między paczkami |
| 6 | Sekrety w vault (purpose-scoped, runtime-only) |
| 7 | Dane = artefakty URI (CAS) |
| 8 | Porażka = poprawny wynik (3 próby → raport) |
| 9 | Samomodyfikacja = DENY |
| 10 | Audyt przez historię git |
| 11 | Każda paczka = potencjalny registry |
| 12 | Dozbrajanie bez przestoju |
| 13 | Supervisor routuje, organizmy pracują |
| 14 | Każdy organizm może spawnować (peer-to-peer) |
| 15 | Genom w git = DNA systemu |
| 16 | **Multi-device: bootstrap ↔ bootstrap (mesh, nie hierarchia)** |
| 17 | **Digital twin first: testuj na VM zanim wdrożysz na sprzęt** |
| 18 | **Cross-device log: historia z wszystkich węzłów z dowolnego punktu** |

---

<a id="cz-i--2"></a>
## Cz. I · 2 · Architektura

```
                    ┌──────────────────────────┐
                    │  GITEA (genome + registry)│
                    │  gitea:3000              │
                    └───────────┬──────────────┘
                                │ clone/push
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌────────▼─────────┐  ┌────────▼─────────┐  ┌────────▼─────────┐
│  MASTER           │  │  WORKER          │  │  VM-TEST         │
│  (stacja robocza) │  │  (RPi5 Fedora)  │  │  (digital twin)  │
│  192.168.1.10     │  │  192.168.1.50   │  │  localhost:3010  │
│                   │  │                  │  │                  │
│  bootstrap-master │  │  bootstrap-worker│  │  bootstrap-test  │
│  ├── nucleus     │  │  ├── nucleus     │  │  ├── nucleus     │
│  ├── supervisor  │  │  ├── developer   │  │  ├── developer   │
│  ├── developer   │  │  ├── browser     │  │  ├── browser     │
│  ├── doctor      │  │  │   (noVNC)    │  │  │   (noVNC)    │
│  ├── chat        │  │  ├── file-ops   │  │  └── ...         │
│  ├── web         │  │  ├── hw-monitor  │  │                  │
│  └── vault       │  │  └── spawn ✓    │  │  (testy przed   │
│                  │  │                  │  │   wdrożeniem!)   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │   FEDERACJA (mesh)    │
                    │   cross-device        │
                    │   równoległa          │
                    └──────────────────────┘
```

### Kluczowe różnice vs v1.5

| v1.5 | v1.6 |
|------|------|
| federacja w 1 sieci Docker | federacja **cross-device** (master ↔ worker ↔ VM) |
| wszystkie organizmy na 1 hoście | organizmy **rozproszone** na wielu urządzeniach |
| brak zdalnej przeglądarki | **browser/noVNC** na worker (RPi5) |
| brak dostępu do plików | **file-ops** na worker |
| log lokalny | **cross-device log** (merge z wszystkich węzłów) |
| brak VM testowych | **wirtualne maszyny** w Docker (digital twin) |
| bootstrap tylko lokalnie | **cross-bootstrap** (SSH → install → start worker) |

---

<a id="cz-i--3"></a>
## Cz. I · 3 · Genom multi-device

```yaml
# genome.yaml — z hostami i urządzeniami
apiVersion: taskand.dev/v1
kind: Genome
meta:
  name: taskand-multi-device
  version: "1.6.0"
  registry: "gitea:3000/taskand/registry.git"

devices:                       # ← NOWE: fizyczne urządzenia
  - name: workstation
    host: 192.168.1.10
    role: master
    ssh: taskand@192.168.1.10
    capabilities: [docker, node, git, gitea]

  - name: rpi5
    host: 192.168.1.50
    role: worker
    ssh: taskand@192.168.1.50
    os: fedora
    capabilities: [docker, node, browser, gpio, filesystem]
    noVNC: "http://rpi5:3000"          # ← browser przez noVNC

  - name: vm-test
    host: localhost
    role: test
    docker: true
    capabilities: [browser, filesystem, simulate-gpio]
    noVNC: "http://vm-browser:3000"    # ← digital twin browser

organisms:
  - name: nucleus
    device: workstation               # ← na jakim urządzeniu
    role: controller
    template: organism-core
    whoCanSpawn: [bootstrap-master]

  - name: browser
    device: rpi5                      # ← NA RPi5!
    role: interface
    template: organism-browser
    noVNC: "http://rpi5:3000"
    whoCanSpawn: [bootstrap-worker, developer]
    capabilities: [navigate, screenshot, interact]

  - name: file-ops
    device: rpi5
    role: worker
    template: organism-file-ops
    whoCanSpawn: [bootstrap-worker, developer]
    capabilities: [read, write, list, search]

  - name: hw-monitor
    device: rpi5
    role: worker
    template: organism-hw-monitor
    whoCanSpawn: [bootstrap-worker]
    capabilities: [gpio, cpu-temp, memory, disk]

  - name: browser-test              # ← digital twin
    device: vm-test
    role: interface
    template: organism-browser
    noVNC: "http://vm-browser:3000"
    condition: test-only              # ← tylko do testów!
    whoCanSpawn: [bootstrap-test]
```

---

<a id="cz-i--4"></a>
## Cz. I · 4 · Cross-bootstrap

```bash
# NA STACJI ROBOCZEJ (master):
# Powołaj bootstrap-worker na RPi5:
taskand boot "spawn worker on rpi5@192.168.1.50"

# Co się dzieje:
# 1. master sprawdza genome.yaml → devices[rpi5].ssh
# 2. SSH do rpi5 (grant: bootstrap-to-bootstrap)
# 3. Instaluje Docker jeśli brak (curl get.docker.com | sh)
# 4. Kopiuje taskand na rpi5 (/opt/taskand)
# 5. Uruchamia docker compose up -d na rpi5
# 6. Worker startuje, odkrywa lokalne zasoby (GPIO, files, browser)
# 7. Genome aktualizowany (git push → gitea)
# 8. Federacja: master ↔ worker (równoległa komunikacja)

# Powołaj na wirtualnej maszynie (test):
taskand boot "spawn worker on vm-test@localhost:3010"
# (identyczny proces, ale cel = kontener Docker zamiast fizycznego RPi5)
```

---

<a id="cz-ii--5"></a>
## Cz. II · 5 · Browser/noVNC

### Proces

```yaml
# proc://taskand.dev/browser/session/v1
uri: proc://taskand.dev/browser/session/v1
device: rpi5 (lub vm-test dla digital twin)
interface:
  stdin: { action: "open|screenshot|interact|close", url?, waitMs? }
  stdout: { opened?, screenshot? (artifact URI), status }
  exit: { 0: ok, 1: fail-closed, 2: kontrakt }
binding:
  runtime: docker
  image: linuxserver/firefox:latest   # Firefox + noVNC
  ports: [3000:3000]                  # noVNC web UI
  shm: 2gb
  capabilities:
    - navigate: open URL in Firefox
    - screenshot: capture full page → CAS artifact
    - interact: click, type (przez VNC protocol)
    - close: close browser session
grants: { run: [browser-use] }
```

### Przykłady wywołań

```bash
# Otwórz stronę
printf '{"action":"open","url":"https://example.com","waitMs":3000}' | \
  curl -X POST :8077/api/proc/call \
    -d '{"uri":"proc://taskand.dev/browser/session/v1"}'
# → {"opened":"https://example.com","status":"loaded"}

# Zrób screenshot
printf '{"action":"screenshot"}' | \
  curl -X POST :8077/api/proc/call \
    -d '{"uri":"proc://taskand.dev/browser/session/v1"}'
# → {"screenshot":"artifact:screenshot-…@sha256:…","bytes":245760}

# Przez CLI (naturalny język):
taskand browser "otwórz https://example.com na rpi5 i zrób zrzut ekranu"
```

---

<a id="cz-ii--6"></a>
## Cz. II · 6 · File-ops

```bash
# Pliki na RPi5:
taskand file "pokaż pliki /home/taskand/*.log" --device rpi5
# → [/home/taskand/app.log, /home/taskand/error.log]

taskand file "przeczytaj /home/taskand/app.log ostatnie 50 linii" --device rpi5
# → [treść pliku]

taskand file "zapisz /tmp/test.txt 'Hello from taskand'" --device rpi5
# → zapisano (snapshot przed → artifact CAS)
```

---

<a id="cz-ii--7"></a>
## Cz. II · 7 · Hardware-monitor

```bash
# GPIO i temperatura na RPi5:
taskand hw "temperatura CPU" --device rpi5
# → {"cpu_temp": 42.5}

taskand hw "GPIO 17 stan" --device rpi5
# → {"gpio17": "input", "value": 1}

taskand hw "wolne miejsce na dysku" --device rpi5
# → {"disk_free_gb": 24.3}
```

---

<a id="cz-ii--8"></a>
## Cz. II · 8 · Cross-device event log + rollback

```bash
# Historia z WSZYSTKICH węzłów (z dowolnego punktu):
taskand log --cross-device
# → zdarzenia z master + rpi5 + vm-test (merge, sortowane czasowo)

# Rollback z dowolnego węzła:
taskand rollback --device rpi5 --to "14:23:04"
# → przywróć stan RPi5 do 14:23:04 (snapshot CAS)

# Cross-device audit:
taskand audit --all-devices
# → zdarzenia + granty + artefakty z wszystkich węzłów
```

---

<a id="cz-iii--9"></a>
## Cz. III · 9 · Wirtualne maszyny w Docker Compose

### Pełny docker-compose.yaml

```yaml
version: "3.9"

services:
  # ── GITEA (genome registry) ──
  gitea:
    image: gitea/gitea:1.22
    ports: ["3000:3000", "2222:22"]
    volumes: [./gitea-data:/data]
    restart: unless-stopped

  # ── MASTER (stacja robocza) ──
  nucleus:
    build: ./core
    volumes:
      - ./registry:/taskand/registry
      - /var/run/docker.sock:/var/run/docker.sock
      - ./log:/taskand/log
    ports: ["8079:8079", "8077:8077"]
    environment:
      - TASKAND_ROLE=master
      - TASKAND_DEVICES=rpi5:192.168.1.50,vm-test:localhost
    restart: unless-stopped

  landing:
    image: nginx:alpine
    volumes: [./landing:/usr/share/nginx/html]
    ports: ["8090:80"]
    restart: unless-stopped

  # ── VM BROWSER (digital twin RPi5) ──
  vm-browser:
    image: linuxserver/firefox:latest
    container_name: taskand-vm-browser
    environment: [TZ=Europe/Warsaw]
    ports: ["3010:3000"]               # noVNC web
    volumes: [./vm-browser-data:/config]
    shm_size: "2gb"
    restart: unless-stopped
    labels:
      org.taskand.urn: "urn:taskand:vm:browser"
      org.taskand.device: "vm-test"

  # ── VM DESKTOP (full Xfce) ──
  vm-desktop:
    image: dorowu/ubuntu-desktop-lxde-vnc
    container_name: taskand-vm-desktop
    ports: ["3020:80"]                 # noVNC web (desktop)
    volumes: [./vm-desktop-data:/home/ubuntu]
    privileged: true                    # GPIO simulation
    restart: unless-stopped
    labels:
      org.taskand.urn: "urn:taskand:vm:desktop"
      org.taskand.device: "vm-desktop"

  # ── VM FEDORA (SSH, symulacja RPi5) ──
  vm-fedora:
    build: ./vms/fedora-minimal
    container_name: taskand-vm-fedora
    ports: ["3022:22"]                 # SSH
    volumes: [./vm-fedora-data:/home/taskand]
    restart: unless-stopped
    labels:
      org.taskand.urn: "urn:taskand:vm:fedora"
      org.taskand.device: "vm-fedora"
```

### Jak używać VM do testów

```bash
# 1 · Uruchom VM (digital twin):
docker compose up -d vm-browser vm-fedora

# 2 · Spawnuj bootstrap-test na VM:
taskand boot "spawn worker on vm-test@localhost:3010"

# 3 · Testuj na VM (identyczne jak na prawdziwym RPi5):
taskand browser "otwórz example.com" --device vm-test
taskand file "pokaż /home/taskand" --device vm-fedora
taskand hw "temperatura" --device vm-fedora

# 4 · Gdy testy przechodzą → wdróż na prawdziwy RPi5:
taskand boot "spawn worker on rpi5@192.168.1.50"

# 5 · To samo zadanie, ale na prawdziwym sprzęcie:
taskand browser "otwórz example.com" --device rpi5
# → identyczne wywołanie, identyczny wynik
```

---

<a id="cz-iii--10"></a>
## Cz. III · 10 · Test-first workflow

```
1. VM-TEST: taskand boot "spawn on vm-test"
2. VM-TEST: taskand browser "open example.com" --device vm-test
3. VM-TEST: testy przeszły? ✓
4. PRODUCTION: taskand boot "spawn on rpi5@192.168.1.50"
5. PRODUCTION: taskand browser "open example.com" --device rpi5
   → (identyczne wywołanie — proc:// nie wie czy to VM czy RPi5!)
```

---

<a id="cz-iv--11"></a>
## Cz. IV · 11 · Pełny scenariusz

```
user@workstation: taskand browser "otwórz https://example.com na RPi5 i prześlij zrzut ekranu"

[master]  chat: intent=remote-browse-screenshot, target=rpi5
[master]  nucleus: browser → rpi5-worker (cross-device)
[master]  cross-bootstrap: SSH → rpi5@192.168.1.50 (grant ✓)
[worker]  rpi5-bootstrap: odbieram zadanie
[worker]  browser/noVNC: session://browser/rpi5-8f3a
[worker]  noVNC: open https://example.com → loaded (1256 B)
[worker]  browser: screenshot → scrot → 245 KB PNG
[worker]  CAS: artifact:screenshot-8f3a@sha256:9f3c… ✓
[worker]  CAS: replikuj na master (4/4 chunks ✓)
[master]  user: screenshot gotowy!
[master]  → curl :8079/cas/sha256:9f3c… > screenshot.png
[master]  → taskand log --cross-device (pełna historia)
```

---

<a id="cz-iv--12"></a>
## Cz. IV · 12 · CLI multi-device

```bash
# ── URZĄDZENIA ──
taskand devices                    # lista urządzeń
taskand devices --health           # health-check wszystkich
taskand boot "spawn on rpi5@…"   # powołaj worker na urządzeniu
taskand boot "spawn on vm-test"  # powołaj na VM (digital twin)

# ── ZASOBY ZDALNE ──
taskand browser "otwórz …" --device rpi5
taskand file "pokaż …" --device rpi5
taskand hw "temperatura" --device rpi5

# ── HISTORIA ──
taskand log --cross-device         # zdarzenia z wszystkich węzłów
taskand rollback --device rpi5 --to "14:23"
taskand audit --all-devices       # pełny audyt

# ── VM TESTY ──
taskand browser "otwórz …" --device vm-test
# (identyczne wywołanie, ale na wirtualnej maszynie)
```

---

<a id="cz-iv--13"></a>
## Cz. IV · 13 · Konformacja (14 punktów)

| # | Wymaganie | Weryfikacja |
|---|-----------|-------------|
| 1 | capsule.yaml | `make conformance` |
| 2 | ≥1 proces bin.mjs | `make test` |
| 3 | URI = ścieżka | `make verify` |
| 4 | Makefile standard | `make help` |
| 5 | proc-catalog.json SHA-256 | `make verify` |
| 6 | grants.yaml | `make conformance` |
| 7 | Testy kontraktu | `make test` |
| 8 | Git z tagami | `git log` |
| 9 | Ewolucja: delegated-to dev | `make conformance` |
| 10 | Federacja: registry/serve | `curl :8077/api/federation` |
| 11 | Spawn: peer-to-peer | `taskand fed --can-spawn` |
| 12 | Konwersacja: chat/v1 | `taskand dev "test"` |
| 13 | **Multi-device: devices w genome** | `taskand devices` |
| 14 | **Digital twin: VM w compose** | `docker compose ps vm-*` |

---

<a id="cz-v--14"></a>
## Cz. V · 14 · Pliki do pobrania

<details>
<summary>docker-compose.yaml (multi-device + VM)</summary>

```yaml
version: "3.9"

services:
  gitea:
    image: gitea/gitea:1.22
    ports: ["3000:3000", "2222:22"]
    volumes: [./gitea-data:/data]
    restart: unless-stopped

  nucleus:
    build: ./core
    volumes:
      - ./registry:/taskand/registry
      - /var/run/docker.sock:/var/run/docker.sock
      - ./log:/taskand/log
    ports: ["8079:8079", "8077:8077"]
    environment:
      - TASKAND_ROLE=master
      - TASKAND_DEVICES=rpi5:192.168.1.50,vm-test:localhost
    restart: unless-stopped

  landing:
    image: nginx:alpine
    volumes: [./landing:/usr/share/nginx/html]
    ports: ["8090:80"]
    restart: unless-stopped

  vm-browser:
    image: linuxserver/firefox:latest
    container_name: taskand-vm-browser
    environment: [TZ=Europe/Warsaw]
    ports: ["3010:3000"]
    volumes: [./vm-browser-data:/config]
    shm_size: "2gb"
    restart: unless-stopped
    labels:
      org.taskand.urn: "urn:taskand:vm:browser"
      org.taskand.device: "vm-test"

  vm-desktop:
    image: dorowu/ubuntu-desktop-lxde-vnc
    container_name: taskand-vm-desktop
    ports: ["3020:80"]
    volumes: [./vm-desktop-data:/home/ubuntu]
    privileged: true
    restart: unless-stopped
    labels:
      org.taskand.urn: "urn:taskand:vm:desktop"
      org.taskand.device: "vm-desktop"

  vm-fedora:
    build: ./vms/fedora-minimal
    container_name: taskand-vm-fedora
    ports: ["3022:22"]
    volumes: [./vm-fedora-data:/home/taskand]
    restart: unless-stopped
    labels:
      org.taskand.urn: "urn:taskand:vm:fedora"
      org.taskand.device: "vm-fedora"
```
</details>

<details>
<summary>proc/browser/session/bin.mjs (noVNC browser)</summary>

```javascript
#!/usr/bin/env node
// proc://taskand.dev/browser/session/v1 — zdalna przeglądarka noVNC
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(2); }
if (!input.action) process.exit(2);

const VNC = process.env.VNC_URL || 'http://vm-browser:3000';
const SHOTS = '/tmp/taskand-screenshots';

try {
  if (input.action === 'open') {
    execSync(`curl -s ${VNC}/?url=${encodeURIComponent(input.url)}`, {stdio:'pipe'});
    await new Promise(r => setTimeout(r, input.waitMs || 3000));
    process.stdout.write(JSON.stringify({opened: input.url, vnc: VNC, status: 'loaded'}, null, 2));
    process.exit(0);
  }
  if (input.action === 'screenshot') {
    mkdirSync(SHOTS, {recursive: true});
    const file = SHOTS + '/shot-' + Date.now() + '.png';
    execSync(`docker exec taskand-vm-browser scrot ${file}`, {stdio:'pipe'});
    const data = readFileSync(file);
    const hash = createHash('sha256').update(data).digest('hex').slice(0,12);
    process.stdout.write(JSON.stringify({screenshot: `artifact:shot-${hash}@sha256:${hash}…`, bytes: data.length, local: file}, null, 2));
    process.exit(0);
  }
  if (input.action === 'close') {
    execSync(`curl -s ${VNC}/close`, {stdio:'pipe'});
    process.stdout.write(JSON.stringify({closed: true}));
    process.exit(0);
  }
  process.exit(2);
} catch (e) {
  process.stderr.write('browser: ' + e.message + '\n');
  process.exit(1);
}
```
</details>

<details>
<summary>proc/bootstrap/spawn-remote.sh (cross-device)</summary>

```bash
#!/bin/sh
set -eu
REMOTE="${1:?host: rpi5@192.168.1.50}"
DIR="/opt/taskand"
SSH="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

echo "[cross-bootstrap] test: ${REMOTE}"
ssh $SSH "$REMOTE" "echo ok" || exit 1

ssh $SSH "$REMOTE" "docker --version" || {
  ssh $SSH "$REMOTE" "curl -fsSL https://get.docker.com | sh"
}

ssh $SSH "$REMOTE" "mkdir -p ${DIR}"
scp -r ./docker-compose.yaml ./core ./scripts "${REMOTE}:${DIR}/"
scp registry/genome.yaml "${REMOTE}:${DIR}/registry/genome.yaml"

ssh $SSH "$REMOTE" "cd ${DIR} && docker compose up -d --build"

sleep 10
HEALTH=$(ssh $SSH "$REMOTE" "curl -sf :8079/healthz" 2>/dev/null || echo fail)
[ "$HEALTH" = "fail" ] && { echo "FAIL"; exit 1; }

HOST=$(ssh $SSH "$REMOTE" "hostname")
IP=$(ssh $SSH "$REMOTE" "hostname -I | awk '{print \$1}'")
echo "[cross-bootstrap] ✓ worker ${HOST} (${IP}) żyje!"
```
</details>

<details>
<summary>vms/fedora-minimal/Dockerfile</summary>

```dockerfile
FROM fedora:40
RUN dnf install -y openssh-server docker-cli nodejs git curl make procps-ng && dnf clean all
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh && ssh-keygen -A
RUN useradd -m -s /bin/bash taskand && mkdir -p /home/taskand/.ssh
COPY ./authorized_keys /home/taskand/.ssh/
RUN chmod 600 /home/taskand/.ssh/authorized_keys && chown -R taskand:taskand /home/taskand
RUN mkdir -p /opt/taskand && chown taskand:taskand /opt/taskand
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
```
</details>

---

## Aneks — Szybki start multi-device

```bash
# 1 · Stacja robocza
git clone <taskand> && cd taskand
make setup

# 2 · Test na wirtualnej maszynie (digital twin)
docker compose up -d vm-browser vm-fedora
taskand boot "spawn worker on vm-test@localhost"
taskand browser "otwórz example.com" --device vm-test
# → działa na VM ✓

# 3 · Wdrożenie na prawdziwym RPi5
taskand boot "spawn worker on rpi5@192.168.1.50"
taskand browser "otwórz example.com" --device rpi5
# → identyczne wywołanie, ale na RPi5 ✓

# 4 · Zrzut ekranu z RPi5
taskand browser "otwórz https://example.com na rpi5 i prześlij zrzut ekranu"
# → artifact:screenshot-…@sha256:…

# 5 · Historia z wszystkich węzłów
taskand log --cross-device
```

---

> **taskand v1.6** — multi-device: master ↔ worker (RPi5/Fedora) ↔ VM (digital twin) · browser przez noVNC · pliki na zdalnym urządzeniu · cross-device log + rollback · równoległa komunikacja (mesh) · test-first (VM → production) · wszystko przez URI proc:// + JSON stdin → stdout.
