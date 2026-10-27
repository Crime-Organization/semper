// Tema antes de desenhar a tela, para não piscar. A entrada (/) é sempre clara.
// Fica num arquivo (e não dentro do index.html) porque a política de segurança só deixa rodar scripts do próprio site.
try {
  var t = localStorage.getItem('semper-tema');
  if (location.pathname === '/') document.documentElement.dataset.tema = 'claro';
  else if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t;
} catch (e) { /* sem acesso ao armazenamento: fica o tema automático */ }
