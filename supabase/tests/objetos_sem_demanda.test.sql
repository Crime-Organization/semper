-- Objetos do contrato sem demanda, com "Criar esta demanda agora" (#349). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master, responsável pelo contrato) e Bia (usuária comum, fora do contrato K1), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-objetos-sem-demanda', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-objetos-sem-demanda-2', '{"pessoas": true}');
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

-- K1: contrato da Ana, ainda fora da coluna de assinados, com dois objetos e o "A definir". K2: contrato arquivado.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, criado_por, arquivado_em) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Registro de marca; Oposição; A definir', '{Registro de marca,Oposição,A definir}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', null),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AN26', 2026, 'AN26-0002-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Recurso', '{Recurso}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', now());
insert into public.lista_modelos (escritorio_id, nome, itens, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Busca prévia,Depósito}', 'a0000000-0000-0000-0000-000000000001');
-- K3: contrato da Ana em que a Bia está só pelo grupo "Marcas" (sem ser criadora, responsável nem participante).
insert into public.grupos_da_equipe (id, escritorio_id, nome) values
  ('90000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Marcas');
insert into public.grupo_integrantes (grupo_id, perfil_id, escritorio_id) values
  ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, criado_por, grupos) values
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 3, 'AN26', 2026, 'AN26-0003-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', 'Parecer', '{Parecer}',
   'pro_labore', 'a0000000-0000-0000-0000-000000000001', '{90000000-0000-0000-0000-000000000001}');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.demandas_de(p_objeto text) returns bigint language sql as $$
  select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000001' and objeto = p_objeto
$$;
grant execute on function pg_temp.demandas_de(text) to authenticated;

-- Quando a Ana cria na hora a demanda de um objeto (escrito sem acento e em minúsculas), então ela nasce ligada ao contrato e ao
-- objeto como está no contrato, em "Para fazer", com o cliente e o responsável do contrato e as tarefas do modelo
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', '  registro de marca ') $$, 'Quem altera o contrato cria a demanda do objeto');
reset role;
select is(pg_temp.demandas_de('Registro de marca'), 1::bigint, 'A demanda nasceu com o objeto como está no contrato');
select is((select d.titulo || '|' || d.responsavel_id || '|' || array_to_string(d.clientes, ',') || '|' || c.marco
           from public.demandas d join public.quadro_colunas c on c.id = d.etapa_id
           where d.contrato_id = 'c0000000-0000-0000-0000-000000000001'),
          'Registro de marca|a0000000-0000-0000-0000-000000000001|10000000-0000-0000-0000-000000000005|inicio', 'Com o título, o responsável, o cliente e a coluna de início');
select is((select count(*) from public.tarefas where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 2::bigint, 'A demanda ganhou as tarefas do modelo');

-- Quando a Ana tenta de novo, então é recusado: o objeto já tem demanda
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', 'Registro de marca') $$, 'P0001', 'Este objeto já tem uma demanda.', 'O objeto não ganha duas demandas');
-- Quando pede um objeto que não está no contrato, ou o "A definir", então é recusado
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', 'Recurso') $$, 'P0001', 'Este objeto não está no contrato.', 'Objeto de fora não vira demanda');
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', 'A definir') $$, 'P0001', 'Este objeto não está no contrato.', '"A definir" não vira demanda');
-- Quando o contrato está arquivado, então é recusado
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000002', 'Recurso') $$, 'P0001', 'Este contrato está arquivado. Desarquive para criar a demanda.', 'Contrato arquivado não cria demanda');
reset role;

-- Quando a Bia (fora do contrato) ou o Davi (outro escritório) tentam, então é recusado
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', 'Oposição') $$, 'P0001', 'Você não tem permissão para fazer isso.', 'Quem não altera o contrato não cria');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', 'Oposição') $$, 'P0001', 'Você não tem permissão para fazer isso.', 'Outro escritório não cria');
reset role;
select is(pg_temp.demandas_de('Oposição'), 0::bigint, 'Nenhuma demanda nasceu das recusas');

-- Quando o contrato chega à coluna de assinados, então só o objeto que ainda não tinha demanda ganha uma (a de agora não se repete)
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set etapa_id = (select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'contratos' and marco = 'assinado')
where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.demandas_de('Registro de marca'), 1::bigint, 'A demanda criada na hora não se repete na assinatura');
select is(pg_temp.demandas_de('Oposição'), 1::bigint, 'O objeto sem demanda ganhou a dele na assinatura');
select is((select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 2::bigint, 'O "A definir" continua sem demanda');

-- Dado o contrato já assinado, quando ganha um objeto novo, então nada nasce sozinho, e a Ana cria a demanda dele na hora
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set objetos = '{Registro de marca,Oposição,Recurso}' where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.demandas_de('Recurso'), 1::bigint, 'O objeto que entrou no lugar do "A definir" virou demanda, como antes');
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set objetos = '{Registro de marca,Oposição,Recurso,Apelação}' where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.demandas_de('Apelação'), 0::bigint, 'Sem o "A definir", o objeto novo não vira demanda sozinho');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000001', 'Apelação') $$, 'No contrato assinado, cria a demanda do objeto novo');
reset role;
select is(pg_temp.demandas_de('Apelação'), 1::bigint, 'A demanda do objeto novo nasceu');

-- Dado a Bia no contrato K3 só pelo grupo "Marcas", quando ela cria a demanda de um objeto, então é recusado (o grupo não conta)
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000003', 'Parecer') $$, 'P0001', 'Você não tem permissão para fazer isso.',
  'Quem está no contrato só por um grupo não cria a demanda');
reset role;
select is((select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000003'), 0::bigint, 'A recusa pelo grupo não criou demanda');

-- Dado o escritório na fase de adaptação (chave equipe_edita_tudo), quando a Bia cria a demanda, então ela nasce
update public.escritorios set modulos = modulos || '{"equipe_edita_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ select public.contrato_criar_demanda('c0000000-0000-0000-0000-000000000003', 'Parecer') $$, 'Na fase de adaptação, a equipe cria a demanda do objeto');
reset role;
select is((select count(*) from public.demandas where contrato_id = 'c0000000-0000-0000-0000-000000000003' and objeto = 'Parecer'), 1::bigint,
  'Na fase de adaptação, a demanda nasceu');

select * from finish();
rollback;
