// O que se acrescenta ao cartão e a Situação (#351, a imagem do cartão do Trello; desde a #397, a Situação numa linha própria, logo
// abaixo da linha de cima, com o rótulo "Situação", o menu largo e, na tarefa e na demanda, o ✓ redondo). Desde a #399, a linha de
// botões rápidos virou uma bolinha só, "Acrescentar ao cartão", na linha de cima: o menu dela tem cada coisa que o cartão pode ter
// (as datas, os checklists, as anotações, as ligações: só as que o cartão tem), quantas há, o ver (vai até a coisa e a abre) e o "+"
// (abre a coisa ali mesmo, como o "+" do título das seções, #390). O cartão arquivado só tem o ver. O "Expandir tudo"
// das seções fica sozinho acima da primeira seção (#394, conferido em situacao-e-expandir-tudo.spec.ts).
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mauro (master).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { acaoNoMenuDoCartao } from './ajudantes';

/** Abre o cartão pela tabela do módulo, pela linha que tem `linha`. */
async function abrirCartao(page: Page, endereco: string, linha: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().getByText(linha).first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  return cartao;
}
/** A bolinha "Acrescentar ao cartão" (#399), na linha de cima. */
const bolinhaDoCartao = (cartao: Locator) => cartao.getByRole('button', { name: 'Acrescentar ao cartão' });
/** Abre o menu da bolinha; o menu abre por cima da página, fora do cartão. */
async function abrirAcrescentar(page: Page, cartao: Locator) {
  await bolinhaDoCartao(cartao).click();
  const menu = page.getByRole('menu', { name: 'Acrescentar ao cartão' });
  await expect(menu).toBeVisible();
  return menu;
}
/** O nome de cada ação do menu, na ordem (o ver e o "+" de cada linha). */
const nomesDoMenu = (menu: Locator) => menu.getByRole('menuitem').evaluateAll(itens => itens.map(i => i.getAttribute('aria-label') ?? ''));
/** Espera as animações do cartão pararem (a janela entra deslizando), antes de medir posições. */
const esperarAsAnimacoes = (cartao: Locator) =>
  cartao.evaluate(e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished.catch(() => undefined))));
/** O título da seção, com o número ao lado (ex.: "Checklists 0"). */
const tituloDaSecao = (cartao: Locator, titulo: string) => cartao.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });

test.describe('A Situação numa linha própria (#397)', () => {
  test('dada uma tarefa, quando o cartão abre, então a Situação fica numa linha própria, entre a linha de cima e o título, com o rótulo à esquerda e o ✓ Concluir à direita', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    // Então
    const menu = cartao.getByRole('combobox', { name: 'Situação da tarefa' });
    await expect(menu).toBeVisible();
    await expect(cartao.getByRole('heading', { name: 'Situação', level: 3 })).toHaveCount(0);
    const [caixaDoMenu, titulo, concluir, rotulo, linhaDeCima] = [await menu.boundingBox(), await cartao.getByRole('heading', { level: 2 }).boundingBox(),
      await cartao.getByRole('button', { name: 'Concluir', exact: true }).boundingBox(), await cartao.getByText('Situação', { exact: true }).boundingBox(),
      await cartao.getByRole('button', { name: 'Mais ações da tarefa' }).boundingBox()];
    expect(caixaDoMenu!.y).toBeGreaterThanOrEqual(linhaDeCima!.y + linhaDeCima!.height);
    expect(caixaDoMenu!.y + caixaDoMenu!.height).toBeLessThanOrEqual(titulo!.y);
    expect(rotulo!.x + rotulo!.width).toBeLessThanOrEqual(caixaDoMenu!.x);
    expect(concluir!.x).toBeGreaterThanOrEqual(caixaDoMenu!.x + caixaDoMenu!.width);
    expect(Math.abs(concluir!.y + concluir!.height / 2 - (caixaDoMenu!.y + caixaDoMenu!.height / 2))).toBeLessThanOrEqual(1);
    // E o menu continua mudando a situação
    await menu.selectOption({ label: 'PARA FAZER' });
    await expect(page.getByRole('status').filter({ hasText: 'Movida para "Para fazer".' })).toBeVisible();
  });

  test('dada uma pessoa, quando o cartão abre, então a Etapa do atendimento fica na linha própria, acima do nome, sem ✓', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, '/pessoas/', 'MARIA APARECIDA EXEMPLO');
    // Então
    const menu = cartao.getByRole('combobox', { name: 'Etapa do atendimento' });
    await expect(menu).toBeVisible();
    await expect(cartao.getByRole('heading', { name: 'Etapa do atendimento', level: 3 })).toHaveCount(0);
    expect((await menu.boundingBox())!.y).toBeLessThan((await cartao.getByRole('heading', { level: 2 }).boundingBox())!.y);
    await expect(cartao.getByText('Etapa do atendimento', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0);
  });
});

test.describe('O menu "Acrescentar ao cartão" (#399)', () => {
  test('dada uma tarefa, quando a pessoa abre o menu, então ele tem as datas, os checklists, as anotações e as ligações, com quantas há e o "+" de cada uma, e não há mais a linha de botões rápidos', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await expect(cartao.getByRole('group', { name: 'Acrescentar ao cartão' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Checklist', exact: true })).toHaveCount(0);
    // Quando
    const menu = await abrirAcrescentar(page, cartao);
    // Então
    expect(await nomesDoMenu(menu)).toEqual(['Ver datas', 'Mudar as datas', 'Ver checklists (0)', 'Adicionar checklist', 'Ver anotações (0)',
      'Nova anotação ligada a este item', expect.stringMatching(/^Ver ligações \(\d+\)$/), 'Nova pessoa ligada a esta tarefa']);
  });

  test('dada uma tarefa, quando escolhe "Adicionar checklist" no menu, então a seção Checklists abre com o menu de "Adicionar checklist"', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Adicionar checklist' }).click();
    // Então
    const checklist = page.getByRole('menu', { name: 'Adicionar checklist' });
    await expect(checklist.getByRole('menuitem', { name: 'Checklist em branco' })).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Checklists')).toHaveAttribute('aria-expanded', 'true');
  });

  test('dada uma tarefa, quando escolhe ver os checklists, então o menu fecha, a seção abre, à vista, e o foco vai ao título dela', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Ver checklists (0)' }).click();
    // Então
    await expect(menu).toHaveCount(0);
    const secao = tituloDaSecao(cartao, 'Checklists');
    await expect(secao).toHaveAttribute('aria-expanded', 'true');
    await expect(secao).toBeFocused();
    await expect(secao).toBeInViewport();
  });

  test('dada uma tarefa, quando escolhe mudar as datas no menu, então a janela das datas abre sobre o cartão (#422)', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Mudar as datas' }).click();
    // Então
    const janela = page.getByRole('dialog', { name: 'Mudar as datas' });
    await expect(janela).toBeVisible();
    await expect(janela.getByRole('button', { name: 'Salvar' })).toBeVisible();
  });

  test('dado um processo, quando escolhe "Novo prazo" no menu, então a seção Prazos abre com o formulário do novo prazo, com o foco no primeiro campo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/processos/judicial/', 'JOSÉ DA SILVA TESTE');
    const menu = await abrirAcrescentar(page, cartao);
    const nomes = await nomesDoMenu(menu);
    expect(nomes.slice(0, 2)).toEqual([expect.stringMatching(/^Ver datas \(\d+\)$/), 'Novo prazo']);
    expect(nomes.filter(n => n.startsWith('Ver '))).toEqual([expect.stringMatching(/^Ver datas/), expect.stringMatching(/^Ver anotações/),
      expect.stringMatching(/^Ver ligações/)]);
    // Quando
    await menu.getByRole('menuitem', { name: 'Novo prazo' }).click();
    // Então
    await expect(tituloDaSecao(cartao, 'Prazos')).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('form', { name: 'Novo prazo' }).getByLabel('Que prazo é este')).toBeFocused();
  });

  test('dada uma tarefa, quando escolhe a pessoa nova no menu, então vai ao cadastro da pessoa nova já ligada à tarefa, como o "+" de Pessoas', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Nova pessoa ligada a esta tarefa' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/nova\/\?tarefa=/);
  });

  test('dado um compromisso, quando escolhe mudar a data no menu, então a janela da data e do horário abre sobre o cartão', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Reunião de equipe' }).click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Reunião de equipe', level: 2 }) });
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Mudar a data e o horário' }).click();
    // Então
    await expect(page.getByRole('dialog', { name: 'Mudar a data e o horário' })).toBeVisible();
  });

  test('dada uma pessoa, quando escolhe a pessoa vinculada no menu, então os Vínculos abrem com o formulário da nova pessoa vinculada', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/pessoas/', 'MARIA APARECIDA EXEMPLO');
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Nova pessoa vinculada', exact: true }).click();
    // Então
    await expect(tituloDaSecao(cartao, 'Vínculos')).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('form', { name: 'Nova pessoa vinculada' }).getByLabel('Vínculo')).toBeFocused();
  });

  test('dado um contrato, quando escolhe a anotação nova no menu, então ela abre na janela, já ligada ao contrato', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'MARIA APARECIDA EXEMPLO');
    const menu = await abrirAcrescentar(page, cartao);
    // Quando
    await menu.getByRole('menuitem', { name: /^Nova anotação ligada a/ }).click();
    // Então
    const anotacao = page.getByRole('article', { name: 'Anotação nova' });
    await expect(anotacao).toBeVisible();
    await expect(anotacao.getByRole('textbox', { name: 'Título' })).toBeFocused();
  });

  test('dada uma anotação gravada, quando escolhe o item novo no menu, então abre o menu do item novo ligado a ela', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    const campo = page.getByRole('article', { name: 'Anotação nova' }).getByRole('textbox', { name: 'Título' });
    await campo.fill('Reunião com o cliente');
    await campo.press('Enter');
    const anotacao = page.getByRole('dialog', { name: 'Anotação', exact: true });
    await expect(anotacao.getByRole('article', { name: /^Anotação (?!nova$)\w+$/ })).toBeVisible();
    const menu = await abrirAcrescentar(page, anotacao);
    // Quando
    await menu.getByRole('menuitem', { name: 'Novo item ligado a esta anotação' }).click();
    // Então
    const novo = page.getByRole('menu', { name: 'Novo item ligado a esta anotação' });
    await expect(novo.getByRole('menuitem', { name: 'Pessoa' })).toBeVisible();
  });

  test('dada uma demanda arquivada, quando a pessoa abre o menu, então ele só tem o ver de cada coisa, sem o "+"', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Registro de marca');
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByRole('button', { name: 'Desarquivar' })).toBeVisible();
    // Quando
    const menu = await abrirAcrescentar(page, cartao);
    // Então
    const nomes = await nomesDoMenu(menu);
    expect(nomes.length).toBeGreaterThan(0);
    for (const nome of nomes) expect(nome).toMatch(/^Ver /);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeDisabled();
  });

  test('dado quem usa o teclado, quando chega à bolinha, abre o menu, anda com as setas e aperta Esc, então o foco passa pelas ações e volta à bolinha', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const bolinha = bolinhaDoCartao(cartao);
    await bolinha.focus();
    // Quando
    await page.keyboard.press('Enter');
    // Então
    const menu = page.getByRole('menu', { name: 'Acrescentar ao cartão' });
    await expect(menu.getByRole('menuitem', { name: 'Ver datas' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Mudar as datas' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Ver checklists (0)' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Mudar as datas' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(bolinha).toBeFocused();
    // E o cartão continua aberto (o Esc fechou só o menu)
    await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('dado o cartão no centro, quando abre, então a bolinha fica na linha de cima, logo depois da etiqueta e antes do lápis, do mesmo tamanho dos outros botões redondos', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1300, height: 900 });
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const formato = cartao.getByRole('button', { name: 'Abrir no centro da tela' });
    if (await formato.count()) await formato.click();
    await esperarAsAnimacoes(cartao);
    // Então
    const [etiqueta, bolinha, lapis, mais] = await Promise.all([cartao.getByRole('button', { name: 'Escolher etiquetas' }), bolinhaDoCartao(cartao),
      cartao.getByRole('button', { name: 'Editar', exact: true }), cartao.getByRole('button', { name: 'Mais ações da tarefa' })].map(b => b.boundingBox()));
    expect(etiqueta!.x).toBeLessThan(bolinha!.x);
    expect(bolinha!.x).toBeLessThan(lapis!.x);
    expect(lapis!.x).toBeLessThan(mais!.x);
    expect(Math.abs(bolinha!.width - mais!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(bolinha!.y + bolinha!.height / 2 - (mais!.y + mais!.height / 2))).toBeLessThanOrEqual(1);
  });
});

test.describe('No celular', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('dada uma tarefa no celular, quando o cartão abre, então a Situação, o Concluir e a bolinha cabem, sem a página rolar de lado, o menu dela cabe na tela, e o Concluir aceita o toque na altura do alvo do dedo', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    // Então
    await expect(cartao.getByRole('combobox', { name: 'Situação da tarefa' })).toBeInViewport();
    await expect(bolinhaDoCartao(cartao)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    // E o menu da bolinha cabe na tela, e o "+" de cada linha aceita o toque na medida do alvo do dedo, um pouco acima e um pouco abaixo
    // do desenho
    const acrescentar = await abrirAcrescentar(page, cartao);
    const caixaDoMenu = (await acrescentar.boundingBox())!;
    expect(caixaDoMenu.x).toBeGreaterThanOrEqual(0);
    expect(caixaDoMenu.x + caixaDoMenu.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const tocado = await acrescentar.getByRole('menuitem', { name: 'Adicionar checklist' }).evaluate(mais => {
      const alvo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alvo-de-toque'));
      const caixa = mais.getBoundingClientRect(), x = caixa.x + caixa.width / 2, y = caixa.y + caixa.height / 2, folga = alvo / 2 - 1;
      const no = (py: number) => document.elementFromPoint(x, py)?.closest('[role="menuitem"]') === mais;
      return { menorQueOAlvo: caixa.height < alvo, acima: no(y - folga), abaixo: no(y + folga) };
    });
    expect(tocado).toEqual({ menorQueOAlvo: true, acima: true, abaixo: true });
    await page.keyboard.press('Escape');
    await expect(acrescentar).toHaveCount(0);
    // E o ✓ Concluir, redondo e mais baixo que o alvo do dedo no desenho, aceita o toque um pouco acima e um pouco abaixo dele, até a altura da pílula
    // (medido e tocado no mesmo instante, dentro da página: a janela pode ainda estar deslizando)
    const concluir = cartao.getByRole('button', { name: 'Concluir', exact: true });
    const pilula = cartao.getByRole('combobox', { name: 'Situação da tarefa' });
    const tocados = await concluir.evaluate((botao, menu) => {
      const caixa = botao.getBoundingClientRect(), folga = (menu.getBoundingClientRect().height - caixa.height) / 2 - 1;
      const tocado = (y: number) => document.elementFromPoint(caixa.x + caixa.width / 2, y)?.closest('button') === botao;
      return { folga, acima: tocado(caixa.top - folga), abaixo: tocado(caixa.bottom + folga) };
    }, await pilula.elementHandle());
    expect(tocados).toEqual({ folga: expect.any(Number), acima: true, abaixo: true });
    expect(tocados.folga).toBeGreaterThan(0);
  });
});
