-- Polo do cliente nos processos criminais (#289). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório e um processo de cada polo antigo, gravados direto (sem os gatilhos de cadastro; a regra do polo vale
-- do mesmo jeito, porque é uma regra da coluna, e não um gatilho).
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-polo-criminal', '{"pessoas": true}');
set local session_replication_role = replica;
create function pg_temp.gravar(p_numero text, p_polo text) returns void language sql as $$
  insert into public.processos (escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por, polo) values
    ('e0000000-0000-0000-0000-000000000001', 'PR' || p_numero, 'judicial', p_numero, 'a0000000-0000-0000-0000-000000000001',
     '{10000000-0000-0000-0000-000000000001}', 'a0000000-0000-0000-0000-000000000001', p_polo)
$$;

-- Quando grava os polos de antes, então o banco continua aceitando
select lives_ok($$ select pg_temp.gravar('1', 'autor') $$, 'dado o polo autor, quando grava, então aceita');
select lives_ok($$ select pg_temp.gravar('2', 'reu') $$, 'dado o polo réu, quando grava, então aceita');
select lives_ok($$ select pg_temp.gravar('3', 'terceiro') $$, 'dado o polo terceiro, quando grava, então aceita');
select lives_ok($$ select pg_temp.gravar('4', null) $$, 'dado o polo não informado, quando grava, então aceita');

-- Quando grava os polos novos, então o banco aceita
select lives_ok($$ select pg_temp.gravar('5', 'vitima') $$, 'dado o polo vítima, quando grava, então aceita');
select lives_ok($$ select pg_temp.gravar('6', 'investigado') $$, 'dado o polo investigado, quando grava, então aceita');
select lives_ok($$ select pg_temp.gravar('7', 'apenado') $$, 'dado o polo apenado, quando grava, então aceita');

-- Quando muda um processo de investigado para réu, então o banco aceita
select lives_ok($$ update public.processos set polo = 'reu' where numero = '6' and escritorio_id = 'e0000000-0000-0000-0000-000000000001' $$,
  'dado um processo com o polo investigado, quando muda para réu, então aceita');
select is((select polo from public.processos where numero = '6' and escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 'reu',
  'e o processo fica com o polo réu');

-- Quando grava um polo fora da lista, então o banco recusa
select throws_ok($$ select pg_temp.gravar('8', 'testemunha') $$, '23514', null, 'dado um polo fora da lista, quando grava, então recusa');
select throws_ok($$ select pg_temp.gravar('9', 'Vítima') $$, '23514', null, 'dado o nome mostrado na tela no lugar do código, quando grava, então recusa');

select * from finish();
rollback;
