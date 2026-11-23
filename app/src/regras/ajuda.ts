// A ajuda de cada tela de módulo (#85): o botão "?" do cabeçalho (e a tecla "?") abre uma janela com estas frases em cima e os
// atalhos de teclado embaixo. Decisão do dono (22/11/2026): os textos são iguais para todos os escritórios, escritos aqui, curtos e
// em português simples. Por isso não citam o nome de nenhum escritório, nem os nomes das colunas do quadro (cada escritório muda os
// seus), nem prometem quem vê o quê fora das telas que são só de administradores.
// Tela nova com página de módulo = uma entrada nova na tabela. Reveja estes textos quando a tela mudar, como o manual em docs/manual.

/** As telas de módulo que têm ajuda. */
export type ModuloComAjuda =
  | 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'processos' | 'agenda' | 'documentos'
  | 'contas' | 'lucros' | 'meusValores' | 'conferencia';

/** O mínimo e o máximo de parágrafos de cada ajuda: "três ou quatro frases sobre a tela" (#85), algumas com duas orações curtas. */
export const PARAGRAFOS_DA_AJUDA = { minimo: 3, maximo: 4 } as const;
/** O tamanho máximo de um parágrafo, em letras: mais que isso já não é "curto" para ler numa janela pequena. */
export const LETRAS_DO_PARAGRAFO = 200;

/** Os parágrafos da ajuda de cada tela, na ordem em que aparecem. */
export const AJUDA: Record<ModuloComAjuda, readonly string[]> = {
  pessoas: [
    'Aqui ficam as pessoas do escritório: os clientes e os outros contatos.',
    'Na Tabela você busca, filtra e marca várias pessoas para agir de uma vez.',
    'No Kanban você acompanha o atendimento, arrastando cada pessoa de uma coluna para outra conforme a conversa avança.',
    'Clique no nome para abrir o cartão, com tudo o que está ligado à pessoa: contratos, demandas, tarefas e compromissos.'
  ],
  contratos: [
    'Cada contrato liga o cliente ao advogado responsável, ao que foi contratado e aos honorários.',
    'No Kanban você move o contrato conforme a situação dele. Quando ele é assinado, cada objeto contratado vira uma demanda.',
    'Clique no contrato para ver as parcelas, as pessoas e as demandas ligadas a ele.',
    'Arquivar tira o contrato da lista sem apagá-lo, e o Ctrl+Z desfaz logo depois.'
  ],
  demandas: [
    'Demandas são os serviços em andamento, quase sempre nascidos de um contrato assinado.',
    'Cada uma tem um responsável, colaboradores, clientes e um prazo.',
    'No Kanban arraste a demanda de uma coluna para outra, ou clique no círculo antes do título para concluí-la.',
    'Para dividir o trabalho em passos menores, crie tarefas dentro dela.'
  ],
  tarefas: [
    'Tarefas são as partes pequenas do trabalho, como emitir uma guia ou ligar para o cliente.',
    'Cada uma tem responsável, participantes e prazo, e pode estar ligada a demandas, contratos ou pessoas.',
    'No Kanban arraste a tarefa de uma coluna para outra, ou clique no círculo antes do título para concluí-la.',
    'No cartão da tarefa, o cronômetro marca o tempo gasto nela.'
  ],
  processos: [
    'Cada tipo de processo (judicial, administrativo, extrajudicial e investigação) tem o seu quadro, com colunas próprias.',
    'Cadastre o processo pelo número e ligue a ele as pessoas envolvidas.',
    'No Kanban mova o processo pela fase em que ele está. Na Tabela, busque pelo número, pelo cliente ou pela comarca.',
    'Clique no processo para ver os andamentos e tudo o que está ligado a ele.'
  ],
  agenda: [
    'A agenda reúne os compromissos do escritório, como audiências, reuniões e atendimentos.',
    'Veja por dia, semana ou mês, ou use a Tabela e o Kanban para tratar vários de uma vez.',
    'Cada compromisso pode ter participantes, sala e ligação com pessoas, processos, demandas e tarefas.',
    'Clique num compromisso para abrir o cartão e mudar a data, a hora ou a situação.'
  ],
  documentos: [
    'Aqui ficam as anotações do escritório, organizadas em pastas na coluna da esquerda.',
    'Cada anotação pode ser ligada a pessoas, processos, contratos, demandas, tarefas e compromissos, e aparece também no cartão deles.',
    'Para mudar uma anotação de pasta, arraste-a na coluna da esquerda.',
    'A busca procura no título e no texto das anotações.'
  ],
  // A página "Contas, DAS e sócios" (#331: era o Caixa antigo), aberta pelo botão "Contas e DAS" do Financeiro.
  contas: [
    'Esta tela mostra cada conta do escritório, mês a mês, com o saldo depois de cada lançamento.',
    'Compare o saldo do fim de cada dia com o extrato do banco. As entradas e as saídas do dia a dia se lançam no Financeiro.',
    'Aqui ficam o ajuste de saldo, o repasse entre contas, as contas, o DAS de cada mês e os sócios.',
    'Só os administradores veem esta tela.'
  ],
  lucros: [
    'Aqui está quanto cada sócio acumulou de lucro em cada mês, quanto já foi pago e quanto falta pagar.',
    'O lucro como responsável e o lucro como indicador ficam em tabelas separadas e nunca se somam.',
    'A transferência da conta da empresa para a pessoa física do sócio não conta como lucro.',
    'Só os administradores veem esta tela.'
  ],
  meusValores: [
    'Aqui você vê a sua parte em cada recebimento do escritório, pelo papel que teve no contrato.',
    'Cada linha mostra se o valor já foi pago a você.',
    'Você vê só os seus valores, nunca os dos colegas nem o caixa.'
  ],
  conferencia: [
    'A conferência mostra os lançamentos como numa planilha, para cada responsável conferir as próprias linhas.',
    'Corrija o que foi pago e marque Confere ou Não confere em cada linha.',
    'O administrador vê também o resumo de todos.',
    'Corrigir aqui nunca muda o caixa.'
  ]
};
