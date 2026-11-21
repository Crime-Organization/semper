-- Data de início das negociações do contrato (#311). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master, responsável pelo contrato) e Bia (usuária comum, fora do contrato).
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-inicio-negociacoes', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- Então a coluna existe, vazia, e a view da equipe a traz no fim, depois dos grupos
select has_column('public', 'contratos', 'negociacao_inicio', 'O contrato tem a data de início das negociações');
select col_type_is('public', 'contratos', 'negociacao_inicio', 'date', 'É uma data');
select col_is_null('public', 'contratos', 'negociacao_inicio', 'Pode ficar vazia');
select is((select (array_agg(column_name::text order by ordinal_position desc))[1:2] from information_schema.columns
           where table_schema = 'public' and table_name = 'contratos_da_equipe'),
          array['negociacao_inicio', 'grupos'], 'A view traz a data no fim, e as colunas de antes continuam na mesma ordem');

-- Quando a Ana (responsável) informa a data, então ela fica gravada, aparece na view e entra no histórico
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ update public.contratos set negociacao_inicio = '2026-10-01' where id = 'c0000000-0000-0000-0000-000000000001' $$, 'Quem altera o contrato muda a data');
select is((select negociacao_inicio from public.contratos_da_equipe where id = 'c0000000-0000-0000-0000-000000000001'), '2026-10-01'::date, 'A view traz a data');
reset role;
select is((select alteracoes -> 'negociacao_inicio' ->> 'para' from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000001' order by em desc limit 1),
          '2026-10-01', 'A mudança entrou no histórico');

-- Quando a Bia (fora do contrato) tenta mudar, então nada muda
select pg_temp.entrar(2); set local role authenticated;
update public.contratos set negociacao_inicio = '2020-01-01' where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select negociacao_inicio from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'), '2026-10-01'::date, 'Quem não altera o contrato não muda a data');

select * from finish();
rollback;
