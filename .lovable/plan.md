
Objetivo: alinhar o payload de boleto do RIVO ao contrato que a Negociarie confirmou para cada parcela e eliminar os campos/nomes divergentes.

Diagnóstico atual

O RIVO está parcialmente correto, mas ainda incompleto para o contrato que você recebeu.

O que já está correto:
- usa raiz `cliente` em `nova-cobranca`
- envia `id_parcela`
- envia `valor_mora_dia` e `valor_multa` no fluxo de acordos
- existe callback global configurável em `src/components/integracao/SyncPanel.tsx`
- o proxy aceita e normaliza `cliente.telefones`

O que está errado ou incompleto:
1. `mensagem` não está sendo enviada nas parcelas
- Em `src/services/negociarieService.ts`, `buildBoletoPayload()` monta a parcela sem `mensagem` e sem `callback_url`.
- Em `src/components/integracao/CobrancaForm.tsx`, o boleto manual envia `descricao`, mas a instrução da Negociarie fala em `mensagem`.

2. `callback_url` não está sendo enviada por parcela
- Hoje o sistema só tem a ação “Configurar Callback URL” via `/cobranca/atualizar-url-callback`.
- Mas a instrução que você recebeu diz que o corpo da parcela também deve conter `callback_url`.
- No payload atual de boleto, esse campo não existe.

3. O boleto manual está mais desalinhado que o fluxo de acordos
- `CobrancaForm.tsx` envia `parcelas: [{ valor, data_vencimento, descricao }]`
- faltam: `id_parcela`, `valor_mora_dia`, `valor_multa`, `mensagem`, `callback_url`

4. Extração de número do endereço ainda pode errar
- No fluxo automático, `numero` só é extraído se o endereço vier com vírgula.
- Se o cadastro já tiver logradouro sem número separado, ele cai em `"SN"`.
- Isso pode continuar causando rejeições dependendo do cliente.

O que precisamos fazer

1. Padronizar o contrato da parcela no service
Arquivo: `src/services/negociarieService.ts`

Ajustar `buildBoletoPayload()` para que cada parcela de boleto seja montada assim:
```text
{
  id_parcela,
  data_vencimento,
  valor,
  valor_mora_dia,
  valor_multa,
  mensagem,
  callback_url
}
```

Planejamento:
- manter `id_parcela` obrigatório e string
- manter `valor_mora_dia`/`valor_multa`
- incluir `mensagem` padrão por boleto/parcela
- incluir `callback_url` usando a URL da função `negociarie-callback`

2. Corrigir o fluxo manual de cobrança
Arquivo: `src/components/integracao/CobrancaForm.tsx`

Hoje o form manual usa `descricao`; ele deve seguir o mesmo contrato do boleto real:
- trocar `descricao` por `mensagem` no payload da parcela
- incluir `id_parcela`
- incluir `valor_mora_dia`
- incluir `valor_multa`
- incluir `callback_url`

Também vale manter a descrição da UI, mas mapear corretamente para `mensagem` no envio.

3. Centralizar a URL de callback
Arquivos:
- `src/services/negociarieService.ts`
- possivelmente `src/components/integracao/SyncPanel.tsx`

Criar uma única fonte para o callback:
```text
${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-callback
```

Usar essa mesma URL:
- no botão de configurar callback global
- no `callback_url` de cada parcela enviada

Assim o contrato fica consistente.

4. Melhorar a mensagem impressa no boleto
Arquivo: `src/services/negociarieService.ts`

Definir uma mensagem segura e curta para o boleto, por exemplo:
```text
Acordo RIVO parcela X
Vencimento: DD/MM/AAAA
```

Se quiser depois, isso pode virar configurável por tenant, mas primeiro o foco deve ser aderir ao contrato.

5. Endurecer a normalização no proxy
Arquivo: `supabase/functions/negociarie-proxy/index.ts`

O proxy já normaliza muita coisa, mas precisa passar a preservar/validar:
- `mensagem`
- `callback_url`
- `valor_mora_dia`
- `valor_multa`

E evitar sobrescrever ou descartar esses campos por acidente.

6. Revisar o número do endereço
Arquivo: `src/services/negociarieService.ts`

Ajustar a montagem do `cliente.numero` para priorizar:
- número explícito, se existir separado
- extração do final do logradouro
- fallback `"SN"` apenas se realmente não houver número

Isso reduz chance de erro cadastral.

Resultado esperado

Depois desses ajustes:
- o payload do RIVO ficará aderente à instrução oficial da Negociarie
- tanto boleto automático quanto boleto manual enviarão a parcela completa
- o callback passará a existir também no corpo da parcela, não só na configuração global
- a mensagem do boleto será impressa corretamente
- o erro deixará de ser “payload incompleto” e, se ainda houver falha, ficará restrito a dados específicos do cliente/cadastro

Arquivos principais afetados
- `src/services/negociarieService.ts`
- `src/components/integracao/CobrancaForm.tsx`
- `supabase/functions/negociarie-proxy/index.ts`
- `src/components/integracao/SyncPanel.tsx`

Detalhe técnico importante

Hoje o maior desalinhamento não está no objeto `cliente`, e sim no objeto `parcelas`.

Comparação:
```text
NEGOCIARIE ESPERA           RIVO HOJE
id_parcela                  parcial/às vezes ok
data_vencimento             ok
valor                       ok
valor_mora_dia              ok em acordo, ausente no manual
valor_multa                 ok em acordo, ausente no manual
mensagem                    ausente
callback_url                ausente
```

Ou seja: a correção principal agora deve focar na estrutura completa da parcela.
