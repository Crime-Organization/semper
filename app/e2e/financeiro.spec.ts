// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O caixa do escritório. Quem está logado é o Mateus (administrador). O banco fictício começa sem contas.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

/** Cria as contas PJ (recolhe DAS, com saldo) e PF, a partir de janeiro. */
async function criarContas(page: Page) {
  await page.goto('/financeiro/');
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
const irParaMes = (page: Page, mes: string) => page.getByLabel('Mês', { exact: true }).first().fill(mes);

test.describe('Caixa', () => {
  test('quando não há contas, então pede para criar; ao criar, o menu leva ao caixa da conta', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Caixa' }).click();
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
    await expect(form.getByLabel('Descrição')).toHaveValue('Repasse da PJ para a PF');
    await form.getByLabel('Data').fill('2026-03-15');
    await form.getByLabel('Valor').fill('300,00');
    await form.getByRole('button', { name: 'Lançar repasse' }).click();
    await expect(form).toHaveCount(0);
    // Então: na PJ
    const tabela = page.getByRole('table', { name: 'Lançamentos do mês' });
    const linha = tabela.getByRole('row').filter({ hasText: 'Repasse da PJ para a PF' });
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
