

## Plano: Adicionar opção "Não selecionar status" na importação MaxList

### Problema
Atualmente o MaxList força a seleção de um status de cobrança para todos os registros importados. O cliente precisa da opção de não definir status manualmente, deixando o sistema derivar automaticamente:

- **Parcelas em dia** → Em Dia
- **Parcela vencida** → Aguardando Acionamento  
- **Todas pagas** → Quitado

### Alterações

**1. MaxListPage.tsx** — Adicionar opção "Não selecionar" no Select de status

- Adicionar `<SelectItem value="__auto__">Não selecionar (automático)</SelectItem>` como primeira opção
- Mudar o default de `selectedStatusCobrancaId` para `"__auto__"` em vez de buscar "Aguardando"
- Na hora do upsert (linha 673), se `selectedStatusCobrancaId === "__auto__"`, enviar `status_cobranca_id: null`
- Após o upsert, chamar a Edge Function `auto-status-sync` para derivar os status automaticamente

**2. ClientsPage.tsx e CarteiraPage.tsx** — Pós-importação automática

- Após `bulkCreateClients` finalizar com sucesso, chamar `auto-status-sync` para garantir que registros sem `status_cobranca_id` recebam o status correto
- Remover a lógica de enriquecimento de `status_raw` → `status_cobranca_id` (esse matching manual não é confiável)

**3. importService.ts** — Limpeza

- Remover `status_raw` e `status_cobranca_id` do tipo `ImportedRow` (não serão mais definidos na importação)

Essa lógica já existe implementada na Edge Function `auto-status-sync` e será reutilizada, aplicando-se a todas as tenants.

