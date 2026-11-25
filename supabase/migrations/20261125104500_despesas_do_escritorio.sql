-- =====================================================================
-- Despesas do escritório a pagar (#439)
--   - No Financeiro (aba Obrigações), o administrador cadastra as despesas que o escritório paga (DAS, funcionários, contas): a
--     descrição, o valor (em centavos), o vencimento e, se quiser, a repetição (por semana, mês ou ano, a cada N, até uma data, por um
--     número de vezes ou sem fim). Cada data é uma linha de financeiro_despesas, com a sua situação; a regra da repetição fica em
--     financeiro_despesa_repeticoes.
--   - As datas da repetição nascem sozinhas como as dos compromissos (20261122232804_compromissos_que_se_repetem.sql, com as mesmas
--     contas: privado.data_da_vez e privado.horizonte_da_repeticao): as de hoje até 12 meses adiante e, sempre, a próxima depois de
--     hoje. Uma rotina diária (estender-despesas, às 5h05 de Brasília) acrescenta as seguintes. Cada data nova copia a descrição e o
--     valor da última da série que não foi excluída.
--   - Marcar como paga grava o dia do pagamento (só registra o fato: não cria lançamento no caixa); a próxima da repetição continua a
--     pagar. Desfazer devolve como estava.
--   - Mudar a despesa muda esta data; "esta e as seguintes" leva a descrição e o valor às seguintes ainda a pagar (o vencimento muda só
--     nesta). Excluir só esconde: "esta e as seguintes" esconde também as seguintes a pagar e a repetição para (parada_em). Restaurar
--     devolve as excluídas e, se era o ponto em que parou, a repetição volta a andar.
--   - Toda mudança fica no histórico da despesa (campo a campo) e no registro de ações (auditoria), como os lançamentos do caixa.
--   - Só os administradores do escritório veem e mexem nas despesas; um escritório nunca vê as de outro. Ninguém grava direto nas
--     tabelas: só pelas funções abaixo, que conferem quem chama e ficam presas ao escritório dele.
--   Os tamanhos são os de TAMANHO_FINANCEIRO e VALOR_MAXIMO_DO_LANCAMENTO; os limites da repetição, os de REPETICAO (app/src/dados/limites.ts).
--
--   Só acrescenta: tabelas, funções e uma rotina novas. A versão anterior do site continua funcionando: ela não conhece as despesas.
-- =====================================================================

-- 1. A repetição.
create table public.financeiro_despesa_repeticoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  frequencia    text not null check (frequencia in ('semana', 'mes', 'ano')),
  intervalo     smallint not null check (intervalo between 1 and 99),        -- REPETICAO.intervaloMaximo
  inicio        date not null,                                              -- o primeiro vencimento: todas as contas partem dele
  ate           date,                                                       -- o último vencimento possível (null: sem data final)
  vezes         smallint check (vezes between 2 and 999),                   -- quantas vezes, contando a primeira (REPETICAO.vezesMaximas)
  parada_em     date,                                                       -- parou ("esta e as seguintes" excluídas): nada nasce desta data em diante
  gerada_ate    date not null,                                              -- o último vencimento que já virou despesa
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint despesa_termina_de_um_jeito check (ate is null or vezes is null),
  unique (id, escritorio_id)
);
create index financeiro_despesa_repeticoes_escritorio on public.financeiro_despesa_repeticoes (escritorio_id);

-- 2. As despesas: uma linha por vencimento.
create table public.financeiro_despesas (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  descricao      text not null check (btrim(descricao) <> '' and length(descricao) <= 300),
  valor          bigint not null check (valor > 0 and valor <= 100000000000000),
  vencimento     date not null check (vencimento between date '2000-01-01' and date '2100-12-31'),
  paga_em        date check (paga_em between date '2000-01-01' and date '2100-12-31'),
  repeticao_id   uuid,
  repeticao_data date,                                                       -- o vencimento que a regra deu (o desta pode ter mudado)
  excluida_em    timestamptz,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  foreign key (repeticao_id, escritorio_id) references public.financeiro_despesa_repeticoes (id, escritorio_id) on delete set null (repeticao_id)
);
-- Uma data da repetição vira uma despesa só uma vez.
create unique index financeiro_despesas_da_repeticao on public.financeiro_despesas (repeticao_id, repeticao_data) where repeticao_id is not null;
create index financeiro_despesas_vencimento on public.financeiro_despesas (escritorio_id, vencimento) where excluida_em is null;
create trigger carimbo before update on public.financeiro_despesas for each row execute function privado.carimbar();

-- 3. O histórico: o que mudou, campo a campo. E o registro de ações.
create table public.financeiro_despesas_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  despesa_id    uuid not null references public.financeiro_despesas on delete cascade,
  alteracoes    jsonb not null,
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index financeiro_despesas_historico_despesa on public.financeiro_despesas_historico (despesa_id, em desc);

create function privado.historico_despesa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  foreach k in array array['descricao', 'valor', 'vencimento', 'paga_em', 'excluida_em'] loop
    continue when vo -> k is not distinct from vn -> k;
    a := a || jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k));
  end loop;
  if a <> '{}' then
    insert into public.financeiro_despesas_historico (escritorio_id, despesa_id, alteracoes, feito_por) values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
revoke execute on function privado.historico_despesa() from public, anon, authenticated;
create trigger historico after update on public.financeiro_despesas for each row execute function privado.historico_despesa();
-- O registro de ações, igual ao banco fictício: a inclusão, a exclusão e só a mudança que mexe no que o histórico mostra (não a que
-- só carimba o atualizado_em, nem a que não muda nada).
create trigger auditoria after insert or delete on public.financeiro_despesas for each row execute function privado.auditar();
create trigger auditoria_mudanca after update on public.financeiro_despesas for each row
  when ((old.descricao, old.valor, old.vencimento, old.paga_em, old.excluida_em) is distinct from (new.descricao, new.valor, new.vencimento, new.paga_em, new.excluida_em))
  execute function privado.auditar();

-- 4. Quem pode: só os administradores do escritório leem; ninguém grava direto.
alter table public.financeiro_despesa_repeticoes enable row level security;
alter table public.financeiro_despesas enable row level security;
alter table public.financeiro_despesas_historico enable row level security;
revoke all on public.financeiro_despesa_repeticoes, public.financeiro_despesas, public.financeiro_despesas_historico from anon;
revoke insert, update, delete on public.financeiro_despesa_repeticoes, public.financeiro_despesas, public.financeiro_despesas_historico from authenticated;
create policy leitura on public.financeiro_despesa_repeticoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy leitura on public.financeiro_despesas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy leitura on public.financeiro_despesas_historico for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 5. As datas da repetição.
-- As que viram despesa: depois da última que já virou e a partir de hoje, até o horizonte e, sempre, pelo menos a próxima depois de
-- hoje; nunca passando do fim da repetição nem do ponto em que ela parou. A conta de vezesParaGerar em app/src/regras/repeticao.ts.
create function privado.vezes_da_despesa(r public.financeiro_despesa_repeticoes, p_hoje date)
returns table (n integer, data date)
language plpgsql stable set search_path = '' as $$
declare v_limite date := (p_hoje + privado.horizonte_da_repeticao())::date; v_n integer := 0; v_data date; v_tem_proxima boolean := false;
begin
  loop
    exit when r.vezes is not null and v_n >= r.vezes;
    v_data := privado.data_da_vez(r.inicio, r.frequencia, r.intervalo, v_n);
    exit when (r.ate is not null and v_data > r.ate) or (r.parada_em is not null and v_data >= r.parada_em) or (v_data > v_limite and v_tem_proxima);
    v_tem_proxima := v_tem_proxima or v_data > p_hoje;
    if v_data > r.gerada_ate and v_data >= p_hoje then
      n := v_n; data := v_data;
      return next;
    end if;
    v_n := v_n + 1;
  end loop;
end $$;
revoke execute on function privado.vezes_da_despesa(public.financeiro_despesa_repeticoes, date) from public, anon, authenticated;

-- Gera as datas: cada uma copia a descrição e o valor da última da repetição que não foi excluída (sem nenhuma, a repetição não
-- cresce). Devolve os ids das despesas criadas.
create function privado.gerar_despesas(p_serie uuid, p_hoje date) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_despesa_repeticoes; m public.financeiro_despesas; v record; v_id uuid; v_ultima date; v_ids uuid[] := '{}';
begin
  select * into r from public.financeiro_despesa_repeticoes where id = p_serie for update;
  select * into m from public.financeiro_despesas d where d.repeticao_id = r.id and d.excluida_em is null order by d.repeticao_data desc limit 1;
  if r.id is null or m.id is null then return v_ids; end if;
  v_ultima := r.gerada_ate;
  for v in select * from privado.vezes_da_despesa(r, p_hoje) loop
    insert into public.financeiro_despesas (escritorio_id, descricao, valor, vencimento, repeticao_id, repeticao_data, criado_por)
    values (r.escritorio_id, m.descricao, m.valor, v.data, r.id, v.data, coalesce(r.criado_por, m.criado_por))
    returning id into v_id;
    v_ids := v_ids || v_id;
    v_ultima := v.data;
  end loop;
  update public.financeiro_despesa_repeticoes set gerada_ate = v_ultima, atualizado_em = now() where id = r.id and gerada_ate is distinct from v_ultima;
  return v_ids;
end $$;
revoke execute on function privado.gerar_despesas(uuid, date) from public, anon, authenticated;

-- As repetições que ainda podem crescer: nem passaram da data final, nem pararam, nem já geraram todas as vezes, e a última gerada
-- está antes do horizonte. A série que terminou não é percorrida de novo todo dia.
create function privado.repeticoes_de_despesa_a_estender(p_hoje date) returns setof uuid
language sql stable set search_path = '' as $$
  select r.id from public.financeiro_despesa_repeticoes r
  where (r.ate is null or r.gerada_ate < r.ate) and (r.parada_em is null or r.gerada_ate < r.parada_em)
    and (r.vezes is null or r.gerada_ate < privado.data_da_vez(r.inicio, r.frequencia, r.intervalo, r.vezes - 1))
    and r.gerada_ate < (p_hoje + privado.horizonte_da_repeticao())::date
$$;
revoke execute on function privado.repeticoes_de_despesa_a_estender(date) from public, anon, authenticated;

-- A rotina diária: acrescenta as datas que entraram no horizonte. Uma repetição com problema não impede as outras.
create function privado.estender_despesas() returns integer
language plpgsql security definer set search_path = '' as $$
declare s record; v_hoje date := privado.hoje_da_agenda(); v_total integer := 0;
begin
  for s in select id from privado.repeticoes_de_despesa_a_estender(v_hoje) as id loop
    begin
      v_total := v_total + coalesce(cardinality(privado.gerar_despesas(s.id, v_hoje)), 0);
    exception when others then
      raise warning 'A repetição da despesa % não foi estendida: %', s.id, sqlerrm;
    end;
  end loop;
  return v_total;
end $$;
revoke execute on function privado.estender_despesas() from public, anon, authenticated;
select cron.schedule('estender-despesas', '5 8 * * *', 'select privado.estender_despesas()');

-- 6. Para a tela. Todas conferem que quem chama é administrador e ficam presas ao escritório dele.
create function privado.so_administrador_nas_despesas() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe nas despesas do escritório.' using errcode = '42501'; end if;
end $$;
revoke execute on function privado.so_administrador_nas_despesas() from public, anon;
grant execute on function privado.so_administrador_nas_despesas() to authenticated;

-- A despesa (não excluída) do escritório de quem chama, travada para mudar.
create function privado.despesa_para_mudar(p_id uuid) returns public.financeiro_despesas
language plpgsql security definer set search_path = '' as $$
declare d public.financeiro_despesas;
begin
  perform privado.so_administrador_nas_despesas();
  select * into d from public.financeiro_despesas where id = p_id and escritorio_id = privado.meu_escritorio() and excluida_em is null for update;
  if d.id is null then raise exception 'Despesa não encontrada neste escritório.'; end if;
  return d;
end $$;
revoke execute on function privado.despesa_para_mudar(uuid) from public, anon, authenticated;

-- As despesas do período: as que vencem nele (pagas ou não) e as ainda a pagar que venceram antes dele, sem as excluídas. A repetição
-- vem por extenso (a que parou termina na véspera do ponto em que parou). Com a permissão de quem chama: o RLS filtra.
create function public.financeiro_despesas_do_periodo(p_de date, p_ate date)
returns table (id uuid, descricao text, valor bigint, vencimento date, paga_em date, repeticao_id uuid, frequencia text, intervalo smallint, ate date, vezes smallint)
language sql stable set search_path = '' as $$
  select d.id, d.descricao, d.valor, d.vencimento, d.paga_em, d.repeticao_id, r.frequencia, r.intervalo,
         case when r.parada_em is null then r.ate else least(coalesce(r.ate, r.parada_em - 1), r.parada_em - 1) end,
         case when r.parada_em is null then r.vezes end
  from public.financeiro_despesas d
  left join public.financeiro_despesa_repeticoes r on r.id = d.repeticao_id
  where d.excluida_em is null and ((d.vencimento between p_de and p_ate) or (d.vencimento < p_de and d.paga_em is null))
  order by d.vencimento, d.criado_em, d.id
$$;
revoke execute on function public.financeiro_despesas_do_periodo(date, date) from public, anon;
grant execute on function public.financeiro_despesas_do_periodo(date, date) to authenticated;

-- Cadastra a despesa e, com a repetição, as datas seguintes. Devolve o id e os das datas que nasceram.
create function public.financeiro_despesa_criar(p_descricao text, p_valor bigint, p_vencimento date, p_frequencia text default null,
                                                p_intervalo integer default 1, p_ate date default null, p_vezes integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_serie uuid; v_ids uuid[] := '{}';
begin
  perform privado.so_administrador_nas_despesas();
  if p_frequencia is not null and p_ate is not null and p_ate <= p_vencimento then
    raise exception 'A data final precisa ser depois do vencimento.';
  end if;
  -- A repetição nasce antes, para a despesa já entrar ligada a ela (sem uma mudança logo depois da inclusão no registro de ações).
  if p_frequencia is not null then
    insert into public.financeiro_despesa_repeticoes (escritorio_id, frequencia, intervalo, inicio, ate, vezes, gerada_ate, criado_por)
    values (privado.meu_escritorio(), p_frequencia, p_intervalo, p_vencimento, p_ate, p_vezes, p_vencimento, auth.uid())
    returning id into v_serie;
  end if;
  insert into public.financeiro_despesas (escritorio_id, descricao, valor, vencimento, repeticao_id, repeticao_data, criado_por)
  values (privado.meu_escritorio(), btrim(p_descricao), p_valor, p_vencimento, v_serie, case when v_serie is not null then p_vencimento end, auth.uid())
  returning id into v_id;
  if v_serie is not null then
    v_ids := privado.gerar_despesas(v_serie, privado.hoje_da_agenda());
  end if;
  return jsonb_build_object('id', v_id, 'ids', to_jsonb(v_ids));
end $$;
revoke execute on function public.financeiro_despesa_criar(text, bigint, date, text, integer, date, integer) from public, anon;
grant execute on function public.financeiro_despesa_criar(text, bigint, date, text, integer, date, integer) to authenticated;

-- Muda a despesa. Com p_seguintes, a descrição e o valor vão também às seguintes da repetição ainda a pagar. Devolve quantas mudaram.
create function public.financeiro_despesa_mudar(p_id uuid, p_descricao text, p_valor bigint, p_vencimento date, p_seguintes boolean default false)
returns integer
language plpgsql security definer set search_path = '' as $$
declare d public.financeiro_despesas := privado.despesa_para_mudar(p_id); v_seguintes integer := 0;
begin
  update public.financeiro_despesas set descricao = btrim(p_descricao), valor = p_valor, vencimento = p_vencimento where id = d.id;
  if p_seguintes and d.repeticao_id is not null then
    update public.financeiro_despesas set descricao = btrim(p_descricao), valor = p_valor
    where repeticao_id = d.repeticao_id and repeticao_data > d.repeticao_data and paga_em is null and excluida_em is null;
    get diagnostics v_seguintes = row_count;
  end if;
  return 1 + v_seguintes;
end $$;
revoke execute on function public.financeiro_despesa_mudar(uuid, text, bigint, date, boolean) from public, anon;
grant execute on function public.financeiro_despesa_mudar(uuid, text, bigint, date, boolean) to authenticated;

-- Marca como paga no dia do pagamento; desfazer volta a "a pagar".
create function public.financeiro_despesa_pagar(p_id uuid, p_data date) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.financeiro_despesas := privado.despesa_para_mudar(p_id);
begin
  if d.paga_em is not null then raise exception 'Esta despesa já foi paga.'; end if;
  -- Sem o dia do pagamento, a despesa ficaria a pagar sem erro: recusa, como o banco fictício.
  if p_data is null then raise exception 'Algum campo está em formato inválido. Confira os dados e tente de novo.' using errcode = '23514'; end if;
  update public.financeiro_despesas set paga_em = p_data where id = d.id;
end $$;
revoke execute on function public.financeiro_despesa_pagar(uuid, date) from public, anon;
grant execute on function public.financeiro_despesa_pagar(uuid, date) to authenticated;

create function public.financeiro_despesa_desfazer_pagamento(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.financeiro_despesas := privado.despesa_para_mudar(p_id);
begin
  update public.financeiro_despesas set paga_em = null where id = d.id and paga_em is not null;
end $$;
revoke execute on function public.financeiro_despesa_desfazer_pagamento(uuid) from public, anon;
grant execute on function public.financeiro_despesa_desfazer_pagamento(uuid) to authenticated;

-- Exclui (esconde) a despesa. Com p_seguintes, também as seguintes da repetição ainda a pagar, e a repetição para. Devolve os ids.
create function public.financeiro_despesa_excluir(p_id uuid, p_seguintes boolean default false) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare d public.financeiro_despesas := privado.despesa_para_mudar(p_id); v_ids uuid[] := array[d.id];
begin
  update public.financeiro_despesas set excluida_em = now() where id = d.id;
  if p_seguintes and d.repeticao_id is not null then
    with saem as (
      update public.financeiro_despesas set excluida_em = now()
      where repeticao_id = d.repeticao_id and repeticao_data > d.repeticao_data and paga_em is null and excluida_em is null
      returning id)
    select v_ids || coalesce(array_agg(id), '{}') into v_ids from saem;
    update public.financeiro_despesa_repeticoes set parada_em = d.repeticao_data, atualizado_em = now()
    where id = d.repeticao_id and (parada_em is null or parada_em > d.repeticao_data);
  end if;
  return v_ids;
end $$;
revoke execute on function public.financeiro_despesa_excluir(uuid, boolean) from public, anon;
grant execute on function public.financeiro_despesa_excluir(uuid, boolean) to authenticated;

-- Devolve as excluídas (o desfazer da exclusão). A repetição que parou nelas volta a andar.
create function public.financeiro_despesa_restaurar(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  perform privado.so_administrador_nas_despesas();
  update public.financeiro_despesas set excluida_em = null
  where id = any (p_ids) and escritorio_id = privado.meu_escritorio() and excluida_em is not null;
  for s in select d.repeticao_id, min(d.repeticao_data) as primeira from public.financeiro_despesas d
           where d.id = any (p_ids) and d.escritorio_id = privado.meu_escritorio() and d.repeticao_id is not null group by d.repeticao_id loop
    update public.financeiro_despesa_repeticoes set parada_em = null, atualizado_em = now() where id = s.repeticao_id and parada_em = s.primeira;
    perform privado.gerar_despesas(s.repeticao_id, privado.hoje_da_agenda());
  end loop;
end $$;
revoke execute on function public.financeiro_despesa_restaurar(uuid[]) from public, anon;
grant execute on function public.financeiro_despesa_restaurar(uuid[]) to authenticated;
