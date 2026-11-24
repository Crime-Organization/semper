// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os dados do processo mudados na própria seção "Dados do processo" do cartão (#428). Na semente do banco fictício: o processo
// judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA TESTE (TJMG, comarca de Montes Claros, 2ª Vara Cível, sem juiz). Quem
// está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const NUMERO = '0001234-97.2026.8.13.0024';

/** Abre o processo judicial da semente pela tabela e, nele, a seção "Dados do processo". */
async function abrirDados(page: Page) {
  await page.goto('/processos/judicial/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: NUMERO }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
  await abrirSecao(cartao, 'Dados do processo');
  return cartao;
}
const formulario = (cartao: Locator) => cartao.getByRole('form', { name: 'Editar os dados do processo' });
/** O valor de um dado na seção lida, pelo nome dele. */
const dado = (cartao: Locator, rotulo: string) => cartao.getByRole('term').filter({ hasText: new RegExp(`^${rotulo}$`) });

test.describe('Dados do processo mudados na própria seção (#428)', () => {
  test('dado quem pode mudar o processo, quando clica nos dados, então eles viram um formulário ali mesmo, com os campos vazios, Salvar e Cancelar', async ({ page }) => {
    // Dado
    const cartao = await abrirDados(page);
    await expect(dado(cartao, 'Juiz ou relator')).toHaveCount(0);
    // Quando
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    // Então
    const form = formulario(cartao);
    await expect(form).toBeVisible();
    // Cada linha da edição tem o rótulo da leitura (#432): "Número", e não mais "Número do processo", como no cadastro.
    await expect(form.getByLabel('Número', { exact: true })).toHaveValue(NUMERO);
    await expect(form.getByLabel('Comarca')).toHaveValue('Montes Claros');
    await expect(form.getByLabel('Juiz ou relator')).toHaveValue('');
    await expect(form.getByRole('button', { name: 'Salvar' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    // E o nome, os clientes e a equipe não estão nele: mudam em outros lugares do cartão
    await expect(form.getByLabel('Responsável')).toHaveCount(0);
    await expect(form.getByRole('textbox', { name: 'Cliente', exact: true })).toHaveCount(0);
    // E o lápis continua no topo
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
  });

  test('dado quem é administrador, quando abre a edição, então ela tem a cara da leitura: os mesmos rótulos, sem textos de ajuda e sem "Acrescentar opção" (#432)', async ({ page }) => {
    // Dado: o Mauro é administrador (no lápis, ele vê o "+ Acrescentar opção" das listas)
    const cartao = await abrirDados(page);
    const lida = (texto: string) => cartao.getByRole('definition').filter({ hasText: texto });
    const passoNaLeitura = (await lida('2ª Vara Cível').boundingBox())!.y - (await lida('Montes Claros').boundingBox())!.y;
    // Quando
    await lida('Montes Claros').click();
    // Então: os rótulos são os da leitura
    const form = formulario(cartao);
    for (const rotulo of ['Número', 'Órgão', 'Sistema', 'Comarca', 'Vara', 'Distribuição', 'Advogado contrário']) await expect(form.getByLabel(rotulo, { exact: true })).toBeVisible();
    await expect(form.getByRole('checkbox', { name: 'Sim' })).toBeVisible();
    // E nada de ajuda nem de botões no meio da tabela: só Cancelar e Salvar, no pé
    // (a dica do número fica só para o leitor de tela, que a lê junto do campo)
    await expect(form.getByLabel('Número', { exact: true })).toHaveAccessibleDescription(/No padrão do CNJ/);
    expect((await form.getByText(/No padrão do CNJ/).boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);
    await expect(form.getByRole('button', { name: 'Acrescentar opção' })).toHaveCount(0);
    const botoes = form.getByRole('button');
    await expect(botoes).toHaveCount(3);
    for (const [i, nome] of ['Abrir o calendário', 'Cancelar', 'Salvar'].entries()) await expect(botoes.nth(i)).toHaveAccessibleName(nome);
    // E a linha aberta tem a altura da linha lida: de Comarca a Vara, a mesma distância
    const passoNaEdicao = (await form.getByLabel('Vara', { exact: true }).boundingBox())!.y - (await form.getByLabel('Comarca', { exact: true }).boundingBox())!.y;
    expect(Math.abs(passoNaEdicao - passoNaLeitura)).toBeLessThanOrEqual(1);
  });

  test('dado a edição aberta, quando a pessoa preenche um campo vazio e salva, então grava, a seção mostra só os preenchidos e o aviso oferece Desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirDados(page);
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    const form = formulario(cartao);
    // Quando
    await form.getByLabel('Juiz ou relator').fill('Dra. Exemplo');
    await form.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(form).toHaveCount(0);
    await expect(page.getByText('Processo atualizado.')).toBeVisible();
    await expect(dado(cartao, 'Juiz ou relator')).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: 'Dra. Exemplo' })).toBeVisible();
    await expect(dado(cartao, 'Classe')).toHaveCount(0);
    // Quando: desfaz
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então: o juiz sai de novo
    await expect(dado(cartao, 'Juiz ou relator')).toHaveCount(0);
  });

  test('dado a edição aberta com uma mudança, quando a pessoa clica em Cancelar, então nada muda', async ({ page }) => {
    // Dado
    const cartao = await abrirDados(page);
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    const form = formulario(cartao);
    await form.getByLabel('Comarca').fill('Uberlândia');
    // Quando
    await form.getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(form).toHaveCount(0);
    await expect(cartao.getByRole('definition').filter({ hasText: 'Montes Claros' })).toBeVisible();
    await expect(cartao.getByText('Uberlândia')).toHaveCount(0);
  });

  test('dado a edição aberta sem mudança, quando a pessoa aperta Esc, então ela fecha, nada muda e o cartão continua aberto', async ({ page }) => {
    // Dado
    const cartao = await abrirDados(page);
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    await expect(formulario(cartao)).toBeVisible();
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(formulario(cartao)).toHaveCount(0);
    await expect(cartao.getByRole('definition').filter({ hasText: 'Montes Claros' })).toBeVisible();
  });

  test('dado a edição aberta com uma mudança, quando a pessoa aperta Esc, então pergunta antes de descartar', async ({ page }) => {
    // Dado
    const cartao = await abrirDados(page);
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    await formulario(cartao).getByLabel('Comarca').fill('Uberlândia');
    // Quando
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Descartar as mudanças?' }).getByRole('button', { name: 'Descartar' }).click();
    // Então
    await expect(formulario(cartao)).toHaveCount(0);
    await expect(cartao.getByRole('definition').filter({ hasText: 'Montes Claros' })).toBeVisible();
  });

  test('dado a edição aberta com uma mudança, quando a pessoa tenta fechar o cartão, então o aviso de sair pergunta antes', async ({ page }) => {
    // Dado
    const cartao = await abrirDados(page);
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    await formulario(cartao).getByLabel('Comarca').fill('Uberlândia');
    // Quando
    await cartao.getByRole('button', { name: 'Fechar', exact: true }).click();
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(pergunta).toBeVisible();
    // Quando: continua
    await pergunta.getByRole('button', { name: 'Continuar no cadastro' }).click();
    // Então: o que foi digitado continua lá
    await expect(formulario(cartao).getByLabel('Comarca')).toHaveValue('Uberlândia');
  });

  test('dado um processo que a pessoa só lê, quando clica nos dados, então nada vira formulário', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno (estagiário) lê o processo, em que não está
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirDados(page);
    // Quando
    await cartao.getByRole('definition').filter({ hasText: 'Montes Claros' }).click();
    // Então
    await expect(formulario(cartao)).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Dados do processo' })).toHaveCount(0);
  });
});
