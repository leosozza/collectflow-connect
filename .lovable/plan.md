

# Indicador visual de Oficial / Não Oficial no seletor de instâncias

## O que será feito

Adicionar indicadores visuais no dropdown de instâncias para diferenciar rapidamente as instâncias oficiais das não oficiais:

- **Oficial**: badge verde com ícone de escudo (ShieldCheck) + texto "Oficial"
- **Não Oficial**: badge cinza com ícone de QR code (QrCode) + texto "Não Oficial"

## Arquivo alterado

**`src/components/contact-center/whatsapp/ConversationList.tsx`** (~linhas 363-367)

Cada `SelectItem` passará a exibir o nome da instância acompanhado de um badge colorido indicando a categoria:

```tsx
<SelectItem key={i.id} value={i.id}>
  <span className="flex items-center gap-1.5">
    {i.name}
    {(i.provider_category === "official_meta" || i.provider_category === "official") ? (
      <span className="inline-flex items-center gap-0.5 text-[9px] bg-green-500/20 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">
        <ShieldCheck className="w-3 h-3" /> Oficial
      </span>
    ) : (
      <span className="inline-flex items-center gap-0.5 text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
        <QrCode className="w-3 h-3" /> Não Oficial
      </span>
    )}
  </span>
</SelectItem>
```

Adicionar `ShieldCheck` e `QrCode` aos imports do lucide-react.

## Detalhes técnicos

- Usa `provider_category` já disponível no array `instances` (tipado como `{ id, name, provider_category? }`)
- Nenhuma mudança no backend ou banco de dados
- Apenas 1 arquivo editado

