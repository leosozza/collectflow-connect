import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SignatureClick from "./SignatureClick";
import SignatureFacial from "./SignatureFacial";
import SignatureDraw from "./SignatureDraw";

interface SignatureStepProps {
  checkoutToken: string;
  signatureType: "click" | "facial" | "draw";
  primaryColor?: string;
  onSigned: () => void;
  agreement: {
    id: string;
    client_name: string;
    credor: string;
    proposed_total: number;
    new_installments: number;
    new_installment_value: number;
    first_due_date: string;
  };
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-checkout`;

const SignatureStep = ({ checkoutToken, signatureType, primaryColor = "#F97316", onSigned, agreement }: SignatureStepProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadySigned, setAlreadySigned] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check-signature", checkout_token: checkoutToken }),
        });
        const data = await res.json();
        if (data.signed) {
          setAlreadySigned(true);
          onSigned();
        }
      } catch {
        // proceed without check
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [checkoutToken, onSigned]);

  const saveSignature = async (type: string, signatureData?: string, metadata?: Record<string, any>) => {
    setLoading(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-signature",
          checkout_token: checkoutToken,
          signature_type: type,
          signature_data: signatureData || null,
          metadata: metadata || {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Assinatura registrada!", description: "Seu aceite foi salvo com sucesso." });
      onSigned();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <Card className="border-green-200">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-2" />
          <p className="font-medium text-foreground">Acordo já assinado</p>
          <p className="text-sm text-muted-foreground">Sua assinatura digital foi registrada com sucesso.</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      {/* Agreement Terms */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
            <CardTitle className="text-lg">Termo do Acordo</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Eu, <strong className="text-foreground">{agreement.client_name}</strong>, declaro que estou ciente e de acordo 
            com os seguintes termos de negociação:
          </p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credor</span>
              <span className="font-medium text-foreground">{agreement.credor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor acordado</span>
              <span className="font-bold text-foreground">{formatCurrency(agreement.proposed_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcelas</span>
              <span className="text-foreground">{agreement.new_installments}x de {formatCurrency(agreement.new_installment_value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primeiro vencimento</span>
              <span className="text-foreground">{new Date(agreement.first_due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao assinar digitalmente, você concorda com todas as condições acima. Esta assinatura tem validade jurídica 
            conforme Art. 10, §2º da Medida Provisória nº 2.200-2/2001.
          </p>
        </CardContent>
      </Card>

      {/* Signature Component */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Assinatura Digital</CardTitle>
            <Badge variant="outline" className="text-xs">
              {signatureType === "click" ? "Aceite Digital" : signatureType === "facial" ? "Reconhecimento Facial" : "Assinatura Manual"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {signatureType === "click" && (
            <SignatureClick
              primaryColor={primaryColor}
              loading={loading}
              onConfirm={() => saveSignature("click")}
            />
          )}
          {signatureType === "facial" && (
            <SignatureFacial
              primaryColor={primaryColor}
              loading={loading}
              onConfirm={(photos) => saveSignature("facial", undefined, { photos })}
            />
          )}
          {signatureType === "draw" && (
            <SignatureDraw
              primaryColor={primaryColor}
              loading={loading}
              onConfirm={(imageData) => saveSignature("draw", imageData)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SignatureStep;
