-- Editar a lista de objetos de contrato (#281). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi (master) em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-editar-objetos', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-editar-objetos-2', '{"pessoas": true}');
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

-- Os contratos entram como na importação, sem os gatilhos: nenhum objeto está na lista do escritório ainda.
-- K1: assinado, com "Registro de marca" e o "A definir", e a demanda do objeto.
-- K2: assinado, com "Registro da marca" (o mesmo, escrito diferente) e "Oposição"; a demanda da Oposição tem outro título.
-- K3: arquivado, com os dois jeitos de escrever, e uma demanda de cada.
-- K4: "Parecer", sem demanda. K9: do outro escritório, com "Registro de marca".
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000004');
create function pg_temp.assinado(p_escritorio uuid) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'contratos' and marco = 'assinado'
$$;
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, criado_por, etapa_id, arquivado_em) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Registro de marca; A definir', '{Registro de marca,A definir}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', pg_temp.assinado('e0000000-0000-0000-0000-000000000001'), null),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AN26', 2026, 'AN26-0002-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Registro da marca; Oposição', '{Registro da marca,Oposição}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', pg_temp.assinado('e0000000-0000-0000-0000-000000000001'), null),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 3, 'AN26', 2026, 'AN26-0003-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Registro da marca; Registro de marca', '{Registro da marca,Registro de marca}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', pg_temp.assinado('e0000000-0000-0000-0000-000000000001'), now()),
  ('c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 4, 'AN26', 2026, 'AN26-0004-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Parecer', '{Parecer}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', null, null),
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 1, 'DA26', 2026, 'DA26-0001-2026', '10000000-0000-0000-0000-000000000009', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000004', 'Registro de marca', '{Registro de marca}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000004', null, null);
insert into privado.contratos_com_demandas (contrato_id) values
  ('c0000000-0000-0000-0000-000000000001'), ('c0000000-0000-0000-0000-000000000002'), ('c0000000-0000-0000-0000-000000000003');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, clientes, contrato_id, objeto, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Registro de marca', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000001', 'Registro de marca', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Registro da marca', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000002', 'Registro da marca', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Oposição ao pedido do concorrente', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000002', 'Oposição', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'D4', 'Registro da marca', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000003', 'Registro da marca', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'D5', 'Registro de marca', 'a0000000-0000-0000-0000-000000000001',
   '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000003', 'Registro de marca', 'a0000000-0000-0000-0000-000000000001');
insert into public.lista_modelos (escritorio_id, nome, itens, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', 'Oposição', '{Ler o pedido,Protocolar}', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', 'Registro da marca', '{Busca prévia,Depósito}', 'a0000000-0000-0000-0000-000000000001');
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

-- ---------- a lista ----------
-- Quando a Ana abre a lista, então os objetos dos contratos entram nela (sem o "A definir"), com os contratos ativos, os
-- arquivados e as demandas de cada um
select pg_temp.entrar(1); set local role authenticated;
select results_eq(
  $$ select descricao, contratos_ativos, contratos_arquivados, demandas from public.objetos_do_escritorio() $$,
  $$ values ('Oposição', 1, 0, 1), ('Parecer', 1, 0, 0), ('Registro da marca', 1, 1, 2), ('Registro de marca', 1, 1, 2) $$,
  'A lista traz cada objeto com quantos contratos e demandas o usam');
reset role;
select is((select count(*) from public.objeto_sugestoes where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 0::bigint,
  'A lista do outro escritório não mudou');

-- Quando a Bia (não é administradora) abre a lista ou tenta mudar, então é recusado
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select * from public.objetos_do_escritorio() $$, 'P0001', 'Você não tem permissão para fazer isso.', 'Quem não é administrador não vê a lista');
select throws_ok($$ select public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), 'Parecer jurídico') $$,
  'P0001', 'Você não tem permissão para fazer isso.', 'Quem não é administrador não corrige');
select throws_ok($$ select public.objeto_apagar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer')) $$,
  'P0001', 'Você não tem permissão para fazer isso.', 'Quem não é administrador não apaga');
-- E ninguém grava direto na lista
select throws_ok($$ update public.objeto_sugestoes set descricao = 'X' $$, '42501', null, 'A lista não se muda direto');
reset role;

-- Quando o Davi (outro escritório) abre a lista dele, então só vê os dele; e não mexe nos objetos do outro
select pg_temp.entrar(4); set local role authenticated;
select results_eq($$ select descricao, contratos_ativos from public.objetos_do_escritorio() $$, $$ values ('Registro de marca', 1) $$,
  'O outro escritório vê só a lista dele');
select throws_ok($$ select public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), 'Parecer jurídico') $$,
  'P0001', 'Objeto não encontrado.', 'Não se corrige objeto de outro escritório');
select throws_ok($$ select public.objetos_juntar(array[pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer')],
  pg_temp.objeto('e0000000-0000-0000-0000-000000000002', 'Registro de marca')) $$, 'P0001', 'Objeto não encontrado.', 'Não se junta objeto de outro escritório');
reset role;

-- ---------- corrigir o nome ----------
-- Quando a Ana corrige com um nome vazio, longo, "A definir" ou igual a outro da lista, então é recusado
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), '  ') $$,
  'P0001', 'Escreva o nome do objeto.', 'Nome vazio é recusado');
select throws_ok($$ select public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), repeat('x', 301)) $$,
  'P0001', 'O objeto pode ter até 300 caracteres.', 'Nome longo é recusado');
select throws_ok($$ select public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), 'a definir') $$,
  'P0001', '"A definir" não pode ser o nome de um objeto.', '"A definir" é recusado');
select throws_ok($$ select public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), ' oposicao ') $$,
  'P0001', 'Já existe um objeto com esse nome. Para unir os dois, marque-os e use Juntar.', 'Nome igual a outro da lista é recusado');

-- Quando a Ana corrige "Registro de marca" para "Registro de marca no INPI", então o nome muda na lista, nos contratos (o
-- arquivado também), nas demandas e no título delas; o contrato assinado com "A definir" não ganha demanda repetida
select is(public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro de marca'), ' Registro de marca no INPI '),
  '{"contratos": 2, "demandas": 2, "modelos": 0, "contratos_com_duas_demandas": 0}'::jsonb, 'A correção diz o que mudou');
reset role;
select ok(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro de marca no INPI') is not null
  and pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro de marca') is null, 'A lista tem o nome novo, e não o antigo');
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000001'), 'Registro de marca no INPI | A definir / Registro de marca no INPI; A definir', 'O contrato tem o nome novo');
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000003'), 'Registro da marca | Registro de marca no INPI / Registro da marca; Registro de marca no INPI',
  'O contrato arquivado também');
select is((select string_agg(titulo || '=' || objeto, ', ' order by codigo) from public.demandas where id in ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005')),
  'Registro de marca no INPI=Registro de marca no INPI, Registro de marca no INPI=Registro de marca no INPI', 'As demandas e os títulos delas acompanham');
select is((select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 1::bigint,
  'O contrato assinado com "A definir" não ganhou demanda repetida');
select is((select alteracoes -> 'servico' ->> 'para' from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000001' order by id desc limit 1),
  'Registro de marca no INPI; A definir', 'O histórico do contrato guarda a correção');
select is((select count(*) from public.objeto_sugestoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 4::bigint,
  'A correção não deixou o nome antigo nem um repetido na lista');
select is((select string_agg(objetos[1], ',') from public.contratos where id = 'c0000000-0000-0000-0000-000000000009'), 'Registro de marca',
  'O contrato do outro escritório não mudou');

-- Quando a Ana corrige "Oposição", então o modelo de lista de mesmo nome muda junto, e o título que já era outro fica
select pg_temp.entrar(1); set local role authenticated;
select is(public.objeto_renomear(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Oposição'), 'Oposição ao registro') ->> 'modelos', '1', 'O modelo mudou junto');
reset role;
select ok(exists (select 1 from public.lista_modelos where nome = 'Oposição ao registro'), 'O modelo de lista tem o nome novo');
select is((select titulo || '=' || objeto from public.demandas where id = '71000000-0000-0000-0000-000000000003'),
  'Oposição ao pedido do concorrente=Oposição ao registro', 'O título reescrito fica, e o objeto muda');

-- ---------- juntar ----------
-- Quando a Ana junta "Registro da marca" em "Registro de marca no INPI", então fica um só na lista e em cada contrato, as
-- demandas passam ao que ficou (as duas do contrato arquivado ficam), e o modelo do que saiu passa a ter o nome do que ficou
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select public.objetos_juntar(array[pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer')],
  pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer')) $$, 'P0001', 'Marque ao menos dois objetos para juntar.', 'Juntar um só é recusado');
select is(public.objetos_juntar(array[pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro da marca')],
  pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro de marca no INPI')),
  '{"contratos": 2, "demandas": 2, "modelos": 1, "contratos_com_duas_demandas": 1}'::jsonb, 'A junção diz o que mudou e quantos contratos ficaram com duas demandas');
reset role;
select is(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro da marca'), null, 'O que saiu não está mais na lista');
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000003'), 'Registro de marca no INPI / Registro de marca no INPI', 'O contrato que tinha os dois ficou com um só');
select is(pg_temp.objetos_de('c0000000-0000-0000-0000-000000000002'), 'Registro de marca no INPI | Oposição ao registro / Registro de marca no INPI; Oposição ao registro',
  'O outro contrato tem o que ficou');
select is((select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000003' and objeto = 'Registro de marca no INPI'), 2::bigint,
  'As duas demandas do contrato ficam, ligadas ao objeto que ficou');
select is((select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000002'), 2::bigint, 'Nenhuma demanda nasceu da junção');
select ok(exists (select 1 from public.lista_modelos where nome = 'Registro de marca no INPI'), 'O modelo do que saiu tem o nome do que ficou');
select pg_temp.entrar(1); set local role authenticated;
select results_eq($$ select descricao, contratos_ativos, contratos_arquivados, demandas from public.objetos_do_escritorio() $$,
  $$ values ('Oposição ao registro', 1, 0, 1), ('Parecer', 1, 0, 0), ('Registro de marca no INPI', 2, 1, 4) $$, 'A lista mostra os números depois da junção');
reset role;

-- ---------- apagar ----------
-- Quando a Ana tenta apagar um objeto em uso, então é recusado com quantos contratos o usam
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select public.objeto_apagar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Registro de marca no INPI')) $$, 'P0001',
  'Este objeto está em 3 contratos. Troque-o por outro antes de apagar: marque os dois e use Juntar.', 'Objeto em uso não se apaga');
select throws_ok($$ select public.objeto_apagar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer')) $$, 'P0001',
  'Este objeto está em 1 contrato. Troque-o por outro antes de apagar: marque os dois e use Juntar.', 'No singular também');
reset role;
-- Dado o contrato K4 com outro objeto, quando a Ana apaga "Parecer", então ele some da lista
set local session_replication_role = replica;
update public.contratos set objetos = '{Oposição ao registro}', servico = 'Oposição ao registro' where id = 'c0000000-0000-0000-0000-000000000004';
set local session_replication_role = origin;
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.objeto_apagar(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer')) $$, 'O objeto sem uso é apagado');
reset role;
select is(pg_temp.objeto('e0000000-0000-0000-0000-000000000001', 'Parecer'), null, 'E some da lista');

select * from finish();
rollback;
