-- =====================================================================
-- 019 · Modelos de lista
--   Listas-modelo do escritório (ex.: "Documentos de pessoa jurídica"),
--   para não escrever as mesmas listas em cada demanda. Usar um modelo
--   copia o nome e os itens para a demanda: mudar o modelo depois não
--   muda as listas que já foram feitas com ele.
--   - Comuns a toda a equipe do escritório: qualquer um cria e edita;
--     quem criou ou um administrador exclui.
--   - Sem nomes repetidos no escritório (maiúsculas e acentos não contam).
--   - Os itens ficam na ordem, sem espaços nas pontas e sem linhas vazias.
--   Só acrescenta (tabela, gatilho e regras novos). A versão anterior do
--   site continua funcionando.
-- =====================================================================

create table public.lista_modelos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome          text not null check (btrim(nome) <> '' and length(nome) <= 120),   -- TAMANHO_LISTA em limites.ts
  itens         text[] not null default '{}' check (cardinality(itens) <= 100),     -- ITENS_DO_MODELO em limites.ts
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index lista_modelos_nome_unico on public.lista_modelos (escritorio_id, privado.sem_acento(btrim(nome)));

-- Nome sem espaços nas pontas; itens limpos (sem espaços nas pontas e sem linhas vazias), cada um com até 500 letras.
create function privado.preparar_modelo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  new.itens := coalesce((select array_agg(btrim(i) order by n) from unnest(new.itens) with ordinality as u(i, n) where btrim(i) <> ''), '{}');
  if exists (select 1 from unnest(new.itens) i where length(i) > 500) then
    raise exception 'Cada item do modelo pode ter até 500 caracteres.';
  end if;
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  return new;
end $$;
create trigger preparar before insert or update on public.lista_modelos for each row execute function privado.preparar_modelo();

alter table public.lista_modelos enable row level security;
revoke all on public.lista_modelos from anon;
revoke update on public.lista_modelos from authenticated;
grant update (nome, itens) on public.lista_modelos to authenticated;

create policy leitura on public.lista_modelos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.lista_modelos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()));
create policy alterar on public.lista_modelos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.lista_modelos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
