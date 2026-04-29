import { Inbox } from "lucide-react";

export const EmptyBlock = ({ message = "Sem dados no período selecionado" }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
    <Inbox className="w-6 h-6 opacity-50" />
    <p className="text-xs">{message}</p>
  </div>
);
