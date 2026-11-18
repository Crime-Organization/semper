// Início: o painel de quem trabalha no escritório (#319). No alto, a saudação e a busca geral (a mesma janela do Ctrl+K); embaixo,
// os blocos: prazos (vencidos, de hoje e da semana), a agenda do dia, as tarefas em andamento, as demandas por situação, os
// processos, as anotações recentes, as parcelas da semana (só para quem vê o Financeiro) e os números de Pessoas. Cada bloco
// carrega por conta própria e mostra só o que cabe à pessoa. "Minha conta" tem página própria (MinhaConta.tsx).
import { useState } from 'react';
import { blocosDoEscritorio } from '../regras/painelInicial';
import { hojeNaAgenda } from '../regras/agenda';
import { useMudancas } from '../ui/avisos';
import { CampoDaBuscaGeral } from '../ui/BuscaGeral';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { BLOCOS } from './inicio/Blocos';
import { fontesDoPainel } from './inicio/fontes';
import './Inicio.css';

export default function Inicio() {
  useTitulo('Início');
  const ctx = useCtx();
  const eu = ctx.perfil.id, modulos = ctx.escritorio?.modulos;
  const hoje = hojeNaAgenda();
  // Depois de uma mudança em qualquer lugar (um cartão salvo, um aviso desfeito), os blocos leem tudo de novo.
  const [fontes, setFontes] = useState(() => fontesDoPainel(eu, hoje, modulos));
  useMudancas(() => setFontes(fontesDoPainel(eu, hoje, modulos)));

  const primeiro = (ctx.perfil.nome || '').trim().split(/\s+/)[0];
  return <div className="miolo painel-inicio">
    <header className="painel-inicio-topo">
      <h1 className="titulo">Olá{primeiro ? ', ' + primeiro : ''}<span className="ponto">.</span></h1>
      <CampoDaBuscaGeral />
    </header>
    <div className="painel-inicio-grade">
      {blocosDoEscritorio(modulos).map(b => { const Bloco = BLOCOS[b]; return <Bloco key={b} fontes={fontes} hoje={hoje} modulos={modulos} />; })}
    </div>
  </div>;
}
