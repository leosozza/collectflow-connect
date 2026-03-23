

# Auditoria 3CPlus — Correções Implementadas

## ✅ Concluído

### P1.1 — Fix parsing do resultMap na sync_dispositions
- `threecplus-proxy`: `newItem?.id || newItem?.data?.id` + log da resposta completa

### P1.2 — Fix formato do callId para qualify  
- `TelefoniaDashboard`: usa `call.telephony_id` como preferência ao salvar no sessionStorage

### P1.3 — Fix race condition dos intervalos
- `TelefoniaDashboard`: `loadPauseIntervals` busca `campaign_details` diretamente sem depender do state

### P2.1 — Campo threecplus_qualification_id
- Migration: nova coluna `threecplus_qualification_id` em `call_disposition_types`
- Proxy: match por ID persistido antes de match por nome
- dispositionService: persiste IDs de volta após sync

### P2.2 — Campo success nas respostas do proxy
- Todas respostas JSON incluem `success: response.ok`

### P2.3 — Resolução de operador no webhook
- Webhook usa `profiles.threecplus_agent_id` para mapear agente → operador
