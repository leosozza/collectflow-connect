import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface ReportHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  onBack: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  disableExport?: boolean;
}

export const ReportHeader = ({
  title,
  description,
  icon: Icon,
  onBack,
  onExportExcel,
  onExportPdf,
  disableExport,
}: ReportHeaderProps) => (
  <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
    <div className="flex items-start gap-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="mt-0.5">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para a Central
      </Button>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="rounded-xl p-2.5 bg-primary/10 text-primary shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
    </div>
    <div className="flex gap-2">
      {onExportExcel && (
        <Button variant="outline" size="sm" onClick={onExportExcel} disabled={disableExport}>
          <Download className="w-4 h-4 mr-1" /> Excel
        </Button>
      )}
      {onExportPdf && (
        <Button variant="outline" size="sm" onClick={onExportPdf} disabled={disableExport}>
          <Printer className="w-4 h-4 mr-1" /> PDF
        </Button>
      )}
    </div>
  </div>
);
