# Local runtime recovery

`deploy.py` tworzy poza checkoutem digest-bound snapshot kodu, kwalifikuje
izolowany kontener canary, a następnie może przełączyć tylko `gateway` i
`landing`. Nie kopiuje wartości `.env`, `grants.yaml`, `vault` ani `log`; reuse
konfiguracji jest związany z obserwowanymi mountami kontenera. Oryginalne
kontenery pozostają zatrzymane, ale zachowane pod pierwotnymi nazwami, więc
rollback nie rekonstruuje sekretów ani warstw kontenera.

Najpierw utwórz snapshot dokładnego, scalonego SHA:

```bash
python3 infra/local-recovery/deploy.py stage \
  --repo . --source-sha "$(git rev-parse HEAD)" \
  --gateway-container glm53-gateway-recovery-009 \
  --landing-container glm53-landing-recovery-009 \
  --destination /home/tom/.local/state/taskand/audits/runtime-recovery/stage
```

Kwalifikacja canary nie dotyka działających portów:

```bash
python3 infra/local-recovery/deploy.py create \
  --destination /home/tom/.local/state/taskand/audits/runtime-recovery/stage \
  --suffix recovery-009-canary --port 18077 --canary
docker start glm53-gateway-recovery-009-canary
```

Po odczytowym sprawdzeniu canary utwórz osobny kontener docelowy na porcie 8077
(bez `--canary`). Przełączenie wymaga jawnego `switch`; rollback
zatrzymuje kandydatów i uruchamia zachowane kontenery:

```bash
python3 infra/local-recovery/deploy.py create \
  --destination /home/tom/.local/state/taskand/audits/runtime-recovery/stage \
  --suffix recovery-010
python3 infra/local-recovery/deploy.py switch \
  --destination /home/tom/.local/state/taskand/audits/runtime-recovery/stage \
  --suffix recovery-010
python3 infra/local-recovery/deploy.py rollback \
  --destination /home/tom/.local/state/taskand/audits/runtime-recovery/stage \
  --suffix recovery-010
```

`stage` zapisuje wyłącznie manifest hashy i metadane mountów; nie zapisuje
odpowiedzi HTTP ani wartości sekretów. `verify` sprawdza integralność snapshotu.

Nazwy poprzedników muszą wskazywać aktualnie działające kontenery; ich ID są
wiązane w manifeście i sprawdzane przed zmianą. Nie wybieraj starego zatrzymanego
kontenera tylko dlatego, że ma nazwę kończącą się na `-1`.
Gateway otrzymuje manifest read-only i jego SHA-256. `/healthz` zwraca `commit`
tylko po zgodności pinu oraz bajtów gateway i UI; `identityStatus` opisuje lokalną
integralność, nie podpis autora, stan danych ani zgodność całej federacji.
Sonda JSONL v2 zachowuje obserwowane `sourceSha` i osobne `expectedSourceSha`.

## Ograniczony snapshot kontekstu

`context_snapshot.py` rozwiązuje odmowę dostępu hostowego `cp` do bazy
utworzonej przez użytkownika kontenera. Snapshot używa `docker cp` z dokładnego
64-znakowego ID **zatrzymanego** gateway. Adapter nie zatrzymuje go sam.
Operator musi osobno zatrzymać wszystkich writerów współdzielących katalog;
sprawdzenie stanu jednego kontenera nie dowodzi braku innych writerów.

Baza zawiera kontekst człowieka i klucz integralności. Wymaga osobnej zgody na
backup tych danych oraz `--acknowledge-sensitive-data`. Tego potwierdzenia nie
wolno wyprowadzać z samej zgody na wdrożenie kodu. Nie publikuj bazy, nie
przenoś jej do Git ani nie myl hashy z szyfrowaniem. W tej zmianie testujemy
wyłącznie syntetyczne dane; produkcyjny backup nie jest wykonywany.

Przykład po uzyskaniu upoważnienia i zatrzymaniu writerów (ID i digest trzeba
zastąpić rzeczywistymi, wcześniej zaobserwowanymi wartościami):

```bash
python3 infra/local-recovery/context_snapshot.py snapshot \
  --container-id <exact-64-hex-container-id> \
  --destination /private/recovery/snapshot.sqlite3 \
  --acknowledge-sensitive-data
python3 infra/local-recovery/context_snapshot.py restore \
  --source /private/recovery/snapshot.sqlite3 --sha256 <observed-64-hex-digest> \
  --destination /private/recovery/new-context \
  --acknowledge-sensitive-data
```

Rodzic wyjścia musi już istnieć, należeć do operatora i nie być zapisywalny
przez grupę/innych. Snapshot powstaje jako plik 0600, odtworzony katalog jako
0700. Nowy `context.sqlite3` pojawia się dopiero po sprawdzeniu digestu i
SQLite `quick_check`; istniejący plik lub katalog nigdy nie jest zastępowany.
Błąd kopii nie daje receiptu sukcesu. `restore` zwraca wyłącznie `PREPARED`,
nigdy nie montuje katalogu, nie uruchamia kontenera i nie przełącza runtime.
Receipty stdout są lokalnym formatem adaptera, nie zarejestrowanym kontraktem
registry, podpisem autora ani zgodą na wykonanie.

Limit bazy: 64 MiB; każda komenda Docker: 30 s plus do 2 s na sprzątnięcie
procesu; weryfikacja SQLite ma budżet instrukcji kontrolowany czasem 5 s.
Obsługiwany jest wyłącznie czysty pojedynczy `context.sqlite3` obecnego Store.
WAL, journal, symlinki, dodatkowe pliki i nieznany schemat są odrzucane.
Nie usuwać sidecarów, aby obejść odmowę: przygotować osobny plan odzyskania
SQLite. Narzędzie nie wykonuje migracji, nie dowodzi kompletnego backupu
całego Taskand i nie chroni przed równoległym złośliwym procesem tego samego
użytkownika. Testowane środowisko: Linux, lokalny prywatny filesystem.
