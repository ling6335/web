import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Article = {
  id: number
  title: string
  url: string
  created_at: string
}

type ApiError = {
  detail?: string | Array<{ msg?: string }>
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiError
    if (typeof payload.detail === 'string') return payload.detail
    const message = payload.detail?.[0]?.msg
    if (message?.includes('标题') || message?.includes('链接')) {
      return message.replace(/^Value error,\s*/, '')
    }
  } catch {
    return '请求失败，请稍后重试。'
  }
  return '请求未成功，请检查标题和链接后重试。'
}

async function fetchArticles(): Promise<Article[]> {
  const response = await fetch('/api/articles')
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as Article[]
}

function App() {
  const [articles, setArticles] = useState<Article[]>([])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formMessage, setFormMessage] = useState('')

  async function loadArticles() {
    setIsLoading(true)
    setLoadError('')
    try {
      setArticles(await fetchArticles())
    } catch {
      setLoadError('暂时无法读取清单。请确认后端正在运行，再试一次。')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadArticles()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')
    const cleanTitle = title.trim()
    const cleanUrl = url.trim()

    if (!cleanTitle) {
      setFormMessage('请填写文章标题。')
      return
    }
    if (cleanTitle.length > 200) {
      setFormMessage('标题不能超过 200 个字符。')
      return
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(cleanUrl)
    } catch {
      setFormMessage('请输入有效的 HTTP 或 HTTPS 链接。')
      return
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
      setFormMessage('请输入有效的 HTTP 或 HTTPS 链接。')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle, url: cleanUrl }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const article = (await response.json()) as Article
      setLoadError('')
      setArticles((current) => [article, ...current])
      setTitle('')
      setUrl('')
      setFormMessage('文章已加入清单。')
    } catch (error) {
      if (error instanceof TypeError) {
        setFormMessage('无法连接本地服务，请确认后端正在运行。')
      } else {
        setFormMessage(
          error instanceof Error ? error.message : '保存失败，请稍后重试。',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="拾页首页">
          <span className="brand-icon" aria-hidden="true">拾</span>
          <span>拾页</span>
        </a>
        <span className="topbar-note">留一点时间，读一点好东西</span>
        <span className="local-badge"><span aria-hidden="true" />仅保存在本地</span>
      </header>

      <main id="top" className="page-shell">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">YOUR PERSONAL READING LIST</p>
          <h1 id="page-title">把想读的，<span>一页页收好。</span></h1>
          <p className="intro-copy">遇见一篇好文章，就放进清单里。留给那个刚刚好的阅读时刻。</p>
        </section>

        <section className="add-card" aria-labelledby="form-title">
          <div className="section-heading">
            <span className="heading-mark" aria-hidden="true">＋</span>
            <h2 id="form-title">收进一篇新文章</h2>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="title">文章标题</label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={200}
              placeholder="给这篇文章起个名字"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-describedby="form-message"
              required
            />
            <label className="field-label url-label" htmlFor="url">文章链接</label>
            <div className="url-input-wrap">
              <span className="url-icon" aria-hidden="true">↗</span>
              <input
                id="url"
                name="url"
                type="url"
                maxLength={2048}
                placeholder="https://example.com/article"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                aria-describedby="form-message"
                required
              />
            </div>
            <div className="form-footer">
              <p
                id="form-message"
                className={formMessage.startsWith('文章已') ? 'form-message success' : 'form-message'}
                role="status"
                aria-live="polite"
              >
                {formMessage}
              </p>
              <button type="submit" disabled={isSubmitting}>
                <span>{isSubmitting ? '正在保存…' : '加入阅读清单'}</span>
                <span className="button-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
          </form>
        </section>

        <section className="list-section" aria-labelledby="list-title">
          <div className="list-heading">
            <div>
              <p className="eyebrow list-eyebrow">SAVED FOR LATER</p>
              <h2 id="list-title">待读文章 <span className="count-badge">{articles.length}</span></h2>
            </div>
            <span className="list-caption">好文章，值得慢慢读</span>
          </div>
          <div className="article-list" aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <p className="notice-state">正在读取文章清单…</p>
            ) : loadError ? (
              <div className="error-state" role="alert">
                <p>{loadError}</p>
                <button className="retry-button" type="button" onClick={() => void loadArticles()}>
                  重新加载
                </button>
              </div>
            ) : articles.length === 0 ? (
              <div className="empty-state">
                <p className="empty-icon" aria-hidden="true">✳</p>
                <h3>清单还是空的</h3>
                <p>把最近遇见的好文章收进来，留给以后慢慢读。</p>
              </div>
            ) : (
              articles.map((article) => (
                <article className="article-card" key={article.id}>
                  <span className="article-icon" aria-hidden="true">↗</span>
                  <div className="article-details">
                    <a
                      className="article-title"
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {article.title}
                    </a>
                    <p className="article-url">{article.url}</p>
                  </div>
                  <time className="article-date" dateTime={article.created_at}>
                    {new Date(article.created_at).toLocaleDateString('zh-CN')}
                  </time>
                </article>
              ))
            )}
          </div>
        </section>
        <footer className="page-footer"><span aria-hidden="true">✳</span> 每一页，都从一次好奇开始。</footer>
      </main>
    </div>
  )
}

export default App
