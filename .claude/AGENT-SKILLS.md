# Agent Skills (Addy Osmani)

Roteiros de trabalho para o agente (especificar, planejar, construir, testar, revisar, lançar), copiados de
https://github.com/addyosmani/agent-skills, versão `aeac41d` (13/10/2026). Licença MIT, reproduzida abaixo.

| Pasta | O que tem |
|---|---|
| `skills/` | As 25 skills (`SKILL.md` de cada uma). |
| `references/` | Checklists que as skills consultam (segurança, desempenho, acessibilidade, testes, "pronto"). |
| `agents/` | Subagentes: `code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`. |
| `commands/` | Comandos `/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify`, `/constraints`, `/webperf`, `/ship`. |

Diferenças em relação ao original:
- Os nomes das skills perderam o prefixo `agent-skills:` (do formato de plugin), para funcionarem como skills do projeto.
- Os *hooks* automáticos do pacote (início de sessão, cache, `simplify-ignore`) não foram instalados.

**Prioridade:** quando uma skill divergir das instruções do Mateus (CLAUDE.md global e memória do projeto), valem as
instruções dele: trabalho direto no `main`, um commit com push a cada alteração pedida, mensagens em português,
nada de dados de clientes no repositório, código só com autorização.

Para atualizar: baixar de novo o repositório, conferir o conteúdo e copiar as mesmas pastas.

---

MIT License

Copyright (c) 2025 Addy Osmani

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
