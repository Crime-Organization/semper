// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test } from '@playwright/test';
import { abrir } from './ajudantes';

test.describe('Configurações do escritório', () => {
  test('quando o administrador muda o nome do escritório e salva, então o nome novo aparece na barra lateral', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    const nome = page.getByLabel('Nome do escritório');
    await expect(nome).toHaveValue('Escritório Exemplo (teste)');
    // Quando
    await nome.fill('Advocacia Montes Claros');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Dados do escritório salvos.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Advocacia Montes Claros: início' })).toBeVisible();
  });

  test('quando o administrador desfaz a mudança, então o nome antigo volta', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    await page.getByLabel('Nome do escritório').fill('Advocacia Montes Claros');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(page.getByRole('link', { name: 'Escritório Exemplo (teste): início' })).toBeVisible();
  });
});

// No banco fictício não há Google: "Conectar conta Google" volta direto como se a autorização tivesse dado certo.
test.describe('Conta Google do escritório', () => {
  test('quando o administrador conecta a conta Google, então volta a Configurações com a conta ligada e um aviso', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    // Quando
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    // Então
    await expect(page.getByText('Conta Google ligada.', { exact: false })).toBeVisible();
    await expect(google).toContainText('Ligada: contato@exemplo.com');
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });

  test('quando o administrador desliga a conta, com a confirmação, então ela deixa de estar ligada e fica no registro de ações', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    await expect(google).toContainText('Ligada: contato@exemplo.com');
    // Quando
    await google.getByRole('button', { name: 'Desligar' }).click();
    await google.getByRole('button', { name: 'Confirmar: desligar' }).click();
    // Então
    await expect(page.getByText('Conta Google desligada.', { exact: false })).toBeVisible();
    await expect(google.getByRole('button', { name: 'Conectar conta Google' })).toBeVisible();
    await page.goto('/equipe/');
    await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('excluiu a conta Google do escritório');
  });

  test('quando a volta do Google traz um pedido que não existe (vencido, ou de outra pessoa), então nada é ligado e a página avisa', async ({ page }) => {
    // Quando
    await page.goto('/configuracoes/?google_estado=' + 'f'.repeat(64) + '&google_codigo=qualquer');
    // Então
    await expect(page.getByText('O pedido de ligação venceu.', { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Conta Google' }).getByRole('button', { name: 'Conectar conta Google' })).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });

  test('quando o administrador liga a sincronização dos contatos e cadastra alguém, então a pessoa espera na fila e "Sincronizar agora" a leva ao Google', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    const contatos = google.getByRole('group', { name: 'Contatos no Google' });
    const chave = contatos.getByRole('checkbox', { name: 'Criar e atualizar no Google os contatos das pessoas cadastradas e editadas' });
    await expect(chave).not.toBeChecked();
    await expect(contatos.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);
    // Quando
    await chave.check();
    await expect(page.getByText('Sincronização ligada', { exact: false })).toBeVisible();
    // O cadastro pelo banco fictício da própria página (o Vite serve o módulo pelo caminho do arquivo).
    await page.evaluate(async () => {
      const caminho = '/src/dados/falso.ts';
      const { SD } = await import(/* @vite-ignore */ caminho) as typeof import('../src/dados/falso');
      await SD.pessoaCriar({ tipo: 'pf', nome: 'CONTATO NOVO NO GOOGLE' });
    });
    await page.reload();
    // Então
    await expect(contatos).toContainText('1 pessoa esperando para ir ao Google.');
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    await expect(page.getByText('1 pessoa foi ao Google.')).toBeVisible();
    await expect(contatos).toContainText('Tudo em dia: não há ninguém esperando para ir ao Google.');
    await expect(contatos).toContainText('Última sincronização:');
  });

  test('dada a autorização do Google vencida, quando o administrador abre Configurações, então vê o aviso com o que fazer', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as Record<string, unknown>;
      bd.ligacaoGoogle = { conta_email: 'contato@exemplo.com', escopos: [], ligado_em: new Date().toISOString(), ligado_por: 'u-master' };
      bd.contatosGoogle = { ativos: true, fila: ['p-esperando'], com_falha: 1, problema: 'autorizacao', problema_em: new Date().toISOString(), sincronizado_em: null };
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // Quando
    await page.reload();
    // Então
    const contatos = page.getByRole('region', { name: 'Conta Google' }).getByRole('group', { name: 'Contatos no Google' });
    await expect(contatos.getByRole('alert')).toContainText('A autorização do Google venceu ou foi retirada.');
    await expect(contatos.getByRole('alert')).toContainText('Ligar outra conta');
    await expect(contatos).toContainText('1 pessoa esperando para ir ao Google (1 com falha).');
  });

  test('quando o administrador desliga a sincronização, então a fila esvazia e o botão "Sincronizar agora" some', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    const contatos = google.getByRole('group', { name: 'Contatos no Google' });
    const chave = contatos.getByRole('checkbox', { name: 'Criar e atualizar no Google os contatos das pessoas cadastradas e editadas' });
    await chave.check();
    await expect(contatos.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible();
    // Quando
    await chave.uncheck();
    // Então
    await expect(page.getByText('Sincronização desligada', { exact: false })).toBeVisible();
    await expect(contatos.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);
    await expect(chave).not.toBeChecked();
  });

  test('quando a volta do Google traz uma recusa, então a página avisa e limpa o endereço', async ({ page }) => {
    // Quando
    await page.goto('/configuracoes/?google=recusado');
    // Então
    await expect(page.getByText('A autorização no Google foi cancelada. Nada foi ligado.')).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });
});
