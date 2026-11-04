-- Dados inventados para o teste de restauração (testar-restauracao.sh): dois escritórios, pessoas, sessões e registros de ações.
-- A palavra MARCA-FICTICIA serve para conferir que ela não aparece legível no arquivo criptografado.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório MARCA-FICTICIA', 'copia-um'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'copia-dois');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre Teste', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'estranha@exemplo.test', 'Estranha Teste', 'master', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', extensions.crypt('senha-ficticia', extensions.gen_salt('bf')), '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'estranha@exemplo.test', extensions.crypt('senha-ficticia', extensions.gen_salt('bf')), '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now());
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, emails, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'COPIA001', 'contato', 'PESSOA MARCA-FICTICIA', array['pessoa@exemplo.test'], 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'COPIA002', 'contato', 'PESSOA DO OUTRO', array['outra@exemplo.test'], 'a0000000-0000-0000-0000-000000000002');
insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por) values
  ('e0000000-0000-0000-0000-000000000001', 'pessoas', '10000000-0000-0000-0000-000000000001', 'alteracao', '{"nome":"MARCA-FICTICIA"}', 'a0000000-0000-0000-0000-000000000001');
