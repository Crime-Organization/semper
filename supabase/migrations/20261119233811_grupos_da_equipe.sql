-- =====================================================================
-- Grupos da equipe (#378)
--   O administrador junta pessoas da equipe em grupos (os núcleos do escritório, por exemplo) e põe um grupo num item: todos do
--   grupo passam a participar dele. Decisões do dono (19/11):
--   - o grupo fica LIGADO ao item, sem copiar as pessoas: quem entra no grupo depois participa; quem sai deixa de participar, se
--     não estiver no item por conta própria (responsável, na equipe do item, quem criou);
--   - uma pessoa pode estar em vários grupos; um item pode ter até 10 grupos (GRUPOS_POR_ITEM em app/src/dados/limites.ts);
--   - só administradores cuidam dos grupos (em Equipe e acessos), pelas funções abaixo; ninguém grava nas tabelas pela tela;
--   - vale para todos os escritórios: quem não cria grupos não vê diferença (as regras pelo grupo dão falso sem consultar nada);
--   - Pessoas (o cadastro) e a Agenda geral continuam como hoje.
--   Nomes: "grupos da equipe", para não confundir com os grupos de colunas do quadro (quadro_grupos) e os dos checklists.
--
--   Quem está num grupo do item:
--   - em tarefas, demandas, processos, compromissos e anotações: vê e altera, como quem é posto um a um (excluir de vez continua
--     com quem criou e com os administradores). As tarefas de uma demanda do grupo e os compromissos de um processo do grupo também
--     abrem, como já abrem para quem está na demanda ou no processo;
--   - no contrato: participa SEM os valores. Lê pela view contratos_da_equipe (com ve_financeiro falso, como a equipe com a chave
--     "equipe vê tudo"), muda só o que contrato_alterar_sem_valores muda e não lê contrato_participantes nem contrato_historico.
--     Pôr e tirar grupo do contrato é só por public.contrato_definir_grupos, por quem é parte por conta própria. A menção de quem
--     está só pelo grupo não dá os valores a ninguém (autor_sem_vinculo). E a menção a quem está num grupo do contrato também não
--     dá os valores a essa pessoa, nem depois de ela sair do grupo (mencoes_pelo_grupo): o grupo participa sem os valores, e quem
--     sai dele deixa de participar. Quem é mencionado sem estar num grupo do contrato continua ganhando os valores, como hoje;
--   - pode ser mencionado nos comentários do item; no contrato, continua valendo "só advogados";
--   - recebe o aviso de inclusão da #377 quando o grupo é posto no item ("pelo grupo X"); quem entra no grupo depois recebe uma
--     mensagem só, a do grupo (mensagens_de_grupo), e não uma por item;
--   - não aprova pedidos para participar (#363) e não sai do cartão sozinho (pede ao administrador).
--   De propósito, o grupo NÃO conta: em perfil_no_contrato (quem vê os valores), altero_o_contrato e cuido_do_contrato, nos avisos
--   de prazo e nos lembretes (vão para o responsável e os postos um a um) e em processo_me_incluir e por_no_item (entram por conta própria).
--
-- Só acrescenta: tabelas, colunas (com default '{}'), funções e gatilhos novos; as regras e as funções trocadas mostram o mesmo de
-- antes e mais (o grupo). As funções antigas de "estou no cartão" (vejo_demanda, vejo_tarefa, vejo_processo, participo_do_compromisso)
-- ficam, mas nenhuma regra nem função continua a chamá-las (o teste confere). A versão anterior do site continua funcionando:
--   - quem cria pela versão anterior cria sem grupo; quem altera não manda "grupos" (o PostgREST só grava o que recebe) e o grupo fica;
--   - a view contratos_da_equipe tem as mesmas colunas, na mesma ordem, e "grupos" no fim;
--   - o aviso pelo grupo chega para ela como "incluiu você" (entrou_como 'participante'; grupo_id é uma coluna que ela não pede);
--   - a mensagem de "entrou no grupo" fica numa tabela própria, que ela não lê;
--   - limite conhecido: na versão anterior, quem participa só pelo grupo veria o aviso de "só leitura" (ela não conhece a coluna).
--     Grupos só existem depois de um administrador criá-los no site novo, e a migração vai antes do site, na rotina Publicar.
-- =====================================================================

-- 1. Os grupos. O nome é único no escritório, sem diferença de maiúsculas (os espaços das pontas saem no gatilho).
create table public.grupos_da_equipe (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  -- TAMANHO_GRUPO_DA_EQUIPE em app/src/dados/limites.ts (mudou aqui, muda lá).
  nome           text not null constraint grupos_da_equipe_nome check (btrim(nome) <> '' and length(nome) <= 60),
  criado_por     uuid default auth.uid() references public.perfis on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references public.perfis on delete set null,
  atualizado_em  timestamptz not null default now(),
  -- Para a chave estrangeira dos integrantes, que exige o grupo e o integrante no mesmo escritório.
  constraint grupos_da_equipe_do_escritorio unique (id, escritorio_id)
);
create unique index grupos_da_equipe_nome_unico on public.grupos_da_equipe (escritorio_id, lower(nome));
create index grupos_da_equipe_criado_por on public.grupos_da_equipe (criado_por) where criado_por is not null;
create index grupos_da_equipe_atualizado_por on public.grupos_da_equipe (atualizado_por) where atualizado_por is not null;

-- 2. Quem está em cada grupo. Uma linha por pessoa e grupo; uma pessoa pode estar em vários.
create table public.grupo_integrantes (
  grupo_id       uuid not null,
  perfil_id      uuid not null references public.perfis on delete cascade,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  incluido_por   uuid references public.perfis on delete set null,
  incluido_em    timestamptz not null default now(),
  primary key (grupo_id, perfil_id),
  constraint grupo_integrantes_do_grupo foreign key (grupo_id, escritorio_id)
    references public.grupos_da_equipe (id, escritorio_id) on delete cascade
);
-- O que privado.meus_grupos() lê (uma vez por consulta).
create index grupo_integrantes_perfil on public.grupo_integrantes (perfil_id);
create index grupo_integrantes_escritorio on public.grupo_integrantes (escritorio_id);
create index grupo_integrantes_incluido_por on public.grupo_integrantes (incluido_por) where incluido_por is not null;

-- Toda a equipe do escritório lê os grupos e quem está neles (para escolher no "+" e ver quem participa). Ninguém grava pela tela:
-- só as funções "grupo_*" abaixo, que conferem se quem chama é administrador.
alter table public.grupos_da_equipe enable row level security;
alter table public.grupo_integrantes enable row level security;
revoke all on public.grupos_da_equipe from anon;
revoke all on public.grupo_integrantes from anon;
revoke insert, update, delete, truncate, references, trigger on public.grupos_da_equipe from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.grupo_integrantes from authenticated;
create policy leitura on public.grupos_da_equipe for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy leitura on public.grupo_integrantes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

create function privado.preparar_grupo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  return new;
end $$;
revoke execute on function privado.preparar_grupo() from public, anon, authenticated;
create trigger preparar before insert or update of nome on public.grupos_da_equipe
  for each row execute function privado.preparar_grupo();
create trigger carimbo before update on public.grupos_da_equipe
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.grupos_da_equipe
  for each row execute function privado.auditar();

-- O integrante é alguém da equipe ativa do escritório do grupo: sem conta reservada (ela não entra no sistema) e sem exclusão.
create function privado.preparar_integrante() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.perfis f where f.id = new.perfil_id and f.escritorio_id = new.escritorio_id
                 and f.ativo and not f.reservada and f.excluido_em is null) then
    raise exception 'O integrante precisa ser alguém da equipe do escritório.';
  end if;
  return new;
end $$;
revoke execute on function privado.preparar_integrante() from public, anon, authenticated;
create trigger preparar before insert on public.grupo_integrantes
  for each row execute function privado.preparar_integrante();
create trigger auditoria after insert or delete on public.grupo_integrantes
  for each row execute function privado.auditar();

-- 3. O grupo em cada item: uma coluna, como os colaboradores e os participantes. As regras de leitura ficam
-- "grupos && (select privado.meus_grupos())", que roda uma vez por consulta. Sem chave estrangeira: o gatilho preparar_grupos
-- confere os grupos que entram, e a exclusão do grupo tira o id de todos os itens (public.grupo_excluir).
-- O limite de 10 é GRUPOS_POR_ITEM em app/src/dados/limites.ts (mudou aqui, muda lá).
alter table public.demandas add column grupos uuid[] not null default '{}' constraint demandas_grupos_limite check (cardinality(grupos) <= 10);
alter table public.tarefas add column grupos uuid[] not null default '{}' constraint tarefas_grupos_limite check (cardinality(grupos) <= 10);
alter table public.processos add column grupos uuid[] not null default '{}' constraint processos_grupos_limite check (cardinality(grupos) <= 10);
alter table public.compromissos add column grupos uuid[] not null default '{}' constraint compromissos_grupos_limite check (cardinality(grupos) <= 10);
alter table public.contratos add column grupos uuid[] not null default '{}' constraint contratos_grupos_limite check (cardinality(grupos) <= 10);
alter table public.anotacoes add column grupos uuid[] not null default '{}' constraint anotacoes_grupos_limite check (cardinality(grupos) <= 10);
-- Para o filtro do quadro (grupos @> {id}), as listas pelos grupos e a exclusão.
create index demandas_grupos on public.demandas using gin (grupos);
create index tarefas_grupos on public.tarefas using gin (grupos);
create index processos_grupos on public.processos using gin (grupos);
create index compromissos_grupos on public.compromissos using gin (grupos);
create index contratos_grupos on public.contratos using gin (grupos);
create index anotacoes_grupos on public.anotacoes using gin (grupos);
-- Quem altera o item põe e tira grupos, como põe e tira participantes. No contrato, não: só por public.contrato_definir_grupos.
grant insert (grupos), update (grupos) on public.demandas, public.tarefas, public.processos, public.compromissos, public.anotacoes to authenticated;

-- Arruma a lista de grupos do item: tira os repetidos e confere só os grupos que entram (como os colaboradores: um grupo que já
-- estava não trava nada), lendo o grupo com "for key share" para ninguém pôr num item um grupo que está sendo excluído.
create function privado.preparar_grupos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid;
begin
  foreach x in array coalesce(new.grupos, '{}') loop
    continue when x is null or x = any(v);
    if tg_op = 'INSERT' or x <> all(old.grupos) then
      perform 1 from public.grupos_da_equipe g where g.id = x and g.escritorio_id = new.escritorio_id for key share;
      if not found then
        raise exception 'Grupo não encontrado neste escritório.';
      end if;
    end if;
    v := v || x;
  end loop;
  if cardinality(v) > 10 then
    raise exception 'Um item pode ter até 10 grupos.';
  end if;
  new.grupos := v;
  return new;
end $$;
revoke execute on function privado.preparar_grupos() from public, anon, authenticated;
create trigger preparar_grupos before insert or update of grupos on public.demandas for each row execute function privado.preparar_grupos();
create trigger preparar_grupos before insert or update of grupos on public.tarefas for each row execute function privado.preparar_grupos();
create trigger preparar_grupos before insert or update of grupos on public.processos for each row execute function privado.preparar_grupos();
create trigger preparar_grupos before insert or update of grupos on public.compromissos for each row execute function privado.preparar_grupos();
create trigger preparar_grupos before insert or update of grupos on public.contratos for each row execute function privado.preparar_grupos();
create trigger preparar_grupos before insert or update of grupos on public.anotacoes for each row execute function privado.preparar_grupos();

-- 4. Funções de "estou num grupo do item".
-- Os grupos de quem está logado, só do escritório dele. meu_escritorio() é nulo para quem está sem as duas etapas, com a sessão
-- encerrada ou desativado: essas pessoas não têm grupos.
create function privado.meus_grupos() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(i.grupo_id), '{}')
  from public.grupo_integrantes i
  where i.perfil_id = auth.uid() and i.escritorio_id = privado.meu_escritorio()
$$;

-- Os integrantes ativos dos grupos (sem conta reservada e sem exclusão), sem repetir, só do escritório pedido. Para os avisos e a
-- contagem: não depende só de os ids dos grupos serem do escritório.
create function privado.integrantes_dos_grupos(p_escritorio uuid, p_grupos uuid[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct i.perfil_id), '{}')
  from public.grupo_integrantes i
  join public.perfis f on f.id = i.perfil_id and f.escritorio_id = p_escritorio
  where coalesce(cardinality(p_grupos), 0) > 0 and i.grupo_id = any(p_grupos) and i.escritorio_id = p_escritorio
    and f.ativo and not f.reservada and f.excluido_em is null
$$;
revoke execute on function privado.integrantes_dos_grupos(uuid, uuid[]) from public, anon, authenticated;

-- A pessoa está num dos grupos (com as mesmas condições). Para as menções e para "ainda faz parte".
create function privado.perfil_nos_grupos(p_escritorio uuid, p_perfil uuid, p_grupos uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(cardinality(p_grupos), 0) > 0 and exists (
    select 1 from public.grupo_integrantes i
    join public.perfis f on f.id = i.perfil_id and f.escritorio_id = p_escritorio
    where i.perfil_id = p_perfil and i.grupo_id = any(p_grupos) and i.escritorio_id = p_escritorio
      and f.ativo and not f.reservada and f.excluido_em is null)
$$;
revoke execute on function privado.perfil_nos_grupos(uuid, uuid, uuid[]) from public, anon, authenticated;

-- As demandas e os processos dos grupos de quem está logado: as tarefas e os compromissos ligados a eles abrem (regras de leitura).
create function privado.demandas_dos_meus_grupos() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id), '{}')
  from public.demandas d
  where d.escritorio_id = (select privado.meu_escritorio()) and d.grupos && (select privado.meus_grupos())
$$;
create function privado.processos_dos_meus_grupos() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.id), '{}')
  from public.processos p
  where p.escritorio_id = (select privado.meu_escritorio()) and p.grupos && (select privado.meus_grupos())
$$;

-- "Estou no cartão": as de antes (vejo_demanda, vejo_tarefa, vejo_processo, participo_do_compromisso) mais o grupo. Substituem as
-- antigas nas regras de alterar e nas tabelas de dentro do cartão. Item sem grupo não consulta nada a mais.
create function privado.estou_na_demanda(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_colaboradores uuid[], p_grupos uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_colaboradores)
          or case when coalesce(cardinality(p_grupos), 0) = 0 then false else p_grupos && privado.meus_grupos() end)
$$;
create function privado.estou_no_processo(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_colaboradores uuid[], p_grupos uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_colaboradores)
          or case when coalesce(cardinality(p_grupos), 0) = 0 then false else p_grupos && privado.meus_grupos() end)
$$;
create function privado.estou_na_tarefa(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_demanda uuid, p_grupos uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or case when coalesce(cardinality(p_grupos), 0) = 0 then false else p_grupos && privado.meus_grupos() end
          or exists (select 1 from public.demandas d where d.id = p_demanda
                     and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
$$;
create function privado.estou_no_compromisso(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_processo uuid, p_grupos uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or case when coalesce(cardinality(p_grupos), 0) = 0 then false else p_grupos && privado.meus_grupos() end
          or exists (select 1 from public.processos p where p.id = p_processo
                     and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos)))
$$;

-- Os grupos de um item de qualquer módulo (como privado.item_do_pedido, que não pode mudar o que devolve).
create function privado.grupos_do_item(p_modulo text, p_item uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select x.grupos from public.tarefas x where p_modulo = 'tarefas' and x.id = p_item
    union all select x.grupos from public.demandas x where p_modulo = 'demandas' and x.id = p_item
    union all select x.grupos from public.processos x where p_modulo = 'processos' and x.id = p_item
    union all select x.grupos from public.compromissos x where p_modulo = 'compromissos' and x.id = p_item
    union all select x.grupos from public.contratos x where p_modulo = 'contratos' and x.id = p_item
    union all select x.grupos from public.anotacoes x where p_modulo = 'anotacoes' and x.id = p_item
  ), '{}')
$$;
revoke execute on function privado.grupos_do_item(text, uuid) from public, anon, authenticated;

-- Os nomes dos grupos, em ordem alfabética, para o histórico dos itens ("grupo excluído" para o id que não existe mais).
create function privado.nomes_dos_grupos(p uuid[]) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(g.nome, 'grupo excluído'), ', ' order by coalesce(g.nome, 'grupo excluído'))
  from unnest(coalesce(p, '{}')) as u(id)
  left join public.grupos_da_equipe g on g.id = u.id
$$;
revoke execute on function privado.nomes_dos_grupos(uuid[]) from public, anon, authenticated;

-- 5. As funções que conferiam "estou no cartão" com as antigas passam a usar as novas, com o grupo (iguais às anteriores, salvo isso).
-- O histórico de cada item registra a mudança de grupos pelos nomes.
CREATE OR REPLACE FUNCTION privado.preparar_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v uuid[] := '{}'; x uuid; d public.demandas;
begin
  new.titulo := btrim(new.titulo);
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
    -- Confere só quem está entrando: quem já estava e saiu da equipe não trava a saída de ninguém.
    if (tg_op = 'INSERT' or x <> all(old.participantes))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;

  if new.demanda_id is null then
    new.demanda_codigo := null;
  elsif tg_op = 'INSERT' or new.demanda_id is distinct from old.demanda_id then
    select * into d from public.demandas where id = new.demanda_id and escritorio_id = new.escritorio_id;
    if d.id is null or (auth.uid() is not null
        and not privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)) then
      raise exception 'Demanda não encontrada neste escritório.';
    end if;
    new.demanda_codigo := d.codigo;
  end if;

  if new.contrato_id is null then
    new.contrato_codigo := null;
  elsif tg_op = 'INSERT' or new.contrato_id is distinct from old.contrato_id then
    select codigo into new.contrato_codigo from public.contratos where id = new.contrato_id and escritorio_id = new.escritorio_id;
    if new.contrato_codigo is null then raise exception 'Contrato não encontrado neste escritório.'; end if;
  end if;
  return new;
end $function$;

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
        and not privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos)) then
      raise exception 'Processo não encontrado neste escritório.';
    end if;
    new.processo_codigo := p.codigo;
    new.processo_numero := p.numero;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.resumo_do_tempo(p_tarefa uuid)
 RETURNS TABLE(perfil_id uuid, percentual numeric, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visivel as (
    select t.id from public.tarefas t
    where t.id = p_tarefa
      and (privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos)
           or (t.escritorio_id = privado.meu_escritorio()
               and (t.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
                    or t.demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[]))))
  ), por_pessoa as (
    select tt.perfil_id, sum(tt.segundos)::bigint as s from public.tarefa_tempos tt join visivel v on v.id = tt.tarefa_id group by tt.perfil_id
  ), soma as (select coalesce(sum(greatest(s, 0)), 0)::bigint as total from por_pessoa)
  select p.perfil_id, round(100.0 * p.s / soma.total, 1), soma.total
  from por_pessoa p, soma where p.s > 0 and soma.total > 0
  order by 2 desc
$function$;

CREATE OR REPLACE FUNCTION public.tempo_da_demanda(p_demanda uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select greatest(coalesce(sum(tt.segundos), 0), 0)::bigint
  from public.demandas d
  join public.tarefas t on t.demanda_id = d.id
  join public.tarefa_tempos tt on tt.tarefa_id = t.id
  where d.id = p_demanda
    and (privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)
         or (d.escritorio_id = privado.meu_escritorio() and d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])))
$function$;

CREATE OR REPLACE FUNCTION privado.preparar_andamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.texto := btrim(new.texto);
  new.local := nullif(btrim(new.local), '');
  -- A tarefa foi desligada (ou excluída) sem ninguém mexer na marcação: a intimação volta a ficar a tratar.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is null and new.tratada_em is not distinct from old.tratada_em then
    new.tratada_em := null;
  end if;
  if new.tratada_em is null then
    new.tratada_por := null;
  elsif tg_op = 'INSERT' or old.tratada_em is null then
    new.tratada_em := now();
    new.tratada_por := auth.uid();
  else
    new.tratada_em := old.tratada_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.preparar_prazo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.descricao := btrim(new.descricao);
  if new.concluido_em is null then
    new.concluido_por := null;
  elsif tg_op = 'INSERT' or old.concluido_em is null then
    new.concluido_em := now();
    new.concluido_por := auth.uid();
  else
    new.concluido_em := old.concluido_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  if new.andamento_id is not null and (tg_op = 'INSERT' or new.andamento_id is distinct from old.andamento_id)
     and not exists (select 1 from public.processo_andamentos a where a.id = new.andamento_id and a.processo_id = new.processo_id) then
    raise exception 'Este andamento não é deste processo.';
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.processo_ativo(p_processo uuid, p_escritorio uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.processos p where p.id = p_processo and p.escritorio_id = p_escritorio and p.arquivado_em is null
                 and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos))
$function$;

CREATE OR REPLACE FUNCTION privado.altero_a_lista(p_lista uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.demanda_listas l
                 left join public.demandas d on d.id = l.demanda_id
                 left join public.tarefas t on t.id = l.tarefa_id
                 where l.id = p_lista
                   and (l.demanda_id is null or (d.id is not null and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
                   and (l.tarefa_id is null or (t.id is not null and privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos)))
                   and (l.contrato_id is null or privado.altero_o_contrato(l.contrato_id)))
$function$;

CREATE OR REPLACE FUNCTION privado.conferir_processo_da_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.processo_id is not null
     and not exists (select 1 from public.processos p where p.id = new.processo_id and p.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos))) then
    raise exception 'Processo não encontrado neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.historico_demanda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'cliente_nome', 'contrato_codigo', 'objeto', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
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
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.demanda_historico (escritorio_id, demanda_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.historico_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'concluida_em');
    continue when vo -> k is not distinct from vn -> k;
    -- O processo excluído tira a ligação sozinho (on delete set null): sem nome dos dois lados, não há o que mostrar.
    continue when k = 'processo_id' and new.processo_id is null and privado.nome_do_processo_no_historico(old.processo_id) is null;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'demanda_id' then jsonb_build_object('demanda', jsonb_build_object('de', old.demanda_codigo, 'para', new.demanda_codigo))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object(
        'de', privado.nome_do_processo_no_historico(old.processo_id), 'para', privado.nome_do_processo_no_historico(new.processo_id)))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.historico_processo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
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
end $function$;

CREATE OR REPLACE FUNCTION privado.historico_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'processo_codigo', 'processo_numero', 'busca', 'nome_ordem', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object('de', old.processo_numero, 'para', new.processo_numero))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.compromisso_historico (escritorio_id, compromisso_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.historico_anotacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'busca', 'ligada_a', 'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'texto' then jsonb_build_object(k, jsonb_build_object('de', null, 'para', null))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pasta_id' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.caminho_da_pasta(old.pasta_id), 'para', privado.caminho_da_pasta(new.pasta_id)))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.anotacao_historico (escritorio_id, anotacao_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.historico_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'numero', 'sigla', 'ano', 'codigo', 'cliente_nome', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'objetos',
                        'participante_id', 'participante_percentual', 'cliente_id');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case
      when k = 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when k = 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when k = 'indicador_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.pessoas where id = old.indicador_id),
        'para', (select nome from public.pessoas where id = new.indicador_id)))
      when k = 'conta_destino_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.financeiro_contas where id = old.conta_destino_id and escritorio_id = new.escritorio_id),
        'para', (select nome from public.financeiro_contas where id = new.conta_destino_id and escritorio_id = new.escritorio_id)))
      when k = 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '),
        'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      when k = 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.participantes_legiveis(old.participantes),
        'para', privado.participantes_legiveis(new.participantes)))
      when k = 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.contrato_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;

-- 6. Anotações: as dos itens do grupo abrem (só para ler), como as dos itens em que a pessoa está; quem está num grupo da
-- anotação a altera. Nas listas, a condição do grupo vai escrita direto, para meus_grupos() rodar uma vez, e não uma por ligação.
create or replace function privado.anotacoes_pelos_itens() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct l.anotacao_id), '{}')
    from public.anotacao_ligacoes l
    left join public.processos p on p.id = l.processo_id
    left join public.demandas d on d.id = l.demanda_id
    left join public.tarefas t on t.id = l.tarefa_id
    left join public.compromissos c on c.id = l.compromisso_id
    left join public.contratos k on k.id = l.contrato_id
    where l.escritorio_id = (select privado.meu_escritorio())
      and ((p.id is not null and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, '{}'))
        or (p.id is not null and p.escritorio_id = (select privado.meu_escritorio()) and p.grupos && (select privado.meus_grupos()))
        or (d.id is not null and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, '{}'))
        or (d.id is not null and d.escritorio_id = (select privado.meu_escritorio())
            and (d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[]) or d.grupos && (select privado.meus_grupos())))
        or (t.id is not null and privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, '{}'))
        or (t.id is not null and t.escritorio_id = (select privado.meu_escritorio())
            and (t.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
                 or t.demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
                 or t.grupos && (select privado.meus_grupos())
                 or t.demanda_id = any ((select privado.demandas_dos_meus_grupos())::uuid[])))
        or (c.id is not null and ((c.geral and c.escritorio_id = (select privado.meu_escritorio()))
                                  or privado.estou_no_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id, '{}')
                                  or (c.escritorio_id = (select privado.meu_escritorio())
                                      and (c.grupos && (select privado.meus_grupos())
                                           or c.processo_id = any ((select privado.processos_dos_meus_grupos())::uuid[])))))
        or (k.id is not null and k.escritorio_id = (select privado.meu_escritorio())
            and ((select privado.sou_admin())
                 or (select auth.uid()) in (k.criado_por, k.responsavel_id)
                 or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
                 or k.id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[])
                 or k.grupos && (select privado.meus_grupos()))))
$$;

create or replace function privado.altero_a_anotacao(p_anotacao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.anotacoes a
    where a.id = p_anotacao and a.escritorio_id = privado.meu_escritorio() and a.arquivado_em is null
      and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (a.criado_por, a.responsavel_id) or auth.uid() = any(a.participantes)
           or case when cardinality(a.grupos) = 0 then false else a.grupos && privado.meus_grupos() end)
  )
$$;

-- 7. Contratos: quem está num grupo do contrato está nele sem os valores. Com isso, as demandas e as tarefas do contrato abrem para
-- o grupo, só para ler (#326), e ele muda o que a equipe muda na fase de adaptação (situação, objetos, clientes, serviço e código
-- antigo), nunca os valores, o responsável, a divisão ou os grupos.
create or replace function privado.contratos_em_que_estou() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(k.id), '{}')
    from public.contratos k
    where k.escritorio_id = (select privado.meu_escritorio())
      and ((select auth.uid()) in (k.criado_por, k.responsavel_id)
           or ((select privado.minha_pessoa()) is not null
               and k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa()))))
           or k.grupos && (select privado.meus_grupos()))
$$;

create or replace function public.contrato_alterar_sem_valores(p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k public.contratos;
begin
  if not privado.equipe_edita_tudo()
     and not exists (select 1 from public.contratos c where c.id = p_id and c.escritorio_id = privado.meu_escritorio()
                     and c.grupos && privado.meus_grupos()) then
    raise exception 'Você não tem permissão para fazer isso.';
  end if;
  select * into k from public.contratos c where c.id = p_id and c.escritorio_id = privado.meu_escritorio() and c.arquivado_em is null for update;
  if k.id is null then
    raise exception 'Contrato não encontrado neste escritório.';
  end if;
  update public.contratos c set
    clientes = case when p_dados ? 'clientes' then array(select v::uuid from jsonb_array_elements_text(p_dados -> 'clientes') v) else c.clientes end,
    objetos = case when p_dados ? 'objetos' then array(select jsonb_array_elements_text(p_dados -> 'objetos')) else c.objetos end,
    servico = case when p_dados ? 'servico' then p_dados ->> 'servico' else c.servico end,
    codigo_antigo = case when p_dados ? 'codigo_antigo' then p_dados ->> 'codigo_antigo' else c.codigo_antigo end,
    etapa_id = case when p_dados ? 'etapa_id' then (p_dados ->> 'etapa_id')::uuid else c.etapa_id end,
    etapa_ordem = case when p_dados ? 'etapa_ordem' then (p_dados ->> 'etapa_ordem')::double precision else c.etapa_ordem end
  where c.id = p_id
  returning c.* into k;
  if not privado.etapa_valida(k.etapa_id, 'contratos') or not privado.partes_do_escritorio(k.cliente_id, k.responsavel_id, k.participante_id, k.indicador_id) then
    raise exception 'Confira a situação e as pessoas do contrato.';
  end if;
end $$;

-- O contrato para quem é da equipe: as mesmas colunas, na mesma ordem, e os grupos no fim. Quem está só por um grupo alcança o
-- contrato sem os valores (s.parte continua sem o grupo). A view roda com os direitos de quem a criou: o "where" do escritório é a
-- única barreira, e por isso fica com security_barrier.
create or replace view public.contratos_da_equipe with (security_barrier = true) as
select k.id, k.escritorio_id, k.numero, k.sigla, k.ano, k.codigo, k.codigo_antigo, k.cliente_id, k.cliente_nome, k.clientes, k.responsavel_id,
       k.servico, k.objetos, k.participante_id, k.etapa_id, k.etapa_ordem, k.assinado_em, k.arquivado_em, k.arquivado_por,
       k.criado_por, k.criado_em, k.atualizado_por, k.atualizado_em, k.busca,
       s.parte as ve_financeiro,
       case when s.parte then k.categoria end as categoria,
       case when s.parte then k.valor end as valor,
       case when s.parte then k.entrada end as entrada,
       case when s.parte then k.parcelas end as parcelas,
       case when s.parte then k.descontos end as descontos,
       case when s.parte then k.primeiro_pagamento end as primeiro_pagamento,
       case when s.parte then k.percentual_escritorio end as percentual_escritorio,
       case when s.parte then k.participante_percentual end as participante_percentual,
       case when s.parte then k.indicador_id end as indicador_id,
       case when s.parte then k.indicador_percentual end as indicador_percentual,
       case when s.parte then k.conta_destino_id end as conta_destino_id,
       case when s.parte then k.documento_url end as documento_url,
       case when s.parte then k.observacoes end as observacoes,
       case when s.parte then k.participantes
            else coalesce((select jsonb_agg(x - 'percentual') from jsonb_array_elements(k.participantes) x), '[]'::jsonb) end as participantes,
       (select coalesce(jsonb_agg(jsonb_build_object('ordem', c.ordem, 'pessoa', jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'arquivado_em', x.arquivado_em)) order by c.ordem), '[]'::jsonb)
        from public.contrato_clientes c join public.pessoas x on x.id = c.pessoa_id where c.contrato_id = k.id) as clientela,
       (select coalesce(jsonb_agg(jsonb_build_object('ordem', c.ordem, 'percentual', case when s.parte then c.percentual end, 'pessoa', jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'arquivado_em', x.arquivado_em)) order by c.ordem), '[]'::jsonb)
        from public.contrato_participantes c join public.pessoas x on x.id = c.pessoa_id where c.contrato_id = k.id) as participacoes,
       k.grupos
from public.contratos k
cross join lateral (
  select coalesce((select privado.sou_admin())
      or (select auth.uid()) in (k.criado_por, k.responsavel_id)
      or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
      or k.id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[]), false) as parte
) s
where k.escritorio_id = (select privado.meu_escritorio())
  and (s.parte or (select privado.equipe_ve_tudo()) or k.grupos && (select privado.meus_grupos()));

-- Pôr e tirar grupos do contrato: só quem é parte por conta própria (administrador, quem criou, o responsável ou um participante da
-- divisão). O grupo não entra na divisão nem nos valores, por isso a trava da divisão não tem o que barrar. Roda como o dono do
-- banco (o gatilho do aviso não roda): o aviso de inclusão é chamado aqui.
create function privado.avisar_no_contrato(p_novo public.contratos, p_antigo public.contratos) returns void
language plpgsql security definer set search_path = '' as $$
declare v_equipe uuid[] := privado.perfis_do_contrato(p_novo.escritorio_id, p_novo.participantes);
begin
  perform privado.avisar_inclusao('contratos', p_novo.id, p_novo.escritorio_id, p_novo.responsavel_id, p_antigo.responsavel_id,
    v_equipe || privado.integrantes_dos_grupos(p_novo.escritorio_id, p_novo.grupos),
    case when p_antigo.id is not null then privado.perfis_do_contrato(p_antigo.escritorio_id, p_antigo.participantes)
                                           || privado.integrantes_dos_grupos(p_antigo.escritorio_id, p_antigo.grupos) end);
  perform privado.grupo_dos_avisos(p_novo.id, p_novo.responsavel_id, v_equipe, p_novo.grupos);
end $$;

create function public.contrato_definir_grupos(p_id uuid, p_grupos uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare k public.contratos; v_antes public.contratos;
begin
  select * into k from public.contratos c
  where c.id = p_id and c.escritorio_id = privado.meu_escritorio() and c.arquivado_em is null for update;
  if k.id is null then
    raise exception 'Contrato não encontrado neste escritório.';
  end if;
  if not (privado.sou_admin() or auth.uid() in (k.criado_por, k.responsavel_id)
          or (privado.minha_pessoa() is not null
              and k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', privado.minha_pessoa())))) then
    raise exception 'Só quem é parte do contrato põe ou tira grupos.';
  end if;
  v_antes := k;
  update public.contratos c set grupos = coalesce(p_grupos, '{}') where c.id = p_id returning c.* into k;
  perform privado.avisar_no_contrato(k, v_antes);
end $$;
revoke execute on function public.contrato_definir_grupos(uuid, uuid[]) from public, anon;
grant execute on function public.contrato_definir_grupos(uuid, uuid[]) to authenticated;

-- 8. Regras das tabelas principais: as de hoje, trocadas (sem regra a mais), com o grupo.
alter policy leitura on public.demandas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(colaboradores)
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
              or grupos && (select privado.meus_grupos())));
alter policy leitura on public.processos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(colaboradores)
              or grupos && (select privado.meus_grupos())));
alter policy leitura on public.anotacoes
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_ve_tudo()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)
              or id = any ((select privado.anotacoes_pelos_itens())::uuid[])
              or grupos && (select privado.meus_grupos())));
-- Nas tarefas e nos compromissos, o caminho pelo grupo vem antes da conferência cartão a cartão, e a lista das demandas (ou dos
-- processos) do grupo é lida com "in (select unnest(...))", que vira um hash (o "= any" de um array cresce como n·m).
alter policy leitura on public.tarefas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo()) or (select privado.equipe_ve_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
              or demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
              or grupos && (select privado.meus_grupos())
              or demanda_id in (select unnest((select privado.demandas_dos_meus_grupos())))
              or (demanda_id is not null and privado.estou_na_tarefa(escritorio_id, criado_por, responsavel_id, participantes, demanda_id, grupos))));
alter policy leitura on public.compromissos
  using ((geral and escritorio_id = (select privado.meu_escritorio()))
         or (escritorio_id = (select privado.meu_escritorio())
             and (grupos && (select privado.meus_grupos())
                  or processo_id in (select unnest((select privado.processos_dos_meus_grupos())))))
         or privado.estou_no_compromisso(escritorio_id, criado_por, responsavel_id, participantes, processo_id, grupos));
-- Quem está num grupo do item altera, como quem é posto um a um. Excluir de vez não muda (quem criou e os administradores).
alter policy alterar on public.demandas using (privado.estou_na_demanda(escritorio_id, criado_por, responsavel_id, colaboradores, grupos));
alter policy alterar on public.tarefas using (privado.estou_na_tarefa(escritorio_id, criado_por, responsavel_id, participantes, demanda_id, grupos));
alter policy alterar on public.processos using (privado.estou_no_processo(escritorio_id, criado_por, responsavel_id, colaboradores, grupos));
alter policy alterar on public.compromissos using (privado.estou_no_compromisso(escritorio_id, criado_por, responsavel_id, participantes, processo_id, grupos));
alter policy alterar on public.anotacoes
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)
              or grupos && (select privado.meus_grupos())));

-- As tabelas de dentro do cartão (etiquetas, checklists, tempo, processos e demandas ligados): as mesmas regras, com as funções novas.
alter policy apagar on public.compromisso_etiquetas
  using (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.compromissos c
  WHERE ((c.id = compromisso_etiquetas.compromisso_id) AND privado.estou_no_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id, c.grupos))))));
alter policy incluir on public.compromisso_etiquetas
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.compromissos c
  WHERE ((c.id = compromisso_etiquetas.compromisso_id) AND privado.estou_no_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id, c.grupos))))));
alter policy apagar on public.demanda_etiquetas
  using (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.demandas d
  WHERE ((d.id = demanda_etiquetas.demanda_id) AND privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))))));
alter policy incluir on public.demanda_etiquetas
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.demandas d
  WHERE ((d.id = demanda_etiquetas.demanda_id) AND privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))))));
alter policy tudo on public.demanda_listas
  using (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND ((demanda_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.demandas d
  WHERE ((d.id = demanda_listas.demanda_id) AND privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))))) AND ((tarefa_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.tarefas t
  WHERE ((t.id = demanda_listas.tarefa_id) AND privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))))) AND ((contrato_id IS NULL) OR privado.altero_o_contrato(contrato_id))))
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND ((demanda_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.demandas d
  WHERE ((d.id = demanda_listas.demanda_id) AND privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))))) AND ((tarefa_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.tarefas t
  WHERE ((t.id = demanda_listas.tarefa_id) AND privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))))) AND ((contrato_id IS NULL) OR privado.altero_o_contrato(contrato_id))));
alter policy apagar on public.processo_demandas
  using (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.processos p
  WHERE (p.id = processo_demandas.processo_id))) AND (EXISTS ( SELECT 1
   FROM public.demandas d
  WHERE ((d.id = processo_demandas.demanda_id) AND privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))))));
alter policy incluir on public.processo_demandas
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (criado_por = ( SELECT auth.uid() AS uid)) AND privado.processo_ativo(processo_id, escritorio_id) AND (EXISTS ( SELECT 1
   FROM public.demandas d
  WHERE ((d.id = processo_demandas.demanda_id) AND (d.escritorio_id = processo_demandas.escritorio_id) AND privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos))))));
alter policy apagar on public.processo_etiquetas
  using (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.processos p
  WHERE ((p.id = processo_etiquetas.processo_id) AND privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos))))));
alter policy incluir on public.processo_etiquetas
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.processos p
  WHERE ((p.id = processo_etiquetas.processo_id) AND privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, p.grupos))))));
alter policy apagar on public.tarefa_etiquetas
  using (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.tarefas t
  WHERE ((t.id = tarefa_etiquetas.tarefa_id) AND privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))))));
alter policy incluir on public.tarefa_etiquetas
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (EXISTS ( SELECT 1
   FROM public.tarefas t
  WHERE ((t.id = tarefa_etiquetas.tarefa_id) AND privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))))));
alter policy incluir on public.tarefa_tempos
  with check (((escritorio_id = ( SELECT privado.meu_escritorio() AS meu_escritorio)) AND (perfil_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.tarefas t
  WHERE ((t.id = tarefa_tempos.tarefa_id) AND privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))))));

-- 9. Menções: quem está num grupo do item pode ser mencionado nos comentários dele (no contrato, continua valendo "só advogados").
-- O comentário de contrato de quem não é parte por conta própria (pela chave ou por um grupo) nunca dá os valores a quem foi mencionado.
-- No painel de processos, "Meus" conta os processos dos grupos da pessoa.
CREATE OR REPLACE FUNCTION privado.conferir_mencoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  if new.contrato_id is not null then
    select p.nome into v_nome from public.perfis p where p.id = any(new.mencoes) and p.funcao <> 'advogado' order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % em contratos: só advogados podem ser mencionados.', v_nome;
    end if;
  end if;
  -- Na demanda: quem não é administrador, não está nela e não está no contrato dela.
  if new.demanda_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.demandas d
    where d.id = new.demanda_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from d.criado_por and p.id <> d.responsavel_id and not p.id = any(d.colaboradores)
      and not privado.perfil_no_contrato(p.id, d.contrato_id)
      and not privado.perfil_nos_grupos(d.escritorio_id, p.id, d.grupos)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta demanda: inclua essa pessoa como colaboradora antes.', v_nome;
    end if;
  end if;
  -- Na tarefa: quem não é administrador, não está nela, não vê a demanda ligada a ela e não está no contrato dela (nem no da demanda).
  if new.tarefa_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and not exists (select 1 from public.demandas d where d.id = t.demanda_id
                      and (p.id = d.criado_por or p.id = d.responsavel_id or p.id = any(d.colaboradores)
                           or privado.perfil_no_contrato(p.id, d.contrato_id)
                           or privado.perfil_nos_grupos(d.escritorio_id, p.id, d.grupos)))
      and not privado.perfil_no_contrato(p.id, t.contrato_id)
      and not privado.perfil_nos_grupos(t.escritorio_id, p.id, t.grupos)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.mencao_no_processo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.processos x
  where x.id = new.processo_id and x.escritorio_id = new.escritorio_id and p.id = any(new.mencoes)
    and not privado.equipe_ve_tudo() and not privado.equipe_edita_tudo() and p.papel not in ('master', 'admin')
    and p.id is distinct from x.criado_por and p.id <> x.responsavel_id and not p.id = any(x.colaboradores)
    and not privado.perfil_nos_grupos(x.escritorio_id, p.id, x.grupos)
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % neste processo: inclua essa pessoa como colaboradora antes.', v_nome;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.mencao_no_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.compromissos c
  where c.id = new.compromisso_id and p.id = any(new.mencoes) and not c.geral and not privado.equipe_edita_tudo() and p.papel not in ('master', 'admin')
    and p.id is distinct from c.criado_por and p.id <> c.responsavel_id and not p.id = any(c.participantes)
    and not privado.perfil_nos_grupos(c.escritorio_id, p.id, c.grupos)
    and not exists (select 1 from public.processos x where x.id = c.processo_id
                    and (p.id = x.criado_por or p.id = x.responsavel_id or p.id = any(x.colaboradores)
                         or privado.perfil_nos_grupos(x.escritorio_id, p.id, x.grupos)))
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % neste compromisso: inclua essa pessoa como participante antes.', v_nome;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.mencao_na_anotacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.anotacoes a
  where a.id = new.anotacao_id and a.escritorio_id = new.escritorio_id and p.id = any(new.mencoes)
    and not privado.equipe_ve_tudo() and not privado.equipe_edita_tudo() and p.papel not in ('master', 'admin')
    and p.id is distinct from a.criado_por and p.id <> a.responsavel_id and not p.id = any(a.participantes)
    and not privado.perfil_nos_grupos(a.escritorio_id, p.id, a.grupos)
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % nesta anotação: inclua essa pessoa como participante antes.', v_nome;
  end if;
  return null;
end $function$;

-- Quem foi mencionado num comentário de contrato estando num grupo dele: para essas pessoas, a menção não conta como "parte" (não dá
-- os valores), nem depois de saírem do grupo. O gatilho preparar_comentario preenche; o que a tela manda nessa coluna é ignorado.
-- A versão anterior do site não conhece a coluna; os comentários de antes ficam com a lista vazia e continuam valendo como hoje.
alter table public.comentarios add column mencoes_pelo_grupo uuid[] not null default '{}';

-- A de 20261109102349_equipe_ve_tudo.sql, sem a menção a quem estava num grupo do contrato.
create or replace function privado.contratos_em_que_me_mencionaram() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct c.contrato_id), '{}')
  from public.comentarios c
  where c.contrato_id is not null
    and c.mencoes @> array[auth.uid()]
    and c.escritorio_id = privado.meu_escritorio()
    and c.autor_id is distinct from auth.uid()
    and not c.autor_sem_vinculo
    and not auth.uid() = any(c.mencoes_pelo_grupo)
$$;

CREATE OR REPLACE FUNCTION privado.preparar_comentario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.texto := btrim(new.texto);
  if new.texto = '' then raise exception 'Escreva o comentário.'; end if;
  if tg_op = 'UPDATE' then new.editado_em := now(); end if;
  select coalesce(array_agg(distinct p.id), '{}') into new.mencoes
  from regexp_matches(new.texto, '(^|[^a-z0-9._-])@([a-z0-9._-]+)', 'gi') as m(partes)
  join public.perfis p on p.usuario = rtrim(lower(m.partes[2]), '.') and p.escritorio_id = new.escritorio_id and p.ativo;
  -- Quem não é parte comenta (com a chave ligada, ou por um grupo do contrato, #378), mas a menção dele não dá acesso aos valores,
  -- nem depois de a chave ser desligada ou de o grupo sair do contrato. Por isso vale com a chave ligada ou desligada.
  new.autor_sem_vinculo := new.contrato_id is not null
    and not exists (select 1 from public.contratos k where k.id = new.contrato_id
                    and (privado.sou_admin() or auth.uid() = k.criado_por or auth.uid() = k.responsavel_id
                         or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', privado.minha_pessoa()))))
    and not new.contrato_id = any(privado.contratos_em_que_me_mencionaram());
  -- Quem está num grupo do contrato ao ser mencionado (#378). Na edição, quem já estava marcado e continua mencionado segue marcado:
  -- editar o comentário depois de a pessoa sair do grupo não passa a dar os valores a ela.
  new.mencoes_pelo_grupo := case when new.contrato_id is null then '{}'::uuid[] else (
    select coalesce(array_agg(distinct m.perfil), '{}')
    from unnest(new.mencoes) as m(perfil)
    join public.contratos k on k.id = new.contrato_id
    where privado.perfil_nos_grupos(k.escritorio_id, m.perfil, k.grupos)
       or (tg_op = 'UPDATE' and m.perfil = any(old.mencoes_pelo_grupo))) end;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.painel_de_processos(p_hoje date, p_ate_prazos date, p_ate_marcados date, p_meus boolean, p_limite integer, p_ultimos integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with base as (
    select p.id, p.codigo, p.tipo, p.numero, p.titulo, p.cliente_nome, p.responsavel_id, p.colaboradores, p.clientes, p.etapa_id, p.distribuicao, p.criado_em
    from public.processos p
    where p.arquivado_em is null and (not p_meus or auth.uid() = p.responsavel_id or auth.uid() = any(p.colaboradores) or p.grupos && (select privado.meus_grupos()))
  ),
  andamentos as (
    select a.id, a.tipo, a.categoria, a.data, to_char(a.hora, 'HH24:MI') as hora, a.local, a.texto, a.tratada_em, a.tarefa_id, a.criado_em, to_jsonb(b) as processo
    from public.processo_andamentos a join base b on b.id = a.processo_id
    where a.excluido_em is null
  ),
  prazos as (
    select z.id, z.descricao, z.final, z.tarefa_id, to_jsonb(b) as processo
    from public.processo_prazos z join base b on b.id = z.processo_id
    where z.excluido_em is null and z.concluido_em is null and z.final <= p_ate_prazos
  ),
  marcados as (select * from andamentos where tipo in ('audiencia', 'pericia') and data between p_hoje and p_ate_marcados),
  intimacoes as (select * from andamentos where tipo = 'intimacao' and tratada_em is null and tarefa_id is null),
  dias as (select e.dias_processo_parado as n from public.escritorios e where e.id = privado.meu_escritorio()),
  parados as (
    select to_jsonb(b) as processo, u.ultimo, p_hoje - u.ultimo as dias
    from base b
    left join public.quadro_colunas c on c.id = b.etapa_id
    cross join lateral (
      select coalesce((select max(a.data) from public.processo_andamentos a where a.processo_id = b.id and a.excluido_em is null and a.data <= p_hoje),
                      b.distribuicao, (b.criado_em at time zone 'America/Sao_Paulo')::date) as ultimo
    ) u
    where c.marco is distinct from 'concluido' and p_hoje - u.ultimo > (select n from dias)
  )
  select jsonb_build_object(
    'prazos', coalesce((select jsonb_agg(x) from (
      (select * from prazos where final < p_hoje order by final, id limit p_limite)
      union all
      (select * from prazos where final >= p_hoje order by final, id limit p_limite)) x), '[]'),
    'total_vencidos', (select count(*) from prazos where final < p_hoje),
    'total_a_vencer', (select count(*) from prazos where final >= p_hoje),
    'marcados', coalesce((select jsonb_agg(x) from (select * from marcados order by data, hora nulls last, id limit p_limite) x), '[]'),
    'total_marcados', (select count(*) from marcados),
    'intimacoes', coalesce((select jsonb_agg(x) from (select * from intimacoes order by data, criado_em limit p_limite) x), '[]'),
    'total_intimacoes', (select count(*) from intimacoes),
    'ultimos', coalesce((select jsonb_agg(x) from (select * from andamentos where data <= p_hoje order by data desc, criado_em desc limit p_ultimos) x), '[]'),
    'parados', coalesce((select jsonb_agg(x) from (select * from parados order by dias desc limit p_limite) x), '[]'),
    'total_parados', (select count(*) from parados),
    'dias_parado', (select n from dias),
    'fases', coalesce((select jsonb_agg(x) from (select b.tipo, b.etapa_id, count(*) as n from base b group by b.tipo, b.etapa_id) x), '[]')
  )
$function$;

-- 10. Sair do cartão: quem está só por um grupo não sai sozinho (ele não está na lista do cartão); a mensagem diz por quê.
create or replace function public.cartao_sair(p_modulo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := auth.uid();
  v_escritorio uuid := privado.meu_escritorio();
  v_coluna text := case p_modulo when 'tarefas' then 'participantes' when 'compromissos' then 'participantes' when 'anotacoes' then 'participantes'
                                 when 'demandas' then 'colaboradores' when 'processos' then 'colaboradores' end;
  v_linhas integer;
  v_grupo text;
begin
  if v_coluna is null or v_escritorio is null then
    raise exception 'Você não tem permissão para fazer isso.';
  end if;
  execute format('update public.%I set %I = array_remove(%I, $1) where id = $2 and escritorio_id = $3 and $1 = any(%I)', p_modulo, v_coluna, v_coluna, v_coluna)
    using v_eu, p_id, v_escritorio;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    select g.nome into v_grupo
    from public.grupos_da_equipe g join public.grupo_integrantes i on i.grupo_id = g.id and i.perfil_id = v_eu
    where g.escritorio_id = v_escritorio and g.id = any(privado.grupos_do_item(p_modulo, p_id))
    order by g.nome limit 1;
    if v_grupo is not null then
      raise exception 'Você está neste cartão pelo grupo %. Para sair, peça a um administrador que tire você do grupo ou tire o grupo do cartão.', v_grupo;
    end if;
    raise exception 'Você não está entre as pessoas deste cartão.';
  end if;
end $$;

-- 11. O aviso da #377 para quem entra por um grupo. A equipe de cada item passa a ser a "efetiva": quem está nela por conta própria
-- e os integrantes dos grupos dele. Com isso a lógica da #377 já resolve: quem já estava (responsável, na equipe ou por outro grupo)
-- não recebe nada, quem está em dois grupos postos juntos recebe um aviso só, o desfazer em menos de 1 minuto apaga o aviso e quem
-- pôs o grupo não recebe aviso. O aviso de quem entrou só pelo grupo diz qual (o primeiro grupo do item que tem a pessoa, pelo nome).
alter table public.mensagens_de_inclusao add column grupo_id uuid references public.grupos_da_equipe on delete set null;
create index mensagens_de_inclusao_grupo on public.mensagens_de_inclusao (grupo_id) where grupo_id is not null;

create function privado.grupo_dos_avisos(p_item uuid, p_responsavel uuid, p_equipe uuid[], p_grupos uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.mensagens_de_inclusao m
     set grupo_id = case when m.perfil_id = p_responsavel or m.perfil_id = any(coalesce(p_equipe, '{}')) then null
                         else (select g.id from public.grupos_da_equipe g
                               join public.grupo_integrantes i on i.grupo_id = g.id and i.perfil_id = m.perfil_id
                               where g.id = any(coalesce(p_grupos, '{}')) order by g.nome, g.id limit 1) end
   where m.item_id = p_item and m.criado_em = now()
$$;
revoke execute on function privado.grupo_dos_avisos(uuid, uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function privado.avisar_no_contrato(public.contratos, public.contratos) from public, anon, authenticated;

create or replace function privado.inclusao_na_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('tarefas', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end,
    new.participantes || privado.integrantes_dos_grupos(new.escritorio_id, new.grupos),
    case when tg_op = 'UPDATE' then old.participantes || privado.integrantes_dos_grupos(old.escritorio_id, old.grupos) end);
  perform privado.grupo_dos_avisos(new.id, new.responsavel_id, new.participantes, new.grupos);
  return null;
end $$;
create or replace function privado.inclusao_na_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('demandas', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end,
    new.colaboradores || privado.integrantes_dos_grupos(new.escritorio_id, new.grupos),
    case when tg_op = 'UPDATE' then old.colaboradores || privado.integrantes_dos_grupos(old.escritorio_id, old.grupos) end);
  perform privado.grupo_dos_avisos(new.id, new.responsavel_id, new.colaboradores, new.grupos);
  return null;
end $$;
create or replace function privado.inclusao_no_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('processos', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end,
    new.colaboradores || privado.integrantes_dos_grupos(new.escritorio_id, new.grupos),
    case when tg_op = 'UPDATE' then old.colaboradores || privado.integrantes_dos_grupos(old.escritorio_id, old.grupos) end);
  perform privado.grupo_dos_avisos(new.id, new.responsavel_id, new.colaboradores, new.grupos);
  return null;
end $$;
create or replace function privado.inclusao_no_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('compromissos', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end,
    new.participantes || privado.integrantes_dos_grupos(new.escritorio_id, new.grupos),
    case when tg_op = 'UPDATE' then old.participantes || privado.integrantes_dos_grupos(old.escritorio_id, old.grupos) end);
  perform privado.grupo_dos_avisos(new.id, new.responsavel_id, new.participantes, new.grupos);
  return null;
end $$;
create or replace function privado.inclusao_na_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('anotacoes', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end,
    new.participantes || privado.integrantes_dos_grupos(new.escritorio_id, new.grupos),
    case when tg_op = 'UPDATE' then old.participantes || privado.integrantes_dos_grupos(old.escritorio_id, old.grupos) end);
  perform privado.grupo_dos_avisos(new.id, new.responsavel_id, new.participantes, new.grupos);
  return null;
end $$;
create or replace function privado.inclusao_no_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    perform privado.avisar_no_contrato(new, old);
  else
    perform privado.avisar_no_contrato(new, null);
  end if;
  return null;
end $$;

-- Os gatilhos rodam também quando os grupos mudam (o contrato muda os grupos só por contrato_definir_grupos, que avisa por conta própria).
drop trigger aviso_de_inclusao on public.tarefas;
create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes, grupos on public.tarefas
  for each row when (current_user = 'authenticated') execute function privado.inclusao_na_tarefa();
drop trigger aviso_de_inclusao on public.demandas;
create trigger aviso_de_inclusao after insert or update of responsavel_id, colaboradores, grupos on public.demandas
  for each row when (current_user = 'authenticated') execute function privado.inclusao_na_demanda();
drop trigger aviso_de_inclusao on public.processos;
create trigger aviso_de_inclusao after insert or update of responsavel_id, colaboradores, grupos on public.processos
  for each row when (current_user = 'authenticated') execute function privado.inclusao_no_processo();
drop trigger aviso_de_inclusao on public.compromissos;
create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes, grupos on public.compromissos
  for each row when (current_user = 'authenticated') execute function privado.inclusao_no_compromisso();
drop trigger aviso_de_inclusao on public.anotacoes;
create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes, grupos on public.anotacoes
  for each row when (current_user = 'authenticated') execute function privado.inclusao_na_anotacao();

-- A pessoa ainda faz parte do item da mensagem também quando está num grupo dele.
create or replace function public.ainda_faz_parte(m public.mensagens_de_inclusao) returns boolean
language sql stable security definer set search_path = '' as $$
  select m.perfil_id = auth.uid()
     and exists (select 1 from privado.item_do_pedido(m.modulo, m.item_id) i
                 where i.escritorio_id = m.escritorio_id
                   and (m.perfil_id = i.responsavel_id or m.perfil_id = any(i.equipe)
                        or privado.perfil_nos_grupos(i.escritorio_id, m.perfil_id, privado.grupos_do_item(m.modulo, m.item_id))))
$$;

-- 12. Quem entra num grupo depois recebe uma mensagem só, a do grupo (e não uma por item, que poderiam ser centenas). Entrar de novo
-- renova a mensagem antiga (data de agora, não lida). Sair do grupo em menos de 1 minuto (AVISO_DESFEITO em app/src/ui/tempos.ts)
-- apaga a mensagem ainda não lida: é o desfazer de quem cuida do grupo. Sair depois disso não avisa (como na #377).
create table public.mensagens_de_grupo (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  perfil_id      uuid not null references public.perfis on delete cascade,      -- quem recebe
  grupo_id       uuid not null,
  incluido_por   uuid references public.perfis on delete set null,              -- quem incluiu
  criado_em      timestamptz not null default now(),
  lido_em        timestamptz,
  constraint mensagens_de_grupo_do_grupo foreign key (grupo_id, escritorio_id)
    references public.grupos_da_equipe (id, escritorio_id) on delete cascade,
  constraint mensagens_de_grupo_uma_por_grupo unique (perfil_id, grupo_id)
);
create index mensagens_de_grupo_da_pessoa on public.mensagens_de_grupo (perfil_id, criado_em desc);
create index mensagens_de_grupo_nao_lidas on public.mensagens_de_grupo (perfil_id) where lido_em is null;
create index mensagens_de_grupo_escritorio on public.mensagens_de_grupo (escritorio_id);
create index mensagens_de_grupo_grupo on public.mensagens_de_grupo (grupo_id, escritorio_id);
create index mensagens_de_grupo_incluido_por on public.mensagens_de_grupo (incluido_por) where incluido_por is not null;
-- O mesmo desenho da caixa: cada pessoa só vê e marca como lidas as suas.
alter table public.mensagens_de_grupo enable row level security;
revoke all on public.mensagens_de_grupo from anon;
revoke insert, update, delete, truncate, references, trigger on public.mensagens_de_grupo from authenticated;
grant update (lido_em) on public.mensagens_de_grupo to authenticated;
create policy leitura on public.mensagens_de_grupo for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));
create policy alterar on public.mensagens_de_grupo for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- 13. Cuidar dos grupos: só administradores. Grupo de outro escritório responde como o que não existe, para não revelar nada.
-- O registro de ações vem dos gatilhos "auditoria" das duas tabelas.
create function privado.grupo_do_administrador(p_id uuid) returns public.grupos_da_equipe
language plpgsql security definer set search_path = '' as $$
declare g public.grupos_da_equipe;
begin
  if not privado.sou_admin() then
    raise exception 'Só um administrador cuida dos grupos.';
  end if;
  -- A trava: ninguém põe o grupo num item nem mexe nos integrantes enquanto ele muda ou é excluído.
  select * into g from public.grupos_da_equipe x where x.id = p_id and x.escritorio_id = privado.meu_escritorio() for update;
  if g.id is null then
    raise exception 'Grupo não encontrado neste escritório.';
  end if;
  return g;
end $$;
revoke execute on function privado.grupo_do_administrador(uuid) from public, anon, authenticated;

-- O nome: sem os espaços das pontas, até 60 letras (TAMANHO_GRUPO_DA_EQUIPE), único no escritório sem diferença de maiúsculas.
create function privado.conferir_nome_do_grupo(p_nome text, p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_nome text := btrim(coalesce(p_nome, ''));
begin
  if v_nome = '' then
    raise exception 'Escreva o nome do grupo.';
  end if;
  if length(v_nome) > 60 then
    raise exception 'O nome do grupo pode ter até 60 letras.';
  end if;
  if exists (select 1 from public.grupos_da_equipe g where g.escritorio_id = privado.meu_escritorio() and lower(g.nome) = lower(v_nome)
             and g.id is distinct from p_id) then
    raise exception 'Já existe um grupo com este nome.';
  end if;
  return v_nome;
end $$;
revoke execute on function privado.conferir_nome_do_grupo(text, uuid) from public, anon, authenticated;

create function public.grupo_criar(p_nome text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not privado.sou_admin() then
    raise exception 'Só um administrador cuida dos grupos.';
  end if;
  insert into public.grupos_da_equipe (escritorio_id, nome, criado_por)
  values (privado.meu_escritorio(), privado.conferir_nome_do_grupo(p_nome, null), auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Já existe um grupo com este nome.';
end $$;

create function public.grupo_renomear(p_id uuid, p_nome text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.grupo_do_administrador(p_id);
  update public.grupos_da_equipe set nome = privado.conferir_nome_do_grupo(p_nome, p_id) where id = p_id;
exception when unique_violation then
  raise exception 'Já existe um grupo com este nome.';
end $$;

-- Põe uma pessoa no grupo (a tela grava uma por vez, com o desfazer de cada uma: duas mudanças seguidas, ou dois administradores ao
-- mesmo tempo, não apagam uma à outra). Já estar no grupo não é erro. Quem entra recebe a mensagem do grupo, menos quem pôs a si mesmo.
create function public.grupo_incluir_integrante(p_id uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.grupos_da_equipe := privado.grupo_do_administrador(p_id);
begin
  insert into public.grupo_integrantes (grupo_id, perfil_id, escritorio_id, incluido_por)
  values (g.id, p_perfil, g.escritorio_id, auth.uid())
  on conflict (grupo_id, perfil_id) do nothing;
  if found and p_perfil is distinct from auth.uid() then
    insert into public.mensagens_de_grupo (escritorio_id, perfil_id, grupo_id, incluido_por)
    values (g.escritorio_id, p_perfil, g.id, auth.uid())
    on conflict (perfil_id, grupo_id) do update set criado_em = now(), lido_em = null, incluido_por = excluded.incluido_por;
  end if;
end $$;

create function public.grupo_tirar_integrante(p_id uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.grupos_da_equipe := privado.grupo_do_administrador(p_id);
begin
  delete from public.grupo_integrantes i where i.grupo_id = g.id and i.perfil_id = p_perfil;
  delete from public.mensagens_de_grupo m
  where m.grupo_id = g.id and m.perfil_id = p_perfil and m.lido_em is null and m.criado_em > now() - interval '1 minute';
end $$;

-- Em quantos itens o grupo está, por módulo, contando os arquivados (para o aviso antes de excluir).
create function public.grupo_contar_itens(p_id uuid) returns table (modulo text, quantos integer)
language plpgsql security definer set search_path = '' as $$
declare g public.grupos_da_equipe := privado.grupo_do_administrador(p_id); v_grupo uuid[] := array[g.id];
begin
  return query
  select x.modulo, x.quantos::integer from (
    select 1 as ordem, 'demandas'::text as modulo, count(*) as quantos from public.demandas where escritorio_id = g.escritorio_id and grupos @> v_grupo
    union all select 2, 'tarefas', count(*) from public.tarefas where escritorio_id = g.escritorio_id and grupos @> v_grupo
    union all select 3, 'processos', count(*) from public.processos where escritorio_id = g.escritorio_id and grupos @> v_grupo
    union all select 4, 'compromissos', count(*) from public.compromissos where escritorio_id = g.escritorio_id and grupos @> v_grupo
    union all select 5, 'contratos', count(*) from public.contratos where escritorio_id = g.escritorio_id and grupos @> v_grupo
    union all select 6, 'anotacoes', count(*) from public.anotacoes where escritorio_id = g.escritorio_id and grupos @> v_grupo
  ) x where x.quantos > 0 order by x.ordem;
end $$;

-- Excluir o grupo: sai de todos os itens (também dos arquivados; o histórico de cada um registra a saída), depois some com os
-- integrantes e as mensagens do grupo; o grupo_id dos avisos de inclusão fica vazio. Não dá para desfazer.
create function public.grupo_excluir(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.grupos_da_equipe := privado.grupo_do_administrador(p_id); v_grupo uuid[] := array[g.id];
begin
  update public.demandas set grupos = array_remove(grupos, g.id) where escritorio_id = g.escritorio_id and grupos @> v_grupo;
  update public.tarefas set grupos = array_remove(grupos, g.id) where escritorio_id = g.escritorio_id and grupos @> v_grupo;
  update public.processos set grupos = array_remove(grupos, g.id) where escritorio_id = g.escritorio_id and grupos @> v_grupo;
  update public.compromissos set grupos = array_remove(grupos, g.id) where escritorio_id = g.escritorio_id and grupos @> v_grupo;
  update public.contratos set grupos = array_remove(grupos, g.id) where escritorio_id = g.escritorio_id and grupos @> v_grupo;
  update public.anotacoes set grupos = array_remove(grupos, g.id) where escritorio_id = g.escritorio_id and grupos @> v_grupo;
  delete from public.grupos_da_equipe where id = g.id;
end $$;

revoke execute on function public.grupo_criar(text) from public, anon;
revoke execute on function public.grupo_renomear(uuid, text) from public, anon;
revoke execute on function public.grupo_incluir_integrante(uuid, uuid) from public, anon;
revoke execute on function public.grupo_tirar_integrante(uuid, uuid) from public, anon;
revoke execute on function public.grupo_contar_itens(uuid) from public, anon;
revoke execute on function public.grupo_excluir(uuid) from public, anon;
grant execute on function public.grupo_criar(text) to authenticated;
grant execute on function public.grupo_renomear(uuid, text) to authenticated;
grant execute on function public.grupo_incluir_integrante(uuid, uuid) to authenticated;
grant execute on function public.grupo_tirar_integrante(uuid, uuid) to authenticated;
grant execute on function public.grupo_contar_itens(uuid) to authenticated;
grant execute on function public.grupo_excluir(uuid) to authenticated;

-- 14. Quem é excluído da equipe (excluir_usuario) sai dos grupos e perde as mensagens deles. Quem é desativado continua no grupo,
-- mas sem acesso (meus_grupos() fica vazio e os avisos não o contam); reativado, volta a participar.
create function privado.grupos_de_quem_saiu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.grupo_integrantes i where i.perfil_id = new.id;
  delete from public.mensagens_de_grupo m where m.perfil_id = new.id;
  return null;
end $$;
revoke execute on function privado.grupos_de_quem_saiu() from public, anon, authenticated;
create trigger grupos_de_quem_saiu after update of excluido_em on public.perfis
  for each row when (old.excluido_em is null and new.excluido_em is not null) execute function privado.grupos_de_quem_saiu();

-- 15. As funções novas que as regras de leitura e de alterar chamam rodam como quem está logado; as outras, só dentro do banco.
revoke execute on function privado.meus_grupos() from public, anon;
revoke execute on function privado.demandas_dos_meus_grupos() from public, anon;
revoke execute on function privado.processos_dos_meus_grupos() from public, anon;
revoke execute on function privado.estou_na_demanda(uuid, uuid, uuid, uuid[], uuid[]) from public, anon;
revoke execute on function privado.estou_no_processo(uuid, uuid, uuid, uuid[], uuid[]) from public, anon;
revoke execute on function privado.estou_na_tarefa(uuid, uuid, uuid, uuid[], uuid, uuid[]) from public, anon;
revoke execute on function privado.estou_no_compromisso(uuid, uuid, uuid, uuid[], uuid, uuid[]) from public, anon;
grant execute on function privado.meus_grupos() to authenticated;
grant execute on function privado.demandas_dos_meus_grupos() to authenticated;
grant execute on function privado.processos_dos_meus_grupos() to authenticated;
grant execute on function privado.estou_na_demanda(uuid, uuid, uuid, uuid[], uuid[]) to authenticated;
grant execute on function privado.estou_no_processo(uuid, uuid, uuid, uuid[], uuid[]) to authenticated;
grant execute on function privado.estou_na_tarefa(uuid, uuid, uuid, uuid[], uuid, uuid[]) to authenticated;
grant execute on function privado.estou_no_compromisso(uuid, uuid, uuid, uuid[], uuid, uuid[]) to authenticated;

-- 16. O filtro "Grupo da equipe" em Tarefas: as tarefas que têm um dos grupos e as das demandas que têm um deles (a tarefa vista
-- pelo grupo da demanda não some com o filtro). Roda como quem chama: as regras de leitura das duas tabelas valem, e a tela filtra,
-- ordena e pagina o resultado como a tabela.
create function public.tarefas_dos_grupos(p_grupos uuid[]) returns setof public.tarefas
language sql stable set search_path = '' as $$
  select t.* from public.tarefas t
  where t.grupos && p_grupos
     or t.demanda_id in (select d.id from public.demandas d where d.grupos && p_grupos)
$$;
revoke execute on function public.tarefas_dos_grupos(uuid[]) from public, anon;
grant execute on function public.tarefas_dos_grupos(uuid[]) to authenticated;
