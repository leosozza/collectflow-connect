

## Plano: remover campo "Provider" da tela de informações da campanha

### Contexto

O campo **Provider** mostra o valor de `campaign.provider_category` (ex: `official_meta`, `unofficial`). É um metadado técnico interno usado para definir limites anti-ban e roteamento — não tem utilidade operacional para o usuário final visualizar na tela de resumo da campanha.

Importante: a remoção é **apenas visual**. A coluna `provider_category` continua sendo usada internamente em:
- Cálculo dos limites de rate limit (`RATE_CONSTANTS[cat]`) no mesmo arquivo (linhas 270-306).
- Roteamento de envio em backend.

### Alteração

**Arquivo**: `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` (linhas 515-518)

Remover o bloco:
```tsx
<div>
  <p className="text-muted-foreground text-xs">Provider</p>
  <p className="font-medium">{campaign.provider_category}</p>
</div>
```

Manter os demais campos do card de informações intactos.

### Validação

1. Abrir uma campanha em `/contact-center/whatsapp?tab=campanhas` → aba Resumo.
2. Confirmar que o card de informações não exibe mais o campo "Provider".
3. Confirmar que os indicadores de rate limit / anti-ban continuam funcionando normalmente (a lógica interna ainda lê `provider_category`).

