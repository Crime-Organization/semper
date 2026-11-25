// Em Configurações, os papéis do cliente escritos pela equipe nos processos (#443): a lista do escritório, que nasce do que a equipe
// escreveu no "Papel do cliente" ("+ Escrever o nome do papel…"). Só administradores chegam aqui, e aqui só se
// tira um papel da lista (com o Desfazer, que o devolve): os processos que já o usam continuam com o nome, gravado neles. O molde é
// FuncoesDosParticipantes.tsx; a lista que as outras telas usam fica em ui/papeisEscritos.ts.
import { useEffect, useState } from 'react';
import { SD, type PapelEscrito } from '../dados';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, TituloSecao } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { recarregarPapeisEscritos } from '../ui/papeisEscritos';
import { OPCAO_ESCREVER } from '../regras/papelEscrito';

export function PapeisEscritos() {
  const [papeis, setPapeis] = useState<PapelEscrito[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');

  // Lê a lista daqui e avisa as outras telas (o cadastro do processo, a pergunta do papel no cartão) de que ela mudou.
  const ler = () => SD.processoPapeisEscritos().then(p => { setPapeis(p); setErroLeitura(''); void recarregarPapeisEscritos(); })
    .catch(e => setErroLeitura((e as Error).message));
  useEffect(() => { void ler(); }, []);
  useMudancas(() => { void ler(); });

  async function tirar(p: PapelEscrito) {
    try {
      await SD.processoPapelEscritoTirar(p.id);
      feito(`Papel "${p.nome}" tirado da lista.`, 'retirada do papel', async () => { await SD.processoPapeisIncluir([p.nome]); });
      await ler();
    } catch (e) { falha(e); }
  }

  return <section className="cartao config-campos config-papeis-escritos" aria-labelledby="tPapeisEscritos">
    <TituloSecao id="tPapeisEscritos">Papéis escritos nos processos</TituloSecao>
    <Nota>Os papéis do cliente que a equipe escreveu nos processos, em "{OPCAO_ESCREVER}". Eles aparecem nos próximos cadastros. Tirar um
      papel da lista não muda os processos que já o usam: eles continuam com o nome.</Nota>
    {erroLeitura ? <Aviso tipo="erro">{erroLeitura}</Aviso>
      : !papeis ? <Carregando />
      : papeis.length ? <div className="tabela"><table>
        <thead><tr><th scope="col">Papel</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
        <tbody>{papeis.map(p => <tr key={p.id}>
          <td>{p.nome}</td>
          <td><span className="config-campos-acoes config-campos-acoes-fim">
            {/* A confirmação é curta para caber no celular ao lado do nome (que está na mesma linha). */}
            <BotaoDuplo icone="lixeira" rotulo="Tirar da lista" dica="Tirar o papel da lista" confirmar="Confirmar: tirar da lista" aoConfirmar={() => tirar(p)} />
          </span></td>
        </tr>)}</tbody>
      </table></div>
      : <Nota>Nenhum papel escrito ainda.</Nota>}
  </section>;
}
