// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As agendas do escritório no Google (#166, parte 1): autorizar a agenda e ligar as agendas em Configurações, e o e-mail do
// Google de cada um em Equipe e acessos e em Minha conta (só os administradores mudam), e as recusas do Google. No banco fictício não há Google: a volta do Google já vem como
// autorizada, e a conta Google é simulada.
import { expect, test, type Page } from '@playwright/test';
import { abrirUsuario, entrarComo } from './ajudantes';

const CHAVE = 'Criar e manter no Google as agendas do escritório';

async function contaLigada(page: Page) {
  await page.goto('/configuracoes/');
  const google = page.getByRole('region', { name: 'Conta Google' });
  await google.getByRole('button', { name: 'Conectar conta Google' }).click();
  await expect(google).toContainText('Ligada: contato@exemplo.com');
  return { google, agendas: google.getByRole('group', { name: 'Agendas no Google' }) };
}

test.describe('Agendas no Google, em Configurações', () => {
  test('dada a conta ligada só com os contatos, quando o administrador autoriza a agenda, então volta com a agenda autorizada e a chave aparece desligada', async ({ page }) => {
    // Dado
    const { agendas } = await contaLigada(page);
    await expect(agendas).toContainText('Falta autorizar a agenda');
    await expect(agendas.getByRole('checkbox', { name: CHAVE })).toHaveCount(0);
    // Quando
    await agendas.getByRole('button', { name: 'Autorizar a agenda' }).click();
    // Então
    await expect(page.getByText('Agenda autorizada.', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
    await expect(agendas).not.toContainText('Falta autorizar a agenda');
    await expect(agendas.getByRole('checkbox', { name: CHAVE })).not.toBeChecked();
    await expect(agendas.getByRole('button', { name: 'Autorizar a agenda' })).toHaveCount(0);
  });

  test('dada a agenda autorizada, quando o administrador liga as agendas e pede "Sincronizar agora", então as agendas são criadas e compartilhadas', async ({ page }) => {
    // Dado
    const { agendas } = await contaLigada(page);
    await agendas.getByRole('button', { name: 'Autorizar a agenda' }).click();
    await expect(page.getByText('Agenda autorizada.', { exact: false })).toBeVisible();
    // O que vai para as agendas está dito antes de ligar (#166, parte 2: os eventos).
    await expect(agendas).toContainText('os prazos das tarefas e das demandas');
    await expect(agendas).toContainText('as parcelas a receber');
    // Quando
    await agendas.getByRole('checkbox', { name: CHAVE }).check();
    await expect(page.getByText('Agendas ligadas:', { exact: false })).toBeVisible();
    await expect(agendas).toContainText('Há mudanças esperando para ir ao Google.');
    await agendas.getByRole('button', { name: 'Sincronizar agora' }).click();
    // Então
    await expect(page.getByText(/\d+ agendas criadas, \d+ compartilhamentos feitos\./)).toBeVisible();
    await expect(agendas).toContainText(/Tudo em dia: \d+ agendas criadas, \d+ compartilhamentos\./);
    await expect(agendas).toContainText('Última sincronização:');
    await expect(page.getByRole('group', { name: 'Contatos no Google' }).getByRole('checkbox')).not.toBeChecked();
  });

  test('dado o Google que recusa compartilhar com um e-mail, quando o administrador sincroniza, então vê qual e-mail foi recusado e os outros recebem as agendas', async ({ page }) => {
    // Dado
    const { agendas } = await contaLigada(page);
    await agendas.getByRole('button', { name: 'Autorizar a agenda' }).click();
    await agendas.getByRole('checkbox', { name: CHAVE }).check();
    await expect(page.getByText('Agendas ligadas:', { exact: false })).toBeVisible();
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { agendasGoogle: Record<string, unknown> };
      bd.agendasGoogle.recusar = ['bruno@exemplo.com'];
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    await page.reload();
    // Quando
    await agendas.getByRole('button', { name: 'Sincronizar agora' }).click();
    // Então
    await expect(page.getByText(/\d+ agendas criadas, \d+ compartilhamentos feitos\./)).toBeVisible();
    const aviso = agendas.getByRole('alert').filter({ hasText: 'O Google recusou compartilhar estas agendas:' });
    await expect(aviso.getByRole('listitem').filter({ hasText: 'bruno@exemplo.com, na agenda "Geral" (403 forbidden)' })).toBeVisible();
    await expect(aviso).toContainText('Sincronizar agora');
  });

  test('dadas as agendas ligadas, quando o administrador as desliga, então o aviso diz que nada foi apagado no Google', async ({ page }) => {
    // Dado
    const { agendas } = await contaLigada(page);
    await agendas.getByRole('button', { name: 'Autorizar a agenda' }).click();
    const chave = agendas.getByRole('checkbox', { name: CHAVE });
    await chave.check();
    await expect(page.getByText('Agendas ligadas:', { exact: false })).toBeVisible();
    // Quando
    await chave.uncheck();
    // Então
    await expect(page.getByText('Agendas desligadas: o SEMPER deixou de mexer nas agendas do Google. Nada foi apagado lá.')).toBeVisible();
    await expect(agendas.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);
  });
});

test.describe('E-mail do Google da equipe', () => {
  test('quando o administrador informa o e-mail do Google de alguém em Equipe e acessos, então ele fica salvo; vazio, volta ao de entrada', async ({ page }) => {
    // Dado
    await page.goto('/equipe/');
    const janela = await abrirUsuario(page, 'Bruno Exemplo Souza');
    const campo = janela.getByLabel('E-mail do Google');
    await expect(campo).toHaveValue('');
    await expect(campo).toHaveAttribute('placeholder', 'bruno@exemplo.com');
    // Quando
    await campo.fill('Bruno.Pessoal@Exemplo.com');
    await janela.getByRole('button', { name: 'Salvar e-mail do Google' }).click();
    // Então
    await expect(page.getByText('E-mail do Google salvo: bruno.pessoal@exemplo.com.')).toBeVisible();
    await expect(campo).toHaveValue('bruno.pessoal@exemplo.com');
    await campo.fill('');
    await janela.getByRole('button', { name: 'Salvar e-mail do Google' }).click();
    await expect(page.getByText('E-mail do Google de volta ao e-mail de entrada.')).toBeVisible();
  });

  test('quando o e-mail do Google não é um e-mail, então o campo mostra o erro e nada é salvo', async ({ page }) => {
    // Dado
    await page.goto('/equipe/');
    const janela = await abrirUsuario(page, 'Bruno Exemplo Souza');
    // Quando
    await janela.getByLabel('E-mail do Google').fill('bruno');
    await janela.getByRole('button', { name: 'Salvar e-mail do Google' }).click();
    // Então
    await expect(janela.getByText('Informe um e-mail válido.')).toBeVisible();
  });

  test('quando a pessoa informa o próprio e-mail do Google em Minha conta, então ele fica salvo', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    const campo = page.getByLabel('E-mail do Google');
    // Quando
    await campo.fill('pessoal@exemplo.com');
    await page.getByRole('button', { name: 'Salvar e-mail do Google' }).click();
    // Então
    await expect(page.getByText('E-mail do Google salvo: pessoal@exemplo.com.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('E-mail do Google')).toHaveValue('pessoal@exemplo.com');
  });

  test('dado um usuário comum, quando abre Minha conta, então vê o e-mail do Google só para ler: quem muda é o administrador', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/minha-conta/');
    // Então
    await expect(page.getByLabel('E-mail do Google')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Salvar e-mail do Google' })).toHaveCount(0);
    await expect(page.getByText('Só os administradores mudam o e-mail do Google, em Equipe e acessos.')).toBeVisible();
  });
});
