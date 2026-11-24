// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A demanda que nasce de cada data do compromisso que se repete (#307, parte B). O relógio fica parado em quarta-feira, 04/11/2026, 12h
// em Brasília. Quem cadastra é o Mauro (administrador); a responsável pela reunião é a Ana, que recebe os avisos em Mensagens.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const TITULO = 'Reunião mensal do núcleo';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

const cartao = (page: Page) => page.getByRole('dialog').filter({ has: page.getByLabel('Situação do compromisso') });
const agenda = (page: Page) => page.getByRole('region', { name: 'Agenda por data' });

/**
 * Cadastra a reunião das 10h30 de hoje, toda semana, 4 vezes (04, 11, 18 e 25/11), da Ana, gerando demanda 7 dias antes: as de 04/11
 * e 11/11 (nascem em 28/10 e 04/11) já nascem; as outras, não.
 */
async function cadastrarComDemanda(page: Page) {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(TITULO);
  await page.getByLabel('Data').fill('04/11/2026');
  await page.getByLabel('Hora').fill('10:30');
  await page.getByLabel('Repetir', { exact: true }).selectOption({ label: 'Toda semana' });
  await page.getByRole('group', { name: 'Termina' }).getByText('Depois de algumas vezes', { exact: true }).click();
  await page.getByLabel('Quantas vezes').fill('4');
  await page.getByLabel('Gerar demanda (dias antes)').fill('7');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('combobox', { name: /^Responsável/ }).selectOption({ label: 'Ana Teste Lima' });
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText(/Compromisso \w+ cadastrado, com mais 3 datas na agenda\. 2 demandas já nasceram para as datas mais próximas\./)).toBeVisible();
}

async function abrirMensagens(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: /^Mensagens/ }).click();
  await expect(page.getByRole('list', { name: 'Mensagens' })).toBeVisible();
}

test.describe('Dada uma reunião que se repete e gera demanda 7 dias antes', () => {
  test('quando é cadastrada, então nascem as demandas das datas no prazo, ligadas a ela, e a responsável é avisada', async ({ page }) => {
    // Dado / Quando
    await cadastrarComDemanda(page);
    // Então: o cartão diz que gera demanda e mostra a demanda ligada
    await abrirSecao(cartao(page), 'Dados do compromisso');
    await expect(cartao(page)).toContainText('Nasce 7 dias antes de cada data');
    await abrirSecao(cartao(page), 'Ligado a');
    await expect(cartao(page).getByRole('link', { name: new RegExp(`${TITULO} \\(04/11/2026\\)`) })).toBeVisible();
    // E as demandas estão em Demandas: a de 04/11 e a de 11/11, e não a de 18/11
    await page.goto('/demandas/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: `${TITULO} (04/11/2026)` })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: `${TITULO} (11/11/2026)` })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: `${TITULO} (18/11/2026)` })).toHaveCount(0);
    // E a Ana recebe o aviso das duas em Mensagens
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    const avisos = page.getByRole('listitem', { name: new RegExp(`^Demanda nova do compromisso não lido: ${TITULO}`) });
    await expect(avisos).toHaveCount(2);
    await expect(avisos.first()).toContainText('Você é o responsável.');
  });

  test('quando a data da segunda muda, "só esta", então o prazo da demanda acompanha e a responsável é avisada', async ({ page }) => {
    // Dado
    await cadastrarComDemanda(page);
    await page.getByRole('button', { name: 'Fechar' }).click();
    await page.goto('/agenda/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Agenda' }).click();
    await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Mês' }).click();
    // O link do compromisso (o nome termina no título); o do prazo da demanda termina na data.
    await agenda(page).getByRole('listitem', { name: /11\/11$/ }).getByRole('link', { name: new RegExp(`${TITULO}$`) }).click();
    // Quando
    await cartao(page).getByRole('button', { name: /^Data e horário: / }).click();
    // A janela das datas (#422) flutua sobre o cartão: é achada pela página, e não dentro do cartão.
    const formulario = page.getByRole('dialog', { name: 'Mudar a data e o horário' }).filter({ has: page.getByRole('group', { name: 'Calendário' }) });
    await formulario.getByRole('textbox', { name: 'Data' }).fill('12/11/2026');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    await page.getByRole('dialog', { name: 'Mudar a data e o horário' }).getByRole('button', { name: 'Só esta' }).click();
    await expect(page.getByText('Compromisso atualizado.')).toBeVisible();
    // Então: a demanda passa a ter o título e o prazo da data nova
    await page.goto('/demandas/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: `${TITULO} (12/11/2026)` })).toContainText('12/11/2026');
    // E a Ana é avisada da data mudada
    await entrarComo(page, 'u-ana');
    await abrirMensagens(page);
    await expect(page.getByRole('listitem', { name: /^Compromisso com data mudada não lido/ })).toContainText('passou de 11/11/2026 para 12/11/2026');
  });
});
