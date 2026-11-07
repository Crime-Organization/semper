-- O recebimento completo (#266): tipo, forma de pagamento, bancos e percentuais ajustados só neste recebimento. Roda num
-- banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Dado um escritório com o financeiro, o master, um cliente, uma participante e um contrato de pró-labore com 30% na
-- conta e a participante com 10%, sem a data do primeiro pagamento, com duas parcelas, e uma conta sem DAS.
insert into public.escritorios (id, nome, slug, modulos) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-recebimento', '{"contratos": true, "financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now());
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE DE TESTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'contato', 'PARTICIPANTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria, percentual_escritorio, participantes) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'ME12', 2026, 'ME12-0001-2026', '10000000-0000-0000-0000-000000000001',
   'CLIENTE DE TESTE', 'a0000000-0000-0000-0000-000000000001', 'Serviço', 'pro_labore', 30,
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 10}]');
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor)
  select ('d0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', n, date '2026-03-10', 100000
  from generate_series(1, 2) as n;
insert into public.financeiro_contas (id, escritorio_id, nome, tem_das, saldo_inicial, saldo_inicial_em, criado_por) values
  ('c1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PF', false, 0, date '2026-01-01', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal1',
  'session_id', '50000000-0000-0000-0000-000000000001')::text, true);
set local role authenticated;

-- Quando recebe a parcela 1 como êxito, por Pix, com os bancos, 20% na conta e a participante com 5%.
create temp table recebido as select public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000001', date '2026-03-12', 100000,
  'c1000000-0000-0000-0000-000000000001', 0, 'quota_litis', 'pix', '077', '260', 20,
  '[{"id": "10000000-0000-0000-0000-000000000002", "percentual": 5}]') as id;
reset role;
-- Então grava o tipo, a forma e os bancos, e usa os percentuais deste recebimento, sem mudar o contrato.
select is((select categoria from public.financeiro_recebimentos where id = (select id from recebido)), 'quota_litis', 'O tipo deste recebimento fica gravado');
select is((select forma_pagamento || ' ' || banco_recebido || ' ' || banco_envio from public.financeiro_recebimentos where id = (select id from recebido)), 'pix 077 260', 'A forma de pagamento e os dois bancos ficam gravados');
select is((select parte_na_conta from public.financeiro_recebimentos where id = (select id from recebido)), 20, 'A parte na conta é a escolhida neste recebimento');
select is((select na_conta from public.financeiro_recebimentos where id = (select id from recebido)), 20000::bigint, 'Entra na conta 20% do que o cliente pagou');
select is((select (terceiros -> 0 ->> 'percentual')::numeric from public.financeiro_recebimentos where id = (select id from recebido)), 5::numeric, 'A participante entra com o percentual ajustado');
select is((select (participantes -> 0 ->> 'percentual')::numeric from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'), 10::numeric, 'O contrato continua com o percentual dele');
select is((select primeiro_pagamento from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'), date '2026-03-12', 'Sem a data do primeiro pagamento, o contrato passa a ter a deste recebimento');

-- Quando a participante fica com 0 na parcela 2, então ela sai da divisão; e banco ou percentual fora do aceito é recusado.
set local role authenticated;
select lives_ok($$ select public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000002', date '2026-04-12', 100000,
  'c1000000-0000-0000-0000-000000000001', 0, null, null, null, null, null, '[{"id": "10000000-0000-0000-0000-000000000002", "percentual": 0}]') $$, 'Receber com a participante em 0 funciona');
reset role;
select is((select jsonb_array_length(terceiros) from public.financeiro_recebimentos where parcela_id = 'd0000000-0000-0000-0000-000000000002'), 0, 'Com 0, a participante sai da divisão deste recebimento');
select throws_ok($$ update public.financeiro_recebimentos set banco_recebido = '77' where id = (select id from recebido) $$, '23514', null, 'O código do banco tem 3 dígitos');

select * from finish();
rollback;
