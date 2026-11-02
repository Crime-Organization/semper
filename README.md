# SEMPER

Plataforma de gestão para escritórios de advocacia (SaaS multiescritório): contratos, demandas, tarefas, processos, pessoas, compromissos, financeiro e o conteúdo do site. Publicada em https://semper.app.br/.

## Como vai ao ar

O sistema fica em `app/` (React + TypeScript + Vite). Os testes ficam numa rotina própria, `.github/workflows/testes.yml`, com três jobs em paralelo: tipos e lint, unitários e de componente, e ponta a ponta (veja [`app/TESTES.md`](app/TESTES.md)). Cada push no `main` e cada pull request passam por `.github/workflows/verificar.yml`, que chama os testes e só compila se todos passarem, mas não publica nada.

O site só muda quando sai uma **versão** (`.github/workflows/publicar.yml`):

- **Versão nova:** GitHub → Actions → *Publicar o SEMPER* → *Run workflow* (no `main`), escolhendo o tipo de mudança. O número sai sozinho da última marca: correção `v1.2.3 → v1.2.4`, novidade `→ v1.3.0`, grande `→ v2.0.0` (a primeira é `v1.0.0`). Também dá para criar a marca à mão: `git tag v1.2.4 && git push origin v1.2.4`.
- **Voltar atrás:** *Run workflow* preenchendo `versao` com uma marca que já existe (ex.: `v1.2.3`).

A rotina escolhe a versão, roda os testes (`testes.yml`) nesse mesmo commit e, só se todos passarem, compila, cria a marca `vX.Y.Z` e a versão no GitHub (Releases, com a lista de commits), e grava o site pronto no ramo **`publicacao`**. Para ver o que está no ar, abra https://semper.app.br/versao.txt. A Hostinger (hPanel → Avançado → GIT, site `semper.app.br`) publica esse ramo; o `.htaccess` manda o `www` para `semper.app.br` e responde 410 (desligado) no endereço antigo, semper.bragaferreira.adv.br. Se a checagem ou os testes falharem, nada é publicado e o site continua como estava. Leva de 1 a 2 minutos.

> **Transição:** enquanto a Hostinger não usar o ramo `publicacao`, ela continua publicando a raiz do `main`, onde ainda está a versão antiga em JavaScript simples (guardada também na marca `js-simples`). Depois da troca, essa versão antiga sai da raiz.

| Pasta / arquivo | Conteúdo |
|---|---|
| `app/src/paginas/` | Telas: `Entrada` (login, primeiro acesso, recuperação de senha, cliente), `Inicio`, `Pessoas` e `CartaoPessoa`, `NovaPessoa` (cadastro em etapas), `Equipe` e `Compromissos` (a agenda: por data, em tabela e em quadro, com a visão por data em `agenda/`). |
| `app/src/ui/` | Peças comuns: `Casca` (barra lateral), `PaginaModulo` (com o menu ⋯ de `Menu`), `quadro/` (`Kanban` e `useColunas`), avisos e desfazer (Ctrl+Z), janelas, painel do cartão, tema e sessão. |
| `app/src/dados/` | `supabase.ts` (única parte que fala com o banco), `falso.ts` (banco fictício para testes), `tipos.ts` (o formato dos dados e o contrato `Dados`, dividido por área), `contrato.test.ts` (confere que o fictício se comporta como o banco), `erros.ts` (erros do banco em português), `consultas.ts` (CNPJ na Receita e CEP) e `limites.ts` (tamanhos de página e de campo). |
| `app/src/regras/` | Regras puras, sem banco nem internet: formatos, validação, qualificação, conversão das respostas de CNPJ e CEP, vínculos, texto comparável (`texto.ts`), o CSV do Google Contatos (`contatosGoogle.ts`) e a agenda (`compromisso.ts` e `agenda.ts`, com o dia, a semana e o mês no horário de Brasília), com os testes. |
| `app/e2e/` e `app/TESTES.md` | Testes de ponta a ponta (Playwright, no banco fictício) e o padrão dos testes (BDD: Dado / Quando / Então). |
| `app/src/marca.ts` e `app/src/imagens/` | Marca do produto (SEMPER): nome, foto, cores, contato e conexão com o banco. O nome, a logomarca e os dados de cada escritório ficam no banco e são editados em Configurações. |
| `app/src/estilo.css` | Estilo comum (veja `DESIGN.md`). |
| `app/public/.htaccess` | Regras da hospedagem para o site publicado. |
| `supabase/` | Estrutura do banco: `migrations/` (uma migração por mudança, na ordem da data no nome; as oito primeiras eram os scripts `banco/001` a `008`) e `config.toml` (banco local do Supabase CLI, nas portas 553xx). |
| `banco/emails/` | Modelos de e-mail do Supabase em português. |
| `DESIGN.md` | Sistema visual (cores, tipografia, componentes, página de módulo, kanban). |
| `referencia/` | Formulário de cadastro antigo do site, usado como referência. |
| `Trello/` | Exportações do Trello com dados de clientes. Não versionado. |

## Banco de dados

Projeto Supabase `semper` (região São Paulo). Cada escritório é isolado: toda linha tem `escritorio_id` e as regras de acesso (RLS) só mostram o que pertence ao escritório de quem está logado. O cadastro de usuários é só por convite.

### Mudar a estrutura do banco

Toda mudança é uma migração em `supabase/migrations/`, nunca um clique no painel do Supabase. O banco guarda quais migrações já rodaram (tabela `supabase_migrations.schema_migrations`), então cada uma roda uma vez só, na ordem.

1. Criar: `supabase migration new <nome>` e escrever o SQL. A migração **só acrescenta** (tabela, coluna, função, regra); apagar ou renomear fica para uma migração posterior, para a versão anterior do site continuar funcionando.
2. Testar do zero num banco local (precisa do Docker): `supabase db start` e `supabase db reset --local --no-seed`. Para desligar: `supabase stop`.
3. Abrir o PR com a migração.
4. Aplicar em produção (por enquanto, uma pessoa com a senha do banco): `supabase link --project-ref uzafzwqjpxxiovfunxfm` e `supabase db push`. O `db push` mostra o que vai aplicar e pede confirmação.

Configuração no painel do Supabase (Authentication):
- **URL Configuration**: Site URL `https://semper.app.br/`; Redirect URLs `https://semper.app.br/**` e `http://localhost:8090/**`. Os endereços antigos (semper.bragaferreira.adv.br e bragaferreira.adv.br/semper) foram desligados e não levam mais ao SEMPER.
- **Emails**: modelos em português em `banco/emails/` (veja o `LEIA-ME.txt` de lá).
- **SMTP**: Hostinger, `smtp.hostinger.com` porta 465. `nao-responda@semper.app.br` é um alias: o login (Username e senha ou senha de aplicativo) é o da caixa principal a que ele pertence, e o alias entra só como remetente (`SEMPER <nao-responda@semper.app.br>`). O domínio semper.app.br tem SPF (`_spf.mail.hostinger.com`), DKIM (`hostingermail-a/b/c._domainkey`) e DMARC (`p=none`). Até a troca, o envio saía pelo Google Workspace da Braga Ferreira (`nao-responda@bragaferreira.adv.br`).

## Testar no computador

Na primeira vez, instale as dependências dentro de `app/`:

```bash
npm install --prefix app
```

Com pessoas fictícias e sem login (nada vai para o banco), em http://localhost:8091/:

```bash
npm run teste --prefix app
```

Com o banco de verdade, em http://localhost:8090/:

```bash
npm run dev --prefix app
```

Conferir os tipos, o lint e rodar os testes unitários e de componente:

```bash
npm run verificar --prefix app
```

Só o lint ([oxlint](https://oxc.rs), regras em `app/.oxlintrc.json`); `npm run build` também passa por ele e para se houver erro:

```bash
npm run lint --prefix app
```

Rodar os testes de ponta a ponta no navegador (sobe o banco fictício sozinho; na primeira vez, instale o navegador com `npx --prefix app playwright install chromium`):

```bash
npm run testar-telas --prefix app
```

As rotinas do GitHub rodam os dois. O padrão para escrever testes novos está em [`app/TESTES.md`](app/TESTES.md).

Fluxo de trabalho: pull → editar → testar → commit → push (a verificação é automática) → quando quiser pôr no ar, publicar uma versão.
