// Painel da página inicial (#319): prazos, agenda do dia, tarefas, demandas, processos, anotações, parcelas da semana e Pessoas.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, Mauro (o master) é responsável por "Emitir a GRU" (prazo daqui a 2 dias) e participa de
// "Renovar a procuração" (venceu ontem); a "Reunião de equipe" de hoje, às 9h, está na Agenda geral.
import { expect, test, type Page } from '@playwright/test';

const CHAVE = 'semper-dados-falsos';
const bloco = (page: Page, titulo: string) => page.getByRole('main').getByRole('region', { name: titulo });
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const daquiA = (dias: number) => { const [a, m, d] = hoje().split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10); };

/** O que o teste muda no banco fictício, direto na aba (pela tela, seriam vários cadastros). */
type Mudanca = 'parcela na semana' | 'sem financeiro' | 'dia vazio';
async function mudarBanco(page: Page, mudanca: Mudanca) {
  await page.goto('/inicio/');
  await page.evaluate(([chave, qual, vencimento]) => {
    type Banco = Record<string, unknown> & { contratos: { id: string }[]; parcelas: unknown[]; escritorio: object };
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Banco;
    const MUDAR: Record<Mudanca, () => void> = {
      // Uma parcela do primeiro contrato, ainda não recebida
      'parcela na semana': () => { bd.parcelas.push({ id: 'parcela-teste', contrato_id: bd.contratos[0].id, numero: 1, vencimento, valor: 150000, recebimento_id: null, recebida_em: null, recebido: null, excluido_em: null }); },
      // O escritório sem o módulo Financeiro (a mesma regra que mostra o menu)
      'sem financeiro': () => {
        bd.escritorio = { ...bd.escritorio, modulos: { pessoas: true, contratos: true, demandas: true, tarefas: true, processos: true, compromissos: true, anotacoes: true, financeiro: false } };
      },
      'dia vazio': () => { for (const colecao of ['tarefas', 'demandas', 'compromissos', 'processos', 'prazos', 'andamentos', 'anotacoes', 'parcelas']) bd[colecao] = []; }
    };
    MUDAR[qual as Mudanca]();
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, mudanca, daquiA(3)]);
  // O banco fictício lê a aba ao abrir a página: recarrega para valer a mudança.
  await page.reload();
}

test.describe('Painel da página inicial', () => {
  test('quando a pessoa entra, então vê os prazos, a agenda do dia e as tarefas em andamento, e o link abre o cartão', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await expect(page.getByRole('heading', { name: 'Olá, Mauro.', level: 1 })).toBeVisible();
    const prazos = bloco(page, 'Prazos');
    // Então: o vencido em destaque, num grupo à parte
    await expect(prazos.getByRole('region', { name: 'Em atraso' }).getByRole('link', { name: /Renovar a procuração/ })).toBeVisible();
    await expect(prazos.getByRole('region', { name: 'Próximos 7 dias' }).getByRole('link', { name: /Emitir a GRU/ })).toBeVisible();
    await expect(bloco(page, 'Agenda de hoje').getByRole('link', { name: /09:00.*Reunião de equipe/ })).toBeVisible();
    await expect(bloco(page, 'Tarefas em andamento').getByRole('link', { name: /Emitir a GRU/ })).toBeVisible();
    // Quando
    await prazos.getByRole('link', { name: /Renovar a procuração/ }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
  });

  test('quando a pessoa clica no compromisso da agenda do dia, então o cartão do compromisso abre', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await bloco(page, 'Agenda de hoje').getByRole('link', { name: /Reunião de equipe/ }).click();
    // Então
    await expect(page).toHaveURL(/\/agenda\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reunião de equipe', level: 2 })).toBeVisible();
  });

  test('quando a pessoa escolhe "Ver todas" nas tarefas, então a lista abre só com as tarefas dela, e recarregar volta à escolha guardada', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await bloco(page, 'Tarefas em andamento').getByRole('link', { name: 'Ver todas' }).click();
    // Então: "Pedir documentos ao cliente" é do Bruno; o ?pessoa=eu, lido, sai do endereço
    await expect(page.getByRole('main').getByText('Emitir a GRU').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Pedir documentos ao cliente')).toHaveCount(0);
    await expect(page).toHaveURL(/\/tarefas\/$/);
    // Quando: recarrega a página (a escolha guardada da pessoa é ver todas)
    await page.reload();
    // Então: o filtro do Início não volta por cima dela
    await expect(page.getByRole('main').getByText('Pedir documentos ao cliente').first()).toBeVisible();
  });

  test('quando quem entra vê o Financeiro e há parcela a vencer na semana, então ela aparece; sem o Financeiro, o bloco some', async ({ page }) => {
    // Dado: uma parcela do primeiro contrato vencendo daqui a 3 dias
    await mudarBanco(page, 'parcela na semana');
    // Então
    await expect(bloco(page, 'Parcelas da semana').getByRole('link', { name: /Parcela 1/ })).toBeVisible();
    // Quando: o escritório desliga o Financeiro (a mesma regra que mostra o menu)
    await mudarBanco(page, 'sem financeiro');
    // Então
    await expect(bloco(page, 'Prazos')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Financeiro' })).toHaveCount(0);
    await expect(bloco(page, 'Parcelas da semana')).toHaveCount(0);
  });

  test('quando é um dia sem nada, então cada bloco diz que não há nada, em vez de sumir', async ({ page }) => {
    // Dado
    await mudarBanco(page, 'dia vazio');
    // Então
    const vazios: [string, string][] = [
      ['Prazos', 'Nenhum prazo vencido, para hoje ou para os próximos 7 dias.'], ['Agenda de hoje', 'Nenhum compromisso hoje.'],
      ['Tarefas em andamento', 'Nenhuma tarefa em andamento com você.'], ['Suas demandas', 'Nenhuma demanda em aberto com você.'],
      ['Seus processos', 'Nenhum processo com você.'], ['Anotações recentes', 'Nenhuma anotação sua ainda.'],
      ['Parcelas da semana', 'Nenhuma parcela vencida ou a vencer nos próximos 7 dias.']
    ];
    for (const [titulo, texto] of vazios) await expect(bloco(page, titulo).getByText(texto)).toBeVisible();
  });

  test('quando a pessoa clica na busca do alto do painel, então a busca geral abre com o foco no campo', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('main').getByRole('button', { name: 'Buscar em todo o SEMPER' }).click();
    // Então
    const janela = page.getByRole('dialog', { name: 'Buscar em todo o SEMPER' });
    await expect(janela.getByRole('combobox', { name: 'Buscar em todo o SEMPER' })).toBeFocused();
  });
});
