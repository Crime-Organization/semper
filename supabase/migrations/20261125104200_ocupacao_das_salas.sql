-- =====================================================================
-- A visão das salas na Agenda (#438): todas as salas do escritório lado a lado, num dia, para ver de uma vez qual está livre.
--   - ocupacao_das_salas: quem ocupa cada sala no dia, de todas as salas numa leitura só. É a mesma ocupação de ocupacao_da_sala
--     (#308, 20261122132438_salas_do_escritorio.sql): os compromissos ativos e não cancelados, de qualquer pessoa, com o código e o
--     horário de todos; o título, só dos que quem pergunta vê (pela regra de leitura dos compromissos). Quem não participa vê só que a
--     sala está ocupada.
--   - Roda com a permissão de quem pergunta (não é security definer): as salas vêm pela regra de leitura delas, que só mostra as do
--     escritório de quem está logado, e a conta repete o escritório. Um escritório nunca vê as salas nem a ocupação de outro.
--
--   Só acrescenta: uma função nova. A versão anterior do site continua funcionando: ela não a chama, e nada do que existe muda.
-- =====================================================================

create function public.ocupacao_das_salas(p_data date)
returns table (sala_id uuid, id uuid, codigo text, tipo text, hora time, hora_fim time, titulo text)
language sql stable set search_path = '' as $$
  select s.id, o.id, o.codigo, o.tipo, o.hora, o.hora_fim, (select c.titulo from public.compromissos c where c.id = o.id)
  from public.salas s
  cross join lateral privado.ocupacoes_da_sala(s.id, p_data, null) o
  where s.escritorio_id = (select privado.meu_escritorio())
  order by s.id, o.hora nulls first, o.codigo
$$;
revoke execute on function public.ocupacao_das_salas(date) from public, anon;
grant execute on function public.ocupacao_das_salas(date) to authenticated;
