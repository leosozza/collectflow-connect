
Mover Credor e Em Aberto para uma segunda sublinha fixa, mantendo CPF/Tel/Email na primeira.

**Nova estrutura no `ClientDetailHeader.tsx` (linhas 463-473):**
```
Linha A: CPF | Tel | Email
Linha B: Credor | Em Aberto: R$ X,XX  (alinhados à esquerda, mesmo padding pl-11)
```

Cada sublinha em sua própria `<div className="flex items-center gap-3">`, sem `flex-wrap`. "Em Aberto" mantém destaque (`text-destructive font-bold text-base`).
