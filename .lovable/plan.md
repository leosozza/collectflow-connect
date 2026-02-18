

## Ajustes no Perfil do Operador - Fase 2

### 1. Dashboard - Remover botao "Relatorios"

**Arquivo: `src/pages/DashboardPage.tsx`**

Remover o botao "Relatorios" (linhas 124-132) do header do dashboard do operador. Manter apenas o botao "Analytics".

---

### 2. Analytics - Ajustes para Operador

**Arquivo: `src/pages/AnalyticsPage.tsx`**

- Renomear o KPI "Total Inadimplencia" para **"Total Projetado"** quando `isOperator === true`, calculando como soma de todas as parcelas (nao apenas pendentes)
- Reordenar os 4 KPIs do operador para: **Total Projetado**, **Total de Quebra**, **Total Recebido**, **% de Recebimento**
- Ocultar o bloco **"Top 5 Maiores Credores"** quando `isOperator === true`
- Adicionar KPI de "% de Recebimento" (parcelas pagas / total de parcelas filtradas * 100)

---

### 3. Telefonia - Operador ve apenas seu proprio card

**Arquivo: `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`**

Quando o usuario for operador (`profile.role !== "admin"`):
- Filtrar a lista de agentes para mostrar **apenas o agente correspondente** ao `threecplus_agent_id` do operador logado
- Ocultar KPIs globais (Online, Em Ligacao, Em Pausa, etc.) e campanhas - mostrar apenas o card do operador
- Criar um **card ampliado** com informacoes detalhadas: status, tempo no status, metricas de contatos/acordos do dia, nome da campanha atual

**Arquivo: `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx`**

Quando o usuario for operador:
- Ocultar o menu dropdown com todas as abas administrativas
- Mostrar apenas o dashboard do operador + teclado telefonico

---

### 4. Teclado Telefonico para Ligacoes Manuais

**Novo arquivo: `src/components/contact-center/threecplus/DialPad.tsx`**

Criar componente de teclado telefonico com:
- Grid 3x4 com teclas 1-9, *, 0, #
- Campo de exibicao do numero digitado
- Botao verde de "Ligar" e botao vermelho de "Desligar"
- Botao para entrar/sair do modo manual (`POST /agent/manual_call/enter` e `/exit`)

O fluxo de ligacao manual na API 3CPlus e:
1. `POST /agent/manual_call/enter` - Entrar no modo manual
2. `POST /agent/manual_call/dial` com `{ phone_number }` - Discar
3. `POST /agent/manual_call/exit` - Sair do modo manual

Para o click2call (ligacao rapida quando ocioso):
- `POST /click2call` com `{ agent_id, phone_number }`

**Arquivo: `supabase/functions/threecplus-proxy/index.ts`**

Adicionar 4 novas actions ao proxy:
- `manual_call_enter`: `POST /agent/manual_call/enter`
- `manual_call_dial`: `POST /agent/manual_call/dial` com `phone_number`
- `manual_call_exit`: `POST /agent/manual_call/exit`
- `click2call`: `POST /click2call` com `agent_id` e `phone_number`

---

### 5. Layout da Tela do Operador na Telefonia

A tela do operador na telefonia tera dois paineis lado a lado:

```text
+-------------------------------+-------------------+
|   Card do Operador (grande)   |  Teclado          |
|                               |  Telefonico       |
|  - Status com cor/animacao    |                   |
|  - Tempo no status atual      |  [1] [2] [3]     |
|  - Campanha ativa             |  [4] [5] [6]     |
|  - Contatos hoje              |  [7] [8] [9]     |
|  - Acordos hoje               |  [*] [0] [#]     |
|  - Ramal                      |                   |
|                               |  [  Ligar  ]     |
|                               |  [Desligar ]     |
+-------------------------------+-------------------+
```

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/pages/DashboardPage.tsx` - remover botao Relatorios
- `src/pages/AnalyticsPage.tsx` - KPIs renomeados/reordenados, ocultar Top 5 Credores
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` - filtrar por agente do operador, card ampliado
- `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx` - ocultar menu admin para operador
- `supabase/functions/threecplus-proxy/index.ts` - adicionar actions manual_call_enter/dial/exit e click2call

**Novo arquivo:**
- `src/components/contact-center/threecplus/DialPad.tsx` - teclado telefonico

**Nenhuma migracao SQL necessaria.**
**Nenhuma nova dependencia necessaria.**
