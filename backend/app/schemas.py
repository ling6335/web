from datetime import datetime, timezone
from typing import Any

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    TypeAdapter,
    field_serializer,
    field_validator,
)


_http_url_adapter = TypeAdapter(AnyHttpUrl)


class ArticleCreate(BaseModel):
    title: str
    url: str

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("标题不能为空。")
            if len(value) > 200:
                raise ValueError("标题不能超过 200 个字符。")
        return value

    @field_validator("url", mode="before")
    @classmethod
    def validate_url(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            try:
                _http_url_adapter.validate_python(value)
            except ValueError as error:
                raise ValueError("请输入有效的 HTTP 或 HTTPS 链接。") from error
        return value


class ArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    url: str
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
