// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Datas (#357): o cartão de tarefa e de demanda mostra a data de criação e a de início (que se muda no próprio lugar, com o
// calendário pequeno), o quadro e a tabela ordenam e filtram pelo início, e os campos de data dos cadastros têm o calendário
// pequeno no computador e o do aparelho no celular. Na semente, as tarefas e demandas foram criadas hoje (começam hoje).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

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

  test('dada uma tarefa, quando a pessoa usa o lápis, então a data de início está no formulário e muda com ele', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar tarefa' });
    // Então
    await expect(edicao.getByLabel('Data de início')).toHaveValue(hoje());
    // Quando
    await edicao.getByLabel('Data de início').fill('05/01/2031');
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(cartao.getByRole('button', { name: /^Data de início: / })).toHaveText('05/01/2031');
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
  test('dado o cadastro de tarefa, quando a pessoa clica no prazo, escolhe o dia no calendário e a hora logo abaixo, então os dois vão para o formulário', async ({ page }) => {
    // Dado
    const dia = dia10DoMesSeguinte();
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Protocolar a petição');
    // Quando
    await page.getByLabel('Prazo').click();
    await expect(calendario(page)).toBeVisible();
    await calendario(page).getByRole('button', { name: 'Próximo mês' }).click();
    await calendario(page).getByRole('button', { name: dia.nome }).click();
    // Então: a hora fica logo abaixo do calendário, com o foco
    const hora = calendario(page).getByLabel('Hora');
    await expect(hora).toBeFocused();
    await hora.fill('14:30');
    await calendario(page).getByRole('button', { name: 'Pronto' }).click();
    await expect(calendario(page)).toHaveCount(0);
    await expect(page.getByLabel('Prazo')).toHaveValue(dia.texto);
    await expect(page.getByLabel('Hora', { exact: true })).toHaveValue('14:30');
    // E quando salva, então o cartão mostra o prazo com a hora
    await page.getByRole('button', { name: 'Próxima' }).click();
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
    // Então: o dia escolhido vai para o campo; com hora, o calendário continua aberto e o foco desce para ela
    await expect(data).toHaveValue(seguinte.texto);
    await expect(calendario(page).getByLabel('Hora')).toBeFocused();
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
    await page.getByRole('button', { name: 'Próxima' }).click();
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
