
# Fase 2 - Integração com Discador 3CPlus

## Status da Fase 1 ✅
- [x] Tela de atendimento /atendimento/:id
- [x] Header com dados do cliente (nome, CPF, telefone, email, credor, external_id, endereço, observações)
- [x] Painel de tabulação (Caixa Postal, Ligação Interrompida, Contato Incorreto, Retornar, Negociar)
- [x] Painel de negociação (simulador, geração de acordo)
- [x] Chat WhatsApp (aba com bolhas, input desabilitado para integração futura)
- [x] Histórico/timeline (tabulações, acordos, mensagens)
- [x] Tabela call_dispositions
- [x] Campo external_id nos clients
- [x] Campos endereço e observações

---

## O que será feito na Fase 2

Integrar o sistema com o discador 3CPlus para envio de lotes de clientes e abertura automática da tela de atendimento quando uma ligação conecta.

### Fluxo

```text
Carteira (filtros) 
  → Botão "Enviar para Discador"
  → Edge function envia lote para API 3CPlus
  → 3CPlus disca automaticamente
  → Quando conecta, abre /atendimento/:id no navegador do operador
  → Operador tabula na tela de atendimento
```

### O que construir

| Item | Arquivo | Ação |
|------|---------|------|
| 1. Configuração 3CPlus | `src/components/integracao/ThreeCPlusTab.tsx` | Criar - formulário de credenciais (API Key, Campaign ID) |
| 2. Settings no tenant | `src/pages/ConfiguracoesPage.tsx` ou `IntegracaoPage.tsx` | Modificar - adicionar aba 3CPlus |
| 3. Edge function export | `supabase/functions/3cplus-export/index.ts` | Criar - envia lote de clientes filtrados à API 3CPlus |
| 4. Botão enviar para discador | `src/components/carteira/CarteiraTable.tsx` | Modificar - adicionar seleção múltipla + botão "Enviar para Discador" |
| 5. Dialog de envio | `src/components/carteira/DialerExportDialog.tsx` | Criar - confirma envio com preview da quantidade |

### Credenciais necessárias (por tenant)

Armazenadas em `tenants.settings` (JSONB):
- `threecplus_api_key` - Chave de API do 3CPlus
- `threecplus_campaign_id` - ID da campanha no 3CPlus (opcional, pode ser selecionado no envio)

### Edge Function: 3cplus-export

**Input:** Lista de client IDs ou filtros aplicados
**Output:** Resultado do envio à API 3CPlus

Formato esperado pela 3CPlus:
- Nome, telefone(s), CPF, valor em aberto
- URL de callback: `/atendimento/{client_id}`

### Considerações

- O operador precisa estar logado no sistema para que a URL `/atendimento/:id` funcione
- A 3CPlus abre essa URL em um iframe ou nova aba quando a ligação conecta
- Não há mudanças no banco de dados (usa estrutura existente)
