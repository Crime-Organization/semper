-- O contrato importado guarda o ano da assinatura; o criado pela tela fica com o ano atual (#216). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Dado um escritório com um advogado que tem CPF, conectado, e um cliente.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-ano-do-contrato');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'advogada@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'advogada@exemplo.test', '{"convite":"c1"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', now(), now());
insert into public.pessoas (id, escritorio_id, tipo, nome, documento) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Ana', '52998224725'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Cliente', '11144477735');
update public.perfis set pessoa_id = 'b0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000001';

create function pg_temp.importar(p_ano integer) returns text language sql as $$
  insert into public.contratos (escritorio_id, ano, numero, sigla, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria)
  values ('e0000000-0000-0000-0000-000000000001', p_ano, 1, 'XX00', 'XX00-0000-0000', 'b0000000-0000-0000-0000-000000000002', '',
          'a0000000-0000-0000-0000-000000000001', 'Serviço', 'pro_labore')
  returning codigo
$$;
create function pg_temp.ano_atual() returns text language sql stable as $$
  select extract(year from now() at time zone 'America/Sao_Paulo')::text
$$;

-- Quando a importação informa 2024, então o código termina em 2024.
select is(pg_temp.importar(2024), 'AN25-0001-2024', 'O contrato importado de 2024 tem o código desse ano');
-- Quando vem outro do mesmo ano, então segue a numeração daquele ano.
select is(pg_temp.importar(2024), 'AN25-0002-2024', 'O segundo de 2024 recebe o número seguinte');
-- Quando vem de outro ano, então a numeração é separada.
select is(pg_temp.importar(2023), 'AN25-0001-2023', 'Cada ano tem a sua numeração');
-- Quando a importação não informa o ano, então vale o ano atual.
select is(pg_temp.importar(null), 'AN25-0001-' || pg_temp.ano_atual(), 'Sem ano informado, vale o ano atual');

-- Quando alguém logado grava pelo site, mesmo pedindo outro ano, então vale o ano atual.
grant usage on schema extensions to authenticated;
grant execute on function pg_temp.ano_atual() to authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal1',
  'session_id', '50000000-0000-0000-0000-00000000000a')::text, true);
set local role authenticated;
insert into public.contratos (escritorio_id, cliente_id, responsavel_id, servico, categoria, criado_por)
  values ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Pela tela', 'pro_labore',
          'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (escritorio_id, ano, numero, sigla, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria, criado_por)
  values ('e0000000-0000-0000-0000-000000000001', 2024, 1, 'XX00', 'XX00-0000-0000', 'b0000000-0000-0000-0000-000000000002', '',
          'a0000000-0000-0000-0000-000000000001', 'Pedindo 2024', 'pro_labore', 'a0000000-0000-0000-0000-000000000001');
select is((select ano::text from public.contratos where servico = 'Pela tela'), pg_temp.ano_atual(), 'Pela tela, o contrato fica com o ano atual');
select is((select ano::text from public.contratos where servico = 'Pedindo 2024'), pg_temp.ano_atual(), 'Pela tela, não dá para escolher outro ano');
select is((select right(codigo, 4) from public.contratos where servico = 'Pedindo 2024'), pg_temp.ano_atual(), 'O código de quem pediu outro ano termina no ano atual');

select * from finish();
rollback;
