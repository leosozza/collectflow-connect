import { useAuth } from "@/hooks/useAuth";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";
import WhatsAppChatLayout from "@/components/contact-center/whatsapp/WhatsAppChatLayout";

interface ContactCenterPageProps {
  channel: "telefonia" | "whatsapp";
}

const ContactCenterPage = ({ channel }: ContactCenterPageProps) => {
  const { profile } = useAuth();

  // Telefonia remains admin-only; WhatsApp is open to all authenticated users
  if (channel === "telefonia" && profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {channel === "telefonia" ? <ThreeCPlusPanel /> : <WhatsAppChatLayout />}
    </div>
  );
};

export default ContactCenterPage;
