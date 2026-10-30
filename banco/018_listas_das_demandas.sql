-- =====================================================================
-- 018 · Listas nas demandas
--   Cada demanda pode ter listas, como as do Trello, para os documentos e
--   os passos ligados a ela (ex.: "Pessoa jurídica": comprovante de
--   inscrição, quadro de sócios, atos constitutivos).
--   - Várias listas por demanda, cada uma com nome e posição.
--   - Itens com posição, data de entrega opcional e a marca de feito
--     (quando e por quem, dados pelo banco).
--   - Quem vê a demanda vê e mexe nas listas dela (a regra da demanda vale
--     para as listas e os itens).
--   Só acrescenta (tabelas, gatilhos e regras novos). A versão anterior do
--   site continua funcionando (ela não usa listas).
-- =====================================================================

create table public.demanda_listas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  demanda_id    uuid not null references public.demandas on delete cascade,
  nome          text not null check (btrim(nome) <> '' and length(nome) <= 120),   -- TAMANHO_LISTA em limites.ts
  ordem         double precision not null default 0,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now()
);
create index demanda_listas_demanda on public.demanda_listas (demanda_id, ordem);

create table public.demanda_lista_itens (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  lista_id      uuid not null references public.demanda_listas on delete cascade,
  texto         text not null check (btrim(texto) <> '' and length(texto) <= 500),   -- TAMANHO_ITEM em limites.ts
  prazo         date,                            -- data de entrega (opcional)
  feito_em      timestamptz,                     -- quando foi marcado como feito (null: por fazer)
  feito_por     uuid references auth.users on delete set null,
  ordem         double precision not null default 0,
  criado_em     timestamptz not null default now()
);
create index demanda_lista_itens_lista on public.demanda_lista_itens (lista_id, ordem);

-- Nome e texto sem espaços nas pontas.
create function privado.limpar_lista() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  return new;
end $$;
create trigger limpar before insert or update of nome on public.demanda_listas for each row execute function privado.limpar_lista();

-- Marcar como feito: o banco anota quando e quem; desmarcar apaga os dois.
create function privado.preparar_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.texto := btrim(new.texto);
  if new.feito_em is null then
    new.feito_por := null;
  elsif tg_op = 'INSERT' or old.feito_em is null then
    new.feito_em := now();
    new.feito_por := auth.uid();
  else
    new.feito_em := old.feito_em;
    new.feito_por := old.feito_por;
  end if;
  return new;
end $$;
create trigger preparar before insert or update of texto, feito_em on public.demanda_lista_itens
  for each row execute function privado.preparar_item();

alter table public.demanda_listas      enable row level security;
alter table public.demanda_lista_itens enable row level security;
revoke all on public.demanda_listas, public.demanda_lista_itens from anon;
revoke update on public.demanda_listas, public.demanda_lista_itens from authenticated;
grant update (nome, ordem) on public.demanda_listas to authenticated;
grant update (texto, prazo, feito_em, ordem) on public.demanda_lista_itens to authenticated;

-- Quem vê a demanda vê e mexe nas listas dela: a consulta à demanda passa pela regra de leitura da demanda.
create policy tudo on public.demanda_listas for all to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demandas d where d.id = demanda_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demandas d where d.id = demanda_id));
create policy tudo on public.demanda_lista_itens for all to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demanda_listas l where l.id = lista_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demanda_listas l where l.id = lista_id));
