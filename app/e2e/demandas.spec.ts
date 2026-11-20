// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Demandas. Na semente do banco fictício: o contrato de JOSÉ DA SILVA TESTE (assinado) já gerou as demandas
// "Registro de marca" (Fazendo, com o Bruno de colaborador) e "Busca de anterioridade" (Para fazer); "Notificar o
// devedor" é avulsa, do Bruno, com o prazo vencido. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, alturaParada, barraDeFormatacao, barraEquilibradaNoCelular, entrarComo } from './ajudantes';

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
    await expect(equipe.getByRole('button', { name: 'Mateus Freitas Gonçalves, Responsável. Trocar o responsável' })).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Tirar Ana Teste Lima' })).toBeVisible();
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

test.describe('Checklists da demanda', () => {
  test('quando a pessoa cria um checklist, acrescenta itens e marca um, então o checklist mostra o progresso', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Busca de anterioridade', 'Checklists');
    // Quando
    await cartao.getByRole('button', { name: 'Adicionar checklist' }).click();
    await page.getByRole('menuitem', { name: 'Checklist em branco' }).click();
    await page.getByRole('dialog', { name: 'Nome do checklist' }).getByRole('textbox').fill('Documentos do cliente');
    await page.getByRole('dialog', { name: 'Nome do checklist' }).getByRole('button', { name: 'Salvar' }).click();
    const lista = cartao.getByRole('region', { name: 'Checklist Documentos do cliente' });
    const novo = lista.getByRole('textbox', { name: 'Novo item do checklist Documentos do cliente' });
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
    // Dado: "Registro de marca" tem o checklist "Pessoa jurídica" com três itens
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Checklists');
    const lista = cartao.getByRole('region', { name: 'Checklist Pessoa jurídica' });
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

  test('quando a pessoa exclui um checklist e confirma, então ele some do cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Checklists');
    // Quando
    await cartao.getByRole('button', { name: 'Ações do checklist Pessoa jurídica' }).click();
    await page.getByRole('menuitem', { name: 'Excluir checklist' }).click();
    await page.getByRole('dialog', { name: 'Excluir o checklist?' }).getByRole('button', { name: 'Excluir checklist' }).click();
    // Então
    await expect(cartao.getByRole('region', { name: 'Checklist Pessoa jurídica' })).toHaveCount(0);
    await expect(cartao.getByText('Nenhum checklist ainda.', { exact: false })).toBeVisible();
  });
});

test.describe('Modelos de checklist', () => {
  // Desde a #309, o modelo é montado com a mesma árvore do checklist do cartão (um item por vez no campo de item novo, em vez de
  // um por linha numa caixa de texto), e os itens aparecem numerados.
  test('quando a pessoa cria um modelo, então ele aparece na lista de modelos, com os itens na ordem', async ({ page }) => {
    // Dado
    await page.goto('/modelos-de-lista/');
    // Quando
    await page.getByRole('button', { name: 'Novo modelo' }).click();
    await page.getByLabel('Nome do modelo').fill('Documentos do divórcio');
    const novo = page.getByRole('textbox', { name: 'Novo item do modelo' });
    await novo.fill('Certidão de casamento');
    await novo.press('Enter');
    await novo.fill('Pacto antenupcial');
    await novo.press('Enter');
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    // Então
    await expect(page.getByRole('listitem', { name: 'Modelo Documentos do divórcio' }).getByRole('listitem')).toHaveText(['1. Certidão de casamento', '2. Pacto antenupcial']);
  });

  test('quando a pessoa escolhe um modelo em "Adicionar checklist", então o checklist entra na demanda com um clique, sem itens marcados', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Busca de anterioridade', 'Checklists');
    // Quando
    await cartao.getByRole('button', { name: 'Adicionar checklist' }).click();
    await page.getByRole('menuitem', { name: 'Documentos de pessoa física' }).click();
    // Então
    const lista = cartao.getByRole('region', { name: 'Checklist Documentos de pessoa física' });
    await expect(lista.getByRole('checkbox')).toHaveCount(2);
    await expect(lista).toContainText('0 de 2');
  });

  test('quando a pessoa salva um checklist da demanda como modelo, então ele passa a aparecer nos modelos', async ({ page }) => {
    // Dado: "Registro de marca" tem o checklist "Pessoa jurídica"
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Checklists');
    // Quando
    await cartao.getByRole('button', { name: 'Ações do checklist Pessoa jurídica' }).click();
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

test.describe('Checklists: o nome e o caminho para editar (#358)', () => {
  for (const modulo of ['Demandas', 'Tarefas']) {
    test(`quando a pessoa abre o menu ⋯ de ${modulo} e escolhe "Modelos de checklist", então chega à página dos modelos`, async ({ page }) => {
      // Dado
      await page.goto(`/${modulo.toLowerCase()}/`);
      // Quando
      await page.getByRole('button', { name: 'Mais ações' }).click();
      await page.getByRole('menuitem', { name: 'Modelos de checklist' }).click();
      // Então
      await expect(page.getByRole('heading', { name: 'Modelos de checklist', level: 1 })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Modelos de checklist' }).getByRole('listitem', { name: 'Modelo Documentos de pessoa física' })).toBeVisible();
    });
  }

  test('dado o checklist "Pessoa jurídica", quando a pessoa clica no nome e num item e escreve outro texto, então os dois mudam ali mesmo e continuam assim ao reabrir', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Checklists');
    const lista = cartao.getByRole('region', { name: 'Checklist Pessoa jurídica' });
    // Então: passar o mouse diz que o clique renomeia, e mostra o "⋯"
    const nome = lista.getByRole('button', { name: 'Pessoa jurídica', exact: true });
    await nome.hover();
    await expect(nome).toHaveAttribute('title', 'Clique para renomear');
    await expect(lista.getByRole('button', { name: 'Ações do checklist Pessoa jurídica' })).toHaveCSS('opacity', '1');
    // Então: no item, o mesmo (a dica no texto e o "⋯" dele à vista)
    await lista.getByRole('listitem').filter({ hasText: 'Atos constitutivos' }).hover();
    await expect(lista.getByRole('button', { name: 'Atos constitutivos', exact: true })).toHaveAttribute('title', 'Clique para renomear');
    await expect(lista.getByRole('button', { name: 'Ações do item Atos constitutivos' })).toHaveCSS('opacity', '1');
    // Quando
    await nome.click();
    await lista.getByRole('textbox', { name: 'Nome do checklist' }).fill('Documentos da empresa');
    await lista.getByRole('textbox', { name: 'Nome do checklist' }).press('Enter');
    const renomeada = cartao.getByRole('region', { name: 'Checklist Documentos da empresa' });
    await renomeada.getByRole('button', { name: 'Atos constitutivos', exact: true }).click();
    await renomeada.getByRole('textbox', { name: 'Texto do item' }).fill('Contrato social e alterações');
    await renomeada.getByRole('textbox', { name: 'Texto do item' }).press('Enter');
    // Então
    await expect(renomeada.getByRole('heading', { name: 'Documentos da empresa', level: 4 })).toBeVisible();
    await expect(renomeada.getByRole('checkbox', { name: 'Contrato social e alterações' })).toBeVisible();
    const reaberto = await abrirDemanda(page, 'Registro de marca', 'Checklists');
    const deNovo = reaberto.getByRole('region', { name: 'Checklist Documentos da empresa' });
    await expect(deNovo.getByRole('checkbox', { name: 'Contrato social e alterações' })).toBeVisible();
  });

  test('dado um item do checklist, quando a pessoa toca logo ao lado da caixa, então o item é marcado, e tocar no texto abre o texto para renomear', async ({ page }) => {
    // Quantos pixels à esquerda da caixa (de 18px) fica o toque: fora dela, mas dentro do alvo de 44px em volta
    const AO_LADO_DA_CAIXA = 8;
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca', 'Checklists');
    const lista = cartao.getByRole('region', { name: 'Checklist Pessoa jurídica' });
    const caixa = lista.getByRole('checkbox', { name: 'Atos constitutivos' });
    await expect(caixa).not.toBeChecked();
    // Quando
    const onde = (await caixa.boundingBox())!;
    await page.mouse.click(onde.x - AO_LADO_DA_CAIXA, onde.y + onde.height / 2);
    // Então
    await expect(caixa).toBeChecked();
    // Quando
    await lista.getByRole('button', { name: 'Atos constitutivos', exact: true }).click();
    // Então
    await expect(lista.getByRole('textbox', { name: 'Texto do item' })).toBeFocused();
    await expect(caixa).toBeChecked();
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

test.describe('Ordem pelo prazo (#291)', () => {
  test('dado o Ordenar de Demandas, quando a pessoa o abre, então há as ordens pelo prazo; em Pessoas, não', async ({ page }) => {
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();
    // Então
    const ordenar = page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Ordenar');
    await expect(ordenar.getByRole('option', { name: 'Prazo (o mais próximo primeiro)' })).toBeAttached();
    await expect(ordenar.getByRole('option', { name: 'Prazo (o mais distante primeiro)' })).toBeAttached();
    // Quando
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();
    // Então
    await expect(page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Ordenar').getByRole('option', { name: /^Prazo/ })).toHaveCount(0);
  });
});

test.describe('Título e descrição no próprio lugar (#346)', () => {
  test('dada uma demanda que a pessoa pode alterar, quando muda o título e a descrição ali mesmo, então os dois ficam gravados ao fechar e abrir o cartão', async ({ page }) => {
    // Dado: "Notificar o devedor" tem a descrição "Mandar a notificação extrajudicial antes da ação."
    let cartao = await abrirDemanda(page, 'Notificar o devedor');
    // Quando: o título
    await cartao.getByRole('button', { name: 'Notificar o devedor', exact: true }).click();
    const campo = cartao.getByRole('textbox', { name: 'Título' });
    await expect(campo).toHaveValue('Notificar o devedor');
    await campo.fill('Notificar o devedor pelo correio');
    await campo.press('Enter');
    // Então
    await expect(cartao.getByRole('heading', { name: 'Notificar o devedor pelo correio', level: 2 })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Demanda atualizada.' })).toBeVisible();
    // Quando: a descrição, sem o botão "Mudar a descrição" (#385): o clique no texto abre a edição
    await expect(cartao.getByRole('button', { name: 'Mudar a descrição' })).toHaveCount(0);
    await cartao.getByText('Mandar a notificação extrajudicial antes da ação.').click();
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    await expect(caixa).toHaveValue('Mandar a notificação extrajudicial antes da ação.');
    await caixa.fill('Mandar a notificação com *aviso de recebimento*.');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(caixa).toHaveCount(0);
    // Então: continuam assim ao fechar e abrir o cartão
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirDemanda(page, 'Notificar o devedor pelo correio');
    await expect(cartao.locator('em', { hasText: 'aviso de recebimento' })).toBeVisible();
  });

  test('dado o título da demanda em edição, quando a pessoa aperta Esc, então desfaz, sem fechar o cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    await cartao.getByRole('button', { name: 'Notificar o devedor', exact: true }).click();
    const campo = cartao.getByRole('textbox', { name: 'Título' });
    await campo.fill('Outro título');
    // Quando
    await campo.press('Escape');
    // Então
    await expect(campo).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'Notificar o devedor', level: 2 })).toBeVisible();
    await expect(page.getByText('Demanda atualizada.')).toHaveCount(0);
  });

  test('dado o lápis da demanda, quando a pessoa o usa, então o formulário não repete o título, a descrição e as datas (#361)', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar demanda' });
    // Então
    await expect(edicao.getByLabel(/Responsável/)).toBeVisible();
    for (const rotulo of ['Prazo de entrega', 'Hora', 'Lembrete', 'Data de início']) await expect(edicao.getByLabel(rotulo, { exact: true })).toHaveCount(0);
    await expect(edicao.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
    await expect(edicao.getByRole('textbox', { name: 'Descrição' })).toHaveCount(0);
    // Quando
    await edicao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(edicao).toHaveCount(0);
    await expect(cartao.getByRole('heading', { name: 'Notificar o devedor', level: 2 })).toBeVisible();
    await expect(cartao.getByText('Mandar a notificação extrajudicial antes da ação.')).toBeVisible();
  });

  test('dada uma demanda que a pessoa só lê, quando clica no título, então nada vira campo', async ({ page }) => {
    // Dado: com a chave da equipe ligada, o Bruno lê "Busca de anterioridade", em que não está
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirDemanda(page, 'Busca de anterioridade');
    // Quando
    await cartao.getByRole('heading', { name: 'Busca de anterioridade', level: 2 }).click();
    // Então
    await expect(cartao.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Busca de anterioridade', exact: true })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Sem descrição. Clique para escrever.' })).toHaveCount(0);
  });
});

test.describe('Seções e campos do formulário (#359)', () => {
  test('dado o cadastro de demanda, quando a pessoa chega à etapa Pessoas, então ela é uma seção com Responsável, Colaboradores e Clientes como campos dentro', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    await page.getByLabel('Título').fill('Contestação do processo');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: "Pessoas" é o título (h2) de uma região, e os três campos ficam dentro dela, com o rótulo no plural nos de vários itens
    const pessoas = page.getByRole('region', { name: 'Pessoas' });
    await expect(pessoas.getByRole('heading', { name: 'Pessoas', level: 2 })).toBeVisible();
    await expect(pessoas.getByRole('combobox', { name: /Responsável/ })).toBeVisible();
    await expect(pessoas.getByRole('group', { name: 'Colaboradores' })).toBeVisible();
    await expect(pessoas.getByRole('group', { name: 'Clientes' })).toBeVisible();
    await expect(pessoas.getByRole('heading', { name: /Responsável|Colaboradores|Clientes/ })).toHaveCount(0);
  });

  test('dado o lápis de uma demanda, quando abre, então "Pessoas" é uma seção (h3, abaixo do título do cartão) com os campos dentro', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    // Então
    const pessoas = cartao.getByRole('form', { name: 'Editar demanda' }).getByRole('region', { name: 'Pessoas' });
    await expect(pessoas.getByRole('heading', { name: 'Pessoas', level: 3 })).toBeVisible();
    await expect(pessoas.getByRole('combobox', { name: /Responsável/ })).toBeVisible();
    await expect(pessoas.getByRole('group', { name: 'Colaboradores' })).toBeVisible();
    await expect(pessoas.getByRole('group', { name: 'Clientes' })).toBeVisible();
  });
});

for (const { width, height } of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`dado o cadastro de demanda num celular de ${width}px, quando a pessoa chega à descrição, então a barra de formatação fica em duas linhas equilibradas, sem botão sozinho embaixo e com o alvo do dedo de 44px por 44px (#374)`, async ({ page }) => {
    // Dado
    await page.setViewportSize({ width, height });
    await page.goto('/demandas/nova/');
    // Quando: a pessoa rola até a descrição, que fica no meio da tela
    const barra = barraDeFormatacao(page);
    await barra.evaluate(b => b.scrollIntoView({ block: 'center' }));
    // Então
    await barraEquilibradaNoCelular(barra);
  });
}

test.describe('A descrição no topo do cartão da demanda (#385)', () => {
  test('dado quem usa só o teclado, quando chega à descrição da demanda com Tab e tecla Enter, então a edição abre; ao cancelar, o foco volta ao texto', async ({ page }) => {
    // Dado: o foco no título, logo acima da descrição
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    await expect(cartao.getByRole('button', { name: 'Mudar a descrição' })).toHaveCount(0);
    await cartao.getByRole('button', { name: 'Notificar o devedor', exact: true }).focus();
    // Quando
    await page.keyboard.press('Tab');
    // Então
    const texto = cartao.getByRole('group', { name: 'Descrição', exact: true });
    await expect(texto).toBeFocused();
    // Quando
    await page.keyboard.press('Enter');
    // Então
    const caixa = cartao.getByRole('textbox', { name: 'Descrição' });
    await expect(caixa).toBeFocused();
    await expect(caixa).toHaveValue('Mandar a notificação extrajudicial antes da ação.');
    // Quando
    await cartao.getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(caixa).toHaveCount(0);
    await expect(texto).toBeFocused();
  });

  test('dado o cartão de uma demanda, quando ele abre, então o vão entre o título e a descrição é, no mínimo, a medida da variável de estilo', async ({ page }) => {
    // Quando
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    // Então
    const vao = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vao-do-titulo-a-descricao')));
    expect(vao).toBeGreaterThan(0);
    const titulo = (await cartao.getByRole('heading', { name: 'Notificar o devedor', level: 2 }).boundingBox())!;
    const descricao = (await cartao.getByText('Mandar a notificação extrajudicial antes da ação.').boundingBox())!;
    expect(descricao.y - (titulo.y + titulo.height)).toBeGreaterThanOrEqual(vao);
  });
});
