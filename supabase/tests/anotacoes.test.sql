-- Documentos: anotações ligadas a qualquer item, com quem vê e quem altera (#303).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia, Caio e Eli (usuários comuns) e Fabi (desativada), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-anotacoes', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-anotacoes-2', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eli@exemplo.test', 'Eli', 'usuario', privado.resumo_codigo('c5'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'fabi@exemplo.test', 'Fabi', 'usuario', privado.resumo_codigo('c6'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eli@exemplo.test', '{"convite":"c5"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'fabi@exemplo.test', '{"convite":"c6"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now());

-- E os itens: pessoas, duas demandas (a D1 com Bia e Caio, a D2 só da Ana), uma tarefa da D1, um contrato com a Bia,
-- um compromisso da Agenda geral, e no outro escritório uma pessoa e uma demanda.
set local session_replication_role = replica;
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000006';
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BIA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000004');
-- 51 contatos para conferir o limite de itens ligados
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por)
select format('11000000-0000-0000-0000-0000000000%s', lpad(i::text, 2, '0'))::uuid, 'e0000000-0000-0000-0000-000000000001', 'L' || i, 'contato', 'CONTATO ' || i,
       'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 51) i;
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000002';
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda com Bia e Caio', 'a0000000-0000-0000-0000-000000000001',
   '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Demanda só da Ana', 'a0000000-0000-0000-0000-000000000001',
   '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda do Davi', 'a0000000-0000-0000-0000-000000000004',
   '{}', 'a0000000-0000-0000-0000-000000000004');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa da D1', 'a0000000-0000-0000-0000-000000000001', '{}',
   '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, geral, responsavel_id, participantes, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reunião geral', '2030-01-15', '14:30', true,
   'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.vejo(p_anotacao text) returns bigint language sql as $$
  select count(*) from public.anotacoes where id = p_anotacao::uuid $$;
create function pg_temp.ligada_a(p_anotacao text) returns text[] language sql security definer as $$
  select ligada_a from public.anotacoes where id = p_anotacao::uuid $$;

-- Quando a Bia cria uma anotação, compartilhada com o Eli (repetido) e com ela mesma
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.anotacoes (id, titulo, texto, responsavel_id, participantes)
  values ('ab000000-0000-0000-0000-000000000001', '  Estratégia do caso  ', '# Resumo', 'a0000000-0000-0000-0000-000000000002',
          '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000005,a0000000-0000-0000-0000-000000000005}') $$, 'Cria a anotação');
-- Então ela fica arrumada, com código, do escritório dela e ainda sem itens ligados
select is((select titulo from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), 'Estratégia do caso', 'O título fica sem espaços nas pontas');
select is((select participantes from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), '{a0000000-0000-0000-0000-000000000005}'::uuid[],
          'Os participantes ficam sem repetir e sem a responsável');
select ok((select length(codigo) = 8 from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), 'Ganha um código');
select is((select escritorio_id from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'É do escritório de quem criou');
select is((select criado_por from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000002'::uuid, 'Guarda quem criou');
select is((select ligada_a from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), '{}'::text[], 'Ainda não está ligada a nada');
select is((select count(*) from public.anotacoes where busca like '%estrategia%resumo%'), 1::bigint, 'A busca acha o título e o texto, sem acento');

-- Quando os dados não servem, então nada é gravado
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id) values ('   ', 'a0000000-0000-0000-0000-000000000002') $$, '23514', null, 'Título vazio é recusado');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id) values (repeat('a', 301), 'a0000000-0000-0000-0000-000000000002') $$, '23514', null, 'Título com mais de 300 caracteres é recusado');
select throws_ok($$ insert into public.anotacoes (titulo, texto, responsavel_id) values ('Longa', repeat('a', 20001), 'a0000000-0000-0000-0000-000000000002') $$, '23514', null, 'Texto com mais de 20 mil caracteres é recusado');
select lives_ok($$ insert into public.anotacoes (id, titulo, texto, responsavel_id) values ('ab000000-0000-0000-0000-000000000002', 'Sem ligação', repeat('a', 20000), 'a0000000-0000-0000-0000-000000000002') $$, 'Texto com 20 mil caracteres cabe');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id) values ('X', 'a0000000-0000-0000-0000-000000000004') $$, 'P0001', 'O responsável precisa ser alguém da equipe do escritório.', 'Responsável de outro escritório é recusado');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id) values ('X', 'a0000000-0000-0000-0000-000000000006') $$, 'P0001', 'O responsável precisa ser alguém da equipe do escritório.', 'Responsável desativado é recusado');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, participantes) values ('X', 'a0000000-0000-0000-0000-000000000002', '{a0000000-0000-0000-0000-000000000004}') $$, 'P0001', 'O participante precisa ser alguém da equipe do escritório.', 'Participante de outro escritório é recusado');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, participantes) values ('X', 'a0000000-0000-0000-0000-000000000002', '{a0000000-0000-0000-0000-000000000006}') $$, 'P0001', 'O participante precisa ser alguém da equipe do escritório.', 'Participante desativado é recusado');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, criado_por) values ('X', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'Não cria em nome de outra pessoa');
select throws_ok($$ update public.anotacoes set ligada_a = '{demandas}' where id = 'ab000000-0000-0000-0000-000000000001' $$, '42501', null, 'A lista dos módulos ligados não se grava à mão');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, ligada_a) values ('X', 'a0000000-0000-0000-0000-000000000002', '{processos,contratos}') $$, '42501', null, 'Nem ao criar a anotação');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, arquivado_em) values ('X', 'a0000000-0000-0000-0000-000000000002', now()) $$, '42501', null, 'A anotação não nasce arquivada');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, criado_em, atualizado_em) values ('X', 'a0000000-0000-0000-0000-000000000002', '2000-01-01', '2000-01-01') $$, '42501', null, 'Nem com datas escolhidas à mão');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, escritorio_id) values ('X', 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001') $$, '42501', null, 'O escritório vem sozinho, de quem cria');
reset role;

-- Então quem não está na anotação não a vê, e o outro escritório também não
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem não está na anotação não a vê');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.anotacoes), 0::bigint, 'O outro escritório não vê nenhuma anotação');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000001'), 1::bigint, 'A administradora vê');
reset role;

-- Quando a Bia liga a anotação a uma pessoa
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, pessoa_id) values ('ab000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005') $$, 'Liga a uma pessoa');
select is(pg_temp.ligada_a('ab000000-0000-0000-0000-000000000001'), '{pessoas}'::text[], 'A anotação passa a dizer que está ligada a uma pessoa');
reset role;
-- Então a ligação a uma pessoa não abre a anotação
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000001'), 0::bigint, 'A ligação a uma pessoa não abre a anotação');
reset role;

-- Quando a Bia liga a anotação a uma demanda em que o Caio está
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$, 'Liga a uma demanda');
select is(pg_temp.ligada_a('ab000000-0000-0000-0000-000000000001'), '{demandas,pessoas}'::text[], 'A lista dos módulos fica em ordem e sem repetir');
select is((select escritorio_id from public.anotacao_ligacoes where demanda_id = '71000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'A ligação é do escritório da anotação');
-- E liga de novo o mesmo item
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$, 'Ligar de novo o mesmo item não é erro');
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001')
                   on conflict (anotacao_id, demanda_id) do nothing $$, 'Ligar de novo com "on conflict do nothing" também não é erro');
select is((select count(*) from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 2::bigint, 'E não cria outra ligação');
-- Então ela não liga a item que não vê, nem de outro escritório
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002') $$, '42501', null, 'Não liga a uma demanda que não vê');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, pessoa_id) values ('ab000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009') $$, 'P0001', 'Item não encontrado neste escritório.', 'Não liga a uma pessoa de outro escritório');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id, pessoa_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002') $$, '23514', null, 'Uma ligação é a um item só');
reset role;

-- Então o Caio, que está na demanda, lê a anotação, mas não mexe nela
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem está na demanda ligada vê a anotação');
select is((select count(*) from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 2::bigint, 'E vê as ligações dela');
select is(pg_temp.mudou($$ update public.anotacoes set texto = 'x' where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Mas não altera o texto');
select is(pg_temp.mudou($$ update public.anotacoes set arquivado_em = now() where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Nem arquiva');
select is(pg_temp.mudou($$ delete from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Nem desliga');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, tarefa_id) values ('ab000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001') $$, '42501', null, 'Nem liga a outro item');
reset role;

-- Então o outro escritório não liga nada às anotações daqui, nem itens daqui às dele
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id) values ('ab000000-0000-0000-0000-000000000009', 'Do Davi', 'a0000000-0000-0000-0000-000000000004') $$, 'O Davi cria uma anotação no escritório dele');
-- A anotação daqui, para ele, é como uma que não existe: a mesma recusa, sem dizer se o item ou a anotação existem aqui.
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000009') $$, '42501', null, 'Não liga um item dele a uma anotação daqui');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$, '42501', null, 'Nem um item daqui a uma anotação daqui');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-0000000000ff') $$, '42501', null, 'Nem um item que não existe a uma anotação daqui');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-0000000000ff', '71000000-0000-0000-0000-000000000009') $$, '42501', null, 'A mesma recusa de uma anotação que não existe');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000009', '71000000-0000-0000-0000-000000000001') $$, 'P0001', 'Item não encontrado neste escritório.', 'Não liga um item daqui a uma anotação dele');
select is((select count(*) from public.anotacao_ligacoes), 0::bigint, 'Não vê as ligações daqui');
reset role;

-- Quando o Eli, com quem a anotação foi compartilhada, altera o texto e o título
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.mudou($$ update public.anotacoes set texto = 'Trecho reservado do texto', titulo = 'Estratégia revista' where id = 'ab000000-0000-0000-0000-000000000001' $$), 1, 'O participante altera');
select is(pg_temp.mudou($$ delete from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000001' and pessoa_id is not null $$), 1, 'O participante desliga a pessoa');
reset role;
-- Então o histórico guarda o título e só a marca de que o texto mudou, sem o conteúdo
select is((select alteracoes -> 'texto' from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), '{"de": null, "para": null}'::jsonb, 'O texto entra no histórico sem o conteúdo');
select is((select alteracoes -> 'titulo' ->> 'para' from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 'Estratégia revista', 'O título entra no histórico');
select is((select count(*) from public.anotacao_historico where alteracoes::text like '%reservado%' or alteracoes::text like '%Resumo%'), 0::bigint, 'Nenhum trecho do texto vai para o histórico');
select is((select feito_por from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000005'::uuid, 'Com quem alterou');
select is((select count(*) from public.anotacao_historico where alteracoes ? 'ligada_a' or alteracoes ? 'busca' or alteracoes ? 'atualizado_em'), 0::bigint, 'As colunas técnicas não entram');
select is((select atualizado_por from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000005'::uuid, 'A anotação guarda quem alterou');
-- E a lista dos módulos acompanha o desligar
select is(pg_temp.ligada_a('ab000000-0000-0000-0000-000000000001'), '{demandas}'::text[], 'Depois de desligar a pessoa, fica só a demanda');
select is((select count(*) from public.auditoria where tabela = 'anotacoes' and registro_id = 'ab000000-0000-0000-0000-000000000001' and acao = 'inclusao'), 1::bigint, 'A criação fica no registro de ações');

-- Quando a chave "equipe_ve_tudo" é ligada, então toda a equipe lê, mas só quem está na anotação altera
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000002'), 0::bigint, 'Chave desligada: quem não está na anotação não vê');
reset role;
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000002'), 1::bigint, 'Com "equipe_ve_tudo", toda a equipe vê');
select is(pg_temp.mudou($$ update public.anotacoes set titulo = 'x' where id = 'ab000000-0000-0000-0000-000000000002' $$), 0, 'Mas não altera');
reset role;
-- E com "equipe_edita_tudo", toda a equipe altera
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' || '{"equipe_edita_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.anotacoes set titulo = 'Revista pela equipe' where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'Com "equipe_edita_tudo", toda a equipe altera');
select is(pg_temp.mudou($$ update public.anotacoes set arquivado_em = now(), arquivado_por = auth.uid() where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'E arquiva');
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000002' $$), 0, 'Mas não exclui, mesmo arquivada');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'Já quem a criou exclui a arquivada');
reset role;
update public.escritorios set modulos = modulos - 'equipe_edita_tudo' where id = 'e0000000-0000-0000-0000-000000000001';

-- Quando quem está numa anotação sem item ligado se tira dela, ou o responsável a passa a outra pessoa sem ficar nela
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id, participantes) values ('ab000000-0000-0000-0000-000000000005', 'Para sair', 'a0000000-0000-0000-0000-000000000002',
  '{a0000000-0000-0000-0000-000000000003}') $$, 'A administradora cria uma anotação da Bia, com o Caio');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select throws_ok($$ update public.anotacoes set participantes = '{}' where id = 'ab000000-0000-0000-0000-000000000005' $$, '42501', null, 'Gravar a anotação sem ele mesmo é recusado: ele deixaria de vê-la');
-- Então ele sai pelo caminho de sair do cartão, e a saída fica no histórico
select lives_ok($$ select public.cartao_sair('anotacoes', 'ab000000-0000-0000-0000-000000000005') $$, 'O participante sai da anotação');
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000005'), 0::bigint, 'E deixa de vê-la');
select throws_ok($$ select public.cartao_sair('anotacoes', 'ab000000-0000-0000-0000-000000000005') $$, 'P0001', 'Você não está entre as pessoas deste cartão.', 'Quem não está nela não sai de novo');
reset role;
select is((select alteracoes -> 'participantes' ->> 'de' from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000005' and feito_por = 'a0000000-0000-0000-0000-000000000003'),
          'Caio', 'A saída fica no histórico, com quem saiu');
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ update public.anotacoes set responsavel_id = 'a0000000-0000-0000-0000-000000000005' where id = 'ab000000-0000-0000-0000-000000000005' $$, '42501', null, 'O responsável que passa a anotação sem ficar nela é recusado');
select is(pg_temp.mudou($$ update public.anotacoes set responsavel_id = 'a0000000-0000-0000-0000-000000000005', participantes = '{a0000000-0000-0000-0000-000000000002}'
  where id = 'ab000000-0000-0000-0000-000000000005' $$), 1, 'Ficando como participante, passa a anotação');
select lives_ok($$ select public.cartao_sair('anotacoes', 'ab000000-0000-0000-0000-000000000005') $$, 'E depois sai');
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000005'), 0::bigint, 'E deixa de vê-la');
reset role;
select is((select participantes from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000005'), '{}'::uuid[], 'A anotação fica com o novo responsável, sem participantes');

-- Quando a administradora liga uma anotação a um contrato, a uma tarefa e a um compromisso da Agenda geral
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id) values ('ab000000-0000-0000-0000-000000000004', 'Do contrato', 'a0000000-0000-0000-0000-000000000001') $$, 'A administradora cria outra anotação');
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, contrato_id) values ('ab000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001') $$, 'Liga a um contrato');
reset role;
-- Então quem é parte do contrato lê; quem não é, não
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000004'), 1::bigint, 'Quem é parte do contrato ligado vê a anotação');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000004'), 0::bigint, 'Quem não é parte do contrato não vê');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, tarefa_id) values ('ab000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001') $$, 'Liga a uma tarefa');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000004'), 1::bigint, 'Quem vê a tarefa (pela demanda dela) vê a anotação');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.mudou($$ delete from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000004' and tarefa_id is not null $$), 1, 'Desliga a tarefa');
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, compromisso_id) values ('ab000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001') $$, 'Liga a um compromisso da Agenda geral');
select is(pg_temp.ligada_a('ab000000-0000-0000-0000-000000000004'), '{compromissos,contratos}'::text[], 'A lista dos módulos acompanha');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000004'), 1::bigint, 'Quem vê o compromisso da Agenda geral vê a anotação');
select is(pg_temp.mudou($$ update public.anotacoes set titulo = 'x' where id = 'ab000000-0000-0000-0000-000000000004' $$), 0, 'E só lê');
reset role;

-- Quando a administradora liga 50 contatos a uma anotação
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id) values ('ab000000-0000-0000-0000-000000000003', 'Lista grande', 'a0000000-0000-0000-0000-000000000001') $$, 'Cria a anotação');
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, pessoa_id) select 'ab000000-0000-0000-0000-000000000003', id from public.pessoas where codigo ~ '^L([1-9]|[1-4][0-9]|50)$' $$, 'Liga 50 itens');
select is((select count(*) from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000003'), 50::bigint, 'Os 50 ficam ligados');
-- Então o 51º é recusado, e ligar de novo um dos 50 continua sem erro
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, pessoa_id) values ('ab000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000051') $$, 'P0001', 'Uma anotação pode ser ligada a no máximo 50 itens.', 'Acima de 50 itens é recusado');
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, pessoa_id) values ('ab000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001') $$, 'Ligar de novo um dos 50 não é erro');
reset role;

-- Quando alguém tenta excluir uma pessoa ligada a uma anotação, então é recusado
select throws_ok($$ delete from public.pessoas where id = '11000000-0000-0000-0000-000000000001' $$, '23503', null, 'Pessoa ligada a uma anotação não é excluída');

-- Quando a demanda ligada é excluída, então a ligação sai junto, e a anotação continua
delete from public.tarefas where demanda_id = '71000000-0000-0000-0000-000000000001';
delete from public.demandas where id = '71000000-0000-0000-0000-000000000001';
select is((select count(*) from public.anotacao_ligacoes where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 0::bigint, 'Excluir a demanda tira a ligação');
select is(pg_temp.ligada_a('ab000000-0000-0000-0000-000000000001'), '{}'::text[], 'E a anotação deixa de dizer que está ligada a uma demanda');
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('ab000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem via pela demanda deixa de ver');
reset role;

-- Quando a Bia tenta excluir a anotação antes de arquivar, então nada sai
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Anotação não arquivada não é excluída');
select is(pg_temp.mudou($$ update public.anotacoes set arquivado_em = now(), arquivado_por = auth.uid() where id = 'ab000000-0000-0000-0000-000000000001' $$), 1, 'Quem criou arquiva');
select throws_ok($$ insert into public.anotacao_ligacoes (anotacao_id, pessoa_id) values ('ab000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005') $$, '42501', null, 'Anotação arquivada não ganha ligação');
reset role;
-- Então o participante não exclui, e quem criou exclui
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'O participante não exclui');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001' $$), 1, 'Quem criou exclui a anotação arquivada');
reset role;
select is((select count(*) from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 0::bigint, 'O histórico sai junto');
select is((select count(*) from public.auditoria where tabela = 'anotacoes' and registro_id = 'ab000000-0000-0000-0000-000000000001' and acao = 'exclusao'), 1::bigint, 'A exclusão fica no registro de ações');

-- Então quem não entrou não lê nada
set local role anon;
select throws_ok($$ select count(*) from public.anotacoes $$, '42501', null, 'Quem não entrou não lê as anotações');
select throws_ok($$ select count(*) from public.anotacao_ligacoes $$, '42501', null, 'Nem as ligações');
select throws_ok($$ select count(*) from public.anotacao_historico $$, '42501', null, 'Nem o histórico');
reset role;

-- E o módulo vem ligado nos escritórios novos e nos que já existiam
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000003', 'Escritório novo', 'teste-anotacoes-3');
select ok((select (modulos ->> 'anotacoes')::boolean from public.escritorios where id = 'e0000000-0000-0000-0000-000000000003'), 'Escritório novo já vem com as anotações');

select * from finish();
rollback;
