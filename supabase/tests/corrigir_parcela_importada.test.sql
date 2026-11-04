-- O responsável e os administradores corrigem a parcela importada como paga, e o caixa não muda. Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Dado um escritório com o financeiro ligado, uma advogada responsável, outro advogado, uma administradora, uma parcela importada e uma a receber.
insert into public.escritorios (id, nome, slug, modulos) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-corrigir-parcela', '{"contratos": true, "financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'admin@exemplo.test', 'Admin', 'master', privado.resumo_codigo('c0'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'usuario', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@exemplo.test', '{"convite":"c0"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', now(), now()),
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());
insert into public.pessoas (id, escritorio_id, tipo, nome, documento) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Ana', '52998224725'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Cliente', '11144477735');
update public.perfis set pessoa_id = 'b0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000001';
insert into public.contratos (id, escritorio_id, cliente_id, responsavel_id, servico, categoria, percentual_escritorio) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Serviço', 'pro_labore', 30);
insert into public.financeiro_contas (id, escritorio_id, nome, tem_das, saldo_inicial, saldo_inicial_em) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PJ', false, 100000, date '2025-12-31');
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor, recebida_em, recebido) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, date '2025-03-10', 60000, date '2025-03-12', 55000),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 2, date '2027-03-10', 60000, null, null);
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;

select pg_temp.entrar(1);
set local role authenticated;

-- Quando a responsável corrige, então a parcela muda e fica no histórico.
select lives_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000001', date '2025-03-15', 70000, date '2025-03-20', 65000) $$, 'A responsável corrige');
select is((select (vencimento, valor, recebida_em, recebido)::text from public.contrato_parcelas where id = 'f0000000-0000-0000-0000-000000000001'), '(2025-03-15,70000,2025-03-20,65000)', 'Os quatro campos mudaram');
select ok((select bool_or(alteracoes ? 'Parcela 1: valor recebido' and alteracoes ? 'Parcela 1: data recebida') from public.contrato_parcelas_historico), 'A correção fica no histórico');

-- Então o caixa, os repasses e os recebimentos continuam vazios, e ela segue sem recebimento.
select is((select count(*)::int from public.financeiro_lancamentos), 0, 'O caixa não muda');
select is((select count(*)::int from public.financeiro_recebimentos) + (select count(*)::int from public.financeiro_repasses), 0, 'Não há recebimento nem repasse');

-- Quando a data é futura, ou o valor é zero, então o banco recusa.
select throws_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000001', date '2025-03-15', 70000, date '2999-01-01', 65000) $$, null, 'A data do recebimento não pode estar no futuro.', 'Recusa a data futura');
select throws_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000001', date '2025-03-15', 70000, date '2025-03-20', 0) $$, null, 'Confira o valor recebido.', 'Recusa o valor zero');

-- Quando a parcela é a receber, então não vira paga por este caminho nem pela tabela.
select throws_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000002', date '2027-03-10', 60000, date '2025-03-20', 60000) $$, null, 'Só a parcela importada como paga é corrigida assim.', 'A parcela a receber não vira paga');
select throws_ok($$ update public.contrato_parcelas set recebida_em = null where id = 'f0000000-0000-0000-0000-000000000001' $$, '42501', null, 'A tabela não aceita mudar a data recebida');

-- Quando a responsável exclui e devolve, então funciona como nas outras parcelas.
select lives_ok($$ update public.contrato_parcelas set excluido_em = now() where id = 'f0000000-0000-0000-0000-000000000001' $$, 'A responsável exclui');
select throws_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000001', date '2025-03-15', 70000, date '2025-03-20', 65000) $$, null, 'Esta parcela foi excluída.', 'A excluída não é corrigida');
select lives_ok($$ update public.contrato_parcelas set excluido_em = null where id = 'f0000000-0000-0000-0000-000000000001' $$, 'A responsável devolve');

-- Quando outro advogado tenta corrigir, então o banco recusa.
reset role;
select pg_temp.entrar(2);
set local role authenticated;
select throws_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000001', date '2025-03-15', 1, date '2025-03-20', 1) $$, '42501', null, 'Outro advogado não corrige');

-- Quando um administrador corrige, então funciona.
reset role;
select pg_temp.entrar(0);
set local role authenticated;
select lives_ok($$ select public.parcela_corrigir_importada('f0000000-0000-0000-0000-000000000001', date '2025-03-15', 70000, date '2025-03-21', 65000) $$, 'O administrador corrige');

select * from finish();
rollback;
