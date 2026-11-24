// Objetos do contrato sem demanda, com "Criar esta demanda agora" (#349). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, o contrato de MARIA APARECIDA EXEMPLO ("Ação de cobrança") está em negociação, e o da PADARIA PÃO
// QUENTE EXEMPLO LTDA ("Consultoria e assessoria jurídica") está assinado, sem nenhuma demanda.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

const GRUPO = 'Núcleo Teste';

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
    const formulario = page.getByRole('dialog', { name: 'Mudar a data da assinatura' });
    // Desde a #431, a janela de uma data só não tem a caixa de marcar: escrever a data basta
    await formulario.getByRole('textbox', { name: 'Data da assinatura' }).fill('10/03/2026');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Contrato atualizado.' })).toBeVisible();
    // A janela fecha quando a gravação termina (o X dela também se chama "Fechar")
    await expect(formulario).toHaveCount(0);
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

  test('dado alguém no contrato assinado só por um grupo, quando acrescenta um objeto e salva, então o aviso não oferece criar a demanda', async ({ page }) => {
    // Dado: o Mauro cria um grupo com o Bruno e o põe no contrato da PADARIA (sem a chave "equipe_edita_tudo")
    await page.goto('/equipe/');
    const secao = page.getByRole('region', { name: 'Grupos da equipe' });
    await secao.getByRole('button', { name: 'Novo grupo' }).click();
    await page.getByRole('dialog', { name: 'Nome do grupo novo' }).getByRole('textbox').fill(GRUPO);
    await page.getByRole('dialog', { name: 'Nome do grupo novo' }).getByRole('button', { name: 'Salvar' }).click();
    const painel = page.getByRole('dialog', { name: `Grupo ${GRUPO}` });
    await painel.getByRole('button', { name: 'Adicionar integrante' }).click();
    await painel.getByRole('button', { name: 'Bruno Exemplo Souza' }).click();
    await expect(painel.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })).toBeVisible();
    await painel.getByRole('button', { name: 'Fechar' }).click();
    let cartao = await abrirContrato(page, 'PADARIA PÃO QUENTE EXEMPLO LTDA');
    await cartao.getByRole('button', { name: 'Pôr participante ou grupo' }).click();
    await page.getByRole('dialog', { name: 'Pôr participante ou grupo' }).getByRole('button', { name: `Grupo ${GRUPO}, 1 pessoa` }).click();
    await expect(cartao.getByRole('button', { name: `Grupo ${GRUPO}, 1 pessoa. Ver quem está` })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    cartao = await abrirContrato(page, 'PADARIA PÃO QUENTE EXEMPLO LTDA');
    await expect(demandasDo(cartao).filter({ hasText: 'Consultoria e assessoria jurídica' })).toContainText('ainda sem demanda');
    await expect(cartao.getByRole('button', { name: /^Criar esta demanda agora/ })).toHaveCount(0);
    // Quando
    await cartao.getByRole('button', { name: 'Editar sem os valores' }).click();
    await page.getByRole('button', { name: 'Adicionar objeto' }).click();
    await page.getByRole('combobox', { name: 'Objeto 2' }).fill('Parecer trabalhista');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então: o objeto aparece pendente, sem o aviso que oferece criar a demanda (o banco recusaria)
    await expect(page.getByText('Contrato atualizado.')).toBeVisible();
    await expect(demandasDo(cartao).filter({ hasText: 'Parecer trabalhista' })).toContainText('ainda sem demanda');
    await expect(page.getByText('O objeto "Parecer trabalhista" ainda não tem demanda.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar a demanda' })).toHaveCount(0);
  });
});
