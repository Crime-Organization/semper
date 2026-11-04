-- A seção "A passar" passa a dizer quem está com o dinheiro de cada linha (#255): o responsável gravado no recebimento, e não o atual do contrato,
-- com o mesmo critério de de_quem em financeiro_meus_valores. Só acrescenta: a função mantém nome e parâmetros, e a resposta só ganha o campo quem_paga,
-- que a versão anterior do site ignora.
create or replace function public.financeiro_a_passar(p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'recebimento_id', r.id, 'pessoa_id', (t.item ->> 'id')::uuid, 'nome', t.item ->> 'nome', 'valor', (t.item ->> 'valor')::bigint,
             'contrato_codigo', k.codigo, 'cliente_nome', k.cliente_nome, 'parcela_numero', p.numero, 'recebido_em', r.data, 'pago_em', m.pago_em,
             'quem_paga', coalesce(f.nome, 'Usuário removido'))
           order by r.data, k.codigo, p.numero, t.item ->> 'nome')
    from public.financeiro_recebimentos r
    join public.contratos k on k.id = r.contrato_id
    join public.contrato_parcelas p on p.id = r.parcela_id
    cross join lateral jsonb_array_elements(r.terceiros) as t(item)
    left join public.financeiro_terceiros_pagos m on m.recebimento_id = r.id and m.pessoa_id = (t.item ->> 'id')::uuid
    left join public.perfis f on f.id = r.responsavel_id
    where r.escritorio_id = v_escritorio and r.estornado_em is null and privado.marco_o_que_recebi(r)
      and (t.item ->> 'valor')::bigint > 0 and (t.item ->> 'id')::uuid is distinct from f.pessoa_id
      and (r.data between p_de and p_ate or (m.pago_em is null and r.data < p_de))), '[]'::jsonb);
end $$;
