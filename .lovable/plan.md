

## Integração CobCloud API v3 - Sincronização Bidirecional

### Visão Geral

Integrar o sistema com a API CobCloud v3 (`api-v3.cob.cloud`) para permitir sincronização bidirecional de devedores, títulos, pagamentos e devoluções.

A API CobCloud usa autenticação via **duas API Keys** enviadas como headers:
- `token_assessoria` - identifica a assessoria
- `token_client` - identifica o credor/cliente

### Pré-requisito: Credenciais

Antes de implementar, você precisará solicitar ao CobCloud as suas credenciais de API. Entre em contato com o suporte em `desenvolvimento@cobcloud.com.br` ou acesse `https://dev.cob.cloud/` para obter:
- **token_assessoria**: token da assessoria
- **token_client**: token do credor

Após obter, vamos configurar como segredos no backend.

---

### Endpoints da API CobCloud v3

Com base na documentação OpenAPI analisada:

| Recurso | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Devedores | POST | `/cli/devedores/cadastrar` | Cadastrar devedor e títulos |
| Títulos | GET | `/cli/titulos/listar` | Listar títulos |
| Títulos | PUT | `/cli/titulos/baixar` | Baixar/dar baixa em título |
| Pagamentos | GET | (a confirmar) | Consultar pagamentos |
| Devoluções | GET | (a confirmar) | Consultar devoluções |

---

### Arquitetura da Integração

```text
+------------------+       +--------------------+       +------------------+
|  Frontend React  | ----> | Edge Function      | ----> | api-v3.cob.cloud |
|  (botões sync)   |       | cobcloud-proxy     |       | (API CobCloud)   |
+------------------+       +--------------------+       +------------------+
                                    |
                                    v
                           +------------------+
                           | Banco de dados   |
                           | (tabela clients) |
                           +------------------+
```

---

### Etapas de Implementação

#### 1. Configurar Segredos
- Adicionar `COBCLOUD_TOKEN_ASSESSORIA` e `COBCLOUD_TOKEN_CLIENT` como segredos do backend
- Estes serão acessíveis via `Deno.env.get()` nas funções backend

#### 2. Criar Edge Function `cobcloud-proxy`
Uma única função backend com rotas internas:

- **POST /import-titulos**: Busca títulos do CobCloud e importa para o banco local
  - Chama `GET /cli/titulos/listar` na API CobCloud
  - Mapeia os campos para a estrutura da tabela `clients`
  - Insere/atualiza registros no banco

- **POST /export-devedores**: Envia devedores do banco local para o CobCloud
  - Recebe lista de IDs de clientes
  - Busca dados no banco
  - Chama `POST /cli/devedores/cadastrar` na API CobCloud

- **POST /baixar-titulo**: Dá baixa em título no CobCloud
  - Recebe ID do título e informações de pagamento
  - Chama `PUT /cli/titulos/baixar` na API CobCloud

- **GET /status**: Testa a conexão com a API CobCloud

#### 3. Criar Serviço Frontend `cobcloudService.ts`
- Funções para chamar a edge function:
  - `testConnection()` - verificar conectividade
  - `importTitulos(filters)` - importar títulos
  - `exportDevedores(clientIds)` - enviar devedores
  - `baixarTitulo(tituloId, pagamento)` - dar baixa

#### 4. Criar Página de Integração CobCloud
Nova rota `/integracao` com:
- Status da conexão (verde/vermelho)
- Botão "Importar Títulos" com filtros opcionais
- Botão "Enviar Devedores Selecionados"
- Log de sincronizações realizadas
- Acesso restrito a admins

#### 5. Adicionar Ações na Tabela de Clientes
- Botão "Enviar para CobCloud" em registros individuais
- Botão "Dar baixa no CobCloud" ao registrar pagamento

---

### Detalhes Técnicos

**Edge Function** (`supabase/functions/cobcloud-proxy/index.ts`):
- CORS headers padrão
- Autenticação do usuário via JWT do Supabase
- Verificação de role admin antes de executar
- Rate limiting respeitando limites do CobCloud (10 POST/min, 25 GET/min)
- Headers da API CobCloud: `token_assessoria` e `token_client` via `Deno.env.get()`

**Mapeamento de campos CobCloud -> sistema local**:
- O mapeamento exato dependerá da estrutura de resposta da API, que será refinado após os primeiros testes com as credenciais

**Nova rota no App.tsx**:
- `/integracao` protegida, acessível apenas para admins
- Link no menu lateral (AppLayout)

---

### Ordem de Execução

1. Solicitar as credenciais ao usuário (segredos)
2. Criar a edge function `cobcloud-proxy` com endpoint de teste
3. Criar o serviço frontend
4. Criar a página de integração
5. Adicionar botões nas telas existentes
6. Testar conexão e fluxos

### Limitação

Como você ainda **não possui as credenciais**, na implementação inicial criaremos toda a estrutura pronta para funcionar. Assim que você obtiver os tokens do CobCloud, basta configurá-los e o sistema estará operacional.

