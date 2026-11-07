-- Corrigir uma parcela já recebida (#267): sem pagamento, refaz; com pagamento, só o registro de correção. Roda num
-- banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Dado um escritório com o financeiro, o master, um cliente, uma participante e um contrato de pró-labore com 30% na
-- conta e a participante com 10%, sem a data do primeiro pagamento, com duas parcelas, e uma conta sem DAS.
insert into public.escritorios (id, nome, slug, modulos) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-correcao', '{"contratos": true, "financeiro": true}');
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

-- Dado a parcela 1 recebida (R$ 1.000,00, 30% na conta, participante com 10%).
create temp table recebido as select public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000001', date '2026-03-12', 100000,
  'c1000000-0000-0000-0000-000000000001', 0, null, 'pix', null, null, null, null) as id;
select is(public.financeiro_recebimento_tem_pagamento((select id from recebido)), false, 'Recém-recebido, nada foi pago');

-- Quando corrige o valor para R$ 900,00, sem nada pago, então o original fica estornado e há um novo com o valor certo.
create temp table corrigido as select public.financeiro_corrigir_recebimento((select id from recebido), date '2026-03-12', 90000,
  'c1000000-0000-0000-0000-000000000001', 0, null, 'pix', null, null, null, null, 'O cliente pagou R$ 900,00') as id;
reset role;
select isnt((select estornado_em from public.financeiro_recebimentos where id = (select id from recebido)), null, 'O recebimento de antes fica no histórico, estornado');
select is((select valor from public.financeiro_recebimentos where id = (select id from corrigido)), 90000::bigint, 'O novo recebimento tem o valor corrigido');
select is((select recebido from public.contrato_parcelas where id = 'd0000000-0000-0000-0000-000000000001'), 90000::bigint, 'A parcela mostra o valor corrigido');
select is((select resumo ->> 'motivo' from public.auditoria where registro_id = (select id from corrigido)::text and acao = 'alteracao'), 'O cliente pagou R$ 900,00', 'O motivo fica no registro de ações');

-- Quando a participante já foi marcada como paga, então corrigir é recusado e a correção vira um registro no caixa.
insert into public.financeiro_terceiros_pagos (escritorio_id, recebimento_id, pessoa_id, pago_em)
  values ('e0000000-0000-0000-0000-000000000001', (select id from corrigido), '10000000-0000-0000-0000-000000000002', date '2026-03-15');
set local role authenticated;
select is(public.financeiro_recebimento_tem_pagamento((select id from corrigido)), true, 'Com a participante paga, há pagamento');
select throws_ok($$ select public.financeiro_corrigir_recebimento((select id from corrigido), date '2026-03-12', 80000,
  'c1000000-0000-0000-0000-000000000001', 0, null, null, null, null, null, null, 'outro') $$, null, 'Já há pagamento feito deste recebimento: ele fica como está. Lance um registro de correção.', 'Com pagamento feito, o recebimento não se refaz');
select lives_ok($$ select public.financeiro_lancar_correcao((select id from corrigido), date '2026-03-20', 10000, 'c1000000-0000-0000-0000-000000000001', 'Devolvido ao cliente') $$,
  'O administrador lança o registro de correção');
reset role;
select is((select categoria || ' ' || tipo || ' ' || valor from public.financeiro_lancamentos where corrige_recebimento = (select id from corrigido)), 'correcao_recebimento saida 10000',
  'A correção é uma saída do caixa ligada ao recebimento');

select * from finish();
rollback;
