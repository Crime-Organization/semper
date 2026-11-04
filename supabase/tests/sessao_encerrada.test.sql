-- Sessão encerrada corta o acesso na hora (#233). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Dado um escritório com o master (sessão A) e uma colega com duas sessões (B e C), uma pessoa, uma tarefa com tempo e uma coluna oculta.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-sessao');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'colega@exemplo.test', 'Colega', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'colega@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000002', now(), now());

-- Os gatilhos das tarefas pedem o quadro inteiro; aqui só importa a linha.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'PESSOA DE TESTE', 'a0000000-0000-0000-0000-000000000002');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('20000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002');
insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, segundos) values
  ('e0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 60);
insert into public.quadro_colunas (id, escritorio_id, modulo, nome) values
  ('30000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pessoas', 'Coluna');
insert into public.quadro_colunas_ocultas (perfil_id, coluna_id) values
  ('a0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

-- O token que o login emitiria para cada sessão. Sessão nula: um token sem session_id.
create function pg_temp.token(p_usuario uuid, p_sessao uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', 'aal1', 'session_id', p_sessao))::text, true);
end $$;
grant execute on function pg_temp.token(uuid, uuid) to authenticated;
-- As mudanças que a pessoa tenta. Devolve quantas linhas foram alteradas: a regra de leitura e de escrita some com as outras.
create function pg_temp.mudou_perfil() returns bigint language sql as $$
  with m as (update public.perfis set cor = '#000000' where id = auth.uid() returning 1) select count(*) from m
$$;
create function pg_temp.mudou_tempo() returns bigint language sql as $$
  with m as (update public.tarefa_tempos set segundos = 61 where perfil_id = auth.uid() returning 1) select count(*) from m
$$;
create function pg_temp.mudou_pessoa() returns bigint language sql as $$
  with m as (update public.pessoas set nome = 'ALTERADA' where id = '10000000-0000-0000-0000-000000000001' returning 1) select count(*) from m
$$;
grant execute on function pg_temp.mudou_perfil(), pg_temp.mudou_tempo(), pg_temp.mudou_pessoa() to authenticated;

set local role authenticated;
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000b');

-- Com a sessão ativa, nada muda.
select is((select count(*) from public.pessoas where id = '10000000-0000-0000-0000-000000000001'), 1::bigint, 'dada uma sessão ativa, quando lê uma pessoa, então vê');
select is(pg_temp.mudou_pessoa(), 1::bigint, 'dada uma sessão ativa, quando altera uma pessoa, então grava');
select is(pg_temp.mudou_perfil(), 1::bigint, 'dada uma sessão ativa, quando altera o próprio perfil, então grava');
select is(pg_temp.mudou_tempo(), 1::bigint, 'dada uma sessão ativa, quando altera o próprio tempo, então grava');
select is((select count(*) from public.quadro_colunas_ocultas), 1::bigint, 'dada uma sessão ativa, quando lê as colunas ocultas, então vê as suas');

-- Quando o login encerra só a sessão B (ex.: a pessoa trocou a senha em C), o token de C continua valendo e o de B para.
reset role;
delete from auth.sessions where id = '50000000-0000-0000-0000-00000000000b';
set local role authenticated;
select is((select count(*) from public.pessoas), 0::bigint, 'dada a sessão encerrada, quando o token dela lê, então não vê nada');
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.pessoas where id = '10000000-0000-0000-0000-000000000001'), 1::bigint, 'dada outra sessão da pessoa ainda ativa, quando o token dela lê, então vê');

-- Quando o administrador troca o e-mail da colega, o token antigo deixa de ler e de gravar logo depois.
reset role;
select is((select resultado from public.equipe_email_preparar('a0000000-0000-0000-0000-000000000001', 'aal1', 'a0000000-0000-0000-0000-000000000002', 'nova@exemplo.test')),
  'pronto', 'quando o administrador pede a troca do e-mail, então o banco aceita');
set local role authenticated;
select is((select count(*) from public.pessoas), 0::bigint, 'dada a troca, quando o token antigo lê pessoas, então não vê nada');
select is((select count(*) from public.tarefas), 0::bigint, 'dada a troca, quando o token antigo lê tarefas, então não vê nada');
select is((select count(*) from public.perfis), 0::bigint, 'dada a troca, quando o token antigo lê a equipe, então não vê nada');
select is(pg_temp.mudou_pessoa(), 0::bigint, 'dada a troca, quando o token antigo altera uma pessoa, então nada muda');
select is(pg_temp.mudou_perfil(), 0::bigint, 'dada a troca, quando o token antigo altera o próprio perfil, então nada muda');
select is(pg_temp.mudou_tempo(), 0::bigint, 'dada a troca, quando o token antigo altera o próprio tempo, então nada muda');
select is((select count(*) from public.quadro_colunas_ocultas), 0::bigint, 'dada a troca, quando o token antigo lê as colunas ocultas, então não vê nada');
select throws_ok($$ insert into public.pessoas (tipo, nome) values ('contato', 'NOVA') $$, null, null, 'dada a troca, quando o token antigo cria uma pessoa, então o banco recusa');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('fotos-da-equipe', 'e0000000-0000-0000-0000-000000000001/a0000000-0000-0000-0000-000000000002/foto.avif', 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'dada a troca, quando o token antigo envia uma foto, então o banco recusa');

-- As outras verificações centrais e um token sem sessão.
select pg_temp.token('a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a');
select ok(privado.sou_admin() and privado.sou_master(), 'dado o master com sessão ativa, então é administrador');
reset role;
delete from auth.sessions where id = '50000000-0000-0000-0000-00000000000a';
set local role authenticated;
select ok(not privado.sou_admin() and not privado.sou_master() and not privado.sou_dono(), 'dado o master com a sessão encerrada, então não é administrador');
select throws_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', false) $$, null, 'Apenas administradores', 'dado o master com a sessão encerrada, quando desativa alguém, então o banco recusa');
select pg_temp.token('a0000000-0000-0000-0000-000000000001', null);
select is(privado.meu_escritorio(), null, 'dado um token sem session_id, então o acesso fica fechado');

-- Quem foi desativado, mesmo com uma sessão ativa, também não mexe mais nas regras que só olhavam quem é a pessoa.
reset role;
insert into auth.sessions (id, user_id, created_at, updated_at) values ('50000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000002', now(), now());
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000d');
select is(pg_temp.mudou_perfil(), 0::bigint, 'dada uma pessoa desativada, quando altera o próprio perfil, então nada muda');
select is(pg_temp.mudou_tempo(), 0::bigint, 'dada uma pessoa desativada, quando altera o próprio tempo, então nada muda');

reset role;
select * from finish();
rollback;
