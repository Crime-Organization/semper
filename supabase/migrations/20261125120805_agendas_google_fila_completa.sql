-- =====================================================================
-- Agendas do escritório no Google Agenda (#166): nada que muda no SEMPER fica para trás no Google (correções da revisão).
--   - Ligar as agendas de novo põe na fila também cada item que tem cópia gravada no Google (agenda_google_eventos) nas
--     agendas da conta ligada, qualquer que seja a data ou o estado dele. Antes, desligar (ou desligar a conta) esvaziava a
--     fila e, ao ligar, só entravam os itens em aberto de hoje em diante: o compromisso excluído, arquivado ou cancelado, a
--     tarefa concluída ou a parcela recebida enquanto as agendas estavam desligadas continuava no Google para sempre. Agora
--     a função do servidor lê o item como está e tira as cópias do que não deve mais estar lá.
--   - O item excluído entra na fila também quando já há um pedido dele na fila (não só quando já tem cópia gravada). Antes,
--     se a pessoa excluía o item enquanto a função do servidor gravava a primeira cópia, nada subia a versão do pedido, o
--     concluir o apagava e o evento ficava órfão no Google.
--   - Renomear uma coluna do quadro (para "Cancelado", por exemplo) ou mudar o marco dela (para 'concluido') põe na fila os
--     compromissos, tarefas e demandas daquela coluna que ainda vão (de hoje em diante) ou já foram ao Google (têm cópia).
--   Só acrescenta: uma função nova, um gatilho novo e duas funções refeitas com a mesma assinatura e o mesmo
--   comportamento, mais o que é dito acima. A versão anterior do site continua funcionando: ela não usa nada disto.
-- =====================================================================

-- Põe na fila cada item que tem cópia gravada nas agendas da conta ligada do escritório (só com as agendas ligadas).
create function privado.agendas_google_enfileirar_copias(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  for v in select distinct e.assunto, e.item_id
           from public.agenda_google_eventos e
           join public.agendas_google a on a.id = e.agenda_id
           join privado.ligacoes l on l.escritorio_id = a.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = a.conta_email
           where e.escritorio_id = p_escritorio loop
    perform privado.agendas_google_enfileirar(p_escritorio, v.assunto, v.item_id);
  end loop;
end $$;
revoke execute on function privado.agendas_google_enfileirar_copias(uuid) from public, anon, authenticated;

-- Como antes (20261125115138_agendas_google_recusas.sql); e ligar põe na fila também os itens que já têm cópia no Google.
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
    perform privado.agendas_google_enfileirar_copias(v.escritorio_id);
  else
    delete from public.agendas_google_fila f where f.escritorio_id = v.escritorio_id;
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'ligacoes', v.id::text, 'alteracao', jsonb_build_object('email', v.conta_email, 'agendas', v.agendas_ativas), auth.uid());
end $$;

-- Como antes (20261125110831_agendas_google_eventos.sql); e o item excluído entra na fila também quando já há um pedido
-- dele na fila (a função do servidor pode estar gravando a primeira cópia agora: a versão sobe e o pedido não é apagado).
create or replace function privado.agendas_google_do_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if (exists (select 1 from public.agenda_google_eventos e
                where e.escritorio_id = old.escritorio_id and e.assunto = tg_argv[0] and e.item_id = old.id)
        or exists (select 1 from public.agendas_google_fila f
                   where f.escritorio_id = old.escritorio_id and f.assunto = tg_argv[0] and f.item_id = old.id))
       and exists (select 1 from public.escritorios s where s.id = old.escritorio_id) then
      perform privado.agendas_google_enfileirar(old.escritorio_id, tg_argv[0], old.id);
    end if;
  else
    perform privado.agendas_google_enfileirar(new.escritorio_id, tg_argv[0], new.id);
  end if;
  return null;
end $$;

-- A coluna do quadro renomeada ou com o marco mudado: o nome diz se o compromisso está cancelado (privado.coluna_cancelada)
-- e o marco 'concluido' tira a tarefa e a demanda do Google. Põe na fila os itens da coluna que ainda vão (de hoje em diante,
-- no relógio de Brasília) ou que já foram ao Google (têm cópia).
create function privado.agendas_google_da_coluna() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v record;
begin
  for v in
    select 'compromisso'::text as assunto, m.id from public.compromissos m
    where m.etapa_id = new.id and m.escritorio_id = new.escritorio_id and m.data >= v_hoje
    union
    select 'tarefa', t.id from public.tarefas t
    where t.etapa_id = new.id and t.escritorio_id = new.escritorio_id and t.prazo >= v_hoje
    union
    select 'demanda', d.id from public.demandas d
    where d.etapa_id = new.id and d.escritorio_id = new.escritorio_id and d.prazo >= v_hoje
    union
    select e.assunto, e.item_id from public.agenda_google_eventos e
    where e.escritorio_id = new.escritorio_id and e.assunto in ('compromisso', 'tarefa', 'demanda')
      and e.item_id in (select m.id from public.compromissos m where m.etapa_id = new.id
                        union all select t.id from public.tarefas t where t.etapa_id = new.id
                        union all select d.id from public.demandas d where d.etapa_id = new.id)
  loop
    perform privado.agendas_google_enfileirar(new.escritorio_id, v.assunto, v.id);
  end loop;
  return null;
end $$;
revoke execute on function privado.agendas_google_da_coluna() from public, anon, authenticated;
create trigger agendas_google_itens after update of nome, marco on public.quadro_colunas
  for each row when ((old.nome, old.marco) is distinct from (new.nome, new.marco)) execute function privado.agendas_google_da_coluna();
