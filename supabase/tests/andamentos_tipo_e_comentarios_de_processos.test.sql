-- Processos (#362): o tipo do andamento numa lista pronta, e comentários no cartão do processo. Quem vê o processo lê e comenta;
-- quem não vê, não; outro escritório, nunca.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia, Caio e Eli (usuários comuns), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-processos-362', '{"pessoas": true, "processos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-processos-362-2', '{"pessoas": true, "processos": true}');
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

-- E: o processo X1, da Bia (responsável), com o Caio de colaborador; o X2, só da Ana; o X9, do Davi; e uma pessoa (a cliente, e
-- para conferir que o comentário dos outros cartões continua igual).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'CLIENTE DE FORA', 'a0000000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'X1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000002',
   '{a0000000-0000-0000-0000-000000000003}', '{10000000-0000-0000-0000-000000000001}', 'a0000000-0000-0000-0000-000000000002'),
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'X2', 'judicial', '2', 'a0000000-0000-0000-0000-000000000001',
   '{}', '{10000000-0000-0000-0000-000000000001}', 'a0000000-0000-0000-0000-000000000001'),
  ('73000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'X9', 'judicial', '9', 'a0000000-0000-0000-0000-000000000004',
   '{}', '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000004');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.comentarios_vistos(p_processo text) returns bigint language sql as $$
  select count(*) from public.comentarios where processo_id = p_processo::uuid $$;
create function pg_temp.comentarios_guardados(p_processo text) returns bigint language sql security definer as $$
  select count(*) from public.comentarios where processo_id = p_processo::uuid $$;
-- A última linha de andamento gravada no histórico do processo (o id cresce: tudo aqui tem a mesma hora, a da transação).
create function pg_temp.ultima_linha(p_processo text) returns jsonb language sql security definer as $$
  select alteracoes -> 'andamento' from public.processo_historico where processo_id = p_processo::uuid and alteracoes ? 'andamento' order by id desc limit 1 $$;

-- ===================== A. O tipo do andamento na lista pronta =====================

-- Quando a Bia, responsável pelo X1, lança um despacho
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.processo_andamentos (id, processo_id, tipo, categoria, data, texto)
  values ('ad000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'andamento', 'despacho', '2026-11-10', 'Cite-se') $$,
  'Quem está no processo lança um andamento com o tipo da lista');
-- Então ele fica com o tipo, e o histórico começa por ele
select is((select categoria from public.processo_andamentos where id = 'ad000000-0000-0000-0000-000000000001'), 'despacho', 'O tipo da lista fica guardado');
reset role;
select is(pg_temp.ultima_linha('73000000-0000-0000-0000-000000000001'), '{"de": null, "para": "Despacho de 10/11/2026: Cite-se"}'::jsonb,
  'A linha do histórico começa pelo tipo da lista (igual a linhaDoAndamento do site)');

-- Quando ela lança sem o tipo da lista, como a versão anterior do site
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.processo_andamentos (id, processo_id, tipo, data, texto)
  values ('ad000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', 'andamento', '2026-11-11', 'Juntada') $$,
  'O andamento sem o tipo da lista continua aceito');
select is((select categoria from public.processo_andamentos where id = 'ad000000-0000-0000-0000-000000000002'), null, 'E fica sem ele');
reset role;
-- Então a linha do histórico é a de antes, letra por letra
select is(pg_temp.ultima_linha('73000000-0000-0000-0000-000000000001'), '{"de": null, "para": "Andamento de 11/11/2026: Juntada"}'::jsonb,
  'Sem o tipo da lista, a linha do histórico é a mesma de antes');

-- Quando o par não combina, ou o tipo não é da lista, então é recusado
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.processo_andamentos (processo_id, tipo, categoria, data, texto)
  values ('73000000-0000-0000-0000-000000000001', 'intimacao', 'despacho', '2026-11-10', 'x') $$, '23514', null, 'Despacho numa intimação é recusado');
select throws_ok($$ insert into public.processo_andamentos (processo_id, tipo, categoria, data, texto)
  values ('73000000-0000-0000-0000-000000000001', 'andamento', 'audiencia', '2026-11-10', 'x') $$, '23514', null, 'Audiência num andamento comum é recusada');
select throws_ok($$ insert into public.processo_andamentos (processo_id, tipo, categoria, data, texto)
  values ('73000000-0000-0000-0000-000000000001', 'andamento', 'citacao', '2026-11-10', 'x') $$, '23514', null, 'Um tipo fora da lista é recusado');
select lives_ok($$ insert into public.processo_andamentos (processo_id, tipo, categoria, data, texto)
  values ('73000000-0000-0000-0000-000000000001', 'intimacao', 'intimacao', '2026-11-10', 'Para contestar') $$, 'A intimação da lista combina com a intimação');
select lives_ok($$ insert into public.processo_andamentos (processo_id, tipo, categoria, data, hora, local, texto)
  values ('73000000-0000-0000-0000-000000000001', 'audiencia', 'audiencia', '2026-12-01', '14:30', 'Fórum', 'Conciliação') $$,
  'A audiência da lista combina com a audiência, com hora e local');
reset role;

-- Quando o Caio, colaborador, muda o despacho para sentença (a tela nova grava o tipo da lista)
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.processo_andamentos set categoria = 'sentenca' where id = 'ad000000-0000-0000-0000-000000000001' $$), 1,
  'Quem altera o processo muda o tipo da lista');
select throws_ok($$ update public.processo_andamentos set categoria = 'audiencia' where id = 'ad000000-0000-0000-0000-000000000001' $$, '23514', null,
  'Mudar só o tipo da lista para um que não combina é recusado');
reset role;
select is(pg_temp.ultima_linha('73000000-0000-0000-0000-000000000001'), '{"de": "Despacho de 10/11/2026: Cite-se", "para": "Sentença de 10/11/2026: Cite-se"}'::jsonb,
  'O histórico mostra o tipo de antes e o de agora');

-- Quando a versão anterior do site muda só o tipo de sempre da sentença para intimação
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.processo_andamentos set tipo = 'intimacao' where id = 'ad000000-0000-0000-0000-000000000001' $$), 1,
  'A mudança da versão anterior do site continua aceita');
reset role;
-- Então o tipo da lista que não combina mais sai, em vez de a mudança ser recusada
select is((select tipo || '/' || coalesce(categoria, 'vazio') from public.processo_andamentos where id = 'ad000000-0000-0000-0000-000000000001'), 'intimacao/vazio',
  'O andamento fica intimação, sem o tipo da lista');
-- E mudando os dois juntos (a tela nova), fica o novo par
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.processo_andamentos set tipo = 'andamento', categoria = 'peticao' where id = 'ad000000-0000-0000-0000-000000000001' $$), 1,
  'Mudar os dois juntos vale');
reset role;
select is((select categoria from public.processo_andamentos where id = 'ad000000-0000-0000-0000-000000000001'), 'peticao', 'E o tipo da lista novo fica');

-- Quando o Eli, que não está no X1, tenta mudar o tipo, então nada muda
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.mudou($$ update public.processo_andamentos set categoria = 'decisao' where id = 'ad000000-0000-0000-0000-000000000001' $$), 0,
  'Quem não vê o processo não muda o tipo dos andamentos dele');
reset role;

-- ===================== B. Comentários no processo =====================

-- Quando a Bia, responsável pelo X1, comenta nele
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, processo_id, texto) values ('cc000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '  Primeira ideia  ') $$,
  'Quem está no processo comenta nele');
-- Então o comentário é do escritório dela, com o texto arrumado, e ela o lê
select is((select escritorio_id from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'O comentário é do escritório do processo');
select is((select texto from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001'), 'Primeira ideia', 'O texto fica sem espaços nas pontas (o gatilho de sempre)');
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem comentou lê o comentário');
reset role;

-- Quando o Caio, colaborador, lê e comenta
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000001'), 1::bigint, 'O colaborador lê os comentários');
select lives_ok($$ insert into public.comentarios (id, processo_id, texto) values ('cc000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', 'Concordo') $$,
  'O colaborador comenta');
-- Então ele edita o próprio comentário, mas não o da Bia, e não apaga o dela
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Concordo, com ressalvas' where id = 'cc000000-0000-0000-0000-000000000002' $$), 1, 'Quem escreveu edita o próprio comentário');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'mexi' where id = 'cc000000-0000-0000-0000-000000000001' $$), 0, 'Ninguém edita o comentário de outra pessoa');
select is(pg_temp.mudou($$ delete from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001' $$), 0, 'Quem não é administrador não apaga o comentário de outra pessoa');
-- E não comenta no X2, que não vê
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000002'), 0::bigint, 'Quem não vê o processo não lê os comentários dele');
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000002', 'Entrei') $$, '42501', null,
  'Quem não vê o processo não comenta nele');
reset role;

-- Quando o Eli, que não está no X1, tenta ler e comentar
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem não vê o processo não lê');
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Entrei') $$, '42501', null, 'Nem comenta');
-- E, mencionando alguém, recebe sempre a mesma recusa das regras: nunca a mensagem de menção, que diria se o processo existe e quem
-- está nele (a conferência das menções roda depois das regras)
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Oi, @eli') $$, '42501', null,
  'Quem não vê o processo e menciona quem não está nele recebe a recusa das regras');
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Oi, @bia') $$, '42501', null,
  'E a mesma recusa ao mencionar quem está nele');
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('730000ff-0000-0000-0000-0000000000ff', 'Oi, @bia') $$, '42501', null,
  'E num processo que não existe');
reset role;

-- Quando o Davi, de outro escritório, tenta ler e comentar no X1
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.comentarios where processo_id is not null), 0::bigint, 'Outro escritório não lê nenhum comentário de processo daqui');
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'De fora') $$, '42501', null, 'Outro escritório não comenta');
select throws_ok($$ insert into public.comentarios (escritorio_id, processo_id, texto) values ('e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Oi, @eli') $$,
  '42501', null, 'Nem dizendo ser do escritório do processo e mencionando alguém de lá: a recusa é a das regras, sem nome');
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000009', 'No meu') $$, 'No processo do escritório dele, comenta');
reset role;
-- E nem por fora das regras (sem RLS) o comentário fica num escritório e o processo em outro: a ligação vai pelo par
select throws_ok($$ insert into public.comentarios (escritorio_id, processo_id, autor_id, texto) values ('e0000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000004', 'Misturado') $$, '23503', null, 'A chave estrangeira recusa o processo de outro escritório');

-- A regra de um cartão só: o processo conta, e o que valia antes continua valendo
select throws_ok($$ insert into public.comentarios (escritorio_id, processo_id, pessoa_id, autor_id, texto) values ('e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Em dois') $$, '23514', null, 'Comentário no processo e numa pessoa ao mesmo tempo é recusado');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (pessoa_id, texto) values ('10000000-0000-0000-0000-000000000001', 'Como antes') $$,
  'O comentário numa pessoa, como a versão anterior do site grava, continua aceito');
reset role;

-- Menções: só quem está no processo, e os administradores
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Veja, @eli') $$, 'P0001',
  'Não é possível mencionar Eli neste processo: inclua essa pessoa como colaboradora antes.', 'Quem não está no processo não é mencionado');
select throws_ok($$ update public.comentarios set texto = 'Veja, @eli' where id = 'cc000000-0000-0000-0000-000000000001' $$, 'P0001',
  'Não é possível mencionar Eli neste processo: inclua essa pessoa como colaboradora antes.', 'Nem ao editar o comentário');
reset role;
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000005'), 0::bigint,
  'A menção recusada desfaz tudo: quem não pode ser mencionado não recebe mensagem');
select is((select texto from public.comentarios where id = 'cc000000-0000-0000-0000-000000000001'), 'Primeira ideia', 'E o comentário editado fica como estava');
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, processo_id, texto) values ('cc000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000001', 'Veja, @ana e @caio') $$,
  'A administradora e o colaborador podem ser mencionados');
reset role;
select is((select count(*) from public.mensagens where comentario_id = 'cc000000-0000-0000-0000-000000000003'), 2::bigint,
  'Quem foi mencionado recebe a mensagem, como nos outros cartões');

-- Quando a Bia põe o Eli no processo, então ele pode ser mencionado (e passa a ver os comentários)
select pg_temp.entrar(2); set local role authenticated;
update public.processos set colaboradores = '{a0000000-0000-0000-0000-000000000003,a0000000-0000-0000-0000-000000000005}' where id = '73000000-0000-0000-0000-000000000001';
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Agora sim, @eli') $$, 'Quem está no processo pode ser mencionado');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000001'), 4::bigint, 'Quem entrou no processo passa a ler os comentários dele');
select lives_ok($$ insert into public.comentarios (id, processo_id, texto) values ('cc000000-0000-0000-0000-000000000004', '73000000-0000-0000-0000-000000000001', 'Do Eli') $$,
  'E comenta nele');
reset role;
-- Quando a Bia tira o Eli do processo, então ele não edita mais o próprio comentário nele (nem mencionando alguém)
select pg_temp.entrar(2); set local role authenticated;
update public.processos set colaboradores = '{a0000000-0000-0000-0000-000000000003}' where id = '73000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Mudei' where id = 'cc000000-0000-0000-0000-000000000004' $$), 0, 'Quem saiu do processo não edita o próprio comentário');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Mudei, @bia' where id = 'cc000000-0000-0000-0000-000000000004' $$), 0,
  'Nem mencionando alguém (sem a mensagem de menção)');
reset role;
select is((select texto from public.comentarios where id = 'cc000000-0000-0000-0000-000000000004'), 'Do Eli', 'O comentário de quem saiu fica como estava');

-- Quando a chave "equipe_ve_tudo" está ligada, então o Eli lê e comenta (sem alterar o processo), e qualquer um pode ser mencionado
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000001'), 5::bigint, 'Quem só lê o processo lê os comentários');
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Só leio, @ana') $$, 'Quem só lê o processo também comenta');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Com a chave, @eli') $$, 'Com a chave, todos podem ser mencionados');
reset role;
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
-- Quando só a chave "equipe_edita_tudo" está ligada, então também qualquer um da equipe pode ser mencionado
update public.escritorios set modulos = modulos || '{"equipe_edita_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Com a outra chave, @eli') $$,
  'Com a chave de editar tudo, todos podem ser mencionados');
reset role;
update public.escritorios set modulos = modulos - 'equipe_edita_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
-- E sem as chaves, a menção a quem saiu volta a ser recusada
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Sem chave, @eli') $$, 'P0001',
  'Não é possível mencionar Eli neste processo: inclua essa pessoa como colaboradora antes.', 'Sem as chaves, quem não está no processo não é mencionado');
reset role;

-- Quando a Bia arquiva o processo, então os comentários continuam, e quem o vê ainda comenta (como nos outros módulos)
select pg_temp.entrar(2); set local role authenticated;
update public.processos set arquivado_em = now() where id = '73000000-0000-0000-0000-000000000001';
select is(pg_temp.comentarios_vistos('73000000-0000-0000-0000-000000000001'), 8::bigint, 'Arquivar não apaga os comentários');
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Ainda arquivado') $$, 'No arquivado, quem vê ainda comenta');
-- E quando ela o exclui de vez, então os comentários e as mensagens das menções vão junto
select is(pg_temp.mudou($$ delete from public.processos where id = '73000000-0000-0000-0000-000000000001' $$), 1, 'Quem criou exclui o processo arquivado');
reset role;
select is(pg_temp.comentarios_guardados('73000000-0000-0000-0000-000000000001'), 0::bigint, 'Excluir o processo apaga os comentários dele');
select is((select count(*) from public.mensagens where comentario_id = 'cc000000-0000-0000-0000-000000000003'), 0::bigint, 'E as mensagens das menções');
select is(pg_temp.comentarios_guardados('73000000-0000-0000-0000-000000000009'), 1::bigint, 'Os comentários dos outros processos ficam');

select * from finish();
rollback;
