
Diagnóstico

O erro não está mais apontando falta de dados no cadastro do Raul. Os logs mostram que os dados obrigatórios existem e estão preenchidos:

```text
documento: 38568385893
nome: Raul Jose Seixas Junior
cep: 06186-130
endereco: Rua Luiz Henrique de Oliveira
cidade: Osasco
uf: SP
email: raulsjunior@hotmail.com
celular: 11945542245
```

O problema principal é de contrato com a API:

1. O endpoint usado para boleto simples é `/cobranca/nova`
2. A documentação desse endpoint espera `cliente` na raiz, não `devedor`
3. A documentação de `/cobranca/nova` também usa `nome` e no exemplo envia `telefones` dentro de `cliente`
4. Já os endpoints `nova-pix` / `nova-cartao` usam outro contrato, com `devedor` e `razao_social`

Hoje o código misturou os dois formatos:
- serviço de boleto monta payload no formato de `devedor`
- proxy repassa para `/cobranca/nova`
- isso funciona para Pix/Cartão, mas não corresponde ao contrato documentado do boleto simples

Comparação lado a lado

```text
/cobranca/nova  ESPERA                 HOJE ESTAMOS ENVIANDO
──────────────────────────             ──────────────────────────
cliente {                              devedor {
  nome                                   nome
  razao_social (opcional)                sem razao_social
  cep                                    cep
  endereco                               endereco
  numero                                 numero
  complemento                            complemento
  cidade                                 cidade
  uf                                     uf
  telefones[] / telefone                 celular
  email                                  email
}                                      }

parcelas[]                             parcelas[]
id_geral                               id_geral
sem necessidade de sandbox             sandbox: false
```

Sinal adicional de inconsistência:
- o tratamento de resposta do boleto procura `link_boleto` / `url_boleto`
- mas a documentação de `/cobranca/nova` retorna `parcelas[].link`
- então, mesmo quando a criação passar, a UI pode não exibir o PDF do boleto corretamente

Plano de correção

1. Separar os contratos por endpoint
- Manter um builder exclusivo para boleto simples (`/cobranca/nova`)
- Manter outro builder para Pix/Cartão (`/cobranca/nova-pix`, `/cobranca/nova-cartao`, crédito)

2. Corrigir o payload do boleto simples
- Trocar a raiz de `devedor` para `cliente`
- Enviar `cliente.nome`
- Incluir `cliente.razao_social` como `""` para PF
- Converter telefone para `cliente.telefones: [numero]` no formato esperado
- Manter `numero` e `complemento`
- Remover `sandbox` do fluxo de boleto simples, já que não faz parte do contrato documentado desse endpoint

3. Ajustar o proxy por ação
- Em `nova-cobranca`, normalizar para o formato `cliente`
- Se o frontend ainda mandar `devedor`, fazer mapeamento interno temporário `devedor -> cliente` para compatibilidade
- Em `nova-pix` e `nova-cartao`, preservar o formato `devedor`

4. Ajustar a leitura da resposta do boleto
- Mapear `parcelas[0].link` como link do boleto
- Continuar aceitando `link_boleto`/`url_boleto` como fallback
- Salvar corretamente o link retornado em `negociarie_cobrancas`

5. Unificar a tela manual de cobrança
- `CobrancaForm` hoje envia boleto em payload flat e Pix/Cartão em payload nested
- Vou alinhar o boleto manual para o mesmo formato estruturado correto de `/cobranca/nova`
- Isso evita depender de “mágica” no proxy e reduz divergência entre fluxo manual e fluxo do acordo

6. Melhorar os logs para diagnóstico final
- Logar quais chaves raiz foram enviadas (`cliente` vs `devedor`)
- Logar o payload final normalizado por endpoint
- Se ainda houver erro da Negociarie, ficará claro se o problema restante é de contrato ou regra interna deles

Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Criar payload correto para boleto simples com `cliente` |
| `supabase/functions/negociarie-proxy/index.ts` | Normalização separada por endpoint; `nova-cobranca` passa a enviar `cliente` |
| `src/components/integracao/CobrancaForm.tsx` | Alinhar boleto manual ao contrato correto |
| `src/components/integracao/CobrancasList.tsx` | Garantir leitura de `parcelas[].link` se necessário |

Resultado esperado

- O boleto do Raul deixa de falhar por validação de estrutura
- O contrato do boleto fica aderente à documentação da Negociarie
- Pix/Cartão continuam funcionando com seu formato próprio
- Quando o boleto for criado com sucesso, o link/PDF também aparecerá corretamente na aplicação
