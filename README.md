# SEMPER

Plataforma de gestão para escritórios de advocacia (SaaS multiescritório): contratos, demandas, tarefas, processos, pessoas, compromissos, financeiro e o conteúdo do site. Publicada em https://bragaferreira.adv.br/semper/.

| Pasta / arquivo | Conteúdo |
|---|---|
| `Publicar/semper/` | Site como vai para a hospedagem (Hostinger, `public_html/semper`). `assets/marca.js` concentra nome, logo e cores. |
| `DESIGN.md` | Sistema visual (cores, tipografia, componentes). |
| `index.html` | Formulário de cadastro de clientes atual do site, usado como referência. |
| `Trello/` | Exportações do Trello com dados de clientes. Não versionado. |

Banco de dados: projeto Supabase `semper` (região São Paulo). A chave secreta fica em `.env`, que não é versionado.

Fluxo de trabalho: pull → editar → testar → commit → push.
