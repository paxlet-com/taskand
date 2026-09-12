# Standard taskand v2.0 — Minimalny, auto-mnożący się system

> **taskand v2.0** to minimalistyczny, samo-replikujący się system organizmów, zredukowany do zaledwie **5 kluczowych plików**. Likwiduje zbędne warstwy pośredniczące i duplikacje kodu. Bootstrap (zygota) sprawdza dostępność klucza LLM (`TASKAND_LLM_API_KEY` z modelem GLM-5.3): jeśli jest dostępny — sztuczna inteligencja autonomicznie generuje procesy organizmów w locie; jeśli nie — system korzysta z wbudowanych, niezawodnych szablonów. Wszystko działa w architekturze peer-to-peer mesh i replikuje się na zdalne urządzenia przez SSH.

---

## Spis treści

1. [Filozofia redukcji: 5 plików zamiast bloatu](#1-filozofia)
2. [Likwidacja duplikacji i warstw pośredniczących](#2-redukcja-warstw)
3. [Architektura v2.0: Bootstrap (Zygota) → LLM → Organizmy](#3-architektura)
4. [5 kluczowych plików systemu](#4-pliki)
5. [Organizmy w genome.yaml](#5-organizmy)
6. [Gateway REST API i Web Cockpit](#6-gateway-web)
7. [Auto-mnożenie (Cross-device spawn przez SSH)](#7-automnozenie)
8. [CLI v2.0 — pełna referencja](#8-cli)
9. [Porównanie v1.6 vs v2.0](#9-porownanie)

---

<a id="1-filozofia"></a>
## 1 · Filozofia redukcji: 5 plików zamiast bloatu

Poprzednie iteracje systemu cierpiały na rozrost liczby plików i katalogów (ponad 270 katalogów, setki duplikatów w `proc/` oraz `packages/*/proc/`). Standard v2.0 drastycznie upraszcza repozytorium:

* **Zero wstępnych paczek (`packages/` w git)**: Wszystkie procesy są generowane w runtime do katalogu `generated/` przez bootstrap lub LLM.
* **Zero duplikacji**: Usunięto reliktowy katalog `proc/` z roota — jedyną lokalizacją procesów wykonywalnych jest `generated/`.
* **Zero skomplikowanych konfiguracji**: Całość mieści się w 5 plikach konfiguracyjnych i wykonawczych.

```
taskand/
├── Dockerfile              ← bootstrap (zygota) — generuje i testuje wszystko
├── docker-compose.yaml     ← gateway + landing + VM browser (digital twin)
├── .env                    ← TASKAND_LLM_API_KEY=... (jeden wspólny sekret)
├── bin/
│   └── taskand            ← CLI (1 plik, szybki, fail-closed)
└── genome.yaml             ← deklaracja organizmów do wygenerowania
```

---

<a id="2-redukcja-warstw"></a>
## 2 · Likwidacja duplikacji i warstw pośredniczących

W architekturze legacy między poleceniem użytkownika a wynikiem stało aż 7 warstw pośrednich:

```
[LEGACY v1.x]
user → CLI → gateway → chat → nucleus → supervisor → proc:// → bin.mjs → wynik
         ↑         ↑       ↑         ↑            ↑
         5 zbędnych warstw pośredniczących = 5 potencjalnych punktów awarii
```

Taskand v2.0 redukuje ten łańcuch do bezpośredniej ścieżki:

```
[TASKAND v2.0]
user → CLI ──────────────► bin.mjs ──────────────► wynik
        │                     ▲
        ▼                     │
     gateway ─────────────────┘
     (REST / LLM generuje kod w locie)
```

Jeżeli Gateway API jest offline, CLI wykonuje procesy bezpośrednio przez środowisko Node.js (tryb standalone), zapewniając nieprzerwaną odporność na awarie.

---

<a id="3-architektura"></a>
## 3 · Architektura v2.0: Bootstrap (Zygota) → LLM → Organizmy

Cykl życia systemu startuje od pojedynczego kontenera bootstrap:

```
user: docker compose up (lub taskand boot)
  │
  ▼
[BOOTSTRAP] (kontener z Dockerfile)
  │
  ├── 1. Sprawdź: czy TASKAND_LLM_API_KEY jest w .env?
  │
  ├── [TAK] → Ścieżka LLM (pełna autonomia GLM-5.3):
  │   ├── Generuj kod dla chat/message/v1
  │   ├── Generuj kod dla doctor/diagnose/v1
  │   ├── Generuj kod dla browser/session/v1
  │   ├── Testuj kontrakt każdego procesu (fail-closed: echo '{}' | node bin.mjs)
  │   └── Zapisz w generated/ i uruchom usługi
  │
  └── [NIE] → Ścieżka Szablonów (niezawodny fallback):
      ├── Użyj wbudowanych szablonów z Dockerfile
      ├── Przetestuj każdy proces (exit code 0)
      └── Przekaż kontrolę do Gateway API
```

---

<a id="4-pliki"></a>
## 4 · 5 kluczowych plików systemu

1. **`Dockerfile`**: Kontener bootstrap (zygota). Zawiera skrypt `/usr/local/bin/bootstrap`, wykrywa LLM i weryfikuje procesy.
2. **`docker-compose.yaml`**: Definiuje usługi bootstrap, REST gateway (:8077), landing Web Cockpit (:8090) oraz Digital Twin `vm-browser` (:3010).
3. **`gateway.py`**: Pojedynczy serwer HTTP REST w Pythonie udostępniający `/healthz`, `/api/federation`, `/api/proc/call` oraz `/api/chat`.
4. **`bin/taskand`**: Uniwersalny skrypt CLI w Shellu z automatycznym routingiem do Gateway lub bezpośrednim uruchamianiem lokalnym.
5. **`genome.yaml`**: Zwięzły manifest definiujący listę organizmów i procesów `proc://`.

Dodatkowe komponenty:
* `.env`: Zmienne środowiskowe `TASKAND_LLM_API_KEY` oraz `TASKAND_LLM_MODEL=glm-5.3`.
* `index.html`: Czysty Web Cockpit dla przeglądarki z dynamicznym czatem do Gateway API.

---

<a id="5-organizmy"></a>
## 5 · Organizmy w genome.yaml

| Organizm | Proces URI | Rola i odpowiedzialność |
|---|---|---|
| **chat** | `proc://taskand.dev/chat/message/v1` | Naturalna konwersacja, routing intencji do innych organizmów |
| **doctor** | `proc://taskand.dev/doctor/diagnose/v1` | Diagnostyka zdrowia bramki, www, bazy i rejestru procesów |
| **developer** | `proc://taskand.dev/developer/spawn/v1` | Ewolucja, powoływanie potomków i generowanie kodu przez LLM |
| **browser** | `proc://taskand.dev/browser/session/v1` | Sterowanie zdalną przeglądarką Chromium przez noVNC i zrzuty ekranu |
| **vault** | `proc://taskand.dev/vault/secrets/v1` | Przechowywanie kluczy i szyfrowanie AES-256-GCM |
| **file-ops** | `proc://taskand.dev/file/ops/v1` | Zarządzanie plikami na węzłach stacji i workerach (RPi5/VM) |
| **hw-monitor**| `proc://taskand.dev/hw/monitor/v1` | Telemetria temperatury procesora, użycia dysku i pinów GPIO |

---

<a id="6-gateway-web"></a>
## 6 · Gateway REST API i Web Cockpit

Serwer `gateway.py` udostępnia:

* `GET /healthz` — Stan zdrowia, liczba procesów w `generated/`, status podłączenia modelu LLM.
* `GET /api/federation` — Lista wszystkich wersjonowanych procesów URI.
* `POST /api/proc/call` — Wykonanie wskazanego URI z przekazaniem payloadu JSON na stdin procesu `bin.mjs`.
* `POST /api/chat` — Inteligentny dispatcher: zapytania techniczne deleguje do modelu GLM-5.3 lub wywołuje dedykowane procesy organizmów.
* Zdarzenia są asynchronicznie zapisywane do formatu append-only: `log/events.jsonl`.

Web Cockpit (`http://localhost:8090`) to lekki interfejs z natychmiastowym polem promptu i skrótami klawiszowymi do diagnostyki i ewolucji.

---

<a id="7-automnozenie"></a>
## 7 · Auto-mnożenie (Cross-device spawn przez SSH)

Do powołania nowego węzła w sieci (np. Raspberry Pi 5 lub serwer w chmurze) wystarczy przesłanie 5 plików bazowych:

```bash
taskand boot rpi5@192.168.1.50
```

1. **SSH transfer**: Kopiowanie `Dockerfile`, `docker-compose.yaml`, `.env`, `genome.yaml` oraz `bin/taskand`.
2. **Remote bootstrap**: Uruchomienie `docker compose up -d` na maszynie docelowej.
3. **Powołanie lokalnych organizmów**: Bootstrap na workerze generuje procesy i rejestruje węzeł w federacji.
4. **Transparentny dostęp**: Polecenia `taskand browser` czy `taskand file` mogą adresować urządzenie docelowe za pomocą parametru `--device rpi5`.

---

<a id="8-cli"></a>
## 8 · CLI v2.0 — pełna referencja

```bash
# Rozmowa z organizmami
taskand dev "stwórz proces liczący słowa"   # Deweloper (LLM GLM-5.3)
taskand doc "sprawdź stan usług"            # Strażnik zdrowia (Doctor)
taskand sec "status"                        # Bezpieczeństwo i Sejf (Vault)
taskand browser "otwórz https://example.com"# Sesja noVNC
taskand file "pokaż pliki"                  # Operacje na plikach węzła
taskand hw "stan"                           # Telemetria sprzętu i GPIO

# Zarządzanie i inspekcja
taskand status                              # Stan Gateway API i podłączonego LLM
taskand fed                                 # Lista 9 procesów w federacji
taskand proc proc://taskand.dev/chat/message/v1 '{"message": "test"}' # Wywołanie procesu URI
taskand log 20                              # Ostatnie 20 zdarzeń z events.jsonl
taskand boot worker@192.168.1.50            # Replikacja systemu na nowe urządzenie
```

---

<a id="9-porownanie"></a>
## 9 · Porównanie v1.6 vs v2.0

| Aspekt | Standard v1.6 | Standard v2.0 |
|---|---|---|
| **Liczba plików w repozytorium** | 179 | **7** (5 bazowych + gateway + index) |
| **Katalogi w repozytorium** | 277 | **3** (`bin/`, `log/`, `generated/`) |
| **Pakiety w repozytorium** | 10 preinstalowanych paczek | **0** (generowane w runtime) |
| **Linie kodu infrastruktury** | ~5000+ | **~450** |
| **Warstwy pośredniczące** | 7 poziomów (nucleus, supervisor itp.) | **1 poziom** (CLI / Gateway → bin.mjs) |
| **Czas rozruchu od zera** | ~30 minut | **< 10 sekund** |
| **Duplikacja `proc/`** | TAK (root + pakiety) | **NIE (tylko generated/)** |
| **Rola LLM** | Zewnętrzny asystent | **Bootstrap pyta i generuje wszystko w locie** |
| **Replikacja multi-device** | Złożone skrypty instalacyjne | **Kopiowanie 5 plików przez SSH i docker up** |

