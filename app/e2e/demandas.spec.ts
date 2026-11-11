// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Demandas. Na semente do banco fictício: o contrato de JOSÉ DA SILVA TESTE (assinado) já gerou as demandas
// "Registro de marca" (Fazendo, com o Bruno de colaborador) e "Busca de anterioridade" (Para fazer); "Notificar o
// devedor" é avulsa, do Bruno, com o prazo vencido. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, alturaParada } from './ajudantes';

/** Abre o cartão de uma demanda pela tabela e, se pedidas, as seções dele (toda seção começa recolhida). */
async function abrirDemanda(page: Page, titulo: string, ...secoes: string[]) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  for (const secao of secoes) await abrirSecao(page.getByRole('dialog'), secao);
  return page.getByRole('dialog');
}

test.describe('Cadastro de demandas', () => {
  test('quando a pessoa cadastra uma demanda pelas etapas, então ela entra em "Para fazer", com a equipe e o cliente no cartão', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    await expect(page.getByText('Etapa 1 de 3')).toBeVisible();
    // Quando
    await page.getByLabel('Título').fill('Contestação do processo');
    await page.getByLabel('Prazo de entrega').fill('10112030');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('group', { name: 'Colaboradores' }).getByRole('button', { name: 'Adicionar colaborador' }).click();
    await page.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar demanda' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Contestação do processo' })).toBeVisible();
    await expect(cartao).toContainText('Prazo: 10/11/2030');
    const equipe = cartao.getByRole('group', { name: 'Equipe' });
    await expect(equipe.getByRole('button', { name: 'Mateus Freitas Gonçalves, Responsável' })).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Ana Teste Lima, Colaborador' })).toBeVisible();
    await abrirSecao(cartao, 'Clientes');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente');
    await expect(cartao.getByLabel('Situação da demanda').getByRole('option', { selected: true })).toHaveText('Para fazer');
  });

  test('quando chega à etapa do contrato, então a busca tem a altura dos outros campos', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    const titulo = page.getByLabel('Título');
    const altura = await alturaParada(titulo);
    await titulo.fill('Pedido de registro');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    expect(await alturaParada(page.getByRole('combobox', { name: 'Contrato' }))).toBe(altura);
  });

  test('quando falta o título, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Dê um título à demanda.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A demanda', level: 2 })).toBeVisible();
  });
});

test.describe('Demandas automáticas', () => {
  test('quando o contrato vai para a coluna do contrato assinado, então nasce uma demanda por objeto, ligada a ele', async ({ page }) => {
    // Dado: o contrato de MARIA APARECIDA EXEMPLO está em negociação, com o objeto "Ação de cobrança"
    await page.goto('/contratos/');
    await page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' }).click();
    const contrato = page.getByRole('dialog');
    // Quando
    await contrato.getByLabel('Situação do contrato').selectOption({ label: 'Assinado / em andamento' });
    // Então
    await abrirSecao(contrato, 'Demandas');
    await expect(contrato.getByRole('link', { name: /Ação de cobrança/ })).toContainText('Para fazer');
    await contrato.getByRole('link', { name: /Ação de cobrança/ }).click();
    const demanda = page.getByRole('dialog');
    await expect(demanda.getByRole('heading', { name: 'Ação de cobrança', level: 2 })).toBeVisible();
    await abrirSecao(demanda, 'Clientes');
    await abrirSecao(demanda, 'Contrato');
    await expect(demanda.getByRole('link', { name: /MARIA APARECIDA EXEMPLO/ })).toContainText('Cliente');
    await expect(demanda.getByRole('link', { name: /Ação de cobrança/ })).toContainText('Contrato');
  });
});

test.describe('Demandas ligadas', () => {
  test('quando alguém abre o cartão de uma pessoa, então vê as demandas dela, com o papel e a situação', async ({ page }) => {
    // Quando
    await page.goto('/pessoas/');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    // Então
    await abrirSecao(page.getByRole('dialog'), 'Demandas');
    await expect(page.getByRole('dialog').getByRole('link', { name: /Registro de marca/ }).filter({ hasText: 'Fazendo' })).toContainText('Cliente');
  });

  test('quando a demanda tem o prazo vencido, então o cartão avisa', async ({ page }) => {
    // Quando
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    // Então
    await expect(cartao.getByText(/Prazo vencido/)).toBeVisible();
  });

  test('quando o comentário da demanda menciona quem não participa dela, então a pessoa aparece desligada na lista do @', async ({ page }) => {
    // Dado: "Busca de anterioridade" é do Mateus, sem colaboradores; a Ana é administradora e vê todas
    const cartao = await abrirDemanda(page, 'Busca de anterioridade', 'Comentários');
    // Quando
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
    // Então
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toContainText('não participa');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
  });
});

test.describe('Listas da demanda', () => {
  test('quando a pessoa cria uma lista, acrescenta itens e marca um, então a lista mostra o progresso', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Busca de anterioridade', 'Listas');
    // Quando
    await cartao.getByRole('button', { name: 'Adicionar lista' }).click();
    await page.getByRole('menuitem', { name: 'Lista em branco' }).click();
    await page.getByRole('dialog', { name: 'Nome da lista' }).getByRole('textbox').fill('Documentos do cliente');
    await page.getByRole('dialog', { name: 'Nome da lista' }).getByRole('button', { name: 'Salvar' }).click();
    const lista = cartao.getByRole('region', { name: 'Lista Documentos do cliente' });
    const novo = lista.getByRole('textbox', { name: 'Novo item da lista Documentos do cliente' });
    await novo.fill('Procuração');
    await novo.press('Enter');
    await novo.fill('Contrato social');
    await novo.press('Enter');
    await lista.getByRole('checkbox', { name: 'Procuração' }).check();
    // Então
    await expect(lista).toContainText('1 de 2');
    await expect(lista.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    await expect(lista.getByRole('checkbox', { name: 'Procuração' })).toBeChecked();
  });

  test('quando a pessoa põe uma data de entrega num item e o sobe, então a data aparece e o item vai para cima', async ({ page }) => {
    // Dado: "Registro de marca" tem a lista "Pessoa jurídica" com três itens
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Listas');
    const lista = cartao.getByRole('region', { name: 'Lista Pessoa jurídica' });
    // Quando
    await lista.getByRole('button', { name: 'Ações do item Atos constitutivos' }).click();
    await page.getByRole('menuitem', { name: 'Data de entrega' }).click();
    const janela = page.getByRole('dialog', { name: /Data de entrega/ });
    await janela.getByRole('textbox').fill('10/11/2030');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    await lista.getByRole('button', { name: 'Ações do item Atos constitutivos' }).click();
    await page.getByRole('menuitem', { name: 'Subir' }).click();
    // Então
    await expect(lista.getByRole('listitem').filter({ hasText: 'Atos constitutivos' })).toContainText('10/11/2030');
    await expect.poll(async () => (await lista.getByRole('listitem').allTextContents()).findIndex(t => t.includes('Atos constitutivos'))).toBe(1);
  });

  test('quando a pessoa exclui uma lista e confirma, então ela some do cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Listas');
    // Quando
    await cartao.getByRole('button', { name: 'Ações da lista Pessoa jurídica' }).click();
    await page.getByRole('menuitem', { name: 'Excluir lista' }).click();
    await page.getByRole('dialog', { name: 'Excluir a lista?' }).getByRole('button', { name: 'Excluir lista' }).click();
    // Então
    await expect(cartao.getByRole('region', { name: 'Lista Pessoa jurídica' })).toHaveCount(0);
    await expect(cartao.getByText('Nenhuma lista ainda.', { exact: false })).toBeVisible();
  });
});

test.describe('Modelos de lista', () => {
  test('quando a pessoa cria um modelo, então ele aparece na lista de modelos, com os itens na ordem', async ({ page }) => {
    // Dado
    await page.goto('/modelos-de-lista/');
    // Quando
    await page.getByRole('button', { name: 'Novo modelo' }).click();
    await page.getByLabel('Nome do modelo').fill('Documentos do divórcio');
    await page.getByLabel('Itens').fill('Certidão de casamento\n\nPacto antenupcial\n');
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    // Então
    await expect(page.getByRole('listitem', { name: 'Modelo Documentos do divórcio' }).getByRole('listitem')).toHaveText(['Certidão de casamento', 'Pacto antenupcial']);
  });

  test('quando a pessoa escolhe um modelo em "Adicionar lista", então a lista entra na demanda com um clique, sem itens marcados', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Busca de anterioridade', 'Listas');
    // Quando
    await cartao.getByRole('button', { name: 'Adicionar lista' }).click();
    await page.getByRole('menuitem', { name: 'Documentos de pessoa física' }).click();
    // Então
    const lista = cartao.getByRole('region', { name: 'Lista Documentos de pessoa física' });
    await expect(lista.getByRole('checkbox')).toHaveCount(2);
    await expect(lista).toContainText('0 de 2');
  });

  test('quando a pessoa salva uma lista da demanda como modelo, então ele passa a aparecer nos modelos', async ({ page }) => {
    // Dado: "Registro de marca" tem a lista "Pessoa jurídica"
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Listas');
    // Quando
    await cartao.getByRole('button', { name: 'Ações da lista Pessoa jurídica' }).click();
    await page.getByRole('menuitem', { name: 'Salvar como modelo' }).click();
    const janela = page.getByRole('dialog', { name: 'Nome do modelo' });
    await janela.getByRole('textbox').fill('Documentos da marca');
    await janela.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Modelo "Documentos da marca" salvo.', { exact: false })).toBeVisible();
    await page.goto('/modelos-de-lista/');
    // Então
    await expect(page.getByRole('listitem', { name: 'Modelo Documentos da marca' }).getByRole('listitem')).toHaveCount(3);
  });
});

test.describe('Quantos itens cada seção do cartão tem', () => {
  test('dada a demanda "Registro de marca", com contrato e três tarefas, quando abre o cartão, então as seções mostram quantos itens têm, mesmo recolhidas', async ({ page }) => {
    // Quando
    const cartao = await abrirDemanda(page, 'Registro de marca');
    // Então
    await expect(cartao.getByRole('button', { name: 'Contrato 1' })).toHaveAttribute('aria-expanded', 'false');
    await expect(cartao.getByRole('button', { name: 'Tarefas 3' })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Clientes \d+$/ })).toBeVisible();
  });
});

test.describe('Prazo da demanda concluída', () => {
  test('dada uma demanda com o prazo vencido, quando vai para "Concluído", então o selo fica verde e a tabela não diz "Prazo vencido"', async ({ page }) => {
    // Dado: "Notificar o devedor" venceu há dois dias
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    await expect(cartao.getByText(/^Prazo vencido: /)).toBeVisible();
    // Quando
    await cartao.getByLabel('Situação da demanda').selectOption({ label: 'Concluído' });
    await page.getByRole('dialog', { name: 'Criar o processo?' }).getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(cartao.getByText(/^Concluído · Prazo: /)).toBeVisible();
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    const linha = page.getByRole('row').filter({ hasText: 'Notificar o devedor' });
    await expect(linha).toContainText('Concluído · Prazo:');
    await expect(linha).not.toContainText('Prazo vencido');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Concluído', exact: true }).getByRole('listitem').filter({ hasText: 'Notificar o devedor' }))
      .toContainText('Concluído · Prazo:');
  });
});
