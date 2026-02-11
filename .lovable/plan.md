

# Corrigir envio de Boleto, Pix e Cartao - Campos obrigatorios da API Negociarie

## Problema
A API Negociarie retorna erro 400 porque:
1. O campo `cpf` deveria ser enviado como `documento`
2. Campos de endereco sao obrigatorios: `cep`, `endereco`, `cidade`, `uf`
3. O proxy nao loga o body do erro, dificultando debug

## Solucao

### 1. Adicionar campos de endereco ao formulario (`CobrancaForm.tsx`)
- Novos campos: CEP (com mascara 00000-000), Endereco, Cidade, UF (select com estados)
- Mapear `cpf` para `documento` no payload enviado a API
- Manter layout em grid organizado

### 2. Melhorar logging no edge function (`negociarie-proxy/index.ts`)
- Logar o body completo do erro retornado pela Negociarie (nao apenas o status)
- Isso facilita debug futuro

## Detalhes tecnicos

### Payload corrigido (enviado a API)
```json
{
  "documento": "12345678901",
  "nome": "Nome Completo",
  "email": "email@exemplo.com",
  "telefone": "11999999999",
  "valor": 100.00,
  "vencimento": "2026-03-01",
  "descricao": "Cobranca boleto",
  "cep": "01001000",
  "endereco": "Rua Exemplo, 123",
  "cidade": "Sao Paulo",
  "uf": "SP"
}
```

### Arquivos modificados
- `src/components/integracao/CobrancaForm.tsx` - Adicionar campos de endereco, mascara de CEP, mapear cpf->documento
- `supabase/functions/negociarie-proxy/index.ts` - Logar body de erro completo na funcao `negociarieRequest`

### Mascara de CEP
Adicionar em `src/lib/formatters.ts`:
```typescript
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
```

### Campos do form (estado inicial)
```typescript
const [form, setForm] = useState({
  nome: "", cpf: "", email: "", telefone: "",
  valor: "", vencimento: "", descricao: "",
  cep: "", endereco: "", cidade: "", uf: "",
});
```

### Validacao adicional
- CEP: 8 digitos obrigatorio
- Endereco: obrigatorio (nao vazio)
- Cidade: obrigatorio
- UF: obrigatorio (select com 27 estados)
