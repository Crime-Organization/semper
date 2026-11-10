-- Excluir um usuário da equipe (#155). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- Dado um escritório com o master, uma administradora, um colega ativo, uma colega desativada (com senha, sessão, duas etapas,
-- perfil profissional, aviso, um cadastro e um comentário dela) e uma administradora desativada.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-excluir');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'admin@exemplo.test', 'Administradora', 'admin', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'ativo@exemplo.test', 'Colega Ativo', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'saiu@exemplo.test', 'Colega Que Saiu', 'usuario', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'admin2@exemplo.test', 'Outra Administradora', 'admin', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, recovery_token, email_change, email_change_token_new, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', extensions.crypt('senha-1', extensions.gen_salt('bf')), '{"convite":"c1"}', '', '', '', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin@exemplo.test', extensions.crypt('senha-2', extensions.gen_salt('bf')), '{"convite":"c2"}', '', '', '', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ativo@exemplo.test', extensions.crypt('senha-3', extensions.gen_salt('bf')), '{"convite":"c3"}', '', '', '', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'saiu@exemplo.test', extensions.crypt('senha-4', extensions.gen_salt('bf')), '{"convite":"c4"}', 'link-de-recuperacao', '', '', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'admin2@exemplo.test', extensions.crypt('senha-5', extensions.gen_salt('bf')), '{"convite":"c5"}', '', '', '', now(), now());
update public.perfis set ativo = false where id in ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005');
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000004', now(), now());
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', 'celular', 'totp', 'unverified', now(), now());
insert into public.perfil_profissional (perfil_id, escritorio_id, nome_exibicao, foto_em) values
  ('a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'Dra. Colega', now());
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'TESTE-1', 'pf', 'CLIENTE DE TESTE', 'a0000000-0000-0000-0000-000000000004');
insert into public.comentarios (id, escritorio_id, pessoa_id, autor_id, texto) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Comentário dela'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Comentário para ela');
insert into public.mensagens (escritorio_id, perfil_id, tipo, comentario_id) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'mencao', 'c0000000-0000-0000-0000-000000000002');
-- O cadastro dela em Pessoas, uma troca de e-mail antiga no registro de ações e uma entrada dela no registro do login, com o e-mail.
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome) values
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'TESTE-2', 'pf', 'COLEGA QUE SAIU');
update public.perfis set pessoa_id = 'b0000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000004';
insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por) values
  ('e0000000-0000-0000-0000-000000000001', 'perfis', 'a0000000-0000-0000-0000-000000000004', 'troca_email',
   '{"nome": "Colega Que Saiu", "email_antigo": "antes@exemplo.test", "email_novo": "saiu@exemplo.test"}', 'a0000000-0000-0000-0000-000000000001');
insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
  (gen_random_uuid(), '{"actor_id": "a0000000-0000-0000-0000-000000000004", "actor_username": "saiu@exemplo.test", "action": "login", "traits": {"provider": "email", "user_email": "saiu@exemplo.test"}}', now(), '10.0.0.1');
-- A outra administradora desativada é a dona da plataforma.
insert into public.plataforma_donos (email, usuario_id) values ('admin2@exemplo.test', 'a0000000-0000-0000-0000-000000000005')
  on conflict (email) do update set usuario_id = excluded.usuario_id;

create function pg_temp.token(p_usuario uuid, p_sessao uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', 'aal1', 'session_id', p_sessao)::text, true);
end $$;
create function pg_temp.senha_vale(p_usuario uuid, p_senha text) returns boolean language sql security definer as $$
  select encrypted_password = extensions.crypt(p_senha, encrypted_password) from auth.users where id = p_usuario
$$;
create function pg_temp.conta(p_usuario uuid) returns auth.users language sql security definer as $$
  select * from auth.users where id = p_usuario
$$;
create function pg_temp.perfil(p_usuario uuid) returns public.perfis language sql security definer as $$
  select * from public.perfis where id = p_usuario
$$;
create function pg_temp.quantos(p_sql text) returns bigint language plpgsql security definer as $$
declare n bigint;
begin execute p_sql into n; return n; end $$;
grant execute on function pg_temp.token(uuid, uuid), pg_temp.senha_vale(uuid, text), pg_temp.conta(uuid), pg_temp.perfil(uuid), pg_temp.quantos(text) to authenticated;
grant usage on schema extensions to authenticated;

set local role authenticated;

-- Quem não pode excluir.
select pg_temp.token('a0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000004') $$, null, 'Apenas administradores',
  'dado quem não é administrador, quando tenta excluir, então o banco recusa');
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000001') $$, null, 'O usuário master não pode ser excluído',
  'dada uma administradora, quando tenta excluir o master, então o banco recusa');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000005') $$, null, 'Só o master gerencia administradores',
  'dada uma administradora, quando tenta excluir outra administradora, então o banco recusa');
select pg_temp.token('a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000001') $$, null, 'Você não pode excluir a própria conta',
  'dado o master, quando tenta excluir a própria conta, então o banco recusa');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000003') $$, null, 'Desative o usuário antes de excluir',
  'dado um colega ativo, quando o master tenta excluir, então o banco pede para desativar antes');
select ok(pg_temp.senha_vale('a0000000-0000-0000-0000-000000000003', 'senha-3'), 'dada a exclusão recusada, então o acesso do colega ativo continua');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000005') $$, null, 'O dono da plataforma não pode ser excluído',
  'dada a dona da plataforma desativada num escritório, quando o master tenta excluí-la, então o banco recusa');

-- Quando o master exclui a colega desativada.
select lives_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000004') $$, 'quando o master exclui a colega desativada, então o banco aceita');

-- Então a conta de acesso não serve para mais nada.
select matches((pg_temp.conta('a0000000-0000-0000-0000-000000000004')).email::text, '^excluida-.*@excluida\.invalid$', 'então o e-mail de acesso some');
select ok(not pg_temp.senha_vale('a0000000-0000-0000-0000-000000000004', 'senha-4'), 'então a senha não entra mais');
select ok((pg_temp.conta('a0000000-0000-0000-0000-000000000004')).banned_until > now() + interval '99 years', 'então o login fica bloqueado');
select is((pg_temp.conta('a0000000-0000-0000-0000-000000000004')).recovery_token, '', 'então o link de recuperação pendente acaba');
select is((pg_temp.conta('a0000000-0000-0000-0000-000000000004')).raw_user_meta_data, '{}'::jsonb, 'então os dados do convite saem da conta');
select is(pg_temp.quantos($$ select count(*) from auth.sessions where user_id = 'a0000000-0000-0000-0000-000000000004' $$), 0::bigint, 'então as sessões acabam');
select is(pg_temp.quantos($$ select count(*) from auth.mfa_factors where user_id = 'a0000000-0000-0000-0000-000000000004' $$), 0::bigint, 'então as duas etapas saem');

-- Então os dados pessoais de uso saem, e o nome fica para os registros antigos.
select is(pg_temp.quantos($$ select count(*) from public.perfil_profissional where perfil_id = 'a0000000-0000-0000-0000-000000000004' $$), 0::bigint, 'então o perfil profissional sai');
select is(pg_temp.quantos($$ select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000004' $$), 0::bigint, 'então os avisos dela saem');
select is((pg_temp.perfil('a0000000-0000-0000-0000-000000000004')).nome, 'Colega Que Saiu', 'então o nome continua no perfil');
select ok((pg_temp.perfil('a0000000-0000-0000-0000-000000000004')).excluido_em is not null, 'então o perfil fica marcado como excluído');
select is(pg_temp.quantos($$ select count(*) from public.pessoas where id = 'b0000000-0000-0000-0000-000000000001' and criado_por = 'a0000000-0000-0000-0000-000000000004' $$), 1::bigint,
  'então o cadastro que ela criou continua dizendo que foi ela');
select is(pg_temp.quantos($$ select count(*) from public.comentarios where id = 'c0000000-0000-0000-0000-000000000001' and autor_id = 'a0000000-0000-0000-0000-000000000004' $$), 1::bigint,
  'então o comentário que ela escreveu continua com ela como autora');
select is(pg_temp.quantos($$ select count(*) from public.auditoria where acao = 'exclusao' and tabela = 'perfis' and registro_id = 'a0000000-0000-0000-0000-000000000004'
  and resumo ->> 'nome' = 'Colega Que Saiu' and feito_por = 'a0000000-0000-0000-0000-000000000001' $$), 1::bigint, 'então a exclusão fica no registro de ações');

-- Excluído não volta.
select throws_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000004', true) $$, null, 'Este usuário foi excluído e não volta à equipe.',
  'dada a exclusão, quando o master tenta reativar, então o banco recusa');
select throws_ok($$ select public.equipe_excluir('a0000000-0000-0000-0000-000000000004') $$, null, 'Usuário não encontrado',
  'dada a exclusão, quando o master tenta excluir de novo, então o banco diz que não encontrou');
select throws_ok($$ select public.equipe_definir_papel('a0000000-0000-0000-0000-000000000004', 'admin') $$, null, 'Este usuário foi excluído e não volta à equipe.',
  'dada a exclusão, quando o master tenta mudar o papel, então o banco recusa');

-- O e-mail sai também do registro de ações, dos convites e do registro de entradas do login.
select is(pg_temp.quantos($$ select count(*) from public.auditoria where resumo::text like '%saiu@exemplo.test%' or resumo::text like '%antes@exemplo.test%' $$), 0::bigint,
  'então o registro de ações não guarda mais o e-mail dela');
select is(pg_temp.quantos($$ select count(*) from public.convites where email = 'saiu@exemplo.test' $$), 0::bigint, 'então o convite que ela usou não guarda mais o e-mail');
select is(pg_temp.quantos($$ select count(*) from auth.audit_log_entries where payload::text like '%saiu@exemplo.test%' $$), 0::bigint,
  'então o registro de entradas do login não guarda mais o e-mail');

reset role;

-- A troca de e-mail não devolve um e-mail de verdade à conta excluída, nem pela função, nem direto no login.
select is((select resultado from public.equipe_email_preparar('a0000000-0000-0000-0000-000000000001', 'aal1', 'a0000000-0000-0000-0000-000000000004', 'nova@exemplo.test')),
  'sem-permissao', 'dada a exclusão, quando o master prepara a troca do e-mail dela, então o banco recusa');
select throws_ok($$ update auth.users set email = 'volta@exemplo.test' where id = 'a0000000-0000-0000-0000-000000000004' $$, null, 'Este usuário foi excluído da equipe.',
  'dada a exclusão, quando o login tenta gravar um e-mail novo na conta, então o banco recusa');

-- O cadastro dela em Pessoas pode ser apagado (LGPD), e o nome fica no perfil.
select lives_ok($$ delete from public.pessoas where id = 'b0000000-0000-0000-0000-000000000002' $$,
  'dada a exclusão, quando o cadastro dela em Pessoas é apagado, então o banco aceita');
select is((select (nome, pessoa_id)::text from public.perfis where id = 'a0000000-0000-0000-0000-000000000004'), '("Colega Que Saiu",)',
  'então o perfil continua com o nome, sem apontar para o cadastro');

select * from finish();
rollback;
