-- =====================================================================
-- Google Meet no compromisso (tarefa #437), correções da revisão: os convidados em dia e as reuniões ao religar
--   - Quem sai da equipe (desativado ou excluído) deixa de ser convidado das reuniões: antes, só as agendas iam para a
--     fila, e a pessoa continuava recebendo o link e as atualizações das reuniões com os clientes. Agora os compromissos
--     com o Google Meet de hoje em diante em que ela está (responsável ou participante) vão para a fila, e o convite
--     atualizado sai sem ela (o Google manda o cancelamento para ela). Reativar a devolve.
--   - O e-mail do Google trocado (informado, mudado ou apagado em Equipe, ou o de entrada, para quem não informou outro)
--     e o e-mail de uma pessoa ligada trocado no cadastro dela também põem esses compromissos na fila: o e-mail novo
--     recebe o convite, e o antigo, o cancelamento.
--   - Religar as agendas põe na fila também os compromissos que já têm reunião no Google (na conta ligada): o que mudou
--     com as agendas desligadas (um compromisso cancelado, arquivado, excluído ou com outra hora) chega aos convidados.
--   Só acrescenta: funções e gatilhos novos, e uma função refeita com a mesma assinatura e o mesmo comportamento, mais o que
--   é dito nela. A versão anterior do site continua funcionando: ela não usa nada disto.
-- =====================================================================

-- Põe na fila os compromissos com o Google Meet, de hoje em diante (no relógio de Brasília), em que a pessoa da equipe está
-- (responsável ou participante). Só faz algo com as agendas ligadas (privado.agendas_google_enfileirar).
create function privado.reunioes_google_da_pessoa(p_escritorio uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select m.id from public.compromissos m
           where m.escritorio_id = p_escritorio and m.reuniao_google and m.data >= (now() at time zone 'America/Sao_Paulo')::date
             and (m.responsavel_id = p_perfil or p_perfil = any (m.participantes)) loop
    perform privado.agendas_google_enfileirar(p_escritorio, 'compromisso', v);
  end loop;
end $$;
revoke execute on function privado.reunioes_google_da_pessoa(uuid, uuid) from public, anon, authenticated;

-- Alguém sai da equipe (desativado ou excluído) ou volta.
create function privado.reunioes_google_da_equipe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.reunioes_google_da_pessoa(new.escritorio_id, new.id);
  return null;
end $$;
revoke execute on function privado.reunioes_google_da_equipe() from public, anon, authenticated;
create trigger reunioes_google after update of ativo, excluido_em on public.perfis
  for each row when (old.ativo is distinct from new.ativo or old.excluido_em is distinct from new.excluido_em)
  execute function privado.reunioes_google_da_equipe();

-- O e-mail do Google informado, trocado ou apagado (volta ao de entrada).
create function privado.reunioes_google_do_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.reunioes_google_da_pessoa(coalesce(new.escritorio_id, old.escritorio_id), coalesce(new.perfil_id, old.perfil_id));
  return null;
end $$;
revoke execute on function privado.reunioes_google_do_email() from public, anon, authenticated;
create trigger reunioes_google after insert or update or delete on public.emails_do_google
  for each row execute function privado.reunioes_google_do_email();

-- O e-mail de entrada trocado: vale para quem não informou outro e-mail do Google.
create function privado.reunioes_google_do_email_de_entrada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  select f.escritorio_id into v_escritorio from public.perfis f where f.id = new.id;
  if v_escritorio is not null then perform privado.reunioes_google_da_pessoa(v_escritorio, new.id); end if;
  return null;
end $$;
revoke execute on function privado.reunioes_google_do_email_de_entrada() from public, anon, authenticated;
create trigger reunioes_google_email_de_entrada after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function privado.reunioes_google_do_email_de_entrada();

-- O e-mail de uma pessoa ligada trocado no cadastro dela (o convite vai para o primeiro): os compromissos com o Google Meet,
-- de hoje em diante, em que ela está.
create function privado.reunioes_google_da_pessoa_ligada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select m.id from public.compromissos m
           where m.escritorio_id = new.escritorio_id and m.reuniao_google and m.data >= (now() at time zone 'America/Sao_Paulo')::date
             and new.id = any (m.pessoas) loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, 'compromisso', v);
  end loop;
  return null;
end $$;
revoke execute on function privado.reunioes_google_da_pessoa_ligada() from public, anon, authenticated;
create trigger reunioes_google after update of emails on public.pessoas
  for each row when (old.emails[1] is distinct from new.emails[1]) execute function privado.reunioes_google_da_pessoa_ligada();

-- Como antes (20261125120805_agendas_google_fila_completa.sql); e os compromissos que já têm reunião no Google, na conta
-- ligada (para o que mudou com as agendas desligadas chegar aos convidados, ou a reunião ser cancelada).
create or replace function privado.agendas_google_enfileirar_copias(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  for v in select distinct e.assunto, e.item_id
           from public.agenda_google_eventos e
           join public.agendas_google a on a.id = e.agenda_id
           join privado.ligacoes l on l.escritorio_id = a.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = a.conta_email
           where e.escritorio_id = p_escritorio
           union
           select 'compromisso', r.compromisso_id
           from public.agenda_google_reunioes r
           join privado.ligacoes l on l.escritorio_id = r.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = r.conta_email
           where r.escritorio_id = p_escritorio loop
    perform privado.agendas_google_enfileirar(p_escritorio, v.assunto, v.item_id);
  end loop;
end $$;
