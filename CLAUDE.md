# SEMPER: regras para o agente

Gestão para escritórios de advocacia (SaaS multiescritório), com dados pessoais de clientes sob a LGPD.
O app fica em `app/` (React + TypeScript + Vite); o banco é Supabase. Leia o `README.md` para a visão geral,
o `DESIGN.md` para o visual e o `app/TESTES.md` para os testes.

Quem pede as mudanças nem sempre é programador. Explique em português simples o que vai fazer e por quê,
e **pergunte antes** de qualquer coisa que mexa no banco de produção, apague dados ou publique o site.

## Toda mudança tem uma tarefa no quadro

Tudo o que for feito **vem de uma tarefa do quadro ou cria uma**. Nada de mudança sem tarefa: é o quadro que
mostra o que está sendo feito, por quem e por quê. Quadro: https://github.com/orgs/Crime-Organization/projects/2

1. **Antes de começar, procure a tarefa.** `gh issue list -R Crime-Organization/semper --search "<palavras>"`
   (inclua `--state all` para ver se já foi feita). Se existir, use essa.
2. **Se não existir, crie** no formato do modelo de tarefa (`.github/ISSUE_TEMPLATE/tarefa.yml`): título numa frase,
   e o corpo com `### Descrição`, `### Critérios de aceitação` (caixas `- [ ]` no padrão Dado / Quando / Então),
   `### Área` e `### Observações`. Mostre o texto à pessoa antes de criar. Depois:
   ```bash
   gh issue create -R Crime-Organization/semper --title "…" --body-file corpo.md
   gh project item-add 2 --owner Crime-Organization --url <link da issue>
   ```
   e preencha **Área** e **Status** no quadro.
3. **Mantenha o Status em dia:** *In Progress* ao começar; *Em revisão* ao abrir o PR; *Bloqueado* se parar
   esperando algo ou alguém (com um comentário dizendo o quê); *Done* vem sozinho no merge, pelo `Closes #N`.
4. **Escopo:** se no meio do caminho aparecer outra coisa para fazer, não misture no mesmo PR. Crie uma tarefa
   nova para ela e siga com a atual.
5. Mudança pequena (texto, um ajuste de estilo) também tem tarefa: pode ser curta, mas existe.

## Banco de dados

O banco guarda dados reais de clientes. Um erro nele não tem "desfazer".

- **Nunca rode SQL, scripts ou comandos contra o banco de produção** (projeto `uzafzwqjpxxiovfunxfm`).
  Nem para "só consultar", nem para "limpar dados de teste". Se algo precisar ser feito em produção,
  escreva o passo a passo e peça para uma pessoa fazer.
- **Para desenvolver, use o banco fictício:** `npm run teste --prefix app` (http://localhost:8091/).
  Ele roda no navegador, sem login e sem tocar no Supabase. Só use `npm run dev` (banco de verdade)
  quando a pessoa pedir, e avise que ele usa dados reais até existir o banco de desenvolvimento (tarefa #74).
- **Nunca mude a estrutura do banco pelo painel do Supabase** (criar tabela ou coluna clicando).
  Toda mudança de estrutura é uma **migração nova** em `supabase/migrations/` e passa por pull request:
  - crie com `supabase migration new <nome>` (ex.: `supabase migration new contratos`), que põe a data no nome;
  - antes do PR, aplique do zero num banco local: `supabase db start` e `supabase db reset --local --no-seed`
    (as portas ficam em 553xx, veja `supabase/config.toml`);
  - nunca edite uma migração que já foi aplicada: corrija com uma migração nova;
  - quem aplica em produção é uma pessoa (e, depois da #76, a rotina Publicar), nunca o agente.
- **Toda migração só acrescenta.** Pode criar tabela, coluna, função ou regra. Não pode apagar nem renomear
  no mesmo passo: a versão anterior do site precisa continuar funcionando com o banco novo (é o que permite
  voltar a versão do site). Apagar o que ficou sem uso é uma migração separada, depois.
- **Toda tabela nova tem `escritorio_id` e regras RLS** que só mostram as linhas do escritório de quem está logado,
  como as tabelas de `supabase/migrations/20261024000001_base.sql`. Um escritório nunca pode ver dados de outro.
- **Só `app/src/dados/supabase.ts` fala com o banco.** Função nova de dados entra no contrato `Dados`
  (`app/src/dados/tipos.ts`, dividido por área: `DadosPessoas`, `DadosEquipe`…), em `supabase.ts` **e** no banco
  fictício `falso.ts`, que precisa se comportar igual (o `contrato.test.ts` confere).
- A chave do Supabase em `app/src/marca.ts` é a *publishable* (pública por natureza). Nunca coloque no código
  a senha do banco, a chave `service_role` ou qualquer outro segredo.

## Antes de criar algo, procure o que já existe

Componente, regra ou função nova **segue o padrão que já existe**. Antes de escrever, procure em:

| Precisa de | Use | Onde |
|---|---|---|
| Botão, link com cara de botão, campo de formulário, grupo de opções, aviso, selo, cartão, título de seção, nota, dica, carregando, vazio | `BotaoLink`, `Campo` + `propsDoCampo`, `Escolhas`, `Aviso`, `Selo`, `Cartao`, `TituloSecao`, `Nota`, `Dica`, `Carregando`, `Vazio` | `app/src/ui/base/` |
| Botão com comportamento (ocupado, confirmar em dois cliques) | `Botao` e afins | `app/src/ui/Botoes.tsx` |
| Página de módulo (título, busca, filtros, menu ⋯, tabela/kanban) | `PaginaModulo`, `Kanban`, `useColunas` | `app/src/ui/PaginaModulo.tsx`, `app/src/ui/quadro/` |
| Janela, confirmação, pedir um texto | `janela`, `confirmar`, `pedirTexto` | `app/src/ui/janela.tsx` |
| Aviso no pé da tela, erro, desfazer | `avisar`, `falha`, `registrarDesfazer` | `app/src/ui/avisos.tsx` |
| Estado do sistema todo, fora dos componentes | `criarLoja` (padrão Observer; na tela, `loja.usar()`) | `app/src/ui/loja.ts` |
| Busca de pessoa, avatar, ícone, menu, painel do cartão | `BuscaPessoa`, `Avatar`, `Icone`, `Menu`, `PainelCartao` | `app/src/ui/` |
| Validar, formatar, converter (CPF, CNPJ, datas, telefone, qualificação) | funções puras | `app/src/regras/` |
| Cores, tamanhos, espaçamentos | variáveis CSS (`--accent`, `--ink`, `--line`…) | `app/src/estilo.css` e `DESIGN.md` |

- **O módulo Pessoas é o modelo** para os módulos novos (Contratos, Demandas…): mesma página de módulo, quadro e
  tabela, cartão, cadastro. Copie a estrutura, não reinvente.
- **Não escreva HTML e classes na mão** quando houver peça pronta em `ui/base/`. Se faltar uma peça, crie em
  `ui/base/` (com teste) e use dali, em vez de resolver só na tela.
- **Nada de cor, tamanho ou fonte soltos** (`#377D22`, `14px`): use as variáveis de `estilo.css`. Não adote
  Tailwind nem outra biblioteca de estilo.
- **Regra de negócio fica em `app/src/regras/`, pura** (sem tela, sem banco, sem `document`), com teste unitário.
  A tela só chama a regra e mostra o resultado.
- Nomes de arquivos, funções, variáveis e mensagens em **português**, com as palavras de quem usa o SEMPER
  (pessoa, vínculo, convite, escritório).

## Sem números mágicos

Número com significado ganha **nome**, num lugar só, com um comentário dizendo o que ele é.

- Tempos: `app/src/ui/tempos.ts` (`SEGUNDO`, `MINUTO`, `DURACAO_AVISO`, `ESPERA_AO_DIGITAR`…). Escreva
  `5 * SEGUNDO`, nunca `5000`.
- Quantidades e tamanhos de campo: `app/src/dados/limites.ts` (`POR_PAGINA`, `TAMANHO_PESSOA`…). Os tamanhos
  marcados ali são exigidos pelo banco: mudou aqui, muda a migração também.
- Precisa de um número novo? Acrescente nesses arquivos (ou crie a constante nomeada no topo do módulo, se só ele usa).

```ts
// Não
setTimeout(() => setCopiada(false), 2000);
// Sim
setTimeout(() => setCopiada(false), DURACAO_AVISO.ok);   // ou uma constante nova em tempos.ts
```

Ainda há números soltos de antes desta regra (ex.: `setTimeout(..., 200)` em `paginas/novaPessoa/etapas.tsx`,
`2000` em `paginas/Home.tsx`, `150` em `ui/Botoes.tsx`, `300` em `ui/avisos.tsx`). Ao mexer num desses arquivos,
dê nome ao número. `setTimeout(..., 0)` (esperar o React desenhar) não precisa de nome.

## Sem cadeias de `if`

Quando o código escolhe o que fazer pelo **tipo** ou **estado** de algo, use uma **tabela** (objeto ou `Record`),
não uma sequência de `if`/`else if`/`switch`.

Antes, o cadastro de pessoa validava cada etapa assim, no meio da tela (665 linhas no arquivo):

```ts
if (e === 's-tipo') marcar('tipo', !!a.tipo);
if (e === 's-ident') { … }
if (e === 's-pf') { … }
if (e === 's-empresa') { … }
// e assim por diante
```

Hoje cada etapa é um objeto que sabe se validar (padrão State; o arquivo caiu para 426 linhas):

```ts
// app/src/regras/cadastro.ts
export const VALIDACAO: Record<Etapa, (a: CamposCadastro) => ResultadoEtapa> = {
  's-tipo': a => { … },
  's-pf': a => { … },
};
// a tela só chama: VALIDACAO[etapaAtual](campos)
```

- Etapa, tipo ou caso novo = **uma entrada nova na tabela**, sem mexer nas outras.
- `Record<Tipo, …>` faz o TypeScript reclamar se faltar algum caso.
- `if` simples continua bem (uma condição, um retorno antecipado). O problema é a escada de casos.
- Veja também `paginas/novaPessoa/etapas.tsx` (um componente por etapa) e `AO_ENTRAR` em `regras/cadastro.ts`.

## Testes

- Todo código novo tem teste, no padrão **Dado / Quando / Então** de `app/TESTES.md`.
- Regra pura: teste unitário ao lado (`regras/*.test.ts`). Peça de `ui/`: teste de componente. Fluxo de tela:
  teste de ponta a ponta em `app/e2e/`.
- Nos testes de tela, ache os elementos como uma pessoa acha (papel, rótulo, texto), **nunca por classe CSS**.
- **Nunca apague, pule (`.skip`) ou afrouxe um teste para ele passar**, nem desligue uma regra do lint
  (`eslint-disable`, `@ts-ignore`). Se o teste falhou, o código está errado ou a regra mudou: explique qual dos dois.

## Antes de abrir o pull request

1. `npm run verificar --prefix app` (tipos, lint e testes) passa.
2. Se mexeu em tela: `npm run testar-telas --prefix app` passa e você conferiu no `npm run teste --prefix app`.
3. Trabalhe num ramo próprio, nunca direto no `main`.
4. Preencha o template do PR, com `Closes #N` da tarefa do quadro (veja "Toda mudança tem uma tarefa no quadro"),
   confira os critérios de aceitação da tarefa e mova a tarefa para *Em revisão*. PR sem tarefa não deve ser aberto.
5. Se o PR tem migração: diga no PR que ela só acrescenta e que a versão anterior do site continua funcionando.

O site **não** vai ao ar no merge: só quando alguém roda "Publicar o SEMPER" (veja o `README.md`). Não rode a
publicação sem a pessoa pedir.
