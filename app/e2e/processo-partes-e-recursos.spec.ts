// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Processo: pessoas com papel, recursos e incidentais (#316) e os tipos que ficaram, judicial e administrativo (#406). Na semente do banco fictício:
// o processo judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA TESTE, e a pessoa LUCIANA ROCHA AMOSTRA. Quem está logado é o
// Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
const NUMERO_DO_RECURSO = '0005678-13.2026.8.13.0433';

/** O id de um item da semente, lido do banco fictício da aba pelo valor de um campo. */
async function idDe(page: Page, colecao: 'pessoas' | 'processos', campo: string, valor: string) {
  await page.goto('/inicio/');
  return page.evaluate(([chave, c, k, v]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, Record<string, unknown>[]>;
    return bd[c].find(x => String(x[k]).startsWith(v))!.id as string;
  }, [CHAVE, colecao, campo, valor]);
}
/** Abre o cartão pelo endereço e espera o título dele. */
async function abrirCartao(page: Page, endereco: string, titulo: string | RegExp) {
  await page.goto(endereco);
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}

test.describe('Pessoas com papel no processo (#316)', () => {
  test('dado o cartão de um processo, quando liga uma pessoa como testemunha, então ela aparece no processo com o papel, e o processo aparece no cartão dela', async ({ page }) => {
    // Dado
    const processo = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    const luciana = await idDe(page, 'pessoas', 'nome', 'LUCIANA ROCHA AMOSTRA');
    let cartao = await abrirCartao(page, '/processos/judicial/?id=' + processo, 'JOSÉ DA SILVA TESTE');
    const pessoas = await secao(cartao, 'Pessoas do processo');
    await expect(pessoas).toContainText('Nenhuma pessoa com papel neste processo');
    // Quando
    await pessoas.getByRole('button', { name: 'Ligar pessoa com papel', exact: true }).click();
    await pessoas.getByLabel('Papel no processo').selectOption({ label: 'Testemunha' });
    await pessoas.getByRole('textbox', { name: 'Pessoa', exact: true }).fill('luciana');
    await pessoas.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await pessoas.getByRole('button', { name: 'Ligar ao processo' }).click();
    // Então
    await expect(page.getByText('LUCIANA ROCHA AMOSTRA entrou no processo como testemunha.')).toBeVisible();
    await expect(pessoas.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Testemunha');
    await expect(cartao.getByRole('button', { name: 'Pessoas do processo 1' })).toBeVisible();
    // E o histórico do processo registra a entrada
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao).toContainText('LUCIANA ROCHA AMOSTRA (Testemunha)');
    // E, do outro lado, o cartão da pessoa mostra o processo com o papel dela
    cartao = await abrirCartao(page, '/pessoas/?id=' + luciana, 'LUCIANA ROCHA AMOSTRA');
    const processos = await secao(cartao, 'Processos');
    await expect(processos.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toContainText('Testemunha');
  });

  test('dado uma pessoa com papel, quando ela é tirada do processo, então sai da lista', async ({ page }) => {
    // Dado
    const processo = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    const cartao = await abrirCartao(page, '/processos/judicial/?id=' + processo, 'JOSÉ DA SILVA TESTE');
    const pessoas = await secao(cartao, 'Pessoas do processo');
    await pessoas.getByRole('button', { name: 'Ligar pessoa com papel', exact: true }).click();
    await pessoas.getByLabel('Papel no processo').selectOption({ label: 'Perito' });
    await pessoas.getByRole('textbox', { name: 'Pessoa', exact: true }).fill('luciana');
    await pessoas.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await pessoas.getByRole('button', { name: 'Ligar ao processo' }).click();
    await expect(pessoas.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toBeVisible();
    // Quando
    await pessoas.getByRole('button', { name: 'Tirar LUCIANA ROCHA AMOSTRA (Perito) do processo' }).click();
    // Então
    await expect(pessoas.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toHaveCount(0);
    await expect(pessoas).toContainText('Nenhuma pessoa com papel neste processo');
  });
});

test.describe('Recursos e incidentais (#316)', () => {
  test('dado um processo, quando cria um recurso a partir dele, então o recurso nasce ligado à origem, com o próprio número, e cada um mostra o outro', async ({ page }) => {
    // Dado
    const processo = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    let cartao = await abrirCartao(page, '/processos/judicial/?id=' + processo, 'JOSÉ DA SILVA TESTE');
    let ligados = await secao(cartao, 'Recursos e incidentais');
    await expect(ligados).toContainText('Nenhum recurso ou incidental ligado a este processo.');
    // Quando
    await ligados.getByRole('link', { name: 'Novo recurso', exact: true }).click();
    // Então o cadastro já vem como recurso, com os clientes do processo de origem
    await expect(page.getByText(/Este processo nasce do processo/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Este processo é' }).getByRole('radio', { name: 'Recurso' })).toBeChecked();
    await page.getByLabel('Número do processo').fill(NUMERO_DO_RECURSO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByTitle('JOSÉ DA SILVA TESTE', { exact: true })).toBeVisible();
    // E o cliente vem com o papel que tem no processo de origem (#426)
    await expect(page.getByLabel('Papel do cliente')).toHaveValue('autor');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então volta ao processo de origem, que mostra o recurso
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    ligados = await secao(cartao, 'Recursos e incidentais');
    const recurso = ligados.getByRole('link', { name: /Recurso deste processo/ });
    await expect(recurso).toContainText(NUMERO_DO_RECURSO);
    await expect(cartao.getByRole('button', { name: 'Recursos e incidentais 1' })).toBeVisible();
    // E o recurso mostra o processo de origem, com o próprio número
    await recurso.click();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByText(NUMERO_DO_RECURSO, { exact: true })).toBeVisible();
    ligados = await secao(cartao, 'Recursos e incidentais');
    await expect(ligados.getByRole('link', { name: /Processo de origem/ })).toContainText('0001234-97.2026.8.13.0024');
  });

  test('dado o cadastro aberto pelo "+" da seção, quando tenta seguir sem dizer se é recurso ou incidental, então o cadastro pede', async ({ page }) => {
    // Dado
    const processo = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    const cartao = await abrirCartao(page, '/processos/judicial/?id=' + processo, 'JOSÉ DA SILVA TESTE');
    await abrirSecao(cartao, 'Recursos e incidentais');
    // Quando
    await cartao.getByRole('link', { name: 'Novo recurso ou incidental deste processo' }).click();
    await expect(page.getByText(/Este processo nasce do processo/)).toBeVisible();
    await page.getByLabel('Número do processo').fill(NUMERO_DO_RECURSO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Escolha se é um recurso ou um incidental.')).toBeVisible();
    // Quando escolhe incidental, então segue
    await page.getByRole('group', { name: 'Este processo é' }).getByText('Incidental', { exact: true }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByRole('button', { name: 'Próxima' })).toBeVisible();
    await expect(page.getByText('Escolha se é um recurso ou um incidental.')).toHaveCount(0);
  });
});

test.describe('Tipos de processo: judicial e administrativo (#406)', () => {
  test('dado o cadastro de processo, quando a pessoa cadastra uma investigação, então ela é um processo administrativo, e o quadro tem as colunas da investigação', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    const tipo = page.getByRole('group', { name: 'Tipo' });
    await expect(tipo.getByRole('radio')).toHaveCount(2);
    await expect(tipo.getByText('Extrajudicial', { exact: true })).toHaveCount(0);
    await expect(tipo.getByText('Investigação', { exact: true })).toHaveCount(0);
    // Quando
    await tipo.getByText('Administrativo', { exact: true }).click();
    await page.getByLabel('Número do processo').fill('IP 123/2026');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByLabel('Papel do cliente').selectOption('autor');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/administrativo\/\?id=/);
    await expect(page.getByRole('heading', { name: 'Processos administrativos', level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Administrativo', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).first().click();
    await expect(page.getByRole('list', { name: 'Protocolado', exact: true })).toContainText('LUCIANA ROCHA AMOSTRA');
    for (const coluna of ['Instaurado', 'Pedido de acesso aos autos', 'Oitiva ou depoimento', 'Diligências pendentes', 'Relatório final', 'Denúncia oferecida']) {
      await expect(page.getByRole('list', { name: coluna, exact: true })).toBeVisible();
    }
    // E o menu não tem mais Extrajudicial nem Investigação
    const menu = page.getByRole('navigation', { name: 'Seções' });
    await expect(menu.getByRole('link', { name: 'Administrativo', exact: true })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Extrajudicial', exact: true })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Investigação', exact: true })).toHaveCount(0);
  });

  for (const antigo of ['/processos/extrajudicial/', '/processos/investigacao/']) {
    test(`dado o endereço antigo ${antigo}, quando alguém o abre, então vai para os processos administrativos`, async ({ page }) => {
      // Quando
      await page.goto(antigo);
      // Então
      await expect(page).toHaveURL(/\/processos\/administrativo\/$/);
      await expect(page.getByRole('heading', { name: 'Processos administrativos', level: 1 })).toBeVisible();
    });
  }

  test('dado o cadastro de um processo judicial, quando chega aos detalhes, então o advogado da parte contrária continua lá', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').fill(NUMERO_DO_RECURSO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByLabel('Papel do cliente').selectOption('autor');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByLabel('Advogado da parte contrária')).toBeVisible();
  });
});
