// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O Financeiro e a página "Contas, DAS e sócios". Quem está logado é o Mauro (administrador). O banco fictício começa sem contas.
// Desde a #331 (aprovado pelo dono em 22/11/2026), as entradas e saídas comuns se lançam, mudam e excluem no Financeiro; a página das
// contas (o Caixa antigo) ficou com o extrato e o saldo do dia, o ajuste de saldo, o repasse entre contas, as contas, o DAS e os sócios.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

/** O valor em reais como a tela mostra (o espaço depois do R$ pode ser o fino, do navegador). */
const dinheiro = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);
/** O dia dos testes que usam os meses do Financeiro: o ano que ele mostra é o de hoje. */
const DIA_DOS_TESTES = new Date('2026-11-22T12:00:00-03:00');

/** Cria as contas PJ (recolhe DAS, com saldo) e PF, a partir de janeiro. */
async function criarContas(page: Page) {
  await page.goto('/financeiro/contas/');
  await abrirSecao(page, 'Contas');
  for (const [nome, saldo, das] of [['PJ', '1.000,00', true], ['PF', '0,00', false]] as const) {
    await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
    const form = page.getByRole('form', { name: 'Nova conta' });
    await form.getByLabel('Nome da conta').fill(nome);
    await form.getByLabel('Saldo inicial').fill(saldo);
    await form.getByLabel('Em que dia').fill('2026-01-01');
    if (das) await form.getByText('Esta conta recolhe DAS').click();
    await form.getByRole('button', { name: 'Criar conta' }).click();
    await expect(form).toHaveCount(0);
  }
}

/** Como se lança cada tipo no Financeiro: os botões até o formulário, o nome dele, o do botão que registra e o aviso. */
const LANCAR_NO_FINANCEIRO = {
  entrada: { abrir: ['Nova entrada', 'Entrada sem contrato'], form: 'Entrada sem contrato', registrar: 'Registrar entrada', aviso: 'Entrada registrada em' },
  saida: { abrir: ['Nova saída'], form: 'Nova saída', registrar: 'Registrar saída', aviso: 'Saída registrada em' }
} as const;
type TipoNoFinanceiro = keyof typeof LANCAR_NO_FINANCEIRO;

/** Abre o formulário de uma entrada sem contrato ou de uma saída, no Financeiro. */
async function abrirLancamento(page: Page, tipo: TipoNoFinanceiro) {
  await page.goto('/financeiro/');
  for (const botao of LANCAR_NO_FINANCEIRO[tipo].abrir) await page.getByRole('button', { name: botao, exact: true }).click();
  return page.getByRole('form', { name: LANCAR_NO_FINANCEIRO[tipo].form });
}
/** Lança uma entrada sem contrato ou uma saída comum no Financeiro (onde se lançam desde a #331) e fecha a janela. */
async function lancar(page: Page, { tipo, valor, descricao, data, conta = 'PJ' }: { tipo: TipoNoFinanceiro; valor: string; descricao: string; data: string; conta?: string }) {
  const form = await abrirLancamento(page, tipo);
  await form.getByLabel('Data').fill(data);
  await form.getByLabel('Valor').fill(valor);
  await form.getByLabel('Conta').selectOption({ label: conta });
  await form.getByLabel('Descrição').fill(descricao);
  await form.getByRole('button', { name: LANCAR_NO_FINANCEIRO[tipo].registrar }).click();
  await expect(page.getByText(`${LANCAR_NO_FINANCEIRO[tipo].aviso} ${conta}.`)).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
}
/** O ajuste de saldo, que continua na página das contas: o botão do cabeçalho abre o formulário. */
async function lancarAjuste(page: Page, { categoria, valor, motivo, data }: { categoria: string; valor: string; motivo: string; data: string }) {
  await page.getByRole('button', { name: 'Ajuste de saldo' }).click();
  const form = page.getByRole('form', { name: 'Novo ajuste de saldo' });
  await form.getByLabel('Data').fill(data);
  await form.getByLabel('Categoria').selectOption({ label: categoria });
  await form.getByLabel('Valor').fill(valor);
  await form.getByLabel('Motivo do ajuste').fill(motivo);
  await form.getByRole('button', { name: 'Lançar' }).click();
  await expect(form).toHaveCount(0);
}
const irParaMes = (page: Page, mes: string) => page.getByLabel('Mês', { exact: true }).first().fill(mes);
/** Abre a página das contas num mês. */
async function contasNoMes(page: Page, mes: string) {
  await page.goto('/financeiro/contas/');
  await irParaMes(page, mes);
}
/** No Financeiro, escolhe o mês do ano (Jan, Fev…). */
const mesNoFinanceiro = (page: Page, mes: string) => page.getByRole('group', { name: 'Mês' }).getByRole('button', { name: mes, exact: true }).click();

test.describe('Contas, DAS e sócios', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(DIA_DOS_TESTES); });

  test('quando não há contas, então o Financeiro leva às contas, que pedem para criar; ao criar, mostra o extrato da conta, sem lançar entradas e saídas por ali', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando: o menu leva ao Financeiro, e o link Contas e DAS, às contas
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Financeiro', exact: true }).click();
    await page.getByRole('link', { name: 'Contas e DAS' }).click();
    // Então
    await expect(page.getByRole('heading', { name: /^Contas, DAS e sócios/ })).toBeVisible();
    await expect(page.getByText('Nenhuma conta ainda.', { exact: false })).toBeVisible();
    // Quando
    await criarContas(page);
    // Então
    await expect(page.getByRole('combobox', { name: 'Conta' })).toHaveValue(/.+/);
    await expect(page.getByRole('list', { name: 'Contas do escritório' })).toContainText('PJ (recolhe DAS)');
    await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);
  });

  test('quando lança entrada e saída no Financeiro, então o saldo das contas acompanha, e o resumo do mês fecha', async ({ page }) => {
    // Dado
    await criarContas(page);
    // Quando
    await lancar(page, { tipo: 'entrada', valor: '500,00', descricao: 'Honorários do cliente', data: '2026-03-10' });
    await lancar(page, { tipo: 'saida', valor: '200,50', descricao: 'Conta de luz', data: '2026-03-11' });
    await contasNoMes(page, '2026-03');
    // Então
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela.getByRole('row').filter({ hasText: 'Honorários do cliente' })).toContainText('1.500,00');
    await expect(tabela.getByRole('row').filter({ hasText: 'Conta de luz' })).toContainText('1.299,50');
    const resumo = page.getByRole('definition').filter({ hasText: '1.299,50' });
    await expect(resumo).toBeVisible();
    // Então: cada uma leva à aba dela no Financeiro, onde muda
    await expect(tabela.getByRole('link', { name: 'Mudar o lançamento Honorários do cliente em Entradas, no Financeiro' })).toHaveAttribute('href', '/financeiro/');
    await expect(tabela.getByRole('link', { name: 'Mudar o lançamento Conta de luz em Saídas, no Financeiro' })).toHaveAttribute('href', '/financeiro/saidas/');
    await expect(tabela.getByRole('button')).toHaveCount(0);
    // Quando: o mês seguinte começa de onde este parou
    await irParaMes(page, '2026-04');
    // Então
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '1.299,50' }).first()).toBeVisible();
  });

  test('quando lança um ajuste de saldo, então o saldo muda, e o resumo mostra o ajuste à parte das entradas e saídas', async ({ page }) => {
    // Dado
    await criarContas(page);
    await lancar(page, { tipo: 'entrada', valor: '500,00', descricao: 'Honorários do cliente', data: '2026-03-10' });
    await contasNoMes(page, '2026-03');
    const resumo = page.getByLabel('Resumo do mês');
    // Então: sem ajuste, a linha não aparece
    await expect(resumo).toBeVisible();
    await expect(resumo.getByText('Ajustes de saldo')).toHaveCount(0);
    // Quando
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a mais)', valor: '100,00', motivo: 'Diferença do extrato de março', data: '2026-03-11' });
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a menos)', valor: '30,00', motivo: 'Tarifa que faltou lançar', data: '2026-03-12' });
    // Então: o saldo acompanha
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela.getByRole('row').filter({ hasText: 'Diferença do extrato de março' })).toContainText('Ajuste de saldo (a mais)');
    await expect(tabela.getByRole('row').filter({ hasText: 'Diferença do extrato de março' })).toContainText('1.600,00');
    await expect(tabela.getByRole('row').filter({ hasText: 'Tarifa que faltou lançar' })).toContainText('Ajuste de saldo (a menos)');
    await expect(tabela.getByRole('row').filter({ hasText: 'Tarifa que faltou lançar' })).toContainText('1.570,00');
    // Então: as entradas são só o recebimento, e não há saída
    await expect(resumo.getByRole('definition').nth(1)).toContainText('500,00');
    await expect(resumo.getByRole('definition').nth(2)).toContainText('0,00');
    await expect(resumo.getByText('Ajustes de saldo')).toBeVisible();
    await expect(resumo.getByRole('definition').nth(3)).toContainText('100,00');
    await expect(resumo.getByRole('definition').nth(3)).toContainText('30,00');
    await expect(resumo.getByRole('definition').nth(4)).toContainText('1.570,00');
    // Quando: o mês seguinte começa de onde este parou, sem a linha de ajustes
    await irParaMes(page, '2026-04');
    // Então
    await expect(resumo.getByRole('definition').first()).toContainText('1.570,00');
    await expect(resumo.getByText('Ajustes de saldo')).toHaveCount(0);
  });

  test('quando escolhe um ajuste sem dizer o motivo, então o campo pede o motivo e não lança; e o ajuste só oferece os dois ajustes', async ({ page }) => {
    // Dado
    await criarContas(page);
    await page.getByRole('button', { name: 'Ajuste de saldo' }).click();
    const form = page.getByRole('form', { name: 'Novo ajuste de saldo' });
    await expect(form.getByLabel('Categoria').getByRole('option')).toHaveText(['Ajuste de saldo (a mais)', 'Ajuste de saldo (a menos)']);
    // Quando
    await form.getByLabel('Categoria').selectOption({ label: 'Ajuste de saldo (a menos)' });
    await form.getByLabel('Valor').fill('10,00');
    await form.getByRole('button', { name: 'Lançar' }).click();
    // Então
    await expect(form.getByText('Diga o motivo do ajuste.')).toBeVisible();
    await expect(form.getByText('não conta como receita, despesa nem lucro', { exact: false })).toBeVisible();
    await expect(form).toBeVisible();
  });

  test('quando muda, exclui e desfaz um ajuste de saldo, então funciona como os outros, e o histórico registra', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a mais)', valor: '100,00', motivo: 'Diferença do extrato', data: '2026-03-10' });
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    const linha = tabela.getByRole('row').filter({ hasText: 'Diferença do extrato' });
    // Quando
    await page.getByRole('button', { name: 'Mudar o lançamento Diferença do extrato' }).click();
    const form = page.getByRole('form', { name: 'Mudar lançamento' });
    await abrirSecao(page, 'Histórico deste lançamento');
    await form.getByLabel('Categoria').selectOption({ label: 'Ajuste de saldo (a menos)' });
    await form.getByRole('button', { name: 'Salvar lançamento' }).click();
    // Então: era mais cem, agora é menos cem
    await expect(linha).toContainText('Ajuste de saldo (a menos)');
    await expect(linha).toContainText('900,00');
    // Quando: abre de novo
    await page.getByRole('button', { name: 'Mudar o lançamento Diferença do extrato' }).click();
    // Então
    await expect(page.getByRole('listitem').filter({ hasText: 'Categoria:' })).toContainText('Ajuste de saldo (a mais)');
    await expect(page.getByRole('listitem').filter({ hasText: 'Categoria:' })).toContainText('Ajuste de saldo (a menos)');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(linha).toContainText('1.100,00');
    // Quando
    await tabela.getByRole('button', { name: 'Excluir' }).click();
    await tabela.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(linha).toContainText('1.100,00');
  });

  test('quando confere na auditoria, então todos os ajustes aparecem juntos, de todas as contas e meses', async ({ page }) => {
    // Dado
    await criarContas(page);
    await lancar(page, { tipo: 'saida', valor: '10,00', descricao: 'Papel', data: '2026-03-05' });
    await contasNoMes(page, '2026-02');
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a mais)', valor: '100,00', motivo: 'Diferença de fevereiro', data: '2026-02-10' });
    await irParaMes(page, '2026-03');
    await page.getByRole('combobox', { name: 'Conta' }).selectOption({ label: 'PF' });
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a menos)', valor: '30,00', motivo: 'Diferença de março', data: '2026-03-10' });
    // Quando
    await abrirSecao(page, 'Todos os ajustes de saldo');
    // Então
    const lista = page.getByRole('list', { name: 'Todos os ajustes de saldo' });
    await expect(lista.getByRole('listitem')).toHaveCount(2);
    const [marco, fevereiro] = [lista.getByRole('listitem').nth(0), lista.getByRole('listitem').nth(1)];
    await expect(marco).toContainText('Diferença de março');
    await expect(marco).toContainText('PF');
    await expect(marco).toContainText('30,00');
    await expect(fevereiro).toContainText('Diferença de fevereiro');
    await expect(fevereiro).toContainText('PJ');
    await expect(fevereiro).toContainText('100,00');
    await expect(lista).not.toContainText('Papel');
  });

  test('quando confere os ajustes no celular, então o valor aparece sem rolar para o lado', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    await criarContas(page);
    await irParaMes(page, '2026-02');
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a mais)', valor: '100,00', motivo: 'Diferença do extrato de fevereiro, que ainda falta conferir com o banco na auditoria', data: '2026-02-10' });
    // Quando
    await abrirSecao(page, 'Todos os ajustes de saldo');
    // Então
    const valor = page.getByRole('list', { name: 'Todos os ajustes de saldo' }).getByText('100,00');
    await expect(valor).toBeVisible();
    const caixa = (await valor.boundingBox())!, tela = page.viewportSize()!;
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(tela.width);
    const largura = await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth, tela: document.documentElement.clientWidth }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.tela);
  });

  test('dado um lançamento com categoria que esta versão não conhece, quando abre as contas e o Financeiro, então as telas funcionam e dá para excluir', async ({ page }) => {
    // Dado: é o que acontece ao voltar a versão do site depois que o banco ganhou uma categoria nova
    await criarContas(page);
    await lancar(page, { tipo: 'saida', valor: '10,00', descricao: 'Papel', data: '2026-03-10' });
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      bd.lancamentos[0].categoria = 'categoria_mais_nova';
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // Quando
    await page.reload();
    await contasNoMes(page, '2026-03');
    // Então
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela.getByRole('row').filter({ hasText: 'Papel' })).toContainText('categoria_mais_nova');
    await expect(tabela.getByRole('row').filter({ hasText: 'Papel' })).toContainText('990,00');
    // Quando: a linha leva à aba Saídas do Financeiro, onde ela muda
    await tabela.getByRole('link', { name: 'Mudar o lançamento Papel em Saídas, no Financeiro' }).click();
    await mesNoFinanceiro(page, 'Mar');
    await page.getByRole('button', { name: 'Abrir o lançamento: Papel' }).click();
    const janela = page.getByRole('dialog', { name: 'Lançamento' });
    await janela.getByRole('button', { name: 'Editar lançamento' }).click();
    // Então: o formulário mostra a categoria que está guardada, não a primeira da lista
    await expect(janela.getByRole('form', { name: 'Mudar lançamento' }).getByLabel('Categoria')).toHaveValue('categoria_mais_nova');
    await janela.getByRole('button', { name: 'Cancelar' }).click();
    // Quando
    await janela.getByRole('button', { name: 'Excluir' }).click();
    await janela.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
    await expect(page.getByText('Nenhuma saída neste período.')).toBeVisible();
    await contasNoMes(page, '2026-03');
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
  });

  test('quando esquece um campo, então avisa e não lança', async ({ page }) => {
    // Dado
    await criarContas(page);
    const form = await abrirLancamento(page, 'saida');
    // Quando
    await form.getByRole('button', { name: 'Registrar saída' }).click();
    // Então
    await expect(form.getByText('Informe o valor.')).toBeVisible();
    await expect(form.getByText('Diga do que se trata.')).toBeVisible();
  });

  test('quando muda um lançamento no Financeiro, então o saldo das contas muda, o histórico registra, e desfazer volta', async ({ page }) => {
    // Dado
    await criarContas(page);
    await lancar(page, { tipo: 'entrada', valor: '100,00', descricao: 'Reembolso', data: '2026-03-10' });
    await mesNoFinanceiro(page, 'Mar');
    // Quando
    await page.getByRole('button', { name: 'Abrir o lançamento: Reembolso' }).click();
    const janela = page.getByRole('dialog', { name: 'Lançamento' });
    await abrirSecao(janela, 'Histórico deste lançamento');
    await janela.getByRole('button', { name: 'Editar lançamento' }).click();
    await janela.getByRole('form', { name: 'Mudar lançamento' }).getByLabel('Valor').fill('150,00');
    await janela.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect(janela).toHaveCount(0);
    // Então: na página das contas (aberta pelo botão, sem recarregar), o saldo mudou
    await page.getByRole('link', { name: 'Contas e DAS' }).click();
    await expect(page.getByRole('heading', { name: /^Contas, DAS e sócios/ })).toBeVisible();
    await irParaMes(page, '2026-03');
    const linha = page.getByRole('table', { name: 'Lançamentos do mês' }).getByRole('row').filter({ hasText: 'Reembolso' });
    await expect(linha).toContainText('1.150,00');
    // Quando: desfaz (Ctrl+Z, fora de um campo)
    await page.getByRole('heading', { name: /^Contas, DAS e sócios/ }).click();
    await page.keyboard.press('Control+z');
    // Então
    await expect(linha).toContainText('1.100,00');
    // Quando: abre de novo no Financeiro
    await linha.getByRole('link', { name: /^Mudar o lançamento Reembolso em Entradas/ }).click();
    await mesNoFinanceiro(page, 'Mar');
    await page.getByRole('button', { name: 'Abrir o lançamento: Reembolso' }).click();
    // Então: o histórico mostra como estava e como ficou
    const historico = page.getByRole('dialog', { name: 'Lançamento' }).getByRole('listitem').filter({ hasText: 'Valor:' });
    await expect(historico.first()).toContainText(/R\$\s100,00/);
    await expect(historico.first()).toContainText(/R\$\s150,00/);
  });

  test('quando exclui um lançamento no Financeiro, então ele some das contas, e desfazer traz de volta', async ({ page }) => {
    // Dado
    await criarContas(page);
    await lancar(page, { tipo: 'saida', valor: '10,00', descricao: 'Papel', data: '2026-03-10' });
    await page.goto('/financeiro/saidas/');
    await mesNoFinanceiro(page, 'Mar');
    // Quando
    await page.getByRole('button', { name: 'Abrir o lançamento: Papel' }).click();
    await page.getByRole('dialog', { name: 'Lançamento' }).getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então: na página das contas (aberta pelo botão, sem recarregar), ele sumiu
    await page.getByRole('link', { name: 'Contas e DAS' }).click();
    await expect(page.getByRole('heading', { name: /^Contas, DAS e sócios/ })).toBeVisible();
    await irParaMes(page, '2026-03');
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(page.getByRole('table', { name: 'Lançamentos do mês' })).toContainText('Papel');
  });

  test('quando faz um repasse entre contas, então sai da PJ e entra na PF, sem botão de mudar, e excluir tira das duas', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    // Quando
    await page.getByRole('button', { name: 'Repasse entre contas' }).click();
    const form = page.getByRole('form', { name: 'Repasse entre contas' });
    await expect(form.getByLabel('Descrição')).toHaveValue('Repasse de PJ para PF');
    await form.getByLabel('Data').fill('2026-03-15');
    await form.getByLabel('Valor').fill('300,00');
    await form.getByRole('button', { name: 'Lançar repasse' }).click();
    await expect(form).toHaveCount(0);
    // Então: na PJ
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    const linha = tabela.getByRole('row').filter({ hasText: 'Repasse de PJ para PF' });
    await expect(linha).toContainText('Repasse entre contas');
    await expect(linha).toContainText('700,00');
    await expect(linha.getByRole('button', { name: /^Mudar/ })).toHaveCount(0);
    // Quando: na PF
    await page.getByRole('combobox', { name: 'Conta' }).selectOption({ label: 'PF' });
    // Então
    await expect(linha).toContainText('300,00');
    // Quando
    await linha.getByRole('button', { name: 'Excluir' }).click();
    await linha.getByRole('button', { name: 'Confirmar: excluir as duas pontas' }).click();
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
    await page.getByRole('combobox', { name: 'Conta' }).selectOption({ label: 'PJ' });
    // Então
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
  });

  test('quando lança o DAS, então o aviso some; no mês seguinte, avisa que vale o último', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await expect(page.getByText('Nenhum DAS lançado até este mês.', { exact: false })).toBeVisible();
    await abrirSecao(page, 'DAS de cada mês');
    const form = page.getByRole('form', { name: 'Lançar o DAS' });
    // Quando
    await form.getByLabel('Mês').fill('2026-03');
    await form.getByLabel('Percentual do DAS').fill('4,5');
    await form.getByRole('button', { name: 'Salvar DAS' }).click();
    // Então
    await expect(page.getByText('DAS deste mês: 4,5%.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'DAS lançados' })).toContainText('03/2026');
    // Quando
    await irParaMes(page, '2026-04');
    // Então
    await expect(page.getByText('O DAS deste mês ainda não foi lançado. Está valendo o de 03/2026.')).toBeVisible();
  });

  test('quando abre "Mudar" de outro ajuste com o formulário aberto, então ele mostra o outro, e salvar não troca um pelo outro', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a mais)', valor: '150,00', motivo: 'Primeiro', data: '2026-03-10' });
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a menos)', valor: '99,00', motivo: 'Segundo', data: '2026-03-20' });
    // Quando
    await page.getByRole('button', { name: 'Mudar o lançamento Primeiro' }).click();
    await page.getByRole('button', { name: 'Mudar o lançamento Segundo' }).click();
    const form = page.getByRole('form', { name: 'Mudar lançamento' });
    // Então
    await expect(form.getByLabel('Motivo do ajuste')).toHaveValue('Segundo');
    await expect(form.getByLabel('Valor')).toHaveValue('99,00');
    // Quando
    await form.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect(form).toHaveCount(0);
    // Então
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela).toContainText('Primeiro');
    await expect(tabela).toContainText('Segundo');
  });

  test('dadas as contas criadas, quando a pessoa aperta "N" fora de um campo, então abre o ajuste de saldo, como o botão do cabeçalho (#86)', async ({ page }) => {
    // Dado
    await criarContas(page);
    await expect(page.getByRole('button', { name: 'Ajuste de saldo' })).toHaveAttribute('title', 'Ajuste de saldo (N)');
    await page.getByRole('heading', { name: /^Contas, DAS e sócios/ }).click();
    // Quando
    await page.keyboard.press('n');
    // Então
    await expect(page.getByRole('form', { name: 'Novo ajuste de saldo' })).toBeVisible();
  });

  test('quando apaga o campo do mês e clica em "Ajuste de saldo", então nada quebra', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    // Quando
    await page.getByLabel('Mês', { exact: true }).first().fill('');
    await page.getByRole('button', { name: 'Ajuste de saldo' }).click();
    // Então
    await expect(page.getByRole('form', { name: 'Novo ajuste de saldo' }).getByLabel('Data')).toHaveValue('01/03/2026');   // o campo de data mostra dd/mm/aaaa (#357)
  });

  test('quando exclui o ajuste que está sendo mudado, então o formulário fecha', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a menos)', valor: '10,00', motivo: 'Tarifa', data: '2026-03-10' });
    await page.getByRole('button', { name: 'Mudar o lançamento Tarifa' }).click();
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    // Quando
    await tabela.getByRole('button', { name: 'Excluir', exact: true }).click();
    await tabela.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
    await expect(page.getByRole('form', { name: 'Mudar lançamento' })).toHaveCount(0);
  });

  test('quando digita o ponto de milhar fora do lugar, então recusa, em vez de multiplicar o valor', async ({ page }) => {
    // Dado
    await criarContas(page);
    const form = await abrirLancamento(page, 'saida');
    // Quando
    await form.getByLabel('Valor').fill('15.00,00');
    await form.getByLabel('Descrição').fill('Erro');
    await form.getByRole('button', { name: 'Registrar saída' }).click();
    // Então
    await expect(form.getByText('Use um valor como 1.500,00.')).toBeVisible();
  });

  // Desde a #347, a conta arquivada mostra "Desarquivar" (com a caixa aberta), como os outros módulos, no lugar de "Reativar".
  test('quando arquiva e desarquiva uma conta, então ela sai e volta; sem conta ativa, diz o que fazer', async ({ page }) => {
    // Dado
    await criarContas(page);
    const conta = page.getByRole('combobox', { name: 'Conta' });
    // Quando
    await page.getByRole('button', { name: 'Arquivar a conta PF' }).click();
    // Então
    await expect(conta.getByRole('option', { name: 'PF' })).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Arquivar a conta PJ' }).click();
    // Então
    await expect(page.getByText('Todas as contas estão arquivadas.', { exact: false })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desarquivar a conta PJ' }).click();
    // Então
    await expect(page.getByRole('combobox', { name: 'Conta' })).toContainText('PJ');
  });

  test('quando arquiva uma conta sem lançamentos, então a lixeira a exclui no segundo clique; a que tem lançamentos explica por que não (#347)', async ({ page }) => {
    // Dado: a PJ com um lançamento, e as duas arquivadas
    await criarContas(page);
    await lancar(page, { tipo: 'saida', valor: '10,00', descricao: 'Papel', data: '2026-03-10' });
    await contasNoMes(page, '2026-03');
    await page.getByRole('button', { name: 'Arquivar a conta PF' }).click();
    await page.getByRole('button', { name: 'Arquivar a conta PJ' }).click();
    const contas = page.getByRole('list', { name: 'Contas do escritório' });
    const pf = contas.getByRole('listitem').filter({ hasText: /^PF/ }), pj = contas.getByRole('listitem').filter({ hasText: /^PJ/ });
    // Então: as duas mostram Desarquivar com a caixa aberta; só a PF tem a lixeira; a PJ explica
    await expect(page.getByRole('button', { name: 'Desarquivar a conta PF' }).locator('svg')).toHaveAttribute('data-icone', 'arquivoAberto');
    await expect(pj.getByText('não pode ser excluída enquanto tiver lançamentos', { exact: false })).toBeVisible();
    await expect(pj.getByRole('button', { name: /Excluir/ })).toHaveCount(0);
    await expect(pf.getByRole('button', { name: 'Excluir a conta PF', exact: true }).locator('svg')).toHaveAttribute('data-icone', 'lixeira');
    // Quando: o primeiro clique só pede a confirmação; o segundo exclui
    await pf.getByRole('button', { name: 'Excluir a conta PF', exact: true }).click();
    await pf.getByRole('button', { name: 'Confirmar exclusão de PF' }).click();
    // Então
    await expect(page.getByText('Conta PF excluída definitivamente.')).toBeVisible();
    await expect(pf).toHaveCount(0);
    await expect(pj).toHaveCount(1);
  });

  test('quando muda o início da conta para depois de um lançamento, então recusa; o saldo inicial fica registrado', async ({ page }) => {
    // Dado
    await criarContas(page);
    await lancar(page, { tipo: 'entrada', valor: '10,00', descricao: 'Algo', data: '2026-03-10' });
    await contasNoMes(page, '2026-03');
    await page.getByRole('button', { name: 'Mudar a conta PJ' }).click();
    const form = page.getByRole('form', { name: 'Mudar conta' });
    // Quando
    await form.getByLabel('Em que dia').fill('2026-06-01');
    await form.getByRole('button', { name: 'Salvar conta' }).click();
    // Então
    await expect(page.getByText('Há lançamentos antes dessa data.', { exact: false }).first()).toBeVisible();
    // Quando
    await form.getByLabel('Em que dia').fill('2026-01-01');
    await form.getByLabel('Saldo inicial').fill('2.000,00');
    await form.getByRole('button', { name: 'Salvar conta' }).click();
    await expect(form).toHaveCount(0);
    await abrirSecao(page, 'Mudanças no saldo inicial, no DAS e nos sócios');
    // Então
    await expect(page.getByText('Saldo inicial de PJ', { exact: false })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Lançamentos do mês' })).toContainText('2.010,00');
  });

  test('quando o valor do DAS não serve, então avisa', async ({ page }) => {
    // Dado
    await criarContas(page);
    await abrirSecao(page, 'DAS de cada mês');
    const form = page.getByRole('form', { name: 'Lançar o DAS' });
    // Quando
    await form.getByLabel('Percentual do DAS').fill('4,567');
    await form.getByRole('button', { name: 'Salvar DAS' }).click();
    // Então
    await expect(form.getByText('O DAS precisa ser um percentual de 0 a 100, com até duas casas.')).toBeVisible();
  });
});

// A regra mudou em 07/11/2026: o menu deixou de ter um submenu com as telas; o Financeiro é um link só, para a página
// com as abas Entradas, Saídas, Direitos e Obrigações.
test('quando a pessoa abre o menu, então o Financeiro é um link só, que leva à página com as quatro abas', async ({ page }) => {
  // Quando
  await page.goto('/inicio/');
  const secoes = page.getByRole('navigation', { name: 'Seções' });
  await expect(secoes.getByRole('button', { name: 'Financeiro' })).toHaveCount(0);
  await secoes.getByRole('link', { name: 'Financeiro', exact: true }).click();
  // Então
  const abas = page.getByRole('navigation', { name: 'Abas do financeiro' });
  for (const aba of ['Entradas', 'Saídas', 'Direitos', 'Obrigações']) await expect(abas.getByRole('link', { name: aba, exact: true })).toBeVisible();
});

// As telas que ficaram fora das abas abrem por botões no alto do Financeiro (#331, aprovado pelo dono em 22/11/2026).
test.describe('As outras telas do Financeiro', () => {
  const outras = (page: Page) => page.getByRole('navigation', { name: 'Outras telas do Financeiro' });

  test('dado o administrador, quando abre o Financeiro, então os botões do alto levam a Meus valores, à Conferência e ao Lucro dos sócios', async ({ page }) => {
    // Quando
    await page.goto('/financeiro/');
    // Então
    await expect(outras(page).getByRole('link')).toHaveText(['Meus valores', 'Conferência', 'Lucro dos sócios']);
    for (const [botao, endereco, titulo] of [['Meus valores', /\/meus-valores\/$/, /^Meus valores/], ['Conferência', /\/conferencia\/$/, /^Conferência/], ['Lucro dos sócios', /\/lucros\/$/, /^Lucro dos sócios/]] as const) {
      // Quando
      await page.goto('/financeiro/');
      await outras(page).getByRole('link', { name: botao }).click();
      // Então
      await expect(page).toHaveURL(endereco);
      await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    }
  });

  test('dado quem não é administrador, quando abre o Financeiro, então vê Meus valores e a Conferência, sem o Lucro dos sócios', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo('u-bruno'));
    // Quando
    await page.goto('/financeiro/');
    // Então
    await expect(outras(page).getByRole('link')).toHaveText(['Meus valores', 'Conferência']);
  });
});

// Os endereços que mudaram de lugar levam para sempre à página nova (#331): os favoritos e os links antigos continuam valendo.
test.describe('Os endereços antigos do Financeiro', () => {
  for (const [antigo, novo] of [['/parcelas/', /\/financeiro\/direitos\/$/], ['/financeiro/receitas/', /\/financeiro\/direitos\/$/], ['/financeiro/despesas/', /\/financeiro\/obrigacoes\/$/]] as const) {
    test(`quando alguém abre ${antigo}, então vai para a página nova, com as abas do Financeiro`, async ({ page }) => {
      // Quando
      await page.goto(antigo);
      // Então
      await expect(page).toHaveURL(novo);
      await expect(page.getByRole('navigation', { name: 'Abas do financeiro' })).toBeVisible();
    });
  }
});

test.describe('A janela de cada lançamento', () => {
  test('quando lança uma saída e clica na linha, então vê tudo do lançamento; depois edita, exclui e desfaz', async ({ page }) => {
    // Dado
    await criarContas(page);
    await page.goto('/financeiro/saidas/');
    await page.getByRole('button', { name: 'Nova saída' }).click();
    const nova = page.getByRole('form', { name: 'Nova saída' });
    await nova.getByLabel('Valor').fill('48,00');
    await nova.getByLabel('Descrição').fill('Conta de água');
    await nova.getByRole('button', { name: 'Registrar saída' }).click();
    await page.getByRole('button', { name: 'Fechar' }).click();
    // Quando: clica na linha (em qualquer lugar dela)
    await page.getByRole('table', { name: 'Saídas', exact: true }).getByRole('row').filter({ hasText: 'Conta de água' }).getByRole('cell').last().click();
    // Então: primeiro vê, sem formulário
    const janela = page.getByRole('dialog', { name: 'Lançamento' });
    await expect(janela.getByRole('region', { name: 'No caixa' })).toContainText('Conta de água');
    await expect(janela).toContainText(dinheiro('48,00'));
    await expect(janela.getByRole('form', { name: 'Mudar lançamento' })).toHaveCount(0);
    // Quando: edita
    await janela.getByRole('button', { name: 'Editar lançamento' }).click();
    await janela.getByRole('form', { name: 'Mudar lançamento' }).getByLabel('Valor').fill('50,00');
    await janela.getByRole('button', { name: 'Salvar lançamento' }).click();
    // Então
    await expect(page.getByRole('table', { name: 'Saídas', exact: true })).toContainText(dinheiro('50,00'));
    // Quando: exclui
    await page.getByRole('button', { name: 'Abrir o lançamento: Conta de água' }).click();
    await page.getByRole('dialog', { name: 'Lançamento' }).getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
    await expect(page.getByText('Nenhuma saída neste período.')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    await expect(page.getByRole('table', { name: 'Saídas', exact: true })).toContainText('Conta de água');
  });
});

// O painel do Financeiro (#403): os números do período, comparados com o de antes, e os gráficos, com as contas de sempre.
test.describe('O painel do Financeiro', () => {
  /** Hoje, nos testes do painel: 22/11/2026. */
  const HOJE = new Date('2026-11-22T12:00:00-03:00');

  /**
   * O caixa e as parcelas de exemplo: a conta PJ com R$ 1.000,00 no começo do ano; em outubro, R$ 3.000,00 de entrada e R$ 1.000,00 de
   * saída; em novembro, R$ 5.000,00 de entrada, R$ 2.000,00 de saída e um ajuste de R$ 100,00 a mais (que muda o saldo, mas não é
   * receita). Num contrato da Ana, uma parcela de R$ 400,00 recebida em novembro, uma de R$ 800,00 vencida em 05/11 e uma de
   * R$ 1.200,00 que vence em 25/11. "dono" troca de quem é o contrato; "logado", quem abre o Financeiro (o Mauro, administrador, se não vier).
   */
  async function painelDeExemplo(page: Page, { dono = 'u-ana', logado }: { dono?: string; logado?: string } = {}) {
    await page.clock.setFixedTime(HOJE);
    await page.goto('/inicio/');
    await page.evaluate(({ dono, logado }) => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      const contrato = bd.contratos.find((k: { responsavel_id: string; arquivado_em: string | null }) => k.responsavel_id === dono && !k.arquivado_em);
      if (logado) bd.logadoComo = logado;
      bd.contasFinanceiras = [{ id: 'c-pj', nome: 'PJ', tem_das: false, saldo_inicial: 100000, saldo_inicial_em: '2026-01-01', arquivada_em: null }];
      let n = 0;
      const lancamento = (data: string, tipo: string, categoria: string, valor: number, descricao: string) => ({
        id: 'l' + (n++), conta_id: 'c-pj', data, tipo, categoria, valor, descricao, par_id: null, origem: null, excluido_em: null, criado_por: 'u-master',
        criado_em: data + 'T12:00:00Z', atualizado_em: data + 'T12:00:00Z'
      });
      bd.lancamentos = [
        lancamento('2026-10-05', 'entrada', 'outra_entrada', 300000, 'Consultoria de outubro'), lancamento('2026-10-10', 'saida', 'despesa', 100000, 'Aluguel de outubro'),
        lancamento('2026-11-05', 'entrada', 'outra_entrada', 500000, 'Consultoria de novembro'), lancamento('2026-11-10', 'saida', 'despesa', 200000, 'Aluguel de novembro'),
        lancamento('2026-11-12', 'entrada', 'ajuste_a_mais', 10000, 'Diferença do extrato')
      ];
      const parcela = (numero: number, vencimento: string, valor: number, recebida: boolean) => ({ id: 'px' + numero, contrato_id: contrato.id, numero, vencimento, valor,
        recebimento_id: null, recebida_em: recebida ? vencimento : null, recebido: recebida ? valor : null, excluido_em: null });
      bd.parcelas = [parcela(1, '2026-11-03', 40000, true), parcela(2, '2026-11-05', 80000, false), parcela(3, '2026-11-25', 120000, false)];
      bd.recebimentos = [];
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    }, { dono, logado });
    await page.goto('/financeiro/');
    return page.getByRole('group', { name: 'Números de Nov/2026' });
  }

  test('quando abre, então os números do mês são os do caixa e das parcelas, cada um comparado com o mês anterior', async ({ page }) => {
    // Quando
    const numeros = await painelDeExemplo(page);
    // Então: sem o ajuste nas entradas, mas com ele no saldo
    await expect(page.getByRole('heading', { level: 1, name: 'Financeiro.' })).toBeVisible();
    await expect(page.getByText('O caixa e os contratos do escritório todo.')).toBeVisible();
    await expect(numeros.getByRole('link', { name: /^Entradas · Nov\/2026/ })).toContainText(dinheiro('5.000,00'));
    await expect(numeros.getByRole('link', { name: /^Entradas · Nov\/2026/ })).toContainText('mil a mais que em Out/2026');
    await expect(numeros.getByRole('link', { name: /^Saídas · Nov\/2026/ })).toContainText(dinheiro('2.000,00'));
    await expect(numeros.getByRole('region', { name: 'Resultado · Nov/2026' })).toContainText(dinheiro('3.000,00'));
    await expect(numeros.getByRole('link', { name: /^Saldo nas contas/ })).toContainText(dinheiro('6.100,00'));
    await expect(numeros.getByRole('link', { name: /^Saldo nas contas/ })).toContainText('hoje');
    // Então: o que falta receber fica à parte da receita, e o atraso vem em destaque
    await expect(numeros.getByRole('link', { name: /^A receber · Nov\/2026/ })).toContainText(dinheiro('2.000,00'));
    await expect(numeros.getByRole('link', { name: /^A receber · Nov\/2026/ })).toContainText('2 parcelas vencem no período');
    await expect(numeros.getByRole('link', { name: /^Em atraso hoje/ })).toContainText(dinheiro('800,00'));
    const desempenho = page.getByRole('group', { name: 'Desempenho de Nov/2026' });
    await expect(desempenho.getByRole('region', { name: /^Receita bruta/ })).toContainText(dinheiro('400,00'));
    await expect(desempenho).not.toContainText('A receber');
  });

  test('quando abre "Ver os números" dos gráficos, então lê em texto as entradas, as saídas e o resultado de cada mês, e o que falta receber de cada semana', async ({ page }) => {
    // Dado
    await painelDeExemplo(page);
    const caixa = page.getByRole('region', { name: 'Entradas e saídas · 12 meses' });
    const aReceber = page.getByRole('region', { name: 'A receber nas próximas semanas' });
    // Quando
    await caixa.getByText('Ver os números').click();
    await aReceber.getByText('Ver os números').click();
    // Então
    const novembro = caixa.getByRole('table').getByRole('row', { name: /novembro de 2026/ });
    await expect(novembro).toContainText(dinheiro('5.000,00'));
    await expect(novembro).toContainText(dinheiro('2.000,00'));
    await expect(novembro).toContainText(dinheiro('3.000,00'));
    await expect(caixa).toContainText('Resultado no período');
    await expect(aReceber.getByRole('table').getByRole('row', { name: /Atrasadas · 1 parcela/ })).toContainText(dinheiro('800,00'));
    await expect(aReceber.getByRole('table').getByRole('row', { name: /De 22\/11 a 28\/11 · 1 parcela/ })).toContainText(dinheiro('1.200,00'));
  });

  test('quando lê um mês do gráfico pelo teclado, então a dica mostra o valor exato em reais e o resultado do mês', async ({ page }) => {
    // Dado
    await painelDeExemplo(page);
    const grafico = page.getByRole('group', { name: /^Entradas e saídas do caixa em cada mês/ });
    // Quando: as setas, Home e End passam de um mês ao outro, como o mouse e o toque
    await grafico.focus();
    await page.keyboard.press('End');
    // Então
    const dica = page.getByRole('status').filter({ hasText: 'novembro de 2026' });
    await expect(dica).toContainText(dinheiro('5.000,00'));
    await expect(dica).toContainText(dinheiro('3.000,00'));
    await expect(dica).toContainText('Resultado');
  });

  test('quando troca o mês, então os números e os gráficos mudam junto, e o saldo é o do fim daquele mês', async ({ page }) => {
    // Dado
    await painelDeExemplo(page);
    // Quando
    await page.getByRole('group', { name: 'Mês' }).getByRole('button', { name: 'Out' }).click();
    // Então
    const numeros = page.getByRole('group', { name: 'Números de Out/2026' });
    await expect(numeros.getByRole('link', { name: /^Entradas · Out\/2026/ })).toContainText(dinheiro('3.000,00'));
    await expect(numeros.getByRole('link', { name: /^Saldo nas contas/ })).toContainText(dinheiro('3.000,00'));
    await expect(numeros.getByRole('link', { name: /^Saldo nas contas/ })).toContainText('em 31/10/2026');
    await expect(numeros.getByRole('link', { name: /^Saldo nas contas/ })).toContainText('mil a mais que em Set/2026');
    await expect(page.getByRole('region', { name: 'Desempenho · Out/2026' })).toBeVisible();
    await expect(page.getByRole('group', { name: /^Entradas e saídas do caixa em cada mês, de novembro de 2025 a outubro de 2026/ })).toBeVisible();
  });

  test('quando o administrador escolhe uma advogada, então vê a receita, o que falta receber e o atraso dos contratos dela, sem o caixa', async ({ page }) => {
    // Dado
    await painelDeExemplo(page);
    // Quando
    await page.getByRole('combobox', { name: 'De quem' }).selectOption({ label: 'Ana Teste Lima' });
    // Então
    await expect(page.getByText('Os contratos de Ana Teste Lima.', { exact: true })).toBeVisible();
    const numeros = page.getByRole('group', { name: 'Números de Nov/2026' });
    await expect(numeros.getByRole('link', { name: /^Receita bruta · Nov\/2026/ })).toContainText(dinheiro('400,00'));
    await expect(numeros.getByRole('link', { name: /^A receber · Nov\/2026/ })).toContainText(dinheiro('2.000,00'));
    await expect(numeros.getByRole('link', { name: /^Em atraso hoje/ })).toContainText(dinheiro('800,00'));
    await expect(numeros.getByRole('link', { name: /^Saldo nas contas/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Receita bruta e líquida · 12 meses' })).toBeVisible();
  });

  test('quando um número leva a uma lista, então a aba dela abre embaixo, à vista', async ({ page }) => {
    // Dado
    const numeros = await painelDeExemplo(page);
    // Quando
    await numeros.getByRole('link', { name: /^Saídas · Nov\/2026/ }).click();
    // Então
    await expect(page).toHaveURL(/\/financeiro\/saidas\/#financeiro-listas$/);
    await expect(page.getByRole('table', { name: 'Saídas', exact: true })).toContainText('Aluguel de novembro');
    await expect(page.getByRole('navigation', { name: 'Abas do financeiro' })).toBeInViewport();
  });

  test('no celular (375px), quando abre, então nada passa da largura da tela', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    // Quando
    await painelDeExemplo(page);
    await expect(page.getByRole('region', { name: 'A receber nas próximas semanas' })).toBeVisible();
    // Então
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    for (const numero of await page.getByRole('group', { name: 'Números de Nov/2026' }).getByRole('link').all()) {
      expect(await numero.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });

  test('quando abre, então a receita por área do mês mostra o objeto do contrato que recebeu, e um mês sem receita fica sem barras', async ({ page }) => {
    // Dado
    await painelDeExemplo(page);
    const objeto = await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      const parcela = bd.parcelas.find((p: { id: string }) => p.id === 'px1');
      return bd.contratos.find((k: { id: string }) => k.id === parcela.contrato_id).objetos[0] as string;
    });
    const area = page.getByRole('region', { name: 'Receita por área · Nov/2026' });
    // Quando
    await area.getByText('Ver os números').click();
    // Então: só o que entrou (a parcela recebida de R$ 400,00), nada do que falta receber
    await expect(area.getByRole('table').getByRole('row', { name: new RegExp(objeto) })).toContainText(dinheiro('400,00'));
    await expect(area).not.toContainText('1.200,00');
    // Quando
    await page.getByRole('group', { name: 'Mês' }).getByRole('button', { name: 'Set' }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Receita por área · Set/2026' })).toContainText('Nenhuma receita neste período.');
  });

  test('dado quem não é administrador com um contrato, quando abre, então vê a receita, o que falta receber e o atraso só dele, sem nada do caixa', async ({ page }) => {
    // Quando: o contrato com as parcelas é do Bruno, e é ele quem abre
    const numeros = await painelDeExemplo(page, { dono: 'u-bruno', logado: 'u-bruno' });
    // Então
    await expect(page.getByText('Os contratos de que você é responsável.')).toBeVisible();
    await expect(numeros.getByRole('link', { name: /^Receita bruta · Nov\/2026/ })).toContainText(dinheiro('400,00'));
    await expect(numeros.getByRole('link', { name: /^A receber · Nov\/2026/ })).toContainText(dinheiro('2.000,00'));
    await expect(numeros.getByRole('link', { name: /^Em atraso hoje/ })).toContainText(dinheiro('800,00'));
    // Então: nada do caixa (entradas e saídas das contas, resultado, saldo), nem a escolha de quem
    await expect(numeros.getByRole('link', { name: /^(Entradas|Saídas|Saldo nas contas)/ })).toHaveCount(0);
    await expect(numeros.getByRole('region', { name: /^Resultado/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: /^Entradas e saídas/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Receita bruta e líquida · 12 meses' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'De quem' })).toHaveCount(0);
    await expect(page.getByText('Consultoria de novembro')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Saídas', exact: true })).toHaveCount(0);
  });

  test('quando quem não é administrador abre, então vê só os contratos de que é responsável, sem o caixa', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo('u-bruno'));
    // Quando
    await page.goto('/financeiro/');
    // Então
    await expect(page.getByText('Os contratos de que você é responsável.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'De quem' })).toHaveCount(0);
    await expect(page.getByText('Saldo nas contas')).toHaveCount(0);
  });

  test('dado o Financeiro desligado no escritório, quando alguém tenta abrir, então continua sem ver nada', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      bd.escritorio = { ...bd.escritorio, modulos: { pessoas: true, contratos: true, demandas: true, tarefas: true, processos: true, compromissos: true, anotacoes: true, financeiro: false } };
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // Quando
    await page.goto('/financeiro/');
    // Então
    await expect(page).toHaveURL(/\/inicio\/$/);
    await expect(page.getByRole('group', { name: /^Números de/ })).toHaveCount(0);
  });
});
