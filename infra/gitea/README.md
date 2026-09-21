# Taskand Gitea / OneDev Rejestr Kapsuł i Kodu

Moduł zapewnia zamienne stosowanie lekkiego lokalnego serwera **Gitea** oraz istniejącej instalacji **OneDev** (port 6610-6611) jako lokalnego repozytorium Git oraz rejestru pakietów OCI/NPM.

## Konfiguracja w `.env`

W głównym pliku `.env` Taskand zdefiniuj:

```ini
# Wybór dostawcy rejestru Git / Packages: "onedev" lub "gitea"
TASKAND_GIT_REGISTRY_PROVIDER=onedev
# TASKAND_GIT_REGISTRY_PROVIDER=gitea

# URL lokalnego rejestru
TASKAND_LOCAL_REGISTRY_URL=http://127.0.0.1:6610
# Dla Gitea: http://127.0.0.1:3000
```

## Uruchomienie Gitea (Opcja 2)

```bash
cd infra/gitea
docker compose up -d
```

## Synchronizacja i tryb offline

W przypadku pracy offline na urządzeniach brzegowych, procesy zapisują commity i artefakty do lokalnego rejestru. Po wykryciu połączenia sieciowego skrypt `sync-registry.sh` wykonuje automatyczną synchronizację różnicową (delta-sync) z nadrzędnym repozytorium.
