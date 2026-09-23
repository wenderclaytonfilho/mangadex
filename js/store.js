const KEY = 'mangadesk.web.state.v2';
const BACKUP_PREFIX = 'mangadesk.web.snapshot.';
const MAX_SNAPSHOTS = 5;

export const defaultState = () => ({
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

export class Store extends EventTarget {
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

export const store = new Store();
