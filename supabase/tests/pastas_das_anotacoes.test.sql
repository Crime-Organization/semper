-- Documentos: pastas e subpastas, e as etiquetas do escritório nas anotações (#342).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia e Caio (usuários comuns), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-pastas', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-pastas-2', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());

-- E uma demanda da Ana em que o Caio colabora (quem a vê lê as anotações ligadas a ela, sem mudá-las).
set local session_replication_role = replica;
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda com o Caio', 'a0000000-0000-0000-0000-000000000001',
   '{a0000000-0000-0000-0000-000000000003}', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;

-- ---------- as pastas ----------
-- Quando a Bia cria "Escritório", "POPs" dentro dela e "Financeiro" dentro de "POPs", e "Atas" dentro de "Escritório"
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.anotacao_pastas (id, nome) values ('f0000000-0000-0000-0000-000000000001', 'Escritório') $$, 'Cria uma pasta no primeiro nível');
select lives_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-000000000002', '  POPs   do  escritório ', 'f0000000-0000-0000-0000-000000000001') $$, 'Cria uma subpasta');
select lives_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-000000000003', 'Financeiro', 'f0000000-0000-0000-0000-000000000002') $$, 'Cria uma subpasta da subpasta');
select lives_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-000000000004', 'Atas', 'f0000000-0000-0000-0000-000000000001') $$, 'Cria outra subpasta');
-- Então elas ficam arrumadas, do escritório dela
select is((select nome from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000002'), 'POPs do escritório', 'O nome fica sem espaços sobrando');
select is((select escritorio_id from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'A pasta é do escritório de quem criou');
select is((select criada_por from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000002'::uuid, 'Guarda quem criou');
-- E o nome não se repete entre irmãs (sem contar maiúsculas e acentos), mas pode se repetir em outra pasta
select throws_ok($$ insert into public.anotacao_pastas (nome) values ('ESCRITORIO') $$, '23505', null, 'Nome repetido no primeiro nível é recusado');
select throws_ok($$ insert into public.anotacao_pastas (nome, pasta_mae_id) values ('atas', 'f0000000-0000-0000-0000-000000000001') $$, '23505', null, 'Nome repetido entre irmãs é recusado');
select lives_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-000000000005', 'Atas', 'f0000000-0000-0000-0000-000000000002') $$, 'O mesmo nome em outra pasta pode');
-- (cada recusa pela regra com nome próprio, que erros.ts traduz para a mesma mensagem do banco fictício)
select throws_ok($$ insert into public.anotacao_pastas (nome) values ('   ') $$, '23514',
  'new row for relation "anotacao_pastas" violates check constraint "anotacao_pastas_nome_preenchido"', 'Nome vazio é recusado');
select throws_ok($$ insert into public.anotacao_pastas (nome) values (repeat('a', 81)) $$, '23514',
  'new row for relation "anotacao_pastas" violates check constraint "anotacao_pastas_nome_tamanho"', 'Nome com mais de 80 caracteres é recusado');
select lives_ok($$ insert into public.anotacao_pastas (id, nome) values ('f0000000-0000-0000-0000-000000000008', repeat('é', 80)) $$, 'Nome com 80 caracteres pode');
select is(pg_temp.mudou($$ delete from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000008' $$), 1, '(e sai, para não contar nas pastas abaixo)');
select throws_ok($$ insert into public.anotacao_pastas (nome, criada_por) values ('Alheia', 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'Não cria em nome de outra pessoa');
select throws_ok($$ insert into public.anotacao_pastas (nome, escritorio_id) values ('Fora', 'e0000000-0000-0000-0000-000000000002') $$, '42501', null, 'O escritório vem sozinho, de quem cria');
-- Quando a Bia tenta pôr uma pasta dentro dela mesma ou de uma subpasta dela
select throws_ok($$ update public.anotacao_pastas set pasta_mae_id = 'f0000000-0000-0000-0000-000000000002' where id = 'f0000000-0000-0000-0000-000000000002' $$,
  'P0001', 'Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.', 'A pasta não vai para dentro dela mesma');
select throws_ok($$ update public.anotacao_pastas set pasta_mae_id = 'f0000000-0000-0000-0000-000000000003' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.', 'Nem para dentro de uma subpasta da subpasta');
select throws_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-000000000009', 'Ela mesma', 'f0000000-0000-0000-0000-000000000009') $$,
  'P0001', 'Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.', 'Nem nasce dentro dela mesma');
-- Então mover para outro lugar e renomear funcionam
select is(pg_temp.mudou($$ update public.anotacao_pastas set pasta_mae_id = 'f0000000-0000-0000-0000-000000000001' where id = 'f0000000-0000-0000-0000-000000000003' $$), 1, 'Move a pasta para outra');
select is(pg_temp.mudou($$ update public.anotacao_pastas set nome = 'POPs' where id = 'f0000000-0000-0000-0000-000000000002' $$), 1, 'Renomeia a pasta');
reset role;

-- Então o Caio, do mesmo escritório, vê todas as pastas e também muda (a estrutura é do escritório)
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*) from public.anotacao_pastas), 5::bigint, 'Todo o escritório vê as pastas');
select is(pg_temp.mudou($$ update public.anotacao_pastas set nome = 'Atas de reunião' where id = 'f0000000-0000-0000-0000-000000000004' $$), 1, 'E renomeia a de outra pessoa');
reset role;

-- E o outro escritório não vê, não muda, não apaga e não usa as pastas daqui
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.anotacao_pastas), 0::bigint, 'O outro escritório não vê nenhuma pasta');
select is(pg_temp.mudou($$ update public.anotacao_pastas set nome = 'Minha' where id = 'f0000000-0000-0000-0000-000000000001' $$), 0, 'Nem renomeia');
select is(pg_temp.mudou($$ delete from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000005' $$), 0, 'Nem apaga');
select throws_ok($$ insert into public.anotacao_pastas (nome, pasta_mae_id) values ('Dentro da alheia', 'f0000000-0000-0000-0000-000000000001') $$, '23503', null, 'Nem cria uma pasta dentro de uma daqui');
select lives_ok($$ insert into public.anotacao_pastas (id, nome) values ('f0000000-0000-0000-0000-000000000010', 'Do Davi') $$, 'Cria a pasta dele');
select throws_ok($$ update public.anotacao_pastas set pasta_mae_id = 'f0000000-0000-0000-0000-000000000001' where id = 'f0000000-0000-0000-0000-000000000010' $$, '23503', null, 'Nem leva a dele para dentro de uma daqui');
-- E a resposta não depende de como as pastas daqui estão arrumadas: com o id de "Escritório" e a mãe "POPs" (que fica dentro
-- dela), o Davi recebe a mesma recusa da chave de sempre, e não a do ciclo, que diria que uma fica dentro da outra
select throws_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-000000000001', 'x', 'f0000000-0000-0000-0000-000000000002') $$,
  '23505', null, 'O outro escritório não descobre que uma pasta daqui fica dentro de outra');
select throws_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values ('f0000000-0000-0000-0000-0000000000aa', 'x', 'f0000000-0000-0000-0000-000000000005') $$,
  '23503', null, 'Com um id novo, a mãe daqui é só uma pasta que não existe para ele');
reset role;
-- E o gatilho do ciclo sobe só pelas pastas do escritório da pasta. Dada uma ligação errada entre escritórios, forçada sem as
-- chaves (a pasta "Outra" do Davi dentro de uma pasta daqui, que por sua vez fica dentro de "Do Davi")
set local session_replication_role = replica;
insert into public.anotacao_pastas (id, escritorio_id, nome, pasta_mae_id) values
  ('f0000000-0000-0000-0000-0000000000bb', 'e0000000-0000-0000-0000-000000000001', 'Daqui', 'f0000000-0000-0000-0000-000000000010'),
  ('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'Outra', 'f0000000-0000-0000-0000-0000000000bb');
set local session_replication_role = origin;
-- Quando o Davi põe "Do Davi" dentro de "Outra", então o gatilho não passa pela pasta daqui (e não acusa o ciclo que só ela fecharia)
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.mudou($$ update public.anotacao_pastas set pasta_mae_id = 'f0000000-0000-0000-0000-000000000011' where id = 'f0000000-0000-0000-0000-000000000010' $$), 1,
  'O gatilho do ciclo não lê as pastas de outro escritório');
reset role;
-- (desfaz a ligação errada)
set local session_replication_role = replica;
delete from public.anotacao_pastas where id in ('f0000000-0000-0000-0000-0000000000bb', 'f0000000-0000-0000-0000-000000000011');
update public.anotacao_pastas set pasta_mae_id = null where id = 'f0000000-0000-0000-0000-000000000010';
set local session_replication_role = origin;

-- ---------- a pasta da anotação ----------
-- Quando a Ana escreve uma anotação só dela na pasta "Atas de reunião", e outra compartilhada com a Bia em "POPs"
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id, pasta_id) values
  ('ab000000-0000-0000-0000-000000000001', 'Ata sigilosa', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004') $$, 'Cria a anotação já numa pasta');
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id, participantes, pasta_id) values
  ('ab000000-0000-0000-0000-000000000002', 'POP do caixa', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'f0000000-0000-0000-0000-000000000002') $$, 'Cria outra');
select throws_ok($$ insert into public.anotacoes (titulo, responsavel_id, pasta_id) values ('Na pasta alheia', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000010') $$,
  '23503', null, 'A anotação não vai para a pasta de outro escritório');
-- E a move para "Financeiro"
select is(pg_temp.mudou($$ update public.anotacoes set pasta_id = 'f0000000-0000-0000-0000-000000000003' where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'Muda a pasta da anotação');
reset role;
-- Então o histórico diz o caminho de antes e o de agora
select is((select alteracoes -> 'pasta_id' from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000002'),
  '{"de": "Escritório › POPs", "para": "Escritório › Financeiro"}'::jsonb, 'O histórico guarda o caminho das pastas');

-- E a Bia, que não está na anotação, não a muda de pasta; a que ela está, muda
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ update public.anotacoes set pasta_id = null where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Quem não altera a anotação não muda a pasta dela');
select is(pg_temp.mudou($$ update public.anotacoes set pasta_id = 'f0000000-0000-0000-0000-000000000002' where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'Quem altera, muda');
-- Quando a Bia tenta apagar pastas com conteúdo
select throws_ok($$ delete from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000004' $$, '23503', null,
  'A pasta com uma anotação que ela nem vê não se apaga');
select throws_ok($$ delete from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000001' $$, '23503', null, 'A pasta com subpastas não se apaga');
-- Então a vazia se apaga
select is(pg_temp.mudou($$ delete from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000005' $$), 1, 'A pasta vazia se apaga');
reset role;
select is((select count(*) from public.anotacao_pastas where id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004')), 2::bigint, 'As com conteúdo continuam lá');

-- ---------- as etiquetas da anotação ----------
-- Quando a Ana cria a etiqueta "POP" e a aplica nas duas anotações, e liga a segunda à demanda do Caio
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.etiquetas (id, cor, texto) values ('e7000000-0000-0000-0000-000000000001', 'azul', 'POP') $$, 'Cria a etiqueta');
select lives_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values
  ('ab000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001'),
  ('ab000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000001') $$, 'Aplica nas anotações');
select lives_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values ('ab000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000001')
                   on conflict (anotacao_id, etiqueta_id) do nothing $$, 'Aplicar de novo não é erro');
select lives_ok($$ insert into public.anotacao_ligacoes (anotacao_id, demanda_id) values ('ab000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001') $$, 'Liga à demanda');
select is((select escritorio_id from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'A ligação é do escritório');
reset role;

-- Então a Bia vê só as etiquetas da anotação que ela vê, e não aplica nem tira na que não vê
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.anotacao_etiquetas), 1::bigint, 'Quem não vê a anotação não vê as etiquetas dela');
select is((select count(*) from public.etiquetas where texto = 'POP'), 1::bigint, 'Mas a etiqueta criada pela Ana aparece para ela, como para todo o escritório');
select throws_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values ('ab000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Nem aplica na que não vê');
select is(pg_temp.mudou($$ delete from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Nem tira');
-- E na que ela está, cria e aplica uma etiqueta nova, e tira
select lives_ok($$ insert into public.etiquetas (id, cor, texto) values ('e7000000-0000-0000-0000-000000000002', 'verde', 'Reunião') $$, 'Cria outra etiqueta');
select lives_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values ('ab000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000002') $$, 'Aplica na anotação em que está');
select is(pg_temp.mudou($$ delete from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000002' and etiqueta_id = 'e7000000-0000-0000-0000-000000000001' $$), 1, 'E tira');
reset role;

-- Então o Caio, que vê a anotação só pela demanda, vê as etiquetas dela, mas não mexe
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*) from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000002'), 1::bigint, 'Quem vê pelo item ligado vê as etiquetas');
select is((select count(*) from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000001'), 0::bigint, 'Mas não as da anotação que não vê');
select throws_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values ('ab000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'E não aplica');
select is(pg_temp.mudou($$ delete from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000002' $$), 0, 'Nem tira');
reset role;

-- E o outro escritório não vê as etiquetas das anotações daqui, nem aplica as dele
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.anotacao_etiquetas), 0::bigint, 'O outro escritório não vê as etiquetas das anotações');
select lives_ok($$ insert into public.etiquetas (id, cor, texto) values ('e7000000-0000-0000-0000-000000000009', 'roxo', 'Do Davi') $$, 'Cria a etiqueta dele');
select throws_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values ('ab000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000009') $$,
  '42501', null, 'Nem aplica numa anotação daqui');
reset role;
-- Nem uma etiqueta de lá vai para a anotação daqui, mesmo por quem a altera
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ insert into public.anotacao_etiquetas (anotacao_id, etiqueta_id) values ('ab000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000009') $$,
  '23503', null, 'A etiqueta de outro escritório não entra');
-- Quando a anotação é arquivada, as etiquetas ficam como estão
select is(pg_temp.mudou($$ update public.anotacoes set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000001' where id = 'ab000000-0000-0000-0000-000000000001' $$), 1, 'Arquiva');
select is(pg_temp.mudou($$ delete from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'A arquivada não perde as etiquetas');
-- E excluir a etiqueta a tira de todas as anotações
select is(pg_temp.mudou($$ delete from public.etiquetas where id = 'e7000000-0000-0000-0000-000000000001' $$), 1, 'Exclui a etiqueta');
reset role;
select is((select count(*) from public.anotacao_etiquetas where etiqueta_id = 'e7000000-0000-0000-0000-000000000001'), 0::bigint, 'E ela sai das anotações');

-- E excluir a anotação tira as etiquetas dela e solta a pasta
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000002' $$), 0, 'A ativa não se exclui');
select is(pg_temp.mudou($$ update public.anotacoes set arquivado_em = now(), arquivado_por = 'a0000000-0000-0000-0000-000000000001' where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'Arquiva a outra');
select is(pg_temp.mudou($$ delete from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000002' $$), 1, 'E a exclui');
select is(pg_temp.mudou($$ delete from public.anotacao_pastas where id = 'f0000000-0000-0000-0000-000000000002' $$), 1, 'A pasta que ficou vazia se apaga');
reset role;
select is((select count(*) from public.anotacao_etiquetas where anotacao_id = 'ab000000-0000-0000-0000-000000000002'), 0::bigint, 'As etiquetas da anotação excluída saem junto');

-- ---------- casos de borda das pastas ----------
-- Quando a Ana cria uma pasta com o nome colado da web, com espaços não separáveis (NBSP) nas pontas e no meio
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.anotacao_pastas (id, nome) values ('f2000000-0000-0000-0000-000000000001', chr(160) || ' Colada  da' || chr(160) || 'web ' || chr(160)) $$,
  'Cria a pasta com o nome colado');
-- Então o nome fica sem espaço nenhum nas pontas, como no banco fictício
select is((select nome from public.anotacao_pastas where id = 'f2000000-0000-0000-0000-000000000001'), 'Colada da web', 'O espaço não separável das pontas também sai');
select throws_ok($$ insert into public.anotacao_pastas (nome) values (chr(160) || chr(160)) $$, '23514',
  'new row for relation "anotacao_pastas" violates check constraint "anotacao_pastas_nome_preenchido"', 'Nome só de espaços não separáveis é vazio');

-- Dadas as pastas A e B, com B dentro de A
select lives_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id) values
  ('f2000000-0000-0000-0000-00000000000a', 'A', null), ('f2000000-0000-0000-0000-00000000000b', 'B', 'f2000000-0000-0000-0000-00000000000a') $$, 'Cria A e B dentro de A');
-- Quando um comando só leva B para o primeiro nível e A para dentro de B
select is(pg_temp.mudou($$ update public.anotacao_pastas
  set pasta_mae_id = case id when 'f2000000-0000-0000-0000-00000000000a'::uuid then 'f2000000-0000-0000-0000-00000000000b'::uuid end
  where id in ('f2000000-0000-0000-0000-00000000000a', 'f2000000-0000-0000-0000-00000000000b') $$), 2, 'Move as duas pastas num comando só');
-- Então vale o resultado final, que não tem ciclo
select is((select pasta_mae_id from public.anotacao_pastas where id = 'f2000000-0000-0000-0000-00000000000a'), 'f2000000-0000-0000-0000-00000000000b'::uuid, 'A fica dentro de B');
select is((select pasta_mae_id from public.anotacao_pastas where id = 'f2000000-0000-0000-0000-00000000000b'), null::uuid, 'B fica no primeiro nível');
-- Mas um comando só que fecha um ciclo (A dentro de B e B dentro de A) continua recusado
select throws_ok($$ update public.anotacao_pastas
  set pasta_mae_id = case id when 'f2000000-0000-0000-0000-00000000000a'::uuid then 'f2000000-0000-0000-0000-00000000000b'::uuid
                             else 'f2000000-0000-0000-0000-00000000000a'::uuid end
  where id in ('f2000000-0000-0000-0000-00000000000a', 'f2000000-0000-0000-0000-00000000000b') $$,
  'P0001', 'Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.', 'O ciclo feito num comando só é recusado');

-- Dadas 105 pastas, uma dentro da outra (N1 › N2 › … › N105), e uma anotação fora de qualquer pasta
select lives_ok($$ insert into public.anotacao_pastas (id, nome, pasta_mae_id)
  select ('f3000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'N' || i,
         case when i > 1 then ('f3000000-0000-0000-0000-' || lpad((i - 1)::text, 12, '0'))::uuid end
  from generate_series(1, 105) i $$, 'Cria 105 níveis de pastas');
select lives_ok($$ insert into public.anotacoes (id, titulo, responsavel_id) values
  ('ab000000-0000-0000-0000-000000000003', 'No fundo', 'a0000000-0000-0000-0000-000000000001') $$, 'Cria a anotação');
-- Quando a Ana a põe na pasta mais funda
select is(pg_temp.mudou($$ update public.anotacoes set pasta_id = 'f3000000-0000-0000-0000-000000000105' where id = 'ab000000-0000-0000-0000-000000000003' $$), 1, 'Põe na N105');
reset role;
-- Então o histórico guarda o caminho inteiro, desde o primeiro nível
select is((select alteracoes #>> '{pasta_id,para}' from public.anotacao_historico where anotacao_id = 'ab000000-0000-0000-0000-000000000003'),
  (select string_agg('N' || i, ' › ' order by i) from generate_series(1, 105) i), 'O caminho vem inteiro, mesmo com mais de 100 níveis');

-- Então quem não entrou não lê nada
set local role anon;
select throws_ok($$ select count(*) from public.anotacao_pastas $$, '42501', null, 'Quem não entrou não lê as pastas');
select throws_ok($$ select count(*) from public.anotacao_etiquetas $$, '42501', null, 'Nem as etiquetas das anotações');
reset role;

select * from finish();
rollback;
