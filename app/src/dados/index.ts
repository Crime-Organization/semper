// Ponto único de acesso aos dados. Em "npm run teste" o Vite troca o banco de verdade (supabase.ts)
// pelo fictício (falso.ts); as telas não percebem a diferença.
export { SD } from '@dados-impl';
export type * from './tipos';
