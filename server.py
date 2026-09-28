import argparse
import json
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DEFAULT_DB = ROOT / "data" / "reading_list.sqlite3"
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}


def initialize_database(db_path):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
            """
        )


def create_handler(db_path):
    class ReadingListHandler(BaseHTTPRequestHandler):
        def send_json(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/api/articles":
                with sqlite3.connect(db_path) as connection:
                    connection.row_factory = sqlite3.Row
                    rows = connection.execute(
                        "SELECT id, title, url, created_at FROM articles ORDER BY id DESC"
                    ).fetchall()
                return self.send_json(200, [dict(row) for row in rows])

            static_file = STATIC_FILES.get(self.path)
            if static_file:
                filename, content_type = static_file
                body = (STATIC_DIR / filename).read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                return self.wfile.write(body)

            self.send_json(404, {"error": "Not found"})

        def do_POST(self):
            if self.path != "/api/articles":
                return self.send_json(404, {"error": "Not found"})

            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 1 or length > 16_384:
                    raise ValueError
                payload = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                return self.send_json(400, {"error": "请提交有效的文章标题和链接。"})

            if not isinstance(payload, dict):
                return self.send_json(400, {"error": "请提交有效的文章标题和链接。"})

            title = payload.get("title")
            url = payload.get("url")
            if not isinstance(title, str) or not isinstance(url, str):
                return self.send_json(400, {"error": "请提交有效的文章标题和链接。"})

            title = title.strip()
            url = url.strip()
            try:
                parsed_url = urlparse(url)
                valid_url = parsed_url.scheme in ("http", "https") and bool(parsed_url.hostname)
            except ValueError:
                valid_url = False
            if not title or len(title) > 200 or len(url) > 2048 or not valid_url:
                return self.send_json(400, {"error": "标题不能为空，链接须为有效的 http 或 https 地址。"})

            with sqlite3.connect(db_path) as connection:
                cursor = connection.execute(
                    "INSERT INTO articles (title, url) VALUES (?, ?)", (title, url)
                )
                connection.row_factory = sqlite3.Row
                article = connection.execute(
                    "SELECT id, title, url, created_at FROM articles WHERE id = ?",
                    (cursor.lastrowid,),
                ).fetchone()
            self.send_json(201, dict(article))

        def log_message(self, format_string, *args):
            print(f"{self.address_string()} - {format_string % args}")

    return ReadingListHandler


def main():
    parser = argparse.ArgumentParser(description="本地个人阅读清单")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()

    initialize_database(args.db)
    server = ThreadingHTTPServer((args.host, args.port), create_handler(args.db))
    print(f"阅读清单已启动：http://{args.host}:{server.server_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
