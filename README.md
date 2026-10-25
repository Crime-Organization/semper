# SEMPER

Plataforma de gestão para escritórios de advocacia (SaaS multiescritório): contratos, demandas, tarefas, processos, pessoas, compromissos, financeiro e o conteúdo do site. Publicada em https://bragaferreira.adv.br/semper/.

O repositório é o próprio site: tudo o que está aqui vai para `public_html/semper` na Hostinger, direto do GitHub. O `.htaccess` impede que arquivos `.md`, `.sql`, `.env` e a pasta `referencia/` sejam servidos.

| Pasta / arquivo | Conteúdo |
|---|---|
| `index.html` | Página de login. |
| `assets/` | Estilo, imagens e `marca.js`, que concentra nome, logo e cores. |
| `DESIGN.md` | Sistema visual (cores, tipografia, componentes). |
| `referencia/` | Formulário de cadastro de clientes atual do site, usado como referência. |
| `Trello/`, `educacao/` | Exportações com dados de clientes e cópia da interface da Educação. Não versionadas. |

Banco de dados: projeto Supabase `semper` (região São Paulo). A chave secreta fica em `.env`, que não é versionado.

Fluxo de trabalho: pull → editar → testar → commit → push.
