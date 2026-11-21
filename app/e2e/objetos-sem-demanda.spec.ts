// Objetos do contrato sem demanda, com "Criar esta demanda agora" (#349). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, o contrato de MARIA APARECIDA EXEMPLO ("Ação de cobrança") está em negociação, e o da PADARIA PÃO
// QUENTE EXEMPLO LTDA ("Consultoria e assessoria jurídica") está assinado, sem nenhuma demanda.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao } from './ajudantes';

async function abrirContrato(page: Page, cliente: string) {
  await page.goto('/inicio/');
  await abrir(page, 'Contratos');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: cliente }).click();
  const cartao = page.getByRole('dialog');
  await abrirSecao(cartao, 'Demandas');
  return cartao;
}
const demandasDo = (cartao: ReturnType<Page['getByRole']>) => cartao.getByRole('list', { name: 'Demandas do contrato' }).getByRole('listitem');

test.describe('Objetos sem demanda no cartão do contrato (#349)', () => {
  test('dado um contrato ainda em negociação, quando a pessoa cria a demanda de um objeto, então ela vira link e não se repete na assinatura', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page, 'MARIA APARECIDA EXEMPLO');
    const objeto = demandasDo(cartao).filter({ hasText: 'Ação de cobrança' });
    await expect(objeto).toContainText('ainda sem demanda');
    // Quando
    await objeto.getByRole('button', { name: 'Criar esta demanda agora: Ação de cobrança' }).click();
    // Então
    await expect(page.getByText('Demanda criada: Ação de cobrança.')).toBeVisible();
    await expect(demandasDo(cartao)).toHaveCount(1);
    await expect(demandasDo(cartao).getByRole('link', { name: /Ação de cobrança/ })).toBeVisible();
    await expect(cartao.getByText('ainda sem demanda')).toHaveCount(0);
    // Quando: o contrato vai para a coluna de assinados
    await cartao.getByLabel('Situação do contrato').selectOption({ label: 'ASSINADO / EM ANDAMENTO' });
    // Então: a demanda não se repete
    await expect(page.getByText(/foi para|Movido para/).first()).toBeVisible();
    await expect(demandasDo(cartao)).toHaveCount(1);
  });

  test('dado um contrato com data de assinatura fora da coluna de assinados, quando é aberto, então os objetos pendentes continuam à vista', async ({ page }) => {
    // Dado: a assinatura escrita no próprio cartão, sem mudar a coluna
    let cartao = await abrirContrato(page, 'MARIA APARECIDA EXEMPLO');
    await cartao.getByRole('button', { name: /^Data da assinatura: / }).click();
    const formulario = cartao.getByRole('group', { name: 'Mudar a data da assinatura' });
    await formulario.getByRole('textbox', { name: 'Data da assinatura' }).fill('10/03/2026');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Contrato atualizado.' })).toBeVisible();
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Quando
    cartao = await abrirContrato(page, 'MARIA APARECIDA EXEMPLO');
    // Então
    await expect(demandasDo(cartao).filter({ hasText: 'Ação de cobrança' })).toContainText('ainda sem demanda');
    await expect(cartao.getByRole('button', { name: 'Criar esta demanda agora: Ação de cobrança' })).toBeVisible();
  });

  test('dado um contrato assinado sem demanda, quando ganha um objeto e é salvo, então o SEMPER oferece criar a demanda dele', async ({ page }) => {
    // Dado: o objeto que já estava aparece pendente, mesmo na coluna de assinados
    const cartao = await abrirContrato(page, 'PADARIA PÃO QUENTE EXEMPLO LTDA');
    await expect(demandasDo(cartao).filter({ hasText: 'Consultoria e assessoria jurídica' })).toContainText('ainda sem demanda');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Adicionar objeto' }).click();
    await page.getByRole('combobox', { name: 'Objeto 2' }).fill('Parecer trabalhista');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByText('O objeto "Parecer trabalhista" ainda não tem demanda.')).toBeVisible();
    await page.getByRole('button', { name: 'Criar a demanda' }).click();
    await expect(demandasDo(cartao).getByRole('link', { name: /Parecer trabalhista/ })).toBeVisible();
    await expect(demandasDo(cartao).filter({ hasText: 'Consultoria e assessoria jurídica' })).toContainText('ainda sem demanda');
  });
});
