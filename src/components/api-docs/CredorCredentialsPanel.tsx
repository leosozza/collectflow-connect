import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import {
  fetchApiKeys,
  generateApiKey,
  revokeApiKey,
  type ApiKey,
} from "@/services/apiKeyService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Copy,
  ShieldX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Building2,
  Globe,
  Terminal,
} from "lucide-react";

const BASE_URL = `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api`;

type Credor = { id: string; nome: string };

const GLOBAL_KEY = "__global__";

export default function CredorCredentialsPanel() {
  const { profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();

  const [credores, setCredores] = useState<Credor[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogTarget, setDialogTarget] = useState<{
    credorId: string | null;
    credorNome: string | null;
  } | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<{
    token: string;
    label: string;
    credorNome: string | null;
  } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    void load();
  }, [tenant?.id]);

  async function load() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const [keys, credRes] = await Promise.all([
        fetchApiKeys(tenant.id),
        supabase
          .from("credores")
          .select("id, razao_social, nome_fantasia")
          .eq("tenant_id", tenant.id)
          .eq("status", "ativo")
          .order("razao_social"),
      ]);
      setApiKeys(keys);
      setCredores(
        ((credRes.data ?? []) as any[]).map((c) => ({
          id: c.id,
          nome: c.nome_fantasia || c.razao_social,
        })),
      );
    } catch (e: any) {
      toast.error("Erro ao carregar credenciais: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const keysByCredor = useMemo(() => {
    const map = new Map<string, ApiKey[]>();
    apiKeys.forEach((k) => {
      const key = k.credor_id ?? GLOBAL_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(k);
    });
    return map;
  }, [apiKeys]);

  const filteredCredores = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return credores;
    return credores.filter((c) => c.nome.toLowerCase().includes(term));
  }, [credores, search]);

  function openDialog(credorId: string | null, credorNome: string | null) {
    setDialogTarget({ credorId, credorNome });
    setNewKeyLabel(credorNome ? `${credorNome} — API` : "Chave Global");
  }

  async function handleGenerate() {
    if (!tenant?.id || !profile?.id || !dialogTarget) return;
    try {
      setGenerating(true);
      const { rawToken, record } = await generateApiKey(
        tenant.id,
        profile.id,
        newKeyLabel || "Nova Chave",
        dialogTarget.credorId,
      );
      setApiKeys((prev) => [
        { ...record, credor_nome: dialogTarget.credorNome },
        ...prev,
      ]);
      setRevealedToken({
        token: rawToken,
        label: newKeyLabel,
        credorNome: dialogTarget.credorNome,
      });
      setDialogTarget(null);
    } catch (e: any) {
      toast.error("Erro ao gerar credencial: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      setRevoking(id);
      await revokeApiKey(id);
      setApiKeys((prev) =>
        prev.map((k) =>
          k.id === id
            ? { ...k, is_active: false, revoked_at: new Date().toISOString() }
            : k,
        ),
      );
      toast.success("Credencial revogada");
    } catch (e: any) {
      toast.error("Erro ao revogar: " + e.message);
    } finally {
      setRevoking(null);
    }
  }

  function copy(text: string, msg = "Copiado!") {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  }

  function CredorCard({
    credorId,
    credorNome,
    isGlobal = false,
  }: {
    credorId: string | null;
    credorNome: string | null;
    isGlobal?: boolean;
  }) {
    const keys = keysByCredor.get(credorId ?? GLOBAL_KEY) ?? [];
    const activeCount = keys.filter((k) => k.is_active).length;

    const cUrlExample = `curl -H "X-API-Key: cf_sua_chave_aqui" \\
  "${BASE_URL}/clients?limit=10"`;

    return (
      <AccordionItem
        value={credorId ?? GLOBAL_KEY}
        className="border border-border rounded-lg overflow-hidden bg-card data-[state=open]:shadow-sm"
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isGlobal
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isGlobal ? (
                <Globe className="w-4 h-4" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="font-medium text-sm text-foreground truncate">
                {credorNome ?? "Chaves Globais (todos os credores)"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isGlobal
                  ? "Acesso a todos os credores do tenant"
                  : "Restrita aos dados deste credor"}
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                activeCount > 0
                  ? "text-primary border-primary/30 bg-primary/10"
                  : "text-muted-foreground"
              }
            >
              {activeCount} ativa{activeCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Use o header <code className="bg-muted px-1 py-0.5 rounded">X-API-Key</code> com a chave gerada para autenticar.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(cUrlExample, "Exemplo cURL copiado!")}
              >
                <Terminal className="w-3.5 h-3.5 mr-1.5" />
                Copiar cURL
              </Button>
              {isTenantAdmin && (
                <Button
                  size="sm"
                  onClick={() => openDialog(credorId, credorNome)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Gerar credencial
                </Button>
              )}
            </div>
          </div>

          {keys.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
              <Key className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Nenhuma credencial gerada para este escopo</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Prefixo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último uso</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium text-sm">{k.label}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                          {k.key_prefix}••••
                        </code>
                      </TableCell>
                      <TableCell>
                        {k.is_active ? (
                          <Badge
                            variant="outline"
                            className="text-primary border-primary/30 bg-primary/10"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <ShieldX className="w-3 h-3 mr-1" />
                            Revogada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.last_used_at
                          ? new Date(k.last_used_at).toLocaleString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(k.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {k.is_active && isTenantAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRevoke(k.id)}
                            disabled={revoking === k.id}
                          >
                            {revoking === k.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ShieldX className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Key className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">
            Credenciais de API por Credor
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada credor pode ter suas próprias chaves. Chaves escopadas só enxergam dados daquele credor — ideal para entregar integração direta a quem opera o portfólio.
          </p>
        </div>
      </div>

      {revealedToken && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    ⚠️ Copie agora — esta chave não será exibida novamente!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revealedToken.label}
                    {revealedToken.credorNome
                      ? ` · ${revealedToken.credorNome}`
                      : " · Global"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded px-3 py-2 font-mono break-all">
                    {revealedToken.token}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(revealedToken.token)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setRevealedToken(null)}
                >
                  Entendido, fechar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">URL Base da API</CardTitle>
          <CardDescription className="text-xs">
            Todas as chaves (globais ou por credor) usam o mesmo endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted border border-border rounded px-3 py-2 font-mono truncate">
              {BASE_URL}
            </code>
            <Button size="sm" variant="outline" onClick={() => copy(BASE_URL)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar credor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          <CredorCard credorId={null} credorNome={null} isGlobal />
          {filteredCredores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
              <Building2 className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {search
                  ? "Nenhum credor encontrado para a busca"
                  : "Nenhum credor ativo cadastrado"}
              </p>
            </div>
          ) : (
            filteredCredores.map((c) => (
              <CredorCard key={c.id} credorId={c.id} credorNome={c.nome} />
            ))
          )}
        </Accordion>
      )}

      <Dialog
        open={!!dialogTarget}
        onOpenChange={(open) => !open && setDialogTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar nova credencial</DialogTitle>
            <DialogDescription>
              {dialogTarget?.credorNome ? (
                <>
                  Esta chave terá acesso <strong>apenas</strong> aos dados do credor{" "}
                  <strong>{dialogTarget.credorNome}</strong>.
                </>
              ) : (
                <>Esta chave terá acesso a <strong>todos</strong> os credores deste tenant.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-label">Nome / descrição</Label>
              <Input
                id="key-label"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="Ex.: Integração ERP"
              />
              <p className="text-xs text-muted-foreground">
                Ajuda a identificar quem está usando esta chave.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogTarget(null)}
              disabled={generating}
            >
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !newKeyLabel.trim()}>
              {generating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              Gerar credencial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
