-- =====================================================================
-- Demanda que nasce do compromisso que se repete (#307, parte B)
--   - A repetição pode "gerar demanda N dias antes" (compromisso_repeticoes.demanda_dias_antes, de 1 a 365: DEMANDA_DO_COMPROMISSO em
--     app/src/dados/limites.ts). Para cada data da série, N dias corridos antes, nasce uma demanda para o trabalho daquela vez. Se esse dia
--     cair num fim de semana, num feriado nacional ou num dia sem expediente que o escritório lançou no Calendário para todos os órgãos,
--     a demanda nasce no dia útil anterior (privado.dia_da_demanda; a mesma conta de diaDaDemanda em app/src/regras/demandaDoCompromisso.ts).
--   - A demanda leva o título do compromisso com a data ("Reunião mensal (10/12/2026)"), prazo na data e na hora do compromisso, o
--     responsável dele (se saiu da equipe, quem criou a repetição), os participantes como colaboradores, as pessoas como clientes, os
--     grupos da equipe e o contrato ligado ao compromisso (o primeiro, se houver mais de um). Fica ligada ao compromisso (compromisso_ligacoes)
--     e entra na coluna de início do quadro de demandas. Os avisos de prazo que já existem valem para ela, como para qualquer demanda.
--   - Cada data gera no máximo uma demanda (compromissos.demanda_gerada_em): a rotina pode rodar duas vezes ou perder um dia, e a demanda
--     excluída não volta. Só gera para a data ainda em aberto (nem realizada, nem cancelada, nem arquivada), de hoje em diante, e só no
--     escritório com o módulo Demandas ligado.
--   - O responsável da demanda recebe o aviso na caixa de Mensagens (mensagens_de_compromisso): a demanda nova; a data do compromisso que
--     mudou (o prazo da demanda acompanha, se ainda era a data antiga, e o título também, se ainda era o que nasceu com ela); e o compromisso
--     cancelado (posto na coluna "Cancelado" ou arquivado sem ter sido realizado): a demanda fica, e ele decide o que fazer. Ninguém recebe
--     aviso do que fez a si mesmo, e só recebe quem está ativo no escritório.
--   - Uma rotina diária (gerar-demandas-dos-compromissos, às 5h30 de Brasília, depois de estender-repeticoes e antes dos avisos de prazo das
--     6h55) cria as demandas do dia. Marcar a repetição para gerar demanda (compromisso_gerar_demandas) já cria as que estão no prazo.
--   - As datas novas da série não copiam a ligação com a demanda que nasceu de outra data (privado.gerar_repeticoes, trocada).
--
--   Só acrescenta: uma tabela, colunas sem regra que obrigue preenchê-las, funções, gatilhos e uma rotina; duas funções trocadas fazem o
--   mesmo de antes, com um cuidado a mais (gerar_repeticoes não copia a ligação com a demanda gerada; o histórico do compromisso não anota
--   as colunas novas). A versão anterior do site continua funcionando: ela não conhece as colunas nem a tabela nova (a caixa dela não mostra
--   esses avisos), grava os compromissos sem as colunas novas e vê a demanda gerada como qualquer demanda.
-- =====================================================================

-- 1. As colunas.
alter table public.compromisso_repeticoes
  add column demanda_dias_antes smallint check (demanda_dias_antes between 1 and 365);   -- DEMANDA_DO_COMPROMISSO.diasMaximos
alter table public.compromissos
  add column demanda_gerada_id uuid references public.demandas on delete set null,       -- a demanda que nasceu desta data
  add column demanda_gerada_em timestamptz;                                              -- quando: a data já gerou a sua (mesmo excluída)
create index compromissos_demanda_gerada on public.compromissos (demanda_gerada_id) where demanda_gerada_id is not null;
create index compromissos_para_gerar_demanda on public.compromissos (repeticao_id, data) where repeticao_id is not null and demanda_gerada_em is null;

-- 2. O dia útil do escritório: nem sábado, nem domingo, nem feriado nacional (os de data fixa, como feriadosNacionais em
-- app/src/regras/prazos.ts), nem um dia sem expediente lançado pelo escritório para todos os órgãos (feriado ou suspensão que fecha o
-- fórum; a suspensão só de prazos tem expediente). Os dias lançados para um órgão só valem nos prazos dos processos dele.
create function privado.feriado_nacional(p_dia date) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select to_char(p_dia, 'MM-DD') in ('01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25')
$$;

create function privado.dia_util_do_escritorio(p_escritorio uuid, p_dia date) returns boolean
language sql stable security definer set search_path = '' as $$
  select extract(isodow from p_dia) < 6 and not privado.feriado_nacional(p_dia)
     and not exists (select 1 from public.dias_sem_expediente d
                     where d.escritorio_id = p_escritorio and d.data = p_dia and d.orgao_id is null and d.tipo in ('feriado', 'suspensao'))
$$;
revoke execute on function privado.dia_util_do_escritorio(uuid, date) from public, anon, authenticated;

-- O dia em que a demanda nasce: N dias corridos antes da data do compromisso, recuando ao dia útil anterior. Procura no máximo um ano
-- para trás (DIAS_SEM_CONTAR_SEGUIDOS em app/src/regras/prazos.ts); sem dia útil nenhum, fica no dia contado.
create function privado.dia_da_demanda(p_escritorio uuid, p_data date, p_dias integer) returns date
language plpgsql stable security definer set search_path = '' as $$
declare v_dia date := p_data - p_dias; v_i integer := 0;
begin
  while not privado.dia_util_do_escritorio(p_escritorio, v_dia - v_i) loop
    v_i := v_i + 1;
    if v_i > 366 then return v_dia; end if;
  end loop;
  return v_dia - v_i;
end $$;
revoke execute on function privado.dia_da_demanda(uuid, date, integer) from public, anon, authenticated;

-- O título da demanda: o do compromisso com a data, cortado para caber no da demanda (TAMANHO_DEMANDA.titulo; tituloDaDemanda no app).
create function privado.titulo_da_demanda_do_compromisso(p_titulo text, p_data date) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(p_titulo), 300 - 13) || ' (' || to_char(p_data, 'DD/MM/YYYY') || ')'
$$;

-- 3. Os avisos, na caixa de Mensagens de cada um. Uma tabela própria, como os avisos de inclusão: a versão anterior do site não a lê.
-- O que a caixa mostra da demanda e do compromisso vem deles, pelas regras de leitura de cada um (quem não os vê mais não lê o título).
create table public.mensagens_de_compromisso (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  perfil_id      uuid not null references public.perfis on delete cascade,             -- quem recebe: o responsável da demanda
  aviso          text not null check (aviso in ('demanda_nova', 'data_mudou', 'cancelado')),
  demanda_id     uuid not null references public.demandas on delete cascade,
  compromisso_id uuid references public.compromissos on delete set null,
  data_antes     date,                                                                   -- no "data_mudou": a data de antes
  data_nova      date,                                                                   -- a data do compromisso quando o aviso nasceu
  criado_em      timestamptz not null default now(),
  lido_em        timestamptz
);
create index mensagens_de_compromisso_da_pessoa on public.mensagens_de_compromisso (perfil_id, criado_em desc);
create index mensagens_de_compromisso_nao_lidas on public.mensagens_de_compromisso (perfil_id) where lido_em is null;
create index mensagens_de_compromisso_escritorio on public.mensagens_de_compromisso (escritorio_id);
create index mensagens_de_compromisso_demanda on public.mensagens_de_compromisso (demanda_id);
create index mensagens_de_compromisso_compromisso on public.mensagens_de_compromisso (compromisso_id) where compromisso_id is not null;

-- O mesmo desenho da caixa: cada pessoa só vê e marca como lidas as suas; quem cria é o banco.
alter table public.mensagens_de_compromisso enable row level security;
revoke all on public.mensagens_de_compromisso from anon;
revoke insert, update, delete, truncate, references, trigger on public.mensagens_de_compromisso from authenticated;
grant update (lido_em) on public.mensagens_de_compromisso to authenticated;
create policy leitura on public.mensagens_de_compromisso for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));
create policy alterar on public.mensagens_de_compromisso for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- Quem é excluído da equipe perde os avisos dele, como as outras mensagens.
create function privado.mensagens_de_compromisso_de_quem_saiu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mensagens_de_compromisso m where m.perfil_id = new.id;
  return null;
end $$;
revoke execute on function privado.mensagens_de_compromisso_de_quem_saiu() from public, anon, authenticated;
create trigger mensagens_de_compromisso_de_quem_saiu after update of excluido_em on public.perfis
  for each row when (old.excluido_em is null and new.excluido_em is not null) execute function privado.mensagens_de_compromisso_de_quem_saiu();

-- Avisa o responsável da demanda: só quem está ativo no escritório, e não quem fez a mudança.
create function privado.avisar_da_demanda_do_compromisso(p_demanda uuid, p_compromisso uuid, p_aviso text, p_antes date, p_nova date)
returns void
language sql security definer set search_path = '' as $$
  insert into public.mensagens_de_compromisso (escritorio_id, perfil_id, aviso, demanda_id, compromisso_id, data_antes, data_nova)
  select d.escritorio_id, f.id, p_aviso, d.id, p_compromisso, p_antes, p_nova
  from public.demandas d join public.perfis f on f.id = d.responsavel_id and f.escritorio_id = d.escritorio_id
  where d.id = p_demanda and f.ativo and not f.reservada and f.excluido_em is null and f.id is distinct from auth.uid()
$$;
revoke execute on function privado.avisar_da_demanda_do_compromisso(uuid, uuid, text, date, date) from public, anon, authenticated;

-- Quem está ativo na equipe do escritório (sem a conta reservada e sem quem foi excluído).
create function privado.ativo_no_escritorio(p_perfil uuid, p_escritorio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis f
                 where f.id = p_perfil and f.escritorio_id = p_escritorio and f.ativo and not f.reservada and f.excluido_em is null)
$$;
revoke execute on function privado.ativo_no_escritorio(uuid, uuid) from public, anon, authenticated;

-- 4. Gerar a demanda de uma data. Devolve a demanda criada, ou null se a data não gera (já gerou, não está em aberto, já passou, a
-- repetição não gera demanda, o módulo está desligado, o dia de nascer ainda não chegou, ou não há ninguém ativo para ser o responsável).
create function privado.gerar_demanda_do_compromisso(p_compromisso uuid, p_hoje date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.compromissos; r public.compromisso_repeticoes; v_responsavel uuid; v_contrato uuid; v_inicio uuid; v_id uuid;
begin
  select * into c from public.compromissos where id = p_compromisso for update;
  select * into r from public.compromisso_repeticoes where id = c.repeticao_id;
  if c.id is null or r.id is null or r.demanda_dias_antes is null or c.demanda_gerada_em is not null or c.data < p_hoje
     or not privado.compromisso_em_aberto(c.etapa_id, c.arquivado_em)
     or not exists (select 1 from public.escritorios e where e.id = c.escritorio_id and e.modulos ->> 'demandas' = 'true')
     or privado.dia_da_demanda(c.escritorio_id, c.data, r.demanda_dias_antes) > p_hoje then
    return null;
  end if;
  -- O responsável do compromisso; se ele saiu da equipe, quem criou a repetição.
  v_responsavel := case when privado.ativo_no_escritorio(c.responsavel_id, c.escritorio_id) then c.responsavel_id
                        when privado.ativo_no_escritorio(r.criado_por, c.escritorio_id) then r.criado_por end;
  if v_responsavel is null then
    return null;
  end if;
  select l.contrato_id into v_contrato from public.compromisso_ligacoes l
  where l.compromisso_id = c.id and l.contrato_id is not null order by l.id limit 1;
  select q.id into v_inicio from public.quadro_colunas q
  where q.escritorio_id = c.escritorio_id and q.modulo = 'demandas' and q.marco = 'inicio' order by q.ordem limit 1;

  insert into public.demandas (escritorio_id, titulo, prazo, prazo_hora, responsavel_id, colaboradores, clientes, grupos, contrato_id,
                               etapa_id, etapa_ordem, criado_por)
  values (c.escritorio_id,
          privado.titulo_da_demanda_do_compromisso(coalesce(nullif(btrim(c.titulo), ''), 'Compromisso'), c.data),
          c.data, c.hora, v_responsavel,
          -- os participantes que ainda estão ativos na equipe
          array(select x from unnest(c.participantes) x where privado.ativo_no_escritorio(x, c.escritorio_id)),
          c.pessoas, c.grupos, v_contrato, v_inicio, extract(epoch from clock_timestamp()), coalesce(r.criado_por, c.criado_por))
  returning id into v_id;
  update public.compromissos set demanda_gerada_id = v_id, demanda_gerada_em = now() where id = c.id;
  if (select count(*) from public.compromisso_ligacoes l where l.compromisso_id = c.id) < 30 then
    insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por) values (c.id, v_id, coalesce(auth.uid(), r.criado_por));
  end if;
  perform privado.avisar_da_demanda_do_compromisso(v_id, c.id, 'demanda_nova', null, c.data);
  return v_id;
end $$;
revoke execute on function privado.gerar_demanda_do_compromisso(uuid, date) from public, anon, authenticated;

-- As demandas de uma série (ou de todas, com null) que já estão no prazo de nascer. Uma data com problema não impede as outras.
create function privado.gerar_demandas_das_series(p_serie uuid, p_hoje date) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare x record; v_id uuid; v_ids uuid[] := '{}';
begin
  for x in select c.id from public.compromissos c join public.compromisso_repeticoes r on r.id = c.repeticao_id
           where (p_serie is null or r.id = p_serie) and r.demanda_dias_antes is not null and c.demanda_gerada_em is null
             and c.arquivado_em is null and c.data >= p_hoje
           order by c.data, c.id loop
    begin
      v_id := privado.gerar_demanda_do_compromisso(x.id, p_hoje);
      if v_id is not null then v_ids := v_ids || v_id; end if;
    exception when others then
      raise warning 'A demanda do compromisso % não foi gerada: %', x.id, sqlerrm;
    end;
  end loop;
  return v_ids;
end $$;
revoke execute on function privado.gerar_demandas_das_series(uuid, date) from public, anon, authenticated;

-- A rotina diária.
create function privado.gerar_demandas_dos_compromissos() returns integer
language sql security definer set search_path = '' as $$
  select cardinality(privado.gerar_demandas_das_series(null, privado.hoje_da_agenda()))
$$;
revoke execute on function privado.gerar_demandas_dos_compromissos() from public, anon, authenticated;
select cron.schedule('gerar-demandas-dos-compromissos', '30 8 * * *', 'select privado.gerar_demandas_dos_compromissos()');

-- 5. Para a tela: marca a repetição do compromisso para gerar demanda N dias antes (null: não gera mais). Quem muda o compromisso, com o
-- módulo Demandas ligado. Devolve as demandas que já nasceram (as das datas que já estão no prazo).
create function public.compromisso_gerar_demandas(p_id uuid, p_dias integer) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare c public.compromissos;
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio();
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Só o compromisso que se repete gera demanda.';
  end if;
  if p_dias is not null and not exists (select 1 from public.escritorios e where e.id = c.escritorio_id and e.modulos ->> 'demandas' = 'true') then
    raise exception 'O módulo Demandas não está ligado neste escritório.';
  end if;
  update public.compromisso_repeticoes set demanda_dias_antes = p_dias, atualizado_em = now() where id = c.repeticao_id;
  if p_dias is null then return '{}'; end if;
  return privado.gerar_demandas_das_series(c.repeticao_id, privado.hoje_da_agenda());
end $$;
revoke execute on function public.compromisso_gerar_demandas(uuid, integer) from public, anon;
grant execute on function public.compromisso_gerar_demandas(uuid, integer) to authenticated;

-- 6. A demanda acompanha o compromisso: a data mudada (o prazo e o título, se ainda eram os de quando ela nasceu) e o compromisso
-- cancelado (na coluna "Cancelado" ou arquivado sem ter sido realizado). Vale para toda forma de mudar (a tela, "esta e as seguintes",
-- a versão anterior do site), porque é um gatilho.
create function privado.demanda_acompanha_o_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.data is distinct from old.data or new.hora is distinct from old.hora then
    update public.demandas d
       set prazo = case when d.prazo = old.data then new.data else d.prazo end,
           prazo_hora = case when d.prazo = old.data and d.prazo_hora is not distinct from old.hora then new.hora else d.prazo_hora end,
           titulo = case when new.data is distinct from old.data
                          and d.titulo = privado.titulo_da_demanda_do_compromisso(coalesce(nullif(btrim(old.titulo), ''), 'Compromisso'), old.data)
                         then privado.titulo_da_demanda_do_compromisso(coalesce(nullif(btrim(new.titulo), ''), 'Compromisso'), new.data)
                         else d.titulo end
     where d.id = new.demanda_gerada_id and d.arquivado_em is null and d.prazo = old.data;
  end if;
  if new.data is distinct from old.data then
    perform privado.avisar_da_demanda_do_compromisso(new.demanda_gerada_id, new.id, 'data_mudou', old.data, new.data);
  end if;
  if privado.compromisso_em_aberto(old.etapa_id, old.arquivado_em) and not privado.compromisso_em_aberto(new.etapa_id, new.arquivado_em)
     and not exists (select 1 from public.quadro_colunas q where q.id = new.etapa_id and q.marco = 'concluido') then
    perform privado.avisar_da_demanda_do_compromisso(new.demanda_gerada_id, new.id, 'cancelado', null, new.data);
  end if;
  return null;
end $$;
revoke execute on function privado.demanda_acompanha_o_compromisso() from public, anon, authenticated;
create trigger demanda_acompanha after update of data, hora, etapa_id, arquivado_em on public.compromissos
  for each row when (new.demanda_gerada_id is not null) execute function privado.demanda_acompanha_o_compromisso();

-- 7. As datas novas da série: a de 20261122232804_compromissos_que_se_repetem.sql, sem copiar a ligação com a demanda que nasceu de outra
-- data (cada data tem a sua).
CREATE OR REPLACE FUNCTION privado.gerar_repeticoes(p_serie uuid, p_hoje date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.compromisso_repeticoes; m public.compromissos; v record; v_id uuid; v_sala uuid; v_etapa uuid; v_ultima date;
  v_ids uuid[] := '{}'; v_sem_sala date[] := '{}';
begin
  select * into r from public.compromisso_repeticoes where id = p_serie for update;
  select * into m from public.compromissos c where c.repeticao_id = r.id and c.arquivado_em is null order by c.repeticao_data desc limit 1;
  if r.id is null or m.id is null then
    return jsonb_build_object('ids', '[]'::jsonb, 'sem_sala', '[]'::jsonb);
  end if;
  select q.id into v_etapa from public.quadro_colunas q
  where q.escritorio_id = r.escritorio_id and q.modulo = 'compromissos' and q.marco = 'inicio' order by q.ordem limit 1;
  v_ultima := r.gerada_ate;
  for v in select * from privado.vezes_para_gerar(r, p_hoje) loop
    v_sala := m.sala_id;
    if v_sala is not null and not privado.sala_livre(v_sala, v.data, m.hora, m.hora_fim) then
      v_sala := null;
      v_sem_sala := v_sem_sala || v.data;
    end if;
    insert into public.compromissos (escritorio_id, tipo, titulo, data, hora, hora_fim, modalidade, local, observacoes, geral, responsavel_id,
                                     participantes, pessoas, processo_id, grupos, sala_id, etapa_id, etapa_ordem, criado_por, repeticao_id, repeticao_data)
    values (m.escritorio_id, m.tipo, m.titulo, v.data, m.hora, m.hora_fim, m.modalidade, m.local, m.observacoes, m.geral, m.responsavel_id,
            -- quem saiu da equipe não entra nas datas novas
            array(select x from unnest(m.participantes) x where exists (select 1 from public.perfis p where p.id = x and p.escritorio_id = m.escritorio_id)),
            m.pessoas, m.processo_id, m.grupos, v_sala, v_etapa, extract(epoch from clock_timestamp()), coalesce(r.criado_por, m.criado_por), r.id, v.data)
    returning id into v_id;
    insert into public.compromisso_ligacoes (compromisso_id, tarefa_id, demanda_id, contrato_id, criado_por)
    select v_id, l.tarefa_id, l.demanda_id, l.contrato_id, l.criado_por from public.compromisso_ligacoes l
    where l.compromisso_id = m.id
      and not exists (select 1 from public.compromissos x where x.demanda_gerada_id is not null and x.demanda_gerada_id = l.demanda_id)
    order by l.id;
    insert into public.compromisso_etiquetas (escritorio_id, compromisso_id, etiqueta_id)
    select e.escritorio_id, v_id, e.etiqueta_id from public.compromisso_etiquetas e where e.compromisso_id = m.id;
    v_ids := v_ids || v_id;
    v_ultima := v.data;
  end loop;
  update public.compromisso_repeticoes set gerada_ate = v_ultima, atualizado_em = now() where id = r.id and gerada_ate is distinct from v_ultima;
  return jsonb_build_object('ids', to_jsonb(v_ids), 'sem_sala', to_jsonb(v_sem_sala));
end $function$;

-- 8. O histórico do compromisso: a de 20261122232804_compromissos_que_se_repetem.sql, sem anotar a ligação com a demanda gerada (a ligação
-- já entra no histórico pela tabela compromisso_ligacoes).
CREATE OR REPLACE FUNCTION privado.historico_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'processo_codigo', 'processo_numero', 'busca', 'nome_ordem', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'repeticao_id', 'repeticao_data',
                        'demanda_gerada_id', 'demanda_gerada_em');
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
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object('de', old.processo_numero, 'para', new.processo_numero))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      when 'sala_id' then jsonb_build_object('sala', jsonb_build_object(
        'de', (select nome from public.salas where id = old.sala_id), 'para', (select nome from public.salas where id = new.sala_id)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.compromisso_historico (escritorio_id, compromisso_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;
