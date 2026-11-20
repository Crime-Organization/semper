-- A primeira sincronização com o Google Contatos (#164, etapa 2): a espera da fila, as ligações certas, a lista
-- "Para conferir" e as decisões do administrador.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Beto (usuário), e outro com Fabio (master); o primeiro com a conta Google ligada,
-- ainda sem a sincronização dos contatos.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-primeira-google'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-primeira-google-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 3) n;
insert into privado.ligacoes (escritorio_id, provedor, conta_email, segredo_id)
values ('e0000000-0000-0000-0000-000000000001', 'google', 'contato@exemplo.test', vault.create_secret('token-1', 'teste-primeira-1'));

-- As pessoas: Maria (vai ser ligada), José (vai ficar em dúvida), Rita (sem contato no Google) e Lia, arquivada.
-- E uma pessoa do outro escritório.
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, telefones, arquivado_em) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'pf', 'MARIA TESTE', '{38999990000}', null),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'JOSE TESTE', '{}', null),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'pf', 'RITA TESTE', '{}', null),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'pf', 'LIA ARQUIVADA', '{}', now()),
  ('20000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'P1', 'pf', 'JOSE DE FORA', '{}', null);

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.na_fila(p_pessoa uuid) returns boolean language sql as $$
  select exists (select 1 from public.contatos_google_fila where pessoa_id = p_pessoa)
$$;
create function pg_temp.ligacao() returns privado.ligacoes language sql as $$
  select * from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001'
$$;

-- ---------------------------------------------------------------------
-- Ligar a sincronização: a primeira fica por fazer, e a fila espera
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select public.sincronizacao_google_ligar(true);
select is((select primeira_em from public.primeira_sincronizacao_google()), null,
  'dado Ana, quando liga a sincronização, então a primeira sincronização fica por fazer');
reset role;
select ok(public.contatos_google_primeira_por_fazer('e0000000-0000-0000-0000-000000000001'),
  'e a função do servidor sabe que ela falta (o "Sincronizar agora" avisa em vez de dizer que está tudo em dia)');
select ok(not public.contatos_google_primeira_por_fazer('e0000000-0000-0000-0000-000000000002'), 'e o escritório sem conta ligada não tem primeira por fazer');

update public.pessoas set nome = 'RITA TESTE SOUZA' where id = '10000000-0000-0000-0000-000000000003';
select ok(pg_temp.na_fila('10000000-0000-0000-0000-000000000003'), 'quando uma pessoa é editada antes da primeira, então ela entra na fila');
select is((select count(*)::int from public.contatos_google_pendentes(null, 10)), 0,
  'mas a fila não anda enquanto a primeira sincronização não termina (nada é criado no Google)');

create temp table primeiras as select * from public.contatos_google_primeiras(null);
select is((select count(*)::int from primeiras), 1, 'quando a função do servidor pede as primeiras por fazer, então vem o escritório');
select is((select conta_email || '|' || tentativas from primeiras), 'contato@exemplo.test|1', 'com a conta ligada e a tentativa já contada');
select is((select count(*)::int from public.contatos_google_primeiras(null)), 0,
  'quando outra execução pede logo depois, então não recebe o mesmo escritório (está reservado)');

-- (As pessoas de Ana e Beto, criadas com a conta de cada um, também são do escritório.)
create temp table do_escritorio as select id, arquivado_em from public.pessoas where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is(jsonb_array_length(public.contatos_google_pessoas('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test')), (select count(*)::int from do_escritorio),
  'quando a função pede as pessoas do escritório, então vêm todas, também a arquivada, e nenhuma do outro escritório');

-- ---------------------------------------------------------------------
-- Concluir: as ligações, as dúvidas e a fila de quem ficou sem contato
-- ---------------------------------------------------------------------
create temp table concluida as select * from public.contatos_google_primeira_concluir('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test',
  '[{"pessoa_id": "10000000-0000-0000-0000-000000000001", "recurso": "people/c1", "etag": "e1"}]'::jsonb,
  '[{"recurso": "people/c2", "etag": "e2", "nome": "José Teste", "telefones": ["+55 38 3222-1111"], "emails": [], "aniversario": null,
     "motivo": "so-nome", "candidatos": ["10000000-0000-0000-0000-000000000002", "20000000-0000-0000-0000-000000000001"]},
    {"recurso": "people/c3", "etag": "e3", "nome": "Ninguém", "telefones": [], "emails": [], "aniversario": null,
     "motivo": "conflito", "candidatos": ["20000000-0000-0000-0000-000000000001"]}]'::jsonb);
select is((select ligados || '|' || para_conferir || '|' || novos from concluida),
  '1|1|' || (select count(*) from do_escritorio where arquivado_em is null and id not in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')),
  'quando a primeira termina, então conta 1 contato ligado, 1 dúvida aberta e as pessoas ativas sem contato (Rita, Ana e Beto) para a fila');
select is((select recurso from public.contatos_google where pessoa_id = '10000000-0000-0000-0000-000000000001'), 'people/c1',
  'e Maria fica ligada ao contato que já estava no Google (sem cópia)');
select is((select candidatos from public.contatos_google_conferir where recurso = 'people/c2'), array['10000000-0000-0000-0000-000000000002']::uuid[],
  'e a dúvida guarda só as pessoas possíveis do próprio escritório');
select is((select count(*)::int from public.contatos_google_conferir where recurso = 'people/c3'), 0,
  'e uma dúvida sem nenhuma pessoa do escritório é descartada');
select ok(not pg_temp.na_fila('10000000-0000-0000-0000-000000000001'), 'e Maria, já ligada, não vai para a fila');
select ok(not pg_temp.na_fila('10000000-0000-0000-0000-000000000002'), 'e José, em dúvida, não vai para a fila');
select ok(pg_temp.na_fila('10000000-0000-0000-0000-000000000003'), 'e Rita, sem contato, continua na fila para ganhar um contato novo');
select ok(not pg_temp.na_fila('10000000-0000-0000-0000-000000000004'), 'e a pessoa arquivada não vai para a fila');
select isnt((pg_temp.ligacao()).contatos_primeira_em, null, 'e a primeira sincronização fica marcada como feita');
select ok(not public.contatos_google_primeira_por_fazer('e0000000-0000-0000-0000-000000000001'), 'e não falta mais');
select is((select count(*)::int from public.auditoria where tabela = 'ligacoes' and resumo ? 'primeira_sincronizacao'), 1, 'e fica no registro de ações');

select is((select ligados || '|' || para_conferir || '|' || novos from public.contatos_google_primeira_concluir('e0000000-0000-0000-0000-000000000001',
  'contato@exemplo.test', '[]'::jsonb, '[]'::jsonb)), '0|0|0', 'quando a mesma primeira é concluída de novo, então nada muda');

create temp table pegos as select pessoa_id from public.contatos_google_pendentes(null, 10);
select ok(exists (select 1 from pegos where pessoa_id = '10000000-0000-0000-0000-000000000003') and not exists (select 1 from pegos where pessoa_id = '10000000-0000-0000-0000-000000000002'),
  'quando a fila anda, então Rita vai ao Google, e José espera a decisão');

update public.pessoas set nome = 'JOSE TESTE EDITADO' where id = '10000000-0000-0000-0000-000000000002';
select ok(pg_temp.na_fila('10000000-0000-0000-0000-000000000002'), 'dado José em dúvida, quando é editado, então entra na fila');
select is((select count(*)::int from public.contatos_google_pendentes(null, 10) where pessoa_id = '10000000-0000-0000-0000-000000000002'), 0,
  'mas não vai ao Google enquanto a dúvida está aberta');

-- ---------------------------------------------------------------------
-- O que cada um vê e decide pelo navegador
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select is((select para_conferir from public.primeira_sincronizacao_google()), 1, 'dado Ana, quando pede a situação, então vê 1 contato para conferir');
select is(jsonb_array_length(public.contatos_google_para_conferir()), 1, 'e a lista traz o contato');
select is(public.contatos_google_para_conferir() -> 0 ->> 'nome', 'José Teste', 'com o nome que está no Google');
select is(public.contatos_google_para_conferir() -> 0 -> 'candidatos' -> 0 ->> 'nome', 'JOSE TESTE EDITADO', 'e a pessoa possível, com o nome do SEMPER');
select throws_ok($$insert into public.contatos_google_conferir (escritorio_id, conta_email, recurso, motivo) values ('e0000000-0000-0000-0000-000000000001', 'x@exemplo.test', 'people/x', 'varios')$$,
  '42501', null, 'quando alguém tenta gravar na lista pelo navegador, então o banco recusa');
select throws_ok($$select public.contatos_google_primeira_concluir(null, null, null, null)$$, '42501', null,
  'quando alguém logado tenta concluir a primeira pelo navegador, então o banco recusa');
reset role;

select pg_temp.entrar(2); set local role authenticated;
select is(jsonb_array_length(public.contatos_google_para_conferir()), 0, 'dado Beto (não administrador), quando pede a lista, então vem vazia');
select is((select count(*)::int from public.contatos_google_conferir), 0, 'e ele não lê a tabela');
select throws_ok(format($$select public.contatos_google_conferir_decidir(%L, 'ignorar', null)$$, (select id from public.contatos_google_conferir limit 1)),
  'P0001', 'Apenas administradores decidem os contatos para conferir', 'e não decide');
reset role;

select pg_temp.entrar(3); set local role authenticated;
select is(jsonb_array_length(public.contatos_google_para_conferir()), 0, 'dado Fabio, de outro escritório, quando pede a lista, então não vê a do primeiro');
reset role;

-- Decidir: ligar.
create temp table duvida as select id from public.contatos_google_conferir where recurso = 'people/c2';
grant select on duvida to authenticated;
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$select public.contatos_google_conferir_decidir((select id from duvida), 'ligar', '10000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Esta pessoa já está ligada a outro contato do Google', 'quando Ana tenta ligar o contato a Maria, que já tem um, então o banco recusa');
select throws_ok($$select public.contatos_google_conferir_decidir((select id from duvida), 'ligar', '20000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Escolha uma pessoa do escritório', 'quando tenta ligar a uma pessoa de outro escritório, então o banco recusa');
select lives_ok($$select public.contatos_google_conferir_decidir((select id from duvida), 'ligar', '10000000-0000-0000-0000-000000000002')$$,
  'quando Ana liga o contato a José, então dá certo');
select is(jsonb_array_length(public.contatos_google_para_conferir()), 0, 'e o contato sai da lista');
select throws_ok($$select public.contatos_google_conferir_decidir((select id from duvida), 'ignorar', null)$$,
  'P0001', 'Este contato já foi conferido', 'e não pode ser decidido de novo');
reset role;
select is((select recurso from public.contatos_google where pessoa_id = '10000000-0000-0000-0000-000000000002'), 'people/c2', 'e José fica ligado ao contato');
select is((select recurso from public.contatos_google_pendentes(null, 10) where pessoa_id = '10000000-0000-0000-0000-000000000002'), 'people/c2',
  'e a edição dele, que esperava, vai ao Google atualizando esse contato (não criando outro)');

-- Decidir: é outra pessoa, e ignorar.
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'pf', 'ANA HOMONIMA'),
  ('10000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'P6', 'pf', 'BIA HOMONIMA'),
  ('10000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'P7', 'pf', 'CAIO IRMAO'),
  ('10000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'P8', 'pf', 'DIEGO IRMAO');
delete from public.contatos_google_fila where pessoa_id in ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000008');
insert into public.contatos_google_conferir (escritorio_id, conta_email, recurso, nome, motivo, candidatos) values
  ('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'people/c5', 'Ana', 'so-nome', '{10000000-0000-0000-0000-000000000005}'),
  ('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'people/c6', 'Bia', 'so-nome', '{10000000-0000-0000-0000-000000000006}'),
  ('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'people/c7', 'Irmãos', 'varios', '{10000000-0000-0000-0000-000000000007,10000000-0000-0000-0000-000000000008}');
select pg_temp.entrar(1); set local role authenticated;
select public.contatos_google_conferir_decidir((select k.id from public.contatos_google_conferir k where k.recurso = 'people/c5'), 'outra', null);
select public.contatos_google_conferir_decidir((select k.id from public.contatos_google_conferir k where k.recurso = 'people/c6'), 'ignorar', null);
select public.contatos_google_conferir_decidir((select k.id from public.contatos_google_conferir k where k.recurso = 'people/c7'), 'ligar', '10000000-0000-0000-0000-000000000007');
reset role;
select ok(not pg_temp.na_fila('10000000-0000-0000-0000-000000000007') and pg_temp.na_fila('10000000-0000-0000-0000-000000000008'),
  'quando Ana liga um contato com várias pessoas possíveis a uma delas, então as outras vão para a fila e ganham um contato novo');
select ok(pg_temp.na_fila('10000000-0000-0000-0000-000000000005'), 'quando Ana marca "é outra pessoa", então a pessoa vai para a fila e ganha um contato novo');
select ok(not pg_temp.na_fila('10000000-0000-0000-0000-000000000006'), 'quando Ana ignora, então nada vai ao Google');
select is((select string_agg(decisao, ',' order by recurso) from public.contatos_google_conferir where recurso in ('people/c5', 'people/c6')), 'outra,ignorada',
  'e as decisões ficam guardadas');

-- Uma primeira sincronização nova não traz de volta o que já foi decidido.
update privado.ligacoes set contatos_primeira_em = null where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is((select para_conferir from public.contatos_google_primeira_concluir('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', '[]'::jsonb,
  '[{"recurso": "people/c6", "nome": "Bia", "motivo": "so-nome", "candidatos": ["10000000-0000-0000-0000-000000000006"]}]'::jsonb)), 0,
  'dado um contato já ignorado, quando a primeira sincronização é refeita, então ele não volta para conferir');

-- Um contato repetido no Google: a pessoa possível já tem contato nesta conta.
insert into public.contatos_google_conferir (escritorio_id, conta_email, recurso, nome, motivo, candidatos) values
  ('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'people/c1b', 'Maria Teste', 'repetido', '{10000000-0000-0000-0000-000000000001}'),
  ('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'people/c3b', 'Rita', 'so-nome', '{10000000-0000-0000-0000-000000000003}');
select pg_temp.entrar(1); set local role authenticated;
select is((select string_agg((x -> 'candidatos' -> 0 ->> 'nome') || '=' || (x -> 'candidatos' -> 0 ->> 'ligada'), ',' order by x ->> 'nome')
           from jsonb_array_elements(public.contatos_google_para_conferir()) x),
  'MARIA TESTE=true,RITA TESTE SOUZA=false',
  'dado um contato repetido de Maria, quando Ana pede a lista, então Maria vem como já ligada (a tela não oferece "Ligar"), e Rita, sem contato, não');
select public.contatos_google_conferir_decidir((select k.id from public.contatos_google_conferir k where k.recurso = 'people/c1b'), 'ignorar', null);
reset role;
update privado.ligacoes set contatos_primeira_em = null where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is((select para_conferir from public.contatos_google_primeira_concluir('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test',
  '[{"pessoa_id": "10000000-0000-0000-0000-000000000003", "recurso": "people/c3b", "etag": "e3b"}]'::jsonb, '[]'::jsonb)), 0,
  'dada a dúvida aberta de Rita, quando a primeira refeita liga o contato dela, então a dúvida sai da lista');
select is((select count(*)::int from public.contatos_google_conferir where recurso = 'people/c3b'), 0, 'e não fica guardada aberta');
select is((select recurso from public.contatos_google where pessoa_id = '10000000-0000-0000-0000-000000000003'), 'people/c3b', 'e Rita fica ligada ao contato');

-- ---------------------------------------------------------------------
-- Falhas, religar, trocar de conta e desligar
-- ---------------------------------------------------------------------
update privado.ligacoes set contatos_primeira_em = null, contatos_primeira_tentativas = 3 where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select public.contatos_google_primeira_falhou('e0000000-0000-0000-0000-000000000001', 'temporario', 'Google respondeu 503', 60);
select ok((select contatos_primeira_proxima_em > now() and contatos_primeira_reservada_ate is null and contatos_primeira_detalhe = 'Google respondeu 503' from pg_temp.ligacao()),
  'quando a primeira falha com o Google fora, então ela espera a próxima tentativa');
select pg_temp.entrar(1); set local role authenticated;
select is((select problema from public.primeira_sincronizacao_google()), 'google-fora', 'e, a partir da 3ª tentativa, Ana vê o problema');
reset role;
select public.contatos_google_primeira_falhou('e0000000-0000-0000-0000-000000000001', 'interno', 'erro: O banco recusou', 60);
select pg_temp.entrar(1); set local role authenticated;
select is((select problema from public.primeira_sincronizacao_google()), 'primeira-recusada',
  'quando a primeira falha 3 vezes por um erro do próprio SEMPER, então Ana vê que ela não consegue terminar (não que o Google está fora)');
reset role;
update privado.ligacoes set contatos_primeira_tentativas = 1 where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1); set local role authenticated;
select is((select problema from public.primeira_sincronizacao_google()), null, 'mas na 1ª falha interna ainda não vê problema nenhum');
reset role;
select public.contatos_google_primeira_falhou('e0000000-0000-0000-0000-000000000001', 'recusado', 'mais de 100000 contatos na conta', 60);
select pg_temp.entrar(1); set local role authenticated;
select is((select problema from public.primeira_sincronizacao_google()), 'primeira-recusada',
  'quando o Google recusa a leitura (não passa sozinho), então Ana vê o problema já na 1ª vez');
reset role;
update privado.ligacoes set contatos_primeira_tentativas = 3 where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select public.contatos_google_primeira_falhou('e0000000-0000-0000-0000-000000000001', 'temporario', 'Google respondeu 503', 60);
select is((select count(*)::int from public.contatos_google_primeiras(null)), 0, 'e ela não é pega antes da espera');
select is(public.contatos_google_agora('a0000000-0000-0000-0000-000000000001', 'aal1'), 'e0000000-0000-0000-0000-000000000001'::uuid,
  'quando Ana pede "Sincronizar agora"');
select is((select count(*)::int from public.contatos_google_primeiras(null)), 1, 'então a primeira é tentada já');
select public.contatos_google_primeira_falhou('e0000000-0000-0000-0000-000000000001', 'autorizacao', 'invalid_grant', 60);
select is((pg_temp.ligacao()).contatos_problema, 'autorizacao', 'quando a primeira falha por autorização, então a ligação marca o problema');

update privado.ligacoes set contatos_primeira_em = now() where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1); set local role authenticated;
select public.sincronizacao_google_ligar(false);
select public.sincronizacao_google_ligar(true);
reset role;
select is((pg_temp.ligacao()).contatos_primeira_em, null, 'quando Ana desliga e liga de novo a sincronização, então a primeira é refeita');

insert into public.contatos_google_conferir (escritorio_id, conta_email, recurso, motivo, candidatos)
values ('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'people/c8', 'so-nome', '{10000000-0000-0000-0000-000000000006}');
create temp table decididas as select recurso from public.contatos_google_conferir where conta_email = 'contato@exemplo.test' and decisao is not null;
update privado.ligacoes set conta_email = 'outra@exemplo.test', contatos_primeira_em = now() where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is((pg_temp.ligacao()).contatos_primeira_em, null, 'quando a conta Google muda, então a primeira é refeita na conta nova');
select is((select count(*)::int from public.contatos_google_conferir where conta_email = 'contato@exemplo.test' and decisao is null), 0,
  'e as dúvidas abertas da conta antiga somem');
select is((select count(*)::int from public.contatos_google_conferir where conta_email = 'contato@exemplo.test'), (select count(*)::int from decididas),
  'e as decididas ficam (voltando a essa conta, o que já foi decidido não volta para a lista)');

insert into public.contatos_google_conferir (escritorio_id, conta_email, recurso, motivo, candidatos, decisao)
values ('e0000000-0000-0000-0000-000000000001', 'outra@exemplo.test', 'people/c9', 'so-nome', '{10000000-0000-0000-0000-000000000003}', null),
       ('e0000000-0000-0000-0000-000000000001', 'outra@exemplo.test', 'people/c10', 'so-nome', '{10000000-0000-0000-0000-000000000006}', 'ignorada');
delete from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.contatos_google_conferir where conta_email = 'outra@exemplo.test' and decisao is null), 0,
  'quando a conta é desligada, então as dúvidas abertas dela somem');
select is((select count(*)::int from public.contatos_google_conferir where conta_email = 'outra@exemplo.test' and decisao = 'ignorada'), 1,
  'e as decididas ficam, para não voltarem se a mesma conta for ligada de novo');

-- Ligar a mesma conta de novo: a primeira refeita não traz de volta o contato já ignorado.
insert into privado.ligacoes (escritorio_id, provedor, conta_email, segredo_id, contatos_ativos)
values ('e0000000-0000-0000-0000-000000000001', 'google', 'outra@exemplo.test', vault.create_secret('token-2', 'teste-primeira-2'), true);
select is((select para_conferir from public.contatos_google_primeira_concluir('e0000000-0000-0000-0000-000000000001', 'outra@exemplo.test', '[]'::jsonb,
  '[{"recurso": "people/c10", "nome": "Bia", "motivo": "so-nome", "candidatos": ["10000000-0000-0000-0000-000000000006"]}]'::jsonb)), 0,
  'quando a mesma conta é ligada de novo e a primeira é refeita, então o contato já ignorado não volta para conferir');

select * from finish();
rollback;
