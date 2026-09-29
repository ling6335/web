from collections.abc import Generator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .database import Base, DEFAULT_DATABASE_URL, create_session_factory
from .models import Article
from .schemas import ArticleCreate, ArticleRead


def create_app(database_url: str = DEFAULT_DATABASE_URL) -> FastAPI:
    engine, session_factory = create_session_factory(database_url)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        Base.metadata.create_all(bind=engine)
        yield
        engine.dispose()

    application = FastAPI(title="拾页 · 个人阅读清单", lifespan=lifespan)

    def get_db() -> Generator[Session, None, None]:
        with session_factory() as session:
            yield session

    @application.get("/api/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/api/articles", response_model=list[ArticleRead])
    def list_articles(db: Annotated[Session, Depends(get_db)]) -> list[Article]:
        statement = select(Article).order_by(Article.created_at.desc(), Article.id.desc())
        return list(db.scalars(statement))

    @application.post("/api/articles", response_model=ArticleRead, status_code=201)
    def create_article(
        article_data: ArticleCreate, db: Annotated[Session, Depends(get_db)]
    ) -> Article:
        article = Article(title=article_data.title, url=article_data.url)
        db.add(article)
        db.commit()
        db.refresh(article)
        return article

    return application


app = create_app()
