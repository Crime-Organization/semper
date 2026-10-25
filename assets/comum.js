// Peças comuns das páginas do SEMPER: casca do app (barra lateral), avatares, avisos,
// janelas de confirmação, painel do cartão e datas. Depende de assets/marca.js e assets/dados.js.
(function () {
  const M = window.MARCA;
  const RAIZ = new URL('../', document.currentScript.src).href;   // endereço da pasta do SEMPER
  const url = caminho => new URL(caminho, RAIZ).href;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Cor de destaque vinda da marca (os tons derivados só mudam se a marca trocar o verde padrão).
  const mudarTom = (hex, f) => '#' + [16, 8, 0].map(s => {
    const c = (parseInt(hex.slice(1), 16) >> s) & 255;
    return Math.round(f < 1 ? c * f : c + (255 - c) * (f - 1)).toString(16).padStart(2, '0');
  }).join('');
  if (M.cores.destaque.toLowerCase() !== '#377d22') {
    const raiz = document.documentElement.style;
    raiz.setProperty('--accent', M.cores.destaque);
    raiz.setProperty('--accent-hover', mudarTom(M.cores.destaque, .86));
    raiz.setProperty('--accent-ink', mudarTom(M.cores.destaque, .78));
    raiz.setProperty('--accent-deep', mudarTom(M.cores.destaque, .57));
    raiz.setProperty('--accent-bright', mudarTom(M.cores.destaque, 1.3));
  }
  if (M.cores.escuro.toLowerCase() !== '#1a1916') document.documentElement.style.setProperty('--dark', M.cores.escuro);

  // ---------- tema (claro, escuro ou automático, seguindo o aparelho) ----------
  const TEMAS = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };
  const temaAtual = () => document.documentElement.dataset.tema || 'auto';
  function aplicarTema(t) {
    if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t;
    else delete document.documentElement.dataset.tema;
    try { if (t === 'claro' || t === 'escuro') localStorage.setItem('semper-tema', t); else localStorage.removeItem('semper-tema'); }
    catch (e) { /* sem armazenamento: vale só nesta página */ }
  }
  // Grava no perfil para valer em qualquer aparelho.
  async function definirTema(t) {
    aplicarTema(t);
    document.querySelectorAll('[data-tema-rotulo]').forEach(el => el.textContent = 'Tema: ' + TEMAS[temaAtual()]);
    await SD.salvarPreferencia('tema', t);
  }

  // ---------- datas ----------
  const dataCurta = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
  const dataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  function relativo(iso) {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'agora';
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) { const d = Math.floor(s / 86400); return d === 1 ? 'ontem' : `há ${d} dias`; }
    return dataCurta(iso);
  }

  // ---------- ícones (traço fino, cor do texto) ----------
  const ICONES = {
    inicio: '<path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    equipe: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><circle cx="12" cy="11" r="2.5"/><path d="M8.5 16.5a4 4 0 017 0"/>',
    conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    sair: '<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
    tema: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    tabela: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    arquivo: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4"/>',
    lixeira: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    oculto: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    pontos: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    check: '<path d="M5 12l5 5L20 7"/>'
  };
  const icone = (n, tam = 17) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n] || ''}</svg>`;

  // ---------- avatares ("carinhas") ----------
  const PALETA = ['#5B6B7F', '#7A5C61', '#4F6D5A', '#8A6E3D', '#5E5A7A', '#3F6E73', '#7A4E3B', '#55617A'];
  function corDe(p) {
    if (p?.cor) return p.cor;
    let h = 0;
    for (const ch of String(p?.id || p?.nome || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETA[h % PALETA.length];
  }
  function iniciais(nome) {
    const w = String(nome || '?').trim().split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] || '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  }
  const avatar = (p, tam = 28) =>
    `<span class="avatar" style="--av:${tam}px;background:${corDe(p)}" title="${esc(p?.nome || 'Usuário removido')}" aria-label="${esc(p?.nome || 'Usuário removido')}">${esc(iniciais(p?.nome))}</span>`;
  function avatares(ids, equipe, max = 4, tam = 26) {
    const lista = (ids || []).map(id => equipe.find(p => p.id === id) || { id, nome: 'Usuário removido' });
    if (!lista.length) return '';
    const extra = lista.length - max;
    return `<span class="avatares">${lista.slice(0, max).map(p => avatar(p, tam)).join('')}${extra > 0
      ? `<span class="avatar mais" style="--av:${tam}px" title="${esc(lista.slice(max).map(p => p.nome).join(', '))}">+${extra}</span>` : ''}</span>`;
  }

  // ---------- avisos rápidos ----------
  // acao (opcional): { rotulo, fn } vira um botão no aviso (ex.: "Desfazer").
  function avisar(texto, tipo = 'ok', acao) {
    let caixa = document.getElementById('avisos');
    if (!caixa) { caixa = document.createElement('div'); caixa.id = 'avisos'; caixa.setAttribute('role', 'status'); document.body.appendChild(caixa); }
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.appendChild(document.createTextNode(texto));
    if (acao) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'toast-acao'; b.textContent = acao.rotulo;
      b.onclick = () => { el.remove(); acao.fn(); };
      el.appendChild(b);
    }
    caixa.appendChild(el);
    setTimeout(() => { el.classList.add('sai'); setTimeout(() => el.remove(), 300); }, tipo === 'erro' ? 6000 : acao ? 8000 : 3500);
    return el;
  }
  const falha = e => avisar(e?.message || 'Não foi possível concluir agora.', 'erro');

  // ---------- desfazer (Ctrl+Z) ----------
  // Cada ação que pode ser revertida registra como desfazê-la. Ctrl+Z (fora de campos de texto,
  // onde vale o desfazer do navegador) ou o botão do aviso desfazem a mais recente.
  const pilha = [];
  function registrarDesfazer(descricao, acao) {
    const item = { descricao, acao };
    pilha.push(item);
    if (pilha.length > 30) pilha.shift();
    return item;
  }
  async function executarDesfazer(item) {
    const i = pilha.indexOf(item);
    if (i < 0) return;
    pilha.splice(i, 1);
    item.aviso?.remove();
    try { await item.acao(); avisar(`Desfeito: ${item.descricao}.`); }
    catch (e) { falha(e); }
  }
  function desfazerUltimo() {
    if (pilha.length) executarDesfazer(pilha[pilha.length - 1]);
    else avisar('Não há ação para desfazer nesta página.');
  }
  // Mostra o aviso da ação feita, com o botão "Desfazer".
  function feito(texto, descricao, acao) {
    const item = registrarDesfazer(descricao, acao);
    item.aviso = avisar(texto, 'ok', { rotulo: 'Desfazer', fn: () => executarDesfazer(item) });
  }
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('.veu-janela')) return;
    e.preventDefault();
    desfazerUltimo();
  });

  // Ações salvas numa página e desfeitas em outra (ex.: salvar o cadastro e voltar à lista).
  // Ao desfazer, avisa a página pelo evento "semper:dados-mudaram".
  const CHAVE_DESFAZER = 'semper-desfazer';
  const DESFAZER_GUARDADO = {
    pessoaCriada: async r => {
      await SD.pessoasArquivar([r.id], true);
      const x = await SD.pessoasExcluir([r.id]);
      if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
    },
    pessoaAtualizada: r => SD.pessoaAtualizar(r.id, r.antes, r.resp)
  };
  function guardarDesfazer(registro) {
    try { sessionStorage.setItem(CHAVE_DESFAZER, JSON.stringify(registro)); } catch (e) { /* sem armazenamento: só não haverá desfazer */ }
  }
  function retomarDesfazer() {
    let r;
    try { r = JSON.parse(sessionStorage.getItem(CHAVE_DESFAZER)); sessionStorage.removeItem(CHAVE_DESFAZER); } catch (e) { return; }
    if (!r || !DESFAZER_GUARDADO[r.tipo]) return;
    feito(r.texto, r.descricao, async () => {
      await DESFAZER_GUARDADO[r.tipo](r);
      document.dispatchEvent(new CustomEvent('semper:dados-mudaram', { detail: r }));
    });
  }

  // ---------- janelas (confirmação, escolha) ----------
  // acoes: [{ rotulo, valor, tipo: 'pri' | 'perigo' | '' }]. Devolve o valor escolhido (null ao fechar).
  // Se o valor for uma função, ela recebe a janela e devolve o resultado (ex.: ler um campo).
  function janela({ titulo, html = '', acoes = [{ rotulo: 'Fechar', valor: null }] }) {
    return new Promise(resolve => {
      const veu = document.createElement('div');
      veu.className = 'veu-janela';
      const idT = 'jt' + Math.random().toString(36).slice(2);
      veu.innerHTML = `<div class="janela" role="dialog" aria-modal="true" aria-labelledby="${idT}">
          <h2 id="${idT}">${esc(titulo)}</h2><div class="janela-corpo">${html}</div>
          <div class="janela-acoes">${acoes.map((a, i) => `<button type="button" class="btn ${a.tipo === 'pri' ? 'pri' : a.tipo === 'perigo' ? 'perigo' : ''}" data-i="${i}">${esc(a.rotulo)}</button>`).join('')}</div>
        </div>`;
      const anterior = document.activeElement;
      const fim = valor => { document.removeEventListener('keydown', tecla, true); veu.remove(); anterior?.focus?.(); resolve(valor); };
      const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); fim(null); } };
      veu.addEventListener('click', e => { if (e.target === veu) fim(null); });
      veu.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
        const v = acoes[Number(b.dataset.i)].valor;
        fim(typeof v === 'function' ? v(veu) : v);
      });
      veu.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); veu.querySelector('.btn.pri')?.click(); }
      }));
      document.addEventListener('keydown', tecla, true);
      document.body.appendChild(veu);
      const campo = veu.querySelector('input, textarea, select');
      if (campo) { campo.focus(); campo.select?.(); } else (veu.querySelector('.btn.pri') || veu.querySelector('.btn')).focus();
    });
  }
  const confirmar = (titulo, texto, rotulo = 'Confirmar', perigo = false) =>
    janela({ titulo, html: `<p>${esc(texto)}</p>`, acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo, valor: true, tipo: perigo ? 'perigo' : 'pri' }] });

  // Botão de exclusão em dois cliques: o primeiro pede confirmação, o segundo executa.
  function botaoDuplo(btn, textoConfirmar, acao) {
    const original = btn.innerHTML;
    let armado = false, tempo;
    const desarmar = () => { armado = false; btn.classList.remove('confirmar'); btn.innerHTML = original; };
    btn.addEventListener('click', async () => {
      if (!armado) { armado = true; btn.classList.add('confirmar'); btn.textContent = textoConfirmar; clearTimeout(tempo); tempo = setTimeout(desarmar, 4000); return; }
      clearTimeout(tempo); desarmar(); await acao();
    });
    btn.addEventListener('blur', () => setTimeout(() => { if (armado && document.activeElement !== btn) desarmar(); }, 150));
  }

  function ocupado(btn, sim, texto) {
    if (!btn) return;
    if (sim) { btn.dataset.original = btn.innerHTML; btn.disabled = true; if (texto) btn.textContent = texto; }
    else { btn.disabled = false; if (btn.dataset.original) btn.innerHTML = btn.dataset.original; }
  }

  // ---------- painel do cartão (desliza da direita) ----------
  const Cartao = {
    abrir({ aoFechar } = {}) {
      Cartao.fechar(true);
      const veu = document.createElement('div');
      veu.className = 'veu'; veu.id = 'veuCartao';
      const painel = document.createElement('aside');
      painel.className = 'cartao-painel'; painel.id = 'cartaoPainel';
      painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-modal', 'true'); painel.tabIndex = -1;
      painel.innerHTML = `<button type="button" class="cartao-fechar" aria-label="Fechar">${icone('fechar', 18)}</button><div class="cartao-corpo"><p class="carregando">Carregando…</p></div>`;
      veu.onclick = () => Cartao.fechar();
      painel.querySelector('.cartao-fechar').onclick = () => Cartao.fechar();
      Cartao._tecla = e => { if (e.key === 'Escape' && !document.querySelector('.veu-janela')) Cartao.fechar(); };
      document.addEventListener('keydown', Cartao._tecla);
      Cartao._aoFechar = aoFechar;
      document.body.append(veu, painel);
      document.body.classList.add('sem-rolagem');
      requestAnimationFrame(() => { veu.classList.add('on'); painel.classList.add('on'); painel.focus(); });
      return painel.querySelector('.cartao-corpo');
    },
    fechar(silencioso) {
      const painel = document.getElementById('cartaoPainel'), veu = document.getElementById('veuCartao');
      if (!painel) return;
      document.removeEventListener('keydown', Cartao._tecla);
      painel.remove(); veu?.remove();
      document.body.classList.remove('sem-rolagem');
      const cb = Cartao._aoFechar; Cartao._aoFechar = null;
      if (!silencioso && cb) cb();
    },
    corpo: () => document.querySelector('#cartaoPainel .cartao-corpo')
  };

  // ---------- casca do app ----------
  const PAPEIS = { master: 'Master', admin: 'Administrador', usuario: 'Usuário' };

  function montarCasca(ativo, c) {
    const side = document.getElementById('side');
    const item = (id, href, rot) => `<a href="${url(href)}" ${ativo === id ? 'aria-current="page"' : ''}>${icone(id)}<span>${rot}</span></a>`;
    const p = c.perfil;
    side.innerHTML = `
      <a class="marca-app" href="${url('inicio/')}" aria-label="${esc(M.nome)} ${esc(M.submarca)}: início">
        <span class="ini">${esc(M.nome.trim().charAt(0))}</span>
        <span style="min-width:0"><b>${esc(c.escritorio?.nome || M.nome)}</b><small>${esc(M.submarca)}</small></span>
      </a>
      <nav class="nav" aria-label="Seções">
        ${item('inicio', 'inicio/', 'Início')}
        <div class="nav-linha">
          ${item('pessoas', 'pessoas/', 'Pessoas')}
          <a class="nav-mais" href="${url('pessoas/nova/')}" aria-label="Cadastrar pessoa" title="Cadastrar pessoa">${icone('mais', 15)}</a>
        </div>
        ${c.ehAdmin ? item('equipe', 'equipe/', 'Equipe e acessos') : ''}
      </nav>
      <div class="side-rodape">
        <div class="usuario">${avatar(p, 32)}<div style="min-width:0"><b>${esc(p.nome)}</b><span class="arroba">@${esc(p.usuario)}</span>
          <span class="papel ${p.papel === 'usuario' ? 'comum' : ''}">${PAPEIS[p.papel]}</span></div></div>
        <nav class="nav" aria-label="Conta">
          ${item('conta', 'inicio/#conta', 'Minha conta')}
          <button type="button" id="btnTema" title="Trocar entre automático, claro e escuro">${icone('tema')}<span data-tema-rotulo>Tema: ${TEMAS[temaAtual()]}</span></button>
          <button type="button" id="btnSair">${icone('sair')}<span>Sair</span></button>
        </nav>
      </div>`;
    document.getElementById('btnSair').onclick = async () => { await SD.sair(); location.href = url('./'); };
    document.getElementById('btnTema').onclick = () => {
      const ordem = ['auto', 'claro', 'escuro'];
      const proximo = ordem[(ordem.indexOf(temaAtual()) + 1) % ordem.length];
      definirTema(proximo);
      avisar(`Tema: ${TEMAS[proximo]}${proximo === 'auto' ? ' (segue o aparelho)' : ''}.`);
    };
    const topo = document.getElementById('topoCel');
    if (topo) {
      topo.innerHTML = `<button type="button" aria-label="Abrir menu" id="btnMenu">${icone('menu', 18)}</button>
        <b style="font-size:14px">${esc(M.nome)} <span style="color:var(--accent-ink)">${esc(M.submarca)}</span></b><span style="width:40px"></span>`;
      document.getElementById('btnMenu').onclick = e => { e.stopPropagation(); side.classList.toggle('aberta'); };
      document.addEventListener('click', e => { if (!side.contains(e.target)) side.classList.remove('aberta'); });
    }
  }

  // Exige login: devolve o contexto ou leva à página de entrada.
  async function exigirLogin() {
    let c;
    try { c = await SD.contexto(); }
    catch (e) {
      document.body.innerHTML = `<div class="aviso erro" style="margin:40px auto;max-width:520px">${esc(e.message)}</div>`;
      throw e;
    }
    if (!c) {
      location.replace(url('./?volta=' + encodeURIComponent(location.pathname + location.search)));
      return new Promise(() => {});
    }
    if (!c.perfil) {
      await SD.sair();
      location.replace(url('./?desativado'));
      return new Promise(() => {});
    }
    aplicarTema(c.perfil.preferencias?.tema || 'auto');
    setTimeout(retomarDesfazer, 0);
    return c;
  }

  const titulo = nome => { document.title = `${nome} · ${M.nome} ${M.submarca}`; };

  // ---------- página de módulo ----------
  // Estrutura única de toda página de módulo (pessoas, contratos, demandas, tarefas, processos...):
  // cabeçalho com a ação principal na altura do título, barra de busca e filtros, troca Tabela/Kanban,
  // área da lista e barra de ações em lote. O módulo só declara o conteúdo; o desenho vem daqui e do
  // estilo comum (DESIGN.md, "Página de módulo"). Nunca escreva essa estrutura à mão numa página.
  const VISOES = { tabela: 'Tabela', kanban: 'Kanban' };
  function paginaModulo(alvo, { olho = '', titulo: nome, acao, busca = 'Buscar', filtros = [], visoes = ['tabela', 'kanban'] }) {
    alvo.className = 'miolo largo';
    alvo.innerHTML = `
      <header class="cabeca">
        ${olho ? `<p class="olho">${esc(olho)}</p>` : ''}
        <div class="cabeca-linha">
          <h1 class="titulo">${esc(nome)}<span class="ponto">.</span></h1>
          ${acao ? `<a class="btn pri cabeca-acao" id="btnAcao" href="${esc(acao.href)}" title="${esc(acao.rotulo)}" aria-label="${esc(acao.rotulo)}">${icone('mais', 18)}<span class="cabeca-acao-rotulo">${esc(acao.rotulo)}</span></a>` : ''}
        </div>
        <p class="lead" id="lead">&nbsp;</p>
      </header>
      <div class="barra-ferr" role="search">
        <label class="busca-campo">${icone('buscar', 18)}<span class="sr">Buscar</span>
          <input id="busca" type="search" placeholder="${esc(busca)}" autocomplete="off"></label>
        ${filtros.map(f => `<select class="filtro" id="${esc(f.id)}" aria-label="${esc(f.rotulo)}">${f.opcoes
          .map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`).join('')}
        ${visoes.length > 1 ? `<div class="abas" role="group" aria-label="Visualização">${visoes.map(v =>
          `<button type="button" data-visao="${v}">${icone(v, 15)}${VISOES[v]}</button>`).join('')}</div>` : ''}
      </div>
      <div id="visao"><p class="carregando">Carregando…</p></div>
      <div class="lote" id="lote" hidden></div>`;
    const el = id => alvo.querySelector('#' + id);
    return {
      lead: el('lead'), busca: el('busca'), visao: el('visao'), lote: el('lote'), acao: el('btnAcao'),
      filtro: id => el(id),
      botoesVisao: [...alvo.querySelectorAll('[data-visao]')],
      marcarVisao: v => alvo.querySelectorAll('[data-visao]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.visao === v)))
    };
  }
  const parametro = nome => new URLSearchParams(location.search).get(nome);
  function atrasar(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  window.UI = {
    RAIZ, url, esc, icone, avatar, avatares, corDe, iniciais, avisar, falha, janela, confirmar, botaoDuplo, ocupado,
    feito, registrarDesfazer, desfazerUltimo, guardarDesfazer, TEMAS, temaAtual, definirTema, paginaModulo,
    Cartao, montarCasca, exigirLogin, titulo, parametro, atrasar, dataCurta, dataHora, relativo, PAPEIS
  };
})();
