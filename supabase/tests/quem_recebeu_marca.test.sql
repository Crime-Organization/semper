-- Quem marca o pagamento a participante ou indicador é quem recebeu o dinheiro (#249). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Dado um escritório com o administrador, o responsável antigo, o novo e uma colega, e outro escritório com o seu administrador.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-marca'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-marca-outro');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'antigo@exemplo.test', 'Antigo', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'novo@exemplo.test', 'Novo', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'colega@exemplo.test', 'Colega', 'usuario', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'outro@exemplo.test', 'Outro', 'master', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'antigo@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'novo@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'colega@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'outro@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now());

-- E um contrato que hoje é do novo responsável, com três recebimentos e um participante: o de antes da troca, o de depois, e o de um perfil
-- removido. Os gatilhos e as chaves pedem o caixa inteiro; aqui só importam as linhas.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE DE TESTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'NO12', 2026, 'NO12-0001-2026', '10000000-0000-0000-0000-000000000001',
   'CLIENTE DE TESTE', 'a0000000-0000-0000-0000-000000000003', 'Serviço', 'pro_labore');
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor)
  select ('d0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', n, date '2026-03-10', 100000
  from generate_series(1, 3) as n;
insert into public.financeiro_recebimentos (id, escritorio_id, parcela_id, contrato_id, responsavel_id, conta_id, data, valor, taxa_maquina, aliquota_das, parte_na_conta,
    responsavel_socio, na_conta, ficou_com_advogado, das, liquido, escritorio, responsavel_recebe, responsavel_fica, escritorio_final, contribuicao_socio, terceiros, lancamento_id)
  select ('f0000000-0000-0000-0000-00000000000' || q.n)::uuid, 'e0000000-0000-0000-0000-000000000001', ('d0000000-0000-0000-0000-00000000000' || q.n)::uuid,
         'c0000000-0000-0000-0000-000000000001', q.responsavel, gen_random_uuid(), date '2026-03-10', 100000, 0, 4.5, 30, false, 30000, 70000, 0, 100000, 20000, 0, 70000, 20000, 0,
         jsonb_build_array(jsonb_build_object('id', '10000000-0000-0000-0000-000000000002', 'nome', 'PARTICIPANTE', 'valor', 10000, 'papel', 'participante')), gen_random_uuid()
  from (values (1, 'a0000000-0000-0000-0000-000000000002'::uuid), (2, 'a0000000-0000-0000-0000-000000000003'::uuid), (3, null::uuid)) as q(n, responsavel);
-- E um quarto, recebido pelo responsável antigo, que também é o participante dele: não passa nada a si mesmo, nem depois de perder o contrato.
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor)
  values ('d0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 4, date '2026-03-10', 100000);
insert into public.financeiro_recebimentos (id, escritorio_id, parcela_id, contrato_id, responsavel_id, conta_id, data, valor, taxa_maquina, aliquota_das, parte_na_conta,
    responsavel_socio, na_conta, ficou_com_advogado, das, liquido, escritorio, responsavel_recebe, responsavel_fica, escritorio_final, contribuicao_socio, terceiros, lancamento_id)
  select 'f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
         'c0000000-0000-0000-0000-000000000001', f.id, gen_random_uuid(), date '2026-03-10', 100000, 0, 4.5, 30, false, 30000, 70000, 0, 100000, 20000, 0, 70000, 20000, 0,
         jsonb_build_array(jsonb_build_object('id', f.pessoa_id, 'nome', 'ANTIGO', 'valor', 10000, 'papel', 'participante')), gen_random_uuid()
  from public.perfis f where f.id = 'a0000000-0000-0000-0000-000000000002' and f.pessoa_id is not null;
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

-- O token de cada pessoa, e o que ela vê da lista "A passar" em cada recebimento.
create function pg_temp.entra(p_numero integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_numero, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_numero)::text, true);
end $$;
create function pg_temp.ve(p_numero integer) returns bigint language sql as $$
  select count(*) from jsonb_array_elements(public.financeiro_a_passar('2026-03-01', '2026-03-31')) as e(item)
  where e.item ->> 'recebimento_id' = 'f0000000-0000-0000-0000-00000000000' || p_numero
$$;
create function pg_temp.pago_em(p_numero integer) returns date language sql as $$
  select (e.item ->> 'pago_em')::date from jsonb_array_elements(public.financeiro_a_passar('2026-03-01', '2026-03-31')) as e(item)
  where e.item ->> 'recebimento_id' = 'f0000000-0000-0000-0000-00000000000' || p_numero
$$;
create function pg_temp.quem_paga(p_numero integer) returns text language sql as $$
  select e.item ->> 'quem_paga' from jsonb_array_elements(public.financeiro_a_passar('2026-03-01', '2026-03-31')) as e(item)
  where e.item ->> 'recebimento_id' = 'f0000000-0000-0000-0000-00000000000' || p_numero
$$;
grant execute on function pg_temp.entra(integer), pg_temp.ve(integer), pg_temp.pago_em(integer), pg_temp.quem_paga(integer) to authenticated;
set local role authenticated;

-- O responsável da época, depois de perder o contrato.
select pg_temp.entra(2);
select is(pg_temp.ve(1), 1::bigint, 'dado o recebimento de antes da troca, quando o responsável da época abre, então a linha aparece');
select is(pg_temp.ve(2), 0::bigint, 'dado o recebimento de depois da troca, quando o responsável da época abre, então a linha não aparece');
select lives_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-03-20')$$,
  'quando o responsável da época marca como pago, então o banco aceita');
select is(pg_temp.pago_em(1), date '2026-03-20', 'então a linha fica paga, com a data');
select lives_ok($$select public.financeiro_terceiro_desfazer_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')$$,
  'quando o responsável da época desfaz, então o banco aceita');
select is(pg_temp.pago_em(1), null::date, 'então a linha fica sem data de pagamento');
select is(pg_temp.ve(1), 1::bigint, 'então a linha continua na lista, a pagar');
select throws_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-03-20')$$,
  '42501', null, 'quando o responsável da época tenta marcar o recebimento de depois, então é recusado');
select throws_ok($$select public.financeiro_estornar('f0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'quando o responsável da época tenta estornar, então continua recusado: quem estorna não mudou');
select is(pg_temp.quem_paga(1), 'Antigo', 'dado o recebimento de antes da troca, quando o responsável da época abre, então quem paga é ele');
select is(pg_temp.ve(4), 0::bigint, 'dado que ele também é o participante do próprio recebimento, quando abre, então não há o que passar a si mesmo');
select is((select count(*) from public.financeiro_recebimentos), 0::bigint, 'dado que ele já não cuida do contrato, quando lê a tabela direto, então não vê os recebimentos');
select throws_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000004', (select pessoa_id from public.perfis where id = auth.uid()), '2026-03-20')$$,
  'P0001', 'Esta pessoa não recebe nada deste recebimento.', 'quando ele tenta marcar um pagamento a si mesmo, então é recusado');

-- O novo responsável.
select pg_temp.entra(3);
select is(pg_temp.ve(1), 0::bigint, 'dado o recebimento de antes da troca, quando o novo responsável abre, então a linha não aparece');
select throws_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-03-20')$$,
  '42501', 'Só quem recebeu o dinheiro ou um administrador marca este valor como pago.', 'quando o novo responsável tenta marcar por fora da tela, então é recusado');
select throws_ok($$select public.financeiro_terceiro_desfazer_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'quando o novo responsável tenta desfazer por fora da tela, então é recusado');
select is(pg_temp.ve(2), 1::bigint, 'dado o recebimento de depois da troca, quando o novo responsável abre, então a linha aparece');
select is(pg_temp.quem_paga(2), 'Novo', 'dado o recebimento de depois da troca, quando o novo responsável abre, então quem paga é ele');
select lives_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-03-20')$$,
  'quando o novo responsável marca o recebimento de depois, então o banco aceita');

-- O administrador.
select pg_temp.entra(1);
select is(pg_temp.ve(1) + pg_temp.ve(2) + pg_temp.ve(3), 3::bigint, 'quando o administrador abre, então vê os três recebimentos');
select is(pg_temp.quem_paga(1), 'Antigo', 'dado o recebimento de antes da troca, quando o administrador abre, então quem paga é o responsável da época, não o atual');
select is(pg_temp.quem_paga(2), 'Novo', 'dado o recebimento de depois da troca, quando o administrador abre, então quem paga é o novo responsável');
select is(pg_temp.quem_paga(3), 'Usuário removido', 'dado o recebimento sem perfil, quando o administrador abre, então quem paga é "Usuário removido"');
select lives_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-03-21')$$,
  'quando o administrador marca o recebimento de antes da troca, então o banco aceita');
select lives_ok($$select public.financeiro_terceiro_desfazer_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')$$,
  'quando o administrador desfaz, então o banco aceita');
select is(pg_temp.pago_em(1), null::date, 'então a marcação do administrador sai');
select is(pg_temp.ve(1), 1::bigint, 'então a linha continua na lista do administrador');
select is(pg_temp.ve(4), 0::bigint, 'dado o responsável da época que também é o participante, quando o administrador abre, então a linha não aparece');
select lives_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '2026-03-22')$$,
  'dado o responsável da época removido, quando o administrador marca, então o banco aceita');
select is(pg_temp.pago_em(3), date '2026-03-22', 'então a linha do responsável removido fica paga');

-- O novo responsável continua podendo estornar, e a recusa diz a quem pedir, porque ele não desfaz a marcação do recebimento antigo.
select lives_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-03-21')$$,
  'dado o administrador que marca de novo o recebimento de antes da troca, então o banco aceita');
select pg_temp.entra(3);
select throws_ok($$select public.financeiro_estornar('f0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Há valor já marcado como pago a participante ou indicador deste recebimento. É preciso desfazer a marcação antes. Peça a quem recebeu o dinheiro ou a um administrador.',
  'quando o novo responsável tenta estornar um recebimento com marcação, então a recusa diz a quem pedir');

-- Quem não recebeu: sem responsável gravado, a comparação daria nulo, e a recusa não pode depender dela.
select pg_temp.entra(4);
select is(pg_temp.ve(1) + pg_temp.ve(2) + pg_temp.ve(3), 0::bigint, 'quando a colega abre, então não vê nenhum recebimento');
select throws_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-03-20')$$,
  '42501', null, 'quando a colega tenta marcar, então é recusado');
select throws_ok($$select public.financeiro_terceiro_desfazer_pago('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'dado o responsável removido, quando a colega tenta desfazer, então é recusado');
select throws_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '2026-03-23')$$,
  '42501', null, 'dado o responsável removido, quando a colega tenta marcar, então é recusado');

-- O administrador de outro escritório.
select pg_temp.entra(5);
select is(pg_temp.ve(1) + pg_temp.ve(2) + pg_temp.ve(3), 0::bigint, 'quando o administrador de outro escritório abre, então não vê nada');
select throws_ok($$select public.financeiro_terceiro_marcar_pago('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-03-20')$$,
  '42501', null, 'quando o administrador de outro escritório tenta marcar, então é recusado');
select throws_ok($$select public.financeiro_terceiro_desfazer_pago('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'quando o administrador de outro escritório tenta desfazer, então é recusado');

reset role;
select * from finish();
rollback;
