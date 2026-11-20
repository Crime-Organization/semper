# Product

<!-- impeccable:product-schema 1 -->

> Escrito a partir do pedido do dono na tarefa #380 (19/11/2026), do README.md e do código, sem entrevista própria:
> o agente que o escreveu não tinha como perguntar. O que foi deduzido está marcado com *(deduzido)*.

## Platform

web

## Users

- **Quem decide no escritório** (sócio, administrador): conhece o SEMPER pela página pública (semper.app.br) e decide se
  pede uma demonstração. Pode ser de um escritório de advocacia, de propriedade intelectual, de um núcleo de inovação de
  uma instituição ou de outro escritório de serviços profissionais. Quase sempre não é programador.
- **A equipe do escritório** (advogados, administrativo, estagiários): usa o SEMPER o dia inteiro, no computador e no
  celular, para atender clientes, cuidar de contratos, demandas, tarefas, prazos e documentos.

## Product Purpose

O SEMPER é o sistema de gestão do escritório: reúne pessoas (clientes, partes e contatos), contratos, demandas, tarefas,
checklists, processos e prazos, agenda, anotações e a caixa de mensagens da equipe, num endereço só, no navegador. Sucesso
é a equipe trabalhar num lugar só, sem planilhas e quadros soltos, e o escritório saber o que está acontecendo.

## Positioning

Nasceu dentro de um escritório e foi feito a partir do trabalho real dele: a qualificação de cada parte sai pronta no
padrão das petições, os prazos contam dias úteis com feriados e suspensões de cada órgão, e cada contrato gera as
demandas e tarefas dos serviços contratados. Ao mesmo tempo, não é só para advocacia: os módulos servem a qualquer
escritório de serviços profissionais, e cada escritório liga só os módulos de que precisa.

## Operating Context

- Funciona no navegador, sem instalar; a equipe recebe o acesso por convite.
- Cada escritório escolhe as próprias etapas (colunas dos quadros), os modelos de checklist, os órgãos e feriados.
- A página pública é a porta de entrada: a ação é pedir uma demonstração; a conversa abre por e-mail
  (`MARCA.emailContato`) ou pelo WhatsApp se `MARCA.whatsapp` for preenchido.

## Capabilities and Constraints

- Prontos (no main): Início, busca geral, Pessoas, Contratos, Demandas, Tarefas (com cronômetro), Checklists com grupos
  numerados e modelos, Processos (judiciais e administrativos), Calendário de feriados e calculadora de prazo, Agenda,
  Documentos (anotações), Mensagens, comentários com menções, histórico de alterações, criar item já ligado, desfazer,
  Equipe e acessos, Configurações, Minha conta (inclusive verificação em duas etapas), Novidades.
- Não prometer: Portal do cliente (em preparação), Financeiro (regras feitas para o primeiro escritório), grupos da
  equipe (não estão no main), ligação com o Google além de ligar a conta, site do escritório.
- O SEMPER não pertence a nenhum escritório: nome e logomarca de cada escritório vêm das Configurações dele.

## Brand Commitments

- Nome: SEMPER. A identidade visual é a do sistema (DESIGN.md e `app/src/estilo.css`): o verde, a Lato, os cinzas quentes.
- Texto em português simples, para quem não é programador, sem jargão técnico.
- Nunca citar um escritório cliente pelo nome; nunca falar de preço na página pública (decisão do dono, 19/11).

## Evidence on Hand

- Telas reais do sistema, capturadas do banco fictício (`npm run teste`), que só tem dados inventados
  (os nomes "de teste" do fictício viram, só na imagem, nomes comuns inventados, e CPF, CNPJ, número de processo e
  telefone ficam com dígitos que não podem existir).
- Não há depoimentos, clientes citáveis, números de uso nem preços: nada disso pode ser inventado.

## Product Principles

- Mostrar o sistema como ele é: só o que está pronto, com telas reais e dados de exemplo.
- Toda mudança vale para todos os escritórios.
- Os dados dos clientes são protegidos acima de tudo (LGPD, cada escritório separado, registro de ações).
- *(deduzido)* Falar a língua de quem trabalha no escritório: pessoa, contrato, demanda, prazo, convite.

## Accessibility & Inclusion

Contraste mínimo de 4,5:1 (3:1 em texto grande) nos dois temas, títulos em ordem, tudo pelo teclado, alvo de toque de
44px (DESIGN.md).
