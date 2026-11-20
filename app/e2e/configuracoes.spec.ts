// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ajudantes';

test.describe('Configurações do escritório', () => {
  test('quando o administrador muda o nome do escritório e salva, então o nome novo aparece na barra lateral', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    const nome = page.getByLabel('Nome do escritório');
    await expect(nome).toHaveValue('Escritório Exemplo (teste)');
    // Quando
    await nome.fill('Advocacia Montes Claros');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Dados do escritório salvos.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Advocacia Montes Claros: início' })).toBeVisible();
  });

  test('quando o administrador desfaz a mudança, então o nome antigo volta', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    await page.getByLabel('Nome do escritório').fill('Advocacia Montes Claros');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(page.getByRole('link', { name: 'Escritório Exemplo (teste): início' })).toBeVisible();
  });
});

// No banco fictício não há Google: "Conectar conta Google" volta direto como se a autorização tivesse dado certo.
test.describe('Conta Google do escritório', () => {
  test('quando o administrador conecta a conta Google, então volta a Configurações com a conta ligada e um aviso', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    // Quando
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    // Então
    await expect(page.getByText('Conta Google ligada.', { exact: false })).toBeVisible();
    await expect(google).toContainText('Ligada: contato@exemplo.com');
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });

  test('quando o administrador desliga a conta, com a confirmação, então ela deixa de estar ligada e fica no registro de ações', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    await expect(google).toContainText('Ligada: contato@exemplo.com');
    // Quando
    await google.getByRole('button', { name: 'Desligar' }).click();
    await google.getByRole('button', { name: 'Confirmar: desligar' }).click();
    // Então
    await expect(page.getByText('Conta Google desligada.', { exact: false })).toBeVisible();
    await expect(google.getByRole('button', { name: 'Conectar conta Google' })).toBeVisible();
    await page.goto('/equipe/');
    await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('excluiu a conta Google do escritório');
  });

  test('quando a volta do Google traz um pedido que não existe (vencido, ou de outra pessoa), então nada é ligado e a página avisa', async ({ page }) => {
    // Quando
    await page.goto('/configuracoes/?google_estado=' + 'f'.repeat(64) + '&google_codigo=qualquer');
    // Então
    await expect(page.getByText('O pedido de ligação venceu.', { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Conta Google' }).getByRole('button', { name: 'Conectar conta Google' })).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });

  test('quando o administrador liga a sincronização dos contatos, então a primeira sincronização fica por fazer, e o primeiro "Sincronizar agora" a faz', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    const contatos = google.getByRole('group', { name: 'Contatos no Google' });
    // Quando
    await contatos.getByRole('checkbox', { name: 'Criar e atualizar no Google os contatos das pessoas cadastradas e editadas' }).check();
    // Então
    await expect(contatos).toContainText('A primeira sincronização ainda não terminou');
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    await expect(page.getByText('Primeira sincronização feita: 0 contatos do Google ligados a pessoas do SEMPER.', { exact: false })).toBeVisible();
    await expect(contatos).not.toContainText('A primeira sincronização ainda não terminou');
    await expect(contatos).toContainText('Tudo em dia: não há ninguém esperando para ir ao Google.');
  });

  test('dada a primeira sincronização feita, quando o administrador cadastra alguém, então a pessoa espera na fila e "Sincronizar agora" a leva ao Google', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    const contatos = google.getByRole('group', { name: 'Contatos no Google' });
    const chave = contatos.getByRole('checkbox', { name: 'Criar e atualizar no Google os contatos das pessoas cadastradas e editadas' });
    await expect(chave).not.toBeChecked();
    await expect(contatos.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);
    // Quando
    await chave.check();
    await expect(page.getByText('Sincronização ligada', { exact: false })).toBeVisible();
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    await expect(page.getByText('Primeira sincronização feita', { exact: false })).toBeVisible();
    // O cadastro pelo banco fictício da própria página (o Vite serve o módulo pelo caminho do arquivo).
    await page.evaluate(async () => {
      const caminho = '/src/dados/falso.ts';
      const { SD } = await import(/* @vite-ignore */ caminho) as typeof import('../src/dados/falso');
      await SD.pessoaCriar({ tipo: 'pf', nome: 'CONTATO NOVO NO GOOGLE' });
    });
    await page.reload();
    // Então
    await expect(contatos).toContainText('1 pessoa esperando para ir ao Google.');
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    await expect(page.getByText('1 pessoa foi ao Google.')).toBeVisible();
    await expect(contatos).toContainText('Tudo em dia: não há ninguém esperando para ir ao Google.');
    await expect(contatos).toContainText('Última sincronização:');
  });

  /** Liga a conta e a sincronização e põe contatos na conta Google simulada (o que ela já tinha antes do SEMPER). */
  async function contaComContatos(page: Page, noGoogle: unknown[], googleFora = false) {
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    const contatos = google.getByRole('group', { name: 'Contatos no Google' });
    await contatos.getByRole('checkbox', { name: 'Criar e atualizar no Google os contatos das pessoas cadastradas e editadas' }).check();
    await expect(contatos).toContainText('A primeira sincronização ainda não terminou');
    await page.evaluate(lista => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { contatosGoogle: Record<string, unknown> };
      bd.contatosGoogle.noGoogle = lista.contatos;
      bd.contatosGoogle.googleFora = lista.fora;
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    }, { contatos: noGoogle, fora: googleFora });
    await page.reload();
    return contatos;
  }

  test('dados contatos que já estão no Google, quando a primeira sincronização roda, então os duvidosos aparecem em "Para conferir" e o administrador decide cada um', async ({ page }) => {
    // Dado: a conta Google já tem um contato certo de uma pessoa da semente (nome e telefone), o telefone da recepção (de
    // várias pessoas da equipe) e um contato só com o nome de outra pessoa.
    const contatos = await contaComContatos(page, [
      { resourceName: 'people/c1', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '+55 38 99000-1000' }] },
      { resourceName: 'people/c2', names: [{ displayName: 'Recepção' }], phoneNumbers: [{ value: '(38) 3222-0000' }], birthdays: [{ date: { month: 3, day: 9 } }] },
      { resourceName: 'people/c3', names: [{ displayName: 'Maria Aparecida Exemplo' }] }
    ]);
    // Quando
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    // Então
    await expect(page.getByText('Primeira sincronização feita: 1 contato do Google ligado a pessoas do SEMPER, 2 contatos para conferir.', { exact: false })).toBeVisible();
    const lista = contatos.getByRole('region', { name: /Para conferir/ });
    await expect(lista.getByRole('heading', { name: /Para conferir/ })).toContainText('2');
    const maria = lista.getByRole('group', { name: 'Contato do Google: Maria Aparecida Exemplo' });
    await expect(maria).toContainText('Só o nome bate');
    await maria.getByRole('button', { name: 'Ligar a MARIA APARECIDA EXEMPLO' }).click();
    await expect(page.getByText('Contato ligado à pessoa.', { exact: false })).toBeVisible();
    await expect(maria).toHaveCount(0);
    const recepcao = lista.getByRole('group', { name: 'Contato do Google: Recepção' });
    await expect(recepcao).toContainText('No Google: (38) 3222-0000 · aniversário 09/03');
    await expect(recepcao.getByRole('list', { name: 'Pessoas possíveis' }).getByRole('listitem')).not.toHaveCount(1);
    await recepcao.getByRole('button', { name: 'É outra pessoa' }).click();
    await expect(page.getByText('Marcado como outra pessoa', { exact: false })).toBeVisible();
    await expect(contatos.getByRole('region', { name: /Para conferir/ })).toHaveCount(0);
    await expect(contatos).toContainText(/pessoas? esperando para ir ao Google\./);
  });

  test('dado um contato para conferir, quando o administrador procura outra pessoa e a escolhe, então o contato é ligado a ela', async ({ page }) => {
    // Dado
    const contatos = await contaComContatos(page, [{ resourceName: 'people/c3', names: [{ displayName: 'Maria Aparecida Exemplo' }] }]);
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    await expect(page.getByText('Primeira sincronização feita', { exact: false })).toBeVisible();
    // Uma pessoa cadastrada depois, ainda sem contato no Google (pelo banco fictício da própria página).
    await page.evaluate(async () => {
      const caminho = '/src/dados/falso.ts';
      const { SD } = await import(/* @vite-ignore */ caminho) as typeof import('../src/dados/falso');
      await SD.pessoaCriar({ tipo: 'pf', nome: 'MARIA APARECIDA DE OUTRA FAMILIA' });
    });
    await page.reload();
    const item = contatos.getByRole('group', { name: 'Contato do Google: Maria Aparecida Exemplo' });
    // Quando
    await item.getByRole('button', { name: 'Procurar outra pessoa' }).click();
    await item.getByLabel('Ligar a outra pessoa do escritório').fill('outra familia');
    await item.getByRole('button', { name: /MARIA APARECIDA DE OUTRA FAMILIA/ }).click();
    // Então
    await expect(page.getByText('Contato ligado à pessoa.', { exact: false })).toBeVisible();
    await expect(contatos.getByRole('region', { name: /Para conferir/ })).toHaveCount(0);
  });

  test('dado um contato repetido no Google, quando aparece em "Para conferir", então a pessoa já ligada não tem "Ligar" e o administrador pode ignorá-lo', async ({ page }) => {
    // Dado: dois contatos com o nome e o telefone da mesma pessoa da semente
    const contatos = await contaComContatos(page, [
      { resourceName: 'people/c1', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '+55 38 99000-1000' }] },
      { resourceName: 'people/c4', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '(38) 99000-1000' }] }
    ]);
    // Quando
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    // Então
    const repetido = contatos.getByRole('group', { name: 'Contato do Google: José da Silva Teste' });
    await expect(repetido).toContainText('Repetido');
    await expect(repetido.getByRole('list', { name: 'Pessoas possíveis' })).toContainText('Já ligada a outro contato do Google');
    await expect(repetido.getByRole('button', { name: /^Ligar a / })).toHaveCount(0);
    await repetido.getByRole('button', { name: 'Ignorar' }).click();
    await expect(page.getByText('Contato ignorado', { exact: false })).toBeVisible();
    await expect(contatos.getByRole('region', { name: /Para conferir/ })).toHaveCount(0);
  });

  test('dado o Google fora, quando o administrador pede "Sincronizar agora", então o aviso diz que a primeira sincronização não terminou (e não que está tudo em dia)', async ({ page }) => {
    // Dado
    const contatos = await contaComContatos(page, [], true);
    // Quando
    await contatos.getByRole('button', { name: 'Sincronizar agora' }).click();
    // Então
    await expect(page.getByText('A primeira sincronização ainda não terminou: nada foi criado no Google.', { exact: false })).toBeVisible();
    await expect(page.getByText('os contatos já estavam em dia', { exact: false })).toHaveCount(0);
    await expect(contatos).toContainText('A primeira sincronização ainda não terminou');
  });

  test('dada a autorização do Google vencida, quando o administrador abre Configurações, então vê o aviso com o que fazer', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as Record<string, unknown>;
      bd.ligacaoGoogle = { conta_email: 'contato@exemplo.com', escopos: [], ligado_em: new Date().toISOString(), ligado_por: 'u-master' };
      bd.contatosGoogle = { ativos: true, fila: ['p-esperando'], com_falha: 1, problema: 'autorizacao', problema_em: new Date().toISOString(), sincronizado_em: null };
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // Quando
    await page.reload();
    // Então
    const contatos = page.getByRole('region', { name: 'Conta Google' }).getByRole('group', { name: 'Contatos no Google' });
    await expect(contatos.getByRole('alert')).toContainText('A autorização do Google venceu ou foi retirada.');
    await expect(contatos.getByRole('alert')).toContainText('Ligar outra conta');
    await expect(contatos).toContainText('1 pessoa esperando para ir ao Google (1 com falha).');
  });

  test('quando o administrador desliga a sincronização, então a fila esvazia e o botão "Sincronizar agora" some', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    const contatos = google.getByRole('group', { name: 'Contatos no Google' });
    const chave = contatos.getByRole('checkbox', { name: 'Criar e atualizar no Google os contatos das pessoas cadastradas e editadas' });
    await chave.check();
    await expect(contatos.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible();
    // Quando
    await chave.uncheck();
    // Então
    await expect(page.getByText('Sincronização desligada', { exact: false })).toBeVisible();
    await expect(contatos.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);
    await expect(chave).not.toBeChecked();
  });

  test('quando a volta do Google traz uma recusa, então a página avisa e limpa o endereço', async ({ page }) => {
    // Quando
    await page.goto('/configuracoes/?google=recusado');
    // Então
    await expect(page.getByText('A autorização no Google foi cancelada. Nada foi ligado.')).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });
});
