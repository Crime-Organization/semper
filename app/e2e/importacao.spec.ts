// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Importar pessoas de um CSV (Pessoas > ⋯ > Importar pessoas). No banco fictício, quem está logado é o Mateus
// (master). O arquivo é montado aqui, só com nomes fictícios; a MARIA APARECIDA EXEMPLO é da semente (sem e-mail).
import { expect, test, type Page } from '@playwright/test';

/** O CSV como o Excel salva (separado por ";", com \r\n): o cabeçalho e as linhas. */
function arquivoCSV(...linhas: string[][]) {
  return { name: 'pessoas.csv', mimeType: 'text/csv', buffer: Buffer.from(linhas.map(l => l.join(';')).join('\r\n'), 'utf8') };
}
const PESSOAS = arquivoCSV(
  ['referencia', 'tipo', 'nome', 'documento', 'emails', 'responsaveis', 'cadastrado_em'],
  // Pessoa nova, com responsável e data antiga de cadastro.
  ['teste-1', 'pf', 'FULANA NOVA DE TESTE', '', '', 'Ana Teste Lima', '15/03/2019'],
  // Já está no SEMPER (pelo CPF), sem e-mail: o e-mail do arquivo completa o cadastro.
  ['teste-2', 'pf', 'MARIA APARECIDA EXEMPLO', '111.444.777-35', 'maria.nova@exemplo.com', '', ''],
  // CPF inválido: entra sem CPF, com o número na observação e marcada como incompleta.
  ['teste-3', 'pf', 'BELTRANO CPF ERRADO', '123.456.789-00', '', '', ''],
  // Sem nome: não entra.
  ['teste-4', 'pf', '', '', '', '', '']
);

/** Abre a importação pelo menu ⋯ de Pessoas e espera a janela. */
async function abrirImportacao(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: 'Importar pessoas' }).click();
  return page.getByRole('dialog', { name: 'Importar pessoas' });
}

test.describe('Importar pessoas', () => {
  test('quando o administrador baixa o modelo, então vem o CSV do SEMPER, com a coluna "nome" no cabeçalho', async ({ page }) => {
    // Dado
    const janela = await abrirImportacao(page);
    // Quando
    const baixando = page.waitForEvent('download');
    await janela.getByRole('button', { name: 'Baixar o modelo' }).click();
    const download = await baixando;
    // Então
    expect(download.suggestedFilename()).toBe('modelo-importacao-pessoas.csv');
    const conteudo = await (await download.createReadStream()).toArray();
    const [cabecalho] = Buffer.concat(conteudo).toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
    expect(cabecalho.split(';')).toContain('nome');
  });

  test('quando importa um arquivo com pessoas novas, uma a completar e uma com erro, então grava, marca e registra', async ({ page }) => {
    // Dado
    const janela = await abrirImportacao(page);
    // Quando: escolhe o arquivo
    const escolha = page.waitForEvent('filechooser');
    await janela.getByRole('button', { name: 'Escolher o arquivo' }).click();
    await (await escolha).setFiles(PESSOAS);
    // Então: o responsável do arquivo já vem ligado a alguém da equipe
    await expect(janela.getByLabel('Usuário para Ana Teste Lima')).toHaveValue('u-ana');
    // Quando: confere
    await janela.getByRole('button', { name: 'Conferir' }).click();
    // Então
    await expect(janela.getByRole('tab', { name: /Novos 2/ })).toBeVisible();
    await expect(janela.getByRole('tab', { name: /Completar 1/ })).toBeVisible();
    await expect(janela.getByRole('tab', { name: /Com erro 1/ })).toBeVisible();
    await expect(janela.getByText('CPF inválido: entra sem CPF, com o número guardado na observação.')).toBeVisible();
    // Quando: grava
    await janela.getByRole('button', { name: 'Gravar 3 pessoas' }).click();
    await page.getByRole('dialog', { name: 'Gravar a importação?' }).getByRole('button', { name: 'Gravar' }).click();
    // Então
    await expect(janela.getByText('Importação concluída: 2 pessoas incluídas, 1 completada, 1 com pendência')).toBeVisible();

    // Quando: fecha e filtra as importadas
    await janela.getByRole('button', { name: 'Ver em Pessoas' }).click();
    await expect(janela).toHaveCount(0);
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('button', { name: /Filtros/ }).click();
    await page.getByLabel('Situação do cadastro').selectOption('importadas');
    // Então: só as duas que a importação criou
    await expect(page.getByText('2 ativas')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'FULANA NOVA DE TESTE' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(0);

    // Quando: abre a pessoa do CPF inválido
    await page.getByRole('row').filter({ hasText: 'BELTRANO CPF ERRADO' }).click();
    const cartao = page.getByRole('dialog');
    // Então: incompleta, com o número na observação; "Marcar como conferido" tira a pendência
    await expect(cartao.getByText('Importada', { exact: true })).toBeVisible();
    await expect(cartao.getByText('Incompleta', { exact: true })).toBeVisible();
    await expect(cartao.getByText(/CPF digitado no arquivo: 123\.456\.789-00/)).toBeVisible();
    await cartao.getByRole('button', { name: 'Marcar como conferido' }).click();
    await expect(cartao.getByText('Incompleta', { exact: true })).toHaveCount(0);
    await expect(cartao.getByText(/CPF digitado no arquivo/)).toBeVisible();
    // Quando: acrescenta "Incompleta" de novo e a tira pelo x
    await cartao.getByRole('button', { name: 'Escolher etiquetas' }).click();
    await page.getByRole('dialog', { name: 'Escolher etiquetas' }).getByRole('checkbox', { name: 'Incompleta' }).check();
    await page.keyboard.press('Escape');
    // Então: o cadastro volta a ter o que conferir
    await expect(cartao.getByRole('button', { name: 'Marcar como conferido' })).toBeVisible();
    // Quando
    await cartao.getByText('Incompleta', { exact: true }).hover();
    await cartao.getByRole('button', { name: 'Tirar a etiqueta Incompleta' }).click();
    // Então: tirar a etiqueta marca como conferido; "Importada" continua
    await expect(cartao.getByRole('button', { name: 'Marcar como conferido' })).toHaveCount(0);
    await expect(cartao.getByText('Importada', { exact: true })).toBeVisible();
    // Quando: desfaz
    await expect(page.getByText('Etiqueta "Incompleta" tirada de 1 cartão.')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então: a etiqueta e o que havia para conferir voltam
    await expect(cartao.getByText('Incompleta', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Marcar como conferido' })).toBeVisible();

    // Quando: vai à Equipe
    await page.goto('/equipe/');
    // Então: a linha-resumo da importação, só com contagens
    await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('importou 2 cadastros de pessoas');
  });

  test('quando a pessoa da semente já está no SEMPER, então a conferência diz o que vai ser preenchido', async ({ page }) => {
    // Dado
    const janela = await abrirImportacao(page);
    const escolha = page.waitForEvent('filechooser');
    await janela.getByRole('button', { name: 'Escolher o arquivo' }).click();
    await (await escolha).setFiles(PESSOAS);
    await janela.getByRole('button', { name: 'Conferir' }).click();
    // Quando
    await janela.getByRole('tab', { name: /Completar 1/ }).click();
    // Então
    const linha = janela.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    await expect(linha).toContainText('Vai preencher: E-mails.');
    await expect(linha).toContainText('111.444.777-35');
  });
});
