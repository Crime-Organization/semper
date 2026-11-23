-- =====================================================================
-- Excluir o contrato exclui junto o que está ligado a ele (#284, parte 2)
--   Até aqui, excluir o contrato era um delete direto: as demandas e as tarefas ficavam soltas, e o contrato com qualquer
--   recebimento (mesmo estornado) não saía, porque financeiro_recebimentos aponta para ele sem cascata. Agora a exclusão passa
--   por public.contratos_excluir, que apaga, na ordem certa:
--   - do Financeiro: as marcações de pagamento, os repasses, os registros de correção, os recebimentos (também os estornados) e os
--     lançamentos do Caixa que eles criaram (a entrada, a taxa da máquina). Saem do Caixa, dos saldos e do lucro dos sócios,
--     inclusive de meses passados;
--   - as tarefas que só estavam ligadas a estes contratos ou às demandas deles (as com outro contrato, outra demanda ou um
--     processo continuam, ligadas ao restante: os gatilhos da #283 tiram a ligação), com o tempo registrado nelas;
--   - as demandas dos contratos (menos a contínua, #313, que nunca sai) e, por fim, os contratos, com as parcelas.
--   Processos, compromissos e anotações continuam existindo: perdem só a ligação (a tabela de ligação cai em cascata).
--   O lançamento de um repasse pago e depois desfeito já estava excluído (fora do Caixa) e sem ligação com o repasse: ele fica como
--   está, excluído, como qualquer lançamento desfeito.
--
--   Decisões do dono (22/11/2026):
--   - Recebimentos: antes de apagar, cada um fica numa cópia escondida, public.financeiro_excluidos (data, valor, conta, quem
--     excluiu e a cópia das linhas), que só os administradores do escritório leem; ninguém grava nela pela tela.
--   - Já pago a alguém (repasse pago ou participante/indicador marcado como pago): ninguém exclui enquanto houver. A janela mostra
--     quais, e o administrador desfaz o pagamento antes (como no estorno).
--   - Dinheiro recebido (recebimento não estornado ou parcela importada como paga): só um administrador exclui. A parcela importada
--     como paga não passou pelo Caixa: a janela mostra o valor dela à parte, avisando que não mexe no saldo.
--   A prévia (public.contrato_exclusao_previa) diz tudo isso antes da confirmação, para a janela; os valores só aparecem para
--   quem já os vê (administrador ou responsável pelo contrato).
--   A auditoria ganha, além da linha de cada item excluído (privado.auditar), uma linha por contrato com o resumo e os valores.
--
-- Só acrescenta (uma tabela, funções e um gatilho novos). A versão anterior do site continua funcionando: ela exclui com o delete
-- direto, como antes. Esse caminho continua recusando o contrato com recebimento (a chave estrangeira não muda) e passa a recusar,
-- para quem não é administrador, o contrato com parcela importada como paga. Assim o site antigo nunca apaga dinheiro sem a janela.
-- A regra RLS "apagar" de contratos fica como está.
-- =====================================================================

-- 1. A cópia escondida do dinheiro que saiu com o contrato. Uma linha por recebimento (também o estornado) e por parcela importada
--    como paga. contrato_id não tem chave estrangeira: o contrato não existe mais. A cópia guarda as linhas como estavam (o
--    recebimento, os repasses, os lançamentos, as marcações), para um administrador conferir ou relançar à mão, se precisar.
create table public.financeiro_excluidos (
  id              bigint generated always as identity primary key,
  escritorio_id   uuid not null references public.escritorios on delete cascade,
  contrato_id     uuid not null,
  contrato_codigo text not null,
  cliente_nome    text not null,
  tipo            text not null check (tipo in ('recebimento', 'parcela_importada')),
  parcela_numero  integer,
  data            date,
  valor           bigint not null,
  conta_id        uuid references public.financeiro_contas on delete set null,
  conta_nome      text,
  estornado       boolean not null default false,
  copia           jsonb not null,
  excluido_por    uuid references auth.users on delete set null,
  excluido_em     timestamptz not null default now()
);
create index financeiro_excluidos_escritorio on public.financeiro_excluidos (escritorio_id, excluido_em desc);
create index financeiro_excluidos_contrato on public.financeiro_excluidos (contrato_id);
-- Só os administradores do escritório leem; ninguém grava, muda ou apaga pela tela (só contratos_excluir, que roda como o sistema).
alter table public.financeiro_excluidos enable row level security;
revoke all on public.financeiro_excluidos from anon;
revoke insert, update, delete, truncate, references, trigger on public.financeiro_excluidos from authenticated;
create policy leitura on public.financeiro_excluidos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 2. O que sai junto com os contratos. As mesmas contas da regra regras/exclusaoDoContrato.ts, que o banco fictício usa.
-- As demandas dos contratos, menos a contínua (#313).
create function privado.demandas_que_saem(p_contratos uuid[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id), '{}') from public.demandas d
   where d.contrato_id = any(p_contratos) and not privado.demanda_continua(d)
$$;
revoke execute on function privado.demandas_que_saem(uuid[]) from public, anon, authenticated;

-- As tarefas ligadas aos contratos ou às demandas que saem, sem nenhuma outra ligação: outro contrato, outra demanda (que não seja a
-- contínua, que só agrupa) ou um processo. Arquivados ou não: quem é excluído é só o que pertence a estes contratos.
create function privado.tarefas_que_saem(p_escritorio uuid, p_contratos uuid[], p_demandas uuid[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.id), '{}') from public.tarefas t
   where t.escritorio_id = p_escritorio
     and (t.contrato_ids && p_contratos or t.contrato_id = any(p_contratos) or t.demanda_ids && p_demandas or t.demanda_id = any(p_demandas))
     and t.processo_id is null
     and not exists (select 1 from public.contratos k where k.id = any(t.contrato_ids || t.contrato_id) and not k.id = any(p_contratos))
     and not exists (select 1 from public.demandas d where d.id = any(t.demanda_ids || t.demanda_id) and not d.id = any(p_demandas)
                       and not privado.demanda_continua(d))
$$;
revoke execute on function privado.tarefas_que_saem(uuid, uuid[], uuid[]) from public, anon, authenticated;

-- 3. O resumo do que sai: as contagens, os valores (em centavos) e os pagamentos já feitos. Lido como o sistema: quem chama confere
--    quem pode ver o quê.
create function privado.resumo_da_exclusao(p_escritorio uuid, p_contratos uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare dem uuid[] := privado.demandas_que_saem(p_contratos); tar uuid[];
begin
  tar := privado.tarefas_que_saem(p_escritorio, p_contratos, dem);
  return jsonb_build_object(
    'demandas', cardinality(dem),
    'tarefas', cardinality(tar),
    'segundos', (select greatest(coalesce(sum(segundos), 0), 0) from public.tarefa_tempos where tarefa_id = any(tar)),
    'parcelas', (select count(*) from public.contrato_parcelas where contrato_id = any(p_contratos) and excluido_em is null),
    'recebimentos', (select count(*) from public.financeiro_recebimentos where contrato_id = any(p_contratos) and estornado_em is null),
    'estornados', (select count(*) from public.financeiro_recebimentos where contrato_id = any(p_contratos) and estornado_em is not null),
    'recebido', (select coalesce(sum(valor), 0) from public.financeiro_recebimentos where contrato_id = any(p_contratos) and estornado_em is null),
    'taxas', (select coalesce(sum(taxa_maquina), 0) from public.financeiro_recebimentos where contrato_id = any(p_contratos) and estornado_em is null),
    'repasses', (select coalesce(sum(x.valor), 0) from public.financeiro_repasses x join public.financeiro_recebimentos r on r.id = x.recebimento_id
                  where r.contrato_id = any(p_contratos) and x.cancelado_em is null),
    'correcoes', (select coalesce(sum(l.valor), 0) from public.financeiro_lancamentos l join public.financeiro_recebimentos r on r.id = l.corrige_recebimento
                   where r.contrato_id = any(p_contratos) and l.excluido_em is null),
    'importadas', (select count(*) from public.contrato_parcelas
                    where contrato_id = any(p_contratos) and recebimento_id is null and recebida_em is not null and excluido_em is null),
    'importado', (select coalesce(sum(recebido), 0) from public.contrato_parcelas
                   where contrato_id = any(p_contratos) and recebimento_id is null and recebida_em is not null and excluido_em is null),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('codigo', q.codigo, 'parcela', q.numero, 'nome', q.nome, 'valor', q.valor)
                                        order by q.codigo, q.numero, q.nome)
      from (
        select k.codigo, p.numero, x.nome, x.valor
          from public.financeiro_repasses x
          join public.financeiro_recebimentos r on r.id = x.recebimento_id
          join public.contratos k on k.id = r.contrato_id
          join public.contrato_parcelas p on p.id = r.parcela_id
         where r.contrato_id = any(p_contratos) and x.pago_em is not null and x.cancelado_em is null
        union all
        select k.codigo, p.numero, coalesce(t.item ->> 'nome', 'Pessoa excluída'), coalesce((t.item ->> 'valor')::bigint, 0)
          from public.financeiro_terceiros_pagos m
          join public.financeiro_recebimentos r on r.id = m.recebimento_id
          join public.contratos k on k.id = r.contrato_id
          join public.contrato_parcelas p on p.id = r.parcela_id
          left join lateral (select e as item from jsonb_array_elements(r.terceiros) e where (e ->> 'id')::uuid = m.pessoa_id limit 1) t on true
         where r.contrato_id = any(p_contratos)
      ) q), '[]'::jsonb));
end $$;
revoke execute on function privado.resumo_da_exclusao(uuid, uuid[]) from public, anon, authenticated;

-- Os contratos da lista que quem chama pode excluir: do escritório dele, arquivados e cadastrados por ele (ou ele é administrador).
create function privado.contratos_que_excluo(p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(k.id), '{}') from public.contratos k
   where k.id = any(p_ids) and k.escritorio_id = privado.meu_escritorio() and k.arquivado_em is not null
     and (k.criado_por = auth.uid() or privado.sou_admin())
$$;
revoke execute on function privado.contratos_que_excluo(uuid[]) from public, anon, authenticated;

-- 4. A prévia, para a janela: quantos contratos saem (e quantos não, por não estarem arquivados ou por quem pede não poder), o que
--    sai junto, se há dinheiro recebido (só administrador exclui) e os pagamentos já feitos (ninguém exclui). Os valores e os nomes
--    de quem foi pago só vão para quem já vê o dinheiro destes contratos (administrador ou responsável); os outros recebem null e [].
create function public.contrato_exclusao_previa(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_escritorio uuid := privado.meu_escritorio();
  v_ok uuid[]; v_r jsonb; v_admin boolean := privado.sou_admin(); v_ve boolean;
begin
  if v_escritorio is null then raise exception 'Entre no sistema de novo.' using errcode = '42501'; end if;
  v_ok := privado.contratos_que_excluo(p_ids);
  v_r := privado.resumo_da_exclusao(v_escritorio, v_ok);
  v_ve := v_admin or not exists (select 1 from unnest(v_ok) as x where not privado.cuido_do_contrato(x));
  return jsonb_build_object(
    'contratos', cardinality(v_ok),
    'nao_excluiveis', (select count(distinct x) from unnest(p_ids) as x) - cardinality(v_ok),
    'demandas', v_r -> 'demandas', 'tarefas', v_r -> 'tarefas', 'segundos', v_r -> 'segundos', 'parcelas', v_r -> 'parcelas',
    'recebimentos', v_r -> 'recebimentos', 'estornados', v_r -> 'estornados', 'importadas', v_r -> 'importadas',
    'com_dinheiro', (v_r ->> 'recebimentos')::int > 0 or (v_r ->> 'importadas')::int > 0,
    'sou_admin', v_admin,
    'tem_pagamento', jsonb_array_length(v_r -> 'pagos') > 0,
    'valores', case when v_ve then jsonb_build_object('recebido', v_r -> 'recebido', 'taxas', v_r -> 'taxas', 'repasses', v_r -> 'repasses',
                                                       'correcoes', v_r -> 'correcoes', 'importado', v_r -> 'importado') end,
    'pagos', case when v_ve then v_r -> 'pagos' else '[]'::jsonb end);
end $$;
revoke execute on function public.contrato_exclusao_previa(uuid[]) from public, anon;
grant execute on function public.contrato_exclusao_previa(uuid[]) to authenticated;

-- 5. Excluir em cascata. Devolve quantos contratos saíram: os que quem pede não pode excluir (não arquivados, de outro escritório, de
--    outra pessoa) ficam, como no delete direto. O dinheiro recusa a lista inteira, sem excluir pela metade.
create function public.contratos_excluir(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_escritorio uuid := privado.meu_escritorio();
  v_ok uuid[]; v_rec uuid[]; v_lanc uuid[]; v_dem uuid[]; v_tar uuid[]; v_r jsonb; v_k public.contratos;
begin
  if v_escritorio is null then raise exception 'Entre no sistema de novo.' using errcode = '42501'; end if;
  -- Trava os contratos e os recebimentos e repasses deles: quem está pagando ou recebendo agora termina primeiro.
  perform 1 from public.contratos where id = any(p_ids) and escritorio_id = v_escritorio for update;
  v_ok := privado.contratos_que_excluo(p_ids);
  if cardinality(v_ok) = 0 then return 0; end if;
  select coalesce(array_agg(id), '{}') into v_rec from public.financeiro_recebimentos where contrato_id = any(v_ok);
  perform 1 from public.financeiro_recebimentos where id = any(v_rec) for update;
  perform 1 from public.financeiro_repasses where recebimento_id = any(v_rec) for update;

  v_r := privado.resumo_da_exclusao(v_escritorio, v_ok);
  if jsonb_array_length(v_r -> 'pagos') > 0 then
    raise exception 'Já há pagamento feito do dinheiro deste contrato. Um administrador desfaz o pagamento no Financeiro antes de excluir.';
  end if;
  if ((v_r ->> 'recebimentos')::int > 0 or (v_r ->> 'importadas')::int > 0) and not privado.sou_admin() then
    raise exception 'Este contrato tem dinheiro recebido: só um administrador o exclui.' using errcode = '42501';
  end if;

  -- O resumo de cada contrato, na auditoria, antes de apagar (depois não há mais o que contar).
  for v_k in select * from public.contratos where id = any(v_ok) order by codigo loop
    insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
    values (v_k.escritorio_id, 'contratos', v_k.id::text, 'exclusao',
            jsonb_build_object('codigo', v_k.codigo, 'cascata', privado.resumo_da_exclusao(v_escritorio, array[v_k.id]) - 'pagos'), auth.uid());
  end loop;

  -- A cópia escondida: cada recebimento (também o estornado), com tudo o que ele criou, e cada parcela importada como paga.
  insert into public.financeiro_excluidos (escritorio_id, contrato_id, contrato_codigo, cliente_nome, tipo, parcela_numero, data, valor, conta_id,
                                           conta_nome, estornado, copia, excluido_por)
  select r.escritorio_id, k.id, k.codigo, k.cliente_nome, 'recebimento', p.numero, r.data, r.valor, r.conta_id, c.nome, r.estornado_em is not null,
         jsonb_build_object(
           'recebimento', to_jsonb(r),
           'repasses', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.financeiro_repasses x where x.recebimento_id = r.id),
           'terceiros_pagos', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.financeiro_terceiros_pagos m where m.recebimento_id = r.id),
           'lancamentos', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.financeiro_lancamentos l
                            where l.id in (r.lancamento_id, r.lancamento_taxa_id) or l.corrige_recebimento = r.id
                               or l.id in (select x.lancamento_id from public.financeiro_repasses x where x.recebimento_id = r.id))),
         auth.uid()
    from public.financeiro_recebimentos r
    join public.contratos k on k.id = r.contrato_id
    join public.contrato_parcelas p on p.id = r.parcela_id
    left join public.financeiro_contas c on c.id = r.conta_id
   where r.id = any(v_rec);
  insert into public.financeiro_excluidos (escritorio_id, contrato_id, contrato_codigo, cliente_nome, tipo, parcela_numero, data, valor, copia, excluido_por)
  select p.escritorio_id, k.id, k.codigo, k.cliente_nome, 'parcela_importada', p.numero, p.recebida_em, p.recebido, jsonb_build_object('parcela', to_jsonb(p)), auth.uid()
    from public.contrato_parcelas p join public.contratos k on k.id = p.contrato_id
   where p.contrato_id = any(v_ok) and p.recebimento_id is null and p.recebida_em is not null and p.excluido_em is null;

  -- O Financeiro, na ordem das chaves: os repasses e as correções apontam para o recebimento; o recebimento, para os lançamentos dele.
  select coalesce(array_agg(l), '{}') into v_lanc from (
    select r.lancamento_id as l from public.financeiro_recebimentos r where r.id = any(v_rec)
    union select r.lancamento_taxa_id from public.financeiro_recebimentos r where r.id = any(v_rec) and r.lancamento_taxa_id is not null
    union select x.lancamento_id from public.financeiro_repasses x where x.recebimento_id = any(v_rec) and x.lancamento_id is not null) q;
  delete from public.financeiro_repasses where recebimento_id = any(v_rec);
  delete from public.financeiro_lancamentos where corrige_recebimento = any(v_rec);
  delete from public.financeiro_recebimentos where id = any(v_rec);   -- as marcações e o sócio do recebimento caem em cascata
  delete from public.financeiro_lancamentos where id = any(v_lanc);

  -- As tarefas que só pertencem a estes contratos, as demandas e, por fim, os contratos (com as parcelas e o histórico delas).
  v_dem := privado.demandas_que_saem(v_ok);
  v_tar := privado.tarefas_que_saem(v_escritorio, v_ok, v_dem);
  delete from public.tarefas where id = any(v_tar);
  delete from public.demandas where id = any(v_dem);
  delete from public.contratos where id = any(v_ok);
  return cardinality(v_ok);
end $$;
revoke execute on function public.contratos_excluir(uuid[]) from public, anon;
grant execute on function public.contratos_excluir(uuid[]) to authenticated;

-- 6. O delete direto (a versão anterior do site) continua de pé, como antes: o contrato com recebimento é recusado pela chave
--    estrangeira. A parcela importada como paga também é dinheiro recebido: só um administrador exclui o contrato que a tem.
--    contratos_excluir roda como o sistema e não passa por aqui.
create function privado.contrato_excluido_direto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_admin() and exists (select 1 from public.contrato_parcelas
       where contrato_id = old.id and recebimento_id is null and recebida_em is not null and excluido_em is null) then
    raise exception 'Este contrato tem dinheiro recebido: só um administrador o exclui.' using errcode = '42501';
  end if;
  return old;
end $$;
revoke execute on function privado.contrato_excluido_direto() from public, anon, authenticated;
create trigger exclusao_direta before delete on public.contratos
  for each row when (current_user = 'authenticated') execute function privado.contrato_excluido_direto();
