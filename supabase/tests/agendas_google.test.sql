-- Agendas do escritório no Google Agenda (#166, parte 1): a permissão da agenda, o e-mail do Google de cada um, a chave,
-- a fila e os gatilhos, as regras de leitura e as funções do servidor.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Beto (usuário) e Caio (administrador), e outro com Fabio (master); os dois com a
-- conta Google ligada só com os contatos (a agenda ainda não autorizada).
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-agendas-google'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-agendas-google-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'admin', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test'), (4, 'caio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 4) n;
insert into privado.ligacoes (escritorio_id, provedor, conta_email, escopos, segredo_id)
values ('e0000000-0000-0000-0000-000000000001', 'google', 'contato@exemplo.test', '{https://www.googleapis.com/auth/contacts}', vault.create_secret('token-1', 'teste-agendas-1')),
       ('e0000000-0000-0000-0000-000000000002', 'google', 'outro@exemplo.test', '{https://www.googleapis.com/auth/contacts}', vault.create_secret('token-2', 'teste-agendas-2'));

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.id(p_quem int) returns uuid language sql immutable as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
create function pg_temp.versao(p_escritorio int) returns integer language sql as $$
  select versao from public.agendas_google_fila where escritorio_id = ('e0000000-0000-0000-0000-00000000000' || p_escritorio)::uuid and assunto = 'agendas'
$$;

-- ---------------------------------------------------------------------
-- A permissão da agenda, pedida aos poucos
-- ---------------------------------------------------------------------
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$select public.ligacao_google_iniciar_agendas('http://localhost:8091/configuracoes/')$$, 'P0001',
  'Apenas administradores autorizam a agenda na conta Google do escritório',
  'dado Beto (não administrador), quando pede para autorizar a agenda, então o banco recusa');
reset role;

select pg_temp.entrar(1); set local role authenticated;
create temp table pedido as select public.ligacao_google_iniciar_agendas('http://localhost:8091/configuracoes/') as estado;
reset role;
select is((select finalidade || '|' || conta_email from public.ligacao_pedido_conferir_finalidade((select estado from pedido))),
  'agendas|contato@exemplo.test', 'dado o pedido da agenda de Ana, quando a ida ao Google o confere, então ele é da agenda e já traz a conta ligada');
select is((select finalidade || '|' || coalesce(conta_email, '-') from public.ligacao_pedido_consumir((select estado from pedido), pg_temp.id(1), 'aal1')),
  'agendas|contato@exemplo.test', 'quando Ana conclui, então o pedido é consumido com a finalidade e a conta ligada');
select is((select count(*)::int from public.ligacao_pedido_consumir((select estado from pedido), pg_temp.id(1), 'aal1')), 0,
  'e o mesmo pedido não serve duas vezes');

select pg_temp.entrar(1); set local role authenticated;
create temp table pedido_contatos as select public.ligacao_google_iniciar('http://localhost:8091/configuracoes/') as estado;
reset role;
select is((select finalidade || '|' || coalesce(conta_email, '-') from public.ligacao_pedido_conferir_finalidade((select estado from pedido_contatos))),
  'contatos|-', 'dado o pedido de ligar a conta (os contatos), então ele não traz a conta ligada (pode ser outra)');
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$select * from public.ligacao_pedido_consumir('x', null, 'aal1')$$, '42501', null,
  'quando alguém logado tenta consumir um pedido pelo navegador, então o banco recusa');
reset role;

-- ---------------------------------------------------------------------
-- A chave das agendas
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select is((select ativa::text || '|' || autorizada::text from public.agendas_google_situacao()), 'false|false',
  'dada a conta ligada só com os contatos, então as agendas aparecem desligadas e sem a permissão da agenda');
select throws_ok($$select public.agendas_google_ligar(true)$$, 'P0001', 'Autorize a agenda na conta Google do escritório antes de ligar as agendas',
  'quando Ana tenta ligar as agendas sem a permissão da agenda, então o banco recusa');
reset role;

insert into public.salas (id, escritorio_id, nome, capacidade) values ('5a000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Sala 1', 4);
select is(pg_temp.versao(1), null, 'dadas as agendas desligadas, quando uma sala é criada, então nada entra na fila');

-- A agenda autorizada (como ligacao_guardar faz na conclusão).
update privado.ligacoes set escopos = escopos || '{https://www.googleapis.com/auth/calendar.app.created,https://www.googleapis.com/auth/calendar.acls}', ligado_em = now()
where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1); set local role authenticated;
select is((select autorizada from public.agendas_google_situacao()), true, 'dada a agenda autorizada, então a situação diz que está autorizada');
select lives_ok($$select public.agendas_google_ligar(true)$$, 'quando Ana liga as agendas, então o banco aceita');
select is((select ativa from public.agendas_google_situacao()), true, 'e elas aparecem ligadas');
select is((select pendentes from public.agendas_google_situacao()), 1, 'e o escritório entra na fila (para criar as agendas)');
reset role;
select is((select count(*)::int from public.auditoria where tabela = 'ligacoes' and resumo->>'agendas' = 'true'), 1, 'e a mudança fica no registro de ações');

select pg_temp.entrar(4); set local role authenticated;
select is((select ativa from public.agendas_google_situacao()), true, 'dado Caio (administrador), então ele também vê a situação');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.agendas_google_situacao()), 0, 'dado Beto (não administrador), então a situação vem vazia');
select throws_ok($$select public.agendas_google_ligar(false)$$, 'P0001', 'Apenas administradores ligam e desligam as agendas no Google',
  'e quando ele tenta desligar as agendas, o banco recusa');
select is((select count(*)::int from public.agendas_google_fila), 0, 'e ele não lê a fila');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is((select ativa from public.agendas_google_situacao()), false, 'dado Fabio, de outro escritório, então ele vê só as agendas do dele (desligadas)');
select is((select count(*)::int from public.agendas_google_fila), 0, 'e não lê a fila do primeiro escritório');
reset role;

-- ---------------------------------------------------------------------
-- Os gatilhos
-- ---------------------------------------------------------------------
create temp table v0 as select pg_temp.versao(1) as v;
update public.perfis set nome = 'Beto Souza' where id = pg_temp.id(2);
select is(pg_temp.versao(1), (select v from v0) + 1, 'dadas as agendas ligadas, quando alguém da equipe muda de nome, então o mesmo pedido ganha uma versão nova');
update public.perfis set preferencias = '{"tema": "escuro"}' where id = pg_temp.id(2);
select is(pg_temp.versao(1), (select v from v0) + 1, 'quando muda só o que não vai às agendas (as preferências), então a fila não muda');
update public.perfis set ativo = false where id = pg_temp.id(2);
select is(pg_temp.versao(1), (select v from v0) + 2, 'quando alguém é desativado, então o escritório vai para a fila (para retirar o compartilhamento)');
update public.perfis set ativo = true where id = pg_temp.id(2);
update public.salas set nome = 'Sala Azul' where id = '5a000000-0000-0000-0000-000000000001';
select is(pg_temp.versao(1), (select v from v0) + 4, 'quando alguém é reativado e uma sala muda de nome, então a fila ganha uma versão a cada mudança');
update auth.users set email = 'beto.novo@exemplo.test' where id = pg_temp.id(2);
select is(pg_temp.versao(1), (select v from v0) + 5, 'quando o e-mail de entrada de alguém muda, então o escritório vai para a fila');
update public.perfis set nome = 'Fabio Lima' where id = pg_temp.id(3);
select is(pg_temp.versao(2), null, 'dado o outro escritório com as agendas desligadas, quando alguém de lá muda, então nada entra na fila');

-- ---------------------------------------------------------------------
-- O e-mail do Google
-- ---------------------------------------------------------------------
select pg_temp.entrar(2); set local role authenticated;
select is((select coalesce(email, '-') || '|' || padrao from public.email_do_google(pg_temp.id(2))), '-|beto.novo@exemplo.test',
  'dado Beto sem e-mail do Google informado, então o dele é o de entrada');
-- Só os administradores mudam o e-mail do Google (decisão do dono: "pode ser trocado em Equipe"; migração
-- 20261125122303_email_do_google_so_administradores.sql). Antes, a própria pessoa também mudava, em Minha conta.
select throws_ok($$select public.email_do_google_salvar(pg_temp.id(2), '  Beto.Pessoal@Exemplo.test ')$$, 'P0001',
  'Só os administradores mudam o e-mail do Google, em Equipe e acessos.', 'quando Beto (não administrador) tenta informar o próprio e-mail do Google, então o banco recusa');
select is((select count(*)::int from public.email_do_google(pg_temp.id(1))), 0, 'quando Beto pede o e-mail do Google de Ana, então vem vazio');
select throws_ok($$select public.email_do_google_salvar(pg_temp.id(1), 'x@exemplo.test')$$, 'P0001', 'Apenas administradores mudam o e-mail do Google de alguém da equipe',
  'e quando ele tenta mudar o de Ana, o banco recusa');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$select public.email_do_google_salvar(pg_temp.id(2), 'sem-arroba')$$, 'P0001', 'Informe um e-mail válido.',
  'quando Caio (administrador) informa um e-mail inválido para Beto, então o banco recusa');
select lives_ok($$select public.email_do_google_salvar(pg_temp.id(2), '  Beto.Pessoal@Exemplo.test ')$$, 'quando Caio informa o e-mail do Google de Beto, então o banco aceita');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select email from public.email_do_google(pg_temp.id(2))), 'beto.pessoal@exemplo.test', 'e o e-mail fica guardado em minúsculas, e Beto o vê');
select is((select count(*)::int from public.emails_do_google), 1, 'e Beto lê só o próprio e-mail do Google');
reset role;
select is(pg_temp.versao(1), (select v from v0) + 6, 'e o e-mail do Google novo põe o escritório na fila');
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$select public.email_do_google_salvar(pg_temp.id(4), 'caio.proprio@exemplo.test')$$, 'quando Caio (administrador) muda o próprio, então o banco aceita');
select lives_ok($$select public.email_do_google_salvar(pg_temp.id(4), '')$$, 'e vazio volta ao de entrada');
reset role;

select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$select public.email_do_google_salvar(pg_temp.id(2), 'beto.escritorio@exemplo.test')$$, 'dado Caio (administrador), quando muda o e-mail do Google de Beto (usuário), então o banco aceita');
select throws_ok($$select public.email_do_google_salvar(pg_temp.id(1), 'ana@outro.test')$$, 'P0001', 'Só o próprio master muda o e-mail do Google dele.',
  'quando Caio tenta mudar o de Ana (master), então o banco recusa');
select is((select count(*)::int from public.emails_do_google), 1, 'e Caio lê os e-mails do Google do escritório');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.email_do_google_salvar(pg_temp.id(4), 'caio.pessoal@exemplo.test')$$, 'dada Ana (master), quando muda o de Caio (administrador), então o banco aceita');
select lives_ok($$select public.email_do_google_salvar(pg_temp.id(4), 'CAIO@exemplo.test')$$, 'quando Ana informa o e-mail de entrada de Caio');
select is((select coalesce(email, '-') from public.email_do_google(pg_temp.id(4))), '-', 'então ele volta ao de entrada (sem e-mail guardado)');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select throws_ok($$select public.email_do_google_salvar(pg_temp.id(2), 'x@exemplo.test')$$, 'P0001', 'Usuário não encontrado',
  'dado Fabio, de outro escritório, quando tenta mudar o e-mail do Google de Beto, então o banco recusa');
select is((select count(*)::int from public.emails_do_google), 0, 'e ele não lê os e-mails do Google do outro escritório');
select is((select count(*)::int from public.email_do_google(pg_temp.id(2))), 0, 'nem pela função');
select throws_ok($$insert into public.emails_do_google (perfil_id, escritorio_id, email) values (pg_temp.id(3), 'e0000000-0000-0000-0000-000000000002', 'f@exemplo.test')$$,
  '42501', null, 'quando alguém tenta gravar o e-mail do Google direto na tabela, então o banco recusa');
reset role;

-- ---------------------------------------------------------------------
-- As funções do servidor
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$select * from public.agendas_google_pendentes(null, 10)$$, '42501', null,
  'quando alguém logado tenta pegar a fila das funções do servidor, então o banco recusa');
select throws_ok($$select public.agendas_google_estado('e0000000-0000-0000-0000-000000000002')$$, '42501', null,
  'e quando tenta ler o estado das agendas de um escritório, também');
reset role;

create temp table pegos as select * from public.agendas_google_pendentes(null, 10);
select is((select count(*)::int from pegos), 1, 'quando a função do servidor pega a fila, então vem o pedido do escritório com as agendas ligadas');
select is((select assunto || '|' || conta_email || '|' || tentativas from pegos), 'agendas|contato@exemplo.test|1', 'com o assunto, a conta ligada e a tentativa já contada');
select is((select count(*)::int from public.agendas_google_pendentes(null, 10)), 0, 'e outra execução logo depois não pega o mesmo pedido (está reservado)');

create temp table estado as select public.agendas_google_estado('e0000000-0000-0000-0000-000000000001') as e;
select is((select e->>'conta_email' from estado), 'contato@exemplo.test', 'o estado traz a conta ligada');
select is((select jsonb_agg(m->>'email' order by m->>'nome') from estado, jsonb_array_elements(e->'equipe') m),
  '["ana@exemplo.test", "beto.escritorio@exemplo.test", "caio@exemplo.test"]'::jsonb,
  'e a equipe com o e-mail do Google de cada um (o informado, ou o de entrada)');
select is((select (m->>'admin') || '|' || (m->>'ativo') from estado, jsonb_array_elements(e->'equipe') m where m->>'nome' = 'Beto Souza'), 'false|true',
  'e quem é administrador e quem está ativo');
select is((select jsonb_agg(s->>'nome') from estado, jsonb_array_elements(e->'salas') s), '["Sala Azul"]'::jsonb, 'e as salas do escritório (só as dele)');

-- O plano criou a Geral e a compartilhou com Beto.
create temp table geral as select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'geral', null, null,
  'geral123@group.calendar.google.com', 'Geral') as id;
select public.agendas_google_compartilhada((select id from geral), 'Beto.Escritorio@exemplo.test', pg_temp.id(2), 'user:beto.escritorio@exemplo.test');
select is((select e->'agendas'->0->>'google_id' from (select public.agendas_google_estado('e0000000-0000-0000-0000-000000000001') e) x),
  'geral123@group.calendar.google.com', 'dada a Geral criada no Google, então o estado traz a agenda com o id do Google');
select is((select e->'compartilhamentos'->0->>'regra' from (select public.agendas_google_estado('e0000000-0000-0000-0000-000000000001') e) x),
  'user:beto.escritorio@exemplo.test', 'e o compartilhamento, com a regra para retirar depois');
select is(public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'geral', null, null, 'geral456@group.calendar.google.com', 'Geral'),
  (select id from geral), 'quando a mesma agenda é criada de novo (a outra sumiu), então a linha é a mesma, com o id novo');
select is((select count(*)::int from public.agenda_google_compartilhamentos), 0, 'e os compartilhamentos da agenda velha saem');
select public.agendas_google_compartilhada((select id from geral), 'beto.escritorio@exemplo.test', pg_temp.id(2), 'user:beto');
select public.agendas_google_retirada((select id from geral), 'BETO.escritorio@exemplo.test');
select is((select count(*)::int from public.agenda_google_compartilhamentos), 0, 'quando o compartilhamento é retirado, então ele sai');
select throws_ok($$select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'pessoa', null, null, 'x', 'Agenda')$$,
  '23514', null, 'quando uma agenda de pessoa vem sem a pessoa, então o banco recusa');

select pg_temp.entrar(1); set local role authenticated;
select is((select agendas from public.agendas_google_situacao()), 1, 'dada a Geral criada, então Ana vê uma agenda na situação');
select is((select count(*)::int from public.agendas_google), 1, 'e lê a agenda do escritório');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.agendas_google), 0, 'e Beto (não administrador) não lê as agendas');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*)::int from public.agendas_google), 0, 'e Fabio, de outro escritório, também não');
reset role;

-- Uma mudança durante a execução: concluir a versão antiga não tira o pedido da fila.
update public.perfis set nome = 'Beto S.' where id = pg_temp.id(2);
select public.agendas_google_concluir((select id from pegos), (select versao from pegos), false);
select is((select count(*)::int from public.agendas_google_fila where em_andamento_ate is null and tentativas = 0), 1,
  'dada uma mudança durante a execução, quando a versão antiga é concluída, então o pedido continua na fila, liberado, para levar a mudança');
select isnt((select agendas_sincronizado_em from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), null,
  'e a hora da sincronização fica guardada');
create temp table pegos2 as select * from public.agendas_google_pendentes('e0000000-0000-0000-0000-000000000001', 10);
select public.agendas_google_concluir((select id from pegos2), (select versao from pegos2), true);
select is((select count(*)::int from public.agendas_google_fila), 1, 'quando a execução acaba com coisas por fazer, então o pedido fica na fila');
create temp table pegos3 as select * from public.agendas_google_pendentes('e0000000-0000-0000-0000-000000000001', 10);
select is((select tentativas from pegos3), 1, 'e volta na próxima execução, sem contar como falha');
select public.agendas_google_concluir((select id from pegos3), (select versao from pegos3), false);
select is((select count(*)::int from public.agendas_google_fila), 0, 'quando a versão atual termina, então o pedido sai da fila');

-- A falha de autorização para a fila do escritório.
select pg_temp.entrar(1);
select public.agendas_google_ligar(true);
create temp table pegos4 as select * from public.agendas_google_pendentes(null, 10);
select public.agendas_google_falhou((select id from pegos4), 'autorizacao', '401', 60);
select is((select agendas_problema from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 'autorizacao',
  'dada a autorização recusada pelo Google, então o problema fica marcado na ligação');
select is((select erro || '|' || (proxima_em > now()) from public.agendas_google_fila), 'autorizacao|true', 'e o pedido espera, com o erro');
update public.agendas_google_fila set proxima_em = now();
select is((select count(*)::int from public.agendas_google_pendentes(null, 10)), 0, 'e a fila do escritório para, mesmo com a espera vencida');
select pg_temp.entrar(1); set local role authenticated;
select is((select problema from public.agendas_google_situacao()), 'autorizacao', 'e Ana vê o problema em Configurações');
reset role;
select is(public.agendas_google_agora(pg_temp.id(2), 'aal1'), null, 'quando Beto (não administrador) pede "Sincronizar agora", então nada acontece');
select is(public.agendas_google_agora(pg_temp.id(1), 'aal1'), 'e0000000-0000-0000-0000-000000000001'::uuid,
  'quando Ana pede "Sincronizar agora", então o escritório dela é liberado');
select is((select agendas_problema from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), null, 'e o problema some (se continuar, a função marca de novo)');
select is(public.agendas_google_agora(pg_temp.id(3), 'aal1'), null, 'quando Fabio pede "Sincronizar agora", então nada acontece (as agendas dele estão desligadas)');

-- Três falhas mostram o aviso.
update public.agendas_google_fila set tentativas = 3, erro = 'temporario', em_andamento_ate = null;
select pg_temp.entrar(1); set local role authenticated;
select is((select com_falha || '|' || problema from public.agendas_google_situacao()), '1|google-fora', 'dado um pedido que falhou 3 vezes com o Google fora, então Ana vê o aviso');
select lives_ok($$select public.agendas_google_ligar(false)$$, 'quando Ana desliga as agendas');
select is((select pendentes from public.agendas_google_situacao()), 0, 'então a fila esvazia');
reset role;
select is((select count(*)::int from public.agendas_google), 1, 'e as agendas já criadas ficam (nada é apagado no Google)');

-- A conta desligada esvazia a fila.
select pg_temp.entrar(1);
select public.agendas_google_ligar(true);
select is((select count(*)::int from public.agendas_google_fila), 1, 'dadas as agendas ligadas de novo, então o escritório volta para a fila');
delete from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.agendas_google_fila), 0, 'quando a conta Google é desligada, então a fila das agendas esvazia');

-- A rotina: sem fila, não chama nada.
select set_config('request.jwt.claims', '', true);
select lives_ok($$select privado.chamar_sincronizacao_das_agendas()$$, 'quando a rotina roda sem nada na fila, então não faz nada');
select is((select count(*)::int from cron.job where jobname = 'sincronizar-agendas-google' and schedule = '*/2 * * * *'), 1, 'e ela está agendada a cada 2 minutos');

select * from finish();
rollback;
