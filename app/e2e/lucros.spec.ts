// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O lucro dos sócios. Quem está logado é o Mateus (administrador), responsável pelo contrato de JOSÉ DA SILVA TESTE, de R$ 3.000,00 em 5
// parcelas. O banco fictício começa sem contas e sem sócios.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao } from './ajudantes';

const dinheiro = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);

/** A conta PJ com o DAS de 4,5%, e Mateus na lista de sócios desde 2020. */
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
  await abrirSecao(page, 'Sócios');
  await page.getByRole('button', { name: 'Novo sócio' }).click();
  const socio = page.getByRole('form', { name: 'Novo sócio' });
  await socio.getByLabel('Pessoa').fill('MATEUS FREITAS');
  await socio.getByRole('button', { name: /MATEUS FREITAS/ }).click();
  await socio.getByLabel('Desde').fill('2020-01-01');
  await socio.getByRole('button', { name: 'Salvar sócio' }).click();
  await expect(page.getByRole('list', { name: 'Sócios' })).toContainText('desde 01/01/2020');
}

/** Com tudo na conta da empresa, gera as parcelas e recebe a primeira: R$ 1.000,00 e taxa de R$ 30,00. */
async function receberComoSocio(page: Page) {
  await page.goto('/inicio/');
  await abrir(page, 'Contratos');
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
  const cartao = page.getByRole('dialog');
  await cartao.getByRole('button', { name: 'Editar' }).click();
  await cartao.getByText('100% do que o cliente pagar').click();
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

test.describe('Lucro dos sócios', () => {
  test('quando não há sócios, então pede para colocar na lista', async ({ page }) => {
    // Quando
    await page.goto('/inicio/');
    await abrir(page, 'Lucro dos sócios');
    // Então
    await expect(page.getByText('Nenhum sócio ainda.', { exact: false })).toBeVisible();
  });

  test('quando o sócio responsável recebe, então acumula a parte dele; pagar cria a saída no caixa e zera o em aberto; desfazer devolve', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComoSocio(page);
    // Quando
    await page.goto('/inicio/');
    await abrir(page, 'Lucro dos sócios');
    // Então: R$ 647,50, a parte da planilha, e não os R$ 925,00 que ficaram na conta
    const comoResponsavel = page.getByRole('table', { name: 'Lucro como responsável' });
    const linha = comoResponsavel.getByRole('row').filter({ hasText: 'MATEUS FREITAS' });
    await expect(linha).toContainText(dinheiro('647,50'));
    await expect(linha).not.toContainText(dinheiro('925,00'));
    await expect(page.getByRole('table', { name: 'Lucro como indicador' }).getByRole('row').filter({ hasText: 'MATEUS FREITAS' })).not.toContainText(dinheiro('647,50'));

    // Quando: paga. O formulário já vem com o que está em aberto
    await page.getByRole('button', { name: 'Pagar lucro' }).click();
    const form = page.getByRole('form', { name: 'Pagar lucro' });
    await expect(form.getByLabel('Valor')).toHaveValue('647,50');
    await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
    // Então
    await expect(form).toHaveCount(0);
    await expect(linha.getByRole('cell').nth(1)).toHaveText(dinheiro('0,00'));
    const pagamentos = page.getByRole('list', { name: /Pagamentos de lucro/ });
    await expect(pagamentos).toContainText('MATEUS FREITAS');

    // E no caixa ela aparece como divisão de lucro, sem poder mudar por lá
    await abrir(page, 'Caixa');
    const saida = page.getByRole('row').filter({ hasText: 'Divisão de lucro a' });
    await expect(saida).toContainText('Divisão de lucro');
    await expect(saida).toContainText('Veio do lucro dos sócios');
    await expect(saida.getByRole('button')).toHaveCount(0);

    // Quando: desfaz
    await abrir(page, 'Lucro dos sócios');
    await pagamentos.getByRole('button', { name: 'Desfazer' }).click();
    await pagamentos.getByRole('button', { name: 'Confirmar: desfazer' }).click();
    // Então
    await expect(pagamentos).toHaveCount(0);
    await expect(linha.getByRole('cell').nth(1)).toHaveText(dinheiro('647,50'));
  });

  test('quando paga mais do que está em aberto, então avisa, deixa pagar e explica o negativo', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComoSocio(page);
    await page.goto('/inicio/');
    await abrir(page, 'Lucro dos sócios');
    // Quando
    await page.getByRole('button', { name: 'Pagar lucro' }).click();
    const form = page.getByRole('form', { name: 'Pagar lucro' });
    await form.getByLabel('Valor').fill('1.000,00');
    // Então
    await expect(form.getByText('Isso passa do que está em aberto', { exact: false })).toBeVisible();
    await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(form).toHaveCount(0);
    await expect(page.getByText('o sócio retirou mais do que acumulou', { exact: false })).toBeVisible();
  });

  test('quando escolhe um ano que já passou, então a coluna diz que é o em aberto do fim dele', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComoSocio(page);
    const ano = new Date().getFullYear();
    await page.goto('/inicio/');
    await abrir(page, 'Lucro dos sócios');
    // Quando: paga com data do ano passado, e a página passa a mostrar esse ano
    await page.getByRole('button', { name: 'Pagar lucro' }).click();
    const form = page.getByRole('form', { name: 'Pagar lucro' });
    await form.getByLabel('Data do pagamento').fill(`${ano - 1}-06-15`);
    await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(form).toHaveCount(0);
    // Então
    await expect(page.getByLabel('Ano')).toHaveValue(String(ano - 1));
    await expect(page.getByRole('table', { name: 'Lucro como responsável' }).getByRole('columnheader', { name: `Em aberto no fim de ${ano - 1}` })).toBeVisible();
    await expect(page.getByRole('list', { name: `Pagamentos de lucro de ${ano - 1}` })).toContainText('MATEUS FREITAS');
  });

  test('quando move dinheiro entre contas, então não conta como lucro, e a divisão de lucro não se lança à mão', async ({ page }) => {
    // Dado
    await prepararCaixa(page);
    await receberComoSocio(page);
    await page.goto('/financeiro/');
    await abrirSecao(page, 'Contas');
    await page.getByRole('button', { name: 'Nova conta' }).click();
    const conta = page.getByRole('form', { name: 'Nova conta' });
    await conta.getByLabel('Nome da conta').fill('PF');
    await conta.getByLabel('Saldo inicial').fill('0,00');
    await conta.getByLabel('Em que dia').fill('2020-01-01');
    await conta.getByRole('button', { name: 'Criar conta' }).click();
    // Quando
    await page.getByRole('button', { name: 'Repasse entre contas' }).click();
    const repasse = page.getByRole('form', { name: 'Repasse entre contas' });
    await repasse.getByLabel('Valor').fill('500,00');
    await repasse.getByRole('button', { name: 'Lançar repasse' }).click();
    await expect(repasse).toHaveCount(0);
    // Então: o lançamento à mão não oferece a categoria
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    await expect(page.getByRole('form', { name: 'Novo lançamento' }).getByLabel('Categoria').getByRole('option', { name: /Divisão de lucro/ })).toHaveCount(0);
    // E o em aberto continua o mesmo
    await abrir(page, 'Lucro dos sócios');
    await expect(page.getByRole('table', { name: 'Lucro como responsável' }).getByRole('row').filter({ hasText: 'MATEUS FREITAS' }).getByRole('cell').nth(1)).toHaveText(dinheiro('647,50'));
    await expect(page.getByText('Nenhum pagamento de lucro neste ano.')).toBeVisible();
  });
});
