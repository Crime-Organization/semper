-- Tarefa: aprovação interna antes de concluir (#313, parte D). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia e Caio (usuários comuns), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-aprovacao', '{"pessoas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-aprovacao-2', '{"pessoas": true, "tarefas": true}');
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
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 4) as n;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- A coluna das tarefas do escritório de teste: pelo marco ou, com 'aprovacao', a de aprovação; senão, pelo nome.
create function pg_temp.coluna(p_qual text) returns uuid language sql security definer as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'tarefas'
    and (marco = p_qual or (p_qual = 'aprovacao' and de_aprovacao) or nome = p_qual)
$$;
grant execute on function pg_temp.coluna(text) to authenticated;
-- O nome da coluna em que a tarefa está agora (lido sem as regras de quem vê).
create function pg_temp.onde(p_tarefa text) returns text language sql security definer as $$
  select c.nome from public.tarefas t join public.quadro_colunas c on c.id = t.etapa_id where t.id = p_tarefa::uuid
$$;
grant execute on function pg_temp.onde(text) to authenticated;
create function pg_temp.concluida_em(p_tarefa text) returns timestamptz language sql security definer as $$
  select concluida_em from public.tarefas where id = p_tarefa::uuid
$$;
grant execute on function pg_temp.concluida_em(text) to authenticated;

-- ---------- a coluna de aprovação ----------
-- Dado um escritório novo, então a coluna "Aguardando: análise do solicitante" das tarefas é a de aprovação (uma só)
select is((select string_agg(nome, ', ') from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and de_aprovacao),
  'Aguardando: análise do solicitante', 'O escritório novo nasce com a coluna de aprovação');
select throws_ok($$ update public.quadro_colunas set de_aprovacao = true where id = pg_temp.coluna('Fazendo') $$, '23505', null,
  'Só uma coluna de aprovação por escritório');

-- Dado um escritório que apagou a coluna (antes desta migração), quando a marcação roda, então ela é criada de novo, depois de "Fazendo"
update public.quadro_colunas set de_aprovacao = false where escritorio_id = 'e0000000-0000-0000-0000-000000000002' and de_aprovacao;
delete from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000002' and modulo = 'tarefas' and nome = 'Aguardando: análise do solicitante';
select privado.marcar_coluna_de_aprovacao('e0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000002' and de_aprovacao
  and nome = 'Aguardando: análise do solicitante'
  and ordem > (select ordem from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000002' and modulo = 'tarefas' and nome = 'Fazendo')),
  1::bigint, 'A coluna que faltava volta, depois de Fazendo');
-- E rodar de novo não repete nada
select privado.marcar_coluna_de_aprovacao('e0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000002' and modulo = 'tarefas'
  and nome = 'Aguardando: análise do solicitante'), 1::bigint, 'A coluna não se repete');

-- Quando a Ana (administradora) tenta excluir a coluna de aprovação, então nada sai; renomear pode
select pg_temp.entrar(1); set local role authenticated;
delete from public.quadro_colunas where id = pg_temp.coluna('aprovacao');
select isnt(pg_temp.coluna('aprovacao'), null, 'A coluna de aprovação não se exclui');
select lives_ok($$ update public.quadro_colunas set nome = 'Para aprovar' where id = pg_temp.coluna('aprovacao') $$, 'A coluna de aprovação pode ser renomeada');
select throws_ok($$ update public.quadro_colunas set de_aprovacao = false where id = pg_temp.coluna('aprovacao') $$, '42501', null,
  'Ninguém tira a marca pela tela');
select throws_ok($$ insert into public.quadro_colunas (modulo, nome, ordem, criado_por, de_aprovacao) values ('tarefas', 'Outra', 99, auth.uid(), true) $$, '42501', null,
  'Ninguém cria coluna de aprovação pela tela');

-- ---------- concluir manda para a aprovação ----------
-- Dada a tarefa da Bia (responsável) pedida pela Ana, com aprovação
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, precisa_aprovacao, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000001', 'Minutar a petição', 'a0000000-0000-0000-0000-000000000002', auth.uid(), true, auth.uid(), pg_temp.coluna('Fazendo'));
-- Quando a Bia a leva para a coluna das concluídas, então ela vai para a de aprovação, sem data de conclusão
select pg_temp.entrar(2);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000001'), 'Para aprovar', 'Concluir manda para a aprovação');
select is(pg_temp.concluida_em('70000000-0000-0000-0000-000000000001'), null, 'Sem aprovação, a tarefa não está concluída');

-- Quando a Bia tenta tirar a aprovação ou se pôr como solicitante, então é recusado
select throws_ok($$ update public.tarefas set precisa_aprovacao = false where id = '70000000-0000-0000-0000-000000000001' $$, 'P0001',
  'Só quem pediu a tarefa ou um administrador muda a aprovação ou o solicitante dela.', 'Quem executa não tira a aprovação');
select throws_ok($$ update public.tarefas set solicitante_id = auth.uid() where id = '70000000-0000-0000-0000-000000000001' $$, 'P0001',
  'Só quem pediu a tarefa ou um administrador muda a aprovação ou o solicitante dela.', 'Quem executa não troca o solicitante');
-- Quando a Bia tenta aprovar, então é recusado
select throws_ok($$ select public.tarefa_aprovar('70000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Só quem pediu a tarefa ou um administrador aprova ou devolve.', 'Quem executa não aprova');
-- Quando a Bia retira a tarefa da aprovação (o Desfazer), então pode
update public.tarefas set etapa_id = pg_temp.coluna('Fazendo') where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000001'), 'Fazendo', 'Quem executa pode retirar a tarefa da aprovação');
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000001';

-- ---------- devolver ----------
-- Quando a Ana devolve sem comentário, então é recusado
select pg_temp.entrar(1);
select throws_ok($$ select public.tarefa_devolver('70000000-0000-0000-0000-000000000001', '  ') $$, 'P0001', 'Diga o que precisa ser ajustado.', 'Devolver pede o comentário');
-- Quando a Ana devolve com comentário, então a tarefa volta para "Fazendo" e o comentário fica no cartão, com ela como autora
select is(public.tarefa_devolver('70000000-0000-0000-0000-000000000001', ' Falta o pedido de tutela. '), pg_temp.coluna('Fazendo'), 'Devolver diz para onde a tarefa voltou');
select is(pg_temp.onde('70000000-0000-0000-0000-000000000001'), 'Fazendo', 'A tarefa devolvida volta para Fazendo');
select is((select autor_id::text || ' ' || texto from public.comentarios where tarefa_id = '70000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001 Tarefa devolvida: Falta o pedido de tutela.', 'O comentário da devolução fica no cartão');
select throws_ok($$ select public.tarefa_devolver('70000000-0000-0000-0000-000000000001', 'De novo') $$, 'P0001', 'Esta tarefa não está esperando aprovação.',
  'Só se devolve a tarefa que espera aprovação');

-- ---------- aprovar ----------
-- Dada a tarefa de novo na aprovação, quando o solicitante (só lê a tarefa) aprova, então ela vai para as concluídas, com a data
update public.tarefas set solicitante_id = 'a0000000-0000-0000-0000-000000000003' where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.entrar(3);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000001'), 'Para aprovar', 'O solicitante que só lê não move a tarefa sozinho');
select is(public.tarefa_aprovar('70000000-0000-0000-0000-000000000001'), pg_temp.coluna('concluido'), 'Aprovar diz para onde a tarefa foi');
select is(pg_temp.onde('70000000-0000-0000-0000-000000000001'), 'Concluída', 'Aprovada, a tarefa vai para as concluídas');
select isnt(pg_temp.concluida_em('70000000-0000-0000-0000-000000000001'), null, 'Aprovada, a tarefa ganha a data de conclusão');

-- Dada uma tarefa sem aprovação, quando a Bia a conclui, então ela vai direto (como antes)
select pg_temp.entrar(1);
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000002', 'Tirar cópias', 'a0000000-0000-0000-0000-000000000002', auth.uid(), auth.uid(), pg_temp.coluna('Fazendo'));
select pg_temp.entrar(2);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000002';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000002'), 'Concluída', 'Sem a caixa, concluir vai direto');
-- Quando a Bia (quem executa) marca a caixa na tarefa que ainda não precisa de aprovação, então pode (o lápis deixa); desmarcar, não
select lives_ok($$ update public.tarefas set precisa_aprovacao = true where id = '70000000-0000-0000-0000-000000000002' $$,
  'Quem executa liga a aprovação');
select throws_ok($$ update public.tarefas set precisa_aprovacao = false where id = '70000000-0000-0000-0000-000000000002' $$, 'P0001',
  'Só quem pediu a tarefa ou um administrador muda a aprovação ou o solicitante dela.', 'Ligada, quem executa não a desliga');
select throws_ok($$ select public.tarefa_aprovar('70000000-0000-0000-0000-000000000002') $$, 'P0001',
  'Só quem pediu a tarefa ou um administrador aprova ou devolve.', 'Quem não pediu não aprova');

-- Dada uma tarefa com aprovação pedida pela própria Bia, quando ela a conclui, então vai direto (quem pede aprova)
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, precisa_aprovacao, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000003', 'Organizar a pasta', 'a0000000-0000-0000-0000-000000000003', auth.uid(), true, auth.uid(), pg_temp.coluna('Fazendo'));
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000003';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000003'), 'Concluída', 'O solicitante conclui direto');

-- ---------- o administrador que executa ----------
-- Dada uma tarefa que o Caio pediu à Ana (administradora), com aprovação
select pg_temp.entrar(3);
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, precisa_aprovacao, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000004', 'Revisar a minuta', 'a0000000-0000-0000-0000-000000000001', auth.uid(), true, auth.uid(), pg_temp.coluna('Fazendo'));
-- Quando a Ana a leva às concluídas, então ela também vai para a de aprovação (ser administradora não pula a aprovação de quem pediu)
select pg_temp.entrar(1);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000004';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000004'), 'Para aprovar', 'O administrador que executa também passa pela aprovação');
select is(pg_temp.concluida_em('70000000-0000-0000-0000-000000000004'), null, 'Sem aprovação, a tarefa do administrador não está concluída');
-- Quando a Ana a tira da coluna de aprovação para as concluídas (arrastando), então é a aprovação dela
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000004';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000004'), 'Concluída', 'Quem aprova, tirando da coluna de aprovação, conclui');
-- Dada a mesma tarefa de volta à aprovação, quando a Ana usa o Aprovar, então ela vai para as concluídas
update public.tarefas set etapa_id = pg_temp.coluna('Fazendo') where id = '70000000-0000-0000-0000-000000000004';
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000004';
select is(public.tarefa_aprovar('70000000-0000-0000-0000-000000000004'), pg_temp.coluna('concluido'), 'O administrador aprova pelo Aprovar');
select is(pg_temp.onde('70000000-0000-0000-0000-000000000004'), 'Concluída', 'Aprovada pelo administrador, a tarefa vai para as concluídas');
-- Sem ninguém logado (uma rotina), a tarefa vai direto
reset role;
select set_config('request.jwt.claims', '', true);
update public.tarefas set etapa_id = pg_temp.coluna('Fazendo') where id = '70000000-0000-0000-0000-000000000004';
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000004';
select is(pg_temp.onde('70000000-0000-0000-0000-000000000004'), 'Concluída', 'Sem ninguém logado, concluir vai direto');
set local role authenticated;

-- ---------- outro escritório ----------
-- Quando o Davi (administrador de outro escritório) tenta aprovar, então não acha a tarefa
select pg_temp.entrar(4);
select throws_ok($$ select public.tarefa_aprovar('70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Tarefa não encontrada neste escritório.',
  'Outro escritório não aprova');

select * from finish();
rollback;
