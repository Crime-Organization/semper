-- =====================================================================
-- O e-mail do Google só muda pelo administrador, em Equipe e acessos (#166, correção da revisão)
--   Decisão do dono (25/11): o e-mail do Google de cada pessoa, que recebe a própria agenda, a Geral e as das salas (com
--   nomes de clientes e números de processo, dados sob a LGPD), é por padrão o de entrada e "pode ser trocado em Equipe".
--   A primeira versão deixava a própria pessoa, qualquer que fosse o papel, trocá-lo em Minha conta para qualquer endereço,
--   sem ninguém saber: um estagiário mandaria as agendas do escritório para um e-mail de fora. Agora só os administradores
--   mudam (o próprio e o de quem a regra do nome deixa: o de um administrador, só o master; o de um master, só ele).
--   Só acrescenta: a função é refeita com a mesma assinatura e o mesmo comportamento para os administradores. A versão
--   anterior do site continua funcionando: ela não tem o e-mail do Google (é deste mesmo lote).
-- =====================================================================

create or replace function public.email_do_google_salvar(p_perfil uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_alvo public.perfis; v_entrada text;
begin
  select * into v_alvo from public.perfis f where f.id = p_perfil and f.escritorio_id = privado.meu_escritorio() and f.excluido_em is null;
  if v_alvo.id is null then raise exception 'Usuário não encontrado'; end if;
  -- As mesmas palavras de RECUSA_DO_EMAIL_DO_GOOGLE, em app/src/regras/emailDoGoogle.ts.
  if not privado.sou_admin() then
    if p_perfil = auth.uid() then raise exception 'Só os administradores mudam o e-mail do Google, em Equipe e acessos.'; end if;
    raise exception 'Apenas administradores mudam o e-mail do Google de alguém da equipe';
  end if;
  if p_perfil <> auth.uid() then
    if v_alvo.papel = 'master' then raise exception 'Só o próprio master muda o e-mail do Google dele.'; end if;
    if v_alvo.papel = 'admin' and not exists (select 1 from public.perfis f where f.id = auth.uid() and f.papel = 'master') then
      raise exception 'Só o master muda o e-mail do Google de um administrador.';
    end if;
  end if;
  select lower(u.email) into v_entrada from auth.users u where u.id = p_perfil;
  if v_email = '' or (v_email = v_entrada and not v_alvo.reservada) then
    delete from public.emails_do_google where perfil_id = p_perfil;
  else
    if length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Informe um e-mail válido.';
    end if;
    insert into public.emails_do_google as g (perfil_id, escritorio_id, email, atualizado_por)
    values (p_perfil, v_alvo.escritorio_id, v_email, auth.uid())
    on conflict (perfil_id) do update set email = excluded.email, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_alvo.escritorio_id, 'perfis', p_perfil::text, 'alteracao', jsonb_build_object('nome', v_alvo.nome, 'email_google', nullif(v_email, '')), auth.uid());
end $$;
