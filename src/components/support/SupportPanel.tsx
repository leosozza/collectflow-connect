import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, BookOpen, CalendarDays } from "lucide-react";
import SupportChatTab from "./SupportChatTab";
import SupportGuidesTab from "./SupportGuidesTab";
import SupportScheduleTab from "./SupportScheduleTab";

interface SupportPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SupportPanel = ({ open, onOpenChange }: SupportPanelProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-lg">Central de Suporte</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="guias" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2 grid grid-cols-3">
            <TabsTrigger value="guias" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> Guias
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5 text-xs">
              <MessageCircle className="w-3.5 h-3.5" /> Chat
            </TabsTrigger>
            <TabsTrigger value="agendar" className="gap-1.5 text-xs">
              <CalendarDays className="w-3.5 h-3.5" /> Agendar
            </TabsTrigger>
          </TabsList>
          <TabsContent value="guias" className="flex-1 overflow-auto px-4 pb-4 mt-2">
            <SupportGuidesTab />
          </TabsContent>
          <TabsContent value="chat" className="flex-1 overflow-auto px-4 pb-4 mt-2">
            <SupportChatTab />
          </TabsContent>
          <TabsContent value="agendar" className="flex-1 overflow-auto px-4 pb-4 mt-2">
            <SupportScheduleTab />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default SupportPanel;
