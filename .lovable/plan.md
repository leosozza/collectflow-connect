

# Plano: Tabulações de Atendimento (Chamadas + WhatsApp)

## Resumo

Adicionar coluna `channel` à tabela `call_disposition_types`, renomear o menu para "Tabulações de Atendimento", criar sub-abas (Chamadas / WhatsApp), seed de 10 tabulações WhatsApp padrão, e transformar a aba Etiquetas do WhatsApp em visualização somente-leitura.

---

## 1. Migração: coluna `channel`

```sql
ALTER TABLE call_disposition_types 
  ADD COLUMN channel text NOT NULL DEFAULT 'call' 
  CHECK (channel IN ('call', 'whatsapp'));
```

Registros existentes ficam com `channel = 'call'`. O unique constraint `(tenant_id, key)` já existe — as keys WhatsApp serão distintas (prefixo `wa_`).

---

## 2. Seed de tabulações WhatsApp padrão

Adicionar em `dispositionService.ts`:

| Key | Label | Impacto |
|---|---|---|
| wa_cpc | CPC - Contato Pessoa Certa | positivo |
| wa_cpe | CPE - Contato Pessoa Errada | negativo |
| wa_acordo_formalizado | Acordo Formalizado | positivo |
| wa_risco_processo | Risco de Processo | negativo |
| wa_sem_contato | Sem Contato | negativo |
| wa_em_negociacao | Em Negociação | positivo |
| wa_em_dia | Em Dia | positivo |
| wa_quitado | Quitado | positivo |
| wa_sem_interesse_produto | Sem Interesse Produto | negativo |
| wa_sem_interesse_financeiro | Sem Interesse Financeiro | negativo |

Nova função `seedDefaultWhatsAppDispositionTypes(tenantId)` com auto-seed no componente.

---

## 3. Renomear menu + sub-abas

**CadastrosPage.tsx**:
- `"Tabulação de Chamada"` → `"Tabulações de Atendimento"`
- Key: `tabulacoes` (redirecionar `tabulacao_chamada` para compatibilidade)
- Renderizar novo wrapper `DispositionTabsWrapper`

**Novo**: `src/components/cadastros/DispositionTabsWrapper.tsx`
- Tabs com "Chamadas" e "WhatsApp"
- Cada aba renderiza `CallDispositionTypesTab` com prop `channel`

---

## 4. Filtrar por channel no CallDispositionTypesTab

- Aceitar prop `channel: 'call' | 'whatsapp'` (default `'call'`)
- Filtrar query com `.eq("channel", channel)`
- Seed automático usa lista correta conforme channel
- Create inclui `channel` no payload
- Para WhatsApp: esconder colunas de chamada (Comportamento, flags de discagem)

---

## 5. Aba Etiquetas do WhatsApp → somente leitura

**TagsManagementTab.tsx**:
- Ler `call_disposition_types` filtrado por `channel = 'whatsapp'`
- Exibir como lista visual (cor + nome + impacto), sem edição
- Adicionar link "Gerenciar em Cadastros > Tabulações"

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Adicionar coluna `channel` |
| `dispositionService.ts` | Lista WhatsApp, seed function, channel no create |
| `CadastrosPage.tsx` | Renomear nav, usar wrapper |
| `DispositionTabsWrapper.tsx` | **Novo**: sub-abas Chamadas/WhatsApp |
| `CallDispositionTypesTab.tsx` | Prop `channel`, filtrar query, adaptar colunas |
| `TagsManagementTab.tsx` | Somente leitura das tabulações WhatsApp |

## O que NÃO muda
- Tabela `conversation_tags` (preservada, apenas desvinculada da UI)
- Sync 3CPlus (continua apenas para channel=call)
- Tabulação na ficha de atendimento

