---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "digital-twin",
  "kind": "analysis",
  "version": 1,
  "title": "Cyfrowy bliźniak sieci i urządzeń w taskand",
  "status": "draft",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-13",
  "updated": "2026-09-13",
  "review_after": "2026-09-20",
  "source_revision": "77e5c232d344f956e4c72d5cd74c2bb50fd7d33b",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "generated/twin/environment/taskand.dev/v1/bin.mjs",
    "generated/twin/environment/taskand.dev/v1/runtime.mjs",
    "generated/admin/network-device-discovery/taskand.dev/v4/bin.mjs",
    "generated/registry/core/taskand.dev/v1/select.mjs",
    "tests/digital_twin.test.mjs",
    "examples/network-scan-task.mjs",
    "local-receipt:twin-f6a6b416-71d4-4553-9aea-c9e7f6d98b68"
  ]
}
---

# Cyfrowy bliźniak sieci i urządzeń w taskand

<!-- docs:section question -->
## Pytania i stan realizacji

Czy zadanie skanowania tworzy środowisko testowe z rzeczywistą adresacją lokalną,
czy ponownie używa zarejestrowanych URI i jak rozszerzyć je o modele urządzeń?

Adresację zaimplementowano i sprawdzono w dwóch rzeczywistych zadaniach. Modele
usług i zachowania poszczególnych urządzeń opisane niżej są projektem rozszerzenia,
nie wdrożoną funkcją. `fullInfrastructure: false` jest celowym wynikiem obecnego
procesu. Dokument ma status draft ze względu na tę niezrealizowaną część.

<!-- docs:section scope -->
## Zakres

Właściciel: `semcod/taskand-glm53`; kanoniczny raport: ten plik. Wskazana rewizja
jest bazą lokalnych zmian podczas testów. W trakcie sesji równoległe operacje Git
przesunęły HEAD z `42eb4bf872a16e3da660732294f95775350dda1c` przez tę bazę do
`5e1ecf2f9c067987673da496cbfa02077587c405`; nie przypisujemy sobie tych commitów.
Publikacji PR ani merge nie weryfikowano. BindingHash poniżej identyfikuje
testowany skaner; raport jest lokalnym, dodanym do indeksu dokumentem.

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
| twin | izolowana adresacja i receipt zadania | obecnie jeden model sieci hosta, bez osobnego runtime usług per urządzenie |
| hw, monitor | pomiar lokalnego węzła | nie odczytują dowolnego urządzenia zdalnego |
| vault | poświadczenia przez broker credentialRef | adapter musi deklarować do nich dostęp |
| dev | generowanie nowych pakietów i kontrola kontraktu | generator ma reguły tylko do odczytu; nie jest provisionerem VM/kontenerów |
| doctor, cluster | diagnostyka rejestru/usług i znanych peerów taskand | wymagają rozszerzeń dla modeli urządzeń |
| browser | obsługa skonfigurowanej przeglądarki przez CDP | brak automatycznego klonowania paneli urządzeń |

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
Dopiero potem kolejne adaptery i dokładniejsze odwzorowanie firmware.
