// Cadastro de contrato numa página só (também usado para atualizar: /contratos/novo/?id=...).
// Os quatro campos obrigatórios vêm primeiro; os demais ficam sempre à mostra, sem obrigar. O contrato tem um ou mais
// objetos, um por linha, com as sugestões da lista do escritório.
// O número do contrato é dado pelo banco ao salvar e nunca muda.
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type Contrato, type DadosContrato, type PessoaLista } from '../dados';
import { OBJETOS_MAXIMOS, TAMANHO_CONTRATO } from '../dados/limites';
import {
  calculadosDoContrato, camposDoContrato, CATEGORIAS, CONTRATO_VAZIO, dadosDoContrato, dinheiroNoCampo, fmtDinheiro, fmtPercentual,
  lerDinheiro, PERCENTUAIS_ESCRITORIO, validarContrato, type CamposContrato
} from '../regras/contrato';
import { MASCARAS } from '../regras/pessoa';
import { falha, feito } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, naGrade, Nota, TituloSecao, type TamanhoNaGrade } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { Icone } from '../ui/Icone';
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
type CampoTexto = Exclude<keyof CamposContrato, 'objetos'>;

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
  // Cada linha de objeto tem a sua chave, para o React não trocar o que foi digitado ao tirar uma linha do meio.
  const [chaves, setChaves] = useState<number[]>([1]);
  const proximaChave = useRef(2);
  const [sugeridos, setSugeridos] = useState<string[]>([]);
  useTitulo(alvo ? 'Atualizar contrato' : 'Novo contrato');

  useEffect(() => {
    if (!idAtualizar) return;
    SD.contratoObter(idAtualizar)
      .then(k => {
        if (!k) throw new Error('Contrato não encontrado.');
        setAlvo(k);
        const campos = camposDoContrato(k);
        setC(campos);
        setChaves(campos.objetos.map((_, i) => i + 1));
        proximaChave.current = campos.objetos.length + 1;
        setPessoas({ cliente: k.cliente, participante: k.participante, indicador: k.indicador });
      })
      .catch(falha)
      .finally(() => setPronto(true));
  // oxlint-disable-next-line react/exhaustive-deps -- carrega o contrato a atualizar uma vez só, ao abrir o formulário
  }, []);
  // Os objetos já usados no escritório aparecem como sugestão enquanto se digita (sem elas, o cadastro segue igual).
  useEffect(() => { SD.objetosSugeridos().then(setSugeridos).catch(() => {}); }, []);

  const erros = tentou ? validarContrato(c) : {};
  const calculados = calculadosDoContrato(c);
  const mudar = (campos: Partial<CamposContrato>) => setC(atual => ({ ...atual, ...campos }));
  // Tirar o participante ou o indicador tira também o percentual dele.
  const escolher = (papel: Papel) => (p: PessoaLista | null) => {
    const { campo, percentual } = PAPEIS[papel];
    setPessoas(x => ({ ...x, [papel]: p }));
    mudar({ [campo]: p?.id ?? '', ...(percentual && !p ? { [percentual]: '' } : {}) });
  };
  // ---------- objetos ----------
  const idObjeto = (i: number) => 'contrato-objeto-' + chaves[i];
  const mudarObjeto = (i: number, v: string) => setC(atual => ({ ...atual, objetos: atual.objetos.map((o, j) => j === i ? v : o) }));
  function acrescentarObjeto(depois = c.objetos.length - 1) {
    const chave = proximaChave.current++;
    setC(atual => ({ ...atual, objetos: atual.objetos.toSpliced(depois + 1, 0, '') }));
    setChaves(atual => atual.toSpliced(depois + 1, 0, chave));
    setTimeout(() => document.getElementById('contrato-objeto-' + chave)?.focus(), 0);
  }
  function tirarObjeto(i: number) {
    setC(atual => ({ ...atual, objetos: atual.objetos.toSpliced(i, 1) }));
    setChaves(atual => atual.toSpliced(i, 1));
  }
  // Enter num objeto vai para o próximo; no último preenchido, abre uma linha nova.
  function teclarObjeto(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i < c.objetos.length - 1) document.getElementById(idObjeto(i + 1))?.focus();
    else if (c.objetos[i].trim() && c.objetos.length < OBJETOS_MAXIMOS) acrescentarObjeto(i);
  }

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
  const id = (nome: CampoTexto) => 'contrato-' + nome;
  const obrigatorio = <span className="req" aria-hidden="true">*</span>;
  const campo = (nome: CampoTexto, rotulo: ReactNode, tam: TamanhoNaGrade, entrada: ReactNode, dica?: string) =>
    <div className={'campo-form' + (erros[nome] ? ' com-erro' : '')} style={naGrade(tam)}>
      <label htmlFor={id(nome)}>{rotulo}{dica && <small> {dica}</small>}</label>
      {entrada}
      {erros[nome] && <span className="erro-campo" id={id(nome) + '-erro'} role="alert">{erros[nome]}</span>}
    </div>;
  const acessivel = (nome: CampoTexto) => ({ id: id(nome), 'aria-invalid': erros[nome] ? true : undefined, 'aria-describedby': erros[nome] ? id(nome) + '-erro' : undefined });
  const texto = (nome: CampoTexto, props: InputHTMLAttributes<HTMLInputElement> = {}) =>
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
      <span className="rotulo-campo">{rotulo} <small>calculado</small></span>
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
          <div className={'campo-form contrato-objetos' + (erros.objetos ? ' com-erro' : '')} role="group" aria-labelledby="contrato-objetos-rotulo" style={naGrade({})}>
            <span className="rotulo-campo" id="contrato-objetos-rotulo">Objetos do contrato{obrigatorio} <small>um por linha; cada um vira uma demanda quando o contrato for assinado</small></span>
            {c.objetos.map((o, i) => <div className="linha-campo" key={chaves[i]}>
              <input type="text" id={idObjeto(i)} aria-label={`Objeto ${i + 1}`} list="objetos-sugeridos" maxLength={TAMANHO_CONTRATO.objeto}
                placeholder={i === 0 ? 'Ex.: Registro da marca no INPI' : undefined} value={o} aria-invalid={erros.objetos ? true : undefined}
                aria-describedby={erros.objetos ? 'contrato-objetos-erro' : undefined} onChange={e => mudarObjeto(i, e.target.value)} onKeyDown={e => teclarObjeto(e, i)} />
              {c.objetos.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar o objeto ${i + 1}`} onClick={() => tirarObjeto(i)}><Icone nome="fechar" tam={15} /></button>}
            </div>)}
            <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.objetos.length >= OBJETOS_MAXIMOS} onClick={() => acrescentarObjeto()}>
              <Icone nome="mais" tam={13} /> Adicionar objeto
            </button></div>
            {erros.objetos && <span className="erro-campo" id="contrato-objetos-erro" role="alert">{erros.objetos}</span>}
            <datalist id="objetos-sugeridos">{sugeridos.map(o => <option key={o} value={o}>{o}</option>)}</datalist>
          </div>
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
