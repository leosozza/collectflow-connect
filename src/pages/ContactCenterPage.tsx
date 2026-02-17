import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Bot, Tag, Zap } from "lucide-react";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";
import WhatsAppChatLayout from "@/components/contact-center/whatsapp/WhatsAppChatLayout";
import AIAgentTab from "@/components/contact-center/whatsapp/AIAgentTab";
import TagsManagementTab from "@/components/contact-center/whatsapp/TagsManagementTab";
import QuickRepliesTab from "@/components/contact-center/whatsapp/QuickRepliesTab";

interface ContactCenterPageProps {
  channel: "telefonia" | "whatsapp";
}

const ContactCenterPage = ({ channel }: ContactCenterPageProps) => {
  const { profile } = useAuth();
  const { isTenantAdmin } = useTenant();

  if (channel === "telefonia" && profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (channel === "telefonia") {
    return (
      <div className="space-y-4">
        <ThreeCPlusPanel />
      </div>
    );
  }

  // WhatsApp channel with sub-tabs
  return (
    <Tabs defaultValue="conversas" className="h-full flex flex-col">
      <TabsList className="mx-4 mt-2 w-fit">
        <TabsTrigger value="conversas" className="gap-1.5">
          <MessageSquare className="w-4 h-4" /> Conversas
        </TabsTrigger>
        {isTenantAdmin && (
          <>
            <TabsTrigger value="agente" className="gap-1.5">
              <Bot className="w-4 h-4" /> Agente Inteligente
            </TabsTrigger>
            <TabsTrigger value="etiquetas" className="gap-1.5">
              <Tag className="w-4 h-4" /> Etiquetas
            </TabsTrigger>
            <TabsTrigger value="respostas" className="gap-1.5">
              <Zap className="w-4 h-4" /> Respostas Rápidas
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="conversas" className="flex-1 mt-0">
        <WhatsAppChatLayout />
      </TabsContent>

      {isTenantAdmin && (
        <>
          <TabsContent value="agente" className="flex-1 mt-0 overflow-auto">
            <AIAgentTab />
          </TabsContent>
          <TabsContent value="etiquetas" className="flex-1 mt-0 overflow-auto">
            <TagsManagementTab />
          </TabsContent>
          <TabsContent value="respostas" className="flex-1 mt-0 overflow-auto">
            <QuickRepliesTab />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
};

export default ContactCenterPage;
