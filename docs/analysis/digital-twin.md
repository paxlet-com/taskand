---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "digital-twin",
  "kind": "analysis",
  "version": 2,
  "title": "Cyfrowy bliźniak sieci, urządzeń oraz stron i API w taskand",
  "status": "draft",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-13",
  "updated": "2026-09-13",
  "review_after": "2026-09-20",
  "source_revision": "3e195de57d77426021e537dcd3243d41899529ad",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "generated/twin/environment/taskand.dev/v1/bin.mjs",
    "generated/twin/environment/taskand.dev/v1/runtime.mjs",
    "generated/admin/network-device-discovery/taskand.dev/v4/bin.mjs",
    "generated/registry/core/taskand.dev/v1/select.mjs",
    "tests/digital_twin.test.mjs",
    "examples/network-scan-task.mjs",
    "local-receipt:twin-f6a6b416-71d4-4553-9aea-c9e7f6d98b68",
    "generated/browser/web-model/taskand.dev/v1/bin.mjs",
    "generated/browser/web-model/taskand.dev/v1/transport.mjs",
    "generated/browser/web-model/taskand.dev/v1/cdp.mjs",
    "generated/twin/web/taskand.dev/v1/bin.mjs",
    "tests/web_twin.test.mjs",
    "examples/web-twin-task.mjs",
    "local-receipt:webmodel-0e17d909-2a44-4de8-9947-cf557ded800c",
    "local-receipt:webmodel-951da3fc-00dd-4a6c-959a-f3687519f175"
  ]
}
---

# Cyfrowy bliźniak sieci, urządzeń oraz stron i API w taskand

<!-- docs:section question -->
## Pytania i stan realizacji

Czy zadanie skanowania tworzy środowisko testowe z rzeczywistą adresacją lokalną,
czy ponownie używa zarejestrowanych URI i jak rozszerzyć je o modele urządzeń?

Adresację zaimplementowano i sprawdzono w dwóch rzeczywistych zadaniach. Modele
usług i zachowania poszczególnych urządzeń opisane niżej są projektem rozszerzenia,
nie wdrożoną funkcją. `fullInfrastructure: false` jest celowym wynikiem obecnego
procesu. Rozszerzenie web jest już zaimplementowane: migawki publicznych stron,
odtwarzanie scenariuszy offline oraz jawne, syntetyczne odpowiedzi API. Nie jest
to kopia backendów GitHuba ani Pleska. Dokument ma status draft ze względu na
niezrealizowane modele urządzeń i ograniczoną wierność warstwy usług.

<!-- docs:section scope -->
## Zakres

Właściciel: `semcod/taskand-glm53`; kanoniczny raport: ten plik. Wskazana rewizja
jest bazą lokalnego rozszerzenia web i testów; część sieciowa była badana na bazie
`77e5c232d344f956e4c72d5cd74c2bb50fd7d33b`. W trakcie sesji równoległe operacje Git
przesuwały HEAD; nie przypisujemy sobie tych commitów. Publikacji PR ani merge
nie weryfikowano. BindingHash poniżej identyfikują faktycznie testowane pakiety,
również z lokalnymi zmianami ponad wskazaną bazę. Dokument jest śledzony w Git.

Odtwarzana jest adresacja wszystkich lokalnych interfejsów hosta Linux: fizycznych,
Docker, libvirt, CNI, IPv4 i IPv6, łącznie z loopback oraz adresami link-local.
To widok dostępny z tego hosta, nie dowód wykrycia każdej podsieci za routerem.
Zakres CIDR nie jest tym samym co pula dzierżaw DHCP. Brak konfiguracji DHCP
pozostaje jawnie oznaczony jako niewiedza.

<!-- docs:section method -->
## Metoda i wykonanie zadania

1. `registry/core` odczytuje cały katalog organizmów. Akcja `select` wybiera
   najwyższą aktywną wersję nazwanej zdolności i weryfikuje bindingHash.
2. `admin/network-device-discovery/v4` zbiera adresy, trasy i sąsiadów przez
   `ip -j`. Oblicza pełne zakresy IPv4/IPv6 z użyciem BigInt. W trybie `scan`
   wykonuje ograniczony skan IPv4 LAN przez Nmap; nie obcina po cichu dużych zakresów.
3. `twin/environment/v1` zapisuje katalog, topologię, wynik skanu, telemetrię
   lokalnego `hw/monitor` oraz dostępny katalog sieci Docker z IPAM i adresami kontenerów.
4. Tworzy osobne przestrzenie user/network/PID przez `unshare`, odtwarza nazwy
   interfejsów i ich adresy jako interfejsy dummy, emuluje znane adresy urządzeń.
5. Ten sam skaner URI i bindingHash odczytuje rzeczywistą adresację w tej
   przestrzeni i ponownie wykonuje skan. Porównanie obejmuje pełne zbiory nazw,
   adresów z prefiksami, podsieci i granic zakresów, a nie samą ich liczność.
6. Po wykonaniu sprawdzana jest niezmienność adresacji źródła. Migawka i wyniki
   zostają w `log/twins/<id>/`; przestrzeń sieciowa kończy życie razem z zadaniem.
   `status` odczytuje receipt zakończonego zadania, nie zgłasza aktywnego runtime.

Izolacja sieci pozwala powtórzyć adresy bez przyłączania ich do produkcyjnego LAN;
właściwości tej izolacji opisuje dokumentacja [Linux network namespaces](https://man7.org/linux/man-pages/man7/network_namespaces.7.html).
Obecny runtime nie stanowi izolacji systemu plików dla dowolnego, niezaufanego kodu.
Uruchamia wyłącznie skaner z zaakceptowanej rodziny URI i zweryfikowanym hashem.

Polecenia działające obecnie, uruchamiane na hoście Linux z Node 20+, iproute2,
util-linux (`unshare`), Nmap i dostępnymi user namespaces:

```bash
make twin-example
./bin/taskand twin run
./bin/taskand twin create
./bin/taskand twin status twin-f6a6b416-71d4-4553-9aea-c9e7f6d98b68 --json
```

`make twin-example` tworzy trwałe zadanie, wybiera istniejący skaner, waliduje DAG,
wykonuje go i sprawdza, że lista URI/statusów/hashów nie zmieniła się po wykonaniu.
`twin create` używa inwentaryzacji bez aktywnego skanu. `twin run` wykonuje także
skan LAN. CLI `twin` jawnie używa lokalnego rejestru hosta; gateway w kontenerze
może nie mieć narzędzi lub praw do user namespaces i wtedy zwróci błąd.

<!-- docs:section evidence -->
## Dowody wykonania

Oba zadania wykonały `proc://taskand.dev/admin/network-device-discovery/v4`, hash
`sha256:b58e007e79ce26397b76ca5d9ea2713896c13b68e8f327976365fc1b3a9f5b59`.

| Pomiar | Wynik |
| --- | --- |
| Zadanie 1 | `network-scan-8c60016a-f0c3-4573-bb7d-1eff0351b6a4`, SUCCEEDED |
| Zadanie 2 | `network-scan-d6fa9c79-0070-4bc1-bb51-04967fe57865`, SUCCEEDED |
| Receipt zadania 2 | `twin-f6a6b416-71d4-4553-9aea-c9e7f6d98b68` |
| Czas zadania 2 | 2026-09-13 07:05:51–07:06:01 UTC |
| Katalog migawki | 17 organizmów, 30 wpisów procesów, w tym 28 aktywnych |
| Interfejsy źródła / runtime | 158 / 158; brak różnic nazw |
| Przypisania adresów i prefiksów źródła / runtime | 192 / 192; brak różnic zbiorów |
| Podział przypisań prefiksów | 34 IPv4, 158 IPv6; nie są to 192 odrębne segmenty L2 |
| Sieci Docker | 31; wszystkie 29 deklaracji IPAM Subnet obecne w lokalnej topologii |
| LAN | `192.168.188.0/24`, pełny zakres `.0`–`.255`, hosty `.1`–`.254` |
| Sieć libvirt | `192.168.122.0/24` |
| Przykładowa sieć Docker | `192.168.144.0/20`, zakres `192.168.144.0`–`192.168.159.255` |
| Nmap: odpowiadające adresy LAN | 6 w źródle, 8 w emulacji; brak pominięć względem 6 |
| Reuse | ten sam URI i hash w obu zadaniach; 0 wygenerowanych procesów |
| Źródło po zadaniu | niezmieniona adresacja |

Digest drugiej migawki:
`sha256:e4fe106dbc78df96247950146513ac69350080677404dc2e11b26c03ea71c5e9`.
Surowe migawki, adresy urządzeń i wyniki runtime pozostają w ignorowanym `log/`.
Referencja receiptu jest dowodem lokalnej obserwacji, nie opublikowanym artefaktem CI.

Weryfikacja końcowa: konformacja 4/4, kontrakty 28/28, testy negatywne 17/17,
testy cyfrowego bliźniaka 8/8. Istniejący zestaw integracyjny: 43/43.
Testy poza ograniczonym sandboxem zakończyły się powodzeniem; pierwotne próby
w sandboxie blokowały procesy potomne i nie są dowodem poprawnego wykonania.

<!-- docs:section facts -->
## Fakty o reuse i istniejących organizmach

Przed zmianą jedynym opisanym digital twin była przeglądarka Chromium. Skaner v3
wybierał pierwszą pasującą trasę i przekazywał do `probePing` `net.cidr`, podczas
gdy `detectNetwork` zwracał `net.info.cidr`. Dodatkowo zakładał limit 64 adresów.
Jego `{ok:true}` nie dowodziło kompletnego skanu LAN. Niezmienne pakiety evolved
v1–v3 zachowano; nowy v4 ma jawny kontrakt topologii, lecz nie zastępuje wszystkich
dawnych sond mDNS/SSDP/DNS ani identyfikacji producenta.

Obecne zabezpieczenia reuse: `registry/select` dla nazwanej rodziny URI;
`dev/act` rozpoznaje skan LAN bez LLM i sprawdza istniejącą zdolność przed ewolucją;
walidator zamienia `spawn:<capability>` lub `spawn:<organism>/<capability>` na
istniejący URI, gdy wybór właściciela jest jednoznaczny. To nie jest kompletny
mechanizm semantycznego dopasowania dowolnych opisów. Hasło „najnowszy” też nie
dowodzi zgodności schematów — wymagany jest pasujący kontrakt.

| Istniejący organizm | Możliwość ponownego użycia | Granica obecnego kodu |
| --- | --- | --- |
| admin | wykrywanie adresów i lokalnej topologii | brak kompletnego profilu każdego urządzenia |
| registry | katalog, select, resolve, hash, status, federacja pakietów | to rejestr zdolności, nie inwentarz urządzeń |
| planner, validator, orchestrator | plan DAG, URI, zależności, wykonanie, resume | nie porównują samodzielnie zachowania urządzeń |
| twin | izolowana adresacja, web preflight i receipt zadania | brak osobnego runtime usług per urządzenie |
| hw, monitor | pomiar lokalnego węzła | nie odczytują dowolnego urządzenia zdalnego |
| vault | poświadczenia przez broker credentialRef | adapter musi deklarować do nich dostęp |
| dev | generowanie nowych pakietów i kontrola kontraktu | generator ma reguły tylko do odczytu; nie jest provisionerem VM/kontenerów |
| doctor, cluster | diagnostyka rejestru/usług i znanych peerów taskand | wymagają rozszerzeń dla modeli urządzeń |
| browser | istniejąca sesja CDP oraz nowy web-model: capture/replay | model publicznego UI, nie uwierzytelnionego backendu panelu |

<!-- docs:section hypotheses -->
## Założenia do potwierdzenia

Nie ustalono modeli ani uprawnień administracyjnych wszystkich urządzeń LAN.
Nie zakładamy, że adres IP identyfikuje sprzęt na stałe albo że OUI identyfikuje
model urządzenia. Jeden sprzęt może mieć wiele interfejsów/adresów, a jeden IP
może wskazywać kolejno różne urządzenia. VLAN/VRF i identyfikator interfejsu są
częścią kontekstu, zwłaszcza dla powtarzających się IPv6 link-local.

Możliwość dokładnego uruchomienia firmware zależy od dostępności obrazu, jego
warunków użycia, architektury CPU i emulacji peryferiów; nie da się jej ustalić
samym skanem. Model zachowania protokołu może być wystarczający do części zadań.

<!-- docs:section limitations -->
## Ograniczenia bieżącego bliźniaka

Zgodność adresacji nie oznacza zgodności urządzeń: emulacja dodaje odpowiedzi
dla znanych adresów także z tablicy sąsiadów, stąd 8 odpowiedzi zamiast 6.
Nie ma osobnych stosów TCP/IP, systemów plików, firmware ani usług per urządzenie.
Wszystkie interfejsy dummy są podnoszone; stany fizycznych łączy i relacje bridge
nie są odtworzone. Trasy są zinwentaryzowane, ale nie są odtwarzane jako rzeczywisty
routing pomiędzy segmentami. Nie skopiowano DHCP, DNS, VLAN, ACL, NAT ani firewalli.

Wynik nie dowodzi znalezienia każdego hosta. Skan IPv4 z obecnymi sondami może
nie wykryć urządzenia śpiącego lub filtrującego ruch; IPv6 opiera się na adresach
i sąsiadach. Brak odpowiedzi oznacza brak obserwacji, nie pewność braku urządzenia.
Porównanie źródła przed/po dotyczy adresacji, nie atomowej migawki całej infrastruktury.
Żaden pomiar obecnego raportu nie potwierdza pełnego odwzorowania usług.

<!-- docs:section recommendations -->
## Projekt rozszerzenia: bliźniaki urządzeń krok po kroku

Poniższe nowe URI są propozycją. Nie istnieją jeszcze w rejestrze i nie należy
przedstawiać ich jako gotowych poleceń. Wystarczy rozszerzyć istniejące organizmy
`admin` i `twin`; nie trzeba tworzyć osobnego organizmu dla każdego adresu IP.
Instancja urządzenia jest danymi; zdolność/protokół jest współdzielonym procesem URI.

1. **Ustal wymagany poziom wierności zadania.** Wykrywanie hostów, test API,
   test konfiguracji routera i test firmware wymagają różnych modeli. W blueprint
   należy zapisać wymagane protokoły/scenariusze i kryteria akceptacji.
2. **Odkryj i utrwal tożsamość urządzeń.** Reuse `admin/network-device-discovery/v4`
   i `registry/core`. Dodaj `admin/device-inventory/v1` zarządzający trwałymi
   `deviceId`, adresami z kontekstem sieci, źródłami dowodów i czasem obserwacji.
   Łącz MAC, UUID/serial i potwierdzone identyfikatory; sam IP ani sam MAC nie wystarcza.
3. **Zbierz profil.** Nowy `admin/device-profile/v1`: metadane DHCP/DNS, ARP/NDP,
   mDNS/SSDP/LLDP tam, gdzie są dostępne, później ograniczone sondy usług.
   W razie dostępnego dostępu użyj dedykowanego kolektora tylko do odczytu przez
   SSH, API, SNMP lub eksport konfiguracji i poświadczeń z vault.
   Lokalny `hw/monitor` można wykorzystać na urządzeniu będącym węzłem taskand;
   samo federowanie pakietów nie uruchamia tego pomiaru na dowolnym obcym hoście.
4. **Dobierz istniejący model.** Nowy `twin/device-plan/v1` dopasowuje profil
   i wymagania testu do adapterów z registry: wspierany protokół, wersja schematu,
   poziom wierności, wymagany runtime, ograniczenia i testy zgodności. To wymaga
   rozszerzenia obecnych manifestów/rejestru o te metadane. Reuse jednego adaptera
   dla wielu instancji; `dev/codegen`/`dev/evolve` dopiero dla brakującej zdolności.
5. **Uruchom instancje.** Nowy, jawnie implementowany `twin/device-runtime/v1`
   tworzy osobny namespace/kontener lub VM dla każdego urządzenia. Modele łączą
   się przez izolowane przełączniki/mosty i routery wewnątrz wspólnego laboratorium.
   IP, prefiksy i istotne MAC mogą być identyczne ze źródłem bez mostu do fizycznej
   sieci. Kontenery z tym samym kernelem nie dają wiernego fingerprintu obcego OS.
   Obrazy, konfiguracje i dane muszą być jawnie wskazane; modele nie otrzymują
   produkcyjnych sekretów. Uruchamianie pozostaje zadaniem kontrolowanego runtime,
   nie automatycznie wygenerowanego skryptu obchodzącego guard.
6. **Sprawdź zachowanie.** Nowy `twin/device-verify/v1` porównuje istotne dla
   zadania obserwacje źródła i modelu: dostępność portów, odpowiedzi protokołu,
   pola API, błędy, przejścia stanów i scenariusze awarii. Sam JSON `{ok:true}`
   i ta sama liczba adresów nie wystarczają. Orkiestrator dopuszcza zależne kroki
   wyłącznie po spełnieniu wymaganej wierności; zapisuje wersje modelu i dowody.
7. **Aktualizuj model.** Nowy `twin/device-sync/v1`, uruchamiany przez istniejącą
   orkiestrację i diagnostykę, wykrywa zmianę profilu/konfiguracji, unieważnia
   nieaktualne wyniki i ponownie waliduje dotknięte instancje. Harmonogram wymaga
   jawnego podłączenia wykonawcy; sam proces `cluster/monitor` go nie zapewnia.

Przykładowe modele: serwer → usługi w kontenerach lub VM; router → model routingu,
DNS/DHCP/ACL na podstawie eksportu; drukarka → emulacja IPP/statusów; czujnik →
model MQTT lub Modbus z wejściami i stanem; zamknięte urządzenie → model obserwowanego
protokołu. Dokładny firmware to osobna, warunkowa ścieżka, nie domyślny rezultat.

### Urządzenie nierozpoznane

Model `unknown-device` powinien mieć `identification: unknown`, listę obserwacji
z datami, hipotezy z uzasadnieniem, nieobsługiwane zachowania i wierność tylko dla
potwierdzonych cech. Rekord urządzenia powstaje zawsze; instancja runtime odtwarza
jedynie zachowanie, na które istnieją dowody. Nieznane porty lub stan online nie
stają się automatycznie otwarte/aktywne. Nie jest to pełny, zweryfikowany bliźniak.

Proponowane przejścia: `DISCOVERED → PROFILED → MODELED → VERIFIED`; przy braku
danych `DISCOVERED → PARTIAL/UNKNOWN`, a po ich pozyskaniu ponowna identyfikacja
bez zmiany trwałego `deviceId`. Zadanie wymagające wyłącznie adresacji może użyć
modelu częściowego; zadanie zależne od nieznanej funkcji zwraca brak pokrycia
i żąda konkretnego brakującego źródła: modelu, eksportu konfiguracji lub dostępu
tylko do odczytu. W LLM nie należy traktować hipotezy o typie urządzenia jako faktu.

Sondy mają być stopniowane. Nmap opisuje zarówno [rozpoznawanie usług](https://nmap.org/book/man-version-detection.html),
jak i [niepewność fingerprintu systemu](https://nmap.org/book/man-os-detection.html).
Dokumentacja wskazuje konkretny skutek uboczny: sondowanie portu 9100 może
uruchomić drukowanie. Dlatego nie proponujemy automatycznego szerokiego `-A` ani
testów zapisu na nieznanym sprzęcie; zakres sond powinien odpowiadać ustalonemu
profilowi i celowi zadania. Domyślne sondy nie mogą sterować urządzeniami OT/IoT.

Minimalny następny etap implementacji: trwały inwentarz, profil urządzenia,
model unknown, jeden adapter znanego protokołu i porównanie źródło/model.

## Zaimplementowane rozszerzenie: strony internetowe i API

### Fakty: kontrakt, reuse i izolacja

Dodano dwie zdolności do istniejących organizmów, bez organizmu osobno dla każdej
domeny:

- `proc://taskand.dev/browser/web-model/v1`: `capture`, `replay`, `status`.
- `proc://taskand.dev/twin/web/v1`: `capture` lub `run`, wybór zdolności z rejestru,
  weryfikacja URI/hash przed i po zadaniu oraz wpis audytowy.

`twin/web` odczytuje katalog wszystkich organizmów, po czym wybiera najwyższą
aktywną wersję rodziny `browser/web-model`. To jawny dobór znanego kontraktu,
nie dowolne semantyczne dopasowanie. Ponownie wykorzystano `registry`, `browser`,
`twin`, `validator`, `orchestrator`, routing `dev/chat` i regułę `planner/plan`.
Nowe są procesy budowy/odtwarzania modelu; istniejący `browser/session` nie dawał
izolowanego replay. Domeny i migawki są danymi, nie nowymi pakietami kodu.

Capture pozwala transportowi nadrzędnemu pobierać tylko publiczne GET z podanych
originów (schemat, host i port). Nie przekazuje cookies, Authorization ani
produkcyjnych nagłówków podanych przez stronę. Przekierowania są ręczne: kolejny
adres również musi przejść kontrolę originu. Metoda GET ogranicza ryzyko zapisu,
ale nie dowodzi braku efektów ubocznych źle zaprojektowanego endpointu; podawać
należy tylko zatwierdzone, publiczne strony i zasoby do odczytu.

Chromium działa w `bubblewrap` z osobnymi przestrzeniami sieci, użytkownika,
procesów i montowań. Profil jest tymczasowy. Nie montuje się projektu, katalogu
domowego hosta ani jego socketów. CDP używa rur, nie otwartego portu. Chrome
uruchamia się z `--no-sandbox` **wewnątrz** tego zewnętrznego jaila; bez działającego
`bwrap` proces kończy się błędem, nie uruchamia przeglądarki na hoście bez izolacji.
Readonly `/usr`, biblioteki, instalacja Chrome i fonty nadal są widoczne — nie
jest to gwarancja odporności na luki jądra. Model namespace/mount opiera się na
[dokumentacji bubblewrap](https://github.com/containers/bubblewrap).

Replay nigdy nie przechodzi do pobierania ze źródła. Odpowiedź musi pochodzić
z migawki lub jawnego `mocks`. Dopasowanie obejmuje metodę, pełny URL z query
i dokładną treść żądania. Niedostępnej treści POST nie dopasowuje się jako pustej.
Nieznane żądanie zostaje zablokowane i zapisane jako brak pokrycia. Mocks nie
mogą nadpisać istniejącego kontraktu; każde trafienie jest oznaczone jako synthetic.

`scenarioPassed` opisuje kroki/asercje; `coverageComplete` dodatkowo wymaga braku
nieznanych żądań, błędów transportu i wyjątków JS w obserwowanym przebiegu.
`VERIFIED_SCENARIO` dotyczy wyłącznie tego przebiegu na konkretnej migawce,
nie całej witryny. `PARTIAL` zwraca `ok:false`; w DAG blokuje kroki zależne.
`implementationVerified`, `backendVerified` i `productionApproved` pozostają false.

### Wyniki dla adresów użytkownika

Obserwacja 2026-09-13; replay Chrome 153.0.8010.36, viewport 1280×900.
Migawki i screenshoty są lokalne w prywatnym, ignorowanym `log/web-models/`.
Nie wysłano formularza logowania ani produkcyjnego POST. Użyto wyłącznie danych
testowych `twin-demo@example.invalid`, `twin-demo`, `test-only` w przeglądarce offline.

| Źródło | Migawka | Scenariusz | Wynik i brak pokrycia |
| --- | --- | --- | --- |
| `https://github.com/` i `/login` | 188 zasobów GET | strona główna → Sign in → widoczność, walidacja pustego pola i wpisanie loginu; 7/7 kroków | PARTIAL: 5 żądań POST do collector i browser/stats, brak modelu telemetrii |
| `https://subactor.com/login_up.php` | 22 zasoby GET; ekran Plesk Obsidian 18.0.80 | widoczność i wypełnienie pól login/hasło; 6/6 kroków | PARTIAL: 1 POST do Sentry i 2 OPTIONS do uat-proxy.plesk.com |

Po poprawce oczekiwania na renderowanie migawka Subactora zawiera także fonty,
ikony i logo; nie pozostały brakujące GET w tym scenariuszu. Nie usuwano błędów
telemetrii z bramki tylko po to, aby uzyskać zielony wynik. W obu zadaniach krok
`dependent_step_marker` był BLOCKED. Ten krok jest nieszkodliwym znacznikiem
testowym, a nie implementacją ani wdrożeniem.

Dowody lokalne końcowych zadań:

- GitHub: zadanie `web-preflight-8ee2afb4-419b-43e5-abca-563b7c4fdfe4`,
  model `webmodel-1ebc0110-8a17-4135-b7e6-b3a1365c21b9`,
  receipt `webmodel-0e17d909-2a44-4de8-9947-cf557ded800c`;
  snapshotHash `sha256:49ac3e12f19caae654b5bae813e5e4bac248f877fb62a6f10595651b5343c6c1`.
- Subactor: zadanie `web-preflight-5f22846e-57f0-467f-bfbb-fdb8b7aa5f2a`,
  model `webmodel-7fa37d0a-4663-4251-bc22-bad05d57861b`,
  receipt `webmodel-951da3fc-00dd-4a6c-959a-f3687519f175`;
  snapshotHash `sha256:4fd25a603821fc2d492ea6e0f5b69588fb273245e4eb0ab2d2621ca447f82cd1`.

Oba wykonały `browser/web-model/v1` z bindingHash
`sha256:8a13bc927a203d82b4da00d760e86074fce55465a10b935c1cfd79de78f9b8a7`.
Katalog miał 17 organizmów. Lista URI/hash/status przed i po każdym zadaniu
była identyczna: `reused:true`, `generatedProcesses:0`.

Testy implementacji: `make test` — konformacja 4/4, kontrakty 30/30, negatywne
17/17, sieciowy twin 8/8, web twin 8/8; `make integration` — 43/43.
Web test uruchamia rzeczywisty lokalny serwer HTTP, nagrywa UI i GET API,
wyłącza źródło, a następnie odtwarza scenariusz z wynikiem VERIFIED_SCENARIO.
Osobno sprawdza syntetyczny POST/201 i nieznane body POST → FAILED → zależność
BLOCKED. Próba dostępu z przeglądarki do działającego serwera hosta bez przechwytu
CDP nie dociera do niego; plik istniejący w repo jest w przeglądarce niedostępny.
To testy mechanizmu, nie dowód poprawności backendów wskazanych stron.

### Użycie taskand krok po kroku

1. Określ URL, dozwolone originy zasobów oraz oczekiwany rezultat scenariusza.
   Edytuj [scenariusz GitHuba](../../examples/web-twin-github.json) lub
   [scenariusz Subactora](../../examples/web-twin-subactor.json). Dostępne akcje:
   `goto`, `assert`, `fill`, `click`, `request`; wymagane co najmniej jedno sprawdzenie.
2. Uruchom capture + replay przez CLI albo pełne zadanie z walidowanym DAG:

   ```bash
   ./bin/taskand twin web examples/web-twin-github.json --json
   ./bin/taskand twin web examples/web-twin-subactor.json --json
   node examples/web-twin-task.mjs github
   node examples/web-twin-task.mjs subactor
   ```

   Te polecenia nagrywają aktualne publiczne GET. Wymagają Linux, Node 20+,
   `bwrap`, działających user namespaces oraz Chrome w `/opt/google/chrome/chrome`.
   Brak zależności oznacza błąd; nie ma nieizolowanej ścieżki zastępczej.
3. Aby ponowić test **bez pobierania czegokolwiek z Internetu**, wykorzystaj model:

   ```bash
   node examples/web-twin-task.mjs github --model webmodel-1ebc0110-8a17-4135-b7e6-b3a1365c21b9
   node examples/web-twin-task.mjs subactor --model webmodel-7fa37d0a-4663-4251-bc22-bad05d57861b
   ```

   W JSON dla CLI wystarczy dodać `modelId` do scenariusza. Identyfikatory powyżej
   istnieją na tym hoście, nie są przenośnym publicznym katalogiem. `PARTIAL`
   celowo daje kod wyjścia 1; nie traktować go jako zaakceptowanego preflightu.
4. Odczytaj receipt, screenshot, `misses` i hash modelu. Uzupełnij brakujące GET
   przez nowe nagranie dozwolonych URL. Dla API można jawnie podać np. kontrakt
   POST ze statusem 201 albo 401 w `mocks`, wraz z dokładnym body żądania; akcja
   `request` sprawdza `expect.status`, opcjonalnie `expect.json`/`textIncludes`.
   Przykład działającego syntetycznego POST znajduje się w
   [teście web/API](../../tests/web_twin.test.mjs). Mock jest założeniem testowym,
   nie obserwacją zachowania prawdziwego API.
5. Powiąż następny krok zadania zależnością od `web_preflight`. Wykonaj implementację
   dopiero w osobnym, uprawnionym etapie; przetestuj potem samą implementację
   na tym modelu i, jeśli potrzebna weryfikacja backendu, na autoryzowanym stagingu.
   Reguła w plannerze pomaga budować plan, ale nie jest globalnym wymuszeniem
   preflight dla każdego dowolnego procesu. Gwarancja bramki dotyczy jawnego DAG.

### Ograniczenia i potrzebne rozszerzenia

Nie kopiujemy kodu serwera, bazy danych, sesji, OAuth/2FA, uprawnień użytkowników,
antybota ani całej przestrzeni URL. Publiczna migawka nie ujawni sposobu działania
nieznanego backendu. Stan po logowaniu wymaga zatwierdzonego środowiska testowego,
testowych kont i kolektora z jawnym zarządzaniem poświadczeniami; nie jest częścią
obecnego capture. Dla własnej usługi pełniejszy twin wymaga obrazu/kodu backendu,
konfiguracji i zanonimizowanych danych albo uzgodnionego modelu stanowego API.

Obecny replay jest ograniczonym modelem odpowiedzi HTTP, nie emulatorem całej
usługi. Nie modeluje wariantów cookies/nagłówków, sekwencji zmiennych odpowiedzi
dla tego samego żądania, WebSocket/SSE, workerów i nowych okien. Click jest
programowym kliknięciem DOM, nie pełnym testem fizycznych interakcji użytkownika.
Wierność wizualna nie jest automatycznie porównywana piksel po pikselu. Obserwacja
ma ograniczony czas, max 5 URL, 500 zasobów, 40 MiB i 30 kroków — nie jest crawlerem
wszystkich leniwie ładowanych podstron. Nieznane zależności pozostają nieznane.

W ramach tej wersji można zbadać wykonalność i kryteria planowanego zadania
**przed implementacją**, ale nie można potwierdzić poprawności kodu, który jeszcze
nie powstał. Dalsze zdolności (uwierzytelniony kolektor, stanowy emulator API,
adapter uruchamiania własnego backendu) można dodać do istniejących organizmów;
nie ma potrzeby generować nowego organizmu dla każdej strony ani urządzenia.
Dopiero potem kolejne adaptery i dokładniejsze odwzorowanie firmware.
