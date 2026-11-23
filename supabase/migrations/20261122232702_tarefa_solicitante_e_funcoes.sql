-- =====================================================================
-- Tarefa: o solicitante e a função de cada participante (#313, parte B)
--   1. O solicitante (solicitante_id): quem pediu a tarefa, alguém da equipe do escritório. Não troca o responsável. Ele vê a tarefa
--      (pode ler e comentar, e pode ser mencionado nos comentários), mas só a altera se também estiver nela por outro caminho, como
--      quem a vê pelo contrato (#326). Ninguém fica de fora do que já via.
--   2. As funções dos participantes (decisão do dono): cada participante da tarefa tem uma função, que diz por que ele está nela.
--      - A lista de funções é de cada escritório (tabela funcoes_na_tarefa, com escritorio_id e RLS): toda a equipe a lê; só
--        administradores criam, mudam e apagam. Cada função diz se é de execução (executa): "Delegadas a mim" são as tarefas em que
--        quem está logado é participante com uma função de execução.
--      - Todo escritório, o que já existe e o novo, nasce com "Executa" (quem recebeu a tarefa para fazer, de execução) e
--        "Acompanha" (o participante de hoje).
--      - A função de cada participante fica na própria tarefa (funcoes: { "id do participante": "id da função" }), gravada com a
--        lista dos participantes. Quem entra sem função (pela versão anterior do site, pela bolinha "+", numa cópia...) fica com a
--        primeira função da lista que não é de execução ("Acompanha", na lista de fábrica). Os participantes de hoje ficam com
--        "Acompanha". Quem sai da tarefa sai também das funções.
--      - Para os filtros da lista, o banco guarda também a mesma informação em lista (participantes_com_funcao).
--      - Apagar uma função em uso é recusado: troca-se antes a função dessas pessoas (como os objetos de contrato).
--      - A função é só um rótulo: não muda quem vê nem quem altera a tarefa.
--   3. O histórico mostra o solicitante pelo nome e a troca de função de quem continua na tarefa ("Ana: Acompanha → Ana: Executa").
--   Os tamanhos são os de TAMANHO_FUNCAO_NA_TAREFA em app/src/dados/limites.ts.
--
--   Só acrescenta: uma tabela, duas colunas com valor padrão (sem solicitante; nenhuma função), funções, gatilhos e regras novos; a
--   regra de leitura das tarefas e a conferência das menções mostram o mesmo de antes e mais o solicitante; o histórico, o mesmo de
--   antes e mais os campos novos. A versão anterior do site continua funcionando: ela não conhece o solicitante nem as funções, e o
--   participante que ela põe ganha a função padrão sozinho.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. As funções de cada escritório.
-- ---------------------------------------------------------------------
create table public.funcoes_na_tarefa (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 40),   -- TAMANHO_FUNCAO_NA_TAREFA.nome em limites.ts
  executa       boolean not null default false,                              -- quem tem esta função recebeu a tarefa para fazer
  ordem         integer not null default 0,                                  -- a posição na lista (dada pelo banco, no fim)
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em timestamptz not null default now()
);
-- Duas funções do mesmo escritório não têm o mesmo nome (maiúsculas e acentos não contam).
create unique index funcoes_na_tarefa_nome_unico on public.funcoes_na_tarefa (escritorio_id, privado.sem_acento(btrim(nome)));
create index funcoes_na_tarefa_escritorio on public.funcoes_na_tarefa (escritorio_id, ordem);

-- O nome sem espaços nas pontas; a função nova vai para o fim da lista; quem mudou por último.
create function privado.preparar_funcao_na_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  if tg_op = 'INSERT' then
    new.ordem := coalesce((select max(ordem) from public.funcoes_na_tarefa where escritorio_id = new.escritorio_id), 0) + 1;
  else
    new.ordem := old.ordem;
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end $$;
revoke execute on function privado.preparar_funcao_na_tarefa() from public, anon, authenticated;
create trigger preparar before insert or update on public.funcoes_na_tarefa for each row execute function privado.preparar_funcao_na_tarefa();
create trigger auditoria after insert or update or delete on public.funcoes_na_tarefa for each row execute function privado.auditar();

-- Apagar a função em uso é recusado: troque antes a função dessas pessoas. Quando o escritório inteiro é excluído, as tarefas vão junto.
create function privado.conferir_funcao_apagada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.escritorios where id = old.escritorio_id) then
    return old;
  end if;
  select count(*) into n from public.tarefas t
  where t.escritorio_id = old.escritorio_id and exists (select 1 from jsonb_each_text(t.funcoes) e where e.value = old.id::text);
  if n > 0 then
    raise exception 'A função "%" está em % %. Troque a função dessas pessoas antes de apagá-la.', old.nome, n,
      case when n = 1 then 'tarefa' else 'tarefas' end;
  end if;
  return old;
end $$;
revoke execute on function privado.conferir_funcao_apagada() from public, anon, authenticated;
create trigger conferir_em_uso before delete on public.funcoes_na_tarefa for each row execute function privado.conferir_funcao_apagada();

alter table public.funcoes_na_tarefa enable row level security;
revoke all on public.funcoes_na_tarefa from anon;
revoke update on public.funcoes_na_tarefa from authenticated;
grant select, insert, delete on public.funcoes_na_tarefa to authenticated;
grant update (nome, executa) on public.funcoes_na_tarefa to authenticated;
create policy leitura on public.funcoes_na_tarefa for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.funcoes_na_tarefa for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()));
create policy alterar on public.funcoes_na_tarefa for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.funcoes_na_tarefa for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- As funções de fábrica: "Executa" (de execução) e "Acompanha". Só no escritório que ainda não tem nenhuma.
create function privado.preparar_funcoes_do_escritorio(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.funcoes_na_tarefa where escritorio_id = p_escritorio) then
    return;
  end if;
  insert into public.funcoes_na_tarefa (escritorio_id, nome, executa, criado_por) values (p_escritorio, 'Executa', true, null);
  insert into public.funcoes_na_tarefa (escritorio_id, nome, executa, criado_por) values (p_escritorio, 'Acompanha', false, null);
end $$;
revoke execute on function privado.preparar_funcoes_do_escritorio(uuid) from public, anon, authenticated;

create function privado.funcoes_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.preparar_funcoes_do_escritorio(new.id);
  return null;
end $$;
revoke execute on function privado.funcoes_do_escritorio_novo() from public, anon, authenticated;
create trigger funcoes_na_tarefa after insert on public.escritorios for each row execute function privado.funcoes_do_escritorio_novo();

select privado.preparar_funcoes_do_escritorio(id) from public.escritorios;

-- A função de quem entra sem escolher: a primeira da lista que não é de execução (null: o escritório não tem nenhuma assim).
create function privado.funcao_padrao_na_tarefa(p_escritorio uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.funcoes_na_tarefa where escritorio_id = p_escritorio and not executa order by ordem, criado_em limit 1
$$;
revoke execute on function privado.funcao_padrao_na_tarefa(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. O solicitante e as funções na tarefa.
-- ---------------------------------------------------------------------
alter table public.tarefas add column solicitante_id uuid references public.perfis on delete set null;
alter table public.tarefas add column funcoes jsonb not null default '{}'
  constraint tarefas_funcoes_objeto check (jsonb_typeof(funcoes) = 'object');
-- A mesma informação de funcoes, em lista ("id do participante:id da função"), só para os filtros da lista de tarefas ("Delegadas a mim",
-- "Função"): o banco a mantém junto com funcoes, e ninguém grava nela pela tela.
alter table public.tarefas add column participantes_com_funcao text[] not null default '{}';
create index tarefas_solicitante on public.tarefas (solicitante_id) where solicitante_id is not null;
create index tarefas_participantes_com_funcao on public.tarefas using gin (participantes_com_funcao);
grant update (solicitante_id, funcoes) on public.tarefas to authenticated;

-- Os participantes de hoje ficam com "Acompanha" (a função padrão de fábrica). Os gatilhos ficam desligados só durante este
-- preenchimento (como em 20261122130410_tarefa_em_varias_demandas_e_contratos.sql): não é uma alteração feita por alguém.
alter table public.tarefas disable trigger user;
update public.tarefas t set funcoes = (select jsonb_object_agg(p::text, privado.funcao_padrao_na_tarefa(t.escritorio_id)) from unnest(t.participantes) as p)
where cardinality(t.participantes) > 0 and privado.funcao_padrao_na_tarefa(t.escritorio_id) is not null;
update public.tarefas t set participantes_com_funcao = array(select e.key || ':' || e.value from jsonb_each_text(t.funcoes) as e order by e.key)
where t.funcoes <> '{}';
alter table public.tarefas enable trigger user;

-- Antes de gravar (depois de "preparar", que tira os repetidos e o responsável dos participantes; os gatilhos rodam em ordem
-- alfabética): o solicitante que entra é da equipe; cada participante tem uma função do escritório (sem ela, a padrão); quem saiu dos
-- participantes sai das funções. Confere só o que muda: a função de quem já estava não é conferida de novo.
create function privado.preparar_pedido_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := '{}'; x uuid; f text; padrao uuid; antes jsonb := case when tg_op = 'UPDATE' then old.funcoes else '{}' end;
begin
  if new.solicitante_id is not null and (tg_op = 'INSERT' or new.solicitante_id is distinct from old.solicitante_id)
     and not exists (select 1 from public.perfis where id = new.solicitante_id and escritorio_id = new.escritorio_id) then
    raise exception 'O solicitante precisa ser alguém da equipe do escritório.';
  end if;
  foreach x in array new.participantes loop
    f := new.funcoes ->> x::text;
    if f is null then
      padrao := coalesce(padrao, privado.funcao_padrao_na_tarefa(new.escritorio_id));
      continue when padrao is null;
      f := padrao::text;
    elsif f is distinct from antes ->> x::text
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
create trigger preparar_pedido before insert or update of solicitante_id, funcoes, participantes, responsavel_id, participantes_com_funcao on public.tarefas
  for each row execute function privado.preparar_pedido_da_tarefa();

-- ---------------------------------------------------------------------
-- 3. Quem vê a tarefa: a regra de hoje (20261122130410_tarefa_em_varias_demandas_e_contratos.sql) e mais o solicitante. A regra de
--    alterar não muda: o solicitante só lê, como quem vê a tarefa pelo contrato.
-- ---------------------------------------------------------------------
alter policy leitura on public.tarefas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo()) or (select privado.equipe_ve_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)
              or (select auth.uid()) = solicitante_id
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
              or demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
              or grupos && (select privado.meus_grupos())
              or demanda_id in (select unnest((select privado.demandas_dos_meus_grupos())))
              or (cardinality(contrato_ids) > 1 and contrato_ids && (select privado.contratos_em_que_estou())::uuid[])
              or (cardinality(demanda_ids) > 1 and demanda_ids && (select privado.demandas_dos_meus_contratos())::uuid[])
              or (demanda_id is not null and privado.estou_na_tarefa_ligada(escritorio_id, criado_por, responsavel_id, participantes, demanda_id, demanda_ids, grupos))));

-- ---------------------------------------------------------------------
-- 4. O histórico: o solicitante pelo nome e a troca de função de quem continua na tarefa, pelos nomes.
-- ---------------------------------------------------------------------
-- As funções de quem está nos dois lados e trocou de função, como estão em p_lado: "Ana: Executa, Bruno: Acompanha" (null: ninguém trocou).
create function privado.funcoes_no_historico(p_antes jsonb, p_depois jsonb, p_lado jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(pf.nome, 'Usuário removido') || ': ' || coalesce(f.nome, 'função apagada'), ', ' order by pf.nome)
  from jsonb_each_text(coalesce(p_lado, '{}')) as e(perfil, funcao)
  left join public.perfis pf on pf.id::text = e.perfil
  left join public.funcoes_na_tarefa f on f.id::text = e.funcao
  where coalesce(p_antes, '{}') ? e.perfil and coalesce(p_depois, '{}') ? e.perfil and p_antes ->> e.perfil is distinct from p_depois ->> e.perfil
$$;
revoke execute on function privado.funcoes_no_historico(jsonb, jsonb, jsonb) from public, anon, authenticated;

-- A de 20261122130410_tarefa_em_varias_demandas_e_contratos.sql, com o solicitante e as funções.
CREATE OR REPLACE FUNCTION privado.historico_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
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
    -- As funções de quem entrou ou saiu vêm com os participantes: aqui, só a troca de função de quem continua (#313).
    continue when k = 'funcoes' and privado.funcoes_no_historico(old.funcoes, new.funcoes, new.funcoes) is null;
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
        'de', privado.funcoes_no_historico(old.funcoes, new.funcoes, old.funcoes),
        'para', privado.funcoes_no_historico(old.funcoes, new.funcoes, new.funcoes)))
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

-- ---------------------------------------------------------------------
-- 5. Quem pode ser mencionado na tarefa: a de 20261122130410_tarefa_em_varias_demandas_e_contratos.sql e mais o solicitante (que a vê).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION privado.conferir_mencoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  if new.contrato_id is not null then
    select p.nome into v_nome from public.perfis p where p.id = any(new.mencoes) and p.funcao <> 'advogado' order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % em contratos: só advogados podem ser mencionados.', v_nome;
    end if;
  end if;
  -- Na demanda: quem não é administrador, não está nela e não está no contrato dela.
  if new.demanda_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.demandas d
    where d.id = new.demanda_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from d.criado_por and p.id <> d.responsavel_id and not p.id = any(d.colaboradores)
      and not privado.perfil_no_contrato(p.id, d.contrato_id)
      and not privado.perfil_nos_grupos(d.escritorio_id, p.id, d.grupos)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta demanda: inclua essa pessoa como colaboradora antes.', v_nome;
    end if;
  end if;
  -- Na tarefa: quem não é administrador, não está nela, não vê nenhuma das demandas ligadas e não está em nenhum dos contratos
  -- dela (nem no de uma das demandas).
  if new.tarefa_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and p.id is distinct from t.solicitante_id
      and not exists (select 1 from public.demandas d where (d.id = t.demanda_id or t.demanda_ids @> array[d.id])
                      and (p.id = d.criado_por or p.id = d.responsavel_id or p.id = any(d.colaboradores)
                           or privado.perfil_no_contrato(p.id, d.contrato_id)
                           or privado.perfil_nos_grupos(d.escritorio_id, p.id, d.grupos)))
      and not privado.perfil_no_contrato(p.id, t.contrato_id)
      and not exists (select 1 from unnest(t.contrato_ids) as k(id) where privado.perfil_no_contrato(p.id, k.id))
      and not privado.perfil_nos_grupos(t.escritorio_id, p.id, t.grupos)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return null;
end $function$;
