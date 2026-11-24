-- A seção "Recebimentos excluídos" do Financeiro (#413) lê a cópia escondida dos recebimentos dos contratos excluídos (#284):
-- só os administradores do escritório leem, e ninguém muda nem apaga as linhas, nem o administrador.
-- Roda num banco local: supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
-- Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com a Ana (administradora) e a Bia (da equipe), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-excluidos', '{"contratos": true, "financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-excluidos-2', '{"contratos": true, "financeiro": true}');
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

-- E a cópia escondida de dois recebimentos excluídos neste escritório (um deles estornado) e de um no outro, como
-- public.contratos_excluir os grava (aqui direto, como o sistema).
insert into public.financeiro_excluidos (escritorio_id, contrato_id, contrato_codigo, cliente_nome, tipo, parcela_numero, data, valor, conta_nome, estornado,
                                         copia, excluido_por) values
  ('e0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'AA11-0001-2030', 'CLIENTE', 'recebimento', 1, '2030-03-10', 100000, 'PJ', false, '{}',
   'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'AA11-0002-2030', 'CLIENTE', 'recebimento', 2, '2030-04-10', 50000, 'PJ', true, '{}',
   'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', gen_random_uuid(), 'AA11-0001-2030', 'OUTRO CLIENTE', 'recebimento', 1, '2030-03-10', 90000, 'PF', false, '{}',
   'a0000000-0000-0000-0000-000000000003');

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- ===== A administradora =====
select pg_temp.entrar(1); set local role authenticated;
-- Quando lê o que a seção lê
-- Então vê só os do escritório dela, com o contrato, a data, o valor, a conta e quem excluiu
select results_eq($$ select contrato_codigo, data, valor, conta_nome, estornado, excluido_por from public.financeiro_excluidos order by excluido_em, id $$,
  $$ values ('AA11-0001-2030', date '2030-03-10', 100000::bigint, 'PJ', false, 'a0000000-0000-0000-0000-000000000001'::uuid),
            ('AA11-0002-2030', date '2030-04-10', 50000::bigint, 'PJ', true, 'a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'A administradora lê os recebimentos excluídos do escritório dela, e só esses');
-- Quando tenta mudar ou apagar uma linha, então é recusada
select throws_ok($$ update public.financeiro_excluidos set valor = 1 $$, '42501', null, 'Nem a administradora muda a cópia');
select throws_ok($$ delete from public.financeiro_excluidos $$, '42501', null, 'Nem a administradora apaga a cópia');
reset role;
select is((select sum(valor) from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 150000::numeric,
  'E as linhas continuam como estavam');

-- ===== Quem não é administrador =====
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.financeiro_excluidos), 0::bigint, 'Quem não é administrador não lê nenhuma linha');
select throws_ok($$ delete from public.financeiro_excluidos $$, '42501', null, 'Nem apaga');
reset role;

-- ===== O administrador do outro escritório =====
select pg_temp.entrar(3); set local role authenticated;
select results_eq($$ select contrato_codigo, conta_nome from public.financeiro_excluidos $$, $$ values ('AA11-0001-2030', 'PF') $$,
  'O administrador do outro escritório lê só os dele');
reset role;

select * from finish();
rollback;
