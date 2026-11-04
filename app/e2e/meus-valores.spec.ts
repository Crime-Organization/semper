// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A tela "Meus valores" e a seção "A passar" das Parcelas. Quem está logado é o Mateus (administrador), responsável pelo contrato de
// JOSÉ DA SILVA TESTE, já assinado, de R$ 3.000,00 em 5 parcelas, com 30% para a conta da empresa. O banco fictício começa sem contas.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirNoFinanceiro, abrirSecao } from './ajudantes';

const dinheiro = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);
type Lugar = ReturnType<Page['getByRole']>;

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

/** Abre o contrato de JOSÉ. */
async function abrirContrato(page: Page) {
  await page.goto('/inicio/');
  await abrir(page, 'Contratos');
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
  return page.getByRole('dialog');
}

/** Gera as parcelas, depois de ajustar o contrato no formulário de edição, e recebe a primeira: R$ 1.000,00 e taxa de R$ 30,00. */
async function receberComContrato(page: Page, ajustar: (cartao: Lugar) => Promise<void>) {
  const cartao = await abrirContrato(page);
  await cartao.getByRole('button', { name: 'Editar' }).click();
  await ajustar(cartao);
  await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
  await abrirSecao(cartao, 'Parcelas');
  await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
  await cartao.getByRole('button', { name: 'Receber a parcela 1' }).click();
  const form = cartao.getByRole('form', { name: 'Receber a parcela 1' });
  await form.getByLabel('Valor recebido').fill('1.000,00');
  await form.getByLabel('Taxa da máquina').fill('30,00');
  await form.getByRole('button', { name: 'Registrar recebimento' }).click();
  await expect(form).toHaveCount(0);
}

const tudoNaConta = (cartao: Lugar) => cartao.getByText('100% do que o cliente pagar').click();
/** Quem está logado é o Mateus: com a Ana como responsável, ele entra como participante ou indicador. */
const comAnaResponsavel = (ajustar: (cartao: Lugar) => Promise<void>) => async (cartao: Lugar) => {
  await cartao.getByRole('combobox', { name: 'Advogado responsável' }).selectOption({ label: 'Ana Teste Lima' });
  await ajustar(cartao);
};

/** Tudo na conta, com alguém da equipe como participante de 10%. */
const comParticipante = (busca: string, nome: RegExp) => async (cartao: Lugar) => {
  await tudoNaConta(cartao);
  await cartao.getByRole('button', { name: 'Adicionar participante' }).click();
  await cartao.getByRole('textbox', { name: 'Participante 1', exact: true }).fill(busca);
  await cartao.getByRole('button', { name: nome }).click();
  await cartao.getByRole('textbox', { name: '% do participante 1' }).fill('10');
};

const linhas = (page: Page) => page.getByRole('table', { name: 'Valores de cada recebimento' }).getByRole('row');
/** O total de um papel numa situação: "Responsável: a receber". */
const totalDe = (page: Page, nome: string) => page.getByLabel('Totais por papel').getByRole('term').filter({ hasText: nome }).locator('+ dd');

test.describe('Meus valores', () => {
  test('dado o menu, quando abre Meus valores, então a tela abre; e, sem recebimento, parcela futura não aparece', async ({ page }) => {
    // Dado: o contrato tem parcelas, mas o cliente ainda não pagou nenhuma
    const cartao = await abrirContrato(page);
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await tudoNaConta(cartao);
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    await abrirSecao(cartao, 'Parcelas');
    await cartao.getByRole('button', { name: 'Gerar parcelas' }).click();
    await expect(cartao.getByRole('button', { name: 'Receber a parcela 5' })).toBeVisible();
    await page.goto('/inicio/');
    // Quando
    await abrirNoFinanceiro(page, 'Meus valores');
    // Então
    await expect(page).toHaveURL(/\/meus-valores\/?$/);
    await expect(page.getByRole('heading', { name: /^Meus valores/ })).toBeVisible();
    await expect(page.getByText('Nenhum valor para você neste mês.', { exact: false })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Valores de cada recebimento' })).toHaveCount(0);
  });

  test('dado o responsável com tudo na conta, quando o cliente paga, então vê o valor a receber; pago o repasse, passa a recebido', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, tudoNaConta);
    // Quando
    await page.goto('/meus-valores/');
    // Então: o valor, o contrato, o papel e a situação
    await expect(linhas(page)).toHaveCount(2);
    const linha = linhas(page).nth(1);
    for (const texto of ['Responsável', 'JOSÉ DA SILVA TESTE', 'Escritório', 'A receber']) await expect(linha).toContainText(texto);
    await expect(linha).toContainText(dinheiro('647,50'));
    await expect(totalDe(page, 'Responsável: a receber')).toHaveText(dinheiro('647,50'));
    await expect(totalDe(page, 'Responsável: recebido')).toHaveText(dinheiro('0,00'));
    await expect(page.getByText('Além dos recebimentos do mês, aparecem os valores ainda a receber de antes dele.', { exact: false })).toBeVisible();
    // Quando
    await page.goto('/parcelas/');
    await page.getByRole('button', { name: 'Pagar o repasse a Mateus Freitas Gonçalves' }).click();
    await page.getByRole('form', { name: 'Pagar o repasse a Mateus Freitas Gonçalves' }).getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(page.getByRole('table', { name: 'Repasses' })).toContainText('Pago');
    await page.goto('/meus-valores/');
    // Então
    await expect(linhas(page).nth(1)).toContainText('Recebido');
    await expect(totalDe(page, 'Responsável: recebido')).toHaveText(dinheiro('647,50'));
  });

  test('dada a parte que ficou com o responsável, quando abre, então já aparece como recebido', async ({ page }) => {
    // Dado: 30% vão para a conta da empresa
    await prepararCaixa(page);
    await receberComContrato(page, async cartao => { await cartao.getByText('30% do que o cliente pagar').click(); });
    // Quando
    await page.goto('/meus-valores/');
    // Então: R$ 1.000,00 menos os R$ 300,00 da conta e a taxa
    await expect(linhas(page)).toHaveCount(2);
    const linha = linhas(page).nth(1);
    await expect(linha).toContainText(dinheiro('670,00'));
    await expect(linha).toContainText('Recebido');
    await expect(linha).toContainText('Cliente');
    await expect(totalDe(page, 'Responsável: recebido')).toHaveText(dinheiro('670,00'));
  });

  test('dado que sou participante, quando o valor é marcado como pago, então minha linha passa a recebido; e desfazer volta', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comAnaResponsavel(comParticipante('mateus', /MATEUS FREITAS/)));
    await page.goto('/meus-valores/');
    const participante = linhas(page).filter({ hasText: 'Participante' });
    await expect(participante).toContainText('A receber');
    await expect(participante).toContainText(dinheiro('92,50'));
    await expect(participante).toContainText('Ana Teste Lima');
    // Quando
    await page.goto('/parcelas/');
    const aPassar = page.getByRole('region', { name: 'A passar a participantes e indicadores' });
    await aPassar.getByRole('button', { name: /Marcar como pago/ }).click();
    await page.getByRole('form', { name: /Marcar como pago/ }).getByRole('button', { name: 'Confirmar' }).click();
    await expect(aPassar.getByRole('table')).toContainText('Pago');
    await page.goto('/meus-valores/');
    // Então
    await expect(participante).toContainText('Recebido');
    await expect(totalDe(page, 'Participante: recebido')).toHaveText(dinheiro('92,50'));
    // Quando
    await page.goto('/parcelas/');
    await aPassar.getByRole('button', { name: 'Desfazer marcação' }).click();
    await aPassar.getByRole('button', { name: 'Confirmar: desfazer' }).click();
    await expect(aPassar.getByRole('table')).toContainText('A pagar');
    await page.goto('/meus-valores/');
    // Então
    await expect(participante).toContainText('A receber');
  });

  test('dado que sou indicador e não sócio, quando o valor é marcado como pago, então minha linha de indicador passa a recebido, com o total à parte', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comAnaResponsavel(async cartao => {
      await tudoNaConta(cartao);
      await cartao.getByRole('textbox', { name: 'Indicador', exact: true }).fill('mateus');
      await cartao.getByRole('button', { name: /MATEUS FREITAS/ }).click();
      await cartao.getByRole('textbox', { name: '% do indicador' }).fill('5');
    }));
    await page.goto('/meus-valores/');
    const indicador = linhas(page).filter({ hasText: 'Indicador' });
    await expect(indicador).toContainText('A receber');
    await expect(indicador).toContainText(dinheiro('46,25'));
    // Quando
    await page.goto('/parcelas/');
    await page.getByRole('button', { name: /Marcar como pago/ }).click();
    await page.getByRole('form', { name: /Marcar como pago/ }).getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('table', { name: 'Valores a passar' })).toContainText('Pago');
    await page.goto('/meus-valores/');
    // Então
    await expect(indicador).toContainText('Recebido');
    await expect(totalDe(page, 'Indicador: recebido')).toHaveText(dinheiro('46,25'));
    await expect(totalDe(page, 'Responsável: recebido')).toHaveCount(0);
  });

  test('dado o responsável com um participante, quando abre, então a linha é a parte dele, sem o que ele passa ao participante', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comParticipante('bruno', /BRUNO EXEMPLO SOUZA/));
    // Quando
    await page.goto('/meus-valores/');
    // Então: R$ 740,00 chegam a ele, e R$ 92,50 são do participante
    await expect(linhas(page)).toHaveCount(2);
    await expect(linhas(page).nth(1)).toContainText(dinheiro('647,50'));
    await expect(totalDe(page, 'Responsável: a receber')).toHaveText(dinheiro('647,50'));
    await expect(linhas(page).nth(1)).not.toContainText(dinheiro('740,00'));
  });

  test('dado o responsável que também é participante, quando abre, então há uma linha só, com o que é dele, e nada a passar a si mesmo', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comParticipante('mateus', /MATEUS FREITAS/));
    // Quando
    await page.goto('/meus-valores/');
    // Então
    await expect(linhas(page)).toHaveCount(2);
    await expect(linhas(page).nth(1)).toContainText('Responsável');
    await expect(linhas(page).nth(1)).toContainText(dinheiro('740,00'));
    await page.goto('/parcelas/');
    await expect(page.getByRole('region', { name: 'A passar a participantes e indicadores' }).getByText('Nada a passar neste mês.')).toBeVisible();
  });

  test('dado um valor a receber, quando abre um mês seguinte, então ele continua na tela e no total; recebido, fica só no mês dele', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comAnaResponsavel(comParticipante('mateus', /MATEUS FREITAS/)));
    await page.goto('/meus-valores/');
    // Quando
    await page.getByLabel('Mês').fill('2099-12');
    // Então
    await expect(linhas(page).filter({ hasText: 'Participante' })).toContainText('A receber');
    await expect(totalDe(page, 'Participante: a receber')).toHaveText(dinheiro('92,50'));
    // Quando
    await page.goto('/parcelas/');
    const aPassar = page.getByRole('region', { name: 'A passar a participantes e indicadores' });
    await aPassar.getByRole('button', { name: /Marcar como pago/ }).click();
    await page.getByRole('form', { name: /Marcar como pago/ }).getByRole('button', { name: 'Confirmar' }).click();
    await expect(aPassar.getByRole('table')).toContainText('Pago');
    await page.goto('/meus-valores/');
    await expect(linhas(page).filter({ hasText: 'Participante' })).toContainText('Recebido');
    await page.getByLabel('Mês').fill('2099-12');
    // Então
    await expect(page.getByText('Nenhum valor para você neste mês.', { exact: false })).toBeVisible();
  });

  test('dado outro mês, quando troca, então os valores não aparecem nele', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, tudoNaConta);
    await page.goto('/meus-valores/');
    await expect(linhas(page)).toHaveCount(2);
    // Quando
    await page.getByLabel('Mês').fill('2020-01');
    // Então
    await expect(page.getByText('Nenhum valor para você neste mês.', { exact: false })).toBeVisible();
  });

  test('dado um recebimento estornado, quando abre, então a linha some', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, tudoNaConta);
    const cartao = await abrirContrato(page);
    await abrirSecao(cartao, 'Parcelas');
    // Quando
    await cartao.getByRole('button', { name: 'Estornar' }).click();
    await cartao.getByRole('button', { name: 'Confirmar: estornar' }).click();
    await expect(cartao.getByRole('button', { name: 'Receber a parcela 1' })).toBeVisible();
    await page.goto('/meus-valores/');
    // Então
    await expect(page.getByText('Nenhum valor para você neste mês.', { exact: false })).toBeVisible();
  });
});

test.describe('A passar a participantes e indicadores', () => {
  const secao = (page: Page) => page.getByRole('region', { name: 'A passar a participantes e indicadores' });

  test('dado um participante, quando o responsável marca como pago, então fica pago, sem lançamento no caixa; e o valor de quem recebe não aparece para mim', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comParticipante('bruno', /BRUNO EXEMPLO SOUZA/));
    await page.goto('/parcelas/');
    const tabela = secao(page).getByRole('table');
    await expect(tabela).toContainText('BRUNO EXEMPLO SOUZA');
    await expect(tabela).toContainText(dinheiro('92,50'));
    await expect(tabela).toContainText('A pagar');
    // Quando
    await secao(page).getByRole('button', { name: /Marcar como pago: BRUNO/ }).click();
    const form = page.getByRole('form', { name: /Marcar como pago: BRUNO/ });
    await form.getByLabel('Data do pagamento').fill('2026-03-20');
    await form.getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(form).toHaveCount(0);
    await expect(tabela).toContainText('20/03/2026');
    await expect(tabela).toContainText('Pago');
    await page.goto('/financeiro/');
    await expect(page.getByRole('table', { name: 'Lançamentos do mês' })).not.toContainText('BRUNO');
    await page.goto('/meus-valores/');
    await expect(page.getByRole('table', { name: 'Valores de cada recebimento' })).not.toContainText('BRUNO');
    await expect(linhas(page).filter({ hasText: 'Participante' })).toHaveCount(0);
  });

  test('dado um valor marcado e desfeito, quando abre o registro de ações, então as duas ações dizem o contrato, a parcela, a data e o valor', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comParticipante('bruno', /BRUNO EXEMPLO SOUZA/));
    await page.goto('/parcelas/');
    await secao(page).getByRole('button', { name: /Marcar como pago: BRUNO/ }).click();
    const form = page.getByRole('form', { name: /Marcar como pago: BRUNO/ });
    await form.getByLabel('Data do pagamento').fill('2026-03-20');
    await form.getByRole('button', { name: 'Confirmar' }).click();
    await expect(form).toHaveCount(0);
    await secao(page).getByRole('button', { name: 'Desfazer marcação' }).click();
    await secao(page).getByRole('button', { name: 'Confirmar: desfazer' }).click();
    await expect(secao(page).getByRole('table')).toContainText('A pagar');
    // Quando
    await page.goto('/equipe/');
    // Então
    const registro = page.getByRole('region', { name: 'Registro de ações' });
    for (const acao of ['incluiu', 'excluiu']) {
      const linha = registro.getByRole('listitem').filter({ hasText: acao + ' a marcação de pago de um valor do contrato' });
      await expect(linha).toContainText('parcela 1, pago em 20/03/2026');
      await expect(linha).toContainText(dinheiro('92,50'));
    }
  });

  test('dada uma data em branco, quando confirma, então pede a data e não marca', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comParticipante('bruno', /BRUNO EXEMPLO SOUZA/));
    await page.goto('/parcelas/');
    await secao(page).getByRole('button', { name: /Marcar como pago: BRUNO/ }).click();
    const form = page.getByRole('form', { name: /Marcar como pago: BRUNO/ });
    // Quando
    await form.getByLabel('Data do pagamento').fill('');
    await form.getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(form.getByText('Informe uma data válida.')).toBeVisible();
    await expect(secao(page).getByRole('table')).toContainText('A pagar');
  });

  test('dado um valor marcado como pago, quando estorna, então é recusado até desfazer a marcação', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComContrato(page, comParticipante('bruno', /BRUNO EXEMPLO SOUZA/));
    await page.goto('/parcelas/');
    await secao(page).getByRole('button', { name: /Marcar como pago: BRUNO/ }).click();
    await page.getByRole('form', { name: /Marcar como pago: BRUNO/ }).getByRole('button', { name: 'Confirmar' }).click();
    await expect(secao(page).getByRole('table')).toContainText('Pago');
    // Quando
    let cartao = await abrirContrato(page);
    await abrirSecao(cartao, 'Parcelas');
    await cartao.getByRole('button', { name: 'Estornar' }).click();
    await cartao.getByRole('button', { name: 'Confirmar: estornar' }).click();
    // Então
    await expect(page.getByText('É preciso desfazer a marcação antes.', { exact: false })).toBeVisible();
    // Quando
    await page.goto('/parcelas/');
    await secao(page).getByRole('button', { name: 'Desfazer marcação' }).click();
    await secao(page).getByRole('button', { name: 'Confirmar: desfazer' }).click();
    await expect(secao(page).getByRole('table')).toContainText('A pagar');
    cartao = await abrirContrato(page);
    await abrirSecao(cartao, 'Parcelas');
    await cartao.getByRole('button', { name: 'Estornar' }).click();
    await cartao.getByRole('button', { name: 'Confirmar: estornar' }).click();
    // Então
    await expect(cartao.getByRole('button', { name: 'Receber a parcela 1' })).toBeVisible();
    await page.goto('/parcelas/');
    await expect(secao(page).getByText('Nada a passar neste mês.')).toBeVisible();
  });
});
