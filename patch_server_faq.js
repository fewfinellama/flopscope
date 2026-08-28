import fs from 'fs';
let server = fs.readFileSync('server.js', 'utf8');

server = server.replace(
  "  if (req.method === 'GET' && !req.path.startsWith('/api/')) {\n    return res.sendFile(path.join(__dirname, 'public', 'index.html'));",
  "  if (req.method === 'GET' && !req.path.startsWith('/api/')) {\n    if (req.path === '/faq') {\n      return res.sendFile(path.join(__dirname, 'public', 'faq.html'));\n    }\n    return res.sendFile(path.join(__dirname, 'public', 'index.html'));"
);

fs.writeFileSync('server.js', server);
