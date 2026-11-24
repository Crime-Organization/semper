-- LGPD: esquecer a pessoa também na cópia dos recebimentos excluídos (#412). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado dois escritórios: no primeiro, a Ana (administradora); no segundo, o Davi (administrador).
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-esquece-excluidos', '{"pessoas": true, "contratos": true, "financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-esquece-excluidos-2', '{"pessoas": true, "contratos": true, "financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 2) as n;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- E as pessoas, todas arquivadas (só a arquivada se exclui). No primeiro escritório: ANA LIMA e ANA LIMA SOUZA, as duas clientes
-- do contrato excluído; CARLA DIAS, indicadora (gravada com o nome antigo, CARLA ANTIGA, na cópia); BRUNO REIS, participante.
-- No segundo: outra ANA LIMA, cliente de um contrato excluído de lá.
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, arquivado_em, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'ANA LIMA', now(), 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'contato', 'ANA LIMA SOUZA', now(), 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'contato', 'CARLA DIAS', now(), 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'contato', 'BRUNO REIS', now(), 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'ANA LIMA', now(), 'a0000000-0000-0000-0000-000000000002');

-- E a cópia escondida de um recebimento excluído em cada escritório, como contratos_excluir a grava: o recebimento (com os
-- participantes e o indicador), o repasse ao indicador, a marcação de pago, o sócio e os lançamentos do Caixa.
insert into public.financeiro_excluidos (escritorio_id, contrato_id, contrato_codigo, cliente_nome, tipo, parcela_numero, data, valor, conta_nome, copia) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'AA11-0001-2030', 'ANA LIMA; ANA LIMA SOUZA', 'recebimento', 1,
   '2030-03-12', 100000, 'PJ', jsonb_build_object(
     'recebimento', jsonb_build_object('id', 'f0000000-0000-0000-0000-000000000001', 'valor', 100000, 'data', '2030-03-12',
       'terceiros', jsonb_build_array(jsonb_build_object('id', '10000000-0000-0000-0000-000000000004', 'nome', 'BRUNO REIS', 'valor', 5000)),
       'socio_indicador', jsonb_build_object('id', '10000000-0000-0000-0000-000000000003', 'nome', 'CARLA ANTIGA', 'valor', 2000)),
     'repasses', jsonb_build_array(jsonb_build_object('tipo', 'socio_indicador', 'pessoa_id', '10000000-0000-0000-0000-000000000003', 'nome', 'CARLA ANTIGA',
       'descricao', 'ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', 'valor', 2000, 'pago_em', '2030-03-15')),
     'terceiros_pagos', jsonb_build_array(jsonb_build_object('pessoa_id', '10000000-0000-0000-0000-000000000004', 'pago_em', '2030-03-15')),
     'socio', null,
     'lancamentos', jsonb_build_array(
       jsonb_build_object('descricao', 'Recebimento: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', 'valor', 100000, 'data', '2030-03-12'),
       jsonb_build_object('descricao', 'Repasse a CARLA DIAS: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', 'valor', 2000, 'data', '2030-03-15')))),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000009', 'AA11-0001-2030', 'ANA LIMA', 'recebimento', 1,
   '2030-03-12', 90000, 'PF', jsonb_build_object(
     'recebimento', jsonb_build_object('id', 'f0000000-0000-0000-0000-000000000009', 'valor', 90000, 'data', '2030-03-12', 'terceiros', '[]'::jsonb),
     'lancamentos', jsonb_build_array(jsonb_build_object('descricao', 'Recebimento: ANA LIMA (AA11-0001-2030, parcela 1)', 'valor', 90000))));
create temp table antes as select * from public.financeiro_excluidos;
grant select on antes to authenticated;
create function pg_temp.copia(p_escritorio int) returns jsonb language sql as $$
  select copia from public.financeiro_excluidos where escritorio_id = ('e0000000-0000-0000-0000-00000000000' || p_escritorio)::uuid
$$;

-- ===== A cliente =====
-- Quando a Ana exclui a cliente ANA LIMA
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ delete from public.pessoas where id = '10000000-0000-0000-0000-000000000001' $$, 'Quando a administradora exclui a cliente, então ela sai');
reset role;
-- Então o nome dela vira "pessoa excluída" na lista de clientes e nas descrições; a outra cliente, de nome parecido, continua
select is((select cliente_nome from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'pessoa excluída; ANA LIMA SOUZA', 'Então o nome dela sai da lista de clientes, e a outra cliente da mesma linha continua');
select is(pg_temp.copia(1) #>> '{lancamentos,0,descricao}', 'Recebimento: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)',
  'Então o nome dela sai da descrição do recebimento no Caixa');
select is(pg_temp.copia(1) #>> '{repasses,0,descricao}', 'pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)',
  'Então o nome dela sai da descrição do repasse');
select is(pg_temp.copia(1) #>> '{lancamentos,1,descricao}', 'Repasse a CARLA DIAS: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)',
  'Então o nome dela sai da descrição do pagamento do repasse, e o da indicadora continua');
select is((select count(*) from public.financeiro_excluidos where (cliente_nome || copia::text) ~ 'ANA LIMA($|[^ ]| [^S])'
           and escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0::bigint, 'Então o nome dela não fica em lugar nenhum da cópia');
-- E os participantes, valores e datas continuam
select is(pg_temp.copia(1) #>> '{recebimento,terceiros,0,nome}', 'BRUNO REIS', 'Então o participante continua');
select is((select (valor, data, parcela_numero, conta_nome, contrato_codigo)::text from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  '(100000,2030-03-12,1,PJ,AA11-0001-2030)', 'Então o valor, a data, a parcela, a conta e o código continuam');
select is(pg_temp.copia(1) #>> '{recebimento,valor}', '100000', 'Então o valor na cópia do recebimento continua');
-- E o outro escritório, com uma cliente de mesmo nome, não muda
select is((select (cliente_nome, copia)::text from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000002'),
  (select (cliente_nome, copia)::text from antes where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 'Então o outro escritório não muda');

-- ===== A indicadora, pelo código =====
-- Quando a Ana exclui a indicadora CARLA DIAS, que está na cópia com o nome antigo
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ delete from public.pessoas where id = '10000000-0000-0000-0000-000000000003' $$, 'Quando a administradora exclui a indicadora, então ela sai');
reset role;
-- Então o nome, também o antigo, sai de onde a cópia aponta para ela, e o nome atual sai do texto
select is(pg_temp.copia(1) #>> '{recebimento,socio_indicador,nome}', 'pessoa excluída', 'Então o nome antigo dela sai do indicador do recebimento');
select is(pg_temp.copia(1) #>> '{repasses,0,nome}', 'pessoa excluída', 'Então o nome antigo dela sai do repasse');
select is(pg_temp.copia(1) #>> '{lancamentos,1,descricao}', 'Repasse a pessoa excluída: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)',
  'Então o nome dela sai da descrição do pagamento do repasse');
select is((select count(*) from public.financeiro_excluidos where copia::text ~ 'CARLA'), 0::bigint, 'Então o nome dela não fica em lugar nenhum da cópia');
-- E o valor do repasse, a data do pagamento e o participante continuam
select is(pg_temp.copia(1) #>> '{repasses,0,valor}', '2000', 'Então o valor do repasse continua');
select is(pg_temp.copia(1) #>> '{repasses,0,pago_em}', '2030-03-15', 'Então a data do pagamento continua');
select is(pg_temp.copia(1) #>> '{recebimento,socio_indicador,valor}', '2000', 'Então o valor do indicador continua');
select is(pg_temp.copia(1) -> 'terceiros_pagos', (select copia -> 'terceiros_pagos' from antes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'Então a marcação de pago do participante continua');
select is(pg_temp.copia(1) #>> '{recebimento,terceiros,0,nome}', 'BRUNO REIS', 'Então o participante continua');

-- ===== O participante =====
-- Quando a Ana exclui o participante BRUNO REIS
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ delete from public.pessoas where id = '10000000-0000-0000-0000-000000000004' $$, 'Quando a administradora exclui o participante, então ele sai');
reset role;
-- Então o nome dele sai, e o valor dele continua
select is(pg_temp.copia(1) #> '{recebimento,terceiros,0}', '{"id": "10000000-0000-0000-0000-000000000004", "nome": "pessoa excluída", "valor": 5000}'::jsonb,
  'Então o nome do participante sai, e o valor dele continua');
select is((select cliente_nome from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'pessoa excluída; ANA LIMA SOUZA', 'Então a outra cliente continua');

-- ===== O outro escritório =====
-- Quando o Davi exclui a ANA LIMA do escritório dele
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ delete from public.pessoas where id = '10000000-0000-0000-0000-000000000009' $$, 'Quando o outro escritório exclui a cliente dele, então ela sai');
reset role;
-- Então só a cópia de lá muda
select is((select cliente_nome from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 'pessoa excluída',
  'Então o nome sai da cópia do escritório dela');
select is(pg_temp.copia(2) #>> '{lancamentos,0,descricao}', 'Recebimento: pessoa excluída (AA11-0001-2030, parcela 1)', 'Então o nome sai da descrição de lá');
select is((select cliente_nome from public.financeiro_excluidos where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'pessoa excluída; ANA LIMA SOUZA', 'Então a cópia do primeiro escritório não muda');

-- ===== Nome com ponto e parênteses =====
-- Dada a empresa EMPRESA (S.A.), cliente de outro contrato excluído junto com a EMPRESA (SXA), de nome quase igual
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, arquivado_em, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'EMPRESA (S.A.)', now(), 'a0000000-0000-0000-0000-000000000001');
insert into public.financeiro_excluidos (escritorio_id, contrato_id, contrato_codigo, cliente_nome, tipo, parcela_numero, data, valor, copia) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'AA11-0002-2030', 'EMPRESA (S.A.); EMPRESA (SXA)', 'parcela_importada', 1,
   '2020-03-10', 70000, '{"parcela": {"numero": 1, "recebido": 70000}}');
-- Quando a Ana exclui a empresa
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ delete from public.pessoas where id = '10000000-0000-0000-0000-000000000005' $$, 'Quando a administradora exclui a empresa, então ela sai');
reset role;
-- Então só o nome dela sai: o ponto e os parênteses do nome não casam com outro texto
select is((select cliente_nome from public.financeiro_excluidos where contrato_id = 'c0000000-0000-0000-0000-000000000002'),
  'pessoa excluída; EMPRESA (SXA)', 'Então o nome com ponto e parênteses sai, e o parecido continua');
select is((select (valor, data)::text from public.financeiro_excluidos where contrato_id = 'c0000000-0000-0000-0000-000000000002'),
  '(70000,2020-03-10)', 'Então o valor e a data da parcela importada continuam');

-- ===== Ninguém chama as funções pela tela =====
select is((select count(*) from information_schema.routine_privileges
            where routine_schema = 'privado' and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type = 'EXECUTE'
              and routine_name in ('nome_no_financeiro', 'copia_sem_a_pessoa', 'esquecer_pessoa_nos_excluidos')), 0::bigint,
  'As funções do esquecimento não são chamadas pela tela');

select * from finish();
rollback;
