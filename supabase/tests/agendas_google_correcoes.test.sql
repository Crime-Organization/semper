-- Agendas do escritório no Google Agenda (#166): as correções da revisão. A recusa de um compartilhamento fica guardada
-- (sem travar a fila) e o administrador a vê; o estado e o item levam quando cada agenda foi criada.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Beto (usuário), e outro com Fabio (master); os dois com a agenda autorizada e as
-- agendas ligadas; no primeiro, a Geral e a agenda do Beto já criadas.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-correcoes-google'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-correcoes-google-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 3) n;
insert into privado.ligacoes (escritorio_id, provedor, conta_email, escopos, segredo_id, agendas_ativas)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid, 'google', c,
       '{https://www.googleapis.com/auth/contacts,https://www.googleapis.com/auth/calendar.app.created,https://www.googleapis.com/auth/calendar.acls}',
       vault.create_secret('token-' || n, 'teste-correcoes-' || n), true
from (values (1, 'contato@exemplo.test'), (2, 'outro@exemplo.test')) as x(n, c);
insert into public.agendas_google (id, escritorio_id, conta_email, tipo, perfil_id, google_id, nome, criada_em) values
  ('ac000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'geral', null, 'geral@google', 'Geral', '2026-11-01 10:00-03'),
  ('ac000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'pessoa', 'a0000000-0000-0000-0000-000000000002', 'beto@google',
   'Agenda – Beto', '2026-11-01 10:00-03'),
  ('ac000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'outro@exemplo.test', 'geral', null, 'outra@google', 'Geral', now());

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.id(p_quem int) returns uuid language sql immutable as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;

-- ---------------------------------------------------------------------
-- O compartilhamento recusado
-- ---------------------------------------------------------------------
select lives_ok($$select public.agendas_google_compartilhamento_recusado('ac000000-0000-0000-0000-000000000001', 'Fora@Gmail.test', pg_temp.id(2), '403 forbidden')$$,
  'quando o Google recusa compartilhar a Geral com o e-mail de fora do Beto, então a recusa é guardada');
select lives_ok($$select public.agendas_google_compartilhamento_recusado('ac000000-0000-0000-0000-000000000002', 'fora@gmail.test', pg_temp.id(2), '403 forbidden')$$,
  'e a da agenda dele também');
select is((select jsonb_agg(r order by r ->> 'agenda_id') from jsonb_array_elements(public.agendas_google_estado('e0000000-0000-0000-0000-000000000001') -> 'recusas') r),
  '[{"email": "fora@gmail.test", "agenda_id": "ac000000-0000-0000-0000-000000000001"}, {"email": "fora@gmail.test", "agenda_id": "ac000000-0000-0000-0000-000000000002"}]'::jsonb,
  'então o estado que a função do servidor lê traz as recusas (em minúsculas), para o plano pular só esse e-mail');
select is((select public.agendas_google_estado('e0000000-0000-0000-0000-000000000002') -> 'recusas'), '[]'::jsonb,
  'e o estado do outro escritório não traz as recusas deste');
select ok((select (public.agendas_google_estado('e0000000-0000-0000-0000-000000000001') -> 'agendas' -> 0 ->> 'criada_em') is not null),
  'e cada agenda vem com quando foi criada (um 404 numa agenda nova não a faz ser esquecida)');
select ok((select (public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'dia', gen_random_uuid()) -> 'agendas' -> 0 ->> 'criada_em') is not null),
  'e o item que a função lê também traz quando cada agenda foi criada');

select pg_temp.entrar(1); set local role authenticated;
select is((select array_agg(agenda || ': ' || email || ' (' || detalhe || ')' order by agenda) from public.agendas_google_recusas()),
  array['Agenda – Beto: fora@gmail.test (403 forbidden)', 'Geral: fora@gmail.test (403 forbidden)'],
  'dada Ana (administradora), então ela vê cada e-mail recusado, a agenda e o que o Google respondeu');
select throws_ok($$select public.agendas_google_compartilhamento_recusado('ac000000-0000-0000-0000-000000000001', 'x@exemplo.test', null, 'x')$$, '42501', null,
  'e nem ela grava uma recusa pelo navegador (só a função do servidor)');
select throws_ok($$insert into public.agenda_google_recusas (agenda_id, escritorio_id, email) values ('ac000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'x@exemplo.test')$$,
  '42501', null, 'nem direto na tabela');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.agendas_google_recusas()), 0, 'dado Beto (não administrador), então ele não vê as recusas');
select is((select count(*)::int from public.agenda_google_recusas), 0, 'nem na tabela');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*)::int from public.agendas_google_recusas()), 0, 'dado Fabio, do outro escritório, então ele não vê as recusas deste');
select is((select count(*)::int from public.agenda_google_recusas), 0, 'nem na tabela');
reset role;

select lives_ok($$select public.agendas_google_compartilhada('ac000000-0000-0000-0000-000000000002', 'FORA@gmail.test', pg_temp.id(2), 'user:fora@gmail.test')$$,
  'quando o compartilhamento recusado dá certo depois');
select is((select count(*)::int from public.agenda_google_recusas where agenda_id = 'ac000000-0000-0000-0000-000000000002'), 0, 'então a recusa dele sai');

select is(public.agendas_google_agora(pg_temp.id(1), 'aal1'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'quando Ana pede "Sincronizar agora"');
select is((select count(*)::int from public.agenda_google_recusas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0,
  'então as recusas do escritório saem (cada uma é tentada de novo)');

select public.agendas_google_compartilhamento_recusado('ac000000-0000-0000-0000-000000000001', 'fora@gmail.test', pg_temp.id(2), '403 forbidden');
select public.agendas_google_compartilhamento_recusado('ac000000-0000-0000-0000-000000000009', 'fora@gmail.test', null, '403 forbidden');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.agendas_google_ligar(true)$$, 'quando Ana liga as agendas de novo');
reset role;
select is((select count(*)::int from public.agenda_google_recusas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0,
  'então as recusas do escritório também saem');
select is((select count(*)::int from public.agenda_google_recusas where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 1,
  'e as do outro escritório ficam');

-- ---------------------------------------------------------------------
-- Nada que muda no SEMPER fica para trás no Google
-- ---------------------------------------------------------------------
create function pg_temp.hoje() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
-- A versão do pedido do item na fila (null: não está na fila).
create function pg_temp.na_fila(p_assunto text, p_item uuid) returns integer language sql as $$
  select versao from public.agendas_google_fila where assunto = p_assunto and item_id = p_item
$$;
-- Dados: uma coluna dos compromissos e uma das tarefas; um compromisso de amanhã (C1) com cópia na agenda do Beto, outro de
-- amanhã (C2) e um de ontem (C3), sem cópia, todos na coluna; e duas tarefas com prazo, na coluna das tarefas.
set local session_replication_role = replica;
insert into public.quadro_colunas (id, escritorio_id, modulo, nome) values
  ('c1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'compromissos', 'Agendado (teste)'),
  ('c1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'tarefas', 'Fazendo (teste)');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, pessoas, pessoa_nome, etapa_id, criado_por)
select ('72000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'C' || n, 'reuniao', 'Reunião ' || n, pg_temp.hoje() + d, '14:00',
       pg_temp.id(2), '{}', '{}', '', 'c1000000-0000-0000-0000-000000000001', pg_temp.id(1)
from (values (1, 1), (2, 1), (3, -1)) as x(n, d);
insert into public.tarefas (id, escritorio_id, codigo, titulo, prazo, responsavel_id, participantes, etapa_id, criado_por)
select ('70000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'T' || n, 'Tarefa ' || n, pg_temp.hoje() + 5,
       pg_temp.id(2), '{}', 'c1000000-0000-0000-0000-000000000002', pg_temp.id(1)
from generate_series(1, 2) n;
set local session_replication_role = origin;
select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000002', 'compromisso', '72000000-0000-0000-0000-000000000001',
  'c72000000000000000000000000000001', 'assinatura');

select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.agendas_google_ligar(false)$$, 'dado C1 com cópia no Google, quando Ana desliga as agendas');
reset role;
update public.compromissos set arquivado_em = now() where id = '72000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), null, 'e arquiva C1 com elas desligadas, então nada entra na fila');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.agendas_google_ligar(true)$$, 'quando Ana liga as agendas de novo');
reset role;
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 1,
  'então C1, arquivado mas com cópia no Google, entra na fila (para a cópia sair de lá)');
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000003'), null, 'e o compromisso de ontem, sem cópia, não entra');

delete from public.agendas_google_fila;
update public.tarefas set titulo = 'Tarefa 1 mudada' where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000001'), 1,
  'dada a tarefa T1 na fila e ainda sem cópia (a função do servidor pode estar gravando a primeira agora)');
delete from public.tarefas where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000001'), 2,
  'quando T1 é excluída, então a versão do pedido sobe (o concluir da versão antiga não o apaga, e a próxima passada tira a cópia)');

delete from public.agendas_google_fila;
update public.quadro_colunas set nome = 'Cancelado (teste)' where id = 'c1000000-0000-0000-0000-000000000001';
select is((select array_agg(item_id::text order by item_id) from public.agendas_google_fila where assunto = 'compromisso'),
  array['72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002'],
  'quando a coluna dos compromissos vira "Cancelado", então entram na fila o de amanhã e o que tem cópia (o de ontem, sem cópia, não)');
update public.quadro_colunas set ordem = 5 where id = 'c1000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000002'), 1, 'e só mudar a ordem da coluna não põe nada de novo na fila');
-- (o marco é um por quadro: a coluna que o tinha o perde antes)
update public.quadro_colunas set marco = null
where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'tarefas' and marco = 'concluido';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000002'), null, 'dada a tarefa T2 fora da fila');
update public.quadro_colunas set marco = 'concluido' where id = 'c1000000-0000-0000-0000-000000000002';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000002'), 1, 'quando a coluna das tarefas ganha o marco "concluido", então a tarefa nela entra na fila');

select * from finish();
rollback;
