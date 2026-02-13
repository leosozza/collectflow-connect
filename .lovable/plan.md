
# Plano de Implementação - Sistema de Cobrança

## Fase 1 - Tela de Atendimento ✅
- [x] Tela /atendimento/:id com header, tabulação, negociação
- [x] Tabela call_dispositions
- [x] Campo external_id nos clients
- [x] Campos endereço e observações
- [x] Abas Histórico + Conversa WhatsApp
- [x] Chat WhatsApp com bolhas (input desabilitado)

## Fase 2 - Integração com Discador 3CPlus ✅
- [x] Aba 3CPlus na página de Integrações (domínio + token)
- [x] Edge function threecplus-proxy (list campaigns, create list, send mailing)
- [x] Seleção múltipla (checkbox) na tabela da Carteira
- [x] Botão "Discador" com contagem de selecionados
- [x] Dialog de envio com seleção de campanha
- [x] Criação automática de lista + envio de mailing via API

## Fase 3 - Disparo de WhatsApp em Lote (pendente)
- [ ] Seleção múltipla na carteira (reusar checkboxes da Fase 2)
- [ ] Dialog de disparo com seleção de template
- [ ] Envio batch via edge function send-notifications
- [ ] Progresso/resultado do envio

## Fase 4 - Automações pós-tabulação (pendente)
- [ ] Vincular disposition_type a ações automáticas
- [ ] Triggers/edge functions que executam ações ao salvar tabulação
