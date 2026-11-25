-- =====================================================================
-- Agendas do escritório no Google Agenda (tarefa #166, parte 2 de 2: os eventos)
--   Depois das agendas e dos compartilhamentos (20261125102621_agendas_google.sql), o SEMPER leva a elas, só no sentido
--   SEMPER → Google, os eventos (o que vai para qual agenda é decidido pelas funções puras de
--   supabase/functions/_compartilhado/eventosGoogle.ts; o banco só entrega o item como está):
--   - compromisso: uma cópia na agenda do responsável e de cada participante, na Geral se "Agenda geral", na da sala se tem
--     sala. Mudar, arquivar, cancelar (coluna "Cancelado") ou excluir muda ou tira as cópias;
--   - tarefa e demanda com prazo: na data de entrega (com a hora, se houver), nas agendas do responsável e de cada
--     participante (colaborador). Concluída ou arquivada: sai;
--   - dia sem expediente e suspensão do "Feriados e prazos": na Geral;
--   - parcela a receber: na agenda do advogado responsável pelo contrato. Recebida ou excluída: sai.
--   Cada item é um pedido da fila (agendas_google_fila, com o assunto e o item_id). Gatilhos põem o item na fila quando
--   mudam os campos que vão ao Google (não a cada mudança qualquer); o item que muda várias vezes antes de a fila rodar é
--   um pedido só (a versão cresce) e vai com o estado final. As cópias gravadas ficam em agenda_google_eventos, com a
--   assinatura do conteúdo: o que não mudou não vai de novo ao Google.
--   - Ligar as agendas (e cada agenda nova, como a de quem entra na equipe) põe na fila os itens em aberto de hoje em
--     diante: compromissos e dias a partir de hoje, prazos de hoje em diante e parcelas a vencer. O passado não vai.
--   Só acrescenta: o assunto da fila ganha os valores novos (a regra fica mais larga), uma tabela, funções e gatilhos;
--   três funções da parte 1 são refeitas com a mesma assinatura e o mesmo comportamento, mais o que é dito em cada uma.
--   A versão anterior do site continua funcionando: ela não usa nada disto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A fila ganha os assuntos dos eventos (os mesmos de AssuntoDaFila em _compartilhado/agendasGoogle.ts)
-- ---------------------------------------------------------------------
alter table public.agendas_google_fila drop constraint agendas_google_fila_assunto_check;
alter table public.agendas_google_fila add constraint agendas_google_fila_assunto_check
  check (assunto in ('agendas', 'compromisso', 'tarefa', 'demanda', 'dia', 'parcela'));

-- ---------------------------------------------------------------------
-- As cópias gravadas no Google
-- ---------------------------------------------------------------------
-- Uma por agenda e evento. evento_id: o id escolhido pelo SEMPER (idDoEvento, o mesmo em todas as agendas); assinatura: o
-- conteúdo gravado, resumido (assinaturaDoEvento). Sem chave para o item: a cópia do item excluído fica até sair do Google.
create table public.agenda_google_eventos (
  agenda_id     uuid not null references public.agendas_google on delete cascade,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  assunto       text not null check (assunto in ('compromisso', 'tarefa', 'demanda', 'dia', 'parcela')),
  item_id       uuid not null,
  evento_id     text not null check (evento_id ~ '^[a-v0-9]+$' and length(evento_id) between 5 and 1024),
  assinatura    text not null check (length(assinatura) <= 64),
  gravado_em    timestamptz not null default now(),
  primary key (agenda_id, evento_id)
);
create index agenda_google_eventos_item on public.agenda_google_eventos (escritorio_id, assunto, item_id);

-- Cada escritório vê só as próprias linhas, e só os administradores. Ninguém grava pelo navegador.
alter table public.agenda_google_eventos enable row level security;
create policy leitura on public.agenda_google_eventos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke all on public.agenda_google_eventos from public, anon, authenticated;
grant select on public.agenda_google_eventos to authenticated;
grant select, insert, update, delete on public.agenda_google_eventos to service_role;

-- ---------------------------------------------------------------------
-- Os itens em aberto, na fila
-- ---------------------------------------------------------------------

-- Põe na fila os itens em aberto de hoje em diante (no relógio de Brasília), só com as agendas ligadas. Sem p_tipo: todos
-- (ao ligar as agendas). Com p_tipo: só os que vão para aquela agenda nova ('pessoa': os do p_perfil; 'geral': os
-- compromissos da Agenda geral e os dias sem expediente; 'sala': os compromissos da p_sala; 'administrativo': nenhum).
-- Quem já está na fila tem a versão aumentada (vai de novo, com o estado de agora).
create function privado.agendas_google_enfileirar_abertos(p_escritorio uuid, p_tipo text, p_perfil uuid, p_sala uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from privado.ligacoes l
                 where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google' and l.agendas_ativas) then
    return;
  end if;
  insert into public.agendas_google_fila as f (escritorio_id, assunto, item_id)
  select p_escritorio, x.assunto, x.id from (
    select 'compromisso'::text as assunto, m.id from public.compromissos m
    where m.escritorio_id = p_escritorio and m.data >= v_hoje and m.arquivado_em is null and not privado.coluna_cancelada(m.etapa_id)
      and (p_tipo is null or (p_tipo = 'pessoa' and (m.responsavel_id = p_perfil or p_perfil = any (m.participantes)))
           or (p_tipo = 'geral' and m.geral) or (p_tipo = 'sala' and m.sala_id = p_sala))
    union all
    select 'tarefa', t.id from public.tarefas t left join public.quadro_colunas q on q.id = t.etapa_id
    where t.escritorio_id = p_escritorio and t.prazo >= v_hoje and t.arquivado_em is null and t.concluida_em is null
      and q.marco is distinct from 'concluido'
      and (p_tipo is null or (p_tipo = 'pessoa' and (t.responsavel_id = p_perfil or p_perfil = any (t.participantes))))
    union all
    select 'demanda', d.id from public.demandas d left join public.quadro_colunas q on q.id = d.etapa_id
    where d.escritorio_id = p_escritorio and d.prazo >= v_hoje and d.arquivado_em is null and q.marco is distinct from 'concluido'
      and (p_tipo is null or (p_tipo = 'pessoa' and (d.responsavel_id = p_perfil or p_perfil = any (d.colaboradores))))
    union all
    select 'dia', s.id from public.dias_sem_expediente s
    where s.escritorio_id = p_escritorio and s.data >= v_hoje and (p_tipo is null or p_tipo = 'geral')
    union all
    select 'parcela', p.id from public.contrato_parcelas p join public.contratos c on c.id = p.contrato_id
    where p.escritorio_id = p_escritorio and p.vencimento >= v_hoje and p.excluido_em is null and p.recebimento_id is null and p.recebida_em is null
      and (p_tipo is null or (p_tipo = 'pessoa' and c.responsavel_id = p_perfil))
  ) x
  on conflict (escritorio_id, assunto, item_id) do update
    set versao = f.versao + 1, pedido_em = now(),
        tentativas = case when f.erro = 'recusado' then 0 else f.tentativas end,
        proxima_em = case when f.erro = 'recusado' then now() else f.proxima_em end;
end $$;
revoke execute on function privado.agendas_google_enfileirar_abertos(uuid, text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Os gatilhos: o item que muda nos campos que vão ao Google entra na fila
-- ---------------------------------------------------------------------

-- O item criado ou mudado entra na fila (o assunto vem no gatilho). O excluído, só se tem cópia no Google para tirar (e o
-- escritório continua: excluir o escritório inteiro leva tudo junto).
create function privado.agendas_google_do_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.agenda_google_eventos e
               where e.escritorio_id = old.escritorio_id and e.assunto = tg_argv[0] and e.item_id = old.id)
       and exists (select 1 from public.escritorios s where s.id = old.escritorio_id) then
      perform privado.agendas_google_enfileirar(old.escritorio_id, tg_argv[0], old.id);
    end if;
  else
    perform privado.agendas_google_enfileirar(new.escritorio_id, tg_argv[0], new.id);
  end if;
  return null;
end $$;
revoke execute on function privado.agendas_google_do_item() from public, anon, authenticated;

-- Compromisso: título, tipo (dá o nome sem título), quando, local, Agenda geral, equipe, clientes, processo, sala, coluna e arquivo.
create trigger agendas_google_novo after insert on public.compromissos
  for each row execute function privado.agendas_google_do_item('compromisso');
create trigger agendas_google_mudou after update on public.compromissos
  for each row when ((old.titulo, old.tipo, old.data, old.hora, old.hora_fim, old.local, old.geral, old.responsavel_id, old.participantes,
                      old.pessoa_nome, old.processo_numero, old.sala_id, old.etapa_id, old.arquivado_em)
                     is distinct from (new.titulo, new.tipo, new.data, new.hora, new.hora_fim, new.local, new.geral, new.responsavel_id,
                      new.participantes, new.pessoa_nome, new.processo_numero, new.sala_id, new.etapa_id, new.arquivado_em))
  execute function privado.agendas_google_do_item('compromisso');
create trigger agendas_google_excluido after delete on public.compromissos
  for each row execute function privado.agendas_google_do_item('compromisso');

-- Tarefa: só com prazo vai ao Google (a que perde o prazo sai). O início (data_inicio) não conta.
create trigger agendas_google_novo after insert on public.tarefas
  for each row when (new.prazo is not null) execute function privado.agendas_google_do_item('tarefa');
create trigger agendas_google_mudou after update on public.tarefas
  for each row when ((old.titulo, old.prazo, old.prazo_hora, old.responsavel_id, old.participantes, old.pessoa_nome, old.processo_id,
                      old.etapa_id, old.concluida_em, old.arquivado_em)
                     is distinct from (new.titulo, new.prazo, new.prazo_hora, new.responsavel_id, new.participantes, new.pessoa_nome,
                      new.processo_id, new.etapa_id, new.concluida_em, new.arquivado_em))
  execute function privado.agendas_google_do_item('tarefa');
create trigger agendas_google_excluido after delete on public.tarefas
  for each row execute function privado.agendas_google_do_item('tarefa');

-- Demanda: como a tarefa (os colaboradores são os participantes).
create trigger agendas_google_novo after insert on public.demandas
  for each row when (new.prazo is not null) execute function privado.agendas_google_do_item('demanda');
create trigger agendas_google_mudou after update on public.demandas
  for each row when ((old.titulo, old.prazo, old.prazo_hora, old.responsavel_id, old.colaboradores, old.cliente_nome, old.etapa_id, old.arquivado_em)
                     is distinct from (new.titulo, new.prazo, new.prazo_hora, new.responsavel_id, new.colaboradores, new.cliente_nome,
                      new.etapa_id, new.arquivado_em))
  execute function privado.agendas_google_do_item('demanda');
create trigger agendas_google_excluido after delete on public.demandas
  for each row execute function privado.agendas_google_do_item('demanda');

-- Dia sem expediente: lançado, mudado ou apagado.
create trigger agendas_google_novo after insert on public.dias_sem_expediente
  for each row execute function privado.agendas_google_do_item('dia');
create trigger agendas_google_mudou after update on public.dias_sem_expediente
  for each row when ((old.data, old.motivo, old.tipo, old.orgao_id) is distinct from (new.data, new.motivo, new.tipo, new.orgao_id))
  execute function privado.agendas_google_do_item('dia');
create trigger agendas_google_excluido after delete on public.dias_sem_expediente
  for each row execute function privado.agendas_google_do_item('dia');

-- Parcela: vencimento, valor, número, recebimento e exclusão.
create trigger agendas_google_novo after insert on public.contrato_parcelas
  for each row execute function privado.agendas_google_do_item('parcela');
create trigger agendas_google_mudou after update on public.contrato_parcelas
  for each row when ((old.vencimento, old.valor, old.numero, old.recebimento_id, old.recebida_em, old.excluido_em)
                     is distinct from (new.vencimento, new.valor, new.numero, new.recebimento_id, new.recebida_em, new.excluido_em))
  execute function privado.agendas_google_do_item('parcela');
create trigger agendas_google_excluido after delete on public.contrato_parcelas
  for each row execute function privado.agendas_google_do_item('parcela');

-- O que muda fora do item e aparece no evento: o contrato da parcela (o responsável, que diz a agenda; o código, os
-- clientes e quantas parcelas), o nome da sala, o número do processo da tarefa e a sigla do órgão do dia. Põe na fila os
-- itens ligados que ainda vão (ou podem ter ido) ao Google.
create function privado.agendas_google_do_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select p.id from public.contrato_parcelas p where p.contrato_id = new.id and p.excluido_em is null and p.recebimento_id is null loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, 'parcela', v);
  end loop;
  return null;
end $$;
create trigger agendas_google_parcelas after update on public.contratos
  for each row when ((old.responsavel_id, old.codigo, old.cliente_nome, old.parcelas) is distinct from (new.responsavel_id, new.codigo, new.cliente_nome, new.parcelas))
  execute function privado.agendas_google_do_contrato();

create function privado.agendas_google_da_sala() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select m.id from public.compromissos m
           where m.sala_id = new.id and m.data >= (now() at time zone 'America/Sao_Paulo')::date and m.arquivado_em is null loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, 'compromisso', v);
  end loop;
  return null;
end $$;
create trigger agendas_google_compromissos after update on public.salas
  for each row when (old.nome is distinct from new.nome) execute function privado.agendas_google_da_sala();

create function privado.agendas_google_do_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select t.id from public.tarefas t where t.processo_id = new.id and t.prazo is not null and t.arquivado_em is null loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, 'tarefa', v);
  end loop;
  return null;
end $$;
create trigger agendas_google_tarefas after update on public.processos
  for each row when (old.numero is distinct from new.numero) execute function privado.agendas_google_do_processo();

create function privado.agendas_google_do_orgao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  for v in select s.id from public.dias_sem_expediente s where s.orgao_id = new.id loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, 'dia', v);
  end loop;
  return null;
end $$;
create trigger agendas_google_dias after update on public.orgaos
  for each row when (old.sigla is distinct from new.sigla) execute function privado.agendas_google_do_orgao();

revoke execute on function privado.agendas_google_do_contrato(), privado.agendas_google_da_sala(), privado.agendas_google_do_processo(),
  privado.agendas_google_do_orgao() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- O item como está (para as funções puras de eventosGoogle.ts: ItensNaAgenda)
-- ---------------------------------------------------------------------
-- Cada um devolve null se o item não existe (foi excluído) ou é de outro escritório. Datas "aaaa-mm-dd", horas "hh:mm".

create function privado.agenda_do_compromisso(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id,
    -- O mesmo nome que nomeDoCompromisso, em app/src/regras/compromisso.ts (e privado.prazos_da_equipe).
    'titulo', coalesce(nullif(btrim(m.titulo), ''), concat_ws(' · ',
      case m.tipo when 'audiencia' then 'Audiência' when 'pericia' then 'Perícia' when 'reuniao' then 'Reunião' else 'Outro' end,
      coalesce(nullif(replace(m.pessoa_nome, '; ', ', '), ''), m.processo_numero))),
    'data', to_char(m.data, 'YYYY-MM-DD'), 'hora', to_char(m.hora, 'HH24:MI'), 'hora_fim', to_char(m.hora_fim, 'HH24:MI'), 'local', m.local,
    'geral', m.geral, 'responsavel_id', m.responsavel_id, 'participantes', to_jsonb(m.participantes), 'sala_id', m.sala_id, 'sala_nome', s.nome,
    'clientes', nullif(replace(m.pessoa_nome, '; ', ', '), ''), 'processo_numero', m.processo_numero,
    'arquivado', m.arquivado_em is not null, 'cancelado', privado.coluna_cancelada(m.etapa_id))
  from public.compromissos m left join public.salas s on s.id = m.sala_id
  where m.id = p_id and m.escritorio_id = p_escritorio
$$;

create function privado.agenda_da_tarefa(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'titulo', t.titulo, 'prazo', to_char(t.prazo, 'YYYY-MM-DD'), 'prazo_hora', to_char(t.prazo_hora, 'HH24:MI'),
    'responsavel_id', t.responsavel_id, 'participantes', to_jsonb(t.participantes), 'clientes', nullif(replace(t.pessoa_nome, '; ', ', '), ''),
    'processo_numero', x.numero, 'arquivado', t.arquivado_em is not null,
    'concluido', t.concluida_em is not null or coalesce(q.marco = 'concluido', false))
  from public.tarefas t left join public.processos x on x.id = t.processo_id left join public.quadro_colunas q on q.id = t.etapa_id
  where t.id = p_id and t.escritorio_id = p_escritorio
$$;

create function privado.agenda_da_demanda(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'titulo', d.titulo, 'prazo', to_char(d.prazo, 'YYYY-MM-DD'), 'prazo_hora', to_char(d.prazo_hora, 'HH24:MI'),
    'responsavel_id', d.responsavel_id, 'participantes', to_jsonb(d.colaboradores), 'clientes', nullif(replace(d.cliente_nome, '; ', ', '), ''),
    'processo_numero', null, 'arquivado', d.arquivado_em is not null, 'concluido', coalesce(q.marco = 'concluido', false))
  from public.demandas d left join public.quadro_colunas q on q.id = d.etapa_id
  where d.id = p_id and d.escritorio_id = p_escritorio
$$;

create function privado.agenda_do_dia(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'data', to_char(s.data, 'YYYY-MM-DD'), 'motivo', s.motivo, 'tipo', s.tipo, 'orgao', o.sigla)
  from public.dias_sem_expediente s left join public.orgaos o on o.id = s.orgao_id
  where s.id = p_id and s.escritorio_id = p_escritorio
$$;

create function privado.agenda_da_parcela(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'contrato_id', c.id, 'contrato_codigo', c.codigo, 'numero', p.numero, 'total', c.parcelas,
    'vencimento', to_char(p.vencimento, 'YYYY-MM-DD'), 'valor', p.valor, 'clientes', nullif(replace(c.cliente_nome, '; ', ', '), ''),
    'responsavel_id', c.responsavel_id, 'recebida', p.recebimento_id is not null or p.recebida_em is not null, 'excluida', p.excluido_em is not null)
  from public.contrato_parcelas p join public.contratos c on c.id = p.contrato_id
  where p.id = p_id and p.escritorio_id = p_escritorio
$$;

revoke execute on function privado.agenda_do_compromisso(uuid, uuid), privado.agenda_da_tarefa(uuid, uuid), privado.agenda_da_demanda(uuid, uuid),
  privado.agenda_do_dia(uuid, uuid), privado.agenda_da_parcela(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- Um pedido de evento (ItemDaFila em eventosGoogle.ts): o item como está, as agendas da conta ligada agora e as cópias do
-- item já gravadas nelas (as de outra conta, de antes de trocar a conta, ficam de fora).
create function public.agendas_google_item(p_escritorio uuid, p_assunto text, p_item uuid) returns jsonb
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
        'google_id', a.google_id) order by a.criada_em) from a), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('agenda_id', e.agenda_id, 'agenda_google_id', a.google_id, 'evento_id', e.evento_id,
        'assinatura', e.assinatura) order by a.criada_em) from public.agenda_google_eventos e join a on a.id = e.agenda_id
      where e.escritorio_id = p_escritorio and e.assunto = p_assunto and e.item_id = p_item), '[]'::jsonb)
  )
$$;

-- A cópia gravada no Google (nova ou mudada), com a assinatura do conteúdo.
create function public.agendas_google_evento_gravado(p_agenda uuid, p_assunto text, p_item uuid, p_evento text, p_assinatura text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agenda_google_eventos as e (agenda_id, escritorio_id, assunto, item_id, evento_id, assinatura)
  select a.id, a.escritorio_id, p_assunto, p_item, p_evento, p_assinatura from public.agendas_google a where a.id = p_agenda
  on conflict (agenda_id, evento_id) do update
    set assunto = excluded.assunto, item_id = excluded.item_id, assinatura = excluded.assinatura, gravado_em = now()
$$;

-- A cópia tirada do Google.
create function public.agendas_google_evento_apagado(p_agenda uuid, p_evento text) returns void
language sql security definer set search_path = '' as $$
  delete from public.agenda_google_eventos where agenda_id = p_agenda and evento_id = p_evento
$$;

revoke execute on function public.agendas_google_item(uuid, text, uuid), public.agendas_google_evento_gravado(uuid, text, uuid, text, text),
  public.agendas_google_evento_apagado(uuid, text) from public, anon, authenticated;
grant execute on function public.agendas_google_item(uuid, text, uuid), public.agendas_google_evento_gravado(uuid, text, uuid, text, text),
  public.agendas_google_evento_apagado(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- As funções da parte 1, refeitas (mesma assinatura, mesmo comportamento, mais o que é dito)
-- ---------------------------------------------------------------------

-- Como antes; e a agenda nova (ou a criada de novo, no lugar da que sumiu) recebe os itens em aberto que vão para ela. As
-- cópias da agenda velha, trocada, são esquecidas (ficaram nela).
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
    update public.agendas_google a set google_id = p_google, nome = p_nome, criada_em = now() where a.id = v_id;
  else
    insert into public.agendas_google (escritorio_id, conta_email, tipo, perfil_id, sala_id, google_id, nome)
    values (p_escritorio, lower(p_conta), p_tipo, p_perfil, p_sala, p_google, p_nome)
    returning id into v_id;
  end if;
  perform privado.agendas_google_enfileirar_abertos(p_escritorio, p_tipo, p_perfil, p_sala);
  return v_id;
end $$;

-- Como antes; e o escritório volta à fila das agendas, para a agenda ser criada de novo (quando ela some durante um
-- evento, e não durante o arrumar das agendas).
create or replace function public.agendas_google_agenda_sumiu(p_agenda uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  delete from public.agendas_google where id = p_agenda returning escritorio_id into v_escritorio;
  if v_escritorio is not null then perform privado.agendas_google_enfileirar(v_escritorio, 'agendas', null); end if;
end $$;

-- Como antes; e ligar põe na fila também os itens em aberto de hoje em diante (as agendas que já existem os recebem logo;
-- as novas, quando nascerem).
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
    perform privado.agendas_google_enfileirar(v.escritorio_id, 'agendas', null);
    perform privado.agendas_google_enfileirar_abertos(v.escritorio_id, null, null, null);
  else
    delete from public.agendas_google_fila f where f.escritorio_id = v.escritorio_id;
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'ligacoes', v.id::text, 'alteracao', jsonb_build_object('email', v.conta_email, 'agendas', v.agendas_ativas), auth.uid());
end $$;
