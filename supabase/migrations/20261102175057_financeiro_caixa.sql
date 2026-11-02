-- =====================================================================
-- Financeiro: o caixa do escritório (parte da tarefa #49)
--   - Cada escritório tem as suas contas (na Braga Ferreira, PF, PJ e ESPÉCIE), que nunca se misturam. Cada conta tem um saldo
--     inicial numa data, e nada pode ser lançado antes dela. A conta que recolhe DAS é a da empresa.
--   - Lançamento: uma entrada ou uma saída numa conta, em centavos. Excluir só esconde, e desfazer devolve como estava.
--   - Transferência: duas linhas ligadas (par_id), uma saída e uma entrada, no "repasse da PJ para a PF", que não é lucro. Ela não
--     muda depois de criada: exclui-se e lança-se de novo, e excluir uma linha exclui a outra.
--   - Toda mudança de um lançamento fica no histórico, com o valor como estava e como ficou.
--   - O início da conta não pode passar de um lançamento que já existe.
--   - O DAS tem um percentual por mês (regras/financeiro.ts, dasDoMes). Mudar o DAS ou o saldo inicial fica registrado em
--     financeiro_ajustes, porque muda a conta dos meses seguintes.
--   - Só os administradores veem e mexem no caixa.
--   Os tamanhos são os de TAMANHO_FINANCEIRO em app/src/dados/limites.ts; as categorias, os de CATEGORIAS em app/src/regras/caixa.ts.
--   Só acrescenta (tabelas e funções novas). O módulo não é ligado em nenhum escritório por esta migração: a versão anterior do
--   site continua funcionando, e quem liga é uma pessoa, depois de conferir um mês inteiro com o caixa atual.
-- =====================================================================

-- 1. Contas
create table public.financeiro_contas (
  id               uuid primary key default gen_random_uuid(),
  escritorio_id    uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome             text not null check (btrim(nome) <> '' and length(nome) <= 60),
  tem_das          boolean not null default false,
  saldo_inicial    bigint not null default 0 check (abs(saldo_inicial) <= 100000000000000),
  saldo_inicial_em date not null check (saldo_inicial_em between date '2000-01-01' and date '2100-12-31'),
  arquivada_em     timestamptz,
  criado_por       uuid default auth.uid() references auth.users on delete set null,
  criado_em        timestamptz not null default now(),
  unique (id, escritorio_id)
);
create unique index financeiro_contas_nome_unico on public.financeiro_contas (escritorio_id, privado.sem_acento(btrim(nome)));

-- 2. Lançamentos
create table public.financeiro_lancamentos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  conta_id      uuid not null,
  data          date not null check (data between date '2000-01-01' and date '2100-12-31'),
  tipo          text not null check (tipo in ('entrada', 'saida')),
  categoria     text not null,
  valor         bigint not null check (valor > 0 and valor <= 100000000000000),
  descricao     text not null check (btrim(descricao) <> '' and length(descricao) <= 300),
  par_id        uuid,
  excluido_em   timestamptz,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em timestamptz not null default now(),
  foreign key (conta_id, escritorio_id) references public.financeiro_contas (id, escritorio_id) on delete restrict,
  unique (id, escritorio_id),
  foreign key (par_id, escritorio_id) references public.financeiro_lancamentos (id, escritorio_id) on delete set null (par_id),
  -- Cada categoria só serve para o seu tipo; a transferência tem uma ponta de cada.
  check ((categoria in ('recebimento', 'outra_entrada') and tipo = 'entrada')
      or (categoria in ('despesa', 'das', 'repasse', 'indicacao', 'divisao_lucro') and tipo = 'saida')
      or categoria = 'transferencia')
);
create index financeiro_lancamentos_conta on public.financeiro_lancamentos (conta_id, data, criado_em) where excluido_em is null;

-- Texto limpo, data depois do saldo inicial, conta ativa e a transferência que não muda. Roda com a permissão de quem grava.
create function privado.preparar_lancamento() returns trigger
language plpgsql set search_path = '' as $$
declare c public.financeiro_contas;
begin
  new.descricao := btrim(new.descricao);
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  if tg_op = 'UPDATE' and old.excluido_em is not null and new.excluido_em is not null
     and (new.valor, new.data, new.conta_id, new.tipo, new.categoria, new.descricao) is distinct from (old.valor, old.data, old.conta_id, old.tipo, old.categoria, old.descricao) then
    raise exception 'Este lançamento foi excluído.';
  end if;
  if tg_op = 'UPDATE' and old.categoria = 'transferencia' and old.par_id is not null
     and (new.valor, new.data, new.conta_id, new.tipo, new.categoria) is distinct from (old.valor, old.data, old.conta_id, old.tipo, old.categoria) then
    raise exception 'A transferência não muda depois de criada: exclua e lance de novo.';
  end if;
  if tg_op = 'UPDATE' and old.categoria <> 'transferencia' and new.categoria = 'transferencia' then
    raise exception 'A transferência se lança como repasse entre contas.';
  end if;
  -- Ao lançar, ao mudar a conta ou a data, e ao devolver o que foi excluído.
  if tg_op = 'INSERT' or (new.conta_id, new.data) is distinct from (old.conta_id, old.data) or (old.excluido_em is not null and new.excluido_em is null) then
    select * into c from public.financeiro_contas where id = new.conta_id and escritorio_id = new.escritorio_id;
    if c.id is null then raise exception 'Conta não encontrada neste escritório.'; end if;
    if c.arquivada_em is not null then raise exception 'Esta conta está arquivada.'; end if;
    if new.data < c.saldo_inicial_em then raise exception 'Esta data é anterior ao saldo inicial da conta.'; end if;
  end if;
  return new;
end $$;
create trigger preparar before insert or update on public.financeiro_lancamentos for each row execute function privado.preparar_lancamento();
create trigger carimbo before update on public.financeiro_lancamentos for each row execute function privado.carimbar();

-- O início da conta não pode passar de um lançamento que já existe.
create function privado.conferir_inicio_da_conta() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.financeiro_lancamentos l where l.conta_id = new.id and l.excluido_em is null and l.data < new.saldo_inicial_em) then
    raise exception 'Há lançamentos antes dessa data. Escolha um dia igual ou anterior ao primeiro lançamento.';
  end if;
  return new;
end $$;
create trigger conferir_inicio before update of saldo_inicial_em on public.financeiro_contas for each row execute function privado.conferir_inicio_da_conta();

-- Excluir (ou devolver) uma ponta da transferência faz o mesmo com a outra.
create function privado.junto_com_o_par() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.financeiro_lancamentos set excluido_em = new.excluido_em
  where id = new.par_id and excluido_em is distinct from new.excluido_em;
  return null;
end $$;
create trigger junto_com_o_par after update of excluido_em on public.financeiro_lancamentos
  for each row when (new.par_id is not null and old.excluido_em is distinct from new.excluido_em) execute function privado.junto_com_o_par();

-- 3. Histórico: o que mudou, campo a campo.
create table public.financeiro_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  lancamento_id uuid not null references public.financeiro_lancamentos on delete cascade,
  alteracoes    jsonb not null,
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index financeiro_historico_lancamento on public.financeiro_historico (lancamento_id, em desc);

create function privado.historico_lancamento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  foreach k in array array['conta_id', 'data', 'tipo', 'categoria', 'valor', 'descricao', 'excluido_em'] loop
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'conta_id' then jsonb_build_object('conta', jsonb_build_object(
        'de', (select nome from public.financeiro_contas where id = old.conta_id),
        'para', (select nome from public.financeiro_contas where id = new.conta_id)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.financeiro_historico (escritorio_id, lancamento_id, alteracoes, feito_por) values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.financeiro_lancamentos for each row execute function privado.historico_lancamento();
create trigger auditoria after insert or update or delete on public.financeiro_lancamentos for each row execute function privado.auditar();
create trigger auditoria after insert or update or delete on public.financeiro_contas for each row execute function privado.auditar();

-- 4. O DAS de cada mês
create table public.financeiro_das (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  mes           text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  aliquota      numeric(5, 2) not null check (aliquota between 0 and 100),
  atualizado_por uuid default auth.uid() references auth.users on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (escritorio_id, mes)
);

-- O que muda a conta dos meses seguintes fica registrado.
create table public.financeiro_ajustes (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  alteracoes    jsonb not null,
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index financeiro_ajustes_escritorio on public.financeiro_ajustes (escritorio_id, em desc);

create function privado.ajuste_da_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}';
begin
  if new.saldo_inicial is distinct from old.saldo_inicial then a := a || jsonb_build_object('Saldo inicial de ' || new.nome, jsonb_build_object('de', old.saldo_inicial, 'para', new.saldo_inicial)); end if;
  if new.saldo_inicial_em is distinct from old.saldo_inicial_em then a := a || jsonb_build_object('Início de ' || new.nome, jsonb_build_object('de', old.saldo_inicial_em, 'para', new.saldo_inicial_em)); end if;
  if a <> '{}' then insert into public.financeiro_ajustes (escritorio_id, alteracoes, feito_por) values (new.escritorio_id, a, auth.uid()); end if;
  return null;
end $$;
create trigger ajuste after update on public.financeiro_contas for each row execute function privado.ajuste_da_conta();

create function privado.ajuste_do_das() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.aliquota is distinct from old.aliquota then
    insert into public.financeiro_ajustes (escritorio_id, alteracoes, feito_por)
    values (new.escritorio_id, jsonb_build_object('DAS de ' || new.mes, jsonb_build_object('de', case when tg_op = 'UPDATE' then old.aliquota end, 'para', new.aliquota)), auth.uid());
  end if;
  return null;
end $$;
create trigger ajuste after insert or update on public.financeiro_das for each row execute function privado.ajuste_do_das();

-- 5. Quem pode: só os administradores do escritório.
alter table public.financeiro_ajustes     enable row level security;
alter table public.financeiro_contas      enable row level security;
alter table public.financeiro_lancamentos enable row level security;
alter table public.financeiro_historico   enable row level security;
alter table public.financeiro_das         enable row level security;
revoke all on public.financeiro_contas, public.financeiro_lancamentos, public.financeiro_historico, public.financeiro_das, public.financeiro_ajustes from anon;
-- Conta e lançamento não são apagados de verdade. Autor e ligação das transferências ficam de fora do que muda.
revoke update, delete on public.financeiro_contas, public.financeiro_lancamentos from authenticated;
revoke insert, update, delete on public.financeiro_historico, public.financeiro_ajustes from authenticated;
grant update (nome, tem_das, saldo_inicial, saldo_inicial_em, arquivada_em) on public.financeiro_contas to authenticated;
grant update (conta_id, data, tipo, categoria, valor, descricao, excluido_em) on public.financeiro_lancamentos to authenticated;

create policy leitura on public.financeiro_contas for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy incluir on public.financeiro_contas for insert to authenticated with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()));
create policy alterar on public.financeiro_contas for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));

create policy leitura on public.financeiro_lancamentos for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy incluir on public.financeiro_lancamentos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()) and categoria <> 'transferencia' and par_id is null);
create policy alterar on public.financeiro_lancamentos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));

create policy leitura on public.financeiro_historico for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy leitura on public.financeiro_ajustes for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

create policy leitura on public.financeiro_das for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy incluir on public.financeiro_das for insert to authenticated with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy alterar on public.financeiro_das for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create trigger carimbo before update on public.financeiro_das for each row execute function privado.carimbar();

-- 6. O saldo de uma conta antes de uma data, com a permissão de quem chama. A transferência roda como o sistema, porque só ela
-- liga as duas pontas, e por isso confere quem chama.
create function public.financeiro_saldo_antes(p_conta uuid, p_data date) returns bigint
language sql stable set search_path = '' as $$
  select c.saldo_inicial + coalesce((
    select sum(case l.tipo when 'entrada' then l.valor else -l.valor end)
    from public.financeiro_lancamentos l
    where l.conta_id = c.id and l.excluido_em is null and l.data < p_data), 0)
  from public.financeiro_contas c where c.id = p_conta
$$;
revoke execute on function public.financeiro_saldo_antes(uuid, date) from public, anon;
grant execute on function public.financeiro_saldo_antes(uuid, date) to authenticated;

create function public.financeiro_transferir(p_de uuid, p_para uuid, p_data date, p_valor bigint, p_descricao text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare saida uuid; entrada uuid; escritorio uuid := privado.meu_escritorio();
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe no caixa.' using errcode = '42501'; end if;
  if p_de = p_para then raise exception 'Escolha duas contas diferentes.'; end if;
  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, criado_por)
  values (escritorio, p_de, p_data, 'saida', 'transferencia', p_valor, p_descricao, auth.uid()) returning id into saida;
  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, par_id, criado_por)
  values (escritorio, p_para, p_data, 'entrada', 'transferencia', p_valor, p_descricao, saida, auth.uid()) returning id into entrada;
  update public.financeiro_lancamentos set par_id = entrada where id = saida;
  return saida;
end $$;
revoke execute on function public.financeiro_transferir(uuid, uuid, date, bigint, text) from public, anon;
grant execute on function public.financeiro_transferir(uuid, uuid, date, bigint, text) to authenticated;
