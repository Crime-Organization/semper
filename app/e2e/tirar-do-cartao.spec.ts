// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "x" que tira do cartão o que se ligou nele (#424): aparece ao passar o mouse, pergunta antes de tirar e some para quem não pode
// mudar o cartão. Na semente do banco fictício, a demanda "Notificar o devedor" (avulsa) tem uma cliente, MARIA APARECIDA EXEMPLO, e o
// processo judicial 0001234-97.2026.8.13.0024 tem um cliente só, JOSÉ DA SILVA TESTE. Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, acaoNoMenuDoCartao, perguntaDoTirar, tirarDoCartao } from './ajudantes';

const MARIA = 'MARIA APARECIDA EXEMPLO';
const JOSE = 'JOSÉ DA SILVA TESTE';

/** Abre o cartão pela tabela do módulo e a seção pedida. */
async function abrirCartao(page: Page, endereco: string, linha: string, secao: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await abrirSecao(cartao, secao);
  return cartao;
}
/** O item ligado, na lista da seção, pelo nome. */
const item = (cartao: Locator, nome: string) => cartao.getByRole('listitem').filter({ has: cartao.page().getByRole('link', { name: new RegExp(nome) }) });

test.describe('O "x" de tirar do cartão (#424)', () => {
  test('dado um cliente ligado à demanda, quando quem a altera passa o mouse, então vê o "x"; ao clicar, o SEMPER pergunta e só tira com o sim', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Notificar o devedor', 'Clientes');
    const x = cartao.getByRole('button', { name: `Tirar ${MARIA}` });
    // Quando: passa o mouse no cliente
    await item(cartao, MARIA).hover();
    // Então
    await expect(x).toBeVisible();
    await expect(x).toHaveCSS('opacity', '1');
    // Quando: clica e desiste
    await x.click();
    await expect(perguntaDoTirar(page)).toContainText('A pessoa continua no cadastro');
    await perguntaDoTirar(page).getByRole('button', { name: 'Cancelar' }).click();
    // Então: nada saiu
    await expect(item(cartao, MARIA)).toBeVisible();
    // Quando: clica e confirma
    await tirarDoCartao(page, x);
    // Então
    await expect(cartao.getByText('Nenhum cliente ligado a esta demanda.')).toBeVisible();
    await expect(page.getByText(`Cliente tirado da demanda: ${MARIA}.`)).toBeVisible();
    // Quando: desfaz
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então: a cliente volta
    await expect(item(cartao, MARIA)).toBeVisible();
  });

  test('dado quem não pode mudar o cartão (a demanda arquivada), quando o abre, então não vê o "x"', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Notificar o devedor', 'Clientes');
    await expect(cartao.getByRole('button', { name: `Tirar ${MARIA}` })).toHaveCount(1);
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByText('Arquivada', { exact: true }).first()).toBeVisible();
    // Então
    await expect(item(cartao, MARIA)).toBeVisible();
    await expect(cartao.getByRole('button', { name: `Tirar ${MARIA}` })).toHaveCount(0);
  });

  test('dado o processo com um cliente só, quando o cartão abre, então esse cliente não tem "x" (o processo precisa de um cliente)', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, '/processos/judicial/', '0001234-97.2026.8.13.0024', 'Clientes');
    // Então
    await expect(item(cartao, JOSE)).toBeVisible();
    await expect(cartao.getByRole('button', { name: `Tirar ${JOSE}` })).toHaveCount(0);
  });

  test('dada uma anotação ligada à demanda, quando quem a altera tira pelo "x" e confirma, então ela sai da seção e continua em Documentos', async ({ page }) => {
    // Dado: uma anotação nova ligada à demanda, pelo "+" da seção
    let cartao = await abrirCartao(page, '/demandas/', 'Registro de marca', 'Anotações');
    await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
    const janela = page.getByRole('dialog', { name: 'Anotação', exact: true });
    const nova = janela.getByRole('article', { name: 'Anotação nova' });
    await expect(nova.getByRole('heading', { level: 2 })).toBeVisible();
    const campo = nova.getByRole('textbox', { name: 'Título' });
    if (!await campo.count()) await nova.getByRole('button', { name: 'Sem título' }).click();
    await campo.fill('Conversa sobre a marca');
    await campo.press('Enter');
    // Gravada, ela passa a se chamar pelo código
    await expect(janela.getByRole('article', { name: /^Anotação (?!nova$)\w+$/ })).toBeVisible();
    // Quando
    cartao = await abrirCartao(page, '/demandas/', 'Registro de marca', 'Anotações');
    await tirarDoCartao(page, cartao.getByRole('button', { name: 'Tirar a anotação Conversa sobre a marca' }));
    // Então
    await expect(cartao.getByText('Nenhuma anotação ligada a esta demanda.')).toBeVisible();
    await page.goto('/documentos/');
    await expect(page.getByText('Conversa sobre a marca').first()).toBeVisible();
  });
});
