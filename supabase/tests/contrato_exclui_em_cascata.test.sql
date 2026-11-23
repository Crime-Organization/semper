-- Excluir o contrato exclui junto o que está ligado a ele (#284, parte 2). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A demanda contínua (#313) pode ainda não existir: o teste cria a coluna só dentro desta transação, se faltar.
alter table public.demandas add column if not exists continua boolean not null default false;

-- Dado um escritório com o Financeiro, a Ana (administradora) e a Bia (da equipe, que cadastrou e cuida dos contratos), e o Davi,
-- de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-exclui', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true, "financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-exclui-2', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "financeiro": true}');
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
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'contato', 'INDICADOR', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000003');
-- Os contratos, todos arquivados e cadastrados pela Bia (responsável por eles), menos o K9, do Davi:
--   K1 terá recebimentos; K2 nenhum dinheiro; K3 só uma parcela importada como paga; K4 um recebimento (para o delete direto);
--   K5 ativo, ligado a uma tarefa do K1.
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria,
                              percentual_escritorio, participantes, arquivado_em, criado_por)
select ('c0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', n, 'AA11', 2030, 'AA11-000' || n || '-2030',
       '10000000-0000-0000-0000-000000000001', 'CLIENTE', 'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore',
       100, '[]', case when n < 5 then timestamptz '2030-01-01' end, 'a0000000-0000-0000-0000-000000000002'
  from generate_series(1, 5) as n;
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria,
                              percentual_escritorio, participantes, arquivado_em, criado_por) values
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000009',
   'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000003', 'Registro de marca', '{Registro de marca}', 'pro_labore', 30, '[]', '2030-01-01',
   'a0000000-0000-0000-0000-000000000003');
-- As parcelas: duas no K1, uma no K2, uma importada como paga no K3, uma no K4 e uma no K9.
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor, recebida_em, recebido) values
  ('d0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, '2030-03-10', 100000, null, null),
  ('d0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 2, '2030-04-10', 100000, null, null),
  ('d0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 1, '2030-03-10', 50000, null, null),
  ('d0000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 1, '2020-03-10', 70000, '2020-03-10', 70000),
  ('d0000000-0000-0000-0000-000000000041', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 1, '2030-03-10', 40000, null, null),
  ('d0000000-0000-0000-0000-000000000091', 'e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000009', 1, '2030-03-10', 90000, null, null);
insert into public.financeiro_contas (id, escritorio_id, nome, tem_das, saldo_inicial, saldo_inicial_em, criado_por) values
  ('c1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PJ', true, 0, date '2030-01-01', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'PF', false, 0, date '2030-01-01', 'a0000000-0000-0000-0000-000000000003');
insert into public.financeiro_das (escritorio_id, mes, aliquota) values ('e0000000-0000-0000-0000-000000000001', '2030-01', 0);
-- D1 do K1; DC, a contínua, com o K1 (nunca sai); D9 do K9.
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, contrato_id, continua, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Do K1', 'a0000000-0000-0000-0000-000000000001', '{}',
   'c0000000-0000-0000-0000-000000000001', false, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'DC', 'Contínua', 'a0000000-0000-0000-0000-000000000001', '{}',
   'c0000000-0000-0000-0000-000000000001', true, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'De fora', 'a0000000-0000-0000-0000-000000000003', '{}',
   'c0000000-0000-0000-0000-000000000009', false, 'a0000000-0000-0000-0000-000000000003');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PR1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000001}', 'a0000000-0000-0000-0000-000000000001');
insert into public.contrato_processos (escritorio_id, contrato_id, processo_id) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, criado_por) values
  ('74000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'CP1', 'reuniao', 'Reunião', '2030-05-01', '10:00', 'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001');
insert into public.compromisso_ligacoes (escritorio_id, compromisso_id, demanda_id) values
  ('e0000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');
-- As tarefas: T1 só do K1 (com 2 horas registradas); T2 só da D1; T3 da D1 e do K5 (outro contrato); T6 do K1 e do processo;
-- T7 do K1 e da contínua; T8 do K1 e do K3 (com 30 minutos registrados); T9 do K9.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, demanda_ids, contrato_id, contrato_ids,
                            processo_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Do K1', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, '{}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}', null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Da D1', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000001', '{71000000-0000-0000-0000-000000000001}', null, '{}', null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'T3', 'Da D1 e do K5', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000001', '{71000000-0000-0000-0000-000000000001}', 'c0000000-0000-0000-0000-000000000005', '{c0000000-0000-0000-0000-000000000005}',
   null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'T6', 'Do K1 e do processo', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, '{}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}', '73000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'T7', 'Do K1 e da contínua', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000004', '{71000000-0000-0000-0000-000000000004}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001}',
   null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'T8', 'Do K1 e do K3', 'a0000000-0000-0000-0000-000000000001', '{}',
   null, '{}', 'c0000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001,c0000000-0000-0000-0000-000000000003}', null,
   'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'T9', 'De fora', 'a0000000-0000-0000-0000-000000000003', '{}',
   '71000000-0000-0000-0000-000000000009', '{71000000-0000-0000-0000-000000000009}', 'c0000000-0000-0000-0000-000000000009', '{c0000000-0000-0000-0000-000000000009}',
   null, 'a0000000-0000-0000-0000-000000000003');
insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, segundos) values
  ('e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 7200),
  ('e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 1800);
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- Dado o dinheiro do K1, recebido pela Bia (responsável): a parcela 1 (R$ 1.000,00, taxa R$ 30,00) e a 2 (R$ 1.000,00), esta
-- estornada; e a parcela do K4 (R$ 400,00). E o mesmo no K9, pelo Davi.
select pg_temp.entrar(2); set local role authenticated;
create temp table rec as select
  public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000011', date '2030-03-12', 100000, 'c1000000-0000-0000-0000-000000000001', 3000,
    null, 'pix', null, null, null, null) as r1,
  public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000012', date '2030-04-12', 100000, 'c1000000-0000-0000-0000-000000000001', 0,
    null, 'pix', null, null, null, null) as r2,
  public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000041', date '2030-03-12', 40000, 'c1000000-0000-0000-0000-000000000001', 0,
    null, 'pix', null, null, null, null) as r4;
select public.financeiro_estornar((select r2 from rec));
reset role;
select pg_temp.entrar(3); set local role authenticated;
select public.financeiro_receber_completo('d0000000-0000-0000-0000-000000000091', date '2030-03-12', 90000, 'c1000000-0000-0000-0000-000000000009', 0,
  null, 'pix', null, null, null, null);
reset role;
-- E a Ana já pagou o repasse da Bia do recebimento da parcela 1.
select pg_temp.entrar(1); set local role authenticated;
select public.financeiro_pagar_repasse((select id from public.financeiro_repasses where recebimento_id = (select r1 from rec)),
  'c1000000-0000-0000-0000-000000000001', date '2030-03-15');
reset role;

-- ===== A prévia =====
-- Quando a Ana pede a prévia do K1
select pg_temp.entrar(1); set local role authenticated;
create temp table previa as select public.contrato_exclusao_previa('{c0000000-0000-0000-0000-000000000001}') as p;
reset role;
-- Então ela diz o que sai junto: a D1 (a contínua fica), T1, T2 e T7 (T3 tem outro contrato; T6, um processo), as 2 horas da T1,
-- as duas parcelas, o recebimento e o estornado, os valores e o repasse já pago.
select is((select p - 'valores' - 'pagos' from previa), jsonb_build_object('contratos', 1, 'nao_excluiveis', 0, 'demandas', 1, 'tarefas', 3, 'segundos', 7200,
  'parcelas', 2, 'recebimentos', 1, 'estornados', 1, 'importadas', 0, 'com_dinheiro', true, 'sou_admin', true, 'tem_pagamento', true), 'A prévia conta o que sai junto');
select is((select p -> 'valores' from previa), '{"recebido": 100000, "taxas": 3000, "repasses": 67900, "correcoes": 0, "importado": 0}'::jsonb,
  'A prévia traz os valores ao administrador');
select is((select p -> 'pagos' from previa), '[{"codigo": "AA11-0001-2030", "parcela": 1, "nome": "Bia", "valor": 67900}]'::jsonb,
  'A prévia diz qual pagamento já foi feito');

-- Quando a Bia (que cadastrou o K1 e cuida dele) e o Davi (de outro escritório) pedem a mesma prévia
select pg_temp.entrar(2); set local role authenticated;
select is((public.contrato_exclusao_previa('{c0000000-0000-0000-0000-000000000001}') ->> 'sou_admin')::boolean, false, 'A Bia não é administradora');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is(public.contrato_exclusao_previa('{c0000000-0000-0000-0000-000000000001}') - 'valores' - 'pagos',
  jsonb_build_object('contratos', 0, 'nao_excluiveis', 1, 'demandas', 0, 'tarefas', 0, 'segundos', 0, 'parcelas', 0, 'recebimentos', 0, 'estornados', 0,
                     'importadas', 0, 'com_dinheiro', false, 'sou_admin', true, 'tem_pagamento', false),
  'O Davi não vê nada do contrato do outro escritório');
reset role;

-- ===== Com pagamento feito, ninguém exclui; com dinheiro, só o administrador =====
-- Quando a Ana tenta excluir o K1 com o repasse pago
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select public.contratos_excluir('{c0000000-0000-0000-0000-000000000001}') $$, null,
  'Já há pagamento feito do dinheiro deste contrato. Um administrador desfaz o pagamento no Financeiro antes de excluir.', 'Com pagamento feito, nem o administrador exclui');
-- E ela desfaz o pagamento
select public.financeiro_desfazer_pagamento((select id from public.financeiro_repasses where recebimento_id = (select r1 from rec)));
reset role;
-- Quando a Bia, que não é administradora, tenta excluir o K1 (com dinheiro) e o K3 (com parcela importada como paga)
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.contratos_excluir('{c0000000-0000-0000-0000-000000000001}') $$, '42501',
  'Este contrato tem dinheiro recebido: só um administrador o exclui.', 'Com dinheiro recebido, quem não é administrador não exclui');
select throws_ok($$ select public.contratos_excluir('{c0000000-0000-0000-0000-000000000002,c0000000-0000-0000-0000-000000000003}') $$, '42501',
  'Este contrato tem dinheiro recebido: só um administrador o exclui.', 'A parcela importada como paga conta como dinheiro recebido, e nada da lista sai');
select is((select count(*) from public.contratos where id = 'c0000000-0000-0000-0000-000000000002'), 1::bigint, 'Nada é excluído pela metade');
-- E pelo delete direto (a versão anterior do site), o K3 também não sai
select throws_ok($$ delete from public.contratos where id = 'c0000000-0000-0000-0000-000000000003' $$, '42501',
  'Este contrato tem dinheiro recebido. Atualize a página e exclua de novo: o SEMPER mostra antes os valores que saem junto.',
  'O delete direto também recusa a parcela importada como paga');
reset role;
-- Nem para a Ana, administradora: por esse caminho a parcela sairia sem a cópia escondida e sem a janela com o valor
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ delete from public.contratos where id = 'c0000000-0000-0000-0000-000000000003' $$, '42501',
  'Este contrato tem dinheiro recebido. Atualize a página e exclua de novo: o SEMPER mostra antes os valores que saem junto.',
  'O delete direto recusa a parcela importada como paga também para o administrador');
reset role;
select is((select count(*) from public.contrato_parcelas where id = 'd0000000-0000-0000-0000-000000000031'), 1::bigint,
  'A parcela importada como paga continua lá');
select pg_temp.entrar(2); set local role authenticated;

-- ===== Sem dinheiro, quem cadastrou exclui, como hoje =====
-- Quando a Bia exclui o K2 (sem dinheiro)
select is(public.contratos_excluir('{c0000000-0000-0000-0000-000000000002}'), 1, 'A Bia exclui o contrato sem dinheiro');
reset role;
select is((select count(*) from public.contratos where id = 'c0000000-0000-0000-0000-000000000002'), 0::bigint, 'O contrato sem dinheiro sai');

-- ===== O administrador exclui com o dinheiro =====
-- Quando a Ana exclui o K1 e o K3
select pg_temp.entrar(1); set local role authenticated;
select is(public.contratos_excluir('{c0000000-0000-0000-0000-000000000001,c0000000-0000-0000-0000-000000000003,c0000000-0000-0000-0000-000000000009}'), 2,
  'A Ana exclui os dois contratos do escritório dela; o do outro escritório não conta');
reset role;
-- Então somem os contratos, as parcelas, a D1, as tarefas só dela e do contrato, os recebimentos e os lançamentos deles no Caixa
select is((select count(*) from public.contratos where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')), 0::bigint, 'Os contratos saem');
select is((select count(*) from public.contrato_parcelas where contrato_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')), 0::bigint,
  'As parcelas saem');
select is((select string_agg(codigo, ',' order by codigo) from public.demandas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 'DC',
  'A demanda do contrato sai; a contínua fica');
select is((select string_agg(codigo, ',' order by codigo) from public.tarefas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 'T3,T6',
  'As tarefas só do contrato e das demandas dele saem; ficam a de outro contrato e a do processo');
select is((select contrato_ids from public.tarefas where id = '70000000-0000-0000-0000-000000000006'), '{}'::uuid[], 'A tarefa que fica perde a ligação com o contrato');
select is((select demanda_ids from public.tarefas where id = '70000000-0000-0000-0000-000000000003'), '{}'::uuid[], 'E com a demanda excluída');
select is((select count(*) from public.tarefa_tempos where tarefa_id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'O tempo da tarefa excluída sai junto');
select is((select count(*) from public.financeiro_recebimentos where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint,
  'Os recebimentos saem, também o estornado');
select is((select count(*) from public.financeiro_repasses where escritorio_id = 'e0000000-0000-0000-0000-000000000001'
           and recebimento_id <> (select r4 from rec)), 0::bigint, 'Os repasses saem');
select is((select string_agg(descricao, ',') from public.financeiro_lancamentos where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and excluido_em is null),
  'Recebimento: CLIENTE (AA11-0004-2030, parcela 1)', 'Do Caixa, saem os lançamentos do contrato; o do K4 fica');
-- E os processos e os compromissos ligados continuam existindo
select is((select count(*) from public.processos where id = '73000000-0000-0000-0000-000000000001'), 1::bigint, 'O processo ligado continua');
select is((select count(*) from public.compromissos where id = '74000000-0000-0000-0000-000000000001'), 1::bigint, 'O compromisso ligado à demanda continua');
-- E a cópia escondida guarda cada recebimento e a parcela importada
select is((select string_agg(contrato_codigo || ' ' || tipo || ' ' || parcela_numero || ' ' || valor || ' ' || coalesce(conta_nome, '-') || ' ' || estornado, ',' order by contrato_codigo, parcela_numero)
           from public.financeiro_excluidos),
  'AA11-0001-2030 recebimento 1 100000 PJ false,AA11-0001-2030 recebimento 2 100000 PJ true,AA11-0003-2030 parcela_importada 1 70000 - false',
  'A cópia escondida guarda os recebimentos e a parcela importada');
select is((select jsonb_array_length(copia -> 'lancamentos') from public.financeiro_excluidos where parcela_numero = 1 and tipo = 'recebimento'), 2,
  'A cópia guarda os lançamentos do recebimento (a entrada e a taxa)');
-- E a auditoria tem o resumo com os valores
select is((select resumo -> 'cascata' ->> 'recebido' from public.auditoria where registro_id = 'c0000000-0000-0000-0000-000000000001' and resumo ? 'cascata'), '100000',
  'A auditoria guarda o resumo com os valores');
select is((select count(*) from public.auditoria where tabela = 'contratos' and acao = 'exclusao' and registro_id = 'c0000000-0000-0000-0000-000000000001'),
  1::bigint, 'A exclusão do contrato fica numa linha só do registro de ações, com o resumo');
-- E a T8 (do K1 e do K3, que saíram juntos) conta uma vez, no K1, com o tempo dela: T1, T2, T7 e T8, 2 h 30 min
select is((select (resumo -> 'cascata' ->> 'tarefas') || ' ' || (resumo -> 'cascata' ->> 'segundos') from public.auditoria
            where tabela = 'contratos' and acao = 'exclusao' and registro_id = 'c0000000-0000-0000-0000-000000000001'), '4 9000',
  'O resumo do K1 conta a tarefa que ele tinha em comum com o K3, com o tempo dela');
select is((select (resumo -> 'cascata' ->> 'tarefas') || ' ' || (resumo -> 'cascata' ->> 'segundos') from public.auditoria
            where tabela = 'contratos' and acao = 'exclusao' and registro_id = 'c0000000-0000-0000-0000-000000000003'), '0 0',
  'E o do K3 não a conta de novo');

-- ===== Quem lê a cópia escondida =====
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*) from public.financeiro_excluidos), 3::bigint, 'A administradora lê a cópia');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.financeiro_excluidos), 0::bigint, 'Quem não é administrador não lê');
select throws_ok($$ insert into public.financeiro_excluidos (escritorio_id, contrato_id, contrato_codigo, cliente_nome, tipo, valor, copia)
  values ('e0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'X', 'X', 'recebimento', 1, '{}') $$, '42501', null, 'Ninguém grava na cópia pela tela');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*) from public.financeiro_excluidos), 0::bigint, 'O administrador do outro escritório não lê a cópia');
reset role;

-- ===== O delete direto continua recusando o contrato com recebimento =====
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ delete from public.contratos where id = 'c0000000-0000-0000-0000-000000000004' $$, '23503', null,
  'O delete direto (site antigo) recusa o contrato com recebimento, mesmo do administrador');
reset role;

-- ===== Participante ou indicador já marcado como pago: ninguém exclui até desfazer a marcação =====
-- Dado o recebimento do K4 com um indicador (R$ 40,00), que a Ana marca como pago
set local session_replication_role = replica;
update public.financeiro_recebimentos
   set terceiros = '[{"id": "10000000-0000-0000-0000-000000000002", "nome": "INDICADOR", "tipo": "indicador", "percentual": 10, "valor": 4000}]'
 where id = (select r4 from rec);
set local session_replication_role = origin;
select pg_temp.entrar(1); set local role authenticated;
select public.financeiro_terceiro_marcar_pago((select r4 from rec), '10000000-0000-0000-0000-000000000002', date '2030-03-20');
-- Quando a Ana pede a prévia do K4
create temp table previa_k4 as select public.contrato_exclusao_previa('{c0000000-0000-0000-0000-000000000004}') as p;
-- Então ela diz que há pagamento feito, com o nome e o valor de quem foi marcado como pago
select is((select (p ->> 'tem_pagamento')::boolean from previa_k4), true, 'A prévia vê o indicador marcado como pago');
select is((select p -> 'pagos' from previa_k4), '[{"codigo": "AA11-0004-2030", "parcela": 1, "nome": "INDICADOR", "valor": 4000}]'::jsonb,
  'A prévia diz quem foi marcado como pago e quanto');
-- Quando ela tenta excluir o K4
select throws_ok($$ select public.contratos_excluir('{c0000000-0000-0000-0000-000000000004}') $$, null,
  'Já há pagamento feito do dinheiro deste contrato. Um administrador desfaz o pagamento no Financeiro antes de excluir.',
  'Com participante ou indicador marcado como pago, nem o administrador exclui');
-- Então a marcação e o recebimento continuam
select is((select count(*) from public.financeiro_terceiros_pagos where recebimento_id = (select r4 from rec)), 1::bigint, 'A marcação de pago continua');
-- Quando ela desfaz a marcação e exclui de novo
select public.financeiro_terceiro_desfazer_pago((select r4 from rec), '10000000-0000-0000-0000-000000000002');
select is(public.contratos_excluir('{c0000000-0000-0000-0000-000000000004}'), 1, 'Desfeita a marcação, a Ana exclui o K4');
reset role;
-- Então o recebimento sai, com a cópia escondida
select is((select count(*) from public.financeiro_recebimentos where id = (select r4 from rec)), 0::bigint, 'O recebimento do K4 sai');
select is((select count(*) from public.financeiro_excluidos where contrato_codigo = 'AA11-0004-2030'), 1::bigint, 'E fica na cópia escondida');

-- ===== Outro escritório =====
select is((select count(*) from public.contratos where id = 'c0000000-0000-0000-0000-000000000009'), 1::bigint, 'O contrato do outro escritório continua');
select is((select count(*) from public.financeiro_recebimentos where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 1::bigint,
  'O recebimento do outro escritório continua');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000009'), 1::bigint, 'A tarefa do outro escritório continua');

select * from finish();
rollback;
