// A nova arrumação do cartão (#397, com a #394 e a #396; pedido do dono de 20/11), a mesma em tarefa, demanda, processo judicial e
// administrativo, compromisso, contrato e pessoa. Na coluna da esquerda, de cima para baixo: a linha de cima (o tipo, o código, a
// equipe, a etiqueta, o lápis e o ⋯), a linha da Situação (com o ✓ redondo só na tarefa e na demanda), as etiquetas, o título, os
// dados (as datas e o tempo), a descrição (no processo, o número), o "Expandir tudo" da esquerda e as seções. Na coluna da direita,
// no centro largo, uma linha só com três botões redondos no alto: o "Expandir tudo" dela, o abrir ao lado e o X. Ao lado e no
// celular, o X e o abrir ao lado continuam no alto do cartão, e o "Expandir tudo" das seções de baixo fica acima de Comentários.
// Cada "Expandir tudo" diz no nome de onde são as seções que abre: "da coluna da esquerda" e "da coluna da direita" no centro largo,
// "do alto do cartão" e "do pé do cartão" sem a coluna.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mauro (master).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { acaoNoMenuDoCartao, menuDoCartao } from './ajudantes';

type Caixa = { x: number; y: number; width: number; height: number };
/** A diferença aceita entre dois meios (o arredondamento do desenho). */
const TOLERANCIA = 1;
const meioY = (c: Caixa) => c.y + c.height / 2;
const embaixo = (c: Caixa) => c.y + c.height;
const cruzam = (a: Caixa, b: Caixa) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const caixa = async (alvo: Locator) => (await alvo.boundingBox())!;
const NOME_DOS_BOTOES_DA_JANELA = 'Botões da janela';

/** O que cada cartão tem na cabeça: a faixa das datas, a faixa do tempo, a descrição (ou o número) e a primeira seção da esquerda. */
interface Cartao {
  cartao: string; endereco: string; linha: string;
  datas: boolean; tempo: boolean; concluir: boolean;
  descricao?: (c: Locator) => Locator;
  primeiraSecao: RegExp;
}
const descricaoDoCartao = (c: Locator) => c.getByRole('button', { name: /^Sem descrição/ });
const CARTOES: Cartao[] = [
  { cartao: 'tarefa', endereco: '/tarefas/', linha: 'Emitir a GRU', datas: true, tempo: true, concluir: true, descricao: descricaoDoCartao, primeiraSecao: /^Checklists/ },
  { cartao: 'demanda', endereco: '/demandas/', linha: 'Registro de marca', datas: true, tempo: true, concluir: true, descricao: descricaoDoCartao, primeiraSecao: /^Checklists/ },
  { cartao: 'processo judicial', endereco: '/processos/judicial/', linha: 'JOSÉ DA SILVA TESTE', datas: false, tempo: false, concluir: false,
    descricao: c => c.getByText('0001234-97.2026.8.13.0024', { exact: true }), primeiraSecao: /^Prazos/ },
  { cartao: 'processo administrativo', endereco: '/processos/administrativo/', linha: 'Registro da marca Exemplo', datas: false, tempo: false, concluir: false,
    descricao: c => c.getByText('912345678', { exact: true }), primeiraSecao: /^Prazos/ },
  { cartao: 'compromisso', endereco: '/agenda/', linha: 'Reunião de equipe', datas: true, tempo: false, concluir: false, primeiraSecao: /^Dados do compromisso/ },
  { cartao: 'contrato', endereco: '/contratos/', linha: 'MARIA APARECIDA EXEMPLO', datas: true, tempo: false, concluir: false, primeiraSecao: /^Checklists/ },
  { cartao: 'pessoa', endereco: '/pessoas/', linha: 'MARIA APARECIDA EXEMPLO', datas: false, tempo: false, concluir: false, primeiraSecao: /^Qualificação/ }
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
/**
 * Espera as transições da janela terminarem (ela entra deslizando). Uma transição cancelada também parou (como em
 * eixo-dos-botoes-do-cartao.spec.ts): o fundo de um botão que passa sob o ponteiro enquanto a janela desliza começa e é cancelado.
 */
async function esperarParar(cartao: Locator) {
  await cartao.evaluate(e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished.catch(() => undefined))));
}
/** Muda o formato do cartão, se ele ainda não está nesse formato, e espera a janela parar de se mexer. */
async function formato(cartao: Locator, qual: 'Abrir no centro da tela' | 'Abrir ao lado') {
  const botao = cartao.getByRole('button', { name: qual });
  if (await botao.count()) await botao.click();
  await esperarParar(cartao);
}
/** O menu da Situação (na pessoa, o da "Etapa do atendimento"). */
const menuDaSituacao = (cartao: Locator) => cartao.getByRole('combobox', { name: /^(Situação d[aeo] |Etapa do atendimento$)/ });
const botoesDaJanela = (cartao: Locator) => cartao.getByRole('group', { name: NOME_DOS_BOTOES_DA_JANELA });
const EXPANDIR = /^(Expandir|Recolher) tudo (da|do) /;
/** O "Expandir tudo" da esquerda (as seções do corpo do cartão; sem a coluna, as do alto), pelo nome. */
const expandirDaEsquerda = (cartao: Locator) => cartao.getByRole('button', { name: /^(Expandir|Recolher) tudo (da coluna da esquerda|do alto do cartão)$/ });
/** O "Expandir tudo" da coluna da direita (sem a coluna, o das seções do pé do cartão), pelo nome. */
const expandirDaColuna = (cartao: Locator) => cartao.getByRole('button', { name: /^(Expandir|Recolher) tudo (da coluna da direita|do pé do cartão)$/ });
/** Se `a` vem antes de `b` na página (e na ordem do Tab). */
const antesNaPagina = async (a: Locator, b: Locator) =>
  a.evaluate((x, y) => !!(x.compareDocumentPosition(y!) & Node.DOCUMENT_POSITION_FOLLOWING), await b.elementHandle());
/** O botão que abre e fecha a seção (o título dela). */
const secao = (cartao: Locator, nome: RegExp) => cartao.getByRole('button', { name: nome }).and(cartao.locator('[aria-controls]'));

test.describe('A ordem da cabeça do cartão (#397), no centro largo', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const c of CARTOES) {
    test(`dado o cartão de ${c.cartao} no centro, quando abre, então vêm a linha de cima, a Situação, o título, os dados, a descrição, o "Expandir tudo" da esquerda e as seções`, async ({ page }) => {
      // Dado / Quando
      const cartao = await abrirCartao(page, c.endereco, c.linha);
      await formato(cartao, 'Abrir no centro da tela');
      // Então: cada bloco começa abaixo do fim do anterior
      const blocos: Locator[] = [menuDoCartao(cartao), menuDaSituacao(cartao), cartao.getByRole('heading', { level: 2 })];
      if (c.datas) blocos.push(cartao.getByRole('group', { name: 'Datas', exact: true }));
      if (c.tempo) blocos.push(cartao.getByRole('group', { name: 'Tempo', exact: true }));
      if (c.descricao) blocos.push(c.descricao(cartao));
      const esquerda = expandirDaEsquerda(cartao);
      blocos.push(esquerda, secao(cartao, c.primeiraSecao));
      let anterior = await caixa(blocos[0]);
      for (const bloco of blocos.slice(1)) {
        const atual = await caixa(bloco);
        expect(atual.y).toBeGreaterThanOrEqual(embaixo(anterior) - TOLERANCIA);
        anterior = atual;
      }
      // E a faixa das datas some no processo e na pessoa (os dados ficam nas seções)
      if (!c.datas) await expect(cartao.getByRole('group', { name: 'Datas', exact: true })).toHaveCount(0);
    });
  }

  test('dada a tarefa no centro, quando abre, então o tempo total é o último dado da faixa das datas, à direita das outras datas', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await formato(cartao, 'Abrir no centro da tela');
    // Então
    const datas = cartao.getByRole('group', { name: 'Datas', exact: true });
    const total = datas.getByRole('group', { name: 'Tempo total' });
    await expect(total).toContainText('2 h');
    const [prazo, dadoTotal] = [await caixa(datas.getByRole('group', { name: 'Prazo', exact: true })), await caixa(total)];
    expect(dadoTotal.x).toBeGreaterThan(prazo.x + prazo.width);
    expect(Math.abs(dadoTotal.y - prazo.y)).toBeLessThanOrEqual(TOLERANCIA);
    // E o resumo da equipe não repete o total
    await expect(cartao.getByText(/^Total (até agora|da equipe)/)).toHaveCount(0);
    // E o total, em destaque, não fica menor que o relógio de quem olha ("Seu tempo nesta tarefa")
    const tamanho = (alvo: Locator) => alvo.evaluate(e => parseFloat(getComputedStyle(e).fontSize));
    const relogio = cartao.getByRole('timer');
    expect(await tamanho(total.getByText('2 h'))).toBeGreaterThanOrEqual(await tamanho(relogio));
  });
});

test.describe('O ✓ ao lado da Situação (#397), só na tarefa e na demanda', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const c of CARTOES) {
    test(`dado o cartão de ${c.cartao}, quando abre, então ${c.concluir ? 'o ✓ "Concluir" fica à direita do menu, na mesma altura' : 'não há ✓ "Concluir"'}`, async ({ page }) => {
      // Dado / Quando
      const cartao = await abrirCartao(page, c.endereco, c.linha);
      await formato(cartao, 'Abrir no centro da tela');
      const concluir = cartao.getByRole('button', { name: 'Concluir', exact: true });
      // Então
      if (!c.concluir) { await expect(concluir).toHaveCount(0); return; }
      const [menu, botao] = [await caixa(menuDaSituacao(cartao)), await caixa(concluir)];
      expect(botao.x).toBeGreaterThanOrEqual(menu.x + menu.width);
      expect(Math.abs(meioY(botao) - meioY(menu))).toBeLessThanOrEqual(TOLERANCIA);
      expect(Math.abs(botao.width - botao.height)).toBeLessThanOrEqual(TOLERANCIA);
      await expect(concluir).toHaveText('');
    });
  }

  test('dada a demanda, quando a pessoa clica no ✓, então ela vai para a coluna das concluídas, e o mesmo botão a reabre', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Registro de marca');
    // Quando
    await cartao.getByRole('button', { name: 'Concluir', exact: true }).click();
    // Então: como ao levar a demanda à coluna das concluídas pelo menu, o sistema oferece criar o processo dela
    await expect(page.getByText('Demanda concluída.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Criar o processo?' }).getByRole('button', { name: 'Cancelar' }).click();
    const reabrir = cartao.getByRole('button', { name: 'Reabrir' });
    await expect(reabrir).toBeVisible();
    // Quando
    await reabrir.click();
    // Então: o mesmo botão volta a ser o Concluir, com o foco nele
    await expect(page.getByText(/^Demanda reaberta em "/)).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Concluir', exact: true })).toBeFocused();
  });
});

test.describe('Cada "Expandir tudo" só abre as seções da sua coluna (#394, #397)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('dada a tarefa no centro, quando a pessoa usa o "Expandir tudo" da coluna da direita, então só as seções da direita abrem, e o da esquerda só abre as da esquerda', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await formato(cartao, 'Abrir no centro da tela');
    // Quando
    await expandirDaColuna(cartao).click();
    // Então
    await expect(secao(cartao, /^Histórico de alterações/)).toHaveAttribute('aria-expanded', 'true');
    await expect(secao(cartao, /^Checklists/)).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await expandirDaEsquerda(cartao).click();
    // Então
    await expect(secao(cartao, /^Checklists/)).toHaveAttribute('aria-expanded', 'true');
    await expect(secao(cartao, /^Demanda/)).toHaveAttribute('aria-expanded', 'true');
    await expect(expandirDaColuna(cartao)).toHaveAccessibleName('Recolher tudo da coluna da direita');
    // Quando: recolhe só a direita
    await expandirDaColuna(cartao).click();
    // Então
    await expect(secao(cartao, /^Histórico de alterações/)).toHaveAttribute('aria-expanded', 'false');
    await expect(secao(cartao, /^Checklists/)).toHaveAttribute('aria-expanded', 'true');
  });

  test('dada a demanda ao lado, quando a pessoa usa o "Expandir tudo" de baixo, acima de Comentários, então só as seções de baixo abrem', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Registro de marca');
    await formato(cartao, 'Abrir ao lado');
    const [esquerda, debaixo] = [expandirDaEsquerda(cartao), expandirDaColuna(cartao)];
    expect(embaixo(await caixa(debaixo))).toBeLessThanOrEqual((await caixa(secao(cartao, /^Comentários/))).y + TOLERANCIA);
    expect((await caixa(debaixo)).y).toBeGreaterThan(embaixo(await caixa(esquerda)));
    // Quando
    await debaixo.click();
    // Então
    await expect(secao(cartao, /^Histórico de alterações/)).toHaveAttribute('aria-expanded', 'true');
    await expect(secao(cartao, /^Checklists/)).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Os botões da janela (#397)', () => {
  test('dado o cartão no centro largo, quando abre, então o alto da coluna da direita tem, nesta ordem, o "Expandir tudo" dela, o abrir ao lado e o X, redondos e na altura da linha de cima, e o Tab passa pelo cartão antes da coluna', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const c of CARTOES) {
      // Quando
      const cartao = await abrirCartao(page, c.endereco, c.linha);
      await formato(cartao, 'Abrir no centro da tela');
      // Então
      const janela = botoesDaJanela(cartao).getByRole('button');
      await expect(janela).toHaveCount(2);
      await expect(janela.nth(0)).toHaveAccessibleName('Abrir ao lado');
      await expect(janela.nth(1)).toHaveAccessibleName('Fechar');
      const botoes = [expandirDaColuna(cartao), janela.nth(0), janela.nth(1)];
      const linhaDeCima = meioY(await caixa(menuDoCartao(cartao)));
      const tamanho = await caixa(menuDoCartao(cartao));
      const caixas = [];
      for (const b of botoes) {
        const k = await caixa(b);
        caixas.push(k);
        expect(Math.abs(meioY(k) - linhaDeCima)).toBeLessThanOrEqual(TOLERANCIA);
        expect(Math.abs(k.width - tamanho.width)).toBeLessThanOrEqual(TOLERANCIA);
      }
      // Nesta ordem, da esquerda para a direita, com o vão de sempre entre eles
      expect(caixas[1].x - (caixas[0].x + caixas[0].width)).toBeCloseTo(caixas[2].x - (caixas[1].x + caixas[1].width), 0);
      expect(caixas[0].x).toBeLessThan(caixas[1].x);
      // E o que vem na coluna começa abaixo da linha
      expect((await caixa(secao(cartao, /^Comentários/))).y).toBeGreaterThan(embaixo(caixas[0]));
      // E o Tab: os botões da janela, o cartão (com o "Expandir tudo" da esquerda), e só então o da coluna, logo antes das seções dela
      expect(await antesNaPagina(janela.nth(1), expandirDaEsquerda(cartao))).toBe(true);
      expect(await antesNaPagina(expandirDaEsquerda(cartao), expandirDaColuna(cartao))).toBe(true);
      expect(await antesNaPagina(expandirDaColuna(cartao), secao(cartao, /^Comentários/))).toBe(true);
      await cartao.getByRole('button', { name: 'Fechar' }).click();
    }
  });

  test('dado o cartão ao lado, quando abre, então o abrir no centro e o X ficam no alto do cartão, sem o "Expandir tudo", e nada da linha de cima os cruza', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await formato(cartao, 'Abrir ao lado');
    // Então
    const janela = botoesDaJanela(cartao);
    await expect(janela.getByRole('button', { name: 'Fechar' })).toBeVisible();
    await expect(janela.getByRole('button', { name: 'Abrir no centro da tela' })).toBeVisible();
    await expect(janela.getByRole('button', { name: EXPANDIR })).toHaveCount(0);
    expect(embaixo(await caixa(janela.getByRole('button', { name: 'Fechar' })))).toBeLessThan((await caixa(menuDaSituacao(cartao))).y);
    await expect(cartao.getByRole('button', { name: EXPANDIR })).toHaveCount(2);
  });
});

test.describe('No celular (#397)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  for (const c of CARTOES.filter(k => ['tarefa', 'demanda', 'pessoa'].includes(k.cartao))) {
    test(`dado o cartão de ${c.cartao} no celular, quando abre, então o X fica no alto, a linha da Situação cabe sem se cruzar, os dois "Expandir tudo" ficam acima das suas seções, e a página não rola de lado`, async ({ page }) => {
      // Dado / Quando
      const cartao = await abrirCartao(page, c.endereco, c.linha);
      await esperarParar(cartao);
      // Então
      const fechar = botoesDaJanela(cartao).getByRole('button', { name: 'Fechar' });
      const menu = await caixa(menuDaSituacao(cartao));
      expect(embaixo(await caixa(fechar))).toBeLessThan(menu.y);
      if (c.concluir) expect(cruzam(menu, await caixa(cartao.getByRole('button', { name: 'Concluir', exact: true })))).toBe(false);
      expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      const [esquerda, debaixo] = [expandirDaEsquerda(cartao), expandirDaColuna(cartao)];
      expect(embaixo(await caixa(esquerda))).toBeLessThanOrEqual((await caixa(secao(cartao, c.primeiraSecao))).y + TOLERANCIA);
      expect(embaixo(await caixa(debaixo))).toBeLessThanOrEqual((await caixa(secao(cartao, /^Comentários/))).y + TOLERANCIA);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  }
});

test.describe('A Situação de nome longo no celular (#397)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  for (const c of CARTOES.filter(k => k.concluir)) {
    test(`dado o cartão de ${c.cartao} no celular, quando a pessoa escolhe "Aguardando retorno", então o nome inteiro cabe no menu, sem reticências, com o ✓ ao lado`, async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.endereco, c.linha);
      await esperarParar(cartao);
      const menu = menuDaSituacao(cartao);
      // Quando
      await menu.selectOption({ label: 'AGUARDANDO RETORNO' });
      // Então: o texto escolhido, com a letra do menu, cabe no espaço do texto (a largura menos as folgas)
      const sobra = await menu.evaluate((s: HTMLSelectElement) => {
        const estilo = getComputedStyle(s);
        const regua = document.createElement('canvas').getContext('2d')!;
        regua.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
        regua.letterSpacing = estilo.letterSpacing;
        const espaco = s.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
        return espaco - regua.measureText(s.selectedOptions[0].text).width;
      });
      expect(sobra).toBeGreaterThanOrEqual(0);
      const [m, concluir] = [await caixa(menu), await caixa(cartao.getByRole('button', { name: 'Concluir', exact: true }))];
      expect(Math.abs(meioY(m) - meioY(concluir))).toBeLessThanOrEqual(TOLERANCIA);
      expect(concluir.x + concluir.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  }
});

test.describe('O cartão arquivado (#397)', () => {
  test(`dado o cartão de tarefa arquivado e sem descrição, quando abre, então dos dados à faixa do arquivado fica só o vão entre os blocos, sem o vão da descrição`, async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1300, height: 900 });
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await formato(cartao, 'Abrir no centro da tela');
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    const desarquivar = cartao.getByRole('button', { name: 'Desarquivar' });
    await expect(desarquivar).toBeVisible();
    // Então: a faixa do arquivado (onde está o Desarquivar) vem logo depois do tempo, com o vão de sempre entre os blocos
    const [tempo, faixa] = [await caixa(cartao.getByRole('group', { name: 'Tempo', exact: true })), await caixa(desarquivar.locator('..'))];
    const vaoEntreOsBlocos = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cartao-vao-secoes')));
    expect(faixa.y - embaixo(tempo)).toBeLessThanOrEqual(vaoEntreOsBlocos + TOLERANCIA);
    await expect(descricaoDoCartao(cartao)).toHaveCount(0);
  });

  for (const c of CARTOES.filter(k => k.concluir)) {
    test(`dado o cartão de ${c.cartao} arquivado, quando a pessoa aciona o ✓ pelo teclado, então a Situação e o ✓ aparecem só para ver e nada muda`, async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.endereco, c.linha);
      await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
      await expect(cartao.getByRole('button', { name: 'Desarquivar' })).toBeVisible();
      const concluir = cartao.getByRole('button', { name: 'Concluir', exact: true });
      // Quando: ele continua no Tab (para a dica), mas o Enter não faz nada
      await concluir.focus();
      await expect(concluir).toBeFocused();
      await page.keyboard.press('Enter');
      // Então
      await expect(menuDaSituacao(cartao)).toBeDisabled();
      await expect(concluir).toHaveAttribute('aria-disabled', 'true');
      await expect(cartao.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);
      await expect(page.getByText(/concluída\.$/)).toHaveCount(0);
    });
  }
});

test.describe('Os espaços da cabeça (#396, #398)', () => {
  /** Lê uma variável de estilo.css, em pixels. */
  const variavel = (page: Page, nome: string) => page.evaluate(n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)), nome);
  /** Os vãos da v1.34.0, que o dono achou apertados (#398): os de agora precisam ser maiores, no computador e no celular. */
  const NO_COMPUTADOR_V1_34 = { '--vao-do-topo-a-situacao': 12, '--vao-ate-o-titulo': 16, '--vao-do-titulo-aos-dados': 16, '--vao-das-faixas-dos-dados': 14,
    '--vao-das-linhas-da-faixa': 14, '--vao-dos-dados-a-descricao': 24 };
  const NO_CELULAR_V1_34 = { '--vao-do-topo-a-situacao': 8, '--vao-ate-o-titulo': 12, '--vao-do-titulo-aos-dados': 12, '--vao-das-faixas-dos-dados': 14,
    '--vao-das-linhas-da-faixa': 10, '--vao-dos-dados-a-descricao': 16 };

  for (const tela of [{ nome: 'no computador', viewport: { width: 1440, height: 900 }, antes: NO_COMPUTADOR_V1_34 },
    { nome: 'no celular', viewport: { width: 375, height: 812 }, antes: NO_CELULAR_V1_34 }]) {
    test(`dada a tarefa ${tela.nome}, quando abre, então os vãos da cabeça são maiores que os da v1.34.0 e as faixas das datas e do tempo ficam separadas por eles`, async ({ page }) => {
      // Dado
      await page.setViewportSize(tela.viewport);
      // Quando
      const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
      await esperarParar(cartao);
      // Então: cada vão cresceu
      for (const [nome, antes] of Object.entries(tela.antes)) expect(await variavel(page, nome), nome).toBeGreaterThan(antes);
      // E entre o fim das datas e o primeiro dado do tempo ficam as duas folgas das faixas (a linha fina fica no meio)
      const datas = cartao.getByRole('group', { name: 'Datas', exact: true }), tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
      const fimDasDatas = Math.max(...await datas.getByRole('group').evaluateAll(gs => gs.map(g => g.getBoundingClientRect().bottom)));
      const primeiroTempo = await caixa(tempo.getByRole('group').first());
      expect(primeiroTempo.y - fimDasDatas).toBeGreaterThanOrEqual(2 * await variavel(page, '--vao-das-faixas-dos-dados') - TOLERANCIA);
      // E, dentro da faixa do tempo, a parte de cada um fica um vão das linhas abaixo do relógio
      const relogio = await caixa(tempo.getByRole('group').first()), parte = await caixa(tempo.getByRole('list', { name: 'Parte de cada um' }));
      expect(parte.y - embaixo(relogio)).toBeGreaterThanOrEqual(await variavel(page, '--vao-das-linhas-da-faixa') - TOLERANCIA);
    });


    test(`dada a tarefa ${tela.nome}, quando abre, então entre a linha de cima, a Situação, o título, os dados e a descrição ficam pelo menos os vãos de estilo.css`, async ({ page }) => {
      // Dado
      await page.setViewportSize(tela.viewport);
      // Quando
      const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
      await esperarParar(cartao);
      // Então
      // (desde a #399, sem a linha dos botões rápidos: o fim dos dados é a faixa do tempo)
      const [topo, situacao, titulo, datas, tempo, descricao] = await Promise.all([menuDoCartao(cartao), menuDaSituacao(cartao),
        cartao.getByRole('heading', { level: 2 }), cartao.getByRole('group', { name: 'Datas', exact: true }),
        cartao.getByRole('group', { name: 'Tempo', exact: true }), descricaoDoCartao(cartao)].map(caixa));
      expect(situacao.y - embaixo(topo)).toBeGreaterThanOrEqual(await variavel(page, '--vao-do-topo-a-situacao') - TOLERANCIA);
      expect(titulo.y - embaixo(situacao)).toBeGreaterThanOrEqual(await variavel(page, '--vao-ate-o-titulo') - TOLERANCIA);
      expect(datas.y - embaixo(titulo)).toBeGreaterThanOrEqual(await variavel(page, '--vao-do-titulo-aos-dados') - TOLERANCIA);
      expect(descricao.y - embaixo(tempo)).toBeGreaterThanOrEqual(await variavel(page, '--vao-dos-dados-a-descricao') - TOLERANCIA);
    });
  }
});
