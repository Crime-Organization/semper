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
    'O processo é judicial ou administrativo, e cada tipo tem o seu quadro, com colunas próprias.',
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

// A ajuda das telas que não são de módulo (#411): o mesmo botão "?" ao lado do título e a mesma tecla "?", com a mesma janela.
// Os textos seguem as mesmas regras dos de cima (iguais para todos os escritórios, curtos, em português simples); como o título
// dessas telas muda (o "Olá" do Início, o nome da pessoa no perfil), cada uma diz também o título da janela.
// Tela nova fora das páginas de módulo = uma entrada nova na tabela.

/** As telas que não são de módulo e têm ajuda. As quatro abas do Financeiro têm uma ajuda cada. */
export type TelaComAjuda =
  | 'inicio' | 'painelProcessos' | 'mensagens' | 'modelosDeLista' | 'meuTempo' | 'calendario'
  | 'financeiroEntradas' | 'financeiroSaidas' | 'financeiroDireitos' | 'financeiroObrigacoes'
  | 'equipe' | 'perfilDaEquipe' | 'minhaConta' | 'configuracoes';

/** O título da janela ("Ajuda: <título>") e os parágrafos da explicação de uma tela. */
export interface AjudaDaTela { titulo: string; textos: readonly string[] }

/** A ajuda de cada tela que não é de módulo, com o título da janela e os parágrafos, na ordem em que aparecem. */
export const AJUDA_DAS_TELAS: Record<TelaComAjuda, AjudaDaTela> = {
  inicio: { titulo: 'Início', textos: [
    'O Início mostra o seu dia de trabalho de relance: os números do dia, os gráficos e as listas do que pede atenção.',
    'Clique num número ou num item das listas para ir direto a ele.',
    'A busca do alto acha pessoas, contratos, processos, tarefas e o que mais houver no SEMPER.',
    'Se aparecer o filtro no alto, troque-o para ver o trabalho da equipe toda ou de uma só pessoa.'
  ] },
  painelProcessos: { titulo: 'Painel dos processos', textos: [
    'Este painel resume os processos em que você trabalha, de todos os tipos.',
    'No alto ficam os números, como os prazos vencidos e os desta semana. Clique num deles para ver a lista.',
    'Os gráficos mostram os prazos das próximas semanas, o movimento de cada mês e quantos processos há em cada fase.',
    'Para ver os processos de um tipo no quadro ou na tabela, escolha o tipo no menu lateral.'
  ] },
  mensagens: { titulo: 'Mensagens', textos: [
    'Aqui chegam os seus avisos: menções com @, prazos, lembretes e quando alguém inclui você num item.',
    'As mensagens que você ainda não leu ficam destacadas, e o número no menu lateral conta quantas são.',
    'Clique numa mensagem para abrir o item de onde ela veio.',
    'Os pedidos para participar de um item se aprovam ou se recusam aqui mesmo.'
  ] },
  modelosDeLista: { titulo: 'Modelos de checklist', textos: [
    'Modelos de checklist são listas prontas para usar nas demandas, nas tarefas e nos contratos.',
    'Para usar um modelo, abra o item e clique em Adicionar checklist.',
    'Mudar um modelo não muda os checklists já feitos com ele.',
    'O modelo com o mesmo nome de um objeto de contrato vira as tarefas da demanda quando o contrato é assinado.'
  ] },
  meuTempo: { titulo: 'Meu tempo trabalhado', textos: [
    'Esta tela soma o tempo trabalhado em cada tarefa no período escolhido, com o total.',
    'O tempo vem do cronômetro do cartão da tarefa e dos ajustes feitos nele.',
    'Escolha o período no alto: esta semana, este mês, o mês passado ou as datas que quiser.',
    'Se aparecer o campo De quem, escolha outra pessoa da equipe para ver o tempo dela.'
  ] },
  calendario: { titulo: 'Feriados e prazos', textos: [
    'Aqui ficam os dias sem expediente de cada órgão, usados para contar os prazos.',
    'Os feriados nacionais e o recesso forense já vêm prontos.',
    'O escritório acrescenta os feriados estaduais e municipais e as suspensões dos tribunais.',
    'Em Calcular um prazo, escolha o órgão, a data da intimação e os dias para saber em que dia o prazo termina.'
  ] },
  financeiroEntradas: { titulo: 'Financeiro (Entradas)', textos: [
    'No alto, o Financeiro mostra os números e os gráficos do período, comparados com os do período anterior.',
    'Escolha o ano e o mês na barra do período, logo acima dos números.',
    'A aba Entradas lista o que já entrou no período. Clique numa linha para ver tudo sobre ela.',
    'Use o botão Nova entrada para lançar o que entrou.'
  ] },
  financeiroSaidas: { titulo: 'Financeiro (Saídas)', textos: [
    'A aba Saídas lista o que já saiu das contas do escritório no período escolhido.',
    'Clique numa linha para ver o lançamento e mudá-lo, se precisar.',
    'Use o botão Nova saída, ao lado das abas, para lançar um pagamento.',
    'Só os administradores veem esta aba.'
  ] },
  financeiroDireitos: { titulo: 'Financeiro (Direitos)', textos: [
    'Direitos é o que ainda vai entrar: as parcelas a receber, contrato por contrato.',
    'Busque pelo contrato ou pelo cliente e filtre pela situação: com atraso, em dia ou quitado.',
    'O botão Receber da linha lança o recebimento da próxima parcela.',
    'Clique no contrato para ver todas as parcelas dele.'
  ] },
  financeiroObrigacoes: { titulo: 'Financeiro (Obrigações)', textos: [
    'Obrigações é o que ainda vai sair, no período escolhido.',
    'Os repasses são o que o escritório paga a advogados e sócios pela parte deles em cada recebimento.',
    'Em A passar a participantes e indicadores fica o que o responsável pelo contrato passa a quem participou ou indicou o cliente.',
    'Marque cada valor como pago quando o pagamento for feito.'
  ] },
  equipe: { titulo: 'Equipe e acessos', textos: [
    'Aqui se cuida de quem usa o SEMPER: os usuários, os convites e os acessos.',
    'Para dar acesso a alguém, use Dar acesso a uma pessoa e envie a mensagem do convite.',
    'Na lista de usuários, a função diz o que cada um faz no escritório, e o papel diz quem administra o sistema.',
    'Só os administradores veem esta tela.'
  ] },
  perfilDaEquipe: { titulo: 'Perfil profissional', textos: [
    'O perfil profissional é a base da página desta pessoa no site do escritório.',
    'Complete ou corrija a foto e os dados, e decida se o perfil aparece no site.',
    'A própria pessoa também pode mudar o perfil dela, em Minha conta.',
    'Só os administradores veem esta tela.'
  ] },
  minhaConta: { titulo: 'Minha conta', textos: [
    'Aqui ficam os seus dados de acesso: o e-mail, o nome, o @usuário das menções e a aparência das telas.',
    'Ative a verificação em duas etapas para deixar a sua conta mais segura.',
    'Você também escolhe se recebe os e-mails de prazo e se usa os atalhos de uma tecla só.',
    'O perfil profissional, mais abaixo, é a base da sua página no site do escritório.'
  ] },
  configuracoes: { titulo: 'Configurações', textos: [
    'Aqui ficam os dados do escritório: o nome, a logomarca, o endereço e o contato.',
    'O nome e a logomarca aparecem nas telas do SEMPER e nos documentos.',
    'Mais abaixo ficam as listas do escritório, como os objetos de contrato, as salas e as funções nas tarefas.',
    'Só os administradores veem esta tela.'
  ] }
};
