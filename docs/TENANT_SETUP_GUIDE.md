# Guia de Setup do Tenant — RIVO CONNECT

> Este guia é o passo-a-passo que **toda nova empresa (tenant)** deve seguir após o cadastro inicial no RIVO CONNECT, para ficar 100% operacional.
> Espelha exatamente as etapas do wizard interno disponível em **Menu → Setup do tenant** (`/setup`) — o sistema detecta automaticamente cada conclusão.

**Público-alvo:** equipe de implantação e admin do tenant.
**Tempo estimado:** 1 a 3 horas (sem importação de carteira); até 1 dia útil com importação grande.
**Pré-requisitos:** tenant já criado pelo Super Admin com CNPJ, slug e plano selecionado.

---

## Visão geral

O setup tem 7 etapas. As 6 primeiras são **críticas** (a empresa não opera sem elas). A 7ª (Automação) é **opcional** — pode ser configurada depois.

| # | Etapa | Crítica | Detecção automática |
|---|---|---|---|
| 1 | Dados da empresa | ✅ | `tenants.name` + `cnpj` preenchidos |
| 2 | Credores e cadastros base | ✅ | ≥ 1 credor + tipos/status cadastrados |
| 3 | Equipe e permissões | ✅ | ≥ 1 operador ativo |
| 4 | Canais de comunicação | ✅ | ≥ 1 instância de WhatsApp |
| 5 | Gateways de pagamento | ✅ | ≥ 1 integração de pagamento |
| 6 | Importação da carteira | ✅ | ≥ 1 parcela na carteira |
| 7 | Automação e workflows | ⚪ | ≥ 1 workflow configurado |

Ao concluir todas as críticas, o admin pode clicar em **Concluir Setup** no fim da página `/setup`. O item de menu "Setup do tenant" some, o banner do Dashboard some, e a empresa entra em modo de operação normal.

---

## Etapa 1 — Dados da empresa

**O que é:** confirmar e completar o cadastro institucional da empresa (nome, CNPJ, logo, identidade visual).

**Onde fica:** `Menu → Configurações → Central Empresa` (`/central-empresa`).

**Como fazer:**
1. Confira nome e CNPJ.
2. Faça upload do logo (recomendado).
3. Defina cor primária se quiser personalização visual.
4. Salve.

**Como validar:** o card "Dados da empresa" no `/setup` ficará verde quando `name` e `cnpj` estiverem preenchidos.

**Erros comuns:**
- CNPJ inválido → o sistema valida formato. Use somente números ou a máscara `00.000.000/0000-00`.
- Logo não aparece → verifique extensão (`.png`, `.jpg`, `.svg`) e tamanho < 2 MB.

---

## Etapa 2 — Credores e cadastros base

**O que é:** cadastrar os credores (donos da dívida) e todos os tipos auxiliares que classificam cada parcela na carteira.

**Onde fica:** `Menu → Cadastros` (`/cadastros`).

**Como fazer:**
1. **Credores:** aba "Credores" → "Novo credor". Preencha nome, CNPJ, regras de comissão e taxa.
2. **Tipos de devedor:** aba "Tipos de devedor" (PF/PJ, especiais).
3. **Tipos de dívida:** aba "Tipos de dívida" (cartão, financiamento, mensalidade, etc.).
4. **Status de cobrança:** aba "Status" — define o funil (em prospecção, em negociação, perdido…).
5. **Scripts de abordagem:** aba "Scripts" — texto-base que aparece no atendimento.
6. **Dispositions (motivos de contato):** aba "Dispositions" — resultados de ligação (sem atender, promessa, recusou, etc.).

**Como validar:** o card "Credores e cadastros base" fica:
- **Em andamento** quando há credores mas faltam scripts/dispositions.
- **Concluído** quando há ≥ 1 de cada categoria.

**Erros comuns:**
- Credor sem CNPJ → algumas integrações (Asaas) recusam emitir boleto.
- Scripts vazios → operadores perdem produtividade; mesmo um script genérico já ajuda.

---

## Etapa 3 — Equipe e permissões

**O que é:** criar os operadores, supervisores e admins que vão usar o sistema.

**Onde fica:** `Menu → Usuários` (`/usuarios`).

**Como fazer:**
1. Clique em "Novo usuário".
2. Informe nome, e-mail e role (admin/operador/supervisor).
3. Envie o convite por e-mail.
4. (Opcional) `Admin → Equipes` para agrupar operadores sob supervisores.
5. (Opcional) Configure metas individuais e comissão.

**Como validar:** card fica verde quando há ≥ 1 usuário com role `operador` no tenant.

**Erros comuns:**
- Convite não chega → verifique caixa de spam; o admin pode reenviar.
- Operador sem permissões → confira a role atribuída.

---

## Etapa 4 — Canais de comunicação

**O que é:** conectar pelo menos um canal para falar com devedores.

**Onde fica:** `Menu → Contact Center → WhatsApp` (`/contact-center/whatsapp`) e `Telefonia` (`/contact-center/telefonia`).

**Como fazer:**
1. **WhatsApp:** clique em "Nova instância", escolha o provedor (Gupshup oficial / Evolution / Wuzapi) e leia o QR Code com o WhatsApp do número desejado.
2. **Telefonia 3CPlus:** vá em `Configurações → Integrações` e informe credenciais do tenant 3CPlus.
3. **E-mail (opcional):** configure domínio Resend para campanhas.

**Como validar:** card fica verde quando ≥ 1 instância WhatsApp está conectada.

**Erros comuns:**
- QR Code expira → gere novamente.
- WhatsApp banido → use número novo e siga as regras de aquecimento (Anti-Ban).
- Telefonia não disca → verifique credenciais 3CPlus e se o módulo `telefonia` está ativo no plano.

---

## Etapa 5 — Gateways de pagamento

**O que é:** conectar Asaas, Negociarie ou outro gateway para gerar boletos/PIX/cartão.

**Onde fica:** `Menu → Configurações → Integrações` (`/configuracoes/integracao`).

**Como fazer:**
1. Selecione o gateway (Asaas ou Negociarie).
2. Cole as credenciais (`Client ID` + `Client Secret` no caso da Negociarie; `API Key` no caso do Asaas).
3. Clique em "Testar conexão".
4. Aguarde o sinal verde.

**Como validar:** card fica verde quando há ≥ 1 registro em `integration_tokens` para o tenant.

**Erros comuns:**
- Chaves trocadas (preview vs produção) → confirme o ambiente.
- Webhook não cadastrado → no painel do gateway, cole a URL exibida no GoLiveChecklist.

---

## Etapa 6 — Importação da carteira

**O que é:** subir a primeira leva de cobranças.

**Onde fica:** `Menu → Carteira` (`/carteira`) → botão **Importar**.

**Como fazer:**
1. Clique em "Importar" e escolha planilha (.xlsx/.csv) ou MaxList.
2. Mapeie as colunas (CPF, valor, vencimento, credor…).
3. Confirme a importação.
4. Após terminar, o sistema roda **auto-status-sync** automaticamente para classificar inadimplentes/em dia.
5. (Recomendado) Selecione clientes e clique em **Higienizar** para enriquecer endereços e telefones.

**Como validar:** card fica:
- **Em andamento** se há parcelas mas ainda nenhuma foi classificada (todas em `pendente`).
- **Concluído** quando há parcelas classificadas.

**Erros comuns:**
- CPFs duplicados → o importador deduplica por CPF+credor+vencimento.
- Telefones em formato incorreto → o sistema normaliza para E.164 automaticamente, mas verifique a amostra.
- Importação trava em planilhas > 100 mil linhas → quebre em lotes ou use MaxList.

Documentação aprofundada: [maxsystem-integracao.md](./maxsystem-integracao.md).

---

## Etapa 7 — Automação e workflows (opcional)

**O que é:** criar disparos automáticos (régua de cobrança D-5/D0/D+30, mensagens por status, etc.).

**Onde fica:** `Menu → Automação` (`/automacao`).

**Como fazer:**
1. Clique em "Novo workflow".
2. Escolha um gatilho (vencimento próximo, mudança de status, lead novo…).
3. Adicione ações (enviar WhatsApp, enviar e-mail, criar tarefa).
4. Ative.

**Como validar:** card fica verde quando há ≥ 1 workflow no tenant.

**Erros comuns:**
- Workflow não dispara → verifique se o canal alvo (WhatsApp) está conectado.
- Mensagens em loop → use a feature de cooldown nos nós de ação.

---

## Conclusão

Quando todas as etapas críticas (1–6) estiverem verdes:

1. Vá em `/setup` (último card "Pronto para operar?").
2. Clique em **Concluir Setup**.
3. O sistema grava `tenants.setup_completed_at` e remove o banner do Dashboard.
4. A empresa está em **modo operacional**.

Você pode reabrir o setup a qualquer momento pelo botão **Reabrir setup**.

---

## FAQ

**Posso pular alguma etapa crítica?**
Não. Sem elas o sistema não consegue operar (sem credor, sem canal ou sem gateway, nada funciona ponta-a-ponta).

**O CNPJ é mesmo obrigatório?**
Sim — é exigido pela Receita para emissão de cobranças e nota fiscal pelo Asaas.

**Posso ter mais de um WhatsApp?**
Sim, quantos o plano permitir. Atribua cada instância a operadores específicos em `Configurações → Atribuições`.

**Como cuido de múltiplos credores?**
Cada credor pode ter seu próprio gateway, regras de comissão e regras de cobrança. Configure tudo em `Cadastros → Credores → [credor] → Configurações`.

**Onde vejo o status do go-live global da plataforma?**
No painel do Super Admin → `GoLiveChecklist` (validações de Asaas em produção, planos cadastrados, webhook, etc.).

---

## Checklist imprimível

- [ ] **Empresa** — nome, CNPJ, logo
- [ ] **Cadastros** — credores, tipos de devedor, tipos de dívida, status, scripts, dispositions
- [ ] **Equipe** — operadores criados e convites aceitos
- [ ] **Canais** — WhatsApp conectado (+ telefonia se contratado)
- [ ] **Gateways** — Asaas e/ou Negociarie testados
- [ ] **Carteira** — primeira importação + auto-status-sync + higienização
- [ ] **Automação** — régua básica de cobrança (opcional)
- [ ] **Go-Live** — botão "Concluir Setup" pressionado

---

**Referências relacionadas:**
- [`SAAS_ONBOARDING.md`](./SAAS_ONBOARDING.md) — criação do tenant pelo Super Admin (fase anterior a este guia).
- [`maxsystem-integracao.md`](./maxsystem-integracao.md) — importação de carteira via MaxList.
- [`API_REFERENCE.md`](./API_REFERENCE.md) — API REST para integração com sistemas externos.
