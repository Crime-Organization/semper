-- Google Meet no compromisso (#437), as correções da revisão: o "Sincronizar agora" tenta de novo a gravação recusada, e o
-- escritório isolado.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Beto (usuário), e outro com Fabio (master); os dois com a conta Google ligada, a
-- agenda e o Meet autorizados e as agendas ligadas.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-reunioes-correcoes'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-reunioes-correcoes-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test')) as x(n, e);
insert into privado.ligacoes (escritorio_id, provedor, conta_email, escopos, segredo_id, agendas_ativas)
select e, 'google', c,
  '{https://www.googleapis.com/auth/contacts,https://www.googleapis.com/auth/calendar.app.created,https://www.googleapis.com/auth/calendar.acls,https://www.googleapis.com/auth/calendar.events.owned,https://www.googleapis.com/auth/meetings.space.settings}',
  vault.create_secret('token-' || c, 'teste-reunioes-correcoes-' || c), true
from (values ('e0000000-0000-0000-0000-000000000001'::uuid, 'contato@exemplo.test'), ('e0000000-0000-0000-0000-000000000002'::uuid, 'outro@exemplo.test')) as x(e, c);

create function pg_temp.hoje() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
create function pg_temp.na_fila(p_item uuid) returns integer language sql as $$
  select versao from public.agendas_google_fila where assunto = 'compromisso' and item_id = p_item
$$;
create function pg_temp.gravada(p_escritorio uuid, p_compromisso uuid, p_conta text, p_gravacao text) returns void language sql as $$
  select public.agendas_google_reuniao_gravada(p_escritorio, p_compromisso, p_conta, 'r' || replace(p_compromisso::text, '-', ''),
    'https://meet.google.com/abc-mnop-xyz', null, p_gravacao, case when p_gravacao = 'recusada' then '403 PERMISSION_DENIED' end, 'a1b2')
$$;

-- E os compromissos com a opção do Meet: Ana com Beto amanhã (C1), Ana ontem (C2), Fabio amanhã, no outro escritório (C9).
set local session_replication_role = replica;
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, pessoas, pessoa_nome, criado_por, reuniao_google) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Amanhã', pg_temp.hoje() + 1, '14:00',
   'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{}', '', 'a0000000-0000-0000-0000-000000000001', true),
  ('72000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'C2', 'reuniao', 'Ontem', pg_temp.hoje() - 1, '10:00',
   'a0000000-0000-0000-0000-000000000001', '{}', '{}', '', 'a0000000-0000-0000-0000-000000000001', true),
  ('72000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'C9', 'reuniao', 'Do outro escritório', pg_temp.hoje() + 1, '10:00',
   'a0000000-0000-0000-0000-000000000003', '{}', '{}', '', 'a0000000-0000-0000-0000-000000000003', true);
set local session_replication_role = origin;

-- ---------------------------------------------------------------------
-- O "Sincronizar agora" tenta de novo a gravação recusada
-- ---------------------------------------------------------------------
select pg_temp.gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'recusada');
select pg_temp.gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', 'contato@exemplo.test', 'recusada');
select pg_temp.gravada('e0000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000009', 'outro@exemplo.test', 'recusada');
delete from public.agendas_google_fila;

select is(public.agendas_google_agora('a0000000-0000-0000-0000-000000000001', 'aal1'), 'e0000000-0000-0000-0000-000000000001'::uuid,
  'quando Ana pede "Sincronizar agora", então o escritório dela vai para a fila');
select is((select gravacao from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000001'), null,
  'e a gravação recusada da reunião de amanhã é esquecida (vai ser pedida de novo)');
select isnt(pg_temp.na_fila('72000000-0000-0000-0000-000000000001'), null, 'e o compromisso dela vai para a fila');
select is((select gravacao from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000002'), 'recusada',
  'e a da reunião de ontem fica como estava');
select is(pg_temp.na_fila('72000000-0000-0000-0000-000000000002'), null, 'e ela não vai para a fila');
select is((select gravacao from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000009'), 'recusada',
  'e a do outro escritório também fica como estava');
select is((select count(*)::int from public.agendas_google_fila where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 0,
  'e nada do outro escritório vai para a fila');
select is(public.agendas_google_agora('a0000000-0000-0000-0000-000000000002', 'aal1'), null,
  'e Beto, que não é administrador, não consegue pedir');

-- ---------------------------------------------------------------------
-- Trocar a conta: a reunião da conta antiga continua registrada até ser cancelada
-- ---------------------------------------------------------------------
update privado.ligacoes set conta_email = 'nova@exemplo.test' where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select lives_ok($$select pg_temp.gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'nova@exemplo.test', null)$$,
  'dado o escritório com outra conta ligada, quando a conta nova cria a reunião do mesmo compromisso, então o banco aceita');
select is((select string_agg(conta_email, ',' order by conta_email) from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000001'),
  'contato@exemplo.test,nova@exemplo.test', 'e a reunião da conta antiga continua registrada ao lado da nova (não é apagada)');
select pg_temp.gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'nova@exemplo.test', 'ligada');
select is(public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'reuniao' ->> 'gravacao', 'ligada',
  'e o servidor lê só a reunião da conta ligada agora');
select is((select gravacao from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000001' and conta_email = 'contato@exemplo.test'),
  null, 'e guardar a da conta nova não mexe na da antiga');

-- As reuniões da conta antiga que ainda vão acontecer (as que a troca cancela).
set local session_replication_role = replica;
insert into public.agenda_google_reunioes (escritorio_id, compromisso_id, conta_email, evento_id)
values ('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000077', 'contato@exemplo.test', 'r72000000000000000000000000000077');
set local session_replication_role = origin;
select results_eq($$select compromisso_id::text from public.agendas_google_reunioes_da_conta('e0000000-0000-0000-0000-000000000001', 'Contato@Exemplo.test')$$,
  $$values ('72000000-0000-0000-0000-000000000001'), ('72000000-0000-0000-0000-000000000077')$$,
  'quando o servidor pede as reuniões da conta antiga, então vêm a de amanhã e a do compromisso já excluído; a de ontem não');
select is((select count(*)::int from public.agendas_google_reunioes_da_conta('e0000000-0000-0000-0000-000000000001', 'outro@exemplo.test')), 0,
  'e a conta do outro escritório não traz nada dele por este escritório');
select lives_ok($$select public.agendas_google_reuniao_cancelada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'contato@exemplo.test')$$,
  'quando o servidor a cancela no Google, então o banco aceita');
select is((select string_agg(conta_email, ',') from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000001'),
  'nova@exemplo.test', 'e só a reunião da conta antiga é esquecida');
select is((select count(*)::int from public.agenda_google_reunioes where compromisso_id = '72000000-0000-0000-0000-000000000009'), 1,
  'e a do outro escritório continua');

-- Pelo navegador, não.
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.agendas_google_reunioes_da_conta('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test')$$, '42501', null,
  'e ninguém lê as reuniões de uma conta pelo navegador');
select throws_ok($$select public.agendas_google_reuniao_cancelada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'nova@exemplo.test')$$, '42501', null,
  'nem as esquece');
reset role;
update privado.ligacoes set conta_email = 'contato@exemplo.test' where escritorio_id = 'e0000000-0000-0000-0000-000000000001';

select * from finish();
rollback;
