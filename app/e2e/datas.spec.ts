// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Datas (#357): o cartão de tarefa e de demanda mostra a data de criação e a de início (que se muda na janela das datas, #422, com o
// calendário pequeno), o quadro e a tabela ordenam e filtram pelo início, e os campos de data dos cadastros têm o calendário
// pequeno no computador e o do aparelho no celular. Na semente, as tarefas e demandas foram criadas hoje (começam hoje).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo, mudarPrazo, prazoDoCartao, seuTempo, tempoDaEquipe } from './ajudantes';

const FUSO = 'America/Sao_Paulo';
/** Hoje em Brasília, como o cartão mostra (dd/mm/aaaa). */
const hoje = () => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO }).format(new Date());
/** O dia 10 do mês seguinte, como o calendário o nomeia (", 10 de dezembro de 2026") e como o campo o mostra. */
function dia10DoMesSeguinte() {
  const [, m, a] = hoje().split('/').map(Number);
  const data = new Date(Date.UTC(a, m, 10, 12));
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(data);
  return { nome: new RegExp(`, 10 de ${mes} de ${data.getUTCFullYear()}`), texto: `10/${String(data.getUTCMonth() + 1).padStart(2, '0')}/${data.getUTCFullYear()}` };
}
/** O mesmo dia de hoje no mês seguinte (o último dia dele, se não tiver o de hoje), como o PageDown do calendário anda. */
function hojeNoMesSeguinte() {
  const [d, m, a] = hoje().split('/').map(Number);
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const data = new Date(Date.UTC(a, m, Math.min(d, ultimo), 12));
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(data);
  return {
    mes: `${mes} de ${data.getUTCFullYear()}`,
    texto: new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data)
  };
}
const escapar = (t: string) => t.replace(/[/]/g, '\\/');

/** Abre o cartão pela tabela do módulo. O cartão é achado pelo título, porque o calendário também é uma janela (dialog). */
async function abrirCartao(page: Page, modulo: 'tarefas' | 'demandas', titulo: string) {
  await page.goto(`/${modulo}/`);
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: titulo, level: 2 }) });
  await expect(cartao).toBeVisible();
  return cartao;
}
const calendario = (page: Page) => page.getByRole('dialog', { name: 'Calendário' });

/** O resumo das datas no cartão da demanda (#422), que abre a janela das datas. No da tarefa, desde a #442, é o link "Mudar prazo". */
const resumoDasDatas = (cartao: Locator) => cartao.getByRole('button', { name: /^Datas: / });
/** A janela das datas (#422): flutua sobre o cartão, e por isso é achada na página, e não dentro dele. */
const janelaDasDatas = (page: Page) => page.getByRole('dialog', { name: 'Mudar as datas' });
/** O calendário do mês, sempre aberto na janela das datas. */
const calendarioDaJanela = (page: Page) => janelaDasDatas(page).getByRole('group', { name: 'Calendário' });
/**
 * O início da tarefa (#442: ele saiu do cartão e fica só na janela das datas). O link "Mudar prazo" leva o resumo antigo (o início, a
 * entrega e o lembrete) como descrição, para o leitor de tela; é por ela que o teste confere o início sem abrir a janela.
 */
const inicioDaTarefa = (cartao: Locator, data: string) => expect(mudarPrazo(cartao)).toHaveAccessibleDescription(new RegExp(`Início ${escapar(data)}`));
/** A criação da tarefa, no rodapé do cartão (#442: saiu do bloco das datas). */
const criacaoNoRodape = (cartao: Locator) => cartao.getByText(/^Criada em \d{2}\/\d{2}\/\d{4} por /);

test.describe('Data de criação e data de início no cartão (#357, #422)', () => {
  test('dada uma tarefa, quando a pessoa abre a janela das datas e muda o início pelo calendário, então a data fica salva ao fechar e abrir, e no histórico', async ({ page }) => {
    // Dado
    // (#442: a criação fica no rodapé, e o início, só na janela das datas, que o link "Mudar prazo" abre)
    let cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await expect(criacaoNoRodape(cartao)).toContainText(`Criada em ${hoje()}`);
    await inicioDaTarefa(cartao, hoje());
    // Quando: abre a janela, clica no início (o calendário passa a escrever nele), escreve um dia de outro mês (o calendário vai
    // para ele), escolhe outro dia nele e salva
    await mudarPrazo(cartao).click();
    await expect(calendarioDaJanela(page)).toBeVisible();
    await janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' }).click();
    await janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' }).fill('15/12/2030');
    await expect(calendarioDaJanela(page).getByRole('grid', { name: 'dezembro de 2030' })).toBeVisible();
    await calendarioDaJanela(page).getByRole('button', { name: 'sexta-feira, 20 de dezembro de 2030' }).click();
    await janelaDasDatas(page).getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(janelaDasDatas(page)).toHaveCount(0);
    await inicioDaTarefa(cartao, '20/12/2030');
    await expect(criacaoNoRodape(cartao)).toContainText(`Criada em ${hoje()}`);
    // E ao fechar e abrir de novo
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await inicioDaTarefa(cartao, '20/12/2030');
    await mudarPrazo(cartao).click();
    await expect(janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' })).toHaveValue('20/12/2030');
    await page.keyboard.press('Escape');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText('Data de início:', { exact: true })).toBeVisible();
    await expect(cartao.getByText('Data de início:', { exact: true }).locator('..')).toContainText('20/12/2030');
  });

  test('dada uma demanda, quando a pessoa escreve o início à mão e aperta Enter, então ele muda; e Esc na janela desfaz sem fechar o cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'demandas', 'Notificar o devedor');
    await expect(cartao.getByText(/^Criada em \d{2}\/\d{2}\/\d{4}$/)).toHaveText(`Criada em ${hoje()}`);
    await expect(resumoDasDatas(cartao)).toContainText(`Início ${hoje()}`);
    // Quando: muda o início e aperta Esc
    await resumoDasDatas(cartao).click();
    await janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' }).fill('01/01/2031');
    await page.keyboard.press('Escape');
    // Então: nada muda, e o cartão continua aberto
    await expect(janelaDasDatas(page)).toHaveCount(0);
    await expect(cartao).toBeVisible();
    await expect(resumoDasDatas(cartao)).toContainText(`Início ${hoje()}`);
    // Quando: escreve à mão e aperta Enter
    await resumoDasDatas(cartao).click();
    const campo = janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' });
    await campo.fill('01022031');
    await campo.press('Enter');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Demanda atualizada.' })).toBeVisible();
    await expect(resumoDasDatas(cartao)).toContainText('Início 01/02/2031');
  });

  // Desde a #361, o início muda só nas datas do cartão: o lápis não o repete.
  test('dada uma tarefa, quando a pessoa usa o lápis, então a data de início não está no formulário, e salvar não a muda', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    // Então
    await expect(edicao.getByLabel(/Responsável/)).toBeVisible();
    await expect(edicao.getByLabel('Data de início')).toHaveCount(0);
    // Quando
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(edicao).toHaveCount(0);
    await inicioDaTarefa(cartao, hoje());
  });
});

test.describe('Ordem e filtro pela data de início (#357)', () => {
  /** Muda o início de uma tarefa pela janela das datas do cartão e o fecha. */
  async function mudarInicio(page: Page, titulo: string, data: string) {
    const cartao = await abrirCartao(page, 'tarefas', titulo);
    await mudarPrazo(cartao).click();
    const campo = janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' });
    await campo.fill(data);
    await campo.press('Enter');
    await inicioDaTarefa(cartao, data);
    await cartao.getByRole('button', { name: 'Fechar' }).click();
  }

  test('dada uma tarefa que começa depois, quando a pessoa filtra e ordena a tabela pelo início, então vê só as do período, na ordem do início, com a coluna Início', async ({ page }) => {
    // Dado
    await mudarInicio(page, 'Pedir documentos ao cliente', '20/12/2030');
    const linhas = page.getByRole('table').getByRole('row');
    // Quando: o filtro
    await page.getByRole('button', { name: 'Filtros' }).click();
    const filtros = page.getByRole('dialog', { name: 'Filtros' });
    await filtros.getByRole('combobox', { name: /^Início/ }).selectOption({ label: 'Ainda vai começar' });
    // Então
    await expect(linhas.filter({ hasText: 'Pedir documentos ao cliente' })).toHaveCount(1);
    await expect(linhas.filter({ hasText: 'Emitir a GRU' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Filtros (1 ligado)' })).toBeVisible();
    // Quando: tira o filtro e ordena pelo início, o que começa depois primeiro
    await filtros.getByRole('combobox', { name: /^Início/ }).selectOption({ label: 'Qualquer data' });
    await filtros.getByLabel('Ordenar').selectOption({ label: 'Início (o que começa depois primeiro)' });
    // Então
    await expect(page.getByRole('columnheader', { name: 'Início' })).toBeVisible();
    await expect(linhas.nth(1)).toContainText('Pedir documentos ao cliente');
    await expect(linhas.nth(1)).toContainText('20/12/2030');
    // Quando: o que começou antes primeiro
    await filtros.getByLabel('Ordenar').selectOption({ label: 'Início (o que começou antes primeiro)' });
    // Então
    await expect(linhas.last()).toContainText('Pedir documentos ao cliente');
  });

  test('dada uma coluna do quadro, quando a pessoa a ordena pelo início, então os cartões seguem o início e mostram a data dele', async ({ page }) => {
    // Dado: "Para fazer" tem, na ordem manual, "Pedir documentos ao cliente" e depois "Renovar a procuração"
    await mudarInicio(page, 'Pedir documentos ao cliente', '20/12/2030');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const coluna = page.getByRole('list', { name: 'Para fazer', exact: true });
    await expect(coluna.getByRole('listitem')).toHaveText([/Pedir documentos ao cliente/, /Renovar a procuração/]);
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Para fazer' }).click();
    await page.getByRole('menuitemradio', { name: 'Início (o que começou antes primeiro)' }).click();
    // Então
    await expect(coluna.getByRole('listitem')).toHaveText([/Renovar a procuração/, /Pedir documentos ao cliente/]);
    await expect(coluna.getByRole('listitem').last()).toContainText('Início: 20/12/2030');
    // Quando: o filtro vale também no quadro
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByRole('combobox', { name: /^Início/ }).selectOption({ label: 'Já começou (até hoje)' });
    // Então
    await expect(coluna.getByRole('listitem')).toHaveText([/Renovar a procuração/]);
  });
});

test.describe('Calendário pequeno nos cadastros (#357)', () => {
  test('dado o cadastro de tarefa, quando a pessoa clica no prazo, escolhe o dia no calendário e a hora ao lado, no mesmo campo, então os dois vão para o formulário', async ({ page }) => {
    // Dado
    const dia = dia10DoMesSeguinte();
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Protocolar a petição');
    // Quando
    await page.getByLabel('Prazo').click();
    await expect(calendario(page)).toBeVisible();
    await calendario(page).getByRole('button', { name: 'Próximo mês' }).click();
    await calendario(page).getByRole('button', { name: dia.nome }).click();
    // Então: o calendário fecha e o foco passa para a hora, ao lado da data, no mesmo campo (#299)
    await expect(calendario(page)).toHaveCount(0);
    const hora = page.getByLabel('Hora', { exact: true });
    await expect(hora).toBeFocused();
    await hora.fill('14:30');
    await expect(page.getByLabel('Prazo')).toHaveValue(dia.texto);
    await expect(hora).toHaveValue('14:30');
    // E quando salva, então o cartão mostra o prazo com a hora
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // (#442: o prazo fica na folhinha, com a hora embaixo; o selo do topo saiu do cartão aberto)
    await expect(prazoDoCartao(page.getByRole('dialog'))).toContainText(dia.texto);
    await expect(prazoDoCartao(page.getByRole('dialog'))).toContainText('Às 14:30');
  });

  test('dado o cadastro de compromisso, quando a pessoa usa o teclado no calendário, então a seta para baixo entra nele e o Enter escolhe', async ({ page }) => {
    // Dado
    const seguinte = hojeNoMesSeguinte();
    await page.goto('/agenda/novo/');
    const data = page.getByRole('textbox', { name: /^Data/ });
    await data.focus();
    // Quando
    await data.press('ArrowDown');
    await expect(calendario(page).getByRole('button', { name: /\(hoje\)$/ })).toBeFocused();
    await page.keyboard.press('PageDown');
    // Então: o PageDown leva ao mesmo dia do mês seguinte
    await expect(calendario(page).getByRole('grid', { name: seguinte.mes })).toBeVisible();
    // Quando
    await page.keyboard.press('Enter');
    // Então: o dia escolhido vai para o campo, o calendário fecha e o foco passa para a hora, ao lado da data (#299)
    await expect(data).toHaveValue(seguinte.texto);
    await expect(calendario(page)).toHaveCount(0);
    await expect(page.getByLabel('Hora', { exact: true })).toBeFocused();
  });
});

test.describe('Dado um celular (#357)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('quando a pessoa toca no campo de data, então é o campo de data do próprio aparelho, e a data escolhida nele é gravada', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Juntar o substabelecimento');
    const prazo = page.getByLabel('Prazo');
    // Então
    await expect(prazo).toHaveAttribute('type', 'date');
    await expect(page.getByRole('button', { name: 'Abrir o calendário' })).toHaveCount(0);
    // E quando escolhe uma data nele e salva a tarefa
    await prazo.fill('2030-11-10');
    await expect(prazo).toHaveValue('2030-11-10');
    // A hora fica ao lado, no mesmo campo, e o sino do lembrete logo depois (#299)
    await expect(page.getByLabel('Hora', { exact: true })).toHaveAttribute('type', 'time');
    await expect(page.getByRole('button', { name: 'Lembrete: Sem lembrete' })).toBeEnabled();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então o cartão mostra o prazo escolhido
    await expect(prazoDoCartao(page.getByRole('dialog'))).toContainText('10/11/2030');
  });

  test('dado o cartão de uma tarefa, quando a pessoa toca nas datas, então a janela abre com o calendário do mês, e o dia tocado nele é salvo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await inicioDaTarefa(cartao, hoje());
    // Quando (#442: toca em "Mudar prazo"; o início está dentro da janela)
    await mudarPrazo(cartao).tap();
    await janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' }).tap();
    await calendarioDaJanela(page).getByRole('button', { name: 'Próximo mês' }).tap();
    const dia = dia10DoMesSeguinte();
    await calendarioDaJanela(page).getByRole('button', { name: dia.nome }).tap();
    await janelaDasDatas(page).getByRole('button', { name: 'Salvar' }).tap();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await inicioDaTarefa(cartao, dia.texto);
  });
});

test.describe('Tempo, datas e prazos no cartão (#361, #422)', () => {
  /** A primeira linha do histórico com este campo (a mais nova vem primeiro). */
  const doHistorico = (cartao: Locator, campo: string) => cartao.getByRole('listitem').filter({ hasText: campo }).first();
  /** Abre o cartão de um compromisso pela tabela da agenda. */
  async function abrirCompromisso(page: Page, nome: string) {
    await page.goto('/agenda/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: nome }).click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nome, level: 2 }) });
    await expect(cartao).toBeVisible();
    return cartao;
  }
  /** A janela da data e do horário do compromisso. */
  const janelaDoQuando = (page: Page) => page.getByRole('dialog', { name: 'Mudar a data e o horário' });

  test('dada uma tarefa, quando a pessoa escolhe a entrega no calendário da janela, a hora e o lembrete, então salva, fica ao fechar e abrir e no histórico', async ({ page }) => {
    // Dado: o prazo na folhinha e, ao lado, o relógio (#442: sem a faixa das datas, com a criação e o resumo, nem a faixa do tempo)
    let cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const bloco = cartao.getByRole('group', { name: 'Prazo e tempo' });
    await expect(bloco.getByRole('group', { name: 'Prazo', exact: true })).toContainText('Faltam 2 dias');
    await expect(seuTempo(bloco).getByRole('timer')).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
    // E no cartão, nenhum campo
    await expect(cartao.getByRole('textbox', { name: 'Prazo', exact: true })).toHaveCount(0);
    // Quando: abre a janela; ela tem o calendário, o início, a entrega com a caixa de marcar, a hora, o lembrete, Salvar e Remover
    await mudarPrazo(cartao).click();
    const janela = janelaDasDatas(page);
    await expect(calendarioDaJanela(page)).toBeVisible();
    await expect(janela.getByRole('textbox', { name: 'Data de início' })).toBeVisible();
    await expect(janela.getByRole('checkbox', { name: 'Entrega' })).toBeChecked();
    await expect(janela.getByLabel('Hora do prazo')).toBeVisible();
    await expect(janela.getByRole('combobox', { name: 'Lembrete' })).toBeVisible();
    await expect(janela.getByRole('button', { name: 'Remover' })).toBeVisible();
    // Quando: escreve um dia de outro mês na entrega, escolhe outro no calendário, a hora e o lembrete
    await janela.getByRole('textbox', { name: 'Prazo', exact: true }).fill('15/12/2030');
    await calendarioDaJanela(page).getByRole('button', { name: 'sexta-feira, 20 de dezembro de 2030' }).click();
    await expect(janela.getByRole('textbox', { name: 'Prazo', exact: true })).toHaveValue('20/12/2030');
    await janela.getByLabel('Hora do prazo').selectOption('14:30');   // desde a #431, a hora vem numa lista de horários
    await janela.getByRole('combobox', { name: 'Lembrete' }).selectOption({ label: '1 hora antes' });
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(janela).toHaveCount(0);
    await expect(prazoDoCartao(cartao)).toContainText('20/12/2030');
    await expect(prazoDoCartao(cartao)).toContainText('Às 14:30 · lembrete 1 h antes');
    // (#442: o selo do prazo saiu do topo do cartão aberto; ele continua no quadro e na lista)
    await expect(cartao).not.toContainText('Prazo: 20/12/2030 às 14:30');
    // E ao fechar e abrir de novo, e no histórico
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await expect(prazoDoCartao(cartao)).toContainText('20/12/2030');
    await expect(prazoDoCartao(cartao)).toContainText('Às 14:30 · lembrete 1 h antes');
    await abrirSecao(cartao, 'Histórico de alterações');
    const mudanca = doHistorico(cartao, 'Hora do prazo:');
    await expect(mudanca).toContainText('20/12/2030');
    await expect(mudanca).toContainText('14:30');
    await expect(mudanca).toContainText('1 hora antes');
  });

  test('dada uma tarefa, quando a pessoa muda o prazo e clica em Desfazer, então o prazo de antes volta', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const antes = await prazoDoCartao(cartao).textContent();
    // Quando
    await mudarPrazo(cartao).click();
    const campo = janelaDasDatas(page).getByRole('textbox', { name: 'Prazo', exact: true });
    await campo.fill('01/02/2031');
    await campo.press('Enter');
    await expect(prazoDoCartao(cartao)).toContainText('01/02/2031');
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(prazoDoCartao(cartao)).toHaveText(antes!);
  });

  test('dada uma tarefa com prazo, quando a pessoa usa o Remover, então o prazo sai e o cartão diz "Sem prazo", com "Definir prazo"', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await mudarPrazo(cartao).click();
    // Quando
    await janelaDasDatas(page).getByRole('button', { name: 'Remover' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(janelaDasDatas(page)).toHaveCount(0);
    await expect(prazoDoCartao(cartao)).toContainText('Sem prazo');
    await expect(mudarPrazo(cartao)).toHaveText('Definir prazo');
    await inicioDaTarefa(cartao, hoje());
  });

  test('dada uma demanda, quando a pessoa muda o prazo de entrega e a hora na janela, então fica ao fechar e abrir e no histórico; Esc não fecha o cartão', async ({ page }) => {
    // Dado
    let cartao = await abrirCartao(page, 'demandas', 'Notificar o devedor');
    const faixa = cartao.getByRole('group', { name: 'Datas do cartão', exact: true });
    for (const dado of ['Criada em', 'Datas']) await expect(faixa.getByRole('group', { name: dado, exact: true })).toBeVisible();
    // Quando: abre e desiste com Esc
    await resumoDasDatas(cartao).click();
    await page.keyboard.press('Escape');
    // Então
    await expect(janelaDasDatas(page)).toHaveCount(0);
    await expect(cartao).toBeVisible();
    // Quando: escreve o prazo e a hora e aperta Enter
    await resumoDasDatas(cartao).click();
    const janela = janelaDasDatas(page);
    await janela.getByRole('checkbox', { name: 'Entrega' }).check();
    await janela.getByRole('textbox', { name: 'Prazo de entrega', exact: true }).fill('10/03/2031');
    await janela.getByLabel('Hora do prazo de entrega').selectOption('16:00');   // desde a #431, a hora vem numa lista de horários
    await janela.getByLabel('Hora do prazo de entrega').press('Enter');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Demanda atualizada.' })).toBeVisible();
    await expect(resumoDasDatas(cartao)).toContainText('Entrega 10/03/2031 às 16:00');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCartao(page, 'demandas', 'Notificar o devedor');
    await expect(resumoDasDatas(cartao)).toContainText('Entrega 10/03/2031 às 16:00');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(doHistorico(cartao, 'Hora do prazo:')).toContainText('10/03/2031');
  });

  test('dado um compromisso, quando a pessoa muda a data e o horário na janela, então ficam ao fechar e abrir e no histórico', async ({ page }) => {
    // Dado
    let cartao = await abrirCompromisso(page, 'Reunião de equipe');
    const quando = () => cartao.getByRole('button', { name: /^Data e horário: / });
    await expect(quando()).toContainText(`${hoje()} · 09:00`);
    // Quando
    await quando().click();
    const janela = janelaDoQuando(page);
    await expect(janela.getByRole('group', { name: 'Calendário' })).toBeVisible();
    await janela.getByRole('textbox', { name: 'Data' }).fill('25/11/2030');
    await janela.getByLabel('Hora do compromisso').selectOption('15:00');   // desde a #431, a hora vem numa lista de horários
    await janela.getByLabel('Até').selectOption('16:00');   // desde a #431, a hora vem numa lista de horários
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Compromisso atualizado.' })).toBeVisible();
    await expect(quando()).toContainText('25/11/2030 · 15:00 às 16:00');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCompromisso(page, 'Reunião de equipe');
    await expect(quando()).toContainText('25/11/2030 · 15:00 às 16:00');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(doHistorico(cartao, 'Fim:')).toContainText('25/11/2030');
  });

  test('dada uma reunião, quando a pessoa tira a hora na janela, então pede a hora, como o cadastro, e não grava', async ({ page }) => {
    // Dado
    const cartao = await abrirCompromisso(page, 'Reunião de equipe');
    await cartao.getByRole('button', { name: /^Data e horário: / }).click();
    const janela = janelaDoQuando(page);
    // Quando
    await janela.getByLabel('Hora do compromisso').selectOption('');   // desde a #431, a hora vem numa lista de horários
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(janela.getByRole('alert')).toHaveText('Informe a hora.');
    await expect(janela).toBeVisible();
  });

  test('dado um cartão que a pessoa só lê, quando clica nas datas, então nada abre: as datas são texto', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno vê "Renovar a procuração", em que não está, só para ler
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    const tarefa = await abrirCartao(page, 'tarefas', 'Renovar a procuração');
    const prazo = prazoDoCartao(tarefa);
    // Quando (#442: o prazo na folhinha, sem o link)
    await prazo.getByText(/^Venceu há/).click();
    // Então: o prazo é texto, nenhuma janela abre, e o relógio não aparece (é de quem altera)
    await expect(prazo.getByRole('button')).toHaveCount(0);
    await expect(janelaDasDatas(page)).toHaveCount(0);
    await expect(prazo).toContainText(/\d{2}\/\d{2}\/\d{4}/);
    await expect(tarefa.getByRole('timer')).toHaveCount(0);
    await expect(seuTempo(tarefa)).toHaveCount(0);
    await expect(tempoDaEquipe(tarefa).getByRole('button')).toHaveCount(0);
    // E o compromisso que o Bruno só vê pela Agenda geral
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(false));
    const compromisso = await abrirCompromisso(page, 'Reunião de equipe');
    await compromisso.getByRole('group', { name: 'Data e horário', exact: true }).click();
    await expect(compromisso.getByRole('group', { name: 'Datas do cartão' }).getByRole('button')).toHaveCount(0);
    await expect(janelaDoQuando(page)).toHaveCount(0);
  });

  test('dada uma tarefa, quando a pessoa muda o prazo na janela e clica fora dela, então a janela fecha sem gravar nada, e o cartão fecha sem perguntar', async ({ page }) => {
    // Dado
    let cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const antes = await prazoDoCartao(cartao).textContent();
    await mudarPrazo(cartao).click();
    await janelaDasDatas(page).getByRole('textbox', { name: 'Prazo', exact: true }).fill('20/12/2030');
    // Quando: clica fora da janela (no título do cartão)
    await cartao.getByRole('heading', { name: 'Emitir a GRU', level: 2 }).click({ position: { x: 1, y: 1 } });
    // Então: a janela fecha sem gravar, e o cartão fecha sem perguntar (não sobrou nada por salvar)
    await expect(janelaDasDatas(page)).toHaveCount(0);
    await expect(prazoDoCartao(cartao)).toHaveText(antes!);
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
    cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await expect(prazoDoCartao(cartao)).toHaveText(antes!);
  });
});

/** Espera o cartão terminar de entrar (ou de ir para o centro), para medir. */
async function esperarOCartao(lugar: Locator) {
  await lugar.evaluate(async el => {
    const animacoes = el.ownerDocument.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.target?.contains(el));
    await Promise.allSettled(animacoes.map(a => a.finished));
  });
}
/** Onde ficam o nome e o valor (o texto dele, sem a folga do botão) de cada dado da faixa, na ordem pedida. */
async function dadosDaFaixa(faixa: Locator, dados: string[]) {
  await esperarOCartao(faixa);
  const medidas = [];
  for (const dado of dados) {
    const caixa = faixa.getByRole('group', { name: dado, exact: true });
    const nome = (await caixa.getByText(dado, { exact: true }).boundingBox())!;
    const valor = await caixa.evaluate((el, rotulo) => {
      // O primeiro texto depois do nome: a data, o prazo ou "Sem prazo".
      const textos = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let texto = textos.nextNode();
      while (texto && (!texto.textContent!.trim() || texto.textContent === rotulo)) texto = textos.nextNode();
      const faixaDoTexto = el.ownerDocument.createRange();
      faixaDoTexto.selectNodeContents(texto!);
      const r = faixaDoTexto.getBoundingClientRect();
      return { x: r.x, y: r.y, linhas: faixaDoTexto.getClientRects().length };
    }, dado);
    medidas.push({ caixa: (await caixa.boundingBox())!, nome, valor });
  }
  return medidas;
}
type Caixa = { x: number; y: number; width: number; height: number };
/** A folga das medidas: as frações de pixel do navegador. */
const UM_PIXEL = 1;
/** O alvo mínimo do dedo nos botões do tempo (o --alvo-de-toque). */
const ALVO = 44;
/** O bloco do prazo e do tempo da tarefa (#442) e as partes dele que os testes medem. */
const partesDoBloco = (cartao: Locator) => {
  const bloco = cartao.getByRole('group', { name: 'Prazo e tempo' });
  const tempo = seuTempo(bloco);
  return { bloco, prazo: prazoDoCartao(bloco), tempo, botao: tempo.getByRole('button', { name: /^(Iniciar|Continuar|Parar)$/ }),
    adicionar: tempo.getByRole('button', { name: 'Adicionar tempo' }), equipe: tempoDaEquipe(cartao) };
};
/** Os botões do tempo (#442): lado a lado, na mesma altura, com o alvo do dedo, e inteiros dentro do bloco. */
function conferirOsBotoes(botao: Caixa, adicionar: Caixa, bloco: Caixa) {
  expect(Math.abs(botao.y - adicionar.y)).toBeLessThanOrEqual(UM_PIXEL);
  expect(adicionar.x).toBeGreaterThanOrEqual(botao.x + botao.width);
  for (const b of [botao, adicionar]) {
    expect(b.height).toBeGreaterThanOrEqual(ALVO - UM_PIXEL);
    expect(b.x).toBeGreaterThanOrEqual(bloco.x - UM_PIXEL);
    expect(b.x + b.width).toBeLessThanOrEqual(bloco.x + bloco.width + UM_PIXEL);
  }
}

// A regra mudou na #442 (opção 9, aprovada pelo dono): a faixa das datas (a criação e o resumo do início e do prazo) e a faixa do
// tempo (o relógio, a pílula e os botões empilhados, #434/#436) saíram do cartão da tarefa. No lugar, um bloco só, "Prazo e tempo":
// o prazo na folhinha à esquerda e o relógio à direita (uma embaixo do outro, quando as duas colunas não cabem), os botões lado a
// lado e, embaixo, a linha da equipe. A demanda continua com as duas faixas (testes logo abaixo).
test.describe('Dado um computador, o bloco do prazo e do tempo da tarefa (#442)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('quando a pessoa abre o cartão da tarefa no centro, então o prazo fica à esquerda e o relógio à direita, alinhados pelo topo, os botões lado a lado, e a linha da equipe embaixo', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    await expect(page.getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
    const p = partesDoBloco(cartao);
    await expect(p.tempo.getByRole('timer')).toBeVisible();
    await esperarOCartao(p.bloco);
    const [bloco, prazo, tempo, botao, adicionar, equipe] = await Promise.all([p.bloco, p.prazo, p.tempo, p.botao, p.adicionar, p.equipe]
      .map(async l => (await l.boundingBox())!));
    // Então
    expect(tempo.x).toBeGreaterThanOrEqual(prazo.x + prazo.width);
    expect(Math.abs(tempo.y - prazo.y)).toBeLessThanOrEqual(UM_PIXEL);
    conferirOsBotoes(botao, adicionar, bloco);
    expect(equipe.y).toBeGreaterThanOrEqual(bloco.y + bloco.height);
    await expect(p.equipe).toContainText('Total da equipe 2 h');
  });

  test('quando a pessoa abre o cartão da tarefa ao lado, então o prazo e o relógio cabem no painel, sem nada quebrar, e os botões ficam lado a lado', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const p = partesDoBloco(cartao);
    await expect(p.tempo.getByRole('timer')).toBeVisible();
    await esperarOCartao(p.bloco);
    const [bloco, prazo, tempo, botao, adicionar] = await Promise.all([p.bloco, p.prazo, p.tempo, p.botao, p.adicionar].map(async l => (await l.boundingBox())!));
    // Então: o relógio ao lado do prazo ou, sem lugar para as duas colunas, embaixo dele; nunca por cima
    expect(tempo.x >= prazo.x + prazo.width || tempo.y >= prazo.y + prazo.height).toBe(true);
    conferirOsBotoes(botao, adicionar, bloco);
    await expect(cartao.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
  });
});

test.describe('Dado um celular, o bloco do prazo e do tempo da tarefa (#442)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const esquema of ['light', 'dark'] as const) {
    test(`quando a pessoa abre o cartão da tarefa (tema ${esquema === 'dark' ? 'escuro' : 'claro'}), então o prazo fica em cima e o relógio embaixo, os botões lado a lado, com 44 px, e nada sai do cartão`, async ({ page }) => {
      // Dado
      await page.emulateMedia({ colorScheme: esquema });
      // Quando
      const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
      const p = partesDoBloco(cartao);
      await expect(p.tempo.getByRole('timer')).toBeVisible();
      await esperarOCartao(p.bloco);
      const [bloco, prazo, tempo, botao, adicionar] = await Promise.all([p.bloco, p.prazo, p.tempo, p.botao, p.adicionar].map(async l => (await l.boundingBox())!));
      // Então
      expect(tempo.y).toBeGreaterThanOrEqual(prazo.y + prazo.height);
      conferirOsBotoes(botao, adicionar, bloco);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      // E a linha da equipe e os registros abertos também cabem
      await p.equipe.getByRole('button', { name: /^Ver registros/ }).click();
      const registros = cartao.getByRole('group', { name: 'Registros de tempo' });
      for (const acao of await registros.getByRole('button').all()) {
        const c = (await acao.boundingBox())!;
        expect(c.x + c.width).toBeLessThanOrEqual(bloco.x + bloco.width + UM_PIXEL);
        expect(c.height).toBeGreaterThanOrEqual(ALVO - UM_PIXEL);
      }
    });
  }

  test('dada uma demanda sem prazo, quando a pessoa abre o cartão, então "Sem prazo" fica numa linha só, alinhado com as outras datas', async ({ page }) => {
    // Quando: "Busca de anterioridade" não tem prazo
    const cartao = await abrirCartao(page, 'demandas', 'Busca de anterioridade');
    // Então
    const medidas = await dadosDaFaixa(cartao.getByRole('group', { name: 'Datas do cartão', exact: true }), ['Criada em', 'Datas']);
    await expect(cartao.getByRole('group', { name: 'Datas', exact: true })).toContainText('Sem prazo');
    for (const m of medidas) {
      expect(m.valor.linhas).toBe(1);
      expect(m.valor.x).toBeCloseTo(medidas[0].valor.x, 0);
    }
  });
});

test.describe('Dada uma demanda, a faixa do tempo (#383)', () => {
  test('com tempo nas tarefas, quando a pessoa abre o cartão, então a soma da equipe fica na faixa do tempo, logo abaixo das datas, e nada embaixo pula quando ela chega', async ({ page }) => {
    // Dado: as tarefas de "Registro de marca" têm 2 h 40 min (as do Mauro, do Bruno e o ajuste)
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Onde a descrição (o que vem logo abaixo das faixas, desde a #399, que tirou a linha dos botões rápidos) aparece a cada mudança
    // da tela, enquanto o cartão abre
    await page.evaluate(() => {
      const alturas: number[] = [];
      (window as unknown as { alturasDaSituacao: number[] }).alturasDaSituacao = alturas;
      new MutationObserver(() => {
        const situacao = [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent?.startsWith('Sem descrição'));
        if (situacao) alturas.push(Math.round(situacao.getBoundingClientRect().y));
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    // Quando
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).first().click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Registro de marca', level: 2 }) });
    // Então
    const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
    await expect(tempo.getByRole('group', { name: 'Tempo da equipe nas tarefas', exact: true })).toHaveText(/^Tempo da equipe nas tarefas\s*2 h 40 min$/);
    const datas = (await cartao.getByRole('group', { name: 'Datas do cartão', exact: true }).boundingBox())!;
    expect((await tempo.boundingBox())!.y).toBeGreaterThanOrEqual(datas.y + datas.height);
    // E a descrição nasceu onde ficou: a faixa do tempo já estava lá enquanto a soma chegava
    const alturas = await page.evaluate(() => (window as unknown as { alturasDaSituacao: number[] }).alturasDaSituacao);
    expect(alturas.length).toBeGreaterThan(0);
    expect(new Set(alturas).size).toBe(1);
  });

  test('sem tempo nas tarefas, quando a pessoa abre o cartão, então a faixa do tempo diz que ninguém registrou tempo', async ({ page }) => {
    // Quando: ninguém registrou tempo nas tarefas de "Busca de anterioridade"
    const cartao = await abrirCartao(page, 'demandas', 'Busca de anterioridade');
    // Então
    await expect(cartao.getByRole('group', { name: 'Tempo da equipe nas tarefas', exact: true })).toContainText('Ninguém registrou tempo ainda');
  });
});

test.describe('Dada a tarefa com o relógio, o botão Continuar/Parar (#383, #442)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // A regra mudou na #442: os botões são Iniciar, Parar e Continuar (antes, Iniciar, Pausar e Retomar), e a situação fica na linha de
  // cima do relógio ("Seu tempo, contando"). O botão continua começando no mesmo lugar.
  test('quando a pessoa aperta T para contar e de novo para parar, então o botão continua no mesmo lugar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const tempo = seuTempo(cartao);
    const botao = tempo.getByRole('button', { name: /^(Iniciar|Continuar|Parar)$/ });
    await expect(botao).toHaveText('Continuar');
    await esperarOCartao(tempo);
    const antes = (await botao.boundingBox())!;
    // Quando
    await page.keyboard.press('t');
    // Então
    await expect(botao).toHaveText('Parar');
    await expect(tempo).toContainText('Seu tempo, contando');
    expect((await botao.boundingBox())!.x).toBeCloseTo(antes.x, 0);
    // E de novo
    await page.keyboard.press('t');
    await expect(botao).toHaveText('Continuar');
    await expect(tempo).toContainText('Seu tempo, parado');
    expect((await botao.boundingBox())!.x).toBeCloseTo(antes.x, 0);
  });
});

/** Abre o cartão da primeira linha da tabela do módulo e espera ele entrar. */
async function abrirOPrimeiro(page: Page, endereco: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').nth(1).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  return cartao;
}
/** Os nomes da faixa ficam todos na mesma altura, e os valores também, cada um numa linha só. */
async function conferirAFaixa(cartao: Locator, dados: string[]) {
  const medidas = await dadosDaFaixa(cartao.getByRole('group', { name: 'Datas do cartão', exact: true }), dados);
  for (const m of medidas) {
    expect(m.nome.y).toBeCloseTo(medidas[0].nome.y, 0);
    expect(m.valor.y).toBeCloseTo(medidas[0].valor.y, 0);
    expect(m.valor.linhas).toBe(1);
  }
}

// Desde a #385, a faixa das datas só aparece com mais de uma data: com só a criação (a pessoa, o processo, a anotação, o contrato
// de quem não vê os valores), ela some, e a criação fica só no rodapé. Os testes da pessoa, do processo e da anotação, que
// conferiam a faixa com só a criação (#383), seguem a regra nova.
test.describe('Dados a pessoa, o contrato, o processo e a anotação, a faixa das datas (#383, #385)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('quando a pessoa abre o cartão da pessoa, então não há faixa das datas, e o cadastro fica só no rodapé', async ({ page }) => {
    // Quando
    const cartao = await abrirOPrimeiro(page, '/pessoas/');
    // Então
    await expect(cartao.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Cadastrada em', exact: true })).toHaveCount(0);
    await expect(cartao.getByText(/^Cadastrada em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  });

  test('quando a pessoa abre o cartão do contrato, então a criação e a assinatura ficam lado a lado na faixa, e a assinatura sai de Honorários', async ({ page }) => {
    // Quando: o contrato da Antônia foi assinado em 10/03/2026
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'ANTÔNIA SOUZA DEMONSTRAÇÃO' }).first().click();
    const cartao = page.getByRole('dialog');
    // Então
    await expect(cartao.getByRole('group', { name: 'Assinado em', exact: true })).toContainText('10/03/2026');
    await conferirAFaixa(cartao, ['Criado em', 'Assinado em']);
    await abrirSecao(cartao, 'Honorários');
    await expect(cartao.getByRole('term').filter({ hasText: 'Assinado em' })).toHaveCount(0);
  });

  test('dado quem não vê os valores do contrato, quando abre o cartão dele, então não há faixa das datas (sobraria só a criação), e a criação fica no rodapé', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno vê o contrato "Registro de marca" sem os valores (e sem a assinatura)
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    const linha = page.getByRole('row').filter({ hasText: 'Registro de marca' }).first();
    await expect(linha).toContainText('Oculto');
    await linha.click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('toda a equipe vê este contrato, sem os valores', { exact: false })).toBeVisible();
    // Então
    await expect(cartao.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Assinado em', exact: true })).toHaveCount(0);
    await expect(cartao.getByText(/^Criado em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  });

  test('quando a pessoa abre o cartão do processo, então não há faixa das datas, e a criação fica só no rodapé', async ({ page }) => {
    // Quando
    const cartao = await abrirOPrimeiro(page, '/processos/judicial/');
    // Então
    await expect(cartao.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Criado em', exact: true })).toHaveCount(0);
    await expect(cartao.getByText(/^Criado em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  });

  test('quando a pessoa escreve uma anotação, então não há faixa das datas entre o título e o texto, e a criação fica só no rodapé', async ({ page }) => {
    // Quando: a anotação nova vai ao banco quando a pessoa escreve o título
    await page.goto('/documentos/nova/');
    const titulo = page.getByRole('article', { name: 'Anotação nova' }).getByRole('textbox', { name: 'Título' });
    await titulo.fill('Estratégia do depósito');
    await titulo.press('Enter');
    const anotacao = page.getByRole('dialog', { name: 'Anotação', exact: true });
    // Então: o rodapé mostra a criação (a anotação já foi gravada), e a faixa não aparece
    await expect(anotacao.getByText(`Criada em ${hoje()}`)).toBeVisible();
    await expect(anotacao.getByRole('heading', { name: 'Estratégia do depósito', level: 2 })).toBeVisible();
    await expect(anotacao.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
    await expect(anotacao.getByRole('group', { name: 'Criada em', exact: true })).toHaveCount(0);
  });
});

test.describe('Dado um celular, a faixa das datas da anotação nova (#383)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('quando a anotação ainda não foi gravada, então não há faixa das datas', async ({ page }) => {
    // Quando
    await page.goto('/documentos/nova/');
    // Então
    await expect(page.getByRole('article', { name: 'Anotação nova' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Datas do cartão', exact: true })).toHaveCount(0);
  });
});
