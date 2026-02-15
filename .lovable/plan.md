

# Plano: Link Copiavel do Portal + Upload de Logo no Cadastro de Credores

## Objetivo
Melhorar a aba "Portal" do cadastro de credores com:
1. Um link pronto para copiar e divulgar aos devedores inadimplentes
2. Substituir o campo "URL do Logo" por um upload de imagem

---

## O que muda para o usuario

### Link do Portal
Na aba "Portal" do cadastro de credores, quando o portal estiver ativo, aparecera um campo com o link completo do portal (ex: `https://collectflow-connect.lovable.app/portal/minha-empresa`) com um botao "Copiar" ao lado. O administrador copia esse link e envia por WhatsApp, email ou qualquer canal para seus devedores.

### Upload de Logo
Em vez de colar uma URL manualmente, o usuario podera clicar em um botao para fazer upload da imagem do logo diretamente. A imagem sera armazenada no armazenamento do sistema e o link sera preenchido automaticamente.

---

## Detalhes Tecnicos

### 1. Link copiavel do Portal
- **Arquivo**: `src/components/cadastros/CredorForm.tsx` (aba "portal")
- Montar a URL usando o slug do tenant: `{window.location.origin}/portal/{tenant.slug}`
- Exibir em um campo somente-leitura com botao de copiar (usando `navigator.clipboard.writeText`)
- Mostrar feedback visual (toast "Link copiado!") ao clicar

### 2. Upload de Logo
- **Arquivo**: `src/components/cadastros/CredorForm.tsx` (aba "portal")
- Usar o bucket `avatars` (ja existente e publico) para armazenar os logos dos credores
- Adicionar um input de arquivo (aceitar apenas imagens: `.png, .jpg, .svg, .webp`)
- Ao selecionar o arquivo:
  - Fazer upload para o storage com path `credor-logos/{credorId}/{filename}`
  - Obter a URL publica e preencher o campo `portal_logo_url` automaticamente
- Exibir preview da imagem apos upload
- Manter o campo de URL como fallback caso o usuario prefira colar um link externo

### 3. Ajustes na aba Portal
- Reorganizar a aba para que o link copiavel fique no topo (destaque visual)
- Logo: mostrar area de upload com drag-and-drop ou clique, com preview
- Manter os demais campos (titulo hero, subtitulo, cor primaria)

---

## Arquivos afetados
- `src/components/cadastros/CredorForm.tsx` -- adicionar link copiavel e upload de logo na aba Portal

