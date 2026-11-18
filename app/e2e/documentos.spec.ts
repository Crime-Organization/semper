// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Documentos (#303): anotações em Markdown ligadas a pessoas, processos, contratos, demandas, tarefas e compromissos.
// Na semente do banco fictício não há anotações. A demanda "Registro de marca" tem o Bruno (estagiário, não administrador)
// de colaborador; JOSÉ DA SILVA TESTE é uma pessoa do cadastro. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';

/** Escreve uma anotação pelo cadastro (aberto como página) e espera o cartão dela abrir. */
async function criarAnotacao(page: Page, titulo: string, { texto = '', compartilharCom = '', endereco = '/documentos/nova/' } = {}) {
  await page.goto(endereco);
  await page.getByLabel('Título').fill(titulo);
  if (texto) await page.getByLabel('Texto', { exact: true }).fill(texto);
  if (compartilharCom) {
    await page.getByRole('group', { name: 'Compartilhar com' }).getByRole('button', { name: 'Adicionar pessoa da equipe' }).click();
    await page.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: compartilharCom }).click();
  }
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
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
/** Abre o cartão de uma anotação pela página Documentos. */
async function abrirAnotacao(page: Page, titulo: string) {
  await page.goto('/documentos/');
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** O id de uma demanda da semente, lido do banco fictício da aba. */
const idDaDemanda = (page: Page, titulo: string) => page.evaluate(([chave, t]) =>
  (JSON.parse(sessionStorage.getItem(chave)!) as { demandas: { id: string; titulo: string }[] }).demandas.find(d => d.titulo === t)!.id, [CHAVE, titulo]);
/** As anotações na tabela da página, pelo título. */
const titulosNaTabela = (page: Page) => page.getByRole('table').getByRole('row').filter({ has: page.getByRole('cell') });

test.describe('Anotações no cartão de um item', () => {
  test('dado o cartão de uma demanda, quando a pessoa escreve uma anotação pelo "+" da seção, então ela nasce ligada e o número aparece com a seção fechada', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page, 'Registro de marca');
    const secao = cartao.getByRole('button', { name: /^Anotações/ });
    await expect(secao).toHaveAttribute('aria-expanded', 'false');
    await expect(secao).toHaveText(/^Anotações\s*0$/);
    // Quando
    await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
    const janela = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(janela.getByText('Será ligada a: Demanda Registro de marca')).toBeVisible();
    await janela.getByLabel('Título').fill('Estratégia do registro');
    await janela.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então: a janela fecha e o cartão da demanda mostra a anotação
    await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
    await expect(janela).toBeHidden();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
    await abrirSecao(cartao, 'Anotações');
    await cartao.getByRole('list', { name: 'Anotações ligadas' }).getByRole('link', { name: /Estratégia do registro/ }).click();
    // E o link abre o cartão da anotação, que mostra a demanda ligada
    const anotacao = page.getByRole('dialog');
    await expect(anotacao.getByRole('heading', { name: 'Estratégia do registro', level: 2 })).toBeVisible();
    await abrirSecao(anotacao, 'Ligada a');
    await expect(anotacao.getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /Registro de marca/ })).toContainText('Demanda');
  });

  test('dada uma anotação, quando a pessoa a liga a mais itens, então ela aparece no cartão de cada um e o cartão dela mostra todos', async ({ page }) => {
    // Dado
    let cartao = await criarAnotacao(page, 'Reunião com o cliente');
    await abrirSecao(cartao, 'Ligada a');
    await expect(cartao.getByText('Esta anotação não está ligada a nenhum item.')).toBeVisible();
    // Quando: liga a uma pessoa e a uma demanda
    await cartao.getByRole('button', { name: 'Ligar a outro item' }).click();
    await cartao.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await cartao.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await expect(page.getByText('Ligada a pessoa: JOSÉ DA SILVA TESTE.')).toBeVisible();
    await cartao.getByRole('button', { name: 'Ligar a outro item' }).click();
    await cartao.getByRole('combobox', { name: 'Tipo de item' }).selectOption('demandas');
    await cartao.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('registro de marca');
    await cartao.getByRole('button', { name: /Registro de marca/ }).click();
    // Então: o cartão da anotação mostra os dois
    const ligados = cartao.getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(cartao.getByRole('button', { name: /^Ligada a/ })).toHaveText(/^Ligada a\s*2$/);
    // E a tabela diz a que ela está ligada
    await expect(page.getByRole('row').filter({ hasText: 'Reunião com o cliente' })).toContainText('Pessoas, Demandas');
    // E cada cartão ligado mostra a anotação
    await ligados.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ }).click();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
    cartao = await abrirDemanda(page, 'Registro de marca');
    await abrirSecao(cartao, 'Anotações');
    await expect(cartao.getByRole('link', { name: /Reunião com o cliente/ })).toBeVisible();
    // Quando: desliga a pessoa
    cartao = await abrirAnotacao(page, 'Reunião com o cliente');
    await cartao.getByRole('button', { name: 'Desligar JOSÉ DA SILVA TESTE' }).click();
    // Então
    await expect(cartao.getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'Reunião com o cliente' })).toContainText('Demandas');
  });
});

test.describe('O texto da anotação', () => {
  test('quando a pessoa escreve títulos, negrito, itálico, listas e links, então o cartão mostra o texto formatado, sem as marcas e sem virar código de página', async ({ page }) => {
    // Dado / Quando
    const cartao = await criarAnotacao(page, 'Plano do caso', { texto: [
      '# Objetivo', 'Juntar a **procuração** e o *comprovante*.', '## Passos', '- Pedir o RG', '- Conferir o CPF',
      'Veja [o site do tribunal](https://www.exemplo.jus.br/consulta).', '<script>alert(1)</script> <img src=x onerror=alert(2)>'
    ].join('\n') });
    // Então
    await expect(cartao.getByRole('heading', { name: 'Objetivo', level: 3 })).toBeVisible();
    await expect(cartao.getByRole('heading', { name: 'Passos', level: 4 })).toBeVisible();
    await expect(cartao.locator('strong', { hasText: 'procuração' })).toBeVisible();
    await expect(cartao.locator('em', { hasText: 'comprovante' })).toBeVisible();
    await expect(cartao.getByRole('listitem').filter({ hasText: 'Pedir o RG' })).toBeVisible();
    const link = cartao.getByRole('link', { name: 'o site do tribunal' });
    await expect(link).toHaveAttribute('href', 'https://www.exemplo.jus.br/consulta');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(cartao.getByText('**procuração**')).toHaveCount(0);
    await expect(cartao.getByText('# Objetivo')).toHaveCount(0);
    // O que parece código de página aparece como texto
    await expect(cartao.getByText('<script>alert(1)</script>', { exact: false })).toBeVisible();
    await expect(cartao.locator('script, img')).toHaveCount(0);
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
    // Então
    await expect(titulosNaTabela(page)).toHaveCount(1);
    await expect(titulosNaTabela(page)).toContainText('Parecer sobre a ação');
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
    let cartao = await abrirAnotacao(page, 'Da demanda do Bruno');
    await expect(cartao.getByText('Você vê esta anotação porque vê um item ligado a ela.', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Arquivar' })).toHaveCount(0);
    await abrirSecao(cartao, 'Ligada a');
    await expect(cartao.getByRole('button', { name: 'Ligar a outro item' })).toHaveCount(0);
    // Já a compartilhada com ele, ele altera
    cartao = await abrirAnotacao(page, 'Para o Bruno');
    await expect(cartao.getByRole('button', { name: 'Arquivar' })).toBeVisible();
    // E pelo endereço, a anotação alheia não abre
    const so = await page.evaluate(chave => (JSON.parse(sessionStorage.getItem(chave)!) as { anotacoes: { id: string; titulo: string }[] })
      .anotacoes.find(a => a.titulo === 'Só do Mateus')!.id, CHAVE);
    await page.goto('/documentos/?id=' + so);
    await expect(page.getByText('Esta anotação não foi encontrada.', { exact: false })).toBeVisible();
  });
});

/** Liga a chave "equipe_ve_tudo" do escritório fictício. */
const equipeVeTudo = (page: Page) => page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));

test.describe('O cadastro e o cartão da anotação, nos casos de canto', () => {
  test('dado um endereço de cadastro com um item que não existe mais, quando a pessoa salva, então a anotação é cadastrada sem ligação, como o aviso promete', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/?demanda=demanda-que-nao-existe');
    await expect(page.getByText('O item de onde você veio não foi encontrado. A anotação será salva sem ligação.')).toBeVisible();
    // Quando
    await page.getByLabel('Título').fill('Sem a demanda');
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    // Então
    await expect(page.getByText(/Anotação \w+ cadastrada\./)).toBeVisible();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Ligada a');
    await expect(cartao.getByText('Esta anotação não está ligada a nenhum item.')).toBeVisible();
  });

  test('dada uma anotação com texto, quando a pessoa muda o texto, então o histórico diz só "Texto alterado"', async ({ page }) => {
    // Dado
    const cartao = await criarAnotacao(page, 'Texto que muda', { texto: 'Primeira versão' });
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByLabel('Texto', { exact: true }).fill('Segunda versão');
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(cartao.getByText('Segunda versão')).toBeVisible();
    // Então
    await abrirSecao(cartao, 'Histórico de alterações');
    const historico = cartao.getByRole('list').filter({ hasText: 'Texto' }).last();
    await expect(historico).toContainText('Texto alterado');
    await expect(historico).not.toContainText('alterado → alterado');
  });

  test('dada a chave "equipe_ve_tudo", quando um usuário comum abre a anotação de outra pessoa sem item ligado, então a nota diz que ele a vê pela equipe, e não por um item', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Vista pela equipe');
    await equipeVeTudo(page);
    // Quando
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirAnotacao(page, 'Vista pela equipe');
    // Então
    await expect(cartao.getByText('Toda a equipe vê as anotações do escritório', { exact: false })).toBeVisible();
    await expect(cartao.getByText('porque vê um item ligado', { exact: false })).toHaveCount(0);
  });

  test('dada uma anotação sem texto, quando é arquivada, então o cartão não manda escrever pelo lápis, que não aparece na arquivada', async ({ page }) => {
    // Dado
    const cartao = await criarAnotacao(page, 'Vazia e arquivada');
    // Quando
    await cartao.getByRole('button', { name: 'Arquivar' }).click();
    // Então
    await expect(cartao.getByText('Anotação arquivada.', { exact: false }).first()).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(cartao.getByText('Sem texto ainda.')).toBeVisible();
    await expect(cartao.getByText('Escreva pelo lápis do cartão.', { exact: false })).toHaveCount(0);
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

  test('dado um usuário comum com quem a anotação foi compartilhada, quando ele se tira de "Compartilhar com" e salva, então sai de verdade e a saída fica no histórico', async ({ page }) => {
    // Dado
    await criarAnotacao(page, 'Para o Bruno sair', { compartilharCom: 'Bruno Exemplo Souza' });
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirAnotacao(page, 'Para o Bruno sair');
    // Quando
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByRole('group', { name: 'Compartilhar com' }).getByRole('button', { name: 'Tirar Bruno Exemplo Souza' }).click();
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Você saiu dela, e a saída ficou no histórico.' })).toBeVisible();
    await page.goto('/documentos/');
    await expect(page.getByRole('row').filter({ hasText: 'Para o Bruno sair' })).toHaveCount(0);
    await entrarComo(page, 'u-master');
    const doMateus = await abrirAnotacao(page, 'Para o Bruno sair');
    await abrirSecao(doMateus, 'Histórico de alterações');
    await expect(doMateus.getByText(/Compartilhada com/).last()).toBeVisible();
  });
});

test.describe('O texto da anotação com o Markdown completo (#344)', () => {
  test('dada uma anotação com "- [ ] item", quando a pessoa clica na caixinha, então ela fica marcada e continua marcada ao reabrir', async ({ page }) => {
    // Dado
    let cartao = await criarAnotacao(page, 'Lista do protocolo', { texto: 'Levar:\n- [ ] Procuração\n- [x] Comprovante' });
    const procuracao = cartao.getByRole('checkbox', { name: 'Procuração' });
    await expect(procuracao).not.toBeChecked();
    await expect(cartao.getByRole('checkbox', { name: 'Comprovante' })).toBeChecked();
    // Quando
    await procuracao.click();
    // Então
    await expect(page.getByText('Anotação atualizada.')).toBeVisible();
    await expect(procuracao).toBeChecked();
    // Quando: reabre a anotação
    cartao = await abrirAnotacao(page, 'Lista do protocolo');
    // Então
    await expect(cartao.getByRole('checkbox', { name: 'Procuração' })).toBeChecked();
    await expect(cartao.getByRole('checkbox', { name: 'Comprovante' })).toBeChecked();
    // E o texto guardado mudou junto
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await expect(cartao.getByLabel('Texto', { exact: true })).toHaveValue('Levar:\n- [x] Procuração\n- [x] Comprovante');
  });

  test('dada uma anotação com caixinhas, quando quem só a lê abre o cartão, então as caixinhas aparecem, mas não se marcam', async ({ page }) => {
    // Dado: o Mateus escreve uma anotação ligada a uma demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Conferência do registro', { texto: '- [ ] Ver o INPI', endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirAnotacao(page, 'Conferência do registro');
    // Então
    const caixinha = cartao.getByRole('checkbox', { name: 'Ver o INPI' });
    await expect(caixinha).toBeDisabled();
    await expect(caixinha).not.toBeChecked();
  });

  test('quando a pessoa escreve lista numerada, citação, tachado, código, divisória e tabela, então o cartão mostra cada um formatado, sem as marcas', async ({ page }) => {
    // Dado / Quando
    const cartao = await criarAnotacao(page, 'Resumo da audiência', { texto: [
      '1. Abertura', '2. Depoimentos', '> O juiz disse que ~~não~~ vai decidir hoje.', '---', 'Comando: `**não** é negrito`',
      '```', '<script>alert(1)</script>', '```', '| Parte | Valor |', '|---|--:|', '| Autor | R$ 10 |'
    ].join('\n') });
    // Então
    await expect(cartao.getByRole('list').filter({ hasText: 'Abertura' }).getByRole('listitem')).toHaveText(['Abertura', 'Depoimentos']);
    await expect(cartao.locator('blockquote')).toHaveText('O juiz disse que não vai decidir hoje.');
    await expect(cartao.locator('del', { hasText: 'não' })).toBeVisible();
    await expect(cartao.getByRole('separator')).toBeVisible();
    await expect(cartao.locator('code', { hasText: '**não** é negrito' })).toBeVisible();
    await expect(cartao.locator('pre')).toHaveText('<script>alert(1)</script>');
    await expect(cartao.locator('script')).toHaveCount(0);
    const tabela = cartao.getByRole('table');
    await expect(tabela.getByRole('columnheader')).toHaveText(['Parte', 'Valor']);
    await expect(tabela.getByRole('cell')).toHaveText(['Autor', 'R$ 10']);
    await expect(cartao.getByText('|---|')).toHaveCount(0);
  });
});

/** Clica em "Baixar .md" no cartão e devolve o nome e o conteúdo do arquivo baixado. */
async function baixarMd(page: Page, cartao: ReturnType<Page['getByRole']>) {
  const baixando = page.waitForEvent('download');
  await cartao.getByRole('button', { name: 'Baixar .md' }).click();
  const download = await baixando;
  const conteudo = Buffer.concat(await (await download.createReadStream()).toArray()).toString('utf8');
  return { nome: download.suggestedFilename(), conteudo };
}

test.describe('Baixar a anotação em .md (#345)', () => {
  test('dada uma anotação, quando a pessoa clica em "Baixar .md", então baixa um arquivo com o nome do título e, no topo, as propriedades; depois, o título e o texto como foram escritos', async ({ page }) => {
    // Dado: uma anotação ligada a uma demanda
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    const texto = 'Levar:\n- [ ] Procuração\n\n---\n\n**Atenção:** prazo "fatal".';
    const cartao = await criarAnotacao(page, 'Reunião: cliente', { texto, endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    const { nome, conteudo } = await baixarMd(page, cartao);
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

  test('dada uma anotação que a pessoa só lê, quando abre o cartão, então também pode baixá-la, sem os botões de mudar', async ({ page }) => {
    // Dado: o Mateus escreve uma anotação ligada a uma demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    await criarAnotacao(page, 'Estratégia da marca', { texto: 'Pedir o registro.', endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirAnotacao(page, 'Estratégia da marca');
    // Então
    await expect(cartao.getByRole('button', { name: 'Arquivar' })).toHaveCount(0);
    const { nome, conteudo } = await baixarMd(page, cartao);
    expect(nome).toBe('Estratégia da marca.md');
    expect(conteudo).toContain('\n# Estratégia da marca\n\nPedir o registro.');
  });
});

test.describe('Duplicar a anotação (#343)', () => {
  test('dada uma anotação ligada a dois itens e já alterada, quando a pessoa usa "Duplicar", então abre a cópia com "(cópia)" no título, o mesmo texto, os dois itens e histórico próprio, e a original continua igual', async ({ page }) => {
    // Dado: uma anotação ligada a uma demanda e a uma pessoa, com uma caixinha marcada (uma alteração no histórico)
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    let cartao = await criarAnotacao(page, 'Plano da audiência', { texto: 'Levar:\n- [ ] A **procuração**', endereco: '/documentos/nova/?demanda=' + demanda });
    await abrirSecao(cartao, 'Ligada a');
    await cartao.getByRole('button', { name: 'Ligar a outro item' }).click();
    await cartao.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('josé da silva');
    await cartao.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await expect(cartao.getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(2);
    await cartao.getByRole('checkbox', { name: /procuração/ }).click();
    await expect(page.getByText('Anotação atualizada.')).toBeVisible();
    const historico = (c: typeof cartao) => c.getByRole('button', { name: /^Histórico de alterações/ });
    await expect(historico(cartao)).toHaveText(/^Histórico de alterações\s*1$/);
    // Quando
    await cartao.getByRole('button', { name: 'Duplicar' }).click();
    // Então: o aviso diz de qual para qual, e abre o cartão da cópia, com o texto gravado e sem histórico
    const aviso = page.getByText(/Anotação \w+ duplicada como \w+\./);
    await expect(aviso).toBeVisible();
    const [, codigoDaOriginal, codigoDaCopia] = /Anotação (\w+) duplicada como (\w+)\./.exec((await aviso.textContent())!)!;
    expect(codigoDaCopia).not.toBe(codigoDaOriginal);
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Plano da audiência (cópia)', level: 2 })).toBeVisible();
    await expect(cartao.getByText(codigoDaCopia, { exact: true })).toBeVisible();
    await expect(cartao.getByText('procuração', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('checkbox', { name: /procuração/ })).toBeChecked();
    await expect(historico(cartao)).toHaveText(/^Histórico de alterações\s*0$/);
    await abrirSecao(cartao, 'Ligada a');
    let ligados = cartao.getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(ligados.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(ligados.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    // E a original continua igual, com o código e o histórico dela
    await page.goto('/documentos/');
    await expect(titulosNaTabela(page).filter({ hasText: 'Plano da audiência' })).toHaveCount(2);
    await titulosNaTabela(page).filter({ hasText: 'Plano da audiência' }).filter({ hasNotText: '(cópia)' }).click();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Plano da audiência', exact: true, level: 2 })).toBeVisible();
    await expect(cartao.getByText(codigoDaOriginal, { exact: true })).toBeVisible();
    await expect(cartao.getByRole('checkbox', { name: /procuração/ })).toBeChecked();
    await abrirSecao(cartao, 'Ligada a');
    ligados = cartao.getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(2);
    await expect(historico(cartao)).toHaveText(/^Histórico de alterações\s*1$/);
  });

  test('dada uma anotação que a pessoa só lê, ligada a um item que ela não vê, quando duplica, então a cópia é dela e leva só o item que ela vê', async ({ page }) => {
    // Dado: o Mateus liga a anotação à demanda em que o Bruno está e a outra, em que ele não está
    await page.goto('/inicio/');
    const demanda = await idDaDemanda(page, 'Registro de marca');
    let cartao = await criarAnotacao(page, 'Roteiro do registro', { texto: 'Conferir a classe.', endereco: '/documentos/nova/?demanda=' + demanda });
    await abrirSecao(cartao, 'Ligada a');
    await cartao.getByRole('button', { name: 'Ligar a outro item' }).click();
    await cartao.getByRole('combobox', { name: 'Tipo de item' }).selectOption('demandas');
    await cartao.getByRole('textbox', { name: 'Buscar item para ligar' }).fill('busca de anterioridade');
    await cartao.getByRole('button', { name: /Busca de anterioridade/ }).click();
    await expect(cartao.getByRole('list', { name: 'Itens ligados' }).getByRole('link')).toHaveCount(2);
    await entrarComo(page, 'u-bruno');
    cartao = await abrirAnotacao(page, 'Roteiro do registro');
    await abrirSecao(cartao, 'Ligada a');
    await expect(cartao.getByText('Há 1 item ligado aqui que você não tem acesso para abrir.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    // Quando
    await cartao.getByRole('button', { name: 'Duplicar' }).click();
    // Então: a cópia abre, o Bruno pode mudá-la, é o responsável e só a demanda dele foi junto
    await expect(page.getByText(/Anotação \w+ duplicada como \w+\./)).toBeVisible();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Roteiro do registro (cópia)', level: 2 })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(cartao.getByRole('group', { name: 'Equipe' }).getByRole('button', { name: /, Responsável$/ })).toHaveAccessibleName(/^Bruno/);
    await abrirSecao(cartao, 'Ligada a');
    const ligados = cartao.getByRole('list', { name: 'Itens ligados' });
    await expect(ligados.getByRole('link')).toHaveCount(1);
    await expect(ligados.getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(cartao.getByText(/que você não tem acesso para abrir/)).toHaveCount(0);
  });
});

test.describe('A janela da anotação no centro (#340)', () => {
  /** A janela do cartão, já parada (depois de terminar de abrir), em relação à tela. */
  async function caixaDaJanela(page: Page) {
    const j = (await page.getByRole('dialog').boundingBox())!, tela = page.viewportSize()!;
    return {
      largura: j.width / tela.width, altura: j.height / tela.height,
      esquerda: Math.round(j.x), direita: Math.round(tela.width - j.x - j.width), topo: Math.round(j.y), embaixo: Math.round(tela.height - j.y - j.height),
      meio: j.x + j.width / 2, larguraEmPx: Math.round(j.width)
    };
  }

  test('dada uma anotação num computador, quando a pessoa a abre no centro, então a janela ocupa quase toda a tela, com uma margem estreita em volta, e não tem a coluna dos comentários', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    const cartao = await criarAnotacao(page, 'Parecer sobre o registro', { texto: 'Um texto para ler e escrever, na medida de leitura.' });
    // Quando
    await cartao.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Então: quase a tela toda, mas com a página de trás à vista nos quatro lados
    await expect(cartao.getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
    // (espera a janela terminar de ir para o meio: aí as margens dos lados ficam iguais)
    await expect.poll(async () => { const c = await caixaDaJanela(page); return c.esquerda - c.direita; }).toBe(0);
    const caixa = await caixaDaJanela(page);
    expect(caixa.largura).toBeGreaterThan(.85);
    expect(caixa.altura).toBeGreaterThan(.85);
    for (const margem of [caixa.esquerda, caixa.direita, caixa.topo, caixa.embaixo]) expect(margem).toBeGreaterThan(0);
    // E sem a coluna da direita: nada de comentários, e o conteúdo do cartão fica no meio da janela, e não espremido à esquerda dela
    await expect(cartao.getByRole('region', { name: 'Comentários' })).toHaveCount(0);
    await expect(cartao.getByRole('textbox', { name: 'Escrever um comentário' })).toHaveCount(0);
    const secao = (await cartao.getByRole('button', { name: /^Ligada a/ }).boundingBox())!;
    expect(Math.abs(secao.x + secao.width / 2 - caixa.meio)).toBeLessThan(caixa.larguraEmPx * .05);
    // E o texto continua na medida de leitura, sem esticar pela janela toda
    const texto = (await cartao.getByText('Um texto para ler e escrever, na medida de leitura.').boundingBox())!;
    expect(texto.width).toBeLessThan(caixa.larguraEmPx / 2);
  });

  test('dada a anotação no centro, quando ela abre num celular, então ocupa a largura toda, encostada embaixo, como os outros cartões', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    const cartao = await criarAnotacao(page, 'Parecer no celular');
    await cartao.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Quando
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirAnotacao(page, 'Parecer no celular');
    // Então
    await expect.poll(async () => (await caixaDaJanela(page)).larguraEmPx).toBe(390);
    await expect.poll(async () => (await caixaDaJanela(page)).embaixo).toBe(0);
    await expect(page.getByRole('button', { name: /Abrir (no centro da tela|ao lado)/ })).toBeHidden();
  });
});
