-- =====================================================================
-- Foto do perfil (tarefa #141)
--   Cada usuário envia uma foto e ajusta o corte redondo; o navegador grava
--   dois arquivos AVIF redondos, de fundo transparente:
--     <escritório>/<usuário>/1000.avif  a foto da página do advogado no site;
--     <escritório>/<usuário>/150.avif   o ícone do usuário nas bolinhas do sistema.
--   - A pasta "fotos-da-equipe" é privada: só a equipe do escritório vê as
--     fotos dele (por links que valem por pouco tempo).
--   - Grava (e apaga) a própria foto, ou a de alguém do escritório se for
--     administrador. Ninguém de outro escritório lê nem grava.
--   - perfil_profissional.foto_em diz quando a foto foi trocada (vazio: sem foto).
--   Só acrescenta (uma coluna, a pasta e as regras dela). A versão anterior
--   do site continua funcionando (ela não usa fotos).
-- =====================================================================

alter table public.perfil_profissional add column foto_em timestamptz;
grant update (foto_em) on public.perfil_profissional to authenticated;

-- A pasta: só AVIF, até 2 MB por arquivo (FOTO_MAXIMA em app/src/dados/limites.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-da-equipe', 'fotos-da-equipe', false, 2097152, array['image/avif'])
on conflict (id) do nothing;

-- O arquivo é de alguém da equipe do escritório de quem grava: <escritório>/<usuário>/<arquivo>.
create function privado.foto_da_minha_equipe(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_nome))[1] = privado.meu_escritorio()::text
    and exists (select 1 from public.perfis p
                where p.id::text = (storage.foldername(p_nome))[2] and p.escritorio_id = privado.meu_escritorio())
$$;
-- E quem grava é o dono da foto ou um administrador.
create function privado.posso_mexer_na_foto(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.foto_da_minha_equipe(p_nome) and ((storage.foldername(p_nome))[2] = auth.uid()::text or privado.sou_admin())
$$;
revoke execute on function privado.foto_da_minha_equipe(text), privado.posso_mexer_na_foto(text) from public, anon;
grant execute on function privado.foto_da_minha_equipe(text), privado.posso_mexer_na_foto(text) to authenticated;

create policy "fotos da equipe: ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-da-equipe' and privado.foto_da_minha_equipe(name));
create policy "fotos da equipe: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-da-equipe' and privado.posso_mexer_na_foto(name));
create policy "fotos da equipe: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-da-equipe' and privado.posso_mexer_na_foto(name))
  with check (bucket_id = 'fotos-da-equipe' and privado.posso_mexer_na_foto(name));
create policy "fotos da equipe: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-da-equipe' and privado.posso_mexer_na_foto(name));
