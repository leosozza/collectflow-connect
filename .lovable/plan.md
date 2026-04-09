

# Correções em /relatorios — Parcelas, Aging e Baixas

## Mudanças

### 1. Parcelas Detalhadas — mostrar apenas clientes com acordos no Rivo

**Problema**: Hoje `credorClients` usa `clients` (carteira completa). Deve mostrar apenas parcelas de clientes que possuem acordo gerado no sistema.

**Correção** em `PrestacaoContas.tsx`:
- Filtrar `credorClients` para incluir apenas clientes cujo CPF existe em `credorAgreements`
- Criar um `Set` de CPFs com acordo: `new Set(credorAgreements.map(a => a.client_cpf))`
- Usar esse Set para filtrar: `clients.filter(c => c.credor === selectedCredor && cpfsComAcordo.has(c.cpf))`

### 2. Aging da Carteira — novas faixas e valor recebido

**Problema**: Faixas atuais são 0-30, 31-60, 61-90, 90+. Precisam ser: **0-30, 31-90, 91-180, 181-365, 366+**.

**Correção** em ambos `AgingReport.tsx` e `PrestacaoContas.tsx`:
- Atualizar `BUCKETS` / `AGING_BUCKETS` para as novas faixas
- Adicionar coluna "Recebido" na tabela de aging: para cada faixa, somar `valor_pago` das parcelas com status `pago` que caem naquela faixa de vencimento
- No `AgingReport.tsx`: receber `agreements` como prop para cruzar `total_paid_real` por faixa de aging, OU simplesmente somar `valor_pago` das parcelas pagas na mesma faixa

### 3. Remover seção "Baixas Manuais" (e automáticas)

**Correção** em `PrestacaoContas.tsx`:
- Remover a seção "Baixas Manuais" (linhas 333-353)
- Remover a query de `manual_payments` (linhas 38-50)
- Remover `manualPaymentStats` (linhas 52-67)
- Remover sheet "Baixas Manuais" do export Excel
- Remover props/variáveis associadas

### 4. Parcelas Detalhadas — iniciar fechada com setinha para expandir

**Correção** em `PrestacaoContas.tsx`:
- Envolver a seção "Parcelas Detalhadas" em um `Accordion` (já existe componente `ui/accordion`)
- `AccordionItem` com `AccordionTrigger` contendo o título "Parcelas Detalhadas (N)"
- `AccordionContent` contendo a tabela
- Iniciar fechado (não definir `defaultValue`)

---

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/relatorios/PrestacaoContas.tsx` | Filtrar parcelas por CPFs com acordo; novas faixas aging; remover baixas manuais; accordion em parcelas |
| `src/components/relatorios/AgingReport.tsx` | Novas faixas (0-30, 31-90, 91-180, 181-365, 366+); coluna "Recebido" |

## O que NÃO muda
- KPIs, ranking, acordos, status, automações — tudo preservado
- Aging continua usando `clients` (métrica de carteira)

