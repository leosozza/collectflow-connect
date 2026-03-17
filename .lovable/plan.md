

# Unificar visual da aba Personalização + adicionar Campos Personalizados

## Problemas identificados
1. **Modelos de Documentos** usa `Collapsible` com seta rotacional e Cards internos
2. **Campos Visíveis no Atendimento** usa `Collapsible` com estilo diferente (sem seta, com descrição inline)
3. **Scripts** aparece direto sem wrapper
4. **Campos Personalizados** (`CustomFieldsConfig`) não foi incluído na aba — continua apenas em CadastrosPage

## Mudanças em `src/components/cadastros/CredorForm.tsx`

### 1. Padronizar todas as seções com layout uniforme
Cada seção dentro de Personalização terá o mesmo padrão visual:

```text
[border-t] ─────────────────────────
▸ Título da Seção              [chevron]
  Descrição curta em text-xs
  ─── conteúdo colapsável ───
```

Usar o mesmo `Collapsible` com:
- `CollapsibleTrigger` com `flex items-center justify-between w-full`
- Título em `text-sm font-medium` + descrição em `text-xs text-muted-foreground`
- `ChevronDown` com rotação `-rotate-90 → rotate-0`

Aplicar esse padrão para: Modo da Carteira, Modelos de Documentos, Campos Visíveis, Campos Personalizados, Scripts.

### 2. Adicionar seção "Campos Personalizados"
- Importar `CustomFieldsConfig` no CredorForm
- Inserir como nova seção colapsável entre "Campos Visíveis no Atendimento" e "Scripts"
- O componente já é autossuficiente (CRUD completo), basta renderizá-lo

### 3. Modo da Carteira dentro de Collapsible também
Envolver o RadioGroup existente em um Collapsible para manter consistência visual (será a primeira seção, aberta por padrão).

### Ordem final das seções na aba Personalização:
1. Modo da Carteira
2. Modelos de Documentos
3. Campos Visíveis no Atendimento
4. Campos Personalizados
5. Scripts de Abordagem

## Arquivo modificado
- `src/components/cadastros/CredorForm.tsx`

