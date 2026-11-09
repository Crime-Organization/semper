-- Fase de adaptação: toda a equipe vê e edita tudo, menos o financeiro (#275).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (participante do contrato) e Caio (estagiário sem vínculo), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-fase', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true, "compromissos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-fase-2', '{"pessoas": true, "demandas": true, "equipe_ve_tudo": true, "equipe_edita_tudo": true}');
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

set local session_replication_role = replica;
update public.perfis set funcao = 'advogado' where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');
update public.perfis set funcao = 'estagiario' where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BIA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'P6', 'contato', 'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000001');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000002';
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, clientes, responsavel_id, servico, objetos, categoria, valor, observacoes, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE', '{10000000-0000-0000-0000-000000000005}',
   'a0000000-0000-0000-0000-000000000001', 'Registro', '{Registro}', 'pro_labore', 9000, 'Combinado', '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001');
insert into public.contrato_clientes (contrato_id, pessoa_id, escritorio_id, ordem) values ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 0);
insert into public.contrato_participantes (contrato_id, pessoa_id, escritorio_id, percentual, ordem) values ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 20, 0);
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reuniao', '2030-01-15', '14:30', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.demanda_listas (id, escritorio_id, demanda_id, nome) values ('75000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Lista');
insert into public.etiquetas (id, escritorio_id, cor) values ('77000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'verde');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.contrato() returns public.contratos language sql as $$ select * from public.contratos where id = 'c0000000-0000-0000-0000-000000000001' $$;
create function pg_temp.chave() returns jsonb language sql as $$ select modulos from public.escritorios where id = 'e0000000-0000-0000-0000-000000000001' $$;

-- Com a chave desligada, vale a regra de sempre
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.demandas set titulo = 'x' $$), 0, 'Chave desligada: não altera a demanda');
select is(pg_temp.mudou($$ update public.compromissos set titulo = 'x' $$), 0, 'Chave desligada: não altera o compromisso');
select throws_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"objetos": ["x"]}') $$, 'P0001', 'Você não tem permissão para fazer isso.', 'Chave desligada: não altera o contrato');
select throws_ok($$ select public.fase_de_adaptacao_definir(true) $$, 'P0001', 'Só um administrador muda esta opção.', 'Quem não é administrador não liga');
reset role;
select is(pg_temp.chave() ? 'equipe_edita_tudo', false, 'A tentativa não ligou nada');

-- Quando a administradora liga a fase
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.fase_de_adaptacao_definir(true) $$, 'A administradora liga a fase');
reset role;
select is(pg_temp.chave() ->> 'equipe_edita_tudo', 'true', 'A fase fica ligada');
select is(pg_temp.chave() ->> 'equipe_ve_tudo', 'true', 'A visualização fica ligada junto');
select is((select count(*) from public.auditoria where tabela = 'escritorios' and registro_id = 'e0000000-0000-0000-0000-000000000001' and resumo ->> 'fase_de_adaptacao' = 'true'), 1::bigint, 'Fica no registro de ações');

-- Então quem não tem vínculo altera os cartões e o que fica dentro deles
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.demandas set titulo = 'Nova' $$), 1, 'Altera a demanda');
select is(pg_temp.mudou($$ update public.tarefas set titulo = 'Nova' $$), 1, 'Altera a tarefa');
select is(pg_temp.mudou($$ update public.processos set titulo = 'Novo' $$), 1, 'Altera o processo');
select is(pg_temp.mudou($$ update public.compromissos set titulo = 'Novo' $$), 1, 'Altera o compromisso');
select is(pg_temp.mudou($$ update public.tarefas set arquivado_em = now() $$), 1, 'Arquiva a tarefa');
select lives_ok($$ insert into public.comentarios (compromisso_id, texto) values ('72000000-0000-0000-0000-000000000001', 'Veja, @' || (select usuario from public.perfis where id = 'a0000000-0000-0000-0000-000000000002')) $$, 'Menciona quem não está no compromisso');
select lives_ok($$ insert into public.demanda_lista_itens (lista_id, texto) values ('75000000-0000-0000-0000-000000000001', 'Novo') $$, 'Cria item na lista');
select lives_ok($$ insert into public.demanda_etiquetas (demanda_id, etiqueta_id) values ('71000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, 'Põe etiqueta na demanda');
select lives_ok($$ insert into public.processo_prazos (processo_id, descricao, final) values ('73000000-0000-0000-0000-000000000001', 'Prazo', '2030-01-15') $$, 'Lança prazo no processo');

-- Então excluir de vez continua restrito
select is(pg_temp.mudou($$ delete from public.tarefas $$), 0, 'Não exclui de vez o cartão de outra pessoa');

-- Então, no contrato, quem não é parte altera só o que não é valor
select is(pg_temp.mudou($$ update public.contratos set valor = 1 $$), 0, 'A tabela do contrato continua fechada');
select is((select count(*) from public.contratos), 0::bigint, 'Nem lê a tabela do contrato');
select lives_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"objetos": ["Marca", "Patente"], "servico": "Marca; Patente", "clientes": ["10000000-0000-0000-0000-000000000006"]}') $$, 'Altera objetos e clientes');
select lives_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"responsavel_id": "a0000000-0000-0000-0000-000000000003", "participantes": ["10000000-0000-0000-0000-000000000006"]}') $$, 'Responsável e participantes enviados são ignorados');
select lives_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"valor": 1, "observacoes": "x", "documento_url": "y", "categoria": "pro_bono"}') $$, 'O que é financeiro é ignorado');
reset role;
select is((pg_temp.contrato()).objetos, '{Marca,Patente}'::text[], 'Os objetos mudaram');
select is((pg_temp.contrato()).clientes, '{10000000-0000-0000-0000-000000000006}'::uuid[], 'Os clientes mudaram');
select is((pg_temp.contrato()).valor, 9000::numeric, 'O valor não mudou');
select is((pg_temp.contrato()).observacoes, 'Combinado', 'As observações não mudaram');
select is((pg_temp.contrato()).categoria, 'pro_labore', 'A categoria não mudou');
select is(((pg_temp.contrato()).participantes -> 0 ->> 'percentual')::numeric, 20::numeric, 'Os participantes não mudaram');
select is((pg_temp.contrato()).responsavel_id, 'a0000000-0000-0000-0000-000000000001'::uuid, 'O responsável não mudou');
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$ insert into public.contrato_etiquetas (contrato_id, etiqueta_id) values ('c0000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, 'Põe etiqueta no contrato');
select is((select valor from public.contratos_da_equipe where id = 'c0000000-0000-0000-0000-000000000001'), null, 'Continua sem ver o valor');
select is((select ve_financeiro from public.contratos_da_equipe where id = 'c0000000-0000-0000-0000-000000000001'), false, 'Continua sem ser parte');
select throws_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"etapa_id": "b0000000-0000-0000-0000-000000000099"}') $$, null, null, 'Situação de outro quadro é recusada');
reset role;

-- Então outro escritório não alcança nada, mesmo com a chave dele ligada
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.mudou($$ update public.demandas set titulo = 'x' where id = '71000000-0000-0000-0000-000000000001' $$), 0, 'Outro escritório não altera a demanda');
select throws_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{"objetos": ["x"]}') $$, 'P0001', 'Contrato não encontrado neste escritório.', 'Outro escritório não altera o contrato');
reset role;

-- E quem não entrou não chama as funções
set local role anon;
select throws_ok($$ select public.fase_de_adaptacao_definir(false) $$, '42501', null, 'Quem não entrou não muda a opção');
select throws_ok($$ select public.contrato_alterar_sem_valores('c0000000-0000-0000-0000-000000000001', '{}') $$, '42501', null, 'Quem não entrou não altera o contrato');
reset role;

-- Quando a administradora desliga, então volta a regra normal
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.fase_de_adaptacao_definir(false) $$, 'A administradora desliga a fase');
reset role;
select is(pg_temp.chave() ? 'equipe_edita_tudo', false, 'A edição fica desligada');
select is(pg_temp.chave() ? 'equipe_ve_tudo', false, 'A visualização fica desligada');
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$ update public.demandas set titulo = 'x' $$), 0, 'Desligada: não altera mais');
select is((select count(*) from public.demandas where id = '71000000-0000-0000-0000-000000000001'), 0::bigint, 'Desligada: não vê mais');
reset role;

select * from finish();
rollback;
