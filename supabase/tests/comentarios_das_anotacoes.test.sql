-- Comentários nas anotações (#364): quem vê a anotação lê e comenta; quem não vê, não; outro escritório, nunca.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia, Caio e Eli (usuários comuns), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-comentarios-anotacoes', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-comentarios-anotacoes-2', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eli@exemplo.test', 'Eli', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eli@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now());
update public.perfis set usuario = 'ana' where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis set usuario = 'bia' where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis set usuario = 'caio' where id = 'a0000000-0000-0000-0000-000000000003';
update public.perfis set usuario = 'davi' where id = 'a0000000-0000-0000-0000-000000000004';
update public.perfis set usuario = 'eli' where id = 'a0000000-0000-0000-0000-000000000005';

-- E: a demanda D1, com o Caio; a anotação N1 da Bia, ligada à D1 (o Caio a vê só por ela); a N2, só da Ana; a N9, do Davi;
-- e uma pessoa, para conferir que o comentário dos outros cartões continua igual.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda com o Caio', 'a0000000-0000-0000-0000-000000000001',
   '{a0000000-0000-0000-0000-000000000003}', 'a0000000-0000-0000-0000-000000000001');
insert into public.anotacoes (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('ab000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'N1', 'Estratégia', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000002'),
  ('ab000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'N2', 'Da Ana', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('ab000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'N9', 'Do Davi', 'a0000000-0000-0000-0000-000000000004', '{}', 'a0000000-0000-0000-0000-000000000004');
insert into public.anotacao_ligacoes (escritorio_id, anotacao_id, demanda_id, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.comentarios_vistos(p_anotacao text) returns bigint language sql as $$
  select count(*) from public.comentarios where anotacao_id = p_anotacao::uuid $$;
create function pg_temp.comentarios_guardados(p_anotacao text) returns bigint language sql security definer as $$
  select count(*) from public.comentarios where anotacao_id = p_anotacao::uuid $$;

-- Quando a Bia, responsável pela N1, comenta nela
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, anotacao_id, texto) values ('cc000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', '  Primeira ideia  ') $$,
  'Quem está na anotação comenta nela');
-- Então o comentário é do escritório dela, com o texto arrumado, e ela o lê
select is((select escritorio_id from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'O comentário é do escritório da anotação');
select is((select texto from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001'), 'Primeira ideia', 'O texto fica sem espaços nas pontas (o gatilho de sempre)');
select is(pg_temp.comentarios_vistos('ab000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem comentou lê o comentário');
reset role;

-- Quando o Caio, que vê a N1 só pela demanda ligada (e não altera a anotação), lê e comenta
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.comentarios_vistos('ab000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem vê a anotação por um item ligado lê os comentários');
select lives_ok($$ insert into public.comentarios (id, anotacao_id, texto) values ('cc000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001', 'Concordo') $$,
  'Quem só lê a anotação também comenta, como nos outros módulos');
select is(pg_temp.mudou($$ update public.anotacoes set texto = 'mexi' where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Mas continua sem alterar a anotação');
-- Então ele edita o próprio comentário, mas não o da Bia, e não apaga o dela
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Concordo, com ressalvas' where id = 'cc000000-0000-0000-0000-000000000002' $$), 1, 'Quem escreveu edita o próprio comentário');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'mexi' where id = 'cc000000-0000-0000-0000-000000000001' $$), 0, 'Ninguém edita o comentário de outra pessoa');
select is(pg_temp.mudou($$ delete from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001' $$), 0, 'Quem não é administrador não apaga o comentário de outra pessoa');
-- E não comenta na N2, que não vê
select is(pg_temp.comentarios_vistos('ab000000-0000-0000-0000-000000000002'), 0::bigint, 'Quem não vê a anotação não lê os comentários dela');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000002', 'Entrei') $$, '42501', null,
  'Quem não vê a anotação não comenta nela');
reset role;

-- Quando o Eli, que não está na N1 nem na demanda, tenta ler e comentar
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.comentarios_vistos('ab000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem não vê a anotação não lê');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Entrei') $$, '42501', null, 'Nem comenta');
-- E, mencionando alguém, recebe sempre a mesma recusa das regras: nunca a mensagem de menção, que diria se a anotação existe e
-- quem está nela (a conferência das menções roda depois das regras)
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000002', 'Oi, @bia') $$, '42501', null,
  'Quem não vê a anotação e menciona quem não está nela recebe a recusa das regras');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000002', 'Oi, @ana') $$, '42501', null,
  'E a mesma recusa ao mencionar quem está nela');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Oi, @caio') $$, '42501', null,
  'E ao mencionar quem a vê só pelo item ligado');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab0000ff-0000-0000-0000-0000000000ff', 'Oi, @bia') $$, '42501', null,
  'E numa anotação que não existe');
reset role;

-- Quando o Davi, de outro escritório, tenta ler e comentar na N1
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.comentarios where anotacao_id is not null), 0::bigint, 'Outro escritório não lê nenhum comentário de anotação daqui');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'De fora') $$, '42501', null, 'Outro escritório não comenta');
select throws_ok($$ insert into public.comentarios (escritorio_id, anotacao_id, texto) values ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 'De fora') $$,
  '42501', null, 'Nem dizendo ser do escritório da anotação');
select throws_ok($$ insert into public.comentarios (escritorio_id, anotacao_id, texto) values ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 'Oi, @eli') $$,
  '42501', null, 'Nem mencionando alguém de lá: a recusa é a das regras, sem o nome de ninguém do outro escritório');
select throws_ok($$ insert into public.comentarios (escritorio_id, anotacao_id, texto) values ('e0000000-0000-0000-0000-000000000001', 'ab0000ff-0000-0000-0000-0000000000ff', 'Oi, @eli') $$,
  '42501', null, 'A mesma recusa numa anotação que não existe');
select lives_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000009', 'Na minha') $$, 'Na anotação do escritório dele, comenta');
reset role;
-- E nem por fora das regras (sem RLS) o comentário fica num escritório e a anotação em outro: a ligação vai pelo par
select throws_ok($$ insert into public.comentarios (escritorio_id, anotacao_id, autor_id, texto) values ('e0000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000004', 'Misturado') $$, '23503', null, 'A chave estrangeira recusa a anotação de outro escritório');

-- A regra de um cartão só: a anotação conta, e o que valia antes continua valendo
select throws_ok($$ insert into public.comentarios (escritorio_id, anotacao_id, pessoa_id, autor_id, texto) values ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Em dois') $$, '23514', null, 'Comentário na anotação e numa pessoa ao mesmo tempo é recusado');
select throws_ok($$ insert into public.comentarios (escritorio_id, autor_id, texto) values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Em nenhum') $$,
  '23514', null, 'Comentário sem cartão continua recusado');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (pessoa_id, texto) values ('10000000-0000-0000-0000-000000000001', 'Como antes') $$,
  'O comentário numa pessoa, como a versão anterior do site grava, continua aceito');
reset role;

-- Menções: só quem vê a anotação por estar nela, e os administradores
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Veja, @eli') $$, 'P0001',
  'Não é possível mencionar Eli nesta anotação: inclua essa pessoa como participante antes.', 'Quem não vê a anotação não é mencionado');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'P0001',
  'Não é possível mencionar Caio nesta anotação: inclua essa pessoa como participante antes.', 'Quem a vê só pelo item ligado também não');
select throws_ok($$ update public.comentarios set texto = 'Veja, @eli' where id = 'cc000000-0000-0000-0000-000000000001' $$, 'P0001',
  'Não é possível mencionar Eli nesta anotação: inclua essa pessoa como participante antes.', 'Nem ao editar o comentário');
reset role;
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000005'), 0::bigint,
  'A menção recusada desfaz tudo: quem não pode ser mencionado não recebe mensagem');
select is((select texto from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001'), 'Primeira ideia', 'E o comentário editado fica como estava');
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, anotacao_id, texto) values ('cc000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000001', 'Veja, @ana') $$,
  'A administradora pode ser mencionada');
reset role;
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000001' and comentario_id = 'cc000000-0000-0000-0000-000000000003'), 1::bigint,
  'Quem foi mencionado recebe a mensagem, como nos outros cartões');
-- Quando a Bia põe o Eli na anotação, então ele pode ser mencionado (e passa a ver os comentários)
select pg_temp.entrar(2); set local role authenticated;
update public.anotacoes set participantes = '{a0000000-0000-0000-0000-000000000005}' where id = 'ab000000-0000-0000-0000-000000000001';
select lives_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Agora sim, @eli') $$, 'Quem está na anotação pode ser mencionado');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.comentarios_vistos('ab000000-0000-0000-0000-000000000001'), 4::bigint, 'Quem entrou na anotação passa a ler os comentários dela');
select lives_ok($$ insert into public.comentarios (id, anotacao_id, texto) values ('cc000000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-000000000001', 'Do Eli') $$,
  'E comenta nela');
reset role;
-- Quando a Bia tira o Eli da anotação, então ele não edita mais o próprio comentário nela (nem mencionando alguém, o que diria
-- quem está nela), como no banco fictício
select pg_temp.entrar(2); set local role authenticated;
update public.anotacoes set participantes = '{}' where id = 'ab000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Mudei' where id = 'cc000000-0000-0000-0000-000000000004' $$), 0, 'Quem saiu da anotação não edita o próprio comentário');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Mudei, @caio' where id = 'cc000000-0000-0000-0000-000000000004' $$), 0,
  'Nem mencionando alguém (sem a mensagem de menção)');
reset role;
select is((select texto from public.comentarios where id = 'cc000000-0000-0000-0000-000000000004'), 'Do Eli', 'O comentário de quem saiu fica como estava');
-- Quando a chave "equipe_ve_tudo" está ligada, então qualquer um da equipe pode ser mencionado
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Com a chave, @caio') $$, 'Com a chave, todos podem ser mencionados');
reset role;
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
-- Quando só a chave "equipe_edita_tudo" está ligada, então também qualquer um da equipe pode ser mencionado
update public.escritorios set modulos = modulos || '{"equipe_edita_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, anotacao_id, texto) values ('cc000000-0000-0000-0000-000000000005', 'ab000000-0000-0000-0000-000000000001', 'Com a outra chave, @eli') $$,
  'Com a chave de editar tudo, todos podem ser mencionados');
reset role;
select is((select mencoes from public.comentarios where id = 'cc000000-0000-0000-0000-000000000005'), '{a0000000-0000-0000-0000-000000000005}'::uuid[], 'E a menção fica guardada');
update public.escritorios set modulos = modulos - 'equipe_edita_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
-- E sem as chaves, a menção a quem saiu volta a ser recusada
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Sem chave, @eli') $$, 'P0001',
  'Não é possível mencionar Eli nesta anotação: inclua essa pessoa como participante antes.', 'Sem as chaves, quem não está na anotação não é mencionado');
reset role;

-- Quando a Bia arquiva a anotação, então os comentários continuam, e quem a vê ainda comenta (como nos outros módulos)
select pg_temp.entrar(2); set local role authenticated;
update public.anotacoes set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000002' where id = 'ab000000-0000-0000-0000-000000000001';
select is(pg_temp.comentarios_vistos('ab000000-0000-0000-0000-000000000001'), 7::bigint, 'Arquivar não apaga os comentários');
select lives_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Ainda arquivada') $$, 'Na arquivada, quem vê ainda comenta');
-- E quando ela a exclui de vez, então os comentários e as mensagens das menções vão junto
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001' $$), 1, 'Quem criou exclui a anotação arquivada');
reset role;
select is(pg_temp.comentarios_guardados('ab000000-0000-0000-0000-000000000001'), 0::bigint, 'Excluir a anotação apaga os comentários dela');
select is((select count(*) from public.mensagens where comentario_id = 'cc000000-0000-0000-0000-000000000003'), 0::bigint, 'E as mensagens das menções');
select is(pg_temp.comentarios_guardados('ab000000-0000-0000-0000-000000000009'), 1::bigint, 'Os comentários das outras anotações ficam');

select * from finish();
rollback;
