import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { MessageSquare, Bot, Tag, Zap } from "lucide-react";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";
import WhatsAppChatLayout from "@/components/contact-center/whatsapp/WhatsAppChatLayout";
import AIAgentTab from "@/components/contact-center/whatsapp/AIAgentTab";
import TagsManagementTab from "@/components/contact-center/whatsapp/TagsManagementTab";
import QuickRepliesTab from "@/components/contact-center/whatsapp/QuickRepliesTab";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ContactCenterPageProps {
  channel: "telefonia" | "whatsapp";
}

const ContactCenterPage = ({ channel }: ContactCenterPageProps) => {
  const { profile } = useAuth();
  const { isTenantAdmin } = useTenant();
  const [activeTab, setActiveTab] = useState("conversas");

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

  const tabs = [
    { id: "conversas", label: "Conversas", icon: MessageSquare, adminOnly: false },
    { id: "agente", label: "Agente IA", icon: Bot, adminOnly: true },
    { id: "etiquetas", label: "Etiquetas", icon: Tag, adminOnly: true },
    { id: "respostas", label: "Respostas Rápidas", icon: Zap, adminOnly: true },
  ].filter((tab) => !tab.adminOnly || isTenantAdmin);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Lateral tab navigation */}
      <div className="w-[52px] shrink-0 flex flex-col items-center gap-1 py-3 bg-secondary border-r border-sidebar-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "conversas" && <WhatsAppChatLayout />}
        {activeTab === "agente" && isTenantAdmin && (
          <div className="h-full overflow-auto">
            <AIAgentTab />
          </div>
        )}
        {activeTab === "etiquetas" && isTenantAdmin && (
          <div className="h-full overflow-auto">
            <TagsManagementTab />
          </div>
        )}
        {activeTab === "respostas" && isTenantAdmin && (
          <div className="h-full overflow-auto">
            <QuickRepliesTab />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactCenterPage;
