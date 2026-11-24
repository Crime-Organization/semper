// Em Configurações, a lista de objetos de contrato do escritório (#281): quantos contratos e demandas usam cada um, corrigir o nome,
// juntar repetidos e apagar o que ninguém usa. Só administradores chegam aqui. O banco troca o nome em todo lugar de uma vez
// (contratos, demandas, modelo de lista); as regras do nome e dos avisos ficam em regras/objetos.ts.
import { useEffect, useState, type FormEvent } from 'react';
import { SD, type ObjetoDoEscritorio } from '../dados';
import { TAMANHO_CONTRATO } from '../dados/limites';
import {
  alcanceDaJuncao, avisoDaTroca, avisoDoObjetoEmUso, contratosDoObjeto, erroDoNomeDoObjeto, objetosNaBusca, parecidos, quantasDemandas, quantosContratos, quemFica,
  semUso, textoDosContratos, trocaPedeConferencia
} from '../regras/objetos';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, BotaoDeIcone, Campo, Carregando, Escolhas, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';

/** O objeto sendo corrigido: o id e o nome como está no campo. */
type Correcao = { id: string; nome: string } | null;

export function ObjetosDeContrato() {
  const [objetos, setObjetos] = useState<ObjetoDoEscritorio[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');
  const [termo, setTermo] = useState('');
  const [soParecidos, setSoParecidos] = useState(false);
  const [correcao, setCorrecao] = useState<Correcao>(null);
  const [conferido, setConferido] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [fica, setFica] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const ler = () => SD.objetosDoEscritorio().then(o => { setObjetos(o); setErroLeitura(''); }).catch(e => setErroLeitura((e as Error).message));
  useEffect(() => { void ler(); }, []);
  // Depois de desfazer, mesmo tendo saído e voltado a esta página: mostra a lista como ficou.
  useMudancas(() => { void ler(); });

  if (erroLeitura) return <Aviso tipo="erro">{erroLeitura}</Aviso>;
  if (!objetos) return <Carregando />;

  const comParecidos = parecidos(objetos);
  const visiveis = objetosNaBusca(objetos, termo).filter(o => !soParecidos || comParecidos.has(o.id));
  const escolhidos = objetos.filter(o => marcados.includes(o.id));
  const ficaDeVerdade = escolhidos.some(o => o.id === fica) ? fica : quemFica(escolhidos)?.id ?? '';
  const emCorrecao = correcao && objetos.find(o => o.id === correcao.id);
  const erroDoNome = correcao && conferido ? erroDoNomeDoObjeto(correcao.nome, objetos, correcao.id) : null;

  function marcar(id: string, sim: boolean) {
    setMarcados(m => sim ? [...m, id] : m.filter(x => x !== id));
  }
  function abrirCorrecao(o: ObjetoDoEscritorio) {
    setCorrecao({ id: o.id, nome: o.descricao });
    setConferido(false);
  }

  async function corrigir(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (!correcao || !emCorrecao || ocupado || erroDoNomeDoObjeto(correcao.nome, objetos!, correcao.id)) return;
    const { id } = correcao, antigo = emCorrecao.descricao, novo = correcao.nome.trim();
    setOcupado(true);
    try {
      const troca = await SD.objetoRenomear(id, novo);
      feito(avisoDaTroca('corrigir', novo, troca), 'correção do objeto', async () => { await SD.objetoRenomear(id, antigo); });
      setCorrecao(null);
      await ler();
    } catch (e) { falha(e); } finally { setOcupado(false); }
  }

  async function juntar() {
    const ficaNome = objetos!.find(o => o.id === ficaDeVerdade)?.descricao ?? '';
    const troca = await SD.objetosJuntar(marcados, ficaDeVerdade);
    // Juntar não tem desfazer: não dá para saber depois qual contrato tinha qual nome.
    avisar(avisoDaTroca('juntar', ficaNome, troca), trocaPedeConferencia(troca) ? 'info' : 'ok');
    setMarcados([]); setFica('');
    await ler();
  }

  async function apagar(o: ObjetoDoEscritorio) {
    await SD.objetoApagar(o.id);
    avisar(`Objeto "${o.descricao}" apagado da lista.`);
    setMarcados(m => m.filter(x => x !== o.id));
    await ler();
  }

  return <section className="cartao config-campos" aria-labelledby="tObjetos">
    <TituloSecao id="tObjetos">Objetos de contrato</TituloSecao>
    <Nota>A lista que aparece como sugestão no cadastro de contrato. Corrigir um nome muda também os contratos e as demandas que o usam. Para juntar repetidos, marque-os na tabela.</Nota>

    <div className="config-campos-acoes">
      <Campo rotulo="Procurar objeto" para="objeto-busca">
        <input type="search" {...propsDoCampo('objeto-busca')} value={termo} onChange={e => setTermo(e.target.value)} />
      </Campo>
      <label><input type="checkbox" checked={soParecidos} onChange={e => setSoParecidos(e.target.checked)} /> Só os parecidos</label>
    </div>

    {visiveis.length ? <div className="tabela"><table>
      <thead><tr>
        <th scope="col"><span className="sr">Marcar para juntar</span></th><th scope="col">Objeto</th><th scope="col">Contratos</th><th scope="col">Demandas</th>
        <th scope="col"><span className="sr">Ações</span></th>
      </tr></thead>
      <tbody>{visiveis.map(o => <tr key={o.id}>
        <td><input type="checkbox" aria-label={`Marcar ${o.descricao} para juntar`} checked={marcados.includes(o.id)} onChange={e => marcar(o.id, e.target.checked)} /></td>
        <td>{o.descricao}{comParecidos.has(o.id) && <> <Selo tipo="pend" dica={`Parecido com: ${comParecidos.get(o.id)!.join('; ')}`}>parecido</Selo></>}</td>
        <td>{textoDosContratos(o)}</td><td>{o.demandas}</td>
        <td><span className="config-campos-acoes">
          <BotaoDeIcone icone="editar" rotulo={`Corrigir o objeto ${o.descricao}`} dica="Corrigir o objeto" onClick={() => abrirCorrecao(o)} />
          {semUso(o)
            ? <BotaoDuplo icone="lixeira" rotulo="Apagar" dica="Apagar o objeto" variante="perigo" confirmar={`Confirmar: apagar ${o.descricao}`} aoConfirmar={() => apagar(o).catch(falha)} />
            : <BotaoDeIcone icone="lixeira" rotulo={`Apagar o objeto ${o.descricao}`} dica="Apagar o objeto"
              onClick={() => avisar(avisoDoObjetoEmUso(contratosDoObjeto(o)), 'erro')} />}
        </span></td>
      </tr>)}</tbody>
    </table></div> : <Nota>{objetos.length ? 'Nenhum objeto encontrado.' : 'Nenhum objeto ainda. Eles entram aqui quando um contrato é salvo.'}</Nota>}

    {emCorrecao && <form className="config-campos-form" noValidate aria-label="Corrigir objeto" onSubmit={corrigir}>
      <Campo rotulo="Nome do objeto" para="objeto-nome" obrigatorio erro={erroDoNome ?? undefined}
        dica={`Muda em ${quantosContratos(contratosDoObjeto(emCorrecao))} e ${quantasDemandas(emCorrecao.demandas)}.`}>
        <input type="text" {...propsDoCampo('objeto-nome', { dica: true, erro: erroDoNome })} maxLength={TAMANHO_CONTRATO.objeto} value={correcao!.nome}
          onChange={e => setCorrecao({ id: emCorrecao.id, nome: e.target.value })} />
      </Campo>
      <div className="config-campos-acoes">
        <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar nome'}</button>
        <button type="button" className={estiloBotao()} onClick={() => setCorrecao(null)}>Cancelar</button>
      </div>
    </form>}

    {escolhidos.length === 1 && <Nota>Marque outro objeto para juntar os dois.</Nota>}
    {escolhidos.length > 1 && <div className="config-campos-form" role="group" aria-label="Juntar objetos">
      <Escolhas rotulo="Qual nome fica?" arranjo="coluna-unica">
        {escolhidos.map(o => <label key={o.id}>
          <input type="radio" name="objeto-fica" value={o.id} checked={ficaDeVerdade === o.id} onChange={() => setFica(o.id)} />{o.descricao}
        </label>)}
      </Escolhas>
      <Nota>{alcanceDaJuncao(escolhidos, ficaDeVerdade)}</Nota>
      <div className="config-campos-acoes">
        <BotaoDuplo variante="principal" confirmar={`Confirmar: juntar em ${objetos.find(o => o.id === ficaDeVerdade)?.descricao}`}
          aoConfirmar={() => juntar().catch(falha)}><Icone nome="vinculo" tam={15} /> Juntar {escolhidos.length} objetos</BotaoDuplo>
        <button type="button" className={estiloBotao()} onClick={() => setMarcados([])}>Desmarcar</button>
      </div>
    </div>}
  </section>;
}
