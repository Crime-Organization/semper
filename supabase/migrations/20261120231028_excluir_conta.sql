-- =====================================================================
-- Excluir uma conta do caixa (#347). Como nos outros módulos, o que está arquivado pode ser excluído; a conta, só se nunca
-- teve lançamento (nem os já excluídos, que ficam guardados para a auditoria) e se nenhum repasse do caixa aponta para ela.
-- Só acrescenta: a permissão de excluir, a regra de quem pode, o gatilho que explica por que não e a função que diz à tela
-- quais arquivadas têm lançamentos. A versão anterior do site não exclui contas e continua funcionando igual.
-- As mensagens são as mesmas de app/src/regras/caixa.ts (CONTA_NAO_ARQUIVADA, CONTA_COM_LANCAMENTOS, CONTA_COM_REPASSES).
-- =====================================================================

-- 1. Quem pode: só os administradores do escritório, como quem cria e muda a conta.
grant delete on public.financeiro_contas to authenticated;
create policy excluir on public.financeiro_contas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 2. Antes de excluir, o que impede, com a explicação. Roda como o sistema para ver tudo o que aponta para a conta, mesmo
-- o que quem exclui não vê.
create function privado.conferir_exclusao_da_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.arquivada_em is null then
    raise exception 'Arquive a conta antes de excluí-la.';
  end if;
  if exists (select 1 from public.financeiro_lancamentos where conta_id = old.id)
     or exists (select 1 from public.financeiro_recebimentos where conta_id = old.id)
     or exists (select 1 from public.financeiro_retiradas where conta_id = old.id) then
    raise exception 'A conta não pode ser excluída enquanto tiver lançamentos, mesmo os já excluídos, que ficam guardados para a auditoria.';
  end if;
  if exists (select 1 from public.financeiro_repasses where conta_sugerida = old.id or conta_paga = old.id) then
    raise exception 'A conta não pode ser excluída: há repasses do caixa ligados a ela.';
  end if;
  -- O contrato que a tinha como conta de destino fica sem conta. Feito aqui, com a conta ainda gravada, para o histórico do
  -- contrato guardar o nome dela (o on delete set null rodaria depois, já sem a conta, e o histórico ficaria vazio).
  update public.contratos set conta_destino_id = null where conta_destino_id = old.id;
  return old;
end $$;
create trigger conferir_exclusao before delete on public.financeiro_contas
  for each row execute function privado.conferir_exclusao_da_conta();

-- 3. Para a tela saber onde pôr a lixeira: as contas arquivadas que têm lançamentos (mesmo excluídos).
-- Com a permissão de quem chama: quem não é administrador não vê conta nenhuma, e a lista vem vazia.
create function public.financeiro_arquivadas_com_lancamentos() returns setof uuid
language sql stable set search_path = '' as $$
  select c.id from public.financeiro_contas c
  where c.arquivada_em is not null
    and exists (select 1 from public.financeiro_lancamentos l where l.conta_id = c.id)
$$;
revoke execute on function public.financeiro_arquivadas_com_lancamentos() from public, anon;
grant execute on function public.financeiro_arquivadas_com_lancamentos() to authenticated;
