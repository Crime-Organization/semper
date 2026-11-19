-- =====================================================================
-- Painel de Processos com o tipo do andamento da lista pronta (#371)
--   O painel (public.painel_de_processos, de 20261102135353_painel_de_processos.sql) passa a trazer também a coluna "categoria"
--   de cada andamento (o tipo da lista pronta da #362: despacho, decisão, sentença, intimação, petição, audiência). Assim, os
--   "Últimos andamentos" mostram o mesmo nome da caixa do andamento (nomeDoAndamento em app/src/regras/andamentos.ts).
--   A função é a mesma, letra por letra, com "a.categoria" a mais na lista dos andamentos.
--   Só acrescenta: o mesmo nome, os mesmos argumentos e o mesmo retorno (create or replace mantém as permissões). Cada andamento
--   ganha um campo a mais no JSON, que a versão anterior do site ignora: ela continua funcionando.
-- =====================================================================
create or replace function public.painel_de_processos(p_hoje date, p_ate_prazos date, p_ate_marcados date, p_meus boolean, p_limite integer, p_ultimos integer) returns jsonb
language sql stable set search_path = '' as $$
  with base as (
    select p.id, p.codigo, p.tipo, p.numero, p.titulo, p.cliente_nome, p.responsavel_id, p.colaboradores, p.clientes, p.etapa_id, p.distribuicao, p.criado_em
    from public.processos p
    where p.arquivado_em is null and (not p_meus or auth.uid() = p.responsavel_id or auth.uid() = any(p.colaboradores))
  ),
  andamentos as (
    select a.id, a.tipo, a.categoria, a.data, to_char(a.hora, 'HH24:MI') as hora, a.local, a.texto, a.tratada_em, a.tarefa_id, a.criado_em, to_jsonb(b) as processo
    from public.processo_andamentos a join base b on b.id = a.processo_id
    where a.excluido_em is null
  ),
  prazos as (
    select z.id, z.descricao, z.final, z.tarefa_id, to_jsonb(b) as processo
    from public.processo_prazos z join base b on b.id = z.processo_id
    where z.excluido_em is null and z.concluido_em is null and z.final <= p_ate_prazos
  ),
  marcados as (select * from andamentos where tipo in ('audiencia', 'pericia') and data between p_hoje and p_ate_marcados),
  intimacoes as (select * from andamentos where tipo = 'intimacao' and tratada_em is null and tarefa_id is null),
  dias as (select e.dias_processo_parado as n from public.escritorios e where e.id = privado.meu_escritorio()),
  parados as (
    select to_jsonb(b) as processo, u.ultimo, p_hoje - u.ultimo as dias
    from base b
    left join public.quadro_colunas c on c.id = b.etapa_id
    cross join lateral (
      select coalesce((select max(a.data) from public.processo_andamentos a where a.processo_id = b.id and a.excluido_em is null and a.data <= p_hoje),
                      b.distribuicao, (b.criado_em at time zone 'America/Sao_Paulo')::date) as ultimo
    ) u
    where c.marco is distinct from 'concluido' and p_hoje - u.ultimo > (select n from dias)
  )
  select jsonb_build_object(
    'prazos', coalesce((select jsonb_agg(x) from (
      (select * from prazos where final < p_hoje order by final, id limit p_limite)
      union all
      (select * from prazos where final >= p_hoje order by final, id limit p_limite)) x), '[]'),
    'total_vencidos', (select count(*) from prazos where final < p_hoje),
    'total_a_vencer', (select count(*) from prazos where final >= p_hoje),
    'marcados', coalesce((select jsonb_agg(x) from (select * from marcados order by data, hora nulls last, id limit p_limite) x), '[]'),
    'total_marcados', (select count(*) from marcados),
    'intimacoes', coalesce((select jsonb_agg(x) from (select * from intimacoes order by data, criado_em limit p_limite) x), '[]'),
    'total_intimacoes', (select count(*) from intimacoes),
    'ultimos', coalesce((select jsonb_agg(x) from (select * from andamentos where data <= p_hoje order by data desc, criado_em desc limit p_ultimos) x), '[]'),
    'parados', coalesce((select jsonb_agg(x) from (select * from parados order by dias desc limit p_limite) x), '[]'),
    'total_parados', (select count(*) from parados),
    'dias_parado', (select n from dias),
    'fases', coalesce((select jsonb_agg(x) from (select b.tipo, b.etapa_id, count(*) as n from base b group by b.tipo, b.etapa_id) x), '[]')
  )
$$;
