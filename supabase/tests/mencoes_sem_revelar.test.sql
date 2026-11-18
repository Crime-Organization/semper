-- Menções nos comentários sem revelar itens a quem não os vê (#365).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora, advogada), Bia (advogada, que está no contrato, na demanda, na tarefa e no
-- compromisso), Caio (estagiário, fora de tudo) e Edu (advogado, fora de tudo), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-mencoes', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true, "compromissos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-mencoes-2', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "compromissos": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'edu@exemplo.test', 'Edu', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'edu@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now());

set local session_replication_role = replica;
update public.perfis set usuario = 'ana', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis set usuario = 'bia', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis set usuario = 'caio', funcao = 'estagiario' where id = 'a0000000-0000-0000-0000-000000000003';
update public.perfis set usuario = 'davi', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000004';
update public.perfis set usuario = 'edu', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000005';
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BIA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000002';
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, valor, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE', '{10000000-0000-0000-0000-000000000005}',
   'a0000000-0000-0000-0000-000000000001', 'Registro', '{Registro}', 'pro_labore', 9000, '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reuniao', '2030-01-15', '14:30', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- O item de cada módulo: a coluna do comentário e o id.
create function pg_temp.itens() returns table (modulo text, coluna text, item uuid) language sql as $$
  values ('no contrato', 'contrato_id', 'c0000000-0000-0000-0000-000000000001'::uuid), ('na demanda', 'demanda_id', '71000000-0000-0000-0000-000000000001'::uuid),
         ('na tarefa', 'tarefa_id', '70000000-0000-0000-0000-000000000001'::uuid), ('no compromisso', 'compromisso_id', '72000000-0000-0000-0000-000000000001'::uuid)
$$;
-- A recusa de sempre das regras de acesso: a mesma, palavra por palavra, em todos os casos de quem não pode comentar.
create function pg_temp.recusa_de_sempre() returns text language sql as $$ select 'new row violates row-level security policy for table "comentarios"' $$;
-- Para cada módulo, cada texto (sem menção, com menção válida, com menção recusada) e cada item (o que existe e um que não
-- existe), quem está logado tenta comentar, gravando (ou não) o escritório informado.
create function pg_temp.tentar_tudo(p_quem text, p_escritorio uuid) returns setof text language plpgsql as $$
declare i record; t text; existe boolean; v_item uuid; v_sql text;
begin
  for i in select * from pg_temp.itens() loop
    foreach t in array array['Sem menção nenhuma', 'Veja, @ana', 'Veja, @caio'] loop
      foreach existe in array array[true, false] loop
        v_item := case when existe then i.item else gen_random_uuid() end;
        v_sql := case when p_escritorio is null
                      then format('insert into public.comentarios (%I, texto) values (%L, %L)', i.coluna, v_item, t)
                      else format('insert into public.comentarios (escritorio_id, %I, texto) values (%L, %L, %L)', i.coluna, p_escritorio, v_item, t) end;
        return next throws_ok(v_sql, '42501', pg_temp.recusa_de_sempre(),
          format('%s, %s %s, com "%s": a recusa de sempre', p_quem, i.modulo, case when existe then 'que existe' else 'que não existe' end, t));
      end loop;
    end loop;
  end loop;
end $$;
-- O texto vazio é recusado pelo "preparar", que roda antes das regras de acesso: a mesma resposta no item que existe e no que
-- não existe, para quem não pode comentar (é o que o banco fictício imita). Não revela nada: não depende do item.
create function pg_temp.vazio_igual(p_quem text, p_escritorio uuid) returns setof text language plpgsql as $$
declare i record; existe boolean; v_item uuid; v_sql text;
begin
  for i in select * from pg_temp.itens() loop
    foreach existe in array array[true, false] loop
      v_item := case when existe then i.item else gen_random_uuid() end;
      v_sql := case when p_escritorio is null
                    then format('insert into public.comentarios (%I, texto) values (%L, %L)', i.coluna, v_item, '   ')
                    else format('insert into public.comentarios (escritorio_id, %I, texto) values (%L, %L, %L)', i.coluna, p_escritorio, v_item, '   ') end;
      return next throws_ok(v_sql, 'P0001', 'Escreva o comentário.',
        format('%s, %s %s, com o texto vazio: "Escreva o comentário."', p_quem, i.modulo, case when existe then 'que existe' else 'que não existe' end));
    end loop;
  end loop;
end $$;

-- Então os gatilhos: a conferência das menções roda depois das regras de acesso, e o "before" do compromisso saiu.
select hasnt_trigger('public', 'comentarios', 'preparar_mencao_no_compromisso', 'A conferência do compromisso não roda mais antes das regras');
select is((select tgtype & 2 = 0 from pg_trigger where tgrelid = 'public.comentarios'::regclass and tgname = 'conferir_mencoes'), true, 'A conferência do contrato, da demanda e da tarefa roda depois (after)');
select is((select tgtype & 2 = 0 from pg_trigger where tgrelid = 'public.comentarios'::regclass and tgname = 'conferir_mencao_no_compromisso'), true, 'A conferência do compromisso roda depois (after)');
select is((select tgtype & 2 <> 0 from pg_trigger where tgrelid = 'public.comentarios'::regclass and tgname = 'preparar'), true, 'O "preparar" continua antes de gravar (before)');

-- Quando o Edu, do escritório, mas fora de todos os itens, tenta comentar, então recebe sempre a recusa de sempre, sem nome.
select pg_temp.entrar(5); set local role authenticated;
select pg_temp.tentar_tudo('Quem não vê o item', null);
select pg_temp.vazio_igual('Quem não vê o item', null);
-- Quando o Davi, de outro escritório, forja o escritório do item, então recebe a mesma recusa.
reset role;
select pg_temp.entrar(4); set local role authenticated;
select pg_temp.tentar_tudo('Quem forja outro escritório', 'e0000000-0000-0000-0000-000000000001');
select pg_temp.vazio_igual('Quem forja outro escritório', 'e0000000-0000-0000-0000-000000000001');
-- Quando o Davi comenta no próprio escritório, apontando para os itens do outro, então também recebe a mesma recusa.
select pg_temp.tentar_tudo('Quem aponta para o item de outro escritório', null);
reset role;
select is((select count(*) from public.comentarios), 0::bigint, 'Nenhuma tentativa ficou gravada');
select is((select count(*) from public.mensagens), 0::bigint, 'Nenhuma tentativa deixou mensagem');

-- Quando a Bia, que está nos itens, menciona quem pode ser mencionado, então funciona como antes: o texto sem espaços nas
-- pontas, as menções achadas e a mensagem para quem foi mencionado.
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, contrato_id, texto) values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '  Veja, @ana  ') $$, 'No contrato, a Bia menciona a Ana');
select lives_ok($$ insert into public.comentarios (id, demanda_id, texto) values ('d0000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', '  Veja, @ana  ') $$, 'Na demanda, a Bia menciona a Ana');
select lives_ok($$ insert into public.comentarios (id, tarefa_id, texto) values ('d0000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '  Veja, @ana  ') $$, 'Na tarefa, a Bia menciona a Ana');
select lives_ok($$ insert into public.comentarios (id, compromisso_id, texto) values ('d0000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001', '  Veja, @ana  ') $$, 'No compromisso, a Bia menciona a Ana');
reset role;
select is((select count(*) from public.comentarios where texto = 'Veja, @ana' and mencoes = '{a0000000-0000-0000-0000-000000000001}' and autor_id = 'a0000000-0000-0000-0000-000000000002'), 4::bigint,
  'O "preparar" continua preparando antes de gravar: texto sem espaços nas pontas e as menções achadas');
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000001' and tipo = 'mencao' and lido_em is null), 4::bigint, 'A Ana recebe uma mensagem por comentário');

-- Quando a Bia menciona quem não pode ser mencionado, então a recusa é a de hoje, com o nome, e nada fica gravado.
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @caio') $$,
  'P0001', 'Não é possível mencionar Caio em contratos: só advogados podem ser mencionados.', 'No contrato, a recusa de hoje');
select throws_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Veja, @caio') $$,
  'P0001', 'Não é possível mencionar Caio nesta demanda: inclua essa pessoa como colaboradora antes.', 'Na demanda, a recusa de hoje');
select throws_ok($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000001', 'Veja, @caio') $$,
  'P0001', 'Não é possível mencionar Caio nesta tarefa: inclua essa pessoa como participante antes.', 'Na tarefa, a recusa de hoje');
select throws_ok($$ insert into public.comentarios (compromisso_id, texto) values ('72000000-0000-0000-0000-000000000001', 'Veja, @caio') $$,
  'P0001', 'Não é possível mencionar Caio neste compromisso: inclua essa pessoa como participante antes.', 'No compromisso, a recusa de hoje');
select throws_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', '   ') $$,
  'P0001', 'Escreva o comentário.', 'O texto vazio continua recusado');
-- Quando a Bia edita o próprio comentário para mencionar quem não pode, então a recusa é a de hoje e o comentário fica como estava.
select throws_ok($$ update public.comentarios set texto = 'Agora @caio' where id = 'd0000000-0000-0000-0000-000000000002' $$,
  'P0001', 'Não é possível mencionar Caio nesta demanda: inclua essa pessoa como colaboradora antes.', 'Na edição, a recusa de hoje');
select throws_ok($$ update public.comentarios set texto = 'Agora @caio' where id = 'd0000000-0000-0000-0000-000000000004' $$,
  'P0001', 'Não é possível mencionar Caio neste compromisso: inclua essa pessoa como participante antes.', 'Na edição do compromisso, a recusa de hoje');
reset role;
select is((select count(*) from public.comentarios where texto <> 'Veja, @ana' or editado_em is not null), 0::bigint, 'Nenhuma menção recusada ficou gravada, nem na edição');
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000003'), 0::bigint, 'Nenhuma menção recusada deixou mensagem');
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 4::bigint, 'A edição recusada não tirou a mensagem de quem já estava mencionado');

-- Quando a Bia edita a menção para quem pode, então funciona como antes: a data da edição fica, e a mensagem continua.
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ update public.comentarios set texto = 'De novo, @ana' where id = 'd0000000-0000-0000-0000-000000000003' $$), 1, 'Quem está na tarefa edita o próprio comentário');
reset role;
select is((select editado_em is not null from public.comentarios where id = 'd0000000-0000-0000-0000-000000000003'), true, 'Fica a data da edição');

-- Dado que a Bia saiu da demanda, da tarefa, do compromisso e do contrato
set local session_replication_role = replica;
update public.demandas set colaboradores = '{}' where id = '71000000-0000-0000-0000-000000000001';
update public.tarefas set participantes = '{}' where id = '70000000-0000-0000-0000-000000000001';
update public.compromissos set participantes = '{}' where id = '72000000-0000-0000-0000-000000000001';
update public.contratos set participantes = '[]' where id = 'c0000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
-- Quando ela tenta editar os próprios comentários, com ou sem filtro e com ou sem menção, então nada muda e nada é revelado.
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Agora @caio' $$), 0, 'Quem saiu não edita, sem filtro, com menção recusada (sem a recusa com o nome)');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Agora @ana' $$), 0, 'Quem saiu não edita, sem filtro, com menção válida');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Sem menção' where id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004') $$), 0, 'Quem saiu não edita, com filtro');
reset role;
select is((select count(*) from public.comentarios where texto in ('Veja, @ana', 'De novo, @ana')), 4::bigint, 'Os comentários ficaram como estavam');
select is((select count(*) from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000003'), 0::bigint, 'E ninguém foi mencionado por eles');

-- Quando a Ana, que está nos itens, edita o próprio comentário, então continua podendo (a regra nova só pede que se veja o item).
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (id, demanda_id, texto) values ('d0000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000001', 'Para mim') $$, 'A Ana comenta na demanda');
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Para mim, editado' where id = 'd0000000-0000-0000-0000-000000000005' $$), 1, 'E edita o próprio comentário');
reset role;

select * from finish();
rollback;
