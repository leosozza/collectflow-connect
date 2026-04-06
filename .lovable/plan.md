

# Plano: Módulo "Modelos de Documentos" — 5 Fases

## Situação atual

- Templates hardcoded em `CredorForm.tsx` (linhas 33-90), com variáveis `{nome_devedor}` etc.
- `ClientDocuments.tsx` busca templates apenas da tabela `credores` — se não encontra, mostra erro
- Não existe fallback para tenant nem para defaults do sistema
- `ConfiguracoesPage.tsx` tem 4 abas (Integração, Auditoria, API REST, MaxList)

## FASE 1 — Base estrutural

### Migration SQL
Criar tabela `document_templates` com RLS:
- SELECT: `tenant_id = get_my_tenant_id()`
- INSERT/UPDATE/DELETE: `tenant_id = get_my_tenant_id() AND is_tenant_admin(auth.uid(), tenant_id)`
- Trigger `updated_at`

### Novos arquivos
| Arquivo | Conteúdo |
|---|---|
| `src/lib/documentDefaults.ts` | 5 templates padrão extraídos do `CredorForm.tsx` + mapa `TEMPLATE_DEFAULTS` + array `DOCUMENT_TYPES` com key/label/icon/type/description |
| `src/lib/documentPlaceholders.ts` | Lista oficial de placeholders com nome, descrição e categoria (credor, devedor, financeiro, acordo) |

### Alterações
| Arquivo | Mudança |
|---|---|
| `CredorForm.tsx` | Importar defaults de `documentDefaults.ts`, remover hardcoded (linhas 33-90) |
| `ClientDocuments.tsx` | Adicionar query à `document_templates` do tenant; resolver template com fallback: credor → tenant → default. Manter comportamento atual intacto |

---

## FASE 2 — Módulo de gestão

### Novos arquivos
| Arquivo | Conteúdo |
|---|---|
| `src/pages/DocumentTemplatesPage.tsx` | Lista dos 5 modelos em cards com: nome, descrição, badge (Padrão/Personalizado), botões Editar/Visualizar/Restaurar. Seed automático dos faltantes ao abrir. Editor via Sheet com textarea. Restaurar = resetar content + `is_customized = false`. Preview com dados fictícios |

### Alterações
| Arquivo | Mudança |
|---|---|
| `ConfiguracoesPage.tsx` | Nova aba "Modelos de Documentos" (ícone FileText, visível para `isTenantAdmin`) |

---

## FASE 3 — Experiência profissional

### Alterações em `DocumentTemplatesPage.tsx`
- Editor evoluído com toolbar: negrito, itálico, títulos, listas, alinhamento, separadores
- Layout em duas colunas: editor (esquerda) + preview em tempo real (direita)
- Preview estilo A4 com margens, tipografia profissional
- Painel de placeholders clicável organizado por categoria (credor, devedor, financeiro, acordo)

---

## FASE 4 — Componentes dinâmicos

### Alterações
- Implementar `{{tabela_parcelas}}` com renderização automática (Parcela | Vencimento | Valor)
- Substituição de variáveis com fallback seguro (variável não encontrada = string vazia, sem erro)
- Cláusulas numeradas automáticas

---

## FASE 5 — Uso real (produção)

### Novos arquivos/alterações
- Edge Function para gerar PDF com logo do tenant
- Botões de download PDF, envio por WhatsApp e e-mail
- Tabela `generated_documents` para histórico
- Vincular documentos gerados ao perfil do cliente e ao acordo

---

## Execução

Vou implementar **FASE 1 e FASE 2 juntas** nesta execução (base + UI de gestão). As fases 3-5 ficam para prompts futuros.

### Arquivos da execução atual

| Arquivo | Tipo |
|---|---|
| Migration SQL | Tabela `document_templates` + RLS + trigger |
| `src/lib/documentDefaults.ts` | Novo |
| `src/lib/documentPlaceholders.ts` | Novo |
| `src/pages/DocumentTemplatesPage.tsx` | Novo |
| `src/components/cadastros/CredorForm.tsx` | Importar defaults |
| `src/components/client-detail/ClientDocuments.tsx` | Fallback 3 níveis |
| `src/pages/ConfiguracoesPage.tsx` | Nova aba |

