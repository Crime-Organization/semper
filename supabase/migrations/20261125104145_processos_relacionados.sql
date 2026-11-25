-- =====================================================================
-- Processos relacionados, de qualquer tipo (#440)
--   Um processo se liga a outro que já existe, de qualquer tipo: judicial com judicial, administrativo com administrativo, judicial
--   com administrativo e o contrário. Cada um mostra o outro na seção "Processos relacionados" do cartão, como "Relacionado". A
--   ligação é uma linha só para os dois: desfeita num cartão, some dos dois. É o mesmo modelo das demandas relacionadas
--   (20261122125913_demandas_relacionadas.sql). As ligações de origem (recurso, incidental e o judicial que nasceu do administrativo,
--   em processos.origem_id) continuam como estão.
--   - A linha guarda os dois em ordem (processo_a < processo_b), para o mesmo par não entrar duas vezes, em qualquer sentido, nem o
--     processo com ele mesmo. O gatilho põe em ordem o que vier e grava o código de cada um (codigo_a, codigo_b).
--   - Ver: quem vê um dos dois processos vê a ligação.
--   - Ligar: quem está nos dois (privado.estou_no_processo, a regra de alterar o processo), com os dois ativos, do mesmo escritório.
--   - Desfazer: quem está em um dos dois (mesmo arquivado).
--   - Sai sozinha quando um dos processos é excluído.
-- Só acrescenta (uma tabela, duas funções e um gatilho). A versão anterior do site continua funcionando: ela não conhece a ligação.
-- =====================================================================

create table public.processos_relacionados (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  processo_a    uuid not null constraint processos_relacionados_a references public.processos on delete cascade,
  processo_b    uuid not null constraint processos_relacionados_b references public.processos on delete cascade,
  codigo_a      text not null default '',     -- o código de cada um, dado pelo gatilho
  codigo_b      text not null default '',
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  primary key (processo_a, processo_b),
  constraint processos_relacionados_em_ordem check (processo_a < processo_b)
);
create index processos_relacionados_pelo_b on public.processos_relacionados (processo_b);

-- Antes de gravar: os dois em ordem, e o código de cada um. Os dois precisam ser do escritório da linha. A recusa é a mesma de
-- quem não tem permissão (42501), para não contar a ninguém se um id de outro escritório existe.
create function privado.preparar_processo_relacionado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_troca uuid;
begin
  if new.processo_a > new.processo_b then
    v_troca := new.processo_a; new.processo_a := new.processo_b; new.processo_b := v_troca;
  end if;
  select codigo into new.codigo_a from public.processos where id = new.processo_a and escritorio_id = new.escritorio_id;
  select codigo into new.codigo_b from public.processos where id = new.processo_b and escritorio_id = new.escritorio_id;
  if new.codigo_a is null or new.codigo_b is null then raise exception 'Processo não encontrado neste escritório.' using errcode = '42501'; end if;
  return new;
end $$;
revoke execute on function privado.preparar_processo_relacionado() from public, anon, authenticated;
create trigger preparar before insert on public.processos_relacionados for each row execute function privado.preparar_processo_relacionado();

-- Quem está logado está no processo (como a regra "alterar" dele); com p_ativo, só se ele não está arquivado.
create function privado.estou_no_processo_do_id(p_processo uuid, p_ativo boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.processos p
                 where p.id = p_processo and (not p_ativo or p.arquivado_em is null)
                   and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos))
$$;
revoke execute on function privado.estou_no_processo_do_id(uuid, boolean) from public, anon;
grant execute on function privado.estou_no_processo_do_id(uuid, boolean) to authenticated;

alter table public.processos_relacionados enable row level security;
revoke all on public.processos_relacionados from anon;
revoke update, truncate on public.processos_relacionados from authenticated;
grant select, insert, delete on public.processos_relacionados to authenticated;
create policy leitura on public.processos_relacionados for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (exists (select 1 from public.processos p where p.id = processo_a)
              or exists (select 1 from public.processos p where p.id = processo_b)));
create policy incluir on public.processos_relacionados for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.estou_no_processo_do_id(processo_a, true) and privado.estou_no_processo_do_id(processo_b, true));
create policy apagar on public.processos_relacionados for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (privado.estou_no_processo_do_id(processo_a, false) or privado.estou_no_processo_do_id(processo_b, false)));
