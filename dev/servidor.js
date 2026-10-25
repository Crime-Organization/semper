// Servidor local para testar o SEMPER no navegador.
//   node dev/servidor.js [porta]           -> usa o banco de verdade (Supabase)
//   node dev/servidor.js [porta] --falso   -> troca assets/dados.js por dev/dados-falsos.js (dados fictícios, sem login)
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..');
const porta = Number(process.argv.find(a => /^\d+$/.test(a))) || 8090;
const falso = process.argv.includes('--falso');
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

http.createServer((req, res) => {
  let rota = decodeURIComponent(req.url.split('?')[0]);
  if (falso && rota.endsWith('/assets/dados.js')) rota = '/dev/dados-falsos.js';
  let arquivo = path.join(raiz, rota);
  if (!arquivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}).listen(porta, () => console.log(`SEMPER em http://localhost:${porta}/ ${falso ? '(dados fictícios)' : '(banco real)'}`));
