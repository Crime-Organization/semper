-- =====================================================================
-- Acrescentar a um checklist, de uma vez, a lista colada (#375)
--   Ao colar uma lista numerada no checklist do cartão (demanda, tarefa ou contrato) e usar os números como grupos (#309), a tela
--   gravava os grupos e os itens um a um: se a internet caía no meio, ou outra pessoa mexia no checklist junto, sobrava metade.
--   checklist_acrescentar grava tudo numa transação (ou nada fica): o que renumerar antes, os grupos e os itens. Serve para todo
--   acréscimo do cartão (um item, várias linhas, um grupo novo, a lista com os números como grupos).
--   Passa pelas regras de quem chama (security invoker), como checklist_criar e checklist_reordenar (20261119142702).
-- Só acrescenta: duas funções novas e os grants. A versão anterior do site continua funcionando (ela não as usa e grava os itens
-- um a um, como antes).
-- =====================================================================

-- Os nós da árvore colada, na ordem de leitura (o grupo, o que está dentro dele, o próximo): o caminho é a posição em cada nível
-- ({2,1} é o primeiro de dentro do segundo) e ordena como a leitura. Para no 4º nível: chegar a ele já basta para recusar a
-- árvore por níveis demais (3 níveis), e checklist_acrescentar confere os níveis antes de contar os nós.
create function privado.nos_da_arvore_colada(p_arvore jsonb) returns table (caminho int[], no jsonb)
language sql immutable set search_path = '' as $$
  with recursive nos(caminho, no) as (
    select array[e.i::int], e.no from jsonb_array_elements(p_arvore) with ordinality as e(no, i)
    union all
    select n.caminho || e.i::int, e.no
    from nos n
    cross join lateral jsonb_array_elements(case when jsonb_typeof(n.no -> 'filhos') = 'array' then n.no -> 'filhos' else '[]' end)
      with ordinality as e(no, i)
    where cardinality(n.caminho) <= 3   -- NIVEIS_DO_CHECKLIST em limites.ts
  )
  select caminho, no from nos order by caminho
$$;
revoke execute on function privado.nos_da_arvore_colada(jsonb) from public, anon;
grant execute on function privado.nos_da_arvore_colada(jsonb) to authenticated;

--   p_lista: o checklist. p_grupo: o grupo de destino (null: no fim do checklist, no primeiro nível).
--   p_arvore: os nós, como nos modelos ({"texto": "RG"} é item; {"texto": "Benefício", "filhos": [...]} é grupo, mesmo vazio).
--   p_ordens: a "ordem" de cada nó, na ordem de leitura. Quem calcula é a tela (ondeEntramOsNovos em app/src/regras/gruposDaLista.ts),
--     que sabe onde o grupo de destino termina na leitura.
--   p_renumerar: as posições a gravar antes, quando não há vão para os novos ([{id, tipo, pai_id, ordem}], como checklist_reordenar).
--   Os níveis são os de erroAoAcrescentar (gruposDaLista.ts), contados a partir do grupo de destino, com as mesmas mensagens.
--   Devolve os ids dos grupos criados, na ordem de leitura.
create function public.checklist_acrescentar(p_lista uuid, p_grupo uuid, p_arvore jsonb, p_ordens jsonb, p_renumerar jsonb default '[]')
returns uuid[]
language plpgsql security invoker set search_path = '' as $$
declare
  c_niveis constant int := 3;          -- NIVEIS_DO_CHECKLIST em limites.ts (o grupo vai até o 2º nível; o item, até o 3º)
  c_item constant int := 500;          -- TAMANHO_ITEM em limites.ts
  c_grupo constant int := 120;         -- TAMANHO_LISTA em limites.ts
  c_mudou constant text := 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.';
  c_fora_de_ordem constant text := 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.';
  v_nivel int := 0; v_nos int; v_fundo int; v_fundo_grupo int; v_errado boolean; v_problema text;
  v_mapa jsonb := '{}'; v_pai uuid; v_id uuid; v_grupos uuid[] := '{}'; n record;
begin
  if not privado.altero_a_lista(p_lista) then
    raise exception 'Você não pode alterar este checklist.';
  end if;
  if jsonb_typeof(p_arvore) is distinct from 'array' or jsonb_typeof(p_ordens) is distinct from 'array'
     or jsonb_typeof(coalesce(p_renumerar, '[]')) <> 'array' then
    raise exception '%', c_fora_de_ordem;
  end if;

  -- O grupo de destino é deste checklist; o nível dele (1: no primeiro nível do checklist).
  if p_grupo is not null then
    with recursive acima(id, pai_id, nivel) as (
      select g.id, g.pai_id, 1 from public.demanda_lista_grupos g where g.id = p_grupo and g.lista_id = p_lista
      union all
      select g.id, g.pai_id, a.nivel + 1 from public.demanda_lista_grupos g join acima a on g.id = a.pai_id where a.nivel <= c_niveis
    )
    select max(nivel) into v_nivel from acima;
    if v_nivel is null then raise exception '%', c_mudou; end if;
  end if;

  -- Cada nó é um objeto com o texto; o de um grupo, com os filhos numa lista.
  select count(*), coalesce(max(cardinality(caminho)), 0), coalesce(max(cardinality(caminho)) filter (where no ? 'filhos'), 0),
         coalesce(bool_or(jsonb_typeof(no) <> 'object' or jsonb_typeof(no -> 'texto') is distinct from 'string'
                          or (no ? 'filhos' and jsonb_typeof(no -> 'filhos') <> 'array')), false)
    into v_nos, v_fundo, v_fundo_grupo, v_errado
  from privado.nos_da_arvore_colada(p_arvore);
  -- Os níveis antes da contagem, como o banco fictício (erroAoAcrescentar vem primeiro): uma árvore funda demais conta só até o
  -- 4º nível, e a recusa tem de ser a dos níveis, não a das posições.
  if v_nivel + v_fundo > c_niveis or v_nivel + v_fundo_grupo > c_niveis - 1 then
    raise exception '%', 'O checklist vai até 3 níveis (como 2.1.1).'
      || case when p_grupo is null then '' else ' Essa lista não cabe neste grupo: mantenha como itens ou cole no fim do checklist.' end;
  end if;
  if v_errado or v_nos <> jsonb_array_length(p_ordens)
     or exists (select 1 from jsonb_array_elements(p_ordens) o where jsonb_typeof(o) <> 'number') then
    raise exception '%', c_fora_de_ordem;
  end if;
  -- Os textos, com as mensagens do banco fictício (app/src/dados/falso.ts), em vez da recusa genérica da regra da tabela.
  select case
           when btrim(no ->> 'texto') = '' then case when no ? 'filhos' then 'Dê um nome ao grupo.' else 'Escreva o item.' end
           when no ? 'filhos' and length(btrim(no ->> 'texto')) > c_grupo then format('O nome do grupo pode ter até %s caracteres.', c_grupo)
           when not no ? 'filhos' and length(btrim(no ->> 'texto')) > c_item then format('O item pode ter até %s caracteres.', c_item)
         end
    into v_problema
  from privado.nos_da_arvore_colada(p_arvore)
  where btrim(no ->> 'texto') = '' or length(btrim(no ->> 'texto')) > case when no ? 'filhos' then c_grupo else c_item end
  order by caminho limit 1;
  if v_problema is not null then raise exception '%', v_problema; end if;

  -- O vão para os novos, se faltava (a mesma conferência de checklist_reordenar: um id que não é do checklist desfaz tudo).
  if jsonb_array_length(coalesce(p_renumerar, '[]')) > 0 then
    perform public.checklist_reordenar(p_lista, p_renumerar);
  end if;

  -- Os grupos antes do que está dentro deles (a leitura já põe assim): o id que o banco dá a cada um vira o pai dos seguintes.
  for n in select l.caminho, l.no, row_number() over (order by l.caminho) as k from privado.nos_da_arvore_colada(p_arvore) l order by l.caminho loop
    v_pai := case when cardinality(n.caminho) = 1 then p_grupo else (v_mapa ->> n.caminho[1:cardinality(n.caminho) - 1]::text)::uuid end;
    if n.no ? 'filhos' then
      insert into public.demanda_lista_grupos (lista_id, pai_id, nome, ordem)
      values (p_lista, v_pai, n.no ->> 'texto', (p_ordens ->> (n.k - 1)::int)::double precision)
      returning id into v_id;
      v_mapa := v_mapa || jsonb_build_object(n.caminho::text, v_id);
      v_grupos := v_grupos || v_id;
    else
      insert into public.demanda_lista_itens (lista_id, grupo_id, texto, ordem)
      values (p_lista, v_pai, n.no ->> 'texto', (p_ordens ->> (n.k - 1)::int)::double precision);
    end if;
  end loop;
  return v_grupos;
end $$;
revoke execute on function public.checklist_acrescentar(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.checklist_acrescentar(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
