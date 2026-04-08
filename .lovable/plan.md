

# Mostrar Relógio SLA Apenas em Conversas da API Oficial

## O que muda

O relógio de SLA será exibido **somente** para conversas vinculadas a instâncias com `provider_category = 'official_meta'`. Conversas de instâncias não oficiais não terão o ícone.

## Como

### 1. Ampliar o tipo da prop `instances` no `ConversationList`

Atualmente é `{ id: string; name: string }[]`. Adicionar `provider_category`:
```
instances: { id: string; name: string; provider_category?: string }[]
```

### 2. No `WhatsAppChatLayout`, passar `provider_category` junto

Na linha onde mapeamos instances para o `ConversationList`, incluir o campo:
```ts
instances={instances.map((i) => ({ id: i.id, name: i.name, provider_category: i.provider_category }))}
```

### 3. No bloco do relógio SLA (linha ~426), verificar a instância

Antes de renderizar o `Clock`, buscar a instância da conversa e checar se é oficial:
```ts
const inst = instances.find(i => i.id === conv.instance_id);
const isOfficial = inst?.provider_category === "official_meta";
if (!deadline || !isOfficial) return null;
```

### Resultado
- Conversas de instâncias oficiais (Meta/Gupshup): relógio verde/laranja/vermelho conforme SLA
- Conversas de instâncias não oficiais: sem relógio

