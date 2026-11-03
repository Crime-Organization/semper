-- =====================================================================
-- Financeiro: os descontos do contrato entram na conta das parcelas (parte da tarefa #49)
--   Decisão do escritório de 02/11/2026: os descontos saem do valor do contrato antes de dividir. Só muda o que for gerado daqui em
--   diante: as parcelas que já existem ficam como estão. A conta é a de parcelasDoContrato em app/src/regras/parcelas.ts.
--   Só troca o corpo de uma função interna, com a mesma assinatura. A versão anterior do site continua funcionando.
-- =====================================================================

create or replace function privado.gerar_parcelas(k public.contratos, p_hoje date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint := round(coalesce(k.valor, 0) * 100) - round(coalesce(k.descontos, 0) * 100);
  v_entrada bigint := least(round(coalesce(k.entrada, 0) * 100), greatest(v_total, 0));
  v_resto bigint := v_total - v_entrada;
  v_n integer := greatest(coalesce(k.parcelas, 1), 1);
  v_primeiro date := coalesce(k.primeiro_pagamento, k.assinado_em, p_hoje);
  v_partes bigint; v_base bigint; v_quantas integer := 0;
begin
  if k.categoria in ('quota_litis', 'sucumbencia', 'pro_bono') or v_total <= 0 then return 0; end if;
  if v_primeiro not between date '2000-01-01' and date '2100-12-31' then return 0; end if;
  v_partes := least(case when v_entrada > 0 then case when v_resto > 0 then greatest(v_n - 1, 1) else 0 end else v_n end, v_resto);
  v_base := case when v_partes > 0 then v_resto / v_partes else 0 end;
  if v_entrada > 0 then
    insert into public.contrato_parcelas (contrato_id, vencimento, valor, criado_por)
    values (k.id, v_primeiro, v_entrada, coalesce(auth.uid(), k.criado_por));
    v_quantas := 1;
  end if;
  for i in 1 .. v_partes loop
    insert into public.contrato_parcelas (contrato_id, vencimento, valor, criado_por)
    values (k.id, (v_primeiro + make_interval(months => v_quantas))::date, case when i = v_partes then v_resto - v_base * (v_partes - 1) else v_base end, coalesce(auth.uid(), k.criado_por));
    v_quantas := v_quantas + 1;
  end loop;
  if v_quantas > 0 then
    insert into public.contrato_parcelas_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (k.escritorio_id, k.id, jsonb_build_object('Parcelas', jsonb_build_object('de', null, 'para', v_quantas || ' geradas, somando ' || privado.em_reais(v_total))), auth.uid());
  end if;
  return v_quantas;
end $$;
