

## Proposta: Separar Gestão de Parcelas Originais vs. Acordos

### Entendimento da Lógica de Status

```text
┌─────────────────────────────────────────────────────────┐
│  PARCELAS ORIGINAIS (importadas)                        │
│                                                         │
│  Em dia ──(venceu)──> Aguardando Acionamento            │
│                         │                               │
│                    (fez acordo no sistema)               │
│                         │                               │
│                         ▼                               │
│              ┌──────────────────────┐                   │
│              │  ACORDOS DO SISTEMA  │                   │
│              │  Status: Acordo      │                   │
│              │  Vigente             │                   │
│              └──────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Sim, faz sentido separar em dois módulos

A Carteira atual mistura dois contextos operacionais distintos. A proposta:

**Módulo 1 — Carteira (Parcelas Originais)**
- Exibe apenas clientes com parcelas originais importadas (sem acordo ativo)
- Status automáticos: **Em dia** (parcelas futuras) → **Aguardando Acionamento** (parcelas vencidas)
- Foco: prevenção, acionamento, primeiro contato

**Módulo 2 — Acordos (já existe em /acordos)**
- Clientes que formalizaram acordo no sistema
- Status: **Acordo Vigente**, **Pago**, **Vencido**, **Cancelado**
- Foco: acompanhamento de acordos, cobrança de parcelas de acordo

### Alterações Necessárias

**1. Automatizar transição de status na Carteira**
- Criar lógica (cron ou trigger) que muda automaticamente:
  - `Em dia` → `Aguardando Acionamento` quando `data_vencimento < hoje`
  - `Aguardando Acionamento` → `Em dia` se todas as parcelas pendentes voltarem a estar em dia
- Ao criar acordo: mudar status para `Acordo Vigente`

**2. Filtrar Carteira para mostrar apenas parcelas originais**
- Excluir da listagem principal clientes com acordo ativo (status `em_acordo`)
- Adicionar badge/aba separando "Em dia" e "Aguardando Acionamento"

**3. Sincronizar status_cobranca_id automaticamente**
- Na importação: se todas as parcelas do CPF+credor estão futuras → `Em dia`
- Edge function cron diária: reclassifica `Em dia` ↔ `Aguardando Acionamento` com base no vencimento
- Ao formalizar acordo: atualizar para `Acordo Vigente`

**4. Módulo Acordos já existente**
- A página `/acordos` já gerencia acordos formalizados
- Garantir que clientes com acordo ativo apareçam lá com status `Acordo Vigente`

### Arquivos a modificar
- `src/pages/CarteiraPage.tsx` — filtrar somente parcelas originais, adicionar abas Em dia / Aguardando Acionamento
- `src/services/clientService.ts` — lógica de importação para definir status inicial correto
- `supabase/functions/` — nova edge function cron para reclassificação diária de status
- `src/services/agreementService.ts` — garantir que ao criar acordo, status_cobranca mude para Acordo Vigente

### Resultado
- **Carteira**: visão limpa de parcelas originais (Em dia + Aguardando Acionamento)
- **Acordos**: gestão dedicada de negociações formalizadas no sistema
- Transições de status automáticas e consistentes

