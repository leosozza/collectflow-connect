## Diagnóstico

O erro **"Extension SIP não encontrada para o agente 185845"** acontece porque a extension cadastrada no perfil do operador (`profiles.threecplus_extension`) **não está sendo enviada** para a Edge Function `threecplus-proxy` em vários pontos do app.

Confirmei no banco que a Sabrina (agent 185845) tem extension `1007` corretamente salva. O problema é apenas no frontend: alguns botões de discagem ignoram esse campo.

### Pontos que enviam corretamente (já funcionam)
- `CallButton` (botão de telefone reutilizável) — passa `extension` via `dialClientPhone`.
- `useAtendimentoModal` (auto-dial após conexão) — também passa `extension`.

### Pontos que NÃO enviam (causam o erro)
1. **`src/components/contact-center/threecplus/DialPad.tsx`** (linha ~79) — o teclado discador da tela `/contact-center/telefonia` não envia extension.
2. **`src/components/contact-center/threecplus/TelefoniaDashboard.tsx`** (linha ~1442) — botão de rediscar no `OperatorCallHistory` não envia extension.
3. **`src/pages/AtendimentoPage.tsx`** (linha ~468) — botão de discagem dentro do modal de atendimento não envia extension.

Quando a extension não é enviada, a Edge Function tenta descobrir via API 3CPlus (`/users`, `/extensions`, `/agents/:id`) — esse fallback está falhando no ambiente 3CPlus do tenant, então o erro aparece mesmo com o cadastro correto.

## Correção

Em todos os 3 chamadores acima, ler `profile.threecplus_extension` (já disponível via `useAuth`) e adicionar `extension` no body do `click2call`.

Também vou aproveitar e padronizar: onde fizer sentido (DialPad e OperatorCallHistory na tela de Telefonia), usar a função canônica `dialClientPhone` em vez do `invoke("click2call", ...)` direto, garantindo que esse tipo de bug não se repita no futuro (mesma lógica de bloqueio por status, toasts, etc.).

### Arquivos alterados
- `src/components/contact-center/threecplus/DialPad.tsx` — incluir `extension` no payload (ou trocar para `dialClientPhone`).
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — incluir `extension` no rediscar do histórico.
- `src/pages/AtendimentoPage.tsx` — incluir `extension` no `click2call`.

Sem mudanças de banco e sem mudanças na Edge Function (o suporte a `extension` no body já existe).

**Posso aplicar?**