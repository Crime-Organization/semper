-- Compromisso que se repete: o título, o local, a equipe e as pessoas "desta e das seguintes" (#417).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Bia e Caio (usuários comuns), e outro escritório com o Davi.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-campos-das-seguintes', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-campos-das-seguintes-2', '{"pessoas": true}');
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

-- Uma pessoa do cadastro de cada escritório, gravada direto.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'PESSOA UM', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'P2', 'contato', 'PESSOA DE FORA', 'a0000000-0000-0000-0000-000000000004');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.coluna(p_nome text) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'compromissos' and nome = p_nome
$$;
grant execute on function pg_temp.coluna(text) to authenticated;
create function pg_temp.hoje() returns date language sql as $$ select privado.hoje_da_agenda() $$;
grant execute on function pg_temp.hoje() to authenticated;
-- Lidos sem as regras, para conferir o que o banco gravou.
create function pg_temp.serie_de(p_id uuid) returns uuid language sql security definer as $$ select repeticao_id from public.compromissos where id = p_id $$;
create function pg_temp.vez(p_id uuid, p_n int) returns public.compromissos language sql security definer as $$
  select * from public.compromissos where repeticao_id = pg_temp.serie_de(p_id) order by repeticao_data offset p_n limit 1
$$;
create function pg_temp.inclusoes(p_quem int) returns bigint language sql security definer as $$
  select count(*) from public.mensagens_de_inclusao where perfil_id = ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid and modulo = 'compromissos'
$$;
grant execute on function pg_temp.serie_de(uuid) to authenticated;
grant execute on function pg_temp.vez(uuid, int) to authenticated;
grant execute on function pg_temp.inclusoes(int) to authenticated;

-- Dada uma reunião semanal da Bia, sem participantes e sem pessoas, e a quarta data já realizada
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, local, responsavel_id, criado_por, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000001', 'reuniao', 'Reunião antiga', pg_temp.hoje() + 1, '09:00', 'Sala de cima', auth.uid(), auth.uid(), pg_temp.coluna('Agendado'), 1);
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'semana', 1) $$, 'A Bia faz a reunião se repetir');
update public.compromissos set etapa_id = pg_temp.coluna('Realizado') where id = (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 3)).id;

-- ---------- outro escritório ----------
-- Quando o Davi, de outro escritório, tenta mudar as seguintes, então é recusado, e nada muda
select pg_temp.entrar(4);
select throws_ok(format('select public.compromisso_mudar_campos_seguintes(%L, %L)', (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
                        '{"titulo": "Do outro escritório"}'), '42501', 'Você não tem permissão para fazer isso.', 'Outro escritório não muda as seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).titulo, 'Reunião antiga', 'O título das seguintes não mudou');

-- ---------- quem não muda todas as seguintes ----------
-- Dado o Caio posto só na terceira data, quando ele tenta mudar o título dela e das seguintes, então é recusado
select pg_temp.entrar(2);
update public.compromissos set participantes = '{a0000000-0000-0000-0000-000000000003}' where id = (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).id;
select pg_temp.entrar(3);
select throws_ok(format('select public.compromisso_mudar_campos_seguintes(%L, %L)', (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).id,
                        '{"titulo": "Do Caio"}'), 'P0001',
                 'Há datas seguintes desta repetição que você não pode mudar. Mude só esta data ou peça a quem cuida da repetição.',
                 'Quem está numa data só não muda as seguintes');
select pg_temp.entrar(2);
update public.compromissos set participantes = '{}' where id = (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).id;
create temp table antes as select pg_temp.inclusoes(3) as caio;
grant select on antes to authenticated;

-- ---------- o que a Bia muda ----------
-- Quando a Bia muda, a partir da segunda data, o título, o local, os participantes (o Caio) e as pessoas
select ok(public.compromisso_mudar_campos_seguintes((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
            jsonb_build_object('titulo', '  Reunião nova ', 'local', 'Sala de baixo', 'participantes', jsonb_build_array('a0000000-0000-0000-0000-000000000003'),
                               'pessoas', jsonb_build_array('10000000-0000-0000-0000-000000000001'))) > 1,
          'A Bia muda as seguintes, e o banco diz quantas');
-- Então a terceira data tem os campos novos, com o título limpo pelo gatilho do compromisso
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).titulo, 'Reunião nova', 'O título passa às seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).local, 'Sala de baixo', 'O local passa às seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).participantes, '{a0000000-0000-0000-0000-000000000003}'::uuid[], 'Os participantes passam às seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).pessoas, '{10000000-0000-0000-0000-000000000001}'::uuid[], 'As pessoas passam às seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).pessoa_nome, 'PESSOA UM', 'Com o nome da pessoa copiado');
-- E a data aberta (a tela já a gravou), a primeira e a realizada não mudam
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).titulo, 'Reunião antiga', 'A data aberta não muda aqui');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 0)).titulo, 'Reunião antiga', 'A data anterior não muda');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 3)).titulo, 'Reunião antiga', 'A data realizada não muda');
-- E o Caio não recebe um aviso de inclusão por data
select is(pg_temp.inclusoes(3), (select caio from antes), 'As datas que o banco muda não avisam de inclusão');

-- Quando a Bia passa a responsabilidade ao Caio, então ele sai dos participantes das seguintes (o gatilho tira o responsável)
select lives_ok(format('select public.compromisso_mudar_campos_seguintes(%L, %L)', (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
                       '{"responsavel_id": "a0000000-0000-0000-0000-000000000003", "participantes": ["a0000000-0000-0000-0000-000000000002"]}'),
                'A Bia passa a responsabilidade das seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).responsavel_id, 'a0000000-0000-0000-0000-000000000003'::uuid, 'O Caio é o responsável das seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)).participantes, '{a0000000-0000-0000-0000-000000000002}'::uuid[], 'E a Bia, participante');

-- ---------- recusas ----------
select throws_ok(format('select public.compromisso_mudar_campos_seguintes(%L, %L)', (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
                        '{"sala_id": null}'), 'P0001', 'Só o título, o local, a equipe e as pessoas mudam nas datas seguintes.', 'Outro campo é recusado');
select throws_ok(format('select public.compromisso_mudar_campos_seguintes(%L, %L)', (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
                        '{"pessoas": ["10000000-0000-0000-0000-000000000002"]}'), 'P0001', 'Pessoa não encontrada neste escritório.',
                 'A pessoa de outro escritório é recusada');
select is(public.compromisso_mudar_campos_seguintes((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id, '{}'), 0, 'Sem campos, nada muda');
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, criado_por)
values ('7c000000-0000-0000-0000-000000000002', 'reuniao', 'Reunião única', pg_temp.hoje() + 2, '10:00', auth.uid(), auth.uid());
select throws_ok($$ select public.compromisso_mudar_campos_seguintes('7c000000-0000-0000-0000-000000000002', '{"titulo": "x"}') $$, 'P0001',
                 'Este compromisso não se repete.', 'O compromisso que não se repete não tem seguintes');

-- ---------- a administradora ----------
-- Quando a Ana, administradora, muda as seguintes de uma série da Bia, então pode
select pg_temp.entrar(1);
select lives_ok(format('select public.compromisso_mudar_campos_seguintes(%L, %L)', (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
                       '{"local": "Sala da Ana"}'), 'A administradora muda as seguintes');
select is((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 5)).local, 'Sala da Ana', 'O local novo chega às datas mais adiante');

select * from finish();
rollback;
