(() => {
  const STORAGE_KEY = 'reading-list-v1';
  const form = document.querySelector('#article-form');
  const titleInput = document.querySelector('#article-title');
  const urlInput = document.querySelector('#article-url');
  const noteInput = document.querySelector('#article-note');
  const searchInput = document.querySelector('#search-input');
  const list = document.querySelector('#article-list');
  const emptyState = document.querySelector('#empty-state');
  const storageNotice = document.querySelector('#storage-notice');
  const filterButtons = [...document.querySelectorAll('.filter-button')];
  let activeFilter = 'all';
  let searchQuery = '';
  let storageAvailable = true;
  let articles = loadArticles();

  function loadArticles() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('Invalid saved data');
      return parsed.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.url === 'string' && typeof item.createdAt === 'string').map((item) => ({
        id: item.id,
        title: item.title.slice(0, 160),
        url: safeUrl(item.url),
        note: typeof item.note === 'string' ? item.note.slice(0, 300) : '',
        read: item.read === true,
        createdAt: item.createdAt,
      })).filter((item) => item.url);
    } catch {
      storageAvailable = false;
      return [];
    }
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function persist() {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
    } catch {
      storageAvailable = false;
      showStorageNotice('浏览器暂时无法保存更改，请检查存储空间或隐私设置。');
    }
  }

  function showStorageNotice(message) {
    storageNotice.textContent = message;
    storageNotice.hidden = false;
  }

  function displayDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '刚刚收藏';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderArticle(article) {
    const card = makeElement('article', `article-card${article.read ? ' is-read' : ''}`);
    const toggle = makeElement('button', 'read-toggle', article.read ? '✓' : '○');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', article.read ? '标记为待阅读' : '标记为已读');
    toggle.title = toggle.getAttribute('aria-label');
    toggle.addEventListener('click', () => updateArticle(article.id, { read: !article.read }));

    const content = makeElement('div', 'article-content');
    const link = makeElement('a', 'article-title', article.title);
    link.href = article.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    content.append(link);

    const meta = makeElement('div', 'article-meta');
    const domain = makeElement('span', 'article-domain');
    try {
      domain.textContent = new URL(article.url).hostname.replace(/^www\./, '');
    } catch {
      domain.textContent = '网页链接';
    }
    meta.append(domain, makeElement('span', '', '·'), makeElement('time', '', displayDate(article.createdAt)));
    content.append(meta);
    if (article.note) content.append(makeElement('p', 'article-note', article.note));

    const actions = makeElement('div', 'article-actions');
    const deleteButton = makeElement('button', 'action-button action-delete', '×');
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', `删除「${article.title}」`);
    deleteButton.title = '删除文章';
    deleteButton.addEventListener('click', () => removeArticle(article.id));
    actions.append(deleteButton);
    card.append(toggle, content, actions);
    return card;
  }

  function render() {
    const unreadCount = articles.filter((article) => !article.read).length;
    document.querySelector('#total-count').textContent = String(articles.length);
    document.querySelector('#unread-count').textContent = String(unreadCount);
    document.querySelector('#read-count').textContent = String(articles.length - unreadCount);

    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const visibleArticles = articles.filter((article) => {
      const matchesFilter = activeFilter === 'all' || (activeFilter === 'read' ? article.read : !article.read);
      const matchesQuery = !normalizedQuery || `${article.title} ${article.note} ${article.url}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    list.replaceChildren(...visibleArticles.map(renderArticle));
    document.querySelector('#visible-count').textContent = String(visibleArticles.length);
    const shouldShowEmpty = visibleArticles.length === 0;
    emptyState.classList.toggle('is-hidden', !shouldShowEmpty);
    const filtered = articles.length > 0;
    emptyState.classList.toggle('is-filtered', filtered);
    if (shouldShowEmpty && filtered) {
      emptyState.querySelector('h3').textContent = searchQuery ? '没有找到符合条件的文章' : '這個清單暫時是空的';
      emptyState.querySelector('p').textContent = searchQuery ? '試試其他關鍵詞，看看有沒有想找的內容。' : '切換篩選條件，或加入下一篇想讀的文章。';
    } else {
      emptyState.querySelector('h3').textContent = '你的下一篇好文章，就从这里开始';
      emptyState.querySelector('p').innerHTML = '把遇见的好内容收进来，<br>为未来的自己留一点阅读惊喜。';
    }
  }

  function updateArticle(id, changes) {
    articles = articles.map((article) => article.id === id ? { ...article, ...changes } : article);
    persist();
    render();
  }

  function removeArticle(id) {
    articles = articles.filter((article) => article.id !== id);
    persist();
    render();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.setCustomValidity('请输入文章标题。');
      titleInput.reportValidity();
      return;
    }
    titleInput.setCustomValidity('');
    const url = safeUrl(urlInput.value.trim());
    if (!url) {
      urlInput.setCustomValidity('请输入有效的 HTTP 或 HTTPS 链接。');
      urlInput.reportValidity();
      return;
    }
    urlInput.setCustomValidity('');
    articles.unshift({
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      url,
      note: noteInput.value.trim(),
      read: false,
      createdAt: new Date().toISOString(),
    });
    persist();
    form.reset();
    searchQuery = '';
    searchInput.value = '';
    activeFilter = 'all';
    filterButtons.forEach((button) => {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    render();
    titleInput.focus();
  });

  titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
  urlInput.addEventListener('input', () => urlInput.setCustomValidity(''));
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    render();
  });
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    render();
  }));
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      searchQuery = '';
      render();
      searchInput.blur();
    }
  });

  if (!storageAvailable) showStorageNotice('暂时无法读取本地清单，当前内容不会持久保存。');
  render();
})();
