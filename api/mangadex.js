const API = 'https://api.mangadex.org';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  try {
    const { action, q = '', lang = 'pt-br', id = '', limit = '24', offset = '0' } = req.query || {};
    let url;
    if (action === 'search') {
      const p = new URLSearchParams();
      p.set('title', String(q)); p.set('limit', String(Math.min(Number(limit) || 24, 50))); p.append('includes[]', 'cover_art');
      if (lang) p.append('availableTranslatedLanguage[]', String(lang));
      url = `${API}/manga?${p}`;
    } else if (action === 'feed' && id) {
      const p = new URLSearchParams();
      p.set('limit', String(Math.min(Number(limit) || 100, 100))); p.set('offset', String(Math.max(Number(offset) || 0, 0)));
      p.append('translatedLanguage[]', String(lang)); p.set('order[chapter]', 'desc'); p.set('includeExternalUrl', '0');
      url = `${API}/manga/${encodeURIComponent(String(id))}/feed?${p}`;
    } else if (action === 'pages' && id) {
      url = `${API}/at-home/server/${encodeURIComponent(String(id))}`;
    } else {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }
    const upstream = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MangaDesk-Web/1.0' } });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(text);
  } catch (error) {
    return res.status(502).json({ error: 'Falha ao consultar a fonte.', detail: error.message });
  }
};
