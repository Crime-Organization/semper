# Contatos no Google

Como as pessoas do SEMPER vão para o Google Contatos da conta do escritório (tarefa #164), o que configurar na
produção e como testar com a conta de verdade.

## Como funciona

1. **Ligar a conta.** Em Configurações, cartão **Conta Google**, o administrador clica em **Conectar conta Google** e
   entra com a conta do escritório, deixando a permissão de contatos marcada. A autorização fica guardada no cofre do
   banco (Vault); o navegador nunca a vê.
2. **Ligar a sincronização.** No mesmo cartão, em **Contatos no Google**, o administrador marca *Criar e atualizar no
   Google os contatos das pessoas cadastradas e editadas*. Ela começa desligada.
3. **Primeira sincronização.** Antes de criar qualquer contato, o servidor (função `google-sincronizar`) lê **todos** os
   contatos que já estão na conta Google (`people.connections.list`, de 1.000 em 1.000) e compara com as pessoas do
   escritório. As regras ficam em `supabase/functions/_compartilhado/correspondenciaDeContatos.ts`, com os testes em
   `app/src/regras/correspondenciaDeContatos.test.ts`:
   - telefone e nome juntos, ou e-mail e nome juntos: o contato é **ligado** à pessoa (nada muda no Google);
   - o contato que o próprio SEMPER criou antes (com a marca `semper_pessoa`) é ligado à pessoa da marca;
   - nome completo e o mesmo aniversário: ligado;
   - o telefone de uma pessoa com outro nome, ou nome e telefone com aniversário diferente: **para conferir**
     ("Dados diferentes");
   - só o nome completo igual: **para conferir** ("Só o nome"); com aniversário diferente, são pessoas diferentes
     (homônimos) e nada acontece;
   - mais de uma pessoa possível: **para conferir** ("Várias pessoas");
   - dois contatos do Google para a mesma pessoa: o primeiro é ligado e o outro vai **para conferir** ("Repetido");
   - e-mail sozinho **nunca** liga nem sugere ninguém (a contabilidade põe o mesmo e-mail em várias empresas).

   Telefones são comparados sem o +55, sem o 0 do DDD e com o 9 dos celulares antigos; e-mails, em minúsculas; nomes,
   sem acento, em maiúsculas e sem "da", "de", "do", "das", "dos", "e". Nome "contido" no outro (todas as palavras do
   menor estão no maior) vale junto com telefone ou e-mail.
4. **Depois da primeira.** Quem ficou sem contato vai para a fila, e a fila cria um contato novo para cada um. Quem
   está numa dúvida aberta **espera** a decisão do administrador (senão o SEMPER criaria uma cópia de um contato que
   talvez seja dele). Enquanto a primeira sincronização não termina, nada é criado no Google.
5. **Para conferir.** Em Configurações, abaixo de Contatos no Google, aparece a lista **Para conferir** com o número de
   contatos. Para cada um, o administrador:
   - **Ligar** a uma das pessoas possíveis (ou **Procurar outra pessoa** do escritório): o contato fica ligado a ela;
     as outras pessoas possíveis, se não têm contato, ganham um contato novo;
   - **É outra pessoa**: as pessoas possíveis sem contato ganham um contato novo; o contato do Google fica como está;
   - **Ignorar**: nada acontece agora; a pessoa vai ao Google quando for editada no SEMPER.

   A decisão fica guardada (com quem decidiu e quando, e no registro de ações) e o contato não volta para a lista.
6. **Dia a dia.** Cadastrar, editar o que vai ao Google (nome, telefones, e-mails, nascimento ou abertura) ou desarquivar
   uma pessoa a põe na fila. A rotina do banco chama a função a cada 2 minutos, só quando há algo a fazer, e cada
   chamada leva até 25 pessoas (umas 750 por hora). O **Sincronizar agora** faz o mesmo na hora, só para o escritório.
7. **A primeira é refeita** quando a sincronização é desligada e ligada de novo, ou quando outra conta Google é ligada.
   Os contatos já ligados continuam ligados, e as dúvidas já decididas não voltam.
8. **Falhas.** Se o Google falha, a tentativa se repete sozinha, com esperas de 1 minuto a 1 dia. A partir da 3ª falha,
   Configurações mostra o problema e o que fazer. Autorização vencida ou retirada para tudo até a conta ser ligada de novo.

O que **não** acontece: o SEMPER nunca apaga contatos no Google (nem ao arquivar ou excluir uma pessoa) e não muda um
contato só por ligá-lo a uma pessoa; ele passa a ser atualizado quando a pessoa for editada no SEMPER.

## O que configurar na produção

Tudo isto é feito por uma pessoa (o agente nunca mexe na produção), **nesta ordem**, antes de publicar o site:

1. **Banco.** Aplicar as duas migrações pelo roteiro `/aplicar-banco` do Claude Code:
   `20261120205439_contatos_google.sql` (a fila e a rotina) e `20261120213407_contatos_google_primeira.sql` (a
   primeira sincronização e a lista Para conferir). As duas só acrescentam: a versão anterior do site continua
   funcionando.
2. **Funções do servidor.** Publicar as duas funções novas, com o login conferido dentro delas (`verify_jwt = false`,
   como as outras do Google; já está em `supabase/config.toml`):

   No terminal, na pasta do SEMPER, com o projeto ligado (`supabase link --project-ref uzafzwqjpxxiovfunxfm`):

   ```bash
   supabase functions deploy google-sincronizar
   supabase functions deploy google-desligar
   ```

   O `deploy` leva junto os arquivos de `supabase/functions/_compartilhado/` que elas usam (inclusive
   `correspondenciaDeContatos.ts`). Se publicar pelo painel ou por outra ferramenta, mande o `index.ts` de cada uma e
   os arquivos de `_compartilhado` que ele importa, e deixe **Verify JWT desligado**.
3. **Segredos.** Nenhum novo. As funções usam os que já existem em Edge Functions > Secrets: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `SITES_PERMITIDOS` e `SENHA_DA_ROTINA`; e, no Vault, `semper_url_do_projeto` e
   `semper_senha_da_rotina` (os mesmos dos e-mails de prazo e do reenvio de avisos).
4. **Agendamento.** A migração cria a rotina `sincronizar-contatos-google` no `pg_cron` (a cada 2 minutos). Para
   conferir, no SQL Editor do Supabase (https://supabase.com/dashboard/project/uzafzwqjpxxiovfunxfm/sql/new):

   ```sql
   select jobname, schedule, active from cron.job where jobname = 'sincronizar-contatos-google';
   ```

   As respostas das chamadas ficam em `net._http_response` (200 é sucesso).
5. **Publicar o site** pela rotina "Publicar o SEMPER".
6. **Antes de ligar a sincronização** no escritório: tirar o envio provisório à planilha antiga (#219), que também cria
   contatos no Google. Com os dois ligados, cada pessoa nova viraria dois contatos.

## Como testar com a conta de verdade

Faça num horário calmo, com um administrador e a conta Google do escritório.

1. Em Configurações > Conta Google, confira que a conta está ligada. Se ligada antes desta versão, clique em
   **Ligar outra conta** e entre de novo com a mesma conta, deixando os contatos marcados.
2. Marque *Criar e atualizar no Google os contatos…*. Deve aparecer "A primeira sincronização ainda não terminou".
3. Clique em **Sincronizar agora**. O aviso diz quantos contatos foram ligados e quantos ficaram para conferir, e
   quantas pessoas foram ao Google. (Sem o clique, a rotina faz isso sozinha em até 2 minutos.)
4. Abra o Google Contatos (https://contacts.google.com) com a conta do escritório e confira:
   - os contatos que já existiam **não** foram duplicados;
   - as pessoas que não tinham contato ganharam um, com o nome em maiúsculas.
5. Confira a lista **Para conferir**: decida um contato de cada jeito (Ligar, É outra pessoa, Ignorar) e veja que ele
   sai da lista.
6. Cadastre uma pessoa de teste com um telefone, clique em **Sincronizar agora** e veja o contato no Google. Edite o
   telefone, sincronize de novo e veja o contato **atualizado** (não um segundo). Depois arquive e exclua a pessoa de
   teste no SEMPER e apague o contato à mão no Google.
7. Se algo der errado, desmarque a sincronização: a fila para na hora e nada mais vai ao Google.
