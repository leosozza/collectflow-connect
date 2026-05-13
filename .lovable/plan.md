## Fase 5.3 — Concluída ✅

| Verificação | Resultado |
|---|---|
| RPC `get_client_consolidated_status` criada | ✅ |
| Helper `map_canonical_to_legacy_status` (zero contract change) | ✅ |
| `get_carteira_grouped` rewired para SSOT | ✅ |
| Convergência amostral (200 pares CPF/Credor) | **199/200 (99,5%)** |
| Única divergência | Correção SSOT (`em_acordo` legado → `quebrado` real) |
| Invalidação `["carteira-grouped"]` em writes do detalhe | ✅ (7 sites) |
| Frontend sem mudança de UI | ✅ |

## Faltam 1 sub-fase

| Fase | Status |
|---|---|
| 5.1 Dashboard SSOT | ✅ |
| 5.2 Detalhe do Cliente lê SSOT | ✅ |
| 5.3 Status consolidado da Carteira via SSOT | ✅ |
| **5.4 Shadow-check diário (auditoria)** | 🟡 Próxima |
