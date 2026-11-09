// Por enquanto, os dados importados ainda não estão vinculados aos advogados: com a chave "equipe_ve_tudo" do escritório, toda a equipe vê
// tarefas, demandas, processos e contratos (#271). Quem não está no cartão lê e comenta, mas não altera. A regra de verdade está no banco.
export const equipeVeTudo = (escritorio: { modulos?: Record<string, boolean> } | null | undefined) => !!escritorio?.modulos?.equipe_ve_tudo;

/** Com a chave ligada, a pessoa só lê este cartão? `estaNele` é a regra de cada módulo. Desligada, só aparece o que a pessoa já pode alterar. */
export const soLeOCartao = <P>(ctx: { escritorio?: { modulos?: Record<string, boolean> } | null; perfil: P }, estaNele: (pessoa: P) => boolean) =>
  equipeVeTudo(ctx.escritorio) && !estaNele(ctx.perfil);

/** O que a tela diz a quem vê o cartão sem estar nele. */
export const SO_LEITURA_DO_CARTAO = 'Por enquanto, toda a equipe vê este cartão. Você pode ler e comentar, mas não alterar.';
/** O processo ainda não tem comentários. */
export const SO_LEITURA_DO_PROCESSO = 'Por enquanto, toda a equipe vê este processo. Você pode ler, mas não alterar.';
/** O contrato de quem não é parte: os valores ficam ocultos. */
export const SO_LEITURA_DO_CONTRATO = 'Por enquanto, toda a equipe vê este contrato, sem os valores. Você pode ler e comentar, mas não alterar.';
/** No lugar do valor, para quem não é parte do contrato. */
export const VALOR_OCULTO = 'Oculto';
