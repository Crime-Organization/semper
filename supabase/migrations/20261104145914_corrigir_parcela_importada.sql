-- =====================================================================
-- Corrigir a parcela importada como paga (parte da #256)
--   Os advogados conferem o histórico no sistema, então o responsável pelo contrato e os administradores passam a corrigir o vencimento,
--   o valor, a data e o valor recebidos da parcela importada, e a excluí-la. Decisão do escritório em 04/11/2026.
--   A correção não passa pelo caixa: não há recebimento, então saldos, repasses e lucro não mudam. A data e o valor recebidos só mudam
--   por parcela_corrigir_importada, que nunca começa nem desfaz um recebimento: as colunas continuam fechadas para a tela.
--   Nova versão de duas funções internas e uma função nova. Só acrescenta: a versão anterior do site continua funcionando, sem o botão.
-- =====================================================================

create or replace function privado.preparar_parcela() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.escritorio_id := (select escritorio_id from public.contratos where id = new.contrato_id);
    perform pg_advisory_xact_lock(hashtext('contrato_parcelas:' || new.contrato_id));
    new.numero := coalesce((select max(numero) from public.contrato_parcelas where contrato_id = new.contrato_id), 0) + 1;
    return new;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := coalesce(old.excluido_em, now());
  end if;
  if old.recebimento_id is not null and ((new.vencimento, new.valor) is distinct from (old.vencimento, old.valor) or new.excluido_em is not null) then
    raise exception 'Esta parcela já foi recebida. Estorne o recebimento antes de mudar.';
  end if;
  if old.recebimento_id is null and old.recebida_em is not null and new.recebimento_id is not null then
    raise exception 'Esta parcela já foi recebida.';
  end if;
  if old.excluido_em is not null and new.excluido_em is not null and (new.vencimento, new.valor) is distinct from (old.vencimento, old.valor) then
    raise exception 'Esta parcela foi excluída.';
  end if;
  return new;
end $$;

-- A correção também fica no histórico das parcelas.
create or replace function privado.historico_parcela() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; v_nome text := 'Parcela ' || new.numero;
begin
  if tg_op = 'INSERT' then
    a := jsonb_build_object(v_nome, jsonb_build_object('de', null, 'para', privado.em_reais(new.valor) || ', vence em ' || to_char(new.vencimento, 'DD/MM/YYYY')));
  else
    if new.valor is distinct from old.valor then
      a := a || jsonb_build_object(v_nome || ': valor', jsonb_build_object('de', privado.em_reais(old.valor), 'para', privado.em_reais(new.valor)));
    end if;
    if new.vencimento is distinct from old.vencimento then
      a := a || jsonb_build_object(v_nome || ': vencimento', jsonb_build_object('de', to_char(old.vencimento, 'DD/MM/YYYY'), 'para', to_char(new.vencimento, 'DD/MM/YYYY')));
    end if;
    if new.excluido_em is distinct from old.excluido_em then
      a := a || jsonb_build_object(v_nome, jsonb_build_object('de', null, 'para', case when new.excluido_em is null then 'Devolvida' else 'Excluída' end));
    end if;
    if new.recebimento_id is distinct from old.recebimento_id then
      a := a || jsonb_build_object(v_nome, jsonb_build_object('de', null, 'para', case when new.recebimento_id is null then 'Recebimento estornado'
        else 'Recebida em ' || to_char(new.recebida_em, 'DD/MM/YYYY') || ': ' || privado.em_reais(new.recebido) end));
    elsif new.recebimento_id is null then
      if new.recebida_em is distinct from old.recebida_em then
        a := a || jsonb_build_object(v_nome || ': data recebida', jsonb_build_object('de', to_char(old.recebida_em, 'DD/MM/YYYY'), 'para', to_char(new.recebida_em, 'DD/MM/YYYY')));
      end if;
      if new.recebido is distinct from old.recebido then
        a := a || jsonb_build_object(v_nome || ': valor recebido', jsonb_build_object('de', privado.em_reais(old.recebido), 'para', privado.em_reais(new.recebido)));
      end if;
    end if;
  end if;
  if a <> '{}' then
    insert into public.contrato_parcelas_historico (escritorio_id, contrato_id, alteracoes, feito_por) values (new.escritorio_id, new.contrato_id, a, auth.uid());
  end if;
  return null;
end $$;

create function public.parcela_corrigir_importada(p_parcela uuid, p_vencimento date, p_valor bigint, p_recebida_em date, p_recebido bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.contrato_parcelas;
begin
  select * into p from public.contrato_parcelas where id = p_parcela for update;
  if p.id is null or not privado.cuido_do_contrato(p.contrato_id) then
    raise exception 'Só o responsável pelo contrato ou um administrador corrige a parcela.' using errcode = '42501';
  end if;
  if p.recebimento_id is not null or p.recebida_em is null then raise exception 'Só a parcela importada como paga é corrigida assim.'; end if;
  if p.excluido_em is not null then raise exception 'Esta parcela foi excluída.'; end if;
  if p_recebida_em is null or p_recebida_em < date '2000-01-01' or p_recebida_em > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data do recebimento não pode estar no futuro.';
  end if;
  if p_recebido is null or p_recebido <= 0 or p_recebido > 100000000000000 then raise exception 'Confira o valor recebido.'; end if;
  update public.contrato_parcelas set vencimento = p_vencimento, valor = p_valor, recebida_em = p_recebida_em, recebido = p_recebido where id = p_parcela;
end $$;
revoke execute on function public.parcela_corrigir_importada(uuid, date, bigint, date, bigint) from public, anon;
grant execute on function public.parcela_corrigir_importada(uuid, date, bigint, date, bigint) to authenticated;
