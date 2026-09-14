#!/usr/bin/env python3
"""Local operator adapter. Stage exact merged source; retain containers for rollback.

No credential values or application history are read. Docker mount references
are reused; container images do not identify bind-mounted application bytes.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tarfile


def run(*args):
    return subprocess.run(args, check=True, capture_output=True).stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe(path):
    path = Path(path).absolute()
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError('Symlink is not permitted: ' + str(path))
    return path


def metadata(name):
    # Explicit projection: never fetch Config.Env or container logs.
    template = ('{"id":{{json .Id}},"image":{{json .Image}},'
                '"mounts":{{json .Mounts}},"hostname":{{json .Config.Hostname}},'
                '"network":{{json .HostConfig.NetworkMode}},'
                '"running":{{json .State.Running}}}')
    return json.loads(run('docker', 'inspect', '--format', template, name))


def stage(repo, revision, destination):
    if not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Full source SHA required')
    run('git', '-C', str(repo), 'merge-base', '--is-ancestor', revision, 'origin/main')
    destination = safe(destination)
    if destination.exists():
        raise ValueError('Stage destination must not exist')
    gateway = metadata('glm53-gateway-1')
    landing = metadata('glm53-landing-1')
    mounts = {m['Destination']: m for m in gateway['mounts']}
    generated = safe(mounts['/taskand/generated']['Source'])
    # Refuse unknown local package changes; never overwrite evolved files.
    archive = run('git', '-C', str(repo), 'archive', revision,
                  'gateway', 'gateway.py', 'index.html', 'generated', 'genome.yaml')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for item in tar.getmembers():
            if item.isdir():
                continue
            if not item.isfile() or '..' in Path(item.name).parts:
                raise ValueError('Only regular source files permitted')
            files[item.name] = tar.extractfile(item).read()
    for name, data in files.items():
        if name.startswith('generated/'):
            current = safe(generated / name.removeprefix('generated/'))
            if current.exists() and current.read_bytes() != data:
                raise ValueError('Runtime package differs from selected source: ' + name)
    for path in generated.rglob('*'):
        safe(path)
        if not path.is_dir() and not path.is_file():
            raise ValueError('Non-regular runtime package file')
    destination.mkdir(parents=True, mode=0o700)
    source = destination / 'source'
    source.mkdir()
    shutil.copytree(generated, source / 'generated')
    for name, data in files.items():
        target = source / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    hashes = {str(p.relative_to(source)): digest(p.read_bytes())
              for p in sorted(source.rglob('*')) if p.is_file()}
    manifest = {'sourceSha': revision, 'files': hashes,
                'gateway': gateway, 'landing': landing,
                'scope': 'local-gateway-ui', 'authority': 'session:naprawiaj-20260914'}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'stage': str(destination), 'sourceSha': revision,
                      'manifestSha256': digest((destination / 'manifest.json').read_bytes()),
                      'files': len(hashes)}))


def load_stage(destination):
    destination = safe(destination)
    manifest = json.loads((destination / 'manifest.json').read_text())
    source = destination / 'source'
    for name, expected in manifest['files'].items():
        if Path(name).is_absolute() or '..' in Path(name).parts:
            raise ValueError('Invalid manifest path')
        if digest(safe(source / name).read_bytes()) != expected:
            raise ValueError('Stage changed: ' + name)
    return manifest, source


def create(destination, suffix, port, canary=False):
    if not re.fullmatch('[a-z0-9-]{1,40}', suffix):
        raise ValueError('Invalid candidate suffix')
    manifest, source = load_stage(destination)
    name = 'glm53-gateway-' + suffix
    args = ['docker', 'create', '--name', name, '--network', 'host',
            '--hostname', manifest['gateway']['hostname'],
            '--env', 'PORT=' + str(port), '--env', 'TASKAND_BIND=127.0.0.1']
    if canary:
        state = safe(destination) / ('canary-' + suffix)
        state.mkdir(mode=0o700)
        for folder in ('log', 'vault', 'web-root'):
            (state / folder).mkdir()
        # Synthetic credential only, with no external effects or secret mounts.
        args += ['--env', 'TASKAND_AUTH_TOKEN=__GENERATE_RECOVERY_CANARY_TOKEN__',
                 '--env', 'TASKAND_LLM_API_KEY=']
        mounts = {f'/taskand/{folder}': (state / folder, False)
                  for folder in ('log', 'vault', 'web-root')}
        mounts['/taskand/genome.yaml'] = (source / 'genome.yaml', True)
    else:
        if metadata('glm53-gateway-1')['id'] != manifest['gateway']['id']:
            raise ValueError('Original gateway changed; restage')
        mounts = {}
        for mount in manifest['gateway']['mounts']:
            if mount['Type'] != 'bind':
                raise ValueError('Only observed bind mounts supported')
            mounts[mount['Destination']] = (safe(mount['Source']), not mount['RW'])
        env_mount = next((mount for mount in manifest['gateway']['mounts']
                          if mount['Destination'] == '/taskand/.env'), None)
        if env_mount is None or env_mount['Type'] != 'bind':
            raise ValueError('Existing .env mount required for production candidate')
        # Docker reads the existing env file directly; the adapter never opens
        # or prints its contents. This preserves the running credential binding.
        args += ['--env-file', str(safe(env_mount['Source']))]
        args += ['--restart', 'unless-stopped']
    mounts.update({'/app/server.py': (source / 'gateway.py', True),
                   '/app/gateway': (source / 'gateway', True),
                   '/taskand/index.html': (source / 'index.html', True),
                   '/taskand/generated': (source / 'generated', True)})
    for target, (origin, readonly) in mounts.items():
        args += ['--mount', f'type=bind,src={origin},dst={target}' + (',readonly' if readonly else '')]
    args += [manifest['gateway']['image'], 'python3', '/app/server.py']
    run(*args)
    print(json.dumps({'container': name, 'created': True, 'started': False, 'canary': canary}))


def switch(destination, suffix):
    manifest, source = load_stage(destination)
    for service in ('gateway', 'landing'):
        if metadata(f'glm53-{service}-1')['id'] != manifest[service]['id']:
            raise ValueError('Original container changed; restage')
    candidate = 'glm53-gateway-' + suffix
    info = metadata(candidate)
    mounted = {m['Destination']: m['Source'] for m in info['mounts']}
    if mounted.get('/app/gateway') != str(source / 'gateway') or info['running']:
        raise ValueError('Expected stopped qualified candidate')
    run('docker', 'create', '--name', 'glm53-landing-' + suffix,
        '--restart', 'unless-stopped', '-p', '8090:80',
        '--mount', f'type=bind,src={source / "index.html"},dst=/usr/share/nginx/html/index.html,readonly',
        manifest['landing']['image'])
    # Old containers are retained under their original names, so recovery needs
    # no reconstruction of credentials, mounts or writable container layers.
    try:
        run('docker', 'stop', '--time', '30', 'glm53-gateway-1', 'glm53-landing-1')
        run('docker', 'start', candidate, 'glm53-landing-' + suffix)
    except subprocess.CalledProcessError:
        rollback(suffix)
        raise
    print(json.dumps({'switched': True, 'rollback': f'rollback --suffix {suffix}',
                      'healthVerified': False}))


def rollback(suffix):
    for name in ('glm53-gateway-' + suffix, 'glm53-landing-' + suffix):
        subprocess.run(['docker', 'stop', '--time', '30', name], check=False, capture_output=True)
    run('docker', 'start', 'glm53-gateway-1', 'glm53-landing-1')
    print(json.dumps({'originalContainersRestarted': True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['stage', 'create', 'switch', 'rollback', 'verify'])
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--source-sha')
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--suffix', default='recovery-009')
    parser.add_argument('--port', type=int, default=8077)
    parser.add_argument('--canary', action='store_true')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Port must be 1024..65535')
    if args.action == 'stage':
        stage(args.repo, args.source_sha or '', args.destination)
    elif args.action == 'create':
        create(args.destination, args.suffix, args.port, args.canary)
    elif args.action == 'switch':
        switch(args.destination, args.suffix)
    elif args.action == 'rollback':
        rollback(args.suffix)
    else:
        manifest, _ = load_stage(args.destination)
        print(json.dumps({'verified': True, 'sourceSha': manifest['sourceSha']}))


if __name__ == '__main__':
    main()
