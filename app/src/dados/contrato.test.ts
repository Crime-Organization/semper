// @vitest-environment jsdom
// Contrato da camada de dados: o que as telas pressupõem de qualquer implementação de Dados.
// Hoje roda no banco fictício (falso.ts), que substitui o Supabase em "npm run teste" e nos testes de ponta a ponta:
// se ele se comportar diferente do banco de verdade, os testes das telas passam por engano.
// Para rodar também no Supabase (com um Supabase local), basta chamar contrato() com a outra implementação.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dados } from './tipos';

function contrato(nome: string, abrir: () => Promise<Dados>) {
  describe(`Contrato da camada de dados (${nome})`, () => {
    let SD: Dados;
    beforeEach(async () => { SD = await abrir(); });

    // Cada caso cria os próprios cadastros, com um marcador no nome, para não depender da semente.
    const marca = () => 'CONTRATO ' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const criar = (nome: string, extra: Parameters<Dados['pessoaCriar']>[0] = {}) => SD.pessoaCriar({ tipo: 'pf', nome, ...extra });

    describe('Pessoas', () => {
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
    });

    describe('Listas das demandas', () => {
      const novaDemanda = async () => (await SD.demandaCriar({ titulo: 'Com listas', responsavel_id: 'u-master' })).id;

      it('quando uma lista é criada com itens, então ela vem no fim da demanda, com os itens na ordem, por fazer', async () => {
        // Dado
        const demanda = await novaDemanda();
        await SD.listaCriar(demanda, 'Primeira');
        // Quando
        await SD.listaCriar(demanda, '  Pessoa jurídica ', ['Atos constitutivos', 'Quadro de sócios']);
        // Então
        const listas = await SD.listasDaDemanda(demanda);
        expect(listas.map(l => l.nome)).toEqual(['Primeira', 'Pessoa jurídica']);
        expect(listas[1].itens.map(i => [i.texto, i.feito_em])).toEqual([['Atos constitutivos', null], ['Quadro de sócios', null]]);
      });

      it('quando um item é marcado, então fica com a hora e quem marcou; desmarcado, perde os dois', async () => {
        // Dado
        const lista = await SD.listaCriar(await novaDemanda(), 'Documentos');
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
        const lista = await SD.listaCriar(demanda, 'Documentos', ['A', 'B']);
        // Quando
        await SD.itemAtualizar(lista.itens[0].id, { prazo: '2030-11-10', ordem: 3 });
        await SD.listaAtualizar(lista.id, { nome: 'Documentos do cliente' });
        // Então
        const [lida] = await SD.listasDaDemanda(demanda);
        expect(lida.nome).toBe('Documentos do cliente');
        expect(lida.itens.map(i => [i.texto, i.prazo])).toEqual([['B', null], ['A', '2030-11-10']]);
      });

      it('quando a lista é excluída, então os itens vão junto', async () => {
        // Dado
        const demanda = await novaDemanda();
        const lista = await SD.listaCriar(demanda, 'Para apagar', ['Item']);
        // Quando
        await SD.listaExcluir(lista.id);
        // Então
        expect(await SD.listasDaDemanda(demanda)).toEqual([]);
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
        await SD.listaCriar(demanda, m.nome, m.itens);
        // Quando
        await SD.modeloAtualizar(m.id, { itens: ['Outra coisa'] });
        // Então
        const [lista] = await SD.listasDaDemanda(demanda);
        expect(lista.itens.map(i => i.texto)).toEqual(['Procuração']);
      });
    });

    describe('Ligação com a conta Google', () => {
      it('quando nenhuma conta foi ligada, então não há ligação, e desligar não dá erro', async () => {
        // Quando
        await SD.ligacaoGoogleDesligar();
        // Então
        expect(await SD.ligacaoGoogle()).toBeNull();
      });

      it('quando a ligação começa, então devolve o endereço para onde o navegador vai', async () => {
        // Quando
        const endereco = await SD.ligacaoGoogleIniciar('http://localhost:8091/configuracoes/');
        // Então (o banco de verdade leva à função do servidor; o fictício volta já com a conta ligada)
        expect(endereco).toMatch(/google-conectar\?estado=[0-9a-f]{64}$|\/configuracoes\/\?google=ligado$/);
        await SD.ligacaoGoogleDesligar();
        expect(await SD.ligacaoGoogle()).toBeNull();
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
