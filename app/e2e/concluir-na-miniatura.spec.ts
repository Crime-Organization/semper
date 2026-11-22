// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O círculo de concluir antes do título (#350), como no Trello: na miniatura do quadro e na linha da tabela de Tarefas e de
// Demandas. Na semente do banco fictício, "Renovar a procuração" é uma tarefa avulsa da Ana, em "Para fazer", com o prazo vencido;
// a demanda "Registro de marca" tem "Pedir documentos ao cliente" (Para fazer), "Emitir a GRU" (Fazendo) e "Organizar a pasta"
// (Concluída); a demanda "Notificar o devedor" está em "Para fazer", vencida, e "Busca de anterioridade" não tem o Bruno. Quem está
// logado é o Mauro (administrador). O círculo é achado como botão dentro da lista da coluna: o cartão da demanda tem caixas de
// marcar com o mesmo nome ("Concluir <título>").
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ALVO_DE_TOQUE, entrarComo } from './ajudantes';

type Modulo = 'tarefas' | 'demandas';

/** Abre o quadro (Kanban) ou a tabela do módulo. */
async function abrirModulo(page: Page, modulo: Modulo, visao: 'Kanban' | 'Tabela') {
  await page.goto(`/${modulo}/`);
  await page.getByRole('button', { name: visao }).click();
}
/** A miniatura do item na coluna do quadro, pelo título inteiro: o texto da miniatura junta o título e o código, e só um pedaço
 *  ("Fictícia longa 30") também acharia outra ("Fictícia longa 3" com um código que começa por 0). */
const miniatura = (page: Page, coluna: string, titulo: string) =>
  page.getByRole('list', { name: coluna, exact: true }).getByRole('listitem').filter({ has: page.getByText(titulo, { exact: true }) });
/** O círculo de concluir (ou de reabrir) do item, dentro de um lugar (a miniatura ou a linha). */
const circulo = (lugar: ReturnType<Page['getByRole']>, acao: 'Concluir' | 'Reabrir', titulo: string) =>
  lugar.getByRole('button', { name: `${acao} ${titulo}`, exact: true });
/** O mouse longe do quadro (sem hover em miniatura nenhuma). */
const mouseLonge = (page: Page) => page.mouse.move(0, 0);

/** Nenhum cartão aberto: nem no endereço, nem na tela. */
async function semCartaoAberto(page: Page) {
  await expect(page).not.toHaveURL(/[?&]id=/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Liga "toda a equipe vê os cartões" (#271): assim o Bruno lê os itens em que não está, sem poder alterá-los. */
async function ligarEquipeVeTudo(page: Page) {
  await page.goto('/inicio/');
  await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
}

test.describe('Concluir pelo círculo no quadro de Tarefas', () => {
  test('dada uma tarefa vencida, quando a pessoa passa o mouse e clica no círculo, então ela é concluída sem abrir o cartão, e o círculo fica verde à vista', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Kanban');
    const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
    await expect(cartao).toContainText('Prazo vencido');
    await mouseLonge(page);
    await expect(circulo(cartao, 'Concluir', 'Renovar a procuração')).toBeHidden();
    // Quando
    await cartao.hover();
    await expect(circulo(cartao, 'Concluir', 'Renovar a procuração')).toBeVisible();
    await circulo(cartao, 'Concluir', 'Renovar a procuração').click();
    // Então
    await expect(page.getByRole('status').getByText('Tarefa concluída.')).toBeVisible();
    const concluida = miniatura(page, 'Concluída', 'Renovar a procuração');
    await expect(concluida).toContainText('Concluída · Prazo:');
    await expect(concluida).not.toContainText('Prazo vencido');
    await semCartaoAberto(page);
    await mouseLonge(page);
    await expect(circulo(concluida, 'Reabrir', 'Renovar a procuração')).toBeVisible();
  });

  test('dada uma tarefa concluída, quando a pessoa a reabre pelo círculo e depois desfaz, então ela volta ao início com o aviso, e o Desfazer a leva de volta', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Kanban');
    const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
    await cartao.hover();
    await circulo(cartao, 'Concluir', 'Renovar a procuração').click();
    const concluida = miniatura(page, 'Concluída', 'Renovar a procuração');
    // Quando
    await circulo(concluida, 'Reabrir', 'Renovar a procuração').click();
    // Então
    await expect(page.getByRole('status').getByText('Tarefa reaberta em "Para fazer".')).toBeVisible();
    await expect(miniatura(page, 'Para fazer', 'Renovar a procuração')).toContainText('Prazo vencido');
    await semCartaoAberto(page);
    // Quando
    await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect(miniatura(page, 'Concluída', 'Renovar a procuração')).toContainText('Concluída · Prazo:');
    await expect(miniatura(page, 'Para fazer', 'Renovar a procuração')).toHaveCount(0);
  });

  test('dada a miniatura alcançada pelo teclado, quando a pessoa vai ao círculo e aperta Enter, então conclui sem abrir o cartão e o foco segue o item', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Kanban');
    await mouseLonge(page);
    const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
    await cartao.focus();
    await expect(circulo(cartao, 'Concluir', 'Renovar a procuração')).toBeVisible();
    // Quando
    await page.keyboard.press('Tab');
    await expect(circulo(cartao, 'Concluir', 'Renovar a procuração')).toBeFocused();
    await page.keyboard.press('Enter');
    // Então
    await expect(page.getByRole('status').getByText('Tarefa concluída.')).toBeVisible();
    await expect(circulo(miniatura(page, 'Concluída', 'Renovar a procuração'), 'Reabrir', 'Renovar a procuração')).toBeFocused();
    await semCartaoAberto(page);
  });

  for (const espera of [120, 400]) {
    test(`dada a primeira tarefa de "Para fazer", quando a pessoa dá um clique duplo no círculo (${espera} ms entre os cliques), então só ela é concluída, e não a que sobe para o lugar dela`, async ({ page }) => {
      // Dado
      await abrirModulo(page, 'tarefas', 'Kanban');
      const pedir = miniatura(page, 'Para fazer', 'Pedir documentos ao cliente');
      await pedir.hover();
      await circulo(pedir, 'Concluir', 'Pedir documentos ao cliente').hover();
      // Quando
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(espera);
      await page.mouse.down({ clickCount: 2 });
      await page.mouse.up({ clickCount: 2 });
      // Então
      await expect(miniatura(page, 'Concluída', 'Pedir documentos ao cliente')).toBeVisible();
      await expect(miniatura(page, 'Para fazer', 'Renovar a procuração')).toContainText('Prazo vencido');
      await expect(page.getByRole('status').getByText('Tarefa concluída.')).toHaveCount(1);
      // Quando: mais um clique, sem mexer o mouse, no círculo que apareceu embaixo dele
      await page.mouse.down();
      await page.mouse.up();
      // Então: não era nele que a pessoa mirava
      await expect(page.getByRole('status').getByText('Tarefa concluída.')).toHaveCount(1);
      await expect(miniatura(page, 'Para fazer', 'Renovar a procuração')).toBeVisible();
    });
  }

  test.describe('Coluna longa', () => {
    // Tela larga: "Para fazer" e "Concluída" à vista.
    test.use({ viewport: { width: 1600, height: 900 } });
    /** Mais tarefas do que o quadro mostra de uma vez (POR_COLUNA, 30): em "Concluída" e, depois das da semente, em "Para fazer".
     *  Números diferentes, para o "Carregar mais" de cada coluna ter um nome só dele. */
    const FEITAS = 31, LONGAS = 32;
    /** Depois de "Renovar a procuração" sair, "Para fazer" mostra 29 das 33 (as 2 da semente menos ela, mais as LONGAS). */
    const MAIS_EM_PARA_FAZER = 'Carregar mais (4)';

    test('dadas colunas mais longas que a primeira leva, quando a pessoa conclui pelo teclado e pelo mouse, então o foco não se perde e a coluna com "Carregar mais" não volta ao começo', async ({ page }) => {
      // Dado
      await abrirModulo(page, 'tarefas', 'Kanban');
      await page.evaluate(async ([feitas, longas]) => {
        type Banco = { colunasListar(m: string): Promise<{ id: string; marco: string | null }[]>; tarefaCriar(d: object): Promise<{ id: string }>;
          tarefaMover(id: string, etapa: string, ordem: number): Promise<void> };
        const caminho = '/src/dados/index.ts';
        const { SD } = await import(caminho) as { SD: Banco };
        const colunas = await SD.colunasListar('tarefas');
        const fim = colunas.find(c => c.marco === 'concluido')!.id, inicio = colunas.find(c => c.marco === 'inicio')!.id;
        for (let i = 0; i < feitas; i++) await SD.tarefaMover((await SD.tarefaCriar({ titulo: `Fictícia feita ${i}`, responsavel_id: 'u-master' })).id, fim, i + 1);
        for (let i = 0; i < longas; i++) await SD.tarefaMover((await SD.tarefaCriar({ titulo: `Fictícia longa ${i}`, responsavel_id: 'u-master' })).id, inicio, 100 + i);
      }, [FEITAS, LONGAS]);
      await page.reload();
      await mouseLonge(page);
      const fazer = page.getByRole('list', { name: 'Para fazer', exact: true });
      // Quando: pelo teclado, a tarefa vai para o fim de "Concluída", que não está toda à vista
      await miniatura(page, 'Para fazer', 'Renovar a procuração').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      // Então: o foco vai para a miniatura que veio depois dela, e não se perde
      await expect(page.getByRole('status').getByText('Tarefa concluída.')).toBeVisible();
      await expect(miniatura(page, 'Concluída', 'Renovar a procuração')).toHaveCount(0);
      await expect(miniatura(page, 'Para fazer', 'Fictícia longa 0')).toBeFocused();
      // Quando: "Carregar mais" em "Para fazer", e o mouse conclui uma das que vieram com ele
      await page.getByRole('button', { name: MAIS_EM_PARA_FAZER }).click();
      const ultima = miniatura(page, 'Para fazer', `Fictícia longa ${LONGAS - 1}`), penultima = `Fictícia longa ${LONGAS - 2}`;
      await expect(ultima).toBeVisible();
      const visiveis = await fazer.getByRole('listitem').count();
      await miniatura(page, 'Para fazer', penultima).hover();
      await circulo(miniatura(page, 'Para fazer', penultima), 'Concluir', penultima).click();
      // Então: só ela sai; as outras que vieram com "Carregar mais" continuam
      await expect(miniatura(page, 'Para fazer', penultima)).toHaveCount(0);
      await expect(fazer.getByRole('listitem')).toHaveCount(visiveis - 1);
      await expect(ultima).toBeVisible();
    });
  });

  test.describe('Arrastar', () => {
    // Tela larga: "Para fazer" e "Fazendo" à vista, para arrastar entre elas.
    test.use({ viewport: { width: 1600, height: 900 } });

    test('dado o círculo, quando a pessoa arrasta a partir dele para outra coluna, então a miniatura não sai do lugar; arrastada pelo título, muda', async ({ page }) => {
      // Dado
      await abrirModulo(page, 'tarefas', 'Kanban');
      const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
      const fazendo = page.getByRole('list', { name: 'Fazendo', exact: true });
      await cartao.hover();
      // Quando
      await circulo(cartao, 'Concluir', 'Renovar a procuração').dragTo(fazendo);
      // Então
      await expect(cartao).toBeVisible();
      await expect(miniatura(page, 'Fazendo', 'Renovar a procuração')).toHaveCount(0);
      await expect(page.getByRole('status').getByText(/foi para/)).toHaveCount(0);
      await semCartaoAberto(page);
      // Quando: pelo título (o controle: o arrastar de sempre continua valendo)
      await cartao.getByText('Renovar a procuração', { exact: true }).dragTo(fazendo);
      // Então
      await expect(miniatura(page, 'Fazendo', 'Renovar a procuração')).toBeVisible();
    });
  });

  test('dada a última tarefa aberta de uma demanda, quando ela é concluída pelo círculo, então o sistema oferece concluir a demanda', async ({ page }) => {
    // Dado: "Organizar a pasta" já está concluída; "Pedir documentos ao cliente" vai primeiro, sem pergunta
    await abrirModulo(page, 'tarefas', 'Kanban');
    const pedir = miniatura(page, 'Para fazer', 'Pedir documentos ao cliente');
    await pedir.hover();
    await circulo(pedir, 'Concluir', 'Pedir documentos ao cliente').click();
    await expect(miniatura(page, 'Concluída', 'Pedir documentos ao cliente')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Concluir a demanda?' })).toHaveCount(0);
    // Quando
    const gru = miniatura(page, 'Fazendo', 'Emitir a GRU');
    await gru.hover();
    await circulo(gru, 'Concluir', 'Emitir a GRU').click();
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Concluir a demanda?' });
    await expect(pergunta).toContainText('Registro de marca');
    await pergunta.getByRole('button', { name: 'Cancelar' }).click();
    await expect(miniatura(page, 'Concluída', 'Emitir a GRU')).toBeVisible();
  });

  test('dado um quadro com a coluna das concluídas e a do início renomeadas e fora do lugar, quando a pessoa conclui e reabre pelo círculo, então valem as colunas desse quadro', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Kanban');
    for (const [antes, depois] of [['Concluída', 'Feitas'], ['Para fazer', 'A começar']]) {
      await page.getByRole('button', { name: `Opções da coluna ${antes}` }).click();
      await page.getByRole('menuitem', { name: 'Renomear' }).click();
      const janela = page.getByRole('dialog', { name: 'Renomear coluna' });
      await janela.getByLabel('Renomear coluna').fill(depois);
      await janela.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('list', { name: depois, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Opções da coluna Feitas' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a esquerda' }).click();
    const cartao = miniatura(page, 'A começar', 'Renovar a procuração');
    // Quando
    await cartao.hover();
    await circulo(cartao, 'Concluir', 'Renovar a procuração').click();
    // Então
    const feita = miniatura(page, 'Feitas', 'Renovar a procuração');
    await expect(feita).toContainText('Concluída · Prazo:');
    // Quando
    await circulo(feita, 'Reabrir', 'Renovar a procuração').click();
    // Então
    await expect(page.getByRole('status').getByText('Tarefa reaberta em "A começar".')).toBeVisible();
    await expect(miniatura(page, 'A começar', 'Renovar a procuração')).toBeVisible();
  });
});

test.describe('Concluir pelo círculo no quadro de Demandas', () => {
  test('dada uma demanda vencida, quando a pessoa a conclui pelo círculo, então o sistema oferece criar o processo, e ela fica concluída sem abrir o cartão', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'demandas', 'Kanban');
    const cartao = miniatura(page, 'Para fazer', 'Notificar o devedor');
    await expect(cartao).toContainText('Prazo vencido');
    // Quando
    await cartao.hover();
    await circulo(cartao, 'Concluir', 'Notificar o devedor').click();
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Criar o processo?' });
    await expect(pergunta).toContainText('Notificar o devedor');
    await pergunta.getByRole('button', { name: 'Cancelar' }).click();
    const concluida = miniatura(page, 'Concluído', 'Notificar o devedor');
    await expect(concluida).toContainText('Concluído · Prazo:');
    await expect(page.getByRole('status').getByText('Demanda concluída.')).toBeVisible();
    await semCartaoAberto(page);
    await mouseLonge(page);
    await expect(circulo(concluida, 'Reabrir', 'Notificar o devedor')).toBeVisible();
  });
});

test.describe('Quem só lê, e o arquivado', () => {
  test('dado o Bruno, que só lê o que não é dele, quando passa o mouse nas miniaturas, então não há círculo para clicar; o concluído mostra só o visto', async ({ page }) => {
    // Dado: o Mauro conclui "Renovar a procuração", em que o Bruno não está
    await abrirModulo(page, 'tarefas', 'Kanban');
    const renovar = miniatura(page, 'Para fazer', 'Renovar a procuração');
    await renovar.hover();
    await circulo(renovar, 'Concluir', 'Renovar a procuração').click();
    await expect(miniatura(page, 'Concluída', 'Renovar a procuração')).toBeVisible();
    await ligarEquipeVeTudo(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrirModulo(page, 'tarefas', 'Kanban');
    const concluida = miniatura(page, 'Concluída', 'Renovar a procuração');
    await concluida.hover();
    // Então
    await expect(concluida.getByRole('img', { name: 'Tarefa concluída' })).toBeVisible();
    await expect(concluida.getByRole('button', { name: /^(Concluir|Reabrir) / })).toHaveCount(0);
    // E a dele continua com o círculo
    const dele = miniatura(page, 'Para fazer', 'Pedir documentos ao cliente');
    await dele.hover();
    await expect(circulo(dele, 'Concluir', 'Pedir documentos ao cliente')).toBeVisible();
    // Quando: uma demanda aberta em que ele não está
    await abrirModulo(page, 'demandas', 'Kanban');
    const alheia = miniatura(page, 'Para fazer', 'Busca de anterioridade');
    await alheia.hover();
    // Então
    await expect(alheia.getByRole('button', { name: /^(Concluir|Reabrir) / })).toHaveCount(0);
    await expect(alheia.getByRole('img', { name: 'Demanda concluída' })).toHaveCount(0);
  });

  test('dada uma tarefa concluída e arquivada, quando aparece em "Arquivados" embaixo da tabela, então mostra só o visto, sem círculo para clicar', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Tabela');
    const pasta = page.getByRole('row').filter({ hasText: 'Organizar a pasta' });
    await pasta.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await expect(pasta).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: /^Arquivados/ }).click();
    // Então
    await expect(pasta.getByRole('img', { name: 'Tarefa concluída' })).toBeVisible();
    await expect(pasta.getByRole('button', { name: /^(Concluir|Reabrir) / })).toHaveCount(0);
  });
});

test.describe('Concluir pelo círculo na tabela', () => {
  test('dada a tabela de Tarefas, quando a pessoa conclui e reabre uma linha pelo círculo, então a tarefa muda sem abrir o cartão, e o prazo deixa de ficar vermelho', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Tabela');
    const linha = page.getByRole('row').filter({ hasText: 'Renovar a procuração' });
    await expect(linha).toContainText('Prazo vencido');
    // Quando
    await circulo(linha, 'Concluir', 'Renovar a procuração').click();
    // Então
    await expect(page.getByRole('status').getByText('Tarefa concluída.')).toBeVisible();
    await expect(linha).toContainText('Concluída · Prazo:');
    await expect(linha).not.toContainText('Prazo vencido');
    await semCartaoAberto(page);
    // Quando
    await circulo(linha, 'Reabrir', 'Renovar a procuração').click();
    // Então
    await expect(page.getByRole('status').getByText('Tarefa reaberta em "Para fazer".')).toBeVisible();
    await expect(linha).toContainText('Prazo vencido');
    await semCartaoAberto(page);
  });

  test('dada a tabela de Demandas, quando a pessoa conclui uma linha pelo círculo, então o sistema oferece criar o processo e a linha fica concluída', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'demandas', 'Tabela');
    const linha = page.getByRole('row').filter({ hasText: 'Notificar o devedor' });
    // Quando
    await circulo(linha, 'Concluir', 'Notificar o devedor').click();
    // Então
    await page.getByRole('dialog', { name: 'Criar o processo?' }).getByRole('button', { name: 'Cancelar' }).click();
    await expect(linha).toContainText('Concluído · Prazo:');
    await expect(linha).not.toContainText('Prazo vencido');
    await expect(circulo(linha, 'Reabrir', 'Notificar o devedor')).toBeVisible();
    await semCartaoAberto(page);
  });

  for (const espera of [30, 250]) {
    test(`dada uma linha da tabela, quando a pessoa dá um clique duplo no círculo (${espera} ms entre os cliques), então a tarefa fica concluída, sem reabrir`, async ({ page }) => {
      // Dado
      await abrirModulo(page, 'tarefas', 'Tabela');
      const linha = page.getByRole('row').filter({ hasText: 'Renovar a procuração' });
      await circulo(linha, 'Concluir', 'Renovar a procuração').hover();
      // Quando
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(espera);
      await page.mouse.down({ clickCount: 2 });
      await page.mouse.up({ clickCount: 2 });
      // Então
      await expect(circulo(linha, 'Reabrir', 'Renovar a procuração')).toBeVisible();
      await expect(linha).toContainText('Concluída · Prazo:');
      await expect(page.getByRole('status').getByText('Tarefa concluída.')).toHaveCount(1);
      await expect(page.getByRole('status').getByText(/reaberta/)).toHaveCount(0);
    });
  }

  for (const tecla of ['Enter', 'Space']) {
    test(`dada uma linha da tabela, quando a pessoa chega ao círculo pelo teclado e aperta ${tecla}, então a tarefa é concluída uma vez, sem abrir o cartão`, async ({ page }) => {
      // Dado
      await abrirModulo(page, 'tarefas', 'Tabela');
      const linha = page.getByRole('row').filter({ hasText: 'Renovar a procuração' });
      await circulo(linha, 'Concluir', 'Renovar a procuração').focus();
      // Quando
      await page.keyboard.press(tecla);
      // Então
      await expect(circulo(linha, 'Reabrir', 'Renovar a procuração')).toBeVisible();
      await expect(page.getByRole('status').getByText('Tarefa concluída.')).toHaveCount(1);
      await semCartaoAberto(page);
    });
  }
});

/**
 * No toque, o que o dedo pega em volta do círculo: um passo para dentro do alvo à esquerda e acima (o alvo vai além do desenho, no
 * respiro do cartão e da célula, até completar ALVO_DE_TOQUE de cada lado), e o começo do título e do código logo abaixo, que
 * continuam do cartão (abrem o cartão, em vez de concluir).
 */
async function oQueOToquePega(botao: Locator, titulo: Locator, codigo: Locator) {
  const [b, t, c] = await Promise.all([botao.boundingBox(), titulo.boundingBox(), codigo.boundingBox()]);
  const alcance = (ALVO_DE_TOQUE - b!.width) / 2 - 1, meioX = b!.x + b!.width / 2, meioY = b!.y + b!.height / 2, dentro = 2;
  const pontos: Record<string, [number, number]> = {
    esquerda: [b!.x - alcance, meioY], acima: [meioX, b!.y - alcance], titulo: [t!.x + dentro, meioY], codigo: [c!.x + dentro, c!.y + dentro]
  };
  return botao.evaluate((el, ps) => Object.fromEntries(Object.entries(ps).map(([lugar, [x, y]]) => [lugar, document.elementFromPoint(x, y)?.closest('button') === el])), pontos);
}
/** O que o dedo pega: o círculo à esquerda e acima; o título e o código, não. */
const ALVO_ESPERADO = { esquerda: true, acima: true, titulo: false, codigo: false };

test.describe('No celular', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('dado o quadro no celular, quando a pessoa olha a miniatura, então o círculo já está à mão, com o alvo do dedo além do desenho, e o toque conclui sem abrir o cartão', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Kanban');
    const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
    const botao = circulo(cartao, 'Concluir', 'Renovar a procuração');
    await botao.scrollIntoViewIfNeeded();
    // Então: à vista sem passar o mouse, e o alvo vai além do desenho, sem pegar o título nem o código de baixo
    await expect(botao).toBeVisible();
    expect(await oQueOToquePega(botao, cartao.getByText('Renovar a procuração', { exact: true }), cartao.getByText('F00D1234'))).toEqual(ALVO_ESPERADO);
    // Quando
    await botao.tap();
    // Então
    await expect(page.getByRole('status').getByText('Tarefa concluída.')).toBeVisible();
    await expect(circulo(miniatura(page, 'Concluída', 'Renovar a procuração'), 'Reabrir', 'Renovar a procuração')).toBeAttached();
    await semCartaoAberto(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test('dada uma etiqueta só de cor logo acima do título, quando a pessoa toca no x dela, então o toque é do x, e não do círculo', async ({ page }) => {
    // Dado: uma etiqueta só de cor (a faixa curta: o x dela fica logo acima do círculo), criada no cartão da tarefa
    await abrirModulo(page, 'tarefas', 'Tabela');
    await page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).getByRole('link', { name: 'Renovar a procuração' }).click();
    await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
    const form = page.getByRole('dialog', { name: 'Escolher etiquetas' }).getByRole('form', { name: 'Nova etiqueta' });
    await form.getByRole('radio', { name: 'Vermelho' }).check();
    await form.getByRole('button', { name: 'Criar etiqueta' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Kanban' }).click();
    const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
    const tirar = cartao.getByRole('button', { name: 'Tirar a etiqueta Só cor: Vermelho' });
    await tirar.scrollIntoViewIfNeeded();
    // Quando
    // (o meio e os quatro cantos do x, um pouco para dentro da borda)
    const doX = await tirar.evaluate(x => {
      const caixa = x.getBoundingClientRect(), dentro = 2;
      const pontos = [[caixa.x + caixa.width / 2, caixa.y + caixa.height / 2], [caixa.left + dentro, caixa.top + dentro], [caixa.right - dentro, caixa.top + dentro],
        [caixa.left + dentro, caixa.bottom - dentro], [caixa.right - dentro, caixa.bottom - dentro]];
      return pontos.map(([px, py]) => document.elementFromPoint(px, py)?.closest('button') === x);
    });
    // Então
    expect(doX).toEqual([true, true, true, true, true]);
    await expect(circulo(cartao, 'Concluir', 'Renovar a procuração')).toBeVisible();
  });

  test('dada a tabela no celular, quando a pessoa olha uma linha, então o alvo do dedo do círculo vai além do desenho, sem pegar o começo do título nem o código de baixo', async ({ page }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Tabela');
    const linha = page.getByRole('row').filter({ hasText: 'Pedir documentos ao cliente' });
    const botao = circulo(linha, 'Concluir', 'Pedir documentos ao cliente');
    await botao.scrollIntoViewIfNeeded();
    // Quando
    const pega = await oQueOToquePega(botao, linha.getByRole('link', { name: 'Pedir documentos ao cliente' }), linha.getByText('9B3D4E51'));
    // Então
    expect(pega).toEqual(ALVO_ESPERADO);
  });

  test('dado o círculo no quadro, quando a pessoa segura o dedo nele e o leva até outra coluna, então nada muda: a tarefa fica no lugar, sem concluir nem abrir o cartão', async ({ page, context }) => {
    // Dado
    await abrirModulo(page, 'tarefas', 'Kanban');
    const cartao = miniatura(page, 'Para fazer', 'Renovar a procuração');
    const botao = circulo(cartao, 'Concluir', 'Renovar a procuração');
    await botao.scrollIntoViewIfNeeded();
    const de = (await botao.boundingBox())!, para = (await page.getByRole('list', { name: 'Fazendo', exact: true }).boundingBox())!;
    const inicio = { x: de.x + de.width / 2, y: de.y + de.height / 2 }, fim = { x: para.x + para.width / 2, y: para.y + para.height / 4 };
    /** A pressão longa: mais que o tempo em que o navegador do celular passa a tratar o toque como "segurar". */
    const PRESSAO_LONGA = 1000, PASSOS = 10, ENTRE_PASSOS = 30;
    // Quando: o toque segurado e arrastado (o Playwright não tem isso pronto; vai direto ao Chromium)
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [inicio] });
    await page.waitForTimeout(PRESSAO_LONGA);
    for (let i = 1; i <= PASSOS; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: inicio.x + (fim.x - inicio.x) * i / PASSOS, y: inicio.y + (fim.y - inicio.y) * i / PASSOS }] });
      await page.waitForTimeout(ENTRE_PASSOS);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Então
    await expect(cartao).toBeVisible();
    await expect(miniatura(page, 'Fazendo', 'Renovar a procuração')).toHaveCount(0);
    await expect(page.getByRole('status').getByText(/Tarefa concluída|foi para/)).toHaveCount(0);
    await semCartaoAberto(page);
  });
});
