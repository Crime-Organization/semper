-- O nome de quem é da equipe, mudado por um administrador em "Equipe e acessos" (cada um já muda o seu em Minha conta).
-- Como na troca de papel: o administrador muda o nome dos usuários; o master muda também o dos administradores; o nome
-- de um master só ele mesmo muda. Fica no registro de ações. Só acrescenta uma função: nada muda para a versão anterior.
create function public.equipe_definir_nome(p_perfil uuid, p_nome text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nome text := btrim(coalesce(p_nome, '')); v_papel text; v_antes text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores mudam o nome de alguém da equipe'; end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 200 then raise exception 'Informe um nome de 2 a 200 letras.'; end if;
  select papel, nome into v_papel, v_antes from public.perfis where id = p_perfil and escritorio_id = privado.meu_escritorio();
  if v_papel is null then raise exception 'Usuário não encontrado'; end if;
  if p_perfil <> auth.uid() and v_papel = 'master' then raise exception 'Só o próprio master muda o nome dele.'; end if;
  if p_perfil <> auth.uid() and v_papel = 'admin' and not exists (select 1 from public.perfis where id = auth.uid() and papel = 'master') then
    raise exception 'Só o master muda o nome de um administrador.';
  end if;
  update public.perfis set nome = v_nome where id = p_perfil;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (privado.meu_escritorio(), 'perfis', p_perfil::text, 'alteracao', jsonb_build_object('nome', v_nome, 'antes', v_antes), auth.uid());
end $$;
revoke execute on function public.equipe_definir_nome(uuid, text) from public, anon;
grant execute on function public.equipe_definir_nome(uuid, text) to authenticated;
