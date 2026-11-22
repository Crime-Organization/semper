// Painel da página inicial (#319, #402): os números do dia, os gráficos (tarefas por situação e ritmo), o filtro do administrador e as
// listas (prazos, agenda do dia, tarefas, demandas, processos, anotações, parcelas da semana e Pessoas).
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, Mauro (o master) é responsável por "Emitir a GRU" (prazo daqui a 2 dias, na coluna "Fazendo") e
// participa de "Renovar a procuração" (venceu ontem, em "Para fazer"); a "Reunião de equipe" de hoje, às 9h, está na Agenda geral.
// "Pedir documentos ao cliente" (em "Para fazer") e "Organizar a pasta" (concluída) são do Bruno.
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

  test('quando a pessoa não tem nada em nenhum módulo, então o painel diz por onde começar, e o botão abre o cadastro da tarefa', async ({ page }) => {
    // Dado
    await mudarBanco(page, 'dia vazio');
    // Então: sem números nem gráficos zerados
    await expect(page.getByRole('main').getByText('Seu painel começa aqui.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Números do dia' })).toHaveCount(0);
    await expect(bloco(page, 'Ritmo')).toHaveCount(0);
    // Quando
    await page.getByRole('main').getByRole('link', { name: 'Criar tarefa' }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/nova\/$/);
  });

  test('quando a pessoa entra, então vê os números do dia, e o número dos prazos vencidos leva à lista dos prazos', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    const numeros = page.getByRole('group', { name: 'Números do dia' });
    // Então: "Emitir a GRU" (fazendo) e "Renovar a procuração" (a fazer) são do Mauro; "Renovar a procuração" venceu ontem
    await expect(numeros.getByRole('link', { name: /Tarefas a fazer\s*2/ })).toBeVisible();
    await expect(numeros.getByRole('link', { name: /Prazos vencidos\s*1/ })).toBeVisible();
    await expect(numeros.getByRole('link', { name: /Compromissos de hoje\s*1/ })).toBeVisible();
    await expect(numeros.getByRole('link', { name: /Mensagens não lidas/ })).toHaveAttribute('href', '/mensagens/');
    // Quando
    await numeros.getByRole('link', { name: /Prazos vencidos/ }).click();
    // Então
    await expect(page).toHaveURL(/#inicio-prazos$/);
    await expect(bloco(page, 'Prazos').getByRole('link', { name: /Renovar a procuração/ })).toBeInViewport();
  });

  test('quando a pessoa passa o mouse numa barra do ritmo, então vê o número exato, e pode trocar para os últimos 30 dias', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    const ritmo = bloco(page, 'Ritmo');
    await expect(bloco(page, 'Tarefas por situação').getByRole('link', { name: '1 Fazendo' })).toBeVisible();
    // Quando: o gráfico recebe o foco e a seta leva à última barra (hoje)
    await ritmo.getByRole('group', { name: /Tarefas concluídas em cada um dos últimos 7 dias/ }).focus();
    await page.keyboard.press('End');
    // Então
    await expect(ritmo.getByRole('status')).toContainText('hoje');
    // Quando
    await ritmo.getByRole('button', { name: '30 dias' }).click();
    // Então: a escolha fica guardada
    await expect(ritmo.getByText('O que foi feito em cada um dos últimos 30 dias.').or(ritmo.getByText('Nenhuma tarefa concluída nem tempo registrado nos últimos 30 dias.'))).toBeVisible();
    await page.reload();
    await expect(bloco(page, 'Ritmo').getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('quando o administrador mostra a equipe toda, então os números e as listas mudam junto, e os links abrem o trabalho de todos', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    const numeros = page.getByRole('group', { name: 'Números do dia' });
    await expect(numeros.getByRole('link', { name: /Tarefas a fazer\s*2/ })).toBeVisible();
    // Quando
    await page.getByRole('combobox', { name: 'Mostrar' }).selectOption('equipe');
    // Então: entra a tarefa do Bruno em "Para fazer"
    await expect(page.getByText('O trabalho da equipe toda.')).toBeVisible();
    await expect(numeros.getByRole('link', { name: /Tarefas a fazer\s*3/ })).toBeVisible();
    await expect(bloco(page, 'Tarefas em andamento').getByRole('link', { name: /Pedir documentos ao cliente/ })).toBeVisible();
    // Quando
    await bloco(page, 'Tarefas em andamento').getByRole('link', { name: 'Ver todas' }).click();
    // Então
    await expect(page.getByRole('main').getByText('Pedir documentos ao cliente').first()).toBeVisible();
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
