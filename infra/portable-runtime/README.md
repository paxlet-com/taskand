# Portable gateway pilot

An opt-in API-only profile, separate from the root Compose deployment. It needs
neither host networking, a Docker socket nor a checkout at runtime. It does not
launch the bootstrap, UI, browser, observers or peers. A small Nginx ingress
forwards the loopback port to the internal gateway. The existing stack is
unchanged. No production deployment is authorized by these instructions.

## Build and run

Build from a clean export of an exact reviewed commit, not the developer's dirty
checkout. The Dockerfile-specific ignore list is an additional boundary, not a
secret scanner: review/scan the source archive before sending it to a builder.

```sh
git archive --format=tar APPROVED_COMMIT_SHA | docker build \
  -f infra/portable-runtime/Dockerfile -t taskand-portable:pilot -
```

Resolve the resulting local image ID with `docker image inspect
taskand-portable:pilot --format '{{.Id}}'` and set `TASKAND_GATEWAY_IMAGE` to that
exact `sha256:...` value. Compose requires a value but does not itself validate
that it is immutable: resolving and recording the digest is an operator step.
`pull_policy: never` prevents implicit network pulls on startup.
The pinned Nginx image declared in Compose must also already be cached on the
target engine; provisioning it is a separate, explicit transport step.

Set `TASKAND_GRANTS_FILE` to an **absolute path** of a separately provisioned
private `grants.yaml`, readable by container UID/GID 10001. Use the existing
grant contract and only the URIs required for the pilot. No default token,
admin environment override, key or private config is included in this image.
Missing bind sources fail instead of creating an empty directory. Do not run
`compose config` with token values in the environment or paste private files.

```sh
docker compose -p taskand-portable-pilot -f infra/portable-runtime/compose.yaml config --quiet
docker compose -p taskand-portable-pilot -f infra/portable-runtime/compose.yaml up -d
```

The host API is `http://127.0.0.1:18077`, exposed by Nginx, not by the internal
gateway. Bind inside the gateway is `0.0.0.0` so the proxy can reach it;
this also makes existing auth reject the
public demonstration tokens. Unauthenticated context/mesh requests must return
401, not 200 or 404. Perform an authorized read-only canary separately; a
health response alone does not establish successful authenticated use.

The project-scoped `context` volume stores `/taskand/log`, including the SQLite
context database. Docker initializes a new volume from the image directory's
UID/GID; an existing volume must already be accessible to UID 10001. Stop with
the same Compose command and `down`, **without `--volumes`**. Do not attach this
pilot to production data; test snapshot/restore before using real history.

## Boundaries and acceptance

The root filesystem and packaged registry are read-only. Package mutation,
evolution and writes outside the context/log volume are unsupported. The
gateway's internal bridge intentionally denies external routing: no LLM E2E, LAN
discovery, remote browser or federation is claimed. This is not a sandbox for
hostile processes; grant policy still matters. Resource settings are pilot
ceilings, not measured throughput guarantees.
Only the ingress joins the ordinary bridge; it has no grants or data mounts,
no forward-proxy configuration, and no gateway code. This does not establish
complete network isolation against a compromised proxy or Docker host. Its
fixed config and all Nginx temporary directories live in a bounded tmpfs.

Python base bytes are pinned. Alpine Node dependencies are resolved at build
time, so builds are **not yet byte-reproducible**. Preserve the resulting image
digest for restart/offline use; a dependency closure, signed release manifest
and platform-specific artifacts remain follow-up work. Health identity remains
UNREPORTED until the release-manifest delivery path is integrated; an image
name or Git label must not substitute for verified runtime identity.

Docker Engine on Linux and a Linux guest VM are intended targets. Docker
Desktop, rootless Docker, Podman, ARM64 and hypervisor-specific networking need
separate qualification; do not infer support from this Compose file. An internal
bridge is not proof of complete hostile-network isolation on every engine.

Run `python3 -m unittest discover -s infra/portable-runtime -p 'test_*.py'` and
the managed governance gate. These are offline configuration regression tests,
not a real image build, service restart, data recovery or VM qualification.
Protected OneDev/Validator publication and deployment acceptance are separate.

An explicit synthetic test uses a random project name, generated fixture grants
and a new disposable volume. It creates one synthetic context object, verifies
auth through the host port, restarts gateway, and checks that object's identity.
It removes only its own fixture project and volume, even on failure:

```sh
python3 infra/portable-runtime/test_profile.py --image sha256:LOCAL_IMAGE_ID
# The above is plan-only. Add --execute to run the synthetic Docker test.
```

Observed on 2026-09-14, Linux AMD64 / Docker Engine 29.1.3: image build and the
synthetic auth/context-restart test passed for image
`sha256:34be51ec547c4f3c3220fe7fe1b36b54b2864c7935fcbd9a28669668ab8e40c8`.
Earlier trials failed because an internal-only network did not publish the
configured host port, Compose rejected inline configs on a read-only service,
and Nginx tried to create its default FastCGI temp directory on the read-only
root. The ingress split and explicit tmpfs paths address those failures;
offline tests retain the relevant configuration assertions. This evidence
does not qualify VM/browser/LLM E2E, crash recovery or a production upgrade.
