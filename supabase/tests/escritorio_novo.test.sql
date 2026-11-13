-- Escritório novo pronto para usar (#295). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- Dado um escritório que já existe, com um cliente e uma conta, e as colunas que ele tem hoje.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000001', 'Escritório Antigo', 'antigo');
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'ANT-1', 'pf', 'CLIENTE DO ESCRITORIO ANTIGO');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ja-tem-conta@exemplo.test', 'Já Tem Conta', 'master', privado.resumo_codigo('c-antigo'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'convidado@exemplo.test', 'Convidado Pendente', 'usuario', privado.resumo_codigo('c-pendente'), now());
insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, recovery_token, email_change, email_change_token_new, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ja-tem-conta@exemplo.test', '', '{"convite":"c-antigo"}', '', '', '', now(), now());
create temporary table colunas_antes as
  select id, modulo, nome, ordem, marco from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001';

create function pg_temp.colunas(p_escritorio uuid, p_modulo text) returns bigint language sql as $$
  select count(*) from public.quadro_colunas where escritorio_id = p_escritorio and modulo = p_modulo
$$;
create function pg_temp.marco(p_escritorio uuid, p_modulo text, p_marco text) returns text language sql as $$
  select nome from public.quadro_colunas where escritorio_id = p_escritorio and modulo = p_modulo and marco = p_marco
$$;
create function pg_temp.ordem(p_escritorio uuid, p_modulo text, p_marco text) returns numeric language sql as $$
  select ordem from public.quadro_colunas where escritorio_id = p_escritorio and modulo = p_modulo and marco = p_marco
$$;

-- Quando a pessoa cria o escritório novo no SQL Editor,
create temporary table criado as
  select privado.criar_escritorio('  Advocacia  São   João  ', 'Ana   Maria Souza', '  Ana@Exemplo.TEST ') as link;
create temporary table novo as
  select e.* from public.escritorios e where e.nome = 'Advocacia São João';

-- então ela recebe o link de primeiro acesso, e o escritório existe com o nome arrumado e o endereço curto.
select ok((select link like 'https://semper.app.br/entrar/?primeiro-acesso#convite=%' from criado),
  'Quando o escritório é criado, então a função devolve o link de primeiro acesso');
select is((select count(*) from novo), 1::bigint, 'Então o escritório existe, com os espaços do nome arrumados');
select is((select slug from novo), 'advocacia-sao-joao', 'Então o endereço curto é o nome sem acentos, com hífens');

-- Então o convite do administrador é de master, no escritório novo, pendente e com o link de agora.
select is((select papel from public.convites where email = 'ana@exemplo.test'), 'master', 'Então o convite é de master');
select is((select escritorio_id from public.convites where email = 'ana@exemplo.test'), (select id from novo),
  'Então o convite é do escritório novo');
select is((select nome from public.convites where email = 'ana@exemplo.test'), 'ANA MARIA SOUZA', 'Então o convite leva o nome arrumado');
select ok((select codigo_hash = privado.resumo_codigo(split_part(link, '#convite=', 2)) from public.convites, criado where email = 'ana@exemplo.test'),
  'Então o código do link é o do convite');
select ok((select link_criado_em > now() - interval '1 minute' from public.convites where email = 'ana@exemplo.test'),
  'Então o link conta os 7 dias a partir de agora');
select is((select count(*) from public.auditoria where tabela = 'escritorios' and registro_id = (select id::text from novo) and acao = 'inclusao'),
  1::bigint, 'Então a criação fica no registro de ações');

-- Então os módulos são os do padrão: Financeiro desligado.
select ok((select coalesce((modulos ->> 'financeiro')::boolean, false) = false from novo), 'Então o Financeiro vem desligado');
select ok((select (modulos ->> 'pessoas')::boolean and (modulos ->> 'contratos')::boolean and (modulos ->> 'demandas')::boolean
                  and (modulos ->> 'tarefas')::boolean and (modulos ->> 'processos')::boolean and (modulos ->> 'compromissos')::boolean from novo),
  'Então Pessoas, Contratos, Demandas, Tarefas, Processos e Agenda vêm ligados');

-- Então todos os quadros vêm prontos, com as colunas-marco.
select is(pg_temp.colunas((select id from novo), 'pessoas'), (select count(*) + 2 from public.quadro_sugestoes where modulo = 'pessoas'),
  'Então Pessoas tem as colunas sugeridas, "Em negociação" e "Contrato fechado"');
select is(pg_temp.marco((select id from novo), 'pessoas', 'contrato_fechado'), 'Contrato fechado', 'Então Pessoas tem a coluna do contrato fechado');
select is(pg_temp.colunas((select id from novo), 'contratos'), (select count(*) from public.quadro_sugestoes where modulo = 'contratos'),
  'Então Contratos tem as colunas sugeridas, sem repetir "Aguardando assinatura"');
select is(pg_temp.marco((select id from novo), 'contratos', 'assinado'), 'Assinado / em andamento', 'Então Contratos tem a coluna do assinado');
select is(pg_temp.marco((select id from novo), 'contratos', 'aguardando_assinatura'), 'Aguardando assinatura',
  'Então Contratos tem a coluna de aguardando assinatura');
select ok(pg_temp.ordem((select id from novo), 'contratos', 'aguardando_assinatura') < pg_temp.ordem((select id from novo), 'contratos', 'assinado'),
  'Então "Aguardando assinatura" vem antes do assinado');
select is(pg_temp.marco((select id from novo), 'demandas', 'inicio'), 'Para fazer', 'Então Demandas tem a coluna de início');
select is(pg_temp.marco((select id from novo), 'demandas', 'concluido'), 'Concluído', 'Então Demandas tem a coluna de concluído');
select is(pg_temp.marco((select id from novo), 'tarefas', 'inicio'), 'Para fazer', 'Então Tarefas tem a coluna de início');
select is(pg_temp.marco((select id from novo), 'tarefas', 'concluido'), 'Concluída', 'Então Tarefas tem a coluna de concluído');
select ok(pg_temp.marco((select id from novo), 'processos_judiciais', 'concluido') is not null
          and pg_temp.marco((select id from novo), 'processos_administrativos', 'concluido') is not null,
  'Então os dois quadros de Processos vêm prontos');
select is(pg_temp.marco((select id from novo), 'compromissos', 'concluido'), 'Realizado', 'Então o quadro da Agenda vem pronto');

-- Então o escritório que já existia não mudou.
select is((select count(*) from public.quadro_colunas c where c.escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
          (select count(*) from colunas_antes), 'Então o escritório antigo tem as mesmas colunas');
select lives_ok($$ select privado.preparar_quadros_do_escritorio('e0000000-0000-0000-0000-000000000001') $$,
  'Quando o preparo roda de novo num escritório que já tem quadros, então não dá erro');
select is((select count(*) from (select id, modulo, nome, ordem, marco from public.quadro_colunas
            where escritorio_id = 'e0000000-0000-0000-0000-000000000001' except select * from colunas_antes) x), 0::bigint,
  'Então nenhuma coluna dele muda nem é acrescentada');

-- Quando o administrador abre o link e cria a senha, então entra como master do escritório novo.
insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, recovery_token, email_change, email_change_token_new, created_at, updated_at)
select 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ana@exemplo.test', '',
       jsonb_build_object('convite', split_part(link, '#convite=', 2)), '', '', '', now(), now() from criado;
select is((select papel from public.perfis where id = 'a0000000-0000-0000-0000-000000000002'), 'master', 'Então o administrador entra como master');
select is((select escritorio_id from public.perfis where id = 'a0000000-0000-0000-0000-000000000002'), (select id from novo),
  'Então ele fica no escritório novo');

-- E, como ele, não vê nada do outro escritório.
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', now(), now());
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000002', 'role', 'authenticated',
  'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000a')::text, true);
grant select on novo, criado to authenticated;
set local role authenticated;
select is((select count(*) from public.pessoas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0::bigint,
  'Então o administrador novo não vê os clientes do outro escritório');
select ok((select count(*) from public.quadro_colunas where modulo = 'tarefas') > 0
          and not exists (select 1 from public.quadro_colunas where escritorio_id <> (select id from novo)),
  'Então ele vê só os quadros do escritório dele');

-- Quando alguém do site tenta criar um escritório, então não consegue: a função fica fora do alcance do site.
select throws_ok($$ select privado.criar_escritorio('Escritório Pirata', 'Fulano', 'fulano@exemplo.test') $$, '42501', null,
  'Quando um usuário tenta criar um escritório pelo site, então não tem permissão');
select throws_ok($$ select privado.escritorio_novo_link('ana@exemplo.test') $$, '42501', null,
  'Quando um usuário tenta gerar o link de primeiro acesso pelo site, então não tem permissão');
reset role;

-- Quando o e-mail já tem conta, ou já tem convite pendente, então nada é criado e aparece o motivo.
select throws_ok($$ select privado.criar_escritorio('Outro Escritório', 'Fulano', 'JA-TEM-CONTA@exemplo.test') $$, null,
  'SEMPER: este e-mail já tem conta no SEMPER. Use outro e-mail para o administrador.',
  'Quando o e-mail já tem conta, então a criação é recusada');
select throws_ok($$ select privado.criar_escritorio('Outro Escritório', 'Fulano', 'convidado@exemplo.test') $$, null,
  'SEMPER: este e-mail já tem um convite pendente. Use outro e-mail ou apague o convite antes.',
  'Quando o e-mail tem convite pendente, então a criação é recusada');
select is((select count(*) from public.escritorios where nome = 'Outro Escritório'), 0::bigint, 'Então nenhum escritório é criado');

-- Quando o link venceu, então a pessoa gera outro, e o anterior deixa de valer.
create temporary table link_velho as select privado.criar_escritorio('Silva & Souza', 'Bia Silva', 'bia@exemplo.test') as link;
create temporary table link_novo as select privado.escritorio_novo_link('BIA@exemplo.test') as link;
select ok((select n.link <> v.link and n.link like 'https://semper.app.br/entrar/?primeiro-acesso#convite=%'
                  and c.codigo_hash = privado.resumo_codigo(split_part(n.link, '#convite=', 2))
           from link_novo n, link_velho v, public.convites c where c.email = 'bia@exemplo.test'),
  'Quando a pessoa pede um link novo, então o novo vale e o anterior não');

-- Quando dois nomes dão o mesmo endereço curto, então o segundo ganha um número.
select lives_ok($$ select privado.criar_escritorio('Silva Souza', 'Caio Souza', 'caio@exemplo.test') $$,
  'Quando o nome é parecido com o de outro escritório, então ele é criado');
select is((select slug from public.escritorios where nome = 'Silva Souza'), 'silva-souza-2', 'Então o endereço curto ganha um número');

-- Quando o nome já existe (mesmo sem acento), ou falta, então a criação é recusada.
select throws_ok($$ select privado.criar_escritorio('advocacia sao joao', 'Fulano', 'fulano@exemplo.test') $$, null,
  'SEMPER: já existe um escritório com o nome "advocacia sao joao"', 'Quando o nome já existe, então a criação é recusada');
select throws_ok($$ select privado.criar_escritorio('   ', 'Fulano', 'fulano@exemplo.test') $$, null,
  'SEMPER: falta o nome do escritório', 'Quando falta o nome, então a criação é recusada');
select throws_ok($$ select privado.criar_escritorio('Escritório X', 'Fulano', 'sem-arroba') $$, null,
  'SEMPER: e-mail inválido: sem-arroba', 'Quando o e-mail é inválido, então a criação é recusada');
select throws_ok($$ select privado.criar_escritorio('Escritório Y', 'J.', 'jota@exemplo.test') $$, null,
  'SEMPER: o nome de quem vai administrar precisa ter pelo menos duas letras',
  'Quando o nome do administrador tem uma letra só (o primeiro acesso falharia), então a criação é recusada');

-- Quando o e-mail do administrador saiu errado, então a pessoa o corrige e gera o link para o e-mail certo.
create temporary table link_corrigido as select privado.escritorio_novo_link('bia@exemplo.test', ' Bia.Certa@exemplo.TEST ') as link;
select ok((select c.codigo_hash = privado.resumo_codigo(split_part(l.link, '#convite=', 2)) and c.papel = 'master'
           from link_corrigido l, public.convites c where c.email = 'bia.certa@exemplo.test' and c.usado_em is null),
  'Quando o e-mail é corrigido, então o convite passa para o e-mail certo, com um link novo');
select is((select count(*) from public.convites where email = 'bia@exemplo.test'), 0::bigint, 'Então o e-mail errado não tem mais convite');
select throws_ok($$ select privado.escritorio_novo_link('caio@exemplo.test', 'ja-tem-conta@exemplo.test') $$, null,
  'SEMPER: este e-mail já tem conta no SEMPER. Use outro e-mail para o administrador.',
  'Quando o e-mail corrigido já tem conta, então a correção é recusada');

-- Quando o convite de master é de um escritório em uso (feito pela tela Equipe e acessos), ou o escritório já tem equipe,
-- então o link novo é recusado: o link que o escritório mandou continua valendo.
insert into public.convites (escritorio_id, email, nome, papel, criado_por, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'socio@exemplo.test', 'Sócio', 'master', 'a0000000-0000-0000-0000-000000000001',
   privado.resumo_codigo('c-socio'), now());
select throws_ok($$ select privado.escritorio_novo_link('socio@exemplo.test') $$, null,
  'SEMPER: não há convite pendente do primeiro administrador de um escritório novo para este e-mail',
  'Quando o convite de master é de um escritório em uso, então não sai link novo');
select is((select codigo_hash from public.convites where email = 'socio@exemplo.test'), privado.resumo_codigo('c-socio'),
  'Então o link que o escritório mandou continua valendo');
update public.convites set criado_por = null where email = 'socio@exemplo.test';
select throws_ok($$ select privado.escritorio_novo_link('socio@exemplo.test') $$, null,
  'SEMPER: não há convite pendente do primeiro administrador de um escritório novo para este e-mail',
  'Quando o escritório já tem alguém na equipe, então não sai link novo');

select * from finish();
rollback;
