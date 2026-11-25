// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O prazo e o tempo no cartão da tarefa (#442, opção 9 aprovada pelo dono): um teste para cada critério de aceitação da tarefa.
// Na semente do banco fictício: "Emitir a GRU" vence daqui a 2 dias e tem 1 h 20 min do Mauro (o master, administrador) e 40 min do
// Bruno (não administrador); "Renovar a procuração" venceu ontem e não tem tempo; "Organizar a pasta" está concluída (hoje), sem
// prazo, com o tempo do Bruno.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { entrarComo, mudarPrazo, prazoDoCartao, seuTempo, tempoDaEquipe } from './ajudantes';

const FUSO = 'America/Sao_Paulo';
/** O dia de hoje mais n dias, no relógio de Brasília: o dia da folhinha ("27") e a data (dd/mm/aaaa). */
function daqui(n: number) {
  const [d, m, a] = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO }).format(new Date()).split('/').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d + n, 12));
  return { dia: String(dia.getUTCDate()), data: new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(dia) };
}

/** Abre o cartão da tarefa pela tabela e espera o tempo chegar. */
async function abrirTarefa(page: Page, titulo: string, comRelogio = true) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: titulo, level: 2 }) });
  if (comRelogio) await expect(cartao.getByRole('timer')).toBeVisible();
  return cartao;
}
const janelaDasDatas = (page: Page) => page.getByRole('dialog', { name: 'Mudar as datas' });
/** Põe a hora e o lembrete no prazo, pela janela das datas. */
async function porHoraELembrete(page: Page, cartao: Locator, hora: string, lembrete: string) {
  await mudarPrazo(cartao).click();
  await janelaDasDatas(page).getByLabel('Hora do prazo').selectOption(hora);
  await janelaDasDatas(page).getByRole('combobox', { name: 'Lembrete' }).selectOption({ label: lembrete });
  await janelaDasDatas(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(janelaDasDatas(page)).toHaveCount(0);
}

test.describe('O prazo na folhinha (#442)', () => {
  test('dado uma tarefa com prazo, quando abro o cartão, então vejo a folhinha com o dia do prazo, quanto falta, a hora e o lembrete, e o link "Mudar prazo"', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    await porHoraELembrete(page, cartao, '18:00', '1 hora antes');
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    const deNovo = await abrirTarefa(page, 'Emitir a GRU');
    // Então
    const prazo = prazoDoCartao(deNovo), dia = daqui(2);
    await expect(prazo.getByText(dia.dia, { exact: true })).toBeVisible();
    await expect(prazo).toContainText(dia.data);
    await expect(prazo).toContainText('Faltam 2 dias');
    await expect(prazo).toContainText('Às 18:00 · lembrete 1 h antes');
    await expect(mudarPrazo(deNovo)).toHaveText('Mudar prazo');
  });

  test('dado a folhinha ou "Mudar prazo", quando clico, então abre a janela das datas, com o início lá dentro (e não no cartão)', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    const hoje = daqui(0).data;
    await expect(cartao.getByText(`Início ${hoje}`)).toHaveCount(0);
    // Quando: a folhinha
    await prazoDoCartao(cartao).getByText(daqui(2).dia, { exact: true }).click();
    // Então
    await expect(janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' })).toHaveValue(hoje);
    await page.keyboard.press('Escape');
    await expect(janelaDasDatas(page)).toHaveCount(0);
    // Quando: o link
    await mudarPrazo(cartao).click();
    // Então
    await expect(janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' })).toHaveValue(hoje);
    await expect(mudarPrazo(cartao)).toHaveAttribute('aria-expanded', 'true');
  });

  test('dado um prazo vencido, quando abro o cartão, então "Venceu há N dias" aparece em vermelho', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Então
    const frase = prazoDoCartao(cartao).getByText('Venceu há 1 dia', { exact: true });
    await expect(frase).toBeVisible();
    const [cor, erro] = await frase.evaluate(el => {
      const amostra = el.ownerDocument.createElement('span');
      amostra.style.color = 'var(--erro)';
      el.ownerDocument.body.append(amostra);
      const deErro = getComputedStyle(amostra).color;
      amostra.remove();
      return [getComputedStyle(el).color, deErro];
    });
    expect(cor).toBe(erro);
  });

  test('dado uma tarefa concluída, quando abro o cartão, então a folhinha mostra o dia da conclusão e o tempo fica encerrado, sem botão de iniciar', async ({ page }) => {
    // Quando: "Organizar a pasta" foi concluída hoje
    const cartao = await abrirTarefa(page, 'Organizar a pasta');
    // Então
    const prazo = prazoDoCartao(cartao);
    await expect(prazo.getByText(daqui(0).dia, { exact: true })).toBeVisible();
    await expect(prazo).toContainText(`Concluída em: `);
    await expect(prazo).toContainText(daqui(0).data);
    await expect(prazo).toContainText('Sem prazo');
    await expect(seuTempo(cartao)).toContainText('Seu tempo, encerrado');
    await expect(seuTempo(cartao).getByRole('button', { name: /^(Iniciar|Continuar|Parar)$/ })).toHaveCount(0);
    // E, com um prazo daqui a 3 dias, quanto antes do prazo ela foi concluída
    await mudarPrazo(cartao).click();
    await janelaDasDatas(page).getByRole('checkbox', { name: 'Data de entrega' }).check();
    const campo = janelaDasDatas(page).getByRole('textbox', { name: 'Prazo', exact: true });
    await campo.fill(daqui(3).data);
    await campo.press('Enter');
    await expect(prazo).toContainText('3 dias antes do prazo');
  });
});

test.describe('Seu tempo (#442)', () => {
  test('dado o meu relógio parado, quando aperto "Iniciar" (ou a tecla T), então ele conta e aparece "Seu tempo, contando" com o botão "Parar"', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    const tempo = seuTempo(cartao);
    await expect(tempo.getByRole('button', { name: 'Iniciar' })).toHaveAttribute('aria-keyshortcuts', 'T');
    // Quando: o botão
    await tempo.getByRole('button', { name: 'Iniciar' }).click();
    // Então
    await expect(tempo).toContainText('Seu tempo, contando');
    await expect(tempo.getByRole('button', { name: 'Parar' })).toHaveAttribute('aria-keyshortcuts', 'T');
    // E a tecla T para e conta de novo
    await page.keyboard.press('t');
    await expect(tempo).not.toContainText('contando');
    await page.keyboard.press('t');
    await expect(tempo).toContainText('Seu tempo, contando');
  });

  test('dado o relógio contando, quando aperto "Parar", então o tempo fica salvo e o botão vira "Continuar"', async ({ page }) => {
    // Dado
    await page.clock.install();
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    await seuTempo(cartao).getByRole('button', { name: 'Iniciar' }).click();
    await page.clock.runFor(3 * 60_000);
    // Quando
    await seuTempo(cartao).getByRole('button', { name: 'Parar' }).click();
    // Então
    await expect(seuTempo(cartao)).toContainText('Seu tempo, parado');
    await expect(seuTempo(cartao).getByRole('button', { name: 'Continuar' })).toBeVisible();
    await expect(cartao.getByRole('timer')).toHaveText('3 min');
    // E ao fechar e abrir de novo, o tempo está lá
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    const deNovo = await abrirTarefa(page, 'Renovar a procuração');
    await expect(deNovo.getByRole('timer')).toHaveText('3 min');
    await expect(seuTempo(deNovo).getByRole('button', { name: 'Continuar' })).toBeVisible();
  });

  test('dado "Adicionar tempo", quando escrevo a quantidade e o motivo, então o tempo entra nos registros', async ({ page }) => {
    // Dado
    const cartao = await abrirTarefa(page, 'Renovar a procuração');
    // Quando
    await seuTempo(cartao).getByRole('button', { name: 'Adicionar tempo' }).click();
    const janela = page.getByRole('dialog', { name: 'Adicionar tempo' });
    await janela.getByLabel('Quanto').fill('30min');
    await janela.getByLabel('Motivo').fill('Leitura dos autos fora do sistema');
    await janela.getByRole('button', { name: 'Adicionar' }).click();
    // Então
    await expect(cartao.getByRole('timer')).toHaveText('30 min');
    await tempoDaEquipe(cartao).getByRole('button', { name: 'Ver registros (1)' }).click();
    const registro = cartao.getByRole('list', { name: 'Seus registros' }).getByRole('listitem');
    await expect(registro).toContainText('À mão: Leitura dos autos fora do sistema');
    await expect(registro).toContainText('+30 min');
    // E, só com o meu tempo, a linha da equipe não tem o total
    await expect(tempoDaEquipe(cartao)).not.toContainText('Total da equipe');
  });
});

test.describe('O tempo da equipe (#442)', () => {
  test('dado duas pessoas com tempo, quando abro o cartão, então vejo "Total da equipe … · Ver registros (N)" e, ao abrir, os registros agrupados por pessoa', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    // Então
    await expect(tempoDaEquipe(cartao)).toHaveText(/^Total da equipe 2 h\s*·\s*Ver registros \(2\)$/);
    await expect(cartao.getByRole('group', { name: 'Registros de tempo' })).toHaveCount(0);
    // Quando
    await tempoDaEquipe(cartao).getByRole('button', { name: 'Ver registros (2)' }).click();
    // Então: um grupo por pessoa, da maior parte à menor, com o total de cada um
    const registros = cartao.getByRole('group', { name: 'Registros de tempo' });
    const grupos = registros.getByRole('group');
    await expect(grupos).toHaveCount(2);
    await expect(grupos.nth(0)).toHaveAccessibleName('Você');
    await expect(grupos.nth(0)).toContainText('1 h 20 min');
    await expect(grupos.nth(1)).toHaveAccessibleName('Bruno Exemplo Souza');
    await expect(grupos.nth(1)).toContainText('40 min');
    await expect(tempoDaEquipe(cartao).getByRole('button', { name: 'Esconder registros' })).toHaveAttribute('aria-expanded', 'true');
  });

  test('dado que só eu tenho tempo, quando abro o cartão, então a linha da equipe não aparece', async ({ page }) => {
    // Dado: o Bruno é o único com tempo em "Organizar a pasta"
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirTarefa(page, 'Organizar a pasta');
    // Então: sem o total da equipe (os registros continuam ao alcance)
    await expect(cartao.getByText(/^Total da equipe/)).toHaveCount(0);
    await expect(tempoDaEquipe(cartao).getByRole('button', { name: 'Ver registros (2)' })).toBeVisible();
  });

  test('dado quem não é administrador, quando abre os registros, então vê só os próprios; na tarefa concluída, a parte dos outros em %, sem a duração', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    await expect(tempoDaEquipe(cartao)).toContainText('Total da equipe 2 h');
    // Quando
    await tempoDaEquipe(cartao).getByRole('button', { name: 'Ver registros (1)' }).click();
    // Então: só os registros dele, sem o Mauro
    const registros = cartao.getByRole('group', { name: 'Registros de tempo' });
    await expect(registros.getByRole('list', { name: 'Seus registros' }).getByRole('listitem')).toHaveCount(1);
    await expect(registros).not.toContainText('Mauro');
    await expect(registros).not.toContainText('1 h 20 min');
    // Quando: a tarefa é concluída
    await cartao.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(page.getByText('Tarefa concluída.')).toBeVisible();
    const concluida = await abrirTarefa(page, 'Emitir a GRU');
    await tempoDaEquipe(concluida).getByRole('button', { name: 'Ver registros (1)' }).click();
    // Então: a parte do Mauro em %, sem a duração nem os registros dele
    const doMauro = concluida.getByRole('group', { name: 'Registros de tempo' }).getByRole('group', { name: 'Mauro Teixeira Duarte' });
    await expect(doMauro).toContainText('66,7%');
    await expect(doMauro).not.toContainText('1 h 20 min');
    await expect(doMauro.getByRole('listitem')).toHaveCount(0);
  });

  test('dado quem só lê a tarefa, quando abre o cartão, então vê o prazo e o total, sem botões', async ({ page }) => {
    // Dado: a chave da equipe ligada (quem não está na tarefa a vê só para ler)
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando: o Bruno abre "Renovar a procuração", em que não está
    const cartao = await abrirTarefa(page, 'Renovar a procuração', false);
    // Então
    await expect(prazoDoCartao(cartao)).toContainText('Venceu há 1 dia');
    await expect(cartao.getByRole('group', { name: 'Prazo e tempo' }).getByRole('button')).toHaveCount(0);
    await expect(seuTempo(cartao)).toHaveCount(0);
  });
});

test.describe('No celular, no tema escuro (#442)', () => {
  test.use({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' });

  test('dado o celular e o modo escuro, quando abro o cartão, então tudo fica legível, com botões de 44 px', async ({ page }) => {
    // Quando
    const cartao = await abrirTarefa(page, 'Emitir a GRU');
    // Então: os botões do tempo com o alvo do dedo, lado a lado, sem rolagem para o lado
    const tempo = seuTempo(cartao);
    for (const nome of ['Continuar', 'Adicionar tempo']) {
      const caixa = (await tempo.getByRole('button', { name: nome }).boundingBox())!;
      expect(caixa.height).toBeGreaterThanOrEqual(44);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(375);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    // E o texto não some no fundo escuro: a frase do prazo e o relógio têm cor diferente da do cartão
    for (const alvo of [prazoDoCartao(cartao).getByText('Faltam 2 dias'), cartao.getByRole('timer')]) {
      const [cor, fundo] = await alvo.evaluate(el => {
        let f = el as HTMLElement | null;
        while (f && getComputedStyle(f).backgroundColor === 'rgba(0, 0, 0, 0)') f = f.parentElement;
        return [getComputedStyle(el).color, f ? getComputedStyle(f).backgroundColor : ''];
      });
      expect(cor).not.toBe(fundo);
    }
  });
});
