-- =====================================================================
-- Agendas do escritório no Google Agenda (#166): a recusa de um compartilhamento não trava a fila, e o 404 numa agenda nova
-- não a faz ser esquecida (correções da revisão).
--   - Quando o Google recusa compartilhar uma agenda com um e-mail (o Workspace que não deixa compartilhar com contas de
--     fora, por exemplo), a função do servidor guarda a recusa (agenda_google_recusas) e segue com o resto do plano: antes,
--     o pedido 'agendas' inteiro falhava, e ninguém depois daquele e-mail recebia agenda nem compartilhamento. O plano pula
--     o e-mail recusado naquela agenda até o administrador pedir "Sincronizar agora" (que apaga as recusas e tenta de novo)
--     ou ligar as agendas de novo. Configurações mostra ao administrador cada e-mail recusado (agendas_google_recusas()).
--   - O estado e o item que a função lê levam quando cada agenda foi criada (criada_em): logo depois de criar uma agenda, o
--     Google pode responder 404 enquanto a espalha, e a função não a esquece (nem cria outra) nesse tempo; depois dele, só
--     esquece a agenda que, conferida no Google, também não existe (supabase/functions/_compartilhado/agendasGoogle.ts).
--   Só acrescenta: uma tabela e funções novas; seis funções refeitas com a mesma assinatura e o mesmo comportamento, mais
--   o que é dito em cada uma (o JSON do estado e do item ganha campos, que a função antiga ignora). A versão anterior do
--   site continua funcionando: ela não usa nada disto.
-- =====================================================================

-- Um por agenda e e-mail. detalhe: o que o Google respondeu (o mesmo tamanho de erro_detalhe da fila, TAMANHO_DO_DETALHE em
-- _compartilhado/apiDaAgenda.ts).
create table public.agenda_google_recusas (
  agenda_id     uuid not null references public.agendas_google on delete cascade,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  email         text not null check (length(email) <= 254),
  perfil_id     uuid references public.perfis on delete set null,
  detalhe       text check (length(detalhe) <= 200),
  recusada_em   timestamptz not null default now(),
  primary key (agenda_id, email)
);
create index agenda_google_recusas_escritorio on public.agenda_google_recusas (escritorio_id);

-- Cada escritório vê só as próprias linhas, e só os administradores. Ninguém grava pelo navegador.
alter table public.agenda_google_recusas enable row level security;
create policy leitura on public.agenda_google_recusas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke all on public.agenda_google_recusas from public, anon, authenticated;
grant select on public.agenda_google_recusas to authenticated;
grant select, insert, update, delete on public.agenda_google_recusas to service_role;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- O Google recusou compartilhar a agenda com o e-mail.
create function public.agendas_google_compartilhamento_recusado(p_agenda uuid, p_email text, p_perfil uuid, p_detalhe text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agenda_google_recusas as r (agenda_id, escritorio_id, email, perfil_id, detalhe)
  select a.id, a.escritorio_id, lower(p_email), p_perfil, left(p_detalhe, 200) from public.agendas_google a where a.id = p_agenda
  on conflict (agenda_id, email) do update set detalhe = excluded.detalhe, perfil_id = excluded.perfil_id, recusada_em = now()
$$;
revoke execute on function public.agendas_google_compartilhamento_recusado(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.agendas_google_compartilhamento_recusado(uuid, text, uuid, text) to service_role;

-- Como antes; e o compartilhamento feito apaga a recusa dele, se havia.
create or replace function public.agendas_google_compartilhada(p_agenda uuid, p_email text, p_perfil uuid, p_regra text) returns void
language sql security definer set search_path = '' as $$
  delete from public.agenda_google_recusas where agenda_id = p_agenda and email = lower(p_email);
  insert into public.agenda_google_compartilhamentos as c (agenda_id, escritorio_id, email, perfil_id, regra)
  select a.id, a.escritorio_id, lower(p_email), p_perfil, p_regra from public.agendas_google a where a.id = p_agenda
  on conflict (agenda_id, email) do update set regra = excluded.regra, perfil_id = excluded.perfil_id, compartilhado_em = now()
$$;

-- Como antes; e cada agenda vem com criada_em, e o estado com as recusas (as das agendas da conta ligada).
create or replace function public.agendas_google_estado(p_escritorio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with l as (
    select l.conta_email from privado.ligacoes l where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google'
  ), a as (
    select a.* from public.agendas_google a, l where a.escritorio_id = p_escritorio and a.conta_email = l.conta_email
  )
  select jsonb_build_object(
    'conta_email', (select conta_email from l),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object(
        'perfil_id', f.id, 'nome', f.nome, 'email', coalesce(g.email, case when not f.reservada then lower(u.email) end),
        'ativo', f.ativo and f.excluido_em is null, 'admin', f.papel in ('master', 'admin')) order by f.nome)
      from public.perfis f join auth.users u on u.id = f.id left join public.emails_do_google g on g.perfil_id = f.id
      where f.escritorio_id = p_escritorio), '[]'::jsonb),
    'salas', coalesce((select jsonb_agg(jsonb_build_object('sala_id', s.id, 'nome', s.nome, 'ativa', s.ativa) order by s.nome)
      from public.salas s where s.escritorio_id = p_escritorio), '[]'::jsonb),
    'agendas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'perfil_id', a.perfil_id, 'sala_id', a.sala_id,
        'google_id', a.google_id, 'nome', a.nome, 'criada_em', a.criada_em) order by a.criada_em) from a), '[]'::jsonb),
    'compartilhamentos', coalesce((select jsonb_agg(jsonb_build_object('agenda_id', c.agenda_id, 'email', c.email, 'regra', c.regra))
      from public.agenda_google_compartilhamentos c join a on a.id = c.agenda_id), '[]'::jsonb),
    'recusas', coalesce((select jsonb_agg(jsonb_build_object('agenda_id', r.agenda_id, 'email', r.email))
      from public.agenda_google_recusas r join a on a.id = r.agenda_id), '[]'::jsonb)
  )
$$;

-- Como antes (20261125110831_agendas_google_eventos.sql); e cada agenda vem com criada_em.
create or replace function public.agendas_google_item(p_escritorio uuid, p_assunto text, p_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with l as (
    select l.conta_email from privado.ligacoes l where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google'
  ), a as (
    select a.* from public.agendas_google a, l where a.escritorio_id = p_escritorio and a.conta_email = l.conta_email
  )
  select jsonb_build_object(
    'item', case p_assunto
      when 'compromisso' then privado.agenda_do_compromisso(p_escritorio, p_item)
      when 'tarefa' then privado.agenda_da_tarefa(p_escritorio, p_item)
      when 'demanda' then privado.agenda_da_demanda(p_escritorio, p_item)
      when 'dia' then privado.agenda_do_dia(p_escritorio, p_item)
      when 'parcela' then privado.agenda_da_parcela(p_escritorio, p_item) end,
    'agendas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'perfil_id', a.perfil_id, 'sala_id', a.sala_id,
        'google_id', a.google_id, 'criada_em', a.criada_em) order by a.criada_em) from a), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('agenda_id', e.agenda_id, 'agenda_google_id', a.google_id, 'evento_id', e.evento_id,
        'assinatura', e.assinatura) order by a.criada_em) from public.agenda_google_eventos e join a on a.id = e.agenda_id
      where e.escritorio_id = p_escritorio and e.assunto = p_assunto and e.item_id = p_item), '[]'::jsonb)
  )
$$;

-- Como antes (20261125110831_agendas_google_eventos.sql); e a agenda trocada por outra (criada de novo no lugar da que
-- sumiu) perde as recusas da velha.
create or replace function public.agendas_google_agenda_criada(p_escritorio uuid, p_conta text, p_tipo text, p_perfil uuid, p_sala uuid,
                                                               p_google text, p_nome text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select a.id into v_id from public.agendas_google a
  where a.escritorio_id = p_escritorio and a.conta_email = lower(p_conta) and a.tipo = p_tipo
    and a.perfil_id is not distinct from p_perfil and a.sala_id is not distinct from p_sala;
  if v_id is not null then
    delete from public.agenda_google_compartilhamentos c where c.agenda_id = v_id;
    delete from public.agenda_google_eventos e where e.agenda_id = v_id;
    delete from public.agenda_google_recusas r where r.agenda_id = v_id;
    update public.agendas_google a set google_id = p_google, nome = p_nome, criada_em = now() where a.id = v_id;
  else
    insert into public.agendas_google (escritorio_id, conta_email, tipo, perfil_id, sala_id, google_id, nome)
    values (p_escritorio, lower(p_conta), p_tipo, p_perfil, p_sala, p_google, p_nome)
    returning id into v_id;
  end if;
  perform privado.agendas_google_enfileirar_abertos(p_escritorio, p_tipo, p_perfil, p_sala);
  return v_id;
end $$;

-- Como antes; e as recusas do escritório saem (o "Sincronizar agora" tenta de novo cada compartilhamento recusado).
create or replace function public.agendas_google_agora(p_usuario uuid, p_nivel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.escritorio_do_admin(p_usuario, p_nivel);
begin
  if v_escritorio is null or not exists (select 1 from privado.ligacoes l where l.escritorio_id = v_escritorio and l.perfil_id is null
                                         and l.provedor = 'google' and l.agendas_ativas and privado.agenda_autorizada(l.escopos)) then
    return null;
  end if;
  update privado.ligacoes l set agendas_problema = null, agendas_problema_em = null
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
  delete from public.agenda_google_recusas r where r.escritorio_id = v_escritorio;
  perform privado.agendas_google_enfileirar(v_escritorio, 'agendas', null);
  update public.agendas_google_fila f set proxima_em = now()
  where f.escritorio_id = v_escritorio and (f.em_andamento_ate is null or f.em_andamento_ate < now());
  return v_escritorio;
end $$;

-- ---------------------------------------------------------------------
-- Pelo navegador (administradores)
-- ---------------------------------------------------------------------

-- Como antes (20261125110831_agendas_google_eventos.sql); e ligar apaga as recusas (tenta de novo cada uma).
create or replace function public.agendas_google_ligar(p_ligar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacoes;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores ligam e desligam as agendas no Google'; end if;
  select * into v from privado.ligacoes l
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google' for update;
  if v.id is null then raise exception 'Ligue a conta Google do escritório antes de ligar as agendas'; end if;
  if coalesce(p_ligar, false) and not privado.agenda_autorizada(v.escopos) then
    raise exception 'Autorize a agenda na conta Google do escritório antes de ligar as agendas';
  end if;
  update privado.ligacoes l set agendas_ativas = coalesce(p_ligar, false) where l.id = v.id returning * into v;
  if v.agendas_ativas then
    delete from public.agenda_google_recusas r where r.escritorio_id = v.escritorio_id;
    perform privado.agendas_google_enfileirar(v.escritorio_id, 'agendas', null);
    perform privado.agendas_google_enfileirar_abertos(v.escritorio_id, null, null, null);
  else
    delete from public.agendas_google_fila f where f.escritorio_id = v.escritorio_id;
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'ligacoes', v.id::text, 'alteracao', jsonb_build_object('email', v.conta_email, 'agendas', v.agendas_ativas), auth.uid());
end $$;

-- Os compartilhamentos que o Google recusou, nas agendas da conta ligada: o e-mail, o nome da agenda, o que o Google
-- respondeu e quando. Vazio para quem não é administrador.
create function public.agendas_google_recusas() returns table (email text, agenda text, detalhe text, recusada_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.email, a.nome, r.detalhe, r.recusada_em
  from public.agenda_google_recusas r
  join public.agendas_google a on a.id = r.agenda_id
  join privado.ligacoes l on l.escritorio_id = a.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = a.conta_email
  where r.escritorio_id = privado.meu_escritorio() and privado.sou_admin()
  order by r.email, a.nome
$$;
revoke execute on function public.agendas_google_recusas() from public, anon;
grant execute on function public.agendas_google_recusas() to authenticated;
