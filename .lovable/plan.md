

## Status: pronto para publicar ✅

### Verificações realizadas

| Check | Resultado |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ 0 erros |
| Runtime errors | ✅ Nenhum |
| Console do preview | ✅ Sem erros |
| Correções da última rodada presentes no código | ✅ Confirmado |

### Correções confirmadas em `TelefoniaDashboard.tsx`

- **Linha 117-120**: loader "Aguardando dados da chamada..." renderiza enquanto `companyCalls` ainda não chegou.
- **Linha 870**: `isManualPause` agora aceita `status===3 || status===6` sem exigir `activePauseName` → botão "Retomar" sempre aparece.
- **Linha 1256**: render condicional do botão "Retomar" amarrado ao `isManualPause` corrigido.
- **Linha 1321-1324**: botão "Forçar saída" disponível como escape de pausa travada.

### Como publicar

Clique em **Publish** (canto superior direito) → **Update**. Frontend vai ao ar imediatamente em `https://rivoconnect.lovable.app` e no domínio custom `https://rivoconnect.com`. Edge functions já estão deployadas automaticamente.

### Validação pós-publish (peça ao Gustavo)

1. Entrar em campanha → próxima ligação deve **abrir a ficha** em até 3s (com loader curto se necessário).
2. Se cair em pausa externa → botão **Retomar** visível imediatamente.
3. Se travar em pausa > 60s → botão **Forçar saída** aparece como escape.

### Pendências fora desta publicação (não bloqueiam)

- **Áudio one-way do Gustavo**: problema externo (MicroSIP/NAT do PC dele) — não há fix de código possível.
- **Campanhas WhatsApp**: já tratadas em rodadas anteriores (timeout 120s + watchdog).

