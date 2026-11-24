-- =====================================================================
-- Separar um objeto de contrato em dois ou mais (#410)
--   Na importação, alguns objetos vieram juntos num nome só (dois serviços num texto). A lista de objetos das Configurações
--   (#281, 20261122232558_editar_objetos_de_contrato.sql) corrige, junta e apaga; agora também separa. Só administradores,
--   sempre no próprio escritório:
--   1. public.demandas_do_objeto(id): as demandas ligadas ao objeto (código, título e número do contrato), para a tela
--      perguntar a qual objeto novo cada uma fica ligada.
--   2. public.objeto_separar(id, nomes, demandas): o objeto dá lugar aos nomes novos (dois ou mais) na lista e em cada
--      contrato que o usava (arquivados também), na mesma posição. Cada demanda do objeto passa ao objeto novo escolhido em
--      "demandas" ([{"demanda": id, "objeto": nome}]; o título que ainda é igual ao nome antigo acompanha). Nada se apaga:
--      a demanda continua a mesma, com as tarefas, os comentários e o histórico; só muda o objeto a que ela está ligada.
--      Recusa quando falta a escolha de alguma demanda (a tela pergunta). O nome novo que já está na lista se junta a ele
--      (com a grafia da lista); o contrato que já tinha esse objeto fica com um só. Não cria demanda (a mesma marca
--      semper.troca_de_objetos de privado.trocar_objetos): o objeto novo sem demanda pode ganhar a sua pelo cartão do contrato.
--      O modelo de checklist com o nome antigo fica como está, e a resposta conta quantos (a tela avisa para conferir).
-- Só acrescenta: duas funções públicas novas. Nenhuma tabela, coluna, regra ou função existente muda. A versão anterior do
-- site continua funcionando: ela não chama as funções novas.
-- =====================================================================

-- 1. As demandas do objeto.
create function public.demandas_do_objeto(p_id uuid)
returns table (id uuid, codigo text, titulo text, contrato_codigo text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare e uuid := privado.meu_escritorio(); v_descricao text;
begin
  if not privado.sou_admin() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  select s.descricao into v_descricao from public.objeto_sugestoes s where s.id = p_id and s.escritorio_id = e;
  if v_descricao is null then raise exception 'Objeto não encontrado.'; end if;
  return query
  select d.id, d.codigo, d.titulo, d.contrato_codigo from public.demandas d
  where d.escritorio_id = e and privado.mesmo_objeto(d.objeto, v_descricao)
  order by d.contrato_codigo nulls last, d.codigo;
end $$;

-- 2. Separar. As mensagens são as mesmas de app/src/regras/objetos.ts (mudou aqui, muda lá).
create function public.objeto_separar(p_id uuid, p_nomes text[], p_demandas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.objeto_sugestoes := privado.objeto_para_mudar(p_id);
  v_ligacoes jsonb := case when jsonb_typeof(p_demandas) = 'array' then p_demandas else '[]'::jsonb end;
  v_nomes text[]; v_contratos uuid[]; d record; v_para text;
  n_contratos int; n_demandas int := 0; n_modelos_sem int; n_duas int;
begin
  -- Os nomes novos, sem espaços nas pontas e sem os campos vazios, na ordem em que foram escritos.
  select coalesce(array_agg(btrim(x.nome) order by x.n), '{}') into v_nomes
  from unnest(coalesce(p_nomes, '{}')) with ordinality as x(nome, n) where btrim(coalesce(x.nome, '')) <> '';
  if cardinality(v_nomes) < 2 then raise exception 'Escreva ao menos dois nomes para separar.'; end if;
  -- 300: TAMANHO_CONTRATO.objeto em limites.ts.
  if exists (select 1 from unnest(v_nomes) x where length(x) > 300) then raise exception 'O objeto pode ter até 300 caracteres.'; end if;
  if exists (select 1 from unnest(v_nomes) x where privado.mesmo_objeto(x, 'A definir')) then
    raise exception '"A definir" não pode ser o nome de um objeto.';
  end if;
  if (select count(distinct privado.sem_acento(lower(x))) from unnest(v_nomes) x) < cardinality(v_nomes) then
    raise exception 'Os nomes novos não podem se repetir.';
  end if;
  -- O nome que já está na lista (o próprio objeto ou outro) fica com a grafia dela.
  select array_agg(coalesce((select o.descricao from public.objeto_sugestoes o
                             where o.escritorio_id = s.escritorio_id and privado.mesmo_objeto(o.descricao, x.nome) limit 1), x.nome) order by x.n)
  into v_nomes from unnest(v_nomes) with ordinality as x(nome, n);

  -- A trava nos contratos e nas demandas do objeto: quem estiver salvando um deles espera.
  perform 1 from public.contratos k
  where k.escritorio_id = s.escritorio_id and exists (select 1 from unnest(k.objetos) o where privado.mesmo_objeto(o, s.descricao))
  order by k.id for update;
  select coalesce(array_agg(k.id), '{}') into v_contratos from public.contratos k
  where k.escritorio_id = s.escritorio_id and exists (select 1 from unnest(k.objetos) o where privado.mesmo_objeto(o, s.descricao));
  -- Separar não cria demanda: o gatilho privado.demandas_do_contrato olha esta marca (desligada no fim).
  perform set_config('semper.troca_de_objetos', 'sim', true);

  -- 1. As demandas, cada uma no objeto novo escolhido. Sem escolha válida para alguma, nada muda.
  for d in select dd.id, dd.objeto from public.demandas dd
           where dd.escritorio_id = s.escritorio_id and privado.mesmo_objeto(dd.objeto, s.descricao) order by dd.id for update loop
    select x.nome into v_para from unnest(v_nomes) with ordinality as x(nome, n)
    where exists (select 1 from jsonb_array_elements(v_ligacoes) l
                  where l ->> 'demanda' = d.id::text and privado.mesmo_objeto(l ->> 'objeto', x.nome))
    order by x.n limit 1;
    if v_para is null then raise exception 'Escolha o objeto novo de cada demanda.'; end if;
    if d.objeto is distinct from v_para then
      update public.demandas dd set objeto = v_para, titulo = case when privado.mesmo_objeto(dd.titulo, dd.objeto) then v_para else dd.titulo end
      where dd.id = d.id;
      n_demandas := n_demandas + 1;
    end if;
  end loop;

  -- 2. A lista antes dos contratos: os nomes novos entram (o que já está fica), e o antigo sai se não for um dos novos.
  insert into public.objeto_sugestoes (escritorio_id, descricao, criado_por)
  select s.escritorio_id, x, auth.uid() from unnest(v_nomes) x
  on conflict (escritorio_id, privado.sem_acento(btrim(descricao))) do nothing;
  if not exists (select 1 from unnest(v_nomes) x where privado.mesmo_objeto(x, s.descricao)) then
    delete from public.objeto_sugestoes where id = s.id;
  end if;

  -- 3. Os contratos: os nomes novos no lugar do antigo. O gatilho privado.contrato_objetos tira o repetido (o contrato que já
  -- tinha um dos novos fica com um só), confere o máximo de objetos e refaz o "servico"; o histórico ganha a mudança.
  with novos as (
    select k.id, (select array_agg(x.nome order by o.n, x.m)
                  from unnest(k.objetos) with ordinality as o(texto, n)
                  cross join lateral unnest(case when privado.mesmo_objeto(o.texto, s.descricao) then v_nomes else array[o.texto] end)
                    with ordinality as x(nome, m)) as objetos
    from public.contratos k where k.id = any(v_contratos)
  )
  update public.contratos k set objetos = novos.objetos from novos where k.id = novos.id and k.objetos is distinct from novos.objetos;
  get diagnostics n_contratos = row_count;

  -- O modelo de checklist com o nome antigo não sabe a qual dos novos pertence: fica, e a tela avisa para conferir.
  select count(*) into n_modelos_sem from public.lista_modelos m
  where m.escritorio_id = s.escritorio_id and privado.mesmo_objeto(m.nome, s.descricao)
    and not exists (select 1 from unnest(v_nomes) x where privado.mesmo_objeto(x, s.descricao));
  -- Os contratos que ficaram com mais de uma demanda do mesmo objeto (o nome novo que o contrato já tinha, com a demanda dele).
  select count(distinct q.contrato_id) into n_duas from (
    select dd.contrato_id from public.demandas dd, unnest(v_nomes) x
    where dd.contrato_id = any(v_contratos) and privado.mesmo_objeto(dd.objeto, x)
    group by dd.contrato_id, x having count(*) > 1) q;

  perform set_config('semper.troca_de_objetos', '', true);
  return jsonb_build_object('contratos', n_contratos, 'demandas', n_demandas, 'modelos', 0, 'modelos_sem_objeto', n_modelos_sem,
                            'contratos_com_duas_demandas', n_duas);
end $$;

revoke execute on function public.demandas_do_objeto(uuid), public.objeto_separar(uuid, text[], jsonb) from public, anon;
grant execute on function public.demandas_do_objeto(uuid), public.objeto_separar(uuid, text[], jsonb) to authenticated;
