-- O papel do cliente escrito pela equipe no processo (#443). Roda num banco local: supabase db start && supabase test db.
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum, fora dos processos), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e4430000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-443'),
  ('e4430000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-443-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4430000-0000-0000-0000-000000000001', 'ana-443@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4431'), now()),
  ('e4430000-0000-0000-0000-000000000001', 'bia-443@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c4432'), now()),
  ('e4430000-0000-0000-0000-000000000002', 'davi-443@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4434'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4430000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-443@exemplo.test', '{"convite":"c4431"}', now(), now()),
  ('a4430000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia-443@exemplo.test', '{"convite":"c4432"}', now(), now()),
  ('a4430000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-443@exemplo.test', '{"convite":"c4434"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54430000-0000-0000-0000-000000000001', 'a4430000-0000-0000-0000-000000000001', now(), now()),
  ('54430000-0000-0000-0000-000000000002', 'a4430000-0000-0000-0000-000000000002', now(), now()),
  ('54430000-0000-0000-0000-000000000004', 'a4430000-0000-0000-0000-000000000004', now(), now());

-- Dois clientes no escritório da Ana e um no do Davi, gravados direto (sem os gatilhos de cadastro).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14430000-0000-0000-0000-000000000001', 'e4430000-0000-0000-0000-000000000001', 'C1', 'contato', 'CLIENTE UM', 'a4430000-0000-0000-0000-000000000001'),
  ('14430000-0000-0000-0000-000000000002', 'e4430000-0000-0000-0000-000000000001', 'C2', 'contato', 'CLIENTE DOIS', 'a4430000-0000-0000-0000-000000000001'),
  ('14430000-0000-0000-0000-000000000004', 'e4430000-0000-0000-0000-000000000002', 'C1', 'contato', 'CLIENTE DO DAVI', 'a4430000-0000-0000-0000-000000000004');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4430000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54430000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Quantas linhas um comando mudou (o update não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.mudados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.mudados(text) to authenticated;
create function pg_temp.escritos(p_numero text) returns jsonb language sql as $$
  select papeis_escritos from public.processos where escritorio_id = 'e4430000-0000-0000-0000-000000000001' and numero = p_numero
$$;
grant execute on function pg_temp.escritos(text) to authenticated;
-- A lista do escritório da Ana (lida sem as regras de quem lê).
create function pg_temp.lista_da_ana() returns text[] language sql as $$
  select coalesce(array_agg(nome order by nome), '{}') from public.processo_papeis where escritorio_id = 'e4430000-0000-0000-0000-000000000001'
$$;

select pg_temp.entrar(1); set local role authenticated;

-- ---------- o nome escrito do cliente ----------
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('74430000-0000-0000-0000-000000000001', 'judicial', 'A1', auth.uid(), '{14430000-0000-0000-0000-000000000001}',
   '{"14430000-0000-0000-0000-000000000001": "outro"}', '{"14430000-0000-0000-0000-000000000001": "  Inventariante  "}', auth.uid()) $$,
  'Dado um cliente com o papel outro e um nome escrito, quando a Ana grava o processo, então grava');
select is(pg_temp.escritos('A1'), '{"14430000-0000-0000-0000-000000000001": "Inventariante"}'::jsonb, 'E o nome fica limpo');
reset role;
select is(pg_temp.lista_da_ana(), '{}'::text[], 'E gravar o processo não põe o nome na lista: quem põe é a tela, com o que a pessoa escreveu');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.processo_papeis_incluir(array['  Inventariante  ']) $$,
  'Quando a tela põe na lista o nome que a Ana escreveu, então aceita');
reset role;
select is(pg_temp.lista_da_ana(), '{Inventariante}'::text[], 'E a lista do escritório ganha o nome, limpo');
select pg_temp.entrar(1); set local role authenticated;

-- Quando outro processo escreve o mesmo nome com outras maiúsculas e espaços, então usa o da lista, sem repetir.
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('judicial', 'A2', auth.uid(), '{14430000-0000-0000-0000-000000000001}',
   '{"14430000-0000-0000-0000-000000000001": "outro"}', '{"14430000-0000-0000-0000-000000000001": " INVENTARIANTE "}', auth.uid()) $$,
  'Dado Inventariante na lista, quando outro processo grava INVENTARIANTE, então grava');
select is(pg_temp.escritos('A2'), '{"14430000-0000-0000-0000-000000000001": "Inventariante"}'::jsonb, 'E guarda na grafia da lista');
select lives_ok($$ select public.processo_papeis_incluir(array[' INVENTARIANTE ']) $$, 'Quando a tela põe o nome escrito de novo na lista, então aceita');
reset role;
select is(pg_temp.lista_da_ana(), '{Inventariante}'::text[], 'E a lista continua com uma linha só');
select pg_temp.entrar(1); set local role authenticated;

-- Quando o nome escrito é de um cliente com outro papel, ou de quem não é cliente, então ele não fica.
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('judicial', 'A3', auth.uid(), '{14430000-0000-0000-0000-000000000001}', '{"14430000-0000-0000-0000-000000000001": "autor"}',
   '{"14430000-0000-0000-0000-000000000001": "Herdeiro", "14430000-0000-0000-0000-000000000002": "Curador"}', auth.uid()) $$,
  'Dado um nome escrito de um autor e de quem não é cliente, quando grava, então grava o processo');
select is(pg_temp.escritos('A3'), '{}'::jsonb, 'E nenhum dos dois nomes fica');

-- Quando o nome passa de 60 letras, ou não é texto, então o banco recusa.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('judicial', 'A4', auth.uid(), '{14430000-0000-0000-0000-000000000001}', '{"14430000-0000-0000-0000-000000000001": "outro"}',
   jsonb_build_object('14430000-0000-0000-0000-000000000001', repeat('x', 61)), auth.uid()) $$,
  '23514', null, 'Dado um nome com mais de 60 letras, quando grava, então recusa');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('judicial', 'A5', auth.uid(), '{14430000-0000-0000-0000-000000000001}', '{"14430000-0000-0000-0000-000000000001": "outro"}',
   '{"14430000-0000-0000-0000-000000000001": 1}', auth.uid()) $$,
  '23514', null, 'Dado um nome que não é texto, quando grava, então recusa');
select throws_ok($$ select public.processo_papeis_incluir(array[repeat('x', 61)]) $$, '23514', null,
  'Quando a tela põe na lista um nome com mais de 60 letras, então recusa');

-- A mudança do nome escrito fica no histórico do processo, como texto.
select is(pg_temp.mudados($$ update public.processos set papeis_escritos = '{"14430000-0000-0000-0000-000000000001": "Curador"}'
  where id = '74430000-0000-0000-0000-000000000001' $$), 1::bigint, 'Dado o processo A1, quando a Ana troca o nome escrito, então muda');
select is((select alteracoes -> 'papeis_escritos' from public.processo_historico where processo_id = '74430000-0000-0000-0000-000000000001'
  and alteracoes ? 'papeis_escritos' order by em desc limit 1), '{"de": "Inventariante", "para": "Curador"}'::jsonb,
  'E o histórico guarda os nomes como texto');
select lives_ok($$ select public.processo_papeis_incluir(array['Curador']) $$, 'E a tela põe o nome novo na lista');
reset role;
select is(pg_temp.lista_da_ana(), '{Curador,Inventariante}'::text[], 'E o nome novo entra na lista');
select pg_temp.entrar(1); set local role authenticated;

-- ---------- a versão anterior do site, que não conhece o nome escrito ----------
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, criado_por) values
  ('judicial', 'V1', auth.uid(), '{14430000-0000-0000-0000-000000000001}', '{"14430000-0000-0000-0000-000000000001": "autor"}', auth.uid()) $$,
  'Dado o cadastro como na versão anterior (sem o nome escrito), quando grava, então aceita');
select is(pg_temp.escritos('V1'), '{}'::jsonb, 'E o processo fica sem nome escrito');
select lives_ok($$ select id, codigo, tipo, numero, titulo, responsavel_id, colaboradores, cliente_nome, orgao, sistema, polo, papeis_clientes, area
  from public.processos where id = '74430000-0000-0000-0000-000000000001' $$, 'Quando a versão anterior lê o processo com nome escrito, então lê');
select lives_ok($$ update public.processos set papeis_clientes = '{"14430000-0000-0000-0000-000000000001": "outro"}'
  where id = '74430000-0000-0000-0000-000000000001' $$, 'Quando a versão anterior grava o papel, mantendo o outro, então grava');
select is(pg_temp.escritos('A1'), '{"14430000-0000-0000-0000-000000000001": "Curador"}'::jsonb, 'E o nome escrito continua');
select lives_ok($$ update public.processos set papeis_clientes = '{"14430000-0000-0000-0000-000000000001": "reu"}'
  where id = '74430000-0000-0000-0000-000000000001' $$, 'Quando a versão anterior troca o papel para réu, então grava');
select is(pg_temp.escritos('A1'), '{}'::jsonb, 'E o nome escrito sai junto');

-- ---------- quem altera ----------
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudados($$ update public.processos set papeis_escritos = '{"14430000-0000-0000-0000-000000000001": "Tutor"}'
  where numero = 'A2' and escritorio_id = 'e4430000-0000-0000-0000-000000000001' $$), 0::bigint,
  'Dado um processo em que a Bia não está, quando ela muda o nome escrito, então nada muda');
select throws_ok($$ insert into public.processo_papeis (nome) values ('Tutor') $$, '42501', null,
  'Dado a Bia, quando põe um papel direto na lista, sem a função, então recusa');
select is(pg_temp.mudados($$ delete from public.processo_papeis where nome = 'Inventariante' $$), 0::bigint,
  'Quando a Bia, que não é administradora, tenta tirar um papel da lista, então nada sai');
select is((select count(*) from public.processo_papeis), 2::bigint, 'E ela lê a lista do escritório');
select throws_ok($$ select privado.papel_na_lista('e4430000-0000-0000-0000-000000000001', 'Tutor') $$, '42501', null,
  'E a função que acha o nome na lista não abre para ela');

-- ---------- tirar da lista: o nome não volta sem alguém escrevê-lo ----------
reset role;
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('74430000-0000-0000-0000-000000000002', 'judicial', 'B1', auth.uid(), '{14430000-0000-0000-0000-000000000001,14430000-0000-0000-0000-000000000002}',
   '{"14430000-0000-0000-0000-000000000001": "outro", "14430000-0000-0000-0000-000000000002": "autor"}',
   '{"14430000-0000-0000-0000-000000000001": "Inventariante"}', auth.uid()) $$,
  'Dado o processo B1, com dois clientes, um deles Inventariante, quando a Ana grava, então grava');
select is(pg_temp.mudados($$ delete from public.processo_papeis where nome = 'Inventariante' $$), 1::bigint,
  'Dado a Ana, administradora, quando tira Inventariante da lista, então sai');
select is(pg_temp.escritos('A2'), '{"14430000-0000-0000-0000-000000000001": "Inventariante"}'::jsonb, 'E o processo que o usa continua com o nome');
select lives_ok($$ update public.processos set papeis_escritos = '{"14430000-0000-0000-0000-000000000001": "Inventariante"}', titulo = 'De novo'
  where numero = 'A2' and escritorio_id = 'e4430000-0000-0000-0000-000000000001' $$, 'Quando o processo é salvo de novo com o mesmo nome, então grava');
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, origem_id, ligacao, criado_por) values
  ('judicial', 'R1', auth.uid(), '{14430000-0000-0000-0000-000000000001}', '{"14430000-0000-0000-0000-000000000001": "outro"}',
   '{"14430000-0000-0000-0000-000000000001": "Inventariante"}', '74430000-0000-0000-0000-000000000002', 'recurso', auth.uid()) $$,
  'Quando nasce um recurso do B1, com o nome copiado, então grava');
select is(pg_temp.escritos('R1'), '{"14430000-0000-0000-0000-000000000001": "Inventariante"}'::jsonb, 'E o recurso tem o nome');
select lives_ok($$ update public.processos set clientes = '{14430000-0000-0000-0000-000000000002}', papeis_clientes = '{"14430000-0000-0000-0000-000000000002": "autor"}'
  where id = '74430000-0000-0000-0000-000000000002' $$, 'Quando tira do B1 o cliente Inventariante, então grava');
select is(pg_temp.escritos('B1'), '{}'::jsonb, 'E o nome dele sai do processo');
select lives_ok($$ update public.processos set clientes = '{14430000-0000-0000-0000-000000000002,14430000-0000-0000-0000-000000000001}',
  papeis_clientes = '{"14430000-0000-0000-0000-000000000001": "outro", "14430000-0000-0000-0000-000000000002": "autor"}',
  papeis_escritos = '{"14430000-0000-0000-0000-000000000001": "Inventariante"}' where id = '74430000-0000-0000-0000-000000000002' $$,
  'Quando o Desfazer devolve o cliente com o nome, então grava');
select is(pg_temp.escritos('B1'), '{"14430000-0000-0000-0000-000000000001": "Inventariante"}'::jsonb, 'E o nome volta ao processo');
reset role;
select is(pg_temp.lista_da_ana(), '{Curador}'::text[], 'E em nenhum desses casos o nome volta à lista');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.processo_papeis_incluir(array['Inventariante']) $$, 'Quando a Ana devolve o papel à lista (o Desfazer), então volta');
select lives_ok($$ select public.processo_papeis_incluir(array[' inventariante ']) $$, 'Quando devolve de novo, com outra grafia, então nada muda');
reset role;
select is(pg_temp.lista_da_ana(), '{Curador,Inventariante}'::text[], 'E a lista tem o nome uma vez só');
select is((select criado_por from public.processo_papeis where escritorio_id = 'e4430000-0000-0000-0000-000000000001' and nome = 'Inventariante'),
  'a4430000-0000-0000-0000-000000000001'::uuid, 'E quem pôs o nome é quem está logado');

-- ---------- um escritório não vê nem escreve nos papéis do outro ----------
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.processo_papeis where escritorio_id = 'e4430000-0000-0000-0000-000000000001'), 0::bigint,
  'Dado o Davi, master de outro escritório, quando lê a lista, então não vê os papéis da Ana');
select throws_ok($$ insert into public.processo_papeis (escritorio_id, nome) values ('e4430000-0000-0000-0000-000000000001', 'Tutor') $$, '42501', null,
  'Quando ele põe um papel direto na lista da Ana, então recusa');
select is(pg_temp.mudados($$ delete from public.processo_papeis where escritorio_id = 'e4430000-0000-0000-0000-000000000001' $$), 0::bigint,
  'Quando ele tenta apagar a lista da Ana, então nada sai');
select throws_ok($$ insert into public.processos (escritorio_id, tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('e4430000-0000-0000-0000-000000000001', 'judicial', 'D0', auth.uid(), '{14430000-0000-0000-0000-000000000001}',
   '{"14430000-0000-0000-0000-000000000001": "outro"}', '{"14430000-0000-0000-0000-000000000001": "Tutor"}', auth.uid()) $$, null, null,
  'Quando ele grava um processo com o escritório da Ana, então recusa');
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, papeis_clientes, papeis_escritos, criado_por) values
  ('judicial', 'D1', auth.uid(), '{14430000-0000-0000-0000-000000000004}', '{"14430000-0000-0000-0000-000000000004": "outro"}',
   '{"14430000-0000-0000-0000-000000000004": "inventariante"}', auth.uid()) $$, 'Quando o Davi escreve inventariante num processo dele, então grava');
select is((select papeis_escritos from public.processos where numero = 'D1'), '{"14430000-0000-0000-0000-000000000004": "inventariante"}'::jsonb,
  'E o nome fica na grafia dele, e não na da lista da Ana');
select lives_ok($$ select public.processo_papeis_incluir(array['inventariante', 'Tutor']) $$, 'Quando a tela põe os nomes dele na lista, então aceita');
select is((select array_agg(nome order by nome) from public.processo_papeis), '{inventariante,Tutor}'::text[], 'E eles vão para a lista do escritório dele');
reset role;
select is(pg_temp.lista_da_ana(), '{Curador,Inventariante}'::text[], 'E a lista da Ana não muda');

select * from finish();
rollback;
