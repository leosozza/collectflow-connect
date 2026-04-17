

## Plano — Ajustar card "Cliente Vinculado" no WhatsApp

### Localizar o componente
Preciso achar o card "Cliente Vinculado" em `/contact-center/whatsapp`. Provavelmente em `src/components/whatsapp/` ou `src/pages/WhatsApp*`. Vou inspecionar para confirmar o arquivo exato e a estrutura atual.

### Estado atual (pela imagem)
Mostra hoje:
- Nome (Rosilma Terezinha...)
- CPF
- Credor
- Badges: "Pago", "Quitado", "Parcela 1/1"
- Valor: R$ 500,00
- Botões: Abrir Perfil / Formalizar Acordo

### Estado desejado
Card deve exibir, na ordem:
1. **Nome**
2. **CPF**
3. **Credor**
4. **Saldo Devedor** (valor em aberto — `valor_saldo` ou soma de pendentes)
5. **Status** (do acordo / parcela — manter os badges atuais "Pago", "Quitado")
6. **Status do Cliente** — novo badge mostrando situação global do CPF: Em Dia / Inadimplente / Acordo Vigente / Acordo Atrasado / Quitado etc.

Manter botões "Abrir Perfil" e "Formalizar Acordo" iguais.

### Como derivar "Status do Cliente"
Já existe a hierarquia canônica por CPF/Credor (memo `logic/status-standardization-cpf-centric`): QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA DE ACORDO > INADIMPLENTE > EM DIA. Vou reutilizar a mesma fonte/cálculo usado na Carteira (campo `status_global` ou similar do `clients` / RPC). Sem inventar nomenclatura nova.

### Como derivar "Saldo Devedor"
Soma de `valor_atualizado` (ou `valor_saldo` como fallback) dos registros com `status === "pendente"` para aquele CPF+Credor. Mesma lógica que o `ClientHeader.tsx` usa em `/atendimento`.

### Mudança
Apenas o card de cliente vinculado no WhatsApp:
- Remover/reorganizar para a ordem pedida.
- Adicionar linha "Saldo Devedor: R$ X" (já tem valor, só renomear/garantir que é o saldo total e não da parcela).
- Adicionar badge "Status do Cliente" colorido conforme hierarquia.

### Arquivos prováveis (a confirmar ao implementar)
- Componente do card de cliente vinculado dentro do módulo WhatsApp (ex.: `src/components/whatsapp/ContactPanel*.tsx` ou similar).
- Possível reuso de helper de status global existente.

### Sem alteração
Schema, RLS, services, demais áreas (Tabulação, botões, layout do resto da coluna direita).

