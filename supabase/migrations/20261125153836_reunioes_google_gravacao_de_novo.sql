-- =====================================================================
-- Google Meet no compromisso (tarefa #437), correção da revisão: a gravação recusada é tentada de novo
--   A função google-agendas guarda a gravação como 'recusada' (sem nova tentativa) só quando o Google a recusa de vez (a
--   edição do Workspace que não grava, a permissão negada pelo administrador do Workspace). Se o administrador mudar isso
--   depois, o "Sincronizar agora" em Configurações tenta de novo a gravação das reuniões de hoje em diante, como já faz com
--   os compartilhamentos recusados.
--   Só acrescenta: uma função refeita com a mesma assinatura e o mesmo comportamento, mais o que é dito nela. A versão
--   anterior do site continua funcionando: ela só chama a função do servidor, que chama esta.
-- =====================================================================

-- Como antes (20261125115138_agendas_google_recusas.sql); e a gravação recusada das reuniões de hoje em diante (no relógio de
-- Brasília) da conta ligada é esquecida, e o compromisso vai para a fila, para a gravação ser pedida de novo.
create or replace function public.agendas_google_agora(p_usuario uuid, p_nivel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.escritorio_do_admin(p_usuario, p_nivel);
        v uuid;
begin
  if v_escritorio is null or not exists (select 1 from privado.ligacoes l where l.escritorio_id = v_escritorio and l.perfil_id is null
                                         and l.provedor = 'google' and l.agendas_ativas and privado.agenda_autorizada(l.escopos)) then
    return null;
  end if;
  update privado.ligacoes l set agendas_problema = null, agendas_problema_em = null
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
  delete from public.agenda_google_recusas r where r.escritorio_id = v_escritorio;
  for v in update public.agenda_google_reunioes r set gravacao = null, gravacao_detalhe = null, atualizada_em = now()
           from public.compromissos m, privado.ligacoes l
           where r.escritorio_id = v_escritorio and r.gravacao = 'recusada' and m.id = r.compromisso_id and m.escritorio_id = v_escritorio
             and m.data >= (now() at time zone 'America/Sao_Paulo')::date
             and l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google' and l.conta_email = r.conta_email
           returning r.compromisso_id loop
    perform privado.agendas_google_enfileirar(v_escritorio, 'compromisso', v);
  end loop;
  perform privado.agendas_google_enfileirar(v_escritorio, 'agendas', null);
  update public.agendas_google_fila f set proxima_em = now()
  where f.escritorio_id = v_escritorio and (f.em_andamento_ate is null or f.em_andamento_ate < now());
  return v_escritorio;
end $$;
