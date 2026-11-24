-- =====================================================================
-- Avisos da tarefa na caixa de Mensagens para o solicitante e para quem executa (#415, vem da #313)
--   Três avisos novos, no mesmo desenho dos avisos que já existem (o "incluiu você" de 20261119193326_aviso_ao_ser_incluido.sql e
--   os da demanda do compromisso de 20261123000750_demandas_dos_compromissos.sql): só a caixa, sem e-mail; quem cria é o banco.
--   1. "solicitante": quem é posto como solicitante de uma tarefa (no cadastro ou no lápis) recebe "incluiu você como solicitante".
--      Como o aviso de inclusão, só o que a pessoa grava diretamente avisa (gatilho com "when current_user = 'authenticated'"): as
--      funções do banco (cópias automáticas, importações, rotinas) ficam de fora. As trocas que vêm a menos de 1 minuto uma da outra
--      (AVISO_DESFEITO, em app/src/ui/tempos.ts) contam como uma só, como no aviso de inclusão: vale quem ficou de solicitante,
--      comparado com quem era antes da primeira troca (guardado em privado.mudancas_do_solicitante). Assim, pôr e desfazer apaga o
--      aviso que a pessoa ainda não leu; trocar de Caio para Beto e desfazer não avisa o Caio (ele nunca deixou de ser).
--      Um aviso por pessoa e tarefa: ser posto de novo depois (passado o minuto) renova o antigo (data de agora, não lido).
--   2. "aprovacao": quando a tarefa que precisa de aprovação chega à coluna de aprovação (quem executa a conclui e o gatilho
--      aa_aprovacao a desvia, ou alguém a arrasta para lá), o solicitante é avisado. Vale para qualquer caminho (também as funções do
--      banco que movem a tarefa), por isso este gatilho não tem o "when current_user". Um aviso por pessoa e tarefa: cada nova chegada
--      renova o antigo. Quem a enviou e a retira da coluna de aprovação para outra que não a das concluídas a menos de 1 minuto da
--      chegada (o Desfazer do "enviada para aprovação") apaga o aviso que o solicitante ainda não leu. Se o solicitante muda com a
--      tarefa esperando na coluna de aprovação, o novo recebe o aviso de aprovação e o antigo perde o que ainda não leu.
--   3. "devolvida": quando o solicitante (ou um administrador) devolve a tarefa com o comentário (public.tarefa_devolver), quem executa
--      é avisado, com o comentário: o responsável e os participantes com uma função de execução ("Executa"). A mensagem guarda só o id
--      do comentário: o texto vem do próprio comentário, pelas regras de leitura dele (apagado, o aviso fica sem o texto).
--   Ninguém recebe aviso do que fez a si mesmo. Só recebe quem está ativo no escritório (a conta reservada e quem foi excluído, não).
--   A mensagem só guarda ids: o título e o código vêm da tarefa, pelas regras de leitura dela (quem não a vê mais não lê o título).
--
-- Só acrescenta: duas tabelas, funções e gatilhos novos, e o corpo de public.tarefa_devolver trocado (o mesmo nome, os mesmos
-- parâmetros, o mesmo retorno e o mesmo comportamento, e mais o aviso). A versão anterior do site continua funcionando: ela não lê a
-- tabela nova (a tela de Mensagens dela só não mostra estes avisos, e o número do menu dela não os conta); os gatilhos são "after",
-- não mudam a linha gravada e não recusam nada.
-- =====================================================================

-- 1. Os avisos.
create table public.mensagens_da_tarefa (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid not null references public.perfis on delete cascade,          -- quem recebe
  feito_por     uuid references public.perfis on delete set null,                  -- quem pôs, quem enviou para a aprovação, quem devolveu
  aviso         text not null check (aviso in ('solicitante', 'aprovacao', 'devolvida')),
  tarefa_id     uuid not null references public.tarefas on delete cascade,
  comentario_id uuid references public.comentarios on delete set null,            -- na devolvida: o comentário da devolução
  criado_em     timestamptz not null default now(),
  lido_em       timestamptz,
  constraint mensagens_da_tarefa_comentario check (comentario_id is null or aviso = 'devolvida')
);
-- Um aviso de solicitante e um de aprovação por pessoa e tarefa (o novo renova o antigo); cada devolução é um aviso.
create unique index mensagens_da_tarefa_uma_por_aviso on public.mensagens_da_tarefa (perfil_id, tarefa_id, aviso) where aviso <> 'devolvida';
create index mensagens_da_tarefa_da_pessoa on public.mensagens_da_tarefa (perfil_id, criado_em desc);
create index mensagens_da_tarefa_nao_lidas on public.mensagens_da_tarefa (perfil_id) where lido_em is null;
create index mensagens_da_tarefa_escritorio on public.mensagens_da_tarefa (escritorio_id);
create index mensagens_da_tarefa_tarefa on public.mensagens_da_tarefa (tarefa_id);
create index mensagens_da_tarefa_feito_por on public.mensagens_da_tarefa (feito_por) where feito_por is not null;
create index mensagens_da_tarefa_comentario on public.mensagens_da_tarefa (comentario_id) where comentario_id is not null;

-- O mesmo desenho da caixa: cada pessoa só vê e marca como lidas as suas, ninguém de outro escritório, nem um administrador vê as dos
-- outros. Só a data de leitura muda pela tela; quem cria e apaga são os gatilhos.
alter table public.mensagens_da_tarefa enable row level security;
revoke all on public.mensagens_da_tarefa from anon;
revoke insert, update, delete, truncate, references, trigger on public.mensagens_da_tarefa from authenticated;
grant select on public.mensagens_da_tarefa to authenticated;
grant update (lido_em) on public.mensagens_da_tarefa to authenticated;
create policy leitura on public.mensagens_da_tarefa for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));
create policy alterar on public.mensagens_da_tarefa for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- Quem é excluído da equipe perde os avisos dele, como as outras mensagens.
create function privado.mensagens_da_tarefa_de_quem_saiu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mensagens_da_tarefa m where m.perfil_id = new.id;
  return null;
end $$;
revoke execute on function privado.mensagens_da_tarefa_de_quem_saiu() from public, anon, authenticated;
create trigger mensagens_da_tarefa_de_quem_saiu after update of excluido_em on public.perfis
  for each row when (old.excluido_em is null and new.excluido_em is not null) execute function privado.mensagens_da_tarefa_de_quem_saiu();

-- Cria (ou renova) o aviso para uma pessoa: só quem está ativo no escritório da tarefa e não é quem fez. Os avisos de solicitante e
-- de aprovação são um por pessoa e tarefa: o novo renova o antigo (data de agora, não lido, quem fez).
create function privado.avisar_da_tarefa(p_escritorio uuid, p_tarefa uuid, p_perfil uuid, p_aviso text, p_comentario uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_perfil is null or p_perfil is not distinct from auth.uid() or not privado.ativo_no_escritorio(p_perfil, p_escritorio) then
    return;
  end if;
  if p_aviso = 'devolvida' then
    insert into public.mensagens_da_tarefa (escritorio_id, perfil_id, feito_por, aviso, tarefa_id, comentario_id)
    values (p_escritorio, p_perfil, (select f.id from public.perfis f where f.id = auth.uid()), p_aviso, p_tarefa, p_comentario);
  else
    insert into public.mensagens_da_tarefa (escritorio_id, perfil_id, feito_por, aviso, tarefa_id)
    values (p_escritorio, p_perfil, (select f.id from public.perfis f where f.id = auth.uid()), p_aviso, p_tarefa)
    on conflict (perfil_id, tarefa_id, aviso) where aviso <> 'devolvida' do update
      set criado_em = now(), lido_em = null, feito_por = excluded.feito_por;
  end if;
end $$;
revoke execute on function privado.avisar_da_tarefa(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

-- 2. O solicitante. As sequências de trocas: quem era o solicitante antes da primeira troca de uma sequência (as que vêm a menos de
-- 1 minuto uma da outra), quando ela começou e quando foi a última. Só a função abaixo lê e grava; a que acabou sai na próxima troca.
create table privado.mudancas_do_solicitante (
  tarefa_id        uuid primary key references public.tarefas on delete cascade,
  escritorio_id    uuid not null references public.escritorios on delete cascade,
  solicitante_antes uuid,                -- quem era o solicitante antes da primeira troca (null: ninguém)
  desde            timestamptz not null, -- a primeira troca da sequência: os avisos criados desde então são dela
  em               timestamptz not null  -- a última
);
create index mudancas_do_solicitante_em on privado.mudancas_do_solicitante (em);
create index mudancas_do_solicitante_escritorio on privado.mudancas_do_solicitante (escritorio_id);
alter table privado.mudancas_do_solicitante enable row level security;
revoke all on privado.mudancas_do_solicitante from public, anon, authenticated;

-- Vale quem ficou de solicitante, comparado com o de antes da sequência (o mesmo de avisoDoSolicitante em
-- app/src/regras/avisosDaTarefa.ts): se é outra pessoa, ela é avisada (se ainda não tem um aviso desta sequência); os avisos da
-- sequência que não valem mais e que ninguém leu saem.
create function privado.aviso_do_solicitante() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s privado.mudancas_do_solicitante;
  v_antes uuid;
  v_desde timestamptz;
  v_vale uuid;
begin
  if tg_op = 'UPDATE' and new.solicitante_id is not distinct from old.solicitante_id then
    return null;
  end if;
  -- A tarefa nova sem solicitante não começa sequência nenhuma (nada a avisar nem a guardar).
  if tg_op = 'INSERT' and new.solicitante_id is null then
    return null;
  end if;
  delete from privado.mudancas_do_solicitante m where m.em <= now() - interval '1 minute';
  select * into s from privado.mudancas_do_solicitante m where m.tarefa_id = new.id;
  v_antes := case when s.tarefa_id is not null then s.solicitante_antes when tg_op = 'UPDATE' then old.solicitante_id end;
  v_desde := coalesce(s.desde, now());
  insert into privado.mudancas_do_solicitante (tarefa_id, escritorio_id, solicitante_antes, desde, em)
  values (new.id, new.escritorio_id, v_antes, v_desde, now())
  on conflict (tarefa_id) do update set em = excluded.em;

  v_vale := case when new.solicitante_id is distinct from v_antes then new.solicitante_id end;
  delete from public.mensagens_da_tarefa m
  where m.tarefa_id = new.id and m.aviso = 'solicitante' and m.criado_em >= v_desde and m.lido_em is null
    and m.perfil_id is distinct from v_vale;
  if v_vale is not null and not exists (select 1 from public.mensagens_da_tarefa m
                                        where m.tarefa_id = new.id and m.aviso = 'solicitante' and m.perfil_id = v_vale and m.criado_em >= v_desde) then
    perform privado.avisar_da_tarefa(new.escritorio_id, new.id, v_vale, 'solicitante', null);
  end if;
  return null;
end $$;
revoke execute on function privado.aviso_do_solicitante() from public, anon, authenticated;
create trigger aviso_do_solicitante after insert or update of solicitante_id on public.tarefas
  for each row when (current_user = 'authenticated') execute function privado.aviso_do_solicitante();

-- 3. A chegada à coluna de aprovação (e o desfazer dela), e a troca do solicitante com a tarefa esperando lá. O mesmo de
-- chegouAAprovacao, saiuDaAprovacao e aprovacaoMudouDeDono em app/src/regras/avisosDaTarefa.ts.
create function privado.aviso_da_aprovacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_aprovacao uuid;
begin
  select c.id into v_aprovacao from public.quadro_colunas c where c.escritorio_id = new.escritorio_id and c.de_aprovacao;
  if v_aprovacao is null then
    return null;
  end if;
  -- O solicitante mudou com a tarefa esperando na coluna de aprovação: o novo é avisado de que ela espera a aprovação dele; o antigo,
  -- que não a aprova mais, perde o aviso de aprovação que ainda não leu.
  if tg_op = 'UPDATE' and new.solicitante_id is distinct from old.solicitante_id
     and new.etapa_id = v_aprovacao and new.precisa_aprovacao and new.arquivado_em is null then
    delete from public.mensagens_da_tarefa m
    where m.tarefa_id = new.id and m.aviso = 'aprovacao' and m.perfil_id = old.solicitante_id and m.lido_em is null;
    perform privado.avisar_da_tarefa(new.escritorio_id, new.id, new.solicitante_id, 'aprovacao', null);
    return null;
  end if;
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then
    return null;
  end if;
  -- Chegou: a tarefa precisa de aprovação e não está arquivada.
  if new.etapa_id = v_aprovacao and new.precisa_aprovacao and new.arquivado_em is null then
    perform privado.avisar_da_tarefa(new.escritorio_id, new.id, new.solicitante_id, 'aprovacao', null);
  -- Quem a enviou a retirou logo para outra coluna que não a das concluídas (o Desfazer): o aviso que ninguém leu sai.
  elsif tg_op = 'UPDATE' and old.etapa_id = v_aprovacao
        and not exists (select 1 from public.quadro_colunas c where c.id = new.etapa_id and c.marco = 'concluido') then
    delete from public.mensagens_da_tarefa m
    where m.tarefa_id = new.id and m.aviso = 'aprovacao' and m.lido_em is null and m.criado_em > now() - interval '1 minute'
      and m.feito_por is not distinct from auth.uid();
  end if;
  return null;
end $$;
revoke execute on function privado.aviso_da_aprovacao() from public, anon, authenticated;
create trigger aviso_da_aprovacao after insert or update of etapa_id, solicitante_id on public.tarefas
  for each row execute function privado.aviso_da_aprovacao();

-- 4. A devolução: a de 20261123013306_tarefa_aprovacao.sql, que agora guarda o id do comentário e avisa quem executa (o responsável e
-- os participantes com uma função de execução; o mesmo de quemExecuta em app/src/regras/avisosDaTarefa.ts). As funções só guardam
-- participantes (o gatilho preparar_pedido tira quem saiu); quem está na tarefa só pelo grupo da equipe não executa e não é avisado.
CREATE OR REPLACE FUNCTION public.tarefa_devolver(p_id uuid, p_comentario text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tarefas := privado.tarefa_que_aprovo(p_id); v_texto text := btrim(coalesce(p_comentario, '')); v_volta uuid; v_comentario uuid; v_quem uuid;
begin
  if v_texto = '' then raise exception 'Diga o que precisa ser ajustado.'; end if;
  if length(v_texto) > 1000 then raise exception 'O comentário da devolução pode ter até 1000 caracteres.'; end if;   -- TAMANHO_TAREFA.devolucao
  select c.id into v_volta from public.quadro_colunas c
  where c.escritorio_id = t.escritorio_id and c.modulo = 'tarefas' and c.marco is null and not c.de_aprovacao
    and privado.chave_da_coluna(c.nome) = privado.chave_da_coluna('Fazendo')
  order by c.ordem, c.id limit 1;
  if v_volta is null then
    select c.id into v_volta from public.quadro_colunas c where c.escritorio_id = t.escritorio_id and c.modulo = 'tarefas' and c.marco = 'inicio';
  end if;
  if v_volta is null then raise exception 'O quadro de tarefas não tem a coluna para onde a tarefa volta.'; end if;
  insert into public.comentarios (escritorio_id, tarefa_id, autor_id, texto) values (t.escritorio_id, p_id, auth.uid(), 'Tarefa devolvida: ' || v_texto)
  returning id into v_comentario;
  update public.tarefas set etapa_id = v_volta, etapa_ordem = extract(epoch from clock_timestamp()) where id = p_id;
  for v_quem in
    select distinct x from unnest(array[t.responsavel_id] || array(
      select e.key::uuid from jsonb_each_text(t.funcoes) e
      join public.funcoes_na_tarefa f on f.id::text = e.value and f.escritorio_id = t.escritorio_id and f.executa)) x
    where x is not null
  loop
    perform privado.avisar_da_tarefa(t.escritorio_id, p_id, v_quem, 'devolvida', v_comentario);
  end loop;
  return v_volta;
end $function$;
