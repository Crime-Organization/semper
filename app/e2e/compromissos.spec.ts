// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Compromissos (a agenda). O relógio fica parado em quarta-feira, 04/11/2026, 12h em Brasília. Na semente do banco
// fictício: "Reunião de equipe" hoje às 09:00 (Agenda geral), a audiência do processo de JOSÉ DA SILVA TESTE amanhã às 14:00,
// e as tarefas "Renovar a procuração" (prazo ontem) e "Emitir a GRU" (prazo em dois dias). Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const HOJE = '04/11/2026';
const AUDIENCIA = 'Audiência · JOSÉ DA SILVA TESTE';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

const agenda = (page: Page) => page.getByRole('region', { name: 'Agenda por data' });
const visao = (page: Page, nome: string) => page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: nome }).click();
const periodo = (page: Page, nome: string) => page.getByRole('group', { name: 'Período' }).getByRole('button', { name: nome }).click();

/** O contraste mínimo de texto normal, na norma de acessibilidade (WCAG AA). */
const CONTRASTE_MINIMO = 4.5;
/** O contraste entre a cor do texto e o fundo do elemento, como a norma calcula. */
const contrasteDoTexto = (item: Locator) => item.evaluate(el => {
  const luz = (cor: string) => {
    const [r, g, b] = cor.match(/[\d.]+/g)!.map(Number).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const { color, backgroundColor } = getComputedStyle(el);
  const [a, b] = [luz(color), luz(backgroundColor)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
});

/** Passa pelas etapas do cadastro de uma reunião até salvar. */
async function cadastrarReuniao(page: Page, titulo: string, data = HOJE) {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Data').fill(data);
  await page.getByLabel('Hora').fill('10:30');
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
}

test.describe('Menu da agenda', () => {
  test('quando a pessoa abre o submenu, então vê a agenda e os feriados', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('button', { name: 'Agenda e calendário' }).click();
    await abrir(page, 'Agenda');
    // Então
    await expect(page).toHaveURL(/\/agenda\/$/);
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Feriados e prazos' })).toBeVisible();
  });
});

test.describe('As três formas de ver a agenda', () => {
  test('quando a pessoa alterna entre agenda, tabela e quadro, então vê os mesmos compromissos', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    // Então: a agenda abre na semana
    await expect(agenda(page).getByRole('heading', { name: '02/11/2026 a 08/11/2026' })).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: /Reunião de equipe/ })).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: new RegExp(AUDIENCIA) })).toBeVisible();
    // Quando
    await visao(page, 'Tabela');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Reunião de equipe' })).toContainText(`${HOJE} · 09:00`);
    await expect(page.getByRole('row').filter({ hasText: AUDIENCIA })).toContainText('05/11/2026 · 14:00');
    // Quando
    await visao(page, 'Kanban');
    // Então
    const agendado = page.getByRole('list', { name: 'Agendado', exact: true });
    await expect(agendado).toContainText('Reunião de equipe');
    await expect(agendado).toContainText(AUDIENCIA);
  });

  test('quando a pessoa volta à página, então ela abre na visão escolhida', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await visao(page, 'Tabela');
    await expect(page.getByRole('row').filter({ hasText: 'Reunião de equipe' })).toBeVisible();
    // Quando
    await page.goto('/inicio/');
    await page.goto('/agenda/');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Reunião de equipe' })).toBeVisible();
    await expect(agenda(page)).toHaveCount(0);
  });
});

test.describe('A visão por data', () => {
  test('quando a pessoa troca para o dia e anda pelas datas, então vê os itens de cada dia', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    // Quando
    await periodo(page, 'Dia');
    // Então
    await expect(agenda(page).getByRole('heading', { name: 'quarta-feira, 04/11/2026' })).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: /Reunião de equipe/ })).toContainText('09:00');
    await expect(agenda(page).getByRole('link', { name: new RegExp(AUDIENCIA) })).toHaveCount(0);
    // Quando
    await agenda(page).getByRole('button', { name: 'Próximo' }).click();
    // Então
    await expect(agenda(page).getByRole('heading', { name: 'quinta-feira, 05/11/2026' })).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: new RegExp(AUDIENCIA) })).toContainText('14:00');
    // Quando
    await agenda(page).getByRole('button', { name: 'Hoje' }).click();
    // Então
    await expect(agenda(page).getByRole('heading', { name: 'quarta-feira, 04/11/2026' })).toBeVisible();
  });

  test('quando a pessoa vê a semana, então cada item fica no dia dele, com os prazos de tarefas', async ({ page }) => {
    // Quando
    await page.goto('/agenda/');
    // Então
    await expect(agenda(page).getByRole('region', { name: 'quarta-feira, 04/11' })).toContainText('Reunião de equipe');
    await expect(agenda(page).getByRole('region', { name: 'quinta-feira, 05/11' })).toContainText(AUDIENCIA);
    await expect(agenda(page).getByRole('region', { name: 'terça-feira, 03/11' })).toContainText('Prazo da tarefa');
    await expect(agenda(page).getByRole('region', { name: 'terça-feira, 03/11' })).toContainText('Renovar a procuração');
    await expect(agenda(page).getByRole('region', { name: 'sexta-feira, 06/11' })).toContainText('Emitir a GRU');
  });

  test('quando a pessoa vê o mês e clica num dia, então abre esse dia', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await periodo(page, 'Mês');
    await expect(agenda(page).getByRole('heading', { name: 'novembro de 2026' })).toBeVisible();
    await expect(agenda(page).getByRole('listitem', { name: 'quarta-feira, 04/11' })).toContainText('Reunião de equipe');
    // Quando
    await agenda(page).getByRole('listitem', { name: 'quinta-feira, 05/11' }).getByRole('button', { name: '5' }).click();
    // Então
    await expect(agenda(page).getByRole('heading', { name: 'quinta-feira, 05/11/2026' })).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: new RegExp(AUDIENCIA) })).toBeVisible();
  });

  test('quando a pessoa anda pelo mês, então chega ao mês seguinte', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await periodo(page, 'Mês');
    // Quando
    await agenda(page).getByRole('button', { name: 'Próximo' }).click();
    // Então
    await expect(agenda(page).getByRole('heading', { name: 'dezembro de 2026' })).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: /Reunião de equipe/ })).toHaveCount(0);
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`quando o tema é ${tema}, então o texto dos compromissos e dos prazos dá para ler`, async ({ page }) => {
      // Dado
      await page.emulateMedia({ colorScheme: tema });
      // Quando
      await page.goto('/agenda/');
      // Então
      for (const item of [/Reunião de equipe/, /Emitir a GRU/]) expect(await contrasteDoTexto(agenda(page).getByRole('link', { name: item }))).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    });
  }

  test('quando a pessoa clica no prazo, então ele abre no módulo de origem', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    // Quando
    await agenda(page).getByRole('link', { name: /Emitir a GRU/ }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Emitir a GRU', level: 2 })).toBeVisible();
  });

  test('quando a pessoa clica num compromisso, então o cartão dele abre aqui', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    // Quando
    await agenda(page).getByRole('link', { name: /Reunião de equipe/ }).click();
    // Então
    await expect(page).toHaveURL(/\/agenda\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reunião de equipe', level: 2 })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Agenda geral');
  });

  test('quando a pessoa filtra por tipo, então só esse tipo aparece, sem os prazos', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await expect(agenda(page).getByRole('link', { name: /Emitir a GRU/ })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByLabel('Tipo').selectOption({ label: 'Audiência' });
    // Então
    await expect(agenda(page).getByRole('link', { name: /Emitir a GRU/ })).toHaveCount(0);
    await expect(agenda(page).getByRole('link', { name: /Reunião de equipe/ })).toHaveCount(0);
    await expect(agenda(page).getByRole('link', { name: new RegExp(AUDIENCIA) })).toBeVisible();
  });
});

test.describe('Cadastro de compromisso', () => {
  test('quando uma reunião é salva, então aparece no dia certo, na tabela e na primeira coluna do quadro', async ({ page }) => {
    // Quando
    await cadastrarReuniao(page, 'Reunião com o perito');
    // Então
    await expect(agenda(page).getByRole('region', { name: 'quarta-feira, 04/11' })).toContainText('Reunião com o perito');
    await visao(page, 'Tabela');
    await expect(page.getByRole('row').filter({ hasText: 'Reunião com o perito' })).toContainText(`${HOJE} · 10:30`);
    await visao(page, 'Kanban');
    await expect(page.getByRole('list', { name: 'Agendado', exact: true })).toContainText('Reunião com o perito');
  });

  test('quando faltam o título e a data, então a primeira etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/agenda/novo/');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Dê um título ao compromisso.')).toBeVisible();
    await expect(page.getByText('Informe a data.')).toBeVisible();
    await expect(page.getByText('Informe a hora.')).toBeVisible();
    await expect(page.getByText('Etapa 1 de 4')).toBeVisible();
  });

  test('quando é uma audiência sem processo nem modalidade, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/agenda/novo/');
    await page.getByRole('group', { name: 'Tipo' }).getByText('Audiência', { exact: true }).click();
    await page.getByLabel('Data').fill(HOJE);
    await page.getByLabel('Hora').fill('14:00');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Audiência precisa de um processo.')).toBeVisible();
    await expect(page.getByText('Escolha a modalidade.')).toBeVisible();
    await expect(page.getByText('Etapa 2 de 4')).toBeVisible();
  });

  test('quando se escolhe o processo da audiência, então os clientes dele entram, e ela aparece nos cartões do processo e da pessoa', async ({ page }) => {
    // Dado
    await page.goto('/agenda/novo/');
    await page.getByRole('group', { name: 'Tipo' }).getByText('Perícia', { exact: true }).click();
    await page.getByLabel('Data').fill('09/11/2026');
    await page.getByLabel('Hora').fill('08:15');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Quando
    await page.getByRole('combobox', { name: 'Processo' }).fill('00012349720268130024');
    await page.getByRole('option', { name: /0001234-97\.2026\.8\.13\.0024/ }).click();
    await page.getByRole('group', { name: 'Modalidade' }).getByText('Virtual', { exact: true }).click();
    await page.getByLabel('Local').fill('Sala virtual');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: o cliente do processo já vem como pessoa ligada
    await expect(page.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('JOSÉ DA SILVA TESTE');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByLabel('Resultado').fill('Perícia marcada');
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Perícia · JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect(cartao).toContainText('09/11/2026 · 08:15');
    await abrirSecao(cartao, 'Processo');
    await expect(cartao.getByRole('link', { name: /0001234-97/ })).toBeVisible();
    // Quando: abre o processo pelo cartão
    await cartao.getByRole('link', { name: /0001234-97/ }).click();
    const doProcesso = page.getByRole('dialog');
    await abrirSecao(doProcesso, 'Compromissos');
    // Então
    await expect(doProcesso.getByRole('link', { name: /Perícia · JOSÉ DA SILVA TESTE/ })).toContainText('09/11/2026 · 08:15');
    await expect(doProcesso.getByRole('link', { name: new RegExp(AUDIENCIA) })).toContainText('05/11/2026 · 14:00');
    // Quando: abre a pessoa
    await abrirSecao(doProcesso, 'Clientes');
    await doProcesso.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ }).filter({ hasText: 'Cliente' }).click();
    await expect(page).toHaveURL(/pessoas.*id=/);
    const daPessoa = page.getByRole('dialog');
    await expect(daPessoa.getByText('Pessoa física')).toBeVisible();
    await abrirSecao(daPessoa, 'Compromissos');
    // Então
    await expect(daPessoa.getByRole('link', { name: /Perícia · JOSÉ DA SILVA TESTE/ })).toContainText('Ligada');
  });

  test('quando se cria pelo cartão do processo, então ele já vem escolhido, como audiência', async ({ page }) => {
    // Dado
    await page.goto('/processos/judicial/');
    await page.getByRole('list', { name: 'Distribuído', exact: true }).getByText('JOSÉ DA SILVA TESTE').click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Compromissos');
    // Quando
    await cartao.getByRole('link', { name: 'Nova audiência ou compromisso deste processo' }).click();
    // Então
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(cadastro.getByRole('radio', { name: 'Audiência' })).toBeChecked();
    await cadastro.getByLabel('Data').fill(HOJE);
    await cadastro.getByLabel('Hora').fill('16:00');
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await expect(cadastro).toContainText('0001234-97.2026.8.13.0024');
    await expect(cadastro.getByRole('button', { name: 'Tirar o processo' })).toBeVisible();
  });
});

test.describe('Quadro e cartão', () => {
  test('quando a pessoa arrasta um cartão para outra coluna, então ele continua lá depois de recarregar', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await visao(page, 'Kanban');
    const cartao = page.getByRole('list', { name: 'Agendado', exact: true }).getByText('Reunião de equipe');
    const destino = page.getByRole('list', { name: 'Confirmado', exact: true });
    await expect(cartao).toBeVisible();
    // Quando
    await cartao.dragTo(destino);
    // Então
    await expect(destino).toContainText('Reunião de equipe');
    await page.reload();
    await expect(page.getByRole('list', { name: 'Confirmado', exact: true })).toContainText('Reunião de equipe');
    await expect(page.getByRole('list', { name: 'Agendado', exact: true })).not.toContainText('Reunião de equipe');
  });

  test('quando a pessoa muda a situação no cartão, então o histórico guarda, e a agenda mostra', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await periodo(page, 'Dia');
    await agenda(page).getByRole('link', { name: /Reunião de equipe/ }).click();
    const cartao = page.getByRole('dialog');
    // Quando
    await cartao.getByLabel('Situação do compromisso').selectOption({ label: 'Realizado' });
    await abrirSecao(cartao, 'Histórico de alterações');
    // Então
    await expect(cartao).toContainText('Realizado');
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(agenda(page).getByRole('link', { name: /Reunião de equipe/ })).toContainText('Realizado');
  });

  test('quando a pessoa edita pelo lápis e registra o resultado, então o cartão mostra', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await visao(page, 'Tabela');
    await page.getByRole('row').filter({ hasText: AUDIENCIA }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Resultado');
    await expect(cartao.getByText('Ainda sem resultado.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByLabel('Resultado').fill('Acordo homologado');
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(cartao.getByText('Acordo homologado')).toBeVisible();
  });

  test('quando a pessoa arquiva e exclui, então o compromisso some da agenda', async ({ page }) => {
    // Dado
    await cadastrarReuniao(page, 'Reunião cancelada');
    await agenda(page).getByRole('link', { name: /Reunião cancelada/ }).click();
    const cartao = page.getByRole('dialog');
    // Quando
    await page.getByRole('button', { name: 'Arquivar' }).click();
    await expect(cartao.getByText('Compromisso arquivado.')).toBeVisible();
    await expect(agenda(page).getByRole('link', { name: /Reunião cancelada/ })).toHaveCount(0);
    await cartao.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('dialog', { name: 'Excluir o compromisso?' }).getByRole('button', { name: 'Excluir definitivamente' }).click();
    // Então
    await expect(page.getByText('Compromisso excluído definitivamente.')).toBeVisible();
    await visao(page, 'Tabela');
    await expect(page.getByRole('row').filter({ hasText: 'Reunião cancelada' })).toHaveCount(0);
  });

  test('quando a pessoa comenta no compromisso, então o comentário fica no cartão', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await agenda(page).getByRole('link', { name: /Reunião de equipe/ }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Comentários');
    // Quando
    await cartao.getByLabel('Escrever um comentário').fill('Levar a pauta');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    // Então
    await expect(cartao.getByText('Levar a pauta')).toBeVisible();
  });
});
