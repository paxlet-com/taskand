# Synchronizacja pakietów w sieci lokalnej

Taskand używa jednego workera gossip do pobierania pakietów z jawnie wskazanych
węzłów. Pobranie zapisuje zweryfikowane pliki i wpis `candidate`; nie wykonuje
kodu, nie nadaje grantów i nie aktywuje procesu. Ten etap nadal używa katalogu
`taskand-registry/1` oraz pakietów `proc.yaml`/Node. Nie zapewnia synchronizacji
zadań, wyników uruchomień, usunięć ani sekretów między instancjami.

## Konfiguracja i zmiany względem wcześniejszej wersji developerskiej

- Włącz worker przez `TASKAND_GOSSIP_ENABLED=1`. `TASKAND_GOSSIP_INTERVAL`
  określa przerwę między rundami: domyślnie 5 sekund, zakres 0,1–3600.
  Obecny start gateway włącza go również przy niepustym `TASKAND_PEERS`;
  wyłączenie wymaga ustawienia `TASKAND_GOSSIP_ENABLED=0` i usunięcia tej listy.
- Wskaż originy w `genome.yaml` (`peers`) lub w `TASKAND_PEERS`, rozdzielone
  przecinkami, np. `https://node-a.example:8077,https://node-b.example:8077`.
  Zmienna środowiskowa nie zmienia pliku genome. Łącznie dozwolone jest 16
  unikalnych peerów; ścieżki, parametry, fragmenty i dane logowania w URL
  są odrzucane.
- `TASKAND_GOSSIP_PEER_TOKENS` zawiera obiekt JSON `origin → token`.
  Każdy token należy do konkretnego zdalnego węzła i powinien mieć tylko grant
  `read` na udostępniane procesy oraz rejestr. Token trafia wyłącznie do statusu
  gossip i endpointu pakietów tego originu. Publiczne health/catalog nie dostają
  tokenów. `TASKAND_AUTH_TOKEN` nie jest poświadczeniem do synchronizacji.
  Przekierowania HTTP są odrzucane. Dla poświadczeń stosuj HTTPS lub lokalny
  tunel; HTTP nie szyfruje transmisji.
- Domyślnie `TASKAND_GOSSIP_AUTO_APPROVE=0`. Wartość `1` jawnie zezwala
  workerowi aktywować nowo pobrane kandydatury. Istniejące wpisy `candidate`
  i `deprecated` nie są automatycznie reaktywowane. Samo `policy.peers: auto`
  w genome nie aktywuje już pakietu podczas `pull`.
- `GET /api/cluster/gossip` wymaga grantu `read` na
  `proc://taskand.dev/registry/core/v1`. `POST /api/cluster/gossip` wymaga
  `admin` i pustego obiektu JSON. Żądanie nie zmienia konfiguracji workera.
  Odpowiedź ma status 409 przy trwającej rundzie, 503 przy niepełnym sukcesie.

Adresy otrzymane od innego peera są wyłącznie obserwacjami w statusie. Worker
nie dopisuje ich do konfiguracji ani nie kontaktuje się z nimi automatycznie.
To pozostawia prostą granicę zaufania: jedna lokalna lista skonfigurowanych
peerów, osobne poświadczenia i istniejące granty Taskand.

## Transfer i ponawianie

Rundy są serializowane. Jedna runda planuje pracę przez najwyżej 30 sekund,
pobiera do 16 pakietów i przyjmuje katalog do 256 wpisów / 1 MiB. Limity
poszczególnych operacji I/O i zatrzymanie procesu mogą wydłużyć kończenie
już rozpoczętej operacji; nie jest to gwarancja czasu rzeczywistego.

Żądanie pobrania wiąże URI z hashem wybranym z katalogu. Zmieniony katalog,
niezgodne URI manifestu, hash, wadliwy base64, nazwy ścieżek i przekroczone
limity kończą się błędem. Pakiet może zawierać do 128 płaskich plików, do
4 MiB na plik i 16 MiB łącznie; odpowiedź HTTP ma limit 24 MiB.

Pliki powstają w prywatnym katalogu tymczasowym na tym samym systemie plików.
Po weryfikacji następuje atomowa zmiana nazwy i rejestracja kandydata.
Przerwa między tymi krokami pozostawia kompletne pliki, które kolejna próba
może zarejestrować. Błąd transferu usuwa tylko własny katalog tymczasowy.
Istniejący pakiet o innym hashu jest konfliktem i nie zostaje nadpisany.
Po powrocie offline peera kolejna runda ponawia brakujące importy.

Digest sprawdza zgodność bajtów; nie uwierzytelnia autora. Obecny hash Taskand
różni się od digestu Paxlet. Adapter tworzy osobny pakiet Paxlet, a wykonanie
weryfikuje właśnie jego digest. Przeniesienie URI nie przenosi autoryzacji.

## Dalsze uproszczenie ekosystemu

Docelowo Paxlet powinien być jedynym formatem pakietu i magazynem treści,
a Taskand utrzymywać lokalną projekcję katalogu, granty i wyniki wykonania.
Pozwoli to usunąć drugi algorytm hashowania oraz drugą implementację importu.
Alias i lokalizacja peera nie powinny zmieniać niezmiennej zawartości pakietu.

Kolejny etap wymaga wersjonowanego kontraktu katalogu z rewizjami i znacznikami
usunięć oraz testów migracji obecnych `proc://` i adapterów shell/MCP. Ogłoszenia
LAN mogą dostarczać kandydatów do parowania; nie powinny automatycznie zmieniać
listy zaufanych peerów. Ten etap nie jest jeszcze wdrożony przez opisany worker.

## Powtarzalne testy

Z checkoutu Taskand, ze wskazaniem checkoutu Paxlet zawierającego nowy magazyn:

```bash
PAXLET_TEST_ROOT=/path/to/paxlet PYTHONPATH=/path/to/paxlet \
  PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p gossip_test.py -v
```

Testy tworzą trzy tymczasowe rejestry Node i serwery HTTP na loopback. Obejmują
autoryzację, offline/rejoin, przekierowania, błędne odpowiedzi, limity, konflikty,
równoległy import, odzyskanie po przerwaniu i przejście Taskand → adapter Paxlet
→ magazyn → kopia wykonawcza z przypiętym digestem. Bez `PAXLET_TEST_ROOT`
test przejścia przez Paxlet jest oznaczony jako pominięty. Żaden test nie używa
rejestru ani poświadczeń działającego węzła.
