// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Do cliente ao contrato (#269): a pessoa que chega a "Contrato fechado" ganha um contrato em "Aguardando assinatura",
// com ela como cliente e o objeto "A definir"; o contrato assinado assim avisa que nenhuma demanda nasceu.
// Quem está logado é o Mateus (advogado e administrador): ele fica como responsável do contrato.
import { expect, test } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const SEM_OBJETO = 'Os objetos deste contrato ainda estão "A definir"';

test.describe('Do cliente ao contrato', () => {
  test('quando a pessoa vai para "Contrato fechado", então nasce o contrato dela em "Aguardando assinatura", e assinar sem objeto avisa', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' }).click();
    // Quando
    await page.getByRole('dialog').getByLabel('Etapa do atendimento').selectOption({ label: 'Contrato fechado' });
    // Então
    await expect(page.getByText('LUCIANA ROCHA AMOSTRA tem um contrato em "Aguardando assinatura".')).toBeVisible();
    await abrirSecao(page.getByRole('dialog'), 'Contratos');
    await expect(page.getByRole('dialog').getByRole('link', { name: /A definir/ })).toContainText('Cliente');
    // Quando
    await page.getByRole('button', { name: 'Abrir o contrato' }).click();
    // Então
    const contrato = page.getByRole('dialog');
    await expect(page).toHaveURL(/\/contratos\/\?id=/);
    await expect(contrato.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    await expect(contrato.getByLabel('Situação do contrato').locator('option:checked')).toHaveText('Aguardando assinatura');
    await abrirSecao(contrato, 'Demandas');
    await expect(contrato.getByText(SEM_OBJETO)).toBeVisible();
    // Quando: o contrato é assinado ainda sem objeto
    await contrato.getByLabel('Situação do contrato').selectOption({ label: 'Assinado / em andamento' });
    // Então: o aviso diz que nenhuma demanda nasceu, e leva à edição
    await expect(page.getByRole('button', { name: 'Editar o contrato' })).toBeVisible();
    await expect(contrato.getByRole('link', { name: /Para fazer/ })).toHaveCount(0);
  });

  test('quando alguém cadastra uma pessoa direto em "Contrato fechado" e desfaz, então a pessoa e o contrato dela somem', async ({ page }) => {
    // Dado: o endereço do + da coluna "Contrato fechado"
    await page.goto('/pessoas/');
    const coluna = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { colunas: { id: string; marco?: string }[] })
      .colunas.find(c => c.marco === 'contrato_fechado')!.id);
    await page.goto('/pessoas/nova/?etapa=' + coluna);
    await page.getByText('Somente informações de contato', { exact: true }).click();
    await page.getByLabel('Nome').fill('cliente fechado e2e');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
    // Quando
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então: o contrato nasce, e o cartão da pessoa mostra ele
    await expect(page.getByText('CLIENTE FECHADO E2E tem um contrato em "Aguardando assinatura".')).toBeVisible();
    await abrirSecao(page.getByRole('dialog'), 'Contratos');
    await expect(page.getByRole('dialog').getByRole('link', { name: /A definir/ })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(page.getByText('Desfeito: cadastro da pessoa.')).toBeVisible();
    await page.goto('/contratos/');
    await expect(page.getByRole('row').filter({ hasText: 'CLIENTE FECHADO E2E' })).toHaveCount(0);
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'CLIENTE FECHADO E2E' })).toHaveCount(0);
  });

  test.describe('No quadro', () => {
    // Tela bem larga: as últimas colunas do quadro de Pessoas ("Contrato fechado" e "Arquivados") ficam lado a lado.
    test.use({ viewport: { width: 2400, height: 1000 } });

    test('quando a pessoa arquivada é arrastada de Arquivados direto para "Contrato fechado", então ganha o contrato também', async ({ page }) => {
      // Dado
      await page.goto('/pessoas/');
      await page.getByRole('button', { name: 'Tabela' }).click();
      await page.getByRole('row').filter({ hasText: 'MARLENE PEREIRA PILOTO' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click();
      await expect(page.getByText('Pessoa arquivada.', { exact: false })).toBeVisible();
      await page.goto('/pessoas/');
      await page.getByRole('button', { name: 'Kanban' }).click();
      const arquivados = page.getByRole('list', { name: 'Arquivados', exact: true });
      const fechado = page.getByRole('list', { name: 'Contrato fechado', exact: true });
      await arquivados.scrollIntoViewIfNeeded();
      // Quando
      await arquivados.getByRole('listitem').filter({ hasText: 'MARLENE PEREIRA PILOTO' }).dragTo(fechado);
      // Então
      await expect(page.getByText('MARLENE PEREIRA PILOTO tem um contrato em "Aguardando assinatura".')).toBeVisible();
    });
  });

  test('quando a mesma pessoa vai de novo para "Contrato fechado", então continua com um contrato só', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'PAULO HENRIQUE SIMULADO' }).click();
    const cartao = page.getByRole('dialog');
    await cartao.getByLabel('Etapa do atendimento').selectOption({ label: 'Contrato fechado' });
    await expect(page.getByText('PAULO HENRIQUE SIMULADO tem um contrato em "Aguardando assinatura".')).toBeVisible();
    // Quando
    await cartao.getByLabel('Etapa do atendimento').selectOption({ label: 'Em negociação' });
    await cartao.getByLabel('Etapa do atendimento').selectOption({ label: 'Contrato fechado' });
    // Então
    await abrirSecao(cartao, 'Contratos');
    await expect(cartao.getByRole('link', { name: /A definir/ })).toHaveCount(1);
    await expect(page.getByText(/PAULO HENRIQUE SIMULADO já tem o contrato .*: nenhum outro foi criado./)).toBeVisible();
  });

  test('quando a pessoa que já tem um contrato feito à mão vai para "Contrato fechado", então fica com ele, sem um "A definir"', async ({ page }) => {
    // Dado: a TEREZA CRISTINA PILOTO é cliente do contrato de exemplo do divórcio
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'TEREZA CRISTINA PILOTO' }).click();
    const cartao = page.getByRole('dialog');
    // Quando
    await cartao.getByLabel('Etapa do atendimento').selectOption({ label: 'Contrato fechado' });
    // Então
    await expect(page.getByText(/TEREZA CRISTINA PILOTO já tem o contrato .*: nenhum outro foi criado./)).toBeVisible();
    await abrirSecao(cartao, 'Contratos');
    await expect(cartao.getByRole('link', { name: /A definir/ })).toHaveCount(0);
    await expect(cartao.getByRole('link', { name: /Divórcio consensual/ })).toHaveCount(1);
  });
});
