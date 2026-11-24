// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Criar, no cartão, o item novo já ligado (#376), nos pares que faltavam nos dois lados: contrato → processo, tarefa → processo e
// processo → tarefa. O "+ Novo …" abre o cadastro com a origem preenchida e, ao salvar, a tela volta ao cartão de origem, com o item
// novo na seção e o contador atualizado. A semente do banco fictício: MARIA APARECIDA EXEMPLO é cliente do contrato "Ação de cobrança"
// (sem processo); "Renovar a procuração" é uma tarefa avulsa (sem processo nem pessoas); JOSÉ DA SILVA TESTE é cliente do processo
// judicial 0001234-97.2026.8.13.0024. Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
type Colecao = 'processos' | 'contratos' | 'tarefas';
/** Onde cada cartão abre. */
const ENDERECO: Record<Colecao, string> = { processos: '/processos/judicial/?id=', contratos: '/contratos/?id=', tarefas: '/tarefas/?id=' };
const NUMERO_NOVO = '0005678-13.2026.8.13.0433';
/** O número no meio do nome do link do processo (os pontos e o traço valem qualquer caractere). */
const NUMERO_NO_LINK = new RegExp(NUMERO_NOVO.replace(/[.-]/g, '.'));

/** O id de um item da semente, lido do banco fictício da aba pelo valor de um campo. */
async function idDe(page: Page, colecao: Colecao, campo: string, valor: string) {
  await page.goto('/inicio/');
  return page.evaluate(([chave, c, k, v]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, Record<string, unknown>[]>;
    return bd[c].find(x => String(x[k]).startsWith(v))!.id as string;
  }, [CHAVE, colecao, campo, valor]);
}
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
/** O número ao lado do título da seção (0 quando não há). */
async function contador(cartao: Locator, titulo: string) {
  return Number((await cartao.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }).innerText()).replace(/\D/g, '') || 0);
}

test.describe('Criar, no cartão, o item novo já ligado (#376)', () => {
  test('dado o cartão de um contrato, quando cria um processo pelo "+ Novo processo", então o cadastro traz o cliente e a tela volta ao contrato, com o processo na seção', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'contratos', 'servico', 'Ação de cobrança');
    let cartao = await abrirCartao(page, 'contratos', id, 'MARIA APARECIDA EXEMPLO');
    const processos = await secao(cartao, 'Processos');
    const antes = await contador(cartao, 'Processos');
    await expect(processos.getByRole('link', { name: 'Novo processo deste contrato' })).toBeVisible();
    // Quando
    await processos.getByRole('link', { name: 'Novo processo deste contrato' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    // Então: o cadastro diz de onde o processo nasce e traz o cliente do contrato
    await expect(cadastro.getByText(/Este processo nasce do contrato/)).toBeVisible();
    // Quando
    await cadastro.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(cadastro.getByRole('group', { name: 'Clientes' })).toContainText('MARIA APARECIDA EXEMPLO');
    // Quando
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar processo' }).click();
    // Então: volta ao contrato, com o processo na seção e o contador maior
    await expect(page.getByText(/Processo \w+ cadastrado\./)).toBeVisible();
    await expect(cadastro).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/contratos/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'MARIA APARECIDA EXEMPLO', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Processos( \d+)?$/ })).toHaveText(new RegExp(`${antes + 1}$`));
    await expect(processos.getByRole('list', { name: 'Processos ligados' }).getByRole('link', { name: NUMERO_NO_LINK })).toBeVisible();
  });

  test('dado o cartão de uma tarefa sem processo, quando cria um processo pelo "+ Novo processo", então a tela volta à tarefa, com o processo gravado nela, e o "+ Novo processo" some', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    let cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    const processo = await secao(cartao, 'Processo');
    await expect(processo.getByText('Esta tarefa não está ligada a um processo.')).toBeVisible();
    // Quando
    await processo.getByRole('link', { name: 'Novo processo desta tarefa' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(cadastro.getByText(/Este processo nasce da tarefa/)).toBeVisible();
    await cadastro.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // A tarefa não tem pessoas: o cliente é escolhido no cadastro
    await cadastro.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await cadastro.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await cadastro.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    await expect(cadastro).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/tarefas/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('button', { name: /^Processo( \d+)?$/ })).toHaveText(/1$/);
    await expect(processo.getByRole('link', { name: NUMERO_NO_LINK })).toBeVisible();
    // E, com o seu único processo, a tarefa não oferece outro: nem o "+" do título, nem o botão de baixo
    await expect(cartao.getByRole('link', { name: 'Novo processo desta tarefa' })).toHaveCount(0);
    await expect(processo.getByRole('link', { name: 'Novo processo', exact: true })).toHaveCount(0);
    // Quando: a pessoa volta pelo navegador ao cadastro de antes
    await page.goBack();
    // Então: o cadastro avisa, antes de gravar, que um processo novo não fica ligado à tarefa, que já tem o seu
    await expect(page.getByRole('dialog', { name: 'Cadastro' }).getByText(/já tem um processo: este processo novo não fica ligado a ela/)).toBeVisible();
    await expect(page.getByText(/Este processo nasce da tarefa/)).toHaveCount(0);
  });

  test('dado o cartão de um processo, quando cria uma tarefa pelo "+" do título de Tarefas, então ela nasce com o processo e o cliente, e a tela volta ao processo, com a tarefa na seção', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    let cartao = await abrirCartao(page, 'processos', id, 'JOSÉ DA SILVA TESTE');
    const tarefas = await secao(cartao, 'Tarefas');
    const antes = await contador(cartao, 'Tarefas');
    // Desde a #427, o "+" fica só no título: embaixo da lista não há o botão "Nova tarefa".
    await expect(tarefas.getByRole('link', { name: 'Nova tarefa', exact: true })).toHaveCount(0);
    // Quando
    await tarefas.getByRole('link', { name: 'Nova tarefa deste processo' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Título').fill('Protocolar a réplica');
    // Então: o processo já vem escolhido
    await expect(cadastro.getByRole('button', { name: /^Tirar o processo/ })).toBeVisible();
    await expect(cadastro.getByText(/Esta tarefa nasce do processo/)).toBeVisible();
    // Quando
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então: o cliente do processo é a pessoa da tarefa
    await expect(cadastro.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('JOSÉ DA SILVA TESTE');
    // Quando
    await cadastro.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    await expect(page.getByText(/Tarefa \w+ cadastrada\./)).toBeVisible();
    await expect(cadastro).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/processos/judicial/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Tarefas( \d+)?$/ })).toHaveText(new RegExp(`${antes + 1}$`));
    await expect(tarefas.getByRole('link', { name: /Protocolar a réplica/ })).toBeVisible();
  });
});
