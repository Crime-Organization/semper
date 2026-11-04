-- Cada advogado confere as próprias linhas, e o caixa não muda. Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Dado um escritório, uma administradora, duas advogadas, um contrato com uma parcela importada e três linhas de conferência.
insert into public.escritorios (id, nome, slug, modulos) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-conferencia', '{"contratos": true, "financeiro": true}');
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
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor, recebida_em, recebido) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, date '2025-03-10', 60000, date '2025-03-12', 55000);
insert into public.financeiro_conferencia (id, escritorio_id, chave, responsavel_id, ano, cliente, parcela_id, data_pago, valor_pago, data_caixa, valor_caixa, sugestao) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'l1', 'a0000000-0000-0000-0000-000000000001', 2025, 'Cliente', 'f0000000-0000-0000-0000-000000000001', date '2025-03-12', 55000, date '2025-03-13', 16500, 'confere'),
  ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'l2', 'a0000000-0000-0000-0000-000000000001', 2025, 'Só no caixa', null, null, null, date '2025-04-01', 30000, 'nao_confere'),
  ('d0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'l3', 'a0000000-0000-0000-0000-000000000002', 2025, 'Da Bia', null, date '2025-05-01', 10000, null, null, 'nao_confere');
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

select pg_temp.entrar(1);
set local role authenticated;

-- Quando a advogada abre, então vê só as dela, inclusive a que só existe no caixa, mesmo pedindo as de outra pessoa ou olhando a tabela.
select is((select jsonb_array_length(public.financeiro_conferencia_listar(2025))), 2, 'Vê as duas linhas dela');
select is((select jsonb_array_length(public.financeiro_conferencia_listar(2025, 'a0000000-0000-0000-0000-000000000002'))), 0, 'Pedir as de outra pessoa não traz nada');
select is((select count(*)::int from public.financeiro_conferencia), 2, 'A tabela também só mostra as dela');
select ok((select public.financeiro_conferencia_listar(2025)) @> '[{"cliente": "Só no caixa", "valor_caixa": 30000}]', 'A linha que só existe no caixa aparece, com o valor');
select throws_ok($$ select public.financeiro_conferencia_resumo() $$, '42501', null, 'Quem não é administrador não vê o resumo');

-- Quando ela marca e escreve uma observação, então fica salvo, com quem marcou e quando, e no histórico.
select lives_ok($$ select public.financeiro_conferencia_marcar('d0000000-0000-0000-0000-000000000001', 'nao_confere', '  Falta o comprovante  ') $$, 'Marca Não confere');
select is((select (situacao, observacao, marcado_por)::text from public.financeiro_conferencia where id = 'd0000000-0000-0000-0000-000000000001'),
  '(nao_confere,"Falta o comprovante",a0000000-0000-0000-0000-000000000001)', 'Fica salvo, com quem marcou');
select ok((select marcado_em is not null from public.financeiro_conferencia where id = 'd0000000-0000-0000-0000-000000000001'), 'Fica salvo quando marcou');
select ok((select alteracoes ? 'Situação' and alteracoes ? 'Observação' from public.financeiro_conferencia_historico where conferencia_id = 'd0000000-0000-0000-0000-000000000001' order by id desc limit 1), 'A marcação fica no histórico');

-- Quando ela corrige a linha ligada a uma parcela, então a parcela muda junto, e o caixa não.
select lives_ok($$ select public.financeiro_conferencia_corrigir('d0000000-0000-0000-0000-000000000001', date '2025-03-20', 57500) $$, 'Corrige o pagamento');
select is((select (recebida_em, recebido)::text from public.contrato_parcelas where id = 'f0000000-0000-0000-0000-000000000001'), '(2025-03-20,57500)', 'A parcela muda junto');
select ok((select public.financeiro_conferencia_listar(2025)) @> '[{"cliente": "Cliente", "data_pago": "2025-03-20", "valor_pago": 57500}]', 'A linha mostra o novo valor');
select ok((select bool_or(alteracoes ? 'Valor pago') from public.financeiro_conferencia_historico where conferencia_id = 'd0000000-0000-0000-0000-000000000001'), 'A correção fica no histórico');
select is((select count(*)::int from public.financeiro_lancamentos) + (select count(*)::int from public.financeiro_recebimentos), 0, 'O caixa não muda');

-- Quando a linha só existe no caixa, então ela preenche o que foi pago; o que entrou no caixa não muda.
select lives_ok($$ select public.financeiro_conferencia_corrigir('d0000000-0000-0000-0000-000000000002', date '2025-04-01', 100000) $$, 'Preenche a linha que só existe no caixa');
select is((select valor_caixa from public.financeiro_conferencia where id = 'd0000000-0000-0000-0000-000000000002'), 30000::bigint, 'O valor do caixa continua o mesmo');

-- Quando a data é futura, ou a tabela é alterada direto, então o banco recusa.
select throws_ok($$ select public.financeiro_conferencia_corrigir('d0000000-0000-0000-0000-000000000002', date '2999-01-01', 100) $$, null, 'A data do pagamento não pode estar no futuro.', 'Recusa a data futura');
select throws_ok($$ update public.financeiro_conferencia set valor_caixa = 1 where id = 'd0000000-0000-0000-0000-000000000002' $$, '42501', null, 'A tabela não aceita alteração direta');

-- Quando tenta mexer na linha de outra pessoa, então o banco recusa.
select throws_ok($$ select public.financeiro_conferencia_marcar('d0000000-0000-0000-0000-000000000003', 'confere', null) $$, '42501', null, 'Não marca a linha de outra pessoa');

-- Quando um administrador abre o resumo, então vê por responsável e por ano.
reset role;
select pg_temp.entrar(0);
set local role authenticated;
select is((select jsonb_array_length(public.financeiro_conferencia_resumo())), 2, 'Uma linha por responsável e ano');
select ok((select public.financeiro_conferencia_resumo()) @> '[{"responsavel_id": "a0000000-0000-0000-0000-000000000001", "ano": 2025, "total": 2, "nao_confere": 1, "falta": 1, "valor_nao_confere": 57500, "valor_falta": 100000}]', 'Soma o que não confere e o que falta');

select * from finish();
rollback;
