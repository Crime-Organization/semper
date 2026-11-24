-- Separar um objeto de contrato em dois ou mais (#410). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi (master) em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-separar-objeto', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-separar-objeto-2', '{"pessoas": true}');
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

-- Os contratos entram como na importação, sem os gatilhos.
-- K1: assinado, com "Marca e patente" (dois serviços num nome só) e o "A definir", e a demanda do objeto.
-- K2: assinado, com "Marca e patente" e "Patente"; a demanda de "Marca e patente" tem outro título, e há a demanda da Patente.
-- K3: arquivado, com "Parecer" e "Marca e patente", sem demanda. K9: do outro escritório, com "Marca e patente".
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000004');
create function pg_temp.assinado(p_escritorio uuid) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'contratos' and marco = 'assinado'
$$;
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, criado_por, etapa_id, arquivado_em) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Marca e patente; A definir', '{Marca e patente,A definir}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', pg_temp.assinado('e0000000-0000-0000-0000-000000000001'), null),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AN26', 2026, 'AN26-0002-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Marca e patente; Patente', '{Marca e patente,Patente}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', pg_temp.assinado('e0000000-0000-0000-0000-000000000001'), null),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 3, 'AN26', 2026, 'AN26-0003-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Parecer; Marca e patente', '{Parecer,Marca e patente}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', pg_temp.assinado('e0000000-0000-0000-0000-000000000001'), now()),
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 1, 'DA26', 2026, 'DA26-0001-2026', '10000000-0000-0000-0000-000000000009', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000004', 'Marca e patente', '{Marca e patente}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000004', null, null);
insert into privado.contratos_com_demandas (contrato_id) values
  ('c0000000-0000-0000-0000-000000000001'), ('c0000000-0000-0000-0000-000000000002'), ('c0000000-0000-0000-0000-000000000003');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, clientes, contrato_id, contrato_codigo, objeto, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Marca e patente', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000001', 'AN26-0001-2026', 'Marca e patente', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Registro do logotipo', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000002', 'AN26-0002-2026', 'Marca e patente', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Patente', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000002', 'AN26-0002-2026', 'Patente', 'a0000000-0000-0000-0000-000000000001');
insert into public.lista_modelos (escritorio_id, nome, itens, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', 'Marca e patente', '{Busca prévia,Depósito}', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Acha o id como o banco (sem as regras de leitura), para testar também o id de outro escritório.
create function pg_temp.objeto(p_escritorio uuid, p_descricao text) returns uuid language sql security definer as $$
  select id from public.objeto_sugestoes where escritorio_id = p_escritorio and descricao = p_descricao
$$;
create function pg_temp.objetos_de(p_contrato uuid) returns text language sql as $$
  select array_to_string(objetos, ' | ') || ' / ' || servico from public.contratos where id = p_contrato
$$;
grant execute on function pg_temp.objeto(uuid, text) to authenticated;
-- A escolha da tela: D1 fica com "Registro de marca", D2 com "Patente".
create function pg_temp.escolhas() returns jsonb language sql as $$
  select '[{"demanda": "71000000-0000-0000-0000-000000000001", "objeto": "Registro de marca"},
           {"demanda": "71000000-0000-0000-0000-000000000002", "objeto": "patente"}]'::jsonb
$$;
grant execute on function pg_temp.escolhas() to authenticated;

-- A lista do escritório ganha os objetos dos contratos quando a Ana a abre.
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select * from public.objetos_do_escritorio() $$, 'A Ana abre a lista');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ select * from public.objetos_do_escritorio() $$, 'O Davi abre a lista dele');
reset role;

-- ---------- quem pode ----------
-- Quando a Bia (não é administradora) pede as demandas do objeto ou tenta separar, então é recusado
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select * from public.demandas_do_objeto(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente')) $$,
  'P0001', 'Você não tem permissão para fazer isso.', 'Quem não é administrador não vê as demandas do objeto');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Marca', 'Patente'], pg_temp.escolhas()) $$,
  'P0001', 'Você não tem permissão para fazer isso.', 'Quem não é administrador não separa');
reset role;
-- Quando o Davi (outro escritório) tenta com o objeto do primeiro, então não o acha
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ select * from public.demandas_do_objeto(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente')) $$,
  'P0001', 'Objeto não encontrado.', 'Não se veem as demandas do objeto de outro escritório');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Marca', 'Patente'], pg_temp.escolhas()) $$,
  'P0001', 'Objeto não encontrado.', 'Não se separa objeto de outro escritório');
reset role;

-- ---------- as demandas do objeto ----------
-- Quando a Ana pede as demandas de "Marca e patente", então vêm as duas, com o número do contrato
select pg_temp.entrar(1); set local role authenticated;
select results_eq(
  $$ select codigo, titulo, contrato_codigo from public.demandas_do_objeto(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente')) $$,
  $$ values ('D1', 'Marca e patente', 'AN26-0001-2026'), ('D2', 'Registro do logotipo', 'AN26-0002-2026') $$,
  'As demandas do objeto, para a tela perguntar');

-- ---------- os nomes e as escolhas ----------
-- Quando a Ana separa com um nome só, nomes repetidos, "A definir", um nome longo, ou sem escolher o objeto de cada demanda, então é recusado
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Marca', '  '], pg_temp.escolhas()) $$,
  'P0001', 'Escreva ao menos dois nomes para separar.', 'Um nome só é recusado');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Marca', ' MARCA '], pg_temp.escolhas()) $$,
  'P0001', 'Os nomes novos não podem se repetir.', 'Nomes repetidos são recusados');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Marca', 'a definir'], pg_temp.escolhas()) $$,
  'P0001', '"A definir" não pode ser o nome de um objeto.', '"A definir" é recusado');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Marca', repeat('x', 301)], pg_temp.escolhas()) $$,
  'P0001', 'O objeto pode ter até 300 caracteres.', 'Nome longo é recusado');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Registro de marca', 'Patente'],
  '[{"demanda": "71000000-0000-0000-0000-000000000001", "objeto": "Registro de marca"}]'::jsonb) $$,
  'P0001', 'Escolha o objeto novo de cada demanda.', 'Falta a escolha de uma demanda');
select throws_ok($$ select public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Registro de marca', 'Desenho'], pg_temp.escolhas()) $$,
  'P0001', 'Escolha o objeto novo de cada demanda.', 'A escolha precisa ser um dos nomes novos');
reset role;
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000001'), 'Marca e patente | A definir / Marca e patente; A definir', 'O recusado não mudou nada');

-- ---------- separar ----------
-- Quando a Ana separa "Marca e patente" em "Registro de marca" e " patente " (já na lista como "Patente"), com D1 em Registro
-- de marca e D2 em Patente, então cada contrato tem os objetos novos no lugar do antigo, as demandas mudam de objeto sem
-- perder nada, e nenhuma demanda nasce
select pg_temp.entrar(1); set local role authenticated;
select is(public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente'), array['Registro de marca', ' patente ', ''], pg_temp.escolhas()),
  '{"contratos": 3, "demandas": 2, "modelos": 0, "modelos_sem_objeto": 1, "contratos_com_duas_demandas": 1}'::jsonb, 'A separação diz o que mudou');
reset role;
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000001'), 'Registro de marca | Patente | A definir / Registro de marca; Patente; A definir',
  'O contrato tem os objetos novos, no lugar do antigo');
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000002'), 'Registro de marca | Patente / Registro de marca; Patente',
  'O contrato que já tinha "Patente" fica com uma só');
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000003'), 'Parecer | Registro de marca | Patente / Parecer; Registro de marca; Patente',
  'O contrato arquivado também');
select is((select string_agg(codigo || ': ' || titulo || '=' || objeto, ', ' order by codigo) from public.demandas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'D1: Registro de marca=Registro de marca, D2: Registro do logotipo=Patente, D3: Patente=Patente',
  'Cada demanda passa ao objeto escolhido; o título reescrito fica');
select is((select count(*) from public.demandas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 3::bigint,
  'Nenhuma demanda nasceu nem sumiu (nem no contrato assinado com "A definir")');
select is((select alteracoes -> 'servico' ->> 'para' from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000001' order by id desc limit 1),
  'Registro de marca; Patente; A definir', 'O histórico do contrato guarda a separação');
select ok(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Marca e patente') is null
  and pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro de marca') is not null, 'A lista tem os nomes novos, e não o antigo');
select is((select count(*) from public.objeto_sugestoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and lower(descricao) = 'patente'), 1::bigint,
  'O nome que já estava na lista não se repete');
select ok(exists (select 1 from public.lista_modelos where nome = 'Marca e patente'), 'O modelo de checklist com o nome antigo fica, para a pessoa conferir');
-- E o outro escritório não muda
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000009'), 'Marca e patente / Marca e patente', 'O contrato do outro escritório não mudou');
select ok(pg_temp.objeto('e0000000-0000-0000-0000-000000000002', 'Marca e patente') is not null, 'A lista do outro escritório não mudou');

-- Quando a Ana separa "Parecer" (sem demanda) em "Parecer" e "Consulta", então o nome antigo fica na lista e o contrato ganha os dois
select pg_temp.entrar(1); set local role authenticated;
select is(public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), array['Parecer', 'Consulta'], '[]'::jsonb) ->> 'contratos', '1',
  'Separar sem demandas não pede escolha');
reset role;
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000003'), 'Parecer | Consulta | Registro de marca | Patente / Parecer; Consulta; Registro de marca; Patente',
  'O contrato tem o nome antigo e o novo');
select ok(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer') is not null, 'O nome antigo que é um dos novos fica na lista');

-- Dado o contrato com "Parecer" e "Consulta", quando a Ana separa "Consulta" em "Consulta" e "Parecer" (os dois já estão nele),
-- então o contrato fica igual: não é contado, nem mexido
create temp table historico_antes on commit drop as
  select count(*) as n from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000003';
grant select on historico_antes to authenticated;
select pg_temp.entrar(1); set local role authenticated;
select is(public.objeto_separar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Consulta'), array['Consulta', 'Parecer'], '[]'::jsonb) ->> 'contratos', '0',
  'O contrato que fica igual não conta');
reset role;
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000003'), 'Parecer | Consulta | Registro de marca | Patente / Parecer; Consulta; Registro de marca; Patente',
  'O contrato não mudou');
select is((select count(*) from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000003'), (select n from historico_antes),
  'O histórico do contrato não ganhou mudança');

select * from finish();
rollback;
