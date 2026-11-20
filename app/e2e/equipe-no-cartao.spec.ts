// A equipe mudada no topo do cartão (#356). A regra mudou (#388, pedido do dono): o clique numa bolinha não tira nem troca mais na
// hora; ele abre um menu com o nome, o papel e as ações. No do responsável, "Trocar o responsável" abre a busca de sempre; no de
// um participante, "Tornar responsável" (o de antes continua no item) e "Tirar" (com Desfazer); nos dois, "Ver perfil". A bolinha
// com "+" põe alguém da equipe. O nome de cada um aparece na dica. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício: a tarefa "Pedir documentos ao cliente" é do Bruno, sem participantes; "Renovar a procuração" é
// da Ana, que a criou, com o Mateus de participante; a demanda "Busca de anterioridade" não tem colaboradores e não tem o Bruno
// (estagiário, não é administrador); a "Reunião de equipe" é do Mateus, sem participantes. Quem está logado é o Mateus (master).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirMenuDaBolinha, abrirSecao, acaoDaBolinha, adicionarParticipante, entrarComo } from './ajudantes';

/** O cartão aberto (a janela com o título); a busca do "+" e a da troca do responsável também são janelas, sem título. */
const cartaoAberto = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
/** O nome da bolinha do responsável. */
const doResponsavel = (nome: string) => `${nome}, Responsável`;

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

/** A bolinha de alguém na equipe do cartão, pelo nome dela ("Ana Teste Lima, Participante"). */
const bolinha = (cartao: Locator, nome: string) => cartao.getByRole('group', { name: 'Equipe', exact: true }).getByRole('button', { name: nome, exact: true });

test.describe('Equipe no topo do cartão de tarefa', () => {
  test('dada uma tarefa sem participantes, quando abre, então aparecem o responsável e a bolinha com "+", e o nome aparece na dica', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    // Então
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button')).toHaveCount(2);
    await expect(equipe.getByRole('button').first()).toHaveAccessibleName(doResponsavel('Bruno Exemplo Souza'));
    await expect(equipe.getByRole('button').last()).toHaveAccessibleName('Pôr participante');
    await expect(equipe.getByRole('button').first()).toHaveAttribute('data-dica', 'Bruno Exemplo Souza · Responsável');
  });

  test('quando põe alguém pela bolinha com "+", então a busca mostra só os nomes de quem ainda pode entrar, e ele fica na tarefa, com a mudança no histórico', async ({ page }) => {
    // Dado
    let cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Pôr participante' }).click();
    // Então: só a equipe ativa, sem o responsável (a Carla está desativada), e só os nomes
    await expect(page.getByRole('dialog', { name: 'Pôr participante' }).getByRole('list', { name: 'Equipe' }).getByRole('button'))
      .toHaveText(['Ana Teste Lima', 'Mateus Freitas Gonçalves']);
    // Quando
    await page.getByRole('dialog', { name: 'Pôr participante' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    // Então
    await expect(page.getByText('Ana Teste Lima agora está na tarefa.')).toBeVisible();
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante')).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Pedir documentos ao cliente'));
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante')).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Participantes/).last()).toBeVisible();
    await expect(cartao).toContainText('Ana Teste Lima');
  });

  test('dada a busca do "+" aberta, então os nomes ficam um embaixo do outro, alinhados à esquerda', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Pôr participante' }).click();
    // Então: o começo de cada nome está na mesma linha vertical (antes, cada um ficava centralizado, num recuo diferente)
    const nomes = page.getByRole('dialog', { name: 'Pôr participante' }).getByRole('list', { name: 'Equipe' }).getByRole('button');
    const inicios = await nomes.evaluateAll(botoes => botoes.map(b => {
      const r = document.createRange();
      r.selectNodeContents(b);
      return Math.round(r.getBoundingClientRect().left);
    }));
    expect(new Set(inicios).size).toBe(1);
  });

  test('quando clica na bolinha de um participante, então abre o menu com o nome e o papel, e ninguém sai da tarefa', async ({ page }) => {
    // Dado: o Mateus participa de "Renovar a procuração"
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    const menu = await abrirMenuDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante');
    // Então: na própria bolinha, "Sair da tarefa" no lugar de "Tirar"
    await expect(menu).toContainText('Mateus Freitas Gonçalves');
    await expect(menu).toContainText('Participante');
    await expect(menu.getByRole('menuitem')).toHaveText(['Tornar responsável', 'Sair da tarefa', 'Ver perfil']);
    await expect(bolinha(cartao, 'Mateus Freitas Gonçalves, Participante')).toBeVisible();
    await expect(page.getByRole('status').getByText(/saiu da tarefa/)).toHaveCount(0);
  });

  test('dado o menu aberto, quando tecla Esc ou clica fora, então o menu fecha e o foco volta à bolinha', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const doMateus = bolinha(cartao, 'Mateus Freitas Gonçalves, Participante');
    await abrirMenuDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante');
    // Quando
    await page.keyboard.press('Escape');
    // Então: só o menu fecha, e o cartão continua aberto
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(doMateus).toBeFocused();
    await expect(cartao).toBeVisible();
    // Dado
    await abrirMenuDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante');
    // Quando: o clique cai num canto vazio do cartão, fora do menu
    await cartao.click({ position: { x: 4, y: 4 } });
    // Então
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(doMateus).toBeFocused();
  });

  test('quando escolhe "Sair da tarefa" no menu da própria bolinha, então sai na hora e o Desfazer o põe de volta', async ({ page }) => {
    // Dado: o Mateus participa de "Renovar a procuração"
    let cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando: o Mateus é administrador, sai na hora, sem perguntar
    await acaoDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante', 'Sair da tarefa');
    // Então
    await expect(page.getByText('Mateus Freitas Gonçalves saiu da tarefa.')).toBeVisible();
    await expect(bolinha(cartao, 'Mateus Freitas Gonçalves, Participante')).toHaveCount(0);
    // E o Desfazer do aviso o põe de volta
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    await expect(bolinha(cartao, 'Mateus Freitas Gonçalves, Participante')).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Renovar a procuração'));
    await expect(bolinha(cartao, 'Mateus Freitas Gonçalves, Participante')).toBeVisible();
  });

  test('quando escolhe "Tornar responsável" no menu de um participante, então ele passa a responder e o responsável de antes continua na tarefa; o Desfazer volta tudo', async ({ page }) => {
    // Dado: a Ana responde por "Renovar a procuração", com o Mateus de participante
    let cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await acaoDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante', 'Tornar responsável');
    // Então
    await expect(page.getByText('Responsável pela tarefa: Mateus Freitas Gonçalves. Quem respondia antes continua na tarefa.')).toBeVisible();
    await expect(bolinha(cartao, doResponsavel('Mateus Freitas Gonçalves'))).toBeVisible();
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante')).toBeVisible();
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(bolinha(cartao, doResponsavel('Ana Teste Lima'))).toBeVisible();
    await expect(bolinha(cartao, 'Mateus Freitas Gonçalves, Participante')).toBeVisible();
    // Quando: de novo, e o cartão é aberto outra vez
    await acaoDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante', 'Tornar responsável');
    await expect(bolinha(cartao, doResponsavel('Mateus Freitas Gonçalves'))).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Renovar a procuração'));
    // Então: ficou gravado
    await expect(bolinha(cartao, doResponsavel('Mateus Freitas Gonçalves'))).toBeVisible();
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante')).toBeVisible();
  });

  /** Troca o responsável pelo menu da bolinha dele, que abre a busca. */
  async function trocarOResponsavel(page: Page, cartao: Locator, de: string, busca: string, para: string) {
    await acaoDaBolinha(page, cartao, doResponsavel(de), 'Trocar o responsável');
    const painel = page.getByRole('dialog', { name: 'Trocar o responsável' });
    await painel.getByRole('textbox', { name: 'Buscar na equipe: trocar o responsável' }).fill(busca);
    await painel.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: para }).click();
  }

  test('quando escolhe "Trocar o responsável" no menu do responsável e escolhe outro, então o novo responde pela tarefa', async ({ page }) => {
    // Dado
    let cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    // Quando
    await trocarOResponsavel(page, cartao, 'Bruno Exemplo Souza', 'ana', 'Ana Teste Lima');
    // Então
    await expect(page.getByText('Responsável pela tarefa: Ana Teste Lima.')).toBeVisible();
    await expect(bolinha(cartao, doResponsavel('Ana Teste Lima'))).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirTarefa(page, 'Pedir documentos ao cliente'));
    await expect(bolinha(cartao, doResponsavel('Ana Teste Lima'))).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Responsável:/).last()).toBeVisible();
  });

  test('dado o responsável trocado pelo menu, quando desfaz pelo aviso, então o de antes volta', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await trocarOResponsavel(page, cartao, 'Bruno Exemplo Souza', 'mat', 'Mateus Freitas Gonçalves');
    await expect(bolinha(cartao, doResponsavel('Mateus Freitas Gonçalves'))).toBeVisible();
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(bolinha(cartao, doResponsavel('Bruno Exemplo Souza'))).toBeVisible();
  });

  test('dado quem não pode ficar fora da tarefa, quando escolhe "Sair da tarefa" no menu da própria bolinha, então confirma a saída e o cartão fecha', async ({ page }) => {
    // Dado: o Mateus põe o Bruno em "Renovar a procuração", que não é dele nem está numa demanda do Bruno
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await porPelaBolinha(page, cartao, 'Pôr participante', 'bru', 'Bruno Exemplo Souza');
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Participante')).toBeVisible();
    await entrarComo(page, 'u-bruno');
    const doBruno = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await acaoDaBolinha(page, doBruno, 'Bruno Exemplo Souza, Participante', 'Sair da tarefa');
    const confirmacao = page.getByRole('dialog', { name: 'Sair da tarefa?' });
    await expect(confirmacao).toContainText('você pode deixar de ver este cartão');
    await confirmacao.getByRole('button', { name: 'Sair da tarefa' }).click();
    // Então
    await expect(page.getByText('Você saiu da tarefa, e a saída ficou no histórico.')).toBeVisible();
    await expect(cartaoAberto(page)).toHaveCount(0);
  });
});

test.describe('Equipe no topo dos outros cartões', () => {
  test('dada uma demanda, quando põe um colaborador pela bolinha com "+" e escolhe "Tirar da demanda" no menu dele, então ele entra e sai, com o aviso e o Desfazer', async ({ page }) => {
    // Dado
    const abrir = () => abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    let cartao = await abrir();
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'bru', 'Bruno Exemplo Souza');
    // Então
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Colaborador')).toBeVisible();
    cartao = await fecharEAbrir(cartao, abrir);
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Colaborador')).toBeVisible();
    // Quando: o menu do colaborador abre com o nome e o papel, e ninguém sai só por isso
    const menu = await abrirMenuDaBolinha(page, cartao, 'Bruno Exemplo Souza, Colaborador');
    await expect(menu.getByRole('menuitem')).toHaveText(['Tornar responsável', 'Tirar da demanda', 'Ver perfil']);
    await menu.getByRole('menuitem', { name: 'Tirar da demanda' }).click();
    // Então
    await expect(page.getByText('Bruno Exemplo Souza saiu da demanda.')).toBeVisible();
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Colaborador')).toHaveCount(0);
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Colaborador')).toBeVisible();
  });

  test('dado o menu de um colaborador, quando escolhe "Ver perfil", então abre o perfil profissional dele (o Mateus é administrador)', async ({ page }) => {
    // Dado
    const cartao = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'ana', 'Ana Teste Lima');
    // Quando
    await acaoDaBolinha(page, cartao, 'Ana Teste Lima, Colaborador', 'Ver perfil');
    // Então
    await expect(page).toHaveURL(/\/equipe\/perfil\/\?id=/);
    await expect(page.getByRole('heading', { name: /Ana Teste Lima/, level: 1 })).toBeVisible();
  });

  test('dado um processo, quando põe um colaborador pela bolinha com "+", então ele fica no processo', async ({ page }) => {
    // Dado
    const abrir = () => abrirPelaTabela(page, '/processos/judicial/', 'JOSÉ DA SILVA TESTE');
    let cartao = await abrir();
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr colaborador', 'ana', 'Ana Teste Lima');
    // Então
    await expect(bolinha(cartao, 'Ana Teste Lima, Colaborador')).toBeVisible();
    cartao = await fecharEAbrir(cartao, abrir);
    await expect(bolinha(cartao, 'Ana Teste Lima, Colaborador')).toBeVisible();
  });

  test('dado um compromisso, quando põe um participante pela bolinha com "+", então ele fica no compromisso', async ({ page }) => {
    // Dado
    const abrir = () => abrirPelaTabela(page, '/agenda/', 'Reunião de equipe');
    let cartao = await abrir();
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr participante', 'ana', 'Ana Teste Lima');
    // Então
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante')).toBeVisible();
    cartao = await fecharEAbrir(cartao, abrir);
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante')).toBeVisible();
  });

  test('dada uma anotação, quando a compartilha pela bolinha com "+", então a pessoa fica na anotação', async ({ page }) => {
    // Dado: a anotação nova abre na janela da anotação e vai ao banco ao escrever o título (#369)
    await page.goto('/documentos/nova/');
    await page.getByRole('textbox', { name: 'Título' }).fill('Roteiro da reunião');
    await page.getByRole('textbox', { name: 'Título' }).press('Enter');
    // (gravada, ela ganha o endereço dela: é ele que o recarregar abre, no fim)
    await expect(page).toHaveURL(/\/documentos\/\?id=/);
    const anotacao = page.getByRole('dialog', { name: 'Anotação', exact: true });
    await expect(anotacao.getByRole('heading', { name: 'Roteiro da reunião', level: 2 })).toBeVisible();
    // Quando
    await porPelaBolinha(page, anotacao, 'Compartilhar com mais alguém', 'bru', 'Bruno Exemplo Souza');
    // Então
    await expect(bolinha(anotacao, 'Bruno Exemplo Souza, Compartilhada')).toBeVisible();
    await page.reload();
    await expect(bolinha(page.getByRole('dialog', { name: 'Anotação', exact: true }), 'Bruno Exemplo Souza, Compartilhada')).toBeVisible();
  });

  test('dado um cartão que a pessoa só lê, quando abre, então as bolinhas mostram o nome na dica, sem "+" e sem menu', async ({ page }) => {
    // Dado: toda a equipe vê os cartões, e o Bruno não está na demanda
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirPelaTabela(page, '/demandas/', 'Busca de anterioridade');
    // Então
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button')).toHaveCount(0);
    // O Mateus responde pela demanda (a do contrato de registro de marca, na semente): a bolinha dele só mostra o nome.
    const mateus = equipe.getByRole('img', { name: 'Mateus Freitas Gonçalves, Responsável' });
    await expect(mateus).toHaveAttribute('data-dica', 'Mateus Freitas Gonçalves · Responsável');
    await mateus.click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Trocar o responsável' })).toHaveCount(0);
  });
});

// No contrato, cada participante tem o seu % da divisão: quem entra pela bolinha com "+" fica com 0% (decisão do dono, 18/11), e o
// % se muda em Editar. Na semente, o contrato de MARIA APARECIDA EXEMPLO é da Ana (advogada, administradora), sem participantes.
test.describe('Equipe no topo do cartão do contrato', () => {
  const abrirContrato = (page: Page) => abrirPelaTabela(page, '/contratos/', 'MARIA APARECIDA EXEMPLO');
  /** O nome da bolinha do responsável do contrato. */
  const doAdvogado = (nome: string) => `${nome}, Advogado responsável`;

  test('quando põe o Bruno pela bolinha com "+", então ele entra com 0% na divisão, e a mudança fica no histórico', async ({ page }) => {
    // Dado
    let cartao = await abrirContrato(page);
    // Quando
    await porPelaBolinha(page, cartao, 'Pôr participante', 'bru', 'Bruno Exemplo Souza');
    // Então
    await expect(page.getByText('Bruno Exemplo Souza agora participa do contrato, com 0% na divisão. O % se muda em Editar.')).toBeVisible();
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Participante · 0%')).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirContrato(page));
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Participante · 0%')).toBeVisible();
    await abrirSecao(cartao, 'Honorários');
    await expect(cartao.getByText('BRUNO EXEMPLO SOUZA (0%)')).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText('Participantes: BRUNO EXEMPLO SOUZA (0%)')).toBeVisible();
  });

  test('dado o Bruno, participante que não é advogado, quando abre o menu dele, então "Tornar responsável" não aparece', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    await porPelaBolinha(page, cartao, 'Pôr participante', 'bru', 'Bruno Exemplo Souza');
    // Quando
    const menu = await abrirMenuDaBolinha(page, cartao, 'Bruno Exemplo Souza, Participante · 0%');
    // Então
    await expect(menu.getByRole('menuitem')).toHaveText(['Tirar do contrato', 'Ver perfil']);
  });

  test('dado o Mateus, participante advogado, quando escolhe "Tornar responsável", então ele passa a responder e a Ana continua no contrato como participante', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    await porPelaBolinha(page, cartao, 'Pôr participante', 'mat', 'Mateus Freitas Gonçalves');
    // Quando
    await acaoDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Participante · 0%', 'Tornar responsável');
    // Então
    await expect(page.getByText('Advogado responsável pelo contrato: Mateus Freitas Gonçalves. Quem respondia antes continua no contrato como participante.')).toBeVisible();
    await expect(bolinha(cartao, doAdvogado('Mateus Freitas Gonçalves'))).toBeVisible();
    await expect(bolinha(cartao, 'Ana Teste Lima, Participante · 0%')).toBeVisible();
  });

  test('dado um participante com 10% posto em Editar, quando escolhe "Tirar do contrato" no menu dele e desfaz, então ele volta com os 10%', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await adicionarParticipante(cartao, 'bru', 'Bruno Exemplo Souza');
    await cartao.getByRole('textbox', { name: '% do participante 1' }).fill('10');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Quando
    await acaoDaBolinha(page, cartao, 'Bruno Exemplo Souza, Participante · 10%', 'Tirar do contrato');
    // Então
    await expect(page.getByText('Bruno Exemplo Souza saiu do contrato.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Bruno Exemplo Souza, Participante/ })).toHaveCount(0);
    // O aviso de salvar a edição ainda pode estar na tela: o Desfazer da saída é o do aviso mais novo, o último.
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).last().click();
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Participante · 10%')).toBeVisible();
  });

  test('quando escolhe "Trocar o responsável" no menu do responsável, então a busca mostra só os outros advogados, e o escolhido passa a responder pelo contrato', async ({ page }) => {
    // Dado
    let cartao = await abrirContrato(page);
    // Quando
    await acaoDaBolinha(page, cartao, doAdvogado('Ana Teste Lima'), 'Trocar o responsável');
    const painel = page.getByRole('dialog', { name: 'Trocar o responsável' });
    // Então: o Bruno é estagiário, e a Carla, desativada, não é advogada
    await expect(painel.getByRole('list', { name: 'Equipe' }).getByRole('button')).toHaveText(['Mateus Freitas Gonçalves']);
    await painel.getByRole('button', { name: 'Mateus Freitas Gonçalves' }).click();
    await expect(page.getByText('Advogado responsável pelo contrato: Mateus Freitas Gonçalves.')).toBeVisible();
    cartao = await fecharEAbrir(cartao, () => abrirContrato(page));
    await expect(bolinha(cartao, doAdvogado('Mateus Freitas Gonçalves'))).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText('Responsável: Ana Teste Lima → Mateus Freitas Gonçalves')).toBeVisible();
  });

  test('dado o Bruno, participante que não cadastrou o contrato nem o administra, quando abre o menu da própria bolinha, então o motivo aparece no lugar do "Sair"', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    await porPelaBolinha(page, cartao, 'Pôr participante', 'bru', 'Bruno Exemplo Souza');
    await expect(bolinha(cartao, 'Bruno Exemplo Souza, Participante · 0%')).toBeVisible();
    await entrarComo(page, 'u-bruno');
    const doBruno = await abrirContrato(page);
    // Quando
    const menu = await abrirMenuDaBolinha(page, doBruno, 'Bruno Exemplo Souza, Participante · 0%');
    // Então: sem a saída que pergunta antes (o contrato não a tem), a ação nem é oferecida
    const motivo = 'Você não pode sair deste contrato: sem estar nele, deixaria de poder alterá-lo. Peça a quem o cadastrou ou a um administrador.';
    await expect(menu).toContainText(motivo);
    await expect(menu.getByRole('menuitem', { name: 'Sair do contrato' })).toHaveCount(0);
  });
});
