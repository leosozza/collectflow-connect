import { usePermissions } from "@/hooks/usePermissions";
import { MessageSquare, Bot, Tag, Zap, Megaphone, Settings } from "lucide-react";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";
import WhatsAppChatLayout from "@/components/contact-center/whatsapp/WhatsAppChatLayout";
import AIAgentTab from "@/components/contact-center/whatsapp/AIAgentTab";
import TagsManagementTab from "@/components/contact-center/whatsapp/TagsManagementTab";
import QuickRepliesTab from "@/components/contact-center/whatsapp/QuickRepliesTab";
import CampaignManagementTab from "@/components/contact-center/whatsapp/CampaignManagementTab";
import WhatsAppSettingsTab from "@/components/contact-center/whatsapp/WhatsAppSettingsTab";
import { useUrlState } from "@/hooks/useUrlState";
import { cn } from "@/lib/utils";

interface ContactCenterPageProps {
  channel: "telefonia" | "whatsapp";
}

const ContactCenterPage = ({ channel }: ContactCenterPageProps) => {
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useUrlState("tab", "conversas");

  if (channel === "telefonia") {
    return (
      <div className="space-y-4">
        <ThreeCPlusPanel />
      </div>
    );
  }

  const tabs = [
    { id: "conversas", label: "Conversas", icon: MessageSquare, adminOnly: false, show: true },
    { id: "campanhas", label: "Campanhas", icon: Megaphone, adminOnly: false, show: permissions.canViewCampanhasWhatsApp },
    { id: "agente", label: "Agente IA", icon: Bot, adminOnly: true, show: permissions.canManageContactCenterAdmin },
    { id: "etiquetas", label: "Etiquetas", icon: Tag, adminOnly: true, show: permissions.canManageContactCenterAdmin },
    { id: "respostas", label: "Respostas Rápidas", icon: Zap, adminOnly: true, show: permissions.canManageContactCenterAdmin },
    { id: "personalizacao", label: "Personalização", icon: Settings, adminOnly: true, show: permissions.canManageContactCenterAdmin },
  ].filter((tab) => tab.show);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Horizontal tab navigation */}
      {tabs.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "conversas" && <WhatsAppChatLayout />}
        {activeTab === "campanhas" && permissions.canViewCampanhasWhatsApp && (
          <CampaignManagementTab />
        )}
        {activeTab === "agente" && permissions.canManageContactCenterAdmin && (
          <div className="h-full overflow-auto">
            <AIAgentTab />
          </div>
        )}
        {activeTab === "etiquetas" && permissions.canManageContactCenterAdmin && (
          <div className="h-full overflow-auto">
            <TagsManagementTab />
          </div>
        )}
        {activeTab === "respostas" && permissions.canManageContactCenterAdmin && (
          <div className="h-full overflow-auto">
            <QuickRepliesTab />
          </div>
        )}
        {activeTab === "personalizacao" && permissions.canManageContactCenterAdmin && (
          <div className="h-full overflow-auto">
            <WhatsAppSettingsTab />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactCenterPage;
