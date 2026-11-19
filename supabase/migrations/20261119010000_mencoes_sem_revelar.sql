-- =====================================================================
-- Menções nos comentários sem revelar itens a quem não os vê (#365)
--   O defeito: a conferência das menções (@nome) nos comentários de contratos, demandas, tarefas e compromissos rodava num
--   gatilho "before", e um gatilho "before" roda ANTES de o banco conferir as regras de acesso (RLS) da linha nova. Quem não vê
--   o item (ou forja o escritorio_id de outro escritório) recebia a recusa da menção ("Não é possível mencionar Fulano nesta
--   demanda...") em vez da recusa de sempre ("sem permissão"), e assim descobria que o item existe, o nome de quem pode ou não
--   ser mencionado nele e quem participa dele. Num contrato, nem o item importava: com o escritório forjado, a recusa dava o
--   nome de quem não é advogado no outro escritório.
--
--   A correção, como nas anotações (#364):
--   - O gatilho "before" (privado.preparar_comentario) continua fazendo o que prepara a linha antes de gravar: tira os espaços
--     das pontas, recusa o texto vazio, marca a data da edição, acha as menções no texto e marca o comentário de quem não é parte
--     do contrato. Só deixa de RECUSAR menções.
--   - A recusa das menções passa para gatilhos "after" (conferir_mencoes e conferir_mencao_no_compromisso), que só rodam
--     depois de as regras de incluir e de alterar aceitarem a linha: quem chega lá é do escritório e vê o item. As regras de
--     quem pode ser mencionado e as mensagens de recusa são as mesmas de hoje, palavra por palavra. O erro num gatilho "after"
--     desfaz o comando inteiro: o comentário não fica gravado e nenhuma mensagem de menção é criada (o gatilho "mensagens"
--     também é "after" do mesmo comando).
--   - Quem saiu de uma demanda, tarefa ou compromisso não edita mais os próprios comentários nele (como já era no contrato): sem
--     isso, uma alteração sem filtro, que não passa pela regra de leitura, ainda chegaria à conferência das menções e contaria
--     quem está no item. É uma regra nova, "restritiva" (soma-se às outras com "e"), em vez de reescrever a regra "alterar":
--     assim ela não apaga nem é apagada por outra migração que mude a regra "alterar" (como a dos comentários das anotações).
--
--   Só acrescenta, no sentido do CLAUDE.md: nenhuma tabela, coluna ou dado muda. As funções são recriadas com o mesmo nome, o
--   gatilho do compromisso troca "before" por "after" (tirar e pôr, no mesmo passo), e entram uma função, um gatilho e uma regra
--   novos. Para quem PODE comentar, nada muda: a linha gravada é a mesma (o "before" ainda prepara tudo), as mesmas menções são
--   aceitas e as mesmas são recusadas com a mesma mensagem, e as mensagens da caixa são as mesmas. A versão anterior do site
--   continua funcionando: ela grava e edita comentários do mesmo jeito (insert com o cartão e o texto; update só do texto, com
--   filtro pelo id) e mostra as mesmas mensagens; quem não vê o item já recebia dela "Você não tem permissão para fazer isso."
--   (sem menção) e agora recebe o mesmo também com menção; editar o próprio comentário num item que não vê já não passava pela
--   tela (a regra de leitura escondia o comentário), e continua dando "Só quem escreveu o comentário pode editá-lo.".
-- =====================================================================

-- 1. O gatilho "before" só prepara: igual ao de 20261117193606_contrato_abre_demandas.sql, sem as três recusas de menção (que vão
--    para o passo 2, sem mudar nada nelas).
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
  -- Quem não é parte comenta com a chave ligada, mas a menção dele não dá acesso aos valores, nem depois de a chave ser desligada.
  new.autor_sem_vinculo := new.contrato_id is not null and privado.equipe_ve_tudo()
    and not exists (select 1 from public.contratos k where k.id = new.contrato_id
                    and (privado.sou_admin() or auth.uid() = k.criado_por or auth.uid() = k.responsavel_id
                         or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', privado.minha_pessoa()))))
    and not new.contrato_id = any(privado.contratos_em_que_me_mencionaram());
  return new;
end $function$;

-- 2. Quem pode ser mencionado no contrato, na demanda e na tarefa: as mesmas conferências e as mesmas mensagens que estavam no
--    "preparar", agora DEPOIS das regras de acesso (gatilho "after"). As menções já vêm achadas pelo "preparar". Lê o item sem
--    passar pelas regras dele (security definer), como antes. O erro desfaz o comando inteiro, inclusive as mensagens das menções.
create function privado.conferir_mencoes() returns trigger
language plpgsql security definer set search_path = '' as $$
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
                           or privado.perfil_no_contrato(p.id, d.contrato_id)))
      and not privado.perfil_no_contrato(p.id, t.contrato_id)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return null;
end $$;
revoke execute on function privado.conferir_mencoes() from public, anon, authenticated;
create trigger conferir_mencoes after insert or update of texto on public.comentarios
  for each row when (new.contrato_id is not null or new.demanda_id is not null or new.tarefa_id is not null)
  execute function privado.conferir_mencoes();

-- 3. No compromisso: a mesma conferência de 20261109140344_fase_de_adaptacao.sql, agora num gatilho "after" (o "before" de antes
--    sai no mesmo passo, para a conferência não rodar duas vezes nem antes das regras).
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
    and not exists (select 1 from public.processos x where x.id = c.processo_id
                    and (p.id = x.criado_por or p.id = x.responsavel_id or p.id = any(x.colaboradores)))
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % neste compromisso: inclua essa pessoa como participante antes.', v_nome;
  end if;
  return null;
end $function$;
revoke execute on function privado.mencao_no_compromisso() from public, anon, authenticated;
drop trigger preparar_mencao_no_compromisso on public.comentarios;
create trigger conferir_mencao_no_compromisso after insert or update of texto on public.comentarios
  for each row when (new.compromisso_id is not null) execute function privado.mencao_no_compromisso();

-- 4. Editar o próprio comentário exige ainda ver a demanda, a tarefa ou o compromisso dele (no contrato, a regra "alterar" já
--    exige, desde 20261104150227_visibilidade_dos_contratos.sql). Regra restritiva: vale junto com a "alterar" (as duas precisam
--    aceitar). A consulta a cada item passa pelas regras de leitura dele. Comentários de pessoas e de contratos não mudam.
create policy alterar_quem_ve_o_item on public.comentarios as restrictive for update to authenticated
  using ((demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id)));
