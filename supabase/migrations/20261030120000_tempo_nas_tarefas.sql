-- =====================================================================
-- Tempo nas tarefas (cronômetro)
--   Cada pessoa conta o próprio tempo em cada tarefa: o cronômetro do
--   cartão grava períodos contados (que só crescem, enquanto ainda estão
--   sendo contados) e ajustes feitos à mão, com motivo, que ficam
--   registrados como ajuste. O total da tarefa é a soma de todos.
--   - Quem vê: cada um vê só os próprios registros; os administradores
--     veem os de todos (e só das tarefas que veem).
--   - Para quem não é administrador, resumo_do_tempo() dá o total da
--     equipe e a parte de cada um em %, sem as durações de cada um.
--   - tempo_da_demanda(): a soma do tempo das tarefas de uma demanda (o
--     esforço aproximado dela).
--   - tarefas.concluida_em: quando a tarefa chegou à coluna-marco das
--     concluídas (para o "tempo da criação à conclusão"); sai de lá, apaga.
--
--   Só acrescenta (tabela, funções, regras e a coluna concluida_em). A
--   função do histórico das tarefas é trocada por outra que deixa
--   concluida_em de fora. A versão anterior do site continua funcionando.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quando a tarefa foi concluída.
-- ---------------------------------------------------------------------
alter table public.tarefas add column concluida_em timestamptz;

create function privado.marcar_conclusao_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_concluida boolean;
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then return new; end if;
  select coalesce(c.marco = 'concluido', false) into v_concluida from public.quadro_colunas c where c.id = new.etapa_id;
  if coalesce(v_concluida, false) then
    if tg_op = 'INSERT' or new.concluida_em is null then new.concluida_em := now(); end if;
  else
    new.concluida_em := null;
  end if;
  return new;
end $$;
create trigger conclusao before insert or update of etapa_id on public.tarefas
  for each row execute function privado.marcar_conclusao_da_tarefa();
-- As tarefas que já estão na coluna das concluídas ganham a data da última vez que foram mexidas.
update public.tarefas t set concluida_em = t.atualizado_em
from public.quadro_colunas c where c.id = t.etapa_id and c.marco = 'concluido' and t.concluida_em is null;

-- O histórico deixa de fora a data de conclusão (a mudança de coluna já aparece nele).
create or replace function privado.historico_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'concluida_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'demanda_id' then jsonb_build_object('demanda', jsonb_build_object('de', old.demanda_codigo, 'para', new.demanda_codigo))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Os registros de tempo.
-- ---------------------------------------------------------------------
create table public.tarefa_tempos (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  tarefa_id     uuid not null references public.tarefas on delete cascade,
  perfil_id     uuid default auth.uid() references public.perfis on delete set null,   -- usuário removido: o tempo fica, sem dono
  inicio        timestamptz not null default now(),   -- quando o período começou a ser contado (no ajuste, quando foi feito)
  segundos      integer not null,
  ajuste        boolean not null default false,
  motivo        text,
  criado_em     timestamptz not null default now(),
  -- Contado pelo cronômetro: de 0 a 12 horas por período (SEGMENTO_MAXIMO em limites.ts), sem motivo.
  constraint tempo_contado check (ajuste or (segundos between 0 and 43200 and motivo is null)),
  -- Ajuste à mão: de -24 a +24 horas (AJUSTE_MAXIMO), diferente de zero, sempre com motivo (TAMANHO_MOTIVO).
  constraint tempo_ajustado check (not ajuste or (segundos between -86400 and 86400 and segundos <> 0
                                                  and btrim(coalesce(motivo, '')) <> '' and length(motivo) <= 300))
);
create index tarefa_tempos_tarefa on public.tarefa_tempos (tarefa_id, perfil_id);
create index tarefa_tempos_pessoa on public.tarefa_tempos (perfil_id, inicio);

-- O período contado só cresce, e só enquanto é recente: depois, corrigir é com um ajuste (que fica registrado).
create function privado.conferir_tempo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.segundos < old.segundos then raise exception 'O tempo contado não diminui: para corrigir, faça um ajuste.'; end if;
  if old.criado_em < now() - interval '1 day' then raise exception 'Este período já foi fechado: para corrigir, faça um ajuste.'; end if;
  return new;
end $$;
create trigger conferir before update on public.tarefa_tempos for each row execute function privado.conferir_tempo();

alter table public.tarefa_tempos enable row level security;
revoke all on public.tarefa_tempos from anon;
revoke update, delete on public.tarefa_tempos from authenticated;
grant update (segundos) on public.tarefa_tempos to authenticated;

create policy leitura on public.tarefa_tempos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (perfil_id = (select auth.uid()) or (select privado.sou_admin()))
         and exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy incluir on public.tarefa_tempos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid())
              and exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy alterar on public.tarefa_tempos for update to authenticated
  using (perfil_id = (select auth.uid()) and not ajuste)
  with check (perfil_id = (select auth.uid()) and not ajuste);

-- ---------------------------------------------------------------------
-- Resumos (para quem vê a tarefa ou a demanda, sem abrir as durações).
-- ---------------------------------------------------------------------
-- O total da equipe na tarefa e a parte de cada um, em %, de quem tem tempo nela.
create function public.resumo_do_tempo(p_tarefa uuid)
returns table (perfil_id uuid, percentual numeric, total bigint)
language sql stable security definer set search_path = '' as $$
  with visivel as (
    select t.id from public.tarefas t
    where t.id = p_tarefa and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)
  ), por_pessoa as (
    select tt.perfil_id, sum(tt.segundos)::bigint as s from public.tarefa_tempos tt join visivel v on v.id = tt.tarefa_id group by tt.perfil_id
  ), soma as (select coalesce(sum(greatest(s, 0)), 0)::bigint as total from por_pessoa)
  select p.perfil_id, round(100.0 * p.s / soma.total, 1), soma.total
  from por_pessoa p, soma where p.s > 0 and soma.total > 0
  order by 2 desc
$$;
revoke execute on function public.resumo_do_tempo(uuid) from public, anon;
grant execute on function public.resumo_do_tempo(uuid) to authenticated;

-- A soma do tempo das tarefas de uma demanda (o esforço aproximado dela).
create function public.tempo_da_demanda(p_demanda uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select greatest(coalesce(sum(tt.segundos), 0), 0)::bigint
  from public.demandas d
  join public.tarefas t on t.demanda_id = d.id
  join public.tarefa_tempos tt on tt.tarefa_id = t.id
  where d.id = p_demanda and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)
$$;
revoke execute on function public.tempo_da_demanda(uuid) from public, anon;
grant execute on function public.tempo_da_demanda(uuid) to authenticated;
