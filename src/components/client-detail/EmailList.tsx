import { Mail, ChevronDown } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface EmailListProps {
  emails: string[];
}

export const EmailList = ({ emails }: EmailListProps) => {
  const unique = Array.from(new Set(emails.filter((e) => !!e && e.trim().length > 0)));
  const first = unique[0];
  const extra = unique.length - 1;

  return (
    <div className="w-full">
      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Email</p>

      <HoverCard openDelay={120} closeDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            disabled={unique.length === 0}
            className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-border/60 bg-card hover:bg-muted/40 transition-colors group disabled:cursor-default disabled:hover:bg-card max-w-full"
          >
            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {unique.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhum cadastrado</span>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground truncate">{first}</span>
                {extra > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">+{extra}</span>
                )}
              </>
            )}
            {unique.length > 1 && (
              <ChevronDown className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
            )}
          </button>
        </HoverCardTrigger>

        {unique.length > 1 && (
          <HoverCardContent align="start" className="w-[360px] p-2">
            <div className="space-y-1">
              {unique.map((email) => (
                <div
                  key={email}
                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground break-all">{email}</span>
                </div>
              ))}
            </div>
          </HoverCardContent>
        )}
      </HoverCard>
    </div>
  );
};

export default EmailList;
