-- =====================================================================
-- Desativar e reativar encerram as sessões da pessoa (#237)
--   Desativar só mudava perfis.ativo: as sessões continuavam existindo, e,
--   ao reativar, o token e o token de renovação antigos voltavam a valer,
--   inclusive os de um invasor. Reativar também encerra as sessões, porque
--   a pessoa desativada ainda consegue entrar com a senha e abrir uma nova.
--   Nova versão da função, com os mesmos parâmetros: a versão anterior do
--   site continua funcionando.
-- =====================================================================

create or replace function public.equipe_definir_ativo(p_perfil uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_atual text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores'; end if;
  if p_perfil = auth.uid() then raise exception 'Você não pode desativar a própria conta'; end if;
  select papel into v_atual from public.perfis where id = p_perfil and escritorio_id = privado.meu_escritorio();
  if v_atual is null then raise exception 'Usuário não encontrado'; end if;
  if v_atual = 'master' then raise exception 'O usuário master não pode ser desativado'; end if;
  if v_atual = 'admin' and not privado.sou_master() then raise exception 'Só o master gerencia administradores'; end if;
  update public.perfis set ativo = p_ativo where id = p_perfil;
  delete from auth.sessions s where s.user_id = p_perfil;
end $$;
