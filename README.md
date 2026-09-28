# 拾页 · 个人阅读清单

一个适合单人本地使用的轻量全栈阅读清单。用它保存文章标题和链接；页面通过本地 API 读写 SQLite，服务重启或页面刷新后数据仍保存在 `data/reading_list.sqlite3`。

## 环境要求

- Python 3.10 或更高版本
- 无第三方依赖，无需安装 Node.js

## 启动

在项目根目录运行：

```bash
python3 server.py
```

浏览器打开 <http://127.0.0.1:8000>。停止服务时在终端按 `Ctrl+C`。服务只绑定本机地址，不提供登录或远程部署功能。数据库首次启动时自动创建；如需使用其他数据库路径，可运行 `python3 server.py --db /path/to/reading_list.sqlite3`。端口被占用时可指定 `--port`。

## 功能与 API

- 添加文章标题与 `http://` 或 `https://` 链接
- 列表按添加时间倒序显示，刷新后从数据库重新读取
- `GET /api/articles`：列出所有文章
- `POST /api/articles`：传入 JSON `{ "title": "文章标题", "url": "https://example.com/article" }`；成功时返回 `201` 和已保存文章
- API 验证标题与链接；无效输入返回 `400`

## 验证

无需安装依赖，在项目根目录运行：

```bash
python3 -m unittest discover -s tests -v
```

测试覆盖前端服务、文章添加与读取、数据库重新初始化后的数据持久化，以及无效输入验证。
