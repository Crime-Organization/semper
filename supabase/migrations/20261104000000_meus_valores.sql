-- =====================================================================
-- Financeiro: "Meus valores", o que cada pessoa da equipe tem a receber e já recebeu (tarefa #235)
--   - Cada pessoa vê só a parte dela em cada recebimento, por papel: responsável, participante ou indicador. Nunca vê saldo, despesas,
--     lucro nem a parte dos colegas: a leitura é uma função que devolve só as linhas de quem está logado.
--   - Participante e indicador que não é sócio recebem do responsável, sem passar pelo caixa do escritório. Por isso, marcar como pago só
--     registra o fato: não cria lançamento. Quem marca é o responsável pelo contrato ou um administrador, e dá para desfazer.
--   - Só há valor depois que o cliente pagou: as linhas nascem dos recebimentos, nunca das parcelas futuras.
--   Só acrescenta (uma tabela e funções), amplia uma recusa de financeiro_estornar, que não mudou de assinatura e, enquanto ninguém marca
--   nada, faz o mesmo de antes, e acrescenta o campo "papel" a cada item novo da lista "terceiros", que quem já lê a lista ignora. A versão
--   anterior do site continua funcionando.
-- =====================================================================

-- 1. O que o responsável já passou a cada terceiro (quem está na lista "terceiros" do recebimento).
--   pessoa_id não tem chave estrangeira de propósito: é o mesmo código que o recebimento guarda na lista "terceiros", sem chave. Com uma
--   chave restritiva, marcar como pago passaria a impedir a exclusão da pessoa que já saiu do contrato (LGPD), o que hoje é possível; com
--   exclusão em cascata, o valor já pago voltaria a aparecer como "a passar". Assim, excluir a pessoa continua como é, e a marcação fica,
--   só com o código. As funções abaixo conferem a pessoa na lista do recebimento, e ninguém escreve aqui direto.
create table public.financeiro_terceiros_pagos (
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  recebimento_id uuid not null references public.financeiro_recebimentos on delete cascade,
  pessoa_id      uuid not null,
  pago_em        date not null check (pago_em between date '2000-01-01' and date '2100-12-31'),
  marcado_por    uuid references auth.users on delete set null,
  marcado_em     timestamptz not null default now(),
  primary key (recebimento_id, pessoa_id)
);
create index financeiro_terceiros_pagos_escritorio on public.financeiro_terceiros_pagos (escritorio_id);

-- Desfazer apaga a linha, e a marcação é a única prova do pagamento, que não passa pelo caixa. Por isso o registro de ações guarda o contrato,
-- a parcela, o recebimento, a data e o valor, o que privado.auditar não sabe fazer com esta tabela. O nome da pessoa não entra: excluída pela
-- LGPD, ela só é apagada do registro nas linhas da tabela "pessoas". Fica o código dela, em registro_id.
create function privado.auditar_terceiro_pago() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.financeiro_terceiros_pagos; v_codigo text; v_parcela integer; v_valor bigint;
begin
  if tg_op = 'DELETE' then m := old; else m := new; end if;
  select k.codigo, p.numero,
         (select (t.item ->> 'valor')::bigint from jsonb_array_elements(r.terceiros) as t(item) where (t.item ->> 'id')::uuid = m.pessoa_id limit 1)
    into v_codigo, v_parcela, v_valor
  from public.financeiro_recebimentos r
  left join public.contratos k on k.id = r.contrato_id
  left join public.contrato_parcelas p on p.id = r.parcela_id
  where r.id = m.recebimento_id;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (m.escritorio_id, tg_table_name, m.pessoa_id::text,
          case tg_op when 'INSERT' then 'inclusao' when 'UPDATE' then 'alteracao' else 'exclusao' end,
          jsonb_strip_nulls(jsonb_build_object('codigo', v_codigo, 'parcela', v_parcela, 'recebimento', m.recebimento_id, 'pago_em', m.pago_em, 'valor', v_valor)),
          auth.uid());
  return null;
end $$;
revoke execute on function privado.auditar_terceiro_pago() from public, anon, authenticated;
create trigger auditoria after insert or update or delete on public.financeiro_terceiros_pagos for each row execute function privado.auditar_terceiro_pago();

-- A leitura é como a dos recebimentos: quem cuida do contrato. A consulta interna já passa pela regra deles.
alter table public.financeiro_terceiros_pagos enable row level security;
revoke all on public.financeiro_terceiros_pagos from anon;
revoke insert, update, delete on public.financeiro_terceiros_pagos from authenticated;
create policy leitura on public.financeiro_terceiros_pagos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and privado.cuido_do_contrato((select r.contrato_id from public.financeiro_recebimentos r where r.id = recebimento_id)));

-- 2. O recebimento guarda de vez em que papel cada terceiro entrou, como já faz com o nome e o percentual: mudar o contrato depois não muda
--   o que já foi recebido. Igual à versão da migração das parcelas, com o campo "papel" a mais em cada item. dividir_recebimento só acrescenta
--   o valor ao item, então o campo chega à lista gravada.
create or replace function privado.partes_do_recebimento(k public.contratos, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_terceiros jsonb;
  v_indicador_socio boolean := k.indicador_id is not null and privado.era_socio(k.escritorio_id, k.indicador_id, p_data);
  v_pessoa_resp uuid := (select pessoa_id from public.perfis where id = k.responsavel_id);
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'nome', q.nome, 'percentual', q.percentual, 'papel', q.papel) order by q.ordem), '[]') into v_terceiros
  from (
    select (e.x ->> 'pessoa_id')::uuid as id, p.nome, (e.x ->> 'percentual')::numeric as percentual, e.n as ordem, 'participante' as papel
    from jsonb_array_elements(k.participantes) with ordinality as e(x, n)
    join public.pessoas p on p.id = (e.x ->> 'pessoa_id')::uuid
    where coalesce((e.x ->> 'percentual')::numeric, 0) > 0
    union all
    select k.indicador_id, p.nome, k.indicador_percentual, 1000, 'indicador'
    from public.pessoas p
    where p.id = k.indicador_id and not v_indicador_socio and coalesce(k.indicador_percentual, 0) > 0
  ) q;
  return jsonb_build_object(
    'terceiros', v_terceiros,
    'socio_indicador', case when v_indicador_socio then (select jsonb_build_object('id', p.id, 'nome', p.nome) from public.pessoas p where p.id = k.indicador_id) end,
    'responsavel_socio', v_pessoa_resp is not null and privado.era_socio(k.escritorio_id, v_pessoa_resp, p_data));
end $$;
revoke execute on function privado.partes_do_recebimento(public.contratos, date) from public, anon, authenticated;

-- 3. As linhas de quem está logado, dos recebimentos não estornados com data no período. Como nas parcelas, vêm também os valores ainda não
--   pagos de antes dele: o que falta receber não pode sumir na virada do mês. O que já foi pago fica só no mês do recebimento.
--   a) repasse do tipo 'responsavel': o escritório manda ao responsável o que está em responsavel_recebe. Só existe com a parte integral na
--      conta, e a linha mostra a parte dele, sem o que ele só passa aos terceiros. Sai do caixa quando um administrador paga: é isso que o
--      torna "recebido".
--   b) ficou_com_advogado: o que ficou direto com o responsável abaixo da parte integral. Já está com ele, por isso nasce "recebido", e a linha
--      também mostra só a parte dele. Com a parte integral é zero, e abaixo dela não há repasse: a) e b) nunca se somam no mesmo recebimento.
--   c) repasse do tipo 'socio_indicador': o que o escritório paga ao sócio que indicou, à parte da lista de terceiros.
--   d) item da lista "terceiros": o participante ou o indicador que não é sócio. Recebe do responsável, e a situação vem da marcação. O papel é
--      o gravado no recebimento; só os gravados antes deste campo olham o contrato atual.
--   A parte do responsável é responsavel_fica, que tira todos os terceiros. O sócio com tudo na conta fica com zero: só repassa, e não tem linha
--   de responsável. Se o próprio responsável está na lista de terceiros, ele não passa nada a si mesmo: esse valor volta para a linha dele, e a
--   linha d) não existe. Assim, ninguém conta o mesmo dinheiro duas vezes.
create function public.financeiro_meus_valores(p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio(); v_eu uuid := auth.uid(); v_pessoa uuid := privado.minha_pessoa();
begin
  return coalesce((
    with periodo as (
      select r.id, r.data, r.responsavel_id, r.ficou_com_advogado, r.terceiros, k.codigo, k.cliente_nome, k.indicador_id, p.numero,
             f.pessoa_id as pessoa_do_responsavel, f.nome as nome_do_responsavel,
             r.responsavel_fica + coalesce((select sum((t.item ->> 'valor')::bigint) from jsonb_array_elements(r.terceiros) as t(item)
                                            where (t.item ->> 'id')::uuid = f.pessoa_id), 0)::bigint as parte_do_responsavel
      from public.financeiro_recebimentos r
      join public.contratos k on k.id = r.contrato_id
      join public.contrato_parcelas p on p.id = r.parcela_id
      left join public.perfis f on f.id = r.responsavel_id
      where r.escritorio_id = v_escritorio and r.estornado_em is null and r.data <= p_ate
    ), linhas as (
      select b.id, 'responsavel' as papel, b.codigo, b.cliente_nome, b.numero, b.parte_do_responsavel as valor, x.pago_em, b.data, 'escritório' as de_quem
      from periodo b join public.financeiro_repasses x on x.recebimento_id = b.id
      where x.tipo = 'responsavel' and x.cancelado_em is null and x.perfil_id = v_eu and b.parte_do_responsavel > 0
      union all
      select b.id, 'responsavel', b.codigo, b.cliente_nome, b.numero, b.parte_do_responsavel, b.data, b.data, 'cliente'
      from periodo b
      where b.responsavel_id = v_eu and b.ficou_com_advogado > 0 and b.parte_do_responsavel > 0
      union all
      select b.id, 'indicador', b.codigo, b.cliente_nome, b.numero, x.valor, x.pago_em, b.data, 'escritório'
      from periodo b join public.financeiro_repasses x on x.recebimento_id = b.id
      where x.tipo = 'socio_indicador' and x.cancelado_em is null and x.pessoa_id = v_pessoa
      union all
      select b.id, coalesce(t.item ->> 'papel', case when b.indicador_id = v_pessoa then 'indicador' else 'participante' end), b.codigo, b.cliente_nome, b.numero,
             (t.item ->> 'valor')::bigint, m.pago_em, b.data, coalesce(b.nome_do_responsavel, 'Usuário removido')
      from periodo b
      cross join lateral jsonb_array_elements(b.terceiros) as t(item)
      left join public.financeiro_terceiros_pagos m on m.recebimento_id = b.id and m.pessoa_id = v_pessoa
      where (t.item ->> 'id')::uuid = v_pessoa and (t.item ->> 'valor')::bigint > 0
        and (t.item ->> 'id')::uuid is distinct from b.pessoa_do_responsavel
    )
    select jsonb_agg(jsonb_build_object(
             'recebimento_id', l.id, 'papel', l.papel, 'contrato_codigo', l.codigo, 'cliente_nome', l.cliente_nome, 'parcela_numero', l.numero,
             'valor', l.valor, 'situacao', case when l.pago_em is null then 'a_receber' else 'recebido' end,
             'recebido_em', l.data, 'pago_em', l.pago_em, 'de_quem', l.de_quem)
           order by l.data, l.codigo, l.numero, l.papel)
    from linhas l
    where l.data >= p_de or l.pago_em is null), '[]'::jsonb);
end $$;
revoke execute on function public.financeiro_meus_valores(date, date) from public, anon;
grant execute on function public.financeiro_meus_valores(date, date) to authenticated;

-- 4. O que o responsável passa aos terceiros, nos contratos de que a pessoa cuida (um administrador vê os do escritório). Como nas parcelas,
--   além dos recebimentos do período vêm os ainda não pagos de antes dele: o que falta passar não pode sumir na virada do mês. Quem é o próprio
--   responsável do recebimento fica de fora: ninguém passa valor a si mesmo. Um responsável removido (sem perfil) não esconde o valor de ninguém.
create function public.financeiro_a_passar(p_de date, p_ate date) returns jsonb
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
    where r.escritorio_id = v_escritorio and r.estornado_em is null and privado.cuido_do_contrato(r.contrato_id)
      and (t.item ->> 'valor')::bigint > 0 and (t.item ->> 'id')::uuid is distinct from f.pessoa_id
      and (r.data between p_de and p_ate or (m.pago_em is null and r.data < p_de))), '[]'::jsonb);
end $$;
revoke execute on function public.financeiro_a_passar(date, date) from public, anon;
grant execute on function public.financeiro_a_passar(date, date) to authenticated;

-- 5. Marcar e desfazer: só quem cuida do contrato, e só para quem está na lista do recebimento e não é o próprio responsável dele. Uma marcação
--   assim ficaria invisível e impediria o estorno. Trava o recebimento, como o estorno: quem estiver estornando agora termina primeiro, e a
--   recusa aparece aqui. Nada disso passa pelo caixa.
create function privado.recebimento_do_terceiro(p_recebimento uuid, p_pessoa uuid) returns public.financeiro_recebimentos
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos;
begin
  select * into r from public.financeiro_recebimentos where id = p_recebimento for update;
  if r.id is null or not privado.cuido_do_contrato(r.contrato_id) then
    raise exception 'Só o responsável pelo contrato ou um administrador marca este valor como pago.' using errcode = '42501';
  end if;
  if r.estornado_em is not null then raise exception 'Este recebimento foi estornado.'; end if;
  if not exists (select 1 from jsonb_array_elements(r.terceiros) as t(item)
                 where (t.item ->> 'id')::uuid = p_pessoa and (t.item ->> 'valor')::bigint > 0
                   and p_pessoa is distinct from (select f.pessoa_id from public.perfis f where f.id = r.responsavel_id)) then
    raise exception 'Esta pessoa não recebe nada deste recebimento.';
  end if;
  return r;
end $$;
revoke execute on function privado.recebimento_do_terceiro(uuid, uuid) from public, anon, authenticated;

create function public.financeiro_terceiro_marcar_pago(p_recebimento uuid, p_pessoa uuid, p_data date) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos := privado.recebimento_do_terceiro(p_recebimento, p_pessoa);
begin
  if p_data is null or p_data not between date '2000-01-01' and date '2100-12-31' then raise exception 'Informe uma data válida.'; end if;
  insert into public.financeiro_terceiros_pagos (escritorio_id, recebimento_id, pessoa_id, pago_em, marcado_por)
  values (r.escritorio_id, r.id, p_pessoa, p_data, auth.uid())
  on conflict (recebimento_id, pessoa_id) do nothing;
  if not found then raise exception 'Este valor já foi marcado como pago.'; end if;
end $$;
revoke execute on function public.financeiro_terceiro_marcar_pago(uuid, uuid, date) from public, anon;
grant execute on function public.financeiro_terceiro_marcar_pago(uuid, uuid, date) to authenticated;

create function public.financeiro_terceiro_desfazer_pago(p_recebimento uuid, p_pessoa uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos := privado.recebimento_do_terceiro(p_recebimento, p_pessoa);
begin
  delete from public.financeiro_terceiros_pagos where recebimento_id = r.id and pessoa_id = p_pessoa;
end $$;
revoke execute on function public.financeiro_terceiro_desfazer_pago(uuid, uuid) from public, anon;
grant execute on function public.financeiro_terceiro_desfazer_pago(uuid, uuid) to authenticated;

-- 6. Estornar: igual à versão da migração das parcelas, e também recusa o recebimento com valor marcado como pago. Quem marca trava o
--   recebimento antes, então a marcação feita agora aparece aqui.
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
    raise exception 'Há valor já marcado como pago a participante ou indicador deste recebimento. É preciso desfazer a marcação antes.';
  end if;
  update public.financeiro_recebimentos set estornado_em = now(), estornado_por = auth.uid() where id = r.id;
  update public.financeiro_repasses set cancelado_em = now() where recebimento_id = r.id;
  update public.financeiro_lancamentos set excluido_em = now() where id in (r.lancamento_id, r.lancamento_taxa_id);
  update public.contrato_parcelas set recebimento_id = null, recebida_em = null, recebido = null where id = r.parcela_id;
end $$;
