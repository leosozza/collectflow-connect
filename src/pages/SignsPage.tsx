import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { updateTenant } from "@/services/tenantService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, MousePointerClick, Camera, PenTool, RotateCcw, CheckCircle2, Smartphone } from "lucide-react";
import SignatureClick from "@/components/portal/signatures/SignatureClick";
import SignatureFacial from "@/components/portal/signatures/SignatureFacial";
import SignatureDraw from "@/components/portal/signatures/SignatureDraw";
import { addDays, format } from "date-fns";

const MOCK_AGREEMENT = {
  client_name: "Maria Silva Exemplo",
  credor: "Empresa Demonstração S.A.",
  original_total: 5000,
  proposed_total: 2500,
  discount_percent: 50,
  new_installments: 5,
  new_installment_value: 500,
  first_due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SignsPage = () => {
  const { tenant, isTenantAdmin, refetch } = useTenant();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const tenantSettings = (tenant?.settings || {}) as Record<string, any>;
  const [signatureType, setSignatureType] = useState<string>(tenantSettings?.signature_type || "click");
  const [saving, setSaving] = useState(false);

  // Playground state (independent from config)
  const [playgroundType, setPlaygroundType] = useState<"click" | "facial" | "draw">("click");
  const [playgroundStep, setPlaygroundStep] = useState<"termo" | "assinatura" | "confirmacao">("termo");

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const handleSaveSignatureType = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await updateTenant(tenant.id, {
        settings: { ...tenantSettings, signature_type: signatureType },
      });
      await refetch();
      toast({ title: "Tipo de assinatura salvo!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetPlayground = () => setPlaygroundStep("termo");

  const isFacialFullscreen = playgroundStep === "assinatura" && playgroundType === "facial";
  const isLandscape = playgroundStep === "assinatura" && playgroundType === "draw";

  const renderPlaygroundContent = () => (
    <>
      {playgroundStep === "termo" && (
        <PlaygroundTermo onNext={() => setPlaygroundStep("assinatura")} />
      )}
      {playgroundStep === "assinatura" && (
        <PlaygroundAssinatura
          type={playgroundType}
          primaryColor={tenant?.primary_color || "#F97316"}
          onConfirm={() => setPlaygroundStep("confirmacao")}
          fullscreen={playgroundType === "facial"}
        />
      )}
      {playgroundStep === "confirmacao" && (
        <PlaygroundConfirmacao onReset={resetPlayground} />
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura Digital</h1>
        <p className="text-muted-foreground">Configure o tipo de assinatura e simule a experiência do cliente</p>
      </div>

      <Tabs defaultValue="configuracao">
        <TabsList>
          <TabsTrigger value="configuracao">Configuração</TabsTrigger>
          <TabsTrigger value="playground">Playground</TabsTrigger>
        </TabsList>

        {/* ======= ABA CONFIGURAÇÃO ======= */}
        <TabsContent value="configuracao">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle>Tipo de Assinatura</CardTitle>
                  <CardDescription>Escolha o tipo de validação para assinatura de acordos no portal</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={signatureType} onValueChange={setSignatureType}>
                <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="click" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">Aceite por Click</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      O cliente marca uma caixa confirmando que leu e aceita os termos. Registra IP e navegador.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="facial" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">Reconhecimento Facial</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Captura fotos do cliente seguindo instruções (olhar para frente, virar, sorrir). Armazena as imagens como prova.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="draw" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <PenTool className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">Assinatura na Tela</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      O cliente desenha sua assinatura com o dedo ou caneta na tela do dispositivo. Gera imagem PNG como prova.
                    </p>
                  </div>
                </label>
              </RadioGroup>

              <Button disabled={saving} onClick={handleSaveSignatureType}>
                {saving ? "Salvando..." : "Salvar tipo de assinatura"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= ABA PLAYGROUND ======= */}
        <TabsContent value="playground">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Simulador Mobile</span>
                <Button variant="ghost" size="sm" onClick={resetPlayground}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {(["click", "facial", "draw"] as const).map((type) => {
                  const labels: Record<string, string> = { click: "Aceite Digital", facial: "Reconhecimento Facial", draw: "Assinatura na Tela" };
                  const icons: Record<string, React.ReactNode> = {
                    click: <MousePointerClick className="w-3 h-3" />,
                    facial: <Camera className="w-3 h-3" />,
                    draw: <PenTool className="w-3 h-3" />,
                  };
                  const isActive = playgroundType === type;
                  return (
                    <Badge
                      key={type}
                      variant={isActive ? "default" : "outline"}
                      className={`cursor-pointer gap-1 ${isActive ? "" : "opacity-50"}`}
                      onClick={() => {
                        if (isActive) return;
                        setPlaygroundType(type);
                        resetPlayground();
                      }}
                    >
                      {icons[type]}
                      {labels[type]}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Mobile or Desktop rendering */}
            {isMobile ? (
              /* On real mobile: no phone frame, render content directly */
              <div className="w-full min-h-[500px] bg-background rounded-xl overflow-hidden border relative">
                <div className={`${isFacialFullscreen ? "absolute inset-0" : "p-3"} h-full`}>
                  {renderPlaygroundContent()}
                </div>
              </div>
            ) : (
              /* Desktop: iPhone frame */
              <div className={`relative w-[320px] bg-foreground/90 rounded-[3rem] p-3 shadow-2xl transition-all duration-500 ease-in-out ${isLandscape ? "rotate-90 scale-90" : "rotate-0"}`}>
                <div className="relative bg-background rounded-[2.2rem] overflow-hidden flex flex-col" style={{ height: 640 }}>
                  {/* Status Bar */}
                  <div className="h-12 bg-foreground/5 flex items-center justify-between px-8 pt-2 shrink-0">
                    <span className="text-[11px] font-semibold text-foreground/70">18:28</span>
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[90px] h-[25px] bg-foreground/90 rounded-full" />
                    <div className="flex items-center gap-1">
                      <div className="flex gap-[2px]">
                        <div className="w-[3px] h-[6px] bg-foreground/50 rounded-sm" />
                        <div className="w-[3px] h-[8px] bg-foreground/50 rounded-sm" />
                        <div className="w-[3px] h-[10px] bg-foreground/50 rounded-sm" />
                        <div className="w-[3px] h-[12px] bg-foreground/70 rounded-sm" />
                      </div>
                      <svg className="w-4 h-4 text-foreground/60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C7.46 3 3.34 4.78.29 7.67l1.41 1.41C4.28 6.55 7.93 5 12 5s7.72 1.55 10.29 4.08l1.41-1.41C20.66 4.78 16.54 3 12 3zm0 4c-3.33 0-6.35 1.37-8.54 3.57l1.41 1.41C6.73 10.12 9.24 9 12 9s5.27 1.12 7.13 2.98l1.41-1.41C18.35 8.37 15.33 7 12 7zm0 4a7.46 7.46 0 0 0-5.25 2.15l1.42 1.42A5.49 5.49 0 0 1 12 13c1.52 0 2.9.62 3.83 1.57l1.42-1.42A7.46 7.46 0 0 0 12 11zm0 4c-1.1 0-2.1.45-2.83 1.17L12 19l2.83-2.83A3.98 3.98 0 0 0 12 15z"/></svg>
                      <svg className="w-5 h-5 text-foreground/60" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`flex-1 overflow-y-auto relative ${isFacialFullscreen ? "" : "p-3"}`}>
                    {renderPlaygroundContent()}
                  </div>

                  {/* Home Indicator */}
                  {!isFacialFullscreen && (
                    <div className="h-6 flex items-center justify-center shrink-0">
                      <div className="w-32 h-1 bg-foreground/30 rounded-full" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ======================== Playground Sub-Components ======================== */

const PlaygroundTermo = ({ onNext }: { onNext: () => void }) => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Termo do Acordo</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Eu, <strong className="text-foreground">{MOCK_AGREEMENT.client_name}</strong>, declaro que estou ciente e de acordo com os seguintes termos:
        </p>
        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Credor</span>
            <span className="font-medium text-foreground">{MOCK_AGREEMENT.credor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor original</span>
            <span className="text-foreground line-through">{formatCurrency(MOCK_AGREEMENT.original_total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor acordado</span>
            <span className="font-bold text-foreground">{formatCurrency(MOCK_AGREEMENT.proposed_total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Desconto</span>
            <span className="font-medium text-primary">{MOCK_AGREEMENT.discount_percent}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Parcelas</span>
            <span className="text-foreground">{MOCK_AGREEMENT.new_installments}x de {formatCurrency(MOCK_AGREEMENT.new_installment_value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">1º vencimento</span>
            <span className="text-foreground">{new Date(MOCK_AGREEMENT.first_due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ao assinar digitalmente, você concorda com todas as condições acima. Esta assinatura tem validade jurídica conforme Art. 10, §2º da MP nº 2.200-2/2001.
        </p>
      </CardContent>
    </Card>
    <Button className="w-full" onClick={onNext}>
      Li e concordo — Prosseguir para assinatura
    </Button>
  </div>
);

const PlaygroundAssinatura = ({
  type,
  primaryColor,
  onConfirm,
  fullscreen = false,
}: {
  type: string;
  primaryColor: string;
  onConfirm: () => void;
  fullscreen?: boolean;
}) => {
  if (type === "facial" && fullscreen) {
    return (
      <SignatureFacial primaryColor={primaryColor} onConfirm={onConfirm} fullscreen />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Assinatura Digital</CardTitle>
            <Badge variant="outline" className="text-xs">Demo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {type === "click" && (
            <SignatureClick primaryColor={primaryColor} onConfirm={onConfirm} />
          )}
          {type === "facial" && (
            <SignatureFacial primaryColor={primaryColor} onConfirm={onConfirm} />
          )}
          {type === "draw" && (
            <SignatureDraw primaryColor={primaryColor} onConfirm={onConfirm} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const PlaygroundConfirmacao = ({ onReset }: { onReset: () => void }) => (
  <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
      <CheckCircle2 className="w-10 h-10 text-primary" />
    </div>
    <h3 className="text-lg font-bold text-foreground">Acordo Assinado!</h3>
    <p className="text-sm text-muted-foreground max-w-xs">
      A assinatura digital foi registrada com sucesso. O cliente agora pode prosseguir para o pagamento.
    </p>
    <Badge variant="secondary">Simulação concluída</Badge>
    <Button variant="outline" onClick={onReset} className="mt-4">
      <RotateCcw className="w-4 h-4 mr-2" />
      Reiniciar Simulação
    </Button>
  </div>
);

export default SignsPage;
