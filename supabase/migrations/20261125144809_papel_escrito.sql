-- =====================================================================
-- O papel escrito pela equipe no processo (#443)
--   No "Papel do cliente" (e no papel das pessoas do processo, que usa a mesma lista), a equipe pode escrever um papel que não
--   está na lista (ex.: "Inventariante"). O nome escrito fica guardado no processo e entra na lista do escritório, que aparece
--   nos próximos cadastros. O administrador tira um papel da lista nas Configurações; os processos que já o usam continuam com
--   o nome, porque o nome está gravado neles.
--   1. processo_papeis: a lista do escritório. Um nome aparece uma vez só, sem contar maiúsculas, acentos e espaços repetidos
--      (privado.chave_do_papel, a mesma comparação de chaveDoPapel, em app/src/regras/papelEscrito.ts). Cada escritório tem a sua.
--      Quem a alimenta é o banco, ao gravar o processo (ou a pessoa do processo): só cria papel quem pode alterar o processo.
--      Só o administrador tira da lista (e devolve, no Desfazer).
--   2. processos.papeis_escritos: o nome escrito de cada cliente, pelo id da pessoa ({"<id>": "Inventariante"}). O cliente
--      continua com o papel fixo 'outro' em papeis_clientes: a lista fixa e a regra processos_papeis_clientes_validos (#426)
--      não mudam. O gatilho preparar_papeis_escritos só guarda o nome de quem é cliente com o papel 'outro', limpa o texto,
--      usa a grafia da lista e põe na lista só os nomes novos para o processo (salvar de novo não devolve à lista o que o
--      administrador tirou).
--   3. processo_partes.papel_escrito: o mesmo para as pessoas do processo (só com o papel 'outro'), com o gatilho
--      preparar_papel_escrito, e o histórico da pessoa do processo leva o nome escrito.
--   4. O histórico do processo grava os nomes escritos como texto ("Inventariante").
--   Só acrescenta (tabela, colunas, funções, gatilhos e regras). A versão anterior do site continua funcionando: ela não lê nem
--   manda as colunas novas, que têm valor padrão; o papel continua 'outro', que ela conhece e mostra como "Outro papel"; quando
--   ela grava o processo, o nome escrito fica enquanto o papel continuar 'outro'. Nada é apagado nem renomeado.
-- =====================================================================

-- ---------- 1. A lista do escritório ----------
-- A comparação dos nomes: sem acento, em minúsculas, sem espaços nas pontas e com os repetidos juntados.
create function privado.chave_do_papel(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select privado.sem_acento(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;
revoke execute on function privado.chave_do_papel(text) from public, anon;
grant execute on function privado.chave_do_papel(text) to authenticated;

-- O tamanho do nome (TAMANHO_PROCESSO.papelEscrito, em app/src/dados/limites.ts: mudou aqui, muda lá).
create table public.processo_papeis (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome          text not null check (btrim(nome) <> '' and length(nome) <= 60),
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now()
);
create unique index processo_papeis_unico on public.processo_papeis (escritorio_id, privado.chave_do_papel(nome));
comment on table public.processo_papeis is
  'Os papéis escritos pela equipe nos processos (#443), a lista de cada escritório. O banco a alimenta ao gravar o processo.';

alter table public.processo_papeis enable row level security;
revoke all on public.processo_papeis from anon;
revoke update on public.processo_papeis from authenticated;
-- Todos do escritório leem; só o administrador põe (o Desfazer das Configurações) e tira. A equipe cria pelo processo (os gatilhos).
create policy leitura on public.processo_papeis for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.processo_papeis for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy apagar on public.processo_papeis for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create trigger auditoria after insert or delete on public.processo_papeis for each row execute function privado.auditar();

-- O nome escrito limpo (espaços das pontas fora, repetidos juntados), ou null quando fica vazio. Mais de 60 letras: recusa.
create function privado.papel_escrito_limpo(t text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := nullif(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), '');
begin
  if length(v) > 60 then
    raise exception 'Algum campo está em formato inválido. Confira os dados e tente de novo.' using errcode = '23514';
  end if;
  return v;
end $$;
revoke execute on function privado.papel_escrito_limpo(text) from public, anon;

-- O nome na grafia da lista do escritório, se ele já está lá; senão, o próprio nome. Com p_incluir, o nome novo entra na lista.
create function privado.papel_na_lista(p_escritorio uuid, p_nome text, p_incluir boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  select p.nome into v from public.processo_papeis p
  where p.escritorio_id = p_escritorio and privado.chave_do_papel(p.nome) = privado.chave_do_papel(p_nome);
  if v is not null then return v; end if;
  if p_incluir then
    insert into public.processo_papeis (escritorio_id, nome, criado_por) values (p_escritorio, p_nome, auth.uid()) on conflict do nothing;
  end if;
  return p_nome;
end $$;
revoke execute on function privado.papel_na_lista(uuid, text, boolean) from public, anon, authenticated;

-- ---------- 2. O papel escrito de cada cliente ----------
alter table public.processos add column papeis_escritos jsonb not null default '{}'
  constraint processos_papeis_escritos_validos check (
    jsonb_typeof(papeis_escritos) = 'object' and not jsonb_path_exists(papeis_escritos, '$.* ? (@.type() != "string")'));
comment on column public.processos.papeis_escritos is
  'O nome escrito do papel de cada cliente (#443), pelo id da pessoa; o cliente tem o papel ''outro'' em papeis_clientes.';
-- Quem altera o processo muda o nome escrito (a lista do que se altera é por coluna, desde 20261101155218_processos.sql).
grant update (papeis_escritos) on public.processos to authenticated;

-- Só o cliente do processo com o papel 'outro' guarda o nome escrito, limpo e na grafia da lista. Os nomes novos para este processo
-- entram na lista do escritório. Pelo nome, roda depois de preparar e de preparar_papeis (#426), que já acertaram os clientes e os papéis.
create function privado.preparar_papeis_escritos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := '{}'; x record; nome text;
  antes jsonb := case when tg_op = 'UPDATE' then old.papeis_escritos else '{}' end;
begin
  if jsonb_typeof(new.papeis_escritos) is distinct from 'object'
     or jsonb_path_exists(new.papeis_escritos, '$.* ? (@.type() != "string")') then
    raise exception 'Algum campo está em formato inválido. Confira os dados e tente de novo.' using errcode = '23514';
  end if;
  for x in select key, value from jsonb_each_text(new.papeis_escritos) loop
    continue when not exists (select 1 from unnest(new.clientes) c where c::text = x.key);
    continue when new.papeis_clientes ->> x.key is distinct from 'outro';
    nome := privado.papel_escrito_limpo(x.value);
    continue when nome is null;
    nome := privado.papel_na_lista(new.escritorio_id, nome,
      not exists (select 1 from jsonb_each_text(antes) a where privado.chave_do_papel(a.value) = privado.chave_do_papel(nome)));
    v := v || jsonb_build_object(x.key, nome);
  end loop;
  new.papeis_escritos := v;
  return new;
end $$;
revoke execute on function privado.preparar_papeis_escritos() from public, anon;
create trigger preparar_papeis_escritos before insert or update of clientes, papeis_clientes, papeis_escritos, polo on public.processos
  for each row execute function privado.preparar_papeis_escritos();

-- ---------- 3. O papel escrito das pessoas do processo ----------
alter table public.processo_partes add column papel_escrito text
  constraint processo_partes_papel_escrito_valido check (
    papel_escrito is null or (papel = 'outro' and btrim(papel_escrito) <> '' and length(papel_escrito) <= 60));
comment on column public.processo_partes.papel_escrito is 'O nome escrito do papel (#443), só com o papel ''outro''.';

-- O nome limpo, na grafia da lista, e o nome novo entra na lista do escritório. Com outro papel que não 'outro', a regra recusa.
create function privado.preparar_papel_escrito() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.papel_escrito := privado.papel_escrito_limpo(new.papel_escrito);
  if new.papel_escrito is not null and new.papel = 'outro' then
    new.papel_escrito := privado.papel_na_lista(new.escritorio_id, new.papel_escrito, true);
  end if;
  return new;
end $$;
revoke execute on function privado.preparar_papel_escrito() from public, anon;
create trigger preparar_papel_escrito before insert on public.processo_partes
  for each row execute function privado.preparar_papel_escrito();

-- O histórico da pessoa do processo leva o nome escrito, quando há. A função é a de 20261122130109_processo_partes_recursos_e_tipos.sql.
create or replace function privado.historico_parte_do_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.processo_partes := case when tg_op = 'DELETE' then old else new end; v_parte jsonb;
begin
  if not exists (select 1 from public.processos p where p.id = v.processo_id) then return null; end if;
  v_parte := jsonb_build_object('pessoa_id', v.pessoa_id, 'nome', (select nome from public.pessoas where id = v.pessoa_id), 'papel', v.papel);
  if v.papel_escrito is not null then v_parte := v_parte || jsonb_build_object('papel_escrito', v.papel_escrito); end if;
  insert into public.processo_historico (escritorio_id, processo_id, alteracoes, feito_por)
  values (v.escritorio_id, v.processo_id, jsonb_build_object('partes', case when tg_op = 'DELETE'
    then jsonb_build_object('de', v_parte, 'para', null) else jsonb_build_object('de', null, 'para', v_parte) end), auth.uid());
  return null;
end $$;

-- ---------- 4. O histórico do processo ----------
-- Os nomes escritos, cada um uma vez, em ordem e separados por vírgula (nulo quando não há).
create function privado.nomes_dos_papeis_escritos(p jsonb) returns text
language sql immutable set search_path = '' as $$
  select string_agg(distinct x.value, ', ' order by x.value) from jsonb_each_text(coalesce(p, '{}')) x
$$;
revoke execute on function privado.nomes_dos_papeis_escritos(jsonb) from public, anon;

-- A função é a de 20261101223231_campos_de_processo.sql, com os nomes escritos (#443) como texto: assim a versão anterior do site
-- mostra o nome, e não um objeto.
create or replace function privado.historico_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'tipo', 'cliente_nome', 'busca', 'nome_ordem', 'etapa_ordem', 'arquivado_por',
                        'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'campos');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'colaboradores' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.colaboradores), 'para', privado.nomes_da_equipe(new.colaboradores)))
      when 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '), 'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      when 'papeis_escritos' then case
        when privado.nomes_dos_papeis_escritos(old.papeis_escritos) is not distinct from privado.nomes_dos_papeis_escritos(new.papeis_escritos) then '{}'::jsonb
        else jsonb_build_object(k, jsonb_build_object(
          'de', privado.nomes_dos_papeis_escritos(old.papeis_escritos), 'para', privado.nomes_dos_papeis_escritos(new.papeis_escritos))) end
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  for k in select jsonb_object_keys(old.campos) union select jsonb_object_keys(new.campos) loop
    continue when old.campos -> k is not distinct from new.campos -> k;
    a := a || jsonb_build_object('campo:' || k, jsonb_build_object('de', old.campos -> k, 'para', new.campos -> k));
  end loop;
  if a <> '{}' then
    insert into public.processo_historico (escritorio_id, processo_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
