// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Tarefas. Na semente do banco fictício, a demanda "Registro de marca" (do contrato de JOSÉ DA SILVA TESTE) tem
// três tarefas: "Pedir documentos ao cliente" (Para fazer, do Bruno), "Emitir a GRU" (Fazendo, do Mauro, com o Bruno)
// e "Organizar a pasta" (Concluída). "Renovar a procuração" é avulsa, da Ana, com o Mauro de participante e o prazo
// vencido. Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, acaoNoMenuDoCartao, alturaParada, entrarComo } from './ajudantes';

/** Abre o cartão de uma tarefa pela tabela e, se pedidas, as seções dele (toda seção começa recolhida). */
async function abrirTarefa(page: Page, titulo: string, ...secoes: string[]) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  for (const secao of secoes) await abrirSecao(page.getByRole('dialog'), secao);
  return page.getByRole('dialog');
}

/** Aperta a tecla do cronômetro. O título do cartão aparece antes de a tela escutar o teclado; o relógio só aparece depois. */
async function apertarT(page: Page, cartao: Locator) {
  await expect(cartao.getByRole('timer')).toBeVisible();
  await page.keyboard.press('t');
}

test.describe('Cadastro de tarefas', () => {
  test('quando a primeira etapa aparece, então as buscas das ligações já estão nela, com a altura dos outros campos (#299)', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    const titulo = page.getByLabel('Título');
    const altura = await alturaParada(titulo);
    // Quando
    await titulo.fill('Mandar a notificação');
    // Então
    expect(await alturaParada(page.getByRole('combobox', { name: 'Demanda' }))).toBe(altura);
    expect(await alturaParada(page.getByRole('combobox', { name: 'Contrato' }))).toBe(altura);
  });

  test('dada uma demanda ligada por engano, quando a pessoa a tira e liga outra, então as pessoas e o contrato são os da demanda certa (#299)', async ({ page }) => {
    // Dado: a demanda errada traz o cliente e o contrato dela
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Mandar a notificação');
    await page.getByRole('combobox', { name: 'Demanda' }).fill('Registro');
    await page.getByRole('option', { name: /D3A1F09C · Registro de marca/ }).click();
    await expect(page.getByText(/MA96-0001/)).toBeVisible();
    // Quando: tira a demanda errada e liga a certa
    await page.getByRole('button', { name: 'Tirar a demanda' }).click();
    // Então: o contrato que veio com ela sai junto
    await expect(page.getByRole('combobox', { name: 'Contrato' })).toBeVisible();
    // Quando
    await page.getByRole('combobox', { name: 'Demanda' }).fill('Notificar');
    await page.getByRole('option', { name: /Notificar o devedor/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: as pessoas são as da demanda certa, e não as da tirada
    const pessoas = page.getByRole('group', { name: 'Pessoas ligadas' });
    await expect(pessoas).toContainText('MARIA APARECIDA EXEMPLO');
    await expect(pessoas).not.toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando a pessoa cadastra uma tarefa pelas duas etapas, ligada a uma demanda, então ela entra em "Para fazer", com tudo no cartão', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await expect(page.getByText('Passo 1 de 2')).toBeVisible();
    // Quando: na primeira etapa, a tarefa, o prazo e a demanda (que traz os clientes dela para as pessoas)
    await page.getByLabel('Título').fill('Mandar a notificação');
    await page.getByRole('textbox', { name: 'Prazo' }).fill('10112030');
    await page.getByRole('combobox', { name: 'Demanda' }).fill('Notificar');
    await page.getByRole('option', { name: /Notificar o devedor/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('MARIA APARECIDA EXEMPLO');
    // Quando: na etapa das pessoas, igual à de antes
    await page.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Adicionar participante' }).click();
    await page.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    await page.getByRole('button', { name: 'Adicionar pessoa' }).click();
    await page.getByRole('textbox', { name: 'Pessoa ligada 2', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Mandar a notificação' })).toBeVisible();
    await expect(cartao).toContainText('Prazo: 10/11/2030');
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button', { name: 'Mauro Teixeira Duarte, Responsável', exact: true })).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Ana Teste Lima, Participante', exact: true })).toBeVisible();
    await abrirSecao(cartao, 'Pessoas');
    await abrirSecao(cartao, 'Demanda');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toBeVisible();
    await expect(cartao.getByRole('link', { name: /Notificar o devedor/ })).toContainText('Demanda');
    await expect(cartao.getByLabel('Situação da tarefa').getByRole('option', { selected: true })).toHaveText('PARA FAZER');
  });

  test('quando falta o título, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Dê um título à tarefa.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A tarefa', level: 2 })).toBeVisible();
  });

  test('quando a tarefa nasce no cartão de uma demanda, então a demanda, os clientes e o contrato dela já vêm escolhidos', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).click();
    // Quando
    await abrirSecao(page.getByRole('dialog'), 'Tarefas');
    await page.getByRole('dialog').getByRole('link', { name: 'Nova tarefa desta demanda' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Título').fill('Anexar os documentos');
    // Então: a demanda e o contrato já na primeira etapa (#299)
    await expect(cadastro.getByText(/D3A1F09C · Registro de marca/)).toBeVisible();
    await expect(cadastro.getByText(/MA96-0001/)).toBeVisible();
    // Quando
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(cadastro.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('JOSÉ DA SILVA TESTE');
  });
});

test.describe('Tarefa nascida no cartão da demanda (#279)', () => {
  /** Abre o cartão da demanda pela tabela de Demandas, sem abrir nenhuma seção. */
  async function abrirDemanda(page: Page, titulo: string) {
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: titulo }).first().click();
    return page.getByRole('dialog');
  }

  test('quando a seção Tarefas está recolhida, então o "+" do título já abre o cadastro ligado à demanda', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca');
    await expect(cartao.getByRole('button', { name: /^Tarefas/ })).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await cartao.getByRole('link', { name: 'Nova tarefa desta demanda' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Título').fill('Conferir a procuração');
    // Então
    await expect(cadastro.getByText(/D3A1F09C · Registro de marca/)).toBeVisible();
  });

  test('dada a fase de adaptação, quando quem não participa cria a tarefa pela demanda, então ela fica ligada, com o nome da demanda e o código do contrato', async ({ page }) => {
    // Dado: Bruno não está na demanda "Busca de anterioridade" nem no contrato dela
    await page.goto('/configuracoes/');
    await page.getByRole('checkbox', { name: /Toda a equipe vê e edita tudo/ }).check();
    await expect(page.getByText('Fase de adaptação ligada', { exact: false })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    let cartao = await abrirDemanda(page, 'Busca de anterioridade');
    const antes = Number((await cartao.getByRole('button', { name: /^Tarefas/ }).innerText()).replace(/\D/g, '') || 0);
    // Quando
    await cartao.getByRole('link', { name: 'Nova tarefa desta demanda' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Título').fill('Pesquisar marcas parecidas');
    // Então: a demanda aparece pelo nome, e o contrato pelo código (e não só "Contrato ligado")
    await expect(cadastro.getByText(/· Busca de anterioridade/)).toBeVisible();
    await expect(cadastro.getByText('Contrato ligado')).toHaveCount(0);
    // Quando
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar tarefa' }).click();
    await expect(page.getByText(/Tarefa \w+ cadastrada\./)).toBeVisible();
    cartao = await abrirDemanda(page, 'Busca de anterioridade');
    // Então: a tarefa está na lista da demanda e no contador da seção
    await expect(cartao.getByRole('button', { name: /^Tarefas/ })).toContainText(String(antes + 1));
    await abrirSecao(cartao, 'Tarefas');
    await expect(cartao.getByText('Pesquisar marcas parecidas')).toBeVisible();
  });
});

test.describe('Quadro de tarefas', () => {
  // Tela larga: as colunas "Fazendo" e "Concluída" ficam as duas à vista (com as duas esperas da #314 entre elas), para arrastar de uma para a outra.
  test.use({ viewport: { width: 2700, height: 1000 } });

  test('quando a pessoa alterna entre quadro e tabela, então vê as mesmas tarefas', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Renovar a procuração' })).toContainText('PARA FAZER');
    await expect(page.getByRole('row').filter({ hasText: 'Emitir a GRU' })).toContainText('FAZENDO');
  });

  test('quando a última tarefa da demanda é arrastada para "Concluída", então o sistema oferece concluir a demanda, e só move com o aceite', async ({ page }) => {
    // Dado: "Organizar a pasta" já está concluída; falta "Pedir documentos ao cliente", que vai pelo cartão
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await cartao.getByLabel('Situação da tarefa').selectOption({ label: 'CONCLUÍDA' });
    await expect(page.getByRole('dialog', { name: 'Concluir a demanda?' })).toHaveCount(0);
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Kanban' }).click();
    const concluida = page.getByRole('list', { name: 'Concluída', exact: true });
    const gru = page.getByRole('list', { name: 'Fazendo', exact: true }).getByRole('listitem').filter({ hasText: 'Emitir a GRU' });
    // Quando
    await gru.dragTo(concluida);
    const pergunta = page.getByRole('dialog', { name: 'Concluir a demanda?' });
    await expect(pergunta).toContainText('Registro de marca');
    await pergunta.getByRole('button', { name: 'Concluir a demanda' }).click();
    // Então
    await expect(page.getByText('Demanda D3A1F09C foi para "Concluído".')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Concluída', exact: true }).getByRole('listitem').filter({ hasText: 'Emitir a GRU' })).toBeVisible();
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' })).toContainText('Concluído');
  });

  test('dada uma tarefa vencida, quando é arrastada para "Concluída", então o selo fica verde na hora, sem recarregar; e volta a vermelho ao sair', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const paraFazer = page.getByRole('list', { name: 'Para fazer', exact: true });
    const concluida = page.getByRole('list', { name: 'Concluída', exact: true });
    await expect(paraFazer.getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toContainText('Prazo vencido');
    // Quando
    await paraFazer.getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(concluida);
    // Então
    const naConcluida = concluida.getByRole('listitem').filter({ hasText: 'Renovar a procuração' });
    await expect(naConcluida).toContainText('Concluída · Prazo:');
    await expect(naConcluida).not.toContainText('Prazo vencido');
    // Quando: volta para "Para fazer"
    await naConcluida.dragTo(paraFazer);
    // Então
    await expect(paraFazer.getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toContainText('Prazo vencido');
  });
});

test.describe('Cadastro numa janela', () => {
  test('quando a pessoa clica em "Nova tarefa" no quadro, então o cadastro abre numa janela sobre ele e, ao salvar, mostra o cartão da tarefa nova', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Quando
    await page.getByRole('link', { name: 'Nova tarefa' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(page.getByRole('list', { name: 'Para fazer', exact: true })).toBeVisible();
    await cadastro.getByLabel('Título').fill('Ligar para o cliente');
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    await expect(cadastro).toHaveCount(0);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Ligar para o cliente', level: 2 })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Ligar para o cliente' })).toBeVisible();
  });

  test('quando a pessoa fecha a janela do cadastro, então volta à página de onde veio, sem salvar', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('link', { name: 'Nova pessoa' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(cadastro.getByRole('heading', { name: 'Qual é o tipo de cadastro?' })).toBeVisible();
    // Quando
    await cadastro.getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(cadastro).toHaveCount(0);
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });
});

test.describe('Editar no cartão', () => {
  // Desde a #361, o prazo, a hora, o lembrete e o início se mudam no grupo das datas, e não mais pelo lápis: a etapa "A tarefa",
  // que só tinha eles, o título e a descrição, sai do lápis. Aqui o lápis muda o responsável.
  test('quando a pessoa clica no lápis, muda o responsável e salva, então o cartão mostra a mudança sem sair dele, e dá para desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    await expect(cartao.getByRole('status').filter({ hasText: 'Modo de edição' })).toBeVisible();
    await expect(edicao.getByRole('heading', { name: 'A tarefa' })).toHaveCount(0);
    await expect(edicao.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await expect(edicao.getByRole('heading', { name: 'Diligência, demanda, contrato e processo' })).toBeVisible();
    await edicao.getByLabel(/Responsável/).selectOption({ label: 'Bruno Exemplo Souza' });
    await edicao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(edicao).toHaveCount(0);
    await expect(cartao.getByText('Modo de edição')).toHaveCount(0);
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Bruno Exemplo Souza, Responsável', exact: true })).toHaveText('BS');
    await expect(page.getByRole('status').getByRole('button', { name: 'Desfazer' })).toBeVisible();
  });

  // Desde a #346, o título se muda no próprio lugar, e não mais pelo lápis: o título em branco é recusado ali mesmo.
  test('quando a pessoa apaga o título no próprio lugar e aperta Enter, então o erro aparece e o campo continua aberto; Esc deixa como estava', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Renovar a procuração', exact: true }).click();
    const campo = cartao.getByRole('textbox', { name: 'Título' });
    // Quando
    await campo.fill('');
    await campo.press('Enter');
    // Então
    await expect(page.getByText('Dê um título à tarefa.')).toBeVisible();
    await expect(campo).toBeFocused();
    // Quando
    await campo.press('Escape');
    // Então
    await expect(campo).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
  });
});

test.describe('Título e descrição no próprio lugar (#346)', () => {
  test('dada uma tarefa que a pessoa pode alterar, quando clica no título, muda e aperta Enter, então o título muda ali mesmo e continua assim ao fechar e abrir o cartão', async ({ page }) => {
    // Dado
    let cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await cartao.getByRole('button', { name: 'Renovar a procuração', exact: true }).click();
    const campo = cartao.getByRole('textbox', { name: 'Título' });
    // Então: o título vira campo ali mesmo, com o texto dele, e não há outro título
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue('Renovar a procuração');
    await expect(cartao.getByRole('heading', { level: 2 })).toHaveCount(1);
    // Quando
    await campo.fill('Renovar a procuração do José');
    await campo.press('Enter');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração do José', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
    // E continua assim ao fechar e abrir o cartão
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirTarefa(page, 'Renovar a procuração do José', 'Histórico de alterações');
    await expect(cartao.getByText(/Título:/).first()).toBeVisible();
  });

  test('dado o título em edição, quando a pessoa clica fora, então salva; e quando aperta Esc, então desfaz, sem fechar o cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Renovar a procuração', exact: true }).click();
    const campo = cartao.getByRole('textbox', { name: 'Título' });
    // Quando: Esc
    await campo.fill('Título que não fica');
    await campo.press('Escape');
    // Então
    await expect(campo).toHaveCount(0);
    await expect(cartao).toBeVisible();
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
    await expect(page.getByText('Tarefa atualizada.')).toHaveCount(0);
    // Quando: clica fora
    await cartao.getByRole('button', { name: 'Renovar a procuração', exact: true }).click();
    await campo.fill('Renovar a procuração já');
    await cartao.getByText('Criada em', { exact: true }).click();
    // Então
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração já', level: 2 })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
  });

  test('dada uma tarefa que a pessoa pode alterar, quando clica na descrição, então ela vira a caixa de texto formatado ali mesmo, com Salvar e Cancelar, e o salvo continua ao reabrir', async ({ page }) => {
    // Dado: "Renovar a procuração" tem a descrição "A procuração vence este mês."
    let cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await cartao.getByText('A procuração vence este mês.').click();
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    // Então
    await expect(caixa).toBeFocused();
    // Desde a #433, a caixa é o editor das anotações (sem caixa de texto comum): o texto se confere pelo que ela mostra.
    await expect(caixa).toHaveText('A procuração vence este mês.');
    await expect(cartao.getByRole('button', { name: 'Negrito (Ctrl+B)' })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    // Quando: Cancelar desfaz (desde a revisão da #433, com mudança, ele pergunta antes, como o Esc: regra nova)
    await caixa.fill('Texto que não fica');
    await cartao.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('dialog', { name: 'Descartar as mudanças?' }).getByRole('button', { name: 'Descartar' }).click();
    // Então
    await expect(caixa).toHaveCount(0);
    await expect(cartao.getByText('A procuração vence este mês.')).toBeVisible();
    // Quando: Salvar grava (desde a #385, sem o botão "Mudar a descrição": o clique no texto abre a edição)
    await cartao.getByText('A procuração vence este mês.').click();
    await caixa.fill('A procuração vence **este mês**.');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(caixa).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(cartao.locator('strong', { hasText: 'este mês' })).toBeVisible();
    // E continua assim ao fechar e abrir o cartão
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirTarefa(page, 'Renovar a procuração');
    await expect(cartao.locator('strong', { hasText: 'este mês' })).toBeVisible();
    await expect(cartao.getByText('**este mês**')).toHaveCount(0);
  });

  test('dada a descrição lida, quando a pessoa clica nela, então o texto não sai do lugar: a barra de formatação já estava ali (#433)', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const barra = cartao.getByRole('toolbar', { includeHidden: true });
    const barraAntes = await barra.boundingBox();
    const textoAntes = await cartao.getByRole('group', { name: 'Descrição' }).boundingBox();
    // Quando
    await cartao.getByText('A procuração vence este mês.').click();
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    await expect(caixa).toBeFocused();
    // Então: a barra e o texto continuam na mesma altura
    const barraDepois = await cartao.getByRole('toolbar', { name: 'Formatação do texto' }).boundingBox();
    const textoDepois = await caixa.boundingBox();
    expect(Math.abs(barraDepois!.y - barraAntes!.y)).toBeLessThan(1);
    expect(Math.abs(textoDepois!.y - textoAntes!.y)).toBeLessThan(1);
  });

  test('dada a descrição mudada e não salva, quando a pessoa fecha o cartão, então o SEMPER pergunta antes', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByText('A procuração vence este mês.').click();
    await cartao.getByRole('textbox', { name: 'Descrição' }).fill('Uma ideia que não pode se perder.');
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(pergunta).toBeVisible();
    await pergunta.getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(cartao.getByRole('textbox', { name: 'Descrição' })).toHaveText('Uma ideia que não pode se perder.');
  });

  test('dada a descrição de uma tarefa, quando a pessoa clica no começo do texto e escreve, então escreve ali mesmo, sem caixa com borda e com o texto no mesmo lugar (#433)', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const lido = cartao.getByText('A procuração vence este mês.');
    await alturaParada(lido);   // o cartão chega deslizando: mede depois de ele parar
    const antes = (await lido.boundingBox())!;
    // Quando: clica logo antes da primeira letra
    await lido.click({ position: { x: 1, y: antes.height / 2 } });
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    // Então: o texto continua na mesma coluna, no mesmo tamanho de letra, e nada desenha uma caixa em volta dele
    await expect(caixa).toBeFocused();
    const depois = (await caixa.boundingBox())!;
    expect(Math.abs(depois.x - antes.x)).toBeLessThanOrEqual(1);
    const letra = (el: Element) => getComputedStyle(el).fontSize;
    expect(await caixa.evaluate(letra)).toBe(await lido.evaluate(letra));
    const bordas = await caixa.evaluate(el => {
      const vistas: string[] = [];
      for (let e: Element | null = el; e && !e.matches('[role="group"], [role="dialog"]') && vistas.length < 4; e = e.parentElement) {
        const s = getComputedStyle(e);
        vistas.push(s.borderTopWidth, s.borderLeftWidth, s.outlineStyle === 'none' ? '0px' : s.outlineWidth);
      }
      return [...new Set(vistas)];
    });
    expect(bordas).toEqual(['0px']);
    await expect(cartao.getByText('Ctrl+Enter salva')).toHaveCount(0);
    // Quando: escreve, e o que escreve entra onde clicou, e não no fim
    await page.keyboard.type('Hoje: ');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(caixa).toHaveCount(0);
    await expect(cartao.getByText('Hoje: A procuração vence este mês.')).toBeVisible();
  });

  test('dada a descrição mudada, quando a pessoa aperta Esc, então o SEMPER pergunta antes de descartar e, descartando, o texto gravado volta (#433)', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByText('A procuração vence este mês.').click();
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    await expect(caixa).toBeFocused();
    await page.keyboard.type(' Ligar antes.');
    // Quando
    await page.keyboard.press('Escape');
    // Então: pergunta, e quem desiste de descartar continua escrevendo
    const pergunta = page.getByRole('dialog', { name: 'Descartar as mudanças?' });
    await expect(pergunta).toBeVisible();
    await pergunta.getByRole('button', { name: 'Cancelar' }).click();
    await expect(pergunta).toHaveCount(0);
    await expect(caixa).toContainText('Ligar antes.');
    // Quando: Esc de novo, e descarta
    await caixa.press('Escape');
    await pergunta.getByRole('button', { name: 'Descartar' }).click();
    // Então: o cartão continua aberto, com o texto gravado
    await expect(caixa).toHaveCount(0);
    await expect(cartao.getByText('A procuração vence este mês.')).toBeVisible();
    await expect(page.getByText('Tarefa atualizada.')).toHaveCount(0);
  });

  test('dado o lápis do cartão, quando a pessoa o usa, então o formulário não repete o título, a descrição e as datas, e salvar não os muda', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const prazo = await cartao.getByRole('button', { name: /^Datas: / }).textContent();
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    // Então: o título e a descrição (#346) e o prazo, a hora, o lembrete e o início (#361) ficam só no cartão
    await expect(edicao.getByLabel(/Responsável/)).toBeVisible();
    await expect(edicao.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
    await expect(edicao.getByRole('textbox', { name: 'Descrição' })).toHaveCount(0);
    for (const rotulo of ['Prazo', 'Hora', 'Lembrete', 'Data de início']) await expect(edicao.getByLabel(rotulo, { exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toHaveCount(1);
    // Quando
    await edicao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(edicao).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
    await expect(cartao.getByText('A procuração vence este mês.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Datas: / })).toHaveText(prazo!);
  });

  test('dado o cadastro de uma tarefa nova, quando a pessoa o abre, então o título e a descrição continuam nele', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/nova/');
    // Então
    await expect(page.getByRole('textbox', { name: 'Título' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Descrição' })).toBeVisible();
  });

  test('dada uma tarefa que a pessoa só lê, quando clica no título ou na descrição, então nada vira campo', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno vê "Renovar a procuração", em que não está, só para ler
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    // Quando
    await cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 }).click();
    await cartao.getByText('A procuração vence este mês.').click();
    // Então
    await expect(cartao.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
    await expect(cartao.getByRole('textbox', { name: 'Descrição' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Renovar a procuração', exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Mudar a descrição' })).toHaveCount(0);
    // E o texto não recebe o foco do teclado, como o de quem pode mudar (#385)
    await expect(cartao.getByRole('group', { name: 'Descrição', exact: true })).toHaveCount(0);
  });
});

/** O último botão dos dados (as faixas das datas e do tempo), o que vem logo antes da descrição na ordem do Tab. */
const ultimoDosDados = (cartao: Locator) => cartao.getByRole('group', { name: 'Datas do cartão', exact: true }).or(cartao.getByRole('group', { name: 'Tempo', exact: true }))
  .getByRole('button').last();

test.describe('A descrição no topo do cartão (#385)', () => {
  test('dada uma tarefa com descrição, quando o cartão abre, então não há botão "Mudar a descrição" e há um espaço maior entre os dados e a descrição', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Então
    await expect(cartao.getByText('A procuração vence este mês.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Mudar a descrição' })).toHaveCount(0);
    // E a descrição vem depois dos dados (#397): o vão entre a faixa do tempo, o fim dos dados (desde a #399, sem os botões rápidos),
    // e o texto da descrição é, no mínimo, a medida da variável de estilo
    const vao = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vao-dos-dados-a-descricao')));
    expect(vao).toBeGreaterThan(0);
    const dados = (await cartao.getByRole('group', { name: 'Tempo', exact: true }).boundingBox())!;
    const descricao = (await cartao.getByText('A procuração vence este mês.').boundingBox())!;
    expect(descricao.y - (dados.y + dados.height)).toBeGreaterThanOrEqual(vao);
  });

  test('dado quem usa só o teclado, quando chega à descrição com Tab e tecla Enter, então a edição abre; ao cancelar, o foco volta ao texto', async ({ page }) => {
    // Dado: o foco no último botão dos dados (as datas e o tempo), logo acima da descrição (#397; desde a #399, sem os botões rápidos)
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // O tempo da tarefa chega depois do cartão: enquanto ele carrega, o último botão é o do prazo e, quando chega, o "Ajustar meu tempo"
    // entra entre o prazo e a descrição. Espera o tempo chegar, como quem olha o cartão pronto antes de teclar.
    await expect(cartao.getByRole('group', { name: 'Tempo', exact: true }).getByRole('button', { name: 'Ajustar meu tempo' })).toBeVisible();
    await ultimoDosDados(cartao).focus();
    // Quando
    await page.keyboard.press('Tab');
    // Então
    const texto = cartao.getByRole('group', { name: 'Descrição', exact: true });
    await expect(texto).toBeFocused();
    await expect(texto).toHaveAccessibleDescription('Tecle Enter para mudar.');
    // Quando
    await page.keyboard.press('Enter');
    // Então
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    await expect(caixa).toBeFocused();
    await expect(caixa).toHaveText('A procuração vence este mês.');
    // Quando
    await cartao.getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(caixa).toHaveCount(0);
    await expect(texto).toBeFocused();
  });
});

test.describe('Cronômetro da tarefa', () => {
  test('quando a pessoa abre uma tarefa, então o cronômetro não começa sozinho; a tecla T inicia e pausa', async ({ page }) => {
    // Dado: "Renovar a procuração" não tem tempo registrado
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const relogio = cartao.getByRole('timer');
    await page.clock.runFor(30_000);
    await expect(relogio).toHaveText('0:00:00');
    await expect(cartao.getByRole('button', { name: /Iniciar/ })).toHaveAttribute('aria-keyshortcuts', 'T');
    // Quando
    await page.keyboard.press('t');
    await page.clock.runFor(65_000);
    // Então (o relógio de verdade também anda alguns segundos enquanto o teste roda)
    await expect(relogio).toHaveText(/^0:01:0\d$/);
    await expect(cartao.getByText('contando')).toBeVisible();
    await page.keyboard.press('t');
    await expect(cartao.getByText('pausado')).toBeVisible();
    const parado = await relogio.textContent();
    await page.clock.runFor(30_000);
    await expect(relogio).toHaveText(parado!);
    await expect(cartao.getByText('pausado')).toBeVisible();
    await expect(cartao.getByRole('button', { name: /Retomar/ })).toBeVisible();
  });

  test('quando a pessoa digita um T num comentário, então é só a letra, e o cronômetro não começa', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Comentários');
    // Quando
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).pressSequentially('Tudo certo');
    // Então
    await expect(cartao.getByText('pausado')).toBeVisible();
  });

  test('quando uma tarefa está contando numa aba, então as outras mostram no menu, e "Pausar todos" a pausa', async ({ page, context }) => {
    // Dado: a tarefa contando nesta aba
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByRole('button', { name: /Iniciar/ }).click();
    await expect(cartao.getByText('contando')).toBeVisible();
    // Quando: em outra aba
    const outra = await context.newPage();
    await outra.goto('/tarefas/');
    const aviso = outra.getByRole('status').filter({ hasText: '1 tarefa contando' });
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Pausar todos' }).click();
    // Então
    await expect(cartao.getByText('pausado')).toBeVisible();
    await expect(aviso).toHaveCount(0);
  });

  test('quando passam 10 minutos sem mexer e a pessoa responde "Não estava", então o tempo desde o aviso não conta', async ({ page }) => {
    // Dado
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await apertarT(page, cartao);
    await expect(cartao.getByText('contando')).toBeVisible();
    // Quando
    await page.clock.runFor(10 * 60_000);
    const pergunta = page.getByRole('dialog', { name: 'Você ainda está aqui?' });
    await expect(pergunta).toBeVisible();
    await page.clock.runFor(5 * 60_000);
    await pergunta.getByRole('button', { name: 'Não estava' }).click();
    // Então
    await expect(cartao.getByRole('timer')).toHaveText(/^0:10:0\d$/);
  });

  test('quando a pessoa ajusta o próprio tempo com um motivo, então o tempo muda e o ajuste fica registrado', async ({ page }) => {
    // Dado: o Mauro tem 1 h 20 min em "Emitir a GRU"
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    // Quando
    await cartao.getByRole('button', { name: 'Ajustar meu tempo' }).click();
    const janela = page.getByRole('dialog', { name: 'Ajustar meu tempo' });
    await janela.getByLabel('Quanto').fill('-20min');
    await janela.getByLabel('Motivo').fill('Contei a mais');
    await janela.getByRole('button', { name: 'Salvar ajuste' }).click();
    // Então
    await expect(page.getByText('Tempo ajustado: −20 min.')).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('1:00:00');
    // E o ajuste aparece na lista dos registros (#400; antes, numa lista "Ajustes" só dos administradores), com o motivo
    await cartao.getByRole('button', { name: /^Registros de tempo/ }).click();
    await expect(cartao.getByRole('list', { name: 'Registros de tempo' }).getByRole('listitem').filter({ hasText: 'Contei a mais' }))
      .toContainText(/−20 min.*Mauro Teixeira Duarte.*Ajuste/);
  });

  test('quando a tarefa está concluída, então a situação diz "encerrado" e o cartão mostra o esforço da equipe', async ({ page }) => {
    // Quando: "Organizar a pasta" está concluída, com 40 min do Bruno
    const cartao = await abrirTarefa(page, 'Organizar a pasta');
    await apertarT(page, cartao);
    // Então: a situação ao lado do relógio diz "encerrado", com a frase de antes na dica. A regra mudou na revisão da #434: a frase
    // "Tarefa concluída: a contagem encerrou." ficava ao lado de "pausado", repetia (e contradizia) a situação, e saiu da faixa
    const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
    await expect(tempo.getByText('encerrado', { exact: true })).toHaveAttribute('title', 'Tarefa concluída: a contagem encerrou.');
    await expect(tempo.getByText('pausado', { exact: true })).toHaveCount(0);
    await expect(tempo.getByText('Tarefa concluída: a contagem encerrou.')).toHaveCount(0);
    await expect(tempo.getByRole('button', { name: 'Ajustar meu tempo' })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /Iniciar/ })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'contando' })).toHaveCount(0);
    // O total da equipe fica na faixa das datas, como o último dado (#397); o resumo traz a parte de cada um
    await expect(cartao.getByRole('group', { name: 'Datas do cartão', exact: true }).getByRole('group', { name: 'Tempo total' })).toHaveText(/40 min$/);
    await expect(cartao.getByText(/^Da criação à conclusão:/)).toBeVisible();
    await expect(cartao.getByRole('list', { name: 'Parte de cada um' })).toContainText('Bruno Exemplo Souza100%');
  });
});

test.describe('Equipe da tarefa', () => {
  // A regra mudou (pedido do dono, 18/11): a bolinha não abre mais a ficha com o nome, o papel e o link para o cartão da pessoa.
  // O nome aparece na dica, ao passar o mouse e no foco; o clique abre o menu da bolinha (#388), conferido em equipe-no-cartao.spec.ts.
  test('quando a pessoa passa o mouse ou chega pelo Tab numa bolinha da equipe, então vê o nome e o papel na dica', async ({ page }) => {
    // Dado: "Renovar a procuração" é da Ana, com o Mauro de participante
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    const ana = equipe.getByRole('button', { name: 'Ana Teste Lima, Responsável', exact: true });
    const mauro = equipe.getByRole('button', { name: 'Mauro Teixeira Duarte, Participante', exact: true });
    await expect(ana).toHaveText('AL');
    await expect(mauro).toHaveText('MD');
    // Quando
    await ana.hover();
    // Então: a dica é desenhada pelo estilo, com o texto de data-dica
    await expect(ana).toHaveAttribute('data-dica', 'Ana Teste Lima · Responsável');
    await expect.poll(() => ana.evaluate(b => getComputedStyle(b, '::after').opacity)).toBe('1');
    // Quando: pelo teclado (o foco vindo do Tab)
    await mauro.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    // Então
    await expect(mauro).toBeFocused();
    await expect.poll(() => mauro.evaluate(b => getComputedStyle(b, '::after').opacity)).toBe('1');
    await expect(page.getByRole('dialog', { name: 'Ana Teste Lima' })).toHaveCount(0);
  });
});

test.describe('Tarefas ligadas', () => {
  test('quando alguém abre o cartão da demanda, então vê as tarefas dela como checklist, com a situação e o progresso', async ({ page }) => {
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).click();
    // Então
    const tarefas = page.getByRole('dialog').getByRole('region', { name: 'Tarefas da demanda' });
    await abrirSecao(page.getByRole('dialog'), 'Tarefas');
    await expect(tarefas).toContainText('1 de 3 concluídas');
    await expect(tarefas.getByRole('listitem').filter({ hasText: 'Emitir a GRU' })).toContainText('FAZENDO');
    await expect(tarefas.getByRole('checkbox', { name: 'Concluir Organizar a pasta' })).toBeChecked();
    // O nome é o link que abre a tarefa (#298)
    await expect(tarefas.getByRole('link', { name: 'Emitir a GRU', exact: true })).toHaveAttribute('href', /\/tarefas\/\?id=/);
  });

  test('quando a pessoa clica no nome de uma tarefa no checklist da demanda, então o cartão da tarefa abre, e ela não é concluída (#298)', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).click();
    await abrirSecao(page.getByRole('dialog'), 'Tarefas');
    const tarefas = page.getByRole('dialog').getByRole('region', { name: 'Tarefas da demanda' });
    // Então: a caixa e o nome são dois controles, e não há mais o botão de seta
    await expect(tarefas.getByRole('checkbox', { name: 'Concluir Pedir documentos ao cliente' })).not.toBeChecked();
    await expect(tarefas.getByRole('link', { name: /^Abrir a tarefa/ })).toHaveCount(0);
    // Quando
    await tarefas.getByRole('link', { name: 'Pedir documentos ao cliente', exact: true }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    const situacao = page.getByRole('dialog').getByRole('combobox', { name: 'Situação da tarefa' });
    await expect(situacao).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pedir documentos ao cliente' })).toBeVisible();
    await expect(situacao.getByRole('option', { selected: true })).not.toHaveText('Concluída');
  });

  test('quando a pessoa marca as tarefas no checklist da demanda, então elas vão para "Concluída" no quadro, e a última oferece concluir a demanda', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Tarefas');
    const tarefas = cartao.getByRole('region', { name: 'Tarefas da demanda' });
    // Quando
    await tarefas.getByRole('checkbox', { name: 'Concluir Pedir documentos ao cliente' }).check();
    await expect(tarefas).toContainText('2 de 3 concluídas');
    await tarefas.getByRole('checkbox', { name: 'Concluir Emitir a GRU' }).check();
    await page.getByRole('dialog', { name: 'Concluir a demanda?' }).getByRole('button', { name: 'Concluir a demanda' }).click();
    // Então
    await expect(tarefas).toContainText('3 de 3 concluídas');
    await expect(cartao.getByLabel('Situação da demanda').getByRole('option', { selected: true })).toHaveText('CONCLUÍDO');
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Concluída', exact: true }).getByRole('listitem').filter({ hasText: 'Emitir a GRU' })).toBeVisible();
  });

  test('quando a pessoa desmarca uma tarefa concluída no checklist, então ela volta para "Para fazer"', async ({ page }) => {
    // Dado: "Organizar a pasta" está concluída
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).click();
    await abrirSecao(page.getByRole('dialog'), 'Tarefas');
    const tarefas = page.getByRole('dialog').getByRole('region', { name: 'Tarefas da demanda' });
    // Quando
    await tarefas.getByRole('checkbox', { name: 'Concluir Organizar a pasta' }).uncheck();
    // Então
    await expect(tarefas.getByRole('listitem').filter({ hasText: 'Organizar a pasta' })).toContainText('PARA FAZER');
    await expect(page.getByText('Organizar a pasta voltou para "Para fazer".')).toBeVisible();
  });

  test('quando alguém abre o cartão de uma pessoa da equipe, então vê as tarefas dela, com o papel', async ({ page }) => {
    // Quando: o Bruno é responsável por "Pedir documentos ao cliente" e participa de "Emitir a GRU"
    await page.goto('/pessoas/');
    await page.getByRole('searchbox').fill('bruno');
    await page.getByRole('row').filter({ hasText: 'BRUNO EXEMPLO SOUZA' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Tarefas');
    await expect(cartao.getByRole('link', { name: /Pedir documentos ao cliente/ })).toContainText('Responsável');
    await expect(cartao.getByRole('link', { name: /Emitir a GRU/ })).toContainText('Participante');
  });

  test('quando o comentário da tarefa menciona quem não a vê, então a pessoa aparece desligada na lista do @', async ({ page }) => {
    // Dado: "Renovar a procuração" é da Ana, com o Mauro; o Bruno não está nela e ela não tem demanda
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Comentários');
    // Quando
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
    // Então
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toContainText('não participa');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
  });
});

test.describe('Checklists da tarefa', () => {
  test('quando a tarefa ainda não tem checklists, então o cartão mostra a seção "Checklists" com o convite para criar um', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Checklists');
    // Então
    await expect(cartao.getByText('Nenhum checklist ainda. Use checklists para os documentos e os passos da tarefa.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Adicionar checklist', exact: true })).toBeVisible();
  });

  test('quando a pessoa escolhe um modelo em "Adicionar checklist" e marca um item, então o checklist fica na tarefa, com o progresso, ao reabrir', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Checklists');
    // Quando
    await cartao.getByRole('button', { name: 'Adicionar checklist', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Documentos de pessoa física' }).click();
    const lista = cartao.getByRole('region', { name: 'Checklist Documentos de pessoa física' });
    await expect(lista.getByRole('checkbox')).toHaveCount(2);
    await lista.getByRole('checkbox').first().check();
    await expect(lista).toContainText('1 de 2');
    // Então
    const reaberto = await abrirTarefa(page, 'Renovar a procuração', 'Checklists');
    const deNovo = reaberto.getByRole('region', { name: 'Checklist Documentos de pessoa física' });
    await expect(deNovo).toContainText('1 de 2');
    await expect(deNovo.getByRole('checkbox').first()).toBeChecked();
  });
});

test.describe('Sair da tarefa (#276)', () => {
  test('dado um participante sem outro vínculo, quando se tira e salva, então sai de verdade e a saída fica no histórico', async ({ page }) => {
    // Dado
    const doMauro = await abrirTarefa(page, 'Renovar a procuração');
    await doMauro.getByRole('button', { name: 'Editar' }).click();
    await doMauro.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Adicionar participante' }).click();
    await doMauro.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: 'Bruno Exemplo Souza' }).click();
    await doMauro.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(doMauro.getByRole('form', { name: 'Editar tarefa' })).toHaveCount(0);
    await entrarComo(page, 'u-bruno');
    // Quando
    const doBruno = await abrirTarefa(page, 'Renovar a procuração');
    await doBruno.getByRole('button', { name: 'Editar' }).click();
    await doBruno.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Tirar Bruno Exemplo Souza' }).click();
    await doBruno.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Você saiu dela, e a saída ficou no histórico.' })).toBeVisible();
    await entrarComo(page, 'u-master');
    const historico = await abrirTarefa(page, 'Renovar a procuração', 'Histórico de alterações');
    await expect(historico.getByText(/Participantes/).last()).toBeVisible();
    await expect(historico).toContainText('Bruno Exemplo Souza');
  });
});

test.describe('Concluir a tarefa', () => {
  test('dada uma tarefa com o prazo vencido, quando a pessoa clica em "Concluir", então o selo fica verde, sem "vencido", e "Reabrir" a devolve', async ({ page }) => {
    // Dado: "Renovar a procuração" venceu ontem e está em "Para fazer"
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await expect(cartao.getByText(/^Prazo vencido: /)).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Concluir', exact: true }).click();
    // Então
    await expect(page.getByText('Tarefa concluída.')).toBeVisible();
    await expect(cartao.getByText(/^Concluída · Prazo: /)).toBeVisible();
    await expect(cartao.getByText(/Prazo vencido/)).toHaveCount(0);
    await expect(cartao.getByLabel('Situação da tarefa')).toHaveValue('t4');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    const linha = page.getByRole('row').filter({ hasText: 'Renovar a procuração' });
    await expect(linha).toContainText('Concluída · Prazo:');
    await expect(linha).not.toContainText('Prazo vencido');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const noQuadro = page.getByRole('list', { name: 'Concluída', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' });
    await expect(noQuadro).toContainText('Concluída · Prazo:');

    // Quando: reabre
    const deNovo = await abrirTarefa(page, 'Renovar a procuração');
    await deNovo.getByRole('button', { name: 'Reabrir' }).click();
    // Então
    await expect(page.getByText('Tarefa reaberta em "Para fazer".')).toBeVisible();
    await expect(deNovo.getByText(/^Prazo vencido: /)).toBeVisible();
    await expect(deNovo.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  });

  test('dado um escritório que renomeou a coluna das concluídas, quando a tarefa vai para ela, então o selo também diz "Concluída"', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await page.getByRole('button', { name: 'Opções da coluna Concluída' }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    const janela = page.getByRole('dialog', { name: 'Renomear coluna' });
    await janela.getByLabel('Renomear coluna').fill('Feitas');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('list', { name: 'Feitas', exact: true })).toBeVisible();
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByLabel('Situação da tarefa').selectOption({ label: 'FEITAS' });
    // Então
    await expect(cartao.getByText(/^Concluída · Prazo: /)).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Reabrir' })).toBeVisible();
  });

  test('dada a equipe vendo tudo, quando quem não está na tarefa a abre, então o ✓ "Concluir" aparece só para ver (#397)', async ({ page }) => {
    // Dado: o Bruno não está em "Renovar a procuração"
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Então
    await expect(cartao.getByLabel('Situação da tarefa')).toBeDisabled();
    await expect(cartao.getByRole('button', { name: 'Concluir', exact: true })).toHaveAttribute('aria-disabled', 'true');
  });

  test('dada uma tarefa concluída pelo botão, quando a pessoa clica em "Desfazer", então ela volta para onde estava', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(cartao.getByRole('button', { name: 'Reabrir' })).toBeFocused();
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(cartao.getByText(/^Prazo vencido: /)).toBeVisible();
    await expect(cartao.getByLabel('Situação da tarefa').getByRole('option', { selected: true })).toHaveText('PARA FAZER');
  });

  test('dada a última tarefa aberta de uma demanda, quando a pessoa clica em "Concluir", então o sistema oferece concluir a demanda', async ({ page }) => {
    // Dado: "Organizar a pasta" já está concluída; conclui "Pedir documentos ao cliente" pelo botão
    const pedir = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await pedir.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Concluir a demanda?' })).toHaveCount(0);
    // Quando
    const gru = await abrirTarefa(page, 'Emitir a GRU');
    await gru.getByRole('button', { name: 'Concluir', exact: true }).click();
    // Então
    await expect(page.getByRole('dialog', { name: 'Concluir a demanda?' })).toContainText('Registro de marca');
  });

  test('dada uma tarefa arquivada, quando a pessoa abre o cartão, então o ✓ "Concluir" aparece só para ver, sem "Reabrir" (#397)', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    // Então
    await expect(cartao.getByText('Arquivada', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Concluir', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(cartao.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);
  });
});

test.describe('Prazo de cartão concluído nas listas', () => {
  test('dada uma tarefa já concluída, quando ganha um prazo que já passou, então o cartão não mostra "Prazo vencido"', async ({ page }) => {
    // Dado: "Organizar a pasta" está concluída; dá a ela um prazo vencido
    const cartao = await abrirTarefa(page, 'Organizar a pasta');
    // Quando: desde a #361, o prazo muda no próprio cartão; desde a #422, na janela das datas (escrito à mão, com Enter)
    await cartao.getByRole('button', { name: /^Datas: / }).click();
    const janela = cartao.page().getByRole('dialog', { name: 'Mudar as datas' });
    await janela.getByRole('checkbox', { name: 'Entrega' }).check();
    const campo = janela.getByRole('textbox', { name: 'Prazo', exact: true });
    await campo.fill('01012020');
    await campo.press('Enter');
    await expect(janela).toHaveCount(0);
    // Então
    await expect(cartao.getByText(/^Concluída · Prazo: 01\/01\/2020/)).toBeVisible();
    await expect(cartao.getByText(/Prazo vencido/)).toHaveCount(0);
  });

  test('dada uma tarefa vencida e concluída, quando aparece no cartão da pessoa, então a linha não diz "Prazo vencido"', async ({ page }) => {
    // Dado: a Ana é responsável por "Renovar a procuração", que venceu ontem
    const tarefa = await abrirTarefa(page, 'Renovar a procuração');
    await tarefa.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(page.getByText('Tarefa concluída.')).toBeVisible();
    // Quando
    await page.goto('/pessoas/');
    await page.getByRole('searchbox').fill('ana teste');
    await page.getByRole('row').filter({ hasText: /ANA TESTE LIMA/i }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Tarefas');
    // Então
    const linha = cartao.getByRole('link', { name: /Renovar a procuração/ });
    await expect(linha).toContainText('CONCLUÍDA · Prazo: ');
    await expect(linha).not.toContainText('vencido');
  });
});

test.describe('Ordem pelo prazo (#291)', () => {
  // Na semente: "Renovar a procuração" vence ontem e "Emitir a GRU" depois de amanhã; as outras duas não têm prazo.
  const titulos = (page: Page) => page.getByRole('table').getByRole('row').evaluateAll(linhas =>
    linhas.map(l => l.querySelector('td')?.parentElement?.textContent ?? '').filter(Boolean));

  test('dada a tabela de tarefas, quando a pessoa ordena pelo prazo, então as com prazo vêm na ordem dele e as sem prazo no fim, nos dois sentidos, sem contar como filtro', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Ordenar').selectOption({ label: 'Prazo (o mais próximo primeiro)' });
    // Então
    await expect.poll(async () => (await titulos(page)).slice(0, 2).map(t => t.includes('Renovar') ? 'Renovar' : t.includes('Emitir') ? 'Emitir' : 'outra'))
      .toEqual(['Renovar', 'Emitir']);
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
    // Quando
    await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Ordenar').selectOption({ label: 'Prazo (o mais distante primeiro)' });
    // Então
    await expect.poll(async () => (await titulos(page)).map(t => t.includes('Renovar') ? 'Renovar' : t.includes('Emitir') ? 'Emitir' : 'sem prazo'))
      .toEqual(['Emitir', 'Renovar', 'sem prazo', 'sem prazo']);
    // Quando: volta à página
    await page.reload();
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();
    // Então: a escolha ficou guardada
    await expect(page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Ordenar')).toHaveValue('prazo_desc');
  });

  test('dada uma coluna do quadro de tarefas, quando a pessoa a ordena pelo prazo no menu dela, então só ela muda, e o topo mostra a ordem', async ({ page }) => {
    // Dado: "Para fazer" tem, na ordem manual, "Pedir documentos ao cliente" (sem prazo) e depois "Renovar a procuração"
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const coluna = page.getByRole('list', { name: 'Para fazer', exact: true });
    await expect(coluna.getByRole('listitem')).toHaveText([/Pedir documentos ao cliente/, /Renovar a procuração/]);
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Para fazer' }).click();
    await page.getByRole('menuitemradio', { name: 'Prazo (o mais próximo primeiro)' }).click();
    // Então
    await expect(coluna.getByRole('listitem')).toHaveText([/Renovar a procuração/, /Pedir documentos ao cliente/]);
    await expect(page.getByTitle('Ordem desta lista (muda no menu da coluna)')).toHaveText(['Prazo (o mais próximo primeiro)']);
    // Quando: volta à página
    await page.reload();
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então
    await expect(page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem')).toHaveText([/Renovar a procuração/, /Pedir documentos ao cliente/]);
  });
});

test.describe('Descrição com negrito, itálico e listas (#293)', () => {
  test('quando a pessoa marca trechos da descrição com B e Ctrl+I e faz uma lista, então o cartão mostra tudo formatado, e a busca acha a palavra em negrito', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Juntar os documentos');
    const descricao = page.getByRole('textbox', { name: 'Descrição' });
    await descricao.fill('Juntar procuração e comprovante\nRG\nCPF');
    const escolher = (de: number, ate: number) => descricao.evaluate((el: HTMLTextAreaElement, [a, b]) => el.setSelectionRange(a, b), [de, ate]);
    // Quando
    await escolher(7, 17);
    await page.getByRole('button', { name: 'Negrito (Ctrl+B)' }).click();
    await escolher(24, 35);
    await descricao.press('Control+i');
    await escolher(38, 44);
    // Desde a #344 há também "Lista numerada" e "Lista de tarefas" na barra
    await page.getByRole('button', { name: 'Lista', exact: true }).click();
    // Então
    await expect(descricao).toHaveValue('Juntar **procuração** e *comprovante*\n- RG\n- CPF');
    // Quando: Ctrl+Z desfaz só a última marca (a lista), e Ctrl+Y a refaz
    await descricao.press('Control+z');
    // Então
    await expect(descricao).toHaveValue('Juntar **procuração** e *comprovante*\nRG\nCPF');
    // Quando
    await descricao.press('Control+y');
    // Então
    await expect(descricao).toHaveValue('Juntar **procuração** e *comprovante*\n- RG\n- CPF');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Juntar os documentos' })).toBeVisible();
    await expect(cartao.locator('strong', { hasText: 'procuração' })).toBeVisible();
    await expect(cartao.locator('em', { hasText: 'comprovante' })).toBeVisible();
    await expect(cartao.getByRole('listitem').filter({ hasText: /^(RG|CPF)$/ })).toHaveText(['RG', 'CPF']);
    await expect(cartao.getByText('**procuração**')).toHaveCount(0);
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('searchbox').fill('procuração');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Juntar os documentos' })).toBeVisible();
  });
});

test.describe('Descrição com o Markdown completo (#344)', () => {
  test('quando a pessoa escreve uma lista de tarefas, uma numerada e código na descrição, então o cartão mostra tudo formatado, e as caixinhas só para ler', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Preparar o protocolo');
    // Quando
    await page.getByRole('textbox', { name: 'Descrição' }).fill(['- [ ] Imprimir a petição', '- [x] Assinar', '1. Guia', '2. Cópias', 'Rodar `npm run teste`'].join('\n'));
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Preparar o protocolo' })).toBeVisible();
    const imprimir = cartao.getByRole('checkbox', { name: 'Imprimir a petição' }), assinar = cartao.getByRole('checkbox', { name: 'Assinar' });
    await expect(imprimir).not.toBeChecked();
    await expect(assinar).toBeChecked();
    await expect(imprimir).toBeDisabled();
    await expect(cartao.getByRole('list').filter({ hasText: 'Guia' }).getByRole('listitem')).toHaveText(['Guia', 'Cópias']);
    await expect(cartao.locator('code', { hasText: 'npm run teste' })).toBeVisible();
    await expect(cartao.getByText('- [ ]', { exact: false })).toHaveCount(0);
  });
});

test.describe('Seções e campos do formulário (#359)', () => {
  test('dado o lápis de uma tarefa, quando abre, então "Pessoas" é uma seção com Responsável, Participantes e Pessoas ligadas como campos dentro', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    // Então: o título da seção é um h3 (abaixo do título do cartão), e os campos de vários itens têm o rótulo no plural
    const pessoas = cartao.getByRole('form', { name: 'Editar tarefa' }).getByRole('region', { name: 'Pessoas' });
    await expect(pessoas.getByRole('heading', { name: 'Pessoas', level: 3 })).toBeVisible();
    await expect(pessoas.getByRole('combobox', { name: /Responsável/ })).toBeVisible();
    await expect(pessoas.getByRole('group', { name: 'Participantes' })).toBeVisible();
    await expect(pessoas.getByRole('group', { name: 'Pessoas ligadas' })).toBeVisible();
    await expect(pessoas.getByRole('textbox', { name: 'Pessoa ligada', exact: true })).toBeVisible();
  });
});
