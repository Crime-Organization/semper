-- =====================================================================
-- Financeiro: "Meus valores", o que cada pessoa da equipe tem a receber e já recebeu (tarefa #235)
--   - Cada pessoa vê só a parte dela em cada recebimento, por papel: responsável, participante ou indicador. Nunca vê saldo, despesas,
--     lucro nem a parte dos colegas: a leitura é uma função que devolve só as linhas de quem está logado.
--   - Participante e indicador que não é sócio recebem do responsável, sem passar pelo caixa do escritório. Por isso, marcar como pago só
--     registra o fato: não cria lançamento. Quem marca é o responsável pelo contrato ou um administrador, e dá para desfazer.
--   - Só há valor depois que o cliente pagou: as linhas nascem dos recebimentos, nunca das parcelas futuras.
--   Só acrescenta (uma tabela e funções) e amplia uma recusa de financeiro_estornar, que não mudou de assinatura: enquanto ninguém marca
--   nada, ela faz o mesmo de antes. A versão anterior do site continua funcionando.
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
create trigger auditoria after insert or update or delete on public.financeiro_terceiros_pagos for each row execute function privado.auditar();

-- A leitura é como a dos recebimentos: quem cuida do contrato. A consulta interna já passa pela regra deles.
alter table public.financeiro_terceiros_pagos enable row level security;
revoke all on public.financeiro_terceiros_pagos from anon;
revoke insert, update, delete on public.financeiro_terceiros_pagos from authenticated;
create policy leitura on public.financeiro_terceiros_pagos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and privado.cuido_do_contrato((select r.contrato_id from public.financeiro_recebimentos r where r.id = recebimento_id)));

-- 2. As linhas de quem está logado, dos recebimentos não estornados com data no período. Para não contar nada duas vezes, cada valor é:
--   a) repasse do tipo 'responsavel': o que o escritório manda ao responsável (responsavel_recebe). Só existe com a parte integral na conta,
--      e já inclui o que ele vai passar aos terceiros. Sai do caixa quando um administrador paga: é isso que o torna "recebido".
--   b) ficou_com_advogado: o que ficou direto com o responsável abaixo da parte integral. Já está com ele, por isso nasce "recebido", e também
--      inclui o que ele vai passar aos terceiros. Com a parte integral é zero, e abaixo dela não há repasse: a) e b) nunca se somam no mesmo
--      recebimento. responsavel_fica não entra: é só uma parte de a) ou de b).
--   c) repasse do tipo 'socio_indicador': o que o escritório paga ao sócio que indicou, à parte da lista de terceiros.
--   d) item da lista "terceiros": o participante ou o indicador que não é sócio. Recebe do responsável, e a situação vem da marcação.
create function public.financeiro_meus_valores(p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio(); v_eu uuid := auth.uid(); v_pessoa uuid := privado.minha_pessoa();
begin
  return coalesce((
    with periodo as (
      select r.id, r.data, r.responsavel_id, r.ficou_com_advogado, r.terceiros, k.codigo, k.cliente_nome, k.indicador_id, p.numero
      from public.financeiro_recebimentos r
      join public.contratos k on k.id = r.contrato_id
      join public.contrato_parcelas p on p.id = r.parcela_id
      where r.escritorio_id = v_escritorio and r.estornado_em is null and r.data between p_de and p_ate
    ), linhas as (
      select b.id, 'responsavel' as papel, b.codigo, b.cliente_nome, b.numero, x.valor, x.pago_em, b.data, 'escritório' as de_quem
      from periodo b join public.financeiro_repasses x on x.recebimento_id = b.id
      where x.tipo = 'responsavel' and x.cancelado_em is null and x.perfil_id = v_eu
      union all
      select b.id, 'responsavel', b.codigo, b.cliente_nome, b.numero, b.ficou_com_advogado, b.data, b.data, 'cliente'
      from periodo b
      where b.responsavel_id = v_eu and b.ficou_com_advogado > 0
      union all
      select b.id, 'indicador', b.codigo, b.cliente_nome, b.numero, x.valor, x.pago_em, b.data, 'escritório'
      from periodo b join public.financeiro_repasses x on x.recebimento_id = b.id
      where x.tipo = 'socio_indicador' and x.cancelado_em is null and x.pessoa_id = v_pessoa
      union all
      select b.id, case when b.indicador_id = v_pessoa then 'indicador' else 'participante' end, b.codigo, b.cliente_nome, b.numero,
             (t.item ->> 'valor')::bigint, m.pago_em, b.data, coalesce(f.nome, 'Usuário removido')
      from periodo b
      cross join lateral jsonb_array_elements(b.terceiros) as t(item)
      left join public.financeiro_terceiros_pagos m on m.recebimento_id = b.id and m.pessoa_id = v_pessoa
      left join public.perfis f on f.id = b.responsavel_id
      where (t.item ->> 'id')::uuid = v_pessoa and (t.item ->> 'valor')::bigint > 0
    )
    select jsonb_agg(jsonb_build_object(
             'recebimento_id', l.id, 'papel', l.papel, 'contrato_codigo', l.codigo, 'cliente_nome', l.cliente_nome, 'parcela_numero', l.numero,
             'valor', l.valor, 'situacao', case when l.pago_em is null then 'a_receber' else 'recebido' end,
             'recebido_em', l.data, 'pago_em', l.pago_em, 'de_quem', l.de_quem)
           order by l.data, l.codigo, l.numero, l.papel)
    from linhas l), '[]'::jsonb);
end $$;
revoke execute on function public.financeiro_meus_valores(date, date) from public, anon;
grant execute on function public.financeiro_meus_valores(date, date) to authenticated;

-- 3. O que o responsável passa aos terceiros, nos contratos de que a pessoa cuida (um administrador vê os do escritório). Como nas parcelas,
--   além dos recebimentos do período vêm os ainda não pagos de antes dele: o que falta passar não pode sumir na virada do mês.
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
    where r.escritorio_id = v_escritorio and r.estornado_em is null and privado.cuido_do_contrato(r.contrato_id)
      and (t.item ->> 'valor')::bigint > 0
      and (r.data between p_de and p_ate or (m.pago_em is null and r.data < p_de))), '[]'::jsonb);
end $$;
revoke execute on function public.financeiro_a_passar(date, date) from public, anon;
grant execute on function public.financeiro_a_passar(date, date) to authenticated;

-- 4. Marcar e desfazer: só quem cuida do contrato, e só para quem está na lista do recebimento. Trava o recebimento, como o estorno: quem
--   estiver estornando agora termina primeiro, e a recusa aparece aqui. Nada disso passa pelo caixa.
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
                 where (t.item ->> 'id')::uuid = p_pessoa and (t.item ->> 'valor')::bigint > 0) then
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

-- 5. Estornar: igual à versão da migração das parcelas, e também recusa o recebimento com valor marcado como pago. Quem marca trava o
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
