

# Fix: Status Incorretos — Jaciele "Vencido" no Perfil + "Aprovado" no Dashboard

## Problemas Encontrados

### 1. Campo errado no cálculo de pagamentos (AgreementInstallments — Perfil)
No componente `AgreementInstallments.tsx` (linha 109), o código lê `mp.amount` para somar pagamentos manuais confirmados. Porém, o campo correto na tabela e no serviço é `amount_paid`. Resultado: **total de pagamentos = 0**, e a parcela é classificada como "vencido" (pois 07/04 já passou).

```ts
// Linha 109 — BUG:
total += confirmedManual.reduce((sum, mp) => sum + Number(mp.amount || 0), 0);
//                                                         ^^^^^^^^^^
// Campo correto:
total += confirmedManual.reduce((sum, mp) => sum + Number(mp.amount_paid || 0), 0);
```

### 2. Dashboard mostra "Aprovado" em vez de "Pago" (DashboardPage)
Na tabela de vencimentos do dia (linha 314), o mapeamento é:
- `approved` → "Aprovado"
- qualquer outro → "Pendente"

Deveria ser `approved` → "Pago", pois `approved` no sistema significa acordo quitado.

### 3. Jaciele continua aparecendo nos vencimentos do dia
Se o acordo está `approved` (totalmente pago), ela não deveria aparecer na lista de vencimentos do dia. A RPC `get_dashboard_vencimentos` provavelmente não filtra acordos já quitados.

## Correções

### A. `src/components/client-detail/AgreementInstallments.tsx` (linha 109)
Trocar `mp.amount` por `mp.amount_paid`.

### B. `src/pages/DashboardPage.tsx` (linha 314)
Trocar `"Aprovado"` por `"Pago"` no mapeamento de status.

### C. RPC `get_dashboard_vencimentos` — verificar se filtra `approved`
Se a RPC retorna parcelas de acordos já `approved`, adicionar filtro para excluí-las (ou mostrar com badge "Pago" diferenciado em verde).

## Arquivos Alterados
- `src/components/client-detail/AgreementInstallments.tsx` — corrigir campo `amount` → `amount_paid`
- `src/pages/DashboardPage.tsx` — corrigir label "Aprovado" → "Pago"
- Possível ajuste na RPC `get_dashboard_vencimentos` para excluir acordos quitados

## Impacto
- Nenhum em outras rotas. Correções pontuais de campo e label.

