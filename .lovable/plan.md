
# Reorganizacao do Modulo Cadastros e Empresa

## Resumo

Consolidar toda a administracao dentro de `/cadastros`, movendo Signs (para dentro do Credor), Usuarios, e Integracao para la. Transformar `/tenant/configuracoes` (Empresa) em uma pagina com 5 abas: Dados, Financeiro, Contrato, Servicos e Cancelamento.

---

## 1. Novo menu lateral do Cadastros

A pagina `/cadastros` passara a ter as seguintes secoes na sub-navegacao lateral:

```text
+---------------------+
| Cadastros           |
+---------------------+
| Credores            |
| Usuarios            |  (novo - conteudo atual de /usuarios)
| Equipes             |
| Tipo de Devedor     |
| Tipo de Divida      |
| Integracao          |  (novo - conteudo atual de /integracao)
+---------------------+
```

## 2. Signs dentro do Credor

No `CredorForm.tsx`, adicionar uma 4a aba "Assinatura" ao lado de "Negociacao". Nessa aba:

- Toggle "Assinatura Digital Ativa" (sim/nao) para esse credor
- Se ativo, opcao para escolher tipo: Click, Reconhecimento Facial ou Assinatura na Tela
- Armazenado no registro do credor (novas colunas `signature_enabled` boolean e `signature_type` text na tabela `credores`)

Isso substitui a pagina `/signs` global. O tipo de assinatura passa a ser definido **por credor**.

## 3. Usuarios dentro de Cadastros

O conteudo atual de `UsersPage.tsx` sera importado como componente dentro de `CadastrosPage.tsx` na secao "usuarios". A rota `/usuarios` sera mantida como redirect ou removida do sidebar.

## 4. Integracao dentro de Cadastros

O conteudo de `IntegracaoPage.tsx` sera importado como componente na secao "integracao" do Cadastros.

## 5. Empresa - Pagina com 5 abas

A pagina `/tenant/configuracoes` sera redesenhada com abas horizontais:

### Aba 1 - Dados da Empresa
- Conteudo atual: nome, slug, cor primaria (sem mudancas)

### Aba 2 - Financeiro
- Exibicao do plano contratado (nome, valor, limites)
- Status do pagamento

### Aba 3 - Contrato
- Texto do contrato padrao de contratacao do sistema (pre-definido, nao editavel)
- Checkbox/indicador visual: verde (assinado) ou vermelho (pendente)
- O contrato inclui clausulas de uso do sistema, privacidade, SLA, etc.

### Aba 4 - Servicos
- Lista de funcionalidades do sistema com toggle on/off e valor ao lado:
  - Discador (R$ X/mes)
  - WhatsApp (R$ X/mes)
  - Assinatura Digital (R$ X/mes)
  - Negativacao (R$ X/mes)
- Armazenado em `tenants.settings` como JSON

### Aba 5 - Cancelamento
- Texto informativo: "O cancelamento pode ser solicitado a qualquer momento, com aviso previo de 30 dias."
- Botao "Solicitar Cancelamento" com confirmacao via AlertDialog
- Ao confirmar, grava data da solicitacao e altera status

## 6. Limpeza do Sidebar

Remover do menu lateral (grupo "Avancado"):
- "Signs" (agora dentro do Credor)
- "Usuarios" (agora dentro de Cadastros)
- "Integracao" (agora dentro de Cadastros, e tambem remover de `postContactItems`)

O menu lateral ficara mais enxuto:

```text
Dashboard
Carteira
Cadastros
Contact Center >
  Telefonia
  WhatsApp
Acordos (operador)
Avancado >
  Configuracoes
  Automacao
  Log de Importacoes
  Empresa
  Auditoria
```

---

## Detalhes Tecnicos

### Migracao SQL
Adicionar colunas a tabela `credores`:
```sql
ALTER TABLE credores ADD COLUMN signature_enabled boolean DEFAULT false;
ALTER TABLE credores ADD COLUMN signature_type text DEFAULT 'click';
```

### Arquivos modificados

**`src/pages/CadastrosPage.tsx`**
- Adicionar secoes "usuarios" e "integracao" a lista de secoes
- Importar `UsersPage` como componente inline (ou extrair o conteudo para um componente reutilizavel)
- Importar `IntegracaoPage` como componente inline
- Reordenar: Credores, Usuarios, Equipes, Tipo de Devedor, Tipo de Divida, Integracao

**`src/components/cadastros/CredorForm.tsx`**
- Adicionar 4a aba "Assinatura" no TabsList
- Toggle para ativar/desativar assinatura digital nesse credor
- RadioGroup para escolher tipo (click, facial, draw)
- Incluir `signature_enabled` e `signature_type` no objeto salvo

**`src/pages/TenantSettingsPage.tsx`**
- Redesenhar com 5 abas usando componente Tabs
- Aba Dados: conteudo atual
- Aba Financeiro: exibicao do plano e limites (movido do card atual)
- Aba Contrato: texto padrao + indicador assinado/pendente
- Aba Servicos: lista de servicos com switch + valores
- Aba Cancelamento: botao de solicitacao com AlertDialog

**`src/components/AppLayout.tsx`**
- Remover "Signs", "Usuarios" e "Integracao" do sidebar
- Manter "Empresa" no grupo Avancado

**`src/App.tsx`**
- Remover rota `/signs` (ou manter como redirect para `/cadastros`)
- Manter rota `/usuarios` como redirect ou remover
- Remover rota `/integracao` standalone (ou redirect)

### Arquivos nao alterados
- `UsersPage.tsx` e `IntegracaoPage.tsx` continuam existindo como componentes, mas sao renderizados dentro de `CadastrosPage` em vez de diretamente no router
- Todos os services existentes permanecem inalterados
