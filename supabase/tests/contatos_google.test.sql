-- Pessoas no Google Contatos (#164, etapa 1): a fila, o gatilho, as regras de leitura e as funções do servidor.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Beto (usuário), e outro com Fabio (master); os dois com a conta Google ligada,
-- mas só o primeiro com a sincronização dos contatos ligada.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-contatos-google'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-contatos-google-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 3) n;
insert into privado.ligacoes (escritorio_id, provedor, conta_email, segredo_id, contatos_ativos)
values ('e0000000-0000-0000-0000-000000000001', 'google', 'contato@exemplo.test', vault.create_secret('token-do-escritorio-1', 'teste-contatos-1'), true),
       ('e0000000-0000-0000-0000-000000000002', 'google', 'outro@exemplo.test', vault.create_secret('token-do-escritorio-2', 'teste-contatos-2'), false);

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.id(p_quem int) returns uuid language sql immutable as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
create function pg_temp.na_fila(p_pessoa uuid) returns integer language sql as $$
  select versao from public.contatos_google_fila where pessoa_id = p_pessoa
$$;

-- ---------------------------------------------------------------------
-- O gatilho
-- ---------------------------------------------------------------------
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, telefones, emails, nascimento) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'pf', 'MARIA TESTE', '{38999990000}', '{maria@exemplo.test}', '1980-05-17');
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000001'), 1,
  'dado o escritório com a sincronização ligada, quando uma pessoa é cadastrada, então ela entra na fila');

insert into public.pessoas (id, escritorio_id, codigo, tipo, nome) values
  ('20000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'P1', 'pf', 'JOSE OUTRO');
select is(pg_temp.na_fila('20000000-0000-0000-0000-000000000001'), null,
  'dado o escritório com a conta ligada mas a sincronização desligada, quando uma pessoa é cadastrada, então ela não entra na fila');

update public.pessoas set nome = 'MARIA TESTE SOUZA' where id = '10000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000001'), 2,
  'quando o nome muda, então a mesma linha da fila ganha uma versão nova (não uma segunda linha)');

update public.pessoas set profissao = 'advogada' where id = '10000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000001'), 2,
  'quando muda só o que não vai ao Google (a profissão), então a fila não muda');

insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, arquivado_em) values
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'ARQUIVADA', now());
update public.pessoas set nome = 'ARQUIVADA EDITADA' where id = '10000000-0000-0000-0000-000000000002';
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000002'), null,
  'quando uma pessoa arquivada é cadastrada ou editada, então ela não entra na fila');
update public.pessoas set arquivado_em = null where id = '10000000-0000-0000-0000-000000000002';
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000002'), 1,
  'quando a pessoa é desarquivada, então ela entra na fila');

-- ---------------------------------------------------------------------
-- O que cada um vê pelo navegador
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*)::int from public.contatos_google_fila), 2, 'dado Ana (administradora), quando lê a fila, então vê as duas pessoas do escritório dela');
select is((select pendentes from public.sincronizacao_google()), 2, 'quando Ana pede a situação, então vê as duas pessoas esperando');
select is((select ativa from public.sincronizacao_google()), true, 'e a sincronização aparece ligada');
select throws_ok($$insert into public.contatos_google_fila (pessoa_id, escritorio_id) values ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'quando alguém tenta gravar na fila pelo navegador, então o banco recusa');
select throws_ok($$select public.contatos_google_pendentes(null, 10)$$, '42501', null,
  'quando alguém logado tenta pegar a fila das funções do servidor, então o banco recusa');
reset role;

select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.contatos_google_fila), 0, 'dado Beto (não administrador), quando lê a fila, então não vê nada');
select is((select count(*)::int from public.sincronizacao_google()), 0, 'e a situação vem vazia para ele');
select throws_ok($$select public.sincronizacao_google_ligar(false)$$, 'P0001', 'Apenas administradores ligam e desligam a sincronização dos contatos',
  'quando Beto tenta desligar a sincronização, então o banco recusa');
reset role;

select pg_temp.entrar(3); set local role authenticated;
select is((select count(*)::int from public.contatos_google_fila), 0, 'dado Fabio, de outro escritório, quando lê a fila, então não vê a do primeiro escritório');
select is((select pendentes from public.sincronizacao_google()), 0, 'e a situação dele mostra só a fila dele (vazia)');
reset role;

-- ---------------------------------------------------------------------
-- As funções do servidor
-- ---------------------------------------------------------------------
create temp table pegos as select * from public.contatos_google_pendentes(null, 10);
select is((select count(*)::int from pegos), 2, 'quando a função do servidor pega a fila, então vêm as duas pessoas do escritório com a sincronização ligada');
select is((select conta_email from pegos where pessoa_id = '10000000-0000-0000-0000-000000000001'), 'contato@exemplo.test',
  'e cada pessoa vem com a conta ligada do próprio escritório');
select is((select nome || '|' || array_to_string(telefones, ',') || '|' || nascimento from pegos where pessoa_id = '10000000-0000-0000-0000-000000000001'),
  'MARIA TESTE SOUZA|38999990000|1980-05-17', 'e com o nome, os telefones e o nascimento atuais');
select is((select count(*)::int from public.contatos_google_pendentes(null, 10)), 0,
  'quando outra execução pega a fila logo depois, então não recebe as mesmas pessoas (estão reservadas)');
select is((select tentativas from public.contatos_google_fila where pessoa_id = '10000000-0000-0000-0000-000000000001'), 1,
  'e a tentativa já conta');

-- Uma edição durante o envio: concluir a versão antiga não tira a pessoa da fila.
update public.pessoas set telefones = '{38999990000,3832221111}' where id = '10000000-0000-0000-0000-000000000001';
select public.contatos_google_concluir('10000000-0000-0000-0000-000000000001', 2, 'contato@exemplo.test', 'people/c123', 'etag-1');
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000001'), 3,
  'dada uma edição durante o envio, quando a versão antiga é concluída, então a pessoa continua na fila para levar a nova');
select is((select recurso || '|' || etag from public.contatos_google where pessoa_id = '10000000-0000-0000-0000-000000000001'), 'people/c123|etag-1',
  'e a ligação com o contato criado fica guardada (a próxima vez atualiza, não cria outro)');
select is((select recurso from public.contatos_google_pendentes(null, 10) where pessoa_id = '10000000-0000-0000-0000-000000000001'), 'people/c123',
  'quando a fila é pega de novo, então a pessoa vem com o contato já ligado');
select public.contatos_google_concluir('10000000-0000-0000-0000-000000000001', 3, 'contato@exemplo.test', 'people/c123', 'etag-2');
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000001'), null, 'quando a versão atual é concluída, então a pessoa sai da fila');
select is((select count(*)::int from public.contatos_google where pessoa_id = '10000000-0000-0000-0000-000000000001'), 1,
  'e continua havendo uma ligação só, com o etag novo');
select isnt((select contatos_sincronizado_em from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), null,
  'e a ligação marca quando sincronizou');

-- Falhas: temporária (espera) e de autorização (para a fila do escritório).
select public.contatos_google_falhou('10000000-0000-0000-0000-000000000002', 'temporario', 'Google respondeu 503', 60);
select ok((select proxima_em > now() and em_andamento_ate is null and erro = 'temporario' from public.contatos_google_fila where pessoa_id = '10000000-0000-0000-0000-000000000002'),
  'quando o Google está fora, então a pessoa continua na fila, liberada, esperando a próxima tentativa');
update public.contatos_google_fila set proxima_em = now() - interval '1 second', tentativas = 3 where pessoa_id = '10000000-0000-0000-0000-000000000002';
select pg_temp.entrar(1); set local role authenticated;
select is((select problema || '|' || com_falha from public.sincronizacao_google()), 'google-fora|1',
  'dada a 3ª tentativa falha com o Google fora, quando Ana pede a situação, então vê o problema e quantas pessoas falharam');
reset role;

create temp table pego as select * from public.contatos_google_pendentes(null, 10);
select public.contatos_google_falhou('10000000-0000-0000-0000-000000000002', 'autorizacao', 'invalid_grant', 3600);
select is((select contatos_problema from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 'autorizacao',
  'quando a autorização venceu, então a ligação do escritório marca o problema');
update public.contatos_google_fila set proxima_em = now() - interval '1 second' where pessoa_id = '10000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.contatos_google_pendentes(null, 10)), 0,
  'e a fila do escritório para (nada mais vai ao Google com a autorização vencida)');
select pg_temp.entrar(1); set local role authenticated;
select is((select problema from public.sincronizacao_google()), 'autorizacao', 'e Ana vê o problema de autorização, que vem antes do Google fora');
reset role;

select is(public.contatos_google_agora(pg_temp.id(2), 'aal1'), null, 'quando Beto (não administrador) pede "Sincronizar agora", então nada acontece');
select is(public.contatos_google_agora(pg_temp.id(3), 'aal1'), null, 'quando Fabio pede, com a sincronização desligada no escritório dele, então nada acontece');
select is(public.contatos_google_agora(pg_temp.id(1), 'aal1'), 'e0000000-0000-0000-0000-000000000001'::uuid,
  'quando Ana pede "Sincronizar agora", então recebe o escritório dela');
select is((select count(*)::int from public.contatos_google_pendentes('e0000000-0000-0000-0000-000000000001', 10)), 1,
  'e a fila dela volta a andar já');

update privado.ligacoes set contatos_problema = 'autorizacao' where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
update privado.ligacoes set ligado_em = now() where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is((select contatos_problema from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), null,
  'quando a conta é ligada de novo (autorização nova), então o problema de autorização some');

-- Desligar a sincronização e desligar a conta.
select pg_temp.entrar(1); set local role authenticated;
select public.sincronizacao_google_ligar(false);
reset role;
select is((select count(*)::int from public.contatos_google_fila where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0,
  'quando Ana desliga a sincronização, então a fila do escritório é esvaziada');
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome) values
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'pf', 'DEPOIS DE DESLIGAR');
select is(pg_temp.na_fila('10000000-0000-0000-0000-000000000003'), null, 'e quem é cadastrado depois não entra na fila');

select is((select resultado from public.ligacao_google_desligar_servidor(pg_temp.id(2), 'aal1')), 'sem-permissao',
  'quando Beto (não administrador) tenta desligar a conta pelo servidor, então o banco recusa');
select is((select resultado || '|' || token from public.ligacao_google_desligar_servidor(pg_temp.id(1), 'aal1')), 'desligada|token-do-escritorio-1',
  'quando Ana desliga a conta, então o servidor recebe o token do escritório dela, para revogá-lo no Google');
select is((select count(*)::int from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0, 'e a ligação some');
select is((select count(*)::int from vault.secrets where name = 'teste-contatos-1'), 0, 'e o token sai do cofre');
select is((select count(*)::int from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 1, 'e a conta do outro escritório continua ligada');
select is((select resultado from public.ligacao_google_desligar_servidor(pg_temp.id(1), 'aal1')), 'sem-ligacao',
  'quando Ana desliga de novo, sem conta ligada, então nada acontece');

select * from finish();
rollback;
