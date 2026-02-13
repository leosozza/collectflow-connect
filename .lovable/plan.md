

# Assinatura Digital de Acordos

## Resumo

Criar um sistema proprio de assinatura digital com 3 modalidades configuraveis por tenant: **Click** (aceite simples), **Reconhecimento Facial** (captura de foto com instrucoes) e **Assinatura na Tela** (desenho com dedo/caneta). O tenant escolhe qual tipo usar nas configuracoes.

## Fluxo do Usuario

```text
Acordo Aprovado --> Link de Checkout --> Tela de Assinatura --> Pagamento
                                              |
                                   Tipo definido pelo tenant:
                                   - Click: botao "Li e aceito"
                                   - Facial: captura foto seguindo instrucoes
                                   - Assinatura: desenha com dedo/caneta
```

## Componentes Novos

### 1. Tabela `agreement_signatures` (migracao)

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| agreement_id | uuid | FK para agreements |
| tenant_id | uuid | Isolamento multi-tenant |
| signature_type | text | "click", "facial", "draw" |
| signature_data | text | Base64 da imagem (foto ou assinatura desenhada) |
| ip_address | text | IP do cliente no momento da assinatura |
| user_agent | text | Navegador/dispositivo |
| signed_at | timestamptz | Momento exato da assinatura |
| metadata | jsonb | Dados extras (instrucoes seguidas, etc) |

- RLS: leitura publica via checkout_token (como agreements), service_role para insert, admins do tenant podem ver.

### 2. Configuracao no Tenant

Adicionar no campo `settings` (jsonb) do tenant a chave `signature_type` com valores possiveis: `"click"`, `"facial"`, `"draw"`. Default: `"click"`.

### 3. Pagina de Configuracoes (`TenantSettingsPage.tsx`)

Novo card "Assinatura Digital" com:
- Radio group para selecionar o tipo: Click, Reconhecimento Facial, Assinatura na Tela
- Descricao de cada opcao
- Salva no `settings.signature_type` do tenant

### 4. Componentes de Assinatura

| Componente | Arquivo | Descricao |
|---|---|---|
| `SignatureClick` | `src/components/portal/signatures/SignatureClick.tsx` | Checkbox "Li e aceito os termos" + botao confirmar |
| `SignatureFacial` | `src/components/portal/signatures/SignatureFacial.tsx` | Acessa camera, exibe instrucoes (olhe para frente, vire a esquerda, sorria), captura fotos |
| `SignatureDraw` | `src/components/portal/signatures/SignatureDraw.tsx` | Canvas para desenhar assinatura com dedo/caneta, botoes limpar e confirmar |
| `SignatureStep` | `src/components/portal/signatures/SignatureStep.tsx` | Wrapper que escolhe o componente correto baseado no tipo configurado |

### 5. Fluxo no Portal (PortalCheckout)

Antes de exibir as opcoes de pagamento, inserir o passo de assinatura:
1. Exibe o Termo do Acordo (resumo das clausulas)
2. Exibe o componente de assinatura correspondente ao tipo do tenant
3. Ao assinar, salva na tabela `agreement_signatures` via edge function
4. Libera os botoes de pagamento

### 6. Edge Function `portal-checkout/index.ts`

Novas actions:
- `check-signature`: verifica se ja existe assinatura para o acordo
- `save-signature`: recebe tipo, dados (base64), IP, user-agent e salva

### 7. Armazenamento

- Para `click`: salva apenas metadados (IP, timestamp, user-agent)
- Para `facial`: salva fotos como base64 no campo `signature_data` (ou upload para storage bucket `agreement-signatures`)
- Para `draw`: salva imagem PNG da assinatura como base64

## Detalhes Tecnicos

### SignatureDraw
- Usa elemento HTML `<canvas>` com eventos touch/mouse
- Suporta touch (celular) e mouse (desktop)
- Gera PNG via `canvas.toDataURL("image/png")`
- Botao para limpar e refazer

### SignatureFacial
- Usa `navigator.mediaDevices.getUserMedia({ video: true })` para acessar camera
- Sequencia de 3 instrucoes com timer (ex: "Olhe para frente", "Vire levemente para a esquerda", "Sorria")
- Captura frame do video via canvas temporario
- Salva as 3 fotos como array no metadata

### Storage
- Criar bucket `agreement-signatures` (privado)
- Upload das imagens via edge function com service_role
- Armazena path no campo `signature_data`

### Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/TenantSettingsPage.tsx` | Novo card de configuracao de assinatura |
| `src/components/portal/PortalCheckout.tsx` | Adicionar step de assinatura antes do pagamento |
| `supabase/functions/portal-checkout/index.ts` | Actions check-signature e save-signature |

### Arquivos Novos

| Arquivo |
|---|
| `src/components/portal/signatures/SignatureStep.tsx` |
| `src/components/portal/signatures/SignatureClick.tsx` |
| `src/components/portal/signatures/SignatureFacial.tsx` |
| `src/components/portal/signatures/SignatureDraw.tsx` |

### Migracao

- Criar tabela `agreement_signatures`
- Criar bucket `agreement-signatures`
- RLS policies para acesso publico via checkout_token e admin do tenant

