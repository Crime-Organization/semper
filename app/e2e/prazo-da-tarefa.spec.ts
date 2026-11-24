// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A tarefa nascida de um prazo de processo (#355): concluí-la pergunta se o prazo foi cumprido; reabri-la, se ele volta a ficar
// aberto. Na semente do banco fictício, o processo judicial de JOSÉ DA SILVA TESTE não tem prazos; quem está logado é o Mauro
// (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const PROCESSO_VENCIDO = 'Este processo tem 1 prazo vencido.';

async function abrirProcesso(page: Page) {
  await page.goto('/processos/judicial/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
  await abrirSecao(cartao, 'Prazos');
  return cartao;
}

/** Lança um prazo já vencido e cria a tarefa de cumpri-lo; devolve o link da tarefa, no prazo. */
async function prazoVencidoComTarefa(cartao: Locator, descricao: string) {
  await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
  const form = cartao.getByRole('form', { name: 'Novo prazo' });
  await form.getByLabel('Que prazo é este').fill(descricao);
  await form.getByText('Digitar a data').click();
  await form.getByLabel('Último dia').fill('2020-01-15');
  await form.getByRole('button', { name: 'Lançar prazo' }).click();
  const lista = cartao.getByRole('list', { name: 'Prazos do processo' });
  await lista.getByRole('button', { name: 'Criar tarefa' }).click();
  const tarefa = lista.getByRole('link', { name: /^Tarefa / });
  await expect(tarefa).toBeVisible();
  await expect(cartao.getByText(PROCESSO_VENCIDO)).toBeVisible();
  return tarefa;
}

/** A pergunta da janela, pelo título. */
const pergunta = (page: Page, titulo: string) => page.getByRole('dialog', { name: titulo });

test.describe('O prazo do processo e a tarefa que o cumpre (#355)', () => {
  test('dada a tarefa nascida de um prazo vencido, quando é concluída e a pessoa diz que o prazo foi cumprido, então ele deixa de estar vencido no processo e no painel; reaberta, ele volta a ficar aberto', async ({ page }) => {
    // Dado
    let cartao = await abrirProcesso(page);
    await (await prazoVencidoComTarefa(cartao, 'Recurso de apelação')).click();
    const tarefa = page.getByRole('dialog').filter({ has: page.getByLabel('Situação da tarefa') });
    // Quando
    await tarefa.getByRole('button', { name: 'Concluir', exact: true }).click();
    const janela = pergunta(page, 'O prazo do processo foi cumprido?');
    await expect(janela).toContainText('"Recurso de apelação"');
    await janela.getByRole('button', { name: 'Sim, foi cumprido' }).click();
    // Então
    await expect(page.getByRole('status').getByText('Prazo do processo marcado como cumprido.')).toBeVisible();
    cartao = await abrirProcesso(page);
    await expect(cartao.getByRole('list', { name: 'Prazos do processo' })).toContainText('Cumprido');
    await expect(cartao.getByText(PROCESSO_VENCIDO)).toHaveCount(0);
    await page.goto('/processos/');
    await expect(page.getByRole('heading', { name: 'Processos', level: 1 })).toBeVisible();
    await expect(page.getByText('Recurso de apelação')).toHaveCount(0);

    // Quando: reabre a tarefa
    cartao = await abrirProcesso(page);
    await cartao.getByRole('list', { name: 'Prazos do processo' }).getByRole('link', { name: /^Tarefa / }).click();
    await tarefa.getByRole('button', { name: 'Reabrir', exact: true }).click();
    await pergunta(page, 'O prazo do processo volta a ficar aberto?').getByRole('button', { name: 'Sim, reabrir o prazo' }).click();
    // Então
    await expect(page.getByRole('status').getByText('Prazo do processo reaberto.')).toBeVisible();
    cartao = await abrirProcesso(page);
    await expect(cartao.getByText(PROCESSO_VENCIDO)).toBeVisible();
  });

  test('dada a tarefa nascida de um prazo, quando é concluída pelo círculo do quadro e a pessoa diz que não, então a tarefa fica concluída e o prazo continua vencido', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await prazoVencidoComTarefa(cartao, 'Embargos de declaração');
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const miniatura = page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Embargos de declaração' });
    // Quando
    await miniatura.hover();
    await miniatura.getByRole('button', { name: /^Concluir / }).click();
    await pergunta(page, 'O prazo do processo foi cumprido?').getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(page.getByRole('list', { name: 'Concluída', exact: true })).toContainText('Embargos de declaração');
    const deNovo = await abrirProcesso(page);
    await expect(deNovo.getByText(PROCESSO_VENCIDO)).toBeVisible();
  });
});
