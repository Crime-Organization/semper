-- =====================================================================
-- Reativar tira a senha antiga de uso (#243)
--   Reativar encerrava as sessões, mas quem conhecia a senha entrava de novo,
--   inclusive um invasor. Agora toda reativação troca a senha por uma que
--   ninguém conhece e cancela os links pendentes de recuperação de senha e de
--   troca de e-mail, como a troca de e-mail pelo administrador já fazia.
--   A pessoa cria uma senha nova em "Esqueci minha senha".
--   Nova versão da função, com os mesmos parâmetros: a versão anterior do
--   site continua funcionando, só sem o aviso de que a senha mudou.
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
  -- Na reativação, e não na desativação: um link de recuperação pedido enquanto a pessoa estava desativada também não pode valer.
  if p_ativo then
    update auth.users u set encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      email_change = '', email_change_token_new = '', email_change_token_current = '',
      email_change_confirm_status = 0, email_change_sent_at = null, recovery_token = '', recovery_sent_at = null
    where u.id = p_perfil;
    delete from auth.one_time_tokens t where t.user_id = p_perfil;
  end if;
end $$;
