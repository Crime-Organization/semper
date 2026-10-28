// Tempos da interface, em milissegundos, com as unidades por nome (5 * SEGUNDO em vez de 5000).
export const SEGUNDO = 1000;
export const MINUTO = 60 * SEGUNDO;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

/** Quanto tempo cada aviso fica no pé da tela: erro e aviso com botão (ex.: "Desfazer") ficam mais. */
export const DURACAO_AVISO = { ok: 3.5 * SEGUNDO, comAcao: 8 * SEGUNDO, erro: 6 * SEGUNDO };
/** Espera depois da última tecla antes de buscar (busca da tabela e busca de pessoa). */
export const ESPERA_AO_DIGITAR = 300;
/** Excluir em dois cliques: quanto tempo o pedido de confirmação fica valendo. */
export const PRAZO_PARA_CONFIRMAR = 4 * SEGUNDO;
