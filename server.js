const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const root = path.resolve(__dirname);

http.createServer((req, res) => {
  let filePath = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url));
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('404');
  }
}).listen(8081, () => console.log('✅ Server: http://localhost:8081'));
