-- Toda demanda é um objeto do contrato (privado.demandas_do_contrato cria uma por objeto quando o contrato chega ao
-- assinado). Os contratos que vieram das planilhas entraram marcados em privado.contratos_com_demandas, mas a maioria
-- sem as demandas. Esta migração cria, uma vez, a demanda de cada objeto que ainda não tem uma:
--   - contrato na coluna do assinado: a demanda vai para a coluna de início das demandas ("Para fazer");
--   - contrato que já passou do assinado (ex.: "Encerrado"): vai para a coluna de concluídas.
-- Só acrescenta linhas. Contratos que nunca chegaram ao assinado (não marcados) e os arquivados ficam de fora: os
-- primeiros ganham as demandas quando chegarem ao assinado. Rodar de novo não duplica (o objeto que já tem demanda sai).

insert into public.demandas (escritorio_id, titulo, responsavel_id, clientes, contrato_id, objeto, etapa_id, etapa_ordem, criado_por)
select c.escritorio_id, o.texto, c.responsavel_id, c.clientes, c.id, o.texto,
       (select q.id from public.quadro_colunas q
         where q.escritorio_id = c.escritorio_id and q.modulo = 'demandas'
           and q.marco = case when col.marco = 'assinado' then 'inicio' else 'concluido' end),
       extract(epoch from clock_timestamp()) + o.n / 1000.0,
       c.criado_por
from public.contratos c
join privado.contratos_com_demandas x on x.contrato_id = c.id
left join public.quadro_colunas col on col.id = c.etapa_id
cross join lateral unnest(c.objetos) with ordinality as o(texto, n)
where c.arquivado_em is null
  and not exists (select 1 from public.demandas d where d.contrato_id = c.id and d.objeto = o.texto);
