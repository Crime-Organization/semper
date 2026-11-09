// Por enquanto, os dados importados ainda não estão vinculados aos advogados: com a chave "equipe_ve_tudo" do escritório, toda a equipe vê
// tarefas, demandas, processos e contratos (#271). Quem não está no cartão lê e comenta, mas não altera. A regra de verdade está no banco.
export const equipeVeTudo = (escritorio: { modulos?: Record<string, boolean> } | null | undefined) => !!escritorio?.modulos?.equipe_ve_tudo;

/** Fase de adaptação (#275): toda a equipe edita tudo, menos o financeiro. */
export const equipeEditaTudo = (escritorio: { modulos?: Record<string, boolean> } | null | undefined) => !!escritorio?.modulos?.equipe_edita_tudo;

/** Com a chave ligada, a pessoa só lê este cartão? `estaNele` é a regra de cada módulo. Desligada, só aparece o que a pessoa já pode alterar. */
export const soLeOCartao = <P>(ctx: { escritorio?: { modulos?: Record<string, boolean> } | null; perfil: P }, estaNele: (pessoa: P) => boolean) =>
  equipeVeTudo(ctx.escritorio) && !equipeEditaTudo(ctx.escritorio) && !estaNele(ctx.perfil);

/** Na fase de adaptação, o advogado pode entrar nos processos e marcar audiência em qualquer um (#273). */
export const advogadoNaAdaptacao = (ctx: { escritorio?: { modulos?: Record<string, boolean> } | null; perfil: { funcao: string } | null }) =>
  equipeVeTudo(ctx.escritorio) && ctx.perfil?.funcao === 'advogado';

/** O que a tela diz a quem vê o cartão sem estar nele. */
export const SO_LEITURA_DO_CARTAO = 'Por enquanto, toda a equipe vê este cartão. Você pode ler e comentar, mas não alterar.';
/** O processo ainda não tem comentários. */
export const SO_LEITURA_DO_PROCESSO = 'Por enquanto, toda a equipe vê este processo. Você pode ler, mas não alterar.';
/** Quem está fora do processo não vê os compromissos dos outros: "nenhum" faria alguém marcar a mesma audiência de novo. */
export const SEM_COMPROMISSO_VISIVEL = 'Nenhum compromisso que você possa ver. Quem está no processo pode ter marcado audiências: entre nele para vê-las antes de marcar outra.';
/** Ao advogado que ainda não está no processo. */
export const SO_LEITURA_DO_PROCESSO_ADVOGADO = 'Por enquanto, toda a equipe vê este processo. Para alterar, entre nele.';
/** O contrato de quem não é parte: os valores ficam ocultos. */
export const SO_LEITURA_DO_CONTRATO = 'Por enquanto, toda a equipe vê este contrato, sem os valores. Você pode ler e comentar, mas não alterar.';
/** Na fase de adaptação, quem não é parte edita o contrato, sem os valores. */
export const EDITA_SEM_OS_VALORES = 'Por enquanto, toda a equipe vê e edita este contrato, menos os valores, o responsável e os participantes.';
/** No lugar do valor, para quem não é parte do contrato. */
export const VALOR_OCULTO = 'Oculto';
