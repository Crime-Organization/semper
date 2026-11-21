// Grupos da equipe (#378): o administrador junta pessoas da equipe em grupos (em Equipe e acessos) e põe um grupo num item pela
// bolinha com "+"; todos do grupo participam dele. Quadro e tabela de Demandas e Tarefas filtram por grupo. Padrão dos testes
// (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício: quem está logado é o Mauro (master); o Bruno
// (estagiário, usuário comum) é colaborador da demanda "Registro de marca", que tem três tarefas, e não está na "Busca de
// anterioridade"; "Renovar a procuração" é avulsa.
// O escritório de exemplo começa sem grupos.
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

const NUCLEO = 'Núcleo Teste';
const cartaoAberto = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });

/** Cria o grupo pela tela, com o Bruno, e fecha o painel do grupo. */
async function criarGrupoComBruno(page: Page, nome = NUCLEO) {
  await page.goto('/equipe/');
  const secao = page.getByRole('region', { name: 'Grupos da equipe' });
  await secao.getByRole('button', { name: 'Novo grupo' }).click();
  await page.getByRole('dialog', { name: 'Nome do grupo novo' }).getByRole('textbox').fill(nome);
  await page.getByRole('dialog', { name: 'Nome do grupo novo' }).getByRole('button', { name: 'Salvar' }).click();
  const painel = page.getByRole('dialog', { name: `Grupo ${nome}` });
  await painel.getByRole('button', { name: 'Adicionar integrante' }).click();
  await painel.getByRole('button', { name: 'Bruno Exemplo Souza' }).click();
  await expect(painel.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })).toBeVisible();
  await painel.getByRole('button', { name: 'Fechar' }).click();
  return secao;
}

/** Abre a demanda pela tabela e põe o grupo pelo "+". */
async function porGrupoNaDemanda(page: Page, demanda = 'Registro de marca', nome = NUCLEO) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: demanda }).first().click();
  const cartao = cartaoAberto(page);
  await cartao.getByRole('button', { name: 'Pôr colaborador ou grupo' }).click();
  const busca = page.getByRole('dialog', { name: 'Pôr colaborador ou grupo' });
  await expect(busca.getByRole('group').first()).toHaveAccessibleName('Pessoas');
  await busca.getByRole('button', { name: `Grupo ${nome}, 1 pessoa` }).click();
  await expect(cartao.getByRole('button', { name: `Grupo ${nome}, 1 pessoa. Ver quem está` })).toBeVisible();
  return cartao;
}

/** Escolhe uma opção do filtro "Grupo da equipe", no painel Filtros. */
async function filtrarPorGrupo(page: Page, opcao: string) {
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByRole('combobox', { name: 'Grupo da equipe' }).selectOption({ label: opcao });
  await page.keyboard.press('Escape');
}

test.describe('Grupos da equipe', () => {
  test('dado o administrador, quando cria um grupo e põe o Bruno, então a linha mostra o grupo e uma pessoa; renomeado, o nome muda', async ({ page }) => {
    // Quando
    const secao = await criarGrupoComBruno(page);
    // Então
    const linha = secao.getByRole('row', { name: new RegExp(NUCLEO) });
    await expect(linha).toContainText('1 pessoa');
    await expect(linha).toContainText('Nenhum item');
    // Quando
    await linha.getByRole('button', { name: `Abrir o grupo ${NUCLEO}` }).click();
    const painel = page.getByRole('dialog', { name: `Grupo ${NUCLEO}` });
    await painel.getByRole('textbox', { name: 'Nome' }).fill('Núcleo Renomeado');
    await painel.getByRole('button', { name: 'Salvar nome' }).click();
    // Então
    await expect(secao.getByRole('button', { name: 'Abrir o grupo Núcleo Renomeado' })).toBeVisible();
  });

  test('dado um usuário comum, quando abre Equipe e acessos, então volta ao Início, sem a seção dos grupos', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/equipe/');
    // Então
    await expect(page).toHaveURL(/\/inicio\/?$/);
    await expect(page.getByRole('region', { name: 'Grupos da equipe' })).toHaveCount(0);
  });

  test('dado um grupo, quando é posto numa demanda, então a pílula mostra o nome e o número, e a dica e a lista dizem quem está', async ({ page }) => {
    // Dado
    await criarGrupoComBruno(page);
    // Quando
    const cartao = await porGrupoNaDemanda(page);
    // Então
    const pilula = cartao.getByRole('button', { name: `Grupo ${NUCLEO}, 1 pessoa. Ver quem está` });
    await expect(pilula).toContainText(`${NUCLEO} · 1`);
    await expect(pilula).toHaveAttribute('data-dica', `${NUCLEO} · 1 pessoa: Bruno Exemplo Souza`);
    await expect(page.getByText(`Grupo ${NUCLEO} posto na demanda.`)).toBeVisible();
    // Quando
    await pilula.click();
    // Então
    const lista = page.getByRole('dialog', { name: `Grupo ${NUCLEO}` });
    await expect(lista.getByRole('list', { name: `Integrantes do grupo ${NUCLEO}` })).toContainText('Bruno Exemplo Souza');
    await expect(lista.getByRole('button', { name: 'Tirar o grupo do cartão' })).toBeVisible();
  });

  test('dado o grupo numa demanda de que o Bruno não participava, quando ele entra, então vê o aviso "pelo grupo" e a mensagem do grupo', async ({ page }) => {
    // Dado
    await criarGrupoComBruno(page);
    await porGrupoNaDemanda(page, 'Busca de anterioridade');
    // Quando
    await entrarComo(page, 'u-bruno');
    await page.goto('/mensagens/');
    // Então
    await expect(page.getByRole('listitem', { name: new RegExp(`incluiu você, pelo grupo ${NUCLEO}, na demanda Busca de anterioridade`) })).toBeVisible();
    const doGrupo = page.getByRole('listitem', { name: new RegExp(`incluiu você no grupo ${NUCLEO}`) });
    await expect(doGrupo.getByRole('link', { name: 'Ver as demandas do grupo' })).toBeVisible();
    // Quando
    await doGrupo.getByRole('link', { name: 'Ver as demandas do grupo' }).click();
    // Então: a página abre filtrada no grupo
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Busca de anterioridade' })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' })).toHaveCount(0);
  });

  test('dado o Bruno numa demanda só pelo grupo, quando abre a pílula do grupo, então a nota diz que outra pessoa do cartão tira o grupo ou um administrador o tira do grupo (#274)', async ({ page }) => {
    // Dado
    await criarGrupoComBruno(page);
    await porGrupoNaDemanda(page, 'Busca de anterioridade');
    await entrarComo(page, 'u-bruno');
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).first().click();
    // Quando
    await cartaoAberto(page).getByRole('button', { name: `Grupo ${NUCLEO}, 1 pessoa. Ver quem está` }).click();
    // Então
    const lista = page.getByRole('dialog', { name: `Grupo ${NUCLEO}` });
    await expect(lista).toContainText('Para sair, peça a outra pessoa do cartão que tire o grupo dele (saem todos do grupo) ou a um administrador que tire você do grupo.');
    await expect(lista).not.toContainText(/Para sair, peça a um administrador\./);
    await expect(lista.getByRole('button', { name: 'Tirar o grupo do cartão' })).toHaveCount(0);
  });

  test('dado o grupo numa demanda, quando o filtro "Grupo da equipe" é escolhido, então a tabela e o quadro mostram só os cartões do grupo, com as mesmas colunas', async ({ page }) => {
    // Dado
    await criarGrupoComBruno(page);
    await porGrupoNaDemanda(page);
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Kanban', exact: true }).click();
    const colunas = await page.getByRole('heading', { level: 2 }).allTextContents();
    // Quando
    await filtrarPorGrupo(page, NUCLEO);
    // Então
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(colunas);
    await expect(page.getByText('Registro de marca')).toBeVisible();
    await expect(page.getByText('Busca de anterioridade')).toHaveCount(0);
    await expect(page.getByRole('img', { name: new RegExp(`^Grupo ${NUCLEO}`) })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'Busca de anterioridade' })).toHaveCount(0);
  });

  test('dado o grupo na demanda, quando Tarefas é filtrada pelo grupo, então vêm as tarefas da demanda do grupo e não as outras', async ({ page }) => {
    // Dado
    await criarGrupoComBruno(page);
    await porGrupoNaDemanda(page);
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    // Quando
    await filtrarPorGrupo(page, NUCLEO);
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Pedir documentos ao cliente' })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'Renovar a procuração' })).toHaveCount(0);
  });

  test('dado o grupo numa demanda, quando o administrador o exclui, então a pergunta diz em quantos itens ele está e o grupo some do cartão', async ({ page }) => {
    // Dado
    const secao = await criarGrupoComBruno(page);
    await porGrupoNaDemanda(page);
    await page.goto('/equipe/');
    await secao.getByRole('button', { name: `Abrir o grupo ${NUCLEO}` }).click();
    // Quando
    await page.getByRole('dialog', { name: `Grupo ${NUCLEO}` }).getByRole('button', { name: 'Excluir o grupo' }).click();
    const pergunta = page.getByRole('dialog', { name: `Excluir o grupo ${NUCLEO}?` });
    // Então
    await expect(pergunta).toContainText('Ele está em 1 item, contando os arquivados (1 demanda).');
    await pergunta.getByRole('button', { name: 'Excluir o grupo' }).click();
    await expect(secao.getByText('Nenhum grupo ainda.', { exact: false })).toBeVisible();
    // Então: a demanda não tem mais a pílula
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).first().click();
    await expect(cartaoAberto(page).getByRole('button', { name: /^Grupo / })).toHaveCount(0);
  });

  test('dado um escritório sem grupos, quando a demanda abre, então nada muda: sem filtro de grupo, sem pílula e com o "+" de sempre', async ({ page }) => {
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    // Então
    await expect(page.getByRole('combobox', { name: 'Grupo da equipe' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Pessoa da equipe' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Quando
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).first().click();
    const cartao = cartaoAberto(page);
    await cartao.getByRole('button', { name: 'Pôr colaborador', exact: true }).click();
    // Então
    await expect(page.getByRole('dialog', { name: 'Pôr colaborador' }).getByRole('group')).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /^Grupo / })).toHaveCount(0);
  });
});

test.describe('Grupos da equipe no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('dado o grupo na demanda, quando a pessoa toca na pílula, então vê quem está no grupo', async ({ page }) => {
    // Dado
    await criarGrupoComBruno(page);
    const cartao = await porGrupoNaDemanda(page);
    // Quando
    await cartao.getByRole('button', { name: `Grupo ${NUCLEO}, 1 pessoa. Ver quem está` }).tap();
    // Então
    await expect(page.getByRole('dialog', { name: `Grupo ${NUCLEO}` }).getByRole('list', { name: `Integrantes do grupo ${NUCLEO}` }))
      .toContainText('Bruno Exemplo Souza');
  });
});
