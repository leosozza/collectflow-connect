import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

const FIXED_PROFILES = [
  { key: "ocasional", nome: "Ocasional", descricao: "Atrasou, mas paga", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  { key: "recorrente", nome: "Recorrente", descricao: "Sempre atrasa", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  { key: "resistente", nome: "Resistente", descricao: "Não quer pagar", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  { key: "insatisfeito", nome: "Insatisfeito", descricao: "Não paga por insatisfação", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
];

const TipoDevedorList = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Perfis fixos de devedor — apenas 1 perfil por cliente. O sistema sugere automaticamente com base no comportamento.
        </span>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Perfil</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center">Impacto no Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FIXED_PROFILES.map((p) => (
              <TableRow key={p.key}>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`${p.color} border-0 cursor-help`}>
                        {p.nome}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{p.descricao}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.descricao}</TableCell>
                <TableCell className="text-center font-mono text-sm">
                  {p.key === "ocasional" && <span className="text-emerald-600">+20</span>}
                  {p.key === "recorrente" && <span className="text-amber-600">+5</span>}
                  {p.key === "resistente" && <span className="text-red-600">-25</span>}
                  {p.key === "insatisfeito" && <span className="text-orange-600">-10</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TipoDevedorList;
