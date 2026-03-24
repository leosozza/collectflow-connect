

# Plano: Tabulação apenas na tela de Atendimento, sem duplicação

## Problema

Após o operador tabular no modal de Atendimento e o modal fechar (`closeAtendimento`), existe uma janela de tempo onde o agente ainda está em status TPA (3 ou 4) no polling da 3CPlus. Como `modalIsOpen` agora é `false`, a tela de ACW do `TelefoniaDashboard` aparece — gerando uma segunda tela de tabulação desnecessária.

## Correções

### 1. `TelefoniaDashboard.tsx` — Suprimir ACW quando qualify já foi feito

Linha 943 — o `effectiveACW` já checa `!qualifiedFromDisposition`, mas o `sessionStorage` flag pode não ter sido setado ainda (o `qualifyOn3CPlus` é assíncrono). 

**Correção**: Adicionar `!isManualPause` ao `effectiveACW` (já planejado) E garantir que ao fechar o modal via "Finalizar Tabulação", o flag `3cp_qualified_from_disposition` seja setado **antes** de fechar o modal.

### 2. `AtendimentoPage.tsx` — Setar flag antes de fechar

No `handleFinishDisposition` (linha 374), setar `sessionStorage.setItem("3cp_qualified_from_disposition", "true")` **antes** de chamar `closeAtendimento()`. Isso garante que quando o TelefoniaDashboard re-renderiza após o modal fechar, o `qualifiedFromDisposition` já é `true` e a tela ACW não aparece.

### 3. `AtendimentoPage.tsx` — Disposition já seta o flag

Na `onSuccess` do `dispositionMutation` (linha 184), o flag já é setado após `qualifyOn3CPlus` retornar sucesso. Mas como é assíncrono, o modal pode fechar antes. 

**Correção**: Setar `sessionStorage.setItem("3cp_qualified_from_disposition", "true")` **imediatamente** após a disposition ser salva (antes do `qualifyOn3CPlus`), não depois. Se o qualify falhar, o flag ainda é válido (a tabulação RIVO já foi feita).

### 4. `TelefoniaDashboard.tsx` — effectiveACW mais restritivo

```typescript
const effectiveACW = (isACW || isACWFallback || isTPAStatus) 
  && !qualifiedFromDisposition 
  && !isManualPause;
```

Isso impede que pausas manuais (status 3 com pause name, ou status 6) mostrem a tela de ACW.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/AtendimentoPage.tsx` | Mover `sessionStorage.setItem("3cp_qualified_from_disposition")` para antes do `qualifyOn3CPlus`; setar flag no `handleFinishDisposition` antes de fechar modal |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Adicionar `&& !isManualPause` ao `effectiveACW` |

