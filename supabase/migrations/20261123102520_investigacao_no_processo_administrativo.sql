-- =====================================================================
-- Extrajudicial e Investigação saem dos tipos de processo; a investigação vira processo administrativo (#406)
--   A #316 criou os tipos "Extrajudicial" e "Investigação", que não existem no trabalho do escritório (decisão do dono): a
--   investigação é um processo administrativo, e o que é extrajudicial é demanda. Vale para todos os escritórios.
--   1. O quadro administrativo de cada escritório (os que existem, agora, e os novos, pelo gatilho) ganha as colunas da
--      investigação, cada uma na sua fase, no fim do grupo dela (privado.colunas_da_investigacao). Coluna de mesmo nome
--      (privado.chave_da_coluna: sem maiúsculas, acentos, espaços e sinais) não se repete. As colunas-marco não mudam.
--      O grupo de cada fase (privado.grupo_da_fase), para o escritório que renomeou ou apagou grupos:
--        a) o grupo de mesmo nome (o de menor ordem);
--        b) sem ele, o grupo de uma das colunas de sempre daquele grupo (privado.colunas_de_sempre_do_grupo: as do quadro do
--           escritório novo e as da investigação; a primeira na ordem do quadro): é o grupo renomeado;
--        c) sem ela, no início: o grupo da coluna-marco do início;
--           no meio: o grupo escolhido para a fase do meio de antes (Análise sem grupo vai para o de Exigências; Decisão, para o
--           de Análise), para as fases não trocarem de lugar; na primeira do meio, o primeiro grupo depois do grupo da coluna do
--           início e antes do grupo da coluna das concluídas;
--        d) sem nenhum: as colunas ficam sem grupo, no alto do quadro, logo depois da coluna do início (fase do início) ou
--           logo antes da coluna das concluídas (meio).
--      No grupo, entram no fim dele: entre a última coluna dele e a seguinte do quadro; no grupo vazio, entre a última coluna
--      dos grupos de antes e a primeira dos grupos de depois (a ordem do quadro todo continua a dos grupos).
--      O "Arquivado" da investigação não vira coluna: é a coluna das concluídas ("Arquivado/baixado").
--      As colunas do quadro extrajudicial não entram.
--   2. Os processos extrajudiciais e as investigações viram administrativos (privado.coluna_administrativa_equivalente):
--        a) na coluna de mesmo nome do quadro administrativo;
--        b) sem ela, na fase equivalente: a coluna das concluídas do quadro antigo, ou do grupo dela, vai para a das concluídas;
--           a do início, ou do grupo dela, para a primeira coluna do grupo do início; as outras, para a primeira coluna do grupo
--           do meio correspondente (privado.grupos_correspondentes; sem correspondente, "Exigências e manifestações"); no meio,
--           sem esse grupo (o quadro sem grupos, ou o grupo vazio), na primeira coluna de sempre dele, na ordem do quadro
--           ("Exigência a cumprir", "Deferido/concedido"), e, sem ela, na coluna logo antes da das concluídas;
--        c) sem nada disso, na coluna do início. Sem coluna (etapa vazia), continua sem coluna.
--      Só mudam o tipo e a coluna: pessoas, papéis, andamentos, prazos, recursos e incidentais, ligações, anotações,
--      compromissos, campos próprios e histórico estão ligados ao processo pelo id e continuam com ele. A mudança de coluna fica
--      no histórico do processo, como qualquer outra.
--      O número não pode repetir entre os administrativos (processos_numero_unico): se já houver um administrativo com o mesmo
--      número, o que vem do tipo que saiu ganha, no fim do número, o nome do tipo de antes ("NOT-1 (extrajudicial)"). A troca
--      fica no histórico do processo.
--      A data e o autor da última alteração (atualizado_em, atualizado_por) ficam os de antes: a conversão não é uma alteração
--      de alguém (o gatilho carimbo fica desligado só durante ela).
--   3. Os campos próprios "Só extrajudicial" e "Só investigação" passam a "Só administrativo". O nome do campo não repete no
--      escritório (processo_campos_nome_unico, o mesmo para todos os tipos): não há como ficar um campo igual duplicado.
--   4. O que depende do tipo e se ajusta sozinho: a página dos avisos de prazo (privado.prazos_da_equipe é uma view, lê o tipo
--      de agora), o painel e os gráficos (contam pelo tipo), a busca pelo código (privado.grupo_do_tipo_de_processo, que passa
--      a pôr os tipos que saíram nos administrativos). Fica como está, de propósito: o registro de auditoria (é o que
--      aconteceu), as preferências de tela das páginas que saíram (só deixam de ser lidas) e as colunas escondidas dos quadros
--      que saíram.
--   5. O site antigo, que ainda oferece os dois tipos: o processo que ele cria (ou o campo que ele marca) como extrajudicial ou
--      investigação vira administrativo sozinho, na coluna equivalente (gatilhos aa_tipo_que_saiu), sem erro para quem usa: o
--      número que repetiria entre os administrativos ganha o nome do tipo de antes, como na conversão. O cartão convertido que a
--      tela antiga ainda mostra no quadro antigo, arrastado para uma coluna desse quadro, vai para a coluna equivalente do
--      administrativo (o mesmo gatilho, na mudança de coluna).
--   6. Escritório novo nasce só com os quadros judicial e administrativo (o de antes da #316).
--   As mesmas regras estão em app/src/regras/investigacaoNoAdministrativo.ts (o banco fictício usa aquelas): mudou aqui, muda lá.
--   Só acrescenta e converte: funções, gatilhos, colunas e a conversão dos processos e dos campos. As regras check (tipo,
--   aparece_em, modulo), os quadros extrajudicial e de investigações e as colunas deles ficam (apagá-los é uma migração separada,
--   depois). A versão anterior do site continua funcionando: os processos convertidos são administrativos comuns, as páginas
--   dos tipos que saíram ficam vazias e o que ela grava nesses tipos vira administrativo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. As colunas da investigação no quadro administrativo
-- ---------------------------------------------------------------------
-- O grupo de cada fase e as colunas que entram nele, na ordem (COLUNAS_DA_INVESTIGACAO, no site).
create function privado.colunas_da_investigacao() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"grupo": "Protocolo", "fase": "inicio", "colunas": ["Instaurado", "Pedido de acesso aos autos"]},
    {"grupo": "Exigências e manifestações", "fase": "meio",
     "colunas": ["Oitiva ou depoimento", "Perícia", "Diligências pendentes", "Manifestação da defesa"]},
    {"grupo": "Análise", "fase": "meio", "colunas": ["Relatório final"]},
    {"grupo": "Decisão", "fase": "meio", "colunas": ["Denúncia oferecida", "Pedido de arquivamento"]}
  ]'::jsonb
$$;
revoke execute on function privado.colunas_da_investigacao() from public, anon, authenticated;

-- As colunas de sempre de cada grupo do quadro administrativo (as do escritório novo e as da investigação), para achar o grupo
-- que o escritório renomeou (colunasDeSempre, no site).
create function privado.colunas_de_sempre_do_grupo(p_grupo text) returns text[]
language sql immutable set search_path = '' as $$
  select array(select jsonb_array_elements_text('{
      "Protocolo": ["Protocolado", "Publicado"],
      "Exigências e manifestações": ["Exigência a cumprir", "Exigência cumprida", "Prazo de oposição", "Manifestar contra oposição",
                                     "Perícia médica", "Avaliação social"],
      "Análise": ["Aguardando decisão"],
      "Decisão": ["Deferido/concedido", "Indeferido", "Recurso administrativo", "Ajuizar ação"]
    }'::jsonb -> p_grupo))
    || array(select jsonb_array_elements_text(f -> 'colunas') from jsonb_array_elements(privado.colunas_da_investigacao()) f
             where f ->> 'grupo' = p_grupo)
$$;
revoke execute on function privado.colunas_de_sempre_do_grupo(text) from public, anon, authenticated;

-- O grupo de uma fase num quadro (grupoDaFase, no site): a) o de mesmo nome; b) o de uma coluna de sempre dele; c) no início, o da
-- coluna do início; no meio, p_anterior (o grupo da fase do meio de antes) ou, sem ele, o primeiro depois do grupo da coluna do
-- início e antes do grupo da coluna das concluídas. null: o quadro não tem um grupo para a fase.
create function privado.grupo_da_fase(p_escritorio uuid, p_modulo text, p_nome text, p_fase text, p_anterior uuid default null)
returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_grupo uuid; v_inicio double precision; v_alvo double precision;
begin
  select g.id into v_grupo from public.quadro_grupos g
  where g.escritorio_id = p_escritorio and g.modulo = p_modulo and privado.chave_da_coluna(g.nome) = privado.chave_da_coluna(p_nome)
  order by g.ordem, g.id limit 1;
  if v_grupo is null then
    select c.grupo_id into v_grupo from public.quadro_colunas c
    where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.grupo_id is not null
      and privado.chave_da_coluna(c.nome) in (select privado.chave_da_coluna(x) from unnest(privado.colunas_de_sempre_do_grupo(p_nome)) x)
    order by c.ordem, c.id limit 1;
  end if;
  if v_grupo is not null then
    return v_grupo;
  end if;
  if p_fase = 'inicio' then
    return (select c.grupo_id from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.marco = 'inicio');
  end if;
  if p_anterior is not null then
    return p_anterior;
  end if;
  -- Entre o grupo da coluna do início e o lugar da coluna das concluídas no alto do quadro (o do grupo dela ou, sem grupo, o dela).
  select g.ordem into v_inicio from public.quadro_colunas c join public.quadro_grupos g on g.id = c.grupo_id
  where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.marco = 'inicio';
  select coalesce(g.ordem, c.ordem) into v_alvo from public.quadro_colunas c left join public.quadro_grupos g on g.id = c.grupo_id
  where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.marco = 'concluido';
  select g.id into v_grupo from public.quadro_grupos g
  where g.escritorio_id = p_escritorio and g.modulo = p_modulo and (v_inicio is null or g.ordem > v_inicio)
    and (v_alvo is null or g.ordem < v_alvo)
  order by g.ordem, g.id limit 1;
  return v_grupo;
end $$;
revoke execute on function privado.grupo_da_fase(uuid, text, text, text, uuid) from public, anon, authenticated;

-- Acrescenta ao quadro as colunas que faltam (colunasNoGrupo, no site), no fim do grupo: entre a última coluna dele e a coluna
-- seguinte do quadro, para a ordem geral também ficar certa; no grupo vazio, entre a última coluna dos grupos de antes e a
-- primeira dos grupos de depois. Sem grupo (p_grupo null), no alto do quadro: logo depois da coluna
-- do início (fase do início) ou logo antes da coluna das concluídas (ou do grupo dela); sem ela, no fim. Devolve quantas entraram.
create function privado.acrescentar_colunas_no_grupo(p_escritorio uuid, p_modulo text, p_nomes text[], p_grupo uuid, p_fase text)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_faltam text[];
  v_quantas int;
  v_anterior double precision;
  v_seguinte double precision;
  v_inicio double precision;
  v_alvo double precision;
  i int;
begin
  select coalesce(array_agg(n.nome order by n.i), '{}') into v_faltam
  from unnest(p_nomes) with ordinality as n(nome, i)
  where not exists (select 1 from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = p_modulo
                    and privado.chave_da_coluna(c.nome) = privado.chave_da_coluna(n.nome));
  v_quantas := cardinality(v_faltam);
  if v_quantas = 0 then
    return 0;
  end if;

  if p_grupo is not null then
    select max(c.ordem) into v_anterior from public.quadro_colunas c where c.grupo_id = p_grupo;
    if v_anterior is not null then
      select min(c.ordem) into v_seguinte from public.quadro_colunas c
      where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.ordem > v_anterior;
    else
      -- O grupo vazio: entre a última coluna dos grupos de antes e a primeira dos grupos de depois (acima daquela).
      select max(c.ordem) into v_anterior from public.quadro_colunas c join public.quadro_grupos g on g.id = c.grupo_id
      where c.escritorio_id = p_escritorio and c.modulo = p_modulo
        and (g.ordem, g.id) < (select x.ordem, x.id from public.quadro_grupos x where x.id = p_grupo);
      select min(c.ordem) into v_seguinte from public.quadro_colunas c join public.quadro_grupos g on g.id = c.grupo_id
      where c.escritorio_id = p_escritorio and c.modulo = p_modulo
        and (g.ordem, g.id) > (select x.ordem, x.id from public.quadro_grupos x where x.id = p_grupo)
        and (v_anterior is null or c.ordem > v_anterior);
    end if;
  else
    select c.ordem into v_inicio from public.quadro_colunas c
    where p_fase = 'inicio' and c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.marco = 'inicio' and c.grupo_id is null;
    if v_inicio is not null then
      v_anterior := v_inicio;
      select min(o) into v_seguinte from privado.ordens_vizinhas(p_escritorio, p_modulo, null) o where o > v_inicio;
    else
      select coalesce(g.ordem, c.ordem) into v_alvo from public.quadro_colunas c left join public.quadro_grupos g on g.id = c.grupo_id
      where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.marco = 'concluido';
      select max(o) into v_anterior from privado.ordens_vizinhas(p_escritorio, p_modulo, null) o where v_alvo is null or o < v_alvo;
      v_seguinte := v_alvo;
    end if;
  end if;

  -- As ordens repartem o espaço entre os vizinhos (o mesmo de ordensEntre no site).
  for i in 1 .. v_quantas loop
    insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco, grupo_id)
    values (p_escritorio, p_modulo, v_faltam[i],
      case
        when v_anterior is not null and v_seguinte is not null then v_anterior + (v_seguinte - v_anterior) * i / (v_quantas + 1)
        when v_anterior is not null then v_anterior + i
        when v_seguinte is not null then v_seguinte - (v_quantas + 1 - i)
        else i
      end,
      null, null, p_grupo);
  end loop;
  return v_quantas;
end $$;
revoke execute on function privado.acrescentar_colunas_no_grupo(uuid, text, text[], uuid, text) from public, anon, authenticated;

-- O quadro administrativo de um escritório ganha as colunas da investigação, fase por fase. Um quadro sem nenhuma coluna fica
-- como está (o preparo do escritório é que o monta). Devolve quantas colunas entraram.
create function privado.investigacao_no_administrativo(p_escritorio uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare f jsonb; v_total int := 0; v_grupo uuid; v_anterior uuid;
begin
  if not exists (select 1 from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = 'processos_administrativos') then
    return 0;
  end if;
  for f in select e.item from jsonb_array_elements(privado.colunas_da_investigacao()) with ordinality as e(item, n) order by e.n loop
    -- No meio, o grupo da fase de antes (v_anterior) vale para a que não tem grupo.
    v_grupo := privado.grupo_da_fase(p_escritorio, 'processos_administrativos', f ->> 'grupo', f ->> 'fase',
                                     case when f ->> 'fase' = 'meio' then v_anterior end);
    if f ->> 'fase' = 'meio' then
      v_anterior := coalesce(v_grupo, v_anterior);
    end if;
    v_total := v_total + privado.acrescentar_colunas_no_grupo(p_escritorio, 'processos_administrativos',
      array(select jsonb_array_elements_text(f -> 'colunas')), v_grupo, f ->> 'fase');
  end loop;
  return v_total;
end $$;
revoke execute on function privado.investigacao_no_administrativo(uuid) from public, anon, authenticated;

-- Escritório novo só nasce com os quadros judicial e administrativo (os de antes da #316, iguais). Quem já tem o de um tipo fica
-- com ele.
create or replace function privado.criar_quadros_de_processos(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q record; g record; c text; v_grupo uuid; v_ordem int; v_grupo_ordem int;
  v_total int; v_marco text;
begin
  for q in select * from (values
    ('processos_judiciais', '[
      {"nome": "Início", "colunas": ["Distribuído", "Pedido de habilitação", "Emendar a inicial", "Tutela provisória", "Aguardando citação"]},
      {"nome": "Conhecimento", "colunas": ["Audiência de conciliação", "Contestação/defesa", "Impugnação à contestação", "Cumprir intimação", "Provas/saneamento/perícia", "Audiência de instrução e julgamento", "Alegações finais/memoriais"]},
      {"nome": "Decisão", "colunas": ["Conclusos/aguardando sentença", "Sentença proferida", "Embargos de declaração", "Recolhimento de custas"]},
      {"nome": "Recursal", "colunas": ["Recorrer", "Contrarrazoar", "Agravar", "Aguardando julgamento", "Julgamento designado", "Aguardando trânsito em julgado"]},
      {"nome": "Cumprimento", "colunas": ["Iniciar cumprimento", "Impugnar cumprimento", "Pesquisas/penhora", "Liquidação", "RPV/precatório", "Alvará"]},
      {"nome": "Encerrado", "fechado": true, "colunas": ["Baixado/arquivado"]}
    ]'::jsonb),
    ('processos_administrativos', '[
      {"nome": "Protocolo", "colunas": ["Protocolado", "Publicado"]},
      {"nome": "Exigências e manifestações", "colunas": ["Exigência a cumprir", "Exigência cumprida", "Prazo de oposição", "Manifestar contra oposição", "Perícia médica", "Avaliação social"]},
      {"nome": "Análise", "colunas": ["Aguardando decisão"]},
      {"nome": "Decisão", "colunas": ["Deferido/concedido", "Indeferido", "Recurso administrativo", "Ajuizar ação"]},
      {"nome": "Concessão e vigência", "colunas": ["Pagamento da concessão", "Expedição do certificado", "Registro em vigor", "Retribuição anual", "Prorrogação", "Contra nulidade"]},
      {"nome": "Encerrado", "fechado": true, "colunas": ["Arquivado/baixado"]}
    ]'::jsonb)
  ) as t(modulo, grupos) loop
    continue when exists (select 1 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = q.modulo);
    v_ordem := 0; v_grupo_ordem := 0;
    v_total := (select sum(jsonb_array_length(e -> 'colunas')) from jsonb_array_elements(q.grupos) e);
    for g in select e from jsonb_array_elements(q.grupos) e loop
      v_grupo_ordem := v_grupo_ordem + 1;
      insert into public.quadro_grupos (escritorio_id, modulo, nome, ordem, comeca_fechado)
      values (p_escritorio, q.modulo, g.e ->> 'nome', v_grupo_ordem, coalesce((g.e ->> 'fechado')::boolean, false))
      returning id into v_grupo;
      for c in select jsonb_array_elements_text(g.e -> 'colunas') loop
        v_ordem := v_ordem + 1;
        v_marco := case v_ordem when 1 then 'inicio' when v_total then 'concluido' end;
        insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco, grupo_id)
        values (p_escritorio, q.modulo, c, v_ordem, null, v_marco, v_grupo);
      end loop;
    end loop;
  end loop;
end $$;
revoke execute on function privado.criar_quadros_de_processos(uuid) from public, anon, authenticated;

-- Escritório novo: as colunas da investigação entram depois que o quadro é montado. O nome vem depois de "quadros_de_processos"
-- e antes de "zz_grupos_depois_das_colunas" na ordem alfabética (o Postgres roda os gatilhos nessa ordem).
create function privado.investigacao_no_administrativo_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.investigacao_no_administrativo(new.id);
  return null;
end $$;
revoke execute on function privado.investigacao_no_administrativo_do_escritorio_novo() from public, anon, authenticated;
create trigger zy_investigacao_no_administrativo after insert on public.escritorios
  for each row execute function privado.investigacao_no_administrativo_do_escritorio_novo();

-- Escritório que já existe: ganha as que faltam, uma vez.
select privado.investigacao_no_administrativo(e.id) from public.escritorios e;

-- ---------------------------------------------------------------------
-- 2. Os processos dos tipos que saíram viram administrativos
-- ---------------------------------------------------------------------
-- O grupo do meio do quadro administrativo que corresponde a cada grupo do meio dos quadros que saíram, pela chave do nome
-- (GRUPOS_CORRESPONDENTES, no site). O que não está aqui vai para "Exigências e manifestações".
create function privado.grupos_correspondentes() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"andamento": "Exigências e manifestações", "diligencias": "Exigências e manifestações", "conclusao": "Decisão"}'::jsonb
$$;
revoke execute on function privado.grupos_correspondentes() from public, anon, authenticated;

-- A coluna do quadro administrativo do escritório que equivale a uma coluna dos quadros que saíram (colunaEquivalente, no site).
-- Coluna vazia continua vazia; coluna que não é de um dos quadros que saíram, ou não é do escritório, volta como veio (a regra
-- do quadro do tipo a recusa, se for o caso).
create function privado.coluna_administrativa_equivalente(p_escritorio uuid, p_etapa uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  e record;
  v_adm constant text := 'processos_administrativos';
  v_coluna uuid;
  v_fase text;
  v_grupo text;
  v_fim double precision;
begin
  select c.id, c.modulo, c.nome, c.marco, c.grupo_id, g.nome as grupo into e
  from public.quadro_colunas c left join public.quadro_grupos g on g.id = c.grupo_id
  where c.id = p_etapa and c.escritorio_id = p_escritorio;
  if e.id is null or e.modulo not in ('processos_extrajudiciais', 'processos_investigacoes') then
    return p_etapa;
  end if;

  -- a) A coluna de mesmo nome.
  select c.id into v_coluna from public.quadro_colunas c
  where c.escritorio_id = p_escritorio and c.modulo = v_adm and privado.chave_da_coluna(c.nome) = privado.chave_da_coluna(e.nome)
  order by c.ordem, c.id limit 1;

  -- b) A fase equivalente: a da coluna (marco) ou a do grupo dela no quadro antigo.
  if v_coluna is null then
    v_fase := case
      when e.marco = 'concluido' or e.grupo_id = (select x.grupo_id from public.quadro_colunas x
                                                  where x.escritorio_id = p_escritorio and x.modulo = e.modulo and x.marco = 'concluido') then 'fim'
      when e.marco = 'inicio' or e.grupo_id = (select x.grupo_id from public.quadro_colunas x
                                               where x.escritorio_id = p_escritorio and x.modulo = e.modulo and x.marco = 'inicio') then 'inicio'
      else 'meio'
    end;
    if v_fase = 'fim' then
      select c.id into v_coluna from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = v_adm and c.marco = 'concluido';
    else
      v_grupo := case when v_fase = 'inicio' then 'Protocolo'
                      else coalesce(privado.grupos_correspondentes() ->> privado.chave_da_coluna(coalesce(e.grupo, '')), 'Exigências e manifestações') end;
      select c.id into v_coluna from public.quadro_colunas c
      where c.grupo_id = privado.grupo_da_fase(p_escritorio, v_adm, v_grupo, v_fase)
      order by c.ordem, c.id limit 1;
      -- O meio sem o grupo (quadro sem grupos, ou o grupo vazio): a primeira coluna de sempre dele, na ordem do quadro; sem ela, a
      -- coluna logo antes da das concluídas.
      if v_coluna is null and v_fase = 'meio' then
        select c.id into v_coluna from public.quadro_colunas c
        where c.escritorio_id = p_escritorio and c.modulo = v_adm
          and privado.chave_da_coluna(c.nome) in (select privado.chave_da_coluna(x) from unnest(privado.colunas_de_sempre_do_grupo(v_grupo)) x)
        order by c.ordem, c.id limit 1;
        if v_coluna is null then
          select c.ordem into v_fim from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = v_adm and c.marco = 'concluido';
          select c.id into v_coluna from public.quadro_colunas c
          where c.escritorio_id = p_escritorio and c.modulo = v_adm and c.marco is null and (v_fim is null or c.ordem < v_fim)
          order by c.ordem desc, c.id desc limit 1;
        end if;
      end if;
    end if;
  end if;

  -- c) Sem nada disso, a coluna do início.
  return coalesce(v_coluna, (select c.id from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = v_adm and c.marco = 'inicio'));
end $$;
revoke execute on function privado.coluna_administrativa_equivalente(uuid, uuid) from public, anon, authenticated;

-- O nome de cada tipo que saiu, para o fim do número que repetiria entre os administrativos.
create function privado.nome_do_tipo_que_saiu(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select ('{"extrajudicial": "extrajudicial", "investigacao": "investigação"}'::jsonb) ->> p_tipo
$$;
revoke execute on function privado.nome_do_tipo_que_saiu(text) from public, anon, authenticated;

-- O número de quem vem de um tipo que saiu: se repetiria o de outro administrativo do escritório (comparado como a regra
-- processos_numero_unico compara), ganha no fim o nome do tipo de antes; se esse também repetiria, o nome e um número
-- ("(extrajudicial 2)") (numeroQueNaoRepete, no site).
create function privado.numero_que_nao_repete(p_escritorio uuid, p_processo uuid, p_numero text, p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_sufixo text; v_numero text := p_numero; i int := 1;
begin
  while exists (select 1 from public.processos y
                where y.escritorio_id = p_escritorio and y.tipo = 'administrativo' and y.id is distinct from p_processo
                  and regexp_replace(upper(y.numero), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v_numero), '[^A-Z0-9]', '', 'g')) loop
    v_sufixo := ' (' || privado.nome_do_tipo_que_saiu(p_tipo) || case when i > 1 then ' ' || i else '' end || ')';
    -- 60: o tamanho do número (TAMANHO_PROCESSO.numero, em app/src/dados/limites.ts).
    v_numero := left(btrim(p_numero), 60 - length(v_sufixo)) || v_sufixo;
    i := i + 1;
  end loop;
  return v_numero;
end $$;
revoke execute on function privado.numero_que_nao_repete(uuid, uuid, text, text) from public, anon, authenticated;

-- O site antigo: o processo que nasce (ou muda para) um dos tipos que saíram vira administrativo, na coluna equivalente, com o
-- número que não repete. E o administrativo que a tela antiga põe numa coluna de um dos quadros que saíram (o cartão convertido
-- que ela ainda mostra no quadro antigo) vai para a coluna equivalente; nas outras colunas, coluna_administrativa_equivalente
-- devolve a mesma. O nome começa com "aa_" para rodar antes dos outros gatilhos "before" (o Postgres os roda em ordem
-- alfabética): o dos campos próprios confere o campo pelo tipo, e a regra do quadro, depois, confere a coluna pelo tipo.
create function privado.tipo_que_saiu_vira_administrativo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.etapa_id := privado.coluna_administrativa_equivalente(new.escritorio_id, new.etapa_id);
  if new.tipo <> 'administrativo' then
    new.numero := privado.numero_que_nao_repete(new.escritorio_id, new.id, new.numero, new.tipo);
    new.tipo := 'administrativo';
  end if;
  return new;
end $$;
revoke execute on function privado.tipo_que_saiu_vira_administrativo() from public, anon, authenticated;
create trigger aa_tipo_que_saiu before insert or update of tipo, etapa_id on public.processos
  for each row when (new.tipo in ('extrajudicial', 'investigacao') or (new.tipo = 'administrativo' and new.etapa_id is not null))
  execute function privado.tipo_que_saiu_vira_administrativo();

-- ---------------------------------------------------------------------
-- 3. Os campos próprios dos tipos que saíram valem para os administrativos (o site antigo, pelo gatilho)
-- ---------------------------------------------------------------------
create function privado.campo_de_tipo_que_saiu() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.aparece_em := 'administrativo';
  return new;
end $$;
revoke execute on function privado.campo_de_tipo_que_saiu() from public, anon, authenticated;
create trigger aa_tipo_que_saiu before insert or update of aparece_em on public.processo_campos
  for each row when (new.aparece_em in ('extrajudicial', 'investigacao')) execute function privado.campo_de_tipo_que_saiu();

-- ---------------------------------------------------------------------
-- A conversão do que já existe num escritório: os processos, um de cada vez (o número que repetiria, com outro administrativo
-- ou com outro que acabou de passar, ganha o nome do tipo de antes), e os campos próprios.
-- ---------------------------------------------------------------------
create function privado.converter_tipos_que_sairam(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p record; v_numero text;
begin
  -- A conversão não é uma alteração de alguém: a data e o autor da última alteração ficam os de antes. O carimbo volta no fim
  -- (tudo é uma transação só: um erro desfaz também o desligar).
  alter table public.processos disable trigger carimbo;
  for p in select x.id, x.tipo, x.numero, x.etapa_id from public.processos x
           where x.escritorio_id = p_escritorio and x.tipo in ('extrajudicial', 'investigacao') order by x.criado_em, x.id loop
    v_numero := privado.numero_que_nao_repete(p_escritorio, p.id, p.numero, p.tipo);
    -- Antes de mudar o tipo (com o tipo de antes, o número novo não repete); só os que repetiriam passam pelo preparo do número.
    if v_numero <> p.numero then
      update public.processos set numero = v_numero where id = p.id;
    end if;
    update public.processos
    set tipo = 'administrativo', etapa_id = privado.coluna_administrativa_equivalente(p_escritorio, p.etapa_id)
    where id = p.id;
  end loop;
  alter table public.processos enable trigger carimbo;
  update public.processo_campos set aparece_em = 'administrativo'
  where escritorio_id = p_escritorio and aparece_em in ('extrajudicial', 'investigacao');
end $$;
revoke execute on function privado.converter_tipos_que_sairam(uuid) from public, anon, authenticated;

-- Os escritórios que já existem, depois das colunas novas (parte 1).
select privado.converter_tipos_que_sairam(e.id) from public.escritorios e;

-- ---------------------------------------------------------------------
-- 4. A busca pelo código: os tipos que saíram ficam com os administrativos (GRUPOS_DA_BUSCA, em app/src/regras/buscaGeral.ts).
-- ---------------------------------------------------------------------
create or replace function privado.grupo_do_tipo_de_processo(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo when 'judicial' then 'judiciais' else 'administrativos' end
$$;
