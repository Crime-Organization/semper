// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Documentos (#303): anotações em Markdown ligadas a pessoas, processos, contratos, demandas, tarefas e compromissos.
// Desde os pedidos do dono de 18/11, a página é como o Obsidian: o explorador (as pastas com as anotações dentro) à esquerda, que
// se recolhe, e a tabela no centro. A anotação abre na janela do cartão, como os outros cartões (ao lado, de início, ou no centro),
// com as etiquetas no topo e o texto já na caixa de escrever, salvando sozinho; os comentários, "Ligada a" e o histórico ficam
// embaixo do texto (ao lado) ou na coluna da direita da janela (no centro). A anotação nova abre na mesma janela (#369), com o
// cursor no título, e vai ao banco sozinha quando a pessoa escreve o título ou o texto (sem "Salvar anotação"). No explorador,
// a anotação se arrasta para uma pasta (#370).
// Na semente do banco fictício não há anotações. A demanda "Registro de marca" tem o Bruno (estagiário, não administrador)
// de colaborador; JOSÉ DA SILVA TESTE é uma pessoa do cadastro. Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao, barraDeFormatacao, barraEquilibradaNoCelular, botoesDaBarra, entrarComo } from './ajudantes';

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
 * O texto guardado de uma anotação, no banco fictício: o Markdown, com os sinais (**, ##, "- [ ] ") que o editor ao vivo esconde.
 */
/**
 * O estilo da letra (normal, itálico) de cada pedaço de texto da caixa que faz parte de "texto", sem repetir, como a tela os
 * desenha: se um pedaço do link virasse itálico, ele apareceria aqui como "italic".
 */
const estilosDoTexto = (caixa: Locator, texto: string) => caixa.evaluate((el, t) => {
  const estilos = new Set<string>(), andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = andar.nextNode(); n; n = andar.nextNode())
    if (n.textContent && t.includes(n.textContent) && n.parentElement) estilos.add(getComputedStyle(n.parentElement).fontStyle);
  return [...estilos];
}, texto);
const textoGuardado = (page: Page, titulo: string) => page.evaluate(([chave, t]) =>
  (JSON.parse(sessionStorage.getItem(chave)!) as { anotacoes: { titulo: string; texto: string }[] }).anotacoes.find(a => a.titulo === t)?.texto, [CHAVE, titulo]);
/** A anotação nova, em branco, na janela da anotação (#369): até ir ao banco, ela se chama "Anotação nova". */
const notaNova = (page: Page) => page.getByRole('article', { name: 'Anotação nova' });
/** A anotação já gravada, na janela: o nome traz o código dela. */
const anotacaoGravada = (page: Page) => anotacaoAberta(page).getByRole('article', { name: /^Anotação (?!nova$)\w+$/ });
/**
 * Escreve o título da anotação nova e aperta Enter: ela vai ao banco sozinha (#369), e o cursor desce ao texto. Se o título saiu
 * da edição (a pessoa clicou em outro lugar antes, como no ícone de etiqueta), um clique em "Sem título" o abre de novo.
 */
async function escreverOTitulo(page: Page, titulo: string) {
  const campo = notaNova(page).getByRole('textbox', { name: 'Título' });
  await expect(notaNova(page).getByRole('heading', { level: 2 })).toBeVisible();
  if (!await campo.count()) await notaNova(page).getByRole('button', { name: 'Sem título' }).click();
  await campo.fill(titulo);
  await campo.press('Enter');
  await expect(anotacaoGravada(page)).toBeVisible();
}
/** O código da anotação aberta, lido do nome dela. */
async function codigoDaAnotacao(page: Page) {
  return /^Anotação (\w+)$/.exec((await anotacaoGravada(page).getAttribute('aria-label'))!)![1];
}
/** O link "Nova anotação" da barra do explorador (o do cabeçalho da página leva ao mesmo lugar). */
const novaAnotacao = (page: Page) => page.getByRole('toolbar', { name: 'Explorador' }).getByRole('link', { name: 'Nova anotação' });

/**
 * Escreve uma anotação na nota em branco, na janela da anotação, e espera ela ir ao banco (#369). A nota não tem rótulos à vista:
 * o título e o texto são achados pelo nome que o leitor de tela lê. A equipe, escolhida antes de escrever, é a das bolinhas, no
 * topo. O endereço antigo (/documentos/nova/…) leva à anotação nova em Documentos.
 */
async function criarAnotacao(page: Page, titulo: string, { texto = '', compartilharCom = '', endereco = '/documentos/nova/' } = {}) {
  await page.goto(endereco);
  if (compartilharCom) {
    await notaNova(page).getByRole('group', { name: 'Equipe' }).getByRole('button', { name: 'Compartilhar com mais alguém' }).click();
    await page.getByRole('dialog', { name: 'Compartilhar com mais alguém' }).getByRole('list', { name: 'Equipe' }).getByRole('button', { name: compartilharCom }).click();
  }
  await escreverOTitulo(page, titulo);
  const anotacao = anotacaoAberta(page);
  if (texto) {
    await porNoTexto(caixaDoTexto(anotacao), texto);
    await caixaDoTexto(anotacao).press('Control+s');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
  }
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
/** Espera a janela terminar de entrar (ou de mudar de formato), para medir: as animações que acabam, não as que se repetem. */
const esperarParar = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished)));

test.describe('Anotações no cartão de um item', () => {
  test('dado o cartão de uma demanda, quando a pessoa escreve uma anotação pelo "+" da seção, então ela nasce ligada, abre na janela em Documentos, e o Voltar leva de novo ao cartão, com o número', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page, 'Registro de marca');
    const secao = cartao.getByRole('button', { name: /^Anotações/ });
    await expect(secao).toHaveAttribute('aria-expanded', 'false');
    await expect(secao).toHaveText(/^Anotações\s*0$/);
    // Quando: o "+" abre a anotação nova em Documentos, na mesma janela da anotação aberta (a regra mudou, #369: antes, abria na
    // janela do cadastro, por cima do cartão)
    await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
    await expect(page).toHaveURL(/\/documentos\/\?nova=1&demanda=/);
    await expect(anotacaoAberta(page).getByRole('article', { name: 'Anotação nova' })).toBeVisible();
    // A demanda de onde se veio já está na lista "Ligada a" da nota em branco (#339), embaixo do texto.
    const escolhidos = notaNova(page).getByRole('list', { name: 'Itens ligados' });
    await expect(escolhidos.getByRole('listitem')).toHaveCount(1);
    await expect(escolhidos).toContainText('Demanda');
    await expect(escolhidos).toContainText('Registro de marca');
    await escreverOTitulo(page, 'Estratégia do registro');
    // Então: a anotação, gravada sozinha, continua na mesma janela, com o endereço dela e a demanda em "Ligada a"
    await expect(page).toHaveURL(/\/documentos\/\?id=/);
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

  test('dado o cartão de uma demanda, quando a pessoa abre a anotação nova pelo "+" e fecha pelo X, escrita ou não, então volta ao cartão', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page, 'Registro de marca');
    await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
    await expect(notaNova(page)).toBeVisible();
    // Quando: fecha sem escrever
    await fecharAnotacao(page);
    // Então: de volta ao cartão, sem anotação nova
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Registro de marca', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*0$/);
    // Quando: abre de novo, escreve o título e fecha
    await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
    await escreverOTitulo(page, 'Escrita e fechada');
    await fecharAnotacao(page);
    // Então: de volta ao cartão, com a anotação
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Registro de marca', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
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
    // ("Ligada a" veio aberta na anotação nova, sem a escolha da pessoa, #369: ao reabrir, ela volta recolhida, como de costume)
    await abrirAnotacao(page, 'Reunião com o cliente');
    await abrirSecao(coluna(page), 'Ligada a');
    await coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /JOSÉ DA SILVA TESTE/ }).click();
    let cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
    cartao = await abrirDemanda(page, 'Registro de marca');
    await abrirSecao(cartao, 'Anotações');
    await expect(cartao.getByRole('link', { name: /Reunião com o cliente/ })).toBeVisible();
    // Quando: desliga a pessoa
    await abrirAnotacao(page, 'Reunião com o cliente');
    await abrirSecao(coluna(page), 'Ligada a');
    await coluna(page).getByRole('button', { name: 'Desligar JOSÉ DA SILVA TESTE' }).click();
    // Então
    await expect(coluna(page).getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(1);
    await fecharAnotacao(page);
    await expect(page.getByRole('row').filter({ hasText: 'Reunião com o cliente' })).toContainText('Demandas');
  });
});

test.describe('Ligar uma anotação que já existe, no cartão de um item (#341)', () => {
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
    const codigo = await codigoDaAnotacao(page);
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
    const secoes = janela.getByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });
    const expandir = janela.getByRole('button', { name: 'Expandir tudo' });
    // A folga entre o "Expandir tudo" e o título de "Comentários", logo abaixo dele, depois que a janela termina de entrar
    const folga = async () => {
      await esperarParar(page);
      const [b, s] = [(await expandir.boundingBox())!, (await secoes.nth(0).boundingBox())!];
      return s.y - (b.y + b.height);
    };
    // Ao lado, as seções ficam embaixo do texto, onde o vão entre as partes é o da anotação, e não o do cartão
    const folgaAoLado = await folga();
    // Quando
    await janela.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Então: as seções ficam à direita do texto
    const texto = (await janela.getByRole('textbox', { name: 'Texto', exact: true }).boundingBox())!;
    expect((await secoes.nth(0).boundingBox())!.x).toBeGreaterThan(texto.x + texto.width);
    // E o "Expandir tudo" fica tão perto de "Comentários" quanto ficava ao lado (#366)
    expect(Math.abs((await folga()) - folgaAoLado)).toBeLessThan(1);
    // Quando: "Expandir tudo", acima de "Comentários"
    expect((await expandir.boundingBox())!.y).toBeLessThan((await secoes.nth(0).boundingBox())!.y);
    // Desde a #366: só o ícone, sem texto, no alto da coluna, logo abaixo dos botões da janela (o formato e o X), sem passar por
    // baixo deles. Desde a #381, com o meio dele no eixo do X e no da seta de "Comentários" (o último ícone do título), e não mais
    // com a borda encostada na ponta da linha
    expect(await expandir.innerText()).toBe('');
    const [botao, seta, fechar, formato] = await Promise.all([expandir.boundingBox(),
      janela.getByRole('heading', { level: 3, name: /^Comentários/ }).locator('svg').last().boundingBox(),
      janela.getByRole('button', { name: 'Fechar' }).boundingBox(), janela.getByRole('button', { name: 'Abrir ao lado' }).boundingBox()]);
    const meio = (caixa: { x: number; width: number }) => caixa.x + caixa.width / 2;
    expect(Math.abs(meio(botao!) - meio(seta!))).toBeLessThan(2);
    expect(Math.abs(meio(botao!) - meio(fechar!))).toBeLessThan(2);
    expect(botao!.y).toBeGreaterThanOrEqual(Math.max(fechar!.y + fechar!.height, formato!.y + formato!.height));
    // E a dica aparece quando a pessoa chega nele pelo teclado (o Shift+Tab sai de "Comentários" e volta para ele)
    const dicaVisivel = (b: typeof expandir) => b.evaluate(e => getComputedStyle(e, '::after').opacity);
    await secoes.nth(0).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(expandir).toBeFocused();
    await expect.poll(() => dicaVisivel(expandir)).toBe('1');
    // E some quando o foco sai dele
    await expandir.blur();
    await expect.poll(() => dicaVisivel(expandir)).toBe('0');
    // E aparece ao passar o mouse
    await expandir.hover();
    await expect.poll(() => dicaVisivel(expandir)).toBe('1');
    await expandir.click();
    // Então
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'true');
    // E a dica do "Recolher tudo" também aparece, com tudo aberto
    const recolher = janela.getByRole('button', { name: 'Recolher tudo' });
    await recolher.hover();
    await expect.poll(() => dicaVisivel(recolher)).toBe('1');
    // Quando
    await recolher.click();
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
    // Então: também na linha do cursor a formatação fica desenhada (#368): a caixinha já aparece, sem o "- [ ] " escrito
    await expect(caixa.getByRole('checkbox', { name: 'Ligar ao cliente' })).toBeVisible();
    await expect(caixa).not.toContainText('- [');
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

  test('dada uma lista, quando a pessoa cola um link com "_" num item, então a bolinha continua, o link não fica em itálico e o Backspace no começo tira a bolinha (#368)', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Links em lista');
    const caixa = caixaDoTexto(anotacao);
    const link = 'https://site.com/37174467/Cap_1_-_Livro_IG-libre.pdf?x=1&nome=a_b_c';
    await caixa.click();
    await page.keyboard.type('- ');
    // Quando: o link entra de uma vez, como no Ctrl+V
    await page.keyboard.insertText(link);
    // Então: a linha continua um item (sem o "- " escrito), e o link fica inteiro, sem itálico em nenhum pedaço dele
    await expect(caixa.getByRole('img', { name: 'Item da lista' })).toBeVisible();
    await expect(caixa).toContainText(link);
    await expect(caixa).not.toContainText('- https');
    expect(await estilosDoTexto(caixa, link)).toEqual(['normal']);
    // Quando: escolhe o item todo (Shift+Home, que passa pela bolinha) e cola outro link por cima. O link comprido quebra em
    // duas linhas na tela: o primeiro Shift+Home vai até a quebra, o segundo até o começo do item.
    const novo = 'https://site.com/Cap_2_-_Livro.pdf';
    await page.keyboard.press('Shift+Home');
    await page.keyboard.press('Shift+Home');
    await page.keyboard.insertText(novo);
    // Então: a bolinha continua
    await expect(caixa.getByRole('img', { name: 'Item da lista' })).toBeVisible();
    await expect(caixa).toContainText(novo);
    // Quando: volta ao começo do item e tecla Backspace
    await page.keyboard.press('Home');
    await page.keyboard.press('Backspace');
    // Então: a bolinha sai, e o link fica como texto comum
    await expect(caixa.getByRole('img', { name: 'Item da lista' })).toHaveCount(0);
    await caixa.press('ControlOrMeta+s');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    await expect.poll(() => textoGuardado(page, 'Links em lista')).toBe(novo);
  });

  test('dada uma linha vazia, quando a pessoa aperta Ctrl+B e digita, então sai em negrito, sem divisória e sem "*" à mostra; Ctrl+B de novo desliga (#368)', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Negrito sem escolha');
    const caixa = caixaDoTexto(anotacao);
    await caixa.click();
    await page.keyboard.type('Pendências');
    await page.keyboard.press('Enter');
    // Quando
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('RG');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type(' e CPF');
    // Então
    await expect(caixa).toContainText('PendênciasRG e CPF');
    await expect(caixa).not.toContainText('*');
    await expect(caixa.getByRole('separator')).toHaveCount(0);
    await caixa.press('ControlOrMeta+s');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    await expect.poll(() => textoGuardado(page, 'Negrito sem escolha')).toBe('Pendências\n**RG** e CPF');
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

test.describe('O "Expandir tudo" só com o ícone num celular de toque (#366)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('dada uma anotação aberta num celular, quando a pessoa toca nas duas setas, então todas as seções abrem e a dica não fica parada por cima delas', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Anotação no celular', { texto: 'Um texto.' });
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    const secoes = anotacao.getByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });
    // Quando
    await anotacao.getByRole('button', { name: 'Expandir tudo' }).tap();
    // Então: todas abrem, e a dica do "Recolher tudo" não aparece só porque o dedo tocou ali
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'true');
    const recolher = anotacao.getByRole('button', { name: 'Recolher tudo' });
    await expect(recolher).toBeVisible();
    // (o celular de verdade deixa o :hover preso no botão depois do toque; o toque do Playwright não deixa, então o ponteiro
    // fica em cima dele, como o dedo deixaria)
    await recolher.hover();
    // (sem esperar a espera da dica passar: as transições terminam na hora, e fica o valor final)
    expect(await recolher.evaluate(e => {
      e.getAnimations({ subtree: true }).forEach(a => a.finish());
      return getComputedStyle(e, '::after').opacity;
    })).toBe('0');
    // E a página não rola de lado
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

/** Liga a chave "equipe_ve_tudo" do escritório fictício. */
const equipeVeTudo = (page: Page) => page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));

test.describe('A anotação nos casos de canto', () => {
  test('dado um endereço de anotação nova com um item que não existe mais, quando a pessoa escreve o título, então a anotação é gravada sem ligação, como o aviso promete', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/?demanda=demanda-que-nao-existe');
    // (a nota pode ser ligada a outros itens antes de ir ao banco: o aviso fala só do item de onde se veio)
    await expect(page.getByText('O item de onde você veio não foi encontrado. A anotação será gravada sem ligação a ele.')).toBeVisible();
    // Quando
    await escreverOTitulo(page, 'Sem a demanda');
    // Então
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
  // A regra mudou (#369): sem "Salvar anotação" nem Ctrl+Enter; a anotação vai ao banco ao escrever o título, com o que foi
  // escolhido antes, e o texto grava sozinho.
  test('dada a página Documentos, quando a pessoa liga a anotação nova a dois itens e depois escreve título e texto, então ela nasce ligada aos dois, com o texto', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    // Quando: abre a nota em branco na janela da anotação, com o cursor no título e sem campos com rótulo repetindo o título
    await novaAnotacao(page).click();
    const nota = notaNova(page);
    const titulo = nota.getByRole('textbox', { name: 'Título' });
    await expect(titulo).toBeFocused();
    await expect(titulo).toHaveAttribute('placeholder', 'Sem título');
    await expect(nota.getByText('Título', { exact: true })).toHaveCount(0);
    await expect(nota.getByText('Texto', { exact: true })).toHaveCount(0);
    await expect(nota.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Ainda não gravada');
    await expect(nota.getByRole('button', { name: 'Salvar anotação' })).toHaveCount(0);
    // Quando: liga a uma pessoa e a uma demanda, antes de escrever ("Ligada a")
    await nota.getByRole('button', { name: 'Ligar a um item' }).click();
    await nota.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await nota.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await nota.getByRole('button', { name: 'Ligar a outro item' }).click();
    await nota.getByRole('combobox', { name: 'Tipo de item' }).selectOption('demandas');
    await nota.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('registro de marca');
    await nota.getByRole('button', { name: /Registro de marca/ }).click();
    const escolhidos = nota.getByRole('list', { name: 'Itens ligados' });
    await expect(escolhidos.getByRole('listitem')).toHaveCount(2);
    // (os itens escolhidos não abrem o cartão deles: a nota ainda não foi ao banco)
    await expect(escolhidos.getByRole('link')).toHaveCount(0);
    // Quando: escreve o título (o Enter a leva ao banco e desce para o texto) e o texto, que grava sozinho
    await escreverOTitulo(page, 'Reunião de abertura');
    const anotacao = anotacaoAberta(page);
    await expect(caixaDoTexto(anotacao)).toBeFocused();
    await page.keyboard.type('Pauta: **prazos** e documentos.');
    await expect(anotacao.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
    // Então: a anotação continua na mesma janela, com o texto e os dois itens em "Ligada a"
    await expect(anotacao.getByRole('heading', { name: 'Reunião de abertura', level: 2 })).toBeVisible();
    expect(await textoGuardado(page, 'Reunião de abertura')).toBe('Pauta: **prazos** e documentos.');
    // (a caixa continua a mesma, com o cursor na linha e os sinais à vista: aberta de novo, o texto aparece formatado)
    await fecharAnotacao(page);
    await abrirAnotacao(page, 'Reunião de abertura');
    await expect(caixaDoTexto(anotacao)).toHaveText('Pauta: prazos e documentos.');
    await abrirSecao(coluna(page), 'Ligada a');
    const ligados = coluna(page).getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(ligados.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    await expect(ligados.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
  });

  test('dada uma anotação nova com itens escolhidos, quando a pessoa tira um antes de escrever, então ela nasce ligada só ao que ficou', async ({ page }) => {
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
    await escreverOTitulo(page, 'Só da pessoa');
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
      // E fecha a janela, em branco (nada vai ao banco), para abrir de novo
      await fecharAnotacao(page);
      await expect(nota).toHaveCount(0);
    }
  });

  test('dado o título escrito e ainda no campo da anotação nova, sem Enter, quando a pessoa fecha pelo X ou usa o Voltar, então sai de primeira, e a anotação está na lista', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await novaAnotacao(page).click();
    await notaNova(page).getByRole('textbox', { name: 'Título' }).fill('Fechada pelo X');
    // Quando: fecha pelo X, sem Enter (sair do campo leva a anotação ao banco, e a saída espera)
    await fecharAnotacao(page);
    // Então: um clique basta, sem pergunta
    await expect(anotacaoAberta(page)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
    await expect(page).toHaveURL(url => url.pathname === '/documentos/' && !url.search);
    await expect(page.getByRole('row').filter({ hasText: 'Fechada pelo X' })).toBeVisible();
    // Quando: outra, deixada pelo Voltar do navegador com o título ainda no campo
    await novaAnotacao(page).click();
    await notaNova(page).getByRole('textbox', { name: 'Título' }).fill('Deixada pelo Voltar');
    await esperarDesenhar(page);
    await page.evaluate(() => history.back());
    // Então
    await expect(anotacaoAberta(page)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
    await expect(page).toHaveURL(url => url.pathname === '/documentos/' && !url.search);
    await expect(page.getByRole('row').filter({ hasText: 'Deixada pelo Voltar' })).toBeVisible();
  });

  test('dado o texto escrito na anotação nova, quando a pessoa fecha pelo X logo depois, antes da pausa, então sai de primeira, com o texto gravado', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await novaAnotacao(page).click();
    await caixaDoTexto(notaNova(page)).click();
    await page.keyboard.insertText('Levar a procuração.');
    // Quando
    await fecharAnotacao(page);
    // Então: a anotação foi com o título provisório, que aparece apagado ao abri-la
    await expect(anotacaoAberta(page)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
    await expect.poll(() => textoGuardado(page, 'Sem título')).toBe('Levar a procuração.');
    await page.getByRole('row').filter({ hasText: 'Sem título' }).click();
    await anotacaoAberta(page).getByRole('button', { name: 'Sem título' }).click();
    await expect(anotacaoAberta(page).getByRole('textbox', { name: 'Título' })).toHaveValue('');
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
    await escreverOTitulo(page, 'POP do caixa');
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
    // (o ícone de etiqueta fica junto dos botões da janela, como na anotação aberta: ao lado, fora do artigo da nota)
    const janela = anotacaoAberta(page);
    // (o título: um campo enquanto a nota abre, um botão "Sem título" depois de a pessoa clicar em outro lugar)
    const titulo = nota.getByRole('heading', { level: 2 });
    // Então: só o ícone, sem a seção nem a linha dos selos
    await expect(janela.getByRole('button', { name: 'Etiquetas', exact: true })).toBeVisible();
    await expect(nota.getByRole('group', { name: 'Etiquetas' })).toHaveCount(0);
    await expect(nota.getByRole('region', { name: 'Etiquetas' })).toHaveCount(0);
    await expect(nota.getByText('Nenhuma etiqueta.')).toHaveCount(0);
    // Quando: cria "POP" e "Reunião" pelo ícone
    await criarEtiquetaPeloIcone(page, janela, 'POP', 'Azul');
    await criarEtiquetaPeloIcone(page, janela, 'Reunião', 'Verde');
    // Então: as duas aparecem na linha dos selos, acima do título
    const selos = nota.getByRole('group', { name: 'Etiquetas' });
    await expect(selos.getByText('POP', { exact: true })).toBeVisible();
    await expect(selos.getByText('Reunião', { exact: true })).toBeVisible();
    const [linha, caixaDoTitulo] = [(await selos.boundingBox())!, (await titulo.boundingBox())!];
    expect(linha.y + linha.height).toBeLessThanOrEqual(caixaDoTitulo.y);
    // Quando: desmarca "Reunião" e escreve o título
    await janela.getByRole('button', { name: 'Etiquetas', exact: true }).click();
    await page.getByRole('dialog', { name: 'Escolher etiquetas' }).getByRole('checkbox', { name: 'Reunião' }).uncheck();
    await page.keyboard.press('Escape');
    await escreverOTitulo(page, 'POP de atendimento');
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

  test('dada uma anotação nova com uma etiqueta marcada, quando a pessoa exclui a etiqueta no próprio painel e escreve o título, então a anotação nasce sem ela', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    await criarEtiquetaPeloIcone(page, anotacaoAberta(page), 'Transitória', 'Amarelo');
    await criarEtiquetaPeloIcone(page, anotacaoAberta(page), 'POP', 'Azul');
    // Quando: exclui "Transitória" pelo painel do ícone de etiqueta
    await anotacaoAberta(page).getByRole('button', { name: 'Etiquetas', exact: true }).click();
    const escolha = page.getByRole('dialog', { name: 'Escolher etiquetas' });
    await escolha.getByRole('button', { name: 'Mudar a etiqueta Transitória' }).click();
    const form = escolha.getByRole('form', { name: 'Mudar a etiqueta Transitória' });
    await form.getByRole('button', { name: 'Excluir' }).click();
    await form.getByRole('button', { name: 'Confirmar exclusão' }).click();
    await expect(escolha.getByRole('checkbox', { name: 'Transitória' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await escreverOTitulo(page, 'Ata sem a transitória');
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

// O pedido do dono (#370): no explorador, arrastar uma anotação e soltá-la numa pasta, ou em "Sem pasta", para tirá-la delas. Com
// o mouse, com o dedo, e pelo ⋯ da anotação ("Mover para pasta"), para quem usa o teclado.
test.describe('Arrastar a anotação para uma pasta, no explorador (#370)', () => {
  /** O meio de um elemento na tela. */
  async function meio(alvo: Locator) {
    const caixa = (await alvo.boundingBox())!;
    return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
  }
  /** Arrasta com o mouse a anotação do explorador até a linha da pasta (ou de "Sem pasta"), aos poucos, como uma pessoa. */
  async function arrastar(page: Page, titulo: string, destino: string) {
    const de = await meio(arvore(page).getByRole('link', { name: titulo }));
    await page.mouse.move(de.x, de.y);
    await page.mouse.down();
    await page.mouse.move(de.x + 10, de.y - 4, { steps: 3 });
    const para = await meio(arvore(page).getByRole('button', { name: destino, exact: true }));
    await page.mouse.move(para.x, para.y, { steps: 8 });
    await page.mouse.up();
  }
  /** A anotação dentro da pasta, no explorador. */
  const naPasta = (page: Page, pasta: string, titulo: string) =>
    arvore(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: pasta, exact: true }) }).getByRole('link', { name: titulo });

  test('dada uma anotação fora das pastas, quando a pessoa a arrasta com o mouse até uma pasta, então ela vai para a pasta, que abre para mostrá-la, e o Desfazer a devolve', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await criarPasta(page, 'Escritório');
    await criarAnotacao(page, 'Ata solta');
    await page.goto('/documentos/');
    await expect(arvore(page).getByRole('link', { name: 'Ata solta' })).toBeVisible();
    // Quando
    await arrastar(page, 'Ata solta', 'Escritório');
    // Então: ela está na pasta, no explorador e na tabela, e soltá-la não a abriu
    await expect(page.getByText('Anotação levada para a pasta Escritório.')).toBeVisible();
    await expect(arvore(page).getByRole('button', { name: 'O que está em Escritório' })).toHaveAttribute('aria-expanded', 'true');
    await expect(naPasta(page, 'Escritório', 'Ata solta')).toBeVisible();
    await expect(titulosNaTabela(page).filter({ hasText: 'Ata solta' })).toContainText('Escritório');
    await expect(anotacaoAberta(page)).toHaveCount(0);
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(titulosNaTabela(page).filter({ hasText: 'Ata solta' })).not.toContainText('Escritório');
    await expect(naPasta(page, 'Escritório', 'Ata solta')).toHaveCount(0);
  });

  test('dada uma anotação numa pasta, quando a pessoa a arrasta, então a linha do alto vira "Sem pasta", e soltá-la ali a tira das pastas', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await criarPasta(page, 'Escritório');
    await criarAnotacao(page, 'Ata da pasta', { endereco: '/documentos/nova/?pasta=' + await idDaPasta(page, 'Escritório') });
    await page.goto('/documentos/');
    await arvore(page).getByRole('button', { name: 'O que está em Escritório' }).click();
    // Quando: começa a arrastar
    const de = await meio(arvore(page).getByRole('link', { name: 'Ata da pasta' }));
    await page.mouse.move(de.x, de.y);
    await page.mouse.down();
    await page.mouse.move(de.x + 10, de.y - 4, { steps: 3 });
    // Então
    await expect(arvore(page).getByRole('button', { name: 'Sem pasta' })).toBeVisible();
    await expect(arvore(page).getByRole('button', { name: 'Todos os documentos' })).toHaveCount(0);
    // Quando
    const para = await meio(arvore(page).getByRole('button', { name: 'Sem pasta' }));
    await page.mouse.move(para.x, para.y, { steps: 8 });
    await page.mouse.up();
    // Então
    await expect(page.getByText('Anotação levada para fora das pastas.')).toBeVisible();
    await expect(arvore(page).getByRole('button', { name: 'Todos os documentos' })).toBeVisible();
    await expect(naPasta(page, 'Escritório', 'Ata da pasta')).toHaveCount(0);
    await expect(titulosNaTabela(page).filter({ hasText: 'Ata da pasta' })).not.toContainText('Escritório');
  });

  test('dada uma anotação, quando a pessoa usa só o teclado, então o ⋯ dela tem "Mover para pasta", que a leva para a pasta escolhida', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await criarPasta(page, 'Modelos');
    await criarAnotacao(page, 'Minuta');
    await page.goto('/documentos/');
    // Quando
    await arvore(page).getByRole('button', { name: 'Ações da anotação Minuta' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Mover para pasta' })).toBeFocused();
    await page.keyboard.press('Enter');
    const janela = page.getByRole('dialog', { name: 'Mover "Minuta" para a pasta' });
    await janela.getByRole('combobox', { name: 'Pasta' }).selectOption({ label: 'Modelos' });
    await janela.getByRole('button', { name: 'Mover' }).press('Enter');
    // Então
    await expect(page.getByText('Anotação levada para a pasta Modelos.')).toBeVisible();
    await expect(naPasta(page, 'Modelos', 'Minuta')).toBeVisible();
    // O foco fica na anotação, no lugar novo (e não no começo da página)
    await expect(naPasta(page, 'Modelos', 'Minuta')).toBeFocused();
  });

  test('dada uma anotação aberta, quando a pessoa usa "Mover para pasta" no ⋯ dela, então o caminho no topo mostra a pasta nova', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    await criarPasta(page, 'Modelos');
    const anotacao = await criarAnotacao(page, 'Minuta aberta');
    // Quando
    await noMenu(page, anotacao, 'Mover para pasta');
    const janela = page.getByRole('dialog', { name: 'Mover "Minuta aberta" para a pasta' });
    await janela.getByRole('combobox', { name: 'Pasta' }).selectOption({ label: 'Modelos' });
    await janela.getByRole('button', { name: 'Mover' }).click();
    // Então
    await expect(page.getByText('Anotação levada para a pasta Modelos.')).toBeVisible();
    await expect(caminho(anotacao).getByRole('link')).toHaveText(['Modelos']);
  });

  test('dado o celular, quando a pessoa segura o dedo numa anotação da gaveta e o leva até uma pasta, então ela vai para a pasta', async ({ browser, baseURL }) => {
    // Dado: um celular, com toque
    const contexto = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const page = await contexto.newPage();
    await page.goto('/documentos/');
    const gaveta = page.getByRole('button', { name: 'Pastas e anotações' });
    await gaveta.click();
    await arvore(page).getByRole('button', { name: 'Nova pasta' }).click();
    await page.getByRole('textbox', { name: 'Nova pasta' }).fill('Modelos');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Pasta "Modelos" criada.')).toBeVisible();
    // A pasta nova fica escolhida, e escolher uma pasta fecha a gaveta (como em qualquer pasta)
    await expect(gaveta).toHaveAttribute('aria-expanded', 'false');
    await criarAnotacao(page, 'Nota do celular');
    await page.goto('/documentos/');
    await page.getByRole('button', { name: 'Pastas e anotações' }).click();
    // Quando: segura o dedo na anotação e o leva até a pasta (o toque de verdade, pelo Chromium)
    const toque = await contexto.newCDPSession(page);
    const tocar = (type: 'touchStart' | 'touchMove' | 'touchEnd', pontos: { x: number; y: number }[]) => toque.send('Input.dispatchTouchEvent', { type, touchPoints: pontos });
    const de = await meio(arvore(page).getByRole('link', { name: 'Nota do celular' }));
    const para = await meio(arvore(page).getByRole('button', { name: 'Modelos', exact: true }));
    await tocar('touchStart', [de]);
    await expect(arvore(page).getByRole('button', { name: 'Sem pasta' })).toBeVisible();
    const passos = 8;
    for (let i = 1; i <= passos; i++) await tocar('touchMove', [{ x: de.x + (para.x - de.x) * i / passos, y: de.y + (para.y - de.y) * i / passos }]);
    await tocar('touchEnd', []);
    // Então
    await expect(page.getByText('Anotação levada para a pasta Modelos.')).toBeVisible();
    await expect(naPasta(page, 'Modelos', 'Nota do celular')).toBeVisible();
    await contexto.close();
  });

  test('dada uma anotação que um usuário comum só lê, quando ele a vê no explorador, então não há o ⋯ e arrastá-la não muda a pasta', async ({ page }) => {
    // Dado: o Mateus cria a pasta e uma anotação ligada à demanda em que o Bruno está; o Bruno só a lê
    await page.goto('/documentos/');
    await criarPasta(page, 'Modelos');
    await abrirComoQuemSoLe(page, 'Lida pelo Bruno', 'Texto');
    await page.goto('/documentos/');
    await expect(arvore(page).getByRole('link', { name: 'Lida pelo Bruno' })).toBeVisible();
    // Então
    await expect(arvore(page).getByRole('button', { name: 'Ações da anotação Lida pelo Bruno' })).toHaveCount(0);
    // Quando
    await arrastar(page, 'Lida pelo Bruno', 'Modelos');
    // Então: nada mudou
    await expect(page.getByText(/Anotação levada/)).toHaveCount(0);
    await expect(naPasta(page, 'Modelos', 'Lida pelo Bruno')).toHaveCount(0);
  });
});

test.describe('Formatar o texto de uma anotação já criada (#364): o clique escolhe a palavra que a pessoa vê', () => {
  // Antes da #368, os sinais escondidos (**, o "- " da bolinha, o endereço do link) apareciam na linha do cursor e empurravam o
  // texto, e o segundo clique (ou o fim do arrasto) caía em outra palavra: "só consigo formatar na hora de criar, não na hora de
  // editar". Agora eles nunca aparecem; estes testes conferem que o clique continua escolhendo a palavra que a pessoa vê.

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

  // A regra mudou (#369): a anotação nova vai ao banco ao escrever o título; a caixa de escrever continua a mesma.
  test('dada a anotação nova, logo depois de ir ao banco, quando a pessoa põe negrito numa linha que já tem negrito, depois de clicar em outra, então ele vai para a palavra clicada', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    await escreverOTitulo(page, 'Nova com negrito');
    const nota = anotacaoAberta(page), caixa = caixaDoTexto(nota);
    await porNoTexto(caixa, 'Contrato de **honorarios** assinado hoje\nCliente pediu revisao do valor');
    // Quando
    await clicarDepois(caixa, 'valor');
    await expect(caixa).not.toContainText('**');
    await cliqueDuplo(caixa, 'hoje');
    await negrito(nota).click();
    await caixa.press('Control+s');
    // Então
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

test.describe('Escrever na anotação sem moldura (#367)', () => {
  /** A cor de destaque (--accent), a do cursor. */
  const COR_DO_CURSOR = 'rgb(55, 125, 34)';
  /** Confere que o campo com o foco não tem moldura em volta, e que o cursor está na cor de destaque. */
  async function semMoldura(campo: Locator) {
    await expect(campo).toBeFocused();
    await expect(campo).toHaveCSS('outline-style', 'none');
    await expect(campo).toHaveCSS('caret-color', COR_DO_CURSOR);
  }

  test('dada a anotação nova, quando a pessoa escreve o título e desce para o texto pelo teclado, então nenhum dos dois ganha moldura, só o cursor verde', async ({ page }) => {
    // Dado
    await page.goto('/documentos/');
    // Quando: o cursor já começa no título
    await novaAnotacao(page).click();
    const nota = notaNova(page);
    // Então
    await semMoldura(nota.getByRole('textbox', { name: 'Título' }));
    // Quando: o Enter no título desce para o texto (e, desde a #369, leva a anotação ao banco: na mesma janela, ela passa a ter
    // o código no nome, e deixa de ser a "Anotação nova")
    await page.keyboard.type('Sem moldura');
    await page.keyboard.press('Enter');
    // Então
    await semMoldura(caixaDoTexto(anotacaoAberta(page)));
  });

  test('dada uma anotação aberta, quando a pessoa clica no texto e no título para mudá-los, então nenhum dos dois ganha moldura, e a caixa de comentar continua com a dela', async ({ page }) => {
    // Dado
    const anotacao = await criarAnotacao(page, 'Folha limpa', { texto: 'Um texto.' });
    // Quando
    await caixaDoTexto(anotacao).click();
    // Então
    await semMoldura(caixaDoTexto(anotacao));
    // Quando
    await anotacao.getByRole('button', { name: 'Folha limpa' }).click();
    // Então
    await semMoldura(anotacao.getByRole('textbox', { name: 'Título' }));
    // Quando: os outros campos guardam o contorno de foco
    const comentario = coluna(page).getByRole('textbox', { name: 'Escrever um comentário' });
    await comentario.click();
    // Então
    await expect(comentario).toBeFocused();
    await expect(comentario).toHaveCSS('outline-style', 'solid');
  });

  test('dado o cartão de uma demanda, quando a pessoa clica no título para mudá-lo, então ele continua com a moldura de sempre, que mostra que virou campo', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca');
    // Quando
    await cartao.getByRole('button', { name: 'Registro de marca', exact: true }).click();
    // Então
    const campo = cartao.getByRole('textbox', { name: 'Título' });
    await expect(campo).toBeFocused();
    await expect(campo).toHaveCSS('outline-style', 'solid');
  });
});

test.describe('O "Salvo" e o rodapé no pé da janela da anotação (#372)', () => {
  /** Até onde o pé fica do fim da janela: a folga embaixo do rodapé (24px) e um pouco mais. */
  const PERTO_DO_FIM = 48;
  /** Com texto curto, o pé fica longe do texto: bem mais que o vão entre as partes da anotação. */
  const LONGE_DO_TEXTO = 200;
  const ULTIMA_LINHA = 'Última linha do texto.';
  /** Um texto longo, inventado, que passa da altura da janela. */
  const TEXTO_LONGO = Array.from({ length: 40 }, (_, i) => `Parágrafo ${i + 1}: um texto de exemplo sobre o andamento do caso.`).join('\n\n') + '\n\n' + ULTIMA_LINHA;
  const situacao = (janela: Locator) => janela.getByRole('status', { name: 'Gravação do texto' });
  /** Quanto falta do fim de "alvo" ao fim da janela da anotação. */
  async function ateOFim(janela: Locator, alvo: Locator) {
    const [j, a] = [(await janela.boundingBox())!, (await alvo.boundingBox())!];
    return (j.y + j.height) - (a.y + a.height);
  }
  /** Confere que a linha da gravação e o rodapé estão à vista, nessa ordem, encostados no fim da janela. */
  async function noPe(janela: Locator, rodape: Locator) {
    await expect(situacao(janela)).toBeInViewport();
    await expect(rodape).toBeInViewport();
    const distancia = await ateOFim(janela, rodape);
    expect(distancia).toBeGreaterThanOrEqual(0);
    expect(distancia).toBeLessThanOrEqual(PERTO_DO_FIM);
    expect((await situacao(janela).boundingBox())!.y).toBeLessThan((await rodape.boundingBox())!.y);
  }
  /** Confere que "linha" termina antes de o pé começar (o pé não a cobre). */
  async function acimaDoPe(janela: Locator, linha: Locator) {
    const [l, s] = [(await linha.boundingBox())!, (await situacao(janela).boundingBox())!];
    expect(l.y + l.height).toBeLessThanOrEqual(s.y);
  }
  /** Rola o texto com a roda do mouse, por cima dele. */
  async function rolar(page: Page, janela: Locator, quanto: number) {
    const caixa = (await caixaDoTexto(janela).boundingBox())!;
    await page.mouse.move(caixa.x + caixa.width / 2, Math.min(caixa.y + caixa.height / 2, page.viewportSize()!.height / 2));
    await page.mouse.wheel(0, quanto);
    await esperarDesenhar(page);
  }
  /** A página e a janela não rolam para o lado. */
  async function semRolagemParaOLado(page: Page, janela: Locator) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await janela.evaluate(j => j.scrollWidth <= j.clientWidth)).toBe(true);
  }

  test('dada uma anotação com texto curto, quando ela abre ao lado e no centro, então o "Salvo" e o rodapé ficam no pé da janela, e não logo abaixo do texto', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    const janela = await criarAnotacao(page, 'Reunião com o cliente', { texto: 'Levar a procuração assinada.' });
    const rodape = janela.getByText(/^Atualizada /);
    const linhaDoTexto = caixaDoTexto(janela).getByText('Levar a procuração assinada.');
    for (const formato of ['Abrir no centro da tela', 'Abrir ao lado']) {
      // Quando
      await janela.getByRole('button', { name: formato }).click();
      await esperarParar(page);
      // Então
      await expect(situacao(janela)).toHaveText('Salvo');
      await noPe(janela, rodape);
      const [texto, linha] = [(await linhaDoTexto.boundingBox())!, (await situacao(janela).boundingBox())!];
      expect(linha.y).toBeGreaterThan(texto.y + texto.height + LONGE_DO_TEXTO);
      await semRolagemParaOLado(page, janela);
    }
  });

  test('dada uma anotação com texto curto numa janela estreita, quando ela abre no centro, então o "Salvo" e o rodapé ficam no pé da janela, e não logo abaixo do texto', async ({ page }) => {
    // Dado: com 900px ou menos, a janela no centro não tem a coluna, e quem rola é o conteúdo do cartão; alta, para o que fica
    // embaixo do texto (os comentários e as outras seções da coluna) não bastar para empurrar o pé até o fim da janela
    await page.setViewportSize({ width: 800, height: 1400 });
    const janela = await criarAnotacao(page, 'Reunião com o cliente', { texto: 'Levar a procuração assinada.' });
    const rodape = janela.getByText(/^Atualizada /);
    // Quando
    await janela.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    await esperarParar(page);
    // Então
    await expect(situacao(janela)).toHaveText('Salvo');
    await noPe(janela, rodape);
    const [texto, linha] = [(await caixaDoTexto(janela).getByText('Levar a procuração assinada.').boundingBox())!, (await situacao(janela).boundingBox())!];
    expect(linha.y).toBeGreaterThan(texto.y + texto.height + LONGE_DO_TEXTO);
    await semRolagemParaOLado(page, janela);
  });

  test('dada uma anotação com texto longo no centro, quando a pessoa rola o texto, então o "Salvo" e o rodapé continuam no pé e, no fim, não cobrem a última linha nem a que ela escreve', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    const janela = await criarAnotacao(page, 'Parecer longo', { texto: TEXTO_LONGO });
    await janela.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    await esperarParar(page);
    const rodape = janela.getByText(/^Atualizada /);
    // Então: com o texto no começo, o pé já está no fim da janela, por cima do resto do texto
    await noPe(janela, rodape);
    // Quando: a pessoa rola até o meio
    await rolar(page, janela, 1200);
    // Então
    await noPe(janela, rodape);
    // Quando: rola até o fim
    await rolar(page, janela, 20000);
    // Então: a última linha aparece inteira, logo acima do pé
    const ultima = caixaDoTexto(janela).getByText(ULTIMA_LINHA);
    await expect(ultima).toBeInViewport();
    await acimaDoPe(janela, ultima);
    await noPe(janela, rodape);
    // Quando: volta ao começo pelo teclado e desce até o fim, escrevendo uma linha nova
    await caixaDoTexto(janela).press('Control+Home');
    await caixaDoTexto(janela).press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Linha escrita agora');
    // Então: o texto acompanha o cursor sem deixar a linha escondida atrás do pé
    const nova = caixaDoTexto(janela).getByText('Linha escrita agora');
    await expect(nova).toBeInViewport();
    await acimaDoPe(janela, nova);
    await noPe(janela, rodape);
  });

  // No centro, com 900px ou menos, não há a coluna e quem rola é o conteúdo do cartão; ao lado, quem rola é o painel.
  for (const { onde, largura, formato } of [
    { onde: 'no centro, numa janela estreita', largura: 800, formato: 'Abrir no centro da tela' },
    { onde: 'ao lado', largura: 1440, formato: null }
  ]) {
    test(`dada uma anotação com texto longo ${onde}, quando a pessoa rola e escreve no fim, então o "Salvo" e o rodapé continuam no pé da janela, sem cobrir a linha`, async ({ page }) => {
      // Dado
      await page.setViewportSize({ width: largura, height: 900 });
      const janela = await criarAnotacao(page, 'Parecer longo', { texto: TEXTO_LONGO });
      if (formato) await janela.getByRole('button', { name: formato }).click();
      await expect(janela.getByRole('button', { name: formato ? 'Abrir ao lado' : 'Abrir no centro da tela' })).toBeVisible();
      await esperarParar(page);
      const rodape = janela.getByText(/^Atualizada /);
      // Então: com o texto no começo, o pé já está no fim da janela
      await noPe(janela, rodape);
      // Quando: a pessoa rola até o meio
      await rolar(page, janela, 1200);
      // Então
      await noPe(janela, rodape);
      // Quando: rola até o fim
      await rolar(page, janela, 20000);
      // Então: a última linha aparece inteira, logo acima do pé
      const ultima = caixaDoTexto(janela).getByText(ULTIMA_LINHA);
      await expect(ultima).toBeInViewport();
      await acimaDoPe(janela, ultima);
      await noPe(janela, rodape);
      // Quando: escreve uma linha nova no fim do texto
      await caixaDoTexto(janela).press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Linha escrita agora');
      // Então
      const nova = caixaDoTexto(janela).getByText('Linha escrita agora');
      await expect(nova).toBeInViewport();
      await acimaDoPe(janela, nova);
      await noPe(janela, rodape);
      await semRolagemParaOLado(page, janela);
    });
  }

  test('dada uma anotação que a pessoa só lê, quando ela a abre no centro e ao lado, então não há a linha da gravação e o rodapé fica no pé da janela', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    const janela = await abrirComoQuemSoLe(page, 'Anotação para ler', 'Um texto curto para ler.');
    const rodape = janela.getByText(/^Atualizada /);
    for (const formato of ['Abrir no centro da tela', 'Abrir ao lado']) {
      // Quando
      await janela.getByRole('button', { name: formato }).click();
      await esperarParar(page);
      // Então
      await expect(situacao(janela)).toHaveCount(0);
      await expect(rodape).toBeInViewport();
      const distancia = await ateOFim(janela, rodape);
      expect(distancia).toBeGreaterThanOrEqual(0);
      expect(distancia).toBeLessThanOrEqual(PERTO_DO_FIM);
    }
  });

  test('dada uma anotação com texto longo num celular, quando a pessoa rola e escreve no fim, então o "Salvo" e o rodapé continuam no pé da janela, sem cobrir a linha e sem rolagem para o lado', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 390, height: 844 });
    const janela = await criarAnotacao(page, 'Parecer no celular', { texto: TEXTO_LONGO });
    await esperarParar(page);
    const rodape = janela.getByText(/^Atualizada /);
    // Então
    await noPe(janela, rodape);
    await semRolagemParaOLado(page, janela);
    // Quando
    await rolar(page, janela, 1200);
    // Então
    await noPe(janela, rodape);
    // Quando: escreve no fim do texto
    await caixaDoTexto(janela).press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Linha escrita no celular');
    // Então
    const nova = caixaDoTexto(janela).getByText('Linha escrita no celular');
    await expect(nova).toBeInViewport();
    await acimaDoPe(janela, nova);
    await noPe(janela, rodape);
    await semRolagemParaOLado(page, janela);
  });

  test('dada uma anotação nova, quando a pessoa escreve, então a linha da gravação continua no mesmo lugar, no pé da janela', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/documentos/nova/');
    const janela = anotacaoAberta(page);
    await janela.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    await esperarParar(page);
    // Então: antes de escrever, o pé diz que ela ainda não foi gravada
    await expect(situacao(janela)).toHaveText('Ainda não gravada');
    await noPe(janela, janela.getByText(/^Anotação nova · gravada/));
    const antes = (await situacao(janela).boundingBox())!;
    // Quando
    await escreverOTitulo(page, 'Anotação escrita agora');
    await porNoTexto(caixaDoTexto(janela), 'Um texto curto.');
    await caixaDoTexto(janela).press('Control+s');
    // Então
    await expect(situacao(janela)).toHaveText('Salvo');
    await noPe(janela, janela.getByText(/^Atualizada /));
    expect(Math.abs((await situacao(janela).boundingBox())!.y - antes.y)).toBeLessThan(1);
  });
});

test.describe('A barra de formatação presa no alto da anotação ao rolar (#373)', () => {
  /** Um texto longo, inventado, que passa da altura da janela. */
  const TEXTO_LONGO = Array.from({ length: 40 }, (_, i) => `Parágrafo ${i + 1}: um texto de exemplo sobre o andamento do caso.`).join('\n\n');
  /** Quanto rolar para o texto chegar ao meio, já passado por baixo da barra. */
  const ATE_O_MEIO = 1200;
  const barra = (janela: Locator) => janela.getByRole('toolbar', { name: 'Formatação do texto' });
  /** Os botões da janela à vista: a etiqueta, o ⋯, o formato (que não há no celular) e o X. */
  async function botoesDaJanela(janela: Locator) {
    const todos = [
      janela.getByRole('button', { name: 'Etiquetas', exact: true }), janela.getByRole('button', { name: 'Mais ações' }),
      janela.getByRole('button', { name: /^Abrir (no centro da tela|ao lado)$/ }), janela.getByRole('button', { name: 'Fechar', exact: true })
    ];
    const visiveis: Locator[] = [];
    for (const b of todos) if (await b.isVisible()) visiveis.push(b);
    return visiveis;
  }
  const seCruzam = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  /**
   * O que aparece por cima de tudo em cada ponto da faixa do alto, do topo da janela até o fim da barra, na largura do texto: em
   * nenhum deles pode ser um pedaço do texto (ele passa por baixo da barra e do fundo dela, sem aparecer).
   */
  const textoNaFaixaDoAlto = (janela: Locator, alto: number, fimDaBarra: number) => caixaDoTexto(janela).evaluate((caixa, [de, ate]) => {
    const r = caixa.getBoundingClientRect(), achados: string[] = [];
    for (let y = Math.max(de, 0) + 1; y < ate; y += 4)
      for (const x of [r.left + 2, r.left + r.width / 4, r.left + r.width / 2])
        if (caixa.contains(document.elementFromPoint(x, y))) achados.push(`${Math.round(x)},${Math.round(y)}`);
    return achados;
  }, [alto, fimDaBarra]);
  /**
   * Onde está o cursor na tela: a linha em que ele pisca (num parágrafo que quebra em várias linhas, só a dele). Numa linha vazia,
   * sem letra para medir, vale o pedaço da caixa que guarda o cursor.
   */
  const ondeEstaOCursor = (janela: Locator) => caixaDoTexto(janela).evaluate(caixa => {
    const escolha = window.getSelection()!;
    const r = escolha.getRangeAt(0).getClientRects()[0];
    if (r?.height) return { y: r.top, height: r.height };
    let no = escolha.focusNode;
    while (no && no.parentNode !== caixa) no = no.parentNode;
    const linha = (no as Element).getBoundingClientRect();
    return { y: linha.top, height: linha.height };
  });

  for (const { onde, largura, altura, formato } of [
    { onde: 'no centro', largura: 1440, altura: 900, formato: 'Abrir no centro da tela' },
    { onde: 'ao lado', largura: 1440, altura: 900, formato: null },
    { onde: 'no celular', largura: 390, altura: 844, formato: null }
  ]) {
    test(`dada uma anotação com texto longo ${onde}, quando a pessoa rola o texto até o meio, então a barra de formatação continua à vista, com fundo sólido, sem o texto por trás e sem cobrir os botões da janela, e o X ainda fecha`, async ({ page }) => {
      // Dado
      await page.setViewportSize({ width: largura, height: altura });
      const janela = await criarAnotacao(page, 'Parecer longo', { texto: TEXTO_LONGO });
      if (formato) await janela.getByRole('button', { name: formato }).click();
      await esperarParar(page);
      // Quando: o texto volta ao começo e a pessoa rola, com a roda do mouse por cima dele, até o meio
      await caixaDoTexto(janela).press('Control+Home');
      const caixa = (await caixaDoTexto(janela).boundingBox())!;
      await page.mouse.move(caixa.x + caixa.width / 2, altura / 2);
      await page.mouse.wheel(0, ATE_O_MEIO);
      await esperarDesenhar(page);
      // Então: o texto já passou por baixo da barra, que continua à vista, dentro da janela
      await expect(barra(janela)).toBeInViewport();
      const [b, j] = [(await barra(janela).boundingBox())!, (await janela.boundingBox())!];
      expect((await caixaDoTexto(janela).boundingBox())!.y).toBeLessThan(b.y - ATE_O_MEIO / 2);
      expect(b.y).toBeGreaterThanOrEqual(j.y);
      // Então: o fundo dela é sólido (sem transparência), e o texto não aparece por trás dela nem acima dela
      const fundo = await barra(janela).evaluate(el => ({ cor: getComputedStyle(el).backgroundColor, opacidade: getComputedStyle(el).opacity }));
      expect(fundo.cor).toMatch(/^rgb\(/);
      expect(fundo.opacidade).toBe('1');
      expect(await textoNaFaixaDoAlto(janela, j.y, b.y + b.height)).toEqual([]);
      // Então: nenhum botão da janela fica embaixo da barra
      for (const botao of await botoesDaJanela(janela)) expect(seCruzam((await botao.boundingBox())!, b)).toBe(false);
      // Quando: a pessoa clica numa linha logo abaixo da barra e sobe com o cursor
      await page.mouse.click(caixa.x + caixa.width / 4, b.y + b.height + 40);
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await esperarDesenhar(page);
      // Então: o texto acompanha, e a linha do cursor não fica escondida atrás da barra
      expect((await ondeEstaOCursor(janela)).y).toBeGreaterThanOrEqual(b.y + b.height);
      // Quando: a pessoa clica no X
      await fecharAnotacao(page);
      // Então: a janela fecha
      await expect(janela).toHaveCount(0);
    });
  }
});

test.describe('A barra de formatação da anotação no celular, em duas linhas equilibradas (#374)', () => {
  /** O desenho de cada botão da barra no computador (a bolinha do .mini) e o vão entre dois deles, que não mudam. */
  const DESENHO_DO_BOTAO = 34;
  const VAO_NO_COMPUTADOR = 6;
  /** Quanto o toque fica para dentro do canto do alvo: ainda no alvo, mas fora da bolinha desenhada no meio dele. */
  const PERTO_DO_CANTO = 3;

  test('dada uma anotação aberta num celular, quando a pessoa olha a barra de formatação, então os botões ficam em duas linhas equilibradas, com o alvo do dedo de 44px por 44px, e o Link, o último, abre a janela do endereço com um toque fora do desenho dele', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 390, height: 844 });
    const janela = await criarAnotacao(page, 'Parecer no celular', { texto: 'Um texto curto.' });
    await esperarParar(page);
    // Então: nenhum botão sozinho numa segunda linha, e todos ao alcance
    await barraEquilibradaNoCelular(barraDeFormatacao(janela));
    // Quando: a pessoa toca no Link perto do canto de cima do alvo, fora da bolinha desenhada
    const link = (await botoesDaBarra(barraDeFormatacao(janela))).at(-1)!;
    expect(link.nome).toBe('Link');
    await page.mouse.click(link.x + PERTO_DO_CANTO, link.y + PERTO_DO_CANTO);
    // Então: a janela do endereço abre
    const endereco = page.getByRole('textbox', { name: 'Endereço do link' });
    await expect(endereco).toBeVisible();
    // Quando: a pessoa desiste
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // Então
    await expect(endereco).toHaveCount(0);
  });

  test('dada uma anotação aberta num celular bem estreito (320px), quando a pessoa olha a barra de formatação, então os botões continuam em duas linhas equilibradas, com o alvo do dedo de 44px por 44px e todos à vista', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 320, height: 640 });
    // Quando
    const janela = await criarAnotacao(page, 'Parecer no celular estreito', { texto: 'Um texto curto.' });
    await esperarParar(page);
    // Então
    await barraEquilibradaNoCelular(barraDeFormatacao(janela));
  });

  for (const formato of [null, 'Abrir no centro da tela']) {
    test(`dada uma anotação aberta no computador ${formato ? 'no centro' : 'ao lado'}, quando aparece, então a barra continua igual: os botões numa linha, com o desenho de sempre e o vão de sempre entre eles`, async ({ page }) => {
      // Dado
      await page.setViewportSize({ width: 1440, height: 900 });
      const janela = await criarAnotacao(page, 'Parecer no computador');
      if (formato) await janela.getByRole('button', { name: formato }).click();
      await esperarParar(page);
      // Quando
      const botoes = await botoesDaBarra(barraDeFormatacao(janela));
      // Então
      expect(new Set(botoes.map(b => Math.round(b.y))).size).toBe(1);
      for (const b of botoes) expect([b.width, b.height], b.nome).toEqual([DESENHO_DO_BOTAO, DESENHO_DO_BOTAO]);
      for (let i = 1; i < botoes.length; i++) expect(botoes[i].x - (botoes[i - 1].x + botoes[i - 1].width), botoes[i].nome).toBeCloseTo(VAO_NO_COMPUTADOR, 0);
    });
  }
});
