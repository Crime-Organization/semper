-- =====================================================================
-- Meu tempo trabalhado (tarefa #147)
--   Quanto uma pessoa trabalhou em cada tarefa num período (esta semana,
--   este mês, um intervalo), para a visão "Meu tempo trabalhado".
--   - A função roda com as permissões de quem pede (security invoker): as
--     regras de tarefa_tempos e de tarefas valem como sempre. Cada um soma só
--     o próprio tempo; os administradores, o de qualquer um do escritório.
--     Pedir o tempo de outro sem ser administrador devolve nada.
--   - Cada período conta no momento em que começou; o ajuste, quando foi feito.
--   - O tempo de cada tarefa nunca fica negativo (um ajuste maior que o
--     contado zera a tarefa, e ela sai da lista).
--   Só acrescenta (uma função). A versão anterior do site continua funcionando.
-- =====================================================================

create function public.tempo_por_tarefa(p_perfil uuid, p_de timestamptz, p_ate timestamptz)
returns table (tarefa_id uuid, codigo text, titulo text, demanda_codigo text, arquivada boolean, segundos bigint)
language sql stable security invoker set search_path = '' as $$
  select r.tarefa_id, t.codigo, t.titulo, t.demanda_codigo, t.arquivado_em is not null, sum(r.segundos)::bigint
  from public.tarefa_tempos r
  join public.tarefas t on t.id = r.tarefa_id
  where r.perfil_id = p_perfil and r.inicio >= p_de and r.inicio < p_ate
  group by r.tarefa_id, t.codigo, t.titulo, t.demanda_codigo, t.arquivado_em
  having sum(r.segundos) > 0
  order by sum(r.segundos) desc, t.titulo
$$;
revoke execute on function public.tempo_por_tarefa(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.tempo_por_tarefa(uuid, timestamptz, timestamptz) to authenticated;
