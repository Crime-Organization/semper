// Vínculos de uma pessoa com outras (cônjuge, sócio, representante legal...), nos dois sentidos.
// Fica no cartão da pessoa; clicar no nome abre o cartão da outra pessoa.
import { useState, type FormEvent } from 'react';
import { SD, type Pessoa, type PessoaLista, type Vinculo, type VinculoTipo } from '../dados';
import { TAMANHO_VINCULO } from '../dados/limites';
import { TIPO_REPRESENTANTE } from '../regras/pessoa';
import { exigeDescricao, lerVinculo, opcoesDeVinculo, pontasDoVinculo } from '../regras/vinculos';
import { avisar, falha, feito } from '../ui/avisos';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { Icone } from '../ui/Icone';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';

const NOVO_TIPO = '__novo';

interface Props {
  p: Pessoa;
  vinculos: Vinculo[];
  /** Algo mudou: recarregar os vínculos e o histórico. */
  aoMudar: () => void;
  aoAbrirPessoa: (id: string) => void;
}

export function VinculosPessoa({ p, vinculos, aoMudar, aoAbrirPessoa }: Props) {
  const ctx = useCtx();
  const [formulario, setFormulario] = useState(false);
  const [tipos, setTipos] = useState<VinculoTipo[] | null>(null);
  const [opcao, setOpcao] = useState('');
  const [outra, setOutra] = useState<PessoaLista | null>(null);
  const [descricao, setDescricao] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const opcoes = tipos ? opcoesDeVinculo(tipos) : [];
  const escolhida = opcoes.find(o => o.chave === opcao);
  const pedeDescricao = !!escolhida && exigeDescricao(escolhida.rotulo);
  // No representante legal, a descrição é a função, que entra na qualificação da pessoa jurídica.
  const ehRepresentacao = !!escolhida && tipos?.find(t => t.id === escolhida.tipoId)?.nome === TIPO_REPRESENTANTE;

  function abrirFormulario() {
    setFormulario(true);
    if (!tipos) SD.vinculoTiposListar().then(setTipos).catch(falha);
  }
  function fecharFormulario() { setFormulario(false); setOpcao(''); setOutra(null); setDescricao(''); }

  async function vincular(e: FormEvent) {
    e.preventDefault();
    if (!escolhida) return falha(new Error('Escolha o tipo de vínculo.'));
    if (!outra) return falha(new Error('Escolha a pessoa a vincular.'));
    if (pedeDescricao && !descricao.trim()) return falha(new Error('Descreva o vínculo no campo "Descrição".'));
    const { de, para } = pontasDoVinculo(escolhida, p.id, outra.id);
    setOcupado(true);
    try {
      const id = await SD.vinculoCriar(de, para, escolhida.tipoId, descricao);
      feito(`Vínculo incluído: ${escolhida.rotulo} ${outra.nome}.`, 'inclusão do vínculo', async () => { await SD.vinculoApagar(id); });
      fecharFormulario();
      aoMudar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  async function retirar(v: Vinculo) {
    const { rotulo, outra: o } = lerVinculo(v, p.id);
    try {
      await SD.vinculoApagar(v.id);
      feito(`Vínculo retirado: ${rotulo} ${o.nome}.`, 'retirada do vínculo',
        async () => { await SD.vinculoCriar(v.pessoa_de, v.pessoa_para, v.tipo_id, v.descricao); });
      aoMudar();
    } catch (err) { falha(err); }
  }

  // Master e administradores ampliam a lista com tipos próprios do escritório.
  async function novoTipo() {
    const r = await janela<{ nome: string; inverso: string }>({
      titulo: 'Novo tipo de vínculo',
      corpo: <div className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>Como aparece na pessoa aberta<input name="nome" maxLength={TAMANHO_VINCULO.nome} placeholder="Ex.: Inventariante de" /></label>
        <label>Como aparece na outra pessoa <small>(em branco, se for igual)</small><input name="inverso" maxLength={TAMANHO_VINCULO.inverso} placeholder="Ex.: Espólio com inventariante" /></label>
      </div>,
      acoes: [{ rotulo: 'Cancelar', valor: null }, {
        rotulo: 'Criar tipo', tipo: 'pri',
        valor: campos => ({ nome: String(campos.get('nome') ?? '').trim(), inverso: String(campos.get('inverso') ?? '').trim() })
      }]
    });
    if (!r) return;
    if (!r.nome) { falha(new Error('Informe como o vínculo aparece na pessoa aberta.')); return; }
    try {
      const t = await SD.vinculoTipoCriar(r.nome, r.inverso || r.nome);
      setTipos(ts => [...(ts || []), t]);
      setOpcao(`${t.id}:de`);
      avisar(`Tipo de vínculo "${t.nome}" criado para o escritório.`);
    } catch (err) { falha(err); }
  }

  const padrao = opcoes.filter(o => !o.proprio), proprios = opcoes.filter(o => o.proprio);
  return <>
    {vinculos.length ? <ul className="vinculos">
      {vinculos.map(v => {
        const { rotulo, outra: o } = lerVinculo(v, p.id);
        return <li key={v.id} className="vinculo">
          <div className="vinculo-texto">
            <span className="vinculo-tipo">{rotulo}</span>
            <button type="button" className="vinculo-pessoa" title="Abrir o cartão desta pessoa" onClick={() => aoAbrirPessoa(o.id)}>{o.nome}</button>
            {o.arquivado_em && <span className="selo arq">Arquivada</span>}
            {v.descricao && <span className="vinculo-obs">{v.descricao}</span>}
          </div>
          <button type="button" className="icone-btn" title="Retirar o vínculo" aria-label={`Retirar o vínculo com ${o.nome}`} onClick={() => retirar(v)}>
            <Icone nome="fechar" tam={14} />
          </button>
        </li>;
      })}
    </ul> : !formulario && <p className="nota">Nenhum vínculo com outras pessoas ainda.</p>}

    {formulario
      ? <form className="form-vinculo campos" noValidate onSubmit={vincular}>
        <label>Vínculo
          <select value={opcao} onChange={e => { if (e.target.value === NOVO_TIPO) void novoTipo(); else setOpcao(e.target.value); }}>
            <option value="">{tipos ? 'Escolha o tipo de vínculo' : 'Carregando…'}</option>
            <optgroup label="Vínculos padrão">{padrao.map(o => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}</optgroup>
            {proprios.length > 0 && <optgroup label="Do escritório">{proprios.map(o => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}</optgroup>}
            {ctx.ehAdmin && <option value={NOVO_TIPO}>+ Novo tipo de vínculo…</option>}
          </select>
        </label>
        <BuscaPessoa rotulo="Pessoa" escolhida={outra} aoEscolher={setOutra} desativar={x => x.id === p.id ? 'é a própria pessoa' : null} />
        {ehRepresentacao
          ? <label>Função <small>(entra na qualificação: "neste ato representada por sua sócia administradora, …")</small>
            <input maxLength={TAMANHO_VINCULO.funcao} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: sócia administradora" />
          </label>
          : <label>Descrição {pedeDescricao ? <small>(obrigatória em "Outro")</small> : <small>(opcional)</small>}
            <input maxLength={TAMANHO_VINCULO.descricao} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder={pedeDescricao ? 'Ex.: inventariante do espólio' : 'Ex.: 50% das cotas, desde 2020'} />
          </label>}
        <div className="form-vinculo-acoes">
          <button type="button" className="btn btn-sm" onClick={fecharFormulario}>Cancelar</button>
          <button type="submit" className="btn pri btn-sm" disabled={ocupado}>Vincular</button>
        </div>
      </form>
      : <div><button type="button" className="mini" onClick={abrirFormulario}><Icone nome="mais" tam={14} /> Vincular pessoa</button></div>}
  </>;
}
