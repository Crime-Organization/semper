// Tempos da interface, em milissegundos, com as unidades por nome (5 * SEGUNDO em vez de 5000).
export const SEGUNDO = 1000;
export const MINUTO = 60 * SEGUNDO;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

/** Quanto tempo cada aviso fica no pé da tela: erro e aviso com botão (ex.: "Desfazer") ficam mais. */
export const DURACAO_AVISO = { ok: 3.5 * SEGUNDO, comAcao: 8 * SEGUNDO, erro: 6 * SEGUNDO };
/** Espera depois da última tecla antes de buscar (busca da tabela e busca de pessoa). */
export const ESPERA_AO_DIGITAR = 300;
/** O texto da anotação salva sozinho: depois desta pausa sem digitar, o que mudou é gravado (como no Obsidian). */
export const ESPERA_PARA_SALVAR = 1.5 * SEGUNDO;
/**
 * O editor ao vivo espera este tempo depois de um clique antes de mostrar os sinais escondidos da linha (que empurram o texto):
 * assim o segundo clique de um clique duplo ainda cai na palavra que a pessoa viu. É o tempo do clique duplo do Windows.
 */
export const ESPERA_DO_CLIQUE_DUPLO = 0.5 * SEGUNDO;
/**
 * O histórico da anotação junta numa linha só as gravações seguidas do texto pela mesma pessoa, quando cada uma veio até este
 * tempo depois da anterior: uma sessão de escrita aparece como um "Texto alterado", e não como dezenas.
 */
export const JUNTAR_TEXTO_NO_HISTORICO = 10 * MINUTO;
/**
 * Arrastar com o dedo (#370): segurar o dedo parado este tempo começa o arrasto. Antes disso, mexer o dedo rola a lista, como
 * em qualquer página no celular.
 */
export const SEGURAR_PARA_ARRASTAR = 0.4 * SEGUNDO;
/** Excluir em dois cliques: quanto tempo o pedido de confirmação fica valendo. */
export const PRAZO_PARA_CONFIRMAR = 4 * SEGUNDO;

/** Cronômetro das tarefas: sem mexer por este tempo, aparece "Você ainda está aqui?". */
export const INATIVIDADE_DO_CRONOMETRO = 10 * MINUTO;
/** Cronômetro das tarefas: de quanto em quanto tempo o período que está sendo contado é gravado no banco. */
export const GRAVAR_TEMPO_A_CADA = MINUTO;
/** Cronômetro das tarefas: de quanto em quanto tempo o relógio do cartão anda e confere a inatividade. */
export const TIQUE_DO_CRONOMETRO = SEGUNDO;

/** Aviso de versão nova: de quanto em quanto tempo a aba aberta confere a versão que está no ar (/versao.txt). */
export const CONFERIR_VERSAO_A_CADA = 5 * MINUTO;

/** Caixa de mensagens: de quanto em quanto tempo a aba aberta confere o número de não lidas. */
export const CONFERIR_MENSAGENS_A_CADA = MINUTO;

/** De quanto em quanto tempo a aba aberta confere se a sessão ainda existe, para não mostrar listas vazias a quem perdeu o acesso. */
export const CONFERIR_SESSAO_A_CADA = MINUTO;
