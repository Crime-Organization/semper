-- Quem passa o dinheiro a participantes e indicadores é quem o recebeu (#249). Depois de uma troca de responsável do contrato, os recebimentos
-- antigos continuam com o responsável da época, que fica gravado em financeiro_recebimentos.responsavel_id. Por isso a seção "A passar" e a
-- marcação de pago seguem esse campo, e não o responsável atual do contrato. O administrador continua vendo e marcando tudo: é ele quem resolve
-- o recebimento de quem saiu do escritório. Só acrescenta: as funções mantêm nome, parâmetros e resposta, e quem pode estornar não muda.

-- 1. Quem recebeu o dinheiro ou um administrador do escritório do recebimento. O coalesce é necessário: sem responsável gravado (perfil removido),
--    a comparação dá nulo, e "not nulo" não recusaria ninguém em quem chama.
create function privado.marco_o_que_recebi(p_recebimento public.financeiro_recebimentos) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_recebimento.escritorio_id = privado.meu_escritorio()
                  and (privado.sou_admin() or p_recebimento.responsavel_id = auth.uid()), false)
$$;
revoke execute on function privado.marco_o_que_recebi(public.financeiro_recebimentos) from public, anon, authenticated;

-- 2. A lista: igual à versão da migração de Meus valores, mudando só quem vê cada linha.
create or replace function public.financeiro_a_passar(p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'recebimento_id', r.id, 'pessoa_id', (t.item ->> 'id')::uuid, 'nome', t.item ->> 'nome', 'valor', (t.item ->> 'valor')::bigint,
             'contrato_codigo', k.codigo, 'cliente_nome', k.cliente_nome, 'parcela_numero', p.numero, 'recebido_em', r.data, 'pago_em', m.pago_em)
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

-- 3. Marcar e desfazer passam por aqui: igual à versão da migração de Meus valores, mudando só quem pode, e a mensagem.
create or replace function privado.recebimento_do_terceiro(p_recebimento uuid, p_pessoa uuid) returns public.financeiro_recebimentos
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos;
begin
  select * into r from public.financeiro_recebimentos where id = p_recebimento for update;
  if r.id is null or not privado.marco_o_que_recebi(r) then
    raise exception 'Só quem recebeu o dinheiro ou um administrador marca este valor como pago.' using errcode = '42501';
  end if;
  if r.estornado_em is not null then raise exception 'Este recebimento foi estornado.'; end if;
  if not exists (select 1 from jsonb_array_elements(r.terceiros) as t(item)
                 where (t.item ->> 'id')::uuid = p_pessoa and (t.item ->> 'valor')::bigint > 0
                   and p_pessoa is distinct from (select f.pessoa_id from public.perfis f where f.id = r.responsavel_id)) then
    raise exception 'Esta pessoa não recebe nada deste recebimento.';
  end if;
  return r;
end $$;

-- 4. O estorno: igual à versão da migração de Meus valores, mudando só a mensagem. Quem estorna pode já não ser quem desfaz a marcação, então a
--    recusa diz a quem pedir.
create or replace function public.financeiro_estornar(p_recebimento uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos;
begin
  select * into r from public.financeiro_recebimentos where id = p_recebimento for update;
  if r.id is null or not privado.cuido_do_contrato(r.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador estorna o recebimento.' using errcode = '42501'; end if;
  if r.estornado_em is not null then raise exception 'Este recebimento já foi estornado.'; end if;
  -- Trava os repasses antes de olhar: quem está pagando agora termina primeiro, e o pagamento aparece aqui.
  perform 1 from public.financeiro_repasses where recebimento_id = r.id for update;
  if exists (select 1 from public.financeiro_repasses where recebimento_id = r.id and pago_em is not null) then
    raise exception 'Há repasse já pago deste recebimento. Peça a um administrador para desfazer o pagamento antes.';
  end if;
  if exists (select 1 from public.financeiro_terceiros_pagos where recebimento_id = r.id) then
    raise exception 'Há valor já marcado como pago a participante ou indicador deste recebimento. É preciso desfazer a marcação antes. Peça a quem recebeu o dinheiro ou a um administrador.';
  end if;
  update public.financeiro_recebimentos set estornado_em = now(), estornado_por = auth.uid() where id = r.id;
  update public.financeiro_repasses set cancelado_em = now() where recebimento_id = r.id;
  update public.financeiro_lancamentos set excluido_em = now() where id in (r.lancamento_id, r.lancamento_taxa_id);
  update public.contrato_parcelas set recebimento_id = null, recebida_em = null, recebido = null where id = r.parcela_id;
end $$;
