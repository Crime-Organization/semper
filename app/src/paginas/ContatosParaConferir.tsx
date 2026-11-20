// A lista "Para conferir" (#164, etapa 2), em Configurações > Conta Google > Contatos no Google: os contatos que já estavam
// na conta Google e podem ser de alguém do escritório, mas a primeira sincronização não teve certeza. O administrador
// liga cada um a uma pessoa, marca como "é outra pessoa" (o SEMPER cria um contato novo para ela) ou ignora.
// As regras (quem é possível e por quê) ficam em supabase/functions/_compartilhado/correspondenciaDeContatos.ts; os textos,
// em regras/sincronizacaoGoogle.ts.
import { useCallback, useEffect, useState } from 'react';
import { SD, type ContatoParaConferir, type DecisaoDoContato, type PessoaPossivel } from '../dados';
import { fmtData, fmtTelefone } from '../regras/pessoa';
import { AO_DECIDIR, aniversarioParaMostrar, MOTIVOS_PARA_CONFERIR } from '../regras/sincronizacaoGoogle';
import { avisar, falha } from '../ui/avisos';
import { Cartao, Carregando, Contador, estiloBotao, Nota, Selo } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { BuscaPessoa } from '../ui/BuscaPessoa';

/** Os dados de uma pessoa possível numa linha: telefones, e-mails e o nascimento (ou a abertura). */
function resumoDaPessoa(p: PessoaPossivel) {
  const data = p.tipo === 'pj' ? p.abertura : p.nascimento;
  return [...p.telefones.map(fmtTelefone), ...p.emails, data ? `${p.tipo === 'pj' ? 'aberta em' : 'nasceu em'} ${fmtData(data)}` : '']
    .filter(Boolean).join(' · ');
}

/** `aoMudar`: a situação da sincronização (o número de dúvidas, a fila) é lida de novo depois de cada decisão. */
export function ContatosParaConferir({ aoMudar }: { aoMudar: () => unknown }) {
  const [lista, setLista] = useState<ContatoParaConferir[] | null>(null);
  const carregar = useCallback(() => SD.contatosParaConferir().then(setLista).catch(e => { falha(e); setLista([]); }), []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function decidir(k: ContatoParaConferir, decisao: DecisaoDoContato) {
    try {
      await SD.contatoParaConferirDecidir(k.id, decisao);
      avisar(AO_DECIDIR[decisao.acao]);
    } catch (e) { falha(e); }
    await carregar();
    await aoMudar();
  }

  if (!lista) return <Carregando />;
  if (!lista.length) return null;
  return <section className="config-conferir" aria-labelledby="tParaConferir">
    <h4 id="tParaConferir" className="config-conferir-titulo">Para conferir <Contador>{lista.length}</Contador></h4>
    <Nota>Estes contatos já estavam no Google e podem ser de alguém do escritório. Até você decidir, as pessoas possíveis
      não vão ao Google, para não criar contatos repetidos.</Nota>
    <ul className="config-conferir-lista">
      {lista.map(k => <li key={k.id}><ItemParaConferir k={k} decidir={d => decidir(k, d)} /></li>)}
    </ul>
  </section>;
}

function ItemParaConferir({ k, decidir }: { k: ContatoParaConferir; decidir: (d: DecisaoDoContato) => Promise<void> }) {
  const [procurando, setProcurando] = useState(false);
  const motivo = MOTIVOS_PARA_CONFERIR[k.motivo];
  const nome = k.nome || 'Contato sem nome';
  const aniversario = aniversarioParaMostrar(k.aniversario);
  const noGoogle = [...k.telefones, ...k.emails, aniversario && `aniversário ${aniversario}`].filter(Boolean).join(' · ');
  return <Cartao className="config-conferir-item" role="group" aria-label={`Contato do Google: ${nome}`}>
    <p className="config-conferir-contato"><b>{nome}</b> <Selo tipo="pend">{motivo.selo}</Selo></p>
    {noGoogle && <Nota>No Google: {noGoogle}</Nota>}
    <p className="config-conferir-motivo">{motivo.texto}</p>
    <ul className="config-conferir-pessoas" aria-label="Pessoas possíveis">
      {k.candidatos.map(p => <li key={p.id}>
        <span className="config-conferir-pessoa">
          <b>{p.nome}</b>{p.arquivada && <> <Selo tipo="arq">Arquivada</Selo></>}
          {resumoDaPessoa(p) && <span className="nota"> {resumoDaPessoa(p)}</span>}
        </span>
        <Botao forma="botao" pequeno aria-label={`Ligar a ${p.nome}`} onClick={() => decidir({ acao: 'ligar', pessoa_id: p.id })}>Ligar</Botao>
      </li>)}
    </ul>
    {procurando && <BuscaPessoa rotulo="Ligar a outra pessoa do escritório" escolhida={null} focar
      aoEscolher={p => { if (p) void decidir({ acao: 'ligar', pessoa_id: p.id }); }} />}
    <div className="acoes">
      {!procurando && <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => setProcurando(true)}>Procurar outra pessoa</button>}
      <Botao forma="botao" pequeno onClick={() => decidir({ acao: 'outra' })}>É outra pessoa</Botao>
      <Botao forma="botao" pequeno onClick={() => decidir({ acao: 'ignorar' })}>Ignorar</Botao>
    </div>
  </Cartao>;
}
