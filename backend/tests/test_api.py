import tempfile
import unittest
from pathlib import Path
from typing import Any

from httpx import ASGITransport, AsyncClient

from backend.app.main import create_app


class ReadingListApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "articles.sqlite3"
        self.database_url = f"sqlite:///{self.database_path}"
        self.app = create_app(self.database_url)
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        self.client = AsyncClient(
            transport=ASGITransport(app=self.app), base_url="http://testserver"
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        await self.lifespan.__aexit__(None, None, None)
        self.temp_dir.cleanup()

    async def request(
        self, method: str, path: str, payload: dict[str, Any] | None = None
    ) -> tuple[int, Any]:
        response = await self.client.request(method, path, json=payload)
        return response.status_code, response.json()

    async def test_health_check(self) -> None:
        status, payload = await self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload, {"status": "ok"})

    async def test_create_and_list_articles_in_creation_order(self) -> None:
        first_status, first = await self.request(
            "POST",
            "/api/articles",
            {
                "title": "  第一篇  ",
                "url": "https://example.com/first",
                "created_at": "2000-01-01T00:00:00Z",
            },
        )
        second_status, second = await self.request(
            "POST",
            "/api/articles",
            {"title": "第二篇", "url": "http://example.com/second"},
        )

        self.assertEqual(first_status, 201)
        self.assertEqual(first["title"], "第一篇")
        self.assertEqual(first["url"], "https://example.com/first")
        self.assertNotEqual(first["created_at"], "2000-01-01T00:00:00Z")
        self.assertEqual(second_status, 201)
        self.assertEqual(
            [article["id"] for article in (await self.request("GET", "/api/articles"))[1]],
            [second["id"], first["id"]],
        )

        max_title_status, _ = await self.request(
            "POST",
            "/api/articles",
            {"title": "x" * 200, "url": "https://example.com/max-title"},
        )
        self.assertEqual(max_title_status, 201)

    async def test_rejects_invalid_titles_and_urls(self) -> None:
        invalid_articles = [
            {"title": "   ", "url": "https://example.com"},
            {"title": "x" * 201, "url": "https://example.com"},
            {"title": "有效标题", "url": "javascript:alert(1)"},
            {"title": "有效标题", "url": "https://"},
            {"title": "有效标题", "url": "/relative/path"},
            {"title": "有效标题", "url": "ftp://example.com/file"},
        ]

        for article in invalid_articles:
            with self.subTest(article=article):
                status, payload = await self.request("POST", "/api/articles", article)
                self.assertEqual(status, 422)
                self.assertTrue(payload["detail"])

        self.assertEqual(await self.request("GET", "/api/articles"), (200, []))

    async def test_articles_persist_after_app_restart(self) -> None:
        created_status, created = await self.request(
            "POST",
            "/api/articles",
            {"title": "持久化文章", "url": "https://example.com/saved"},
        )
        self.assertEqual(created_status, 201)
        await self.client.aclose()
        await self.lifespan.__aexit__(None, None, None)

        self.app = create_app(self.database_url)
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        self.client = AsyncClient(
            transport=ASGITransport(app=self.app), base_url="http://testserver"
        )
        self.assertEqual(await self.request("GET", "/api/articles"), (200, [created]))


if __name__ == "__main__":
    unittest.main()
