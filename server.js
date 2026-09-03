const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const FILES_DIR = path.join(__dirname, 'files');

const mimeTypes = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'text/javascript',
};

const server = http.createServer((req, res) => {
  // Serve index.html for root path
  const filePath = req.url === '/'
    ? path.join(FILES_DIR, 'index.html')
    : path.join(FILES_DIR, req.url);

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Game running at http://localhost:${PORT}`);
});
