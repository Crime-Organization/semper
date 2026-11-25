-- =====================================================================
-- Agendas do escritório no Google Agenda (#166): as despesas do escritório a pagar (#439) na agenda Administrativo
--   Combinado com o dono (25/11/2026): a despesa a pagar vai SÓ para a Administrativo (a dos administradores), no dia útil
--   ANTERIOR ao vencimento (fim de semana, feriado nacional de data fixa e os dias sem expediente que o escritório lançou no
--   Calendário para todos os órgãos não são úteis), com a descrição, o valor e o link para a despesa no Financeiro. Paga ou
--   excluída: sai do Google (como a parcela recebida). O dia útil anterior é contado pela função pura diaUtilAnterior
--   (supabase/functions/_compartilhado/diaUtilAnterior.ts), a mesma regra do site: o banco só entrega a despesa e os dias
--   lançados antes do vencimento (privado.agenda_da_despesa), e eventosGoogle.ts monta o evento.
--   - A fila e as cópias gravadas ganham o assunto 'despesa' (a regra fica mais larga).
--   - Gatilhos: a despesa criada (também as datas da repetição que nascem sozinhas), mudada na descrição, no valor, no
--     vencimento, paga, desfeita, excluída ou restaurada entra na fila. Um dia sem expediente lançado, mudado ou apagado
--     para todos os órgãos põe na fila as despesas a pagar cujo dia útil anterior pode ter mudado com ele (as que vencem de
--     hoje em diante, ou as que já têm cópia no Google).
--   - Ligar as agendas e nascer a Administrativo põem na fila as despesas a pagar de hoje em diante (o passado não vai).
--   Os repasses e as indicações a pagar (financeiro_repasses) não têm data de vencimento (só o dia em que foram pagos):
--   ficam de fora, como o dono deixou ("se tiverem data").
--   Só acrescenta: a regra do assunto fica mais larga, uma função e gatilhos novos, e duas funções refeitas com a mesma
--   assinatura e o mesmo comportamento, mais a despesa. A versão anterior do site continua funcionando: ela não usa nada disto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- O assunto novo (o mesmo AssuntoDoEvento de _compartilhado/eventosGoogle.ts)
-- ---------------------------------------------------------------------
alter table public.agendas_google_fila drop constraint agendas_google_fila_assunto_check;
alter table public.agendas_google_fila add constraint agendas_google_fila_assunto_check
  check (assunto in ('agendas', 'compromisso', 'tarefa', 'demanda', 'dia', 'parcela', 'despesa'));
alter table public.agenda_google_eventos drop constraint agenda_google_eventos_assunto_check;
alter table public.agenda_google_eventos add constraint agenda_google_eventos_assunto_check
  check (assunto in ('compromisso', 'tarefa', 'demanda', 'dia', 'parcela', 'despesa'));

-- ---------------------------------------------------------------------
-- A despesa como está (DespesaNaAgenda em eventosGoogle.ts)
-- ---------------------------------------------------------------------
-- Null se a despesa não existe ou é de outro escritório. dias_sem_expediente: os dias lançados pelo escritório nos 367 dias
-- antes do vencimento (a véspera e os DIAS_PARA_TRAS = 366 para trás dela, em diaUtilAnterior.ts), com o tipo e o órgão; a
-- função pura escolhe os que fecham (os de todos os órgãos, feriado ou suspensão).
create function privado.agenda_da_despesa(p_escritorio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'descricao', d.descricao, 'valor', d.valor, 'vencimento', to_char(d.vencimento, 'YYYY-MM-DD'),
    'paga', d.paga_em is not null, 'excluida', d.excluida_em is not null,
    'dias_sem_expediente', coalesce((
      select jsonb_agg(jsonb_build_object('data', to_char(s.data, 'YYYY-MM-DD'), 'tipo', s.tipo, 'orgao_id', s.orgao_id) order by s.data, s.orgao_id nulls first)
      from public.dias_sem_expediente s
      where s.escritorio_id = p_escritorio and s.data between d.vencimento - 367 and d.vencimento - 1), '[]'::jsonb))
  from public.financeiro_despesas d
  where d.id = p_id and d.escritorio_id = p_escritorio
$$;
revoke execute on function privado.agenda_da_despesa(uuid, uuid) from public, anon, authenticated;

-- Como antes (20261125143159_reunioes_google.sql); e a despesa.
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
      when 'parcela' then privado.agenda_da_parcela(p_escritorio, p_item)
      when 'despesa' then privado.agenda_da_despesa(p_escritorio, p_item) end,
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
-- Os itens em aberto, na fila
-- ---------------------------------------------------------------------
-- Como antes (20261125110831_agendas_google_eventos.sql); e as despesas a pagar (nem pagas, nem excluídas) que vencem de
-- hoje em diante, ao ligar as agendas (sem p_tipo) e ao nascer a Administrativo ('administrativo').
create or replace function privado.agendas_google_enfileirar_abertos(p_escritorio uuid, p_tipo text, p_perfil uuid, p_sala uuid) returns void
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
    union all
    select 'despesa', g.id from public.financeiro_despesas g
    where g.escritorio_id = p_escritorio and g.vencimento >= v_hoje and g.paga_em is null and g.excluida_em is null
      and (p_tipo is null or p_tipo = 'administrativo')
  ) x
  on conflict (escritorio_id, assunto, item_id) do update
    set versao = f.versao + 1, pedido_em = now(),
        tentativas = case when f.erro = 'recusado' then 0 else f.tentativas end,
        proxima_em = case when f.erro = 'recusado' then now() else f.proxima_em end;
end $$;

-- ---------------------------------------------------------------------
-- Os gatilhos
-- ---------------------------------------------------------------------

-- A despesa: criada (também as datas que a repetição gera), mudada no que vai ao Google, paga ou desfeita, excluída ou
-- restaurada. A exclusão de verdade (só junto com o escritório inteiro) segue a regra de agendas_google_do_item.
create trigger agendas_google_novo after insert on public.financeiro_despesas
  for each row execute function privado.agendas_google_do_item('despesa');
create trigger agendas_google_mudou after update on public.financeiro_despesas
  for each row when ((old.descricao, old.valor, old.vencimento, old.paga_em, old.excluida_em)
                     is distinct from (new.descricao, new.valor, new.vencimento, new.paga_em, new.excluida_em))
  execute function privado.agendas_google_do_item('despesa');
create trigger agendas_google_excluido after delete on public.financeiro_despesas
  for each row execute function privado.agendas_google_do_item('despesa');

-- As despesas a pagar cujo dia útil anterior pode depender do dia p_dia: as que vencem depois dele, até o primeiro dia útil
-- seguinte (inclusive). Mais adiante, a procura para trás para antes de chegar a p_dia (o dia útil do meio basta). Procura
-- no máximo 366 dias adiante (DIAS_PARA_TRAS em diaUtilAnterior.ts). Como ao ligar, o passado não vai: só as que vencem de
-- hoje em diante, ou as que já têm cópia no Google (para a cópia ficar em dia).
create function privado.agendas_google_despesas_perto_do_dia(p_escritorio uuid, p_dia date) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ate date := p_dia + 1; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v uuid;
begin
  while not privado.dia_util_do_escritorio(p_escritorio, v_ate) and v_ate < p_dia + 366 loop
    v_ate := v_ate + 1;
  end loop;
  for v in select g.id from public.financeiro_despesas g
           where g.escritorio_id = p_escritorio and g.vencimento > p_dia and g.vencimento <= v_ate and g.paga_em is null and g.excluida_em is null
             and (g.vencimento >= v_hoje or exists (select 1 from public.agenda_google_eventos e
                                                    where e.escritorio_id = p_escritorio and e.assunto = 'despesa' and e.item_id = g.id)) loop
    perform privado.agendas_google_enfileirar(p_escritorio, 'despesa', v);
  end loop;
end $$;
revoke execute on function privado.agendas_google_despesas_perto_do_dia(uuid, date) from public, anon, authenticated;

-- O dia sem expediente lançado, mudado ou apagado que fecha o escritório (para todos os órgãos, feriado ou suspensão, os
-- TIPOS_QUE_FECHAM de diaUtilAnterior.ts), antes ou depois da mudança: as despesas perto dele vão de novo. O escritório que
-- está sendo excluído inteiro fica de fora.
create function privado.agendas_google_despesas_do_dia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'DELETE' then
    if new.orgao_id is null and new.tipo in ('feriado', 'suspensao') then
      perform privado.agendas_google_despesas_perto_do_dia(new.escritorio_id, new.data);
    end if;
  end if;
  if tg_op <> 'INSERT' then
    if old.orgao_id is null and old.tipo in ('feriado', 'suspensao') and exists (select 1 from public.escritorios s where s.id = old.escritorio_id) then
      perform privado.agendas_google_despesas_perto_do_dia(old.escritorio_id, old.data);
    end if;
  end if;
  return null;
end $$;
revoke execute on function privado.agendas_google_despesas_do_dia() from public, anon, authenticated;
create trigger agendas_google_despesas after insert or delete on public.dias_sem_expediente
  for each row execute function privado.agendas_google_despesas_do_dia();
create trigger agendas_google_despesas_mudou after update on public.dias_sem_expediente
  for each row when ((old.data, old.tipo, old.orgao_id) is distinct from (new.data, new.tipo, new.orgao_id))
  execute function privado.agendas_google_despesas_do_dia();
