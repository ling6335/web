# 拾页 · 个人阅读清单

供单人本地使用的全栈文章清单。前端采用 React、TypeScript 和 Vite，后端采用 FastAPI、SQLAlchemy 和 SQLite。文章保存在 `backend/data/reading_list.sqlite3`，刷新页面或重启后端后仍会保留。本项目不使用外部 API、云服务或 Docker。

## 环境要求

- Python 3.10 或更高版本
- Node.js 20.19+ 或 22.12+
- npm

## 安装依赖

在项目根目录运行：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm --prefix frontend install
```

Windows PowerShell 激活虚拟环境的命令为 `.venv\Scripts\Activate.ps1`。执行下方命令时，请将 `.venv/bin/python` 替换为 `.venv\Scripts\python.exe`。

## 本地启动

在两个终端分别从项目根目录运行：

```bash
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
npm run dev
```

打开 Vite 显示的本地地址（默认 <http://127.0.0.1:5173>）。开发服务器会把 `/api` 请求代理到 `http://127.0.0.1:8000`。停止后端再重新启动，SQLite 文件和已保存的文章不会被清除。若虚拟环境尚未激活，可将后端命令中的 `.venv/bin/uvicorn` 换成 `.venv/Scripts/uvicorn.exe`（Windows）或使用 `python -m uvicorn`。

## API

- `GET /api/health`：返回 `{ "status": "ok" }`。
- `GET /api/articles`：返回文章列表，按创建时间倒序。
- `POST /api/articles`：接受 `{ "title": "文章标题", "url": "https://example.com/article" }`，成功时返回 `201` 和新记录。
- 标题会去除首尾空白且必须为 1–200 个字符；URL 必须是有效的 HTTP 或 HTTPS 地址。输入无效时返回 `422` 和可读的校验详情。
- `created_at` 由后端生成。

## 验证

后端基础测试（健康检查、添加、倒序查询、输入校验、重启应用后的 SQLite 持久化）：

```bash
python -m unittest discover -s backend/tests -v
```

生产前端构建：

```bash
npm --prefix frontend run build
```

## 范围

本版本只包含添加和查看文章，不提供登录、编辑、删除、已读标记、搜索、内容抓取或上线部署。
