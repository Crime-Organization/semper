-- Corrigir uma parcela já recebida (#267). Só acrescenta (uma categoria a mais no caixa, uma coluna e duas funções);
-- a versão anterior do site mostra a categoria nova como está guardada, sem quebrar.
--   - Enquanto nada daquele recebimento foi pago (repasse ao responsável ou ao sócio, ou participante/indicador
--     marcado como pago), corrigir estorna o recebimento original (que fica no histórico) e registra o novo com os dados
--     corrigidos, de uma vez, com o motivo no registro de ações.
--   - Depois de algum pagamento, o original fica como está, e um administrador lança um registro de correção: uma saída
--     do caixa, ligada ao recebimento, com o motivo, para ficar registrado exatamente como aconteceu.

alter table public.financeiro_lancamentos drop constraint financeiro_lancamentos_check;
-- Cada categoria só serve para o seu tipo; a transferência tem uma ponta de cada. "correcao_recebimento": a saída que
-- corrige um recebimento depois de algum pagamento.
alter table public.financeiro_lancamentos add constraint financeiro_lancamentos_check
  check ((categoria in ('recebimento', 'outra_entrada', 'ajuste_a_mais') and tipo = 'entrada')
      or (categoria in ('despesa', 'das', 'repasse', 'indicacao', 'divisao_lucro', 'ajuste_a_menos', 'correcao_recebimento') and tipo = 'saida')
      or categoria = 'transferencia');
alter table public.financeiro_lancamentos add column corrige_recebimento uuid references public.financeiro_recebimentos;
comment on column public.financeiro_lancamentos.corrige_recebimento is 'O recebimento que este lançamento corrige (categoria correcao_recebimento).';

-- Algum valor daquele recebimento já foi pago a alguém?
create function privado.recebimento_tem_pagamento(p_recebimento uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.financeiro_repasses where recebimento_id = p_recebimento and pago_em is not null and cancelado_em is null)
      or exists (select 1 from public.financeiro_terceiros_pagos where recebimento_id = p_recebimento)
$$;
revoke execute on function privado.recebimento_tem_pagamento(uuid) from public, anon, authenticated;

-- Corrigir: estorna e registra de novo, com os mesmos parâmetros do recebimento completo e o motivo. Devolve o id do novo.
create function public.financeiro_corrigir_recebimento(p_recebimento uuid, p_data date, p_valor bigint, p_conta uuid, p_taxa bigint,
  p_categoria text, p_forma text, p_banco_recebido text, p_banco_envio text, p_parte integer, p_percentuais jsonb, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos; v_novo uuid;
begin
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo da correção.'; end if;
  select * into r from public.financeiro_recebimentos where id = p_recebimento for update;
  if r.id is null or not privado.cuido_do_contrato(r.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador corrige o recebimento.' using errcode = '42501'; end if;
  if r.estornado_em is not null then raise exception 'Este recebimento já foi estornado.'; end if;
  perform 1 from public.financeiro_repasses where recebimento_id = r.id for update;
  if privado.recebimento_tem_pagamento(r.id) then
    raise exception 'Já há pagamento feito deste recebimento: ele fica como está. Lance um registro de correção.';
  end if;
  perform public.financeiro_estornar(r.id);
  v_novo := public.financeiro_receber_completo(r.parcela_id, p_data, p_valor, p_conta, p_taxa, p_categoria, p_forma, p_banco_recebido, p_banco_envio, p_parte, p_percentuais);
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (r.escritorio_id, 'financeiro_recebimentos', v_novo::text, 'alteracao',
          jsonb_build_object('corrige', r.id, 'motivo', btrim(p_motivo), 'valor_antes', r.valor, 'valor', p_valor, 'data_antes', r.data, 'data', p_data), auth.uid());
  return v_novo;
end $$;
revoke execute on function public.financeiro_corrigir_recebimento(uuid, date, bigint, uuid, bigint, text, text, text, text, integer, jsonb, text) from public, anon;
grant execute on function public.financeiro_corrigir_recebimento(uuid, date, bigint, uuid, bigint, text, text, text, text, integer, jsonb, text) to authenticated;

-- O registro de correção, depois de algum pagamento: uma saída do caixa ligada ao recebimento. Só um administrador mexe no caixa.
create function public.financeiro_lancar_correcao(p_recebimento uuid, p_data date, p_valor bigint, p_conta uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos; k public.contratos; v_id uuid;
begin
  if not privado.sou_admin() then raise exception 'Só um administrador lança a correção no caixa.' using errcode = '42501'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo da correção.'; end if;
  select * into r from public.financeiro_recebimentos where id = p_recebimento and escritorio_id = privado.meu_escritorio();
  if r.id is null then raise exception 'Recebimento não encontrado.'; end if;
  if r.estornado_em is not null then raise exception 'Este recebimento foi estornado: não há o que corrigir.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor da correção.'; end if;
  if not exists (select 1 from public.financeiro_contas where id = p_conta and escritorio_id = r.escritorio_id and arquivada_em is null) then raise exception 'Conta não encontrada neste escritório.'; end if;
  select * into k from public.contratos where id = r.contrato_id;
  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, corrige_recebimento, criado_por)
  values (r.escritorio_id, p_conta, p_data, 'saida', 'correcao_recebimento', p_valor,
          left('Correção do recebimento de ' || k.cliente_nome || ' (' || k.codigo || '): ' || btrim(p_motivo), 300), r.id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.financeiro_lancar_correcao(uuid, date, bigint, uuid, text) from public, anon;
grant execute on function public.financeiro_lancar_correcao(uuid, date, bigint, uuid, text) to authenticated;

-- Para a tela saber o que oferecer: corrigir (nada pago) ou lançar o registro de correção (já há pagamento).
create function public.financeiro_recebimento_tem_pagamento(p_recebimento uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare r public.financeiro_recebimentos;
begin
  select * into r from public.financeiro_recebimentos where id = p_recebimento;
  if r.id is null or not privado.cuido_do_contrato(r.contrato_id) then raise exception 'Recebimento não encontrado.' using errcode = '42501'; end if;
  return privado.recebimento_tem_pagamento(r.id);
end $$;
revoke execute on function public.financeiro_recebimento_tem_pagamento(uuid) from public, anon;
grant execute on function public.financeiro_recebimento_tem_pagamento(uuid) to authenticated;
