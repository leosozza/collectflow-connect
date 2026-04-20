

## Validação Fase 2 + Plano das demais melhorias

### Parte A — Validação Fase 2 (confirmação obrigatória de acordo)

Auditei `AgreementCalculator.tsx` linha por linha:

| Item | Status | Evidência |
|---|---|---|
| Estado `confirmOpen` adicionado | ✅ | linha 113 |
| `handleSubmit` agora só abre o diálogo | ✅ | linhas 476-479 (valida + guarda + `setConfirmOpen(true)`) |
| Lógica real movida para `handleConfirmedSubmit` | ✅ | linha 481 |
| `AlertDialog` com resumo completo | ✅ | linhas 1175-1279 — Cliente, CPF, Credor, Valor original, Valor proposto, Desconto (R$ + %), Entrada, Parcelas, 1º vencimento, Forma de pagamento |
| Aviso "fora do padrão" quando aplicável | ✅ | linhas 1248-1254 |
| Bloqueio contra fechar durante processamento | ✅ | `onOpenChange` (1175) + `onEscapeKeyDown` (1178) |
| Foco inicial no botão Cancelar (seguro) | ✅ | `autoFocus` na linha 1262 |
| Botões desabilitados durante processamento | ✅ | linhas 1262, 1266 |
| Loader visual no botão de confirmar | ✅ | linhas 1273-1275 |
| Aviso "ação não pode ser desfeita" | ✅ | linha 1257-1259 |

**Resultado:** ✅ Fase 2 totalmente implementada conforme o plano. Nenhuma divergência. Pronto para teste end-to-end.

---

### Parte B — Plano das melhorias restantes

Da lista original (Fase 1 + extras), restam 3 itens classificados como "médio esforço" e 2 como "avaliar antes":

#### 🟢 Fase 3 — Médio esforço (recomendo agrupar)

**3.1 Indicador visual de campo "vindo do MaxSystem" (item 2.2)**
- Quando o `onCepResolved` preencher rua/bairro/cidade/UF, aplicar classe CSS `ring-2 ring-emerald-400/60` por 3 segundos nos 4 campos preenchidos.
- Implementação: adicionar prop `highlight?: boolean` no `InlineEditableField`; controlar via state em `ClientDetailHeader` (`Set<string>` de campos destacados, `setTimeout` de 3s para limpar).
- Reforça percepção de "o sistema trabalhou por mim".

**3.2 Botão "Buscar dados" manual no diálogo Editar Dados (item 2.3)**
- Adicionar botão pequeno (ícone Search + texto "Buscar") ao lado do campo CEP no `ClientForm.tsx` / diálogo Editar Dados.
- Dispara o mesmo lookup do auto-trigger, mas força execução mesmo se o CEP já estiver salvo.
- Útil quando bairro/rua estão incompletos mas o CEP existe.
- Estado `looking` local + `Loader2` no botão.

**3.3 Rascunho do AgreementCalculator (item 2.5)**
- Usar o hook `useSessionStorage` já criado (Fase 1).
- Salvar `{ entradas, numParcelas, formaPagto, jurosPercent, multaPercent, descontoPercent, calcDate }` em `sessionStorage` com chave `agreement-draft:${cpf}:${credor}` por 30 minutos (timestamp + TTL).
- Ao montar o componente, se houver rascunho válido, mostrar banner discreto "Restaurar rascunho de HH:mm?" com botões Restaurar / Descartar.
- Limpar automaticamente após formalização bem-sucedida.

#### 🟡 Avaliar antes de aplicar

**3.4 Atalhos de teclado (item 2.1)**
- `Esc` para fechar diálogos: já é padrão do shadcn — só precisa garantir que nenhum diálogo bloqueia indevidamente.
- `Ctrl/Cmd+S` no diálogo Editar Dados: precisa de `useEffect` com listener global escopado ao diálogo aberto.
- Ordem do `Tab` nos campos de endereço: revisar atributo `tabIndex` ou ordem do JSX.
- **Risco:** Ctrl+S no navegador abre "Salvar página" — precisamos de `e.preventDefault()` agressivo, e isso pode confundir power-users que usam o atalho do navegador.
- **Recomendação:** aplicar só `Esc` (já vem grátis) e revisar ordem do Tab. Pular Ctrl+S por enquanto.

**3.5 Item 2.4 (limites de R$10k / 12 parcelas)**
- ❌ **Cancelado** — substituído pela validação universal da Fase 2. Não há nada a fazer aqui.

---

### Sequência sugerida

1. **Você testa a Fase 2 end-to-end** (formalizar 1 acordo real, confirmar que o diálogo aparece, o resumo está correto, cancelar mantém formulário, confirmar processa normal).
2. Se OK, aplicar **Fase 3 inteira (3.1 + 3.2 + 3.3)** numa única rodada.
3. Decidir depois sobre 3.4 (atalhos).

### Arquivos que serão alterados na Fase 3

- `src/components/client-detail/InlineEditableField.tsx` — prop `highlight`
- `src/components/client-detail/ClientDetailHeader.tsx` — controlar destaque pós-CEP
- `src/components/client-detail/ClientForm.tsx` (ou diálogo Editar Dados equivalente) — botão "Buscar dados" manual
- `src/components/client-detail/AgreementCalculator.tsx` — rascunho via `useSessionStorage`

### Fora de escopo
- Score, WhatsApp, discador, APIs, Edge Functions de integração.
- Refatoração de cache TanStack ou autenticação.

### Próximo passo
Me confirme: **"Aplicar Fase 3"** (3.1 + 3.2 + 3.3) ou prefere escolher itens específicos.

