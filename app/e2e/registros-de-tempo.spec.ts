// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A lista dos registros de tempo da tarefa (#400): cada um vê, muda e apaga os próprios registros; o administrador, os de todos.
// Na semente do banco fictício, "Emitir a GRU" tem 1 h 20 min do Mauro (o master, administrador) e 40 min do Bruno (estagiário,
// não administrador), os dois contados ontem pelo cronômetro.
// Desde a #442 (opção 9), os registros ficam embaixo do bloco "Prazo e tempo", na linha da equipe ("Ver registros (N)"), agrupados
// por pessoa ("Seus registros", "Registros de Bruno Exemplo Souza"); o relógio mostra minutos ("25 min"), e não mais 0:25:00.
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
/** Abre os registros, na linha da equipe, e devolve a lista de uma pessoa ("Seus registros", "Registros de …"). */
async function abrirRegistros(cartao: Locator, nome: string) {
  await cartao.getByRole('group', { name: 'Tempo da equipe' }).getByRole('button', { name: /^Ver registros/ }).click();
  return cartao.getByRole('group', { name: 'Registros de tempo' }).getByRole('list', { name: nome });
}
/** Um dia, em milissegundos, e quantos dias antes de hoje o registro passa a ser, no teste de mudar o dia. */
const UM_DIA = 24 * 60 * 60 * 1000, DIAS_ANTES = 3;
/** A linha do total da equipe (#442: saiu da faixa das datas e foi para a linha da equipe, embaixo do bloco do prazo e do tempo). */
const tempoTotal = (cartao: Locator) => cartao.getByRole('group', { name: 'Tempo da equipe' }).getByText(/^Total da equipe/);

test.describe('Dado quem não é administrador', () => {
  test.beforeEach(async ({ page }) => { await entrarComo(page, 'u-bruno'); });

  test('quando abre a lista, então vê só os próprios registros, com o dia, a duração e de onde vieram, e Mudar e Apagar', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Seus registros');
    // Então: só o registro do Bruno, sem o nome nem a duração do Mauro
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    // (#442: a linha diz quando, e não mais "Cronômetro"; o que veio à mão diz "À mão: motivo")
    await expect(lista.getByRole('listitem')).toContainText(/Ontem, \d\d\/\d\d.*40 min/);
    await expect(cartao.getByRole('group', { name: 'Registros de tempo' })).not.toContainText('Mauro');
    await expect(lista.getByRole('button', { name: /^Mudar o registro/ })).toBeVisible();
    await expect(lista.getByRole('button', { name: /^Apagar o registro/ })).toBeVisible();
  });

  test('quando muda a duração e o dia do próprio registro com o motivo, então o relógio e o total mudam, e a mudança fica no histórico', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Seus registros');
    // Quando
    await lista.getByRole('button', { name: /^Mudar o registro/ }).click();
    const janela = page.getByRole('dialog', { name: 'Mudar o registro de tempo' });
    const diaNovo = new Date(Date.now() - DIAS_ANTES * UM_DIA).toLocaleDateString('pt-BR');
    await janela.getByLabel('Duração').fill('25min');
    await janela.getByLabel('Dia', { exact: true }).fill(diaNovo);
    await janela.getByLabel('Motivo').fill('Contei a reunião junto');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Registro de tempo mudado.')).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('25 min');
    await expect(tempoTotal(cartao)).toHaveText('Total da equipe 1 h 45 min');
    await expect(lista.getByRole('listitem')).toContainText(diaNovo.slice(0, 5));
    await expect(lista.getByRole('listitem')).toContainText(/Mudado: Contei a reunião junto.*25 min/);
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(`, que passou para ${diaNovo}. Motivo: Contei a reunião junto`)).toBeVisible();
    await expect(cartao.getByText(/Corrigido o tempo contado de Bruno Exemplo Souza, de .*\. Motivo: Contei a reunião junto/)).toBeVisible();
  });

  test('quando muda sem dizer o motivo, então nada muda e o sistema pede o motivo', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Seus registros');
    // Quando
    await lista.getByRole('button', { name: /^Mudar o registro/ }).click();
    const janela = page.getByRole('dialog', { name: 'Mudar o registro de tempo' });
    await janela.getByLabel('Duração').fill('5min');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Diga o motivo da mudança (ele fica no histórico da tarefa).')).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('40 min');
  });

  test('quando apaga o próprio registro e confirma, então ele sai do relógio e do total, com Desfazer, e volta ao desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const lista = await abrirRegistros(cartao, 'Seus registros');
    // Quando: dois cliques (o primeiro pede a confirmação)
    const apagar = lista.getByRole('button', { name: /^Apagar o registro/ });
    await apagar.click();
    await expect(apagar).toHaveText('Confirmar');
    await apagar.click();
    // Então
    const aviso = page.getByRole('status').filter({ hasText: 'Registro de tempo apagado.' });
    await expect(aviso).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('0 min');
    await expect(tempoTotal(cartao)).toHaveText('Total da equipe 1 h 20 min');
    // E o Desfazer devolve o registro
    await aviso.getByRole('button', { name: 'Desfazer' }).click();
    await expect(cartao.getByRole('timer')).toHaveText('40 min');
    await expect(tempoTotal(cartao)).toHaveText('Total da equipe 2 h');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Apagado o tempo contado de Bruno Exemplo Souza/)).toBeVisible();
    await expect(cartao.getByText(/Devolvido o tempo contado de Bruno Exemplo Souza/)).toBeVisible();
  });
});

test.describe('Dado um administrador', () => {
  test('quando abre a lista, então vê os registros de todos, agrupados por pessoa, com o nome de quem registrou, e apaga o de outra pessoa', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const meus = await abrirRegistros(cartao, 'Seus registros');
    const registros = cartao.getByRole('group', { name: 'Registros de tempo' });
    await expect(registros.getByRole('listitem')).toHaveCount(2);
    await expect(meus.getByRole('listitem')).toContainText('1 h 20 min');
    const doBruno = registros.getByRole('list', { name: 'Registros de Bruno Exemplo Souza' }).getByRole('listitem');
    await expect(doBruno).toContainText('40 min');
    // Quando
    const apagar = doBruno.getByRole('button', { name: /^Apagar o registro/ });
    await apagar.click();
    await apagar.click();
    // Então: o relógio do Mauro continua o mesmo e, sem o tempo do Bruno, só ele tem tempo: a linha do total some (#442)
    await expect(tempoTotal(cartao)).toHaveCount(0);
    await expect(cartao.getByRole('timer')).toHaveText('1 h 20 min');
    await expect(registros.getByRole('listitem')).toHaveCount(1);
  });
});

test.describe('Dado o cronômetro contando', () => {
  // A regra mudou na #442 (decisão do dono): o registro que está contando continua exigindo parar antes de mudar ou apagar, mas o
  // lápis e a lixeira dele já aparecem desligados, com o motivo, em vez de um aviso com o botão "Pausar" depois do clique.
  /** O Mauro começa a contar em "Renovar a procuração" (sem tempo ainda), para, e continua: o período já foi gravado uma vez. */
  async function contandoComRegistro(page: Page) {
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const tempo = cartao.getByRole('group', { name: 'Seu tempo' });
    await tempo.getByRole('button', { name: 'Iniciar' }).click();
    await page.clock.runFor(5_000);
    await tempo.getByRole('button', { name: 'Parar' }).click();
    await tempo.getByRole('button', { name: 'Continuar' }).click();
    await expect(tempo.getByText('contando', { exact: true })).toBeVisible();
    const lista = await abrirRegistros(cartao, 'Seus registros');
    const contando = lista.getByRole('listitem').filter({ hasText: 'contando' });
    await expect(contando).toContainText(/^Hoje, desde \d\d:\d\d/);
    return { cartao, tempo, lista, contando };
  }
  const PARE_ANTES = 'Pare o relógio antes de mudar ou apagar o registro que está contando.';

  test('quando a pessoa aperta "Iniciar" e abre os registros logo em seguida, então a linha de hoje já está lá, com a duração andando, e entra na contagem', async ({ page }) => {
    // Dado: "Renovar a procuração", sem tempo do Mauro ainda
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const tempo = cartao.getByRole('group', { name: 'Seu tempo' });
    // Quando: inicia e, antes da primeira gravação no banco, abre os registros
    await tempo.getByRole('button', { name: 'Iniciar' }).click();
    await page.clock.runFor(5_000);
    const lista = await abrirRegistros(cartao, 'Seus registros');
    // Então: a linha que conta, desde agora, com os segundos contados
    const contando = lista.getByRole('listitem').filter({ hasText: 'Contando agora' });
    await expect(contando).toContainText(/^Hoje, desde \d\d:\d\d/);
    await expect(contando).toContainText(/Contando agora\d+ s$/);
    // E a duração anda com o relógio (passado um minuto, em minutos)
    await page.clock.runFor(60_000);
    await expect(contando).toContainText(/Contando agora1 min$/);
    // E o lápis e a lixeira dela ficam desligados, com o motivo
    await expect(contando.getByRole('button', { name: /^Apagar o registro/ })).toHaveAttribute('aria-disabled', 'true');
  });

  test('quando a pessoa olha o registro que está contando, então o lápis e a lixeira estão desligados, com o motivo, e o clique não abre a janela nem para o relógio', async ({ page }) => {
    // Dado
    const { tempo, contando } = await contandoComRegistro(page);
    const mudar = contando.getByRole('button', { name: /^Mudar o registro/ }), apagar = contando.getByRole('button', { name: /^Apagar o registro/ });
    // Então
    for (const botao of [mudar, apagar]) {
      await expect(botao).toHaveAttribute('aria-disabled', 'true');
      await expect(botao).toHaveAccessibleDescription(PARE_ANTES);
    }
    // Quando: o clique de quem insiste (o Playwright não clica em botão desligado sem o force)
    await mudar.click({ force: true });
    await apagar.click({ force: true });
    // Então: nada abre, nada se arma, e o relógio continua contando
    await expect(page.getByRole('dialog', { name: 'Mudar o registro de tempo' })).toHaveCount(0);
    await expect(apagar).not.toHaveText('Confirmar');
    await expect(tempo.getByText('contando', { exact: true })).toBeVisible();
    await expect(tempo.getByRole('button', { name: 'Parar' })).toBeVisible();
  });

  test('quando a pessoa para o relógio, então o registro se apaga em dois cliques, e o relógio volta a zero', async ({ page }) => {
    // Dado
    const { cartao, tempo, lista } = await contandoComRegistro(page);
    // Quando
    await tempo.getByRole('button', { name: 'Parar' }).click();
    await expect(tempo.getByText('parado', { exact: true })).toBeVisible();
    const apagar = lista.getByRole('button', { name: /^Apagar o registro/ });
    await expect(apagar).not.toHaveAttribute('aria-disabled', 'true');
    await apagar.click();
    await apagar.click();
    // Então
    await expect(cartao.getByRole('timer')).toHaveText('0 min');
    await expect(lista).toHaveCount(0);
  });
});
