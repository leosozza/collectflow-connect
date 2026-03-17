

# Criar aba "Personalização" no CredorForm

## Resumo
Reorganizar o `CredorForm.tsx` criando uma nova aba **Personalização** que agrupa funcionalidades de customização por credor, simplificando as abas existentes.

## O que move para "Personalização"

| Conteúdo | Localização atual | Ação |
|---|---|---|
| Modo da Carteira (RadioGroup open/assigned) | Aba "Dados" (linhas 327-349) | Mover |
| Modelos de Documentos (Collapsible + Dialog de edição) | Aba "Dados" (linhas 372-451) | Mover |
| Campos Visíveis no Atendimento (`AtendimentoFieldsConfig`) | Aba "Negociação" (linhas 683-695) | Mover |
| Scripts de Abordagem (`CredorScriptsTab`) | Aba própria "Scripts" (linhas 703-706) | Mover |

## Mudanças no `CredorForm.tsx`

1. **Substituir a aba "Scripts"** por **"Personalização"** na `TabsList`:
   - `<TabsTrigger value="personalizacao">Personalização</TabsTrigger>` no lugar de `scripts`

2. **Nova `TabsContent value="personalizacao"`** contendo, em ordem:
   - Modo da Carteira (RadioGroup)
   - Modelos de Documentos (Collapsible existente)
   - Campos Visíveis no Atendimento (Collapsible + `AtendimentoFieldsConfig`)
   - Scripts de Abordagem (`CredorScriptsTab`)

3. **Remover** dessas seções dos locais originais:
   - Modo da Carteira sai da aba "Dados"
   - Modelos de Documentos sai da aba "Dados"
   - Campos Visíveis sai da aba "Negociação"
   - `TabsTrigger value="scripts"` e `TabsContent value="scripts"` removidos

4. **Nenhuma lógica ou estado muda** — apenas realocação de JSX. Imports, handlers, e state permanecem os mesmos.

## Estrutura final das abas
```text
Dados | Bancário | Negociação | Régua | Personalização | Assinatura | Portal
```

## Arquivo modificado
- `src/components/cadastros/CredorForm.tsx` — único arquivo alterado

