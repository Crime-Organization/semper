-- =====================================================================
-- Data de início das negociações do contrato (#311)
--   O contrato ganha a data em que a negociação começou (no Figma "Samper"). Com ela e a data da assinatura, o cartão mostra
--   quantos dias a negociação levou (a conta é da tela, em app/src/regras/contrato.ts).
--   1. A coluna contratos.negociacao_inicio (data, vazia por padrão), que quem altera o contrato pode mudar (as regras de quem
--      altera, as políticas "alterar", não mudam; quem cria já pode gravá-la: a permissão de incluir vale para todas as colunas).
--   2. A view contratos_da_equipe passa a trazê-la, no fim, como a assinatura: é uma data, não um valor.
-- Só acrescenta: uma coluna, a permissão de mudá-la e uma coluna no fim da view (as outras, na mesma ordem). Nenhuma coluna, função ou
-- regra sai. A versão anterior do site continua funcionando:
--   - ela não conhece a coluna: as consultas dela pedem as colunas pelo nome (supabase.ts) e não a recebem, e os cadastros e as
--     atualizações dela não a mencionam (o contrato fica sem a data, ou com a que já tinha);
--   - o histórico do contrato (privado.historico_contrato) já olha todas as colunas: a mudança entra nele sozinha, como
--     {"negociacao_inicio": {"de": null, "para": "2026-11-01"}} (a versão anterior mostra o nome técnico e a data como o banco guarda).
-- =====================================================================

-- 1. A coluna e a permissão de mudá-la.
alter table public.contratos add column negociacao_inicio date;
grant update (negociacao_inicio) on public.contratos to authenticated;

-- 2. A view, igual à de 20261119233811_grupos_da_equipe.sql, com a data no fim.
create or replace view public.contratos_da_equipe with (security_barrier = true) as
select k.id, k.escritorio_id, k.numero, k.sigla, k.ano, k.codigo, k.codigo_antigo, k.cliente_id, k.cliente_nome, k.clientes, k.responsavel_id,
       k.servico, k.objetos, k.participante_id, k.etapa_id, k.etapa_ordem, k.assinado_em, k.arquivado_em, k.arquivado_por,
       k.criado_por, k.criado_em, k.atualizado_por, k.atualizado_em, k.busca,
       s.parte as ve_financeiro,
       case when s.parte then k.categoria end as categoria,
       case when s.parte then k.valor end as valor,
       case when s.parte then k.entrada end as entrada,
       case when s.parte then k.parcelas end as parcelas,
       case when s.parte then k.descontos end as descontos,
       case when s.parte then k.primeiro_pagamento end as primeiro_pagamento,
       case when s.parte then k.percentual_escritorio end as percentual_escritorio,
       case when s.parte then k.participante_percentual end as participante_percentual,
       case when s.parte then k.indicador_id end as indicador_id,
       case when s.parte then k.indicador_percentual end as indicador_percentual,
       case when s.parte then k.conta_destino_id end as conta_destino_id,
       case when s.parte then k.documento_url end as documento_url,
       case when s.parte then k.observacoes end as observacoes,
       case when s.parte then k.participantes
            else coalesce((select jsonb_agg(x - 'percentual') from jsonb_array_elements(k.participantes) x), '[]'::jsonb) end as participantes,
       (select coalesce(jsonb_agg(jsonb_build_object('ordem', c.ordem, 'pessoa', jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'arquivado_em', x.arquivado_em)) order by c.ordem), '[]'::jsonb)
        from public.contrato_clientes c join public.pessoas x on x.id = c.pessoa_id where c.contrato_id = k.id) as clientela,
       (select coalesce(jsonb_agg(jsonb_build_object('ordem', c.ordem, 'percentual', case when s.parte then c.percentual end, 'pessoa', jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'arquivado_em', x.arquivado_em)) order by c.ordem), '[]'::jsonb)
        from public.contrato_participantes c join public.pessoas x on x.id = c.pessoa_id where c.contrato_id = k.id) as participacoes,
       k.grupos,
       k.negociacao_inicio
from public.contratos k
cross join lateral (
  select coalesce((select privado.sou_admin())
      or (select auth.uid()) in (k.criado_por, k.responsavel_id)
      or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
      or k.id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[]), false) as parte
) s
where k.escritorio_id = (select privado.meu_escritorio())
  and (s.parte or (select privado.equipe_ve_tudo()) or k.grupos && (select privado.meus_grupos()));
