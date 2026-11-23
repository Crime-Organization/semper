-- =====================================================================
-- Funções dos participantes: só "Executa" de fábrica (#421, pedido do dono em 23/11/2026)
--   As funções continuam, e cada escritório cria as dele em Configurações. A única que vem pronta passa a ser "Executa".
--   1. Escritório novo nasce só com "Executa" (a de 20261122232702_tarefa_solicitante_e_funcoes.sql, sem "Acompanha").
--   2. Quem entra numa tarefa sem ninguém escolher a função fica sem função: nenhuma função é posta sozinha (antes, era a primeira
--      da lista que não é de execução). O participante sem função sempre foi aceito (funcoes é um objeto, sem exigir cada um).
--   3. Em todos os escritórios, a "Acompanha" de fábrica (nome "Acompanha", não é de execução, sem quem a criou) sai, e quem estava
--      com ela fica sem função. Uma "Acompanha" que o escritório criou (criado_por preenchido) fica.
--   4. O histórico mostra também a troca de quem continua na tarefa e ganha ou perde a função ("Ana: Sem função" para "Ana: Executa").
--
--   Só acrescenta na estrutura: funções novas e create or replace das de antes; nenhuma tabela ou coluna sai. Apagar a "Acompanha" de
--   fábrica e tirá-la dos participantes é mudança de dados, o pedido. A versão anterior do site continua funcionando: ela já mostrava o
--   participante sem função ("Sem função" no cadastro, só o papel na bolinha) e grava a lista de participantes como antes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. As funções de fábrica: só "Executa" (de execução). Só no escritório que ainda não tem nenhuma.
-- ---------------------------------------------------------------------
create or replace function privado.preparar_funcoes_do_escritorio(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.funcoes_na_tarefa where escritorio_id = p_escritorio) then
    return;
  end if;
  insert into public.funcoes_na_tarefa (escritorio_id, nome, executa, criado_por) values (p_escritorio, 'Executa', true, null);
end $$;
revoke execute on function privado.preparar_funcoes_do_escritorio(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Quem entra sem escolher fica sem função. A função padrão não existe mais: ela fica (só acrescentar), mas não acha nenhuma, e
--    preparar_pedido não a chama.
-- ---------------------------------------------------------------------
create or replace function privado.funcao_padrao_na_tarefa(p_escritorio uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select null::uuid
$$;
revoke execute on function privado.funcao_padrao_na_tarefa(uuid) from public, anon, authenticated;

-- A de 20261122232702_tarefa_solicitante_e_funcoes.sql, sem a função padrão: o solicitante que entra é da equipe; o participante com
-- função tem uma do escritório, e o sem função fica sem; quem saiu dos participantes sai das funções. Confere só o que muda: a função de
-- quem já estava não é conferida de novo.
create or replace function privado.preparar_pedido_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := '{}'; x uuid; f text; antes jsonb := case when tg_op = 'UPDATE' then old.funcoes else '{}' end;
begin
  if new.solicitante_id is not null and (tg_op = 'INSERT' or new.solicitante_id is distinct from old.solicitante_id)
     and not exists (select 1 from public.perfis where id = new.solicitante_id and escritorio_id = new.escritorio_id) then
    raise exception 'O solicitante precisa ser alguém da equipe do escritório.';
  end if;
  foreach x in array new.participantes loop
    f := new.funcoes ->> x::text;
    continue when f is null;
    if f is distinct from antes ->> x::text
       and not exists (select 1 from public.funcoes_na_tarefa where id::text = f and escritorio_id = new.escritorio_id) then
      raise exception 'Função não encontrada neste escritório.';
    end if;
    v := v || jsonb_build_object(x::text, f);
  end loop;
  new.funcoes := v;
  new.participantes_com_funcao := array(select e.key || ':' || e.value from jsonb_each_text(v) as e order by e.key);
  return new;
end $$;
revoke execute on function privado.preparar_pedido_da_tarefa() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. A "Acompanha" de fábrica sai de todos os escritórios, e quem estava com ela fica sem função. Fica numa função (só o banco a
--    chama) para o teste poder conferi-la. Os gatilhos ficam desligados só durante a conversão (como em
--    20261122232702_tarefa_solicitante_e_funcoes.sql): não é uma alteração feita por alguém, e a função apagada já não está em uso.
--    O registro de ações (auditoria) da tabela de funções continua ligado: a saída da "Acompanha" fica registrada.
-- ---------------------------------------------------------------------
create function privado.tirar_acompanha_de_fabrica() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Ninguém grava uma tarefa nem uma função no meio da conversão.
  lock table public.tarefas, public.funcoes_na_tarefa in share row exclusive mode;
  alter table public.tarefas disable trigger user;
  update public.tarefas t
  set funcoes = (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(t.funcoes) as e
                 where not exists (select 1 from public.funcoes_na_tarefa f
                                   where f.id::text = e.value #>> '{}' and f.nome = 'Acompanha' and not f.executa and f.criado_por is null))
  where exists (select 1 from jsonb_each_text(t.funcoes) as e join public.funcoes_na_tarefa f on f.id::text = e.value
                where f.nome = 'Acompanha' and not f.executa and f.criado_por is null);
  update public.tarefas t set participantes_com_funcao = array(select e.key || ':' || e.value from jsonb_each_text(t.funcoes) as e order by e.key)
  where t.participantes_com_funcao is distinct from array(select e.key || ':' || e.value from jsonb_each_text(t.funcoes) as e order by e.key);
  alter table public.tarefas enable trigger user;
  alter table public.funcoes_na_tarefa disable trigger conferir_em_uso;
  delete from public.funcoes_na_tarefa where nome = 'Acompanha' and not executa and criado_por is null;
  alter table public.funcoes_na_tarefa enable trigger conferir_em_uso;
end $$;
revoke execute on function privado.tirar_acompanha_de_fabrica() from public, anon, authenticated;

select privado.tirar_acompanha_de_fabrica();

-- ---------------------------------------------------------------------
-- 4. O histórico: a troca de função de quem continua na tarefa, também de e para "Sem função".
-- ---------------------------------------------------------------------
-- As funções de quem continua na tarefa (p_ficaram) e trocou de função, como estão em p_lado: "Ana: Executa, Bruno: Sem função"
-- (null: ninguém trocou). Quem entrou ou saiu vem com os participantes.
create function privado.funcoes_trocadas_no_historico(p_antes jsonb, p_depois jsonb, p_ficaram uuid[], p_lado jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(pf.nome, 'Usuário removido') || ': '
                    || case when p_lado ->> x.id::text is null then 'Sem função' else coalesce(f.nome, 'função apagada') end,
                    ', ' order by pf.nome)
  from unnest(coalesce(p_ficaram, '{}')) as x(id)
  left join public.perfis pf on pf.id = x.id
  left join public.funcoes_na_tarefa f on f.id::text = p_lado ->> x.id::text
  where coalesce(p_antes, '{}') ->> x.id::text is distinct from coalesce(p_depois, '{}') ->> x.id::text
$$;
revoke execute on function privado.funcoes_trocadas_no_historico(jsonb, jsonb, uuid[], jsonb) from public, anon, authenticated;

-- A de 20261122232702_tarefa_solicitante_e_funcoes.sql, com a troca de função de quem continua também de e para "Sem função".
CREATE OR REPLACE FUNCTION privado.historico_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
  ficaram uuid[] := array(select unnest(old.participantes) intersect select unnest(new.participantes));
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'concluida_em', 'participantes_com_funcao');
    continue when vo -> k is not distinct from vn -> k;
    -- O processo excluído tira a ligação sozinho (on delete set null): sem nome dos dois lados, não há o que mostrar.
    continue when k = 'processo_id' and new.processo_id is null and privado.nome_do_processo_no_historico(old.processo_id) is null;
    -- A lista mudou: ela já conta a troca do principal (#283).
    continue when k = 'demanda_id' and new.demanda_ids is distinct from old.demanda_ids;
    continue when k = 'contrato_id' and new.contrato_ids is distinct from old.contrato_ids;
    -- As funções de quem entrou ou saiu vêm com os participantes: aqui, só a troca de função de quem continua (#313, #421).
    continue when k = 'funcoes' and privado.funcoes_trocadas_no_historico(old.funcoes, new.funcoes, ficaram, new.funcoes) is null;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'solicitante_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.solicitante_id),
        'para', (select nome from public.perfis where id = new.solicitante_id)))
      when 'funcoes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.funcoes_trocadas_no_historico(old.funcoes, new.funcoes, ficaram, old.funcoes),
        'para', privado.funcoes_trocadas_no_historico(old.funcoes, new.funcoes, ficaram, new.funcoes)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'demanda_id' then jsonb_build_object('demanda', jsonb_build_object('de', old.demanda_codigo, 'para', new.demanda_codigo))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      when 'demanda_ids' then jsonb_build_object('demandas', jsonb_build_object(
        'de', privado.codigos_das_demandas(old.demanda_ids), 'para', privado.codigos_das_demandas(new.demanda_ids)))
      when 'contrato_ids' then jsonb_build_object('contratos', jsonb_build_object(
        'de', privado.codigos_dos_contratos(old.contrato_ids), 'para', privado.codigos_dos_contratos(new.contrato_ids)))
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object(
        'de', privado.nome_do_processo_no_historico(old.processo_id), 'para', privado.nome_do_processo_no_historico(new.processo_id)))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;
