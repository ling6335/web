const form = document.querySelector('#article-form');
const titleInput = document.querySelector('#title');
const urlInput = document.querySelector('#url');
const message = document.querySelector('#form-message');
const list = document.querySelector('#article-list');
const count = document.querySelector('#article-count');
const submitButton = form.querySelector('button[type="submit"]');

function renderArticles(articles) {
  count.textContent = articles.length;
  list.replaceChildren();
  list.setAttribute('aria-busy', 'false');

  if (!articles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('p');
    icon.className = 'empty-icon';
    icon.textContent = '✳';
    const heading = document.createElement('h3');
    heading.textContent = '清单还是空的';
    const copy = document.createElement('p');
    copy.textContent = '把最近遇见的好文章收进来，留给以后慢慢读。';
    empty.append(icon, heading, copy);
    list.append(empty);
    return;
  }

  for (const article of articles) {
    const card = document.createElement('article');
    card.className = 'article-card';
    const icon = document.createElement('span');
    icon.className = 'article-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '↗';
    const details = document.createElement('div');
    details.className = 'article-details';
    const title = document.createElement('a');
    title.className = 'article-title';
    title.href = article.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = article.title;
    const url = document.createElement('p');
    url.className = 'article-url';
    url.textContent = article.url;
    details.append(title, url);
    const open = document.createElement('a');
    open.className = 'article-open';
    open.href = article.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.setAttribute('aria-label', `在新标签页打开：${article.title}`);
    open.textContent = '↗';
    card.append(icon, details, open);
    list.append(card);
  }
}

async function loadArticles() {
  list.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/articles');
    if (!response.ok) throw new Error('无法读取文章清单。请确认本地服务仍在运行，然后刷新页面。');
    renderArticles(await response.json());
  } catch (error) {
    count.textContent = '–';
    list.setAttribute('aria-busy', 'false');
    list.replaceChildren();
    const notice = document.createElement('p');
    notice.className = 'error-state';
    notice.textContent = error.message || '读取失败，请稍后重试。';
    list.append(notice);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  if (!title || !url) {
    message.textContent = '请填写文章标题和链接。';
    return;
  }
  if (!urlInput.validity.valid) {
    message.textContent = '请输入有效的文章链接。';
    urlInput.focus();
    return;
  }

  submitButton.disabled = true;
  const buttonText = submitButton.querySelector('span');
  buttonText.textContent = '正在保存…';
  try {
    const response = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url }),
    });
    const article = await response.json();
    if (!response.ok) throw new Error(article.error || '保存失败，请重试。');
    form.reset();
    titleInput.focus();
    await loadArticles();
  } catch (error) {
    message.textContent = error.message || '保存失败，请检查本地服务后重试。';
  } finally {
    submitButton.disabled = false;
    buttonText.textContent = '加入阅读清单';
  }
});

loadArticles();
