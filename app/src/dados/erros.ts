// Erros do banco e do login em português, para a tela mostrar. Vale para qualquer erro que vier do Supabase.
// Erro novo é uma linha nova numa das listas abaixo. A ordem importa: vale a primeira regra que casar.
// Uma regra casa quando o código (se houver) e o padrão da mensagem (se houver) batem os dois.
import { INICIO_VAZIO } from '../regras/dataDeInicio';
import { recusaDeSairPeloGrupo } from '../regras/gruposDaEquipe';
import { MESMA_DEMANDA } from '../regras/demandasRelacionadas';
import { PASTA_COM_CONTEUDO, PASTA_NOME_LONGO, PASTA_REPETIDA, PASTA_SEM_NOME, PASTA_SUMIU } from '../regras/pastas';
import { CONTRATOS_DA_TAREFA_CHEIA, DEMANDAS_DA_TAREFA_CHEIA } from '../regras/tarefa';
import { SALA_REPETIDA } from '../regras/sala';

type ErroBanco = { message?: string; code?: string } | null | undefined;
interface Regra {
  codigo?: string;
  padrao?: RegExp;
  /** null: a própria mensagem do banco (as funções do banco já escrevem em português). Função: o texto feito da mensagem do banco. */
  mensagem: string | null | ((msg: string) => string);
}

/** A recusa de sempre do banco por falta de permissão (a linha que a regra RLS barra, ou a função que confere quem pode). */
export const SEM_PERMISSAO = 'Você não tem permissão para fazer isso.';
export const LINK_VENCIDO = 'Este link já foi usado ou venceu. Entre com sua senha ou peça um novo link.';
/**
 * A recusa de public.cartao_sair a quem está só por um grupo, como o banco a escreve (só cita o administrador): o nome do grupo vem
 * nela, e a tela mostra recusaDeSairPeloGrupo, que cita também a outra pessoa do cartão (#274).
 */
const SAIR_PELO_GRUPO = /^Você está neste cartão pelo grupo (.+?)\. Para sair, peça a um administrador/;

// Registro repetido (código 23505): a mensagem depende da restrição que barrou.
const REPETIDO: Regra[] = [
  { padrao: /pessoas_documento_unico/, mensagem: 'Já existe um cadastro com este CPF/CNPJ.' },
  { padrao: /pessoas_referencia_unica/, mensagem: 'Já existe um cadastro com esta referência de origem (de uma importação).' },
  { padrao: /quadro_colunas_nome_unico/, mensagem: 'Já existe uma coluna com esse nome neste quadro.' },
  { padrao: /convites_email_pendente/, mensagem: 'Este e-mail já tem um convite pendente.' },
  { padrao: /pessoa_vinculos_unico/, mensagem: 'Essas duas pessoas já têm esse vínculo.' },
  { padrao: /vinculo_tipos_unico/, mensagem: 'Esse tipo de vínculo já existe.' },
  { padrao: /lista_modelos_nome_unico/, mensagem: 'Já existe um modelo de checklist com esse nome.' },
  { padrao: /orgaos_sigla_unica/, mensagem: 'Já existe um órgão com essa sigla.' },
  { padrao: /quadro_grupos_nome_unico/, mensagem: 'Já existe um grupo com esse nome neste quadro.' },
  { padrao: /processos_numero_unico/, mensagem: 'Já existe um processo com esse número.' },
  { padrao: /processo_opcoes_unica/, mensagem: 'Essa opção já está na lista.' },
  { padrao: /processo_campos_nome_unico/, mensagem: 'Já existe um campo com esse nome.' },
  { padrao: /financeiro_contas_nome_unico/, mensagem: 'Já existe uma conta com esse nome.' },
  { padrao: /etiquetas_texto_unico/, mensagem: 'Já existe uma etiqueta com esse texto.' },
  { padrao: /etiquetas_cor_unica/, mensagem: 'Já existe uma etiqueta só de cor nessa cor.' },
  { padrao: /anotacao_pastas_nome_unico/, mensagem: PASTA_REPETIDA },
  { padrao: /salas_nome_unico/, mensagem: SALA_REPETIDA },
  { mensagem: 'Esse registro já existe.' }
];

const ERROS: Regra[] = [
  { codigo: '23502', padrao: /data_inicio/, mensagem: INICIO_VAZIO },
  { codigo: '23503', padrao: /perfis_pessoa_fkey/, mensagem: 'Esta pessoa é usuária do sistema e não pode ser excluída.' },
  { codigo: '23503', padrao: /contratos_(cliente|participante|indicador)_id_fkey|contrato_participantes_pessoa_id_fkey/, mensagem: 'Esta pessoa está em contratos e não pode ser excluída.' },
  { codigo: '23503', padrao: /demanda_clientes_pessoa_id_fkey/, mensagem: 'Esta pessoa está em demandas e não pode ser excluída.' },
  { codigo: '23503', padrao: /tarefa_pessoas_pessoa_id_fkey/, mensagem: 'Esta pessoa está em tarefas e não pode ser excluída.' },
  { codigo: '23503', padrao: /compromisso_pessoas_pessoa_id_fkey/, mensagem: 'Esta pessoa está em compromissos e não pode ser excluída.' },
  { codigo: '23503', padrao: /processo_clientes_pessoa_id_fkey/, mensagem: 'Esta pessoa está em processos e não pode ser excluída.' },
  { codigo: '23503', padrao: /anotacao_ligacoes_pessoa_id_fkey/, mensagem: 'Esta pessoa está ligada a anotações e não pode ser excluída.' },
  // Apagar a pasta com subpastas ou anotações (mesmo as que quem apaga não vê): as chaves das duas recusam (#342).
  { codigo: '23503', padrao: /update or delete on table "anotacao_pastas" violates foreign key constraint "(anotacao_pastas_mae_fkey|anotacoes_pasta_fkey)"/, mensagem: PASTA_COM_CONTEUDO },
  // Pôr a anotação ou uma pasta dentro de uma pasta que já não existe (um colega a apagou com a lista desta tela já lida).
  { codigo: '23503', padrao: /insert or update on table "(anotacoes|anotacao_pastas)" violates foreign key constraint "(anotacao_pastas_mae_fkey|anotacoes_pasta_fkey)"/, mensagem: PASTA_SUMIU },
  { codigo: '23503', padrao: /financeiro_(socios|repasses|retiradas)_pessoa_id_fkey|socio_do_recebimento_pessoa_id_fkey/, mensagem: 'Esta pessoa está no financeiro e não pode ser excluída.' },
  { codigo: '23503', padrao: /financeiro_recebimentos_(parcela|contrato)_id_fkey/, mensagem: 'Este contrato tem recebimentos e não pode ser excluído: eles ficam guardados no caixa.' },
  { codigo: '23514', padrao: /compromisso_tem_processo/, mensagem: 'Audiência e perícia precisam de um processo.' },
  // O nome da pasta vazio ou longo demais: as mesmas mensagens do banco fictício (#342).
  { codigo: '23514', padrao: /anotacao_pastas_nome_preenchido/, mensagem: PASTA_SEM_NOME },
  { codigo: '23514', padrao: /anotacao_pastas_nome_tamanho/, mensagem: PASTA_NOME_LONGO },
  { codigo: '23514', padrao: /demandas_relacionadas_em_ordem/, mensagem: MESMA_DEMANDA },
  // Demandas ou contratos demais na tarefa (#283): as mesmas mensagens do cadastro e do banco fictício.
  { codigo: '23514', padrao: /tarefas_demanda_ids_maximo/, mensagem: DEMANDAS_DA_TAREFA_CHEIA },
  { codigo: '23514', padrao: /tarefas_contrato_ids_maximo/, mensagem: CONTRATOS_DA_TAREFA_CHEIA },
  { codigo: '23514', mensagem: 'Algum campo está em formato inválido. Confira os dados e tente de novo.' },
  { codigo: '42501', mensagem: SEM_PERMISSAO },
  { padrao: /permission denied|row-level security/i, mensagem: SEM_PERMISSAO },
  { padrao: SAIR_PELO_GRUPO, mensagem: msg => recusaDeSairPeloGrupo(SAIR_PELO_GRUPO.exec(msg)?.[1] ?? '') },
  { codigo: 'P0001', mensagem: null },
  { padrao: /Invalid login credentials/i, mensagem: 'E-mail ou senha incorretos.' },
  // Antes da regra do código do aplicativo: esta mensagem traz o próprio e-mail, que pode conter "code".
  { codigo: 'email_address_invalid', mensagem: 'Este e-mail não é aceito. Confira e tente de novo.' },
  { codigo: 'otp_expired', mensagem: LINK_VENCIDO },
  { padrao: /Email link is invalid or has expired/i, mensagem: LINK_VENCIDO },
  { padrao: /Invalid TOTP|invalid.*code|code.*(expired|invalid)/i, mensagem: 'Código incorreto ou vencido. Digite o código que o aplicativo mostra agora.' },
  { padrao: /AAL2 required|aal2/i, mensagem: 'Para fazer isso, entre de novo com o código do aplicativo autenticador.' },
  { padrao: /Email not confirmed/i, mensagem: 'Confirme seu e-mail pelo link que enviamos antes de entrar.' },
  { codigo: 'email_exists', mensagem: 'Este e-mail já é usado em outra conta do SEMPER.' },
  { codigo: 'validation_failed', padrao: /Unable to validate email/i, mensagem: 'Informe um e-mail válido.' },
  { padrao: /already registered|already been registered/i, mensagem: 'Este e-mail já tem conta. Use "Entrar" ou recupere a senha.' },
  { padrao: /Database error saving new user/i, mensagem: 'Convite não encontrado ou vencido. Use o link mais recente que o escritório enviou para este e-mail, ou peça um novo ao administrador.' },
  { padrao: /Password should be/i, mensagem: 'A senha precisa ter pelo menos 8 caracteres.' },
  { padrao: /security purposes/i, mensagem: 'Aguarde um minuto e tente de novo.' },
  { padrao: /rate limit/i, mensagem: 'O limite de envio de e-mails foi atingido. Aguarde cerca de uma hora e tente de novo.' },
  { padrao: /Failed to fetch|NetworkError|Load failed/i, mensagem: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' },
  { padrao: /JWT expired|invalid JWT/i, mensagem: 'Sua sessão expirou. Entre de novo.' }
];

/** O texto de uma regra: o fixo, o feito da mensagem do banco, ou a própria mensagem (null). */
const textoDaRegra = (mensagem: Regra['mensagem'], msg: string) => typeof mensagem === 'function' ? mensagem(msg) : mensagem ?? msg;

export function traduzir(e: unknown): Error {
  const x = e as ErroBanco;
  const msg = String(x?.message || e || '');
  const cod = x?.code || '';
  const casa = (r: Regra) => (!r.codigo || r.codigo === cod) && (!r.padrao || r.padrao.test(msg));
  const repetido = cod === '23505' || /duplicate key/.test(msg);
  const regra = (repetido ? REPETIDO : ERROS).find(casa);
  const texto = regra ? textoDaRegra(regra.mensagem, msg) : 'Não foi possível concluir agora. Tente de novo.';
  return Object.assign(new Error(texto), { original: e });
}
