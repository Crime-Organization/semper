// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Processos. Na semente do banco fictício: o processo judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA TESTE
// (TJMG, em "Distribuído"), e o administrativo 912345678, "Registro da marca Exemplo", de MARIA APARECIDA EXEMPLO (INPI,
// em "Protocolado"). Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao, acaoNoMenuDoCartao, entrarComo, escolherPapeisDosClientes } from './ajudantes';

const NUMERO_NOVO = '0005678-13.2026.8.13.0433';

/** Passa pelas etapas do cadastro até salvar, escolhendo o cliente. */
async function cadastrar(page: Page, { numero, cliente, tipo }: { numero: string; cliente: RegExp; tipo?: string }) {
  await page.goto('/processos/novo/');
  if (tipo) await page.getByRole('group', { name: 'Tipo' }).getByText(tipo, { exact: true }).click();
  await page.getByLabel('Número do processo').fill(numero);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: cliente }).click();
  await page.getByLabel('Papel do cliente').selectOption('autor');
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
  await page.getByLabel('Papel do cliente').selectOption('autor');
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

  test('dado um processo com papel do cliente, quando aparece no quadro e na lista, então mostra o papel junto do órgão e do sistema (#426)', async ({ page }) => {
    // Quando
    await page.goto('/processos/judicial/');
    // Então: no quadro, os selos ficam acima do nome
    const cartao = page.getByRole('list', { name: 'Distribuído', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    for (const selo of ['TJMG', 'PJe', 'Autor']) await expect(cartao.getByText(selo, { exact: true })).toBeVisible();
    const texto = await cartao.innerText();
    expect(texto.indexOf('AUTOR')).toBeLessThan(texto.indexOf('JOSÉ DA SILVA TESTE'));
    // Quando
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então: na lista, na coluna do órgão
    await expect(page.getByRole('columnheader', { name: 'Órgão e papel' })).toBeVisible();
    const linha = page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    for (const selo of ['TJMG', 'PJe', 'Autor']) await expect(linha.getByText(selo, { exact: true })).toBeVisible();
  });
});

test.describe('Cadastro de processo', () => {
  test('quando cadastra um processo judicial, então o número indica o órgão e ele entra em "Distribuído"', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await expect(page.getByText('Passo 1 de 3')).toBeVisible();
    // Quando
    await page.getByLabel('Número do processo').fill('00056781320268130433');
    // Então
    await expect(page.getByLabel('Número do processo')).toHaveValue(NUMERO_NOVO);
    await expect(page.getByLabel('Órgão', { exact: true })).toHaveValue('TJMG');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByLabel('Papel do cliente').selectOption({ label: 'Réu' });
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByLabel('Comarca').fill('Montes Claros');
    await page.getByLabel('Valor da causa').fill('1.500,50');
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    // No quadro de processos toda coluna fica num grupo, e o menu mostra o grupo na frente (#302).
    await expect(cartao.getByLabel('Situação do processo').getByRole('option', { selected: true })).toHaveText('INÍCIO: DISTRIBUÍDO');
    // E o número está em "Dados do processo" (não no topo do cartão: #430)
    await abrirSecao(cartao, 'Dados do processo');
    await expect(cartao.getByRole('definition').filter({ hasText: NUMERO_NOVO })).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: 'Montes Claros' })).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: 'R$' })).toContainText('1.500,50');
    // O papel do cliente fica ao lado dele, na seção Clientes (#426), e não mais nos dados do processo.
    await expect(cartao.getByRole('definition').filter({ hasText: 'Réu' })).toHaveCount(0);
    await abrirSecao(cartao, 'Clientes');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente · Réu');
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
    await page.getByLabel('Papel do cliente').selectOption('autor');
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
    await expect(page.getByRole('dialog').getByLabel('Situação do processo').getByRole('option', { selected: true })).toHaveText('PROTOCOLO: PROTOCOLADO');
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
    await page.getByLabel('Papel do cliente').selectOption('autor');
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
    await expect(cartao.getByLabel('Situação do processo').getByRole('option', { selected: true })).toHaveText('PROTOCOLO: PROTOCOLADO');
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

  test('quando a pessoa escolhe CPE (STJ), da lista pronta, e salva, então o cartão mostra esse sistema (#288)', async ({ page }) => {
    // Dado
    await cadastroAteDetalhes(page, NUMERO_NOVO);
    // Quando
    await page.getByLabel('Sistema de tramitação').selectOption({ label: 'CPE (STJ)' });
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
    await abrirSecao(page.getByRole('dialog'), 'Dados do processo');
    await expect(page.getByRole('dialog').getByText('CPE (STJ)', { exact: true })).toBeVisible();
  });

  test('quando a pessoa escolhe o papel Vítima para o cliente e salva, então o cartão mostra "Vítima", com acento (#289, #426)', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    // Então: a lista é a mesma das pessoas com papel, e o antigo "Polo do cliente" não aparece mais; por último, a opção de escrever um papel (#443)
    await expect(page.getByLabel('Papel do cliente').getByRole('option')).toHaveText(['Papel do cliente…', 'Autor', 'Réu', 'Terceiro interessado', 'Testemunha', 'Perito',
      'Assistente técnico', 'Vítima', 'Investigado', 'Apenado', 'Advogado da parte contrária', 'Titular', 'Inventor', 'Autor da criação', 'Outro papel', '+ Escrever o nome do papel…']);
    await expect(page.getByLabel('Polo do cliente')).toHaveCount(0);
    // Quando
    await page.getByLabel('Papel do cliente').selectOption({ label: 'Vítima' });
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
    await abrirSecao(cartao, 'Clientes');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente · Vítima');
  });

  test('dado o cadastro de um processo, quando tenta seguir sem o papel do cliente, então não segue e diz que o papel é obrigatório (#426)', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: antes de escolher a pessoa, o papel ainda não se escolhe
    await expect(page.getByLabel('Papel do cliente')).toBeDisabled();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('O papel do cliente é obrigatório: escolha o papel de cada cliente.')).toBeVisible();
    await expect(page.getByText('Passo 2 de 3')).toBeVisible();
    await expect(page.getByLabel('Papel do cliente')).toHaveAttribute('aria-invalid', 'true');
  });

  test('dado um processo com dois clientes, quando cada um tem o seu papel, então cada cliente guarda o seu e a miniatura mostra os dois (#426)', async ({ page }) => {
    // Dado
    await page.goto('/processos/novo/');
    await page.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Adicionar cliente' }).click();
    await page.getByRole('textbox', { name: 'Cliente 2', exact: true }).fill('paulo');
    await page.getByRole('button', { name: /PAULO HENRIQUE SIMULADO/ }).click();
    // Quando
    await page.getByLabel('Papel do cliente 1').selectOption({ label: 'Autor' });
    await page.getByLabel('Papel do cliente 2').selectOption({ label: 'Réu' });
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Clientes');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente · Autor');
    await expect(cartao.getByRole('link', { name: /PAULO HENRIQUE SIMULADO/ })).toContainText('Cliente · Réu');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    const miniatura = page.getByRole('listitem').filter({ hasText: NUMERO_NOVO });
    await expect(miniatura.getByText('Autor, Réu', { exact: true })).toBeVisible();
  });

  test('quando o administrador acrescenta "seeu", então nada novo é gravado e a opção pronta SEEU fica escolhida (#288)', async ({ page }) => {
    // Dado
    await cadastroAteDetalhes(page, NUMERO_NOVO);
    // Quando
    await page.getByRole('button', { name: 'Acrescentar opção' }).first().click();
    await page.getByRole('textbox', { name: 'Acrescentar opção em "Sistema de tramitação"' }).fill('seeu');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByLabel('Sistema de tramitação')).toHaveValue('SEEU');
    await expect(page.getByLabel('Sistema de tramitação').getByRole('option', { name: /^seeu$/i })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Retirar da lista' })).toHaveCount(0);
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

  test('quando a pessoa abre o cartão, então Tarefas e Compromissos vêm antes de Clientes (#429)', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirProcesso(page);
    // Então
    await expect(cartao.getByRole('heading', { name: /^Clientes/, level: 3 })).toBeVisible();
    const secoes = (await cartao.getByRole('heading', { level: 3 }).allTextContents()).map(t => t.trim());
    const posicao = (titulo: string) => secoes.findIndex(t => t.startsWith(titulo));
    expect(posicao('Tarefas')).toBeGreaterThan(-1);
    expect(posicao('Compromissos')).toBeGreaterThan(posicao('Tarefas'));
    expect(posicao('Clientes')).toBeGreaterThan(posicao('Compromissos'));
  });

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
    await cartao.getByLabel('Situação do processo').selectOption({ label: 'CONHECIMENTO: CONTESTAÇÃO/DEFESA' });
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toContainText('CONHECIMENTO: CONTESTAÇÃO/DEFESA');
  });

  test('quando arquiva o processo, então pode excluí-lo definitivamente, e ele some', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await acaoNoMenuDoCartao(page, cartao, 'Excluir');
    await page.getByRole('dialog', { name: 'Excluir o processo?' }).getByRole('button', { name: 'Excluir definitivamente' }).click();
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
    await expect(page.getByText('Passo 3 de 3')).toBeVisible();
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
    await page.getByLabel('Papel do cliente').selectOption('autor');
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
    await expect(link).toContainText('DISTRIBUÍDO');
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
    await cartao.getByRole('button', { name: 'Novo andamento', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    const resultado = form.getByRole('status', { name: 'Resultado do prazo' });
    await form.getByLabel('Intimação').fill('2026-03-02');
    await form.getByLabel('Dias', { exact: true }).fill('30');
    await expect(resultado).toContainText('01/04/2026');
    await form.getByText('Digitar a data').click();
    await expect(form.getByLabel('Último dia')).toHaveValue('01/04/2026');   // o campo de data mostra dd/mm/aaaa (#357)
    // Quando
    await form.getByText('Calcular pelo calendário').click();
    await form.getByLabel('Dias', { exact: true }).fill('5');
    await expect(resultado).toContainText('09/03/2026');
    await form.getByText('Digitar a data').click();
    // Então
    await expect(form.getByLabel('Último dia')).toHaveValue('09/03/2026');
    // Quando: digita à mão e passeia pelos modos
    await form.getByLabel('Último dia').fill('2026-05-20');
    await form.getByText('Calcular pelo calendário').click();
    await form.getByText('Digitar a data').click();
    // Então: a data digitada fica
    await expect(form.getByLabel('Último dia')).toHaveValue('20/05/2026');
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

  test('dado um prazo, quando a pessoa o vê, então as ações são só ícones, com a explicação ao passar o mouse e no foco; a tarefa criada aparece no botão de sempre (#423)', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    // (o "+" do título da seção, #427)
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill('Tréplica');
    await form.getByText('Digitar a data').click();
    await form.getByLabel('Último dia').fill('2030-04-15');
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    const prazo = cartao.getByRole('list', { name: 'Prazos do processo' }).getByRole('listitem').filter({ hasText: 'Tréplica' });
    const acoes = [prazo.getByRole('button', { name: 'Criar tarefa' }), prazo.getByRole('button', { name: 'Ligar tarefa existente' }),
      prazo.getByRole('button', { name: 'Mudar o prazo Tréplica' }), prazo.getByRole('button', { name: 'Excluir', exact: true })];
    const dicaVisivel = (b: Locator) => b.evaluate(e => getComputedStyle(e, '::after').opacity);
    // Então: cada ação é só o ícone, sem texto à vista
    for (const acao of acoes) {
      await expect(acao).toHaveText('');
      await expect(acao.locator('svg')).toBeVisible();
    }
    // Quando: passa o mouse no ícone de criar tarefa
    await acoes[0].hover();
    // Então: a explicação aparece
    await expect(acoes[0]).toHaveAttribute('data-dica', 'Criar a tarefa de cumprir este prazo');
    await expect.poll(() => dicaVisivel(acoes[0])).toBe('1');
    // Quando: chega ao ícone de mudar pelo teclado
    await acoes[2].focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    // Então
    await expect(acoes[2]).toBeFocused();
    await expect.poll(() => dicaVisivel(acoes[2])).toBe('1');
    // Quando: clica no ícone de criar tarefa
    await acoes[0].click();
    // Então: o botão da tarefa ligada continua com o código escrito e leva à tarefa
    const tarefa = prazo.getByRole('link', { name: /^Tarefa [0-9A-Z]+$/ });
    await expect(tarefa).toBeVisible();
    await expect(prazo.getByRole('button', { name: 'Criar tarefa' })).toHaveCount(0);
    await tarefa.click();
    await expect(page.getByRole('dialog')).toContainText('Prazo: Tréplica');
  });

  test('quando muda o último dia de um prazo com tarefa, então a tarefa acompanha', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page);
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo andamento', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo andamento', exact: true }).click();
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
    await cartao.getByRole('button', { name: 'Novo andamento', exact: true }).click();
    const novo = cartao.getByRole('form', { name: 'Novo andamento' });
    await novo.getByLabel('Tipo').selectOption({ label: 'Intimação' });
    await novo.getByLabel('Data da intimação').fill('2026-11-13');
    await novo.getByLabel('O que aconteceu').fill('Intimado');
    await novo.getByRole('button', { name: 'Lançar andamento' }).click();
    const lista = cartao.getByRole('list', { name: 'Andamentos do processo' });
    // Quando
    await lista.getByRole('button', { name: 'Lançar prazo' }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await expect(form.getByLabel('Intimação')).toHaveValue('13/11/2026');   // o campo de data mostra dd/mm/aaaa (#357)
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
    await lancarAndamento(cartao, 'Petição', 'Juntada');
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(page.getByText('Processo arquivado.', { exact: false }).first()).toBeVisible();
    // Então: "Mudar" e "Excluir" ficam no menu "⋯" de cada andamento (#362), que não aparece
    await expect(cartao.getByRole('list', { name: 'Andamentos do processo' })).toContainText('Juntada');
    await expect(cartao.getByRole('button', { name: 'Novo andamento' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /^Ações do andamento/ })).toHaveCount(0);
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
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill(descricao);
    await form.getByText('Digitar a data').click();
    await form.getByLabel('Último dia').fill(final);
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    await expect(form).toHaveCount(0);
  }
  async function lancarAndamento(cartao: Locator, tipo: string, texto: string, data?: string) {
    await abrirSecao(cartao, 'Andamentos');
    await cartao.getByRole('button', { name: 'Novo andamento', exact: true }).click();
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
    await expect(page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Judicial', exact: true })).toBeVisible();
    await expect(page.getByText('Nenhuma intimação a tratar.')).toBeVisible();
  });

  test('quando há prazos e audiências, então cada um aparece no seu grupo, e o clique abre o cartão do processo', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await abrirSecao(cartao, 'Prazos');
    await lancarPrazoDigitado(cartao, 'Prazo velho', dias(-3));
    await lancarPrazoDigitado(cartao, 'Prazo de hoje', dias(0));
    await lancarPrazoDigitado(cartao, 'Prazo perto', dias(12));
    await lancarPrazoDigitado(cartao, 'Prazo longe', dias(30));
    await lancarAndamento(cartao, 'Audiência', 'Conciliação marcada', dias(10));
    // Quando
    await page.goto('/processos/');
    // Então
    await expect(page.getByRole('region', { name: 'Vencidos' })).toContainText('Prazo velho');
    await expect(page.getByRole('region', { name: 'Vencem hoje' })).toContainText('Prazo de hoje');
    await expect(page.getByRole('region', { name: 'Próximos 15 dias' })).toContainText('Prazo perto');
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

  test('quando lança um despacho, então os últimos andamentos do painel mostram "Despacho", o tipo da lista pronta (#371)', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await lancarAndamento(cartao, 'Despacho', 'Despacho do painel');
    // Quando
    await page.goto('/processos/');
    // Então
    // (o despacho não é audiência, perícia nem intimação: só aparece nos últimos andamentos)
    const linha = page.getByRole('link', { name: /Despacho do painel/ });
    await expect(linha).toContainText('Despacho ·');
    await expect(linha).not.toContainText('Andamento ·');
  });

  test('quando o administrador muda os dias de parado, então a lista acompanha', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await lancarAndamento(cartao, 'Despacho', 'Andamento antigo', dias(-10));
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
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    await page.getByRole('button', { name: 'Filtros' }).click();
    const situacao = page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Situação');
    await expect(situacao.locator('option:checked')).toHaveText('DISTRIBUÍDO');
    // Quando: troca por uma coluna sem processo
    await situacao.selectOption({ label: 'SENTENÇA PROFERIDA' });
    await page.getByRole('button', { name: 'Filtros' }).click();
    // Então: a lista acompanha, e o endereço também
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toHaveCount(0);
    // Quando: o quadro, com o filtro
    await page.getByRole('button', { name: 'Kanban', exact: true }).click();
    // Então
    await expect(page.getByRole('list', { name: 'Distribuído', exact: true })).not.toContainText('JOSÉ DA SILVA TESTE');
    // Quando: o link do menu, sem filtro
    await abrir(page, 'Judicial');
    // Então
    await expect(page.getByRole('list', { name: 'Distribuído', exact: true })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando abre e fecha um cartão com o filtro da fase, então o filtro continua no endereço', async ({ page }) => {
    // Dado
    await page.goto('/processos/');
    await page.getByRole('region', { name: 'Processos judiciais' }).getByRole('link', { name: /1 Distribuído/ }).click();
    // Quando
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    await expect(page).toHaveURL(/etapa=.*id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
    await page.keyboard.press('Escape');
    // Então: o painel mostra o trabalho de quem está logado (#401), então o filtro da fase vem junto com o dele
    await expect(page).toHaveURL(/\?etapa=[^&]+&pessoa=u-master$/);
  });

  test('dado o administrador, quando escolhe uma pessoa da equipe ou a equipe toda, então o painel acompanha, e a escolha fica guardada (#401)', async ({ page }) => {
    // Dado
    await page.goto('/processos/');
    const filtro = page.getByRole('combobox', { name: 'Mostrar' });
    await expect(filtro).toHaveValue('eu');
    await expect(page.getByText('O seu trabalho:', { exact: false })).toBeVisible();
    // (sem a escolha antiga entre Todos e Meus)
    await expect(page.getByRole('radio', { name: 'Meus' })).toHaveCount(0);
    // Quando: uma pessoa sem processo
    await filtro.selectOption({ label: 'Ana Teste Lima' });
    // Então
    await expect(page.getByText('O trabalho de Ana Teste Lima.')).toBeVisible();
    await expect(page.getByText('Nenhum processo por aqui.')).toBeVisible();
    // Quando
    await page.reload();
    // Então
    await expect(page.getByRole('combobox', { name: 'Mostrar' })).toHaveValue('u-ana');
    // Quando
    await page.getByRole('combobox', { name: 'Mostrar' }).selectOption({ label: 'Equipe toda' });
    // Então
    await expect(page.getByText('O trabalho da equipe toda.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Processos ativos' })).toContainText('1 judicial');
  });

  test('dado quem não é administrador, quando abre o painel, então vê só o próprio trabalho, sem o filtro (#401)', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/processos/');
    // Então: o Bruno não está em nenhum processo
    await expect(page.getByRole('heading', { name: 'Processos', level: 1 })).toBeVisible();
    await expect(page.getByText('Você ainda não está em nenhum processo.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Mostrar' })).toHaveCount(0);
  });

  test('dado um prazo vencido, quando o painel abre, então o número leva à lista, e o gráfico das semanas tem o número exato em texto e na dica (#401)', async ({ page }) => {
    // Dado
    const cartao = await abrirCartaoJudicial(page);
    await abrirSecao(cartao, 'Prazos');
    await lancarPrazoDigitado(cartao, 'Prazo atrasado', dias(-2));
    await lancarPrazoDigitado(cartao, 'Prazo da semana', dias(2));
    // Quando
    await page.goto('/processos/');
    // Então
    const numeros = page.getByRole('group', { name: 'Números do painel' });
    const vencidos = numeros.getByRole('link', { name: /Prazos vencidos/ });
    await expect(vencidos).toContainText('1');
    await expect(numeros.getByRole('link', { name: /Prazos desta semana/ })).toContainText('1');
    await expect(numeros.getByRole('region', { name: 'Processos ativos' }).getByRole('link', { name: '1 judicial' })).toHaveAttribute('href', /\/processos\/judicial\/\?pessoa=/);
    // Quando: o número leva à lista
    await vencidos.click();
    // Então
    await expect(page).toHaveURL(/#painel-prazos$/);
    await expect(page.getByRole('region', { name: 'Prazos', exact: true })).toBeInViewport();
    // Quando: os números do gráfico, em texto
    const semanas = page.getByRole('figure', { name: /Prazos em aberto/ });
    await semanas.getByText('Ver os números').click();
    // Então
    await expect(semanas.getByRole('row', { name: /Vencidos/ })).toContainText('1');
    // Quando: pelo teclado, a dica de cada barra
    await semanas.getByRole('group', { name: /Use as setas/ }).focus();
    await page.keyboard.press('ArrowRight');
    // Então
    await expect(semanas.getByRole('status')).toContainText('Vencidos');
    await expect(semanas.getByRole('status')).toContainText('1Prazos');
  });

  test('dado o celular, quando o painel abre, então os números, os gráficos e as listas cabem na tela, sem rolar para o lado (#401)', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    // Quando
    await page.goto('/processos/');
    // Então
    await expect(page.getByRole('group', { name: 'Números do painel' }).getByRole('link', { name: /Prazos vencidos/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Processos por fase' })).toBeAttached();
    const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(larguras[0]).toBeLessThanOrEqual(larguras[1]);
  });
});

test.describe('Processo a partir da demanda', () => {
  /** Abre o cartão da demanda "Registro de marca" da semente (de JOSÉ DA SILVA TESTE). */
  async function abrirDemanda(page: Page, titulo = 'Registro de marca') {
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: titulo }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByLabel('Situação da demanda')).toBeVisible();
    return cartao;
  }
  /** Do cadastro já aberto, passa pelas etapas até salvar. Desde a #376, a tela volta ao cartão da demanda. */
  async function salvarCadastro(page: Page, numero: string) {
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Número do processo').fill(numero);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await escolherPapeisDosClientes(cadastro);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar processo' }).click();
    // O cartão da demanda fica aberto atrás do cadastro: ver a "Situação da demanda" não prova que a gravação acabou (#420). Com a
    // máquina carregada, o teste seguia (e recarregava a página) antes de o processo e a ligação chegarem ao banco. Por isso espera
    // o cadastro fechar e o endereço voltar à demanda, o que só acontece depois de gravar e ligar.
    await expect(cadastro).toHaveCount(0);
    await expect(page).toHaveURL(/\/demandas\/\?id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação da demanda')).toBeVisible();
  }
  /** No cartão da demanda, de volta do cadastro, abre o processo novo pela seção Processos. */
  async function abrirProcessoNovo(page: Page) {
    const demanda = page.getByRole('dialog');
    await abrirSecao(demanda, 'Processos');
    await demanda.getByRole('link', { name: new RegExp(NUMERO_NOVO.replace(/[.-]/g, '.')) }).click();
    const processo = page.getByRole('dialog');
    await expect(processo.getByLabel('Situação do processo')).toBeVisible();
    return processo;
  }

  test('quando clica em "+ Novo processo" na demanda, então o cadastro já vem com os clientes dela, volta à demanda e os dois cartões mostram a ligação', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page);
    await abrirSecao(cartao, 'Processos');
    await expect(cartao.getByText('Nenhum processo ligado a esta demanda.')).toBeVisible();
    // Quando
    await cartao.getByRole('link', { name: 'Novo processo desta demanda' }).click();
    // Então
    await expect(page.getByText('Este processo nasce da demanda', { exact: false })).toBeVisible();
    // Quando
    await salvarCadastro(page, NUMERO_NOVO);
    // Então: de volta à demanda, o processo mostra os clientes e a demanda
    const processo = await abrirProcessoNovo(page);
    await abrirSecao(processo, 'Clientes');
    await expect(processo.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    await abrirSecao(processo, 'Demandas');
    await processo.getByRole('link', { name: /Registro de marca/ }).click();
    // Então: a demanda mostra o processo
    const demanda = page.getByRole('dialog');
    await abrirSecao(demanda, 'Processos');
    await expect(demanda.getByRole('link', { name: new RegExp(NUMERO_NOVO.replace(/[.-]/g, '.')) })).toBeVisible();
  });

  test('quando a demanda é concluída, então pergunta se quer criar o processo; ao aceitar, abre o cadastro e, ao salvar, vai ao cartão do processo', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page);
    // Quando
    await cartao.getByLabel('Situação da demanda').selectOption({ label: 'CONCLUÍDO' });
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Criar o processo?' });
    await expect(pergunta).toContainText('Registro de marca');
    // Quando
    await pergunta.getByRole('button', { name: 'Criar processo' }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/novo\/\?demanda=/);
    await expect(page.getByText('Este processo nasce da demanda', { exact: false })).toBeVisible();
    // Quando
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await escolherPapeisDosClientes(cadastro);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar processo' }).click();
    // Então: aqui não há cartão de onde voltar (#376); o passo seguinte é o processo novo, já ligado à demanda
    await expect(page).toHaveURL(/\/processos\/judicial\/\?id=/);
    const processo = page.getByRole('dialog');
    await expect(processo.getByLabel('Situação do processo')).toBeVisible();
    await abrirSecao(processo, 'Demandas');
    await expect(processo.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
  });

  test('quando desfaz a conclusão com a pergunta aberta, então aceitar não abre o cadastro', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page);
    await cartao.getByLabel('Situação da demanda').selectOption({ label: 'CONCLUÍDO' });
    const pergunta = page.getByRole('dialog', { name: 'Criar o processo?' });
    await expect(pergunta).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    await expect(cartao.getByLabel('Situação da demanda').getByRole('option', { selected: true })).not.toHaveText('CONCLUÍDO');
    await pergunta.getByRole('button', { name: 'Criar processo' }).click();
    // Então
    await expect(page.getByText('A demanda não está mais concluída.', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/demandas\//);
  });

  test('quando a demanda não tem cliente, então o cadastro mostra o campo para escolher', async ({ page }) => {
    // Dado: uma demanda nova, sem cliente
    await page.goto('/demandas/nova/');
    await page.getByLabel('Título').fill('Demanda sem cliente');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar demanda' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByLabel('Situação da demanda')).toBeVisible();
    await abrirSecao(cartao, 'Processos');
    // Quando
    await cartao.getByRole('link', { name: 'Novo processo desta demanda' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(cadastro.getByRole('textbox', { name: 'Cliente', exact: true })).toBeVisible();
  });

  test('quando a demanda é concluída pela última tarefa, então também pergunta, com o cartão já atualizado', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page);
    await abrirSecao(cartao, 'Tarefas');
    const tarefas = cartao.getByRole('region', { name: 'Tarefas da demanda' });
    await tarefas.getByRole('checkbox', { name: 'Concluir Pedir documentos ao cliente' }).check();
    await expect(tarefas).toContainText('2 de 3 concluídas');
    // Quando
    await tarefas.getByRole('checkbox', { name: 'Concluir Emitir a GRU' }).check();
    await page.getByRole('dialog', { name: 'Concluir a demanda?' }).getByRole('button', { name: 'Concluir a demanda' }).click();
    // Então
    await expect(page.getByRole('dialog', { name: 'Criar o processo?' })).toBeVisible();
    await expect(cartao.getByLabel('Situação da demanda').getByRole('option', { selected: true })).toHaveText('CONCLUÍDO');
  });

  test('quando recusa a pergunta, então nada é criado; e não pergunta para quem já tem processo', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page);
    await cartao.getByLabel('Situação da demanda').selectOption({ label: 'CONCLUÍDO' });
    const pergunta = page.getByRole('dialog', { name: 'Criar o processo?' });
    // Quando
    await pergunta.getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(pergunta).toHaveCount(0);
    await expect(page).toHaveURL(/\/demandas\//);
    // Dado: a mesma demanda, agora com processo
    await abrirSecao(cartao, 'Processos');
    await cartao.getByRole('link', { name: 'Novo processo desta demanda' }).click();
    await salvarCadastro(page, NUMERO_NOVO);
    cartao = await abrirDemanda(page);
    await cartao.getByLabel('Situação da demanda').selectOption({ index: 1 });
    await cartao.getByLabel('Situação da demanda').selectOption({ label: 'CONCLUÍDO' });
    await expect(page.getByText('Movida para "Concluído"').last()).toBeVisible();
    // Então
    await expect(page.getByRole('dialog', { name: 'Criar o processo?' })).toHaveCount(0);
  });

  test('quando cria a tarefa de uma intimação num processo com uma demanda, então a tarefa fica ligada às duas', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page);
    await abrirSecao(cartao, 'Processos');
    await cartao.getByRole('link', { name: 'Novo processo desta demanda' }).click();
    await salvarCadastro(page, NUMERO_NOVO);
    const processo = await abrirProcessoNovo(page);
    await abrirSecao(processo, 'Andamentos');
    await processo.getByRole('button', { name: 'Novo andamento', exact: true }).click();
    const form = processo.getByRole('form', { name: 'Novo andamento' });
    await form.getByLabel('Tipo').selectOption({ label: 'Intimação' });
    await form.getByLabel('O que aconteceu').fill('Intimado da demanda');
    await form.getByRole('button', { name: 'Lançar andamento' }).click();
    const lista = processo.getByRole('list', { name: 'Andamentos do processo' });
    // Quando
    await lista.getByRole('button', { name: 'Criar tarefa' }).click();
    await lista.getByRole('link', { name: /^Tarefa / }).click();
    // Então
    const tarefa = page.getByRole('dialog');
    await abrirSecao(tarefa, 'Demanda');
    await expect(tarefa.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await abrirSecao(tarefa, 'Processo');
    await expect(tarefa.getByRole('link', { name: new RegExp(NUMERO_NOVO.replace(/[.-]/g, '.')) })).toBeVisible();
  });
});


test.describe('Nome do cartão no próprio lugar (#346)', () => {
  /** Abre o processo judicial da semente (sem nome: o título mostra o cliente) pela tabela. */
  async function abrirJudicial(page: Page) {
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: '0001234-97.2026.8.13.0024' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
    return cartao;
  }

  test('dado um processo sem nome, quando a pessoa clica no título, dá um nome e aperta Enter, então o nome fica no cartão ao fechar e abrir; apagá-lo volta ao cliente', async ({ page }) => {
    // Dado
    let cartao = await abrirJudicial(page);
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'JOSÉ DA SILVA TESTE', exact: true }).click();
    const campo = cartao.getByRole('textbox', { name: 'Nome do cartão' });
    // Então: o campo abre em branco, com o cliente como dica
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue('');
    await expect(campo).toHaveAttribute('placeholder', 'JOSÉ DA SILVA TESTE');
    // Quando
    await campo.fill('Cobrança do aluguel');
    await campo.press('Enter');
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Processo atualizado.' })).toBeVisible();
    await expect(cartao.getByRole('heading', { name: 'Cobrança do aluguel', level: 2 })).toBeVisible();
    // E continua assim ao fechar e abrir o cartão
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirJudicial(page);
    await expect(cartao.getByRole('heading', { name: 'Cobrança do aluguel', level: 2 })).toBeVisible();
    // Quando: apaga o nome
    await cartao.getByRole('button', { name: 'Cobrança do aluguel', exact: true }).click();
    await cartao.getByRole('textbox', { name: 'Nome do cartão' }).fill('');
    await cartao.getByRole('textbox', { name: 'Nome do cartão' }).press('Enter');
    // Então
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
  });

  test('dado o nome em edição, quando a pessoa aperta Esc, então desfaz, sem fechar o cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirJudicial(page);
    await cartao.getByRole('button', { name: 'JOSÉ DA SILVA TESTE', exact: true }).click();
    await cartao.getByRole('textbox', { name: 'Nome do cartão' }).fill('Nome que não fica');
    // Quando
    await cartao.getByRole('textbox', { name: 'Nome do cartão' }).press('Escape');
    // Então
    await expect(cartao.getByRole('textbox', { name: 'Nome do cartão' })).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect(page.getByText('Processo atualizado.')).toHaveCount(0);
  });

  test('dado o lápis do processo, quando a pessoa o usa, então o formulário não repete o nome do cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirJudicial(page);
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    // Então
    await expect(cartao.getByLabel('Comarca')).toBeVisible();
    await expect(cartao.getByRole('textbox', { name: 'Nome do cartão' })).toHaveCount(0);
  });

  test('dado um processo que a pessoa só lê, quando clica no título, então nada vira campo', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno (estagiário) lê o processo, em que não está
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirJudicial(page);
    // Quando
    await cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 }).click();
    // Então
    await expect(cartao.getByRole('textbox', { name: 'Nome do cartão' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'JOSÉ DA SILVA TESTE', exact: true })).toHaveCount(0);
  });
});

test.describe('O número só em "Dados do processo" (#430)', () => {
  const NUMERO = '0001234-97.2026.8.13.0024';
  /** Abre o processo judicial da semente pela tabela, achando a linha pelo número. */
  async function abrirJudicial(page: Page, titulo: string) {
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: NUMERO }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
    return cartao;
  }
  const numeroVisivel = (cartao: Locator) => cartao.getByText(NUMERO, { exact: true }).filter({ visible: true });

  test('dado o cartão de um processo, quando a pessoa o abre, então o número não aparece no topo e continua em "Dados do processo"', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirJudicial(page, 'JOSÉ DA SILVA TESTE');
    // Então: com as seções recolhidas, o número não aparece no cartão
    await expect(numeroVisivel(cartao)).toHaveCount(0);
    // E, ao abrir "Dados do processo", ele está lá, uma vez só
    await abrirSecao(cartao, 'Dados do processo');
    await expect(cartao.getByRole('definition').filter({ hasText: NUMERO })).toBeVisible();
    await expect(numeroVisivel(cartao)).toHaveCount(1);
  });

  test('dado um processo sem nome e sem clientes, quando a pessoa o abre, então o número é o nome do cartão e não se repete no topo', async ({ page }) => {
    // Dado: o processo judicial da semente sem os clientes (como alguns que vieram do histórico)
    await page.goto('/processos/judicial/');
    await page.evaluate(numero => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { processos: { numero: string; clientes: string[] }[] };
      bd.processos.filter(p => p.numero === numero).forEach(p => { p.clientes = []; });
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    }, NUMERO);
    // O banco fictício lê a aba ao abrir a página: recarrega para valer a mudança.
    await page.reload();
    // Quando
    const cartao = await abrirJudicial(page, NUMERO);
    // Então: o número aparece só no título
    await expect(numeroVisivel(cartao)).toHaveCount(1);
  });
});
