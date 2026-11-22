-- Demandas relacionadas (#310). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia e Caio (usuários comuns), e o Davi em outro escritório; a Bia está nas
-- demandas D1, D2 e D4 (arquivada), não na D3; o Caio não está em nenhuma; a D9 é do outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-relacionadas', '{"demandas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-relacionadas-2', '{"demandas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());
set local session_replication_role = replica;
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por, arquivado_em) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Primeira', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001', null),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Segunda', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001', null),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Sigilosa', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001', null),
  ('71000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'D4', 'Arquivada', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001', now()),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'De fora', 'a0000000-0000-0000-0000-000000000004', '{}', 'a0000000-0000-0000-0000-000000000004', null);
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- As ligações de uma demanda que quem está logado vê.
create function pg_temp.ligacoes(p_demanda uuid) returns bigint language sql as $$
  select count(*) from public.demandas_relacionadas where p_demanda in (demanda_a, demanda_b)
$$;
-- Liga como o site (supabase.ts, demandaRelacionar): o upsert que ignora a repetida, e quantas linhas novas voltam.
create function pg_temp.ligar_como_o_site(p_a uuid, p_b uuid, p_quem uuid) returns bigint language sql as $$
  with r as (insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values (least(p_a, p_b), greatest(p_a, p_b), p_quem)
             on conflict (demanda_a, demanda_b) do nothing returning demanda_a)
  select count(*) from r
$$;

-- Quando a Bia liga a D2 à D1 (a maior primeiro),
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002') $$, 'Quem está nas duas liga uma à outra');
-- então a ligação fica em ordem, com o número de cada uma, e aparece nas duas.
select is((select demanda_a::text || ' ' || codigo_a || ' ' || codigo_b from public.demandas_relacionadas), '71000000-0000-0000-0000-000000000001 D1 D2', 'Então a ligação fica em ordem, com o número de cada uma');
select is(pg_temp.ligacoes('71000000-0000-0000-0000-000000000001'), 1::bigint, 'Então a D1 mostra a ligação');
select is(pg_temp.ligacoes('71000000-0000-0000-0000-000000000002'), 1::bigint, 'Então a D2 mostra a mesma ligação');
-- Quando liga de novo, no outro sentido, então nada se repete.
insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002') on conflict do nothing;
select is(pg_temp.ligacoes('71000000-0000-0000-0000-000000000001'), 1::bigint, 'Quando liga de novo no outro sentido, então a ligação não se repete');
-- Quando tenta ligar uma demanda em que não está, uma arquivada, a de outro escritório ou a mesma, então é recusado.
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002') $$, '42501', null, 'Quem não está na outra demanda não liga');
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002') $$, '42501', null, 'A demanda arquivada não se liga');
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002') $$, '42501', null, 'A demanda de outro escritório não se liga');
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-0000000000ff', 'a0000000-0000-0000-0000-000000000002') $$, '42501', null,
  'O id que não existe dá a mesma recusa do id de outro escritório (ninguém descobre se um id existe)');
select throws_ok($$ insert into public.demandas_relacionadas (escritorio_id, demanda_a, demanda_b, criado_por) values
  ('e0000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002') $$, '42501', null,
  'Ninguém grava a ligação em nome de outro escritório');
-- Quando liga de novo como o site liga (o upsert que ignora a repetida), então nada volta: a ligação não é nova.
select is(pg_temp.ligar_como_o_site('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  0::bigint, 'Ligar de novo como o site liga não devolve linha nova');
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002') $$, '23514', null, 'A demanda não se liga a ela mesma');
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'Ninguém liga em nome de outra pessoa');
reset role;

-- Quando a Ana (administradora) liga a D3 à D1,
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001') $$, 'A administradora liga a D3 à D1');
reset role;
-- então a Bia, que não está na D3, vê a ligação e o número da D3, sem ver a D3.
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.ligacoes('71000000-0000-0000-0000-000000000001'), 2::bigint, 'Então a Bia vê as duas ligações da D1');
select is((select codigo_b from public.demandas_relacionadas where demanda_b = '71000000-0000-0000-0000-000000000003'), 'D3', 'Então a Bia vê o número da D3');
select is((select count(*) from public.demandas where id = '71000000-0000-0000-0000-000000000003'), 0::bigint, 'Então a Bia não vê o conteúdo da D3');
reset role;
-- E o Caio, que não está em nenhuma das duas, não vê as ligações; nem o Davi, do outro escritório.
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.ligacoes('71000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem não está em nenhuma das duas não vê a ligação');
-- Quando o Caio tenta desfazer, então nada sai.
delete from public.demandas_relacionadas where demanda_a = '71000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*) from public.demandas_relacionadas), 2::bigint, 'Quem não está em nenhuma das duas não desfaz a ligação');
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.demandas_relacionadas), 0::bigint, 'Outro escritório não vê as ligações');
-- Quando o Davi (administrador do outro escritório) tenta desfazer ou ligar a demanda dele a uma deste, então nada muda.
delete from public.demandas_relacionadas;
select throws_ok($$ insert into public.demandas_relacionadas (demanda_a, demanda_b, criado_por) values
  ('71000000-0000-0000-0000-000000000009', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004') $$, '42501', null,
  'O outro escritório não liga a demanda dele a uma deste');
reset role;
select is((select count(*) from public.demandas_relacionadas), 2::bigint, 'O outro escritório não desfaz as ligações deste');

-- Quando a Bia desfaz, pela D1, a ligação com a D3 (que ela não vê),
select pg_temp.entrar(2); set local role authenticated;
delete from public.demandas_relacionadas where demanda_a = '71000000-0000-0000-0000-000000000001' and demanda_b = '71000000-0000-0000-0000-000000000003';
reset role;
-- então ela some dos dois lados.
select is((select count(*) from public.demandas_relacionadas where '71000000-0000-0000-0000-000000000003' in (demanda_a, demanda_b)), 0::bigint, 'Quando desfaz num cartão, então a ligação some dos dois');
-- Quando ninguém altera a ligação, então ela não muda (só se liga e se desfaz).
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ update public.demandas_relacionadas set codigo_a = 'X' $$, '42501', null, 'A ligação não se altera, só se liga e se desfaz');
reset role;

-- Quando a D2 é excluída, então a ligação dela sai junto.
delete from public.demandas where id = '71000000-0000-0000-0000-000000000002';
select is((select count(*) from public.demandas_relacionadas), 0::bigint, 'Quando a demanda é excluída, então a ligação sai junto');

select * from finish();
rollback;
