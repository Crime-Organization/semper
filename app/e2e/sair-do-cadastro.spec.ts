// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Sair de um cadastro novo com algo preenchido (#82): a pergunta aparece em todos os caminhos de saída.
import { expect, test, type Page } from '@playwright/test';

const cadastro = (page: Page) => page.getByRole('dialog', { name: 'Cadastro' });
const pergunta = (page: Page) => page.getByRole('dialog', { name: 'Sair sem salvar?' });

/** Abre o cadastro de tarefa na janela, por cima da lista, e preenche o título. */
async function abrirTarefaPreenchida(page: Page, titulo = 'Ligar para o cliente') {
  await page.goto('/tarefas/');
  await page.getByRole('link', { name: 'Nova tarefa' }).click();
  await cadastro(page).getByLabel('Título').fill(titulo);
}

test.describe('Sair de um cadastro sem salvar', () => {
  test('quando a pessoa clica no X com algo preenchido, então a pergunta aparece e, ao continuar, tudo fica como estava', async ({ page }) => {
    // Dado
    await abrirTarefaPreenchida(page);
    // Quando
    await cadastro(page).getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(pergunta(page)).toContainText('O que você preencheu neste cadastro será perdido.');
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(pergunta(page)).toHaveCount(0);
    await expect(cadastro(page).getByLabel('Título')).toHaveValue('Ligar para o cliente');
    await expect(page).toHaveURL(/\/tarefas\/nova/);
  });

  test('quando a pessoa aperta Esc com algo preenchido e escolhe sair, então volta à lista sem salvar', async ({ page }) => {
    // Dado
    await abrirTarefaPreenchida(page, 'Tarefa que não vai existir');
    // Quando
    await page.keyboard.press('Escape');
    await pergunta(page).getByRole('button', { name: 'Sair sem salvar' }).click();
    // Então
    await expect(cadastro(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/tarefas\/$/);
    await expect(page.getByText('Tarefa que não vai existir')).toHaveCount(0);
  });

  test('dada a pergunta aberta, quando a pessoa aperta Esc, então só a pergunta fecha', async ({ page }) => {
    // Dado
    await abrirTarefaPreenchida(page);
    await cadastro(page).getByRole('button', { name: 'Fechar' }).click();
    await expect(pergunta(page)).toBeVisible();
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(pergunta(page)).toHaveCount(0);
    await expect(cadastro(page).getByLabel('Título')).toHaveValue('Ligar para o cliente');
  });

  test('quando a pessoa usa o Voltar do navegador com algo preenchido, então a pergunta aparece e o cadastro continua', async ({ page }) => {
    // Dado
    await abrirTarefaPreenchida(page);
    // Quando
    await page.goBack();
    // Então
    await expect(pergunta(page)).toBeVisible();
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(cadastro(page).getByLabel('Título')).toHaveValue('Ligar para o cliente');
    await expect(page).toHaveURL(/\/tarefas\/nova/);
  });

  test('quando o cadastro está vazio, então o X fecha sem perguntar', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('link', { name: 'Nova tarefa' }).click();
    await expect(cadastro(page)).toBeVisible();
    // Quando
    await cadastro(page).getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(cadastro(page)).toHaveCount(0);
    await expect(pergunta(page)).toHaveCount(0);
  });

  test('quando o cadastro é salvo, então nada é perguntado e o cartão novo abre', async ({ page }) => {
    // Dado
    await abrirTarefaPreenchida(page, 'Tarefa salva sem pergunta');
    // Quando
    await cadastro(page).getByRole('button', { name: 'Próxima' }).click();
    await cadastro(page).getByRole('button', { name: 'Próxima' }).click();
    await cadastro(page).getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Tarefa salva sem pergunta', level: 2 })).toBeVisible();
    await expect(pergunta(page)).toHaveCount(0);
  });

  test('quando a pessoa está em página cheia e clica no menu lateral, então a pergunta aparece e, ao continuar, volta à mesma etapa', async ({ page }) => {
    // Dado: o cadastro de pessoa aberto direto pelo endereço, na segunda etapa
    await page.goto('/pessoas/nova/');
    await page.getByText('Pessoa jurídica', { exact: true }).click();
    await page.getByLabel('Nome').fill('EMPRESA EM ANDAMENTO');
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Tarefas', exact: true }).click();
    // Então
    await expect(pergunta(page)).toBeVisible();
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Dados da empresa' })).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveValue('EMPRESA EM ANDAMENTO');
    await expect(page).toHaveURL(/\/pessoas\/nova/);
  });

  test('quando a pessoa está em página cheia e escolhe sair, então vai para o item do menu', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/nova/');
    await page.getByText('Pessoa jurídica', { exact: true }).click();
    await page.getByLabel('Nome').fill('EMPRESA EM ANDAMENTO');
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Tarefas', exact: true }).click();
    await pergunta(page).getByRole('button', { name: 'Sair sem salvar' }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/$/);
  });

  test('quando a pessoa só escolheu o tipo de cadastro e clica no menu, então a pergunta aparece', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/nova/');
    await page.getByText('Pessoa jurídica', { exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Dados da empresa' })).toBeVisible();
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Tarefas', exact: true }).click();
    // Então
    await expect(pergunta(page)).toBeVisible();
  });

  test('quando a pessoa clica no + do mesmo cadastro com algo preenchido, então a pergunta aparece e nada se perde', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/nova/');
    await page.getByText('Pessoa jurídica', { exact: true }).click();
    await page.getByLabel('Nome').fill('EMPRESA EM ANDAMENTO');
    // Quando
    await page.getByRole('link', { name: 'Cadastrar pessoa' }).click();
    // Então
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(page.getByLabel('Nome')).toHaveValue('EMPRESA EM ANDAMENTO');
  });

  test('quando a pessoa clica em Sair do sistema com algo preenchido e escolhe continuar, então segue conectada, com o que digitou', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Ligar');
    // Quando
    await page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Sair' }).click();
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/nova/);
    await expect(page.getByLabel('Título')).toHaveValue('Ligar');
    await expect(page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Sair' })).toBeVisible();
  });

  test('quando a pessoa clica em Sair do sistema com algo preenchido e confirma, então vai para a entrada', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Ligar');
    // Quando
    await page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Sair' }).click();
    await pergunta(page).getByRole('button', { name: 'Sair sem salvar' }).click();
    // Então
    await expect(page).toHaveURL(/\/entrar/);
    await expect(pergunta(page)).toHaveCount(0);
  });

  test('quando a pessoa fecha a aba com algo preenchido, então o navegador pede confirmação', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').click();
    await page.keyboard.type('Ligar');
    const pedido = new Promise<string>(resolve => { page.once('dialog', d => { resolve(d.type()); void d.accept(); }); });
    // Quando
    await page.close({ runBeforeUnload: true });
    // Então
    expect(await pedido).toBe('beforeunload');
  });
});

test.describe('Sair de cada cadastro', () => {
  const CADASTROS = [
    { nome: 'contrato', caminho: '/contratos/novo/', preencher: async (page: Page) => { await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana'); await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click(); } },
    { nome: 'demanda', caminho: '/demandas/nova/', preencher: async (page: Page) => page.getByLabel('Título').fill('Em andamento') },
    { nome: 'processo', caminho: '/processos/novo/', preencher: async (page: Page) => page.getByLabel('Número do processo').fill('1234567') },
    { nome: 'compromisso', caminho: '/agenda/novo/', preencher: async (page: Page) => page.getByLabel('Título', { exact: false }).first().fill('Em andamento') }
  ];

  for (const { nome, caminho, preencher } of CADASTROS) {
    test(`quando a pessoa sai do cadastro de ${nome} com algo preenchido, então a pergunta aparece`, async ({ page }) => {
      // Dado
      await page.goto(caminho);
      await preencher(page);
      // Quando
      await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Início', exact: true }).click();
      // Então
      await expect(pergunta(page)).toBeVisible();
    });
  }
});
