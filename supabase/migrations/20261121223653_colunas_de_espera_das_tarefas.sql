-- =====================================================================
-- Colunas de espera no quadro de Tarefas (#314)
--   Duas colunas padrão novas, depois de "Fazendo": "Aguardando: análise do solicitante" e "Aguardando: retorno do cliente"
--   (nomes decididos pelo dono, no padrão do quadro dele).
--   - Escritório novo: nasce com elas (entram nas sugestões do quadro, de onde o preparo do escritório monta as colunas).
--   - Escritório que já existe: ganha as duas uma vez, agora. Não mexe nas tarefas nem nas colunas que ele tem; só acrescenta
--     as que faltam, entre "Fazendo" e a coluna seguinte (no mesmo grupo de "Fazendo", se ela está num grupo). Sem "Fazendo",
--     elas entram antes da coluna das concluídas.
--   - Coluna de mesmo nome não se repete: compara sem maiúsculas, acentos, espaços e sinais ("Aguardando análise do
--     solicitante" conta como "Aguardando: análise do solicitante"), e também com nomes parecidos (abaixo).
--   As mesmas regras estão em app/src/regras/colunasPadrao.ts (o banco fictício usa aquelas): mudou aqui, muda lá.
--   Só acrescenta (funções, um gatilho, sugestões e colunas). As sugestões das tarefas são renumeradas para as duas
--   entrarem depois de "Fazendo". A versão anterior do site continua funcionando: as colunas novas são colunas comuns.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O nome de uma coluna reduzido ao que importa para comparar (o mesmo de chaveDaColuna no site).
-- ---------------------------------------------------------------------
create function privado.chave_da_coluna(p_nome text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select regexp_replace(privado.sem_acento(p_nome), '[^a-z0-9]', '', 'g')
$$;
revoke execute on function privado.chave_da_coluna(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. As ordens de quem está num lugar do quadro: as colunas de um grupo, ou o topo (p_grupo null: colunas sem grupo e grupos).
-- ---------------------------------------------------------------------
create function privado.ordens_vizinhas(p_escritorio uuid, p_modulo text, p_grupo uuid) returns setof double precision
language sql stable set search_path = '' as $$
  select c.ordem from public.quadro_colunas c where p_grupo is not null and c.grupo_id = p_grupo
  union all
  select c.ordem from public.quadro_colunas c
  where p_grupo is null and c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.grupo_id is null
  union all
  select g.ordem from public.quadro_grupos g where p_grupo is null and g.escritorio_id = p_escritorio and g.modulo = p_modulo
$$;
revoke execute on function privado.ordens_vizinhas(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Acrescenta a um quadro as colunas padrão que faltam (o mesmo de planoDasColunasNovas no site).
--   p_colunas: [{"nome": "…", "parecidos": ["…"]}], na ordem em que entram.
--   p_depois_de: a coluna depois da qual elas entram (no mesmo grupo dela).
--   p_grupo_novo: em vez disso, um grupo novo com elas, logo antes do grupo da coluna das concluídas; se o escritório já tem
--   um grupo com esse nome, elas entram no fim dele.
--   Um quadro sem nenhuma coluna fica como está (o preparo do escritório é que o monta). Devolve quantas colunas entraram.
-- ---------------------------------------------------------------------
create function privado.acrescentar_colunas_padrao(p_escritorio uuid, p_modulo text, p_colunas jsonb,
  p_depois_de text default null, p_grupo_novo text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_faltam text[];
  v_quantas int;
  v_ancora record;
  v_fim record;
  v_grupo uuid;
  v_alvo double precision;
  v_anterior double precision;
  v_seguinte double precision;
  v_ordem_do_grupo double precision;
  v_novas_em_grupo_novo boolean := false;
  i int;
begin
  if not exists (select 1 from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = p_modulo) then
    return 0;
  end if;

  -- As que faltam: nenhuma coluna do quadro tem o nome dela nem um dos parecidos.
  select coalesce(array_agg(e.item ->> 'nome' order by e.n), '{}') into v_faltam
  from jsonb_array_elements(p_colunas) with ordinality as e(item, n)
  where not exists (
    select 1 from public.quadro_colunas c
    where c.escritorio_id = p_escritorio and c.modulo = p_modulo
      and privado.chave_da_coluna(c.nome) in (
        select privado.chave_da_coluna(e.item ->> 'nome')
        union all
        select privado.chave_da_coluna(p) from jsonb_array_elements_text(coalesce(e.item -> 'parecidos', '[]'::jsonb)) p));
  v_quantas := cardinality(v_faltam);
  if v_quantas = 0 then
    return 0;
  end if;

  select c.id, c.ordem, c.grupo_id into v_fim from public.quadro_colunas c
  where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.marco = 'concluido';

  if p_grupo_novo is not null then
    select g.id into v_grupo from public.quadro_grupos g
    where g.escritorio_id = p_escritorio and g.modulo = p_modulo and privado.chave_da_coluna(g.nome) = privado.chave_da_coluna(p_grupo_novo)
    limit 1;
    if v_grupo is not null then
      -- O grupo já existe (criado à mão): as colunas entram no fim dele.
      select max(c.ordem) into v_anterior from public.quadro_colunas c where c.grupo_id = v_grupo;
    else
      -- O grupo novo fica no topo logo antes do grupo da coluna das concluídas (ou dela mesma, se está sem grupo).
      if v_fim.id is not null then
        v_alvo := coalesce((select g.ordem from public.quadro_grupos g where g.id = v_fim.grupo_id), v_fim.ordem);
        select max(o) into v_anterior from privado.ordens_vizinhas(p_escritorio, p_modulo, null) o where o < v_alvo;
        v_ordem_do_grupo := case when v_anterior is null then v_alvo - 1 else (v_anterior + v_alvo) / 2 end;
      else
        select greatest(coalesce(max(c.ordem), 0), coalesce((select max(g.ordem) from public.quadro_grupos g
                 where g.escritorio_id = p_escritorio and g.modulo = p_modulo), 0)) + 1
          into v_ordem_do_grupo
        from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = p_modulo;
      end if;
      insert into public.quadro_grupos (escritorio_id, modulo, nome, ordem, comeca_fechado)
      values (p_escritorio, p_modulo, p_grupo_novo, v_ordem_do_grupo, false)
      returning id into v_grupo;
      -- O gatilho depois_das_colunas pode ter empurrado o grupo para o fim: ele fica onde foi calculado.
      update public.quadro_grupos set ordem = v_ordem_do_grupo where id = v_grupo;
      v_novas_em_grupo_novo := true;
      v_anterior := null;
    end if;
    v_seguinte := null;
  else
    select c.id, c.ordem, c.grupo_id into v_ancora from public.quadro_colunas c
    where p_depois_de is not null and c.escritorio_id = p_escritorio and c.modulo = p_modulo
      and privado.chave_da_coluna(c.nome) = privado.chave_da_coluna(p_depois_de)
    order by c.ordem limit 1;
    if v_ancora.id is not null or v_fim.id is not null then
      -- Depois da coluna de referência ou, sem ela, antes da coluna das concluídas, entre os vizinhos do mesmo lugar: as colunas
      -- do mesmo grupo, ou o topo do quadro (colunas sem grupo e grupos).
      v_grupo := case when v_ancora.id is not null then v_ancora.grupo_id else v_fim.grupo_id end;
      if v_ancora.id is not null then
        v_anterior := v_ancora.ordem;
        select min(o) into v_seguinte from privado.ordens_vizinhas(p_escritorio, p_modulo, v_grupo) o where o > v_ancora.ordem;
      else
        v_seguinte := v_fim.ordem;
        select max(o) into v_anterior from privado.ordens_vizinhas(p_escritorio, p_modulo, v_grupo) o where o < v_fim.ordem;
      end if;
    else
      -- Sem nenhuma das duas: no fim do quadro, sem grupo.
      v_grupo := null;
      select greatest(coalesce(max(c.ordem), 0), coalesce((select max(g.ordem) from public.quadro_grupos g
               where g.escritorio_id = p_escritorio and g.modulo = p_modulo), 0))
        into v_anterior
      from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = p_modulo;
      v_seguinte := null;
    end if;
  end if;

  -- As ordens repartem o espaço entre os vizinhos (o mesmo de ordensEntre no site).
  for i in 1 .. v_quantas loop
    insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco, grupo_id)
    values (p_escritorio, p_modulo, v_faltam[i],
      case
        when v_novas_em_grupo_novo then i
        when v_anterior is not null and v_seguinte is not null then v_anterior + (v_seguinte - v_anterior) * i / (v_quantas + 1)
        when v_anterior is not null then v_anterior + i
        when v_seguinte is not null then v_seguinte - (v_quantas + 1 - i)
        else i
      end,
      null, null, v_grupo);
  end loop;
  return v_quantas;
end $$;
revoke execute on function privado.acrescentar_colunas_padrao(uuid, text, jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. As colunas novas das tarefas (as mesmas de COLUNAS_NOVAS_DAS_TAREFAS no site).
-- ---------------------------------------------------------------------
create function privado.colunas_novas_das_tarefas() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"nome": "Aguardando: análise do solicitante",
     "parecidos": ["Aguardando retorno do solicitante", "Aguardando retorno do advogado solicitante", "Aguardando análise do advogado solicitante", "Aguardando solicitante"]},
    {"nome": "Aguardando: retorno do cliente", "parecidos": ["Aguardando cliente"]}
  ]'::jsonb
$$;
revoke execute on function privado.colunas_novas_das_tarefas() from public, anon, authenticated;

-- Escritório novo: as sugestões do quadro (de onde o preparo monta as colunas) passam a ter as duas, depois de "Fazendo".
update public.quadro_sugestoes set ordem = ordem + 2 where modulo = 'tarefas' and ordem > 2;
insert into public.quadro_sugestoes (modulo, nome, ordem) values
  ('tarefas', 'Aguardando: análise do solicitante', 3), ('tarefas', 'Aguardando: retorno do cliente', 4)
on conflict do nothing;

-- Escritório novo, por garantia: se as sugestões mudarem e perderem as duas, o gatilho as acrescenta. O nome vem depois de
-- "quadros_de_processos" e antes de "zz_grupos_depois_das_colunas" na ordem alfabética (o Postgres roda os gatilhos nessa ordem).
create function privado.colunas_novas_das_tarefas_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.acrescentar_colunas_padrao(new.id, 'tarefas', privado.colunas_novas_das_tarefas(), 'Fazendo');
  return null;
end $$;
revoke execute on function privado.colunas_novas_das_tarefas_do_escritorio_novo() from public, anon, authenticated;
create trigger zy_colunas_novas_das_tarefas after insert on public.escritorios
  for each row execute function privado.colunas_novas_das_tarefas_do_escritorio_novo();

-- Escritório que já existe: ganha as que faltam, uma vez.
select privado.acrescentar_colunas_padrao(e.id, 'tarefas', privado.colunas_novas_das_tarefas(), 'Fazendo') from public.escritorios e;
