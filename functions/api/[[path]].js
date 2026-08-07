// Cloudflare Pages Functions catch-all: 处理所有 /api/* 请求
// 路由: /api/suggest?q=<标题>&type=<book|movie>
//       /api/cover?q=<标题>&type=<book|movie>
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

async function fetchDouban(q, type) {
  const enc = encodeURIComponent(q);
  const url = type === 'movie'
    ? `https://movie.douban.com/j/subject_suggest?q=${enc}`
    : `https://book.douban.com/j/subject_suggest?q=${enc}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': 'https://www.douban.com/' },
  });
  if (!r.ok) throw new Error('douban status ' + r.status);
  const items = await r.json();
  const list = [];
  for (const it of items) {
    let pic = it.pic || it.img;
    if (!pic) continue;
    pic = pic.replace('/view/subject/s/', '/view/subject/l/');
    pic = pic.replace('/view/photo/s_ratio_poster/', '/view/photo/l_ratio_poster/');
    list.push({
      cover: pic,
      title: it.title,
      subtitle: it.sub_title,
      author: it.author_name,
      year: it.year,
      id: it.id,
    });
  }
  return list;
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const q = url.searchParams.get('q');
  const type = url.searchParams.get('type');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
  };

  if (!q || !type) {
    return new Response(JSON.stringify({ ok: false, error: 'missing q or type' }), { status: 400, headers });
  }
  if (type !== 'book' && type !== 'movie') {
    return new Response(JSON.stringify({ ok: false, error: 'game uses local db' }), { headers });
  }

  try {
    const list = await fetchDouban(q, type);
    if (list.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'not found' }), { headers });
    }
    if (pathname === '/api/cover') {
      return new Response(JSON.stringify({ ok: true, cover: list[0].cover, title: list[0].title, source: 'douban' }), { headers });
    }
    return new Response(JSON.stringify({ ok: true, items: list, source: 'douban' }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), { status: 502, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
