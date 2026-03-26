
Objetivo: corrigir de forma definitiva o payload enviado para a Negociarie para seguir exatamente o padrão esperado por ela, já que o endereço está sendo salvo corretamente no backend, mas a chamada ainda sai em formato incompatível.

Diagnóstico confirmado

- O endereço foi salvo com sucesso no banco:
  - `cep: 06186-130`
  - `endereco: Rua Luiz Henrique de Oliveira`
  - `bairro: Quitaúna`
  - `cidade: Osasco`
  - `uf: SP`
- Porém o log real do backend mostrou que a chamada enviada para a Negociarie saiu como:
  - `cep: "06186130"`
- Ou seja: o problema não é gravação do cliente, e sim a normalização final do payload da cobrança.
- Como a Negociarie continua respondendo `Preencha os dados corretamente [documento, nome, cep, endereco, cidade, uf]`, faz sentido padronizar o payload exatamente no formato dela e aplicar a padronização em mais de uma camada.

O que vou corrigir

1. Centralizar o payload “padrão Negociarie” em `src/services/negociarieService.ts`
- Criar um helper único para montar o payload da cobrança.
- Esse helper vai garantir:
  - `documento` com 11 dígitos
  - `nome` trimado
  - `cep` sempre no padrão `99999-999`
  - `endereco`, `cidade`, `uf` trimados
  - `uf` em maiúsculo
  - `telefone` apenas numérico
  - `bairro` preservado, mas sem depender dele como obrigatório local
- Tanto `generateSingleBoleto` quanto `generateAgreementBoletos` passarão a usar esse mesmo builder, evitando divergência.

2. Reforçar a validação local com regra compatível com a Negociarie
- Atualizar `validateAddressFields` para validar não só presença, mas também formato:
  - `documento`: 11 dígitos
  - `cep`: regex `^\d{5}-\d{3}$`
  - `uf`: 2 letras
  - campos textuais sem espaços vazios
- Se estiver fora do padrão, o erro local será claro antes de chamar a API.

3. Normalizar novamente no backend proxy (`supabase/functions/negociarie-proxy/index.ts`)
- Antes de encaminhar `params.data` na action `nova-cobranca`, aplicar uma sanitização defensiva no próprio proxy.
- Isso garante que, mesmo que algum fluxo futuro envie dados fora do padrão, o backend continue convertendo para:
  - `cep` com hífen
  - `documento` só dígitos
  - `uf` maiúsculo
  - strings sem espaços extras
- Essa dupla proteção faz sentido porque o bug atual já mostrou diferença entre o dado salvo e o payload efetivamente enviado.

4. Ajustar o formulário de edição do cliente para espelhar o padrão da Negociarie
- Em `src/components/client-detail/ClientDetailHeader.tsx`:
  - manter o CEP no topo
  - garantir máscara/normalização visual `00000-000`
  - ao salvar, persistir CEP já formatado
  - deixar UF em uppercase e limitar a 2 caracteres
- Assim o usuário vê e salva exatamente no padrão esperado.

5. Verificar consistência com o formulário “Nova Cobrança”
- `src/components/integracao/CobrancaForm.tsx` já possui comportamento próximo, então vou alinhar as regras para não existir um padrão no cadastro manual e outro no fluxo de boleto do acordo.
- O objetivo é que ambos os fluxos usem o mesmo contrato de dados.

Arquivos afetados

- `src/services/negociarieService.ts`
- `supabase/functions/negociarie-proxy/index.ts`
- `src/components/client-detail/ClientDetailHeader.tsx`
- possivelmente `src/components/integracao/CobrancaForm.tsx` para alinhar normalização

Resultado esperado

- Depois de editar e salvar o endereço do cliente, a geração do boleto passará a enviar:
  - documento no formato correto
  - CEP com hífen
  - UF em sigla
  - campos textuais limpos
- O payload ficará no padrão da Negociarie
- O erro 500 deixará de ocorrer quando os dados estiverem completos e válidos

Detalhes técnicos

- O ponto mais forte do diagnóstico é o contraste entre:
  - banco salvo com `06186-130`
  - log do proxy enviando `06186130`
- Isso indica que a correção precisa ser feita no mapeamento final do payload, não apenas no formulário.
- Não precisa migration para este ajuste.
