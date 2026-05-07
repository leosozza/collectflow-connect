# Registro de Melhorias - 07/05/2026

Resumo das evoluções aplicadas hoje no RIVO.

## 🚀 Novas Funcionalidades
- **Múltiplos Contratos no Header:** Implementada lógica de consolidação de contratos por CPF, exibindo strings concatenadas (`409128 | 409129`) no perfil do cliente.
- **Identificação Visual ybrasil:** Adicionado prefixo `[CONTRATO]` na coluna de parcelas para o tenant ybrasil, facilitando conferência rápida.
- **Painel Anti-Ban WhatsApp:** Adicionados indicadores visuais de progresso (Pausas, Descanso e Retomada) no resumo da campanha.

## 🛠 Melhorias de Backend
- **Unificação de Baixas Realizadas:** Atualização da função SQL `get_baixas_realizadas` para consolidar pagamentos de múltiplas fontes (Manual, Portal, Negociarie).
- **Restauração de Data de Pagamento:** Re-aplicação da lógica FIFO para cálculo de quitação em parcelas de acordos e restauração da coluna na Carteira.
- **Limpeza de Código:** Remoção de arquivos legados e redundantes do antigo cluster Financeiro.

## 🛡 Segurança e Estabilidade
- **Fix 401 Session:** Correção de falhas de autenticação em Edge Functions de disparo em massa.
- **Isolamento de Tenants:** Auditoria realizada em todas as novas consultas SQL para garantir conformidade com o RLS.

---
[[RIVO_BRAIN]]
