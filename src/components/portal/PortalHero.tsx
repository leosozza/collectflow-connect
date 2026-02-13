import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Percent, CreditCard, Handshake } from "lucide-react";
import { formatCPF } from "@/lib/formatters";

interface PortalHeroProps {
  tenantName?: string;
  primaryColor?: string;
  settings?: Record<string, unknown>;
  onSearch: (cpf: string) => void;
  loading?: boolean;
}

const PortalHero = ({ tenantName, primaryColor, settings, onSearch, loading }: PortalHeroProps) => {
  const [cpf, setCpf] = useState("");

  const heroTitle = (settings?.portal_hero_title as string) || `Negocie suas dívidas com ${tenantName || "a gente"}`;
  const heroSubtitle = (settings?.portal_hero_subtitle as string) || "Consulte suas pendências e encontre as melhores condições de pagamento. Rápido, fácil e seguro.";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) onSearch(clean);
  };

  const benefits = [
    { icon: Percent, title: "Descontos exclusivos", desc: "Até 90% de desconto para pagamento à vista" },
    { icon: CreditCard, title: "Parcelamento facilitado", desc: "Divida em até 12x no cartão ou PIX" },
    { icon: Handshake, title: "Negocie online", desc: "Faça sua proposta sem sair de casa" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section
        className="rounded-2xl p-8 md:p-16 text-center text-primary-foreground relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor || "hsl(24,95%,53%)"} 0%, ${primaryColor || "hsl(24,95%,53%)"}cc 100%)`,
        }}
      >
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{heroTitle}</h1>
          <p className="text-lg opacity-90">{heroSubtitle}</p>

          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <Input
              placeholder="Digite seu CPF"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              maxLength={14}
              className="bg-card/95 text-foreground border-0 h-12 text-base"
            />
            <Button type="submit" disabled={loading || cpf.replace(/\D/g, "").length !== 11} size="lg" variant="secondary" className="h-12">
              <Search className="w-4 h-4 mr-2" />
              {loading ? "Buscando..." : "Consultar"}
            </Button>
          </form>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary-foreground/10" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-primary-foreground/10" />
      </section>

      {/* Benefits */}
      <section className="grid md:grid-cols-3 gap-6">
        {benefits.map((b, i) => (
          <Card key={i} className="text-center">
            <CardContent className="pt-6 space-y-3">
              <div
                className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-primary-foreground"
                style={{ backgroundColor: primaryColor || "hsl(24,95%,53%)" }}
              >
                <b.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-foreground">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
};

export default PortalHero;
