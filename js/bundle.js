/* MangaDesk Web portable bundle - generated from store.js, sources.js and app.js */
'use strict';

const KEY = 'mangadesk.web.state.v2';
const BACKUP_PREFIX = 'mangadesk.web.snapshot.';
const MAX_SNAPSHOTS = 5;

const defaultState = () => ({
  version: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  profile: { name: 'Leitor' },
  settings: {
    language: 'pt-br',
    theme: 'dark',
    accent: '#7c5cff',
    readerMode: 'vertical',
    readerFit: 'contain',
    imageQuality: 'data-saver',
    fit: 'width',
    direction: 'rtl',
    autoSnapshot: true,
    mangadexProxy: 'auto'
  },
  library: [],
  history: [],
  reading: {},
  customSources: [],
  sourceEnabled: { mangadex: true },
  ui: { lastRoute: 'home' }
});

const parse = (raw, fallback = null) => {
  try { return JSON.parse(raw); } catch { return fallback; }
};

function migrate(data) {
  const base = defaultState();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    version: 2,
    profile: { ...base.profile, ...(data.profile || {}) },
    settings: { ...base.settings, ...(data.settings || {}) },
    ui: { ...base.ui, ...(data.ui || {}) },
    sourceEnabled: { ...base.sourceEnabled, ...(data.sourceEnabled || {}) },
    library: Array.isArray(data.library) ? data.library : [],
    history: Array.isArray(data.history) ? data.history : [],
    reading: data.reading && typeof data.reading === 'object' ? data.reading : {},
    customSources: Array.isArray(data.customSources) ? data.customSources : []
  };
}

class Store extends EventTarget {
  constructor() {
    super();
    this.state = migrate(parse(localStorage.getItem(KEY)));
    this.save(false);
  }

  get() { return this.state; }

  save(snapshot = true) {
    this.state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(this.state));
    if (snapshot && this.state.settings.autoSnapshot) this.snapshotThrottled();
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  update(mutator, { snapshot = true } = {}) {
    mutator(this.state);
    this.save(snapshot);
  }

  setRoute(route) {
    this.state.ui.lastRoute = route;
    this.save(false);
  }

  addLibrary(manga) {
    const key = `${manga.source}:${manga.id}`;
    const found = this.state.library.find(x => `${x.source}:${x.id}` === key);
    if (found) return false;
    this.state.library.unshift({ ...manga, addedAt: new Date().toISOString(), favorite: false, categories: [], lastReadAt: null });
    this.save();
    return true;
  }

  removeLibrary(source, id) {
    this.state.library = this.state.library.filter(x => !(x.source === source && x.id === id));
    this.save();
  }

  toggleFavorite(source, id) {
    const item = this.state.library.find(x => x.source === source && x.id === id);
    if (item) { item.favorite = !item.favorite; this.save(); }
  }

  recordRead(manga, chapter, page = 0) {
    const now = new Date().toISOString();
    const key = `${manga.source}:${manga.id}`;
    this.state.reading[key] = {
      mangaId: manga.id, source: manga.source, title: manga.title, coverUrl: manga.coverUrl || '',
      chapterId: chapter.id, chapter: chapter.chapter || '', chapterTitle: chapter.title || '', page, readAt: now
    };
    const item = this.state.library.find(x => x.source === manga.source && x.id === manga.id);
    if (item) {
      item.lastReadAt = now;
      item.lastChapterId = chapter.id;
      item.lastChapter = chapter.chapter || '';
      item.lastChapterTitle = chapter.title || '';
    }
    this.state.history = this.state.history.filter(x => !(x.source === manga.source && x.mangaId === manga.id && x.chapterId === chapter.id));
    this.state.history.unshift({
      mangaId: manga.id, source: manga.source, title: manga.title, coverUrl: manga.coverUrl || '',
      chapterId: chapter.id, chapter: chapter.chapter || '', chapterTitle: chapter.title || '', page, readAt: now
    });
    this.state.history = this.state.history.slice(0, 300);
    this.save(false);
  }

  snapshotThrottled() {
    const now = Date.now();
    const last = Number(localStorage.getItem('mangadesk.web.lastSnapshot') || 0);
    if (now - last < 60_000) return;
    localStorage.setItem('mangadesk.web.lastSnapshot', String(now));
    this.createSnapshot('Automático');
  }

  createSnapshot(label = 'Manual') {
    const stamp = new Date().toISOString();
    const payload = { label, createdAt: stamp, state: this.state };
    localStorage.setItem(BACKUP_PREFIX + stamp, JSON.stringify(payload));
    const all = this.listSnapshots();
    all.slice(MAX_SNAPSHOTS).forEach(x => localStorage.removeItem(x.key));
    return payload;
  }

  listSnapshots() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(BACKUP_PREFIX)) continue;
      const data = parse(localStorage.getItem(key));
      if (data) list.push({ key, ...data });
    }
    return list.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  restoreSnapshot(key) {
    const data = parse(localStorage.getItem(key));
    if (!data?.state) throw new Error('Snapshot inválido.');
    this.state = migrate(data.state);
    this.save(false);
  }

  deleteSnapshot(key) { localStorage.removeItem(key); }

  exportBackup() {
    return {
      app: 'MangaDesk Web', format: 1, exportedAt: new Date().toISOString(),
      state: this.state
    };
  }

  importBackup(payload) {
    if (!payload || payload.app !== 'MangaDesk Web' || !payload.state) throw new Error('Este arquivo não é um backup válido do MangaDesk Web.');
    this.createSnapshot('Antes da importação');
    this.state = migrate(payload.state);
    this.save(false);
  }

  reset() {
    this.createSnapshot('Antes de limpar');
    this.state = defaultState();
    this.save(false);
  }
}

const store = new Store();


const MD_API = 'https://api.mangadex.org';
const MD_UPLOADS = 'https://uploads.mangadex.org';

const pickTitle = attrs => attrs?.title?.['pt-br'] || attrs?.title?.en || attrs?.title?.ja || Object.values(attrs?.title || {})[0] || 'Sem título';
const pickDescription = attrs => attrs?.description?.['pt-br'] || attrs?.description?.en || Object.values(attrs?.description || {})[0] || '';
const coverFile = item => item.relationships?.find(r => r.type === 'cover_art')?.attributes?.fileName;

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function mdRequest(params, settings) {
  const { action, ...rest } = params;
  const proxyMode = settings?.mangadexProxy || 'auto';
  const direct = async () => {
    let url;
    if (action === 'search') {
      const p = new URLSearchParams();
      p.set('title', rest.q); p.set('limit', String(rest.limit || 24)); p.append('includes[]', 'cover_art');
      if (rest.lang) p.append('availableTranslatedLanguage[]', rest.lang);
      url = `${MD_API}/manga?${p}`;
    } else if (action === 'feed') {
      const p = new URLSearchParams();
      p.set('limit', String(rest.limit || 100)); p.set('offset', String(rest.offset || 0));
      p.append('translatedLanguage[]', rest.lang || 'pt-br'); p.set('order[chapter]', 'desc'); p.set('includeExternalUrl', '0');
      url = `${MD_API}/manga/${encodeURIComponent(rest.id)}/feed?${p}`;
    } else if (action === 'pages') {
      url = `${MD_API}/at-home/server/${encodeURIComponent(rest.id)}`;
    } else throw new Error('Ação MangaDex inválida.');
    return fetchJson(url);
  };
  const proxy = async () => fetchJson(`/api/mangadex?${new URLSearchParams(params)}`);
  if (proxyMode === 'always') return proxy();
  if (proxyMode === 'never') return direct();
  try { return await direct(); } catch (e) {
    try { return await proxy(); } catch { throw e; }
  }
}

const MangaDexSource = {
  id: 'mangadex',
  name: 'MangaDex',
  description: 'Catálogo público via API do MangaDex.',
  async search(query, lang, settings) {
    const json = await mdRequest({ action: 'search', q: query, lang, limit: 24 }, settings);
    return (json.data || []).map(item => {
      const file = coverFile(item);
      return {
        id: item.id, source: 'mangadex', sourceName: 'MangaDex', title: pickTitle(item.attributes),
        description: pickDescription(item.attributes), status: item.attributes?.status || '', year: item.attributes?.year || '',
        coverUrl: file ? `${MD_UPLOADS}/covers/${item.id}/${file}.512.jpg` : '',
        tags: (item.attributes?.tags || []).slice(0,8).map(t => t.attributes?.name?.en).filter(Boolean)
      };
    });
  },
  async chapters(manga, lang, settings) {
    let all = [], offset = 0;
    for (let i = 0; i < 3; i++) {
      const json = await mdRequest({ action:'feed', id:manga.id, lang, limit:100, offset }, settings);
      all.push(...(json.data || []));
      const total = Number(json.total || all.length);
      offset += Number(json.limit || 100);
      if (all.length >= total || !(json.data || []).length) break;
    }
    return all.map(x => ({
      id: x.id, source:'mangadex', chapter: x.attributes?.chapter || '', volume: x.attributes?.volume || '',
      title: x.attributes?.title || '', language: x.attributes?.translatedLanguage || lang,
      pages: x.attributes?.pages || 0, publishedAt: x.attributes?.publishAt || x.attributes?.readableAt || ''
    }));
  },
  async pages(chapter, settings) {
    const json = await mdRequest({ action:'pages', id:chapter.id }, settings);
    const saver = settings?.imageQuality === 'data-saver';
    const names = saver ? json.chapter?.dataSaver : json.chapter?.data;
    const mode = saver ? 'data-saver' : 'data';
    return (names || []).map(name => `${json.baseUrl}/${mode}/${json.chapter.hash}/${name}`);
  }
};

function makeCustomSource(config) {
  const base = String(config.baseUrl || '').replace(/\/$/, '');
  const request = path => fetchJson(base + path);
  return {
    id: config.id,
    name: config.name,
    description: config.description || 'Fonte compatível com MangaDesk JSON API v1.',
    custom: true,
    async search(query, lang) {
      const json = await request(`/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}`);
      return (json.items || []).map(x => ({ ...x, source: config.id, sourceName: config.name }));
    },
    async chapters(manga, lang) {
      const json = await request(`/manga/${encodeURIComponent(manga.id)}/chapters?lang=${encodeURIComponent(lang)}`);
      return (json.items || []).map(x => ({ ...x, source: config.id }));
    },
    async pages(chapter) {
      const json = await request(`/chapter/${encodeURIComponent(chapter.id)}/pages`);
      return json.pages || [];
    }
  };
}

function getSources(state) {
  const list = [MangaDexSource, ...(state.customSources || []).filter(x => x.enabled !== false).map(makeCustomSource)];
  return list.filter(s => state.sourceEnabled?.[s.id] !== false);
}

function getSource(state, id) {
  return getSources({ ...state, sourceEnabled: { ...(state.sourceEnabled || {}), [id]: true } }).find(s => s.id === id);
}




const app = document.querySelector('#app');
const routes = {
  home: 'Início', library: 'Biblioteca', explore: 'Explorar', history: 'Histórico', sources: 'Fontes', backup: 'Backup e dados', settings: 'Configurações'
};
let currentRoute = store.get().ui.lastRoute || 'home';
let exploreResults = [];
let selectedSource = 'all';
let detailContext = null;
let readerContext = null;

const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = iso => { if (!iso) return ''; try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(iso)); } catch { return ''; } };
const getKey = x => `${x.source}:${x.id}`;
const inLibrary = m => store.get().library.some(x => getKey(x) === getKey(m));
const initials = () => (store.get().profile.name || 'L').trim().slice(0,1).toUpperCase();

function toast(message, type='') {
  const root = document.querySelector('#toast-root');
  const el = document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; root.append(el);
  setTimeout(()=>el.remove(), 3200);
}

function icon(name) {
  const paths={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
    library:'<path d="M4 4h5v16H4z"/><path d="M10.5 4h4.5v16h-4.5z"/><path d="m16.5 5 3.5-1 3 15-3.5 1z"/>',
    explore:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    sources:'<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/><path d="M8.5 8.5a5 5 0 0 0 0 7"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    backup:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 18v3h16v-3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||'<circle cx="12" cy="12" r="2"/>'}</svg>`;
}

function shell(content) {
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-mark">M</div><div><strong>MangaDesk</strong><small>Web reader</small></div></div>
      <nav class="nav">${Object.entries(routes).map(([id,label])=>`<button class="nav-btn ${id===currentRoute?'active':''}" data-route="${id}"><span class="nav-icon">${icon(id)}</span>${label}</button>`).join('')}</nav>
      <div class="sidebar-foot">Dados salvos neste navegador.<br>Use Backup para levar sua biblioteca para outro dispositivo.<br><br>v1.1.0</div>
    </aside>
    <button class="sidebar-backdrop" id="sidebar-backdrop" aria-label="Fechar menu"></button>
    <main class="main">
      <header class="topbar"><button class="btn icon ghost mobile-menu" id="mobile-menu">☰</button><div class="page-title">${esc(routes[currentRoute]||'MangaDesk')}</div><div class="top-spacer"></div><div class="top-pill">● <span id="storage-mini">localStorage ativo</span></div><div class="avatar">${esc(initials())}</div></header>
      <div class="content">${content}</div>
    </main>
  </div>`;
  bindShell();
}

function bindShell() {
  document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>navigate(b.dataset.route));
  const sidebar=document.querySelector('#sidebar');
  document.querySelector('#mobile-menu')?.addEventListener('click',()=>sidebar?.classList.toggle('open'));
  document.querySelector('#sidebar-backdrop')?.addEventListener('click',()=>sidebar?.classList.remove('open'));
  document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>sidebar?.classList.remove('open')));
  estimateStorage();
}

async function estimateStorage(){
  const el=document.querySelector('#storage-mini'); if(!el)return;
  try { const e=await navigator.storage?.estimate?.(); if(e?.usage!=null) el.textContent=`${(e.usage/1024/1024).toFixed(1)} MB no navegador`; } catch{}
}

function navigate(route) {
  currentRoute=route; store.setRoute(route); detailContext=null;
  renderRoute(); window.scrollTo({top:0,behavior:'smooth'});
}

function cover(m, extra='') {
  return `<div class="cover">${m.coverUrl?`<img src="${esc(m.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-placeholder">${esc(m.title)}</div>`}${extra}</div>`;
}

function mangaCard(m) {
  const saved=inLibrary(m); const fav=store.get().library.find(x=>getKey(x)===getKey(m))?.favorite;
  return `<article class="manga-card" data-open-manga="${esc(getKey(m))}">${cover(m,`<span class="card-badge">${esc(m.sourceName||m.source)}</span>${saved?`<button class="fav" data-fav="${esc(getKey(m))}" title="Favorito">${fav?'♥':'♡'}</button>`:''}`)}<div class="card-body"><div class="card-title" title="${esc(m.title)}">${esc(m.title)}</div><div class="card-meta">${esc([m.year,m.status].filter(Boolean).join(' • ')||'Abrir detalhes')}</div></div></article>`;
}

function bindMangaCards(items) {
  document.querySelectorAll('[data-open-manga]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('[data-fav]'))return; const m=items.find(x=>getKey(x)===el.dataset.openManga); if(m)openManga(m);}));
  document.querySelectorAll('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const [source,...rest]=b.dataset.fav.split(':');store.toggleFavorite(source,rest.join(':'));renderRoute();});
}

function renderHome() {
  const s=store.get(), readings=Object.values(s.reading).sort((a,b)=>(b.readAt||'').localeCompare(a.readAt||''));
  const favorites=s.library.filter(x=>x.favorite);
  shell(`<section class="hero"><div class="eyebrow">Sua biblioteca, no seu navegador</div><h1>Leia, organize e continue de onde parou.</h1><p>O MangaDesk Web guarda biblioteca, histórico, preferências e progresso localmente. Faça backups em JSON quando quiser e leve tudo para outro dispositivo.</p><div class="hero-actions"><button class="btn primary" data-go="explore">Explorar mangás</button><button class="btn" data-go="library">Abrir biblioteca</button></div></section>
    <div class="stats"><div class="stat"><div class="stat-value">${s.library.length}</div><div class="stat-label">na biblioteca</div></div><div class="stat"><div class="stat-value">${favorites.length}</div><div class="stat-label">favoritos</div></div><div class="stat"><div class="stat-value">${s.history.length}</div><div class="stat-label">leituras registradas</div></div><div class="stat"><div class="stat-value">${getSources(s).length}</div><div class="stat-label">fontes ativas</div></div></div>
    <div class="section-head"><div><h2>Continuar lendo</h2><p>Seu progresso recente.</p></div></div>
    ${readings.length?`<div class="manga-grid">${readings.slice(0,8).map(r=>mangaCard({...r,id:r.mangaId,sourceName:r.source,status:r.chapter?`Cap. ${r.chapter}`:''})).join('')}</div>`:`<div class="panel empty"><strong>Nenhuma leitura ainda</strong>Explore um título e abra um capítulo para começar.</div>`}
  `);
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
  bindMangaCards(readings.map(r=>({...r,id:r.mangaId,sourceName:r.source})).concat(s.library));
}

function renderLibrary() {
  const s=store.get(); let items=[...s.library];
  shell(`<div class="section-head"><div><h2>Sua biblioteca</h2><p>${items.length} título(s) salvos neste navegador.</p></div><div class="row-actions"><button class="btn" id="lib-fav">Somente favoritos</button><button class="btn primary" data-go="explore">+ Adicionar</button></div></div><div id="library-grid">${items.length?`<div class="manga-grid">${items.map(mangaCard).join('')}</div>`:`<div class="panel empty"><strong>Sua biblioteca está vazia</strong>Adicione títulos pela aba Explorar.</div>`}</div>`);
  bindMangaCards(items); document.querySelector('[data-go]')?.addEventListener('click',()=>navigate('explore'));
  document.querySelector('#lib-fav')?.addEventListener('click',e=>{const active=e.currentTarget.classList.toggle('primary');const show=active?items.filter(x=>x.favorite):items;document.querySelector('#library-grid').innerHTML=show.length?`<div class="manga-grid">${show.map(mangaCard).join('')}</div>`:`<div class="panel empty">Nenhum favorito.</div>`;bindMangaCards(show);});
}

function renderExplore() {
  const s=store.get(), sources=getSources(s);
  shell(`<div class="search-box"><input class="field" id="search-q" placeholder="Pesquisar título..." autocomplete="off"><select class="field" id="search-lang"><option value="pt-br">Português</option><option value="en">English</option><option value="es-la">Español</option><option value="ja">日本語</option></select><button class="btn primary" id="search-btn">Pesquisar</button></div><div class="chips"><button class="chip ${selectedSource==='all'?'active':''}" data-source="all">Todas</button>${sources.map(x=>`<button class="chip ${selectedSource===x.id?'active':''}" data-source="${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div><div id="search-results">${exploreResults.length?`<div class="manga-grid">${exploreResults.map(mangaCard).join('')}</div>`:`<div class="panel empty"><strong>Pesquise em suas fontes</strong>Os resultados aparecerão reunidos aqui.</div>`}</div>`);
  document.querySelector('#search-lang').value=s.settings.language;bindMangaCards(exploreResults);
  document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{selectedSource=b.dataset.source;renderExplore();});
  const run=async()=>{const q=document.querySelector('#search-q').value.trim();if(!q)return;const lang=document.querySelector('#search-lang').value;store.update(st=>st.settings.language=lang,{snapshot:false});const root=document.querySelector('#search-results');root.innerHTML=`<div class="panel reader-loading"><div class="loader"></div></div>`;const chosen=sources.filter(x=>selectedSource==='all'||x.id===selectedSource);const results=[];const errors=[];await Promise.all(chosen.map(async src=>{try{results.push(...await src.search(q,lang,store.get().settings));}catch(e){errors.push(`${src.name}: ${e.message}`);}}));exploreResults=results;root.innerHTML=(errors.length?`<div class="panel panel-pad" style="margin-bottom:12px;color:var(--warn)">${esc(errors.join(' • '))}</div>`:'')+(results.length?`<div class="manga-grid">${results.map(mangaCard).join('')}</div>`:`<div class="panel empty"><strong>Nenhum resultado</strong>Tente outro termo ou outra fonte.</div>`);bindMangaCards(results);};
  document.querySelector('#search-btn').onclick=run;document.querySelector('#search-q').addEventListener('keydown',e=>{if(e.key==='Enter')run();});document.querySelector('#search-q').focus();
}

async function openManga(manga) {
  detailContext=manga; currentRoute='detail';
  app.innerHTML=`<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">M</div><div><strong>MangaDesk</strong><small>Web reader</small></div></div><nav class="nav">${Object.entries(routes).map(([id,label])=>`<button class="nav-btn" data-route="${id}"><span class="nav-icon">${icon(id)}</span>${label}</button>`).join('')}</nav></aside><button class="sidebar-backdrop" id="sidebar-backdrop" aria-label="Fechar menu"></button><main class="main"><header class="topbar"><button class="btn icon ghost mobile-menu" id="mobile-menu">☰</button><button class="btn small" id="back-btn">← Voltar</button><div class="page-title">Detalhes</div><div class="top-spacer"></div><div class="avatar">${esc(initials())}</div></header><div class="content"><div class="detail"><div>${cover(manga)}</div><div><div class="eyebrow">${esc(manga.sourceName||manga.source)}</div><h1>${esc(manga.title)}</h1><div class="meta-line">${[manga.year,manga.status,...(manga.tags||[])].filter(Boolean).slice(0,8).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="description">${esc(manga.description||'Sem descrição disponível.')}</div><div class="row-actions"><button class="btn primary" id="lib-toggle">${inLibrary(manga)?'✓ Na biblioteca':'+ Adicionar à biblioteca'}</button>${inLibrary(manga)?`<button class="btn danger" id="lib-remove">Remover</button>`:''}</div></div></div><div class="section-head" style="margin-top:28px"><div><h2>Capítulos</h2><p id="chapter-sub">Carregando capítulos...</p></div><select class="field" id="detail-lang"><option value="pt-br">Português</option><option value="en">English</option><option value="es-la">Español</option><option value="ja">日本語</option></select></div><div class="panel" id="chapters"><div class="reader-loading" style="height:170px"><div class="loader"></div></div></div></div></main></div>`;
  bindShell();document.querySelector('#back-btn').onclick=()=>{currentRoute=store.get().ui.lastRoute||'explore';renderRoute();};document.querySelector('#detail-lang').value=store.get().settings.language;
  const libBtn=document.querySelector('#lib-toggle');libBtn.onclick=()=>{if(!inLibrary(manga)){store.addLibrary(manga);toast('Adicionado à biblioteca.','good');openManga(manga);}else toast('Este título já está na biblioteca.');};
  document.querySelector('#lib-remove')?.addEventListener('click',()=>{store.removeLibrary(manga.source,manga.id);toast('Removido da biblioteca.');openManga(manga);});
  const load=async()=>{const root=document.querySelector('#chapters'),lang=document.querySelector('#detail-lang').value;root.innerHTML=`<div class="reader-loading" style="height:170px"><div class="loader"></div></div>`;try{const src=getSource(store.get(),manga.source);if(!src)throw new Error('Fonte não encontrada ou desativada.');const chapters=await src.chapters(manga,lang,store.get().settings);document.querySelector('#chapter-sub').textContent=`${chapters.length} capítulo(s) encontrados.`;root.innerHTML=chapters.length?`<div class="chapters">${chapters.map((c,i)=>`<div class="chapter-row"><div class="chapter-number">${c.chapter?`Cap. ${esc(c.chapter)}`:`#${i+1}`}</div><div class="chapter-title">${esc(c.title||'Sem título')}</div><div class="chapter-date">${fmtDate(c.publishedAt)}</div><button class="btn small primary" data-read="${esc(c.id)}">Ler</button></div>`).join('')}</div>`:`<div class="empty">Nenhum capítulo nesse idioma.</div>`;root.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>{const ch=chapters.find(c=>c.id===b.dataset.read);if(ch)openReader(manga,ch);});}catch(e){root.innerHTML=`<div class="empty"><strong>Não foi possível carregar</strong>${esc(e.message)}</div>`;document.querySelector('#chapter-sub').textContent='Falha ao consultar a fonte.';}};
  document.querySelector('#detail-lang').onchange=e=>{store.update(st=>st.settings.language=e.target.value,{snapshot:false});load();};load();
}

async function openReader(manga, chapter) {
  if (readerContext) closeReader();
  readerContext={manga,chapter,pages:[],index:0,pointerStart:null};
  const settings=store.get().settings;
  const mode=settings.readerMode || 'vertical';
  const fit=settings.readerFit || 'contain';
  document.body.classList.add('reader-open');
  document.body.insertAdjacentHTML('beforeend',`<section class="reader" id="reader" aria-label="Leitor de mangá">
    <header class="reader-bar">
      <button class="btn icon ghost" id="reader-close" title="Fechar (Esc)" aria-label="Fechar leitor">✕</button>
      <div class="reader-title"><strong>${esc(manga.title)}</strong><small>${esc(chapter.chapter?`Capítulo ${chapter.chapter}`:chapter.title||'Capítulo')}</small></div>
      <div class="reader-actions">
        <select class="field reader-select" id="reader-mode" aria-label="Modo de leitura"><option value="vertical">Vertical</option><option value="paged">Paginado</option></select>
        <select class="field reader-select" id="reader-fit" aria-label="Ajuste da página"><option value="contain">Tela inteira</option><option value="width">Largura</option><option value="original">Original</option></select>
        <button class="btn icon ghost" id="reader-fullscreen" title="Tela cheia" aria-label="Tela cheia">⛶</button>
        <div class="reader-counter" id="reader-count">...</div>
      </div>
    </header>
    <div class="reader-pages ${mode} fit-${fit}" id="reader-pages"><div class="reader-loading"><div class="loader"></div></div></div>
    <div class="reader-progress" aria-hidden="true"><i id="reader-progress-bar"></i></div>
    <div class="reader-hint" id="reader-hint">← → / A D para navegar • F para tela cheia • Esc para sair</div>
  </section>`);

  const modeEl=document.querySelector('#reader-mode');
  const fitEl=document.querySelector('#reader-fit');
  modeEl.value=mode;
  fitEl.value=fit;
  document.querySelector('#reader-close').onclick=closeReader;
  modeEl.onchange=e=>{
    store.update(st=>st.settings.readerMode=e.target.value,{snapshot:false});
    renderReaderPages();
  };
  fitEl.onchange=e=>{
    store.update(st=>st.settings.readerFit=e.target.value,{snapshot:false});
    applyReaderFit();
  };
  document.querySelector('#reader-fullscreen').onclick=toggleReaderFullscreen;

  try {
    const src=getSource(store.get(),chapter.source||manga.source);
    if(!src) throw new Error('Fonte indisponível.');
    readerContext.pages=await src.pages(chapter,store.get().settings);
    const saved=store.get().reading[`${manga.source}:${manga.id}`];
    if(saved?.chapterId===chapter.id) readerContext.index=Math.min(saved.page||0,Math.max(0,readerContext.pages.length-1));
    renderReaderPages();
    store.recordRead(manga,chapter,readerContext.index);
  } catch(e) {
    const pages=document.querySelector('#reader-pages');
    if(pages) pages.innerHTML=`<div class="reader-loading">${esc(e.message)}</div>`;
  }

  window.addEventListener('keydown',readerKeys);
  document.addEventListener('fullscreenchange',syncFullscreenButton);
}

function applyReaderFit(){
  const root=document.querySelector('#reader-pages');
  if(!root) return;
  const fit=store.get().settings.readerFit || 'contain';
  root.classList.remove('fit-contain','fit-width','fit-original');
  root.classList.add(`fit-${fit}`);
  const fitEl=document.querySelector('#reader-fit');
  if(fitEl) fitEl.value=fit;
}

function renderReaderPages(){
  if(!readerContext) return;
  const root=document.querySelector('#reader-pages');
  if(!root) return;
  const settings=store.get().settings;
  const mode=settings.readerMode || 'vertical';
  const fit=settings.readerFit || 'contain';
  const pages=readerContext.pages;
  root.className=`reader-pages ${mode} fit-${fit}`;
  root.onscroll=null;
  root.onpointerdown=null;
  root.onpointerup=null;
  root.onpointercancel=null;

  const modeEl=document.querySelector('#reader-mode');
  if(modeEl) modeEl.value=mode;
  if(!pages.length){root.innerHTML=`<div class="reader-loading">Nenhuma página encontrada.</div>`;updateReaderProgress(false);return;}

  if(mode==='vertical'){
    root.innerHTML=pages.map((u,i)=>`<img src="${esc(u)}" data-page="${i}" loading="${Math.abs(i-readerContext.index)<=2?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer" alt="Página ${i+1}">`).join('');
    const target=root.querySelector(`[data-page="${readerContext.index}"]`);
    requestAnimationFrame(()=>setTimeout(()=>target?.scrollIntoView({block:'start'}),30));
    let timer;
    root.onscroll=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const imgs=[...root.querySelectorAll('img')];
        const rootTop=root.getBoundingClientRect().top;
        let best=readerContext.index,dist=Infinity;
        imgs.forEach((im,i)=>{
          const d=Math.abs(im.getBoundingClientRect().top-rootTop-8);
          if(d<dist){dist=d;best=i;}
        });
        if(best!==readerContext.index){readerContext.index=best;updateReaderProgress();}
      },120);
    };
  } else {
    root.innerHTML=pages.map((u,i)=>`<img class="${i===readerContext.index?'active':''}" data-src="${esc(u)}" data-page="${i}" decoding="async" referrerpolicy="no-referrer" alt="Página ${i+1}">`).join('')+
      `<button class="reader-nav left" aria-label="Página do lado esquerdo"><span>‹</span></button><button class="reader-nav right" aria-label="Página do lado direito"><span>›</span></button>`;
    hydratePagedImages();
    root.querySelector('.reader-nav.left').onclick=()=>readerStepBySide('left');
    root.querySelector('.reader-nav.right').onclick=()=>readerStepBySide('right');
    root.onpointerdown=e=>{
      if(e.pointerType==='mouse' || e.target.closest('button')) return;
      readerContext.pointerStart={x:e.clientX,y:e.clientY};
    };
    root.onpointerup=e=>{
      if(!readerContext?.pointerStart) return;
      const dx=e.clientX-readerContext.pointerStart.x;
      const dy=e.clientY-readerContext.pointerStart.y;
      readerContext.pointerStart=null;
      if(Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)*1.25) readerStepBySide(dx<0?'left':'right');
    };
    root.onpointercancel=()=>{if(readerContext)readerContext.pointerStart=null;};
  }
  updateReaderProgress(false);
}

function hydratePagedImages(){
  if(!readerContext) return;
  const imgs=[...document.querySelectorAll('#reader-pages img')];
  [readerContext.index-1,readerContext.index,readerContext.index+1].forEach(i=>{
    const img=imgs[i];
    if(img && !img.getAttribute('src') && img.dataset.src) img.src=img.dataset.src;
  });
}

function readerStepBySide(side){
  const rtl=store.get().settings.direction==='rtl';
  const delta=side==='left' ? (rtl?1:-1) : (rtl?-1:1);
  readerStep(delta);
}

function readerStep(delta){
  if(!readerContext) return;
  const next=Math.max(0,Math.min(readerContext.pages.length-1,readerContext.index+delta));
  if(next===readerContext.index) return;
  readerContext.index=next;
  document.querySelectorAll('#reader-pages img').forEach((im,i)=>im.classList.toggle('active',i===readerContext.index));
  const root=document.querySelector('#reader-pages');
  if(root && store.get().settings.readerMode==='paged') root.scrollTo({top:0,left:0,behavior:'auto'});
  hydratePagedImages();
  updateReaderProgress();
}

function updateReaderProgress(save=true){
  if(!readerContext) return;
  const total=readerContext.pages.length;
  const current=total?readerContext.index+1:0;
  const count=document.querySelector('#reader-count');
  const bar=document.querySelector('#reader-progress-bar');
  if(count) count.textContent=`${current} / ${total}`;
  if(bar) bar.style.width=total?`${(current/total)*100}%`:'0%';
  if(save && total) store.recordRead(readerContext.manga,readerContext.chapter,readerContext.index);
}

async function toggleReaderFullscreen(){
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#reader')?.requestFullscreen?.();
  } catch { toast('O navegador bloqueou a tela cheia.','error'); }
}

function syncFullscreenButton(){
  const btn=document.querySelector('#reader-fullscreen');
  if(btn) btn.textContent=document.fullscreenElement?'⤢':'⛶';
}

function readerKeys(e){
  if(!readerContext) return;
  if(e.key==='Escape' && !document.fullscreenElement){closeReader();return;}
  if(e.key==='f' || e.key==='F'){e.preventDefault();toggleReaderFullscreen();return;}
  if(store.get().settings.readerMode==='paged'){
    if(['ArrowRight','d','D'].includes(e.key)){e.preventDefault();readerStepBySide('right');}
    if(['ArrowLeft','a','A'].includes(e.key)){e.preventDefault();readerStepBySide('left');}
    if(e.key==='Home'){e.preventDefault();readerContext.index=0;renderReaderPages();updateReaderProgress();}
    if(e.key==='End'){e.preventDefault();readerContext.index=Math.max(0,readerContext.pages.length-1);renderReaderPages();updateReaderProgress();}
  }
}

function closeReader(){
  window.removeEventListener('keydown',readerKeys);
  document.removeEventListener('fullscreenchange',syncFullscreenButton);
  if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  document.querySelector('#reader')?.remove();
  document.body.classList.remove('reader-open');
  readerContext=null;
}

function renderHistory(){const h=store.get().history;shell(`<div class="section-head"><div><h2>Histórico</h2><p>As últimas leituras registradas.</p></div></div><div class="panel">${h.length?`<div class="list">${h.map(x=>`<div class="list-row"><div>${x.coverUrl?`<img class="thumb" src="${esc(x.coverUrl)}" alt="">`:`<div class="thumb"></div>`}</div><div><div class="list-title">${esc(x.title)}</div><div class="list-sub">${x.chapter?`Cap. ${esc(x.chapter)}`:'Capítulo'} • ${fmtDate(x.readAt)}</div></div><button class="btn small" data-history="${esc(x.source)}:${esc(x.mangaId)}">Abrir</button></div>`).join('')}</div>`:`<div class="empty">Nenhuma leitura registrada.</div>`}</div>`);document.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>{const x=h.find(v=>`${v.source}:${v.mangaId}`===b.dataset.history);if(!x)return;const lib=store.get().library.find(v=>v.source===x.source&&v.id===x.mangaId);openManga(lib||{id:x.mangaId,source:x.source,sourceName:x.source,title:x.title,coverUrl:x.coverUrl});});}

function renderSources(){const s=store.get(),sources=[{id:'mangadex',name:'MangaDex',description:'Fonte integrada usando a API pública do MangaDex.'},...(s.customSources||[])];shell(`<div class="section-head"><div><h2>Fontes</h2><p>Ative fontes compatíveis com o MangaDesk Web.</p></div><button class="btn primary" id="add-source">+ Adicionar API</button></div><div class="panel">${sources.map(src=>`<div class="list-row"><div class="avatar" style="width:38px;height:38px">${esc(src.name.slice(0,1))}</div><div><div class="list-title">${esc(src.name)}</div><div class="list-sub">${esc(src.description||src.baseUrl||'Fonte personalizada')}</div></div><div class="row-actions"><label class="toggle"><input type="checkbox" data-source-toggle="${esc(src.id)}" ${s.sourceEnabled?.[src.id]!==false&&src.enabled!==false?'checked':''}> Ativa</label>${src.id!=='mangadex'?`<button class="btn small danger" data-source-remove="${esc(src.id)}">Excluir</button>`:''}</div></div>`).join('')}</div><div class="panel panel-pad" style="margin-top:15px"><strong style="font-size:13px">Formato de fonte personalizada</strong><p style="color:var(--muted);font-size:11px;line-height:1.6;margin-bottom:0">A API deve implementar <code>/search?q=&lang=</code>, <code>/manga/{id}/chapters?lang=</code> e <code>/chapter/{id}/pages</code>, retornando JSON no formato MangaDesk v1. A API também precisa permitir CORS no navegador.</p></div>`);
  document.querySelectorAll('[data-source-toggle]').forEach(c=>c.onchange=()=>{const id=c.dataset.sourceToggle;store.update(st=>{st.sourceEnabled[id]=c.checked;const custom=st.customSources.find(x=>x.id===id);if(custom)custom.enabled=c.checked;});toast(c.checked?'Fonte ativada.':'Fonte desativada.');});document.querySelectorAll('[data-source-remove]').forEach(b=>b.onclick=()=>{if(confirm('Excluir esta fonte personalizada?'))store.update(st=>{st.customSources=st.customSources.filter(x=>x.id!==b.dataset.sourceRemove);delete st.sourceEnabled[b.dataset.sourceRemove];});renderSources();});document.querySelector('#add-source').onclick=showSourceModal;
}
function showSourceModal(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="source-modal"><div class="modal-card"><div class="modal-head"><h3>Adicionar fonte JSON</h3><button class="btn icon ghost" data-close>✕</button></div><div class="modal-body"><div class="form-grid"><label>Nome<input class="field" id="src-name" placeholder="Minha fonte"></label><label>URL base<input class="field" id="src-url" placeholder="https://api.exemplo.com"></label><label>Descrição<input class="field" id="src-desc" placeholder="Opcional"></label><button class="btn primary" id="src-save">Adicionar fonte</button></div></div></div></div>`);document.querySelector('[data-close]').onclick=()=>document.querySelector('#source-modal').remove();document.querySelector('#src-save').onclick=()=>{const name=document.querySelector('#src-name').value.trim(),baseUrl=document.querySelector('#src-url').value.trim();if(!name||!/^https?:\/\//i.test(baseUrl))return toast('Informe nome e uma URL válida.','error');const id=`custom-${Date.now().toString(36)}`;store.update(st=>{st.customSources.push({id,name,baseUrl,description:document.querySelector('#src-desc').value.trim(),enabled:true});st.sourceEnabled[id]=true;});document.querySelector('#source-modal').remove();renderSources();toast('Fonte adicionada.','good');};}

function downloadJson(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function renderBackup(){const snaps=store.listSnapshots();shell(`<div class="settings-grid"><section class="panel setting-card"><h3>Backup portátil</h3><p>Exporte um arquivo JSON com biblioteca, histórico, progresso, fontes e preferências. Você pode importar o arquivo em outro dispositivo.</p><div class="row-actions"><button class="btn primary" id="backup-export">Exportar JSON</button><label class="btn">Importar JSON<input type="file" id="backup-import" accept="application/json,.json" hidden></label></div></section><section class="panel setting-card"><h3>Snapshot manual</h3><p>Cria uma cópia interna no localStorage antes de alterações importantes. Os ${5} snapshots mais recentes são mantidos.</p><button class="btn" id="snap-create">Criar snapshot agora</button></section></div><div class="section-head" style="margin-top:25px"><div><h2>Snapshots locais</h2><p>Cópias armazenadas neste navegador.</p></div></div><div class="panel panel-pad" id="snap-list">${snaps.length?snaps.map(x=>`<div class="snapshot"><div class="snapshot-main"><strong>${esc(x.label||'Snapshot')}</strong><small>${fmtDate(x.createdAt)} • ${esc(x.createdAt?.slice(11,19)||'')}</small></div><button class="btn small" data-snap-restore="${esc(x.key)}">Restaurar</button><button class="btn small danger" data-snap-delete="${esc(x.key)}">Excluir</button></div>`).join(''):`<div class="empty">Nenhum snapshot criado.</div>`}</div>`);document.querySelector('#backup-export').onclick=()=>{downloadJson(store.exportBackup(),`MangaDesk-Backup-${new Date().toISOString().slice(0,10)}.json`);toast('Backup exportado.','good');};document.querySelector('#backup-import').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{store.importBackup(JSON.parse(await file.text()));toast('Backup restaurado.','good');renderBackup();}catch(err){toast(err.message,'error');}};document.querySelector('#snap-create').onclick=()=>{store.createSnapshot('Manual');toast('Snapshot criado.','good');renderBackup();};document.querySelectorAll('[data-snap-restore]').forEach(b=>b.onclick=()=>{if(confirm('Restaurar este snapshot? O estado atual será substituído.')){store.restoreSnapshot(b.dataset.snapRestore);toast('Snapshot restaurado.','good');renderBackup();}});document.querySelectorAll('[data-snap-delete]').forEach(b=>b.onclick=()=>{store.deleteSnapshot(b.dataset.snapDelete);renderBackup();});}

function renderSettings(){
  const s=store.get();
  shell(`<div class="settings-grid">
    <section class="panel setting-card">
      <h3>Leitura</h3>
      <p>Defina como os capítulos devem abrir. No modo paginado, “Tela inteira” mantém a página sempre visível sem cortes.</p>
      <div class="form-grid">
        <div class="form-row"><label>Idioma padrão</label><select class="field" id="set-lang"><option value="pt-br">Português</option><option value="en">English</option><option value="es-la">Español</option><option value="ja">日本語</option></select></div>
        <div class="form-row"><label>Modo do leitor</label><select class="field" id="set-mode"><option value="vertical">Vertical</option><option value="paged">Paginado</option></select></div>
        <div class="form-row"><label>Ajuste da página</label><select class="field" id="set-fit"><option value="contain">Tela inteira</option><option value="width">Largura</option><option value="original">Tamanho original</option></select></div>
        <div class="form-row"><label>Qualidade</label><select class="field" id="set-quality"><option value="data-saver">Economia de dados</option><option value="original">Original</option></select></div>
        <div class="form-row"><label>Direção</label><select class="field" id="set-dir"><option value="rtl">Direita → esquerda</option><option value="ltr">Esquerda → direita</option></select></div>
      </div>
    </section>
    <section class="panel setting-card">
      <h3>Dados e interface</h3>
      <p>Preferências gerais salvas localmente neste navegador.</p>
      <div class="form-grid">
        <div class="form-row"><label>Nome</label><input class="field" id="set-name"></div>
        <div class="form-row"><label>Cor de destaque</label><input class="field" type="color" id="set-accent" style="padding:4px;height:40px"></div>
        <div class="form-row"><label>Proxy MangaDex</label><select class="field" id="set-proxy"><option value="auto">Automático</option><option value="never">Direto</option><option value="always">Vercel proxy</option></select></div>
        <label class="toggle"><input type="checkbox" id="set-snapshot"> Criar snapshots automáticos</label>
        <button class="btn danger" id="reset-data">Limpar todos os dados</button>
      </div>
    </section>
  </div>`);
  const bind=(id,val,cb)=>{const el=document.querySelector(id);if(!el)return;el.value=val;el.onchange=()=>store.update(cb);};
  bind('#set-lang',s.settings.language,st=>st.settings.language=document.querySelector('#set-lang').value);
  bind('#set-mode',s.settings.readerMode,st=>st.settings.readerMode=document.querySelector('#set-mode').value);
  bind('#set-fit',s.settings.readerFit||'contain',st=>st.settings.readerFit=document.querySelector('#set-fit').value);
  bind('#set-quality',s.settings.imageQuality,st=>st.settings.imageQuality=document.querySelector('#set-quality').value);
  bind('#set-dir',s.settings.direction,st=>st.settings.direction=document.querySelector('#set-dir').value);
  bind('#set-name',s.profile.name,st=>st.profile.name=document.querySelector('#set-name').value.trim()||'Leitor');
  bind('#set-proxy',s.settings.mangadexProxy,st=>st.settings.mangadexProxy=document.querySelector('#set-proxy').value);
  const accent=document.querySelector('#set-accent');
  accent.value=s.settings.accent||'#7c5cff';
  accent.oninput=()=>{document.documentElement.style.setProperty('--accent',accent.value);};
  accent.onchange=()=>store.update(st=>st.settings.accent=accent.value,{snapshot:false});
  const snap=document.querySelector('#set-snapshot');
  snap.checked=s.settings.autoSnapshot;
  snap.onchange=()=>store.update(st=>st.settings.autoSnapshot=snap.checked,{snapshot:false});
  document.querySelector('#reset-data').onclick=()=>{
    if(confirm('Tem certeza? Um snapshot será criado antes da limpeza.')){
      store.reset();toast('Dados limpos.');renderSettings();
    }
  };
}

function renderRoute(){if(currentRoute==='detail'&&detailContext)return openManga(detailContext);({home:renderHome,library:renderLibrary,explore:renderExplore,history:renderHistory,sources:renderSources,backup:renderBackup,settings:renderSettings}[currentRoute]||renderHome)();}

store.addEventListener('change',()=>{document.documentElement.style.setProperty('--accent',store.get().settings.accent||'#7c5cff');});
document.documentElement.style.setProperty('--accent',store.get().settings.accent||'#7c5cff');
if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderRoute();

