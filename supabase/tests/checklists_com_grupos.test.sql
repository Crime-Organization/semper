-- Checklists com grupos e subgrupos numerados, também no contrato (#309).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (responsável da demanda D1 e do contrato K1), Caio (participante do K1 pela
-- pessoa dele), Eli (sem vínculo) e Gil (mencionado num comentário do K1), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-checklists', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-checklists-2', '{"pessoas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eli@exemplo.test', 'Eli', 'usuario', privado.resumo_codigo('c5'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'gil@exemplo.test', 'Gil', 'usuario', privado.resumo_codigo('c6'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eli@exemplo.test', '{"convite":"c5"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'gil@exemplo.test', '{"convite":"c6"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now()),
  ('50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', now(), now());

-- E os cartões: a demanda D1 e o contrato K1 da Bia (com o Caio de participante), o contrato K2 arquivado e, no outro
-- escritório, uma demanda. A Ana menciona o Gil num comentário do K1.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'pf', 'CAIO', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000003' where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.demandas (id, escritorio_id, codigo, titulo, objeto, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda da Bia', null, 'a0000000-0000-0000-0000-000000000002',
   '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Benefício', 'Benefício previdenciário', 'a0000000-0000-0000-0000-000000000002',
   '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda do Davi', null, 'a0000000-0000-0000-0000-000000000004',
   '{}', 'a0000000-0000-0000-0000-000000000004');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por, arquivado_em, arquivado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Benefício', '{Benefício previdenciário}', 'pro_labore', 9000, 1000, 8, 30,
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000003", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001', null, null),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AA11', 2030, 'AA11-0002-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Arquivado', '{Arquivado}', 'pro_labore', 9000, 1000, 8, 30,
   '[]', 'a0000000-0000-0000-0000-000000000001', now(), 'a0000000-0000-0000-0000-000000000001');
insert into public.comentarios (id, escritorio_id, contrato_id, autor_id, texto, mencoes) values
  ('cc000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '@gil veja',
   '{a0000000-0000-0000-0000-000000000006}');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- Sem passar pelas regras (para conferir o que ficou gravado).
create function pg_temp.lista(p_nome text) returns uuid language sql security definer as $$
  select id from public.demanda_listas where nome = p_nome order by criado_em limit 1 $$;
create function pg_temp.grupo(p_lista uuid, p_nome text) returns uuid language sql security definer as $$
  select id from public.demanda_lista_grupos where lista_id = p_lista and nome = p_nome $$;
create function pg_temp.item(p_lista uuid, p_texto text) returns uuid language sql security definer as $$
  select id from public.demanda_lista_itens where lista_id = p_lista and texto = p_texto $$;
create function pg_temp.quantos(p_sql text) returns bigint language plpgsql security definer as $$
declare n bigint; begin execute 'select count(*) from (' || p_sql || ') x' into n; return n; end $$;
-- O exemplo do dono: 1. Documentos pessoais › 1.1 RG, 1.2 CPF; 2. Benefício › 2.1 Aposentadoria por idade › 2.1.1 CNIS,
-- 2.1.2 Carteira de trabalho; 2.2 Auxílio-doença › 2.2.1 Laudo médico. As "ordem" seguem a leitura.
create function pg_temp.grupos_do_exemplo() returns jsonb language sql as $$ select '[
  {"chave": "g1", "pai": null, "nome": "Documentos pessoais", "ordem": 1},
  {"chave": "g2", "pai": null, "nome": "Benefício", "ordem": 4},
  {"chave": "g3", "pai": "g2", "nome": "Aposentadoria por idade", "ordem": 5},
  {"chave": "g4", "pai": "g2", "nome": "Auxílio-doença", "ordem": 8}]'::jsonb $$;
create function pg_temp.itens_do_exemplo() returns jsonb language sql as $$ select '[
  {"pai": "g1", "texto": "RG", "ordem": 2}, {"pai": "g1", "texto": "CPF", "ordem": 3},
  {"pai": "g3", "texto": "CNIS", "ordem": 6}, {"pai": "g3", "texto": "Carteira de trabalho", "ordem": 7},
  {"pai": "g4", "texto": "Laudo médico", "ordem": 9}]'::jsonb $$;

-- ===================== Contrato =====================

-- Quando a Bia (responsável) cria no K1 o checklist do exemplo, de uma vez
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ select public.checklist_criar('contratos', 'c0000000-0000-0000-0000-000000000001', 'Benefício do contrato',
  pg_temp.grupos_do_exemplo(), pg_temp.itens_do_exemplo()) $$, 'A responsável cria um checklist no contrato');
reset role;
-- Então o checklist é do contrato, com os grupos e os itens nos lugares
select is((select contrato_id from public.demanda_listas where id = pg_temp.lista('Benefício do contrato')), 'c0000000-0000-0000-0000-000000000001'::uuid,
  'O checklist fica no contrato');
select results_eq(format($$ select g.nome, p.nome from public.demanda_lista_grupos g left join public.demanda_lista_grupos p on p.id = g.pai_id
  where g.lista_id = %L order by g.ordem $$, pg_temp.lista('Benefício do contrato')),
  $$ values ('Documentos pessoais'::text, null::text), ('Benefício', null), ('Aposentadoria por idade', 'Benefício'), ('Auxílio-doença', 'Benefício') $$,
  'Os grupos e os subgrupos ficam com o grupo de cima certo');
select results_eq(format($$ select i.texto, g.nome from public.demanda_lista_itens i join public.demanda_lista_grupos g on g.id = i.grupo_id
  where i.lista_id = %L order by i.ordem $$, pg_temp.lista('Benefício do contrato')),
  $$ values ('RG'::text, 'Documentos pessoais'::text), ('CPF', 'Documentos pessoais'), ('CNIS', 'Aposentadoria por idade'),
            ('Carteira de trabalho', 'Aposentadoria por idade'), ('Laudo médico', 'Auxílio-doença') $$,
  'Cada item fica no grupo dele');

-- Quando o Caio (participante pela pessoa dele) acrescenta um item e o marca, então ele consegue
select pg_temp.entrar(3); set local role authenticated;
select lives_ok(format($$ insert into public.demanda_lista_itens (lista_id, texto, ordem) values (%L, 'Procuração', 10) $$, pg_temp.lista('Benefício do contrato')),
  'O participante acrescenta um item');
select is(pg_temp.mudou($$ update public.demanda_lista_itens set feito_em = now() where texto = 'Procuração' $$), 1, 'E o marca como feito');
reset role;

-- Quando o Gil (só mencionado) abre o contrato, então ele lê o checklist, mas não mexe
select pg_temp.entrar(6); set local role authenticated;
select isnt_empty($$ select 1 from public.demanda_listas where contrato_id = 'c0000000-0000-0000-0000-000000000001' $$, 'O mencionado lê o checklist do contrato');
select isnt_empty($$ select 1 from public.demanda_lista_itens i join public.demanda_listas l on l.id = i.lista_id
  where l.contrato_id = 'c0000000-0000-0000-0000-000000000001' $$, 'E os itens');
select isnt_empty($$ select 1 from public.demanda_lista_grupos g join public.demanda_listas l on l.id = g.lista_id
  where l.contrato_id = 'c0000000-0000-0000-0000-000000000001' $$, 'E os grupos');
select throws_ok(format($$ insert into public.demanda_lista_itens (lista_id, texto, ordem) values (%L, 'Do Gil', 11) $$, pg_temp.lista('Benefício do contrato')),
  '42501', null, 'O mencionado não acrescenta item');
select throws_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome) values (%L, 'Do Gil') $$, pg_temp.lista('Benefício do contrato')),
  '42501', null, 'Nem grupo');
select is(pg_temp.mudou($$ update public.demanda_lista_itens set feito_em = now() where texto = 'RG' $$), 0, 'Nem marca um item');
reset role;

-- Quando o Eli (sem vínculo) procura, então não vê o checklist do contrato
select pg_temp.entrar(5); set local role authenticated;
select is_empty($$ select 1 from public.demanda_listas where contrato_id = 'c0000000-0000-0000-0000-000000000001' $$, 'Quem não está no contrato não vê o checklist dele');
reset role;
-- Com "equipe_ve_tudo", então o Eli vê, mas não altera
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(5); set local role authenticated;
select isnt_empty($$ select 1 from public.demanda_listas where contrato_id = 'c0000000-0000-0000-0000-000000000001' $$, 'Com "equipe_ve_tudo", a equipe lê o checklist do contrato');
select throws_ok(format($$ insert into public.demanda_lista_itens (lista_id, texto, ordem) values (%L, 'Do Eli', 12) $$, pg_temp.lista('Benefício do contrato')),
  '42501', null, 'Mas não acrescenta item');
reset role;
-- Com "equipe_ve_tudo" e "equipe_edita_tudo", então o Eli altera e cria grupo
update public.escritorios set modulos = modulos || '{"equipe_edita_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.mudou($$ update public.demanda_lista_itens set feito_em = now() where texto = 'CPF' $$), 1, 'Com as duas chaves, a equipe marca um item do contrato');
select lives_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome, ordem) values (%L, 'Do Eli', 20) $$, pg_temp.lista('Benefício do contrato')),
  'E cria grupo');
reset role;
-- E o Gil (mencionado) também altera, como nos processos do contrato
select pg_temp.entrar(6); set local role authenticated;
select is(pg_temp.mudou($$ update public.demanda_lista_itens set feito_em = null where texto = 'CPF' $$), 1, 'Na fase de adaptação, o mencionado altera');
reset role;
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' - 'equipe_edita_tudo' where id = 'e0000000-0000-0000-0000-000000000001';

-- Quando o Davi (outro escritório) tenta, então não vê nada e não cria checklist no K1
select pg_temp.entrar(4); set local role authenticated;
select is_empty($$ select 1 from public.demanda_listas $$, 'O outro escritório não vê checklist nenhum');
select is_empty($$ select 1 from public.demanda_lista_grupos $$, 'Nem grupo');
select throws_ok($$ select public.checklist_criar('contratos', 'c0000000-0000-0000-0000-000000000001', 'Do Davi') $$, '42501', null,
  'Nem cria checklist no contrato de outro escritório');
reset role;

-- Quando um checklist é de dois cartões, ou de nenhum, então é recusado
select throws_ok($$ insert into public.demanda_listas (escritorio_id, demanda_id, contrato_id, nome) values ('e0000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dois donos') $$, '23514', null, 'Checklist da demanda e do contrato juntos é recusado');
select throws_ok($$ insert into public.demanda_listas (escritorio_id, nome) values ('e0000000-0000-0000-0000-000000000001', 'Sem dono') $$, '23514', null,
  'Checklist sem cartão é recusado');

-- Quando a Ana exclui o contrato arquivado K2, então os checklists, os grupos e os itens dele vão junto
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.checklist_criar('contratos', 'c0000000-0000-0000-0000-000000000002', 'Do arquivado',
  pg_temp.grupos_do_exemplo(), pg_temp.itens_do_exemplo()) $$, 'A administradora cria checklist no contrato arquivado (só a tela trava)');
select is(pg_temp.mudou($$ delete from public.contratos where id = 'c0000000-0000-0000-0000-000000000002' $$), 1, 'E exclui o contrato arquivado');
reset role;
select is(pg_temp.quantos($$ select 1 from public.demanda_listas where contrato_id = 'c0000000-0000-0000-0000-000000000002' or nome = 'Do arquivado' $$), 0::bigint,
  'O checklist do contrato excluído some');
select is(pg_temp.quantos($$ select 1 from public.demanda_lista_grupos g where not exists (select 1 from public.demanda_listas l where l.id = g.lista_id) $$), 0::bigint,
  'E os grupos dele');
select is(pg_temp.quantos($$ select 1 from public.demanda_lista_itens i where not exists (select 1 from public.demanda_listas l where l.id = i.lista_id) $$), 0::bigint,
  'E os itens dele');

-- ===================== A versão anterior do site =====================

-- Quando a Bia grava como a versão no ar (21df890): a lista com a demanda e o item sem grupo
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.demanda_listas (demanda_id, nome, ordem) values ('71000000-0000-0000-0000-000000000001', 'Como antes', 1) $$,
  'A lista gravada como antes passa');
select lives_ok($$ insert into public.demanda_lista_itens (lista_id, texto, ordem) select id, 'Item de antes', 1 from public.demanda_listas where nome = 'Como antes' $$,
  'E o item sem grupo também');
select is((select grupo_id from public.demanda_lista_itens where texto = 'Item de antes'), null::uuid, 'O item de antes fica no primeiro nível');
-- E um checklist com grupos na demanda
select lives_ok($$ select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000001', 'Benefício da demanda',
  pg_temp.grupos_do_exemplo(), pg_temp.itens_do_exemplo()) $$, 'Cria o checklist do exemplo na demanda');
-- Então a leitura da versão anterior vê só os itens, soltos, na ordem de leitura
select results_eq(format($$ select texto from public.demanda_lista_itens where lista_id = %L order by ordem $$, pg_temp.lista('Benefício da demanda')),
  $$ values ('RG'::text), ('CPF'), ('CNIS'), ('Carteira de trabalho'), ('Laudo médico') $$,
  'A versão anterior lê os itens na ordem de leitura, sem os grupos');
-- Quando a versão anterior renumera os itens de 1 a n (o Subir/Descer dela)
select is(pg_temp.mudou(format($$ update public.demanda_lista_itens i set ordem = r.n
  from (select id, row_number() over (order by ordem) as n from public.demanda_lista_itens where lista_id = %L) r where i.id = r.id $$, pg_temp.lista('Benefício da demanda'))),
  5, 'A versão anterior renumera os itens');
-- Então cada item continua no grupo dele e os grupos não mudam
select results_eq(format($$ select i.texto, i.ordem, g.nome from public.demanda_lista_itens i join public.demanda_lista_grupos g on g.id = i.grupo_id
  where i.lista_id = %L order by i.ordem $$, pg_temp.lista('Benefício da demanda')),
  $$ values ('RG'::text, 1::double precision, 'Documentos pessoais'::text), ('CPF', 2, 'Documentos pessoais'), ('CNIS', 3, 'Aposentadoria por idade'),
            ('Carteira de trabalho', 4, 'Aposentadoria por idade'), ('Laudo médico', 5, 'Auxílio-doença') $$,
  'Depois da renumeração, cada item continua no grupo dele');
select results_eq(format($$ select g.nome, g.ordem, p.nome from public.demanda_lista_grupos g left join public.demanda_lista_grupos p on p.id = g.pai_id
  where g.lista_id = %L order by g.ordem $$, pg_temp.lista('Benefício da demanda')),
  $$ values ('Documentos pessoais'::text, 1::double precision, null::text), ('Benefício', 4, null), ('Aposentadoria por idade', 5, 'Benefício'),
            ('Auxílio-doença', 8, 'Benefício') $$,
  'E os grupos ficam como estavam');
reset role;

-- ===================== Grupos e níveis =====================

select pg_temp.entrar(2); set local role authenticated;
insert into public.demanda_listas (demanda_id, nome, ordem) values ('71000000-0000-0000-0000-000000000001', 'Níveis', 2), ('71000000-0000-0000-0000-000000000001', 'Outro', 3);
-- Quando a Bia monta grupo › subgrupo › item (o 3º nível), então passa
select lives_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome, ordem) values (%L, 'A', 1) $$, pg_temp.lista('Níveis')), 'Grupo no 1º nível');
select lives_ok(format($$ insert into public.demanda_lista_grupos (lista_id, pai_id, nome, ordem) values (%L, %L, 'A1', 2) $$,
  pg_temp.lista('Níveis'), pg_temp.grupo(pg_temp.lista('Níveis'), 'A')), 'Subgrupo no 2º nível');
select lives_ok(format($$ insert into public.demanda_lista_itens (lista_id, grupo_id, texto, ordem) values (%L, %L, 'No terceiro', 3) $$,
  pg_temp.lista('Níveis'), pg_temp.grupo(pg_temp.lista('Níveis'), 'A1')), 'Item no 3º nível');
-- Quando um grupo iria para o 3º nível (e o item dele para o 4º), então é recusado
select throws_ok(format($$ insert into public.demanda_lista_grupos (lista_id, pai_id, nome, ordem) values (%L, %L, 'A1a', 4) $$,
  pg_temp.lista('Níveis'), pg_temp.grupo(pg_temp.lista('Níveis'), 'A1')), 'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'Grupo no 3º nível é recusado');
-- Quando um grupo iria para dentro de um subgrupo dele, ou dele mesmo, então é recusado
select throws_ok(format($$ update public.demanda_lista_grupos set pai_id = %L where id = %L $$,
  pg_temp.grupo(pg_temp.lista('Níveis'), 'A1'), pg_temp.grupo(pg_temp.lista('Níveis'), 'A')),
  'P0001', 'Um grupo não pode ir para dentro dele mesmo nem de um subgrupo dele.', 'Grupo dentro de um subgrupo dele é recusado');
select throws_ok(format($$ update public.demanda_lista_grupos set pai_id = id where id = %L $$, pg_temp.grupo(pg_temp.lista('Níveis'), 'A')),
  '23514', null, 'Grupo dentro dele mesmo é recusado');
-- Quando o grupo é de outro checklist, então é recusado
insert into public.demanda_lista_grupos (lista_id, nome, ordem) select id, 'Do outro', 1 from public.demanda_listas where nome = 'Outro';
select throws_ok(format($$ insert into public.demanda_lista_itens (lista_id, grupo_id, texto, ordem) values (%L, %L, 'Perdido', 9) $$,
  pg_temp.lista('Níveis'), pg_temp.grupo(pg_temp.lista('Outro'), 'Do outro')), 'P0001', 'Esse grupo é de outro checklist.', 'Item num grupo de outro checklist é recusado');
select throws_ok(format($$ insert into public.demanda_lista_grupos (lista_id, pai_id, nome, ordem) values (%L, %L, 'Perdido', 9) $$,
  pg_temp.lista('Níveis'), pg_temp.grupo(pg_temp.lista('Outro'), 'Do outro')), 'P0001', 'Esse grupo é de outro checklist.', 'Grupo dentro de um de outro checklist é recusado');
-- Quando o subgrupo com itens sobe para o 1º nível, então passa
select lives_ok(format($$ update public.demanda_lista_grupos set pai_id = null where id = %L $$, pg_temp.grupo(pg_temp.lista('Níveis'), 'A1')),
  'O subgrupo com itens vai para o 1º nível');
-- Quando um grupo com subgrupo com itens iria para dentro de outro grupo, então é recusado (passaria de 3 níveis)
select lives_ok(format($$ update public.demanda_lista_grupos set pai_id = %L where id = %L $$,
  pg_temp.grupo(pg_temp.lista('Níveis'), 'A'), pg_temp.grupo(pg_temp.lista('Níveis'), 'A1')), 'O grupo volta para dentro do A');
insert into public.demanda_lista_grupos (lista_id, nome, ordem) select id, 'B', 5 from public.demanda_listas where nome = 'Níveis';
select throws_ok(format($$ update public.demanda_lista_grupos set pai_id = %L where id = %L $$,
  pg_temp.grupo(pg_temp.lista('Níveis'), 'B'), pg_temp.grupo(pg_temp.lista('Níveis'), 'A')),
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'Grupo com subgrupo com itens não vai para dentro de outro grupo');
-- Quando a Bia exclui o grupo A, então o subgrupo e os itens de dentro vão junto, e o resto fica
insert into public.demanda_lista_itens (lista_id, texto, ordem) select id, 'Solto', 6 from public.demanda_listas where nome = 'Níveis';
select is(pg_temp.mudou(format($$ delete from public.demanda_lista_grupos where id = %L $$, pg_temp.grupo(pg_temp.lista('Níveis'), 'A'))), 1, 'Exclui o grupo');
select results_eq(format($$ select nome from public.demanda_lista_grupos where lista_id = %L $$, pg_temp.lista('Níveis')), $$ values ('B'::text) $$,
  'O subgrupo sai junto');
select results_eq(format($$ select texto from public.demanda_lista_itens where lista_id = %L $$, pg_temp.lista('Níveis')), $$ values ('Solto'::text) $$,
  'E os itens de dentro; o item solto fica');
-- Quando o nome do grupo vem vazio ou grande demais, então é recusado; com espaços nas pontas, fica limpo
select throws_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome) values (%L, '   ') $$, pg_temp.lista('Níveis')), '23514', null, 'Grupo sem nome é recusado');
select throws_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome) values (%L, repeat('a', 121)) $$, pg_temp.lista('Níveis')), '23514', null,
  'Nome de grupo com 121 letras é recusado');
select lives_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome, ordem) values (%L, '  Limpo  ', 7) $$, pg_temp.lista('Níveis')), 'Grupo com espaços nas pontas');
select is((select nome from public.demanda_lista_grupos where nome like '%Limpo%'), 'Limpo', 'Fica sem os espaços');
reset role;

-- Quando o Eli (sem vínculo) procura os grupos da D1, então não vê; com "equipe_ve_tudo", vê e não cria; o Davi não vê
select pg_temp.entrar(5); set local role authenticated;
select is_empty(format($$ select 1 from public.demanda_lista_grupos where lista_id = %L $$, pg_temp.lista('Benefício da demanda')), 'Quem não está na demanda não vê os grupos');
reset role;
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(5); set local role authenticated;
select isnt_empty(format($$ select 1 from public.demanda_lista_grupos where lista_id = %L $$, pg_temp.lista('Benefício da demanda')), 'Com "equipe_ve_tudo", vê os grupos');
select throws_ok(format($$ insert into public.demanda_lista_grupos (lista_id, nome) values (%L, 'Do Eli') $$, pg_temp.lista('Benefício da demanda')), '42501', null,
  'Mas não cria grupo');
-- E quem só lê não reordena
select throws_ok(format($$ select public.checklist_reordenar(%L, '[]') $$, pg_temp.lista('Benefício da demanda')),
  'P0001', 'Você não pode alterar este checklist.', 'Quem só lê não reordena o checklist');
reset role;
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(4); set local role authenticated;
select is_empty(format($$ select 1 from public.demanda_lista_grupos where lista_id = %L $$, pg_temp.lista('Benefício da demanda')), 'O outro escritório não vê os grupos');
reset role;

-- ===================== As funções =====================

select pg_temp.entrar(2); set local role authenticated;
-- Quando o checklist novo teria um grupo no 3º nível, então é recusado e nenhuma lista fica
select throws_ok($$ select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000001', 'Fundo demais',
  '[{"chave": "g1", "pai": null, "nome": "A", "ordem": 1}, {"chave": "g2", "pai": "g1", "nome": "B", "ordem": 2}, {"chave": "g3", "pai": "g2", "nome": "C", "ordem": 3}]') $$,
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'Checklist novo com grupo no 3º nível é recusado');
select is(pg_temp.quantos($$ select 1 from public.demanda_listas where nome = 'Fundo demais' $$), 0::bigint, 'E nenhuma lista fica');
-- Quando as chaves vêm erradas, então é recusado e nenhuma lista fica
select throws_ok($$ select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000001', 'Chaves erradas',
  '[{"chave": "g1", "pai": null, "nome": "A", "ordem": 1}, {"chave": "g1", "pai": null, "nome": "B", "ordem": 2}]') $$,
  'P0001', 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.', 'Chave repetida é recusada');
select throws_ok($$ select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000001', 'Chaves erradas',
  '[{"chave": "g2", "pai": "g1", "nome": "B", "ordem": 2}, {"chave": "g1", "pai": null, "nome": "A", "ordem": 1}]') $$,
  'P0001', 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.', 'Grupo antes do grupo de cima é recusado');
select throws_ok($$ select public.checklist_criar('demandas', '71000000-0000-0000-0000-000000000001', 'Chaves erradas',
  '[{"chave": "g1", "pai": null, "nome": "A", "ordem": 1}]', '[{"pai": "g9", "texto": "Perdido", "ordem": 2}]') $$,
  'P0001', 'Os grupos do checklist vieram fora de ordem. Recarregue a página e tente de novo.', 'Item de um grupo que não veio é recusado');
select is(pg_temp.quantos($$ select 1 from public.demanda_listas where nome = 'Chaves erradas' $$), 0::bigint, 'E nenhuma lista fica');
-- Quando o cartão não tem checklists, então é recusado
select throws_ok($$ select public.checklist_criar('processos', '71000000-0000-0000-0000-000000000001', 'No processo') $$,
  'P0001', 'Esse cartão não tem checklists.', 'Processo não tem checklist');
-- Quando a Bia leva o grupo "Documentos pessoais" para dentro do "Benefício", numa chamada, então ele vai com os itens
select lives_ok(format($$ select public.checklist_reordenar(%L, %L) $$, pg_temp.lista('Benefício da demanda'),
  jsonb_build_array(jsonb_build_object('id', pg_temp.grupo(pg_temp.lista('Benefício da demanda'), 'Documentos pessoais'), 'tipo', 'grupo',
                                       'pai_id', pg_temp.grupo(pg_temp.lista('Benefício da demanda'), 'Benefício'), 'ordem', 10),
                    jsonb_build_object('id', pg_temp.item(pg_temp.lista('Benefício da demanda'), 'RG'), 'tipo', 'item',
                                       'pai_id', pg_temp.grupo(pg_temp.lista('Benefício da demanda'), 'Documentos pessoais'), 'ordem', 11),
                    jsonb_build_object('id', pg_temp.item(pg_temp.lista('Benefício da demanda'), 'CPF'), 'tipo', 'item',
                                       'pai_id', pg_temp.grupo(pg_temp.lista('Benefício da demanda'), 'Documentos pessoais'), 'ordem', 12))),
  'Leva o grupo para dentro de outro, de uma vez');
select results_eq(format($$ select g.nome, g.ordem, p.nome from public.demanda_lista_grupos g left join public.demanda_lista_grupos p on p.id = g.pai_id
  where g.lista_id = %L order by g.ordem $$, pg_temp.lista('Benefício da demanda')),
  $$ values ('Benefício'::text, 4::double precision, null::text), ('Aposentadoria por idade', 5, 'Benefício'), ('Auxílio-doença', 8, 'Benefício'),
            ('Documentos pessoais', 10, 'Benefício') $$,
  'O grupo fica dentro do outro, na posição nova');
select results_eq(format($$ select i.texto, i.ordem, g.nome from public.demanda_lista_itens i join public.demanda_lista_grupos g on g.id = i.grupo_id
  where i.lista_id = %L and i.texto in ('RG', 'CPF') order by i.ordem $$, pg_temp.lista('Benefício da demanda')),
  $$ values ('RG'::text, 11::double precision, 'Documentos pessoais'::text), ('CPF', 12, 'Documentos pessoais') $$,
  'E os itens dele vão junto');
-- Quando vem um id que não é do checklist, então é recusado e nada muda
select throws_ok(format($$ select public.checklist_reordenar(%L, %L) $$, pg_temp.lista('Benefício da demanda'),
  jsonb_build_array(jsonb_build_object('id', pg_temp.item(pg_temp.lista('Benefício da demanda'), 'CNIS'), 'tipo', 'item', 'pai_id', null, 'ordem', 1),
                    jsonb_build_object('id', pg_temp.item(pg_temp.lista('Níveis'), 'Solto'), 'tipo', 'item', 'pai_id', null, 'ordem', 2))),
  'P0001', 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.', 'Item de outro checklist é recusado');
select is((select grupo_id from public.demanda_lista_itens where texto = 'CNIS' and lista_id = pg_temp.lista('Benefício da demanda')),
  pg_temp.grupo(pg_temp.lista('Benefício da demanda'), 'Aposentadoria por idade'), 'E o CNIS fica onde estava');
reset role;

-- ===================== Modelos =====================

select pg_temp.entrar(2); set local role authenticated;
-- Quando a Bia grava o modelo do exemplo, com espaços nas pontas, um item vazio e um grupo vazio
select lives_ok($$ insert into public.lista_modelos (nome, arvore) values ('Benefício previdenciário', '[
  {"texto": " Documentos pessoais ", "filhos": [{"texto": " RG "}, {"texto": "  "}, {"texto": "CPF"}]},
  {"texto": "Benefício", "filhos": [
    {"texto": "Aposentadoria por idade", "filhos": [{"texto": "CNIS"}, {"texto": "Carteira de trabalho"}]},
    {"texto": "Auxílio-doença", "filhos": [{"texto": "Laudo médico"}]},
    {"texto": "Vazio", "filhos": [{"texto": " "}]}]}]') $$, 'Grava o modelo com a árvore');
-- Então "itens" são as folhas limpas, na ordem, e a árvore fica limpa, sem o item vazio e sem o grupo vazio
select is((select itens from public.lista_modelos where nome = 'Benefício previdenciário'),
  array['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Laudo médico'], 'Os itens são as folhas, na ordem de leitura');
select is((select arvore from public.lista_modelos where nome = 'Benefício previdenciário'), '[
  {"texto": "Documentos pessoais", "filhos": [{"texto": "RG"}, {"texto": "CPF"}]},
  {"texto": "Benefício", "filhos": [
    {"texto": "Aposentadoria por idade", "filhos": [{"texto": "CNIS"}, {"texto": "Carteira de trabalho"}]},
    {"texto": "Auxílio-doença", "filhos": [{"texto": "Laudo médico"}]}]}]'::jsonb, 'A árvore fica limpa, sem o item nem o grupo vazios');
-- Quando o modelo passa dos limites, então é recusado
select throws_ok($$ insert into public.lista_modelos (nome, arvore) values ('Fundo', '[{"texto": "A", "filhos": [{"texto": "B", "filhos": [{"texto": "C", "filhos": [{"texto": "D"}]}]}]}]') $$,
  'P0001', 'O checklist vai até 3 níveis (como 2.1.1).', 'Modelo com grupo no 3º nível é recusado');
select throws_ok($$ insert into public.lista_modelos (nome, arvore)
  select 'Muitos grupos', jsonb_agg(jsonb_build_object('texto', 'G' || n, 'filhos', jsonb_build_array(jsonb_build_object('texto', 'I' || n)))) from generate_series(1, 51) n $$,
  'P0001', 'Um modelo pode ter até 50 grupos.', 'Modelo com 51 grupos é recusado');
select lives_ok($$ insert into public.lista_modelos (nome, arvore)
  select 'Cinquenta grupos', jsonb_agg(jsonb_build_object('texto', 'G' || n, 'filhos', jsonb_build_array(jsonb_build_object('texto', 'I' || n)))) from generate_series(1, 50) n $$,
  'Com 50 grupos, passa');
select throws_ok($$ insert into public.lista_modelos (nome, arvore)
  select 'Muitos itens', jsonb_build_array(jsonb_build_object('texto', 'G', 'filhos', jsonb_agg(jsonb_build_object('texto', 'I' || n)))) from generate_series(1, 101) n $$,
  '23514', null, 'Modelo com 101 itens é recusado');
select throws_ok($$ insert into public.lista_modelos (nome, arvore) values ('Formato', '[{"texto": "A", "filhos": "B"}]') $$,
  'P0001', 'O modelo de checklist veio num formato que o SEMPER não conhece.', 'Grupo com "filhos" que não é lista é recusado');
-- Quando a versão anterior muda os itens, então os itens ficam limpos e a árvore fica como estava
select is(pg_temp.mudou($$ update public.lista_modelos set itens = array[' RG ', 'Novo', ''] where nome = 'Benefício previdenciário' $$), 1, 'A versão anterior muda os itens');
select is((select itens from public.lista_modelos where nome = 'Benefício previdenciário'), array['RG', 'Novo'], 'Os itens ficam limpos');
select is((select arvore -> 0 ->> 'texto' from public.lista_modelos where nome = 'Benefício previdenciário'), 'Documentos pessoais', 'E a árvore fica como estava');
select is((select jsonb_array_length(arvore) from public.lista_modelos where nome = 'Benefício previdenciário'), 2, 'Inteira');
-- Quando só o nome muda, então a árvore e os itens continuam
select is(pg_temp.mudou($$ update public.lista_modelos set nome = 'Benefício do INSS' where nome = 'Benefício previdenciário' $$), 1, 'Renomeia o modelo');
select is((select itens from public.lista_modelos where nome = 'Benefício do INSS'), array['RG', 'Novo'], 'Os itens continuam');
select is((select jsonb_array_length(arvore) from public.lista_modelos where nome = 'Benefício do INSS'), 2, 'E a árvore também');
-- Quando o site novo grava a mesma árvore com as folhas dela em "itens" (como supabase.ts faz), então os itens voltam a ser as folhas
select is(pg_temp.mudou($$ update public.lista_modelos set nome = 'Benefício previdenciário', arvore = '[{"texto": "Documentos pessoais", "filhos": [{"texto": "RG"}, {"texto": "CPF"}]},
  {"texto": "Benefício", "filhos": [{"texto": "Aposentadoria por idade", "filhos": [{"texto": "CNIS"}, {"texto": "Carteira de trabalho"}]},
  {"texto": "Auxílio-doença", "filhos": [{"texto": "Laudo médico"}]}]}]', itens = array['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Laudo médico']
  where nome = 'Benefício do INSS' $$), 1, 'O site novo grava a árvore e as folhas');
select is((select itens from public.lista_modelos where nome = 'Benefício previdenciário'),
  array['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Laudo médico'], 'Os itens voltam a ser as folhas');
-- Quando o site novo grava uma árvore mudada (só ela), então os itens passam a ser as folhas novas
select is(pg_temp.mudou($$ update public.lista_modelos set arvore = '[{"texto": "Documentos pessoais", "filhos": [{"texto": "RG"}, {"texto": "CPF"}]},
  {"texto": "Benefício", "filhos": [{"texto": "Aposentadoria por idade", "filhos": [{"texto": "CNIS"}, {"texto": "Carteira de trabalho"}]}]}]'
  where nome = 'Benefício previdenciário' $$), 1, 'O site novo tira o grupo Auxílio-doença');
select is((select itens from public.lista_modelos where nome = 'Benefício previdenciário'),
  array['RG', 'CPF', 'CNIS', 'Carteira de trabalho'], 'Os itens são as folhas da árvore nova');
-- Quando um modelo é gravado como antes (só os itens), então fica sem árvore, com os itens limpos
select lives_ok($$ insert into public.lista_modelos (nome, itens) values ('Modelo antigo', array[' A ', '', 'B']) $$, 'O modelo de antes grava');
select is((select arvore from public.lista_modelos where nome = 'Modelo antigo'), null::jsonb, 'Sem árvore');
select is((select itens from public.lista_modelos where nome = 'Modelo antigo'), array['A', 'B'], 'Com os itens limpos');
reset role;
-- Quando a demanda do objeto "Benefício previdenciário" ganha as tarefas do modelo, então há uma por item, nenhuma com o nome de um grupo
select pg_temp.entrar(1);
select privado.tarefas_do_modelo('71000000-0000-0000-0000-000000000002');
select results_eq($$ select titulo from public.tarefas where demanda_id = '71000000-0000-0000-0000-000000000002' order by etapa_ordem $$,
  $$ values ('RG'::text), ('CPF'), ('CNIS'), ('Carteira de trabalho') $$,
  'As tarefas do modelo são os itens, sem os grupos');

select * from finish();
rollback;
