// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Tarefas (#313): a diligência com o motivo obrigatório. Quem está logado é o Mauro (administrador).
import { expect, test } from '@playwright/test';

test.describe('Diligência na tarefa (#313)', () => {
  test('quando a pessoa marca a tarefa como diligência sem motivo, então o cadastro pede o motivo; com ele, o cartão mostra o selo e o motivo', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Protocolar a petição');
    // Quando
    await page.getByText('Esta tarefa é uma diligência').click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Diga o motivo da diligência.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A tarefa', level: 2 })).toBeVisible();
    // Quando
    await page.getByLabel('Motivo da diligência').fill('Levar a petição ao cartório');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Protocolar a petição' })).toBeVisible();
    await expect(cartao.getByText('Diligência', { exact: true })).toBeVisible();
    await expect(cartao.getByText('Levar a petição ao cartório')).toBeVisible();
  });

  test('quando a pessoa desmarca a diligência, então o motivo some e não é pedido', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Ligar para o cliente');
    await page.getByText('Esta tarefa é uma diligência').click();
    await expect(page.getByLabel('Motivo da diligência')).toBeVisible();
    // Quando
    await page.getByText('Esta tarefa é uma diligência').click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByLabel('Motivo da diligência')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Pessoas', level: 2 })).toBeVisible();
  });
});

test.describe('Solicitante e funções dos participantes (#313)', () => {
  test('quando a pessoa cadastra a tarefa com o solicitante e a função de cada participante, então o cartão mostra quem pediu e quem executa', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Preparar o recurso');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: quem cadastra já vem como solicitante
    await expect(page.getByLabel(/Solicitante/)).toHaveValue('u-master');
    // Quando
    await page.getByLabel(/Solicitante/).selectOption({ label: 'Bruno Exemplo Souza' });
    await page.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Adicionar participante' }).click();
    await page.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    // Então: quem entra vem com a função padrão
    await expect(page.getByRole('combobox', { name: 'Função de Ana Teste Lima' })).toHaveValue('fn-acompanha');
    // Quando
    await page.getByRole('combobox', { name: 'Função de Ana Teste Lima' }).selectOption({ label: 'Executa' });
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Preparar o recurso' })).toBeVisible();
    await expect(cartao.getByText('Pedida por')).toContainText('Bruno Exemplo Souza');
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Mauro Teixeira Duarte, Responsável', exact: true })).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Ana Teste Lima, Participante · Executa', exact: true })).toBeVisible();
  });

  test('quando a função de um participante é trocada no menu da bolinha, então a tarefa passa a estar entre as "Delegadas a mim"', async ({ page }) => {
    // Dado: na "Renovar a procuração", o Mauro (quem está logado) acompanha
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('combobox', { name: 'Função' }).selectOption({ label: 'Delegadas a mim' });
    await page.keyboard.press('Escape');
    await expect(page.getByText('Nenhuma tarefa encontrada com esses filtros.')).toBeVisible();
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('combobox', { name: 'Função' }).selectOption({ label: 'Qualquer função' });
    await page.keyboard.press('Escape');
    await page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).click();
    const cartao = page.getByRole('dialog');
    // Quando
    await cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Mauro Teixeira Duarte, Participante · Acompanha', exact: true }).click();
    await page.getByRole('menu').getByRole('menuitemradio', { name: 'Executa' }).click();
    // Então
    await expect(page.getByText('Mauro Teixeira Duarte agora com a função "Executa".')).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Mauro Teixeira Duarte, Participante · Executa', exact: true })).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).first().click();
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('combobox', { name: 'Função' }).selectOption({ label: 'Delegadas a mim' });
    await page.keyboard.press('Escape');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Emitir a GRU' })).toHaveCount(0);
  });

  test('quando a administradora cadastra uma função e tenta apagar uma em uso, então a nova entra na lista e a em uso não sai', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const funcoes = page.getByRole('region', { name: 'Funções dos participantes da tarefa' });
    await expect(funcoes.getByRole('row', { name: /Executa/ })).toBeVisible();
    // Quando
    await funcoes.getByRole('button', { name: 'Nova função' }).click();
    await funcoes.getByLabel('Nome da função').fill('Revisa');
    await funcoes.getByRole('button', { name: 'Cadastrar função' }).click();
    // Então
    await expect(page.getByText('Função "Revisa" cadastrada.')).toBeVisible();
    await expect(funcoes.getByRole('row', { name: /Revisa/ })).toBeVisible();
    // Quando: "Acompanha" está com o Mauro na "Renovar a procuração" e com o Bruno na "Emitir a GRU"
    const acompanha = funcoes.getByRole('row', { name: /Acompanha/ });
    await acompanha.getByRole('button', { name: 'Apagar' }).click();
    await acompanha.getByRole('button', { name: 'Confirmar: apagar Acompanha' }).click();
    // Então
    await expect(page.getByText('A função "Acompanha" está em 2 tarefas. Troque a função dessas pessoas antes de apagá-la.')).toBeVisible();
    await expect(funcoes.getByRole('row', { name: /Acompanha/ })).toBeVisible();
  });
});
