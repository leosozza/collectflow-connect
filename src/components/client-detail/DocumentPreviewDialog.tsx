import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2 } from "lucide-react";
import { useState } from "react";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  label: string;
  onDownloadPdf: () => Promise<void>;
}

const DocumentPreviewDialog = ({
  open,
  onOpenChange,
  html,
  label,
  onDownloadPdf,
}: DocumentPreviewDialogProps) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownloadPdf();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Baixar PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 p-6 flex justify-center">
          <div
            className="bg-white shadow-lg border border-border/50 w-full max-w-[210mm] min-h-[297mm] p-[25mm_20mm] font-serif text-[13px] leading-[1.7] text-[#1a1a1a]"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewDialog;
