# Mapa do sistema

<!-- Gerado por "npm run mapa --prefix app" (app/ferramentas/mapa/). Não edite à mão: mude a tabela app/ferramentas/mapa/assuntos.ts e rode de novo. -->

Para cada assunto, onde estão as tabelas, as funções de dados, as regras, as telas e os testes. Antes de procurar no código,
leia o assunto aqui (o índice diz as linhas de cada um). Durante o trabalho, rode só os testes do assunto (os comandos estão
em cada um; os do banco pedem o Docker ligado); a bateria completa (`npm run verificar` e `npm run testar-telas`), uma vez, antes de
enviar um lote ao main ou publicar. Os comandos já incluem os testes de outros assuntos que este costuma quebrar e, onde há funções
de dados, o `src/dados/contrato.test.ts`. Endereço que sai ou muda: veja [Rotas e endereços](#rotas).
Um arquivo pode estar em mais de um assunto. As listas são geradas; o resumo e as armadilhas são
escritos à mão na tabela `app/ferramentas/mapa/assuntos.ts`. Arquivo, tabela ou assunto novo: classifique lá e rode
`npm run mapa --prefix app`. Conflito neste arquivo ao juntar ramos: não resolva à mão, rode o mesmo comando.

## Índice

- [Comum a todos](#comum), linhas 57–96: As peças que todos os módulos usam: a casca do app, as rotas, a camada de dados, as peças de ui/base, os estilos, os tempos e os limites.
- [Pessoas](#pessoas), linhas 97–130: O cadastro de pessoas (clientes, partes, contatos): o cadastro em etapas, o cartão, os vínculos entre pessoas, o sigilo e os responsáveis.
- [Contratos](#contratos), linhas 131–161: Os contratos de honorários: o cadastro, os clientes e participantes, a numeração por ano, quem vê os valores, e arquivar ou excluir em cascata.
- [Objetos de contrato](#objetos), linhas 162–181: Os objetos (o que o contrato cobre), a lista do escritório nas Configurações (corrigir, juntar parecidos) e a demanda que nasce de cada objeto.
- [Demandas](#demandas), linhas 182–211: As demandas (o trabalho de um caso, com prazo e fases): o cadastro, o cartão, demandas relacionadas e a demanda contínua, que junta as tarefas avulsas.
- [Checklists e modelos](#listas), linhas 212–233: Os checklists (no código e no banco, "listas") da demanda, da tarefa e do contrato, com grupos numerados, e os modelos de checklist do escritório.
- [Tarefas](#tarefas), linhas 234–266: As tarefas: o cadastro, o cartão, as funções dos participantes (só "Executa" de fábrica; o participante pode ficar sem função), a aprovação interna, a diligência, copiar para outra demanda e o prazo do processo que a tarefa cumpre.
- [Tempo nas tarefas](#tempo), linhas 267–288: O cronômetro das tarefas, os registros de tempo (corrigir e apagar) e a página "Meu tempo trabalhado".
- [Processos](#processos), linhas 289–321: Os processos de cada tipo (`TIPOS_PROCESSO`, em `regras/processo.ts`): o cadastro, o cartão, as partes e recursos, os andamentos e prazos, os campos do escritório e o painel de Processos.
- [Propriedade intelectual](#propriedade-intelectual), linhas 322–340: O processo (em geral administrativo, no INPI) da área de propriedade intelectual (marca, patente, desenho, direito autoral): os campos da proteção,
- [Agenda e compromissos](#agenda), linhas 341–368: Os compromissos (reuniões, audiências, prazos na agenda): o cadastro, o cartão, a visão por data, os que se repetem (e a demanda que nasce de cada data) e as salas do escritório.
- [Calendário e prazos](#calendario), linhas 369–388: O calendário do escritório (feriados, suspensões, órgãos) e a contagem de prazos em dias corridos ou úteis.
- [Prazos, lembretes e e-mails de prazo](#lembretes), linhas 389–406: A hora e o lembrete do prazo de tarefas e demandas, os avisos de prazo na caixa de mensagens e o e-mail diário de prazos.
- [Documentos e anotações](#documentos), linhas 407–434: O módulo Documentos: as anotações em Markdown (editor ao vivo, salva sozinho), as pastas, o explorador e as anotações no cartão de cada item.
- [Financeiro](#financeiro), linhas 435–460: O caixa do escritório: entradas e saídas, as contas, o DAS, os sócios, os ajustes de saldo, o painel com os números e gráficos.
- [Parcelas e recebimentos](#parcelas), linhas 461–483: As parcelas dos contratos (Direitos e Obrigações do Financeiro), o recebimento completo, a divisão entre escritório, responsável e indicação, e os repasses.
- [Lucro dos sócios](#lucros), linhas 484–499: Quanto cada sócio acumulou, retirou e tem em aberto. As funções de dados ficam em `DadosFinanceiro` e `DadosParcelas`.
- [Meus valores](#meus-valores), linhas 500–512: A parte de cada pessoa em cada recebimento e os totais por papel (responsável, indicação). As funções de dados ficam em `DadosParcelas`.
- [Conferência dos lançamentos](#conferencia), linhas 513–527: A conferência dos lançamentos do caixa com a planilha antiga: situações, filtros, totais e a correção de cada linha. As funções de dados ficam em `DadosFinanceiro`.
- [Equipe, grupos e permissões](#equipe), linhas 528–558: Os usuários do escritório: convites, papel (administrador), função (advogado, administrativo, estagiário), desativar, grupos da equipe, a fase de adaptação (equipe vê tudo)
- [Perfil profissional e foto](#perfil), linhas 559–578: O perfil profissional de cada pessoa da equipe (a base das páginas da equipe no site do escritório) e a foto redonda do perfil.
- [Configurações e escritório](#configuracoes), linhas 579–595: As Configurações do escritório: os dados e a marca (nome, logomarca, CNPJ), os módulos ligados, o escritório novo e os donos da plataforma.
- [Registro de ações e LGPD](#registro), linhas 596–611: O registro de ações (auditoria: quem criou, mudou ou apagou o quê), na tela Equipe, e o que a LGPD pede: registrar quem exportou dados e, ao excluir uma pessoa, apagar o nome dela do registro.
- [Mensagens e avisos](#mensagens), linhas 612–636: A caixa de mensagens de cada pessoa: avisos ao ser incluído num item, ao ser mencionado e os pedidos para participar de um item.
- [Comentários e menções](#comentarios), linhas 637–654: Os comentários dos cartões, com menções de pessoas (@) e de itens (!).
- [Etiquetas](#etiquetas), linhas 655–671: As etiquetas coloridas do escritório, as mesmas em todos os módulos, com o filtro das páginas de módulo.
- [Ligações entre itens](#ligacoes), linhas 672–693: Ligar um item a outro que já existe, criar no cartão um item já ligado (o "+ Novo…" das seções) e como as ligações aparecem no quadro.
- [Quadros (kanban) e situação](#quadros), linhas 694–720: O quadro kanban comum a todos os módulos: colunas, grupos de colunas, colunas-marco e padrão, arquivados, a Situação do cartão e o concluir pelo círculo.
- [Cartão dos itens](#cartao), linhas 721–743: O cartão (painel) de cada item: o topo, a cabeça, as seções que recolhem, o "Acrescentar ao cartão", as datas e a edição no lugar, o histórico e sair do cartão.
- [Busca geral](#busca-geral), linhas 744–756: A janela que busca em todos os módulos de uma vez (Ctrl+K ou o botão "Buscar" do menu).
- [Painel inicial](#painel-inicial), linhas 757–771: O Início: os números do dia, os gráficos e as listas (prazos, agenda, tarefas, demandas, processos, anotações, parcelas, pessoas).
- [Entrada e minha conta](#conta), linhas 772–792: A tela de entrada (login, primeiro acesso por convite, nova senha), a verificação em duas etapas, a troca do e-mail de acesso, sair e a sessão encerrada em outro lugar.
- [Página pública](#portal), linhas 793–806: A página pública do SEMPER (rota "/"): a apresentação a outros escritórios e o pedido de demonstração.
- [Importação](#importacao), linhas 807–826: Importar pessoas de um arquivo CSV (Pessoas > ⋯ > Importar pessoas) e a ferramenta que converte a planilha antiga do site para o SEMPER.
- [Conta Google e contatos](#google), linhas 827–845: A ligação da conta Google do escritório (em Configurações) e a sincronização das pessoas com o Google Contatos, com a lista "Para conferir".
- [Novidades e versão](#novidades), linhas 846–859: As novidades de cada versão (o botão do menu lateral) e o aviso de versão nova para a aba aberta antes de uma publicação.
- [Ajuda e atalhos](#ajuda), linhas 860–873: A ajuda de cada tela de módulo (o botão "?") e os atalhos de teclado ("/" busca, "N" novo, "?" ajuda).
- [Rotinas automáticas](#rotinas), linhas 874–885: O que o banco faz sozinho, de tempos em tempos (pg_cron): avisos e lembretes de prazo, e-mails de prazo, datas e demandas dos compromissos que se repetem,
- [Rotas e endereços](#rotas), linhas 886–990: cada endereço, a tela que abre, o assunto e quem escreve o endereço.
- [Sem assunto](#sem-assunto), linhas 991–994: nada.

<a id="comum"></a>
## Comum a todos

As peças que todos os módulos usam: a casca do app, as rotas, a camada de dados, as peças de ui/base, os estilos, os tempos e os limites.
Mexer aqui muda todos os módulos de uma vez.

- **Migrações:** (supabase/migrations/) 20261024000001_base, 20261024000002_desempenho
- **Outros arquivos de dados:** (app/src/dados/) erros.ts, falso.ts, index.ts, limites.ts, supabase.ts, tipos.ts
- **Regras:** (app/src/regras/)
  - `campoData.ts`: O calendário pequeno dos campos de data (#357): o mês na tela (semanas começando no domingo, como nos calendários do Brasil), o andar pelo teclado, os limites…
  - `csv.ts`: CSV: ler e escrever planilhas em texto (o formato que o Excel e o Google abrem e salvam).
  - `enderecosAntigos.ts`: Os endereços que já existiram e mudaram de lugar: cada um leva, para sempre, à página que faz o mesmo hoje.
  - `escalaDosGraficos.ts`: A escala das barras em pé dos painéis (ui/Graficos.tsx): até onde vai o eixo, para as linhas da grade caírem em números redondos ("R$ 3 mil, R$ 6 mil, R$ 9…
  - `filtroDoPainel.ts`: O filtro dos painéis (Processos e, depois, Início e Financeiro): de quem é o trabalho que o painel mostra (#401).
  - `formatacao.ts`: Descrição de tarefas e demandas com negrito, itálico e listas (#293), com as marcas do Trello: **negrito** (ou __negrito__), *itálico* (ou _itálico_) e linhas…
  - `qualBanco.ts`: Qual banco o site usa e o que a tela avisa sobre isso (#74).
  - `texto.ts`: Texto comparável: sem acentos, sem espaços nas pontas, em minúsculas (" José " e "jose" ficam iguais).
  - `tituloDaAba.ts`: O título da aba do navegador (#323): a página, o escritório de quem está logado e o produto, como "Pessoas · Marques & Lima Advogados · SEMPER".
- **Rotas:** `*`
- **Peças de ui:** (app/src/ui/) Avatar.tsx, AvisoAoSair.tsx, Botoes.tsx, CampoComSugestoes.tsx, Casca.tsx, ErroDaTela.tsx, Graficos.tsx, Icone.tsx, MaisDoMenu.tsx, Menu.tsx, PaginaModulo.tsx, Paginacao.tsx, PainelCartao.tsx, Recolhivel.tsx, SubmenuLateral.tsx, abrirItem.tsx, arrastar.tsx, avisos.tsx, barraDeRolagem.ts, base/BotaoDoLembrete.tsx, base/CampoData.tsx, base/CampoDataHora.tsx, base/DataEditavel.tsx, base/EditorAoVivo.tsx, base/EditorAoVivoCodeMirror.tsx, base/EditorDeTexto.tsx, base/GrupoDeDatas.css, base/GrupoDeDatas.tsx, base/LinhasRepetidas.tsx, base/PrazoEditavel.tsx, base/TextoEditavel.tsx, base/TextoFormatado.tsx, base/TituloEditavel.tsx, base/botao.ts, base/index.tsx, janela.tsx, loja.ts, ordem.ts, painel/FiltroDoPainel.tsx, painel/Painel.tsx, preferencias.ts, rolagem.ts, sessao.tsx, tema.ts, tempos.ts, useCartaoNaUrl.ts, useParametroLido.ts, useQuantos.ts, useSelecao.ts, util.ts
- **Servidor (funções do Supabase):** (supabase/functions/) _compartilhado/avisoNoServidor.ts, _compartilhado/envioDeEmail.ts, _compartilhado/modeloDeEmail.ts, _compartilhado/servidor.ts
- **Outros:** (app/) e2e/ajudantes.ts, ferramentas/banco-local.mjs, ferramentas/mapa/assuntos.ts, ferramentas/mapa/gerar.ts, ferramentas/mapa/mapa.ts, src/App.tsx, src/estilo.css, src/globais.d.ts, src/main.tsx, src/marca.ts, src/testes/editorAoVivo.ts, src/testes/preparar.ts
- **Testes unitários:** na pasta app, `npx vitest run ferramentas/mapa/mapa.test.ts src/dados/contrato.test.ts src/dados/erros.test.ts src/dados/supabase.test.ts src/regras/campoData.test.ts src/regras/csv.test.ts src/regras/enderecosAntigos.test.ts src/regras/escalaDosGraficos.test.ts src/regras/filtroDoPainel.test.ts src/regras/formatacao.test.ts src/regras/qualBanco.test.ts src/regras/texto.test.ts src/regras/tituloDaAba.test.ts src/testes/fuso.test.ts src/ui/Avatar.test.ts src/ui/Avatar.test.tsx src/ui/AvisoAoSair.test.tsx src/ui/Botoes.test.tsx src/ui/CampoComSugestoes.test.tsx src/ui/ErroDaTela.test.tsx src/ui/Graficos.test.tsx src/ui/Icone.test.tsx src/ui/MaisDoMenu.test.tsx src/ui/Menu.test.tsx src/ui/PaginaModulo.test.tsx src/ui/Paginacao.test.tsx src/ui/PainelCartao.test.tsx src/ui/Recolhivel.test.tsx src/ui/SubmenuLateral.test.tsx src/ui/abrirItem.test.tsx src/ui/arrastar.test.tsx src/ui/avisos.tela.test.tsx src/ui/avisos.test.ts src/ui/barraDeRolagem.test.ts src/ui/base/BotaoDoLembrete.test.tsx src/ui/base/CampoData.test.tsx src/ui/base/CampoDataHora.test.tsx src/ui/base/DataEditavel.test.tsx src/ui/base/EditorAoVivo.test.tsx src/ui/base/EditorDeTexto.test.tsx src/ui/base/GrupoDeDatas.test.tsx src/ui/base/LinhasRepetidas.test.tsx src/ui/base/PrazoEditavel.test.tsx src/ui/base/TextoEditavel.test.tsx src/ui/base/TextoFormatado.test.tsx src/ui/base/TituloEditavel.test.tsx src/ui/base/base.test.tsx src/ui/janela.test.tsx src/ui/loja.test.ts src/ui/ordem.test.ts src/ui/painel/Painel.test.tsx src/ui/rolagem.test.ts src/ui/tema.test.ts src/ui/useCartaoNaUrl.test.tsx src/ui/useParametroLido.test.tsx src/ui/useQuantos.test.tsx src/ui/useSelecao.test.ts src/ui/util.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/menu-lateral.spec.ts e2e/nova-aba.spec.ts e2e/sair-do-cadastro.spec.ts`
- **Armadilhas:**
  - Função de dados nova: no contrato (`dados/tipos.ts`), em `supabase.ts` **e** em `falso.ts`, que precisa se comportar igual; o `dados/contrato.test.ts` confere os dois.
  - Os testes de tela e o `npm run teste` usam o banco fictício (`falso.ts`): o que só existe em `supabase.ts` não aparece neles.
  - Tamanho de campo em `dados/limites.ts` marcado como exigido pelo banco: muda junto com uma migração nova.
  - Tabela nova: `escritorio_id` e regras RLS, como em `20261024000001_base.sql`; a migração só acrescenta (nada de apagar ou renomear no mesmo passo).
  - Mudou como algo se grava? A versão anterior do site (e quem chama a API direto) continua gravando do jeito antigo: um gatilho converte ou recusa, e o teste do banco testa o caminho antigo (ex.: o gatilho `exclusao_direta` da migração `contrato_exclui_em_cascata`).
  - Regra que está no banco (gatilho ou função da migração) e numa regra de `regras/` que o `falso.ts` usa: mude as duas, e cada caso do teste do banco ganha o caso igual em `dados/contrato.test.ts`.
  - Restrição nova no banco (check, raise) ganha a frase em português em `dados/erros.ts`, reaproveitando a da regra.
  - `PaginaModulo`, `ui/base`, `PainelCartao`, `SecaoArquivados`, `estilo.css` e `ui/quadro` afetam todos os módulos: depois de mexer, rode a bateria completa de telas.
  - Campo novo num tipo de lista (`TarefaLista`, `CompromissoLista`…, em `dados/tipos.ts`) quebra os testes que montam a lista à mão (ex.: `paginas/Inicio.test.tsx`): procure o tipo nos *.test.tsx.
  - Lista do escritório lida em todas as telas (etiquetas, funções da tarefa): carrega em `ui/sessao.tsx` (`iniciarEtiquetas`, `iniciarFuncoes`).
  - Contas de datas aaaa-mm-dd (`somarDias`, `diasEntre`, `DIAS_NA_SEMANA`) ficam em `regras/prazos.ts`, que não depende de nenhum módulo: use dali, não recrie.
  - Endereço que sai ou muda: veja [Rotas e endereços](#rotas) (quem escreve o endereço, como `regras/painelInicial.ts` e `e2e/ajudantes.ts`, e os testes que vão direto a ele) e ponha o antigo em `regras/enderecosAntigos.ts`. Cadastro novo em janela: a tabela `CADASTROS` de `App.tsx`.
  - Mudança que o usuário percebe: uma novidade em `app/novidades/proxima/<tarefa>-<palavras>.json` no mesmo commit.
  - Datas no horário de Brasília: os testes fixam o fuso (`vite.config.ts`, `playwright.config.ts`); não use `new Date()` solto nas regras.

<a id="pessoas"></a>
## Pessoas

O cadastro de pessoas (clientes, partes, contatos): o cadastro em etapas, o cartão, os vínculos entre pessoas, o sigilo e os responsáveis.
É o módulo modelo: os outros copiam a página, o quadro, o cartão e o cadastro dele.

- **Tabelas:** `pessoas` (base), `pessoa_historico` (base), `pessoa_responsaveis` (base), `pessoa_sigilos` (base), `pessoa_sigilo_acessos` (base), `pessoa_vinculos` (vinculos), `vinculo_tipos` (vinculos); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261024000001_base, 20261025000003_vinculos, 20261026000005_exportacoes, 20261026000006_lgpd_exclusao, 20261031100000_cnpj_com_letras, 20261031200000_importar_pessoas
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosPessoas`: pessoasListar, pessoasExportar, pessoasDaEtapa, pessoaObter, pessoaPorDocumento, pessoasPorTelefones, pessoaCriar, pessoaAtualizar, pessoasArquivar, pessoasExcluir, pessoaMover, pessoaHistorico, responsavelIncluir, responsavelRemover, pessoasResumo, pessoasSemDataDoConsentimento
  - `DadosSigilo`: sigilosListar, sigiloSalvar, sigiloApagar, sigiloAcessos, sigiloConceder
  - `DadosVinculos`: vinculoTiposListar, vinculoTipoCriar, vinculosListar, vinculoCriar, vinculoApagar, representantesVinculados
- **Outros arquivos de dados:** (app/src/dados/) consultas.ts
- **Regras:** (app/src/regras/)
  - `cadastro.ts`: Regras do cadastro de pessoa em etapas (paginas/NovaPessoa.tsx): os campos do formulário, quais etapas cada tipo de pessoa percorre e a validação de cada etapa.
  - `consentimentoSemData.ts`: O consentimento sem data (#409): antes da #405/#408, o cadastro podia salvar a base legal "consentimento" sem a data dele.
  - `conviteDaPessoa.ts`: O lugar de uma pessoa do cadastro na equipe, visto do cartão dela (#327): já é da equipe (o cartão mostra, com o link para a Equipe), já tem convite, pode ser…
  - `origemDaPessoa.ts`: O cadastro de pessoa aberto a partir de um cartão (#376): o "+ Nova pessoa" das seções Clientes e Pessoas (demanda, processo, tarefa, compromisso), o da…
  - `pessoa.ts`: Regras de cadastro de pessoas: listas do formulário, formatos, validação e qualificação.
  - `responsaveisDaPessoa.ts`: Os responsáveis da pessoa no topo do cartão (#387): vários, todos iguais, sem um principal.
  - `vinculos.ts`: Regras dos vínculos entre pessoas: como cada vínculo aparece em cada uma das duas pessoas e quais escolhas o formulário oferece (cada tipo nos dois sentidos).
- **Telas:** (app/src/paginas/) CartaoPessoa.tsx, EquipeDaPessoaNoTopo.tsx, NovaPessoa.css, NovaPessoa.tsx, Pessoas.css, Pessoas.tsx, PessoasNosItens.tsx, ProcessosDaPessoa.tsx, VinculosPessoa.tsx, clienteAoContrato.ts, novaPessoa/etapas.tsx, novaPessoa/foco.ts, novaPessoa/formulario.tsx, novaPessoa/origem.ts
- **Rotas:** `/pessoas/`, `/pessoas/nova/`
- **Peças de ui:** (app/src/ui/) BuscaPessoa.tsx
- **Outros:** (app/) src/improvisos/planilhaAntiga.ts
- **Testes unitários:** na pasta app, `npx vitest run src/dados/consultas.test.ts src/dados/contrato.test.ts src/improvisos/planilhaAntiga.test.ts src/paginas/EquipeDaPessoaNoTopo.test.tsx src/paginas/Pessoas.test.tsx src/paginas/PessoasNosItens.test.tsx src/paginas/novaPessoa/foco.test.ts src/regras/cadastro.test.ts src/regras/consentimentoSemData.test.ts src/regras/conviteDaPessoa.test.ts src/regras/origemDaPessoa.test.ts src/regras/pessoa.test.ts src/regras/responsaveisDaPessoa.test.ts src/regras/vinculos.test.ts src/ui/BuscaPessoa.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/cadastro.spec.ts e2e/consentimento-sem-data.spec.ts e2e/convidar-pelo-cartao.spec.ts e2e/nova-pessoa-no-cartao.spec.ts e2e/novo-padrao-das-secoes.spec.ts e2e/pessoas.spec.ts e2e/planilha-provisoria.spec.ts e2e/quadro.spec.ts e2e/responsaveis-da-pessoa.spec.ts e2e/vinculos.spec.ts`
- **Armadilhas:**
  - A validação de cada etapa do cadastro é a tabela `VALIDACAO` de `regras/cadastro.ts` (e `AO_ENTRAR`); etapa nova = entrada nova, um componente em `paginas/novaPessoa/etapas.tsx`.
  - Pessoa repetida se acha pelo CPF/CNPJ (`pessoaPorDocumento`) e, sem documento, pelos telefones (`pessoasPorTelefones`).
  - `improvisos/planilhaAntiga.ts` (PROVISORIO-219) manda as pessoas novas também para a planilha antiga; sai com o `e2e/planilha-provisoria.spec.ts`.
  - Excluir pessoa apaga o nome do registro de ações (LGPD, `lgpd_exclusao`; veja [Registro de ações e LGPD](#registro)): não guarde nome de pessoa em outro lugar sem pensar na exclusão.
  - O consentimento sem data (#409): a marca `consentimento_sem_data` do filtro "Situação do cadastro" (tabela `MARCAS` em `supabase.ts`, `falso.ts` e `paginas/Pessoas.tsx`) e a contagem `pessoasSemDataDoConsentimento`, do aviso do Início; os textos e o link ficam em `regras/consentimentoSemData.ts`. A contagem na produção (só números) é o roteiro docs/plataforma/consentimento-sem-data.md.

<a id="contratos"></a>
## Contratos

Os contratos de honorários: o cadastro, os clientes e participantes, a numeração por ano, quem vê os valores, e arquivar ou excluir em cascata.
O contrato é o centro: demandas, tarefas e parcelas se ligam a ele.

- **Tabelas:** `contratos` (contratos), `contrato_clientes` (contrato_clientes), `contrato_historico` (contratos), `contrato_participantes` (contrato_participantes), `contrato_processos` (ligar_processo_existente), `privado.contrato_numeracao` (contratos), `privado.contratos_com_demandas` (demandas), `privado.contratos_do_cliente_fechado` (cliente_ao_contrato), `privado.arquivados_com_contrato` (contrato_arquiva_em_cascata); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261027000009_contratos, 20261027000010_contrato_objetos, 20261027000011_numeracao_por_ano, 20261027000012_contrato_participantes, 20261027000013_contrato_clientes, 20261027000017_demandas, 20261104022738_ano_do_contrato_importado, 20261104150227_visibilidade_dos_contratos, 20261108000016_cliente_ao_contrato, 20261111095627_ligar_processo_existente, 20261117193606_contrato_abre_demandas, 20261119233811_grupos_da_equipe, 20261121224856_inicio_das_negociacoes, 20261122232543_contrato_arquiva_em_cascata, 20261122235537_contrato_exclui_em_cascata, 20261123030754_contrato_cascata_com_a_continua
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosContratos`: contratosListar, contratosDaEtapa, contratoObter, contratoVer, contratoAlterarSemValores, contratoCriar, pessoaFecharContrato, contasParaEscolher, contratoAtualizar, contratosArquivar, contratoExclusaoPrevia, contratosExcluir, contratoMover, contratoHistorico, objetosSugeridos, objetosDoEscritorio, objetoRenomear, objetosJuntar, objetoApagar, contratosDaPessoa
- **Regras:** (app/src/regras/)
  - `arquivarContrato.ts`: O que sai junto quando um contrato é arquivado (#284).
  - `contrato.ts`: Regras do contrato (módulo Contratos): categorias de honorário, número do contrato, valor da parcela, percentuais da divisão, leitura de valores em reais e a…
  - `equipeDoContrato.ts`: A equipe do contrato mudada no topo do cartão (#356), nas bolinhas: pôr um participante, tirá-lo, trocar o responsável e (#388) tornar responsável um…
  - `exclusaoDoContrato.ts`: Excluir o contrato exclui junto o que está ligado a ele (#284).
- **Telas:** (app/src/paginas/) CartaoContrato.tsx, Contratos.css, Contratos.tsx, ContratosDoProcesso.tsx, EquipeDoContratoNoTopo.tsx, ExclusaoDoContrato.tsx, NovoContrato.tsx, ParticipantesDoContrato.tsx, clienteAoContrato.ts, equipeDoContrato.ts
- **Rotas:** `/contratos/`, `/contratos/novo/`
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/ano_do_contrato_importado.test.sql supabase/tests/cliente_ao_contrato.test.sql supabase/tests/contrato_abre_demandas.test.sql supabase/tests/contrato_arquiva_em_cascata.test.sql supabase/tests/contrato_cascata_com_a_continua.test.sql supabase/tests/contrato_exclui_em_cascata.test.sql supabase/tests/inicio_das_negociacoes.test.sql supabase/tests/visibilidade_contratos.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/EquipeDoContratoNoTopo.test.tsx src/paginas/NovoContratoPelaOrigem.test.tsx src/paginas/ParticipantesDoContrato.test.tsx src/paginas/equipeDoContrato.test.ts src/regras/arquivarContrato.test.ts src/regras/contrato.test.ts src/regras/contratoAbreDemandas.test.ts src/regras/equipeDoContrato.test.ts src/regras/exclusaoDoContrato.test.ts src/ui/SecaoArquivados.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/arquivados.spec.ts e2e/cliente-ao-contrato.spec.ts e2e/contrato-abre-demandas.spec.ts e2e/contrato-arquiva-em-cascata.spec.ts e2e/contrato-exclui-em-cascata.spec.ts e2e/contratos.spec.ts e2e/equipe.spec.ts e2e/inicio-das-negociacoes.spec.ts e2e/nascer-ligado-demanda-contrato.spec.ts e2e/novo-padrao-das-secoes.spec.ts e2e/topo-do-cartao.spec.ts e2e/visibilidade-contratos.spec.ts`
- **Armadilhas:**
  - Arquivar e excluir em cascata estão duas vezes: no banco (gatilhos das migrações `contrato_arquiva_em_cascata` e `contrato_exclui_em_cascata`) e em `regras/arquivarContrato.ts` e `regras/exclusaoDoContrato.ts` (o fictício usa as regras): mude os dois.
  - Arquivar vários de uma vez é um update só no banco, e os gatilhos rodam com todos já arquivados: o `falso.ts` precisa gravar todos antes da cascata.
  - Uma tarefa pode ter vários contratos e demandas (`tarefa_contratos` e `tarefa_demandas`, de [Tarefas](#tarefas)): conte cada tarefa uma vez só, com a lista inteira.
  - A cascata não leva a demanda contínua, e a tarefa avulsa ligada ao contrato volta para ela (leia a coluna `demandas.continua` de verdade; veja [Demandas](#demandas)): testes `contrato_cascata_com_a_continua` (banco) e `e2e/contrato-arquiva-em-cascata.spec.ts`.
  - A cópia escondida do que saiu (`financeiro_excluidos`) precisa guardar o que Lucros e Meus valores leem, como o sócio do recebimento (`privado.socio_do_recebimento`).
  - O Excluir do ⋯ e a pergunta própria do contrato passam pelo cartão (`ui/TopoDoCartao.tsx`, `ui/AcoesDoCartao.tsx`, o texto do arquivado em `regras/topoDoCartao.ts`; veja [Cartão dos itens](#cartao)) e pela seção Arquivados (`perguntarAntesDeExcluir` em `ui/SecaoArquivados.tsx`; veja [Quadros](#quadros)).
  - O resumo da exclusão no registro de ações: `detalheDaExclusaoDoContrato`, na tabela `DETALHES` de `paginas/Equipe.tsx` (veja [Registro de ações e LGPD](#registro)).
  - Os valores do contrato só aparecem para quem é parte quando a chave do escritório está ligada (`contratoVer`, Equipe vê tudo).
  - Parcelas e recebimentos do contrato estão em [Parcelas e recebimentos](#parcelas); objetos, em [Objetos de contrato](#objetos).

<a id="objetos"></a>
## Objetos de contrato

Os objetos (o que o contrato cobre), a lista do escritório nas Configurações (corrigir, juntar parecidos) e a demanda que nasce de cada objeto.
As funções de dados ficam em `DadosContratos` (veja Contratos).

- **Tabelas:** `objeto_sugestoes` (contrato_objetos), `lista_modelos` (modelos_de_lista); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261027000010_contrato_objetos, 20261027000017_demandas, 20261027000019_modelos_de_lista, 20261107215006_demandas_dos_objetos, 20261108000016_cliente_ao_contrato, 20261117193606_contrato_abre_demandas, 20261119142702_checklists_com_grupos, 20261121223632_objetos_sem_demanda, 20261122232558_editar_objetos_de_contrato
- **Regras:** (app/src/regras/)
  - `objetos.ts`: Regras da lista de objetos de contrato nas Configurações (#281): conferir o nome corrigido, achar os parecidos para sugerir a junção, contar o uso e montar os…
- **Telas:** (app/src/paginas/) ModelosDeLista.tsx, ObjetosDeContrato.tsx
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/cliente_ao_contrato.test.sql supabase/tests/contrato_abre_demandas.test.sql supabase/tests/editar_objetos_de_contrato.test.sql supabase/tests/objetos_sem_demanda.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/paginas/ModelosDeLista.test.tsx src/paginas/ObjetosDeContrato.test.tsx src/regras/contratoAbreDemandas.test.ts src/regras/objetos.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/cliente-ao-contrato.spec.ts e2e/contrato-abre-demandas.spec.ts e2e/objetos-de-contrato.spec.ts e2e/objetos-sem-demanda.spec.ts`
- **Armadilhas:**
  - Juntar dois objetos muda todos os contratos que usam o de origem: confira o aviso de uso (`regras/objetos.ts`) e o teste do banco `editar_objetos_de_contrato`.
  - "A definir" é um objeto fixo, criado pelo cliente fechado (migração `cliente_ao_contrato`): não aparece na lista, não se corrige, não se junta nem se apaga.
  - Mudar o array `contratos.objetos` dispara o gatilho `privado.demandas_do_contrato` (migrações `demandas`, `demandas_dos_objetos`, `cliente_ao_contrato` e `objetos_sem_demanda`): corrigir um nome não pode fazer nascer demanda em contrato assinado.
  - O modelo de checklist se liga ao objeto pelo nome (`lista_modelos.nome`; veja [Checklists e modelos](#listas)): juntar ou corrigir objetos deixa modelos com nome que nenhum objeto usa.

<a id="demandas"></a>
## Demandas

As demandas (o trabalho de um caso, com prazo e fases): o cadastro, o cartão, demandas relacionadas e a demanda contínua, que junta as tarefas avulsas.

- **Tabelas:** `demandas` (demandas), `demanda_clientes` (demandas), `demanda_historico` (demandas), `demandas_relacionadas` (demandas_relacionadas); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261027000017_demandas, 20261109102349_equipe_ve_tudo, 20261110022014_lembretes_dos_prazos, 20261118200000_data_de_inicio, 20261119233811_grupos_da_equipe, 20261122125913_demandas_relacionadas, 20261123003418_demanda_continua, 20261123022647_demandas_continuas_do_escritorio, 20261123202316_grupo_com_demanda_continua, 20261123222534_filtro_de_grupo_pelas_demandas_do_escritorio
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosDemandas`: demandasListar, demandasDaEtapa, demandaObter, demandaCriar, demandaAtualizar, demandasArquivar, demandasExcluir, demandaMover, demandaHistorico, demandasDaPessoa, demandasDoContrato, contratoCriarDemanda, demandaContinua, demandasRelacionadas, demandaRelacionar, demandaDesrelacionar
- **Regras:** (app/src/regras/)
  - `dataDeInicio.ts`: A data de início de tarefas e demandas (#357): começa no dia em que o cartão foi criado (no horário de Brasília, como o padrão do banco,…
  - `demanda.ts`: Regras da demanda (módulo Demandas): o cadastro por etapas, os papéis de cada pessoa, o prazo e quem pode ser mencionado nos comentários.
  - `demandaContinua.ts`: A demanda contínua (#313, parte C): reúne as tarefas avulsas (sem demanda).
  - `demandaDoCompromisso.ts`: A demanda que nasce de cada data do compromisso que se repete (#307, parte B).
  - `demandasRelacionadas.ts`: Demandas relacionadas (#310): uma demanda ligada a outra, nos dois sentidos, numa linha só (como a tabela public.demandas_relacionadas,…
  - `ordemPorPrazo.ts`: Ordem de tarefas e demandas pelo prazo, a data de entrega (#291).
- **Telas:** (app/src/paginas/) CartaoDemanda.tsx, CartoesLigados.tsx, Demandas.css, Demandas.tsx, DemandasRelacionadas.tsx, NovaDemanda.tsx, concluirDemanda.ts
- **Rotas:** `/demandas/`, `/demandas/nova/`
- **Peças de ui:** (app/src/ui/) filtroDoInicio.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/contrato_cascata_com_a_continua.test.sql supabase/tests/data_de_inicio.test.sql supabase/tests/demanda_continua.test.sql supabase/tests/demandas_relacionadas.test.sql supabase/tests/grupo_com_demanda_continua.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/DemandasRelacionadas.test.tsx src/paginas/NovaDemanda.test.tsx src/paginas/NovaDemandaPelaOrigem.test.tsx src/regras/dataDeInicio.test.ts src/regras/demanda.test.ts src/regras/demandaContinua.test.ts src/regras/demandaDoCompromisso.test.ts src/regras/demandasRelacionadas.test.ts src/regras/ligarExistente.test.ts src/regras/ordemPorPrazo.test.ts src/ui/filtroDoInicio.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/contrato-arquiva-em-cascata.spec.ts e2e/demanda-continua.spec.ts e2e/demandas-relacionadas.spec.ts e2e/demandas.spec.ts e2e/ligar-existente.spec.ts e2e/tarefa-em-varias-ligacoes.spec.ts`
- **Armadilhas:**
  - A ordem pelo prazo (`regras/ordemPorPrazo.ts`) é a mesma no banco de verdade e no fictício: mude os dois.
  - A demanda contínua é criada pelo banco (uma por grupo da equipe e uma geral); não a crie pela tela.
  - A contínua é especial em todo lugar que lista, liga ou conclui demandas: `ehContinua` em `paginas/concluirDemanda.ts` (nunca se conclui), `regras/ligarExistente.ts` e `paginas/ligarNoCartao.ts` (desfazer a ligação devolve a tarefa a ela) e `demandasParaLigar` em `supabase.ts` (uma por grupo, todas contam). Veja [Ligações entre itens](#ligacoes).
  - Arquivar ou excluir contrato em cascata não leva a contínua, e a tarefa avulsa ligada ao contrato volta para ela: teste do banco `contrato_cascata_com_a_continua` e `e2e/contrato-arquiva-em-cascata.spec.ts` (veja [Contratos](#contratos)).
  - Checklists da demanda estão em [Checklists e modelos](#listas).
  - O filtro "Grupo da equipe" (e a opção "Geral") traz a contínua do grupo e as tarefas dela, pela contínua e não pelos grupos (ela não tem grupos): `pedidoDoFiltroDeGrupo` e `entraNoPedido` em `regras/gruposDaEquipe.ts`, `porGrupo` e `deTarefas` em `supabase.ts` e `public.tarefas_do_filtro_de_grupo` (migrações `grupo_com_demanda_continua` e `filtro_de_grupo_pelas_demandas_do_escritorio`). Os ids das demandas pedidas (as do grupo e as contínuas) vêm de `privado.demandas_do_filtro`, que não passa pelas regras de leitura das demandas: quem vê a tarefa a vê pelo filtro mesmo sem ver a demanda, como `daTarefaNoGrupo` em `falso.ts`.

<a id="listas"></a>
## Checklists e modelos

Os checklists (no código e no banco, "listas") da demanda, da tarefa e do contrato, com grupos numerados, e os modelos de checklist do escritório.

- **Tabelas:** `demanda_listas` (listas_das_demandas), `demanda_lista_itens` (listas_das_demandas), `demanda_lista_grupos` (checklists_com_grupos), `lista_modelos` (modelos_de_lista); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261027000018_listas_das_demandas, 20261027000019_modelos_de_lista, 20261030130000_listas_nas_tarefas, 20261109102349_equipe_ve_tudo, 20261119142702_checklists_com_grupos, 20261119175248_checklist_colar_de_uma_vez
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosListas`: listasDoCartao, listaCriar, listaAtualizar, listaExcluir, grupoDoChecklistCriar, grupoDoChecklistAtualizar, grupoDoChecklistExcluir, itemCriar, itemAtualizar, itemExcluir, listaReordenar, listaAcrescentar
  - `DadosModelos`: modelosListar, modeloCriar, modeloAtualizar, modeloExcluir
- **Regras:** (app/src/regras/)
  - `gruposDaLista.ts`: Checklists com grupos e subgrupos numerados (#309): 1.
  - `listas.ts`: Regras das listas da demanda (como as do Trello): o progresso, o prazo de cada item e a troca de posição de uma lista ou de um item.
- **Telas:** (app/src/paginas/) ListasDoCartao.tsx, ModelosDeLista.tsx, listas/ArvoreDoChecklist.tsx, listas/CampoDoItemNovo.tsx, listas/Lista.tsx, listas/useAcoesDoNo.tsx
- **Rotas:** `/modelos-de-lista/`
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/checklist_colar_de_uma_vez.test.sql supabase/tests/checklists_com_grupos.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/ListasDoCartao.test.tsx src/paginas/ModelosDeLista.test.tsx src/paginas/listas/GruposDoChecklist.test.tsx src/regras/gruposDaLista.test.ts src/regras/listas.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/checklists-com-grupos.spec.ts`
- **Armadilhas:**
  - As tabelas se chamam `demanda_listas…`, mas valem também para tarefas e contratos (coluna do cartão).
  - O nome do modelo é o nome do objeto de contrato que ele acompanha (`lista_modelos.nome`; veja [Objetos de contrato](#objetos)).

<a id="tarefas"></a>
## Tarefas

As tarefas: o cadastro, o cartão, as funções dos participantes (só "Executa" de fábrica; o participante pode ficar sem função), a aprovação interna, a diligência, copiar para outra demanda e o prazo do processo que a tarefa cumpre.

- **Tabelas:** `tarefas` (tarefas), `tarefa_pessoas` (tarefas), `tarefa_historico` (tarefas), `tarefa_demandas` (tarefa_em_varias_demandas_e_contratos), `tarefa_contratos` (tarefa_em_varias_demandas_e_contratos), `funcoes_na_tarefa` (tarefa_solicitante_e_funcoes); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261027000020_tarefas, 20261030120000_tempo_nas_tarefas, 20261102125539_andamentos_e_prazos, 20261109102349_equipe_ve_tudo, 20261110022014_lembretes_dos_prazos, 20261118200000_data_de_inicio, 20261119233811_grupos_da_equipe, 20261121223653_colunas_de_espera_das_tarefas, 20261122130410_tarefa_em_varias_demandas_e_contratos, 20261122232657_tarefa_diligencia, 20261122232702_tarefa_solicitante_e_funcoes, 20261123013306_tarefa_aprovacao, 20261123021438_tarefa_aprovacao_do_administrador, 20261123022040_tarefa_aprovacao_qualquer_um_liga, 20261123022826_tarefa_volta_a_continua, 20261123233405_funcoes_so_executa_de_fabrica
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosTarefas`: tarefasListar, tarefasDaEtapa, tarefaObter, tarefaCriar, tarefaAtualizar, tarefasArquivar, tarefasExcluir, tarefaMover, tarefaAprovar, tarefaDevolver, tarefaHistorico, tarefasDaPessoa, tarefasDaDemanda, tarefasDoContrato, tarefasGraficos
  - `DadosFuncoesNaTarefa`: funcoesNaTarefaListar, funcaoNaTarefaCriar, funcaoNaTarefaAtualizar, funcaoNaTarefaExcluir
- **Regras:** (app/src/regras/)
  - `aprovacaoDaTarefa.ts`: A aprovação interna da tarefa (#313, decisão do dono): só vale para a tarefa com a caixa "Precisa de aprovação" marcada (o cadastro a marca sozinho quando o…
  - `copiaDaTarefa.ts`: Copiar a tarefa para outra demanda (#312): toda tarefa pertence a uma demanda e, para usá-la em outra, se faz uma cópia.
  - `dataDeInicio.ts`: A data de início de tarefas e demandas (#357): começa no dia em que o cartão foi criado (no horário de Brasília, como o padrão do banco,…
  - `funcoesNaTarefa.ts`: As funções dos participantes da tarefa (#313, decisão do dono): cada participante tem uma função que diz por que ele está na tarefa ("Executa": recebeu a…
  - `ordemPorPrazo.ts`: Ordem de tarefas e demandas pelo prazo, a data de entrega (#291).
  - `prazoDaTarefa.ts`: O prazo do processo que a tarefa cumpre (#355): a tarefa nasceu de um prazo (o "Criar tarefa" do prazo) ou foi ligada a ele.
  - `tarefa.ts`: Regras da tarefa (módulo Tarefas): o cadastro por etapas, os papéis de cada pessoa, quem vê a tarefa, quem pode ser mencionado nos comentários e quando…
- **Telas:** (app/src/paginas/) AprovacaoDaTarefa.tsx, CartaoTarefa.tsx, CartoesLigados.tsx, FuncoesDosParticipantes.tsx, NovaTarefa.tsx, Tarefas.tsx, TarefasDaDemanda.tsx, copiarTarefa.tsx, prazoDaTarefa.ts
- **Rotas:** `/tarefas/`, `/tarefas/nova/`
- **Peças de ui:** (app/src/ui/) filtroDoInicio.ts, funcoesNaTarefa.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/colunas_de_espera_das_tarefas.test.sql supabase/tests/data_de_inicio.test.sql supabase/tests/funcoes_so_executa_de_fabrica.test.sql supabase/tests/grupo_com_demanda_continua.test.sql supabase/tests/tarefa_aprovacao.test.sql supabase/tests/tarefa_diligencia.test.sql supabase/tests/tarefa_em_varias_demandas_e_contratos.test.sql supabase/tests/tarefa_solicitante_e_funcoes.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/AprovacaoDaTarefa.test.tsx src/paginas/Inicio.test.tsx src/paginas/NovaTarefa.test.tsx src/paginas/TarefasDaDemanda.test.tsx src/paginas/copiarTarefa.test.tsx src/paginas/prazoDaTarefa.test.ts src/regras/aprovacaoDaTarefa.test.ts src/regras/colunasPadrao.test.ts src/regras/copiaDaTarefa.test.ts src/regras/dataDeInicio.test.ts src/regras/funcoesNaTarefa.test.ts src/regras/ordemPorPrazo.test.ts src/regras/prazoDaTarefa.test.ts src/regras/quadro.test.ts src/regras/tarefa.test.ts src/ui/filtroDoInicio.test.ts src/ui/funcoesNaTarefa.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/aviso-ao-ser-incluido.spec.ts e2e/colunas-padrao.spec.ts e2e/copiar-tarefa.spec.ts e2e/demanda-continua.spec.ts e2e/equipe-no-cartao.spec.ts e2e/grupos-da-equipe.spec.ts e2e/ligar-processo.spec.ts e2e/prazo-da-tarefa.spec.ts e2e/tarefa-aprovacao.spec.ts e2e/tarefa-em-varias-ligacoes.spec.ts e2e/tarefa-pedido.spec.ts e2e/tarefas.spec.ts`
- **Armadilhas:**
  - Concluir a tarefa que cumpre um prazo pergunta se o prazo foi cumprido (`regras/prazoDaTarefa.ts`, `paginas/situacaoDoItem.tsx`): teste pelos caminhos do ✓ do cartão e do círculo da miniatura.
  - Tarefa sem demanda vai para a demanda contínua (veja [Demandas](#demandas)). O cronômetro e os registros de tempo estão em [Tempo nas tarefas](#tempo).
  - A função de cada participante aparece e se troca nas bolinhas do topo do cartão (`ui/TopoDoCartao.tsx`, de [Cartão](#cartao); as bolinhas são de [Equipe](#equipe): `ui/EquipeDoCartao.tsx`, `paginas/EquipeNoTopo.tsx`, `paginas/equipeNoCartao.ts`, `regras/equipeNoCartao.ts`) e no cadastro (`ui/EscolhaDaEquipe.tsx`, `ui/BuscaNaEquipe.tsx`). A lista de funções se edita nas Configurações (`FuncoesDosParticipantes`, em `paginas/Configuracoes.tsx`) e carrega em `ui/sessao.tsx` (`iniciarFuncoes`). Ninguém ganha função sozinho (#421): o banco (`preparar_pedido_da_tarefa`), `falso.ts` e `regras/funcoesNaTarefa.ts` (`funcoesAoGravar`) mudam juntos.
  - O nome das bolinhas e os títulos das seções do cadastro e da edição da tarefa são lidos por testes de Equipe, Mensagens e Processos (já no comando abaixo).
  - Estado novo da tarefa = coluna reconhecida pelo sistema: `regras/quadro.ts` (`COLUNA_DE_APROVACAO`, `explicacaoDaColuna`), `regras/colunasPadrao.ts`, `ui/quadro/Kanban.tsx` e `paginas/situacaoDoItem.tsx` (veja [Quadros](#quadros)); mexeu no Kanban, rode a bateria completa.
  - A aprovação está no banco, em `falso.ts` e em `dados/contrato.test.ts`: mude os três juntos. Regra que vale para quem executa ou para quem pede: teste também o administrador (que pela RLS altera tudo) e quem só altera a tarefa (veja [Equipe](#equipe)).
  - A devolução grava um comentário: a seção de comentários (`ui/Comentarios.tsx`, de [Comentários e menções](#comentarios)) relê a lista pela `versao`.

<a id="tempo"></a>
## Tempo nas tarefas

O cronômetro das tarefas, os registros de tempo (corrigir e apagar) e a página "Meu tempo trabalhado".

- **Tabelas:** `tarefa_tempos` (tempo_nas_tarefas); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261030120000_tempo_nas_tarefas, 20261030160000_meu_tempo, 20261121164027_tempo_apagar_e_corrigir
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosTempo`: tempoIniciar, tempoGravar, tempoAjustar, tempoCorrigir, tempoApagar, tempoDevolver, tempoDaTarefa, tempoDaDemanda, tempoPorTarefa
- **Regras:** (app/src/regras/)
  - `cronometro.ts`: O cronômetro das tarefas, sem tela nem banco: o estado de um período que está sendo contado e o que cada acontecimento faz com ele (começar, pausar, a pessoa…
  - `meuTempo.ts`: Regras de "Meu tempo trabalhado": os períodos (esta semana, este mês, o mês passado ou um intervalo escolhido), em datas do calendário, e o total.
  - `registrosDeTempo.ts`: Os registros de tempo de uma tarefa (#400), sem tela nem banco: a lista (do mais novo ao mais antigo), quem mexe em qual, o registro que o cronômetro ainda…
- **Telas:** (app/src/paginas/) MeuTempo.tsx, TempoNaTarefa.tsx, useCronometro.ts
- **Rotas:** `/tarefas/meu-tempo/`
- **Peças de ui:** (app/src/ui/) cronometros.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/tempo_apagar_e_corrigir.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/MeuTempo.test.tsx src/paginas/TempoNaTarefa.test.tsx src/regras/cronometro.test.ts src/regras/meuTempo.test.ts src/regras/registrosDeTempo.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/meu-tempo.spec.ts e2e/registros-de-tempo.spec.ts`
- **Armadilhas:**
  - O cronômetro conta em todas as abas do navegador (`ui/cronometros.ts`): teste com duas abas abertas.

<a id="processos"></a>
## Processos

Os processos de cada tipo (`TIPOS_PROCESSO`, em `regras/processo.ts`): o cadastro, o cartão, as partes e recursos, os andamentos e prazos, os campos do escritório e o painel de Processos.

- **Tabelas:** `processos` (processos), `processo_andamentos` (andamentos_e_prazos), `processo_campos` (campos_de_processo), `processo_clientes` (processos), `processo_demandas` (processo_demandas), `processo_etiquetas` (processos), `processo_historico` (processos), `processo_opcoes` (processos), `processo_partes` (processo_partes_recursos_e_tipos), `processo_prazos` (andamentos_e_prazos); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261101155218_processos, 20261101223028_historico_processos_sem_nome_ordem, 20261101223231_campos_de_processo, 20261102125539_andamentos_e_prazos, 20261102135353_painel_de_processos, 20261102144922_processo_demandas, 20261109102349_equipe_ve_tudo, 20261109123422_advogado_entra_no_processo, 20261111095627_ligar_processo_existente, 20261117105648_polo_criminal, 20261119103649_andamentos_tipo_e_comentarios_de_processos, 20261119121901_painel_com_tipo_do_andamento, 20261119233811_grupos_da_equipe, 20261121225422_colunas_de_acompanhamento_dos_processos, 20261122130109_processo_partes_recursos_e_tipos, 20261123003604_propriedade_intelectual, 20261123102520_investigacao_no_processo_administrativo
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosProcessos`: processosListar, processosDaEtapa, processoObter, processoCriar, processoAtualizar, processosArquivar, processosExcluir, processoMover, cartaoSair, processoMeIncluir, faseDeAdaptacaoDefinir, processoHistorico, processosDaPessoa, processoPartes, processoParteIncluir, processoParteRetirar, processosRelacionados, processoOpcoes, processoOpcaoCriar, processoOpcaoExcluir, processoSugestoes, processoCampos, processoCampoCriar, processoCampoAtualizar, processoCampoExcluir
  - `DadosAcompanhamento`: processoAndamentos, processoAndamentoCriar, processoAndamentoAtualizar, processoAndamentoExcluir, processoAndamentoRestaurar, processoPrazos, processoPrazoCriar, processoPrazoAtualizar, processoPrazoExcluir, processoPrazoRestaurar, prazosDaTarefa, tarefasDoProcesso, processoDemandaLigar, processoDemandaDesligar, contratoProcessoLigar, contratoProcessoDesligar, processosDoContrato, contratosDoProcesso, demandasDoProcesso, processosDaDemanda, processosPainel, processosGraficos, processosDiasParadoSalvar
- **Regras:** (app/src/regras/)
  - `andamentos.ts`: Andamentos e prazos de um processo: o que cada tipo pede, a conferência dos formulários, a situação de cada prazo e a tarefa que nasce de uma intimação ou de…
  - `camposDeProcesso.ts`: Campos que o escritório cria nos processos: os tipos, como cada valor é lido e mostrado, e o que aparece em cada processo.
  - `graficosDeProcessos.ts`: As contas dos números e dos gráficos do painel de Processos (#401).
  - `investigacaoNoAdministrativo.ts`: Extrajudicial e Investigação saem dos tipos de processo (#406, decisão do dono): a investigação é um processo administrativo, e o que é extrajudicial é demanda.
  - `numeroCNJ.ts`: Número único do processo judicial, no padrão do CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO.
  - `painelProcessos.ts`: O painel de Processos: até onde cada lista olha, os grupos de prazos, os números de cada coluna e os textos de cada linha.
  - `prazoDaTarefa.ts`: O prazo do processo que a tarefa cumpre (#355): a tarefa nasceu de um prazo (o "Criar tarefa" do prazo) ou foi ligada a ele.
  - `processo.ts`: Regras do processo (módulo Processos): os dois tipos (judicial e administrativo), as listas prontas, o cadastro por etapas, o que aparece no cartão, as pessoas…
  - `processoDaDemanda.ts`: O processo que nasce de uma demanda: o que o cadastro já traz preenchido, quando perguntar e a tarefa que herda a demanda.
- **Telas:** (app/src/paginas/) CamposDoProcesso.tsx, CartaoProcesso.tsx, ContratosDoProcesso.tsx, NovoProcesso.tsx, PainelProcessos.tsx, PartesDoProcesso.tsx, Processos.css, Processos.tsx, ProcessosDaDemanda.tsx, ProcessosDaPessoa.tsx, ProcessosDoCartao.tsx, ProcessosRelacionados.tsx, prazoDaTarefa.ts, processo/Andamentos.tsx, processo/AndamentosEPrazos.css, processo/AndamentosEPrazos.tsx, processo/CamposDaProtecao.tsx, processo/FormDoPrazo.tsx, processo/Prazos.tsx, processo/ValidadeDaProtecao.tsx, processo/tarefaDoProcesso.ts
- **Rotas:** `/processos/`, `/processos/administrativo/`, `/processos/judicial/`, `/processos/novo/`
- **Peças de ui:** (app/src/ui/) EscolhaDeProcessos.tsx, LigarProcesso.tsx
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/advogado_entra_no_processo.test.sql supabase/tests/andamentos_tipo_e_comentarios_de_processos.test.sql supabase/tests/colunas_de_acompanhamento_dos_processos.test.sql supabase/tests/investigacao_no_processo_administrativo.test.sql supabase/tests/ligar_processo_existente.test.sql supabase/tests/polo_criminal.test.sql supabase/tests/processo_partes_recursos_e_tipos.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/NovoProcesso.test.tsx src/paginas/PartesDoProcesso.test.tsx src/paginas/ProcessosDoCartao.test.tsx src/paginas/prazoDaTarefa.test.ts src/paginas/processo/Andamentos.test.tsx src/regras/ajuda.test.ts src/regras/andamentos.test.ts src/regras/buscaGeral.test.ts src/regras/camposDeProcesso.test.ts src/regras/colunasPadrao.test.ts src/regras/enderecosAntigos.test.ts src/regras/graficosDeProcessos.test.ts src/regras/investigacaoNoAdministrativo.test.ts src/regras/numeroCNJ.test.ts src/regras/painelProcessos.test.ts src/regras/prazoDaTarefa.test.ts src/regras/processo.test.ts src/regras/processoDaDemanda.test.ts src/regras/processoPartesERecursos.test.ts src/ui/BuscaGeral.test.tsx src/ui/EscolhaDeProcessos.test.tsx src/ui/LigarProcesso.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/ajuda.spec.ts e2e/andamentos-e-comentarios-do-processo.spec.ts e2e/busca-geral.spec.ts e2e/colunas-padrao.spec.ts e2e/criar-processo-e-tarefa-ligados.spec.ts e2e/ligar-processo.spec.ts e2e/mais-no-titulo-das-secoes.spec.ts e2e/menu-lateral.spec.ts e2e/prazo-da-tarefa.spec.ts e2e/processo-partes-e-recursos.spec.ts e2e/processos.spec.ts e2e/propriedade-intelectual.spec.ts`
- **Armadilhas:**
  - Cada tipo tem o seu quadro (rota própria, `key` em `App.tsx`): mudança no quadro vale para todos os tipos de `TIPOS_PROCESSO`.
  - Tipo de processo novo ou que sai: `TIPOS_PROCESSO` (`regras/processo.ts`), as rotas em `App.tsx`, os links em `ui/Casca.tsx`, os grupos em `regras/buscaGeral.ts`, `ui/BuscaGeral.tsx` (`ICONE_DO_GRUPO`) e `ui/fontesDaBuscaGeral.ts`, `ONDE_APARECE` em `regras/camposDeProcesso.ts`, `regras/graficosDeProcessos.ts`, `regras/ajuda.ts` e `regras/enderecosAntigos.ts` (veja [Rotas e endereços](#rotas)).
  - Colunas novas num quadro que já existe: o escritório pode ter renomeado colunas e grupos ou deixado um grupo vazio (ou o quadro não ter grupos); ache pelo código fixo (`regras/quadro.ts`) e siga `regras/colunasPadrao.ts` (o precedente é `COLUNAS_NOVAS_DOS_PROCESSOS`, #315; veja [Quadros](#quadros)).
  - Conversão que está na migração e numa regra que o `falso.ts` usa (como o grupo da fase e a coluna equivalente): mude as duas, com o mesmo caso no teste do banco e no `dados/contrato.test.ts`.
  - A contagem de prazos (dias úteis, feriados) está em [Calendário e prazos](#calendario); a propriedade intelectual, em [Propriedade intelectual](#propriedade-intelectual).

<a id="propriedade-intelectual"></a>
## Propriedade intelectual

O processo (em geral administrativo, no INPI) da área de propriedade intelectual (marca, patente, desenho, direito autoral): os campos da proteção,
os papéis titular e inventor nas partes, a validade e os prazos do INPI na agenda.

- **Migrações:** (supabase/migrations/) 20261123003604_propriedade_intelectual
- **Regras:** (app/src/regras/)
  - `processo.ts`: Regras do processo (módulo Processos): os dois tipos (judicial e administrativo), as listas prontas, o cadastro por etapas, o que aparece no cartão, as pessoas…
  - `propriedadeIntelectual.ts`: Propriedade intelectual (#317): o tipo de proteção do processo da área "Propriedade intelectual", os campos de cada tipo, os papéis que só existem nele…
- **Telas:** (app/src/paginas/) CartaoProcesso.tsx, NovoProcesso.tsx, PartesDoProcesso.tsx, processo/CamposDaProtecao.tsx, processo/ValidadeDaProtecao.tsx
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/propriedade_intelectual.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/paginas/NovoProcesso.test.tsx src/paginas/PartesDoProcesso.test.tsx src/regras/processo.test.ts src/regras/propriedadeIntelectual.test.ts src/regras/propriedadeIntelectualNaAgenda.test.ts src/regras/repeticao.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/compromissos-que-se-repetem.spec.ts e2e/processo-partes-e-recursos.spec.ts e2e/processos.spec.ts e2e/propriedade-intelectual-na-agenda.spec.ts e2e/propriedade-intelectual.spec.ts`
- **Armadilhas:**
  - É um processo com campos a mais: as tabelas, as funções de dados e as telas são as de [Processos](#processos) (área `AREA_DA_PI`; campos e validação em `regras/processo.ts`; papéis em `paginas/PartesDoProcesso.tsx`).
  - O "Acompanhar na agenda" preenche o cadastro do compromisso que se repete (`compromissoRepetir`, `paginas/NovoCompromisso.tsx`; veja [Agenda e compromissos](#agenda)).
  - A ordem das datas (a concessão depois do depósito) é conferida no banco e no `falso.ts`; a frase (`CONCESSAO_ANTES_DO_DEPOSITO`, em `regras/propriedadeIntelectual.ts`) traduz o erro do banco em `dados/erros.ts`.

<a id="agenda"></a>
## Agenda e compromissos

Os compromissos (reuniões, audiências, prazos na agenda): o cadastro, o cartão, a visão por data, os que se repetem (e a demanda que nasce de cada data) e as salas do escritório.

- **Tabelas:** `compromissos` (compromissos), `compromisso_etiquetas` (compromissos), `compromisso_historico` (compromissos), `compromisso_ligacoes` (ligacoes_dos_compromissos), `compromisso_pessoas` (compromissos), `compromisso_repeticoes` (compromissos_que_se_repetem), `salas` (salas_do_escritorio); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261102141258_compromissos, 20261119233811_grupos_da_equipe, 20261122130038_ligacoes_dos_compromissos, 20261122132438_salas_do_escritorio, 20261122232804_compromissos_que_se_repetem, 20261123000750_demandas_dos_compromissos, 20261123011949_repeticao_so_quem_muda_as_datas
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosCompromissos`: compromissosListar, compromissosDaEtapa, compromissosDoPeriodo, compromissoObter, compromissoCriar, compromissoAtualizar, compromissosArquivar, compromissosExcluir, compromissoMover, compromissoHistorico, compromissosDaPessoa, compromissosDoProcesso, compromissosDoItem, compromissoItens, compromissoLigar, compromissoDesligar, compromissoRepetir, compromissoMudarSeguintes, compromissoArquivarSeguintes, compromissoGerarDemandas, prazosDoPeriodo, processosParaLigar
  - `DadosSalas`: salasListar, salaCriar, salaAtualizar, salaOcupacao
- **Regras:** (app/src/regras/)
  - `agenda.ts`: A visão por data da agenda: o dia de hoje no horário de Brasília, os períodos (dia, semana e mês), o caminhar entre eles e os itens de cada dia.
  - `compromisso.ts`: Regras do compromisso (módulo Compromissos, a agenda): os tipos, o cadastro por etapas, o que aparece no cartão, os papéis de cada pessoa e quem vê.
  - `demandaDoCompromisso.ts`: A demanda que nasce de cada data do compromisso que se repete (#307, parte B).
  - `repeticao.ts`: O compromisso que se repete (#307): por semana, mês ou ano, a cada N (a renovação de marca é "a cada 10 anos"), até uma data, depois de um número de vezes ou…
  - `sala.ts`: Regras das salas do escritório (#308): o cadastro nas Configurações, as opções do cadastro de compromisso e o conflito de horário, puras, sem tela nem banco.
- **Telas:** (app/src/paginas/) CartaoCompromisso.tsx, Compromissos.css, Compromissos.tsx, CompromissosDoItem.tsx, CompromissosLigados.tsx, ItensDoCompromisso.tsx, NovoCompromisso.tsx, QuandoDoCompromisso.tsx, SalasDoEscritorio.tsx, agenda/VisaoPorData.tsx, agenda/origemDoCompromisso.ts, agenda/useSalas.ts
- **Rotas:** `/agenda/`, `/agenda/novo/`
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/compromissos_que_se_repetem.test.sql supabase/tests/demandas_dos_compromissos.test.sql supabase/tests/ligacoes_dos_compromissos.test.sql supabase/tests/mensagens.test.sql supabase/tests/repeticao_so_quem_muda_as_datas.test.sql supabase/tests/salas_do_escritorio.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/ItensDoCompromisso.test.tsx src/paginas/Mensagens.test.tsx src/paginas/QuandoDoCompromisso.test.tsx src/paginas/SalasDoEscritorio.test.tsx src/regras/agenda.test.ts src/regras/compromisso.test.ts src/regras/demandaDoCompromisso.test.ts src/regras/mensagens.test.ts src/regras/repeticao.test.ts src/regras/sala.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/compromissos-ligados.spec.ts e2e/compromissos-que-se-repetem.spec.ts e2e/compromissos.spec.ts e2e/demanda-do-compromisso.spec.ts e2e/mensagens.spec.ts e2e/menu-lateral.spec.ts e2e/salas.spec.ts`
- **Armadilhas:**
  - O conflito de horário das salas é conferido no banco e em `regras/sala.ts` (o fictício): mude os dois.
  - Cada data de um compromisso que se repete é um cartão; só quem pode mudar as datas mexe na repetição (teste do banco `repeticao_so_quem_muda_as_datas`).
  - O `falso.ts` reescreve à mão as regras da série (repetir, mudar "esta e as seguintes", arquivar as seguintes, só a próxima data no quadro): cada caso do teste do banco precisa do caso igual em `dados/contrato.test.ts`.
  - A demanda que nasce de cada data avisa o responsável: o aviso aparece em `paginas/Mensagens.tsx` (`ItemDaDemandaDoCompromisso`; veja [Mensagens e avisos](#mensagens)).
  - As datas seguintes e as demandas de cada data também nascem de rotinas do banco, sem ninguém logado (veja [Rotinas automáticas](#rotinas)). As contas de datas ficam em `regras/prazos.ts`.

<a id="calendario"></a>
## Calendário e prazos

O calendário do escritório (feriados, suspensões, órgãos) e a contagem de prazos em dias corridos ou úteis.

- **Tabelas:** `dias_sem_expediente` (calendario_de_prazos), `orgaos` (calendario_de_prazos); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261101112711_calendario_de_prazos
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosCalendario`: orgaosListar, orgaoCriar, orgaoAtualizar, orgaoExcluir, diasListar, diasLancar, diasExcluir
- **Regras:** (app/src/regras/)
  - `calendario.ts`: Calendário do escritório: junta os dias sem expediente prontos (regras/prazos.ts) com os órgãos e os dias que o escritório lançou.
  - `prazos.ts`: Contagem de prazos: em dias corridos ou em dias úteis, pulando feriados e suspensões.
- **Telas:** (app/src/paginas/) Calendario.css, Calendario.tsx, calendario/CalcularPrazo.tsx, calendario/DiasDoAno.tsx, calendario/OrgaosDoEscritorio.tsx, calendario/useContagem.ts
- **Rotas:** `/calendario/`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/calendario/Calendario.test.tsx src/regras/agenda.test.ts src/regras/calendario.test.ts src/regras/prazos.test.ts src/regras/propriedadeIntelectualNaAgenda.test.ts src/regras/repeticao.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/calendario.spec.ts`
- **Armadilhas:**
  - Os feriados fixos e móveis já vêm prontos em `regras/prazos.ts`; o banco guarda só o que o escritório lançou.
  - `regras/prazos.ts` não depende de nenhum módulo (Agenda e Propriedade intelectual importam dele `somarDias`, `diasEntre` e `DIAS_NA_SEMANA`): não importe um módulo dali, para não criar importação circular.

<a id="lembretes"></a>
## Prazos, lembretes e e-mails de prazo

A hora e o lembrete do prazo de tarefas e demandas, os avisos de prazo na caixa de mensagens e o e-mail diário de prazos.

- **Tabelas:** `resumos_de_prazos` (avisos_de_prazo); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261109085738_avisos_de_prazo, 20261110022014_lembretes_dos_prazos
- **Regras:** (app/src/regras/)
  - `lembrete.ts`: Hora e lembrete nos prazos de tarefas e demandas (#286): as opções de lembrete, como o prazo aparece com a hora e quando o lembrete chega.
- **Telas:** (app/src/paginas/) CamposDoLembrete.tsx, EmailsDePrazo.tsx
- **Peças de ui:** (app/src/ui/) base/BotaoDoLembrete.tsx
- **Servidor (funções do Supabase):** (supabase/functions/) _compartilhado/emailsDePrazo.ts, prazos-enviar-emails/index.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/avisos_de_prazo.test.sql supabase/tests/lembretes_dos_prazos.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/paginas/EmailsDePrazo.test.tsx src/regras/emailsDePrazo.test.ts src/regras/lembrete.test.ts src/ui/base/BotaoDoLembrete.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/lembretes.spec.ts`
- **Armadilhas:**
  - O e-mail sai de uma função do servidor (`prazos-enviar-emails`, Deno); o teste dela fica em `app/src/regras/emailsDePrazo.test.ts`, que importa de `supabase/functions/_compartilhado/`.

<a id="documentos"></a>
## Documentos e anotações

O módulo Documentos: as anotações em Markdown (editor ao vivo, salva sozinho), as pastas, o explorador e as anotações no cartão de cada item.

- **Tabelas:** `anotacoes` (anotacoes), `anotacao_etiquetas` (pastas_e_etiquetas_das_anotacoes), `anotacao_historico` (anotacoes), `anotacao_ligacoes` (anotacoes), `anotacao_pastas` (pastas_e_etiquetas_das_anotacoes); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261117143714_anotacoes, 20261118120000_pastas_e_etiquetas_das_anotacoes, 20261119020000_comentarios_das_anotacoes, 20261119233811_grupos_da_equipe
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosAnotacoes`: anotacoesListar, anotacaoObter, anotacaoCriar, anotacaoDuplicar, anotacaoAtualizar, anotacaoGravarTexto, anotacoesArquivar, anotacoesExcluir, anotacaoHistorico, anotacaoLigar, anotacaoDesligar, anotacaoItens, anotacoesDoItem, anotacoesDoItemComTexto, itensParaLigar, anotacoesParaLigar
  - `DadosPastas`: pastasListar, pastaCriar, pastaRenomear, pastaMover, pastaExcluir
- **Regras:** (app/src/regras/)
  - `anotacao.ts`: Regras da anotação (módulo Documentos, #303): os módulos a que ela se liga, o nome e o endereço de cada item ligado, e quem vê e quem altera.
  - `anotacaoEmMarkdown.ts`: A anotação baixada como arquivo Markdown (.md), para usar fora do SEMPER, no Obsidian por exemplo (#345).
  - `aoVivo.ts`: O editor ao vivo das anotações (#364): o texto continua sendo o mesmo Markdown guardado, mas aparece já formatado enquanto a pessoa escreve (títulos grandes,…
  - `explorador.ts`: O explorador da página Documentos, como o do Obsidian: a árvore das pastas com as anotações dentro de cada uma, e as que não estão em nenhuma pasta no primeiro…
  - `novoNaAnotacao.ts`: O "+ Novo…" da seção "Ligada a" da anotação (#376): um menu com um item por módulo ligado no escritório (as pessoas sempre), cada um abrindo o cadastro do item…
  - `pastas.ts`: Pastas dos documentos (#342), como no Obsidian: a árvore montada a partir da lista que o banco devolve, o caminho de uma pasta ("Escritório › POPs ›…
  - `salvamento.ts`: O texto que salva sozinho (a anotação, como no Obsidian): em que pé está a gravação, para a tela mostrar "Salvando…" ou "Salvo" de um jeito discreto, e o que…
- **Telas:** (app/src/paginas/) AnotacoesDoCartao.tsx, CartaoAnotacao.tsx, Documentos.css, Documentos.tsx, NovoNaAnotacao.tsx, RascunhoDaAnotacao.tsx, nascerNaAnotacao.tsx
- **Rotas:** `/documentos/`
- **Peças de ui:** (app/src/ui/) LigarItem.tsx, Pastas.tsx, base/EditorAoVivo.tsx, base/EditorAoVivoCodeMirror.tsx, base/EditorDeTexto.tsx, pastasDoEscritorio.ts
- **Outros:** (app/) src/testes/editorAoVivo.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/anotacoes.test.sql supabase/tests/comentarios_das_anotacoes.test.sql supabase/tests/pastas_das_anotacoes.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/AnotacoesDoCartao.test.tsx src/paginas/CartaoAnotacao.test.tsx src/paginas/NovoNaAnotacao.test.tsx src/paginas/nascerNaAnotacao.test.tsx src/regras/anotacao.test.ts src/regras/anotacaoEmMarkdown.test.ts src/regras/aoVivo.test.ts src/regras/explorador.test.ts src/regras/novoNaAnotacao.test.ts src/regras/pastas.test.ts src/regras/salvamento.test.ts src/ui/LigarItem.test.tsx src/ui/Pastas.test.tsx src/ui/base/EditorAoVivo.test.tsx src/ui/base/EditorDeTexto.test.tsx src/ui/pastasDoEscritorio.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/documentos.spec.ts e2e/novo-na-anotacao.spec.ts`
- **Armadilhas:**
  - A anotação nova não é um cadastro: abre em Documentos, na janela da anotação (não entra em `CADASTROS` de `App.tsx`).

<a id="financeiro"></a>
## Financeiro

O caixa do escritório: entradas e saídas, as contas, o DAS, os sócios, os ajustes de saldo, o painel com os números e gráficos.
Só administradores. Direitos e obrigações (parcelas) estão em Parcelas e recebimentos.

- **Tabelas:** `financeiro_contas` (financeiro_caixa), `financeiro_das` (financeiro_caixa), `financeiro_lancamentos` (financeiro_caixa), `financeiro_socios` (financeiro_parcelas), `financeiro_ajustes` (financeiro_caixa), `financeiro_historico` (financeiro_caixa), `financeiro_excluidos` (contrato_exclui_em_cascata); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261102175057_financeiro_caixa, 20261102192042_financeiro_parcelas, 20261103000916_financeiro_lucro, 20261104000100_ajuste_de_saldo, 20261107215301_lancamento_da_planilha, 20261107233223_correcao_de_recebimento, 20261120231028_excluir_conta, 20261122235537_contrato_exclui_em_cascata
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosFinanceiro`: financeiroContas, financeiroContaCriar, financeiroContaAtualizar, financeiroContaExcluir, financeiroArquivadasComLancamentos, financeiroLancamentos, financeiroAjustesDeSaldo, financeiroSaldoAntes, financeiroLancamentoCriar, financeiroLancamentoAtualizar, financeiroLancamentoExcluir, financeiroLancamentoRestaurar, financeiroTransferir, financeiroHistorico, financeiroDas, financeiroDasSalvar, financeiroAjustes
- **Regras:** (app/src/regras/)
  - `caixa.ts`: O caixa do escritório: as categorias de cada lançamento, a conferência dos formulários e o saldo de cada dia.
  - `financeiro.ts`: A divisão de cada recebimento: quanto chega ao escritório, quanto fica com o responsável, quanto ele repassa e o que o escritório paga ao sócio que indicou.
  - `graficosFinanceiros.ts`: As contas dos indicadores e gráficos do Financeiro (sem tela, sem banco), só com o que já entrou (#268): nada de valor a receber, contratado ou em aberto, para…
  - `numerosDoFinanceiro.ts`: Os números e os gráficos do painel do Financeiro (#403).
  - `painelFinanceiro.ts`: O painel do financeiro: o ano mês a mês, o extrato com filtros, a carteira de contratos e o arquivo para planilha.
- **Telas:** (app/src/paginas/) Financeiro.css, Financeiro.tsx, financeiro/APassar.tsx, financeiro/AbasDoFinanceiro.tsx, financeiro/AjustesDeSaldo.tsx, financeiro/CorrigirRecebimento.tsx, financeiro/DetalheFinanceiro.tsx, financeiro/Formularios.tsx, financeiro/Graficos.tsx, financeiro/Hub.tsx, financeiro/NovoLancamento.tsx, financeiro/Parcelas.tsx, financeiro/Repasses.tsx, financeiro/SocioNaEquipe.tsx, financeiro/Socios.tsx
- **Rotas:** `/financeiro/`, `/financeiro/contas/`, `/financeiro/saidas/`
- **Peças de ui:** (app/src/ui/) MenuFinanceiro.tsx
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/lancamento_da_planilha.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/conferencia.test.ts src/dados/contrato.test.ts src/paginas/Financeiro.test.tsx src/paginas/financeiro/ContasDoEscritorio.test.tsx src/paginas/financeiro/SocioNaEquipe.test.tsx src/regras/caixa.test.ts src/regras/conferencia.test.ts src/regras/financeiro.test.ts src/regras/graficosFinanceiros.test.ts src/regras/numerosDoFinanceiro.test.ts src/regras/painelFinanceiro.test.ts src/regras/parcelas.test.ts src/ui/MenuFinanceiro.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/conferencia.spec.ts e2e/contrato-exclui-em-cascata.spec.ts e2e/financeiro.spec.ts e2e/lucros.spec.ts e2e/mais-no-titulo-das-secoes.spec.ts e2e/meus-valores.spec.ts e2e/parcelas.spec.ts e2e/topo-do-cartao.spec.ts`
- **Armadilhas:**
  - Valores em centavos (número inteiro) e datas "aaaa-mm-dd" em todas as regras do financeiro.
  - O Hub e as abas (`paginas/financeiro/Hub.tsx`, `paginas/financeiro/AbasDoFinanceiro.tsx` e `TELAS_DO_FINANCEIRO` de `e2e/ajudantes.ts`) abrem Parcelas, Lucros, Meus valores e Conferência: mexeu no Hub ou nos endereços, rode os testes dessas telas (já no comando abaixo) e veja [Rotas e endereços](#rotas).

<a id="parcelas"></a>
## Parcelas e recebimentos

As parcelas dos contratos (Direitos e Obrigações do Financeiro), o recebimento completo, a divisão entre escritório, responsável e indicação, e os repasses.

- **Tabelas:** `contrato_parcelas` (financeiro_parcelas), `contrato_parcelas_historico` (financeiro_parcelas), `financeiro_recebimentos` (financeiro_parcelas), `financeiro_repasses` (financeiro_parcelas), `financeiro_terceiros_pagos` (meus_valores), `privado.contratos_com_parcelas` (financeiro_parcelas), `privado.socio_do_recebimento` (financeiro_lucro); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261102192042_financeiro_parcelas, 20261103000138_financeiro_descontos, 20261103000916_financeiro_lucro, 20261104000000_meus_valores, 20261104020121_quem_recebeu_marca_o_pagamento, 20261104025026_parcela_antiga_recebida, 20261104145914_corrigir_parcela_importada, 20261104150402_a_passar_quem_paga, 20261107171835_rapidez_das_parcelas, 20261107232004_recebimento_completo, 20261107233223_correcao_de_recebimento
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosParcelas`: parcelasDoContrato, parcelasHistorico, parcelasDaPessoa, parcelasDoPeriodo, parcelaCriar, parcelaAtualizar, parcelaCorrigirImportada, parcelaExcluir, parcelaRestaurar, parcelasGerar, financeiroParaReceber, financeiroReceber, financeiroRecebimento, financeiroRecebimentoDoLancamento, financeiroRecebimentoTemPagamento, financeiroCorrigirRecebimento, financeiroLancarCorrecao, financeiroContratosDaCarteira, financeiroRecebimentosDoPeriodo, financeiroMeusValores, conferenciaListar, conferenciaResumo, conferenciaMarcar, conferenciaCorrigir, conferenciaHistorico, financeiroAPassar, financeiroTerceiroMarcarPago, financeiroTerceiroDesfazerPago, financeiroEstornar, financeiroRestaurarRecebimento, financeiroRepasses, financeiroPagarRepasse, financeiroDesfazerPagamento, financeiroLucro, financeiroPagarLucro, financeiroDesfazerLucro, financeiroRestaurarLucro, financeiroSocios, financeiroSocioCriar, financeiroSocioAtualizar, financeiroSocioExcluir, financeiroSocioRestaurar
- **Regras:** (app/src/regras/)
  - `financeiro.ts`: A divisão de cada recebimento: quanto chega ao escritório, quanto fica com o responsável, quanto ele repassa e o que o escritório paga ao sócio que indicou.
  - `parcelas.ts`: As parcelas do contrato e o que acontece ao receber: quando nascem, como aparecem, os formulários e quem entra na divisão.
  - `recebimento.ts`: O recebimento completo (#266), sem tela e sem banco: as formas de pagamento, os bancos (com o código do Banco Central), o texto de cada pessoa para mandar…
- **Telas:** (app/src/paginas/) financeiro/APassar.tsx, financeiro/AbasDoFinanceiro.tsx, financeiro/CorrigirRecebimento.tsx, financeiro/Hub.tsx, financeiro/Parcelas.tsx, financeiro/Repasses.tsx
- **Rotas:** `/financeiro/direitos/`, `/financeiro/obrigacoes/`
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/correcao_de_recebimento.test.sql supabase/tests/corrigir_parcela_importada.test.sql supabase/tests/parcela_antiga_recebida.test.sql supabase/tests/quem_recebeu_marca.test.sql supabase/tests/rapidez_das_parcelas.test.sql supabase/tests/recebimento_completo.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/regras/financeiro.test.ts src/regras/parcelas.test.ts src/regras/recebimento.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/contrato-exclui-em-cascata.spec.ts e2e/financeiro.spec.ts e2e/lucros.spec.ts e2e/mais-no-titulo-das-secoes.spec.ts e2e/meus-valores.spec.ts e2e/parcelas.spec.ts e2e/topo-do-cartao.spec.ts`
- **Armadilhas:**
  - A divisão de cada recebimento (`regras/financeiro.ts`) foi confirmada pelo escritório com exemplos (`financeiro.test.ts`): mudar uma conta muda Meus valores e Lucros também.
  - O endereço antigo `/parcelas/` leva a Direitos (`regras/enderecosAntigos.ts`). Direitos e Obrigações são abas do Hub do Financeiro (`paginas/financeiro/Hub.tsx`, `paginas/financeiro/AbasDoFinanceiro.tsx`).
  - O excluir contrato em cascata vai a Obrigações e usa a tabela Repasses (`e2e/contrato-exclui-em-cascata.spec.ts`, já no comando abaixo).

<a id="lucros"></a>
## Lucro dos sócios

Quanto cada sócio acumulou, retirou e tem em aberto. As funções de dados ficam em `DadosFinanceiro` e `DadosParcelas`.

- **Tabelas:** `financeiro_retiradas` (financeiro_lucro); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261103000916_financeiro_lucro
- **Regras:** (app/src/regras/)
  - `lucro.ts`: O lucro dos sócios: quanto cada um acumulou, quanto já retirou e quanto está em aberto.
- **Telas:** (app/src/paginas/) Lucros.tsx
- **Rotas:** `/lucros/`
- **Testes unitários:** na pasta app, `npx vitest run src/regras/lucro.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/lucros.spec.ts`
- **Armadilhas:**
  - Só a retirada conta como pagamento do lucro: o repasse entre contas (da PJ para a PF) é transferência (`regras/lucro.ts`).

<a id="meus-valores"></a>
## Meus valores

A parte de cada pessoa em cada recebimento e os totais por papel (responsável, indicação). As funções de dados ficam em `DadosParcelas`.

- **Migrações:** (supabase/migrations/) 20261104000000_meus_valores
- **Regras:** (app/src/regras/)
  - `meusValores.ts`: "Meus valores": como aparece a parte de cada pessoa em cada recebimento, e os totais por papel.
- **Telas:** (app/src/paginas/) MeusValores.tsx
- **Rotas:** `/meus-valores/`
- **Testes unitários:** na pasta app, `npx vitest run src/paginas/MeusValores.test.tsx src/regras/meusValores.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/meus-valores.spec.ts`

<a id="conferencia"></a>
## Conferência dos lançamentos

A conferência dos lançamentos do caixa com a planilha antiga: situações, filtros, totais e a correção de cada linha. As funções de dados ficam em `DadosFinanceiro`.

- **Tabelas:** `financeiro_conferencia` (conferencia_de_lancamentos), `financeiro_conferencia_historico` (conferencia_de_lancamentos); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261104221303_conferencia_de_lancamentos
- **Regras:** (app/src/regras/)
  - `conferencia.ts`: A conferência dos lançamentos com o caixa: situações, filtros, totais e o que salvar quando alguém corrige uma linha.
- **Telas:** (app/src/paginas/) Conferencia.tsx
- **Rotas:** `/conferencia/`
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/conferencia_de_lancamentos.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/conferencia.test.ts src/paginas/Conferencia.test.tsx src/regras/conferencia.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/conferencia.spec.ts`

<a id="equipe"></a>
## Equipe, grupos e permissões

Os usuários do escritório: convites, papel (administrador), função (advogado, administrativo, estagiário), desativar, grupos da equipe, a fase de adaptação (equipe vê tudo)
e a equipe de cada item (as bolinhas no topo do cartão). O registro de ações, também nesta tela, está em Registro de ações e LGPD.

- **Tabelas:** `perfis` (base), `convites` (base), `grupos_da_equipe` (grupos_da_equipe), `grupo_integrantes` (grupos_da_equipe), `privado.mudancas_na_equipe` (aviso_ao_ser_incluido); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261024000001_base, 20261026000004_convite_seguro, 20261027000015_funcao_na_equipe, 20261103140000_trocar_email_pelo_administrador, 20261103150000_aviso_da_troca_de_email, 20261103162000_reforco_do_aviso_da_troca, 20261103170000_correcoes_do_aviso_da_troca, 20261103221220_desativar_encerra_as_sessoes, 20261103234100_reativar_tira_a_senha_de_uso, 20261104023116_conta_reservada, 20261107220956_equipe_nome, 20261109102349_equipe_ve_tudo, 20261109140344_fase_de_adaptacao, 20261110151651_excluir_usuario, 20261119193326_aviso_ao_ser_incluido, 20261119233811_grupos_da_equipe
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosEquipe`: equipeListar, conviteCriar, conviteNovoLink, equipeDefinirPapel, equipeDefinirFuncao, equipeDefinirNome, equipeDefinirAtivo, equipeTrocarEmail, equipeReservarConta, equipeExcluir, trocasDeEmailListar, convitesListar, conviteCancelar, auditoriaListar, exportacaoRegistrar, escritorioSalvar
  - `DadosGrupos`: grupoDaEquipeCriar, grupoDaEquipeRenomear, grupoDaEquipeIncluir, grupoDaEquipeTirar, grupoDaEquipeContarItens, grupoDaEquipeExcluir, contratoDefinirGrupos, itemDefinirGrupos
- **Regras:** (app/src/regras/)
  - `conviteDaPessoa.ts`: O lugar de uma pessoa do cadastro na equipe, visto do cartão dela (#327): já é da equipe (o cartão mostra, com o link para a Equipe), já tem convite, pode ser…
  - `equipe.ts`: Função de cada membro da equipe e o que ela permite no contrato (supabase/migrations/20261027000015_funcao_na_equipe.sql).
  - `equipeNoCartao.ts`: A equipe mudada no topo do cartão (#356): nas bolinhas, pôr e tirar participantes, trocar o responsável e (#388) tornar um participante responsável, sem abrir…
  - `equipeVeTudo.ts`: Por enquanto, os dados importados ainda não estão vinculados aos advogados: com a chave "equipe_ve_tudo" do escritório, toda a equipe vê tarefas, demandas,…
  - `gruposDaEquipe.ts`: Grupos da equipe (#378): regras puras de quem está num grupo, o que se mostra de cada grupo e o aviso antes de excluir.
  - `menuDaBolinha.ts`: O menu da bolinha da equipe no topo do cartão (#388, pedido do dono): o clique numa bolinha não tira mais ninguém na hora; abre um menu com o nome e o papel de…
- **Telas:** (app/src/paginas/) Equipe.css, Equipe.tsx, EquipeNoTopo.tsx, FaseDeAdaptacao.tsx, GrupoDaEquipe.tsx, GruposDaEquipe.tsx, UsuarioDaEquipe.tsx, equipeNoCartao.ts
- **Rotas:** `/equipe/`
- **Peças de ui:** (app/src/ui/) BuscaNaEquipe.tsx, EquipeDoCartao.tsx, EscolhaDaEquipe.tsx, GruposDoItem.tsx, filtroDeGrupo.ts
- **Servidor (funções do Supabase):** (supabase/functions/) _compartilhado/avisoDaTroca.ts, _compartilhado/reservaDeConta.ts, _compartilhado/trocaDeEmail.ts, equipe-reenviar-avisos/index.ts, equipe-reservar-conta/index.ts, equipe-trocar-email/index.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/conta_reservada.test.sql supabase/tests/desativar_encerra_sessoes.test.sql supabase/tests/equipe_nome.test.sql supabase/tests/equipe_ve_tudo.test.sql supabase/tests/excluir_usuario.test.sql supabase/tests/fase_de_adaptacao.test.sql supabase/tests/grupos_da_equipe.test.sql supabase/tests/reativar_tira_a_senha.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/EquipeNoTopo.test.tsx src/paginas/FaseDeAdaptacao.test.tsx src/paginas/GruposDaEquipe.test.tsx src/paginas/GruposNoTopo.test.tsx src/paginas/equipeNoCartao.test.ts src/regras/acessoPeloGrupo.test.ts src/regras/avisoDaTroca.test.ts src/regras/conviteDaPessoa.test.ts src/regras/equipe.test.ts src/regras/equipeNoCartao.test.ts src/regras/equipeVeTudo.test.ts src/regras/gruposDaEquipe.test.ts src/regras/menuDaBolinha.test.ts src/regras/reservaDeConta.test.ts src/regras/trocaDeEmail.test.ts src/ui/BuscaNaEquipe.test.tsx src/ui/EquipeDoCartao.test.tsx src/ui/EscolhaDaEquipe.test.tsx src/ui/GruposDoItem.test.tsx src/ui/filtroDeGrupo.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/convidar-pelo-cartao.spec.ts e2e/equipe-no-cartao.spec.ts e2e/equipe-ve-tudo.spec.ts e2e/equipe.spec.ts e2e/grupos-da-equipe.spec.ts`
- **Armadilhas:**
  - Função (advogado, administrativo, estagiário) é diferente de papel (administrador): quem não é administrador vê só o que criou ou em que foi posto.
  - Quem vê e altera cada item é decidido pelas regras RLS do banco; o fictício imita em `falso.ts`. Mudou uma regra de acesso: rode os testes do banco (`npx supabase test db`).
  - Regra que vale para quem executa ou para quem pede (como a aprovação da tarefa): decida e teste também o caso do administrador, que pela RLS altera tudo, e o de quem só altera o item.
  - Trocar o e-mail de alguém e reservar conta passam por funções do servidor (`equipe-trocar-email`, `equipe-reservar-conta`), testadas em `app/src/regras/*.test.ts`.

<a id="perfil"></a>
## Perfil profissional e foto

O perfil profissional de cada pessoa da equipe (a base das páginas da equipe no site do escritório) e a foto redonda do perfil.

- **Tabelas:** `perfil_profissional` (perfil_profissional); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261030140000_perfil_profissional, 20261030150000_foto_do_perfil
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosPerfilProfissional`: perfilProfissional, perfilProfissionalSalvar
  - `DadosFotos`: fotoDoPerfil, fotoSalvar, fotoRemover
- **Regras:** (app/src/regras/)
  - `foto.ts`: Regras da foto do perfil: o corte redondo (arrastar e aproximar, como foto de perfil de rede social) e o que vai ser gravado.
  - `perfilProfissional.ts`: Regras do perfil profissional (a base das páginas da equipe no site do escritório): o perfil vazio, a limpeza antes de gravar e a conferência de cada campo,…
- **Telas:** (app/src/paginas/) FotoDoPerfil.tsx, PerfilDaEquipe.tsx, PerfilProfissional.tsx
- **Rotas:** `/equipe/perfil/`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/PerfilProfissional.test.tsx src/regras/foto.test.ts src/regras/perfilProfissional.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/foto.spec.ts`
- **Armadilhas:**
  - O corte redondo e o que é gravado estão em `regras/foto.ts`; o conversor AVIF carrega o próprio .wasm (veja `optimizeDeps` em `vite.config.ts`).

<a id="configuracoes"></a>
## Configurações e escritório

As Configurações do escritório: os dados e a marca (nome, logomarca, CNPJ), os módulos ligados, o escritório novo e os donos da plataforma.
Os dados do escritório se gravam por `escritorioSalvar` (em `DadosEquipe`) e chegam às telas no contexto de quem entrou (`contexto`, em `DadosSessao`).

- **Tabelas:** `escritorios` (base), `plataforma_donos` (base); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261024000001_base, 20261027000008_identidade_escritorio, 20261027000009_contratos, 20261027000017_demandas, 20261027000020_tarefas, 20261031100000_cnpj_com_letras, 20261101155218_processos, 20261102135353_painel_de_processos, 20261102141258_compromissos, 20261103115248_dono_da_plataforma_ao_cadastrar, 20261113081038_escritorio_novo, 20261117143714_anotacoes
- **Telas:** (app/src/paginas/) Configuracoes.css, Configuracoes.tsx
- **Rotas:** `/configuracoes/`
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/escritorio_novo.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/paginas/Configuracoes.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/configuracoes.spec.ts e2e/marca-do-escritorio.spec.ts`
- **Armadilhas:**
  - O SEMPER é de vários escritórios: nada do primeiro escritório no código; nome e logomarca vêm das Configurações.
  - As partes das Configurações de outros assuntos estão nos assuntos deles: salas (Agenda), objetos (Objetos de contrato), funções dos participantes da tarefa (`FuncoesDosParticipantes`, Tarefas), conta Google (Conta Google e contatos) e fase de adaptação (Equipe). A função de cada pessoa da equipe (advogado, estagiário) é de Equipe.

<a id="registro"></a>
## Registro de ações e LGPD

O registro de ações (auditoria: quem criou, mudou ou apagou o quê), na tela Equipe, e o que a LGPD pede: registrar quem exportou dados e, ao excluir uma pessoa, apagar o nome dela do registro.

- **Tabelas:** `auditoria` (base); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261024000001_base, 20261026000005_exportacoes, 20261026000006_lgpd_exclusao, 20261031200000_importar_pessoas, 20261103140000_trocar_email_pelo_administrador, 20261104023116_conta_reservada
- **Regras:** (app/src/regras/)
  - `consentimentoSemData.ts`: O consentimento sem data (#409): antes da #405/#408, o cadastro podia salvar a base legal "consentimento" sem a data dele.
- **Telas:** (app/src/paginas/) Equipe.css, Equipe.tsx
- **Testes unitários:** na pasta app, `npx vitest run src/regras/consentimentoSemData.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/consentimento-sem-data.spec.ts e2e/equipe.spec.ts`
- **Armadilhas:**
  - O gatilho `privado.auditar` (em `20261024000001_base.sql`) já grava uma linha por linha criada, mudada ou apagada: tabela nova ganha o gatilho na migração dela. Numa ação em cascata, o resumo vai nessa mesma linha (não grave outra).
  - O texto de cada ação na tela: as tabelas `TABELAS` e `DETALHES` de `paginas/Equipe.tsx` (ex.: `detalheDaExclusaoDoContrato`, de `regras/exclusaoDoContrato.ts`).

<a id="mensagens"></a>
## Mensagens e avisos

A caixa de mensagens de cada pessoa: avisos ao ser incluído num item, ao ser mencionado e os pedidos para participar de um item.

- **Tabelas:** `mensagens` (mensagens), `mensagens_de_compromisso` (demandas_dos_compromissos), `mensagens_de_grupo` (grupos_da_equipe), `mensagens_de_inclusao` (aviso_ao_ser_incluido), `mensagens_de_participacao` (pedidos_de_participacao), `pedidos_de_participacao` (pedidos_de_participacao); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261108165559_mensagens, 20261109085738_avisos_de_prazo, 20261110022014_lembretes_dos_prazos, 20261118220000_pedidos_de_participacao, 20261119193326_aviso_ao_ser_incluido, 20261119233811_grupos_da_equipe, 20261123000750_demandas_dos_compromissos
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosMensagens`: mensagensListar, mensagensNaoLidas, mensagemMarcarLida, mensagensMarcarTodasLidas
  - `DadosPedidos`: itensParaPedir, participacaoPedir, participacaoCancelar, participacaoResponder
- **Regras:** (app/src/regras/)
  - `inclusao.ts`: Aviso na caixa de Mensagens para quem entra num item (#377): as palavras de cada módulo, os rótulos da linha e o papel de cada pessoa entre duas versões da…
  - `mensagens.ts`: Caixa de mensagens (#112): para onde cada mensagem leva e como ela aparece.
  - `pedidoDeParticipacao.ts`: Pedir para participar de um item de que ainda não faço parte (#363): as palavras de cada módulo, para onde cada mensagem leva, o que a linha da busca geral…
- **Telas:** (app/src/paginas/) Mensagens.css, Mensagens.tsx
- **Rotas:** `/mensagens/`
- **Peças de ui:** (app/src/ui/) mensagens.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/aviso_ao_ser_incluido.test.sql supabase/tests/mensagens.test.sql supabase/tests/pedidos_de_participacao.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/Mensagens.test.tsx src/regras/inclusao.test.ts src/regras/mensagens.test.ts src/regras/pedidoDeParticipacao.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/aviso-ao-ser-incluido.spec.ts e2e/mensagens.spec.ts e2e/pedir-para-participar.spec.ts`
- **Armadilhas:**
  - Quem recebe cada aviso é decidido no banco (gatilhos); as palavras de cada módulo ficam em `regras/inclusao.ts` e `regras/pedidoDeParticipacao.ts`.
  - Tipo de aviso novo = tabela `mensagens_de_<x>` (migração), entrada em `regras/mensagens.ts` e um `ItemDe<x>` em `paginas/Mensagens.tsx` (como `ItemDaDemandaDoCompromisso`, da Agenda).
  - O que uma rotina do banco cria sem ninguém logado não pode disparar o aviso ao ser incluído (veja [Rotinas automáticas](#rotinas)).

<a id="comentarios"></a>
## Comentários e menções

Os comentários dos cartões, com menções de pessoas (@) e de itens (!).

- **Tabelas:** `comentarios` (comentarios); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261027000016_comentarios, 20261027000017_demandas, 20261027000020_tarefas, 20261102141258_compromissos, 20261109102349_equipe_ve_tudo, 20261119010000_mencoes_sem_revelar, 20261119020000_comentarios_das_anotacoes, 20261119103649_andamentos_tipo_e_comentarios_de_processos, 20261119233811_grupos_da_equipe
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosComentarios`: comentariosListar, comentarioCriar, comentarioEditar, comentarioExcluir, itensMencionados
- **Regras:** (app/src/regras/)
  - `comentarios.ts`: Comentários dos cartões: as menções de pessoas da equipe, com @ (achar no texto, a lista do @ enquanto se digita e quem pode ser mencionado em cada módulo), e…
- **Peças de ui:** (app/src/ui/) Comentarios.tsx, ComoComentario.tsx, TextoComMencoes.tsx, mencoesDeItens.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/mencoes_sem_revelar.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/regras/comentarios.test.ts src/ui/Comentarios.test.tsx src/ui/ComoComentario.test.tsx src/ui/TextoComMencoes.test.tsx src/ui/mencoesDeItens.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/comentarios.spec.ts e2e/mencoes-de-itens.spec.ts`
- **Armadilhas:**
  - Módulo novo com comentários: entra no tipo `ModuloComentado` (`dados/tipos.ts`) e numa migração que o acrescente à tabela `comentarios`; a menção de um item que a pessoa não vê não revela o nome dele.

<a id="etiquetas"></a>
## Etiquetas

As etiquetas coloridas do escritório, as mesmas em todos os módulos, com o filtro das páginas de módulo.

- **Tabelas:** `etiquetas` (etiquetas); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261101131705_etiquetas, 20261101141419_etiquetas_do_sistema
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosEtiquetas`: etiquetasListar, etiquetaCriar, etiquetaAtualizar, etiquetaExcluir, etiquetasDoCartao, etiquetaAplicar, etiquetaTirar, etiquetaAplicarEmLote, etiquetaTirarEmLote
- **Regras:** (app/src/regras/)
  - `etiquetas.ts`: Etiquetas do escritório: a paleta fixa, o texto opcional e o que não pode repetir.
- **Peças de ui:** (app/src/ui/) Etiquetas.tsx, etiquetasDoEscritorio.ts
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/regras/etiquetas.test.ts src/ui/Etiquetas.test.tsx src/ui/etiquetasDoEscritorio.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/etiquetas.spec.ts`
- **Armadilhas:**
  - Cada módulo tem a sua tabela de ligação (`pessoa_etiquetas`, `processo_etiquetas`…): módulo novo = uma linha nova numa migração nova.

<a id="ligacoes"></a>
## Ligações entre itens

Ligar um item a outro que já existe, criar no cartão um item já ligado (o "+ Novo…" das seções) e como as ligações aparecem no quadro.

- **Migrações:** (supabase/migrations/) 20261111095627_ligar_processo_existente
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosParaLigar`: demandasParaLigar, tarefasParaLigar, compromissosParaLigar, processosParaPorCliente, contratosParaLigar
- **Regras:** (app/src/regras/)
  - `ligacoesDoItem.ts`: As ligações de um item com os outros (a demanda e o contrato de uma tarefa, o contrato de uma demanda...), como aparecem fora do cartão (#300): no quadro, um…
  - `ligarExistente.ts`: Ligar, no cartão de um item, outro que já existe (#341, etapa 2): as regras das ligações, puras.
  - `nascerLigado.ts`: O item que nasce no cartão de outro (#376): o "+ Novo …" de uma seção abre o cadastro com a origem no endereço (?tarefa=, ?demanda=, ?processo=, ?anotacao=), o…
  - `origemDoCadastro.ts`: O cadastro aberto pelo "+ Novo …" de um cartão (#376): de que cartão ele veio (o parâmetro do endereço, como ?contrato=), o que o cartão de origem já traz…
- **Telas:** (app/src/paginas/) CartoesLigados.tsx, PessoasNosItens.tsx, ligarNoCartao.ts
- **Peças de ui:** (app/src/ui/) ItensLigados.tsx, LigadosNoCadastro.tsx, LigarDoModulo.tsx, LigarExistente.tsx, LigarItem.tsx, LigarProcesso.tsx
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/ligar_processo_existente.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/PessoasNosItens.test.tsx src/paginas/ligarNoCartao.test.ts src/regras/ligacoesDoItem.test.ts src/regras/ligarExistente.test.ts src/regras/nascerLigado.test.ts src/regras/origemDoCadastro.test.ts src/ui/ItensLigados.test.tsx src/ui/LigadosNoCadastro.test.tsx src/ui/LigarDoModulo.test.tsx src/ui/LigarExistente.test.tsx src/ui/LigarItem.test.tsx src/ui/LigarProcesso.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/criar-processo-e-tarefa-ligados.spec.ts e2e/ligar-existente.spec.ts e2e/nascer-ligado-demanda-contrato.spec.ts e2e/novo-padrao-das-secoes.spec.ts e2e/tarefa-em-varias-ligacoes.spec.ts`
- **Armadilhas:**
  - A tela lê a lista gravada no item logo antes de gravar (para não apagar a ligação de outra pessoa): siga o mesmo jeito ao ligar um módulo novo.
  - Ligar ou desligar uma tarefa de demanda mexe na demanda contínua (desfazer devolve a tarefa a ela): veja [Demandas](#demandas).

<a id="quadros"></a>
## Quadros (kanban) e situação

O quadro kanban comum a todos os módulos: colunas, grupos de colunas, colunas-marco e padrão, arquivados, a Situação do cartão e o concluir pelo círculo.
Peça comum: mexer aqui muda todos os módulos.

- **Tabelas:** `quadro_colunas` (base), `quadro_colunas_ocultas` (base), `quadro_grupos` (grupos_de_colunas), `quadro_sugestoes` (base); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261024000001_base, 20261027000014_colunas_marco, 20261101121647_grupos_de_colunas, 20261101155218_processos, 20261108000016_cliente_ao_contrato, 20261109180534_leitura_rapida_dos_quadros, 20261113141500_grupos_entre_colunas, 20261122130109_processo_partes_recursos_e_tipos, 20261123013306_tarefa_aprovacao
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosQuadros`: colunasListar, sugestoesListar, colunaCriar, colunaAgrupar, gruposListar, grupoCriar, grupoAtualizar, grupoExcluir, colunaOcultar, colunaRenomear, colunaOrdenar, colunaExcluir
- **Regras:** (app/src/regras/)
  - `colunasPadrao.ts`: Colunas padrão que chegam depois (#314, #315): o escritório novo nasce com elas, e o que já existe as ganha uma vez, sem mexer nos itens nem nas colunas que…
  - `conclusaoNoCartao.ts`: Concluir e Reabrir no cartão (#397): o botão redondo ✓ ao lado da Situação, só nos módulos que concluem (a tarefa e a demanda).
  - `ligacoesDoItem.ts`: As ligações de um item com os outros (a demanda e o contrato de uma tarefa, o contrato de uma demanda...), como aparecem fora do cartão (#300): no quadro, um…
  - `quadro.ts`: Colunas-marco dos quadros: o código fixo de cada uma diz ao sistema qual ponto do fluxo ela marca, mesmo que a coluna seja renomeada.
- **Telas:** (app/src/paginas/) situacaoDoItem.tsx
- **Peças de ui:** (app/src/ui/) SecaoArquivados.tsx, quadro/ConcluirNaMiniatura.tsx, quadro/ConcluirNaSituacao.tsx, quadro/Kanban.tsx, quadro/LigacoesNoQuadro.tsx, quadro/MenuDeSituacao.tsx, quadro/SituacaoDoCartao.tsx, quadro/arquivo.ts, quadro/colunaInicial.ts, quadro/moverNoQuadro.ts, quadro/posicao.ts, quadro/useColunas.tsx, quadro/useMaisNosLados.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/grupos_entre_colunas.test.sql supabase/tests/leitura_rapida_dos_quadros.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/situacaoDoItem.test.tsx src/regras/colunasPadrao.test.ts src/regras/conclusaoNoCartao.test.ts src/regras/ligacoesDoItem.test.ts src/regras/quadro.test.ts src/ui/SecaoArquivados.test.tsx src/ui/quadro/ConcluirNaMiniatura.test.tsx src/ui/quadro/ConcluirNaSituacao.test.tsx src/ui/quadro/Kanban.test.tsx src/ui/quadro/LigacoesNoQuadro.test.tsx src/ui/quadro/MenuDeSituacao.test.tsx src/ui/quadro/SituacaoDoCartao.test.tsx src/ui/quadro/posicao.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/arquivados.spec.ts e2e/colunas-fora-da-tela.spec.ts e2e/colunas-padrao.spec.ts e2e/concluir-na-miniatura.spec.ts e2e/grupos-colunas.spec.ts e2e/grupos-entre-colunas.spec.ts e2e/ligacoes-no-quadro.spec.ts e2e/nome-da-coluna-inteiro.spec.ts e2e/nomes-em-maiusculas.spec.ts e2e/quadro.spec.ts`
- **Armadilhas:**
  - As colunas-marco têm código fixo (`regras/quadro.ts`): o sistema as acha pelo código, mesmo renomeadas. Coluna padrão nova chega por `regras/colunasPadrao.ts` e migração.
  - Colunas novas num quadro que já existe: o escritório pode ter renomeado colunas e grupos, deixado um grupo vazio ou não ter grupos; ache pelo código fixo e siga `planoDasColunasNovas` (`regras/colunasPadrao.ts`), como `COLUNAS_NOVAS_DOS_PROCESSOS` (#315).
  - Não crie marco novo para uma coluna reconhecida: a versão anterior do site não conhece o marco. Use uma bandeira, como `de_aprovacao` (a decisão está em `regras/quadro.ts`).
  - A seção Arquivados (`ui/SecaoArquivados.tsx`, com a pergunta própria de cada módulo em `perguntarAntesDeExcluir`) é de todos os módulos: depois de mexer, rode a bateria completa de telas.
  - Mudou `Kanban`, `useColunas` ou `PaginaModulo`: rode a bateria completa de telas, não só a deste assunto.

<a id="cartao"></a>
## Cartão dos itens

O cartão (painel) de cada item: o topo, a cabeça, as seções que recolhem, o "Acrescentar ao cartão", as datas e a edição no lugar, o histórico e sair do cartão.
Peça comum: mexer aqui muda os cartões de todos os módulos.

- **Migrações:** (supabase/migrations/) 20261109144041_sair_do_cartao
- **Regras:** (app/src/regras/)
  - `atalhosDoCartao.ts`: O menu "Acrescentar ao cartão" (#399, que substituiu a linha de botões rápidos da #351): uma bolinha só, no topo do cartão, que abre um menu com cada coisa que…
  - `datasNoCartao.ts`: As datas e o tempo lado a lado no cartão (#361): o prazo (com a hora e o lembrete) de tarefas e demandas e a data e o horário do compromisso mudam ali mesmo,…
  - `edicaoNoLugar.ts`: O título e a descrição dos cartões mudados no próprio lugar (#346), no jeito da anotação (#339): quem altera o cartão clica no título ou na descrição e muda…
  - `edicaoUnica.ts`: Uma edição aberta de cada vez (#395): na faixa das datas do cartão (o início, o prazo, a data do compromisso, a assinatura) e nos prazos do processo, só um…
  - `sairDoCartao.ts`: Sair de um cartão: tarefa, demanda, processo ou compromisso (#276).
  - `secoes.ts`: Contas das seções dos cartões (o número ao lado do título de cada seção que recolhe).
  - `topoDoCartao.ts`: O que o topo dos cartões de item diz, por módulo (#382): o nome do menu ⋯ para o leitor de tela, como a janela de excluir chama o item e a faixa do item…
- **Telas:** (app/src/paginas/) HistoricoDoCartao.tsx
- **Peças de ui:** (app/src/ui/) AcoesDoCartao.tsx, AcrescentarAoCartao.tsx, CabecaDoCartao.tsx, EdicaoNoLugar.tsx, TopoDoCartao.tsx, registroDeAtalhos.tsx, sairDoCartao.ts, useEdicaoUnica.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/sair_do_cartao.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/regras/atalhosDoCartao.test.ts src/regras/datasNoCartao.test.ts src/regras/edicaoNoLugar.test.ts src/regras/edicaoUnica.test.ts src/regras/sairDoCartao.test.ts src/regras/secoes.test.ts src/regras/topoDoCartao.test.ts src/ui/AcoesDoCartao.test.tsx src/ui/AcrescentarAoCartao.test.tsx src/ui/CabecaDoCartao.test.tsx src/ui/EdicaoNoLugar.test.tsx src/ui/TopoDoCartao.test.tsx src/ui/sairDoCartao.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/arrumacao-do-cartao.spec.ts e2e/atalhos-do-cartao.spec.ts e2e/cartao.spec.ts e2e/coluna-do-cartao.spec.ts e2e/datas-nos-cartoes.spec.ts e2e/datas.spec.ts e2e/eixo-dos-botoes-do-cartao.spec.ts e2e/novo-padrao-das-secoes.spec.ts e2e/situacao-e-expandir-tudo.spec.ts e2e/topo-do-cartao.spec.ts`
- **Armadilhas:**
  - Toda seção de itens ligados mostra a contagem ao lado do título, mesmo recolhida (`regras/secoes.ts`, `ui/useQuantos.ts`).

<a id="busca-geral"></a>
## Busca geral

A janela que busca em todos os módulos de uma vez (Ctrl+K ou o botão "Buscar" do menu).

- **Regras:** (app/src/regras/)
  - `buscaGeral.ts`: Regras da busca geral (#321): a janela que busca em todos os módulos de uma vez (Ctrl+K ou o botão "Buscar" do menu).
- **Peças de ui:** (app/src/ui/) BuscaGeral.css, BuscaGeral.tsx, fontesDaBuscaGeral.ts
- **Testes unitários:** na pasta app, `npx vitest run src/regras/buscaGeral.test.ts src/ui/BuscaGeral.test.tsx src/ui/fontesDaBuscaGeral.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/busca-geral.spec.ts`
- **Armadilhas:**
  - Módulo novo, ou tipo novo de um módulo (como um tipo de processo), entra na busca por uma fonte em `ui/fontesDaBuscaGeral.ts`, um grupo em `regras/buscaGeral.ts` e o ícone do grupo (`ICONE_DO_GRUPO`, em `ui/BuscaGeral.tsx`); tipo que sai, tire dos três.

<a id="painel-inicial"></a>
## Painel inicial

O Início: os números do dia, os gráficos e as listas (prazos, agenda, tarefas, demandas, processos, anotações, parcelas, pessoas).

- **Regras:** (app/src/regras/)
  - `graficosDoInicio.ts`: As contas dos números e dos gráficos do painel do Início (#402).
  - `painelInicial.ts`: O painel da página inicial (#319): os blocos (o que cada um mostra, quando aparece e para onde leva o "Ver todos"), os prazos de hoje, da semana e os vencidos,…
- **Telas:** (app/src/paginas/) Inicio.css, Inicio.tsx, inicio/AvisoDoConsentimento.tsx, inicio/Blocos.tsx, inicio/GraficosDoInicio.tsx, inicio/fontes.ts
- **Rotas:** `/inicio/`
- **Testes unitários:** na pasta app, `npx vitest run src/paginas/Inicio.test.tsx src/regras/graficosDoInicio.test.ts src/regras/painelInicial.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/painel-inicial.spec.ts`
- **Armadilhas:**
  - O painel lê de quase todos os módulos: mudar o formato de uma lista de dados pode quebrar um bloco daqui (`paginas/inicio/fontes.ts`).

<a id="conta"></a>
## Entrada e minha conta

A tela de entrada (login, primeiro acesso por convite, nova senha), a verificação em duas etapas, a troca do e-mail de acesso, sair e a sessão encerrada em outro lugar.

- **Migrações:** (supabase/migrations/) 20261026000007_duas_etapas, 20261103213217_sessao_encerrada_corta_o_acesso, 20261120231028_excluir_conta
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosSessao`: sessao, entrar, primeiroAcesso, recuperarSenha, confirmarLink, contaEmail, trocarEmail, novaSenha, sair, sessaoEncerrada, aoMudarSessao, contexto, salvarPerfil, salvarPreferencia
  - `DadosDuasEtapas`: duasEtapasFatores, duasEtapasIniciar, duasEtapasConfirmar, duasEtapasDesativar, duasEtapasPendente, duasEtapasEntrar
- **Regras:** (app/src/regras/)
  - `conta.ts`: O e-mail de acesso de quem entrou: a regra do pedido de troca.
- **Telas:** (app/src/paginas/) Entrada.css, Entrada.tsx, MinhaConta.tsx
- **Rotas:** `/entrar/`, `/minha-conta/`
- **Peças de ui:** (app/src/ui/) vigiaDaSessao.ts
- **Servidor (funções do Supabase):** (supabase/functions/) _compartilhado/avisoDaTroca.ts, _compartilhado/trocaDeEmail.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/excluir_conta.test.sql supabase/tests/sessao_encerrada.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/paginas/Entrada.test.tsx src/regras/avisoDaTroca.test.ts src/regras/conta.test.ts src/regras/trocaDeEmail.test.ts src/ui/vigiaDaSessao.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/entrada-paineis.spec.ts e2e/entrada.spec.ts e2e/perfil.spec.ts`
- **Armadilhas:**
  - A tela de entrada é sempre clara, qualquer que seja o tema. Os e-mails de prazo de Minha conta estão em [Prazos, lembretes e e-mails de prazo](#lembretes).

<a id="portal"></a>
## Página pública

A página pública do SEMPER (rota "/"): a apresentação a outros escritórios e o pedido de demonstração.

- **Regras:** (app/src/regras/)
  - `paginaPublica.ts`: Regras da página pública (semper.app.br, rota "/"): quem vai direto para a entrada e como o pedido de demonstração vira uma conversa (e-mail ou WhatsApp).
- **Telas:** (app/src/paginas/) Home.css, Home.tsx
- **Rotas:** `/`
- **Testes unitários:** na pasta app, `npx vitest run src/regras/paginaPublica.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/pagina-publica.spec.ts`
- **Armadilhas:**
  - As imagens da página são telas reais do banco fictício: só dados inventados.

<a id="importacao"></a>
## Importação

Importar pessoas de um arquivo CSV (Pessoas > ⋯ > Importar pessoas) e a ferramenta que converte a planilha antiga do site para o SEMPER.

- **Tabelas:** `importacoes` (importar_pessoas); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261031200000_importar_pessoas
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosImportacao`: pessoasParaImportar, importacaoIniciar, pessoasImportar, importacaoConcluir
- **Regras:** (app/src/regras/)
  - `importacao.ts`: Importar pessoas de um arquivo CSV no modelo do SEMPER (Pessoas > ⋯ > Importar pessoas).
- **Telas:** (app/src/paginas/) ImportarPessoas.css, ImportarPessoas.tsx, importarPessoas/TabelaConferencia.tsx, importarPessoas/contexto.ts, importarPessoas/etapas.tsx, importarPessoas/textos.ts
- **Rotas:** `/pessoas/importar/`
- **Peças de ui:** (app/src/ui/) gravacaoDaImportacao.ts
- **Outros:** (app/) ferramentas/planilha-do-site/converter.ts, ferramentas/planilha-do-site/decisoes.ts, ferramentas/planilha-do-site/ficticios.ts, ferramentas/planilha-do-site/ler.ts, ferramentas/planilha-do-site/limpar.ts, ferramentas/planilha-do-site/nomes.ts, ferramentas/planilha-do-site/paraSemper.ts, ferramentas/planilha-do-site/planilhas.ts, ferramentas/planilha-do-site/referencia.ts, ferramentas/planilha-do-site/telefones.ts
- **Testes unitários:** na pasta app, `npx vitest run ferramentas/planilha-do-site/converter.test.ts ferramentas/planilha-do-site/decisoes.test.ts ferramentas/planilha-do-site/limpar.test.ts ferramentas/planilha-do-site/nomes.test.ts ferramentas/planilha-do-site/paraSemper.test.ts ferramentas/planilha-do-site/planilhas.test.ts ferramentas/planilha-do-site/telefones.test.ts src/dados/contrato.test.ts src/paginas/ImportarPessoas.test.tsx src/regras/importacao.test.ts src/ui/gravacaoDaImportacao.test.ts`
- **Testes de tela:** na pasta app, `npx playwright test e2e/importacao.spec.ts`
- **Armadilhas:**
  - Nunca dado real de cliente no repositório: os testes da planilha usam só nomes fictícios (`planilha-do-site/ficticios.ts`).

<a id="google"></a>
## Conta Google e contatos

A ligação da conta Google do escritório (em Configurações) e a sincronização das pessoas com o Google Contatos, com a lista "Para conferir".

- **Tabelas:** `contatos_google` (contatos_google), `contatos_google_conferir` (contatos_google_primeira), `contatos_google_fila` (contatos_google), `privado.ligacoes` (ligacao_google), `privado.ligacao_pedidos` (ligacao_google); entre parênteses, a migração que a cria
- **Migrações:** (supabase/migrations/) 20261031120000_ligacao_google, 20261120205439_contatos_google, 20261120213407_contatos_google_primeira
- **Funções de dados:** o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts
  - `DadosLigacoes`: ligacaoGoogle, ligacaoGoogleIniciar, ligacaoGoogleConcluir, ligacaoGoogleDesligar, sincronizacaoGoogle, sincronizacaoGoogleLigar, sincronizarGoogleAgora, contatosParaConferir, contatoParaConferirDecidir
- **Regras:** (app/src/regras/)
  - `contatosGoogle.ts`: Pessoas no formato do Google Contatos: o mesmo CSV que o Google exporta e aceita em "Importar".
  - `sincronizacaoGoogle.ts`: Os textos da sincronização das pessoas com o Google Contatos (#164), em Configurações: a situação da fila, o problema que a impede (com o que fazer) e o…
- **Telas:** (app/src/paginas/) ContatosParaConferir.tsx, LigacaoGoogle.tsx, SincronizacaoDosContatos.tsx
- **Servidor (funções do Supabase):** (supabase/functions/) _compartilhado/contatosGoogle.ts, _compartilhado/correspondenciaDeContatos.ts, _compartilhado/ligacao.ts, google-concluir/index.ts, google-conectar/index.ts, google-desligar/index.ts, google-retorno/index.ts, google-sincronizar/index.ts
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/contatos_google.test.sql supabase/tests/contatos_google_primeira.test.sql`
- **Testes unitários:** na pasta app, `npx vitest run src/dados/contrato.test.ts src/regras/contatosGoogle.test.ts src/regras/correspondenciaDeContatos.test.ts src/regras/ligacaoGoogle.test.ts src/regras/sincronizacaoDeContatos.test.ts src/regras/sincronizacaoGoogle.test.ts`
- **Armadilhas:**
  - As regras de quem é cada contato ficam no servidor (`supabase/functions/_compartilhado/correspondenciaDeContatos.ts`); os testes, em `app/src/regras/`.

<a id="novidades"></a>
## Novidades e versão

As novidades de cada versão (o botão do menu lateral) e o aviso de versão nova para a aba aberta antes de uma publicação.

- **Regras:** (app/src/regras/)
  - `novidades.ts`: Novidades de cada versão do SEMPER (#353): o que mudou para quem usa, em português simples, e onde achar.
  - `versao.ts`: Versão do SEMPER: a da aba aberta (embutida no código ao compilar) e a que está no ar (o /versao.txt que a rotina "Publicar o SEMPER" grava, ex.: "v1.9.0…
- **Peças de ui:** (app/src/ui/) Novidades.tsx, versaoNova.tsx
- **Testes unitários:** na pasta app, `npx vitest run src/regras/novidades.test.ts src/regras/versao.test.ts src/ui/Novidades.test.tsx src/ui/versaoNova.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/novidades.spec.ts`
- **Armadilhas:**
  - Cada novidade é um JSON em `app/novidades/proxima/` (titulo, texto, ondeAchar); o número e a data da versão entram sozinhos ao publicar.

<a id="ajuda"></a>
## Ajuda e atalhos

A ajuda de cada tela de módulo (o botão "?") e os atalhos de teclado ("/" busca, "N" novo, "?" ajuda).

- **Regras:** (app/src/regras/)
  - `ajuda.ts`: A ajuda de cada tela de módulo (#85): o botão "?" do cabeçalho (e a tecla "?") abre uma janela com estas frases em cima e os atalhos de teclado embaixo.
  - `atalhos.ts`: Atalhos de teclado das páginas de módulo (#86).
- **Peças de ui:** (app/src/ui/) atalhos.tsx
- **Testes unitários:** na pasta app, `npx vitest run src/regras/ajuda.test.ts src/regras/atalhos.test.ts src/ui/atalhos.test.tsx`
- **Testes de tela:** na pasta app, `npx playwright test e2e/ajuda.spec.ts e2e/atalhos.spec.ts`
- **Armadilhas:**
  - Módulo novo com página de módulo, ou tipo novo com quadro próprio (como um tipo de processo), ganha os textos de ajuda em `regras/ajuda.ts`; tipo que sai, tire de lá.

<a id="rotinas"></a>
## Rotinas automáticas

O que o banco faz sozinho, de tempos em tempos (pg_cron): avisos e lembretes de prazo, e-mails de prazo, datas e demandas dos compromissos que se repetem,
contatos do Google e o reenvio do aviso da troca de e-mail. Toda migração com `cron.schedule` entra aqui sozinha.

- **Migrações:** (supabase/migrations/) 20261103162000_reforco_do_aviso_da_troca, 20261109085738_avisos_de_prazo, 20261110022014_lembretes_dos_prazos, 20261120205439_contatos_google, 20261122232804_compromissos_que_se_repetem, 20261123000750_demandas_dos_compromissos
- **Testes do banco:** na raiz do projeto, com o Docker ligado e o banco local de pé (`npx supabase db start`), `npx supabase test db supabase/tests/avisos_de_prazo.test.sql supabase/tests/compromissos_que_se_repetem.test.sql supabase/tests/contatos_google.test.sql supabase/tests/demandas_dos_compromissos.test.sql supabase/tests/lembretes_dos_prazos.test.sql`
- **Armadilhas:**
  - A rotina roda sem ninguém logado (`auth.uid()` nulo): o teste do banco limpa o login antes de chamá-la, e o que ela cria não pode disparar os gatilhos de aviso ao ser incluído.
  - A rotina chama uma função `privado.…` da mesma migração: mudou a regra, mude a função (numa migração nova) e o caso do teste do banco.

<a id="rotas"></a>
## Rotas e endereços

Cada endereço do app (`app/src/App.tsx`), a tela que abre, o assunto e quem escreve o endereço. Endereço que sai ou muda: mude
todos os que o escrevem, rode os testes de cada um e ponha o antigo em `regras/enderecosAntigos.ts`, para os links antigos valerem.

- `/agenda/` (Compromissos): [Agenda e compromissos](#agenda)
  - escrevem o endereço: (app/) src/paginas/CompromissosLigados.tsx, src/paginas/Inicio.test.tsx, src/paginas/ItensDoCompromisso.test.tsx, src/paginas/NovoCompromisso.tsx, src/paginas/nascerNaAnotacao.test.tsx, src/regras/anotacao.test.ts, src/regras/anotacao.ts, src/regras/buscaGeral.test.ts, src/regras/buscaGeral.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/nascerLigado.test.ts, src/regras/origemDaPessoa.test.ts, src/regras/origemDoCadastro.test.ts, src/regras/painelInicial.test.ts, src/regras/painelInicial.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/pedidoDeParticipacao.ts, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/arrumacao-do-cartao.spec.ts e2e/atalhos-do-cartao.spec.ts e2e/aviso-ao-ser-incluido.spec.ts e2e/compromissos-ligados.spec.ts e2e/compromissos-que-se-repetem.spec.ts e2e/compromissos.spec.ts e2e/datas-nos-cartoes.spec.ts e2e/datas.spec.ts e2e/demanda-do-compromisso.spec.ts e2e/equipe-no-cartao.spec.ts e2e/lembretes.spec.ts e2e/ligar-existente.spec.ts e2e/ligar-processo.spec.ts e2e/menu-lateral.spec.ts e2e/nova-pessoa-no-cartao.spec.ts e2e/salas.spec.ts e2e/situacao-e-expandir-tudo.spec.ts e2e/topo-do-cartao.spec.ts`
- `/agenda/novo/` (FormularioCompromisso): [Agenda e compromissos](#agenda)
  - escrevem o endereço: (app/) src/paginas/CartaoPessoa.tsx, src/paginas/CartaoProcesso.tsx, src/paginas/Compromissos.tsx, src/paginas/CompromissosDoItem.tsx, src/paginas/Inicio.test.tsx, src/paginas/Inicio.tsx, src/paginas/ItensDoCompromisso.test.tsx, src/paginas/NovoCompromisso.tsx, src/regras/novoNaAnotacao.test.ts, src/regras/novoNaAnotacao.ts, src/regras/origemDoCadastro.test.ts, src/regras/origemDoCadastro.ts, src/ui/Casca.tsx, src/ui/MaisDoMenu.test.tsx, src/ui/SubmenuLateral.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/compromissos-ligados.spec.ts e2e/compromissos-que-se-repetem.spec.ts e2e/compromissos.spec.ts e2e/datas.spec.ts e2e/demanda-do-compromisso.spec.ts e2e/sair-do-cadastro.spec.ts e2e/salas.spec.ts`
- `/calendario/` (Calendario): [Calendário e prazos](#calendario)
  - escrevem o endereço: (app/) src/ui/Casca.tsx, src/ui/SubmenuLateral.test.tsx, src/ui/SubmenuLateral.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/calendario.spec.ts`
- `/conferencia/` (Conferencia): [Conferência dos lançamentos](#conferencia)
  - escrevem o endereço: (app/) e2e/ajudantes.ts, src/paginas/Conferencia.test.tsx, src/paginas/financeiro/Hub.tsx, src/regras/enderecosAntigos.test.ts
- `/configuracoes/` (Configuracoes): [Configurações e escritório](#configuracoes)
  - escrevem o endereço: (app/) src/paginas/Configuracoes.test.tsx, src/paginas/LigacaoGoogle.tsx, src/regras/ligacaoGoogle.test.ts, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/configuracoes.spec.ts e2e/equipe-ve-tudo.spec.ts e2e/objetos-de-contrato.spec.ts e2e/processos.spec.ts e2e/salas.spec.ts e2e/tarefa-pedido.spec.ts e2e/tarefas.spec.ts`
- `/contratos/` (Contratos): [Contratos](#contratos)
  - escrevem o endereço: (app/) src/paginas/CartaoDemanda.tsx, src/paginas/CartaoPessoa.tsx, src/paginas/CartaoTarefa.tsx, src/paginas/ContratosDoProcesso.tsx, src/paginas/Inicio.test.tsx, src/paginas/ModelosDeLista.tsx, src/paginas/NovoContrato.tsx, src/paginas/NovoContratoPelaOrigem.test.tsx, src/paginas/clienteAoContrato.ts, src/paginas/financeiro/DetalheFinanceiro.tsx, src/paginas/financeiro/Parcelas.tsx, src/paginas/nascerNaAnotacao.test.tsx, src/regras/anotacao.ts, src/regras/buscaGeral.test.ts, src/regras/buscaGeral.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/nascerLigado.test.ts, src/regras/origemDoCadastro.test.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/pedidoDeParticipacao.ts, src/ui/Casca.tsx, src/ui/ItensLigados.test.tsx, src/ui/useCartaoNaUrl.test.tsx
  - 26 testes de tela vão direto a ele: rode a bateria completa (`npm run testar-telas`).
- `/contratos/novo/` (FormularioContrato): [Contratos](#contratos)
  - escrevem o endereço: (app/) src/paginas/CartaoDemanda.tsx, src/paginas/CartaoPessoa.tsx, src/paginas/CartaoProcesso.tsx, src/paginas/Contratos.tsx, src/paginas/NovoContratoPelaOrigem.test.tsx, src/regras/novoNaAnotacao.test.ts, src/regras/novoNaAnotacao.ts, src/regras/origemDoCadastro.test.ts, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/contratos.spec.ts e2e/sair-do-cadastro.spec.ts`
- `/demandas/` (Demandas): [Demandas](#demandas)
  - escrevem o endereço: (app/) src/paginas/CartaoContrato.tsx, src/paginas/CartaoTarefa.tsx, src/paginas/CartoesLigados.tsx, src/paginas/DemandasRelacionadas.test.tsx, src/paginas/DemandasRelacionadas.tsx, src/paginas/Inicio.test.tsx, src/paginas/ItensDoCompromisso.test.tsx, src/paginas/Mensagens.test.tsx, src/paginas/ModelosDeLista.tsx, src/paginas/NovaDemanda.test.tsx, src/paginas/NovaDemanda.tsx, src/paginas/NovaDemandaPelaOrigem.test.tsx, src/paginas/NovoContratoPelaOrigem.test.tsx, src/paginas/inicio/Blocos.tsx, src/paginas/nascerNaAnotacao.test.tsx, src/regras/agenda.ts, src/regras/anotacao.test.ts, src/regras/anotacao.ts, src/regras/buscaGeral.ts, src/regras/demandaDoCompromisso.test.ts, src/regras/demandaDoCompromisso.ts, src/regras/gruposDaEquipe.test.ts, src/regras/gruposDaEquipe.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/nascerLigado.test.ts, src/regras/origemDaPessoa.test.ts, src/regras/origemDoCadastro.test.ts, src/regras/origemDoCadastro.ts, src/regras/painelInicial.test.ts, src/regras/painelInicial.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/pedidoDeParticipacao.ts, src/ui/Casca.tsx, src/ui/Comentarios.test.tsx, src/ui/TextoComMencoes.test.tsx, src/ui/base/base.test.tsx
  - 29 testes de tela vão direto a ele: rode a bateria completa (`npm run testar-telas`).
- `/demandas/nova/` (FormularioDemanda): [Demandas](#demandas)
  - escrevem o endereço: (app/) src/paginas/CartaoContrato.tsx, src/paginas/CartaoPessoa.tsx, src/paginas/CartaoProcesso.tsx, src/paginas/CartaoTarefa.tsx, src/paginas/Demandas.tsx, src/paginas/NovaDemanda.test.tsx, src/paginas/NovaDemandaPelaOrigem.test.tsx, src/regras/novoNaAnotacao.test.ts, src/regras/novoNaAnotacao.ts, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/demandas.spec.ts e2e/lembretes.spec.ts e2e/nascer-ligado-demanda-contrato.spec.ts e2e/processos.spec.ts e2e/sair-do-cadastro.spec.ts`
- `/documentos/` (Documentos): [Documentos e anotações](#documentos)
  - escrevem o endereço: (app/) src/paginas/AnotacoesDoCartao.test.tsx, src/paginas/AnotacoesDoCartao.tsx, src/paginas/CartaoAnotacao.tsx, src/paginas/Documentos.tsx, src/paginas/nascerNaAnotacao.test.tsx, src/regras/anotacao.test.ts, src/regras/anotacao.ts, src/regras/buscaGeral.test.ts, src/regras/buscaGeral.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/nascerLigado.test.ts, src/regras/origemDaPessoa.test.ts, src/regras/painelInicial.ts, src/regras/pastas.test.ts, src/regras/pastas.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/pedidoDeParticipacao.ts, src/ui/Casca.tsx, src/ui/Pastas.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/documentos.spec.ts e2e/novo-na-anotacao.spec.ts`
- `/entrar/` (Entrada): [Entrada e minha conta](#conta)
  - escrevem o endereço: (app/) src/paginas/Entrada.test.tsx, src/paginas/Equipe.tsx, src/paginas/Home.tsx, src/ui/AvisoAoSair.test.tsx, src/ui/Casca.tsx, src/ui/sessao.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/entrada-paineis.spec.ts e2e/pagina-publica.spec.ts`
- `/equipe/` (Equipe): [Equipe, grupos e permissões](#equipe)
  - escrevem o endereço: (app/) src/paginas/CartaoPessoa.tsx, src/paginas/PerfilDaEquipe.tsx, src/regras/conviteDaPessoa.test.ts, src/regras/conviteDaPessoa.ts, src/ui/Casca.tsx, src/ui/base/base.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/configuracoes.spec.ts e2e/grupos-da-equipe.spec.ts e2e/importacao.spec.ts e2e/meus-valores.spec.ts e2e/objetos-sem-demanda.spec.ts e2e/perfil.spec.ts e2e/topo-do-cartao.spec.ts`
- `/equipe/perfil/` (PerfilDaEquipe): [Perfil profissional e foto](#perfil)
  - escrevem o endereço: (app/) src/paginas/EquipeDaPessoaNoTopo.test.tsx, src/paginas/UsuarioDaEquipe.tsx, src/regras/menuDaBolinha.test.ts, src/regras/menuDaBolinha.ts, src/ui/EquipeDoCartao.test.tsx
- `/financeiro/` (HubDoFinanceiro): [Financeiro](#financeiro)
  - escrevem o endereço: (app/) src/paginas/Financeiro.test.tsx, src/paginas/financeiro/AbasDoFinanceiro.tsx, src/paginas/financeiro/Graficos.tsx, src/paginas/financeiro/Hub.tsx, src/regras/enderecosAntigos.test.ts, src/ui/MenuFinanceiro.test.tsx, src/ui/MenuFinanceiro.tsx, src/ui/painel/Painel.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/atalhos.spec.ts e2e/financeiro.spec.ts e2e/parcelas.spec.ts`
- `/financeiro/contas/` (Financeiro): [Financeiro](#financeiro)
  - escrevem o endereço: (app/) e2e/ajudantes.ts, src/paginas/financeiro/Graficos.tsx, src/paginas/financeiro/Hub.tsx, src/regras/enderecosAntigos.test.ts
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/conferencia.spec.ts e2e/contrato-exclui-em-cascata.spec.ts e2e/financeiro.spec.ts e2e/lucros.spec.ts e2e/mais-no-titulo-das-secoes.spec.ts e2e/meus-valores.spec.ts e2e/parcelas.spec.ts`
- `/financeiro/direitos/` (HubDoFinanceiro): [Parcelas e recebimentos](#parcelas)
  - escrevem o endereço: (app/) src/paginas/financeiro/AbasDoFinanceiro.tsx, src/paginas/financeiro/Graficos.tsx, src/regras/enderecosAntigos.test.ts, src/regras/enderecosAntigos.ts, src/regras/painelInicial.test.ts, src/regras/painelInicial.ts, src/ui/MenuFinanceiro.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/parcelas.spec.ts`
- `/financeiro/obrigacoes/` (HubDoFinanceiro): [Parcelas e recebimentos](#parcelas)
  - escrevem o endereço: (app/) src/paginas/financeiro/AbasDoFinanceiro.tsx, src/regras/enderecosAntigos.test.ts, src/regras/enderecosAntigos.ts, src/ui/MenuFinanceiro.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/contrato-exclui-em-cascata.spec.ts e2e/financeiro.spec.ts e2e/meus-valores.spec.ts e2e/parcelas.spec.ts`
- `/financeiro/saidas/` (HubDoFinanceiro): [Financeiro](#financeiro)
  - escrevem o endereço: (app/) src/paginas/financeiro/AbasDoFinanceiro.tsx, src/paginas/financeiro/Graficos.tsx, src/ui/MenuFinanceiro.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/financeiro.spec.ts e2e/lucros.spec.ts e2e/parcelas.spec.ts e2e/topo-do-cartao.spec.ts`
- `/inicio/` (Inicio): [Painel inicial](#painel-inicial)
  - escrevem o endereço: (app/) e2e/ajudantes.ts, src/paginas/Conferencia.test.tsx, src/paginas/Conferencia.tsx, src/paginas/Configuracoes.test.tsx, src/paginas/Configuracoes.tsx, src/paginas/Entrada.tsx, src/paginas/Equipe.tsx, src/paginas/Financeiro.test.tsx, src/paginas/Financeiro.tsx, src/paginas/Home.tsx, src/paginas/Lucros.tsx, src/paginas/MeusValores.test.tsx, src/paginas/MeusValores.tsx, src/paginas/financeiro/Hub.tsx, src/regras/enderecosAntigos.test.ts, src/ui/BuscaGeral.test.tsx, src/ui/Casca.tsx, src/ui/MaisDoMenu.test.tsx, src/ui/MenuFinanceiro.test.tsx, src/ui/SubmenuLateral.test.tsx
  - 43 testes de tela vão direto a ele: rode a bateria completa (`npm run testar-telas`).
- `/lucros/` (Lucros): [Lucro dos sócios](#lucros)
  - escrevem o endereço: (app/) e2e/ajudantes.ts, src/paginas/financeiro/Hub.tsx, src/regras/enderecosAntigos.test.ts
- `/mensagens/` (Mensagens): [Mensagens e avisos](#mensagens)
  - escrevem o endereço: (app/) src/paginas/Inicio.test.tsx, src/paginas/Inicio.tsx, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/grupos-da-equipe.spec.ts e2e/lembretes.spec.ts e2e/mencoes-de-itens.spec.ts e2e/mensagens.spec.ts e2e/painel-inicial.spec.ts`
- `/meus-valores/` (MeusValores): [Meus valores](#meus-valores)
  - escrevem o endereço: (app/) e2e/ajudantes.ts, src/paginas/MeusValores.test.tsx, src/paginas/financeiro/Hub.tsx, src/regras/enderecosAntigos.test.ts
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/meus-valores.spec.ts`
- `/minha-conta/` (MinhaConta): [Entrada e minha conta](#conta)
  - escrevem o endereço: (app/) src/paginas/Entrada.tsx, src/paginas/EquipeNoTopo.test.tsx, src/paginas/PerfilDaEquipe.tsx, src/regras/menuDaBolinha.test.ts, src/regras/menuDaBolinha.ts, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/atalhos.spec.ts e2e/entrada-paineis.spec.ts e2e/foto.spec.ts e2e/mensagens.spec.ts e2e/perfil.spec.ts`
- `/modelos-de-lista/` (ModelosDeLista): [Checklists e modelos](#listas)
  - escrevem o endereço: (app/) src/paginas/Contratos.tsx, src/paginas/Demandas.tsx, src/paginas/ListasDoCartao.tsx, src/paginas/Tarefas.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/checklists-com-grupos.spec.ts e2e/demandas.spec.ts`
- `/pessoas/` (Pessoas): [Pessoas](#pessoas)
  - escrevem o endereço: (app/) src/paginas/CartaoCompromisso.tsx, src/paginas/CartaoContrato.tsx, src/paginas/CartaoDemanda.tsx, src/paginas/CartaoProcesso.tsx, src/paginas/CartaoTarefa.tsx, src/paginas/ImportarPessoas.test.tsx, src/paginas/ImportarPessoas.tsx, src/paginas/Inicio.test.tsx, src/paginas/NovaPessoa.tsx, src/paginas/PartesDoProcesso.test.tsx, src/paginas/PartesDoProcesso.tsx, src/paginas/Pessoas.test.tsx, src/paginas/UsuarioDaEquipe.tsx, src/paginas/financeiro/DetalheFinanceiro.tsx, src/paginas/inicio/Blocos.tsx, src/regras/anotacao.ts, src/regras/buscaGeral.test.ts, src/regras/buscaGeral.ts, src/regras/consentimentoSemData.test.ts, src/regras/consentimentoSemData.ts, src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/origemDaPessoa.test.ts, src/regras/origemDoCadastro.test.ts, src/regras/origemDoCadastro.ts, src/regras/painelInicial.test.ts, src/regras/painelInicial.ts, src/ui/BuscaGeral.test.tsx, src/ui/Casca.tsx, src/ui/Comentarios.test.tsx, src/ui/PaginaModulo.test.tsx, src/ui/abrirItem.test.tsx, src/ui/atalhos.test.tsx, src/ui/useCartaoNaUrl.test.tsx
  - 41 testes de tela vão direto a ele: rode a bateria completa (`npm run testar-telas`).
- `/pessoas/importar/` (FormularioImportacao): [Importação](#importacao)
  - escrevem o endereço: (app/) src/paginas/ImportarPessoas.test.tsx, src/paginas/Pessoas.test.tsx, src/paginas/Pessoas.tsx
- `/pessoas/nova/` (FormularioPessoa): [Pessoas](#pessoas)
  - escrevem o endereço: (app/) src/paginas/Inicio.tsx, src/paginas/Pessoas.tsx, src/paginas/PessoasNosItens.test.tsx, src/regras/novoNaAnotacao.test.ts, src/regras/novoNaAnotacao.ts, src/regras/origemDaPessoa.test.ts, src/regras/origemDaPessoa.ts, src/ui/BuscaPessoa.test.tsx, src/ui/BuscaPessoa.tsx, src/ui/Casca.tsx, src/ui/atalhos.test.tsx, src/ui/base/base.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/cadastro.spec.ts e2e/cliente-ao-contrato.spec.ts e2e/nova-pessoa-no-cartao.spec.ts e2e/pessoas.spec.ts e2e/planilha-provisoria.spec.ts e2e/sair-do-cadastro.spec.ts`
- `/processos/` (PainelProcessos): [Processos](#processos)
  - escrevem o endereço: (app/) src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/painelInicial.ts, src/ui/Casca.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/prazo-da-tarefa.spec.ts e2e/processos.spec.ts`
- `/processos/administrativo/` (Processos): [Processos](#processos)
  - escrevem o endereço: (app/) src/paginas/Mensagens.test.tsx, src/regras/anotacao.test.ts, src/regras/buscaGeral.test.ts, src/regras/enderecosAntigos.test.ts, src/regras/graficosDeProcessos.test.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/nascerLigado.test.ts, src/regras/origemDaPessoa.test.ts, src/regras/painelInicial.test.ts, src/regras/painelProcessos.test.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/processo.ts, src/regras/processoPartesERecursos.test.ts, src/ui/Casca.tsx, src/ui/painel/Painel.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/arrumacao-do-cartao.spec.ts`
- `/processos/judicial/` (Processos): [Processos](#processos)
  - escrevem o endereço: (app/) src/paginas/Mensagens.test.tsx, src/paginas/NovaDemandaPelaOrigem.test.tsx, src/paginas/NovoContratoPelaOrigem.test.tsx, src/regras/buscaGeral.test.ts, src/regras/enderecosAntigos.test.ts, src/regras/graficosDeProcessos.test.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/origemDaPessoa.test.ts, src/regras/painelInicial.test.ts, src/regras/painelProcessos.test.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/processo.ts, src/ui/BuscaGeral.test.tsx, src/ui/Casca.tsx, src/ui/Graficos.test.tsx, src/ui/painel/Painel.test.tsx
  - 21 testes de tela vão direto a ele: rode a bateria completa (`npm run testar-telas`).
- `/processos/novo/` (FormularioProcesso): [Processos](#processos)
  - escrevem o endereço: (app/) src/paginas/CartaoContrato.tsx, src/paginas/CartaoTarefa.tsx, src/paginas/NovoProcesso.test.tsx, src/paginas/PainelProcessos.tsx, src/paginas/PartesDoProcesso.test.tsx, src/paginas/Processos.tsx, src/paginas/ProcessosDaDemanda.tsx, src/paginas/ProcessosDaPessoa.tsx, src/paginas/ProcessosDoCartao.test.tsx, src/paginas/concluirDemanda.ts, src/regras/origemDoCadastro.test.ts, src/regras/processo.ts, src/regras/processoPartesERecursos.test.ts
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/novo-padrao-das-secoes.spec.ts e2e/processo-partes-e-recursos.spec.ts e2e/processos.spec.ts e2e/propriedade-intelectual-na-agenda.spec.ts e2e/propriedade-intelectual.spec.ts e2e/sair-do-cadastro.spec.ts`
- `/tarefas/` (Tarefas): [Tarefas](#tarefas)
  - escrevem o endereço: (app/) src/paginas/CartaoTarefa.tsx, src/paginas/CartoesLigados.tsx, src/paginas/Inicio.test.tsx, src/paginas/ItensDoCompromisso.test.tsx, src/paginas/Mensagens.test.tsx, src/paginas/MeuTempo.tsx, src/paginas/ModelosDeLista.tsx, src/paginas/NovaDemandaPelaOrigem.test.tsx, src/paginas/NovaTarefa.test.tsx, src/paginas/NovaTarefa.tsx, src/paginas/TarefasDaDemanda.test.tsx, src/paginas/TarefasDaDemanda.tsx, src/paginas/inicio/GraficosDoInicio.tsx, src/paginas/nascerNaAnotacao.test.tsx, src/paginas/processo/Andamentos.tsx, src/paginas/processo/Prazos.tsx, src/regras/agenda.ts, src/regras/anotacao.ts, src/regras/buscaGeral.test.ts, src/regras/buscaGeral.ts, src/regras/gruposDaEquipe.test.ts, src/regras/gruposDaEquipe.ts, src/regras/inclusao.test.ts, src/regras/mensagens.test.ts, src/regras/mensagens.ts, src/regras/nascerLigado.test.ts, src/regras/origemDaPessoa.test.ts, src/regras/origemDoCadastro.test.ts, src/regras/painelInicial.test.ts, src/regras/painelInicial.ts, src/regras/pedidoDeParticipacao.test.ts, src/regras/pedidoDeParticipacao.ts, src/ui/BuscaGeral.test.tsx, src/ui/Casca.tsx, src/ui/ItensLigados.test.tsx, src/ui/MaisDoMenu.test.tsx, src/ui/Pastas.test.tsx, src/ui/TextoComMencoes.test.tsx, src/ui/painel/Painel.test.tsx, src/ui/useCartaoNaUrl.test.tsx, src/ui/useParametroLido.test.tsx
  - 36 testes de tela vão direto a ele: rode a bateria completa (`npm run testar-telas`).
- `/tarefas/meu-tempo/` (MeuTempo): [Tempo nas tarefas](#tempo)
  - escrevem o endereço: (app/) src/paginas/Tarefas.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/meu-tempo.spec.ts`
- `/tarefas/nova/` (FormularioTarefa): [Tarefas](#tarefas)
  - escrevem o endereço: (app/) src/paginas/CartaoContrato.tsx, src/paginas/CartaoDemanda.tsx, src/paginas/CartaoPessoa.tsx, src/paginas/CartaoProcesso.tsx, src/paginas/Inicio.test.tsx, src/paginas/Inicio.tsx, src/paginas/NovaTarefa.test.tsx, src/paginas/Tarefas.tsx, src/regras/novoNaAnotacao.test.ts, src/regras/novoNaAnotacao.ts, src/ui/Casca.tsx, src/ui/ItensLigados.test.tsx, src/ui/LigarDoModulo.test.tsx
  - testes de tela que vão direto a ele, na pasta app: `npx playwright test e2e/copiar-tarefa.spec.ts e2e/datas.spec.ts e2e/demanda-continua.spec.ts e2e/grupos-da-equipe.spec.ts e2e/lembretes.spec.ts e2e/sair-do-cadastro.spec.ts e2e/tarefa-aprovacao.spec.ts e2e/tarefa-em-varias-ligacoes.spec.ts e2e/tarefa-pedido.spec.ts e2e/tarefas.spec.ts`

<a id="sem-assunto"></a>
## Sem assunto

Nada: tudo está classificado.
