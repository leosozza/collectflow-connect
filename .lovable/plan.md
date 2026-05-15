# Análise — Negociarie do credor TESS MODELS

## 1) Mesmo Client ID/Secret no Tenant e no Credor — tem problema?

**Tecnicamente não quebra nada, mas anula o propósito da "Cobrança Direta".**

O que confirmei no banco (`tenant_integrations`, provider=`negociarie`):

| Escopo | creditor_id | client_id | Ativo | Último teste |
|---|---|---|---|---|
| Tenant Y.BRASIL | (null) | **1306** | ✅ | 15/05 18:45 OK |
| Credor TESS MODELS | `143cc8af…` | **1306** | ✅ | 15/05 18:44 OK |

E o fluxo do `negociarie-proxy` (`getNegociarieConfig`):
1. Se o credor tem `cobrança_direta_ativa = true` → busca credenciais do credor.
2. Senão → usa as do tenant.
3. Senão → fallback global (ENV).

**Implicação prática:**
- A flag de "Cobrança Direta" do TESS MODELS está orientando o sistema a usar credenciais "do credor"… que são as **mesmas do Tenant** (client 1306). Ou seja, todo boleto emitido para TESS MODELS continua caindo na **mesma conta Negociarie da Y.BRASIL** — exatamente igual a se a flag estivesse desligada.
- Não há risco de erro, duplicidade ou falha de baixa. O webhook continua funcionando porque é a mesma conta.
- O "problema" é só **conceitual / contábil**: se a ideia da Cobrança Direta é o credor receber em **conta Negociarie própria** (CNPJ do credor), você precisa do **client_id/secret da conta Negociarie do TESS MODELS**, não os da Y.BRASIL.

**Recomendação:**
- Se TESS MODELS **não tem** conta Negociarie própria → desligue "Cobrança Direta" no cadastro do credor. As credenciais do tenant já cobrem tudo.
- Se TESS MODELS **vai ter** conta própria → solicite à Negociarie um par client_id/secret específico do CNPJ do TESS e substitua no cofre do credor.

## 2) Webhook de baixa — por que não aparece no Cadastro Bancário?

**Por design, e está correto.** O callback URL é configurado **uma vez por conta Negociarie (client_id)**, não por credor.

- A URL `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/negociarie-callback` é registrada na Negociarie via endpoint `POST /cobranca/atualizar-url-callback` (action `atualizar-callback` do proxy).
- Como TESS MODELS está usando **client_id 1306** (o mesmo do tenant), o callback **já está cobrindo o credor automaticamente** — não precisa registrar de novo.
- Por isso a tela "Configuração Negociarie" do Cadastro Bancário do credor (`CreditorIntegrationsVault`) **não mostra campo de callback**: seria redundante e perigoso (sobrescreveria a URL global da conta).
- Se um dia o TESS tiver conta própria (client_id diferente), aí sim seria preciso registrar o callback nessa nova conta — o registro continuaria sendo feito pelo painel Tenant (Configurações → Integrações → Negociarie), apontando para o credor.

**Detalhe a observar:** nas duas linhas, `callback_registered_at = null`. Isso significa que a coluna de auditoria nunca foi preenchida (provavelmente o "atualizar-callback" foi feito direto pelo painel sem gravar a data). Como os webhooks já estão chegando normalmente em produção, é só cosmético — mas se quiser deixar limpo, basta clicar em "Atualizar Callback" novamente em **Configurações → Integrações → Negociarie** (que esse fluxo grava a data).

## Resumo executivo
- ✅ Sistema funciona normalmente. Nenhuma baixa será perdida.
- ⚠️ A flag "Cobrança Direta" do TESS MODELS está ativa **sem trazer benefício** — credenciais idênticas às do tenant. Decida: desligar a flag **ou** trocar por credenciais Negociarie próprias do TESS.
- ✅ Ausência de campo de callback no Cadastro Bancário é **proposital** — callback é por conta Negociarie (client_id), não por credor.

## Ações sugeridas (nenhum código a alterar)
1. Confirmar com TESS MODELS se há conta Negociarie própria.
   - Se **não** → desativar "Cobrança Direta" no cadastro do credor.
   - Se **sim** → atualizar client_id/secret no cofre do credor com as credenciais do TESS.
2. (Opcional) Reaplicar "Atualizar Callback" em Configurações → Integrações → Negociarie só para gravar `callback_registered_at` (cosmético).
