// "npm run mapa --prefix app": grava o mapa do sistema (docs/MAPA.md) a partir do código e da tabela de assuntos.ts (#407).
// Em Node puro, sem nada a instalar. Avisa o que ficou sem assunto e o que a tabela cita e não existe mais.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { citadosQueNaoExistem, gerarMapa, lerProjeto, semAssunto } from './gerar.ts';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const projeto = lerProjeto(RAIZ);
for (const [caminho, texto] of gerarMapa(projeto)) {
  mkdirSync(dirname(`${RAIZ}/${caminho}`), { recursive: true });
  writeFileSync(`${RAIZ}/${caminho}`, texto);
  console.log(`Mapa gravado em ${caminho}.`);
}
const avisar = (titulo: string, itens: string[]) => {
  if (itens.length) console.warn(`\n${titulo} (app/ferramentas/mapa/assuntos.ts):\n${itens.map(i => `  - ${i}`).join('\n')}`);
};
avisar('Sem assunto: classifique na tabela de assuntos', semAssunto(projeto));
avisar('A tabela de assuntos cita o que não existe mais: corrija ou tire', citadosQueNaoExistem(projeto));
