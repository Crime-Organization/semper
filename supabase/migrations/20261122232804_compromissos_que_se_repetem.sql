-- =====================================================================
-- Compromissos que se repetem (#307, parte A)
--   - O compromisso pode se repetir por semana, mês ou ano, a cada N (a renovação de marca é "a cada 10 anos"), até uma data, por
--     um número de vezes (contando a primeira) ou sem fim. A regra fica numa série (compromisso_repeticoes); cada data é um compromisso
--     de verdade, ligado a ela (repeticao_id), com situação, resultado, comentários e sala próprios.
--   - As datas são contadas a partir da primeira (privado.data_da_vez soma um "interval" a ela): o dia 31 cai no último dia dos
--     meses mais curtos e 29/02 cai em 28/02 nos anos que não são bissextos. É a mesma conta de app/src/regras/repeticao.ts.
--   - Viram cartão as datas até 12 meses adiante (privado.horizonte_da_repeticao, REPETICAO.horizonteMeses em
--     app/src/dados/limites.ts) e, sempre, a próxima depois de hoje. Uma rotina diária (estender-repeticoes, às 5h de Brasília)
--     acrescenta as seguintes. Cada data nova copia a última da série ainda ativa: pessoas, equipe, processo, sala, ligações e
--     etiquetas, na coluna de início do quadro. A sala ocupada numa data fica de fora só nela.
--   - Mudar "esta e as seguintes" (compromisso_mudar_seguintes) muda a data e o horário desta e das seguintes ainda em aberto (as
--     realizadas, canceladas e arquivadas não mudam). Mudar a data recomeça a série dali: a antiga termina antes, e uma nova é contada
--     da data nova. "Só esta" é mudar o compromisso como sempre. compromisso_arquivar_seguintes arquiva esta e as seguintes em aberto
--     e a série para de se repetir.
--   - O quadro e a tabela mostram só a próxima data em aberto de cada série (public.no_quadro, uma coluna calculada que o site lê
--     pelo PostgREST); a agenda e o calendário mostram todas, como sempre (leem as linhas por período).
--   - Audiência e perícia não se repetem: são de um processo e acontecem uma vez.
--   Os limites são os de REPETICAO em app/src/dados/limites.ts.
--
--   Só acrescenta: uma tabela, duas colunas (sem regra que obrigue preenchê-las), funções, gatilhos, uma rotina e o histórico do
--   compromisso com dois campos a menos para anotar (as ligações à série). A versão anterior do site continua funcionando: ela não
--   conhece a série, grava sem as colunas novas e mostra todas as datas no quadro e na tabela.
-- =====================================================================

-- 1. A série.
create table public.compromisso_repeticoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  frequencia    text not null check (frequencia in ('semana', 'mes', 'ano')),
  intervalo     smallint not null check (intervalo between 1 and 99),        -- REPETICAO.intervaloMaximo
  inicio        date not null,                                              -- a primeira data: todas as contas partem dela
  ate           date,                                                       -- a última data possível (null: sem data final)
  vezes         smallint check (vezes between 2 and 999),                   -- quantas vezes, contando a primeira (REPETICAO.vezesMaximas)
  gerada_ate    date not null,                                              -- a última data que já virou compromisso
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint repeticao_termina_de_um_jeito check (ate is null or vezes is null)
);
create index compromisso_repeticoes_escritorio on public.compromisso_repeticoes (escritorio_id);

alter table public.compromissos
  add column repeticao_id   uuid references public.compromisso_repeticoes on delete set null,
  add column repeticao_data date;   -- a data que a regra deu (a do compromisso pode ter sido mudada só nele)
-- Uma data da série vira um compromisso só uma vez.
create unique index compromissos_da_repeticao on public.compromissos (repeticao_id, repeticao_data) where repeticao_id is not null;

-- A série é do mesmo escritório do compromisso.
create function privado.conferir_repeticao_do_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.repeticao_id is not null
     and not exists (select 1 from public.compromisso_repeticoes r where r.id = new.repeticao_id and r.escritorio_id = new.escritorio_id) then
    raise exception 'Repetição não encontrada neste escritório.';
  end if;
  return new;
end $$;
revoke execute on function privado.conferir_repeticao_do_compromisso() from public, anon, authenticated;
create trigger conferir_repeticao before insert or update of repeticao_id on public.compromissos
  for each row execute function privado.conferir_repeticao_do_compromisso();

-- Lê a série quem vê um compromisso dela. Ninguém grava direto: só pelas funções abaixo.
alter table public.compromisso_repeticoes enable row level security;
revoke all on public.compromisso_repeticoes from anon;
revoke insert, update, delete on public.compromisso_repeticoes from authenticated;
create policy leitura on public.compromisso_repeticoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.compromissos c where c.repeticao_id = compromisso_repeticoes.id));

-- 2. As contas.
-- Hoje no relógio de Brasília (o da agenda).
create function privado.hoje_da_agenda() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
revoke execute on function privado.hoje_da_agenda() from public, anon;
grant execute on function privado.hoje_da_agenda() to authenticated;

-- Até quantos meses adiante as datas viram compromissos (REPETICAO.horizonteMeses em app/src/dados/limites.ts).
create function privado.horizonte_da_repeticao() returns interval
language sql immutable set search_path = '' as $$ select interval '12 months' $$;

-- A data da vez n (a primeira é a vez 0), contada a partir da primeira: o "interval" do Postgres leva o dia que não existe no mês
-- de chegada ao último dia dele (31/01 + 1 mês = 28/02), como somarMeses em app/src/regras/repeticao.ts.
create function privado.data_da_vez(p_inicio date, p_frequencia text, p_intervalo integer, p_n integer) returns date
language sql immutable parallel safe set search_path = '' as $$
  select (p_inicio + case p_frequencia when 'semana' then make_interval(weeks => p_intervalo * p_n)
                                       when 'mes' then make_interval(months => p_intervalo * p_n)
                                       else make_interval(years => p_intervalo * p_n) end)::date
$$;

-- As datas que viram compromisso: depois da última que já virou e a partir de hoje, até o horizonte e, sempre, pelo menos a próxima
-- depois de hoje; nunca passando do fim da série. A mesma conta de vezesParaGerar em app/src/regras/repeticao.ts.
create function privado.vezes_para_gerar(r public.compromisso_repeticoes, p_hoje date)
returns table (n integer, data date)
language plpgsql stable set search_path = '' as $$
declare v_limite date := (p_hoje + privado.horizonte_da_repeticao())::date; v_n integer := 0; v_data date; v_tem_proxima boolean := false;
begin
  loop
    exit when r.vezes is not null and v_n >= r.vezes;
    v_data := privado.data_da_vez(r.inicio, r.frequencia, r.intervalo, v_n);
    exit when (r.ate is not null and v_data > r.ate) or (v_data > v_limite and v_tem_proxima);
    v_tem_proxima := v_tem_proxima or v_data > p_hoje;
    if v_data > r.gerada_ate and v_data >= p_hoje then
      n := v_n; data := v_data;
      return next;
    end if;
    v_n := v_n + 1;
  end loop;
end $$;

-- A vez de uma data da série (a primeira vez cuja data chega a ela).
create function privado.vez_da_data(r public.compromisso_repeticoes, p_data date) returns integer
language plpgsql immutable set search_path = '' as $$
declare v_n integer := 0;
begin
  while privado.data_da_vez(r.inicio, r.frequencia, r.intervalo, v_n) < p_data loop
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- O compromisso ainda está em aberto: não foi arquivado nem está na coluna de concluído ("Realizado") ou na "Cancelado".
create function privado.compromisso_em_aberto(p_etapa uuid, p_arquivado timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_arquivado is null
     and not exists (select 1 from public.quadro_colunas q where q.id = p_etapa and (q.marco = 'concluido' or lower(q.nome) like 'cancelad%'))
$$;
revoke execute on function privado.compromisso_em_aberto(uuid, timestamptz) from public, anon;
grant execute on function privado.compromisso_em_aberto(uuid, timestamptz) to authenticated;

-- A sala está livre no horário, para uma data nova da série (as mesmas contas do gatilho conferir_sala).
create function privado.sala_livre(p_sala uuid, p_data date, p_hora time, p_hora_fim time) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.salas s where s.id = p_sala and s.ativa)
     and not exists (select 1 from privado.ocupacoes_da_sala(p_sala, p_data, null) o,
                     privado.minutos_na_sala(o.hora, o.hora_fim) x, privado.minutos_na_sala(p_hora, p_hora_fim) y
                     where x.inicio < y.fim and y.inicio < x.fim)
$$;
revoke execute on function privado.sala_livre(uuid, date, time, time) from public, anon, authenticated;

-- 3. Gerar as datas: cada uma copia a última da série ainda ativa (o modelo), na coluna de início do quadro. Sem nenhuma ativa, a
-- série não cresce. Devolve os compromissos criados e as datas em que a sala estava ocupada (elas ficam sem sala).
create function privado.gerar_repeticoes(p_serie uuid, p_hoje date) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
    select v_id, l.tarefa_id, l.demanda_id, l.contrato_id, l.criado_por from public.compromisso_ligacoes l where l.compromisso_id = m.id order by l.id;
    insert into public.compromisso_etiquetas (escritorio_id, compromisso_id, etiqueta_id)
    select e.escritorio_id, v_id, e.etiqueta_id from public.compromisso_etiquetas e where e.compromisso_id = m.id;
    v_ids := v_ids || v_id;
    v_ultima := v.data;
  end loop;
  update public.compromisso_repeticoes set gerada_ate = v_ultima, atualizado_em = now() where id = r.id and gerada_ate is distinct from v_ultima;
  return jsonb_build_object('ids', to_jsonb(v_ids), 'sem_sala', to_jsonb(v_sem_sala));
end $$;
revoke execute on function privado.gerar_repeticoes(uuid, date) from public, anon, authenticated;

-- 4. Para a tela.
-- Faz o compromisso se repetir: quem o muda (ativo), menos audiência e perícia, e só uma vez.
create function public.compromisso_repetir(p_id uuid, p_frequencia text, p_intervalo integer, p_ate date default null, p_vezes integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.compromissos; v_serie uuid;
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.tipo in ('audiencia', 'pericia') then
    raise exception 'Audiência e perícia não se repetem.';
  end if;
  if c.repeticao_id is not null then
    raise exception 'Este compromisso já se repete.';
  end if;
  if p_ate is not null and p_ate <= c.data then
    raise exception 'A data final precisa ser depois da data do compromisso.';
  end if;
  insert into public.compromisso_repeticoes (escritorio_id, frequencia, intervalo, inicio, ate, vezes, gerada_ate, criado_por)
  values (c.escritorio_id, p_frequencia, p_intervalo, c.data, p_ate, p_vezes, c.data, auth.uid())
  returning id into v_serie;
  update public.compromissos set repeticao_id = v_serie, repeticao_data = c.data where id = c.id;
  return privado.gerar_repeticoes(v_serie, privado.hoje_da_agenda());
end $$;
revoke execute on function public.compromisso_repetir(uuid, text, integer, date, integer) from public, anon;
grant execute on function public.compromisso_repetir(uuid, text, integer, date, integer) to authenticated;

-- Este compromisso e os seguintes da série ainda em aberto que quem chama muda, na ordem da série.
create function privado.esta_e_as_seguintes(c public.compromissos) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.id order by x.repeticao_data), '{}') from public.compromissos x
  where x.repeticao_id = c.repeticao_id
    and (x.id = c.id or (x.repeticao_data > c.repeticao_data and privado.compromisso_em_aberto(x.etapa_id, x.arquivado_em)
                         and privado.altero_o_compromisso(x.id)))
$$;
revoke execute on function privado.esta_e_as_seguintes(public.compromissos) from public, anon, authenticated;

-- Muda a data e o horário desta e das seguintes. Sem mudar a data, só o horário muda. Mudando a data, a série recomeça dali: a antiga
-- termina na véspera desta, e uma nova começa na data nova, com o que faltava das vezes e a mesma data final. As seguintes ganham as
-- datas da série nova, na ordem; a que passaria do fim é arquivada. Para a sala não se chocar com a própria série no meio do caminho,
-- quem anda para a frente muda da última para a primeira.
create function public.compromisso_mudar_seguintes(p_id uuid, p_data date, p_hora time default null, p_hora_fim time default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c public.compromissos; r public.compromisso_repeticoes; v_ids uuid[]; v_nova public.compromisso_repeticoes; v_resta integer;
  v_i integer; v_data date;
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Este compromisso não se repete.';
  end if;
  select * into r from public.compromisso_repeticoes where id = c.repeticao_id for update;
  v_ids := privado.esta_e_as_seguintes(c);
  if p_data = c.data then
    update public.compromissos set hora = p_hora, hora_fim = p_hora_fim where id = any(v_ids);
    return cardinality(v_ids);
  end if;

  v_resta := r.vezes - privado.vez_da_data(r, c.repeticao_data);
  insert into public.compromisso_repeticoes (escritorio_id, frequencia, intervalo, inicio, ate, vezes, gerada_ate, criado_por)
  values (r.escritorio_id, r.frequencia, r.intervalo, p_data,
          case when r.ate is not null then greatest(r.ate, p_data) when v_resta < 2 then p_data end,
          case when v_resta >= 2 then v_resta end, p_data, auth.uid())
  returning * into v_nova;
  update public.compromisso_repeticoes set ate = c.repeticao_data - 1, vezes = null, atualizado_em = now() where id = r.id;

  for v_i in select g from generate_series(1, cardinality(v_ids)) g order by case when p_data > c.data then -g else g end loop
    v_data := privado.data_da_vez(p_data, r.frequencia, r.intervalo, v_i - 1);
    if (v_nova.ate is not null and v_data > v_nova.ate) or (v_nova.vezes is not null and v_i > v_nova.vezes) then
      update public.compromissos set arquivado_em = now(), arquivado_por = auth.uid() where id = v_ids[v_i];
    else
      update public.compromissos set data = v_data, hora = p_hora, hora_fim = p_hora_fim, repeticao_id = v_nova.id, repeticao_data = v_data
      where id = v_ids[v_i];
      update public.compromisso_repeticoes set gerada_ate = greatest(gerada_ate, v_data) where id = v_nova.id;
    end if;
  end loop;
  perform privado.gerar_repeticoes(v_nova.id, privado.hoje_da_agenda());
  return cardinality(v_ids);
end $$;
revoke execute on function public.compromisso_mudar_seguintes(uuid, date, time, time) from public, anon;
grant execute on function public.compromisso_mudar_seguintes(uuid, date, time, time) to authenticated;

-- Arquiva esta e as seguintes ainda em aberto, e a série para de se repetir (termina na véspera desta).
create function public.compromisso_arquivar_seguintes(p_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.compromissos; v_ids uuid[];
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Este compromisso não se repete.';
  end if;
  v_ids := privado.esta_e_as_seguintes(c);
  update public.compromisso_repeticoes set ate = c.repeticao_data - 1, vezes = null, atualizado_em = now() where id = c.repeticao_id;
  update public.compromissos set arquivado_em = now(), arquivado_por = auth.uid() where id = any(v_ids);
  return cardinality(v_ids);
end $$;
revoke execute on function public.compromisso_arquivar_seguintes(uuid) from public, anon;
grant execute on function public.compromisso_arquivar_seguintes(uuid) to authenticated;

-- O quadro e a tabela: de cada série, só a próxima data em aberto (a de hoje em diante que vem primeiro); sem nenhuma adiante, a última
-- em aberto que já passou. O compromisso que não se repete e o arquivado aparecem sempre. É uma coluna calculada: o site filtra por
-- no_quadro=eq.true. Roda com a permissão de quem lê: vale a próxima que a pessoa vê. A mesma escolha de vezNaLista
-- (app/src/regras/repeticao.ts).
create function public.no_quadro(c public.compromissos) returns boolean
language sql stable set search_path = '' as $$
  select c.repeticao_id is null or c.arquivado_em is not null or c.id = (
    select x.id from public.compromissos x
    where x.repeticao_id = c.repeticao_id and privado.compromisso_em_aberto(x.etapa_id, x.arquivado_em)
    order by x.data < privado.hoje_da_agenda(), case when x.data >= privado.hoje_da_agenda() then x.data end, x.data desc, x.hora nulls first, x.id
    limit 1)
$$;
revoke execute on function public.no_quadro(public.compromissos) from public, anon;
grant execute on function public.no_quadro(public.compromissos) to authenticated;

-- 5. A rotina diária: acrescenta as datas que entraram no horizonte (e a próxima, quando a última passou). Uma série com problema
-- (o responsável saiu do escritório, por exemplo) não impede as outras: fica registrada no aviso da rotina.
create function privado.estender_repeticoes() returns integer
language plpgsql security definer set search_path = '' as $$
declare s record; v_hoje date := privado.hoje_da_agenda(); v_total integer := 0; v jsonb;
begin
  for s in select r.id from public.compromisso_repeticoes r
           where (r.ate is null or r.gerada_ate < r.ate) and r.gerada_ate < (v_hoje + privado.horizonte_da_repeticao())::date loop
    begin
      v := privado.gerar_repeticoes(s.id, v_hoje);
      v_total := v_total + jsonb_array_length(v -> 'ids');
    exception when others then
      raise warning 'A repetição % não foi estendida: %', s.id, sqlerrm;
    end;
  end loop;
  return v_total;
end $$;
revoke execute on function privado.estender_repeticoes() from public, anon, authenticated;
select cron.schedule('estender-repeticoes', '0 8 * * *', 'select privado.estender_repeticoes()');

-- 6. O histórico do compromisso: a de 20261122132438_salas_do_escritorio.sql, sem anotar as ligações à série (a data, que é o que a
-- pessoa vê, continua anotada).
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
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'repeticao_id', 'repeticao_data');
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
