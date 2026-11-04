-- =====================================================================
-- Parcela paga antes do início do caixa (#214)
--   A importação do histórico traz as parcelas já pagas com a data e o valor recebidos, sem recebimento: elas aparecem como recebidas
--   no contrato e não mexem no caixa, nos repasses nem no lucro, que só olham os recebimentos. Como não há o que estornar, a parcela
--   antiga também não muda nem é excluída, e não pode ser recebida de novo. Só a importação grava as duas colunas: pela tela, elas
--   nunca estiveram liberadas.
--   Nova versão de uma função interna, com a mesma assinatura. Só acrescenta: a versão anterior do site continua funcionando, e
--   mostraria a parcela antiga como a receber, sem conseguir recebê-la.
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
  if old.recebimento_id is null and old.recebida_em is not null then
    if new.recebimento_id is not null then raise exception 'Esta parcela já foi recebida.'; end if;
    if (new.vencimento, new.valor) is distinct from (old.vencimento, old.valor) or new.excluido_em is not null then
      raise exception 'Esta parcela foi paga antes do início do caixa e não muda.';
    end if;
  end if;
  if old.excluido_em is not null and new.excluido_em is not null and (new.vencimento, new.valor) is distinct from (old.vencimento, old.valor) then
    raise exception 'Esta parcela foi excluída.';
  end if;
  return new;
end $$;
