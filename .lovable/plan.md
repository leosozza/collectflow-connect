

# Corrigir Estrutura do Payload para API Negociarie

## Problema
A API Negociarie espera um payload com estrutura **aninhada** (nested), mas o formulario envia um objeto plano (flat). Os campos obrigatorios sao:

- `id_geral` - identificador unico da cobranca (gerado pelo cliente)
- `devedor` - objeto com dados do devedor: `documento`, `razao_social`, `cep`, `endereco`, `bairro`, `cidade`, `uf`, `email`, `celular`
- `parcelas` - array de parcelas com valor e vencimento
- `sandbox` - flag booleano (true para testes, false para producao)

## Solucao

### 1. Reestruturar o payload no `CobrancaForm.tsx`

Transformar o payload flat atual:
```json
{ "documento": "123", "nome": "Fulano", "cep": "01001000", ... }
```

Para o formato esperado pela API:
```json
{
  "id_geral": "TENANT-1234567890",
  "devedor": {
    "documento": "12345678901",
    "razao_social": "Nome Completo",
    "cep": "01001000",
    "endereco": "Rua Exemplo, 123",
    "bairro": "Centro",
    "cidade": "Sao Paulo",
    "uf": "SP",
    "email": "email@exemplo.com",
    "celular": "11999999999"
  },
  "parcelas": [
    {
      "valor": 100.00,
      "data_vencimento": "2026-03-01",
      "descricao": "Cobranca boleto"
    }
  ],
  "sandbox": false
}
```

### 2. Adicionar campo "Bairro" ao formulario
A API exige `devedor.bairro` que nao existe no formulario atual. Adicionar campo de bairro obrigatorio.

### 3. Gerar `id_geral` automaticamente
Gerar um identificador unico no formato `{prefixo}-{timestamp}` para cada cobranca.

### 4. Adicionar flag `sandbox`
Usar `sandbox: false` por padrao (producao). Opcionalmente ler das configuracoes do tenant.

## Detalhes Tecnicos

### Arquivos modificados
- `src/components/integracao/CobrancaForm.tsx`
  - Adicionar campo "Bairro" ao form state e UI
  - Reestruturar payload para formato aninhado com `devedor`, `parcelas`, `id_geral`, `sandbox`
  - Validar bairro como campo obrigatorio
  - Gerar `id_geral` unico automaticamente

### Novo estado do form
```typescript
const [form, setForm] = useState({
  nome: "", cpf: "", email: "", telefone: "",
  valor: "", vencimento: "", descricao: "",
  cep: "", endereco: "", bairro: "", cidade: "", uf: "",
});
```

### Payload reestruturado
```typescript
const idGeral = `COB-${Date.now()}`;
const payload = {
  id_geral: idGeral,
  devedor: {
    documento: form.cpf.replace(/\D/g, ""),
    razao_social: form.nome.trim(),
    cep: form.cep.replace(/\D/g, ""),
    endereco: form.endereco.trim(),
    bairro: form.bairro.trim(),
    cidade: form.cidade.trim(),
    uf: form.uf,
    email: form.email.trim() || "nao@informado.com",
    celular: form.telefone.replace(/\D/g, "") || "00000000000",
  },
  parcelas: [
    {
      valor: Number(form.valor),
      data_vencimento: form.vencimento,
      descricao: form.descricao.trim() || `Cobranca ${tipo}`,
    },
  ],
  sandbox: false,
};
```

### Validacao adicional
- Bairro: obrigatorio, nao vazio

