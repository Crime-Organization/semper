// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "+" no título das seções cujo "Novo…" abre um formulário ou um menu ali mesmo (#390): Prazos, Andamentos, Checklists, Honorários,
// Vínculos, Contas, Sócios e "Ligada a". Ele abre a seção, se estiver fechada, sem mudar a escolha guardada, e abre o mesmo que o
// botão com o nome, que continua embaixo. No cartão arquivado, não aparece.
// A semente do banco fictício: o processo judicial de JOSÉ DA SILVA TESTE. Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao, acaoNoMenuDoCartao } from './ajudantes';

/** O título da seção, com o número ao lado (ex.: "Prazos 1"). */
const tituloDaSecao = (lugar: Page | Locator, titulo: string) => lugar.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });
/** O "+" do título da seção, que tem o mesmo nome do botão de dentro. */
const maisDoTitulo = (lugar: Page | Locator, titulo: string, nome: string) =>
  lugar.getByRole('heading', { name: new RegExp(`^${titulo}`) }).getByRole('button', { name: nome, exact: true });

async function abrirProcesso(page: Page) {
  await page.goto('/processos/judicial/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
  return cartao;
}

test.describe('Prazos e andamentos do processo', () => {
  test('dada a seção Prazos fechada, quando clica no "+" do título, então ela abre com o formulário do novo prazo; ao reabrir o cartão, volta fechada', async ({ page }) => {
    // Dado
    let cartao = await abrirProcesso(page);
    await expect(tituloDaSecao(cartao, 'Prazos')).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await maisDoTitulo(cartao, 'Prazos', 'Novo prazo').click();
    // Então
    await expect(tituloDaSecao(cartao, 'Prazos')).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('form', { name: 'Novo prazo' })).toBeVisible();
    await expect(cartao.getByRole('form', { name: 'Novo prazo' }).getByLabel('Que prazo é este')).toBeFocused();
    // Quando: fecha e reabre o cartão
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    await expect(cartao).toHaveCount(0);
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
    cartao = page.getByRole('dialog');
    // Então: o "+" não gravou a seção como aberta
    await expect(tituloDaSecao(cartao, 'Prazos')).toHaveAttribute('aria-expanded', 'false');
  });

  test('dada a seção Andamentos, quando clica no "+" do título, então abre o mesmo formulário do "Novo andamento" de dentro', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await maisDoTitulo(cartao, 'Andamentos', 'Novo andamento').click();
    // Então
    await expect(cartao.getByRole('form', { name: 'Novo andamento' })).toBeVisible();
  });

  test('dado o processo arquivado, quando o cartão abre, então os títulos de Prazos e Andamentos não têm "+"', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await expect(maisDoTitulo(cartao, 'Prazos', 'Novo prazo')).toBeVisible();
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(page.getByText('Processo arquivado.', { exact: false }).first()).toBeVisible();
    // Então
    await expect(maisDoTitulo(cartao, 'Prazos', 'Novo prazo')).toHaveCount(0);
    await expect(maisDoTitulo(cartao, 'Andamentos', 'Novo andamento')).toHaveCount(0);
  });
});

test.describe('Contas e sócios do financeiro', () => {
  test('quando clica no "+" do título de Contas e no de Sócios, então abrem os formulários de nova conta e de novo sócio', async ({ page }) => {
    // Dado
    await page.goto('/financeiro/contas/');
    await expect(tituloDaSecao(page, 'Contas')).toBeVisible();
    // Quando
    await maisDoTitulo(page, 'Contas', 'Nova conta').click();
    await maisDoTitulo(page, 'Sócios', 'Novo sócio').click();
    // Então
    await expect(page.getByRole('form', { name: 'Nova conta' })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Novo sócio' })).toBeVisible();
    // E o botão com o nome continua embaixo, nas seções abertas sem o formulário
    await page.getByRole('form', { name: 'Nova conta' }).getByRole('button', { name: 'Cancelar' }).click();
    await abrirSecao(page, 'Contas');
    await expect(page.getByRole('button', { name: 'Nova conta' }).filter({ hasText: 'Nova conta' })).toBeVisible();
  });
});

test.describe('Checklists e honorários', () => {
  test('dado o cartão da demanda, quando clica no "+" do título de Checklists, então abre o menu de "Adicionar checklist"', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).click();
    const cartao = page.getByRole('dialog');
    // Quando
    await maisDoTitulo(cartao, 'Checklists', 'Adicionar checklist').click();
    // Então
    const menu = page.getByRole('menu', { name: 'Adicionar checklist' });
    await expect(menu.getByRole('menuitem', { name: 'Checklist em branco' })).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Checklists')).toHaveAttribute('aria-expanded', 'true');
  });

  test('dado o cartão do contrato, quando clica no "+" do título de Honorários, então abre o formulário da nova parcela, e não o histórico das parcelas', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Contratos');
    await page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' }).click();
    const cartao = page.getByRole('dialog');
    // Quando
    await maisDoTitulo(cartao, 'Honorários', 'Nova parcela').click();
    // Então
    await expect(cartao.getByRole('form', { name: 'Nova parcela' })).toBeVisible();
    // E o foco vai ao primeiro campo, mesmo com as parcelas lidas só depois do clique
    await expect(cartao.getByRole('form', { name: 'Nova parcela' }).getByLabel('Vencimento')).toBeFocused();
    await expect(tituloDaSecao(cartao, 'Histórico das parcelas')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Vínculos da pessoa e "Ligada a" da anotação', () => {
  test('dado o cartão de uma pessoa, quando clica no "+" do título de Vínculos, então abre o formulário da nova pessoa vinculada, com o foco no vínculo', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' }).first().click();
    const cartao = page.getByRole('dialog');
    // Quando
    await maisDoTitulo(cartao, 'Vínculos', 'Nova pessoa vinculada').click();
    // Então
    const formulario = cartao.getByRole('form', { name: 'Nova pessoa vinculada' });
    await expect(formulario).toBeVisible();
    await expect(formulario.getByLabel('Vínculo')).toBeFocused();
  });

  test('dada uma anotação gravada, quando clica no "+" do título de "Ligada a", então abre o menu do "Novo…" de dentro, e o Esc o fecha', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    const campo = page.getByRole('article', { name: 'Anotação nova' }).getByRole('textbox', { name: 'Título' });
    await campo.fill('Reunião com o cliente');
    await campo.press('Enter');
    const anotacao = page.getByRole('dialog', { name: 'Anotação', exact: true });
    await expect(anotacao.getByRole('article', { name: /^Anotação (?!nova$)\w+$/ })).toBeVisible();
    const mais = maisDoTitulo(anotacao, 'Ligada a', 'Novo item ligado a esta anotação');
    // Quando
    await mais.click();
    // Então
    const menu = page.getByRole('menu', { name: 'Novo item ligado a esta anotação' });
    await expect(menu.getByRole('menuitem', { name: 'Pessoa' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(mais).toBeFocused();
  });
});
