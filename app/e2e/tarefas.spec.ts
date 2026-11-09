// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Tarefas. Na semente do banco fictício, a demanda "Registro de marca" (do contrato de JOSÉ DA SILVA TESTE) tem
// três tarefas: "Pedir documentos ao cliente" (Para fazer, do Bruno), "Emitir a GRU" (Fazendo, do Mateus, com o Bruno)
// e "Organizar a pasta" (Concluída). "Renovar a procuração" é avulsa, da Ana, com o Mateus de participante e o prazo
// vencido. Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, alturaParada, entrarComo } from './ajudantes';

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
  test('quando chega à etapa das ligações, então as buscas têm a altura dos outros campos', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    const titulo = page.getByLabel('Título');
    const altura = await alturaParada(titulo);
    await titulo.fill('Mandar a notificação');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    expect(await alturaParada(page.getByRole('combobox', { name: 'Demanda' }))).toBe(altura);
    expect(await alturaParada(page.getByRole('combobox', { name: 'Contrato' }))).toBe(altura);
  });

  test('quando a pessoa cadastra uma tarefa pelas etapas, ligada a uma demanda, então ela entra em "Para fazer", com tudo no cartão', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await expect(page.getByText('Etapa 1 de 3')).toBeVisible();
    // Quando
    await page.getByLabel('Título').fill('Mandar a notificação');
    await page.getByLabel('Prazo').fill('10112030');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('group', { name: 'Participantes' }).getByText('Ana Teste Lima', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Pessoa ligada', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('combobox', { name: 'Demanda' }).fill('Notificar');
    await page.getByRole('option', { name: /Notificar o devedor/ }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Mandar a notificação' })).toBeVisible();
    await expect(cartao).toContainText('Prazo: 10/11/2030');
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button', { name: 'Mateus Freitas Gonçalves, Responsável' })).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Ana Teste Lima, Participante' })).toBeVisible();
    await abrirSecao(cartao, 'Pessoas');
    await abrirSecao(cartao, 'Demanda');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toBeVisible();
    await expect(cartao.getByRole('link', { name: /Notificar o devedor/ })).toContainText('Demanda');
    await expect(cartao.getByLabel('Situação da tarefa').getByRole('option', { selected: true })).toHaveText('Para fazer');
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
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(cadastro.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('JOSÉ DA SILVA TESTE');
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await expect(cadastro.getByText(/D3A1F09C · Registro de marca/)).toBeVisible();
    await expect(cadastro.getByText(/MA96-0001/)).toBeVisible();
  });
});

test.describe('Quadro de tarefas', () => {
  // Tela larga: as colunas "Fazendo" e "Concluída" ficam as duas à vista, para arrastar de uma para a outra.
  test.use({ viewport: { width: 1920, height: 1000 } });

  test('quando a pessoa alterna entre quadro e tabela, então vê as mesmas tarefas', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Renovar a procuração' })).toContainText('Para fazer');
    await expect(page.getByRole('row').filter({ hasText: 'Emitir a GRU' })).toContainText('Fazendo');
  });

  test('quando a última tarefa da demanda é arrastada para "Concluída", então o sistema oferece concluir a demanda, e só move com o aceite', async ({ page }) => {
    // Dado: "Organizar a pasta" já está concluída; falta "Pedir documentos ao cliente", que vai pelo cartão
    const cartao = await abrirTarefa(page, 'Pedir documentos ao cliente');
    await cartao.getByLabel('Situação da tarefa').selectOption({ label: 'Concluída' });
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
  test('quando a pessoa clica no lápis, muda o prazo e salva, então o cartão mostra o prazo novo sem sair dele, e dá para desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    await expect(cartao.getByRole('status').filter({ hasText: 'Modo de edição' })).toBeVisible();
    await expect(edicao.getByRole('heading', { name: 'A tarefa' })).toBeVisible();
    await expect(edicao.getByRole('heading', { name: 'Demanda e contrato' })).toBeVisible();
    await edicao.getByLabel('Prazo').fill('15112030');
    await edicao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(edicao).toHaveCount(0);
    await expect(cartao.getByText('Modo de edição')).toHaveCount(0);
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(cartao).toContainText('Prazo: 15/11/2030');
    await expect(page.getByRole('status').getByRole('button', { name: 'Desfazer' })).toBeVisible();
  });

  test('quando o título fica vazio, então salvar mostra o erro e continua editando; cancelar deixa como estava', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    // Quando
    await edicao.getByLabel('Título').fill('');
    await edicao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(edicao.getByText('Dê um título à tarefa.')).toBeVisible();
    await edicao.getByRole('button', { name: 'Cancelar' }).click();
    await expect(edicao).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
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
    // Dado: o Mateus tem 1 h 20 min em "Emitir a GRU"
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
    await expect(cartao.getByText(/Mateus Freitas Gonçalves: −20 min · Contei a mais/)).toBeVisible();
  });

  test('quando a tarefa está concluída, então a contagem encerrou e o cartão mostra o esforço da equipe', async ({ page }) => {
    // Quando: "Organizar a pasta" está concluída, com 40 min do Bruno
    const cartao = await abrirTarefa(page, 'Organizar a pasta');
    await apertarT(page, cartao);
    // Então
    await expect(cartao.getByText('Tarefa concluída: a contagem encerrou.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: /Iniciar/ })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'contando' })).toHaveCount(0);
    await expect(cartao).toContainText('Total da equipe: 40 min');
    await expect(cartao.getByRole('list', { name: 'Parte de cada um' })).toContainText('Bruno Exemplo Souza100%');
  });
});

test.describe('Equipe da tarefa', () => {
  test('quando a pessoa clica na bolinha de alguém da equipe, então vê o nome e o papel, e abre o cartão da pessoa', async ({ page }) => {
    // Dado: "Renovar a procuração" é da Ana, com o Mateus de participante
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const bolinhas = cartao.getByRole('group', { name: 'Equipe' }).getByRole('button');
    await expect(bolinhas).toHaveText(['AL', 'MG']);
    // Quando
    await bolinhas.first().click();
    const ficha = page.getByRole('dialog', { name: 'Ana Teste Lima' });
    await expect(ficha).toContainText('Responsável');
    await ficha.getByRole('link', { name: 'Abrir o cartão da pessoa' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'ANA TESTE LIMA' })).toBeVisible();
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
    await expect(tarefas.getByRole('listitem').filter({ hasText: 'Emitir a GRU' })).toContainText('Fazendo');
    await expect(tarefas.getByRole('checkbox', { name: 'Concluir Organizar a pasta' })).toBeChecked();
    await expect(tarefas.getByRole('link', { name: 'Abrir a tarefa Emitir a GRU' })).toHaveAttribute('href', /\/tarefas\/\?id=/);
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
    await expect(cartao.getByLabel('Situação da demanda').getByRole('option', { selected: true })).toHaveText('Concluído');
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
    await expect(tarefas.getByRole('listitem').filter({ hasText: 'Organizar a pasta' })).toContainText('Para fazer');
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
    // Dado: "Renovar a procuração" é da Ana, com o Mateus; o Bruno não está nela e ela não tem demanda
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Comentários');
    // Quando
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
    // Então
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toContainText('não participa');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
  });
});

test.describe('Listas da tarefa', () => {
  test('quando a tarefa ainda não tem listas, então o cartão mostra a seção "Listas" com o convite para criar uma', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Listas');
    // Então
    await expect(cartao.getByText('Nenhuma lista ainda. Use listas para os documentos e os passos da tarefa.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Adicionar lista' })).toBeVisible();
  });

  test('quando a pessoa escolhe um modelo em "Adicionar lista" e marca um item, então a lista fica na tarefa, com o progresso, ao reabrir', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração', 'Listas');
    // Quando
    await cartao.getByRole('button', { name: 'Adicionar lista' }).click();
    await page.getByRole('menuitem', { name: 'Documentos de pessoa física' }).click();
    const lista = cartao.getByRole('region', { name: 'Lista Documentos de pessoa física' });
    await expect(lista.getByRole('checkbox')).toHaveCount(2);
    await lista.getByRole('checkbox').first().check();
    await expect(lista).toContainText('1 de 2');
    // Então
    const reaberto = await abrirTarefa(page, 'Renovar a procuração', 'Listas');
    const deNovo = reaberto.getByRole('region', { name: 'Lista Documentos de pessoa física' });
    await expect(deNovo).toContainText('1 de 2');
    await expect(deNovo.getByRole('checkbox').first()).toBeChecked();
  });
});

test.describe('Sair da tarefa (#276)', () => {
  test('dado um participante sem outro vínculo, quando se desmarca e salva, então sai de verdade e a saída fica no histórico', async ({ page }) => {
    // Dado
    const doMateus = await abrirTarefa(page, 'Renovar a procuração');
    await doMateus.getByRole('button', { name: 'Editar' }).click();
    await doMateus.getByRole('group', { name: 'Participantes' }).getByText('Bruno Exemplo Souza', { exact: true }).click();
    await doMateus.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(doMateus.getByRole('form', { name: 'Editar tarefa' })).toHaveCount(0);
    await entrarComo(page, 'u-bruno');
    // Quando
    const doBruno = await abrirTarefa(page, 'Renovar a procuração');
    await doBruno.getByRole('button', { name: 'Editar' }).click();
    await doBruno.getByRole('group', { name: 'Participantes' }).getByText('Bruno Exemplo Souza', { exact: true }).click();
    await doBruno.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Você saiu dela, e a saída ficou no histórico.' })).toBeVisible();
    await entrarComo(page, 'u-master');
    const historico = await abrirTarefa(page, 'Renovar a procuração', 'Histórico de alterações');
    await expect(historico.getByText(/Participantes/).last()).toBeVisible();
    await expect(historico).toContainText('Bruno Exemplo Souza');
  });
});
