-- A visão das salas na Agenda (#438): quem ocupa cada sala no dia, de todas as salas numa leitura só (public.ocupacao_das_salas).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi (master) em outro escritório, cada um com as suas salas.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-ocupacao', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-ocupacao-2', '{"pessoas": true}');
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

-- As salas e os compromissos, gravados direto (sem a regra de quem grava): duas salas aqui e uma no outro escritório.
insert into public.salas (id, escritorio_id, nome, capacidade) values
  ('5a000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Sala 1', 6),
  ('5a000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Sala 2', 4),
  ('5a000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'Sala de fora', 8);
insert into public.compromissos (escritorio_id, tipo, titulo, data, hora, hora_fim, responsavel_id, participantes, criado_por, sala_id) values
  -- da Bia, na sala 1
  ('e0000000-0000-0000-0000-000000000001', 'reuniao', 'Da Bia', '2026-12-01', '09:00', '10:00', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000001'),
  -- só da Ana, na sala 1 (a Bia não participa)
  ('e0000000-0000-0000-0000-000000000001', 'reuniao', 'Particular da Ana', '2026-12-01', '14:00', null, 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001'),
  -- da Ana com a Bia participando, na sala 2
  ('e0000000-0000-0000-0000-000000000001', 'reuniao', 'Com a Bia', '2026-12-01', '11:00', '12:30', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000002'),
  -- arquivado e de outro dia: não ocupam
  ('e0000000-0000-0000-0000-000000000001', 'reuniao', 'Arquivado', '2026-12-01', '16:00', null, 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'reuniao', 'Outro dia', '2026-12-02', '09:00', null, 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000002'),
  -- do outro escritório, no mesmo dia
  ('e0000000-0000-0000-0000-000000000002', 'reuniao', 'Do Davi', '2026-12-01', '09:00', null, 'a0000000-0000-0000-0000-000000000004', '{}', 'a0000000-0000-0000-0000-000000000004', '5a000000-0000-0000-0000-000000000009');
update public.compromissos set arquivado_em = now() where titulo = 'Arquivado';

-- ---------- todas as salas de uma vez ----------
-- Quando a Bia pede a ocupação das salas no dia, então vêm os compromissos ativos das duas salas, por sala e pela hora
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.ocupacao_das_salas('2026-12-01')), 3::bigint, 'Vêm os compromissos ativos de todas as salas no dia');
select is((select array_agg(o.hora::text order by o.hora) from public.ocupacao_das_salas('2026-12-01') o where o.sala_id = '5a000000-0000-0000-0000-000000000001'),
          array['09:00:00', '14:00:00'], 'Cada compromisso vem com a sala dele');
select is((select count(*) from public.ocupacao_das_salas('2026-12-01') o where o.sala_id = '5a000000-0000-0000-0000-000000000002'), 1::bigint,
          'O arquivado não ocupa a sala');
-- E é a mesma ocupação de cada sala (ocupacao_da_sala, #308)
select set_eq($$ select id, codigo, tipo, hora, hora_fim, titulo from public.ocupacao_das_salas('2026-12-01') where sala_id = '5a000000-0000-0000-0000-000000000001' $$,
              $$ select id, codigo, tipo, hora, hora_fim, titulo from public.ocupacao_da_sala('5a000000-0000-0000-0000-000000000001', '2026-12-01') $$,
              'É a mesma ocupação da sala, só que de todas de uma vez');

-- ---------- só ocupado, sem título ----------
-- Então o título vem dos que a Bia vê (o dela e o em que participa); do que é só da Ana, vem o código e o horário, sem o título
select is((select titulo from public.ocupacao_das_salas('2026-12-01') where hora = '09:00'), 'Da Bia', 'O título vem do compromisso de quem pergunta');
select is((select titulo from public.ocupacao_das_salas('2026-12-01') where hora = '11:00'), 'Com a Bia', 'O título vem do compromisso em que quem pergunta participa');
select ok((select titulo is null and codigo is not null and hora_fim is null from public.ocupacao_das_salas('2026-12-01') where hora = '14:00'),
          'De quem a Bia não participa, só que a sala está ocupada, com o código e o horário');
-- E a Ana (administradora) vê o título dele
select pg_temp.entrar(1);
select is((select titulo from public.ocupacao_das_salas('2026-12-01') where hora = '14:00'), 'Particular da Ana', 'Quem vê o compromisso vê o título');

-- ---------- o cancelado ----------
-- Dado o compromisso da Bia na coluna "Cancelado", quando se pede a ocupação, então ele não ocupa a sala
reset role;
update public.compromissos set etapa_id = (select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'compromissos' and nome = 'Cancelado')
  where titulo = 'Da Bia';
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.ocupacao_das_salas('2026-12-01') where hora = '09:00'), 0::bigint, 'O cancelado não ocupa a sala');

-- ---------- escritório isolado ----------
-- Quando o Davi, de outro escritório, pede a ocupação do mesmo dia, então vê só a sala dele, e nada das salas deste escritório
select pg_temp.entrar(4);
select is((select array_agg(distinct sala_id) from public.ocupacao_das_salas('2026-12-01')), array['5a000000-0000-0000-0000-000000000009'::uuid],
          'Outro escritório vê só as salas dele');
select is((select titulo from public.ocupacao_das_salas('2026-12-01')), 'Do Davi', 'E só os compromissos dele');
reset role;

-- ---------- quem pode chamar ----------
select ok(not has_function_privilege('anon', 'public.ocupacao_das_salas(date)', 'execute'), 'Quem não entrou não chama a função');
select ok(has_function_privilege('authenticated', 'public.ocupacao_das_salas(date)', 'execute'), 'Quem entrou chama a função');

select * from finish();
rollback;
