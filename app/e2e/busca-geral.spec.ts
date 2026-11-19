// Busca geral (#321): a janela que busca em todos os módulos (botão "Buscar" do menu e Ctrl+K). Padrão dos testes (Dado /
// Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício: JOSÉ DA SILVA TESTE tem o processo judicial 0001234-97.2026.8.13.0024; a tarefa "Emitir a GRU"
// tem o código C0FFEE12; o contrato "Ação de cobrança" é de MARIA APARECIDA EXEMPLO, de Ana, e Bruno (estagiário, não é
// administrador) não está nele.
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

/** O CPF de uma pessoa da semente, como o banco fictício guarda (só os algarismos). */
const cpfDe = (page: Page, nome: string) => page.evaluate(n => {
  const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { pessoas: { nome: string; documento: string | null }[] };
  return bd.pessoas.find(p => p.nome === n)!.documento!;
}, nome);
const comPontuacao = (cpf: string) => cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

const janela = (page: Page) => page.getByRole('dialog', { name: 'Buscar em todo o SEMPER' });
const campo = (page: Page) => janela(page).getByRole('combobox', { name: 'Buscar em todo o SEMPER' });
const resultados = (page: Page) => janela(page).getByRole('listbox', { name: 'Resultados' });
/** O grupo de resultados de um módulo, pelo título dele. */
const grupo = (page: Page, titulo: string) => resultados(page).getByRole('group', { name: titulo, exact: true });

/** Aperta Ctrl+K depois que a página carregou (o atalho vale a partir daí, com o menu à vista). */
async function abrirPeloAtalho(page: Page) {
  await expect(page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Buscar em todo o SEMPER' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(campo(page)).toBeFocused();
}

test.describe('Busca geral', () => {
  test('dada qualquer página, quando a pessoa aperta Ctrl+K e digita um CPF com pontuação, então acha a pessoa, sem tirar a busca da página', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    const cpf = comPontuacao(await cpfDe(page, 'JOSÉ DA SILVA TESTE'));
    // Quando
    await abrirPeloAtalho(page);
    await campo(page).fill(cpf);
    // Então
    await expect(janela(page).getByText(`CPF ${cpf}`)).toBeVisible();
    await expect(grupo(page, 'Pessoas').getByRole('option', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    await expect(page.getByRole('main').getByRole('searchbox')).toHaveValue('');
  });

  test('quando a pessoa busca o número do processo sem pontuação, então acha o processo judicial', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await abrirPeloAtalho(page);
    await campo(page).fill('00012349720268130024');
    // Então
    await expect(grupo(page, 'Processos judiciais').getByRole('option', { name: /0001234-97\.2026\.8\.13\.0024/ })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando a pessoa busca o código de uma tarefa e aperta Enter, então o cartão da tarefa abre e a janela fecha', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await abrirPeloAtalho(page);
    // Quando
    await campo(page).fill('c0ffee12');
    await expect(resultados(page).getByRole('option', { name: /Emitir a GRU/, selected: true })).toContainText('C0FFEE12');
    await campo(page).press('Enter');
    // Então
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Emitir a GRU', level: 2 })).toBeVisible();
    await expect(janela(page)).toHaveCount(0);
  });

  test('quando a pessoa clica em "Buscar" no menu e aperta Esc, então a janela abre e fecha, e o foco volta ao botão', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    const botao = page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Buscar em todo o SEMPER' });
    // Quando
    await botao.click();
    // Então
    await expect(campo(page)).toBeFocused();
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(janela(page)).toHaveCount(0);
    await expect(botao).toBeFocused();
  });

  test('dado um módulo com mais resultados do que a janela mostra, quando a pessoa escolhe "Ver todos", então a página do módulo abre com a busca preenchida', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrirPeloAtalho(page);
    await campo(page).fill('montes claros');
    // Quando
    await grupo(page, 'Pessoas').getByRole('option', { name: /Ver todos em Pessoas/ }).click();
    // Então: o campo vem preenchido, e a busca sai do endereço (daqui em diante, o que vale é o campo)
    await expect(page.getByRole('main').getByRole('searchbox')).toHaveValue('montes claros');
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });

  test('dados compromissos achados em várias datas, quando a pessoa escolhe "Ver todos em Agenda", então a Agenda abre na tabela com todos eles', async ({ page }) => {
    // Dado: seis compromissos "Revisão anual", em meses diferentes (a visão por data só mostraria a semana da tela)
    await page.goto('/inicio/');
    await page.evaluate(() => {
      type Guardado = { id: string; codigo: string; titulo: string | null; data: string };
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { compromissos: Guardado[] };
      const modelo = bd.compromissos.find(c => c.titulo === 'Reunião de equipe')!;
      const daquiAMeses = (meses: number) => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString().slice(0, 10); };
      for (let i = 1; i <= 6; i++) bd.compromissos.push({ ...modelo, id: `revisao-${i}`, codigo: `ABCDEF0${i}`, titulo: `Revisão anual ${i}`, data: daquiAMeses(2 * i) });
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // O banco fictício lê a aba ao abrir a página: recarrega para valer a mudança.
    await page.reload();
    await abrirPeloAtalho(page);
    await campo(page).fill('revisão anual');
    // Quando
    await grupo(page, 'Compromissos').getByRole('option', { name: /Ver todos em Agenda/ }).click();
    // Então
    await expect(page.getByRole('main').getByRole('searchbox')).toHaveValue('revisão anual');
    await expect(page.getByRole('main').getByRole('row').filter({ hasText: 'Revisão anual' })).toHaveCount(6);
    await expect(page).toHaveURL(/\/agenda\/$/);
  });

  test('quando a pessoa filtra por módulo, então só os resultados dele ficam', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrirPeloAtalho(page);
    await campo(page).fill('josé da silva');
    await expect(grupo(page, 'Pessoas')).toBeVisible();
    // Quando
    await janela(page).getByRole('group', { name: 'Módulo' }).getByRole('button', { name: 'Demandas' }).click();
    // Então
    await expect(grupo(page, 'Demandas')).toBeVisible();
    await expect(grupo(page, 'Pessoas')).toHaveCount(0);
  });

  test('dado um usuário comum fora da fase de adaptação, quando busca um contrato de que não faz parte, então não o acha', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrirPeloAtalho(page);
    await campo(page).fill('ação de cobrança');
    await expect(grupo(page, 'Contratos').getByRole('option', { name: /MARIA APARECIDA EXEMPLO/ })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrirPeloAtalho(page);
    await campo(page).fill('ação de cobrança');
    // Então
    await expect(janela(page).getByText(/Nada encontrado para/)).toBeVisible();
    await expect(resultados(page).getByRole('option', { name: /MARIA APARECIDA EXEMPLO/ })).toHaveCount(0);
  });
});
