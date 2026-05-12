import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, AlertCircle, Info, Sparkles } from "lucide-react";

interface IntegrationDetailLayoutProps {
  name: string;
  category: string;
  logoUrl?: string;
  fallbackIcon?: ReactNode;
  brandColor?: string; // tailwind bg class for logo wrapper
  description: string;
  status: "connected" | "test" | "not_configured" | "coming_soon";
  requirements?: { title: string; items: string[]; docsUrl?: string; docsLabel?: string };
  comingSoon?: { features: string[] };
  children?: ReactNode; // credentials block
  footer?: ReactNode; // optional extra (e.g. instances list)
}

const STATUS_META: Record<string, { label: string; cls: string; icon: ReactNode }> = {
  connected: {
    label: "Conectado",
    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  test: {
    label: "Configurado em teste",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    icon: <Info className="w-3.5 h-3.5" />,
  },
  not_configured: {
    label: "Não configurado",
    cls: "bg-muted text-muted-foreground border-border",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  coming_soon: {
    label: "Em breve",
    cls: "bg-primary/10 text-primary border-primary/30",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
};

const IntegrationDetailLayout = ({
  name,
  category,
  logoUrl,
  fallbackIcon,
  brandColor = "bg-muted",
  description,
  status,
  requirements,
  comingSoon,
  children,
  footer,
}: IntegrationDetailLayoutProps) => {
  const meta = STATUS_META[status];
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* HEADER */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 flex items-start gap-4">
          <div
            className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white border border-border/50`}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${name} logo`}
                className="w-full h-full object-contain p-1.5"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`w-full h-full ${brandColor} text-white flex items-center justify-center`}
              style={{ display: logoUrl ? "none" : "flex" }}
            >
              {fallbackIcon}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">{name}</h2>
              <Badge variant="outline" className={`gap-1 ${meta.cls}`}>
                {meta.icon}
                {meta.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
              {category}
            </p>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          </div>
        </CardContent>
      </Card>

      {/* COMING SOON */}
      {status === "coming_soon" && comingSoon && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4" />
              <h3 className="font-semibold text-sm">Disponível em breve</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Esta integração está em desenvolvimento. Quando liberada, você poderá:
            </p>
            <ul className="text-sm text-foreground space-y-1.5 pl-1">
              {comingSoon.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* REQUIREMENTS */}
      {requirements && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">{requirements.title}</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {requirements.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {requirements.docsUrl && (
              <a
                href={requirements.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {requirements.docsLabel || "Documentação oficial"}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* CREDENTIALS BLOCK */}
      {children}

      {/* FOOTER (optional) */}
      {footer}
    </div>
  );
};

export default IntegrationDetailLayout;
