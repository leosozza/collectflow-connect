# Restaurar linha de Telefones + Email

## Contexto

Na refatoração anterior do `ClientDetailHeader.tsx` (commit `6b584f4d`), o bloco "Telefones + Email" que ficava dentro do colapsável "Mais informações do devedor" foi removido. Esse bloco renderizava:

- `<PhoneList>` — popover com os 3 slots de telefone do cliente, ícone de chama para promover número quente, e abertura do WhatsApp.
- `<EmailList>` — lista consolidada de e-mails do CPF com validação.

Os componentes `PhoneList` e `EmailList` continuam importados e funcionais, só não estão sendo renderizados.

## Mudança

Apenas **reinserir** o bloco original logo após a grid de "Total Pago / Saldo Devedor / Status do Cliente / Data Quitação" e antes do bloco "Campos do credor". Nada mais é alterado (ordem, estilos, outros blocos, identidade visual).

### Localização (em `src/components/client-detail/ClientDetailHeader.tsx`)

Após o `</div>` da grid de valores (linha ~581), inserir:

```tsx
{/* Telefones + Email */}
<div className="pt-2 border-t border-border">
  <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
    {tenant?.id && client?.cpf && client?.credor && (
      <PhoneList
        tenantId={tenant.id}
        cpf={client.cpf}
        credor={client.credor}
        phone={client.phone}
        phone2={client.phone2}
        phone3={client.phone3}
      />
    )}
    <div className="min-w-0 max-w-full">
      <EmailList
        emails={(clients || []).map((c: any) => c?.email).concat([client.email])}
        tenantId={tenant?.id}
        cpf={client.cpf}
        credor={client.credor}
        currentEmail={client.email}
      />
    </div>
  </div>
</div>
```

Idêntico ao original — mesmas props, mesmo comportamento (popover de telefones com promoção de Hot e lista de e-mails).

## Risco

Zero. Os componentes ainda existem, são importados, e o restante do header não muda. Não há mudança de schema, query, ou serviço.

## Arquivos afetados

- `src/components/client-detail/ClientDetailHeader.tsx` (1 inserção)
