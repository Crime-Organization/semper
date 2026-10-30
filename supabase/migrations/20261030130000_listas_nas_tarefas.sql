-- =====================================================================
-- Listas nas tarefas (tarefa #148)
--   As listas que as demandas já têm (banco/018_listas_das_demandas.sql)
--   passam a existir também nas tarefas, com os mesmos itens, a mesma
--   marca de feito e os mesmos modelos.
--   - Cada lista é de uma demanda ou de uma tarefa, nunca das duas.
--   - Quem vê a tarefa vê e mexe nas listas dela (a regra da tarefa vale
--     para as listas e os itens, como já vale a da demanda).
--   - Excluir a tarefa exclui as listas dela.
--   As tabelas continuam com o nome "demanda_listas" e "demanda_lista_itens":
--   renomear quebraria a versão no ar.
--   Só acrescenta (uma coluna, uma regra de conferência e um índice) e afrouxa
--   o "demanda_id obrigatório". A versão anterior do site continua
--   funcionando: ela sempre grava a lista com a demanda e só lê por ela.
-- =====================================================================

alter table public.demanda_listas add column tarefa_id uuid references public.tarefas on delete cascade;
alter table public.demanda_listas alter column demanda_id drop not null;
alter table public.demanda_listas add constraint lista_de_um_cartao check (num_nonnulls(demanda_id, tarefa_id) = 1);
create index demanda_listas_tarefa on public.demanda_listas (tarefa_id, ordem) where tarefa_id is not null;

-- Quem vê a demanda ou a tarefa vê e mexe nas listas dela: a consulta passa pela regra de leitura de cada uma.
-- Os itens seguem a regra da lista (a política deles consulta demanda_listas).
alter policy tudo on public.demanda_listas
  using (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)))
  with check (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)));
