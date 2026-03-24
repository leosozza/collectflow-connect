

# Diagnostico: Status 3 da 3CPlus — TPA vs Pausa

## O que a API retorna

A 3CPlus retorna **status `3`** tanto para TPA (pos-atendimento) quanto para pausa manual. A diferenca e contextual:

- **TPA**: status `3` apos uma chamada terminar, sem nome de pausa
- **Pausa manual**: status `3` apos o operador clicar em "Intervalo", com nome de pausa definido

A API **nao retorna status `4`** nesta conta — o TPA chega como status `3`. Confirmado pelos network requests: Vitor esta em `status: 3` com uma chamada finalizada em `status: "4"` nos `company_calls`.

## Por que o RIVO mostra "Em Pausa" em vez de "TPA"

A logica interna ja sabe diferenciar (linha 828: `isTPA = status === 3 && !activePauseName`), mas o **banner de display** nao usa essa logica. O banner na linha 1236-1240 faz:

1. Se `isPaused && activePauseName` → mostra "Em Intervalo: {nome}"
2. Se `isPaused && status === 6` → mostra "Em Intervalo"
3. Senao → mostra `statusLabel(status)` que para status 3 retorna **"Em pausa"**

Nao existe nenhum check para `effectiveACW` no banner — entao quando o agente esta em TPA (status 3 sem pause name), o banner mostra "Em pausa" em vez de "TPA — Pos-atendimento".

## Correcao em `TelefoniaDashboard.tsx`

### 1. Banner de status (linhas 1234-1241)

Adicionar verificacao de `effectiveACW` **antes** das outras condicoes:

```
Se effectiveACW → "TPA — Pos-atendimento (MM:SS)"
Se isPaused && activePauseName → "Em Intervalo: {nome} (MM:SS)"
Se isPaused && status === 6 → "Em Intervalo (MM:SS)"
Senao → statusLabel(status) (MM:SS)
```

### 2. Cor do banner quando em TPA

Atualmente status 3 usa `bg-amber-500` (mesma cor da pausa). Isso esta ok visualmente mas podemos diferenciar se desejado. Manter como esta por ora.

### 3. Botao "Retomar" vs "Finalizar Tabulacao"

Quando em TPA (effectiveACW + status 3), o botao da esquerda deve mostrar **"Finalizar Tabulacao"** (que ja aparece no bloco ACW da linha 1071) e **nao** "Retomar" (que e para pausa manual). A logica de `isManualPause` na linha 791 ja trata isso corretamente: `isManualPause` requer `activePauseName`, entao em TPA sem pause name o botao "Retomar" nao aparece.

O problema visual e apenas no banner — o bloco ACW (formulario de tabulacao) ja renderiza corretamente na linha 1071.

## Arquivo a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Banner: priorizar `effectiveACW` para mostrar "TPA — Pos-atendimento" em vez de "Em pausa" quando status 3 sem pause name |

