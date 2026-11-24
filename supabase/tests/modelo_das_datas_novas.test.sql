-- Compromisso que se repete: as datas novas copiam a última data em aberto da série (#417, 20261124144021_modelo_das_datas_novas.sql).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com a Bia (usuária comum), e outro escritório com o Davi.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-modelo-das-datas-novas', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-modelo-das-datas-novas-2', '{"pessoas": true}');
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
-- A última data da série e a primeira depois de um dia.
create function pg_temp.ultima(p_id uuid) returns public.compromissos language sql security definer as $$
  select * from public.compromissos where repeticao_id = pg_temp.serie_de(p_id) order by repeticao_data desc limit 1
$$;
create function pg_temp.depois_de(p_id uuid, p_dia date) returns public.compromissos language sql security definer as $$
  select * from public.compromissos where repeticao_id = pg_temp.serie_de(p_id) and repeticao_data > p_dia order by repeticao_data limit 1
$$;
-- Até onde a série já gerou.
create function pg_temp.gerada_ate(p_id uuid) returns date language sql security definer as $$
  select gerada_ate from public.compromisso_repeticoes where id = pg_temp.serie_de(p_id)
$$;
grant execute on function pg_temp.serie_de(uuid) to authenticated;
grant execute on function pg_temp.vez(uuid, int) to authenticated;
grant execute on function pg_temp.ultima(uuid) to authenticated;
grant execute on function pg_temp.depois_de(uuid, date) to authenticated;
grant execute on function pg_temp.gerada_ate(uuid) to authenticated;

-- ---------- a última data cancelada ----------
-- Dada uma reunião semanal sem fim da Bia, com a última data já gerada cancelada
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, local, responsavel_id, criado_por, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000001', 'reuniao', 'Reunião antiga', pg_temp.hoje() + 1, '09:00', 'Sala de cima', auth.uid(), auth.uid(), pg_temp.coluna('Agendado'), 1);
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'semana', 1) $$, 'A Bia faz a reunião se repetir, sem fim');
update public.compromissos set etapa_id = pg_temp.coluna('Cancelado') where id = (pg_temp.ultima('7c000000-0000-0000-0000-000000000001')).id;
-- Quando ela muda o título, o local e o horário desta e das seguintes (a última, cancelada, não muda)
select ok(public.compromisso_mudar_campos_seguintes((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
            '{"titulo": "Reunião nova", "local": "Sala de baixo"}') > 1, 'A Bia muda o título e o local das seguintes');
select ok(public.compromisso_mudar_seguintes((pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).id,
            (pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1)).data, '15:00') > 1, 'E o horário das seguintes');
select is((pg_temp.ultima('7c000000-0000-0000-0000-000000000001')).titulo, 'Reunião antiga', 'A data cancelada continua como estava');
create temp table antes as select pg_temp.gerada_ate('7c000000-0000-0000-0000-000000000001') as ate;
grant select on antes to authenticated;
-- E a rotina diária estende a série (simulada com o dia seguinte ao último gerado)
reset role;
select set_config('request.jwt.claims', '', true);
select ok(jsonb_array_length(privado.gerar_repeticoes(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), (select ate from antes) + 1) -> 'ids') > 0,
          'A rotina cria as datas seguintes');
-- Então a data nova vem com o título, o local e o horário novos, copiados da última data em aberto, não da cancelada
select is((pg_temp.depois_de('7c000000-0000-0000-0000-000000000001', (select ate from antes))).titulo, 'Reunião nova', 'A data nova tem o título novo');
select is((pg_temp.depois_de('7c000000-0000-0000-0000-000000000001', (select ate from antes))).local, 'Sala de baixo', 'E o local novo');
select is((pg_temp.depois_de('7c000000-0000-0000-0000-000000000001', (select ate from antes))).hora, '15:00'::time, 'E o horário novo');

-- ---------- nenhuma data em aberto ----------
-- Dada uma série em que todas as datas já foram realizadas, a última com outro título
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, criado_por, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000002', 'reuniao', 'Reunião realizada', pg_temp.hoje() + 1, '10:00', auth.uid(), auth.uid(), pg_temp.coluna('Agendado'), 1);
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000002', 'semana', 1) $$, 'A Bia faz outra reunião se repetir');
update public.compromissos set etapa_id = pg_temp.coluna('Realizado') where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002');
update public.compromissos set titulo = 'Última realizada' where id = (pg_temp.ultima('7c000000-0000-0000-0000-000000000002')).id;
drop table antes;
create temp table antes as select pg_temp.gerada_ate('7c000000-0000-0000-0000-000000000002') as ate;
-- Quando a rotina estende a série
reset role;
select ok(jsonb_array_length(privado.gerar_repeticoes(pg_temp.serie_de('7c000000-0000-0000-0000-000000000002'), (select ate from antes) + 1) -> 'ids') > 0,
          'Sem data em aberto, a série ainda cresce');
-- Então a data nova copia a última não arquivada, como antes
select is((pg_temp.depois_de('7c000000-0000-0000-0000-000000000002', (select ate from antes))).titulo, 'Última realizada',
          'Sem data em aberto, a data nova copia a última não arquivada');

-- ---------- outro escritório ----------
-- Quando o Davi, de outro escritório (ou qualquer pessoa logada), tenta gerar as datas de uma série, então não pode: só o banco chama
select pg_temp.entrar(4); set local role authenticated;
select throws_ok(format('select privado.gerar_repeticoes(%L, %L)', pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), pg_temp.hoje()),
                 '42501', null, 'Quem está logado não gera as datas de uma série');

select * from finish();
rollback;
