-- =====================================================================
-- As demandas contínuas do escritório, para a lista "sem demanda" de ligar tarefas (#313, correção da parte C)
--   A busca de tarefas para ligar a uma demanda, com "sem demanda", conta como avulsa a tarefa sem nenhuma demanda ou só na contínua.
--   O site achava as contínuas lendo a tabela de demandas, que passa pelas regras de leitura: quem não está no grupo de uma contínua
--   não a vê, e a tarefa avulsa dessa contínua em que ele está (por exemplo, como responsável, sendo de outro núcleo) sumia da lista.
--   Esta função devolve os ids de todas as contínuas do escritório de quem está logado, sem depender de quem lê. Ela não conta nada
--   que abra uma tarefa ou uma demanda: só os ids (o título e as tarefas continuam passando pelas regras de leitura).
--
-- Só acrescenta: uma função nova. A versão anterior do site não a usa e continua funcionando.
-- =====================================================================

create function public.demandas_continuas() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id order by d.id), '{}') from public.demandas d
  where d.continua and d.escritorio_id = privado.meu_escritorio()
$$;
revoke execute on function public.demandas_continuas() from public, anon;
grant execute on function public.demandas_continuas() to authenticated;
