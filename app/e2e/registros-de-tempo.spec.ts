// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A lista dos registros de tempo da tarefa (#400): cada um vê, muda e apaga os próprios registros; o administrador, os de todos.
// Na semente do banco fictício, "Emitir a GRU" tem 1 h 20 min do Mauro (o master, administrador) e 40 min do Bruno (estagiário,
// não administrador), os dois contados ontem pelo cronômetro.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

/** Abre o cartão da tarefa pela tabela. */
async function abrirTarefa(page: Page, titulo: string) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: titulo, level: 2 }) });
  await expect(cartao.getByRole('timer')).toBeVisible();
  return cartao;
}
/** Abre a lista dos registros, na faixa do tempo. */
async function abrirRegistros(cartao: Locator, nome: string) {
  const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
  await tempo.getByRole('button', { name: new RegExp('^' + nome) }).click();
  return tempo.getByRole('list', { name: nome });
}
const tempoTotal = (cartao: Locator) => cartao.getByRole('group', { name: 'Datas', exact: true }).getByRole('group', { name: 'Tempo total' });

test.describe('Dado quem não é administrador', () => {
  test.beforeEach(async ({ page }) => { await entrarComo(page, 'u-bruno'); });

  test('quando abre a lista, então vê só os próprios registros, com o dia, a duração e de onde vieram, e Mudar e Apagar', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Meus registros de tempo');
    // Então: só o registro do Bruno, sem o nome nem a duração do Mauro
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    await expect(lista.getByRole('listitem')).toContainText(/40 min.*Cronômetro/);
    await expect(lista).not.toContainText('Mauro');
    await expect(lista.getByRole('button', { name: /^Mudar o registro/ })).toBeVisible();
    await expect(lista.getByRole('button', { name: /^Apagar o registro/ })).toBeVisible();
  });

  test('quando muda a duração e o dia do próprio registro com o motivo, então o relógio e o total mudam, e a mudança fica no histórico', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Meus registros de tempo');
    // Quando
    await lista.getByRole('button', { name: /^Mudar o registro/ }).click();
    const janela = page.getByRole('dialog', { name: 'Mudar o registro de tempo' });
    await janela.getByLabel('Duração').fill('25min');
    await janela.getByLabel('Motivo').fill('Contei a reunião junto');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Registro de tempo mudado.')).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('0:25:00');
    await expect(tempoTotal(cartao)).toHaveText(/1 h 45 min$/);
    await expect(lista.getByRole('listitem')).toContainText(/25 min.*Mudado: Contei a reunião junto/);
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Corrigido o tempo contado de Bruno Exemplo Souza, de .*\. Motivo: Contei a reunião junto/)).toBeVisible();
  });

  test('quando muda sem dizer o motivo, então nada muda e o sistema pede o motivo', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Meus registros de tempo');
    // Quando
    await lista.getByRole('button', { name: /^Mudar o registro/ }).click();
    const janela = page.getByRole('dialog', { name: 'Mudar o registro de tempo' });
    await janela.getByLabel('Duração').fill('5min');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Diga o motivo da mudança (ele fica no histórico da tarefa).')).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('0:40:00');
  });

  test('quando apaga o próprio registro e confirma, então ele sai do relógio e do total, com Desfazer, e volta ao desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Meus registros de tempo');
    // Quando: dois cliques (o primeiro pede a confirmação)
    const apagar = lista.getByRole('button', { name: /^Apagar o registro/ });
    await apagar.click();
    await expect(apagar).toHaveText('Confirmar');
    await apagar.click();
    // Então
    const aviso = page.getByRole('status').filter({ hasText: 'Registro de tempo apagado.' });
    await expect(aviso).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('0:00:00');
    await expect(tempoTotal(cartao)).toHaveText(/1 h 20 min$/);
    // E o Desfazer devolve o registro
    await aviso.getByRole('button', { name: 'Desfazer' }).click();
    await expect(cartao.getByRole('timer')).toHaveText('0:40:00');
    await expect(tempoTotal(cartao)).toHaveText(/2 h$/);
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Apagado o tempo contado de Bruno Exemplo Souza/)).toBeVisible();
    await expect(cartao.getByText(/Devolvido o tempo contado de Bruno Exemplo Souza/)).toBeVisible();
  });
});

test.describe('Dado um administrador', () => {
  test('quando abre a lista, então vê os registros de todos, com o nome de quem registrou, e apaga o de outra pessoa', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Registros de tempo');
    await expect(lista.getByRole('listitem')).toHaveCount(2);
    const doBruno = lista.getByRole('listitem').filter({ hasText: 'Bruno Exemplo Souza' });
    await expect(doBruno).toContainText('40 min');
    // Quando
    const apagar = doBruno.getByRole('button', { name: /^Apagar o registro/ });
    await apagar.click();
    await apagar.click();
    // Então: o total perde os 40 min do Bruno, e o relógio do Mauro continua o mesmo
    await expect(tempoTotal(cartao)).toHaveText(/1 h 20 min$/);
    await expect(cartao.getByRole('timer')).toHaveText('1:20:00');
    await expect(lista.getByRole('listitem')).toHaveCount(1);
  });
});

test.describe('Dado o cronômetro contando', () => {
  test('quando a pessoa tenta apagar o registro que está contando, então o sistema pede para pausar antes, e depois de pausar deixa', async ({ page }) => {
    // Dado: o Mauro começa a contar em "Renovar a procuração" (sem tempo ainda) e o período já foi gravado uma vez
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
    await tempo.getByRole('button', { name: /^Iniciar/ }).click();
    await page.clock.runFor(5_000);
    await tempo.getByRole('button', { name: /^Pausar/ }).click();
    await tempo.getByRole('button', { name: /^Retomar/ }).click();
    await expect(tempo.getByText('contando', { exact: true })).toBeVisible();
    const lista = await abrirRegistros(cartao, 'Registros de tempo');
    const emAndamento = lista.getByRole('listitem').filter({ hasText: 'em andamento' });
    await expect(emAndamento).toBeVisible();
    // Quando
    await emAndamento.getByRole('button', { name: /^Apagar o registro/ }).click();
    // Então
    const aviso = page.getByRole('status').filter({ hasText: 'Pause o cronômetro antes de mudar ou apagar o registro que está contando.' });
    await expect(aviso).toBeVisible();
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    // E, pausado pelo aviso, o registro se apaga, e o relógio volta a zero
    await aviso.getByRole('button', { name: 'Pausar' }).click();
    await expect(tempo.getByText('pausado', { exact: true })).toBeVisible();
    const apagar = lista.getByRole('button', { name: /^Apagar o registro/ });
    await apagar.click();
    await apagar.click();
    await expect(cartao.getByRole('timer')).toHaveText('0:00:00');
    await expect(lista).toHaveCount(0);
  });
});
