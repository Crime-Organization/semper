# Agendas no Google

Como o SEMPER cria e mantém as agendas do escritório no Google Agenda (tarefa #166), o que configurar na produção e como
testar com a conta de verdade. Esta é a **parte 1**: as agendas e os compartilhamentos. Os eventos (compromissos, prazos
de tarefas e demandas, feriados, parcelas e despesas) são a parte 2; a fila e o adaptador já estão prontos para eles.

A estrutura é a mesma dos contatos (veja [contatos-google.md](contatos-google.md)): a ligação em `privado.ligacoes`, com o
token no cofre (Vault), uma fila no banco processada pela rotina do `pg_cron` e por uma função do servidor, novas
tentativas com espera e o aviso ao administrador a partir da 3ª falha.

## Como funciona

1. **A conta do escritório é a dona.** A conta Google ligada em Configurações (a mesma dos contatos) é dona de todas as
   agendas. Ninguém da equipe precisa da senha dela.
2. **Autorizar a agenda.** A permissão da agenda é pedida à parte, depois dos contatos (autorização aos poucos, com
   `include_granted_scopes`): em Configurações, cartão **Conta Google**, em **Agendas no Google**, o administrador clica
   em **Autorizar a agenda**. O Google abre já na conta do escritório e pede só a agenda; o token novo cobre os contatos e
   a agenda juntos (os contatos não se desligam). As permissões pedidas são as mais estreitas que bastam:
   - `https://www.googleapis.com/auth/calendar.app.created`: criar as agendas do SEMPER e escrever nelas (não dá acesso às
     outras agendas da conta);
   - `https://www.googleapis.com/auth/calendar.acls`: compartilhar e retirar o compartilhamento (sem ela o Google recusa).

   Se a pessoa desmarcar a agenda na tela do Google, nada muda e o aviso pede para tentar de novo. Se entrar no Google com
   **outra** conta, a conta do escritório não muda e a autorização da outra conta é revogada.
3. **Ligar as agendas.** Depois de autorizar, aparece *Criar e manter no Google as agendas do escritório*. Começa
   desligada em cada escritório; só administradores ligam. Desligar esvazia a fila e **não apaga nada no Google**.
4. **As agendas.** Na conta do escritório, como agendas secundárias, no fuso de Brasília:
   - **Agenda – Nome** para cada pessoa ativa da equipe (advogado, administrativo, estagiário: todos);
   - **Geral**;
   - uma por **sala** ativa (com o nome da sala);
   - **Administrativo**.
5. **Os compartilhamentos.** Sempre por e-mail, só para ver (papel `reader`), nunca por link público. O Google manda o
   convite por e-mail. Cada pessoa recebe a própria agenda, a Geral e as das salas; os administradores, também a
   Administrativo. A conta do escritório vê todas (é a dona).
6. **O e-mail do Google.** É o e-mail que recebe os compartilhamentos. Por padrão, o de entrada no SEMPER; a própria
   pessoa troca em **Minha conta**, e o administrador em **Equipe e acessos**, na janela da pessoa (com a regra do nome:
   o de um administrador, só o master; o de um master, só ele). Apagar o campo volta ao de entrada.
7. **Dia a dia.** Quando alguém entra na equipe, sai (desativado ou excluído), muda de nome ou de papel, quando uma sala
   é criada, renomeada, desativada ou reativada, ou quando um e-mail do Google (ou o de entrada) muda, um gatilho do
   banco põe o escritório na fila (`agendas_google_fila`, assunto `agendas`). A rotina do banco chama a função
   `google-agendas` a cada 2 minutos, só quando há algo na fila; o **Sincronizar agora** faz o mesmo na hora, só para o
   escritório. A função lê o estado (`agendas_google_estado`), monta o plano e o executa, uma ação de cada vez:
   1. **retirar** o compartilhamento de quem não deve mais ver (desativado, deixou de ser administrador, trocou de
      e-mail, sala desativada) — primeiro, para o acesso sair antes de tudo;
   2. **criar** as agendas que faltam;
   3. **renomear** as que mudaram de nome (no SEMPER, ou à mão no Google: o nome do SEMPER volta);
   4. **compartilhar** com quem ainda não recebeu.

   Cada execução faz no máximo 40 ações (`ACOES_POR_EXECUCAO`); o resto fica para a próxima, sem contar como falha.
8. **Quem sai e quem volta.** Pessoa desativada perde os compartilhamentos; a agenda dela fica com o escritório.
   Reativar devolve. Sala desativada: o mesmo.
9. **Falhas.** Se o Google falha, o pedido fica na fila e a tentativa se repete sozinha, com esperas de 1 minuto a
   1 dia. O que já foi feito antes da falha fica guardado. A partir da 3ª falha, Configurações mostra o problema e o que
   fazer. Autorização vencida ou retirada para a fila do escritório até a agenda ser autorizada de novo (o botão
   **Autorizar a agenda** volta a aparecer) ou o administrador pedir **Sincronizar agora**. Agenda apagada no Google
   (só a conta do escritório consegue apagar) é esquecida e criada de novo.

O que **não** acontece (ainda): eventos nas agendas (parte 2); conferir no Google se alguém mexeu à mão nos
compartilhamentos (o SEMPER guarda o que ele mesmo fez; um compartilhamento retirado ou acrescentado à mão no Google não é
desfeito); apagar agendas no Google.

### Onde está cada parte

| O quê | Onde |
|---|---|
| Plano puro (o que criar, compartilhar, renomear, retirar) e a execução | `supabase/functions/_compartilhado/agendasGoogle.ts` |
| Adaptador fino da API do Google Agenda (agendas, compartilhamentos e, para a parte 2, eventos) | `supabase/functions/_compartilhado/apiDaAgenda.ts` |
| As permissões e a finalidade do pedido de ligação | `supabase/functions/_compartilhado/ligacao.ts` |
| A função do servidor | `supabase/functions/google-agendas/index.ts` (e `google-conectar`, `google-concluir`, alteradas) |
| Banco: tabelas, fila, gatilhos, rotina | `supabase/migrations/20261125102621_agendas_google.sql` |
| Testes | `app/src/regras/agendasGoogle.test.ts`, `ligacaoGoogle.test.ts`, `emailDoGoogle.test.ts`, `sincronizacaoDasAgendas.test.ts`, `supabase/tests/agendas_google.test.sql`, `app/e2e/agendas-google.spec.ts` |
| Tela | `app/src/paginas/AgendasNoGoogle.tsx` (Configurações) e `EmailDoGoogle.tsx` (Equipe e Minha conta) |

## O que configurar na produção

Tudo isto é feito por uma pessoa (o agente nunca mexe na produção), **nesta ordem**, antes de publicar o site:

1. **Google Cloud: ativar a API.** No projeto do Google Cloud do SEMPER (o mesmo do `GOOGLE_CLIENT_ID`), em
   https://console.cloud.google.com/apis/library, procure **Google Calendar API** e clique em **Ativar**.
2. **Google Cloud: as permissões na tela de consentimento.** Em https://console.cloud.google.com/auth/scopes (Google Auth
   Platform > Data Access), clique em **Add or Remove Scopes**, acrescente
   `https://www.googleapis.com/auth/calendar.app.created` e `https://www.googleapis.com/auth/calendar.acls` e salve. Se o
   app for **Internal** (só contas do Workspace do escritório), não há revisão do Google; se for **External**, pode ser
   preciso verificar o app antes de outros escritórios usarem.
3. **Workspace: compartilhar com contas de fora.** Quem tem Gmail pessoal só vê os detalhes dos eventos se o
   administrador do Workspace permitir. No console do administrador (https://admin.google.com), em **Apps > Google
   Workspace > Agenda > Geral**, na opção de compartilhamento externo das **agendas secundárias** (não muda por unidade
   organizacional), escolha "Share all information, but outsiders cannot change calendars" (compartilhar tudo, sem
   deixar quem é de fora mudar). Com "Só livre/ocupado", o Gmail
   de fora vê só ocupado. Baixar esse nível depois tira o acesso de quem já tinha.
4. **Banco.** Aplicar a migração `20261125102621_agendas_google.sql` pelo roteiro `/aplicar-banco` do Claude Code. Ela só
   acrescenta: a versão anterior do site continua funcionando (as funções antigas da ligação ficam como eram).
5. **Funções do servidor.** Publicar a função nova e as duas alteradas, com o login conferido dentro delas
   (`verify_jwt = false`, já em `supabase/config.toml`):

   No terminal, na pasta do SEMPER, com o projeto ligado (`supabase link --project-ref uzafzwqjpxxiovfunxfm`):

   ```bash
   supabase functions deploy google-agendas
   supabase functions deploy google-conectar
   supabase functions deploy google-concluir
   ```

   O `deploy` leva junto os arquivos de `supabase/functions/_compartilhado/` que elas usam (`agendasGoogle.ts`,
   `apiDaAgenda.ts`, `ligacao.ts`, `contatosGoogle.ts`...). Se publicar pelo painel, mande o `index.ts` de cada uma e
   os arquivos de `_compartilhado` que ele importa, e deixe **Verify JWT desligado**. Publique as funções **depois** da
   migração: as novas chamam funções do banco que só existem com ela.
6. **Segredos.** Nenhum novo: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SITES_PERMITIDOS` e `SENHA_DA_ROTINA` nas
   Edge Functions, e `semper_url_do_projeto` e `semper_senha_da_rotina` no Vault (os mesmos dos contatos).
7. **Agendamento.** A migração cria a rotina `sincronizar-agendas-google` (a cada 2 minutos). Para conferir, no SQL Editor
   do Supabase (https://supabase.com/dashboard/project/uzafzwqjpxxiovfunxfm/sql/new):

   ```sql
   select jobname, schedule, active from cron.job where jobname = 'sincronizar-agendas-google';
   ```

   As respostas das chamadas ficam em `net._http_response` (200 é sucesso).
8. **Publicar o site** pela rotina "Publicar o SEMPER".

## Como testar com a conta de verdade

Faça num horário calmo, com um administrador e a conta Google do escritório. Antes, avise a equipe: cada pessoa vai
receber e-mails de compartilhamento do Google.

1. Em Configurações > Conta Google, confira que a conta está ligada. Em **Agendas no Google** deve aparecer "Falta
   autorizar a agenda".
2. Clique em **Autorizar a agenda**. O Google abre na conta do escritório e pede só a agenda; deixe marcada e aceite. De
   volta, o aviso diz "Agenda autorizada". Confira em **Contatos no Google** que a sincronização dos contatos continua
   como estava.
3. Marque *Criar e manter no Google as agendas do escritório* e clique em **Sincronizar agora**. O aviso diz quantas
   agendas foram criadas e quantos compartilhamentos feitos (sem o clique, a rotina faz isso em até 2 minutos; com mais
   de 40 ações, o resto vai nas próximas).
4. Abra o Google Agenda (https://calendar.google.com) com a conta do escritório e confira, em **Minhas agendas**: uma
   "Agenda – Nome" por pessoa ativa, a Geral, uma por sala ativa e a Administrativo. Em **Configurações e
   compartilhamento** de cada uma, confira com quem está compartilhada (só ver).
5. Com a conta de uma pessoa da equipe (o e-mail do Google dela), abra o e-mail do Google e aceite o compartilhamento:
   ela deve ver a própria agenda, a Geral e as das salas; um administrador, também a Administrativo.
6. Troque o e-mail do Google de alguém em Equipe e acessos, sincronize e confira que o compartilhamento passou do e-mail
   antigo para o novo.
7. Desative uma pessoa de teste, sincronize e confira que os compartilhamentos com ela saíram (a agenda dela continua).
   Reative e confira que voltaram.
8. Se algo der errado, desmarque *Criar e manter no Google…*: a fila para na hora e nada mais muda no Google.
