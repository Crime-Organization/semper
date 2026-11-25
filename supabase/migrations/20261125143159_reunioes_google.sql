-- =====================================================================
-- Google Meet no compromisso (tarefa #437)
--   No compromisso, a opção "Criar link do Google Meet" (não é automática). A reunião é criada pela conta Google do
--   escritório (a mesma ligação das agendas, #166), na agenda principal dela: a conta é a organizadora, o convite vai pelo
--   e-mail do escritório para a equipe do compromisso (o e-mail do Google de cada um) e para as pessoas ligadas que têm
--   e-mail, e cada um entra com a conta que quiser. Mudou a data ou a hora: o mesmo link, e o convite é atualizado.
--   Arquivado, cancelado (coluna "Cancelado"), excluído ou com a opção desmarcada: a reunião é cancelada. A gravação e a
--   transcrição automáticas são ligadas pela Meet REST API quando o Google deixa; senão, quem grava é a conta do escritório.
--   - As permissões do Meet são pedidas aos poucos, como as da agenda: o administrador clica em "Autorizar o Google Meet"
--     nas Agendas no Google (o pedido de ligação ganha a finalidade 'meet'). As mesmas de ESCOPOS_DO_MEET em
--     supabase/functions/_compartilhado/ligacao.ts.
--   - Quem grava no SEMPER nunca espera o Google: a reunião vai pela mesma fila das agendas (o pedido do compromisso), e a
--     função google-agendas a cria, muda ou cancela antes das cópias (as regras: _compartilhado/reunioesGoogle.ts).
--   - O link fica em agenda_google_reunioes, que quem vê o compromisso lê (o cartão mostra o link).
--   Só acrescenta: uma coluna com valor padrão, uma tabela, funções e gatilhos; a regra da finalidade do pedido fica mais
--   larga; cinco funções são refeitas com a mesma assinatura e o mesmo comportamento, mais o que é dito em cada uma. A versão
--   anterior do site continua funcionando: ela não usa nada disto, e o compromisso que ela grava fica sem reunião.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A opção no compromisso
-- ---------------------------------------------------------------------
alter table public.compromissos add column reuniao_google boolean not null default false;
-- Quem muda o compromisso marca e desmarca (a regra de alterar dos compromissos vale; só as colunas dadas mudam pelo navegador).
grant update (reuniao_google) on public.compromissos to authenticated;

-- ---------------------------------------------------------------------
-- As permissões do Meet, pedidas aos poucos
-- ---------------------------------------------------------------------

-- As mesmas de ESCOPOS_DO_MEET (supabase/functions/_compartilhado/ligacao.ts).
create function privado.meet_autorizado(p_escopos text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_escopos, '{}') @> array['https://www.googleapis.com/auth/calendar.events.owned', 'https://www.googleapis.com/auth/meetings.space.settings']
$$;
revoke execute on function privado.meet_autorizado(text[]) from public, anon, authenticated;

alter table privado.ligacao_pedidos drop constraint ligacao_pedidos_finalidade_check;
alter table privado.ligacao_pedidos add constraint ligacao_pedidos_finalidade_check check (finalidade in ('contatos', 'agendas', 'meet'));

-- Começa o pedido das permissões do Meet: só administradores, com a conta Google do escritório já ligada. Vale 10 minutos.
create function public.ligacao_google_iniciar_meet(p_voltar_para text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_estado text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores autorizam o Google Meet na conta Google do escritório'; end if;
  if not exists (select 1 from privado.ligacoes l where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google') then
    raise exception 'Ligue a conta Google do escritório antes de autorizar o Google Meet';
  end if;
  delete from privado.ligacao_pedidos where pedido_em < now() - interval '10 minutes';
  insert into privado.ligacao_pedidos (estado, escritorio_id, perfil_id, provedor, voltar_para, verificador, pedido_por, finalidade)
  values (v_estado, privado.meu_escritorio(), null, 'google', p_voltar_para, privado.base64url(extensions.gen_random_bytes(48)), auth.uid(), 'meet');
  return v_estado;
end $$;
revoke execute on function public.ligacao_google_iniciar_meet(text) from public, anon;
grant execute on function public.ligacao_google_iniciar_meet(text) to authenticated;

-- Como antes (20261125102621_agendas_google.sql); e o pedido do Meet também manda a conta ligada (o Google já abre nela).
create or replace function public.ligacao_pedido_conferir_finalidade(p_estado text) returns table (voltar_para text, desafio text, finalidade text, conta_email text)
language sql stable security definer set search_path = '' as $$
  select p.voltar_para, privado.base64url(extensions.digest(p.verificador, 'sha256')), p.finalidade,
         case when p.finalidade in ('agendas', 'meet') then l.conta_email end
  from privado.ligacao_pedidos p
  left join privado.ligacoes l on l.escritorio_id = p.escritorio_id and l.perfil_id is not distinct from p.perfil_id and l.provedor = p.provedor
  where p.estado = p_estado and p.pedido_em >= now() - interval '10 minutes'
$$;

-- Como antes (20261125102621_agendas_google.sql); e o pedido do Meet, como o da agenda, só serve com a conta ainda ligada.
create or replace function public.ligacao_pedido_consumir(p_estado text, p_usuario uuid, p_nivel text)
returns table (escritorio_id uuid, perfil_id uuid, provedor text, verificador text, finalidade text, conta_email text)
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacao_pedidos; v_conta text;
begin
  delete from privado.ligacao_pedidos p where p.estado = p_estado and p.pedido_por = p_usuario returning * into v;
  if v.estado is null or v.pedido_em < now() - interval '10 minutes'
     or not exists (select 1 from public.perfis f where f.id = p_usuario and f.escritorio_id = v.escritorio_id
                    and f.ativo and f.papel in ('master', 'admin'))
     or (p_nivel is distinct from 'aal2'
         and exists (select 1 from auth.mfa_factors m where m.user_id = p_usuario and m.status = 'verified')) then
    return;
  end if;
  select l.conta_email into v_conta from privado.ligacoes l
  where l.escritorio_id = v.escritorio_id and l.perfil_id is not distinct from v.perfil_id and l.provedor = v.provedor;
  if v.finalidade in ('agendas', 'meet') and v_conta is null then return; end if;
  return query select v.escritorio_id, v.perfil_id, v.provedor, v.verificador, v.finalidade, v_conta;
end $$;

revoke execute on function public.ligacao_pedido_conferir_finalidade(text), public.ligacao_pedido_consumir(text, uuid, text) from public, anon, authenticated;
grant execute on function public.ligacao_pedido_conferir_finalidade(text), public.ligacao_pedido_consumir(text, uuid, text) to service_role;

-- O Google Meet no escritório de quem está logado (qualquer um da equipe: o cadastro do compromisso mostra a opção):
-- "autorizado", a conta Google do escritório deu as permissões do Meet; "disponivel", além disso as agendas no Google estão
-- ligadas (a reunião vai pela fila delas). Sem conta ligada, nenhuma linha.
create function public.reunioes_google_situacao() returns table (autorizado boolean, disponivel boolean)
language sql stable security definer set search_path = '' as $$
  select privado.meet_autorizado(l.escopos), privado.meet_autorizado(l.escopos) and l.agendas_ativas
  from privado.ligacoes l
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google'
$$;
revoke execute on function public.reunioes_google_situacao() from public, anon;
grant execute on function public.reunioes_google_situacao() to authenticated;

-- ---------------------------------------------------------------------
-- As reuniões criadas no Google
-- ---------------------------------------------------------------------
-- Uma por compromisso, na conta ligada quando foi criada. Sem chave para o compromisso: a reunião do compromisso excluído
-- fica até ser cancelada no Google. evento_id: o id escolhido pelo SEMPER (idDaReuniao); link: o do Meet (null enquanto o
-- Google o cria); espaco: o espaço do Meet ("spaces/…"); gravacao: 'ligada' ou 'recusada' (o Google não deixou); assinatura:
-- o convite gravado, resumido. Os tamanhos: o link do Meet tem até 1300 caracteres (documentação do Google); o detalhe, o
-- de TAMANHO_DO_DETALHE (apiDaAgenda.ts).
create table public.agenda_google_reunioes (
  escritorio_id    uuid not null references public.escritorios on delete cascade,
  compromisso_id   uuid not null,
  conta_email      text not null,
  evento_id        text not null check (evento_id ~ '^[a-v0-9]+$' and length(evento_id) between 5 and 1024),
  link             text check (length(link) <= 1300 and link ~ '^https://'),
  espaco           text check (length(espaco) <= 200),
  gravacao         text check (gravacao in ('ligada', 'recusada')),
  gravacao_detalhe text check (length(gravacao_detalhe) <= 200),
  assinatura       text check (length(assinatura) <= 64),
  criada_em        timestamptz not null default now(),
  atualizada_em    timestamptz not null default now(),
  primary key (escritorio_id, compromisso_id)
);

-- Cada escritório vê só as próprias linhas, e só de quem vê o compromisso (a regra de leitura dos compromissos vale dentro
-- desta). Ninguém grava pelo navegador: só a função do servidor.
alter table public.agenda_google_reunioes enable row level security;
create policy leitura on public.agenda_google_reunioes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.compromissos c where c.id = compromisso_id));
revoke all on public.agenda_google_reunioes from public, anon, authenticated;
grant select on public.agenda_google_reunioes to authenticated;
grant select, insert, update, delete on public.agenda_google_reunioes to service_role;

-- ---------------------------------------------------------------------
-- Os gatilhos: marcar ou desmarcar a opção põe o compromisso na fila
-- ---------------------------------------------------------------------
create trigger agendas_google_reuniao after update of reuniao_google on public.compromissos
  for each row when (old.reuniao_google is distinct from new.reuniao_google)
  execute function privado.agendas_google_do_item('compromisso');

-- Como antes (20261125120805_agendas_google_fila_completa.sql); e o compromisso excluído entra na fila também quando tem
-- uma reunião no Google, para ela ser cancelada.
create or replace function privado.agendas_google_do_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if (exists (select 1 from public.agenda_google_eventos e
                where e.escritorio_id = old.escritorio_id and e.assunto = tg_argv[0] and e.item_id = old.id)
        or exists (select 1 from public.agendas_google_fila f
                   where f.escritorio_id = old.escritorio_id and f.assunto = tg_argv[0] and f.item_id = old.id)
        or (tg_argv[0] = 'compromisso' and exists (select 1 from public.agenda_google_reunioes r
                                                   where r.escritorio_id = old.escritorio_id and r.compromisso_id = old.id)))
       and exists (select 1 from public.escritorios s where s.id = old.escritorio_id) then
      perform privado.agendas_google_enfileirar(old.escritorio_id, tg_argv[0], old.id);
    end if;
  else
    perform privado.agendas_google_enfileirar(new.escritorio_id, tg_argv[0], new.id);
  end if;
  return null;
end $$;

-- A conta passou a ter as permissões do Meet (autorizado agora): os compromissos com a opção marcada, de hoje em diante (no
-- relógio de Brasília), não arquivados nem cancelados, vão para a fila e ganham a reunião.
create function privado.reunioes_google_da_ligacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select m.id from public.compromissos m
           where m.escritorio_id = new.escritorio_id and m.reuniao_google and m.arquivado_em is null and not privado.coluna_cancelada(m.etapa_id)
             and m.data >= (now() at time zone 'America/Sao_Paulo')::date loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, 'compromisso', v);
  end loop;
  return null;
end $$;
revoke execute on function privado.reunioes_google_da_ligacao() from public, anon, authenticated;
create trigger reunioes_google after update of escopos on privado.ligacoes
  for each row when (new.perfil_id is null and new.provedor = 'google' and new.agendas_ativas
                     and privado.meet_autorizado(new.escopos) and not privado.meet_autorizado(old.escopos))
  execute function privado.reunioes_google_da_ligacao();

-- ---------------------------------------------------------------------
-- O compromisso como o servidor o lê (CompromissoNaAgenda em _compartilhado/eventosGoogle.ts)
-- ---------------------------------------------------------------------

-- Os e-mails dos convidados da reunião: a equipe do compromisso (o responsável e os participantes ativos, pelo e-mail do
-- Google de cada um; a conta reservada não tem e-mail de verdade) e as pessoas ligadas que têm e-mail (o primeiro de cada uma).
create function privado.convidados_da_reuniao(p_compromisso uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct x.email order by x.email), '[]'::jsonb) from (
    select lower(coalesce(g.email, case when not f.reservada then u.email end)) as email
    from public.compromissos m
    join public.perfis f on f.id = m.responsavel_id or f.id = any (m.participantes)
    left join auth.users u on u.id = f.id
    left join public.emails_do_google g on g.perfil_id = f.id
    where m.id = p_compromisso and f.escritorio_id = m.escritorio_id and f.ativo and f.excluido_em is null
    union
    select lower(btrim(p.emails[1]))
    from public.compromissos m join public.pessoas p on p.id = any (m.pessoas) and p.escritorio_id = m.escritorio_id
    where m.id = p_compromisso and cardinality(p.emails) > 0
  ) x
  where x.email is not null and x.email <> ''
$$;
revoke execute on function privado.convidados_da_reuniao(uuid) from public, anon, authenticated;

-- Como antes (20261125110831_agendas_google_eventos.sql); e, para o Google Meet: se a opção está marcada, os convidados e o
-- link da reunião já criada na conta ligada agora (que vai também na descrição das cópias).
create or replace function privado.agenda_do_compromisso(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id,
    -- O mesmo nome que nomeDoCompromisso, em app/src/regras/compromisso.ts (e privado.prazos_da_equipe).
    'titulo', coalesce(nullif(btrim(m.titulo), ''), concat_ws(' · ',
      case m.tipo when 'audiencia' then 'Audiência' when 'pericia' then 'Perícia' when 'reuniao' then 'Reunião' else 'Outro' end,
      coalesce(nullif(replace(m.pessoa_nome, '; ', ', '), ''), m.processo_numero))),
    'data', to_char(m.data, 'YYYY-MM-DD'), 'hora', to_char(m.hora, 'HH24:MI'), 'hora_fim', to_char(m.hora_fim, 'HH24:MI'), 'local', m.local,
    'geral', m.geral, 'responsavel_id', m.responsavel_id, 'participantes', to_jsonb(m.participantes), 'sala_id', m.sala_id, 'sala_nome', s.nome,
    'clientes', nullif(replace(m.pessoa_nome, '; ', ', '), ''), 'processo_numero', m.processo_numero,
    'arquivado', m.arquivado_em is not null, 'cancelado', privado.coluna_cancelada(m.etapa_id),
    'reuniao', m.reuniao_google,
    'convidados', case when m.reuniao_google then privado.convidados_da_reuniao(m.id) else '[]'::jsonb end,
    'reuniao_link', case when m.reuniao_google then (
      select r.link from public.agenda_google_reunioes r join privado.ligacoes l
        on l.escritorio_id = r.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = r.conta_email
      where r.escritorio_id = m.escritorio_id and r.compromisso_id = m.id) end)
  from public.compromissos m left join public.salas s on s.id = m.sala_id
  where m.id = p_id and m.escritorio_id = p_escritorio
$$;

-- Como antes (20261125115138_agendas_google_recusas.sql); e, no compromisso, a reunião já criada na conta ligada agora
-- (ReuniaoGuardada em _compartilhado/reunioesGoogle.ts; a de outra conta, de antes de trocar a conta, fica de fora) e se a
-- conta deu as permissões do Meet.
create or replace function public.agendas_google_item(p_escritorio uuid, p_assunto text, p_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with l as (
    select l.conta_email, l.escopos from privado.ligacoes l where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google'
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
      where e.escritorio_id = p_escritorio and e.assunto = p_assunto and e.item_id = p_item), '[]'::jsonb),
    'reuniao', case when p_assunto = 'compromisso' then (
      select jsonb_build_object('evento_id', r.evento_id, 'link', r.link, 'espaco', r.espaco, 'gravacao', r.gravacao,
                                'gravacao_detalhe', r.gravacao_detalhe, 'assinatura', r.assinatura)
      from public.agenda_google_reunioes r, l
      where r.escritorio_id = p_escritorio and r.compromisso_id = p_item and r.conta_email = l.conta_email) end,
    'meet', coalesce((select privado.meet_autorizado(l.escopos) from l), false)
  )
$$;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- A reunião criada ou mudada no Google (o link, a gravação, a assinatura do convite), na conta ligada. Só do compromisso do
-- próprio escritório (ou já excluído, que só se cancela).
create function public.agendas_google_reuniao_gravada(p_escritorio uuid, p_compromisso uuid, p_conta text, p_evento text, p_link text, p_espaco text,
                                                      p_gravacao text, p_gravacao_detalhe text, p_assinatura text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.compromissos m where m.id = p_compromisso and m.escritorio_id <> p_escritorio) then
    raise exception 'Compromisso de outro escritório';
  end if;
  insert into public.agenda_google_reunioes as r (escritorio_id, compromisso_id, conta_email, evento_id, link, espaco, gravacao, gravacao_detalhe, assinatura)
  values (p_escritorio, p_compromisso, lower(p_conta), p_evento, p_link, p_espaco, p_gravacao, p_gravacao_detalhe, p_assinatura)
  on conflict (escritorio_id, compromisso_id) do update
    set conta_email = excluded.conta_email, evento_id = excluded.evento_id, link = excluded.link, espaco = excluded.espaco,
        gravacao = excluded.gravacao, gravacao_detalhe = excluded.gravacao_detalhe, assinatura = excluded.assinatura, atualizada_em = now();
end $$;

-- A reunião cancelada no Google (ou que sumiu de lá).
create function public.agendas_google_reuniao_cancelada(p_escritorio uuid, p_compromisso uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.agenda_google_reunioes where escritorio_id = p_escritorio and compromisso_id = p_compromisso
$$;

revoke execute on function public.agendas_google_reuniao_gravada(uuid, uuid, text, text, text, text, text, text, text),
  public.agendas_google_reuniao_cancelada(uuid, uuid) from public, anon, authenticated;
grant execute on function public.agendas_google_reuniao_gravada(uuid, uuid, text, text, text, text, text, text, text),
  public.agendas_google_reuniao_cancelada(uuid, uuid) to service_role;
