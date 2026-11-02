// @vitest-environment jsdom
// Contrato da camada de dados: o que as telas pressupõem de qualquer implementação de Dados.
// Hoje roda no banco fictício (falso.ts), que substitui o Supabase em "npm run teste" e nos testes de ponta a ponta:
// se ele se comportar diferente do banco de verdade, os testes das telas passam por engano.
// Para rodar também no Supabase (com um Supabase local), basta chamar contrato() com a outra implementação.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dados, DadosPessoa, ItemImportacao } from './tipos';
import { camposDoPerfil, perfilVazio } from '../regras/perfilProfissional';
import { normal } from '../regras/texto';
import { DIA } from '../ui/tempos';
import { hojeISO } from '../ui/util';

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
        expect(colunas.filter(c => c.marco)).toHaveLength(1);
        await expect(excluir).rejects.toThrow('a coluna-marco não pode ser excluída');
        expect((await SD.colunasListar('contratos')).some(c => c.id === marco.id)).toBe(true);
      });

      it('quando as colunas de contratos são listadas, então são as do quadro de contratos, não as de pessoas', async () => {
        // Quando
        const contratos = (await SD.colunasListar('contratos')).map(c => c.nome);
        const pessoas = (await SD.colunasListar('pessoas')).map(c => c.nome);
        // Então
        expect(contratos).toEqual(['Em negociação', 'Aguardando assinatura', 'Assinado / em andamento', 'Encerrado', 'Rescindido']);
        expect(pessoas).not.toContain('Em negociação');
      });
    });

    describe('Comentários', () => {
      // Quem está logado é o Mateus (@mateus.goncalves, advogado); a Ana é advogada e o Bruno, estagiário.
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
    });

    describe('Demandas', () => {
      // Quem está logado é o Mateus (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const novaDemanda = (extra: Parameters<Dados['demandaCriar']>[0] = {}) =>
        SD.demandaCriar({ titulo: 'Pedido de registro de marca', responsavel_id: 'u-ana', ...extra });
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
        // Dado (a demanda é da Ana, com o Bruno de fora; o Mateus, administrador, vê todas)
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

    describe('Processos', () => {
      // Quem está logado é o Mateus (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
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

      it('quando o quadro é listado, então cada tipo tem as suas colunas, com início e fim marcados, e os grupos', async () => {
        // Quando
        const [judiciais, administrativas, grupos] = await Promise.all([SD.colunasListar('processos_judiciais'), SD.colunasListar('processos_administrativos'), SD.gruposListar('processos_judiciais')]);
        // Então
        expect(judiciais).toHaveLength(29);
        expect(administrativas).toHaveLength(20);
        expect(judiciais.filter(c => c.marco).map(c => [c.nome, c.marco])).toEqual([['Distribuído', 'inicio'], ['Baixado/arquivado', 'concluido']]);
        expect(administrativas.filter(c => c.marco).map(c => [c.nome, c.marco])).toEqual([['Protocolado', 'inicio'], ['Arquivado/baixado', 'concluido']]);
        expect(grupos.map(g => [g.nome, g.comeca_fechado])).toContainEqual(['Encerrado', true]);
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

      it('quando a tarefa aponta um processo que não existe, ou tenta trocar a ligação, então é recusado', async () => {
        // Dado
        const p = await novoProcesso();
        const t = await SD.tarefaCriar({ titulo: 'Ligada', responsavel_id: 'u-ana', processo_id: p.id });
        // Quando
        const inexistente = SD.tarefaCriar({ titulo: 'Fora', responsavel_id: 'u-ana', processo_id: 'nao-existe' });
        const trocar = SD.tarefaAtualizar(t.id, { processo_id: null } as Parameters<Dados['tarefaAtualizar']>[1]);
        // Então
        await expect(inexistente).rejects.toThrow('Processo não encontrado neste escritório.');
        await expect(trocar).rejects.toThrow('Você não tem permissão para fazer isso.');
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
      // Quem está logado é o Mateus (administrador). Na equipe: Ana (advogada), Bruno (estagiário).
      const novaTarefa = (extra: Parameters<Dados['tarefaCriar']>[0] = {}) =>
        SD.tarefaCriar({ titulo: 'Emitir a GRU', responsavel_id: 'u-ana', ...extra });

      it('quando uma tarefa é criada, então ganha um código curto, e o responsável não fica entre os participantes', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        // Quando
        const { id, codigo } = await novaTarefa({ titulo: '  Pedir documentos  ', participantes: ['u-bruno', 'u-ana', 'u-bruno'], pessoas: [pessoa, pessoa] });
        // Então
        expect(codigo).toMatch(/^[0-9A-F]{8}$/);
        expect(await SD.tarefaObter(id)).toMatchObject({ titulo: 'Pedir documentos', responsavel_id: 'u-ana', participantes: ['u-bruno'],
          pessoas: [{ id: pessoa }], demanda: null, contrato: null });
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

      it('quando as colunas de tarefas são listadas, então "Para fazer" e "Concluída" são as colunas-marco', async () => {
        // Quando
        const colunas = await SD.colunasListar('tarefas');
        // Então
        expect(colunas.map(c => [c.nome, c.marco ?? null])).toEqual([['Para fazer', 'inicio'], ['Fazendo', null], ['Aguardando retorno', null], ['Concluída', 'concluido']]);
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
      // Quem está logado é o Mateus (administrador): vê os registros de todos.
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

    describe('Listas das demandas e das tarefas', () => {
      const novaDemanda = async () => (await SD.demandaCriar({ titulo: 'Com listas', responsavel_id: 'u-master' })).id;

      it('quando uma lista é criada com itens, então ela vem no fim da demanda, com os itens na ordem, por fazer', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar('demandas', demanda, 'Primeira');
        // Quando
        await SD.listaCriar('demandas', demanda, '  Pessoa jurídica ', ['Atos constitutivos', 'Quadro de sócios']);
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
        const lista = await SD.listaCriar('demandas', demanda, 'Documentos', ['A', 'B']);
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
        const lista = await SD.listaCriar('demandas', demanda, 'Para apagar', ['Item']);
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
        const lista = await SD.listaCriar('tarefas', tarefa, ' Documentos ', ['Procuração', 'Contrato social']);
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
        await SD.listaCriar('tarefas', tarefa, 'Documentos', ['Procuração']);
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
        const m = await SD.modeloCriar('  ' + nome + ' ', [' Procuração ', '', 'Contrato social']);
        // Então
        const lista = await SD.modelosListar();
        expect(lista.find(x => x.id === m.id)).toMatchObject({ nome, itens: ['Procuração', 'Contrato social'] });
        expect(lista.map(x => x.nome)).toEqual(lista.map(x => x.nome).toSorted((a, b) => a.localeCompare(b, 'pt-BR')));
      });

      it('quando já existe um modelo com o mesmo nome, então criar outro é recusado com a mensagem em português', async () => {
        // Dado
        const nome = 'Modelo ' + marca();
        await SD.modeloCriar(nome, ['A']);
        // Quando
        const repetido = SD.modeloCriar(nome.toLowerCase(), ['B']);
        // Então
        await expect(repetido).rejects.toThrow('Já existe um modelo de lista com esse nome.');
      });

      it('quando o modelo é editado, então muda; e excluído, some da lista', async () => {
        // Dado
        const m = await SD.modeloCriar('Modelo ' + marca(), ['A']);
        // Quando
        await SD.modeloAtualizar(m.id, { itens: ['A', 'B'] });
        const editado = (await SD.modelosListar()).find(x => x.id === m.id);
        await SD.modeloExcluir(m.id);
        // Então
        expect(editado?.itens).toEqual(['A', 'B']);
        expect((await SD.modelosListar()).some(x => x.id === m.id)).toBe(false);
      });

      it('quando um modelo é usado numa demanda e depois muda, então a lista da demanda continua como estava', async () => {
        // Dado
        const m = await SD.modeloCriar('Modelo ' + marca(), ['Procuração']);
        const { id: demanda } = await SD.demandaCriar({ titulo: 'Com modelo', responsavel_id: 'u-master' });
        await SD.listaCriar('demandas', demanda, m.nome, m.itens);
        // Quando
        await SD.modeloAtualizar(m.id, { itens: ['Outra coisa'] });
        // Então
        const [lista] = await SD.listasDoCartao('demandas', demanda);
        expect(lista.itens.map(i => i.texto)).toEqual(['Procuração']);
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

    describe('Sessão', () => {
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
