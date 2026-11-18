-- =====================================================================
-- Pedir para participar de um item de que ainda não faço parte (#363)
--   Quando a visualização fechar (cada um vê só os itens de que faz parte), quem precisa entrar num item que já existe pede para
--   participar. Vale para tarefas, demandas, processos, compromissos, contratos e anotações.
--   - Achar o item: só pela busca geral, pelo código exato ou pelo número inteiro do processo. Volta só o tipo e o código (nada do
--     título, dos clientes ou do conteúdo), só do escritório de quem busca e só dos itens que a pessoa ainda não vê (quem vê já acha
--     pela busca de sempre). A busca é feita em duas partes: privado.itens_pelo_codigo (security definer) acha os itens do escritório
--     pelo código, e public.itens_para_pedir (com os direitos de quem chama) tira os que a pessoa já vê, pelas regras de leitura de
--     cada módulo (RLS e a view contratos_da_equipe). Assim "quem vê" é sempre a regra de cada módulo, sem uma cópia dela aqui.
--   - O contrato é diferente: o código dele (SIGLA-NNNN-ANO) dá para adivinhar, contando o número. Por isso o contrato só é achado
--     por quem está numa demanda ou tarefa ligada a ele (que já mostra o código do contrato a quem está nela): contar 0001, 0002…
--     não lista os contratos do escritório. O indicador do contrato não pede: ele não entra na divisão como participante.
--   - Aprovam: qualquer administrador do escritório, o responsável e quem criou o item. O pedido chega na caixa de Mensagens de todos
--     eles; o primeiro que responde resolve, e o pedido sai da caixa dos outros. Quem pediu recebe a resposta na caixa dele.
--   - Aprovado, a pessoa entra como participante (colaborador na demanda e no processo; no contrato, com 0%, decisão do dono na #356),
--     pela mesma coluna que o lápis grava: o gatilho de histórico registra a mudança, como no lápis. A resposta (aprovado ou recusado)
--     também entra no histórico do item, numa linha própria, com o nome de quem pediu.
--   - Um pedido pendente por pessoa e item; quem pediu pode cancelar. Recusado ou cancelado, pode pedir de novo.
--   - Aprovar confere de novo o que o pedir conferiu: item arquivado ou módulo desligado não recebem ninguém (o pedido pode ser
--     recusado). No contrato com parcelas, só um administrador aprova (é a trava da divisão, que o lápis também segue).
--   - E-mail: as menções da caixa de Mensagens não geram e-mail (só os avisos de prazo têm rotina de e-mail). O pedido segue as menções.
-- Só acrescenta: duas tabelas, funções e um gatilho novos. Nenhuma tabela, coluna, regra ou função que já existia muda.
-- As mensagens do pedido ficam numa tabela própria (mensagens_de_participacao), com o mesmo desenho da caixa (mensagens): a versão
-- anterior do site lê a tabela mensagens e não conhece outro tipo (a tela dela quebraria com um tipo novo); com a tabela própria,
-- ela continua igual e só não mostra os pedidos.
-- =====================================================================

-- 1. O que cada módulo guarda, num lugar só: a coluna da equipe, quantos cabem nela (as mesmas regras check das tabelas:
-- COLABORADORES_MAXIMOS e PARTICIPANTES_MAXIMOS em app/src/dados/limites.ts), o aviso de lista cheia e o histórico.
create function privado.modulo_do_pedido(p_modulo text)
returns table (coluna text, maximo integer, cheia text, historico text, coluna_do_historico text)
language sql immutable set search_path = '' as $$
  select m.coluna, m.maximo, m.cheia, m.historico, m.coluna_do_historico
  from (values
    ('tarefas', 'participantes', 20, 'Uma tarefa pode ter até 20 participantes.', 'tarefa_historico', 'tarefa_id'),
    ('demandas', 'colaboradores', 20, 'Uma demanda pode ter até 20 colaboradores.', 'demanda_historico', 'demanda_id'),
    ('processos', 'colaboradores', 20, 'Um processo pode ter até 20 colaboradores.', 'processo_historico', 'processo_id'),
    ('compromissos', 'participantes', 20, 'Um compromisso pode ter até 20 participantes.', 'compromisso_historico', 'compromisso_id'),
    ('anotacoes', 'participantes', 20, 'Uma anotação pode ser compartilhada com até 20 pessoas.', 'anotacao_historico', 'anotacao_id'),
    ('contratos', 'participantes', 10, 'Um contrato pode ter até 10 participantes.', 'contrato_historico', 'contrato_id')
  ) as m(modulo, coluna, maximo, cheia, historico, coluna_do_historico)
  where m.modulo = p_modulo
$$;
revoke execute on function privado.modulo_do_pedido(text) from public, anon, authenticated;

-- 2. O item de qualquer módulo, num formato só: o escritório, o código, quem criou, o responsável, a equipe (os perfis; no contrato,
-- os perfis das pessoas participantes) e se está arquivado. Só para as funções abaixo.
create function privado.item_do_pedido(p_modulo text, p_item uuid)
returns table (escritorio_id uuid, codigo text, criado_por uuid, responsavel_id uuid, equipe uuid[], arquivado boolean)
language sql stable security definer set search_path = '' as $$
  select x.escritorio_id, x.codigo, x.criado_por, x.responsavel_id, x.participantes, x.arquivado_em is not null
  from public.tarefas x where p_modulo = 'tarefas' and x.id = p_item
  union all
  select x.escritorio_id, x.codigo, x.criado_por, x.responsavel_id, x.colaboradores, x.arquivado_em is not null
  from public.demandas x where p_modulo = 'demandas' and x.id = p_item
  union all
  select x.escritorio_id, x.codigo, x.criado_por, x.responsavel_id, x.colaboradores, x.arquivado_em is not null
  from public.processos x where p_modulo = 'processos' and x.id = p_item
  union all
  select x.escritorio_id, x.codigo, x.criado_por, x.responsavel_id, x.participantes, x.arquivado_em is not null
  from public.compromissos x where p_modulo = 'compromissos' and x.id = p_item
  union all
  select x.escritorio_id, x.codigo, x.criado_por, x.responsavel_id, x.participantes, x.arquivado_em is not null
  from public.anotacoes x where p_modulo = 'anotacoes' and x.id = p_item
  union all
  select k.escritorio_id, k.codigo, k.criado_por, k.responsavel_id,
         array(select f.id from jsonb_array_elements(k.participantes) e
               join public.perfis f on f.pessoa_id = (e ->> 'pessoa_id')::uuid and f.escritorio_id = k.escritorio_id),
         k.arquivado_em is not null
  from public.contratos k where p_modulo = 'contratos' and k.id = p_item
$$;
revoke execute on function privado.item_do_pedido(text, uuid) from public, anon, authenticated;

-- 3. Quem está logado aprova pedidos deste item: um administrador do escritório, o responsável ou quem criou. A regra de leitura dos
-- pedidos usa esta função (por isso ela fica liberada para quem está logado).
create function privado.aprovo_o_pedido(p_modulo text, p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.item_do_pedido(p_modulo, p_item) i
                 where i.escritorio_id = privado.meu_escritorio()
                   and (privado.sou_admin() or auth.uid() in (i.criado_por, i.responsavel_id)))
$$;
revoke execute on function privado.aprovo_o_pedido(text, uuid) from public, anon;
grant execute on function privado.aprovo_o_pedido(text, uuid) to authenticated;

-- 4. Quem recebe o pedido na caixa: os administradores ativos do escritório, o responsável e quem criou (se ainda ativos), sem repetir.
-- A conta reservada não entra no sistema: não recebe.
create function privado.aprovadores_do_pedido(p_modulo text, p_item uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select f.id
  from privado.item_do_pedido(p_modulo, p_item) i
  join public.perfis f on f.escritorio_id = i.escritorio_id
  where f.ativo and not f.reservada and f.excluido_em is null
    and (f.papel in ('master', 'admin') or f.id in (i.criado_por, i.responsavel_id))
$$;
revoke execute on function privado.aprovadores_do_pedido(text, uuid) from public, anon, authenticated;

-- 5. Os pedidos. Uma coluna por módulo, cada uma com a sua chave estrangeira (como os avisos de prazo na caixa de mensagens): o item
-- apagado leva os pedidos dele. item_id junta as seis, para a busca e para a regra de um pendente por pessoa e item.
-- item_codigo guarda o código: quem pediu não vê o item, e a resposta na caixa dele mostra o tipo e o código.
create table public.pedidos_de_participacao (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  modulo         text not null check (modulo in ('tarefas', 'demandas', 'processos', 'compromissos', 'contratos', 'anotacoes')),
  tarefa_id      uuid references public.tarefas on delete cascade,
  demanda_id     uuid references public.demandas on delete cascade,
  processo_id    uuid references public.processos on delete cascade,
  compromisso_id uuid references public.compromissos on delete cascade,
  contrato_id    uuid references public.contratos on delete cascade,
  anotacao_id    uuid references public.anotacoes on delete cascade,
  item_id        uuid generated always as (coalesce(tarefa_id, demanda_id, processo_id, compromisso_id, contrato_id, anotacao_id)) stored,
  item_codigo    text not null,
  pedido_por     uuid not null references public.perfis on delete cascade,
  situacao       text not null default 'pendente' check (situacao in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  respondido_por uuid references public.perfis on delete set null,
  criado_em      timestamptz not null default now(),
  respondido_em  timestamptz,
  -- O item é o do módulo: só a coluna dele vem preenchida.
  constraint pedidos_item_do_modulo check (
    (modulo = 'tarefas') = (tarefa_id is not null) and (modulo = 'demandas') = (demanda_id is not null)
    and (modulo = 'processos') = (processo_id is not null) and (modulo = 'compromissos') = (compromisso_id is not null)
    and (modulo = 'contratos') = (contrato_id is not null) and (modulo = 'anotacoes') = (anotacao_id is not null)),
  -- Pendente não tem resposta; cancelado é de quem pediu (sem quem respondeu).
  constraint pedidos_resposta check ((situacao = 'pendente') = (respondido_em is null)
    and (situacao in ('aprovado', 'recusado') or respondido_por is null))
);
create unique index pedidos_um_pendente_por_item on public.pedidos_de_participacao (pedido_por, item_id) where situacao = 'pendente';
create index pedidos_do_item on public.pedidos_de_participacao (item_id);
create index pedidos_escritorio on public.pedidos_de_participacao (escritorio_id);
create index pedidos_respondido_por on public.pedidos_de_participacao (respondido_por) where respondido_por is not null;
create index pedidos_tarefa on public.pedidos_de_participacao (tarefa_id) where tarefa_id is not null;
create index pedidos_demanda on public.pedidos_de_participacao (demanda_id) where demanda_id is not null;
create index pedidos_processo on public.pedidos_de_participacao (processo_id) where processo_id is not null;
create index pedidos_compromisso on public.pedidos_de_participacao (compromisso_id) where compromisso_id is not null;
create index pedidos_contrato on public.pedidos_de_participacao (contrato_id) where contrato_id is not null;
create index pedidos_anotacao on public.pedidos_de_participacao (anotacao_id) where anotacao_id is not null;

alter table public.pedidos_de_participacao enable row level security;
revoke all on public.pedidos_de_participacao from anon;
revoke insert, update, delete on public.pedidos_de_participacao from authenticated;
-- Quem pediu vê os seus; quem aprova vê os do item. Ninguém de outro escritório. Quem grava são as funções abaixo.
create policy leitura on public.pedidos_de_participacao for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (pedido_por = (select auth.uid()) or privado.aprovo_o_pedido(modulo, item_id)));

-- 6. As mensagens do pedido, na caixa de cada um: 'pedido' (para quem aprova) e 'resposta' (para quem pediu). O mesmo desenho da
-- tabela mensagens: cada pessoa só vê e marca como lidas as suas, e só a data de leitura muda pela tela.
create table public.mensagens_de_participacao (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid not null references public.perfis on delete cascade,   -- quem recebe
  pedido_id     uuid not null references public.pedidos_de_participacao on delete cascade,
  tipo          text not null check (tipo in ('pedido', 'resposta')),
  criado_em     timestamptz not null default now(),
  lido_em       timestamptz,
  unique (perfil_id, pedido_id, tipo)
);
create index mensagens_de_participacao_da_pessoa on public.mensagens_de_participacao (perfil_id, criado_em desc);
create index mensagens_de_participacao_nao_lidas on public.mensagens_de_participacao (perfil_id) where lido_em is null;
create index mensagens_de_participacao_do_pedido on public.mensagens_de_participacao (pedido_id);
create index mensagens_de_participacao_escritorio on public.mensagens_de_participacao (escritorio_id);

alter table public.mensagens_de_participacao enable row level security;
revoke all on public.mensagens_de_participacao from anon;
revoke insert, update, delete on public.mensagens_de_participacao from authenticated;
grant update (lido_em) on public.mensagens_de_participacao to authenticated;
create policy leitura on public.mensagens_de_participacao for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));
create policy alterar on public.mensagens_de_participacao for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- 7. A busca pelo código. Primeiro, os itens ativos do escritório de quem busca, de módulo ligado, cujo código é exatamente o
-- digitado ou, nos processos, cujo número inteiro (só letras e algarismos, como a regra processos_numero_unico) é o número digitado.
-- Volta só o módulo, o grupo da busca geral (o tipo do processo: judiciais ou administrativos), o id e o código. "numero" é o próprio
-- número digitado, e só quando foi ele que achou o processo (a tela confere a busca por ele; pelo código, o número não sai daqui).
create function privado.itens_pelo_codigo(p_termo text)
returns table (modulo text, grupo text, id uuid, codigo text, numero text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_escritorio uuid := privado.meu_escritorio();
  v_modulos jsonb;
  v_codigo text := upper(btrim(coalesce(p_termo, '')));
  -- O número do processo, como a regra processos_numero_unico o compara: só letras e algarismos, em maiúsculas (a patente do INPI
  -- tem letras: BR 10 2020 012345-6). Só quando o termo tem algum algarismo (como podeSerOCodigo, em app/src/regras/buscaGeral.ts).
  v_numero text := case when coalesce(p_termo, '') ~ '[0-9]' then regexp_replace(upper(p_termo), '[^A-Z0-9]', '', 'g') end;
begin
  if v_escritorio is null or v_codigo = '' then
    return;
  end if;
  select e.modulos into v_modulos from public.escritorios e where e.id = v_escritorio;
  return query
    select 'tarefas'::text, 'tarefas'::text, x.id, x.codigo, null::text from public.tarefas x
    where v_modulos ->> 'tarefas' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    select 'demandas', 'demandas', x.id, x.codigo, null from public.demandas x
    where v_modulos ->> 'demandas' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    select 'compromissos', 'compromissos', x.id, x.codigo, null from public.compromissos x
    where v_modulos ->> 'compromissos' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    select 'anotacoes', 'anotacoes', x.id, x.codigo, null from public.anotacoes x
    where v_modulos ->> 'anotacoes' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
    union all
    -- O indicador não entra na divisão como participante: o contrato não lhe é oferecido.
    select 'contratos', 'contratos', x.id, x.codigo, null from public.contratos x
    where v_modulos ->> 'contratos' = 'true' and x.escritorio_id = v_escritorio and x.codigo = v_codigo and x.arquivado_em is null
      and (x.indicador_id is null or x.indicador_id is distinct from privado.minha_pessoa())
    union all
    select 'processos', case x.tipo when 'judicial' then 'judiciais' else 'administrativos' end, x.id, x.codigo,
           case when x.codigo = v_codigo then null else v_numero end
    from public.processos x
    where v_modulos ->> 'processos' = 'true' and x.escritorio_id = v_escritorio and x.arquivado_em is null
      and (x.codigo = v_codigo or (v_numero <> '' and regexp_replace(upper(coalesce(x.numero, '')), '[^A-Z0-9]', '', 'g') = v_numero));
end $$;
revoke execute on function privado.itens_pelo_codigo(text) from public, anon;
grant execute on function privado.itens_pelo_codigo(text) to authenticated;

-- Depois, com os direitos de quem chama: fora os itens que a pessoa já vê (pelas regras de leitura de cada módulo). Vem junto o
-- pedido pendente dela, se houver, para a tela mostrar "Pedido enviado · Cancelar". O contrato, cujo código dá para adivinhar, só
-- vem para quem vê uma demanda ou tarefa ligada a ele (também pelas regras de leitura delas).
create function public.itens_para_pedir(p_termo text)
returns table (modulo text, grupo text, id uuid, codigo text, numero text, pedido_id uuid)
language sql stable security invoker set search_path = '' as $$
  select c.modulo, c.grupo, c.id, c.codigo, c.numero,
         (select p.id from public.pedidos_de_participacao p
          where p.item_id = c.id and p.pedido_por = (select auth.uid()) and p.situacao = 'pendente')
  from privado.itens_pelo_codigo(p_termo) c
  where not case c.modulo
    when 'tarefas' then exists (select 1 from public.tarefas x where x.id = c.id)
    when 'demandas' then exists (select 1 from public.demandas x where x.id = c.id)
    when 'processos' then exists (select 1 from public.processos x where x.id = c.id)
    when 'compromissos' then exists (select 1 from public.compromissos x where x.id = c.id)
    when 'anotacoes' then exists (select 1 from public.anotacoes x where x.id = c.id)
    when 'contratos' then exists (select 1 from public.contratos_da_equipe x where x.id = c.id)
  end
  and (c.modulo <> 'contratos'
       or exists (select 1 from public.demandas d where d.contrato_id = c.id)
       or exists (select 1 from public.tarefas t where t.contrato_id = c.id))
$$;
revoke execute on function public.itens_para_pedir(text) from public, anon;
grant execute on function public.itens_para_pedir(text) to authenticated;

-- 8. Pedir. Confere tudo aqui: o item do escritório, ativo e de módulo ligado; a pessoa ainda fora dele; um pendente por vez.
create function public.participacao_pedir(p_modulo text, p_item uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := auth.uid();
  v_escritorio uuid := privado.meu_escritorio();
  i record;
  v_id uuid;
begin
  select * into i from privado.item_do_pedido(p_modulo, p_item);
  if v_escritorio is null or i.escritorio_id is distinct from v_escritorio or i.arquivado
     or (select e.modulos ->> p_modulo from public.escritorios e where e.id = v_escritorio) is distinct from 'true' then
    raise exception 'Item não encontrado neste escritório.';
  end if;
  if privado.sou_admin() or v_eu in (i.criado_por, i.responsavel_id) or v_eu = any(i.equipe) then
    raise exception 'Você já faz parte deste item.';
  end if;
  if p_modulo = 'contratos' and privado.minha_pessoa() is null then
    raise exception 'Seu usuário não tem um cadastro de pessoa: peça a um administrador para incluir você no contrato.';
  end if;
  if p_modulo = 'contratos' and exists (select 1 from public.contratos k where k.id = p_item and k.indicador_id = privado.minha_pessoa()) then
    raise exception 'Você é o indicador deste contrato: o indicador não entra na divisão como participante.';
  end if;
  insert into public.pedidos_de_participacao (escritorio_id, modulo, tarefa_id, demanda_id, processo_id, compromisso_id, contrato_id, anotacao_id, item_codigo, pedido_por)
  values (v_escritorio, p_modulo,
          case when p_modulo = 'tarefas' then p_item end, case when p_modulo = 'demandas' then p_item end,
          case when p_modulo = 'processos' then p_item end, case when p_modulo = 'compromissos' then p_item end,
          case when p_modulo = 'contratos' then p_item end, case when p_modulo = 'anotacoes' then p_item end,
          i.codigo, v_eu)
  on conflict (pedido_por, item_id) where situacao = 'pendente' do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'Você já pediu para participar deste item. Aguarde a resposta ou cancele o pedido.';
  end if;
  insert into public.mensagens_de_participacao (escritorio_id, perfil_id, pedido_id, tipo)
  select v_escritorio, a.perfil, v_id, 'pedido'
  from privado.aprovadores_do_pedido(p_modulo, p_item) a(perfil)
  where a.perfil <> v_eu;
  return v_id;
end $$;
revoke execute on function public.participacao_pedir(text, uuid) from public, anon;
grant execute on function public.participacao_pedir(text, uuid) to authenticated;

-- 9. Cancelar: só quem pediu, só o pendente. O pedido sai da caixa de quem aprovaria.
create function public.participacao_cancelar(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_de_participacao;
begin
  select * into p from public.pedidos_de_participacao x
  where x.id = p_pedido and x.escritorio_id = privado.meu_escritorio() and x.pedido_por = auth.uid()
  for update;
  if p.id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.situacao <> 'pendente' then
    raise exception 'Este pedido já foi respondido.';
  end if;
  update public.pedidos_de_participacao set situacao = 'cancelado', respondido_em = now() where id = p.id;
  delete from public.mensagens_de_participacao m where m.pedido_id = p.id and m.tipo = 'pedido';
end $$;
revoke execute on function public.participacao_cancelar(uuid) from public, anon;
grant execute on function public.participacao_cancelar(uuid) to authenticated;

-- 10. Pôr quem pediu no item, na coluna que o lápis grava (o gatilho de histórico registra a mudança, com quem aprovou). No contrato,
-- a pessoa entra na divisão com 0%: a parte de cada um continua sendo decidida no lápis. As regras check e os gatilhos de cada tabela
-- continuam valendo (o indicador não entra como participante, por exemplo). A trava da divisão (privado.trava_da_divisao) só roda
-- para quem está logado, e esta função roda como o dono do banco: por isso ela é conferida aqui, com a mesma regra e a mesma frase.
-- Quem já entrou por outro caminho fica como está.
create function privado.por_no_item(p_modulo text, p_item uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_pessoa uuid;
  v_quantos integer;
begin
  select * into m from privado.modulo_do_pedido(p_modulo);
  if not exists (select 1 from public.perfis f where f.id = p_perfil and f.ativo and f.excluido_em is null) then
    raise exception 'Quem pediu não está mais ativo na equipe.';
  end if;
  if p_modulo = 'contratos' then
    select f.pessoa_id into v_pessoa from public.perfis f where f.id = p_perfil;
    if v_pessoa is null then
      raise exception 'Quem pediu não tem um cadastro de pessoa para entrar no contrato.';
    end if;
    select jsonb_array_length(k.participantes) into v_quantos from public.contratos k where k.id = p_item for update;
    if exists (select 1 from public.contratos k where k.id = p_item and k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', v_pessoa))) then
      return;
    end if;
    if v_quantos >= m.maximo then
      raise exception '%', m.cheia;
    end if;
    -- A trava da divisão: com o financeiro ligado, o contrato com parcelas (contando as excluídas) só muda por um administrador.
    if not privado.sou_admin()
       and coalesce((select (e.modulos ->> 'financeiro')::boolean from public.escritorios e join public.contratos k on k.escritorio_id = e.id
                     where k.id = p_item), false)
       and exists (select 1 from public.contrato_parcelas cp where cp.contrato_id = p_item) then
      raise exception 'Este contrato tem parcelas: só um administrador muda a divisão.';
    end if;
    update public.contratos k set participantes = k.participantes || jsonb_build_array(jsonb_build_object('pessoa_id', v_pessoa, 'percentual', 0))
    where k.id = p_item;
    return;
  end if;
  execute format('select cardinality(%I) from public.%I where id = $1 and not ($2 = any(%I) or responsavel_id = $2) for update', m.coluna, p_modulo, m.coluna)
    into v_quantos using p_item, p_perfil;
  if v_quantos is null then
    return;
  end if;
  if v_quantos >= m.maximo then
    raise exception '%', m.cheia;
  end if;
  execute format('update public.%I set %I = %I || $2 where id = $1', p_modulo, m.coluna, m.coluna) using p_item, p_perfil;
end $$;
revoke execute on function privado.por_no_item(text, uuid, uuid) from public, anon, authenticated;

-- 11. Responder. O primeiro que responde resolve: a trava da linha faz o segundo esperar e então ver "já respondido".
create function public.participacao_responder(p_pedido uuid, p_aprovar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.pedidos_de_participacao;
  m record;
  i record;
  v_situacao text := case when p_aprovar then 'aprovado' else 'recusado' end;
begin
  select * into p from public.pedidos_de_participacao x where x.id = p_pedido and x.escritorio_id = privado.meu_escritorio() for update;
  if p.id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.pedido_por = auth.uid() or not privado.aprovo_o_pedido(p.modulo, p.item_id) then
    raise exception 'Só um administrador, o responsável ou quem criou o item responde a este pedido.';
  end if;
  if p.situacao = 'cancelado' then
    raise exception 'Este pedido foi cancelado por quem pediu.';
  end if;
  if p.situacao <> 'pendente' then
    raise exception 'Este pedido já foi respondido.';
  end if;
  if p_aprovar then
    -- O que o pedir conferiu vale também ao aprovar: o item pode ter sido arquivado, ou o módulo desligado, depois do pedido.
    -- Recusar continua possível (o pedido sai da caixa de todos e quem pediu é avisado).
    select * into i from privado.item_do_pedido(p.modulo, p.item_id);
    if i.arquivado then
      raise exception 'Este item foi arquivado: ele não recebe participantes. Recuse o pedido ou desarquive o item antes.';
    end if;
    if (select e.modulos ->> p.modulo from public.escritorios e where e.id = p.escritorio_id) is distinct from 'true' then
      raise exception 'O módulo deste item está desligado no escritório: ele não recebe participantes.';
    end if;
    perform privado.por_no_item(p.modulo, p.item_id, p.pedido_por);
  end if;
  update public.pedidos_de_participacao set situacao = v_situacao, respondido_por = auth.uid(), respondido_em = now() where id = p.id;
  -- A resposta no histórico do item: "pedido_aprovado" ou "pedido_recusado", com o nome de quem pediu (como os nomes da equipe).
  select * into m from privado.modulo_do_pedido(p.modulo);
  execute format('insert into public.%I (escritorio_id, %I, alteracoes, feito_por) values ($1, $2, $3, $4)', m.historico, m.coluna_do_historico)
    using p.escritorio_id, p.item_id,
          jsonb_build_object('pedido_' || v_situacao, jsonb_build_object('de', null, 'para', (select f.nome from public.perfis f where f.id = p.pedido_por))),
          auth.uid();
  delete from public.mensagens_de_participacao x where x.pedido_id = p.id and x.tipo = 'pedido';
  insert into public.mensagens_de_participacao (escritorio_id, perfil_id, pedido_id, tipo)
  values (p.escritorio_id, p.pedido_por, p.id, 'resposta')
  on conflict (perfil_id, pedido_id, tipo) do nothing;
end $$;
revoke execute on function public.participacao_responder(uuid, boolean) from public, anon;
grant execute on function public.participacao_responder(uuid, boolean) to authenticated;

-- 12. Quem é excluído da equipe (excluir_usuario) perde o que só servia a ele: as mensagens de pedido, e os pedidos pendentes dele
-- são cancelados (saem da caixa de quem aprovaria).
create function privado.pedidos_de_quem_saiu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mensagens_de_participacao m where m.perfil_id = new.id;
  delete from public.mensagens_de_participacao m
  where m.tipo = 'pedido' and m.pedido_id in (select p.id from public.pedidos_de_participacao p where p.pedido_por = new.id and p.situacao = 'pendente');
  update public.pedidos_de_participacao p set situacao = 'cancelado', respondido_em = now() where p.pedido_por = new.id and p.situacao = 'pendente';
  return null;
end $$;
revoke execute on function privado.pedidos_de_quem_saiu() from public, anon, authenticated;
create trigger pedidos_de_quem_saiu after update of excluido_em on public.perfis
  for each row when (old.excluido_em is null and new.excluido_em is not null) execute function privado.pedidos_de_quem_saiu();
