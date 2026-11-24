// Avisos da tarefa na caixa de Mensagens (#415). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Quem é posto como solicitante recebe "incluiu você"; o solicitante é avisado quando a tarefa chega à coluna de aprovação; quem
// executa é avisado quando o solicitante a devolve, com o comentário. Quem fez a ação não recebe nada. Quem está logado é o Mauro
// (master); o Bruno é estagiário e a Ana, administradora.
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

const MAURO = 'Mauro Teixeira Duarte', BRUNO = 'Bruno Exemplo Souza';
const menu = (page: Page) => page.getByRole('navigation', { name: 'Seções' });
const cartaoAberto = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
const aviso = (page: Page, nome: string | RegExp) => page.getByRole('listitem', { name: nome });

async function abrirMensagens(page: Page) {
  await page.goto('/inicio/');
  await menu(page).getByRole('link', { name: /^Mensagens/ }).click();
  await expect(page.getByRole('list', { name: 'Mensagens' }).or(page.getByText(/^Nenhuma mensagem\./))).toBeVisible();
}

/** O Mauro cadastra a tarefa para o Bruno, com o solicitante escolhido. Devolve o endereço do cartão. */
async function cadastrar(page: Page, titulo: string, solicitante: string) {
  await page.goto('/tarefas/nova/');
  await page.getByLabel('Título').fill(titulo);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByLabel(/Responsável/).selectOption({ label: BRUNO });
  await page.getByLabel(/Solicitante/).selectOption({ label: solicitante });
  await expect(page.getByRole('checkbox', { name: 'Precisa de aprovação' })).toBeChecked();
  await page.getByRole('button', { name: 'Salvar tarefa' }).click();
  await expect(cartaoAberto(page).getByRole('heading', { name: titulo })).toBeVisible();
  return new URL(page.url()).pathname + new URL(page.url()).search;
}

test.describe('Avisos da tarefa (#415)', () => {
  test('quando o Mauro põe a Ana como solicitante, então ela recebe "incluiu você", e clicar abre a tarefa', async ({ page }) => {
    // Quando
    await cadastrar(page, 'Conferir a procuração', 'Ana Teste Lima');
    // Então: o Mauro, que pôs, não recebe nada
    await abrirMensagens(page);
    await expect(aviso(page, /como solicitante/)).toHaveCount(0);
    // Então: a Ana recebe
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    const linha = aviso(page, `Aviso não lido: ${MAURO} incluiu você como solicitante da tarefa Conferir a procuração`);
    await expect(linha).toContainText('Agora você é o solicitante da tarefa.');
    // Quando
    await linha.getByRole('link').click();
    // Então
    await expect(cartaoAberto(page).getByRole('heading', { name: 'Conferir a procuração', level: 2 })).toBeVisible();
  });

  test('quando o Bruno conclui a tarefa que o Mauro pediu, então o Mauro é avisado; e quando o Mauro a devolve, o Bruno é avisado, com o comentário', async ({ page }) => {
    // Dado
    const endereco = await cadastrar(page, 'Minutar a réplica', MAURO);
    // Quando: o Bruno conclui (ela vai para a aprovação)
    await entrarComo(page, 'u-bruno');
    await page.goto(endereco);
    await cartaoAberto(page).getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa enviada para a aprovação de quem a pediu.' })).toBeVisible();
    // Então: o Bruno não recebe nada; o Mauro recebe o aviso da aprovação
    await abrirMensagens(page);
    await expect(aviso(page, /enviou para a sua aprovação/)).toHaveCount(0);
    await entrarComo(page, 'u-master');
    await abrirMensagens(page);
    const chegou = aviso(page, `Aviso não lido: ${BRUNO} enviou para a sua aprovação a tarefa Minutar a réplica`);
    await expect(chegou).toContainText('Aprove ou devolva');
    // Quando: o Mauro abre pelo aviso e devolve com um comentário
    await chegou.getByRole('link').click();
    await cartaoAberto(page).getByRole('button', { name: 'Devolver' }).click();
    await page.getByRole('textbox', { name: 'O que precisa ser ajustado?' }).fill('Falta citar a jurisprudência.');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa devolvida, com o seu comentário.' })).toBeVisible();
    // Então: o Bruno recebe a devolução, com o comentário, e o link abre o cartão
    await entrarComo(page, 'u-bruno');
    await abrirMensagens(page);
    const devolvida = aviso(page, `Aviso não lido: ${MAURO} devolveu a tarefa Minutar a réplica`);
    await expect(devolvida).toContainText('Falta citar a jurisprudência.');
    await devolvida.getByRole('link').click();
    await expect(cartaoAberto(page).getByRole('heading', { name: 'Minutar a réplica', level: 2 })).toBeVisible();
  });
});
