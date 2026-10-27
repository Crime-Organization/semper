# SEMPER

Plataforma de gestão para escritórios de advocacia (SaaS multiescritório): contratos, demandas, tarefas, processos, pessoas, compromissos, financeiro e o conteúdo do site. Publicada em https://semper.app.br/.

## Como vai ao ar

O sistema fica em `app/` (React + TypeScript + Vite). A cada push no `main` que mexa em `app/`, a rotina do GitHub (`.github/workflows/publicar.yml`) confere os tipos, roda os testes, compila e grava o site pronto no ramo **`publicacao`**. A Hostinger (hPanel → Avançado → GIT, site `semper.app.br`) publica esse ramo; o `.htaccess` manda o `www` para `semper.app.br` e responde 410 (desligado) no endereço antigo, semper.bragaferreira.adv.br. Se a checagem ou os testes falharem, nada é publicado e o site continua como estava. Leva de 1 a 2 minutos.

> **Transição:** enquanto a Hostinger não usar o ramo `publicacao`, ela continua publicando a raiz do `main`, onde ainda está a versão antiga em JavaScript simples (guardada também na marca `js-simples`). Depois da troca, essa versão antiga sai da raiz.

| Pasta / arquivo | Conteúdo |
|---|---|
| `app/src/paginas/` | Telas: `Entrada` (login, primeiro acesso, recuperação de senha, cliente), `Inicio`, `Pessoas` e `CartaoPessoa`, `NovaPessoa` (cadastro em etapas) e `Equipe`. |
| `app/src/ui/` | Peças comuns: `Casca` (barra lateral), `PaginaModulo` (com o menu ⋯ de `Menu`), `quadro/` (`Kanban` e `useColunas`), avisos e desfazer (Ctrl+Z), janelas, painel do cartão, tema e sessão. |
| `app/src/dados/` | `supabase.ts` (única parte que fala com o banco), `falso.ts` (banco fictício para testes) e `tipos.ts` (o formato dos dados). |
| `app/src/regras/` | Regras de cadastro: formatos, validação, qualificação, consultas de CNPJ e CEP, vínculos e o CSV do Google Contatos (`contatosGoogle.ts`), com os testes. |
| `app/src/marca.ts` e `app/src/imagens/` | Marca do produto (SEMPER): nome, foto, cores, contato e conexão com o banco. O nome, a logomarca e os dados de cada escritório ficam no banco e são editados em Configurações. |
| `app/src/estilo.css` | Estilo comum (veja `DESIGN.md`). |
| `app/public/.htaccess` | Regras da hospedagem para o site publicado. |
| `banco/` | Estrutura do banco no Supabase, em scripts numerados e já aplicados (`001_base.sql`, `002_desempenho.sql`, `003_vinculos.sql`, `004_convite_seguro.sql`, `005_exportacoes.sql`, `006_lgpd_exclusao.sql`, `007_duas_etapas.sql`, `008_identidade_escritorio.sql`), e os modelos de e-mail. |
| `DESIGN.md` | Sistema visual (cores, tipografia, componentes, página de módulo, kanban). |
| `referencia/` | Formulário de cadastro antigo do site, usado como referência. |
| `Trello/` | Exportações do Trello com dados de clientes. Não versionado. |

## Banco de dados

Projeto Supabase `semper` (região São Paulo). Cada escritório é isolado: toda linha tem `escritorio_id` e as regras de acesso (RLS) só mostram o que pertence ao escritório de quem está logado. O cadastro de usuários é só por convite.

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

Conferir os tipos e rodar os testes (o mesmo que a rotina de publicação faz):

```bash
npm run verificar --prefix app
```

Fluxo de trabalho: pull → editar → testar → commit → push (a publicação é automática).
