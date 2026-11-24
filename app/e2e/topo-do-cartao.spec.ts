// O topo dos cartões (#382, pedido do dono de 19/11): em demanda, tarefa, processo, compromisso, contrato e pessoa, o topo fica
// como o da anotação. Numa linha só: à esquerda o tipo e o código; à direita a equipe em bolinhas (na pessoa, os responsáveis: #387), o ícone de
// etiqueta, o lápis e o menu ⋯ (Arquivar, Excluir), junto dos botões da janela. Logo abaixo, os selos das etiquetas; depois o
// título. A seção "Etiquetas" do meio do cartão saiu. Nada do topo fica por baixo dos botões da janela, em nenhum formato.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mauro (master).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirUsuario, acoesNoMenuDoCartao, entrarComo, menuDoCartao, tirarDoCartao } from './ajudantes';

type Caixa = { x: number; y: number; width: number; height: number };
/** Se duas caixas se cruzam (encostar não conta). */
const cruzam = (a: Caixa, b: Caixa) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Os seis cartões com o topo comum: onde abrir, a linha da semente, o tipo no topo e se tem equipe em bolinhas. */
/** `menu`: as ações a mais do ⋯ antes de Arquivar (a tarefa copia para outra demanda, #312). */
const CARTOES: { cartao: string; endereco: string; linha: string; tipo: string; equipe: boolean; menu?: string[] }[] = [
  { cartao: 'tarefa', endereco: '/tarefas/', linha: 'Emitir a GRU', tipo: 'Tarefa', equipe: true, menu: ['Copiar para outra demanda'] },
  { cartao: 'demanda', endereco: '/demandas/', linha: 'Registro de marca', tipo: 'Demanda', equipe: true },
  { cartao: 'processo', endereco: '/processos/judicial/', linha: 'JOSÉ DA SILVA TESTE', tipo: 'Judicial', equipe: true },
  { cartao: 'compromisso', endereco: '/agenda/', linha: 'Reunião de equipe', tipo: 'Reunião', equipe: true },
  { cartao: 'contrato', endereco: '/contratos/', linha: 'MARIA APARECIDA EXEMPLO', tipo: 'Quota litis', equipe: true },
  { cartao: 'pessoa', endereco: '/pessoas/', linha: 'MARIA APARECIDA EXEMPLO', tipo: 'Pessoa física', equipe: true }
];

/** Abre o cartão pela tabela do módulo, pela linha que tem `linha`. */
async function abrirCartao(page: Page, endereco: string, linha: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().getByText(linha).first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  return cartao;
}

/** A caixa do texto de um elemento (e não a dele, que num título vai de uma borda à outra, mesmo com o texto curto). */
const caixaDoTexto = (alvo: Locator) => alvo.evaluate(e => { const r = document.createRange(); r.selectNodeContents(e); const c = r.getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });

/**
 * Volta o cartão ao começo antes de medir: os botões da janela ficam presos no alto enquanto o conteúdo rola por baixo deles (de
 * propósito); o que se confere aqui é o topo parado, como abre.
 */
const voltarAoComeco = (cartao: Locator) => cartao.evaluate(d => { [d, ...d.querySelectorAll('*')].forEach(e => { if (e.scrollTop) e.scrollTop = 0; }); });

/**
 * Espera as animações do cartão acabarem (as que começam enquanto se espera também), para medir tudo parado. As que se repetem
 * sem fim (o "carregando") ficam de fora: não acabam nunca.
 */
const esperarAsAnimacoes = (cartao: Locator) => cartao.evaluate(async () => {
  const quePassam = () => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
  for (let animacoes = quePassam(); animacoes.length; animacoes = quePassam()) {
    await Promise.all(animacoes.map(a => a.finished.catch(() => undefined)));
  }
});

/** Os botões redondos visíveis no alto: os da janela (o formato e o X) e os do cartão (a etiqueta, o lápis e o ⋯). */
async function botoesDoAlto(cartao: Locator) {
  const nomes = ['Abrir no centro da tela', 'Abrir ao lado', 'Fechar', 'Escolher etiquetas', 'Editar'];
  const caixas: { nome: string; caixa: Caixa }[] = [];
  for (const nome of nomes) {
    const b = cartao.getByRole('button', { name: nome, exact: true });
    if (await b.count() && await b.isVisible()) caixas.push({ nome, caixa: (await b.boundingBox())! });
  }
  const mais = menuDoCartao(cartao);
  if (await mais.count()) caixas.push({ nome: '⋯', caixa: (await mais.boundingBox())! });
  return caixas;
}

/** O que fica no topo e não pode ficar por baixo de botão nenhum: o tipo, o código, a equipe, os selos e o título. */
async function conteudoDoTopo(cartao: Locator, tipo: string) {
  const partes: { nome: string; alvo: Locator }[] = [
    { nome: 'tipo', alvo: cartao.getByText(tipo, { exact: true }).first() },
    { nome: 'equipe', alvo: cartao.getByRole('group', { name: 'Equipe', exact: true }) },
    { nome: 'etiquetas', alvo: cartao.getByRole('group', { name: 'Etiquetas' }) },
    { nome: 'título', alvo: cartao.getByRole('heading', { level: 2 }) },
    { nome: 'modo de edição', alvo: cartao.getByRole('status').filter({ hasText: 'Modo de edição' }) }
  ];
  const caixas: { nome: string; caixa: Caixa }[] = [];
  for (const { nome, alvo } of partes) if (await alvo.count() && await alvo.isVisible()) caixas.push({ nome, caixa: nome === 'título' ? await caixaDoTexto(alvo) : (await alvo.boundingBox())! });
  return caixas;
}

/** Nada do conteúdo do topo cruza um botão do alto (o "modo de edição" fica no lugar dos botões do cartão: só não cruza os da janela). */
async function nadaPorBaixoDosBotoes(cartao: Locator, tipo: string) {
  await voltarAoComeco(cartao);
  const botoes = await botoesDoAlto(cartao), conteudo = await conteudoDoTopo(cartao, tipo);
  expect(botoes.map(b => b.nome)).toContain('Fechar');
  const cruzados = conteudo.flatMap(c => botoes.filter(b => cruzam(c.caixa, b.caixa)).map(b => `${c.nome} × ${b.nome}`));
  expect(cruzados).toEqual([]);
}

/** Cria uma etiqueta pelo ícone do topo; ela já fica marcada no cartão. */
async function criarEtiqueta(page: Page, cartao: Locator, texto: string) {
  await cartao.getByRole('button', { name: 'Escolher etiquetas' }).click();
  const escolha = page.getByRole('dialog', { name: 'Escolher etiquetas' });
  await escolha.getByRole('textbox', { name: 'Texto' }).fill(texto);
  await escolha.getByRole('button', { name: 'Criar etiqueta' }).click();
  await page.keyboard.press('Escape');
  await expect(cartao.getByRole('group', { name: 'Etiquetas' }).getByText(texto, { exact: true })).toBeVisible();
}

test.describe('O topo dos cartões, como o da anotação', () => {
  for (const { cartao: nome, endereco, linha, tipo, equipe, menu = [] } of CARTOES) {
    test(`dado o cartão de ${nome}, quando abre, então a equipe, a etiqueta e o ⋯ ficam no alto, e a etiqueta escolhida aparece entre o topo e o título`, async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, endereco, linha);
      const titulo = (await cartao.getByRole('heading', { level: 2 }).boundingBox())!;
      // Então: tudo do topo acima do título, e sem a seção "Etiquetas" no meio do cartão
      for (const alvo of [cartao.getByText(tipo, { exact: true }).first(), cartao.getByRole('button', { name: 'Escolher etiquetas' }), menuDoCartao(cartao), cartao.getByRole('button', { name: 'Editar', exact: true })]) {
        const caixa = (await alvo.boundingBox())!;
        expect(caixa.y + caixa.height).toBeLessThanOrEqual(titulo.y);
      }
      if (equipe) {
        const daEquipe = (await cartao.getByRole('group', { name: 'Equipe', exact: true }).boundingBox())!;
        expect(daEquipe.y + daEquipe.height).toBeLessThanOrEqual(titulo.y);
      } else await expect(cartao.getByRole('group', { name: 'Equipe', exact: true })).toHaveCount(0);
      await expect(cartao.getByRole('heading', { name: 'Etiquetas', level: 3 })).toHaveCount(0);
      await expect(cartao.getByRole('group', { name: 'Etiquetas' })).toHaveCount(0);
      expect(await acoesNoMenuDoCartao(page, cartao)).toEqual([...menu, 'Arquivar']);
      // Quando
      await criarEtiqueta(page, cartao, 'Prioridade');
      // Então: os selos entre o topo e o título
      const selos = (await cartao.getByRole('group', { name: 'Etiquetas' }).boundingBox())!;
      const tipoNoTopo = (await cartao.getByText(tipo, { exact: true }).first().boundingBox())!;
      const tituloDepois = (await cartao.getByRole('heading', { level: 2 }).boundingBox())!;
      expect(selos.y).toBeGreaterThanOrEqual(tipoNoTopo.y + tipoNoTopo.height);
      expect(selos.y + selos.height).toBeLessThanOrEqual(tituloDepois.y);
      // Quando: tira pelo x do selo (ele aparece com o mouse em cima)
      await cartao.getByRole('group', { name: 'Etiquetas' }).getByText('Prioridade', { exact: true }).hover();
      await tirarDoCartao(page, cartao.getByRole('button', { name: 'Tirar a etiqueta Prioridade' }));
      // Então: sem etiquetas, a linha some
      await expect(cartao.getByRole('group', { name: 'Etiquetas' })).toHaveCount(0);
    });
  }

  test('dado quem só lê a tarefa, quando abre, então vê a equipe e as etiquetas, mas sem o ícone, sem o x, sem o lápis e sem o ⋯', async ({ page }) => {
    // Dado: o Mauro põe uma etiqueta em "Renovar a procuração", que é da Ana (o Mauro participa); o Bruno não está nela
    let cartao = await abrirCartao(page, '/tarefas/', 'Renovar a procuração');
    await criarEtiqueta(page, cartao, 'Urgente');
    await entrarComo(page, 'u-bruno');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    // Quando
    cartao = await abrirCartao(page, '/tarefas/', 'Renovar a procuração');
    // Então
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true })).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Etiquetas' }).getByText('Urgente', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Tirar a etiqueta Urgente' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Escolher etiquetas' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(menuDoCartao(cartao)).toHaveCount(0);
  });
});

test.describe('O topo não fica por baixo dos botões da janela', () => {
  const FORMATOS = [
    { formato: 'ao lado', tela: { width: 1440, height: 900 }, centro: false },
    { formato: 'no centro', tela: { width: 1440, height: 900 }, centro: true },
    { formato: 'na janela estreita', tela: { width: 900, height: 900 }, centro: true },
    { formato: 'no celular', tela: { width: 390, height: 844 }, centro: false }
  ];
  for (const { formato, tela, centro } of FORMATOS) {
    test(`dados os seis cartões ${formato}, quando abrem com uma etiqueta e depois em edição, então nada do topo cruza os botões`, async ({ page }) => {
      await page.setViewportSize(tela);
      for (const { cartao: nome, endereco, linha, tipo } of CARTOES) {
        // Dado
        const cartao = await abrirCartao(page, endereco, linha);
        if (centro && await cartao.getByRole('button', { name: 'Abrir no centro da tela' }).isVisible()) await cartao.getByRole('button', { name: 'Abrir no centro da tela' }).click();
        // Cada etiqueta tem um nome só: a segunda com o mesmo nome seria recusada.
        await criarEtiqueta(page, cartao, `Revisar ${nome}`);
        // Então
        await nadaPorBaixoDosBotoes(cartao, tipo);
        // Quando: em edição, o "Modo de edição" fica no lugar dos botões do cartão
        await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
        await expect(cartao.getByRole('status').filter({ hasText: 'Modo de edição' })).toBeVisible();
        // O formulário do lápis aparece um instante depois, com a animação de entrada: mede-se com ele já parado.
        await expect(cartao.getByRole('button', { name: 'Cancelar' })).toBeVisible();
        await esperarAsAnimacoes(cartao);
        // Então
        await nadaPorBaixoDosBotoes(cartao, tipo);
        const modo = (await cartao.getByRole('status').filter({ hasText: 'Modo de edição' }).boundingBox())!;
        const doTipo = (await cartao.getByText(tipo, { exact: true }).first().boundingBox())!;
        expect(cruzam(modo, doTipo)).toBe(false);
        await cartao.getByRole('button', { name: 'Cancelar' }).click();
        await cartao.getByRole('button', { name: 'Fechar' }).click();
        await expect(cartao).toHaveCount(0);
      }
    });
  }

  test('dado o pior caso (10 participantes, 4 grupos de nome longo e 6 etiquetas), quando a tarefa abre ao lado e no celular, então nada cruza os botões e o título continua na tela', async ({ page }) => {
    // Dado: o banco fictício recebe o pior caso direto (a equipe da semente tem só 4 pessoas: as outras aparecem como "Usuário removido")
    await page.goto('/tarefas/');
    await page.evaluate(() => {
      type Banco = { tarefas: { codigo: string; participantes: string[]; grupos?: string[]; id: string }[]; gruposDaEquipe: { id: string; nome: string; integrantes: string[] }[];
        etiquetas: { id: string; cor: string; texto: string; criado_por: string }[]; etiquetasAplicadas: { modulo: string; cartao_id: string; etiqueta_id: string }[] };
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as Banco;
      const t = bd.tarefas.find(x => x.codigo === 'C0FFEE12')!;
      t.participantes = ['u-bruno', 'u-ana', 'u-carla', ...Array.from({ length: 7 }, (_, i) => `u-saiu-${i}`)];
      bd.gruposDaEquipe = Array.from({ length: 4 }, (_, i) => ({ id: `g-${i}`, nome: `Núcleo de contencioso cível e trabalhista ${i + 1}`, integrantes: ['u-ana'] }));
      t.grupos = bd.gruposDaEquipe.map(g => g.id);
      const cores = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo'];
      bd.etiquetas = [...(bd.etiquetas ?? []), ...cores.map((cor, i) => ({ id: `e-pior-${i}`, cor, texto: `Etiqueta comprida ${i + 1}`, criado_por: 'u-master' }))];
      bd.etiquetasAplicadas = [...(bd.etiquetasAplicadas ?? []), ...cores.map((_, i) => ({ modulo: 'tarefas', cartao_id: t.id, etiqueta_id: `e-pior-${i}` }))];
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    for (const tela of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(tela);
      // Quando
      const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
      await expect(cartao.getByRole('group', { name: 'Etiquetas' }).getByText('Etiqueta comprida 6')).toBeVisible();
      // Então
      await nadaPorBaixoDosBotoes(cartao, 'Tarefa');
      // Nenhuma bolinha nem pílula passa da largura da janela (com muita gente, elas descem para a linha de baixo).
      const janela = (await cartao.boundingBox())!;
      for (const caixa of await cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().toJSON() as DOMRect))) {
        expect(caixa.left).toBeGreaterThanOrEqual(janela.x);
        expect(caixa.right).toBeLessThanOrEqual(janela.x + janela.width);
      }
      const titulo = (await cartao.getByRole('heading', { level: 2 }).boundingBox())!;
      expect(titulo.y + titulo.height).toBeLessThanOrEqual(tela.height);
      await cartao.getByRole('button', { name: 'Fechar' }).click();
    }
  });

  test('dado um painel sem o topo dos cartões (usuário, grupo da equipe, Financeiro), quando abre, então o título não fica por baixo do X', async ({ page }) => {
    const tituloLivre = async (painel: Locator) => {
      const [titulo, fechar] = await Promise.all([caixaDoTexto(painel.getByRole('heading', { level: 2 }).first()), painel.getByRole('button', { name: 'Fechar' }).boundingBox()]);
      expect(cruzam(titulo, fechar!)).toBe(false);
    };
    for (const tela of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(tela);
      // Quando: o usuário, em Equipe e acessos
      await page.goto('/equipe/');
      let painel = await abrirUsuario(page, 'Bruno Exemplo Souza');
      // Então
      await tituloLivre(painel);
      await painel.getByRole('button', { name: 'Fechar' }).click();
      // Quando: um grupo da equipe novo
      const secao = page.getByRole('region', { name: 'Grupos da equipe' });
      await secao.getByRole('button', { name: 'Novo grupo' }).click();
      await page.getByRole('dialog', { name: 'Nome do grupo novo' }).getByRole('textbox').fill(`Núcleo ${tela.width}`);
      await page.getByRole('dialog', { name: 'Nome do grupo novo' }).getByRole('button', { name: 'Salvar' }).click();
      painel = page.getByRole('dialog', { name: `Grupo Núcleo ${tela.width}` });
      // Então
      await tituloLivre(painel);
      await painel.getByRole('button', { name: 'Fechar' }).click();
      // Quando: uma saída nova no Financeiro
      await page.goto('/financeiro/saidas/');
      await page.getByRole('button', { name: 'Nova saída' }).click();
      painel = page.getByRole('dialog', { name: 'Nova saída' });
      // Então
      await tituloLivre(painel);
    }
  });
});

test.describe('A equipe no topo, como na anotação', () => {
  /** Passa a janela para o centro (se ainda não está) e espera a passagem terminar: medir no meio dela daria posições de passagem. */
  async function abrirNoCentro(cartao: Locator) {
    const centro = cartao.getByRole('button', { name: 'Abrir no centro da tela' });
    if (await centro.isVisible()) await centro.click();
    await expect(cartao.getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
    await cartao.evaluate(d => Promise.all(d.getAnimations({ subtree: true }).map(a => a.finished)));
  }
  /** O que fica à esquerda do topo de cada cartão: o tipo e o selo ou o código que vem depois dele. */
  const ESQUERDA = [
    { cartao: 'tarefa', endereco: '/tarefas/', linha: 'Emitir a GRU', partes: (c: Locator) => [c.getByText('Tarefa', { exact: true }).first(), c.getByText(/^Prazo.*\d/).first()] },
    { cartao: 'contrato', endereco: '/contratos/', linha: 'MARIA APARECIDA EXEMPLO',
      partes: (c: Locator) => [c.getByText('Quota litis', { exact: true }).first(), c.getByText(/^[A-Z]{2}\d{2}-\d{4}-\d{4}$/).first()] }
  ];
  const FORMATOS = [
    { formato: 'ao lado', tela: { width: 1440, height: 900 }, centro: false },
    { formato: 'na janela estreita', tela: { width: 900, height: 900 }, centro: true },
    { formato: 'no celular', tela: { width: 390, height: 844 }, centro: false }
  ];
  for (const { formato, tela, centro } of FORMATOS) {
    test(`dados a tarefa e o contrato ${formato}, quando abrem, então a equipe divide uma linha com o tipo ou com o que vem depois dele (nunca fica sozinha numa linha), à direita`, async ({ page }) => {
      await page.setViewportSize(tela);
      for (const { endereco, linha, partes } of ESQUERDA) {
        // Quando
        const cartao = await abrirCartao(page, endereco, linha);
        if (centro) await abrirNoCentro(cartao);
        await voltarAoComeco(cartao);
        // Então
        const equipe = (await cartao.getByRole('group', { name: 'Equipe', exact: true }).boundingBox())!;
        const caixas = await Promise.all(partes(cartao).map(async p => (await p.boundingBox())!));
        const naMesmaLinha = caixas.filter(c => c.y < equipe.y + equipe.height && equipe.y < c.y + c.height);
        expect(naMesmaLinha.length).toBeGreaterThan(0);
        for (const c of naMesmaLinha) expect(c.x + c.width).toBeLessThanOrEqual(equipe.x);
        await cartao.getByRole('button', { name: 'Fechar' }).click();
      }
    });
  }

  // Ao lado (o painel de 560px), desde a #399 a linha de cima tem seis botões redondos (a etiqueta, o "+" de acrescentar ao cartão,
  // o lápis, o ⋯, o formato e o X): a equipe da tarefa não cabe mais ao lado do tipo e desce, encostada à direita, logo abaixo dos
  // botões, na linha do selo do prazo (o teste de cima confere que ela nunca fica sozinha numa linha). Na janela estreita, ela cabe.
  for (const { formato, tela, centro, equipeNaLinhaDoX } of [{ ...FORMATOS[0], equipeNaLinhaDoX: false }, { ...FORMATOS[1], equipeNaLinhaDoX: true }]) {
    test(`dada a tarefa ${formato}, quando abre, então o tipo e os botões ficam numa linha só, na altura do X, e a equipe ${equipeNaLinhaDoX ? 'também' : 'logo abaixo, à direita'}`, async ({ page }) => {
      // Dado
      await page.setViewportSize(tela);
      // Quando
      const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
      if (centro) await abrirNoCentro(cartao);
      await voltarAoComeco(cartao);
      // Então: os centros de todos na mesma altura (com folga de alguns pixels)
      const meio = async (alvo: Locator) => { const c = (await alvo.boundingBox())!; return c.y + c.height / 2; };
      const fechar = cartao.getByRole('button', { name: 'Fechar' });
      const doX = await meio(fechar);
      const equipe = cartao.getByRole('group', { name: 'Equipe', exact: true });
      for (const alvo of [cartao.getByText('Tarefa', { exact: true }).first(), menuDoCartao(cartao), cartao.getByRole('button', { name: 'Escolher etiquetas' }),
        cartao.getByRole('button', { name: 'Acrescentar ao cartão' }), ...(equipeNaLinhaDoX ? [equipe] : [])]) {
        expect(Math.abs(await meio(alvo) - doX)).toBeLessThanOrEqual(3);
      }
      if (equipeNaLinhaDoX) return;
      // E a equipe, logo abaixo da linha dos botões, sem passar da ponta direita do X
      const [caixaDaEquipe, caixaDoX] = [(await equipe.boundingBox())!, (await fechar.boundingBox())!];
      expect(caixaDaEquipe.y).toBeGreaterThanOrEqual(caixaDoX.y + caixaDoX.height);
      expect(caixaDaEquipe.x + caixaDaEquipe.width).toBeLessThanOrEqual(caixaDoX.x + caixaDoX.width);
    });
  }
});
