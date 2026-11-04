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
| `supabase/` | Estrutura do banco: `migrations/` (uma migração por mudança, na ordem da data no nome; as vinte primeiras eram os scripts `banco/001` a `020`) e `config.toml` (banco local do Supabase CLI, nas portas 553xx). |
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
4. Aplicar em produção (por enquanto, uma pessoa com a senha do banco): `supabase link --project-ref uzafzwqjpxxiovfunxfm` e `supabase db push --remote`. Na versão 3 do Supabase CLI, sem o `--remote` o comando age no banco local, não na produção. O `db push` mostra o que vai aplicar e pede confirmação. Aplique antes de rodar "Publicar o SEMPER": a publicação não aplica nem confere migrações.

Configuração no painel do Supabase (Authentication):
- **URL Configuration**: Site URL `https://semper.app.br/`; Redirect URLs `https://semper.app.br/**` e `http://localhost:8090/**`. Os endereços antigos (semper.bragaferreira.adv.br e bragaferreira.adv.br/semper) foram desligados e não levam mais ao SEMPER.
- **Emails**: modelos em português em `banco/emails/` (veja o `LEIA-ME.txt` de lá). Mudou um modelo lá? Ele só vale depois de colado de novo no painel.
- **Troca de e-mail** (Sign In / Providers > Email): **Confirm email** e **Secure email change** ligados, para a troca valer só com o link enviado ao e-mail atual e ao novo. O modelo "Change email address" precisa estar colado.
- **SMTP**: Hostinger, `smtp.hostinger.com` porta 465. `nao-responda@semper.app.br` é um alias: o login (Username e senha ou senha de aplicativo) é o da caixa principal a que ele pertence, e o alias entra só como remetente (`SEMPER <nao-responda@semper.app.br>`). O domínio semper.app.br tem SPF (`_spf.mail.hostinger.com`), DKIM (`hostingermail-a/b/c._domainkey`) e DMARC (`p=none`). Até a troca, o envio saía pelo Google Workspace da Braga Ferreira (`nao-responda@bragaferreira.adv.br`).
- **SMTP das funções do servidor**: o painel acima só vale para os e-mails do login. O aviso de troca de e-mail (função `equipe-trocar-email`) envia pela mesma caixa, com os segredos `SMTP_USUARIO` e `SMTP_SENHA` em Edge Functions > Secrets. As funções só alcançam a porta 465: o Supabase bloqueia a 25 e a 587. Se a senha mudar na Hostinger, atualize os dois lugares.
- **Rotina de reenvio dos avisos**: a cada 15 minutos, o `pg_cron` do banco chama a função `equipe-reenviar-avisos`, que tenta de novo os avisos de troca de e-mail que falharam (até 3 vezes: depois de 10 minutos, 2 horas e 12 horas). A função é publicada com `supabase functions deploy equipe-reenviar-avisos`. Ela precisa da mesma senha em dois lugares: o segredo `SENHA_DA_ROTINA` em Edge Functions > Secrets e `semper_senha_da_rotina` no Vault, onde também fica `semper_url_do_projeto`. Sem isso, o reenvio não roda e nada avisa, além da linha em Equipe e acessos. Para conferir, veja as respostas em `net._http_response`.

## Cópia de segurança do banco

**O que o Supabase garante:** nada. O projeto está no plano gratuito, que não faz backup automático e pausa projetos sem uso por 1 semana (conferido em 03/11/2026 em [supabase.com/pricing](https://supabase.com/pricing)). O plano Pro faz backup diário e guarda por 7 dias, mas o backup some se o projeto for apagado.

**O que existe:** a rotina `.github/workflows/copia-do-banco.yml`, que roda todo dia às 3h de Brasília e só lê o banco.

- **Onde fica:** nos artefatos do GitHub Actions deste repositório privado, por 30 dias. Depois disso, o GitHub apaga sozinho. Esse prazo fica em `retention-days`, na rotina.
- **Criptografia:** cada cópia sai criptografada com o [age](https://github.com/FiloSottile/age). A chave pública fica na variável `COPIA_CHAVE_PUBLICA`. **A chave secreta nunca vai ao GitHub** e fica num gerenciador de senhas, com quem cuida do sistema. Sem ela, nenhuma cópia abre.
- **Quem acessa:** quem lê o repositório baixa o arquivo, mas só abre com a chave secreta. A senha do banco fica no segredo `COPIA_BANCO_URL`, que nenhuma tela mostra, mas uma rotina alterada poderia usar: quem pode escrever no repositório tem esse poder, e por isso o acesso precisa continuar restrito.
- **O que entra:** os dados de `public` e `privado`, as contas de login (`auth.users`, inclusive o resumo das senhas), os vínculos e a verificação em duas etapas, e a estrutura.
- **O que não entra:** as fotos da equipe (precisam ser enviadas de novo), os segredos do Vault e das funções, sessões e links de uso único.
- **Se falhar:** a rotina fica vermelha em Actions, e o GitHub avisa por e-mail. Sem minutos disponíveis no GitHub, ela também falha.

**Para ligar (uma vez, por uma pessoa):**
1. No PowerShell, instale o programa e crie as chaves. Guarde o arquivo `chave-das-copias.txt` no gerenciador de senhas e apague-o do computador:
   ```bash
   winget install FiloSottile.age
   ```
   ```bash
   age-keygen -o chave-das-copias.txt
   ```
2. Em GitHub → Settings → Secrets and variables → Actions → Variables, crie `COPIA_CHAVE_PUBLICA` com o texto `age1...` que o comando mostrou.
3. Ainda em Actions, na aba Secrets, crie `COPIA_BANCO_URL` com o endereço **Session pooler** que aparece em Connect, no painel do Supabase, trocando `[YOUR-PASSWORD]` pela senha do banco. A rotina do GitHub só alcança esse endereço, não a conexão direta. Se a senha tiver caracteres especiais, como `@` ou `/`, eles precisam estar codificados.
4. Em Actions → Cópia do banco → Run workflow, rode uma vez e confira se fica verde.

**Testar uma cópia (faça ao ligar e de tempos em tempos):** baixe o artefato de uma execução em Actions e descompacte o `.zip`. Com o Docker aberto, no Git Bash, na raiz do projeto, carregue a cópia num banco local. O `restaurar-local.sh` só fala com o contêiner local e nunca com a produção. Os dados reais ficam no computador até o `supabase stop --no-backup`:

```bash
supabase db start && supabase db reset --local --no-seed
```

```bash
supabase/copia/restaurar-local.sh <arquivo .age> <arquivo da chave secreta>
```

**Em caso de perda de verdade:** não improvise. Num banco vazio, aplique as migrações da versão que estava no ar e, depois, o `dados.sql` da cópia com `psql`. Em seguida, configure de novo os segredos do Vault e das funções e peça às pessoas que enviem as fotos e entrem de novo. Ensaie antes num banco local.

**Testes de restauração registrados:**
- A cada envio, com dados inventados, a rotina de testes roda `supabase/copia/testar-restauracao.sh`: confere a criptografia, restaura e compara cada tabela e as regras de acesso.
- 04/11/2026, primeira cópia real (`semper-2026-11-04-2227`), num banco local: a chave abriu o arquivo, e voltaram 2.829 pessoas, 4 contas e 2.964 ações, sem vínculo quebrado. As 148 regras de acesso estavam lá, e nenhuma tabela de `public` ficou sem RLS. Um administrador real, numa sessão criada para o teste, viu as 2.829 pessoas do escritório; com uma sessão inexistente, viu 0. Essa cópia não tinha contratos, então os dados de contratos ainda não passaram por uma restauração real. O banco de teste e os arquivos foram apagados depois. A restauração num projeto novo do Supabase ainda não foi testada.

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
