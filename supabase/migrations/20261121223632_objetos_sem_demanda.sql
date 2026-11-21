-- =====================================================================
-- Objetos do contrato sem demanda, com "Criar esta demanda agora" (#349)
--   O cartão do contrato lista, em qualquer coluna, os objetos que ainda não viraram demanda, cada um com o botão "Criar esta
--   demanda agora". Antes, eles sumiam quando o contrato tinha data de assinatura fora da coluna de assinados, e o objeto
--   acrescentado a um contrato já assinado ficava sem demanda e sem aparecer em lugar nenhum.
--   1. public.contrato_criar_demanda(contrato, objeto): a demanda de um objeto, na hora, ligada ao contrato e ao objeto, como as
--      automáticas (em "Para fazer", com os clientes e o responsável do contrato, e as tarefas do modelo de lista de mesmo nome).
--      Pode quem altera o contrato (privado.altero_o_contrato: administradores, quem criou, o responsável, os participantes e, na
--      fase de adaptação, toda a equipe), com o contrato ativo. Um objeto que já tem demanda neste contrato não ganha outra.
--   2. privado.demandas_do_contrato: quando o contrato chega à coluna de assinados, o objeto que já tem demanda neste contrato (a
--      criada na hora, por exemplo) não ganha outra. O resto é igual à versão de 20261108000016_cliente_ao_contrato.sql.
-- Só acrescenta: uma função nova e uma função trocada, que cria o mesmo de antes menos as demandas repetidas. Nenhuma tabela,
-- coluna ou regra muda. A versão anterior do site continua funcionando: ela não chama a função nova, e a assinatura dela cria as
-- demandas como antes (só não repete a de um objeto que já tem).
-- =====================================================================

-- O mesmo objeto, sem diferença de maiúsculas, acentos e espaços nas pontas (como o banco compara os objetos).
create function privado.mesmo_objeto(a text, b text) returns boolean
language sql immutable set search_path = '' as $$
  select privado.sem_acento(lower(btrim(coalesce(a, '')))) = privado.sem_acento(lower(btrim(coalesce(b, ''))))
$$;
revoke execute on function privado.mesmo_objeto(text, text) from public, anon;

-- 1. A demanda de um objeto, na hora.
create function public.contrato_criar_demanda(p_contrato uuid, p_objeto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k public.contratos; v_objeto text; v_inicio uuid; v_id uuid; v_codigo text;
begin
  if not privado.altero_o_contrato(p_contrato) then raise exception 'Você não tem permissão para fazer isso.'; end if;
  -- A trava no contrato faz dois cliques ao mesmo tempo esperarem um pelo outro: o segundo já acha a demanda do primeiro.
  select * into k from public.contratos where id = p_contrato for update;
  if k.arquivado_em is not null then raise exception 'Este contrato está arquivado. Desarquive para criar a demanda.'; end if;
  select o into v_objeto from unnest(k.objetos) o
  where privado.mesmo_objeto(o, p_objeto) and not privado.mesmo_objeto(o, 'A definir') limit 1;
  if v_objeto is null then raise exception 'Este objeto não está no contrato.'; end if;
  if exists (select 1 from public.demandas d where d.contrato_id = k.id and privado.mesmo_objeto(d.objeto, v_objeto)) then
    raise exception 'Este objeto já tem uma demanda.';
  end if;
  select id into v_inicio from public.quadro_colunas where escritorio_id = k.escritorio_id and modulo = 'demandas' and marco = 'inicio';
  insert into public.demandas (escritorio_id, titulo, responsavel_id, clientes, contrato_id, objeto, etapa_id, etapa_ordem, criado_por)
  values (k.escritorio_id, v_objeto, k.responsavel_id, k.clientes, k.id, v_objeto, v_inicio, extract(epoch from clock_timestamp()), auth.uid())
  returning id, codigo into v_id, v_codigo;
  perform privado.tarefas_do_modelo(v_id);
  return jsonb_build_object('id', v_id, 'codigo', v_codigo);
end $$;
revoke execute on function public.contrato_criar_demanda(uuid, text) from public, anon;
grant execute on function public.contrato_criar_demanda(uuid, text) to authenticated;

-- 2. As demandas na assinatura, sem repetir a de um objeto que já tem demanda neste contrato.
create or replace function privado.demandas_do_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_inicio uuid; v_base double precision := extract(epoch from clock_timestamp()); d record; v_objetos text[];
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id and new.objetos is not distinct from old.objetos then return null; end if;
  if not exists (select 1 from public.quadro_colunas where id = new.etapa_id and marco = 'assinado') then return null; end if;
  select coalesce(array_agg(o.texto order by o.n), '{}') into v_objetos
  from unnest(new.objetos) with ordinality as o(texto, n) where not privado.mesmo_objeto(o.texto, 'A definir');
  if cardinality(v_objetos) = 0 then return null; end if;
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then
    -- Só os objetos mudaram, num contrato que já estava assinado: vale apenas para o que entra no lugar do "A definir".
    if not exists (select 1 from unnest(old.objetos) o where privado.mesmo_objeto(o, 'A definir')) then return null; end if;
    select coalesce(array_agg(x.texto order by x.n), '{}') into v_objetos
    from unnest(v_objetos) with ordinality as x(texto, n)
    where not exists (select 1 from unnest(old.objetos) o where privado.mesmo_objeto(o, x.texto))
      and not exists (select 1 from public.demandas dd where dd.contrato_id = new.id and privado.mesmo_objeto(dd.objeto, x.texto));
    if cardinality(v_objetos) = 0 then return null; end if;
    insert into privado.contratos_com_demandas (contrato_id) values (new.id) on conflict do nothing;
  else
    -- O contrato chegou ao assinado: as demandas nascem uma vez só.
    insert into privado.contratos_com_demandas (contrato_id) values (new.id) on conflict do nothing;
    if not found then return null; end if;
    -- O objeto que já tem demanda neste contrato (a criada na hora, #349) não ganha outra.
    select coalesce(array_agg(x.texto order by x.n), '{}') into v_objetos
    from unnest(v_objetos) with ordinality as x(texto, n)
    where not exists (select 1 from public.demandas dd where dd.contrato_id = new.id and privado.mesmo_objeto(dd.objeto, x.texto));
    if cardinality(v_objetos) = 0 then return null; end if;
  end if;
  select id into v_inicio from public.quadro_colunas
  where escritorio_id = new.escritorio_id and modulo = 'demandas' and marco = 'inicio';
  for d in
    insert into public.demandas (escritorio_id, titulo, responsavel_id, clientes, contrato_id, objeto, etapa_id, etapa_ordem, criado_por)
    select new.escritorio_id, o.texto, new.responsavel_id, new.clientes, new.id, o.texto, v_inicio, v_base + o.n / 1000.0,
           coalesce(auth.uid(), new.criado_por)
    from unnest(v_objetos) with ordinality as o(texto, n)
    returning id
  loop
    perform privado.tarefas_do_modelo(d.id);
  end loop;
  return null;
end $$;
