

# Portal de Negociacao e Checkout Multi-Pagamento

## Visao Geral

Transformar o portal do devedor atual (basico) em uma experiencia completa inspirada na Acordo Certo / Serasa, com:

1. **Landing Page (Hero)** da empresa de cobranca
2. **Consulta de dividas** por CPF
3. **Simulador de negociacao** online
4. **Checkout multi-pagamento** (PIX + Cartao + Split)
5. **Termo do acordo** com link de pagamento

## Arquitetura de Paginas

```text
/portal/:tenantSlug              -> Landing Page Hero + Campo CPF
/portal/:tenantSlug/dividas      -> Lista de dividas do CPF (apos consulta)
/portal/:tenantSlug/negociar     -> Simulador de negociacao / proposta
/portal/:tenantSlug/checkout/:id -> Checkout multi-pagamento do acordo
/portal/:tenantSlug/termo/:id    -> Termo do acordo (PDF-like)
```

Todas essas rotas sao publicas (sem autenticacao), acessadas pelo devedor.

## Detalhamento das Telas

### 1. Landing Page Hero (`/portal/:tenantSlug`)

- Header com logo e nome da empresa (buscado via tenant settings)
- Hero section com titulo motivacional ("Negocie suas dividas com ate X% de desconto")
- Campo de CPF centralizado com botao "Consultar"
- Secao de beneficios (cards: desconto, parcelamento, facilidade)
- Footer simples
- Cores dinamicas usando `primary_color` do tenant

### 2. Tela de Dividas (`/portal/:tenantSlug/dividas`)

- Resumo: nome do cliente, total da divida, quantidade de parcelas pendentes
- Lista de dividas agrupadas por credor
- Botao "Negociar esta divida" por credor
- Badge indicando parcelas vencidas vs a vencer

### 3. Simulador de Negociacao (`/portal/:tenantSlug/negociar`)

- Card com valor original da divida
- Opcoes de negociacao:
  - **A vista** com desconto (ex: 30% off)
  - **Parcelado** (2x a 12x, com ou sem desconto progressivo)
  - **Proposta livre** - cliente digita valor e parcelas
- Preview em tempo real do valor final
- Botao "Enviar Proposta"
- Ao enviar, cria um `agreement` com status "pending" e notifica os admins
- Se auto-aprovacao estiver habilitada (configuracao futura), aprova automaticamente

### 4. Checkout Multi-Pagamento (`/portal/:tenantSlug/checkout/:id`)

- Header: "Parabens! Voce realizou um acordo" com confetti/animacao
- Resumo do acordo (valor total, parcelas, desconto obtido)
- **3 opcoes de pagamento:**
  - **PIX** - Gera QR Code/Copia e Cola via Negociarie API (`nova-pix`)
  - **Cartao de Credito** - Redireciona para link de pagamento via Negociarie API (`nova-cartao`)
  - **Multi-Pagamento** - Interface para dividir o valor:
    - Campo 1: "Pagar R$ ___ via PIX"
    - Campo 2: "Pagar R$ ___ via Cartao" (saldo restante calculado automaticamente)
    - Possibilidade de adicionar mais cartoes (botao "+ Adicionar cartao")
    - Validacao: soma dos valores deve ser igual ao total
    - Gera cada cobranca separadamente na Negociarie API
- Cada pagamento confirmado atualiza o status na tabela `negociarie_cobrancas`

### 5. Termo do Acordo (`/portal/:tenantSlug/termo/:id`)

- Documento formatado com dados do acordo
- Nome do credor, nome do devedor, CPF, valores, parcelas
- Clausulas padrao
- Botao para imprimir / salvar PDF (via window.print())
- Link para a pagina de checkout

## Alteracoes no Banco de Dados

### Nova tabela: `portal_payments`

Registra cada pagamento individual dentro de um acordo (para suportar multi-pagamento):

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid NOT NULL | |
| agreement_id | uuid NOT NULL | FK para agreements |
| payment_method | text NOT NULL | 'pix', 'cartao' |
| amount | numeric NOT NULL | Valor deste pagamento |
| status | text NOT NULL DEFAULT 'pending' | pending, processing, paid, failed |
| negociarie_id_geral | text | ID da cobranca na Negociarie |
| payment_data | jsonb DEFAULT '{}' | Links PIX, boleto, cartao etc |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

RLS: Leitura publica por agreement_id (sem autenticacao - acesso via token do checkout). Insercao/update via service_role (edge function).

### Alteracao na tabela `agreements`

Adicionar colunas:
- `checkout_token` (text, unique) - Token unico para acesso publico ao checkout
- `portal_origin` (boolean DEFAULT false) - Indica se veio do portal

### Alteracao na tabela `tenants`

Usar o campo `settings` (jsonb) existente para armazenar configuracoes do portal:
- `settings.portal_hero_title` - Titulo do hero
- `settings.portal_hero_subtitle` - Subtitulo
- `settings.portal_max_discount` - Desconto maximo permitido (%)
- `settings.portal_max_installments` - Maximo de parcelas
- `settings.portal_auto_approve` - Auto-aprovar acordos do portal

## Edge Functions

### Nova: `portal-checkout` (sem JWT)

Responsavel por:
- Validar o `checkout_token` do acordo
- Gerar cobrancas na Negociarie (PIX, Cartao) via API
- Registrar pagamentos na tabela `portal_payments`
- Retornar links de pagamento

Endpoints (via action):
- `get-agreement` - Busca acordo pelo token
- `create-payment` - Gera cobranca na Negociarie e registra
- `payment-status` - Consulta status do pagamento

### Atualizar: `portal-lookup`

- Adicionar action `simulate` para calcular opcoes de negociacao
- Adicionar action `create-portal-agreement` com geracao de `checkout_token`
- Retornar dados do tenant (logo, cores, nome) para a landing page

## Componentes React (novos)

```text
src/pages/PortalPage.tsx          -> Refatorar como roteador interno (sub-rotas)
src/components/portal/
  PortalHero.tsx                  -> Landing page hero
  PortalDebtList.tsx              -> Lista de dividas
  PortalNegotiation.tsx           -> Simulador de negociacao
  PortalCheckout.tsx              -> Checkout multi-pagamento
  PortalAgreementTerm.tsx         -> Termo do acordo
  PortalLayout.tsx                -> Layout compartilhado (header, footer, cores)
  PaymentMethodSelector.tsx       -> Seletor PIX / Cartao / Multi
  MultiPaymentForm.tsx            -> Formulario de split de pagamento
  PaymentStatusCard.tsx           -> Card com status de cada pagamento
```

## Rotas no App.tsx

Adicionar as novas rotas publicas (sem ProtectedRoute):

```text
/portal/:tenantSlug              -> PortalPage (hero + consulta)
/portal/:tenantSlug/dividas      -> PortalPage (dividas)
/portal/:tenantSlug/negociar     -> PortalPage (negociacao)
/portal/:tenantSlug/checkout/:token -> PortalPage (checkout)
/portal/:tenantSlug/termo/:token    -> PortalPage (termo)
```

## Fluxo do Usuario (Devedor)

```text
1. Acessa /portal/empresa-xyz
2. Ve a landing page com hero e campo CPF
3. Digita CPF -> busca dividas
4. Ve lista de dividas pendentes
5. Clica "Negociar" -> simulador
6. Escolhe opcao (a vista, parcelado, proposta)
7. Envia proposta -> cria agreement com status "pending"
8. Se aprovado (manual ou auto):
   a. Recebe link do checkout via notificacao/WhatsApp
   b. Acessa checkout -> ve "Parabens!"
   c. Escolhe forma de pagamento (PIX, Cartao ou Multi)
   d. Realiza pagamento(s)
9. Pode acessar o termo do acordo a qualquer momento
```

## Sequencia de Implementacao

1. Migracoes de banco (tabela `portal_payments`, colunas em `agreements`)
2. Edge function `portal-checkout`
3. Atualizar edge function `portal-lookup`
4. Componentes do portal (Hero, DebtList, Negotiation, Checkout, Term)
5. Refatorar PortalPage.tsx como roteador
6. Novas rotas no App.tsx

## Consideracoes de Seguranca

- Checkout acessado via `checkout_token` (UUID aleatorio), nao por ID do acordo
- Rate limiting no portal-lookup (ja existente)
- Nenhum dado sensivel exposto alem do necessario
- Pagamentos processados via edge function com service_role (nunca no cliente)
- Validacao de valores no servidor (soma dos split payments deve igualar o total)

