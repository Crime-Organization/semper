// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Copiar a tarefa para outra demanda (#312), no ⋯ do cartão. Na semente do banco fictício, "Emitir a GRU" é da demanda "Registro de
// marca", com o Mauro de responsável e o Bruno de participante; "Notificar o devedor" é outra demanda. Quem está logado é o Mauro
// (administrador). Os checklists copiados (desmarcados) são conferidos no teste de copiarTarefa.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, acaoNoMenuDoCartao, entrarComo } from './ajudantes';

async function abrirTarefa(page: Page, titulo: string) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}

test.describe('Copiar a tarefa para outra demanda (#312)', () => {
  test('dada uma tarefa de uma demanda, quando a pessoa a copia para outra demanda, então a cópia nasce nela com o título e a equipe, abre pelo aviso, e a original não muda', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Copiar para outra demanda');
    const janela = page.getByRole('dialog', { name: 'Copiar para outra demanda' });
    await expect(janela).toContainText('A cópia leva o título');
    const lista = janela.getByRole('list', { name: 'Demandas para ligar' });
    await expect(lista).not.toContainText('Registro de marca');
    await janela.getByRole('textbox', { name: 'Buscar demanda para ligar' }).fill('devedor');
    await lista.getByRole('button', { name: /Notificar o devedor/ }).click();
    // Então
    await expect(janela).toHaveCount(0);
    const aviso = page.getByRole('status').filter({ hasText: /Cópia .* criada na demanda "Notificar o devedor"\./ });
    await expect(aviso).toBeVisible();
    const codigo = (await aviso.textContent())!.match(/Cópia ([^ ]+) criada/)![1];
    await expect(cartao.getByText('C0FFEE12')).toBeVisible();
    await expect(cartao.getByLabel('Situação da tarefa').getByRole('option', { selected: true })).toHaveText('FAZENDO');
    await abrirSecao(cartao, 'Demanda');
    await expect(cartao.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    // Quando
    await aviso.getByRole('button', { name: 'Abrir a cópia' }).click();
    // Então
    await expect(page).toHaveURL(/[?&]id=/);
    const copia = page.getByRole('dialog');
    await expect(copia.getByText(codigo, { exact: true })).toBeVisible();
    await expect(copia.getByRole('heading', { name: 'Emitir a GRU', level: 2 })).toBeVisible();
    await expect(copia.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Bruno Exemplo Souza, Participante' })).toBeVisible();
    await expect(copia.getByRole('group', { name: 'Tempo total' })).not.toContainText('2 h');
    await abrirSecao(copia, 'Demanda');
    await expect(copia.getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    await expect(copia.getByLabel('Situação da tarefa').getByRole('option', { selected: true })).toHaveText('PARA FAZER');
    await expect(page.getByRole('row').filter({ hasText: 'Emitir a GRU' })).toHaveCount(2);
  });

  test('dada uma tarefa com diligência, solicitante e funções, quando a pessoa a copia, então a cópia tem a mesma diligência (com o motivo), quem pediu e as funções (#414)', async ({ page }) => {
    // Dado: uma diligência pedida pelo Bruno, em que a Ana executa
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Protocolar a petição');
    await page.getByText('Esta tarefa é uma diligência').click();
    await page.getByLabel('Motivo da diligência').fill('Levar a petição ao cartório');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByLabel(/Solicitante/).selectOption({ label: 'Bruno Exemplo Souza' });
    await page.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Adicionar participante' }).click();
    await page.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    await page.getByRole('combobox', { name: 'Função de Ana Teste Lima' }).selectOption({ label: 'Executa' });
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Protocolar a petição', level: 2 })).toBeVisible();
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Copiar para outra demanda');
    const janela = page.getByRole('dialog', { name: 'Copiar para outra demanda' });
    await expect(janela).toContainText('a diligência, quem pediu a tarefa');
    await janela.getByRole('textbox', { name: 'Buscar demanda para ligar' }).fill('devedor');
    await janela.getByRole('list', { name: 'Demandas para ligar' }).getByRole('button', { name: /Notificar o devedor/ }).click();
    const aviso = page.getByRole('status').filter({ hasText: /Cópia .* criada na demanda "Notificar o devedor"\./ });
    const codigo = (await aviso.textContent())!.match(/Cópia ([^ ]+) criada/)![1];
    await aviso.getByRole('button', { name: 'Abrir a cópia' }).click();
    // Então
    const copia = page.getByRole('dialog');
    await expect(copia.getByText(codigo, { exact: true })).toBeVisible();
    await expect(copia.getByText('Diligência', { exact: true })).toBeVisible();
    await expect(copia.getByText('Levar a petição ao cartório')).toBeVisible();
    await expect(copia.getByText('Pedida por')).toContainText('Bruno Exemplo Souza');
    await expect(copia.getByRole('group', { name: 'Equipe', exact: true })
      .getByRole('button', { name: 'Ana Teste Lima, Participante · Executa', exact: true })).toBeVisible();
  });

  test('dada a equipe vendo tudo, quando quem não está na tarefa a abre, então o ⋯ não oferece copiar', async ({ page }) => {
    // Dado: o Bruno não está em "Renovar a procuração"
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Então: quem só lê não tem ação nenhuma no ⋯ (nem copiar), e o ⋯ nem aparece
    await expect(cartao.getByLabel('Situação da tarefa')).toBeDisabled();
    await expect(cartao.getByRole('button', { name: 'Mais ações da tarefa' })).toHaveCount(0);
  });
});
