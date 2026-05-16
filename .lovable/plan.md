## Objetivo

Corrigir upload do Logo de Documentos e simplificar a aba **Bancário** do credor (`/cadastros/credores/:id/bancario`).

---

## 1. Upload de Logo (aba Dados) — corrigir falha em PNG

**Causa raiz**: O upload em `CredorForm.tsx` usa o caminho `credor-doc-logos/{id}/...` no bucket `avatars`. As policies de INSERT/UPDATE no bucket `avatars` só permitem dois padrões:
- `credor-logos/...` (logo da empresa)
- `{auth.uid()}/...` (avatar pessoal)

A pasta `credor-doc-logos` **não tem policy** → toda tentativa (PNG, JPG, qualquer formato) viola RLS. Se JPG "funcionou" antes, foi em outra pasta/credor já cadastrado (cache do `document_logo_url` antigo). Não é problema de MIME — é falta de policy.

**Fix**: Migration adicionando duas policies para a pasta `credor-doc-logos` no bucket `avatars` (INSERT e UPDATE, autenticado).

```sql
CREATE POLICY "Authenticated users can upload doc logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'credor-doc-logos');

CREATE POLICY "Authenticated users can update doc logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'credor-doc-logos');
```

Sem mudanças no React — só backend.

---

## 2. Aba Bancário — simplificar UI

Arquivo: `src/components/admin/integrations/CreditorIntegrationsVault.tsx`

### 2.1 "Modo Cobrança Direta Ativo: …"
- Hoje: bloco de texto sempre visível.
- Novo: ícone `Info` (lucide) ao lado do título; texto aparece em `Tooltip` (shadcn) ao hover.

### 2.2 Remover "Último teste: dd/mm/yyyy — ✓ Conexão validada"
- Apagar o bloco `{status?.last_test_at && …}` (linhas ~236-241).

### 2.3 Texto do Webhook "Esta URL recebe da Negociarie…"
- Hoje: parágrafo visível abaixo do título.
- Novo: ícone `Info` ao lado de "Webhook de baixa automática"; texto vai pro `Tooltip` (versão curta solicitada: *"Esta URL recebe da Negociarie a confirmação dos pagamentos e dá baixa automática nos acordos. Registre-a uma vez na conta Negociarie deste credor — não precisa repetir a cada cobrança."*).

### 2.4 Remover "Último registro: …"
- Apagar o `<span>` `{status.callback_registered_at && …}` (linhas ~299-303).

### 2.5 Botão "Registrar callback na Negociarie"
- Renomear para **"Registrar Callback"**.
- Trocar `variant="secondary"` por classe laranja do RIVO: `className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"` (remove `variant="secondary"`).

### 2.6 Reduzir parágrafo "Sincronizar baixas pagas"
- De: *"Sincronizar baixas pagas: consulta os pagamentos dos últimos dias diretamente na conta Negociarie deste credor e aplica a baixa no RIVO. Use após registrar o callback, ou quando suspeitar que o webhook não disparou."*
- Para: **"Sincronizar baixas pagas: quando suspeitar que o webhook não disparou."**

---

## Arquivos tocados

1. **Migration nova** — policies do bucket `avatars` para `credor-doc-logos`.
2. `src/components/admin/integrations/CreditorIntegrationsVault.tsx` — apenas UI (tooltips, remoções, texto do botão, cor).

Nenhuma lógica de negócio (acordos, baixas, RLS de tenant) é alterada.
