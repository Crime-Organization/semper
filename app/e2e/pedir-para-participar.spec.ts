// Pedir para participar de um item de que ainda não faço parte (#363). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Fora da fase de adaptação, com a visualização fechada (cada um vê só os itens de que faz parte). Na semente do banco fictício, a
// tarefa "Renovar a procuração" (F00D1234) é da Ana (administradora), que a criou, com o Mateus (master); o Bruno (estagiário) não
// está nela.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const menu = (page: Page) => page.getByRole('navigation', { name: 'Seções' });
const janela = (page: Page) => page.getByRole('dialog', { name: 'Buscar em todo o SEMPER' });
const campo = (page: Page) => janela(page).getByRole('combobox', { name: 'Buscar em todo o SEMPER' });
/** A linha da tarefa na busca geral. */
const linhaDaTarefa = (page: Page) => janela(page).getByRole('group', { name: 'Tarefas', exact: true }).getByRole('option', { name: /F00D1234/ });
const pedidoNaCaixa = (page: Page) => page.getByRole('listitem', { name: /Pedido para participar .* de Bruno Exemplo Souza/ });

/** Fecha a visualização no banco fictício e entra como a conta indicada. */
async function comAVisualizacaoFechada(page: Page, conta: string) {
  await page.goto('/inicio/');
  await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { fecharVisibilidade(l: boolean): void } }).SEMPER_FALSO.fecharVisibilidade(true));
  await entrarComo(page, conta);
}
/** Abre a busca geral pelo botão do menu e busca o código da tarefa. */
async function buscarOCodigo(page: Page, texto = 'F00D1234') {
  await page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Buscar em todo o SEMPER' }).click();
  await campo(page).fill(texto);
}
/** O Bruno acha a tarefa pelo código e pede para participar. */
async function brunoPede(page: Page) {
  await comAVisualizacaoFechada(page, 'u-bruno');
  await buscarOCodigo(page);
  await linhaDaTarefa(page).getByRole('button', { name: 'Pedir para participar: Tarefa F00D1234' }).click();
  await expect(linhaDaTarefa(page)).toContainText('Pedido enviado');
}
async function abrirMensagens(page: Page) {
  await page.goto('/inicio/');
  await menu(page).getByRole('link', { name: /^Mensagens/ }).click();
}
/**
 * Espera a caixa carregar: a lista de mensagens ou o aviso de caixa vazia. O título aparece antes da lista; sem esta espera,
 * "o pedido não está na caixa" passaria só porque a lista ainda não chegou.
 */
async function esperarACaixa(page: Page) {
  await expect(page.getByRole('list', { name: 'Mensagens' }).or(page.getByText(/^Nenhuma mensagem\./))).toBeVisible();
}

test.describe('Pedir para participar', () => {
  test('dado o usuário comum fora da tarefa, quando acha pelo código e pede, então a administradora aprova pelas Mensagens e ele passa a ver a tarefa', async ({ page }) => {
    // Dado
    await comAVisualizacaoFechada(page, 'u-bruno');
    await buscarOCodigo(page);
    // Então: só o tipo e o código, sem o título
    await expect(linhaDaTarefa(page)).toContainText('Você não faz parte deste item.');
    await expect(janela(page)).not.toContainText('Renovar a procuração');
    // Quando
    await linhaDaTarefa(page).getByRole('button', { name: 'Pedir para participar: Tarefa F00D1234' }).click();
    // Então
    await expect(linhaDaTarefa(page)).toContainText('Pedido enviado · aguardando resposta');
    await expect(page.getByText('Pedido enviado. Quem pode aprovar recebe nas Mensagens.')).toBeVisible();
    // Então: o pedido chega também ao Mateus (master)
    await entrarComo(page, 'u-master');
    await abrirMensagens(page);
    await expect(pedidoNaCaixa(page)).toBeVisible();

    // Quando: a administradora aprova
    await entrarComo(page, 'u-ana');
    await expect(menu(page).getByRole('link', { name: /Mensagens, \d+ não lidas?/ })).toBeVisible();
    await abrirMensagens(page);
    await expect(pedidoNaCaixa(page)).toContainText('Bruno Exemplo Souza pediu para participar da tarefa F00D1234');
    await pedidoNaCaixa(page).getByRole('button', { name: 'Aprovar o pedido de Bruno Exemplo Souza' }).click();
    // Então: o pedido sai da caixa (dela e do Mateus)
    await expect(page.getByText('Pedido aprovado: Bruno Exemplo Souza entra como participante.')).toBeVisible();
    await expect(pedidoNaCaixa(page)).toHaveCount(0);
    await entrarComo(page, 'u-master');
    await abrirMensagens(page);
    await esperarACaixa(page);
    await expect(pedidoNaCaixa(page)).toHaveCount(0);

    // Então: o Bruno é avisado e passa a ver a tarefa
    await entrarComo(page, 'u-bruno');
    await abrirMensagens(page);
    const resposta = page.getByRole('listitem', { name: /Resposta não lida: Ana Teste Lima aprovou seu pedido/ });
    await expect(resposta).toContainText('Agora você é participante da tarefa.');
    await resposta.getByRole('link').click();
    const cartao = page.getByRole('dialog');
    await expect(cartao).toContainText('Renovar a procuração');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByRole('listitem').filter({ hasText: 'Pedido para participar aprovado: Bruno Exemplo Souza' })).toBeVisible();
    await page.keyboard.press('Escape');
    await buscarOCodigo(page);
    await expect(janela(page).getByRole('option', { name: /Renovar a procuração/ })).toBeVisible();
  });

  test('dado um pedido, quando o master recusa, então o usuário é avisado, continua sem ver a tarefa e a recusa fica no histórico', async ({ page }) => {
    // Dado
    await brunoPede(page);
    // Quando
    await entrarComo(page, 'u-master');
    await abrirMensagens(page);
    await pedidoNaCaixa(page).getByRole('button', { name: 'Recusar o pedido de Bruno Exemplo Souza' }).click();
    // Então
    await expect(page.getByText('Pedido recusado. Bruno Exemplo Souza vai receber a resposta nas Mensagens.')).toBeVisible();
    await expect(pedidoNaCaixa(page)).toHaveCount(0);
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByRole('listitem').filter({ hasText: 'Pedido para participar recusado: Bruno Exemplo Souza' })).toBeVisible();

    await entrarComo(page, 'u-bruno');
    await abrirMensagens(page);
    const resposta = page.getByRole('listitem', { name: /Resposta não lida: Mateus Freitas Gonçalves recusou seu pedido/ });
    await expect(resposta).toContainText('Você continua sem acesso a este item.');
    await expect(resposta.getByRole('link')).toHaveCount(0);
    await buscarOCodigo(page);
    await expect(linhaDaTarefa(page)).toContainText('Você não faz parte deste item.');
  });

  test('dado um pedido pendente, quando o usuário cancela, então pode pedir de novo e o pedido some da caixa de quem aprovaria', async ({ page }) => {
    // Dado: o pedido está na caixa da Ana
    await brunoPede(page);
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    await expect(pedidoNaCaixa(page)).toBeVisible();
    // Quando
    await entrarComo(page, 'u-bruno');
    await buscarOCodigo(page);
    await linhaDaTarefa(page).getByRole('button', { name: 'Cancelar o pedido: Tarefa F00D1234' }).click();
    // Então
    await expect(page.getByText('Pedido cancelado.')).toBeVisible();
    await expect(linhaDaTarefa(page).getByRole('button', { name: 'Pedir para participar: Tarefa F00D1234' })).toBeVisible();
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    await esperarACaixa(page);
    await expect(pedidoNaCaixa(page)).toHaveCount(0);
  });
});
