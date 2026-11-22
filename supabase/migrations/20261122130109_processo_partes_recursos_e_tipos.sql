-- =====================================================================
-- Processo: pessoas com papel, recursos e incidentais, e os tipos extrajudicial e investigação (#316)
--   1. Tipos novos: além de judicial e administrativo, o processo pode ser extrajudicial ou uma investigação. Cada tipo tem
--      o seu quadro, como os dois de antes: escritório novo nasce com os quatro; o que já existe ganha os dois novos agora.
--      Os campos que o escritório cria podem valer só para um dos tipos novos. A busca pelo código põe cada tipo no seu grupo.
--   2. Recursos e incidentais: o processo pode nascer de outro (origem_id), como recurso ou incidental (ligacao). Tem o próprio
--      número, os próprios andamentos e prazos. A origem é gravada só ao criar (não muda depois) e precisa ser um processo do
--      mesmo escritório que quem cria vê. Excluir o processo de origem só solta a ligação.
--   3. Pessoas com papel (processo_partes): autor, réu, terceiro, testemunha, perito, assistente técnico... (a lista é a de
--      PAPEIS_DA_PARTE, em app/src/regras/processo.ts: mudou aqui, muda lá). Uma pessoa pode ter mais de um papel no mesmo
--      processo, mas não o mesmo papel duas vezes. Quem altera o processo, com ele ativo, põe e tira; quem o vê, lê. Quem está
--      num processo com papel não pode ser excluída do cadastro. Pôr e tirar fica no histórico do processo; ao excluir a pessoa,
--      o nome dela sai do histórico (LGPD).
--   O texto livre do advogado da parte contrária continua como está (nada é apagado).
--   Só acrescenta (tabela, colunas, funções, gatilhos e regras check mais largas). A versão anterior do site continua
--   funcionando: ela não grava os tipos novos, a origem nem os papéis, e lê os processos de antes como sempre.
-- =====================================================================

-- ---------- 1. Tipos novos ----------
-- Os nomes das regras são os que o Postgres deu às regras das colunas em 20261101155218_processos.sql e
-- 20261101223231_campos_de_processo.sql. Se tiverem outro nome, a migração para no "drop" e nada muda.
alter table public.processos drop constraint processos_tipo_check;
alter table public.processos add constraint processos_tipo_check
  check (tipo in ('judicial', 'administrativo', 'extrajudicial', 'investigacao'));
alter table public.processo_campos drop constraint processo_campos_aparece_em_check;
alter table public.processo_campos add constraint processo_campos_aparece_em_check
  check (aparece_em in ('judicial', 'administrativo', 'extrajudicial', 'investigacao', 'ambos'));

alter table public.quadro_colunas drop constraint quadro_colunas_modulo_check;
alter table public.quadro_colunas add constraint quadro_colunas_modulo_check check (modulo in (
  'pessoas', 'contratos', 'demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes', 'financeiro', 'processos_judiciais', 'processos_administrativos',
  'processos_extrajudiciais', 'processos_investigacoes'));
alter table public.quadro_grupos drop constraint quadro_grupos_modulo_check;
alter table public.quadro_grupos add constraint quadro_grupos_modulo_check check (modulo in (
  'pessoas', 'contratos', 'demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes', 'financeiro', 'processos_judiciais', 'processos_administrativos',
  'processos_extrajudiciais', 'processos_investigacoes'));

-- O quadro de cada tipo (como TIPOS_PROCESSO, em app/src/regras/processo.ts).
create function privado.quadro_do_tipo_de_processo(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'judicial' then 'processos_judiciais'
    when 'administrativo' then 'processos_administrativos'
    when 'extrajudicial' then 'processos_extrajudiciais'
    when 'investigacao' then 'processos_investigacoes'
  end
$$;
revoke execute on function privado.quadro_do_tipo_de_processo(text) from public, anon;
grant execute on function privado.quadro_do_tipo_de_processo(text) to authenticated;

-- A coluna precisa ser do quadro do tipo do processo (a regra de antes, com os quatro quadros).
create or replace function privado.etapa_do_processo(p_etapa uuid, p_tipo text) returns boolean
language sql stable set search_path = '' as $$
  select privado.etapa_valida(p_etapa, privado.quadro_do_tipo_de_processo(p_tipo))
$$;

-- Os quadros de cada escritório: os dois de antes, iguais, e os dois novos. Quem já tem o quadro de um tipo fica com ele.
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
    ]'::jsonb),
    ('processos_extrajudiciais', '[
      {"nome": "Início", "colunas": ["Aberto", "Reunir documentos"]},
      {"nome": "Andamento", "colunas": ["Notificação enviada", "Aguardando resposta", "Em negociação", "Minuta em análise"]},
      {"nome": "Conclusão", "colunas": ["Acordo ou escritura assinada", "Registro ou averbação"]},
      {"nome": "Encerrado", "fechado": true, "colunas": ["Concluído/arquivado"]}
    ]'::jsonb),
    ('processos_investigacoes', '[
      {"nome": "Instauração", "colunas": ["Instaurado", "Pedido de acesso aos autos"]},
      {"nome": "Diligências", "colunas": ["Oitiva ou depoimento", "Perícia", "Diligências pendentes", "Manifestação da defesa"]},
      {"nome": "Conclusão", "colunas": ["Relatório final", "Denúncia oferecida", "Pedido de arquivamento"]},
      {"nome": "Encerrado", "fechado": true, "colunas": ["Arquivado"]}
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

-- Os escritórios que já existem ganham os dois quadros novos, com os grupos depois das colunas (#296), como os de antes.
select privado.criar_quadros_de_processos(id) from public.escritorios;
select privado.grupos_depois_das_colunas(null, 'processos_extrajudiciais');
select privado.grupos_depois_das_colunas(null, 'processos_investigacoes');

-- O grupo da busca geral de cada tipo (GRUPOS_DA_BUSCA, em app/src/regras/buscaGeral.ts).
create function privado.grupo_do_tipo_de_processo(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'judicial' then 'judiciais'
    when 'administrativo' then 'administrativos'
    when 'extrajudicial' then 'extrajudiciais'
    when 'investigacao' then 'investigacoes'
  end
$$;
revoke execute on function privado.grupo_do_tipo_de_processo(text) from public, anon;
grant execute on function privado.grupo_do_tipo_de_processo(text) to authenticated;

-- ---------- 2. Recursos e incidentais ----------
alter table public.processos add column origem_id uuid references public.processos on delete set null;
alter table public.processos add column ligacao text check (ligacao in ('recurso', 'incidental'));
-- Nasce de outro processo: diz se é recurso ou incidental. Excluída a origem, a ligação some e o "recurso" fica.
alter table public.processos add constraint processos_origem_com_ligacao check (origem_id is null or ligacao is not null);
create index processos_origem on public.processos (origem_id) where origem_id is not null;
-- Origem e ligação ficam de fora da lista do que se altera (revoke update de 20261101155218_processos.sql): não mudam depois de criadas.

-- A origem é um processo do mesmo escritório que quem cria vê (a leitura passa pelas regras dela: a função roda como quem chama),
-- e não o próprio processo.
create function privado.conferir_origem_do_processo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.origem_id is null then return new; end if;
  if new.origem_id = new.id
     or not exists (select 1 from public.processos o where o.id = new.origem_id and o.escritorio_id = new.escritorio_id) then
    raise exception 'O processo de origem não foi encontrado neste escritório.';
  end if;
  return new;
end $$;
revoke execute on function privado.conferir_origem_do_processo() from public, anon;
create trigger conferir_origem before insert on public.processos
  for each row execute function privado.conferir_origem_do_processo();

-- ---------- 3. Pessoas com papel no processo ----------
create table public.processo_partes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  processo_id   uuid not null references public.processos on delete cascade,
  pessoa_id     uuid not null constraint processo_partes_pessoa_id_fkey references public.pessoas on delete restrict,
  papel         text not null check (papel in ('autor', 'reu', 'terceiro', 'testemunha', 'perito', 'assistente_tecnico', 'vitima', 'investigado',
                                               'advogado_contrario', 'outro')),
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  unique (processo_id, pessoa_id, papel)
);
create index processo_partes_pessoa on public.processo_partes (pessoa_id);

-- Quantas pessoas com papel cabem num processo (PARTES_MAXIMAS, em app/src/dados/limites.ts).
create function privado.partes_maximas() returns int
language sql immutable set search_path = '' as $$ select 50 $$;
revoke execute on function privado.partes_maximas() from public, anon, authenticated;

-- A pessoa e o processo são do escritório da linha; o processo cabe mais uma pessoa.
create function privado.preparar_parte_do_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.processos p where p.id = new.processo_id and p.escritorio_id = new.escritorio_id) then
    raise exception 'Processo não encontrado neste escritório.';
  end if;
  if not exists (select 1 from public.pessoas p where p.id = new.pessoa_id and p.escritorio_id = new.escritorio_id) then
    raise exception 'Pessoa não encontrada neste escritório.';
  end if;
  if (select count(*) from public.processo_partes x where x.processo_id = new.processo_id) >= privado.partes_maximas() then
    raise exception 'Um processo pode ter até % pessoas com papel.', privado.partes_maximas();
  end if;
  return new;
end $$;
revoke execute on function privado.preparar_parte_do_processo() from public, anon;
create trigger preparar before insert on public.processo_partes
  for each row execute function privado.preparar_parte_do_processo();

-- Pôr e tirar entra no histórico do processo: a pessoa (id e nome) e o papel. O processo excluído leva tudo junto, sem histórico.
create function privado.historico_parte_do_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.processo_partes := case when tg_op = 'DELETE' then old else new end; v_parte jsonb;
begin
  if not exists (select 1 from public.processos p where p.id = v.processo_id) then return null; end if;
  v_parte := jsonb_build_object('pessoa_id', v.pessoa_id, 'nome', (select nome from public.pessoas where id = v.pessoa_id), 'papel', v.papel);
  insert into public.processo_historico (escritorio_id, processo_id, alteracoes, feito_por)
  values (v.escritorio_id, v.processo_id, jsonb_build_object('partes', case when tg_op = 'DELETE'
    then jsonb_build_object('de', v_parte, 'para', null) else jsonb_build_object('de', null, 'para', v_parte) end), auth.uid());
  return null;
end $$;
revoke execute on function privado.historico_parte_do_processo() from public, anon;
create trigger historico after insert or delete on public.processo_partes
  for each row execute function privado.historico_parte_do_processo();
create trigger auditoria after insert or delete on public.processo_partes for each row execute function privado.auditar();

-- LGPD: ao excluir uma pessoa, o nome dela sai das entradas de papel do histórico dos processos.
create function privado.esquecer_pessoa_nas_partes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  foreach k in array array['de', 'para'] loop
    update public.processo_historico h
    set alteracoes = jsonb_set(h.alteracoes, array['partes', k],
      (h.alteracoes -> 'partes' -> k) - 'pessoa_id' || jsonb_build_object('nome', 'pessoa excluída'))
    where h.escritorio_id = old.escritorio_id and h.alteracoes -> 'partes' -> k ->> 'pessoa_id' = old.id::text;
  end loop;
  return null;
end $$;
revoke execute on function privado.esquecer_pessoa_nas_partes() from public, anon;
create trigger esquecer_nas_partes after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nas_partes();

alter table public.processo_partes enable row level security;
revoke all on public.processo_partes from anon;
revoke update on public.processo_partes from authenticated;
-- Quem vê o processo lê; quem altera o processo, com ele ativo, põe e tira (como as etiquetas dele, com os grupos da #378).
create policy leitura on public.processo_partes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos p where p.id = processo_id));
create policy incluir on public.processo_partes for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and exists (select 1 from public.processos p where p.id = processo_id and p.arquivado_em is null
                          and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos)));
create policy apagar on public.processo_partes for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and exists (select 1 from public.processos p where p.id = processo_id and p.arquivado_em is null
                     and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos)));

-- ---------- 4. A busca pelo código, com o grupo de cada tipo ----------
-- A função é a de 20261118220000_pedidos_de_participacao.sql; muda só o grupo dos processos, que vem do tipo (eram dois).
create or replace function privado.itens_pelo_codigo(p_termo text)
returns table (modulo text, grupo text, id uuid, codigo text, numero text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_escritorio uuid := privado.meu_escritorio();
  v_modulos jsonb;
  v_codigo text := upper(btrim(coalesce(p_termo, '')));
  -- O número do processo, como a regra processos_numero_unico o compara: só letras e algarismos, em maiúsculas (a patente do INPI
  -- tem letras: BR 10 2020 012345-6). Só quando o termo tem algum algarismo (como podeSerOCodigo, em app/src/regras/buscaGeral.ts).
  v_numero text := case when coalesce(p_termo, '') ~ '[0-9]' then regexp_replace(upper(p_termo), '[^A-Z0-9]', '', 'g') end;
begin
  if v_escritorio is null or v_codigo = '' then
    return;
  end if;
  select e.modulos into v_modulos from public.escritorios e where e.id = v_escritorio;
  return query
    select 'tarefas'::text, 'tarefas'::text, x.id, x.codigo, null::text from public.tarefas x
    where v_modulos ->> 'tarefas' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    select 'demandas', 'demandas', x.id, x.codigo, null from public.demandas x
    where v_modulos ->> 'demandas' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    select 'compromissos', 'compromissos', x.id, x.codigo, null from public.compromissos x
    where v_modulos ->> 'compromissos' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    select 'anotacoes', 'anotacoes', x.id, x.codigo, null from public.anotacoes x
    where v_modulos ->> 'anotacoes' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    -- O indicador não entra na divisão como participante: o contrato não lhe é oferecido.
    select 'contratos', 'contratos', x.id, x.codigo, null from public.contratos x
    where v_modulos ->> 'contratos' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
      and (x.indicador_id is null or x.indicador_id is distinct from privado.minha_pessoa())
    union all
    select 'processos', privado.grupo_do_tipo_de_processo(x.tipo), x.id, x.codigo,
           case when x.codigo = v_codigo then null else v_numero end
    from public.processos x
    where v_modulos ->> 'processos' = 'true' and x.escritorio_id = v_escritorio and x.arquivado_em is null
      and (x.codigo = v_codigo or (v_numero <> '' and regexp_replace(upper(coalesce(x.numero, '')), '[^A-Z0-9]', '', 'g') = v_numero));
end $$;
