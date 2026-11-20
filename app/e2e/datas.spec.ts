// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Datas (#357): o cartão de tarefa e de demanda mostra a data de criação e a de início (que se muda no próprio lugar, com o
// calendário pequeno), o quadro e a tabela ordenam e filtram pelo início, e os campos de data dos cadastros têm o calendário
// pequeno no computador e o do aparelho no celular. Na semente, as tarefas e demandas foram criadas hoje (começam hoje).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

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

test.describe('Data de criação e data de início no cartão (#357)', () => {
  test('dada uma tarefa, quando a pessoa abre o cartão e muda o início pelo calendário, então a data fica salva ao fechar e abrir, e no histórico', async ({ page }) => {
    // Dado
    let cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await expect(cartao.getByText(/^Criada em \d{2}\/\d{2}\/\d{4}$/)).toHaveText(`Criada em ${hoje()}`);
    const inicio = () => cartao.getByRole('button', { name: /^Data de início: / });
    await expect(inicio()).toHaveText(hoje());
    // Quando: clica no início, escreve um dia de outro mês (o calendário vai para ele) e escolhe outro dia nele
    await inicio().click();
    await expect(calendario(page)).toBeVisible();
    await expect(calendario(page).getByRole('button', { name: /\(hoje\)$/ })).toBeFocused();
    await cartao.getByRole('textbox', { name: 'Data de início' }).fill('15/12/2030');
    await expect(calendario(page).getByRole('grid', { name: 'dezembro de 2030' })).toBeVisible();
    await calendario(page).getByRole('button', { name: 'sexta-feira, 20 de dezembro de 2030' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(calendario(page)).toHaveCount(0);
    await expect(inicio()).toHaveText('20/12/2030');
    await expect(cartao.getByText(/^Criada em \d{2}\/\d{2}\/\d{4}$/)).toHaveText(`Criada em ${hoje()}`);
    // E ao fechar e abrir de novo
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await expect(inicio()).toHaveText('20/12/2030');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText('Data de início:', { exact: true })).toBeVisible();
    await expect(cartao.getByText('Data de início:', { exact: true }).locator('..')).toContainText('20/12/2030');
  });

  test('dada uma demanda, quando a pessoa escreve o início à mão e aperta Enter, então ele muda; e Esc no calendário desfaz sem fechar o cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'demandas', 'Notificar o devedor');
    await expect(cartao.getByText(/^Criada em \d{2}\/\d{2}\/\d{4}$/)).toHaveText(`Criada em ${hoje()}`);
    const inicio = cartao.getByRole('button', { name: /^Data de início: / });
    await expect(inicio).toHaveText(hoje());
    // Quando: Esc com o calendário aberto
    await inicio.click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    // Então: nada muda, e o cartão continua aberto
    await expect(calendario(page)).toHaveCount(0);
    await expect(cartao).toBeVisible();
    await expect(inicio).toHaveText(hoje());
    // Quando: escreve à mão
    await inicio.click();
    const campo = cartao.getByRole('textbox', { name: 'Data de início' });
    await campo.fill('01022031');
    await campo.press('Enter');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Demanda atualizada.' })).toBeVisible();
    await expect(inicio).toHaveText('01/02/2031');
  });

  // Desde a #361, o início muda só no grupo das datas do cartão: o lápis não o repete.
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
    await expect(cartao.getByRole('button', { name: /^Data de início: / })).toHaveText(hoje());
  });
});

test.describe('Ordem e filtro pela data de início (#357)', () => {
  /** Muda o início de uma tarefa pelo cartão e o fecha. */
  async function mudarInicio(page: Page, titulo: string, data: string) {
    const cartao = await abrirCartao(page, 'tarefas', titulo);
    await cartao.getByRole('button', { name: /^Data de início: / }).click();
    const campo = cartao.getByRole('textbox', { name: 'Data de início' });
    await campo.fill(data);
    await campo.press('Enter');
    await expect(cartao.getByRole('button', { name: /^Data de início: / })).toHaveText(data);
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
    await expect(page.getByRole('dialog').getByText(new RegExp(`Prazo: ${escapar(dia.texto)}`))).toBeVisible();
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
    await expect(page.getByRole('dialog').getByText(/Prazo: 10\/11\/2030/)).toBeVisible();
  });

  test('dado o cartão de uma tarefa, quando a pessoa toca no início, então o campo do aparelho aparece com o foco, e a data escolhida é salva', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const inicio = cartao.getByRole('button', { name: /^Data de início: / });
    await expect(inicio).toHaveText(hoje());
    // Quando
    await inicio.tap();
    // Então
    const doAparelho = cartao.getByLabel('Data de início', { exact: true });
    await expect(doAparelho).toHaveAttribute('type', 'date');
    await expect(doAparelho).toBeFocused();
    // Quando
    await doAparelho.fill('2030-12-20');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(inicio).toHaveText('20/12/2030');
  });
});

test.describe('Tempo, datas e prazos lado a lado no cartão (#361)', () => {
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

  test('dada uma tarefa, quando a pessoa clica no prazo, escolhe o dia no calendário, a hora ao lado e o lembrete no sino, então salva na hora, fica ao fechar e abrir e no histórico', async ({ page }) => {
    // Dado: a criação, o início e o prazo na faixa das datas, e o tempo na faixa dele, logo abaixo (#383)
    let cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const grupo = cartao.getByRole('group', { name: 'Datas', exact: true });
    for (const dado of ['Criada em', 'Início', 'Prazo']) await expect(grupo.getByRole('group', { name: dado, exact: true })).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Tempo', exact: true }).getByRole('group', { name: 'Seu tempo nesta tarefa', exact: true }).getByRole('timer')).toBeVisible();
    // Quando: clica no prazo
    await cartao.getByRole('button', { name: /^Prazo: / }).click();
    // Então: abre o calendário; a hora fica ao lado do prazo, no mesmo campo (#299), e o sino do lembrete ao lado
    const formulario = cartao.getByRole('group', { name: 'Mudar o prazo' });
    await expect(calendario(page)).toBeVisible();
    await expect(calendario(page).getByLabel('Hora')).toHaveCount(0);
    await expect(formulario.getByLabel('Hora do prazo')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Lembrete: Sem lembrete' })).toBeVisible();
    // Quando: escreve um dia de outro mês, escolhe outro no calendário (o foco vai para a hora), a hora e o lembrete
    await formulario.getByRole('textbox', { name: 'Prazo', exact: true }).fill('15/12/2030');
    await calendario(page).getByRole('button', { name: 'sexta-feira, 20 de dezembro de 2030' }).click();
    await expect(calendario(page)).toHaveCount(0);
    await expect(formulario.getByLabel('Hora do prazo')).toBeFocused();
    await formulario.getByLabel('Hora do prazo').fill('14:30');
    await formulario.getByRole('button', { name: /^Lembrete:/ }).click();
    await page.getByRole('menuitemradio', { name: '1 hora antes' }).click();
    await expect(formulario.getByRole('button', { name: 'Lembrete: 1 hora antes' })).toBeVisible();
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    await expect(formulario).toHaveCount(0);
    const prazo = () => cartao.getByRole('button', { name: /^Prazo: / });
    await expect(prazo()).toContainText('20/12/2030 às 14:30');
    await expect(prazo()).toContainText('Lembrete: 1 hora antes');
    await expect(cartao).toContainText('Prazo: 20/12/2030 às 14:30');   // o selo do topo
    // E ao fechar e abrir de novo, e no histórico
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await expect(prazo()).toContainText('20/12/2030 às 14:30');
    await abrirSecao(cartao, 'Histórico de alterações');
    const mudanca = doHistorico(cartao, 'Hora do prazo:');
    await expect(mudanca).toContainText('20/12/2030');
    await expect(mudanca).toContainText('14:30');
    await expect(mudanca).toContainText('1 hora antes');
  });

  test('dada uma tarefa, quando a pessoa muda o prazo e clica em Desfazer, então o prazo de antes volta', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const prazo = cartao.getByRole('button', { name: /^Prazo: / });
    const antes = await prazo.textContent();
    // Quando
    await prazo.click();
    const campo = cartao.getByRole('group', { name: 'Mudar o prazo' }).getByRole('textbox', { name: 'Prazo', exact: true });
    await campo.fill('01/02/2031');
    await campo.press('Enter');
    await expect(prazo).toContainText('01/02/2031');
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(prazo).toHaveText(antes!);
  });

  test('dada uma demanda, quando a pessoa muda o prazo de entrega e a hora no grupo, então fica ao fechar e abrir e no histórico; Esc não fecha o cartão', async ({ page }) => {
    // Dado
    let cartao = await abrirCartao(page, 'demandas', 'Notificar o devedor');
    const grupo = cartao.getByRole('group', { name: 'Datas' });
    for (const dado of ['Criada em', 'Início', 'Prazo de entrega']) await expect(grupo.getByRole('group', { name: dado, exact: true })).toBeVisible();
    const prazo = () => cartao.getByRole('button', { name: /^Prazo de entrega: / });
    // Quando: abre e desiste com Esc (o primeiro fecha o calendário; o segundo, o formulário)
    await prazo().click();
    const formulario = cartao.getByRole('group', { name: 'Mudar o prazo de entrega' });
    await expect(calendario(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(calendario(page)).toHaveCount(0);
    await formulario.getByRole('textbox', { name: 'Prazo de entrega', exact: true }).press('Escape');
    // Então
    await expect(formulario).toHaveCount(0);
    await expect(cartao).toBeVisible();
    // Quando: escreve o prazo e a hora e aperta Enter
    await prazo().click();
    await formulario.getByRole('textbox', { name: 'Prazo de entrega', exact: true }).fill('10/03/2031');
    await page.keyboard.press('Escape');
    await formulario.getByLabel('Hora').fill('16:00');
    await formulario.getByLabel('Hora').press('Enter');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Demanda atualizada.' })).toBeVisible();
    await expect(prazo()).toContainText('10/03/2031 às 16:00');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCartao(page, 'demandas', 'Notificar o devedor');
    await expect(prazo()).toContainText('10/03/2031 às 16:00');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(doHistorico(cartao, 'Hora do prazo:')).toContainText('10/03/2031');
  });

  test('dado um compromisso, quando a pessoa muda a data e o horário no grupo, então ficam ao fechar e abrir e no histórico', async ({ page }) => {
    // Dado
    let cartao = await abrirCompromisso(page, 'Reunião de equipe');
    const quando = () => cartao.getByRole('button', { name: /^Data e horário: / });
    await expect(quando()).toContainText(`${hoje()} · 09:00`);
    // Quando
    await quando().click();
    const formulario = cartao.getByRole('group', { name: 'Mudar a data e o horário' });
    await expect(calendario(page)).toBeVisible();
    await formulario.getByRole('textbox', { name: 'Data' }).fill('25/11/2030');
    await page.keyboard.press('Escape');
    await formulario.getByLabel('Hora').fill('15:00');
    await formulario.getByLabel('Até').fill('16:00');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Compromisso atualizado.' })).toBeVisible();
    await expect(quando()).toContainText('25/11/2030 · 15:00 às 16:00');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirCompromisso(page, 'Reunião de equipe');
    await expect(quando()).toContainText('25/11/2030 · 15:00 às 16:00');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(doHistorico(cartao, 'Fim:')).toContainText('25/11/2030');
  });

  test('dada uma reunião, quando a pessoa tira a hora no grupo, então pede a hora, como o cadastro, e não grava', async ({ page }) => {
    // Dado
    const cartao = await abrirCompromisso(page, 'Reunião de equipe');
    await cartao.getByRole('button', { name: /^Data e horário: / }).click();
    const formulario = cartao.getByRole('group', { name: 'Mudar a data e o horário' });
    await page.keyboard.press('Escape');
    // Quando
    await formulario.getByLabel('Hora').fill('');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(formulario.getByRole('alert')).toHaveText('Informe a hora.');
    await expect(formulario).toBeVisible();
  });

  test('dado um cartão que a pessoa só lê, quando clica nas datas, então nada vira campo', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno vê "Renovar a procuração", em que não está, só para ler
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    const tarefa = await abrirCartao(page, 'tarefas', 'Renovar a procuração');
    const grupo = tarefa.getByRole('group', { name: 'Datas', exact: true });
    // Quando
    await grupo.getByRole('group', { name: 'Prazo', exact: true }).click();
    await grupo.getByRole('group', { name: 'Início', exact: true }).click();
    // Então: o prazo e o início são texto, e o cronômetro não aparece (é de quem altera)
    await expect(grupo.getByRole('button')).toHaveCount(0);
    await expect(grupo.getByRole('textbox')).toHaveCount(0);
    await expect(grupo.getByRole('group', { name: 'Prazo', exact: true })).toContainText(/\d{2}\/\d{2}\/\d{4}/);
    await expect(tarefa.getByRole('timer')).toHaveCount(0);
    await expect(tarefa.getByRole('group', { name: 'Tempo', exact: true })).toHaveCount(0);
    // E o compromisso que o Bruno só vê pela Agenda geral
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(false));
    const compromisso = await abrirCompromisso(page, 'Reunião de equipe');
    await compromisso.getByRole('group', { name: 'Data e horário', exact: true }).click();
    await expect(compromisso.getByRole('group', { name: 'Datas' }).getByRole('button')).toHaveCount(0);
    await expect(compromisso.getByRole('group', { name: 'Datas' }).getByRole('textbox')).toHaveCount(0);
  });

  test('dada uma tarefa, quando a pessoa muda o prazo sem salvar e fecha o cartão, então o SEMPER pergunta antes, e o que ela mudou fica se ela continuar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    await cartao.getByRole('button', { name: /^Prazo: / }).click();
    const formulario = cartao.getByRole('group', { name: 'Mudar o prazo' });
    await formulario.getByRole('textbox', { name: 'Prazo', exact: true }).fill('20/12/2030');
    await page.keyboard.press('Escape');
    await expect(calendario(page)).toHaveCount(0);
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(pergunta).toBeVisible();
    await pergunta.getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(formulario.getByRole('textbox', { name: 'Prazo', exact: true })).toHaveValue('20/12/2030');
    // Quando: desiste da mudança (Cancelar), e aí fecha
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então: fecha sem perguntar
    await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Emitir a GRU', level: 2 })).toHaveCount(0);
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
/** As datas da tarefa, na ordem da faixa. */
const DATAS_DA_TAREFA = ['Criada em', 'Início', 'Prazo'];
/** O que fica lado a lado na faixa do tempo da tarefa (#383): o relógio, a situação, o botão e "Ajustar meu tempo". */
const partesDoTempo = (tempo: Locator) => [tempo.getByRole('timer'), tempo.getByText('pausado', { exact: true }),
  tempo.getByRole('button', { name: /^(Iniciar|Retomar|Pausar)/ }), tempo.getByRole('button', { name: 'Ajustar meu tempo' })];

test.describe('Dado um computador, a faixa das datas e a do tempo (#361, #383)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const formato of ['ao lado', 'no centro']) {
    test(`quando a pessoa abre o cartão da tarefa ${formato}, então as datas ficam lado a lado, os nomes numa linha e os valores alinhados na de baixo, e o tempo fica numa faixa própria, logo abaixo, com tudo lado a lado`, async ({ page }) => {
      // Quando
      const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
      if (formato === 'no centro') {
        await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
        await expect(page.getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
      }
      const datas = cartao.getByRole('group', { name: 'Datas', exact: true });
      const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
      await expect(tempo.getByRole('timer')).toBeVisible();
      // Então: as datas da esquerda para a direita, os nomes todos na mesma altura e os valores também, cada um numa linha só
      const medidas = await dadosDaFaixa(datas, DATAS_DA_TAREFA);
      for (let i = 1; i < medidas.length; i++) {
        expect(medidas[i].caixa.x).toBeGreaterThanOrEqual(medidas[i - 1].caixa.x + medidas[i - 1].caixa.width);
        expect(medidas[i].nome.y).toBeCloseTo(medidas[0].nome.y, 0);
        expect(medidas[i].valor.y).toBeCloseTo(medidas[0].valor.y, 0);
      }
      for (const m of medidas) expect(m.valor.linhas).toBe(1);
      // E o tempo, embaixo das datas, sem nada dele na faixa das datas: o relógio, a situação, o botão e o ajuste na mesma linha
      await expect(datas.getByRole('timer')).toHaveCount(0);
      const faixaDasDatas = (await datas.boundingBox())!;
      const partes = [];
      for (const parte of partesDoTempo(tempo)) partes.push((await parte.boundingBox())!);
      expect(partes[0].y).toBeGreaterThanOrEqual(faixaDasDatas.y + faixaDasDatas.height);
      for (let i = 1; i < partes.length; i++) {
        expect(partes[i].y).toBeLessThan(partes[0].y + partes[0].height);
        expect(partes[0].y).toBeLessThan(partes[i].y + partes[i].height);
        expect(partes[i].x).toBeGreaterThanOrEqual(partes[i - 1].x + partes[i - 1].width);
      }
      // E o resumo de quem registrou tempo fica na mesma faixa, logo embaixo
      await expect(tempo).toContainText('Total até agora: 2 h');
    });
  }
});

test.describe('Dado um celular, a faixa das datas e a do tempo (#361, #383)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('quando a pessoa abre o cartão da tarefa, então cada data fica numa linha, com os valores começando na mesma coluna, e o tempo cabe na faixa dele', async ({ page }) => {
    // Quando
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
    await expect(tempo.getByRole('timer')).toBeVisible();
    // Então: uma data embaixo da outra, o nome à esquerda e o valor à direita, na mesma altura
    const medidas = await dadosDaFaixa(cartao.getByRole('group', { name: 'Datas', exact: true }), DATAS_DA_TAREFA);
    for (let i = 1; i < medidas.length; i++) {
      expect(medidas[i].caixa.x).toBeCloseTo(medidas[0].caixa.x, 0);
      expect(medidas[i].caixa.y).toBeGreaterThanOrEqual(medidas[i - 1].caixa.y + medidas[i - 1].caixa.height);
      expect(medidas[i].valor.x).toBeCloseTo(medidas[0].valor.x, 0);
    }
    for (const m of medidas) {
      expect(m.valor.x).toBeGreaterThan(m.nome.x + m.nome.width);
      expect(Math.abs(m.valor.y - m.nome.y)).toBeLessThan(m.nome.height);
      expect(m.valor.linhas).toBe(1);
    }
    // E nada do tempo sai da faixa dele: o relógio e a situação juntos, o botão e o ajuste inteiros dentro dela
    const faixa = (await tempo.boundingBox())!;
    for (const parte of partesDoTempo(tempo)) {
      const caixa = (await parte.boundingBox())!;
      expect(caixa.x).toBeGreaterThanOrEqual(faixa.x);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(faixa.x + faixa.width);
    }
    const [relogio, situacao] = partesDoTempo(tempo);
    expect((await situacao.boundingBox())!.y).toBeLessThan((await relogio.boundingBox())!.y + (await relogio.boundingBox())!.height);
  });

  test('dada uma demanda sem prazo, quando a pessoa abre o cartão, então "Sem prazo" fica numa linha só, alinhado com as outras datas', async ({ page }) => {
    // Quando: "Busca de anterioridade" não tem prazo
    const cartao = await abrirCartao(page, 'demandas', 'Busca de anterioridade');
    // Então
    const medidas = await dadosDaFaixa(cartao.getByRole('group', { name: 'Datas', exact: true }), ['Criada em', 'Início', 'Prazo de entrega']);
    await expect(cartao.getByRole('group', { name: 'Prazo de entrega', exact: true })).toContainText('Sem prazo');
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
    // Onde a "Situação" (o que vem logo abaixo das faixas) aparece a cada mudança da tela, enquanto o cartão abre
    await page.evaluate(() => {
      const alturas: number[] = [];
      (window as unknown as { alturasDaSituacao: number[] }).alturasDaSituacao = alturas;
      new MutationObserver(() => {
        const situacao = [...document.querySelectorAll('[role=dialog] h3')].find(h => h.textContent === 'Situação');
        if (situacao) alturas.push(Math.round(situacao.getBoundingClientRect().y));
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    // Quando
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).first().click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Registro de marca', level: 2 }) });
    // Então
    const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
    await expect(tempo.getByRole('group', { name: 'Tempo da equipe nas tarefas', exact: true })).toHaveText(/^Tempo da equipe nas tarefas\s*2 h 40 min$/);
    const datas = (await cartao.getByRole('group', { name: 'Datas', exact: true }).boundingBox())!;
    expect((await tempo.boundingBox())!.y).toBeGreaterThanOrEqual(datas.y + datas.height);
    // E a Situação nasceu onde ficou: a faixa do tempo já estava lá enquanto a soma chegava
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

test.describe('Dada a tarefa com o cronômetro, o botão Iniciar/Pausar (#383)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('quando a pessoa aperta T para contar e de novo para pausar, então o botão continua no mesmo lugar e do mesmo tamanho', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Emitir a GRU');
    const tempo = cartao.getByRole('group', { name: 'Tempo', exact: true });
    const botao = tempo.getByRole('button', { name: /^(Iniciar|Retomar|Pausar)/ });
    await expect(botao).toHaveText(/^Retomar/);
    await esperarOCartao(tempo);
    const antes = (await botao.boundingBox())!;
    // Quando
    await page.keyboard.press('t');
    // Então
    await expect(botao).toHaveText(/^Pausar/);
    await expect(tempo.getByText('contando', { exact: true })).toBeVisible();
    const contando = (await botao.boundingBox())!;
    expect(contando.x).toBeCloseTo(antes.x, 0);
    expect(contando.width).toBeCloseTo(antes.width, 0);
    // E de novo
    await page.keyboard.press('t');
    await expect(botao).toHaveText(/^Retomar/);
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
  const medidas = await dadosDaFaixa(cartao.getByRole('group', { name: 'Datas', exact: true }), dados);
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
    await expect(cartao.getByRole('group', { name: 'Datas', exact: true })).toHaveCount(0);
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
    await expect(cartao.getByRole('group', { name: 'Datas', exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Assinado em', exact: true })).toHaveCount(0);
    await expect(cartao.getByText(/^Criado em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  });

  test('quando a pessoa abre o cartão do processo, então não há faixa das datas, e a criação fica só no rodapé', async ({ page }) => {
    // Quando
    const cartao = await abrirOPrimeiro(page, '/processos/judicial/');
    // Então
    await expect(cartao.getByRole('group', { name: 'Datas', exact: true })).toHaveCount(0);
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
    await expect(anotacao.getByRole('group', { name: 'Datas', exact: true })).toHaveCount(0);
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
    await expect(page.getByRole('group', { name: 'Datas', exact: true })).toHaveCount(0);
  });
});
