// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício há 6 contratos (MA96-0001 a 0006). Mateus, que está logado, tem a sigla MA96.
// Na equipe, Mateus e Ana são advogados, Bruno é estagiário e Carla (desativada) é do administrativo.
// O cadastro é por etapas, como o de pessoa: Cliente e responsável, O que foi contratado, Honorários, Divisão, Documento e observações.
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ajudantes';

const ANO = new Date().getFullYear();

/** Escolhe uma pessoa do cadastro num campo de busca (Cliente, Participante 1, Indicador). */
async function escolherPessoa(page: Page, campo: string, busca: string, nome: string) {
  await page.getByRole('textbox', { name: campo, exact: true }).fill(busca);
  await page.getByRole('button', { name: new RegExp(nome) }).click();
}

/** Segue para a próxima etapa e confere que ela abriu. */
async function proxima(page: Page, etapa: string) {
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByRole('heading', { name: etapa, level: 2 })).toBeVisible();
}

/** Preenche os campos obrigatórios das duas primeiras etapas e para em "O que foi contratado" (o responsável já vem como quem está logado). */
async function preencherObrigatorios(page: Page) {
  await page.goto('/contratos/novo/');
  await escolherPessoa(page, 'Cliente', 'luciana', 'LUCIANA ROCHA AMOSTRA');
  await proxima(page, 'O que foi contratado');
  await page.getByRole('combobox', { name: 'Objeto 1' }).fill('Registro de marca no INPI');
  await page.getByText('Pró-labore', { exact: true }).click();
}
/** De "O que foi contratado" até "Divisão". */
async function ateDivisao(page: Page) {
  await proxima(page, 'Honorários');
  await proxima(page, 'Divisão');
}
/** Da etapa em que está até salvar o contrato novo. */
async function salvarContrato(page: Page) {
  while (!(await page.getByRole('button', { name: 'Salvar contrato' }).isVisible())) await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar contrato' }).click();
}

test.describe('Cadastro de contratos', () => {
  test('quando a pessoa salva um contrato com os campos obrigatórios, então ele ganha o número e aparece na primeira coluna e na tabela', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    // Quando
    await salvarContrato(page);
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA' })).toBeVisible();
    await expect(cartao).toContainText(`MA96-0007-${ANO}`);
    await expect(page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toContainText(`MA96-0007-${ANO}`);
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Em negociação', exact: true }).getByRole('listitem').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toBeVisible();
  });

  test('quando o cadastro abre, então é por etapas, como o de pessoa', async ({ page }) => {
    // Quando
    await page.goto('/contratos/novo/');
    // Então
    await expect(page.getByText('Etapa 1 de 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cliente e responsável', level: 2 })).toBeVisible();
  });

  test('quando falta o que é obrigatório numa etapa, então ela avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/contratos/novo/');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Escolha o cliente.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cliente e responsável', level: 2 })).toBeVisible();
    // E na etapa seguinte, os objetos e a categoria
    await escolherPessoa(page, 'Cliente', 'luciana', 'LUCIANA ROCHA AMOSTRA');
    await proxima(page, 'O que foi contratado');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText('Informe ao menos um objeto do contrato.')).toBeVisible();
    await expect(page.getByText('Escolha a categoria de honorário.')).toBeVisible();
  });

  test('quando valor, entrada, parcelas e percentuais são preenchidos, então a parcela e o % do responsável aparecem calculados', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await proxima(page, 'Honorários');
    // Quando
    await page.getByLabel('Valor do contrato').fill('5000');
    await page.getByLabel('Entrada').fill('1000');
    await page.getByLabel('Parcelas').fill('5');
    await expect(page.getByRole('status', { name: 'Valor da parcela' })).toHaveText(/1\.000,00/);
    await proxima(page, 'Divisão');
    await page.getByText('20% do que o cliente pagar', { exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar participante' }).click();
    await escolherPessoa(page, 'Participante 1', 'bruno', 'BRUNO EXEMPLO SOUZA');
    await page.getByRole('textbox', { name: '% do participante 1' }).fill('10');
    // Então: 100% − 20% do escritório − 10% do participante
    await expect(page.getByRole('status', { name: 'Fica com o responsável' })).toHaveText('70%');
  });

  test('quando o escritório fica com 20%, então o responsável fica com 80%', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await ateDivisao(page);
    // Quando
    await page.getByText('20% do que o cliente pagar', { exact: true }).click();
    // Então
    await expect(page.getByRole('status', { name: 'Fica com o responsável' })).toHaveText('80%');
  });

  test('quando o contrato tem dois participantes e um indicador, então o cartão mostra todos com os percentuais', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await ateDivisao(page);
    await page.getByText('30% do que o cliente pagar', { exact: true }).click();
    // Quando
    await page.getByRole('button', { name: 'Adicionar participante' }).click();
    await escolherPessoa(page, 'Participante 1', 'bruno', 'BRUNO EXEMPLO SOUZA');
    await page.getByRole('textbox', { name: '% do participante 1' }).fill('10');
    await page.getByRole('button', { name: 'Adicionar participante' }).click();
    await escolherPessoa(page, 'Participante 2', 'ana teste', 'ANA TESTE LIMA');
    await page.getByRole('textbox', { name: '% do participante 2' }).fill('5');
    await escolherPessoa(page, 'Indicador', 'raimundo', 'RAIMUNDO NONATO ENSAIO');
    await page.getByLabel('% do indicador').fill('10');
    await expect(page.getByRole('status', { name: 'Fica com o responsável' })).toHaveText('45%');
    await salvarContrato(page);
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('BRUNO EXEMPLO SOUZA (10%), ANA TESTE LIMA (5%)')).toBeVisible();
    await expect(cartao.getByRole('definition').filter({ hasText: '45%' })).toBeVisible();
    // Os participantes são da equipe: ficam com o responsável, antes da situação; o indicador, de fora, fica nas partes.
    const blocos = (await cartao.getByRole('heading', { level: 3 }).allTextContents()).map(t => t.trim());
    expect(blocos.slice(0, 3)).toEqual(['Responsável e participantes', 'Situação', 'Partes']);
    await expect(cartao.getByRole('link', { name: /BRUNO EXEMPLO SOUZA/ })).toContainText('Participante · 10%');
    await expect(cartao.getByRole('link', { name: /RAIMUNDO NONATO ENSAIO/ })).toContainText('Indicador · 10%');
  });

  test('quando a soma dos percentuais passa de 100%, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await ateDivisao(page);
    await page.getByText('100% do que o cliente pagar', { exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar participante' }).click();
    await escolherPessoa(page, 'Participante 1', 'bruno', 'BRUNO EXEMPLO SOUZA');
    await page.getByRole('textbox', { name: '% do participante 1' }).fill('10');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('A soma dos percentuais (escritório, participantes e indicador) passa de 100%.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Divisão', level: 2 })).toBeVisible();
  });
});

test.describe('Função na equipe', () => {
  test('quando o cadastro abre, então a lista de responsável tem só os advogados da equipe', async ({ page }) => {
    // Quando
    await page.goto('/contratos/novo/');
    // Então (Bruno, estagiário, e Carla, do administrativo, não aparecem)
    await expect(page.getByLabel('Advogado responsável').getByRole('option')).toHaveText(['Escolha…', 'Mateus Freitas Gonçalves', 'Ana Teste Lima']);
  });

  test('quando a busca de participante mostra alguém de fora da equipe, então ele vem desligado, com o motivo', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await ateDivisao(page);
    await page.getByRole('button', { name: 'Adicionar participante' }).click();
    // Quando
    await page.getByRole('textbox', { name: 'Participante 1', exact: true }).fill('luciana');
    // Então
    const deFora = page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ });
    await expect(deFora).toBeDisabled();
    await expect(deFora).toContainText('não é da equipe');
  });

  test('quando o indicador é de fora da equipe, então ele pode ser escolhido', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await ateDivisao(page);
    // Quando
    await escolherPessoa(page, 'Indicador', 'raimundo', 'RAIMUNDO NONATO ENSAIO');
    // Então
    await expect(page.getByLabel('% do indicador')).toBeEnabled();
  });

  test('dado um contrato cujo responsável é estagiário, quando ele é atualizado, então o responsável continua e o contrato salva', async ({ page }) => {
    // Dado: o contrato de divórcio (BR08-0004) é do Bruno, que hoje é estagiário
    await page.goto('/contratos/');
    await page.getByRole('row').filter({ hasText: 'JOÃO PEDRO FICTÍCIO' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Atualizar contrato' }).click();
    await expect(page.getByLabel('Advogado responsável').getByRole('option', { selected: true })).toHaveText('Bruno Exemplo Souza');
    // Quando
    while (!(await page.getByRole('button', { name: 'Salvar alterações' }).isVisible())) await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    // Então
    await expect(page.getByRole('dialog').getByRole('link', { name: /Bruno Exemplo Souza/ })).toContainText('equipe do escritório');
  });
});

test.describe('Objetos do contrato', () => {
  test('quando a pessoa acrescenta objetos e tira um, então o cartão mostra os que ficaram, em destaque e na ordem', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    // Quando: Enter no último objeto abre uma linha nova
    await page.getByRole('combobox', { name: 'Objeto 1' }).press('Enter');
    await page.getByRole('combobox', { name: 'Objeto 2' }).fill('Oposição');
    await page.getByRole('button', { name: 'Adicionar objeto' }).click();
    await page.getByRole('combobox', { name: 'Objeto 3' }).fill('Busca de anterioridade');
    await page.getByRole('button', { name: 'Tirar o objeto 2' }).click();
    await salvarContrato(page);
    // Então
    const objetos = page.getByRole('dialog').getByRole('list', { name: 'Objetos do contrato' }).getByRole('listitem');
    await expect(objetos).toHaveText(['Registro de marca no INPI', 'Busca de anterioridade']);
    await expect(page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toContainText('Registro de marca no INPI; Busca de anterioridade');
  });

  test('quando um contrato é salvo, então os objetos dele aparecem como sugestão no próximo cadastro', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await page.getByRole('combobox', { name: 'Objeto 1' }).fill('Notificação extrajudicial');
    await salvarContrato(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    // Quando
    await page.goto('/contratos/novo/');
    await escolherPessoa(page, 'Cliente', 'luciana', 'LUCIANA ROCHA AMOSTRA');
    await proxima(page, 'O que foi contratado');
    await page.getByRole('combobox', { name: 'Objeto 1' }).fill('notif');
    // Então
    await expect(page.getByRole('option', { name: 'Notificação extrajudicial' })).toBeVisible();
  });

  test('quando a pessoa escolhe uma sugestão pelo teclado, então ela vai para o campo e não é sugerida de novo na linha seguinte', async ({ page }) => {
    // Dado ("Busca de anterioridade" já foi usado em contratos do escritório)
    await preencherObrigatorios(page);
    await page.getByRole('combobox', { name: 'Objeto 1' }).press('Enter');
    const segundo = page.getByRole('combobox', { name: 'Objeto 2' });
    await segundo.fill('busca');
    // Quando
    await segundo.press('ArrowDown');
    await segundo.press('Enter');
    // Então
    await expect(segundo).toHaveValue('Busca de anterioridade');
    await segundo.press('Enter');
    await page.getByRole('combobox', { name: 'Objeto 3' }).fill('busca');
    await expect(page.getByRole('option', { name: 'Busca de anterioridade' })).toHaveCount(0);
  });

  test('quando as sugestões aparecem, então a lista tem a largura do campo e mostra o texto inteiro', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    const campo = page.getByRole('combobox', { name: 'Objeto 1' });
    // Quando
    await campo.fill('indeniza');
    // Então
    const lista = page.getByRole('listbox', { name: 'Sugestões' });
    await expect(lista.getByRole('option', { name: 'Ação de indenização por danos morais' })).toBeVisible();
    const [caixa, sugestoes] = await Promise.all([campo.boundingBox(), lista.boundingBox()]);
    expect(Math.round(sugestoes!.width)).toBe(Math.round(caixa!.width));
  });
});

test.describe('Contrato salvo', () => {
  test('quando o contrato muda de responsável e de situação, então o número continua o mesmo e o histórico registra', async ({ page }) => {
    // Dado: JOSÉ DA SILVA TESTE tem o contrato MA96-0001, em "Assinado / em andamento"
    await page.goto('/inicio/');
    await abrir(page, 'Contratos');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Atualizar contrato' }).click();
    // Quando
    await page.getByLabel('Advogado responsável').selectOption({ label: 'Ana Teste Lima' });
    while (!(await page.getByRole('button', { name: 'Salvar alterações' }).isVisible())) await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByRole('dialog').getByLabel('Situação do contrato').selectOption({ label: 'Encerrado' });
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao).toContainText(`MA96-0001-${ANO}`);
    await expect(cartao.getByRole('link', { name: /Ana Teste Lima/ })).toContainText('equipe do escritório');
    await cartao.getByRole('button', { name: /Histórico de alterações/ }).click();
    await expect(cartao.getByText('Situação: Assinado / em andamento → Encerrado')).toBeVisible();
    await expect(cartao.getByText('Responsável: Mateus Freitas Gonçalves → Ana Teste Lima')).toBeVisible();
  });

  test('quando a pessoa recolhe um tópico do cartão, então ele continua recolhido no próximo contrato', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const honorarios = page.getByRole('dialog').getByRole('button', { name: 'Honorários' });
    await expect(honorarios).toHaveAttribute('aria-expanded', 'true');
    // Quando
    await honorarios.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' }).click();
    // Então
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Honorários' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('quando se busca pelo código antigo da planilha, então o contrato é encontrado', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    // Quando
    await page.getByRole('searchbox').fill('ma96-jo25');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(0);
  });

  test('quando a pessoa arrasta o contrato para outra coluna, então ele continua lá depois de recarregar', async ({ page }) => {
    // Dado: MARIA APARECIDA EXEMPLO está em "Em negociação"
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const negociacao = page.getByRole('list', { name: 'Em negociação', exact: true });
    const aguardando = page.getByRole('list', { name: 'Aguardando assinatura', exact: true });
    const maria = negociacao.getByRole('listitem').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    await expect(maria).toBeVisible();
    // Quando
    await maria.dragTo(aguardando);
    // Então
    await expect(aguardando.getByRole('listitem').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Aguardando assinatura', exact: true }).getByRole('listitem').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
  });
});

test.describe('Contratos no cartão da pessoa', () => {
  test('quando alguém abre o cartão de um cliente, então vê os contratos dele, com o papel, e abre o contrato pelo link', async ({ page }) => {
    // Dado: JOSÉ DA SILVA TESTE é cliente do contrato MA96-0001
    await page.goto('/pessoas/');
    await page.getByRole('searchbox').fill('jose da silva');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    // Quando
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('button', { name: /Contratos/ })).toContainText('1');
    const contrato = cartao.getByRole('link', { name: new RegExp(`MA96-0001-${ANO}`) });
    await expect(contrato).toContainText('Cliente · Assinado / em andamento');
    await contrato.click();
    // Então
    await expect(page).toHaveURL(/\/contratos\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
  });

  test('quando a pessoa não tem contratos, então o cartão diz isso e cria um contrato com ela como cliente', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('searchbox').fill('luciana');
    await page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('Nenhum contrato ligado a esta pessoa.')).toBeVisible();
    // Quando
    await cartao.getByRole('link', { name: 'Novo contrato com esta pessoa como cliente' }).click();
    // Então
    await expect(page.getByRole('heading', { name: 'Cliente e responsável', level: 2 })).toBeVisible();
    await expect(page.getByText('LUCIANA ROCHA AMOSTRA')).toBeVisible();
    await expect(page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ })).toHaveText('Trocar');
  });
});

test.describe('Contrato com mais de um cliente', () => {
  test('quando o contrato tem dois clientes, então o cartão mostra os dois e o contrato aparece no cartão de cada um', async ({ page }) => {
    // Dado
    await page.goto('/contratos/novo/');
    await escolherPessoa(page, 'Cliente', 'luciana', 'LUCIANA ROCHA AMOSTRA');
    // Quando
    await page.getByRole('button', { name: 'Adicionar cliente' }).click();
    await escolherPessoa(page, 'Cliente 2', 'paulo', 'PAULO HENRIQUE SIMULADO');
    await proxima(page, 'O que foi contratado');
    await page.getByRole('combobox', { name: 'Objeto 1' }).fill('Divórcio consensual');
    await page.getByText('Pró-labore', { exact: true }).click();
    await salvarContrato(page);
    // Então
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA e PAULO HENRIQUE SIMULADO' })).toBeVisible();
    await page.goto('/pessoas/');
    await page.getByRole('searchbox').fill('paulo henrique');
    await page.getByRole('row').filter({ hasText: 'PAULO HENRIQUE SIMULADO' }).click();
    await expect(page.getByRole('dialog').getByRole('link', { name: /Divórcio consensual/ })).toContainText('Cliente');
  });
});

test.describe('Ligações em quadrinhos', () => {
  test('quando alguém abre um contrato, então o responsável vem antes da situação e cada parte é um quadrinho que abre o cartão da pessoa', async ({ page }) => {
    // Dado: o contrato de divórcio (BR08-0004) tem dois clientes
    await page.goto('/contratos/');
    await page.getByRole('row').filter({ hasText: 'JOÃO PEDRO FICTÍCIO' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('link', { name: /TEREZA CRISTINA PILOTO/ })).toContainText('Cliente');
    await expect(cartao.getByRole('link', { name: /Bruno Exemplo Souza/ })).toContainText('equipe do escritório');
    // O responsável é da equipe: vem antes da situação e fora das partes (as pessoas de fora do escritório).
    const blocos = (await cartao.getByRole('heading', { level: 3 }).allTextContents()).map(t => t.trim());
    expect(blocos.slice(0, 3)).toEqual(['Responsável', 'Situação', 'Partes']);
    // Quando
    await cartao.getByRole('link', { name: /TEREZA CRISTINA PILOTO/ }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'TEREZA CRISTINA PILOTO' })).toBeVisible();
  });
});

test.describe('Coluna-marco do contrato assinado', () => {
  test('quando o administrador abre o menu da coluna do contrato assinado, então vê a explicação e não há como excluí-la', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Assinado / em andamento' }).click();
    // Então
    const menu = page.getByRole('menu');
    await expect(menu.getByText(/Coluna do contrato assinado/)).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Excluir coluna' })).toHaveCount(0);
    await expect(page.getByLabel('Coluna-marco: Contrato assinado')).toBeVisible();
  });

  test('quando o administrador abre o menu de uma coluna comum, então pode excluí-la', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Encerrado' }).click();
    // Então
    await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Excluir coluna' })).toBeVisible();
  });
});
