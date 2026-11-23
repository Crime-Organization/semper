-- =====================================================================
-- Demanda contínua por grupo da equipe (#313, parte C)
--   A tarefa avulsa (sem demanda) passa a entrar numa "demanda contínua", que só agrupa as tarefas avulsas. Decisões do dono (22/11):
--   - a "área" da contínua são os grupos da equipe (#378), que o administrador já cria, mais uma "Geral" para quem não está em grupo
--     nenhum. Uma contínua por grupo e uma Geral por escritório, criadas pelo banco quando são pedidas pela primeira vez;
--   - na tarefa sem demanda, o cadastro pergunta o grupo (já marcado se a pessoa está em um só) e liga a tarefa à contínua dele
--     (public.demanda_continua). A tarefa gravada sem demanda por outro caminho (a versão anterior do site, a que nasce de um processo
--     ou de uma anotação) entra pelo gatilho "continua": na do grupo de quem a cria, se ele está em um só; senão, na Geral;
--   - a tarefa que ganha uma demanda de verdade deixa de ser avulsa e sai da contínua (ligacoes_da_tarefa). Tirar depois a última
--     demanda não a devolve à contínua: só a tarefa nova entra nela;
--   - quem vê a tarefa avulsa continua o mesmo de hoje (criador, responsável, solicitante, participantes, administradores): estar na
--     demanda contínua NÃO abre as tarefas dela (estou_na_tarefa e estou_na_tarefa_ligada passam por cima da contínua). A contínua só
--     agrupa: quem está no grupo (e, na Geral, toda a equipe) vê a demanda, não as tarefas dos outros;
--   - a demanda contínua nunca é arquivada, concluída nem excluída pela tela, e não recebe colaboradores, grupos, clientes nem contrato
--     (o que abriria as tarefas dela a mais gente). Por isso ela também nunca entra na cascata de arquivar o contrato (#284);
--   - o grupo excluído leva as tarefas da contínua dele para a Geral, e a contínua dele some; o grupo renomeado renomeia a contínua.
--   O responsável pela contínua (e quem consta como criador) é o administrador mais antigo do escritório (o master primeiro): a demanda
--   exige um, e o administrador já vê tudo. O criador fica preenchido de propósito: com ele vazio, "auth.uid() in (criado_por, ...)"
--   dá nulo, e a conferência de ligacoes_da_tarefa deixaria passar quem não pode usar a contínua.
--
-- Só acrescenta: duas colunas com valor padrão, um índice, funções, gatilhos e regras que mostram o mesmo de antes e mais a contínua.
-- As tarefas avulsas de hoje ficam como estão (só as novas entram na contínua). A versão anterior do site continua funcionando:
--   - ela vê a contínua como uma demanda comum, ligada às tarefas avulsas novas; arquivar, concluir ou excluir a contínua por ela é
--     recusado com a mensagem do banco;
--   - a tarefa que ela grava sem demanda entra na contínua pelo gatilho, sem ela precisar saber.
-- =====================================================================

-- 1. As colunas. continua_grupo_id nulo numa contínua: a Geral. Só o banco grava as duas (o gatilho guardar_continua recusa a tela).
alter table public.demandas add column continua boolean not null default false;
alter table public.demandas add column continua_grupo_id uuid references public.grupos_da_equipe on delete set null;
-- Uma contínua por grupo e uma Geral por escritório (o próprio escritório faz as vezes do grupo na Geral).
create unique index demandas_continua_unica on public.demandas (escritorio_id, (coalesce(continua_grupo_id, escritorio_id))) where continua;
create index demandas_continua_grupo on public.demandas (continua_grupo_id) where continua_grupo_id is not null;

-- 2. Quem pode usar a contínua de um grupo (ligar a tarefa a ela e vê-la): quem está no grupo e os administradores; a Geral, toda a equipe.
create function privado.uso_a_continua(p_escritorio uuid, p_grupo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (p_grupo is null or privado.sou_admin() or p_grupo = any(privado.meus_grupos()))
$$;
revoke execute on function privado.uso_a_continua(uuid, uuid) from public, anon;
grant execute on function privado.uso_a_continua(uuid, uuid) to authenticated;

-- 3. Acha (ou cria) a contínua do grupo; p_grupo nulo: a Geral. Dois pedidos ao mesmo tempo: o índice único faz o segundo achar a do primeiro.
create function privado.demanda_continua(p_escritorio uuid, p_grupo uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_nome text := 'Geral'; v_responsavel uuid; v_inicio uuid;
begin
  select id into v_id from public.demandas
  where escritorio_id = p_escritorio and continua and continua_grupo_id is not distinct from p_grupo;
  if v_id is not null then return v_id; end if;
  if p_grupo is not null then
    select nome into v_nome from public.grupos_da_equipe where id = p_grupo and escritorio_id = p_escritorio;
    if not found then raise exception 'Grupo não encontrado neste escritório.'; end if;
  end if;
  select id into v_responsavel from public.perfis
  where escritorio_id = p_escritorio and papel in ('master', 'admin') and ativo
  order by papel = 'master' desc, criado_em limit 1;
  v_responsavel := coalesce(v_responsavel, auth.uid());
  select id into v_inicio from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'demandas' and marco = 'inicio';
  insert into public.demandas (escritorio_id, titulo, descricao, responsavel_id, etapa_id, etapa_ordem, criado_por, continua, continua_grupo_id)
  values (p_escritorio, privado.titulo_da_continua(v_nome),
          'Reúne as tarefas avulsas (sem demanda). Cada pessoa vê só as tarefas em que está, como antes.',
          v_responsavel, v_inicio, extract(epoch from clock_timestamp()), v_responsavel, true, p_grupo)
  on conflict (escritorio_id, (coalesce(continua_grupo_id, escritorio_id))) where continua do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.demandas
    where escritorio_id = p_escritorio and continua and continua_grupo_id is not distinct from p_grupo;
  end if;
  return v_id;
end $$;
revoke execute on function privado.demanda_continua(uuid, uuid) from public, anon, authenticated;

-- O título da contínua: "Contínua: " e o nome do grupo (ou "Geral"). TITULO_DA_CONTINUA em app/src/regras/demandaContinua.ts.
create function privado.titulo_da_continua(p_nome text) returns text
language sql immutable set search_path = '' as $$ select 'Contínua: ' || p_nome $$;
revoke execute on function privado.titulo_da_continua(text) from public, anon, authenticated;

-- Para o cadastro de tarefa: a contínua do grupo escolhido (nulo: a Geral), criada se ainda não existe. Só quem pode usá-la.
create function public.demanda_continua(p_grupo uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio();
begin
  if v_escritorio is null or not privado.uso_a_continua(v_escritorio, p_grupo) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  return privado.demanda_continua(v_escritorio, p_grupo);
end $$;
revoke execute on function public.demanda_continua(uuid) from public, anon;
grant execute on function public.demanda_continua(uuid) to authenticated;

-- 4. A tarefa nova sem demanda entra na contínua do grupo de quem a cria (se ele está em um só; senão, na Geral). Só quando alguém
--    cria (auth.uid()): a importação do histórico, sem ninguém logado, fica como está. Roda antes de "ligacoes" (ordem alfabética).
create function privado.tarefa_na_continua() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_grupos uuid[];
begin
  if auth.uid() is null or new.demanda_id is not null or coalesce(cardinality(new.demanda_ids), 0) > 0 then return new; end if;
  select array_agg(i.grupo_id) into v_grupos from public.grupo_integrantes i
  where i.perfil_id = auth.uid() and i.escritorio_id = new.escritorio_id;
  new.demanda_ids := array[privado.demanda_continua(new.escritorio_id, case when cardinality(v_grupos) = 1 then v_grupos[1] end)];
  return new;
end $$;
revoke execute on function privado.tarefa_na_continua() from public, anon, authenticated;
create trigger continua before insert on public.tarefas for each row execute function privado.tarefa_na_continua();

-- 5. A guarda da contínua. Roda como quem grava (sem security definer): pela tela (authenticated), a contínua não nasce, não é
--    excluída e não muda o que a faz contínua; as funções do banco (grupo_excluir, demanda_continua) passam.
create function privado.guardar_continua() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.continua and current_user = 'authenticated' then raise exception 'A demanda contínua não pode ser excluída.'; end if;
    return old;
  end if;
  if current_user = 'authenticated' and (new.continua or new.continua_grupo_id is not null)
     and (tg_op = 'INSERT' or new.continua is distinct from old.continua or new.continua_grupo_id is distinct from old.continua_grupo_id) then
    raise exception 'A demanda contínua é criada pelo sistema.';
  end if;
  if tg_op = 'UPDATE' and current_user = 'authenticated' and old.continua and not new.continua then
    raise exception 'A demanda contínua é criada pelo sistema.';
  end if;
  if not new.continua then return new; end if;
  if new.arquivado_em is not null and (tg_op = 'INSERT' or old.arquivado_em is null) then
    raise exception 'A demanda contínua não pode ser arquivada.';
  end if;
  if (tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id)
     and exists (select 1 from public.quadro_colunas where id = new.etapa_id and marco = 'concluido') then
    raise exception 'A demanda contínua não é concluída: ela reúne as tarefas avulsas.';
  end if;
  if cardinality(new.colaboradores) > 0 or cardinality(new.grupos) > 0 or cardinality(new.clientes) > 0 or new.contrato_id is not null then
    raise exception 'A demanda contínua só reúne as tarefas avulsas: ela não tem colaboradores, grupos, clientes nem contrato.';
  end if;
  return new;
end $$;
revoke execute on function privado.guardar_continua() from public, anon;
create trigger guardar_continua before insert or update or delete on public.demandas for each row execute function privado.guardar_continua();

-- 6. O grupo excluído: as tarefas da contínua dele vão para a Geral, e a contínua dele some. O grupo renomeado renomeia a contínua
--    (se o título ainda é o de fábrica).
create function privado.continua_do_grupo_excluido() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_antiga uuid; v_geral uuid;
begin
  select id into v_antiga from public.demandas where continua and continua_grupo_id = old.id;
  if v_antiga is null then return old; end if;
  v_geral := privado.demanda_continua(old.escritorio_id, null);
  update public.tarefas set demanda_ids = array_replace(demanda_ids, v_antiga, v_geral)
  where escritorio_id = old.escritorio_id and demanda_ids @> array[v_antiga];
  delete from public.demandas where id = v_antiga;
  return old;
end $$;
revoke execute on function privado.continua_do_grupo_excluido() from public, anon, authenticated;
create trigger continua_para_a_geral before delete on public.grupos_da_equipe for each row execute function privado.continua_do_grupo_excluido();

create function privado.continua_do_grupo_renomeado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.demandas set titulo = privado.titulo_da_continua(new.nome)
  where continua and continua_grupo_id = new.id and titulo = privado.titulo_da_continua(old.nome);
  return null;
end $$;
revoke execute on function privado.continua_do_grupo_renomeado() from public, anon, authenticated;
create trigger renomear_continua after update of nome on public.grupos_da_equipe
  for each row when (new.nome is distinct from old.nome) execute function privado.continua_do_grupo_renomeado();

-- 7. Quem vê a contínua: a regra de hoje (20261119233811_grupos_da_equipe.sql) e mais quem pode usá-la (o grupo; na Geral, a equipe).
alter policy leitura on public.demandas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(colaboradores)
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
              or grupos && (select privado.meus_grupos())
              or (continua and (continua_grupo_id is null or continua_grupo_id = any ((select privado.meus_grupos())::uuid[])))));

-- 8. Estar na contínua não abre as tarefas dela: as de 20261119233811_grupos_da_equipe.sql e 20261122130410_tarefa_em_varias_demandas_e_contratos.sql,
--    com "not d.continua" na demanda. Para as outras demandas, o resultado é o mesmo de antes.
CREATE OR REPLACE FUNCTION privado.estou_na_tarefa(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_demanda uuid, p_grupos uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or case when coalesce(cardinality(p_grupos), 0) = 0 then false else p_grupos && privado.meus_grupos() end
          or exists (select 1 from public.demandas d where d.id = p_demanda and not d.continua
                     and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
$function$;

CREATE OR REPLACE FUNCTION privado.estou_na_tarefa_ligada(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_demanda uuid,
  p_demandas uuid[], p_grupos uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select privado.estou_na_tarefa(p_escritorio, p_criado_por, p_responsavel, p_participantes, p_demanda, p_grupos)
      or (coalesce(cardinality(p_demandas), 0) > 0 and p_escritorio = privado.meu_escritorio()
          and exists (select 1 from unnest(p_demandas) as u(id) join public.demandas d on d.id = u.id
                      where u.id is distinct from p_demanda and not d.continua
                        and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
$function$;

-- 9. Ligar a tarefa à contínua: quem pode usá-la, mesmo sem "estar" nela (a de 20261122130410_tarefa_em_varias_demandas_e_contratos.sql,
--    com essa condição a mais).
CREATE OR REPLACE FUNCTION privado.ligacoes_da_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v uuid[] := '{}'; x uuid; d public.demandas; antes_d uuid[] := '{}'; antes_k uuid[] := '{}';
begin
  if tg_op = 'INSERT' then
    if new.demanda_id is not null then new.demanda_ids := new.demanda_id || array_remove(new.demanda_ids, new.demanda_id); end if;
    if new.contrato_id is not null then new.contrato_ids := new.contrato_id || array_remove(new.contrato_ids, new.contrato_id); end if;
  else
    -- A tarefa gravada sem a lista (com os gatilhos desligados, numa importação) conta com a lista do principal.
    antes_d := case when cardinality(old.demanda_ids) = 0 and old.demanda_id is not null then array[old.demanda_id] else old.demanda_ids end;
    antes_k := case when cardinality(old.contrato_ids) = 0 and old.contrato_id is not null then array[old.contrato_id] else old.contrato_ids end;
    if new.demanda_ids is not distinct from old.demanda_ids then
      new.demanda_ids := antes_d;
      if new.demanda_id is distinct from old.demanda_id then
        new.demanda_ids := array_remove(antes_d, old.demanda_id);
        if new.demanda_id is not null then new.demanda_ids := new.demanda_id || array_remove(new.demanda_ids, new.demanda_id); end if;
      end if;
    end if;
    if new.contrato_ids is not distinct from old.contrato_ids then
      new.contrato_ids := antes_k;
      if new.contrato_id is distinct from old.contrato_id then
        new.contrato_ids := array_remove(antes_k, old.contrato_id);
        if new.contrato_id is not null then new.contrato_ids := new.contrato_id || array_remove(new.contrato_ids, new.contrato_id); end if;
      end if;
    end if;
  end if;

  foreach x in array new.demanda_ids loop
    continue when x is null or x = any(v);
    if not x = any(antes_d) then
      select * into d from public.demandas where id = x and escritorio_id = new.escritorio_id;
      if d.id is null or (auth.uid() is not null
          and not privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)
          and not (d.continua and privado.uso_a_continua(d.escritorio_id, d.continua_grupo_id))) then
        raise exception 'Demanda não encontrada neste escritório.';
      end if;
    end if;
    v := v || x;
  end loop;
  -- A tarefa que ganha uma demanda de verdade deixa de ser avulsa: sai da contínua (#313).
  if exists (select 1 from public.demandas dd where dd.id = any(v) and not dd.continua) then
    v := array(select u.id from unnest(v) with ordinality as u(id, i)
               where not exists (select 1 from public.demandas dd where dd.id = u.id and dd.continua) order by u.i);
  end if;
  new.demanda_ids := v;
  if tg_op = 'INSERT' or v[1] is distinct from old.demanda_id then
    new.demanda_id := v[1];
    new.demanda_codigo := (select codigo from public.demandas where id = v[1]);
  end if;

  v := '{}';
  foreach x in array new.contrato_ids loop
    continue when x is null or x = any(v);
    if not x = any(antes_k)
       and not exists (select 1 from public.contratos where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Contrato não encontrado neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.contrato_ids := v;
  if tg_op = 'INSERT' or v[1] is distinct from old.contrato_id then
    new.contrato_id := v[1];
    new.contrato_codigo := (select codigo from public.contratos where id = v[1]);
  end if;
  return new;
end $function$;

-- 10. Quem pode ser mencionado na tarefa: a de 20261122232702_tarefa_solicitante_e_funcoes.sql, sem contar quem está na contínua
--     (ela não abre a tarefa).
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
  -- Na tarefa: quem não é administrador, não está nela, não vê nenhuma das demandas ligadas (a contínua não conta) e não está em
  -- nenhum dos contratos dela (nem no de uma das demandas).
  if new.tarefa_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and p.id is distinct from t.solicitante_id
      and not exists (select 1 from public.demandas d where (d.id = t.demanda_id or t.demanda_ids @> array[d.id]) and not d.continua
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
