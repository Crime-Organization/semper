// As etapas da importação de pessoas, uma por componente (como paginas/novaPessoa/etapas.tsx). A tela
// (ImportarPessoas.tsx) mostra a etapa atual pela tabela ETAPAS_IMPORTACAO, sem testar qual é, e entrega o estado e as
// ações pelo contexto (contexto.ts). Etapa nova: um componente aqui e uma entrada na tabela.
import { useId, useRef, useState } from 'react';
import type { Membro } from '../../dados/tipos';
import { LGPD } from '../../regras/pessoa';
import {
  COLUNAS_IMPORTACAO, modeloImportacao, NOME_DO_MODELO, type ColunaImportacao, type Situacao
} from '../../regras/importacao';
import { normal } from '../../regras/texto';
import { Abas, Aviso, Carregando, Escolhas, estiloBotao, idDaAba, Nota, Progresso, Vazio } from '../../ui/base';
import { Botao } from '../../ui/Botoes';
import { gravacao } from '../../ui/gravacaoDaImportacao';
import { Icone } from '../../ui/Icone';
import { useTravarPainel } from '../../ui/PainelCartao';
import { Recolhivel } from '../../ui/Recolhivel';
import { useCtx } from '../../ui/sessao';
import { baixarArquivo, numero } from '../../ui/util';
import { useImportacao, type EtapaImportacao } from './contexto';
import { TabelaConferencia } from './TabelaConferencia';
import { plural, textoDaFalha, textoDoResultado } from './textos';

// ---------- 1. o arquivo ----------

/** Os exemplos da coluna, de pessoa física e de pessoa jurídica (sem repetir e sem os vazios). */
const exemplo = (c: ColunaImportacao) => [...new Set([c.exemplo.pf, c.exemplo.pj].filter(Boolean))].join(' / ');

function ComoPreencher() {
  return <div className="tabela tabela-estreita"><table aria-label="Colunas do modelo">
    <thead><tr><th scope="col">Coluna</th><th scope="col">O que pôr</th><th scope="col">Exemplo</th></tr></thead>
    <tbody>{COLUNAS_IMPORTACAO.map(c => <tr key={c.chave}>
      <td><code>{c.chave}</code>{c.obrigatoria && <span className="req" aria-label="obrigatória">*</span>}<div className="sub">{c.rotulo}</div></td>
      <td>{c.formato}</td>
      <td>{exemplo(c)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function EtapaArquivo() {
  const t = useImportacao();
  const campo = useRef<HTMLInputElement>(null);
  return <>
    <div>
      <button type="button" className={estiloBotao()} onClick={() => baixarArquivo(NOME_DO_MODELO, modeloImportacao())}>
        <Icone nome="baixar" tam={15} /> Baixar o modelo
      </button>
      <Nota>O modelo tem as colunas que o SEMPER entende e dois exemplos. Apague os exemplos antes de preencher. Só a coluna “nome” e a “tipo” são obrigatórias.</Nota>
    </div>
    <Recolhivel titulo="Como preencher cada coluna" icone="texto"><ComoPreencher /></Recolhivel>
    <Escolhas rotulo="Base legal (LGPD) de quem vier sem base no arquivo" arranjo="coluna-unica"
      dica="É o motivo legal para o escritório guardar esses dados. Para clientes com contrato, use Execução de contrato.">
      {Object.entries(LGPD).map(([chave, rotulo]) => <label key={chave}>
        <input type="radio" name="lgpd-padrao" value={chave} checked={t.lgpdPadrao === chave} onChange={() => t.mudarLgpd(chave)} />{rotulo}
      </label>)}
    </Escolhas>
    {t.erroDoArquivo && <Aviso tipo="erro">{t.erroDoArquivo}</Aviso>}
    {t.lendo && <Carregando>Lendo o arquivo…</Carregando>}
    <input ref={campo} type="file" hidden aria-label="Arquivo CSV" accept=".csv,text/csv" onChange={e => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (f) void t.lerArquivo(f);
    }} />
    <div className="navegar">
      <span />
      <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={t.lendo} onClick={() => campo.current?.click()}>
        <Icone nome="subir" tam={16} /> Escolher o arquivo
      </button>
    </div>
  </>;
}

// ---------- 2. os responsáveis ----------

/** Por que o nome do arquivo não foi ligado sozinho a ninguém da equipe. */
const DICA_DO_RESPONSAVEL: Record<'nao_achado' | 'ambiguo', string> = {
  nao_achado: 'Ninguém da equipe com esse nome.',
  ambiguo: 'Há mais de uma pessoa da equipe com esse nome.'
};

/** As colunas que o SEMPER deixou de lado: quem importa precisa saber que esses dados não entram. */
function AvisosDoArquivo() {
  const { arquivo } = useImportacao();
  return <>
    {!!arquivo?.desconhecidas.length && <Aviso tipo="info">O SEMPER vai ignorar estas colunas, que não conhece: {arquivo.desconhecidas.join(', ')}.</Aviso>}
    {!!arquivo?.repetidas.length && <Aviso tipo="info">Estas colunas aparecem mais de uma vez, e vale só a primeira: {arquivo.repetidas.join(', ')}.</Aviso>}
  </>;
}

/** O nome de cada pessoa da equipe na lista; quem tem o mesmo nome de outra aparece com o usuário, para distinguir. */
function nomesNaLista(equipe: Membro[]): Map<string, string> {
  const vezes = new Map<string, number>();
  for (const m of equipe) vezes.set(normal(m.nome), (vezes.get(normal(m.nome)) ?? 0) + 1);
  return new Map(equipe.map(m => [m.id, (vezes.get(normal(m.nome)) ?? 0) > 1 && m.usuario ? `${m.nome} (@${m.usuario})` : m.nome]));
}

function EtapaResponsaveis() {
  const t = useImportacao();
  const equipe = useCtx().equipe.filter(m => m.ativo !== false);
  const nomeNaLista = nomesNaLista(equipe);
  return <>
    <AvisosDoArquivo />
    {!t.nomes.length ? <Vazio>O arquivo não tem responsáveis.</Vazio>
      : <div className="tabela tabela-estreita"><table aria-label="Responsáveis do arquivo">
        <thead><tr><th scope="col">Nome no arquivo</th><th scope="col">Cadastros</th><th scope="col">Usuário da equipe</th></tr></thead>
        <tbody>{t.nomes.map(n => {
          const ligado = t.mapa[normal(n.texto)] ?? '';
          return <tr key={n.texto}>
            <td>{n.texto}</td>
            <td>{numero(n.quantas)}</td>
            <td>
              <select className="filtro" aria-label={`Usuário para ${n.texto}`} value={ligado} onChange={e => t.ligar(n.texto, e.target.value || null)}>
                <option value="">Não ligar ninguém</option>
                {equipe.map(m => <option key={m.id} value={m.id}>{nomeNaLista.get(m.id)}</option>)}
              </select>
              {!ligado && n.motivo && <Nota>{DICA_DO_RESPONSAVEL[n.motivo]}</Nota>}
            </td>
          </tr>;
        })}</tbody>
      </table></div>}
    {t.conferindo && <Carregando>Conferindo com o que já está no SEMPER…</Carregando>}
    <div className="navegar">
      <button type="button" className={estiloBotao()} onClick={() => t.irPara('arquivo')}>Voltar</button>
      <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={t.conferindo} onClick={() => void t.conferir()}>Conferir</button>
    </div>
  </>;
}

// ---------- 3. a conferência ----------

/** As abas da conferência, uma por situação, na ordem em que aparecem. */
const ABAS_DA_CONFERENCIA: { id: Situacao; rotulo: string }[] = [
  { id: 'novo', rotulo: 'Novos' }, { id: 'completar', rotulo: 'Completar' }, { id: 'sem_mudanca', rotulo: 'Sem mudança' },
  { id: 'decidir', rotulo: 'Para decidir' }, { id: 'recusada', rotulo: 'Com erro' }
];

function EtapaConferencia() {
  const t = useImportacao();
  const quantas = (s: Situacao) => t.classificacoes.filter(c => c.situacao === s).length;
  // Começa na primeira aba que tem alguma linha.
  const [aba, setAba] = useState<Situacao>(() => ABAS_DA_CONFERENCIA.find(a => quantas(a.id) > 0)?.id ?? 'novo');
  const painel = useId();
  // Linhas que entram sem CPF/CNPJ válido e sem referência (inclusive as de CPF inválido, que entram sem ele): a
  // conferência acha o que já existe só por esses dois, então importar o mesmo arquivo de novo as repetiria.
  const semChave = t.importadas.filter(i => !i.problemas.some(p => p.gravidade === 'erro') && !i.dados.documento && !i.referencia).length;
  const { itens, problemas } = t.plano;
  return <>
    <Nota>Nada foi gravado ainda.</Nota>
    <AvisosDoArquivo />
    {semChave > 0 && <Aviso tipo="info">
      {plural(semChave, 'linha não tem', 'linhas não têm')} CPF/CNPJ válido nem referência. Se este arquivo for importado de novo, {semChave === 1 ? 'ela entra' : 'elas entram'} outra vez, repetida{semChave === 1 ? '' : 's'}.
    </Aviso>}
    {problemas.length > 0 && <Aviso tipo="erro">
      Estas linhas ficam de fora até você escolher outra opção:
      <ul>{problemas.map(p => <li key={`${p.linha}-${p.mensagem}`}>{p.mensagem}</li>)}</ul>
    </Aviso>}
    <div className="conferencia-abas">
      <Abas<Situacao> rotulo="Conferência" atual={aba} aoTrocar={setAba} painel={painel}
        abas={ABAS_DA_CONFERENCIA.map(a => ({ ...a, contador: quantas(a.id) }))} />
    </div>
    {/* tabIndex: a aba pode não ter nada que receba o foco (só texto), e o painel precisa ser alcançável pelo Tab. */}
    <div role="tabpanel" id={painel} aria-labelledby={idDaAba(painel, aba)} tabIndex={0}><TabelaConferencia key={aba} situacao={aba} /></div>
    <div className="navegar">
      <button type="button" className={estiloBotao()} onClick={() => t.irPara('responsaveis')}>Voltar</button>
      <Botao variante="principal" disabled={!itens.length} onClick={t.gravar}>Gravar {plural(itens.length, 'pessoa', 'pessoas')}</Botao>
    </div>
  </>;
}

// ---------- 4. gravando ----------

const MOTIVO_DA_TRAVA = 'A importação está gravando. Espere terminar.';

function EtapaGravando() {
  useTravarPainel(MOTIVO_DA_TRAVA);
  const estado = gravacao.usar();
  const { gravadas, total } = estado.fase === 'gravando' ? estado : { gravadas: 0, total: 0 };
  return <>
    <Progresso rotulo="Gravando a importação" valor={gravadas} maximo={total} />
    <p role="status">Gravadas {numero(gravadas)} de {numero(total)}. Não feche esta janela.</p>
  </>;
}

// ---------- 5. pronto ----------

function EtapaResumo() {
  const t = useImportacao();
  const estado = gravacao.usar();
  if (estado.fase !== 'concluida') return <Carregando />;
  const { gravadas, falha, erroAoRegistrar } = estado;
  return <>
    {/* Interrompida, as contagens não são um "deu certo": ficam num aviso neutro, acima do erro. */}
    {gravadas > 0 && <Aviso tipo={falha ? 'info' : 'ok'}>{textoDoResultado(estado)}</Aviso>}
    {falha && <Aviso tipo="erro">{textoDaFalha(falha)}. Corrija o arquivo e importe de novo: quem já entrou com CPF/CNPJ ou referência não se repete.</Aviso>}
    {erroAoRegistrar && <Aviso tipo="erro">As pessoas foram gravadas, mas o registro da importação não foi concluído: {erroAoRegistrar}</Aviso>}
    <Nota>Em Pessoas, use o filtro “Importadas” (em Situação do cadastro) para ver quem entrou, e “Com pendência” para ver quem ficou incompleto.</Nota>
    <div className="navegar">
      <button type="button" className={estiloBotao()} onClick={t.recomecar}>Importar outro arquivo</button>
      <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={t.fechar}>Ver em Pessoas</button>
    </div>
  </>;
}

export interface DefEtapaImportacao {
  titulo: string;
  /** O texto de apoio sob o título. */
  explicacao?: string;
  Componente: () => React.JSX.Element;
}

/** As etapas, na ordem: a tela mostra "Etapa N de 5" por esta ordem. */
export const ETAPAS_IMPORTACAO: Record<EtapaImportacao, DefEtapaImportacao> = {
  arquivo: {
    titulo: 'Escolher o arquivo', Componente: EtapaArquivo,
    explicacao: 'Traga para o SEMPER uma lista de pessoas salva em CSV (no Excel: Arquivo > Salvar como > CSV). Nada é gravado antes de você conferir.'
  },
  responsaveis: { titulo: 'Responsáveis', explicacao: 'Ligue cada nome da coluna “responsaveis” a alguém da equipe.', Componente: EtapaResponsaveis },
  conferencia: {
    titulo: 'Conferir', Componente: EtapaConferencia,
    explicacao: 'Veja o que acontece com cada linha do arquivo antes de gravar. Nas linhas para decidir, escolha o que fazer.'
  },
  gravando: { titulo: 'Gravando', Componente: EtapaGravando },
  resumo: { titulo: 'Pronto', Componente: EtapaResumo }
};
