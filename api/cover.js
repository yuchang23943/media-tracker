// Vercel Serverless Function: 单条封面
// 路由: /api/cover?q=<标题>&type=<book|movie>
// 返回第一条匹配的真实封面 URL
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

module.exports = async function handler(req, res) {
  const { q, type } = req.query;
  if (!q || !type) {
    return res.status(400).json({ ok: false, error: 'missing q or type' });
  }
  if (type !== 'book' && type !== 'movie') {
    return res.status(200).json({ ok: false, error: 'game uses ai fallback' });
  }
  try {
    const enc = encodeURIComponent(q);
    const url = type === 'movie'
      ? `https://movie.douban.com/j/subject_suggest?q=${enc}`
      : `https://book.douban.com/j/subject_suggest?q=${enc}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': 'https://www.douban.com/' },
    });
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: 'douban status ' + r.status });
    }
    const items = await r.json();
    for (const it of items) {
      let pic = it.pic || it.img;
      if (!pic) continue;
      pic = pic.replace('/view/subject/s/', '/view/subject/l/');
      pic = pic.replace('/view/photo/s_ratio_poster/', '/view/photo/l_ratio_poster/');
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).json({ ok: true, cover: pic, title: it.title, source: 'douban' });
    }
    return res.status(200).json({ ok: false, error: 'not found' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
};
