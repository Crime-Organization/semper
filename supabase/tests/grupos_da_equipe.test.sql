-- Grupos da equipe (#378): quem está num grupo do item participa dele; só administradores cuidam dos grupos; um escritório nunca
-- vê os grupos nem os itens de outro. Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim. Os nomes são inventados.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (advogada), Caio (estagiário), Davi (advogado, participante da divisão do
-- contrato K1), Gil (conta reservada), Hugo e Ivo (do administrativo) e Juca (advogado sem vínculo com nada); e outro escritório com
-- Eva (administradora). A visualização está fechada (sem as chaves da equipe).
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-grupos',
   '{"pessoas": true, "tarefas": true, "demandas": true, "processos": true, "compromissos": true, "contratos": true, "anotacoes": true, "financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-grupos-2', '{"pessoas": true, "tarefas": true, "demandas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em)
select case when n = 5 then 'e0000000-0000-0000-0000-000000000002' else 'e0000000-0000-0000-0000-000000000001' end::uuid,
       e || '@exemplo.test', initcap(e), case when n in (1, 5) then 'master' else 'usuario' end, privado.resumo_codigo('c' || n), now()
from (values (1, 'ana'), (2, 'bia'), (3, 'caio'), (4, 'davi'), (5, 'eva'), (6, 'gil'), (7, 'hugo'), (8, 'ivo'), (9, 'juca')) as x(n, e);
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e || '@exemplo.test', jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana'), (2, 'bia'), (3, 'caio'), (4, 'davi'), (5, 'eva'), (6, 'gil'), (7, 'hugo'), (8, 'ivo'), (9, 'juca')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 9) n;

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'pf', 'ANA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BIA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'pf', 'DAVI', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'P8', 'pf', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
update public.perfis f set usuario = lower(f.nome), funcao = 'advogado' where f.id in (select pg_catalog.unnest(array[
  'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000009']::uuid[]));
update public.perfis f set usuario = lower(f.nome), funcao = 'estagiario' where f.id = 'a0000000-0000-0000-0000-000000000003';
update public.perfis f set usuario = lower(f.nome), funcao = 'administrativo' where f.id in ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008');
update public.perfis set pessoa_id = ('10000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid
where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004');
update public.perfis set reservada = true where id = 'a0000000-0000-0000-0000-000000000006';
-- Os itens, todos criados pela Ana e com ela como responsável, sem mais ninguém:
--   demandas D1, D2, D3 (arquivada) e D4 (do contrato K1); tarefas T1, T2 (da demanda D1), T3 e T4 (do contrato K1);
--   processos P1 e P2; compromissos C1, C2 (do processo P1), C3 e C4 (da Agenda geral); anotações N1, N2 (ligada à demanda D1) e N3;
--   contratos K1 (com parcelas e o Davi na divisão) e K2. No outro escritório, a demanda D9 da Eva.
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, contrato_id, arquivado_em, criado_por)
select ('71000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'D' || n, 'Demanda ' || n, 'a0000000-0000-0000-0000-000000000001', '{}',
       case when n = 4 then 'c0000000-0000-0000-0000-000000000001'::uuid end, case when n = 3 then now() end, 'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 4) n;
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda da Eva', 'a0000000-0000-0000-0000-000000000005', '{}', 'a0000000-0000-0000-0000-000000000005');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, contrato_id, criado_por)
select ('70000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'T' || n, 'Tarefa ' || n, 'a0000000-0000-0000-0000-000000000001', '{}',
       case when n = 2 then '71000000-0000-0000-0000-000000000001'::uuid end, case when n = 4 then 'c0000000-0000-0000-0000-000000000001'::uuid end,
       'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 4) n;
insert into public.processos (id, escritorio_id, codigo, tipo, numero, titulo, responsavel_id, colaboradores, clientes, criado_por)
select ('73000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'P' || n, 'judicial', '000' || n, 'Processo ' || n,
       'a0000000-0000-0000-0000-000000000001', '{}', '{10000000-0000-0000-0000-000000000008}', 'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 2) n;
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, processo_id, geral, criado_por)
select ('72000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'C' || n, 'reuniao', 'Reunião ' || n, '2030-01-15', '14:30',
       'a0000000-0000-0000-0000-000000000001', '{}', case when n = 2 then '73000000-0000-0000-0000-000000000001'::uuid end, n = 4, 'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 4) n;
insert into public.anotacoes (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por)
select ('ab000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'N' || n, 'Anotação ' || n,
       'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 3) n;
insert into public.anotacao_ligacoes (escritorio_id, anotacao_id, demanda_id, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, clientes, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, observacoes, criado_por)
select ('c0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', n, 'AN11', 2030, 'AN11-000' || n || '-2030',
       '10000000-0000-0000-0000-000000000008', '{10000000-0000-0000-0000-000000000008}', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001', 'Registro de marca',
       '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
       case when n = 1 then '[{"pessoa_id": "10000000-0000-0000-0000-000000000004", "percentual": 10}]'::jsonb else '[]'::jsonb end,
       'Combinado de pagamento', 'a0000000-0000-0000-0000-000000000001'
from generate_series(1, 2) n;
insert into public.contrato_participantes (contrato_id, pessoa_id, escritorio_id, percentual, ordem) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 10, 0);
insert into public.contrato_parcelas (escritorio_id, contrato_id, numero, vencimento, valor) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, '2030-02-10', 1000);
insert into public.contrato_historico (escritorio_id, contrato_id, alteracoes, feito_por) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '{"valor": {"de": 8000, "para": 9000}}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demanda_listas (id, escritorio_id, demanda_id, nome) values
  ('75000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Lista');
insert into public.etiquetas (id, escritorio_id, cor) values
  ('77000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'verde');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.id(p_quem int) returns uuid language sql immutable as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
-- Os códigos que quem está logado vê numa tabela (ou na view), em ordem.
create function pg_temp.vejo(p_tabela text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select string_agg(codigo, '' '' order by codigo) from public.%I where codigo !~ ''^V''', p_tabela) into r;
  return coalesce(r, '');
end $$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- Os ids dos grupos criados no teste, pelo apelido.
create temp table grupos_do_teste (apelido text primary key, id uuid not null);
create function pg_temp.g(p_apelido text) returns uuid language sql stable as $$ select id from grupos_do_teste where apelido = p_apelido $$;
-- Os avisos de inclusão e as mensagens de grupo de alguém, lidos como o banco (sem as regras de leitura).
create function pg_temp.avisos(p_quem int, p_item uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(m.entrou_como || coalesce(':' || g.nome, '') order by m.entrou_como), '{}')
  from public.mensagens_de_inclusao m left join public.grupos_da_equipe g on g.id = m.grupo_id
  where m.perfil_id = pg_temp.id(p_quem) and m.item_id = p_item
$$;
create function pg_temp.mensagens_de_grupo(p_quem int) returns text[] language sql security definer as $$
  select coalesce(array_agg(g.nome || ':' || coalesce(f.usuario, '-') || ':' || (m.lido_em is null) order by g.nome), '{}')
  from public.mensagens_de_grupo m join public.grupos_da_equipe g on g.id = m.grupo_id left join public.perfis f on f.id = m.incluido_por
  where m.perfil_id = pg_temp.id(p_quem)
$$;
create function pg_temp.integrantes(p_apelido text) returns text[] language sql security definer as $$
  select coalesce(array_agg(f.usuario order by f.usuario), '{}') from public.grupo_integrantes i join public.perfis f on f.id = i.perfil_id
  where i.grupo_id = pg_temp.g(p_apelido)
$$;
-- O tempo passa (2 minutos, mais que o do desfazer). Dentro da transação do teste, now() não anda.
create function pg_temp.passar_o_tempo() returns void language sql security definer as $$
  update privado.mudancas_na_equipe set desde = desde - interval '2 minutes', em = em - interval '2 minutes';
  update public.mensagens_de_inclusao set criado_em = criado_em - interval '2 minutes';
  update public.mensagens_de_grupo set criado_em = criado_em - interval '2 minutes';
$$;
grant all on grupos_do_teste to authenticated;
grant execute on function pg_temp.entrar(int), pg_temp.id(int), pg_temp.vejo(text), pg_temp.mudou(text), pg_temp.g(text), pg_temp.avisos(int, uuid),
  pg_temp.mensagens_de_grupo(int), pg_temp.integrantes(text) to authenticated;

-- ===== Estrutura =====
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.grupos_da_equipe'::regclass, 'public.grupo_integrantes'::regclass, 'public.mensagens_de_grupo'::regclass)),
  'As três tabelas novas têm as regras de linha (RLS) ligadas');
select col_not_null('public', 'grupos_da_equipe', 'escritorio_id', 'Todo grupo é de um escritório');
select col_not_null('public', 'grupo_integrantes', 'escritorio_id', 'Todo integrante é de um escritório');
select col_not_null('public', 'mensagens_de_grupo', 'escritorio_id', 'Toda mensagem de grupo é de um escritório');
select is((select string_agg(table_name || ' ' || column_default || ' ' || is_nullable, ', ' order by table_name) from information_schema.columns
            where table_schema = 'public' and column_name = 'grupos' and table_name in ('demandas', 'tarefas', 'processos', 'compromissos', 'contratos', 'anotacoes')),
  'anotacoes ''{}''::uuid[] NO, compromissos ''{}''::uuid[] NO, contratos ''{}''::uuid[] NO, demandas ''{}''::uuid[] NO, processos ''{}''::uuid[] NO, tarefas ''{}''::uuid[] NO',
  'As seis tabelas têm a coluna grupos, vazia por padrão e nunca nula');
select is((select count(*) from pg_indexes where schemaname = 'public' and indexdef ~ 'USING gin \(grupos\)'
           and tablename in ('demandas', 'tarefas', 'processos', 'compromissos', 'contratos', 'anotacoes')), 6::bigint, 'As seis tabelas têm o índice GIN dos grupos');
select is((select count(*) from pg_constraint where conname ~ '_grupos_limite$' and pg_get_constraintdef(oid) ~ 'cardinality\(grupos\) <= 10'), 6::bigint,
  'As seis tabelas limitam os grupos a 10 por item');
select ok((select reloptions @> array['security_barrier=true'] from pg_class where oid = 'public.contratos_da_equipe'::regclass), 'A view contratos_da_equipe continua com security_barrier');
-- Quem altera o item põe e tira grupos, menos no contrato (só pela função).
select ok(bool_and(has_column_privilege('authenticated', ('public.' || t)::regclass, 'grupos', 'UPDATE') and has_column_privilege('authenticated', ('public.' || t)::regclass, 'grupos', 'INSERT')),
  'A coluna grupos é gravável em demandas, tarefas, processos, compromissos e anotações')
from unnest(array['demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes']) t;
select ok(not has_column_privilege('authenticated', 'public.contratos', 'grupos', 'UPDATE'),
  'Em contratos, a coluna grupos não muda pela tela (só por contrato_definir_grupos; ao criar, quem cria já é parte)');
select ok(not (has_table_privilege('authenticated', t, 'INSERT') or has_table_privilege('authenticated', t, 'UPDATE') or has_table_privilege('authenticated', t, 'DELETE')),
  'Ninguém grava direto em ' || t)
from unnest(array['public.grupos_da_equipe', 'public.grupo_integrantes', 'public.mensagens_de_grupo']) t;
select ok(has_column_privilege('authenticated', 'public.mensagens_de_grupo', 'lido_em', 'UPDATE'), 'A mensagem de grupo só pode ser marcada como lida');
select ok(not has_column_privilege('authenticated', 'public.comentarios', 'mencoes_pelo_grupo', 'UPDATE'), 'Ninguém muda direto a lista de quem foi mencionado pelo grupo (só o gatilho)');
select ok(not has_table_privilege('anon', t, 'SELECT'), 'Quem não entrou não lê ' || t)
from unnest(array['public.grupos_da_equipe', 'public.grupo_integrantes', 'public.mensagens_de_grupo']) t;
-- As funções novas ou trocadas rodam sem search_path (e as que já rodavam como dono continuam assim).
select is(array_agg(p.oid::regprocedure::text order by 1) filter (where not coalesce(p.proconfig @> array['search_path=""'], false)), null,
  'Toda função nova ou trocada tem search_path vazio')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'privado') and p.proname in (
  'meus_grupos', 'integrantes_dos_grupos', 'perfil_nos_grupos', 'demandas_dos_meus_grupos', 'processos_dos_meus_grupos', 'estou_na_demanda', 'estou_no_processo',
  'estou_na_tarefa', 'estou_no_compromisso', 'grupos_do_item', 'nomes_dos_grupos', 'preparar_grupo', 'preparar_integrante', 'preparar_grupos', 'grupo_dos_avisos',
  'avisar_no_contrato', 'grupo_do_administrador', 'conferir_nome_do_grupo', 'grupo_criar', 'grupo_renomear', 'grupo_incluir_integrante', 'grupo_tirar_integrante',
  'grupo_contar_itens', 'grupo_excluir', 'contrato_definir_grupos', 'grupos_de_quem_saiu', 'preparar_tarefa', 'preparar_compromisso', 'resumo_do_tempo',
  'tempo_da_demanda', 'preparar_andamento', 'preparar_prazo', 'processo_ativo', 'altero_a_lista', 'conferir_processo_da_tarefa', 'anotacoes_pelos_itens',
  'altero_a_anotacao', 'contratos_em_que_estou', 'contrato_alterar_sem_valores', 'preparar_comentario', 'conferir_mencoes', 'mencao_no_processo',
  'mencao_no_compromisso', 'mencao_na_anotacao', 'cartao_sair', 'ainda_faz_parte', 'tarefas_dos_grupos', 'inclusao_na_tarefa', 'inclusao_na_demanda', 'inclusao_no_processo',
  'inclusao_no_compromisso', 'inclusao_na_anotacao', 'inclusao_no_contrato', 'historico_demanda', 'historico_tarefa', 'historico_processo',
  'historico_compromisso', 'historico_contrato', 'historico_anotacao', 'painel_de_processos', 'contratos_em_que_me_mencionaram');
select results_eq($$ select p.proname::text collate "default" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname in ('public', 'privado') and not p.prosecdef and p.proname in (
                       'preparar_andamento', 'preparar_prazo', 'processo_ativo', 'altero_a_lista', 'conferir_processo_da_tarefa', 'painel_de_processos',
                       'meus_grupos', 'estou_na_demanda', 'estou_na_tarefa', 'estou_no_processo', 'estou_no_compromisso', 'grupo_criar', 'grupo_excluir',
                       'contrato_definir_grupos', 'anotacoes_pelos_itens', 'cartao_sair', 'ainda_faz_parte', 'inclusao_na_demanda', 'historico_demanda')
                     order by 1 $$,
  $$ values ('altero_a_lista'), ('conferir_processo_da_tarefa'), ('painel_de_processos'), ('preparar_andamento'), ('preparar_prazo'), ('processo_ativo') $$,
  'As trocadas que rodavam como quem chama continuam assim; as novas e as outras rodam como o dono do banco');
select results_eq($$ select c.relname::text collate "default", pg_get_triggerdef(t.oid) ~ 'UPDATE OF responsavel_id, (colaboradores|participantes), grupos' and pg_get_triggerdef(t.oid) ~ 'WHEN \(\(CURRENT_USER = ''authenticated''::name\)\)'
                     from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'aviso_de_inclusao' and c.relname <> 'contratos' order by 1 $$,
  $$ values ('anotacoes', true), ('compromissos', true), ('demandas', true), ('processos', true), ('tarefas', true) $$,
  'Os gatilhos do aviso recriados rodam também com os grupos e só para o que a pessoa grava');
-- O inventário: nenhuma regra nem função continua a chamar as funções antigas de "estou no cartão".
select is((select count(*) from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ~ '(vejo_demanda|vejo_tarefa|vejo_processo|participo_do_compromisso)\('), 0::bigint,
  'Nenhuma regra chama vejo_demanda, vejo_tarefa, vejo_processo ou participo_do_compromisso');
select is((select array_agg(p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'privado') and p.prosrc ~ '(vejo_demanda|vejo_tarefa|vejo_processo|participo_do_compromisso)\('
             and p.proname not in ('vejo_demanda', 'vejo_tarefa', 'vejo_processo', 'participo_do_compromisso')), null,
  'Nenhuma função chama as antigas (só elas mesmas, que ficam porque a migração só acrescenta)');
-- A segunda busca, pelas condições de "está na equipe do item" escritas direto. Cada função achada foi decidida (#378):
--   conta o grupo: altero_a_anotacao, anotacoes_pelos_itens, conferir_mencoes, contratos_em_que_estou, estou_*, mencao_*, painel_de_processos;
--   não conta, de propósito: altero_o_contrato e perfil_no_contrato (os valores do contrato), contrato_participantes (a divisão),
--     contrato_definir_grupos (exige ser parte por conta própria), por_no_item e processo_me_incluir (põem a pessoa por conta própria),
--     preparar_* (conferem só quem é posto um a um), preparar_comentario (quem está só pelo grupo não é parte do contrato; quem é
--     mencionado estando num grupo do contrato não ganha os valores pela menção) e as antigas vejo_*.
-- Função nova com esse padrão faz este teste falhar até alguém decidir.
select results_eq($$ select p.proname::text collate "default" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname in ('public', 'privado') and p.prosrc ~* '(= *any *\(.*(colaboradores|participantes)\)|participantes *@>)' order by 1 $$,
  $$ values ('altero_a_anotacao'), ('altero_o_contrato'), ('anotacoes_pelos_itens'), ('conferir_mencoes'), ('contrato_definir_grupos'), ('contrato_participantes'),
            ('contratos_em_que_estou'), ('estou_na_demanda'), ('estou_na_tarefa'), ('estou_no_compromisso'), ('estou_no_processo'), ('mencao_na_anotacao'),
            ('mencao_no_compromisso'), ('mencao_no_processo'), ('painel_de_processos'), ('participo_do_compromisso'), ('perfil_no_contrato'), ('por_no_item'),
            ('preparar_anotacao'), ('preparar_comentario'), ('preparar_compromisso'), ('preparar_demanda'), ('preparar_processo'), ('preparar_tarefa'),
            ('processo_me_incluir'), ('vejo_demanda'), ('vejo_processo'), ('vejo_tarefa') $$,
  'A segunda busca acha exatamente as funções decididas');
select results_eq($$ select (tablename::text || '.' || policyname::text) collate "default" from pg_policies
                     where coalesce(qual, '') || coalesce(with_check, '') ~ '(= *any *\(.*(colaboradores|participantes)\)|participantes *@>)' order by 1 $$,
  $$ values ('contratos.alterar'), ('contratos.leitura') $$, 'Nas regras, só as do contrato, que de propósito não contam o grupo (os valores)');

-- ===== Grupos: só administradores cuidam =====
-- Quando a Ana cria dois grupos (um com espaços nas pontas), então eles existem com o nome arrumado
select pg_temp.entrar(1); set local role authenticated;
insert into grupos_do_teste values ('A', public.grupo_criar('Núcleo A')), ('B', public.grupo_criar('  Núcleo B  '));
select results_eq($$ select nome, criado_por from public.grupos_da_equipe order by nome $$,
  $$ values ('Núcleo A'::text, pg_temp.id(1)), ('Núcleo B', pg_temp.id(1)) $$, 'A administradora cria os grupos, com o nome sem os espaços das pontas');
select throws_ok($$ select public.grupo_criar('núcleo a') $$, 'P0001', 'Já existe um grupo com este nome.', 'Nome repetido (sem diferença de maiúsculas) é recusado');
select throws_ok($$ select public.grupo_criar('   ') $$, 'P0001', 'Escreva o nome do grupo.', 'Nome vazio é recusado');
select throws_ok($$ select public.grupo_criar(repeat('x', 61)) $$, 'P0001', 'O nome do grupo pode ter até 60 letras.', 'Nome com mais de 60 letras é recusado');
select throws_ok(format('select public.grupo_renomear(%L, %L)', pg_temp.g('B'), 'Núcleo A'), 'P0001', 'Já existe um grupo com este nome.', 'Renomear para um nome que já existe é recusado');
select lives_ok(format('select public.grupo_renomear(%L, %L)', pg_temp.g('B'), 'Núcleo Beta'), 'A administradora renomeia o grupo');
select lives_ok(format('select public.grupo_renomear(%L, %L)', pg_temp.g('B'), 'Núcleo B'), 'E pode voltar ao nome de antes (o próprio nome não conta como repetido)');
select throws_ok($$ insert into public.grupos_da_equipe (nome) values ('Direto') $$, '42501', null, 'Não dá para criar o grupo direto na tabela');
select throws_ok($$ update public.grupos_da_equipe set nome = 'Direto' $$, '42501', null, 'Nem renomear direto');
select throws_ok($$ delete from public.grupos_da_equipe $$, '42501', null, 'Nem apagar direto');
select throws_ok(format('insert into public.grupo_integrantes (grupo_id, perfil_id, escritorio_id) values (%L, %L, %L)', pg_temp.g('A'), pg_temp.id(2), 'e0000000-0000-0000-0000-000000000001'),
  '42501', null, 'Nem pôr um integrante direto na tabela');
-- Quando a Ana põe a Bia e o Caio no Núcleo A, e o Caio, o Hugo e o Ivo no Núcleo B, uma pessoa por vez, então ficam todos
select lives_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(2)), 'Inclui a Bia no Núcleo A');
select lives_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(3)), 'Inclui o Caio no Núcleo A');
select lives_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(2)), 'Incluir de novo quem já está não é erro');
select public.grupo_incluir_integrante(pg_temp.g('B'), pg_temp.id(n)) from unnest(array[3, 7, 8]) n;
select is(pg_temp.integrantes('A'), array['bia', 'caio'], 'Duas inclusões seguidas mantêm as duas pessoas, sem repetir');
select is(pg_temp.integrantes('B'), array['caio', 'hugo', 'ivo'], 'Uma pessoa pode estar em vários grupos');
select throws_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(6)), 'P0001', 'O integrante precisa ser alguém da equipe do escritório.',
  'A conta reservada não entra no grupo');
select throws_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(5)), 'P0001', 'O integrante precisa ser alguém da equipe do escritório.',
  'Alguém de outro escritório não entra no grupo');
reset role;
-- Dado um usuário comum (a Bia), quando tenta cuidar dos grupos, então é recusado em todas as funções
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.grupo_criar('Da Bia') $$, 'P0001', 'Só um administrador cuida dos grupos.', 'O usuário comum não cria grupo');
select throws_ok(format('select public.grupo_renomear(%L, %L)', pg_temp.g('A'), 'X'), 'P0001', 'Só um administrador cuida dos grupos.', 'Nem renomeia');
select throws_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(4)), 'P0001', 'Só um administrador cuida dos grupos.', 'Nem inclui integrante');
select throws_ok(format('select public.grupo_tirar_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(3)), 'P0001', 'Só um administrador cuida dos grupos.', 'Nem tira integrante');
select throws_ok(format('select * from public.grupo_contar_itens(%L)', pg_temp.g('A')), 'P0001', 'Só um administrador cuida dos grupos.', 'Nem conta os itens');
select throws_ok(format('select public.grupo_excluir(%L)', pg_temp.g('A')), 'P0001', 'Só um administrador cuida dos grupos.', 'Nem exclui');
select is((select array_agg(nome order by nome) from public.grupos_da_equipe), array['Núcleo A', 'Núcleo B'], 'Mas toda a equipe lê os grupos do escritório');
select is((select count(*) from public.grupo_integrantes), 5::bigint, 'E quem está em cada um');
reset role;
-- Dada a Eva, administradora do outro escritório, quando cria um grupo com o mesmo nome e tenta mexer nos do primeiro, então não alcança
select pg_temp.entrar(5); set local role authenticated;
insert into grupos_do_teste values ('E', public.grupo_criar('Núcleo A'));
select lives_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('E'), pg_temp.id(5)), 'A Eva põe a si mesma no grupo dela');
select is((select array_agg(nome) from public.grupos_da_equipe), array['Núcleo A'], 'A Eva vê só o grupo dela (o mesmo nome vale em outro escritório)');
select is((select count(*) from public.grupo_integrantes where grupo_id <> pg_temp.g('E')), 0::bigint, 'Nem os integrantes dos grupos do primeiro escritório');
select throws_ok(format('select public.grupo_incluir_integrante(%L, %L)', pg_temp.g('A'), pg_temp.id(5)), 'P0001', 'Grupo não encontrado neste escritório.',
  'Um grupo de outro escritório responde como se não existisse');
select throws_ok(format('select public.grupo_excluir(%L)', pg_temp.g('A')), 'P0001', 'Grupo não encontrado neste escritório.', 'E não é excluído');
select is(privado.meus_grupos(), array[pg_temp.g('E')], 'Os grupos da Eva são só os do escritório dela');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.grupos_da_equipe where id = pg_temp.g('E')), 0::bigint, 'A Bia não vê o grupo do outro escritório');
reset role;

-- meus_grupos(): de quem está logado, só ativo e com a sessão válida.
select pg_temp.entrar(3);
select is((select array_agg(x order by x) from unnest(privado.meus_grupos()) x), (select array_agg(x order by x) from unnest(array[pg_temp.g('A'), pg_temp.g('B')]) x),
  'O Caio está nos dois grupos');
select pg_temp.entrar(4);
select is(privado.meus_grupos(), '{}'::uuid[], 'O Davi não está em grupo nenhum');
select 1 where set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(3), 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-0000000000ff')::text, true) is null;
select is(privado.meus_grupos(), '{}'::uuid[], 'Com a sessão encerrada, o Caio não tem grupos');
-- Dado o Hugo desativado, então não tem grupos nem conta entre os integrantes; reativado, volta a participar
update public.perfis set ativo = false where id = pg_temp.id(7);
select pg_temp.entrar(7);
select is(privado.meus_grupos(), '{}'::uuid[], 'Desativado, o Hugo não tem grupos');
select ok(not pg_temp.id(7) = any(privado.integrantes_dos_grupos('e0000000-0000-0000-0000-000000000001', array[pg_temp.g('B')])), 'Nem conta entre os integrantes do grupo');
select is(pg_temp.integrantes('B'), array['caio', 'hugo', 'ivo'], 'Mas continua no grupo');
update public.perfis set ativo = true where id = pg_temp.id(7);
select ok(pg_temp.id(7) = any(privado.integrantes_dos_grupos('e0000000-0000-0000-0000-000000000001', array[pg_temp.g('B')])), 'Reativado, volta a participar');
select is(privado.integrantes_dos_grupos('e0000000-0000-0000-0000-000000000002', array[pg_temp.g('B')]), '{}'::uuid[], 'Os integrantes só contam no escritório do grupo');
-- Dado o Ivo excluído da equipe, então sai dos grupos e perde as mensagens deles
update public.perfis set ativo = false where id = pg_temp.id(8);
update public.perfis set excluido_em = now() where id = pg_temp.id(8);
select is(pg_temp.integrantes('B'), array['caio', 'hugo'], 'Quem é excluído da equipe sai dos grupos');
select is(pg_temp.mensagens_de_grupo(8), '{}'::text[], 'E perde as mensagens de grupo');

-- ===== Mensagem de grupo: quem entra depois recebe uma só =====
select is(pg_temp.mensagens_de_grupo(2), array['Núcleo A:ana:true'], 'A Bia recebeu a mensagem de que a Ana a pôs no Núcleo A, não lida');
select is(pg_temp.mensagens_de_grupo(3), array['Núcleo A:ana:true', 'Núcleo B:ana:true'], 'O Caio, uma de cada grupo');
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_incluir_integrante(pg_temp.g('B'), pg_temp.id(1));
select is(pg_temp.mensagens_de_grupo(1), '{}'::text[], 'A administradora que inclui a si mesma não recebe mensagem');
select public.grupo_tirar_integrante(pg_temp.g('B'), pg_temp.id(1));
-- Quando a Ana tira o Caio do Núcleo B logo depois de pô-lo (o desfazer), então a mensagem dele some
select public.grupo_tirar_integrante(pg_temp.g('B'), pg_temp.id(3));
select is(pg_temp.mensagens_de_grupo(3), array['Núcleo A:ana:true'], 'Tirar em menos de 1 minuto apaga a mensagem ainda não lida');
select public.grupo_incluir_integrante(pg_temp.g('B'), pg_temp.id(3));
select is(pg_temp.mensagens_de_grupo(3), array['Núcleo A:ana:true', 'Núcleo B:ana:true'], 'Entrar de novo renova a mensagem');
reset role;
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_tirar_integrante(pg_temp.g('B'), pg_temp.id(7));
reset role;
select is(pg_temp.mensagens_de_grupo(7), array['Núcleo B:ana:true'], 'Tirar depois de 1 minuto não apaga a mensagem (sair não avisa)');
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*) from public.mensagens_de_grupo), 2::bigint, 'O Caio lê as suas mensagens de grupo');
select is(pg_temp.mudou('update public.mensagens_de_grupo set lido_em = now()'), 2, 'E as marca como lidas');
select throws_ok($$ update public.mensagens_de_grupo set criado_em = now() $$, '42501', null, 'Mas não muda mais nada nelas');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.mensagens_de_grupo), 1::bigint, 'A Bia só lê a dela');
reset role;

-- ===== Pôr o grupo nos itens =====
-- Quando a Ana põe o Núcleo A em um item de cada módulo (e na demanda arquivada D3), e o Núcleo B na demanda D2
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.mudou(format('update public.demandas set grupos = array[%L, %L]::uuid[] where codigo in (''D1'', ''D3'')', pg_temp.g('A'), pg_temp.g('A'))), 2,
  'A Ana põe o grupo nas demandas (repetido, entra uma vez)');
select is((select grupos from public.demandas where codigo = 'D1'), array[pg_temp.g('A')], 'O grupo repetido fica uma vez só');
select is(pg_temp.mudou(format('update public.demandas set grupos = array[%L]::uuid[] where codigo = ''D2''', pg_temp.g('B'))), 1, 'Põe o Núcleo B na demanda D2');
select is(pg_temp.mudou(format('update public.tarefas set grupos = array[%L]::uuid[] where codigo = ''T1''', pg_temp.g('A'))), 1, 'Na tarefa');
select is(pg_temp.mudou(format('update public.processos set grupos = array[%L]::uuid[] where codigo = ''P1''', pg_temp.g('A'))), 1, 'No processo');
select is(pg_temp.mudou(format('update public.compromissos set grupos = array[%L]::uuid[] where codigo = ''C1''', pg_temp.g('A'))), 1, 'No compromisso');
select is(pg_temp.mudou(format('update public.anotacoes set grupos = array[%L]::uuid[] where codigo = ''N1''', pg_temp.g('A'))), 1, 'Na anotação');
select lives_ok(format('select public.contrato_definir_grupos(%L, array[%L]::uuid[])', 'c0000000-0000-0000-0000-000000000001', pg_temp.g('A')), 'E no contrato, pela função');
select throws_ok(format('update public.demandas set grupos = array[%L]::uuid[] where codigo = ''D2''', pg_temp.g('E')), 'P0001', 'Grupo não encontrado neste escritório.',
  'Um grupo de outro escritório não entra num item');
select throws_ok($$ update public.demandas set grupos = array[gen_random_uuid()] where codigo = 'D2' $$, 'P0001', 'Grupo não encontrado neste escritório.', 'Nem um grupo que não existe');
select throws_ok(format('update public.contratos set grupos = array[%L]::uuid[] where codigo = ''AN11-0002-2030''', pg_temp.g('A')), '42501', null,
  'No contrato, nem a administradora põe o grupo direto na tabela');
select throws_ok(format('select public.contrato_definir_grupos(%L, array[%L]::uuid[])', 'c0000000-0000-0000-0000-000000000002', pg_temp.g('E')), 'P0001', 'Grupo não encontrado neste escritório.',
  'Nem pela função, um grupo de outro escritório');
reset role;
select is((select alteracoes -> 'grupos' from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000001' and alteracoes ? 'grupos'),
  '{"de": null, "para": "Núcleo A"}'::jsonb, 'O histórico da demanda registra o grupo pelo nome');
select is((select alteracoes -> 'grupos' from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000001' and alteracoes ? 'grupos'),
  '{"de": null, "para": "Núcleo A"}'::jsonb, 'E o do contrato também');

-- ===== Quem vê e quem altera =====
-- Então a Bia (do Núcleo A) vê os itens do grupo, as tarefas da demanda do grupo, o compromisso do processo do grupo, a anotação ligada
-- à demanda do grupo e as demandas e tarefas do contrato do grupo; o Davi, sem grupo, só a Agenda geral (e o que é dele no contrato K1)
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D1 D3 D4', 'A Bia vê as demandas do grupo (também a arquivada) e a do contrato do grupo');
select is(pg_temp.vejo('tarefas'), 'T1 T2 T4', 'As tarefas do grupo, a da demanda do grupo e a do contrato do grupo');
select is(pg_temp.vejo('processos'), 'P1', 'O processo do grupo');
select is(pg_temp.vejo('compromissos'), 'C1 C2 C4', 'O compromisso do grupo, o do processo do grupo e a Agenda geral');
select is(pg_temp.vejo('anotacoes'), 'N1 N2', 'A anotação do grupo e a ligada à demanda do grupo');
select is(pg_temp.vejo('contratos_da_equipe'), 'AN11-0001-2030', 'O contrato do grupo, pela view');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D1 D2 D3 D4', 'O Caio, nos dois grupos, vê as demandas dos dois');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D4', 'O Davi não vê as demandas do grupo (só a do contrato em que está)');
select is(pg_temp.vejo('tarefas'), 'T4', 'Nem as tarefas');
select is(pg_temp.vejo('processos'), '', 'Nem o processo');
select is(pg_temp.vejo('compromissos'), 'C4', 'Nem os compromissos (só a Agenda geral)');
select is(pg_temp.vejo('anotacoes'), '', 'Nem as anotações');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D9', 'A Eva, do outro escritório, não vê nenhum item do primeiro');
select is(pg_temp.vejo('tarefas') || pg_temp.vejo('processos') || pg_temp.vejo('compromissos') || pg_temp.vejo('anotacoes') || pg_temp.vejo('contratos_da_equipe'), '',
  'Em nenhum módulo');
reset role;
-- Quando a Bia altera os itens do grupo, então altera, como quem é posto um a um; o Davi não
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ update public.demandas set titulo = 'Demanda 1 pela Bia' where codigo = 'D1' $$), 1, 'A Bia altera a demanda do grupo');
select is(pg_temp.mudou($$ update public.tarefas set titulo = 'Tarefa 1 pela Bia' where codigo = 'T1' $$), 1, 'A tarefa do grupo');
select is(pg_temp.mudou($$ update public.tarefas set titulo = 'Tarefa 2 pela Bia' where codigo = 'T2' $$), 1, 'A tarefa da demanda do grupo');
select is(pg_temp.mudou($$ update public.processos set titulo = 'Processo 1 pela Bia' where codigo = 'P1' $$), 1, 'O processo do grupo');
select is(pg_temp.mudou($$ update public.compromissos set titulo = 'Reunião 1 pela Bia' where codigo = 'C1' $$), 1, 'O compromisso do grupo');
select is(pg_temp.mudou($$ update public.compromissos set titulo = 'Reunião 2 pela Bia' where codigo = 'C2' $$), 1, 'O compromisso do processo do grupo');
select is(pg_temp.mudou($$ update public.anotacoes set titulo = 'Anotação 1 pela Bia' where codigo = 'N1' $$), 1, 'A anotação do grupo');
select is(pg_temp.mudou($$ update public.anotacoes set titulo = 'Anotação 2 pela Bia' where codigo = 'N2' $$), 0, 'Mas a anotação ligada à demanda do grupo, só lê');
select is(pg_temp.mudou($$ update public.demandas set titulo = 'Demanda 4 pela Bia' where codigo = 'D4' $$), 0, 'E a demanda do contrato do grupo, só lê');
select is(pg_temp.mudou($$ update public.tarefas set titulo = 'Tarefa 4 pela Bia' where codigo = 'T4' $$), 0, 'E a tarefa do contrato do grupo, só lê');
select is(pg_temp.mudou($$ delete from public.demandas where codigo = 'D3' $$), 0, 'Excluir de vez continua com quem criou e com os administradores');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.mudou($$ update public.demandas set titulo = 'Pelo Davi' where codigo = 'D1' $$) + pg_temp.mudou($$ update public.tarefas set titulo = 'Pelo Davi' where codigo in ('T1', 'T2') $$)
  + pg_temp.mudou($$ update public.processos set titulo = 'Pelo Davi' where codigo = 'P1' $$) + pg_temp.mudou($$ update public.compromissos set titulo = 'Pelo Davi' where codigo in ('C1', 'C2') $$)
  + pg_temp.mudou($$ update public.anotacoes set titulo = 'Pelo Davi' where codigo = 'N1' $$), 0, 'O Davi, sem grupo, não altera nenhum deles');
reset role;

-- ===== Dentro do cartão =====
-- Quando a Bia (pelo grupo) comenta, põe etiqueta, usa o checklist, lança tempo, andamento e prazo e liga processo e tarefa, então pode
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Comentário da Bia') $$, 'Comenta na demanda do grupo');
select lives_ok($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000001', 'Comentário da Bia') $$, 'Na tarefa');
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Comentário da Bia') $$, 'No processo');
select lives_ok($$ insert into public.comentarios (compromisso_id, texto) values ('72000000-0000-0000-0000-000000000001', 'Comentário da Bia') $$, 'No compromisso');
select lives_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Comentário da Bia') $$, 'Na anotação');
select lives_ok($$ insert into public.demanda_etiquetas (demanda_id, etiqueta_id) values ('71000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, 'Põe etiqueta na demanda');
select lives_ok($$ insert into public.tarefa_etiquetas (tarefa_id, etiqueta_id) values ('70000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, 'Na tarefa');
select lives_ok($$ insert into public.processo_etiquetas (processo_id, etiqueta_id) values ('73000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, 'No processo');
select lives_ok($$ insert into public.compromisso_etiquetas (compromisso_id, etiqueta_id) values ('72000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, 'No compromisso');
select lives_ok($$ insert into public.demanda_listas (demanda_id, nome) values ('71000000-0000-0000-0000-000000000001', 'Lista da Bia') $$, 'Cria checklist na demanda');
select lives_ok($$ insert into public.demanda_lista_itens (lista_id, texto) values ('75000000-0000-0000-0000-000000000001', 'Item da Bia') $$, 'E item no checklist');
select lives_ok($$ insert into public.demanda_listas (tarefa_id, nome) values ('70000000-0000-0000-0000-000000000001', 'Lista da Bia') $$, 'Cria checklist na tarefa');
select lives_ok($$ insert into public.tarefa_tempos (tarefa_id, perfil_id, segundos) values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 60) $$, 'Lança tempo na tarefa');
select is((select total from public.resumo_do_tempo('70000000-0000-0000-0000-000000000001') limit 1), 60::bigint, 'E vê o resumo do tempo');
select is(public.tempo_da_demanda('71000000-0000-0000-0000-000000000001'), 0::bigint, 'E o tempo da demanda (nenhum nas tarefas dela)');
select lives_ok($$ insert into public.processo_andamentos (processo_id, tipo, data, texto) values ('73000000-0000-0000-0000-000000000001', 'andamento', current_date, 'Andamento da Bia') $$,
  'Lança andamento no processo');
select lives_ok($$ insert into public.processo_prazos (processo_id, descricao, final) values ('73000000-0000-0000-0000-000000000001', 'Prazo da Bia', '2030-01-15') $$, 'E prazo');
select lives_ok($$ insert into public.processo_demandas (processo_id, demanda_id, criado_por) values ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', auth.uid()) $$,
  'Liga a demanda do grupo ao processo do grupo');
select is(pg_temp.mudou($$ update public.tarefas set processo_id = '73000000-0000-0000-0000-000000000001' where codigo = 'T1' $$), 1, 'E a tarefa do grupo ao processo do grupo');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ insert into public.demanda_etiquetas (demanda_id, etiqueta_id) values ('71000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, '42501', null,
  'O Davi, sem grupo, não põe etiqueta');
select throws_ok($$ insert into public.tarefa_tempos (tarefa_id, perfil_id, segundos) values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 60) $$, '42501', null,
  'Nem lança tempo');
select throws_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Do Davi') $$, '42501', null, 'Nem comenta');
reset role;

-- ===== Menções =====
-- Então quem está num grupo do item pode ser mencionado nele; quem não está, não
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'O Caio (do grupo) pode ser mencionado na demanda');
select lives_ok($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'Na tarefa');
select lives_ok($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000002', 'Veja, @caio') $$, 'Na tarefa da demanda do grupo');
select lives_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'No processo');
select lives_ok($$ insert into public.comentarios (compromisso_id, texto) values ('72000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'No compromisso');
select lives_ok($$ insert into public.comentarios (compromisso_id, texto) values ('72000000-0000-0000-0000-000000000002', 'Veja, @caio') $$, 'No compromisso do processo do grupo');
select lives_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'Na anotação');
select throws_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Veja, @juca') $$, 'P0001',
  'Não é possível mencionar Juca nesta demanda: inclua essa pessoa como colaboradora antes.', 'Quem não está no grupo nem no item não pode ser mencionado');
select throws_ok($$ insert into public.comentarios (processo_id, texto) values ('73000000-0000-0000-0000-000000000001', 'Veja, @juca') $$, 'P0001',
  'Não é possível mencionar Juca neste processo: inclua essa pessoa como colaboradora antes.', 'Nem no processo');
select throws_ok($$ insert into public.comentarios (anotacao_id, texto) values ('ab000000-0000-0000-0000-000000000001', 'Veja, @juca') $$, 'P0001',
  'Não é possível mencionar Juca nesta anotação: inclua essa pessoa como participante antes.', 'Nem na anotação');
select throws_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @caio') $$, 'P0001',
  'Não é possível mencionar Caio em contratos: só advogados podem ser mencionados.', 'No contrato, continua valendo "só advogados"');
reset role;

-- ===== Contrato: o grupo dá a participação sem os valores =====
select pg_temp.entrar(2); set local role authenticated;
select results_eq($$ select ve_financeiro, valor, categoria, observacoes, participantes, (participacoes -> 0 -> 'percentual'), grupos from public.contratos_da_equipe $$,
  format($$ values (false, null::numeric, null::text, null::text, '[{"pessoa_id": "10000000-0000-0000-0000-000000000004"}]'::jsonb, 'null'::jsonb, array[%L]::uuid[]) $$, pg_temp.g('A')),
  'A Bia (pelo grupo) lê o contrato sem os valores, sem os percentuais, e vê os grupos');
select is((select count(*) from public.contratos), 0::bigint, 'Ela não lê a tabela dos contratos');
select is((select count(*) from public.contrato_participantes), 0::bigint, 'Nem a divisão');
select is((select count(*) from public.contrato_historico), 0::bigint, 'Nem o histórico');
select is((select count(*) from public.contrato_parcelas), 0::bigint, 'Nem as parcelas');
select is(pg_temp.mudou($$ update public.contratos set valor = 1 where codigo = 'AN11-0001-2030' $$) + pg_temp.mudou($$ update public.contratos set conta_destino_id = null where codigo = 'AN11-0001-2030' $$)
  + pg_temp.mudou($$ update public.contratos set participantes = '[]' where codigo = 'AN11-0001-2030' $$)
  + pg_temp.mudou(format('update public.contratos set responsavel_id = %L where codigo = ''AN11-0001-2030''', pg_temp.id(2))), 0,
  'Ela não altera o valor, a conta, a divisão nem o responsável direto na tabela');
select throws_ok($$ update public.contratos set grupos = '{}' where codigo = 'AN11-0001-2030' $$, '42501', null, 'Nem os grupos');
select lives_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"servico": "Serviço mudado pela Bia"}') $$,
  'Pela função, ela muda o que a equipe muda (sem valores), com a chave desligada');
select is((select servico from public.contratos_da_equipe), 'Serviço mudado pela Bia', 'E a mudança fica');
select throws_ok(format('select public.contrato_definir_grupos(%L, %L::uuid[])', 'c0000000-0000-0000-0000-000000000001', '{}'), 'P0001', 'Só quem é parte do contrato põe ou tira grupos.',
  'Ela (só pelo grupo) não põe nem tira grupos do contrato');
select ok(not privado.cuido_do_contrato('c0000000-0000-0000-0000-000000000001') and not privado.altero_o_contrato('c0000000-0000-0000-0000-000000000001'),
  'Para ela, cuido_do_contrato e altero_o_contrato continuam falsos');
reset role;
select pg_temp.entrar(9); set local role authenticated;
select throws_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"servico": "Pelo Juca"}') $$, 'P0001', 'Você não tem permissão para fazer isso.',
  'O Juca, sem grupo e sem parte, não muda o contrato');
select throws_ok(format('select public.contrato_definir_grupos(%L, %L::uuid[])', 'c0000000-0000-0000-0000-000000000001', '{}'), 'P0001', 'Só quem é parte do contrato põe ou tira grupos.',
  'Nem os grupos dele');
reset role;
-- Quando o Davi, parte por estar na divisão, põe e tira grupos do contrato, então pode
select pg_temp.entrar(4); set local role authenticated;
select lives_ok(format('select public.contrato_definir_grupos(%L, array[%L, %L]::uuid[])', 'c0000000-0000-0000-0000-000000000001', pg_temp.g('A'), pg_temp.g('B')), 'A parte põe grupos');
select is((select grupos from public.contratos_da_equipe where codigo = 'AN11-0001-2030'), array[pg_temp.g('A'), pg_temp.g('B')], 'E eles ficam');
select lives_ok(format('select public.contrato_definir_grupos(%L, array[%L]::uuid[])', 'c0000000-0000-0000-0000-000000000001', pg_temp.g('A')), 'E tira');
reset role;
select is(pg_temp.avisos(7, 'c0000000-0000-0000-0000-000000000001'), '{}'::text[], 'O Hugo, do Núcleo B posto e logo tirado do contrato (o desfazer), não fica com aviso');
-- Menção no contrato: quem está só pelo grupo não dá os valores a quem menciona, com a chave desligada ou ligada
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @juca') $$, 'A Bia (pelo grupo) menciona o Juca no contrato');
reset role;
select ok((select autor_sem_vinculo from public.comentarios where contrato_id = 'c0000000-0000-0000-0000-000000000001' and texto = 'Veja, @juca'), 'O comentário fica marcado como de quem não é parte');
select pg_temp.entrar(9); set local role authenticated;
select is((select count(*) from public.contratos) + (select count(*) from public.contratos_da_equipe), 0::bigint, 'Com a chave desligada, o Juca não ganha o contrato pela menção');
reset role;
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'De novo, @juca') $$, 'Com a chave ligada, ela menciona de novo');
reset role;
select ok((select bool_and(autor_sem_vinculo) from public.comentarios where contrato_id = 'c0000000-0000-0000-0000-000000000001' and texto ~ '@juca'), 'E continua marcado');
select pg_temp.entrar(9); set local role authenticated;
select results_eq($$ select ve_financeiro, valor from public.contratos_da_equipe where codigo = 'AN11-0001-2030' $$, $$ values (false, null::numeric) $$,
  'Com a chave ligada, o Juca lê o contrato pela chave, mas sem os valores');
reset role;
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
-- Dada uma menção de quem é parte (a Ana), então continua dando os valores, como hoje
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Agora a Ana, @juca') $$, 'A Ana menciona o Juca');
reset role;
select pg_temp.entrar(9); set local role authenticated;
select results_eq($$ select ve_financeiro, valor from public.contratos_da_equipe where codigo = 'AN11-0001-2030' $$, $$ values (true, 9000::numeric) $$,
  'A menção de quem é parte dá os valores, como hoje');
reset role;
-- Dada a Bia só pelo grupo no contrato, quando a Ana (parte) a menciona, então a menção não dá os valores a ela
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja isto, @bia e @juca') $$,
  'A Ana menciona a Bia (do grupo) e o Juca no contrato');
reset role;
select is((select mencoes_pelo_grupo from public.comentarios where texto = 'Veja isto, @bia e @juca'), array[pg_temp.id(2)],
  'O comentário guarda que a Bia foi mencionada estando num grupo do contrato (o Juca, não)');
select pg_temp.entrar(2); set local role authenticated;
select results_eq($$ select ve_financeiro, valor from public.contratos_da_equipe where codigo = 'AN11-0001-2030' $$, $$ values (false, null::numeric) $$,
  'A Bia, mencionada pela parte, continua lendo o contrato sem os valores');
select is((select count(*) from public.contratos) + (select count(*) from public.contrato_participantes) + (select count(*) from public.contrato_historico)
  + (select count(*) from public.contrato_parcelas), 0::bigint, 'E continua sem a tabela, a divisão, o histórico e as parcelas');
reset role;
-- Quando alguém manda a lista de mencionadas pelo grupo vazia, então o banco ignora e preenche de novo
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto, mencoes_pelo_grupo) values ('c0000000-0000-0000-0000-000000000001', 'De novo, @bia', '{}') $$,
  'A Ana grava um comentário mandando a lista vazia');
reset role;
select is((select mencoes_pelo_grupo from public.comentarios where texto = 'De novo, @bia'), array[pg_temp.id(2)], 'E a Bia fica marcada mesmo assim');

-- ===== Sair e entrar no grupo =====
-- Quando a Bia sai do Núcleo A, então deixa de ver os itens; quando o Davi entra, passa a ver
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_tirar_integrante(pg_temp.g('A'), pg_temp.id(2));
select public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(4));
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.vejo('demandas') || pg_temp.vejo('tarefas') || pg_temp.vejo('processos') || pg_temp.vejo('anotacoes') || pg_temp.vejo('contratos_da_equipe'), '',
  'A Bia, fora do grupo, deixa de ver os itens dele');
select is((select count(*) from public.contratos) + (select count(*) from public.contratos_da_equipe), 0::bigint,
  'Nem o contrato em que foi mencionada pela parte quando estava no grupo');
reset role;
-- Quando a Ana edita o comentário que mencionou a Bia, então a menção continua sem dar o contrato a ela
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.mudou($$ update public.comentarios set texto = 'Veja isto (editado), @bia e @juca' where texto = 'Veja isto, @bia e @juca' $$), 1, 'A Ana edita o comentário');
reset role;
select is((select mencoes_pelo_grupo from public.comentarios where texto = 'Veja isto (editado), @bia e @juca'), array[pg_temp.id(2)], 'A marca da Bia fica');
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.contratos) + (select count(*) from public.contratos_da_equipe), 0::bigint, 'E a Bia continua sem o contrato');
select is(pg_temp.vejo('compromissos'), 'C4', 'Fica só a Agenda geral');
select throws_ok($$ select public.cartao_sair('demandas', '71000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você não está entre as pessoas deste cartão.',
  'E não sai de um cartão em que não está');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D1 D3 D4', 'O Davi, que entrou no grupo, passa a ver as demandas dele');
select is(pg_temp.vejo('processos'), 'P1', 'E o processo');
select is(pg_temp.mensagens_de_grupo(4), array['Núcleo A:ana:true'], 'E recebeu uma mensagem só, a do grupo');
select is(pg_temp.avisos(4, '71000000-0000-0000-0000-000000000001'), '{}'::text[], 'E nenhum aviso por item');
-- Quando quem está só pelo grupo tenta sair do cartão, então a mensagem diz que é pelo grupo
select throws_ok($$ select public.cartao_sair('demandas', '71000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Você está neste cartão pelo grupo Núcleo A. Para sair, peça a um administrador que tire você do grupo ou tire o grupo do cartão.',
  'Quem está só pelo grupo não sai sozinho');
reset role;
-- Dada a Bia como colaboradora da D1 e de novo no grupo, quando sai do grupo, então continua na D1
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(2));
update public.demandas set colaboradores = array[pg_temp.id(2)] where codigo = 'D1';
select public.grupo_tirar_integrante(pg_temp.g('A'), pg_temp.id(2));
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D1', 'A Bia, colaboradora, continua na demanda depois de sair do grupo');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(2));
select public.grupo_tirar_integrante(pg_temp.g('A'), pg_temp.id(4));
update public.demandas set colaboradores = '{}' where codigo = 'D1';
reset role;

-- ===== Avisos (#377) =====
select pg_temp.passar_o_tempo();
-- Então o grupo posto num item avisou cada integrante, com o grupo, menos quem pôs
select is(pg_temp.avisos(3, '71000000-0000-0000-0000-000000000001'), array['participante:Núcleo A'], 'O Caio recebeu o aviso da demanda, pelo Núcleo A');
select is(pg_temp.avisos(3, '73000000-0000-0000-0000-000000000001'), array['participante:Núcleo A'], 'E o do processo');
select is(pg_temp.avisos(1, '71000000-0000-0000-0000-000000000001'), '{}'::text[], 'Quem pôs o grupo não recebe aviso');
select is(pg_temp.avisos(7, '71000000-0000-0000-0000-000000000001'), '{}'::text[], 'Quem não está no grupo não recebe aviso');
select is(pg_temp.avisos(3, 'c0000000-0000-0000-0000-000000000001'), array['participante:Núcleo A'], 'No contrato, a função de pôr grupos também avisa');
-- Quando a Ana põe os dois grupos de uma vez na tarefa T3, então o Caio (nos dois) recebe um aviso só, pelo primeiro grupo em ordem de nome
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set grupos = array[pg_temp.g('B'), pg_temp.g('A')] where codigo = 'T3';
reset role;
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000003'), array['participante:Núcleo A'], 'Quem está em dois grupos postos juntos recebe um aviso só');
select is(pg_temp.avisos(7, '70000000-0000-0000-0000-000000000003'), '{}'::text[], 'O Hugo, que saiu do Núcleo B, não');
-- Dada a Bia já no processo P2, quando a Ana põe o Núcleo A nele, então a Bia não recebe aviso (já estava) e o Caio recebe
select pg_temp.entrar(1); set local role authenticated;
update public.processos set colaboradores = array[pg_temp.id(2)] where codigo = 'P2';
reset role;
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.processos set grupos = array[pg_temp.g('A')] where codigo = 'P2';
reset role;
select is(pg_temp.avisos(2, '73000000-0000-0000-0000-000000000002'), array['participante'], 'A Bia, que já estava no processo, fica só com o aviso de quando foi posta, sem o grupo');
select is(pg_temp.avisos(3, '73000000-0000-0000-0000-000000000002'), array['participante:Núcleo A'], 'O Caio recebe o aviso pelo grupo');
-- Quando a Ana põe o grupo na anotação N3 e logo desfaz, então os avisos somem
select pg_temp.entrar(1); set local role authenticated;
update public.anotacoes set grupos = array[pg_temp.g('A')] where codigo = 'N3';
update public.anotacoes set grupos = '{}' where codigo = 'N3';
reset role;
select is(pg_temp.avisos(2, 'ab000000-0000-0000-0000-000000000003') || pg_temp.avisos(3, 'ab000000-0000-0000-0000-000000000003'), '{}'::text[], 'O desfazer em menos de 1 minuto apaga os avisos');
-- ainda_faz_parte: pelo grupo, sim; fora do grupo, não
select pg_temp.entrar(3); set local role authenticated;
select ok((select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where m.demanda_id = '71000000-0000-0000-0000-000000000001'), 'O Caio ainda faz parte da demanda, pelo grupo');
select is((select grupo_id from public.mensagens_de_inclusao m where m.demanda_id = '71000000-0000-0000-0000-000000000001'), pg_temp.g('A'), 'E o aviso diz por qual grupo');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_tirar_integrante(pg_temp.g('A'), pg_temp.id(3));
reset role;
select pg_temp.entrar(3); set local role authenticated;
select ok(not (select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where m.demanda_id = '71000000-0000-0000-0000-000000000001'),
  'Fora do grupo, o Caio não faz mais parte da demanda');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(3));
reset role;

-- ===== O filtro "Grupo da equipe" em Tarefas =====
-- Quando o Caio filtra as tarefas pelo Núcleo A, então vêm as do grupo e a da demanda do grupo; o Davi, sem grupo, não recebe nenhuma
select pg_temp.entrar(3); set local role authenticated;
select is((select string_agg(codigo, ' ' order by codigo) from public.tarefas_dos_grupos(array[pg_temp.g('A')])), 'T1 T2 T3',
  'As tarefas do grupo e a da demanda do grupo');
select is((select string_agg(codigo, ' ' order by codigo) from public.tarefas_dos_grupos(array[pg_temp.g('B')])), 'T3', 'Pelo outro grupo, só a tarefa dele');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.tarefas_dos_grupos(array[pg_temp.g('A')])), 0::bigint, 'Quem não está no grupo não recebe nada (as regras de leitura valem)');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is((select count(*) from public.tarefas_dos_grupos(array[pg_temp.g('A')])), 0::bigint, 'Nem quem é de outro escritório');
reset role;

-- ===== Pedir para participar (#363) =====
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.itens_para_pedir('D1')), 0::bigint, 'A Bia não pede para participar da demanda do grupo (ela já a vê)');
select is((select count(*) from public.itens_para_pedir('D2')), 1::bigint, 'Mas pede da que não é do grupo dela');
reset role;
select ok(not pg_temp.id(2) = any(array(select privado.aprovadores_do_pedido('demandas', '71000000-0000-0000-0000-000000000001'))), 'Quem está no grupo não aprova pedidos do item');

-- ===== A versão no ar (sem grupos) continua funcionando =====
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.demandas (titulo, responsavel_id) values ('Demanda da versão anterior', 'a0000000-0000-0000-0000-000000000001') $$, 'Criar só com as colunas de antes funciona');
select is((select grupos from public.demandas where titulo = 'Demanda da versão anterior'), '{}'::uuid[], 'E o item nasce sem grupo');
select is(pg_temp.mudou($$ update public.demandas set titulo = 'Demanda 1 de antes', colaboradores = '{}' where codigo = 'D1' $$), 1, 'Alterar só com as colunas de antes funciona');
select is((select grupos from public.demandas where codigo = 'D1'), array[pg_temp.g('A')], 'E o grupo fica');
select lives_ok($$ select id, escritorio_id, numero, sigla, ano, codigo, codigo_antigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, participante_id,
                         etapa_id, etapa_ordem, assinado_em, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, busca, ve_financeiro, categoria,
                         valor, entrada, parcelas, descontos, primeiro_pagamento, percentual_escritorio, participante_percentual, indicador_id, indicador_percentual,
                         conta_destino_id, documento_url, observacoes, participantes, clientela, participacoes from public.contratos_da_equipe $$,
  'A view contratos_da_equipe é lida com a lista de colunas de antes');
reset role;
-- Depois de todas as colunas de antes (as que vieram mais tarde, como o início das negociações da #311, ficam depois dela).
select is((select attname::text from pg_attribute where attrelid = 'public.contratos_da_equipe'::regclass
           and attnum = (select attnum + 1 from pg_attribute where attrelid = 'public.contratos_da_equipe'::regclass and attname = 'participacoes')), 'grupos',
  'A coluna nova da view fica no fim, logo depois das colunas de antes');

-- ===== Limite de 10 grupos por item =====
select pg_temp.entrar(1); set local role authenticated;
insert into grupos_do_teste select 'L' || n, public.grupo_criar('Lote ' || n) from generate_series(1, 11) n;
select throws_ok($$ update public.demandas set grupos = (select array_agg(id) from grupos_do_teste where apelido like 'L%') where codigo = 'D2' $$, 'P0001',
  'Um item pode ter até 10 grupos.', 'Um item não passa de 10 grupos');
select is(pg_temp.mudou($$ update public.demandas set grupos = grupos || (select array_agg(id) from grupos_do_teste where apelido in ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9')) where codigo = 'D2' $$), 1,
  'Até 10, pode');
select public.grupo_excluir(id) from grupos_do_teste where apelido like 'L%';
select is((select grupos from public.demandas where codigo = 'D2'), array[pg_temp.g('B')], 'Excluir os grupos tira cada um do item, e o que não foi excluído fica');
reset role;

-- ===== Desempenho =====
-- O plano da leitura como usuário comum: meus_grupos() roda uma vez (num InitPlan), nunca cartão a cartão.
create function pg_temp.plano(p_sql text) returns text language plpgsql as $$
declare r text := ''; l text;
begin
  for l in execute 'explain (verbose, costs off) ' || p_sql loop r := r || l || E'\n'; end loop;
  return r;
end $$;
grant execute on function pg_temp.plano(text) to authenticated;
select pg_temp.entrar(2); set local role authenticated;
select ok(pg_temp.plano('select id from public.demandas') ~ 'Output: privado\.meus_grupos\(\)' and pg_temp.plano('select id from public.demandas') !~ 'Filter: [^\n]*meus_grupos',
  'Na leitura de demandas, meus_grupos() só aparece num InitPlan');
select ok(pg_temp.plano('select id from public.tarefas') ~ 'Output: privado\.meus_grupos\(\)' and pg_temp.plano('select id from public.tarefas') !~ 'Filter: [^\n]*meus_grupos',
  'Na leitura de tarefas também');
reset role;
-- Volume: 3 mil demandas no Núcleo V, da Bia, e 20 mil tarefas ligadas a elas. A leitura de tarefas da Bia usa o caminho do grupo antes
-- da conferência cartão a cartão, com um hash (e não um "= ANY" sobre o array das demandas), e acha todas.
select pg_temp.entrar(1); set local role authenticated;
insert into grupos_do_teste values ('V', public.grupo_criar('Núcleo V'));
select public.grupo_incluir_integrante(pg_temp.g('V'), pg_temp.id(2));
reset role;
set local session_replication_role = replica;
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, grupos, criado_por)
select ('7a000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'e0000000-0000-0000-0000-000000000001', 'VD' || n, 'Demanda em volume', pg_temp.id(1), '{}', array[pg_temp.g('V')], pg_temp.id(1)
from generate_series(1, 3000) n;
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, criado_por)
select ('7b000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'e0000000-0000-0000-0000-000000000001', 'VT' || n, 'Tarefa em volume', pg_temp.id(1), '{}',
       ('7a000000-0000-0000-0000-' || lpad((1 + n % 3000)::text, 12, '0'))::uuid, pg_temp.id(1)
from generate_series(1, 20000) n;
set local session_replication_role = origin;
analyze public.demandas;
analyze public.tarefas;
select pg_temp.entrar(2); set local role authenticated;
select ok(pg_temp.plano('select id from public.tarefas') ~ 'hashed SubPlan', 'As tarefas pelas demandas do grupo saem de um hash');
select ok(pg_temp.plano('select id from public.tarefas') ~ 'tarefas\.demanda_id = \(hashed SubPlan [0-9]+\)'
          and pg_temp.plano('select id from public.tarefas') !~ E'\n  InitPlan [0-9]+\n    ->  Result\n          Output: privado\\.demandas_dos_meus_grupos',
  'Sem "= ANY" sobre o array das demandas do grupo: a lista vem dentro do hash, e não de um InitPlan comparado linha a linha');
select ok(strpos(pg_temp.plano('select id from public.tarefas'), 'hashed SubPlan') < strpos(pg_temp.plano('select id from public.tarefas'), 'estou_na_tarefa'),
  'O caminho do grupo vem antes da conferência cartão a cartão');
select is((select count(*) from public.tarefas where codigo like 'VT%'), 20000::bigint, 'A Bia vê as 20 mil tarefas das demandas do grupo');
reset role;

-- ===== Exclusão do grupo =====
-- Dado o Núcleo A em demandas (uma arquivada), tarefas, processos, compromissos, anotação e no contrato com parcelas
select pg_temp.entrar(1); set local role authenticated;
select results_eq(format('select modulo, quantos from public.grupo_contar_itens(%L)', pg_temp.g('A')),
  $$ values ('demandas'::text, 2), ('tarefas', 2), ('processos', 2), ('compromissos', 1), ('contratos', 1), ('anotacoes', 1) $$,
  'A contagem por módulo inclui os arquivados');
-- Quando a Ana exclui o grupo
select lives_ok(format('select public.grupo_excluir(%L)', pg_temp.g('A')), 'A administradora exclui o grupo');
reset role;
-- Então o id sai de todos os itens (também da demanda arquivada e do contrato com parcelas), com a linha no histórico, e quem só estava
-- pelo grupo deixa de ver
select is((select count(*) from public.demandas where grupos @> array[pg_temp.g('A')]) + (select count(*) from public.tarefas where grupos @> array[pg_temp.g('A')])
  + (select count(*) from public.processos where grupos @> array[pg_temp.g('A')]) + (select count(*) from public.compromissos where grupos @> array[pg_temp.g('A')])
  + (select count(*) from public.contratos where grupos @> array[pg_temp.g('A')]) + (select count(*) from public.anotacoes where grupos @> array[pg_temp.g('A')]), 0::bigint,
  'O grupo sai de todos os itens');
select is((select grupos from public.demandas where codigo = 'D3'), '{}'::uuid[], 'Também da demanda arquivada');
select is((select grupos from public.contratos where codigo = 'AN11-0001-2030'), '{}'::uuid[], 'E do contrato com parcelas');
select is((select grupos from public.tarefas where codigo = 'T3'), array[pg_temp.g('B')], 'O outro grupo do item fica');
select is((select alteracoes -> 'grupos' from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000003' and alteracoes ? 'grupos' order by id desc limit 1),
  '{"de": "Núcleo A", "para": null}'::jsonb, 'O histórico registra a saída do grupo');
select is((select count(*) from public.grupo_integrantes where grupo_id = pg_temp.g('A')) + (select count(*) from public.mensagens_de_grupo where grupo_id = pg_temp.g('A')), 0::bigint,
  'Os integrantes e as mensagens do grupo saem junto');
select is((select count(*) from public.mensagens_de_inclusao where grupo_id is not null and item_id = '71000000-0000-0000-0000-000000000001'), 0::bigint,
  'Os avisos ficam, sem o grupo');
select is((select count(*) from public.auditoria where tabela = 'grupos_da_equipe' and acao = 'exclusao' and resumo ->> 'nome' = 'Núcleo A'), 1::bigint, 'A exclusão fica no registro de ações');
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.vejo('demandas'), '', 'A Bia, que só estava pelo grupo, deixa de ver as demandas dele');
select is(pg_temp.vejo('processos'), 'P2', 'Fica só com o que é dela por conta própria');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vejo('demandas'), 'D2', 'O Caio fica só com o que é do outro grupo dele');
select ok(not (select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where m.demanda_id = '71000000-0000-0000-0000-000000000001'),
  'E o aviso da demanda diz que ele não faz mais parte');
reset role;

-- ===== Tirar o próprio grupo pelas bolinhas (a tela, #378) =====
-- Dado o Caio, que vê a demanda D2 só pelo Núcleo B. Quando ele tira o grupo, com ou sem a leitura de volta (returning), então a regra
-- de leitura recusa a linha nova (quem está só pelo grupo não sai sozinho: a tela não oferece o "Tirar" e manda pedir a um administrador).
select pg_temp.entrar(3); set local role authenticated;
select throws_ok($$ update public.demandas set grupos = '{}' where codigo = 'D2' returning id $$, '42501', null,
  'Com a leitura de volta, o Caio não tira o único grupo pelo qual vê a demanda');
select throws_ok($$ update public.demandas set grupos = '{}' where codigo = 'D2' $$, '42501', null, 'Nem sem ela');
select is(pg_temp.vejo('demandas'), 'D2', 'E continua vendo a demanda');
reset role;

select * from finish();
rollback;
