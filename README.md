# SEMPER

Plataforma de gestão para escritórios de advocacia (SaaS multiescritório): contratos, demandas, tarefas, processos, pessoas, compromissos, financeiro e o conteúdo do site. Publicada em https://bragaferreira.adv.br/semper/.

O repositório é o próprio site: tudo o que está aqui vai para `public_html/semper` na Hostinger, direto do GitHub. O `.htaccess` impede que arquivos `.md`, `.sql`, `.env`, `.json` e as pastas `banco/`, `dev/` e `referencia/` sejam servidos.

| Pasta / arquivo | Conteúdo |
|---|---|
| `index.html` | Login da equipe, primeiro acesso por convite, recuperação de senha e entrada do cliente (em preparação). |
| `inicio/` | Painel inicial e "Minha conta". |
| `pessoas/` | Cadastro comum de pessoas: tabela, kanban de atendimento (CRM) e cartão com qualificação, histórico e informações sigilosas. |
| `pessoas/nova/` | Formulário de cadastro em etapas (também usado para atualizar), com busca de CNPJ e CEP e controle de duplicidade. |
| `equipe/` | Equipe e acessos (master e administradores): liberar acesso, papéis, desativar e registro de ações (LGPD). |
| `assets/` | `marca.js` (nome, logo, cores e conexão), `dados.js` (única camada que fala com o banco), `comum.js` (casca do app), `pessoa.js` (regras de cadastro e qualificação), `kanban.js` (quadro comum aos módulos) e `estilo.css`. |
| `banco/` | Estrutura do banco no Supabase, em scripts numerados (`001_base.sql`, ...). |
| `dev/` | Servidor local de testes e dados fictícios. |
| `DESIGN.md` | Sistema visual (cores, tipografia, componentes). |
| `referencia/` | Formulário de cadastro antigo do site, usado como referência. |
| `Trello/` | Exportações do Trello com dados de clientes. Não versionado. |

## Banco de dados

Projeto Supabase `semper` (região São Paulo). Cada escritório é isolado: toda linha tem `escritorio_id` e as regras de acesso (RLS) só mostram o que pertence ao escritório de quem está logado. O cadastro de usuários é só por convite.

Configuração no painel do Supabase (Authentication):
- **URL Configuration**: Site URL `https://bragaferreira.adv.br/semper/`; Redirect URLs `https://bragaferreira.adv.br/semper/**` e `http://localhost:8090/**`.
- **Emails**: modelos em português, como os da Educação.
- **SMTP**: o envio padrão do Supabase só entrega para membros da organização; para convidar a equipe, configure um SMTP próprio.

## Testar no computador

```bash
node dev/servidor.js 8090
```
Abre o site com o banco de verdade em http://localhost:8090/.

```bash
node dev/servidor.js 8091 --falso
```
Abre o site com pessoas fictícias e sem login, em http://localhost:8091/inicio/.

Fluxo de trabalho: pull → editar → testar → commit → push.
