// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Tarefa ligada a mais de uma demanda e a mais de um contrato (#283). Na semente do banco fictício, a demanda "Registro de marca"
// (D3A1F09C) é do contrato MA96-0001 (de JOSÉ DA SILVA TESTE); "Notificar o devedor" (A90E5B13) é avulsa, de MARIA APARECIDA EXEMPLO;
// o contrato "Ação de cobrança" é de MARIA. Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}
/** O título da seção com o contador ("Tarefas 3"). */
const tituloDaSecao = (cartao: Locator, titulo: string) => cartao.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });
/** Abre o cartão da demanda pela tabela de Demandas. */
async function abrirDemanda(page: Page, titulo: string) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** Escolhe a demanda (ou o contrato) na busca do cadastro. */
async function escolher(lugar: Page | Locator, campo: string, texto: string, achado: RegExp) {
  await lugar.getByRole('combobox', { name: campo }).fill(texto);
  await lugar.getByRole('option', { name: achado }).click();
}

test.describe('Tarefa em mais de uma demanda e de um contrato (#283)', () => {
  test('quando a pessoa liga duas demandas e mais um contrato pelo "+", então o cartão mostra todos, e a tarefa aparece em cada demanda, com o contador', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Tarefa das duas demandas');
    // Quando: a primeira demanda (traz o contrato dela), o "+" de Demanda e a segunda
    await escolher(page, 'Demanda', 'Registro', /D3A1F09C · Registro de marca/);
    await expect(page.getByText(/MA96-0001/)).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar demanda' }).click();
    await escolher(page, 'Mais uma demanda', 'Notificar', /Notificar o devedor/);
    // E o "+" de Contrato, com mais um
    await page.getByRole('button', { name: 'Adicionar contrato' }).click();
    await escolher(page, 'Mais um contrato', 'cobrança', /Ação de cobrança/);
    // Então: as duas demandas e os dois contratos estão no cadastro
    const demandas = page.getByRole('group', { name: 'Demanda' });
    await expect(demandas).toContainText('Registro de marca');
    await expect(demandas).toContainText('Notificar o devedor');
    await expect(page.getByRole('group', { name: 'Contrato' })).toContainText('Ação de cobrança');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então: o cartão mostra as duas demandas e os dois contratos, com os contadores
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Tarefa das duas demandas', level: 2 })).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Demanda')).toHaveText(/2$/);
    await expect(tituloDaSecao(cartao, 'Contrato')).toHaveText(/2$/);
    const naTarefa = await secao(cartao, 'Demanda');
    await expect(naTarefa.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(naTarefa.getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    const contratos = await secao(cartao, 'Contrato');
    await expect(contratos.getByRole('link', { name: /MA96-0001/ })).toBeVisible();
    await expect(contratos.getByRole('link', { name: /Ação de cobrança/ })).toBeVisible();
    // E cada demanda mostra a tarefa na seção Tarefas
    for (const titulo of ['Registro de marca', 'Notificar o devedor']) {
      const demanda = await abrirDemanda(page, titulo);
      await expect(tituloDaSecao(demanda, 'Tarefas')).toHaveText(/\d+$/);
      await expect((await secao(demanda, 'Tarefas')).getByRole('link', { name: 'Tarefa das duas demandas' })).toBeVisible();
    }
  });

  test('dada uma tarefa nascida no cartão de uma demanda, quando o cadastro abre, então ela já está na lista e outra pode ser acrescentada', async ({ page }) => {
    // Dado
    const demanda = await abrirDemanda(page, 'Notificar o devedor');
    const antes = Number((await tituloDaSecao(demanda, 'Tarefas').innerText()).replace(/\D/g, '') || 0);
    await demanda.getByRole('link', { name: 'Nova tarefa desta demanda' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Título').fill('Tarefa nascida na demanda');
    // Então
    await expect(cadastro.getByRole('group', { name: 'Demanda' })).toContainText('Notificar o devedor');
    // Quando
    await cadastro.getByRole('button', { name: 'Adicionar demanda' }).click();
    await escolher(cadastro, 'Mais uma demanda', 'Registro', /D3A1F09C · Registro de marca/);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar tarefa' }).click();
    await expect(page.getByText(/Tarefa \w+ cadastrada\./)).toBeVisible();
    // Então: a tarefa está nas duas demandas e no contador de cada uma
    const notificar = await abrirDemanda(page, 'Notificar o devedor');
    await expect(tituloDaSecao(notificar, 'Tarefas')).toHaveText(new RegExp(`${antes + 1}$`));
    await expect((await secao(notificar, 'Tarefas')).getByRole('link', { name: 'Tarefa nascida na demanda' })).toBeVisible();
    const registro = await abrirDemanda(page, 'Registro de marca');
    await expect((await secao(registro, 'Tarefas')).getByRole('link', { name: 'Tarefa nascida na demanda' })).toBeVisible();
  });

  test('dada uma tarefa em duas demandas, quando a pessoa tira uma pelo lápis, então a tarefa continua ligada à outra', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Tarefa que perde uma demanda');
    await escolher(page, 'Demanda', 'Registro', /D3A1F09C · Registro de marca/);
    await page.getByRole('button', { name: 'Adicionar demanda' }).click();
    await escolher(page, 'Mais uma demanda', 'Notificar', /Notificar o devedor/);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    const cartao = page.getByRole('dialog');
    await expect(tituloDaSecao(cartao, 'Demanda')).toHaveText(/2$/);
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    await edicao.getByRole('button', { name: /Tirar a demanda: D3A1F09C/ }).click();
    await edicao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(edicao).toHaveCount(0);
    await expect(tituloDaSecao(cartao, 'Demanda')).toHaveText(/1$/);
    const demandas = await secao(cartao, 'Demanda');
    await expect(demandas.getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    await expect(demandas.getByRole('link', { name: /Registro de marca/ })).toHaveCount(0);
  });

  test('dada uma tarefa ligada a uma demanda, quando a pessoa liga mais uma pelo cartão, então ela fica nas duas', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Tarefa ligada pelo cartão');
    await escolher(page, 'Demanda', 'Notificar', /Notificar o devedor/);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Tarefa ligada pelo cartão', level: 2 })).toBeVisible();
    // Quando
    const demandas = await secao(cartao, 'Demanda');
    await demandas.getByRole('button', { name: 'Ligar mais uma demanda' }).click();
    await demandas.getByRole('textbox', { name: 'Buscar demanda para ligar' }).fill('marca');
    await demandas.getByRole('list', { name: 'Demandas para ligar' }).getByRole('button', { name: /Registro de marca/ }).click();
    // Então
    await expect(page.getByText('Demanda ligada: Registro de marca.')).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Demanda')).toHaveText(/2$/);
    await expect(demandas.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(demandas.getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    // E o contrato da demanda nova também entrou
    await expect((await secao(cartao, 'Contrato')).getByRole('link', { name: /MA96-0001/ })).toBeVisible();
  });
});
