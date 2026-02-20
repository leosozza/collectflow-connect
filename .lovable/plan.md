
## Análise e Correção: QR Code não sendo gerado na Evolution API

### Diagnóstico Técnico (Confirmado com testes ao vivo)

Após testar diretamente os endpoints da Evolution API, foram identificados **3 problemas distintos**:

**Problema 1 — `connect` retorna `{"count": 0}` sem QR Code**
A instância "Maria Eduarda" está em estado `close`. Quando se chama `/instance/connect` em uma instância `close`, a Evolution API às vezes retorna `{"count": 0}` ao invés do QR Code. Isso ocorre porque a instância precisa ser **reiniciada** (`/instance/restart`) antes de gerar um novo QR. O frontend procura `result?.base64 || result?.qrcode?.base64` mas nenhum desses campos existe quando a resposta é `{"count":0}`.

**Problema 2 — Instância "TEMIS - Cobrança 01" deletada na Evolution API mas existe no banco**
Esta instância retorna 404 na API remota. Ela já está sendo tratada como `close` no status (corrigido anteriormente), mas ao tentar gerar QR Code ela vai falhar com 404.

**Problema 3 — Fluxo incompleto de geração de QR**
O fluxo atual é: `connect` → exibe QR. Mas quando o estado é `close`, o fluxo correto é: `restart` → `connect` → exibe QR. Além disso, após o `restart`, o QR pode demorar alguns segundos para ficar disponível.

### Solução Proposta

#### 1. Novo action `restart` no `evolution-proxy`
Adicionar um caso `restart` que chama `/instance/restart/{instanceName}` na Evolution API. Isso "acorda" a instância `close` para que passe ao estado `connecting`, habilitando a geração do QR.

#### 2. Lógica de auto-restart no `connect`
No action `connect` do proxy: se o status retornado for `{"count":0}` (sem QR), fazer automaticamente um `restart` e tentar o `connect` novamente após um pequeno delay (1 segundo), para garantir que o QR seja gerado.

```
Fluxo corrigido no evolution-proxy (action: connect):
  1. Chamar /instance/connect/{instanceName}
  2. Se retornar base64/qrcode -> retornar QR ✓
  3. Se retornar {"count":0} ou sem base64:
     a. Chamar /instance/restart/{instanceName}
     b. Aguardar 1.5 segundos
     c. Chamar /instance/connect/{instanceName} novamente
     d. Retornar resultado com QR (ou "indisponível")
```

#### 3. Tratamento de 404 no `connect`
Se `/instance/connect` retornar 404 (instância deletada remotamente, como "TEMIS - Cobrança 01"), retornar resposta clara informando que a instância não existe mais na API remota, com sugestão de recriar.

#### 4. Melhoria no frontend: indicador de loading no QR
No `BaylersInstancesList`, ao clicar em QR Code, mostrar um estado de "Carregando QR..." enquanto a requisição está em andamento. Atualmente o usuário não tem feedback visual durante a espera.

### Arquivos a Modificar

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/functions/evolution-proxy/index.ts` | Edge Function | Adicionar restart automático quando connect retorna sem QR; adicionar action `restart`; tratar 404 no connect |
| `src/services/whatsappInstanceService.ts` | Service | Adicionar função `restartEvolutionInstance` |
| `src/components/integracao/BaylersInstancesList.tsx` | Componente | Adicionar estado de loading no botão de QR Code durante geração |

### Resultado Esperado

- Ao clicar no botão QR Code de uma instância desconectada (`close`), o sistema fará restart + connect automaticamente e exibirá o QR Code
- O usuário verá um indicador de loading enquanto aguarda
- Instâncias com 404 remoto mostrarão mensagem clara ("instância não existe na API, recrie-a")
- O fluxo de criação de nova instância já retorna QR automaticamente (funcionando) e permanece sem alterações
