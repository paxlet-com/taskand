# proc://taskand.dev/hw/monitor/v1

> Kapsuła organizmu sprzętowego: Telemetria czujników temperatury, obciążenia CPU, wolnej przestrzeni dyskowej i portów GPIO.

## Kontrakt URI

* **URI**: `proc://taskand.dev/hw/monitor/v1`
* **Organizm**: `hw`
* **Typ**: `task`
* **Licencja**: Apache-2.0

## Kody Wyjścia

* `0`: Sukces, poprawny JSON zwrócony na stdout.
* `1`: Błąd wykonania podczas odczytu telemetrii.
* `2`: Naruszenie kontraktu (niepoprawny JSON na stdin).

## Wejście (stdin)

Opcjonalny obiekt JSON:
```json
{
  "device": "nazwa-wezla"
}
```

## Wyjście (stdout)

```json
{
  "ok": true,
  "device": "desktop-node",
  "cpu_temp": 45.2,
  "cpu_temp_source": "Package id 0",
  "sensors": [
    {"sensor": "Package id 0", "temp_c": 45.2},
    {"sensor": "Core 0", "temp_c": 42.0}
  ],
  "cpu_usage_pct": 12.4,
  "load_avg": [1.2, 0.9, 0.7],
  "disk_free_gb": 128.5,
  "gpio_chips": [],
  "summary": "temperatury poniżej 85°C (max 45.2°C)",
  "ts": "2026-09-15T11:40:00.000Z"
}
```

## Uruchomienie Standalone

### Za pomocą Node.js
```bash
npm install
npm test
echo '{"device": "test"}' | node bin.mjs
```

### Za pomocą Docker
```bash
docker build -t taskand/hw-monitor:v1 .
echo '{}' | docker run -i --rm taskand/hw-monitor:v1
```
