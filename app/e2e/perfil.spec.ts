// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Minha conta e perfil profissional. No banco fictício, quem está logado é o Mateus (master); Ana é administradora.
import { expect, test } from '@playwright/test';

test.describe('Minha conta', () => {
  test('quando a pessoa clica em "Minha conta" no menu, então abre a página própria, com o acesso e o perfil profissional', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('navigation', { name: 'Conta' }).getByRole('link', { name: 'Minha conta' }).click();
    // Então
    await expect(page).toHaveURL(/\/minha-conta\/$/);
    await expect(page.getByRole('heading', { name: 'Minha conta', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Usuário para menções', { exact: false })).toHaveValue('mateus.goncalves');
    await expect(page.getByRole('button', { name: 'Ativar verificação em duas etapas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Perfil profissional' })).toBeVisible();
  });

  test('quando a pessoa pede a troca do e-mail, então o atual continua valendo e a tela mostra o que falta confirmar', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await expect(page.getByText('mateus@exemplo.com')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('Mateus.Novo@Exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    // Então
    await expect(page.getByText('Pedido enviado. Confirme pelo link que chegará por e-mail.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Troca aguardando confirmação para mateus.novo@exemplo.com' })).toBeVisible();
    await expect(page.getByText('E-mail de acesso:')).toContainText('mateus@exemplo.com');
  });

  for (const [caso, email, mensagem] of [
    ['inválido', 'mateus@', 'Informe um e-mail válido.'],
    ['igual ao atual', 'MATEUS@exemplo.com', 'Este já é o seu e-mail de acesso.'],
    ['de outra pessoa da equipe', 'ana@exemplo.com', 'Este e-mail já é usado em outra conta do SEMPER.']
  ]) test(`quando o e-mail novo é ${caso}, então a tela avisa no campo e nada fica pendente`, async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    // Quando
    await page.getByLabel('E-mail novo').fill(email);
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    // Então
    await expect(page.getByRole('alert').filter({ hasText: mensagem })).toBeVisible();
    await expect(page.getByText('Troca aguardando confirmação')).toHaveCount(0);
  });

  test('quando os dois links da troca são abertos, então o primeiro diz o que falta e o segundo conclui', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('mateus.novo@exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    await expect(page.getByText('Troca aguardando confirmação', { exact: false })).toBeVisible();
    // Quando
    await page.goto('/?token_hash=link-do-atual&type=email_change');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Para concluir a troca, abra também o link enviado ao outro e-mail.' })).toBeVisible();
    // Quando
    await page.goto('/?token_hash=link-do-novo&type=email_change');
    // Então
    await expect(page).toHaveURL(/\/minha-conta\/$/);
    await expect(page.getByText('E-mail de acesso:')).toContainText('mateus.novo@exemplo.com');
    await expect(page.getByText('Troca aguardando confirmação')).toHaveCount(0);
  });

  test('quando a pessoa cancela depois de um erro, então o formulário fecha, o erro some e nada fica pendente', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('mateus@');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Informe um e-mail válido.' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(page.getByLabel('E-mail novo')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trocar e-mail' })).toBeFocused();
    await expect(page.getByText('Troca aguardando confirmação')).toHaveCount(0);
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Informe um e-mail válido.' })).toHaveCount(0);
  });

  test('quando a pessoa corrige depois de um erro, então o erro some ao digitar e o pedido segue', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('joão@exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Informe um e-mail válido.' })).toBeVisible();
    // Quando
    await page.getByLabel('E-mail novo').fill('joao@exemplo.com');
    // Então
    await expect(page.getByRole('alert').filter({ hasText: 'Informe um e-mail válido.' })).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Troca aguardando confirmação para joao@exemplo.com' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pedir de novo' })).toBeFocused();
  });

  test('quando a pessoa pede de novo, então vale o último endereço', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('errado@exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    await expect(page.getByText('Troca aguardando confirmação para errado@exemplo.com', { exact: false })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Pedir de novo' }).click();
    await page.getByLabel('E-mail novo').fill('certo@exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    // Então
    await expect(page.getByText('Troca aguardando confirmação para certo@exemplo.com', { exact: false })).toBeVisible();
    await expect(page.getByText('errado@exemplo.com')).toHaveCount(0);
  });

  test('quando a pessoa pede a troca, então o nome ainda pode ser salvo na mesma tela', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('mateus.novo@exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    await expect(page.getByText('Troca aguardando confirmação', { exact: false })).toBeVisible();
    // Quando
    await page.getByLabel('Nome', { exact: true }).fill('Mateus Outro Nome');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByText('Conta atualizada.')).toBeVisible();
  });

  test('quando a conta tem duas etapas, então o segundo link pede o código e depois volta para Minha conta', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Ativar verificação em duas etapas' }).click();
    await page.getByLabel('Código do aplicativo').fill('123456');
    await page.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(page.getByText('Verificação em duas etapas ativada.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Trocar e-mail' }).click();
    await page.getByLabel('E-mail novo').fill('mateus.novo@exemplo.com');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();
    await expect(page.getByText('Troca aguardando confirmação', { exact: false })).toBeVisible();
    await page.goto('/?token_hash=link-do-atual&type=email_change');
    await expect(page.getByRole('status').filter({ hasText: 'Para concluir a troca' })).toBeVisible();
    // Quando
    await page.goto('/?token_hash=link-do-novo&type=email_change');
    // Então
    await expect(page.getByRole('heading', { name: 'Código de verificação' })).toBeVisible();
    // Quando
    await page.getByLabel('Código de 6 números').fill('123456');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(page).toHaveURL(/\/minha-conta\/$/);
    await expect(page.getByText('E-mail de acesso:')).toContainText('mateus.novo@exemplo.com');
  });

  test('quando o link da troca não vale mais, então a entrada avisa', async ({ page }) => {
    // Quando
    await page.goto('/?token_hash=link-velho&type=email_change');
    // Então
    await expect(page.getByRole('alert').filter({ hasText: 'Este link já foi usado ou venceu.' })).toBeVisible();
  });

  test('quando a pessoa preenche e salva o perfil, então ele volta igual ao reabrir a página', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    // Quando
    await page.getByLabel('Cargo no escritório', { exact: false }).fill('Sócio');
    await page.getByRole('button', { name: 'Adicionar inscrição' }).click();
    await page.getByRole('textbox', { name: 'Número (inscrição 1)' }).fill('123.456');
    await page.getByRole('combobox', { name: 'UF (inscrição 1)' }).selectOption('MG');
    await page.getByRole('button', { name: 'Adicionar área' }).click();
    await page.getByRole('textbox', { name: 'Áreas de atuação (área 1)' }).fill('Propriedade intelectual');
    await page.getByLabel('Currículo Lattes', { exact: false }).fill('http://lattes.cnpq.br/1234567890');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByText('Perfil profissional salvo.')).toBeVisible();
    await page.reload();
    // Então
    await expect(page.getByLabel('Cargo no escritório', { exact: false })).toHaveValue('Sócio');
    await expect(page.getByRole('textbox', { name: 'Número (inscrição 1)' })).toHaveValue('123.456');
    await expect(page.getByRole('combobox', { name: 'UF (inscrição 1)' })).toHaveValue('MG');
    await expect(page.getByRole('textbox', { name: 'Áreas de atuação (área 1)' })).toHaveValue('Propriedade intelectual');
    await expect(page.getByText('Salvo pela última vez em', { exact: false })).toBeVisible();
  });

  test('quando um link do perfil não começa com https://, então o campo mostra o erro e nada é salvo', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    // Quando
    await page.getByLabel('LinkedIn').fill('linkedin.com/in/mateus');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    // Então
    await expect(page.getByLabel('LinkedIn')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('LinkedIn')).toHaveAccessibleDescription('Cole o link completo, começando com https://.');
    await page.reload();
    await expect(page.getByLabel('LinkedIn')).toHaveValue('');
  });
});

test.describe('Perfil de alguém da equipe', () => {
  test('quando o administrador abre o perfil de alguém em Equipe, corrige e põe no site, então fica salvo e no registro de ações', async ({ page }) => {
    // Dado
    await page.goto('/equipe/');
    // Quando
    await page.getByRole('link', { name: 'Perfil profissional de Ana Teste Lima' }).click();
    await expect(page.getByRole('heading', { name: 'Ana Teste Lima', level: 1 })).toBeVisible();
    await page.getByLabel('Cargo no escritório', { exact: false }).fill('Advogada associada');
    await page.getByRole('checkbox', { name: 'Aparecer no site' }).check();
    await page.getByLabel('Ordem na página da equipe').fill('2');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByText('Perfil profissional salvo.')).toBeVisible();
    await page.reload();
    // Então
    await expect(page.getByLabel('Cargo no escritório', { exact: false })).toHaveValue('Advogada associada');
    await expect(page.getByRole('checkbox', { name: 'Aparecer no site' })).toBeChecked();
    await expect(page.getByLabel('Ordem na página da equipe')).toHaveValue('2');
    await page.getByRole('link', { name: 'Equipe e acessos' }).first().click();
    await expect(page.getByText('o perfil profissional de Ana Teste Lima', { exact: false })).toBeVisible();
  });
});
