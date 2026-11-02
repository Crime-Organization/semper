// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Processos. Na semente do banco fictício: o processo judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA TESTE
// (TJMG, em "Distribuído"), e o administrativo 912345678, "Registro da marca Exemplo", de MARIA APARECIDA EXEMPLO (INPI,
// em "Protocolado"). Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
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

  test('quando se abre o endereço geral de processos, então abre o painel', async ({ page }) => {
    // Quando
    await page.goto('/processos/');
    // Então
    await expect(page.getByRole('heading', { name: 'Prazos' })).toBeVisible();
    await expect(page).toHaveURL(/\/processos\/$/);
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

test.describe('Campos do escritório', () => {
  /** Cria um campo em Configurações. */
  async function criarCampo(page: Page, nome: string, tipo: string, { aparece, opcoes }: { aparece?: string; opcoes?: string } = {}) {
    await page.goto('/configuracoes/');
    await page.getByRole('button', { name: 'Novo campo' }).click();
    const form = page.getByRole('form', { name: 'Novo campo' });
    await form.getByLabel('Nome do campo').fill(nome);
    await form.getByLabel('Tipo').selectOption({ label: tipo });
    if (aparece) await form.getByLabel('Aparece em').selectOption({ label: aparece });
    if (opcoes) await form.getByLabel('Opções').fill(opcoes);
    await form.getByRole('button', { name: 'Criar campo' }).click();
    await expect(page.getByRole('row').filter({ hasText: nome })).toBeVisible();
  }

  test('quando o administrador cria campos, então eles aparecem no cadastro, são conferidos, e vão para o cartão e o histórico', async ({ page }) => {
    // Dado
    await criarCampo(page, 'Perito', 'Texto', { aparece: 'Só judicial' });
    await criarCampo(page, 'Data da perícia', 'Data');
    await criarCampo(page, 'Origem do caso', 'Lista de opções', { opcoes: 'Indicação\nSite\nParceiro' });
    // Quando
    await cadastroAteDetalhes(page, NUMERO_NOVO);
    await page.getByLabel('Perito').fill('Dra. Exemplo');
    await page.getByLabel('Data da perícia').fill('31022026');
    await page.getByLabel('Origem do caso').selectOption({ label: 'Site' });
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então: a data errada avisa e não salva
    await expect(page.getByText('Etapa 3 de 3')).toBeVisible();
    await expect(page.getByRole('alert').first()).toBeVisible();
    // Quando
    await page.getByLabel('Data da perícia').fill('10122026');
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Dados do processo');
    await expect(cartao.getByRole('definition').filter({ hasText: 'Dra. Exemplo' })).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: '10/12/2026' })).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: 'Site' })).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await expect(cartao.getByLabel('Data da perícia')).toHaveValue('10/12/2026');
    await cartao.getByLabel('Perito').fill('Dr. Outro');
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByRole('listitem').filter({ hasText: 'Perito:' })).toContainText('Dr. Outro');
  });

  test('quando o campo é só do judicial, então não aparece no administrativo', async ({ page }) => {
    // Dado
    await criarCampo(page, 'Perito', 'Texto', { aparece: 'Só judicial' });
    // Quando
    await page.goto('/processos/novo/?tipo=administrativo');
    await page.getByLabel('Número do processo').fill('INPI 5');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByLabel('Sistema de tramitação')).toBeVisible();
    await expect(page.getByLabel('Perito')).toHaveCount(0);
  });

  test('quando apaga um campo, então ele some do cadastro e do cartão, e ao reativar o valor volta', async ({ page }) => {
    // Dado
    await criarCampo(page, 'Perito', 'Texto');
    await cadastroAteDetalhes(page, NUMERO_NOVO);
    await page.getByLabel('Perito').fill('Dra. Exemplo');
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
    const endereco = page.url();
    // Quando
    await page.goto('/configuracoes/');
    await page.getByRole('row').filter({ hasText: 'Perito' }).getByRole('button', { name: 'Apagar' }).click();
    await page.getByRole('button', { name: 'Confirmar: apagar Perito' }).click();
    await expect(page.getByText('Campo "Perito" apagado.')).toBeVisible();
    await page.goto(endereco);
    // Então
    await abrirSecao(page.getByRole('dialog'), 'Dados do processo');
    await expect(page.getByRole('dialog').getByText('Dra. Exemplo')).toHaveCount(0);
    // Quando
    await page.goto('/configuracoes/');
    await abrirSecao(page, 'Campos apagados');
    await page.getByRole('button', { name: 'Reativar o campo Perito' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Perito' })).toBeVisible();
    await page.goto(endereco);
    // Então
    await expect(page.getByRole('dialog').getByText('Dra. Exemplo')).toBeVisible();
  });

  test('quando desfaz a mudança de um campo, então nome e opções voltam; ao desfazer a criação, o nome fica livre', async ({ page }) => {
    // Dado
    await criarCampo(page, 'Origem', 'Lista de opções', { opcoes: 'Site\nParceiro' });
    await page.getByRole('button', { name: 'Mudar o campo Origem' }).click();
    const form = page.getByRole('form', { name: 'Mudar campo' });
    await form.getByLabel('Nome do campo').fill('Fonte');
    await form.getByLabel('Opções').fill('Parceiro');
    await form.getByRole('button', { name: 'Salvar campo' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Fonte' })).toBeVisible();
    // Quando
    await expect(page.getByText('Campo atualizado.')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    const linha = page.getByRole('row').filter({ hasText: 'Origem' });
    await expect(linha).toContainText('Site, Parceiro');
    // Dado
    await criarCampo(page, 'Perito', 'Texto');
    // Quando
    await expect(page.getByText('Campo "Perito" criado.')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Perito' })).toHaveCount(0);
    await criarCampo(page, 'Perito', 'Data');
    await expect(page.getByRole('row').filter({ hasText: 'Perito' })).toContainText('Data');
  });

  test('quando muda um campo, então o tipo fica bloqueado, e um nome repetido é avisado', async ({ page }) => {
    // Dado
    await criarCampo(page, 'Perito', 'Texto');
    await criarCampo(page, 'Assistente', 'Texto');
    // Quando
    await page.getByRole('button', { name: 'Mudar o campo Assistente' }).click();
    const form = page.getByRole('form', { name: 'Mudar campo' });
    // Então
    await expect(form.getByLabel('Tipo')).toBeDisabled();
    // Quando
    await form.getByLabel('Nome do campo').fill('perito');
    await form.getByRole('button', { name: 'Salvar campo' }).click();
    // Então
    await expect(form.getByText('Já existe um campo com esse nome.')).toBeVisible();
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

test.describe('Andamentos, prazos e intimações', () => {
  /** Abre o cartão do processo judicial da semente. */
  async function abrirCartao(page: Page) {
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
    return cartao;
  }
  async function lancarAndamento(cartao: Locator, tipo: string, texto: string) {
    await cartao.getByRole('button', { name: 'Novo andamento' }).click();
    const form = cartao.getByRole('form', { name: 'Novo andamento' });
    await form.getByLabel('Tipo').selectOption({ label: tipo });
    await form.getByLabel('O que aconteceu').fill(texto);
    await form.getByRole('button', { name: 'Lançar andamento' }).click();
    await expect(form).toHaveCount(0);
  }

  test('quando lança um prazo calculado, então vê o último dia e os dias pulados, e ele vai para o histórico', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    // Quando
    await form.getByLabel('Que prazo é este').fill('Contestação');
    await form.getByLabel('Intimação').fill('2026-11-13');
    await form.getByLabel('Dias', { exact: true }).fill('5');
    await form.getByRole('group', { name: 'Contagem' }).getByText('Dias úteis').click();
    // Então: sexta 13/11; contam 16, 17, 18, 19 e 23, porque 20/11 é feriado
    const resultado = form.getByRole('status', { name: 'Resultado do prazo' });
    await expect(resultado).toContainText('23/11/2026');
    await expect(resultado).toContainText('Consciência Negra');
    // Quando
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    // Então
    const lista = cartao.getByRole('list', { name: 'Prazos do processo' });
    await expect(lista).toContainText('Contestação');
    await expect(lista).toContainText('23/11/2026');
    await expect(lista).toContainText('5 dias úteis desde 13/11/2026');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText('Contestação: 23/11/2026')).toBeVisible();
  });

  test('quando digita a data de um prazo vencido, então o cartão alerta; ao marcar cumprido, o alerta some', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill('Recurso');
    await form.getByText('Digitar a data').click();
    // Quando
    await form.getByLabel('Último dia').fill('2020-01-15');
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    // Então
    await expect(cartao.getByText('Este processo tem 1 prazo vencido.')).toBeVisible();
    await expect(cartao.getByText('Data digitada')).toBeVisible();
    // Quando
    await cartao.getByRole('checkbox', { name: 'Prazo cumprido: Recurso' }).click();
    // Então
    await expect(cartao.getByText('Este processo tem 1 prazo vencido.')).toHaveCount(0);
    await expect(cartao.getByRole('list', { name: 'Prazos do processo' })).toContainText('Cumprido');
    // Quando: desfaz
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(cartao.getByText('Este processo tem 1 prazo vencido.')).toBeVisible();
  });

  test('quando volta de "Digitar" para "Calcular" e muda os dias, então "Digitar" traz o cálculo novo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    const resultado = form.getByRole('status', { name: 'Resultado do prazo' });
    await form.getByLabel('Intimação').fill('2026-03-02');
    await form.getByLabel('Dias', { exact: true }).fill('30');
    await expect(resultado).toContainText('01/04/2026');
    await form.getByText('Digitar a data').click();
    await expect(form.getByLabel('Último dia')).toHaveValue('2026-04-01');
    // Quando
    await form.getByText('Calcular pelo calendário').click();
    await form.getByLabel('Dias', { exact: true }).fill('5');
    await expect(resultado).toContainText('09/03/2026');
    await form.getByText('Digitar a data').click();
    // Então
    await expect(form.getByLabel('Último dia')).toHaveValue('2026-03-09');
    // Quando: digita à mão e passeia pelos modos
    await form.getByLabel('Último dia').fill('2026-05-20');
    await form.getByText('Calcular pelo calendário').click();
    await form.getByText('Digitar a data').click();
    // Então: a data digitada fica
    await expect(form.getByLabel('Último dia')).toHaveValue('2026-05-20');
  });

  test('quando dá dois cliques em "Criar tarefa", então nasce uma tarefa só', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await lancarAndamento(cartao, 'Intimação', 'Intimado uma vez');
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    // Quando
    await lista.getByRole('button', { name: 'Criar tarefa' }).dblclick();
    await expect(lista.getByRole('link', { name: /^Tarefa / })).toBeVisible();
    // Então
    await abrirSecao(cartao, 'Tarefas');
    await expect(cartao.getByRole('link', { name: /Intimação: Intimado uma vez/ })).toHaveCount(1);
  });

  test('quando muda o último dia de um prazo com tarefa, então a tarefa acompanha', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo' }).click();
    let form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill('Réplica');
    await form.getByText('Digitar a data').click();
    await form.getByLabel('Último dia').fill('2030-03-15');
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    const lista = cartao.getByRole('list', { name: 'Prazos do processo' });
    await lista.getByRole('button', { name: 'Criar tarefa' }).click();
    await expect(lista.getByRole('link', { name: /^Tarefa / })).toBeVisible();
    // Quando
    await lista.getByRole('button', { name: 'Mudar o prazo Réplica' }).click();
    form = cartao.getByRole('form', { name: 'Mudar prazo' });
    await form.getByLabel('Último dia').fill('2030-01-10');
    await form.getByRole('button', { name: 'Salvar prazo' }).click();
    await expect(lista).toContainText('10/01/2030');
    // Então
    await lista.getByRole('link', { name: /^Tarefa / }).click();
    await expect(page.getByRole('dialog')).toContainText('10/01/2030');
  });

  test('quando exclui um prazo, então ele some, e desfazer traz de volta', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill('Para excluir');
    await form.getByText('Digitar a data').click();
    await form.getByLabel('Último dia').fill('2030-01-15');
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    const lista = cartao.getByRole('list', { name: 'Prazos do processo' });
    await expect(lista).toContainText('Para excluir');
    // Quando
    await lista.getByRole('button', { name: 'Excluir', exact: true }).click();
    await lista.getByRole('button', { name: 'Confirmar: excluir Para excluir' }).click();
    // Então
    await expect(cartao.getByText('Nenhum prazo lançado.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(lista).toContainText('Para excluir');
  });

  test('quando é audiência, então pede hora e local, e eles aparecem na lista', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await cartao.getByRole('button', { name: 'Novo andamento' }).click();
    const form = cartao.getByRole('form', { name: 'Novo andamento' });
    await expect(form.getByLabel('Hora')).toHaveCount(0);
    // Quando
    await form.getByLabel('Tipo').selectOption({ label: 'Audiência' });
    await form.getByLabel('Data da audiência').fill('2030-03-20');
    await form.getByLabel('Hora').fill('14:30');
    await form.getByLabel('Local').fill('Fórum Central');
    await form.getByLabel('O que aconteceu').fill('Audiência de conciliação');
    await form.getByRole('button', { name: 'Lançar andamento' }).click();
    // Então
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    await expect(lista).toContainText('20/03/2030 às 14:30 em Fórum Central');
    await expect(lista).toContainText('Audiência de conciliação');
    await expect(lista.getByRole('button', { name: 'Criar tarefa' })).toHaveCount(0);
  });

  test('quando esquece o texto do andamento, então avisa no campo e não lança', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await cartao.getByRole('button', { name: 'Novo andamento' }).click();
    const form = cartao.getByRole('form', { name: 'Novo andamento' });
    // Quando
    await form.getByRole('button', { name: 'Lançar andamento' }).click();
    // Então
    await expect(form.getByText('Escreva o que aconteceu.')).toBeVisible();
    await expect(cartao.getByRole('list', { name: 'Andamentos do processo' }).getByRole('listitem')).toHaveCount(0);
  });

  test('quando cria a tarefa de uma intimação, então ela sai de "a tratar", e a tarefa abre com o processo ligado', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await lancarAndamento(cartao, 'Intimação', 'Intimado para contestar');
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    await expect(lista.getByText('A tratar', { exact: true })).toBeVisible();
    // Quando
    await lista.getByRole('button', { name: 'Criar tarefa' }).click();
    // Então
    await expect(lista.getByText('A tratar', { exact: true })).toHaveCount(0);
    await expect(lista.getByRole('button', { name: 'Criar tarefa' })).toHaveCount(0);
    // Quando: abre a tarefa
    await lista.getByRole('link', { name: /^Tarefa / }).click();
    // Então
    const tarefa = page.getByRole('dialog');
    await expect(tarefa.getByRole('heading', { name: 'Intimação: Intimado para contestar' })).toBeVisible();
    await abrirSecao(tarefa, 'Processo');
    // Quando: abre o processo
    await tarefa.getByRole('link', { name: /0001234-97\.2026\.8\.13\.0024/ }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/judicial\/\?id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
  });

  test('quando desfaz a tarefa criada da intimação, então ela volta a ficar a tratar, e a tarefa vai para o arquivo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await lancarAndamento(cartao, 'Intimação', 'Intimado para pagar');
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    await lista.getByRole('button', { name: 'Criar tarefa' }).click();
    await expect(lista.getByRole('link', { name: /^Tarefa / })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(lista.getByText('A tratar', { exact: true })).toBeVisible();
    await expect(lista.getByRole('link', { name: /^Tarefa / })).toHaveCount(0);
    await abrirSecao(cartao, 'Tarefas');
    await expect(cartao.getByRole('link', { name: /Intimação: Intimado para pagar/ })).toContainText('Arquivada');
  });

  test('quando a intimação não precisa de tarefa, então sai de "a tratar", e pode voltar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await lancarAndamento(cartao, 'Intimação', 'Ciência da decisão');
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    // Quando
    await lista.getByRole('button', { name: 'Não precisa de tarefa' }).click();
    // Então
    await expect(lista.getByText('A tratar', { exact: true })).toHaveCount(0);
    // Quando
    await lista.getByRole('button', { name: 'Voltar a tratar' }).click();
    // Então
    await expect(lista.getByText('A tratar', { exact: true })).toBeVisible();
  });

  test('quando lança um prazo a partir da intimação, então ele já vem com a data dela e fica ligado', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await cartao.getByRole('button', { name: 'Novo andamento' }).click();
    const novo = cartao.getByRole('form', { name: 'Novo andamento' });
    await novo.getByLabel('Tipo').selectOption({ label: 'Intimação' });
    await novo.getByLabel('Data da intimação').fill('2026-11-13');
    await novo.getByLabel('O que aconteceu').fill('Intimado');
    await novo.getByRole('button', { name: 'Lançar andamento' }).click();
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    // Quando
    await lista.getByRole('button', { name: 'Lançar prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await expect(form.getByLabel('Intimação')).toHaveValue('2026-11-13');
    await form.getByLabel('Que prazo é este').fill('Manifestação');
    await expect(form.getByRole('status', { name: 'Resultado do prazo' })).toContainText('Último dia');
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    // Então
    await expect(lista).toContainText('Prazo: Manifestação');
  });

  test('quando o processo está arquivado, então vê os prazos e os andamentos, sem poder mudar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Andamentos');
    await lancarAndamento(cartao, 'Andamento', 'Juntada');
    // Quando
    await cartao.getByRole('button', { name: 'Arquivar' }).click();
    await expect(page.getByText('Processo arquivado.', { exact: false }).first()).toBeVisible();
    // Então
    await expect(cartao.getByRole('list', { name: 'Andamentos do processo' })).toContainText('Juntada');
    await expect(cartao.getByRole('button', { name: 'Novo andamento' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /^Mudar o andamento/ })).toHaveCount(0);
  });
});

test.describe('Painel de Processos', () => {
  const dias = (n: number) => { const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  async function abrirCartaoJudicial(page: Page) {
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
    return cartao;
  }
  async function lancarPrazoDigitado(cartao: Locator, descricao: string, final: string) {
    await cartao.getByRole('button', { name: 'Novo prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill(descricao);
    await form.getByText('Digitar a data').click();
    await form.getByLabel('Último dia').fill(final);
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    await expect(form).toHaveCount(0);
  }
  async function lancarAndamento(cartao: Locator, tipo: string, texto: string, data?: string) {
    await abrirSecao(cartao, 'Andamentos');
    await cartao.getByRole('button', { name: 'Novo andamento' }).click();
    const form = cartao.getByRole('form', { name: 'Novo andamento' });
    await form.getByLabel('Tipo').selectOption({ label: tipo });
    if (data) await form.getByLabel(/^Data/).fill(data);
    await form.getByLabel('O que aconteceu').fill(texto);
    await form.getByRole('button', { name: 'Lançar andamento' }).click();
    await expect(form).toHaveCount(0);
  }

  test('quando clica em Processos no menu, então o painel abre, e o submenu mostra os quadros', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('button', { name: 'Processos' }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/$/);
    await expect(page.getByRole('heading', { name: 'Processos', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Intimações a tratar' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Judicial' })).toBeVisible();
    await expect(page.getByText('Nenhuma intimação a tratar.')).toBeVisible();
  });

  test('quando há prazos e audiências, então cada um aparece no seu grupo, e o clique abre o cartão do processo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await abrirSecao(cartao, 'Prazos');
    await lancarPrazoDigitado(cartao, 'Prazo velho', dias(-3));
    await lancarPrazoDigitado(cartao, 'Prazo de hoje', dias(0));
    await lancarPrazoDigitado(cartao, 'Prazo perto', dias(5));
    await lancarPrazoDigitado(cartao, 'Prazo longe', dias(30));
    await lancarAndamento(cartao, 'Audiência', 'Conciliação marcada', dias(10));
    // Quando
    await page.goto('/processos/');
    // Então
    await expect(page.getByRole('region', { name: 'Vencidos' })).toContainText('Prazo velho');
    await expect(page.getByRole('region', { name: 'Vencem hoje' })).toContainText('Prazo de hoje');
    await expect(page.getByRole('region', { name: 'Próximos 7 dias' })).toContainText('Prazo perto');
    await expect(page.getByText('Prazo longe')).toHaveCount(0);
    await expect(page.getByText('Conciliação marcada')).toBeVisible();
    // Quando
    await page.getByRole('link', { name: /Prazo velho/ }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/judicial\/\?id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
  });

  test('quando cria a tarefa de uma intimação pelo painel, então ela sai da lista, e desfazer a traz de volta', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await lancarAndamento(cartao, 'Intimação', 'Intimação do painel');
    await page.goto('/processos/');
    await expect(page.getByRole('link', { name: /Intimação do painel/ }).first()).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Criar tarefa da intimação: Intimação do painel' }).click();
    // Então
    await expect(page.getByText('Nenhuma intimação a tratar.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(page.getByRole('button', { name: 'Criar tarefa da intimação: Intimação do painel' })).toBeVisible();
  });

  test('quando o administrador muda os dias de parado, então a lista acompanha', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await lancarAndamento(cartao, 'Andamento', 'Andamento antigo', dias(-10));
    await page.goto('/processos/');
    await expect(page.getByText('Sem andamento há mais de 60 dias.', { exact: false })).toBeVisible();
    const form = page.getByRole('form', { name: 'Dias para considerar parado' });
    // Quando: um valor que não serve
    await form.getByLabel('Dias sem andamento para considerar parado').fill('0');
    await form.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(form.getByText('Use um número de 1 a 3650.')).toBeVisible();
    // Quando
    await form.getByLabel('Dias sem andamento para considerar parado').fill('5');
    await form.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Sem andamento há mais de 5 dias.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /10 dias sem andamento/ })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando clica no número de uma fase, então abre o quadro filtrado por ela', async ({ page }) => {
    // Dado
    await page.goto('/processos/');
    const judicial = page.getByRole('region', { name: 'Processos judiciais' });
    // Quando
    await judicial.getByRole('link', { name: /1 Distribuído/ }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/judicial\/\?etapa=/);
    await expect(page.getByText('JOSÉ DA SILVA TESTE').first()).toBeVisible();
    await page.getByRole('button', { name: 'Filtros' }).click();
    await expect(page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Situação')).toHaveValue(/.+/);
    await expect(page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Situação').locator('option:checked')).toHaveText('Distribuído');
  });

  test('quando escolhe Meus, então a escolha fica guardada', async ({ page }) => {
    // Dado
    await page.goto('/processos/');
    // Quando
    await page.getByRole('group', { name: 'Mostrar' }).getByText('Meus').click();
    await expect(page.getByRole('radio', { name: 'Meus' })).toBeChecked();
    await page.reload();
    // Então
    await expect(page.getByRole('radio', { name: 'Meus' })).toBeChecked();
  });
});

