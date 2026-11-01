// Erros do banco e do login em português, para a tela mostrar. Vale para qualquer erro que vier do Supabase.
// Erro novo é uma linha nova numa das listas abaixo. A ordem importa: vale a primeira regra que casar.
// Uma regra casa quando o código (se houver) e o padrão da mensagem (se houver) batem os dois.
type ErroBanco = { message?: string; code?: string } | null | undefined;
interface Regra {
  codigo?: string;
  padrao?: RegExp;
  /** null: a própria mensagem do banco (as funções do banco já escrevem em português). */
  mensagem: string | null;
}

// Registro repetido (código 23505): a mensagem depende da restrição que barrou.
const REPETIDO: Regra[] = [
  { padrao: /pessoas_documento_unico/, mensagem: 'Já existe um cadastro com este CPF/CNPJ.' },
  { padrao: /pessoas_referencia_unica/, mensagem: 'Já existe um cadastro com esta referência de origem (de uma importação).' },
  { padrao: /quadro_colunas_nome_unico/, mensagem: 'Já existe uma coluna com esse nome neste quadro.' },
  { padrao: /convites_email_pendente/, mensagem: 'Este e-mail já tem um convite pendente.' },
  { padrao: /pessoa_vinculos_unico/, mensagem: 'Essas duas pessoas já têm esse vínculo.' },
  { padrao: /vinculo_tipos_unico/, mensagem: 'Esse tipo de vínculo já existe.' },
  { padrao: /lista_modelos_nome_unico/, mensagem: 'Já existe um modelo de lista com esse nome.' },
  { padrao: /orgaos_sigla_unica/, mensagem: 'Já existe um órgão com essa sigla.' },
  { padrao: /quadro_grupos_nome_unico/, mensagem: 'Já existe um grupo com esse nome neste quadro.' },
  { mensagem: 'Esse registro já existe.' }
];

const ERROS: Regra[] = [
  { codigo: '23503', padrao: /perfis_pessoa_fkey/, mensagem: 'Esta pessoa é usuária do sistema e não pode ser excluída.' },
  { codigo: '23503', padrao: /contratos_(cliente|participante|indicador)_id_fkey|contrato_participantes_pessoa_id_fkey/, mensagem: 'Esta pessoa está em contratos e não pode ser excluída.' },
  { codigo: '23503', padrao: /demanda_clientes_pessoa_id_fkey/, mensagem: 'Esta pessoa está em demandas e não pode ser excluída.' },
  { codigo: '23503', padrao: /tarefa_pessoas_pessoa_id_fkey/, mensagem: 'Esta pessoa está em tarefas e não pode ser excluída.' },
  { codigo: '23514', mensagem: 'Algum campo está em formato inválido. Confira os dados e tente de novo.' },
  { codigo: '42501', mensagem: 'Você não tem permissão para fazer isso.' },
  { padrao: /permission denied|row-level security/i, mensagem: 'Você não tem permissão para fazer isso.' },
  { codigo: 'P0001', mensagem: null },
  { padrao: /Invalid login credentials/i, mensagem: 'E-mail ou senha incorretos.' },
  { padrao: /Invalid TOTP|invalid.*code|code.*(expired|invalid)/i, mensagem: 'Código incorreto ou vencido. Digite o código que o aplicativo mostra agora.' },
  { padrao: /AAL2 required|aal2/i, mensagem: 'Para fazer isso, entre de novo com o código do aplicativo autenticador.' },
  { padrao: /Email not confirmed/i, mensagem: 'Confirme seu e-mail pelo link que enviamos antes de entrar.' },
  { padrao: /already registered|already been registered/i, mensagem: 'Este e-mail já tem conta. Use "Entrar" ou recupere a senha.' },
  { padrao: /Database error saving new user/i, mensagem: 'Convite não encontrado ou vencido. Use o link mais recente que o escritório enviou para este e-mail, ou peça um novo ao administrador.' },
  { padrao: /Password should be/i, mensagem: 'A senha precisa ter pelo menos 8 caracteres.' },
  { padrao: /rate limit|security purposes/i, mensagem: 'O limite de envio de e-mails foi atingido. Aguarde cerca de uma hora e tente de novo.' },
  { padrao: /Failed to fetch|NetworkError|Load failed/i, mensagem: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' },
  { padrao: /JWT expired|invalid JWT/i, mensagem: 'Sua sessão expirou. Entre de novo.' }
];

export function traduzir(e: unknown): Error {
  const x = e as ErroBanco;
  const msg = String(x?.message || e || '');
  const cod = x?.code || '';
  const casa = (r: Regra) => (!r.codigo || r.codigo === cod) && (!r.padrao || r.padrao.test(msg));
  const repetido = cod === '23505' || /duplicate key/.test(msg);
  const regra = (repetido ? REPETIDO : ERROS).find(casa);
  const texto = regra ? regra.mensagem ?? msg : 'Não foi possível concluir agora. Tente de novo.';
  return Object.assign(new Error(texto), { original: e });
}
