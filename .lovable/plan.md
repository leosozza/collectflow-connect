
# Melhorias em /configuracoes/integracao

## Diagnóstico

A grade de cards (Financeiro / Discador / WhatsApp / Negativação / Enriquecimento / CRMs) já está bem desenhada. Os problemas estão em duas camadas:

### 1. Logos
A página referencia `/logos/negociarie.png`, `/logos/3cplus.png`, etc., mas a pasta `public/logos/` **não existe**. Hoje cai sempre no ícone genérico do `lucide-react` colorido. O usuário não reconhece visualmente as marcas.

### 2. Conteúdo de cada integração (ao clicar no card)
Auditando os 9 tabs, há três grupos bem distintos:

| Integração | Estado real | O que falta |
|---|---|---|
| **3CPlus** | Funcional (salva em `tenants.settings`, testa via `threecplus-proxy`) | Cabeçalho/explicação padronizada, link de onde pegar o token |
| **Negociarie** | Funcional (vault + proxy) | Padronização visual e instruções |
| **CobCloud** | Funcional (3 tokens, teste real) | Padronização |
| **Evolution / Gupshup** | Funcional (instâncias) | Padronização do "como começar" |
| **Asaas** | **STUB** — `setTimeout` falso, não salva nada, não testa | Implementar ou marcar como "Em breve" |
| **Serasa** | **STUB** — idem | Implementar ou marcar como "Em breve" |
| **Cenprot** | **STUB** — idem | Implementar ou marcar como "Em breve" |
| **Target Data** | **STUB** — idem | Implementar ou marcar como "Em breve" |

Cada tab tem cabeçalho próprio diferente, layout diferente, e nenhuma traz uma seção objetiva de "para que serve / o que você precisa / como testar / como ir para produção" — exatamente o que o usuário pediu.

---

## Proposta (sem mexer no visual da listagem)

### Etapa 1 — Logos reais
Adicionar arquivos em `public/logos/`:
- `negociarie.png`, `asaas.png`, `3cplus.png`, `evolution.png`, `gupshup.png`, `serasa.png`, `cenprot.png`, `targetdata.png`, `cobcloud.png`

Fonte: site oficial de cada parceiro (favicon/press kit). Padrão: PNG quadrado 256×256, fundo transparente. O código já tem fallback para o ícone caso a imagem falhe — nenhuma mudança de JSX necessária na grade.

Pequeno ajuste opcional no card: trocar `object-cover` por `object-contain` com padding interno (`p-1.5`) para a logo respirar e não ser cortada — ainda dentro do mesmo card colorido.

### Etapa 2 — Padrão único de tela ao entrar numa integração

Criar um componente compartilhado `IntegrationDetailLayout` usado por **todos os tabs**, com estrutura fixa:

```text
┌──────────────────────────────────────────────┐
│ [Logo grande]  Nome do Provedor              │
│                Categoria · Status (badge)     │
│                "Para que serve" (1 linha)     │
├──────────────────────────────────────────────┤
│ ▸ O que você precisa                          │
│   • Conta ativa em <provedor>                 │
│   • Token / chave de API                      │
│   • Link: "Onde obtenho?" (doc oficial)       │
├──────────────────────────────────────────────┤
│ ▸ Credenciais            [Modo: Teste|Produção]│
│   <campos do tab atual>                       │
│   [Salvar]  [Testar conexão]                  │
├──────────────────────────────────────────────┤
│ ▸ Status da integração                        │
│   Última conexão OK em ...                    │
│   Última falha: ...                           │
└──────────────────────────────────────────────┘
```

Pontos-chave:
- **Toggle Sandbox/Produção** fica visível e explícito (hoje só Negociarie e CobCloud têm noção disso). Persistido em `tenant_integrations.environment` (já existe esse padrão em outras integrações nossas).
- **Seção "O que você precisa"** padronizada — texto curto + link externo para a doc oficial do parceiro de onde tirar o token.
- **Seção "Status"** mostra resultado do último teste (data/hora + mensagem). Usa o resultado do botão "Testar conexão", salvo em `tenant_integrations.last_test_at` / `last_test_result`.
- Os tabs existentes passam a renderizar **apenas** o bloco de campos (input do token/domínio). O cabeçalho, instruções e ações ficam no layout. Reduz divergência visual e código duplicado.

### Etapa 3 — Tratar os 4 stubs (Asaas / Serasa / Cenprot / Target Data)

Sem implementar backend agora (escopo é UX/clareza), aplicar uma das duas opções **por integração**:

- **Opção A — "Em breve"**: tab abre, mas mostra um banner claro "Esta integração estará disponível em breve" + lista de funcionalidades planejadas. Botão de salvar desabilitado. No card da grade, badge `Em breve` em vez de `Não configurado`.
- **Opção B — habilitar cadastro real**: implementar o salvamento no `tenant_integrations` (vault) usando o mesmo fluxo do Negociarie. Sem teste de conexão por enquanto.

Recomendação: **A para Serasa/Cenprot/Target Data** (dependem de contratos B2B nossos com o parceiro, não basta o cliente ter token), **B para Asaas** (cliente pode trazer a própria conta, mesmo padrão do Negociarie).

### Etapa 4 — Microcópia e clareza geral

- Trocar "Token de API" genérico pelo **nome real** que o parceiro usa (ex.: 3CPlus chama "Bearer Token"; Gupshup chama "API Key"; Asaas chama "Access Token").
- Placeholder do input mostra **formato esperado** (ex.: `sk_prod_xxxxxxxx`).
- Botão `Testar conexão` sempre antes de `Salvar` na ordem visual — incentiva o cliente a validar antes de persistir.
- No card da grade, três estados claros em vez de dois: `Conectado` (verde) · `Configurado em teste` (amarelo) · `Não configurado` (cinza).

---

## Detalhes técnicos

- Novo componente `src/components/integracao/IntegrationDetailLayout.tsx` recebendo: `provider`, `logoUrl`, `category`, `description`, `requirements: string[]`, `docsUrl`, `environment`, `onEnvironmentChange`, `lastTest`, `children` (campos), `onSave`, `onTest`, `saving`, `testing`.
- Refator de `NegociarieTab`, `ThreeCPlusTab`, `CobCloudTab`, `EvolutionTab`, `GupshupTab` para usar o novo layout — sem alterar lógica de save/test (apenas mover o JSX de fora dos campos para o layout).
- `AsaasTab` / `SerasaTab` / `CenprotTab` / `TargetDataTenantTab`: substituir o `setTimeout` por estado "coming soon" (Asaas vira fluxo real igual Negociarie se você confirmar Opção B).
- Logos: arquivos novos em `public/logos/`. Sem mudança no `IntegracaoPage.tsx` além do `object-contain p-1.5`.
- Migração leve em `tenant_integrations` apenas se ainda não existirem `last_test_at` (timestamptz) e `last_test_result` (jsonb). Confirmar antes de criar.

## Fora de escopo

- Nada na grade (cores, ordem, agrupamento) muda.
- Não tocaremos nas edge functions de proxy (`threecplus-proxy`, `negociarie-proxy`, `cobcloud-proxy`).
- Sem mudar o fluxo de WhatsApp (Evolution/Gupshup mantêm a sub-listagem de instâncias dentro do novo layout).

## Perguntas antes de executar

1. Você consegue me enviar (ou autorizar buscar das fontes oficiais) os 9 PNGs de logo? Posso usar fallback automático para favicons oficiais se preferir.
2. Para Asaas/Serasa/Cenprot/Target Data — confirma a recomendação (A para 3 deles, B para Asaas) ou quer todos como "Em breve" por enquanto?
3. Você quer o toggle **Sandbox / Produção** visível em todas integrações ou só nas que realmente têm ambiente separado (Negociarie, Asaas, CobCloud)?
