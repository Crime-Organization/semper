-- =====================================================================
-- Comentários nas anotações, como nos outros cartões (#364)
--   - O comentário de uma anotação usa a mesma tabela public.comentarios, com a coluna nova anotacao_id (o padrão de cada módulo:
--     uma coluna de ligação, com o seu índice, e a regra comentario_de_um_cartao contando a coluna nova).
--   - A ligação vai pelo par anotação e escritório: o comentário é sempre do escritório da anotação (nunca de outro). Excluir a
--     anotação (só a arquivada, por quem a criou ou por um administrador) apaga os comentários dela, e com eles as mensagens das
--     menções (on delete cascade, como nos outros módulos). Arquivar não mexe nos comentários.
--   - Ler e comentar segue quem VÊ a anotação (a consulta à anotação passa pela regra de leitura dela, de
--     20261117143714_anotacoes.sql): quem a vê só por um item ligado também comenta, como nos outros módulos, em que quem vê o
--     cartão comenta. Editar o próprio comentário também exige ver a anotação (como no banco fictício e no contrato); apagar (o
--     próprio, ou qualquer um, sendo administrador) continua como está.
--   - Só se menciona quem vê a anotação por estar nela (quem a criou, o responsável e os participantes), os administradores, e
--     todos com a chave "equipe_ve_tudo" ou "equipe_edita_tudo". Quem a vê só por um item ligado não é mencionado (o banco não
--     tem como saber, pela regra de cada módulo, o que outra pessoa vê): a mensagem pede para incluí-la como participante.
--     Essa conferência roda DEPOIS das regras de acesso (gatilho "after"): quem não vê a anotação, ou é de outro escritório,
--     recebe sempre a mesma recusa das regras, e nunca fica sabendo se ela existe nem quem está nela.
--   - A caixa de mensagens não muda: o gatilho privado.mensagens_do_comentario vale para qualquer comentário.
--   - O texto da anotação passa a caber 200 mil caracteres (bloco 6): a regra antiga, de 20 mil, é trocada no mesmo comando por
--     uma mais larga. É a única coisa retirada, e só afrouxa: tudo o que a versão anterior do site grava continua cabendo.
--
--   Só acrescenta: uma coluna (nula), uma restrição única e um índice novos, uma função e um gatilho novos, e uma condição a mais
--   na regra comentario_de_um_cartao e nas regras de leitura, de incluir e de alterar dos comentários. A versão anterior do site
--   continua funcionando: ela não conhece a coluna nova, que fica vazia em tudo o que ela grava e lê; para os comentários dela
--   (que nunca têm anotacao_id), a regra de um cartão e as regras de leitura, de incluir e de alterar dizem o mesmo de antes.
-- =====================================================================

-- 1. A anotação ganha a chave única (id, escritório), para a ligação ir pelo par (como a pasta da anotação e as etiquetas).
--    O id já é único sozinho: o par também é, e nenhuma linha que existe é recusada.
alter table public.anotacoes add constraint anotacoes_id_escritorio_unico unique (id, escritorio_id);

-- 2. A coluna de ligação e o índice, como as dos outros módulos (on delete cascade: o comentário some com a anotação).
alter table public.comentarios add column anotacao_id uuid;
alter table public.comentarios add constraint comentarios_anotacao_fkey
  foreign key (anotacao_id, escritorio_id) references public.anotacoes (id, escritorio_id) on delete cascade;
create index comentarios_da_anotacao on public.comentarios (anotacao_id, criado_em desc) where anotacao_id is not null;

-- 3. Exatamente um cartão, agora contando a anotação. Trocar uma regra check é tirar e pôr de novo, num comando só (nada grava
--    entre os dois). A regra nova aceita tudo o que a antiga aceitava: num comentário sem anotação (todos os de hoje e todos os
--    que a versão anterior do site grava), num_nonnulls conta o mesmo, e "= 1" continua valendo igual. Ela só passa a aceitar,
--    além disso, o comentário que tem só a anotação.
alter table public.comentarios
  drop constraint comentario_de_um_cartao,
  add constraint comentario_de_um_cartao check (num_nonnulls(pessoa_id, contrato_id, demanda_id, tarefa_id, compromisso_id, anotacao_id) = 1);

-- 4. Quem vê a anotação vê, escreve e edita (os seus) comentários dela (iguais às de 20261109102349_equipe_ve_tudo.sql, com a
--    última linha a mais). Sem a condição na de alterar, quem saiu da anotação ainda editaria o próprio comentário nela.
alter policy leitura on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id))
         and (anotacao_id is null or exists (select 1 from public.anotacoes a where a.id = anotacao_id)));
alter policy incluir on public.comentarios
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id))
         and (anotacao_id is null or exists (select 1 from public.anotacoes a where a.id = anotacao_id)));
alter policy alterar on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (anotacao_id is null or exists (select 1 from public.anotacoes a where a.id = anotacao_id)));

-- 5. Quem pode ser mencionado na anotação. Roda DEPOIS de gravar (gatilho "after"), e portanto depois das regras de incluir e de
--    alterar: só chega aqui quem é do escritório e vê a anotação. Um gatilho "before" rodaria antes da conferência das regras, e
--    a mensagem de menção contaria, a quem não vê a anotação ou é de outro escritório, que ela existe e quem está nela. As menções
--    já vêm achadas pelo gatilho "preparar". Lê a anotação sem passar pelas regras dela (security definer); o erro desfaz tudo,
--    inclusive as mensagens das menções.
create function privado.mencao_na_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.anotacoes a
  where a.id = new.anotacao_id and a.escritorio_id = new.escritorio_id and p.id = any(new.mencoes)
    and not privado.equipe_ve_tudo() and not privado.equipe_edita_tudo() and p.papel not in ('master', 'admin')
    and p.id is distinct from a.criado_por and p.id <> a.responsavel_id and not p.id = any(a.participantes)
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % nesta anotação: inclua essa pessoa como participante antes.', v_nome;
  end if;
  return null;
end $$;
revoke execute on function privado.mencao_na_anotacao() from public, anon, authenticated;
create trigger conferir_mencao_na_anotacao after insert or update of texto on public.comentarios
  for each row when (new.anotacao_id is not null) execute function privado.mencao_na_anotacao();

-- 6. O texto da anotação passa de 20 mil para 200 mil caracteres: quem escreve artigos (de uns 40 mil) não cabia (#364). A regra
--    check sem nome de 20261117143714_anotacoes.sql (o banco a chamou de anotacoes_texto_check) sai, e entra no lugar a regra
--    nomeada anotacoes_texto_tamanho, num comando só (nada grava entre as duas). Só AFROUXA: todo texto que valia (até 20 mil)
--    continua valendo, e nenhuma linha que existe é recusada. A versão anterior do site continua funcionando: ela limita o texto
--    a 20 mil na tela, e tudo o que ela grava cabe na regra nova. A tela nova limita a 200 mil (TAMANHO_ANOTACAO.texto em
--    app/src/dados/limites.ts). Nenhuma função do banco corta ou confere o tamanho do texto (o histórico guarda só que ele
--    mudou, sem copiá-lo; a busca é um índice gin de trigramas, que não tem limite de tamanho), então nada mais muda.
alter table public.anotacoes
  drop constraint anotacoes_texto_check,
  add constraint anotacoes_texto_tamanho check (length(texto) <= 200000);
