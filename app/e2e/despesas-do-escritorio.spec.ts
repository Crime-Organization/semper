// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As despesas do escritório a pagar (#439), na aba Obrigações do Financeiro. Quem está logado é o Mauro (administrador); o Bruno é
// estagiário e não é administrador. O banco fictício começa sem despesas.
import { expect, test, type Page } from '@playwright/test';
import { enderecoDaDespesa } from '../../supabase/functions/_compartilhado/enderecoDaDespesa';
import { entrarComo } from './ajudantes';

/** O dia dos testes: o Financeiro abre no mês de hoje (novembro de 2026). */
const DIA_DOS_TESTES = new Date('2026-11-22T12:00:00-03:00');
const despesas = (page: Page) => page.getByRole('region', { name: 'Despesas do escritório' });
const mes = (page: Page, nome: string) => page.getByRole('group', { name: 'Mês' }).getByRole('button', { name: nome, exact: true });

test.describe('Despesas do escritório a pagar', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(DIA_DOS_TESTES); });

  test('dado um administrador, quando cadastra uma despesa de todo mês e a marca como paga, então a próxima continua a pagar', async ({ page }) => {
    // Dado
    await page.goto('/financeiro/obrigacoes/');
    await despesas(page).getByRole('button', { name: 'Nova despesa' }).click();
    const form = page.getByRole('form', { name: 'Nova despesa' });
    await form.getByLabel('Descrição').fill('Salário da recepção');
    await form.getByLabel('Valor').fill('2.500,00');
    await form.getByLabel('Vencimento').fill('2026-11-30');
    await form.getByLabel('Vencimento').press('Tab');
    await form.getByLabel('Repetir', { exact: true }).selectOption({ label: 'Todo mês' });
    await form.getByRole('group', { name: 'Termina' }).getByText('Depois de algumas vezes', { exact: true }).click();
    await form.getByLabel('Quantas vezes').fill('3');
    await form.getByRole('button', { name: 'Cadastrar despesa' }).click();
    await expect(page.getByText('Despesa cadastrada, com mais 2 datas da repetição.')).toBeVisible();
    const tabela = despesas(page).getByRole('table', { name: 'Despesas do escritório' });
    const linha = tabela.getByRole('row', { name: /Salário da recepção/ });
    await expect(linha).toContainText('30/11/2026');
    await expect(linha).toContainText('A pagar');
    await expect(linha).toContainText('Todo mês, 3 vezes');
    // O total, na célula inteira: "R$ 2.500,00" também contém "0,00".
    const total = tabela.getByRole('row', { name: /Total a pagar/ }).getByRole('cell').first();
    await expect(total).toHaveText(/^R\$\s2\.500,00$/);
    // Quando
    await linha.getByRole('button', { name: 'Marcar como paga: Salário da recepção, vence em 30/11/2026' }).click();
    await page.getByRole('form', { name: /Marcar como paga/ }).getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(linha).toContainText('Paga em 22/11/2026');
    await expect(total).toHaveText(/^R\$\s0,00$/);
    await mes(page, 'Dez').click();
    const proxima = despesas(page).getByRole('row', { name: /Salário da recepção/ });
    await expect(proxima).toContainText('30/12/2026');
    await expect(proxima).toContainText('A pagar');
  });

  test('dada uma despesa, quando a abre e a exclui, então ela sai da lista, e o desfazer a devolve', async ({ page }) => {
    // Dado
    await page.goto('/financeiro/obrigacoes/');
    await despesas(page).getByRole('button', { name: 'Nova despesa' }).click();
    const form = page.getByRole('form', { name: 'Nova despesa' });
    await form.getByLabel('Descrição').fill('Conta de luz');
    await form.getByLabel('Valor').fill('250,00');
    await form.getByLabel('Vencimento').fill('2026-11-27');
    await form.getByRole('button', { name: 'Cadastrar despesa' }).click();
    // Quando
    await despesas(page).getByRole('button', { name: 'Abrir a despesa: Conta de luz, vence em 27/11/2026' }).click();
    const janela = page.getByRole('dialog', { name: 'Despesa' });
    await janela.getByRole('button', { name: 'Excluir', exact: true }).click();
    await janela.getByRole('button', { name: 'Confirmar: excluir' }).click();
    // Então
    await expect(despesas(page).getByText('Nenhuma despesa neste mês.')).toBeVisible();
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).last().click();
    await expect(despesas(page).getByRole('row', { name: /Conta de luz/ })).toBeVisible();
  });

  test('dado o endereço de uma despesa (o link da agenda), quando o abre, então vai ao mês do vencimento com a despesa aberta, uma vez só', async ({ page }) => {
    // Dado
    await page.goto('/financeiro/obrigacoes/');
    await despesas(page).getByRole('button', { name: 'Nova despesa' }).click();
    const form = page.getByRole('form', { name: 'Nova despesa' });
    await form.getByLabel('Descrição').fill('Conta de água');
    await form.getByLabel('Valor').fill('80,00');
    await form.getByLabel('Vencimento').fill('2026-12-10');
    await form.getByRole('button', { name: 'Cadastrar despesa' }).click();
    await expect(page.getByText('Despesa cadastrada.')).toBeVisible();
    // O id da despesa, guardado pelo banco fictício.
    const id = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('semper-dados-falsos') ?? '{}') as { despesas?: { id: string; descricao: string }[] })
      .despesas?.find(d => d.descricao === 'Conta de água')?.id ?? '');
    expect(id).not.toBe('');
    // Quando
    await page.goto(enderecoDaDespesa({ id, vencimento: '2026-12-10' }));
    // Então
    const janela = page.getByRole('dialog', { name: 'Despesa' });
    await expect(janela.getByText('Conta de água · vence em 10/12/2026')).toBeVisible();
    await expect(despesas(page).getByRole('row', { name: /Conta de água/ })).toContainText('10/12/2026');
    await expect(page).not.toHaveURL(/despesa=/);
    // E quando fecha e volta ao mesmo mês, então ela não abre de novo
    await janela.getByRole('button', { name: 'Fechar' }).click();
    await expect(janela).toHaveCount(0);
    await mes(page, 'Nov').click();
    await mes(page, 'Dez').click();
    await expect(despesas(page).getByRole('row', { name: /Conta de água/ })).toBeVisible();
    await expect(janela).toHaveCount(0);
  });

  test('dado alguém que não é administrador, quando abre as Obrigações, então não vê as despesas do escritório', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/financeiro/obrigacoes/');
    // Então
    await expect(page.getByRole('region', { name: 'Obrigações' })).toBeVisible();
    await expect(despesas(page)).toHaveCount(0);
  });
});
