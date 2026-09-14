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
