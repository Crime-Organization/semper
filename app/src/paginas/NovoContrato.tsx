// Cadastro de contrato numa página só (também usado para atualizar: /contratos/novo/?id=...).
// Os quatro campos obrigatórios vêm primeiro; os demais ficam sempre à mostra, sem obrigar.
// O número do contrato é dado pelo banco ao salvar e nunca muda.
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type Contrato, type DadosContrato, type PessoaLista } from '../dados';
import { TAMANHO_CONTRATO } from '../dados/limites';
import {
  calculadosDoContrato, camposDoContrato, CATEGORIAS, CONTRATO_VAZIO, dadosDoContrato, dinheiroNoCampo, fmtDinheiro, fmtPercentual,
  lerDinheiro, PERCENTUAIS_ESCRITORIO, validarContrato, type CamposContrato
} from '../regras/contrato';
import { MASCARAS } from '../regras/pessoa';
import { falha, feito } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, naGrade, Nota, TituloSecao, type TamanhoNaGrade } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { ordemNoFim } from '../ui/quadro/posicao';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import './Contratos.css';

type Escolhida = Pick<PessoaLista, 'id' | 'nome'> | null;
/** As três pessoas do contrato escolhidas pela busca, e o campo de cada uma no formulário. */
const PAPEIS = {
  cliente: { campo: 'clienteId', percentual: null },
  participante: { campo: 'participanteId', percentual: 'participantePercentual' },
  indicador: { campo: 'indicadorId', percentual: 'indicadorPercentual' }
} as const satisfies Record<string, { campo: keyof CamposContrato; percentual: keyof CamposContrato | null }>;
type Papel = keyof typeof PAPEIS;

export default function NovoContrato() {
  const ctx = useCtx();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const idAtualizar = params.get('id');
  const etapaInicial = params.get('etapa');
  const membros = ctx.equipe.filter(m => m.ativo);

  const [c, setC] = useState<CamposContrato>(() => ({ ...CONTRATO_VAZIO, responsavelId: membros.some(m => m.id === ctx.perfil.id) ? ctx.perfil.id : '' }));
  const [pessoas, setPessoas] = useState<Record<Papel, Escolhida>>({ cliente: null, participante: null, indicador: null });
  const [alvo, setAlvo] = useState<Contrato | null>(null);   // contrato sendo atualizado
  const [pronto, setPronto] = useState(!idAtualizar);
  // Os erros aparecem depois da primeira tentativa de salvar e, daí em diante, acompanham o que se digita.
  const [tentou, setTentou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useTitulo(alvo ? 'Atualizar contrato' : 'Novo contrato');

  useEffect(() => {
    if (!idAtualizar) return;
    SD.contratoObter(idAtualizar)
      .then(k => {
        if (!k) throw new Error('Contrato não encontrado.');
        setAlvo(k);
        setC(camposDoContrato(k));
        setPessoas({ cliente: k.cliente, participante: k.participante, indicador: k.indicador });
      })
      .catch(falha)
      .finally(() => setPronto(true));
  // oxlint-disable-next-line react/exhaustive-deps -- carrega o contrato a atualizar uma vez só, ao abrir o formulário
  }, []);

  const erros = tentou ? validarContrato(c) : {};
  const calculados = calculadosDoContrato(c);
  const mudar = (campos: Partial<CamposContrato>) => setC(atual => ({ ...atual, ...campos }));
  // Tirar o participante ou o indicador tira também o percentual dele.
  const escolher = (papel: Papel) => (p: PessoaLista | null) => {
    const { campo, percentual } = PAPEIS[papel];
    setPessoas(x => ({ ...x, [papel]: p }));
    mudar({ [campo]: p?.id ?? '', ...(percentual && !p ? { [percentual]: '' } : {}) });
  };
  // Quem pode ser responsável: a equipe ativa e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = [...membros, ...ctx.equipe.filter(m => !m.ativo && m.id === c.responsavelId)];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (Object.keys(validarContrato(c)).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.com-erro input, .com-erro select, .com-erro textarea')?.focus());
      return;
    }
    const dados = dadosDoContrato(c);
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: os valores que esta gravação vai trocar.
        const registro = alvo as unknown as Record<string, unknown>;
        const antes = Object.fromEntries(Object.keys(dados).map(k => [k, registro[k] ?? null])) as DadosContrato;
        await SD.contratoAtualizar(alvo.id, dados);
        feito('Contrato atualizado.', 'atualização do contrato', async () => {
          await SD.contratoAtualizar(alvo.id, antes);
          return { tipo: 'contratoAtualizado', id: alvo.id };
        });
        navegar('/contratos/?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, o contrato novo entra na primeira coluna do quadro.
        const etapa = etapaInicial || (await SD.colunasListar('contratos')).sort((a, b) => a.ordem - b.ordem)[0]?.id || null;
        const r = await SD.contratoCriar({ ...dados, etapa_id: etapa, etapa_ordem: etapa ? ordemNoFim() : null });
        feito(`Contrato ${r.codigo} cadastrado.`, 'cadastro do contrato', async () => {
          await SD.contratosArquivar([r.id], true);
          const x = await SD.contratosExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'contratoCriado', id: r.id };
        });
        navegar('/contratos/?id=' + r.id);
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  // ---------- pedaços do formulário ----------
  // Cada campo diz quantas das 12 colunas ocupa (veja naGrade). O id liga o rótulo e o erro ao campo.
  const id = (nome: keyof CamposContrato) => 'contrato-' + nome;
  const obrigatorio = <span className="req" aria-hidden="true">*</span>;
  const campo = (nome: keyof CamposContrato, rotulo: ReactNode, tam: TamanhoNaGrade, entrada: ReactNode, dica?: string) =>
    <div className={'campo-form' + (erros[nome] ? ' com-erro' : '')} style={naGrade(tam)}>
      <label htmlFor={id(nome)}>{rotulo}{dica && <small> {dica}</small>}</label>
      {entrada}
      {erros[nome] && <span className="erro-campo" id={id(nome) + '-erro'} role="alert">{erros[nome]}</span>}
    </div>;
  const acessivel = (nome: keyof CamposContrato) => ({ id: id(nome), 'aria-invalid': erros[nome] ? true : undefined, 'aria-describedby': erros[nome] ? id(nome) + '-erro' : undefined });
  const texto = (nome: keyof CamposContrato, props: InputHTMLAttributes<HTMLInputElement> = {}) =>
    <input type="text" {...acessivel(nome)} value={c[nome]} onChange={e => mudar({ [nome]: e.target.value })} {...props} />;
  // Valor em reais: ao sair do campo, fica no formato 1.500,00 (se der para ler).
  const dinheiro = (nome: 'valor' | 'entrada' | 'descontos') => texto(nome, {
    inputMode: 'decimal', placeholder: '0,00',
    onBlur: e => { try { mudar({ [nome]: dinheiroNoCampo(lerDinheiro(e.target.value)) }); } catch { /* o erro aparece ao salvar */ } }
  });
  const data = (nome: 'assinadoEm' | 'primeiroPagamento') =>
    texto(nome, { inputMode: 'numeric', placeholder: 'DD/MM/AAAA', onChange: e => mudar({ [nome]: MASCARAS.data(e.target.value) }) });
  const percentual = (nome: 'participantePercentual' | 'indicadorPercentual', semPessoa: boolean) =>
    texto(nome, { inputMode: 'decimal', placeholder: '0', disabled: semPessoa });
  const pessoa = (papel: Papel, rotulo: ReactNode, tam: TamanhoNaGrade, desativar?: (p: PessoaLista) => string | null) => {
    const nome = PAPEIS[papel].campo;
    return <div className={'campo-form' + (erros[nome] ? ' com-erro' : '')} style={naGrade(tam)}>
      <BuscaPessoa rotulo={rotulo} escolhida={pessoas[papel]} aoEscolher={escolher(papel)} desativar={desativar} />
      {erros[nome] && <span className="erro-campo" role="alert">{erros[nome]}</span>}
    </div>;
  };
  const calculado = (rotulo: string, valor: string, tam: TamanhoNaGrade) =>
    <div className="campo-form" style={naGrade(tam)}>
      <span className="rotulo-calculado">{rotulo} <small>calculado</small></span>
      <output className="contrato-calculado" aria-label={rotulo}>{valor || '—'}</output>
    </div>;

  const voltar = idAtualizar ? '/contratos/?id=' + idAtualizar : '/contratos/';
  return <div className="miolo">
    <header>
      <p className="olho"><Link to={voltar}>Contratos</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar contrato' : 'Novo contrato'}<span className="ponto">.</span></h1>
      {!alvo && <p className="lead">O número é dado ao salvar: a sigla do responsável, o número do contrato no escritório e o ano. Ele nunca muda.</p>}
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando o contrato <b>{alvo.codigo}</b> de <b>{alvo.cliente.nome}</b>. O número não muda, e as informações anteriores ficam no histórico.</Aviso>}

    {!pronto ? <Carregando /> : <form className="contrato-form campos" noValidate autoComplete="off" onSubmit={salvar}>
      <section className="cartao form-grade" aria-labelledby="tContrato">
        <TituloSecao id="tContrato">Contrato</TituloSecao>
        <div className="grade-form">
          {pessoa('cliente', <>Cliente{obrigatorio}</>, { m: 12, g: 7 })}
          {campo('responsavelId', <>Advogado responsável{obrigatorio}</>, { m: 6, g: 5 },
            <select {...acessivel('responsavelId')} value={c.responsavelId} onChange={e => mudar({ responsavelId: e.target.value })}>
              <option value="">Escolha…</option>
              {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>)}
          {campo('servico', <>Serviço (objeto do contrato){obrigatorio}</>, { m: 12, g: 8 },
            texto('servico', { maxLength: TAMANHO_CONTRATO.servico, placeholder: 'Ex.: Registro da marca no INPI' }))}
          {campo('categoria', <>Categoria de honorário{obrigatorio}</>, { m: 6, g: 4 },
            <select {...acessivel('categoria')} value={c.categoria} onChange={e => mudar({ categoria: e.target.value as CamposContrato['categoria'] })}>
              <option value="">Escolha…</option>
              {Object.entries(CATEGORIAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>)}
          {campo('codigoAntigo', 'Código antigo', { m: 6, g: 4 }, texto('codigoAntigo', { maxLength: TAMANHO_CONTRATO.codigo_antigo, className: 'caixa-alta' }), 'das planilhas, se houver')}
        </div>
        <Nota>{alvo ? 'Trocar o responsável não muda o número do contrato.'
          : 'A sigla do número vem do nome e do CPF do responsável, do cadastro dele em Pessoas.'}</Nota>
      </section>

      <section className="cartao form-grade" aria-labelledby="tHonorarios">
        <TituloSecao id="tHonorarios">Honorários</TituloSecao>
        <div className="grade-form">
          {campo('valor', 'Valor do contrato', { m: 6, g: 3 }, dinheiro('valor'))}
          {campo('entrada', 'Entrada', { m: 6, g: 3 }, dinheiro('entrada'))}
          {campo('parcelas', 'Parcelas', { p: 6, m: 4, g: 2 }, texto('parcelas', { inputMode: 'numeric', placeholder: '1' }))}
          {calculado('Valor da parcela', fmtDinheiro(calculados.parcela), { p: 6, m: 4, g: 2 })}
          {campo('descontos', 'Descontos', { m: 4, g: 2 }, dinheiro('descontos'))}
          {campo('assinadoEm', 'Assinado em', { p: 6, m: 6, g: 3 }, data('assinadoEm'))}
          {campo('primeiroPagamento', 'Primeiro pagamento', { p: 6, m: 6, g: 3 }, data('primeiroPagamento'))}
        </div>
        <Nota>Com entrada, ela conta como a primeira parcela: as demais dividem o que sobra.</Nota>
      </section>

      <section className="cartao form-grade" aria-labelledby="tDivisao">
        <TituloSecao id="tDivisao">Divisão</TituloSecao>
        <div className="grade-form">
          {campo('percentualEscritorio', 'Enviado ao escritório', { m: 6, g: 4 },
            <select {...acessivel('percentualEscritorio')} value={c.percentualEscritorio} onChange={e => mudar({ percentualEscritorio: e.target.value })}>
              <option value="">A definir</option>
              {PERCENTUAIS_ESCRITORIO.map(v => <option key={v} value={v}>{v}% do que o cliente pagar</option>)}
            </select>, 'conta PJ')}
          {calculado('Fica com o responsável', fmtPercentual(calculados.responsavel), { m: 6, g: 4 })}
          {pessoa('participante', 'Participante', { m: 8, g: 9 }, p => p.id === c.indicadorId ? 'já é o indicador' : null)}
          {campo('participantePercentual', '% do participante', { m: 4, g: 3 }, percentual('participantePercentual', !c.participanteId))}
          {pessoa('indicador', 'Indicador', { m: 8, g: 9 }, p => p.id === c.participanteId ? 'já é o participante' : null)}
          {campo('indicadorPercentual', '% do indicador', { m: 4, g: 3 }, percentual('indicadorPercentual', !c.indicadorId))}
        </div>
        <Nota>O indicador pode ser da equipe ou um parceiro de fora; os dois precisam estar cadastrados em Pessoas.</Nota>
      </section>

      <section className="cartao form-grade" aria-labelledby="tDocumento">
        <TituloSecao id="tDocumento">Documento e observações</TituloSecao>
        <div className="grade-form">
          {campo('documentoUrl', 'Link do contrato no Drive', {}, texto('documentoUrl', { type: 'url', inputMode: 'url', maxLength: TAMANHO_CONTRATO.documento_url, placeholder: 'https://drive.google.com/…' }))}
          {campo('observacoes', 'Observações', {},
            <textarea {...acessivel('observacoes')} maxLength={TAMANHO_CONTRATO.observacoes} value={c.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />)}
        </div>
      </section>

      {tentou && Object.keys(erros).length > 0 && <Aviso tipo="erro">Confira os campos marcados antes de salvar.</Aviso>}
      <div className="contrato-salvar">
        <Link className={estiloBotao()} to={voltar}>Cancelar</Link>
        <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>
          {ocupado ? 'Salvando…' : alvo ? 'Salvar alterações' : 'Salvar contrato'}
        </button>
      </div>
    </form>}
  </div>;
}
