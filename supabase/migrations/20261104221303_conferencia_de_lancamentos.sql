-- =====================================================================
-- Conferência dos lançamentos de cada advogado com o caixa (#256)
--   Uma linha para cada lançamento de 2025 e 2026 cruzado entre as planilhas dos advogados e a planilha geral. A importação grava as linhas;
--   o que entrou no caixa fica guardado na própria linha, porque quem não é administrador não lê o caixa. O responsável pela linha, ou um
--   administrador, corrige o que foi pago e marca Confere ou Não confere, com uma observação. Corrigir aqui nunca muda o caixa: se a linha
--   vem de uma parcela importada, a parcela muda junto, e ela não passa pelo caixa.
--   A sugestão é o resultado do cruzamento; a situação é o que a pessoa marcou, e o que não foi marcado é o que falta.
--   Só acrescenta: tabelas e funções novas, que a versão anterior do site não usa.
-- =====================================================================

create table public.financeiro_conferencia (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  -- De onde a linha veio: é por ela que a importação sabe o que já gravou.
  chave          text not null check (length(chave) <= 200),
  responsavel_id uuid references auth.users on delete set null,
  ano            integer not null check (ano between 2000 and 2100),
  cliente        text not null check (length(cliente) <= 300),
  servico        text check (length(servico) <= 300),
  referencia     text check (length(referencia) <= 60),
  parcela_id     uuid references public.contrato_parcelas on delete set null,
  data_pago      date,
  valor_pago     bigint check (valor_pago > 0 and valor_pago <= 100000000000000),
  valor_esperado bigint check (valor_esperado >= 0),
  data_caixa     date,
  valor_caixa    bigint check (valor_caixa >= 0),
  conta_caixa    text check (length(conta_caixa) <= 120),
  sugestao       text not null check (sugestao in ('confere', 'nao_confere')),
  motivo         text check (length(motivo) <= 300),
  situacao       text check (situacao in ('confere', 'nao_confere')),
  observacao     text check (length(observacao) <= 1000),
  marcado_por    uuid references auth.users on delete set null,
  marcado_em     timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  unique (escritorio_id, chave)
);
create index financeiro_conferencia_responsavel on public.financeiro_conferencia (escritorio_id, ano, responsavel_id);
create trigger carimbo before update on public.financeiro_conferencia for each row execute function privado.carimbar();

create table public.financeiro_conferencia_historico (
  id             bigint generated always as identity primary key,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  conferencia_id uuid not null references public.financeiro_conferencia on delete cascade,
  alteracoes     jsonb not null,
  feito_por      uuid references auth.users on delete set null,
  em             timestamptz not null default now()
);
create index financeiro_conferencia_historico_linha on public.financeiro_conferencia_historico (conferencia_id, em desc);

create function privado.historico_conferencia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}';
begin
  if new.data_pago is distinct from old.data_pago then
    a := a || jsonb_build_object('Pago em', jsonb_build_object('de', to_char(old.data_pago, 'DD/MM/YYYY'), 'para', to_char(new.data_pago, 'DD/MM/YYYY')));
  end if;
  if new.valor_pago is distinct from old.valor_pago then
    a := a || jsonb_build_object('Valor pago', jsonb_build_object('de', case when old.valor_pago is not null then privado.em_reais(old.valor_pago) end, 'para', privado.em_reais(new.valor_pago)));
  end if;
  if new.situacao is distinct from old.situacao then
    a := a || jsonb_build_object('Situação', jsonb_build_object('de', old.situacao, 'para', new.situacao));
  end if;
  if new.observacao is distinct from old.observacao then
    a := a || jsonb_build_object('Observação', jsonb_build_object('de', old.observacao, 'para', new.observacao));
  end if;
  if a <> '{}' then
    insert into public.financeiro_conferencia_historico (escritorio_id, conferencia_id, alteracoes, feito_por) values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.financeiro_conferencia for each row execute function privado.historico_conferencia();

-- Vê a linha quem é o responsável por ela e os administradores. A escrita é só pelas funções abaixo.
create function privado.confiro_a_linha(p_responsavel uuid, p_escritorio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio() and (privado.sou_admin() or p_responsavel = auth.uid())
$$;
grant execute on function privado.confiro_a_linha(uuid, uuid) to authenticated;

alter table public.financeiro_conferencia enable row level security;
revoke all on public.financeiro_conferencia from anon;
revoke insert, update, delete on public.financeiro_conferencia from authenticated;
create policy leitura on public.financeiro_conferencia for select to authenticated using (privado.confiro_a_linha(responsavel_id, escritorio_id));

alter table public.financeiro_conferencia_historico enable row level security;
revoke all on public.financeiro_conferencia_historico from anon;
revoke insert, update, delete on public.financeiro_conferencia_historico from authenticated;
create policy leitura on public.financeiro_conferencia_historico for select to authenticated
  using (exists (select 1 from public.financeiro_conferencia c where c.id = conferencia_id and privado.confiro_a_linha(c.responsavel_id, c.escritorio_id)));

-- As linhas de um ano. Quem não é administrador recebe só as dele, seja qual for o responsável pedido.
-- O que foi pago vem da parcela, quando a linha tem uma: ela também pode ser corrigida no cartão do contrato.
create function public.financeiro_conferencia_listar(p_ano integer, p_responsavel uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(l) order by coalesce(l.data_pago, l.data_caixa) desc nulls last, l.cliente, l.id), '[]')
  from (
    select c.id, c.ano, c.responsavel_id, c.cliente, c.servico, c.referencia, c.parcela_id,
           coalesce(p.recebida_em, c.data_pago) as data_pago, coalesce(p.recebido, c.valor_pago) as valor_pago,
           c.valor_esperado, c.data_caixa, c.valor_caixa, c.conta_caixa, c.sugestao, c.motivo, c.situacao, c.observacao, c.marcado_por, c.marcado_em
    from public.financeiro_conferencia c
    left join public.contrato_parcelas p on p.id = c.parcela_id
    where c.ano = p_ano and (p_responsavel is null or c.responsavel_id = p_responsavel)
      and privado.confiro_a_linha(c.responsavel_id, c.escritorio_id)
  ) l
$$;
revoke execute on function public.financeiro_conferencia_listar(integer, uuid) from public, anon;
grant execute on function public.financeiro_conferencia_listar(integer, uuid) to authenticated;

create function public.financeiro_conferencia_marcar(p_linha uuid, p_situacao text, p_observacao text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.financeiro_conferencia; v_observacao text := nullif(btrim(p_observacao), '');
begin
  select * into c from public.financeiro_conferencia where id = p_linha for update;
  if c.id is null or not privado.confiro_a_linha(c.responsavel_id, c.escritorio_id) then
    raise exception 'Só o responsável pela linha ou um administrador confere.' using errcode = '42501';
  end if;
  if p_situacao is not null and p_situacao not in ('confere', 'nao_confere') then raise exception 'Escolha Confere ou Não confere.'; end if;
  if length(v_observacao) > 1000 then raise exception 'A observação está longa demais.'; end if;
  update public.financeiro_conferencia set situacao = p_situacao, observacao = v_observacao,
    marcado_por = case when p_situacao is null and v_observacao is null then null else auth.uid() end,
    marcado_em = case when p_situacao is null and v_observacao is null then null else now() end
  where id = p_linha;
end $$;
revoke execute on function public.financeiro_conferencia_marcar(uuid, text, text) from public, anon;
grant execute on function public.financeiro_conferencia_marcar(uuid, text, text) to authenticated;

create function public.financeiro_conferencia_corrigir(p_linha uuid, p_data date, p_valor bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.financeiro_conferencia; p public.contrato_parcelas;
begin
  select * into c from public.financeiro_conferencia where id = p_linha for update;
  if c.id is null or not privado.confiro_a_linha(c.responsavel_id, c.escritorio_id) then
    raise exception 'Só o responsável pela linha ou um administrador corrige.' using errcode = '42501';
  end if;
  if p_data is null or p_data < date '2000-01-01' or p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data do pagamento não pode estar no futuro.';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000000000000 then raise exception 'Confira o valor pago.'; end if;
  select * into p from public.contrato_parcelas where id = c.parcela_id for update;
  if p.recebimento_id is not null then raise exception 'Esta parcela foi recebida pelo caixa. Corrija por lá.'; end if;
  update public.financeiro_conferencia set data_pago = p_data, valor_pago = p_valor where id = p_linha;
  if p.id is not null and p.recebida_em is not null and p.excluido_em is null then
    update public.contrato_parcelas set recebida_em = p_data, recebido = p_valor where id = p.id;
  end if;
end $$;
revoke execute on function public.financeiro_conferencia_corrigir(uuid, date, bigint) from public, anon;
grant execute on function public.financeiro_conferencia_corrigir(uuid, date, bigint) to authenticated;

-- O resumo do escritório, por responsável e por ano. Só para administradores. O valor de cada linha é o pago, ou o que entrou no caixa.
create function public.financeiro_conferencia_resumo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.sou_admin() then raise exception 'Só um administrador vê o resumo.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.ano desc, r.responsavel_id nulls last)
    from (
      select c.responsavel_id, c.ano, count(*)::integer as total,
             count(*) filter (where c.situacao = 'confere')::integer as confere,
             count(*) filter (where c.situacao = 'nao_confere')::integer as nao_confere,
             count(*) filter (where c.situacao is null)::integer as falta,
             coalesce(sum(v.valor) filter (where c.situacao = 'confere'), 0)::bigint as valor_confere,
             coalesce(sum(v.valor) filter (where c.situacao = 'nao_confere'), 0)::bigint as valor_nao_confere,
             coalesce(sum(v.valor) filter (where c.situacao is null), 0)::bigint as valor_falta
      from public.financeiro_conferencia c
      left join public.contrato_parcelas p on p.id = c.parcela_id
      cross join lateral (select coalesce(p.recebido, c.valor_pago, c.valor_caixa, 0) as valor) v
      where c.escritorio_id = privado.meu_escritorio()
      group by c.responsavel_id, c.ano
    ) r
  ), '[]');
end $$;
revoke execute on function public.financeiro_conferencia_resumo() from public, anon;
grant execute on function public.financeiro_conferencia_resumo() to authenticated;
