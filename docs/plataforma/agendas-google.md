# Agendas no Google

Como o SEMPER cria e mantém as agendas do escritório no Google Agenda (tarefa #166), o que configurar na produção e como
testar com a conta de verdade. A **parte 1** são as agendas e os compartilhamentos; a **parte 2**, os eventos
(compromissos, prazos de tarefas e demandas, dias sem expediente e parcelas a receber; veja [Os eventos](#os-eventos)).
As despesas a pagar (#439) entram depois, na Administrativo.

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
   **Os compartilhamentos já feitos também ficam**: desligar as agendas, desligar a conta Google ou ligar outra conta
   não os retira (com a conta desligada ou trocada, o SEMPER não tem mais como; com as agendas desligadas, ele não
   mexe). Quem os recebeu continua vendo as agendas antigas e os eventos delas, inclusive quem for desativado nesse
   meio-tempo. Para tirar, entre no Google Agenda com a conta do escritório e, em **Configurações e compartilhamento**
   de cada agenda, retire o compartilhamento (ou apague a agenda). Configurações diz isso, logo abaixo das agendas,
   enquanto há compartilhamentos.
4. **As agendas.** Na conta do escritório, como agendas secundárias, no fuso de Brasília:
   - **Agenda – Nome** para cada pessoa ativa da equipe (advogado, administrativo, estagiário: todos);
   - **Geral**;
   - uma por **sala** ativa (com o nome da sala);
   - **Administrativo**.
5. **Os compartilhamentos.** Sempre por e-mail, só para ver (papel `reader`), nunca por link público. O Google manda o
   convite por e-mail. Cada pessoa recebe a própria agenda, a Geral e as das salas; os administradores, também a
   Administrativo. A conta do escritório vê todas (é a dona).
6. **O e-mail do Google.** É o e-mail que recebe os compartilhamentos. Por padrão, o de entrada no SEMPER; só os
   administradores trocam (decisão do dono: "pode ser trocado em Equipe"), em **Equipe e acessos**, na janela da pessoa,
   com a regra do nome (o de um administrador, só o master; o de um master, só ele), e o próprio também em **Minha
   conta**. Quem não é administrador vê o dele em Minha conta, só para ler: assim ninguém manda sozinho as agendas do
   escritório (com nomes de clientes) para um e-mail de fora. Apagar o campo volta ao de entrada.
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
   **Autorizar a agenda** volta a aparecer) ou o administrador pedir **Sincronizar agora**. Só contam como autorização o
   401 e o 403 com o motivo `insufficientPermissions` ou `authError`; o 403 de cota (`rateLimitExceeded`,
   `userRateLimitExceeded`, `quotaExceeded`, `dailyLimitExceeded`) é temporário, e o resto do 403 é recusa daquele pedido.
10. **Compartilhamento recusado.** Se o Google recusa compartilhar uma agenda com um e-mail (o Workspace que não deixa
   compartilhar com contas de fora, por exemplo), a recusa fica guardada (`agenda_google_recusas`), aquele e-mail fica de
   fora só naquela agenda e o resto do plano segue: os outros da equipe recebem as agendas normalmente. Configurações
   mostra ao administrador cada e-mail recusado, a agenda e o que o Google respondeu. O **Sincronizar agora** (e ligar as
   agendas de novo) apaga as recusas e tenta cada uma outra vez.
11. **Agenda apagada no Google** (só a conta do escritório consegue apagar). O 404 do Google não diz o que sumiu (o
   evento, a regra ou a agenda), e logo depois de criar uma agenda o Google ainda pode responder 404 enquanto a espalha.
   Por isso o SEMPER só esquece uma agenda (com os compartilhamentos e as cópias guardadas) e a cria de novo quando:
   ela foi criada há mais de 10 minutos (`AGENDA_NOVA_MS`) **e**, conferida no Google (`calendars.get`), também responde
   404. Antes disso, ou se a conferência não responder com clareza, a falha é temporária e a tentativa se repete. Um 404
   do evento com a agenda existindo é falha do evento (temporária), e um 404 do compartilhamento com a agenda existindo é
   recusa daquele e-mail.
12. **Agendas sobrando.** Criar uma agenda no Google (`calendars.insert`) não tem como ser repetido sem criar outra. Se
   o Google cria e o banco não guarda, o SEMPER apaga a recém-criada no Google (`calendars.delete`, que a permissão
   `calendar.app.created` cobre) antes de tentar de novo; se nem isso der, a falha guardada na fila diz o id da agenda
   que ficou lá. O caso que sobra: o Google cria, mas a resposta se perde no caminho (tempo esgotado). Aí o SEMPER não
   sabe o id e a próxima tentativa cria outra com o mesmo nome. Procurar a perdida antes de criar exigiria ler a lista
   de agendas da conta (`calendarList`), que pede uma permissão mais larga (`calendar.calendarlist.readonly`, que vê
   todas as agendas da conta), e por isso não é feito. **Como limpar à mão:** no Google Agenda da conta do escritório,
   em **Minhas agendas**, uma agenda repetida (mesmo nome, com a descrição "Agenda criada e mantida pelo SEMPER…" e sem ninguém
   no compartilhamento) é a que sobrou: em **Configurações e compartilhamento** dela, **Remover agenda**. A que o
   SEMPER guarda é a compartilhada com a equipe.

O que **não** acontece (ainda): conferir no Google se alguém mexeu à mão nos compartilhamentos (o SEMPER guarda o que ele
mesmo fez; um compartilhamento retirado ou acrescentado à mão no Google não é desfeito); apagar agendas no Google (só a recém-criada
que o banco não guardou, veja o item 12).

## Os eventos

Só no sentido SEMPER → Google. Combinado com o dono em 25/11/2026:

| Item do SEMPER | Em quais agendas | Quando | Sai do Google quando |
|---|---|---|---|
| Compromisso | do responsável e de cada participante; também na Geral, se "Agenda geral" está marcada; na da sala, se tem sala | a data e a hora (sem hora de fim: 1 hora, como a sala conta); sem hora, o dia inteiro | é arquivado, vai para a coluna "Cancelado" ou é excluído |
| Tarefa com prazo | do responsável e de cada participante | a data de entrega, com a hora do prazo (o evento tem 30 minutos); sem hora, o dia inteiro. O início não estica o evento | é concluída, arquivada, excluída ou perde o prazo |
| Demanda com prazo | do responsável e de cada colaborador | como a tarefa | é concluída, arquivada, excluída ou perde o prazo |
| Dia sem expediente ou suspensão (Calendário, "Feriados e prazos" do escritório) | Geral | o dia inteiro | é apagado |
| Parcela a receber | do advogado responsável pelo contrato (não a Administrativo) | o dia inteiro do vencimento | é recebida ou excluída |

- **Cada data de um compromisso que se repete é um compromisso**: vai como um evento próprio (não como evento repetido do
  Google).
- **Concluída, recebida, arquivada: sai.** Foi o mais simples (o dono deixou escolher): o evento é apagado das agendas,
  em vez de ficar marcado. Se o item voltar (reaberto, estorno do recebimento), o evento entra de novo.
- **Quem sai do item** (um participante tirado, o responsável trocado) perde a cópia na agenda dele; quem entra ganha.
- **O evento** leva o título, o horário, o local (ou a sala), os nomes dos clientes, o número do processo e, na descrição,
  o link direto para o item no SEMPER (o mesmo endereço dos e-mails de prazo, `SITE` em `_compartilhado/emailsDePrazo.ts`):
  o compromisso, a tarefa e a demanda abrem no cartão; a parcela, no cartão do contrato; o dia, no Calendário. A parcela
  mostra o número, o contrato e o valor; o dia, o tipo e o órgão.
- **Id estável.** O id de cada evento é escolhido pelo SEMPER (uma letra do assunto e o id do item, só com o que o Google
  aceita: `a`–`v` e `0`–`9`) e é o mesmo em todas as agendas. Uma nova tentativa nunca duplica: se o Google diz que o id
  já existe (a tentativa anterior chegou lá, ou o evento foi apagado antes e o Google o guarda como cancelado), o SEMPER
  muda o evento no lugar, com `status: confirmed`.
- **A marca de origem** fica em `extendedProperties.private` (`semper_item`: "assunto:id do item"; `semper_escritorio`).
- **Fuso** `America/Sao_Paulo` nos eventos com hora; os do dia inteiro têm o fim no dia seguinte (o Google conta o fim
  como exclusivo).
- **Só o que muda vai.** Gatilhos do banco põem o item na fila (`agendas_google_fila`, com o assunto e o item) só quando
  muda um campo que vai ao Google (título, datas, horas, local, equipe, clientes, sala, coluna, arquivo, recebimento…),
  não a cada mudança qualquer (observações, início da tarefa…). Também entram: o contrato que muda de responsável, de
  código ou de clientes (as parcelas dele), a sala renomeada (os compromissos nela), o número do processo mudado (as
  tarefas dele), a sigla do órgão (os dias dele) e a coluna do quadro renomeada (para "Cancelado", por exemplo) ou com o
  marco mudado (para "concluído"): os compromissos, tarefas e demandas dela que ainda vão ou já foram ao Google. O item
  que muda várias vezes antes de a fila rodar é um pedido só e vai com o estado final. O item excluído entra na fila se
  tem cópia no Google **ou** se já tem um pedido na fila (a função pode estar gravando a primeira cópia naquela hora: a
  versão do pedido sobe, e a próxima passada tira a cópia).
- **A cópia em dia não vai de novo.** Cada cópia gravada fica em `agenda_google_eventos`, com uma assinatura do conteúdo;
  se nada mudou, nada vai ao Google. Por isso, o que alguém mudar à mão no Google (só a conta do escritório consegue) é
  desfeito na próxima vez que o item mudar no SEMPER. Um evento apagado à mão no Google é criado de novo nessa hora.
- **Ligar as agendas** (e cada agenda nova, como a de quem entra na equipe ou a de uma sala nova) põe na fila os itens em
  aberto **de hoje em diante**, no relógio de Brasília: compromissos não arquivados nem cancelados de hoje para a frente;
  tarefas e demandas não concluídas nem arquivadas com prazo de hoje para a frente; dias sem expediente de hoje para a
  frente; parcelas não recebidas nem excluídas que vencem de hoje para a frente. **O passado não vai** (nem as parcelas
  vencidas e não recebidas, nem os prazos atrasados). Um item do passado que mude depois vai, como qualquer mudança.
  Enquanto as agendas estão desligadas, nada entra na fila. Ao ligar de novo, vale o mesmo recorte **e** entra cada item
  que já tem cópia no Google, qualquer que seja a data ou o estado dele: o que foi excluído, arquivado, cancelado,
  concluído ou recebido nesse meio-tempo sai do Google na próxima passada.
- **Execução.** A mesma função `google-agendas`, a mesma rotina e o mesmo "Sincronizar agora": cada execução pega até 40
  pedidos (`PEDIDOS_POR_EXECUCAO`) e faz até 40 ações no Google (`ACOES_POR_EXECUCAO`); a cópia em dia não gasta ação.
  Para cada item: primeiro tira as cópias que não devem mais existir, depois grava as novas e as mudadas. A falha fica na
  fila com as mesmas esperas das agendas. Agenda apagada no Google: o SEMPER a esquece, o escritório volta à fila das
  agendas, ela é criada de novo e recebe os itens dela.
- **Ainda não:** os feriados nacionais e o recesso forense prontos (os de `regras/prazos.ts`, que o Calendário mostra
  sem estarem no banco) não vão à Geral: só os dias que o escritório lançou. Quem entra num item só por um **grupo da
  equipe** não ganha cópia: vão o responsável e os participantes escolhidos um a um. As despesas a pagar (#439) vão
  depois, na Administrativo.
- **No banco fictício** (`npm run teste`) só as agendas e os compartilhamentos são simulados; os eventos não (o
  "Sincronizar agora" de lá conta zero eventos).

## Onde está cada parte

| O quê | Onde |
|---|---|
| Plano puro (o que criar, compartilhar, renomear, retirar) e a execução da fila | `supabase/functions/_compartilhado/agendasGoogle.ts` |
| O que vai para qual agenda, como fica cada evento e o plano dos eventos (puros) | `supabase/functions/_compartilhado/eventosGoogle.ts` |
| Adaptador fino da API do Google Agenda (agendas, compartilhamentos e, para a parte 2, eventos) | `supabase/functions/_compartilhado/apiDaAgenda.ts` |
| As permissões e a finalidade do pedido de ligação | `supabase/functions/_compartilhado/ligacao.ts` |
| A função do servidor | `supabase/functions/google-agendas/index.ts` (e `google-conectar`, `google-concluir`, alteradas) |
| Banco: tabelas, fila, gatilhos, rotina | `supabase/migrations/20261125102621_agendas_google.sql` |
| Banco: as cópias gravadas, os gatilhos dos itens, o item como o servidor o lê | `supabase/migrations/20261125110831_agendas_google_eventos.sql` |
| Testes | `app/src/regras/agendasGoogle.test.ts`, `eventosGoogle.test.ts`, `ligacaoGoogle.test.ts`, `emailDoGoogle.test.ts`, `sincronizacaoDasAgendas.test.ts`, `supabase/tests/agendas_google.test.sql`, `agendas_google_eventos.test.sql`, `app/e2e/agendas-google.spec.ts` |
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
4. **Banco.** Aplicar as migrações `20261125102621_agendas_google.sql` e `20261125110831_agendas_google_eventos.sql`, nesta
   ordem, pelo roteiro `/aplicar-banco` do Claude Code. Elas só acrescentam: a versão anterior do site continua
   funcionando (as funções antigas da ligação ficam como eram; a segunda alarga a regra do assunto da fila e refaz três
   funções da primeira com a mesma assinatura).
5. **Funções do servidor.** Publicar a função nova e as duas alteradas, com o login conferido dentro delas
   (`verify_jwt = false`, já em `supabase/config.toml`):

   No terminal, na pasta do SEMPER, com o projeto ligado (`supabase link --project-ref uzafzwqjpxxiovfunxfm`):

   ```bash
   supabase functions deploy google-agendas
   supabase functions deploy google-conectar
   supabase functions deploy google-concluir
   ```

   O `deploy` leva junto os arquivos de `supabase/functions/_compartilhado/` que elas usam (`agendasGoogle.ts`,
   `eventosGoogle.ts`, `apiDaAgenda.ts`, `emailsDePrazo.ts`, `ligacao.ts`, `contatosGoogle.ts`...). O `emailsDePrazo.ts`
   só passou a exportar o endereço do site (o valor é o mesmo): `prazos-enviar-emails` não precisa ser publicada de novo. Se publicar pelo painel, mande o `index.ts` de cada uma e
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
8. **Os eventos.** Crie no SEMPER, com nomes de teste (sem cliente de verdade), um compromisso para amanhã, com você de
   responsável, um participante de teste e uma sala; uma tarefa com prazo daqui a dois dias, com hora; e lance um feriado
   de teste no Calendário. Clique em **Sincronizar agora** (o aviso diz quantos eventos foram levados às agendas) e confira
   no Google Agenda da conta do escritório: o compromisso na sua agenda, na do participante e na da sala; a tarefa na sua
   agenda, no dia e na hora do prazo; o feriado na Geral. Abra um evento e confira o título, o horário, o local, a
   descrição e o link (ele abre o item no SEMPER).
9. Mude a hora do compromisso e tire o participante; sincronize: o evento muda de hora e sai da agenda do participante.
   Conclua a tarefa e mova o compromisso para "Cancelado"; sincronize: os eventos saem. Apague o feriado de teste.
10. Se algo der errado, desmarque *Criar e manter no Google…*: a fila para na hora e nada mais muda no Google (os eventos
   já gravados ficam lá; dá para apagá-los à mão com a conta do escritório).
