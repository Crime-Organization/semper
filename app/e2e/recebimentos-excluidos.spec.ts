// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A seção "Recebimentos excluídos" de "Contas, DAS e sócios" (#413): o que saiu do Caixa com os contratos excluídos (#284), só para
// administradores e só leitura. Na semente do banco fictício, quem está logado é o Mauro (administrador), responsável pelo contrato
// de JOSÉ DA SILVA TESTE; o Bruno é da equipe, sem ser administrador. O banco fictício começa sem contas.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

const JOSE = 'JOSÉ DA SILVA TESTE';
const SECAO = 'Recebimentos excluídos';
const dinheiro = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);

/** Uma ação do ⋯ do contrato (o cartão tem também o ⋯ de cada parcela, por isso o nome inteiro). */
async function acaoDoContrato(page: Page, cartao: Locator, acao: 'Arquivar' | 'Excluir') {
  await cartao.getByRole('button', { name: 'Mais ações do contrato' }).click();
  await page.getByRole('menu', { name: 'Mais ações do contrato' }).getByRole('menuitem', { name: acao, exact: true }).click();
}

/** A conta PJ, o contrato do José com a parcela 1 recebida (R$ 1.000,00), e o contrato excluído pelo administrador. */
async function excluirContratoComRecebimento(page: Page) {
  await page.goto('/financeiro/contas/');
  await abrirSecao(page, 'Contas');
  await page.getByRole('button', { name: 'Nova conta' }).filter({ hasText: 'Nova conta' }).click();
  const conta = page.getByRole('form', { name: 'Nova conta' });
  await conta.getByLabel('Nome da conta').fill('PJ');
  await conta.getByLabel('Saldo inicial').fill('0,00');
  await conta.getByLabel('Em que dia').fill('2020-01-01');
  await conta.getByRole('button', { name: 'Criar conta' }).click();
  await expect(conta).toHaveCount(0);
  await page.goto('/inicio/');
  await abrir(page, 'Contratos');
  await page.getByRole('row').filter({ hasText: JOSE }).click();
  const cartao = page.getByRole('dialog');
  await abrirSecao(cartao, 'Honorários');
  await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
  await cartao.getByRole('button', { name: 'Receber a parcela 1' }).click();
  const receber = cartao.getByRole('form', { name: 'Receber a parcela 1' });
  await receber.getByLabel('Valor recebido').fill('1.000,00');
  await receber.getByRole('button', { name: 'Registrar recebimento' }).click();
  await expect(receber).toHaveCount(0);
  await acaoDoContrato(page, cartao, 'Arquivar');
  await expect(cartao.getByRole('button', { name: 'Desarquivar', exact: true })).toBeVisible();
  await acaoDoContrato(page, cartao, 'Excluir');
  await page.getByRole('dialog', { name: 'Excluir o contrato?' }).getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText('Contrato excluído definitivamente, com o que estava ligado a ele.')).toBeVisible();
}

test('dado um contrato com recebimento excluído, quando o administrador abre "Recebimentos excluídos", então vê o recebimento, sem botão para mudar ou apagar', async ({ page }) => {
  // Dado
  await excluirContratoComRecebimento(page);
  // Quando
  await page.goto('/financeiro/contas/');
  await abrirSecao(page, SECAO);
  // Então: o contrato, a parcela, a conta, o valor e quem excluiu
  const lista = page.getByRole('list', { name: SECAO });
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  await expect(lista).toContainText('Parcela 1 · PJ');
  await expect(lista).toContainText(/Contrato \S+/);
  await expect(lista.getByText(dinheiro('1.000,00'))).toBeVisible();
  await expect(lista).toContainText('Excluído por Mauro Teixeira Duarte');
  await expect(lista.getByRole('button')).toHaveCount(0);
  // E o título conta quantos são, mesmo com a seção fechada
  await page.getByRole('button', { name: `${SECAO} 1` }).click();
  await expect(page.getByRole('button', { name: `${SECAO} 1` })).toHaveAttribute('aria-expanded', 'false');
});

test('dado quem não é administrador, quando procura a página das contas, então não vê os recebimentos excluídos', async ({ page }) => {
  // Dado
  await page.goto('/inicio/');
  await entrarComo(page, 'u-bruno');
  // Quando
  await page.goto('/financeiro/contas/');
  // Então
  await expect(page).toHaveURL(/\/inicio\/$/);
  await expect(page.getByRole('button', { name: new RegExp(`^${SECAO}`) })).toHaveCount(0);
});
