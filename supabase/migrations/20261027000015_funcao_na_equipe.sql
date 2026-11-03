-- =====================================================================
-- 015 · Função de cada membro da equipe
--   Cada membro da equipe tem uma função: advogado, administrativo ou
--   estagiário. A função é diferente do papel no sistema (perfis.papel):
--   administrador é quem tem poder de gestão (os sócios e a secretária
--   responsável pela gestão); "administrativo" é uma função, sem gestão.
--   Os administradores escolhem a função em "Equipe e acessos".
--
--   No contrato:
--   - o responsável é sempre um advogado;
--   - os participantes são sempre membros da equipe (qualquer função);
--   - o indicador pode ser qualquer pessoa.
--   As regras valem quando o responsável ou um participante é escolhido:
--   contratos que já existem continuam como estão até alguém trocar.
--
--   Quem já está na equipe começa como advogado; um administrador ajusta.
--   Só acrescenta (a coluna, a função de alterar e a regra do responsável)
--   e troca o gatilho interno dos participantes. A versão anterior do site
--   continua funcionando.
-- =====================================================================

alter table public.perfis add column funcao text not null default 'advogado'
  check (funcao in ('advogado', 'administrativo', 'estagiario'));

-- Só administradores mudam a função de alguém, e cada mudança fica no registro de ações.
create function public.equipe_definir_funcao(p_perfil uuid, p_funcao text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores mudam a função de alguém da equipe'; end if;
  if p_funcao not in ('advogado', 'administrativo', 'estagiario') then raise exception 'Função inválida'; end if;
  update public.perfis set funcao = p_funcao where id = p_perfil and escritorio_id = privado.meu_escritorio()
  returning nome into v_nome;
  if v_nome is null then raise exception 'Usuário não encontrado'; end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (privado.meu_escritorio(), 'perfis', p_perfil::text, 'alteracao', jsonb_build_object('nome', v_nome, 'funcao', p_funcao), auth.uid());
end $$;
revoke execute on function public.equipe_definir_funcao(uuid, text) from public, anon;
grant execute on function public.equipe_definir_funcao(uuid, text) to authenticated;

-- O responsável do contrato é sempre um advogado da equipe (conferido ao criar e ao trocar o responsável).
-- Os gatilhos rodam em ordem alfabética: o nome começa com "a" para esta regra vir antes da numeração,
-- que pede o CPF do responsável.
create function privado.responsavel_advogado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id and funcao = 'advogado') then
    raise exception 'O responsável do contrato precisa ser um advogado da equipe.';
  end if;
  return new;
end $$;
create trigger advogado_responsavel before insert or update of responsavel_id on public.contratos
  for each row execute function privado.responsavel_advogado();

-- Participante é sempre alguém da equipe (a pessoa ligada a um usuário do escritório). Quem já era participante antes
-- desta regra continua, até sair da lista.
create or replace function privado.contrato_participantes() returns trigger
language plpgsql set search_path = '' as $$
declare v jsonb := '[]'; e jsonb; v_pessoa uuid; v_pct numeric;
begin
  if (tg_op = 'INSERT' and new.participantes = '[]' and new.participante_id is not null)
     or (tg_op = 'UPDATE' and new.participantes is not distinct from old.participantes
         and (new.participante_id is distinct from old.participante_id or new.participante_percentual is distinct from old.participante_percentual)) then
    if new.participante_id is null and new.participante_percentual is not null then
      raise exception 'Escolha o participante deste percentual.';
    end if;
    new.participantes := case when new.participante_id is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('pessoa_id', new.participante_id, 'percentual', new.participante_percentual)) end;
  end if;

  for e in select x from jsonb_array_elements(new.participantes) x loop
    begin
      v_pessoa := (e ->> 'pessoa_id')::uuid;
      v_pct := round((e ->> 'percentual')::numeric, 2);
    exception when others then
      raise exception 'Confira os participantes do contrato.';
    end;
    if v_pessoa is null then raise exception 'Escolha o participante deste percentual.'; end if;
    if v_pct is not null and (v_pct < 0 or v_pct > 100) then raise exception 'Use um percentual de 0 a 100.'; end if;
    if v_pessoa = new.indicador_id then raise exception 'O indicador e os participantes precisam ser pessoas diferentes.'; end if;
    if exists (select 1 from jsonb_array_elements(v) y where (y ->> 'pessoa_id')::uuid = v_pessoa) then
      raise exception 'A mesma pessoa aparece duas vezes nos participantes.';
    end if;
    if not exists (select 1 from public.pessoas where id = v_pessoa and escritorio_id = new.escritorio_id) then
      raise exception 'Participante não encontrado neste escritório.';
    end if;
    if not exists (select 1 from public.perfis where pessoa_id = v_pessoa and escritorio_id = new.escritorio_id)
       and (tg_op = 'INSERT' or not old.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', v_pessoa))) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || jsonb_build_array(jsonb_build_object('pessoa_id', v_pessoa, 'percentual', v_pct));
  end loop;

  new.participantes := v;
  new.participante_id := (v -> 0 ->> 'pessoa_id')::uuid;
  new.participante_percentual := (v -> 0 ->> 'percentual')::numeric;
  return new;
end $$;
