-- As colunas da planilha de origem de um lançamento: só a importação grava. Roda num banco local:
-- supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Dado um escritório com o financeiro, a administradora e uma conta.
insert into public.escritorios (id, nome, slug, modulos) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-planilha', '{"financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'admin@exemplo.test', 'Admin', 'master', privado.resumo_codigo('c0'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@exemplo.test', '{"convite":"c0"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values ('50000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', now(), now());
insert into public.financeiro_contas (id, escritorio_id, nome, tem_das, saldo_inicial, saldo_inicial_em, criado_por) values
  ('c1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PJ', false, 0, date '2026-01-01', 'a0000000-0000-0000-0000-000000000000');
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000000', 'role', 'authenticated', 'aal', 'aal1',
  'session_id', '50000000-0000-0000-0000-000000000000')::text, true);
set local role authenticated;

-- Quando a administradora lança pelo site, sem a coluna, então entra.
select lives_ok($$ insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, criado_por)
  values ('e0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', date '2026-03-01', 'saida', 'despesa', 4800, 'Conta de água', 'a0000000-0000-0000-0000-000000000000') $$,
  'Lançar pelo site, sem as colunas da planilha, continua valendo');

-- Quando tenta gravar as colunas da planilha pelo site, então é recusado.
select throws_ok($$ insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, criado_por, planilha)
  values ('e0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', date '2026-03-02', 'saida', 'despesa', 100, 'Inventado', 'a0000000-0000-0000-0000-000000000000', '[["CLIENTE","X"]]') $$,
  '42501', null, 'Pelo site, ninguém grava as colunas da planilha ao lançar');
select throws_ok($$ update public.financeiro_lancamentos set planilha = '[["CLIENTE","X"]]' where descricao = 'Conta de água' $$,
  '42501', null, 'Pelo site, ninguém muda as colunas da planilha depois');
reset role;

-- Então a importação (que roda como o sistema) grava, e só aceita uma lista.
select throws_ok($$ update public.financeiro_lancamentos set planilha = '{"CLIENTE":"X"}' where descricao = 'Conta de água' $$,
  '23514', null, 'A coluna só aceita a lista de pares [coluna, valor]');

select * from finish();
rollback;
