
## Link Público para a Documentação da API

### Objetivo

Criar uma rota pública `/api-docs/public` que exibe a documentação completa da API (endpoints, campos, exemplos de código) sem exigir login. Essa URL pode ser enviada para qualquer desenvolvedor ou IA para análise e integração.

### O que será criado

#### 1. Nova rota pública `/api-docs/public` em `App.tsx`

Rota sem `ProtectedRoute`, sem `AppLayout` — acessível sem autenticação. Renderiza um componente dedicado com toda a documentação técnica.

#### 2. Componente `ApiDocsPublicPage.tsx`

Página limpa (sem sidebar/menu interno) com:

- Header com logo/nome do sistema e badge "Documentação Pública"
- URL base da API em destaque
- Seção de Autenticação (header `X-API-Key`)
- Todos os endpoints documentados (igual à aba "Endpoints" atual)
- Tabela de campos aceitos
- Exemplos de código (Python, Node.js, cURL) para importação em massa
- Footer indicando que a chave deve ser solicitada ao administrador

#### 3. Botão "Compartilhar Documentação" na página `/api-docs` (admin)

Na página existente `ApiDocsPage.tsx`, adicionar no topo um card com:

- URL do link público (`/api-docs/public`) em campo copiável
- Botão "Copiar Link" com feedback
- Nota explicativa: "Compartilhe com devs ou IA para integração — não expõe dados ou chaves"

### Estrutura de Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/ApiDocsPublicPage.tsx` | Novo — página pública de documentação |
| `src/App.tsx` | Adicionar rota `/api-docs/public` sem autenticação |
| `src/pages/ApiDocsPage.tsx` | Adicionar card com link público e botão copiar |

### O que a página pública NÃO expõe

- Nenhuma chave de API (apenas formato/exemplos com placeholder)
- Nenhum dado do tenant
- Nenhum dado de clientes
- Acesso apenas à documentação estática

### Fluxo de uso

```text
Admin acessa /api-docs
    |
    v
Copia o link público: https://collectflow-connect.lovable.app/api-docs/public
    |
    v
Envia para dev/IA
    |
    v
Dev/IA acessa /api-docs/public (sem login)
    |
    v
Vê documentação completa → integra o sistema externo
```

### Detalhes da Página Pública

A página pública vai usar a URL base hardcoded (`https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api`) e apresentar:

1. **Autenticação**: Como usar o header `X-API-Key` (solicitar chave ao admin)
2. **Endpoints**: Todos os 9 endpoints com métodos, paths, parâmetros e exemplos
3. **Campos**: Tabela completa de campos aceitos (obrigatório/opcional)
4. **Exemplos**: Python, Node.js, cURL para importação em massa de 10.000+ registros
5. **Boas práticas**: Idempotência, upsert, tratamento de erros

A página tem visual limpo, responsivo e otimizado para leitura por humanos e IA.
