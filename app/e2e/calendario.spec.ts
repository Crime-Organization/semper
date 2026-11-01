// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Feriados e prazos. Na semente do banco fictício há três órgãos: INPI, TJMG (segue o recesso) e TRF6 (segue o recesso
// e os feriados da Justiça Federal). Nenhum dia lançado. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ajudantes';

/** Preenche a calculadora: órgão, data da intimação, dias e contagem. */
async function calcular(page: Page, orgao: string, intimacao: string, dias: number, contagem: 'Dias corridos' | 'Dias úteis') {
  await page.getByLabel('Órgão', { exact: true }).selectOption({ label: orgao });
  await page.getByLabel('Intimação').fill(intimacao);
  await page.getByLabel('Dias', { exact: true }).fill(String(dias));
  await page.getByRole('group', { name: 'Contagem', exact: true }).getByText(contagem, { exact: true }).click();
}
const ultimoDia = (page: Page) => page.getByRole('status', { name: 'Resultado do prazo' }).getByText('Último dia:');

test.describe('Feriados e prazos', () => {
  test('quando a pessoa abre "Feriados e prazos", então já vê os feriados nacionais e o recesso do ano', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await abrir(page, 'Feriados e prazos');
    // Então
    const ano = new Date().getFullYear();
    await expect(page.getByRole('heading', { name: 'Feriados e prazos', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: `Calendário de ${ano}` })).toBeVisible();
    const janeiro = page.getByRole('region', { name: `janeiro de ${ano}` });
    await expect(janeiro.getByText('Confraternização Universal')).toBeVisible();
    await expect(janeiro.getByText('Recesso forense: TJMG, TRF6').first()).toBeVisible();
  });

  test('quando o administrador lança um feriado municipal para o TJMG, então o prazo do TJMG pula esse dia, e o do TRF6 não', async ({ page }) => {
    // Dado
    await page.goto('/calendario/');
    await page.getByLabel('Ano').selectOption('2026');
    // Quando
    await page.getByRole('button', { name: 'Lançar dias' }).click();
    const form = page.getByRole('form', { name: 'Lançar dias sem expediente' });
    await form.getByLabel('Motivo').fill('Aniversário da cidade');
    await form.getByLabel('Primeiro dia').fill('2026-07-03');
    await form.getByRole('group', { name: 'Vale para' }).getByText('TJMG', { exact: true }).click();
    await form.getByRole('button', { name: 'Lançar' }).click();
    // Então: aparece em julho, só para o TJMG
    await expect(page.getByText('Dias lançados no calendário.')).toBeVisible();
    const julho = page.getByRole('region', { name: 'julho de 2026' });
    await expect(julho.getByText('Aniversário da cidade')).toBeVisible();
    await expect(julho.getByText('Lançado pelo escritório: TJMG')).toBeVisible();
    // Então: intimação em 30/06/2026, 5 dias úteis
    await calcular(page, 'TJMG (Tribunal de Justiça de Minas Gerais)', '2026-06-30', 5, 'Dias úteis');
    await expect(ultimoDia(page)).toContainText('quarta-feira, 08/07/2026');
    await expect(page.getByRole('list', { name: 'Dias que ficaram de fora' })).toContainText('03/07/2026 Aniversário da cidade');
    await calcular(page, 'TRF6 (Tribunal Regional Federal da 6ª Região)', '2026-06-30', 5, 'Dias úteis');
    await expect(ultimoDia(page)).toContainText('terça-feira, 07/07/2026');
  });

  test('quando o prazo atravessa o recesso, então o TJMG espera o fim dele, e o INPI, que não segue o recesso, não', async ({ page }) => {
    // Dado
    await page.goto('/calendario/');
    // Quando: intimação em 17/12/2026, 10 dias corridos
    await calcular(page, 'TJMG (Tribunal de Justiça de Minas Gerais)', '2026-12-17', 10, 'Dias corridos');
    // Então
    await expect(ultimoDia(page)).toContainText('quinta-feira, 28/01/2027');
    await expect(page.getByRole('list', { name: 'Dias que ficaram de fora' })).toContainText('20/12/2026 a 06/01/2027 Recesso forense');
    await calcular(page, 'INPI (Instituto Nacional da Propriedade Industrial)', '2026-12-17', 10, 'Dias corridos');
    await expect(ultimoDia(page)).toContainText('segunda-feira, 28/12/2026');
  });

  test('quando o administrador exclui um dia lançado, então ele sai do calendário', async ({ page }) => {
    // Dado
    await page.goto('/calendario/');
    await page.getByLabel('Ano').selectOption('2026');
    await page.getByRole('button', { name: 'Lançar dias' }).click();
    const form = page.getByRole('form', { name: 'Lançar dias sem expediente' });
    await form.getByLabel('Motivo').fill('Portaria 12/2026');
    await form.getByRole('group', { name: 'O que acontece nesses dias' }).getByText('Suspensão', { exact: true }).click();
    await form.getByLabel('Primeiro dia').fill('2026-03-23');
    await form.getByLabel('Último dia').fill('2026-03-25');
    await form.getByRole('group', { name: 'Vale para' }).getByText('Todos os órgãos', { exact: true }).click();
    await form.getByRole('button', { name: 'Lançar' }).click();
    const marco = page.getByRole('region', { name: 'março de 2026' });
    await expect(marco.getByText('23/03 a 25/03')).toBeVisible();
    // Quando
    const portaria = marco.getByRole('listitem').filter({ hasText: 'Portaria 12/2026' });
    await portaria.getByRole('button', { name: 'Excluir' }).click();
    await portaria.getByRole('button', { name: 'Confirmar exclusão' }).click();
    // Então
    await expect(page.getByText('Dias excluídos do calendário.')).toBeVisible();
    await expect(page.getByText('Portaria 12/2026')).toHaveCount(0);
  });

  test('quando o administrador cadastra um tribunal, então ele já vem seguindo o recesso, e a contagem padrão vai para a calculadora', async ({ page }) => {
    // Dado
    await page.goto('/calendario/');
    const cadastro = page.getByRole('form', { name: 'Cadastrar órgão' });
    // Quando
    await cadastro.getByLabel('Sigla').fill('trt3');
    await cadastro.getByRole('button', { name: 'Cadastrar órgão' }).click();
    // Então
    await expect(page.getByText('TRT3 cadastrado. Confira o que ele segue na tabela.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'TRT3: Recesso forense' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'TRT3: Feriados da Justiça Federal' })).not.toBeChecked();
    // Quando: a contagem padrão do TRT3 passa a ser em dias úteis
    await page.getByLabel('Contagem padrão de TRT3').selectOption({ label: 'Dias úteis' });
    await page.reload();
    await expect(page.getByLabel('Contagem padrão de TRT3')).toHaveValue('uteis');
    await page.getByLabel('Órgão', { exact: true }).selectOption({ label: 'TRT3' });
    // Então
    await expect(page.getByRole('group', { name: 'Contagem', exact: true }).getByRole('radio', { name: 'Dias úteis' })).toBeChecked();
  });
});
