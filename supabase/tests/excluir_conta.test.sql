-- Excluir uma conta do caixa (#347): só a arquivada que nunca teve lançamento, só pelo administrador do escritório, e o
-- banco explica por que não. Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Dado um escritório com o financeiro, a administradora, uma colega que não é administradora e um cliente; e um outro
-- escritório, com uma conta arquivada.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-excluir-conta', '{"contratos": true, "financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-excluir-conta-2', '{"financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'admin@exemplo.test', 'Admin', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'colega@exemplo.test', 'Colega', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'colega@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());
insert into public.pessoas (id, escritorio_id, tipo, nome, documento) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Cliente', '11144477735'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Admin', '52998224725');
update public.perfis set pessoa_id = 'b0000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000001';

-- As contas: ativa; arquivada sem nada; arquivada com um lançamento já excluído; arquivada destino de um contrato; e a do
-- outro escritório, com uma conta arquivada e outra ativa, com lançamento.
insert into public.financeiro_contas (id, escritorio_id, nome, saldo_inicial_em, arquivada_em) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Ativa', date '2026-01-01', null),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Vazia', date '2026-01-01', null),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Com lançamento', date '2026-01-01', null),
  ('c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'Destino', date '2026-01-01', null),
  ('c0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'De fora', date '2026-01-01', now()),
  ('c0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', 'De fora ativa', date '2026-01-01', null);
insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, excluido_em) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', date '2026-03-01', 'saida', 'despesa', 100, 'Lançado e excluído', now()),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', date '2026-03-01', 'entrada', 'outra_entrada', 100, 'De fora', null);
insert into public.contratos (escritorio_id, cliente_id, responsavel_id, servico, categoria, criado_por, conta_destino_id)
  values ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Consultoria',
          'pro_labore', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004');
update public.financeiro_contas set arquivada_em = now()
  where id in ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004');

create function pg_temp.entrar(n integer) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || n, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || n)::text, true);
$$;

-- Quando a colega, que não é administradora, tenta excluir a arquivada vazia, então nada sai.
select pg_temp.entrar(2);
set local role authenticated;
delete from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000002';
reset role;
select ok(exists (select 1 from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000002'), 'Quem não é administrador não exclui conta');

-- Quando a administradora pergunta quais arquivadas têm lançamentos, então vem só a que teve um, mesmo excluído (a do outro
-- escritório não aparece).
select pg_temp.entrar(1);
set local role authenticated;
select results_eq($$ select * from public.financeiro_arquivadas_com_lancamentos() $$,
  $$ values ('c0000000-0000-0000-0000-000000000003'::uuid) $$, 'A tela sabe quais arquivadas têm lançamentos, mesmo excluídos');

-- Quando ela tenta excluir a conta ativa, então o banco pede para arquivar antes.
select throws_ok($$ delete from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive a conta antes de excluí-la.', 'A conta ativa não é excluída');

-- Quando tenta excluir a arquivada com um lançamento já excluído, então o banco explica que não pode.
select throws_ok($$ delete from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000003' $$,
  'P0001', 'A conta não pode ser excluída enquanto tiver lançamentos, mesmo os já excluídos, que ficam guardados para a auditoria.',
  'A conta com lançamentos, mesmo excluídos, não é excluída');

-- Quando tenta excluir a do outro escritório, então nada sai.
delete from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000005';

-- Quando exclui a arquivada vazia e a que era destino de um contrato, então saem, e o contrato fica sem conta de destino.
select lives_ok($$ delete from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000002' $$, 'A arquivada sem lançamentos é excluída');
select lives_ok($$ delete from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000004' $$, 'A arquivada que era destino de um contrato é excluída');
reset role;
select ok(not exists (select 1 from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000002'), 'A arquivada vazia saiu');
select ok(not exists (select 1 from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000004'), 'A arquivada destino saiu');
select is((select conta_destino_id from public.contratos where servico = 'Consultoria'), null, 'O contrato fica sem conta de destino');
select ok(exists (select 1 from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000005'), 'A conta de outro escritório não é excluída');
select ok(exists (select 1 from public.financeiro_contas where id = 'c0000000-0000-0000-0000-000000000003'), 'A conta com lançamentos continua');


select * from finish();
rollback;
