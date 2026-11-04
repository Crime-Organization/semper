// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As parcelas do contrato, o recebimento e os repasses. Quem está logado é o Mateus (administrador), responsável pelo contrato de
// JOSÉ DA SILVA TESTE, já assinado, de R$ 3.000,00 em 5 parcelas, com 30% para a conta da empresa. O banco fictício começa sem contas.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirNoFinanceiro, abrirSecao } from './ajudantes';

const dinheiro = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);

/** Cria a conta PJ, que recolhe DAS, e o DAS de 4,5%, valendo há muito tempo. */
async function prepararCaixa(page: Page) {
  await page.goto('/financeiro/');
  await abrirSecao(page, 'Contas');
  await page.getByRole('button', { name: 'Nova conta' }).click();
  const conta = page.getByRole('form', { name: 'Nova conta' });
  await conta.getByLabel('Nome da conta').fill('PJ');
  await conta.getByLabel('Saldo inicial').fill('0,00');
  await conta.getByLabel('Em que dia').fill('2020-01-01');
  await conta.getByText('Esta conta recolhe DAS').click();
  await conta.getByRole('button', { name: 'Criar conta' }).click();
  await expect(conta).toHaveCount(0);
  await abrirSecao(page, 'DAS de cada mês');
  const das = page.getByRole('form', { name: 'Lançar o DAS' });
  await das.getByLabel('Mês').fill('2020-01');
  await das.getByLabel('Percentual do DAS').fill('4,5');
  await das.getByRole('button', { name: 'Salvar DAS' }).click();
  await expect(page.getByRole('list', { name: 'DAS lançados' })).toContainText('01/2020');
}

/** Abre o contrato pelo nome do cliente. */
async function abrirContrato(page: Page, cliente: string) {
  await page.goto('/inicio/');
  await abrir(page, 'Contratos');
  await page.getByRole('row').filter({ hasText: cliente }).click();
  return page.getByRole('dialog');
}

/** Abre o contrato de JOSÉ, manda tudo para a conta da empresa e gera as parcelas. */
async function contratoComParcelas(page: Page) {
  const cartao = await abrirContrato(page, 'JOSÉ DA SILVA TESTE');
  await cartao.getByRole('button', { name: 'Editar' }).click();
  await cartao.getByText('100% do que o cliente pagar').click();
  await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
  await abrirSecao(cartao, 'Parcelas');
  await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
  await expect(cartao.getByRole('button', { name: 'Receber a parcela 5' })).toBeVisible();
  return cartao;
}

async function receberPrimeira(cartao: ReturnType<Page['getByRole']>) {
  await cartao.getByRole('button', { name: 'Receber a parcela 1' }).click();
  const form = cartao.getByRole('form', { name: 'Receber a parcela 1' });
  await form.getByLabel('Valor recebido').fill('1.000,00');
  await form.getByLabel('Taxa da máquina').fill('30,00');
  return form;
}

test.describe('Parcelas do contrato', () => {
  test('dado uma parcela paga antes do caixa, quando abre o contrato, então aparece como recebida, e dá para corrigir, sem receber nem estornar', async ({ page }) => {
    // Dado
    await contratoComParcelas(page);
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      Object.assign(bd.parcelas.find((p: { numero: number }) => p.numero === 1), { recebida_em: '2025-03-12', recebido: 55000 });
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    await page.reload();
    // Quando
    const cartao = await abrirContrato(page, 'JOSÉ DA SILVA TESTE');
    await abrirSecao(cartao, 'Parcelas');
    // Então
    const linha = cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row').nth(1);
    await expect(linha).toContainText('Recebida');
    await expect(linha).toContainText('12/03/2025');
    await expect(linha).toContainText(dinheiro('550,00'));
    await expect(linha).toContainText('Histórico importado');
    await expect(linha.getByRole('button', { name: 'Corrigir a parcela 1' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Receber a parcela 1' })).toHaveCount(0);
    await expect(linha.getByRole('button', { name: 'Estornar' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Receber a parcela 2' })).toBeVisible();
    // E o caixa não mudou
    await page.goto('/financeiro/');
    await expect(page.getByText('55,00').or(page.getByText('550,00'))).toHaveCount(0);
  });

  test('dado uma parcela paga antes do caixa, quando o responsável corrige, então muda, fica no histórico e o caixa não muda', async ({ page }) => {
    // Dado
    await contratoComParcelas(page);
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
      Object.assign(bd.parcelas.find((p: { numero: number }) => p.numero === 1), { recebida_em: '2025-03-12', recebido: 55000 });
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    await page.reload();
    const cartao = await abrirContrato(page, 'JOSÉ DA SILVA TESTE');
    await abrirSecao(cartao, 'Parcelas');
    const linha = cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row').nth(1);
    // Quando
    await linha.getByRole('button', { name: 'Corrigir a parcela 1' }).click();
    const form = cartao.getByRole('form', { name: 'Corrigir a parcela 1' });
    await expect(form.getByLabel('Valor recebido')).toHaveValue('550,00');
    await form.getByLabel('Recebida em').fill(`${new Date().getFullYear() + 1}-01-01`);
    await form.getByRole('button', { name: 'Salvar correção' }).click();
    await expect(form.getByText('A data do recebimento não pode estar no futuro.')).toBeVisible();
    await form.getByLabel('Recebida em').fill('2025-03-20');
    await form.getByLabel('Valor recebido').fill('575,50');
    await form.getByRole('button', { name: 'Salvar correção' }).click();
    // Então
    await expect(linha).toContainText('20/03/2025');
    await expect(linha).toContainText(dinheiro('575,50'));
    await abrirSecao(cartao, 'Histórico das parcelas');
    await expect(cartao.getByText('Parcela 1: valor recebido')).toBeVisible();
    // E o caixa não mudou
    await page.goto('/financeiro/');
    await expect(page.getByText('575,50')).toHaveCount(0);
  });

  test('quando gera as parcelas, então somam o valor do contrato, com a entrada primeiro', async ({ page }) => {
    // Quando
    const cartao = await contratoComParcelas(page);
    // Então
    const linhas = cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row');
    await expect(linhas).toHaveCount(6);
    await expect(linhas.nth(1)).toContainText(dinheiro('600,00'));
    await expect(cartao.getByRole('button', { name: 'Gerar parcelas' })).toHaveCount(0);
    await abrirSecao(cartao, 'Histórico das parcelas');
    await expect(cartao.getByText('5 geradas', { exact: false })).toBeVisible();
    // E o histórico do contrato, aberto a todo o escritório, não fala de dinheiro
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText('5 geradas', { exact: false })).toHaveCount(1);
  });

  test('dado um desconto no contrato, quando gera as parcelas, então ele sai do valor antes de dividir', async ({ page }) => {
    // Dado: R$ 3.000,00, entrada de R$ 600,00, 5 parcelas e R$ 400,00 de desconto
    const cartao = await abrirContrato(page, 'JOSÉ DA SILVA TESTE');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByLabel('Descontos').fill('400,00');
    await cartao.getByText('100% do que o cliente pagar').click();
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Quando
    await abrirSecao(cartao, 'Parcelas');
    await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
    // Então: a entrada fica como foi combinada, e as outras dividem os R$ 2.000,00 que sobram
    const linhas = cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row');
    await expect(linhas).toHaveCount(6);
    await expect(linhas.nth(1)).toContainText(dinheiro('600,00'));
    await expect(linhas.nth(5)).toContainText(dinheiro('500,00'));
    await expect(cartao.getByText('As parcelas somam', { exact: false })).toHaveCount(0);
  });

  test('quando muda a situação para assinado com a seção aberta, então as parcelas aparecem na hora', async ({ page }) => {
    // Dado: o contrato de JOÃO PEDRO ainda não foi assinado
    const cartao = await abrirContrato(page, 'JOÃO PEDRO FICTÍCIO');
    await abrirSecao(cartao, 'Parcelas');
    await expect(cartao.getByText('Elas nascem quando o contrato chega à coluna de assinado.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Gerar parcelas' })).toHaveCount(0);
    // Quando
    await cartao.getByLabel('Situação do contrato').selectOption({ label: 'Assinado / em andamento' });
    // Então
    await expect(cartao.getByRole('button', { name: 'Receber a parcela 5' })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Gerar parcelas' })).toHaveCount(0);
    await abrirSecao(cartao, 'Histórico das parcelas');
    await expect(cartao.getByText('5 geradas', { exact: false })).toBeVisible();
  });

  test('quando o contrato é de êxito, então não gera sozinho: lança à mão, muda e exclui, com desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page, 'MARIA APARECIDA EXEMPLO');
    await abrirSecao(cartao, 'Parcelas');
    await expect(cartao.getByText('Este contrato não gera parcelas sozinho', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Gerar parcelas' })).toHaveCount(0);
    // Quando: lança
    await cartao.getByRole('button', { name: 'Nova parcela' }).click();
    const nova = cartao.getByRole('form', { name: 'Nova parcela' });
    await nova.getByRole('button', { name: 'Salvar parcela' }).click();
    await expect(nova.getByText('Informe o valor.')).toBeVisible();
    await nova.getByLabel('Vencimento').fill('2030-05-01');
    await nova.getByLabel('Valor').fill('500,00');
    await nova.getByRole('button', { name: 'Salvar parcela' }).click();
    // Então
    const tabela = cartao.getByRole('table', { name: 'Parcelas' });
    await expect(tabela).toContainText('01/05/2030');
    await expect(tabela).toContainText('A receber');
    // Quando: muda
    await cartao.getByRole('button', { name: 'Mudar a parcela 1' }).click();
    const mudar = cartao.getByRole('form', { name: 'Mudar a parcela 1' });
    await expect(mudar.getByLabel('Valor')).toHaveValue('500,00');
    await mudar.getByLabel('Valor').fill('750,00');
    await mudar.getByRole('button', { name: 'Salvar parcela' }).click();
    await expect(tabela).toContainText(dinheiro('750,00'));
    // Quando: exclui
    await cartao.getByRole('button', { name: 'Excluir' }).click();
    await cartao.getByRole('button', { name: 'Confirmar: excluir' }).click();
    await expect(tabela).toHaveCount(0);
    // Quando: desfaz
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    await expect(cartao.getByRole('table', { name: 'Parcelas' })).toContainText(dinheiro('750,00'));
  });

  test('quando o contrato não diz quanto vai para a conta, então receber pede para preencher', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page, 'MARIA APARECIDA EXEMPLO');
    await abrirSecao(cartao, 'Parcelas');
    await cartao.getByRole('button', { name: 'Nova parcela' }).click();
    const nova = cartao.getByRole('form', { name: 'Nova parcela' });
    await nova.getByLabel('Valor').fill('500,00');
    await nova.getByRole('button', { name: 'Salvar parcela' }).click();
    // Quando
    await cartao.getByRole('button', { name: 'Receber a parcela 1' }).click();
    // Então
    await expect(cartao.getByText('Preencha em "Atualizar contrato"', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Registrar recebimento' })).toBeDisabled();
  });

  test('quando a pessoa é cliente do contrato, então as parcelas aparecem no cartão dela, com o link para o contrato', async ({ page }) => {
    // Dado
    await contratoComParcelas(page);
    // Quando
    await page.goto('/pessoas/');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Parcelas');
    // Então
    const tabela = cartao.getByRole('table', { name: 'Parcelas' });
    await expect(tabela.getByRole('row')).toHaveCount(6);
    await expect(tabela.getByRole('link').first()).toHaveAttribute('href', /\/contratos\/\?id=/);
    await expect(tabela.getByRole('button')).toHaveCount(0);
  });
});

test.describe('Receber', () => {
  test.beforeEach(async ({ page }) => { await prepararCaixa(page); });

  test('quando registra o recebimento, então vê a divisão confirmada, a parcela fica recebida, e o repasse cria a saída no caixa', async ({ page }) => {
    // Dado
    const cartao = await contratoComParcelas(page);
    const form = await receberPrimeira(cartao);
    // Então: a divisão aparece enquanto se digita, com o aviso do DAS
    const divisao = form.getByRole('definition');
    await expect(form.getByLabel('Como fica a divisão')).toContainText('Escritório');
    await expect(divisao.filter({ hasText: dinheiro('277,50') })).toBeVisible();
    await expect(divisao.filter({ hasText: dinheiro('647,50') }).first()).toBeVisible();
    await expect(form.getByText('O DAS deste mês ainda não foi lançado', { exact: false })).toBeVisible();
    // Quando
    await form.getByRole('button', { name: 'Registrar recebimento' }).click();
    // Então
    await expect(form).toHaveCount(0);
    await expect(cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row').nth(1)).toContainText('Recebida');
    await expect(cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row').nth(1)).toContainText(dinheiro('1.000,00'));
    await cartao.getByRole('button', { name: 'Ver a divisão da parcela 1' }).click();
    await expect(cartao.getByLabel('Como ficou a divisão')).toContainText('DAS (4,5%)');
    // Quando: paga o repasse
    await page.goto('/parcelas/');
    const repasses = page.getByRole('table', { name: 'Repasses' });
    await expect(repasses).toContainText(dinheiro('647,50'));
    await expect(repasses).toContainText('A pagar');
    await page.getByRole('button', { name: 'Pagar o repasse a Mateus Freitas Gonçalves' }).click();
    await page.getByRole('form', { name: 'Pagar o repasse a Mateus Freitas Gonçalves' }).getByRole('button', { name: 'Confirmar pagamento' }).click();
    // Então
    await expect(repasses).toContainText('Pago');
    // Quando: abre o caixa
    await page.goto('/financeiro/');
    // Então: a entrada, a taxa e o repasse estão lá, e só mudam pela parcela
    const caixa = page.getByRole('table', { name: 'Lançamentos do mês' });
    await expect(caixa.getByRole('row')).toHaveCount(4);
    await expect(caixa).toContainText('Recebimento: JOSÉ DA SILVA TESTE');
    await expect(caixa).toContainText('Taxa da máquina');
    await expect(caixa).toContainText('Repasse a Mateus Freitas Gonçalves');
    await expect(caixa.getByText('Veio de uma parcela')).toHaveCount(2);
    await expect(caixa.getByText('Veio de um repasse')).toHaveCount(1);
    await expect(caixa.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('definition').filter({ hasText: dinheiro('322,50') }).first()).toBeVisible();
  });

  test('quando tudo vai para a conta e há outro advogado com 10%, então o cadastro aceita e a divisão é a confirmada: 185 / 740 / 92,50', async ({ page }) => {
    // Dado: o exemplo confirmado pelo escritório em 02/11/2026
    const cartao = await abrirContrato(page, 'JOSÉ DA SILVA TESTE');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByText('100% do que o cliente pagar').click();
    await cartao.getByRole('button', { name: 'Adicionar participante' }).click();
    await cartao.getByRole('textbox', { name: 'Participante 1', exact: true }).fill('bruno');
    await cartao.getByRole('button', { name: /BRUNO EXEMPLO SOUZA/ }).click();
    await cartao.getByRole('textbox', { name: '% do participante 1' }).fill('10');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    await abrirSecao(cartao, 'Parcelas');
    await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
    // Quando
    const form = await receberPrimeira(cartao);
    // Então
    const divisao = form.getByLabel('Como fica a divisão');
    await expect(divisao).toContainText('O responsável repassa a BRUNO EXEMPLO SOUZA');
    for (const valor of ['185,00', '740,00', '92,50', '647,50']) await expect(divisao).toContainText(dinheiro(valor));
  });

  test('quando estorna, então a parcela volta a receber e o caixa fica como estava; desfazer devolve', async ({ page }) => {
    // Dado
    const cartao = await contratoComParcelas(page);
    const form = await receberPrimeira(cartao);
    await form.getByRole('button', { name: 'Registrar recebimento' }).click();
    await expect(form).toHaveCount(0);
    const primeira = cartao.getByRole('table', { name: 'Parcelas' }).getByRole('row').nth(1);
    // Quando
    await cartao.getByRole('button', { name: 'Estornar' }).click();
    await cartao.getByRole('button', { name: 'Confirmar: estornar' }).click();
    // Então
    await expect(cartao.getByRole('button', { name: 'Receber a parcela 1' })).toBeVisible();
    await expect(primeira).not.toContainText('Recebida');
    await abrirSecao(cartao, 'Histórico das parcelas');
    await expect(cartao.getByText('Recebimento estornado')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(primeira).toContainText('Recebida');
  });

  test('quando o repasse já foi pago, então o estorno é recusado até desfazer o pagamento', async ({ page }) => {
    // Dado
    const cartao = await contratoComParcelas(page);
    const form = await receberPrimeira(cartao);
    await form.getByRole('button', { name: 'Registrar recebimento' }).click();
    await expect(form).toHaveCount(0);
    await page.goto('/parcelas/');
    await page.getByRole('button', { name: 'Pagar o repasse a Mateus Freitas Gonçalves' }).click();
    await page.getByRole('form', { name: 'Pagar o repasse a Mateus Freitas Gonçalves' }).getByRole('button', { name: 'Confirmar pagamento' }).click();
    const repasses = page.getByRole('table', { name: 'Repasses' });
    await expect(repasses).toContainText('Pago');
    // Quando
    const novoCartao = await abrirContrato(page, 'JOSÉ DA SILVA TESTE');
    await abrirSecao(novoCartao, 'Parcelas');
    await novoCartao.getByRole('button', { name: 'Estornar' }).click();
    await novoCartao.getByRole('button', { name: 'Confirmar: estornar' }).click();
    // Então
    await expect(page.getByText('Há repasse já pago deste recebimento', { exact: false })).toBeVisible();
    // Quando
    await page.goto('/parcelas/');
    await repasses.getByRole('button', { name: 'Desfazer pagamento' }).click();
    await repasses.getByRole('button', { name: 'Confirmar: desfazer' }).click();
    // Então
    await expect(repasses).toContainText('A pagar');
    await page.goto('/financeiro/');
    await expect(page.getByRole('table', { name: 'Lançamentos do mês' })).not.toContainText('Repasse a Mateus');
  });

  test('quando o responsável é sócio, então a parte dele fica no escritório, sem repasse', async ({ page }) => {
    // Dado
    await abrirSecao(page, 'Sócios');
    await page.getByRole('button', { name: 'Novo sócio' }).click();
    const socio = page.getByRole('form', { name: 'Novo sócio' });
    await socio.getByLabel('Pessoa').fill('MATEUS FREITAS');
    await socio.getByRole('button', { name: /MATEUS FREITAS/ }).click();
    await socio.getByLabel('Desde').fill('2020-01-01');
    await socio.getByRole('button', { name: 'Salvar sócio' }).click();
    await expect(page.getByRole('list', { name: 'Sócios' })).toContainText('desde 01/01/2020');
    // Quando
    const cartao = await contratoComParcelas(page);
    const form = await receberPrimeira(cartao);
    // Então
    const divisao = form.getByLabel('Como fica a divisão');
    await expect(divisao).toContainText('Conta para o lucro do sócio responsável');
    await expect(divisao).toContainText(dinheiro('925,00'));
    await expect(divisao).toContainText(dinheiro('647,50'));
    await expect(divisao).not.toContainText('Fica com o responsável');
    await form.getByRole('button', { name: 'Registrar recebimento' }).click();
    await expect(form).toHaveCount(0);
    await page.goto('/parcelas/');
    await expect(page.getByText('Nenhum repasse a pagar, nem pago neste mês.')).toBeVisible();
  });
});

test.describe('Página de parcelas', () => {
  test('quando troca de mês, então vê as do mês e as atrasadas, com o resumo', async ({ page }) => {
    // Dado
    await contratoComParcelas(page);
    await page.goto('/inicio/');
    // Quando
    await abrirNoFinanceiro(page, 'Parcelas');
    await page.getByLabel('Mês').fill(`${new Date().getFullYear() - 1}-01`);
    // Então: nada venceu antes do contrato
    await expect(page.getByText('Nenhuma parcela neste mês.')).toBeVisible();
    // Quando
    await page.getByLabel('Mês').fill(`${new Date().getFullYear()}-03`);
    // Então
    const tabela = page.getByRole('table', { name: 'Parcelas' });
    await expect(tabela).toContainText('JOSÉ DA SILVA TESTE');
    await expect(tabela.getByRole('link').first()).toHaveAttribute('href', /\/contratos\/\?id=/);
    await expect(page.getByLabel('Resumo das parcelas')).toContainText('Atrasada');
  });
});
