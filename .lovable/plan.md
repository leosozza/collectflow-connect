## 1. Sheet "Editar Credor" — caber todas as abas

Arquivo: `src/components/cadastros/CredorForm.tsx`

- Linha 378: `SheetContent` de `sm:max-w-2xl` → `sm:max-w-3xl` (aumento moderado).
- Linha 384: `TabsList` remover `flex-wrap` (mantém `w-full flex`) para as 7 abas (Dados, Bancário, Negociação, Régua, Personalização, Assinatura, Portal) ficarem em linha única, sem o "Portal" quebrar para baixo.

## 2. Aba Bancário — padronizar visual dos cards

Hoje há 3 estilos diferentes empilhados:
- Card externo "Configuração Bancária" → `bg-muted/20`
- Card interno "Configuração Negociarie" → `bg-primary/5 border-primary/20` (tom laranja que destoa)
- Card "Webhook de baixa automática" → `bg-card`

Padrão RIVO unificado: todos os cards com `border-border bg-card p-4`, cabeçalho com ícone laranja (`text-primary`) + título `text-sm font-semibold`, sem fundo tingido. O laranja fica apenas nos ícones, badges e botões — não no fundo do card.

### Mudanças em `src/components/admin/integrations/CreditorIntegrationsVault.tsx`

- Card "Configuração Negociarie" (linha ~131): trocar `border-primary/20 bg-primary/5` por `border-border bg-card`. Remover wrapper `bg-primary/10 rounded-lg` do ícone (deixar `Zap` solto com `text-primary`), igualando ao header do card de Webhook.
- Inputs internos: remover `border-primary/10`, usar `border-input` padrão.

### Mudanças em `src/components/cadastros/CredorForm.tsx` (linha 524)

- Card externo "Configuração Bancária": trocar `bg-muted/20` por `bg-card` para casar com os filhos.

Resultado: três cards visualmente coesos, mesma borda/fundo, apenas com acentos laranjas nos ícones e no botão "Registrar Callback".

## Arquivos tocados

1. `src/components/cadastros/CredorForm.tsx` — largura do sheet, tabs sem wrap, fundo do card Bancário.
2. `src/components/admin/integrations/CreditorIntegrationsVault.tsx` — padronização visual dos cards internos.

Sem mudanças de lógica.
