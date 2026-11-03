// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir } from './ajudantes';

test.describe('Equipe e acessos', () => {
  test.beforeEach(async ({ page }) => {
    // Dado: a sessão do banco fictício é do master, que pode liberar acessos
    await page.goto('/inicio/');
    await abrir(page, 'Equipe e acessos');
  });

  test('quando o administrador libera o acesso de uma pessoa cadastrada, então o convite aparece em "Convites pendentes"', async ({ page }) => {
    // Dado
    const pendentes = page.getByRole('region', { name: 'Convites pendentes' });
    await expect(pendentes).toContainText('Nenhum convite pendente.');
    // Quando
    await page.getByRole('textbox', { name: 'Pessoa' }).fill('josé da');
    await page.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await page.getByLabel('E-mail de acesso').fill('jose@exemplo.com');
    await page.getByRole('button', { name: 'Liberar acesso' }).click();
    // Então
    await expect(page.getByText('Acesso liberado para', { exact: false }).first()).toBeVisible();
    await expect(pendentes.getByRole('row').filter({ hasText: 'jose@exemplo.com' })).toBeVisible();
  });

  test('quando o administrador cancela um convite pendente, então ele sai da lista', async ({ page }) => {
    // Dado
    await page.getByRole('textbox', { name: 'Pessoa' }).fill('josé da');
    await page.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await page.getByLabel('E-mail de acesso').fill('jose@exemplo.com');
    await page.getByRole('button', { name: 'Liberar acesso' }).click();
    const pendentes = page.getByRole('region', { name: 'Convites pendentes' });
    const convite = pendentes.getByRole('row').filter({ hasText: 'jose@exemplo.com' });
    // Quando
    await convite.getByRole('button', { name: 'Cancelar' }).click();
    await convite.getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(pendentes).toContainText('Nenhum convite pendente.');
  });

  test('quando o administrador muda a função de alguém, então a função nova aparece e fica no registro de ações', async ({ page }) => {
    // Dado
    const funcao = page.getByLabel('Função de Ana Teste Lima');
    await expect(funcao.getByRole('option', { selected: true })).toHaveText('Advogado');
    // Quando
    await funcao.selectOption({ label: 'Estagiário' });
    // Então
    await expect(page.getByText('Função de Ana Teste Lima: Estagiário.')).toBeVisible();
    await expect(funcao.getByRole('option', { selected: true })).toHaveText('Estagiário');
    await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('alterou usuário Ana Teste Lima');
  });

  test('quando a tela é a de um computador, então a tabela de usuários cabe na página, sem barra de rolagem', async ({ page }) => {
    // Quando
    await page.setViewportSize({ width: 1920, height: 1080 });
    const usuarios = page.getByRole('region', { name: 'Usuários' });
    await expect(usuarios.getByRole('row')).toHaveCount(5);
    // Então
    const [secao, tabela] = await Promise.all([usuarios.boundingBox(), usuarios.getByRole('table').boundingBox()]);
    expect(tabela!.width).toBeLessThanOrEqual(secao!.width);
  });

  test('quando a tela é a de um computador, então os botões de cada usuário ficam numa linha só, na mesma altura do "Você"', async ({ page }) => {
    // Quando
    await page.setViewportSize({ width: 1440, height: 900 });
    const usuarios = page.getByRole('region', { name: 'Usuários' });
    await expect(usuarios.getByRole('row')).toHaveCount(5);
    // Então: o meio de cada botão (e do "Você") fica na mesma altura que o do botão Cadastro da mesma linha
    const meio = async (alvo: Locator) => { const c = (await alvo.boundingBox())!; return Math.round(c.y + c.height / 2); };
    const ana = usuarios.getByRole('row').filter({ hasText: 'Ana Teste Lima' });
    expect(await meio(ana.getByRole('button', { name: 'Desativar' }))).toBe(await meio(ana.getByRole('link', { name: 'Cadastro' })));
    const eu = usuarios.getByRole('row').filter({ hasText: 'Mateus Freitas Gonçalves' });
    expect(await meio(eu.getByText('Você', { exact: true }))).toBe(await meio(eu.getByRole('link', { name: 'Cadastro' })));
    const carla = usuarios.getByRole('row').filter({ hasText: 'Carla Fictícia Rocha' });
    expect(await meio(carla.getByRole('button', { name: 'Reativar' }))).toBe(await meio(carla.getByRole('link', { name: 'Cadastro' })));
  });

  test.describe('Trocar o e-mail de quem perdeu o antigo', () => {
    const linha = (page: Page, nome: string) => page.getByRole('region', { name: 'Usuários' }).getByRole('row').filter({ hasText: nome });

    test('quando o master troca o e-mail de um usuário, então o e-mail novo aparece na lista e a troca fica no registro de ações', async ({ page }) => {
      // Quando
      await page.getByRole('button', { name: 'Trocar e-mail de Bruno Exemplo Souza' }).click();
      const janela = page.getByRole('dialog');
      await janela.getByLabel('E-mail novo', { exact: true }).fill('bruno.novo@exemplo.com');
      await janela.getByLabel('Repita o e-mail novo').fill('bruno.novo@exemplo.com');
      await janela.getByRole('button', { name: 'Trocar e-mail' }).click();
      // Então
      await expect(linha(page, 'Bruno Exemplo Souza')).toContainText('bruno.novo@exemplo.com');
      await expect(page.getByText('Avise a pessoa: ela precisa criar uma senha nova em "Esqueci minha senha".', { exact: false })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('trocou o e-mail de acesso de Bruno Exemplo Souza, de bruno@exemplo.com para bruno.novo@exemplo.com');
    });

    /** Põe um registro de troca no banco fictício, como a função do servidor deixaria. */
    async function registrarTroca(page: Page, resumo: Record<string, unknown>) {
      await page.evaluate(extras => {
        const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
        bd.auditoria.unshift({ id: 999, tabela: 'perfis', registro_id: 'u-bruno', acao: 'troca_email', feito_por: 'u-ana', em: new Date().toISOString(),
          resumo: { nome: 'Carla Teste', email_antigo: 'carla@exemplo.com', email_novo: 'carla.nova@exemplo.com', ...extras } });
        sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
      }, resumo);
      await page.reload();
    }

    test('quando o aviso por e-mail sai para todos, então o registro de ações não acusa nada', async ({ page }) => {
      // Quando
      await page.getByRole('button', { name: 'Trocar e-mail de Bruno Exemplo Souza' }).click();
      const janela = page.getByRole('dialog');
      await janela.getByLabel('E-mail novo', { exact: true }).fill('bruno.novo@exemplo.com');
      await janela.getByLabel('Repita o e-mail novo').fill('bruno.novo@exemplo.com');
      await janela.getByRole('button', { name: 'Trocar e-mail' }).click();
      // Então
      const registro = page.getByRole('region', { name: 'Registro de ações' });
      await expect(registro).toContainText('trocou o e-mail de acesso de Bruno Exemplo Souza');
      await expect(registro).not.toContainText('aviso por e-mail');
    });

    test('quando o aviso por e-mail não sai, então o registro de ações mostra para quem, e a troca continua registrada', async ({ page }) => {
      // Dado
      await registrarTroca(page, { aviso_falhas: ['antigo', 'gestao'] });
      // Então
      const registro = page.getByRole('region', { name: 'Registro de ações' });
      await expect(registro).toContainText('trocou o e-mail de acesso de Carla Teste, de carla@exemplo.com para carla.nova@exemplo.com (o aviso por e-mail não saiu para o e-mail antigo e a administração)');
    });

    test('quando o envio do aviso não chegou ao fim, então o registro de ações diz que ele não foi confirmado', async ({ page }) => {
      // Dado
      await registrarTroca(page, {});
      // Então
      await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('(o aviso por e-mail não foi confirmado)');
    });

    test('quando a troca não aconteceu, então o registro de ações não fala de aviso', async ({ page }) => {
      // Dado
      await registrarTroca(page, { situacao: 'falhou' });
      // Então
      const registro = page.getByRole('region', { name: 'Registro de ações' });
      await expect(registro).toContainText('tentou trocar o e-mail de acesso de Carla Teste');
      await expect(registro).not.toContainText('aviso por e-mail');
    });

    test('quando há mais de 60 ações depois de uma troca com aviso que falhou, então ela continua na lista própria, com destaque', async ({ page }) => {
      // Dado
      await page.evaluate(() => {
        const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
        const em = new Date().toISOString();
        bd.auditoria.unshift({ id: 998, tabela: 'perfis', registro_id: 'u-bruno', acao: 'troca_email', feito_por: 'u-ana', em,
          resumo: { nome: 'Carla Teste', email_antigo: 'carla@exemplo.com', email_novo: 'carla.nova@exemplo.com', aviso_falhas: ['gestao'] } });
        for (let i = 0; i < 61; i++) bd.auditoria.unshift({ id: 1000 + i, tabela: 'pessoas', registro_id: 'x', acao: 'alteracao', resumo: { nome: 'Pessoa ' + i }, feito_por: 'u-ana', em });
        sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
      });
      // Quando
      await page.reload();
      // Então
      const trocas = page.getByRole('region', { name: 'Trocas de e-mail' });
      await expect(trocas).toContainText('Carla Teste');
      await expect(trocas).toContainText('Aviso não saiu');
      await expect(page.getByRole('region', { name: 'Registro de ações' })).not.toContainText('Carla Teste');
    });

    /** Põe 10 trocas de agora no banco fictício, feitas por essa pessoa. */
    async function registrarDezTrocas(page: Page, feitoPor: string) {
      await page.evaluate(quem => {
        const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
        const em = new Date().toISOString();
        for (let i = 0; i < 10; i++) bd.auditoria.unshift({ id: 2000 + i, tabela: 'perfis', registro_id: 'u-bruno', acao: 'troca_email', feito_por: quem, em, resumo: { nome: 'Outra Pessoa', aviso_falhas: [] } });
        sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
      }, feitoPor);
      await page.reload();
    }

    async function trocarOEmailDoBruno(page: Page) {
      await page.getByRole('button', { name: 'Trocar e-mail de Bruno Exemplo Souza' }).click();
      const janela = page.getByRole('dialog');
      await janela.getByLabel('E-mail novo', { exact: true }).fill('bruno.novo@exemplo.com');
      await janela.getByLabel('Repita o e-mail novo').fill('bruno.novo@exemplo.com');
      await janela.getByRole('button', { name: 'Trocar e-mail' }).click();
    }

    test('quando o master chega ao limite de trocas na hora, então a próxima é recusada, com a explicação, e nada muda', async ({ page }) => {
      // Dado
      await registrarDezTrocas(page, 'u-master');
      // Quando
      await trocarOEmailDoBruno(page);
      // Então
      await expect(page.getByText('O limite de 10 trocas de e-mail por hora foi atingido.')).toBeVisible();
      await expect(linha(page, 'Bruno Exemplo Souza')).toContainText('bruno@exemplo.com');
    });

    test('quando os administradores gastam as trocas da hora, então o master ainda consegue trocar', async ({ page }) => {
      // Dado
      await registrarDezTrocas(page, 'u-ana');
      // Quando
      await trocarOEmailDoBruno(page);
      // Então
      await expect(linha(page, 'Bruno Exemplo Souza')).toContainText('bruno.novo@exemplo.com');
    });

    test('quando os dois e-mails não são iguais, então a janela avisa, guarda o que foi digitado e nada muda', async ({ page }) => {
      // Quando
      await page.getByRole('button', { name: 'Trocar e-mail de Bruno Exemplo Souza' }).click();
      const janela = page.getByRole('dialog');
      await janela.getByLabel('E-mail novo', { exact: true }).fill('bruno.novo@exemplo.com');
      await janela.getByLabel('Repita o e-mail novo').fill('bruno.nvoo@exemplo.com');
      await janela.getByRole('button', { name: 'Trocar e-mail' }).click();
      // Então
      await expect(janela.getByText('Os dois e-mails não são iguais.')).toBeVisible();
      await expect(janela.getByLabel('E-mail novo', { exact: true })).toHaveValue('bruno.novo@exemplo.com');
      await janela.getByRole('button', { name: 'Cancelar' }).click();
      await expect(linha(page, 'Bruno Exemplo Souza')).toContainText('bruno@exemplo.com');
    });

    test('quando o e-mail novo já é de outra conta, então avisa e nada muda', async ({ page }) => {
      // Quando
      await page.getByRole('button', { name: 'Trocar e-mail de Bruno Exemplo Souza' }).click();
      const janela = page.getByRole('dialog');
      await janela.getByLabel('E-mail novo', { exact: true }).fill('ana@exemplo.com');
      await janela.getByLabel('Repita o e-mail novo').fill('ana@exemplo.com');
      await janela.getByRole('button', { name: 'Trocar e-mail' }).click();
      // Então
      await expect(page.getByText('Este e-mail já é usado em outra conta do SEMPER.')).toBeVisible();
      await expect(linha(page, 'Bruno Exemplo Souza')).toContainText('bruno@exemplo.com');
    });

    test('quando olha a própria linha, então não há como trocar o e-mail por aqui', async ({ page }) => {
      // Então
      await expect(linha(page, 'Mateus Freitas Gonçalves')).toContainText('Você');
      await expect(page.getByRole('button', { name: 'Trocar e-mail de Mateus Freitas Gonçalves' })).toHaveCount(0);
    });
  });

  test('quando o e-mail de acesso fica vazio, então avisa e não libera', async ({ page }) => {
    // Dado (escolher a pessoa já preenche o e-mail do cadastro dela; aqui ele é apagado)
    await page.getByRole('textbox', { name: 'Pessoa' }).fill('josé da');
    await page.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await page.getByLabel('E-mail de acesso').clear();
    // Quando
    await page.getByRole('button', { name: 'Liberar acesso' }).click();
    // Então
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Convites pendentes' })).toContainText('Nenhum convite pendente.');
  });
});
