-- Tarefa: o solicitante e a função de cada participante (#313, parte B). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia, Caio e Eva (usuários comuns), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-funcoes', '{"pessoas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-funcoes-2', '{"pessoas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eva@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 5) as n;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.funcao(p_escritorio text, p_nome text) returns uuid language sql security definer as $$
  select id from public.funcoes_na_tarefa where escritorio_id = p_escritorio::uuid and nome = p_nome
$$;
grant execute on function pg_temp.funcao(text, text) to authenticated;
-- A função de um participante na tarefa T1, pelo nome dela.
create function pg_temp.funcao_de(p_quem int) returns text language sql security definer as $$
  select f.nome from public.tarefas t join public.funcoes_na_tarefa f on f.id::text = t.funcoes ->> ('a0000000-0000-0000-0000-00000000000' || p_quem)
  where t.id = '70000000-0000-0000-0000-000000000001'
$$;
grant execute on function pg_temp.funcao_de(int) to authenticated;

-- ---------- as funções de fábrica ----------
-- Dado um escritório novo, então ele nasce com "Executa" (de execução) e "Acompanha", nessa ordem
select is((select string_agg(nome || ':' || executa, ', ' order by ordem) from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'Executa:true, Acompanha:false', 'O escritório novo nasce com Executa e Acompanha');

-- Quando a Bia (não é administradora) lê, então vê as funções do escritório dela, e só as dele; mas não cria, não muda e não apaga
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.funcoes_na_tarefa), 2::bigint, 'A equipe lê as funções do próprio escritório');
select throws_ok($$ insert into public.funcoes_na_tarefa (nome, criado_por) values ('Revisa', auth.uid()) $$, '42501', null, 'Só administrador cria função');
update public.funcoes_na_tarefa set nome = 'Faz' where nome = 'Executa';
delete from public.funcoes_na_tarefa where nome = 'Acompanha';
select is((select string_agg(nome, ', ' order by ordem) from public.funcoes_na_tarefa), 'Executa, Acompanha', 'Só administrador muda ou apaga função');

-- Quando a Ana (administradora) cria uma função, então ela vai para o fim da lista, com o nome limpo; o nome repetido é recusado
select pg_temp.entrar(1);
select lives_ok($$ insert into public.funcoes_na_tarefa (nome, criado_por) values ('  Revisa ', auth.uid()) $$, 'A administradora cria a função');
select is((select nome || ':' || ordem from public.funcoes_na_tarefa where nome = 'Revisa'), 'Revisa:3', 'A função nova vem no fim, sem espaços');
select throws_ok($$ insert into public.funcoes_na_tarefa (nome, criado_por) values ('REVISA', auth.uid()) $$, '23505', null, 'Duas funções não têm o mesmo nome');

-- Dado o Davi, de outro escritório, então ele não vê nem muda as funções deste
select pg_temp.entrar(4);
select is((select count(*) from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0::bigint, 'Outro escritório não vê as funções');
update public.funcoes_na_tarefa set nome = 'Tomada' where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
delete from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000001';

-- ---------- a função de cada participante ----------
-- Quando a Ana cria a tarefa com a Bia executando e o Caio sem função escolhida, então o Caio fica com a padrão (Acompanha)
select pg_temp.entrar(1);
insert into public.tarefas (id, titulo, responsavel_id, participantes, funcoes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'Protocolar', auth.uid(), '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003}',
   jsonb_build_object('a0000000-0000-0000-0000-000000000002', pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Executa')), auth.uid());
select is(pg_temp.funcao_de(2), 'Executa', 'A função escolhida fica gravada');
select is(pg_temp.funcao_de(3), 'Acompanha', 'Quem entra sem função fica com a padrão');
select is((select participantes_com_funcao from public.tarefas where id = '70000000-0000-0000-0000-000000000001'),
  array['a0000000-0000-0000-0000-000000000002:' || pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Executa'),
        'a0000000-0000-0000-0000-000000000003:' || pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Acompanha')],
  'A lista dos filtros acompanha as funções');
-- Quando alguém tenta gravar a lista dos filtros à mão, então o banco recusa
select throws_ok($$ update public.tarefas set participantes_com_funcao = '{x:y}' where id = '70000000-0000-0000-0000-000000000001' $$, '42501', null,
  'A lista dos filtros não é gravada pela tela');

-- Quando a tarefa recebe a função de outro escritório, então é recusada
select throws_ok($$ update public.tarefas set funcoes = funcoes || jsonb_build_object('a0000000-0000-0000-0000-000000000003', pg_temp.funcao('e0000000-0000-0000-0000-000000000002', 'Executa'))
  where id = '70000000-0000-0000-0000-000000000001' $$, 'P0001', 'Função não encontrada neste escritório.', 'A função de outro escritório é recusada');

-- Quando a função do Caio é trocada, então o histórico mostra a troca pelos nomes
update public.tarefas set funcoes = funcoes || jsonb_build_object('a0000000-0000-0000-0000-000000000003', pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Revisa'))
where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.funcao_de(3), 'Revisa', 'A função é trocada depois');
select is((select alteracoes -> 'funcoes' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' order by em desc limit 1),
  '{"de": "Caio: Acompanha", "para": "Caio: Revisa"}'::jsonb, 'O histórico mostra a troca de função pelos nomes');

-- Quando a versão anterior do site põe a Eva e tira o Caio (só a lista), então a Eva ganha a padrão e o Caio sai das funções
update public.tarefas set participantes = '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000005}' where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.funcao_de(5), 'Acompanha', 'Quem entra pela lista ganha a padrão');
select is((select funcoes ? 'a0000000-0000-0000-0000-000000000003' from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), false, 'Quem sai sai também das funções');

-- Quando a Bia vira a responsável, então sai dos participantes e das funções
update public.tarefas set responsavel_id = 'a0000000-0000-0000-0000-000000000002' where id = '70000000-0000-0000-0000-000000000001';
select is((select funcoes ? 'a0000000-0000-0000-0000-000000000002' from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), false, 'O responsável não fica nas funções');

-- Quando a Ana tenta apagar a função em uso, então é recusado, dizendo onde; a que não está em uso sai
select throws_ok($$ delete from public.funcoes_na_tarefa where nome = 'Acompanha' $$, 'P0001',
  'A função "Acompanha" está em 1 tarefa. Troque a função dessas pessoas antes de apagá-la.', 'A função em uso não é apagada');
select lives_ok($$ delete from public.funcoes_na_tarefa where nome = 'Revisa' $$, 'A função fora de uso é apagada');
-- E a função muda de nome e de marca de execução
select lives_ok($$ update public.funcoes_na_tarefa set nome = 'Segue', executa = true where nome = 'Acompanha' $$, 'A administradora renomeia a função');
select is(pg_temp.funcao_de(5), 'Segue', 'O participante acompanha o nome novo da função');

-- ---------- o solicitante ----------
-- Quando a Ana põe a Eva como solicitante de uma tarefa em que ela não está, então a Eva a vê e comenta, mas não a altera
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, criado_por) values
  ('70000000-0000-0000-0000-000000000002', 'Pedido da Eva', auth.uid(), 'a0000000-0000-0000-0000-000000000005', auth.uid());
select is((select nome from public.perfis where id = (select solicitante_id from public.tarefas where id = '70000000-0000-0000-0000-000000000002')), 'Eva', 'O solicitante fica gravado');
select pg_temp.entrar(5);
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000002'), 1::bigint, 'O solicitante vê a tarefa');
select lives_ok($$ insert into public.comentarios (tarefa_id, autor_id, texto) values ('70000000-0000-0000-0000-000000000002', auth.uid(), 'Obrigada') $$, 'O solicitante comenta');
update public.tarefas set titulo = 'Mudado pela Eva' where id = '70000000-0000-0000-0000-000000000002';
select pg_temp.entrar(1);
select is((select titulo from public.tarefas where id = '70000000-0000-0000-0000-000000000002'), 'Pedido da Eva', 'O solicitante não altera a tarefa');

-- Quando o Caio comenta mencionando a Eva, então pode: ela vê a tarefa como solicitante
select lives_ok($$ insert into public.comentarios (tarefa_id, autor_id, texto, mencoes) values ('70000000-0000-0000-0000-000000000002', auth.uid(), '@Eva veja', '{a0000000-0000-0000-0000-000000000005}') $$,
  'O solicitante pode ser mencionado');

-- Quando o Caio (fora da tarefa) procura, então não a vê; e o solicitante de fora do escritório é recusado
select pg_temp.entrar(3);
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000002'), 0::bigint, 'Quem não está nela nem pediu não vê a tarefa');
select pg_temp.entrar(1);
select throws_ok($$ update public.tarefas set solicitante_id = 'a0000000-0000-0000-0000-000000000004' where id = '70000000-0000-0000-0000-000000000002' $$,
  'P0001', 'O solicitante precisa ser alguém da equipe do escritório.', 'O solicitante de outro escritório é recusado');

-- Quando o solicitante muda, então o histórico mostra os nomes
update public.tarefas set solicitante_id = 'a0000000-0000-0000-0000-000000000002' where id = '70000000-0000-0000-0000-000000000002';
select is((select alteracoes -> 'solicitante_id' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000002' order by em desc limit 1),
  '{"de": "Eva", "para": "Bia"}'::jsonb, 'O histórico mostra o solicitante pelo nome');

select * from finish();
rollback;
