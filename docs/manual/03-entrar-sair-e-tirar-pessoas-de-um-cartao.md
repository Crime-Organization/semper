# 03. Como entrar, sair ou tirar alguém de um cartão

Conferido no código da versão 1.18.0, em 09/11/2026. A parte de sair foi revista em 20/11/2026, depois da versão 1.32.0
(tarefas #276 e #274). Não testado com contas reais.

## Pergunta

> Como entrar, sair ou remover eu mesmo ou alguém de uma tarefa, contrato, demanda etc.?

## Mensagem para o WhatsApp

```
*Como incluir ou tirar alguém de uma tarefa, demanda, contrato, processo ou compromisso*

*1.* Abra o cartão e clique no *lápis* (Editar).

*2.* Mude as pessoas:
• *Demanda e processo:* marque ou desmarque o nome em *Colaboradores*.
• *Tarefa e compromisso:* marque ou desmarque o nome em *Participantes*.
• *Contrato:* em *Participantes*, use *Adicionar participante* ou o *X* ao lado do nome.

*3.* Clique em *Salvar*.

*Responsável:* todo cartão precisa ter um. Para mudar, escolha outro nome no campo *Responsável*. No contrato, só advogado pode ser responsável.

*Quer entrar em um cartão?* Peça a quem já está nele ou a um administrador para incluir você.

*Quer sair?* Em tarefa, demanda, processo e compromisso, desmarque o seu nome e salve: você sai, e a saída fica no histórico. No contrato, só sai sozinho quem o criou ou é administrador; nos outros casos, peça a outra pessoa do contrato ou a um administrador para tirar você (se o escritório usa o Financeiro e o contrato já tem parcelas, só um administrador).

*Está no cartão por um grupo?* Peça a outra pessoa do cartão que tire o grupo (saem todos do grupo) ou a um administrador que tire você do grupo.

*Quem é tirado deixa de ver o cartão.* Quem criou o cartão e os administradores continuam vendo.
```

## Instrução detalhada

Tudo isso fica no modo de edição do próprio cartão. Não existe um botão separado de "entrar" ou "sair".

### Quem pode mudar as pessoas de um cartão

Quem já está no cartão (quem criou, o responsável, os colaboradores ou participantes) e os administradores.

Em uma **tarefa**, quem está na demanda ligada também pode. Em um **compromisso**, quem está no processo ligado também pode.

Quem só foi mencionado em um comentário de contrato lê e comenta, mas não altera.

### Como incluir ou tirar alguém

1. Abra o cartão.
2. Clique no **lápis** (Editar), no topo. O cartão vira um formulário com todos os campos.
3. Faça a mudança no campo do módulo:

| Módulo | Campo do responsável | Campo das outras pessoas | Como incluir ou tirar |
|---|---|---|---|
| Tarefa | Responsável | Participantes | Marque ou desmarque o nome |
| Demanda | Responsável | Colaboradores | Marque ou desmarque o nome |
| Processo | Responsável | Colaboradores | Marque ou desmarque o nome |
| Compromisso | Responsável | Participantes | Marque ou desmarque o nome |
| Contrato | Advogado responsável | Participantes | **Adicionar participante**, buscar o nome e informar o %; o **X** tira |

4. Clique em **Salvar**, no pé do cartão.

### Regras

- **Todo cartão precisa de um responsável.** Não dá para deixar vazio: para mudar, escolha outro nome.
- **Contrato:** só advogado pode ser responsável, e o participante precisa ser da equipe.
- **Tarefa, demanda, processo e compromisso:** qualquer pessoa da equipe pode ser responsável, colaboradora ou participante.
- Quem é tirado deixa de ver o cartão, a não ser que seja administrador, tenha criado o cartão ou ainda tenha outra ligação com ele.

### Entrar em um cartão

Hoje a pessoa só vê os cartões em que já está, então não consegue se incluir sozinha. Peça a alguém do cartão ou a um administrador.

No contrato, existe um outro caminho: quem é parte do contrato pode mencionar um advogado com @ em um comentário. Esse advogado passa a ler e comentar, mas não altera, e o acesso dura enquanto a menção existir.

### Sair de um cartão

| Quem é você no cartão | O que acontece |
|---|---|
| Administrador | Sai normalmente |
| Quem criou o cartão | Sai normalmente, mas continua vendo o cartão |
| Tarefa ou compromisso, com outra ligação que continua (demanda ou processo ligado) | Sai normalmente |
| Outros casos, em tarefa, demanda, processo ou compromisso | O sistema salva o resto e depois tira você, com um aviso como "Tarefa atualizada. Você saiu dela, e a saída ficou no histórico." (ou "Processo atualizado. Você saiu dele…"). Você deixa de ver o cartão |
| Outros casos, em anotação | A anotação não tem lápis: abra a sua bolinha, no topo, e escolha "Sair da anotação". O sistema pergunta antes e avisa: "Você saiu da anotação, e a saída ficou no histórico." (pela bolinha, os outros cartões dão o mesmo aviso: "Você saiu da tarefa…") |
| Outros casos, em contrato | O sistema não salva e explica: "Você não pode sair deste contrato sozinho: sem estar nele, deixaria de poder alterá-lo. Peça a outra pessoa do contrato ou a um administrador para tirar você." Se o escritório usa o Financeiro, o aviso acrescenta: "Se o contrato já tem parcelas, só um administrador pode tirar você." |
| Está no cartão só por um grupo | O sistema explica: "Para sair, peça a outra pessoa do cartão que tire o grupo dele (saem todos do grupo) ou a um administrador que tire você do grupo." |

No contrato, quem pode tirar você é qualquer outra pessoa dele (quem o criou, o advogado responsável ou outro participante) ou um administrador. Mas, se o escritório usa o Financeiro e o contrato já tem parcelas, só um administrador muda os participantes. Na bolinha do topo do contrato, o "Sair do contrato" nem aparece: no lugar, a mesma explicação.

Exceção no contrato: quem também foi mencionado num comentário dele consegue se tirar pelo lápis. Ele sai, continua lendo e comentando pela menção, mas deixa de alterar o contrato. Pela bolinha do topo, a saída continua recusada.

### Passar o cartão para outra pessoa

Troque o nome no campo do responsável e salve.

- **Em tarefa, demanda, processo e compromisso,** quem passou o cartão continua nele como colaborador ou participante, se não for administrador nem tiver criado o cartão.
- **Em contrato,** quem não criou o contrato e não é administrador só consegue trocar o responsável se continuar no contrato, por exemplo incluindo-se como participante. Senão, o sistema explica isso e manda pedir a outra pessoa do contrato ou a um administrador. Um administrador consegue trocar direto.
- **Contrato, sem cadastro em Pessoas:** o responsável que não tem cadastro em Pessoas não consegue se incluir como participante. O aviso diz isso e manda pedir a outra pessoa do contrato ou a um administrador.
- **Contrato, com o Financeiro ligado:** só o próprio responsável ou um administrador troca o responsável; por isso o aviso manda pedir a um administrador, e não a outra pessoa do contrato. Se o contrato já tem parcelas, só um administrador troca o responsável ou muda os participantes.

## Roteiro do vídeo

**Duração:** cerca de 80 segundos. **Público:** a equipe do escritório. **Tom:** prático.
**Estilo:** motion graphics sobre as telas reais, com avatares (bolinhas com iniciais) entrando e saindo do cartão. Só dados e nomes inventados.

| Cena | Tempo | Na tela | Narração | Texto na tela |
|---|---|---|---|---|
| 1. Abertura | 0–6s | Um cartão com bolinhas da equipe; uma entra e outra sai. | "Quem trabalha em cada cartão? Você pode mudar isso." | Quem está no cartão |
| 2. Lápis | 6–13s | Cartão de uma demanda aberto; destaque no lápis, que é clicado. O cartão vira formulário. | "Abra o cartão e clique no lápis." | Editar |
| 3. Marcar | 13–24s | Lista "Colaboradores" com caixinhas; uma é marcada, outra desmarcada. As bolinhas acompanham. | "Em demandas e processos, marque ou desmarque em Colaboradores. Em tarefas e compromissos, em Participantes." | Marque ou desmarque |
| 4. Contrato | 24–35s | Contrato em edição; "Adicionar participante" é clicado, um nome fictício é buscado e o % preenchido. O X é destacado. | "No contrato, use Adicionar participante, informe o percentual, e o X para tirar." | Contrato: + e X |
| 5. Salvar | 35–40s | Clique em "Salvar"; o aviso de atualização aparece. | "Depois, é só salvar." | Salvar |
| 6. Responsável | 40–50s | Campo "Responsável" abre e outro nome é escolhido; um selo "Sempre um responsável" aparece. No contrato, um selo "Só advogado". | "Todo cartão tem um responsável. Para mudar, escolha outro nome. No contrato, só advogado." | Sempre um responsável |
| 7. Entrar | 50–59s | Uma bolinha do lado de fora bate no cartão; uma de dentro a puxa para o cartão. | "Quer entrar? Peça a quem já está no cartão ou a um administrador." | Peça a quem está no cartão |
| 8. Sair | 59–72s | Numa demanda, uma bolinha se desmarca e sai. Num contrato, uma bolinha tenta sair sozinha e volta; outra bolinha do contrato a tira. Bolinhas com coroa (administrador) e com lápis (quem criou) saem livremente. | "Para sair, desmarque o seu nome e salve. No contrato, só sai sozinho quem o criou ou é administrador: nos outros casos, peça a outra pessoa do contrato ou a um administrador. Com parcelas, só um administrador." | No contrato, peça para tirarem você |
| 9. Fim | 72–80s | A bolinha que saiu fica cinza, e o cartão some para ela. As bolinhas de coroa e de lápis seguem vendo. | "Quem sai deixa de ver o cartão. Quem criou e os administradores continuam vendo." | Quem sai deixa de ver |

## Para revisar

- Quando a chave `equipe_ve_tudo` for ligada (#271): toda a equipe passa a ver os cartões, então quem foi tirado continua vendo, sem poder alterar, e sem os valores no contrato. Reescrever "Quem é tirado deixa de ver o cartão", a parte de "Entrar em um cartão" e as cenas 7 e 9. Incluir-se continua dependendo de alguém do cartão ou de um administrador.
- No contrato, quem participa e também foi mencionado num comentário sai pelo lápis (o banco aceita, porque ele continua lendo pela menção), mas a bolinha do topo recusa a mesma saída. Falta o dono decidir se as duas portas devem fazer igual.
- Resolvido em 20/11/2026 (#274): quem está num cartão só por um grupo recebe a explicação de pedir a outra pessoa do cartão (que tira o grupo, e saem todos dele) ou a um administrador (que tira a pessoa do grupo). Com o Financeiro ligado, os avisos do contrato mandam pedir a um administrador quando só ele pode (troca do responsável; contrato com parcelas).
- Resolvido em 20/11/2026 (#274): ao sair de um processo ou compromisso, a pessoa sai de verdade desde a #276, e o aviso de que só um administrador a tiraria não existe mais. No contrato, quem tenta sair sem poder recebe a explicação de pedir a outra pessoa do contrato ou a um administrador, e não mais a mensagem genérica de falta de permissão.
