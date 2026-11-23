// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Excluir o contrato exclui junto o que está ligado a ele, depois de uma janela com o que sai e os valores (#284). Na semente do
// banco fictício, o contrato de JOSÉ DA SILVA TESTE tem as demandas "Registro de marca" e "Busca de anterioridade". Quem está logado
// é o Mauro (administrador), responsável pelo contrato. O banco fictício começa sem contas.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao } from './ajudantes';

const JOSE = 'JOSÉ DA SILVA TESTE';
const DEMANDA = 'Busca de anterioridade';
const dinheiro = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);

async function abrirTabela(page: Page, modulo: string) {
  await page.goto(`/${modulo}/`);
  await page.getByRole('button', { name: 'Tabela' }).click();
}

/** Uma ação do ⋯ do contrato (o cartão tem também o ⋯ de cada parcela, por isso o nome inteiro). */
async function acaoDoContrato(page: Page, cartao: Locator, acao: 'Arquivar' | 'Excluir') {
  await cartao.getByRole('button', { name: 'Mais ações do contrato' }).click();
  await page.getByRole('menu', { name: 'Mais ações do contrato' }).getByRole('menuitem', { name: acao, exact: true }).click();
}

async function abrirContrato(page: Page) {
  await page.goto('/inicio/');
  await abrir(page, 'Contratos');
  await page.getByRole('row').filter({ hasText: JOSE }).click();
  return page.getByRole('dialog');
}

test('dado um contrato arquivado com demandas, quando é excluído pelos arquivados, então a janela conta o que sai e as demandas somem junto', async ({ page }) => {
  // Dado
  await abrirTabela(page, 'contratos');
  const jose = page.getByRole('row').filter({ hasText: JOSE });
  await jose.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
  await expect(page.getByText('1 contrato arquivado, com as demandas e as tarefas.')).toBeVisible();
  await page.getByRole('button', { name: /^Arquivados/ }).click();
  await jose.getByRole('checkbox').check();
  // Quando
  await page.getByRole('group', { name: 'Ações nos arquivados selecionados' }).getByRole('button', { name: 'Excluir' }).click();
  // Então: a janela diz o que sai junto, sem dinheiro, e que é definitivo
  const janela = page.getByRole('dialog', { name: 'Excluir o contrato?' });
  await expect(janela.getByRole('list', { name: 'O que sai junto' })).toContainText('2 demandas');
  await expect(janela).toContainText('não pode ser desfeita');
  // Quando
  await janela.getByRole('button', { name: 'Excluir definitivamente' }).click();
  // Então
  await expect(page.getByText('1 contrato excluído definitivamente.')).toBeVisible();
  await expect(jose).toHaveCount(0);
  await abrirTabela(page, 'demandas');
  await page.getByRole('button', { name: /^Arquivados/ }).click();
  await expect(page.getByRole('row').filter({ hasText: DEMANDA })).toHaveCount(0);
});

test('dado um contrato com recebimento e repasse pago, quando o administrador pede para excluir, então só exclui depois de desfazer o pagamento', async ({ page }) => {
  // Dado a conta PJ (sem DAS), o contrato com tudo na conta da empresa e a parcela 1 recebida, com o repasse pago
  await page.goto('/financeiro/contas/');
  await abrirSecao(page, 'Contas');
  await page.getByRole('button', { name: 'Nova conta' }).filter({ hasText: 'Nova conta' }).click();
  const conta = page.getByRole('form', { name: 'Nova conta' });
  await conta.getByLabel('Nome da conta').fill('PJ');
  await conta.getByLabel('Saldo inicial').fill('0,00');
  await conta.getByLabel('Em que dia').fill('2020-01-01');
  await conta.getByRole('button', { name: 'Criar conta' }).click();
  await expect(conta).toHaveCount(0);
  let cartao = await abrirContrato(page);
  await cartao.getByRole('button', { name: 'Editar' }).click();
  await cartao.getByText('100% do que o cliente pagar').click();
  await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
  await abrirSecao(cartao, 'Honorários');
  await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
  await cartao.getByRole('button', { name: 'Receber a parcela 1' }).click();
  const receber = cartao.getByRole('form', { name: 'Receber a parcela 1' });
  await receber.getByLabel('Valor recebido').fill('1.000,00');
  await receber.getByRole('button', { name: 'Registrar recebimento' }).click();
  await expect(receber).toHaveCount(0);
  await page.goto('/parcelas/');
  await page.getByRole('button', { name: 'Pagar o repasse a Mauro Teixeira Duarte' }).click();
  await page.getByRole('form', { name: 'Pagar o repasse a Mauro Teixeira Duarte' }).getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(page.getByRole('table', { name: 'Repasses' })).toContainText('Pago');
  cartao = await abrirContrato(page);
  await acaoDoContrato(page, cartao, 'Arquivar');
  await expect(cartao.getByRole('button', { name: 'Desarquivar', exact: true })).toBeVisible();

  // Quando
  await acaoDoContrato(page, cartao, 'Excluir');
  // Então: não dá, e a janela diz qual pagamento desfazer
  const recusa = page.getByRole('dialog', { name: 'Não dá para excluir' });
  await expect(recusa).toContainText('Um administrador desfaz o pagamento no Financeiro antes de excluir.');
  await expect(recusa.getByRole('list', { name: 'Pagamentos já feitos' })).toContainText('Mauro Teixeira Duarte');
  await recusa.getByRole('button', { name: 'Fechar' }).click();
  await expect(cartao.getByRole('button', { name: 'Desarquivar', exact: true })).toBeVisible();

  // Quando o pagamento é desfeito
  await page.goto('/parcelas/');
  await page.getByRole('button', { name: 'Desfazer pagamento' }).click();
  await page.getByRole('button', { name: 'Confirmar: desfazer' }).click();
  await expect(page.getByRole('table', { name: 'Repasses' })).toContainText('A pagar');
  // E o contrato é excluído
  await abrirTabela(page, 'contratos');
  await page.getByRole('button', { name: /^Arquivados/ }).click();
  await page.getByRole('row').filter({ hasText: JOSE }).click();
  cartao = page.getByRole('dialog');
  await acaoDoContrato(page, cartao, 'Excluir');
  // Então a janela mostra o recebimento com os valores e o aviso do Caixa
  const janela = page.getByRole('dialog', { name: 'Excluir o contrato?' });
  const itens = janela.getByRole('list', { name: 'O que sai junto' });
  await expect(itens).toContainText('2 demandas');
  await expect(itens).toContainText('1 recebimento no Caixa');
  await expect(itens.getByText(dinheiro('1.000,00'))).toBeVisible();
  await expect(janela).toContainText('saem do Caixa, dos saldos e do lucro dos sócios');
  await janela.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText('Contrato excluído definitivamente, com o que estava ligado a ele.')).toBeVisible();
  // E o recebimento sai do Caixa
  await page.goto('/financeiro/contas/');
  await expect(page.getByRole('table', { name: 'Lançamentos do mês' })).toHaveCount(0);
});
