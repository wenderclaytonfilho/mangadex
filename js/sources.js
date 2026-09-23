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

export const MangaDexSource = {
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

export function makeCustomSource(config) {
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

export function getSources(state) {
  const list = [MangaDexSource, ...(state.customSources || []).filter(x => x.enabled !== false).map(makeCustomSource)];
  return list.filter(s => state.sourceEnabled?.[s.id] !== false);
}

export function getSource(state, id) {
  return getSources({ ...state, sourceEnabled: { ...(state.sourceEnabled || {}), [id]: true } }).find(s => s.id === id);
}
