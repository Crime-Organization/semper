-- Acrescentar a um checklist, de uma vez, a lista colada (#375): checklist_acrescentar.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (responsável da demanda D1 e do contrato K1), Eli (sem vínculo) e Gil
-- (mencionado num comentário do K1), e o Davi em outro escritório, com a demanda D9.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-colar', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-colar-2', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eli@exemplo.test', 'Eli', 'usuario', privado.resumo_codigo('c5'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'gil@exemplo.test', 'Gil', 'usuario', privado.resumo_codigo('c6'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eli@exemplo.test', '{"convite":"c5"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'gil@exemplo.test', '{"convite":"c6"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now()),
  ('50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', now(), now());

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, objeto, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda da Bia', null, 'a0000000-0000-0000-0000-000000000002',
   '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda do Davi', null, 'a0000000-0000-0000-0000-000000000004',
   '{}', 'a0000000-0000-0000-0000-000000000004');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Benefício', '{Benefício previdenciário}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000001');
insert into public.comentarios (id, escritorio_id, contrato_id, autor_id, texto, mencoes) values
  ('cc000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '@gil veja',
   '{a0000000-0000-0000-0000-000000000006}');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Sem passar pelas regras (para conferir o que ficou gravado).
create function pg_temp.lista(p_nome text) returns uuid language sql security definer as $$
  select id from public.demanda_listas where nome = p_nome order by criado_em limit 1 $$;
create function pg_temp.grupo(p_lista uuid, p_nome text) returns uuid language sql security definer as $$
  select id from public.demanda_lista_grupos where lista_id = p_lista and nome = p_nome $$;
create function pg_temp.item(p_lista uuid, p_texto text) returns uuid language sql security definer as $$
  select id from public.demanda_lista_itens where lista_id = p_lista and texto = p_texto $$;
-- Quantos grupos e itens o checklist tem (para ver que nada ficou pela metade).
create function pg_temp.nos(p_lista uuid) returns bigint language sql security definer as $$
  select (select count(*) from public.demanda_lista_grupos where lista_id = p_lista) + (select count(*) from public.demanda_lista_itens where lista_id = p_lista) $$;
-- O checklist na ordem guardada: "grupo de cima > nome", para conferir os lugares.
create function pg_temp.lugares(p_lista uuid) returns text[] language sql security definer as $$
  select array_agg(coalesce(p.nome || ' > ', '') || x.nome order by x.ordem) from (
    select g.pai_id as pai, g.nome, g.ordem from public.demanda_lista_grupos g where g.lista_id = p_lista
    union all
    select i.grupo_id, i.texto, i.ordem from public.demanda_lista_itens i where i.lista_id = p_lista) x
  left join public.demanda_lista_grupos p on p.id = x.pai $$;

-- E, na D1, o checklist "Benefício": 1. Documentos pessoais › 1.1 RG, 1.2 CPF; 2. Benefício › 2.1 Aposentadoria por idade
-- › 2.1.1 CNIS (as "ordem" seguem a leitura); no K1, o checklist "Do contrato"; e, na D9, o "Do Davi".
select pg_temp.entrar(2); set local role authenticated;
select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000001', 'Benefício',
  '[{"chave": "g1", "pai": null, "nome": "Documentos pessoais", "ordem": 1}, {"chave": "g2", "pai": null, "nome": "Benefício", "ordem": 4},
    {"chave": "g3", "pai": "g2", "nome": "Aposentadoria por idade", "ordem": 5}]',
  '[{"pai": "g1", "texto": "RG", "ordem": 2}, {"pai": "g1", "texto": "CPF", "ordem": 3}, {"pai": "g3", "texto": "CNIS", "ordem": 6}]');
select public.checklist_criar('contratos', 'c0000000-0000-0000-0000-000000000001', 'Do contrato', '[]', '[{"pai": null, "texto": "Procuração", "ordem": 1}]');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000009', 'Do Davi', '[]', '[{"pai": null, "texto": "Do outro", "ordem": 1}]');
reset role;

-- A função passa pelas regras de quem chama, e só quem entrou a chama.
select is((select prosecdef from pg_proc where oid = 'public.checklist_acrescentar(uuid, uuid, jsonb, jsonb, jsonb)'::regprocedure), false,
  'checklist_acrescentar roda com as regras de quem chama (security invoker)');
select is(has_function_privilege('anon', 'public.checklist_acrescentar(uuid, uuid, jsonb, jsonb, jsonb)', 'execute'), false, 'Quem não entrou não a chama');

-- ===================== Grava tudo =====================

-- Quando a Bia cola no fim do checklist "3. Certidões › 3.1 Nascimento, 3.2 Casamento; 4. Foto" e usa os números como grupos
select pg_temp.entrar(2); set local role authenticated;
select is(cardinality(public.checklist_acrescentar(pg_temp.lista('Benefício'), null,
  '[{"texto": " Certidões ", "filhos": [{"texto": "Nascimento"}, {"texto": "Casamento"}]}, {"texto": "Foto"}]', '[7, 8, 9, 10]')), 1,
  'A responsável acrescenta a lista colada de uma vez, e o grupo novo vem na resposta');
reset role;
-- Então os grupos e os itens ficam nos lugares, com as "ordem" dadas e o nome sem espaços nas pontas
select is(pg_temp.lugares(pg_temp.lista('Benefício')),
  array['Documentos pessoais', 'Documentos pessoais > RG', 'Documentos pessoais > CPF', 'Benefício', 'Benefício > Aposentadoria por idade',
        'Aposentadoria por idade > CNIS', 'Certidões', 'Certidões > Nascimento', 'Certidões > Casamento', 'Foto'],
  'A lista colada entra no fim, com os itens dentro do grupo novo');

-- Quando a Bia acrescenta no grupo 1. um subgrupo vazio e um item, sem vão entre o CPF (3) e o Benefício (4) para dois: a tela
-- manda renumerar antes o que vem depois do grupo 1. (do Benefício à Foto, de 6 a 12), e os dois novos ficam no 4 e no 5
create function pg_temp.renumerar_depois_do_grupo_1() returns jsonb language sql security definer as $$
  select jsonb_agg(jsonb_build_object('id', v.id, 'tipo', v.tipo, 'pai_id', v.pai, 'ordem', v.ordem)) from (values
    (pg_temp.grupo(pg_temp.lista('Benefício'), 'Benefício'), 'grupo', null::uuid, 6),
    (pg_temp.grupo(pg_temp.lista('Benefício'), 'Aposentadoria por idade'), 'grupo', pg_temp.grupo(pg_temp.lista('Benefício'), 'Benefício'), 7),
    (pg_temp.item(pg_temp.lista('Benefício'), 'CNIS'), 'item', pg_temp.grupo(pg_temp.lista('Benefício'), 'Aposentadoria por idade'), 8),
    (pg_temp.grupo(pg_temp.lista('Benefício'), 'Certidões'), 'grupo', null, 9),
    (pg_temp.item(pg_temp.lista('Benefício'), 'Nascimento'), 'item', pg_temp.grupo(pg_temp.lista('Benefício'), 'Certidões'), 10),
    (pg_temp.item(pg_temp.lista('Benefício'), 'Casamento'), 'item', pg_temp.grupo(pg_temp.lista('Benefício'), 'Certidões'), 11),
    (pg_temp.item(pg_temp.lista('Benefício'), 'Foto'), 'item', null, 12)) as v(id, tipo, pai, ordem) $$;
select pg_temp.entrar(2); set local role authenticated;
select lives_ok(format($$ select public.checklist_acrescentar(%L, %L, '[{"texto": "Comprovantes", "filhos": []}, {"texto": "Título de eleitor"}]', '[4, 5]', %L) $$,
  pg_temp.lista('Benefício'), pg_temp.grupo(pg_temp.lista('Benefício'), 'Documentos pessoais'), pg_temp.renumerar_depois_do_grupo_1()),
  'Renumerar e acrescentar vão juntos');
reset role;
-- Então o subgrupo e o item entram no fim do grupo 1., antes do Benefício
select is((pg_temp.lugares(pg_temp.lista('Benefício')))[1:7],
  array['Documentos pessoais', 'Documentos pessoais > RG', 'Documentos pessoais > CPF', 'Documentos pessoais > Comprovantes',
        'Documentos pessoais > Título de eleitor', 'Benefício', 'Benefício > Aposentadoria por idade'],
  'O que entrou no grupo 1. fica no fim dele, e o Benefício, renumerado, logo depois');

-- ===================== Recusa sem gravar nada =====================

select pg_temp.entrar(2); set local role authenticated;
-- Quando a lista colada passaria de 3 níveis no fim do checklist, ou dentro do 2.1
select throws_ok(format($$ select public.checklist_acrescentar(%L, null,
  '[{"texto": "A", "filhos": [{"texto": "B", "filhos": [{"texto": "C", "filhos": [{"texto": "D"}]}]}]}]', '[20, 21, 22, 23]') $$, pg_temp.lista('Benefício')),
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'A lista colada com 4 níveis é recusada');
-- Quando tem 5 níveis (a conferência só desce até o 4º), com as posições de todos os nós ou faltando algumas: a recusa é a dos
-- níveis, como no banco fictício, e não a das posições
select throws_ok(format($$ select public.checklist_acrescentar(%L, null,
  '[{"texto": "A", "filhos": [{"texto": "B", "filhos": [{"texto": "C", "filhos": [{"texto": "D", "filhos": [{"texto": "E"}]}]}]}]}]', '[20, 21, 22, 23, 24]') $$,
  pg_temp.lista('Benefício')),
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'A lista colada com 5 níveis e todas as posições é recusada pelos níveis');
select throws_ok(format($$ select public.checklist_acrescentar(%L, null,
  '[{"texto": "A", "filhos": [{"texto": "B", "filhos": [{"texto": "C", "filhos": [{"texto": "D", "filhos": [{"texto": "E"}]}]}]}]}]', '[20, 21]') $$,
  pg_temp.lista('Benefício')),
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'Também quando faltam posições: os níveis vêm antes');
select throws_ok(format($$ select public.checklist_acrescentar(%L, %L, '[{"texto": "Certidões", "filhos": [{"texto": "Nascimento"}]}]', '[6.1, 6.2]') $$,
  pg_temp.lista('Benefício'), pg_temp.grupo(pg_temp.lista('Benefício'), 'Aposentadoria por idade')),
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1). Essa lista não cabe neste grupo: mantenha como itens ou cole no fim do checklist.',
  'Um grupo colado dentro do 2.1 é recusado, com o aviso de colar no fim');
-- Quando o item do meio passa do tamanho, ou vem vazio
select throws_ok(format($$ select public.checklist_acrescentar(%L, null,
  jsonb_build_array(jsonb_build_object('texto', 'Certidões', 'filhos', jsonb_build_array(jsonb_build_object('texto', repeat('x', 501)), '{"texto": "Casamento"}'::jsonb)),
                    '{"texto": "Foto"}'::jsonb), '[30, 31, 32, 33]') $$, pg_temp.lista('Benefício')),
  'P0001', 'O item pode ter até 500 caracteres.', 'Um item longo demais no meio recusa a lista inteira');
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Foto"}, {"texto": "  "}]', '[30, 31]') $$, pg_temp.lista('Benefício')),
  'P0001', 'Escreva o item.', 'Um item vazio também');
-- Quando o que renumerar tem um item de outro checklist (o checklist mudou), ou o grupo de destino é de outro checklist
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Foto 2"}]', '[40]',
  jsonb_build_array(jsonb_build_object('id', %L::uuid, 'tipo', 'item', 'pai_id', null, 'ordem', 1),
                    jsonb_build_object('id', %L::uuid, 'tipo', 'item', 'pai_id', null, 'ordem', 2))) $$,
  pg_temp.lista('Benefício'), pg_temp.item(pg_temp.lista('Benefício'), 'Foto'), pg_temp.item(pg_temp.lista('Do contrato'), 'Procuração')),
  'P0001', 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.', 'Renumerar um item de outro checklist desfaz tudo');
select throws_ok(format($$ select public.checklist_acrescentar(%L, %L, '[{"texto": "Foto 2"}]', '[40]') $$,
  pg_temp.lista('Do contrato'), pg_temp.grupo(pg_temp.lista('Benefício'), 'Documentos pessoais')),
  'P0001', 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.', 'O grupo de destino de outro checklist é recusado');
-- Quando as posições não batem com os nós, ou a árvore vem num formato estranho
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Foto 2"}, {"texto": "Foto 3"}]', '[40]') $$, pg_temp.lista('Benefício')),
  'P0001', 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.', 'Faltar a posição de um nó é recusado');
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Foto 2", "filhos": "nada"}]', '[40]') $$, pg_temp.lista('Benefício')),
  'P0001', 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.', 'Os filhos que não são uma lista também');
reset role;
-- Então nada disso ficou: o checklist tem os mesmos 12 grupos e itens, e a Foto continua no lugar
select is(pg_temp.nos(pg_temp.lista('Benefício')), 12::bigint, 'Nenhuma recusa deixou grupo ou item pela metade');
select is((pg_temp.lugares(pg_temp.lista('Benefício')))[12], 'Foto', 'Nem a renumeração recusada mudou o lugar da Foto');
select is(pg_temp.nos(pg_temp.lista('Do contrato')), 1::bigint, 'Nem o checklist do outro grupo de destino');

-- ===================== Quem não pode alterar o cartão =====================

-- Quando o Eli (sem vínculo com a demanda) tenta colar no checklist dela
select pg_temp.entrar(5); set local role authenticated;
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Do Eli"}]', '[50]') $$, pg_temp.lista('Benefício')),
  'P0001', 'Você não pode alterar este checklist.', 'Quem não vê a demanda não acrescenta ao checklist dela');
reset role;
-- Quando o Gil (só mencionado no contrato: lê, mas não altera) tenta colar no checklist do contrato
select pg_temp.entrar(6); set local role authenticated;
select isnt_empty($$ select 1 from public.demanda_listas where contrato_id = 'c0000000-0000-0000-0000-000000000001' $$, 'O mencionado lê o checklist do contrato');
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Do Gil", "filhos": [{"texto": "Item do Gil"}]}]', '[50, 51]') $$,
  pg_temp.lista('Do contrato')),
  'P0001', 'Você não pode alterar este checklist.', 'Mas não acrescenta a lista colada a ele');
reset role;
select is(pg_temp.nos(pg_temp.lista('Benefício')), 12::bigint, 'O checklist da demanda continua igual');
select is(pg_temp.nos(pg_temp.lista('Do contrato')), 1::bigint, 'E o do contrato também');

-- ===================== Outro escritório, nunca =====================

-- Quando o Davi (administrador do outro escritório) tenta colar no checklist da D1, ou no dele com um grupo da D1 de destino
select pg_temp.entrar(4); set local role authenticated;
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Do Davi"}]', '[60]') $$, pg_temp.lista('Benefício')),
  'P0001', 'Você não pode alterar este checklist.', 'O outro escritório não acrescenta ao checklist deste');
select throws_ok(format($$ select public.checklist_acrescentar(%L, %L, '[{"texto": "Do Davi"}]', '[60]') $$,
  pg_temp.lista('Do Davi'), pg_temp.grupo(pg_temp.lista('Benefício'), 'Documentos pessoais')),
  'P0001', 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.', 'Nem usa um grupo deste como destino');
select throws_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Do Davi"}]', '[60]',
  jsonb_build_array(jsonb_build_object('id', %L::uuid, 'tipo', 'item', 'pai_id', null, 'ordem', 1))) $$,
  pg_temp.lista('Do Davi'), pg_temp.item(pg_temp.lista('Benefício'), 'RG')),
  'P0001', 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.', 'Nem renumera um item deste');
-- E no checklist dele, ele cola
select lives_ok(format($$ select public.checklist_acrescentar(%L, null, '[{"texto": "Documentos", "filhos": [{"texto": "RG do Davi"}]}]', '[2, 3]') $$,
  pg_temp.lista('Do Davi')), 'No checklist do escritório dele, o Davi acrescenta a lista colada');
reset role;
select is(pg_temp.nos(pg_temp.lista('Benefício')), 12::bigint, 'O checklist deste escritório continua igual');
select is((select escritorio_id from public.demanda_lista_grupos where nome = 'Documentos' and lista_id = pg_temp.lista('Do Davi')),
  'e0000000-0000-0000-0000-000000000002'::uuid, 'O grupo colado pelo Davi fica no escritório dele');

select * from finish();
rollback;
