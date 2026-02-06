import { useState, useRef } from "react";
import { parseSpreadsheet, ImportedRow } from "@/services/importService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: ImportedRow[]) => void;
  submitting: boolean;
}

const ImportDialog = ({ open, onClose, onConfirm, submitting }: ImportDialogProps) => {
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.length === 0) {
        setError("Nenhum registro válido encontrado na planilha. Verifique o formato.");
        setRows([]);
      } else {
        setRows(parsed);
      }
    } catch {
      setError("Erro ao ler a planilha. Verifique se o arquivo está no formato correto.");
      setRows([]);
    }

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    setRows([]);
    setError(null);
    setFileName(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Planilha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Upload area */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
            />
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {fileName ? (
                <span className="text-foreground font-medium">{fileName}</span>
              ) : (
                "Clique para selecionar um arquivo .xlsx ou .csv"
              )}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4" />
                {rows.length} registros encontrados
              </div>

              <ScrollArea className="flex-1 border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Credor</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-center">Parcela</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{row.credor}</TableCell>
                        <TableCell className="font-medium">{row.nome_completo}</TableCell>
                        <TableCell className="text-muted-foreground">{row.cpf}</TableCell>
                        <TableCell className="text-center">{row.numero_parcela}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.valor_parcela)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.valor_pago)}</TableCell>
                        <TableCell>{row.data_vencimento ? formatDate(row.data_vencimento) : "-"}</TableCell>
                        <TableCell className="capitalize">{row.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 50 de {rows.length} registros
                  </p>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(rows)}
            disabled={rows.length === 0 || submitting}
          >
            {submitting ? "Importando..." : `Importar ${rows.length} registros`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
