-- A parcela paga antes do início do caixa aparece como recebida e não mexe em nada (#214). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Dado um escritório com o financeiro ligado, um contrato, uma conta e uma parcela antiga importada.
insert into public.escritorios (id, nome, slug, modulos) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-parcela-antiga', '{"contratos": true, "financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'advogada@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'advogada@exemplo.test', '{"convite":"c1"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', now(), now());
insert into public.pessoas (id, escritorio_id, tipo, nome, documento) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Ana', '52998224725'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Cliente', '11144477735');
update public.perfis set pessoa_id = 'b0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000001';
insert into public.contratos (id, escritorio_id, cliente_id, responsavel_id, servico, categoria, percentual_escritorio) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Serviço', 'pro_labore', 30);
insert into public.financeiro_contas (id, escritorio_id, nome, tem_das, saldo_inicial, saldo_inicial_em) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PJ', false, 100000, date '2025-12-31');
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor, recebida_em, recebido) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, date '2025-03-10', 60000, date '2025-03-12', 55000);

select is((select numero from public.contrato_parcelas where id = 'f0000000-0000-0000-0000-000000000001'), 1, 'A importação grava a parcela antiga');

select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000a')::text, true);
set local role authenticated;

-- Quando o responsável abre o contrato, então vê a data e o valor recebidos.
select is((select recebida_em from public.contrato_parcelas where id = 'f0000000-0000-0000-0000-000000000001'), date '2025-03-12', 'A parcela aparece com a data recebida');
select is((select recebido from public.contrato_parcelas where id = 'f0000000-0000-0000-0000-000000000001'), 55000::bigint, 'A parcela aparece com o valor recebido');

-- Então o caixa, os repasses e os recebimentos continuam vazios.
select is((select count(*)::int from public.financeiro_lancamentos), 0, 'O caixa não muda');
select is((select count(*)::int from public.financeiro_recebimentos) + (select count(*)::int from public.financeiro_repasses), 0, 'Não há recebimento nem repasse');

-- Quando tentam mexer nela, então o banco recusa.
select throws_ok($$ update public.contrato_parcelas set valor = 1 where id = 'f0000000-0000-0000-0000-000000000001' $$, null, 'Esta parcela foi paga antes do início do caixa e não muda.', 'Não muda o valor');
select throws_ok($$ update public.contrato_parcelas set excluido_em = now() where id = 'f0000000-0000-0000-0000-000000000001' $$, null, 'Esta parcela foi paga antes do início do caixa e não muda.', 'Não é excluída');
select throws_ok($$ select public.financeiro_receber('f0000000-0000-0000-0000-000000000001', date '2026-11-01', 55000, 'd0000000-0000-0000-0000-000000000001', 0) $$, null, 'Esta parcela já foi recebida.', 'Não é recebida de novo');

-- Pela tela, ninguém grava uma parcela já recebida.
select throws_ok($$ insert into public.contrato_parcelas (contrato_id, vencimento, valor, recebida_em, recebido, criado_por)
  values ('c0000000-0000-0000-0000-000000000001', date '2026-01-01', 100, date '2026-01-01', 100, 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'Só a importação grava o recebimento antigo');

select * from finish();
rollback;
