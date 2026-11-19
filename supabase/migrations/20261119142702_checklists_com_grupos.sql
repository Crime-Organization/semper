-- =====================================================================
-- Checklists com grupos e subgrupos numerados, também no contrato (#309)
--   - Os itens de um checklist ficam em grupos e subgrupos (1. Documentos pessoais › 1.1 RG; 2. Benefício ›
--     2.1 Aposentadoria por idade › 2.1.1 CNIS). O número não é guardado: a tela calcula pela árvore e pela ordem
--     (app/src/regras/gruposDaLista.ts). Até 3 níveis (NIVEIS_DO_CHECKLIST em limites.ts): grupos no 1º e no 2º, itens até o 3º.
--   - Os grupos ficam numa tabela própria (demanda_lista_grupos). O item ganha grupo_id (nulo: no primeiro nível, como todos os
--     itens de antes). O site novo grava a "ordem" de grupos e itens na ordem de leitura; a posição de um grupo entre os irmãos é a
--     menor "ordem" dos itens de dentro dele (o grupo vazio usa a dele). Assim a versão anterior, que só vê e renumera os itens,
--     não desarruma os grupos.
--   - Os modelos guardam a árvore (lista_modelos.arvore). Gravada a árvore, o banco põe em "itens" as folhas dela, para a versão
--     anterior e para as tarefas do modelo (privado.tarefas_do_modelo, de 20261108000016, que não muda: só os itens viram tarefas,
--     com o nome do item, sem o do grupo). Se a versão anterior muda "itens", a árvore fica como está e a tela a reconcilia ao ler
--     (reconciliarArvore em gruposDaLista.ts).
--   - O contrato também tem checklists (demanda_listas.contrato_id). Lê quem lê o contrato (a view contratos_da_equipe: as partes,
--     o mencionado e, com equipe_ve_tudo, a equipe); mexe quem altera o contrato (as partes sem a menção, os administradores e,
--     na fase de adaptação, toda a equipe). No contrato arquivado, só a tela trava o checklist, como na demanda.
-- Só acrescenta: uma tabela, duas colunas, funções e regras novas; a regra "lista_de_um_cartao" é trocada por uma mais larga
-- (aceita também o contrato). A versão anterior do site continua funcionando: ela sempre grava a lista com a demanda ou a tarefa
-- (cabe na regra nova), lê e grava só demanda_listas e demanda_lista_itens (nunca vê os grupos) e lê e grava "itens" dos modelos.
-- =====================================================================

-- 1. O checklist do contrato.
alter table public.demanda_listas add column contrato_id uuid references public.contratos on delete cascade;
create index demanda_listas_contrato on public.demanda_listas (contrato_id, ordem) where contrato_id is not null;
alter table public.demanda_listas add constraint lista_de_um_dono check (num_nonnulls(demanda_id, tarefa_id, contrato_id) = 1);
alter table public.demanda_listas drop constraint lista_de_um_cartao;   -- a nova já cobre a antiga e aceita o contrato

-- Quem mexe no checklist do contrato é quem altera o contrato: privado.altero_o_contrato, de 20261111095627 (a regra "alterar"
-- da tabela, que não conta a menção, e, na fase de adaptação, toda a equipe), a mesma dos processos do contrato. Ela não consulta
-- a view contratos_da_equipe (que varre os comentários atrás da menção) e roda uma vez por linha das listas, dos grupos e dos itens.

-- As regras das listas (iguais às de 20261109102349, com o caminho do contrato).
alter policy leitura on public.demanda_listas
  using (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id)));
alter policy tudo on public.demanda_listas
  using (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)))
         and (contrato_id is null or privado.altero_o_contrato(contrato_id)))
  with check (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)))
         and (contrato_id is null or privado.altero_o_contrato(contrato_id)));

-- Igual à de 20261109102349, com o contrato. (Os itens já usam altero_a_lista na regra "tudo" e "exists demanda_listas" na de
-- leitura: ganham o contrato sem mudar.)
create or replace function privado.altero_a_lista(p_lista uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.demanda_listas l
                 left join public.demandas d on d.id = l.demanda_id
                 left join public.tarefas t on t.id = l.tarefa_id
                 where l.id = p_lista
                   and (l.demanda_id is null or (d.id is not null and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
                   and (l.tarefa_id is null or (t.id is not null and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)))
                   and (l.contrato_id is null or privado.altero_o_contrato(l.contrato_id)))
$$;

-- 2. Os grupos.
create table public.demanda_lista_grupos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  lista_id      uuid not null references public.demanda_listas on delete cascade,
  pai_id        uuid references public.demanda_lista_grupos on delete cascade,     -- nulo: no primeiro nível do checklist
  nome          text not null check (btrim(nome) <> '' and length(nome) <= 120),  -- TAMANHO_LISTA em limites.ts
  ordem         double precision not null default 0,   -- só vale para o grupo vazio; o com itens fica onde está o primeiro deles
  criado_em     timestamptz not null default now(),
  constraint grupo_fora_dele_mesmo check (pai_id is distinct from id)
);
create index demanda_lista_grupos_lista on public.demanda_lista_grupos (lista_id, ordem);
create index demanda_lista_grupos_pai on public.demanda_lista_grupos (pai_id) where pai_id is not null;
-- privado.limpar_lista só tira os espaços das pontas de "nome": serve também para o grupo.
create trigger limpar before insert or update of nome on public.demanda_lista_grupos for each row execute function privado.limpar_lista();

alter table public.demanda_lista_itens add column grupo_id uuid references public.demanda_lista_grupos on delete cascade;
create index demanda_lista_itens_grupo on public.demanda_lista_itens (grupo_id) where grupo_id is not null;
grant update (grupo_id) on public.demanda_lista_itens to authenticated;

alter table public.demanda_lista_grupos enable row level security;
revoke all on public.demanda_lista_grupos from anon;
revoke update on public.demanda_lista_grupos from authenticated;
grant update (nome, ordem, pai_id) on public.demanda_lista_grupos to authenticated;
-- Como os itens: lê quem vê o checklist; mexe quem pode alterar o cartão dele.
create policy leitura on public.demanda_lista_grupos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demanda_listas l where l.id = lista_id));
create policy tudo on public.demanda_lista_grupos for all to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and privado.altero_a_lista(lista_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.altero_a_lista(lista_id));

-- A árvore do checklist continua certa: o grupo de cima e o grupo do item são do mesmo checklist, nenhum grupo fica dentro dele
-- mesmo (ou de um subgrupo dele) e nada passa de 3 níveis (NIVEIS_DO_CHECKLIST em limites.ts). Confere o checklist inteiro (são
-- poucas linhas). Gatilho "after", por linha, como o das pastas (20261118120000). A trava por checklist põe duas mudanças ao
-- mesmo tempo uma depois da outra.
create function privado.conferir_arvore_da_lista() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_lista uuid := new.lista_id; v_todos int; v_alcancados int; v_nivel_grupo int; v_nivel_item int;
begin
  perform pg_advisory_xact_lock(hashtext('demanda_listas:' || v_lista::text));
  if exists (select 1 from public.demanda_lista_grupos g join public.demanda_lista_grupos p on p.id = g.pai_id
             where g.lista_id = v_lista and p.lista_id <> g.lista_id)
     or exists (select 1 from public.demanda_lista_itens i join public.demanda_lista_grupos p on p.id = i.grupo_id
                where i.lista_id = v_lista and p.lista_id <> i.lista_id) then
    raise exception 'Esse grupo é de outro checklist.';
  end if;
  -- Os níveis, a partir dos grupos do primeiro nível. Um grupo preso num ciclo não é alcançado por eles.
  with recursive niveis(id, nivel) as (
    select g.id, 1 from public.demanda_lista_grupos g where g.lista_id = v_lista and g.pai_id is null
    union
    select g.id, n.nivel + 1 from public.demanda_lista_grupos g join niveis n on g.pai_id = n.id where g.lista_id = v_lista
  )
  select (select count(*) from public.demanda_lista_grupos where lista_id = v_lista), count(*), coalesce(max(nivel), 0),
         coalesce((select max(n2.nivel) + 1 from public.demanda_lista_itens i join niveis n2 on n2.id = i.grupo_id where i.lista_id = v_lista), 1)
    into v_todos, v_alcancados, v_nivel_grupo, v_nivel_item
  from niveis;
  if v_alcancados < v_todos then
    raise exception 'Um grupo não pode ir para dentro dele mesmo nem de um subgrupo dele.';
  end if;
  -- 3: NIVEIS_DO_CHECKLIST em limites.ts (o grupo vai até o 2º nível; o item, até o 3º).
  if v_nivel_grupo > 3 - 1 or v_nivel_item > 3 then
    raise exception 'O checklist vai até 3 níveis (como 2.1.1).';
  end if;
  return null;
end $$;
create trigger arvore_ao_incluir after insert on public.demanda_lista_grupos
  for each row when (new.pai_id is not null) execute function privado.conferir_arvore_da_lista();
create trigger arvore_ao_mudar after update of pai_id on public.demanda_lista_grupos
  for each row when (new.pai_id is distinct from old.pai_id) execute function privado.conferir_arvore_da_lista();
create trigger arvore_ao_incluir after insert on public.demanda_lista_itens
  for each row when (new.grupo_id is not null) execute function privado.conferir_arvore_da_lista();
create trigger arvore_ao_mudar after update of grupo_id on public.demanda_lista_itens
  for each row when (new.grupo_id is distinct from old.grupo_id) execute function privado.conferir_arvore_da_lista();

-- 3. Criar o checklist com os grupos e os itens de uma vez (do zero ou de um modelo). Passa pelas regras de quem chama.
--   p_grupos: [{chave, pai (chave do grupo de cima ou null), nome, ordem}], com o grupo de cima antes dos de dentro;
--   p_itens:  [{pai (chave do grupo ou null), texto, ordem}]. As chaves só valem nesta chamada (montadas por planoDoChecklist).
--   Chave repetida, ou pai que não veio antes, é recusada (nada fica): o modelo nunca entra desagrupado sem aviso.
create function public.checklist_criar(p_cartao text, p_id uuid, p_nome text, p_grupos jsonb default '[]', p_itens jsonb default '[]')
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_lista uuid; v_ordem double precision; v_mapa jsonb := '{}'; v_id uuid; g record;
begin
  if p_cartao is null or p_cartao not in ('demandas', 'tarefas', 'contratos') then
    raise exception 'Esse cartão não tem checklists.';
  end if;
  -- Cada cartão pela coluna dele (e pelo índice dela).
  select coalesce(max(l.ordem), 0) + 1 into v_ordem from public.demanda_listas l
  where (p_cartao = 'demandas' and l.demanda_id = p_id) or (p_cartao = 'tarefas' and l.tarefa_id = p_id)
     or (p_cartao = 'contratos' and l.contrato_id = p_id);
  insert into public.demanda_listas (demanda_id, tarefa_id, contrato_id, nome, ordem)
  values (case p_cartao when 'demandas' then p_id end, case p_cartao when 'tarefas' then p_id end,
          case p_cartao when 'contratos' then p_id end, p_nome, v_ordem)
  returning id into v_lista;
  for g in select * from jsonb_to_recordset(coalesce(p_grupos, '[]')) as x(chave text, pai text, nome text, ordem double precision) loop
    if g.chave is null or v_mapa ? g.chave or (g.pai is not null and not v_mapa ? g.pai) then
      raise exception 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.';
    end if;
    insert into public.demanda_lista_grupos (lista_id, pai_id, nome, ordem)
    values (v_lista, (v_mapa ->> g.pai)::uuid, g.nome, coalesce(g.ordem, 0)) returning id into v_id;
    v_mapa := v_mapa || jsonb_build_object(g.chave, v_id);
  end loop;
  if exists (select 1 from jsonb_to_recordset(coalesce(p_itens, '[]')) as i(pai text) where i.pai is not null and not v_mapa ? i.pai) then
    raise exception 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.';
  end if;
  insert into public.demanda_lista_itens (lista_id, grupo_id, texto, ordem)
  select v_lista, (v_mapa ->> i.pai)::uuid, i.texto, coalesce(i.ordem, 0)
  from jsonb_to_recordset(coalesce(p_itens, '[]')) as i(pai text, texto text, ordem double precision);
  return v_lista;
end $$;
revoke execute on function public.checklist_criar(text, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.checklist_criar(text, uuid, text, jsonb, jsonb) to authenticated;

-- 4. Gravar as posições depois de subir, descer ou mover para um grupo (de uma vez, para a ordem não ficar pela metade).
--   p_posicoes: [{id, tipo ('grupo' | 'item'), pai_id, ordem}] (montadas por mudancasDePosicao).
--   Os grupos vão antes dos itens: uma ação muda o lugar de um nó só (e leva o que está dentro dele), então cada comando já deixa
--   a árvore certa para o gatilho que confere os níveis (que roda no fim de cada comando).
create function public.checklist_reordenar(p_lista uuid, p_posicoes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_grupos int; v_itens int;
begin
  if not privado.altero_a_lista(p_lista) then
    raise exception 'Você não pode alterar este checklist.';
  end if;
  update public.demanda_lista_grupos g set pai_id = p.pai_id, ordem = p.ordem
  from jsonb_to_recordset(p_posicoes) as p(id uuid, tipo text, pai_id uuid, ordem double precision)
  where p.tipo = 'grupo' and g.id = p.id and g.lista_id = p_lista;
  get diagnostics v_grupos = row_count;
  update public.demanda_lista_itens i set grupo_id = p.pai_id, ordem = p.ordem
  from jsonb_to_recordset(p_posicoes) as p(id uuid, tipo text, pai_id uuid, ordem double precision)
  where p.tipo = 'item' and i.id = p.id and i.lista_id = p_lista;
  get diagnostics v_itens = row_count;
  if v_grupos + v_itens <> jsonb_array_length(p_posicoes) then
    raise exception 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.';
  end if;
end $$;
revoke execute on function public.checklist_reordenar(uuid, jsonb) from public, anon;
grant execute on function public.checklist_reordenar(uuid, jsonb) to authenticated;

-- 5. Os modelos guardam a árvore. Nó: {"texto": "RG"} é item; {"texto": "Documentos pessoais", "filhos": [...]} é grupo.
--    Nulo: o modelo de antes, que é a lista simples de "itens".
alter table public.lista_modelos add column arvore jsonb check (arvore is null or jsonb_typeof(arvore) = 'array');
grant update (arvore) on public.lista_modelos to authenticated;

-- A árvore limpa: textos sem espaços nas pontas, itens vazios fora, grupos sem nada dentro fora, até 3 níveis.
create function privado.limpar_arvore_do_modelo(p_nos jsonb, p_nivel int default 1) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v_saida jsonb := '[]'; v_no jsonb; v_texto text; v_filhos jsonb;
begin
  if jsonb_typeof(p_nos) is distinct from 'array' then
    raise exception 'O modelo de checklist veio num formato que o SEMPER não conhece.';
  end if;
  for v_no in select value from jsonb_array_elements(p_nos) loop
    if jsonb_typeof(v_no) is distinct from 'object' then
      raise exception 'O modelo de checklist veio num formato que o SEMPER não conhece.';
    end if;
    v_texto := btrim(coalesce(v_no ->> 'texto', ''));
    continue when v_texto = '';
    if v_no ? 'filhos' then
      if p_nivel >= 3 then raise exception 'O checklist vai até 3 níveis (como 2.1.1).'; end if;   -- NIVEIS_DO_CHECKLIST
      if length(v_texto) > 120 then raise exception 'O nome de cada grupo pode ter até 120 caracteres.'; end if;   -- TAMANHO_LISTA
      v_filhos := privado.limpar_arvore_do_modelo(v_no -> 'filhos', p_nivel + 1);
      continue when jsonb_array_length(v_filhos) = 0;
      v_saida := v_saida || jsonb_build_array(jsonb_build_object('texto', v_texto, 'filhos', v_filhos));
    else
      v_saida := v_saida || jsonb_build_array(jsonb_build_object('texto', v_texto));
    end if;
  end loop;
  return v_saida;
end $$;
-- As folhas (os itens), na ordem de leitura.
create function privado.itens_da_arvore(p_nos jsonb) returns text[]
language plpgsql immutable set search_path = '' as $$
declare v text[] := '{}'; v_no jsonb;
begin
  for v_no in select value from jsonb_array_elements(p_nos) loop
    v := v || case when v_no ? 'filhos' then privado.itens_da_arvore(v_no -> 'filhos') else array[v_no ->> 'texto'] end;
  end loop;
  return v;
end $$;
-- Quantos grupos a árvore tem, em qualquer nível.
create function privado.grupos_da_arvore(p_nos jsonb) returns int
language plpgsql immutable set search_path = '' as $$
declare v int := 0; v_no jsonb;
begin
  for v_no in select value from jsonb_array_elements(p_nos) loop
    continue when not v_no ? 'filhos';
    v := v + 1 + privado.grupos_da_arvore(v_no -> 'filhos');
  end loop;
  return v;
end $$;

-- Igual à de 20261027000019, mais a árvore:
--   - veio a árvore (nova, ou mudada): ela vale, limpa, e "itens" passa a ser as folhas dela;
--   - não veio (a versão anterior, ou só o nome mudou): "itens" é limpo como antes e a árvore fica como está. Se a versão anterior
--     mudou os itens, a árvore fica defasada: o site novo a reconcilia ao ler (reconciliarArvore) e grava no próximo salvar.
--     Nada se perde, nem numa volta de versão.
create or replace function privado.preparar_modelo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  if new.arvore is not null and (tg_op = 'INSERT' or new.arvore is distinct from old.arvore) then
    new.arvore := privado.limpar_arvore_do_modelo(new.arvore);
    if privado.grupos_da_arvore(new.arvore) > 50 then   -- GRUPOS_DO_MODELO em limites.ts
      raise exception 'Um modelo pode ter até 50 grupos.';
    end if;
    new.itens := privado.itens_da_arvore(new.arvore);
  else
    new.itens := coalesce((select array_agg(btrim(i) order by n) from unnest(new.itens) with ordinality as u(i, n) where btrim(i) <> ''), '{}');
  end if;
  if exists (select 1 from unnest(new.itens) i where length(i) > 500) then
    raise exception 'Cada item do modelo pode ter até 500 caracteres.';
  end if;
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  return new;
end $$;
-- (o gatilho "preparar" de 20261027000019 continua o mesmo: "before insert or update", e chama esta função.)
