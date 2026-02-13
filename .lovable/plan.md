

# Arquitetura do Fluxo de Cobrança - Visao Completa

## Fluxo Geral

O sistema opera como uma plataforma de cobranca onde a carteira de clientes entra via CSV/API, passa por um processo de acionamento (discador ou WhatsApp em lote), e cada contato gera tabulacoes que alimentam automacoes e acordos.

```text
                    +------------------+
                    |  Entrada de      |
                    |  Carteira        |
                    |  (CSV / API)     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Carteira        |
                    |  /carteira       |
                    |  (filtros,       |
                    |   segmentacao)   |
                    +--------+---------+
                             |
                 +-----------+-----------+
                 |                       |
        +--------v--------+    +--------v--------+
        |  Discador       |    |  Disparo WA     |
        |  (3CPlus)       |    |  em Lote        |
        |  Integracao API |    |  (Gupshup/Meta) |
        +--------+--------+    +-----------------+
                 |
        +--------v--------+
        |  Tela do        |
        |  Operador       |
        |  /atendimento   |
        |  (perfil +      |
        |   tabulacao +   |
        |   whatsapp +    |
        |   negociacao)   |
        +--------+--------+
                 |
        +--------v--------+
        |  Tabulacao       |
        |  (resultado da   |
        |   ligacao)       |
        +--------+---------+
                 |
        +--------v---------+
        |  Automacoes      |
        |  (boleto, pix,   |
        |   link pgto)     |
        +------------------+
                 |
        +--------v---------+
        |  Acordos         |
        |  /acordos        |
        |  (acompanhamento)|
        +------------------+
```

---

## O que ja existe no sistema

| Funcionalidade | Status |
|---|---|
| Importacao de carteira via CSV/Excel | Pronto |
| Listagem e filtros da carteira | Pronto |
| Perfil do cliente (/carteira/:cpf) com dados, titulos e historico | Pronto |
| Gestao de acordos (/acordos) com aprovacao e geracao de parcelas | Pronto |
| Automacao de mensagens (regras de cobranca) | Pronto |
| Integracao Negociarie (boletos, pix, cartao) | Pronto |
| Integracao Gupshup (WhatsApp) | Parcial (configuracao pronta, disparo individual) |
| Notificacoes em tempo real (acordos e pagamentos) | Pronto |

## O que precisa ser construido (em fases)

---

### FASE 1 - Tela de Atendimento do Operador (nova pagina /atendimento/:id)

Esta e a pagina central do fluxo. O operador acessa via link do discador ou pela carteira.

**Conteudo da tela:**

1. **Header com dados do cliente**
   - Nome, CPF, telefone, email, credor
   - ID externo / numero de contrato (campo novo na tabela `clients`)
   - Valor total em aberto

2. **Painel de Tabulacao** (botoes de acao rapida)
   - Caixa Postal
   - Ligacao Interrompida
   - Contato Incorreto
   - Retornar Ligacao (com campo de data/hora)
   - **Negociar** (abre painel de negociacao)

3. **Painel de Negociacao** (ao clicar "Negociar")
   - Templates prontos de negociacao (ex: "30% desconto a vista", "parcelamento em 6x")
   - Simulador manual (informar desconto %, qtd parcelas, valor entrada)
   - Botao para gerar o acordo (envia para /acordos)

4. **Chat WhatsApp** (lateral ou aba)
   - Enviar mensagem direta ao cliente via Gupshup/Meta
   - Historico de mensagens enviadas

5. **Historico do cliente** (timeline)
   - Tabulacoes anteriores, acordos, pagamentos, mensagens

**Mudancas no banco de dados:**
- Adicionar campo `external_id` (text, nullable) na tabela `clients` para identificacao externa
- Criar tabela `call_dispositions` (tabulacoes): id, client_id, tenant_id, operator_id, disposition_type, notes, scheduled_callback, created_at
- Cada disposition_type pode ter automacoes vinculadas (fase posterior)

---

### FASE 2 - Integracao com Discador 3CPlus

**Como funciona:**
- A 3CPlus recebe uma lista de telefones/clientes via API
- Quando o discador conecta uma ligacao, abre a URL do sistema com o ID do cliente
- O operador ve a tela de atendimento e tabula

**O que construir:**
- Edge function `3cplus-export` para enviar lote de clientes filtrados ao discador
- Configuracao de credenciais 3CPlus nas configuracoes do tenant
- Botao "Enviar para Discador" na pagina de carteira (acao em lote)
- URL publica `/atendimento/:id` que o discador abre (com autenticacao do operador)

---

### FASE 3 - Disparo de WhatsApp em Lote

**Como funciona:**
- Admin seleciona clientes na carteira (checkbox)
- Escolhe um template de mensagem
- Sistema dispara para todos via Gupshup/Meta API
- Cada envio e registrado em `message_logs`

**O que construir:**
- Selecao multipla na tabela da carteira
- Dialog de disparo em lote com selecao de template
- Logica de envio em batch via edge function existente (`send-notifications`)
- Progresso/resultado do envio

---

### FASE 4 - Automacoes pos-tabulacao

**Como funciona:**
- Cada tipo de tabulacao pode disparar uma acao automatica
- Ex: "Negociar" -> gera link de pagamento e envia por WhatsApp
- Ex: "Retornar ligacao" -> agenda lembrete para o operador
- Configuravel pelo admin na pagina de automacao

**O que construir:**
- Vincular `disposition_type` a acoes automaticas na tabela `collection_rules`
- Triggers ou edge functions que executam as acoes ao salvar uma tabulacao

---

## Sugestao de Ordem de Implementacao

Recomendo comecar pela **Fase 1** (Tela de Atendimento), pois e o nucleo do fluxo e pode ser usado imediatamente sem o discador (operadores acessam via carteira). As integracoes externas (3CPlus, WhatsApp em lote) podem ser adicionadas incrementalmente.

**Proximo passo sugerido:** Implementar a Fase 1 - criar a tabela `call_dispositions`, adicionar campo `external_id` nos clientes, e construir a pagina `/atendimento/:id`.

Deseja que eu detalhe o plano de implementacao da Fase 1?

