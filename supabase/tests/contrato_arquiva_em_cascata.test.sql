-- Arquivar o contrato arquiva junto as demandas e as tarefas dele (#284, parte 1). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A demanda contínua (#313) pode ainda não existir: o teste cria a coluna só dentro desta transação, se faltar.
alter table public.demandas add column if not exists continua boolean not null default false;

-- Dado um escritório com Ana (administradora) e Bia (da equipe, que cadastrou o contrato K1), e o Davi, de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-cascata', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-cascata-2', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c3"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 3) as n;

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000003');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000001', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AA11', 2030, 'AA11-0002-2030', '10000000-0000-0000-0000-000000000001', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000009', 'OUTRO CLIENTE',
   'a0000000-0000-0000-0000-000000000003', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000003');
-- D1 ativa e D2 já arquivada antes, ambas do K1; D3 sem contrato; DC, a contínua (com o K1, para provar que nunca é arquivada);
-- D9 do outro escritório, com o K9.
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, contrato_id, arquivado_em, continua, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Ativa do K1', 'a0000000-0000-0000-0000-000000000001', '{}',
   'c0000000-0000-0000-0000-000000000001', null, false, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Já arquivada do K1', 'a0000000-0000-0000-0000-000000000001', '{}',
   'c0000000-0000-0000-0000-000000000001', '2030-01-01', false, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Sem contrato', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, null, false, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'DC', 'Contínua', 'a0000000-0000-0000-0000-000000000001', '{}',
   'c0000000-0000-0000-0000-000000000001', null, true, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'De fora', 'a0000000-0000-0000-0000-000000000003', '{}',
   'c0000000-0000-0000-0000-000000000009', null, false, 'a0000000-0000-0000-0000-000000000003');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PR1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000001}', 'a0000000-0000-0000-0000-000000000001');
-- As tarefas, gravadas com as listas da #283:
--   T1 só do K1; T2 só da D1; T3 da D1 e do K2 (outro contrato ativo); T4 do K1, já arquivada antes; T5 da D2 (a demanda já
--   arquivada); T6 do K1 e do processo PR1 (ativo); T7 do K1 e da contínua; T8 da D1 e da D3 (outra demanda ativa); T9 do K9.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, demanda_ids, contrato_id, contrato_ids,
                            processo_id, arquivado_em, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Do K1', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, '{}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}', null, null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Da D1', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000001', '{71000000-0000-0000-0000-000000000001}', null, '{}', null, null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'T3', 'Da D1 e do K2', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000001', '{71000000-0000-0000-0000-000000000001}', 'c0000000-0000-0000-0000-000000000002', '{c0000000-0000-0000-0000-000000000002}',
   null, null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'T4', 'Já arquivada', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, '{}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}', null, '2030-01-01', 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'T5', 'Da D2', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000002', '{71000000-0000-0000-0000-000000000002}', null, '{}', null, null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'T6', 'Do K1 e do processo', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, '{}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}', '73000000-0000-0000-0000-000000000001', null,
   'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'T7', 'Do K1 e da contínua', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000004', '{71000000-0000-0000-0000-000000000004}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}',
   null, null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'T8', 'Da D1 e da D3', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000001', '{71000000-0000-0000-0000-000000000001,71000000-0000-0000-0000-000000000003}', null, '{}', null, null,
   'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'T9', 'De fora', 'a0000000-0000-0000-0000-000000000003', '{}',
   '71000000-0000-0000-0000-000000000009', '{71000000-0000-0000-0000-000000000009}', 'c0000000-0000-0000-0000-000000000009', '{c0000000-0000-0000-0000-000000000009}',
   null, null, 'a0000000-0000-0000-0000-000000000003');
insert into public.quadro_colunas (id, escritorio_id, modulo, nome, ordem, criado_por) values
  ('90000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'contratos', 'Encerrado (teste da cascata)', 40, null);
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Os códigos arquivados, entre as demandas e as tarefas dos dois escritórios (lidos como sistema).
create function pg_temp.arquivadas() returns text language sql as $$
  select string_agg(codigo, ',' order by codigo) from (
    select codigo from public.demandas where arquivado_em is not null union all select codigo from public.tarefas where arquivado_em is not null) x
$$;

-- Antes de tudo: só a D2, a T4 (arquivadas antes) estão arquivadas.
select is(pg_temp.arquivadas(), 'D2,T4', 'No começo, só o que foi arquivado antes');

-- ===== Mover para Encerrado não arquiva nada =====
-- Quando a Bia move o K1 para a coluna Encerrado
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ update public.contratos set etapa_id = '90000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'A Bia move o contrato para Encerrado');
reset role;
-- Então nem ele nem o que está ligado a ele é arquivado
select is((select arquivado_em from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'), null, 'O contrato encerrado continua ativo');
select is(pg_temp.arquivadas(), 'D2,T4', 'Encerrar não arquiva demandas nem tarefas');

-- ===== Arquivar em cascata =====
-- Quando a Bia (que cadastrou o K1, sem ser administradora) o arquiva
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000002'
  where id = 'c0000000-0000-0000-0000-000000000001' $$, 'A Bia arquiva o contrato');
reset role;
-- Então saem junto a D1, as tarefas só do contrato ou das demandas dele (T1, T2, T5) e a do contrato com a contínua (T7).
-- Ficam ativas: a contínua, a tarefa com outro contrato ativo (T3), com o processo ativo (T6) e com outra demanda ativa (T8).
select is(pg_temp.arquivadas(), 'D1,D2,T1,T2,T4,T5,T7', 'Arquiva as demandas e as tarefas do contrato, menos as que têm outra ligação ativa');
select is((select arquivado_por from public.demandas where id = '71000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000002'::uuid,
  'Quem arquivou o contrato aparece como quem arquivou a demanda');
select is((select count(*) from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000001' and alteracoes ? 'arquivado_em'), 1::bigint,
  'O histórico da demanda registra o arquivamento');
select is((select count(*) from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000001' and alteracoes ? 'arquivado_com_contrato'), 0::bigint,
  'E não mostra nenhum código interno');
-- E o outro escritório não é tocado
select is((select count(*) from public.tarefas where escritorio_id = 'e0000000-0000-0000-0000-000000000002' and arquivado_em is not null), 0::bigint,
  'Nada do outro escritório é arquivado');

-- E ninguém lê nem grava a marca pela tela
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select * from privado.arquivados_com_contrato $$, '42501', null, 'A marca não aparece pela tela');
reset role;

-- ===== A pessoa mexe numa tarefa sozinha =====
-- Quando a Ana desarquiva a T2 e a arquiva de novo, de propósito
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ update public.tarefas set arquivado_em = null, arquivado_por = null where id = '70000000-0000-0000-0000-000000000002' $$, 'Desarquiva a T2 sozinha');
select lives_ok($$ update public.tarefas set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000001' where id = '70000000-0000-0000-0000-000000000002' $$,
  'E a arquiva de novo');
reset role;
-- Então ela perde a marca de arquivada junto com o contrato
select is((select count(*) from privado.arquivados_com_contrato where tarefa_id = '70000000-0000-0000-0000-000000000002'), 0::bigint,
  'A tarefa mexida sozinha perde a marca');

-- ===== Desarquivar volta só o que foi arquivado junto =====
-- Quando a Bia desarquiva o K1
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = null, arquivado_por = null where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'A Bia desarquiva o contrato');
reset role;
-- Então voltam a D1, a T1, a T5 e a T7; continuam arquivadas a D2 e a T4 (de antes) e a T2 (arquivada de novo de propósito)
select is(pg_temp.arquivadas(), 'D2,T2,T4', 'Volta só o que foi arquivado junto com o contrato');
select is((select arquivado_por from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), null, 'A tarefa que volta fica sem quem arquivou');
select is((select count(*) from privado.arquivados_com_contrato), 0::bigint, 'Nenhuma marca sobra depois de desarquivar');

-- ===== Dois contratos arquivados no mesmo comando =====
-- Quando a Ana arquiva o K1 e o K2 de uma vez (a T3 é da D1, do K1, e do K2)
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000001'
  where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002') $$, 'A Ana arquiva os dois contratos juntos');
reset role;
-- Então a T3 é arquivada (o gatilho de cada contrato roda com os dois já arquivados), com uma marca só, a do K1 (o da D1)
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000003' and arquivado_em is not null), 1::bigint,
  'A tarefa dos dois contratos é arquivada');
select is((select array_agg(contrato_id) from privado.arquivados_com_contrato where tarefa_id = '70000000-0000-0000-0000-000000000003'),
  '{c0000000-0000-0000-0000-000000000001}'::uuid[], 'Ela fica marcada com o K1');
-- Quando a Ana desarquiva só o K1
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = null, arquivado_por = null where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'A Ana desarquiva só o K1');
reset role;
-- Então a T3 volta com o K1
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000003' and arquivado_em is null), 1::bigint,
  'A tarefa volta com o contrato que a marcou');
-- E, desarquivado também o K2, tudo fica como antes
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = null, arquivado_por = null where id = 'c0000000-0000-0000-0000-000000000002' $$,
  'A Ana desarquiva o K2');
reset role;
select is(pg_temp.arquivadas(), 'D2,T2,T4', 'Depois dos dois, tudo como antes');

-- ===== Outro escritório =====
-- Quando o Davi arquiva o K9 do escritório dele
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000003'
  where id = 'c0000000-0000-0000-0000-000000000009' $$, 'O Davi arquiva o contrato dele');
reset role;
-- Então arquivam a D9 e a T9, e nada do primeiro escritório muda
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000009' and arquivado_em is not null), 1::bigint,
  'A tarefa do contrato dele é arquivada');
select is(pg_temp.arquivadas(), 'D2,D9,T2,T4,T9', 'O primeiro escritório fica como estava');

select * from finish();
rollback;
