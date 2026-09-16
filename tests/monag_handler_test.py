import unittest
from unittest.mock import patch, MagicMock
from gateway.handlers.monag_handler import handle_monag_status, handle_monag_resume, handle_notify
from gateway.router import dispatch

class FakeRequestHandler:
    def __init__(self):
        self.status = None
        self.body = None

    def _send(self, status: int, body: dict):
        self.status = status
        self.body = body

class MonagHandlerTests(unittest.TestCase):
    def test_handle_monag_status_success(self):
        handler = FakeRequestHandler()
        with patch("gateway.handlers.monag_handler._run_monag_json") as mock_run:
            mock_run.return_value = {"ok": True, "data": {"status": "operational"}}
            handle_monag_status(handler, {})
            self.assertEqual(handler.status, 200)
            self.assertTrue(handler.body["ok"])

    def test_handle_monag_status_failure(self):
        handler = FakeRequestHandler()
        with patch("gateway.handlers.monag_handler._run_monag_json") as mock_run:
            mock_run.return_value = {"ok": False, "error": "failed"}
            handle_monag_status(handler, {})
            self.assertEqual(handler.status, 500)
            self.assertFalse(handler.body["ok"])

    def test_handle_monag_resume_success(self):
        handler = FakeRequestHandler()
        with patch("gateway.handlers.monag_handler._run_monag_json") as mock_run:
            mock_run.return_value = {"ok": True, "data": {"checkouts": []}}
            handle_monag_resume(handler, {})
            self.assertEqual(handler.status, 200)
            self.assertTrue(handler.body["ok"])

    def test_handle_notify(self):
        handler = FakeRequestHandler()
        with patch("shutil.which", return_value="/usr/bin/notify-send"), \
             patch("subprocess.run") as mock_run:
            handle_notify(handler, {
                "title": "Test Title",
                "message": "Test Message",
                "urgency": "normal"
            })
            self.assertEqual(handler.status, 200)
            self.assertTrue(handler.body["ok"])
            self.assertTrue(handler.body["desktopNotificationSent"])
            self.assertEqual(handler.body["notification"]["title"], "Test Title")
            mock_run.assert_called_once()

    def test_router_dispatch(self):
        handler = FakeRequestHandler()
        with patch("gateway.handlers.monag_handler._run_monag_json", return_value={"ok": True, "data": {}}):
            dispatch("GET", "/api/monag/status", handler, {})
            self.assertEqual(handler.status, 200)

            dispatch("GET", "/api/monag/resume", handler, {})
            self.assertEqual(handler.status, 200)

        with patch("shutil.which", return_value=None):
            dispatch("POST", "/api/notify", handler, {"title": "A", "message": "B"})
            self.assertEqual(handler.status, 200)
            self.assertFalse(handler.body["desktopNotificationSent"])

if __name__ == "__main__":
    unittest.main()
