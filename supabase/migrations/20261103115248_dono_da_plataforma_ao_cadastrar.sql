-- =====================================================================
-- O dono da plataforma não troca de conta ao cadastrar (tarefa #218)
--   Agora que cada pessoa pode trocar o e-mail de acesso em Minha conta, o e-mail antigo do dono fica livre. A linha de
--   plataforma_donos continua com ele, e uma conta nova com esse e-mail tomaria o lugar do dono. Por isso, o cadastro só liga o dono
--   à conta quando ele ainda não tem nenhuma. O resto da função é igual ao de 20261026000004_convite_seguro.sql.
--   Só acrescenta (troca a função por outra, com a mesma assinatura): a versão anterior do site continua funcionando.
-- =====================================================================

create or replace function privado.ao_cadastrar_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.convites; v_pessoa uuid; v_base text; v_usuario text; n int := 1; partes text[];
begin
  select * into c from public.convites
  where email = lower(new.email) and usado_em is null
    and codigo_hash = privado.resumo_codigo(new.raw_user_meta_data ->> 'convite')
    and link_criado_em > now() - interval '7 days'
  limit 1;
  if c.id is null then
    raise exception 'SEMPER: convite inválido ou vencido';
  end if;

  v_pessoa := c.pessoa_id;
  if v_pessoa is null then
    insert into public.pessoas (escritorio_id, tipo, nome, emails, criado_por)
    values (c.escritorio_id, 'contato', upper(c.nome), array[lower(new.email)], new.id)
    returning id into v_pessoa;
  end if;

  -- @usuario: primeiro e último nome, sem acentos (mateus.goncalves); repete com número se já existir.
  partes := regexp_split_to_array(regexp_replace(privado.sem_acento(btrim(c.nome)), '[^a-z ]', '', 'g'), '\s+');
  v_base := left(coalesce(nullif(partes[1], ''), 'usuario') || case when array_length(partes, 1) > 1 then '.' || partes[array_length(partes, 1)] else '' end, 36);
  v_usuario := v_base;
  while exists (select 1 from public.perfis where escritorio_id = c.escritorio_id and usuario = v_usuario) loop
    n := n + 1; v_usuario := v_base || n;
  end loop;

  insert into public.perfis (id, escritorio_id, pessoa_id, nome, usuario, papel)
  values (new.id, c.escritorio_id, v_pessoa, initcap(lower(c.nome)), v_usuario, c.papel);
  insert into public.pessoa_responsaveis (pessoa_id, perfil_id, escritorio_id)
  values (v_pessoa, new.id, c.escritorio_id) on conflict do nothing;

  update public.convites set usado_em = now(), usado_por = new.id, codigo_hash = null where id = c.id;
  update public.plataforma_donos set usuario_id = new.id where email = lower(new.email) and usuario_id is null;
  return new;
end $$;
