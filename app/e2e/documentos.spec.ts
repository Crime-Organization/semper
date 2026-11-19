// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Documentos (#303): anotações em Markdown ligadas a pessoas, processos, contratos, demandas, tarefas e compromissos.
// Desde os pedidos do dono de 18/11, a página é como o Obsidian: o explorador (as pastas com as anotações dentro) à esquerda, que
// se recolhe, e a tabela no centro. A anotação abre na janela do cartão, como os outros cartões (ao lado, de início, ou no centro),
// com as etiquetas no topo e o texto já na caixa de escrever, salvando sozinho; os comentários, "Ligada a" e o histórico ficam
// embaixo do texto (ao lado) ou na coluna da direita da janela (no centro). A anotação nova abre na janela do cadastro.
// Na semente do banco fictício não há anotações. A demanda "Registro de marca" tem o Bruno (estagiário, não administrador)
// de colaborador; JOSÉ DA SILVA TESTE é uma pessoa do cadastro. Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';

/**
 * A anotação aberta: a janela do cartão, com a anotação, os botões da janela (a etiqueta, o ⋯, o formato e o X) e as seções
 * (embaixo do texto, ao lado; na coluna da direita, no centro).
 */
const anotacaoAberta = (page: Page) => page.getByRole('dialog', { name: 'Anotação', exact: true });
/** Onde ficam os comentários, "Ligada a" e o histórico da anotação aberta: na própria janela (embaixo do texto ou na coluna). */
const coluna = anotacaoAberta;
/** Fecha a janela da anotação pelo X dela. */
const fecharAnotacao = (page: Page) => anotacaoAberta(page).getByRole('button', { name: 'Fechar', exact: true }).click();
/** Escreve um comentário na anotação aberta (a seção já vem aberta) e espera ele aparecer na lista. */
async function comentar(page: Page, texto: string) {
  await coluna(page).getByRole('textbox', { name: 'Escrever um comentário' }).fill(texto);
  await coluna(page).getByRole('button', { name: 'Comentar', exact: true }).click();
  await expect(coluna(page).getByRole('list', { name: 'Comentários do cartão' }).getByText(texto)).toBeVisible();
}
/** A caixa de escrever da anotação: o editor ao vivo (#364), um texto de várias linhas com o nome "Texto". */
const caixaDoTexto = (onde: Page | Locator) => onde.getByRole('textbox', { name: 'Texto', exact: true });
/**
 * Troca o texto todo da caixa, como a pessoa que escolhe tudo e cola outro texto. O texto entra de uma vez, como colado: tecla por
 * tecla, o Enter numa lista já começaria o item seguinte (como no Obsidian).
 */
async function porNoTexto(caixa: Locator, texto: string) {
  await caixa.click();
  await caixa.press('ControlOrMeta+a');
  await caixa.page().keyboard.insertText(texto);
}
/**
 * O texto guardado de uma anotação, no banco fictício: o Markdown, com os sinais (**, ##, "- [ ] ") que o editor ao vivo esconde
 * fora da linha do cursor.
 */
const textoGuardado = (page: Page, titulo: string) => page.evaluate(([chave, t]) =>
  (JSON.parse(sessionStorage.getItem(chave)!) as { anotacoes: { titulo: string; texto: string }[] }).anotacoes.find(a => a.titulo === t)?.texto, [CHAVE, titulo]);
/** A anotação nova, em branco: na janela do cadastro (ou na página, quando aberta direto pelo endereço). */
const notaNova = (page: Page) => page.getByRole('article', { name: 'Anotação nova' });
/** O link "Nova anotação" da barra do explorador (o do cabeçalho da página leva ao mesmo lugar). */
const novaAnotacao = (page: Page) => page.getByRole('toolbar', { name: 'Explorador' }).getByRole('link', { name: 'Nova anotação' });

/**
 * Escreve uma anotação na nota em branco e espera ela abrir na janela do cartão. A nota não tem rótulos à vista: o título e o
 * texto são achados pelo nome que o leitor de tela lê. A equipe é a das bolinhas, no topo.
 */
async function criarAnotacao(page: Page, titulo: string, { texto = '', compartilharCom = '', endereco = '/documentos/nova/' } = {}) {
  await page.goto(endereco);
  await page.getByRole('textbox', { name: 'Título' }).fill(titulo);
  if (texto) await porNoTexto(caixaDoTexto(page), texto);
  if (compartilharCom) {
    await notaNova(page).getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Compartilhar com mais alguém' }).click();
    await page.getByRole('dialog', { name: 'Compartilhar com mais alguém' }).getByRole('list', { name: 'Equipe' }).getByRole('button', { name: compartilharCom }).click();
  }
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
  const anotacao = anotacaoAberta(page);
  await expect(anotacao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return anotacao;
}
/** Abre o cartão de uma demanda pela tabela. */
async function abrirDemanda(page: Page, titulo: string) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** Abre uma anotação pela tabela da página Documentos: ela abre na janela do cartão, por cima da página. */
async function abrirAnotacao(page: Page, titulo: string) {
  await page.goto('/documentos/');
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const anotacao = anotacaoAberta(page);
  await expect(anotacao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return anotacao;
}
/**
 * Abre, como o Bruno, uma anotação que o Mateus escreveu ligada à demanda "Registro de marca", em que o Bruno está: ele só a lê, e
 * quem só lê vê o texto formatado, sem a caixa de escrever (desde 18/11 não há mais o modo de ler, o livro, para quem escreve).
 */
async function abrirComoQuemSoLe(page: Page, titulo: string, texto: string) {
  await page.goto('/inicio/');
  const demanda = await idDaDemanda(page, 'Registro de marca');
  await criarAnotacao(page, titulo, { texto, endereco: '/documentos/nova/?demanda=' + demanda });
  await entrarComo(page, 'u-bruno');
  return abrirAnotacao(page, titulo);
}
/** Uma ação do menu ⋯ da anotação (Duplicar, Baixar .md, Arquivar, Desarquivar, Excluir). */
async function noMenu(page: Page, anotacao: Locator, acao: string) {
  await anotacao.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: acao }).click();
}
/** O id de uma demanda da semente, lido do banco fictício da aba. */
const idDaDemanda = (page: Page, titulo: string) => page.evaluate(([chave, t]) =>
  (JSON.parse(sessionStorage.getItem(chave)!) as { demandas: { id: string; titulo: string }[] }).demandas.find(d => d.titulo === t)!.id, [CHAVE, titulo]);
/** As anotações na tabela da página (sem nenhuma aberta), pelo título. */
const titulosNaTabela = (page: Page) => page.getByRole('table').getByRole('row').filter({ has: page.getByRole('cell') });
/** Espera a tela desenhar dois quadros: o que o React faz depois de uma mudança já aconteceu. */
const esperarDesenhar = (page: Page) => page.evaluate(() => new Promise(pronto => requestAnimationFrame(() => requestAnimationFrame(pronto))));

test.describe('Anotações no cartão de um item', () => {
  test('dado o cartão de uma demanda, quando a pessoa escreve uma anotação pelo "+" da seção, então ela nasce ligada, abre na janela em Documentos, e o Voltar leva de novo ao cartão, com o número', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page, 'Registro de marca');
    const secao = cartao.getByRole('button', { name: /^Anotações/ });
    await expect(secao).toHaveAttribute('aria-expanded', 'false');
    await expect(secao).toHaveText(/^Anotações\s*0$/);
    // Quando: o "+" abre a anotação nova na janela do cadastro, por cima do cartão, como os outros cadastros (pedido de 18/11)
    await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
    await expect(page).toHaveURL(/\/documentos\/nova\/\?demanda=/);
    await expect(page.getByRole('dialog', { name: 'Cadastro' }).getByRole('article', { name: 'Anotação nova' })).toBeVisible();
    // A demanda de onde se veio já está na lista "Ligada a" da nota em branco (#339), embaixo do texto.
    const escolhidos = notaNova(page).getByRole('list', { name: 'Itens ligados' });
    await expect(escolhidos.getByRole('listitem')).toHaveCount(1);
    await expect(escolhidos).toContainText('Demanda');
    await expect(escolhidos).toContainText('Registro de marca');
    await notaNova(page).getByRole('textbox', { name: 'Título' }).fill('Estratégia do registro');
    await notaNova(page).getByRole('button', { name: 'Salvar anotação' }).click();
    // Então: a anotação salva abre na janela do cartão, no lugar da nota em branco, com a demanda em "Ligada a"
    await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
    const anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Estratégia do registro', level: 2 })).toBeVisible();
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /Registro de marca/ })).toContainText('Demanda');
    // E o Voltar do navegador leva ao cartão da demanda, que mostra a anotação
    await page.goBack();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Registro de marca', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
    await abrirSecao(cartao, 'Anotações');
    await cartao.getByRole('list', { name: 'Anotações ligadas' }).getByRole('link', { name: /Estratégia do registro/ }).click();
    // E o link abre a anotação na janela, em Documentos
    await expect(page).toHaveURL(/\/documentos\/\?id=/);
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Estratégia do registro', level: 2 })).toBeVisible();
  });

  test('dada uma anotação, quando a pessoa a liga a mais itens, então ela aparece no cartão de cada um e a coluna dela mostra todos', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Reunião com o cliente');
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByText('Esta anotação não está ligada a nenhum item.')).toBeVisible();
    // Quando: liga a uma pessoa e a uma demanda
    await coluna(page).getByRole('button', { name: 'Ligar a outro item' }).click();
    await coluna(page).getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await coluna(page).getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await expect(page.getByText('Ligada a pessoa: JOSÉ DA SILVA TESTE.')).toBeVisible();
    await coluna(page).getByRole('button', { name: 'Ligar a outro item' }).click();
    await coluna(page).getByRole('combobox', { name: 'Tipo de item' }).selectOption('demandas');
    await coluna(page).getByRole('textbox', { name: 'Buscar item para ligar' }).fill('registro de marca');
    await coluna(page).getByRole('button', { name: /Registro de marca/ }).click();
    // Então: a coluna da anotação mostra os dois, com o número
    const ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(coluna(page).getByRole('button', { name: /^Ligada a/ })).toHaveText(/^Ligada a\s*2$/);
    // E a tabela (sem anotação aberta) diz a que ela está ligada
    await fecharAnotacao(page);
    await expect(page.getByRole('row').filter({ hasText: 'Reunião com o cliente' })).toContainText('Pessoas, Demandas');
    // E cada cartão ligado mostra a anotação
    await abrirAnotacao(page, 'Reunião com o cliente');
    await coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /JOSÉ DA SILVA TESTE/ }).click();
    let cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
    cartao = await abrirDemanda(page, 'Registro de marca');
    await abrirSecao(cartao, 'Anotações');
    await expect(cartao.getByRole('link', { name: /Reunião com o cliente/ })).toBeVisible();
    // Quando: desliga a pessoa
    await abrirAnotacao(page, 'Reunião com o cliente');
    await coluna(page).getByRole('button', { name: 'Desligar JOSÉ DA SILVA TESTE' }).click();
    // Então
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(1);
    await fecharAnotacao(page);
    await expect(page.getByRole('row').filter({ hasText: 'Reunião com o cliente' })).toContainText('Demandas');
  });
});

test.describe('Ligar uma anotação que já existe, no cartão de um item (#341)', () => {
  /** O código da anotação que acabou de ser cadastrada, lido do aviso no pé da tela. */
  async function codigoDoAviso(page: Page) {
    const aviso = page.getByText(/Anotação \w+ cadastrada\./);
    await expect(aviso).toBeVisible();
    return /Anotação (\w+) cadastrada\./.exec((await aviso.textContent())!)![1];
  }
  /** Abre o cartão de uma pessoa pela tabela. */
  async function abrirPessoa(page: Page, nome: string) {
    await page.goto('/pessoas/');
    await page.getByRole('row').filter({ hasText: nome }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: nome, level: 2 })).toBeVisible();
    return cartao;
  }
  /** Na seção "Anotações" do cartão: "Ligar anotação existente", busca pelo texto e escolhe a anotação achada. */
  async function ligarExistente(cartao: Locator, texto: string, titulo: string) {
    await abrirSecao(cartao, 'Anotações');
    await cartao.getByRole('button', { name: 'Ligar anotação existente' }).click();
    await cartao.getByRole('textbox', { name: 'Buscar anotação para ligar' }).fill(texto);
    await cartao.getByRole('list', { name: 'Anotações para ligar' }).getByRole('button', { name: new RegExp(titulo) }).click();
  }

  test('dado o cartão de uma pessoa, quando a pessoa liga uma anotação existente achada pelo código, então ela aparece na seção, a anotação mostra a pessoa em "Ligada a", e ela não é oferecida de novo', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Parecer da prescrição');
    const codigo = await codigoDoAviso(page);
    let cartao = await abrirPessoa(page, 'JOSÉ DA SILVA TESTE');
    await abrirSecao(cartao, 'Anotações');
    await expect(cartao.getByRole('link', { name: 'Nova anotação', exact: true })).toBeVisible();
    // Quando
    await ligarExistente(cartao, codigo, 'Parecer da prescrição');
    // Então
    await expect(page.getByText('Anotação ligada: Parecer da prescrição.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
    await cartao.getByRole('list', { name: 'Anotações ligadas' }).getByRole('link', { name: /Parecer da prescrição/ }).click();
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Parecer da prescrição', level: 2 })).toBeVisible();
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toContainText('Pessoa');
    // E, já ligada, ela não aparece de novo na busca do cartão da pessoa
    cartao = await abrirPessoa(page, 'JOSÉ DA SILVA TESTE');
    await abrirSecao(cartao, 'Anotações');
    await cartao.getByRole('button', { name: 'Ligar anotação existente' }).click();
    await cartao.getByRole('textbox', { name: 'Buscar anotação para ligar' }).fill(codigo);
    await expect(cartao.getByText('Nenhuma anotação ativa com esse texto que você possa ligar.')).toBeVisible();
  });

  test('dado o cartão de uma demanda, quando a pessoa busca pelo título e liga, então a busca avisa quem passa a ler, a anotação aparece na seção e mostra a demanda', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Estratégia do depósito');
    const cartao = await abrirDemanda(page, 'Registro de marca');
    await abrirSecao(cartao, 'Anotações');
    await cartao.getByRole('button', { name: 'Ligar anotação existente' }).click();
    await cartao.getByRole('textbox', { name: 'Buscar anotação para ligar' }).fill('estratégia do dep');
    // Então: antes de escolher, a busca diz quem passa a ler a anotação
    await expect(cartao.getByText('Quem vê esta demanda passa a ler a anotação que você ligar, inclusive quem está no contrato dela.')).toBeVisible();
    // Quando
    await cartao.getByRole('list', { name: 'Anotações para ligar' }).getByRole('button', { name: /Estratégia do depósito/ }).click();
    // Então
    await expect(cartao.getByRole('list', { name: 'Anotações ligadas' }).getByRole('link', { name: /Estratégia do depósito/ })).toBeVisible();
    await abrirAnotacao(page, 'Estratégia do depósito');
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /Registro de marca/ })).toContainText('Demanda');
  });

  test('dada uma demanda arquivada, quando a pessoa abre a seção "Anotações" do cartão, então não há como ligar nem criar anotação', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Anotação solta');
    const id = await idDaDemanda(page, 'Registro de marca');
    await page.evaluate(([chave, demanda]) => {
      const bd = JSON.parse(sessionStorage.getItem(chave)!) as { demandas: { id: string; arquivado_em: string | null }[] };
      bd.demandas.find(d => d.id === demanda)!.arquivado_em = new Date().toISOString();
      sessionStorage.setItem(chave, JSON.stringify(bd));
    }, [CHAVE, id]);
    // Quando
    await page.goto('/demandas/?id=' + id);
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Registro de marca', level: 2 })).toBeVisible();
    await abrirSecao(cartao, 'Anotações');
    // Então
    await expect(cartao.getByText('Nenhuma anotação ligada a esta demanda.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Ligar anotação existente' })).toHaveCount(0);
    await expect(cartao.getByRole('link', { name: /^Nova anotação/ })).toHaveCount(0);
  });

  test('dado um contrato em que a conta comum só foi mencionada, quando ela abre a seção "Anotações", então não há como ligar nem criar anotação', async ({ page }) => {
    // Dado: Ana mencionou Bruno num comentário do contrato "Ação de cobrança", que não é dele. O banco fictício recusaria a
    // menção a um estagiário, então ela entra direto na aba (como em visibilidade-contratos.spec.ts).
    await entrarComo(page, 'u-bruno');
    const id = await page.evaluate(chave => {
      const bd = JSON.parse(sessionStorage.getItem(chave)!) as { contratos: { id: string; servico: string }[]; comentarios: unknown[] };
      const contrato = bd.contratos.find(k => k.servico.startsWith('Ação de cobrança'))!.id;
      bd.comentarios.push({ id: 'cm-mencao', modulo: 'contratos', cartao_id: contrato, autor_id: 'u-ana', texto: 'Veja este, @bruno.souza',
        mencoes: ['u-bruno'], criado_em: new Date().toISOString(), editado_em: null });
      sessionStorage.setItem(chave, JSON.stringify(bd));
      return contrato;
    }, CHAVE);
    // Quando
    await page.goto('/contratos/?id=' + id);
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('Você vê este contrato porque foi mencionado num comentário.')).toBeVisible();
    await abrirSecao(cartao, 'Anotações');
    // Então
    await expect(cartao.getByText('Nenhuma anotação ligada a este contrato.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Ligar anotação existente' })).toHaveCount(0);
    await expect(cartao.getByRole('link', { name: /^Nova anotação/ })).toHaveCount(0);
  });
});

test.describe('O texto da anotação', () => {
  // A regra mudou (pedido de 18/11): sem o modo de ler (o livro), o texto formatado é o de quem só lê a anotação.
  test('dada uma anotação com títulos, negrito, itálico, listas e links, quando quem só a lê a abre, então o texto aparece formatado, sem as marcas e sem virar código de página', async ({ page }) => {
    // Dado / Quando
    const anotacao = await abrirComoQuemSoLe(page, 'Plano do caso', [
      '# Objetivo', 'Juntar a **procuração** e o *comprovante*.', '## Passos', '- Pedir o RG', '- Conferir o CPF',
      'Veja [o site do tribunal](https://www.exemplo.jus.br/consulta).', '<script>alert(1)</script> <img src=x onerror=alert(2)>'
    ].join('\n'));
    // Então
    await expect(anotacao.getByRole('heading', { name: 'Objetivo', level: 3 })).toBeVisible();
    await expect(anotacao.getByRole('heading', { name: 'Passos', level: 4 })).toBeVisible();
    await expect(anotacao.locator('strong', { hasText: 'procuração' })).toBeVisible();
    await expect(anotacao.locator('em', { hasText: 'comprovante' })).toBeVisible();
    await expect(anotacao.getByRole('listitem').filter({ hasText: 'Pedir o RG' })).toBeVisible();
    const link = anotacao.getByRole('link', { name: 'o site do tribunal' });
    await expect(link).toHaveAttribute('href', 'https://www.exemplo.jus.br/consulta');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(anotacao.getByText('**procuração**')).toHaveCount(0);
    await expect(anotacao.getByText('# Objetivo')).toHaveCount(0);
    // O que parece código de página aparece como texto
    await expect(anotacao.getByText('<script>alert(1)</script>', { exact: false })).toBeVisible();
    await expect(anotacao.locator('script, img')).toHaveCount(0);
  });
});

test.describe('A página Documentos', () => {
  test('quando a pessoa busca uma palavra, então acha as anotações pelo título e pelo texto, e filtra pelo item ligado, pelo autor e pela data', async ({ page }) => {
    // Dado: uma anotação do Mateus no texto, uma ligada a uma demanda, uma da Ana e uma antiga
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Parecer sobre a ação', { texto: 'O ponto central é a **prescrição**.' });
    await criarAnotacao(page, 'Notas da marca', { endereco: '/documentos/nova/?demanda=' + demanda });
    await entrarComo(page, 'u-ana');
    await criarAnotacao(page, 'Rascunho da Ana');
    await entrarComo(page, 'u-master');
    await criarAnotacao(page, 'Ata antiga');
    // A "Ata antiga" foi escrita há dois meses.
    await page.evaluate(chave => {
      const bd = JSON.parse(sessionStorage.getItem(chave)!) as { anotacoes: { titulo: string; criado_em: string }[] };
      const doisMeses = new Date(); doisMeses.setMonth(doisMeses.getMonth() - 2);
      bd.anotacoes.find(a => a.titulo === 'Ata antiga')!.criado_em = doisMeses.toISOString();
      sessionStorage.setItem(chave, JSON.stringify(bd));
    }, CHAVE);
    await page.goto('/inicio/');
    await abrir(page, 'Documentos');
    await expect(page.getByRole('heading', { name: /Documentos/, level: 1 })).toBeVisible();
    await expect(titulosNaTabela(page)).toHaveCount(4);

    // Quando: busca uma palavra do texto
    await page.getByRole('searchbox').fill('prescricao');
    // Então: a tabela e o explorador mostram só ela
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('Parecer sobre a ação');
    // (na árvore: a barra do explorador também tem um link, o "Nova anotação", só de ícone)
    await expect(page.getByRole('navigation', { name: 'Pastas e anotações' }).getByRole('list').first().getByRole('link')).toHaveText(['Parecer sobre a ação']);
    // Quando: busca pelo título
    await page.getByRole('searchbox').fill('rascunho');
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('Rascunho da Ana');
    await page.getByRole('searchbox').fill('');
    await expect(titulosNaTabela(page)).toHaveCount(4);

    const filtros = page.getByRole('dialog', { name: 'Filtros' });
    // Quando: só as ligadas a demandas
    await page.getByRole('button', { name: 'Filtros' }).click();
    await filtros.getByLabel('Ligada a').selectOption({ label: 'Demandas' });
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('Notas da marca');
    // Quando: as que não estão ligadas a nada, escritas pela Ana
    await filtros.getByLabel('Ligada a').selectOption({ label: 'Nenhum item' });
    await filtros.getByLabel('Autor').selectOption({ label: 'Ana Teste Lima' });
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('Rascunho da Ana');
    // Quando: qualquer autor, dos últimos 30 dias
    await filtros.getByLabel('Autor').selectOption({ label: 'Qualquer pessoa' });
    await filtros.getByLabel('Ligada a').selectOption({ label: 'Qualquer item' });
    await filtros.getByLabel('Data').selectOption({ label: 'Últimos 30 dias' });
    // Então: a ata antiga fica de fora
    await expect(titulosNaTabela(page)).toHaveCount(3);
    await expect(page.getByRole('row').filter({ hasText: 'Ata antiga' })).toHaveCount(0);
    // Quando: dos últimos 12 meses
    await filtros.getByLabel('Data').selectOption({ label: 'Últimos 12 meses' });
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(4);
  });

  test('dado um usuário comum, quando abre Documentos, então vê só as anotações que criou, as compartilhadas com ele e as dos itens a que tem acesso, e estas só para ler', async ({ page }) => {
    // Dado: o Mateus escreve uma só para ele, uma compartilhada com o Bruno e uma ligada a uma demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Só do Mateus');
    await criarAnotacao(page, 'Para o Bruno', { compartilharCom: 'Bruno Exemplo Souza' });
    await criarAnotacao(page, 'Da demanda do Bruno', { endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    await entrarComo(page, 'u-bruno');
    await abrir(page, 'Documentos');
    await expect(page.getByRole('heading', { name: /Documentos/, level: 1 })).toBeVisible();
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(2);
    await expect(page.getByRole('row').filter({ hasText: 'Para o Bruno' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Da demanda do Bruno' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Só do Mateus' })).toHaveCount(0);
    // Quem vê só pela demanda lê, mas não muda nem liga nada
    let anotacao = await abrirAnotacao(page, 'Da demanda do Bruno');
    await expect(anotacao.getByText('Você vê esta anotação porque vê um item ligado a ela.', { exact: false })).toBeVisible();
    await anotacao.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menuitem', { name: 'Arquivar' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByRole('button', { name: 'Ligar a outro item' })).toHaveCount(0);
    // Mas comenta, como nos outros cartões: quem vê comenta (#364)
    await comentar(page, 'Li e concordo.');
    // Já a compartilhada com ele, ele altera
    anotacao = await abrirAnotacao(page, 'Para o Bruno');
    await anotacao.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menuitem', { name: 'Arquivar' })).toBeVisible();
    await page.keyboard.press('Escape');
    // E pelo endereço, a anotação alheia não abre
    const so = await page.evaluate(chave => (JSON.parse(sessionStorage.getItem(chave)!) as { anotacoes: { id: string; titulo: string }[] })
      .anotacoes.find(a => a.titulo === 'Só do Mateus')!.id, CHAVE);
    await page.goto('/documentos/?id=' + so);
    await expect(page.getByText('Esta anotação não foi encontrada.', { exact: false })).toBeVisible();
  });
});

test.describe('A página Documentos como o Obsidian (pedido de 18/11)', () => {
  // A regra mudou (pedido de 18/11): a anotação voltou à janela do cartão, como os outros cartões, e não abre mais no meio da página.
  test('dada uma anotação num computador, quando a pessoa a abre pelo explorador, então ela abre na janela do cartão, ao lado, com o ícone de etiqueta no topo, o texto para escrever e as seções embaixo dele', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    await criarAnotacao(page, 'Parecer sobre o registro', { texto: 'Um texto para ler e escrever.' });
    await fecharAnotacao(page);
    const explorador = page.getByRole('navigation', { name: 'Pastas e anotações' });
    // Quando
    await explorador.getByRole('link', { name: 'Parecer sobre o registro' }).click();
    // Então: na janela do cartão, com o endereço guardando qual está aberta
    const janela = anotacaoAberta(page);
    const anotacao = janela.getByRole('article', { name: /^Anotação / });
    await expect(anotacao.getByRole('heading', { name: 'Parecer sobre o registro', level: 2 })).toBeVisible();
    await expect(page).toHaveURL(/\/documentos\/\?id=/);
    await expect(explorador.getByRole('link', { name: 'Parecer sobre o registro' })).toHaveAttribute('aria-current', 'page');
    await expect(janela.getByRole('button', { name: 'Abrir no centro da tela' })).toBeVisible();
    // O texto já está na caixa de escrever, sem o lápis nem o livro; no topo, só o ícone de etiqueta: sem a seção "Etiquetas" e,
    // sem etiquetas, sem a linha dos selos (a regra mudou no pedido de 18/11)
    const texto = anotacao.getByRole('textbox', { name: 'Texto', exact: true });
    await expect(texto).toHaveText('Um texto para ler e escrever.');
    await expect(janela.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(janela.getByRole('button', { name: 'Modo de leitura' })).toHaveCount(0);
    await expect(janela.getByRole('button', { name: 'Etiquetas', exact: true })).toBeVisible();
    await expect(anotacao.getByRole('group', { name: 'Etiquetas' })).toHaveCount(0);
    await expect(anotacao.getByRole('region', { name: 'Etiquetas' })).toHaveCount(0);
    await expect(anotacao.getByText('Nenhuma etiqueta.')).toHaveCount(0);
    const [titulo, caixa] = [(await anotacao.getByRole('heading', { level: 2 }).boundingBox())!, (await texto.boundingBox())!];
    expect(titulo.y + titulo.height).toBeLessThanOrEqual(caixa.y);
    // Ao lado, as seções ficam embaixo do texto, na ordem: "Comentários" (aberta), "Ligada a" e "Histórico de alterações" (recolhidas)
    const secoes = janela.getByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });
    await expect(secoes).toHaveText([/^Comentários\s*0$/, /^Ligada a\s*0$/, /^Histórico de alterações\s*\d+$/]);
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'false');
    expect((await secoes.nth(0).boundingBox())!.y).toBeGreaterThan(caixa.y + caixa.height);
    // E o topo numa linha só: o caminho (aqui, "Sem pasta") e a equipe
    const [pasta, equipe] = [(await anotacao.getByRole('button', { name: 'Escolher a pasta' }).boundingBox())!,
      (await anotacao.getByRole('group', { name: 'Equipe' }).boundingBox())!];
    expect(Math.abs((pasta.y + pasta.height / 2) - (equipe.y + equipe.height / 2))).toBeLessThan(8);
  });

  test('dada uma anotação aberta ao lado, quando a pessoa escolhe abrir no centro, então as seções vão para a coluna da direita da janela, com "Expandir tudo" no topo, que abre e recolhe todas', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    const janela = await criarAnotacao(page, 'Anotação no centro', { texto: 'Um texto.' });
    // Quando
    await janela.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Então: as seções ficam à direita do texto
    const texto = (await janela.getByRole('textbox', { name: 'Texto', exact: true }).boundingBox())!;
    const secoes = janela.getByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });
    expect((await secoes.nth(0).boundingBox())!.x).toBeGreaterThan(texto.x + texto.width);
    // Quando: "Expandir tudo", acima de "Comentários"
    const expandir = janela.getByRole('button', { name: 'Expandir tudo' });
    expect((await expandir.boundingBox())!.y).toBeLessThan((await secoes.nth(0).boundingBox())!.y);
    await expandir.click();
    // Então
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'true');
    // Quando
    await janela.getByRole('button', { name: 'Recolher tudo' }).click();
    // Então: todas recolhem, os comentários também
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'false');
    // E a janela no centro continua na próxima anotação aberta (a escolha vale para todos os cartões)
    await page.reload();
    await expect(anotacaoAberta(page).getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
  });

  test('dada a página Documentos num computador, quando a pessoa recolhe a navegação, então a árvore some e a tabela ocupa a largura toda; a escolha continua ao voltar', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    await criarAnotacao(page, 'Para a tabela larga');
    await fecharAnotacao(page);
    const explorador = page.getByRole('navigation', { name: 'Pastas e anotações' });
    const antes = (await page.getByRole('table').boundingBox())!;
    // Quando
    await explorador.getByRole('button', { name: 'Recolher a navegação' }).click();
    // Então
    await expect(explorador.getByRole('button', { name: 'Todos os documentos' })).toBeHidden();
    await expect(explorador.getByRole('link', { name: 'Para a tabela larga' })).toBeHidden();
    const depois = (await page.getByRole('table').boundingBox())!;
    expect(depois.x).toBeLessThan(antes.x);
    expect(depois.width).toBeGreaterThan(antes.width);
    // E a escolha continua ao voltar à página
    await page.goto('/inicio/');
    await abrir(page, 'Documentos');
    const mostrar = page.getByRole('navigation', { name: 'Pastas e anotações' }).getByRole('button', { name: 'Mostrar a navegação' });
    await expect(mostrar).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await mostrar.click();
    // Então
    await expect(explorador.getByRole('link', { name: 'Para a tabela larga' })).toBeVisible();
  });

  test('dada uma anotação, quando a pessoa comenta e chama alguém com @, então o comentário aparece no topo da coluna, com o número, e só quem está na anotação pode ser chamado (#364)', async ({ page }) => {
    // Dado: uma anotação do Mateus, sem mais ninguém (a Ana é administradora e vê todas; o Bruno não está nela)
    await criarAnotacao(page, 'Anotação para comentar');
    const caixa = coluna(page).getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando: começa a chamar alguém
    await caixa.fill('Veja isto, @');
    // Então
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toContainText('não participa');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
    // Quando: comenta chamando a Ana
    await caixa.press('Escape');
    // (com mais texto depois da menção, como em mensagens.spec.ts: terminado em "@ana.lima", a lista do @ segue aberta por cima do botão)
    await comentar(page, 'Veja isto, @ana.lima até amanhã');
    // Então: a seção conta o comentário, e ele continua lá ao reabrir a anotação
    await expect(coluna(page).getByRole('button', { name: /^Comentários/ })).toHaveText(/^Comentários\s*1$/);
    await abrirAnotacao(page, 'Anotação para comentar');
    await expect(coluna(page).getByRole('list', { name: 'Comentários do cartão' }).getByText('Veja isto, @ana.lima até amanhã')).toBeVisible();
  });

  test('dado o texto mudado, quando a pessoa para de digitar, então ele é salvo sozinho, e continua assim ao reabrir', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Notas do caso', { texto: 'Primeira linha.' });
    const caixa = anotacao.getByRole('textbox', { name: 'Texto', exact: true });
    // Quando
    await porNoTexto(caixa, 'Primeira linha.\n- [ ] Ligar ao cliente');
    // Então: sem botão de salvar, a linha discreta diz que salvou
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    await expect(anotacao.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
    // E continua assim ao reabrir (guardado em Markdown); a caixinha aparece já no editor
    expect(await textoGuardado(page, 'Notas do caso')).toBe('Primeira linha.\n- [ ] Ligar ao cliente');
    const reaberta = await abrirAnotacao(page, 'Notas do caso');
    await expect(caixaDoTexto(reaberta).getByRole('checkbox', { name: 'Ligar ao cliente' })).not.toBeChecked();
  });

  test('quando a pessoa escreve, então a formatação aparece enquanto ela escreve, como no Obsidian, e o texto é guardado em Markdown (#364)', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Escrita ao vivo');
    const caixa = caixaDoTexto(anotacao);
    // Quando: escreve um título, um negrito pelo Ctrl+B, uma lista (o Enter já começa o item seguinte) e uma caixinha
    await caixa.click();
    await page.keyboard.type('## Pendências');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Levar o ');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('RG');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Procuração');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Comprovante');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');   // no item vazio, o Enter acaba a lista (a linha fica sem o "- ")
    await page.keyboard.type('- [ ] Ligar ao cliente');
    // Então: na linha do cursor, os sinais aparecem para editar
    await expect(caixa).toContainText('- [ ] Ligar ao cliente');
    // Então: nas outras linhas, os sinais somem e o texto aparece formatado
    await expect(caixa).toContainText('PendênciasLevar o RG');
    await expect(caixa).not.toContainText('**');
    await expect(caixa).not.toContainText('## ');
    await expect(caixa.getByText('RG', { exact: true })).toHaveCSS('font-weight', '800');
    // E o texto guardado é o Markdown de sempre
    await caixa.press('ControlOrMeta+s');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    await expect.poll(() => textoGuardado(page, 'Escrita ao vivo')).toBe('## Pendências\nLevar o **RG**\n- Procuração\n- Comprovante\n- [ ] Ligar ao cliente');
    // Quando: a pessoa sai do texto, e marca a caixinha com um clique
    await caixa.blur();
    await caixa.getByRole('checkbox', { name: 'Ligar ao cliente' }).click();
    // Então
    await expect(caixa.getByRole('checkbox', { name: 'Ligar ao cliente' })).toBeChecked();
    await expect(caixa).not.toContainText('- [');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    await expect.poll(() => textoGuardado(page, 'Escrita ao vivo')).toContain('- [x] Ligar ao cliente');
  });

  // A regra mudou (pedido de 18/11): o livro (o modo de ler) saiu; a formatação já aparece enquanto se escreve.
  test('quando a pessoa abre uma anotação, então não há o livro: o texto já aparece formatado na caixa de escrever, sem um modo de ler à parte', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Sem livro', { texto: 'Levar o **RG**.' });
    // Quando
    const anotacao = await abrirAnotacao(page, 'Sem livro');
    // Então
    const caixa = caixaDoTexto(anotacao);
    await expect(caixa.getByText('RG', { exact: true })).toHaveCSS('font-weight', '800');
    await expect(anotacao.getByRole('button', { name: 'Modo de leitura' })).toHaveCount(0);
  });

  test('dado o texto mudado, quando a pessoa fecha a janela da anotação logo depois de escrever, então ele é gravado antes, sem perguntar', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Rascunho importante', { texto: 'Começo.' });
    await porNoTexto(caixaDoTexto(anotacao), 'Começo. E uma ideia que não pode se perder.');
    // Quando
    await fecharAnotacao(page);
    // Então
    await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
    await expect(anotacaoAberta(page)).toHaveCount(0);
    const reaberta = await abrirAnotacao(page, 'Rascunho importante');
    await expect(caixaDoTexto(reaberta)).toHaveText('Começo. E uma ideia que não pode se perder.');
  });

  test('dada a anotação num celular, quando a pessoa abre a gaveta do explorador e escolhe outra anotação, então ela abre na janela e a gaveta fecha, e os comentários e "Ligada a" ficam embaixo do texto', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Primeira do celular');
    await criarAnotacao(page, 'Segunda do celular', { texto: 'Texto da segunda.' });
    await fecharAnotacao(page);
    await page.setViewportSize({ width: 375, height: 812 });
    const explorador = page.getByRole('navigation', { name: 'Pastas e anotações' });
    await expect(explorador).toBeHidden();
    // Quando
    const gaveta = page.getByRole('button', { name: 'Pastas e anotações' });
    await gaveta.click();
    await expect(gaveta).toHaveAttribute('aria-expanded', 'true');
    // (no celular, com a gaveta aberta, a árvore aparece, mas o botão de recolher a navegação não: a gaveta já faz esse papel)
    await expect(explorador.getByRole('link', { name: 'Primeira do celular' })).toBeVisible();
    await expect(explorador.getByRole('button', { name: 'Recolher a navegação' })).toBeHidden();
    await explorador.getByRole('link', { name: 'Primeira do celular' }).click();
    // Então
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Primeira do celular', level: 2 })).toBeVisible();
    await expect(explorador).toBeHidden();
    const texto = (await anotacaoAberta(page).getByRole('textbox', { name: 'Texto', exact: true }).boundingBox())!;
    const comentarios = (await coluna(page).getByRole('button', { name: /^Comentários/ }).boundingBox())!;
    const ligada = (await coluna(page).getByRole('button', { name: /^Ligada a/ }).boundingBox())!;
    // Os comentários vêm primeiro, logo embaixo do texto, e "Ligada a" depois deles (#364)
    expect(comentarios.y).toBeGreaterThan(texto.y + texto.height);
    expect(ligada.y).toBeGreaterThan(comentarios.y);
    // E a página não rola de lado
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

/** Liga a chave "equipe_ve_tudo" do escritório fictício. */
const equipeVeTudo = (page: Page) => page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));

test.describe('A anotação nos casos de canto', () => {
  test('dado um endereço de anotação nova com um item que não existe mais, quando a pessoa salva, então a anotação é cadastrada sem ligação, como o aviso promete', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/?demanda=demanda-que-nao-existe');
    // (a nota pode ser ligada a outros itens antes de salvar: o aviso fala só do item de onde se veio)
    await expect(page.getByText('O item de onde você veio não foi encontrado. A anotação será salva sem ligação a ele.')).toBeVisible();
    // Quando
    await page.getByRole('textbox', { name: 'Título' }).fill('Sem a demanda');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então
    await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByText('Esta anotação não está ligada a nenhum item.')).toBeVisible();
  });

  test('dada uma anotação com texto, quando a pessoa muda o texto, então o histórico diz só "Texto alterado"', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Texto que muda', { texto: 'Primeira versão' });
    // Quando: o texto já está na caixa; Ctrl+S grava na hora
    const caixa = anotacao.getByRole('textbox', { name: 'Texto', exact: true });
    await porNoTexto(caixa, 'Segunda versão');
    await caixa.press('Control+s');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    // Então
    await abrirSecao(coluna(page), 'Histórico de alterações');
    const historico = coluna(page).getByRole('list').filter({ hasText: 'Texto' }).last();
    await expect(historico).toContainText('Texto alterado');
    await expect(historico).not.toContainText('alterado → alterado');
  });

  test('dada a chave "equipe_ve_tudo", quando um usuário comum abre a anotação de outra pessoa sem item ligado, então a nota diz que ele a vê pela equipe, e não por um item', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Vista pela equipe');
    await equipeVeTudo(page);
    // Quando
    await entrarComo(page, 'u-bruno');
    const anotacao = await abrirAnotacao(page, 'Vista pela equipe');
    // Então
    await expect(anotacao.getByText('Toda a equipe vê as anotações do escritório', { exact: false })).toBeVisible();
    await expect(anotacao.getByText('porque vê um item ligado', { exact: false })).toHaveCount(0);
  });

  test('dada uma anotação sem texto, quando é arquivada pelo ⋯, então não há mais caixa de escrever, e clicar no "Sem texto ainda." não abre nada', async ({ page }) => {
    // Dado: ativa, a caixa de escrever já está ali, vazia
    const anotacao = await criarAnotacao(page, 'Vazia e arquivada');
    await expect(caixaDoTexto(anotacao)).toBeVisible();
    expect(await textoGuardado(page, 'Vazia e arquivada')).toBe('');
    // Quando
    await noMenu(page, anotacao, 'Arquivar');
    // Então
    await expect(anotacao.getByText('Anotação arquivada.', { exact: false }).first()).toBeVisible();
    await expect(anotacao.getByText('Sem texto ainda.', { exact: true })).toBeVisible();
    await expect(anotacao.getByRole('textbox', { name: 'Texto', exact: true })).toHaveCount(0);
    await expect(anotacao.getByRole('button', { name: 'Etiquetas', exact: true })).toHaveCount(0);
    await anotacao.getByText('Sem texto ainda.', { exact: true }).click();
    await expect(anotacao.getByRole('textbox', { name: 'Texto', exact: true })).toHaveCount(0);
  });

  test('dado o modo escuro, quando a pessoa marca anotações na tabela, então o "limpar" da barra se lê sobre o fundo escuro dela', async ({ page }) => {
    // Dado
    await page.emulateMedia({ colorScheme: 'dark' });
    await criarAnotacao(page, 'Para marcar');
    await page.goto('/documentos/');
    // Quando
    await page.getByRole('row').filter({ hasText: 'Para marcar' }).getByRole('checkbox').check();
    // Então: o contraste do texto com o fundo da barra passa do mínimo para texto (4,5:1)
    const contraste = await page.getByRole('button', { name: 'limpar' }).evaluate(el => {
      const luz = (cor: string) => {
        const [r, g, b] = (cor.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number).map(c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      let fundo: Element | null = el;
      while (fundo && ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(fundo).backgroundColor)) fundo = fundo.parentElement;
      const [a, b] = [luz(getComputedStyle(el).color), luz(getComputedStyle(fundo!).backgroundColor)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    expect(contraste).toBeGreaterThanOrEqual(4.5);
  });

  // A regra mudou (pedido de 18/11): a anotação não tem mais o lápis; quem está nela sai clicando na própria bolinha.
  test('dado um usuário comum com quem a anotação foi compartilhada, quando ele clica na própria bolinha e confirma, então sai de verdade e a saída fica no histórico', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Para o Bruno sair', { compartilharCom: 'Bruno Exemplo Souza' });
    await entrarComo(page, 'u-bruno');
    const anotacao = await abrirAnotacao(page, 'Para o Bruno sair');
    // Quando
    await anotacao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Sair da anotação (Bruno Exemplo Souza)' }).click();
    const confirmacao = page.getByRole('dialog', { name: 'Sair da anotação?' });
    await confirmacao.getByRole('button', { name: 'Sair da anotação' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Você saiu da anotação, e a saída ficou no histórico.' })).toBeVisible();
    await page.goto('/documentos/');
    await expect(page.getByRole('row').filter({ hasText: 'Para o Bruno sair' })).toHaveCount(0);
    await entrarComo(page, 'u-master');
    await abrirAnotacao(page, 'Para o Bruno sair');
    await abrirSecao(coluna(page), 'Histórico de alterações');
    await expect(coluna(page).getByText(/Compartilhada com/).last()).toBeVisible();
  });
});

test.describe('O texto da anotação com o Markdown completo (#344)', () => {
  // A regra mudou (pedido de 18/11): sem o modo de ler (o livro), a caixinha se marca no próprio editor e é salva sozinha.
  test('dada uma anotação com "- [ ] item", quando a pessoa clica na caixinha no editor, então ela fica marcada, é salva sozinha e continua marcada ao reabrir', async ({ page }) => {
    // Dado
    let anotacao = await criarAnotacao(page, 'Lista do protocolo', { texto: 'Levar:\n- [ ] Procuração\n- [x] Comprovante' });
    const caixa = caixaDoTexto(anotacao);
    await caixa.blur();
    const procuracao = caixa.getByRole('checkbox', { name: 'Procuração' });
    await expect(procuracao).not.toBeChecked();
    await expect(caixa.getByRole('checkbox', { name: 'Comprovante' })).toBeChecked();
    // Quando
    await procuracao.click();
    // Então: marcada, e o texto guardado muda junto, como o resto do texto
    await expect(procuracao).toBeChecked();
    await expect.poll(() => textoGuardado(page, 'Lista do protocolo')).toBe('Levar:\n- [x] Procuração\n- [x] Comprovante');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    // Quando: reabre a anotação
    anotacao = await abrirAnotacao(page, 'Lista do protocolo');
    // Então
    await expect(caixaDoTexto(anotacao).getByRole('checkbox', { name: 'Procuração' })).toBeChecked();
    await expect(caixaDoTexto(anotacao).getByRole('checkbox', { name: 'Comprovante' })).toBeChecked();
  });

  test('dada uma anotação com caixinhas, quando quem só a lê a abre, então as caixinhas aparecem, mas não se marcam', async ({ page }) => {
    // Dado: o Mateus escreve uma anotação ligada a uma demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Conferência do registro', { texto: '- [ ] Ver o INPI', endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    await entrarComo(page, 'u-bruno');
    const anotacao = await abrirAnotacao(page, 'Conferência do registro');
    // Então: quem só lê vê sempre o texto formatado
    const caixinha = anotacao.getByRole('checkbox', { name: 'Ver o INPI' });
    await expect(caixinha).toBeDisabled();
    await expect(caixinha).not.toBeChecked();
  });

  // A regra mudou (pedido de 18/11): sem o modo de ler (o livro), o texto formatado é o de quem só lê a anotação.
  test('dada uma anotação com lista numerada, citação, tachado, código, divisória e tabela, quando quem só a lê a abre, então vê cada um formatado, sem as marcas', async ({ page }) => {
    // Dado / Quando
    await abrirComoQuemSoLe(page, 'Resumo da audiência', [
      '1. Abertura', '2. Depoimentos', '> O juiz disse que ~~não~~ vai decidir hoje.', '---', 'Comando: `**não** é negrito`',
      '```', '<script>alert(1)</script>', '```', '| Parte | Valor |', '|---|--:|', '| Autor | R$ 10 |'
    ].join('\n'));
    // Então
    const artigo = page.getByRole('article', { name: /^Anotação / });
    await expect(artigo.getByRole('list').filter({ hasText: 'Abertura' }).getByRole('listitem')).toHaveText(['Abertura', 'Depoimentos']);
    await expect(artigo.locator('blockquote')).toHaveText('O juiz disse que não vai decidir hoje.');
    await expect(artigo.locator('del', { hasText: 'não' })).toBeVisible();
    await expect(artigo.getByRole('separator')).toBeVisible();
    await expect(artigo.locator('code', { hasText: '**não** é negrito' })).toBeVisible();
    await expect(artigo.locator('pre')).toHaveText('<script>alert(1)</script>');
    await expect(artigo.locator('script')).toHaveCount(0);
    const tabela = artigo.getByRole('table');
    await expect(tabela.getByRole('columnheader')).toHaveText(['Parte', 'Valor']);
    await expect(tabela.getByRole('cell')).toHaveText(['Autor', 'R$ 10']);
    await expect(artigo.getByText('|---|')).toHaveCount(0);
  });
});

/** Escolhe "Baixar .md" no menu ⋯ da anotação e devolve o nome e o conteúdo do arquivo baixado. */
async function baixarMd(page: Page, anotacao: Locator) {
  const baixando = page.waitForEvent('download');
  await noMenu(page, anotacao, 'Baixar .md');
  const download = await baixando;
  const conteudo = Buffer.concat(await (await download.createReadStream()).toArray()).toString('utf8');
  return { nome: download.suggestedFilename(), conteudo };
}

test.describe('Baixar a anotação em .md (#345)', () => {
  test('dada uma anotação, quando a pessoa escolhe "Baixar .md" no ⋯, então baixa um arquivo com o nome do título e, no topo, as propriedades; depois, o título e o texto como foram escritos', async ({ page }) => {
    // Dado: uma anotação ligada a uma demanda
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    const texto = 'Levar:\n- [ ] Procuração\n\n---\n\n**Atenção:** prazo "fatal".';
    const anotacao = await criarAnotacao(page, 'Reunião: cliente', { texto, endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    const { nome, conteudo } = await baixarMd(page, anotacao);
    // Então
    expect(nome).toBe('Reunião cliente.md');
    const [, propriedades] = conteudo.split(/^---$/m);
    expect(propriedades).toMatch(/^codigo: \S+$/m);
    expect(propriedades).toMatch(/^criada: \d{4}-\d{2}-\d{2}T[\d:]+Z$/m);
    expect(propriedades).toMatch(/^responsavel: /m);
    expect(propriedades).toContain('ligada_a:\n  - "Demanda · ');
    expect(propriedades).toContain('Registro de marca');
    expect(conteudo.endsWith('\n# Reunião: cliente\n\n' + texto)).toBe(true);
  });

  test('dada uma anotação que a pessoa só lê, quando a abre, então também pode baixá-la, sem as ações de mudar', async ({ page }) => {
    // Dado: o Mateus escreve uma anotação ligada a uma demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Estratégia da marca', { texto: 'Pedir o registro.', endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    await entrarComo(page, 'u-bruno');
    const anotacao = await abrirAnotacao(page, 'Estratégia da marca');
    // Então
    await anotacao.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(['Duplicar', 'Baixar .md']);
    await page.keyboard.press('Escape');
    const { nome, conteudo } = await baixarMd(page, anotacao);
    expect(nome).toBe('Estratégia da marca.md');
    expect(conteudo).toContain('\n# Estratégia da marca\n\nPedir o registro.');
  });
});

test.describe('Duplicar a anotação (#343)', () => {
  test('dada uma anotação ligada a dois itens e já alterada, quando a pessoa usa "Duplicar", então abre a cópia com "(cópia)" no título, o mesmo texto, os dois itens e histórico próprio, e a original continua igual', async ({ page }) => {
    // Dado: uma anotação ligada a uma demanda e a uma pessoa, com uma caixinha marcada (uma alteração no histórico)
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    let anotacao = await criarAnotacao(page, 'Plano da audiência', { texto: 'Levar:\n- [ ] A **procuração**', endereco: '/documentos/nova/?demanda=' + demanda });
    await abrirSecao(coluna(page), 'Ligada a');
    await coluna(page).getByRole('button', { name: 'Ligar a outro item' }).click();
    await coluna(page).getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await coluna(page).getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(2);
    // (a caixinha se marca no próprio editor e é salva sozinha, como o resto do texto)
    const caixa = caixaDoTexto(anotacao);
    await caixa.blur();
    await caixa.getByRole('checkbox', { name: /procuração/ }).click();
    await expect.poll(() => textoGuardado(page, 'Plano da audiência')).toBe('Levar:\n- [x] A **procuração**');
    const historico = () => coluna(page).getByRole('button', { name: /^Histórico de alterações/ });
    // Quando
    await noMenu(page, anotacao, 'Duplicar');
    // Então: o aviso diz de qual para qual, e abre a cópia, com o texto gravado e sem histórico
    const aviso = page.getByText(/Anotação \w+ duplicada como \w+\./);
    await expect(aviso).toBeVisible();
    const [, codigoDaOriginal, codigoDaCopia] = /Anotação (\w+) duplicada como (\w+)\./.exec((await aviso.textContent())!)!;
    expect(codigoDaCopia).not.toBe(codigoDaOriginal);
    anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Plano da audiência (cópia)', level: 2 })).toBeVisible();
    await expect(anotacao.getByText(codigoDaCopia, { exact: true })).toBeVisible();
    await expect(anotacao.getByText('procuração', { exact: true })).toBeVisible();
    await expect(anotacao.getByRole('checkbox', { name: /procuração/ })).toBeChecked();
    await expect(historico()).toHaveText(/^Histórico de alterações\s*0$/);
    await abrirSecao(coluna(page), 'Ligada a');
    let ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(ligados.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(ligados.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    // E a original continua igual, com o código e o histórico dela
    await page.goto('/documentos/');
    await expect(titulosNaTabela(page).filter({ hasText: 'Plano da audiência' })).toHaveCount(2);
    await titulosNaTabela(page).filter({ hasText: 'Plano da audiência' }).filter({ hasNotText: '(cópia)' }).click();
    anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Plano da audiência', exact: true, level: 2 })).toBeVisible();
    await expect(anotacao.getByText(codigoDaOriginal, { exact: true })).toBeVisible();
    await expect(anotacao.getByRole('checkbox', { name: /procuração/ })).toBeChecked();
    await abrirSecao(coluna(page), 'Ligada a');
    ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(historico()).toHaveText(/^Histórico de alterações\s*1$/);
  });

  test('dada uma anotação que a pessoa só lê, ligada a um item que ela não vê, quando duplica, então a cópia é dela e leva só o item que ela vê', async ({ page }) => {
    // Dado: o Mateus liga a anotação à demanda em que o Bruno está e a outra, em que ele não está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    let anotacao = await criarAnotacao(page, 'Roteiro do registro', { texto: 'Conferir a classe.', endereco: '/documentos/nova/?demanda=' + demanda });
    await abrirSecao(coluna(page), 'Ligada a');
    await coluna(page).getByRole('button', { name: 'Ligar a outro item' }).click();
    await coluna(page).getByRole('combobox', { name: 'Tipo de item' }).selectOption('demandas');
    await coluna(page).getByRole('textbox', { name: 'Buscar item para ligar' }).fill('busca de anterioridade');
    await coluna(page).getByRole('button', { name: /Busca de anterioridade/ }).click();
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(2);
    await entrarComo(page, 'u-bruno');
    anotacao = await abrirAnotacao(page, 'Roteiro do registro');
    await abrirSecao(coluna(page), 'Ligada a');
    await expect(coluna(page).getByText('Há 1 item ligado aqui que você não tem acesso para abrir.')).toBeVisible();
    await expect(anotacao.getByRole('textbox', { name: 'Texto', exact: true })).toHaveCount(0);
    // Quando
    await noMenu(page, anotacao, 'Duplicar');
    // Então: a cópia abre, o Bruno pode mudá-la (o texto já vem na caixa), é o responsável e só a demanda dele foi junto
    await expect(page.getByText(/Anotação \w+ duplicada como \w+\./)).toBeVisible();
    anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Roteiro do registro (cópia)', level: 2 })).toBeVisible();
    await expect(caixaDoTexto(anotacao)).toHaveText('Conferir a classe.');
    await expect(anotacao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: /, Responsável\. Trocar o responsável$/ })).toHaveAccessibleName(/^Bruno/);
    await abrirSecao(coluna(page), 'Ligada a');
    const ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(1);
    await expect(ligados.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(coluna(page).getByText(/que você não tem acesso para abrir/)).toHaveCount(0);
  });
});

test.describe('Criar e editar a anotação no próprio lugar, como no Obsidian (#339)', () => {
  test('dada a página Documentos, quando a pessoa cria uma anotação, escreve título e texto e a liga a dois itens antes de salvar, então ela nasce ligada aos dois', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    // Quando: abre a nota em branco na janela do cadastro, com o cursor no título e sem campos com rótulo repetindo o título
    await novaAnotacao(page).click();
    const nota = notaNova(page);
    const titulo = nota.getByRole('textbox', { name: 'Título' });
    await expect(titulo).toBeFocused();
    await expect(titulo).toHaveAttribute('placeholder', 'Sem título');
    await expect(nota.getByText('Título', { exact: true })).toHaveCount(0);
    await expect(nota.getByText('Texto', { exact: true })).toHaveCount(0);
    await page.keyboard.type('Reunião de abertura');
    await page.keyboard.press('Enter');   // o Enter no título desce para o texto
    await expect(nota.getByRole('textbox', { name: 'Texto', exact: true })).toBeFocused();
    await page.keyboard.type('Pauta: **prazos** e documentos.');
    // Quando: liga a uma pessoa e a uma demanda, ainda sem salvar ("Ligada a", embaixo do texto)
    await nota.getByRole('button', { name: 'Ligar a um item' }).click();
    await nota.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await nota.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await nota.getByRole('button', { name: 'Ligar a outro item' }).click();
    await nota.getByRole('combobox', { name: 'Tipo de item' }).selectOption('demandas');
    await nota.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('registro de marca');
    await nota.getByRole('button', { name: /Registro de marca/ }).click();
    const escolhidos = nota.getByRole('list', { name: 'Itens ligados' });
    await expect(escolhidos.getByRole('listitem')).toHaveCount(2);
    // (os itens escolhidos não abrem o cartão deles: a nota ainda não foi salva)
    await expect(escolhidos.getByRole('link')).toHaveCount(0);
    // Quando: salva pelo atalho
    await page.keyboard.press('Control+Enter');
    // Então: a anotação abre na janela do cartão, com o texto e os dois itens em "Ligada a"
    await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
    const anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Reunião de abertura', level: 2 })).toBeVisible();
    await expect(caixaDoTexto(anotacao)).toHaveText('Pauta: prazos e documentos.');
    expect(await textoGuardado(page, 'Reunião de abertura')).toBe('Pauta: **prazos** e documentos.');
    await abrirSecao(coluna(page), 'Ligada a');
    const ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(ligados.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    await expect(ligados.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
  });

  test('dada uma anotação nova com itens escolhidos, quando a pessoa tira um antes de salvar, então ela nasce ligada só ao que ficou', async ({ page }) => {
    // Dado: vinda da demanda, que já está na lista
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await page.goto('/documentos/nova/?demanda=' + demanda);
    const nota = notaNova(page);
    await nota.getByRole('button', { name: 'Ligar a outro item' }).click();
    await nota.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await nota.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await expect(nota.getByRole('list', { name: 'Itens ligados' }).getByRole('listitem')).toHaveCount(2);
    // Quando
    await nota.getByRole('button', { name: 'Tirar Registro de marca' }).click();
    await page.getByRole('textbox', { name: 'Título' }).fill('Só da pessoa');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Só da pessoa', level: 2 })).toBeVisible();
    await abrirSecao(coluna(page), 'Ligada a');
    const ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(1);
    await expect(ligados.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
  });

  test('dada uma anotação aberta por quem a altera, quando a pessoa clica no título, muda e aperta Enter, então o título muda ali mesmo e aparece uma vez só, sem formulário nem lápis', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Título antigo', { texto: 'Um texto.' });
    // Quando
    await anotacao.getByRole('button', { name: 'Título antigo' }).click();
    // Então: o título vira campo no próprio lugar, e não há outro título nem formulário
    const campo = anotacao.getByRole('textbox', { name: 'Título' });
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue('Título antigo');
    await expect(anotacao.getByRole('heading', { level: 2 })).toHaveCount(1);
    await expect(anotacao.getByRole('form')).toHaveCount(0);
    // Quando
    await campo.fill('Título novo');
    await campo.press('Enter');
    // Então
    await expect(page.getByText('Anotação atualizada.')).toBeVisible();
    await expect(anotacao.getByRole('heading', { name: 'Título novo', level: 2 })).toBeVisible();
    await expect(anotacao.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Pastas e anotações' }).getByRole('link', { name: 'Título novo' })).toBeVisible();
    // E não há lápis: a equipe muda nas bolinhas, o resto no próprio lugar
    await expect(anotacao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(anotacao.getByRole('combobox', { name: 'Responsável' })).toHaveCount(0);
  });

  test('dada uma anotação que a pessoa só lê, quando ela clica no título ou no texto, então nada vira campo de edição, e não há o ícone de etiqueta', async ({ page }) => {
    // Dado: o Mateus escreve uma anotação ligada a uma demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Lida pelo Bruno', { texto: 'Só para ler.', endereco: '/documentos/nova/?demanda=' + demanda });
    await entrarComo(page, 'u-bruno');
    const anotacao = await abrirAnotacao(page, 'Lida pelo Bruno');
    // Quando
    await anotacao.getByRole('heading', { name: 'Lida pelo Bruno', level: 2 }).click();
    await anotacao.getByText('Só para ler.').click();
    // Então: o único campo é a caixa de comentar (quem vê a anotação comenta, #364); nem o título nem o texto viram campo
    await expect(anotacao.getByRole('textbox')).toHaveCount(1);
    await expect(anotacao.getByRole('textbox')).toHaveAccessibleName('Escrever um comentário');
    await expect(anotacao.getByRole('button', { name: 'Lida pelo Bruno' })).toHaveCount(0);
    await expect(anotacao.getByRole('button', { name: 'Etiquetas', exact: true })).toHaveCount(0);
    await expect(anotacao.getByRole('toolbar', { name: 'Formatação do texto' })).toHaveCount(0);
    await expect(anotacao.getByRole('heading', { name: 'Lida pelo Bruno', level: 2 })).toBeVisible();
  });

  test('dada a nota em branco aberta e fechada, quando a pessoa abre "Nova anotação" de novo, então o cursor volta a estar no título', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    for (let vez = 1; vez <= 3; vez++) {
      // Quando
      await novaAnotacao(page).click();
      const nota = notaNova(page);
      // Então: o título fica com o foco, mesmo depois de a tela se desenhar
      await expect(nota.getByRole('textbox', { name: 'Título' })).toBeFocused();
      await esperarDesenhar(page);
      await expect(nota.getByRole('textbox', { name: 'Título' })).toBeFocused();
      // E fecha a janela do cadastro, em branco, para abrir de novo
      await page.getByRole('dialog', { name: 'Cadastro' }).getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(nota).toHaveCount(0);
    }
  });

  test('dado o título mudado e ainda em edição, quando a pessoa usa o Voltar do navegador, então o SEMPER pergunta e respeita a resposta: "Sair sem salvar" sai sem gravar o título', async ({ page }) => {
    // Dado: aberta pela tabela, depois de chegar a Documentos pelo menu, vindo de Tarefas. Abrir não cria entrada no histórico
    // (como nos outros módulos): o Voltar sai da página de agora para a de antes, aqui Tarefas. As duas vêm pelo menu, dentro do
    // SEMPER: um Voltar para uma página carregada à parte (page.goto) recarregaria o site, e aí quem pergunta é o navegador.
    await criarAnotacao(page, 'Título que fica');
    await fecharAnotacao(page);
    await expect(page).not.toHaveURL(/\?id=/);
    await abrir(page, 'Tarefas');
    await expect(page).toHaveURL(url => url.pathname === '/tarefas/');
    await expect(page.getByRole('heading', { name: /Tarefas/, level: 1 })).toBeVisible();
    await abrir(page, 'Documentos');
    await page.getByRole('row').filter({ hasText: 'Título que fica' }).click();
    let anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Título que fica', level: 2 })).toBeVisible();
    await anotacao.getByRole('button', { name: 'Título que fica' }).click();
    const campo = anotacao.getByRole('textbox', { name: 'Título' });
    await campo.fill('Título descartado');
    // Quando: volta pelo navegador (como o botão de voltar do mouse) e escolhe continuar
    await esperarDesenhar(page);   // como quem leva um instante entre escrever e voltar
    await page.evaluate(() => history.back());
    const pergunta = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(pergunta).toBeVisible();
    // Então: abrir a pergunta não grava o título; ao continuar, ele segue em edição, com o que a pessoa escreveu
    await expect(page.getByText('Anotação atualizada.')).toHaveCount(0);
    await pergunta.getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue('Título descartado');
    // Quando: volta de novo e escolhe sair sem salvar
    await esperarDesenhar(page);
    await page.evaluate(() => history.back());
    await expect(pergunta).toBeVisible();
    await pergunta.getByRole('button', { name: 'Sair sem salvar' }).click();
    // Então: volta a Tarefas, e o título descartado não é gravado
    await expect(page).toHaveURL(url => url.pathname === '/tarefas/');
    await expect(page.getByRole('heading', { name: 'Título descartado', level: 2 })).toHaveCount(0);
    await esperarDesenhar(page);
    await expect(page.getByText('Anotação atualizada.')).toHaveCount(0);
    anotacao = await abrirAnotacao(page, 'Título que fica');
    await expect(anotacao.getByRole('heading', { name: 'Título que fica', level: 2 })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Título descartado' })).toHaveCount(0);
  });

  test('dada uma anotação aberta pela tabela e depois pela árvore, quando a pessoa fecha a janela, então um Voltar só sai de Documentos, como nos outros módulos', async ({ page }) => {
    // Dado: veio de Tarefas para Documentos
    await criarAnotacao(page, 'Primeira para voltar');
    await criarAnotacao(page, 'Segunda para voltar');
    await page.goto('/tarefas/');
    await page.goto('/documentos/');
    await page.getByRole('row').filter({ hasText: 'Primeira para voltar' }).click();
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Primeira para voltar', level: 2 })).toBeVisible();
    await fecharAnotacao(page);
    await page.getByRole('navigation', { name: 'Pastas e anotações' }).getByRole('link', { name: 'Segunda para voltar' }).click();
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Segunda para voltar', level: 2 })).toBeVisible();
    // Quando: fecha pelo X e usa o Voltar do navegador
    await fecharAnotacao(page);
    await expect(anotacaoAberta(page)).toHaveCount(0);
    await expect(page).toHaveURL(url => url.pathname === '/documentos/' && !url.searchParams.has('id'));
    await page.goBack();
    // Então
    await expect(page).toHaveURL(url => url.pathname === '/tarefas/');
  });

  test('dado o endereço antigo de mudar uma anotação, quando a pessoa o abre, então vai à anotação, e não a uma anotação nova em branco', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Pelo endereço antigo');
    const id = new URL(page.url()).searchParams.get('id')!;
    // Quando
    await page.goto('/documentos/nova/?id=' + id);
    // Então
    await expect(page).toHaveURL(url => url.pathname === '/documentos/' && url.search === '?id=' + id);
    await expect(anotacaoAberta(page).getByRole('heading', { name: 'Pelo endereço antigo', level: 2 })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Título' })).toHaveCount(0);
  });
});

// ---------- pastas e etiquetas (#342) ----------
/** O explorador, à esquerda da página (a tela dos testes é larga: ele aparece, e não a gaveta). */
const arvore = (page: Page) => page.getByRole('navigation', { name: 'Pastas e anotações' });
/** Cria uma pasta pela árvore: no primeiro nível, ou dentro de outra pelo ⋯ dela. A nova passa a ser a escolhida. */
async function criarPasta(page: Page, nome: string, dentroDe?: string) {
  if (dentroDe) {
    await arvore(page).getByRole('button', { name: `Ações da pasta ${dentroDe}` }).click();
    await page.getByRole('menuitem', { name: 'Nova subpasta' }).click();
  } else await arvore(page).getByRole('button', { name: 'Nova pasta' }).click();
  await page.getByRole('textbox', { name: dentroDe ? 'Nova subpasta' : 'Nova pasta' }).fill(nome);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(`Pasta "${nome}" criada.`)).toBeVisible();
  await expect(arvore(page).getByRole('button', { name: nome, exact: true })).toHaveAttribute('aria-current', 'true');
}
/** O id de uma pasta, lido do banco fictício da aba. */
const idDaPasta = (page: Page, nome: string) => page.evaluate(([chave, n]) =>
  (JSON.parse(sessionStorage.getItem(chave)!) as { pastas: { id: string; nome: string }[] }).pastas.find(p => p.nome === n)!.id, [CHAVE, nome]);
/** Cria a etiqueta pelo ícone de etiqueta, no topo da anotação (ela já fica marcada), e fecha a escolha. */
async function criarEtiquetaPeloIcone(page: Page, lugar: Locator, texto: string, cor: string) {
  await lugar.getByRole('button', { name: 'Etiquetas', exact: true }).click();
  const escolha = page.getByRole('dialog', { name: 'Escolher etiquetas' });
  const form = escolha.getByRole('form', { name: 'Nova etiqueta' });
  await form.getByLabel('Texto').fill(texto);
  await form.getByRole('radio', { name: cor }).check();
  await form.getByRole('button', { name: 'Criar etiqueta' }).click();
  await expect(escolha.getByRole('checkbox', { name: texto })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(escolha).toBeHidden();
}
/** A pasta Escritório › POPs, criada pela árvore (POPs fica escolhida). */
async function criarEscritorioEPops(page: Page) {
  await page.goto('/documentos/');
  await criarPasta(page, 'Escritório');
  await criarPasta(page, 'POPs', 'Escritório');
}
/** O caminho da pasta no topo da anotação (ou da anotação nova). */
const caminho = (lugar: Locator | Page) => lugar.getByRole('navigation', { name: 'Pasta', exact: true });

test.describe('Pastas e etiquetas dos documentos (#342)', () => {
  test('dada a página Documentos, quando a pessoa cria uma pasta e uma subpasta dentro dela, então elas aparecem numa árvore ao lado da lista, que abre e fecha', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await expect(arvore(page).getByRole('button', { name: 'Todos os documentos' })).toHaveAttribute('aria-current', 'true');
    // Quando
    await criarPasta(page, 'Escritório');
    await criarPasta(page, 'POPs', 'Escritório');
    // Então: a subpasta aparece dentro da pasta, que abriu para mostrá-la
    const subpastas = arvore(page).getByRole('button', { name: 'O que está em Escritório' });
    await expect(subpastas).toHaveAttribute('aria-expanded', 'true');
    await expect(arvore(page).getByRole('listitem').filter({ hasText: 'Escritório' }).getByRole('button', { name: 'POPs', exact: true })).toBeVisible();
    // E a árvore fica ao lado da lista, e não acima dela
    const lado = (await arvore(page).boundingBox())!, lista = (await page.getByText('Nenhuma anotação nesta pasta').boundingBox())!;
    expect(lado.x + lado.width).toBeLessThanOrEqual(lista.x);
    // Quando: fecha e abre a pasta
    await subpastas.click();
    // Então
    await expect(subpastas).toHaveAttribute('aria-expanded', 'false');
    await expect(arvore(page).getByRole('button', { name: 'POPs', exact: true })).toHaveCount(0);
    await subpastas.click();
    await expect(arvore(page).getByRole('button', { name: 'POPs', exact: true })).toBeVisible();
  });

  test('dada uma anotação, quando a pessoa escolhe a pasta ao criar e depois, então o caminho aparece no topo, na linha da equipe, e clicar num pedaço mostra aquela pasta', async ({ page }) => {
    // Dado: a pasta POPs, dentro de Escritório, escolhida na árvore
    await criarEscritorioEPops(page);
    // Quando: escreve a anotação nova pelo explorador (ela já vem na pasta escolhida)
    await novaAnotacao(page).click();
    const nova = notaNova(page);
    // Então: o caminho aparece no topo, sem links (sair perderia a anotação)
    await expect(caminho(nova).getByRole('listitem')).toHaveText(['Escritório', 'POPs']);
    await expect(caminho(nova).getByRole('link')).toHaveCount(0);
    await nova.getByRole('textbox', { name: 'Título' }).fill('POP do caixa');
    await nova.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então: a anotação (na janela do cartão) mostra o caminho com links, acima do título, e ela aparece dentro da pasta no explorador
    let anotacao = page.getByRole('article', { name: /^Anotação / });
    await expect(anotacao.getByRole('heading', { name: 'POP do caixa', level: 2 })).toBeVisible();
    await expect(caminho(anotacao).getByRole('link')).toHaveText(['Escritório', 'POPs']);
    const noCaminho = (await caminho(anotacao).boundingBox())!, titulo = (await anotacao.getByRole('heading', { name: 'POP do caixa' }).boundingBox())!;
    expect(noCaminho.y + noCaminho.height).toBeLessThanOrEqual(titulo.y);
    await expect(arvore(page).getByRole('link', { name: 'POP do caixa' })).toHaveAttribute('aria-current', 'page');
    // Quando: clica em "Escritório" no caminho
    await caminho(anotacao).getByRole('link', { name: 'Escritório' }).click();
    // Então: a janela da anotação fecha e a página mostra a pasta Escritório (com a anotação, que está numa subpasta dela)
    await expect(page.getByRole('article', { name: /^Anotação / })).toHaveCount(0);
    await expect(arvore(page).getByRole('button', { name: 'Escritório', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('POP do caixa');
    await expect(titulosNaTabela(page)).toContainText('Escritório › POPs');
    // Quando: uma anotação criada fora das pastas ganha uma pasta depois
    anotacao = await criarAnotacao(page, 'Ata solta');
    await expect(caminho(anotacao)).toHaveCount(0);
    await anotacao.getByRole('button', { name: 'Escolher a pasta' }).click();
    await page.getByRole('menuitemradio', { name: 'Escritório', exact: true }).click();
    // Então
    await expect(page.getByText('Anotação levada para a pasta Escritório.')).toBeVisible();
    await expect(caminho(anotacao).getByRole('link')).toHaveText(['Escritório']);
    await abrirSecao(coluna(page), 'Histórico de alterações');
    await expect(coluna(page).getByText('Pasta')).toBeVisible();
  });

  test('dada uma pasta escolhida na árvore, quando a pessoa olha a lista, então vê só o que está nela e nas subpastas', async ({ page }) => {
    // Dado: Escritório › POPs, Modelos, e uma anotação em cada, mais uma fora das pastas
    await criarEscritorioEPops(page);
    await criarPasta(page, 'Modelos');
    const [escritorio, pops, modelos] = [await idDaPasta(page, 'Escritório'), await idDaPasta(page, 'POPs'), await idDaPasta(page, 'Modelos')];
    await criarAnotacao(page, 'No escritório', { endereco: '/documentos/nova/?pasta=' + escritorio });
    await criarAnotacao(page, 'No POP', { endereco: '/documentos/nova/?pasta=' + pops });
    await criarAnotacao(page, 'No modelo', { endereco: '/documentos/nova/?pasta=' + modelos });
    await criarAnotacao(page, 'Fora das pastas');
    await page.goto('/documentos/');
    await expect(titulosNaTabela(page)).toHaveCount(4);
    // E, no explorador, a sem pasta fica no primeiro nível
    await expect(arvore(page).getByRole('link', { name: 'Fora das pastas' })).toBeVisible();
    // Quando
    await arvore(page).getByRole('button', { name: 'Escritório', exact: true }).click();
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(2);
    await expect(titulosNaTabela(page).filter({ hasText: 'No escritório' })).toHaveCount(1);
    await expect(titulosNaTabela(page).filter({ hasText: 'No POP' })).toHaveCount(1);
    // Então: a pasta escolhida abre e mostra as subpastas e as anotações dela na árvore
    await expect(arvore(page).getByRole('button', { name: 'O que está em Escritório' })).toHaveAttribute('aria-expanded', 'true');
    await expect(arvore(page).getByRole('link', { name: 'No escritório' })).toBeVisible();
    // Quando: escolhe a subpasta
    await arvore(page).getByRole('button', { name: 'POPs', exact: true }).click();
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('No POP');
    // Quando: volta a todos os documentos
    await arvore(page).getByRole('button', { name: 'Todos os documentos' }).click();
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(4);
  });

  // A regra mudou (pedido de 18/11): a seção "Etiquetas" saiu da anotação; a escolha abre pelo ícone de etiqueta, no topo, e os
  // selos ficam numa linha entre o topo e o título.
  test('dada uma anotação nova, quando a pessoa clica no ícone de etiqueta, então escolhe ou cria etiquetas ali mesmo, e os selos aparecem entre o topo e o título', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    const nota = notaNova(page);
    const titulo = nota.getByRole('textbox', { name: 'Título' });
    // Então: só o ícone, sem a seção nem a linha dos selos
    await expect(nota.getByRole('button', { name: 'Etiquetas', exact: true })).toBeVisible();
    await expect(nota.getByRole('group', { name: 'Etiquetas' })).toHaveCount(0);
    await expect(nota.getByRole('region', { name: 'Etiquetas' })).toHaveCount(0);
    await expect(nota.getByText('Nenhuma etiqueta.')).toHaveCount(0);
    // Quando: cria "POP" e "Reunião" pelo ícone
    await criarEtiquetaPeloIcone(page, nota, 'POP', 'Azul');
    await criarEtiquetaPeloIcone(page, nota, 'Reunião', 'Verde');
    // Então: as duas aparecem na linha dos selos, acima do título
    const selos = nota.getByRole('group', { name: 'Etiquetas' });
    await expect(selos.getByText('POP', { exact: true })).toBeVisible();
    await expect(selos.getByText('Reunião', { exact: true })).toBeVisible();
    const [linha, caixaDoTitulo] = [(await selos.boundingBox())!, (await titulo.boundingBox())!];
    expect(linha.y + linha.height).toBeLessThanOrEqual(caixaDoTitulo.y);
    // Quando: desmarca "Reunião" e salva
    await nota.getByRole('button', { name: 'Etiquetas', exact: true }).click();
    await page.getByRole('dialog', { name: 'Escolher etiquetas' }).getByRole('checkbox', { name: 'Reunião' }).uncheck();
    await page.keyboard.press('Escape');
    await titulo.fill('POP de atendimento');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então: a anotação nasce com "POP", que aparece nos selos dela, acima do título, e na lista
    const anotacao = anotacaoAberta(page);
    const tituloSalvo = anotacao.getByRole('heading', { name: 'POP de atendimento', level: 2 });
    await expect(tituloSalvo).toBeVisible();
    const daAnotacao = anotacao.getByRole('group', { name: 'Etiquetas' });
    await expect(daAnotacao.getByText('POP', { exact: true })).toBeVisible();
    await expect(daAnotacao.getByText('Reunião', { exact: true })).toHaveCount(0);
    expect((await daAnotacao.boundingBox())!.y).toBeLessThan((await tituloSalvo.boundingBox())!.y);
    // E "Reunião", criada ali, fica para o escritório: aparece na escolha da anotação já salva
    await anotacao.getByRole('button', { name: 'Etiquetas', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Escolher etiquetas' }).getByRole('checkbox', { name: 'Reunião' })).not.toBeChecked();
    await page.keyboard.press('Escape');
    await fecharAnotacao(page);
    await expect(titulosNaTabela(page).filter({ hasText: 'POP de atendimento' }).getByText('POP', { exact: true })).toBeVisible();
  });

  test('dada uma anotação nova com uma etiqueta marcada, quando a pessoa exclui a etiqueta no próprio painel e salva, então a anotação nasce sem ela', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    await criarEtiquetaPeloIcone(page, notaNova(page), 'Transitória', 'Amarelo');
    await criarEtiquetaPeloIcone(page, notaNova(page), 'POP', 'Azul');
    // Quando: exclui "Transitória" pelo painel do ícone de etiqueta
    await notaNova(page).getByRole('button', { name: 'Etiquetas', exact: true }).click();
    const escolha = page.getByRole('dialog', { name: 'Escolher etiquetas' });
    await escolha.getByRole('button', { name: 'Mudar a etiqueta Transitória' }).click();
    const form = escolha.getByRole('form', { name: 'Mudar a etiqueta Transitória' });
    await form.getByRole('button', { name: 'Excluir' }).click();
    await form.getByRole('button', { name: 'Confirmar exclusão' }).click();
    await expect(escolha.getByRole('checkbox', { name: 'Transitória' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Título' }).fill('Ata sem a transitória');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então: a anotação é criada, só com "POP"
    const anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'Ata sem a transitória', level: 2 })).toBeVisible();
    await expect(anotacao.getByRole('group', { name: 'Etiquetas' }).getByText('POP', { exact: true })).toBeVisible();
    await expect(anotacao.getByText('Transitória', { exact: true })).toHaveCount(0);
  });

  test('dada a página Documentos, quando a pessoa filtra por etiqueta, então vê só os documentos com ela', async ({ page }) => {
    // Dado: uma anotação com a etiqueta "Transitória" e outra sem
    const anotacao = await criarAnotacao(page, 'Rascunho de recurso');
    await criarEtiquetaPeloIcone(page, anotacao, 'Transitória', 'Amarelo');
    await expect(anotacao.getByRole('group', { name: 'Etiquetas' }).getByText('Transitória', { exact: true })).toBeVisible();
    await criarAnotacao(page, 'Ata definitiva');
    await page.goto('/documentos/');
    await expect(titulosNaTabela(page)).toHaveCount(2);
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByRole('combobox', { name: 'Etiqueta' }).selectOption({ label: 'Transitória' });
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('Rascunho de recurso');
  });

  test('dada uma pasta com conteúdo, quando alguém tenta apagá-la, então o SEMPER pede para esvaziá-la antes; vazia, ela sai', async ({ page }) => {
    // Dado: Escritório › POPs, com uma anotação em POPs
    await criarEscritorioEPops(page);
    await criarAnotacao(page, 'POP guardado', { endereco: '/documentos/nova/?pasta=' + await idDaPasta(page, 'POPs') });
    await page.goto('/documentos/');
    // Quando: tenta apagar POPs
    const apagar = async (nome: string) => {
      await arvore(page).getByRole('button', { name: `Ações da pasta ${nome}` }).click();
      await page.getByRole('menuitem', { name: 'Apagar' }).click();
      await page.getByRole('dialog', { name: 'Apagar a pasta' }).getByRole('button', { name: 'Apagar' }).click();
    };
    await arvore(page).getByRole('button', { name: 'O que está em Escritório' }).click();
    await apagar('POPs');
    // Então
    await expect(page.getByText('Esvazie a pasta antes de apagá-la: tire dela as anotações e as subpastas.')).toBeVisible();
    await expect(arvore(page).getByRole('button', { name: 'POPs', exact: true })).toBeVisible();
    // Quando: tenta apagar Escritório, que tem a subpasta
    await apagar('Escritório');
    // Então
    await expect(page.getByText('Esvazie a pasta antes de apagá-la: tire dela as anotações e as subpastas.').last()).toBeVisible();
    await expect(arvore(page).getByRole('button', { name: 'Escritório', exact: true })).toBeVisible();
    // Quando: uma pasta vazia
    await criarPasta(page, 'Vazia');
    await apagar('Vazia');
    // Então
    await expect(page.getByText('Pasta "Vazia" apagada.')).toBeVisible();
    await expect(arvore(page).getByRole('button', { name: 'Vazia', exact: true })).toHaveCount(0);
  });

  test('dada uma anotação com pasta e etiquetas, quando a pessoa usa "Baixar .md", então as propriedades do topo trazem a pasta e as etiquetas', async ({ page }) => {
    // Dado
    await criarEscritorioEPops(page);
    const anotacao = await criarAnotacao(page, 'POP do protocolo', { endereco: '/documentos/nova/?pasta=' + await idDaPasta(page, 'POPs') });
    await criarEtiquetaPeloIcone(page, anotacao, 'POP', 'Azul');
    await criarEtiquetaPeloIcone(page, anotacao, 'Reunião semanal', 'Verde');
    await expect(anotacao.getByText('Reunião semanal', { exact: true })).toBeVisible();
    // Quando
    const { conteudo } = await baixarMd(page, anotacao);
    // Então
    const [, propriedades] = conteudo.split(/^---$/m);
    expect(propriedades).toContain('\npasta: "Escritório / POPs"\n');
    expect(propriedades).toContain('\netiquetas:\n  - POP\n  - Reunião semanal\n');
  });

  test('dada uma anotação com pasta e etiquetas, quando a pessoa a duplica, então a cópia fica na mesma pasta e com as mesmas etiquetas', async ({ page }) => {
    // Dado
    await criarEscritorioEPops(page);
    let anotacao = await criarAnotacao(page, 'POP original', { endereco: '/documentos/nova/?pasta=' + await idDaPasta(page, 'POPs') });
    await criarEtiquetaPeloIcone(page, anotacao, 'POP', 'Azul');
    await expect(anotacao.getByRole('group', { name: 'Etiquetas' }).getByText('POP', { exact: true })).toBeVisible();
    // Quando
    await noMenu(page, anotacao, 'Duplicar');
    // Então
    await expect(page.getByText(/Anotação \w+ duplicada como \w+\./)).toBeVisible();
    anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: 'POP original (cópia)', level: 2 })).toBeVisible();
    await expect(caminho(anotacao).getByRole('link')).toHaveText(['Escritório', 'POPs']);
    await expect(anotacao.getByRole('group', { name: 'Etiquetas' }).getByText('POP', { exact: true })).toBeVisible();
    // E a lista da pasta mostra as duas, cada uma com a etiqueta
    await page.goto('/documentos/?pasta=' + await idDaPasta(page, 'POPs'));
    await expect(titulosNaTabela(page)).toHaveCount(2);
    await expect(titulosNaTabela(page).getByText('POP', { exact: true })).toHaveCount(2);
  });
});

/** Onde está na tela uma palavra do texto à vista da caixa (a primeira vez que aparece): o meio e as duas pontas. */
const ondeEsta = (caixa: Locator, palavra: string) => caixa.evaluate((el, p) => {
  const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let no = andar.nextNode(); no; no = andar.nextNode()) {
    const i = (no.textContent ?? '').indexOf(p);
    if (i < 0) continue;
    const trecho = document.createRange();
    trecho.setStart(no, i);
    trecho.setEnd(no, i + p.length);
    const r = trecho.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, esquerda: r.x + 1, direita: r.right - 1 };
  }
  throw new Error(`A palavra "${p}" não está à vista.`);
}, palavra);
/** Clica duas vezes numa palavra, onde ela aparece na tela, como a pessoa faz para escolhê-la. */
async function cliqueDuplo(caixa: Locator, palavra: string) {
  const { x, y } = await ondeEsta(caixa, palavra);
  await caixa.page().mouse.dblclick(x, y);
}
/** Clica logo depois da palavra (no fim da linha dela, se ela é a última): o cursor vai para lá. */
async function clicarDepois(caixa: Locator, palavra: string) {
  const { direita, y } = await ondeEsta(caixa, palavra);
  await caixa.page().mouse.click(direita + 3, y);
}
/** Arrasta o mouse do começo de uma palavra até o fim de outra, como a pessoa que escolhe um trecho. */
async function arrastar(caixa: Locator, de: string, ate: string) {
  const [a, b] = [await ondeEsta(caixa, de), await ondeEsta(caixa, ate)], mouse = caixa.page().mouse;
  await mouse.move(a.esquerda, a.y);
  await mouse.down();
  await mouse.move(b.direita, b.y, { steps: 8 });
  await mouse.up();
}
/** O botão Negrito da barra de formatação. */
const negrito = (onde: Locator) => onde.getByRole('button', { name: 'Negrito (Ctrl+B)' });

test.describe('Formatar o texto de uma anotação já criada (#364): o clique escolhe a palavra que a pessoa vê', () => {
  // Os sinais escondidos (**, o "- " da bolinha, o endereço do link) aparecem na linha do cursor e empurram o texto. Se
  // aparecessem já no primeiro clique, o segundo clique (ou o fim do arrasto) cairia em outra palavra, e a formatação ia para o
  // lugar errado: "só consigo formatar na hora de criar, não na hora de editar".

  test('dado um negrito na linha, quando a pessoa clica em outra linha e depois clica duas vezes em "hoje" e em B, então "hoje" fica em negrito', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Reuniao', { texto: 'Contrato de honorarios assinado hoje\nCliente pediu revisao do valor' });
    const caixa = caixaDoTexto(anotacao);
    await cliqueDuplo(caixa, 'honorarios');
    await negrito(anotacao).click();
    await expect.poll(() => textoGuardado(page, 'Reuniao')).toBe('Contrato de **honorarios** assinado hoje\nCliente pediu revisao do valor');
    // Quando: o cursor vai para a 2ª linha (os "**" da 1ª se escondem) e a pessoa clica duas vezes em "hoje"
    await clicarDepois(caixa, 'valor');
    await expect(caixa).not.toContainText('**');
    await cliqueDuplo(caixa, 'hoje');
    await negrito(anotacao).click();
    // Então
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    await expect.poll(() => textoGuardado(page, 'Reuniao')).toBe('Contrato de **honorarios** assinado **hoje**\nCliente pediu revisao do valor');
  });

  test('dada uma anotação reaberta, quando a pessoa clica duas vezes na palavra depois do negrito e tecla Ctrl+I, então só ela fica em itálico', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Reaberta', { texto: 'Contrato de **honorarios** assinado hoje' });
    await fecharAnotacao(page);
    const anotacao = await abrirAnotacao(page, 'Reaberta');
    const caixa = caixaDoTexto(anotacao);
    await expect(caixa).not.toContainText('**');
    // Quando: antes de qualquer outro clique
    await cliqueDuplo(caixa, 'assinado');
    await page.keyboard.press('ControlOrMeta+i');
    // Então
    await expect.poll(() => textoGuardado(page, 'Reaberta')).toBe('Contrato de **honorarios** *assinado* hoje');
  });

  test('dada a anotação nova, ainda sem salvar, quando a pessoa põe negrito numa linha que já tem negrito, depois de clicar em outra, então ele vai para a palavra clicada', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    await page.getByRole('textbox', { name: 'Título' }).fill('Nova com negrito');
    const nota = notaNova(page), caixa = caixaDoTexto(nota);
    await porNoTexto(caixa, 'Contrato de **honorarios** assinado hoje\nCliente pediu revisao do valor');
    // Quando
    await clicarDepois(caixa, 'valor');
    await expect(caixa).not.toContainText('**');
    await cliqueDuplo(caixa, 'hoje');
    await negrito(nota).click();
    await nota.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então
    await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
    await expect.poll(() => textoGuardado(page, 'Nova com negrito')).toBe('Contrato de **honorarios** assinado **hoje**\nCliente pediu revisao do valor');
  });

  test('dado um negrito escondido antes da palavra, quando a pessoa arrasta o mouse sobre ela e clica em B, então a palavra inteira fica em negrito', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Arrasto', { texto: 'um **negrito** palavra1 resto\nfimdotexto' });
    const caixa = caixaDoTexto(anotacao);
    await clicarDepois(caixa, 'fimdotexto');
    await expect(caixa).not.toContainText('**');
    // Quando
    await arrastar(caixa, 'palavra1', 'palavra1');
    await negrito(anotacao).click();
    // Então
    await expect.poll(() => textoGuardado(page, 'Arrasto')).toBe('um **negrito** **palavra1** resto\nfimdotexto');
  });

  test('dado um link e um item de lista escondidos, quando a pessoa clica duas vezes numa palavra da linha e em B, então o negrito vai para a palavra', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Link e lista', { texto: 'um [link](https://exemplo.com) palavra5 resto\n- item dois aqui\nfinal' });
    const caixa = caixaDoTexto(anotacao);
    await clicarDepois(caixa, 'final');
    await expect(caixa).not.toContainText('https');
    // Quando
    await cliqueDuplo(caixa, 'palavra5');
    await negrito(anotacao).click();
    // Então
    await expect.poll(() => textoGuardado(page, 'Link e lista')).toBe('um [link](https://exemplo.com) **palavra5** resto\n- item dois aqui\nfinal');
    // Quando: na linha da lista (a bolinha toma o lugar do "- ")
    await clicarDepois(caixa, 'final');
    await expect(caixa).not.toContainText('https');
    await cliqueDuplo(caixa, 'dois');
    await negrito(anotacao).click();
    // Então
    await expect.poll(() => textoGuardado(page, 'Link e lista')).toBe('um [link](https://exemplo.com) **palavra5** resto\n- item **dois** aqui\nfinal');
  });

  test('dado um trecho de várias linhas com um negrito no meio, quando a pessoa o arrasta e clica em B, então tudo fica em negrito, sem "****" sobrando', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Varias linhas', { texto: 'primeira linha aqui\n**forte** meio palavra fim\nultima linha final' });
    const caixa = caixaDoTexto(anotacao);
    await clicarDepois(caixa, 'final');
    await expect(caixa).not.toContainText('**');
    // Quando
    await arrastar(caixa, 'aqui', 'ultima');
    await negrito(anotacao).click();
    // Então
    await expect.poll(() => textoGuardado(page, 'Varias linhas')).toBe('primeira linha **aqui**\n**forte meio palavra fim**\n**ultima** linha final');
    // Quando: tudo escolhido (Ctrl+A) e B
    await caixa.press('ControlOrMeta+a');
    await negrito(anotacao).click();
    // Então
    await expect.poll(() => textoGuardado(page, 'Varias linhas')).toBe('**primeira linha aqui**\n**forte meio palavra fim**\n**ultima linha final**');
  });
});
