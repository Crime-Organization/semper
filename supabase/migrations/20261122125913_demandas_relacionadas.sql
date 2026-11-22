-- =====================================================================
-- Demandas relacionadas (#310)
--   Uma demanda se liga a outra, e cada uma mostra a outra na seção "Demandas relacionadas" do cartão, com o número. A ligação é
--   uma linha só para as duas: desfeita num cartão, some dos dois.
--   - A linha guarda as duas em ordem (demanda_a < demanda_b), para o mesmo par não entrar duas vezes, em qualquer sentido. O
--     gatilho põe em ordem o que vier e grava o código de cada uma (codigo_a, codigo_b), como contrato_codigo na demanda: quem vê
--     uma só das duas sabe que a outra existe e o número dela, sem ver o conteúdo (a outra, pela regra de leitura das demandas,
--     não abre para ele).
--   - Ver: quem vê uma das duas demandas vê a ligação.
--   - Ligar: quem está nas duas (privado.estou_na_demanda: administradores, quem criou, o responsável, os colaboradores, os grupos
--     e, na fase de adaptação, toda a equipe), com as duas ativas, do mesmo escritório.
--   - Desfazer: quem está em uma das duas (mesmo arquivada, ou sem ver a outra).
--   - Sai sozinha quando uma das demandas é excluída.
-- Só acrescenta (uma tabela, duas funções e um gatilho). A versão anterior do site continua funcionando: ela não conhece a ligação.
-- =====================================================================

create table public.demandas_relacionadas (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  demanda_a     uuid not null constraint demandas_relacionadas_a references public.demandas on delete cascade,
  demanda_b     uuid not null constraint demandas_relacionadas_b references public.demandas on delete cascade,
  codigo_a      text not null default '',     -- o número de cada uma, para mostrar mesmo a quem não pode abri-la (dado pelo gatilho)
  codigo_b      text not null default '',
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  primary key (demanda_a, demanda_b),
  constraint demandas_relacionadas_em_ordem check (demanda_a < demanda_b)
);
create index demandas_relacionadas_pela_b on public.demandas_relacionadas (demanda_b);

-- Antes de gravar: as duas em ordem, e o código de cada uma. As duas precisam ser do escritório da linha. A recusa é a mesma de
-- quem não tem permissão (42501), para não contar a ninguém se um id de outro escritório existe.
create function privado.preparar_demanda_relacionada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_troca uuid;
begin
  if new.demanda_a > new.demanda_b then
    v_troca := new.demanda_a; new.demanda_a := new.demanda_b; new.demanda_b := v_troca;
  end if;
  select codigo into new.codigo_a from public.demandas where id = new.demanda_a and escritorio_id = new.escritorio_id;
  select codigo into new.codigo_b from public.demandas where id = new.demanda_b and escritorio_id = new.escritorio_id;
  if new.codigo_a is null or new.codigo_b is null then raise exception 'Demanda não encontrada neste escritório.' using errcode = '42501'; end if;
  return new;
end $$;
revoke execute on function privado.preparar_demanda_relacionada() from public, anon, authenticated;
create trigger preparar before insert on public.demandas_relacionadas for each row execute function privado.preparar_demanda_relacionada();

-- Quem está logado está na demanda (como a regra "alterar" dela); com p_ativa, só se ela não está arquivada.
create function privado.estou_na_demanda_do_id(p_demanda uuid, p_ativa boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.demandas d
                 where d.id = p_demanda and (not p_ativa or d.arquivado_em is null)
                   and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))
$$;
revoke execute on function privado.estou_na_demanda_do_id(uuid, boolean) from public, anon;
grant execute on function privado.estou_na_demanda_do_id(uuid, boolean) to authenticated;

alter table public.demandas_relacionadas enable row level security;
revoke all on public.demandas_relacionadas from anon;
revoke update, truncate on public.demandas_relacionadas from authenticated;
grant select, insert, delete on public.demandas_relacionadas to authenticated;
create policy leitura on public.demandas_relacionadas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (exists (select 1 from public.demandas d where d.id = demanda_a)
              or exists (select 1 from public.demandas d where d.id = demanda_b)));
create policy incluir on public.demandas_relacionadas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.estou_na_demanda_do_id(demanda_a, true) and privado.estou_na_demanda_do_id(demanda_b, true));
create policy apagar on public.demandas_relacionadas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (privado.estou_na_demanda_do_id(demanda_a, false) or privado.estou_na_demanda_do_id(demanda_b, false)));
