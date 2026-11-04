// Prepara o banco local antes do "npm run dev" (#74): liga o Supabase no Docker, aplica as migrações novas sem apagar o que já está lá e cria o
// login de teste. Só fala com o banco local. Em Node, e não em bash, para rodar igual no Windows.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const CONTEINER = 'supabase_db_semper';
/** A versão principal do Supabase CLI, a mesma da rotina do GitHub. Na 2, as tabelas ficam sem permissão para o site, e as telas abrem vazias. */
const VERSAO_DA_CLI = 3;

const rodar = (comando, opcoes = {}) => spawnSync(comando, { cwd: RAIZ, shell: true, stdio: 'inherit', ...opcoes }).status === 0;
function parar(mensagem) {
  console.error(`\n${mensagem}\n`);
  process.exit(1);
}

if (!rodar('docker info', { stdio: 'ignore' })) parar('O banco local precisa do Docker. Abra o Docker Desktop, espere ligar e rode de novo.');
const versao = spawnSync('supabase --version', { cwd: RAIZ, shell: true, encoding: 'utf8' }).stdout ?? '';
if (Number(versao.split('.')[0]) !== VERSAO_DA_CLI) parar(`O banco local precisa do Supabase CLI ${VERSAO_DA_CLI} (aqui: ${versao.trim() || 'não instalado'}). Atualize o programa e rode de novo.`);
if (!rodar('supabase start')) parar('Não foi possível ligar o banco local. Veja o erro acima.');
if (!rodar('supabase migration up --local --include-all')) parar('Uma migração não foi aplicada no banco local. Veja o erro acima.');
const dados = readFileSync(`${RAIZ}/supabase/banco-local.sql`);
if (!rodar(`docker exec -i ${CONTEINER} psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1`, { input: dados, stdio: ['pipe', 'inherit', 'inherit'] })) parar('Não foi possível criar o login de teste. Veja o erro acima.');
console.log('\nBanco local pronto. Login de teste: mestre@local.test, senha senha-local-de-teste\n');
