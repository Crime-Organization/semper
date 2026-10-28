// Posição de um cartão na ordem manual do quadro (arrastando). A ordem é um número: entre dois cartões vale a média
// dos dois (veja Kanban.tsx). Quem entra numa coluna sem lugar escolhido vai para o fim; como os números da ordem
// manual são bem menores que o relógio, "agora" em segundos é sempre maior que todos e cada novo fica depois do anterior.
export const ordemNoFim = () => Date.now() / 1000;
