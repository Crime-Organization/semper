# Testes do SEMPER

Três tipos de teste, todos escritos no mesmo padrão (BDD, em português). Nenhum deles fala com o Supabase: os testes usam o banco fictício (`src/dados/falso.ts`) ou respostas simuladas.

| Tipo | O que confere | Ferramenta | Onde fica | Comando |
|---|---|---|---|---|
| Unitário | Regras e funções sem tela (CPF, qualificação, datas, desfazer…) | Vitest | ao lado do código: `src/**/*.test.ts` | `npm run verificar` |
| Componente | Peças de `src/ui/` montadas sozinhas (botões, janelas, avisos, busca…) | Vitest + Testing Library | ao lado da peça: `src/ui/*.test.tsx` | `npm run verificar` |
| Ponta a ponta | Fluxos inteiros no navegador (entrar, cadastrar, quadro, equipe…) | Playwright | `e2e/*.spec.ts` | `npm run testar-telas` |

Os comandos rodam dentro de `app/` (ou com `--prefix app` a partir da raiz). No GitHub, os três rodam na rotina `.github/workflows/testes.yml`, chamada a cada push e pull request (`verificar.yml`) e a cada versão (`publicar.yml`): se algum falhar, nada é compilado nem publicado.

## O padrão

1. O `describe` de fora nomeia a funcionalidade ("Cadastro de pessoas"). Um `describe` de dentro, opcional, nomeia o contexto em comum: "Dado um CPF", "Dada uma pessoa jurídica".
2. Cada `it` (ou `test`, no Playwright) é **um comportamento só**, com o nome "quando …, então …". Se o teste falhar, o nome diz o que parou de valer.
3. O corpo é dividido pelos comentários `// Dado`, `// Quando` e `// Então`. O `// Dado` pode faltar quando não há preparação.
4. A mesma regra com entradas diferentes usa `it.each` com uma tabela, e o valor entra no nome de cada linha (`%s`, `%j`).
5. Nomes em português, com as palavras de quem usa o SEMPER (pessoa, vínculo, convite), e não nomes de função.
6. Nas telas, os elementos são achados como uma pessoa os acha: pelo papel e pelo nome (`getByRole('button', { name: 'Salvar' })`), pelo rótulo (`getByLabel('CPF')`) ou pelo texto. **Nunca por classe CSS**: assim os testes continuam valendo quando a aparência muda.

## Exemplos

### Unitário

```ts
describe('Documentos', () => {
  describe('Dado um CPF', () => {
    it.each([
      ['529.982.247-25', true],
      ['529.982.247-26', false]
    ])('quando o CPF é %s, então a validação dá %s', (cpf, valido) => {
      // Quando
      const resultado = cpfValido(cpf);
      // Então
      expect(resultado).toBe(valido);
    });
  });
});
```

Relógio, fuso e internet ficam sob controle: `vi.useFakeTimers()` + `vi.setSystemTime()` para datas relativas, `TZ=America/Sao_Paulo` já vem nos comandos, e `vi.stubGlobal('fetch', …)` simula a Receita, a BrasilAPI e o ViaCEP (veja `src/regras/pessoa.test.ts`).

### Componente

O arquivo começa com `// @vitest-environment jsdom`, que dá ao teste uma página para montar a peça.

```tsx
// @vitest-environment jsdom
describe('Excluir em dois cliques', () => {
  it('quando recebe o primeiro clique, então pede confirmação sem excluir', async () => {
    // Dado
    const excluir = vi.fn();
    render(<BotaoDuplo confirmar="Confirmar exclusão" aoConfirmar={excluir}>Excluir</BotaoDuplo>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Então
    expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeInTheDocument();
    expect(excluir).not.toHaveBeenCalled();
  });
});
```

Peças que guardam estado do sistema todo (`avisos.tsx`, `janela.tsx`) são recarregadas a cada caso com `vi.resetModules()`. Quando a peça consulta o banco, `vi.mock('../dados', …)` define as respostas (veja `src/ui/BuscaPessoa.test.tsx`).

### Ponta a ponta

```ts
test('quando o CPF tem um dígito errado, então o formulário avisa e não segue', async ({ page }) => {
  // Dado
  await comecarPessoaFisica(page, 'cpf errado');
  // Quando
  await page.getByLabel('CPF').fill('52998224726');
  await page.getByRole('button', { name: 'Próxima' }).click();
  // Então
  await expect(page.getByText('CPF inválido: confira os números.')).toBeVisible();
});
```

- O Playwright sobe sozinho o banco fictício (`npm run teste`, porta 8091) e o encerra no fim. Se ele já estiver rodando no computador, é aproveitado.
- Cada teste abre uma aba nova, e o banco fictício começa do zero **com a sessão aberta** (como o master do escritório de exemplo). Para testar sem sessão, use `sair(page)` de `e2e/ajudantes.ts`.
- Os testes usam pessoas, colunas e o escritório da semente de `falso.ts` pelo nome. Mudou a semente? Rode `npm run testar-telas`.
- Opções de rádio são clicadas pelo texto do rótulo (`getByText('Pessoa física', { exact: true })`), como a pessoa faz.
- Para arrastar no quadro, a coluna de destino precisa estar visível na tela.

## Rodar

```bash
npm install --prefix app                          # primeira vez
npx --prefix app playwright install chromium      # primeira vez, para os testes de ponta a ponta
npm run verificar --prefix app                    # tipos + lint + unitários + componentes
npm run lint --prefix app                         # só o lint
npm run testar-telas --prefix app                 # ponta a ponta
```

Quando um teste de ponta a ponta falha na rotina de publicação, o relatório (com o passo que falhou) fica para baixar na página da execução, em **Artifacts → relatorio-playwright**. No computador, `npx playwright show-report` abre o último relatório.
