import { CRMOpportunity } from "@/services/crmService";
import LeadScoreBadge from "./LeadScoreBadge";
import { Calendar, DollarSign, User } from "lucide-react";

interface OpportunityCardProps {
  opportunity: CRMOpportunity;
  onClick?: () => void;
}

const OpportunityCard = ({ opportunity, onClick }: OpportunityCardProps) => {
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
      style={{ borderLeftWidth: 4, borderLeftColor: opportunity.stage?.color || "#3b82f6" }}
    >
      <p className="font-medium text-sm text-foreground truncate">{opportunity.title}</p>

      {opportunity.lead && (
        <p className="text-xs text-muted-foreground truncate">
          {opportunity.lead.name}
          {opportunity.lead.company_name && ` • ${opportunity.lead.company_name}`}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[80px]">{opportunity.responsible?.full_name || "—"}</span>
        </div>
        {opportunity.lead && <LeadScoreBadge score={opportunity.lead.lead_score} showScore={false} />}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-emerald-600 font-medium">
          <DollarSign className="w-3 h-3" />
          {(opportunity.estimated_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
        {opportunity.expected_close_date && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {new Date(opportunity.expected_close_date).toLocaleDateString("pt-BR")}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpportunityCard;
