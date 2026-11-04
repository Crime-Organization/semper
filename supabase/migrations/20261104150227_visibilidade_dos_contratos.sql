-- =====================================================================
-- Visibilidade dos contratos (#107)
--   O contrato passa a ser visto só por quem o criou, pelo responsável,
--   pelos participantes, pelos administradores do escritório e por quem
--   outra pessoa mencionou num comentário dele. Regra combinada em
--   29/10/2026; a menção, decidida em 04/11/2026. O indicador não entra:
--   ele vê o que recebe em Meus valores, não o contrato.
--
--   Quem foi mencionado lê e comenta, mas não altera. O acesso dura enquanto
--   a menção existir: se o comentário for editado ou apagado, ele deixa de
--   ver. Mencionar a si mesmo não conta, senão quem saiu do contrato voltaria
--   a vê-lo editando um comentário antigo.
--
--   Seguem o contrato as tabelas ligadas a ele que ainda eram abertas ao
--   escritório: histórico, clientes e participantes. Comentários e
--   etiquetas já consultam o contrato pelas regras dele, e parcelas e
--   recebimentos continuam só de quem cuida do contrato (cuido_do_contrato).
--   Pessoas continua comum a todos. Na demanda e na tarefa fica a cópia do
--   número (contrato_codigo): quem está nelas vê que há um contrato ligado,
--   mas não consegue abri-lo.
--
--   Quem deixaria de ver o contrato com a própria alteração recebe erro (a
--   leitura confere também a linha nova), como nas demandas e nos processos:
--   um responsável que não criou o contrato não o passa a outro advogado
--   sem continuar nele; um administrador passa.
--
--   Só acrescenta: uma função e um índice novos, e regras mais fechadas.
--   Nenhuma tabela ou coluna muda, e a versão anterior do site continua
--   funcionando: quem não é administrador só passa a ver menos.
-- =====================================================================

-- Os contratos em que outra pessoa mencionou quem está logado. Lê os comentários sem passar pelas regras
-- deles: a regra de leitura dos comentários consulta os contratos, e daria recursão.
create index comentarios_mencoes_em_contratos on public.comentarios using gin (mencoes) where contrato_id is not null;

create function privado.contratos_em_que_me_mencionaram() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct c.contrato_id), '{}')
  from public.comentarios c
  where c.contrato_id is not null
    and c.mencoes @> array[auth.uid()]
    and c.escritorio_id = privado.meu_escritorio()
    and c.autor_id is distinct from auth.uid()
$$;
revoke execute on function privado.contratos_em_que_me_mencionaram() from public, anon;
grant execute on function privado.contratos_em_que_me_mencionaram() to authenticated;

-- A lista de participantes é lida da própria linha, e não de contrato_participantes: a regra de leitura
-- de lá consulta os contratos (daria recursão), e ela só é copiada depois de gravar. Quem grava só as
-- colunas antigas (a versão anterior do site) também entra aqui: o gatilho participantes monta a lista.
-- As consultas entre parênteses rodam uma vez por leitura, e não uma vez por contrato (como faria uma
-- função no estilo de vejo_processo): o quadro lê os contratos várias vezes ao abrir.
alter policy leitura on public.contratos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
              or id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[])));
-- A mesma regra, sem a menção: quem foi mencionado só lê. Sem ela, uma alteração sem filtro (que não passa
-- pela regra de leitura) alcançaria os contratos alheios.
alter policy alterar on public.contratos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))));

-- O histórico, os clientes e os participantes seguem quem vê o contrato.
alter policy leitura on public.contrato_historico
  using (exists (select 1 from public.contratos k where k.id = contrato_id));
alter policy leitura on public.contrato_clientes
  using (exists (select 1 from public.contratos k where k.id = contrato_id));
alter policy leitura on public.contrato_participantes
  using (exists (select 1 from public.contratos k where k.id = contrato_id));

-- Quem não vê mais o contrato não edita os próprios comentários nele: com a menção dando acesso, editar um
-- comentário antigo daria o contrato a um colega. Uma alteração sem filtro não passa pela regra de leitura.
alter policy alterar on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
         and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id)));
