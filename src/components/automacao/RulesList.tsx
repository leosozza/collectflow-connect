import { CollectionRule } from "@/services/automacaoService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";

interface RulesListProps {
  rules: CollectionRule[];
  onEdit: (rule: CollectionRule) => void;
  onToggle: (rule: CollectionRule) => void;
  onDelete: (rule: CollectionRule) => void;
}

const channelLabel: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  both: "Ambos",
};

const RulesList = ({ rules, onEdit, onToggle, onDelete }: RulesListProps) => {
  const daysLabel = (d: number) => {
    if (d < 0) return `${Math.abs(d)}d antes`;
    if (d === 0) return "No dia";
    return `${d}d após`;
  };

  if (rules.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma regra configurada. Crie sua primeira regra de cobrança.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Disparo</TableHead>
          <TableHead>Ativo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="font-medium">{rule.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{channelLabel[rule.channel] || rule.channel}</Badge>
            </TableCell>
            <TableCell>{daysLabel(rule.days_offset)}</TableCell>
            <TableCell>
              <Switch checked={rule.is_active} onCheckedChange={() => onToggle(rule)} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(rule)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(rule)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default RulesList;
