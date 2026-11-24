// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Checklists com grupos e subgrupos numerados (#309), na demanda, na tarefa, no contrato e nos modelos. Na semente do banco
// fictício há o modelo "Benefício previdenciário" (1. Documentos pessoais › 1.1 RG, 1.2 CPF; 2. Benefício › 2.1 Aposentadoria
// por idade › 2.1.1 CNIS, 2.1.2 Carteira de trabalho; 2.2 Auxílio-doença › 2.2.1 Laudo médico) e o modelo de antes, sem grupos,
// "Documentos de pessoa física". O contrato de JOSÉ DA SILVA TESTE é do Mauro, que está logado.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, acaoNoMenuDoCartao } from './ajudantes';

/** Abre o cartão pela tabela do módulo e a seção Checklists. */
async function abrirCartao(page: Page, rota: string, texto: string) {
  await page.goto(rota);
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: texto }).first().click();
  const cartao = page.getByRole('dialog');
  await abrirSecao(cartao, 'Checklists');
  return cartao;
}
/** Usa um modelo em "Adicionar checklist" e devolve o checklist que entrou. */
async function usarModelo(page: Page, cartao: Locator, nome: string) {
  await cartao.getByRole('button', { name: 'Adicionar checklist', exact: true }).click();
  await page.getByRole('menuitem', { name: nome }).click();
  const lista = cartao.getByRole('region', { name: `Checklist ${nome}` });
  await expect(lista).toBeVisible();
  return lista;
}
/** O botão que abre e fecha o grupo (o nome dele leva o número). */
const grupo = (lista: Locator, numeroENome: string) => lista.getByRole('button', { name: new RegExp(`^(Fechar|Abrir) o grupo ${numeroENome.replace(/\./g, '\\.')}$`) });
/** Uma ação do ⋯ de um grupo ou de um item. */
async function acao(page: Page, lista: Locator, de: string, qual: string) {
  await lista.getByRole('button', { name: `Ações do ${de}` }).click();
  await page.getByRole('menuitem', { name: qual }).click();
}
/** Escolhe o grupo na janela "Mover para grupo". */
async function moverPara(page: Page, nome: string, destino: string) {
  const janela = page.getByRole('dialog', { name: `Mover "${nome}" para o grupo` });
  await janela.getByRole('combobox', { name: 'Grupo' }).selectOption({ label: destino });
  await janela.getByRole('button', { name: 'Mover' }).click();
}

test.describe('Modelos de checklist com grupos (#309)', () => {
  test('quando a pessoa monta um modelo com dois grupos e um subgrupo, então o editor e o cartão salvo mostram 1. / 1.1 / 2.1.1; descer e excluir um grupo renumeram', async ({ page }) => {
    // Dado
    await page.goto('/modelos-de-lista/');
    await page.getByRole('button', { name: 'Novo modelo' }).click();
    const editor = page.getByRole('form', { name: 'Novo modelo' });
    await editor.getByLabel('Nome do modelo').fill('Inventário');
    // Quando: o grupo 1, com um item
    await editor.getByRole('button', { name: 'Novo grupo' }).click();
    await page.getByRole('dialog', { name: 'Nome do grupo' }).getByRole('textbox').fill('Certidões');
    await page.getByRole('dialog', { name: 'Nome do grupo' }).getByRole('button', { name: 'Salvar' }).click();
    await editor.getByRole('textbox', { name: 'Novo item do grupo 1. Certidões' }).fill('Certidão de óbito');
    await editor.getByRole('textbox', { name: 'Novo item do grupo 1. Certidões' }).press('Enter');
    // e o grupo 2, com o subgrupo 2.1 e um item nele
    await editor.getByRole('button', { name: 'Novo grupo' }).click();
    await page.getByRole('dialog', { name: 'Nome do grupo' }).getByRole('textbox').fill('Bens');
    await page.getByRole('dialog', { name: 'Nome do grupo' }).getByRole('button', { name: 'Salvar' }).click();
    await acao(page, editor, 'grupo Bens', 'Adicionar subgrupo');
    await page.getByRole('dialog', { name: 'Nome do subgrupo' }).getByRole('textbox').fill('Imóveis');
    await page.getByRole('dialog', { name: 'Nome do subgrupo' }).getByRole('button', { name: 'Salvar' }).click();
    await editor.getByRole('textbox', { name: 'Novo item do grupo 2.1 Imóveis' }).fill('Matrícula');
    await editor.getByRole('textbox', { name: 'Novo item do grupo 2.1 Imóveis' }).press('Enter');
    // Então: o editor numera
    await expect(grupo(editor, '2.1 Imóveis')).toBeVisible();
    await expect(editor.getByRole('listitem').filter({ hasText: 'Matrícula' }).last()).toHaveText('2.1.1 Matrícula');
    // Quando
    await editor.getByRole('button', { name: 'Salvar modelo' }).click();
    // Então: o cartão do modelo mostra a mesma numeração
    const cartao = page.getByRole('listitem', { name: 'Modelo Inventário' });
    await expect(cartao).toContainText('2 itens em 3 grupos');
    await expect(grupo(cartao, '1. Certidões')).toBeVisible();
    await expect(cartao.getByRole('listitem').filter({ hasText: 'Matrícula' }).last()).toHaveText('2.1.1 Matrícula');
    // Quando: desce o grupo 1 e exclui o grupo Imóveis
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = page.getByRole('form', { name: 'Editar modelo' });
    await acao(page, edicao, 'grupo Certidões', 'Descer');
    await acao(page, edicao, 'grupo Imóveis', 'Excluir grupo');
    await page.getByRole('dialog', { name: 'Excluir o grupo?' }).getByRole('button', { name: 'Excluir grupo' }).click();
    // Então
    await expect(grupo(edicao, '1. Bens')).toBeVisible();
    await expect(grupo(edicao, '2. Certidões')).toBeVisible();
    await expect(edicao.getByRole('listitem').filter({ hasText: 'Certidão de óbito' }).last()).toHaveText('2.1 Certidão de óbito');
    // Quando
    await edicao.getByRole('button', { name: 'Salvar modelo' }).click();
    // Então: o grupo Bens, que ficou vazio, sai; Certidões passa a 1.
    const salvo = page.getByRole('listitem', { name: 'Modelo Inventário' });
    await expect(grupo(salvo, '1. Certidões')).toBeVisible();
    await expect(salvo.getByRole('listitem').filter({ hasText: 'Certidão de óbito' }).last()).toHaveText('1.1 Certidão de óbito');
    await expect(salvo).toContainText('1 item em 1 grupo');
  });

  test('dado o menu ⋯ de Contratos, quando a pessoa escolhe "Modelos de checklist", então chega à página dos modelos', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    // Quando
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await page.getByRole('menuitem', { name: 'Modelos de checklist' }).click();
    // Então
    await expect(page.getByRole('heading', { name: 'Modelos de checklist', level: 1 })).toBeVisible();
  });
});

test.describe('Checklist com grupos no contrato (#309)', () => {
  test('quando a pessoa usa o modelo agrupado, marca, fecha e desce um grupo, então os números e as contagens acompanham, também depois de recarregar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    // Quando
    const lista = await usarModelo(page, cartao, 'Benefício previdenciário');
    // Então: entra agrupado e numerado
    await expect(grupo(lista, '1. Documentos pessoais')).toHaveAccessibleDescription('0 de 2 feitos');
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toHaveAccessibleDescription('2.1.1, no grupo 2. Benefício › 2.1 Aposentadoria por idade');
    // Quando: marca o RG e fecha o grupo 1
    await lista.getByRole('checkbox', { name: 'RG' }).check();
    await grupo(lista, '1. Documentos pessoais').click();
    // Então
    await expect(grupo(lista, '1. Documentos pessoais')).toHaveAttribute('aria-expanded', 'false');
    await expect(lista.getByText('1 de 2 feitos')).toBeVisible();
    await expect(lista.getByRole('checkbox', { name: 'RG' })).toHaveCount(0);
    // Quando: desce o grupo 1
    await acao(page, lista, 'grupo Documentos pessoais', 'Descer');
    // Então
    await expect(grupo(lista, '1. Benefício')).toBeVisible();
    await expect(page.getByText('"Documentos pessoais" agora é 2.')).toBeVisible();
    // Quando: recarrega a página e abre o contrato de novo
    await page.reload();
    const deNovo = await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    const relida = deNovo.getByRole('region', { name: 'Checklist Benefício previdenciário' });
    // Então
    await expect(grupo(relida, '1. Benefício')).toBeVisible();
    await expect(relida.getByRole('checkbox', { name: 'RG' })).toHaveAccessibleDescription('2.1, no grupo 2. Documentos pessoais');
    await expect(relida.getByRole('checkbox', { name: 'RG' })).toBeChecked();
  });

  test('quando a pessoa acrescenta um item no fim e o move para um grupo e de volta, e exclui o grupo 2, então a numeração se ajusta', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    const lista = await usarModelo(page, cartao, 'Benefício previdenciário');
    // Quando: um item no fim do checklist
    await lista.getByRole('textbox', { name: 'Novo item do checklist Benefício previdenciário' }).fill('Procuração');
    await lista.getByRole('button', { name: 'Adicionar', exact: true }).click();
    // Então
    await expect(lista.getByRole('checkbox', { name: 'Procuração' })).toHaveAccessibleDescription('3.');
    // Quando: vai para o grupo 1
    await acao(page, lista, 'item Procuração', 'Mover para grupo');
    await moverPara(page, 'Procuração', '1. Documentos pessoais');
    // Então: o último do grupo 1
    await expect(lista.getByRole('checkbox', { name: 'Procuração' })).toHaveAccessibleDescription('1.3, no grupo 1. Documentos pessoais');
    // Quando: volta para fora dos grupos
    await acao(page, lista, 'item Procuração', 'Mover para grupo');
    await moverPara(page, 'Procuração', 'Fora dos grupos');
    // Então
    await expect(lista.getByRole('checkbox', { name: 'Procuração' })).toHaveAccessibleDescription('3.');
    // Quando: exclui o grupo 2, confirmando
    await acao(page, lista, 'grupo Benefício', 'Excluir grupo');
    const janela = page.getByRole('dialog', { name: 'Excluir o grupo?' });
    await expect(janela).toContainText('O grupo "2. Benefício", 2 subgrupos e 3 itens serão excluídos.');
    await janela.getByRole('button', { name: 'Excluir grupo' }).click();
    // Então
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toHaveCount(0);
    await expect(lista.getByRole('checkbox', { name: 'Procuração' })).toHaveAccessibleDescription('2.');
    await expect(lista).toContainText('0 de 3');
  });

  test('dado o contrato arquivado, quando a pessoa abre o checklist, então vê os grupos, os números e as contagens, sem ⋯ nem botões de acrescentar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    const lista = await usarModelo(page, cartao, 'Benefício previdenciário');
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByRole('button', { name: 'Desarquivar', exact: true })).toBeVisible();
    // Então
    await expect(grupo(lista, '2.1 Aposentadoria por idade')).toHaveAccessibleDescription('0 de 2 feitos');
    await expect(lista.getByRole('checkbox', { name: 'RG' })).toBeDisabled();
    await expect(lista.getByRole('button', { name: /^Ações do/ })).toHaveCount(0);
    await expect(lista.getByRole('button', { name: /^(Novo grupo|Adicionar item)/ })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Adicionar checklist' })).toHaveCount(0);
    // Quando: fecha um grupo
    await grupo(lista, '2. Benefício').click();
    // Então
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toHaveCount(0);
  });
});

test.describe('Grupos na demanda e na tarefa (#309)', () => {
  for (const { rota, texto } of [{ rota: '/demandas/', texto: 'Busca de anterioridade' }, { rota: '/tarefas/', texto: 'Renovar a procuração' }]) {
    test(`dado um checklist em ${rota}, quando a pessoa cria um grupo e um item dentro dele, então eles aparecem como 1. e 1.1`, async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, rota, texto);
      await cartao.getByRole('button', { name: 'Adicionar checklist', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Checklist em branco' }).click();
      await page.getByRole('dialog', { name: 'Nome do checklist' }).getByRole('textbox').fill('Documentos');
      await page.getByRole('dialog', { name: 'Nome do checklist' }).getByRole('button', { name: 'Salvar' }).click();
      const lista = cartao.getByRole('region', { name: 'Checklist Documentos' });
      // Quando
      await lista.getByRole('button', { name: 'Novo grupo' }).click();
      await page.getByRole('dialog', { name: 'Nome do grupo' }).getByRole('textbox').fill('Pessoais');
      await page.getByRole('dialog', { name: 'Nome do grupo' }).getByRole('button', { name: 'Salvar' }).click();
      const campo = lista.getByRole('textbox', { name: 'Novo item do grupo 1. Pessoais' });
      await expect(campo).toBeFocused();
      await campo.fill('RG');
      await campo.press('Enter');
      // Então
      await expect(grupo(lista, '1. Pessoais')).toHaveAccessibleDescription('0 de 1 feito');
      await expect(lista.getByRole('checkbox', { name: 'RG' })).toHaveAccessibleDescription('1.1, no grupo 1. Pessoais');
      // Quando: Esc fecha só o campo
      await campo.press('Escape');
      // Então
      await expect(campo).toHaveCount(0);
      await expect(cartao).toBeVisible();
      await expect(lista.getByRole('button', { name: 'Adicionar item no grupo 1. Pessoais' })).toBeFocused();
    });
  }

  test('dado o modelo de antes, sem grupos, quando a pessoa o usa numa demanda, então os itens aparecem como 1. e 2.', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Busca de anterioridade');
    // Quando
    const lista = await usarModelo(page, cartao, 'Documentos de pessoa física');
    // Então
    await expect(lista.getByRole('listitem')).toHaveText(['1. Documento pessoal', '2. Comprovante de residência']);
  });

  test('dado o celular (375×812) e um item em 2.1.1, quando a pessoa usa "Mover para grupo", então a página não rola para o lado e o item muda de grupo', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    const cartao = await abrirCartao(page, '/demandas/', 'Busca de anterioridade');
    const lista = await usarModelo(page, cartao, 'Benefício previdenciário');
    // Então
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const mais = lista.getByRole('button', { name: 'Ações do item CNIS' });
    await mais.scrollIntoViewIfNeeded();
    await expect(mais).toBeInViewport();
    // Quando
    await mais.click();
    await page.getByRole('menuitem', { name: 'Mover para grupo' }).click();
    await moverPara(page, 'CNIS', '1. Documentos pessoais');
    // Então
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toHaveAccessibleDescription('1.3, no grupo 1. Documentos pessoais');
  });
});

test.describe('Lista numerada colada no checklist, gravada de uma vez (#375)', () => {
  /** Cria na demanda um checklist em branco e cola o texto no campo de item novo do pé, como quem copia do Word. */
  async function colarNoChecklist(page: Page, texto: string) {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const cartao = await abrirCartao(page, '/demandas/', 'Busca de anterioridade');
    await cartao.getByRole('button', { name: 'Adicionar checklist', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Checklist em branco' }).click();
    await page.getByRole('dialog', { name: 'Nome do checklist' }).getByRole('textbox').fill('Documentos');
    await page.getByRole('dialog', { name: 'Nome do checklist' }).getByRole('button', { name: 'Salvar' }).click();
    const lista = cartao.getByRole('region', { name: 'Checklist Documentos' });
    await page.evaluate(t => navigator.clipboard.writeText(t), texto);
    await lista.getByRole('textbox', { name: 'Novo item do checklist Documentos' }).focus();
    await page.keyboard.press('ControlOrMeta+V');
    return lista;
  }

  test('quando a pessoa cola uma lista numerada e usa os números como grupos, então os grupos e os itens entram juntos e continuam depois de recarregar', async ({ page }) => {
    // Dado
    const lista = await colarNoChecklist(page, '1. Documentos pessoais\n1.1 RG\n1.2 CPF\n2. Procuração');
    // Quando
    await lista.getByRole('button', { name: 'Usar esses números como grupos' }).click();
    // Então
    await expect(grupo(lista, '1. Documentos pessoais')).toHaveAccessibleDescription('0 de 2 feitos');
    await expect(lista.getByRole('checkbox', { name: 'CPF' })).toHaveAccessibleDescription('1.2, no grupo 1. Documentos pessoais');
    await expect(lista.getByRole('checkbox', { name: 'Procuração' })).toHaveAccessibleDescription('2.');
    await expect(lista.getByRole('button', { name: 'Usar esses números como grupos' })).toHaveCount(0);
    // Quando: recarrega a página e abre a demanda de novo
    await page.reload();
    const deNovo = await abrirCartao(page, '/demandas/', 'Busca de anterioridade');
    const relida = deNovo.getByRole('region', { name: 'Checklist Documentos' });
    // Então
    await expect(relida.getByRole('checkbox', { name: 'RG' })).toHaveAccessibleDescription('1.1, no grupo 1. Documentos pessoais');
    await expect(relida.getByText('0 de 3')).toBeVisible();
  });

  test('dado um item longo demais no meio da lista colada, quando a pessoa usa os números como grupos, então nada da lista entra e o aviso diz por quê', async ({ page }) => {
    // Dado: o 1.2 passa do tamanho de um item (500 caracteres)
    const lista = await colarNoChecklist(page, `1. Documentos pessoais\n1.1 RG\n1.2 ${'x'.repeat(501)}\n2. Procuração`);
    // Quando
    await lista.getByRole('button', { name: 'Usar esses números como grupos' }).click();
    // Então: nem o grupo nem o RG, que vinham antes, ficam
    await expect(page.getByText('O item pode ter até 500 caracteres.')).toBeVisible();
    await expect(lista.getByRole('button', { name: /grupo 1\. Documentos pessoais/ })).toHaveCount(0);
    await expect(lista.getByRole('checkbox')).toHaveCount(0);
    await expect(lista.getByText('0 de 0')).toBeVisible();
  });
});
