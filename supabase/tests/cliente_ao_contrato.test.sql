-- Do cliente ao contrato (#269): a pessoa em "Contrato fechado" ganha um contrato em "Aguardando assinatura"; as demandas
-- nascem dos objetos de verdade, com as tarefas do modelo de mesmo nome; a conta de destino é do próprio escritório.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Dado um escritório novo com uma advogada (com CPF), uma pessoa do administrativo, um advogado desativado e quatro
-- clientes (o dois com a advogada entre os responsáveis; o quatro com o desativado antes dela); uma conta ativa e uma
-- arquivada; e um outro escritório, com uma conta e uma pessoa.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-cliente-contrato', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-cliente-contrato-2', '{"pessoas": true, "contratos": true, "financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'adv@exemplo.test', 'Ana Advogada', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'adm@exemplo.test', 'Bia Administrativo', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'ina@exemplo.test', 'Caio Desativado', 'usuario', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'adv@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'adm@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ina@exemplo.test', '{"convite":"c3"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, documento, criado_por) values
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'P9', 'contato', 'ANA ADVOGADA', '12345678909', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE UM', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'contato', 'CLIENTE DOIS', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'contato', 'CLIENTE TRES', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'contato', 'CLIENTE QUATRO', null, 'a0000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'P1', 'contato', 'PESSOA DO OUTRO', null, null);
-- As colunas-marco que o escritório cria para os outros quadros. Ele nasce com esses quadros prontos (#295): aqui eles
-- têm só estas colunas, mais a "Aguardando assinatura" que o gatilho do cliente ao contrato cria.
delete from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'
  and (modulo in ('demandas', 'tarefas') or (modulo = 'contratos' and marco is distinct from 'aguardando_assinatura'));
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, marco) values
  ('e0000000-0000-0000-0000-000000000001', 'contratos', 'Assinado', 3, 'assinado'),
  ('e0000000-0000-0000-0000-000000000001', 'demandas', 'Para fazer', 1, 'inicio'),
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'A fazer', 1, 'inicio');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000009' where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis set funcao = 'administrativo' where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.pessoa_responsaveis (pessoa_id, perfil_id, escritorio_id, incluido_em) values
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', now()),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', now());
insert into public.financeiro_contas (id, escritorio_id, nome, tem_das, saldo_inicial, saldo_inicial_em, criado_por, arquivada_em) values
  ('c1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PJ', true, 0, date '2026-01-01', 'a0000000-0000-0000-0000-000000000001', null),
  ('c1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'PF ANTIGA', false, 0, date '2026-01-01', 'a0000000-0000-0000-0000-000000000001', now()),
  ('c2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'CONTA DO OUTRO', false, 0, date '2026-01-01', null, null);
insert into public.lista_modelos (escritorio_id, nome, itens) values ('e0000000-0000-0000-0000-000000000001', 'Registro de Marca', array['Busca prévia', 'Depósito no INPI']);
set local session_replication_role = origin;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.assinado() returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'contratos' and marco = 'assinado'
$$;

-- Então o escritório novo já nasce com as colunas e os marcos de Pessoas e com "Aguardando assinatura" em Contratos.
select is((select nome from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'pessoas' and marco = 'contrato_fechado'), 'Contrato fechado', 'Pessoas tem a coluna "Contrato fechado"');
select ok(exists (select 1 from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'pessoas' and nome = 'Em negociação'), 'Pessoas tem a coluna "Em negociação"');
select ok(exists (select 1 from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'contratos' and marco = 'aguardando_assinatura'), 'Contratos tem a coluna-marco "Aguardando assinatura"');

-- Dado um escritório que já tem as colunas com esses nomes (como os de hoje), e um que só tem a coluna do assinado.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000003', 'Escritório antigo', 'teste-cliente-contrato-3'),
  ('e0000000-0000-0000-0000-000000000004', 'Escritório só com assinado', 'teste-cliente-contrato-4');
delete from public.quadro_colunas where escritorio_id in ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004');
insert into public.quadro_colunas (id, escritorio_id, modulo, nome, ordem, marco) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'pessoas', 'CONTRATO FECHADO', 4, null),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'pessoas', 'Em negociacao', 3, null),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'contratos', 'Aguardando Assinatura', 2, null),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000003', 'contratos', 'Assinado', 5, 'assinado'),
  ('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000004', 'contratos', 'Assinado', 5, 'assinado');
-- Quando a migração prepara as colunas deles.
select privado.colunas_do_cliente_ao_contrato('e0000000-0000-0000-0000-000000000003');
select privado.colunas_do_cliente_ao_contrato('e0000000-0000-0000-0000-000000000004');
-- Então a coluna que já existe ganha o marco, sem coluna repetida; e a nova fica logo antes da coluna do assinado.
select is((select marco from public.quadro_colunas where id = 'f0000000-0000-0000-0000-000000000001'), 'contrato_fechado', 'A coluna "Contrato fechado" que já existia ganha o marco');
select is((select marco from public.quadro_colunas where id = 'f0000000-0000-0000-0000-000000000003'), 'aguardando_assinatura', 'A coluna "Aguardando assinatura" que já existia ganha o marco');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000003'), 4::bigint, 'Nenhuma coluna repetida nasce no escritório que já tinha as colunas');
select is((select ordem from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000004' and marco = 'aguardando_assinatura')::numeric, 4.5::numeric, '"Aguardando assinatura" nova fica logo antes do assinado');

-- Quando a advogada fecha o contrato do cliente um, então nasce um contrato dela, em "Aguardando assinatura", com o objeto "A definir".
select pg_temp.entrar(1);
set local role authenticated;
create temp table fechado as select (r ->> 'id')::uuid as id, (r ->> 'novo')::boolean as novo from public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000001') r;
reset role;
select is((select novo from fechado), true, 'A primeira vez, o contrato é novo');
select is((select k.responsavel_id from public.contratos k where k.id = (select id from fechado)), 'a0000000-0000-0000-0000-000000000001'::uuid, 'A responsável é quem moveu, por ser advogada');
select is((select c.marco from public.contratos k join public.quadro_colunas c on c.id = k.etapa_id where k.id = (select id from fechado)), 'aguardando_assinatura', 'O contrato nasce em "Aguardando assinatura"');
select is((select k.clientes from public.contratos k where k.id = (select id from fechado)), array['10000000-0000-0000-0000-000000000001'::uuid], 'A pessoa é a cliente do contrato');
select is((select k.objetos from public.contratos k where k.id = (select id from fechado)), array['A definir'], 'O objeto fica "A definir"');
select is((select count(*) from public.objeto_sugestoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and privado.sem_acento(btrim(descricao)) = 'a definir'), 0::bigint,
  '"A definir" não entra nas sugestões de objetos do escritório');

-- Quando fecha de novo a mesma pessoa, então é o mesmo contrato, que não é novo.
select pg_temp.entrar(1);
set local role authenticated;
select is((public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000001') ->> 'id')::uuid, (select id from fechado), 'Mover de novo não cria outro contrato');
select is((public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000001') ->> 'novo')::boolean, false, 'De novo, o contrato não é novo');
-- Quando tenta fechar a pessoa de outro escritório, então é recusado.
select throws_ok($$ select public.pessoa_fechar_contrato('20000000-0000-0000-0000-000000000001'::uuid) $$, null, 'Pessoa não encontrada neste escritório.', 'A pessoa de outro escritório não ganha contrato');

-- Quando a pessoa do administrativo fecha o cliente sem advogado responsável, então é recusado com a explicação.
select pg_temp.entrar(2);
select throws_ok($$ select public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000003'::uuid) $$, null,
  'O contrato não nasceu: inclua um advogado entre os responsáveis por esta pessoa (no cartão dela) e mova de novo.', 'Sem advogado, o contrato não nasce');
-- Quando fecha o cliente dois, que tem a advogada como responsável, então o contrato é dela.
create temp table fechado2 as select (public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000002') ->> 'id')::uuid as id;
-- Quando fecha o cliente quatro, cujo primeiro advogado responsável está desativado, então o contrato é da advogada ativa.
create temp table fechado4 as select (public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000004') ->> 'id')::uuid as id;
reset role;
select is((select k.responsavel_id from public.contratos k where k.id = (select id from fechado2)), 'a0000000-0000-0000-0000-000000000001'::uuid, 'Quem não é advogado fecha para o advogado responsável pela pessoa');
select is((select k.responsavel_id from public.contratos k where k.id = (select id from fechado4)), 'a0000000-0000-0000-0000-000000000001'::uuid, 'O advogado desativado não fica como responsável');

-- Quando o contrato que nasceu da pessoa foi arquivado e ela volta a "Contrato fechado", então nasce outro.
update public.contratos set arquivado_em = now() where id = (select id from fechado4);
select pg_temp.entrar(1);
set local role authenticated;
select isnt((public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000004') ->> 'id')::uuid, (select id from fechado4), 'Com o contrato anterior arquivado, nasce um contrato novo');
reset role;

-- Quando a pessoa do administrativo lista as contas para escolher a do contrato, então vê o nome das ativas, só do escritório dela.
select pg_temp.entrar(2);
set local role authenticated;
select is((select array_agg(nome) from public.financeiro_contas_para_escolher()), array['PJ'], 'Qualquer um da equipe vê o nome das contas ativas do escritório');
-- Quando grava a conta de destino no contrato, então fica.
update public.contratos set conta_destino_id = 'c1000000-0000-0000-0000-000000000001' where id = (select id from fechado2);
-- Quando tenta gravar a conta de outro escritório, uma arquivada ou uma que não existe, então é recusado, com a mesma mensagem.
select throws_ok($$ update public.contratos set conta_destino_id = 'c2000000-0000-0000-0000-000000000001' where id = (select id from fechado2) $$, null,
  'Escolha uma conta ativa do escritório para o dinheiro deste contrato.', 'A conta de outro escritório é recusada');
select throws_ok($$ update public.contratos set conta_destino_id = 'c1000000-0000-0000-0000-000000000002' where id = (select id from fechado2) $$, null,
  'Escolha uma conta ativa do escritório para o dinheiro deste contrato.', 'A conta arquivada é recusada');
select throws_ok($$ update public.contratos set conta_destino_id = 'c9999999-0000-0000-0000-000000000009' where id = (select id from fechado2) $$, null,
  'Escolha uma conta ativa do escritório para o dinheiro deste contrato.', 'A conta que não existe é recusada do mesmo jeito');
reset role;
select is((select conta_destino_id from public.contratos where id = (select id from fechado2)), 'c1000000-0000-0000-0000-000000000001'::uuid, 'A conta de destino fica no contrato');
select is((select alteracoes -> 'conta_destino_id' ->> 'para' from public.contrato_historico where contrato_id = (select id from fechado2) and alteracoes ? 'conta_destino_id'), 'PJ', 'O histórico mostra o nome da conta');
-- Quando a conta é arquivada depois, então o contrato continua com ela e pode ser alterado no resto.
update public.financeiro_contas set arquivada_em = now() where id = 'c1000000-0000-0000-0000-000000000001';
select lives_ok($$ update public.contratos set observacoes = 'Depois de arquivar a conta' where id = (select id from fechado2) $$, 'Arquivar a conta não impede mexer no contrato');

-- Quando o contrato com "A definir" é assinado, então nenhuma demanda nasce.
update public.contratos set etapa_id = pg_temp.assinado() where id = (select id from fechado);
select is((select count(*) from public.demandas where contrato_id = (select id from fechado)), 0::bigint, '"A definir" não vira demanda');

-- Quando os objetos de verdade chegam depois da assinatura, então nascem as demandas, e a do modelo ganha as tarefas.
update public.contratos set objetos = array['Registro de marca', 'Oposição'] where id = (select id from fechado);
select is((select array_agg(objeto order by etapa_ordem) from public.demandas where contrato_id = (select id from fechado)), array['Registro de marca', 'Oposição'], 'Cada objeto vira uma demanda');
select is((select array_agg(t.titulo order by t.etapa_ordem) from public.tarefas t join public.demandas d on d.id = t.demanda_id where d.contrato_id = (select id from fechado) and d.objeto = 'Registro de marca'),
  array['Busca prévia', 'Depósito no INPI'], 'A demanda com modelo de mesmo nome ganha as tarefas dele');
select is((select count(*) from public.tarefas t join public.demandas d on d.id = t.demanda_id where d.contrato_id = (select id from fechado) and d.objeto = 'Oposição'), 0::bigint,
  'Sem modelo, nenhuma tarefa nasce');
-- Quando, já sem "A definir", alguém corrige o nome de um objeto, então nenhuma demanda nova nasce (como antes).
update public.contratos set objetos = array['Registro de marca', 'Oposição ao pedido'] where id = (select id from fechado);
select is((select count(*) from public.demandas where contrato_id = (select id from fechado)), 2::bigint, 'Corrigir um objeto de contrato assinado não cria demanda');

-- Dado um contrato assinado com um objeto de verdade e um "A definir".
select pg_temp.entrar(1);
set local role authenticated;
create temp table misto as select (public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000003') ->> 'id')::uuid as id;
reset role;
update public.contratos set objetos = array['A definir', 'Oposição'] where id = (select id from misto);
update public.contratos set etapa_id = pg_temp.assinado() where id = (select id from misto);
select is((select array_agg(objeto) from public.demandas where contrato_id = (select id from misto)), array['Oposição'], 'Só o objeto de verdade vira demanda');
-- Quando o "A definir" é trocado pelo objeto de verdade, então só ele vira demanda, sem repetir o outro.
update public.contratos set objetos = array['Registro de marca', 'Oposição'] where id = (select id from misto);
select is((select array_agg(objeto order by objeto) from public.demandas where contrato_id = (select id from misto)), array['Oposição', 'Registro de marca'], 'O objeto que entra no lugar do "A definir" vira demanda');

-- Dado um contrato feito à mão em que a pessoa nove é a segunda cliente, quando ela vai para "Contrato fechado", então
-- não nasce outro: vale o que ela já tem.
insert into public.contratos (escritorio_id, cliente_id, clientes, responsavel_id, objetos, categoria, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009']::uuid[],
   'a0000000-0000-0000-0000-000000000001', array['Consultoria'], 'pro_labore', 'a0000000-0000-0000-0000-000000000001');
create temp table a_mao as select id from public.contratos where objetos = array['Consultoria'] and escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1);
set local role authenticated;
create temp table fechado9 as select (r ->> 'id')::uuid as id, (r ->> 'novo')::boolean as novo from public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000009') r;
reset role;
select is((select id from fechado9), (select id from a_mao), 'A pessoa que já é cliente de um contrato feito à mão fica com ele');
select is((select novo from fechado9), false, 'O contrato feito à mão não conta como novo');

-- Dado o escritório com o módulo Contratos desligado, quando alguém fecha uma pessoa, então nada nasce.
update public.escritorios set modulos = modulos || '{"contratos": false}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1);
set local role authenticated;
select is(public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000009'), null, 'Com Contratos desligado, a pessoa não ganha contrato');
reset role;

select * from finish();
rollback;
