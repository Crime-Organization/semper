-- Extrajudicial e Investigação saem; a investigação vira processo administrativo (#406). Roda num banco local:
-- supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado dois escritórios de antes da mudança (A, com Ana; B, com Davi), gravados sem os gatilhos do escritório novo, como os que
-- já existiam, e um escritório novo (N), que passa pelos gatilhos.
set local session_replication_role = replica;
insert into public.escritorios (id, nome, slug) values
  ('e4060000-0000-0000-0000-000000000001', 'Escritório A', 'teste-406-a'),
  ('e4060000-0000-0000-0000-000000000002', 'Escritório B', 'teste-406-b');
set local session_replication_role = origin;
insert into public.escritorios (id, nome, slug) values ('e4060000-0000-0000-0000-000000000003', 'Escritório novo', 'teste-406-n');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4060000-0000-0000-0000-000000000001', 'ana-406@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4061'), now()),
  ('e4060000-0000-0000-0000-000000000002', 'davi-406@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4062'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4060000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-406@exemplo.test', '{"convite":"c4061"}', now(), now()),
  ('a4060000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'davi-406@exemplo.test', '{"convite":"c4062"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54060000-0000-0000-0000-000000000001', 'a4060000-0000-0000-0000-000000000001', now(), now()),
  ('54060000-0000-0000-0000-000000000002', 'a4060000-0000-0000-0000-000000000002', now(), now());

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4060000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54060000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Monta um quadro como a #316 montava (grupos e colunas em ordem; a primeira e a última são marcos).
create function pg_temp.quadro_antigo(p_escritorio uuid, p_modulo text, p_grupos jsonb) returns void language plpgsql as $$
declare g jsonb; c text; v_grupo uuid; v_ordem int := 0; v_grupo_ordem int := 0;
  v_total int := (select sum(jsonb_array_length(e -> 'colunas')) from jsonb_array_elements(p_grupos) e);
begin
  for g in select e from jsonb_array_elements(p_grupos) e loop
    v_grupo_ordem := v_grupo_ordem + 1;
    insert into public.quadro_grupos (escritorio_id, modulo, nome, ordem) values (p_escritorio, p_modulo, g ->> 'nome', v_grupo_ordem) returning id into v_grupo;
    for c in select jsonb_array_elements_text(g -> 'colunas') loop
      v_ordem := v_ordem + 1;
      insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco, grupo_id)
      values (p_escritorio, p_modulo, c, v_ordem, null, case v_ordem when 1 then 'inicio' when v_total then 'concluido' end, v_grupo);
    end loop;
  end loop;
  perform privado.grupos_depois_das_colunas(p_escritorio, p_modulo);
end $$;
-- A coluna de um quadro, pelo nome.
create function pg_temp.coluna(p_escritorio text, p_modulo text, p_nome text) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = ('e4060000-0000-0000-0000-00000000000' || p_escritorio)::uuid and modulo = p_modulo and nome = p_nome
$$;
grant execute on function pg_temp.coluna(text, text, text) to authenticated;
-- Os nomes das colunas de um grupo do quadro administrativo, na ordem.
create function pg_temp.colunas_do_grupo(p_escritorio text, p_grupo text) returns text[] language sql as $$
  select array_agg(c.nome order by c.ordem) from public.quadro_colunas c join public.quadro_grupos g on g.id = c.grupo_id
  where c.escritorio_id = ('e4060000-0000-0000-0000-00000000000' || p_escritorio)::uuid and c.modulo = 'processos_administrativos' and g.nome = p_grupo
$$;
-- A coluna em que um processo está.
create function pg_temp.etapa(p_processo text) returns text language sql as $$
  select c.nome from public.processos p join public.quadro_colunas c on c.id = p.etapa_id where p.id = p_processo::uuid
$$;
grant execute on function pg_temp.etapa(text) to authenticated;

-- Os quadros de antes nos dois escritórios: judicial e administrativo como sempre, e os dois da #316.
select privado.criar_quadros_de_processos(e.id) from public.escritorios e where e.id in ('e4060000-0000-0000-0000-000000000001', 'e4060000-0000-0000-0000-000000000002');
select privado.grupos_depois_das_colunas(e.id, null) from public.escritorios e where e.id in ('e4060000-0000-0000-0000-000000000001', 'e4060000-0000-0000-0000-000000000002');
select pg_temp.quadro_antigo(e.id, 'processos_extrajudiciais', '[
  {"nome": "Início", "colunas": ["Aberto", "Reunir documentos"]},
  {"nome": "Andamento", "colunas": ["Notificação enviada", "Aguardando resposta", "Em negociação", "Minuta em análise"]},
  {"nome": "Conclusão", "colunas": ["Acordo ou escritura assinada", "Registro ou averbação"]},
  {"nome": "Encerrado", "colunas": ["Concluído/arquivado"]}]'),
  pg_temp.quadro_antigo(e.id, 'processos_investigacoes', '[
  {"nome": "Instauração", "colunas": ["Instaurado", "Pedido de acesso aos autos"]},
  {"nome": "Diligências", "colunas": ["Oitiva ou depoimento", "Perícia", "Diligências pendentes", "Manifestação da defesa"]},
  {"nome": "Conclusão", "colunas": ["Relatório final", "Denúncia oferecida", "Pedido de arquivamento"]},
  {"nome": "Encerrado", "colunas": ["Arquivado"]}]')
from public.escritorios e where e.id in ('e4060000-0000-0000-0000-000000000001', 'e4060000-0000-0000-0000-000000000002');

-- O A já tinha criado à mão a coluna "PERICIA" (outra grafia de "Perícia") no fim de "Exigências e manifestações".
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, grupo_id, criado_por)
select 'e4060000-0000-0000-0000-000000000001', 'processos_administrativos', 'PERICIA', 8.5, g.id, null from public.quadro_grupos g
where g.escritorio_id = 'e4060000-0000-0000-0000-000000000001' and g.modulo = 'processos_administrativos' and g.nome = 'Exigências e manifestações';
-- O B mexeu nos grupos: "Protocolo" virou "Entrada", "Decisão" virou "Julgamento" e o grupo "Análise" foi apagado (a coluna dele
-- ficou sem grupo).
update public.quadro_grupos set nome = 'Entrada' where escritorio_id = 'e4060000-0000-0000-0000-000000000002' and modulo = 'processos_administrativos' and nome = 'Protocolo';
update public.quadro_grupos set nome = 'Julgamento' where escritorio_id = 'e4060000-0000-0000-0000-000000000002' and modulo = 'processos_administrativos' and nome = 'Decisão';
update public.quadro_colunas set grupo_id = null where grupo_id = (select id from public.quadro_grupos
  where escritorio_id = 'e4060000-0000-0000-0000-000000000002' and modulo = 'processos_administrativos' and nome = 'Análise');
delete from public.quadro_grupos where escritorio_id = 'e4060000-0000-0000-0000-000000000002' and modulo = 'processos_administrativos' and nome = 'Análise';

-- As pessoas, o campo próprio e os processos de antes, gravados direto (sem os gatilhos):
--   X1: investigação em "Oitiva ou depoimento", com cliente, vítima, andamento, prazo, valor do campo "Delegacia" e histórico;
--   X2: investigação arquivada em "Arquivado"; X3: extrajudicial em "Aberto"; X4: extrajudicial em "Em negociação";
--   X5: extrajudicial em "Registro ou averbação"; X6: extrajudicial com o número de um administrativo (AD1); X7: investigação
--   sem coluna; R1: recurso judicial de X1. X9: investigação do B em "Relatório final".
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14060000-0000-0000-0000-000000000001', 'e4060000-0000-0000-0000-000000000001', 'C1', 'contato', 'CLIENTE TESTE', 'a4060000-0000-0000-0000-000000000001'),
  ('14060000-0000-0000-0000-000000000002', 'e4060000-0000-0000-0000-000000000001', 'V1', 'contato', 'VITIMA TESTE', 'a4060000-0000-0000-0000-000000000001'),
  ('14060000-0000-0000-0000-000000000009', 'e4060000-0000-0000-0000-000000000002', 'F1', 'contato', 'PESSOA DE FORA', 'a4060000-0000-0000-0000-000000000002');
insert into public.processo_campos (id, escritorio_id, nome, tipo, aparece_em) values
  ('c4060000-0000-0000-0000-000000000001', 'e4060000-0000-0000-0000-000000000001', 'Delegacia', 'texto', 'investigacao'),
  ('c4060000-0000-0000-0000-000000000002', 'e4060000-0000-0000-0000-000000000001', 'Cartório', 'texto', 'extrajudicial'),
  ('c4060000-0000-0000-0000-000000000009', 'e4060000-0000-0000-0000-000000000002', 'Inquérito', 'texto', 'investigacao');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por, etapa_id, arquivado_em, campos, origem_id, ligacao) values
  ('74060000-0000-0000-0000-000000000001', 'e4060000-0000-0000-0000-000000000001', 'X1', 'investigacao', 'IP 1/2026', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', pg_temp.coluna('1', 'processos_investigacoes', 'Oitiva ou depoimento'), null, '{"c4060000-0000-0000-0000-000000000001": "1ª Delegacia"}', null, null),
  ('74060000-0000-0000-0000-000000000002', 'e4060000-0000-0000-0000-000000000001', 'X2', 'investigacao', 'IP 2/2026', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', pg_temp.coluna('1', 'processos_investigacoes', 'Arquivado'), now(), '{}', null, null),
  ('74060000-0000-0000-0000-000000000003', 'e4060000-0000-0000-0000-000000000001', 'X3', 'extrajudicial', 'NOT-3', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', pg_temp.coluna('1', 'processos_extrajudiciais', 'Aberto'), null, '{}', null, null),
  ('74060000-0000-0000-0000-000000000004', 'e4060000-0000-0000-0000-000000000001', 'X4', 'extrajudicial', 'NOT-4', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', pg_temp.coluna('1', 'processos_extrajudiciais', 'Em negociação'), null, '{}', null, null),
  ('74060000-0000-0000-0000-000000000005', 'e4060000-0000-0000-0000-000000000001', 'X5', 'extrajudicial', 'NOT-5', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', pg_temp.coluna('1', 'processos_extrajudiciais', 'Registro ou averbação'), null, '{}', null, null),
  ('74060000-0000-0000-0000-000000000006', 'e4060000-0000-0000-0000-000000000001', 'X6', 'extrajudicial', 'adm.1', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', null, null, '{}', null, null),
  ('74060000-0000-0000-0000-000000000007', 'e4060000-0000-0000-0000-000000000001', 'X7', 'investigacao', 'IP 7/2026', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', null, null, '{}', null, null),
  ('74060000-0000-0000-0000-000000000008', 'e4060000-0000-0000-0000-000000000001', 'AD1', 'administrativo', 'ADM-1', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', null, null, '{}', null, null),
  ('74060000-0000-0000-0000-000000000010', 'e4060000-0000-0000-0000-000000000001', 'R1', 'judicial', 'REC-1', 'a4060000-0000-0000-0000-000000000001', '{14060000-0000-0000-0000-000000000001}',
   'a4060000-0000-0000-0000-000000000001', null, null, '{}', '74060000-0000-0000-0000-000000000001', 'recurso'),
  ('74060000-0000-0000-0000-000000000009', 'e4060000-0000-0000-0000-000000000002', 'X9', 'investigacao', 'IP 9/2026', 'a4060000-0000-0000-0000-000000000002', '{14060000-0000-0000-0000-000000000009}',
   'a4060000-0000-0000-0000-000000000002', pg_temp.coluna('2', 'processos_investigacoes', 'Relatório final'), null, '{"c4060000-0000-0000-0000-000000000009": "IP 9"}', null, null);
insert into public.processo_clientes (processo_id, pessoa_id, escritorio_id) select p.id, p.clientes[1], p.escritorio_id from public.processos p
where p.id::text like '74060000-%';
insert into public.processo_partes (escritorio_id, processo_id, pessoa_id, papel, criado_por) values
  ('e4060000-0000-0000-0000-000000000001', '74060000-0000-0000-0000-000000000001', '14060000-0000-0000-0000-000000000002', 'vitima', 'a4060000-0000-0000-0000-000000000001'),
  ('e4060000-0000-0000-0000-000000000001', '74060000-0000-0000-0000-000000000001', '14060000-0000-0000-0000-000000000001', 'investigado', 'a4060000-0000-0000-0000-000000000001');
insert into public.processo_andamentos (escritorio_id, processo_id, tipo, data, texto) values
  ('e4060000-0000-0000-0000-000000000001', '74060000-0000-0000-0000-000000000001', 'andamento', '2026-11-01', 'Oitiva marcada');
insert into public.processo_prazos (escritorio_id, processo_id, descricao, final) values
  ('e4060000-0000-0000-0000-000000000001', '74060000-0000-0000-0000-000000000001', 'Apresentar quesitos', '2026-12-01');
insert into public.processo_historico (escritorio_id, processo_id, alteracoes) values
  ('e4060000-0000-0000-0000-000000000001', '74060000-0000-0000-0000-000000000001', '{"titulo": {"de": null, "para": "Inquérito"}}');
set local session_replication_role = origin;

-- ---------- escritório novo ----------
-- Então o escritório novo nasce só com os quadros judicial e administrativo.
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e4060000-0000-0000-0000-000000000003'
             and modulo in ('processos_extrajudiciais', 'processos_investigacoes')), 0::bigint,
  'Então o escritório novo não tem os quadros extrajudicial e de investigações');
-- Então o quadro administrativo dele tem as colunas da investigação no fim de cada grupo.
select is(pg_temp.colunas_do_grupo('3', 'Protocolo'), array['Protocolado', 'Publicado', 'Instaurado', 'Pedido de acesso aos autos'],
  'Então "Instaurado" e "Pedido de acesso aos autos" entram no fim do Protocolo');
select is(pg_temp.colunas_do_grupo('3', 'Exigências e manifestações'), array['Exigência a cumprir', 'Exigência cumprida', 'Prazo de oposição',
  'Manifestar contra oposição', 'Perícia médica', 'Avaliação social', 'Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa'],
  'Então as quatro das diligências entram no fim de Exigências e manifestações');
select is(pg_temp.colunas_do_grupo('3', 'Análise'), array['Aguardando decisão', 'Relatório final'], 'Então "Relatório final" entra em Análise');
select is(pg_temp.colunas_do_grupo('3', 'Decisão'), array['Deferido/concedido', 'Indeferido', 'Recurso administrativo', 'Ajuizar ação',
  'Denúncia oferecida', 'Pedido de arquivamento'], 'Então "Denúncia oferecida" e "Pedido de arquivamento" entram em Decisão');
select is(pg_temp.colunas_do_grupo('3', 'Encerrado'), array['Arquivado/baixado'], 'Então o Encerrado continua só com "Arquivado/baixado" ("Arquivado" não vira coluna)');
-- Então a ordem do quadro todo segue a dos grupos, e os marcos não mudam.
select is((select array_agg(c.nome order by c.ordem) from public.quadro_colunas c
           where c.escritorio_id = 'e4060000-0000-0000-0000-000000000003' and c.modulo = 'processos_administrativos'),
          (select array_agg(c.nome order by g.ordem, c.ordem) from public.quadro_colunas c join public.quadro_grupos g on g.id = c.grupo_id
           where c.escritorio_id = 'e4060000-0000-0000-0000-000000000003' and c.modulo = 'processos_administrativos'),
  'Então a ordem das colunas no quadro todo é a mesma dos grupos');
select is((select array_agg(c.nome || ':' || c.marco order by c.marco) from public.quadro_colunas c
           where c.escritorio_id = 'e4060000-0000-0000-0000-000000000003' and c.modulo = 'processos_administrativos' and c.marco is not null),
  array['Arquivado/baixado:concluido', 'Protocolado:inicio'], 'Então o início continua em "Protocolado" e as concluídas em "Arquivado/baixado"');
select ok((select min(g.ordem) from public.quadro_grupos g where g.escritorio_id = 'e4060000-0000-0000-0000-000000000003' and g.modulo = 'processos_administrativos')
           > (select max(c.ordem) from public.quadro_colunas c where c.escritorio_id = 'e4060000-0000-0000-0000-000000000003' and c.modulo = 'processos_administrativos'),
  'Então os grupos continuam depois das colunas (#296)');
-- E as colunas do quadro extrajudicial não entram.
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e4060000-0000-0000-0000-000000000003' and modulo = 'processos_administrativos'
             and nome in ('Aberto', 'Reunir documentos', 'Notificação enviada', 'Em negociação', 'Concluído/arquivado')), 0::bigint,
  'Então nenhuma coluna do quadro extrajudicial entra no administrativo');

-- ---------- escritório que já existia ----------
-- Quando a migração passa pelos dois escritórios de antes (o que ela faz com cada escritório que existe).
select is(privado.investigacao_no_administrativo('e4060000-0000-0000-0000-000000000001'), 8, 'Quando passa pelo A, então entram 8 colunas (a "Perícia" ele já tinha)');
select is(privado.investigacao_no_administrativo('e4060000-0000-0000-0000-000000000002'), 9, 'Quando passa pelo B, então entram as 9');
select is(privado.investigacao_no_administrativo('e4060000-0000-0000-0000-000000000001'), 0, 'Quando passa de novo, então nada se repete');
-- Então o A não ganha uma segunda "Perícia", e as novas entram depois dela, no fim do grupo.
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e4060000-0000-0000-0000-000000000001' and modulo = 'processos_administrativos'
             and privado.chave_da_coluna(nome) = 'pericia'), 1::bigint, 'Então a coluna de mesmo nome não se repete');
select is((pg_temp.colunas_do_grupo('1', 'Exigências e manifestações'))[6:], array['Avaliação social', 'PERICIA', 'Oitiva ou depoimento', 'Diligências pendentes',
  'Manifestação da defesa'], 'Então as que faltavam entram no fim do grupo, depois das que o escritório tinha');
-- Então, no B, o início vai para o grupo da coluna do início (o Protocolo renomeado), e o meio sem grupo de mesmo nome vai para o
-- último grupo antes do Encerrado.
select is((pg_temp.colunas_do_grupo('2', 'Entrada'))[3:], array['Instaurado', 'Pedido de acesso aos autos'],
  'Então, com o Protocolo renomeado, o início entra no grupo da coluna do início');
select is((pg_temp.colunas_do_grupo('2', 'Concessão e vigência'))[7:], array['Relatório final', 'Denúncia oferecida', 'Pedido de arquivamento'],
  'Então Análise (apagado) e Decisão (renomeado) entram no último grupo antes do Encerrado');
select is((pg_temp.colunas_do_grupo('2', 'Exigências e manifestações'))[7:], array['Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa'],
  'Então o grupo de mesmo nome recebe as suas');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e4060000-0000-0000-0000-000000000002' and modulo = 'processos_administrativos' and marco is not null),
  2::bigint, 'Então os marcos do B não mudam');

-- Quando converte os processos do A (o B ainda não).
select privado.converter_tipos_que_sairam('e4060000-0000-0000-0000-000000000001');
-- Então nenhum processo do A fica nos tipos que saíram, e o do B continua como estava.
select is((select count(*) from public.processos where escritorio_id = 'e4060000-0000-0000-0000-000000000001' and tipo in ('extrajudicial', 'investigacao')),
  0::bigint, 'Então nenhum processo do A fica extrajudicial ou investigação');
select is((select tipo from public.processos where id = '74060000-0000-0000-0000-000000000009'), 'investigacao', 'Então o processo do B não é tocado pela conversão do A');
-- Então cada um vai para a coluna de mesmo nome ou para a da fase equivalente.
select is(pg_temp.etapa('74060000-0000-0000-0000-000000000001'), 'Oitiva ou depoimento', 'Então a investigação vai para a coluna de mesmo nome');
select is(pg_temp.etapa('74060000-0000-0000-0000-000000000002'), 'Arquivado/baixado', 'Então o "Arquivado" vai para a coluna das concluídas');
select is((select arquivado_em is not null from public.processos where id = '74060000-0000-0000-0000-000000000002'), true, 'Então o arquivado continua arquivado');
select is(pg_temp.etapa('74060000-0000-0000-0000-000000000003'), 'Protocolado', 'Então o início do extrajudicial vai para a primeira coluna do Protocolo');
select is(pg_temp.etapa('74060000-0000-0000-0000-000000000004'), 'Exigência a cumprir', 'Então o andamento do extrajudicial vai para a primeira de Exigências e manifestações');
select is(pg_temp.etapa('74060000-0000-0000-0000-000000000005'), 'Deferido/concedido', 'Então a conclusão do extrajudicial vai para a primeira de Decisão');
select is((select etapa_id from public.processos where id = '74060000-0000-0000-0000-000000000007'), null::uuid, 'Então o processo sem coluna continua sem coluna');
-- Então o número que repetiria entre os administrativos ganha o nome do tipo de antes, e a troca fica no histórico.
select is((select numero from public.processos where id = '74060000-0000-0000-0000-000000000006'), 'adm.1 (extrajudicial)', 'Então o número repetido ganha o nome do tipo de antes');
select is((select numero from public.processos where id = '74060000-0000-0000-0000-000000000003'), 'NOT-3', 'Então o número que não repete fica igual');
select ok(exists (select 1 from public.processo_historico where processo_id = '74060000-0000-0000-0000-000000000006' and alteracoes -> 'numero' ->> 'para' = 'adm.1 (extrajudicial)'),
  'Então a troca do número fica no histórico');
-- Então tudo o que estava ligado à investigação continua com ela.
select is((select count(*) from public.processo_partes where processo_id = '74060000-0000-0000-0000-000000000001'), 2::bigint, 'Então as pessoas com papel continuam');
select is((select array_agg(papel::text order by papel) from public.processo_partes where processo_id = '74060000-0000-0000-0000-000000000001'), array['investigado', 'vitima'],
  'Então vítima e investigado continuam como papéis');
select is((select count(*) from public.processo_clientes where processo_id = '74060000-0000-0000-0000-000000000001'), 1::bigint, 'Então o cliente continua');
select is((select count(*) from public.processo_andamentos where processo_id = '74060000-0000-0000-0000-000000000001'), 1::bigint, 'Então o andamento continua');
select is((select count(*) from public.processo_prazos where processo_id = '74060000-0000-0000-0000-000000000001'), 1::bigint, 'Então o prazo continua');
select is((select origem_id from public.processos where id = '74060000-0000-0000-0000-000000000010'), '74060000-0000-0000-0000-000000000001'::uuid, 'Então o recurso continua ligado');
select is((select campos ->> 'c4060000-0000-0000-0000-000000000001' from public.processos where id = '74060000-0000-0000-0000-000000000001'), '1ª Delegacia',
  'Então o valor do campo próprio continua');
select ok(exists (select 1 from public.processo_historico where processo_id = '74060000-0000-0000-0000-000000000001' and alteracoes ? 'titulo'),
  'Então o histórico de antes continua');
-- Então os campos "Só investigação" e "Só extrajudicial" do A passam a "Só administrativo"; o do B ainda não.
select is((select array_agg(aparece_em order by nome) from public.processo_campos where escritorio_id = 'e4060000-0000-0000-0000-000000000001'), array['administrativo', 'administrativo'],
  'Então os campos dos tipos que saíram passam a valer para os administrativos');
select is((select aparece_em from public.processo_campos where id = 'c4060000-0000-0000-0000-000000000009'), 'investigacao', 'Então o campo do B não é tocado');

-- Quando converte o B, então o processo dele vai para "Relatório final", que no B ficou em "Concessão e vigência".
select privado.converter_tipos_que_sairam('e4060000-0000-0000-0000-000000000002');
select is(pg_temp.etapa('74060000-0000-0000-0000-000000000009'), 'Relatório final', 'Então o processo do B vai para a coluna de mesmo nome do quadro dele');
select is((select c.escritorio_id from public.quadro_colunas c join public.processos p on p.etapa_id = c.id where p.id = '74060000-0000-0000-0000-000000000009'),
  'e4060000-0000-0000-0000-000000000002'::uuid, 'Então a coluna é do quadro do próprio B');

-- ---------- o site antigo ----------
-- A coluna "Perícia" do quadro antigo do B (a Ana não a vê; o site antigo poderia mandá-la).
select set_config('teste.coluna_do_b', pg_temp.coluna('2', 'processos_investigacoes', 'Perícia')::text, true);
select pg_temp.entrar(1); set local role authenticated;
-- Quando a Ana, no site antigo, cadastra uma investigação na coluna "Perícia" do quadro antigo, então ela vira administrativa, na "PERICIA".
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, criado_por, etapa_id) values
  ('74060000-0000-0000-0000-000000000021', 'investigacao', 'IP 21/2026', auth.uid(), '{14060000-0000-0000-0000-000000000001}', auth.uid(),
   pg_temp.coluna('1', 'processos_investigacoes', 'Perícia')) $$, 'Quando o site antigo cadastra uma investigação, então não dá erro');
select is((select tipo || ' / ' || pg_temp.etapa(id::text) from public.processos where id = '74060000-0000-0000-0000-000000000021'), 'administrativo / PERICIA',
  'Então ela fica administrativa, na coluna de mesmo nome');
-- Quando cadastra um extrajudicial sem coluna, com o campo que era "Só extrajudicial", então ele vira administrativo.
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, criado_por, campos) values
  ('74060000-0000-0000-0000-000000000022', 'extrajudicial', 'NOT-22', auth.uid(), '{14060000-0000-0000-0000-000000000001}', auth.uid(),
   '{"c4060000-0000-0000-0000-000000000002": "1º Ofício"}') $$, 'Quando o site antigo cadastra um extrajudicial com campo próprio, então não dá erro');
select is((select tipo from public.processos where id = '74060000-0000-0000-0000-000000000022'), 'administrativo', 'Então o extrajudicial fica administrativo');
-- Quando põe a investigação numa coluna do quadro judicial, ou do quadro de outro escritório, então é recusado.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, etapa_id) values
  ('investigacao', 'IP 23/2026', auth.uid(), '{14060000-0000-0000-0000-000000000001}', auth.uid(), pg_temp.coluna('1', 'processos_judiciais', 'Distribuído')) $$,
  '42501', null, 'Quando põe a investigação no quadro judicial, então é recusado');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, etapa_id) values
  ('investigacao', 'IP 24/2026', auth.uid(), '{14060000-0000-0000-0000-000000000001}', auth.uid(), current_setting('teste.coluna_do_b')::uuid) $$,
  '42501', null, 'Quando põe a investigação numa coluna de outro escritório, então é recusado');
-- Quando marca um campo novo como "Só investigação", então ele fica "Só administrativo".
select lives_ok($$ insert into public.processo_campos (id, nome, tipo, aparece_em) values ('c4060000-0000-0000-0000-000000000003', 'Vara criminal', 'texto', 'investigacao') $$,
  'Quando o site antigo cria um campo só da investigação, então não dá erro');
select is((select aparece_em from public.processo_campos where id = 'c4060000-0000-0000-0000-000000000003'), 'administrativo', 'Então o campo fica só do administrativo');
select lives_ok($$ update public.processo_campos set aparece_em = 'extrajudicial' where id = 'c4060000-0000-0000-0000-000000000003' $$,
  'Quando o site antigo muda um campo para "Só extrajudicial", então não dá erro');
select is((select aparece_em from public.processo_campos where id = 'c4060000-0000-0000-0000-000000000003'), 'administrativo', 'Então ele continua só do administrativo');

-- ---------- um escritório não vê o outro ----------
-- Então a Ana não vê as colunas nem os processos do B.
select is((select count(*) from public.quadro_colunas where escritorio_id <> 'e4060000-0000-0000-0000-000000000001'), 0::bigint, 'Então a Ana só vê as colunas do escritório dela');
select is((select count(*) from public.processos where escritorio_id <> 'e4060000-0000-0000-0000-000000000001'), 0::bigint, 'Então a Ana só vê os processos do escritório dela');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.quadro_colunas where escritorio_id <> 'e4060000-0000-0000-0000-000000000002'), 0::bigint, 'Então o Davi só vê as colunas do escritório dele');
select is((select count(*) from public.processos), 1::bigint, 'Então o Davi vê só o processo do escritório dele');
select is((select count(*) from public.processo_campos), 1::bigint, 'Então o Davi vê só o campo do escritório dele');
reset role;

-- ---------- a busca pelo código ----------
select is(privado.grupo_do_tipo_de_processo('investigacao'), 'administrativos', 'Então a busca pelo código põe o tipo que saiu nos administrativos');
select is(privado.grupo_do_tipo_de_processo('judicial'), 'judiciais', 'Então o judicial continua nos judiciais');

select * from finish();
rollback;
