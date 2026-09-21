import tempfile
import unittest
from unittest.mock import Mock, patch

from app.mcp_task_executor import Gateway, execute


class ExecutorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.mcp = Mock(token='test-account', url='http://localhost:8082')
        self.model = Mock(url='http://localhost:8077')
        self.catalog = {'ok': True, 'tools': [
            {'name': 'read', 'admitted': True, 'schemaPin': 'pin', 'inputSchema': {}},
            {'name': 'write', 'admitted': False, 'schemaPin': 'pin2', 'inputSchema': {}}]}
        self.call = {'ok': True, 'json': {'action': 'call', 'server': 'files', 'tool': 'read', 'arguments': {}}}
        self.complete = {'ok': True, 'json': {'action': 'complete', 'summary': 'Read back observed'}}

    def run_task(self, **kwargs):
        return execute('Read test input', ['files'], 'test-1', self.tmp.name,
                       self.mcp, self.model, **kwargs)

    def test_loop_observation_replay_and_goal_binding(self):
        self.mcp.call.side_effect = [self.catalog, {'ok': True, 'state': 'SUCCEEDED', 'result': 'observed'}]
        self.model.call.side_effect = [self.call, self.complete]
        result = self.run_task()
        self.assertEqual(result['status'], 'COMPLETED')
        self.assertEqual(result['acceptance'], 'NOT_EVALUATED')
        self.assertIn('observed', self.model.call.call_args.args[1]['prompt'])
        self.assertTrue(self.run_task()['replayed'])
        self.assertEqual(self.mcp.call.call_count, 2)
        with self.assertRaisesRegex(ValueError, 'CONFLICT'):
            execute('Different goal', ['files'], 'test-1', self.tmp.name, self.mcp, self.model)

    def test_invalid_json_regenerated_before_any_effect(self):
        self.mcp.call.side_effect = [self.catalog, {'ok': True, 'state': 'SUCCEEDED'}]
        self.model.call.side_effect = [
            {'ok': False, 'content': '{bad json'}, self.call, self.complete]
        self.assertEqual(self.run_task()['status'], 'COMPLETED')
        self.assertEqual(self.mcp.call.call_count, 2)
        self.assertEqual(self.model.call.call_count, 3)

    def test_invalid_json_retry_bounded(self):
        self.mcp.call.return_value = self.catalog
        self.model.call.return_value = {'ok': False, 'content': '{bad json'}
        self.assertEqual(self.run_task()['status'], 'MODEL_UNAVAILABLE')
        self.assertEqual(self.model.call.call_count, 3)
        self.assertEqual(self.mcp.call.call_count, 1)

    def test_transport_rejection_overrides_nested_success(self):
        response = Mock()
        response.read.return_value = b'{"ok":false,"result":{"ok":true}}'
        context = Mock()
        context.__enter__ = Mock(return_value=response)
        context.__exit__ = Mock(return_value=False)
        with patch('urllib.request.build_opener') as opener:
            opener.return_value.open.return_value = context
            result = Gateway('http://localhost:8082', 'test-account').call('test', {})
        self.assertFalse(result['ok'])

    def test_model_cannot_admit_tool(self):
        self.mcp.call.return_value = self.catalog
        self.call['json']['tool'] = 'write'
        self.model.call.return_value = self.call
        self.assertEqual(self.run_task()['status'], 'REJECTED')
        self.assertEqual(self.mcp.call.call_count, 1)

    def test_unknown_effect_stops_and_replays_without_call(self):
        self.mcp.call.side_effect = [self.catalog, TimeoutError('after dispatch')]
        self.model.call.return_value = self.call
        self.assertEqual(self.run_task()['status'], 'OUTCOME_UNKNOWN')
        self.assertTrue(self.run_task()['replayed'])
        self.assertEqual(self.model.call.call_count, 1)
        self.assertEqual(self.mcp.call.call_count, 2)

    def test_step_limit_and_no_fabricated_completion(self):
        self.mcp.call.side_effect = [self.catalog, {'ok': True, 'state': 'SUCCEEDED'}]
        self.model.call.return_value = self.call
        self.assertEqual(self.run_task(max_steps=1)['status'], 'LIMIT_REACHED')

    def test_completion_without_tool_evidence_rejected(self):
        self.mcp.call.return_value = self.catalog
        self.model.call.return_value = self.complete
        self.assertEqual(self.run_task()['status'], 'REJECTED')


if __name__ == '__main__':
    unittest.main()
