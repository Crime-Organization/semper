-- =====================================================================
-- 002 · Desempenho das regras de acesso
--   auth.uid() dentro de (select ...) é calculado uma vez por consulta,
--   e não linha a linha (recomendação do Supabase). Índices para mover
--   cartões entre colunas e excluir colunas sem varrer a tabela.
-- =====================================================================

alter policy alterar on public.perfis
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy incluir on public.quadro_colunas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()));
alter policy alterar on public.quadro_colunas
  using (escritorio_id = (select privado.meu_escritorio()) and ((select privado.sou_admin()) or criado_por = (select auth.uid())))
  with check (escritorio_id = (select privado.meu_escritorio()));

alter policy proprias on public.quadro_colunas_ocultas
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()) and exists (
    select 1 from public.quadro_colunas c where c.id = coluna_id and c.escritorio_id = (select privado.meu_escritorio())));

alter policy incluir on public.pessoas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_valida(etapa_id, 'pessoas'));
alter policy apagar on public.pessoas
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));

create index pessoas_etapa_id on public.pessoas (etapa_id);
create index quadro_colunas_ocultas_coluna on public.quadro_colunas_ocultas (coluna_id);
