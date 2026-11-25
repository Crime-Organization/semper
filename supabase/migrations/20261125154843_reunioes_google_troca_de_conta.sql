-- =====================================================================
-- Google Meet no compromisso (tarefa #437), correção da revisão: trocar a conta Google do escritório cancela as reuniões
-- da conta antiga
--   Antes, ligar outra conta deixava as reuniões da conta antiga valendo no Google (com os convites e os links), e a
--   reunião criada na conta nova apagava o registro da antiga: ninguém conseguia mais cancelá-la, e os convidados ficavam
--   com dois convites. Agora:
--   - a reunião é guardada por compromisso E por conta: a da conta antiga continua registrada até ser cancelada;
--   - ao ligar outra conta, a função google-concluir, antes de revogar o token da conta antiga, cancela no Google (com o
--     aviso aos convidados) as reuniões dela de hoje em diante e as esquece (agendas_google_reunioes_da_conta e
--     agendas_google_reuniao_cancelada com a conta); a conta nova cria as dela pela fila, como sempre.
--   Só acrescenta: a chave da tabela fica mais larga (a conta entra nela; nenhuma linha muda), uma função é refeita com a
--   mesma assinatura e o mesmo comportamento, mais o que é dito nela, e duas funções novas. A versão anterior do site
--   continua funcionando: ela não usa esta tabela nem estas funções.
-- =====================================================================

alter table public.agenda_google_reunioes drop constraint agenda_google_reunioes_pkey;
alter table public.agenda_google_reunioes add primary key (escritorio_id, compromisso_id, conta_email);

-- Como antes (20261125143159_reunioes_google.sql), na chave nova: a reunião da conta guardada, sem mexer na de outra conta.
create or replace function public.agendas_google_reuniao_gravada(p_escritorio uuid, p_compromisso uuid, p_conta text, p_evento text, p_link text, p_espaco text,
                                                                 p_gravacao text, p_gravacao_detalhe text, p_assinatura text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.compromissos m where m.id = p_compromisso and m.escritorio_id <> p_escritorio) then
    raise exception 'Compromisso de outro escritório';
  end if;
  insert into public.agenda_google_reunioes as r (escritorio_id, compromisso_id, conta_email, evento_id, link, espaco, gravacao, gravacao_detalhe, assinatura)
  values (p_escritorio, p_compromisso, lower(p_conta), p_evento, p_link, p_espaco, p_gravacao, p_gravacao_detalhe, p_assinatura)
  on conflict (escritorio_id, compromisso_id, conta_email) do update
    set evento_id = excluded.evento_id, link = excluded.link, espaco = excluded.espaco,
        gravacao = excluded.gravacao, gravacao_detalhe = excluded.gravacao_detalhe, assinatura = excluded.assinatura, atualizada_em = now();
end $$;

-- A reunião de uma conta cancelada no Google (ou que sumiu de lá): só a daquela conta é esquecida. (A de dois argumentos,
-- de 20261125143159_reunioes_google.sql, continua como era: esquece a do compromisso em todas as contas.)
create function public.agendas_google_reuniao_cancelada(p_escritorio uuid, p_compromisso uuid, p_conta text) returns void
language sql security definer set search_path = '' as $$
  delete from public.agenda_google_reunioes
  where escritorio_id = p_escritorio and compromisso_id = p_compromisso and conta_email = lower(p_conta)
$$;

-- As reuniões de uma conta (a que saiu, ao trocar de conta) que ainda vão acontecer: de hoje em diante no relógio de Brasília,
-- ou de um compromisso já excluído (que só se cancela). Só do escritório dado.
create function public.agendas_google_reunioes_da_conta(p_escritorio uuid, p_conta text) returns table (compromisso_id uuid, evento_id text)
language sql stable security definer set search_path = '' as $$
  select r.compromisso_id, r.evento_id
  from public.agenda_google_reunioes r left join public.compromissos m on m.id = r.compromisso_id
  where r.escritorio_id = p_escritorio and r.conta_email = lower(p_conta)
    and (m.id is null or m.data >= (now() at time zone 'America/Sao_Paulo')::date)
  order by r.compromisso_id
$$;

revoke execute on function public.agendas_google_reuniao_cancelada(uuid, uuid, text), public.agendas_google_reunioes_da_conta(uuid, text)
  from public, anon, authenticated;
grant execute on function public.agendas_google_reuniao_cancelada(uuid, uuid, text), public.agendas_google_reunioes_da_conta(uuid, text) to service_role;
