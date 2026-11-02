// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Processos. Na semente do banco fictício: o processo judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA TESTE
// (TJMG, em "Distribuído"), e o administrativo 912345678, "Registro da marca Exemplo", de MARIA APARECIDA EXEMPLO (INPI,
// em "Protocolado"). Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao } from './ajudantes';

const NUMERO_NOVO = '0005678-13.2026.8.13.0433';

/** Passa pelas etapas do cadastro até salvar, escolhendo o cliente. */
async function cadastrar(page: Page, { numero, cliente, tipo }: { numero: string; cliente: RegExp; tipo?: string }) {
  await page.goto('/processos/novo/');
  if (tipo) await page.getByRole('group', { name: 'Tipo' }).getByText(tipo, { exact: true }).click();
  await page.getByLabel('Número do processo').fill(numero);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: cliente }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar processo' }).click();
}

/** Abre o cadastro e chega à etapa dos detalhes. */
async function cadastroAteDetalhes(page: Page, numero: string) {
  await page.goto('/processos/novo/');
  await page.getByLabel('Número do processo').fill(numero);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
}

test.describe('Menu de processos', () => {
  test('quando a pessoa abre o submenu, então vê os dois quadros, cada um com os seus processos e colunas', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('button', { name: 'Processos' }).click();
    await abrir(page, 'Judicial');
    // Então
    await expect(page).toHaveURL(/\/processos\/judicial\/$/);
    await expect(page.getByRole('heading', { name: 'Processos judiciais', level: 1 })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Distribuído', exact: true })).toContainText('JOSÉ DA SILVA TESTE');
    await expect(page.getByRole('region', { name: 'Grupo Conhecimento' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Protocolado', exact: true })).toHaveCount(0);
    // Quando
    await abrir(page, 'Administrativo');
    // Então
    await expect(page.getByRole('heading', { name: 'Processos administrativos', level: 1 })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Protocolado', exact: true })).toContainText('Registro da marca Exemplo');
    await expect(page.getByRole('list', { name: 'Distribuído', exact: true })).toHaveCount(0);
  });

  test('quando abre o submenu, então Administrativo vem antes de Judicial', async ({ page }) => {
    // Quando
    await page.goto('/processos/judicial/');
    // Então
    const links = page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: /^(Administrativo|Judicial)$/ });
    await expect(links).toHaveText(['Administrativo', 'Judicial']);
  });

  test('quando se abre o endereço geral de processos, então vai para o quadro judicial', async ({ page }) => {
    // Quando
    await page.goto('/processos/');
    // Então
    await expect(page).toHaveURL(/\/processos\/judicial\/$/);
  });

  test('quando o processo tem órgão, então ele aparece no cartão do quadro, acima do nome', async ({ page }) => {
    // Quando
    await page.goto('/processos/judicial/');
    // Então
    const cartao = page.getByRole('list', { name: 'Distribuído', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    await expect(cartao.getByText('TJMG', { exact: true })).toBeVisible();
    await expect(cartao).toContainText('0001234-97.2026.8.13.0024');
    const texto = await cartao.innerText();
    expect(texto.indexOf('TJMG')).toBeLessThan(texto.indexOf('JOSÉ DA SILVA TESTE'));
  });
});

test.describe('Cadastro de processo', () => {
  test('quando cadastra um processo judicial, então o número indica o órgão e ele entra em "Distribuído"', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await expect(page.getByText('Etapa 1 de 3')).toBeVisible();
    // Quando
    await page.getByLabel('Número do processo').fill('00056781320268130433');
    // Então
    await expect(page.getByLabel('Número do processo')).toHaveValue(NUMERO_NOVO);
    await expect(page.getByLabel('Órgão', { exact: true })).toHaveValue('TJMG');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByLabel('Polo do cliente').selectOption({ label: 'Réu' });
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByLabel('Comarca').fill('Montes Claros');
    await page.getByLabel('Valor da causa').fill('1.500,50');
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    await expect(cartao).toContainText(NUMERO_NOVO);
    await expect(cartao.getByLabel('Situação do processo').getByRole('option', { selected: true })).toHaveText('Distribuído');
    await abrirSecao(cartao, 'Dados do processo');
    await expect(cartao.getByRole('definition').filter({ hasText: 'Montes Claros' })).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: 'R$' })).toContainText('1.500,50');
    await expect(cartao.getByRole('definition').filter({ hasText: 'Réu' })).toBeVisible();
  });

  test('quando o número judicial está fora do padrão, então avisa; marcado como antigo, segue', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    // Quando
    await page.getByLabel('Número do processo').fill('1234');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('O número do processo tem 20 algarismos')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'O processo', level: 2 })).toBeVisible();
    // Quando
    await page.getByRole('group', { name: 'Formato do número' }).getByText(/número antigo/).click();
    await page.getByLabel('Número do processo').fill('1234/98');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByRole('heading', { name: 'Pessoas', level: 2 })).toBeVisible();
  });

  test('quando digita um número antigo e só depois marca a caixa, então ele fica como foi digitado', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').pressSequentially('2004.38.00.012345-6');
    // Quando
    await page.getByRole('group', { name: 'Formato do número' }).getByText(/número antigo/).click();
    // Então
    await expect(page.getByLabel('Número do processo')).toHaveValue('2004.38.00.012345-6');
    await expect(page.getByLabel('Órgão', { exact: true })).toHaveValue('');
  });

  test('quando troca para administrativo depois de errar um campo do judicial, então salva, sem travar no campo que sumiu', async ({ page }) => {
    // Dado: no judicial, o valor da causa está errado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await expect(page.getByLabel('Órgão', { exact: true })).toHaveValue('TJMG');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByLabel('Valor da causa').fill('abc');
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    await expect(page.getByText('Use um valor como 1.500,00.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('group', { name: 'Tipo' }).getByText('Administrativo', { exact: true }).click();
    // Então: o órgão que o número indicou sai junto
    await expect(page.getByLabel('Órgão', { exact: true })).toHaveValue('');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/administrativo\/\?id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação do processo').getByRole('option', { selected: true })).toHaveText('Protocolado');
  });

  test('quando falta o cliente, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Escolha pelo menos um cliente.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pessoas', level: 2 })).toBeVisible();
  });

  test('quando o processo é administrativo, então o número é livre, os campos do judicial somem e ele entra em "Protocolado"', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/?tipo=administrativo');
    // Quando
    await page.getByLabel('Número do processo').fill('INPI 998877');
    await page.getByLabel('Nome do cartão').fill('Oposição à marca');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByLabel('Sistema de tramitação')).toBeVisible();
    await expect(page.getByLabel('Comarca')).toHaveCount(0);
    await expect(page.getByLabel('Gratuidade de justiça')).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Oposição à marca', level: 2 })).toBeVisible();
    await expect(cartao.getByLabel('Situação do processo').getByRole('option', { selected: true })).toHaveText('Protocolado');
    await expect(page).toHaveURL(/\/processos\/administrativo\//);
  });

  test('quando o número já existe no mesmo tipo, então avisa sem salvar', async ({ page }) => {
    // Quando
    await cadastrar(page, { numero: '0001234-97.2026.8.13.0024', cliente: /LUCIANA ROCHA AMOSTRA/ });
    // Então
    await expect(page.getByText('Já existe um processo com esse número.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Detalhes', level: 2 })).toBeVisible();
  });

  test('quando o administrador acrescenta uma opção, então ela fica escolhida e na lista dos próximos processos', async ({ page }) => {
    // Dado
    await cadastroAteDetalhes(page, NUMERO_NOVO);
    // Quando
    await page.getByRole('button', { name: 'Acrescentar opção' }).first().click();
    await page.getByRole('textbox', { name: 'Acrescentar opção em "Sistema de tramitação"' }).fill('Tucujuris');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByLabel('Sistema de tramitação')).toHaveValue('Tucujuris');
    // Quando: abre outro cadastro
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
    await cadastroAteDetalhes(page, '0009999-43.2025.4.06.3800');
    // Então
    await expect(page.getByLabel('Sistema de tramitação').getByRole('option', { name: 'Tucujuris' })).toBeAttached();
    // Quando: retira da lista
    await page.getByLabel('Sistema de tramitação').selectOption({ label: 'Tucujuris' });
    await page.getByRole('button', { name: 'Retirar da lista' }).click();
    // Então: a escolha fica neste processo, mas a lista dos próximos não a tem mais
    await expect(page.getByText('Opção "Tucujuris" retirada da lista.')).toBeVisible();
    await page.getByLabel('Sistema de tramitação').selectOption({ label: 'PJe' });
    await expect(page.getByLabel('Sistema de tramitação').getByRole('option', { name: 'Tucujuris' })).toHaveCount(0);
  });
});

test.describe('Cartão do processo', () => {
  /** Abre o processo da semente pela tabela. */
  async function abrirProcesso(page: Page) {
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    return cartao;
  }

  test('quando edita um campo, então ele muda no cartão e entra no histórico', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByLabel('Comarca').fill('Bocaiuva');
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await abrirSecao(cartao, 'Dados do processo');
    await expect(cartao.getByRole('definition').filter({ hasText: 'Bocaiuva' })).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Comarca/).last()).toBeVisible();
  });

  test('quando muda a situação, então o cartão vai para a coluna escolhida do quadro', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await cartao.getByLabel('Situação do processo').selectOption({ label: 'Contestação/defesa' });
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toContainText('Contestação/defesa');
  });

  test('quando arquiva o processo, então pode excluí-lo definitivamente, e ele some', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await cartao.getByRole('button', { name: 'Arquivar' }).click();
    await cartao.getByRole('button', { name: 'Excluir' }).click();
    await cartao.getByRole('button', { name: 'Confirmar exclusão definitiva' }).click();
    // Então
    await expect(page.getByText('Processo excluído definitivamente.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toHaveCount(0);
  });
});

test.describe('Filtros e cartão da pessoa', () => {
  test('quando busca pelos algarismos do número, sem a pontuação, então acha o processo', async ({ page }) => {
    // Dado
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Quando
    await page.getByRole('searchbox').fill('00012349720268130024');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    // Quando
    await page.getByRole('searchbox').fill('99999999');
    // Então
    await expect(page.getByText('Nenhum processo encontrado com esses filtros.')).toBeVisible();
  });

  test('quando filtra por órgão, então só ficam os processos dele', async ({ page }) => {
    // Dado
    await cadastrar(page, { numero: '0009999-43.2025.4.06.3800', cliente: /LUCIANA ROCHA AMOSTRA/ });
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Órgão').selectOption({ label: 'TJMG' });
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toHaveCount(0);
  });

  test('quando a pessoa é cliente de um processo, então o cartão dela o mostra, e dali ele abre', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const pessoa = page.getByRole('dialog');
    // Quando
    await abrirSecao(pessoa, 'Processos');
    const link = pessoa.getByRole('link', { name: /0001234-97\.2026\.8\.13\.0024/ });
    await expect(link).toContainText('Cliente');
    await expect(link).toContainText('Distribuído');
    await link.click();
    // Então
    await expect(page).toHaveURL(/\/processos\/judicial\/\?id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
  });
});
