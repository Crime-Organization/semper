// Tema antes de desenhar a tela, para não piscar. A entrada (/entrar/) é sempre clara; a página pública (/) segue o tema, como o sistema.
// Fica num arquivo (e não dentro do index.html) porque a política de segurança só deixa rodar scripts do próprio site.
try {
  var t = localStorage.getItem('semper-tema');
  if (location.pathname.indexOf('/entrar') === 0) document.documentElement.dataset.tema = 'claro';
  else if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t;
} catch { /* sem acesso ao armazenamento: fica o tema automático */ }
