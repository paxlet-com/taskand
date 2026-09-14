"""Offline contract tests; not a claim that a Docker/VM deployment passed."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import unittest

HERE = Path(__file__).resolve().parent


class PortableProfileTests(unittest.TestCase):
    def setUp(self):
        self.profile = json.loads((HERE / 'compose.yaml').read_text())
        self.gateway = self.profile['services']['gateway']
        self.dockerfile = (HERE / 'Dockerfile').read_text()

    def test_only_opt_in_gateway_without_host_authority(self):
        self.assertEqual(set(self.profile['services']), {'gateway', 'ingress'})
        for key in ('privileged', 'network_mode', 'pid', 'devices', 'build'):
            self.assertNotIn(key, self.gateway)
        self.assertNotIn('docker.sock', json.dumps(self.profile))
        self.assertEqual(self.gateway['user'], '10001:10001')
        self.assertEqual(self.gateway['cap_drop'], ['ALL'])
        self.assertEqual(self.gateway['security_opt'], ['no-new-privileges:true'])

    def test_storage_is_explicit_and_secrets_are_not_environment_values(self):
        self.assertTrue(self.gateway['read_only'])
        data, grants = self.gateway['volumes']
        self.assertEqual(data, {'type': 'volume', 'source': 'context', 'target': '/taskand/log'})
        self.assertTrue(grants['read_only'])
        self.assertFalse(grants['bind']['create_host_path'])
        self.assertIn(':?', grants['source'])
        self.assertEqual(grants['target'], '/taskand/grants.yaml')
        self.assertEqual(set(self.gateway['environment']), {'TASKAND_BIND', 'PORT'})

    def test_network_and_resource_limits_are_bounded(self):
        self.assertNotIn('ports', self.gateway)
        self.assertEqual(self.gateway['networks'], ['api'])
        self.assertTrue(self.profile['networks']['api']['internal'])
        ingress = self.profile['services']['ingress']
        self.assertEqual(ingress['ports'], ['127.0.0.1:18077:8080'])
        self.assertEqual(ingress['networks'], ['api', 'ingress'])
        self.assertTrue(ingress['read_only'])
        self.assertEqual(ingress['user'], '10001:10001')
        self.assertEqual(ingress['cap_drop'], ['ALL'])
        self.assertNotIn('volumes', ingress)
        self.assertNotIn('environment', ingress)
        self.assertRegex(ingress['image'], r'@sha256:[0-9a-f]{64}$')
        config = ingress['entrypoint'][2]
        self.assertIn('Authorization $$http_authorization;', config)
        self.assertIn('Host $$host;', config)
        for name in ('client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'):
            self.assertIn(name + '_temp_path /tmp/', config)
        self.assertEqual(self.gateway['pids_limit'], 64)
        self.assertEqual(self.gateway['mem_limit'], '512m')
        self.assertEqual(self.gateway['cpus'], 1.0)
        self.assertEqual(self.gateway['restart'], 'no')

    def test_startup_does_not_install_packages_or_pull_images(self):
        self.assertEqual(self.gateway['pull_policy'], 'never')
        self.assertIn(':?', self.gateway['image'])
        self.assertNotIn('command', self.gateway)
        entrypoint = next(line for line in self.dockerfile.splitlines() if line.startswith('ENTRYPOINT '))
        self.assertEqual(json.loads(entrypoint.removeprefix('ENTRYPOINT ')), ['python3', '/app/server.py'])
        self.assertIn('USER 10001:10001', self.dockerfile)
        self.assertRegex(self.dockerfile.splitlines()[0], r'@sha256:[0-9a-f]{64}$')

    def test_build_does_not_copy_private_configuration_or_checkout(self):
        copies = [line for line in self.dockerfile.splitlines() if line.startswith('COPY ')]
        self.assertEqual(copies, ['COPY gateway.py /app/server.py',
                                 'COPY gateway/ /app/gateway/',
                                 'COPY generated/ /taskand/generated/'])
        ignore = (HERE / 'Dockerfile.dockerignore').read_text().splitlines()
        self.assertEqual(ignore[0], '**')
        self.assertNotIn('!**', ignore)
        self.assertIn('**/.env', ignore)
        self.assertIn('**/*.pem', ignore)




def run_smoke():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', required=True, help='Already built local sha256 image ID')
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', args.image):
        parser.error('an exact local image ID is required')
    if not args.execute:
        print(json.dumps({'status': 'PLAN_ONLY', 'effects': 'isolated synthetic Compose up/restart/down; no production data'}))
        return
    project = 'taskand-smoke-' + uuid.uuid4().hex[:16]
    fixture_token = uuid.uuid4().hex
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(token=None, body=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request('http://127.0.0.1:18077/api/context',
                                     data=json.dumps(body).encode() if body else None, headers=headers)
        try:
            with opener.open(req, timeout=3) as response:
                return response.status, json.loads(response.read(65536))
        except urllib.error.HTTPError as error:
            with error:
                return error.code, {}

    with tempfile.TemporaryDirectory(prefix=project + '-') as scratch:
        grants = Path(scratch) / 'grants.yaml'
        grants.write_text('users:\n  pilot:\n    token: ' + fixture_token +
                          '\n    role: operator\n    allowed_uris:\n'
                          '      - "proc://taskand.dev/planner/plan/v1"\n'
                          '    allowed_actions:\n      - call\n')
        grants.chmod(0o644)  # Public synthetic fixture, not a production credential.
        environment = {**os.environ, 'TASKAND_GATEWAY_IMAGE': args.image,
                       'TASKAND_GRANTS_FILE': str(grants)}

        def compose(*arguments):
            result = subprocess.run(['docker', 'compose', '-p', project, '-f', str(HERE / 'compose.yaml'),
                                     *arguments], env=environment, capture_output=True, text=True, timeout=60)
            if result.returncode:
                raise RuntimeError('Synthetic Compose failure: ' + result.stderr[-4096:])
            return result.stdout.strip()

        def ready():
            deadline = time.monotonic() + 15
            last = 'no response'
            while time.monotonic() < deadline:
                try:
                    status = request()[0]
                    last = 'HTTP ' + str(status)
                    if status == 401:
                        return
                except (OSError, urllib.error.URLError):
                    last = 'connection unavailable'
                time.sleep(0.2)
            logs = compose('logs', '--tail', '15')
            raise RuntimeError('synthetic gateway did not become ready: ' + last + '\n' + logs)

        try:
            compose('up', '-d')
            container = compose('ps', '-q', 'gateway')
            inspection = json.loads(subprocess.check_output(['docker', 'inspect', container], timeout=10))[0]
            assert inspection['Image'] == args.image
            assert inspection['Config']['User'] == '10001:10001'
            assert inspection['HostConfig']['ReadonlyRootfs']
            assert not inspection['HostConfig']['Privileged']
            ready()
            assert request('taskand-admin-key')[0] == 401
            assert request('invalid-synthetic-token')[0] == 401
            assert request(fixture_token)[0] == 200
            status, result = request(fixture_token, {'action': 'create_user_twin',
                                            'payload': {'label': 'portable smoke',
                                                        'prompts': ['Read-only fixture'], 'synthetic': True}})
            assert status == 201, status
            urn = result['object']['urn']
            compose('restart', 'gateway')
            ready()
            status, result = request(fixture_token)
            assert status == 200
            assert urn in {obj['urn'] for obj in result['objects']}
            print(json.dumps({'status': 'PASS', 'image': args.image,
                              'scope': 'synthetic Docker gateway auth and context restart',
                              'productionVerified': False}))
        finally:
            # Only this randomly named fixture project owns these disposable resources.
            compose('down', '--volumes', '--timeout', '5')


if __name__ == '__main__':
    import sys
    if '--image' in sys.argv:
        run_smoke()
    else:
        unittest.main()
