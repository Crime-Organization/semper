-- Processos relacionados de qualquer tipo (#440). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora) e Bia (usuária comum), e o Davi em outro escritório. A Bia está nos processos J1
-- (judicial), J2 (judicial), A1 (administrativo) e A4 (administrativo arquivado); não está no A3. O J9 é do outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-processos-relacionados', '{"processos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-processos-relacionados-2', '{"processos": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'CLIENTE DE FORA', 'a0000000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por, arquivado_em) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'J1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', null),
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'J2', 'judicial', '2', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', null),
  ('73000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000001', 'A1', 'administrativo', '11', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', null),
  ('73000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000001', 'A3', 'administrativo', '13', 'a0000000-0000-0000-0000-000000000001', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', null),
  ('73000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000001', 'A4', 'administrativo', '14', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', now()),
  ('73000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'J9', 'judicial', '9', 'a0000000-0000-0000-0000-000000000004', '{}', '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000004', null);
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Quantas linhas um delete apagou (o delete não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.apagados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.apagados(text) to authenticated;

-- Quando a Bia liga judicial com judicial, administrativo com judicial e judicial com administrativo (o par vem em qualquer ordem),
-- então cada ligação fica numa linha só, em ordem, com o código de cada processo
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                   values ('73000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', auth.uid()) $$, 'Judicial com judicial');
select lives_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                   values ('73000000-0000-0000-0000-000000000011', '73000000-0000-0000-0000-000000000002', auth.uid()) $$, 'Administrativo com judicial');
select is((select codigo_a || '-' || codigo_b from public.processos_relacionados where processo_b = '73000000-0000-0000-0000-000000000002' and processo_a = '73000000-0000-0000-0000-000000000001'),
  'J1-J2', 'O par fica em ordem, com o código de cada um');
-- Quando liga o mesmo par de novo, no outro sentido, então é recusado (já existe)
select throws_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                    values ('73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', auth.uid()) $$, '23505', null, 'O mesmo par não entra duas vezes');
-- Quando liga o processo a ele mesmo, a um arquivado, a um em que não está, ou a um de outro escritório, então é recusado
select throws_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                    values ('73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', auth.uid()) $$, '23514', null, 'Processo com ele mesmo não');
select throws_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                    values ('73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000014', auth.uid()) $$, '42501', null, 'Arquivado não recebe ligação');
select throws_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                    values ('73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000013', auth.uid()) $$, '42501', null, 'Quem não está nos dois não liga');
select throws_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                    values ('73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000009', auth.uid()) $$, '42501', null, 'Processo de outro escritório não');
-- Então ela vê as duas ligações
select is((select count(*) from public.processos_relacionados), 2::bigint, 'Quem está nos processos vê as ligações');
reset role;

-- Dado a Ana ligando o A3 (em que a Bia não está) ao J1, quando a Bia olha e tenta desfazer, então vê (está no J1) e desfaz
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.processos_relacionados (processo_a, processo_b, criado_por)
                   values ('73000000-0000-0000-0000-000000000013', '73000000-0000-0000-0000-000000000001', auth.uid()) $$, 'A administradora liga qualquer par');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.processos_relacionados where '73000000-0000-0000-0000-000000000013' in (processo_a, processo_b)), 1::bigint, 'Vê a ligação pelo processo em que está');
select is(pg_temp.apagados('delete from public.processos_relacionados where ''73000000-0000-0000-0000-000000000013'' in (processo_a, processo_b)'), 1::bigint, 'Desfaz por estar em um dos dois');
reset role;

-- Quando alguém de outro escritório olha ou tenta desfazer, então não vê nem apaga nada
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.processos_relacionados), 0::bigint, 'Outro escritório não vê');
select is(pg_temp.apagados('delete from public.processos_relacionados'), 0::bigint, 'Outro escritório não desfaz');
select throws_ok($$ insert into public.processos_relacionados (escritorio_id, processo_a, processo_b, criado_por)
                    values ('e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', auth.uid()) $$, '42501', null, 'Outro escritório não liga');
reset role;

-- Quando um dos processos é excluído, então a ligação sai sozinha
select set_config('request.jwt.claims', '', true);
delete from public.processos where id = '73000000-0000-0000-0000-000000000011';
select is((select count(*) from public.processos_relacionados where '73000000-0000-0000-0000-000000000011' in (processo_a, processo_b)), 0::bigint, 'A ligação sai com o processo');
select is((select count(*) from public.processos_relacionados), 1::bigint, 'As outras ficam');

select * from finish();
rollback;
