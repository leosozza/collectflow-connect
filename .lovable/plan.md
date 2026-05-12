## Correção de regressão em /configuracoes/integracao

Você está certo: na rodada anterior eu converti **Evolution API** e **Gupshup** em telas "Em breve", mas elas já estavam funcionais (cadastro de instâncias, QR Code, teste de conexão, logs do webhook). Negociarie continua correta. Vamos reverter Evolution e Gupshup mantendo o novo layout padronizado.

### Diagnóstico

- `WhatsAppIntegrationTab.tsx` (281 linhas) já contém toda a lógica funcional: `BaylersInstancesList` (Evolution), `GupshupInstancesList` + `GupshupConfigDialog` (Gupshup), botão "Nova Instância", logs do webhook, teste de conexão Gupshup. Esse arquivo **não foi removido** — só deixou de ser usado pelos novos `EvolutionTab.tsx` e `GupshupTab.tsx` que viraram stubs de 20 linhas.
- Negociarie está OK (123 linhas, conectada via `negociarieService`).
- Asaas / Serasa / Cenprot / Target Data permanecem como "Em breve" (você não citou — confirmar abaixo se quiser tratar diferente).

### Alterações propostas

**1. `src/components/integracao/EvolutionTab.tsx`** — restaurar funcionalidade
- Importar `BaylersInstancesList`, `BaylersInstanceForm`, dialog de logs do webhook (extraído do `WhatsAppIntegrationTab`).
- Renderizar dentro do `IntegrationDetailLayout` (status `connected` quando `whatsapp_instances.provider='evolution'` existir, senão `not_configured`).
- Botão "Nova instância" abre formulário do Baylers.
- Bloco de logs (`webhook_logs` filtrado por `evolution-proxy`) acessível via botão.

**2. `src/components/integracao/GupshupTab.tsx`** — restaurar funcionalidade
- Importar `GupshupInstancesList`, `GupshupConfigDialog` e o handler de teste de conexão (`gupshup-proxy`).
- Renderizar dentro do `IntegrationDetailLayout`.
- Status `connected` quando houver `whatsapp_instances.provider='gupshup'` ou `tenant.settings.gupshup_api_key` preenchido.
- Botões: "Nova instância" (abre `GupshupConfigDialog`), "Testar conexão", "Ver logs" (filtra `gupshup-webhook`/`gupshup-proxy`).

**3. `src/components/integracao/integrationsCatalog.ts`** — ajustes de metadata
- `evolution.available = true` + bloco `requirements` (servidor Evolution já provisionado pela RIVO; basta criar instância e ler QR Code).
- `gupshup.available = true` + `requirements` ("App Name" e "API Key" obtidos no painel Gupshup; link para `https://gupshup.io`).
- Remover `comingSoonFeatures` desses dois.

**4. `src/pages/IntegracaoPage.tsx`** — status do Gupshup
- Adicionar `case "gupshup"` em `computeStatus`: `connected` se houver instância gupshup OU `settings.gupshup_api_key && settings.gupshup_app_name`. Carregar essa flag no mesmo `useEffect` (`hasGupshup`).

**5. (Opcional) `src/components/integracao/WhatsAppIntegrationTab.tsx`** — manter como está. Não está mais referenciado pela `IntegracaoPage`, mas o `RoadmapPage.tsx` ainda menciona o caminho. Deixar o arquivo vivo evita quebrar referências; podemos limpar depois.

### Fora de escopo

- Lógica de provisionamento, edge functions (`evolution-proxy`, `gupshup-proxy`, `gupshup-webhook`), schema de `whatsapp_instances` — nada muda.
- Visual da grade da página de integrações — intocado.
- Asaas/Serasa/Cenprot/Target Data — permanecem "Em breve" (confirmar).

### Riscos

- Baixo: estamos apenas re-empacotando componentes já existentes (`BaylersInstancesList`, `GupshupInstancesList`, `GupshupConfigDialog`) dentro do novo layout. Nenhuma mudança em estado, RLS, vault ou chamadas a edge functions.
- A query de detecção do Gupshup é nova mas idêntica ao padrão da Evolution (mesma tabela, filtro por `tenant_id`).

### Pergunta

Confirma manter Asaas/Serasa/Cenprot/Target Data como "Em breve" nesta etapa? Se Asaas também já estiver em uso por algum tenant, me avisa para incluir no mesmo ajuste.