// @vitest-environment jsdom
// Contrato da camada de dados: o que as telas pressupõem de qualquer implementação de Dados.
// Hoje roda no banco fictício (falso.ts), que substitui o Supabase em "npm run teste" e nos testes de ponta a ponta:
// se ele se comportar diferente do banco de verdade, os testes das telas passam por engano.
// Para rodar também no Supabase (com um Supabase local), basta chamar contrato() com a outra implementação.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dados, DadosPessoa, FiltroAnotacoes, ItemImportacao } from './tipos';
import { camposDoPerfil, perfilVazio } from '../regras/perfilProfissional';
import { normal } from '../regras/texto';
import { dadosDaCopia } from '../regras/anotacao';
import { GRUPOS_POR_ITEM, TAMANHO_GRUPO_DA_EQUIPE, TAMANHO_MOTIVO } from './limites';
import { FILTRO_DOS_MEUS_GRUPOS } from '../regras/gruposDaEquipe';
import { ITENS_DA_AGENDA, ITENS_DA_ANOTACAO, ITENS_DO_COMPROMISSO, ITENS_PARA_LIGAR, TAMANHO_ANOTACAO, TAMANHO_COMPROMISSO, TAMANHO_ITEM, TAMANHO_PASTA, TAMANHO_TAREFA, TROCAS_DE_EMAIL_POR_HORA } from './limites';
import { RECUSA_DA_TROCA } from '../regras/conta';
import { MESMA_DEMANDA } from '../regras/demandasRelacionadas';
import { SALA_REPETIDA } from '../regras/sala';
import { SEM_MOTIVO_DA_DILIGENCIA } from '../regras/tarefa';
import { NAO_ESPERA_APROVACAO, SEM_COMENTARIO_DA_DEVOLUCAO, SO_QUEM_PEDIU_APROVA, SO_QUEM_PEDIU_MUDA_A_APROVACAO } from '../regras/aprovacaoDaTarefa';
import { CONTINUA_NAO_CONCLUI, CONTINUA_SEM_EQUIPE, tituloDaContinua } from '../regras/demandaContinua';
import { FUNCAO_REPETIDA, funcaoEmUso } from '../regras/funcoesNaTarefa';
import { CONTA_COM_LANCAMENTOS, CONTA_NAO_ARQUIVADA } from '../regras/caixa';
import { DIA, MINUTO } from '../ui/tempos';
import { ITENS_POR_LISTA } from '../regras/painelProcessos';
import { hojeISO } from '../ui/util';
import { INICIO_VAZIO, inicioDoCriadoEm } from '../regras/dataDeInicio';
import { acharNo, arvoreDaLista, arvoreDosItens, CHECKLIST_MUDOU, emOrdemDeLeitura, GRUPO_DENTRO_DELE, NAO_CABE_NO_GRUPO, NIVEIS_DEMAIS, ondeEntraAArvore, ondeEntraONovo } from '../regras/gruposDaLista';

function contrato(nome: string, abrir: () => Promise<Dados>) {
  describe(`Contrato da camada de dados (${nome})`, () => {
    let SD: Dados;
    beforeEach(async () => { SD = await abrir(); });

    // Cada caso cria os próprios cadastros, com um marcador no nome, para não depender da semente.
    const marca = () => 'CONTRATO ' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const criar = (nome: string, extra: Parameters<Dados['pessoaCriar']>[0] = {}) => SD.pessoaCriar({ tipo: 'pf', nome, ...extra });

    describe('Pessoas', () => {
      it('quando uma empresa com CNPJ com letras é cadastrada, então ela é achada pelo documento e pela busca, com ou sem máscara', async () => {
        // Dado
        const { id } = await criar('EMPRESA ALFANUMERICA ' + marca(), { tipo: 'pj', documento: '12ABC34501DE35' });
        // Quando
        const porDocumento = await SD.pessoaPorDocumento('12ABC34501DE35');
        const [comMascara, semMascara] = await Promise.all(['12.ABC.345/01DE-35', '12abc34501de35'].map(termo => SD.pessoasListar({ termo })));
        // Então
        expect(porDocumento?.id).toBe(id);
        expect(comMascara.linhas.map(p => p.id)).toContain(id);
        expect(semMascara.linhas.map(p => p.id)).toContain(id);
        await expect(criar('OUTRA ' + marca(), { tipo: 'pj', documento: '12ABC34501DE35' })).rejects.toThrow('Já existe um cadastro com este CPF/CNPJ.');
      });

      it('quando uma pessoa é criada, então ela pode ser lida de volta com o que foi gravado e um código', async () => {
        // Quando
        const { id, codigo } = await criar('MARIA CONTRATO', { documento: '28625587887', telefones: ['38999990000'] });
        // Então
        const lida = await SD.pessoaObter(id);
        expect(codigo).toBeTruthy();
        expect(lida).toMatchObject({ id, codigo, tipo: 'pf', nome: 'MARIA CONTRATO', documento: '28625587887', telefones: ['38999990000'] });
      });

      it('quando se busca por parte do nome, sem acento e em minúsculas, então a pessoa é encontrada', async () => {
        // Dado
        const nome = marca();
        await criar(`JOSÉ ${nome}`);
        // Quando
        const r = await SD.pessoasListar({ termo: `jose ${nome.toLowerCase()}` });
        // Então
        expect(r.linhas.map(p => p.nome)).toEqual([`JOSÉ ${nome}`]);
        expect(r.total).toBe(1);
      });

      it('quando a lista é paginada, então as páginas não se repetem e o total é o mesmo em todas', async () => {
        // Dado
        const nome = marca();
        for (let i = 0; i < 5; i++) await criar(`${nome} ${i}`);
        // Quando
        const p0 = await SD.pessoasListar({ termo: nome, porPagina: 2, pagina: 0 });
        const p1 = await SD.pessoasListar({ termo: nome, porPagina: 2, pagina: 1 });
        const p2 = await SD.pessoasListar({ termo: nome, porPagina: 2, pagina: 2 });
        // Então
        expect([p0.total, p1.total, p2.total]).toEqual([5, 5, 5]);
        expect([p0.linhas.length, p1.linhas.length, p2.linhas.length]).toEqual([2, 2, 1]);
        expect(new Set([...p0.linhas, ...p1.linhas, ...p2.linhas].map(p => p.id)).size).toBe(5);
      });

      it('quando já existe alguém com o mesmo CPF, então criar outro é recusado com a mensagem em português', async () => {
        // Dado
        await criar(marca(), { documento: '31572498609' });
        // Quando
        const repetida = criar(marca(), { documento: '31572498609' });
        // Então
        await expect(repetida).rejects.toThrow('Já existe um cadastro com este CPF/CNPJ.');
      });

      it('quando se procura pelo documento, então acha a pessoa, menos quando ela mesma é a exceção', async () => {
        // Dado
        const { id } = await criar('ANA CONTRATO', { documento: '40718392523' });
        // Quando
        const achada = await SD.pessoaPorDocumento('40718392523');
        const semEla = await SD.pessoaPorDocumento('40718392523', id);
        // Então
        expect(achada).toMatchObject({ id, nome: 'ANA CONTRATO' });
        expect(semEla).toBeNull();
      });

      it('quando a pessoa é arquivada, então sai das ativas, entra nas arquivadas e volta ao desarquivar', async () => {
        // Dado
        const nome = marca();
        const { id } = await criar(nome);
        const ids = async (situacao: 'ativas' | 'arquivadas') => (await SD.pessoasListar({ termo: nome, situacao })).linhas.map(p => p.id);
        // Quando
        await SD.pessoasArquivar([id]);
        const arquivada = [await ids('ativas'), await ids('arquivadas')];
        await SD.pessoasArquivar([id], false);
        const devolvida = [await ids('ativas'), await ids('arquivadas')];
        // Então
        expect(arquivada).toEqual([[], [id]]);
        expect(devolvida).toEqual([[id], []]);
      });
    });

    describe('Quadro', () => {
      it('quando a pessoa é movida para uma coluna, então aparece nessa coluna e sai da anterior', async () => {
        // Dado
        const [primeira, segunda] = await SD.colunasListar('pessoas');
        const nome = marca();
        const { id } = await criar(nome);
        await SD.pessoaMover(id, primeira.id, 1);
        // Quando
        await SD.pessoaMover(id, segunda.id, 1);
        // Então
        const naPrimeira = await SD.pessoasDaEtapa(primeira.id, { termo: nome });
        const naSegunda = await SD.pessoasDaEtapa(segunda.id, { termo: nome });
        expect(naPrimeira.linhas.map(p => p.id)).toEqual([]);
        expect(naSegunda.linhas.map(p => p.id)).toEqual([id]);
      });
    });

    describe('Contratos', () => {
      const novoContrato = async (extra: Parameters<Dados['contratoCriar']>[0] = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore', ...extra });
      };
      // Participante é sempre alguém da equipe: os casos usam as pessoas da equipe ativa do escritório.
      const daEquipe = async () => (await SD.contexto())!.equipe.filter(m => m.ativo && m.pessoa_id).map(m => m.pessoa_id!);

      it('quando um contrato é criado, então recebe o número com a sigla do responsável, o sequencial e o ano', async () => {
        // Quando
        const { id, codigo } = await novoContrato();
        // Então
        const lido = await SD.contratoObter(id);
        expect(codigo).toMatch(new RegExp(`^MA96-\\d{4}-${new Date().getFullYear()}$`));
        expect(lido).toMatchObject({ id, codigo, sigla: 'MA96', servico: 'Registro de marca', categoria: 'pro_labore' });
      });

      it('quando dois contratos são criados, então o segundo tem o número seguinte do escritório', async () => {
        // Quando
        const a = await SD.contratoObter((await novoContrato()).id);
        const b = await SD.contratoObter((await novoContrato({ responsavel_id: 'u-ana' })).id);
        // Então
        expect(b!.numero).toBe(a!.numero + 1);
        expect(b!.sigla).toBe('AN05');
      });

      it('quando o contrato muda de responsável e de coluna, então o número continua o mesmo', async () => {
        // Dado
        const [coluna] = await SD.colunasListar('contratos');
        const { id, codigo } = await novoContrato();
        // Quando
        await SD.contratoAtualizar(id, { responsavel_id: 'u-ana', objetos: ['Outro serviço'] });
        await SD.contratoMover(id, coluna.id, 1);
        // Então
        const lido = await SD.contratoObter(id);
        expect(lido).toMatchObject({ codigo, responsavel_id: 'u-ana', etapa_id: coluna.id });
      });

      it('quando se busca pelo código antigo da planilha, então o contrato é encontrado', async () => {
        // Dado
        const antigo = 'ZZ11-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-001/24';
        const { id } = await novoContrato({ codigo_antigo: antigo });
        // Quando
        const r = await SD.contratosListar({ termo: antigo.toLowerCase() });
        // Então
        expect(r.linhas.map(k => k.id)).toEqual([id]);
      });

      it('quando um contrato ativo é excluído, então ele continua lá; arquivado, sai de vez', async () => {
        // Dado
        const { id } = await novoContrato();
        // Quando
        const ativo = await SD.contratosExcluir([id]);
        await SD.contratosArquivar([id]);
        const arquivado = await SD.contratosExcluir([id]);
        // Então
        expect(ativo.excluidas).toBe(0);
        expect(arquivado.excluidas).toBe(1);
        expect(await SD.contratoObter(id)).toBeNull();
      });

      it('quando o contrato mais recente do ano é excluído, então o número dele volta a ser usado', async () => {
        // Dado
        const { id } = await novoContrato();
        const excluido = (await SD.contratoObter(id))!.numero;
        await SD.contratosArquivar([id]);
        await SD.contratosExcluir([id]);
        // Quando
        const seguinte = await SD.contratoObter((await novoContrato()).id);
        // Então
        expect(seguinte!.numero).toBe(excluido);
      });

      it('quando um contrato do meio é excluído, então o número dele fica vago e a numeração segue do último', async () => {
        // Dado
        const { id: meio } = await novoContrato();
        const ultimo = (await SD.contratoObter((await novoContrato()).id))!.numero;
        await SD.contratosArquivar([meio]);
        await SD.contratosExcluir([meio]);
        // Quando
        const seguinte = await SD.contratoObter((await novoContrato()).id);
        // Então
        expect(seguinte!.numero).toBe(ultimo + 1);
      });

      it('quando o contrato mais recente é só arquivado, então o número dele continua contando', async () => {
        // Dado
        const { id } = await novoContrato();
        const arquivado = (await SD.contratoObter(id))!.numero;
        await SD.contratosArquivar([id]);
        // Quando
        const seguinte = await SD.contratoObter((await novoContrato()).id);
        // Então
        expect(seguinte!.numero).toBe(arquivado + 1);
      });

      it('quando o ano muda, então a numeração recomeça em 1, com o ano novo no número', async () => {
        // Dado (o relógio do navegador; no banco de verdade vale o do servidor, conferido no SQL)
        const anoQueVem = new Date().getFullYear() + 1;
        await novoContrato();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(anoQueVem, 0, 2));
        try {
          // Quando
          const { codigo } = await novoContrato();
          // Então
          expect(codigo).toBe(`MA96-0001-${anoQueVem}`);
        } finally { vi.useRealTimers(); }
      });

      it('quando a pessoa é cliente de um contrato, então ela não pode ser excluída', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        await SD.contratoCriar({ cliente_id: cliente, responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
        await SD.pessoasArquivar([cliente]);
        // Quando
        const r = await SD.pessoasExcluir([cliente]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em contratos e não pode ser excluída.' });
      });

      it('quando o contrato é salvo com vários objetos, então voltam limpos, na ordem, e o serviço mostra os objetos juntos', async () => {
        // Quando
        const { id } = await novoContrato({ objetos: ['Registro de marca', '  Busca de anterioridade ', 'REGISTRO DE MARCA', ''] });
        // Então
        expect(await SD.contratoObter(id)).toMatchObject({
          objetos: ['Registro de marca', 'Busca de anterioridade'], servico: 'Registro de marca; Busca de anterioridade'
        });
      });

      it('quando os objetos mudam, então o histórico registra a troca uma vez, pelo texto', async () => {
        // Dado
        const { id } = await novoContrato({ objetos: ['Registro de marca', 'Oposição'] });
        // Quando
        await SD.contratoAtualizar(id, { objetos: ['Registro de marca', 'Recurso'] });
        // Então
        const [ultima] = await SD.contratoHistorico(id);
        expect(ultima.alteracoes).toEqual({ servico: { de: 'Registro de marca; Oposição', para: 'Registro de marca; Recurso' } });
      });

      it('quando a versão anterior do site grava só o serviço, então os objetos acompanham o texto', async () => {
        // Dado
        const { id } = await novoContrato();
        // Quando
        await SD.contratoAtualizar(id, { servico: 'Notificação extrajudicial; Acordo' });
        // Então
        expect((await SD.contratoObter(id))!.objetos).toEqual(['Notificação extrajudicial', 'Acordo']);
      });

      it('quando o contrato não tem nenhum objeto, então salvar é recusado com a mensagem em português', async () => {
        // Quando
        const semObjeto = novoContrato({ objetos: ['  '] });
        // Então
        await expect(semObjeto).rejects.toThrow('Informe ao menos um objeto do contrato.');
      });

      it('quando um contrato é salvo, então os objetos entram na lista do escritório, sem repetir', async () => {
        // Dado
        const objeto = 'Objeto ' + marca();
        // Quando
        await novoContrato({ objetos: [objeto, 'Registro de marca'] });
        await novoContrato({ objetos: [objeto.toLowerCase()] });
        // Então
        const lista = await SD.objetosSugeridos();
        expect(lista.filter(o => o.toLowerCase() === objeto.toLowerCase())).toEqual([objeto]);
        expect(lista).toContain('Registro de marca');
      });

      it('quando o contrato tem vários participantes, então voltam na ordem, com os percentuais', async () => {
        // Dado
        const [ana, bruno] = await daEquipe();
        // Quando
        const { id } = await novoContrato({ participantes: [{ pessoa_id: ana, percentual: 20 }, { pessoa_id: bruno, percentual: null }] });
        // Então
        const lido = await SD.contratoObter(id);
        expect(lido!.participantes.map(p => [p.pessoa.id, p.percentual])).toEqual([[ana, 20], [bruno, null]]);
      });

      it.each([
        ['a mesma pessoa duas vezes', 'A mesma pessoa aparece duas vezes nos participantes.'],
        ['um participante que é o indicador', 'O indicador e os participantes precisam ser pessoas diferentes.']
      ])('quando a lista tem %s, então salvar é recusado com a mensagem em português', async (caso, mensagem) => {
        // Dado
        const [ana] = await daEquipe();
        const dados = caso.startsWith('a mesma')
          ? { participantes: [{ pessoa_id: ana, percentual: 10 }, { pessoa_id: ana, percentual: 5 }] }
          : { participantes: [{ pessoa_id: ana, percentual: 10 }], indicador_id: ana };
        // Quando
        const salvar = novoContrato(dados);
        // Então
        await expect(salvar).rejects.toThrow(mensagem);
      });

      it('quando os participantes mudam, então o histórico mostra os nomes e os percentuais', async () => {
        // Dado
        const [ana] = await daEquipe();
        const { nome } = (await SD.pessoaObter(ana))!;
        const { id } = await novoContrato();
        // Quando
        await SD.contratoAtualizar(id, { participantes: [{ pessoa_id: ana, percentual: 10.5 }] });
        // Então
        const [ultima] = await SD.contratoHistorico(id);
        expect(ultima.alteracoes).toEqual({ participantes: { de: null, para: `${nome} (10,5%)` } });
      });

      it('quando a pessoa é a indicadora de um contrato, então ela não pode ser excluída', async () => {
        // Dado (o indicador pode ser qualquer pessoa, de fora da equipe)
        const { id: ana } = await criar(marca());
        await novoContrato({ indicador_id: ana, indicador_percentual: 10 });
        await SD.pessoasArquivar([ana]);
        // Quando
        const r = await SD.pessoasExcluir([ana]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em contratos e não pode ser excluída.' });
      });

      it('quando se pedem os contratos de uma pessoa, então vêm os dela, com o papel dela em cada um', async () => {
        // Dado (alguém da equipe, que pode participar e também ser cliente)
        const [ana] = await daEquipe();
        const { id: comoCliente } = await novoContrato();
        const { id: comoParticipante } = await novoContrato({ participantes: [{ pessoa_id: ana, percentual: 10 }] });
        const { id: daAna } = await SD.contratoCriar({ clientes: [ana], responsavel_id: 'u-master', objetos: ['Oposição'], categoria: 'pro_bono' });
        // Quando
        const lista = await SD.contratosDaPessoa(ana);
        // Então
        const papeis = Object.fromEntries(lista.map(k => [k.id, k.papeis]));
        expect(papeis[daAna]).toEqual(['cliente']);
        expect(papeis[comoParticipante]).toEqual(['participante']);
        expect(papeis).not.toHaveProperty(comoCliente);
      });

      it('quando a pessoa é da equipe, então os contratos em que ela é a responsável também vêm', async () => {
        // Dado
        const { id } = await novoContrato({ responsavel_id: 'u-ana' });
        // Quando
        const lista = await SD.contratosDaPessoa('p-ana', 'u-ana');
        // Então
        expect(lista.find(k => k.id === id)?.papeis).toEqual(['responsavel']);
      });

      it('quando o participante não é da equipe, então salvar é recusado com a mensagem em português', async () => {
        // Dado
        const { id: deFora } = await criar(marca());
        // Quando
        const salvar = novoContrato({ participantes: [{ pessoa_id: deFora, percentual: 10 }] });
        // Então
        await expect(salvar).rejects.toThrow('O participante precisa ser alguém da equipe do escritório.');
      });

      it('quando o responsável escolhido não é advogado, então salvar é recusado com a mensagem em português', async () => {
        // Dado
        await SD.equipeDefinirFuncao('u-ana', 'estagiario');
        // Quando
        const salvar = novoContrato({ responsavel_id: 'u-ana' });
        // Então
        await expect(salvar).rejects.toThrow('O responsável do contrato precisa ser um advogado da equipe.');
      });

      it('dado um responsável que deixou de ser advogado, quando o contrato dele muda, então salva, mas ninguém novo o escolhe', async () => {
        // Dado
        const { id } = await novoContrato({ responsavel_id: 'u-ana' });
        const { id: outro } = await novoContrato();
        await SD.equipeDefinirFuncao('u-ana', 'administrativo');
        // Quando
        const [mudarValor, trocarResponsavel] = await Promise.allSettled([
          SD.contratoAtualizar(id, { valor: 2000 }), SD.contratoAtualizar(outro, { responsavel_id: 'u-ana' })
        ]);
        // Então
        expect(mudarValor.status).toBe('fulfilled');
        expect((await SD.contratoObter(id))!.valor).toBe(2000);
        expect(trocarResponsavel).toMatchObject({ status: 'rejected', reason: { message: 'O responsável do contrato precisa ser um advogado da equipe.' } });
      });

      it('quando o contrato tem dois clientes, então os dois voltam na ordem, e o contrato aparece para cada um como cliente', async () => {
        // Dado
        const nomeAna = marca(), nomeBruno = marca();
        const { id: ana } = await criar(nomeAna), { id: bruno } = await criar(nomeBruno);
        // Quando
        const { id } = await SD.contratoCriar({ clientes: [ana, bruno, ana], responsavel_id: 'u-master', objetos: ['Divórcio'], categoria: 'pro_labore' });
        // Então
        const lido = await SD.contratoObter(id);
        expect(lido!.clientes.map(c => c.id)).toEqual([ana, bruno]);
        expect(lido!.cliente_nome).toBe(`${nomeAna}; ${nomeBruno}`);
        expect((await SD.contratosDaPessoa(bruno)).map(k => [k.id, k.papeis])).toEqual([[id, ['cliente']]]);
        expect((await SD.contratosListar({ termo: nomeBruno })).linhas.map(k => k.id)).toEqual([id]);
      });

      it('quando a versão anterior do site grava só o cliente antigo, então a lista passa a ter só ele', async () => {
        // Dado
        const { id: ana } = await criar(marca());
        const { id } = await novoContrato();
        // Quando
        await SD.contratoAtualizar(id, { cliente_id: ana });
        // Então
        expect((await SD.contratoObter(id))!.clientes.map(c => c.id)).toEqual([ana]);
      });

      it('quando as colunas de contratos são listadas, então a do contrato assinado é a coluna-marco e não pode ser excluída', async () => {
        // Dado
        const colunas = await SD.colunasListar('contratos');
        const marco = colunas.find(c => c.marco === 'assinado')!;
        // Quando
        const excluir = SD.colunaExcluir(marco.id);
        // Então
        expect(marco.nome).toBe('Assinado / em andamento');
        // A outra coluna-marco é a do contrato que espera a assinatura (#269).
        expect(colunas.filter(c => c.marco).map(c => c.marco)).toEqual(['aguardando_assinatura', 'assinado']);
        await expect(excluir).rejects.toThrow('a coluna-marco não pode ser excluída');
        expect((await SD.colunasListar('contratos')).some(c => c.id === marco.id)).toBe(true);
      });

      it('quando as colunas de contratos são listadas, então são as do quadro de contratos, não as de pessoas', async () => {
        // Quando
        const contratos = (await SD.colunasListar('contratos')).map(c => c.nome);
        const pessoas = (await SD.colunasListar('pessoas')).map(c => c.nome);
        // Então
        expect(contratos).toEqual(['Em negociação', 'Aguardando assinatura', 'Assinado / em andamento', 'Encerrado', 'Rescindido']);
        expect(pessoas).not.toContain('Assinado / em andamento');
        // Pessoas tem a sua "Em negociação" e a coluna-marco "Contrato fechado" (#269).
        expect(pessoas).toEqual(expect.arrayContaining(['Em negociação', 'Contrato fechado']));
      });
    });

    describe('Do cliente ao contrato (#269)', () => {
      const etapaDe = async (modulo: 'contratos' | 'pessoas', marco: string) => (await SD.colunasListar(modulo)).find(c => c.marco === marco)!.id;

      it('dado uma pessoa em "Contrato fechado", quando fecha o contrato dela, então nasce um contrato em "Aguardando assinatura", uma vez só', async () => {
        // Dado
        const { id } = await criar('FECHADA ' + marca());
        // Quando
        const primeiro = (await SD.pessoaFecharContrato(id))!;
        const deNovo = (await SD.pessoaFecharContrato(id))!;
        // Então
        const k = (await SD.contratoObter(primeiro.id))!;
        expect(primeiro.novo).toBe(true);
        expect(deNovo).toEqual({ id: primeiro.id, codigo: k.codigo, novo: false });
        expect(k.clientes.map(p => p.id)).toEqual([id]);
        expect(k.objetos).toEqual(['A definir']);
        expect(k.etapa_id).toBe(await etapaDe('contratos', 'aguardando_assinatura'));
        expect(k.responsavel_id).toBe('u-master');
        expect(await SD.objetosSugeridos()).not.toContain('A definir');
      });

      it('dado a pessoa como segunda cliente de um contrato feito à mão, quando vai para "Contrato fechado", então fica com ele e não nasce outro', async () => {
        // Dado
        const { id: outra } = await criar('PRIMEIRA ' + marca());
        const { id } = await criar('SEGUNDA ' + marca());
        const aMao = await SD.contratoCriar({ clientes: [outra, id], responsavel_id: 'u-master', objetos: ['Consultoria'], categoria: 'pro_labore' });
        // Quando
        const fechado = (await SD.pessoaFecharContrato(id))!;
        // Então
        expect(fechado).toEqual({ id: aMao.id, codigo: aMao.codigo, novo: false });
      });

      it('dado o contrato que nasceu da pessoa arquivado, quando ela volta a "Contrato fechado", então nasce outro', async () => {
        // Dado
        const { id } = await criar('VOLTOU ' + marca());
        const primeiro = (await SD.pessoaFecharContrato(id))!;
        await SD.contratosArquivar([primeiro.id]);
        // Quando
        const segundo = (await SD.pessoaFecharContrato(id))!;
        // Então
        expect(segundo.novo).toBe(true);
        expect(segundo.id).not.toBe(primeiro.id);
      });

      it('dado o contrato com "A definir", quando é assinado e depois ganha os objetos, então as demandas nascem só dos objetos de verdade, com as tarefas do modelo', async () => {
        // Dado
        const { id } = await criar('ASSINA ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        const itemGrande = 'Depósito ' + 'x'.repeat(TAMANHO_TAREFA.titulo);
        await SD.modeloCriar('Registro de marca ' + id, arvoreDosItens(['Busca prévia', itemGrande]));
        // Quando
        await SD.contratoMover(contratoId, await etapaDe('contratos', 'assinado'), 1);
        const antes = await SD.demandasDoContrato(contratoId);
        await SD.contratoAtualizar(contratoId, { objetos: ['Registro de marca ' + id] });
        // Então: o título da tarefa fica no tamanho dela, como no banco
        const depois = await SD.demandasDoContrato(contratoId);
        const tarefas = await SD.tarefasDoContrato(contratoId);
        expect(antes).toHaveLength(0);
        expect(depois.map(d => d.objeto)).toEqual(['Registro de marca ' + id]);
        expect(tarefas.map(t => t.titulo).toSorted((a, b) => a.localeCompare(b))).toEqual(['Busca prévia', itemGrande.slice(0, TAMANHO_TAREFA.titulo)]);
      });

      it('dado um modelo com grupos (#309), quando o contrato assinado ganha o objeto, então só os itens viram tarefas, sem o nome do grupo', async () => {
        // Dado
        const { id } = await criar('AGRUPADO ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        await SD.modeloCriar('Benefício ' + id, [{ texto: 'Documentos pessoais', filhos: [{ texto: 'RG' }, { texto: 'CPF' }] }, { texto: 'CNIS' }]);
        // Quando
        await SD.contratoMover(contratoId, await etapaDe('contratos', 'assinado'), 1);
        await SD.contratoAtualizar(contratoId, { objetos: ['Benefício ' + id] });
        // Então
        const tarefas = await SD.tarefasDoContrato(contratoId);
        expect(tarefas.map(t => t.titulo).toSorted((a, b) => a.localeCompare(b))).toEqual(['CNIS', 'CPF', 'RG']);
      });

      it('dado um contrato assinado com um objeto de verdade e um "A definir", quando o "A definir" é trocado, então só o novo vira demanda', async () => {
        // Dado
        const { id } = await criar('MISTO ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        await SD.contratoAtualizar(contratoId, { objetos: ['A definir', 'Oposição ' + id] });
        await SD.contratoMover(contratoId, await etapaDe('contratos', 'assinado'), 1);
        // Quando
        await SD.contratoAtualizar(contratoId, { objetos: ['Registro ' + id, 'Oposição ' + id] });
        // Então
        expect((await SD.demandasDoContrato(contratoId)).map(d => d.objeto ?? '').toSorted((a, b) => a.localeCompare(b))).toEqual(['Oposição ' + id, 'Registro ' + id]);
        // Quando: já sem "A definir", alguém corrige o nome de um objeto
        await SD.contratoAtualizar(contratoId, { objetos: ['Registro de marca ' + id, 'Oposição ' + id] });
        // Então: nenhuma demanda nova (como antes)
        expect(await SD.demandasDoContrato(contratoId)).toHaveLength(2);
      });

      it('dado um contrato ainda não assinado, quando a demanda de um objeto é criada na hora (#349), então ela nasce ligada ao objeto e não se repete na assinatura', async () => {
        // Dado
        const { id } = await criar('NA HORA ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        await SD.contratoAtualizar(contratoId, { objetos: ['Registro ' + id, 'Oposição ' + id, 'A definir'] });
        await SD.modeloCriar('Registro ' + id, arvoreDosItens(['Busca prévia']));
        // Quando: o objeto escrito em minúsculas e com espaços
        const criada = await SD.contratoCriarDemanda(contratoId, '  ' + ('Registro ' + id).toLowerCase() + ' ');
        // Então
        const ligadas = await SD.demandasDoContrato(contratoId);
        expect(ligadas.map(d => [d.id, d.objeto, d.titulo])).toEqual([[criada.id, 'Registro ' + id, 'Registro ' + id]]);
        expect(ligadas[0].etapa_id).toBe((await SD.colunasListar('demandas')).find(c => c.marco === 'inicio')!.id);
        expect((await SD.tarefasDoContrato(contratoId)).map(t => t.titulo)).toEqual(['Busca prévia']);
        await expect(SD.contratoCriarDemanda(contratoId, 'Registro ' + id)).rejects.toThrow('Este objeto já tem uma demanda.');
        await expect(SD.contratoCriarDemanda(contratoId, 'A definir')).rejects.toThrow('Este objeto não está no contrato.');
        await expect(SD.contratoCriarDemanda(contratoId, 'Outro ' + id)).rejects.toThrow('Este objeto não está no contrato.');
        // Quando: o contrato chega à coluna de assinados
        await SD.contratoMover(contratoId, await etapaDe('contratos', 'assinado'), 1);
        // Então: só o objeto que faltava ganha a demanda dele
        expect((await SD.demandasDoContrato(contratoId)).map(d => d.objeto ?? '').toSorted((a, b) => a.localeCompare(b))).toEqual(['Oposição ' + id, 'Registro ' + id]);
      });

      it('dado o início das negociações no cadastro (#311), quando o contrato é lido, então a data vem no cartão, na tabela e no histórico', async () => {
        // Dado
        const { id: cliente } = await criar('NEGOCIA ' + marca());
        const k = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Consultoria'], categoria: 'pro_labore', negociacao_inicio: '2026-02-01' });
        // Quando
        await SD.contratoAtualizar(k.id, { negociacao_inicio: '2026-02-05' });
        // Então
        expect((await SD.contratoVer(k.id))!.negociacao_inicio).toBe('2026-02-05');
        expect((await SD.contratosListar({ termo: k.codigo })).linhas[0].negociacao_inicio).toBe('2026-02-05');
        expect((await SD.contratoHistorico(k.id))[0].alteracoes.negociacao_inicio).toEqual({ de: '2026-02-01', para: '2026-02-05' });
      });

      it('dado demandas com e sem contrato (#311), quando o filtro pede "Sem contrato", então vêm só as sem contrato', async () => {
        // Dado
        const id = marca();
        const k = await SD.contratoCriar({ clientes: [(await criar('COM DEMANDA ' + id)).id], responsavel_id: 'u-master', objetos: ['Recurso ' + id], categoria: 'pro_labore' });
        await SD.contratoCriarDemanda(k.id, 'Recurso ' + id);
        await SD.demandaCriar({ titulo: 'Avulsa ' + id, responsavel_id: 'u-master' });
        // Quando
        const sem = await SD.demandasListar({ termo: id, contrato: 'sem' });
        const todas = await SD.demandasListar({ termo: id });
        // Então
        expect(sem.linhas.map(d => d.titulo)).toEqual(['Avulsa ' + id]);
        expect(todas.total).toBe(2);
      });

      it('dado um contrato arquivado, quando se pede a demanda de um objeto, então é recusado', async () => {
        // Dado
        const k = await SD.contratoCriar({ clientes: [(await criar('ARQUIVADO ' + marca())).id], responsavel_id: 'u-master', objetos: ['Recurso'], categoria: 'pro_labore' });
        await SD.contratosArquivar([k.id]);
        // Então
        await expect(SD.contratoCriarDemanda(k.id, 'Recurso')).rejects.toThrow('Este contrato está arquivado. Desarquive para criar a demanda.');
      });

      it('dado a conta de destino escolhida no contrato, quando o contrato é lido, então ela vem junto, e as contas aparecem para escolher', async () => {
        // Dado
        const { id } = await criar('CONTA ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        const conta = await SD.financeiroContaCriar({ nome: 'PJ ' + id, tem_das: true, saldo_inicial: 0, saldo_inicial_em: '2026-01-01' });
        // Quando
        await SD.contratoAtualizar(contratoId, { conta_destino_id: conta.id });
        // Então
        expect((await SD.contratoObter(contratoId))!.conta_destino_id).toBe(conta.id);
        expect((await SD.contasParaEscolher()).map(c => c.nome)).toContain('PJ ' + id);
      });

      it('dado uma conta arquivada, quando alguém a escolhe como destino do contrato, então é recusado', async () => {
        // Dado
        const { id } = await criar('ARQUIVADA ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        const conta = await SD.financeiroContaCriar({ nome: 'PF ' + id, tem_das: false, saldo_inicial: 0, saldo_inicial_em: '2026-01-01' });
        await SD.financeiroContaAtualizar(conta.id, { arquivada_em: new Date().toISOString() });
        // Quando
        const gravar = SD.contratoAtualizar(contratoId, { conta_destino_id: conta.id });
        // Então
        await expect(gravar).rejects.toThrow('Escolha uma conta ativa do escritório para o dinheiro deste contrato.');
        expect((await SD.contasParaEscolher()).map(c => c.nome)).not.toContain('PF ' + id);
      });
    });

    describe('Menções de itens pelo código, com ! (#297)', () => {
      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      afterEach(() => entrarComo('u-master'));

      it('dado uma demanda ativa e uma arquivada, quando os códigos são consultados, então vem só o que quem lê vê, com o título e o arquivamento', async () => {
        // Dado: as duas só do master (o Bruno não está nelas)
        const titulo = 'MENCAO ' + Math.random().toString(36).slice(2, 8).toUpperCase();
        const ativa = await SD.demandaCriar({ titulo, responsavel_id: 'u-master' });
        const arquivada = await SD.demandaCriar({ titulo: titulo + ' ARQUIVADA', responsavel_id: 'u-master' });
        await SD.demandasArquivar([arquivada.id]);
        const codigos = [ativa.codigo.toLowerCase(), arquivada.codigo, 'FFFF0000'];
        // Quando
        const doMaster = await SD.itensMencionados(codigos);
        entrarComo('u-bruno');
        const doBruno = await SD.itensMencionados(codigos);
        // Então
        expect(doMaster.map(i => [i.modulo, i.id, i.nome, !!i.arquivado_em])).toEqual(expect.arrayContaining([
          ['demandas', arquivada.id, titulo + ' ARQUIVADA', true], ['demandas', ativa.id, titulo, false]
        ]));
        expect(doMaster).toHaveLength(2);
        expect(doBruno.map(i => i.id)).not.toContain(ativa.id);
        expect(doBruno.map(i => i.id)).not.toContain(arquivada.id);
        expect(await SD.itensMencionados([])).toEqual([]);
      });

      it('dado uma tarefa e um contrato, quando a lista do ! busca pelo começo do código ou do número, então eles vêm na busca de ligar', async () => {
        // Dado
        const tarefa = await SD.tarefaCriar({ titulo: 'MENCAO PELO CODIGO ' + marca(), responsavel_id: 'u-master' });
        const { id: cliente } = await criar(marca());
        const contrato = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
        const [sigla, numero] = contrato.codigo.split('-');
        // Quando: o que a pessoa digita depois do !, como a caixa de comentário manda para a busca
        const pelaTarefa = await SD.itensParaLigar('tarefas', tarefa.codigo.slice(0, 6).toLowerCase());
        const peloComecoDoNumero = await SD.itensParaLigar('contratos', `${sigla}-${numero}`);
        const peloNumeroInteiro = await SD.itensParaLigar('contratos', contrato.codigo);
        // Então
        expect(pelaTarefa.map(i => [i.id, i.codigo])).toContainEqual([tarefa.id, tarefa.codigo]);
        expect(peloComecoDoNumero.map(i => i.id)).toContain(contrato.id);
        expect(peloNumeroInteiro.map(i => [i.id, i.codigo])).toContainEqual([contrato.id, contrato.codigo]);
      });
    });

    describe('Apagar e corrigir os registros de tempo (#400)', () => {
      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      afterEach(() => entrarComo('u-master'));
      /** Uma tarefa do master com o Bruno, e um período contado de cada um. */
      async function tarefaComTempo() {
        const tarefa = await SD.tarefaCriar({ titulo: 'TEMPO ' + marca(), responsavel_id: 'u-master', participantes: ['u-bruno'] });
        const inicio = new Date(Date.now() - DIA).toISOString();
        const doMaster = await SD.tempoIniciar(tarefa.id, inicio, 3600);
        entrarComo('u-bruno');
        const doBruno = await SD.tempoIniciar(tarefa.id, inicio, 1800);
        entrarComo('u-master');
        return { tarefa, doMaster, doBruno, inicio };
      }

      it('dado o próprio registro, quando a pessoa o corrige com o motivo, então a duração, o dia e o total mudam, e a correção vai ao histórico', async () => {
        // Dado
        const { tarefa, doBruno } = await tarefaComTempo();
        entrarComo('u-bruno');
        const outroDia = new Date(Date.now() - 2 * DIA).toISOString();
        // Quando
        await SD.tempoCorrigir(doBruno, { segundos: 600, inicio: outroDia, motivo: ' Contei o almoço ' });
        const tempo = await SD.tempoDaTarefa(tarefa.id);
        // Então: o Bruno vê só o dele, já corrigido
        expect(tempo.registros).toEqual([expect.objectContaining({ id: doBruno, segundos: 600, inicio: outroDia, motivo_da_correcao: 'Contei o almoço' })]);
        expect(tempo.registros[0].corrigido_em).not.toBeNull();
        expect(tempo.total).toBe(3600 + 600);
        const [ultima] = await SD.tarefaHistorico(tarefa.id);
        expect(String(ultima.alteracoes.tempo.para)).toMatch(/^Corrigido o tempo contado de Bruno Exemplo Souza, de .*\. Motivo: Contei o almoço$/);
      });

      it('dado o registro de outra pessoa, quando quem não é administrador tenta corrigir ou apagar, então é recusado e nada muda', async () => {
        // Dado
        const { tarefa, doMaster } = await tarefaComTempo();
        entrarComo('u-bruno');
        // Quando / Então
        await expect(SD.tempoCorrigir(doMaster, { segundos: 60, inicio: new Date().toISOString(), motivo: 'Não é meu' })).rejects.toThrow(/Só quem registrou o tempo/);
        await expect(SD.tempoApagar(doMaster)).rejects.toThrow(/Só quem registrou o tempo/);
        entrarComo('u-master');
        expect((await SD.tempoDaTarefa(tarefa.id)).total).toBe(3600 + 1800);
      });

      it('dado um administrador, quando apaga o registro de outra pessoa e desfaz, então ele sai do total e volta igual, com o histórico', async () => {
        // Dado
        const { tarefa, doBruno, inicio } = await tarefaComTempo();
        const registro = (await SD.tempoDaTarefa(tarefa.id)).registros.find(r => r.id === doBruno)!;
        // Quando
        await SD.tempoApagar(doBruno);
        const depoisDeApagar = await SD.tempoDaTarefa(tarefa.id);
        const devolvido = await SD.tempoDevolver(tarefa.id, registro);
        const depoisDeDevolver = await SD.tempoDaTarefa(tarefa.id);
        // Então
        expect(depoisDeApagar.total).toBe(3600);
        expect(depoisDeApagar.registros.map(r => r.id)).not.toContain(doBruno);
        expect(depoisDeDevolver.total).toBe(3600 + 1800);
        expect(depoisDeDevolver.registros).toContainEqual(expect.objectContaining({ id: devolvido, perfil_id: 'u-bruno', inicio, segundos: 1800, ajuste: false }));
        const historico = (await SD.tarefaHistorico(tarefa.id)).map(h => String(h.alteracoes.tempo?.para ?? ''));
        expect(historico.filter(t => /^(Apagado|Devolvido) o tempo contado de Bruno Exemplo Souza/.test(t))).toHaveLength(2);
        expect(historico.join(' ')).not.toMatch(/30 min|1800/);
      });

      it('dado um registro mudado, quando é apagado e devolvido, então volta como registro novo, sem a mudança (como o banco)', async () => {
        // Dado
        const { tarefa, doBruno } = await tarefaComTempo();
        await SD.tempoCorrigir(doBruno, { segundos: 900, inicio: new Date().toISOString(), motivo: 'Contei o almoço' });
        const mudado = (await SD.tempoDaTarefa(tarefa.id)).registros.find(r => r.id === doBruno)!;
        // Quando
        await SD.tempoApagar(doBruno);
        const devolvido = await SD.tempoDevolver(tarefa.id, mudado);
        // Então
        expect((await SD.tempoDaTarefa(tarefa.id)).registros.find(r => r.id === devolvido))
          .toMatchObject({ segundos: 900, corrigido_em: null, motivo_da_correcao: null });
      });

      it('quando o motivo da mudança passa do tamanho que o banco aceita, então é recusado e nada muda', async () => {
        // Dado
        const { tarefa, doBruno } = await tarefaComTempo();
        // Quando
        const mudar = SD.tempoCorrigir(doBruno, { segundos: 60, inicio: new Date().toISOString(), motivo: 'x'.repeat(TAMANHO_MOTIVO + 1) });
        // Então
        await expect(mudar).rejects.toThrow('Algum campo está em formato inválido. Confira os dados e tente de novo.');
        expect((await SD.tempoDaTarefa(tarefa.id)).total).toBe(3600 + 1800);
      });

      it('dado o período que o cronômetro conta, quando outra pessoa o muda ou apaga, então o cronômetro não grava mais nele (abre outro)', async () => {
        // Dado
        const { tarefa, doBruno } = await tarefaComTempo();
        const id = await SD.tempoIniciar(tarefa.id, new Date().toISOString(), 60);
        // Quando: o próprio cronômetro grava; depois o master (administrador) muda o do Bruno e apaga o outro
        const gravouAntes = await SD.tempoGravar(id, 120);
        entrarComo('u-bruno');
        const doBrunoAntes = await SD.tempoGravar(doBruno, 1900);
        entrarComo('u-master');
        await SD.tempoCorrigir(doBruno, { segundos: 600, inicio: new Date().toISOString(), motivo: 'Revisão' });
        await SD.tempoApagar(id);
        entrarComo('u-bruno');
        const noCorrigido = await SD.tempoGravar(doBruno, 1960);
        entrarComo('u-master');
        const noApagado = await SD.tempoGravar(id, 180);
        // Então
        expect([gravouAntes, doBrunoAntes, noCorrigido, noApagado]).toEqual([true, true, false, false]);
        const tempo = await SD.tempoDaTarefa(tarefa.id);
        expect(tempo.registros.find(r => r.id === doBruno)!.segundos).toBe(600);
        expect(tempo.total).toBe(3600 + 600);
      });
    });

    describe('Caixa de mensagens (#112)', () => {
      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      const marcaMsg = () => 'MSG ' + Math.random().toString(36).slice(2);
      afterEach(() => entrarComo('u-master'));
      const novaPessoa = async () => (await SD.pessoaCriar({ tipo: 'contato', nome: marcaMsg() })).id;

      it('dado um comentário que marca a Ana, quando ela abre a caixa, então a mensagem vem não lida, com o cartão e o comentário', async () => {
        // Dado
        const pessoa = await novaPessoa();
        const c = await SD.comentarioCriar('pessoas', pessoa, 'Ligar, @ana.lima');
        // Quando
        entrarComo('u-ana');
        const [m] = await SD.mensagensListar();
        // Então
        expect(await SD.mensagensNaoLidas()).toBeGreaterThan(0);
        expect(m.lido_em).toBeNull();
        expect(m.comentario).toMatchObject({ id: c.id, autor_id: 'u-master', texto: 'Ligar, @ana.lima', modulo: 'pessoas', cartao_id: pessoa });
      });

      it('dado o Bruno marcado numa demanda, quando sai dela, então a mensagem continua, mas sem o texto, e ainda dá para marcar como lida', async () => {
        // Dado
        const { id: demanda } = await SD.demandaCriar({ titulo: marcaMsg(), responsavel_id: 'u-ana', colaboradores: ['u-bruno'] });
        const c = await SD.comentarioCriar('demandas', demanda, 'Veja, @bruno.souza');
        entrarComo('u-bruno');
        await SD.mensagensMarcarTodasLidas();
        entrarComo('u-master');
        await SD.comentarioEditar(c.id, 'Veja, @bruno.souza, por favor');
        const outro = await SD.comentarioCriar('demandas', demanda, 'Outra, @bruno.souza');
        // Quando
        await SD.demandaAtualizar(demanda, { colaboradores: [] });
        entrarComo('u-bruno');
        const lista = await SD.mensagensListar();
        // Então: sem acesso ao cartão, nada do comentário aparece
        expect(lista.map(m => m.comentario?.id)).not.toContain(outro.id);
        const semAcesso = lista.filter(m => !m.comentario && !m.lido_em);
        expect(semAcesso).toHaveLength(1);
        await SD.mensagemMarcarLida(semAcesso[0].id);
        expect(await SD.mensagensNaoLidas()).toBe(0);
      });

      it('dado que quem escreveu se marcou, quando abre a caixa, então não recebe a própria menção', async () => {
        // Dado
        const antes = (await SD.mensagensListar()).length;
        // Quando
        await SD.comentarioCriar('pessoas', await novaPessoa(), 'Lembrete, @mauro.duarte');
        // Então
        expect(await SD.mensagensListar()).toHaveLength(antes);
      });

      it('dado a mensagem da Ana, quando outra pessoa abre a caixa, então não a vê', async () => {
        // Dado
        const c = await SD.comentarioCriar('pessoas', await novaPessoa(), 'Veja, @ana.lima');
        // Quando
        entrarComo('u-bruno');
        const lista = await SD.mensagensListar();
        // Então
        expect(lista.map(m => m.comentario?.id)).not.toContain(c.id);
      });

      it('dado duas mensagens, quando marca uma e depois todas como lidas, então o contador vai caindo até zerar', async () => {
        // Dado
        const pessoa = await novaPessoa();
        entrarComo('u-ana'); await SD.mensagensMarcarTodasLidas(); entrarComo('u-master');
        await SD.comentarioCriar('pessoas', pessoa, 'Um, @ana.lima');
        await SD.comentarioCriar('pessoas', pessoa, 'Dois, @ana.lima');
        entrarComo('u-ana');
        // Quando
        await SD.mensagemMarcarLida((await SD.mensagensListar())[0].id);
        const depoisDeUma = await SD.mensagensNaoLidas();
        await SD.mensagensMarcarTodasLidas();
        // Então
        expect(depoisDeUma).toBe(1);
        expect(await SD.mensagensNaoLidas()).toBe(0);
      });

      it('dado o comentário editado, quando troca quem foi marcado, então a mensagem muda de pessoa; e apagar o comentário apaga a mensagem', async () => {
        // Dado
        const { id } = await SD.comentarioCriar('pessoas', await novaPessoa(), 'Para @ana.lima');
        // Quando
        await SD.comentarioEditar(id, 'Para @bruno.souza');
        entrarComo('u-ana');
        const daAna = (await SD.mensagensListar()).map(m => m.comentario?.id);
        entrarComo('u-bruno');
        const doBruno = (await SD.mensagensListar()).map(m => m.comentario?.id);
        entrarComo('u-master');
        await SD.comentarioExcluir(id);
        entrarComo('u-bruno');
        // Então
        expect(daAna).not.toContain(id);
        expect(doBruno).toContain(id);
        expect((await SD.mensagensListar()).map(m => m.comentario?.id)).not.toContain(id);
      });
    });

    describe('Avisos de prazo (#113)', () => {
      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      /** A rotina diária, que no banco de verdade roda sozinha. */
      const rotina = (hoje?: string) => (window as unknown as { SEMPER_FALSO: { gerarAvisosDePrazo(hoje?: string): void } }).SEMPER_FALSO.gerarAvisosDePrazo(hoje);
      afterEach(() => entrarComo('u-master'));
      const HOJE = '2031-03-10', EM_3_DIAS = '2031-03-13', EM_4_DIAS = '2031-03-14';
      const nome = () => 'AVISO ' + Math.random().toString(36).slice(2);
      const avisosDe = async (titulo: string) => (await SD.mensagensListar()).filter(m => m.prazo?.titulo === titulo);

      it('dado tarefas que vencem hoje, em 3 e em 4 dias, quando a rotina roda, então o responsável recebe os avisos dos dois primeiros', async () => {
        // Dado
        const [hoje, perto, longe] = [nome(), nome(), nome()];
        await SD.tarefaCriar({ titulo: hoje, prazo: HOJE, responsavel_id: 'u-ana' });
        await SD.tarefaCriar({ titulo: perto, prazo: EM_3_DIAS, responsavel_id: 'u-ana' });
        await SD.tarefaCriar({ titulo: longe, prazo: EM_4_DIAS, responsavel_id: 'u-ana' });
        // Quando
        rotina(HOJE);
        entrarComo('u-ana');
        // Então
        const [aviso] = await avisosDe(hoje);
        expect(aviso.tipo).toBe('prazo');
        expect(aviso.lido_em).toBeNull();
        expect(aviso.comentario).toBeNull();
        expect(aviso.prazo).toMatchObject({ modulo: 'tarefas', pagina: 'tarefas', data: HOJE });
        expect(await avisosDe(perto)).toHaveLength(1);
        expect(await avisosDe(longe)).toHaveLength(0);
      });

      it('dado um aviso criado, quando a rotina roda de novo, então ele não se repete', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-ana' });
        rotina(HOJE);
        // Quando
        rotina(HOJE);
        entrarComo('u-ana');
        // Então
        expect(await avisosDe(titulo)).toHaveLength(1);
      });

      it('dado um aviso, quando outra pessoa abre a caixa, então não o vê', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-ana' });
        // Quando
        rotina(HOJE);
        entrarComo('u-bruno');
        // Então
        expect(await avisosDe(titulo)).toHaveLength(0);
      });

      it('dado um aviso de 3 dias não lido, quando chega o dia, então fica só o aviso do dia', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: EM_3_DIAS, responsavel_id: 'u-ana' });
        rotina(HOJE);
        // Quando
        rotina(EM_3_DIAS);
        entrarComo('u-ana');
        // Então
        expect(await avisosDe(titulo)).toHaveLength(1);
      });

      it('dado um aviso de 3 dias já lido, quando chega o dia, então vem o aviso do dia e o lido fica no histórico', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: EM_3_DIAS, responsavel_id: 'u-ana' });
        rotina(HOJE);
        entrarComo('u-ana');
        await SD.mensagemMarcarLida((await avisosDe(titulo))[0].id);
        // Quando
        rotina(EM_3_DIAS);
        // Então
        const avisos = await avisosDe(titulo);
        expect(avisos).toHaveLength(2);
        expect(avisos.filter(m => !m.lido_em)).toHaveLength(1);
      });

      it('dado um aviso não lido de uma tarefa arquivada, quando a rotina roda, então ele sai da caixa', async () => {
        // Dado
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-master' });
        rotina(HOJE);
        expect(await avisosDe(titulo)).toHaveLength(1);
        // Quando
        await SD.tarefasArquivar([id], true);
        rotina(HOJE);
        // Então
        expect(await avisosDe(titulo)).toHaveLength(0);
      });

      it('dado uma tarefa de quem está desativado, quando a rotina roda, então não cria aviso', async () => {
        // Dado: a Carla está desativada
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-carla' });
        // Quando
        rotina(HOJE);
        entrarComo('u-carla');
        // Então
        expect(await avisosDe(titulo)).toHaveLength(0);
      });

      it('dado um aviso de prazo que passou há mais de 30 dias, quando a rotina roda, então ele sai da caixa', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-master' });
        rotina(HOJE);
        // Quando
        rotina('2031-05-01');
        // Então
        expect(await avisosDe(titulo)).toHaveLength(0);
      });

      it('dado um aviso lido de uma tarefa arquivada, quando abre a caixa, então ele fica no histórico e diz que foi arquivada', async () => {
        // Dado
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-master' });
        rotina(HOJE);
        await SD.mensagemMarcarLida((await avisosDe(titulo))[0].id);
        // Quando
        await SD.tarefasArquivar([id], true);
        rotina(HOJE);
        // Então
        const [aviso] = await avisosDe(titulo);
        expect(aviso.prazo?.parado).toBe('arquivado');
      });

      it('dado um aviso de uma tarefa, quando o prazo muda, então o aviso mostra a data atual do cartão', async () => {
        // Dado
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-master' });
        rotina(HOJE);
        await SD.mensagemMarcarLida((await avisosDe(titulo))[0].id);
        // Quando
        await SD.tarefaAtualizar(id, { titulo, prazo: EM_4_DIAS, responsavel_id: 'u-master' });
        // Então
        expect((await avisosDe(titulo))[0].prazo).toMatchObject({ data: EM_4_DIAS, concluido: false });
      });

      it('dado um aviso, quando é marcado como lido, então o contador de não lidas cai', async () => {
        // Dado
        await SD.mensagensMarcarTodasLidas();
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: HOJE, responsavel_id: 'u-master' });
        rotina(HOJE);
        const antes = await SD.mensagensNaoLidas();
        // Quando
        await SD.mensagemMarcarLida((await avisosDe(titulo))[0].id);
        // Então
        expect(await SD.mensagensNaoLidas()).toBe(antes - 1);
      });
    });

    describe('Data de início de tarefas e demandas (#357)', () => {
      const nome = () => 'INICIO ' + Math.random().toString(36).slice(2);

      it('quando uma tarefa e uma demanda são criadas sem a data de início, então começam hoje (Brasília), no cartão e nas listas', async () => {
        // Dado
        const titulo = nome();
        // Quando
        const t = await SD.tarefaCriar({ titulo, responsavel_id: 'u-master' });
        const d = await SD.demandaCriar({ titulo, responsavel_id: 'u-master' });
        // Então
        const tarefa = (await SD.tarefaObter(t.id))!, demanda = (await SD.demandaObter(d.id))!;
        expect(tarefa.data_inicio).toBe(inicioDoCriadoEm(tarefa.criado_em));
        expect(demanda.data_inicio).toBe(inicioDoCriadoEm(demanda.criado_em));
        expect((await SD.tarefasListar({ termo: titulo })).linhas[0].data_inicio).toBe(tarefa.data_inicio);
        expect((await SD.demandasListar({ termo: titulo })).linhas[0].data_inicio).toBe(demanda.data_inicio);
      });

      it('quando a data de início muda, então o cartão a mostra e o histórico guarda a de antes e a nova', async () => {
        // Dado
        const t = await SD.tarefaCriar({ titulo: nome(), responsavel_id: 'u-master' });
        const d = await SD.demandaCriar({ titulo: nome(), responsavel_id: 'u-master' });
        const antes = (await SD.tarefaObter(t.id))!.data_inicio;
        // Quando
        await SD.tarefaAtualizar(t.id, { data_inicio: '2030-01-15' });
        await SD.demandaAtualizar(d.id, { data_inicio: '2030-02-01' });
        // Então
        expect((await SD.tarefaObter(t.id))!.data_inicio).toBe('2030-01-15');
        expect((await SD.demandaObter(d.id))!.data_inicio).toBe('2030-02-01');
        expect((await SD.tarefaHistorico(t.id))[0].alteracoes.data_inicio).toEqual({ de: antes, para: '2030-01-15' });
        expect((await SD.demandaHistorico(d.id))[0].alteracoes.data_inicio.para).toBe('2030-02-01');
      });

      it('quando a data de início fica vazia, então é recusada, como no banco', async () => {
        // Dado
        const t = await SD.tarefaCriar({ titulo: nome(), responsavel_id: 'u-master' });
        // Então
        await expect(SD.tarefaAtualizar(t.id, { data_inicio: '' })).rejects.toThrow(INICIO_VAZIO);
      });

      it('quando a lista é filtrada e ordenada pela data de início, então só vêm as do período, na ordem do início', async () => {
        // Dado
        const titulo = nome();
        const ids: Record<string, string> = {};
        for (const [qual, inicio] of [['meio', '2031-03-10'], ['antes', '2031-03-01'], ['fora', '2031-05-01'], ['depois', '2031-03-20']]) {
          ids[qual] = (await SD.tarefaCriar({ titulo: `${titulo} ${qual}`, responsavel_id: 'u-master', data_inicio: inicio })).id;
          await SD.demandaCriar({ titulo: `${titulo} ${qual}`, responsavel_id: 'u-master', data_inicio: inicio });
        }
        const filtro = { termo: titulo, inicioDesde: '2031-03-01', inicioAte: '2031-03-31' };
        // Quando
        const tarefas = await SD.tarefasListar({ ...filtro, ordem: 'inicio' });
        const tarefasAoContrario = await SD.tarefasListar({ ...filtro, ordem: 'inicio_desc' });
        const demandas = await SD.demandasListar({ ...filtro, ordem: 'inicio' });
        const naColuna = await SD.tarefasDaEtapa(null, { ...filtro, ordem: 'inicio', situacao: 'ativas' });
        // Então
        expect(tarefas.linhas.map(x => x.id)).toEqual([ids.antes, ids.meio, ids.depois]);
        expect(tarefasAoContrario.linhas.map(x => x.id)).toEqual([ids.depois, ids.meio, ids.antes]);
        expect(demandas.linhas.map(x => x.data_inicio)).toEqual(['2031-03-01', '2031-03-10', '2031-03-20']);
        expect(naColuna.linhas.map(x => x.id)).toEqual([ids.antes, ids.meio, ids.depois]);
      });
    });

    describe('Hora e lembrete dos prazos (#286)', () => {
      type Falso = { entrarComo(id: string): void; gerarLembretes(quando?: string): void; gerarAvisosDePrazo(hoje?: string): void };
      const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
      afterEach(() => falso().entrarComo('u-master'));
      // Um prazo às 14h de 15/11/2030, no relógio de Brasília.
      const PRAZO = '2030-11-15';
      const em = (hora: string, dia = PRAZO) => `${dia}T${hora}:00-03:00`;
      const nome = () => 'LEMBRETE ' + Math.random().toString(36).slice(2);
      const lembretesDe = async (titulo: string) => (await SD.mensagensListar()).filter(m => m.prazo?.titulo === titulo && m.prazo.aviso === 'lembrete');
      const hora = (h: string | null | undefined) => h ? h.slice(0, 5) : null;

      it('quando uma tarefa é gravada com hora e lembrete, então volta com os dois, nas listas e no histórico', async () => {
        // Dado
        const titulo = nome();
        // Quando
        const { id } = await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        await SD.tarefaAtualizar(id, { prazo_hora: '16:30', lembrete: 1440 });
        // Então
        const t = (await SD.tarefaObter(id))!;
        expect([hora(t.prazo_hora), t.lembrete]).toEqual(['16:30', 1440]);
        const [linha] = (await SD.tarefasListar({ termo: titulo })).linhas;
        expect(hora(linha.prazo_hora)).toBe('16:30');
        const [ultima] = await SD.tarefaHistorico(id);
        expect(hora(String(ultima.alteracoes.prazo_hora.para))).toBe('16:30');
        expect(ultima.alteracoes.lembrete).toEqual({ de: 60, para: 1440 });
      });

      it('quando uma demanda é gravada com hora e lembrete, então volta com os dois, e a agenda mostra a hora', async () => {
        // Dado
        const titulo = nome();
        // Quando
        const { id } = await SD.demandaCriar({ titulo, prazo: PRAZO, prazo_hora: '09:15', lembrete: 0, responsavel_id: 'u-master' });
        // Então
        const d = (await SD.demandaObter(id))!;
        expect([hora(d.prazo_hora), d.lembrete]).toEqual(['09:15', 0]);
        const [naAgenda] = await SD.prazosDoPeriodo(PRAZO, PRAZO, { termo: titulo });
        expect(hora(naAgenda.hora)).toBe('09:15');
      });

      it('dado um lembrete fora das opções, quando grava, então é recusado como no banco', async () => {
        // Quando / Então
        await expect(SD.tarefaCriar({ titulo: nome(), prazo: PRAZO, lembrete: 45 as unknown as 60, responsavel_id: 'u-master' }))
          .rejects.toThrow('Algum campo está em formato inválido');
      });

      it('dado uma tarefa com lembrete de 1 hora, quando a rotina roda antes, na hora e depois da tolerância, então só a do meio cria o lembrete', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        // Quando / Então
        falso().gerarLembretes(em('12:59'));
        expect(await lembretesDe(titulo)).toHaveLength(0);
        falso().gerarLembretes(em('13:00'));
        const [m] = await lembretesDe(titulo);
        expect(m.lido_em).toBeNull();
        expect(m.prazo).toMatchObject({ modulo: 'tarefas', data: PRAZO, hora: '14:00', aviso: 'lembrete', antecedencia: 60 });
      });

      it('dado um prazo que já passou da tolerância, quando a rotina roda, então o lembrete não chega', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 0, responsavel_id: 'u-master' });
        // Quando
        falso().gerarLembretes(em('14:16'));
        // Então
        expect(await lembretesDe(titulo)).toHaveLength(0);
      });

      it('dado um prazo sem hora com lembrete de 1 dia, quando chega às 9h do dia anterior, então o lembrete chega', async () => {
        // Dado
        const titulo = nome();
        await SD.demandaCriar({ titulo, prazo: PRAZO, lembrete: 1440, responsavel_id: 'u-master' });
        // Quando
        falso().gerarLembretes(em('08:59', '2030-11-14'));
        const antes = await lembretesDe(titulo);
        falso().gerarLembretes(em('09:00', '2030-11-14'));
        // Então
        expect(antes).toHaveLength(0);
        expect(await lembretesDe(titulo)).toHaveLength(1);
      });

      it('dado uma tarefa com participantes, quando o lembrete chega, então recebem o responsável e os participantes ativos', async () => {
        // Dado: a Carla está desativada
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 30, responsavel_id: 'u-ana', participantes: ['u-bruno', 'u-carla'] });
        // Quando
        falso().gerarLembretes(em('13:45'));
        // Então
        for (const [quem, quantos] of [['u-ana', 1], ['u-bruno', 1], ['u-carla', 0], ['u-master', 0]] as const) {
          falso().entrarComo(quem);
          expect(await lembretesDe(titulo)).toHaveLength(quantos);
        }
      });

      it('dado um lembrete lido, quando a hora do prazo muda e o novo instante chega, então ele chega de novo, não lido', async () => {
        // Dado
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        falso().gerarLembretes(em('13:00'));
        await SD.mensagemMarcarLida((await lembretesDe(titulo))[0].id);
        // Quando
        await SD.tarefaAtualizar(id, { prazo_hora: '16:00' });
        falso().gerarLembretes(em('15:00'));
        // Então
        const lembretes = await lembretesDe(titulo);
        expect(lembretes).toHaveLength(1);
        expect(lembretes[0].lido_em).toBeNull();
        expect(lembretes[0].prazo?.hora).toBe('16:00');
      });

      it('dado um lembrete lido, quando a hora e o lembrete mudam juntos mantendo o mesmo instante, então ele chega de novo, no topo, com a antecedência nova', async () => {
        // Dado: prazo às 14h com lembrete de 1 hora (chega às 13h)
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        falso().gerarLembretes(em('13:00'));
        const [antes] = await lembretesDe(titulo);
        await SD.mensagemMarcarLida(antes.id);
        // Quando: prazo às 13h30 com lembrete de 30 minutos (também chega às 13h)
        await SD.tarefaAtualizar(id, { prazo_hora: '13:30', lembrete: 30 });
        falso().gerarLembretes(em('13:01'));
        // Então
        const lembretes = await lembretesDe(titulo);
        expect(lembretes).toHaveLength(1);
        expect(lembretes[0]).toMatchObject({ id: antes.id, lido_em: null });
        expect(lembretes[0].prazo).toMatchObject({ hora: '13:30', antecedencia: 30 });
        expect(lembretes[0].criado_em > antes.criado_em).toBe(true);
        expect((await SD.mensagensListar())[0].id).toBe(antes.id);
      });

      it('dado um lembrete que chegou, quando a rotina roda de novo com o mesmo cartão, então não duplica e o lido continua lido', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        falso().gerarLembretes(em('13:00'));
        const [antes] = await lembretesDe(titulo);
        await SD.mensagemMarcarLida(antes.id);
        // Quando
        falso().gerarLembretes(em('13:01'));
        falso().gerarLembretes(em('14:00'));
        // Então
        const lembretes = await lembretesDe(titulo);
        expect(lembretes).toHaveLength(1);
        expect(lembretes[0].id).toBe(antes.id);
        expect(lembretes[0].lido_em).not.toBeNull();
        expect(lembretes[0].criado_em).toBe(antes.criado_em);
      });

      it('dado um lembrete lido, quando o lembrete do cartão muda, então a caixa mostra a antecedência do que chegou até o novo chegar', async () => {
        // Dado: lembrete de 1 hora, que chega às 13h
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        falso().gerarLembretes(em('13:00'));
        await SD.mensagemMarcarLida((await lembretesDe(titulo))[0].id);
        // Quando: o cartão passa a lembrar na hora do prazo, às 14h
        await SD.tarefaAtualizar(id, { lembrete: 0 });
        falso().gerarLembretes(em('13:30'));
        const [noMeio] = await lembretesDe(titulo);
        falso().gerarLembretes(em('14:00'));
        const [depois] = await lembretesDe(titulo);
        // Então
        expect(noMeio.prazo?.antecedencia).toBe(60);
        expect(noMeio.lido_em).not.toBeNull();
        expect(depois.prazo?.antecedencia).toBe(0);
        expect(depois.lido_em).toBeNull();
      });

      it('dado um lembrete não lido, quando o lembrete do cartão muda, então ele sai da caixa até o novo chegar', async () => {
        // Dado
        const titulo = nome();
        const { id } = await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        falso().gerarLembretes(em('13:00'));
        // Quando
        await SD.tarefaAtualizar(id, { lembrete: 0 });
        falso().gerarLembretes(em('13:30'));
        // Então
        expect(await lembretesDe(titulo)).toHaveLength(0);
      });

      it('dado um lembrete não lido, quando a tarefa é concluída, então ele sai da caixa na rotina seguinte', async () => {
        // Dado
        const titulo = nome(), concluida = (await SD.colunasListar('tarefas')).find(c => c.marco === 'concluido')!;
        const { id } = await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 60, responsavel_id: 'u-master' });
        falso().gerarLembretes(em('13:00'));
        // Quando
        await SD.tarefaMover(id, concluida.id, 1);
        falso().gerarLembretes(em('13:01'));
        // Então
        expect(await lembretesDe(titulo)).toHaveLength(0);
      });

      it('dado um lembrete não lido de um participante, quando a rotina dos avisos de prazo roda, então ela não o apaga', async () => {
        // Dado
        const titulo = nome();
        await SD.tarefaCriar({ titulo, prazo: PRAZO, prazo_hora: '14:00', lembrete: 1440, responsavel_id: 'u-ana', participantes: ['u-bruno'] });
        falso().gerarLembretes(em('14:00', '2030-11-14'));
        // Quando
        falso().gerarAvisosDePrazo('2030-11-14');
        // Então
        falso().entrarComo('u-bruno');
        expect(await lembretesDe(titulo)).toHaveLength(1);
      });
    });

    describe('Comentários', () => {
      // Quem está logado é o Mauro (@mauro.duarte, advogado); a Ana é advogada e o Bruno, estagiário.
      const contratoNovo = async () => {
        const { id: cliente } = await criar(marca());
        return (await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' })).id;
      };

      it('quando alguém comenta no cartão, então o comentário vem no topo, com o autor e as menções achadas no texto', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        await SD.comentarioCriar('pessoas', pessoa, 'Primeiro');
        // Quando
        const novo = await SD.comentarioCriar('pessoas', pessoa, '  Ligar amanhã, @ana.lima. Cópia para @bruno.souza  ');
        // Então
        const lista = await SD.comentariosListar('pessoas', pessoa);
        expect(lista.map(c => c.texto)).toEqual(['Ligar amanhã, @ana.lima. Cópia para @bruno.souza', 'Primeiro']);
        expect(novo).toMatchObject({ autor_id: 'u-master', editado_em: null });
        expect([...novo.mencoes].sort()).toEqual(['u-ana', 'u-bruno']);
      });

      it('quando o comentário está vazio, então salvar é recusado com a mensagem em português', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        // Quando
        const salvar = SD.comentarioCriar('pessoas', pessoa, '   ');
        // Então
        await expect(salvar).rejects.toThrow('Escreva o comentário.');
      });

      it('quando um comentário de contrato menciona quem não é advogado, então salvar é recusado; um advogado pode', async () => {
        // Dado
        const contrato = await contratoNovo();
        // Quando
        const [estagiario, advogada] = await Promise.allSettled([
          SD.comentarioCriar('contratos', contrato, 'Veja isto, @bruno.souza'), SD.comentarioCriar('contratos', contrato, 'Veja isto, @ana.lima')
        ]);
        // Então
        expect(estagiario).toMatchObject({ status: 'rejected', reason: { message: 'Não é possível mencionar Bruno Exemplo Souza em contratos: só advogados podem ser mencionados.' } });
        expect(advogada).toMatchObject({ status: 'fulfilled', value: { mencoes: ['u-ana'] } });
      });

      it('quando o autor edita o comentário, então o texto e as menções mudam, e fica a data da edição', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        const { id } = await SD.comentarioCriar('pessoas', pessoa, 'Falar com @ana.lima');
        // Quando
        await SD.comentarioEditar(id, 'Falar com @bruno.souza');
        // Então
        const [editado] = await SD.comentariosListar('pessoas', pessoa);
        expect(editado).toMatchObject({ texto: 'Falar com @bruno.souza', mencoes: ['u-bruno'] });
        expect(editado.editado_em).not.toBeNull();
      });

      it('quando o comentário é apagado, então ele sai da lista', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        const { id } = await SD.comentarioCriar('pessoas', pessoa, 'Vou apagar');
        // Quando
        await SD.comentarioExcluir(id);
        // Então
        expect(await SD.comentariosListar('pessoas', pessoa)).toEqual([]);
      });

      it('quando o contrato é excluído, então os comentários dele vão junto', async () => {
        // Dado
        const contrato = await contratoNovo();
        await SD.comentarioCriar('contratos', contrato, 'Comentário que vai junto');
        await SD.contratosArquivar([contrato]);
        // Quando
        await SD.contratosExcluir([contrato]);
        // Então
        expect(await SD.comentariosListar('contratos', contrato)).toEqual([]);
      });

      it('quando os comentários de uma pessoa são listados, então não vêm os de outro cartão', async () => {
        // Dado
        const { id: uma } = await criar(marca()), { id: outra } = await criar(marca());
        await SD.comentarioCriar('pessoas', uma, 'Desta pessoa');
        // Quando
        const daOutra = await SD.comentariosListar('pessoas', outra);
        // Então
        expect(daOutra).toEqual([]);
      });

      describe('Nas anotações (#364)', () => {
        const anotacaoNova = (extra: Partial<Parameters<Dados['anotacaoCriar']>[0]> = {}) => SD.anotacaoCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra });

        it('quando alguém comenta numa anotação, então o comentário vem no topo, só dela, e quem foi mencionado recebe a mensagem', async () => {
          // Dado: duas anotações, a Ana numa delas
          const { id } = await anotacaoNova({ participantes: ['u-ana'] }), { id: outra } = await anotacaoNova();
          await SD.comentarioCriar('anotacoes', id, 'Primeiro');
          // Quando
          const novo = await SD.comentarioCriar('anotacoes', id, '  Veja o resumo, @ana.lima  ');
          // Então
          expect((await SD.comentariosListar('anotacoes', id)).map(c => c.texto)).toEqual(['Veja o resumo, @ana.lima', 'Primeiro']);
          expect(novo).toMatchObject({ autor_id: 'u-master', mencoes: ['u-ana'] });
          expect(await SD.comentariosListar('anotacoes', outra)).toEqual([]);
        });

        it('quando o comentário menciona quem não está na anotação, então salvar é recusado com a mensagem do banco; um administrador pode', async () => {
          // Dado
          const { id } = await anotacaoNova();
          // Quando
          const [deFora, administradora] = await Promise.allSettled([
            SD.comentarioCriar('anotacoes', id, 'Veja isto, @bruno.souza'), SD.comentarioCriar('anotacoes', id, 'Veja isto, @ana.lima')
          ]);
          // Então
          expect(deFora).toMatchObject({ status: 'rejected', reason: { message: 'Não é possível mencionar Bruno Exemplo Souza nesta anotação: inclua essa pessoa como participante antes.' } });
          expect(administradora).toMatchObject({ status: 'fulfilled', value: { mencoes: ['u-ana'] } });
        });

        describe('Quem não vê a anotação (#364)', () => {
          const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
          afterEach(() => entrarComo('u-master'));

          it('quando quem não vê a anotação comenta mencionando alguém, então a recusa é sempre a das regras de acesso, sem dizer quem está nela', async () => {
            // Dado: uma anotação com a Ana, que o Bruno não vê
            const { id } = await anotacaoNova({ participantes: ['u-ana'] });
            entrarComo('u-bruno');
            // Quando: ele menciona quem está nela, quem não está, e tenta numa anotação que não existe
            const tentativas = await Promise.allSettled([
              SD.comentarioCriar('anotacoes', id, 'Oi, @ana.lima'), SD.comentarioCriar('anotacoes', id, 'Oi, @mauro.duarte'),
              SD.comentarioCriar('anotacoes', id, 'Oi, @bruno.souza'), SD.comentarioCriar('anotacoes', crypto.randomUUID(), 'Oi, @ana.lima')
            ]);
            // Então: a mesma resposta em todos os casos
            expect(tentativas.map(t => t.status === 'rejected' && (t.reason as Error).message)).toEqual(Array(tentativas.length).fill('Você não tem permissão para fazer isso.'));
            entrarComo('u-master');
            expect(await SD.comentariosListar('anotacoes', id)).toEqual([]);
          });

          it('quando quem saiu da anotação edita o próprio comentário nela, então é recusado e o texto fica como estava', async () => {
            // Dado: o Bruno comenta numa anotação em que está, e depois sai dela
            const { id } = await anotacaoNova({ participantes: ['u-bruno'] });
            entrarComo('u-bruno');
            const { id: comentario } = await SD.comentarioCriar('anotacoes', id, 'Do Bruno');
            entrarComo('u-master');
            await SD.anotacaoAtualizar(id, { participantes: [] });
            entrarComo('u-bruno');
            // Quando
            const editar = SD.comentarioEditar(comentario, 'Mudei, @ana.lima');
            // Então
            await expect(editar).rejects.toThrow('Só quem escreveu o comentário pode editá-lo.');
            entrarComo('u-master');
            expect((await SD.comentariosListar('anotacoes', id)).map(c => c.texto)).toEqual(['Do Bruno']);
          });
        });

        it('quando a anotação é arquivada, então os comentários ficam; quando é excluída, então vão junto', async () => {
          // Dado
          const { id } = await anotacaoNova();
          await SD.comentarioCriar('anotacoes', id, 'Comentário que vai junto');
          // Quando
          await SD.anotacoesArquivar([id], true);
          // Então
          expect((await SD.comentariosListar('anotacoes', id)).map(c => c.texto)).toEqual(['Comentário que vai junto']);
          // Quando
          await SD.anotacoesExcluir([id]);
          // Então
          expect(await SD.comentariosListar('anotacoes', id)).toEqual([]);
        });
      });

      describe('Nos processos (#362)', () => {
        const processoNovo = async (extra: Partial<Parameters<Dados['processoCriar']>[0]> = {}) => {
          const { id: cliente } = await criar(marca());
          return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente], ...extra });
        };

        it('quando alguém comenta num processo, então o comentário vem no topo, só dele, e quem foi mencionado recebe a mensagem, que leva à página do tipo', async () => {
          // Dado: dois processos, a Ana responsável pelos dois
          const { id } = await processoNovo({ tipo: 'administrativo' }), { id: outro } = await processoNovo();
          await SD.comentarioCriar('processos', id, 'Primeiro');
          // Quando
          const novo = await SD.comentarioCriar('processos', id, '  Veja a decisão, @ana.lima  ');
          // Então
          expect((await SD.comentariosListar('processos', id)).map(c => c.texto)).toEqual(['Veja a decisão, @ana.lima', 'Primeiro']);
          expect(novo).toMatchObject({ autor_id: 'u-master', mencoes: ['u-ana'] });
          expect(await SD.comentariosListar('processos', outro)).toEqual([]);
          const entrarComo = (quem: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(quem);
          entrarComo('u-ana');
          const mensagem = (await SD.mensagensListar()).find(m => m.comentario?.id === novo.id);
          entrarComo('u-master');
          expect(mensagem?.comentario).toMatchObject({ modulo: 'processos', cartao_id: id, tipo_do_processo: 'administrativo' });
        });

        it('quando o comentário menciona quem não está no processo, então salvar é recusado com a mensagem do banco; quem está nele pode', async () => {
          // Dado
          const { id } = await processoNovo({ responsavel_id: 'u-master' });
          // Quando
          const [deFora, administradora] = await Promise.allSettled([
            SD.comentarioCriar('processos', id, 'Veja isto, @bruno.souza'), SD.comentarioCriar('processos', id, 'Veja isto, @ana.lima')
          ]);
          // Então
          expect(deFora).toMatchObject({ status: 'rejected', reason: { message: 'Não é possível mencionar Bruno Exemplo Souza neste processo: inclua essa pessoa como colaboradora antes.' } });
          expect(administradora).toMatchObject({ status: 'fulfilled', value: { mencoes: ['u-ana'] } });
          // Quando: o Bruno entra como colaborador
          await SD.processoAtualizar(id, { colaboradores: ['u-bruno'] });
          // Então
          await expect(SD.comentarioCriar('processos', id, 'Agora sim, @bruno.souza')).resolves.toMatchObject({ mencoes: ['u-bruno'] });
        });

        it('quando o processo é arquivado, então os comentários ficam; quando é excluído, então vão junto', async () => {
          // Dado
          const { id } = await processoNovo();
          await SD.comentarioCriar('processos', id, 'Comentário que vai junto');
          // Quando
          await SD.processosArquivar([id], true);
          // Então
          expect((await SD.comentariosListar('processos', id)).map(c => c.texto)).toEqual(['Comentário que vai junto']);
          // Quando
          await SD.processosExcluir([id]);
          // Então
          expect(await SD.comentariosListar('processos', id)).toEqual([]);
        });
      });
    });

    describe('Demandas', () => {
      // Quem está logado é o Mauro (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const novaDemanda = (extra: Parameters<Dados['demandaCriar']>[0] = {}) =>
        SD.demandaCriar({ titulo: 'Pedido de registro de marca', responsavel_id: 'u-ana', ...extra });

      it.each([
        ['prazo', ['dia', 'dia-8h', 'depois', 'sem']],
        ['prazo_desc', ['depois', 'dia-8h', 'dia', 'sem']]
      ] as const)('dadas demandas com e sem prazo, quando a ordem é %s, então vêm pelo prazo, com o sem hora antes no mesmo dia e as sem prazo no fim (#291)', async (ordem, esperado) => {
        // Dado
        const parte = marca();
        await novaDemanda({ titulo: parte + ' sem' });
        await novaDemanda({ titulo: parte + ' depois', prazo: '2031-03-15' });
        await novaDemanda({ titulo: parte + ' dia-8h', prazo: '2031-03-12', prazo_hora: '08:00' });
        await novaDemanda({ titulo: parte + ' dia', prazo: '2031-03-12' });
        // Quando
        const r = await SD.demandasListar({ termo: parte, ordem });
        // Então
        expect(r.linhas.map(x => x.titulo)).toEqual(esperado.map(x => parte + ' ' + x));
      });
      const colunaAssinado = async () => (await SD.colunasListar('contratos')).find(c => c.marco === 'assinado')!;

      it('quando uma demanda é criada, então ganha um código curto, e o responsável não fica entre os colaboradores', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        // Quando
        const { id, codigo } = await novaDemanda({ titulo: '  Notificar o devedor  ', colaboradores: ['u-bruno', 'u-ana', 'u-bruno'], clientes: [cliente, cliente] });
        // Então
        expect(codigo).toMatch(/^[0-9A-F]{8}$/);
        expect(await SD.demandaObter(id)).toMatchObject({ titulo: 'Notificar o devedor', responsavel_id: 'u-ana', colaboradores: ['u-bruno'],
          clientes: [{ id: cliente }], contrato: null });
      });

      it('quando o responsável não é da equipe, então salvar é recusado com a mensagem em português', async () => {
        // Quando
        const salvar = novaDemanda({ responsavel_id: 'u-de-fora' });
        // Então
        await expect(salvar).rejects.toThrow('O responsável precisa ser alguém da equipe do escritório.');
      });

      it('quando um contrato vai para a coluna "assinado", então nasce uma demanda por objeto, uma vez só', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        const { id: k } = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca', 'Oposição'], categoria: 'pro_labore' });
        const assinado = await colunaAssinado();
        // Quando
        await SD.contratoMover(k, assinado.id, 1);
        await SD.contratoMover(k, null, 1);
        await SD.contratoMover(k, assinado.id, 1);
        // Então
        const ligadas = await SD.demandasDoContrato(k);
        expect(ligadas.map(d => d.titulo)).toEqual(['Registro de marca', 'Oposição']);
        const primeira = await SD.demandaObter(ligadas[0].id);
        const inicio = (await SD.colunasListar('demandas')).find(c => c.marco === 'inicio')!;
        expect(primeira).toMatchObject({ responsavel_id: 'u-master', clientes: [{ id: cliente }], contrato: { id: k }, etapa_id: inicio.id });
      });

      it('quando se pedem as demandas de uma pessoa, então vêm as dela, com o papel dela em cada uma', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        const { id: comoCliente } = await novaDemanda({ clientes: [cliente] });
        const { id: comoColaborador } = await novaDemanda({ colaboradores: ['u-bruno'] });
        // Quando
        const doCliente = await SD.demandasDaPessoa(cliente);
        const doBruno = await SD.demandasDaPessoa('p-bruno', 'u-bruno');
        // Então
        expect(doCliente.map(d => [d.id, d.papeis])).toEqual([[comoCliente, ['cliente']]]);
        expect(doBruno.find(d => d.id === comoColaborador)?.papeis).toEqual(['colaborador']);
      });

      it('quando a demanda muda, então o histórico mostra os nomes', async () => {
        // Dado
        const { id } = await novaDemanda();
        // Quando
        await SD.demandaAtualizar(id, { responsavel_id: 'u-bruno', titulo: 'Outro título' });
        // Então
        const [ultima] = await SD.demandaHistorico(id);
        expect(ultima.alteracoes).toEqual({ responsavel_id: { de: 'Ana Teste Lima', para: 'Bruno Exemplo Souza' }, titulo: { de: 'Pedido de registro de marca', para: 'Outro título' } });
      });

      it('quando o comentário da demanda menciona quem não está nela, então é recusado; quem está nela pode', async () => {
        // Dado (a demanda é da Ana, com o Bruno de fora; o Mauro, administrador, vê todas)
        const { id } = await novaDemanda();
        // Quando
        const [deFora, daDemanda] = await Promise.allSettled([
          SD.comentarioCriar('demandas', id, 'Veja, @bruno.souza'), SD.comentarioCriar('demandas', id, 'Veja, @ana.lima')
        ]);
        // Então
        expect(deFora).toMatchObject({ status: 'rejected', reason: { message: 'Não é possível mencionar Bruno Exemplo Souza nesta demanda: inclua essa pessoa como colaboradora antes.' } });
        expect(daDemanda).toMatchObject({ status: 'fulfilled', value: { mencoes: ['u-ana'] } });
      });

      it('quando a pessoa é cliente de uma demanda, então ela não pode ser excluída', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        await novaDemanda({ clientes: [cliente] });
        await SD.pessoasArquivar([cliente]);
        // Quando
        const r = await SD.pessoasExcluir([cliente]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em demandas e não pode ser excluída.' });
      });

      it('quando a demanda está ativa, então não é excluída; arquivada, é', async () => {
        // Dado
        const { id } = await novaDemanda();
        // Quando
        const ativa = await SD.demandasExcluir([id]);
        await SD.demandasArquivar([id]);
        const arquivada = await SD.demandasExcluir([id]);
        // Então
        expect([ativa.excluidas, arquivada.excluidas]).toEqual([0, 1]);
        expect(await SD.demandaObter(id)).toBeNull();
      });

      it('quando as colunas de demandas são listadas, então "Para fazer" e "Concluído" são as colunas-marco', async () => {
        // Quando
        const colunas = await SD.colunasListar('demandas');
        // Então
        expect(colunas.map(c => [c.nome, c.marco ?? null])).toEqual([['Para fazer', 'inicio'], ['Fazendo', null], ['Aguardando retorno', null], ['Concluído', 'concluido']]);
      });

      it('quando a coluna é excluída, então a demanda vai para "sem situação"', async () => {
        // Dado
        const coluna = (await SD.colunasListar('demandas')).find(c => !c.marco)!;
        const { id } = await novaDemanda({ etapa_id: coluna.id, etapa_ordem: 1 });
        // Quando
        await SD.colunaExcluir(coluna.id);
        // Então
        expect((await SD.demandaObter(id))?.etapa_id).toBeNull();
        expect((await SD.demandasDaEtapa(null)).linhas.map(d => d.id)).toContain(id);
      });
    });

    describe('Compromissos', () => {
      // Quem está logado é o Mauro (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const DIA_A = '2031-03-10', DIA_B = '2031-03-11', DIA_C = '2031-03-12';
      const reuniao = (extra: Partial<Parameters<Dados['compromissoCriar']>[0]> = {}) =>
        SD.compromissoCriar({ tipo: 'reuniao', titulo: marca(), data: DIA_A, hora: '14:30', responsavel_id: 'u-ana', ...extra });
      const processoNovo = async () => {
        const { id: cliente } = await criar(marca());
        const p = await SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
        return { ...p, cliente };
      };
      const audiencia = async (extra: Partial<Parameters<Dados['compromissoCriar']>[0]> = {}) => {
        const p = await processoNovo();
        const c = await SD.compromissoCriar({ tipo: 'audiencia', modalidade: 'presencial', data: DIA_A, hora: '10:00', responsavel_id: 'u-ana', processo_id: p.id, pessoas: [p.cliente], ...extra });
        return { ...c, processo: p };
      };

      it('quando um compromisso é criado, então ele pode ser lido de volta com as pessoas, o processo e um código', async () => {
        // Dado
        const nome = marca(), { id: pessoa } = await criar(nome), p = await processoNovo();
        // Quando
        const { id, codigo } = await SD.compromissoCriar({ tipo: 'audiencia', titulo: ' Instrução ', data: DIA_A, hora: '14:30', hora_fim: '16:00', modalidade: 'virtual', local: ' Sala 1 ', resultado: ' Acordo ',
          responsavel_id: 'u-ana', participantes: ['u-bruno'], pessoas: [pessoa, pessoa], processo_id: p.id });
        // Então
        expect(codigo).toBeTruthy();
        expect(await SD.compromissoObter(id)).toMatchObject({ tipo: 'audiencia', titulo: 'Instrução', data: DIA_A, hora: '14:30:00', hora_fim: '16:00:00', modalidade: 'virtual', local: 'Sala 1', resultado: 'Acordo', geral: false,
          pessoa_nome: nome, pessoas: [{ id: pessoa }], processo_id: p.id, processo_codigo: p.codigo, processo: { id: p.id } });
      });

      it.each([
        ['audiência sem processo', { tipo: 'audiencia', modalidade: 'presencial' }, 'Audiência e perícia precisam de um processo.'],
        ['perícia sem processo', { tipo: 'pericia', modalidade: 'virtual' }, 'Audiência e perícia precisam de um processo.'],
        ['reunião sem título', { titulo: '   ' }, 'Algum campo está em formato inválido. Confira os dados e tente de novo.'],
        ['reunião sem hora', { hora: null }, 'Algum campo está em formato inválido. Confira os dados e tente de novo.'],
        ['fim antes do início', { hora: '14:00', hora_fim: '13:00' }, 'Algum campo está em formato inválido. Confira os dados e tente de novo.'],
        ['resultado numa reunião', { resultado: 'Acordo' }, 'Algum campo está em formato inválido. Confira os dados e tente de novo.'],
        ['responsável de fora', { responsavel_id: 'u-de-fora' }, 'O responsável precisa ser alguém da equipe do escritório.'],
        ['participante de fora', { participantes: ['u-de-fora'] }, 'O participante precisa ser alguém da equipe do escritório.'],
        ['pessoa que não existe', { pessoas: ['p-de-fora'] }, 'Pessoa não encontrada neste escritório.'],
        ['processo que não existe', { processo_id: 'x-de-fora' }, 'Processo não encontrado neste escritório.']
      ] as const)('quando o cadastro traz %s, então é recusado', async (_caso, extra, mensagem) => {
        // Quando
        const r = reuniao(extra as Partial<Parameters<Dados['compromissoCriar']>[0]>);
        // Então
        await expect(r).rejects.toThrow(mensagem);
      });

      it('quando a audiência não tem modalidade, então é recusada', async () => {
        // Dado
        const p = await processoNovo();
        // Quando
        const r = SD.compromissoCriar({ tipo: 'audiencia', data: DIA_A, hora: '10:00', responsavel_id: 'u-ana', processo_id: p.id });
        // Então
        await expect(r).rejects.toThrow('Algum campo está em formato inválido.');
      });

      it('quando o tipo é "outro" e não tem hora, então vale o dia inteiro', async () => {
        // Quando
        const { id } = await SD.compromissoCriar({ tipo: 'outro', titulo: marca(), data: DIA_A, responsavel_id: 'u-ana' });
        // Então
        expect((await SD.compromissoObter(id))?.hora).toBeNull();
      });

      it('quando um texto passa do tamanho, então é recusado', async () => {
        // Quando
        const r = reuniao({ local: 'x'.repeat(TAMANHO_COMPROMISSO.local + 1) });
        // Então
        await expect(r).rejects.toThrow('Algum campo está em formato inválido.');
      });

      it('quando o responsável também está nos participantes, então ele sai da lista, e ninguém repete', async () => {
        // Quando
        const { id } = await reuniao({ participantes: ['u-ana', 'u-bruno', 'u-bruno'] });
        // Então
        expect((await SD.compromissoObter(id))?.participantes).toEqual(['u-bruno']);
      });

      it('quando uma reunião com processo perde o processo, então o código e o número saem junto', async () => {
        // Dado
        const p = await processoNovo(), { id } = await reuniao({ processo_id: p.id });
        // Quando
        await SD.compromissoAtualizar(id, { processo_id: null });
        // Então
        expect(await SD.compromissoObter(id)).toMatchObject({ processo_id: null, processo_codigo: null, processo_numero: null, processo: null });
      });

      it('quando a audiência perde o processo, então é recusado', async () => {
        // Dado
        const { id } = await audiencia();
        // Quando
        const r = SD.compromissoAtualizar(id, { processo_id: null });
        // Então
        await expect(r).rejects.toThrow('Audiência e perícia precisam de um processo.');
      });

      it('quando o número do processo muda, então o compromisso mostra o número novo', async () => {
        // Dado
        const { id, processo } = await audiencia(), numero = marca();
        // Quando
        await SD.processoAtualizar(processo.id, { numero });
        // Então
        expect((await SD.compromissoObter(id))?.processo_numero).toBe(numero);
      });

      it('quando se pede um período, então vêm os ativos dele, com o primeiro e o último dia, por data e hora', async () => {
        // Dado
        const parte = marca();
        const tarde = await reuniao({ titulo: parte + ' T', data: DIA_B, hora: '15:00' });
        const cedo = await reuniao({ titulo: parte + ' C', data: DIA_B, hora: '08:00' });
        const inicio = await reuniao({ titulo: parte + ' I', data: DIA_A });
        const fim = await reuniao({ titulo: parte + ' F', data: DIA_C });
        await reuniao({ titulo: parte + ' Fora', data: '2031-03-13' });
        const arquivado = await reuniao({ titulo: parte + ' A', data: DIA_B });
        await SD.compromissosArquivar([arquivado.id]);
        // Quando
        const r = await SD.compromissosDoPeriodo(DIA_A, DIA_C, { termo: parte });
        // Então
        expect(r.map(c => c.id)).toEqual([inicio.id, cedo.id, tarde.id, fim.id]);
      });

      it.each([
        ['data', ['A', 'B']],
        ['data_desc', ['B', 'A']],
        ['nome', ['A', 'B']],
        ['nome_desc', ['B', 'A']]
      ] as const)('quando a ordem da tabela é %s, então a lista vem nessa ordem', async (ordem, esperado) => {
        // Dado
        const parte = marca();
        await reuniao({ titulo: parte + ' A', data: DIA_A });
        await reuniao({ titulo: parte + ' B', data: DIA_B });
        // Quando
        const r = await SD.compromissosListar({ termo: parte, ordem });
        // Então
        expect(r.linhas.map(c => c.titulo)).toEqual(esperado.map(x => parte + ' ' + x));
        expect(r.total).toBe(2);
      });

      it('quando se filtra por tipo, pessoa da equipe, busca ou etiqueta, então vêm só os que combinam', async () => {
        // Dado
        const parte = marca(), etiqueta = await SD.etiquetaCriar('azul', marca());
        const comBruno = await reuniao({ titulo: parte, participantes: ['u-bruno'], local: 'Sala Azul ' + parte });
        const { id: daAudiencia } = await audiencia({ titulo: parte });
        await SD.etiquetaAplicar('compromissos', comBruno.id, etiqueta.id);
        const ids = async (f: Parameters<Dados['compromissosListar']>[0]) => (await SD.compromissosListar({ termo: parte, ...f })).linhas.map(c => c.id);
        // Então
        expect(await ids({ tipo: 'audiencia' })).toEqual([daAudiencia]);
        expect(await ids({ pessoa: 'u-bruno' })).toEqual([comBruno.id]);
        expect(await ids({ etiqueta: etiqueta.id })).toEqual([comBruno.id]);
        expect((await SD.compromissosListar({ termo: 'sala azul ' + parte.toLowerCase() })).linhas.map(c => c.id)).toEqual([comBruno.id]);
      });

      it('quando o compromisso muda de coluna, então vale só uma coluna do quadro dele, e o histórico guarda o nome', async () => {
        // Dado
        const { id } = await reuniao();
        const [colunas, deTarefas] = await Promise.all([SD.colunasListar('compromissos'), SD.colunasListar('tarefas')]);
        const realizado = colunas.find(c => c.marco === 'concluido')!;
        // Quando
        await SD.compromissoMover(id, realizado.id, 1);
        // Então
        expect((await SD.compromissosDaEtapa(realizado.id)).linhas.map(c => c.id)).toContain(id);
        await expect(SD.compromissoMover(id, deTarefas[0].id, 1)).rejects.toThrow('Você não tem permissão para fazer isso.');
        expect((await SD.compromissoHistorico(id))[0].alteracoes.etapa.para).toBe('Realizado');
      });

      it('quando o quadro abre, então as colunas são Agendado, Confirmado, Realizado e Cancelado, com os marcos', async () => {
        // Quando
        const colunas = await SD.colunasListar('compromissos');
        // Então
        expect(colunas.map(c => [c.nome, c.marco ?? null])).toEqual([['Agendado', 'inicio'], ['Confirmado', null], ['Realizado', 'concluido'], ['Cancelado', null]]);
      });

      it('quando a coluna é excluída, então o compromisso vai para "sem situação"', async () => {
        // Dado
        const coluna = (await SD.colunasListar('compromissos')).find(c => !c.marco)!;
        const { id } = await reuniao({ etapa_id: coluna.id, etapa_ordem: 1 });
        // Quando
        await SD.colunaExcluir(coluna.id);
        // Então
        expect((await SD.compromissoObter(id))?.etapa_id).toBeNull();
        expect((await SD.compromissosDaEtapa(null)).linhas.map(c => c.id)).toContain(id);
      });

      it('quando a data e o local mudam, então o histórico guarda o de antes e o de agora', async () => {
        // Dado
        const { id } = await reuniao({ local: 'Sala 1' });
        // Quando
        await SD.compromissoAtualizar(id, { data: DIA_B, local: 'Sala 2' });
        // Então
        const { alteracoes } = (await SD.compromissoHistorico(id))[0];
        expect(alteracoes.data).toEqual({ de: DIA_A, para: DIA_B });
        expect(alteracoes.local).toEqual({ de: 'Sala 1', para: 'Sala 2' });
      });

      it('quando o compromisso está ativo, então não é excluído; arquivado, é', async () => {
        // Dado
        const { id } = await reuniao();
        // Quando
        const ativo = await SD.compromissosExcluir([id]);
        await SD.compromissosArquivar([id]);
        const arquivado = await SD.compromissosExcluir([id]);
        // Então
        expect(ativo).toMatchObject({ excluidas: 0, motivo: 'Só compromissos arquivados podem ser excluídos, por quem os criou ou por um administrador.' });
        expect(arquivado.excluidas).toBe(1);
        expect(await SD.compromissoObter(id)).toBeNull();
      });

      it('quando a pessoa está num compromisso, então não pode ser excluída', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        await reuniao({ pessoas: [pessoa] });
        await SD.pessoasArquivar([pessoa]);
        // Quando
        const r = await SD.pessoasExcluir([pessoa]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em compromissos e não pode ser excluída.' });
      });

      it('quando se pedem os compromissos de uma pessoa, então vêm os dela, com o papel dela em cada um', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        const ligado = await reuniao({ pessoas: [pessoa], participantes: ['u-bruno'] });
        // Quando
        const daPessoa = await SD.compromissosDaPessoa(pessoa);
        const doBruno = await SD.compromissosDaPessoa('p-bruno', 'u-bruno');
        // Então
        expect(daPessoa.map(c => [c.id, c.papeis])).toEqual([[ligado.id, ['pessoa']]]);
        expect(doBruno.find(c => c.id === ligado.id)?.papeis).toEqual(['participante']);
      });

      it('quando se pedem os compromissos de um processo, então vêm os dele', async () => {
        // Dado
        const { id, processo } = await audiencia();
        await reuniao();
        // Quando
        const r = await SD.compromissosDoProcesso(processo.id);
        // Então
        expect(r.map(c => c.id)).toEqual([id]);
      });

      it('quando um atendimento é criado com título e hora, então ele volta com o tipo; sem hora, é recusado', async () => {
        // Dado / Quando
        const { id } = await SD.compromissoCriar({ tipo: 'atendimento', titulo: marca(), data: DIA_A, hora: '09:00', responsavel_id: 'u-ana' });
        // Então
        expect((await SD.compromissoObter(id))?.tipo).toBe('atendimento');
        await expect(SD.compromissoCriar({ tipo: 'atendimento', titulo: marca(), data: DIA_A, responsavel_id: 'u-ana' })).rejects.toThrow('Algum campo está em formato inválido.');
      });

      describe('ligado a tarefas, demandas e contratos (#306)', () => {
        const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
        afterEach(() => entrarComo('u-master'));
        const itens = async () => {
          const { id: cliente } = await criar(marca());
          const demanda = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
          const tarefa = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' });
          const contrato = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
          return { demanda, tarefa, contrato };
        };

        it('quando o compromisso é ligado a uma demanda, uma tarefa e um contrato, então aparece no de cada um, e o dele mostra os três', async () => {
          // Dado
          const { id } = await reuniao(), { demanda, tarefa, contrato } = await itens();
          // Quando
          const novas = [await SD.compromissoLigar(id, 'demandas', demanda.id), await SD.compromissoLigar(id, 'tarefas', tarefa.id), await SD.compromissoLigar(id, 'contratos', contrato.id)];
          const deNovo = await SD.compromissoLigar(id, 'demandas', demanda.id);
          // Então
          expect(novas).toEqual([true, true, true]);
          expect(deNovo).toBe(false);
          for (const [modulo, item] of [['demandas', demanda], ['tarefas', tarefa], ['contratos', contrato]] as const)
            expect((await SD.compromissosDoItem(modulo, item.id)).map(c => c.id)).toEqual([id]);
          const r = await SD.compromissoItens(id);
          expect(r.visiveis.map(i => [i.modulo, i.id])).toEqual([['demandas', demanda.id], ['tarefas', tarefa.id], ['contratos', contrato.id]]);
          expect(r.ocultos).toBe(0);
          expect((await SD.compromissoHistorico(id))[0].alteracoes.ligacao).toEqual({ de: null, para: `Contrato ${contrato.codigo}` });
        });

        it('quando a ligação é desfeita, então o compromisso sai do cartão do item, e o histórico registra', async () => {
          // Dado
          const { id } = await reuniao(), { demanda } = await itens();
          await SD.compromissoLigar(id, 'demandas', demanda.id);
          // Quando
          await SD.compromissoDesligar(id, 'demandas', demanda.id);
          // Então
          expect(await SD.compromissosDoItem('demandas', demanda.id)).toEqual([]);
          expect((await SD.compromissoItens(id)).visiveis).toEqual([]);
          expect((await SD.compromissoHistorico(id))[0].alteracoes.ligacao).toEqual({ de: `Demanda ${demanda.codigo}`, para: null });
        });

        it('quando o item é excluído, então a ligação sai junto, e o histórico do compromisso diz qual item era', async () => {
          // Dado
          const { id } = await reuniao(), { tarefa } = await itens();
          await SD.compromissoLigar(id, 'tarefas', tarefa.id);
          // Quando
          await SD.tarefasArquivar([tarefa.id]);
          await SD.tarefasExcluir([tarefa.id]);
          // Então
          expect((await SD.compromissoItens(id)).visiveis).toEqual([]);
          expect((await SD.compromissoHistorico(id))[0].alteracoes.ligacao).toEqual({ de: `Tarefa ${tarefa.codigo}`, para: null });
        });

        it('quando quem não muda o compromisso, ou o compromisso arquivado, tenta ligar ou desligar, então é recusado', async () => {
          // Dado: a reunião é só da Ana; a outra está arquivada
          const { id } = await reuniao(), { id: arquivada } = await reuniao({ responsavel_id: 'u-master' }), { demanda } = await itens();
          await SD.compromissoLigar(id, 'demandas', demanda.id);
          await SD.compromissosArquivar([arquivada]);
          // Quando / Então
          await expect(SD.compromissoLigar(arquivada, 'demandas', demanda.id)).rejects.toThrow('Você não tem permissão para fazer isso.');
          entrarComo('u-bruno');
          await expect(SD.compromissoLigar(id, 'demandas', demanda.id)).rejects.toThrow('Você não tem permissão para fazer isso.');
          await expect(SD.compromissoDesligar(id, 'demandas', demanda.id)).rejects.toThrow('Você não tem permissão para fazer isso.');
        });

        it('quando o compromisso chega a 30 itens, então o próximo é recusado', async () => {
          // Dado
          const { id } = await reuniao();
          const tarefas = await Promise.all(Array.from({ length: ITENS_DO_COMPROMISSO + 1 }, () => SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' })));
          for (const t of tarefas.slice(0, ITENS_DO_COMPROMISSO)) await SD.compromissoLigar(id, 'tarefas', t.id);
          // Quando / Então
          await expect(SD.compromissoLigar(id, 'tarefas', tarefas[ITENS_DO_COMPROMISSO].id)).rejects.toThrow(`no máximo ${ITENS_DO_COMPROMISSO} itens`);
        });
      });

      describe('nas salas do escritório (#308)', () => {
        const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
        afterEach(() => entrarComo('u-master'));
        const DIA_DA_SALA = '2031-05-20';
        const naSala = (sala_id: string, hora: string, hora_fim: string | null = null) => reuniao({ data: DIA_DA_SALA, hora, hora_fim, sala_id });

        it('quando o administrador cadastra salas, então elas vêm por nome; o nome repetido é recusado; quem não é administrador não cadastra', async () => {
          // Dado
          const nome = marca();
          // Quando
          const b = await SD.salaCriar({ nome: `  ${nome} B `, capacidade: 4 });
          const a = await SD.salaCriar({ nome: `${nome} A`, capacidade: 8 });
          // Então
          expect(b).toMatchObject({ nome: `${nome} B`, capacidade: 4, ativa: true });
          const minhas = (await SD.salasListar()).filter(s => s.nome.startsWith(nome));
          expect(minhas.map(s => s.id)).toEqual([a.id, b.id]);
          await expect(SD.salaCriar({ nome: `${nome.toLowerCase()} a`, capacidade: 2 })).rejects.toThrow(SALA_REPETIDA);
          entrarComo('u-bruno');
          await expect(SD.salaCriar({ nome: marca(), capacidade: 2 })).rejects.toThrow('Você não tem permissão para fazer isso.');
          await expect(SD.salaAtualizar(a.id, { ativa: false })).rejects.toThrow('Você não tem permissão para fazer isso.');
        });

        it('dada a sala ocupada das 14h às 15h, quando se marca outro às 14h30, então é recusado; às 15h, vale; e a ocupação mostra os dois', async () => {
          // Dado
          const sala = await SD.salaCriar({ nome: marca(), capacidade: 6 });
          const primeiro = await naSala(sala.id, '14:00', '15:00');
          // Quando / Então
          await expect(naSala(sala.id, '14:30')).rejects.toThrow(`A sala ${sala.nome} já está ocupada das 14:00 às 15:00 pelo compromisso ${primeiro.codigo}.`);
          const segundo = await naSala(sala.id, '15:00');
          expect((await SD.salaOcupacao(sala.id, DIA_DA_SALA)).map(o => o.id)).toEqual([primeiro.id, segundo.id]);
          expect((await SD.salaOcupacao(sala.id, DIA_DA_SALA, primeiro.id)).map(o => o.id)).toEqual([segundo.id]);
          // Mudar a hora também confere
          await expect(SD.compromissoAtualizar(segundo.id, { hora: '14:30' })).rejects.toThrow('já está ocupada');
          // E a agenda filtra pela sala
          expect((await SD.compromissosDoPeriodo(DIA_DA_SALA, DIA_DA_SALA, { sala: sala.id })).map(c => c.id)).toEqual([primeiro.id, segundo.id]);
        });

        it('dado o compromisso arquivado, quando outro ocupa o horário, então vale; e desarquivar o primeiro é recusado', async () => {
          // Dado
          const sala = await SD.salaCriar({ nome: marca(), capacidade: 6 });
          const primeiro = await naSala(sala.id, '09:00', '10:00');
          await SD.compromissosArquivar([primeiro.id]);
          // Quando
          await naSala(sala.id, '09:30');
          // Então
          await expect(SD.compromissosArquivar([primeiro.id], false)).rejects.toThrow('já está ocupada');
        });

        it('dada a sala desativada, quando se marca um compromisso novo nela, então é recusado; o antigo continua com ela e é mudado', async () => {
          // Dado
          const sala = await SD.salaCriar({ nome: marca(), capacidade: 6 });
          const antigo = await naSala(sala.id, '11:00');
          // Quando
          await SD.salaAtualizar(sala.id, { ativa: false });
          // Então
          expect((await SD.salasListar()).find(s => s.id === sala.id)?.ativa).toBe(false);
          await expect(naSala(sala.id, '16:00')).rejects.toThrow(`A sala ${sala.nome} está desativada. Escolha outra sala.`);
          await SD.compromissoAtualizar(antigo.id, { titulo: marca() });
          expect((await SD.compromissoObter(antigo.id))?.sala_id).toBe(sala.id);
          // E o histórico mostra a sala pelo nome
          await SD.compromissoAtualizar(antigo.id, { sala_id: null });
          expect((await SD.compromissoHistorico(antigo.id))[0].alteracoes.sala).toEqual({ de: sala.nome, para: null });
        });
      });

      it('quando o processo é excluído, então as audiências saem e os outros compromissos ficam sem a ligação', async () => {
        // Dado
        const { id: daAudiencia, processo } = await audiencia();
        const { id: daReuniao } = await reuniao({ processo_id: processo.id });
        await SD.processosArquivar([processo.id]);
        // Quando
        await SD.processosExcluir([processo.id]);
        // Então
        expect(await SD.compromissoObter(daAudiencia)).toBeNull();
        expect(await SD.compromissoObter(daReuniao)).toMatchObject({ processo_id: null, processo_codigo: null, processo_numero: null });
      });

      it('quando se pedem os prazos de um período, então vêm os de demandas e tarefas ativas, sem os concluídos', async () => {
        // Dado
        const parte = marca(), concluida = (await SD.colunasListar('tarefas')).find(c => c.marco === 'concluido')!;
        const demanda = await SD.demandaCriar({ titulo: parte + ' D', prazo: DIA_B, responsavel_id: 'u-ana' });
        const tarefa = await SD.tarefaCriar({ titulo: parte + ' T', prazo: DIA_A, responsavel_id: 'u-ana' });
        const feita = await SD.tarefaCriar({ titulo: parte + ' Feita', prazo: DIA_A, responsavel_id: 'u-ana' });
        await SD.tarefaMover(feita.id, concluida.id, 1);
        await SD.tarefaCriar({ titulo: parte + ' Fora', prazo: '2031-04-01', responsavel_id: 'u-ana' });
        // Quando
        const r = await SD.prazosDoPeriodo(DIA_A, DIA_C, { termo: parte });
        // Então
        expect(r.map(p => [p.origem, p.id, p.prazo]).sort((a, b) => a[0].localeCompare(b[0]))).toEqual([['demandas', demanda.id, DIA_B], ['tarefas', tarefa.id, DIA_A]]);
      });

      it('dados mais concluídos de prazo antigo que o limite da agenda, quando se pedem os prazos, então o em aberto mais novo ainda vem', async () => {
        // Dado: ITENS_DA_AGENDA + 1 tarefas na coluna das concluídas (não arquivadas), todas com prazo antes da que está em aberto
        const parte = marca(), concluida = (await SD.colunasListar('tarefas')).find(c => c.marco === 'concluido')!;
        await Promise.all(Array.from({ length: ITENS_DA_AGENDA + 1 }, (_, i) =>
          SD.tarefaCriar({ titulo: `${parte} Feita ${i}`, prazo: DIA_A, responsavel_id: 'u-ana', etapa_id: concluida.id })));
        const aberta = await SD.tarefaCriar({ titulo: parte + ' Aberta', prazo: DIA_C, responsavel_id: 'u-ana' });
        // Quando
        const r = await SD.prazosDoPeriodo(DIA_A, DIA_C, { termo: parte });
        // Então
        expect(r.map(p => p.id)).toEqual([aberta.id]);
      });

      it('quando se buscam os processos para ligar, então vêm os que combinam, mesmo os mais antigos', async () => {
        // Dado
        const titulo = marca();
        const { id: cliente } = await criar(marca());
        const antigo = await SD.processoCriar({ tipo: 'judicial', numero: marca(), titulo, responsavel_id: 'u-ana', clientes: [cliente] });
        await processoNovo();
        // Quando
        const r = await SD.processosParaLigar(titulo.toLowerCase());
        // Então
        expect(r.map(p => p.id)).toEqual([antigo.id]);
      });

      it('quando se pedem os processos para ligar, então vêm os ativos', async () => {
        // Dado
        const ativo = await processoNovo(), arquivado = await processoNovo();
        await SD.processosArquivar([arquivado.id]);
        // Quando
        const r = await SD.processosParaLigar();
        // Então
        expect(r.map(p => p.id)).toContain(ativo.id);
        expect(r.map(p => p.id)).not.toContain(arquivado.id);
      });

      it('quando um comentário menciona quem não vê o compromisso, então é recusado; na Agenda geral, pode', async () => {
        // Dado: o Bruno não está em nenhum dos dois.
        const fechado = await reuniao(), geral = await reuniao({ geral: true });
        // Quando / Então
        await expect(SD.comentarioCriar('compromissos', fechado.id, 'Veja @bruno.souza')).rejects.toThrow('Não é possível mencionar Bruno Exemplo Souza neste compromisso: inclua essa pessoa como participante antes.');
        const aceito = await SD.comentarioCriar('compromissos', geral.id, 'Veja @bruno.souza');
        expect(aceito.mencoes).toEqual(['u-bruno']);
        expect((await SD.comentariosListar('compromissos', geral.id)).map(c => c.id)).toEqual([aceito.id]);
      });
    });

    describe('Processos: pessoas com papel, recursos e incidentais, tipos novos (#316)', () => {
      const novoProcesso = async (extra: Partial<Parameters<Dados['processoCriar']>[0]> = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente], ...extra });
      };

      it('quando um processo extrajudicial e uma investigação são criados, então cada um fica no seu tipo e na sua página', async () => {
        // Dado
        const numero = marca();
        // Quando
        const extra = await novoProcesso({ tipo: 'extrajudicial', numero });
        const inv = await novoProcesso({ tipo: 'investigacao', numero });
        // Então
        expect(await SD.processoObter(extra.id)).toMatchObject({ tipo: 'extrajudicial', origem_id: null, ligacao: null });
        expect((await SD.processosListar({ tipo: 'investigacao', termo: numero })).linhas.map(p => p.id)).toEqual([inv.id]);
        expect((await SD.processosListar({ tipo: 'judicial', termo: numero })).linhas).toEqual([]);
      });

      it('quando a pessoa ganha um papel no processo, então ela aparece nele com o papel, e o processo aparece no cartão dela', async () => {
        // Dado
        const processo = await novoProcesso();
        const { id: testemunha } = await criar(marca());
        // Quando
        const parte = await SD.processoParteIncluir(processo.id, testemunha, 'testemunha');
        // Então
        expect(await SD.processoPartes(processo.id)).toEqual([expect.objectContaining({ id: parte.id, papel: 'testemunha', pessoa: expect.objectContaining({ id: testemunha }) })]);
        expect(await SD.processosDaPessoa(testemunha)).toEqual([expect.objectContaining({ id: processo.id, papeis: [], partes: ['testemunha'] })]);
        expect((await SD.processoHistorico(processo.id))[0].alteracoes.partes).toMatchObject({ de: null, para: { papel: 'testemunha' } });
      });

      it('quando a pessoa ganha o mesmo papel de novo, então é recusado; outro papel, pode', async () => {
        // Dado
        const processo = await novoProcesso();
        const { id: pessoa } = await criar(marca());
        await SD.processoParteIncluir(processo.id, pessoa, 'perito');
        // Quando
        const repetido = SD.processoParteIncluir(processo.id, pessoa, 'perito');
        const outro = SD.processoParteIncluir(processo.id, pessoa, 'assistente_tecnico');
        // Então
        await expect(repetido).rejects.toThrow('Esta pessoa já tem esse papel neste processo.');
        await expect(outro).resolves.toMatchObject({ papel: 'assistente_tecnico' });
        expect((await SD.processosDaPessoa(pessoa))[0].partes).toEqual(['perito', 'assistente_tecnico']);
      });

      it('quando a pessoa com papel é tirada, então ela sai do processo e pode ser excluída do cadastro', async () => {
        // Dado
        const processo = await novoProcesso();
        const { id: pessoa } = await criar(marca());
        const parte = await SD.processoParteIncluir(processo.id, pessoa, 'reu');
        await SD.pessoasArquivar([pessoa], true);
        expect((await SD.pessoasExcluir([pessoa])).motivo).toBe('Esta pessoa está em processos e não pode ser excluída.');
        // Quando
        await SD.processoParteRetirar(parte.id);
        // Então
        expect(await SD.processoPartes(processo.id)).toEqual([]);
        expect((await SD.pessoasExcluir([pessoa])).excluidas).toBe(1);
      });

      it('quando o processo está arquivado, então não ganha pessoas com papel', async () => {
        // Dado
        const processo = await novoProcesso();
        const { id: pessoa } = await criar(marca());
        await SD.processosArquivar([processo.id], true);
        // Quando
        const pedido = SD.processoParteIncluir(processo.id, pessoa, 'autor');
        // Então
        await expect(pedido).rejects.toThrow('Você não tem permissão para fazer isso.');
      });

      it('quando um recurso nasce de um processo, então cada um mostra o outro, e o recurso tem o próprio número e andamentos', async () => {
        // Dado
        const origem = await novoProcesso();
        // Quando
        const recurso = await novoProcesso({ origem_id: origem.id, ligacao: 'recurso' });
        await SD.processoAndamentoCriar(recurso.id, { tipo: 'andamento', data: '2026-11-20', hora: null, local: null, texto: 'Recurso distribuído' });
        // Então
        expect(await SD.processosRelacionados(origem.id)).toEqual([expect.objectContaining({ id: recurso.id, relacao: 'recurso' })]);
        expect(await SD.processosRelacionados(recurso.id)).toEqual([expect.objectContaining({ id: origem.id, relacao: 'origem' })]);
        expect(await SD.processoAndamentos(origem.id)).toEqual([]);
        expect(await SD.processoAndamentos(recurso.id)).toHaveLength(1);
      });

      it('quando falta dizer se é recurso ou incidental, ou a origem não existe, então é recusado; a origem não muda depois', async () => {
        // Dado
        const origem = await novoProcesso();
        const incidental = await novoProcesso({ origem_id: origem.id, ligacao: 'incidental' });
        // Quando
        const semLigacao = novoProcesso({ origem_id: origem.id });
        const semOrigem = novoProcesso({ origem_id: '00000000-0000-0000-0000-000000000000', ligacao: 'recurso' });
        const mudar = () => SD.processoAtualizar(incidental.id, { origem_id: null });
        // Então
        await expect(semLigacao).rejects.toThrow('Algum campo está em formato inválido. Confira os dados e tente de novo.');
        await expect(semOrigem).rejects.toThrow('O processo de origem não foi encontrado neste escritório.');
        await expect(mudar()).rejects.toThrow('Você não tem permissão para fazer isso.');
        expect(await SD.processoObter(incidental.id)).toMatchObject({ origem_id: origem.id, ligacao: 'incidental' });
      });

      it('quando o processo de origem é excluído, então o incidental continua, só sem a ligação', async () => {
        // Dado
        const origem = await novoProcesso();
        const incidental = await novoProcesso({ origem_id: origem.id, ligacao: 'incidental' });
        await SD.processosArquivar([origem.id], true);
        // Quando
        await SD.processosExcluir([origem.id]);
        // Então
        expect(await SD.processoObter(incidental.id)).toMatchObject({ origem_id: null, ligacao: 'incidental' });
        expect(await SD.processosRelacionados(incidental.id)).toEqual([]);
        // Como a chave on delete set null no banco: a origem que saiu fica no histórico do incidental.
        expect((await SD.processoHistorico(incidental.id))[0].alteracoes).toEqual({ origem_id: { de: origem.id, para: null } });
      });
    });

    describe('Processos', () => {
      // Quem está logado é o Mauro (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const NUMERO = '0005678-13.2026.8.13.0433';
      const novoProcesso = async (extra: Partial<Parameters<Dados['processoCriar']>[0]> = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente], ...extra });
      };

      it('quando um processo é criado, então ele pode ser lido de volta com os clientes e um código', async () => {
        // Dado
        const nome = marca();
        const { id: cliente } = await criar(nome);
        // Quando
        const { id, codigo } = await SD.processoCriar({ tipo: 'judicial', numero: NUMERO, responsavel_id: 'u-ana', colaboradores: ['u-bruno'], clientes: [cliente], orgao: ' tjmg ', valor_causa: 1500.5 });
        // Então
        expect(codigo).toMatch(/^[0-9A-F]{8}$/);
        expect(await SD.processoObter(id)).toMatchObject({ tipo: 'judicial', numero: NUMERO, orgao: 'TJMG', responsavel_id: 'u-ana', colaboradores: ['u-bruno'],
          clientes: [{ id: cliente }], cliente_nome: nome, valor_causa: 1500.5, arquivado_em: null });
      });

      it('quando o número já existe no mesmo tipo, então é recusado; no outro tipo, pode', async () => {
        // Dado
        await novoProcesso({ numero: NUMERO });
        // Quando
        const repetido = novoProcesso({ numero: ' ' + NUMERO + ' ' });
        const noOutroTipo = novoProcesso({ numero: NUMERO, tipo: 'administrativo' });
        // Então
        await expect(repetido).rejects.toThrow('Já existe um processo com esse número.');
        await expect(noOutroTipo).resolves.toMatchObject({ id: expect.any(String) });
      });

      it('quando o número é o mesmo com outra pontuação ou maiúsculas, então também é recusado', async () => {
        // Dado
        const numero = marca().replace(' ', '');
        await novoProcesso({ tipo: 'administrativo', numero: numero + '-1' });
        await novoProcesso({ numero: NUMERO });
        // Quando
        const outraEscrita = novoProcesso({ tipo: 'administrativo', numero: numero.toLowerCase() + ' 1' });
        const semPontos = novoProcesso({ numero: NUMERO.replace(/\D/g, '') });
        // Então
        await expect(outraEscrita).rejects.toThrow('Já existe um processo com esse número.');
        await expect(semPontos).rejects.toThrow('Já existe um processo com esse número.');
      });

      it('quando o colaborador é de fora, ou passa do limite, então é recusado', async () => {
        // Quando
        const deFora = novoProcesso({ colaboradores: ['u-de-fora'] });
        // Então
        await expect(deFora).rejects.toThrow('O colaborador precisa ser alguém da equipe do escritório.');
      });

      it('quando o novo responsável era colaborador, então ele sai dos colaboradores', async () => {
        // Dado
        const { id } = await novoProcesso({ responsavel_id: 'u-ana', colaboradores: ['u-bruno'] });
        // Quando
        await SD.processoAtualizar(id, { responsavel_id: 'u-bruno' });
        // Então
        expect(await SD.processoObter(id)).toMatchObject({ responsavel_id: 'u-bruno', colaboradores: [] });
      });

      it('quando a coluna é do quadro do outro tipo, então criar é recusado', async () => {
        // Dado
        const [administrativa] = await SD.colunasListar('processos_administrativos');
        // Quando
        const criar = novoProcesso({ tipo: 'judicial', etapa_id: administrativa.id, etapa_ordem: 1 });
        // Então
        await expect(criar).rejects.toThrow('Você não tem permissão para fazer isso.');
      });

      it('quando a coluna é excluída, então o processo vai para "sem situação"', async () => {
        // Dado
        const coluna = (await SD.colunasListar('processos_judiciais')).find(c => !c.marco)!;
        const { id } = await novoProcesso({ etapa_id: coluna.id, etapa_ordem: 1 });
        // Quando
        await SD.colunaExcluir(coluna.id);
        // Então
        expect((await SD.processoObter(id))?.etapa_id).toBeNull();
        expect((await SD.processosDaEtapa(null, { tipo: 'judicial' })).linhas.map(p => p.id)).toContain(id);
      });

      it('quando ordena por nome, então vale o nome do cartão ou, sem ele, os clientes', async () => {
        // Dado
        const parte = marca();
        const { id: ana } = await criar('ANA ' + parte), { id: bia } = await criar('ZÉ ' + parte);
        const base = { tipo: 'judicial' as const, responsavel_id: 'u-ana' };
        const a = await SD.processoCriar({ ...base, numero: marca(), clientes: [ana] });
        const m = await SD.processoCriar({ ...base, numero: marca(), clientes: [bia], titulo: 'Marca ' + parte });
        const z = await SD.processoCriar({ ...base, numero: marca(), clientes: [bia] });
        // Quando
        const r = await SD.processosListar({ tipo: 'judicial', termo: parte, ordem: 'nome' });
        // Então
        expect(r.linhas.map(p => p.id)).toEqual([a.id, m.id, z.id]);
      });

      it('quando não há cliente, ou o responsável é de fora, então é recusado com a mensagem em português', async () => {
        // Quando
        const semCliente = SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [] });
        const deFora = novoProcesso({ responsavel_id: 'u-de-fora' });
        // Então
        await expect(semCliente).rejects.toThrow('Escolha pelo menos um cliente.');
        await expect(deFora).rejects.toThrow('O responsável precisa ser alguém da equipe do escritório.');
      });

      it('quando o responsável também está nos colaboradores, então ele não fica repetido', async () => {
        // Quando
        const { id } = await novoProcesso({ responsavel_id: 'u-ana', colaboradores: ['u-ana', 'u-bruno'] });
        // Então
        expect((await SD.processoObter(id))?.colaboradores).toEqual(['u-bruno']);
      });

      it('quando lista, então cada quadro só traz o seu tipo, e os filtros valem', async () => {
        // Dado
        const nome = marca();
        const { id: cliente } = await criar(nome);
        const base = { responsavel_id: 'u-ana', clientes: [cliente] };
        const judicial = await SD.processoCriar({ ...base, tipo: 'judicial', numero: NUMERO, orgao: 'TJMG', colaboradores: ['u-bruno'] });
        const adm = await SD.processoCriar({ ...base, tipo: 'administrativo', numero: 'INPI 1', orgao: 'INPI' });
        const ids = async (f: Parameters<Dados['processosListar']>[0]) => (await SD.processosListar(f)).linhas.map(p => p.id);
        // Então
        expect(await ids({ tipo: 'judicial', termo: nome })).toEqual([judicial.id]);
        expect(await ids({ tipo: 'administrativo', termo: nome })).toEqual([adm.id]);
        expect(await ids({ tipo: 'judicial', termo: '00056781320268130433' })).toEqual([judicial.id]);
        expect(await ids({ tipo: 'judicial', termo: nome, pessoa: 'u-bruno' })).toEqual([judicial.id]);
        expect(await ids({ tipo: 'administrativo', termo: nome, pessoa: 'u-bruno' })).toEqual([]);
        expect(await ids({ tipo: 'judicial', termo: nome, orgao: 'TJMG' })).toEqual([judicial.id]);
        expect(await ids({ tipo: 'judicial', termo: nome, orgao: 'TRF6' })).toEqual([]);
        expect((await SD.processoSugestoes('administrativo')).orgaos).toContain('INPI');
        expect((await SD.processoSugestoes('judicial')).orgaos).not.toContain('INPI');
      });

      it('quando já há comarca e vara em outros processos, então elas aparecem como sugestões', async () => {
        // Dado
        const comarca = marca(), vara = marca();
        await novoProcesso({ comarca, vara });
        // Quando
        const s = await SD.processoSugestoes('judicial');
        // Então
        expect(s.comarcas).toContain(comarca);
        expect(s.varas).toContain(vara);
      });

      it('quando o filtro é por etiqueta, então só vêm os processos com ela', async () => {
        // Dado
        const nome = marca();
        const { id: cliente } = await criar(nome);
        const base = { tipo: 'judicial' as const, responsavel_id: 'u-ana', clientes: [cliente] };
        const com = await SD.processoCriar({ ...base, numero: marca() });
        await SD.processoCriar({ ...base, numero: marca() });
        const etiqueta = await SD.etiquetaCriar('verde', marca());
        // Quando
        await SD.etiquetaAplicarEmLote('processos', [com.id], etiqueta.id);
        const r = await SD.processosListar({ tipo: 'judicial', termo: nome, etiqueta: etiqueta.id });
        // Então
        expect(r.linhas.map(p => p.id)).toEqual([com.id]);
        expect(r.linhas[0].etq).toEqual([{ etiqueta_id: etiqueta.id }]);
      });

      it('quando o processo muda de coluna, então vale só uma coluna do quadro do tipo dele, e o histórico guarda o nome', async () => {
        // Dado
        const { id } = await novoProcesso();
        const [judiciais, administrativas] = await Promise.all([SD.colunasListar('processos_judiciais'), SD.colunasListar('processos_administrativos')]);
        // Quando
        await SD.processoMover(id, judiciais[1].id, 1);
        // Então
        expect((await SD.processosDaEtapa(judiciais[1].id, { tipo: 'judicial' })).linhas.map(p => p.id)).toContain(id);
        await expect(SD.processoMover(id, administrativas[0].id, 1)).rejects.toThrow('Você não tem permissão para fazer isso.');
        expect((await SD.processoHistorico(id))[0].alteracoes.etapa.para).toBe(judiciais[1].nome);
      });

      it('quando um campo muda, então ele entra no histórico', async () => {
        // Dado
        const { id } = await novoProcesso({ comarca: 'Montes Claros' });
        // Quando
        await SD.processoAtualizar(id, { comarca: 'Bocaiuva' });
        // Então
        expect((await SD.processoHistorico(id))[0].alteracoes.comarca).toEqual({ de: 'Montes Claros', para: 'Bocaiuva' });
      });

      it('quando se pedem os processos de uma pessoa, então vêm os dela, com o papel dela em cada um', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        const { id } = await novoProcesso({ clientes: [cliente], colaboradores: ['u-bruno'] });
        // Quando
        const doCliente = await SD.processosDaPessoa(cliente);
        const doBruno = await SD.processosDaPessoa('p-bruno', 'u-bruno');
        // Então
        expect(doCliente.map(p => [p.id, p.papeis])).toEqual([[id, ['cliente']]]);
        expect(doBruno.find(p => p.id === id)?.papeis).toEqual(['colaborador']);
      });

      it('quando a pessoa é cliente de um processo, então não pode ser excluída', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        await novoProcesso({ clientes: [cliente] });
        await SD.pessoasArquivar([cliente]);
        // Quando
        const r = await SD.pessoasExcluir([cliente]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em processos e não pode ser excluída.' });
      });

      it('quando o processo está ativo, então não é excluído; arquivado, é', async () => {
        // Dado
        const { id } = await novoProcesso();
        // Quando
        const ativo = await SD.processosExcluir([id]);
        await SD.processosArquivar([id]);
        const arquivado = await SD.processosExcluir([id]);
        // Então
        expect([ativo.excluidas, arquivado.excluidas]).toEqual([0, 1]);
        expect(await SD.processoObter(id)).toBeNull();
      });

      it('quando o quadro é listado, então cada tipo tem as suas colunas, com início e fim marcados, e os grupos (o judicial com "Acompanhamento", #315)', async () => {
        // Quando
        const [judiciais, administrativas, grupos] = await Promise.all([SD.colunasListar('processos_judiciais'), SD.colunasListar('processos_administrativos'), SD.gruposListar('processos_judiciais')]);
        // Então
        expect(judiciais).toHaveLength(31);
        expect(administrativas).toHaveLength(20);
        expect(judiciais.filter(c => c.marco).map(c => [c.nome, c.marco])).toEqual([['Distribuído', 'inicio'], ['Baixado/arquivado', 'concluido']]);
        expect(administrativas.filter(c => c.marco).map(c => [c.nome, c.marco])).toEqual([['Protocolado', 'inicio'], ['Arquivado/baixado', 'concluido']]);
        expect(grupos.map(g => [g.nome, g.comeca_fechado])).toContainEqual(['Encerrado', true]);
        expect(grupos.map(g => g.nome).slice(-2)).toEqual(['Acompanhamento', 'Encerrado']);
      });

      it('quando acrescenta uma opção à lista, então ela volta na lista; repetida, é recusada', async () => {
        // Dado
        const valor = marca();
        // Quando
        const nova = await SD.processoOpcaoCriar('sistema', '  ' + valor + ' ');
        // Então
        expect(nova).toMatchObject({ campo: 'sistema', valor });
        expect((await SD.processoOpcoes()).map(o => o.valor)).toContain(valor);
        await expect(SD.processoOpcaoCriar('sistema', valor.toLowerCase())).rejects.toThrow('Essa opção já está na lista.');
        await expect(SD.processoOpcaoCriar('area', valor)).resolves.toMatchObject({ campo: 'area' });
      });

      it('quando retira uma opção da lista, então ela não volta mais, e pode ser acrescentada de novo', async () => {
        // Dado
        const valor = marca();
        const { id } = await SD.processoOpcaoCriar('sistema', valor);
        // Quando
        await SD.processoOpcaoExcluir(id);
        // Então
        expect((await SD.processoOpcoes()).map(o => o.valor)).not.toContain(valor);
        await expect(SD.processoOpcaoCriar('sistema', valor)).resolves.toMatchObject({ valor });
      });
    });

    describe('Andamentos e prazos dos processos', () => {
      const novoProcesso = async () => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
      };
      const ANDAMENTO = { tipo: 'andamento' as const, data: '2026-11-10', hora: null, local: null, texto: 'Juntada de petição' };
      const PRAZO_DIGITADO = { descricao: 'Contestação', final: '2026-12-01', intimacao: null, dias: null, contagem: null, disponibilizacao: false, sem_recesso: false, andamento_id: null };
      const INVALIDO = 'Algum campo está em formato inválido.';
      const historico = async (id: string) => (await SD.processoHistorico(id)).map(h => h.alteracoes);

      it('quando lança andamentos, então voltam dos mais novos aos mais antigos, com o texto limpo', async () => {
        // Dado
        const { id } = await novoProcesso();
        // Quando
        await SD.processoAndamentoCriar(id, { ...ANDAMENTO, data: '2026-01-01', texto: ' Antigo ' });
        await SD.processoAndamentoCriar(id, { ...ANDAMENTO, data: '2026-06-01', texto: 'Novo' });
        // Então
        expect((await SD.processoAndamentos(id)).map(a => a.texto)).toEqual(['Novo', 'Antigo']);
      });

      it('quando é audiência, então guarda hora e local; a hora volta como hh:mm', async () => {
        // Dado
        const { id } = await novoProcesso();
        // Quando
        const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, tipo: 'audiencia', hora: '14:30', local: ' Fórum ' });
        // Então
        expect(a).toMatchObject({ hora: '14:30', local: 'Fórum' });
      });

      it.each([
        ['hora em andamento comum', { hora: '10:00' }], ['local em intimação', { tipo: 'intimacao' as const, local: 'x' }], ['texto vazio', { texto: '   ' }],
        ['data fora do calendário', { data: '1999-01-01' }], ['data que não existe', { data: '2026-02-31' }]
      ])('quando o andamento tem %s, então é recusado', async (_caso, extra) => {
        // Dado
        const { id } = await novoProcesso();
        // Quando
        const salvar = SD.processoAndamentoCriar(id, { ...ANDAMENTO, ...extra });
        // Então
        await expect(salvar).rejects.toThrow(INVALIDO);
      });

      it('quando marca como tratada algo que não é intimação, então é recusado', async () => {
        // Dado
        const { id } = await novoProcesso();
        const a = await SD.processoAndamentoCriar(id, ANDAMENTO);
        // Quando
        const salvar = SD.processoAndamentoAtualizar(a.id, { tratada_em: new Date().toISOString() });
        // Então
        await expect(salvar).rejects.toThrow(INVALIDO);
      });

      it.each([
        ['cálculo pela metade', { intimacao: '2026-11-10' }], ['dias demais', { intimacao: '2026-11-10', dias: 1831, contagem: 'uteis' as const }],
        ['dias zerados', { intimacao: '2026-11-10', dias: 0, contagem: 'uteis' as const }], ['descrição vazia', { descricao: ' ' }], ['último dia fora do calendário', { final: '2101-01-01' }]
      ])('quando o prazo tem %s, então é recusado', async (_caso, extra) => {
        // Dado
        const { id } = await novoProcesso();
        // Quando
        const salvar = SD.processoPrazoCriar(id, { ...PRAZO_DIGITADO, ...extra });
        // Então
        await expect(salvar).rejects.toThrow(INVALIDO);
      });

      it('quando o prazo aponta o andamento de outro processo, então é recusado', async () => {
        // Dado
        const [a, b] = [await novoProcesso(), await novoProcesso()];
        const andamento = await SD.processoAndamentoCriar(a.id, ANDAMENTO);
        // Quando
        const salvar = SD.processoPrazoCriar(b.id, { ...PRAZO_DIGITADO, andamento_id: andamento.id });
        // Então
        await expect(salvar).rejects.toThrow('Este andamento não é deste processo.');
      });

      it('quando exclui a intimação, o prazo que nasceu dela continua; ao desfazer, ela volta como estava, com a mesma ligação', async () => {
        // Dado
        const { id } = await novoProcesso();
        const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, tipo: 'intimacao' });
        await SD.processoPrazoCriar(id, { ...PRAZO_DIGITADO, andamento_id: a.id });
        // Quando
        await SD.processoAndamentoExcluir(a.id);
        // Então
        expect(await SD.processoAndamentos(id)).toEqual([]);
        expect(await SD.processoPrazos(id)).toHaveLength(1);
        // Quando
        await SD.processoAndamentoRestaurar(a.id);
        // Então
        expect(await SD.processoAndamentos(id)).toEqual([a]);
        expect((await SD.processoPrazos(id))[0].andamento_id).toBe(a.id);
      });

      it('quando exclui o prazo e desfaz, então ele volta como estava, cumprido e com a tarefa', async () => {
        // Dado
        const { id } = await novoProcesso();
        const t = await SD.tarefaCriar({ titulo: 'Cumprir', responsavel_id: 'u-ana', processo_id: id });
        const z = await SD.processoPrazoCriar(id, PRAZO_DIGITADO);
        const antes = await SD.processoPrazoAtualizar(z.id, { tarefa_id: t.id, concluido_em: new Date().toISOString() });
        // Quando
        await SD.processoPrazoExcluir(z.id);
        expect(await SD.processoPrazos(id)).toEqual([]);
        await SD.processoPrazoRestaurar(z.id);
        // Então
        expect(await SD.processoPrazos(id)).toEqual([antes]);
      });

      it('quando muda o prazo, então o histórico mostra como estava e como ficou; o que não muda a linha não entra', async () => {
        // Dado
        const { id } = await novoProcesso();
        const z = await SD.processoPrazoCriar(id, PRAZO_DIGITADO);
        expect((await historico(id))[0].prazo).toEqual({ de: null, para: 'Contestação: 01/12/2026' });
        // Quando
        await SD.processoPrazoAtualizar(z.id, { final: '2026-12-15' });
        await SD.processoPrazoAtualizar(z.id, { concluido_em: new Date().toISOString() });
        const antes = (await historico(id)).length;
        await SD.processoPrazoAtualizar(z.id, { sem_recesso: true });
        // Então
        const h = await historico(id);
        expect(h).toHaveLength(antes);
        expect(h[1].prazo).toEqual({ de: 'Contestação: 01/12/2026', para: 'Contestação: 15/12/2026' });
        expect(h[0].prazo).toEqual({ de: 'Contestação: 15/12/2026', para: 'Contestação: 15/12/2026 (cumprido)' });
      });

      it('quando exclui o andamento e desfaz, então o histórico registra o que saiu e o que voltou', async () => {
        // Dado
        const { id } = await novoProcesso();
        const a = await SD.processoAndamentoCriar(id, ANDAMENTO);
        // Quando
        await SD.processoAndamentoExcluir(a.id);
        // Então
        expect((await historico(id))[0].andamento).toEqual({ de: 'Andamento de 10/11/2026: Juntada de petição', para: null });
        // Quando
        await SD.processoAndamentoRestaurar(a.id);
        // Então
        expect((await historico(id))[0].andamento).toEqual({ de: null, para: 'Andamento de 10/11/2026: Juntada de petição' });
      });

      it('quando muda o texto depois de muitos caracteres, ou marca a intimação como tratada, então entra no histórico', async () => {
        // Dado
        const { id } = await novoProcesso();
        const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, tipo: 'intimacao', texto: 'y'.repeat(300) });
        // Quando
        await SD.processoAndamentoAtualizar(a.id, { texto: 'y'.repeat(299) + 'z' });
        // Então
        expect((await historico(id))[0].andamento?.para).toContain('y'.repeat(299) + 'z');
        // Quando
        await SD.processoAndamentoAtualizar(a.id, { tratada_em: new Date().toISOString() });
        // Então
        expect((await historico(id))[0].andamento?.para).toContain('(tratada)');
      });

      it('quando excluem a tarefa da intimação, então ela volta a ficar a tratar', async () => {
        // Dado
        const { id } = await novoProcesso();
        const t = await SD.tarefaCriar({ titulo: 'Cumprir', responsavel_id: 'u-ana', processo_id: id });
        const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, tipo: 'intimacao' });
        await SD.processoAndamentoAtualizar(a.id, { tarefa_id: t.id, tratada_em: new Date().toISOString() });
        // Quando
        await SD.tarefasArquivar([t.id], true);
        await SD.tarefasExcluir([t.id]);
        // Então
        expect((await SD.processoAndamentos(id))[0]).toMatchObject({ tarefa_id: null, tratada_em: null });
      });

      it('quando o item já tem tarefa, então outra não entra no lugar', async () => {
        // Dado
        const { id } = await novoProcesso();
        const [t1, t2] = [await SD.tarefaCriar({ titulo: 'Uma', responsavel_id: 'u-ana', processo_id: id }), await SD.tarefaCriar({ titulo: 'Outra', responsavel_id: 'u-ana', processo_id: id })];
        const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, tipo: 'intimacao' }), z = await SD.processoPrazoCriar(id, PRAZO_DIGITADO);
        await SD.processoAndamentoAtualizar(a.id, { tarefa_id: t1.id });
        await SD.processoPrazoAtualizar(z.id, { tarefa_id: t1.id });
        // Quando
        const noAndamento = SD.processoAndamentoAtualizar(a.id, { tarefa_id: t2.id });
        const noPrazo = SD.processoPrazoAtualizar(z.id, { tarefa_id: t2.id });
        // Então
        await expect(noAndamento).rejects.toThrow('Já existe uma tarefa ligada a este item.');
        await expect(noPrazo).rejects.toThrow('Já existe uma tarefa ligada a este item.');
      });

      // Antes do #294 a ligação nascia com a tarefa e não mudava; agora se troca e se tira, só por um processo ativo.
      it('quando a tarefa aponta um processo que não existe, ou troca por um arquivado, então é recusado', async () => {
        // Dado
        const [p, arquivado] = [await novoProcesso(), await novoProcesso()];
        await SD.processosArquivar([arquivado.id], true);
        const t = await SD.tarefaCriar({ titulo: 'Ligada', responsavel_id: 'u-ana', processo_id: p.id });
        // Quando
        const inexistente = SD.tarefaCriar({ titulo: 'Fora', responsavel_id: 'u-ana', processo_id: 'nao-existe' });
        const trocarPorArquivado = SD.tarefaAtualizar(t.id, { processo_id: arquivado.id });
        // Então
        await expect(inexistente).rejects.toThrow('Processo não encontrado neste escritório.');
        await expect(trocarPorArquivado).rejects.toThrow('Processo não encontrado neste escritório.');
        expect((await SD.tarefaObter(t.id))?.processo_id).toBe(p.id);
      });

      it('quando a tarefa troca de processo e depois o tira, então o cartão mostra o novo, a tarefa sai do antigo e o histórico guarda as duas mudanças', async () => {
        // Dado
        const [p, q] = [await novoProcesso(), await novoProcesso()];
        const t = await SD.tarefaCriar({ titulo: 'Trocar', responsavel_id: 'u-ana', processo_id: p.id });
        // Quando
        await SD.tarefaAtualizar(t.id, { processo_id: q.id });
        // Então
        expect(await SD.tarefaObter(t.id)).toMatchObject({ processo_id: q.id, processo: { id: q.id, codigo: q.codigo } });
        expect((await SD.tarefasDoProcesso(p.id)).map(x => x.id)).not.toContain(t.id);
        expect((await SD.tarefasDoProcesso(q.id)).map(x => x.id)).toContain(t.id);
        // Quando
        await SD.tarefaAtualizar(t.id, { processo_id: null });
        // Então
        expect(await SD.tarefaObter(t.id)).toMatchObject({ processo_id: null, processo: null });
        const historico = await SD.tarefaHistorico(t.id);
        expect(historico.map(h => h.alteracoes.processo)).toEqual(expect.arrayContaining([{ de: expect.any(String), para: null }, { de: expect.any(String), para: expect.any(String) }]));
      });

      it('quando o processo está arquivado, então lê, mas não lança, não muda e não exclui', async () => {
        // Dado
        const { id } = await novoProcesso();
        const a = await SD.processoAndamentoCriar(id, ANDAMENTO);
        const z = await SD.processoPrazoCriar(id, PRAZO_DIGITADO);
        await SD.processosArquivar([id], true);
        // Quando
        const tentativas = [
          SD.processoAndamentoCriar(id, ANDAMENTO), SD.processoPrazoCriar(id, PRAZO_DIGITADO), SD.processoAndamentoAtualizar(a.id, { texto: 'x' }),
          SD.processoPrazoAtualizar(z.id, { descricao: 'x' }), SD.processoAndamentoExcluir(a.id), SD.processoPrazoExcluir(z.id),
          SD.processoAndamentoRestaurar(a.id), SD.processoPrazoRestaurar(z.id)
        ];
        const resultados = await Promise.allSettled(tentativas);
        // Então
        expect(resultados.every(r => r.status === 'rejected')).toBe(true);
        expect(await SD.processoAndamentos(id)).toHaveLength(1);
        expect(await SD.processoPrazos(id)).toHaveLength(1);
      });

      it('quando a tarefa nasce ligada ao processo, então aparece no cartão do processo, e o cartão da tarefa mostra o processo', async () => {
        // Dado
        const p = await novoProcesso();
        // Quando
        const t = await SD.tarefaCriar({ titulo: 'Cumprir', responsavel_id: 'u-ana', processo_id: p.id });
        // Então
        expect((await SD.tarefasDoProcesso(p.id)).map(x => x.id)).toEqual([t.id]);
        expect((await SD.tarefaObter(t.id))?.processo).toMatchObject({ id: p.id });
      });

      it('quando excluem a tarefa, então a intimação fica sem a ligação; quando excluem o processo, a tarefa fica sem o processo', async () => {
        // Dado
        const p = await novoProcesso();
        const a = await SD.processoAndamentoCriar(p.id, { ...ANDAMENTO, tipo: 'intimacao' });
        const t1 = await SD.tarefaCriar({ titulo: 'Uma', responsavel_id: 'u-ana', processo_id: p.id }), t2 = await SD.tarefaCriar({ titulo: 'Outra', responsavel_id: 'u-ana', processo_id: p.id });
        const ligado = await SD.processoAndamentoAtualizar(a.id, { tarefa_id: t1.id, tratada_em: new Date().toISOString() });
        expect(ligado.tarefa?.codigo).toBe(t1.codigo);
        // Quando
        await SD.tarefasArquivar([t1.id], true);
        await SD.tarefasExcluir([t1.id]);
        // Então
        expect((await SD.processoAndamentos(p.id))[0]).toMatchObject({ tarefa_id: null, tarefa: null, tratada_em: null });
        // Quando
        await SD.processosArquivar([p.id], true);
        await SD.processosExcluir([p.id]);
        // Então
        expect(await SD.processoAndamentos(p.id)).toEqual([]);
        expect(await SD.tarefaObter(t2.id)).toMatchObject({ processo_id: null, processo: null });
      });

      describe('Tipo da lista pronta (#362)', () => {
        it('quando lança um despacho, então ele volta com o tipo, e o histórico começa por ele; sem o tipo, fica vazio, como os de antes', async () => {
          // Dado
          const { id } = await novoProcesso();
          // Quando
          const despacho = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, categoria: 'despacho', texto: 'Cite-se' });
          const semTipo = await SD.processoAndamentoCriar(id, ANDAMENTO);
          // Então
          expect(despacho).toMatchObject({ tipo: 'andamento', categoria: 'despacho' });
          expect(semTipo).toMatchObject({ tipo: 'andamento', categoria: null });
          expect(await historico(id)).toContainEqual({ andamento: { de: null, para: 'Despacho de 10/11/2026: Cite-se' } });
        });

        it.each([
          ['despacho numa intimação', { tipo: 'intimacao' as const, categoria: 'despacho' as const }],
          ['audiência num andamento comum', { categoria: 'audiencia' as const }],
          ['um tipo fora da lista', { categoria: 'citacao' as unknown as 'despacho' }]
        ])('quando o tipo da lista é %s, então é recusado', async (_caso, extra) => {
          // Dado
          const { id } = await novoProcesso();
          // Quando
          const salvar = SD.processoAndamentoCriar(id, { ...ANDAMENTO, ...extra });
          // Então
          await expect(salvar).rejects.toThrow(INVALIDO);
        });

        it('quando muda o despacho para sentença, então o tipo muda e o histórico mostra os dois; desfazer volta o despacho', async () => {
          // Dado
          const { id } = await novoProcesso();
          const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, categoria: 'despacho', texto: 'Texto' });
          // Quando
          const mudado = await SD.processoAndamentoAtualizar(a.id, { categoria: 'sentenca' });
          // Então
          expect(mudado.categoria).toBe('sentenca');
          expect(await historico(id)).toContainEqual({ andamento: { de: 'Despacho de 10/11/2026: Texto', para: 'Sentença de 10/11/2026: Texto' } });
          // Quando
          await SD.processoAndamentoAtualizar(a.id, { tipo: 'andamento', categoria: 'despacho' });
          // Então
          expect((await SD.processoAndamentos(id))[0].categoria).toBe('despacho');
        });

        it('quando a versão anterior do site muda só o tipo de sempre de um despacho para intimação, então a mudança vale e o andamento fica sem tipo da lista', async () => {
          // Dado
          const { id } = await novoProcesso();
          const a = await SD.processoAndamentoCriar(id, { ...ANDAMENTO, categoria: 'despacho' });
          // Quando
          const mudado = await SD.processoAndamentoAtualizar(a.id, { tipo: 'intimacao' });
          // Então
          expect(mudado).toMatchObject({ tipo: 'intimacao', categoria: null });
        });
      });
    });

    describe('Demandas relacionadas (#310)', () => {
      const novaDemanda = async () => {
        const { id: cliente } = await criar(marca());
        return SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
      };
      const ids = async (demandaId: string) => (await SD.demandasRelacionadas(demandaId)).map(r => r.id);

      it('quando liga uma à outra, então cada uma mostra a outra com o número; ligar de novo, no outro sentido, não repete', async () => {
        // Dado
        const [d, e] = [await novaDemanda(), await novaDemanda()];
        // Quando
        const nova = await SD.demandaRelacionar(d.id, e.id);
        const deNovo = await SD.demandaRelacionar(e.id, d.id);
        // Então
        expect([nova, deNovo]).toEqual([true, false]);
        expect(await SD.demandasRelacionadas(d.id)).toEqual([expect.objectContaining({ id: e.id, codigo: e.codigo, demanda: expect.objectContaining({ arquivado_em: null }) })]);
        expect((await SD.demandasRelacionadas(e.id))[0]).toMatchObject({ id: d.id, codigo: d.codigo });
      });

      it('quando tenta ligar a demanda a ela mesma, ou a uma arquivada, então é recusado', async () => {
        // Dado
        const [d, arquivada] = [await novaDemanda(), await novaDemanda()];
        await SD.demandasArquivar([arquivada.id], true);
        // Quando
        const mesma = SD.demandaRelacionar(d.id, d.id);
        const comArquivada = SD.demandaRelacionar(d.id, arquivada.id);
        // Então
        await expect(mesma).rejects.toThrow(MESMA_DEMANDA);
        await expect(comArquivada).rejects.toThrow('Você não tem permissão para fazer isso.');
        expect(await SD.demandasRelacionadas(d.id)).toEqual([]);
      });

      it('quando desfaz a ligação num dos lados, então ela some dos dois, e as outras ficam', async () => {
        // Dado
        const [d, e, f] = [await novaDemanda(), await novaDemanda(), await novaDemanda()];
        await SD.demandaRelacionar(d.id, e.id);
        await SD.demandaRelacionar(d.id, f.id);
        // Quando
        await SD.demandaDesrelacionar(e.id, d.id);
        // Então
        expect(await ids(d.id)).toEqual([f.id]);
        expect(await ids(e.id)).toEqual([]);
      });

      it('quando desfaz o que não está ligado, então é recusado', async () => {
        // Dado
        const [d, e] = [await novaDemanda(), await novaDemanda()];
        // Quando
        const desfazer = SD.demandaDesrelacionar(d.id, e.id);
        // Então
        await expect(desfazer).rejects.toThrow('Você não tem permissão para fazer isso.');
      });

      it('quando uma das duas é arquivada depois de ligada, então a ligação continua e ainda se desfaz', async () => {
        // Dado
        const [d, e] = [await novaDemanda(), await novaDemanda()];
        await SD.demandaRelacionar(d.id, e.id);
        // Quando
        await SD.demandasArquivar([e.id], true);
        // Então
        expect((await SD.demandasRelacionadas(d.id))[0].demanda?.arquivado_em).toBeTruthy();
        await SD.demandaDesrelacionar(d.id, e.id);
        expect(await ids(d.id)).toEqual([]);
      });

      it('quando uma das duas é excluída, então a ligação sai junto', async () => {
        // Dado
        const [d, e] = [await novaDemanda(), await novaDemanda()];
        await SD.demandaRelacionar(d.id, e.id);
        // Quando
        await SD.demandasArquivar([e.id], true);
        await SD.demandasExcluir([e.id]);
        // Então
        expect(await ids(d.id)).toEqual([]);
      });
    });

    describe('Processo e demanda', () => {
      const novoProcesso = async () => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
      };
      const novaDemanda = async () => {
        const { id: cliente } = await criar(marca());
        return SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
      };

      it('quando liga, então a demanda aparece no processo e o processo na demanda; ligar de novo não repete e diz que já existia', async () => {
        // Dado
        const [p, d] = [await novoProcesso(), await novaDemanda()];
        // Quando
        const nova = await SD.processoDemandaLigar(p.id, d.id);
        const deNovo = await SD.processoDemandaLigar(p.id, d.id);
        // Então
        expect([nova, deNovo]).toEqual([true, false]);
        expect((await SD.demandasDoProcesso(p.id)).map(x => x.id)).toEqual([d.id]);
        expect((await SD.processosDaDemanda(d.id)).visiveis.map(x => x.id)).toEqual([p.id]);
      });

      it('quando o processo está arquivado, ou a demanda não existe, então é recusado', async () => {
        // Dado
        const [p, d] = [await novoProcesso(), await novaDemanda()];
        await SD.processosArquivar([p.id], true);
        const q = await novoProcesso();
        // Quando
        const arquivado = SD.processoDemandaLigar(p.id, d.id);
        const inexistente = SD.processoDemandaLigar(q.id, 'nao-existe');
        // Então
        await expect(arquivado).rejects.toThrow('Você não tem permissão para fazer isso.');
        await expect(inexistente).rejects.toThrow('Você não tem permissão para fazer isso.');
      });

      it('quando excluem o processo ou a demanda, então a ligação sai', async () => {
        // Dado
        const [p, d, e] = [await novoProcesso(), await novaDemanda(), await novaDemanda()];
        await SD.processoDemandaLigar(p.id, d.id);
        await SD.processoDemandaLigar(p.id, e.id);
        // Quando
        await SD.demandasArquivar([e.id], true);
        await SD.demandasExcluir([e.id]);
        // Então
        expect((await SD.demandasDoProcesso(p.id)).map(x => x.id)).toEqual([d.id]);
        // Quando
        await SD.processosArquivar([p.id], true);
        await SD.processosExcluir([p.id]);
        // Então
        expect(await SD.processosDaDemanda(d.id)).toEqual({ visiveis: [], ocultos: 0 });
      });

      it('quando a demanda tem vários processos e um é desligado, então só ele sai, dos dois lados', async () => {
        // Dado
        const [p, q, d] = [await novoProcesso(), await novoProcesso(), await novaDemanda()];
        await SD.processoDemandaLigar(p.id, d.id, 'atua');
        await SD.processoDemandaLigar(q.id, d.id, 'atua');
        // Quando
        await SD.processoDemandaDesligar(p.id, d.id);
        // Então
        expect((await SD.processosDaDemanda(d.id)).visiveis.map(x => x.id)).toEqual([q.id]);
        expect(await SD.demandasDoProcesso(p.id)).toEqual([]);
      });

      it('quando desliga o que não está ligado, então é recusado', async () => {
        // Dado
        const [p, d] = [await novoProcesso(), await novaDemanda()];
        // Quando
        const desligar = SD.processoDemandaDesligar(p.id, d.id);
        // Então
        await expect(desligar).rejects.toThrow('Você não tem permissão para fazer isso.');
      });

      it('quando o processo foi arquivado depois de ligado, então ainda se desliga', async () => {
        // Dado
        const [p, d] = [await novoProcesso(), await novaDemanda()];
        await SD.processoDemandaLigar(p.id, d.id, 'atua');
        await SD.processosArquivar([p.id], true);
        // Quando
        await SD.processoDemandaDesligar(p.id, d.id);
        // Então
        expect(await SD.processosDaDemanda(d.id)).toEqual({ visiveis: [], ocultos: 0 });
      });

      it('quando a busca de processo lista o que se pode ligar, então os arquivados ficam de fora', async () => {
        // Dado
        const [p, arquivado] = [await novoProcesso(), await novoProcesso()];
        await SD.processosArquivar([arquivado.id], true);
        // Quando
        const achados = (await SD.processosParaLigar()).map(x => x.id);
        // Então
        expect(achados).toContain(p.id);
        expect(achados).not.toContain(arquivado.id);
      });
    });

    describe('Processo e contrato (#294)', () => {
      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      afterEach(() => entrarComo('u-master'));
      const novoProcesso = async () => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
      };
      const novoContrato = async () => {
        const { id: cliente } = await criar(marca());
        return SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
      };

      it('quando liga dois processos ao contrato, então eles aparecem no contrato e o contrato aparece em cada processo; ligar de novo não repete e diz que já existia', async () => {
        // Dado
        const [k, p, q] = [await novoContrato(), await novoProcesso(), await novoProcesso()];
        // Quando
        const novas = [await SD.contratoProcessoLigar(k.id, p.id), await SD.contratoProcessoLigar(k.id, q.id)];
        const deNovo = await SD.contratoProcessoLigar(k.id, p.id);
        // Então
        expect([...novas, deNovo]).toEqual([true, true, false]);
        expect((await SD.processosDoContrato(k.id)).visiveis.map(x => x.id)).toEqual([p.id, q.id]);
        expect(await SD.contratosDoProcesso(p.id)).toMatchObject({ visiveis: [{ id: k.id, codigo: k.codigo }], ocultos: 0 });
      });

      it('quando desliga, então o processo sai do contrato e o contrato sai do processo', async () => {
        // Dado
        const [k, p] = [await novoContrato(), await novoProcesso()];
        await SD.contratoProcessoLigar(k.id, p.id);
        // Quando
        await SD.contratoProcessoDesligar(k.id, p.id);
        // Então
        expect(await SD.processosDoContrato(k.id)).toEqual({ visiveis: [], ocultos: 0 });
        expect(await SD.contratosDoProcesso(p.id)).toEqual({ visiveis: [], ocultos: 0 });
      });

      it('quando o processo está arquivado, ou quem tenta não é parte do contrato, então ligar é recusado', async () => {
        // Dado
        const [k, p, arquivado] = [await novoContrato(), await novoProcesso(), await novoProcesso()];
        await SD.processosArquivar([arquivado.id], true);
        // Quando
        const comArquivado = SD.contratoProcessoLigar(k.id, arquivado.id);
        entrarComo('u-bruno');
        const deFora = SD.contratoProcessoLigar(k.id, p.id);
        // Então
        await expect(comArquivado).rejects.toThrow('Você não tem permissão para fazer isso.');
        await expect(deFora).rejects.toThrow('Você não tem permissão para fazer isso.');
      });

      it('quando quem não é parte abre o processo, então o contrato ligado só conta, sem abrir', async () => {
        // Dado
        const [k, p] = [await novoContrato(), await novoProcesso()];
        await SD.contratoProcessoLigar(k.id, p.id);
        // Quando
        entrarComo('u-bruno');
        const lidos = await SD.contratosDoProcesso(p.id);
        // Então
        expect(lidos).toEqual({ visiveis: [], ocultos: 1 });
      });

      it('quando excluem o contrato ou o processo, então a ligação sai', async () => {
        // Dado
        const [k, p, q] = [await novoContrato(), await novoProcesso(), await novoProcesso()];
        await SD.contratoProcessoLigar(k.id, p.id);
        await SD.contratoProcessoLigar(k.id, q.id);
        // Quando
        await SD.processosArquivar([q.id], true);
        await SD.processosExcluir([q.id]);
        // Então
        expect((await SD.processosDoContrato(k.id)).visiveis.map(x => x.id)).toEqual([p.id]);
        // Quando
        await SD.contratosArquivar([k.id], true);
        await SD.contratosExcluir([k.id]);
        // Então
        expect(await SD.contratosDoProcesso(p.id)).toEqual({ visiveis: [], ocultos: 0 });
      });
    });

    describe('Parcelas', () => {
      const novoContrato = async (extra: Parameters<Dados['contratoCriar']>[0] = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Marca'], categoria: 'pro_labore', valor: 1000, parcelas: 2, primeiro_pagamento: '2026-03-05', percentual_escritorio: 100, ...extra });
      };
      const assinar = async (id: string) => {
        const coluna = (await SD.colunasListar('contratos')).find(c => c.marco === 'assinado')!;
        await SD.contratoMover(id, coluna.id, 1);
      };
      const assinado = async (extra: Parameters<Dados['contratoCriar']>[0] = {}) => {
        const k = await novoContrato(extra);
        await assinar(k.id);
        return { ...k, parcelas: await SD.parcelasDoContrato(k.id) };
      };
      const contaPJ = async () => {
        const c = await SD.financeiroContaCriar({ nome: marca(), tem_das: true, saldo_inicial: 0, saldo_inicial_em: '2026-01-01' });
        await SD.financeiroDasSalvar('2026-01', 4.5);
        return c;
      };
      const receber = (parcela: string, conta: string, extra: Partial<Parameters<Dados['financeiroReceber']>[0]> = {}) =>
        SD.financeiroReceber({ parcela, conta, data: '2026-03-10', valor: 100000, taxa: 3000, ...extra });
      const lancamentos = (conta: string) => SD.financeiroLancamentos(conta, '2026-01-01', '2026-12-31');
      /** Um dia depois de todas as datas dos casos abaixo. */
      const HOJE_DEPOIS = '2027-01-01';
      const repassesDe = async (recebimento: string) => (await SD.financeiroRepasses('2026-01-01', '2026-12-31')).filter(r => r.recebimento_id === recebimento);

      it('quando o contrato chega à coluna de assinado, então as parcelas nascem, uma vez só', async () => {
        // Quando
        const k = await assinado();
        // Então
        expect(k.parcelas.map(p => [p.numero, p.vencimento, p.valor])).toEqual([[1, '2026-03-05', 50000], [2, '2026-04-05', 50000]]);
        await SD.contratoMover(k.id, (await SD.colunasListar('contratos')).find(c => !c.marco)!.id, 1);
        await assinar(k.id);
        expect(await SD.parcelasDoContrato(k.id)).toHaveLength(2);
      });

      describe('Meus valores', () => {
        // Quem está logado é o Mauro (p-mauro). Nos casos de quem recebe, a responsável é a Ana.
        const MARCO = { de: '2026-03-01', ate: '2026-03-31' };
        const NA_DIVISAO = { responsavel_id: 'u-ana', valor: 1000, parcelas: 1 };
        const meus = async (recebimento: string) => (await SD.financeiroMeusValores(MARCO.de, MARCO.ate)).filter(l => l.recebimento_id === recebimento);
        const aPassar = async (recebimento: string, de = MARCO.de, ate = MARCO.ate) => (await SD.financeiroAPassar(de, ate)).filter(v => v.recebimento_id === recebimento);
        const recebido = async (extra: Parameters<typeof novoContrato>[0] = {}) => {
          const k = await assinado(extra), conta = await contaPJ();
          return { k, conta, id: await receber(k.parcelas[0].id, conta.id) };
        };
        const comBruno = { participantes: [{ pessoa_id: 'p-bruno', percentual: 10 }] };

        it('dado o responsável com tudo na conta, quando o cliente paga, então vê o que o escritório deve a ele; pago o repasse, passa a recebido', async () => {
          // Dado
          const { id, conta, k } = await recebido();
          // Quando
          const [linha] = await meus(id);
          // Então
          expect(await meus(id)).toHaveLength(1);
          expect(linha).toEqual({
            recebimento_id: id, papel: 'responsavel', contrato_codigo: k.codigo, cliente_nome: expect.stringContaining('CONTRATO'), parcela_numero: 1, valor: 64750, situacao: 'a_receber',
            recebido_em: '2026-03-10', pago_em: null, de_quem: 'escritório'
          });
          // Quando
          const [rep] = await repassesDe(id);
          await SD.financeiroPagarRepasse(rep.id, conta.id, '2026-03-20');
          // Então
          expect((await meus(id))[0]).toMatchObject({ situacao: 'recebido', pago_em: '2026-03-20', recebido_em: '2026-03-10' });
          // Quando
          await SD.financeiroDesfazerPagamento(rep.id);
          // Então
          expect((await meus(id))[0]).toMatchObject({ situacao: 'a_receber', pago_em: null });
        });

        it('dado o responsável abaixo da parte integral, quando o cliente paga, então a parte que ficou com ele já é recebido, numa linha só', async () => {
          // Dado / Quando
          const { id } = await recebido({ percentual_escritorio: 30 });
          // Então: sem repasse, e R$ 1.000,00 menos os 30% na conta e a taxa de R$ 30,00
          expect(await repassesDe(id)).toEqual([]);
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'responsavel', valor: 67000, situacao: 'recebido', pago_em: '2026-03-10', de_quem: 'cliente' })]);
        });

        it('dado um participante, quando o responsável marca como pago, então a linha passa a recebido, sem lançamento no caixa; e dá para desfazer', async () => {
          // Dado
          const { id, conta } = await recebido({ ...NA_DIVISAO, participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }] });
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'participante', valor: 9250, situacao: 'a_receber', pago_em: null, de_quem: 'Ana Teste Lima' })]);
          const noCaixa = (await lancamentos(conta.id)).length;
          // Quando
          await SD.financeiroTerceiroMarcarPago(id, 'p-mauro', '2026-03-20');
          // Então
          expect(await meus(id)).toEqual([expect.objectContaining({ situacao: 'recebido', pago_em: '2026-03-20', recebido_em: '2026-03-10' })]);
          expect((await aPassar(id))[0]).toMatchObject({ pessoa_id: 'p-mauro', pago_em: '2026-03-20' });
          expect(await lancamentos(conta.id)).toHaveLength(noCaixa);
          // Quando
          await SD.financeiroTerceiroDesfazerPago(id, 'p-mauro');
          // Então
          expect(await meus(id)).toEqual([expect.objectContaining({ situacao: 'a_receber', pago_em: null })]);
          expect(await lancamentos(conta.id)).toHaveLength(noCaixa);
        });

        it('dado um indicador que não é sócio, quando o cliente paga, então a linha é de indicador, e vem do responsável', async () => {
          // Dado / Quando
          const { id } = await recebido({ ...NA_DIVISAO, indicador_id: 'p-mauro', indicador_percentual: 5 });
          // Então
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'indicador', valor: 4625, situacao: 'a_receber', de_quem: 'Ana Teste Lima' })]);
        });

        it('dado o sócio que indicou, quando o administrador paga o repasse, então a linha vem do escritório e passa a recebido', async () => {
          // Dado
          await SD.financeiroSocioCriar({ pessoa_id: 'p-mauro', desde: '2026-01-01', ate: null });
          const { id, conta } = await recebido({ ...NA_DIVISAO, indicador_id: 'p-mauro' });
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'indicador', valor: 10000, situacao: 'a_receber', de_quem: 'escritório' })]);
          // Quando
          await SD.financeiroPagarRepasse((await repassesDe(id)).find(r => r.tipo === 'socio_indicador')!.id, conta.id, '2026-03-20');
          // Então
          expect(await meus(id)).toEqual([expect.objectContaining({ situacao: 'recebido', pago_em: '2026-03-20' })]);
        });

        it('dado um recebimento em que a pessoa não entra, quando abre, então não vê nada dele; e quem cuida vê o que passar a cada um', async () => {
          // Dado / Quando
          const { id } = await recebido({ ...NA_DIVISAO, ...comBruno });
          // Então
          expect(await meus(id)).toEqual([]);
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', nome: expect.stringContaining('BRUNO'), valor: 9250, parcela_numero: 1, recebido_em: '2026-03-10', pago_em: null })]);
        });

        it('dado um valor já recebido, quando pede outro mês, então ele fica só no período dele; e parcela ainda não paga nunca aparece', async () => {
          // Dado: abaixo da parte integral, o valor já nasce recebido
          const { id, k } = await recebido({ percentual_escritorio: 30 });
          // Quando / Então
          expect((await SD.financeiroMeusValores('2026-04-01', '2026-04-30')).filter(l => l.recebimento_id === id)).toEqual([]);
          expect((await SD.financeiroMeusValores('2026-03-10', '2026-03-10')).filter(l => l.recebimento_id === id)).toHaveLength(1);
          expect((await SD.financeiroMeusValores('2020-01-01', '2030-12-31')).filter(l => l.contrato_codigo === k.codigo).map(l => l.parcela_numero)).toEqual([1]);
        });

        it.each([
          ['participante', { ...NA_DIVISAO, participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }] }],
          ['indicador que não é sócio', { ...NA_DIVISAO, indicador_id: 'p-mauro', indicador_percentual: 5 }]
        ])('dado um %s com valor a receber, quando vê os meses seguintes, então o valor continua; recebido, fica só no mês dele', async (_caso, contrato) => {
          // Dado
          const { id } = await recebido(contrato);
          const emAbril = async () => (await SD.financeiroMeusValores('2026-04-01', '2026-04-30')).filter(l => l.recebimento_id === id);
          // Quando / Então
          expect(await emAbril()).toEqual([expect.objectContaining({ situacao: 'a_receber', recebido_em: '2026-03-10' })]);
          expect((await SD.financeiroMeusValores('2099-12-01', '2099-12-31')).filter(l => l.recebimento_id === id)).toHaveLength(1);
          expect((await SD.financeiroMeusValores('2026-02-01', '2026-02-28')).filter(l => l.recebimento_id === id)).toEqual([]);
          // Quando
          await SD.financeiroTerceiroMarcarPago(id, 'p-mauro', '2026-04-02');
          // Então
          expect(await emAbril()).toEqual([]);
          expect(await meus(id)).toEqual([expect.objectContaining({ situacao: 'recebido', pago_em: '2026-04-02' })]);
        });

        it('dado o sócio que indicou, com repasse a receber, quando vê o mês seguinte, então continua; pago, fica só no mês dele', async () => {
          // Dado
          await SD.financeiroSocioCriar({ pessoa_id: 'p-mauro', desde: '2026-01-01', ate: null });
          const { id, conta } = await recebido({ ...NA_DIVISAO, indicador_id: 'p-mauro' });
          const emAbril = async () => (await SD.financeiroMeusValores('2026-04-01', '2026-04-30')).filter(l => l.recebimento_id === id);
          // Quando / Então
          expect((await emAbril()).map(l => l.papel)).toEqual(['indicador']);
          // Quando
          await SD.financeiroPagarRepasse((await repassesDe(id)).find(r => r.tipo === 'socio_indicador')!.id, conta.id, '2026-04-02');
          // Então
          expect(await emAbril()).toEqual([]);
        });

        it('dado o responsável com repasse a receber, quando vê o mês seguinte, então continua; pago, fica só no mês dele', async () => {
          // Dado
          const { id, conta } = await recebido();
          const emAbril = async () => (await SD.financeiroMeusValores('2026-04-01', '2026-04-30')).filter(l => l.recebimento_id === id);
          // Quando / Então
          expect(await emAbril()).toEqual([expect.objectContaining({ papel: 'responsavel', situacao: 'a_receber' })]);
          // Quando
          await SD.financeiroPagarRepasse((await repassesDe(id))[0].id, conta.id, '2026-04-02');
          // Então
          expect(await emAbril()).toEqual([]);
          expect(await meus(id)).toHaveLength(1);
        });

        it.each([
          ['com tudo na conta', { indicador_id: 'p-bruno', indicador_percentual: 10 }, 64750, 'a_receber', 'escritório'],
          ['abaixo da parte integral', { percentual_escritorio: 30, indicador_id: 'p-bruno', indicador_percentual: 10 }, 57435, 'recebido', 'cliente']
        ])('dado o responsável %s e um indicador, quando abre, então a linha é a parte dele, e marcar o indicador não a muda', async (_caso, contrato, valor, situacao, de_quem) => {
          // Dado / Quando
          const { id } = await recebido(contrato);
          // Então
          const esperado = [expect.objectContaining({ papel: 'responsavel', valor, situacao, de_quem })];
          expect(await meus(id)).toEqual(esperado);
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno' })]);
          // Quando
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20');
          // Então
          expect(await meus(id)).toEqual(esperado);
        });

        it('dado o sócio responsável com tudo na conta e um indicador, quando abre, então não tem linha: só repassa, e isso fica em A passar', async () => {
          // Dado
          await SD.financeiroSocioCriar({ pessoa_id: 'p-mauro', desde: '2026-01-01', ate: null });
          // Quando
          const { id } = await recebido({ indicador_id: 'p-bruno', indicador_percentual: 10 });
          // Então
          expect(await meus(id)).toEqual([]);
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', valor: 9250 })]);
        });

        it.each([
          ['participante com tudo na conta', { participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }] }, 74000, 'a_receber'],
          ['indicador com tudo na conta', { indicador_id: 'p-mauro', indicador_percentual: 10 }, 74000, 'a_receber'],
          ['participante abaixo da parte integral', { percentual_escritorio: 30, participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }] }, 67000, 'recebido']
        ])('dado o responsável que também é %s, quando abre, então há uma linha só, com o que é dele, e nada a passar a si mesmo', async (_caso, contrato, valor, situacao) => {
          // Dado / Quando
          const { id } = await recebido(contrato);
          // Então
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'responsavel', valor, situacao })]);
          expect(await aPassar(id)).toEqual([]);
          await expect(SD.financeiroTerceiroMarcarPago(id, 'p-mauro', '2026-03-20')).rejects.toThrow('não recebe nada');
          await expect(SD.financeiroEstornar(id)).resolves.toBeUndefined();
        });

        it('dado o responsável que também é participante, junto com outra pessoa, quando abre, então só o valor da outra sai da parte dele', async () => {
          // Dado / Quando
          const { id } = await recebido({ participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }, { pessoa_id: 'p-bruno', percentual: 10 }] });
          // Então: R$ 740,00 ao responsável, menos os R$ 92,50 de Bruno
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'responsavel', valor: 64750 })]);
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', valor: 9250 })]);
        });

        it('dado o sócio responsável que também é participante, quando abre, então a linha é o valor dele, que o escritório repassa', async () => {
          // Dado
          await SD.financeiroSocioCriar({ pessoa_id: 'p-mauro', desde: '2026-01-01', ate: null });
          // Quando
          const { id } = await recebido({ participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }] });
          // Então
          expect(await meus(id)).toEqual([expect.objectContaining({ papel: 'responsavel', valor: 9250, situacao: 'a_receber' })]);
          expect(await aPassar(id)).toEqual([]);
        });

        it('dado um indicador que recebeu, quando o administrador o tira do contrato, então a linha continua de indicador', async () => {
          // Dado
          const { id, k } = await recebido({ ...NA_DIVISAO, indicador_id: 'p-mauro', indicador_percentual: 5 });
          // Quando
          await SD.contratoAtualizar(k.id, { indicador_id: null, indicador_percentual: null });
          // Então
          expect((await meus(id)).map(l => l.papel)).toEqual(['indicador']);
          expect((await SD.financeiroRecebimento(id))!.terceiros).toEqual([expect.objectContaining({ id: 'p-mauro', papel: 'indicador' })]);
        });

        it('dado um participante que recebeu, quando o administrador o põe como indicador, então o recebimento antigo continua de participante, e o novo é de indicador', async () => {
          // Dado
          const { id, k, conta } = await recebido({ ...NA_DIVISAO, parcelas: 2, participantes: [{ pessoa_id: 'p-mauro', percentual: 10 }] });
          // Quando
          await SD.contratoAtualizar(k.id, { participantes: [], indicador_id: 'p-mauro', indicador_percentual: 10 });
          const novo = await receber(k.parcelas[1].id, conta.id);
          // Então
          expect((await meus(id)).map(l => l.papel)).toEqual(['participante']);
          expect((await meus(novo)).map(l => l.papel)).toEqual(['indicador']);
        });

        // Aqui, quem está logado é um administrador; quem não é fica no fim deste arquivo e em supabase/tests/quem_recebeu_marca.test.sql.
        it('dado um recebimento e um novo responsável no contrato, quando o administrador marca como pago, então a linha continua, paga', async () => {
          // Dado
          const { id, k } = await recebido(comBruno);
          await SD.contratoAtualizar(k.id, { responsavel_id: 'u-ana' });
          // Quando
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20');
          // Então
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', pago_em: '2026-03-20' })]);
        });

        it('dado um recebimento e um novo responsável no contrato, quando o administrador desfaz a marcação, então a linha continua, a pagar', async () => {
          // Dado
          const { id, k } = await recebido(comBruno);
          await SD.contratoAtualizar(k.id, { responsavel_id: 'u-ana' });
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20');
          // Quando
          await SD.financeiroTerceiroDesfazerPago(id, 'p-bruno');
          // Então
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', pago_em: null })]);
        });

        it('dado um recebimento e um novo responsável no contrato, quando o administrador abre, então quem paga é o responsável da época', async () => {
          // Dado: a Ana recebe a primeira parcela, o contrato passa para o Mauro, e ele recebe a segunda
          const { id, k, conta } = await recebido({ ...NA_DIVISAO, parcelas: 2, ...comBruno });
          await SD.contratoAtualizar(k.id, { responsavel_id: 'u-master' });
          const novo = await receber(k.parcelas[1].id, conta.id);
          // Quando / Então
          expect(await aPassar(id)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', quem_paga: 'Ana Teste Lima' })]);
          expect(await aPassar(novo)).toEqual([expect.objectContaining({ pessoa_id: 'p-bruno', quem_paga: 'Mauro Teixeira Duarte' })]);
        });

        it('dado um valor marcado como pago e desfeito, quando lê o registro de ações, então os dois dizem o contrato, a parcela, o recebimento, a data e o valor', async () => {
          // Dado
          const { id, k } = await recebido(comBruno);
          // Quando
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20');
          await SD.financeiroTerceiroDesfazerPago(id, 'p-bruno');
          // Então
          const [desfeita, marcada] = await SD.auditoriaListar(2);
          const resumo = { codigo: k.codigo, parcela: 1, recebimento: id, pago_em: '2026-03-20', valor: 9250 };
          expect(desfeita).toMatchObject({ tabela: 'financeiro_terceiros_pagos', registro_id: 'p-bruno', acao: 'exclusao', resumo });
          expect(marcada).toMatchObject({ tabela: 'financeiro_terceiros_pagos', registro_id: 'p-bruno', acao: 'inclusao', resumo });
          expect(desfeita.resumo?.nome).toBeUndefined();
        });

        it('dado um valor ainda não pago, quando vê o mês seguinte, então continua a passar; pago, fica só no mês dele', async () => {
          // Dado
          const { id } = await recebido(comBruno);
          // Quando / Então
          expect(await aPassar(id, '2026-04-01', '2026-04-30')).toHaveLength(1);
          expect(await aPassar(id, '2026-02-01', '2026-02-28')).toEqual([]);
          // Quando
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-04-02');
          // Então
          expect(await aPassar(id, '2026-04-01', '2026-04-30')).toEqual([]);
          expect(await aPassar(id)).toHaveLength(1);
        });

        it.each([
          ['pessoa fora do recebimento', 'p-ana', '2026-03-20', 'não recebe nada'],
          ['data que não existe', 'p-bruno', '2026-02-30', 'data válida'],
          ['data fora da faixa', 'p-bruno', '1999-12-31', 'data válida']
        ])('quando marca com %s, então é recusado', async (_caso, pessoa, data, mensagem) => {
          // Dado
          const { id } = await recebido(comBruno);
          // Quando / Então
          await expect(SD.financeiroTerceiroMarcarPago(id, pessoa, data)).rejects.toThrow(mensagem);
          expect((await aPassar(id))[0].pago_em).toBeNull();
        });

        it('quando marca duas vezes, então a segunda é recusada e a data fica; e desfazer duas vezes não dá erro', async () => {
          // Dado
          const { id } = await recebido(comBruno);
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20');
          // Quando / Então
          await expect(SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-21')).rejects.toThrow('já foi marcado');
          expect((await aPassar(id))[0].pago_em).toBe('2026-03-20');
          await SD.financeiroTerceiroDesfazerPago(id, 'p-bruno');
          await expect(SD.financeiroTerceiroDesfazerPago(id, 'p-bruno')).resolves.toBeUndefined();
        });

        it('quando o recebimento não existe, então marcar e desfazer são recusados', async () => {
          // Quando / Então
          await expect(SD.financeiroTerceiroMarcarPago('nao-existe', 'p-bruno', '2026-03-20')).rejects.toThrow('Só quem recebeu');
          await expect(SD.financeiroTerceiroDesfazerPago('nao-existe', 'p-bruno')).rejects.toThrow('Só quem recebeu');
        });

        it('dado um valor marcado como pago, quando estorna, então é recusado até desfazer a marcação', async () => {
          // Dado
          const { id } = await recebido(comBruno);
          await SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20');
          // Quando / Então
          await expect(SD.financeiroEstornar(id)).rejects.toThrow('desfazer a marcação antes');
          expect(await aPassar(id)).toHaveLength(1);
          // Quando
          await SD.financeiroTerceiroDesfazerPago(id, 'p-bruno');
          await SD.financeiroEstornar(id);
          // Então
          expect(await aPassar(id)).toEqual([]);
        });

        it('dado um recebimento estornado, quando abre, então as linhas somem e não dá para marcar; restaurado, voltam', async () => {
          // Dado
          const { id } = await recebido(comBruno);
          // Quando
          await SD.financeiroEstornar(id);
          // Então
          expect(await meus(id)).toEqual([]);
          expect(await aPassar(id)).toEqual([]);
          await expect(SD.financeiroTerceiroMarcarPago(id, 'p-bruno', '2026-03-20')).rejects.toThrow('foi estornado');
          await expect(SD.financeiroTerceiroDesfazerPago(id, 'p-bruno')).rejects.toThrow('foi estornado');
          // Quando
          await SD.financeiroRestaurarRecebimento(id);
          // Então
          expect(await meus(id)).toHaveLength(1);
          expect(await aPassar(id)).toHaveLength(1);
        });

        it('dado um indicador já pago que saiu do contrato, quando exclui a pessoa, então a exclusão funciona e a marcação fica', async () => {
          // Dado
          const nome = marca();
          const { id: pessoa } = await criar(nome);
          const { id, k } = await recebido({ indicador_id: pessoa, indicador_percentual: 5 });
          await SD.financeiroTerceiroMarcarPago(id, pessoa, '2026-03-20');
          await SD.pessoasArquivar([pessoa]);
          // Quando / Então: enquanto está no contrato, a regra de hoje vale
          expect(await SD.pessoasExcluir([pessoa])).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em contratos e não pode ser excluída.' });
          // Quando
          await SD.contratoAtualizar(k.id, { indicador_id: null, indicador_percentual: null });
          // Então
          expect(await SD.pessoasExcluir([pessoa])).toMatchObject({ excluidas: 1 });
          expect((await aPassar(id))[0]).toMatchObject({ nome, pago_em: '2026-03-20' });
        });

        it('quando lê o recebimento e os repasses, então os campos internos não aparecem', async () => {
          // Dado
          const { id } = await recebido();
          // Quando / Então
          expect(await SD.financeiroRecebimento(id)).not.toHaveProperty('responsavel_id');
          expect((await repassesDe(id))[0]).not.toHaveProperty('perfil_id');
        });
      });

      describe('Lucro dos sócios', () => {
        const socio = () => SD.financeiroSocioCriar({ pessoa_id: 'p-mauro', desde: '2026-01-01', ate: null });
        const doLucro = async () => (await SD.financeiroLucro());

        it('quando o sócio responsável recebe com tudo na conta, então o recebimento entra no lucro dele; estornado, sai', async () => {
          // Dado
          await socio();
          const k = await assinado(), conta = await contaPJ();
          // Quando
          const id = await receber(k.parcelas[0].id, conta.id);
          // Então
          expect((await doLucro()).recebimentos).toEqual([expect.objectContaining({ data: '2026-03-10', pessoa_id: 'p-mauro', liquido: 92500, terceiros: [] })]);
          // Quando / Então
          await SD.financeiroEstornar(id);
          expect((await doLucro()).recebimentos).toEqual([]);
        });

        it('dado menos que tudo na conta, ou um responsável que não é sócio, quando recebe, então não entra no lucro', async () => {
          // Dado
          const conta = await contaPJ();
          const antes = await assinado();
          await receber(antes.parcelas[0].id, conta.id);
          await socio();
          const k = await assinado({ percentual_escritorio: 30 });
          // Quando
          await receber(k.parcelas[0].id, conta.id, { taxa: 0 });
          // Então
          expect((await doLucro()).recebimentos).toEqual([]);
        });

        it('quando sai da lista de sócios depois, então o que acumulou continua, e ainda dá para pagar', async () => {
          // Dado
          const s = await socio();
          const k = await assinado(), conta = await contaPJ();
          await receber(k.parcelas[0].id, conta.id);
          // Quando
          await SD.financeiroSocioExcluir(s.id);
          // Então
          expect((await doLucro()).recebimentos).toHaveLength(1);
          await expect(SD.financeiroPagarLucro({ pessoa: 'p-mauro', conta: conta.id, data: '2026-03-20', valor: 100, descricao: '' })).resolves.toBeTruthy();
        });

        it('quando um sócio indica, então a indicação entra à parte, com a data do recebimento; paga, mostra quando', async () => {
          // Dado
          await socio();
          const k = await assinado({ responsavel_id: 'u-ana', indicador_id: 'p-mauro' }), conta = await contaPJ();
          // Quando
          const id = await receber(k.parcelas[0].id, conta.id);
          // Então
          const lucro = await doLucro();
          expect(lucro.recebimentos).toEqual([]);
          expect(lucro.indicacoes).toEqual([expect.objectContaining({ data: '2026-03-10', pessoa_id: 'p-mauro', valor: 10000, pago_em: null })]);
          // Quando / Então
          const [repasse] = (await repassesDe(id)).filter(r => r.tipo === 'socio_indicador');
          await SD.financeiroPagarRepasse(repasse.id, conta.id, '2026-04-01');
          expect((await doLucro()).indicacoes[0].pago_em).toBe('2026-04-01');
        });

        it('quando paga o lucro, então cria a saída no caixa; desfazer esconde as duas coisas, e restaurar devolve', async () => {
          // Dado
          await socio();
          const conta = await contaPJ();
          // Quando
          const id = await SD.financeiroPagarLucro({ pessoa: 'p-mauro', conta: conta.id, data: '2026-03-20', valor: 50000, descricao: '' });
          // Então
          const lucro = await doLucro();
          expect(lucro.retiradas).toEqual([expect.objectContaining({ id, pessoa_id: 'p-mauro', conta_id: conta.id, data: '2026-03-20', valor: 50000 })]);
          expect(lucro.retiradas[0].descricao).toContain('Divisão de lucro a');
          const [saida] = await lancamentos(conta.id);
          expect(saida).toMatchObject({ tipo: 'saida', categoria: 'divisao_lucro', valor: 50000, origem: 'lucro' });
          await expect(SD.financeiroLancamentoAtualizar(saida.id, { valor: 1 })).rejects.toThrow('desfaça por lá');
          // Quando / Então
          await SD.financeiroDesfazerLucro(id);
          expect((await doLucro()).retiradas).toEqual([]);
          expect(await lancamentos(conta.id)).toEqual([]);
          // Quando / Então
          await SD.financeiroRestaurarLucro(id);
          expect((await doLucro()).retiradas).toHaveLength(1);
          expect(await lancamentos(conta.id)).toHaveLength(1);
        });

        it('quando a pessoa nunca foi sócia, então não recebe lucro', async () => {
          // Dado
          const conta = await contaPJ();
          // Quando / Então
          await expect(SD.financeiroPagarLucro({ pessoa: 'p-mauro', conta: conta.id, data: '2026-03-20', valor: 100, descricao: '' })).rejects.toThrow('Só sócios recebem lucro');
        });

        it('dado que a conta foi arquivada depois de desfazer, quando restaura, então é recusado, e a retirada continua fora', async () => {
          // Dado
          await socio();
          const conta = await contaPJ();
          const id = await SD.financeiroPagarLucro({ pessoa: 'p-mauro', conta: conta.id, data: '2026-03-20', valor: 50000, descricao: '' });
          await SD.financeiroDesfazerLucro(id);
          await SD.financeiroContaAtualizar(conta.id, { arquivada_em: new Date().toISOString() });
          // Quando / Então
          await expect(SD.financeiroRestaurarLucro(id)).rejects.toThrow('arquivada');
          expect((await doLucro()).retiradas).toEqual([]);
        });

        it('quando restaura o que não foi desfeito, então nada muda', async () => {
          // Dado
          await socio();
          const conta = await contaPJ();
          const id = await SD.financeiroPagarLucro({ pessoa: 'p-mauro', conta: conta.id, data: '2026-03-20', valor: 50000, descricao: '' });
          // Quando
          await SD.financeiroRestaurarLucro(id);
          // Então
          expect((await doLucro()).retiradas).toHaveLength(1);
        });
      });

      it('dado um desconto, quando o contrato chega à coluna de assinado, então ele sai do valor antes de dividir', async () => {
        // Quando
        const k = await assinado({ descontos: 200 });
        // Então
        expect(k.parcelas.map(p => p.valor)).toEqual([40000, 40000]);
      });

      it('dado um desconto do valor inteiro, quando o contrato chega à coluna de assinado, então não nascem parcelas', async () => {
        // Quando
        const k = await assinado({ descontos: 1000 });
        // Então
        expect(k.parcelas).toEqual([]);
      });

      it('quando o contrato é de êxito, então não gera, e dá para lançar à mão', async () => {
        // Quando
        const k = await assinado({ categoria: 'quota_litis' });
        // Então
        expect(k.parcelas).toEqual([]);
        expect(await SD.parcelasGerar(k.id)).toBe(0);
        const p = await SD.parcelaCriar(k.id, { vencimento: '2026-05-01', valor: 12345 });
        expect(p).toMatchObject({ numero: 1, valor: 12345, recebimento_id: null });
      });

      it('quando o contrato ainda não foi assinado, então gerar à mão é recusado', async () => {
        // Dado
        const k = await novoContrato();
        // Então
        await expect(SD.parcelasGerar(k.id)).rejects.toThrow('ainda não foi assinado');
      });

      it('quando o contrato tem a data de assinatura, ou já foi assinado e ficou sem parcelas, então gera à mão uma vez', async () => {
        // Dado
        const comData = await novoContrato({ assinado_em: '2026-01-10' });
        const assinadoSemParcelas = await assinado();
        for (const p of assinadoSemParcelas.parcelas) await SD.parcelaExcluir(p.id);
        // Quando
        const quantas = await SD.parcelasGerar(comData.id);
        // Então
        expect(quantas).toBe(2);
        await expect(SD.parcelasGerar(comData.id)).rejects.toThrow('Este contrato já tem parcelas.');
        expect(await SD.parcelasGerar(assinadoSemParcelas.id)).toBe(2);
      });

      it('quando o contrato já esteve na coluna de assinado e saiu, então ainda gera à mão', async () => {
        // Dado
        const k = await assinado();
        for (const p of k.parcelas) await SD.parcelaExcluir(p.id);
        await SD.contratoMover(k.id, (await SD.colunasListar('contratos')).find(c => !c.marco)!.id, 1);
        // Então
        expect(await SD.parcelasGerar(k.id)).toBe(2);
      });

      it('quando há parcela lançada à mão antes da assinatura, então assinar não gera por cima', async () => {
        // Dado
        const k = await novoContrato();
        await SD.parcelaCriar(k.id, { vencimento: '2026-02-01', valor: 20000 });
        // Quando
        await assinar(k.id);
        // Então
        expect((await SD.parcelasDoContrato(k.id)).map(p => p.valor)).toEqual([20000]);
      });

      it('quando o contrato de exemplo já estava assinado, então sair e voltar para a coluna não gera sozinho', async () => {
        // Dado
        const k = (await SD.contratosListar()).linhas.find(x => x.cliente_nome.startsWith('PADARIA'))!;
        const colunas = await SD.colunasListar('contratos');
        // Quando
        await SD.contratoMover(k.id, colunas.find(c => !c.marco)!.id, 1);
        await SD.contratoMover(k.id, colunas.find(c => c.marco === 'assinado')!.id, 1);
        // Então
        expect(await SD.parcelasDoContrato(k.id)).toEqual([]);
      });

      it('quando ajusta, exclui e devolve a parcela, então tudo fica no histórico do contrato', async () => {
        // Dado
        const k = await assinado();
        const p = k.parcelas[0];
        // Quando
        await SD.parcelaAtualizar(p.id, { vencimento: '2026-03-20', valor: 60000 });
        await SD.parcelaExcluir(p.id);
        // Então
        expect((await SD.parcelasDoContrato(k.id)).map(x => x.numero)).toEqual([2]);
        await SD.parcelaRestaurar(p.id);
        expect((await SD.parcelasDoContrato(k.id))[0]).toMatchObject({ numero: 1, vencimento: '2026-03-20', valor: 60000 });
        const hist = JSON.stringify(await SD.parcelasHistorico(k.id));
        for (const texto of ['Parcelas', 'Parcela 1: valor', 'Parcela 1: vencimento', 'Excluída', 'Devolvida']) expect(hist).toContain(texto);
        // O histórico do contrato é aberto a todo o escritório: não fala de dinheiro.
        expect(JSON.stringify(await SD.contratoHistorico(k.id))).not.toContain('Parcela');
        await expect(SD.parcelaAtualizar(p.id, { vencimento: '2026-03-20', valor: 0 })).rejects.toThrow('formato inválido');
      });

      it('quando a parcela é excluída, então não muda, a número continua, e a nova vem depois', async () => {
        // Dado
        const k = await assinado();
        await SD.parcelaExcluir(k.parcelas[1].id);
        // Então
        await expect(SD.parcelaAtualizar(k.parcelas[1].id, { vencimento: '2026-05-01', valor: 100 })).rejects.toThrow('Esta parcela foi excluída.');
        expect((await SD.parcelaCriar(k.id, { vencimento: '2026-05-01', valor: 100 })).numero).toBe(3);
      });

      it('quando recebe, então divide, cria a entrada e a taxa no caixa e o repasse ao responsável', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        // Quando
        const id = await receber(k.parcelas[0].id, conta.id);
        // Então
        expect(await SD.financeiroRecebimento(id)).toMatchObject({ valor: 100000, aliquota_das: 4.5, das: 4500, liquido: 92500, escritorio: 27750, responsavel_recebe: 64750, responsavel_socio: false, socio_indicador: null });
        expect((await lancamentos(conta.id)).map(l => [l.tipo, l.categoria, l.valor, l.origem])).toEqual([['entrada', 'recebimento', 100000, 'recebimento'], ['saida', 'despesa', 3000, 'recebimento']]);
        expect(await repassesDe(id)).toMatchObject([{ tipo: 'responsavel', valor: 64750, pago_em: null, conta_sugerida: conta.id }]);
        expect((await SD.parcelasDoContrato(k.id))[0]).toMatchObject({ recebimento_id: id, recebida_em: '2026-03-10', recebido: 100000 });
      });

      it('quando já recebeu, então não recebe de novo, e a parcela não muda', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        await receber(k.parcelas[0].id, conta.id);
        // Então
        await expect(receber(k.parcelas[0].id, conta.id)).rejects.toThrow('Esta parcela já foi recebida.');
        await expect(SD.parcelaAtualizar(k.parcelas[0].id, { vencimento: '2026-03-20', valor: 1 })).rejects.toThrow('Estorne o recebimento');
        await expect(SD.parcelaExcluir(k.parcelas[0].id)).rejects.toThrow('Estorne o recebimento');
      });

      it('quando o contrato não diz a parte na conta, então pede para preencher', async () => {
        // Dado
        const k = await assinado({ percentual_escritorio: null }), conta = await contaPJ();
        // Então
        await expect(SD.financeiroParaReceber(k.parcelas[0].id, '2026-03-10')).rejects.toThrow('Atualizar contrato');
        await expect(receber(k.parcelas[0].id, conta.id)).rejects.toThrow('Atualizar contrato');
      });

      it('quando não há DAS, então a conta que recolhe recusa, e a que não recolhe aceita', async () => {
        // Dado
        const k = await assinado();
        const pj = await SD.financeiroContaCriar({ nome: marca(), tem_das: true, saldo_inicial: 0, saldo_inicial_em: '2000-01-01' });
        const pf = await SD.financeiroContaCriar({ nome: marca(), tem_das: false, saldo_inicial: 0, saldo_inicial_em: '2001-01-01' });
        // Então
        await expect(receber(k.parcelas[0].id, pj.id, { data: '2001-01-10' })).rejects.toThrow('Nenhum DAS lançado');
        const id = await receber(k.parcelas[0].id, pf.id, { data: '2001-01-10', taxa: 3000 });
        expect(await SD.financeiroRecebimento(id)).toMatchObject({ das: 0, taxa_maquina: 0, liquido: 100000 });
      });

      it('quando muda o DAS depois, então o que foi recebido não muda', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const id = await receber(k.parcelas[0].id, conta.id);
        // Quando
        await SD.financeiroDasSalvar('2026-03', 9);
        // Então
        expect(await SD.financeiroRecebimento(id)).toMatchObject({ aliquota_das: 4.5, das: 4500 });
        expect((await SD.financeiroParaReceber(k.parcelas[1].id, '2026-03-10')).das).toEqual([{ mes: '2026-03', aliquota: 9 }]);
        await SD.financeiroDasSalvar('2026-03', 4.5);
      });

      it('quando o caixa tenta mudar o lançamento do recebimento, então é recusado', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        await receber(k.parcelas[0].id, conta.id);
        const [entrada] = await lancamentos(conta.id);
        // Então
        const texto = 'nasceu de um recebimento';
        await expect(SD.financeiroLancamentoAtualizar(entrada.id, { valor: 1 })).rejects.toThrow(texto);
        await expect(SD.financeiroLancamentoExcluir(entrada.id)).rejects.toThrow(texto);
        await expect(SD.financeiroLancamentoRestaurar(entrada.id)).rejects.toThrow(texto);
      });

      it('quando paga o repasse, então cria a saída no caixa; e desfazer tira', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const id = await receber(k.parcelas[0].id, conta.id);
        const [rep] = await repassesDe(id);
        // Quando
        await SD.financeiroPagarRepasse(rep.id, conta.id, '2026-03-11');
        // Então
        expect((await lancamentos(conta.id)).at(-1)).toMatchObject({ tipo: 'saida', categoria: 'repasse', valor: 64750, origem: 'repasse' });
        await expect(SD.financeiroPagarRepasse(rep.id, conta.id, '2026-03-11')).rejects.toThrow('Este repasse já foi pago.');
        await expect(SD.financeiroEstornar(id)).rejects.toThrow('desfazer o pagamento');
        await SD.financeiroDesfazerPagamento(rep.id);
        expect((await lancamentos(conta.id)).some(l => l.categoria === 'repasse')).toBe(false);
        expect((await repassesDe(id))[0]).toMatchObject({ pago_em: null, conta_paga: null });
      });

      it('quando paga por outra conta, então o repasse guarda de onde saiu', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const outra = await SD.financeiroContaCriar({ nome: marca(), tem_das: false, saldo_inicial: 0, saldo_inicial_em: '2026-01-01' });
        const id = await receber(k.parcelas[0].id, conta.id);
        const [rep] = await repassesDe(id);
        // Quando
        await SD.financeiroPagarRepasse(rep.id, outra.id, '2026-03-11');
        // Então
        expect((await repassesDe(id))[0]).toMatchObject({ conta_sugerida: conta.id, conta_paga: outra.id });
        expect((await lancamentos(outra.id)).map(l => l.valor)).toEqual([64750]);
      });

      it('quando a pessoa é sócia ou recebeu repasse, então não pode ser excluída', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        const s = await SD.financeiroSocioCriar({ pessoa_id: pessoa, desde: '2026-01-01', ate: null });
        await SD.financeiroSocioExcluir(s.id);
        await SD.pessoasArquivar([pessoa]);
        // Quando
        const r = await SD.pessoasExcluir([pessoa]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está no financeiro e não pode ser excluída.' });
      });

      it('quando o contrato é arquivado, então as a receber saem das listas, e as recebidas continuam', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        const k = await assinado({ clientes: [cliente] }), conta = await contaPJ();
        await receber(k.parcelas[0].id, conta.id);
        // Quando
        await SD.contratosArquivar([k.id]);
        // Então
        const noPeriodo = (await SD.parcelasDoPeriodo('2026-03-01', '2026-04-30', '2026-11-02')).filter(p => p.contrato_id === k.id);
        expect(noPeriodo.map(p => p.numero)).toEqual([1]);
        expect((await SD.parcelasDaPessoa(cliente)).map(p => p.numero)).toEqual([1]);
        expect(await SD.parcelasDoContrato(k.id)).toHaveLength(2);
      });

      it('quando olha um mês futuro, então o que ainda vai vencer não entra como atrasada', async () => {
        // Dado
        const k = await assinado({ primeiro_pagamento: '2026-11-20', parcelas: 1 });
        // Então
        const naoVenceu = (await SD.parcelasDoPeriodo('2026-12-01', '2026-12-31', '2026-11-02')).filter(p => p.contrato_id === k.id);
        const venceu = (await SD.parcelasDoPeriodo('2026-12-01', '2026-12-31', '2026-11-25')).filter(p => p.contrato_id === k.id);
        expect(naoVenceu).toEqual([]);
        expect(venceu).toHaveLength(1);
      });

      it('quando os pagos são de outro período, então a lista só traz os a pagar e os pagos no período', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const id = await receber(k.parcelas[0].id, conta.id);
        const [rep] = await repassesDe(id);
        await SD.financeiroPagarRepasse(rep.id, conta.id, '2026-03-11');
        // Então
        expect((await SD.financeiroRepasses('2026-03-01', '2026-03-31')).some(r => r.id === rep.id)).toBe(true);
        expect((await SD.financeiroRepasses('2026-04-01', '2026-04-30')).some(r => r.id === rep.id)).toBe(false);
      });

      it('quando estorna, então a parcela volta, o caixa e o repasse somem; e desfazer devolve tudo', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const id = await receber(k.parcelas[0].id, conta.id);
        // Quando
        await SD.financeiroEstornar(id);
        // Então
        expect((await SD.parcelasDoContrato(k.id))[0].recebimento_id).toBeNull();
        expect(await lancamentos(conta.id)).toEqual([]);
        expect(await repassesDe(id)).toEqual([]);
        await expect(SD.financeiroEstornar(id)).rejects.toThrow('já foi estornado');
        await SD.financeiroRestaurarRecebimento(id);
        expect((await SD.parcelasDoContrato(k.id))[0].recebimento_id).toBe(id);
        expect(await lancamentos(conta.id)).toHaveLength(2);
        expect(await repassesDe(id)).toHaveLength(1);
      });

      it('quando recebeu de novo depois do estorno, então o estornado não volta por cima', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const id = await receber(k.parcelas[0].id, conta.id);
        await SD.financeiroEstornar(id);
        await receber(k.parcelas[0].id, conta.id);
        // Então
        await expect(SD.financeiroRestaurarRecebimento(id)).rejects.toThrow('recebida de novo');
      });

      it('quando o contrato tem recebimento, então não se exclui; sem ele, sai com as parcelas', async () => {
        // Dado
        const k = await assinado(), livre = await assinado(), conta = await contaPJ();
        await receber(k.parcelas[0].id, conta.id);
        await SD.contratosArquivar([k.id, livre.id]);
        // Então
        await expect(SD.contratosExcluir([k.id])).rejects.toThrow('tem recebimentos');
        await SD.contratosExcluir([livre.id]);
        expect(await SD.parcelasDoContrato(livre.id)).toEqual([]);
      });

      it('quando o responsável era sócio na data, então a parte dele fica no escritório; mudar a lista depois não muda o passado', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const s = await SD.financeiroSocioCriar({ pessoa_id: 'p-mauro', desde: '2026-01-01', ate: '2026-03-31' });
        // Quando
        const dentro = await receber(k.parcelas[0].id, conta.id);
        const fora = await receber(k.parcelas[1].id, conta.id, { data: '2026-04-10' });
        // Então
        expect(await SD.financeiroRecebimento(dentro)).toMatchObject({ responsavel_socio: true, escritorio: 92500, responsavel_recebe: 0, contribuicao_socio: 92500 });
        expect(await repassesDe(dentro)).toEqual([]);
        expect(await SD.financeiroRecebimento(fora)).toMatchObject({ responsavel_socio: false, escritorio: 27750 });
        await SD.financeiroSocioExcluir(s.id);
        expect(await SD.financeiroRecebimento(dentro)).toMatchObject({ responsavel_socio: true, escritorio: 92500 });
      });

      it('quando um sócio indicou, então recebe 10% do escritório, à parte, como indicação', async () => {
        // Dado
        const { id: indicador } = await criar(marca());
        const s = await SD.financeiroSocioCriar({ pessoa_id: indicador, desde: '2026-01-01', ate: null });
        const k = await assinado({ indicador_id: indicador, indicador_percentual: 10 }), conta = await contaPJ();
        // Quando
        const id = await receber(k.parcelas[0].id, conta.id);
        // Então
        const r = await SD.financeiroRecebimento(id);
        expect(r).toMatchObject({ escritorio: 27750, escritorio_final: 17750, terceiros: [], socio_indicador: { id: indicador, valor: 10000 } });
        const reps = await repassesDe(id);
        expect(reps.map(x => [x.tipo, x.valor])).toEqual([['responsavel', 64750], ['socio_indicador', 10000]]);
        await SD.financeiroPagarRepasse(reps[1].id, conta.id, '2026-03-11');
        expect((await lancamentos(conta.id)).at(-1)).toMatchObject({ categoria: 'indicacao', valor: 10000 });
        await SD.financeiroSocioExcluir(s.id);
      });

      it('quando o indicador não é sócio, então o responsável recebe e repassa, e só fica a informação', async () => {
        // Dado
        const { id: indicador } = await criar(marca());
        const k = await assinado({ indicador_id: indicador, indicador_percentual: 10 }), conta = await contaPJ();
        // Quando
        const id = await receber(k.parcelas[0].id, conta.id);
        // Então
        const r = await SD.financeiroRecebimento(id);
        expect(r).toMatchObject({ escritorio: 18500, responsavel_recebe: 74000, responsavel_fica: 64750, socio_indicador: null });
        expect(r!.terceiros).toMatchObject([{ id: indicador, valor: 9250, percentual: 10 }]);
        expect((await repassesDe(id)).map(x => x.tipo)).toEqual(['responsavel']);
      });

      it('quando lê o que precisa para receber, então vêm só as contas ativas', async () => {
        // Dado
        const k = await assinado(), conta = await contaPJ();
        const arquivada = await SD.financeiroContaCriar({ nome: marca(), tem_das: false, saldo_inicial: 0, saldo_inicial_em: '2026-01-01' });
        await SD.financeiroContaAtualizar(arquivada.id, { arquivada_em: new Date().toISOString() });
        // Quando
        const prep = await SD.financeiroParaReceber(k.parcelas[0].id, '2026-03-10');
        // Então
        expect(prep.contas.map(c => c.id)).toContain(conta.id);
        expect(prep.contas.map(c => c.id)).not.toContain(arquivada.id);
        expect(prep.parte_na_conta).toBe(100);
        expect(prep.contas[0]).not.toHaveProperty('saldo_inicial');
      });

      it('quando o período tem parcelas, então vêm as dele e as atrasadas de antes, sem as recebidas de antes', async () => {
        // Dado
        const k = await assinado({ parcelas: 3 }), conta = await contaPJ();
        await receber(k.parcelas[0].id, conta.id);
        // Quando: março está recebida, abril e maio a receber
        const deAbril = (await SD.parcelasDoPeriodo('2026-04-01', '2026-04-30', HOJE_DEPOIS)).filter(p => p.contrato_id === k.id).map(p => p.numero);
        const deMaio = (await SD.parcelasDoPeriodo('2026-05-01', '2026-05-31', HOJE_DEPOIS)).filter(p => p.contrato_id === k.id).map(p => p.numero);
        const deMarco = (await SD.parcelasDoPeriodo('2026-03-01', '2026-03-31', HOJE_DEPOIS)).filter(p => p.contrato_id === k.id);
        // Então
        expect(deAbril).toEqual([2]);
        expect(deMaio).toEqual([2, 3]);
        expect(deMarco.map(p => p.numero)).toEqual([1]);
        expect(deMarco[0].contrato_codigo).toBe(k.codigo);
      });

      it('quando a pessoa é cliente do contrato, então as parcelas aparecem no cartão dela', async () => {
        // Dado
        const { id: cliente } = await criar(marca());
        const k = await assinado({ clientes: [cliente] });
        // Quando
        const dela = await SD.parcelasDaPessoa(cliente);
        // Então
        expect(dela.map(p => [p.numero, p.contrato_codigo])).toEqual([[2, k.codigo], [1, k.codigo]]);
        expect(await SD.parcelasDaPessoa('p-ninguem')).toEqual([]);
      });

      it('quando mexe na lista de sócios, então período que se cruza é recusado, e tudo fica registrado', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        const s = await SD.financeiroSocioCriar({ pessoa_id: pessoa, desde: '2026-01-01', ate: '2026-06-30' });
        // Então
        expect((await SD.financeiroSocios()).find(x => x.id === s.id)!.nome).toBe(s.nome);
        await expect(SD.financeiroSocioCriar({ pessoa_id: pessoa, desde: '2026-06-01', ate: null })).rejects.toThrow('já é sócia');
        await expect(SD.financeiroSocioCriar({ pessoa_id: 'p-ninguem', desde: '2026-06-01', ate: null })).rejects.toThrow('Pessoa não encontrada');
        await expect(SD.financeiroSocioAtualizar(s.id, { desde: '2026-07-01', ate: '2026-06-30' })).rejects.toThrow('formato inválido');
        const segundo = await SD.financeiroSocioCriar({ pessoa_id: pessoa, desde: '2026-08-01', ate: null });
        await expect(SD.financeiroSocioAtualizar(s.id, { desde: '2026-01-01', ate: '2026-09-01' })).rejects.toThrow('já é sócia');
        await SD.financeiroSocioAtualizar(s.id, { desde: '2026-02-01', ate: '2026-06-30' });
        await SD.financeiroSocioExcluir(segundo.id);
        expect((await SD.financeiroSocios()).some(x => x.id === segundo.id)).toBe(false);
        await SD.financeiroSocioCriar({ pessoa_id: pessoa, desde: '2026-07-01', ate: null });
        await expect(SD.financeiroSocioRestaurar(segundo.id)).rejects.toThrow('já é sócia');
        expect(JSON.stringify(await SD.financeiroAjustes())).toContain('Sócio: ' + s.nome);
      });
    });

    describe('Caixa', () => {
      const novaConta = (extra: Partial<Parameters<Dados['financeiroContaCriar']>[0]> = {}) => SD.financeiroContaCriar({ nome: marca(), tem_das: false, saldo_inicial: 0, saldo_inicial_em: '2026-01-01', ...extra });
      const lancar = (contaId: string, extra: Partial<Parameters<Dados['financeiroLancamentoCriar']>[0]> = {}) =>
        SD.financeiroLancamentoCriar({ conta_id: contaId, data: '2026-03-10', tipo: 'entrada', categoria: 'recebimento', valor: 10000, descricao: 'Honorários', ...extra });
      const INVALIDO = 'Algum campo está em formato inválido.';

      it('quando lança no mês, então o saldo antes do mês conta o inicial e o que veio antes, sem o do mês nem os excluídos', async () => {
        // Dado
        const { id } = await novaConta({ saldo_inicial: 50000 });
        await lancar(id, { data: '2026-02-10', valor: 20000 });
        await lancar(id, { data: '2026-02-11', tipo: 'saida', categoria: 'despesa', valor: 5000 });
        const excluido = await lancar(id, { data: '2026-02-12', valor: 99900 });
        const noMes = await lancar(id, { data: '2026-03-01', valor: 7000 });
        await SD.financeiroLancamentoExcluir(excluido.id);
        // Então
        expect(await SD.financeiroSaldoAntes(id, '2026-03-01')).toBe(65000);
        expect((await SD.financeiroLancamentos(id, '2026-03-01', '2026-03-31')).map(l => l.id)).toEqual([noMes.id]);
        expect(await SD.financeiroLancamentos(id, '2026-02-01', '2026-02-28')).toHaveLength(2);
      });

      it('quando as contas são duas, então uma não mistura com a outra', async () => {
        // Dado
        const [a, b] = [await novaConta(), await novaConta()];
        await lancar(a.id);
        // Então
        expect(await SD.financeiroLancamentos(b.id, '2026-01-01', '2026-12-31')).toEqual([]);
        expect(await SD.financeiroSaldoAntes(b.id, '2027-01-01')).toBe(0);
      });

      it.each([
        ['valor zerado', { valor: 0 }], ['valor negativo', { valor: -1 }], ['valor com fração de centavo', { valor: 10.5 }], ['descrição vazia', { descricao: '  ' }],
        ['categoria de saída em entrada', { tipo: 'entrada' as const, categoria: 'despesa' as const }], ['categoria de entrada em saída', { tipo: 'saida' as const, categoria: 'recebimento' as const }]
      ])('quando há %s, então é recusado', async (_caso, extra) => {
        // Dado
        const { id } = await novaConta();
        // Quando
        const salvar = lancar(id, extra);
        // Então
        await expect(salvar).rejects.toThrow(INVALIDO);
      });

      it.each([
        ['ajuste a mais como saída', { tipo: 'saida' as const, categoria: 'ajuste_a_mais' as const }], ['ajuste a menos como entrada', { tipo: 'entrada' as const, categoria: 'ajuste_a_menos' as const }]
      ])('quando há %s, então é recusado', async (_caso, extra) => {
        // Dado
        const { id } = await novaConta();
        // Quando
        const salvar = lancar(id, extra);
        // Então
        await expect(salvar).rejects.toThrow(INVALIDO);
      });

      it('quando lança ajustes de saldo, então o saldo muda como em qualquer lançamento', async () => {
        // Dado
        const { id } = await novaConta({ saldo_inicial: 10000 });
        // Quando
        await lancar(id, { data: '2026-02-10', tipo: 'entrada', categoria: 'ajuste_a_mais', valor: 5000, descricao: 'Diferença do extrato' });
        await lancar(id, { data: '2026-02-11', tipo: 'saida', categoria: 'ajuste_a_menos', valor: 2000, descricao: 'Tarifa sem lançamento' });
        // Então
        expect(await SD.financeiroSaldoAntes(id, '2026-03-01')).toBe(13000);
      });

      it('quando muda, exclui e desfaz um ajuste de saldo, então funciona como os outros, e o histórico registra', async () => {
        // Dado
        const { id } = await novaConta();
        const l = await lancar(id, { tipo: 'entrada', categoria: 'ajuste_a_mais', valor: 5000, descricao: 'Diferença do extrato' });
        // Quando
        await SD.financeiroLancamentoAtualizar(l.id, { tipo: 'saida', categoria: 'ajuste_a_menos', valor: 4000 });
        // Então
        expect(await SD.financeiroSaldoAntes(id, '2026-04-01')).toBe(-4000);
        expect((await SD.financeiroHistorico(l.id))[0].alteracoes.categoria).toEqual({ de: 'ajuste_a_mais', para: 'ajuste_a_menos' });
        // Quando
        await SD.financeiroLancamentoExcluir(l.id);
        // Então
        expect(await SD.financeiroSaldoAntes(id, '2026-04-01')).toBe(0);
        // Quando
        await SD.financeiroLancamentoRestaurar(l.id);
        // Então
        expect(await SD.financeiroSaldoAntes(id, '2026-04-01')).toBe(-4000);
      });

      it('quando lista os ajustes de saldo, então vêm os de todas as contas, dos mais novos aos mais antigos, sem os outros lançamentos nem os excluídos', async () => {
        // Dado
        const [a, b] = [await novaConta(), await novaConta()];
        const antes = (await SD.financeiroAjustesDeSaldo()).map(l => l.id);
        const antigo = await lancar(a.id, { data: '2026-02-10', tipo: 'entrada', categoria: 'ajuste_a_mais', descricao: 'Antigo' });
        const novo = await lancar(b.id, { data: '2026-03-20', tipo: 'saida', categoria: 'ajuste_a_menos', descricao: 'Novo' });
        const excluido = await lancar(a.id, { data: '2026-03-21', tipo: 'saida', categoria: 'ajuste_a_menos', descricao: 'Excluído' });
        await lancar(a.id, { data: '2026-03-22', descricao: 'Honorários' });
        await SD.financeiroLancamentoExcluir(excluido.id);
        // Quando
        const lista = (await SD.financeiroAjustesDeSaldo()).filter(l => !antes.includes(l.id));
        // Então
        expect(lista.map(l => l.id)).toEqual([novo.id, antigo.id]);
      });

      it('quando a data é anterior ao saldo inicial, ou a conta está arquivada, então é recusado', async () => {
        // Dado
        const { id } = await novaConta({ saldo_inicial_em: '2026-03-01' });
        // Quando
        const antes = lancar(id, { data: '2026-02-28' });
        // Então
        await expect(antes).rejects.toThrow('Esta data é anterior ao saldo inicial da conta.');
        // Quando
        await SD.financeiroContaAtualizar(id, { arquivada_em: new Date().toISOString() });
        const arquivada = lancar(id);
        // Então
        await expect(arquivada).rejects.toThrow('Esta conta está arquivada.');
      });

      it('quando exclui uma conta, então só a arquivada que nunca teve lançamento sai; as outras são recusadas com o motivo (#347)', async () => {
        // Dado: uma ativa, uma arquivada sem nada e uma arquivada com um lançamento já excluído
        const ativa = await novaConta(), vazia = await novaConta(), comLancamento = await novaConta();
        const l = await lancar(comLancamento.id);
        await SD.financeiroLancamentoExcluir(l.id);
        for (const c of [vazia, comLancamento]) await SD.financeiroContaAtualizar(c.id, { arquivada_em: new Date().toISOString() });
        // Quando
        const arquivadasComLancamentos = await SD.financeiroArquivadasComLancamentos();
        // Então: só a arquivada com lançamento (a ativa não entra)
        expect(arquivadasComLancamentos).toContain(comLancamento.id);
        expect(arquivadasComLancamentos).not.toContain(vazia.id);
        expect(arquivadasComLancamentos).not.toContain(ativa.id);
        // Quando / Então: a ativa e a com lançamento são recusadas, com o motivo
        await expect(SD.financeiroContaExcluir(ativa.id)).rejects.toThrow(CONTA_NAO_ARQUIVADA);
        await expect(SD.financeiroContaExcluir(comLancamento.id)).rejects.toThrow(CONTA_COM_LANCAMENTOS);
        // Quando
        await SD.financeiroContaExcluir(vazia.id);
        // Então: a vazia sumiu; as outras continuam
        const ids = (await SD.financeiroContas()).map(c => c.id);
        expect(ids).not.toContain(vazia.id);
        expect(ids).toEqual(expect.arrayContaining([ativa.id, comLancamento.id]));
      });

      it('dado uma conta arquivada que é a conta de destino de um contrato, quando é excluída, então o contrato fica sem conta e o histórico guarda o nome dela (#347)', async () => {
        // Dado
        const { id } = await criar('DESTINO ' + marca());
        const contratoId = (await SD.pessoaFecharContrato(id))!.id;
        const nome = 'DESTINO ' + marca();
        const conta = await novaConta({ nome });
        await SD.contratoAtualizar(contratoId, { conta_destino_id: conta.id });
        await SD.financeiroContaAtualizar(conta.id, { arquivada_em: new Date().toISOString() });
        // Quando
        await SD.financeiroContaExcluir(conta.id);
        // Então
        expect((await SD.contratoObter(contratoId))!.conta_destino_id).toBeNull();
        const [ultima] = await SD.contratoHistorico(contratoId);
        expect(ultima.alteracoes).toEqual({ conta_destino_id: { de: nome, para: null } });
      });

      it('quando o início da conta passaria de um lançamento, então é recusado; o lançamento excluído não conta, mas não volta antes do início', async () => {
        // Dado
        const { id } = await novaConta();
        const l = await lancar(id, { data: '2026-03-10' });
        // Quando
        const depois = SD.financeiroContaAtualizar(id, { saldo_inicial_em: '2026-04-01' });
        // Então
        await expect(depois).rejects.toThrow('Há lançamentos antes dessa data.');
        // Quando
        await SD.financeiroContaAtualizar(id, { saldo_inicial_em: '2026-03-10' });
        await SD.financeiroLancamentoExcluir(l.id);
        await SD.financeiroContaAtualizar(id, { saldo_inicial_em: '2026-04-01' });
        const devolver = SD.financeiroLancamentoRestaurar(l.id);
        // Então
        await expect(devolver).rejects.toThrow('Esta data é anterior ao saldo inicial da conta.');
      });

      it('quando o lançamento está excluído, então não muda', async () => {
        // Dado
        const { id } = await novaConta();
        const l = await lancar(id);
        await SD.financeiroLancamentoExcluir(l.id);
        // Quando
        const mudar = SD.financeiroLancamentoAtualizar(l.id, { valor: 1 });
        // Então
        await expect(mudar).rejects.toThrow('Este lançamento foi excluído.');
      });

      it.each([['nome vazio', { nome: '  ' }], ['saldo com fração de centavo', { saldo_inicial: 10.5 }], ['início fora do calendário', { saldo_inicial_em: '1900-01-01' }], ['saldo absurdo', { saldo_inicial: 100000000000001 }]])('quando muda a conta para %s, então é recusado', async (_caso, extra) => {
        // Dado
        const { id } = await novaConta();
        // Quando
        const mudar = SD.financeiroContaAtualizar(id, extra);
        // Então
        await expect(mudar).rejects.toThrow(INVALIDO);
      });

      it('quando muda o saldo inicial, o início ou o DAS, então fica registrado como estava e como ficou', async () => {
        // Dado
        const nome = marca();
        const { id } = await novaConta({ nome, saldo_inicial: 100 });
        // Quando
        await SD.financeiroContaAtualizar(id, { saldo_inicial: 200, saldo_inicial_em: '2025-12-01' });
        await SD.financeiroDasSalvar('2032-01', 4);
        await SD.financeiroDasSalvar('2032-01', 5);
        // Então
        const [das, antes, conta] = await SD.financeiroAjustes();
        expect(das.alteracoes['DAS de 2032-01']).toEqual({ de: 4, para: 5 });
        expect(antes.alteracoes['DAS de 2032-01']).toEqual({ de: null, para: 4 });
        expect(conta.alteracoes['Saldo inicial de ' + nome]).toEqual({ de: 100, para: 200 });
        expect(conta.alteracoes['Início de ' + nome]).toEqual({ de: '2026-01-01', para: '2025-12-01' });
      });

      it('quando o nome da conta se repete, sem contar maiúsculas e acentos, então é recusado', async () => {
        // Dado
        const nome = 'Espécie ' + marca();
        await novaConta({ nome });
        // Quando
        const repetida = novaConta({ nome: nome.toUpperCase().replace('É', 'E') });
        // Então
        await expect(repetida).rejects.toThrow('Já existe uma conta com esse nome.');
      });

      it('quando muda um lançamento, então o histórico mostra como estava e como ficou; excluir e desfazer devolve igual', async () => {
        // Dado
        const { id } = await novaConta();
        const l = await lancar(id);
        // Quando
        await SD.financeiroLancamentoAtualizar(l.id, { valor: 12000 });
        // Então
        expect((await SD.financeiroHistorico(l.id))[0].alteracoes.valor).toEqual({ de: 10000, para: 12000 });
        // Quando
        await SD.financeiroLancamentoExcluir(l.id);
        expect(await SD.financeiroLancamentos(id, '2026-01-01', '2026-12-31')).toEqual([]);
        await SD.financeiroLancamentoRestaurar(l.id);
        // Então
        expect(await SD.financeiroLancamentos(id, '2026-01-01', '2026-12-31')).toEqual([expect.objectContaining({ id: l.id, valor: 12000, criado_em: l.criado_em })]);
      });

      it('quando transfere, então sai de uma conta e entra na outra; não muda depois, e excluir uma ponta exclui as duas', async () => {
        // Dado
        const [pj, pf] = [await novaConta({ saldo_inicial: 100000 }), await novaConta()];
        // Quando
        const saida = await SD.financeiroTransferir({ de: pj.id, para: pf.id, data: '2026-03-10', valor: 30000, descricao: 'Repasse' });
        // Então
        expect(await SD.financeiroSaldoAntes(pj.id, '2026-04-01')).toBe(70000);
        expect(await SD.financeiroSaldoAntes(pf.id, '2026-04-01')).toBe(30000);
        const [naPf] = await SD.financeiroLancamentos(pf.id, '2026-03-01', '2026-03-31');
        expect(naPf).toMatchObject({ tipo: 'entrada', categoria: 'transferencia', par_id: saida });
        // Quando
        const mudar = SD.financeiroLancamentoAtualizar(saida, { valor: 1 });
        // Então
        await expect(mudar).rejects.toThrow('A transferência não muda depois de criada: exclua e lance de novo.');
        // Quando
        await SD.financeiroLancamentoExcluir(naPf.id);
        // Então
        expect(await SD.financeiroSaldoAntes(pj.id, '2026-04-01')).toBe(100000);
        expect(await SD.financeiroSaldoAntes(pf.id, '2026-04-01')).toBe(0);
        // Quando
        await SD.financeiroLancamentoRestaurar(saida);
        // Então
        expect(await SD.financeiroSaldoAntes(pf.id, '2026-04-01')).toBe(30000);
      });

      it('quando transfere para a mesma conta, então é recusado', async () => {
        // Dado
        const { id } = await novaConta();
        // Quando
        const salvar = SD.financeiroTransferir({ de: id, para: id, data: '2026-03-10', valor: 1, descricao: 'x' });
        // Então
        await expect(salvar).rejects.toThrow('Escolha duas contas diferentes.');
      });

      it('quando lança o DAS do mesmo mês de novo, então troca o percentual; valor fora do aceito é recusado', async () => {
        // Quando
        await SD.financeiroDasSalvar('2031-05', 4.5);
        await SD.financeiroDasSalvar('2031-05', 5.25);
        // Então
        expect((await SD.financeiroDas()).find(a => a.mes === '2031-05')).toEqual({ mes: '2031-05', aliquota: 5.25 });
        // Quando
        const fora = SD.financeiroDasSalvar('2031-06', 101);
        // Então
        await expect(fora).rejects.toThrow(INVALIDO);
      });
    });

    describe('Painel de processos', () => {
      const HOJE = hojeISO();
      const dias = (n: number) => new Date(Date.parse(HOJE) + n * DIA).toISOString().slice(0, 10);
      const novoProcesso = async (extra: Partial<Parameters<Dados['processoCriar']>[0]> = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente], ...extra });
      };
      const PRAZO = { descricao: 'P', intimacao: null, dias: null, contagem: null, disponibilizacao: false, sem_recesso: false, andamento_id: null };
      const andamento = (tipo: 'andamento' | 'intimacao' | 'audiencia' | 'pericia', data: string) => ({ tipo, data, hora: null, local: null, texto: marca() });
      const painel = (meus = false) => SD.processosPainel({ hoje: HOJE, meus });

      it('quando há prazos, então vêm os abertos até 15 dias, do que vence antes ao que vence depois (#292)', async () => {
        // Dado
        const { id } = await novoProcesso();
        const [vencido, hoje, quinzeDias, dezesseisDias, cumprido] = [
          await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(-3) }), await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(0) }), await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(15) }),
          await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(16) }), await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(-1) })
        ];
        await SD.processoPrazoAtualizar(cumprido.id, { concluido_em: new Date().toISOString() });
        // Quando
        const ids = (await painel()).prazos.map(z => z.id);
        // Então
        expect(ids.filter(i => [vencido.id, hoje.id, quinzeDias.id].includes(i))).toEqual([vencido.id, hoje.id, quinzeDias.id]);
        expect(ids).not.toContain(dezesseisDias.id);
        expect(ids).not.toContain(cumprido.id);
      });

      it('quando a lista de prazos passa do limite, então os vencidos não escondem os de hoje', async () => {
        // Dado
        const { id } = await novoProcesso();
        const hoje = await SD.processoPrazoCriar(id, { ...PRAZO, final: HOJE });
        await Promise.all(Array.from({ length: ITENS_POR_LISTA + 1 }, () => SD.processoPrazoCriar(id, { ...PRAZO, final: dias(-3) })));
        // Quando
        const p = await painel();
        // Então
        expect(p.prazos.map(z => z.id)).toContain(hoje.id);
        expect(p.total_vencidos).toBeGreaterThan(ITENS_POR_LISTA);
        expect(p.prazos.filter(z => z.final < HOJE)).toHaveLength(ITENS_POR_LISTA);
      });

      it('quando a coluna do filtro não é um identificador, então não acha nada, sem erro', async () => {
        // Quando
        const r = await SD.processosListar({ tipo: 'judicial', etapa: 'link-cortado', situacao: 'ativos' });
        // Então
        expect(r.total).toBe(0);
      });

      it('quando há audiências e perícias, então vêm só as de hoje até 15 dias', async () => {
        // Dado
        const { id } = await novoProcesso();
        const criarAndamento = (tipo: 'andamento' | 'audiencia' | 'pericia', n: number) => SD.processoAndamentoCriar(id, andamento(tipo, dias(n)));
        const [ontem, hoje, quinze, dezesseis, comum] = [await criarAndamento('audiencia', -1), await criarAndamento('pericia', 0), await criarAndamento('audiencia', 15), await criarAndamento('audiencia', 16), await criarAndamento('andamento', 1)];
        // Quando
        const ids = (await painel()).marcados.map(a => a.id);
        // Então
        expect(ids).toEqual(expect.arrayContaining([hoje.id, quinze.id]));
        [ontem, dezesseis, comum].forEach(a => expect(ids).not.toContain(a.id));
      });

      it('quando a intimação vira tarefa ou é tratada, então sai de "a tratar"', async () => {
        // Dado
        const { id } = await novoProcesso();
        const [a, b, c] = [await SD.processoAndamentoCriar(id, andamento('intimacao', HOJE)), await SD.processoAndamentoCriar(id, andamento('intimacao', HOJE)), await SD.processoAndamentoCriar(id, andamento('intimacao', HOJE))];
        const t = await SD.tarefaCriar({ titulo: 'T', responsavel_id: 'u-ana', processo_id: id });
        // Quando
        await SD.processoAndamentoAtualizar(a.id, { tarefa_id: t.id, tratada_em: new Date().toISOString() });
        await SD.processoAndamentoAtualizar(b.id, { tratada_em: new Date().toISOString() });
        // Então
        const ids = (await painel()).intimacoes.map(x => x.id);
        expect(ids).toContain(c.id);
        expect(ids).not.toContain(a.id);
        expect(ids).not.toContain(b.id);
      });

      it('quando lista os últimos andamentos, então vêm os mais novos, até hoje, sem os excluídos', async () => {
        // Dado
        const { id } = await novoProcesso();
        const novo = await SD.processoAndamentoCriar(id, andamento('andamento', HOJE));
        const futuro = await SD.processoAndamentoCriar(id, andamento('audiencia', dias(5)));
        const excluido = await SD.processoAndamentoCriar(id, andamento('andamento', HOJE));
        await SD.processoAndamentoExcluir(excluido.id);
        // Quando
        const ids = (await painel()).ultimos.map(a => a.id);
        // Então
        expect(ids[0]).toBe(novo.id);
        expect(ids).not.toContain(futuro.id);
        expect(ids).not.toContain(excluido.id);
      });

      it('quando lista os últimos andamentos, então cada um traz o tipo da lista pronta, ou nada se não tem (#371)', async () => {
        // Dado
        const { id } = await novoProcesso();
        const despacho = await SD.processoAndamentoCriar(id, { ...andamento('andamento', HOJE), categoria: 'despacho' });
        const deAntes = await SD.processoAndamentoCriar(id, andamento('andamento', HOJE));
        // Quando
        const ultimos = (await painel()).ultimos;
        // Então
        expect(ultimos.find(a => a.id === despacho.id)?.categoria).toBe('despacho');
        expect(ultimos.find(a => a.id === deAntes.id)?.categoria).toBeNull();
      });

      it('quando o processo passa dos dias sem andamento, então aparece parado; com andamento novo, sai', async () => {
        // Dado
        await SD.processosDiasParadoSalvar(10);
        const { id } = await novoProcesso({ distribuicao: dias(-30) });
        const parado = async () => (await painel()).parados.find(x => x.processo.id === id);
        // Então
        expect(await parado()).toMatchObject({ ultimo: dias(-30), dias: 30 });
        // Quando
        const antigo = await SD.processoAndamentoCriar(id, andamento('andamento', dias(-20)));
        // Então
        expect(await parado()).toMatchObject({ ultimo: dias(-20), dias: 20 });
        // Quando
        await SD.processoAndamentoAtualizar(antigo.id, { data: dias(-5) });
        // Então
        expect(await parado()).toBeUndefined();
        await SD.processosDiasParadoSalvar(60);
      });

      it.each([[0], [3651], [1.5]])('quando os dias são %s, então é recusado', async n => {
        // Quando
        const salvar = SD.processosDiasParadoSalvar(n);
        // Então
        await expect(salvar).rejects.toThrow('Algum campo está em formato inválido.');
      });

      it('quando o processo é arquivado, então sai de todas as listas', async () => {
        // Dado
        const { id } = await novoProcesso({ distribuicao: dias(-400) });
        await SD.processoPrazoCriar(id, { ...PRAZO, final: HOJE });
        await SD.processoAndamentoCriar(id, andamento('intimacao', HOJE));
        // Quando
        await SD.processosArquivar([id], true);
        // Então
        const p = await painel();
        expect([...p.prazos, ...p.intimacoes, ...p.ultimos, ...p.parados].map(x => x.processo.id)).not.toContain(id);
      });

      it('quando escolhe "Meus", então ficam só os processos em que a pessoa é responsável ou colaboradora', async () => {
        // Dado
        const ctx = await SD.contexto();
        const eu = ctx!.perfil!.id, outro = ctx!.equipe.find(m => m.id !== eu)!.id;
        const meu = await novoProcesso({ responsavel_id: eu });
        const comigo = await novoProcesso({ responsavel_id: outro, colaboradores: [eu] });
        const alheio = await novoProcesso({ responsavel_id: outro });
        for (const p of [meu, comigo, alheio]) await SD.processoPrazoCriar(p.id, { ...PRAZO, final: HOJE });
        // Quando
        const [meus, todos] = [await painel(true), await painel(false)];
        // Então
        expect(meus.prazos.map(z => z.processo.id)).toEqual(expect.arrayContaining([meu.id, comigo.id]));
        expect(meus.prazos.map(z => z.processo.id)).not.toContain(alheio.id);
        expect(todos.prazos.map(z => z.processo.id)).toContain(alheio.id);
      });

      it('quando conta as fases, então soma por tipo e por coluna, e a lista filtra pela mesma coluna', async () => {
        // Dado
        const coluna = (await SD.colunasListar('processos_judiciais'))[0];
        const antes = (await painel()).fases.find(f => f.tipo === 'judicial' && f.etapa_id === coluna.id)?.n ?? 0;
        // Quando
        await novoProcesso({ etapa_id: coluna.id });
        // Então
        const depois = (await painel()).fases.find(f => f.tipo === 'judicial' && f.etapa_id === coluna.id)?.n;
        expect(depois).toBe(antes + 1);
        expect((await SD.processosListar({ tipo: 'judicial', etapa: coluna.id, situacao: 'ativos' })).total).toBe(depois);
      });

      describe('Gráficos do painel (#401)', () => {
        const graficos = (pessoa: string | null = null) => SD.processosGraficos({ hoje: HOJE, pessoa });

        it('quando pede os de uma pessoa, então vêm só os processos em que ela é responsável ou colaboradora, com os prazos e andamentos deles', async () => {
          // Dado
          const ctx = await SD.contexto();
          const eu = ctx!.perfil!.id, outro = ctx!.equipe.find(m => m.id !== eu)!.id;
          const meu = await novoProcesso({ responsavel_id: eu }), comigo = await novoProcesso({ responsavel_id: outro, colaboradores: [eu] }), alheio = await novoProcesso({ responsavel_id: outro });
          for (const p of [meu, comigo, alheio]) {
            await SD.processoPrazoCriar(p.id, { ...PRAZO, final: dias(3) });
            await SD.processoAndamentoCriar(p.id, andamento('andamento', HOJE));
          }
          // Quando
          const [meus, todos] = [await graficos(eu), await graficos()];
          // Então
          const ids = (g: { processos: { id: string }[] }) => g.processos.map(p => p.id);
          expect(ids(meus)).toEqual(expect.arrayContaining([meu.id, comigo.id]));
          expect(ids(meus)).not.toContain(alheio.id);
          expect(meus.prazos.map(z => z.processo_id)).not.toContain(alheio.id);
          expect(meus.andamentos.map(a => a.processo_id)).not.toContain(alheio.id);
          expect(ids(todos)).toContain(alheio.id);
        });

        it('quando conta os prazos, então vêm os abertos até o fim da quarta semana, com os vencidos, sem os cumpridos nem os de processo arquivado', async () => {
          // Dado
          const { id } = await novoProcesso(), arquivado = await novoProcesso();
          const [vencido, ultimoDia, depois, cumprido] = [await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(-40) }), await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(27) }),
            await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(28) }), await SD.processoPrazoCriar(id, { ...PRAZO, final: dias(1) })];
          await SD.processoPrazoAtualizar(cumprido.id, { concluido_em: new Date().toISOString() });
          await SD.processoPrazoCriar(arquivado.id, { ...PRAZO, final: dias(1) });
          await SD.processosArquivar([arquivado.id]);
          // Quando
          const g = await graficos();
          // Então
          const finais = g.prazos.filter(z => z.processo_id === id).map(z => z.final).toSorted();
          expect(finais).toEqual([vencido.final, ultimoDia.final]);
          expect(depois.final > finais.at(-1)!).toBe(true);
          expect(g.prazos.map(z => z.processo_id)).not.toContain(arquivado.id);
          expect(g.processos.find(p => p.id === arquivado.id)?.arquivado_em).toBeTruthy();
        });

        it('quando o processo vai para outra coluna, então a troca vem com o nome das duas colunas', async () => {
          // Dado
          const colunas = await SD.colunasListar('processos_judiciais');
          const [primeira, ultima] = [colunas[0], colunas.at(-1)!];
          const { id } = await novoProcesso({ etapa_id: primeira.id });
          // Quando
          await SD.processoAtualizar(id, { etapa_id: ultima.id });
          // Então
          const troca = (await graficos()).mudancas.find(m => m.processo_id === id);
          expect(troca).toMatchObject({ de: primeira.nome, para: ultima.nome });
        });

        it('quando o andamento é de antes do período ou foi excluído, então não conta', async () => {
          // Dado
          const { id } = await novoProcesso();
          const [velho, excluido, novo] = [await SD.processoAndamentoCriar(id, andamento('andamento', '2000-01-03')), await SD.processoAndamentoCriar(id, andamento('andamento', HOJE)),
            await SD.processoAndamentoCriar(id, andamento('andamento', HOJE))];
          await SD.processoAndamentoExcluir(excluido.id);
          // Quando
          const datas = (await graficos()).andamentos.filter(a => a.processo_id === id).map(a => a.data);
          // Então
          expect(datas).toEqual([novo.data]);
          expect(datas).not.toContain(velho.data);
        });
      });
    });

    describe('Campos dos processos', () => {
      const processoCom = async (extra: Partial<Parameters<Dados['processoCriar']>[0]> = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'judicial', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente], ...extra });
      };
      const novoCampo = (extra: Partial<Parameters<Dados['processoCampoCriar']>[0]> = {}) =>
        SD.processoCampoCriar({ nome: marca(), tipo: 'texto', aparece_em: 'ambos', opcoes: [], ...extra });

      it('quando o administrador cria um campo, então ele volta na lista, e o valor é gravado no processo', async () => {
        // Dado
        const c = await novoCampo({ nome: '  Perito ' + marca() + ' ' });
        // Quando
        const { id } = await processoCom({ campos: { [c.id]: ' Dra. Exemplo ' } });
        // Então
        expect(c.nome).toBe(c.nome.trim());
        expect((await SD.processoCampos()).map(x => x.id)).toContain(c.id);
        expect((await SD.processoObter(id))?.campos).toEqual({ [c.id]: 'Dra. Exemplo' });
      });

      it('quando o nome já existe, sem contar maiúsculas nem acentos, então é recusado', async () => {
        // Dado
        const nome = 'Perícia ' + marca();
        await novoCampo({ nome });
        // Quando
        const repetido = novoCampo({ nome: nome.toUpperCase().replace('Í', 'I') });
        // Então
        await expect(repetido).rejects.toThrow('Já existe um campo com esse nome.');
      });

      it.each([
        ['lista sem opção', { tipo: 'lista' as const, opcoes: [] }],
        ['opção sem ser lista', { tipo: 'texto' as const, opcoes: ['a'] }]
      ])('quando é %s, então é recusado', async (_caso, extra) => {
        // Quando
        const salvar = novoCampo(extra);
        // Então
        await expect(salvar).rejects.toThrow('Algum campo está em formato inválido.');
      });

      it('quando a lista tem opções repetidas ou vazias, então elas ficam limpas', async () => {
        // Quando
        const lista = await novoCampo({ tipo: 'lista', opcoes: [' Site ', 'site', '', 'Parceiro'] });
        // Então
        expect(lista.opcoes).toEqual(['Site', 'Parceiro']);
      });

      it.each([
        ['data', { tipo: 'data' as const }, '2026-02-31'], ['data', { tipo: 'data' as const }, '10/12/2026'],
        ['número', { tipo: 'numero' as const }, 'muitos'], ['lista', { tipo: 'lista' as const, opcoes: ['Site'] }, 'Outra']
      ])('quando o valor não serve para o campo de %s, então é recusado', async (_tipo, extra, valor) => {
        // Dado
        const c = await novoCampo(extra);
        // Quando
        const gravar = processoCom({ campos: { [c.id]: valor } });
        // Então
        await expect(gravar).rejects.toThrow(`Confira o valor do campo "${c.nome}".`);
      });

      it('quando o campo não existe, ou não vale para esse tipo de processo, então é recusado', async () => {
        // Dado
        const soAdm = await novoCampo({ aparece_em: 'administrativo' });
        // Quando
        const deFora = processoCom({ campos: { 'campo-de-outro-escritorio': 'x' } });
        const outroTipo = processoCom({ tipo: 'judicial', campos: { [soAdm.id]: 'x' } });
        // Então
        await expect(deFora).rejects.toThrow('Campo não encontrado neste escritório.');
        await expect(outroTipo).rejects.toThrow('Campo não encontrado neste escritório.');
        await expect(processoCom({ tipo: 'administrativo', campos: { [soAdm.id]: 'x' } })).resolves.toMatchObject({ id: expect.any(String) });
      });

      it('quando o campo é apagado, então o valor fica guardado, não trava as outras alterações, e não aceita valor novo', async () => {
        // Dado
        const c = await novoCampo();
        const { id } = await processoCom({ campos: { [c.id]: 'guardado' } });
        // Quando
        await SD.processoCampoAtualizar(c.id, { apagado_em: new Date().toISOString() });
        // Então
        await expect(SD.processoAtualizar(id, { comarca: 'Cidade', campos: { [c.id]: 'guardado' } })).resolves.toMatchObject({ id });
        expect((await SD.processoObter(id))?.campos).toEqual({ [c.id]: 'guardado' });
        await expect(SD.processoAtualizar(id, { campos: { [c.id]: 'outro' } })).rejects.toThrow('Campo não encontrado neste escritório.');
        // Quando
        await SD.processoCampoAtualizar(c.id, { apagado_em: null });
        // Então
        await expect(SD.processoAtualizar(id, { campos: { [c.id]: 'outro' } })).resolves.toMatchObject({ id });
      });

      it('quando a opção sai da lista, então o processo que a usa continua com ela', async () => {
        // Dado
        const c = await novoCampo({ tipo: 'lista', opcoes: ['Site', 'Parceiro'] });
        const { id } = await processoCom({ campos: { [c.id]: 'Site' } });
        // Quando
        await SD.processoCampoAtualizar(c.id, { opcoes: ['Parceiro'] });
        // Então
        await expect(SD.processoAtualizar(id, { comarca: 'Cidade', campos: { [c.id]: 'Site' } })).resolves.toMatchObject({ id });
        await expect(processoCom({ campos: { [c.id]: 'Site' } })).rejects.toThrow(`Confira o valor do campo "${c.nome}".`);
      });

      it('quando nenhum processo usa o campo, então ele pode ser excluído e o nome fica livre; em uso, não', async () => {
        // Dado
        const nome = marca();
        const livre = await novoCampo({ nome }), usado = await novoCampo();
        await processoCom({ campos: { [usado.id]: 'x' } });
        // Quando
        const [excluiu, naoExcluiu] = await Promise.all([SD.processoCampoExcluir(livre.id), SD.processoCampoExcluir(usado.id)]);
        // Então
        expect([excluiu, naoExcluiu]).toEqual([true, false]);
        await expect(novoCampo({ nome })).resolves.toMatchObject({ nome });
        expect((await SD.processoCampos()).map(c => c.id)).toContain(usado.id);
      });

      it('quando o número tem até o limite de algarismos, então é guardado inteiro', async () => {
        // Dado
        const c = await novoCampo({ tipo: 'numero' });
        const valor = '12345678901234567890.1234567890';
        // Quando
        const { id } = await processoCom({ campos: { [c.id]: valor } });
        // Então
        expect((await SD.processoObter(id))?.campos[c.id]).toBe(valor);
        await expect(processoCom({ campos: { [c.id]: '1'.repeat(21) } })).rejects.toThrow(`Confira o valor do campo "${c.nome}".`);
      });

      it('quando o valor muda, então o histórico mostra o campo; o vazio sai do processo', async () => {
        // Dado
        const c = await novoCampo();
        const { id } = await processoCom({ campos: { [c.id]: 'antes' } });
        // Quando
        await SD.processoAtualizar(id, { campos: { [c.id]: 'depois' } });
        await SD.processoAtualizar(id, { campos: { [c.id]: '  ' } });
        // Então
        const [limpou, mudou] = await SD.processoHistorico(id);
        expect(mudou.alteracoes['campo:' + c.id]).toEqual({ de: 'antes', para: 'depois' });
        expect(limpou.alteracoes['campo:' + c.id]).toEqual({ de: 'depois', para: null });
        expect((await SD.processoObter(id))?.campos).toEqual({});
      });
    });

    describe('Tarefas', () => {
      // Quem está logado é o Mauro (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const novaTarefa = (extra: Parameters<Dados['tarefaCriar']>[0] = {}) =>
        SD.tarefaCriar({ titulo: 'Emitir a GRU', responsavel_id: 'u-ana', ...extra });

      it.each([
        ['prazo', ['dia', 'dia-8h', 'depois', 'sem']],
        ['prazo_desc', ['depois', 'dia-8h', 'dia', 'sem']]
      ] as const)('dadas tarefas com e sem prazo, quando a ordem é %s, então vêm pelo prazo, com o sem hora antes no mesmo dia e as sem prazo no fim (#291)', async (ordem, esperado) => {
        // Dado
        const parte = marca();
        await novaTarefa({ titulo: parte + ' sem' });
        await novaTarefa({ titulo: parte + ' depois', prazo: '2031-03-15' });
        await novaTarefa({ titulo: parte + ' dia-8h', prazo: '2031-03-12', prazo_hora: '08:00' });
        await novaTarefa({ titulo: parte + ' dia', prazo: '2031-03-12' });
        // Quando
        const r = await SD.tarefasListar({ termo: parte, ordem });
        // Então
        expect(r.linhas.map(x => x.titulo)).toEqual(esperado.map(x => parte + ' ' + x));
      });

      it('quando uma tarefa é criada, então ganha um código curto, e o responsável não fica entre os participantes', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        // Quando
        const { id, codigo } = await novaTarefa({ titulo: '  Pedir documentos  ', participantes: ['u-bruno', 'u-ana', 'u-bruno'], pessoas: [pessoa, pessoa] });
        // Então
        expect(codigo).toMatch(/^[0-9A-F]{8}$/);
        expect(await SD.tarefaObter(id)).toMatchObject({ titulo: 'Pedir documentos', responsavel_id: 'u-ana', participantes: ['u-bruno'],
          pessoas: [{ id: pessoa }], contrato: null });
        // Sem demanda, a tarefa entra na demanda contínua (#313), que só a agrupa.
        expect((await SD.tarefaObter(id))?.demanda).toMatchObject({ continua: true });
      });

      it('quando a tarefa é ligada a uma demanda, então guarda o código dela e aparece entre as tarefas da demanda', async () => {
        // Dado
        const { id: demanda, codigo } = await SD.demandaCriar({ titulo: 'Registro', responsavel_id: 'u-master' });
        // Quando
        const { id } = await novaTarefa({ demanda_id: demanda });
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ demanda_codigo: codigo, demanda: { id: demanda, codigo, titulo: 'Registro' } });
        expect((await SD.tarefasDaDemanda(demanda)).map(t => t.id)).toEqual([id]);
      });

      it('quando a demanda é excluída, então as tarefas dela ficam, só desligadas', async () => {
        // Dado
        const { id: demanda } = await SD.demandaCriar({ titulo: 'Registro', responsavel_id: 'u-master' });
        const { id } = await novaTarefa({ demanda_id: demanda });
        // Quando
        await SD.demandasArquivar([demanda]);
        await SD.demandasExcluir([demanda]);
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: null, demanda_codigo: null, demanda: null });
      });

      it('quando se pedem as tarefas de uma pessoa, então vêm as dela, com o papel dela em cada uma', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        const { id: ligada } = await novaTarefa({ pessoas: [pessoa] });
        const { id: comoParticipante } = await novaTarefa({ participantes: ['u-bruno'] });
        // Quando
        const daPessoa = await SD.tarefasDaPessoa(pessoa);
        const doBruno = await SD.tarefasDaPessoa('p-bruno', 'u-bruno');
        // Então
        expect(daPessoa.map(t => [t.id, t.papeis])).toEqual([[ligada, ['pessoa']]]);
        expect(doBruno.find(t => t.id === comoParticipante)?.papeis).toEqual(['participante']);
      });

      it('quando a tarefa muda, então o histórico mostra os nomes', async () => {
        // Dado
        const { id } = await novaTarefa();
        // Quando
        await SD.tarefaAtualizar(id, { responsavel_id: 'u-bruno', participantes: ['u-ana'] });
        // Então
        const [ultima] = await SD.tarefaHistorico(id);
        expect(ultima.alteracoes).toEqual({ responsavel_id: { de: 'Ana Teste Lima', para: 'Bruno Exemplo Souza' }, participantes: { de: null, para: 'Ana Teste Lima' } });
      });

      it('quando o comentário da tarefa menciona quem não a vê, então é recusado; quem vê a demanda ligada pode', async () => {
        // Dado (a tarefa é da Ana, numa demanda em que o Bruno colabora)
        const { id: demanda } = await SD.demandaCriar({ titulo: 'Registro', responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
        const { id: avulsa } = await novaTarefa();
        const { id: daDemanda } = await novaTarefa({ demanda_id: demanda });
        // Quando
        const [deFora, peloQuadro] = await Promise.allSettled([
          SD.comentarioCriar('tarefas', avulsa, 'Veja, @bruno.souza'), SD.comentarioCriar('tarefas', daDemanda, 'Veja, @bruno.souza')
        ]);
        // Então
        expect(deFora).toMatchObject({ status: 'rejected', reason: { message: 'Não é possível mencionar Bruno Exemplo Souza nesta tarefa: inclua essa pessoa como participante antes.' } });
        expect(peloQuadro).toMatchObject({ status: 'fulfilled', value: { mencoes: ['u-bruno'] } });
      });

      it('quando a pessoa está numa tarefa, então ela não pode ser excluída', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        await novaTarefa({ pessoas: [pessoa] });
        await SD.pessoasArquivar([pessoa]);
        // Quando
        const r = await SD.pessoasExcluir([pessoa]);
        // Então
        expect(r).toMatchObject({ excluidas: 0, motivo: 'Esta pessoa está em tarefas e não pode ser excluída.' });
      });

      it('quando a tarefa está ativa, então não é excluída; arquivada, é', async () => {
        // Dado
        const { id } = await novaTarefa();
        // Quando
        const ativa = await SD.tarefasExcluir([id]);
        await SD.tarefasArquivar([id]);
        const arquivada = await SD.tarefasExcluir([id]);
        // Então
        expect([ativa.excluidas, arquivada.excluidas]).toEqual([0, 1]);
        expect(await SD.tarefaObter(id)).toBeNull();
      });

      it('quando a tarefa vai para outra coluna, então continua lá ao ser lida de novo, e a coluna entra no histórico', async () => {
        // Dado
        const { id } = await novaTarefa();
        const fazendo = (await SD.colunasListar('tarefas')).find(c => c.nome === 'Fazendo')!;
        // Quando
        await SD.tarefaMover(id, fazendo.id, 1);
        // Então
        expect((await SD.tarefasDaEtapa(fazendo.id)).linhas.map(t => t.id)).toContain(id);
        expect((await SD.tarefaHistorico(id))[0].alteracoes).toEqual({ etapa: { de: null, para: 'Fazendo' } });
      });

      it('quando as colunas de tarefas são listadas, então "Para fazer" e "Concluída" são as colunas-marco, com as duas esperas (#314) depois de "Fazendo"', async () => {
        // Quando
        const colunas = await SD.colunasListar('tarefas');
        // Então
        expect(colunas.map(c => [c.nome, c.marco ?? null])).toEqual([['Para fazer', 'inicio'], ['Fazendo', null], ['Aguardando: análise do solicitante', null],
          ['Aguardando: retorno do cliente', null], ['Aguardando retorno', null], ['Concluída', 'concluido']]);
      });

      it('quando a coluna é excluída, então a tarefa vai para "sem situação"', async () => {
        // Dado
        const coluna = (await SD.colunasListar('tarefas')).find(c => !c.marco)!;
        const { id } = await novaTarefa({ etapa_id: coluna.id, etapa_ordem: 1 });
        // Quando
        await SD.colunaExcluir(coluna.id);
        // Então
        expect((await SD.tarefaObter(id))?.etapa_id).toBeNull();
        expect((await SD.tarefasDaEtapa(null)).linhas.map(t => t.id)).toContain(id);
      });
    });

    describe('Tarefa: diligência, solicitante e funções dos participantes (#313)', () => {
      // Quem está logado é o Mauro (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const novaTarefa = (extra: Parameters<Dados['tarefaCriar']>[0] = {}) =>
        SD.tarefaCriar({ titulo: 'Protocolar ' + marca(), responsavel_id: 'u-ana', ...extra });

      it('quando a tarefa é marcada como diligência sem motivo, então é recusada; com o motivo, ele fica limpo e aparece na lista', async () => {
        // Quando
        const semMotivo = await novaTarefa({ diligencia: true, diligencia_motivo: '   ' }).catch((e: Error) => e.message);
        const { id } = await novaTarefa({ diligencia: true, diligencia_motivo: '  Protocolar no cartório  ' });
        // Então
        expect(semMotivo).toBe(SEM_MOTIVO_DA_DILIGENCIA);
        expect(await SD.tarefaObter(id)).toMatchObject({ diligencia: true, diligencia_motivo: 'Protocolar no cartório' });
        expect((await SD.tarefasListar({ porPagina: 500 })).linhas.find(t => t.id === id)?.diligencia).toBe(true);
      });

      it('quando a tarefa deixa de ser diligência, então o motivo sai junto e o histórico registra a troca', async () => {
        // Dado
        const { id } = await novaTarefa({ diligencia: true, diligencia_motivo: 'Ir ao fórum' });
        // Quando
        await SD.tarefaAtualizar(id, { diligencia: false });
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ diligencia: false, diligencia_motivo: null });
        expect((await SD.tarefaHistorico(id))[0].alteracoes.diligencia).toEqual({ de: true, para: false });
      });

      it('quando uma tarefa comum é criada, então ela não é diligência', async () => {
        // Quando
        const { id } = await novaTarefa();
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ diligencia: false, diligencia_motivo: null });
      });

      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      afterEach(() => entrarComo('u-master'));
      const funcao = async (nome: string) => (await SD.funcoesNaTarefaListar()).find(f => f.nome === nome)!;

      it('dado o escritório, então as funções de fábrica são "Executa" (de execução) e "Acompanha", nessa ordem', async () => {
        // Quando
        const lista = await SD.funcoesNaTarefaListar();
        // Então
        expect(lista.slice(0, 2).map(f => [f.nome, f.executa])).toEqual([['Executa', true], ['Acompanha', false]]);
      });

      it('quando a administradora cria uma função, então ela vai para o fim da lista; o nome repetido e quem não é administrador são recusados', async () => {
        // Dado
        const nome = 'Revisa ' + marca();
        // Quando
        const nova = await SD.funcaoNaTarefaCriar({ nome: '  ' + nome + ' ', executa: false });
        const repetida = await SD.funcaoNaTarefaCriar({ nome: nome.toLowerCase(), executa: true }).catch((e: Error) => e.message);
        entrarComo('u-bruno');
        const deFora = await SD.funcaoNaTarefaCriar({ nome: 'Outra ' + marca(), executa: false }).catch((e: Error) => e.message);
        // Então
        expect(nova.nome).toBe(nome);
        expect((await SD.funcoesNaTarefaListar()).at(-1)?.id).toBe(nova.id);
        expect(repetida).toBe(FUNCAO_REPETIDA);
        expect(deFora).toBe('Você não tem permissão para fazer isso.');
      });

      it('quando a tarefa é criada com a função de um participante, então os outros ficam com a padrão, e a troca de função vai ao histórico', async () => {
        // Dado
        const [executa, acompanha] = [await funcao('Executa'), await funcao('Acompanha')];
        const { id } = await novaTarefa({ participantes: ['u-bruno', 'u-master'], funcoes: { 'u-bruno': executa.id } });
        // Quando
        await SD.tarefaAtualizar(id, { funcoes: { 'u-bruno': executa.id, 'u-master': executa.id } });
        // Então
        expect((await SD.tarefaObter(id))?.funcoes).toEqual({ 'u-bruno': executa.id, 'u-master': executa.id });
        expect((await SD.tarefaHistorico(id))[0].alteracoes.funcoes).toEqual({ de: 'Mauro Teixeira Duarte: ' + acompanha.nome, para: 'Mauro Teixeira Duarte: Executa' });
      });

      it('quando um participante sai, então sai também das funções; quem entra pela lista ganha a padrão', async () => {
        // Dado
        const [executa, acompanha] = [await funcao('Executa'), await funcao('Acompanha')];
        const { id } = await novaTarefa({ participantes: ['u-bruno'], funcoes: { 'u-bruno': executa.id } });
        // Quando
        await SD.tarefaAtualizar(id, { participantes: ['u-master'] });
        // Então
        expect((await SD.tarefaObter(id))?.funcoes).toEqual({ 'u-master': acompanha.id });
      });

      it('quando a função de outro escritório chega, então é recusada', async () => {
        // Quando
        const r = await novaTarefa({ participantes: ['u-bruno'], funcoes: { 'u-bruno': 'de-outro-escritorio' } }).catch((e: Error) => e.message);
        // Então
        expect(r).toBe('Função não encontrada neste escritório.');
      });

      it('quando a função está em uso, então não é apagada; fora de uso, é', async () => {
        // Dado
        const usada = await SD.funcaoNaTarefaCriar({ nome: 'Usada ' + marca(), executa: false });
        const livre = await SD.funcaoNaTarefaCriar({ nome: 'Livre ' + marca(), executa: false });
        await novaTarefa({ participantes: ['u-bruno'], funcoes: { 'u-bruno': usada.id } });
        // Quando
        const recusa = await SD.funcaoNaTarefaExcluir(usada.id).catch((e: Error) => e.message);
        await SD.funcaoNaTarefaExcluir(livre.id);
        // Então
        expect(recusa).toBe(funcaoEmUso(usada.nome, 1));
        expect((await SD.funcoesNaTarefaListar()).map(f => f.id)).not.toContain(livre.id);
      });

      it('quando o filtro pede as tarefas delegadas a alguém, então vêm só as em que ele é participante com a função de execução', async () => {
        // Dado
        const executa = await funcao('Executa'), parte = marca();
        const { id: delegada } = await novaTarefa({ titulo: parte + ' delegada', participantes: ['u-bruno'], funcoes: { 'u-bruno': executa.id } });
        await novaTarefa({ titulo: parte + ' acompanha', participantes: ['u-bruno'] });
        // Quando
        const r = await SD.tarefasListar({ termo: parte, funcao: { de: 'u-bruno', ids: [executa.id] } });
        const nenhuma = await SD.tarefasListar({ termo: parte, funcao: { de: 'u-bruno', ids: [] } });
        // Então
        expect(r.linhas.map(t => t.id)).toEqual([delegada]);
        expect(nenhuma.total).toBe(0);
      });

      it('quando a tarefa tem solicitante, então ele fica gravado, sem trocar o responsável, e serve de filtro; de fora da equipe é recusado', async () => {
        // Dado
        const parte = marca();
        const { id } = await novaTarefa({ titulo: parte + ' pedida', solicitante_id: 'u-bruno' });
        await novaTarefa({ titulo: parte + ' outra' });
        // Quando
        const r = await SD.tarefasListar({ termo: parte, solicitante: 'u-bruno' });
        const deFora = await SD.tarefaAtualizar(id, { solicitante_id: 'u-ninguem' }).catch((e: Error) => e.message);
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ solicitante_id: 'u-bruno', responsavel_id: 'u-ana' });
        expect(r.linhas.map(t => t.id)).toEqual([id]);
        expect(deFora).toBe('O solicitante precisa ser alguém da equipe do escritório.');
      });
    });

    describe('Tarefa em mais de uma demanda e de um contrato (#283)', () => {
      // Quem está logado é o Mauro (administrador). O Bruno colabora só na segunda demanda.
      const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
      afterEach(() => entrarComo('u-master'));
      const novoContrato = async () => {
        const { id: cliente } = await criar(marca());
        return SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
      };
      const duasDemandas = async () => Promise.all([
        SD.demandaCriar({ titulo: 'Primeira ' + marca(), responsavel_id: 'u-master' }),
        SD.demandaCriar({ titulo: 'Segunda ' + marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] })
      ]);

      it('dada uma tarefa com duas demandas e dois contratos, quando é lida, então a principal é a primeira, cada uma vem com o código e ela aparece em todas', async () => {
        // Dado
        const [d1, d2] = await duasDemandas();
        const [k1, k2] = [await novoContrato(), await novoContrato()];
        // Quando
        const { id } = await SD.tarefaCriar({ titulo: 'Em várias', responsavel_id: 'u-ana', demanda_ids: [d1.id, d2.id], contrato_ids: [k1.id, k2.id] });
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: d1.id, demanda_codigo: d1.codigo, demanda_ids: [d1.id, d2.id], contrato_id: k1.id,
          demandas_ligadas: [{ id: d1.id, codigo: d1.codigo, item: { id: d1.id } }, { id: d2.id, codigo: d2.codigo, item: { id: d2.id } }],
          contratos_ligados: [{ id: k1.id, codigo: k1.codigo }, { id: k2.id, codigo: k2.codigo }] });
        expect((await SD.tarefasDaDemanda(d2.id)).map(t => t.id)).toEqual([id]);
        expect((await SD.tarefasDoContrato(k2.id)).map(t => t.id)).toEqual([id]);
      });

      it('dada uma tarefa em duas demandas, quando a versão anterior do site grava só demanda_id, então troca só a principal', async () => {
        // Dado
        const [d1, d2] = await duasDemandas();
        const { id: d3 } = await SD.demandaCriar({ titulo: 'Terceira ' + marca(), responsavel_id: 'u-master' });
        const { id } = await SD.tarefaCriar({ titulo: 'Em várias', responsavel_id: 'u-ana', demanda_ids: [d1.id, d2.id] });
        // Quando
        await SD.tarefaAtualizar(id, { demanda_id: d3 });
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: d3, demanda_ids: [d3, d2.id] });
      });

      it('dada uma tarefa em duas demandas, quando a principal é excluída, então a tarefa fica na outra, que vira a principal', async () => {
        // Dado
        const [d1, d2] = await duasDemandas();
        const { id } = await SD.tarefaCriar({ titulo: 'Em várias', responsavel_id: 'u-ana', demanda_ids: [d1.id, d2.id] });
        // Quando
        await SD.demandasArquivar([d1.id]);
        await SD.demandasExcluir([d1.id]);
        // Então
        expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: d2.id, demanda_codigo: d2.codigo, demanda_ids: [d2.id] });
      });

      it('dada uma tarefa em duas demandas, quando quem colabora só na segunda vê a lista, então a lista traz quem está nela (ele altera a tarefa)', async () => {
        // Dado
        const [d1, d2] = await duasDemandas();
        const { id } = await SD.tarefaCriar({ titulo: 'Em várias', responsavel_id: 'u-ana', demanda_ids: [d1.id, d2.id] });
        // Quando
        entrarComo('u-bruno');
        const naLista = (await SD.tarefasListar({ porPagina: 100 })).linhas.find(t => t.id === id);
        // Então
        expect(naLista?.equipes_das_outras_demandas).toEqual([{ criado_por: 'u-master', responsavel_id: 'u-master', colaboradores: ['u-bruno'], grupos: [], continua: false }]);
      });
    });

    describe('Meu tempo trabalhado', () => {
      const novaTarefa = async (titulo: string) => (await SD.tarefaCriar({ titulo, responsavel_id: 'u-master' })).id;

      it('quando a pessoa tem tempo em tarefas no período, então vem cada tarefa com a soma, da maior para a menor, e o que está fora fica de fora', async () => {
        // Dado
        const [menor, maior] = [await novaTarefa('Menor ' + marca()), await novaTarefa('Maior ' + marca())];
        await SD.tempoIniciar(menor, '2030-01-10T13:00:00.000Z', 600);
        await SD.tempoIniciar(maior, '2030-01-11T13:00:00.000Z', 1200);
        await SD.tempoIniciar(maior, '2030-01-12T13:00:00.000Z', 300);
        await SD.tempoIniciar(menor, '2030-02-10T13:00:00.000Z', 999);
        // Quando
        const linhas = await SD.tempoPorTarefa('u-master', '2030-01-01', '2030-02-01');
        // Então
        expect(linhas.map(l => [l.tarefa_id, l.segundos])).toEqual([[maior, 1500], [menor, 600]]);
        expect(linhas[0]).toMatchObject({ arquivada: false });
      });

      it('quando o fim do período é um dia, então esse dia não entra', async () => {
        // Dado
        const tarefa = await novaTarefa('Limite ' + marca());
        await SD.tempoIniciar(tarefa, '2031-03-04T13:00:00.000Z', 600);
        // Quando
        const antes = await SD.tempoPorTarefa('u-master', '2031-03-01', '2031-03-04');
        const comODia = await SD.tempoPorTarefa('u-master', '2031-03-01', '2031-03-05');
        // Então
        expect(antes).toEqual([]);
        expect(comODia.map(l => l.segundos)).toEqual([600]);
      });

      it('quando um ajuste zera o tempo da tarefa, então ela sai da lista', async () => {
        // Dado: o ajuste conta no dia em que é feito, então o período contado também é de hoje
        const tarefa = await novaTarefa('Zerada ' + marca());
        await SD.tempoIniciar(tarefa, new Date().toISOString(), 300);
        await SD.tempoAjustar(tarefa, -300, 'Contei por engano');
        const hoje = hojeISO(), amanha = hojeISO(new Date(Date.now() + DIA));
        // Quando
        const linhas = await SD.tempoPorTarefa('u-master', hoje, amanha);
        // Então
        expect(linhas.some(l => l.tarefa_id === tarefa)).toBe(false);
      });
    });

    describe('Tempo nas tarefas', () => {
      // Quem está logado é o Mauro (administrador): vê os registros de todos.
      const novaTarefa = async (extra: Parameters<Dados['tarefaCriar']>[0] = {}) =>
        (await SD.tarefaCriar({ titulo: 'Com tempo', responsavel_id: 'u-master', ...extra })).id;

      it('quando o cronômetro grava um período, então ele só cresce e entra no tempo da tarefa', async () => {
        // Dado
        const tarefa = await novaTarefa();
        // Quando
        const id = await SD.tempoIniciar(tarefa, new Date().toISOString(), 60);
        await SD.tempoGravar(id, 300);
        const diminuir = SD.tempoGravar(id, 100);
        // Então
        await expect(diminuir).rejects.toThrow('O tempo contado não diminui: para corrigir, faça um ajuste.');
        expect(await SD.tempoDaTarefa(tarefa)).toMatchObject({ total: 300, equipe: [{ perfil_id: 'u-master', percentual: 100 }],
          registros: [{ id, segundos: 300, ajuste: false }] });
      });

      it('quando a pessoa ajusta o tempo, então precisa de motivo, e o ajuste fica registrado e entra no total', async () => {
        // Dado
        const tarefa = await novaTarefa();
        await SD.tempoIniciar(tarefa, new Date().toISOString(), 600);
        // Quando
        const semMotivo = SD.tempoAjustar(tarefa, -120, '  ');
        await SD.tempoAjustar(tarefa, -120, 'Contei a mais');
        // Então
        await expect(semMotivo).rejects.toThrow('Diga o motivo do ajuste');
        const tempo = await SD.tempoDaTarefa(tarefa);
        expect(tempo.total).toBe(480);
        expect(tempo.registros.find(r => r.ajuste)).toMatchObject({ segundos: -120, motivo: 'Contei a mais' });
      });

      it('quando a tarefa chega à coluna das concluídas, então ganha a data de conclusão; ao sair, perde', async () => {
        // Dado
        const tarefa = await novaTarefa();
        const colunas = await SD.colunasListar('tarefas');
        const fim = colunas.find(c => c.marco === 'concluido')!, inicio = colunas.find(c => c.marco === 'inicio')!;
        // Quando
        await SD.tarefaMover(tarefa, fim.id, 1);
        const concluida = (await SD.tarefaObter(tarefa))!.concluida_em;
        await SD.tarefaMover(tarefa, inicio.id, 1);
        // Então
        expect(concluida).toBeTruthy();
        expect((await SD.tarefaObter(tarefa))!.concluida_em).toBeNull();
      });

      it('quando a demanda tem tarefas com tempo, então o tempo dela é a soma', async () => {
        // Dado
        const { id: demanda } = await SD.demandaCriar({ titulo: 'Com tarefas', responsavel_id: 'u-master' });
        const a = await novaTarefa({ demanda_id: demanda }), b = await novaTarefa({ demanda_id: demanda });
        // Quando
        await SD.tempoIniciar(a, new Date().toISOString(), 600);
        await SD.tempoIniciar(b, new Date().toISOString(), 900);
        // Então
        expect(await SD.tempoDaDemanda(demanda)).toBe(1500);
      });
    });

    describe('Gráficos do painel do Início (#402)', () => {
      // Quem está logado é o Mauro (administrador): vê as tarefas e o tempo de todos.
      const HOJE = hojeISO(), ONTEM = hojeISO(new Date(Date.now() - DIA));
      const novaTarefa = async (extra: Parameters<Dados['tarefaCriar']>[0] = {}) =>
        (await SD.tarefaCriar({ titulo: 'Do painel ' + marca(), responsavel_id: 'u-master', ...extra })).id;
      const concluir = async (id: string) => {
        const fim = (await SD.colunasListar('tarefas')).find(c => c.marco === 'concluido')!;
        await SD.tarefaMover(id, fim.id, 1);
      };

      it('quando pede os de uma pessoa, então vêm só as tarefas em que ela é responsável ou participante; sem pessoa, as de todos', async () => {
        // Dado
        const minha = await novaTarefa(), comigo = await novaTarefa({ responsavel_id: 'u-bruno', participantes: ['u-master'] }), alheia = await novaTarefa({ responsavel_id: 'u-bruno' });
        // Quando
        const [meus, todos] = [await SD.tarefasGraficos({ desde: HOJE, pessoa: 'u-master' }), await SD.tarefasGraficos({ desde: HOJE, pessoa: null })];
        // Então
        const ids = meus.tarefas.map(t => t.id);
        expect(ids).toEqual(expect.arrayContaining([minha, comigo]));
        expect(ids).not.toContain(alheia);
        expect(todos.tarefas.map(t => t.id)).toContain(alheia);
      });

      it('quando a tarefa é arquivada, então só continua se foi concluída no período, com a data de conclusão', async () => {
        // Dado
        const aberta = await novaTarefa(), concluida = await novaTarefa();
        await concluir(concluida);
        await SD.tarefasArquivar([aberta, concluida]);
        // Quando
        const g = await SD.tarefasGraficos({ desde: ONTEM, pessoa: 'u-master' });
        // Então
        expect(g.tarefas.map(t => t.id)).not.toContain(aberta);
        expect(g.tarefas.find(t => t.id === concluida)).toMatchObject({ arquivado_em: expect.any(String), concluida_em: expect.any(String) });
      });

      it('quando há tempo registrado, então vem o da pessoa no período, sem o de antes dele nem o de outra pessoa', async () => {
        // Dado
        const tarefa = await novaTarefa();
        const agora = new Date().toISOString();
        await SD.tempoIniciar(tarefa, agora, 900);
        await SD.tempoIniciar(tarefa, '2000-01-03T13:00:00.000Z', 600);
        // Quando
        const [meu, doBruno] = [await SD.tarefasGraficos({ desde: ONTEM, pessoa: 'u-master' }), await SD.tarefasGraficos({ desde: ONTEM, pessoa: 'u-bruno' })];
        // Então
        expect(meu.tempos).toContainEqual({ inicio: agora, segundos: 900 });
        expect(meu.tempos.some(r => r.inicio.startsWith('2000-'))).toBe(false);
        expect(doBruno.tempos.some(r => r.inicio === agora)).toBe(false);
      });
    });

    describe('Listas das demandas e das tarefas', () => {
      const novaDemanda = async () => (await SD.demandaCriar({ titulo: 'Com listas', responsavel_id: 'u-master' })).id;

      it('quando uma lista é criada com itens, então ela vem no fim da demanda, com os itens na ordem, por fazer', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Primeira');
        // Quando
        await SD.listaCriar('demandas', demanda, '  Pessoa jurídica ', arvoreDosItens(['Atos constitutivos', 'Quadro de sócios']));
        // Então
        const listas = await SD.listasDoCartao('demandas', demanda);
        expect(listas.map(l => l.nome)).toEqual(['Primeira', 'Pessoa jurídica']);
        expect(listas[1].itens.map(i => [i.texto, i.feito_em])).toEqual([['Atos constitutivos', null], ['Quadro de sócios', null]]);
      });

      it('quando um item é marcado, então fica com a hora e quem marcou; desmarcado, perde os dois', async () => {
        // Dado
        const lista = await SD.listaCriar('demandas', await novaDemanda(), 'Documentos');
        const item = await SD.itemCriar(lista.id, 'Procuração');
        // Quando
        const marcado = await SD.itemAtualizar(item.id, { feito: true });
        const desmarcado = await SD.itemAtualizar(item.id, { feito: false });
        // Então
        expect(marcado.feito_em).not.toBeNull();
        expect(marcado.feito_por).toBe('u-master');
        expect(desmarcado).toMatchObject({ feito_em: null, feito_por: null });
      });

      it('quando o item ganha data de entrega e muda de posição, e a lista é renomeada, então voltam assim', async () => {
        // Dado
        const demanda = await novaDemanda();
        const lista = await SD.listaCriar('demandas', demanda, 'Documentos', arvoreDosItens(['A', 'B']));
        // Quando
        await SD.itemAtualizar(lista.itens[0].id, { prazo: '2030-11-10', ordem: 3 });
        await SD.listaAtualizar(lista.id, { nome: 'Documentos do cliente' });
        // Então
        const [lida] = await SD.listasDoCartao('demandas', demanda);
        expect(lida.nome).toBe('Documentos do cliente');
        expect(lida.itens.map(i => [i.texto, i.prazo])).toEqual([['B', null], ['A', '2030-11-10']]);
      });

      it('quando a lista é excluída, então os itens vão junto', async () => {
        // Dado
        const demanda = await novaDemanda();
        const lista = await SD.listaCriar('demandas', demanda, 'Para apagar', arvoreDosItens(['Item']));
        // Quando
        await SD.listaExcluir(lista.id);
        // Então
        expect(await SD.listasDoCartao('demandas', demanda)).toEqual([]);
      });

      it('quando uma lista é criada na tarefa, então ela vem só na tarefa, com os itens, e marca como na demanda', async () => {
        // Dado
        const { id: tarefa } = await SD.tarefaCriar({ titulo: 'Com listas', responsavel_id: 'u-master' });
        const demanda = await novaDemanda();
        // Quando
        const lista = await SD.listaCriar('tarefas', tarefa, ' Documentos ', arvoreDosItens(['Procuração', 'Contrato social']));
        const marcado = await SD.itemAtualizar(lista.itens[0].id, { feito: true });
        // Então
        const [lida] = await SD.listasDoCartao('tarefas', tarefa);
        expect(lida).toMatchObject({ nome: 'Documentos' });
        expect(lida.itens.map(i => i.texto)).toEqual(['Procuração', 'Contrato social']);
        expect(marcado.feito_por).toBe('u-master');
        expect(await SD.listasDoCartao('demandas', demanda)).toEqual([]);
      });

      it('quando a tarefa arquivada é excluída, então as listas dela vão junto', async () => {
        // Dado
        const { id: tarefa } = await SD.tarefaCriar({ titulo: 'Para excluir', responsavel_id: 'u-master' });
        await SD.listaCriar('tarefas', tarefa, 'Documentos', arvoreDosItens(['Procuração']));
        await SD.tarefasArquivar([tarefa]);
        // Quando
        await SD.tarefasExcluir([tarefa]);
        // Então
        expect(await SD.listasDoCartao('tarefas', tarefa)).toEqual([]);
      });
    });

    describe('Modelos de lista', () => {
      it('quando um modelo é criado, então ele vem na lista do escritório, por nome, com os itens limpos', async () => {
        // Dado
        const nome = 'Modelo ' + marca();
        // Quando
        const m = await SD.modeloCriar('  ' + nome + ' ', arvoreDosItens([' Procuração ', '', 'Contrato social']));
        // Então
        const lista = await SD.modelosListar();
        expect(lista.find(x => x.id === m.id)).toMatchObject({ nome, itens: ['Procuração', 'Contrato social'] });
        expect(lista.map(x => x.nome)).toEqual(lista.map(x => x.nome).toSorted((a, b) => a.localeCompare(b, 'pt-BR')));
      });

      it('quando já existe um modelo com o mesmo nome, então criar outro é recusado com a mensagem em português', async () => {
        // Dado
        const nome = 'Modelo ' + marca();
        await SD.modeloCriar(nome, arvoreDosItens(['A']));
        // Quando
        const repetido = SD.modeloCriar(nome.toLowerCase(), arvoreDosItens(['B']));
        // Então
        await expect(repetido).rejects.toThrow('Já existe um modelo de checklist com esse nome.');
      });

      it('quando o modelo é editado, então muda; e excluído, some da lista', async () => {
        // Dado
        const m = await SD.modeloCriar('Modelo ' + marca(), arvoreDosItens(['A']));
        // Quando
        await SD.modeloAtualizar(m.id, { arvore: arvoreDosItens(['A', 'B']) });
        const editado = (await SD.modelosListar()).find(x => x.id === m.id);
        await SD.modeloExcluir(m.id);
        // Então
        expect(editado?.itens).toEqual(['A', 'B']);
        expect((await SD.modelosListar()).some(x => x.id === m.id)).toBe(false);
      });

      it('quando um modelo é usado numa demanda e depois muda, então a lista da demanda continua como estava', async () => {
        // Dado
        const m = await SD.modeloCriar('Modelo ' + marca(), arvoreDosItens(['Procuração']));
        const { id: demanda } = await SD.demandaCriar({ titulo: 'Com modelo', responsavel_id: 'u-master' });
        await SD.listaCriar('demandas', demanda, m.nome, m.arvore);
        // Quando
        await SD.modeloAtualizar(m.id, { arvore: arvoreDosItens(['Outra coisa']) });
        // Então
        const [lista] = await SD.listasDoCartao('demandas', demanda);
        expect(lista.itens.map(i => i.texto)).toEqual(['Procuração']);
      });
    });

    describe('Checklists com grupos (#309)', () => {
      // O exemplo do dono: 1. Documentos pessoais › 1.1 RG, 1.2 CPF; 2. Benefício › 2.1 Aposentadoria por idade › 2.1.1 CNIS,
      // 2.1.2 Carteira de trabalho; 2.2 Auxílio-doença › 2.2.1 Laudo médico.
      const EXEMPLO = [
        { texto: 'Documentos pessoais', filhos: [{ texto: 'RG' }, { texto: 'CPF' }] },
        { texto: 'Benefício', filhos: [
          { texto: 'Aposentadoria por idade', filhos: [{ texto: 'CNIS' }, { texto: 'Carteira de trabalho' }] },
          { texto: 'Auxílio-doença', filhos: [{ texto: 'Laudo médico' }] }] }
      ];
      const FUNDO_DEMAIS = [{ texto: 'A', filhos: [{ texto: 'B', filhos: [{ texto: 'C', filhos: [{ texto: 'D' }] }] }] }];
      const novaDemanda = async () => (await SD.demandaCriar({ titulo: 'Com grupos', responsavel_id: 'u-master' })).id;
      const numerados = (lista: Parameters<typeof arvoreDaLista>[0]) =>
        emOrdemDeLeitura(arvoreDaLista(lista)).map(n => `${n.numero} ${n.tipo === 'grupo' ? n.grupo.nome : n.item.texto}`);
      const lerUma = async (demanda: string) => (await SD.listasDoCartao('demandas', demanda))[0];
      const grupoDe = (lista: Awaited<ReturnType<typeof lerUma>>, nome: string) => lista.grupos.find(g => g.nome === nome)!;

      it('quando um checklist é criado com a árvore, então os grupos e os itens voltam nos lugares, numerados 1., 1.1, 2.1.1', async () => {
        // Dado
        const demanda = await novaDemanda();
        // Quando
        const criada = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        // Então
        const lida = await lerUma(demanda);
        expect(numerados(criada)).toEqual(numerados(lida));
        expect(numerados(lida)).toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF', '2. Benefício', '2.1 Aposentadoria por idade', '2.1.1 CNIS',
          '2.1.2 Carteira de trabalho', '2.2 Auxílio-doença', '2.2.1 Laudo médico']);
        expect(grupoDe(lida, 'Aposentadoria por idade').pai_id).toBe(grupoDe(lida, 'Benefício').id);
        expect(lida.itens.map(i => i.texto)).toEqual(['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Laudo médico']);
      });

      it('quando um checklist é criado no contrato, então ele vem só no contrato', async () => {
        // Dado
        const { id } = await criar('CHECKLIST ' + marca());
        const contrato = (await SD.pessoaFecharContrato(id))!.id;
        const demanda = await novaDemanda();
        // Quando
        await SD.listaCriar('contratos', contrato, 'Documentos do contrato', EXEMPLO);
        await SD.listaCriar('demandas', demanda, 'Da demanda');
        // Então
        const doContrato = await SD.listasDoCartao('contratos', contrato);
        expect(doContrato.map(l => l.nome)).toEqual(['Documentos do contrato']);
        expect(doContrato[0].grupos).toHaveLength(4);
        expect((await SD.listasDoCartao('demandas', demanda)).map(l => l.nome)).toEqual(['Da demanda']);
      });

      it('quando um grupo vai para o próprio subgrupo, ou passaria de 3 níveis, então é recusado com a mensagem do banco, e nada muda', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        const lista = await lerUma(demanda);
        const [beneficio, aposentadoria, documentos] = ['Benefício', 'Aposentadoria por idade', 'Documentos pessoais'].map(n => grupoDe(lista, n));
        // Quando
        const ciclo = await SD.listaReordenar(lista.id, [{ id: beneficio.id, tipo: 'grupo', pai_id: aposentadoria.id, ordem: 20 }]).then(() => '', (e: Error) => e.message);
        const fundo = await SD.listaReordenar(lista.id, [{ id: documentos.id, tipo: 'grupo', pai_id: aposentadoria.id, ordem: 20 }]).then(() => '', (e: Error) => e.message);
        // Então
        expect(ciclo).toBe(GRUPO_DENTRO_DELE);
        expect(fundo).toBe(NIVEIS_DEMAIS);
        expect(numerados(await lerUma(demanda))).toEqual(numerados(lista));
      });

      it('quando o checklist novo teria um item no 4º nível, então é recusado e nenhum checklist fica', async () => {
        // Dado
        const demanda = await novaDemanda();
        // Quando
        const fundo = SD.listaCriar('demandas', demanda, 'Fundo', FUNDO_DEMAIS);
        // Então
        await expect(fundo).rejects.toThrow(NIVEIS_DEMAIS);
        expect(await SD.listasDoCartao('demandas', demanda)).toEqual([]);
      });

      it('quando vem uma posição de outro checklist, então é recusada e nada muda', async () => {
        // Dado
        const demanda = await novaDemanda();
        const uma = await SD.listaCriar('demandas', demanda, 'Uma', arvoreDosItens(['A']));
        const outra = await SD.listaCriar('demandas', demanda, 'Outra', arvoreDosItens(['B']));
        // Quando
        const errada = SD.listaReordenar(uma.id, [{ id: uma.itens[0].id, tipo: 'item', pai_id: null, ordem: 5 }, { id: outra.itens[0].id, tipo: 'item', pai_id: null, ordem: 6 }]);
        // Então
        await expect(errada).rejects.toThrow(CHECKLIST_MUDOU);
        expect((await lerUma(demanda)).itens[0].ordem).toBe(uma.itens[0].ordem);
      });

      it('quando um grupo é excluído, então os subgrupos e os itens de dentro vão junto, e o checklist fica', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        // Quando
        await SD.grupoDoChecklistExcluir(grupoDe(await lerUma(demanda), 'Benefício').id);
        // Então
        expect(numerados(await lerUma(demanda))).toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF']);
      });

      it('quando o grupo vai para dentro de outro, numa chamada, então leva o que está dentro', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        const lista = await lerUma(demanda);
        const [documentos, beneficio] = ['Documentos pessoais', 'Benefício'].map(n => grupoDe(lista, n));
        // Quando
        await SD.listaReordenar(lista.id, [{ id: documentos.id, tipo: 'grupo', pai_id: beneficio.id, ordem: 20 },
          ...lista.itens.filter(i => i.grupo_id === documentos.id).map((i, k) => ({ id: i.id, tipo: 'item' as const, pai_id: documentos.id, ordem: 21 + k }))]);
        // Então
        expect(numerados(await lerUma(demanda))).toEqual(['1. Benefício', '1.1 Aposentadoria por idade', '1.1.1 CNIS', '1.1.2 Carteira de trabalho',
          '1.2 Auxílio-doença', '1.2.1 Laudo médico', '1.3 Documentos pessoais', '1.3.1 RG', '1.3.2 CPF']);
      });

      it('quando um subgrupo e um item são criados onde a regra diz, então entram no fim do grupo; o subgrupo se renomeia', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        const lista = await lerUma(demanda), documentos = grupoDe(lista, 'Documentos pessoais');
        // Quando
        const { pai_id, ordem } = ondeEntraONovo(arvoreDaLista(lista), documentos.id);
        const sub = await SD.grupoDoChecklistCriar(lista.id, '  Comprovantes ', { pai_id, ordem });
        const onde = ondeEntraONovo(arvoreDaLista(await lerUma(demanda)), sub.id);
        await SD.itemCriar(lista.id, 'Conta de luz', { pai_id: onde.pai_id, ordem: onde.ordem });
        await SD.grupoDoChecklistAtualizar(sub.id, { nome: 'Comprovante de residência' });
        // Então
        expect(sub.nome).toBe('Comprovantes');
        expect(numerados(await lerUma(demanda)).slice(0, 5))
          .toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF', '1.3 Comprovante de residência', '1.3.1 Conta de luz']);
      });

      it('quando um item é criado sem lugar (como a versão anterior), então fica no fim, no primeiro nível, depois até de um grupo vazio', async () => {
        // Dado
        const demanda = await novaDemanda();
        const lista = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        const { pai_id, ordem } = ondeEntraONovo(arvoreDaLista(lista), null);
        await SD.grupoDoChecklistCriar(lista.id, 'Vazio', { pai_id, ordem });
        // Quando
        const novo = await SD.itemCriar(lista.id, 'Procuração');
        // Então
        expect(numerados(await lerUma(demanda)).slice(-2)).toEqual(['3. Vazio', '4. Procuração']);
        expect(novo.grupo_id).toBeNull();
      });

      it('quando a versão anterior renumera os itens de 1 a n, então grupos e itens continuam nos mesmos lugares', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
        const antes = await lerUma(demanda);
        // Quando
        for (const [k, i] of antes.itens.entries()) await SD.itemAtualizar(i.id, { ordem: k + 1 });
        // Então
        const depois = await lerUma(demanda);
        expect(depois.itens.map(i => i.ordem)).toEqual([1, 2, 3, 4, 5]);
        expect(numerados(depois)).toEqual(numerados(antes));
        expect(acharNo(arvoreDaLista(depois), depois.itens[2].id)?.numero).toBe('2.1.1');
      });

      describe('a lista colada, de uma vez (#375)', () => {
        const COLADA = [{ texto: '  Certidões ', filhos: [{ texto: 'Nascimento' }, { texto: 'Casamento' }] }, { texto: 'Foto' }];
        const acrescentar = (lista: Awaited<ReturnType<typeof lerUma>>, grupoId: string | null, nova: typeof COLADA) =>
          SD.listaAcrescentar(lista.id, grupoId, nova, ondeEntraAArvore(arvoreDaLista(lista), grupoId, nova));

        it('quando a lista colada entra no fim do checklist, então os grupos e os itens ficam nos lugares, numerados, e o grupo novo vem na resposta', async () => {
          // Dado
          const demanda = await novaDemanda();
          const lista = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
          // Quando
          const grupos = await acrescentar(lista, null, COLADA);
          // Então
          const depois = await lerUma(demanda);
          expect(grupos).toEqual([grupoDe(depois, 'Certidões').id]);
          expect(numerados(depois).slice(-4)).toEqual(['3. Certidões', '3.1 Nascimento', '3.2 Casamento', '4. Foto']);
        });

        it('dado um vão pequeno demais no grupo, quando a lista colada entra nele, então renumera e grava junto, na ordem', async () => {
          // Dado: o grupo 1. termina no CPF e o Benefício vem logo depois, quase na mesma posição
          const demanda = await novaDemanda();
          const criada = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
          const documentos = grupoDe(criada, 'Documentos pessoais'), cpf = criada.itens.find(i => i.texto === 'CPF')!;
          await SD.listaReordenar(criada.id, [{ id: cpf.id, tipo: 'item', pai_id: documentos.id, ordem: 4 - 1e-7 }]);
          const lista = await lerUma(demanda), onde = ondeEntraAArvore(arvoreDaLista(lista), documentos.id, [{ texto: 'Foto' }]);
          // Quando
          await SD.listaAcrescentar(lista.id, documentos.id, [{ texto: 'Foto' }], onde);
          // Então
          expect(onde.renumerar.length).toBeGreaterThan(0);
          expect(numerados(await lerUma(demanda)).slice(0, 5)).toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF', '1.3 Foto', '2. Benefício']);
        });

        it('quando a lista colada passaria de 3 níveis, então é recusada e nada é gravado; no grupo, o aviso diz para colar no fim', async () => {
          // Dado
          const demanda = await novaDemanda();
          const lista = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
          // Quando
          const noFim = await acrescentar(lista, null, FUNDO_DEMAIS).then(() => '', (e: Error) => e.message);
          const noGrupo = await acrescentar(lista, grupoDe(lista, 'Aposentadoria por idade').id, COLADA).then(() => '', (e: Error) => e.message);
          // Então
          expect(noFim).toBe(NIVEIS_DEMAIS);
          expect(noGrupo).toBe(`${NIVEIS_DEMAIS} ${NAO_CABE_NO_GRUPO}`);
          expect(numerados(await lerUma(demanda))).toEqual(numerados(lista));
        });

        it('quando a lista colada tem 5 níveis, com as posições de todos ou faltando uma, então a recusa é a dos níveis e nada é gravado', async () => {
          // Dado: A > B > C > D > E (o banco só desce até o 4º nível para conferir)
          const demanda = await novaDemanda();
          const lista = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
          const cinco = [{ texto: 'A', filhos: [{ texto: 'B', filhos: [{ texto: 'C', filhos: [{ texto: 'D', filhos: [{ texto: 'E' }] }] }] }] }];
          // Quando
          const completas = await SD.listaAcrescentar(lista.id, null, cinco, { ordens: [20, 21, 22, 23, 24], renumerar: [] }).then(() => '', (e: Error) => e.message);
          const faltando = await SD.listaAcrescentar(lista.id, null, cinco, { ordens: [20, 21], renumerar: [] }).then(() => '', (e: Error) => e.message);
          // Então
          expect([completas, faltando]).toEqual([NIVEIS_DEMAIS, NIVEIS_DEMAIS]);
          expect(numerados(await lerUma(demanda))).toEqual(numerados(lista));
        });

        it('quando um item do meio da lista colada não serve, então nada dela é gravado, nem o grupo de antes', async () => {
          // Dado: o Nascimento passa do tamanho de um item
          const demanda = await novaDemanda();
          const lista = await SD.listaCriar('demandas', demanda, 'Benefício', EXEMPLO);
          const quebrada = [{ texto: 'Certidões', filhos: [{ texto: 'x'.repeat(TAMANHO_ITEM + 1) }, { texto: 'Casamento' }] }, { texto: 'Foto' }];
          // Quando
          const recusa = await acrescentar(lista, null, quebrada).then(() => '', (e: Error) => e.message);
          // Então
          expect(recusa).toBe(`O item pode ter até ${TAMANHO_ITEM} caracteres.`);
          expect(numerados(await lerUma(demanda))).toEqual(numerados(lista));
        });

        it('quando o grupo de destino ou o que renumerar não é do checklist, então é recusado e nada muda', async () => {
          // Dado
          const demanda = await novaDemanda();
          const uma = await SD.listaCriar('demandas', demanda, 'Uma', EXEMPLO);
          const outra = await SD.listaCriar('demandas', demanda, 'Outra', EXEMPLO);
          const renumerar = [{ id: uma.itens[0].id, tipo: 'item' as const, pai_id: null, ordem: 50 }, { id: outra.itens[0].id, tipo: 'item' as const, pai_id: null, ordem: 51 }];
          // Quando
          const destinoErrado = await acrescentar(uma, grupoDe(outra, 'Benefício').id, COLADA).then(() => '', (e: Error) => e.message);
          const renumeracaoErrada = await SD.listaAcrescentar(uma.id, null, [{ texto: 'Foto' }], { ordens: [99], renumerar }).then(() => '', (e: Error) => e.message);
          // Então
          expect([destinoErrado, renumeracaoErrada]).toEqual([CHECKLIST_MUDOU, CHECKLIST_MUDOU]);
          const [lidaUma] = (await SD.listasDoCartao('demandas', demanda)).filter(l => l.id === uma.id);
          expect(numerados(lidaUma)).toEqual(numerados(uma));
        });
      });

      it('quando um modelo é gravado com a árvore, então os itens são as folhas; renomear mantém a árvore', async () => {
        // Dado
        const nome = 'Modelo ' + marca();
        // Quando
        const m = await SD.modeloCriar(nome, EXEMPLO);
        await SD.modeloAtualizar(m.id, { nome: nome + ' novo' });
        // Então
        const lido = (await SD.modelosListar()).find(x => x.id === m.id)!;
        expect(m.itens).toEqual(['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Laudo médico']);
        expect(lido).toMatchObject({ nome: nome + ' novo', arvore: EXEMPLO, itens: m.itens });
      });

      it('quando um modelo sem grupos é lido, então a árvore são os itens; com grupo no 3º nível, é recusado', async () => {
        // Dado
        const plano = await SD.modeloCriar('Modelo ' + marca(), arvoreDosItens(['A', 'B']));
        // Quando
        const fundo = await SD.modeloCriar('Modelo ' + marca(), FUNDO_DEMAIS).then(() => '', (e: Error) => e.message);
        // Então
        expect((await SD.modelosListar()).find(x => x.id === plano.id)?.arvore).toEqual([{ texto: 'A' }, { texto: 'B' }]);
        expect(fundo).toBe(NIVEIS_DEMAIS);
      });

      describe('no contrato, quem só foi mencionado', () => {
        const falso = () => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void; mudarFuncao(id: string, funcao: string): void } }).SEMPER_FALSO;
        const entrarComo = (id: string) => falso().entrarComo(id);
        afterEach(() => { entrarComo('u-master'); falso().mudarFuncao('u-bruno', 'estagiario'); });

        it('quando lê o checklist do contrato, então o vê; criar, acrescentar item, grupo ou lista colada e reordenar são recusados, e excluir não muda nada', async () => {
          // Dado: um contrato de outra pessoa, com um checklist, e um comentário que menciona o Bruno (advogado, sem ser administrador)
          falso().mudarFuncao('u-bruno', 'advogado');
          const { id: cliente } = await criar(marca());
          const contrato = (await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' })).id;
          const lista = await SD.listaCriar('contratos', contrato, 'Documentos do contrato', EXEMPLO);
          const documentos = grupoDe(lista, 'Documentos pessoais'), colada = [{ texto: 'Certidões', filhos: [{ texto: 'Nascimento' }] }];
          await SD.comentarioCriar('contratos', contrato, 'Veja o checklist, @bruno.souza');
          entrarComo('u-bruno');
          // Quando
          const lida = await SD.listasDoCartao('contratos', contrato);
          const tentativas = await Promise.allSettled([
            SD.listaCriar('contratos', contrato, 'Outro'),
            SD.itemCriar(lista.id, 'Procuração', ondeEntraONovo(arvoreDaLista(lista), documentos.id)),
            SD.grupoDoChecklistCriar(lista.id, 'Certidões', { pai_id: null, ordem: 99 }),
            SD.listaReordenar(lista.id, [{ id: documentos.id, tipo: 'grupo', pai_id: null, ordem: 99 }]),
            SD.listaAcrescentar(lista.id, documentos.id, colada, ondeEntraAArvore(arvoreDaLista(lista), documentos.id, colada))
          ]);
          await SD.grupoDoChecklistExcluir(documentos.id);
          await SD.itemExcluir(lista.itens[0].id);
          // Então
          expect(numerados(lida[0])).toEqual(numerados(lista));
          expect(tentativas.map(t => t.status === 'rejected' && (t.reason as Error).message)).toEqual([
            'Você não tem permissão para fazer isso.', 'Você não tem permissão para fazer isso.', 'Você não tem permissão para fazer isso.',
            'Você não pode alterar este checklist.', 'Você não pode alterar este checklist.']);
          entrarComo('u-master');
          const depois = await SD.listasDoCartao('contratos', contrato);
          expect(depois.map(l => l.nome)).toEqual(['Documentos do contrato']);
          expect(numerados(depois[0])).toEqual(numerados(lista));
        });
      });

      it('quando o modelo agrupado é usado, então o checklist entra agrupado e numerado', async () => {
        // Dado
        const m = await SD.modeloCriar('Modelo ' + marca(), EXEMPLO);
        const demanda = await novaDemanda();
        // Quando
        await SD.listaCriar('demandas', demanda, m.nome, m.arvore);
        // Então
        expect(numerados(await lerUma(demanda)).slice(0, 3)).toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF']);
      });
    });

    describe('Etiquetas', () => {
      const texto = () => 'E' + Math.random().toString(36).slice(2, 10);

      it('quando uma etiqueta é criada, então vem na lista do escritório; só de cor, com texto nulo', async () => {
        // Dado
        const t = texto();
        // Quando
        const com = await SD.etiquetaCriar('vermelho', t);
        const so = await SD.etiquetaCriar('azul', null);
        // Então
        const lista = await SD.etiquetasListar();
        expect(lista.find(e => e.id === com.id)).toMatchObject({ cor: 'vermelho', texto: t });
        expect(lista.find(e => e.id === so.id)).toMatchObject({ cor: 'azul', texto: null });
      });

      it('quando o texto ou a etiqueta só de cor repetem, então é recusado com a mensagem em português', async () => {
        // Dado
        const t = texto();
        await SD.etiquetaCriar('vermelho', t);
        await SD.etiquetaCriar('verde', null);
        // Então
        await expect(SD.etiquetaCriar('azul', t.toUpperCase())).rejects.toThrow('Já existe uma etiqueta com esse texto.');
        await expect(SD.etiquetaCriar('verde', null)).rejects.toThrow('Já existe uma etiqueta só de cor nessa cor.');
      });

      it('quando a cor não é da paleta ou o texto é vazio, então é recusado', async () => {
        // Então
        await expect(SD.etiquetaCriar('turquesa' as 'azul', texto())).rejects.toThrow('formato inválido');
        await expect(SD.etiquetaCriar('azul', '  ')).rejects.toThrow('formato inválido');
      });

      it('quando a etiqueta é aplicada, então o item da lista a traz em todos os módulos, e aplicar de novo não repete', async () => {
        // Dado
        const e = await SD.etiquetaCriar('roxo', texto());
        const pessoa = await criar(marca());
        const { id: demanda } = await SD.demandaCriar({ titulo: 'Com etiqueta', responsavel_id: 'u-master' });
        const { id: tarefa } = await SD.tarefaCriar({ titulo: 'Com etiqueta', responsavel_id: 'u-master' });
        // Quando
        await SD.etiquetaAplicar('pessoas', pessoa.id, e.id);
        await SD.etiquetaAplicar('pessoas', pessoa.id, e.id);
        await SD.etiquetaAplicar('demandas', demanda, e.id);
        await SD.etiquetaAplicar('tarefas', tarefa, e.id);
        // Então
        expect(await SD.etiquetasDoCartao('pessoas', pessoa.id)).toEqual([e.id]);
        expect((await SD.pessoasListar({ etiqueta: e.id })).linhas.map(p => p.etq)).toEqual([[{ etiqueta_id: e.id }]]);
        expect((await SD.demandasListar({ etiqueta: e.id })).linhas.map(d => d.id)).toEqual([demanda]);
        expect((await SD.tarefasListar({ etiqueta: e.id })).linhas.map(t => t.id)).toEqual([tarefa]);
      });

      it('quando a lista filtra por uma etiqueta, então só vêm os cartões com ela, inclusive no quadro, e cada um traz todas as suas', async () => {
        // Dado
        const a = await SD.etiquetaCriar('vermelho', texto()), b = await SD.etiquetaCriar('azul', texto());
        const com = await criar(marca()), sem = await criar(marca());
        await SD.etiquetaAplicar('pessoas', com.id, a.id);
        await SD.etiquetaAplicar('pessoas', com.id, b.id);
        // Quando
        const { linhas, total } = await SD.pessoasListar({ etiqueta: a.id });
        const noQuadro = await SD.pessoasDaEtapa(null, { etiqueta: a.id });
        // Então
        expect(total).toBe(1);
        expect(linhas[0].id).toBe(com.id);
        expect(linhas[0].etq?.map(x => x.etiqueta_id).sort()).toEqual([a.id, b.id].sort());
        expect(noQuadro.linhas.map(p => p.id)).toEqual([com.id]);
        expect(noQuadro.linhas.some(p => p.id === sem.id)).toBe(false);
      });

      it('quando a exportação filtra por uma etiqueta, então só vêm as pessoas com ela', async () => {
        // Dado
        const e = await SD.etiquetaCriar('vermelho', texto());
        const com = await criar(marca());
        await criar(marca());
        await SD.etiquetaAplicar('pessoas', com.id, e.id);
        // Quando
        const pessoas = await SD.pessoasExportar({ etiqueta: e.id });
        // Então
        expect(pessoas.map(p => p.id)).toEqual([com.id]);
      });

      it('quando a etiqueta é tirada, então sai só daquele cartão; excluída, sai de todos', async () => {
        // Dado
        const e = await SD.etiquetaCriar('rosa', texto());
        const um = await criar(marca()), outro = await criar(marca());
        await SD.etiquetaAplicar('pessoas', um.id, e.id);
        await SD.etiquetaAplicar('pessoas', outro.id, e.id);
        // Quando
        await SD.etiquetaTirar('pessoas', um.id, e.id);
        // Então
        expect(await SD.etiquetasDoCartao('pessoas', um.id)).toEqual([]);
        expect(await SD.etiquetasDoCartao('pessoas', outro.id)).toEqual([e.id]);
        // Quando
        await SD.etiquetaExcluir(e.id);
        // Então
        expect(await SD.etiquetasDoCartao('pessoas', outro.id)).toEqual([]);
        expect((await SD.etiquetasListar()).some(x => x.id === e.id)).toBe(false);
        await expect(SD.etiquetaExcluir(e.id)).resolves.toBeUndefined();
      });

      it('quando a etiqueta é aplicada ou tirada em lote, então vale para todos os selecionados, e só para eles', async () => {
        // Dado
        const e = await SD.etiquetaCriar('verde', texto());
        const a = await criar(marca()), b = await criar(marca()), fora = await criar(marca());
        await SD.etiquetaAplicar('pessoas', a.id, e.id);
        // Quando
        await SD.etiquetaAplicarEmLote('pessoas', [a.id, b.id], e.id);
        // Então
        expect(await SD.etiquetasDoCartao('pessoas', a.id)).toEqual([e.id]);
        expect(await SD.etiquetasDoCartao('pessoas', b.id)).toEqual([e.id]);
        expect(await SD.etiquetasDoCartao('pessoas', fora.id)).toEqual([]);
        // Quando
        await SD.etiquetaTirarEmLote('pessoas', [a.id, b.id], e.id);
        // Então
        expect(await SD.etiquetasDoCartao('pessoas', a.id)).toEqual([]);
        expect(await SD.etiquetasDoCartao('pessoas', b.id)).toEqual([]);
      });

      describe('Importada e Incompleta', () => {
        const importar = async (nome: string, pendencias: ItemImportacao['pendencias'] = []) => {
          const imp = await SD.importacaoIniciar('Teste', 'x.csv');
          const { ids } = await SD.pessoasImportar(imp, [{ linha: 2, referencia: null, existente_id: null, dados: { tipo: 'pf', nome }, criado_em: null, responsaveis: [], observacoes: null, pendencias }]);
          return ids[0].id;
        };
        const sistema = async (tipo: 'importada' | 'incompleta') => (await SD.etiquetasListar()).find(e => e.sistema === tipo)!;

        it('quando a pessoa é importada, então recebe "Importada"; com pendência, também "Incompleta"', async () => {
          // Quando
          const sem = await importar(marca()), com = await importar(marca(), ['conferir']);
          // Então
          const importada = await sistema('importada'), incompleta = await sistema('incompleta');
          expect(importada).toMatchObject({ texto: 'Importada', cor: 'azul' });
          expect(incompleta).toMatchObject({ texto: 'Incompleta', cor: 'laranja' });
          expect(await SD.etiquetasDoCartao('pessoas', sem)).toEqual([importada.id]);
          expect((await SD.etiquetasDoCartao('pessoas', com)).sort()).toEqual([importada.id, incompleta.id].sort());
        });

        it('quando tira "Importada", então só a etiqueta sai: a origem da importação continua', async () => {
          // Dado
          const id = await importar(marca());
          // Quando
          await SD.etiquetaTirar('pessoas', id, (await sistema('importada')).id);
          // Então
          expect(await SD.etiquetasDoCartao('pessoas', id)).toEqual([]);
          expect((await SD.pessoaObter(id))?.importacao_id).toBeTruthy();
        });

        it('quando tira "Incompleta", no cartão ou em lote, então as pendências são zeradas', async () => {
          // Dado
          const a = await importar(marca(), ['conferir']), b = await importar(marca(), ['documento_invalido']);
          const incompleta = await sistema('incompleta');
          // Quando
          await SD.etiquetaTirar('pessoas', a, incompleta.id);
          await SD.etiquetaTirarEmLote('pessoas', [b], incompleta.id);
          // Então
          expect((await SD.pessoaObter(a))?.pendencias).toEqual([]);
          expect((await SD.pessoaObter(b))?.pendencias).toEqual([]);
        });

        it('quando marca como conferido, então "Incompleta" sai; pendência nova, ela volta', async () => {
          // Dado
          const id = await importar(marca(), ['conferir']);
          const incompleta = await sistema('incompleta');
          // Quando
          await SD.pessoaAtualizar(id, { pendencias: [] });
          // Então
          expect(await SD.etiquetasDoCartao('pessoas', id)).not.toContain(incompleta.id);
          // Quando
          await SD.pessoaAtualizar(id, { pendencias: ['conferir'] });
          // Então
          expect(await SD.etiquetasDoCartao('pessoas', id)).toContain(incompleta.id);
        });

        it('quando aplica "Incompleta" à mão, então o cadastro fica a conferir', async () => {
          // Dado
          await importar(marca(), ['conferir']);
          const p = await criar(marca());
          // Quando
          await SD.etiquetaAplicar('pessoas', p.id, (await sistema('incompleta')).id);
          // Então
          expect((await SD.pessoaObter(p.id))?.pendencias).toEqual(['conferir']);
        });

        it('quando aplica "Incompleta" numa demanda, então é só uma etiqueta', async () => {
          // Dado
          await importar(marca(), ['conferir']);
          const { id } = await SD.demandaCriar({ titulo: 'Com etiqueta', responsavel_id: 'u-master' });
          // Quando
          await SD.etiquetaAplicar('demandas', id, (await sistema('incompleta')).id);
          await SD.etiquetaTirar('demandas', id, (await sistema('incompleta')).id);
          // Então
          expect(await SD.etiquetasDoCartao('demandas', id)).toEqual([]);
        });

        it('quando alguém tenta excluir uma etiqueta do sistema, então ela continua', async () => {
          // Dado
          await importar(marca());
          const importada = await sistema('importada');
          // Quando
          await SD.etiquetaExcluir(importada.id);
          // Então
          expect((await SD.etiquetasListar()).some(e => e.id === importada.id)).toBe(true);
        });

        it('quando o escritório já tem uma etiqueta com o mesmo texto, então ela é aproveitada', async () => {
          // Dado
          const minha = await SD.etiquetaCriar('verde', 'importada');
          // Quando
          const id = await importar(marca());
          // Então
          expect(await SD.etiquetasDoCartao('pessoas', id)).toEqual([minha.id]);
          expect((await SD.etiquetasListar()).filter(e => normal(e.texto) === 'importada')).toHaveLength(1);
        });
      });

      it('quando a etiqueta é mudada, então vale para todos os cartões; o texto repetido é recusado', async () => {
        // Dado
        const t = texto();
        await SD.etiquetaCriar('verde', t);
        const e = await SD.etiquetaCriar('cinza', texto());
        const novo = texto();
        // Quando
        await SD.etiquetaAtualizar(e.id, { cor: 'laranja', texto: novo });
        // Então
        expect((await SD.etiquetasListar()).find(x => x.id === e.id)).toMatchObject({ cor: 'laranja', texto: novo });
        await expect(SD.etiquetaAtualizar(e.id, { cor: 'laranja', texto: t })).rejects.toThrow('Já existe uma etiqueta com esse texto.');
      });
    });

    describe('Grupos de colunas', () => {
      it('quando um grupo é criado, então vem na lista do quadro, na ordem, e começa aberto; os outros quadros não o veem', async () => {
        // Dado
        const nome = marca();
        // Quando
        const g = await SD.grupoCriar('pessoas', ` ${nome} `, 50);
        // Então
        expect(g).toMatchObject({ nome, ordem: 50, comeca_fechado: false });
        expect((await SD.gruposListar('pessoas')).some(x => x.id === g.id)).toBe(true);
        expect((await SD.gruposListar('contratos')).some(x => x.id === g.id)).toBe(false);
      });

      it('quando já existe um grupo com o mesmo nome no quadro, então criar ou renomear é recusado; em outro quadro, pode', async () => {
        // Dado
        const nome = marca();
        const g = await SD.grupoCriar('pessoas', nome, 1);
        const outro = await SD.grupoCriar('pessoas', marca(), 2);
        // Então
        await expect(SD.grupoCriar('pessoas', nome.toLowerCase(), 3)).rejects.toThrow('Já existe um grupo com esse nome neste quadro.');
        await expect(SD.grupoAtualizar(outro.id, { nome })).rejects.toThrow('Já existe um grupo com esse nome neste quadro.');
        await expect(SD.grupoCriar('contratos', nome, 1)).resolves.toMatchObject({ nome });
        await expect(SD.grupoAtualizar(g.id, { nome })).resolves.toBeUndefined();
      });

      it('quando uma coluna é criada num grupo ou movida para outro, então fica nele; em grupo de outro quadro, não', async () => {
        // Dado
        const a = await SD.grupoCriar('pessoas', marca(), 1), b = await SD.grupoCriar('pessoas', marca(), 2), alheio = await SD.grupoCriar('contratos', marca(), 1);
        // Quando
        const c = await SD.colunaCriar('pessoas', marca(), 90, a.id);
        await SD.colunaAgrupar(c.id, b.id, 91);
        // Então
        expect(c.grupo_id).toBe(a.id);
        expect((await SD.colunasListar('pessoas')).find(x => x.id === c.id)).toMatchObject({ grupo_id: b.id, ordem: 91 });
        await expect(SD.colunaAgrupar(c.id, alheio.id, 92)).rejects.toThrow('Não foi possível concluir agora. Tente de novo.');
        await expect(SD.colunaCriar('pessoas', marca(), 93, alheio.id)).rejects.toThrow('Não foi possível concluir agora. Tente de novo.');
      });

      it('quando o grupo é excluído, então as colunas dele continuam, sem grupo; excluir de novo não dá erro', async () => {
        // Dado
        const g = await SD.grupoCriar('pessoas', marca(), 1);
        const c = await SD.colunaCriar('pessoas', marca(), 90, g.id);
        // Quando
        await SD.grupoExcluir(g.id);
        // Então
        expect((await SD.gruposListar('pessoas')).some(x => x.id === g.id)).toBe(false);
        expect((await SD.colunasListar('pessoas')).find(x => x.id === c.id)?.grupo_id).toBeNull();
        await expect(SD.grupoExcluir(g.id)).resolves.toBeUndefined();
      });

      it('quando o grupo muda para começar fechado, então a mudança fica gravada', async () => {
        // Dado
        const g = await SD.grupoCriar('pessoas', marca(), 1);
        // Quando
        await SD.grupoAtualizar(g.id, { comeca_fechado: true, ordem: 7 });
        // Então
        expect((await SD.gruposListar('pessoas')).find(x => x.id === g.id)).toMatchObject({ comeca_fechado: true, ordem: 7 });
      });
    });

    describe('Calendário de feriados e suspensões', () => {
      const novoOrgao = (sigla: string) => SD.orgaoCriar({ sigla, nome: null, contagem_padrao: 'corridos', recesso: true, praxe: false, justica_federal: false });
      const sigla = () => 'T' + Math.random().toString(36).slice(2, 8).toUpperCase();

      it('quando um órgão é criado, então vem na lista por sigla, em maiúsculas e sem nome vazio', async () => {
        // Dado
        const s = sigla();
        // Quando
        const o = await SD.orgaoCriar({ sigla: ` ${s.toLowerCase()} `, nome: '  ', contagem_padrao: 'uteis', recesso: true, praxe: true, justica_federal: false });
        // Então
        expect(o).toMatchObject({ sigla: s, nome: null, contagem_padrao: 'uteis', recesso: true, praxe: true, justica_federal: false });
        const lista = await SD.orgaosListar();
        expect(lista.find(x => x.id === o.id)?.sigla).toBe(s);
        expect(lista.map(x => x.sigla)).toEqual(lista.map(x => x.sigla).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      });

      it('quando já existe um órgão com a mesma sigla, então criar outro é recusado com a mensagem em português', async () => {
        // Dado
        const s = sigla();
        await novoOrgao(s);
        // Quando
        const repetido = novoOrgao(s.toLowerCase());
        // Então
        await expect(repetido).rejects.toThrow('Já existe um órgão com essa sigla.');
      });

      it('quando o órgão muda o que segue, então a mudança fica gravada', async () => {
        // Dado
        const o = await novoOrgao(sigla());
        // Quando
        await SD.orgaoAtualizar(o.id, { praxe: true, contagem_padrao: 'uteis', nome: 'Tribunal de exemplo' });
        // Então
        expect((await SD.orgaosListar()).find(x => x.id === o.id)).toMatchObject({ praxe: true, contagem_padrao: 'uteis', nome: 'Tribunal de exemplo' });
      });

      it('quando os dias são lançados, então vêm por data no período pedido; lançar de novo o mesmo dia e órgão substitui', async () => {
        // Dado
        const o = await novoOrgao(sigla());
        // Quando
        const gravados = await SD.diasLancar([
          { data: '2031-07-04', motivo: 'Feriado municipal', tipo: 'feriado', orgao_id: o.id },
          { data: '2031-07-03', motivo: 'Portaria', tipo: 'suspensao', orgao_id: null }
        ]);
        await SD.diasLancar([{ data: '2031-07-04', motivo: 'Aniversário da cidade', tipo: 'suspensao', orgao_id: o.id }]);
        // Então
        expect(gravados).toBe(2);
        const dias = await SD.diasListar('2031-07-01', '2031-07-31');
        expect(dias.map(({ data, motivo, tipo, orgao_id }) => ({ data, motivo, tipo, orgao_id }))).toEqual([
          { data: '2031-07-03', motivo: 'Portaria', tipo: 'suspensao', orgao_id: null },
          { data: '2031-07-04', motivo: 'Aniversário da cidade', tipo: 'suspensao', orgao_id: o.id }
        ]);
        expect(await SD.diasListar('2031-08-01', '2031-08-31')).toEqual([]);
      });

      it('quando os dias de um período são excluídos, então somem; e excluir o órgão leva os dias só dele', async () => {
        // Dado
        const o = await novoOrgao(sigla());
        await SD.diasLancar([
          { data: '2032-03-01', motivo: 'Portaria', tipo: 'suspensao', orgao_id: o.id },
          { data: '2032-03-02', motivo: 'Portaria', tipo: 'suspensao', orgao_id: o.id },
          { data: '2032-03-03', motivo: 'Para todos', tipo: 'feriado', orgao_id: null }
        ]);
        const [primeiro] = await SD.diasListar('2032-03-01', '2032-03-01');
        // Quando
        await SD.diasExcluir([primeiro.id]);
        await SD.orgaoExcluir(o.id);
        // Então
        expect((await SD.diasListar('2032-03-01', '2032-03-31')).map(d => d.motivo)).toEqual(['Para todos']);
        expect((await SD.orgaosListar()).some(x => x.id === o.id)).toBe(false);
      });

      it('quando o dia lançado tem tipo desconhecido, motivo vazio ou ano fora do calendário, então é recusado', async () => {
        // Então
        await expect(SD.diasLancar([{ data: '2031-07-04', motivo: 'X', tipo: 'ponto' as 'feriado', orgao_id: null }])).rejects.toThrow('formato inválido');
        await expect(SD.diasLancar([{ data: '2031-07-04', motivo: ' ', tipo: 'feriado', orgao_id: null }])).rejects.toThrow('formato inválido');
        await expect(SD.diasLancar([{ data: '1999-07-04', motivo: 'X', tipo: 'feriado', orgao_id: null }])).rejects.toThrow('formato inválido');
      });

      it('quando há mais de mil dias lançados no período, então todos vêm, sem cortar o fim', async () => {
        // Dado: 366 dias para 3 órgãos (mais do que o Supabase devolve numa consulta só)
        const orgaos = await Promise.all([novoOrgao(sigla()), novoOrgao(sigla()), novoOrgao(sigla())]);
        const datas = Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2040, 0, 1 + i)).toISOString().slice(0, 10));
        await SD.diasLancar(orgaos.flatMap(o => datas.map(data => ({ data, motivo: 'Portaria longa', tipo: 'suspensao' as const, orgao_id: o.id }))));
        // Quando
        const dias = await SD.diasListar('2040-01-01', '2040-12-31');
        // Então
        expect(dias).toHaveLength(1098);
        expect(dias.at(-1)?.data).toBe('2040-12-31');
      });

      it('quando outro administrador já excluiu os dias ou o órgão, então excluir de novo não dá erro', async () => {
        // Dado
        const o = await novoOrgao(sigla());
        await SD.diasLancar([{ data: '2033-03-01', motivo: 'Portaria', tipo: 'suspensao', orgao_id: o.id }]);
        const [dia] = await SD.diasListar('2033-03-01', '2033-03-01');
        await SD.diasExcluir([dia.id]);
        await SD.orgaoExcluir(o.id);
        // Então
        await expect(SD.diasExcluir([dia.id])).resolves.toBeUndefined();
        await expect(SD.orgaoExcluir(o.id)).resolves.toBeUndefined();
        await expect(SD.orgaoAtualizar(o.id, { praxe: true })).resolves.toBeUndefined();
      });
    });

    describe('Dados do escritório', () => {
      it('quando o CNPJ do escritório tem letras, então é guardado em maiúsculas, sem a pontuação, e volta assim', async () => {
        // Dado
        const atual = (await SD.contexto(true))!.escritorio!;
        // Quando
        await SD.escritorioSalvar({ ...atual, nome: atual.nome, cnpj: '12.abc.345/01de-35' });
        // Então
        expect((await SD.contexto(true))?.escritorio?.cnpj).toBe('12ABC34501DE35');
      });
    });

    describe('Perfil profissional', () => {
      it('quando ninguém preencheu o perfil, então ele vem vazio e fora do site', async () => {
        // Quando
        const perfil = await SD.perfilProfissional('u-bruno');
        // Então
        expect(perfil).toMatchObject({ perfil_id: 'u-bruno', cargo: '', oab: [], no_site: false, atualizado_em: null });
      });

      it('quando o perfil é salvo e salvo de novo, então volta como foi gravado por último, limpo', async () => {
        // Dado
        const campos = camposDoPerfil(perfilVazio('u-ana'));
        await SD.perfilProfissionalSalvar('u-ana', { ...campos, cargo: 'Advogada' });
        // Quando
        await SD.perfilProfissionalSalvar('u-ana', { ...campos, cargo: ' Sócia ', oab: [{ numero: '123.456', uf: 'mg' }], areas: ['Marcas'], no_site: true, ordem_no_site: 2 });
        // Então
        const lido = await SD.perfilProfissional('u-ana');
        expect(lido).toMatchObject({ cargo: 'Sócia', oab: [{ numero: '123.456', uf: 'MG' }], areas: ['Marcas'], no_site: true, ordem_no_site: 2 });
        expect(lido.atualizado_em).not.toBeNull();
      });

      it('quando um link do perfil não começa com http, então salvar é recusado', async () => {
        // Quando
        const salvar = SD.perfilProfissionalSalvar('u-ana', { ...camposDoPerfil(perfilVazio('u-ana')), linkedin: 'javascript:alert(1)' });
        // Então
        await expect(salvar).rejects.toThrow('Cole o link completo, começando com https://.');
      });
    });

    describe('Foto do perfil', () => {
      const avif = (texto: string) => new Blob([texto], { type: 'image/avif' });

      it('quando alguém ainda não tem foto, então não há foto e a bolinha fica sem ela', async () => {
        // Quando
        const foto = await SD.fotoDoPerfil('u-bruno');
        // Então
        expect(foto).toBeNull();
        expect((await SD.contexto(true))?.equipe.find(m => m.id === 'u-bruno')?.foto ?? null).toBeNull();
      });

      it('quando a foto é salva, então vêm os dois arquivos, e a bolinha da pessoa passa a ter a pequena', async () => {
        // Quando
        await SD.fotoSalvar('u-ana', avif('grande'), avif('pequena'));
        // Então
        const foto = await SD.fotoDoPerfil('u-ana');
        expect(foto?.grande).toBeTruthy();
        expect(foto?.pequena).toBeTruthy();
        expect(foto?.em).toBeTruthy();
        expect((await SD.contexto(true))?.equipe.find(m => m.id === 'u-ana')?.foto).toBe(foto?.pequena);
      });

      it('quando a foto é tirada, então os arquivos somem e a bolinha volta às iniciais', async () => {
        // Dado
        await SD.fotoSalvar('u-ana', avif('grande'), avif('pequena'));
        // Quando
        await SD.fotoRemover('u-ana');
        // Então
        expect(await SD.fotoDoPerfil('u-ana')).toBeNull();
        expect((await SD.contexto(true))?.equipe.find(m => m.id === 'u-ana')?.foto ?? null).toBeNull();
      });
    });

    describe('Ligação com a conta Google', () => {
      it('quando nenhuma conta foi ligada, então não há ligação, e desligar não dá erro', async () => {
        // Quando
        await SD.ligacaoGoogleDesligar();
        // Então
        expect(await SD.ligacaoGoogle()).toBeNull();
      });

      it('quando a ligação começa, então ainda não há conta ligada: o endereço leva um estado de 64 letras e números', async () => {
        // Quando
        const endereco = await SD.ligacaoGoogleIniciar('http://localhost:8091/configuracoes/');
        // Então
        expect(endereco).toMatch(/estado=[0-9a-f]{64}(&|$)/);
        expect(await SD.ligacaoGoogle()).toBeNull();
      });

      it('quando a conclusão traz um estado que não existe, então nada é ligado e o resultado é "expirado"', async () => {
        // Quando
        const resultado = await SD.ligacaoGoogleConcluir('f'.repeat(64), 'qualquer');
        // Então
        expect(resultado).toBe('expirado');
        expect(await SD.ligacaoGoogle()).toBeNull();
      });
    });

    describe('Sincronização dos contatos com o Google', () => {
      // No banco de verdade, a volta do Google traz o código; aqui, o pedido criado por "iniciar" é concluído direto.
      async function ligarConta() {
        const [, estado] = /estado=([0-9a-f]{64})/.exec(await SD.ligacaoGoogleIniciar('http://localhost:8091/configuracoes/'))!;
        expect(await SD.ligacaoGoogleConcluir(estado, 'codigo')).toBe('ligado');
      }

      it('quando não há conta ligada, então não há sincronização, e ligá-la é recusado', async () => {
        // Quando / Então
        expect(await SD.sincronizacaoGoogle()).toBeNull();
        await expect(SD.sincronizacaoGoogleLigar(true)).rejects.toThrow('Ligue a conta Google do escritório antes de sincronizar os contatos');
        expect(await SD.sincronizarGoogleAgora()).toEqual({ resultado: 'desligada', sincronizados: 0, falhas: 0 });
      });

      it('dada a conta ligada, então a sincronização começa desligada, e quem é cadastrado não entra na fila', async () => {
        // Dado
        await ligarConta();
        // Quando
        await criar('SEM SINCRONIZAR ' + marca());
        // Então
        expect(await SD.sincronizacaoGoogle()).toMatchObject({ ativa: false, pendentes: 0, com_falha: 0, problema: null });
      });

      it('dada a sincronização ligada, quando uma pessoa é cadastrada e editada, então ela fica uma vez só na fila; arquivada não entra', async () => {
        // Dado
        await ligarConta();
        await SD.sincronizacaoGoogleLigar(true);
        // Quando
        const { id } = await criar('VAI AO GOOGLE ' + marca(), { telefones: ['38999990000'] });
        await SD.pessoaAtualizar(id, { tipo: 'pf', nome: 'VAI AO GOOGLE EDITADA ' + marca(), telefones: ['38999990001'] });
        const arquivada = await criar('ARQUIVADA ' + marca());
        await SD.pessoasArquivar([arquivada.id]);
        await SD.pessoaAtualizar(arquivada.id, { tipo: 'pf', nome: 'ARQUIVADA EDITADA ' + marca() });
        // Então
        expect(await SD.sincronizacaoGoogle()).toMatchObject({ ativa: true, pendentes: 2 });
        await SD.pessoasArquivar([arquivada.id], false);
        expect((await SD.sincronizacaoGoogle())?.pendentes).toBe(2);
      });

      it('dada a sincronização ligada, então a primeira sincronização fica por fazer; o primeiro "Sincronizar agora" a faz e leva ao Google quem ficou sem contato', async () => {
        // Dado
        await ligarConta();
        await SD.sincronizacaoGoogleLigar(true);
        const { id } = await criar('PRIMEIRA ' + marca());
        expect(await SD.sincronizacaoGoogle()).toMatchObject({ primeira_em: null, para_conferir: 0, pendentes: 1 });
        // Quando
        const resultado = await SD.sincronizarGoogleAgora();
        // Então
        expect(resultado.primeira?.novos).toBe(resultado.sincronizados);
        expect(resultado.sincronizados).toBeGreaterThanOrEqual(1);
        expect(await SD.sincronizacaoGoogle()).toMatchObject({ ativa: true, pendentes: 0 });
        expect((await SD.sincronizacaoGoogle())?.primeira_em).toBeTruthy();
        await SD.pessoaAtualizar(id, { tipo: 'pf', nome: 'PRIMEIRA EDITADA ' + marca() });
        expect((await SD.sincronizacaoGoogle())?.pendentes).toBe(1);
      });

      it('dada a primeira sincronização feita, quando o administrador pede "Sincronizar agora", então a fila esvazia e a hora da sincronização aparece', async () => {
        // Dado
        await ligarConta();
        await SD.sincronizacaoGoogleLigar(true);
        await SD.sincronizarGoogleAgora();
        await criar('AGORA ' + marca());
        // Quando
        const resultado = await SD.sincronizarGoogleAgora();
        // Então
        expect(resultado).toEqual({ resultado: 'ok', sincronizados: 1, falhas: 0 });
        expect(await SD.sincronizacaoGoogle()).toMatchObject({ ativa: true, pendentes: 0 });
        expect((await SD.sincronizacaoGoogle())?.sincronizado_em).toBeTruthy();
      });

      it('quando a sincronização é desligada e ligada de novo, então a primeira sincronização é refeita', async () => {
        // Dado
        await ligarConta();
        await SD.sincronizacaoGoogleLigar(true);
        await SD.sincronizarGoogleAgora();
        // Quando
        await SD.sincronizacaoGoogleLigar(false);
        await SD.sincronizacaoGoogleLigar(true);
        // Então
        expect((await SD.sincronizacaoGoogle())?.primeira_em).toBeNull();
      });

      it('sem nada para conferir, então a lista vem vazia, e decidir um contato que não está nela é recusado', async () => {
        // Dado
        await ligarConta();
        await SD.sincronizacaoGoogleLigar(true);
        // Quando / Então
        expect(await SD.contatosParaConferir()).toEqual([]);
        await expect(SD.contatoParaConferirDecidir('00000000-0000-0000-0000-000000000000', { acao: 'ignorar' })).rejects.toThrow('Este contato já foi conferido');
      });

      it('quando a sincronização é desligada, então a fila esvazia; quando a conta é desligada, não há mais sincronização', async () => {
        // Dado
        await ligarConta();
        await SD.sincronizacaoGoogleLigar(true);
        await criar('DESLIGAR ' + marca());
        // Quando
        await SD.sincronizacaoGoogleLigar(false);
        // Então
        expect(await SD.sincronizacaoGoogle()).toMatchObject({ ativa: false, pendentes: 0 });
        await SD.ligacaoGoogleDesligar();
        expect(await SD.sincronizacaoGoogle()).toBeNull();
      });
    });

    describe('Importação de pessoas', () => {
      // CPFs fictícios (com os dígitos certos), fora da semente.
      const [CPF_1, CPF_2, CPF_3, CPF_4, CPF_5, CPF_6] = ['86288366757', '71428793860', '15350946056', '40713521910', '58392610415', '26047193803'];
      const item = (linha: number, dados: DadosPessoa, extra: Partial<ItemImportacao> = {}): ItemImportacao =>
        ({ linha, referencia: null, existente_id: null, dados, criado_em: null, responsaveis: [], observacoes: null, pendencias: [], ...extra });
      const iniciar = () => SD.importacaoIniciar('2 linhas', 'pessoas.csv');

      it('quando uma pessoa nova é importada com data antiga de cadastro e responsável, então ela fica com a data, a importação e o responsável', async () => {
        // Dado
        const importacao = await iniciar();
        const nome = marca();
        // Quando
        const r = await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome, documento: CPF_1 },
          { referencia: 'site-1', criado_em: '2019-03-15T10:00:00-03:00', responsaveis: ['u-ana'] })]);
        // Então
        const lida = await SD.pessoaObter(r.ids[0].id);
        expect(r).toMatchObject({ criadas: 1, completadas: 0, ids: [{ linha: 2 }] });
        expect(new Date(lida!.criado_em).toISOString()).toBe('2019-03-15T13:00:00.000Z');
        expect(lida).toMatchObject({ nome, documento: CPF_1, importacao_id: importacao, referencia: 'site-1', pendencias: [], resp: [{ perfil_id: 'u-ana' }] });
      });

      it('quando um cadastro existente é completado, então só os vazios entram, telefones e e-mails se juntam e o histórico guarda só o que mudou', async () => {
        // Dado
        const { id } = await criar(marca(), { documento: CPF_2, municipio: 'Montes Claros', telefones: ['(38) 8201-0240'] });
        const importacao = await iniciar();
        // Quando
        const r = await SD.pessoasImportar(importacao, [item(2, { tipo: 'pj', nome: 'OUTRO NOME', municipio: 'Outra', emails: ['nova@exemplo.com'],
          telefones: ['+55 (38) 98201-0240', '(38) 3222-0000'] }, { existente_id: id })]);
        // Então
        const lida = await SD.pessoaObter(id);
        const [ultima] = await SD.pessoaHistorico(id);
        expect(r).toMatchObject({ criadas: 0, completadas: 1, ids: [{ linha: 2, id }] });
        expect(lida).toMatchObject({ tipo: 'pf', municipio: 'Montes Claros', emails: ['nova@exemplo.com'], telefones: ['(38) 8201-0240', '(38) 3222-0000'],
          importacao_id: null });
        expect(lida!.nome).not.toBe('OUTRO NOME');
        expect(Object.keys(ultima.alteracoes).sort()).toEqual(['emails', 'telefones']);
      });

      it('quando o cadastro existente não tem CPF nem gênero, então o CPF entra; o gênero só na pessoa física, não na empresa limitada', async () => {
        // Dado
        const { id: pf } = await criar(marca());
        const { id: pj } = await criar(marca(), { tipo: 'pj', natureza: 'empresarial', tipo_entidade: 'Sociedade Empresária Limitada' });
        const importacao = await iniciar();
        // Quando
        await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: 'X', documento: CPF_3, genero: 'f' }, { existente_id: pf }),
          item(3, { tipo: 'pj', nome: 'Y', genero: 'm' }, { existente_id: pj })]);
        // Então
        expect(await SD.pessoaObter(pf)).toMatchObject({ documento: CPF_3, genero: 'f' });
        expect((await SD.pessoaObter(pj))?.genero ?? null).toBeNull();
      });

      it('quando o tipo de entidade do arquivo não é da natureza do cadastro, então ele não entra (nem o gênero que dependeria dele)', async () => {
        // Dado: um órgão público sem tipo de entidade e uma pessoa jurídica sem natureza
        const { id: orgao } = await criar(marca(), { tipo: 'pj', natureza: 'publica' });
        const { id: semNatureza } = await criar(marca(), { tipo: 'pj' });
        const importacao = await iniciar();
        // Quando: o MEI (empresarial) permitiria o gênero, se entrasse
        await SD.pessoasImportar(importacao, [
          item(2, { tipo: 'pj', nome: 'X', tipo_entidade: 'Microempreendedor(a) Individual (MEI)', genero: 'f' }, { existente_id: orgao }),
          item(3, { tipo: 'pj', nome: 'Y', natureza: 'publica', tipo_entidade: 'Município' }, { existente_id: semNatureza })]);
        // Então
        const [e, s] = await Promise.all([SD.pessoaObter(orgao), SD.pessoaObter(semNatureza)]);
        expect({ tipo_entidade: e?.tipo_entidade ?? null, genero: e?.genero ?? null }).toEqual({ tipo_entidade: null, genero: null });
        expect(s).toMatchObject({ natureza: 'publica', tipo_entidade: 'Município' });
      });

      it('quando o cadastro tem o responsável u-master e é importado com u-master e u-ana, então fica com os dois, sem repetir', async () => {
        // Dado
        const { id } = await SD.pessoaCriar({ tipo: 'pf', nome: marca() }, ['u-master']);
        const importacao = await iniciar();
        // Quando
        await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: 'X' }, { existente_id: id, responsaveis: ['u-master', 'u-ana'] })]);
        // Então
        expect((await SD.pessoaObter(id))!.resp.map(r => r.perfil_id).sort()).toEqual(['u-ana', 'u-master']);
      });

      it('quando a pessoa entra com pendência e observação, então as duas ficam gravadas e os filtros de importadas e pendentes a acham', async () => {
        // Dado
        const importacao = await iniciar();
        const nome = marca();
        // Quando
        const r = await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome },
          { pendencias: ['documento_invalido'], observacoes: 'CPF digitado no arquivo: 123' })]);
        // Então
        const id = r.ids[0].id;
        const [pendentes, importadas] = await Promise.all((['pendentes', 'importadas'] as const).map(m => SD.pessoasListar({ termo: nome, marca: m })));
        expect(await SD.pessoaObter(id)).toMatchObject({ pendencias: ['documento_invalido'], observacoes: 'CPF digitado no arquivo: 123' });
        expect(pendentes.linhas).toMatchObject([{ id, pendencias: ['documento_invalido'], importacao_id: importacao }]);
        expect(importadas.linhas.map(p => p.id)).toEqual([id]);
      });

      it('quando a observação é importada para um cadastro que já tem uma, então ela é acrescentada numa linha nova, e a repetida não entra de novo', async () => {
        // Dado
        const { id } = await criar(marca(), { observacoes: 'Antiga' });
        const importacao = await iniciar();
        // Quando
        await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: 'X' }, { existente_id: id, observacoes: 'Nova', pendencias: ['conferir'] })]);
        await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: 'X' }, { existente_id: id, observacoes: 'Nova', pendencias: ['conferir'] })]);
        // Então
        expect(await SD.pessoaObter(id)).toMatchObject({ observacoes: 'Antiga\nNova', pendencias: ['conferir'] });
      });

      it('quando o 2º item do lote usa um CPF já cadastrado, então dá erro com o número da linha e o 1º também não é gravado', async () => {
        // Dado
        await criar(marca(), { documento: CPF_4 });
        const importacao = await iniciar();
        const nome = marca();
        // Quando
        const lote = SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome, documento: CPF_5 }), item(3, { tipo: 'pf', nome: 'OUTRA', documento: CPF_4 })]);
        // Então
        await expect(lote).rejects.toThrow('Linha 3: já existe um cadastro com este CPF/CNPJ ou esta referência.');
        expect((await SD.pessoasListar({ termo: nome })).total).toBe(0);
      });

      it('quando uma referência já importada é importada de novo como nova, então dá erro; e a busca pelas referências acha o cadastro', async () => {
        // Dado
        const importacao = await iniciar();
        const { ids: [{ id }] } = await SD.pessoasImportar(importacao, [item(2, { tipo: 'contato', nome: marca() }, { referencia: 'site-7' })]);
        // Quando
        const deNovo = SD.pessoasImportar(importacao, [item(2, { tipo: 'contato', nome: marca() }, { referencia: 'site-7' })]);
        // Então
        await expect(deNovo).rejects.toThrow('Linha 2: já existe um cadastro com este CPF/CNPJ ou esta referência.');
        expect((await SD.pessoasParaImportar({ documentos: [], referencias: ['site-7', 'site-99'] })).map(p => p.id)).toEqual([id]);
      });

      it('quando um cadastro arquivado tem o CPF do arquivo, então a busca o acha com a data de arquivamento, e completá-lo não o tira do arquivo', async () => {
        // Dado
        const { id } = await criar(marca(), { documento: CPF_6 });
        await SD.pessoasArquivar([id]);
        const importacao = await iniciar();
        // Quando
        const [achada] = await SD.pessoasParaImportar({ documentos: [CPF_6], referencias: [] });
        await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: 'X', emails: ['arquivada@exemplo.com'] }, { existente_id: id })]);
        // Então
        expect(achada).toMatchObject({ id, documento: CPF_6, resp: [] });
        expect(achada.arquivado_em).toBeTruthy();
        const depois = await SD.pessoaObter(id);
        expect(depois).toMatchObject({ emails: ['arquivada@exemplo.com'] });
        expect(depois!.arquivado_em).toBeTruthy();
      });

      it('quando a importação com 2 criadas e 1 completada é concluída, então o registro de ações tem a linha-resumo, e ela não se conclui nem recebe mais nada', async () => {
        // Dado
        const { id } = await criar(marca());
        const importacao = await iniciar();
        await SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: marca() }, { pendencias: ['conferir'] }), item(3, { tipo: 'pf', nome: marca() }),
          item(4, { tipo: 'pf', nome: 'X', emails: ['c@exemplo.com'] }, { existente_id: id })]);
        // Quando
        const concluida = await SD.importacaoConcluir(importacao, 1);
        // Então
        const [registro] = await SD.auditoriaListar();
        expect(concluida).toMatchObject({ id: importacao, criadas: 2, completadas: 1, incompletas: 1 });
        expect(concluida.concluida_em).toBeTruthy();
        expect(registro).toMatchObject({ tabela: 'pessoas', registro_id: importacao, acao: 'importacao' });
        // Só números: a descrição (texto vindo do site) não vai ao registro de ações.
        expect(registro.resumo).toEqual({ quantidade: 2, completadas: 1, incompletas: 1 });
        await expect(SD.importacaoConcluir(importacao, 1)).rejects.toThrow('Importação não encontrada ou já concluída');
        await expect(SD.pessoasImportar(importacao, [item(2, { tipo: 'pf', nome: marca() })])).rejects.toThrow('Importação não encontrada ou já concluída');
      });
    });

    describe('Equipe', () => {
      it('quando o administrador muda a função de alguém, então a lista da equipe e o contexto mostram a função nova', async () => {
        // Quando
        await SD.equipeDefinirFuncao('u-ana', 'estagiario');
        // Então
        expect((await SD.equipeListar()).find(u => u.id === 'u-ana')?.funcao).toBe('estagiario');
        expect((await SD.contexto(true))!.equipe.find(m => m.id === 'u-ana')?.funcao).toBe('estagiario');
      });
    });

    describe('Excluir alguém da equipe', () => {
      // Na semente, a Carla está desativada e a Ana, ativa; quem está logado é o master.
      it('quando o master exclui uma colega desativada, então ela sai da lista, o nome fica marcado nos registros e a exclusão fica no registro de ações', async () => {
        // Quando
        await SD.equipeExcluir('u-carla');
        // Então
        expect((await SD.equipeListar()).map(u => u.id)).not.toContain('u-carla');
        expect((await SD.contexto(true))!.equipe.find(m => m.id === 'u-carla')).toMatchObject({ nome: 'Carla Fictícia Rocha (excluído)', excluido: true, ativo: false });
        const [registro] = await SD.auditoriaListar(1);
        expect(registro).toMatchObject({ tabela: 'perfis', registro_id: 'u-carla', acao: 'exclusao', resumo: { nome: 'Carla Fictícia Rocha' } });
      });

      it('dado uma colega excluída, quando o master tenta reativar ou excluir de novo, então é recusado', async () => {
        // Dado
        await SD.equipeExcluir('u-carla');
        // Quando / Então
        await expect(SD.equipeDefinirAtivo('u-carla', true)).rejects.toThrow('Este usuário foi excluído e não volta à equipe.');
        await expect(SD.equipeExcluir('u-carla')).rejects.toThrow('Usuário não encontrado');
      });

      it('dado uma colega excluída, quando o master tenta mudar o papel, trocar o e-mail ou dar acesso de novo ao cadastro dela, então é recusado', async () => {
        // Dado
        await SD.equipeExcluir('u-carla');
        // Quando / Então
        await expect(SD.equipeDefinirPapel('u-carla', 'admin')).rejects.toThrow('Este usuário foi excluído e não volta à equipe.');
        await expect(SD.equipeTrocarEmail('u-carla', 'carla.nova@exemplo.com')).rejects.toThrow(RECUSA_DA_TROCA['sem-permissao']);
        await expect(SD.conviteCriar('p-carla', 'carla.nova@exemplo.com', 'usuario')).rejects.toThrow('Esta pessoa já é usuária do sistema');
      });

      it('dado uma colega com acesso às informações sigilosas de alguém, quando é excluída, então o acesso sai', async () => {
        // Dado
        const { id } = await criar(marca());
        await SD.sigiloConceder(id, 'u-carla');
        // Quando
        await SD.equipeExcluir('u-carla');
        // Então
        expect((await SD.sigiloAcessos(id)).map(a => a.perfil_id)).not.toContain('u-carla');
      });

      it('dado uma colega excluída, quando o cadastro dela em Pessoas é arquivado e apagado, então o cadastro sai, e o nome continua na equipe', async () => {
        // Dado
        await SD.equipeExcluir('u-carla');
        await SD.pessoasArquivar(['p-carla']);
        // Quando
        const r = await SD.pessoasExcluir(['p-carla']);
        // Então
        expect(r).toMatchObject({ excluidas: 1, naoExcluidas: 0 });
        expect((await SD.contexto(true))!.equipe.find(m => m.id === 'u-carla')?.nome).toBe('Carla Fictícia Rocha (excluído)');
      });

      it.each([
        ['alguém ativo', 'u-ana', 'Desative o usuário antes de excluir'],
        ['a própria conta', 'u-master', 'Você não pode excluir a própria conta']
      ])('quando o master tenta excluir %s, então é recusado', async (_caso, id, mensagem) => {
        // Quando / Então
        await expect(SD.equipeExcluir(id)).rejects.toThrow(mensagem);
        expect((await SD.equipeListar()).map(u => u.id)).toContain(id);
      });
    });

    describe('Conta reservada', () => {
      const semConta = async () => (await SD.pessoasListar({ termo: 'JOÃO PEDRO' })).linhas[0]!;

      it('quando o administrador reserva uma conta, então a pessoa entra na equipe sem acesso e a ação fica no registro', async () => {
        // Dado
        const pessoa = await semConta();
        // Quando
        await SD.equipeReservarConta(pessoa.id);
        // Então
        const u = (await SD.equipeListar()).find(x => x.pessoa_id === pessoa.id);
        expect(u).toMatchObject({ ativo: false, reservada: true, funcao: 'advogado' });
        const [registro] = await SD.auditoriaListar(1);
        expect(registro).toMatchObject({ acao: 'reserva_conta', resumo: { nome: pessoa.nome } });
      });

      it('quando a pessoa já é da equipe, então a reserva é recusada', async () => {
        // Dado
        const pessoaDaEquipe = (await SD.equipeListar()).find(x => x.id === 'u-bruno')!.pessoa_id!;
        // Quando / Então
        await expect(SD.equipeReservarConta(pessoaDaEquipe)).rejects.toThrow('já faz parte da equipe');
      });
    });

    describe('Troca do e-mail de um colega pelo administrador', () => {
      const emailDe = async (id: string) => (await SD.equipeListar()).find(u => u.id === id)?.email;

      it('quando o master troca o e-mail de um usuário, então o e-mail novo vale e a troca fica no registro de ações', async () => {
        // Dado
        const antigo = await emailDe('u-bruno');
        // Quando
        await SD.equipeTrocarEmail('u-bruno', '  Bruno.Novo@Exemplo.COM ');
        // Então
        expect(await emailDe('u-bruno')).toBe('bruno.novo@exemplo.com');
        const [registro] = await SD.auditoriaListar(1);
        expect(registro).toMatchObject({ acao: 'troca_email', registro_id: 'u-bruno', resumo: { email_antigo: antigo, email_novo: 'bruno.novo@exemplo.com' } });
      });

      it('quando o escritório chega ao limite de trocas na hora, então a próxima é recusada e nada muda', async () => {
        // Dado
        for (let i = 0; i < TROCAS_DE_EMAIL_POR_HORA; i++) await SD.equipeTrocarEmail('u-bruno', `bruno${i}@exemplo.com`);
        const antes = await emailDe('u-bruno');
        // Quando / Então
        await expect(SD.equipeTrocarEmail('u-bruno', 'bruno.demais@exemplo.com')).rejects.toThrow(RECUSA_DA_TROCA.limite);
        expect(await emailDe('u-bruno')).toBe(antes);
        expect(await SD.trocasDeEmailListar()).toHaveLength(TROCAS_DE_EMAIL_POR_HORA);
      });

      it('quando lista as trocas de e-mail, então só elas aparecem, da mais nova para a mais antiga, até o limite pedido', async () => {
        // Dado
        await SD.equipeTrocarEmail('u-bruno', 'bruno.um@exemplo.com');
        await SD.equipeDefinirPapel('u-bruno', 'admin');
        await SD.equipeTrocarEmail('u-bruno', 'bruno.dois@exemplo.com');
        // Quando
        const trocas = await SD.trocasDeEmailListar();
        const so = await SD.trocasDeEmailListar(1);
        // Então
        expect(trocas.every(r => r.acao === 'troca_email')).toBe(true);
        expect(trocas.map(r => r.resumo?.email_novo).slice(0, 2)).toEqual(['bruno.dois@exemplo.com', 'bruno.um@exemplo.com']);
        expect(so).toHaveLength(1);
      });

      it('quando o master troca o e-mail de um administrador, então a troca vale', async () => {
        // Quando
        await SD.equipeTrocarEmail('u-ana', 'ana.nova@exemplo.com');
        // Então
        expect(await emailDe('u-ana')).toBe('ana.nova@exemplo.com');
      });

      it.each([
        ['a própria conta', 'u-master'],
        ['uma conta que não existe', 'u-ninguem']
      ])('quando tenta trocar %s, então a troca é recusada', async (_caso, id) => {
        // Quando / Então
        await expect(SD.equipeTrocarEmail(id, 'outro@exemplo.com')).rejects.toThrow('Você não pode trocar o e-mail de acesso desta pessoa.');
      });

      it('quando o e-mail novo já é de outra conta, então a troca é recusada e nada muda', async () => {
        // Dado
        const antes = await emailDe('u-carla'), outro = await emailDe('u-ana');
        // Quando / Então
        await expect(SD.equipeTrocarEmail('u-carla', outro!)).rejects.toThrow('Este e-mail já é usado em outra conta do SEMPER.');
        expect(await emailDe('u-carla')).toBe(antes);
      });

      it('quando o e-mail novo tem convite pendente, então a troca é recusada e nada muda', async () => {
        // Dado
        const antes = await emailDe('u-carla');
        const pessoa = await criar(marca());
        await SD.conviteCriar(pessoa.id, 'convidada@exemplo.com', 'usuario');
        // Quando / Então
        await expect(SD.equipeTrocarEmail('u-carla', 'Convidada@exemplo.com')).rejects.toThrow('Este e-mail já tem um convite pendente.');
        expect(await emailDe('u-carla')).toBe(antes);
      });

      it('quando o e-mail novo é inválido, então a troca é recusada e nada muda', async () => {
        // Dado
        const antes = await emailDe('u-carla');
        // Quando / Então
        await expect(SD.equipeTrocarEmail('u-carla', 'sem-arroba')).rejects.toThrow('Informe um e-mail válido.');
        expect(await emailDe('u-carla')).toBe(antes);
      });
    });

    describe('Convites', () => {
      it('quando um convite é criado, então aparece nos pendentes com um código de acesso, e sai ao ser cancelado', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        // Quando
        const convite = await SD.conviteCriar(pessoa, 'contrato@exemplo.com', 'usuario');
        const pendentes = (await SD.convitesListar()).map(c => c.email);
        await SD.conviteCancelar(convite.id);
        const depois = (await SD.convitesListar()).map(c => c.email);
        // Então
        expect(convite.codigo).toBeTruthy();
        expect(pendentes).toContain('contrato@exemplo.com');
        expect(depois).not.toContain('contrato@exemplo.com');
      });

      it('quando já há um convite pendente para o e-mail, então um segundo é recusado com a mensagem em português', async () => {
        // Dado (no banco, o índice convites_email_pendente não deixa dois convites pendentes para o mesmo e-mail)
        const { id: pessoa } = await criar(marca());
        const { id: outra } = await criar(marca());
        await SD.conviteCriar(pessoa, 'repetido@exemplo.com', 'usuario');
        // Quando
        const segundo = SD.conviteCriar(outra, 'repetido@exemplo.com', 'usuario');
        // Então
        await expect(segundo).rejects.toThrow('Este e-mail já tem um convite pendente.');
      });
    });

    describe('Troca do e-mail de acesso', () => {
      it('quando a pessoa pede a troca, então o e-mail atual continua valendo até a confirmação', async () => {
        // Dado
        const { atual } = await SD.contaEmail();
        // Quando
        const conta = await SD.trocarEmail('  Nova.Conta@Exemplo.COM ');
        // Então
        expect(conta).toEqual({ atual, pendente: 'nova.conta@exemplo.com' });
        expect(await SD.contaEmail()).toEqual(conta);
      });

      it('quando o e-mail já é de outra conta, então a troca é recusada e nada fica pendente', async () => {
        // Dado
        const antes = await SD.contaEmail();
        const outro = (await SD.equipeListar()).find(m => m.email !== antes.atual)!;
        // Quando / Então
        await expect(SD.trocarEmail(outro.email)).rejects.toThrow('Este e-mail já é usado em outra conta do SEMPER.');
        expect(await SD.contaEmail()).toEqual(antes);
      });

      it('quando os dois links são abertos, então só o segundo conclui, e o e-mail novo passa a valer na sessão e na equipe', async () => {
        // Dado
        await SD.trocarEmail('nova.conta@exemplo.com');
        // Quando
        const primeiro = await SD.confirmarLink('link-do-atual', 'email_change');
        const antesDoSegundo = await SD.contaEmail();
        const segundo = await SD.confirmarLink('link-do-novo', 'email_change');
        // Então
        expect(primeiro).toEqual({ comSessao: false });
        expect(antesDoSegundo.pendente).toBe('nova.conta@exemplo.com');
        expect(segundo).toEqual({ comSessao: true });
        expect(await SD.contaEmail()).toEqual({ atual: 'nova.conta@exemplo.com', pendente: null });
        expect((await SD.sessao())?.user.email).toBe('nova.conta@exemplo.com');
        expect((await SD.equipeListar()).map(m => m.email)).toContain('nova.conta@exemplo.com');
      });

      it('quando o mesmo link é aberto de novo, então ele é recusado e não conclui a troca', async () => {
        // Dado
        const { atual } = await SD.contaEmail();
        await SD.trocarEmail('nova.conta@exemplo.com');
        await SD.confirmarLink('link-do-atual', 'email_change');
        // Quando / Então
        await expect(SD.confirmarLink('link-do-atual', 'email_change')).rejects.toThrow('Este link já foi usado ou venceu.');
        expect(await SD.contaEmail()).toEqual({ atual, pendente: 'nova.conta@exemplo.com' });
      });

      it('quando a conta tem duas etapas e a troca é concluída, então falta o código do aplicativo', async () => {
        // Dado
        const cadastro = await SD.duasEtapasIniciar();
        await SD.duasEtapasConfirmar(cadastro.id, '123456');
        await SD.trocarEmail('nova.conta@exemplo.com');
        // Quando
        await SD.confirmarLink('link-do-atual', 'email_change');
        await SD.confirmarLink('link-do-novo', 'email_change');
        // Então
        expect(await SD.duasEtapasPendente()).toBe(true);
      });

      it('quando não há troca pendente, então o link é recusado', async () => {
        // Dado / Quando / Então
        await expect(SD.confirmarLink('link-velho', 'email_change')).rejects.toThrow('Este link já foi usado ou venceu.');
      });
    });

    describe('Anotações', () => {
      const FORMATO = 'Algum campo está em formato inválido. Confira os dados e tente de novo.';
      const SEM_PERMISSAO = 'Você não tem permissão para fazer isso.';
      const anotacao = (extra: Partial<Parameters<Dados['anotacaoCriar']>[0]> = {}, ligarA?: Parameters<Dados['anotacaoCriar']>[1]) =>
        SD.anotacaoCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra }, ligarA);
      const demandaNova = (extra: Partial<Parameters<Dados['demandaCriar']>[0]> = {}) => SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra });
      const processoNovo = async () => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'administrativo', numero: marca(), responsavel_id: 'u-ana', clientes: [cliente] });
      };
      const contratoNovo = async () => {
        const { id: cliente } = await criar(marca());
        return SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
      };
      /** Um dia, contado de hoje (AAAA-MM-DD), para o filtro "desde". */
      const diaDaqui = (dias: number) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10);
      const ligadaA = async (id: string) => (await SD.anotacaoObter(id))!.ligada_a;

      it('dada uma anotação com um número de processo no texto, quando a pessoa busca o número como ele está escrito, com a pontuação, então acha', async () => {
        // Dado: um número CNJ que só esta anotação tem
        const numero = `${Math.floor(Math.random() * 9_000_000) + 1_000_000}-11.2024.8.21.0001`;
        const { id } = await anotacao({ texto: 'Processo ' + numero + ' na vara cível.' });
        // Quando
        const r = await SD.anotacoesListar({ termo: numero });
        // Então
        expect(r.linhas.map(x => x.id)).toEqual([id]);
      });

      it('quando uma anotação é criada, então ela pode ser lida de volta com um código, o título sem espaços nas pontas e a equipe sem repetir', async () => {
        // Dado
        const titulo = marca();
        // Quando
        const { id, codigo } = await SD.anotacaoCriar({ titulo: `  ${titulo}  `, texto: '# Estratégia\n\n**Prazo** curto.', responsavel_id: 'u-ana',
          participantes: ['u-bruno', 'u-bruno', 'u-ana'] });
        // Então
        expect(codigo).toBeTruthy();
        expect(await SD.anotacaoObter(id)).toMatchObject({ id, codigo, titulo, texto: '# Estratégia\n\n**Prazo** curto.', responsavel_id: 'u-ana', participantes: ['u-bruno'],
          ligada_a: [], arquivado_em: null, criado_por: 'u-master' });
      });

      it('quando a anotação é criada sem texto, então o texto fica vazio', async () => {
        // Quando
        const { id } = await anotacao();
        // Então
        expect((await SD.anotacaoObter(id))!.texto).toBe('');
      });

      it.each<[string, Partial<Parameters<Dados['anotacaoCriar']>[0]>, string]>([
        ['título vazio', { titulo: '   ' }, FORMATO],
        ['título longo demais', { titulo: 'x'.repeat(TAMANHO_ANOTACAO.titulo + 1) }, FORMATO],
        ['texto longo demais', { texto: 'x'.repeat(TAMANHO_ANOTACAO.texto + 1) }, FORMATO],
        ['responsável fora da equipe ativa', { responsavel_id: 'u-carla' }, 'O responsável precisa ser alguém da equipe do escritório.'],
        ['participante fora da equipe ativa', { participantes: ['u-carla'] }, 'O participante precisa ser alguém da equipe do escritório.']
      ])('quando o cadastro traz %s, então é recusado', async (_caso, extra, mensagem) => {
        // Quando / Então
        await expect(anotacao(extra)).rejects.toThrow(mensagem);
      });

      it('dados os tamanhos máximos, quando a anotação é criada, então ela é aceita', async () => {
        // Quando
        const { id } = await anotacao({ titulo: 'x'.repeat(TAMANHO_ANOTACAO.titulo), texto: 'y'.repeat(TAMANHO_ANOTACAO.texto) });
        // Então
        expect((await SD.anotacaoObter(id))!.texto).toHaveLength(TAMANHO_ANOTACAO.texto);
      });

      it('quando liga uma demanda e um processo, então os dois aparecem no cartão da anotação e em ligada_a; ligar de novo não repete', async () => {
        // Dado
        const { id } = await anotacao(), d = await demandaNova(), p = await processoNovo();
        // Quando
        const novas = [await SD.anotacaoLigar(id, 'processos', p.id), await SD.anotacaoLigar(id, 'demandas', d.id)];
        const deNovo = await SD.anotacaoLigar(id, 'demandas', d.id);
        // Então: as duas primeiras são novas; a repetida diz que já estava (a tela não oferece Desfazer)
        expect(novas).toEqual([true, true]);
        expect(deNovo).toBe(false);
        const itens = await SD.anotacaoItens(id);
        expect(itens.ocultos).toBe(0);
        expect(itens.visiveis.map(i => [i.modulo, i.id])).toEqual([['processos', p.id], ['demandas', d.id]]);
        expect(itens.visiveis[0]).toMatchObject({ codigo: p.codigo, tipo: 'administrativo', arquivado_em: null });
        expect(await ligadaA(id)).toEqual(['demandas', 'processos']);
      });

      it('dada uma anotação ligada a dois itens, quando desliga um, então ele sai e ligada_a acompanha; desligar de novo é recusado', async () => {
        // Dado
        const { id } = await anotacao(), d = await demandaNova(), p = await processoNovo();
        await SD.anotacaoLigar(id, 'demandas', d.id);
        await SD.anotacaoLigar(id, 'processos', p.id);
        // Quando
        await SD.anotacaoDesligar(id, 'demandas', d.id);
        // Então
        expect((await SD.anotacaoItens(id)).visiveis.map(i => i.id)).toEqual([p.id]);
        expect(await ligadaA(id)).toEqual(['processos']);
        await expect(SD.anotacaoDesligar(id, 'demandas', d.id)).rejects.toThrow(SEM_PERMISSAO);
      });

      it('quando liga a um item que não existe, então é recusado e nada é ligado', async () => {
        // Dado
        const { id } = await anotacao();
        // Quando / Então
        await expect(SD.anotacaoLigar(id, 'demandas', crypto.randomUUID())).rejects.toThrow('Item não encontrado neste escritório.');
        expect(await SD.anotacaoItens(id)).toEqual({ visiveis: [], ocultos: 0 });
      });

      it('dada uma anotação com o máximo de itens, quando liga mais um, então é recusado', async () => {
        // Dado
        const { id } = await anotacao();
        const pessoas = await Promise.all(Array.from({ length: ITENS_DA_ANOTACAO + 1 }, () => criar(marca())));
        await Promise.all(pessoas.slice(0, ITENS_DA_ANOTACAO).map(p => SD.anotacaoLigar(id, 'pessoas', p.id)));
        // Quando / Então
        await expect(SD.anotacaoLigar(id, 'pessoas', pessoas[ITENS_DA_ANOTACAO].id)).rejects.toThrow(`Uma anotação pode ser ligada a no máximo ${ITENS_DA_ANOTACAO} itens.`);
        expect((await SD.anotacaoItens(id)).visiveis).toHaveLength(ITENS_DA_ANOTACAO);
        // Ligar de novo um que já está não conta como mais um.
        await expect(SD.anotacaoLigar(id, 'pessoas', pessoas[0].id)).resolves.toBe(false);
      });

      it('dada uma anotação arquivada, quando liga um item, então é recusado', async () => {
        // Dado
        const { id } = await anotacao(), d = await demandaNova();
        await SD.anotacoesArquivar([id]);
        // Quando / Então
        await expect(SD.anotacaoLigar(id, 'demandas', d.id)).rejects.toThrow(SEM_PERMISSAO);
      });

      it('quando cria a anotação no cartão de um item, então ela já nasce ligada a ele', async () => {
        // Dado
        const d = await demandaNova();
        // Quando
        const { id } = await anotacao({}, { modulo: 'demandas', id: d.id });
        // Então
        expect(await ligadaA(id)).toEqual(['demandas']);
        expect((await SD.anotacoesDoItem('demandas', d.id)).map(a => a.id)).toEqual([id]);
      });

      it('dada uma anotação com texto, participante e dois itens, quando duplica, então nasce a cópia com código e histórico próprios, o mesmo texto e as mesmas ligações, e a original fica igual', async () => {
        // Dado: a original, já alterada uma vez (tem histórico)
        const d = await demandaNova(), p = await processoNovo();
        const { id, codigo } = await anotacao({ texto: '- [ ] Ligar ao cliente', participantes: ['u-bruno'] }, { modulo: 'processos', id: p.id });
        await SD.anotacaoLigar(id, 'demandas', d.id);
        await SD.anotacaoAtualizar(id, { texto: '- [x] Ligar ao cliente' });
        const original = (await SD.anotacaoObter(id))!, historico = await SD.anotacaoHistorico(id);
        // Quando
        const copia = await SD.anotacaoDuplicar(id, dadosDaCopia(original, { id: 'u-master', alteraAOriginal: true, equipe: [{ id: 'u-master' }, { id: 'u-bruno' }] }));
        // Então
        expect(copia.id).not.toBe(id);
        expect(copia.codigo).not.toBe(codigo);
        expect(await SD.anotacaoObter(copia.id)).toMatchObject({ titulo: original.titulo + ' (cópia)', texto: '- [x] Ligar ao cliente', responsavel_id: 'u-master',
          participantes: ['u-bruno'], ligada_a: ['demandas', 'processos'], criado_por: 'u-master', arquivado_em: null });
        expect((await SD.anotacaoItens(copia.id)).visiveis.map(i => [i.modulo, i.id])).toEqual([['processos', p.id], ['demandas', d.id]]);
        expect(await SD.anotacaoHistorico(copia.id)).toEqual([]);
        expect(await SD.anotacaoObter(id)).toEqual(original);
        expect(await SD.anotacaoHistorico(id)).toEqual(historico);
        expect((await SD.anotacaoItens(id)).visiveis.map(i => i.id)).toEqual([p.id, d.id]);
      });

      it('dada uma anotação sem itens ligados, quando duplica, então a cópia nasce sem ligações', async () => {
        // Dado
        const { id } = await anotacao();
        // Quando
        const copia = await SD.anotacaoDuplicar(id, { titulo: marca(), responsavel_id: 'u-master' });
        // Então
        expect(await SD.anotacaoItens(copia.id)).toEqual({ visiveis: [], ocultos: 0 });
      });

      it('quando duplica uma anotação que não existe, então é recusado e nada fica gravado', async () => {
        // Dado
        const titulo = marca();
        // Quando / Então
        await expect(SD.anotacaoDuplicar(crypto.randomUUID(), { titulo, responsavel_id: 'u-master' })).rejects.toThrow(SEM_PERMISSAO);
        expect((await SD.anotacoesListar({ termo: titulo })).total).toBe(0);
      });

      it('quando cria a anotação ligada a um item que não existe, então é recusado e nada fica gravado', async () => {
        // Dado
        const titulo = marca();
        // Quando / Então
        await expect(anotacao({ titulo }, { modulo: 'tarefas', id: crypto.randomUUID() })).rejects.toThrow('Item não encontrado neste escritório.');
        expect((await SD.anotacoesListar({ termo: titulo })).total).toBe(0);
        expect((await SD.anotacoesListar({ termo: titulo, situacao: 'arquivadas' })).total).toBe(0);
      });

      it('quando cria a anotação já ligada a vários itens escolhidos antes de salvar (#339), então ela nasce ligada a todos, na ordem da escolha, sem repetir', async () => {
        // Dado
        const d = await demandaNova(), p = await processoNovo(), { id: pessoa } = await criar(marca());
        // Quando
        const { id } = await anotacao({}, [{ modulo: 'demandas', id: d.id }, { modulo: 'pessoas', id: pessoa }, { modulo: 'processos', id: p.id }, { modulo: 'demandas', id: d.id }]);
        // Então
        expect((await SD.anotacaoItens(id)).visiveis.map(i => [i.modulo, i.id])).toEqual([['demandas', d.id], ['pessoas', pessoa], ['processos', p.id]]);
        expect(await ligadaA(id)).toEqual(['demandas', 'pessoas', 'processos']);
        expect((await SD.anotacoesDoItem('processos', p.id)).map(a => a.id)).toEqual([id]);
      });

      it('quando cria a anotação com a lista de itens vazia, então ela nasce sem ligações', async () => {
        // Quando
        const { id } = await anotacao({}, []);
        // Então
        expect(await SD.anotacaoItens(id)).toEqual({ visiveis: [], ocultos: 0 });
      });

      it('quando cria a anotação ligada a vários itens e um deles não existe, então é recusado e nada fica gravado, nem as ligações já feitas', async () => {
        // Dado
        const titulo = marca(), d = await demandaNova();
        // Quando / Então
        await expect(anotacao({ titulo }, [{ modulo: 'demandas', id: d.id }, { modulo: 'tarefas', id: crypto.randomUUID() }])).rejects.toThrow('Item não encontrado neste escritório.');
        expect((await SD.anotacoesListar({ termo: titulo })).total).toBe(0);
        expect((await SD.anotacoesListar({ termo: titulo, situacao: 'arquivadas' })).total).toBe(0);
        expect(await SD.anotacoesDoItem('demandas', d.id)).toEqual([]);
      });

      it('quando cria a anotação ligada a mais itens do que o máximo, então é recusado e nada fica gravado', async () => {
        // Dado
        const titulo = marca();
        const pessoas = await Promise.all(Array.from({ length: ITENS_DA_ANOTACAO + 1 }, () => criar(marca())));
        // Quando / Então
        await expect(anotacao({ titulo }, pessoas.map(p => ({ modulo: 'pessoas' as const, id: p.id }))))
          .rejects.toThrow(`Uma anotação pode ser ligada a no máximo ${ITENS_DA_ANOTACAO} itens.`);
        expect((await SD.anotacoesListar({ termo: titulo })).total).toBe(0);
      });

      it('dadas anotações de uma marca, quando busca pelo título, pelo texto sem acento e pelo código, então acha só a certa', async () => {
        // Dado
        const m = marca();
        const a = await anotacao({ titulo: m + ' Petição', texto: 'Audiência de conciliação marcada' });
        await anotacao({ titulo: m + ' Outra' });
        // Quando / Então
        expect((await SD.anotacoesListar({ termo: m })).total).toBe(2);
        expect((await SD.anotacoesListar({ termo: m + ' peticao' })).linhas.map(x => x.id)).toEqual([a.id]);
        expect((await SD.anotacoesListar({ termo: 'conciliacao marcada' })).linhas.map(x => x.id)).toContain(a.id);
        expect((await SD.anotacoesListar({ termo: a.codigo })).linhas.map(x => x.id)).toEqual([a.id]);
      });

      it('dadas anotações ligadas e soltas, quando filtra por "Ligada a", então vêm as do módulo, ou as sem nenhum item', async () => {
        // Dado
        const m = marca(), d = await demandaNova();
        const ligada = await anotacao({ titulo: m + ' A' }, { modulo: 'demandas', id: d.id });
        const solta = await anotacao({ titulo: m + ' B' });
        // Quando
        const daDemanda = await SD.anotacoesListar({ termo: m, ligadaA: 'demandas' });
        const doProcesso = await SD.anotacoesListar({ termo: m, ligadaA: 'processos' });
        const nenhum = await SD.anotacoesListar({ termo: m, ligadaA: 'nenhum' });
        // Então
        expect(daDemanda.linhas.map(x => x.id)).toEqual([ligada.id]);
        expect(daDemanda.linhas[0]).toMatchObject({ ligada_a: ['demandas'], criado_por: 'u-master', responsavel_id: 'u-master', participantes: [] });
        expect(doProcesso.total).toBe(0);
        expect(nenhum.linhas.map(x => x.id)).toEqual([solta.id]);
      });

      it('dadas anotações de quem está logado, quando filtra pelo autor e pela data, então vêm só as que combinam', async () => {
        // Dado
        const m = marca();
        await anotacao({ titulo: m });
        // Quando / Então
        expect((await SD.anotacoesListar({ termo: m, autor: 'u-master' })).total).toBe(1);
        expect((await SD.anotacoesListar({ termo: m, autor: 'u-ana' })).total).toBe(0);
        expect((await SD.anotacoesListar({ termo: m, desde: diaDaqui(-2) })).total).toBe(1);
        expect((await SD.anotacoesListar({ termo: m, desde: diaDaqui(2) })).total).toBe(0);
      });

      it('dadas três anotações, quando lê pelo título e pela data de criação, então a ordem é a pedida; sem ordem, as atualizadas por último primeiro', async () => {
        // Dado
        const m = marca();
        const b = await anotacao({ titulo: m + ' B' }), a = await anotacao({ titulo: m + ' A' }), c = await anotacao({ titulo: m + ' C' });
        await SD.anotacaoAtualizar(b.id, { texto: 'mais recente' });
        const ids = async (ordem?: FiltroAnotacoes['ordem']) =>
          (await SD.anotacoesListar({ termo: m, ordem })).linhas.map(x => x.id);
        // Quando / Então
        expect(await ids('nome')).toEqual([a.id, b.id, c.id]);
        expect(await ids('nome_desc')).toEqual([c.id, b.id, a.id]);
        expect(await ids('novos')).toEqual([c.id, a.id, b.id]);
        expect(await ids('antigos')).toEqual([b.id, a.id, c.id]);
        expect((await ids())[0]).toBe(b.id);
      });

      it('dadas três anotações, quando lê de duas em duas, então as páginas não se repetem e o total é o mesmo', async () => {
        // Dado
        const m = marca();
        for (let i = 0; i < 3; i++) await anotacao({ titulo: `${m} ${i}` });
        // Quando
        const [p1, p2] = [await SD.anotacoesListar({ termo: m, porPagina: 2 }), await SD.anotacoesListar({ termo: m, porPagina: 2, pagina: 1 })];
        // Então
        expect([p1.total, p2.total]).toEqual([3, 3]);
        expect(p1.linhas).toHaveLength(2);
        expect(new Set([...p1.linhas, ...p2.linhas].map(x => x.id)).size).toBe(3);
      });

      it('dada uma anotação ativa, quando tenta excluir, então é recusado; arquivada, ela vai para as arquivadas e pode ser excluída', async () => {
        // Dado
        const m = marca(), { id } = await anotacao({ titulo: m });
        // Quando / Então
        expect(await SD.anotacoesExcluir([id])).toMatchObject({ excluidas: 0, naoExcluidas: 1, motivo: expect.stringContaining('arquivadas') });
        expect(await SD.anotacoesArquivar([id])).toBe(1);
        expect((await SD.anotacoesListar({ termo: m })).total).toBe(0);
        expect((await SD.anotacoesListar({ termo: m, situacao: 'arquivadas' })).linhas.map(x => x.id)).toEqual([id]);
        expect(await SD.anotacoesExcluir([id])).toMatchObject({ excluidas: 1, naoExcluidas: 0 });
        expect(await SD.anotacaoObter(id)).toBeNull();
      });

      it('dada uma anotação arquivada, quando desarquiva, então ela volta para as ativas', async () => {
        // Dado
        const m = marca(), { id } = await anotacao({ titulo: m });
        await SD.anotacoesArquivar([id]);
        // Quando
        await SD.anotacoesArquivar([id], false);
        // Então
        expect((await SD.anotacoesListar({ termo: m })).linhas.map(x => x.id)).toEqual([id]);
      });

      it('quando a anotação é alterada, então o histórico guarda o título e o responsável, e só marca que o texto mudou', async () => {
        // Dado
        const { id } = await anotacao({ titulo: 'Antes', texto: 'texto velho' });
        // Quando
        await SD.anotacaoAtualizar(id, { titulo: 'Depois', texto: 'texto novo', responsavel_id: 'u-ana' });
        // Então
        const [h] = await SD.anotacaoHistorico(id);
        expect(h.alteracoes).toEqual({
          titulo: { de: 'Antes', para: 'Depois' }, texto: { de: null, para: null },
          responsavel_id: { de: 'Mauro Teixeira Duarte', para: 'Ana Teste Lima' }
        });
        expect(h.feito_por).toBe('u-master');
      });

      it('dado o texto gravado com a data da leitura, quando ninguém mudou a anotação, então ele é gravado e volta a data nova', async () => {
        // Dado
        const { id } = await anotacao({ texto: 'antes' });
        const lida = (await SD.anotacaoObter(id))!;
        // Quando
        const nova = await SD.anotacaoGravarTexto(id, 'depois', lida.atualizado_em);
        // Então
        const agora = (await SD.anotacaoObter(id))!;
        expect(agora.texto).toBe('depois');
        expect(nova).toBe(agora.atualizado_em);
        expect(nova).not.toBe(lida.atualizado_em);
      });

      it('dada a anotação mudada depois da leitura, quando o texto vai com a data velha, então nada é gravado e volta null', async () => {
        // Dado: lida, e depois mudada por outra gravação (outra pessoa, ou outra aba)
        const { id } = await anotacao({ texto: 'antes' });
        const lida = (await SD.anotacaoObter(id))!;
        await SD.anotacaoAtualizar(id, { texto: 'de outra pessoa' });
        // Quando
        const nova = await SD.anotacaoGravarTexto(id, 'meu texto', lida.atualizado_em);
        // Então
        expect(nova).toBeNull();
        expect((await SD.anotacaoObter(id))!.texto).toBe('de outra pessoa');
      });

      it('quando liga e desliga um item, então isso não muda a data de alteração nem o histórico', async () => {
        // Dado
        const { id } = await anotacao(), d = await demandaNova();
        const antes = (await SD.anotacaoObter(id))!.atualizado_em;
        // Quando
        await SD.anotacaoLigar(id, 'demandas', d.id);
        await SD.anotacaoDesligar(id, 'demandas', d.id);
        // Então
        expect((await SD.anotacaoObter(id))!.atualizado_em).toBe(antes);
        expect(await SD.anotacaoHistorico(id)).toEqual([]);
      });

      it('dadas duas anotações numa demanda, quando lê as do item, então vêm as duas, a alterada por último primeiro, também a arquivada', async () => {
        // Dado
        const d = await demandaNova(), outra = await demandaNova();
        const a = await anotacao({}, { modulo: 'demandas', id: d.id }), b = await anotacao({}, { modulo: 'demandas', id: d.id });
        await anotacao({}, { modulo: 'demandas', id: outra.id });
        await SD.anotacaoAtualizar(a.id, { texto: 'mexida' });
        await SD.anotacoesArquivar([b.id]);
        // Quando
        const ligadas = await SD.anotacoesDoItem('demandas', d.id);
        // Então
        expect(ligadas.map(x => x.id)).toEqual([b.id, a.id]);
        expect(ligadas[0]).toMatchObject({ codigo: b.codigo, arquivado_em: expect.any(String), criado_por: 'u-master' });
      });

      it('dada uma anotação com texto ligada a uma demanda, quando lê as do item para o número, então ela vem sem o texto; quando lê com o texto, então ele vem, para a coluna do cartão mostrar o começo (#360)', async () => {
        // Dado
        const d = await demandaNova();
        const { id } = await anotacao({ texto: '# Plano\nJuntar a procuração.' }, { modulo: 'demandas', id: d.id });
        // Quando
        const [leve] = await SD.anotacoesDoItem('demandas', d.id);
        const [comTexto] = await SD.anotacoesDoItemComTexto('demandas', d.id);
        // Então
        expect(leve.id).toBe(id);
        expect(leve).not.toHaveProperty('texto');
        expect(comTexto).toEqual({ ...leve, texto: '# Plano\nJuntar a procuração.' });
      });

      it('dadas duas anotações numa demanda, quando lê as do item com o texto, então vêm na mesma ordem da leitura sem o texto (#360)', async () => {
        // Dado
        const d = await demandaNova();
        const a = await anotacao({ texto: 'Primeira' }, { modulo: 'demandas', id: d.id }), b = await anotacao({ texto: 'Segunda' }, { modulo: 'demandas', id: d.id });
        await SD.anotacaoAtualizar(a.id, { texto: 'Primeira, mexida' });
        // Quando
        const comTexto = await SD.anotacoesDoItemComTexto('demandas', d.id);
        // Então
        expect(comTexto.map(x => x.id)).toEqual((await SD.anotacoesDoItem('demandas', d.id)).map(x => x.id));
        expect(comTexto.map(x => x.texto)).toEqual(['Primeira, mexida', 'Segunda']);
        expect(b.id).toBe(comTexto[1].id);
      });

      it('dados itens de vários módulos, quando lê os itens da anotação, então cada um vem com o nome certo', async () => {
        // Dado
        const nome = marca(), { id: pessoa } = await criar(nome);
        const p = await processoNovo(), k = await contratoNovo(), d = await demandaNova({ titulo: 'Contestação ' + nome });
        const t = await SD.tarefaCriar({ titulo: 'Emitir GRU ' + nome, responsavel_id: 'u-master' });
        const c = await SD.compromissoCriar({ tipo: 'reuniao', titulo: 'Reunião ' + nome, data: diaDaqui(1), hora: '10:00', responsavel_id: 'u-master' });
        const { id } = await anotacao();
        const ligacoes = [['pessoas', pessoa], ['processos', p.id], ['contratos', k.id], ['demandas', d.id], ['tarefas', t.id], ['compromissos', c.id]] as const;
        for (const [modulo, item] of ligacoes) await SD.anotacaoLigar(id, modulo, item);
        // Quando
        const { visiveis } = await SD.anotacaoItens(id);
        // Então
        expect(visiveis.map(i => i.nome)).toEqual([nome, (await SD.processoObter(p.id))!.numero, (await SD.contratoObter(k.id))!.servico, 'Contestação ' + nome,
          'Emitir GRU ' + nome, 'Reunião ' + nome]);
        expect(await ligadaA(id)).toEqual(['compromissos', 'contratos', 'demandas', 'pessoas', 'processos', 'tarefas']);
      });

      it('quando busca itens para ligar, então acha os ativos do módulo pela busca, com o nome e no máximo o limite', async () => {
        // Dado
        const m = marca(), ativa = await demandaNova({ titulo: m + ' ativa' }), arquivada = await demandaNova({ titulo: m + ' arquivada' });
        await SD.demandasArquivar([arquivada.id]);
        const p = await processoNovo();
        // Quando
        const demandas = await SD.itensParaLigar('demandas', m);
        const processos = await SD.itensParaLigar('processos', (await SD.processoObter(p.id))!.numero);
        // Então
        expect(demandas).toEqual([{ modulo: 'demandas', id: ativa.id, codigo: ativa.codigo, nome: m + ' ativa', arquivado_em: null }]);
        expect(processos.map(i => [i.id, i.tipo])).toEqual([[p.id, 'administrativo']]);
        expect((await SD.itensParaLigar('pessoas', '')).length).toBeLessThanOrEqual(ITENS_PARA_LIGAR);
      });

      it('dado o cartão de uma demanda, quando busca anotações para ligar pelo código ou pelo título, então acha as ativas ainda não ligadas a ela, com quantos itens cada uma tem (#341)', async () => {
        // Dado
        const m = marca(), d = await demandaNova(), p = await criar(marca());
        const livre = await anotacao({ titulo: m + ' livre' }, { modulo: 'pessoas', id: p.id });
        const ligada = await anotacao({ titulo: m + ' ligada' }, { modulo: 'demandas', id: d.id });
        const arquivada = await anotacao({ titulo: m + ' arquivada' });
        await SD.anotacoesArquivar([arquivada.id]);
        // Quando
        const pelo = { titulo: await SD.anotacoesParaLigar('demandas', d.id, m), codigo: await SD.anotacoesParaLigar('demandas', d.id, livre.codigo) };
        // Então
        const esperada = { id: livre.id, codigo: livre.codigo, titulo: m + ' livre', itens: 1 };
        expect(pelo.titulo).toEqual([expect.objectContaining(esperada)]);
        expect(pelo.codigo).toEqual([expect.objectContaining(esperada)]);
        expect(await SD.anotacoesParaLigar('demandas', d.id, ligada.codigo)).toEqual([]);
        // No cartão de outro item, a que está ligada à demanda é oferecida.
        expect((await SD.anotacoesParaLigar('pessoas', p.id, m)).map(a => a.id)).toEqual([ligada.id]);
      });

      it('dado o cartão de uma pessoa, quando liga uma anotação achada na busca, então ela aparece no cartão e sai da busca (#341)', async () => {
        // Dado
        const m = marca(), p = await criar(marca()), { id } = await anotacao({ titulo: m });
        const [achada] = await SD.anotacoesParaLigar('pessoas', p.id, m);
        // Quando
        await SD.anotacaoLigar(achada.id, 'pessoas', p.id);
        // Então
        expect((await SD.anotacoesDoItem('pessoas', p.id)).map(a => a.id)).toEqual([id]);
        expect((await SD.anotacaoItens(id)).visiveis.map(i => i.id)).toEqual([p.id]);
        expect(await SD.anotacoesParaLigar('pessoas', p.id, m)).toEqual([]);
      });

      it('quando busca anotações para ligar sem texto, então vêm no máximo o limite (#341)', async () => {
        // Dado
        const d = await demandaNova();
        for (let i = 0; i <= ITENS_PARA_LIGAR; i++) await anotacao();
        // Quando / Então
        expect((await SD.anotacoesParaLigar('demandas', d.id, '')).length).toBe(ITENS_PARA_LIGAR);
      });

      it('dada uma demanda ligada, quando ela é excluída, então a ligação sai da anotação', async () => {
        // Dado
        const d = await demandaNova(), { id } = await anotacao({}, { modulo: 'demandas', id: d.id });
        await SD.demandasArquivar([d.id]);
        // Quando
        await SD.demandasExcluir([d.id]);
        // Então
        expect(await SD.anotacaoItens(id)).toEqual({ visiveis: [], ocultos: 0 });
        expect(await ligadaA(id)).toEqual([]);
      });

      it('dada uma pessoa ligada a uma anotação, quando ela é excluída, então é recusado', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        await anotacao({}, { modulo: 'pessoas', id: pessoa });
        await SD.pessoasArquivar([pessoa]);
        // Quando
        const r = await SD.pessoasExcluir([pessoa]);
        // Então
        expect(r).toEqual({ excluidas: 0, naoExcluidas: 1, motivo: 'Esta pessoa está ligada a anotações e não pode ser excluída.' });
      });
    });

    describe('Pastas e etiquetas dos documentos (#342)', () => {
      const ESVAZIE = 'Esvazie a pasta antes de apagá-la: tire dela as anotações e as subpastas.';
      const anotacao = (extra: Partial<Parameters<Dados['anotacaoCriar']>[0]> = {}, etiquetas?: string[]) =>
        SD.anotacaoCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra }, undefined, etiquetas);
      const etiquetaNova = () => SD.etiquetaCriar('azul', marca());
      const nomes = async () => (await SD.pastasListar()).map(p => p.nome);

      it('quando alguém cria uma pasta e uma subpasta, então as duas vêm na lista, cada uma com a mãe dela, e o nome fica sem espaços sobrando', async () => {
        // Quando
        const mae = await SD.pastaCriar('  Escritório ' + marca() + ' ', null);
        const filha = await SD.pastaCriar('POPs', mae.id);
        // Então
        const lista = await SD.pastasListar();
        expect(lista.find(p => p.id === mae.id)).toMatchObject({ pasta_mae_id: null, criada_por: 'u-master' });
        expect(mae.nome).toBe(mae.nome.trim());
        expect(lista.find(p => p.id === filha.id)).toMatchObject({ nome: 'POPs', pasta_mae_id: mae.id });
      });

      it('quando o nome repete o de uma irmã (sem contar maiúsculas e acentos), então é recusado; em outra pasta, pode', async () => {
        // Dado
        const mae = await SD.pastaCriar(marca(), null);
        await SD.pastaCriar('Atas de reunião', mae.id);
        const outra = await SD.pastaCriar(marca(), null);
        // Então
        await expect(SD.pastaCriar('ATAS DE REUNIAO', mae.id)).rejects.toThrow('Já existe uma pasta com esse nome aqui.');
        await expect(SD.pastaCriar('Atas de reunião', outra.id)).resolves.toMatchObject({ pasta_mae_id: outra.id });
      });

      it('quando alguém renomeia e move uma pasta, então ela muda; para dentro dela mesma ou de uma subpasta, é recusado', async () => {
        // Dado
        const a = await SD.pastaCriar(marca(), null);
        const b = await SD.pastaCriar('B', a.id);
        const c = await SD.pastaCriar('C', b.id);
        // Quando
        await SD.pastaRenomear(b.id, 'Bê');
        await SD.pastaMover(c.id, a.id);
        // Então
        expect((await SD.pastasListar()).find(p => p.id === c.id)?.pasta_mae_id).toBe(a.id);
        expect(await nomes()).toContain('Bê');
        await expect(SD.pastaMover(a.id, a.id)).rejects.toThrow('Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.');
        await expect(SD.pastaMover(a.id, b.id)).rejects.toThrow('Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.');
        await SD.pastaMover(b.id, null);
        expect((await SD.pastasListar()).find(p => p.id === b.id)?.pasta_mae_id).toBeNull();
      });

      it('dada uma pasta com subpasta ou com anotação, quando alguém tenta apagá-la, então pede para esvaziá-la; vazia, ela sai', async () => {
        // Dado
        const comFilha = await SD.pastaCriar(marca(), null);
        const filha = await SD.pastaCriar('Filha', comFilha.id);
        const comAnotacao = await SD.pastaCriar(marca(), null);
        const { id } = await anotacao({ pasta_id: comAnotacao.id });
        // Então
        await expect(SD.pastaExcluir(comFilha.id)).rejects.toThrow(ESVAZIE);
        await expect(SD.pastaExcluir(comAnotacao.id)).rejects.toThrow(ESVAZIE);
        // Quando: as duas ficam vazias
        await SD.pastaExcluir(filha.id);
        await SD.anotacaoAtualizar(id, { pasta_id: null });
        await SD.pastaExcluir(comFilha.id);
        await SD.pastaExcluir(comAnotacao.id);
        // Então
        expect((await SD.pastasListar()).map(p => p.id)).not.toContain(comFilha.id);
        expect((await SD.pastasListar()).map(p => p.id)).not.toContain(comAnotacao.id);
      });

      it('dada uma pasta que um colega apagou, quando alguém põe nela uma anotação, uma subpasta ou outra pasta, então diz que ela não existe mais', async () => {
        // Dado
        const SUMIU = 'Essa pasta não existe mais: um colega pode tê-la apagado. Escolha outra.';
        const apagada = await SD.pastaCriar(marca(), null);
        const outra = await SD.pastaCriar(marca(), null);
        const { id } = await anotacao();
        await SD.pastaExcluir(apagada.id);
        const titulo = marca();
        // Quando / Então
        await expect(SD.anotacaoCriar({ titulo, responsavel_id: 'u-master', pasta_id: apagada.id })).rejects.toThrow(SUMIU);
        await expect(SD.anotacaoAtualizar(id, { pasta_id: apagada.id })).rejects.toThrow(SUMIU);
        await expect(SD.pastaCriar('Dentro da apagada', apagada.id)).rejects.toThrow(SUMIU);
        await expect(SD.pastaMover(outra.id, apagada.id)).rejects.toThrow(SUMIU);
        expect((await SD.anotacoesListar({ termo: titulo })).total).toBe(0);
        expect((await SD.anotacaoObter(id))?.pasta_id).toBeNull();
        expect((await SD.pastasListar()).find(p => p.id === outra.id)?.pasta_mae_id).toBeNull();
      });

      it('dada uma pasta que um colega apagou, quando alguém a renomeia, move ou apaga, então diz que ela não existe mais (e não que falta permissão)', async () => {
        // Dado
        const APAGADA = 'Essa pasta não existe mais: um colega pode tê-la apagado.';
        const apagada = await SD.pastaCriar(marca(), null);
        const outra = await SD.pastaCriar(marca(), null);
        await SD.pastaExcluir(apagada.id);
        // Quando / Então
        await expect(SD.pastaRenomear(apagada.id, marca())).rejects.toThrow(APAGADA);
        await expect(SD.pastaMover(apagada.id, outra.id)).rejects.toThrow(APAGADA);
        await expect(SD.pastaExcluir(apagada.id)).rejects.toThrow(APAGADA);
        expect((await SD.pastasListar()).map(p => p.id)).not.toContain(apagada.id);
      });

      it('quando o nome da pasta é vazio ou longo demais, então a recusa diz o que há de errado no nome, como a regra do banco', async () => {
        // Dado
        const pasta = await SD.pastaCriar(marca(), null);
        // Quando / Então
        await expect(SD.pastaCriar('   ', null)).rejects.toThrow('Dê um nome à pasta.');
        await expect(SD.pastaCriar('x'.repeat(TAMANHO_PASTA + 1), null)).rejects.toThrow(`O nome da pasta pode ter até ${TAMANHO_PASTA} caracteres.`);
        await expect(SD.pastaRenomear(pasta.id, '')).rejects.toThrow('Dê um nome à pasta.');
        await expect(SD.pastaRenomear(pasta.id, 'x'.repeat(TAMANHO_PASTA + 1))).rejects.toThrow(`O nome da pasta pode ter até ${TAMANHO_PASTA} caracteres.`);
      });

      it('quando o nome da pasta vem colado com espaços não separáveis nas pontas, então fica guardado sem eles', async () => {
        // Quando
        const nome = marca();
        const p = await SD.pastaCriar(`  ${nome} `, null);
        // Então
        expect(p.nome).toBe(nome);
        expect((await SD.pastasListar()).find(x => x.id === p.id)?.nome).toBe(nome);
      });


      it('dada uma pasta com subpastas, quando a lista é filtrada por ela e pelas subpastas, então vêm só as anotações delas, com a pasta de cada uma', async () => {
        // Dado
        const mae = await SD.pastaCriar(marca(), null);
        const filha = await SD.pastaCriar('Filha', mae.id);
        const fora = await SD.pastaCriar(marca(), null);
        const { id: naMae } = await anotacao({ pasta_id: mae.id });
        const { id: naFilha } = await anotacao({ pasta_id: filha.id });
        await anotacao({ pasta_id: fora.id });
        await anotacao();
        // Quando
        const r = await SD.anotacoesListar({ pastas: [mae.id, filha.id], porPagina: 100 });
        // Então
        expect(r.linhas.map(a => a.id).sort()).toEqual([naMae, naFilha].sort());
        expect(r.linhas.find(a => a.id === naFilha)?.pasta_id).toBe(filha.id);
      });

      it('dada uma anotação criada com etiquetas, quando a lista é filtrada pela etiqueta, então vem só ela, com as etiquetas dela', async () => {
        // Dado
        const pop = await etiquetaNova(), reuniao = await etiquetaNova();
        const { id } = await anotacao({}, [pop.id, reuniao.id]);
        await anotacao({}, [reuniao.id]);
        // Quando
        const r = await SD.anotacoesListar({ etiqueta: pop.id, porPagina: 100 });
        // Então
        expect(r.linhas.map(a => a.id)).toEqual([id]);
        expect(r.linhas[0].etq?.map(e => e.etiqueta_id).sort()).toEqual([pop.id, reuniao.id].sort());
        expect((await SD.etiquetasDoCartao('anotacoes', id)).sort()).toEqual([pop.id, reuniao.id].sort());
      });

      it('dada uma anotação, quando alguém aplica e tira etiquetas no cartão, então elas mudam sem entrar no histórico', async () => {
        // Dado
        const pop = await etiquetaNova();
        const { id } = await anotacao();
        // Quando
        await SD.etiquetaAplicar('anotacoes', id, pop.id);
        // Então
        expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([pop.id]);
        await SD.etiquetaTirar('anotacoes', id, pop.id);
        expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([]);
        expect(await SD.anotacaoHistorico(id)).toEqual([]);
      });

      it('quando a anotação muda de pasta, então o histórico mostra o caminho de antes e o de agora', async () => {
        // Dado
        const mae = await SD.pastaCriar(marca(), null);
        const pops = await SD.pastaCriar('POPs', mae.id);
        const atas = await SD.pastaCriar('Atas', mae.id);
        const { id } = await anotacao({ pasta_id: pops.id });
        // Quando
        await SD.anotacaoAtualizar(id, { pasta_id: atas.id });
        // Então
        const [h] = await SD.anotacaoHistorico(id);
        expect(h.alteracoes.pasta_id).toEqual({ de: `${mae.nome} › POPs`, para: `${mae.nome} › Atas` });
        expect((await SD.anotacaoObter(id))?.pasta_id).toBe(atas.id);
      });

      it('dada uma anotação com pasta e etiquetas, quando alguém a duplica, então a cópia fica na mesma pasta e com as mesmas etiquetas', async () => {
        // Dado
        const pasta = await SD.pastaCriar(marca(), null);
        const pop = await etiquetaNova(), reuniao = await etiquetaNova();
        const { id } = await anotacao({ pasta_id: pasta.id }, [pop.id, reuniao.id]);
        const original = (await SD.anotacaoObter(id))!;
        // Quando
        const copia = await SD.anotacaoDuplicar(id, dadosDaCopia(original, { id: 'u-master', alteraAOriginal: true, equipe: [{ id: 'u-master' }] }));
        // Então
        expect((await SD.anotacaoObter(copia.id))?.pasta_id).toBe(pasta.id);
        expect((await SD.etiquetasDoCartao('anotacoes', copia.id)).sort()).toEqual([pop.id, reuniao.id].sort());
        expect((await SD.etiquetasDoCartao('anotacoes', id)).sort()).toEqual([pop.id, reuniao.id].sort());
      });

      it('quando a anotação é criada com uma etiqueta que não existe, então nada fica gravado', async () => {
        // Dado
        const titulo = marca();
        // Quando
        const criando = SD.anotacaoCriar({ titulo, responsavel_id: 'u-master' }, undefined, ['etiqueta-que-nao-existe']);
        // Então
        await expect(criando).rejects.toThrow('Não foi possível concluir agora. Tente de novo.');
        expect((await SD.anotacoesListar({ termo: titulo })).total).toBe(0);
      });

      it('dada uma etiqueta excluída, quando a anotação é lida, então ela não tem mais a etiqueta', async () => {
        // Dado
        const pop = await etiquetaNova();
        const { id } = await anotacao({}, [pop.id]);
        // Quando
        await SD.etiquetaExcluir(pop.id);
        // Então
        expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([]);
      });
    });

    describe('Ligar a um cartão um item que já existe (#341, etapa 2)', () => {
      const demandaNova = (extra: Partial<Parameters<Dados['demandaCriar']>[0]> = {}) => SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra });
      const tarefaNova = (extra: Partial<Parameters<Dados['tarefaCriar']>[0]> = {}) => SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra });
      const compromissoNovo = (extra: Partial<Parameters<Dados['compromissoCriar']>[0]> = {}) =>
        SD.compromissoCriar({ tipo: 'reuniao', titulo: marca(), data: '2026-12-10', hora: '14:30', responsavel_id: 'u-master', ...extra });
      const processoNovo = async (extra: Partial<Parameters<Dados['processoCriar']>[0]> = {}) => {
        const { id: cliente } = await criar(marca());
        return SD.processoCriar({ tipo: 'administrativo', numero: marca(), responsavel_id: 'u-master', clientes: [cliente], ...extra });
      };
      const contratoNovo = async (servico = marca()) => {
        const { id: cliente } = await criar(marca());
        return SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: [servico], servico, categoria: 'pro_labore' });
      };
      const ids = (lista: { id: string }[]) => lista.map(x => x.id);

      it('dada uma pessoa, quando busca demandas para ligar, então vêm as ativas que ainda não a têm como cliente, com os clientes de cada uma', async () => {
        // Dado
        const m = marca(), { id: pessoa } = await criar(marca()), { id: outra } = await criar(marca());
        const livre = await demandaNova({ titulo: m + ' livre', clientes: [outra] });
        const dela = await demandaNova({ titulo: m + ' dela', clientes: [pessoa] });
        const arquivada = await demandaNova({ titulo: m + ' arquivada' });
        await SD.demandasArquivar([arquivada.id]);
        // Quando
        const achadas = await SD.demandasParaLigar({ termo: m, semAPessoa: pessoa });
        // Então
        expect(achadas).toEqual([expect.objectContaining({ id: livre.id, titulo: m + ' livre', clientes: [outra], contrato_id: null })]);
        expect(ids(await SD.demandasParaLigar({ termo: m }))).toEqual(expect.arrayContaining([livre.id, dela.id]));
      });

      it('dado um contrato, quando busca demandas sem contrato, então a que já tem contrato e as já ligadas ao cartão ficam fora', async () => {
        // Dado
        const m = marca(), k = await contratoNovo();
        const solta = await demandaNova({ titulo: m + ' solta' });
        await demandaNova({ titulo: m + ' do contrato', contrato_id: k.id });
        const fora = await demandaNova({ titulo: m + ' fora' });
        // Quando
        const achadas = await SD.demandasParaLigar({ termo: m, sem: 'contratos', fora: [fora.id] });
        // Então
        expect(ids(achadas)).toEqual([solta.id]);
      });

      it('quando busca para ligar sem texto, então vêm no máximo o limite', async () => {
        // Dado
        for (let i = 0; i <= ITENS_PARA_LIGAR; i++) await demandaNova();
        // Quando
        const achadas = await SD.demandasParaLigar({});
        // Então
        expect(achadas).toHaveLength(ITENS_PARA_LIGAR);
      });

      it('dadas tarefas com e sem demanda, contrato e processo, quando busca as que não têm cada um, então só vêm as que não têm', async () => {
        // Dado
        const m = marca(), d = await demandaNova(), k = await contratoNovo(), p = await processoNovo();
        const solta = await tarefaNova({ titulo: m + ' solta' });
        const naDemanda = await tarefaNova({ titulo: m + ' na demanda', demanda_id: d.id });
        const noContrato = await tarefaNova({ titulo: m + ' no contrato', contrato_id: k.id });
        const noProcesso = await tarefaNova({ titulo: m + ' no processo', processo_id: p.id });
        // Quando
        const sem = {
          demandas: ids(await SD.tarefasParaLigar({ termo: m, sem: 'demandas' })),
          contratos: ids(await SD.tarefasParaLigar({ termo: m, sem: 'contratos' })),
          processos: ids(await SD.tarefasParaLigar({ termo: m, sem: 'processos' }))
        };
        // Então
        expect(new Set(sem.demandas)).toEqual(new Set([solta.id, noContrato.id, noProcesso.id]));
        expect(new Set(sem.contratos)).toEqual(new Set([solta.id, naDemanda.id, noProcesso.id]));
        expect(new Set(sem.processos)).toEqual(new Set([solta.id, naDemanda.id, noContrato.id]));
      });

      it('dado um prazo do processo, quando busca a tarefa que o cumpre, então vêm as deste processo e as sem processo, nunca as de outro processo', async () => {
        // Dado
        const m = marca(), p = await processoNovo(), outro = await processoNovo();
        const deste = await tarefaNova({ titulo: m + ' deste', processo_id: p.id });
        const semProcesso = await tarefaNova({ titulo: m + ' sem processo' });
        await tarefaNova({ titulo: m + ' de outro', processo_id: outro.id });
        // Quando
        const achadas = await SD.tarefasParaLigar({ termo: m, doProcesso: p.id });
        // Então
        expect(new Set(ids(achadas))).toEqual(new Set([deste.id, semProcesso.id]));
      });

      it('dada uma tarefa numa demanda de um contrato, quando aparece na busca, então traz o contrato da demanda e as pessoas', async () => {
        // Dado
        const m = marca(), k = await contratoNovo(), { id: pessoa } = await criar(marca());
        const d = await demandaNova({ contrato_id: k.id });
        const t = await tarefaNova({ titulo: m, demanda_id: d.id, pessoas: [pessoa] });
        // Quando
        const [achada] = await SD.tarefasParaLigar({ termo: m });
        // Então
        expect(achada).toMatchObject({ id: t.id, demanda_id: d.id, contrato_da_demanda: k.id, pessoas: [pessoa] });
        expect(await SD.tarefasParaLigar({ termo: m, semAPessoa: pessoa })).toEqual([]);
      });

      it('dados compromissos com e sem processo, quando busca os sem processo e sem a pessoa, então só vem o que não tem nenhum dos dois', async () => {
        // Dado
        const m = marca(), p = await processoNovo(), { id: pessoa } = await criar(marca());
        const solto = await compromissoNovo({ titulo: m + ' solto' });
        await compromissoNovo({ titulo: m + ' do processo', processo_id: p.id });
        await compromissoNovo({ titulo: m + ' com ela', pessoas: [pessoa] });
        // Quando
        const achados = await SD.compromissosParaLigar({ termo: m, sem: 'processos', semAPessoa: pessoa });
        // Então
        expect(achados).toEqual([expect.objectContaining({ id: solto.id, titulo: m + ' solto', tipo: 'reuniao', pessoas: [], processo_id: null })]);
      });

      it('dada uma pessoa, quando busca processos para pô-la como cliente, então vêm os que ainda não a têm, com os clientes de cada um', async () => {
        // Dado
        const m = marca(), { id: pessoa } = await criar(marca());
        const livre = await processoNovo({ titulo: m + ' livre' });
        await processoNovo({ titulo: m + ' dela', clientes: [pessoa] });
        // Quando
        const achados = await SD.processosParaPorCliente({ termo: m, semAPessoa: pessoa });
        // Então
        expect(achados).toEqual([expect.objectContaining({ id: livre.id, titulo: m + ' livre', clientes: [expect.any(String)] })]);
      });

      it('dado um processo, quando busca contratos para ligar, então vêm os ativos, fora os já ligados e os arquivados', async () => {
        // Dado
        const m = marca(), ligado = await contratoNovo(m + ' ligado'), livre = await contratoNovo(m + ' livre'), arquivado = await contratoNovo(m + ' arquivado');
        await SD.contratosArquivar([arquivado.id]);
        // Quando
        const achados = await SD.contratosParaLigar({ termo: m, fora: [ligado.id] });
        // Então
        expect(achados).toEqual([expect.objectContaining({ id: livre.id, servico: m + ' livre', codigo: livre.codigo })]);
      });
    });

    describe('Sessão', () => {
      it('dada uma sessão ativa, quando confere com o login, então ela não está encerrada', async () => {
        // Quando / Então
        expect(await SD.sessaoEncerrada()).toBe(false);
      });

      it('quando a pessoa sai, então não há mais sessão nem contexto', async () => {
        // Quando
        await SD.sair();
        // Então
        expect(await SD.sessao()).toBeNull();
        expect(await SD.contexto()).toBeNull();
      });
    });
  });
}

// O banco fictício guarda tudo na sessão da aba: cada caso começa com ele zerado.
contrato('banco fictício', async () => {
  sessionStorage.clear();
  vi.resetModules();
  return (await import('./falso')).SD;
});


// A troca de conta só existe no banco fictício; no banco de verdade, a regra é provada em supabase/tests/anotacoes.test.sql.
describe('Visibilidade das anotações (banco fictício)', () => {
  let SD: Dados;
  const SEM_PERMISSAO = 'Você não tem permissão para fazer isso.';
  const falso = () => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void; equipeVeTudo(l: boolean): void } }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  const marca = () => 'ANOTACAO ' + Math.random().toString(36).slice(2, 8).toUpperCase();
  /** Criada pelo master, de que ele é o responsável. */
  const doMaster = (extra: Partial<Parameters<Dados['anotacaoCriar']>[0]> = {}, ligarA?: Parameters<Dados['anotacaoCriar']>[1]) =>
    SD.anotacaoCriar({ titulo: marca(), responsavel_id: 'u-master', ...extra }, ligarA);
  const vejo = async (id: string) => (await SD.anotacaoObter(id)) !== null;
  const naLista = async (id: string) => (await SD.anotacoesListar({ porPagina: 100 })).linhas.some(a => a.id === id);

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
  });
  afterEach(async () => { entrarComo('u-master'); await SD.faseDeAdaptacaoDefinir(false); falso().equipeVeTudo(false); });

  it('dada uma etiqueta criada pela Ana, quando o Bruno abre a escolha de etiquetas, então ela aparece para ele também (#342)', async () => {
    // Dado
    entrarComo('u-ana');
    const texto = marca();
    const { id } = await SD.etiquetaCriar('verde', texto);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect((await SD.etiquetasListar()).find(e => e.id === id)).toMatchObject({ texto, criado_por: 'u-ana' });
  });

  it('dada uma anotação do master com etiqueta numa pasta, quando a conta comum de fora entra, então vê a pasta, mas não as etiquetas da anotação, não aplica e não apaga a pasta (#342)', async () => {
    // Dado
    const pasta = await SD.pastaCriar(marca(), null);
    const { id: etiqueta } = await SD.etiquetaCriar('azul', marca());
    const { id } = await SD.anotacaoCriar({ titulo: marca(), responsavel_id: 'u-master', pasta_id: pasta.id }, undefined, [etiqueta]);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect((await SD.pastasListar()).map(p => p.id)).toContain(pasta.id);
    expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([]);
    await expect(SD.etiquetaAplicar('anotacoes', id, etiqueta)).rejects.toThrow(SEM_PERMISSAO);
    await SD.etiquetaTirar('anotacoes', id, etiqueta);
    await expect(SD.pastaExcluir(pasta.id)).rejects.toThrow('Esvazie a pasta antes de apagá-la');
    entrarComo('u-master');
    expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([etiqueta]);
  });

  it('dada uma anotação que a conta comum vê só pela demanda, quando ela tenta mudar as etiquetas, então vê, mas não aplica nem tira (#342)', async () => {
    // Dado
    const { id: demanda } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
    const { id: etiqueta } = await SD.etiquetaCriar('roxo', marca());
    const { id: outra } = await SD.etiquetaCriar('rosa', marca());
    const { id } = await doMaster({}, { modulo: 'demandas', id: demanda });
    await SD.etiquetaAplicar('anotacoes', id, etiqueta);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([etiqueta]);
    await expect(SD.etiquetaAplicar('anotacoes', id, outra)).rejects.toThrow(SEM_PERMISSAO);
    await SD.etiquetaTirar('anotacoes', id, etiqueta);
    expect(await SD.etiquetasDoCartao('anotacoes', id)).toEqual([etiqueta]);
  });

  it('dada uma anotação do master, quando uma conta comum de fora a procura, então ela não aparece em lugar nenhum', async () => {
    // Dado
    const { id: demanda } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    const { id } = await doMaster({}, { modulo: 'demandas', id: demanda });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await vejo(id)).toBe(false);
    expect(await naLista(id)).toBe(false);
    expect(await SD.anotacoesDoItem('demandas', demanda)).toEqual([]);
    expect(await SD.anotacaoItens(id)).toEqual({ visiveis: [], ocultos: 0 });
    expect(await SD.anotacaoHistorico(id)).toEqual([]);
    await expect(SD.anotacaoAtualizar(id, { texto: 'mexi' })).rejects.toThrow(SEM_PERMISSAO);
    await expect(SD.anotacaoGravarTexto(id, 'mexi', new Date().toISOString())).rejects.toThrow(SEM_PERMISSAO);
  });

  it('dada uma anotação comentada pelo master, quando a conta comum de fora a procura, então não lê nem comenta (#364)', async () => {
    // Dado
    const { id } = await doMaster();
    await SD.comentarioCriar('anotacoes', id, 'Só para quem vê');
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await SD.comentariosListar('anotacoes', id)).toEqual([]);
    // A recusa de sempre das regras de acesso, como no banco de verdade e em todos os módulos (#365)
    await expect(SD.comentarioCriar('anotacoes', id, 'Entrei')).rejects.toThrow(SEM_PERMISSAO);
    entrarComo('u-master');
    expect((await SD.comentariosListar('anotacoes', id)).map(c => c.texto)).toEqual(['Só para quem vê']);
  });

  it('dada uma anotação que a conta comum vê só pela demanda, quando ela entra, então lê e comenta, mas não altera a anotação (#364)', async () => {
    // Dado
    const { id: demanda } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
    const { id } = await doMaster({}, { modulo: 'demandas', id: demanda });
    await SD.comentarioCriar('anotacoes', id, 'Do master');
    // Quando
    entrarComo('u-bruno');
    const meu = await SD.comentarioCriar('anotacoes', id, 'Do Bruno, @mauro.duarte');
    // Então
    expect((await SD.comentariosListar('anotacoes', id)).map(c => c.texto)).toEqual(['Do Bruno, @mauro.duarte', 'Do master']);
    await expect(SD.anotacaoAtualizar(id, { texto: 'mexi' })).rejects.toThrow(SEM_PERMISSAO);
    // E quem foi mencionado recebe a mensagem, que leva à anotação no comentário
    entrarComo('u-master');
    expect((await SD.mensagensListar()).find(m => m.comentario?.id === meu.id)?.comentario).toMatchObject({ modulo: 'anotacoes', cartao_id: id });
  });

  it('dada uma anotação compartilhada com a conta comum, quando ela entra, então vê e altera, mas não exclui a arquivada', async () => {
    // Dado
    const { id } = await doMaster({ participantes: ['u-bruno'] });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await vejo(id)).toBe(true);
    await SD.anotacaoAtualizar(id, { texto: 'mexi' });
    expect((await SD.anotacaoObter(id))!.texto).toBe('mexi');
    await SD.anotacoesArquivar([id]);
    expect(await SD.anotacoesExcluir([id])).toMatchObject({ excluidas: 0, naoExcluidas: 1 });
  });

  it('dada uma anotação ligada a uma pessoa, quando a conta comum entra, então a ligação à pessoa não a abre', async () => {
    // Dado
    const { id: pessoa } = await SD.pessoaCriar({ tipo: 'pf', nome: marca() });
    const { id } = await doMaster({}, { modulo: 'pessoas', id: pessoa });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await vejo(id)).toBe(false);
    expect(await SD.anotacoesDoItem('pessoas', pessoa)).toEqual([]);
  });

  it('dada uma anotação ligada a uma demanda em que a conta comum colabora, quando ela entra, então vê a anotação, mas só lê', async () => {
    // Dado
    const { id: demanda } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
    const { id: outra } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
    const { id } = await doMaster({}, { modulo: 'demandas', id: demanda });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await vejo(id)).toBe(true);
    expect(await naLista(id)).toBe(true);
    expect((await SD.anotacoesDoItem('demandas', demanda)).map(a => a.id)).toEqual([id]);
    expect((await SD.anotacaoItens(id)).visiveis.map(i => i.id)).toEqual([demanda]);
    await expect(SD.anotacaoAtualizar(id, { texto: 'mexi' })).rejects.toThrow(SEM_PERMISSAO);
    await expect(SD.anotacaoLigar(id, 'demandas', outra)).rejects.toThrow(SEM_PERMISSAO);
    await expect(SD.anotacaoDesligar(id, 'demandas', demanda)).rejects.toThrow(SEM_PERMISSAO);
    await expect(SD.anotacoesArquivar([id])).rejects.toThrow(SEM_PERMISSAO);
  });

  it('dada uma anotação ligada a uma demanda que a conta comum vê e a outra que não vê, quando ela duplica, então a cópia é dela e só leva a que ela vê', async () => {
    // Dado
    const { id: minha } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
    const { id: alheia } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-ana' });
    const { id } = await doMaster({ texto: 'Plano' }, { modulo: 'demandas', id: minha });
    await SD.anotacaoLigar(id, 'demandas', alheia);
    entrarComo('u-bruno');
    const original = (await SD.anotacaoObter(id))!;
    // Quando
    const copia = await SD.anotacaoDuplicar(id, dadosDaCopia(original, { id: 'u-bruno', alteraAOriginal: false, equipe: [{ id: 'u-master' }, { id: 'u-bruno' }] }));
    // Então
    expect(await SD.anotacaoObter(copia.id)).toMatchObject({ texto: 'Plano', responsavel_id: 'u-bruno', criado_por: 'u-bruno' });
    expect(await SD.anotacaoItens(copia.id)).toEqual({ visiveis: [expect.objectContaining({ id: minha })], ocultos: 0 });
    entrarComo('u-master');
    expect((await SD.anotacaoItens(id)).visiveis.map(i => i.id)).toEqual([minha, alheia]);
  });

  it('dada a anotação de quem é participante, quando liga uma demanda que ele não vê, então é recusado; e o item que não vê conta como oculto', async () => {
    // Dado
    const { id: alheia } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    const { id: outra } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-ana' });
    const { id } = await doMaster({ participantes: ['u-bruno'] }, { modulo: 'demandas', id: alheia });
    // Quando
    entrarComo('u-bruno');
    // Então
    await expect(SD.anotacaoLigar(id, 'demandas', alheia)).resolves.toBe(false);   // já ligada: não faz nada
    expect(await SD.anotacaoItens(id)).toEqual({ visiveis: [], ocultos: 1 });
    await expect(SD.anotacaoLigar(id, 'demandas', outra)).rejects.toThrow(SEM_PERMISSAO);
  });

  it('dada uma demanda que a conta comum não vê, quando ela busca itens para ligar, então a demanda não é oferecida', async () => {
    // Dado
    const m = marca();
    const { id: minha } = await SD.demandaCriar({ titulo: m + ' minha', responsavel_id: 'u-bruno' });
    await SD.demandaCriar({ titulo: m + ' alheia', responsavel_id: 'u-ana' });
    // Quando
    entrarComo('u-bruno');
    const achados = await SD.itensParaLigar('demandas', m);
    // Então
    expect(achados.map(i => i.id)).toEqual([minha]);
  });

  it('dadas anotações que a conta comum só lê, quando ela busca anotações para ligar a um item, então só vêm as que ela altera; na fase de adaptação, todas (#341)', async () => {
    // Dado: uma compartilhada com ela, uma que ela vê só pela demanda em que colabora, e a chave de ver tudo ligada
    const m = marca();
    const { id: demanda } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', colaboradores: ['u-bruno'] });
    const { id: pessoa } = await SD.pessoaCriar({ tipo: 'pf', nome: marca() });
    const { id: comEla } = await doMaster({ titulo: m + ' com ela', participantes: ['u-bruno'] });
    const { id: soLe } = await doMaster({ titulo: m + ' só lê' }, { modulo: 'demandas', id: demanda });
    const { id: alheia } = await doMaster({ titulo: m + ' alheia' });
    falso().equipeVeTudo(true);
    // Quando
    entrarComo('u-bruno');
    const achadas = await SD.anotacoesParaLigar('pessoas', pessoa, m);
    // Então
    expect(achadas.map(a => a.id)).toEqual([comEla]);
    expect(await vejo(soLe)).toBe(true);
    // Quando: a fase de adaptação abre a edição de todas
    entrarComo('u-master');
    await SD.faseDeAdaptacaoDefinir(true);
    entrarComo('u-bruno');
    // Então
    expect(new Set((await SD.anotacoesParaLigar('pessoas', pessoa, m)).map(a => a.id))).toEqual(new Set([comEla, soLe, alheia]));
  });

  it('dada a chave "equipe_ve_tudo", quando a conta comum entra, então vê a anotação alheia, mas só lê', async () => {
    // Dado
    const { id } = await doMaster();
    falso().equipeVeTudo(true);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await vejo(id)).toBe(true);
    await expect(SD.anotacaoAtualizar(id, { texto: 'mexi' })).rejects.toThrow(SEM_PERMISSAO);
  });

  it('dada a fase de adaptação (toda a equipe edita tudo), quando a conta comum entra, então altera a anotação alheia', async () => {
    // Dado
    const { id } = await doMaster();
    await SD.faseDeAdaptacaoDefinir(true);
    // Quando
    entrarComo('u-bruno');
    await SD.anotacaoAtualizar(id, { texto: 'mexi' });
    // Então
    expect((await SD.anotacaoObter(id))!.texto).toBe('mexi');
  });

  it('dada a chave "equipe_ve_tudo" sem a de editar, quando a conta comum liga um compromisso privado em que não está, então ele não é oferecido, é recusado e conta como oculto (o banco não abre compromissos com essa chave)', async () => {
    // Dado
    const m = marca();
    const { id: compromisso } = await SD.compromissoCriar({ tipo: 'reuniao', titulo: m, data: '2030-01-15', hora: '14:30', responsavel_id: 'u-master' });
    const { id } = await doMaster({ participantes: ['u-bruno'] });
    falso().equipeVeTudo(true);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect((await SD.itensParaLigar('compromissos', m)).map(i => i.id)).toEqual([]);
    await expect(SD.anotacaoLigar(id, 'compromissos', compromisso)).rejects.toThrow(SEM_PERMISSAO);
    // E, ligado pelo master, ele aparece para a conta comum como oculto
    entrarComo('u-master');
    await SD.anotacaoLigar(id, 'compromissos', compromisso);
    entrarComo('u-bruno');
    expect(await SD.anotacaoItens(id)).toEqual({ visiveis: [], ocultos: 1 });
  });

  it('dada uma demanda da conta comum e muitas mais novas de outra pessoa, quando ela busca demandas para ligar sem texto, então a dela aparece', async () => {
    // Dado
    const { id: minha } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-bruno' });
    for (let i = 0; i < ITENS_PARA_LIGAR + 2; i++) await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-ana' });
    // Quando
    entrarComo('u-bruno');
    const achados = await SD.itensParaLigar('demandas', '');
    // Então
    expect(achados.map(i => i.id)).toContain(minha);
    expect(achados.length).toBeLessThanOrEqual(ITENS_PARA_LIGAR);
  });

  it('dado um participante de uma anotação sem item ligado, quando ele se tira de "Compartilhar com" gravando a anotação, então é recusado, como no banco; pelo caminho de sair, ele sai e a saída fica no histórico', async () => {
    // Dado
    const { id } = await doMaster({ participantes: ['u-bruno'] });
    entrarComo('u-bruno');
    // Quando / Então
    await expect(SD.anotacaoAtualizar(id, { participantes: [] })).rejects.toThrow(SEM_PERMISSAO);
    // Quando
    await SD.cartaoSair('anotacoes', id);
    // Então
    expect(await vejo(id)).toBe(false);
    entrarComo('u-master');
    expect((await SD.anotacaoObter(id))!.participantes).toEqual([]);
    expect((await SD.anotacaoHistorico(id))[0]).toMatchObject({ feito_por: 'u-bruno', alteracoes: { participantes: { para: null } } });
  });

  it('dado o responsável de uma anotação sem item ligado, quando a passa a outra pessoa sem ficar nela, então é recusado; ficando como participante, grava, e depois sai', async () => {
    // Dado
    const { id } = await doMaster({ responsavel_id: 'u-bruno' });
    entrarComo('u-bruno');
    // Quando / Então
    await expect(SD.anotacaoAtualizar(id, { responsavel_id: 'u-ana', participantes: [] })).rejects.toThrow(SEM_PERMISSAO);
    // Quando
    await SD.anotacaoAtualizar(id, { responsavel_id: 'u-ana', participantes: ['u-bruno'] });
    await SD.cartaoSair('anotacoes', id);
    // Então
    expect(await vejo(id)).toBe(false);
  });

  it('dada uma anotação arquivada de outra conta, quando um administrador a exclui, então ela sai', async () => {
    // Dado
    entrarComo('u-bruno');
    const { id } = await SD.anotacaoCriar({ titulo: marca(), responsavel_id: 'u-bruno' });
    await SD.anotacoesArquivar([id]);
    // Quando
    entrarComo('u-ana');
    const r = await SD.anotacoesExcluir([id]);
    // Então
    expect(r).toMatchObject({ excluidas: 1, naoExcluidas: 0 });
  });
});
// A troca de conta só existe no banco fictício: a regra de quem altera cada item é a das regras de alterar do banco de verdade.
describe('Ligar a um cartão um item que já existe: só o que a pessoa altera (banco fictício, #341)', () => {
  let SD: Dados;
  const falso = () => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void; equipeVeTudo(l: boolean): void } }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  const marca = () => 'LIGAR ' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const ids = async (lista: Promise<{ id: string }[]>) => new Set((await lista).map(x => x.id));

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
  });
  afterEach(async () => { entrarComo('u-master'); await SD.faseDeAdaptacaoDefinir(false); falso().equipeVeTudo(false); });

  it('dados itens do master, um deles com a conta comum na equipe, quando ela busca para ligar, então só vem o dela; na fase de adaptação, todos', async () => {
    // Dado: em cada módulo, um item em que Bruno está e outro só do master
    const m = marca(), { id: cliente } = await SD.pessoaCriar({ tipo: 'pf', nome: marca() });
    const demandas = [await SD.demandaCriar({ titulo: m, responsavel_id: 'u-master', colaboradores: ['u-bruno'] }), await SD.demandaCriar({ titulo: m, responsavel_id: 'u-master' })];
    const tarefas = [await SD.tarefaCriar({ titulo: m, responsavel_id: 'u-master', participantes: ['u-bruno'] }), await SD.tarefaCriar({ titulo: m, responsavel_id: 'u-master' })];
    const compromissos = [
      await SD.compromissoCriar({ tipo: 'reuniao', titulo: m, data: '2026-12-10', hora: '10:00', responsavel_id: 'u-bruno' }),
      await SD.compromissoCriar({ tipo: 'reuniao', titulo: m, data: '2026-12-10', hora: '10:00', responsavel_id: 'u-master' })
    ];
    const processos = [
      await SD.processoCriar({ tipo: 'administrativo', numero: marca(), titulo: m, responsavel_id: 'u-master', colaboradores: ['u-bruno'], clientes: [cliente] }),
      await SD.processoCriar({ tipo: 'administrativo', numero: marca(), titulo: m, responsavel_id: 'u-master', clientes: [cliente] })
    ];
    // O contrato dele: ele criou (o responsável é sempre um advogado).
    entrarComo('u-bruno');
    const doBruno = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: [m], servico: m, categoria: 'pro_labore' });
    entrarComo('u-master');
    const contratos = [doBruno, await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: [m], servico: m, categoria: 'pro_labore' })];
    const buscar = () => [
      ids(SD.demandasParaLigar({ termo: m })), ids(SD.tarefasParaLigar({ termo: m })), ids(SD.compromissosParaLigar({ termo: m })),
      ids(SD.processosParaPorCliente({ termo: m })), ids(SD.contratosParaLigar({ termo: m }))
    ];
    const todos = [demandas, tarefas, compromissos, processos, contratos];
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await Promise.all(buscar())).toEqual(todos.map(([dele]) => new Set([dele.id])));
    // Quando: a fase de adaptação abre a edição de tudo
    entrarComo('u-master');
    falso().equipeVeTudo(true);
    await SD.faseDeAdaptacaoDefinir(true);
    entrarComo('u-bruno');
    // Então
    expect(await Promise.all(buscar())).toEqual(todos.map(lista => new Set(lista.map(x => x.id))));
  });
});

// A troca de conta só existe no banco fictício; no banco de verdade, a regra é provada em supabase/tests/visibilidade_contratos.test.sql.
describe('Visibilidade dos contratos (banco fictício)', () => {
  let SD: Dados;
  const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
  const novoContrato = (extra: Parameters<Dados['contratoCriar']>[0] = {}) => SD.contratoCriar(
    { clientes: ['p-ana'], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore', ...extra });
  const idsDosContratos = async () => (await SD.contratosListar({ porPagina: 100 })).linhas.map(k => k.id);
  const reabrir = async () => { vi.resetModules(); return (await import('./falso')).SD; };
  /** A menção entra direto na aba: pela tela, o banco fictício recusa mencionar um estagiário num contrato, e a única conta comum dele é o Bruno. */
  const mencionar = (contrato: string, mencionado: string, autor: string) => {
    const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { comentarios: unknown[] };
    const id = 'cm-' + Math.random().toString(36).slice(2);
    bd.comentarios.push({ id, modulo: 'contratos', cartao_id: contrato, autor_id: autor, texto: 'Veja este', mencoes: [mencionado], criado_em: new Date().toISOString(), editado_em: null });
    sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    return id;
  };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
  });

  it('dada uma conta comum, quando lê o contexto, então ela não é administradora', async () => {
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await SD.contexto()).toMatchObject({ usuario: { id: 'u-bruno' }, perfil: { papel: 'usuario', nome: 'Bruno Exemplo Souza' }, ehAdmin: false, ehMaster: false });
  });

  it('dado um contrato alheio, quando a conta comum o procura, então ele não aparece em lugar nenhum', async () => {
    // Dado
    const { id, codigo } = await novoContrato({ codigo_antigo: 'SIGILOSO-1' });
    const comentario = await SD.comentarioCriar('contratos', id, 'Valor combinado');
    await SD.contratoAtualizar(id, { observacoes: 'alterado' });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await idsDosContratos()).not.toContain(id);
    expect((await SD.contratosListar({ termo: 'SIGILOSO-1' })).total).toBe(0);
    expect((await SD.contratosListar({ termo: codigo })).total).toBe(0);
    expect(await SD.contratoObter(id)).toBeNull();
    expect(await SD.contratoHistorico(id)).toEqual([]);
    expect(await SD.comentariosListar('contratos', id)).not.toContainEqual(expect.objectContaining({ id: comentario.id }));
    expect((await SD.contratosDaPessoa('p-ana')).map(k => k.id)).not.toContain(id);
  });

  it('dado um contrato alheio, quando a conta comum tenta mexer nele, então é recusado e ele não muda', async () => {
    // Dado
    const { id } = await novoContrato();
    // Quando
    entrarComo('u-bruno');
    // Então
    await expect(SD.contratoAtualizar(id, { observacoes: 'alterado' })).rejects.toThrow('Contrato não encontrado.');
    // A recusa de sempre das regras de acesso, como no banco (#365): antes era "Este cartão não foi encontrado.", só no banco fictício.
    await expect(SD.comentarioCriar('contratos', id, 'Oi')).rejects.toThrow('Você não tem permissão para fazer isso.');
    await SD.contratosArquivar([id]);
    entrarComo('u-master');
    expect(await SD.contratoObter(id)).toMatchObject({ arquivado_em: null, observacoes: null });
  });

  it('dada uma conta comum que participa do contrato, quando o abre, então vê', async () => {
    // Dado
    const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await idsDosContratos()).toContain(id);
    expect((await SD.contratoObter(id))?.id).toBe(id);
  });

  it('dada uma conta comum que criou o contrato, sem ser responsável, quando o abre, então vê', async () => {
    // Dado
    entrarComo('u-bruno');
    // Quando
    const { id } = await novoContrato();
    // Então
    expect((await SD.contratoObter(id))?.responsavel_id).toBe('u-master');
    expect(await idsDosContratos()).toContain(id);
  });

  it('dado um administrador, quando abre os contratos, então vê também os que não são dele', async () => {
    // Dado
    const { id } = await novoContrato();
    // Quando
    entrarComo('u-ana');
    // Então
    expect(await idsDosContratos()).toContain(id);
  });

  it('dada uma participante, quando ela mesma se tira da lista, então é recusado; quando um administrador a tira, então ela deixa de ver', async () => {
    // Dado
    const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
    entrarComo('u-bruno');
    // Quando / Então
    await expect(SD.contratoAtualizar(id, { participantes: [] })).rejects.toThrow('Você não tem permissão para fazer isso.');
    expect((await SD.contratoObter(id))?.participantes).toHaveLength(1);
    // Quando
    entrarComo('u-master');
    await SD.contratoAtualizar(id, { participantes: [] });
    entrarComo('u-bruno');
    // Então
    expect(await SD.contratoObter(id)).toBeNull();
  });

  it('dada uma conta que outra pessoa mencionou num contrato alheio, quando o abre, então lê e comenta, mas não altera; sem a menção, deixa de ver', async () => {
    // Dado
    const { id } = await novoContrato();
    const mencao = mencionar(id, 'u-bruno', 'u-ana');
    SD = await reabrir();
    entrarComo('u-bruno');
    // Quando / Então
    expect(await idsDosContratos()).toContain(id);
    expect((await SD.contratoObter(id))?.id).toBe(id);
    await expect(SD.comentarioCriar('contratos', id, 'Obrigado')).resolves.toMatchObject({ texto: 'Obrigado' });
    await expect(SD.contratoAtualizar(id, { observacoes: 'alterado' })).rejects.toThrow('Você não tem permissão para fazer isso.');
    await expect(SD.contratoMover(id, null, 1)).rejects.toThrow('Você não tem permissão para fazer isso.');
    await SD.contratosArquivar([id]);
    expect((await SD.contratoObter(id))?.arquivado_em).toBeNull();
    // Quando
    entrarComo('u-ana');
    await SD.comentarioExcluir(mencao);
    entrarComo('u-bruno');
    // Então
    expect(await SD.contratoObter(id)).toBeNull();
  });

  it('dada uma conta que mencionou a si mesma, quando sai do contrato, então não vê mais', async () => {
    // Dado
    const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
    mencionar(id, 'u-bruno', 'u-bruno');
    SD = await reabrir();
    await SD.contratoAtualizar(id, { participantes: [] });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await SD.contratoObter(id)).toBeNull();
  });

  it('dada uma conta que não vê mais o contrato, quando edita um comentário dela nele, então é recusado', async () => {
    // Dado
    const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
    entrarComo('u-bruno');
    const { id: comentario } = await SD.comentarioCriar('contratos', id, 'Antigo');
    entrarComo('u-master');
    await SD.contratoAtualizar(id, { participantes: [] });
    // Quando
    entrarComo('u-bruno');
    // Então
    await expect(SD.comentarioEditar(comentario, 'Veja, @ana.lima')).rejects.toThrow('Só quem escreveu o comentário pode editá-lo.');
  });

  // No banco fictício, as listagens de demandas e tarefas ainda mostram tudo; a regra vale onde ele já confere quem vê (anotações,
  // mensagens e prazos). No banco de verdade, a regra é provada em supabase/tests/contrato_abre_demandas.test.sql.
  describe('Quem está no contrato vê as demandas e as tarefas dele (#326)', () => {
    /** Uma demanda e uma tarefa (ligada à demanda) do contrato, do master, cada uma com uma anotação do master ligada a ela. */
    const doContrato = async (contrato: string) => {
      const { id: demanda } = await SD.demandaCriar({ titulo: 'Demanda do contrato', responsavel_id: 'u-master', contrato_id: contrato });
      const { id: tarefa } = await SD.tarefaCriar({ titulo: 'Tarefa da demanda', responsavel_id: 'u-master', demanda_id: demanda });
      const { id: daDemanda } = await SD.anotacaoCriar({ titulo: 'Sobre a demanda', responsavel_id: 'u-master' }, { modulo: 'demandas', id: demanda });
      const { id: daTarefa } = await SD.anotacaoCriar({ titulo: 'Sobre a tarefa', responsavel_id: 'u-master' }, { modulo: 'tarefas', id: tarefa });
      return { demanda, tarefa, daDemanda, daTarefa };
    };

    it('dado um participante do contrato, quando ele entra, então vê o que está nos cartões da demanda e da tarefa, mas não altera', async () => {
      // Dado
      const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
      const { demanda, tarefa, daDemanda, daTarefa } = await doContrato(id);
      // Quando
      entrarComo('u-bruno');
      // Então
      expect((await SD.anotacoesDoItem('demandas', demanda)).map(a => a.id)).toEqual([daDemanda]);
      expect((await SD.anotacoesDoItem('tarefas', tarefa)).map(a => a.id)).toEqual([daTarefa]);
      expect((await SD.anotacaoItens(daDemanda)).visiveis.map(i => i.id)).toEqual([demanda]);
      await expect(SD.anotacaoAtualizar(daDemanda, { texto: 'mexi' })).rejects.toThrow('Você não tem permissão para fazer isso.');
    });

    it('dado um participante que saiu do contrato, quando ele entra, então deixa de ver na hora', async () => {
      // Dado
      const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
      const { daDemanda, daTarefa } = await doContrato(id);
      await SD.contratoAtualizar(id, { participantes: [] });
      // Quando
      entrarComo('u-bruno');
      // Então
      expect(await SD.anotacaoObter(daDemanda)).toBeNull();
      expect(await SD.anotacaoObter(daTarefa)).toBeNull();
    });

    it('dada uma conta só mencionada no contrato, quando ela entra, então não vê o que está nas demandas e nas tarefas dele', async () => {
      // Dado
      const { id } = await novoContrato();
      const { daDemanda, daTarefa } = await doContrato(id);
      mencionar(id, 'u-bruno', 'u-ana');
      SD = await reabrir();
      // Quando
      entrarComo('u-bruno');
      // Então
      expect(await SD.anotacaoObter(daDemanda)).toBeNull();
      expect(await SD.anotacaoObter(daTarefa)).toBeNull();
    });

    it('dado um participante do contrato, quando o master o menciona na demanda e na tarefa dele, então é aceito e a mensagem abre o cartão; quem está fora é recusado', async () => {
      // Dado
      const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
      const { demanda, tarefa } = await doContrato(id);
      const { id: alheio } = await novoContrato();
      const { demanda: deOutro } = await doContrato(alheio);
      // Quando
      await SD.comentarioCriar('demandas', demanda, 'Veja, @bruno.souza');
      await SD.comentarioCriar('tarefas', tarefa, 'E esta, @bruno.souza');
      // Então
      await expect(SD.comentarioCriar('demandas', deOutro, 'Veja, @bruno.souza')).rejects.toThrow('Não é possível mencionar Bruno Exemplo Souza nesta demanda');
      entrarComo('u-bruno');
      const cartoes = (await SD.mensagensListar()).map(m => m.comentario?.cartao_id).filter(Boolean);
      expect(cartoes).toEqual(expect.arrayContaining([demanda, tarefa]));
    });

    it('dado quem criou o contrato, quando liga a demanda dele numa anotação sua, então pode (ele vê a demanda)', async () => {
      // Dado: Bruno cria o contrato, de que o master é o responsável; o master cria a demanda
      entrarComo('u-bruno');
      const { id } = await novoContrato();
      entrarComo('u-master');
      const { demanda } = await doContrato(id);
      entrarComo('u-bruno');
      const { id: minha } = await SD.anotacaoCriar({ titulo: 'Minha', responsavel_id: 'u-bruno' });
      // Quando
      await SD.anotacaoLigar(minha, 'demandas', demanda);
      // Então
      expect((await SD.anotacaoItens(minha)).visiveis.map(i => i.id)).toEqual([demanda]);
    });

    it('dado um participante do contrato, quando ele abre a demanda e a tarefa, então o contrato vem com quem está nele, e a lista de tarefas traz quem está na demanda', async () => {
      // Dado
      const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
      const { demanda, tarefa } = await doContrato(id);
      // Quando
      entrarComo('u-bruno');
      const lida = await SD.demandaObter(demanda), daTarefa = await SD.tarefaObter(tarefa);
      const naLista = (await SD.tarefasListar({ porPagina: 100 })).linhas.find(t => t.id === tarefa);
      // Então: só as pessoas (sem o %), para saber quem pode ser mencionado
      expect(lida?.contrato).toMatchObject({ id, participantes: ['p-bruno'] });
      expect(daTarefa?.demanda).toMatchObject({ contrato_id: id, contrato: { id, participantes: ['p-bruno'] } });
      // Desde a #378, quem está na demanda inclui os grupos da equipe dela (como o banco lê equipe_da_demanda).
      expect(naLista?.equipe_da_demanda).toEqual({ criado_por: 'u-master', responsavel_id: 'u-master', colaboradores: [], grupos: [], continua: false });
    });

    it('dada a demanda de um contrato que quem lê não pode abrir, quando ele abre a tarefa dela, então o contrato da demanda vem vazio', async () => {
      // Dado: o master põe o Bruno na tarefa de uma demanda de um contrato de que o Bruno não é parte
      const { id } = await novoContrato();
      const { id: tarefa } = await SD.tarefaCriar({ titulo: 'Com o Bruno', responsavel_id: 'u-bruno',
        demanda_id: (await doContrato(id)).demanda });
      // Quando
      entrarComo('u-bruno');
      // Então
      expect((await SD.tarefaObter(tarefa))?.demanda).toMatchObject({ contrato_id: id, contrato: null });
    });
  });

  describe('Toda a equipe vê os contratos, sem os valores (#271)', () => {
    const chave = (ligada: boolean) => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(ligada);
    afterEach(() => chave(false));

    it('dada a chave desligada, quando quem não é parte abre o contrato, então não vê nada', async () => {
      // Dado
      const { id } = await novoContrato();
      // Quando
      entrarComo('u-bruno');
      // Então
      expect(await SD.contratoVer(id)).toBeNull();
    });

    it('dada a chave ligada, quando quem não é parte abre o contrato, então vê o número e os clientes, sem o que é financeiro', async () => {
      // Dado
      const { id, codigo } = await novoContrato();
      chave(true);
      // Quando
      entrarComo('u-bruno');
      const k = await SD.contratoVer(id);
      // Então
      expect(k).toMatchObject({ ve_financeiro: false, codigo, categoria: null, valor: null, entrada: null, parcelas: null, descontos: null, primeiro_pagamento: null,
        percentual_escritorio: null, indicador: null, indicador_percentual: null, conta_destino_id: null, documento_url: null, observacoes: null });
      expect(k?.clientes.length).toBeGreaterThan(0);
      expect(k?.participantes.every(p => p.percentual === null)).toBe(true);
    });

    it('dada a chave ligada, quando quem não é parte lista os contratos, então a linha vem sem valor', async () => {
      // Dado
      const { id } = await novoContrato();
      chave(true);
      // Quando
      entrarComo('u-bruno');
      const linha = (await SD.contratosListar({ porPagina: 500 })).linhas.find(k => k.id === id);
      // Então
      expect(linha).toMatchObject({ ve_financeiro: false, valor: null, categoria: null });
    });

    it('dada a chave ligada, quando quem não é parte pede o contrato para editar, então não recebe', async () => {
      // Dado
      const { id } = await novoContrato();
      chave(true);
      // Quando
      entrarComo('u-bruno');
      // Então
      expect(await SD.contratoObter(id)).toBeNull();
    });

    it('dada a chave ligada, quando quem não é parte pede o histórico, então não recebe nada', async () => {
      // Dado
      const { id } = await novoContrato();
      chave(true);
      // Quando
      entrarComo('u-bruno');
      // Então
      expect(await SD.contratoHistorico(id)).toEqual([]);
    });

    it('dada a chave ligada, quando quem é parte abre o contrato, então vê tudo', async () => {
      // Dado
      const { id } = await novoContrato();
      chave(true);
      // Quando
      const k = await SD.contratoVer(id);
      // Então
      expect(k?.ve_financeiro).not.toBe(false);
      expect(k?.categoria).not.toBeNull();
    });

    it('dada a chave ligada, quando quem não é parte comenta no contrato, então o comentário fica', async () => {
      // Dado
      const { id } = await novoContrato();
      chave(true);
      // Quando
      entrarComo('u-bruno');
      await SD.comentarioCriar('contratos', id, 'Dúvida sobre este contrato');
      // Então
      expect((await SD.comentariosListar('contratos', id)).map(c => c.texto)).toContain('Dúvida sobre este contrato');
    });

    it('dada a chave ligada, quando quem só lê tenta mover ou arquivar a demanda, então nada muda', async () => {
      // Dado
      const demanda = await SD.demandaCriar({ titulo: 'Da Ana', responsavel_id: 'u-ana', clientes: ['p-ana'] });
      chave(true);
      // Quando
      entrarComo('u-bruno');
      // Então
      await expect(SD.demandaMover(demanda.id, null, null)).rejects.toThrow('permissão');
      expect(await SD.demandasArquivar([demanda.id], true)).toBe(0);
    });

    it('dada a chave ligada, quando quem só lê filtra por categoria, então os contratos alheios não aparecem', async () => {
      // Dado
      const { id } = await novoContrato();
      chave(true);
      // Quando
      entrarComo('u-bruno');
      const categoria = 'pro_labore';
      const linhas = (await SD.contratosListar({ categoria, porPagina: 500 })).linhas;
      // Então
      expect(linhas.map(k => k.id)).not.toContain(id);
    });

    it('dada a chave ligada, quando quem só lê procura o que ligar, então só vêm os cartões em que ele está', async () => {
      // Dado
      const { id } = await novoContrato();
      const demanda = await SD.demandaCriar({ titulo: 'Da Ana', responsavel_id: 'u-ana', clientes: ['p-ana'] });
      chave(true);
      // Quando
      entrarComo('u-bruno');
      const contratos = (await SD.contratosListar({ paraLigar: true, porPagina: 500 })).linhas.map(k => k.id);
      const demandas = (await SD.demandasListar({ paraLigar: true, porPagina: 500 })).linhas.map(d => d.id);
      // Então
      expect(contratos).not.toContain(id);
      expect(demandas).not.toContain(demanda.id);
    });

    describe('Fase de adaptação: toda a equipe edita tudo, menos o financeiro (#275)', () => {
      const ligar = (l: boolean) => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(l);
      afterEach(async () => { entrarComo('u-master'); await SD.faseDeAdaptacaoDefinir(false); ligar(false); });

      it('dado quem não é administrador, quando tenta ligar, então não consegue', async () => {
        // Quando
        entrarComo('u-bruno');
        // Então
        await expect(SD.faseDeAdaptacaoDefinir(true)).rejects.toThrow('Só um administrador');
      });

      it('dada a fase ligada, quando quem não está na demanda a move, então consegue', async () => {
        // Dado
        const demanda = await SD.demandaCriar({ titulo: 'Da Ana', responsavel_id: 'u-ana', clientes: ['p-ana'] });
        await SD.faseDeAdaptacaoDefinir(true);
        // Quando
        entrarComo('u-bruno');
        // Então
        await expect(SD.demandaMover(demanda.id, null, null)).resolves.toBeUndefined();
      });

      it('dada a fase ligada, quando quem não é parte altera o contrato, então muda o que não é valor, e o resto fica', async () => {
        // Dado
        const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-ana', percentual: 15 }] });
        await SD.faseDeAdaptacaoDefinir(true);
        // Quando
        entrarComo('u-bruno');
        await SD.contratoAlterarSemValores(id, { objetos: ['Novo objeto'] });
        entrarComo('u-master');
        const k = await SD.contratoVer(id);
        // Então
        expect(k?.objetos).toEqual(['Novo objeto']);
        expect(k?.participantes[0].percentual).toBe(15);
      });

      it('dada a fase ligada, quando quem não é parte move o contrato, então a situação muda', async () => {
        // Dado
        const { id } = await novoContrato();
        await SD.faseDeAdaptacaoDefinir(true);
        // Quando
        entrarComo('u-bruno');
        // Então
        await expect(SD.contratoMover(id, null, null)).resolves.toBeUndefined();
      });

      it('dada a fase desligada, quando alguém altera o contrato sem os valores, então não consegue', async () => {
        // Dado
        const { id } = await novoContrato();
        // Quando / Então
        await expect(SD.contratoAlterarSemValores(id, { objetos: ['x'] })).rejects.toThrow('permissão');
      });
    });

    describe('Sair do cartão (#276)', () => {
      it('dado um participante da tarefa, quando sai, então fica de fora e a saída vai para o histórico', async () => {
        // Dado
        const { id } = await SD.tarefaCriar({ titulo: 'Com o Bruno', responsavel_id: 'u-ana', participantes: ['u-bruno'] });
        // Quando
        entrarComo('u-bruno');
        await SD.cartaoSair('tarefas', id);
        entrarComo('u-master');
        // Então
        expect((await SD.tarefaObter(id))?.participantes).toEqual([]);
        expect(JSON.stringify(await SD.tarefaHistorico(id))).toContain('participantes');
        expect((await SD.tarefaObter(id))?.atualizado_por).toBe('u-bruno');
      });

      it('dado um colaborador da demanda, quando sai, então fica de fora', async () => {
        // Dado
        const { id } = await SD.demandaCriar({ titulo: 'Com o Bruno', responsavel_id: 'u-ana', colaboradores: ['u-bruno'], clientes: ['p-ana'] });
        // Quando
        entrarComo('u-bruno');
        await SD.cartaoSair('demandas', id);
        entrarComo('u-master');
        // Então
        expect((await SD.demandaObter(id))?.colaboradores).toEqual([]);
      });

      it('dado quem não está na tarefa, quando tenta sair, então a tela avisa e nada muda', async () => {
        // Dado
        const { id } = await SD.tarefaCriar({ titulo: 'Sem o Bruno', responsavel_id: 'u-ana' });
        // Quando
        entrarComo('u-bruno');
        // Então
        await expect(SD.cartaoSair('tarefas', id)).rejects.toThrow('não está entre as pessoas');
      });
    });

    describe('Na fase de adaptação, o advogado entra no processo (#273)', () => {
      const mudarFuncao = (id: string, funcao: string) => (window as unknown as { SEMPER_FALSO: { mudarFuncao(i: string, f: string): void } }).SEMPER_FALSO.mudarFuncao(id, funcao);
      afterEach(() => mudarFuncao('u-bruno', 'estagiario'));
      const processoDaAna = async () => (await SD.processoCriar({ tipo: 'judicial', numero: '123', responsavel_id: 'u-ana', clientes: ['p-ana'] })).id;

      it('dada a chave desligada, quando o advogado tenta entrar, então não consegue', async () => {
        // Dado
        const id = await processoDaAna();
        mudarFuncao('u-bruno', 'advogado');
        // Quando
        entrarComo('u-bruno');
        // Então
        await expect(SD.processoMeIncluir(id, 'colaborador')).rejects.toThrow('Só advogados');
      });

      it('dada a chave ligada, quando quem não é advogado tenta entrar, então não consegue', async () => {
        // Dado
        const id = await processoDaAna();
        chave(true);
        // Quando
        entrarComo('u-bruno');
        // Então
        await expect(SD.processoMeIncluir(id, 'colaborador')).rejects.toThrow('Só advogados');
      });

      it('dada a chave ligada, quando o advogado entra como colaborador, então aparece no processo e o responsável não muda', async () => {
        // Dado
        const id = await processoDaAna();
        chave(true);
        mudarFuncao('u-bruno', 'advogado');
        // Quando
        entrarComo('u-bruno');
        await SD.processoMeIncluir(id, 'colaborador');
        // Então
        expect(await SD.processoObter(id)).toMatchObject({ responsavel_id: 'u-ana', colaboradores: ['u-bruno'] });
      });

      it('dada a chave ligada, quando o advogado assume, então vira responsável e quem era continua como colaborador', async () => {
        // Dado
        const id = await processoDaAna();
        chave(true);
        mudarFuncao('u-bruno', 'advogado');
        // Quando
        entrarComo('u-bruno');
        await SD.processoMeIncluir(id, 'responsavel');
        // Então
        expect(await SD.processoObter(id)).toMatchObject({ responsavel_id: 'u-bruno', colaboradores: ['u-ana'] });
      });
    });

    it('dada a chave ligada, quando alguém menciona quem não está na demanda, então a menção é aceita', async () => {
      // Dado
      const demanda = await SD.demandaCriar({ titulo: 'Sem o Bruno', responsavel_id: 'u-ana', clientes: ['p-ana'] });
      chave(true);
      // Quando / Então
      await expect(SD.comentarioCriar('demandas', demanda.id, 'Veja, @bruno.souza')).resolves.toBeTruthy();
    });

    it('dada a chave desligada, quando alguém menciona quem não está na demanda, então a menção é recusada', async () => {
      // Dado
      const demanda = await SD.demandaCriar({ titulo: 'Sem o Bruno', responsavel_id: 'u-ana', clientes: ['p-ana'] });
      // Quando / Então
      await expect(SD.comentarioCriar('demandas', demanda.id, 'Veja, @bruno.souza')).rejects.toThrow('Não é possível mencionar');
    });
  });

  it('dada uma demanda ligada a um contrato alheio, quando a conta comum a abre, então vê o número, mas não o contrato', async () => {
    // Dado
    const { id, codigo } = await novoContrato();
    const demanda = await SD.demandaCriar({ titulo: 'Notificar', responsavel_id: 'u-bruno', clientes: ['p-ana'], contrato_id: id });
    // Quando
    entrarComo('u-bruno');
    const lida = await SD.demandaObter(demanda.id);
    // Então
    expect(lida).toMatchObject({ contrato_id: id, contrato_codigo: codigo, contrato: null });
  });

  it('dado o participante de um contrato, quando lê as parcelas, então não vê: elas são de quem cuida do contrato', async () => {
    // Dado
    const { id } = await novoContrato({ participantes: [{ pessoa_id: 'p-bruno', percentual: null }] });
    await SD.parcelaCriar(id, { vencimento: '2030-01-10', valor: 100 });
    expect(await SD.parcelasDoContrato(id)).toHaveLength(1);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await SD.parcelasDoContrato(id)).toEqual([]);
  });

  it('dada qualquer conta, quando lê Pessoas, então vê todo o cadastro', async () => {
    // Dado
    const total = (await SD.pessoasListar({ porPagina: 100 })).total;
    // Quando
    entrarComo('u-bruno');
    // Então
    expect((await SD.pessoasListar({ porPagina: 100 })).total).toBe(total);
  });
});

// A troca de conta só existe no banco fictício; no banco de verdade, a regra é provada em supabase/tests/quem_recebeu_marca.test.sql.
describe('A passar: quem recebeu o dinheiro (banco fictício)', () => {
  let SD: Dados;
  const MARCO = { de: '2026-03-01', ate: '2026-03-31' };
  const MENSAGEM_DE_RECUSA = 'Só quem recebeu o dinheiro ou um administrador marca este valor como pago.';
  const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);
  const reabrir = async () => { vi.resetModules(); return (await import('./falso')).SD; };
  const linhas = async () => (await SD.financeiroAPassar(MARCO.de, MARCO.ate)).map(v => v.quem_paga);

  /** Um recebimento do Mauro, com a Ana como participante. */
  async function recebimento() {
    const { id: cliente } = await SD.pessoaCriar({ tipo: 'pf', nome: 'CLIENTE A PASSAR' });
    const k = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Marca'], categoria: 'pro_labore', valor: 1000, parcelas: 1, primeiro_pagamento: '2026-03-05',
      percentual_escritorio: 100, participantes: [{ pessoa_id: 'p-ana', percentual: 10 }] });
    await SD.contratoMover(k.id, (await SD.colunasListar('contratos')).find(c => c.marco === 'assinado')!.id, 1);
    const [parcela] = await SD.parcelasDoContrato(k.id);
    const conta = await SD.financeiroContaCriar({ nome: 'PJ', tem_das: true, saldo_inicial: 0, saldo_inicial_em: '2026-01-01' });
    await SD.financeiroDasSalvar('2026-01', 4.5);
    return SD.financeiroReceber({ parcela: parcela.id, conta: conta.id, data: '2026-03-10', valor: 100000, taxa: 3000 });
  }

  /** O Bruno é estagiário e não pode ser responsável pela tela: aqui ele passa a ser quem recebeu, e o contrato continua com o Mauro. */
  async function gravarQuemRecebeu(id: string, responsavel: string) {
    const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { recebimentos: { id: string; responsavel_id: string }[] };
    bd.recebimentos.find(r => r.id === id)!.responsavel_id = responsavel;
    sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    SD = await reabrir();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    SD = await reabrir();
  });

  it('dado quem não é administrador e não recebeu o dinheiro, quando abre, então a linha não aparece', async () => {
    // Dado
    await recebimento();
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await linhas()).toEqual([]);
  });

  it('dado quem recebeu o dinheiro e não cuida mais do contrato, quando abre, então a linha aparece, e ele marca e desfaz', async () => {
    // Dado
    const id = await recebimento();
    await gravarQuemRecebeu(id, 'u-bruno');
    entrarComo('u-bruno');
    // Quando / Então
    expect(await linhas()).toEqual(['Bruno Exemplo Souza']);
    await SD.financeiroTerceiroMarcarPago(id, 'p-ana', '2026-03-20');
    expect(await SD.financeiroAPassar(MARCO.de, MARCO.ate)).toEqual([expect.objectContaining({ pessoa_id: 'p-ana', pago_em: '2026-03-20' })]);
    await SD.financeiroTerceiroDesfazerPago(id, 'p-ana');
    expect(await SD.financeiroAPassar(MARCO.de, MARCO.ate)).toEqual([expect.objectContaining({ pessoa_id: 'p-ana', pago_em: null })]);
  });

  it('dado quem não recebeu, quando tenta marcar ou desfazer por fora da tela, então é recusado e nada muda', async () => {
    // Dado
    const id = await recebimento();
    await SD.financeiroTerceiroMarcarPago(id, 'p-ana', '2026-03-20');
    entrarComo('u-bruno');
    // Quando / Então
    await expect(SD.financeiroTerceiroDesfazerPago(id, 'p-ana')).rejects.toThrow(MENSAGEM_DE_RECUSA);
    await expect(SD.financeiroTerceiroMarcarPago(id, 'p-ana', '2026-03-21')).rejects.toThrow(MENSAGEM_DE_RECUSA);
    entrarComo('u-master');
    expect(await SD.financeiroAPassar(MARCO.de, MARCO.ate)).toEqual([expect.objectContaining({ pago_em: '2026-03-20' })]);
  });

  it('dado outro administrador, quando abre o que não recebeu, então vê a linha e marca', async () => {
    // Dado
    const id = await recebimento();
    await gravarQuemRecebeu(id, 'u-bruno');
    // Quando
    entrarComo('u-ana');
    await SD.financeiroTerceiroMarcarPago(id, 'p-ana', '2026-03-20');
    // Então
    expect(await SD.financeiroAPassar(MARCO.de, MARCO.ate)).toEqual([expect.objectContaining({ quem_paga: 'Bruno Exemplo Souza', pago_em: '2026-03-20' })]);
  });
});

// A regra do banco de verdade está provada em supabase/tests/equipe_nome.test.sql; aqui, que o fictício faz igual.
describe('O nome de alguém da equipe (banco fictício)', () => {
  let SD: Dados;
  const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(id);

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
  });

  it('dado um usuário comum, quando tenta mudar o nome de alguém, então é recusado', async () => {
    // Dado
    entrarComo('u-bruno');
    // Então
    await expect(SD.equipeDefinirNome('u-ana', 'Outra Ana')).rejects.toThrow('Apenas administradores mudam o nome de alguém da equipe');
  });

  it('dado uma administradora, quando muda o nome do master, então é recusado; o de um usuário, muda', async () => {
    // Dado
    entrarComo('u-ana');
    // Então
    await expect(SD.equipeDefinirNome('u-master', 'Outro')).rejects.toThrow('Só o próprio master muda o nome dele.');
    await SD.equipeDefinirNome('u-bruno', '  Bruno Souza  ');
    expect((await SD.equipeListar()).find(u => u.id === 'u-bruno')?.nome).toBe('Bruno Souza');
  });

  it('dado o master, quando dá um nome de uma letra, então é recusado', async () => {
    // Então
    await expect(SD.equipeDefinirNome('u-ana', 'A')).rejects.toThrow('Informe um nome de 2 a 200 letras.');
  });
});

describe('Pedir para participar (banco fictício, #363)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void; fecharVisibilidade(ligada: boolean): void };
  const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  /** Um item da semente, lido da aba como o banco fictício o guarda. */
  const daSemente = <T,>(colecao: string, achar: (x: T) => boolean) =>
    (JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as Record<string, T[]>)[colecao].find(achar)!;
  /** A tarefa "Renovar a procuração" (F00D1234): da Ana, com o master; o Bruno não está nela. */
  const procuracao = () => daSemente<{ id: string; codigo: string }>('tarefas', t => t.codigo === 'F00D1234');
  const minhasDoTipo = async (tipo: string) => (await SD.mensagensListar()).filter(m => m.tipo === tipo);

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    falso().fecharVisibilidade(true);
  });
  afterEach(() => entrarComo('u-master'));

  it('dada a visualização fechada, quando Bruno busca o código de uma tarefa de que não faz parte, então acha só o tipo e o código; por nome ou parte do código, nada', async () => {
    // Dado
    entrarComo('u-bruno');
    // Quando
    const achados = await SD.itensParaPedir('f00d1234');
    // Então
    expect((await SD.tarefasListar({ termo: 'F00D1234' })).linhas).toEqual([]);
    expect(await SD.tarefaObter(procuracao().id)).toBeNull();
    expect(achados).toEqual([{ modulo: 'tarefas', grupo: 'tarefas', id: procuracao().id, codigo: 'F00D1234', numero: null, pedido_id: null }]);
    expect(await SD.itensParaPedir('Renovar a procuração')).toEqual([]);
    expect(await SD.itensParaPedir('F00D12')).toEqual([]);
  });

  it('dado quem já vê a tarefa, quando busca o código, então nada há para pedir', async () => {
    // Dado
    entrarComo('u-ana');
    // Quando / Então
    expect(await SD.itensParaPedir('F00D1234')).toEqual([]);
  });

  it('dado Bruno, quando pede para participar, então o pedido chega às Mensagens de quem aprova, não se pede de novo e pode ser cancelado', async () => {
    // Dado
    entrarComo('u-bruno');
    // Quando
    const pedido = await SD.participacaoPedir('tarefas', procuracao().id);
    // Então
    await expect(SD.participacaoPedir('tarefas', procuracao().id)).rejects.toThrow('Você já pediu para participar deste item. Aguarde a resposta ou cancele o pedido.');
    expect((await SD.itensParaPedir('F00D1234'))[0].pedido_id).toBe(pedido);
    expect(await minhasDoTipo('pedido')).toEqual([]);
    entrarComo('u-ana');
    expect(await SD.mensagensNaoLidas()).toBeGreaterThan(0);
    const [chegou] = await minhasDoTipo('pedido');
    expect(chegou.pedido).toMatchObject({ id: pedido, modulo: 'tarefas', item_codigo: 'F00D1234', pedido_por: 'u-bruno', situacao: 'pendente' });
    entrarComo('u-master');
    expect(await minhasDoTipo('pedido')).toHaveLength(1);
    // Quando
    entrarComo('u-bruno');
    await SD.participacaoCancelar(pedido);
    // Então
    await expect(SD.participacaoCancelar(pedido)).rejects.toThrow('Este pedido já foi respondido.');
    expect((await SD.itensParaPedir('F00D1234'))[0].pedido_id).toBeNull();
    entrarComo('u-ana');
    expect(await minhasDoTipo('pedido')).toEqual([]);
  });

  it('dado um pedido, quando a administradora aprova, então Bruno entra como participante, vê a tarefa, a resposta chega a ele e o segundo que responde vê "já respondido"', async () => {
    // Dado
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('tarefas', procuracao().id);
    await expect(SD.participacaoResponder(pedido, true)).rejects.toThrow('Só um administrador, o responsável ou quem criou o item responde a este pedido.');
    // Quando
    entrarComo('u-ana');
    await SD.participacaoResponder(pedido, true);
    // Então
    entrarComo('u-master');
    await expect(SD.participacaoResponder(pedido, false)).rejects.toThrow('Este pedido já foi respondido.');
    expect(await minhasDoTipo('pedido')).toEqual([]);
    const tarefa = await SD.tarefaObter(procuracao().id);
    expect(tarefa?.participantes).toContain('u-bruno');
    expect((await SD.tarefaHistorico(procuracao().id))[0].alteracoes).toEqual({ pedido_aprovado: { de: null, para: 'Bruno Exemplo Souza' } });
    entrarComo('u-bruno');
    expect(await SD.tarefaObter(procuracao().id)).not.toBeNull();
    expect(await SD.itensParaPedir('F00D1234')).toEqual([]);
    const [resposta] = await minhasDoTipo('resposta');
    expect(resposta.pedido).toMatchObject({ situacao: 'aprovado', respondido_por: 'u-ana', item_codigo: 'F00D1234' });
    await SD.mensagensMarcarTodasLidas();
    expect(await SD.mensagensNaoLidas()).toBe(0);
  });

  it('dado um pedido, quando o responsável recusa, então Bruno não entra, é avisado e a recusa fica no histórico', async () => {
    // Dado
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('tarefas', procuracao().id);
    // Quando
    entrarComo('u-ana');
    await SD.participacaoResponder(pedido, false);
    // Então
    expect((await SD.tarefaObter(procuracao().id))?.participantes).not.toContain('u-bruno');
    expect((await SD.tarefaHistorico(procuracao().id))[0].alteracoes).toEqual({ pedido_recusado: { de: null, para: 'Bruno Exemplo Souza' } });
    entrarComo('u-bruno');
    expect((await minhasDoTipo('resposta'))[0].pedido).toMatchObject({ situacao: 'recusado' });
    expect(await SD.tarefaObter(procuracao().id)).toBeNull();
  });

  /** Os contratos da semente: "Registro de marca" (do Mauro) tem a demanda D3A1F09C, em que Bruno é colaborador; "Ação de cobrança" (da Ana), nenhuma de Bruno. */
  const contratoDaSemente = (servico: string) => daSemente<{ id: string; codigo: string; servico: string }>('contratos', k => k.servico.startsWith(servico));

  it('dado um contrato de que Bruno não é parte, mas está numa demanda ligada a ele, quando a administradora aprova o pedido, então ele entra com 0% da divisão', async () => {
    // Dado
    const contrato = contratoDaSemente('Registro de marca');
    entrarComo('u-bruno');
    const [achado] = await SD.itensParaPedir(contrato.codigo.toLowerCase());
    const pedido = await SD.participacaoPedir(achado.modulo, achado.id);
    // Quando
    entrarComo('u-ana');
    await SD.participacaoResponder(pedido, true);
    // Então
    expect((await SD.contratoObter(contrato.id))?.participantes).toContainEqual(expect.objectContaining({ pessoa: expect.objectContaining({ id: 'p-bruno' }), percentual: 0 }));
    entrarComo('u-bruno');
    expect(await SD.itensParaPedir(contrato.codigo)).toEqual([]);
  });

  it('dado um item arquivado ou um módulo que não existe, quando alguém pede, então é recusado', async () => {
    // Dado
    entrarComo('u-bruno');
    // Quando / Então
    await expect(SD.participacaoPedir('tarefas', 'nao-existe')).rejects.toThrow('Item não encontrado neste escritório.');
    await expect(SD.participacaoPedir('perfis' as never, procuracao().id)).rejects.toThrow('Item não encontrado neste escritório.');
  });

  it('dado o código do contrato, que dá para adivinhar, quando Bruno busca cada contrato do escritório pelo código, então só acha o ligado a uma demanda dele', async () => {
    // Dado
    const codigos = (JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { contratos: { codigo: string }[] }).contratos.map(k => k.codigo);
    entrarComo('u-bruno');
    // Quando
    const achados = (await Promise.all(codigos.map(c => SD.itensParaPedir(c)))).flat();
    // Então
    expect(achados.map(i => i.codigo)).toEqual([contratoDaSemente('Registro de marca').codigo]);
    expect(await SD.itensParaPedir(contratoDaSemente('Ação de cobrança').codigo)).toEqual([]);
  });

  it('dado Bruno como indicador do contrato, quando busca o código ou pede, então o contrato não é oferecido e o pedido é recusado', async () => {
    // Dado
    const contrato = contratoDaSemente('Registro de marca');
    await SD.contratoAtualizar(contrato.id, { indicador_id: 'p-bruno', indicador_percentual: 5 });
    entrarComo('u-bruno');
    // Quando / Então
    expect(await SD.itensParaPedir(contrato.codigo)).toEqual([]);
    await expect(SD.participacaoPedir('contratos', contrato.id)).rejects.toThrow('Você é o indicador deste contrato: o indicador não entra na divisão como participante.');
  });

  it('dado um pedido, quando Bruno vira o indicador do contrato antes da aprovação, então ninguém aprova (como o gatilho do banco), mas o pedido pode ser recusado', async () => {
    // Dado
    const contrato = contratoDaSemente('Registro de marca');
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('contratos', contrato.id);
    entrarComo('u-master');
    await SD.contratoAtualizar(contrato.id, { indicador_id: 'p-bruno', indicador_percentual: 5 });
    // Quando / Então
    await expect(SD.participacaoResponder(pedido, true)).rejects.toThrow('O indicador e os participantes precisam ser pessoas diferentes.');
    await SD.participacaoResponder(pedido, false);
    expect((await SD.contratoObter(contrato.id))?.participantes).not.toContainEqual(expect.objectContaining({ pessoa: expect.objectContaining({ id: 'p-bruno' }) }));
  });

  it('dado um contrato com parcelas e a responsável que não é administradora, quando ela aprova, então a trava da divisão recusa; a administração aprova', async () => {
    // Dado
    const contrato = contratoDaSemente('Ação de cobrança');
    await SD.parcelaCriar(contrato.id, { vencimento: '2031-02-01', valor: 20000 });
    await SD.equipeDefinirPapel('u-ana', 'usuario');
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('contratos', contrato.id);
    // Quando
    entrarComo('u-ana');
    // Então
    await expect(SD.participacaoResponder(pedido, true)).rejects.toThrow('Este contrato tem parcelas: só um administrador muda a divisão.');
    entrarComo('u-master');
    await SD.participacaoResponder(pedido, true);
    expect((await SD.contratoObter(contrato.id))?.participantes).toContainEqual(expect.objectContaining({ pessoa: expect.objectContaining({ id: 'p-bruno' }), percentual: 0 }));
  });

  it('dado um pedido, quando a tarefa é arquivada antes da resposta, então ninguém aprova, mas o pedido pode ser recusado', async () => {
    // Dado
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('tarefas', procuracao().id);
    entrarComo('u-master');
    await SD.tarefasArquivar([procuracao().id]);
    // Quando / Então
    await expect(SD.participacaoResponder(pedido, true)).rejects.toThrow('Este item foi arquivado: ele não recebe participantes. Recuse o pedido ou desarquive o item antes.');
    await SD.participacaoResponder(pedido, false);
    expect(await minhasDoTipo('pedido')).toEqual([]);
  });

  it('dado um processo administrativo com letras no número (patente do INPI), quando Bruno busca o número inteiro, então acha o processo', async () => {
    // Dado
    const cliente = daSemente<{ id: string; nome: string }>('pessoas', p => p.nome === 'MARIA APARECIDA EXEMPLO').id;
    const { codigo } = await SD.processoCriar({ tipo: 'administrativo', numero: 'BR 10 2020 012345-6', responsavel_id: 'u-ana', clientes: [cliente] });
    entrarComo('u-bruno');
    // Quando
    const [achado] = await SD.itensParaPedir('br 10 2020 012345-6');
    // Então
    expect(achado).toMatchObject({ modulo: 'processos', grupo: 'administrativos', codigo, numero: 'BR1020200123456' });
    expect(await SD.itensParaPedir('BR 10 2020')).toEqual([]);
  });
});

describe('Menções sem revelar o item a quem não o vê (banco fictício, #365)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void; fecharVisibilidade(ligada: boolean): void };
  const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  /**
   * A recusa de quem não chega ao cartão: a mesma de quando ele não existe e a mesma do banco, onde as regras de acesso recusam com
   * 42501 e o erros.ts traduz para este texto.
   */
  const RECUSA = 'Você não tem permissão para fazer isso.';
  const TEXTOS = ['Sem menção nenhuma', 'Veja, @ana.lima', 'Veja, @bruno.souza'];

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    falso().fecharVisibilidade(true);
  });
  afterEach(() => entrarComo('u-master'));

  it('dado Bruno fora de uma demanda, uma tarefa e um compromisso, quando comenta neles com ou sem menção, então recebe sempre a recusa de quem não tem permissão, sem nome', async () => {
    // Dado
    const demanda = await SD.demandaCriar({ titulo: 'Sem o Bruno', responsavel_id: 'u-ana' });
    const tarefa = await SD.tarefaCriar({ titulo: 'Sem o Bruno', responsavel_id: 'u-ana' });
    const compromisso = await SD.compromissoCriar({ tipo: 'reuniao', titulo: 'Sem o Bruno', data: hojeISO(), hora: '14:30', responsavel_id: 'u-ana' });
    const cartoes = [['demandas', demanda.id], ['tarefas', tarefa.id], ['compromissos', compromisso.id], ['demandas', 'nao-existe']] as const;
    entrarComo('u-bruno');
    // Quando
    const tentativas = await Promise.allSettled(cartoes.flatMap(([modulo, id]) => TEXTOS.map(texto => SD.comentarioCriar(modulo, id, texto))));
    // Então
    expect(tentativas.map(t => t.status === 'rejected' && (t.reason as Error).message)).toEqual(tentativas.map(() => RECUSA));
    entrarComo('u-master');
    expect(await SD.comentariosListar('demandas', demanda.id)).toEqual([]);
  });

  it('dado Bruno fora de um processo, quando comenta nele com ou sem menção, então recebe sempre a recusa de quem não tem permissão, sem nome (#362)', async () => {
    // Dado
    const { id: cliente } = await SD.pessoaCriar({ tipo: 'pf', nome: 'CLIENTE DO PROCESSO SEM O BRUNO' });
    const processo = await SD.processoCriar({ tipo: 'judicial', numero: '0009999-11.2026.8.13.0024', responsavel_id: 'u-ana', clientes: [cliente] });
    entrarComo('u-bruno');
    // Quando
    const tentativas = await Promise.allSettled([processo.id, 'nao-existe'].flatMap(id => TEXTOS.map(texto => SD.comentarioCriar('processos', id, texto))));
    // Então
    expect(tentativas.map(t => t.status === 'rejected' && (t.reason as Error).message)).toEqual(tentativas.map(() => RECUSA));
    expect(await SD.comentariosListar('processos', processo.id)).toEqual([]);
  });

  it('dado Bruno fora de um contrato, quando comenta nele com uma menção a quem não é advogado, então recebe a recusa de quem não tem permissão, sem nome', async () => {
    // Dado
    const contrato = await SD.contratoCriar({ clientes: ['p-ana'], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore' });
    entrarComo('u-bruno');
    // Quando
    const tentativas = await Promise.allSettled([contrato.id, 'nao-existe'].flatMap(id => TEXTOS.map(texto => SD.comentarioCriar('contratos', id, texto))));
    // Então
    expect(tentativas.map(t => t.status === 'rejected' && (t.reason as Error).message)).toEqual(tentativas.map(() => RECUSA));
  });

  it('dado Bruno fora de uma demanda, quando manda um comentário vazio nela ou num cartão que não existe, então recebe "Escreva o comentário." nos dois, como o gatilho que roda antes das regras de acesso', async () => {
    // Dado
    const demanda = await SD.demandaCriar({ titulo: 'Sem o Bruno', responsavel_id: 'u-ana' });
    entrarComo('u-bruno');
    // Quando
    const tentativas = await Promise.allSettled([demanda.id, 'nao-existe'].map(id => SD.comentarioCriar('demandas', id, '   ')));
    // Então
    expect(tentativas.map(t => t.status === 'rejected' && (t.reason as Error).message)).toEqual(['Escreva o comentário.', 'Escreva o comentário.']);
  });

  it('dado Bruno, que saiu da demanda, quando edita o próprio comentário nela, então é recusado como quem não o escreveu, sem conferir menções', async () => {
    // Dado
    const demanda = await SD.demandaCriar({ titulo: 'Com o Bruno', responsavel_id: 'u-ana', colaboradores: ['u-bruno'] });
    entrarComo('u-bruno');
    const comentario = await SD.comentarioCriar('demandas', demanda.id, 'Veja, @ana.lima');
    entrarComo('u-master');
    await SD.demandaAtualizar(demanda.id, { colaboradores: [] });
    entrarComo('u-bruno');
    // Quando / Então
    for (const texto of TEXTOS)
      await expect(SD.comentarioEditar(comentario.id, texto)).rejects.toThrow('Só quem escreveu o comentário pode editá-lo.');
    entrarComo('u-master');
    expect((await SD.comentariosListar('demandas', demanda.id)).map(c => c.texto)).toEqual(['Veja, @ana.lima']);
  });

  it('dado quem está na demanda, quando menciona, então funciona como antes', async () => {
    // Dado
    const demanda = await SD.demandaCriar({ titulo: 'Com o Bruno', responsavel_id: 'u-ana', colaboradores: ['u-bruno'] });
    entrarComo('u-bruno');
    // Quando
    const comentario = await SD.comentarioCriar('demandas', demanda.id, 'Veja, @ana.lima');
    // Então
    expect(comentario.mencoes).toEqual(['u-ana']);
  });
});

// Como a regra de leitura de supabase/migrations/20261122125913_demandas_relacionadas.sql, provada no banco em
// supabase/tests/demandas_relacionadas.test.sql.
describe('Demandas relacionadas com quem vê só uma das duas (banco fictício, #310)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void; fecharVisibilidade(ligada: boolean): void };
  const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
  const demanda = (responsavel_id: string) => SD.demandaCriar({ titulo: 'Demanda relacionada ' + responsavel_id, responsavel_id });

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    falso().entrarComo('u-master');
  });
  afterEach(() => { falso().fecharVisibilidade(false); falso().entrarComo('u-master'); });

  it('dada a demanda do Bruno ligada a outra que ele não vê, quando ele lê as relacionadas pelos dois lados, então vê a ligação nos dois, e o conteúdo só da dele', async () => {
    // Dado
    const [doBruno, sigilosa] = [await demanda('u-bruno'), await demanda('u-ana')];
    await SD.demandaRelacionar(doBruno.id, sigilosa.id);
    falso().fecharVisibilidade(true);
    // Quando
    falso().entrarComo('u-bruno');
    const pelaDele = await SD.demandasRelacionadas(doBruno.id);
    const pelaOutra = await SD.demandasRelacionadas(sigilosa.id);
    // Então
    expect(pelaDele).toEqual([{ id: sigilosa.id, codigo: sigilosa.codigo, demanda: null }]);
    expect(pelaOutra).toEqual([expect.objectContaining({ id: doBruno.id, codigo: doBruno.codigo, demanda: expect.objectContaining({ titulo: 'Demanda relacionada u-bruno' }) })]);
  });

  it('dada a mesma ligação, quando o Bruno a desfaz, então ela sai, e ele não consegue refazê-la, porque não está na outra', async () => {
    // Dado
    const [doBruno, sigilosa] = [await demanda('u-bruno'), await demanda('u-ana')];
    await SD.demandaRelacionar(doBruno.id, sigilosa.id);
    falso().fecharVisibilidade(true);
    falso().entrarComo('u-bruno');
    // Quando
    await SD.demandaDesrelacionar(doBruno.id, sigilosa.id);
    // Então
    expect(await SD.demandasRelacionadas(doBruno.id)).toEqual([]);
    await expect(SD.demandaRelacionar(doBruno.id, sigilosa.id)).rejects.toThrow('Você não tem permissão para fazer isso.');
  });
});

describe('Aviso ao ser incluído num item (banco fictício, #377)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void; fecharVisibilidade(ligada: boolean): void };
  const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  /** Os avisos de inclusão de quem está logado. */
  const avisos = async () => (await SD.mensagensListar()).filter(m => m.tipo === 'inclusao');
  /** Os avisos de outra conta, voltando depois para a Ana. */
  const avisosDe = async (quem: string) => { entrarComo(quem); const lista = await avisos(); entrarComo('u-ana'); return lista; };
  const lerTudo = async (quem: string) => { entrarComo(quem); await SD.mensagensMarcarTodasLidas(); entrarComo('u-ana'); };
  const demanda = (extra: Partial<Parameters<Dados['demandaCriar']>[0]> = {}) => SD.demandaCriar({ titulo: 'Demanda do aviso', responsavel_id: 'u-ana', ...extra });
  /** O tempo passa (mais que o do desfazer): a próxima mudança começa outra sequência. */
  const passarOTempo = () => { const t = Date.now(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(t + 2 * MINUTO); };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    entrarComo('u-ana');
  });
  afterEach(() => { vi.useRealTimers(); entrarComo('u-master'); });

  it('dado Bruno fora da demanda, quando Ana o inclui como colaborador, então ele recebe o aviso com a demanda, e marcar como lida tira do número', async () => {
    // Dado
    const { id, codigo } = await demanda();
    // Quando
    await SD.demandaAtualizar(id, { colaboradores: ['u-bruno'] });
    // Então
    entrarComo('u-bruno');
    const [aviso] = await avisos();
    // Desde a #378, o aviso diz também por qual grupo da equipe a pessoa entrou: aqui, por conta própria (null).
    expect(aviso.inclusao).toEqual({ modulo: 'demandas', entrou_como: 'participante', incluido_por: 'u-ana', item: { id, codigo, nome: 'Demanda do aviso', tipo_do_processo: null }, grupo: null });
    expect(aviso.lido_em).toBeNull();
    const antes = await SD.mensagensNaoLidas();
    await SD.mensagemMarcarLida(aviso.id);
    expect(await SD.mensagensNaoLidas()).toBe(antes - 1);
  });

  it('dada uma tarefa da Ana, quando ela passa a responsabilidade para Bruno, então ele recebe o aviso de responsável', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa do aviso', responsavel_id: 'u-ana' });
    // Quando
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-bruno' });
    // Então
    expect((await avisosDe('u-bruno')).map(m => m.inclusao?.entrou_como)).toEqual(['responsavel']);
  });

  it('dado um item, quando Ana inclui a si mesma, então ela não recebe aviso', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa do aviso', responsavel_id: 'u-master' });
    // Quando
    await SD.tarefaAtualizar(id, { participantes: ['u-ana'] });
    // Então
    expect(await avisos()).toEqual([]);
  });

  it('dado um item novo, quando Ana o cria com várias pessoas de uma vez, então cada uma recebe o seu, e quem está desativado não', async () => {
    // Quando
    const compromisso = await SD.compromissoCriar({ tipo: 'reuniao', titulo: 'Reunião do aviso', data: hojeISO(), hora: '14:30', responsavel_id: 'u-master', participantes: ['u-bruno', 'u-ana'] });
    const processo = await SD.processoCriar({ tipo: 'judicial', numero: '0007777-11.2026.8.13.0024', responsavel_id: 'u-ana', clientes: ['p-carla'], colaboradores: ['u-master', 'u-bruno', 'u-carla'] });
    // Então
    const doMaster = await avisosDe('u-master'), doBruno = await avisosDe('u-bruno');
    const doMasterPorItem = doMaster.map(m => [m.inclusao?.item?.id, m.inclusao?.entrou_como]);
    expect(doMasterPorItem).toHaveLength(2);
    expect(doMasterPorItem).toEqual(expect.arrayContaining([[compromisso.id, 'responsavel'], [processo.id, 'participante']]));
    expect(doBruno.map(m => m.inclusao?.item?.id)).toHaveLength(2);
    expect(doBruno.map(m => m.inclusao?.item?.id)).toEqual(expect.arrayContaining([compromisso.id, processo.id]));
    expect(doBruno.find(m => m.inclusao?.modulo === 'compromissos')?.inclusao?.item?.nome).toBe('Reunião do aviso');
    expect(doBruno.find(m => m.inclusao?.modulo === 'processos')?.inclusao?.item).toMatchObject({ tipo_do_processo: 'judicial', nome: '0007777-11.2026.8.13.0024' });
    expect(await avisos()).toEqual([]);
    expect(await avisosDe('u-carla')).toEqual([]);
  });

  it('dado o responsável e a lista no mesmo salvamento, então a pessoa recebe um aviso só, o de responsável; e o responsável que passa a participante (um tempo depois), nada', async () => {
    // Quando
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa do aviso', responsavel_id: 'u-bruno', participantes: ['u-bruno'] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => m.inclusao?.entrou_como)).toEqual(['responsavel']);
    // Quando
    await lerTudo('u-bruno');
    passarOTempo();
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-master', participantes: ['u-bruno'] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => [m.inclusao?.entrou_como, !!m.lido_em])).toEqual([['responsavel', true]]);
  });

  it('dado Bruno incluído e retirado depois de ler, quando abre a caixa, então o aviso continua sem o item, com a visualização aberta ou fechada', async () => {
    // Dado
    const { id } = await demanda({ colaboradores: ['u-bruno'] });
    await lerTudo('u-bruno');
    // Quando
    await SD.demandaAtualizar(id, { colaboradores: [] });
    // Então: ele ainda vê a demanda (a visualização está aberta), mas o aviso não mostra mais o item
    entrarComo('u-bruno');
    expect(await SD.demandaObter(id)).not.toBeNull();
    expect((await avisos()).map(m => m.inclusao)).toEqual([{ modulo: 'demandas', entrou_como: 'participante', incluido_por: 'u-ana', item: null, grupo: null }]);
    falso().fecharVisibilidade(true);
    expect(await SD.demandaObter(id)).toBeNull();
    expect((await avisos())[0].inclusao?.item).toBeNull();
  });

  it('dada a administradora (ou quem criou o item), quando é retirada, então vê o item, mas o aviso não o mostra mais', async () => {
    // Dado: o master põe a Ana numa demanda dele; a Ana põe o Bruno numa tarefa que o Bruno criou
    entrarComo('u-master');
    const { id } = await SD.demandaCriar({ titulo: 'Demanda do master', responsavel_id: 'u-master', colaboradores: ['u-ana'] });
    entrarComo('u-bruno');
    const tarefa = await SD.tarefaCriar({ titulo: 'Tarefa do Bruno', responsavel_id: 'u-master' });
    entrarComo('u-ana');
    await SD.tarefaAtualizar(tarefa.id, { participantes: ['u-bruno'] });
    await lerTudo('u-ana');
    await lerTudo('u-bruno');
    falso().fecharVisibilidade(true);
    // Quando
    entrarComo('u-master');
    await SD.demandaAtualizar(id, { colaboradores: [] });
    await SD.tarefaAtualizar(tarefa.id, { participantes: [] });
    // Então
    entrarComo('u-ana');
    expect(await SD.demandaObter(id)).not.toBeNull();
    expect((await avisos()).map(m => [m.inclusao?.modulo, m.inclusao?.item])).toEqual([['demandas', null]]);
    entrarComo('u-bruno');
    expect(await SD.tarefaObter(tarefa.id)).not.toBeNull();
    expect((await avisos()).map(m => [m.inclusao?.modulo, m.inclusao?.item])).toEqual([['tarefas', null]]);
  });

  it('dado um pedido para participar, quando é aprovado, então quem pediu recebe só a resposta, sem o aviso de inclusão', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa pedida', responsavel_id: 'u-ana' });
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('tarefas', id);
    // Quando
    entrarComo('u-ana');
    await SD.participacaoResponder(pedido, true);
    // Então
    entrarComo('u-bruno');
    expect((await SD.tarefaObter(id))?.participantes).toContain('u-bruno');
    expect((await SD.mensagensListar()).map(m => m.tipo)).toEqual(['resposta']);
  });

  it('dado Bruno incluído, quando Ana desfaz logo em seguida, então o aviso some; passado o tempo do desfazer, ele fica', async () => {
    // Dado
    const { id } = await demanda();
    // Quando
    await SD.demandaAtualizar(id, { colaboradores: ['u-bruno'] });
    await SD.demandaAtualizar(id, { colaboradores: [] });
    // Então
    expect(await avisosDe('u-bruno')).toEqual([]);
    // Quando
    await SD.demandaAtualizar(id, { colaboradores: ['u-bruno'] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * MINUTO);
    await SD.demandaAtualizar(id, { colaboradores: [] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => [m.inclusao?.item, m.lido_em])).toEqual([[null, null]]);
  });

  it('dado Bruno que saiu, quando entra de novo um tempo depois, então é o mesmo aviso, que volta a ser não lido', async () => {
    // Dado
    const { id } = await demanda({ colaboradores: ['u-bruno'] });
    await lerTudo('u-bruno');
    passarOTempo();
    await SD.demandaAtualizar(id, { colaboradores: [] });
    passarOTempo();
    // Quando
    await SD.demandaAtualizar(id, { colaboradores: ['u-bruno'] });
    // Então
    const lista = await avisosDe('u-bruno');
    expect(lista).toHaveLength(1);
    expect(lista[0].lido_em).toBeNull();
    expect(lista[0].inclusao?.item?.nome).toBe('Demanda do aviso');
  });

  it('dado Bruno na demanda (com o aviso lido ou sem aviso), quando Ana o tira e desfaz logo, então ele não recebe "incluiu você"', async () => {
    // Dado: na primeira demanda ele leu o aviso; na segunda, entrou pelo pedido aprovado (sem aviso de inclusão)
    const lida = await demanda({ colaboradores: ['u-bruno'] });
    await lerTudo('u-bruno');
    const semAviso = await demanda();
    entrarComo('u-bruno');
    const pedido = await SD.participacaoPedir('demandas', semAviso.id);
    entrarComo('u-ana');
    await SD.participacaoResponder(pedido, true);
    passarOTempo();
    // Quando
    for (const { id } of [lida, semAviso]) {
      await SD.demandaAtualizar(id, { colaboradores: [] });
      await SD.demandaAtualizar(id, { colaboradores: ['u-bruno'] });
    }
    // Então
    expect((await avisosDe('u-bruno')).map(m => [m.inclusao?.item?.id, !!m.lido_em])).toEqual([[lida.id, true]]);
  });

  it('dado Bruno participante, quando Ana o põe como responsável e desfaz logo, então o aviso de responsável some e ela não recebe nada', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa do aviso', responsavel_id: 'u-master', participantes: ['u-bruno', 'u-ana'] });
    await lerTudo('u-bruno');
    passarOTempo();
    entrarComo('u-master');
    // Quando
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-bruno', participantes: ['u-ana', 'u-master'] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => m.inclusao?.entrou_como)).toEqual(['responsavel', 'participante']);
    // Quando
    entrarComo('u-master');
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-master', participantes: ['u-bruno', 'u-ana'] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => [m.inclusao?.entrou_como, !!m.lido_em])).toEqual([['participante', true]]);
  });

  it('dado o responsável trocado e desfeito logo, então quem volta a ser o responsável não recebe aviso', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa do aviso', responsavel_id: 'u-master' });
    await lerTudo('u-master');
    passarOTempo();
    // Quando
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-bruno' });
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-master' });
    // Então: o master fica só com o aviso de quando a tarefa foi criada, já lido
    expect(await avisosDe('u-bruno')).toEqual([]);
    expect((await avisosDe('u-master')).map(m => [m.inclusao?.entrou_como, !!m.lido_em])).toEqual([['responsavel', true]]);
  });

  it('dado Bruno posto como responsável, quando logo passa a participante, então fica com o aviso de participante', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: 'Tarefa do aviso', responsavel_id: 'u-ana' });
    passarOTempo();
    // Quando
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-bruno' });
    await SD.tarefaAtualizar(id, { responsavel_id: 'u-ana', participantes: ['u-bruno'] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => [m.inclusao?.entrou_como, m.lido_em])).toEqual([['participante', null]]);
  });

  it('dado um contrato, quando entra um participante pela pessoa dele, então o usuário dela recebe; mudar só o percentual não avisa; trocar o responsável avisa', async () => {
    // Dado
    const { id } = await SD.contratoCriar({ clientes: ['p-carla'], responsavel_id: 'u-ana', objetos: ['Registro de marca'], categoria: 'pro_labore' });
    // Quando
    await SD.contratoAtualizar(id, { participantes: [{ pessoa_id: 'p-bruno', percentual: 10 }] });
    // Então
    expect((await avisosDe('u-bruno')).map(m => [m.inclusao?.modulo, m.inclusao?.entrou_como, m.inclusao?.item?.id])).toEqual([['contratos', 'participante', id]]);
    // Quando
    await lerTudo('u-bruno');
    await SD.contratoAtualizar(id, { participantes: [{ pessoa_id: 'p-bruno', percentual: 20 }] });
    await SD.contratoAtualizar(id, { responsavel_id: 'u-master' });
    // Então
    expect((await avisosDe('u-bruno')).every(m => m.lido_em)).toBe(true);
    expect((await avisosDe('u-master')).map(m => m.inclusao?.entrou_como)).toEqual(['responsavel']);
  });

  it('dado uma pessoa em "Contrato fechado" movida por quem não é advogado, quando o contrato nasce do advogado dela, então ninguém recebe aviso', async () => {
    // Dado
    const { id } = await SD.pessoaCriar({ tipo: 'pf', nome: 'CLIENTE DO AVISO' }, ['u-ana']);
    entrarComo('u-bruno');
    // Quando
    const fechado = (await SD.pessoaFecharContrato(id))!;
    // Então
    entrarComo('u-ana');
    expect((await SD.contratoObter(fechado.id))?.responsavel_id).toBe('u-ana');
    expect(await avisos()).toEqual([]);
  });

  it('dada uma anotação compartilhada, quando Ana a duplica, então cada pessoa da cópia recebe o aviso dela', async () => {
    // Dado
    const original = await SD.anotacaoCriar({ titulo: 'Original', responsavel_id: 'u-ana', participantes: ['u-bruno'] });
    await lerTudo('u-bruno');
    // Quando
    const copia = await SD.anotacaoDuplicar(original.id, { titulo: 'Cópia', responsavel_id: 'u-ana', participantes: ['u-bruno', 'u-master'] });
    // Então
    expect((await avisosDe('u-bruno')).filter(m => !m.lido_em).map(m => m.inclusao?.item?.id)).toEqual([copia.id]);
    expect((await avisosDe('u-master')).map(m => m.inclusao?.item?.nome)).toEqual(['Cópia']);
  });

  it('dado Bruno com avisos, quando é excluído da equipe, então os avisos dele saem', async () => {
    // Dado
    await demanda({ colaboradores: ['u-bruno'] });
    entrarComo('u-master');
    await SD.equipeDefinirAtivo('u-bruno', false);
    // Quando
    await SD.equipeExcluir('u-bruno');
    // Então
    expect(await avisosDe('u-bruno')).toEqual([]);
  });
});

describe('Grupos da equipe (banco fictício, #378)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void; fecharVisibilidade(ligada: boolean): void };
  const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  const grupos = async () => (await SD.contexto())?.grupos ?? [];
  /** A Ana (administradora) cria o grupo com o Bruno. */
  const nucleoComBruno = async (nome = 'Núcleo do Teste') => {
    const id = await SD.grupoDaEquipeCriar(nome);
    await SD.grupoDaEquipeIncluir(id, 'u-bruno');
    return id;
  };
  const contratoDoMaster = async () => {
    entrarComo('u-master');
    const cliente = (await SD.pessoaCriar({ tipo: 'pf', nome: 'CLIENTE DO GRUPO' })).id;
    const k = await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: ['Registro de marca'], categoria: 'pro_labore', valor: 9000 });
    entrarComo('u-ana');
    return k;
  };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    entrarComo('u-ana');
  });
  afterEach(() => { entrarComo('u-master'); });

  it('dada a administradora, quando cria, renomeia e exclui um grupo, então o contexto acompanha; nome repetido e vazio são recusados', async () => {
    // Quando
    const id = await SD.grupoDaEquipeCriar('  Núcleo A  ');
    // Então
    expect(await grupos()).toEqual([{ id, nome: 'Núcleo A', integrantes: [] }]);
    await expect(SD.grupoDaEquipeCriar('núcleo a')).rejects.toThrow('Já existe um grupo com este nome.');
    await expect(SD.grupoDaEquipeCriar('   ')).rejects.toThrow('Escreva o nome do grupo.');
    await expect(SD.grupoDaEquipeCriar('x'.repeat(TAMANHO_GRUPO_DA_EQUIPE + 1))).rejects.toThrow(`O nome do grupo pode ter até ${TAMANHO_GRUPO_DA_EQUIPE} letras.`);
    // Quando
    await SD.grupoDaEquipeRenomear(id, 'Núcleo Beta');
    // Então
    expect((await grupos()).map(g => g.nome)).toEqual(['Núcleo Beta']);
    // Quando
    await SD.grupoDaEquipeExcluir(id);
    // Então
    expect(await grupos()).toEqual([]);
    await expect(SD.grupoDaEquipeRenomear(id, 'X')).rejects.toThrow('Grupo não encontrado neste escritório.');
  });

  it('dado um usuário comum, quando tenta cuidar dos grupos, então é recusado com a frase do banco em todas as funções', async () => {
    // Dado
    const id = await SD.grupoDaEquipeCriar('Núcleo A');
    entrarComo('u-bruno');
    // Então
    const recusa = 'Só um administrador cuida dos grupos.';
    await expect(SD.grupoDaEquipeCriar('Do Bruno')).rejects.toThrow(recusa);
    await expect(SD.grupoDaEquipeRenomear(id, 'X')).rejects.toThrow(recusa);
    await expect(SD.grupoDaEquipeIncluir(id, 'u-bruno')).rejects.toThrow(recusa);
    await expect(SD.grupoDaEquipeTirar(id, 'u-ana')).rejects.toThrow(recusa);
    await expect(SD.grupoDaEquipeContarItens(id)).rejects.toThrow(recusa);
    await expect(SD.grupoDaEquipeExcluir(id)).rejects.toThrow(recusa);
    expect((await grupos()).map(g => g.nome)).toEqual(['Núcleo A']);
  });

  it('dado um grupo, quando a administradora inclui duas pessoas seguidas e tira uma, então ficam as certas; o desativado não entra', async () => {
    // Dado
    const id = await SD.grupoDaEquipeCriar('Núcleo A');
    // Quando
    await SD.grupoDaEquipeIncluir(id, 'u-bruno');
    await SD.grupoDaEquipeIncluir(id, 'u-master');
    await SD.grupoDaEquipeIncluir(id, 'u-bruno');
    // Então
    expect((await grupos())[0].integrantes).toEqual(['u-bruno', 'u-master']);
    await expect(SD.grupoDaEquipeIncluir(id, 'u-carla')).rejects.toThrow('O integrante precisa ser alguém da equipe do escritório.');
    // Quando
    await SD.grupoDaEquipeTirar(id, 'u-master');
    // Então
    expect((await grupos())[0].integrantes).toEqual(['u-bruno']);
  });

  it('dada a visualização fechada, quando o grupo do Bruno é posto numa demanda, então ele a vê e a altera; quando sai do grupo, deixa de ver', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    const grupo = await nucleoComBruno();
    const { id } = await SD.demandaCriar({ titulo: 'Demanda do grupo', responsavel_id: 'u-ana' });
    entrarComo('u-bruno');
    expect(await SD.demandaObter(id)).toBeNull();
    // Quando
    entrarComo('u-ana');
    await SD.demandaAtualizar(id, { grupos: [grupo, grupo] });
    // Então
    expect((await SD.demandaObter(id))?.grupos).toEqual([grupo]);
    expect((await SD.demandaHistorico(id))[0].alteracoes.grupos).toEqual({ de: null, para: 'Núcleo do Teste' });
    entrarComo('u-bruno');
    expect((await SD.demandaObter(id))?.titulo).toBe('Demanda do grupo');
    await SD.demandaAtualizar(id, { titulo: 'Demanda mudada pelo Bruno' });
    await expect(SD.cartaoSair('demandas', id)).rejects.toThrow(
      'Você está neste cartão pelo grupo Núcleo do Teste. Para sair, peça a outra pessoa do cartão que tire o grupo dele (saem todos do grupo) ou a um administrador que tire você do grupo.');
    // Quando
    entrarComo('u-ana');
    await SD.grupoDaEquipeTirar(grupo, 'u-bruno');
    // Então
    entrarComo('u-bruno');
    expect(await SD.demandaObter(id)).toBeNull();
  });

  it('dado o grupo do Bruno numa tarefa, num processo, num compromisso e numa anotação, então ele vê cada um, e a tarefa da demanda do grupo também', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    const grupo = await nucleoComBruno();
    const cliente = (await SD.pessoaCriar({ tipo: 'pf', nome: 'CLIENTE DO GRUPO' })).id;
    const demanda = await SD.demandaCriar({ titulo: 'Demanda do grupo', responsavel_id: 'u-ana', grupos: [grupo] });
    const tarefa = await SD.tarefaCriar({ titulo: 'Tarefa do grupo', responsavel_id: 'u-ana', grupos: [grupo] });
    const daDemanda = await SD.tarefaCriar({ titulo: 'Tarefa da demanda', responsavel_id: 'u-ana', demanda_id: demanda.id });
    const processo = await SD.processoCriar({ tipo: 'judicial', numero: '0001234-55.2030.8.13.0024', responsavel_id: 'u-ana', clientes: [cliente], grupos: [grupo] });
    const compromisso = await SD.compromissoCriar({ tipo: 'reuniao', titulo: 'Reunião do grupo', data: hojeISO(), hora: '14:30', responsavel_id: 'u-ana', grupos: [grupo] });
    const anotacao = await SD.anotacaoCriar({ titulo: 'Anotação do grupo', responsavel_id: 'u-ana', grupos: [grupo] });
    // Quando
    entrarComo('u-bruno');
    // Então
    expect((await SD.tarefaObter(tarefa.id))?.titulo).toBe('Tarefa do grupo');
    expect((await SD.tarefaObter(daDemanda.id))?.titulo).toBe('Tarefa da demanda');
    expect((await SD.processoObter(processo.id))?.grupos).toEqual([grupo]);
    expect((await SD.compromissoObter(compromisso.id))?.titulo).toBe('Reunião do grupo');
    expect((await SD.anotacaoObter(anotacao.id))?.titulo).toBe('Anotação do grupo');
  });

  it('dado o filtro "Grupo da equipe", então a lista e o quadro trazem só os cartões do grupo, e em Tarefas também os da demanda do grupo', async () => {
    // Dado
    const grupo = await nucleoComBruno();
    const outro = await SD.grupoDaEquipeCriar('Núcleo Outro');
    const doGrupo = await SD.demandaCriar({ titulo: 'Demanda do filtro', responsavel_id: 'u-ana', grupos: [grupo] });
    const doOutro = await SD.demandaCriar({ titulo: 'Demanda do filtro', responsavel_id: 'u-ana', grupos: [outro] });
    await SD.demandaCriar({ titulo: 'Demanda do filtro', responsavel_id: 'u-ana' });
    const tarefa = await SD.tarefaCriar({ titulo: 'Tarefa do filtro', responsavel_id: 'u-ana', grupos: [grupo] });
    const daDemanda = await SD.tarefaCriar({ titulo: 'Tarefa do filtro', responsavel_id: 'u-ana', demanda_id: doGrupo.id });
    await SD.tarefaCriar({ titulo: 'Tarefa do filtro', responsavel_id: 'u-ana', demanda_id: doOutro.id });
    // Quando
    const demandas = await SD.demandasListar({ termo: 'Demanda do filtro', grupo });
    const naEtapa = await SD.demandasDaEtapa(null, { termo: 'Demanda do filtro', grupo });
    const tarefas = await SD.tarefasListar({ termo: 'Tarefa do filtro', grupo });
    const tarefasNaEtapa = await SD.tarefasDaEtapa(null, { termo: 'Tarefa do filtro', grupo });
    // Então
    expect(demandas.linhas.map(d => d.id)).toEqual([doGrupo.id]);
    expect(naEtapa.linhas.map(d => d.id)).toEqual([doGrupo.id]);
    expect(tarefas.linhas.map(t => t.id).sort()).toEqual([tarefa.id, daDemanda.id].sort());
    expect(tarefasNaEtapa.total).toBe(2);
    expect((await SD.demandasListar({ termo: 'Demanda do filtro' })).total).toBe(3);
    // Quando o Bruno filtra pelos grupos dele, e o master (sem grupo nenhum) também
    entrarComo('u-bruno');
    expect((await SD.demandasListar({ termo: 'Demanda do filtro', grupo: FILTRO_DOS_MEUS_GRUPOS })).linhas.map(d => d.id)).toEqual([doGrupo.id]);
    entrarComo('u-master');
    expect((await SD.demandasListar({ termo: 'Demanda do filtro', grupo: FILTRO_DOS_MEUS_GRUPOS })).total).toBe(0);
  });

  it('dado um item, quando recebe grupo demais, um que não existe ou um repetido, então o banco arruma ou recusa', async () => {
    // Dado
    const ids: string[] = [];
    for (let i = 0; i <= GRUPOS_POR_ITEM; i++) ids.push(await SD.grupoDaEquipeCriar(`Lote ${i}`));
    const { id } = await SD.demandaCriar({ titulo: 'Demanda do limite', responsavel_id: 'u-ana' });
    // Então
    await expect(SD.demandaAtualizar(id, { grupos: ids })).rejects.toThrow(`Um item pode ter até ${GRUPOS_POR_ITEM} grupos.`);
    await expect(SD.demandaAtualizar(id, { grupos: ['grupo-que-nao-existe'] })).rejects.toThrow('Grupo não encontrado neste escritório.');
    await SD.demandaAtualizar(id, { grupos: ids.slice(0, GRUPOS_POR_ITEM) });
    expect((await SD.demandaObter(id))?.grupos).toHaveLength(GRUPOS_POR_ITEM);
  });

  it('dado um contrato com o grupo do Bruno, então ele o vê sem os valores e não o altera; só quem é parte põe e tira grupos', async () => {
    // Dado
    const grupo = await nucleoComBruno();
    const k = await contratoDoMaster();
    entrarComo('u-bruno');
    expect(await SD.contratoVer(k.id)).toBeNull();
    await expect(SD.contratoDefinirGrupos(k.id, [grupo])).rejects.toThrow('Só quem é parte do contrato põe ou tira grupos.');
    // Quando
    entrarComo('u-ana');
    await SD.contratoDefinirGrupos(k.id, [grupo]);
    // Então
    entrarComo('u-bruno');
    expect(await SD.contratoVer(k.id)).toMatchObject({ ve_financeiro: false, valor: null, grupos: [grupo] });
    expect(await SD.contratoObter(k.id)).toBeNull();
    await SD.contratoAlterarSemValores(k.id, { servico: 'Serviço mudado pelo Bruno' });
    expect((await SD.contratoVer(k.id))?.servico).toBe('Serviço mudado pelo Bruno');
    await expect(SD.contratoDefinirGrupos(k.id, [])).rejects.toThrow('Só quem é parte do contrato põe ou tira grupos.');
  });

  it('dado o Bruno (advogado) só pelo grupo no contrato, quando a parte o menciona, então continua sem os valores; saindo do grupo, perde o contrato', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    await SD.equipeDefinirFuncao('u-bruno', 'advogado');
    const grupo = await nucleoComBruno();
    const k = await contratoDoMaster();
    await SD.contratoDefinirGrupos(k.id, [grupo]);
    // Quando
    entrarComo('u-master');
    const comentario = await SD.comentarioCriar('contratos', k.id, 'Veja isto, @bruno.souza');
    // Então
    entrarComo('u-bruno');
    expect(await SD.contratoVer(k.id)).toMatchObject({ ve_financeiro: false, valor: null });
    expect(await SD.contratoObter(k.id)).toBeNull();
    // Quando: a administradora o tira do grupo, e quem escreveu edita o comentário
    entrarComo('u-ana');
    await SD.grupoDaEquipeTirar(grupo, 'u-bruno');
    entrarComo('u-master');
    await SD.comentarioEditar(comentario.id, 'Veja isto de novo, @bruno.souza');
    // Então
    entrarComo('u-bruno');
    expect(await SD.contratoVer(k.id)).toBeNull();
    expect(await SD.contratoObter(k.id)).toBeNull();
  });

  it('dado o grupo em vários itens (um arquivado), quando a administradora conta e exclui o grupo, então ele sai de todos, com a linha no histórico', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    const grupo = await nucleoComBruno();
    const d1 = await SD.demandaCriar({ titulo: 'Demanda 1', responsavel_id: 'u-ana', grupos: [grupo] });
    const d2 = await SD.demandaCriar({ titulo: 'Demanda 2', responsavel_id: 'u-ana', grupos: [grupo] });
    await SD.demandasArquivar([d2.id]);
    await SD.tarefaCriar({ titulo: 'Tarefa', responsavel_id: 'u-ana', grupos: [grupo] });
    const k = await contratoDoMaster();
    await SD.contratoDefinirGrupos(k.id, [grupo]);
    // Quando
    const contagem = await SD.grupoDaEquipeContarItens(grupo);
    // Então
    expect(contagem).toEqual([{ modulo: 'demandas', quantos: 2 }, { modulo: 'tarefas', quantos: 1 }, { modulo: 'contratos', quantos: 1 }]);
    // Quando
    await SD.grupoDaEquipeExcluir(grupo);
    // Então
    expect((await SD.demandaObter(d2.id))?.grupos).toEqual([]);
    expect((await SD.demandaHistorico(d1.id))[0].alteracoes.grupos).toEqual({ de: 'Núcleo do Teste', para: null });
    expect(await grupos()).toEqual([]);
    entrarComo('u-bruno');
    expect(await SD.demandaObter(d1.id)).toBeNull();
    expect(await SD.contratoVer(k.id)).toBeNull();
  });

  it('dado o Bruno no grupo, quando o grupo é posto numa demanda, então ele recebe o aviso de inclusão; quem pôs, não', async () => {
    // Dado
    const grupo = await nucleoComBruno();
    const { id } = await SD.demandaCriar({ titulo: 'Demanda do aviso', responsavel_id: 'u-ana' });
    // Quando
    await SD.demandaAtualizar(id, { grupos: [grupo] });
    // Então
    expect((await SD.mensagensListar()).filter(m => m.tipo === 'inclusao')).toEqual([]);
    entrarComo('u-bruno');
    const [aviso] = (await SD.mensagensListar()).filter(m => m.tipo === 'inclusao');
    expect(aviso.inclusao).toMatchObject({ modulo: 'demandas', entrou_como: 'participante', item: { id }, grupo: 'Núcleo do Teste' });
  });

  it('dado o Bruno posto no grupo, quando ele abre a caixa, então há uma mensagem só, a do grupo, que se marca como lida; saindo logo, ela some', async () => {
    // Dado
    const grupo = await nucleoComBruno();
    // Quando
    entrarComo('u-bruno');
    const doGrupo = (await SD.mensagensListar()).filter(m => m.tipo === 'grupo');
    // Então
    expect(doGrupo.map(m => m.grupo)).toEqual([{ grupo_id: grupo, nome: 'Núcleo do Teste', incluido_por: 'u-ana' }]);
    expect(await SD.mensagensNaoLidas()).toBeGreaterThan(0);
    const antes = await SD.mensagensNaoLidas();
    await SD.mensagemMarcarLida(doGrupo[0].id);
    expect(await SD.mensagensNaoLidas()).toBe(antes - 1);
    // Quando: outro grupo, e a administradora o tira logo (o Desfazer)
    entrarComo('u-ana');
    const outro = await nucleoComBruno('Núcleo Dois');
    await SD.grupoDaEquipeTirar(outro, 'u-bruno');
    // Então
    entrarComo('u-bruno');
    expect((await SD.mensagensListar()).filter(m => m.tipo === 'grupo').map(m => m.grupo?.nome)).toEqual(['Núcleo do Teste']);
  });

  it('dado o grupo do Bruno nos itens, quando as bolinhas põem e tiram grupos, então cada módulo grava, e o contrato vai pela função dele', async () => {
    // Dado
    const grupo = await nucleoComBruno();
    const demanda = (await SD.demandaCriar({ titulo: 'Demanda das bolinhas', responsavel_id: 'u-ana' })).id;
    const tarefa = (await SD.tarefaCriar({ titulo: 'Tarefa das bolinhas', responsavel_id: 'u-ana' })).id;
    const anotacao = (await SD.anotacaoCriar({ titulo: 'Anotação das bolinhas', texto: '', responsavel_id: 'u-ana', participantes: [] }, [], [])).id;
    const k = await contratoDoMaster();
    entrarComo('u-master');
    // Quando
    await SD.itemDefinirGrupos('demandas', demanda, [grupo]);
    await SD.itemDefinirGrupos('tarefas', tarefa, [grupo]);
    await SD.itemDefinirGrupos('anotacoes', anotacao, [grupo]);
    await SD.itemDefinirGrupos('contratos', k.id, [grupo]);
    // Então
    expect((await SD.demandaObter(demanda))?.grupos).toEqual([grupo]);
    expect((await SD.tarefaObter(tarefa))?.grupos).toEqual([grupo]);
    expect((await SD.anotacaoObter(anotacao))?.grupos).toEqual([grupo]);
    expect((await SD.contratoObter(k.id))?.grupos).toEqual([grupo]);
    // Quando: o Bruno, que só está no contrato pelo grupo, tenta tirar o grupo dele
    entrarComo('u-bruno');
    // Então
    await expect(SD.itemDefinirGrupos('contratos', k.id, [])).rejects.toThrow('Só quem é parte do contrato põe ou tira grupos.');
    await expect(SD.itemDefinirGrupos('demandas', demanda, [grupo, 'grupo-que-nao-existe'])).rejects.toThrow('Grupo não encontrado neste escritório.');
  });

  it('dada a visualização fechada e itens vistos só pelo grupo, quando o Bruno tira o grupo, então é recusado (deixaria de vê-los); quem não altera, também', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    const grupo = await nucleoComBruno();
    const anotacao = (await SD.anotacaoCriar({ titulo: 'Anotação só do grupo', texto: '', responsavel_id: 'u-ana', participantes: [] }, [], [])).id;
    const outra = (await SD.anotacaoCriar({ titulo: 'Anotação sem o Bruno', texto: '', responsavel_id: 'u-ana', participantes: [] }, [], [])).id;
    await SD.itemDefinirGrupos('anotacoes', anotacao, [grupo]);
    entrarComo('u-bruno');
    expect((await SD.anotacaoObter(anotacao))?.titulo).toBe('Anotação só do grupo');
    entrarComo('u-ana');
    const demanda = (await SD.demandaCriar({ titulo: 'Demanda só do grupo', responsavel_id: 'u-ana' })).id;
    await SD.itemDefinirGrupos('demandas', demanda, [grupo]);
    entrarComo('u-bruno');
    // Quando / Então: as regras de leitura conferem a linha nova
    await expect(SD.itemDefinirGrupos('anotacoes', anotacao, [])).rejects.toThrow('Você não tem permissão para fazer isso.');
    await expect(SD.itemDefinirGrupos('demandas', demanda, [])).rejects.toThrow('Você não tem permissão para fazer isso.');
    expect((await SD.anotacaoObter(anotacao))?.grupos).toEqual([grupo]);
    expect((await SD.demandaObter(demanda))?.grupos).toEqual([grupo]);
    await expect(SD.itemDefinirGrupos('anotacoes', outra, [grupo])).rejects.toThrow('Você não tem permissão para fazer isso.');
  });

  it('dado um compromisso da Agenda geral de que o Bruno não participa, quando ele define os grupos, então é recusado, e nada muda', async () => {
    // Dado
    falso().fecharVisibilidade(true);
    const grupo = await nucleoComBruno();
    const c = await SD.compromissoCriar({ tipo: 'reuniao', titulo: 'Reunião da Agenda geral', data: hojeISO(), hora: '10:00', responsavel_id: 'u-ana', geral: true });
    entrarComo('u-bruno');
    expect((await SD.compromissoObter(c.id))?.titulo).toBe('Reunião da Agenda geral');
    // Quando / Então
    await expect(SD.itemDefinirGrupos('compromissos', c.id, [grupo])).rejects.toThrow('Você não tem permissão para fazer isso.');
    expect((await SD.compromissoObter(c.id))?.grupos).toEqual([]);
    // Quando: posto no compromisso pelo grupo, ele já altera
    entrarComo('u-ana');
    await SD.itemDefinirGrupos('compromissos', c.id, [grupo]);
    entrarComo('u-bruno');
    // Então
    await SD.itemDefinirGrupos('compromissos', c.id, [grupo]);
    expect((await SD.compromissoObter(c.id))?.grupos).toEqual([grupo]);
  });
});

// Os contatos que já estão na conta Google só existem no banco fictício (no banco de verdade, quem lê a conta é a função
// do servidor, provada em app/src/regras/sincronizacaoDeContatos.test.ts e supabase/tests/contatos_google_primeira.test.sql).
describe('Primeira sincronização com o Google Contatos (banco fictício)', () => {
  let SD: Dados;
  const reabrir = async () => { vi.resetModules(); return (await import('./falso')).SD; };
  /** Põe contatos na conta Google simulada (o que a conta do escritório já tinha antes de o SEMPER sincronizar). */
  const contatosNaConta = (contatos: unknown[]) => {
    const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { contatosGoogle: Record<string, unknown> };
    bd.contatosGoogle.noGoogle = contatos;
    sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
  };
  const pessoaPeloNome = async (nome: string) => (await SD.pessoasListar({ termo: nome })).linhas.find(p => p.nome === nome)!;
  const ligarTudo = async () => {
    const [, estado] = /estado=([0-9a-f]{64})/.exec(await SD.ligacaoGoogleIniciar('http://localhost:8091/configuracoes/'))!;
    await SD.ligacaoGoogleConcluir(estado, 'codigo');
    await SD.sincronizacaoGoogleLigar(true);
  };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    await ligarTudo();
    // Dado a conta com: um contato certo de uma pessoa da semente (nome e telefone), o telefone da recepção (de várias
    // pessoas da equipe) e um contato só com o nome de outra pessoa.
    contatosNaConta([
      { resourceName: 'people/c1', etag: 'e1', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '+55 38 99000-1000' }] },
      { resourceName: 'people/c2', etag: 'e2', names: [{ displayName: 'Recepção' }], phoneNumbers: [{ value: '(38) 3222-0000' }] },
      { resourceName: 'people/c3', etag: 'e3', names: [{ displayName: 'Maria Aparecida Exemplo' }] }
    ]);
    SD = await reabrir();
  });

  it('quando a primeira sincronização roda, então liga o certo, guarda as dúvidas e cria contatos só para quem ficou sem nenhum', async () => {
    // Quando
    const r = await SD.sincronizarGoogleAgora();
    // Então
    expect(r.primeira).toMatchObject({ ligados: 1, para_conferir: 2 });
    expect(r.sincronizados).toBe(r.primeira!.novos);
    const lista = await SD.contatosParaConferir();
    expect(lista.map(k => [k.nome, k.motivo])).toEqual([['Recepção', 'varios'], ['Maria Aparecida Exemplo', 'so-nome']]);
    expect(lista[1].candidatos.map(p => p.nome)).toEqual(['MARIA APARECIDA EXEMPLO']);
    expect(lista[0].candidatos.length).toBeGreaterThan(1);
    expect(await SD.sincronizacaoGoogle()).toMatchObject({ para_conferir: 2, pendentes: 0 });
  });

  it('dada uma dúvida, quando a pessoa dela é editada, então ela espera na fila até a decisão', async () => {
    // Dado
    await SD.sincronizarGoogleAgora();
    const maria = await pessoaPeloNome('MARIA APARECIDA EXEMPLO');
    // Quando
    await SD.pessoaAtualizar(maria.id, { tipo: 'pf', nome: 'MARIA APARECIDA EXEMPLO', telefones: ['38999990077'] });
    const r = await SD.sincronizarGoogleAgora();
    // Então
    expect(r.sincronizados).toBe(0);
    expect((await SD.sincronizacaoGoogle())?.pendentes).toBe(1);
  });

  it('quando o administrador marca "é outra pessoa", então a pessoa ganha um contato novo; ignorar não cria nada', async () => {
    // Dado
    await SD.sincronizarGoogleAgora();
    const [recepcao, maria] = await SD.contatosParaConferir();
    // Quando
    await SD.contatoParaConferirDecidir(maria.id, { acao: 'outra' });
    await SD.contatoParaConferirDecidir(recepcao.id, { acao: 'ignorar' });
    // Então
    expect(await SD.contatosParaConferir()).toEqual([]);
    expect(await SD.sincronizarGoogleAgora()).toEqual({ resultado: 'ok', sincronizados: 1, falhas: 0 });
  });

  it('quando o administrador liga um contato com várias pessoas possíveis a uma delas, então as outras ganham contato novo, e a escolhida não pode ser ligada de novo', async () => {
    // Dado
    await SD.sincronizarGoogleAgora();
    const [recepcao, maria] = await SD.contatosParaConferir();
    const [escolhida, ...outras] = recepcao.candidatos;
    // Quando
    await SD.contatoParaConferirDecidir(recepcao.id, { acao: 'ligar', pessoa_id: escolhida.id });
    // Então
    expect((await SD.sincronizarGoogleAgora()).sincronizados).toBe(outras.length);
    await expect(SD.contatoParaConferirDecidir(maria.id, { acao: 'ligar', pessoa_id: escolhida.id })).rejects.toThrow('Esta pessoa já está ligada a outro contato do Google');
    await expect(SD.contatoParaConferirDecidir(recepcao.id, { acao: 'ignorar' })).rejects.toThrow('Este contato já foi conferido');
  });

  it('dada uma conta comum, quando pede a lista ou decide, então não vê nada e é recusada', async () => {
    // Dado
    await SD.sincronizarGoogleAgora();
    const [recepcao] = await SD.contatosParaConferir();
    (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo('u-bruno');
    // Quando / Então
    expect(await SD.contatosParaConferir()).toEqual([]);
    await expect(SD.contatoParaConferirDecidir(recepcao.id, { acao: 'ignorar' })).rejects.toThrow('Apenas administradores decidem os contatos para conferir');
  });

  it('dada uma dúvida já decidida, quando a primeira sincronização é refeita, então ela não volta', async () => {
    // Dado
    await SD.sincronizarGoogleAgora();
    const [, maria] = await SD.contatosParaConferir();
    await SD.contatoParaConferirDecidir(maria.id, { acao: 'ignorar' });
    // Quando
    await SD.sincronizacaoGoogleLigar(false);
    await SD.sincronizacaoGoogleLigar(true);
    const r = await SD.sincronizarGoogleAgora();
    // Então
    expect(r.primeira?.ligados).toBe(0);
    expect((await SD.contatosParaConferir()).map(k => k.nome)).toEqual(['Recepção']);
  });

  it('dada uma dúvida já decidida, quando a conta Google é desligada e ligada de novo, então ela não volta (só as abertas somem)', async () => {
    // Dado
    await SD.sincronizarGoogleAgora();
    const [, maria] = await SD.contatosParaConferir();
    await SD.contatoParaConferirDecidir(maria.id, { acao: 'ignorar' });
    // Quando
    await SD.ligacaoGoogleDesligar();
    await ligarTudo();
    const r = await SD.sincronizarGoogleAgora();
    // Então
    expect(r.primeira?.para_conferir).toBe(1);
    expect((await SD.contatosParaConferir()).map(k => k.nome)).toEqual(['Recepção']);
  });

  it('dado um contato repetido no Google, quando a lista é lida, então a pessoa já ligada vem marcada como ligada (e ligar a ela é recusado)', async () => {
    // Dado: um segundo contato com o nome e o telefone da pessoa que o primeiro já liga
    contatosNaConta([
      { resourceName: 'people/c1', etag: 'e1', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '+55 38 99000-1000' }] },
      { resourceName: 'people/c4', etag: 'e4', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '(38) 99000-1000' }] },
      { resourceName: 'people/c3', etag: 'e3', names: [{ displayName: 'Maria Aparecida Exemplo' }] }
    ]);
    SD = await reabrir();
    await SD.sincronizarGoogleAgora();
    // Quando
    const [repetido, maria] = await SD.contatosParaConferir();
    // Então
    expect(repetido).toMatchObject({ motivo: 'repetido', candidatos: [{ ligada: true }] });
    expect(maria.candidatos.map(p => p.ligada)).toEqual([false]);
    await expect(SD.contatoParaConferirDecidir(repetido.id, { acao: 'ligar', pessoa_id: repetido.candidatos[0].id }))
      .rejects.toThrow('Esta pessoa já está ligada a outro contato do Google');
    await SD.contatoParaConferirDecidir(repetido.id, { acao: 'ignorar' });
    expect((await SD.contatosParaConferir()).map(k => k.nome)).toEqual(['Maria Aparecida Exemplo']);
  });

  it('dada uma dúvida aberta, quando a primeira sincronização refeita liga o contato dela, então a dúvida sai da lista', async () => {
    // Dado: Maria fica em dúvida (só o nome); depois ganha no SEMPER o telefone que o contato dela tem no Google
    await SD.sincronizarGoogleAgora();
    const maria = await pessoaPeloNome('MARIA APARECIDA EXEMPLO');
    await SD.pessoaAtualizar(maria.id, { tipo: 'pf', nome: 'MARIA APARECIDA EXEMPLO', telefones: ['38999990077'] });
    contatosNaConta([
      { resourceName: 'people/c1', etag: 'e1', names: [{ displayName: 'José da Silva Teste' }], phoneNumbers: [{ value: '+55 38 99000-1000' }] },
      { resourceName: 'people/c2', etag: 'e2', names: [{ displayName: 'Recepção' }], phoneNumbers: [{ value: '(38) 3222-0000' }] },
      { resourceName: 'people/c3', etag: 'e3', names: [{ displayName: 'Maria Aparecida Exemplo' }], phoneNumbers: [{ value: '(38) 99999-0077' }] }
    ]);
    SD = await reabrir();
    // Quando
    await SD.sincronizacaoGoogleLigar(false);
    await SD.sincronizacaoGoogleLigar(true);
    const r = await SD.sincronizarGoogleAgora();
    // Então
    expect(r.primeira).toMatchObject({ ligados: 1, para_conferir: 1 });
    expect((await SD.contatosParaConferir()).map(k => k.nome)).toEqual(['Recepção']);
    expect(await SD.sincronizacaoGoogle()).toMatchObject({ para_conferir: 1 });
  });

  it('dado o Google fora, quando o administrador pede "Sincronizar agora", então o resultado diz que a primeira não terminou e nada vai ao Google', async () => {
    // Dado
    const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { contatosGoogle: Record<string, unknown> };
    bd.contatosGoogle.googleFora = true;
    sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    SD = await reabrir();
    // Quando
    const r = await SD.sincronizarGoogleAgora();
    // Então
    expect(r).toEqual({ resultado: 'ok', sincronizados: 0, falhas: 0, primeira_por_fazer: true });
    expect((await SD.sincronizacaoGoogle())?.primeira_em).toBeNull();
  });
});

describe('Demanda contínua por grupo da equipe (banco fictício, #313)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void; fecharVisibilidade(ligada: boolean): void };
  const falso = () => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO;
  const entrarComo = (id: string) => falso().entrarComo(id);
  /** A tarefa avulsa (sem demanda) de quem está logado. */
  const avulsa = async (titulo: string, eu: string) => (await SD.tarefaCriar({ titulo, responsavel_id: eu, participantes: [], pessoas: [] })).id;
  const demandaDe = async (tarefa: string) => (await SD.tarefaObter(tarefa))?.demanda ?? null;
  /** A Ana (administradora) cria um grupo com o Bruno. */
  const nucleoComBruno = async (nome = 'Núcleo Cível') => {
    entrarComo('u-ana');
    const id = await SD.grupoDaEquipeCriar(nome);
    await SD.grupoDaEquipeIncluir(id, 'u-bruno');
    return id;
  };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    entrarComo('u-master');
  });
  afterEach(() => { falso().fecharVisibilidade(false); entrarComo('u-master'); });

  it('dado o Bruno sem grupo, quando cria uma tarefa sem demanda, então ela entra na contínua Geral, com o master como responsável', async () => {
    // Dado
    entrarComo('u-bruno');
    // Quando
    const id = await avulsa('Pagar a guia', 'u-bruno');
    // Então
    const d = await demandaDe(id);
    expect(d).toMatchObject({ titulo: tituloDaContinua('Geral'), continua: true, responsavel_id: 'u-master', criado_por: 'u-master' });
    expect(await SD.demandaObter(d!.id)).toMatchObject({ continua: true, continua_grupo_id: null, contrato_id: null });
  });

  it('dado o Bruno num grupo só, quando cria uma tarefa sem demanda, então ela entra na contínua do grupo; pedir a contínua de novo devolve a mesma', async () => {
    // Dado
    const grupo = await nucleoComBruno();
    entrarComo('u-bruno');
    // Quando
    const id = await avulsa('Ligar para o cartório', 'u-bruno');
    // Então
    const d = await demandaDe(id);
    expect(d).toMatchObject({ titulo: tituloDaContinua('Núcleo Cível'), continua: true });
    expect(await SD.demandaContinua(grupo)).toBe(d!.id);
    expect(await SD.demandaContinua(grupo)).toBe(d!.id);
  });

  it('dado o Bruno fora de um grupo, quando pede a contínua dele, então é recusado; a Geral ele usa', async () => {
    // Dado
    entrarComo('u-ana');
    const grupo = await SD.grupoDaEquipeCriar('Núcleo Penal');
    // Quando
    entrarComo('u-bruno');
    // Então
    await expect(SD.demandaContinua(grupo)).rejects.toThrow('Você não tem permissão para fazer isso.');
    await expect(SD.tarefaCriar({ titulo: 'X', responsavel_id: 'u-bruno', demanda_ids: [await adminPede(grupo)] })).rejects.toThrow('Demanda não encontrada neste escritório.');
    expect(await SD.demandaContinua(null)).toBeTruthy();
  });
  /** A Ana pede a contínua do grupo (e volta ao Bruno). */
  async function adminPede(grupo: string) {
    entrarComo('u-ana');
    const id = await SD.demandaContinua(grupo);
    entrarComo('u-bruno');
    return id;
  }

  it('dada a tarefa avulsa da Ana na Geral, quando o Bruno lê, então vê a contínua, mas não a tarefa dela (a contínua só agrupa)', async () => {
    // Dado
    entrarComo('u-ana');
    const id = await avulsa('Tarefa da Ana', 'u-ana');
    const geral = (await demandaDe(id))!.id;
    falso().fecharVisibilidade(true);
    // Quando
    entrarComo('u-bruno');
    // Então
    expect(await SD.demandaObter(geral)).toMatchObject({ continua: true });
    expect(await SD.tarefaObter(id)).toBeNull();
    expect((await SD.tarefasDaDemanda(geral)).map(t => t.id)).not.toContain(id);
  });

  it('dada a contínua, quando alguém tenta arquivá-la, concluí-la ou pôr colaboradores nela, então nada disso acontece', async () => {
    // Dado
    const id = await avulsa('Revisar', 'u-master');
    const continua = (await demandaDe(id))!.id;
    const concluida = (await SD.colunasListar('demandas')).find(c => c.marco === 'concluido')!.id;
    // Quando / Então
    expect(await SD.demandasArquivar([continua])).toBe(0);
    expect((await SD.demandaObter(continua))?.arquivado_em).toBeNull();
    await expect(SD.demandaMover(continua, concluida, 1)).rejects.toThrow(CONTINUA_NAO_CONCLUI);
    await expect(SD.demandaAtualizar(continua, { colaboradores: ['u-bruno'] })).rejects.toThrow(CONTINUA_SEM_EQUIPE);
    expect(await SD.demandaAtualizar(continua, { descricao: 'As soltas' })).toMatchObject({ id: continua });
  });

  it('dada uma tarefa avulsa, quando ganha uma demanda de verdade, então sai da contínua', async () => {
    // Dado
    const id = await avulsa('Juntar certidões', 'u-master');
    const d = await SD.demandaCriar({ titulo: 'Inventário', responsavel_id: 'u-master' });
    const continua = (await demandaDe(id))!.id;
    // Quando
    await SD.tarefaAtualizar(id, { demanda_ids: [continua, d.id] });
    // Então
    expect((await SD.tarefaObter(id))?.demanda_ids).toEqual([d.id]);
  });

  it('dado um grupo com contínua, quando é renomeado e depois excluído, então a contínua acompanha o nome e as tarefas dela vão para a Geral', async () => {
    // Dado
    const grupo = await nucleoComBruno('Núcleo A');
    entrarComo('u-bruno');
    const id = await avulsa('Do núcleo', 'u-bruno');
    const doGrupo = (await demandaDe(id))!.id;
    entrarComo('u-ana');
    // Quando
    await SD.grupoDaEquipeRenomear(grupo, 'Núcleo Cível');
    // Então
    expect((await SD.demandaObter(doGrupo))?.titulo).toBe(tituloDaContinua('Núcleo Cível'));
    // Quando
    await SD.grupoDaEquipeExcluir(grupo);
    // Então
    const agora = await demandaDe(id);
    expect(agora).toMatchObject({ titulo: tituloDaContinua('Geral'), continua: true });
    expect(await SD.demandaObter(doGrupo)).toBeNull();
  });
});

describe('Aprovação interna da tarefa (banco fictício, #313)', () => {
  let SD: Dados;
  type Falso = { entrarComo(id: string): void };
  const entrarComo = (id: string) => (window as unknown as { SEMPER_FALSO: Falso }).SEMPER_FALSO.entrarComo(id);
  const colunas = async () => SD.colunasListar('tarefas');
  const coluna = async (qual: (c: Awaited<ReturnType<typeof colunas>>[number]) => boolean) => (await colunas()).find(qual)!.id;
  /** O Mauro (administrador) pede ao Bruno uma tarefa com aprovação, em "Fazendo". */
  const pedidaAoBruno = async (precisa = true) => {
    entrarComo('u-master');
    const { id } = await SD.tarefaCriar({ titulo: 'Minutar a petição', responsavel_id: 'u-bruno', solicitante_id: 'u-master', precisa_aprovacao: precisa,
      participantes: [], pessoas: [], etapa_id: await coluna(c => c.nome === 'Fazendo') });
    return id;
  };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    SD = (await import('./falso')).SD;
    entrarComo('u-master');
  });
  afterEach(() => entrarComo('u-master'));

  it('dado o quadro de tarefas, quando é lido, então tem uma coluna de aprovação, a "Aguardando: análise do solicitante", que não se exclui', async () => {
    // Quando
    const aprovacao = (await colunas()).filter(c => c.de_aprovacao);
    // Então
    expect(aprovacao.map(c => c.nome)).toEqual(['Aguardando: análise do solicitante']);
    await expect(SD.colunaExcluir(aprovacao[0].id)).rejects.toThrow('A coluna de aprovação das tarefas não pode ser excluída.');
  });

  it('dada a tarefa com aprovação, quando o Bruno (quem executa) a conclui, então ela fica na coluna de aprovação, sem data de conclusão, e ele não se aprova', async () => {
    // Dado
    const id = await pedidaAoBruno();
    entrarComo('u-bruno');
    // Quando
    const ficou = await SD.tarefaMover(id, await coluna(c => c.marco === 'concluido'), 1);
    // Então
    expect(ficou).toBe(await coluna(c => !!c.de_aprovacao));
    expect(await SD.tarefaObter(id)).toMatchObject({ etapa_id: ficou, concluida_em: null, precisa_aprovacao: true });
    await expect(SD.tarefaAprovar(id)).rejects.toThrow(SO_QUEM_PEDIU_APROVA);
    await expect(SD.tarefaAtualizar(id, { precisa_aprovacao: false })).rejects.toThrow(SO_QUEM_PEDIU_MUDA_A_APROVACAO);
    await expect(SD.tarefaAtualizar(id, { solicitante_id: 'u-bruno' })).rejects.toThrow(SO_QUEM_PEDIU_MUDA_A_APROVACAO);
  });

  it('dada a tarefa na aprovação, quando o Mauro a devolve com um comentário, então ela volta para "Fazendo" e o comentário fica no cartão', async () => {
    // Dado
    const id = await pedidaAoBruno();
    entrarComo('u-bruno');
    await SD.tarefaMover(id, await coluna(c => c.marco === 'concluido'), 1);
    entrarComo('u-master');
    // Quando
    await expect(SD.tarefaDevolver(id, '  ')).rejects.toThrow(SEM_COMENTARIO_DA_DEVOLUCAO);
    const voltou = await SD.tarefaDevolver(id, ' Falta o pedido de tutela. ');
    // Então
    expect(voltou).toBe(await coluna(c => c.nome === 'Fazendo'));
    expect((await SD.tarefaObter(id))?.etapa_id).toBe(voltou);
    expect((await SD.comentariosListar('tarefas', id)).map(c => [c.autor_id, c.texto])).toEqual([['u-master', 'Tarefa devolvida: Falta o pedido de tutela.']]);
    await expect(SD.tarefaDevolver(id, 'De novo')).rejects.toThrow(NAO_ESPERA_APROVACAO);
  });

  it('dada a tarefa na aprovação, quando o Mauro aprova, então ela vai para as concluídas, com a data de conclusão', async () => {
    // Dado
    const id = await pedidaAoBruno();
    entrarComo('u-bruno');
    await SD.tarefaMover(id, await coluna(c => c.marco === 'concluido'), 1);
    entrarComo('u-master');
    // Quando
    const foi = await SD.tarefaAprovar(id);
    // Então
    expect(foi).toBe(await coluna(c => c.marco === 'concluido'));
    expect((await SD.tarefaObter(id))?.concluida_em).toBeTruthy();
  });

  it('dada a tarefa sem aprovação, quando o Bruno a conclui, então ela vai direto para as concluídas (como antes)', async () => {
    // Dado
    const id = await pedidaAoBruno(false);
    entrarComo('u-bruno');
    // Quando
    const ficou = await SD.tarefaMover(id, await coluna(c => c.marco === 'concluido'), 1);
    // Então
    expect(ficou).toBe(await coluna(c => c.marco === 'concluido'));
  });
});
