
Problema confirmado: a instância informada existe no banco e pertence ao tenant correto, com `supports_manual_bulk=true` e `is_default=true`, mas está salva com `status="connecting"`. O modal de disparo hoje só considera `active/connected`, então ela fica invisível mesmo estando operacional na interface.

## Causa raiz
- `fetchEligibleInstances` filtra por status persistido no banco, não pela elegibilidade real.
- A tela de Integrações mostra a instância como utilizável a partir de checagem em tempo real (`statusMap`), mas isso não é refletido em `whatsapp_instances.status`.
- Resultado: há divergência entre “instância ativa para o usuário” e “instância elegível para campanha”.

## Ajuste proposto
### 1) Corrigir a elegibilidade em `src/services/whatsappCampaignService.ts`
- Parar de depender apenas de `.in("status", ["active", "connected"])`.
- Buscar também os campos de capacidade:
  - `supports_manual_bulk`
  - `is_default`
- Aplicar uma normalização de elegibilidade:
  - incluir instâncias com `supports_manual_bulk = true`
  - aceitar status operacionais como `active`, `connected`, `connecting`, `open`
  - permitir fallback para instância padrão (`is_default`) quando ela for claramente a origem operacional do tenant
- Manter Gupshup virtual como já está.

Regra prática:
```text
Elegível = suporta bulk E (
  status em [active, connected, connecting, open]
  OU é a instância padrão do tenant
)
```

### 2) Normalizar o retorno para o modal
- Ordenar instâncias elegíveis com prioridade:
  1. padrão
  2. conectada/ativa
  3. demais elegíveis
- Expor um status normalizado para o `WhatsAppBulkDialog` sem mudar layout.

### 3) Reforçar validação no `src/components/carteira/WhatsAppBulkDialog.tsx`
- Se não houver nenhuma instância elegível, mostrar motivo mais preciso:
  - “Nenhuma instância habilitada para disparo em lote”
  - em vez de mensagem genérica de “nenhuma instância ativa”
- Manter mesma UX; só melhorar a lógica e o texto.

### 4) Preservar consistência do envio
- Não mexer no fluxo de campanha nem no roteamento por provider.
- O problema atual está antes do envio: seleção/elegibilidade.
- O `send-bulk-whatsapp` permanece como executor multi-provider.

## Resultado esperado
```text
Instância "Acordos Vitor Santana"
  -> encontrada no banco
  -> provider evolution
  -> supports_manual_bulk = true
  -> status = connecting
  -> is_default = true
  => passa a aparecer no modal de disparo
```

## Arquivos afetados
- `src/services/whatsappCampaignService.ts`
- `src/components/carteira/WhatsAppBulkDialog.tsx`

## Observação técnica
O ajuste corrige exatamente o caso informado sem mudar experiência do usuário: a origem continuará aparecendo no mesmo seletor do modal, apenas com regra de elegibilidade compatível com o estado real da integração.
