// Vínculos de uma pessoa com outras (cônjuge, sócio, representante legal...), nos dois sentidos.
// Fica no cartão da pessoa, cada vínculo num quadrinho (ItensLigados), como toda ligação do sistema; clicar nele abre o
// cartão da outra pessoa. Embaixo, "Vincular pessoa" (uma que já está no cadastro) e "+ Nova pessoa vinculada" (#376): escolhe o
// tipo do vínculo e abre o cadastro de pessoa, que ao terminar grava o vínculo e volta a este cartão.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SD, type Pessoa, type PessoaLista, type Vinculo, type VinculoTipo } from '../dados';
import { estiloBotao, Nota } from '../ui/base';
import { TAMANHO_VINCULO } from '../dados/limites';
import { cadastroDePessoaVinculada, ORIGEM_DA_PESSOA } from '../regras/origemDaPessoa';
import { TIPO_REPRESENTANTE } from '../regras/pessoa';
import { exigeDescricao, lerVinculo, opcoesDeVinculo, pontasDoVinculo } from '../regras/vinculos';
import { avisar, falha, feito } from '../ui/avisos';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados, ItensLigados } from '../ui/ItensLigados';
import { janela } from '../ui/janela';
import { usePedidoDeNovo } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';

const NOVO_TIPO = '__novo';

/** O formulário aberto: vincular uma pessoa que já está no cadastro, ou escolher o vínculo e cadastrar uma nova. */
type Formulario = 'existente' | 'nova';
const FORMULARIO: Record<Formulario, { enviar: string; rotulo: string }> = {
  existente: { enviar: 'Vincular', rotulo: 'Vincular pessoa' },
  nova: { enviar: 'Cadastrar a pessoa', rotulo: ORIGEM_DA_PESSOA.vinculos.novo }
};

interface Props {
  p: Pessoa;
  vinculos: Vinculo[];
  /** Algo mudou: recarregar os vínculos e o histórico. */
  aoMudar: () => void;
  aoAbrirPessoa: (id: string) => void;
  /** Pode cadastrar uma pessoa nova já vinculada (a pessoa aberta não está arquivada). */
  podeCriar?: boolean;
}

export function VinculosPessoa({ p, vinculos, aoMudar, aoAbrirPessoa, podeCriar = false }: Props) {
  const ctx = useCtx();
  const navegar = useNavigate();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
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

  function abrirFormulario(qual: Formulario) {
    setFormulario(qual);
    if (!tipos) SD.vinculoTiposListar().then(setTipos).catch(falha);
  }
  // O "+" do título da seção abre o mesmo formulário do "+ Nova pessoa vinculada" de baixo (que some com um formulário aberto).
  usePedidoDeNovo(() => { if (podeCriar && !formulario) abrirFormulario('nova'); });
  function fecharFormulario() { setFormulario(null); setOpcao(''); setOutra(null); setDescricao(''); }

  async function vincular(e: FormEvent) {
    e.preventDefault();
    if (!escolhida) return falha(new Error('Escolha o tipo de vínculo.'));
    if (formulario === 'existente' && !outra) return falha(new Error('Escolha a pessoa a vincular.'));
    if (pedeDescricao && !descricao.trim()) return falha(new Error('Descreva o vínculo no campo "Descrição".'));
    // A pessoa nova: o cadastro grava o vínculo ao terminar. A descrição vai junto com a navegação, e não no endereço (é texto livre).
    // O formulário fecha: ao voltar do cadastro, a seção mostra o vínculo novo.
    if (formulario === 'nova' || !outra) {
      fecharFormulario();
      return navegar(cadastroDePessoaVinculada(p.id, escolhida.chave), { state: { descricao } });
    }
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
    {vinculos.length ? <ItensLigados itens={vinculos.map(v => {
      const { rotulo, outra: o } = lerVinculo(v, p.id);
      return { id: v.id, aoAbrir: () => aoAbrirPessoa(o.id), codigo: rotulo, titulo: o.nome, detalhe: v.descricao ?? undefined,
        selo: o.arquivado_em ? 'Arquivada' : undefined,
        acao: <button type="button" className="icone-btn" title="Retirar o vínculo" aria-label={`Retirar o vínculo com ${o.nome}`} onClick={() => retirar(v)}>
          <Icone nome="fechar" tam={14} />
        </button> };
    })} /> : !formulario && <Nota>Nenhum vínculo com outras pessoas ainda.</Nota>}

    {formulario
      ? <form className="form-vinculo campos" noValidate aria-label={FORMULARIO[formulario].rotulo} onSubmit={vincular}>
        {formulario === 'nova' && <Nota>Escolha o vínculo de {p.nome} com a pessoa nova. Em seguida abre o cadastro dela; ao terminar, o vínculo fica gravado e você volta a este cartão.</Nota>}
        <label>Vínculo
          <select value={opcao} onChange={e => { if (e.target.value === NOVO_TIPO) void novoTipo(); else setOpcao(e.target.value); }}>
            <option value="">{tipos ? 'Escolha o tipo de vínculo' : 'Carregando…'}</option>
            <optgroup label="Vínculos padrão">{padrao.map(o => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}</optgroup>
            {proprios.length > 0 && <optgroup label="Do escritório">{proprios.map(o => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}</optgroup>}
            {ctx.ehAdmin && <option value={NOVO_TIPO}>+ Novo tipo de vínculo…</option>}
          </select>
        </label>
        {formulario === 'existente' && <BuscaPessoa rotulo="Pessoa" escolhida={outra} aoEscolher={setOutra} desativar={x => x.id === p.id ? 'é a própria pessoa' : null} />}
        {ehRepresentacao
          ? <label>Função <small>(entra na qualificação: "neste ato representada por sua sócia administradora, …")</small>
            <input maxLength={TAMANHO_VINCULO.funcao} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: sócia administradora" />
          </label>
          : <label>Descrição {pedeDescricao ? <small>(obrigatória em "Outro")</small> : <small>(opcional)</small>}
            <input maxLength={TAMANHO_VINCULO.descricao} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder={pedeDescricao ? 'Ex.: inventariante do espólio' : 'Ex.: 50% das cotas, desde 2020'} />
          </label>}
        <div className="form-vinculo-acoes">
          <button type="button" className={estiloBotao({ pequeno: true })} onClick={fecharFormulario}>Cancelar</button>
          <button type="submit" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado}>{FORMULARIO[formulario].enviar}</button>
        </div>
      </form>
      : <AcoesDosLigados>
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => abrirFormulario('existente')}><Icone nome="vinculo" tam={13} /> {FORMULARIO.existente.rotulo}</button>
        {podeCriar && <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => abrirFormulario('nova')}><Icone nome="mais" tam={13} /> {FORMULARIO.nova.rotulo}</button>}
      </AcoesDosLigados>}
  </>;
}
