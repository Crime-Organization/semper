// Os botões rápidos do cartão e a Situação (#351, a imagem do cartão do Trello; desde a #397, a Situação numa linha própria, logo
// abaixo da linha de cima, com o rótulo "Situação", o menu largo e, na tarefa e na demanda, o ✓ redondo): logo abaixo dos dados (as
// datas e o tempo) há uma linha de botões para o que se acrescenta (Datas, Checklist, Anotação, Ligação: só os que o cartão tem),
// que abre cada coisa ali mesmo, como o "+" do título das seções (#390). O cartão arquivado não mostra os botões. O "Expandir tudo"
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
/** A linha dos botões rápidos. */
const linhaDeAtalhos = (cartao: Locator) => cartao.getByRole('group', { name: 'Acrescentar ao cartão' });
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

test.describe('Os botões rápidos', () => {
  test('dada uma tarefa, quando clica em "Checklist", então a seção Checklists abre com o menu de "Adicionar checklist"', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await expect(linhaDeAtalhos(cartao)).toHaveText(/^Datas\s*Checklist\s*Anotação\s*Ligação$/);
    // Quando
    await linhaDeAtalhos(cartao).getByRole('button', { name: 'Checklist' }).click();
    // Então
    const menu = page.getByRole('menu', { name: 'Adicionar checklist' });
    await expect(menu.getByRole('menuitem', { name: 'Checklist em branco' })).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Checklists')).toHaveAttribute('aria-expanded', 'true');
  });

  test('dada uma tarefa, quando clica em "Datas", então o prazo abre para mudar ali mesmo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    // Quando
    await linhaDeAtalhos(cartao).getByRole('button', { name: 'Datas' }).click();
    // Então
    await expect(cartao.getByRole('group', { name: 'Mudar o prazo' })).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Mudar o prazo' }).getByRole('button', { name: 'Salvar' })).toBeVisible();
  });

  test('dado um processo, quando clica em "Datas", então a seção Prazos abre com o formulário do novo prazo, com o foco no primeiro campo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/processos/judicial/', 'JOSÉ DA SILVA TESTE');
    await expect(linhaDeAtalhos(cartao)).toHaveText(/^Datas\s*Anotação\s*Ligação$/);
    // Quando
    await linhaDeAtalhos(cartao).getByRole('button', { name: 'Datas' }).click();
    // Então
    await expect(tituloDaSecao(cartao, 'Prazos')).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('form', { name: 'Novo prazo' }).getByLabel('Que prazo é este')).toBeFocused();
  });

  test('dada uma tarefa, quando clica em "Ligação", então vai ao cadastro da pessoa nova já ligada à tarefa, como o "+" de Pessoas', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    const ligacao = linhaDeAtalhos(cartao).getByRole('link', { name: 'Ligação' });
    await expect(ligacao).toHaveAttribute('title', 'Nova pessoa ligada a esta tarefa');
    // Quando
    await ligacao.click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/nova\/\?tarefa=/);
  });

  test('dado um compromisso, quando clica em "Datas", então a data e o horário abrem para mudar ali mesmo', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Reunião de equipe' }).click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Reunião de equipe', level: 2 }) });
    await expect(linhaDeAtalhos(cartao)).toHaveText(/^Datas\s*Anotação\s*Ligação$/);
    // Quando
    await linhaDeAtalhos(cartao).getByRole('button', { name: 'Datas' }).click();
    // Então
    await expect(cartao.getByRole('group', { name: 'Mudar a data e o horário' })).toBeVisible();
  });

  test('dada uma pessoa, quando clica em "Ligação", então os Vínculos abrem com o formulário da nova pessoa vinculada', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/pessoas/', 'MARIA APARECIDA EXEMPLO');
    await expect(linhaDeAtalhos(cartao)).toHaveText(/^Anotação\s*Ligação$/);
    // Quando
    await linhaDeAtalhos(cartao).getByRole('button', { name: 'Ligação' }).click();
    // Então
    await expect(tituloDaSecao(cartao, 'Vínculos')).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('form', { name: 'Nova pessoa vinculada' }).getByLabel('Vínculo')).toBeFocused();
  });

  test('dado um contrato, quando clica em "Anotação", então a anotação nova abre na janela, já ligada ao contrato', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'MARIA APARECIDA EXEMPLO');
    await expect(linhaDeAtalhos(cartao)).toHaveText(/^Checklist\s*Anotação$/);
    // Quando
    await linhaDeAtalhos(cartao).getByRole('link', { name: 'Anotação' }).click();
    // Então
    const anotacao = page.getByRole('article', { name: 'Anotação nova' });
    await expect(anotacao).toBeVisible();
    await expect(anotacao.getByRole('textbox', { name: 'Título' })).toBeFocused();
  });

  test('dada uma anotação gravada, quando clica em "Ligação", então abre o menu do item novo ligado a ela', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    const campo = page.getByRole('article', { name: 'Anotação nova' }).getByRole('textbox', { name: 'Título' });
    await campo.fill('Reunião com o cliente');
    await campo.press('Enter');
    const anotacao = page.getByRole('dialog', { name: 'Anotação', exact: true });
    await expect(anotacao.getByRole('article', { name: /^Anotação (?!nova$)\w+$/ })).toBeVisible();
    // Quando
    await linhaDeAtalhos(anotacao).getByRole('button', { name: 'Ligação' }).click();
    // Então
    const menu = page.getByRole('menu', { name: 'Novo item ligado a esta anotação' });
    await expect(menu.getByRole('menuitem', { name: 'Pessoa' })).toBeVisible();
  });

  test('dada uma demanda arquivada, quando o cartão mostra o arquivo, então não há botões rápidos', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Registro de marca');
    await expect(linhaDeAtalhos(cartao)).toHaveText(/^Datas\s*Checklist\s*Anotação\s*Ligação$/);
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByRole('button', { name: 'Desarquivar' })).toBeVisible();
    // Então
    await expect(linhaDeAtalhos(cartao)).toHaveCount(0);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeDisabled();
  });
});

test.describe('No celular', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('dada uma tarefa no celular, quando o cartão abre, então a Situação, o Concluir e os botões rápidos cabem, sem a página rolar de lado, e o Concluir aceita o toque na altura do alvo do dedo', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    // Então
    await expect(cartao.getByRole('combobox', { name: 'Situação da tarefa' })).toBeInViewport();
    await expect(linhaDeAtalhos(cartao).getByRole('button', { name: 'Checklist' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    for (const botao of await linhaDeAtalhos(cartao).getByRole('button').all()) {
      const caixa = (await botao.boundingBox())!;
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
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
