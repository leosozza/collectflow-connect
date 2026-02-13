import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle2 } from "lucide-react";

interface SignatureClickProps {
  onConfirm: () => void;
  loading?: boolean;
  primaryColor?: string;
}

const SignatureClick = ({ onConfirm, loading, primaryColor = "#F97316" }: SignatureClickProps) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-xl border bg-muted/30">
        <Shield className="w-5 h-5 mt-0.5 shrink-0" style={{ color: primaryColor }} />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Aceite Digital</p>
          <p>
            Ao marcar a caixa abaixo e confirmar, você declara que leu e concorda com todos os termos 
            deste acordo de negociação de dívida, incluindo valores, parcelas e condições de pagamento.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border hover:bg-muted/20 transition-colors">
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground leading-relaxed">
          Li e aceito integralmente os termos do acordo acima. Reconheço que esta ação tem validade 
          jurídica como aceite digital e que meus dados de IP e navegador serão registrados.
        </span>
      </label>

      <Button
        className="w-full h-12 text-base"
        style={{ backgroundColor: primaryColor }}
        disabled={!accepted || loading}
        onClick={onConfirm}
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        {loading ? "Registrando assinatura..." : "Confirmar e Assinar"}
      </Button>
    </div>
  );
};

export default SignatureClick;
