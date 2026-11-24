-- Propriedade intelectual: a publicação do deferimento da marca não vem antes do depósito, e a concessão não vem antes dela (#418).
-- Roda num banco local: supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
-- Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com a Ana (master) e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e4181000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-418-ordem'),
  ('e4181000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-418-ordem-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4181000-0000-0000-0000-000000000001', 'ana-418o@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4181o'), now()),
  ('e4181000-0000-0000-0000-000000000002', 'davi-418o@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4184o'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4181000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-418o@exemplo.test', '{"convite":"c4181o"}', now(), now()),
  ('a4181000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-418o@exemplo.test', '{"convite":"c4184o"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54181000-0000-0000-0000-000000000001', 'a4181000-0000-0000-0000-000000000001', now(), now()),
  ('54181000-0000-0000-0000-000000000004', 'a4181000-0000-0000-0000-000000000004', now(), now());

-- A pessoa e o processo de marca, gravados direto (sem os gatilhos de cadastro): depositado em 10/03/2025.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14181000-0000-0000-0000-000000000001', 'e4181000-0000-0000-0000-000000000001', 'C1', 'contato', 'TITULAR TESTE', 'a4181000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, area, protecao, deposito, responsavel_id, colaboradores, clientes, criado_por) values
  ('74181000-0000-0000-0000-000000000001', 'e4181000-0000-0000-0000-000000000001', 'MA', 'administrativo', '941810001', 'Propriedade intelectual', 'marca',
   '2025-03-10', 'a4181000-0000-0000-0000-000000000001', '{}', '{14181000-0000-0000-0000-000000000001}', 'a4181000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4181000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54181000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

select pg_temp.entrar(1); set local role authenticated;
-- Quando a Ana informa o deferimento antes do depósito, então o banco recusa.
select throws_ok($$ update public.processos set deferimento = '2025-03-09' where id = '74181000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando o deferimento é antes do depósito, então é recusado');
-- Quando o deferimento é no dia do depósito ou depois, então entra.
select lives_ok($$ update public.processos set deferimento = '2026-10-06' where id = '74181000-0000-0000-0000-000000000001' $$,
  'Quando o deferimento é depois do depósito, então é gravado');
-- Quando a concessão é antes do deferimento (mas depois do depósito), então é recusada.
select throws_ok($$ update public.processos set concessao = '2026-10-05' where id = '74181000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando a concessão é antes do deferimento, então é recusada');
select lives_ok($$ update public.processos set concessao = '2026-10-06' where id = '74181000-0000-0000-0000-000000000001' $$,
  'Quando a concessão é no dia do deferimento, então é gravada');
-- E com a concessão informada, o deferimento não passa para depois dela.
select throws_ok($$ update public.processos set deferimento = '2026-12-01' where id = '74181000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando o deferimento passa para depois da concessão, então é recusado');
-- Sem o deferimento (a versão anterior do site não o preenche), a concessão segue só a regra do depósito.
select lives_ok($$ update public.processos set deferimento = null, concessao = '2025-04-01' where id = '74181000-0000-0000-0000-000000000001' $$,
  'Quando não há deferimento, então a concessão só precisa vir depois do depósito');
reset role;
select is((select (deferimento, concessao)::text from public.processos where id = '74181000-0000-0000-0000-000000000001'), '(,2025-04-01)',
  'Então o processo ficou com o que foi aceito');
-- Dado o Davi, do outro escritório, quando tenta mudar a data, então nada muda (o escritório é isolado).
select pg_temp.entrar(4); set local role authenticated;
update public.processos set deferimento = '2025-03-11' where id = '74181000-0000-0000-0000-000000000001';
reset role;
select is((select deferimento from public.processos where id = '74181000-0000-0000-0000-000000000001'), null, 'Então o outro escritório não muda a data');

select * from finish();
rollback;
