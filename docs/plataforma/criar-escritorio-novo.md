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

3. O resultado é um link como `https://semper.app.br/entrar/?primeiro-acesso#convite=…`. Copie o link inteiro.
4. Envie o link **só** para quem vai administrar (ele dá acesso de administrador). Ele vale por **7 dias**.
5. A pessoa abre o link, digita o mesmo e-mail e cria a senha. Ela entra como **master** do escritório novo.

Se aparecer um erro começando com `SEMPER:`, nada foi criado. A mensagem diz o motivo, por exemplo um e-mail que já
tem conta ou um nome de escritório repetido.

### O link venceu ou se perdeu

No mesmo SQL Editor:

```sql
select privado.escritorio_novo_link('email@do.administrador');
```

Sai um link novo, e o anterior deixa de valer.

### O e-mail saiu errado

No mesmo SQL Editor, com o e-mail errado primeiro e o certo depois:

```sql
select privado.escritorio_novo_link('email@errado', 'email@certo');
```

O convite passa para o e-mail certo e sai um link novo; o anterior deixa de valer.

Esses dois comandos só servem para o primeiro administrador, enquanto o escritório ainda não tem ninguém na equipe.
Depois disso, os convites e links ficam com o administrador do escritório, na tela Equipe e acessos.

## O que o escritório novo já traz

- Os quadros de Pessoas, Contratos, Demandas, Tarefas, Processos (judiciais e administrativos) e Agenda, com as colunas
  sugeridas. As colunas especiais também vêm prontas: a do contrato assinado (gera as demandas e, com o Financeiro
  ligado, as parcelas), as de início
  e de concluído de Demandas e Tarefas e as do cliente ao contrato. Depois, o administrador renomeia, cria e arruma as
  outras colunas pela tela.
- Os módulos ligados: Pessoas, Contratos, Demandas, Tarefas, Processos e Agenda.
- O **Financeiro desligado**. As regras de divisão do dinheiro ainda são as de um escritório só. Ligar o Financeiro para
  outro escritório só depois que essas regras puderem ser escolhidas por escritório.
- Nenhum dado de outro escritório: cada escritório só vê o que é dele.

## Depois, pelo administrador do escritório novo

1. **Configurações:** nome, logomarca, CNPJ, endereço e os demais dados do escritório.
2. **Equipe e acessos:** convidar a equipe (cada pessoa recebe o próprio link).
3. Cadastrar os órgãos e os feriados locais, se usar prazos em dias úteis.

## Pontos de atenção

- **Fuso horário:** prazos e lembretes seguem o horário de Brasília. Num estado com outro fuso, os avisos chegam com uma
  ou duas horas de diferença.
- **E-mails:** os avisos de prazo de todos os escritórios saem pela mesma caixa, até 720 pessoas por manhã, somando os
  escritórios. Veja "E-mails de prazo" no `README.md`.
- **Google:** para o escritório novo ligar a conta Google (Contatos, Agenda), o aplicativo do Google precisa estar
  publicado, ou o e-mail dele precisa entrar na lista de usuários de teste.
- **Página inicial:** o texto público ainda conta que o SEMPER nasceu na Braga Ferreira.
