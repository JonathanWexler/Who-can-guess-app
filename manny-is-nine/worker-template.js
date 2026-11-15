// Runtime for manny.jonwexler.com. build-worker.js prepends HTML and FILES
// (the page plus base64 images/song) and writes the result to dist/_worker.js.
const cache = {};
export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    const file = FILES[pathname];
    if (file) {
      const body = (cache[pathname] = cache[pathname] || Uint8Array.from(atob(file[1]), (c) => c.charCodeAt(0)));
      const headers = { 'content-type': file[0], 'cache-control': 'public, max-age=3600', 'accept-ranges': 'bytes' };
      // Safari (iPhone/iPad) streams audio in byte ranges and won't play without them.
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
      if (range && (range[1] !== '' || range[2] !== '')) {
        const size = body.length;
        let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
        let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : size - 1;
        start = Math.max(0, start);
        end = Math.min(size - 1, end);
        if (start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
        return new Response(body.slice(start, end + 1), { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}` } });
      }
      return new Response(body, { headers });
    }
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    }
    return Response.redirect(new URL('/', request.url).toString(), 302);
  },
};
