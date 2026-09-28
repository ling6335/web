import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import create_handler, initialize_database


class ReadingListApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "articles.sqlite3"
        initialize_database(self.db_path)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(self.db_path))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp_dir.cleanup()

    def request(self, path, method="GET", payload=None):
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(self.base_url + path, data=data, method=method)
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            response = urlopen(request)
        except HTTPError as error:
            return error.code, json.loads(error.read())
        with response:
            body = response.read()
            if response.headers.get_content_type() == "application/json":
                return response.status, json.loads(body)
            return response.status, body

    def test_create_list_and_persist_after_database_reopen(self):
        status, created = self.request(
            "/api/articles",
            "POST",
            {"title": "阅读指南", "url": "https://example.com/reading"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(created["title"], "阅读指南")
        self.assertEqual(created["url"], "https://example.com/reading")

        self.assertEqual(self.request("/api/articles"), (200, [created]))
        initialize_database(self.db_path)
        self.assertEqual(self.request("/api/articles"), (200, [created]))

    def test_rejects_invalid_article(self):
        status, payload = self.request(
            "/api/articles", "POST", {"title": "   ", "url": "javascript:alert(1)"}
        )
        self.assertEqual(status, 400)
        self.assertIn("error", payload)

    def test_serves_frontend(self):
        status, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("拾页".encode("utf-8"), body)


if __name__ == "__main__":
    unittest.main()
