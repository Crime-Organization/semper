-- O papel de cada cliente no processo (#426). Roda num banco local: supabase db start && supabase test db.
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum, fora dos processos), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e4260000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-426'),
  ('e4260000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-426-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4260000-0000-0000-0000-000000000001', 'ana-426@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4261'), now()),
  ('e4260000-0000-0000-0000-000000000001', 'bia-426@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c4262'), now()),
  ('e4260000-0000-0000-0000-000000000002', 'davi-426@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4264'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4260000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-426@exemplo.test', '{"convite":"c4261"}', now(), now()),
  ('a4260000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia-426@exemplo.test', '{"convite":"c4262"}', now(), now()),
  ('a4260000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-426@exemplo.test', '{"convite":"c4264"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54260000-0000-0000-0000-000000000001', 'a4260000-0000-0000-0000-000000000001', now(), now()),
  ('54260000-0000-0000-0000-000000000002', 'a4260000-0000-0000-0000-000000000002', now(), now()),
  ('54260000-0000-0000-0000-000000000004', 'a4260000-0000-0000-0000-000000000004', now(), now());

-- Três clientes no escritório, gravados direto (sem os gatilhos de cadastro).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14260000-0000-0000-0000-000000000001', 'e4260000-0000-0000-0000-000000000001', 'C1', 'contato', 'CLIENTE UM', 'a4260000-0000-0000-0000-000000000001'),
  ('14260000-0000-0000-0000-000000000002', 'e4260000-0000-0000-0000-000000000001', 'C2', 'contato', 'CLIENTE DOIS', 'a4260000-0000-0000-0000-000000000001'),
  ('14260000-0000-0000-0000-000000000003', 'e4260000-0000-0000-0000-000000000001', 'C3', 'contato', 'CLIENTE TRES', 'a4260000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4260000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54260000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Quantas linhas um update mudou (o update não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.mudados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.mudados(text) to authenticated;
create function pg_temp.papeis(p_numero text) returns jsonb language sql as $$
  select papeis_clientes from public.processos where escritorio_id = 'e4260000-0000-0000-0000-000000000001' and numero = p_numero
$$;
grant execute on function pg_temp.papeis(text) to authenticated;

select pg_temp.entrar(1); set local role authenticated;

-- ---------- o site novo grava o papel de cada cliente ----------
-- Quando a Ana cadastra um processo com dois clientes, um autor e o outro réu, então cada cliente guarda o seu papel.
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('74260000-0000-0000-0000-000000000001', 'judicial', 'A1', auth.uid(), '{14260000-0000-0000-0000-000000000001,14260000-0000-0000-0000-000000000002}',
   '{"14260000-0000-0000-0000-000000000001": "autor", "14260000-0000-0000-0000-000000000002": "reu"}', auth.uid()) $$,
  'Dado um processo com dois clientes, quando cada um tem o seu papel, então grava');
select is(pg_temp.papeis('A1'),
  '{"14260000-0000-0000-0000-000000000001": "autor", "14260000-0000-0000-0000-000000000002": "reu"}'::jsonb,
  'E cada cliente guarda o seu papel');
select is((select polo from public.processos where numero = 'A1' and escritorio_id = 'e4260000-0000-0000-0000-000000000001'), null,
  'E o polo antigo fica como veio (vazio)');

-- Quando grava um papel fora da lista, ou o nome que a tela mostra no lugar do código, então o banco recusa.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('judicial', 'A2', auth.uid(), '{14260000-0000-0000-0000-000000000001}', '{"14260000-0000-0000-0000-000000000001": "juiz"}', auth.uid()) $$,
  '23514', null, 'Dado um papel fora da lista, quando grava, então recusa');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('judicial', 'A3', auth.uid(), '{14260000-0000-0000-0000-000000000001}', '{"14260000-0000-0000-0000-000000000001": "Réu"}', auth.uid()) $$,
  '23514', null, 'Dado o nome mostrado na tela no lugar do código, quando grava, então recusa');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('judicial', 'A4', auth.uid(), '{14260000-0000-0000-0000-000000000001}', '["autor"]', auth.uid()) $$,
  '23514', null, 'Dado um papel fora do formato (uma lista, e não o papel de cada cliente), quando grava, então recusa');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('judicial', 'A5', auth.uid(), '{14260000-0000-0000-0000-000000000001}', '{"14260000-0000-0000-0000-000000000001": 1}', auth.uid()) $$,
  '23514', null, 'Dado um papel que não é texto, quando grava, então recusa');

-- Quando grava o papel de quem não é cliente do processo, então ele não fica.
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('judicial', 'A6', auth.uid(), '{14260000-0000-0000-0000-000000000001}',
   '{"14260000-0000-0000-0000-000000000001": "titular", "14260000-0000-0000-0000-000000000003": "autor"}', auth.uid()) $$,
  'Dado o papel de quem não é cliente, quando grava, então grava o processo');
select is(pg_temp.papeis('A6'), '{"14260000-0000-0000-0000-000000000001": "titular"}'::jsonb, 'E só o papel do cliente fica');

-- Quando a Ana troca o papel de um cliente, então muda e entra no histórico do processo.
select is(pg_temp.mudados($$ update public.processos set papeis_clientes =
  '{"14260000-0000-0000-0000-000000000001": "apenado", "14260000-0000-0000-0000-000000000002": "reu"}' where id = '74260000-0000-0000-0000-000000000001' $$),
  1::bigint, 'Dado um processo da Ana, quando ela troca o papel de um cliente, então muda');
select is(pg_temp.papeis('A1') ->> '14260000-0000-0000-0000-000000000001', 'apenado', 'E o cliente fica com o papel novo');
select ok(exists (select 1 from public.processo_historico where processo_id = '74260000-0000-0000-0000-000000000001' and alteracoes ? 'papeis_clientes'),
  'E a troca entra no histórico do processo');

-- Quando a Ana tira um cliente, então o papel dele sai junto.
select lives_ok($$ update public.processos set clientes = '{14260000-0000-0000-0000-000000000002}' where id = '74260000-0000-0000-0000-000000000001' $$,
  'Dado um processo com dois clientes, quando um sai, então grava');
select is(pg_temp.papeis('A1'), '{"14260000-0000-0000-0000-000000000002": "reu"}'::jsonb, 'E o papel de quem saiu sai junto');

-- ---------- a versão anterior do site, que só conhece o polo, continua funcionando ----------
-- Quando cadastra como antes, só com o polo, então cada cliente recebe o polo como papel.
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, polo, criado_por) values
  ('judicial', 'V1', auth.uid(), '{14260000-0000-0000-0000-000000000001,14260000-0000-0000-0000-000000000002}', 'reu', auth.uid()) $$,
  'Dado o cadastro como na versão anterior (com o polo), quando grava, então aceita');
select is(pg_temp.papeis('V1'),
  '{"14260000-0000-0000-0000-000000000001": "reu", "14260000-0000-0000-0000-000000000002": "reu"}'::jsonb,
  'E o polo vira o papel de cada cliente');
-- Quando acrescenta um cliente como antes, então o novo recebe o polo, e quem já tinha papel continua com o seu.
select lives_ok($$ update public.processos set papeis_clientes = '{"14260000-0000-0000-0000-000000000001": "autor", "14260000-0000-0000-0000-000000000002": "reu"}'
  where numero = 'V1' and escritorio_id = 'e4260000-0000-0000-0000-000000000001' $$, 'Dado um cliente que virou autor pelo site novo');
select lives_ok($$ update public.processos
  set clientes = '{14260000-0000-0000-0000-000000000001,14260000-0000-0000-0000-000000000002,14260000-0000-0000-0000-000000000003}'
  where numero = 'V1' and escritorio_id = 'e4260000-0000-0000-0000-000000000001' $$,
  'Quando a versão anterior acrescenta um cliente, então grava');
select is(pg_temp.papeis('V1'),
  '{"14260000-0000-0000-0000-000000000001": "autor", "14260000-0000-0000-0000-000000000002": "reu", "14260000-0000-0000-0000-000000000003": "reu"}'::jsonb,
  'E o cliente novo recebe o polo; os outros ficam com o papel deles');
-- Quando cadastra como antes, sem polo, então os clientes ficam sem papel (a tela o pede na próxima edição).
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por) values
  ('judicial', 'V2', auth.uid(), '{14260000-0000-0000-0000-000000000001}', auth.uid()) $$, 'Dado o cadastro antigo sem polo, quando grava, então aceita');
select is(pg_temp.papeis('V2'), '{}'::jsonb, 'E o cliente fica sem papel');
-- O polo continua aceitando os valores de antes, inclusive o apenado.
select lives_ok($$ update public.processos set polo = 'apenado' where numero = 'V2' and escritorio_id = 'e4260000-0000-0000-0000-000000000001' $$,
  'Quando a versão anterior grava o polo apenado, então aceita');
select is(pg_temp.papeis('V2'), '{"14260000-0000-0000-0000-000000000001": "apenado"}'::jsonb, 'E o cliente sem papel recebe o polo');

-- ---------- quem vê e quem altera ----------
reset role;
select pg_temp.entrar(2); set local role authenticated;
-- Quando a Bia, que não está no processo, tenta mudar o papel, então nada muda.
select is(pg_temp.mudados($$ update public.processos set papeis_clientes = '{"14260000-0000-0000-0000-000000000002": "autor"}'
  where id = '74260000-0000-0000-0000-000000000001' $$), 0::bigint, 'Dado um processo em que a Bia não está, quando ela muda o papel, então nada muda');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.processos where escritorio_id = 'e4260000-0000-0000-0000-000000000001'), 0::bigint,
  'Dado o Davi, de outro escritório, quando lê os processos, então não vê o papel dos clientes de outro escritório');
reset role;
select is(pg_temp.papeis('A1'), '{"14260000-0000-0000-0000-000000000002": "reu"}'::jsonb, 'E o papel continua como estava');

-- ---------- o apenado na lista das pessoas com papel ----------
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, escritorio_id, papel) values
  ('74260000-0000-0000-0000-000000000001', '14260000-0000-0000-0000-000000000003', 'e4260000-0000-0000-0000-000000000001', 'apenado') $$,
  'Dado um processo, quando põe uma pessoa como apenado, então aceita (a lista é a mesma do papel do cliente)');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, escritorio_id, papel) values
  ('74260000-0000-0000-0000-000000000001', '14260000-0000-0000-0000-000000000003', 'e4260000-0000-0000-0000-000000000001', 'juiz') $$,
  '23514', null, 'Dado um papel fora da lista, quando põe a pessoa, então recusa');

select * from finish();
rollback;
