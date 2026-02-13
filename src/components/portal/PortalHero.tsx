import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Percent, CreditCard, Handshake, ArrowRight } from "lucide-react";
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

  const color = primaryColor || "#2563eb";

  const benefits = [
    { icon: Percent, title: "Descontos exclusivos", desc: "Até 90% de desconto para pagamento à vista" },
    { icon: CreditCard, title: "Parcelamento facilitado", desc: "Divida em até 12x no cartão ou PIX" },
    { icon: Handshake, title: "Negocie online", desc: "Faça sua proposta sem sair de casa" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section
        className="rounded-3xl p-8 md:p-16 text-center relative overflow-hidden"
        style={{
          background: `linear-gradient(145deg, #0f172a 0%, #1e293b 50%, ${color}22 100%)`,
        }}
      >
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-2"
            style={{ backgroundColor: `${color}20`, color: color }}
          >
            <Handshake className="w-4 h-4" />
            Negocie agora
          </div>

          <h1 className="text-3xl md:text-5xl font-bold leading-tight text-white">
            {heroTitle}
          </h1>
          <p className="text-lg text-slate-300 max-w-lg mx-auto">
            {heroSubtitle}
          </p>

          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
            <Input
              placeholder="Digite seu CPF"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              maxLength={14}
              className="bg-white/10 backdrop-blur-sm text-white border-white/20 h-12 text-base placeholder:text-slate-400 focus-visible:ring-white/30"
            />
            <Button
              type="submit"
              disabled={loading || cpf.replace(/\D/g, "").length !== 11}
              size="lg"
              className="h-12 px-6 font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              <Search className="w-4 h-4 mr-2" />
              {loading ? "Buscando..." : "Consultar"}
            </Button>
          </form>
        </div>

        {/* Decorative elements */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: color }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: color }}
        />
      </section>

      {/* Benefits */}
      <section className="grid md:grid-cols-3 gap-6">
        {benefits.map((b, i) => (
          <Card key={i} className="text-center border-0 shadow-md hover:shadow-lg transition-shadow bg-card">
            <CardContent className="pt-8 pb-6 space-y-4">
              <div
                className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                style={{ backgroundColor: `${color}15`, color: color }}
              >
                <b.icon className="w-7 h-7" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
};

export default PortalHero;
