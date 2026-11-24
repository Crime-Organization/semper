-- =====================================================================
-- Compromisso que se repete: o lápis muda o título, o local, a equipe e as pessoas "desta e das seguintes" (#417)
--   Antes, o "só esta / esta e as seguintes" valia só para a data e o horário (compromisso_mudar_seguintes) e para arquivar
--   (compromisso_arquivar_seguintes); o título, o local, a equipe e as pessoas mudavam só na data aberta. Agora a tela, depois de gravar
--   a data aberta como sempre, chama compromisso_mudar_campos_seguintes com os campos que mudaram, e eles passam às datas seguintes da
--   série ainda em aberto (as realizadas, canceladas e arquivadas não mudam), com as mesmas regras de "esta e as seguintes":
--     - só quem muda o compromisso, e só quando muda todas as datas seguintes em aberto (privado.altero_as_datas_em_aberto, de
--       20261123011949_repeticao_so_quem_muda_as_datas.sql); a recusa é a mesma mensagem (SEGUINTES_DE_OUTROS em app/src/regras/repeticao.ts);
--     - só estes campos: titulo, local, responsavel_id, participantes e pessoas (CAMPOS_DAS_SEGUINTES no mesmo arquivo); outro campo é recusado;
--     - a data aberta não muda aqui: a tela já a gravou (com as regras de sair do cartão, #276).
--   O gatilho privado.preparar_compromisso continua conferindo cada data: textos limpos, pessoas e equipe do escritório, o responsável
--   fora dos participantes. As datas que o banco muda não mandam aviso de inclusão (o gatilho só avisa quem grava pela tela), como as que
--   ele cria: quem entra recebe um aviso só, o da data aberta. As datas novas da série copiam a última, que já tem os campos novos.
--
--   Dar repetição a um compromisso que já existe (compromisso_repetir) e ligar ou desligar a demanda (compromisso_gerar_demandas, que
--   aceita null) já existiam: o cartão passa a chamá-las pelo lápis, sem mudança no banco.
--
--   Só acrescenta: uma função nova. A versão anterior do site continua funcionando: ela não a chama.
-- =====================================================================

create function public.compromisso_mudar_campos_seguintes(p_id uuid, p_campos jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.compromissos; v_ids uuid[];
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Este compromisso não se repete.';
  end if;
  if jsonb_typeof(p_campos) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_campos) k where k <> all (array['titulo', 'local', 'responsavel_id', 'participantes', 'pessoas'])) then
    raise exception 'Só o título, o local, a equipe e as pessoas mudam nas datas seguintes.';
  end if;
  if not privado.altero_as_datas_em_aberto(c.repeticao_id, c.repeticao_data, null) then
    raise exception 'Há datas seguintes desta repetição que você não pode mudar. Mude só esta data ou peça a quem cuida da repetição.';
  end if;
  v_ids := array_remove(privado.esta_e_as_seguintes(c), c.id);
  if cardinality(v_ids) = 0 or p_campos = '{}'::jsonb then
    return 0;
  end if;
  update public.compromissos x set
    titulo = case when p_campos ? 'titulo' then p_campos ->> 'titulo' else x.titulo end,
    local = case when p_campos ? 'local' then p_campos ->> 'local' else x.local end,
    responsavel_id = case when p_campos ? 'responsavel_id' then (p_campos ->> 'responsavel_id')::uuid else x.responsavel_id end,
    participantes = case when p_campos ? 'participantes'
                      then array(select v::uuid from jsonb_array_elements_text(p_campos -> 'participantes') v) else x.participantes end,
    pessoas = case when p_campos ? 'pessoas' then array(select v::uuid from jsonb_array_elements_text(p_campos -> 'pessoas') v) else x.pessoas end
  where x.id = any(v_ids);
  return cardinality(v_ids);
end $$;
revoke execute on function public.compromisso_mudar_campos_seguintes(uuid, jsonb) from public, anon;
grant execute on function public.compromisso_mudar_campos_seguintes(uuid, jsonb) to authenticated;
