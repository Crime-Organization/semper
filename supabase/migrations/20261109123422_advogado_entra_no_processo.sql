-- =====================================================================
-- Na fase de adaptação, o advogado entra nos processos e marca audiência em qualquer processo (#273)
--   Muitos processos importados ainda não estão ligados ao advogado certo. Com a chave "equipe_ve_tudo" ligada, quem tem a função de
--   advogado pode se incluir no processo como colaborador, ou assumir como responsável: nesse caso, quem era responsável continua no
--   processo, como colaborador, para ninguém perder o acesso. Ao entrar, ele passa a alterar o processo como qualquer outro colaborador.
--   Vale só para processos. Com a chave desligada, nada muda.
--   Só acrescenta: duas funções novas e a conferência do compromisso mais larga. A versão anterior do site continua funcionando.
-- =====================================================================

create function privado.advogado_na_adaptacao() returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.equipe_ve_tudo() and exists (select 1 from public.perfis p where p.id = auth.uid() and p.ativo and p.funcao = 'advogado')
$$;
revoke execute on function privado.advogado_na_adaptacao() from public, anon;
grant execute on function privado.advogado_na_adaptacao() to authenticated;

-- A pessoa só consegue incluir a si mesma. Quem já está no processo como colaborador e pede para ser colaborador não muda nada.
create function public.processo_me_incluir(p_processo uuid, p_como text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu uuid := auth.uid(); p public.processos;
begin
  if not privado.advogado_na_adaptacao() then
    raise exception 'Só advogados podem entrar no processo nesta fase.';
  end if;
  select * into p from public.processos x where x.id = p_processo and x.escritorio_id = privado.meu_escritorio() and x.arquivado_em is null for update;
  if p.id is null then
    raise exception 'Processo não encontrado neste escritório.';
  end if;
  if p_como = 'colaborador' then
    if v_eu = p.responsavel_id or v_eu = any(p.colaboradores) then return; end if;
    update public.processos set colaboradores = colaboradores || v_eu where id = p.id;
  elsif p_como = 'responsavel' then
    if v_eu = p.responsavel_id then return; end if;
    update public.processos set responsavel_id = v_eu, colaboradores = array_remove(colaboradores, v_eu) || p.responsavel_id where id = p.id;
  else
    raise exception 'Escolha como entrar no processo.';
  end if;
end $$;
revoke execute on function public.processo_me_incluir(uuid, text) from public, anon;
grant execute on function public.processo_me_incluir(uuid, text) to authenticated;

-- A mesma função de antes: o advogado também pode ligar o próprio compromisso a qualquer processo, nesta fase.
CREATE OR REPLACE FUNCTION privado.preparar_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v uuid[] := '{}'; x uuid; p public.processos;
begin
  new.titulo := nullif(btrim(new.titulo), '');
  new.local := nullif(btrim(new.local), '');
  new.resultado := nullif(btrim(new.resultado), '');
  new.observacoes := nullif(btrim(new.observacoes), '');
  foreach x in array new.pessoas loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Pessoa não encontrada neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.pessoas := v;
  new.pessoa_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.participantes loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    -- Confere só quem está entrando: quem já estava e saiu da equipe não trava as outras alterações.
    if (tg_op = 'INSERT' or x <> all(old.participantes))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;

  if new.processo_id is null then
    new.processo_codigo := null;
    new.processo_numero := null;
  elsif tg_op = 'INSERT' or new.processo_id is distinct from old.processo_id then
    select * into p from public.processos where id = new.processo_id and escritorio_id = new.escritorio_id;
    if p.id is null or (auth.uid() is not null and not privado.advogado_na_adaptacao()
        and not privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores)) then
      raise exception 'Processo não encontrado neste escritório.';
    end if;
    new.processo_codigo := p.codigo;
    new.processo_numero := p.numero;
  end if;
  return new;
end $function$;
