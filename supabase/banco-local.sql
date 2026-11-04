-- Dados inventados do banco local do "npm run dev" (#74): um escritório com todos os módulos e um login de teste. Pode rodar mais de uma vez.
-- Roda só no banco local, por app/ferramentas/banco-local.mjs. Nunca aplique na produção.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-00000000000a', 'Escritório local', 'escritorio-local',
   '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true, "compromissos": true, "financeiro": true}')
on conflict (id) do nothing;

insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em)
select 'e0000000-0000-0000-0000-00000000000a', 'mestre@local.test', 'Mestre Local', 'master', privado.resumo_codigo('banco-local'), now()
where not exists (select 1 from auth.users where email = 'mestre@local.test')
  and not exists (select 1 from public.convites where email = 'mestre@local.test');

-- O login lê estes campos de texto como vazios, não como nulos. O gatilho ao_cadastrar_usuario cria o perfil a partir do convite.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'mestre@local.test',
       extensions.crypt('senha-local-de-teste', extensions.gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"convite": "banco-local"}', now(), now(), '', '', '', ''
where not exists (select 1 from auth.users where email = 'mestre@local.test');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a',
       '{"sub": "a0000000-0000-0000-0000-00000000000a", "email": "mestre@local.test", "email_verified": true}', 'email', now(), now(), now()
where not exists (select 1 from auth.identities where user_id = 'a0000000-0000-0000-0000-00000000000a');
