-- =====================================================================
-- O filtro "Grupo da equipe" traz também as tarefas da demanda contínua do grupo (#416, respostas do dono de 23/11)
--   A tarefa avulsa entra na contínua do grupo (20261123003418_demanda_continua.sql), mas a contínua não tem grupos (só
--   continua_grupo_id), e public.tarefas_dos_grupos olhava só os grupos da tarefa e os das demandas dela. Agora:
--   - o filtro de um grupo traz também as tarefas da contínua desse grupo; "Dos meus grupos", as das contínuas dos meus grupos;
--   - a opção "Geral" traz as tarefas da contínua Geral (a de quem não está em grupo nenhum);
--   - o filtro só escolhe entre as tarefas que a pessoa já vê: a função das tarefas roda como quem chama (as regras de leitura das
--     tarefas valem). Quem está fora do grupo X e numa tarefa da contínua de X (como responsável, por exemplo) vê essa tarefa ao
--     filtrar por X: para isso, os ids das contínuas pedidas vêm de uma função que não passa pelas regras de leitura das demandas
--     (quem está fora do grupo não vê a contínua dele). Ela devolve só ids, e só do escritório de quem está logado, como
--     public.demandas_continuas() (20261123022647_demandas_continuas_do_escritorio.sql). Quem vê o quê continua igual.
--
-- Só acrescenta: duas funções novas, e public.tarefas_dos_grupos (a que a versão anterior do site chama) com a mesma assinatura,
-- que traz o mesmo de antes e mais as tarefas das contínuas dos grupos pedidos. A versão anterior continua funcionando.
-- =====================================================================

-- 1. Os ids das contínuas dos grupos pedidos (e da Geral, com p_geral), só do escritório de quem está logado.
create function privado.continuas_do_filtro(p_grupos uuid[], p_geral boolean) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id order by d.id), '{}') from public.demandas d
  where d.continua and d.escritorio_id = privado.meu_escritorio()
    and (d.continua_grupo_id = any (coalesce(p_grupos, '{}')) or (coalesce(p_geral, false) and d.continua_grupo_id is null))
$$;
revoke execute on function privado.continuas_do_filtro(uuid[], boolean) from public, anon;
grant execute on function privado.continuas_do_filtro(uuid[], boolean) to authenticated;

-- 2. As tarefas do filtro: as de 20261122130410_tarefa_em_varias_demandas_e_contratos.sql (as que têm um dos grupos e as das
--    demandas que têm um deles) e mais as das contínuas pedidas. Roda como quem chama: as regras de leitura das tarefas valem, e a
--    tela filtra, ordena e pagina o resultado como a tabela.
create function public.tarefas_do_filtro_de_grupo(p_grupos uuid[], p_geral boolean) returns setof public.tarefas
language sql stable set search_path = '' as $$
  with c as (select privado.continuas_do_filtro(p_grupos, p_geral) as ids)
  select t.* from public.tarefas t, c
  where t.grupos && p_grupos
     or t.demanda_id in (select d.id from public.demandas d where d.grupos && p_grupos)
     or (cardinality(t.demanda_ids) > 1 and t.demanda_ids && array(select d.id from public.demandas d where d.grupos && p_grupos))
     or t.demanda_id = any (c.ids)
     or t.demanda_ids && c.ids
$$;
revoke execute on function public.tarefas_do_filtro_de_grupo(uuid[], boolean) from public, anon;
grant execute on function public.tarefas_do_filtro_de_grupo(uuid[], boolean) to authenticated;

-- 3. A da versão anterior do site, com a mesma assinatura: o mesmo de antes e mais as contínuas dos grupos pedidos.
CREATE OR REPLACE FUNCTION public.tarefas_dos_grupos(p_grupos uuid[])
 RETURNS SETOF tarefas
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from public.tarefas_do_filtro_de_grupo(p_grupos, false)
$function$;
