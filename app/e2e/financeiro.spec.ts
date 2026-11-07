// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O caixa do escritório. Quem está logado é o Mateus (administrador). O banco fictício começa sem contas.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

/** Cria as contas PJ (recolhe DAS, com saldo) e PF, a partir de janeiro. */
async function criarContas(page: Page) {
  await page.goto('/financeiro/contas/');
  await abrirSecao(page, 'Contas');
  for (const [nome, saldo, das] of [['PJ', '1.000,00', true], ['PF', '0,00', false]] as const) {
    await page.getByRole('button', { name: 'Nova conta' }).click();
    const form = page.getByRole('form', { name: 'Nova conta' });
    await form.getByLabel('Nome da conta').fill(nome);
    await form.getByLabel('Saldo inicial').fill(saldo);
    await form.getByLabel('Em que dia').fill('2026-01-01');
    if (das) await form.getByText('Esta conta recolhe DAS').click();
    await form.getByRole('button', { name: 'Criar conta' }).click();
    await expect(form).toHaveCount(0);
  }
}
async function lancar(page: Page, { categoria, valor, descricao, data }: { categoria: string; valor: string; descricao: string; data: string }) {
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const form = page.getByRole('form', { name: 'Novo lançamento' });
  await form.getByLabel('Data').fill(data);
  await form.getByLabel('Categoria').selectOption({ label: categoria });
  await form.getByLabel('Valor').fill(valor);
  await form.getByLabel('Descrição').fill(descricao);
  await form.getByRole('button', { name: 'Lançar' }).click();
  await expect(form).toHaveCount(0);
}
async function lancarAjuste(page: Page, { categoria, valor, motivo, data }: { categoria: string; valor: string; motivo: string; data: string }) {
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const form = page.getByRole('form', { name: 'Novo lançamento' });
  await form.getByLabel('Data').fill(data);
  await form.getByLabel('Categoria').selectOption({ label: categoria });
  await form.getByLabel('Valor').fill(valor);
  await form.getByLabel('Motivo do ajuste').fill(motivo);
  await form.getByRole('button', { name: 'Lançar' }).click();
  await expect(form).toHaveCount(0);
}
const irParaMes = (page: Page, mes: string) => page.getByLabel('Mês', { exact: true }).first().fill(mes);

test.describe('Caixa', () => {
  test('quando não há contas, então o Financeiro leva às contas, que pedem para criar; ao criar, mostra o caixa da conta', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando: o menu leva ao Financeiro, e o link Contas e DAS, às contas
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Financeiro', exact: true }).click();
    await page.getByRole('link', { name: 'Contas e DAS' }).click();
    // Então
    await expect(page.getByText('Nenhuma conta ainda.', { exact: false })).toBeVisible();
    // Quando
    await criarContas(page);
    // Então
    await expect(page.getByRole('combobox', { name: 'Conta' })).toHaveValue(/.+/);
    await expect(page.getByRole('list', { name: 'Contas do escritório' })).toContainText('PJ (recolhe DAS)');
  });

  test('quando lança entrada e saída, então o saldo acompanha, e o resumo do mês fecha', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    // Quando
    await lancar(page, { categoria: 'Recebimento de cliente (entrada)', valor: '500,00', descricao: 'Honorários do cliente', data: '2026-03-10' });
    await lancar(page, { categoria: 'Despesa (saída)', valor: '200,50', descricao: 'Conta de luz', data: '2026-03-11' });
    // Então
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela.getByRole('row').filter({ hasText: 'Honorários do cliente' })).toContainText('1.500,00');
    await expect(tabela.getByRole('row').filter({ hasText: 'Conta de luz' })).toContainText('1.299,50');
    const resumo = page.getByRole('definition').filter({ hasText: '1.299,50' });
    await expect(resumo).toBeVisible();
    // Quando: o mês seguinte começa de onde este parou
    await irParaMes(page, '2026-04');
    // Então
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '1.299,50' }).first()).toBeVisible();
  });

  test('quando lança um ajuste de saldo, então o saldo muda, e o resumo mostra o ajuste à parte das entradas e saídas', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    const resumo = page.getByLabel('Resumo do mês');
    await lancar(page, { categoria: 'Recebimento de cliente (entrada)', valor: '500,00', descricao: 'Honorários do cliente', data: '2026-03-10' });
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

  test('quando escolhe um ajuste sem dizer o motivo, então o campo pede o motivo e não lança', async ({ page }) => {
    // Dado
    await criarContas(page);
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const form = page.getByRole('form', { name: 'Novo lançamento' });
    await expect(form.getByLabel('Descrição')).toBeVisible();
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
    await irParaMes(page, '2026-02');
    await lancarAjuste(page, { categoria: 'Ajuste de saldo (a mais)', valor: '100,00', motivo: 'Diferença de fevereiro', data: '2026-02-10' });
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Despesa (saída)', valor: '10,00', descricao: 'Papel', data: '2026-03-05' });
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

  test('dado um lançamento com categoria que esta versão não conhece, quando abre o caixa, então a tela funciona e dá para excluir', async ({ page }) => {
    // Dado: é o que acontece ao voltar a versão do site depois que o banco ganhou uma categoria nova
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Despesa (saída)', valor: '10,00', descricao: 'Papel', data: '2026-03-10' });
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      bd.lancamentos[0].categoria = 'categoria_mais_nova';
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // Quando
    await page.reload();
    await irParaMes(page, '2026-03');
    // Então
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela.getByRole('row').filter({ hasText: 'Papel' })).toContainText('categoria_mais_nova');
    await expect(tabela.getByRole('row').filter({ hasText: 'Papel' })).toContainText('990,00');
    // Quando
    await page.getByRole('button', { name: 'Mudar o lançamento Papel' }).click();
    // Então: o formulário mostra a categoria que está guardada, não a primeira da lista
    await expect(page.getByRole('form', { name: 'Mudar lançamento' }).getByLabel('Categoria')).toHaveValue('categoria_mais_nova');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // Quando
    await tabela.getByRole('button', { name: 'Excluir' }).click();
    await tabela.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
    await expect(page.getByText('Nenhum lançamento nesta conta neste mês.')).toBeVisible();
  });

  test('quando esquece um campo, então avisa e não lança', async ({ page }) => {
    // Dado
    await criarContas(page);
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const form = page.getByRole('form', { name: 'Novo lançamento' });
    // Quando
    await form.getByRole('button', { name: 'Lançar' }).click();
    // Então
    await expect(form.getByText('Informe o valor.')).toBeVisible();
    await expect(form.getByText('Diga do que se trata.')).toBeVisible();
  });

  test('quando muda um lançamento, então o saldo muda, o histórico registra, e desfazer volta', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Outra entrada (entrada)', valor: '100,00', descricao: 'Reembolso', data: '2026-03-10' });
    const linha = page.getByRole('table', { name: 'Lançamentos do mês' }).getByRole('row').filter({ hasText: 'Reembolso' });
    // Quando
    await page.getByRole('button', { name: 'Mudar o lançamento Reembolso' }).click();
    const form = page.getByRole('form', { name: 'Mudar lançamento' });
    await abrirSecao(page, 'Histórico deste lançamento');
    await form.getByLabel('Valor').fill('150,00');
    await form.getByRole('button', { name: 'Salvar lançamento' }).click();
    // Então
    await expect(linha).toContainText('1.150,00');
    // Quando: abre de novo
    await page.getByRole('button', { name: 'Mudar o lançamento Reembolso' }).click();
    // Então: o histórico mostra como estava e como ficou
    await expect(page.getByText(/R\$\s100,00/).first()).toBeVisible();
    await expect(page.getByText(/R\$\s150,00/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(linha).toContainText('1.100,00');
  });

  test('quando exclui um lançamento, então ele some, e desfazer traz de volta', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Despesa (saída)', valor: '10,00', descricao: 'Papel', data: '2026-03-10' });
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    // Quando
    await tabela.getByRole('button', { name: 'Excluir' }).click();
    await tabela.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
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

  test('quando abre "Mudar" de outro lançamento com o formulário aberto, então ele mostra o outro, e salvar não troca um pelo outro', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Outra entrada (entrada)', valor: '150,00', descricao: 'Primeiro', data: '2026-03-10' });
    await lancar(page, { categoria: 'Despesa (saída)', valor: '99,00', descricao: 'Segundo', data: '2026-03-20' });
    // Quando
    await page.getByRole('button', { name: 'Mudar o lançamento Primeiro' }).click();
    await page.getByRole('button', { name: 'Mudar o lançamento Segundo' }).click();
    const form = page.getByRole('form', { name: 'Mudar lançamento' });
    // Então
    await expect(form.getByLabel('Descrição')).toHaveValue('Segundo');
    await expect(form.getByLabel('Valor')).toHaveValue('99,00');
    // Quando
    await form.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect(form).toHaveCount(0);
    // Então
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(tabela).toContainText('Primeiro');
    await expect(tabela).toContainText('Segundo');
  });

  test('quando apaga o campo do mês e clica em "Novo lançamento", então nada quebra', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    // Quando
    await page.getByLabel('Mês', { exact: true }).first().fill('');
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    // Então
    await expect(page.getByRole('form', { name: 'Novo lançamento' }).getByLabel('Data')).toHaveValue('2026-03-01');
  });

  test('quando exclui o lançamento que está sendo mudado, então o formulário fecha', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Despesa (saída)', valor: '10,00', descricao: 'Papel', data: '2026-03-10' });
    await page.getByRole('button', { name: 'Mudar o lançamento Papel' }).click();
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
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const form = page.getByRole('form', { name: 'Novo lançamento' });
    // Quando
    await form.getByLabel('Valor').fill('15.00,00');
    await form.getByLabel('Descrição').fill('Erro');
    await form.getByRole('button', { name: 'Lançar' }).click();
    // Então
    await expect(form.getByText('Use um valor como 1.500,00.')).toBeVisible();
  });

  test('quando arquiva e reativa uma conta, então ela sai e volta; sem conta ativa, diz o que fazer', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Reativar a conta PJ' }).click();
    // Então
    await expect(page.getByRole('combobox', { name: 'Conta' })).toContainText('PJ');
  });

  test('quando muda o início da conta para depois de um lançamento, então recusa; o saldo inicial fica registrado', async ({ page }) => {
    // Dado
    await criarContas(page);
    await irParaMes(page, '2026-03');
    await lancar(page, { categoria: 'Outra entrada (entrada)', valor: '10,00', descricao: 'Algo', data: '2026-03-10' });
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
  await page.goto('/parcelas/');
  const secoes = page.getByRole('navigation', { name: 'Seções' });
  await expect(secoes.getByRole('button', { name: 'Financeiro' })).toHaveCount(0);
  await secoes.getByRole('link', { name: 'Financeiro', exact: true }).click();
  // Então
  const abas = page.getByRole('navigation', { name: 'Abas do financeiro' });
  for (const aba of ['Entradas', 'Saídas', 'Direitos', 'Obrigações']) await expect(abas.getByRole('link', { name: aba, exact: true })).toBeVisible();
});
