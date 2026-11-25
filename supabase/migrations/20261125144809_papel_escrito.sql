-- =====================================================================
-- O papel do cliente escrito pela equipe no processo (#443)
--   No "Papel do cliente", a equipe pode escrever um papel que não está na lista (ex.: "Inventariante"). O nome escrito fica
--   guardado no processo e entra na lista do escritório, que aparece nos próximos cadastros. O administrador tira um papel da
--   lista nas Configurações; os processos que já o usam continuam com o nome, porque o nome está gravado neles.
--   1. processo_papeis: a lista do escritório. Um nome aparece uma vez só, sem contar maiúsculas, acentos e espaços repetidos
--      (privado.chave_do_papel, a mesma comparação de chaveDoPapel, em app/src/regras/papelEscrito.ts). Cada escritório tem a sua.
--      Só entra nela o que a pessoa ESCREVEU agora, pela função processo_papeis_incluir, que a tela chama depois de gravar: o
--      nome copiado (o recurso que nasce do processo), devolvido (o Desfazer de tirar o cliente) ou escolhido da lista não entra,
--      e o que o administrador tirou não volta sozinho. Só o administrador tira da lista.
--   2. processos.papeis_escritos: o nome escrito de cada cliente, pelo id da pessoa ({"<id>": "Inventariante"}). O cliente
--      continua com o papel fixo 'outro' em papeis_clientes: a lista fixa e a regra processos_papeis_clientes_validos (#426)
--      não mudam. O gatilho preparar_papeis_escritos só guarda o nome de quem é cliente com o papel 'outro', limpa o texto e
--      usa a grafia da lista, quando o nome está nela.
--   3. O histórico do processo grava os nomes escritos como texto ("Inventariante").
--   Só acrescenta (tabela, coluna, funções, gatilho e regras). A versão anterior do site continua funcionando: ela não lê nem
--   manda a coluna nova, que tem valor padrão; o papel continua 'outro', que ela conhece e mostra como "Outro papel"; quando
--   ela grava o processo, o nome escrito fica enquanto o papel continuar 'outro'. No histórico, ela mostra a chave nova sem
--   rótulo ("papeis_escritos: Inventariante → Curador") até o site novo ser publicado. Nada é apagado nem renomeado.
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
  'Os papéis do cliente escritos pela equipe nos processos (#443), a lista de cada escritório. Entra por processo_papeis_incluir.';

alter table public.processo_papeis enable row level security;
revoke all on public.processo_papeis from anon;
-- Ninguém põe nem muda direto: o nome entra só por processo_papeis_incluir, que o limpa e marca quem e quando.
revoke insert, update, truncate, references, trigger on public.processo_papeis from authenticated;
-- Todos do escritório leem; só o administrador tira.
create policy leitura on public.processo_papeis for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
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

-- O nome na grafia da lista do escritório, se ele já está lá; senão, o próprio nome. Não põe nada na lista.
create function privado.papel_na_lista(p_escritorio uuid, p_nome text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.nome from public.processo_papeis p
    where p.escritorio_id = p_escritorio and privado.chave_do_papel(p.nome) = privado.chave_do_papel(p_nome)), p_nome)
$$;
revoke execute on function privado.papel_na_lista(uuid, text) from public, anon, authenticated;

-- Põe na lista do escritório de quem está logado os nomes que a pessoa escreveu agora (e o Desfazer de tirar da lista). O nome
-- que já está na lista, com qualquer grafia, fica como está. Qualquer pessoa ativa do escritório pode: é ela quem escreve.
create function public.processo_papeis_incluir(p_nomes text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio(); n text; v text;
begin
  if v_escritorio is null then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  foreach n in array coalesce(p_nomes, '{}') loop
    v := privado.papel_escrito_limpo(n);
    continue when v is null;
    insert into public.processo_papeis (escritorio_id, nome, criado_por) values (v_escritorio, v, auth.uid()) on conflict do nothing;
  end loop;
end $$;
revoke execute on function public.processo_papeis_incluir(text[]) from public, anon;
grant execute on function public.processo_papeis_incluir(text[]) to authenticated;

-- ---------- 2. O papel escrito de cada cliente ----------
alter table public.processos add column papeis_escritos jsonb not null default '{}'
  constraint processos_papeis_escritos_validos check (
    jsonb_typeof(papeis_escritos) = 'object' and not jsonb_path_exists(papeis_escritos, '$.* ? (@.type() != "string")'));
comment on column public.processos.papeis_escritos is
  'O nome escrito do papel de cada cliente (#443), pelo id da pessoa; o cliente tem o papel ''outro'' em papeis_clientes.';
-- Quem altera o processo muda o nome escrito (a lista do que se altera é por coluna, desde 20261101155218_processos.sql).
grant update (papeis_escritos) on public.processos to authenticated;

-- Só o cliente do processo com o papel 'outro' guarda o nome escrito, limpo e na grafia da lista (quando está nela). A lista
-- não muda aqui. Pelo nome, roda depois de preparar e de preparar_papeis (#426), que já acertaram os clientes e os papéis.
create function privado.preparar_papeis_escritos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v jsonb := '{}'; x record; nome text;
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
    v := v || jsonb_build_object(x.key, privado.papel_na_lista(new.escritorio_id, nome));
  end loop;
  new.papeis_escritos := v;
  return new;
end $$;
revoke execute on function privado.preparar_papeis_escritos() from public, anon;
create trigger preparar_papeis_escritos before insert or update of clientes, papeis_clientes, papeis_escritos, polo on public.processos
  for each row execute function privado.preparar_papeis_escritos();

-- ---------- 3. O histórico do processo ----------
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
