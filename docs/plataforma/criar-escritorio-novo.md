# Criar um escritório novo

Roteiro para entregar o SEMPER a outra empresa (tarefa #295). Quem faz é o dono do SEMPER, no banco de produção.

## Antes

- A migração `20261113081038_escritorio_novo.sql` precisa estar aplicada na produção (roteiro `/aplicar-banco`).
- Tenha em mãos três dados: o **nome do escritório**, o **nome** de quem vai administrá-lo e o **e-mail** dessa pessoa.
- Esse e-mail não pode ter conta no SEMPER, em nenhum escritório. Cada e-mail entra em um escritório só.
- Combine fora do sistema o contrato de uso, com cláusula de proteção de dados (LGPD): o escritório é o controlador
  dos dados dos clientes dele, e o SEMPER é o operador.

## Passo a passo

1. Abra o **SQL Editor** do Supabase: https://supabase.com/dashboard/project/uzafzwqjpxxiovfunxfm/sql/new
2. Cole o comando abaixo, trocando os três textos entre aspas, e clique em **Run**:

   ```sql
   select privado.criar_escritorio('Nome do Escritório', 'Nome de Quem Administra', 'email@do.administrador');
   ```

3. O resultado é um link como `https://semper.app.br/entrar/?primeiro-acesso#convite=…`. Copie o link inteiro, com
   tudo o que vem depois do `#` (no SQL Editor, clique na célula do resultado e copie dali).
4. Envie o link **só** para quem vai administrar (ele dá acesso de administrador). Ele vale por **7 dias**. O link já
   abre a tela **Primeiro acesso**: abrir o site direto não funciona, porque o convite está no próprio link.
5. A pessoa abre o link, digita **o mesmo e-mail** do comando, cria a senha (pelo menos 8 caracteres, duas vezes) e
   clica em **Criar meu acesso**.
6. Aparece "Acesso criado. Enviamos um e-mail de confirmação…". Ela abre esse e-mail (olhe também o spam) e clica no
   link: entra direto no SEMPER, como **master** do escritório novo, com o nome do escritório no alto do menu.
   Nas próximas vezes, entra em https://semper.app.br/entrar/ com o e-mail e a senha.

Se aparecer um erro começando com `SEMPER:`, nada foi criado. A mensagem diz o motivo:

| Mensagem | O que fazer |
|---|---|
| `este e-mail já tem conta no SEMPER` | Cada e-mail entra em um escritório só: peça outro e-mail para o administrador. |
| `este e-mail já tem um convite pendente` | Já há um convite para ele. Se for o deste escritório, gere um link novo (abaixo). |
| `já existe um escritório com o nome "…"` | Use outro nome (acentos e maiúsculas não contam como diferença). |
| `falta o nome…`, `precisa ter pelo menos duas letras`, `e-mail inválido` | Corrija o texto entre aspas e rode de novo. |

### O que a pessoa pode ver na tela do primeiro acesso

| Aviso | Por quê | O que fazer |
|---|---|---|
| "Convite não encontrado ou vencido…" | O link venceu (7 dias), não é o mais recente, ou o e-mail digitado não é o do convite. | Confira o e-mail. Se continuar, gere um link novo (abaixo). |
| "Este e-mail já tem conta. Use "Entrar" ou recupere a senha." | O link já foi usado: a conta existe. | Entrar em https://semper.app.br/entrar/ ou usar "Esqueci minha senha". |

### O link venceu ou se perdeu

No mesmo SQL Editor:

```sql
select privado.escritorio_novo_link('email@do.administrador');
```

Sai um link novo, e o anterior deixa de valer. Peça para abrir o link novo **numa aba nova**: colado na mesma aba do
link recusado, o site publicado ainda segue com o código antigo e responde "Convite não encontrado ou vencido". A
correção está numa tarefa à parte (ramo `convite-mesma-aba`), ainda não publicada.
<!-- PROVISORIO-convite-mesma-aba: tirar a frase da aba nova (aqui e no "Ensaio feito") quando a correção do link na mesma aba for publicada. -->

### O e-mail saiu errado

No mesmo SQL Editor, com o e-mail errado primeiro e o certo depois:

```sql
select privado.escritorio_novo_link('email@errado', 'email@certo');
```

O convite passa para o e-mail certo e sai um link novo; o anterior deixa de valer.

Esses dois comandos só servem para o primeiro administrador, enquanto o escritório ainda não tem ninguém na equipe.
Depois disso, eles respondem `não há convite pendente do primeiro administrador…`: os convites e links ficam com o
administrador do escritório, na tela Equipe e acessos.

## O que o escritório novo já traz

- Os quadros de Pessoas, Contratos, Demandas, Tarefas, Processos (judiciais e administrativos) e Agenda, com as colunas
  sugeridas. As colunas especiais também vêm prontas: a do contrato assinado (gera as demandas e, com o Financeiro
  ligado, as parcelas), as de início
  e de concluído de Demandas e Tarefas e as do cliente ao contrato. Depois, o administrador renomeia, cria e arruma as
  outras colunas pela tela.
- Os módulos ligados: Pessoas, Contratos, Demandas, Tarefas, Documentos (anotações), Processos e Agenda.
- O cadastro de quem administra já aparece em Pessoas, como "Somente contato" e sem etapa no quadro.
- O **Financeiro desligado**. As regras de divisão do dinheiro ainda são as de um escritório só. Ligar o Financeiro para
  outro escritório só depois que essas regras puderem ser escolhidas por escritório.
- Nenhum dado de outro escritório: cada escritório só vê o que é dele.

## Depois, pelo administrador do escritório novo

1. **Configurações:** nome, logomarca, CNPJ, endereço e os demais dados do escritório.
   Em **Pessoas**, completar o próprio cadastro (CPF, telefone), que nasce só com o nome e o e-mail.
2. **Equipe e acessos:** convidar a equipe (cada pessoa recebe o próprio link).
3. Cadastrar os órgãos e os feriados locais, se usar prazos em dias úteis.

## Ensaio feito (20/11/2026)

O roteiro inteiro foi ensaiado num banco local, pela tela de verdade, com dados inventados e com a confirmação por
e-mail ligada, como na produção: criar o escritório, abrir o link, criar a senha, confirmar o e-mail e conferir os
quadros (Pessoas, Contratos com a coluna do assinado, Processos judiciais e administrativos, Agenda, Demandas e Tarefas
com as colunas de início e de concluído), o Financeiro fora do menu (o endereço /financeiro/ volta ao Início), nenhuma
pessoa ou tarefa do outro escritório na busca, e uma tarefa nova com o botão **Concluir**, que a leva à coluna
"Concluída". Também: e-mail que já tem conta, link substituído, link vencido, link já usado e e-mail corrigido. O único
defeito achado foi o do link novo na mesma aba: corrigido no código, numa tarefa à parte, e ainda não publicado. Até
lá, abra o link novo numa aba nova (veja acima).

## Pontos de atenção

- **Fuso horário:** prazos e lembretes seguem o horário de Brasília. Num estado com outro fuso, os avisos chegam com uma
  ou duas horas de diferença.
- **E-mails:** os avisos de prazo de todos os escritórios saem pela mesma caixa, até 720 pessoas por manhã, somando os
  escritórios. Veja "E-mails de prazo" no `README.md`.
- **Google:** para o escritório novo ligar a conta Google (Contatos, Agenda), o aplicativo do Google precisa estar
  publicado, ou o e-mail dele precisa entrar na lista de usuários de teste.
- **Página inicial:** o texto público ainda conta que o SEMPER nasceu na Braga Ferreira.
