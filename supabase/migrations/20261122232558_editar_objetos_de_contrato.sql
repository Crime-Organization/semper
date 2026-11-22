-- =====================================================================
-- Editar a lista de objetos de contrato (#281)
--   Até aqui, a lista de objetos do escritório (objeto_sugestoes) só crescia: cada objeto salvo num contrato entrava nela, e
--   ninguém conseguia corrigir, juntar ou apagar um item. Os contratos guardam o objeto como texto (contratos.objetos), e a
--   demanda nascida dele guarda o mesmo texto (demandas.objeto). Por isso corrigir um nome é trocar o texto em todo lugar.
--   Só administradores, sempre no próprio escritório:
--   1. public.objetos_do_escritorio(): a lista, com quantos contratos ativos e arquivados e quantas demandas usam cada objeto.
--      Antes de contar, põe na lista o objeto que está num contrato e ficou fora dela (os contratos importados sem o gatilho).
--   2. public.objeto_renomear(id, nome): corrige o nome na lista, nos contratos, nas demandas (e no título delas que ainda é
--      igual ao nome antigo) e no modelo de lista de mesmo nome.
--   3. public.objetos_juntar(ids, fica): os objetos de "ids" viram o objeto "fica" em todo lugar e saem da lista. O contrato
--      que tinha os dois fica com um só. As demandas dos dois ficam (ligadas ao que ficou), e a resposta diz quantos contratos
--      ficaram com duas demandas do mesmo objeto.
--   4. public.objeto_apagar(id): tira da lista o objeto que nenhum contrato usa; o que está em uso é recusado, com quantos
--      contratos o usam.
--   A troca vale primeiro nas demandas e depois nos contratos: no contrato assinado que tinha "A definir", o gatilho
--   privado.demandas_do_contrato criaria uma demanda repetida se a ordem fosse a outra. Na lista, a troca vem antes dos
--   contratos, para o gatilho privado.guardar_objetos não pôr o nome novo como um item à parte.
-- Só acrescenta: quatro funções públicas e uma privada. Nenhuma tabela, coluna, gatilho ou regra muda. A versão anterior do
-- site continua funcionando: ela não chama as funções novas.
-- =====================================================================

-- A troca de nomes, em todo lugar, dentro de um escritório: as demandas, os contratos e o modelo de lista. Quem chama já
-- conferiu a permissão e o nome novo. Devolve o que mudou.
create function privado.trocar_objetos(p_escritorio uuid, p_de text[], p_para text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_contratos uuid[]; n_contratos int; n_demandas int; n_modelos int := 0; n_duas int; v_modelo uuid;
begin
  -- A trava nos contratos afetados: quem estiver salvando um deles espera, e ninguém grava o nome antigo no meio da troca.
  perform 1 from public.contratos k
  where k.escritorio_id = p_escritorio and exists (select 1 from unnest(k.objetos) o, unnest(p_de) x where privado.mesmo_objeto(o, x))
  order by k.id for update;
  select coalesce(array_agg(k.id), '{}') into v_contratos from public.contratos k
  where k.escritorio_id = p_escritorio and exists (select 1 from unnest(k.objetos) o, unnest(p_de) x where privado.mesmo_objeto(o, x));

  -- 1. As demandas primeiro. O título muda só se ainda for igual ao nome antigo (quem o reescreveu fica com o dele).
  update public.demandas d
  set objeto = p_para, titulo = case when privado.mesmo_objeto(d.titulo, d.objeto) then p_para else d.titulo end
  where d.escritorio_id = p_escritorio and d.objeto is distinct from p_para
    and exists (select 1 from unnest(p_de) x where privado.mesmo_objeto(d.objeto, x));
  get diagnostics n_demandas = row_count;

  -- 2. Os contratos. O gatilho privado.contrato_objetos tira o repetido (o contrato que tinha os dois fica com um só) e refaz o
  -- "servico"; o histórico de cada contrato ganha a mudança.
  with novos as (
    select k.id, (select array_agg(case when exists (select 1 from unnest(p_de) x where privado.mesmo_objeto(o.texto, x)) then p_para else o.texto end
                                   order by o.n)
                  from unnest(k.objetos) with ordinality as o(texto, n)) as objetos
    from public.contratos k where k.id = any(v_contratos)
  )
  update public.contratos k set objetos = novos.objetos from novos where k.id = novos.id and k.objetos is distinct from novos.objetos;
  get diagnostics n_contratos = row_count;

  -- 3. O modelo de lista com o nome antigo passa a ter o nome novo, para as demandas seguintes continuarem ganhando as tarefas
  -- dele. Só se ainda não houver um modelo com o nome novo e se o nome couber no modelo (120 caracteres: TAMANHO_LISTA em limites.ts).
  if not exists (select 1 from public.lista_modelos m where m.escritorio_id = p_escritorio and privado.mesmo_objeto(m.nome, p_para))
     and length(p_para) <= 120 then
    select m.id into v_modelo from public.lista_modelos m
    where m.escritorio_id = p_escritorio and exists (select 1 from unnest(p_de) x where privado.mesmo_objeto(m.nome, x))
    order by m.criado_em limit 1;
    if v_modelo is not null then
      update public.lista_modelos set nome = p_para where id = v_modelo;
      n_modelos := 1;
    end if;
  end if;

  -- Os contratos que ficaram com mais de uma demanda do mesmo objeto (ao juntar, as duas ficam).
  select count(*) into n_duas from (
    select d.contrato_id from public.demandas d
    where d.contrato_id = any(v_contratos) and privado.mesmo_objeto(d.objeto, p_para)
    group by d.contrato_id having count(*) > 1) s;

  return jsonb_build_object('contratos', n_contratos, 'demandas', n_demandas, 'modelos', n_modelos, 'contratos_com_duas_demandas', n_duas);
end $$;
revoke execute on function privado.trocar_objetos(uuid, text[], text) from public, anon, authenticated;

-- O objeto da lista, no escritório de quem está logado, travado para a mudança. Recusa quem não é administrador.
create function privado.objeto_para_mudar(p_id uuid) returns public.objeto_sugestoes
language plpgsql security definer set search_path = '' as $$
declare s public.objeto_sugestoes;
begin
  if not privado.sou_admin() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  select * into s from public.objeto_sugestoes where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if s.id is null then raise exception 'Objeto não encontrado.'; end if;
  return s;
end $$;
revoke execute on function privado.objeto_para_mudar(uuid) from public, anon, authenticated;

-- 1. A lista, com os números de uso.
create function public.objetos_do_escritorio()
returns table (id uuid, descricao text, contratos_ativos int, contratos_arquivados int, demandas int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare e uuid := privado.meu_escritorio();
begin
  if not privado.sou_admin() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  -- O objeto que está num contrato e ficou fora da lista (o contrato importado sem passar pelo gatilho) entra nela agora.
  insert into public.objeto_sugestoes (escritorio_id, descricao, criado_por)
  select distinct on (privado.sem_acento(btrim(o))) e, btrim(o), null
  from public.contratos k, unnest(k.objetos) o
  where k.escritorio_id = e and btrim(o) <> '' and not privado.mesmo_objeto(o, 'A definir')
  order by privado.sem_acento(btrim(o)), k.criado_em
  on conflict (escritorio_id, privado.sem_acento(btrim(descricao))) do nothing;

  return query
  with usos as (
    select privado.sem_acento(btrim(o)) as chave, count(*) filter (where k.arquivado_em is null) as ativos,
           count(*) filter (where k.arquivado_em is not null) as arquivados
    from public.contratos k, unnest(k.objetos) o where k.escritorio_id = e group by 1
  ), nas_demandas as (
    select privado.sem_acento(btrim(d.objeto)) as chave, count(*) as n
    from public.demandas d where d.escritorio_id = e and d.objeto is not null group by 1
  )
  select s.id, s.descricao, coalesce(u.ativos, 0)::int, coalesce(u.arquivados, 0)::int, coalesce(nd.n, 0)::int
  from public.objeto_sugestoes s
  left join usos u on u.chave = privado.sem_acento(btrim(s.descricao))
  left join nas_demandas nd on nd.chave = privado.sem_acento(btrim(s.descricao))
  where s.escritorio_id = e
  order by privado.sem_acento(btrim(s.descricao));
end $$;

-- 2. Corrigir o nome.
create function public.objeto_renomear(p_id uuid, p_nome text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.objeto_sugestoes := privado.objeto_para_mudar(p_id); v_nome text := btrim(coalesce(p_nome, '')); v_troca jsonb;
begin
  if v_nome = '' then raise exception 'Escreva o nome do objeto.'; end if;
  -- 300: TAMANHO_CONTRATO.objeto em limites.ts.
  if length(v_nome) > 300 then raise exception 'O objeto pode ter até 300 caracteres.'; end if;
  if privado.mesmo_objeto(v_nome, 'A definir') then raise exception '"A definir" não pode ser o nome de um objeto.'; end if;
  if exists (select 1 from public.objeto_sugestoes o where o.escritorio_id = s.escritorio_id and o.id <> s.id and privado.mesmo_objeto(o.descricao, v_nome)) then
    raise exception 'Já existe um objeto com esse nome. Para unir os dois, marque-os e use Juntar.';
  end if;
  if v_nome = s.descricao then
    return jsonb_build_object('contratos', 0, 'demandas', 0, 'modelos', 0, 'contratos_com_duas_demandas', 0);
  end if;
  -- A lista antes dos contratos: assim o gatilho privado.guardar_objetos já acha o nome novo nela.
  update public.objeto_sugestoes set descricao = v_nome where id = s.id;
  v_troca := privado.trocar_objetos(s.escritorio_id, array[s.descricao], v_nome);
  return v_troca;
end $$;

-- 3. Juntar repetidos.
create function public.objetos_juntar(p_ids uuid[], p_fica uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare fica public.objeto_sugestoes := privado.objeto_para_mudar(p_fica); v_ids uuid[]; v_nomes text[];
begin
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_ids, '{}')) x where x is not null and x <> fica.id;
  if cardinality(v_ids) = 0 then raise exception 'Marque ao menos dois objetos para juntar.'; end if;
  select coalesce(array_agg(o.descricao), '{}') into v_nomes from (
    select descricao from public.objeto_sugestoes where id = any(v_ids) and escritorio_id = fica.escritorio_id order by id for update) o;
  if cardinality(v_nomes) <> cardinality(v_ids) then raise exception 'Objeto não encontrado.'; end if;
  -- Os que saem deixam a lista antes da troca nos contratos.
  delete from public.objeto_sugestoes where id = any(v_ids);
  return privado.trocar_objetos(fica.escritorio_id, v_nomes, fica.descricao);
end $$;

-- 4. Apagar o que ninguém usa.
create function public.objeto_apagar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.objeto_sugestoes := privado.objeto_para_mudar(p_id); n int;
begin
  select count(*) into n from public.contratos k
  where k.escritorio_id = s.escritorio_id and exists (select 1 from unnest(k.objetos) o where privado.mesmo_objeto(o, s.descricao));
  -- A mesma mensagem de avisoDoObjetoEmUso, em app/src/regras/objetos.ts.
  if n > 0 then
    raise exception 'Este objeto está em % %. Troque-o por outro antes de apagar: marque os dois e use Juntar.', n, case when n = 1 then 'contrato' else 'contratos' end;
  end if;
  delete from public.objeto_sugestoes where id = s.id;
end $$;

revoke execute on function public.objetos_do_escritorio(), public.objeto_renomear(uuid, text), public.objetos_juntar(uuid[], uuid), public.objeto_apagar(uuid)
  from public, anon;
grant execute on function public.objetos_do_escritorio(), public.objeto_renomear(uuid, text), public.objetos_juntar(uuid[], uuid), public.objeto_apagar(uuid)
  to authenticated;
