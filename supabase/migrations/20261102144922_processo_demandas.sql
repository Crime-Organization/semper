-- =====================================================================
-- A demanda ligada ao processo (parte da tarefa #47)
--   - A demanda é o trabalho interno; o processo, o acompanhamento externo. Ao terminar a demanda, nasce o processo dela.
--   - Um processo pode ter várias demandas, e uma demanda, vários processos. O papel diz como se ligam; por enquanto, só
--     "originou" é gravado (a demanda deu origem ao processo). "atua" e "baseia" ficam prontos para quando houver tela.
--   - Quem vê um dos dois vê que a ligação existe; o outro lado só abre para quem pode vê-lo. Para ligar, é preciso ver os
--     dois, com o processo ativo.
--   - Por enquanto a ligação não é desfeita pela tela: sai junto com o processo ou com a demanda.
--   Só acrescenta (uma tabela). A versão anterior do site continua funcionando: ela não conhece a ligação.
-- =====================================================================
create table public.processo_demandas (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  processo_id   uuid not null references public.processos on delete cascade,
  demanda_id    uuid not null references public.demandas on delete cascade,
  papel         text not null default 'originou' check (papel in ('originou', 'atua', 'baseia')),
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  primary key (processo_id, demanda_id)
);
create index processo_demandas_demanda on public.processo_demandas (demanda_id);

alter table public.processo_demandas enable row level security;
revoke all on public.processo_demandas from anon;
revoke update, delete on public.processo_demandas from authenticated;
create policy leitura on public.processo_demandas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (exists (select 1 from public.processos p where p.id = processo_id)
              or exists (select 1 from public.demandas d where d.id = demanda_id)));
create policy incluir on public.processo_demandas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.processo_ativo(processo_id, escritorio_id)
              and exists (select 1 from public.demandas d where d.id = demanda_id and d.escritorio_id = processo_demandas.escritorio_id));
