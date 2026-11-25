// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O Google Meet no compromisso (#437): autorizar o Meet nas Agendas no Google (Configurações), a opção "Criar link do Google
// Meet" no cadastro e no lápis do compromisso, e o link no cartão. No banco fictício não há Google: a volta do Google já vem
// autorizada, e a reunião nasce na hora, com um link de exemplo, como a função do servidor a deixaria. O relógio fica parado
// em quarta-feira, 04/11/2026, 12h em Brasília. Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const OPCAO = 'Criar link do Google Meet';
const LINK_DO_MEET = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

/** Liga a conta Google, autoriza a agenda e liga as agendas, em Configurações; devolve o grupo das Agendas no Google. */
async function agendasLigadas(page: Page) {
  await page.goto('/configuracoes/');
  const google = page.getByRole('region', { name: 'Conta Google' });
  await google.getByRole('button', { name: 'Conectar conta Google' }).click();
  await expect(google).toContainText('Ligada: contato@exemplo.com');
  const agendas = google.getByRole('group', { name: 'Agendas no Google' });
  await agendas.getByRole('button', { name: 'Autorizar a agenda' }).click();
  await expect(page.getByText('Agenda autorizada.', { exact: false })).toBeVisible();
  await agendas.getByRole('checkbox', { name: 'Criar e manter no Google as agendas do escritório' }).check();
  await expect(page.getByText('Agendas ligadas:', { exact: false })).toBeVisible();
  return agendas;
}

/** Vai do cadastro até a etapa "Onde e de qual processo" de uma reunião de amanhã. */
async function ateOnde(page: Page, titulo: string) {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Data').fill('05/11/2026');
  await page.getByLabel('Hora').fill('10:30');
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();
}

test.describe('Google Meet no compromisso', () => {
  test('dado o Meet não autorizado, quando a pessoa cadastra um compromisso, então a opção do Meet não aparece', async ({ page }) => {
    // Dado
    await agendasLigadas(page);
    // Quando
    await ateOnde(page, 'Reunião sem Meet');
    // Então
    await expect(page.getByRole('checkbox', { name: OPCAO })).toHaveCount(0);
  });

  test('dadas as agendas ligadas, quando o administrador autoriza o Google Meet, então volta com o Meet autorizado', async ({ page }) => {
    // Dado
    const agendas = await agendasLigadas(page);
    await expect(agendas).toContainText('autorize o Meet nesta conta');
    // Quando
    await agendas.getByRole('button', { name: 'Autorizar o Google Meet' }).click();
    // Então
    await expect(page.getByText('Google Meet autorizado. Os compromissos', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
    await expect(agendas).toContainText('Google Meet autorizado: o SEMPER cria nesta conta a reunião');
    await expect(agendas.getByRole('button', { name: 'Autorizar o Google Meet' })).toHaveCount(0);
  });

  test('dado o Meet autorizado, quando a pessoa marca "Criar link do Google Meet" e salva, então o link aparece no cartão; desmarcado no lápis, ele sai', async ({ page }) => {
    // Dado
    const agendas = await agendasLigadas(page);
    await agendas.getByRole('button', { name: 'Autorizar o Google Meet' }).click();
    await expect(page.getByText('Google Meet autorizado. Os compromissos', { exact: false })).toBeVisible();
    await ateOnde(page, 'Reunião com Meet');
    const opcao = page.getByRole('checkbox', { name: OPCAO });
    await expect(opcao).not.toBeChecked();
    await expect(page.getByRole('group', { name: 'Google Meet' })).toContainText('A reunião é criada pela conta Google do escritório');
    // Quando
    await page.getByRole('group', { name: 'Google Meet' }).getByText(OPCAO).click();
    await expect(opcao).toBeChecked();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Reunião com Meet', level: 2 })).toBeVisible();
    await abrirSecao(cartao, 'Dados do compromisso');
    const link = cartao.getByRole('link', { name: LINK_DO_MEET });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(cartao).toContainText('A gravação e a transcrição começam sozinhas');
    // E, no lápis, a opção vem marcada; desmarcada, a reunião sai do cartão.
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar compromisso' });
    await expect(edicao.getByRole('checkbox', { name: OPCAO })).toBeChecked();
    await edicao.getByRole('group', { name: 'Google Meet' }).getByText(OPCAO).click();
    await expect(edicao.getByRole('checkbox', { name: OPCAO })).not.toBeChecked();
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Compromisso atualizado.')).toBeVisible();
    await abrirSecao(cartao, 'Dados do compromisso');
    await expect(cartao.getByRole('link', { name: LINK_DO_MEET })).toHaveCount(0);
    await expect(cartao.getByText('Google Meet', { exact: true })).toHaveCount(0);
  });
});
