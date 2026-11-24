// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Cadastrar, no cartão de um item, uma pessoa nova já ligada a ele (#376): o "+ Nova pessoa" das seções Clientes (demanda e processo)
// e Pessoas (tarefa e compromisso), e o "+ Nova pessoa vinculada" dos Vínculos da pessoa. Ao terminar o cadastro, a tela volta ao
// cartão de origem, com a pessoa já na seção e o número dela maior. A semente do banco fictício: MARIA APARECIDA EXEMPLO é a única
// cliente da demanda avulsa "Notificar o devedor"; JOSÉ DA SILVA TESTE (CPF 529.982.247-25) é o cliente do processo judicial
// 0001234-97.2026.8.13.0024; "Renovar a procuração" é uma tarefa avulsa da Ana, sem pessoas, e "Reunião de equipe" é um compromisso
// da Agenda geral, sem pessoas. Quem está logado é o Mauro (administrador); o Bruno é estagiário e não está em "Renovar a procuração".
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
const CPF_DE_JOSE = '52998224725';
type Colecao = 'pessoas' | 'processos' | 'demandas' | 'tarefas' | 'compromissos';
/** O id de um item da semente, lido do banco fictício da aba pelo valor de um campo (o nome, o título, o número...). */
async function idDe(page: Page, colecao: Colecao, campo: string, valor: string) {
  await page.goto('/inicio/');
  return page.evaluate(([chave, c, k, v]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, Record<string, unknown>[]>;
    return bd[c].find(x => String(x[k]).startsWith(v))!.id as string;
  }, [CHAVE, colecao, campo, valor]);
}
/** Arquiva um item da semente direto no banco fictício da aba (vale a partir da próxima página aberta). */
async function arquivar(page: Page, colecao: Colecao, id: string) {
  await page.evaluate(([chave, c, item]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, { id: string; arquivado_em: string | null }[]>;
    bd[c].find(x => x.id === item)!.arquivado_em = new Date().toISOString();
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, colecao, id]);
}
/** Onde cada cartão abre (e para onde a tela volta ao terminar o cadastro). */
const ENDERECO: Record<Colecao, string> = {
  pessoas: '/pessoas/?id=', processos: '/processos/judicial/?id=', demandas: '/demandas/?id=', tarefas: '/tarefas/?id=', compromissos: '/agenda/?id='
};
/** Abre o cartão do item e espera o título dele. */
async function abrirCartao(page: Page, colecao: Colecao, id: string, titulo: string) {
  await page.goto(ENDERECO[colecao] + id);
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}
/** A janela do cadastro de pessoa, aberta por cima do cartão. */
const cadastro = (page: Page) => page.getByRole('dialog', { name: 'Cadastro' });
/** Cadastra uma pessoa de "somente contato", com nome e telefone, na janela do cadastro (ou onde ele estiver: aberto pelo endereço, é
 * a página). */
async function cadastrarContato(page: Page, nome: string, janela: Locator = cadastro(page)) {
  await janela.getByText('Somente informações de contato', { exact: true }).click();
  await janela.getByLabel('Nome').fill(nome);
  await janela.getByRole('button', { name: 'Próxima' }).click();
  await janela.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
  await janela.getByRole('button', { name: 'Salvar cadastro' }).click();
}

test.describe('Cadastrar, no cartão de um item, uma pessoa nova já ligada a ele (#376)', () => {
  test('dado o cartão de uma demanda, quando clica em "+ Nova pessoa" nos Clientes e cadastra, então volta ao cartão da demanda com a pessoa nos clientes', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    const clientes = await secao(cartao, 'Clientes');
    await expect(cartao.getByRole('button', { name: 'Clientes 1' })).toBeVisible();
    // Quando
    await clientes.getByRole('link', { name: 'Nova pessoa como cliente desta demanda' }).click();
    await expect(cadastro(page).getByText(/Ao terminar, a pessoa fica ligada como cliente da demanda .* \(Notificar o devedor\)/)).toBeVisible();
    await cadastrarContato(page, 'cliente novo da demanda');
    // Então
    await expect(page.getByText(/Pessoa cadastrada e ligada como cliente da demanda .* \(Notificar o devedor\)\./)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/demandas/\\?id=${id}$`));
    await expect(cadastro(page)).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Clientes 2' })).toBeVisible();
    await expect(clientes.getByRole('link', { name: /CLIENTE NOVO DA DEMANDA/ })).toBeVisible();
  });

  test('dado o cartão de uma tarefa, quando clica no "+" do título de Pessoas e cadastra, então volta ao cartão da tarefa com a pessoa ligada', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    const cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    const pessoas = await secao(cartao, 'Pessoas');
    // Desde a #427, o "+" fica só no título: embaixo da lista não há o botão "Nova pessoa".
    await expect(pessoas.getByRole('link', { name: 'Nova pessoa', exact: true })).toHaveCount(0);
    // Quando
    await cartao.getByRole('link', { name: 'Nova pessoa ligada a esta tarefa' }).click();
    await cadastrarContato(page, 'pessoa nova da tarefa');
    // Então
    await expect(page).toHaveURL(new RegExp(`/tarefas/\\?id=${id}$`));
    await expect(cartao.getByRole('button', { name: 'Pessoas 1' })).toBeVisible();
    await expect(pessoas.getByRole('link', { name: /PESSOA NOVA DA TAREFA/ })).toBeVisible();
  });

  test('dado o cartão de um processo, quando clica em "+ Nova pessoa" nos Clientes, cadastra e escolhe o papel, então volta ao cartão do processo com a pessoa nos clientes, com o papel (#426)', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    const cartao = await abrirCartao(page, 'processos', id, 'JOSÉ DA SILVA TESTE');
    const clientes = await secao(cartao, 'Clientes');
    // Quando
    await clientes.getByRole('link', { name: 'Nova pessoa como cliente deste processo' }).click();
    await cadastrarContato(page, 'cliente novo do processo');
    const pergunta = page.getByRole('dialog', { name: 'Papel do cliente no processo' });
    await pergunta.getByLabel('Papel do cliente').selectOption('terceiro');
    await pergunta.getByRole('button', { name: 'Ligar' }).click();
    // Então
    await expect(page).toHaveURL(new RegExp(`/processos/judicial/\\?id=${id}$`));
    await expect(cartao.getByRole('button', { name: 'Clientes 2' })).toBeVisible();
    await expect(clientes.getByRole('link', { name: /CLIENTE NOVO DO PROCESSO/ })).toContainText('Cliente · Terceiro interessado');
  });

  test('dado o cartão de um compromisso, quando clica em "+ Nova pessoa" nas Pessoas e cadastra, então volta ao cartão dele na Agenda com a pessoa ligada', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'compromissos', 'titulo', 'Reunião de equipe');
    const cartao = await abrirCartao(page, 'compromissos', id, 'Reunião de equipe');
    const pessoas = await secao(cartao, 'Pessoas');
    // Quando
    await pessoas.getByRole('link', { name: 'Nova pessoa ligada a este compromisso' }).click();
    await cadastrarContato(page, 'pessoa nova da reunião');
    // Então
    await expect(page).toHaveURL(new RegExp(`/agenda/\\?id=${id}$`));
    await expect(cartao.getByRole('button', { name: 'Pessoas 1' })).toBeVisible();
    await expect(pessoas.getByRole('link', { name: /PESSOA NOVA DA REUNIÃO/ })).toBeVisible();
  });

  test('dado o cartão de uma pessoa, quando clica em "+ Nova pessoa vinculada", escolhe o vínculo, descreve e cadastra, então volta ao cartão dela com o vínculo (e a descrição) gravado nos dois lados', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'pessoas', 'nome', 'MARIA APARECIDA EXEMPLO');
    const cartao = await abrirCartao(page, 'pessoas', id, 'MARIA APARECIDA EXEMPLO');
    const vinculos = await secao(cartao, 'Vínculos');
    // Quando
    await vinculos.getByRole('button', { name: 'Nova pessoa vinculada', exact: true }).click();
    const formulario = vinculos.getByRole('form', { name: 'Nova pessoa vinculada' });
    await formulario.getByLabel('Vínculo').selectOption({ label: 'Pai/mãe de' });
    await formulario.getByLabel('Descrição').fill('guarda compartilhada');
    await formulario.getByRole('button', { name: 'Cadastrar a pessoa' }).click();
    await expect(cadastro(page).getByText('Ao terminar, a pessoa fica vinculada: Filho(a) de MARIA APARECIDA EXEMPLO, e você volta ao cartão de origem.')).toBeVisible();
    await cadastrarContato(page, 'filho novo da maria');
    // Então
    await expect(page.getByText('Pessoa cadastrada e vinculada: Filho(a) de MARIA APARECIDA EXEMPLO.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/pessoas/\\?id=${id}$`));
    await expect(cartao.getByRole('button', { name: 'Vínculos 1' })).toBeVisible();
    await expect(formulario).toHaveCount(0);
    const vinculo = vinculos.getByRole('button', { name: /Pai\/mãe de.*FILHO NOVO DA MARIA.*guarda compartilhada/ });
    await expect(vinculo).toBeVisible();
    // E o cartão da pessoa nova mostra o vínculo (e a descrição) do lado dela
    await vinculo.click();
    await expect(cartao.getByRole('heading', { name: 'FILHO NOVO DA MARIA', level: 2 })).toBeVisible();
    await expect((await secao(cartao, 'Vínculos')).getByRole('button', { name: /Filho\(a\) de.*MARIA APARECIDA EXEMPLO.*guarda compartilhada/ })).toBeVisible();
  });

  test('dado o cadastro aberto pelo "+ Nova pessoa" de uma demanda, quando o CPF já é de outra pessoa, então oferece ligar a que já existe, e ela entra nos clientes', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    const clientes = await secao(cartao, 'Clientes');
    await clientes.getByRole('link', { name: 'Nova pessoa como cliente desta demanda' }).click();
    const janela = cadastro(page);
    await janela.getByText('Pessoa física', { exact: true }).click();
    await janela.getByLabel('Nome').fill('josé de novo');
    await janela.getByRole('button', { name: 'Próxima' }).click();
    // Quando
    await janela.getByLabel('CPF').fill(CPF_DE_JOSE);
    await janela.getByRole('button', { name: 'Próxima' }).click();
    const aviso = page.getByRole('dialog', { name: 'Cadastro já existente' });
    await expect(aviso).toContainText('JOSÉ DA SILVA TESTE');
    await aviso.getByRole('button', { name: 'Ligar esta pessoa' }).click();
    // Então
    await expect(page.getByText(/Pessoa já cadastrada, agora ligada como cliente da demanda .* \(Notificar o devedor\)\./)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/demandas/\\?id=${id}$`));
    await expect(cartao.getByRole('button', { name: 'Clientes 2' })).toBeVisible();
    await expect(clientes.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
  });

  test('dada a conta comum que não está na tarefa, quando abre o cartão dela, então não há "+ Nova pessoa" nem no título nem embaixo', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    await abrirSecao(cartao, 'Pessoas');
    // Então
    await expect(cartao.getByRole('link', { name: /^Nova pessoa/ })).toHaveCount(0);
  });

  test('dada uma pessoa arquivada, quando abre os Vínculos, então não há "+ Nova pessoa vinculada"', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'pessoas', 'nome', 'JOSÉ DA SILVA TESTE');
    await arquivar(page, 'pessoas', id);
    // Quando
    const cartao = await abrirCartao(page, 'pessoas', id, 'JOSÉ DA SILVA TESTE');
    const vinculos = await secao(cartao, 'Vínculos');
    // Então
    await expect(vinculos.getByRole('button', { name: 'Nova pessoa vinculada' })).toHaveCount(0);
  });

  test('dado o cadastro aberto pelo "+ Nova pessoa" de uma demanda, quando o CPF é de uma pessoa arquivada, então não oferece ligá-la como está: atualizar o cadastro a devolve às ativas e a põe nos clientes', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    await arquivar(page, 'pessoas', await idDe(page, 'pessoas', 'nome', 'JOSÉ DA SILVA TESTE'));
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    const clientes = await secao(cartao, 'Clientes');
    await clientes.getByRole('link', { name: 'Nova pessoa como cliente desta demanda' }).click();
    const janela = cadastro(page);
    await janela.getByText('Pessoa física', { exact: true }).click();
    await janela.getByLabel('Nome').fill('josé de novo');
    await janela.getByRole('button', { name: 'Próxima' }).click();
    // Quando
    await janela.getByLabel('CPF').fill(CPF_DE_JOSE);
    await janela.getByRole('button', { name: 'Próxima' }).click();
    const aviso = page.getByRole('dialog', { name: 'Cadastro já existente' });
    await expect(aviso).toContainText('que está arquivado');
    // Então
    await expect(aviso.getByRole('button', { name: 'Ligar esta pessoa' })).toHaveCount(0);
    await aviso.getByRole('button', { name: 'Atualizar e ligar' }).click();
    await expect(janela.getByText(/Você está atualizando o cadastro de JOSÉ DA SILVA TESTE/)).toBeVisible();
    for (const etapa of ['Passo 3 de 5', 'Passo 4 de 5']) {
      await expect(janela.getByText(etapa)).toBeVisible();
      await janela.getByRole('button', { name: 'Próxima' }).click();
    }
    await janela.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText(/Pessoa já cadastrada, agora ligada como cliente da demanda .* \(Notificar o devedor\)\./)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/demandas/\\?id=${id}$`));
    await expect(cartao.getByRole('button', { name: 'Clientes 2' })).toBeVisible();
    // (o nome digitado nesta tela substitui o que ela tinha, como em toda atualização)
    await expect(clientes.getByRole('link', { name: /JOSÉ DE NOVO/ })).toBeVisible();
    await expect(clientes.getByText('Arquivada')).toHaveCount(0);
  });

  test('dado o endereço do cadastro com uma demanda arquivada (digitado, ou de uma aba antiga), quando cadastra, então avisa que segue sem ligação e a demanda não ganha cliente', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    await arquivar(page, 'demandas', id);
    // Quando
    await page.goto('/pessoas/nova/?demanda=' + id);
    await expect(page.getByText('O item de onde este cadastro foi aberto está arquivado: a pessoa será cadastrada sem ligação.')).toBeVisible();
    await expect(page.getByText(/Ao terminar, a pessoa fica/)).toHaveCount(0);
    await cadastrarContato(page, 'pessoa sem demanda', page.getByRole('main'));
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Pessoa cadastrada.' })).toBeVisible();
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    await expect(cartao.getByRole('button', { name: 'Clientes 1' })).toBeVisible();
  });
});
