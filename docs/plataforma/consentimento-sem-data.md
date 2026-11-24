# Contar as pessoas com consentimento sem data

Roteiro da tarefa #409. Quem faz é uma pessoa (o dono do SEMPER), no banco de produção. O agente só preparou a consulta.

## Por que contar

Antes da #405 e da #408, o cadastro de pessoa podia salvar a base legal **"consentimento"** sem a **data do consentimento**,
sem aviso. Sem a data, o escritório não tem como provar quando a pessoa autorizou o uso dos dados dela (LGPD). Hoje a data
é obrigatória, mas os cadastros antigos podem ter ficado sem ela.

A consulta abaixo **só conta**: não mostra nome, CPF, telefone nem nada de cliente. Ela também **não muda nada** no banco
(é só leitura).

## Passo a passo

1. Abra o **SQL Editor** do Supabase: https://supabase.com/dashboard/project/uzafzwqjpxxiovfunxfm/sql/new
2. Cole a consulta abaixo e clique em **Run**:

   ```sql
   -- Só contagem, sem nomes: quantas pessoas de cada escritório têm a base legal "consentimento" e a data vazia.
   select e.nome as escritorio,
          count(*) filter (where p.arquivado_em is null)     as ativas,
          count(*) filter (where p.arquivado_em is not null) as arquivadas,
          count(*)                                            as total
     from public.pessoas p
     join public.escritorios e on e.id = p.escritorio_id
    where p.lgpd_base = 'consentimento'
      and p.lgpd_consentimento is null
    group by e.nome
    order by e.nome;
   ```

3. Leia o resultado:
   - **Nenhuma linha** ("No rows returned"): nenhum escritório tem cadastro nessa situação. Não há nada a fazer; anote na
     tarefa #409 que a contagem deu zero.
   - **Uma linha por escritório**: `ativas` são os cadastros em uso, `arquivadas` os que estão no arquivo e `total` a soma.
     Anote os números na tarefa #409 (só os números e o nome do escritório, nunca nomes de clientes).

## Depois da contagem: o escritório completa as datas

Não é preciso rodar mais nada na produção. Com o site publicado com a #409:

1. O **administrador** do escritório entra no SEMPER. No **Início**, logo abaixo do título, aparece o aviso
   "N pessoas estão com a base legal "consentimento" e sem a data dele", com o link **Completar as datas**.
2. O link abre **Pessoas** já filtrada (em **Filtros**, "Situação do cadastro" = **Consentimento sem data**). As que estão no
   arquivo aparecem na seção **Arquivados**, embaixo da tabela.
3. Para cada pessoa: abra o cartão, clique em **Editar**, vá à etapa **Contato** e preencha a **Data do consentimento**
   (a data em que a pessoa autorizou, que está no documento assinado ou na conversa guardada). Salve.
4. Quando não sobrar nenhuma, o aviso some do Início sozinho.

Se o escritório não tiver como saber a data, a base legal "consentimento" não se sustenta: converse com o advogado
responsável sobre trocar para outra base legal (por exemplo, "execução de contrato") no mesmo **Editar**.

## Conferir de novo

Para ver se as datas foram completadas, rode a mesma consulta do passo 2. Quando ela não trouxer nenhuma linha, a tarefa
#409 pode ser fechada.
