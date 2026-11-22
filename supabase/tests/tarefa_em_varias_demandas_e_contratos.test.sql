-- Tarefa ligada a mais de uma demanda e a mais de um contrato (#283). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (colaboradora só da D2), Caio (participante só do contrato K2) e Eva (da equipe,
-- sem nenhuma ligação), e o Davi, administrador de outro escritório, com a demanda D9 e o contrato K9.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-varias-ligacoes', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-varias-ligacoes-2', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eva@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 5) as n;

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'pf', 'CAIO', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000004');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000003', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AA11', 2030, 'AA11-0002-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000003", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000009', 'OUTRO CLIENTE',
   'a0000000-0000-0000-0000-000000000004', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000004');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda da Ana', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Demanda com a Bia', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Outra da Ana', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda de fora', 'a0000000-0000-0000-0000-000000000004', '{}', 'a0000000-0000-0000-0000-000000000004');
-- A tarefa gravada com os gatilhos desligados (como numa importação): só com a demanda principal, sem a lista.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, demanda_codigo, criado_por) values
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'T5', 'Importada', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000002', 'D2', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.tarefa(p_campo text) returns text language sql as $$
  select to_jsonb(t) ->> p_campo from public.tarefas t where t.id = '70000000-0000-0000-0000-000000000001'
$$;

-- ===== A versão anterior do site continua funcionando =====
-- Quando a Ana cria a tarefa como a versão anterior (só demanda_id e contrato_id), então a lista nasce com eles
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.tarefas (id, titulo, responsavel_id, demanda_id, contrato_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'Tarefa de duas demandas', 'a0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001') $$, 'A versão anterior cria com uma demanda e um contrato');
select is(pg_temp.tarefa('demanda_ids'), '["71000000-0000-0000-0000-000000000001"]', 'A lista de demandas nasce com a demanda');
select is(pg_temp.tarefa('contrato_ids'), '["c0000000-0000-0000-0000-000000000001"]', 'A lista de contratos nasce com o contrato');
select results_eq($$ select codigo, ordem from public.tarefa_demandas where tarefa_id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values ('D1'::text, 1) $$, 'A ligação guarda o código da demanda');

-- ===== Mais de uma demanda e mais de um contrato =====
-- Quando a Ana acrescenta a D2 e o K2 (o "+" do cadastro grava as listas inteiras)
select lives_ok($$ update public.tarefas set demanda_ids = '{71000000-0000-0000-0000-000000000001,71000000-0000-0000-0000-000000000002}',
  contrato_ids = '{c0000000-0000-0000-0000-000000000001,c0000000-0000-0000-0000-000000000002}' where id = '70000000-0000-0000-0000-000000000001' $$,
  'Liga mais uma demanda e mais um contrato');
-- Então as colunas de antes continuam com o principal, e as ligações têm as duas, em ordem
select is(pg_temp.tarefa('demanda_id'), '71000000-0000-0000-0000-000000000001', 'A demanda principal continua a primeira');
select is(pg_temp.tarefa('contrato_codigo'), 'AA11-0001-2030', 'O contrato principal continua o primeiro');
select results_eq($$ select codigo from public.tarefa_demandas where tarefa_id = '70000000-0000-0000-0000-000000000001' order by ordem $$,
  $$ values ('D1'::text), ('D2') $$, 'As duas demandas, em ordem');
select results_eq($$ select codigo from public.tarefa_contratos where tarefa_id = '70000000-0000-0000-0000-000000000001' order by ordem $$,
  $$ values ('AA11-0001-2030'::text), ('AA11-0002-2030') $$, 'Os dois contratos, em ordem');
-- E a tarefa aparece em cada demanda e em cada contrato ligado (a busca das seções Tarefas)
select is((select count(*) from public.tarefas where demanda_ids @> '{71000000-0000-0000-0000-000000000002}'), 1::bigint, 'A tarefa aparece na segunda demanda');
select is((select count(*) from public.tarefas where contrato_ids @> '{c0000000-0000-0000-0000-000000000002}'), 1::bigint, 'A tarefa aparece no segundo contrato');
-- E o histórico conta a troca pelos códigos, sem repetir a coluna do principal
select results_eq($$ select alteracoes -> 'demandas' ->> 'para', alteracoes -> 'contratos' ->> 'para', alteracoes ? 'demanda' from public.tarefa_historico
  where tarefa_id = '70000000-0000-0000-0000-000000000001' order by id desc limit 1 $$,
  $$ values ('D1, D2'::text, 'AA11-0001-2030, AA11-0002-2030'::text, false) $$, 'O histórico mostra as listas pelos códigos');
-- E a menção vale para quem está no segundo contrato
select lives_ok($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000001', '@caio veja') $$,
  'Menciona quem está num dos contratos ligados');
reset role;

-- ===== Quem vê a tarefa considera todas as ligações =====
-- Quando a Bia, que está só na segunda demanda, abre a tarefa, então a vê e a altera
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem está na segunda demanda vê a tarefa');
select is((select count(*) from public.tarefa_demandas where tarefa_id = '70000000-0000-0000-0000-000000000001'), 2::bigint, 'E vê as duas ligações, mesmo a demanda que não abre');
select results_eq($$ update public.tarefas set titulo = 'Mudada pela Bia' where id = '70000000-0000-0000-0000-000000000001' returning titulo $$,
  $$ values ('Mudada pela Bia'::text) $$, 'Quem está na segunda demanda altera a tarefa');
select lives_ok($$ insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, inicio, segundos) values
  ('e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', now(), 60) $$,
  'E registra tempo nela');
-- E não liga uma demanda que não pode ver
select throws_ok($$ update public.tarefas set demanda_ids = demanda_ids || '71000000-0000-0000-0000-000000000003'::uuid where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Demanda não encontrada neste escritório.', 'Não liga a demanda que não vê');
-- E vê a tarefa importada só com a demanda principal (sem a lista)
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000005'), 1::bigint, 'A tarefa sem a lista continua vista pela demanda principal');
reset role;

-- Quando o Caio, que está só no segundo contrato, abre a tarefa, então a vê, só para ler
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem está no segundo contrato vê a tarefa');
select results_eq($$ with x as (update public.tarefas set titulo = 'Do Caio' where id = '70000000-0000-0000-0000-000000000001' returning 1) select count(*) from x $$,
  $$ values (0::bigint) $$, 'Mas não altera');
reset role;

-- Quando a Eva, da equipe mas sem nenhuma ligação, procura a tarefa, então não a vê, não vê as ligações dela e não a altera
select pg_temp.entrar(5); set local role authenticated;
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem não está em nada não vê a tarefa');
select is((select count(*) from public.tarefa_demandas where tarefa_id = '70000000-0000-0000-0000-000000000001')
          + (select count(*) from public.tarefa_contratos where tarefa_id = '70000000-0000-0000-0000-000000000001'), 0::bigint,
  'Nem as demandas e os contratos ligados a ela');
select results_eq($$ with x as (update public.tarefas set demanda_ids = '{}' where id = '70000000-0000-0000-0000-000000000001' returning 1) select count(*) from x $$,
  $$ values (0::bigint) $$, 'Nem tira as ligações dela');
reset role;

-- ===== Tirar uma ligação =====
-- Quando a Ana tira a primeira demanda, então a tarefa continua na outra, que passa a ser a principal
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set demanda_ids = '{71000000-0000-0000-0000-000000000002}' where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.tarefa('demanda_id'), '71000000-0000-0000-0000-000000000002', 'A outra demanda vira a principal');
select is(pg_temp.tarefa('demanda_codigo'), 'D2', 'Com o código dela');
select results_eq($$ select codigo from public.tarefa_demandas where tarefa_id = '70000000-0000-0000-0000-000000000001' $$, $$ values ('D2'::text) $$, 'Só a outra fica ligada');
-- Quando a versão anterior troca a demanda principal, então a troca vale só para ela
update public.tarefas set demanda_ids = '{71000000-0000-0000-0000-000000000002,71000000-0000-0000-0000-000000000001}' where id = '70000000-0000-0000-0000-000000000001';
update public.tarefas set demanda_id = '71000000-0000-0000-0000-000000000003' where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.tarefa('demanda_ids'), '["71000000-0000-0000-0000-000000000003", "71000000-0000-0000-0000-000000000001"]', 'A versão anterior troca só a principal');
-- E quando ela tira a demanda (null), então sai só a principal, e a próxima toma o lugar
update public.tarefas set demanda_id = null where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.tarefa('demanda_ids'), '["71000000-0000-0000-0000-000000000001"]', 'Tirar pela versão anterior tira só a principal');
select is(pg_temp.tarefa('demanda_id'), '71000000-0000-0000-0000-000000000001', 'E a próxima vira a principal');
update public.tarefas set demanda_ids = '{71000000-0000-0000-0000-000000000001,71000000-0000-0000-0000-000000000002}' where id = '70000000-0000-0000-0000-000000000001';
-- Quando a tarefa importada (sem a lista) ganha mais uma demanda, então a principal fica
update public.tarefas set demanda_ids = '{71000000-0000-0000-0000-000000000002,71000000-0000-0000-0000-000000000001}' where id = '70000000-0000-0000-0000-000000000005';
select results_eq($$ select codigo from public.tarefa_demandas where tarefa_id = '70000000-0000-0000-0000-000000000005' order by ordem $$,
  $$ values ('D2'::text), ('D1') $$, 'A importada passa a ter a lista');
reset role;

-- ===== Excluir uma demanda ou um contrato ligado =====
-- Quando o contrato principal é excluído, então a tarefa continua, ligada ao outro
delete from public.contratos where id = 'c0000000-0000-0000-0000-000000000001';
select is(pg_temp.tarefa('contrato_ids'), '["c0000000-0000-0000-0000-000000000002"]', 'O contrato excluído sai da lista');
select is(pg_temp.tarefa('contrato_id'), 'c0000000-0000-0000-0000-000000000002', 'E o outro vira o principal');
select results_eq($$ select codigo from public.tarefa_contratos where tarefa_id = '70000000-0000-0000-0000-000000000001' $$, $$ values ('AA11-0002-2030'::text) $$,
  'Só o outro contrato fica ligado');
-- Quando a demanda que não é a principal é excluída, então a tarefa continua na principal
delete from public.demandas where id = '71000000-0000-0000-0000-000000000002';
select is(pg_temp.tarefa('demanda_ids'), '["71000000-0000-0000-0000-000000000001"]', 'A demanda excluída sai da lista');
select is(pg_temp.tarefa('demanda_id'), '71000000-0000-0000-0000-000000000001', 'A principal continua');
select is((select count(*) from public.tarefa_demandas where demanda_id = '71000000-0000-0000-0000-000000000002'), 0::bigint, 'E a ligação dela some');
select is((select alteracoes -> 'demandas' ->> 'de' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' order by id desc limit 1),
  'D1, demanda excluída', 'O histórico diz que a demanda foi excluída');
-- E a Bia, que via a tarefa só pela demanda excluída, deixa de vê-la
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem estava só na demanda excluída deixa de ver a tarefa');
reset role;

-- ===== Dois escritórios =====
select pg_temp.entrar(1); set local role authenticated;
-- Quando a Ana tenta ligar a demanda ou o contrato de outro escritório, então é recusado
select throws_ok($$ update public.tarefas set demanda_ids = demanda_ids || '71000000-0000-0000-0000-000000000009'::uuid where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Demanda não encontrada neste escritório.', 'Não liga demanda de outro escritório');
select throws_ok($$ update public.tarefas set contrato_ids = contrato_ids || 'c0000000-0000-0000-0000-000000000009'::uuid where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Contrato não encontrado neste escritório.', 'Não liga contrato de outro escritório');
-- E ninguém grava nas tabelas de ligação pela tela
select throws_ok($$ insert into public.tarefa_demandas (tarefa_id, demanda_id, escritorio_id, codigo) values
  ('70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'D9') $$,
  '42501', null, 'A tabela de ligação não aceita gravação pela tela');
reset role;
-- Quando o Davi, do outro escritório, procura as ligações, então não vê nenhuma
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.tarefa_demandas), 0::bigint, 'Outro escritório não vê as demandas ligadas');
select is((select count(*) from public.tarefa_contratos), 0::bigint, 'Outro escritório não vê os contratos ligados');
-- E não vê nem altera a tarefa do outro escritório (nem para pô-la na demanda dele)
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'Outro escritório não vê a tarefa');
select results_eq($$ with x as (update public.tarefas set demanda_ids = '{71000000-0000-0000-0000-000000000009}' where id = '70000000-0000-0000-0000-000000000001' returning 1)
  select count(*) from x $$, $$ values (0::bigint) $$, 'Nem a liga à demanda dele');
-- E a tarefa dele não nasce ligada à demanda ou ao contrato do outro escritório, pela lista ou pela coluna da versão anterior
select throws_ok($$ insert into public.tarefas (titulo, responsavel_id, demanda_ids, criado_por) values ('De fora', 'a0000000-0000-0000-0000-000000000004',
  '{71000000-0000-0000-0000-000000000001}', 'a0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'Demanda não encontrada neste escritório.', 'Não cria tarefa na demanda de outro escritório');
select throws_ok($$ insert into public.tarefas (titulo, responsavel_id, contrato_ids, criado_por) values ('De fora', 'a0000000-0000-0000-0000-000000000004',
  '{c0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'Contrato não encontrado neste escritório.', 'Não cria tarefa no contrato de outro escritório');
select throws_ok($$ insert into public.tarefas (titulo, responsavel_id, demanda_id, criado_por) values ('De fora', 'a0000000-0000-0000-0000-000000000004',
  '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'Demanda não encontrada neste escritório.', 'Nem pela coluna da versão anterior');
reset role;

-- ===== Por dentro =====
select ok((select relrowsecurity from pg_class where oid = 'public.tarefa_demandas'::regclass)
          and (select relrowsecurity from pg_class where oid = 'public.tarefa_contratos'::regclass), 'As tabelas de ligação têm RLS');
-- Sem chave estrangeira para demandas e contratos: com ela, o PostgREST recusaria a leitura "demanda:demandas(...)" da versão anterior (PGRST201).
select is((select count(*) from pg_constraint where contype = 'f' and conrelid in ('public.tarefa_demandas'::regclass, 'public.tarefa_contratos'::regclass)
           and confrelid in ('public.demandas'::regclass, 'public.contratos'::regclass)), 0::bigint,
  'As tabelas de ligação não têm chave estrangeira para demandas e contratos');
select is((select count(*) from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ~ 'estou_na_tarefa\('), 0::bigint,
  'Nenhuma regra confere a tarefa só pela demanda principal');
select is((select array_agg(p.proname::text order by 1) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'privado') and p.prosrc ~ 'estou_na_tarefa\(' and p.proname <> 'estou_na_tarefa_ligada'), null,
  'Nenhuma função confere a tarefa só pela demanda principal');
select is(array_agg(p.oid::regprocedure::text order by 1) filter (where not coalesce(p.proconfig @> array['search_path=""'], false)), null,
  'As funções novas têm search_path vazio')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'privado' and p.proname in ('ligacoes_da_tarefa', 'copiar_ligacoes_da_tarefa', 'demanda_sai_das_tarefas', 'contrato_sai_das_tarefas',
  'codigos_das_demandas', 'codigos_dos_contratos', 'estou_na_tarefa_ligada');

select * from finish();
rollback;
