

# Corrigir Importacao CobCloud - API Retornando Zero Resultados

## Problema

A conexao com CobCloud funciona (status 200), mas a sincronizacao e importacao retornam 0 registros. Isso acontece porque:

1. O teste de conexao usa o endpoint `/cli/devedores/listar` (que funciona e encontra dados)
2. O preview e importacao usam `/cli/titulos/listar` (que retorna vazio)
3. Nao temos logs do que a API CobCloud realmente retorna, dificultando o diagnostico
4. Os valores de status usados no filtro (`aberto`, `pago`, `quebrado`) podem nao corresponder aos valores reais da API

## Solucao

### 1. Adicionar logging de debug na Edge Function

Incluir `console.log` para registrar as respostas brutas da API CobCloud em todas as chamadas (preview, import, status). Isso permite diagnosticar exatamente o que a API retorna.

### 2. Usar tambem `/cli/devedores/listar` como fonte de dados

Ja que sabemos que `/cli/devedores/listar` retorna dados, vamos:
- Adicionar uma chamada ao endpoint de devedores no preview para contagem
- Tentar ambos os endpoints (`titulos` e `devedores`) e usar o que retornar dados
- Logar a resposta de ambos para entender a estrutura

### 3. Preview mais robusto com fallback

O handler `handlePreview` vai:
1. Primeiro tentar `/cli/titulos/listar` sem filtro de status (apenas limit=1) para ver se existe algum dado
2. Se retornar 0, tentar `/cli/devedores/listar` como alternativa
3. Logar a resposta bruta de cada chamada para debug
4. Retornar o total encontrado e a fonte dos dados

### 4. Importacao com endpoint correto

O handler `handleImportAll` vai:
- Testar automaticamente qual endpoint tem dados antes de iniciar o loop
- Usar o endpoint que retorna resultados
- Logar cada pagina para acompanhamento

## Alteracoes Tecnicas

### Edge Function `cobcloud-proxy/index.ts`

**handlePreview** - Adicionar:
```text
- console.log com a URL chamada e resposta bruta
- Chamada sem filtro de status primeiro (para ver total geral)
- Fallback para /cli/devedores/listar se titulos retornar vazio
- Retorno inclui campo "source" indicando qual endpoint foi usado
```

**handleImportAll** - Adicionar:
```text
- console.log com a URL e resposta de cada pagina
- Deteccao automatica do endpoint correto (titulos vs devedores)
- Log de erro mais detalhado quando pagina retorna vazio
```

**handleStatus** - Adicionar:
```text
- Testar ambos endpoints e retornar contagem de cada
- Retorno: { connected, status, devedores_count, titulos_count }
```

### UI `CobCloudTab.tsx`

- Exibir informacao de debug quando a sincronizacao retorna 0 (ex: "Nenhum titulo encontrado. Verifique as credenciais e se existem dados cadastrados no CobCloud.")
- Mostrar o resultado do teste de conexao com mais detalhes (contagem de devedores vs titulos)

### Service `cobcloudService.ts`

- Atualizar tipagem do `testConnection` para incluir os novos campos de contagem

