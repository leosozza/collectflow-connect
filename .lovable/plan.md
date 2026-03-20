

# Plano: Carteira começa vazia + Gestão de Acordos com boletos

## Parte 1 — Carteira começa zerada

### Problema
A página `/carteira` executa `fetchClients(filters)` no mount, sem nenhum filtro ativo. Isso carrega todos os clientes do tenant, causando travamentos e consumo de memória.

### Solução
Adicionar flag `hasActiveFilters` que verifica se pelo menos um filtro foi preenchido. Se nenhum filtro estiver ativo, não executar a query (`enabled: false` no useQuery) e mostrar mensagem orientando o usuário a usar os filtros.

**Arquivo:** `src/pages/CarteiraPage.tsx`

- Criar `hasActiveFilters` que compara cada filtro com seu default (search não vazio, credor != "todos", datas preenchidas, checkboxes ativos, etc.)
- Passar `enabled: hasActiveFilters && !!tenant?.id` no useQuery de clients
- Quando `!hasActiveFilters`, renderizar um card informativo: "Utilize os filtros acima para buscar clientes"
- O mesmo para queries auxiliares (agreement-cpfs, contacted-client-ids) — só rodar quando houver clientes carregados

---

## Parte 2 — Gestão de Acordos: boletos e detalhes

### Problema
Ao acessar um acordo em `/acordos`, não há opção de gerar/baixar boletos nem visualizar as parcelas detalhadas.

### Solução
Expandir o diálogo de edição do acordo para incluir:

1. **Tabela de parcelas virtuais** — gerar via `generate_series` lógica no frontend (entrada + N parcelas mensais a partir de `first_due_date`), mostrando número, valor, data de vencimento e status (pago/pendente/vencido)
2. **Botão "Gerar Boleto"** por parcela — integrar com Asaas (já existe `asaas-proxy` edge function e `ASAAS_API_KEY_PRODUCTION` configurado) para criar cobrança e obter link do boleto
3. **Botão "Baixar Boleto"** — link direto para o PDF do boleto gerado

**Arquivos:**

| Arquivo | Mudança |
|---|---|
| `src/pages/CarteiraPage.tsx` | Adicionar `hasActiveFilters`, desabilitar query quando vazio, mostrar empty state |
| `src/pages/AcordosPage.tsx` | Expandir diálogo de edição com aba/seção de parcelas e botões de boleto |
| `src/components/acordos/AgreementInstallmentsPanel.tsx` | Novo — tabela de parcelas virtuais com ações de boleto |
| `src/services/agreementService.ts` | Adicionar função para gerar boleto via Asaas proxy |

### Parcelas virtuais — lógica

```text
Parcela 0 (entrada): valor = entrada_value, vencimento = entrada_date
Parcela 1..N: valor = new_installment_value, vencimento = first_due_date + (i-1) meses
```

Status de cada parcela calculado comparando `valor_pago` acumulado do client com soma das parcelas vencidas.

### Boletos — integração Asaas

Usar a edge function `asaas-proxy` existente para criar cobranças:
- Enviar CPF, nome, valor, vencimento
- Armazenar `bankSlipUrl` retornado
- Oferecer download direto do PDF

