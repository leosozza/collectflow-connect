

# Plano: Indicador compacto de sync + modal de detalhes

## Mudanca

Apos testar conexao com sucesso, em vez de exibir o card completo de Status de Sincronizacao e o card de Qualificacoes Nativas inline na pagina, mostrar apenas um **badge clicavel** ao lado do badge "Conectado":

- **Todas sincronizadas** → badge verde "5/5 Sincronizadas" com icone CheckCircle2
- **Parcial** → badge amber "3/5 Sincronizadas" com icone de alerta
- **Nenhuma** → badge vermelho "0/5 Sincronizadas"

Ao clicar no badge, abre um **Dialog (modal)** contendo:
1. Tabela de Status de Sincronizacao (tabulacoes RIVO vs ID 3CPlus)
2. Tabela de Qualificacoes Nativas
3. Botao "Copiar Log" que copia todo o conteudo do modal como texto formatado para a clipboard (para enviar para IA ou suporte)

## Correcoes em `src/components/integracao/ThreeCPlusTab.tsx`

### 1. Remover os dois Cards inline (sync status + qualificacoes nativas)

Remover linhas 186-299 (os dois cards que aparecem abaixo do card de credenciais).

### 2. Adicionar badge clicavel na area de botoes (linha 176-181)

Apos o badge de "Conectado/Falha", adicionar badge de sync clicavel:

```
{showSyncStatus && tenantDispositions.length > 0 && (
  <Badge onClick={() => setSyncModalOpen(true)} className="cursor-pointer gap-1 ...">
    {syncedCount}/{total} Sincronizadas
  </Badge>
)}
```

### 3. Adicionar Dialog com detalhes + botao copiar

Usar `Dialog` do shadcn. Conteudo:
- Tabela de sync (mesma que existia)
- Tabela de qualificacoes nativas (mesma que existia)
- Botao "Copiar Log" que gera texto formatado:

```
=== Status de Sincronização ===
Caixa Postal (voicemail) → 198977 ✓
Não Atende (no_answer) → 198979 ✓
...
=== Qualificações Nativas ===
-2: Não qualificada
-3: Caixa Postal
...
```

### 4. Novos states

- `syncModalOpen: boolean` (default false)

## Arquivo a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/integracao/ThreeCPlusTab.tsx` | Substituir cards inline por badge clicavel + Dialog modal com tabelas e botao copiar |

