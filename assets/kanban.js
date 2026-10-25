// Quadro kanban comum a todos os módulos, no modelo do Trello: as colunas ocupam a altura da tela
// e cada lista rola dentro da própria coluna. Colunas são do escritório; cada usuário só as oculta para si.
(function () {
  const { esc, icone, janela, falha } = window.UI;
  const normal = t => String(t || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /*
    opcoes = {
      colunas: [{ id, nome, ordem, oculta, criado_por }],
      sugestoes: ['nome', ...],
      rotuloSemEtapa: 'Sem etapa',           // coluna fixa para itens sem coluna (id null)
      carregar: async (colunaId, deslocamento) => ({ linhas, total }),
      ordemDe: item => número ou null,
      cartao: item => html,
      aoAbrir: item => {},
      aoMover: async (item, colunaId, ordem) => {},
      aoCriarColuna: async (nome, ordem) => coluna,
      aoOcultar: async (coluna, ocultar) => {},
      podeRenomear: coluna => bool, aoRenomear: async (coluna, nome) => {},
      podeExcluir: coluna => bool,  aoExcluir: async coluna => {},
      podeReordenar: () => bool,    aoReordenar: async (coluna, ordem, ordemAnterior) => {},   // a ordem vale para todo o escritório
      aoAdicionar: colunaId => {}      // botão "Adicionar" no pé da coluna
    }
  */
  function montar(alvo, opcoes) {
    const o = Object.assign({ rotuloSemEtapa: 'Sem etapa', sugestoes: [], podeRenomear: () => false, podeExcluir: () => false,
      podeReordenar: () => false }, opcoes);
    let colunas = o.colunas.slice().sort((a, b) => a.ordem - b.ordem);
    const estado = new Map();   // colunaId -> { itens, total }
    const chave = id => id || 'sem';

    // A altura vem só do layout (estilo.css, "com-quadro"): o quadro preenche o que sobra da tela.
    alvo.innerHTML = '<div class="quadro" role="region" aria-label="Quadro"></div>';
    alvo.classList.add('area-quadro');
    document.body.classList.add('com-quadro');
    const quadro = alvo.querySelector('.quadro');

    function htmlColuna(c) {
      const id = c ? c.id : null;
      const nome = c ? c.nome : o.rotuloSemEtapa;
      return `<section class="coluna${c ? '' : ' sem-etapa'}" data-coluna="${chave(id)}">
        <header class="coluna-topo"${c && o.podeReordenar() ? ' draggable="true" title="Arraste para mudar a ordem das colunas"' : ''}>
          <h3 title="${esc(nome)}">${esc(nome)}</h3><span class="coluna-n">…</span>
          ${c ? `<button type="button" class="coluna-menu" aria-label="Opções da coluna ${esc(nome)}">${icone('pontos', 16)}</button>` : ''}
        </header>
        <div class="coluna-lista" role="list" aria-label="${esc(nome)}"><p class="coluna-vazia">Carregando…</p></div>
        <footer class="coluna-pe">
          <button type="button" class="coluna-carregar" hidden>Carregar mais</button>
          ${o.aoAdicionar ? `<button type="button" class="coluna-add">${icone('mais', 15)} Adicionar</button>` : ''}
        </footer>
      </section>`;
    }

    function desenhar() {
      const visiveis = colunas.filter(c => !c.oculta);
      const ocultas = colunas.filter(c => c.oculta);
      quadro.innerHTML = [htmlColuna(null), ...visiveis.map(htmlColuna)].join('') + `
        <section class="coluna nova-coluna">
          <form class="nova-form" autocomplete="off">
            <label class="rotulo-caps" for="novaColuna">Nova coluna</label>
            <input id="novaColuna" list="sugestoesColunas" maxlength="60" placeholder="Nome da coluna">
            <datalist id="sugestoesColunas"></datalist>
            <button type="submit" class="btn pri btn-sm">Criar coluna</button>
          </form>
          ${ocultas.length ? `<div class="ocultas"><p class="rotulo-caps">Ocultas para você</p>${ocultas.map(c =>
            `<button type="button" class="chip-oculta" data-mostrar="${c.id}" title="Mostrar de novo">${icone('olho', 14)} ${esc(c.nome)}</button>`).join('')}</div>` : ''}
        </section>`;
      preencherSugestoes();
      ligarColunas();
      carregarTodas();
    }

    function preencherSugestoes() {
      const existentes = new Set(colunas.map(c => normal(c.nome)));
      const opcoesLista = [
        ...colunas.filter(c => c.oculta).map(c => `<option value="${esc(c.nome)}">oculta</option>`),
        ...o.sugestoes.filter(s => !existentes.has(normal(s))).map(s => `<option value="${esc(s)}"></option>`)
      ];
      quadro.querySelector('#sugestoesColunas').innerHTML = opcoesLista.join('');
    }

    async function carregar(id, mais = false) {
      const k = chave(id);
      const atual = estado.get(k) || { itens: [], total: 0 };
      const col = quadro.querySelector(`[data-coluna="${k}"]`);
      if (!col) return;
      try {
        const { linhas, total } = await o.carregar(id, mais ? atual.itens.length : 0);
        const itens = mais ? atual.itens.concat(linhas) : linhas;
        estado.set(k, { itens, total });
        desenharLista(id);
      } catch (e) {
        col.querySelector('.coluna-lista').innerHTML = `<p class="coluna-vazia erro">${esc(e.message)}</p>`;
      }
    }
    const carregarTodas = () => { carregar(null); colunas.filter(c => !c.oculta).forEach(c => carregar(c.id)); };

    function desenharLista(id) {
      const k = chave(id), col = quadro.querySelector(`[data-coluna="${k}"]`);
      if (!col) return;
      const { itens, total } = estado.get(k);
      col.querySelector('.coluna-n').textContent = total.toLocaleString('pt-BR');
      const lista = col.querySelector('.coluna-lista');
      lista.innerHTML = itens.length
        ? itens.map(it => `<article class="kcartao" role="listitem" tabindex="0" draggable="true" data-item="${esc(it.id)}">${o.cartao(it)}</article>`).join('')
        : '<p class="coluna-vazia">Nenhum item.</p>';
      const btn = col.querySelector('.coluna-carregar');
      btn.hidden = itens.length >= total;
      btn.textContent = `Carregar mais (${(total - itens.length).toLocaleString('pt-BR')})`;
      lista.querySelectorAll('.kcartao').forEach(el => {
        const it = itens.find(x => String(x.id) === el.dataset.item);
        el.onclick = () => o.aoAbrir(it);
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.aoAbrir(it); } };
        el.ondragstart = e => { arrastando = { item: it, de: id }; el.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(it.id)); };
        el.ondragend = () => { el.classList.remove('arrastando'); limparMarcador(); arrastando = null; };
      });
    }

    // ---------- arrastar e soltar ----------
    let arrastando = null;
    const marcador = document.createElement('div');
    marcador.className = 'kmarcador';
    const limparMarcador = () => marcador.remove();

    function posicao(lista, y) {
      const cartoes = [...lista.querySelectorAll('.kcartao:not(.arrastando)')];
      return cartoes.find(c => y < c.getBoundingClientRect().top + c.offsetHeight / 2) || null;
    }

    function ligarColunas() {
      quadro.querySelectorAll('.coluna[data-coluna]').forEach(col => {
        const k = col.dataset.coluna, id = k === 'sem' ? null : k;
        const lista = col.querySelector('.coluna-lista');
        lista.ondragover = e => {
          if (!arrastando) return;
          e.preventDefault();
          const antes = posicao(lista, e.clientY);
          lista.querySelector('.coluna-vazia')?.remove();
          if (antes) lista.insertBefore(marcador, antes); else lista.appendChild(marcador);
          rolarBordas(e.clientX);
        };
        lista.ondragleave = e => { if (!lista.contains(e.relatedTarget)) limparMarcador(); };
        lista.ondrop = e => { e.preventDefault(); if (arrastando) soltar(id, lista); };
        col.querySelector('.coluna-carregar').onclick = () => carregar(id, true);
        col.querySelector('.coluna-add')?.addEventListener('click', () => o.aoAdicionar(id));
        col.querySelector('.coluna-menu')?.addEventListener('click', e => { e.stopPropagation(); abrirMenu(colunas.find(c => c.id === id), e.currentTarget); });
        const topo = col.querySelector('.coluna-topo[draggable]');
        if (topo) {
          topo.ondragstart = e => {
            if (arrastando) return;
            arrastandoColuna = colunas.find(c => c.id === id);
            col.classList.add('arrastando-col');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'coluna:' + id);
          };
          topo.ondragend = () => { col.classList.remove('arrastando-col'); marcadorColuna.remove(); arrastandoColuna = null; };
        }
      });
      // Soltar uma coluna arrastada: a marca vertical mostra onde ela vai ficar.
      quadro.ondragover = e => {
        if (!arrastandoColuna) return;
        e.preventDefault();
        const antes = colunaDepoisDe(e.clientX);
        quadro.insertBefore(marcadorColuna, antes || quadro.querySelector('.nova-coluna'));
        rolarBordas(e.clientX);
      };
      quadro.ondrop = e => {
        if (!arrastandoColuna) return;
        e.preventDefault();
        const seguinte = marcadorColuna.nextElementSibling;
        marcadorColuna.remove();
        const destino = seguinte?.dataset.coluna && seguinte.dataset.coluna !== 'sem' ? colunas.find(c => c.id === seguinte.dataset.coluna) : null;
        posicionarColuna(arrastandoColuna, destino);
      };
      const form = quadro.querySelector('.nova-form');
      form.onsubmit = e => { e.preventDefault(); criarColuna(form.querySelector('input')); };
      quadro.querySelectorAll('[data-mostrar]').forEach(b => b.onclick = () => mostrarDeNovo(colunas.find(c => c.id === b.dataset.mostrar)));
    }

    // ---------- ordem das colunas ----------
    let arrastandoColuna = null;
    const marcadorColuna = document.createElement('div');
    marcadorColuna.className = 'kmarcador-col';

    // Primeira coluna (das que podem ser movidas) cujo meio está à direita do ponteiro.
    function colunaDepoisDe(x) {
      const els = [...quadro.querySelectorAll('.coluna[data-coluna]:not(.sem-etapa):not(.arrastando-col)')];
      return els.find(el => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2; }) || null;
    }

    // Coloca a coluna antes de "antesDe" (ou no fim, se null), entre as colunas visíveis.
    async function posicionarColuna(c, antesDe) {
      if (!c || c === antesDe) return;
      const visiveis = colunas.filter(x => !x.oculta && x !== c);
      const lugar = antesDe ? visiveis.indexOf(antesDe) : visiveis.length;
      const ant = visiveis[lugar - 1], prox = visiveis[lugar];
      const atuais = colunas.filter(x => !x.oculta);
      if (atuais[atuais.indexOf(c) - 1] === ant && atuais[atuais.indexOf(c) + 1] === prox) return;   // não mudou
      const anterior = c.ordem;
      c.ordem = ant && prox ? (ant.ordem + prox.ordem) / 2 : ant ? ant.ordem + 1 : prox ? prox.ordem - 1 : c.ordem;
      colunas.sort((a, b) => a.ordem - b.ordem);
      const el = quadro.querySelector(`[data-coluna="${c.id}"]`);
      quadro.insertBefore(el, prox ? quadro.querySelector(`[data-coluna="${prox.id}"]`) : quadro.querySelector('.nova-coluna'));
      try { await o.aoReordenar(c, c.ordem, anterior); }
      catch (e) {
        falha(e);
        c.ordem = anterior; colunas.sort((a, b) => a.ordem - b.ordem); desenhar();
      }
    }
    function moverColuna(c, passo) {
      const visiveis = colunas.filter(x => !x.oculta);
      const i = visiveis.indexOf(c);
      if (passo < 0 && i > 0) posicionarColuna(c, visiveis[i - 1]);
      if (passo > 0 && i < visiveis.length - 1) posicionarColuna(c, visiveis[i + 2] || null);
    }

    function rolarBordas(x) {
      const r = quadro.getBoundingClientRect();
      if (x < r.left + 60) quadro.scrollLeft -= 18;
      else if (x > r.right - 60) quadro.scrollLeft += 18;
    }

    async function soltar(paraId, lista) {
      const { item, de } = arrastando;
      const destino = estado.get(chave(paraId));
      const seguinteEl = marcador.nextElementSibling?.classList.contains('kcartao') ? marcador.nextElementSibling : null;
      limparMarcador();
      const origem = estado.get(chave(de));
      origem.itens = origem.itens.filter(x => x !== item);
      const idx = seguinteEl ? destino.itens.findIndex(x => String(x.id) === seguinteEl.dataset.item) : destino.itens.length;
      const lugar = idx < 0 ? destino.itens.length : idx;
      const ant = destino.itens[lugar - 1], prox = destino.itens[lugar];
      const oa = ant ? o.ordemDe(ant) : null, op = prox ? o.ordemDe(prox) : null;
      const numeros = destino.itens.map(o.ordemDe).filter(n => typeof n === 'number');
      let ordem;
      if (oa != null && op != null) ordem = (oa + op) / 2;
      else if (oa != null) ordem = oa + 1;
      else if (op != null) ordem = op - 1;
      else ordem = (numeros.length ? Math.max(...numeros) : 0) + 1;
      destino.itens.splice(lugar, 0, item);
      if (de !== paraId) { origem.total -= 1; destino.total += 1; }
      desenharLista(de); if (de !== paraId) desenharLista(paraId);
      try { await o.aoMover(item, paraId, ordem); }
      catch (e) { falha(e); carregar(de); carregar(paraId); }
    }

    // ---------- menu da coluna ----------
    function abrirMenu(c, botao) {
      document.querySelector('.kmenu')?.remove();
      const menu = document.createElement('div');
      menu.className = 'kmenu';
      menu.setAttribute('role', 'menu');
      const visiveis = colunas.filter(x => !x.oculta), i = visiveis.indexOf(c);
      menu.innerHTML = `${o.podeReordenar() && i > 0 ? `<button type="button" role="menuitem" data-a="esquerda">${icone('voltar', 15)} Mover para a esquerda</button>` : ''}
        ${o.podeReordenar() && i < visiveis.length - 1 ? `<button type="button" role="menuitem" data-a="direita">${icone('seta', 15)} Mover para a direita</button>` : ''}
        <button type="button" role="menuitem" data-a="ocultar">${icone('oculto', 15)} Ocultar para mim</button>
        ${o.podeRenomear(c) ? `<button type="button" role="menuitem" data-a="renomear">${icone('editar', 15)} Renomear</button>` : ''}
        ${o.podeExcluir(c) ? `<button type="button" role="menuitem" data-a="excluir" class="perigo">${icone('lixeira', 15)} Excluir coluna</button>` : ''}`;
      document.body.appendChild(menu);
      const r = botao.getBoundingClientRect();
      menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
      menu.style.left = Math.min(r.left + window.scrollX, window.innerWidth - menu.offsetWidth - 12) + 'px';
      const fechar = () => { menu.remove(); document.removeEventListener('click', fechar); };
      setTimeout(() => document.addEventListener('click', fechar), 0);
      menu.querySelector('button')?.focus();
      menu.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
        fechar();
        try {
          if (b.dataset.a === 'esquerda') moverColuna(c, -1);
          if (b.dataset.a === 'direita') moverColuna(c, 1);
          if (b.dataset.a === 'ocultar') { await o.aoOcultar(c, true); c.oculta = true; desenhar(); }
          if (b.dataset.a === 'renomear') await renomear(c);
          if (b.dataset.a === 'excluir') await excluir(c);
        } catch (e) { falha(e); }
      });
    }

    async function renomear(c) {
      const novo = await pedirTexto('Renomear coluna', c.nome);
      if (!novo || novo === c.nome) return;
      if (colunas.some(x => x !== c && normal(x.nome) === normal(novo))) throw new Error('Já existe uma coluna com esse nome neste quadro.');
      await o.aoRenomear(c, novo);
      c.nome = novo; desenhar();
    }
    async function excluir(c) {
      const ok = await janela({ titulo: 'Excluir coluna', html: `<p>A coluna <b>${esc(c.nome)}</b> sai do quadro de todo o escritório. Os itens dela vão para "${esc(o.rotuloSemEtapa)}"; nada é apagado.</p>`,
        acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Excluir coluna', valor: true, tipo: 'perigo' }] });
      if (!ok) return;
      await o.aoExcluir(c);
      colunas = colunas.filter(x => x !== c);
      desenhar();
    }
    const pedirTexto = (titulo, valor) => janela({
      titulo, html: `<input class="campo" maxlength="60" value="${esc(valor)}" aria-label="${esc(titulo)}">`,
      acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar', tipo: 'pri', valor: j => j.querySelector('input').value.trim().replace(/\s+/g, ' ') }]
    });

    async function mostrarDeNovo(c) {
      try { await o.aoOcultar(c, false); c.oculta = false; desenhar(); }
      catch (e) { falha(e); }
    }

    async function criarColuna(input) {
      const nome = input.value.trim().replace(/\s+/g, ' ');
      if (!nome) { input.focus(); return; }
      const igual = colunas.find(c => normal(c.nome) === normal(nome));
      if (igual && igual.oculta) {
        const ver = await janela({ titulo: 'Coluna já existente', html: `<p>A coluna <b>${esc(igual.nome)}</b> já existe e está oculta para você. Deseja somente visualizá-la?</p>`,
          acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Visualizar coluna', valor: true, tipo: 'pri' }] });
        if (ver) await mostrarDeNovo(igual);
        return;
      }
      if (igual) { falha(new Error(`A coluna "${igual.nome}" já existe neste quadro. Não é possível criar outra com o mesmo nome.`)); return; }
      const btn = input.form.querySelector('button');
      btn.disabled = true;
      try {
        const ordem = (colunas.length ? Math.max(...colunas.map(c => c.ordem)) : 0) + 1;
        const nova = await o.aoCriarColuna(nome, ordem);
        colunas.push(nova);
        desenhar();
        quadro.scrollLeft = quadro.scrollWidth;
      } catch (e) { falha(e); btn.disabled = false; }
    }

    desenhar();
    return {
      recarregar: carregarTodas,
      destruir: () => { alvo.classList.remove('area-quadro'); document.body.classList.remove('com-quadro'); }
    };
  }

  window.Kanban = { montar };
})();
