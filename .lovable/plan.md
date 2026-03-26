

# Plano: Resolver erro 500 da API Negociarie no endpoint /cobranca/nova

## Diagnóstico

O payload está estruturado corretamente no formato `{ cliente, id_geral, parcelas }`. O login funciona (test-connection OK). Porém, o endpoint `/cobranca/nova` retorna **HTML com status 500** — um erro interno do servidor Negociarie.

O proxy atual descarta o conteúdo HTML e loga apenas "API returned HTML (500)", sem mostrar o corpo da resposta, o que impede o diagnóstico.

## Possíveis causas do lado do payload

1. **`telefones` com DDI**: O valor `"5511945542245"` inclui DDI 55. A API pode esperar apenas DDD+número: `"11945542245"`
2. **Campos vazios**: `numero: ""` e `complemento: ""` podem causar erro de validação no servidor. Melhor omitir ou enviar valor padrão
3. **Campo `bairro`**: Não consta na documentação da API `/cobranca/nova` — pode estar causando rejeição silenciosa

## Correções

### 1. `supabase/functions/negociarie-proxy/index.ts`
- Logar o corpo HTML/texto completo (primeiros 500 chars) quando a API retorna erro, em vez de apenas "API returned HTML"
- Incluir o texto real na mensagem de erro retornada ao frontend

### 2. `src/services/negociarieService.ts`
- **Telefone**: Remover DDI 55 do início se presente (manter apenas DDD+número)
- **Campos vazios**: Não incluir `numero`, `complemento` e `bairro` quando estiverem vazios
- **Remover `bairro`**: Não está na documentação do endpoint `/cobranca/nova`

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/negociarie-proxy/index.ts` | Logar corpo de erro completo (primeiros 500 chars) |
| `src/services/negociarieService.ts` | Limpar telefone (remover DDI 55), omitir campos vazios opcionais |

## Resultado esperado
- Mensagem de erro mais informativa caso persista
- Payload mais limpo sem campos vazios que podem causar erro
- Telefone no formato correto (sem DDI)

