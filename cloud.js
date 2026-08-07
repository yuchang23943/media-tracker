// Zeabur / 云端部署用的精简 HTTP 服务
// 监听 process.env.PORT，纯 HTTP（云端会自动加 HTTPS + CDN）
// 零依赖：纯 Node 内置模块
// 本地开发请用 serve.js（带 HTTPS + 隧道），这个文件是给云平台用的
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
  });
  res.end(body);
}

// 代理豆瓣 suggest 接口（豆瓣无 CORS 头，必须服务端转发）
function fetchDoubanSuggest(query, type) {
  return new Promise((resolve, reject) => {
    const host = type === 'movie' ? 'movie.douban.com' : 'book.douban.com';
    const url = `https://${host}/j/subject_suggest?q=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.douban.com/',
      },
      timeout: 10000,
    }, (r) => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { data += c; });
      r.on('end', () => {
        try {
          const items = JSON.parse(data);
          const list = (Array.isArray(items) ? items : [])
            .map((it) => {
              let pic = (it && (it.pic || it.img)) || '';
              if (!pic) return null;
              pic = pic
                .replace('/view/subject/s/', '/view/subject/l/')
                .replace('/view/photo/s_ratio_poster/', '/view/photo/l_ratio_poster/');
              return {
                cover: pic,
                title: it.title,
                subtitle: it.sub_title,
                author: it.author_name,
                year: it.year,
                id: it.id,
              };
            })
            .filter(Boolean);
          resolve(list);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('douban timeout')); });
  });
}

async function handle(req, res) {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  // API 代理：豆瓣真实封面
  if (pathname === '/api/suggest' || pathname === '/api/cover') {
    const query = u.searchParams.get('q');
    const type = u.searchParams.get('type');
    if (!query || !type) return sendJson(res, { error: 'missing q or type' }, 400);
    if (type !== 'book' && type !== 'movie') {
      return sendJson(res, { ok: false, error: 'game uses local db' });
    }
    try {
      const list = await fetchDoubanSuggest(query, type);
      if (list.length === 0) return sendJson(res, { ok: false, error: 'not found' });
      if (pathname === '/api/cover') {
        return sendJson(res, { ok: true, cover: list[0].cover, title: list[0].title, source: 'douban' });
      }
      return sendJson(res, { ok: true, items: list, source: 'douban' });
    } catch (e) {
      return sendJson(res, { ok: false, error: String(e && e.message || e) }, 502);
    }
  }

  // 静态文件
  let rel = decodeURIComponent(pathname.slice(1));
  if (!rel) rel = 'index.html';
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

http.createServer(handle).listen(PORT, () => {
  console.log('鱼肠大王堂堂降临 serving on port ' + PORT);
});
