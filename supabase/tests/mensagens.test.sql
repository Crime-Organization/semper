-- Caixa de mensagens (#112): quem é marcado com @ recebe uma mensagem, e só a própria pessoa a vê.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Dado um escritório com Ana (administradora), Bia e Caio, um outro escritório com Davi, e uma pessoa cadastrada.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-mensagens', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-mensagens-2', '{"pessoas": true}');
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
update public.perfis set usuario = 'ana' where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis set usuario = 'bia' where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis set usuario = 'caio' where id = 'a0000000-0000-0000-0000-000000000003';
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE UM', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.comentar(p_id uuid, p_texto text) returns void language sql as $$
  insert into public.comentarios (id, pessoa_id, texto) values (p_id, '10000000-0000-0000-0000-000000000001', p_texto)
$$;
create function pg_temp.minhas() returns bigint language sql as $$ select count(*) from public.mensagens $$;

-- Quando a Ana marca a Bia e a si mesma, então só a Bia recebe a mensagem, não lida.
select pg_temp.entrar(1);
set local role authenticated;
select pg_temp.comentar('c0000000-0000-0000-0000-000000000001', 'Veja isto, @bia. Lembrete para @ana');
select is(pg_temp.minhas(), 0::bigint, 'Quem escreveu não recebe a própria menção');
reset role;
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000002' and comentario_id = 'c0000000-0000-0000-0000-000000000001' and lido_em is null and tipo = 'mencao'), 1::bigint, 'A pessoa marcada recebe uma mensagem não lida');

-- Então só a Bia vê a mensagem dela: nem o Caio, nem a administradora, nem outro escritório.
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.minhas(), 1::bigint, 'A pessoa marcada vê a mensagem');
select is((select count(*) from public.mensagens m join public.comentarios c on c.id = m.comentario_id where c.texto like 'Veja isto%'), 1::bigint, 'Ela lê o texto pelo comentário');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.minhas(), 0::bigint, 'Outra pessoa não vê a mensagem');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.minhas(), 0::bigint, 'Nem a administradora vê a mensagem de outra pessoa');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.minhas(), 0::bigint, 'Outro escritório não vê a mensagem');

-- Quando outra pessoa tenta marcar a mensagem da Bia como lida, então nada muda.
update public.mensagens set lido_em = now();
reset role;
select pg_temp.entrar(3); set local role authenticated;
update public.mensagens set lido_em = now();
reset role;
select is((select count(*) from public.mensagens where lido_em is null), 1::bigint, 'Só a própria pessoa marca como lida');

-- Quando alguém tenta criar ou apagar mensagem pela tela, então é recusado.
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.mensagens (escritorio_id, perfil_id) values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003') $$, '42501', null, 'Ninguém cria mensagem pela tela');
select throws_ok($$ delete from public.mensagens $$, '42501', null, 'Ninguém apaga mensagem pela tela');
select throws_ok($$ update public.mensagens set perfil_id = 'a0000000-0000-0000-0000-000000000003' $$, '42501', null, 'Só a data de leitura muda');
-- Quando a Bia marca como lida, então a mensagem fica lida.
update public.mensagens set lido_em = now();
reset role;
select is((select count(*) from public.mensagens where lido_em is null), 0::bigint, 'A própria pessoa marca como lida');

-- Quando a Ana edita o comentário e troca a Bia pelo Caio, então a mensagem da Bia some e o Caio recebe a dele.
select pg_temp.entrar(1); set local role authenticated;
update public.comentarios set texto = 'Agora com @caio' where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select array_agg(perfil_id) from public.mensagens where comentario_id = 'c0000000-0000-0000-0000-000000000001'), array['a0000000-0000-0000-0000-000000000003'::uuid], 'Quem deixou de ser marcado perde a mensagem, e quem passou a ser recebe');

-- Quando a Ana edita o comentário e mantém o Caio, então ele não recebe outra, e a dele continua como estava.
update public.mensagens set lido_em = now() where comentario_id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1); set local role authenticated;
update public.comentarios set texto = 'Agora com @caio, corrigido' where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*) from public.mensagens where comentario_id = 'c0000000-0000-0000-0000-000000000001'), 1::bigint, 'Corrigir o comentário não repete a mensagem');
select is((select count(*) from public.mensagens where comentario_id = 'c0000000-0000-0000-0000-000000000001' and lido_em is null), 0::bigint, 'Corrigir o comentário não torna a mensagem não lida');

-- Dado o Caio desativado, quando a Ana corrige o comentário mantendo o @caio, então a mensagem dele continua.
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000003';
select pg_temp.entrar(1); set local role authenticated;
update public.comentarios set texto = 'Agora com @caio, de novo' where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*) from public.mensagens where comentario_id = 'c0000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem foi desativado não perde a mensagem quando o comentário é corrigido');
update public.perfis set ativo = true where id = 'a0000000-0000-0000-0000-000000000003';

-- Quando o comentário é apagado, então a mensagem some junto.
select pg_temp.entrar(1); set local role authenticated;
delete from public.comentarios where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*) from public.mensagens), 0::bigint, 'Apagar o comentário apaga a mensagem');

-- Quando o cartão é excluído, então a mensagem some junto (LGPD).
select pg_temp.entrar(1); set local role authenticated;
select pg_temp.comentar('c0000000-0000-0000-0000-000000000002', 'Com @bia');
reset role;
delete from public.pessoas where id = '10000000-0000-0000-0000-000000000001';
select is((select count(*) from public.mensagens), 0::bigint, 'Excluir o cartão apaga a mensagem');

select * from finish();
rollback;
