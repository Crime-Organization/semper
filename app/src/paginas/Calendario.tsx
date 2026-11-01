// Feriados e prazos: o calendário de dias sem expediente de cada órgão e uma calculadora de prazo que usa esse
// calendário. Os feriados nacionais, o recesso forense e os prontos vêm das regras (regras/calendario.ts); os órgãos
// e os dias lançados, do escritório. Todos consultam; só os administradores mudam.
import { useCallback, useEffect, useState } from 'react';
import { SD, type Orgao } from '../dados';
import { Aviso, Carregando } from '../ui/base';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { CalcularPrazo } from './calendario/CalcularPrazo';
import { DiasDoAno } from './calendario/DiasDoAno';
import { OrgaosDoEscritorio } from './calendario/OrgaosDoEscritorio';
import './Calendario.css';

export default function Calendario() {
  useTitulo('Feriados e prazos');
  const ctx = useCtx();
  const [orgaos, setOrgaos] = useState<Orgao[] | string | null>(null);
  // Muda a cada lançamento ou exclusão: o calendário e a calculadora buscam os dias de novo.
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => SD.orgaosListar().then(setOrgaos).catch(e => setOrgaos((e as Error).message)), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const mudou = () => { setVersao(v => v + 1); void carregar(); };

  return <div className="miolo calendario">
    <header>
      <p className="olho">Prazos</p>
      <h1 className="titulo">Feriados e prazos<span className="ponto">.</span></h1>
      <p className="lead">Os dias sem expediente de cada órgão, para contar os prazos certos. Os feriados nacionais e o recesso forense
        já vêm prontos; o escritório acrescenta os feriados estaduais e municipais e as suspensões dos tribunais.</p>
    </header>
    {orgaos === null ? <Carregando />
      : typeof orgaos === 'string' ? <Aviso tipo="erro">{orgaos}</Aviso>
      : <>
        <CalcularPrazo orgaos={orgaos} versao={versao} />
        <DiasDoAno orgaos={orgaos} ehAdmin={ctx.ehAdmin} versao={versao} aoMudar={mudou} />
        <OrgaosDoEscritorio orgaos={orgaos} ehAdmin={ctx.ehAdmin} aoMudar={mudou} />
      </>}
  </div>;
}
