"""Real MCP sessions, process-boundary proofs and durable effect receipts."""
import asyncio
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location('mcp_control', ROOT/'packages/taskand-mcp-control/control.py')
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)
from gateway.handlers.mcp_control import authorize, URI


class ControlTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.artifacts = self.root/'artifacts'; self.artifacts.mkdir()
        self.fixture = ROOT/'tests/fixtures/mcp_control_server.py'
        self.profiles = self.root/'profiles.json'
        self.profile = {'transport':'stdio','actors':['alice','bob'], 'command':sys.executable,
                        'args':[str(self.fixture),str(self.artifacts)],
                        'files':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(sys.executable),self.fixture]}}
        self.profiles.write_text(json.dumps({'fixture':self.profile}))
        self.env = {'TASKAND_MCP_STATE':str(self.root/'state'), 'TASKAND_MCP_PROFILES':str(self.profiles),
                    'TASKAND_MCP_KEY':'test-only-proof-key-not-a-credential-12345', 'TASKAND_MCP_PYTHON':sys.executable}
        patcher = patch.dict(os.environ,self.env); patcher.start(); self.addCleanup(patcher.stop)
        self.c = control.Control('alice'); self.addCleanup(self.c.close)

    async def prepared(self, tool='sum_report', server='reports'):
        await self.c.run('register',{'server':server,'profile':'fixture'})
        found = await self.c.run('discover',{'server':server})
        t = next(t for t in found['tools'] if t['name']==tool)
        data = {'server':server,'tool':tool,'schemaPin':t['schemaPin']}
        await self.c.run('admit',data)
        return data

    def sign(self, action, data):
        payload={'uri':URI,'actor':'alice','action':action,'data':data,'expires':time.time()+50,'nonce':uuid.uuid4().hex}
        return {'payload':payload,'signature':hmac.new(self.env['TASKAND_MCP_KEY'].encode(),control.canonical(payload).encode(),hashlib.sha256).hexdigest()}

    async def test_real_stdio_report_exactly_once_and_restart_receipt(self):
        data=await self.prepared(); data.update(runId='one',arguments={'values':[350,480]})
        result=await self.c.run('call',data)
        self.assertEqual(result['state'],'SUCCEEDED',result)
        self.assertEqual(json.loads((self.artifacts/'report.json').read_text()),{'total':830})
        again=control.Control('alice')
        try:
            self.assertEqual((await again.run('call',data))['state'],'SUCCEEDED')
        finally: again.close()
        self.assertEqual((self.artifacts/'count').read_text(),'1')
        with self.assertRaisesRegex(control.Rejected,'RUN_ID_CONFLICT'):
            await self.c.run('call',{**data,'arguments':{'values':[1]}})

    async def test_unknown_effect_not_retried(self):
        data=await self.prepared('fail_after_write');data.update(runId='unknown',arguments={})
        result=await self.c.run('call',data)
        self.assertEqual(result['state'],'OUTCOME_UNKNOWN',result)
        self.assertFalse(result['outcomeKnown'])
        stamp=(self.artifacts/'uncertain').stat().st_mtime_ns
        self.assertEqual((await self.c.run('call',data))['state'],'OUTCOME_UNKNOWN')
        self.assertEqual((self.artifacts/'uncertain').stat().st_mtime_ns,stamp)

    async def test_cross_actor_isolation_and_duplicate_names(self):
        data=await self.prepared()
        bob=control.Control('bob')
        try:
            self.assertEqual((await bob.run('list',{}))['servers'],[])
            with self.assertRaisesRegex(control.Rejected,'SERVER_NOT_FOUND'):
                await bob.run('discover',{'server':'reports'})
            await bob.run('register',{'server':'reports','profile':'fixture'})
            found=await bob.run('discover',{'server':'reports'})
            self.assertFalse(any(t['admitted'] for t in found['tools']))
        finally:bob.close()
        self.assertEqual((await self.c.run('list',{}))['servers'][0]['id'],'reports')

    async def test_schema_pin_admission_and_argument_validation(self):
        data=await self.prepared()
        for label,extra,error in [('drift',{'schemaPin':'bad'},'TOOL_SCHEMA_CHANGED'),
                                  ('args',{'arguments':{'values':'bad'}},'ARGUMENT_SCHEMA_INVALID')]:
            result=await self.c.run('call',{**data,'runId':label,'arguments':{'values':[1]},**extra})
            self.assertEqual(result['state'],'REJECTED')
            self.assertEqual(result['result']['errorType'],error)
        self.assertFalse((self.artifacts/'report.json').exists())
        self.c.db.execute('DELETE FROM tools');self.c.db.commit()
        result=await self.c.run('call',{**data,'runId':'unadmitted','arguments':{'values':[1]}})
        self.assertEqual(result['result']['errorType'],'TOOL_NOT_ADMITTED')

    async def test_configuration_cas_disable_profile_and_file_drift(self):
        data=await self.prepared()
        await self.c.run('configure',{'server':'reports','revision':1,'enabled':False})
        with self.assertRaisesRegex(control.Rejected,'CONFIGURATION_CONFLICT'):
            await self.c.run('configure',{'server':'reports','revision':1,'enabled':True})
        result=await self.c.run('call',{**data,'runId':'disabled','arguments':{'values':[1]}})
        self.assertEqual(result['result']['errorType'],'SERVER_DISABLED')
        await self.c.run('configure',{'server':'reports','revision':2,'enabled':True})
        self.profile['args']=['changed'];self.profiles.write_text(json.dumps({'fixture':self.profile}))
        with self.assertRaisesRegex(control.Rejected,'PROFILE_CHANGED'):
            await self.c.run('discover',{'server':'reports'})
        self.profile['args']=[str(self.fixture),str(self.artifacts)]
        self.profiles.write_text(json.dumps({'fixture':self.profile}))
        await self.c.run('configure',{'server':'reports','revision':3,'enabled':True,'profile':'fixture'})
        found=await self.c.run('discover',{'server':'reports'})
        self.assertFalse(any(t['admitted'] for t in found['tools']))

    async def test_invalid_paths_and_dynamic_command_rejected(self):
        for server in ['../escape','bad/instance','']:
            with self.assertRaises(control.Rejected):await self.c.run('register',{'server':server,'profile':'fixture'})
        with self.assertRaisesRegex(control.Rejected,'UNKNOWN_FIELDS'):
            await self.c.run('register',{'server':'x','profile':'fixture','command':'sh'})
        self.profile['actors']=[];self.profiles.write_text(json.dumps({'fixture':self.profile}))
        with self.assertRaisesRegex(control.Rejected,'PROFILE_DENIED'):
            await self.c.run('register',{'server':'x','profile':'fixture'})

    async def test_running_receipt_then_abandoned_receipt(self):
        with self.c.db:self.c.db.execute('INSERT INTO runs VALUES(?,?,?,?,?,?)',('alice','running','h','RUNNING',None,time.time()))
        with self.c.lock('run','running'):
            self.assertEqual(self.c.receipt('running')['state'],'RUNNING')
        self.assertEqual(self.c.receipt('running')['state'],'OUTCOME_UNKNOWN')

    async def test_proof_authentication_replay_and_unsigned_uri(self):
        signed=self.sign('list',{});p=control.envelope(signed);self.c.consume(p)
        with self.assertRaisesRegex(control.Rejected,'PROOF_REPLAY'):self.c.consume(p)
        signed['payload']['actor']='bob'
        with self.assertRaisesRegex(control.Rejected,'INVALID_PROOF'):control.envelope(signed)
        result=subprocess.run(['node',str(ROOT/'generated/mcp/control/taskand.dev/v1/bin.mjs')],input='{}',text=True,capture_output=True,env={**os.environ,**self.env},timeout=10)
        self.assertEqual(json.loads(result.stdout)['errorType'],'GATEWAY_PROOF_REQUIRED',result.stderr)

    async def test_gateway_action_grants_and_server_identity(self):
        class Handler:
            def _send(self,*args):self.response=args
        h=Handler();u={'name':'alice','allowed_uris':[URI],'allowed_actions':['call','mcp:list']}
        self.assertIsNone(authorize(h,u,{'action':'register','data':{}}));self.assertEqual(h.response[0],403)
        signed=authorize(h,u,{'action':'list','data':{}})
        self.assertEqual(control.envelope(signed)['actor'],'alice')
        self.assertIsNone(authorize(h,u,{'action':'list','actor':'bob'}))

    async def test_streamable_http_server(self):
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        proc=subprocess.Popen([sys.executable,str(self.fixture),str(self.artifacts),str(port)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    with socket.create_connection(('127.0.0.1',port),timeout=.1):break
                except OSError:await asyncio.sleep(.05)
            self.profiles.write_text(json.dumps({'http':{'actors':['alice'],'transport':'http','url':f'http://127.0.0.1:{port}/mcp'}}))
            await self.c.run('register',{'server':'http','profile':'http'})
            found=await self.c.run('discover',{'server':'http'})
            self.assertIn('sum_report',[t['name'] for t in found['tools']])
        finally:
            proc.terminate();proc.wait(timeout=5)


if __name__ == '__main__':unittest.main(verbosity=2)
