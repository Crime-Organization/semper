// A equipe mudada no topo do cartão (#356): a bolinha com "+" depois das bolinhas da equipe põe alguém da equipe na hora, e a
// ficha de cada bolinha tira o participante ou troca o responsável. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício: a tarefa "Pedir documentos ao cliente" é do Bruno, sem participantes; "Renovar a procuração" é
// da Ana, que a criou, com o Mateus de participante; a demanda "Busca de anterioridade" não tem colaboradores e não tem o Bruno
// (estagiário, não é administrador); a "Reunião de equipe" é do Mateus, sem participantes. Quem está logado é o Mateus (master).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

/** O cartão aberto (a janela com o título); a ficha da bolinha e a busca do "+" também são janelas, sem título. */
const cartaoAberto = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });

/** Abre o cartão pela tabela do módulo, pela linha que tem `linha`. */
async function abrirPelaTabela(page: Page, endereco: string, linha: string, titulo = linha) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().click();
  const cartao = cartaoAberto(page);
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
const abrirTarefa = (page: Page, titulo: string) => abrirPelaTabela(page, '/tarefas/', titulo);

/** Fecha o cartão pelo X e o abre de novo, para ver o que ficou gravado. */
async function fecharEAbrir(cartao: Locator, abrir: () => Promise<Locator>) {
  await cartao.getByRole('button', { name: 'Fechar' }).click();
  await expect(cartao).toHaveCount(0);
  return abrir();
}

/** Clica no "+" (pelo nome dele no módulo) e escolhe alguém da equipe na busca. */
async function porPelaBolinha(page: Page, cartao: Locator, por: string, busca: string, nome: string) {
  await cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: por }).click();
  const painel = page.getByRole('dialog', { name: por });
  await painel.getByRole('textbox', { name: `Buscar na equipe: ${por.toLowerCase()}` }).fill(busca);
  await painel.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: nome, exact: true }).click();
}

test.describe('Equipe no topo do cartão de tarefa', () => {
  test('dada uma tarefa sem participantes, quando abre, então aparecem o responsável e a bolinha com "+"', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    // Então
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button')).toHaveCount(2);
    await expect(equipe.getByRole('button').first()).toHaveAccessibleName('Bruno Exemplo Souza, Responsável');
    await expect(equipe.getByRole('button').last()).toHaveAccessibleName('Pôr participante');
  });

  test('quando põe alguém pela bolinha com "+", então a busca mostra só quem ainda pode entrar e ele fica na tarefa, com a mudança no histórico', async ({ page }) => {
    // Dado
    let cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Pôr participante' }).click();
    // Então: só a equipe ativa, sem o responsável (a Carla está desativada)
    await expect(page.getByRole('dialog', { name: 'Pôr participante' }).getByRole('list', { name: 'Equipe' }).getByRole('button'))
      .toHaveText([/Ana Teste Lima$/, /Mateus Freitas Gonçalves$/]);
    // Quando
    await page.getByRole('dialog', { name: 'Pôr participante' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    // Então
    await expect(page.getByText('Ana Teste Lima agora está na tarefa.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Participante' })).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Pedir documentos ao cliente'));
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Participante' })).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Participantes/).last()).toBeVisible();
    await expect(cartao).toContainText('Ana Teste Lima');
  });

  test('quando tira um participante pela bolinha dele, então ele sai da tarefa', async ({ page }) => {
    // Dado: o Mateus participa de "Renovar a procuração"
    let cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Mateus Freitas Gonçalves, Participante' }).click();
    // Quando: o Mateus é administrador, sai na hora, sem perguntar
    await page.getByRole('dialog', { name: 'Mateus Freitas Gonçalves' }).getByRole('button', { name: 'Sair da tarefa' }).click();
    // Então
    await expect(page.getByText('Mateus Freitas Gonçalves saiu da tarefa.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: /, Participante$/ })).toHaveCount(0);
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Renovar a procuração'));
    await expect(cartao.getByRole('button', { name: /, Participante$/ })).toHaveCount(0);
  });

  /** Troca o responsável pela ficha da bolinha dele. */
  async function trocarOResponsavel(page: Page, cartao: Locator, de: string, busca: string, para: string) {
    await cartao.getByRole('button', { name: `${de}, Responsável` }).click();
    const ficha = page.getByRole('dialog', { name: de });
    await ficha.getByRole('button', { name: 'Trocar o responsável' }).click();
    await ficha.getByRole('textbox', { name: 'Buscar na equipe: trocar o responsável' }).fill(busca);
    await ficha.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: para }).click();
  }

  test('quando troca o responsável pela bolinha dele, então o novo responde pela tarefa', async ({ page }) => {
    // Dado
    let cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    // Quando
    await trocarOResponsavel(page, cartao, 'Bruno Exemplo Souza', 'ana', 'Ana Teste Lima');
    // Então
    await expect(page.getByText('Responsável pela tarefa: Ana Teste Lima.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Responsável' })).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Pedir documentos ao cliente'));
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Responsável' })).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Responsável:/).last()).toBeVisible();
  });

  test('dado o responsável trocado pela bolinha, quando desfaz pelo aviso, então o de antes volta', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await trocarOResponsavel(page, cartao, 'Bruno Exemplo Souza', 'mat', 'Mateus Freitas Gonçalves');
    await expect(cartao.getByRole('button', { name: 'Mateus Freitas Gonçalves, Responsável' })).toBeVisible();
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(cartao.getByRole('button', { name: 'Bruno Exemplo Souza, Responsável' })).toBeVisible();
  });

  test('dado quem não pode ficar fora da tarefa, quando se tira pela bolinha, então confirma a saída e o cartão fecha', async ({ page }) => {
    // Dado: o Mateus põe o Bruno em "Renovar a procuração", que não é dele nem está numa demanda do Bruno
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await porPelaBolinha(page, cartao, 'Pôr participante', 'bru', 'Bruno Exemplo Souza');
    await expect(cartao.getByRole('button', { name: 'Bruno Exemplo Souza, Participante' })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    const doBruno = await abrirTarefa(page, 'Renovar a procuração');
    await doBruno.getByRole('button', { name: 'Bruno Exemplo Souza, Participante' }).click();
    // Quando
    await page.getByRole('dialog', { name: 'Bruno Exemplo Souza' }).getByRole('button', { name: 'Sair da tarefa' }).click();
    const confirmacao = page.getByRole('dialog', { name: 'Sair da tarefa?' });
    await expect(confirmacao).toContainText('você pode deixar de ver este cartão');
    await confirmacao.getByRole('button', { name: 'Sair da tarefa' }).click();
    // Então
    await expect(page.getByText('Você saiu da tarefa, e a saída ficou no histórico.')).toBeVisible();
    await expect(cartaoAberto(page)).toHaveCount(0);
  });
});

test.describe('Equipe no topo dos outros cartões', () => {
  test('dada uma demanda, quando põe um colaborador pela bolinha com "+", então ele fica na demanda', async ({ page }) => {
    // Dado
    const abrir = () => abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    let cartao = await abrir();
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'bru', 'Bruno Exemplo Souza');
    // Então
    await expect(cartao.getByRole('button', { name: 'Bruno Exemplo Souza, Colaborador' })).toBeVisible();
    cartao = await fecharEAbrir(cartao, abrir);
    await expect(cartao.getByRole('button', { name: 'Bruno Exemplo Souza, Colaborador' })).toBeVisible();
  });

  test('dado um processo, quando põe um colaborador pela bolinha com "+", então ele fica no processo', async ({ page }) => {
    // Dado
    const abrir = () => abrirPelaTabela(page, '/processos/judicial/', 'JOSÉ DA SILVA TESTE');
    let cartao = await abrir();
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'ana', 'Ana Teste Lima');
    // Então
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Colaborador' })).toBeVisible();
    cartao = await fecharEAbrir(cartao, abrir);
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Colaborador' })).toBeVisible();
  });

  test('dado um compromisso, quando põe um participante pela bolinha com "+", então ele fica no compromisso', async ({ page }) => {
    // Dado
    const abrir = () => abrirPelaTabela(page, '/agenda/', 'Reunião de equipe');
    let cartao = await abrir();
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr participante', 'ana', 'Ana Teste Lima');
    // Então
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Participante' })).toBeVisible();
    cartao = await fecharEAbrir(cartao, abrir);
    await expect(cartao.getByRole('button', { name: 'Ana Teste Lima, Participante' })).toBeVisible();
  });

  test('dada uma anotação, quando a compartilha pela bolinha com "+", então a pessoa fica na anotação', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    await page.getByRole('textbox', { name: 'Título' }).fill('Roteiro da reunião');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    let cartao = cartaoAberto(page);
    await expect(cartao.getByRole('heading', { name: 'Roteiro da reunião', level: 2 })).toBeVisible();
    // Quando
    await porPelaBolinha(page, cartao, 'Compartilhar com mais alguém', 'bru', 'Bruno Exemplo Souza');
    // Então
    await expect(cartao.getByRole('button', { name: 'Bruno Exemplo Souza, Compartilhada' })).toBeVisible();
    cartao = await fecharEAbrir(cartao, async () => {
      await page.goto('/documentos/');
      await page.getByRole('row').filter({ hasText: 'Roteiro da reunião' }).click();
      const aberto = cartaoAberto(page);
      await expect(aberto.getByRole('heading', { name: 'Roteiro da reunião', level: 2 })).toBeVisible();
      return aberto;
    });
    await expect(cartao.getByRole('button', { name: 'Bruno Exemplo Souza, Compartilhada' })).toBeVisible();
  });

  test('dado um cartão que a pessoa só lê, quando abre, então não há bolinha com "+" nem como trocar o responsável', async ({ page }) => {
    // Dado: toda a equipe vê os cartões, e o Bruno não está na demanda
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    // Então
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button', { name: 'Pôr colaborador' })).toHaveCount(0);
    // O Mateus responde pela demanda (a do contrato de registro de marca, na semente): a ficha dele abre, sem como trocá-lo.
    await equipe.getByRole('button', { name: 'Mateus Freitas Gonçalves, Responsável' }).click();
    const ficha = page.getByRole('dialog', { name: 'Mateus Freitas Gonçalves' });
    await expect(ficha).toBeVisible();
    await expect(ficha.getByText('Responsável', { exact: true })).toBeVisible();
    await expect(ficha.getByRole('button', { name: 'Trocar o responsável' })).toHaveCount(0);
  });
});
