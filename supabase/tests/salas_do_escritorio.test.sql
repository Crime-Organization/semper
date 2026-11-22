-- Salas do escritório e agendamento interno, sem horário duplicado (#308). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi (master) em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-salas', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-salas-2', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Um compromisso da Bia, gravado como ela grava: reunião no dia 01/12/2026, na sala pedida.
create function pg_temp.reuniao(p_titulo text, p_hora time, p_fim time, p_sala uuid) returns void language sql as $$
  insert into public.compromissos (tipo, titulo, data, hora, hora_fim, responsavel_id, criado_por, sala_id)
  values ('reuniao', p_titulo, '2026-12-01', p_hora, p_fim, auth.uid(), auth.uid(), p_sala)
$$;
grant execute on function pg_temp.reuniao(text, time, time, uuid) to authenticated;

-- ---------- cadastrar ----------
-- Quando a Ana (administradora) cadastra duas salas, então elas ficam no escritório dela, com o nome limpo
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.salas (id, nome, capacidade, criado_por) values ('5a000000-0000-0000-0000-000000000001', '  Sala 1 ', 6, auth.uid()),
                   ('5a000000-0000-0000-0000-000000000002', 'Sala 2', 4, auth.uid()) $$, 'A administradora cadastra as salas');
select is((select nome from public.salas where id = '5a000000-0000-0000-0000-000000000001'), 'Sala 1', 'O nome fica sem espaços nas pontas');
select is((select escritorio_id from public.salas where id = '5a000000-0000-0000-0000-000000000001'), 'e0000000-0000-0000-0000-000000000001'::uuid, 'A sala é do escritório de quem cadastra');
-- Quando repete o nome (com outras maiúsculas), ou deixa sem capacidade, então é recusado
select throws_ok($$ insert into public.salas (nome, capacidade, criado_por) values ('SALA 1', 3, auth.uid()) $$, '23505', null, 'Duas salas não têm o mesmo nome');
select throws_ok($$ insert into public.salas (nome, criado_por) values ('Sala 3', auth.uid()) $$, '23502', null, 'A sala precisa da capacidade');
select throws_ok($$ insert into public.salas (nome, capacidade, criado_por) values ('Sala 3', 0, auth.uid()) $$, '23514', null, 'A capacidade é de pelo menos uma pessoa');

-- Dada a Bia (não é administradora), quando tenta cadastrar ou desativar uma sala, então não consegue; mas vê as salas
select pg_temp.entrar(2);
select throws_ok($$ insert into public.salas (nome, capacidade, criado_por) values ('Sala da Bia', 2, auth.uid()) $$, '42501', null, 'Só administrador cadastra sala');
update public.salas set ativa = false where id = '5a000000-0000-0000-0000-000000000002';
select is((select ativa from public.salas where id = '5a000000-0000-0000-0000-000000000002'), true, 'Só administrador desativa sala');
select is((select count(*) from public.salas), 2::bigint, 'Toda a equipe vê as salas');
select throws_ok($$ delete from public.salas where id = '5a000000-0000-0000-0000-000000000002' $$, '42501', null, 'Sala não se exclui');

-- Dado o Davi, de outro escritório, quando lê as salas, então não vê nenhuma; e não marca compromisso nelas
select pg_temp.entrar(4);
select is((select count(*) from public.salas), 0::bigint, 'Outro escritório não vê as salas');
select throws_ok($$ select pg_temp.reuniao('De fora', '08:00', null, '5a000000-0000-0000-0000-000000000001') $$, 'P0001', 'Sala não encontrada neste escritório.', 'Outro escritório não usa a sala');
select is((select count(*) from public.ocupacao_da_sala('5a000000-0000-0000-0000-000000000001', '2026-12-01')), 0::bigint, 'Outro escritório não vê quem ocupa a sala');
-- E, mesmo sendo administrador no escritório dele, não muda a sala do outro nem cadastra sala lá
update public.salas set nome = 'Tomada', ativa = false where id = '5a000000-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.salas (escritorio_id, nome, capacidade, criado_por) values ('e0000000-0000-0000-0000-000000000001', 'Sala de fora', 2, auth.uid()) $$,
                 '42501', null, 'Outro escritório não cadastra sala aqui');
reset role;
select is((select nome || ' ' || ativa from public.salas where id = '5a000000-0000-0000-0000-000000000001'), 'Sala 1 true', 'Outro escritório não muda a sala');
set local role authenticated;

-- ---------- conflito de horário ----------
-- Dada a sala 1 ocupada das 14h às 15h, quando a Bia marca outro compromisso nela às 14h30, então o banco recusa, dizendo com qual
select pg_temp.entrar(2);
select lives_ok($$ select pg_temp.reuniao('Das 14 às 15', '14:00', '15:00', '5a000000-0000-0000-0000-000000000001') $$, 'Marca a sala livre');
select throws_like($$ select pg_temp.reuniao('Às 14h30', '14:30', null, '5a000000-0000-0000-0000-000000000001') $$,
                   'A sala Sala 1 já está ocupada das 14:00 às 15:00 pelo compromisso %. Escolha outro horário ou outra sala.', 'A sala ocupada não aceita outro compromisso no mesmo horário');
-- Quando marca às 15h (quando o outro termina) ou em outra sala, então vale
select lives_ok($$ select pg_temp.reuniao('Às 15h', '15:00', null, '5a000000-0000-0000-0000-000000000001') $$, 'Começar quando o outro termina não é conflito');
select lives_ok($$ select pg_temp.reuniao('Na outra sala', '14:30', null, '5a000000-0000-0000-0000-000000000002') $$, 'Outra sala está livre');
-- Quando marca às 15h30, sem fim, então conflita com o das 15h (sem fim, ocupa a sala por 1 hora)
select throws_like($$ select pg_temp.reuniao('Às 15h30', '15:30', null, '5a000000-0000-0000-0000-000000000001') $$,
                   'A sala Sala 1 já está ocupada das 15:00 às 16:00 %', 'Sem hora de fim, o compromisso ocupa a sala por 1 hora');
-- Quando o das 15h muda para as 14h30, então também é recusado
select throws_like($$ update public.compromissos set hora = '14:30' where titulo = 'Às 15h' $$, 'A sala Sala 1 já está ocupada%', 'Mudar a hora também confere a sala');
-- Quando o das 14h às 15h é arquivado, então o horário fica livre
update public.compromissos set arquivado_em = now() where titulo = 'Das 14 às 15';
select lives_ok($$ select pg_temp.reuniao('Às 14h30, de novo', '14:30', '14:45', '5a000000-0000-0000-0000-000000000001') $$, 'O compromisso arquivado não ocupa a sala');
-- Quando o arquivado volta, então é recusado, porque o horário já foi tomado
select throws_like($$ update public.compromissos set arquivado_em = null where titulo = 'Das 14 às 15' $$, 'A sala Sala 1 já está ocupada%', 'Desarquivar confere a sala');

-- Quando a Bia pergunta quem ocupa a sala, então vê o código e o horário, e o título só dos que ela vê
select is((select count(*) from public.ocupacao_da_sala('5a000000-0000-0000-0000-000000000001', '2026-12-01')), 2::bigint, 'A ocupação mostra os compromissos ativos da sala no dia');
select is((select titulo from public.ocupacao_da_sala('5a000000-0000-0000-0000-000000000001', '2026-12-01') order by hora limit 1), 'Às 14h30, de novo', 'O título vem para quem vê o compromisso');
reset role;
insert into public.compromissos (escritorio_id, tipo, titulo, data, hora, responsavel_id, criado_por, sala_id)
  values ('e0000000-0000-0000-0000-000000000001', 'reuniao', 'Particular da Ana', '2026-12-01', '18:00', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001');
select pg_temp.entrar(2); set local role authenticated;
select ok((select titulo is null and codigo is not null from public.ocupacao_da_sala('5a000000-0000-0000-0000-000000000001', '2026-12-01') where hora = '18:00'),
          'De quem a Bia não vê, só o código e o horário');

-- ---------- desativar ----------
-- Dada a sala 2 desativada pela Ana, quando a Bia marca um compromisso novo nela, então é recusado; o antigo continua com ela
select pg_temp.entrar(1);
update public.salas set ativa = false where id = '5a000000-0000-0000-0000-000000000002';
select is((select ativa from public.salas where id = '5a000000-0000-0000-0000-000000000002'), false, 'A administradora desativa a sala');
select pg_temp.entrar(2);
select throws_like($$ select pg_temp.reuniao('Na desativada', '09:00', null, '5a000000-0000-0000-0000-000000000002') $$, 'A sala Sala 2 está desativada%', 'Sala desativada não aceita compromisso novo');
select is((select s.nome from public.compromissos c join public.salas s on s.id = c.sala_id where c.titulo = 'Na outra sala'), 'Sala 2', 'O compromisso antigo continua mostrando o nome da sala');
select lives_ok($$ update public.compromissos set titulo = 'Na outra sala (mudado)' where titulo = 'Na outra sala' $$, 'O compromisso antigo continua sendo mudado');
-- E o histórico mostra a sala pelo nome
select lives_ok($$ update public.compromissos set sala_id = null where titulo = 'Na outra sala (mudado)' $$, 'Tira a sala do compromisso');
reset role;
select is((select alteracoes -> 'sala' ->> 'de' from public.compromisso_historico h join public.compromissos c on c.id = h.compromisso_id
           where c.titulo = 'Na outra sala (mudado)' and h.alteracoes ? 'sala'), 'Sala 2', 'O histórico mostra o nome da sala');

-- ---------- cancelado ----------
-- Dado um compromisso na coluna "Cancelado", quando outro é marcado no mesmo horário, então vale
update public.compromissos set etapa_id = (select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'compromissos' and nome = 'Cancelado')
  where titulo = 'Particular da Ana';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ select pg_temp.reuniao('No lugar do cancelado', '18:00', null, '5a000000-0000-0000-0000-000000000001') $$, 'O compromisso cancelado não ocupa a sala');
reset role;

select * from finish();
rollback;
