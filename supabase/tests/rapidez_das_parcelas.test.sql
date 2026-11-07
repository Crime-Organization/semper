-- As regras mais rápidas das parcelas e dos recebimentos mostram o mesmo que antes. Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Dado um escritório com o administrador, a responsável e um colega, e outro escritório com o seu administrador.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-rapidez'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-rapidez-outro');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'resp@exemplo.test', 'Responsavel', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'colega@exemplo.test', 'Colega', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'outro@exemplo.test', 'Outro', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'resp@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'colega@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'outro@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 4) as n;

-- E um contrato da responsável, com duas parcelas e um recebimento.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'RE12', 2026, 'RE12-0001-2026', '10000000-0000-0000-0000-000000000001',
   'CLIENTE', 'a0000000-0000-0000-0000-000000000002', 'Serviço', 'pro_labore', 'a0000000-0000-0000-0000-000000000001');
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor)
  select ('d0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', n, date '2026-03-10', 100000
  from generate_series(1, 2) as n;
insert into public.financeiro_recebimentos (id, escritorio_id, parcela_id, contrato_id, responsavel_id, conta_id, data, valor, taxa_maquina, aliquota_das, parte_na_conta,
    responsavel_socio, na_conta, ficou_com_advogado, das, liquido, escritorio, responsavel_recebe, responsavel_fica, escritorio_final, contribuicao_socio, terceiros, lancamento_id)
  values ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002', gen_random_uuid(), date '2026-03-10', 100000, 0, 4.5, 30, false, 30000, 70000, 0, 100000, 30000, 0, 70000, 30000, 0, '[]', gen_random_uuid());
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entra(p_numero integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_numero, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_numero)::text, true);
end $$;
-- Quantas linhas a mudança alcança: a regra some com as que a pessoa não pode alterar.
create function pg_temp.mudou() returns bigint language sql as $$
  with m as (update public.contrato_parcelas set valor = valor where contrato_id = 'c0000000-0000-0000-0000-000000000001' returning 1) select count(*) from m
$$;
grant execute on function pg_temp.entra(integer), pg_temp.mudou() to authenticated;
set local role authenticated;

select pg_temp.entra(1);
select is((select count(*) from public.contrato_parcelas), 2::bigint, 'quando o administrador lê as parcelas, então vê as do escritório');
select is((select count(*) from public.financeiro_recebimentos), 1::bigint, 'quando o administrador lê os recebimentos, então vê os do escritório');
select is(pg_temp.mudou(), 2::bigint, 'quando o administrador muda as parcelas, então alcança todas');

select pg_temp.entra(2);
select is((select count(*) from public.contrato_parcelas), 2::bigint, 'quando a responsável lê as parcelas, então vê as do contrato dela');
select is((select count(*) from public.financeiro_recebimentos), 1::bigint, 'quando a responsável lê os recebimentos, então vê os do contrato dela');
select is(pg_temp.mudou(), 2::bigint, 'quando a responsável muda as parcelas do contrato dela, então alcança todas');

select pg_temp.entra(3);
select is((select count(*) from public.contrato_parcelas), 0::bigint, 'quando um colega lê as parcelas, então não vê as de contrato alheio');
select is((select count(*) from public.financeiro_recebimentos), 0::bigint, 'quando um colega lê os recebimentos, então não vê os de contrato alheio');
select is(pg_temp.mudou(), 0::bigint, 'quando um colega tenta mudar as parcelas, então nada muda');

select pg_temp.entra(4);
select is((select count(*) from public.contrato_parcelas), 0::bigint, 'quando o administrador de outro escritório lê as parcelas, então não vê nada');
select is((select count(*) from public.financeiro_recebimentos), 0::bigint, 'quando o administrador de outro escritório lê os recebimentos, então não vê nada');
select is(pg_temp.mudou(), 0::bigint, 'quando o administrador de outro escritório tenta mudar, então nada muda');

reset role;
select * from finish();
rollback;
