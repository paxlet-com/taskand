import copy
import json
import unittest
from unittest.mock import patch

from gateway.handlers.mesh import MeshError, handle_mesh, peer_url, projection


def catalog():
    return {
        "ok": True,
        "processes": [
            {
                "uri": "proc://taskand.dev/monitor/cpu/v1",
                "status": "active",
                "hash": "sha256:" + "a" * 64,
            },
            {"uri": "proc://taskand.dev/monitor/cpu/v2", "status": "candidate"},
        ],
    }


class MeshTests(unittest.TestCase):
    def test_graph_and_measured_not_invented_metrics(self):
        report = projection(
            catalog(), {"ok": True, "peers": ["https://peer.example:8077"]}
        )
        self.assertEqual(report["counts"]["processes"], 2)
        self.assertEqual(report["counts"]["organisms"], 1)
        self.assertIsNone(report["counts"]["onlinePeers"])
        self.assertEqual(
            [m["value"] for m in report["metrics"]], [50.0, 50.0, 100.0, None, None]
        )
        self.assertEqual(report["authority"], "NONE")
        self.assertFalse(report["remoteExecutionVerified"])
        nodes = {n["id"]: n for n in report["nodes"]}
        for edge in report["edges"]:
            self.assertIn(edge["source"], nodes)
            self.assertIn(edge["target"], nodes)
        peer = next(n for n in nodes.values() if n["kind"] == "peer")
        self.assertEqual(peer["state"], "UNOBSERVED")
        self.assertIsNone(peer["lastSeen"])

    def test_empty_denominator_is_unknown_not_success(self):
        result = projection({"ok": True, "processes": []}, {"ok": True, "peers": []})
        self.assertTrue(all(m["value"] is None for m in result["metrics"]))

    def test_private_fields_are_not_projected(self):
        source = catalog()
        source["processes"][0].update(token="test-only-private-token", prompt="private-prompt")
        result = json.dumps(projection(source, {"ok": True, "peers": []}))
        self.assertNotIn("test-only-private-token", result)
        self.assertNotIn("private-prompt", result)

    def test_does_not_mutate_input(self):
        source = catalog()
        before = copy.deepcopy(source)
        projection(source, {"ok": True, "peers": []})
        self.assertEqual(source, before)

    def test_invalid_registry_fails_closed(self):
        for source in (
            {},
            {"ok": False},
            {"ok": True, "processes": None},
            {"ok": True, "processes": [{}]},
            {"ok": True, "processes": catalog()["processes"] * 501},
        ):
            with self.subTest(source_type=type(source)), self.assertRaises(MeshError):
                projection(source, {"ok": True, "peers": []})

    def test_duplicate_uri_and_unknown_state_rejected(self):
        source = catalog()
        source["processes"].append(source["processes"][0])
        with self.assertRaises(MeshError):
            projection(source, {"ok": True, "peers": []})
        source = catalog()
        source["processes"][0]["status"] = "anything"
        with self.assertRaises(MeshError):
            projection(source, {"ok": True, "peers": []})

    def test_peer_url_credential_and_injection_boundaries(self):
        for url in (
            "http://user:pass@host",
            "http://host?token=secret",
            "http://host/#secret",
            "http://host/private",
            "file:///tmp/x",
            "http://host:70000",
            "http://host\n",
            "http://<script>",
            None,
        ):
            with self.subTest(url=url), self.assertRaises(MeshError):
                peer_url(url)
        self.assertEqual(
            peer_url("https://EXAMPLE.org:8077/"), "https://example.org:8077"
        )
        self.assertEqual(peer_url("http://[::1]:8077"), "http://[::1]:8077")

    def test_peers_bounded_deduplicated_not_fetched(self):
        with patch(
            "socket.create_connection", side_effect=AssertionError("remote probe")
        ):
            report = projection(
                catalog(), {"ok": True, "peers": ["http://peer/", "http://peer"]}
            )
        self.assertEqual(report["counts"]["configuredPeers"], 1)
        with self.assertRaises(MeshError):
            projection(catalog(), {"ok": True, "peers": ["http://peer"] * 129})

    def test_endpoint_authorization_before_any_registry_access(self):
        with (
            patch("gateway.handlers.mesh.require_grant", return_value=None),
            patch("gateway.handlers.mesh.registry") as registry,
        ):
            handle_mesh(object(), {})
            registry.assert_not_called()

    def test_endpoint_only_uses_read_queries_and_redacts_failure(self):
        from types import SimpleNamespace

        responses = []
        handler = SimpleNamespace(_send=lambda *args: responses.append(args))
        with (
            patch("gateway.handlers.mesh.require_grant", return_value={"name": "test"}),
            patch(
                "gateway.handlers.mesh.registry",
                side_effect=[catalog(), {"ok": True, "peers": []}],
            ) as query,
        ):
            handle_mesh(handler, {})
            self.assertEqual(
                [c.args[0] for c in query.call_args_list], ["list", "peers"]
            )
        self.assertEqual(responses[-1][0], 200)
        with (
            patch("gateway.handlers.mesh.require_grant", return_value={"name": "test"}),
            patch(
                "gateway.handlers.mesh.registry",
                return_value={"ok": False, "error": "secret-sentinel"},
            ),
        ):
            handle_mesh(handler, {})
        self.assertEqual(responses[-1][0], 503)
        self.assertNotIn("secret-sentinel", json.dumps(responses))


class BrowserPilotTests(unittest.TestCase):
    def test_dashboard_and_observer_flow_in_isolated_browser(self):
        import importlib.util
        import threading
        from contextlib import ExitStack
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from gateway import GatewayHTTPHandler, ThreadingHTTPServer
        from gateway.context import Store

        if (
            importlib.util.find_spec("playwright") is None
            or not Path("/usr/bin/google-chrome").exists()
        ):
            self.skipTest("Isolated browser dependency unavailable")
        from playwright.sync_api import sync_playwright

        root = Path(__file__).resolve().parents[1]
        with (
            TemporaryDirectory(prefix="taskand-browser-pilot-") as directory,
            ExitStack() as stack,
        ):
            store = Store(Path(directory) / "context")

            def auth(headers):
                if headers.get("Authorization") == "Bearer synthetic-denied":
                    return True, {"name": "denied", "role": "test", "allowed_uris": [], "allowed_actions": []}
                if headers.get("Authorization") != "Bearer synthetic-pilot":
                    return False, None
                return True, {
                    "name": "pilot",
                    "role": "test",
                    "allowed_uris": ["*"],
                    "allowed_actions": ["*"],
                }

            for name in (
                "gateway.check_auth",
                "gateway.auth.check_auth",
                "gateway.handlers.context.check_auth",
            ):
                stack.enter_context(patch(name, auth))
            for name in (
                "gateway.default_store",
                "gateway.handlers.context.default_store",
                "gateway.handlers.observers.default_store",
            ):
                stack.enter_context(patch(name, return_value=store))
            stack.enter_context(
                patch(
                    "gateway.handlers.mesh.registry",
                    side_effect=lambda action, *a, **kw: (
                        catalog()
                        if action == "list"
                        else {"ok": True, "peers": ["https://peer.example:8077"]}
                    ),
                )
            )
            chat = stack.enter_context(patch("gateway.utils.registry", return_value={"ok": True, "reply": "synthetic-answer"}))
            stack.enter_context(patch("gateway.handlers.chat.log_event"))
            server = ThreadingHTTPServer(("127.0.0.1", 0), GatewayHTTPHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            stack.callback(server.server_close)
            stack.callback(server.shutdown)
            with sync_playwright() as runtime:
                browser = runtime.chromium.launch(
                    executable_path="/usr/bin/google-chrome",
                    headless=True,
                    chromium_sandbox=True,
                )
                try:
                    context = browser.new_context(
                        viewport={"width": 1200, "height": 900}
                    )
                    errors = []
                    requests = []
                    held = []
                    behavior = {"kind": "gateway"}

                    def route(request):
                        url = request.request.url
                        if url == "http://127.0.0.1:8090/":
                            return request.fulfill(
                                body=(root / "index.html").read_text(),
                                content_type="text/html",
                            )
                        if url.startswith("http://127.0.0.1:8077/api/"):
                            requests.append({"url": url, "headers": request.request.headers, "method": request.request.method})
                            if behavior["kind"] == "network":
                                return request.abort()
                            if behavior["kind"] == "hold":
                                held.append(request)
                                return
                            if behavior["kind"] == "response":
                                return request.fulfill(status=behavior["status"], body=behavior["body"], content_type="application/json")
                            response = request.fetch(
                                url=url.replace(
                                    ":8077/", ":" + str(server.server_port) + "/", 1
                                )
                            )
                            return request.fulfill(response=response)
                        return request.abort()

                    context.route("**/*", route)
                    page = context.new_page()
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto("http://127.0.0.1:8090/")
                    self.assertEqual(page.locator('#mode option').evaluate_all('(options) => options.map(o => o.value)'), ['compile', 'plan', 'chat'])
                    with self.subTest("missing token is a local failure with no API call"):
                        page.fill("#msg", "synthetic status")
                        page.select_option("#mode", "chat")
                        page.click("#send")
                        self.assertIn("Podaj token API", page.locator("#out").inner_text())
                        page.wait_for_timeout(600)
                        self.assertEqual(requests, [])
                        self.assertEqual(chat.call_count, 0)
                    for token, message in (("synthetic-invalid", "401:"), ("synthetic-denied", "403:")):
                        with self.subTest("real gateway rejects token or grant", credential_case=token):
                            page.fill("#token", token)
                            before = len(requests)
                            page.click("#send")
                            page.wait_for_function("text => document.querySelector('#out').textContent.includes(text)", arg=message)
                            self.assertIn(message, page.locator("#authStatus").inner_text())
                            self.assertEqual(chat.call_count, 0)
                            self.assertEqual([r["url"] for r in requests[before:]], ["http://127.0.0.1:8077/api/chat"])
                            self.assertNotIn(token, page.locator("body").inner_text())
                    page.fill("#token", "synthetic-pilot")
                    with self.subTest("real form sends grant-bound request and reads result"):
                        page.click("#send")
                        page.wait_for_function("document.querySelector('#out').textContent.includes('synthetic-answer')")
                        page.wait_for_function("!document.querySelector('#send').disabled")
                        self.assertEqual(chat.call_count, 1)
                        sent = next(r for r in requests if r["url"].endswith("/api/chat") and r["headers"].get("authorization") == "Bearer synthetic-pilot")
                        self.assertEqual(sent["method"], "POST")
                        self.assertNotIn("synthetic-pilot", sent["url"])
                        self.assertTrue(page.locator("#request").inner_text().startswith("urn:uuid:"))

                    for status, body, code in (
                        (401, '{"error":"private-error-sentinel"}', "UNAUTHORIZED"),
                        (403, '{"error":"private-error-sentinel"}', "FORBIDDEN"),
                        (503, '{"error":"private-error-sentinel"}', "SERVER"),
                        (504, '{"error":"private-error-sentinel"}', "TIMEOUT"),
                        (400, '{"error":"private-error-sentinel"}', "HTTP"),
                        (200, "not JSON: private-error-sentinel", "RESPONSE"),
                        (200, "null", "RESPONSE"),
                    ):
                        with self.subTest("bounded safe failure classification", status=status, code=code):
                            behavior.update(kind="response", status=status, body=body)
                            result = page.evaluate("request('/api/context').catch(e => ({code:e.code,message:e.message}))")
                            self.assertEqual(result["code"], code)
                            self.assertNotIn("private-error-sentinel", result["message"])
                    with self.subTest("network error and timeout are not authentication failures"):
                        behavior["kind"] = "network"
                        self.assertEqual(page.evaluate("request('/api/context').catch(e => e.code)"), "NETWORK")
                        behavior["kind"] = "hold"
                        self.assertEqual(page.evaluate("request('/api/context', undefined, 30).catch(e => e.code)"), "TIMEOUT")
                        held.pop().abort()
                        self.assertEqual(page.evaluate("pendingRequests.size"), 0)
                    behavior["kind"] = "gateway"
                    with self.subTest("actual gateway CORS preflight permits bearer header"):
                        preflight = context.request.fetch(
                            f"http://127.0.0.1:{server.server_port}/api/chat",
                            method="OPTIONS",
                            headers={"Origin": "http://127.0.0.1:8090", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"},
                        )
                        self.assertEqual(preflight.status, 204)
                        self.assertEqual(preflight.headers.get("access-control-allow-origin"), "http://127.0.0.1:8090")
                        self.assertIn("Authorization", preflight.headers["access-control-allow-headers"])
                        denied_origin = context.request.fetch(f"http://127.0.0.1:{server.server_port}/api/chat", method="OPTIONS", headers={"Origin": "http://untrusted.invalid"})
                        self.assertNotIn("access-control-allow-origin", denied_origin.headers)
                    page.click("#meshRefresh")
                    page.wait_for_function(
                        "document.querySelector('#metricRows').children.length === 5"
                    )
                    self.assertIn("nieznane", page.locator("#metricRows").inner_text())
                    self.assertEqual(page.locator("#network circle").count(), 3)
                    self.assertEqual(page.locator("#radar circle").count(), 3)
                    page.click("#observerPilot")
                    page.wait_for_function(
                        "document.querySelector('#observerOut').textContent.includes('WAIT_FOR_HUMAN_DECISION')"
                    )
                    self.assertEqual(len(store.list("pilot", "observer_plan")), 1)
                    self.assertEqual(len(store.list("pilot", "observer_receipt")), 1)
                    page.click("#observerNext")
                    self.assertEqual(page.input_value("#mode"), "compile")
                    self.assertTrue(page.input_value("#refs").startswith("urn:uuid:"))
                    self.assertEqual(page.evaluate("localStorage.length"), 0)
                    self.assertEqual(page.evaluate("sessionStorage.length"), 0)
                    with self.subTest("logout clears private state and aborts pending transport"):
                        page.check("#meshLive")
                        # Deliberately non-cooperative transport: a late success must
                        # be rejected even when it ignores the abort signal.
                        page.evaluate("""() => {
                            window.originalFetch=window.fetch;
                            window.fetch=(_url, options)=>new Promise(resolve=>{
                                window.lateSignal=options.signal;window.lateResolve=resolve;
                            });
                        }""")
                        page.evaluate("() => { window.lateMesh=refreshMesh(); }")
                        page.wait_for_function("Boolean(window.lateResolve)")
                        page.click("#logout")
                        self.assertTrue(page.evaluate("window.lateSignal.aborted"))
                        self.assertEqual(page.input_value("#token"), "")
                        self.assertEqual(page.input_value("#msg"), "")
                        self.assertEqual(page.input_value("#refs"), "")
                        self.assertFalse(page.is_checked("#meshLive"))
                        self.assertTrue(page.is_disabled("#observerNext"))
                        self.assertEqual(page.locator("#network circle").count(), 0)
                        self.assertEqual(page.locator("#metricRows tr").count(), 0)
                        self.assertEqual(page.locator("#request").inner_text(), "")
                        page.evaluate("""() => {
                            window.lateResolve(new Response(JSON.stringify({private:'late-private-sentinel'})));
                            window.fetch=window.originalFetch;
                        }""")
                        page.evaluate("window.lateMesh")
                        self.assertIn("Wylogowano lokalnie", page.locator("#authStatus").inner_text())
                        self.assertNotIn("late-private-sentinel", page.locator("body").inner_text())
                        self.assertEqual(page.locator("#meshStatus").inner_text(), "Brak obserwacji w bieżącej sesji.")
                        self.assertEqual(page.evaluate("localStorage.length + sessionStorage.length"), 0)
                    with self.subTest("state polling does not overlap and logout does not retry POST"):
                        page.fill("#token", "synthetic-pilot")
                        page.evaluate("""() => {
                            window.pollCalls=[];
                            window.fetch=(url, options)=>new Promise((_resolve,reject)=>{
                                window.pollCalls.push(url);
                                options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
                            });
                            window.pendingSubmit=submit('/api/chat',{message:'synthetic-delayed'}).catch(e=>e.code);
                        }""")
                        page.wait_for_timeout(1700)
                        calls = page.evaluate("window.pollCalls")
                        self.assertEqual(sum('/api/chat' in url for url in calls), 1)
                        self.assertEqual(sum('/api/state?' in url for url in calls), 1)
                        page.click("#logout")
                        self.assertEqual(page.evaluate("window.pendingSubmit"), "SESSION_CHANGED")
                        self.assertEqual(page.locator("#out").inner_text(), "Brak danych w bieżącej sesji.")
                        self.assertEqual(page.locator("#state").inner_text(), "Brak aktywnego żądania")
                        self.assertEqual(page.evaluate("window.pollCalls.length"), 2)
                        page.evaluate("() => { window.fetch=window.originalFetch; }")
                    page.set_viewport_size({"width": 390, "height": 844})
                    self.assertLessEqual(
                        page.evaluate("document.documentElement.scrollWidth"), 390
                    )
                    self.assertEqual(errors, [])
                finally:
                    browser.close()


if __name__ == "__main__":
    unittest.main()
