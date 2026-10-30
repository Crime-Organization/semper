// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Tarefas. Na semente do banco fictício, a demanda "Registro de marca" (do contrato de JOSÉ DA SILVA TESTE) tem
// três tarefas: "Pedir documentos ao cliente" (Para fazer, do Bruno), "Emitir a GRU" (Fazendo, do Mateus, com o Bruno)
// e "Organizar a pasta" (Concluída). "Renovar a procuração" é avulsa, da Ana, com o Mateus de participante e o prazo
// vencido. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

/** Abre o cartão de uma tarefa pela tabela e, se pedidas, as seções dele (toda seção começa recolhida). */
async function abrirTarefa(page: Page, titulo: string, ...secoes: string[]) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  for (const secao of secoes) await abrirSecao(page.getByRole('dialog'), secao);
  return page.getByRole('dialog');
}

test.describe('Cadastro de tarefas', () => {
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
    await page.getByLabel('Título').fill('Anexar os documentos');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('JOSÉ DA SILVA TESTE');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText(/D3A1F09C · Registro de marca/)).toBeVisible();
    await expect(page.getByText(/MA96-0001/)).toBeVisible();
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
  test('quando alguém abre o cartão da demanda, então vê as tarefas dela, com a situação', async ({ page }) => {
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Tarefas');
    await expect(cartao.getByRole('link', { name: /Emitir a GRU/ })).toContainText('Fazendo');
    await expect(cartao.getByRole('link', { name: /Organizar a pasta/ })).toContainText('Concluída');
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
