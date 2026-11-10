// Perfil profissional de alguém da equipe, aberto em "Equipe e acessos" (só administradores): completar ou corrigir
// o perfil e decidir se ele aparece no site. Cada um edita o próprio em "Minha conta".
import { Navigate, useSearchParams } from 'react-router';
import { Avatar } from '../ui/Avatar';
import { Aviso, BotaoLink } from '../ui/base';
import { useSessao } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { FotoDoPerfil } from './FotoDoPerfil';
import { FormularioDoPerfil } from './PerfilProfissional';
import './Configuracoes.css';

export default function PerfilDaEquipe() {
  const { ctx } = useSessao();
  const [busca] = useSearchParams();
  // Quem foi excluído não tem mais perfil profissional: a página diz que a pessoa não está na equipe.
  const membro = ctx.equipe.find(m => m.id === busca.get('id') && !m.excluido);
  useTitulo(membro ? 'Perfil de ' + membro.nome : 'Perfil profissional');
  if (!ctx.ehAdmin) return <Navigate to="/minha-conta/" replace />;
  return <div className="miolo">
    <header>
      <p className="olho"><BotaoLink forma="link" to="/equipe/">Equipe e acessos</BotaoLink></p>
      <h1 className="titulo perfil-da-equipe">{membro && <Avatar p={membro} tam={40} />}{membro ? membro.nome : 'Perfil profissional'}<span className="ponto">.</span></h1>
      <p className="lead">Perfil profissional: a base da página desta pessoa no site do escritório. Você pode completar ou corrigir, e decidir se ele aparece no site.</p>
    </header>
    {membro ? <>
      <section className="cartao config campos foto-cartao" aria-labelledby="tFoto">
        <h3 className="perfil-bloco" id="tFoto">Foto</h3>
        <FotoDoPerfil membro={membro} />
      </section>
      <FormularioDoPerfil perfilId={membro.id} nome={membro.nome} podePublicar />
    </> : <Aviso tipo="erro">Essa pessoa não está na equipe do escritório.</Aviso>}
  </div>;
}
