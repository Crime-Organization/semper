-- =====================================================================
-- Processos: o tipo do andamento numa lista pronta, e comentários no cartão (#362)
--   A. O tipo do andamento (coluna nova "categoria", que aceita vazio):
--     - A lista pronta é a mesma para todos os escritórios (decisão do dono, 19/11): despacho, decisão, sentença, intimação,
--       petição e audiência. É a mesma de CATEGORIAS_DE_ANDAMENTO em app/src/regras/andamentos.ts: tipo novo = um valor novo
--       aqui (numa migração nova) e lá.
--     - O tipo de sempre (coluna "tipo": andamento, intimação, audiência ou perícia) continua mandando no que o andamento faz
--       (a intimação fica "a tratar" e vira tarefa; audiência e perícia têm hora e local). Cada tipo da lista pronta combina com
--       um só deles: intimação com intimação, audiência com audiência, e os outros quatro com o andamento comum. A regra
--       processo_andamentos_categoria_do_tipo não deixa gravar um par que não combina.
--     - Sem tipo da lista (vazio): os andamentos de antes (entre eles a perícia e o andamento comum) e o que a versão anterior
--       do site lança. Eles aparecem como sempre, com o nome do tipo de sempre. O site novo só lança com um tipo da lista.
--     - A versão anterior do site não conhece a coluna nova: o que ela lança fica sem tipo da lista. Quando ela muda o tipo de
--       sempre de um andamento que tem um tipo da lista que não combina mais (ex.: um despacho que ela troca para intimação), o
--       gatilho acertar_categoria esvazia o tipo da lista, em vez de recusar a mudança: a versão anterior continua funcionando.
--     - O histórico do processo passa a mostrar o tipo da lista no começo da linha ("Despacho de 10/11/2026: ..."), igual a
--       linhaDoAndamento em app/src/regras/andamentos.ts. A função privado.linha_do_andamento de antes fica como está (o banco a
--       mantém, para não apagar nada): a nova tem um argumento a mais, e só o gatilho do histórico passa a usá-la.
--   B. Comentários no processo, como nos outros cartões:
--     - O comentário de um processo usa a mesma tabela public.comentarios, com a coluna nova processo_id (o padrão de cada
--       módulo: uma coluna de ligação, com o seu índice, e a regra comentario_de_um_cartao contando a coluna nova).
--     - A ligação vai pelo par processo e escritório (como nas anotações): o comentário é sempre do escritório do processo.
--       Excluir o processo (só o arquivado, por quem o criou ou por um administrador) apaga os comentários dele, e com eles as
--       mensagens das menções (on delete cascade). Arquivar não mexe nos comentários.
--     - Ler e comentar segue quem VÊ o processo (a consulta ao processo passa pela regra de leitura dele): quem só lê o processo
--       (com a chave "equipe_ve_tudo") também comenta, como nos outros módulos. Editar o próprio comentário também exige ver o
--       processo (regra restritiva nova, como a de 20261119010000_mencoes_sem_revelar.sql); apagar continua como está.
--     - Só se menciona quem vê o processo por estar nele (quem o criou, o responsável e os colaboradores), os administradores,
--       e todos com a chave "equipe_ve_tudo" ou "equipe_edita_tudo". A conferência roda DEPOIS das regras de acesso (gatilho
--       "after", como nas anotações, #365): quem não vê o processo, ou é de outro escritório, recebe sempre a mesma recusa das
--       regras, e nunca fica sabendo se ele existe nem quem está nele.
--     - A caixa de mensagens não muda: o gatilho privado.mensagens_do_comentario vale para qualquer comentário.
--
--   Só acrescenta: duas colunas (nulas), duas regras check, uma restrição única, uma chave estrangeira e um índice novos, quatro
--   funções, dois gatilhos e uma regra (restritiva) novos, uma condição a mais nas regras de leitura e de incluir dos comentários
--   e a regra comentario_de_um_cartao, trocada no mesmo comando por uma mais larga (só AFROUXA: aceita tudo o que a antiga
--   aceitava, e mais o comentário que tem só o processo). O gatilho do histórico dos andamentos é recriado com o mesmo nome. A
--   versão anterior do site continua funcionando: ela não conhece as colunas novas, que ficam vazias em tudo o que ela grava;
--   para os comentários dela (que nunca têm processo_id), as regras dizem o mesmo de antes; e os andamentos dela (sempre sem
--   tipo da lista) passam por todas as regras novas.
-- =====================================================================

-- A1. O tipo da lista pronta. Vazio vale (os andamentos de antes, a perícia e o andamento comum sem tipo). As linhas que
--     existem ficam vazias e passam pelas duas regras.
alter table public.processo_andamentos add column categoria text
  constraint processo_andamentos_categoria_da_lista check (categoria in ('despacho', 'decisao', 'sentenca', 'intimacao', 'peticao', 'audiencia'));
-- O tipo de sempre com que cada tipo da lista combina (o "tipo" de CATEGORIAS_DE_ANDAMENTO em app/src/regras/andamentos.ts).
create function privado.tipo_da_categoria(p_categoria text) returns text
language sql immutable set search_path = '' as $$
  select case p_categoria when 'intimacao' then 'intimacao' when 'audiencia' then 'audiencia' else 'andamento' end
$$;
revoke execute on function privado.tipo_da_categoria(text) from public, anon;
-- A regra check e o gatilho rodam com a permissão de quem grava o andamento.
grant execute on function privado.tipo_da_categoria(text) to authenticated;
alter table public.processo_andamentos add constraint processo_andamentos_categoria_do_tipo
  check (categoria is null or tipo = privado.tipo_da_categoria(categoria));
-- Quem muda os andamentos pela tela muda também o tipo da lista (a gravação é por coluna, desde 20261102125539_andamentos_e_prazos.sql).
grant update (categoria) on public.processo_andamentos to authenticated;

-- A2. A versão anterior do site muda só o tipo de sempre: o tipo da lista que não combina mais sai (em vez de a mudança ser recusada).
--     Quem grava os dois juntos (a tela nova) não passa por aqui: se o par não combina, a regra do passo A1 recusa.
create function privado.acertar_categoria_do_andamento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo is distinct from old.tipo and new.categoria is not distinct from old.categoria and new.categoria is not null
     and new.tipo <> privado.tipo_da_categoria(new.categoria) then
    new.categoria := null;
  end if;
  return new;
end $$;
revoke execute on function privado.acertar_categoria_do_andamento() from public, anon, authenticated;
create trigger acertar_categoria before update on public.processo_andamentos for each row execute function privado.acertar_categoria_do_andamento();

-- A3. A linha do andamento no histórico, com o tipo da lista no lugar do tipo de sempre, quando há (igual a linhaDoAndamento em
--     app/src/regras/andamentos.ts). Sem o tipo da lista, a linha é a mesma de antes, letra por letra.
create function privado.linha_do_andamento(p_tipo text, p_categoria text, p_data date, p_hora time, p_local text, p_texto text, p_tratada timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case coalesce(p_categoria, p_tipo) when 'despacho' then 'Despacho' when 'decisao' then 'Decisão' when 'sentenca' then 'Sentença'
           when 'peticao' then 'Petição' when 'intimacao' then 'Intimação' when 'audiencia' then 'Audiência' when 'pericia' then 'Perícia' else 'Andamento' end
    || ' de ' || to_char(p_data, 'DD/MM/YYYY') || coalesce(' às ' || to_char(p_hora, 'HH24:MI'), '') || coalesce(' em ' || p_local, '')
    || ': ' || p_texto || case when p_tratada is null then '' else ' (tratada)' end
$$;
revoke execute on function privado.linha_do_andamento(text, text, date, time, text, text, timestamptz) from public, anon;

-- Igual à de 20261102125539_andamentos_e_prazos.sql, com o tipo da lista na linha.
CREATE OR REPLACE FUNCTION privado.historico_andamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare de text; para text; atual public.processo_andamentos;
begin
  -- O que está excluído não tem linha: excluir vai da linha para o vazio, e desfazer, do vazio para a linha.
  if tg_op <> 'INSERT' and old.excluido_em is null then de := privado.linha_do_andamento(old.tipo, old.categoria, old.data, old.hora, old.local, old.texto, old.tratada_em); end if;
  if tg_op <> 'DELETE' and new.excluido_em is null then para := privado.linha_do_andamento(new.tipo, new.categoria, new.data, new.hora, new.local, new.texto, new.tratada_em); end if;
  atual := case when tg_op = 'DELETE' then old else new end;
  perform privado.gravar_no_historico_do_processo(atual.processo_id, atual.escritorio_id, 'andamento', de, para);
  return null;
end $function$;

-- B1. O processo ganha a chave única (id, escritório), para a ligação ir pelo par (como a anotação). O id já é único sozinho: o
--     par também é, e nenhuma linha que existe é recusada.
alter table public.processos add constraint processos_id_escritorio_unico unique (id, escritorio_id);

-- B2. A coluna de ligação e o índice, como as dos outros módulos (on delete cascade: o comentário some com o processo).
alter table public.comentarios add column processo_id uuid;
alter table public.comentarios add constraint comentarios_processo_fkey
  foreign key (processo_id, escritorio_id) references public.processos (id, escritorio_id) on delete cascade;
create index comentarios_do_processo on public.comentarios (processo_id, criado_em desc) where processo_id is not null;

-- B3. Exatamente um cartão, agora contando o processo. Trocar uma regra check é tirar e pôr de novo, num comando só (nada grava
--     entre os dois). A regra nova aceita tudo o que a antiga aceitava: num comentário sem processo (todos os de hoje e todos os
--     que a versão anterior do site grava), num_nonnulls conta o mesmo, e "= 1" continua valendo igual. Ela só passa a aceitar,
--     além disso, o comentário que tem só o processo.
alter table public.comentarios
  drop constraint comentario_de_um_cartao,
  add constraint comentario_de_um_cartao check (num_nonnulls(pessoa_id, contrato_id, demanda_id, tarefa_id, compromisso_id, anotacao_id, processo_id) = 1);

-- B4. Quem vê o processo vê e escreve comentários nele (iguais às de 20261119020000_comentarios_das_anotacoes.sql, com a última
--     linha a mais).
alter policy leitura on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id))
         and (anotacao_id is null or exists (select 1 from public.anotacoes a where a.id = anotacao_id))
         and (processo_id is null or exists (select 1 from public.processos x where x.id = processo_id)));
alter policy incluir on public.comentarios
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id))
         and (anotacao_id is null or exists (select 1 from public.anotacoes a where a.id = anotacao_id))
         and (processo_id is null or exists (select 1 from public.processos x where x.id = processo_id)));
-- Editar o próprio comentário exige ainda ver o processo dele: regra restritiva nova (vale junto com a "alterar" e com a
-- "alterar_quem_ve_o_item"), sem reescrever as outras. Sem ela, quem saiu do processo ainda editaria o próprio comentário nele.
create policy alterar_quem_ve_o_processo on public.comentarios as restrictive for update to authenticated
  using (processo_id is null or exists (select 1 from public.processos x where x.id = processo_id));

-- B5. Quem pode ser mencionado no processo. Roda DEPOIS de gravar (gatilho "after"), e portanto depois das regras de incluir e de
--     alterar: só chega aqui quem é do escritório e vê o processo. As menções já vêm achadas pelo gatilho "preparar". Lê o
--     processo sem passar pelas regras dele (security definer); o erro desfaz tudo, inclusive as mensagens das menções.
create function privado.mencao_no_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.processos x
  where x.id = new.processo_id and x.escritorio_id = new.escritorio_id and p.id = any(new.mencoes)
    and not privado.equipe_ve_tudo() and not privado.equipe_edita_tudo() and p.papel not in ('master', 'admin')
    and p.id is distinct from x.criado_por and p.id <> x.responsavel_id and not p.id = any(x.colaboradores)
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % neste processo: inclua essa pessoa como colaboradora antes.', v_nome;
  end if;
  return null;
end $$;
revoke execute on function privado.mencao_no_processo() from public, anon, authenticated;
create trigger conferir_mencao_no_processo after insert or update of texto on public.comentarios
  for each row when (new.processo_id is not null) execute function privado.mencao_no_processo();
