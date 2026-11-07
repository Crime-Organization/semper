-- O recebimento completo, como na planilha (tarefa #266). Só acrescenta: colunas novas (vazias nos recebimentos de
-- antes) e uma função nova de receber; a função antiga continua, e a versão anterior do site segue funcionando.
--   - categoria: o tipo deste recebimento (um contrato pode receber de mais de um jeito, ex.: pró-labore e êxito);
--   - forma_pagamento: dinheiro, Pix, TED, cartão, DOC, boleto, cheque ou outra;
--   - banco_recebido: o banco (código do Banco Central, 3 dígitos) onde o advogado recebeu o valor todo, só como registro;
--   - banco_envio: o banco de onde sai o envio para a conta do escritório (PF ou PJ).
-- Os percentuais deste recebimento (a parte na conta e o de cada participante ou indicador) vêm do contrato e podem ser
-- ajustados só aqui: o recebimento já guarda os que usou (parte_na_conta e terceiros), então nada muda no contrato.
alter table public.financeiro_recebimentos
  add column categoria text check (categoria in ('pro_labore', 'quota_litis', 'sucumbencia', 'adiantamento_despesas', 'pro_bono')),
  add column forma_pagamento text check (forma_pagamento in ('dinheiro', 'pix', 'ted', 'cartao', 'doc', 'boleto', 'cheque', 'outra')),
  add column banco_recebido text check (banco_recebido ~ '^[0-9]{3}$'),
  add column banco_envio text check (banco_envio ~ '^[0-9]{3}$');

-- Receber com tudo: igual a financeiro_receber, mais os dados acima e os percentuais ajustados.
--   p_parte: 20, 30 ou 100 (null: o do contrato);
--   p_percentuais: lista [{id, percentual}] com o percentual deste recebimento de cada participante ou indicador do
--     contrato (null: os do contrato; quem não aparece na lista fica com o do contrato; 0 tira a pessoa da divisão).
-- Se o contrato ainda não tem a data do primeiro pagamento, ela passa a ser a deste recebimento.
create function public.financeiro_receber_completo(p_parcela uuid, p_data date, p_valor bigint, p_conta uuid, p_taxa bigint,
  p_categoria text, p_forma text, p_banco_recebido text, p_banco_envio text, p_parte integer, p_percentuais jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.contrato_parcelas; k public.contratos; c public.financeiro_contas; d public.financeiro_das;
  v_partes jsonb; v_terceiros jsonb := '[]'; t jsonb; v_pct numeric; v_parte integer; v_div jsonb; v_aliquota numeric := 0; v_desc text;
  v_entrada uuid; v_saida_taxa uuid; v_id uuid; v_recebe bigint; v_socio bigint;
begin
  select * into p from public.contrato_parcelas where id = p_parcela for update;
  if p.id is null or not privado.cuido_do_contrato(p.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador registra o recebimento.' using errcode = '42501'; end if;
  if p.excluido_em is not null then raise exception 'Esta parcela foi excluída.'; end if;
  if p.recebimento_id is not null then raise exception 'Esta parcela já foi recebida.'; end if;
  select * into k from public.contratos where id = p.contrato_id;
  v_parte := coalesce(p_parte, k.percentual_escritorio);
  if v_parte is null then raise exception 'O contrato não diz quanto vai para a conta da empresa. Escolha aqui ou preencha em "Atualizar contrato".'; end if;
  if p_percentuais is not null and jsonb_typeof(p_percentuais) <> 'array' then raise exception 'Os percentuais precisam vir numa lista.'; end if;
  select * into c from public.financeiro_contas where id = p_conta and escritorio_id = k.escritorio_id;
  if c.id is null then raise exception 'Conta não encontrada neste escritório.'; end if;
  if c.tem_das then
    d := privado.das_na_data(k.escritorio_id, p_data);
    if d.mes is null then raise exception 'Nenhum DAS lançado até este mês. Peça a um administrador para lançar.'; end if;
    v_aliquota := d.aliquota;
  end if;
  v_partes := privado.partes_do_recebimento(k, p_data);
  -- Os percentuais deste recebimento: o ajustado, quando veio; 0 tira a pessoa da divisão.
  for t in select x from jsonb_array_elements(v_partes -> 'terceiros') x loop
    v_pct := coalesce((select (e ->> 'percentual')::numeric from jsonb_array_elements(coalesce(p_percentuais, '[]')) e where e ->> 'id' = t ->> 'id' limit 1),
                      (t ->> 'percentual')::numeric);
    if v_pct < 0 or v_pct > 100 then raise exception 'Cada percentual precisa ficar entre 0 e 100.'; end if;
    if v_pct > 0 then v_terceiros := v_terceiros || jsonb_build_array(jsonb_set(t, '{percentual}', to_jsonb(v_pct))); end if;
  end loop;
  v_div := privado.dividir_recebimento(p_valor, v_parte, c.tem_das, v_aliquota, p_taxa, v_terceiros,
                                       jsonb_typeof(v_partes -> 'socio_indicador') = 'object', (v_partes ->> 'responsavel_socio')::boolean);
  v_desc := left(k.cliente_nome, 200) || ' (' || k.codigo || ', parcela ' || p.numero || ')';

  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, origem, criado_por)
  values (k.escritorio_id, p_conta, p_data, 'entrada', 'recebimento', (v_div ->> 'na_conta')::bigint, 'Recebimento: ' || v_desc, 'recebimento', auth.uid())
  returning id into v_entrada;
  if v_parte = 100 and (v_div ->> 'taxa_maquina')::bigint > 0 then
    insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, origem, criado_por)
    values (k.escritorio_id, p_conta, p_data, 'saida', 'despesa', (v_div ->> 'taxa_maquina')::bigint, 'Taxa da máquina: ' || v_desc, 'recebimento', auth.uid())
    returning id into v_saida_taxa;
  end if;

  insert into public.financeiro_recebimentos (escritorio_id, parcela_id, contrato_id, responsavel_id, conta_id, data, valor, taxa_maquina, aliquota_das, parte_na_conta, responsavel_socio,
    na_conta, ficou_com_advogado, das, liquido, escritorio, responsavel_recebe, responsavel_fica, escritorio_final, contribuicao_socio, terceiros, socio_indicador, lancamento_id, lancamento_taxa_id, criado_por,
    categoria, forma_pagamento, banco_recebido, banco_envio)
  values (k.escritorio_id, p.id, k.id, k.responsavel_id, p_conta, p_data, p_valor, (v_div ->> 'taxa_maquina')::bigint, v_aliquota, v_parte, (v_partes ->> 'responsavel_socio')::boolean,
    (v_div ->> 'na_conta')::bigint, (v_div ->> 'ficou_com_advogado')::bigint, (v_div ->> 'das')::bigint, (v_div ->> 'liquido')::bigint, (v_div ->> 'escritorio')::bigint,
    (v_div ->> 'responsavel_recebe')::bigint, (v_div ->> 'responsavel_fica')::bigint, (v_div ->> 'escritorio_final')::bigint, (v_div ->> 'contribuicao_socio')::bigint,
    v_div -> 'terceiros', case when (v_div ->> 'socio_indicador')::bigint > 0 then (v_partes -> 'socio_indicador') || jsonb_build_object('valor', (v_div ->> 'socio_indicador')::bigint) end, v_entrada, v_saida_taxa, auth.uid(),
    coalesce(p_categoria, k.categoria), p_forma, nullif(p_banco_recebido, ''), nullif(p_banco_envio, ''))
  returning id into v_id;

  v_recebe := (v_div ->> 'responsavel_recebe')::bigint;
  if v_recebe > 0 then
    insert into public.financeiro_repasses (escritorio_id, recebimento_id, tipo, perfil_id, nome, descricao, valor, conta_sugerida)
    select k.escritorio_id, v_id, 'responsavel', f.id, f.nome, v_desc, v_recebe, p_conta from public.perfis f where f.id = k.responsavel_id;
  end if;
  v_socio := (v_div ->> 'socio_indicador')::bigint;
  if v_socio > 0 then
    insert into public.financeiro_repasses (escritorio_id, recebimento_id, tipo, pessoa_id, nome, descricao, valor, conta_sugerida)
    values (k.escritorio_id, v_id, 'socio_indicador', (v_partes #>> '{socio_indicador,id}')::uuid, v_partes #>> '{socio_indicador,nome}', v_desc, v_socio, p_conta);
  end if;

  update public.contrato_parcelas set recebimento_id = v_id, recebida_em = p_data, recebido = p_valor where id = p.id;
  update public.contratos set primeiro_pagamento = p_data where id = k.id and primeiro_pagamento is null;
  return v_id;
end $$;
revoke execute on function public.financeiro_receber_completo(uuid, date, bigint, uuid, bigint, text, text, text, text, integer, jsonb) from public, anon;
grant execute on function public.financeiro_receber_completo(uuid, date, bigint, uuid, bigint, text, text, text, text, integer, jsonb) to authenticated;
