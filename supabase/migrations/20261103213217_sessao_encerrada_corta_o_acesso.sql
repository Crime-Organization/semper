-- =====================================================================
-- Sessão encerrada corta o acesso na hora (#233)
--   O token da sessão é válido até vencer, mesmo depois de a sessão acabar:
--   a troca de e-mail pelo administrador apagava as sessões, e o token já
--   emitido continuava lendo e gravando. Agora a verificação central confere
--   se a sessão do token ainda existe.
--   Toda sessão encerrada vale na hora: a troca de e-mail, a troca de senha
--   (o login encerra as outras sessões) e o "Sair" (encerra todas as sessões
--   da pessoa). Quem está logado e com a sessão ativa não percebe nada.
--   Só novas versões de funções e regras, com os mesmos parâmetros: a versão
--   anterior do site continua funcionando.
-- =====================================================================

-- Sem session_id no token (o login sempre manda), a conta dá falso e o acesso fica fechado. Só as verificações abaixo a chamam.
create function privado.sessao_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.sessions s where s.id = (auth.jwt() ->> 'session_id')::uuid)
$$;
revoke execute on function privado.sessao_ok() from public, anon, authenticated;

create or replace function privado.meu_escritorio() returns uuid
language sql stable security definer set search_path = '' as $$
  select escritorio_id from public.perfis where id = auth.uid() and ativo and privado.duas_etapas_ok() and privado.sessao_ok()
$$;
create or replace function privado.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select papel in ('master', 'admin') from public.perfis where id = auth.uid() and ativo), false) and privado.duas_etapas_ok() and privado.sessao_ok()
$$;
create or replace function privado.sou_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select papel = 'master' from public.perfis where id = auth.uid() and ativo), false) and privado.duas_etapas_ok() and privado.sessao_ok()
$$;
create or replace function privado.sou_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plataforma_donos where usuario_id = auth.uid()) and privado.duas_etapas_ok() and privado.sessao_ok()
$$;

-- As três regras que só olhavam quem é a pessoa passam pela mesma verificação. Com isso, quem foi desativado também deixa de
-- mexer nelas. As outras regras sem meu_escritorio() leem uma tabela que já o usa (as de histórico, por exemplo) ou não têm dado
-- de cliente (quadro_sugestoes).
alter policy alterar on public.perfis
  using (id = (select auth.uid()) and (select privado.meu_escritorio()) is not null)
  with check (id = (select auth.uid()) and (select privado.meu_escritorio()) is not null);
alter policy alterar on public.tarefa_tempos
  using (perfil_id = (select auth.uid()) and not ajuste and (select privado.meu_escritorio()) is not null)
  with check (perfil_id = (select auth.uid()) and not ajuste and (select privado.meu_escritorio()) is not null);
alter policy proprias on public.quadro_colunas_ocultas
  using (perfil_id = (select auth.uid()) and (select privado.meu_escritorio()) is not null)
  with check (perfil_id = (select auth.uid()) and exists (
    select 1 from public.quadro_colunas c where c.id = coluna_id and c.escritorio_id = (select privado.meu_escritorio())));
