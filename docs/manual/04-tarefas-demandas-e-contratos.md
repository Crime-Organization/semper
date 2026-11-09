# 04. Qual a diferença entre tarefa, demanda e contrato

Conferido no código da versão 1.18.0, em 09/11/2026, com revisão independente de cada afirmação. Não testado com dados reais.

## Pergunta

> Preciso de uma explicação e diferenciação de tarefas, demandas e contratos.

## Mensagem para o WhatsApp

```
*Contrato, demanda e tarefa: qual a diferença?*

*CONTRATO é o que foi combinado com o cliente.*
Guarda o que foi contratado, os honorários e a divisão dos valores. Serve para o controle financeiro.
_Exemplo: contrato de registro de marca do cliente João._

*DEMANDA é o trabalho a ser entregue.*
Quase sempre é um objeto do contrato. Também dá para criar uma demanda sem contrato.
_Exemplo: "Registro da marca Exemplo"._

*TAREFA é uma ação menor, com alguém para fazer.*
Pode fazer parte de uma demanda, estar ligada a um contrato ou ficar avulsa. Tem cronômetro para marcar o tempo.
_Exemplo: "Emitir a GRU"._

*Resumindo:*
• *Contrato:* o que foi combinado e quanto custa
• *Demanda:* o que precisa ser entregue
• *Tarefa:* o que precisa ser feito para entregar

*Como as demandas nascem do contrato:*
• Quando o contrato chega à *coluna de assinado*, cada objeto escrito nele vira uma demanda sozinho. Só preencher a data de assinatura não basta.
• "A definir" não vira demanda: escreva os objetos no contrato.
• Objeto acrescentado depois de assinado precisa de demanda criada à mão.

*Importante:* estar em uma demanda ou tarefa não dá acesso ao contrato. Você vê só o número dele. Quem abre o contrato: administradores, quem o criou, o advogado responsável, os participantes e quem foi mencionado em um comentário dele.
```

## Instrução detalhada

### A ideia em uma frase

O **contrato** registra o que foi combinado com o cliente, a **demanda** é cada trabalho que precisa ser entregue e a **tarefa** é cada ação necessária para isso.

```
Contrato (o combinado)
  ├─ Demanda 1 (um objeto do contrato)
  │    ├─ Tarefa
  │    └─ Tarefa
  └─ Demanda 2 (outro objeto do contrato)
       └─ Tarefa
```

### Comparação

| | Contrato | Demanda | Tarefa |
|---|---|---|---|
| **O que é** | O combinado com o cliente | Uma etapa ou entrega do trabalho, quase sempre um objeto do contrato | A parte menor do trabalho |
| **Exemplo** | Contrato de registro de marca | "Registro da marca Exemplo" | "Emitir a GRU" |
| **Para que serve** | Controle financeiro | Organizar o que precisa ser entregue | Organizar quem faz o quê e quando |
| **Como nasce** | Cadastro manual, ou sozinho quando a pessoa chega a "Contrato fechado" (veja abaixo) | Cadastro manual, ou sozinha quando o contrato chega à coluna de assinado | Cadastro manual, inclusive de dentro de uma demanda; sozinha, pelo modelo de lista (veja abaixo); ou pelo botão "Criar tarefa" em um prazo ou intimação do processo |
| **Quem responde** | Advogado responsável (só advogado) | Responsável (qualquer pessoa da equipe) | Responsável: quem faz (qualquer pessoa da equipe) |
| **Quem mais participa** | Participantes, cada um com seu percentual | Colaboradores | Participantes |
| **Ligada a quê** | Clientes | Se houver: clientes e um contrato | Se houver: pessoas, uma demanda, um contrato e um processo |
| **Guarda valores?** | Sim | Não | Não |
| **Prazo** | Não tem prazo de entrega | Prazo de entrega, opcional | Prazo, opcional |
| **Seção "Listas"** | Não | Sim | Sim |
| **Cronômetro** | Não | Não: mostra a soma do tempo das tarefas | Sim |

### Contrato

O contrato liga o cliente ao advogado responsável. O número é dado pelo sistema e não muda. O cadastro tem cinco etapas:

1. **Cliente e responsável.**
2. **O que foi contratado:** os objetos e a categoria de honorários.
3. **Honorários:** valores e datas.
4. **Divisão:** percentuais do escritório, dos participantes e do indicador.
5. **Documento e observações:** o link do contrato assinado no Drive.

**Contrato que nasce sozinho:** quando uma pessoa chega a "Contrato fechado", o contrato dela é criado, com o objeto "A definir". Isso só acontece se ela ainda não for cliente de um contrato não arquivado: se já for, nenhum outro é criado, e o novo precisa ser cadastrado à mão. Também é preciso haver um advogado (quem moveu o cartão ou um dos responsáveis pela pessoa).

### Demanda

A demanda é o trabalho a ser entregue. Ela tem título, descrição, prazo, responsável, colaboradores e clientes. Só o **título** e o **responsável** são obrigatórios: clientes e contrato são opcionais.

**Como as demandas nascem do contrato:**

- Quando o contrato chega à **coluna de assinado**, nasce uma demanda para cada objeto, na coluna "Para fazer". Só preencher a data "Assinado em" não cria demanda.
- O objeto "A definir" não vira demanda. Se ele for trocado depois pelos objetos de verdade, em um contrato já assinado, esses viram demandas.
- As demandas nascem uma vez só. Outro objeto acrescentado depois de assinado precisa de demanda criada à mão.

No cartão da demanda há duas seções diferentes:

- **Tarefas:** cada tarefa com uma caixa de marcar. Marcar leva a tarefa para "Concluída". Quando a última é marcada, o sistema oferece concluir a demanda, mas só a quem tem acesso a ela. Quem está apenas na tarefa não recebe a oferta, e a demanda continua aberta até alguém com acesso movê-la.
- **Listas:** itens de conferência, que não viram tarefa nem concluem a demanda.

### Tarefa

A tarefa é a ação menor. Ela tem título, descrição, prazo, responsável, participantes e as pessoas ligadas. Só o **título** e o **responsável** são obrigatórios.

Ao escolher a demanda, as pessoas e o contrato dela entram na tarefa, se ainda estiverem vazios.

**Tarefas que nascem sozinhas:** quando a demanda nasce de um objeto do contrato e existe um modelo de lista com o mesmo nome do objeto, cada item do modelo vira uma tarefa dessa demanda, com o responsável, os clientes e o contrato dela. Antes de criar tarefas à mão, veja se elas já estão lá.

O cartão da tarefa tem **cronômetro**: "Iniciar", "Pausar" e "Retomar".

- Cada um vê a duração do próprio tempo.
- Com a tarefa concluída, quem vê a tarefa vê também o total da equipe, o tempo da criação à conclusão e a parte de cada pessoa em %.
- Os administradores veem, a qualquer momento, a duração de cada pessoa e os ajustes.
- No cartão da demanda, na seção Tarefas, aparece a soma do tempo de toda a equipe.

### Quem vê o quê

- **Contrato:** administradores, quem criou, o advogado responsável, os participantes e quem foi mencionado em um comentário dele. O indicador não abre: ele vê o que recebe em Meus valores.
- **Demanda:** administradores, quem criou, o responsável e os colaboradores.
- **Tarefa:** administradores, quem criou, o responsável, os participantes e quem vê a demanda ligada.

Demanda e contrato são independentes: quem está em uma demanda ou tarefa e não pode abrir o contrato ligado vê só o número, com o aviso "Você não tem acesso a este contrato".

### Qual usar

| Situação | Use |
|---|---|
| O cliente fechou um serviço e vai pagar honorários | Contrato |
| É preciso entregar um trabalho, com ou sem contrato | Demanda |
| Alguém precisa fazer uma ação específica | Tarefa, dentro da demanda se ela existir |
| Lembrete ou ação que não pertence a nenhum trabalho | Tarefa avulsa |
| Conferência com vários passos pequenos, dentro de um cartão | Seção "Listas" da demanda ou da tarefa |

## Roteiro do vídeo

**Duração:** cerca de 85 segundos. **Público:** a equipe do escritório. **Tom:** didático.
**Estilo:** motion graphics com três cartões em cores diferentes que se encaixam em árvore: contrato em cima, demandas no meio e tarefas embaixo. Só dados inventados.

| Cena | Tempo | Na tela | Narração | Texto na tela |
|---|---|---|---|---|
| 1. Abertura | 0–6s | Três cartões caem na tela, empilhados e confusos. | "Contrato, demanda e tarefa. Qual é a diferença?" | Contrato · Demanda · Tarefa |
| 2. Contrato | 6–20s | O primeiro cartão se abre. Aparecem cliente, objetos e cifrões, seguidos de uma divisão em pizza. | "O contrato é o que foi combinado com o cliente: o que foi contratado, os honorários e a divisão dos valores." | O que foi combinado |
| 3. Objetos | 20–33s | Os objetos saem do contrato. O cartão desliza para a coluna de assinado, e cada objeto se transforma em um cartão. Um objeto "A definir" fica para trás. | "Quando o contrato chega à coluna de assinado, cada objeto escrito nele vira uma demanda, sozinho. 'A definir' não vira." | Coluna de assinado: objeto vira demanda |
| 4. Demanda | 33–45s | Cartão "Registro da marca Exemplo", com bolinhas da equipe. Um cartão sem contrato surge ao lado. | "A demanda é o trabalho a ser entregue, com um responsável. Também dá para criar uma demanda sem contrato." | O que precisa ser entregue |
| 5. Tarefa | 45–60s | Da demanda saem cartões menores; um mostra "Emitir a GRU" e um cronômetro girando. Uma tarefa fica sozinha, à parte. | "A tarefa é a ação menor, com alguém para fazer e um cronômetro. Ela pode fazer parte de uma demanda ou ficar avulsa. Com um modelo de lista, as tarefas já nascem junto com a demanda." | O que fazer para entregar |
| 6. Concluir | 60–68s | As tarefas são marcadas uma a uma; ao marcar a última, surge a oferta de concluir a demanda. | "Ao concluir a última tarefa, o sistema oferece concluir a demanda a quem tem acesso a ela." | Tudo feito? Conclua |
| 7. Acesso | 68–77s | Uma bolinha na demanda olha para o contrato: vê o número, com um cadeado. | "Estar em uma demanda não dá acesso ao contrato: você vê só o número, e abre apenas quem tem acesso a ele." | Só o número |
| 8. Resumo | 77–85s | A árvore completa se monta, com as três frases ao lado. | "Contrato: o combinado. Demanda: o que entregar. Tarefa: o que fazer." | O combinado · O que entregar · O que fazer |

## Para revisar

- Quando a chave `equipe_ve_tudo` for ligada (#271): toda a equipe passa a ver demandas, tarefas e contratos, e quem não é parte do contrato o abre sem os valores. Reescrever "Importante" na mensagem, "Quem vê o quê" e a cena 7 (o texto na tela pode voltar a ser "Valores protegidos").
- O nome da coluna de assinado pode ter sido renomeado no escritório: conferir antes de gravar o vídeo.
