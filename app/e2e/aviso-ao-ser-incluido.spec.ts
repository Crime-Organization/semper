// Aviso na caixa de Mensagens para quem entra num item (#377). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Quem cria o aviso é o banco (no fictício, as funções que gravam o item), em qualquer forma de incluir: aqui, pelas bolinhas da
// equipe no topo do cartão. Na semente do banco fictício: a demanda "Busca de anterioridade" não tem o Bruno; a tarefa "Pedir
// documentos ao cliente" é do Bruno; a "Emitir a GRU" é do Mateus, com o Bruno participante (sem aviso); a "Reunião de equipe"
// (hoje, na Agenda geral) é do Mateus, sem participantes. Quem está logado é o Mateus (master).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { acaoDaBolinha, entrarComo } from './ajudantes';

const menu = (page: Page) => page.getByRole('navigation', { name: 'Seções' });
/** O cartão aberto (a janela com o título); a busca do "+" e a da troca do responsável também são janelas, sem título. */
const cartaoAberto = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
const MATEUS = 'Mateus Freitas Gonçalves';

/** Abre o cartão pela tabela do módulo, pela linha que tem `linha`, e devolve o cartão e o endereço dele (com o id). */
async function abrirPelaTabela(page: Page, endereco: string, linha: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().click();
  const cartao = cartaoAberto(page);
  await expect(cartao.getByRole('heading', { name: linha, level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\?id=/);
  return { cartao, id: new URL(page.url()).searchParams.get('id')! };
}
/** Clica no "+" (pelo nome dele no módulo) e escolhe alguém da equipe na busca. */
async function porPelaBolinha(page: Page, cartao: Locator, por: string, busca: string, nome: string) {
  await cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: por }).click();
  const painel = page.getByRole('dialog', { name: por });
  await painel.getByRole('textbox', { name: `Buscar na equipe: ${por.toLowerCase()}` }).fill(busca);
  await painel.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: nome, exact: true }).click();
  // A bolinha de quem entrou ("Nome, Papel"), que abre o menu dele (#388).
  await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: new RegExp(`^${nome}, `) })).toBeVisible();
}
async function abrirMensagens(page: Page) {
  await page.goto('/inicio/');
  await menu(page).getByRole('link', { name: /^Mensagens/ }).click();
  await expect(page.getByRole('list', { name: 'Mensagens' }).or(page.getByText(/^Nenhuma mensagem\./))).toBeVisible();
}
/** O aviso de inclusão na caixa, pelo rótulo da linha. */
const aviso = (page: Page, nome: string | RegExp) => page.getByRole('listitem', { name: nome });

test.describe('Aviso ao ser incluído num item', () => {
  test('dado o Bruno fora da demanda, quando o Mateus o põe pela bolinha com "+", então o Bruno recebe o aviso, e clicar abre a demanda e marca como lida', async ({ page }) => {
    // Dado
    const { cartao, id } = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'bru', 'Bruno Exemplo Souza');
    // Então: o Mateus, que incluiu, não recebe nada
    await abrirMensagens(page);
    await expect(aviso(page, /incluiu você/)).toHaveCount(0);
    // Então: o Bruno recebe, com o número no menu
    await entrarComo(page, 'u-bruno');
    await expect(menu(page).getByRole('link', { name: /Mensagens, \d+ não lidas?/ })).toBeVisible();
    await abrirMensagens(page);
    const linha = aviso(page, `Aviso não lido: ${MATEUS} incluiu você na demanda Busca de anterioridade`);
    await expect(linha).toContainText('Agora você é colaborador da demanda.');
    // Quando
    await linha.getByRole('link').click();
    // Então: abre o cartão daquela demanda (pelo endereço com o id, não só pelo título, que se repete)
    await expect(page).toHaveURL(new RegExp(`/demandas/\\?id=${id}`));
    await expect(cartaoAberto(page).getByRole('heading', { name: 'Busca de anterioridade', level: 2 })).toBeVisible();
    await abrirMensagens(page);
    await expect(aviso(page, `Aviso lido: ${MATEUS} incluiu você na demanda Busca de anterioridade`)).toBeVisible();
  });

  test('dada a tarefa do Bruno, quando o Mateus passa a responsabilidade para a Ana, então ela recebe o aviso de responsável', async ({ page }) => {
    // Dado
    const { cartao, id } = await abrirPelaTabela(page, '/tarefas/', 'Pedir documentos ao cliente');
    // Quando
    await acaoDaBolinha(page, cartao, 'Bruno Exemplo Souza, Responsável', 'Trocar o responsável');
    const painel = page.getByRole('dialog', { name: 'Trocar o responsável' });
    await painel.getByRole('textbox', { name: 'Buscar na equipe: trocar o responsável' }).fill('ana');
    await painel.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    await expect(page.getByText('Responsável pela tarefa: Ana Teste Lima.')).toBeVisible();
    // Então
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    const linha = aviso(page, `Aviso não lido: ${MATEUS} pôs você como responsável pela tarefa Pedir documentos ao cliente`);
    await expect(linha).toContainText('Agora você é o responsável.');
    await expect(linha.getByRole('link')).toHaveAttribute('href', `/tarefas/?id=${id}`);
  });

  test('dado o compromisso da Agenda geral, quando o Mateus põe a Ana, então o aviso dela abre o compromisso na Agenda', async ({ page }) => {
    // Dado
    const { cartao, id } = await abrirPelaTabela(page, '/agenda/', 'Reunião de equipe');
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr participante', 'ana', 'Ana Teste Lima');
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    await aviso(page, `Aviso não lido: ${MATEUS} incluiu você no compromisso Reunião de equipe`).getByRole('link').click();
    // Então
    await expect(page).toHaveURL(new RegExp(`/agenda/\\?id=${id}`));
    await expect(cartaoAberto(page).getByRole('heading', { name: 'Reunião de equipe', level: 2 })).toBeVisible();
  });

  for (const fechada of [false, true]) {
    test(`dado o Bruno incluído e retirado depois de ler, com a visualização ${fechada ? 'fechada' : 'aberta'}, quando abre a caixa, então vê só que não faz mais parte, sem o item e sem link`, async ({ page }) => {
      // Dado
      await page.goto('/inicio/');
      await page.evaluate(l => (window as unknown as { SEMPER_FALSO: { fecharVisibilidade(l: boolean): void } }).SEMPER_FALSO.fecharVisibilidade(l), fechada);
      let { cartao } = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
      await porPelaBolinha(page, cartao, 'Pôr colaborador', 'bru', 'Bruno Exemplo Souza');
      await entrarComo(page, 'u-bruno');
      await abrirMensagens(page);
      await page.getByRole('button', { name: `Marcar como lida a mensagem de ${MATEUS} sobre a demanda Busca de anterioridade` }).click();
      await expect(aviso(page, /^Aviso lido: .* incluiu você na demanda Busca de anterioridade/)).toBeVisible();
      // Quando
      await entrarComo(page, 'u-master');
      ({ cartao } = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade'));
      await acaoDaBolinha(page, cartao, 'Bruno Exemplo Souza, Colaborador', 'Tirar da demanda');
      await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Bruno Exemplo Souza, Colaborador', exact: true })).toHaveCount(0);
      // Então
      await entrarComo(page, 'u-bruno');
      await abrirMensagens(page);
      const linha = aviso(page, 'Aviso lido: Você não faz mais parte desta demanda');
      await expect(linha).toContainText('Você não faz mais parte desta demanda.');
      await expect(linha).not.toContainText('Busca de anterioridade');
      await expect(linha).not.toContainText(MATEUS);
      await expect(linha.getByRole('link')).toHaveCount(0);
    });
  }

  test('dado o Bruno posto na demanda, quando o Mateus desfaz logo em seguida, então o Bruno não fica com aviso nenhum', async ({ page }) => {
    // Dado
    const { cartao } = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'bru', 'Bruno Exemplo Souza');
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Bruno Exemplo Souza, Colaborador', exact: true })).toHaveCount(0);
    // Então
    await entrarComo(page, 'u-bruno');
    await abrirMensagens(page);
    await expect(aviso(page, /Busca de anterioridade|não faz mais parte/)).toHaveCount(0);
  });

  test('dado o Bruno na tarefa, quando o Mateus o tira e desfaz logo em seguida, então o Bruno não recebe "incluiu você"', async ({ page }) => {
    // Dado
    const { cartao } = await abrirPelaTabela(page, '/tarefas/', 'Emitir a GRU');
    // Quando
    await acaoDaBolinha(page, cartao, 'Bruno Exemplo Souza, Participante', 'Tirar da tarefa');
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Bruno Exemplo Souza, Participante', exact: true })).toHaveCount(0);
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    await expect(cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: 'Bruno Exemplo Souza, Participante', exact: true })).toBeVisible();
    // Então
    await entrarComo(page, 'u-bruno');
    await abrirMensagens(page);
    await expect(aviso(page, /Emitir a GRU|não faz mais parte/)).toHaveCount(0);
  });
});
