# SEMPER

Plataforma de gestão para escritórios de advocacia (SaaS multiescritório): contratos, demandas, tarefas, processos, pessoas, compromissos, financeiro e o conteúdo do site. Publicada em https://semper.bragaferreira.adv.br/.

## Como vai ao ar

O sistema fica em `app/` (React + TypeScript + Vite). A cada push no `main` que mexa em `app/`, a rotina do GitHub (`.github/workflows/publicar.yml`) confere os tipos, roda os testes, compila e grava o site pronto no ramo **`publicacao`**. A Hostinger (hPanel → Avançado → GIT, site `semper.bragaferreira.adv.br`) publica esse ramo. Se a checagem ou os testes falharem, nada é publicado e o site continua como estava. Leva de 1 a 2 minutos.

> **Transição:** enquanto a Hostinger não usar o ramo `publicacao`, ela continua publicando a raiz do `main`, onde ainda está a versão antiga em JavaScript simples (guardada também na marca `js-simples`). Depois da troca, essa versão antiga sai da raiz.

| Pasta / arquivo | Conteúdo |
|---|---|
| `app/src/paginas/` | Telas: `Entrada` (login, primeiro acesso, recuperação de senha, cliente), `Inicio`, `Pessoas` e `CartaoPessoa`, `NovaPessoa` (cadastro em etapas) e `Equipe`. |
| `app/src/ui/` | Peças comuns: `Casca` (barra lateral), `PaginaModulo`, `quadro/` (`Kanban` e `useColunas`), avisos e desfazer (Ctrl+Z), janelas, painel do cartão, tema e sessão. |
| `app/src/dados/` | `supabase.ts` (única parte que fala com o banco), `falso.ts` (banco fictício para testes) e `tipos.ts` (o formato dos dados). |
| `app/src/regras/` | Regras de cadastro: formatos, validação, qualificação e consultas de CNPJ e CEP, com os testes. |
| `app/src/marca.ts` e `app/src/imagens/` | Nome, logos, foto, cores e conexão com o banco (marca branca). |
| `app/src/estilo.css` | Estilo comum (veja `DESIGN.md`). |
| `app/public/.htaccess` | Regras da hospedagem para o site publicado. |
| `banco/` | Estrutura do banco no Supabase, em scripts numerados e já aplicados (`001_base.sql`, `002_desempenho.sql`, `003_vinculos.sql`), e os modelos de e-mail. |
| `DESIGN.md` | Sistema visual (cores, tipografia, componentes, página de módulo, kanban). |
| `referencia/` | Formulário de cadastro antigo do site, usado como referência. |
| `Trello/` | Exportações do Trello com dados de clientes. Não versionado. |

## Banco de dados

Projeto Supabase `semper` (região São Paulo). Cada escritório é isolado: toda linha tem `escritorio_id` e as regras de acesso (RLS) só mostram o que pertence ao escritório de quem está logado. O cadastro de usuários é só por convite.

Configuração no painel do Supabase (Authentication):
- **URL Configuration**: Site URL `https://semper.bragaferreira.adv.br/`; Redirect URLs `https://semper.bragaferreira.adv.br/**` e `http://localhost:8090/**`.
- **Emails**: modelos em português em `banco/emails/` (veja o `LEIA-ME.txt` de lá).
- **SMTP** (configurado): Google Workspace, `smtp.gmail.com` porta 465, login na conta `contato@bragaferreira.adv.br` com senha de app; remetente `SEMPER · Braga Ferreira <nao-responda@bragaferreira.adv.br>`, apelido dessa conta autorizado em "Enviar e-mail como" no Gmail. O domínio tem SPF com `_spf.google.com` e DKIM do Google (`google._domainkey`).

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
