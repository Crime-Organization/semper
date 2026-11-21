// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Arquivados à vista em todos os módulos: a coluna fixa "Arquivados" no fim do quadro e a seção recolhível
// "Arquivados" embaixo da tabela. Na semente do banco fictício, "Renovar a procuração" é uma tarefa em "Para fazer" e o
// contrato de MARIA APARECIDA EXEMPLO está ativo. Quem está logado é o Mauro (administrador).
import { expect, test } from '@playwright/test';
import { acaoNoMenuDoCartao, acoesNoMenuDoCartao } from './ajudantes';

test.describe('Arquivados no quadro', () => {
  // Tela bem larga: as colunas de "Para fazer" até "Arquivados" ficam todas à vista, para arrastar entre elas.
  test.use({ viewport: { width: 2400, height: 1000 } });

  test('quando a pessoa arrasta um cartão para "Arquivados", então ele é arquivado; arrastado de volta, volta para a coluna', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const arquivados = page.getByRole('list', { name: 'Arquivados', exact: true });
    const titulos = await page.getByRole('region', { name: 'Quadro' }).getByRole('heading', { level: 3 }).allTextContents();
    expect(titulos.at(-1)).toBe('Arquivados');
    await expect(arquivados.getByText('Nenhum item.')).toBeVisible();
    // Quando
    await page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(arquivados);
    // Então
    await expect(arquivados.getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByText('F00D1234 foi para Arquivados.')).toBeVisible();
    // Quando: de volta, para "Fazendo"
    const fazendo = page.getByRole('list', { name: 'Fazendo', exact: true });
    await arquivados.getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(fazendo);
    // Então
    await expect(page.getByText('F00D1234 saiu de Arquivados e foi para "Fazendo".')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Fazendo', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Arquivados', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toHaveCount(0);
  });
});

test.describe('Arquivados na tabela', () => {
  test('quando a pessoa arquiva um contrato, então ele sai da tabela e aparece em "Arquivados" embaixo dela, de onde volta ao desarquivar', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    const maria = page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    // Quando
    await maria.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    // Então: a seção mostra quantos há, mesmo fechada, e ao abrir mostra o contrato
    const secao = page.getByRole('button', { name: /^Arquivados/ });
    await expect(secao).toContainText('1');
    await expect(maria).toHaveCount(0);
    await secao.click();
    await expect(maria).toHaveCount(1);
    // Quando
    await maria.getByRole('checkbox').check();
    // Então: Desarquivar com a caixa aberta (a do cartão) e Excluir com a lixeira (#347)
    const acoes = page.getByRole('group', { name: 'Ações nos arquivados selecionados' });
    await expect(acoes.getByRole('button', { name: 'Desarquivar' }).locator('svg')).toHaveAttribute('data-icone', 'arquivoAberto');
    await expect(acoes.getByRole('button', { name: 'Excluir' }).locator('svg')).toHaveAttribute('data-icone', 'lixeira');
    // Quando
    await acoes.getByRole('button', { name: 'Desarquivar' }).click();
    // Então
    await expect(page.getByText('1 contrato voltou para a lista.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(1);
    await expect(secao).not.toContainText('1');
  });
});

test.describe('Ações do cartão arquivado', () => {
  // Em cada módulo, um item ativo da semente do banco fictício. Quem está logado é administrador, então pode excluir.
  // Desde a #382, Arquivar, Desarquivar e Excluir ficam no menu ⋯ do topo (como na anotação); o lápis continua no topo, e a faixa
  // do arquivado traz o Desarquivar à vista.
  const CARTOES = [
    { modulo: 'pessoas', item: 'MARIA APARECIDA EXEMPLO', titulo: 'Excluir a pessoa?' },
    { modulo: 'contratos', item: 'MARIA APARECIDA EXEMPLO', titulo: 'Excluir o contrato?' },
    { modulo: 'demandas', item: 'Notificar o devedor', titulo: 'Excluir a demanda?' },
    { modulo: 'tarefas', item: 'Renovar a procuração', titulo: 'Excluir a tarefa?' },
    { modulo: 'processos/judicial', item: 'JOSÉ DA SILVA TESTE', titulo: 'Excluir o processo?' },
    { modulo: 'agenda', item: 'Reunião de equipe', titulo: 'Excluir o compromisso?' }
  ];

  for (const { modulo, item, titulo } of CARTOES) {
    test(`quando a pessoa arquiva e desarquiva em ${modulo}, então o ⋯ e o lápis acompanham, e o Excluir pede confirmação`, async ({ page }) => {
      // Dado
      await page.goto(`/${modulo}/`);
      await page.getByRole('button', { name: 'Tabela' }).click();
      await page.getByRole('row').filter({ hasText: item }).first().getByText(item).first().click();
      const cartao = page.getByRole('dialog');
      const botao = (name: string) => cartao.getByRole('button', { name, exact: true });
      expect(await acoesNoMenuDoCartao(page, cartao)).toEqual(['Arquivar']);
      await expect(botao('Editar')).toBeVisible();
      // Quando
      await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
      // Então: o ⋯ troca Arquivar por Desarquivar e ganha o Excluir; o lápis sai; a faixa diz onde excluir e traz o Desarquivar
      await expect(cartao.getByText(/pode ser excluíd[ao] definitivamente pelo menu ⋯\./)).toBeVisible();
      await expect(botao('Desarquivar')).toBeVisible();
      await expect(botao('Editar')).toHaveCount(0);
      expect(await acoesNoMenuDoCartao(page, cartao)).toEqual(['Desarquivar', 'Excluir']);
      // Quando: o Excluir, cancelando na janela
      await acaoNoMenuDoCartao(page, cartao, 'Excluir');
      const janela = page.getByRole('dialog', { name: titulo });
      await expect(janela).toContainText('não pode ser desfeita');
      await janela.getByRole('button', { name: 'Cancelar' }).click();
      // Então: nada foi excluído
      await expect(janela).toHaveCount(0);
      await expect(botao('Desarquivar')).toBeVisible();
      // Quando: o Desarquivar da faixa
      await botao('Desarquivar').click();
      // Então
      await expect(page.getByText(/desarquivad[ao]\./)).toBeVisible();
      await expect(botao('Editar')).toBeVisible();
      await expect(botao('Desarquivar')).toHaveCount(0);
      expect(await acoesNoMenuDoCartao(page, cartao)).toEqual(['Arquivar']);
    });
  }

  test('quando a pessoa desarquiva pelo ⋯ e não pela faixa, então o cartão volta do mesmo jeito', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).first().getByText('Renovar a procuração').first().click();
    const cartao = page.getByRole('dialog');
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByRole('button', { name: 'Desarquivar', exact: true })).toBeVisible();
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Desarquivar');
    // Então
    await expect(cartao.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Desarquivar', exact: true })).toHaveCount(0);
  });
});
