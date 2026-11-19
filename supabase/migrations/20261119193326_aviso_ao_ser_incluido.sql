-- =====================================================================
-- Aviso na caixa de Mensagens para quem entra num item (#377)
--   Quando alguém da equipe põe outra pessoa como responsável ou participante de uma tarefa, demanda, processo, compromisso,
--   contrato ou anotação, a pessoa incluída recebe uma mensagem na caixa dela, com o link do item. Só a caixa, sem e-mail (como as
--   menções e os pedidos para participar).
--
--   Quem cria a mensagem é o banco, por gatilhos "after" nas seis tabelas: assim vale para todas as formas de incluir alguém (o "+"
--   das bolinhas da equipe, o cadastro do item, o lápis, a troca de responsável e também a versão anterior do site), sem mexer nas telas.
--   - "Entrou" é quem não estava no item: não era o responsável nem estava na equipe (colaboradores na demanda e no processo,
--     participantes nos outros; no contrato, a pessoa de cada participante da divisão, que só recebe se tiver usuário).
--   - O novo responsável recebe "pôs você como responsável"; quem entra na equipe recebe "incluiu você". O participante que passa a
--     responsável recebe a de responsável; o responsável que passa a participante não recebe nada (já estava no item). Mudar só o
--     percentual de alguém no contrato não avisa (a pessoa é a mesma).
--   - Uma mensagem por pessoa a cada salvamento: três pessoas de uma vez são três mensagens, uma para cada.
--   - Ninguém recebe aviso do que fez a si mesmo. Só recebe quem está ativo no escritório (a conta reservada e quem foi excluído, não).
--   - Só avisa o que a pessoa grava diretamente (gatilho com "when current_user = 'authenticated'", como a trava da divisão): as
--     funções do banco rodam como o dono dele e ficam de fora sem nenhuma conta a mais. Isso deixa de fora, de propósito:
--       - a aprovação do pedido para participar (privado.por_no_item): quem pediu recebe só a resposta ao pedido, sem uma segunda
--         mensagem repetida;
--       - as criações automáticas (as demandas do contrato assinado, as tarefas do modelo de lista e o contrato que nasce quando a
--         pessoa chega a "Contrato fechado", pessoa_fechar_contrato, cujo responsável o próprio sistema escolhe);
--       - o advogado que entra sozinho no processo (processo_me_incluir), quem sai sozinho (cartao_sair), as importações e as
--         rotinas.
--   - Entrar de novo num item (depois de sair) não repete a linha: a mensagem antiga volta a ser nova (data de agora, não lida).
--   - O desfazer (o botão "Desfazer" ou o Ctrl+Z) e as mudanças seguidas: as mudanças no papel de uma pessoa num item que vêm a
--     menos de 1 minuto uma da outra (AVISO_DESFEITO, em app/src/ui/tempos.ts) contam como uma só. Vale o papel em que ela ficou,
--     comparado com o que tinha antes da primeira (guardado em privado.mudancas_na_equipe): os avisos dessa sequência que ela ainda
--     não leu e que não valem mais saem, e ela recebe o que vale, se ainda não tiver um da sequência. Assim:
--       - incluir e desfazer: o aviso some (ela nunca soube de nada);
--       - tirar e desfazer: ela não recebe "incluiu você" de um item de que, para ela, nunca saiu;
--       - trocar o responsável de Caio para Beto e desfazer: o aviso de Beto some e Caio, que volta, não recebe nada;
--       - pôr o participante Beto como responsável e desfazer: o aviso de responsável dele some (ele continua só participante);
--       - pôr Beto como responsável e logo passá-lo a participante: ele fica com o de participante, não com "Agora você é o responsável";
--       - incluir e, logo depois, outra pessoa o pôr como responsável: um aviso só, o de responsável.
--     O aviso que a pessoa já leu fica (ela viu). Passado 1 minuto da última mudança, a próxima começa outra sequência (desfazer
--     depois disso é uma mudança nova, que avisa). Entrar ou sair pelas funções do banco (abaixo) não entra na sequência.
--
--   Quem é retirado depois continua com a mensagem (o critério da tarefa pede que ele veja que não faz mais parte). A mensagem só
--   guarda ids: o título, o código e quem incluiu só aparecem enquanto a pessoa faz parte do item, pelo campo calculado
--   public.ainda_faz_parte e pela ligação com o item (que passa pelas regras de leitura dele). Ver o item por outro caminho (a chave
--   "equipe vê tudo", ser administrador, ter criado o item, a Agenda geral, a demanda da tarefa) não conta como fazer parte: a
--   mensagem diz "Você não faz mais parte desta demanda.", sem o título nem o link, como a menção de um cartão que a pessoa não vê.
--   Avisar quem foi retirado fica para depois (fora da tarefa).
--
-- Só acrescenta: duas tabelas, funções e gatilhos novos. Nenhuma tabela, coluna, regra ou função que já existia muda.
-- A versão anterior do site continua funcionando:
--   - as mensagens ficam numa tabela própria (mensagens_de_inclusao), que ela não lê: a tela de Mensagens dela quebra com um tipo
--     que não conhece, e por isso o aviso não entra em mensagens nem em mensagens_de_participacao. Ela só não mostra os avisos novos,
--     e o número do menu dela não os conta;
--   - os gatilhos são "after": não mudam a linha gravada e não recusam nada (nenhum "raise"; quem incluiu é lido da tabela de
--     usuários, sem chave estrangeira que possa falhar). Só rodam quando o responsável ou a equipe mudam (update of), e o contrato
--     inclui as colunas antigas (participante_id e participante_percentual) que a versão anterior grava.
-- =====================================================================

-- 1. Os avisos. Uma coluna por módulo, cada uma com a sua chave estrangeira (como os pedidos para participar): o item apagado leva
-- os avisos dele. item_id junta as seis, para a regra de um aviso por pessoa, item e papel. Nada do item (título, código) é
-- guardado aqui: o que a caixa mostra vem do próprio item, enquanto a pessoa faz parte dele.
create table public.mensagens_de_inclusao (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  perfil_id      uuid not null references public.perfis on delete cascade,      -- quem recebe
  incluido_por   uuid references public.perfis on delete set null,              -- quem incluiu
  modulo         text not null check (modulo in ('tarefas', 'demandas', 'processos', 'compromissos', 'contratos', 'anotacoes')),
  entrou_como    text not null check (entrou_como in ('responsavel', 'participante')),
  tarefa_id      uuid references public.tarefas on delete cascade,
  demanda_id     uuid references public.demandas on delete cascade,
  processo_id    uuid references public.processos on delete cascade,
  compromisso_id uuid references public.compromissos on delete cascade,
  contrato_id    uuid references public.contratos on delete cascade,
  anotacao_id    uuid references public.anotacoes on delete cascade,
  item_id        uuid generated always as (coalesce(tarefa_id, demanda_id, processo_id, compromisso_id, contrato_id, anotacao_id)) stored,
  criado_em      timestamptz not null default now(),
  lido_em        timestamptz,
  -- O item é o do módulo: só a coluna dele vem preenchida.
  constraint inclusao_item_do_modulo check (
    (modulo = 'tarefas') = (tarefa_id is not null) and (modulo = 'demandas') = (demanda_id is not null)
    and (modulo = 'processos') = (processo_id is not null) and (modulo = 'compromissos') = (compromisso_id is not null)
    and (modulo = 'contratos') = (contrato_id is not null) and (modulo = 'anotacoes') = (anotacao_id is not null))
);
create unique index mensagens_de_inclusao_uma_por_papel on public.mensagens_de_inclusao (perfil_id, item_id, entrou_como);
create index mensagens_de_inclusao_da_pessoa on public.mensagens_de_inclusao (perfil_id, criado_em desc);
create index mensagens_de_inclusao_nao_lidas on public.mensagens_de_inclusao (perfil_id) where lido_em is null;
create index mensagens_de_inclusao_do_item on public.mensagens_de_inclusao (item_id);
create index mensagens_de_inclusao_escritorio on public.mensagens_de_inclusao (escritorio_id);
create index mensagens_de_inclusao_incluido_por on public.mensagens_de_inclusao (incluido_por) where incluido_por is not null;
create index mensagens_de_inclusao_tarefa on public.mensagens_de_inclusao (tarefa_id) where tarefa_id is not null;
create index mensagens_de_inclusao_demanda on public.mensagens_de_inclusao (demanda_id) where demanda_id is not null;
create index mensagens_de_inclusao_processo on public.mensagens_de_inclusao (processo_id) where processo_id is not null;
create index mensagens_de_inclusao_compromisso on public.mensagens_de_inclusao (compromisso_id) where compromisso_id is not null;
create index mensagens_de_inclusao_contrato on public.mensagens_de_inclusao (contrato_id) where contrato_id is not null;
create index mensagens_de_inclusao_anotacao on public.mensagens_de_inclusao (anotacao_id) where anotacao_id is not null;

-- O mesmo desenho da caixa (mensagens e mensagens_de_participacao): cada pessoa só vê e marca como lidas as suas, ninguém de outro
-- escritório, nem um administrador vê as dos outros. Só a data de leitura muda pela tela; quem cria e apaga são os gatilhos.
alter table public.mensagens_de_inclusao enable row level security;
revoke all on public.mensagens_de_inclusao from anon;
revoke insert, update, delete on public.mensagens_de_inclusao from authenticated;
grant update (lido_em) on public.mensagens_de_inclusao to authenticated;
create policy leitura on public.mensagens_de_inclusao for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));
create policy alterar on public.mensagens_de_inclusao for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- 2. A pessoa ainda faz parte do item da mensagem: é o responsável ou está na equipe (no contrato, pela pessoa dela). É um campo
-- calculado: a tela lê "ainda_faz_parte" junto com a mensagem e só mostra o item quando ele é verdadeiro. Só responde sobre quem
-- está logado (a mensagem de outra pessoa dá falso), e por isso não conta nada a ninguém sobre a equipe de um item.
create function public.ainda_faz_parte(m public.mensagens_de_inclusao) returns boolean
language sql stable security definer set search_path = '' as $$
  select m.perfil_id = auth.uid()
     and exists (select 1 from privado.item_do_pedido(m.modulo, m.item_id) i
                 where i.escritorio_id = m.escritorio_id and (m.perfil_id = i.responsavel_id or m.perfil_id = any(i.equipe)))
$$;
revoke execute on function public.ainda_faz_parte(public.mensagens_de_inclusao) from public, anon;
grant execute on function public.ainda_faz_parte(public.mensagens_de_inclusao) to authenticated;

-- 3. Os perfis das pessoas participantes de um contrato (a divisão guarda pessoas; a pessoa sem usuário não recebe nada).
create function privado.perfis_do_contrato(p_escritorio uuid, p_participantes jsonb) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(f.id), '{}')
  from jsonb_array_elements(coalesce(p_participantes, '[]')) e
  join public.perfis f on f.pessoa_id = (e ->> 'pessoa_id')::uuid and f.escritorio_id = p_escritorio
$$;
revoke execute on function privado.perfis_do_contrato(uuid, jsonb) from public, anon, authenticated;

-- 4. As sequências de mudanças: o papel que cada pessoa tinha no item antes da primeira mudança de uma sequência (as que vêm a menos
-- de 1 minuto uma da outra, AVISO_DESFEITO em app/src/ui/tempos.ts), quando ela começou e quando foi a última. Só a função abaixo
-- lê e grava (ninguém pela tela); a sequência que acabou sai na próxima mudança de qualquer item. item_id junta os seis módulos,
-- sem chave estrangeira: a linha do item apagado sai com as que acabaram.
create table privado.mudancas_na_equipe (
  perfil_id      uuid not null references public.perfis on delete cascade,
  item_id        uuid not null,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  papel_de_antes text not null check (papel_de_antes in ('responsavel', 'participante', 'nenhum')),
  desde          timestamptz not null,   -- a primeira mudança da sequência: os avisos criados desde então são dela
  em             timestamptz not null,   -- a última
  primary key (perfil_id, item_id)
);
create index mudancas_na_equipe_em on privado.mudancas_na_equipe (em);
create index mudancas_na_equipe_escritorio on privado.mudancas_na_equipe (escritorio_id);
alter table privado.mudancas_na_equipe enable row level security;
revoke all on privado.mudancas_na_equipe from public, anon, authenticated;

-- 5. Compara a equipe de antes com a de agora e acerta os avisos de cada pessoa cujo papel mudou. Antes nulo: o item é novo.
-- O aviso que vale é o do papel em que a pessoa ficou, comparado com o de antes da sequência (a mesma tabela de
-- AVISO_DA_MUDANCA em app/src/regras/inclusao.ts): passar a responsável avisa como responsável; entrar na equipe, sem estar no
-- item, avisa como participante; o resto (sair, o responsável que passa a participante) não avisa.
create function privado.avisar_inclusao(p_modulo text, p_item uuid, p_escritorio uuid,
                                        p_responsavel uuid, p_responsavel_antes uuid, p_equipe uuid[], p_equipe_antes uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := auth.uid();
  -- Quem incluiu, lido da tabela de usuários: sem usuário (uma sessão sem perfil), fica vazio em vez de recusar o salvamento.
  v_por uuid := (select f.id from public.perfis f where f.id = v_eu);
  v_equipe uuid[] := coalesce(p_equipe, '{}');
  v_antes uuid[] := coalesce(p_equipe_antes, '{}');
  c record;
begin
  -- As sequências que acabaram (a última mudança tem 1 minuto ou mais) não contam mais.
  delete from privado.mudancas_na_equipe s where s.em <= now() - interval '1 minute';

  for c in
    select x.perfil, coalesce(s.desde, now()) as desde, coalesce(s.papel_de_antes, x.antes) as de_antes,
           case when x.agora = 'responsavel' and coalesce(s.papel_de_antes, x.antes) <> 'responsavel' then 'responsavel'
                when x.agora = 'participante' and coalesce(s.papel_de_antes, x.antes) = 'nenhum' then 'participante' end as aviso
    from (
      select distinct p as perfil,
             case when p = p_responsavel_antes then 'responsavel' when p = any(v_antes) then 'participante' else 'nenhum' end as antes,
             case when p = p_responsavel then 'responsavel' when p = any(v_equipe) then 'participante' else 'nenhum' end as agora
      from unnest(v_equipe || v_antes || array[p_responsavel, p_responsavel_antes]) p
      where p is not null
    ) x
    left join privado.mudancas_na_equipe s on s.perfil_id = x.perfil and s.item_id = p_item
    where x.antes <> x.agora
  loop
    -- A sequência: continua a que vinha (só a última mudança anda) ou começa uma nova, com o papel de agora há pouco.
    insert into privado.mudancas_na_equipe (perfil_id, item_id, escritorio_id, papel_de_antes, desde, em)
    values (c.perfil, p_item, p_escritorio, c.de_antes, c.desde, now())
    on conflict (perfil_id, item_id) do update set em = excluded.em;

    -- Os avisos da sequência que a pessoa ainda não leu e que não valem mais saem (o desfazer, ou o papel que mudou de novo).
    delete from public.mensagens_de_inclusao m
    where m.perfil_id = c.perfil and m.item_id = p_item and m.criado_em >= c.desde and m.lido_em is null
      and m.entrou_como is distinct from c.aviso;

    -- O aviso que vale, se a pessoa ainda não tem um dele nesta sequência (lido ou não). Uma linha por pessoa, item e papel:
    -- entrar de novo depois de outra sequência renova a antiga.
    insert into public.mensagens_de_inclusao (escritorio_id, perfil_id, incluido_por, modulo, entrou_como,
                                              tarefa_id, demanda_id, processo_id, compromisso_id, contrato_id, anotacao_id)
    select p_escritorio, f.id, v_por, p_modulo, c.aviso,
           case when p_modulo = 'tarefas' then p_item end, case when p_modulo = 'demandas' then p_item end,
           case when p_modulo = 'processos' then p_item end, case when p_modulo = 'compromissos' then p_item end,
           case when p_modulo = 'contratos' then p_item end, case when p_modulo = 'anotacoes' then p_item end
    from public.perfis f
    where c.aviso is not null and f.id = c.perfil and f.escritorio_id = p_escritorio
      and f.ativo and not f.reservada and f.excluido_em is null and f.id is distinct from v_eu
      and not exists (select 1 from public.mensagens_de_inclusao m
                      where m.perfil_id = c.perfil and m.item_id = p_item and m.entrou_como = c.aviso and m.criado_em >= c.desde)
    on conflict (perfil_id, item_id, entrou_como) do update
      set criado_em = now(), lido_em = null, incluido_por = excluded.incluido_por;
  end loop;
end $$;
revoke execute on function privado.avisar_inclusao(text, uuid, uuid, uuid, uuid, uuid[], uuid[]) from public, anon, authenticated;

-- 6. Um gatilho por tabela, cada um lendo só as colunas da equipe dela (sem copiar a linha inteira: a anotação e o contrato têm
-- textos grandes). "update of" só as colunas da equipe: mover o cartão, reordenar ou editar o título nem chamam a função.
create function privado.inclusao_na_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('tarefas', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end, new.participantes, case when tg_op = 'UPDATE' then old.participantes end);
  return null;
end $$;
create function privado.inclusao_na_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('demandas', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end, new.colaboradores, case when tg_op = 'UPDATE' then old.colaboradores end);
  return null;
end $$;
create function privado.inclusao_no_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('processos', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end, new.colaboradores, case when tg_op = 'UPDATE' then old.colaboradores end);
  return null;
end $$;
create function privado.inclusao_no_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('compromissos', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end, new.participantes, case when tg_op = 'UPDATE' then old.participantes end);
  return null;
end $$;
create function privado.inclusao_na_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('anotacoes', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end, new.participantes, case when tg_op = 'UPDATE' then old.participantes end);
  return null;
end $$;
-- No contrato, a lista já vem arrumada pelo gatilho "participantes" (before), também quando a versão anterior grava só as colunas
-- antigas (participante_id e participante_percentual).
create function privado.inclusao_no_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.avisar_inclusao('contratos', new.id, new.escritorio_id, new.responsavel_id,
    case when tg_op = 'UPDATE' then old.responsavel_id end, privado.perfis_do_contrato(new.escritorio_id, new.participantes),
    case when tg_op = 'UPDATE' then privado.perfis_do_contrato(old.escritorio_id, old.participantes) end);
  return null;
end $$;
revoke execute on function privado.inclusao_na_tarefa() from public, anon, authenticated;
revoke execute on function privado.inclusao_na_demanda() from public, anon, authenticated;
revoke execute on function privado.inclusao_no_processo() from public, anon, authenticated;
revoke execute on function privado.inclusao_no_compromisso() from public, anon, authenticated;
revoke execute on function privado.inclusao_na_anotacao() from public, anon, authenticated;
revoke execute on function privado.inclusao_no_contrato() from public, anon, authenticated;

create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes on public.tarefas
  for each row when (current_user = 'authenticated') execute function privado.inclusao_na_tarefa();
create trigger aviso_de_inclusao after insert or update of responsavel_id, colaboradores on public.demandas
  for each row when (current_user = 'authenticated') execute function privado.inclusao_na_demanda();
create trigger aviso_de_inclusao after insert or update of responsavel_id, colaboradores on public.processos
  for each row when (current_user = 'authenticated') execute function privado.inclusao_no_processo();
create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes on public.compromissos
  for each row when (current_user = 'authenticated') execute function privado.inclusao_no_compromisso();
create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes on public.anotacoes
  for each row when (current_user = 'authenticated') execute function privado.inclusao_na_anotacao();
create trigger aviso_de_inclusao after insert or update of responsavel_id, participantes, participante_id, participante_percentual on public.contratos
  for each row when (current_user = 'authenticated') execute function privado.inclusao_no_contrato();

-- 7. Quem é excluído da equipe (excluir_usuario) perde os avisos dele, como as outras mensagens.
create function privado.inclusoes_de_quem_saiu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mensagens_de_inclusao m where m.perfil_id = new.id;
  return null;
end $$;
revoke execute on function privado.inclusoes_de_quem_saiu() from public, anon, authenticated;
create trigger inclusoes_de_quem_saiu after update of excluido_em on public.perfis
  for each row when (old.excluido_em is null and new.excluido_em is not null) execute function privado.inclusoes_de_quem_saiu();
