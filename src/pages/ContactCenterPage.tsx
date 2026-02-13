import { useAuth } from "@/hooks/useAuth";
import { Headphones, Phone, MessageCircle } from "lucide-react";
import TelefoniaTab from "@/components/contact-center/TelefoniaTab";
import WhatsAppTab from "@/components/contact-center/WhatsAppTab";

interface ContactCenterPageProps {
  channel: "telefonia" | "whatsapp";
}

const ContactCenterPage = ({ channel }: ContactCenterPageProps) => {
  const { profile } = useAuth();

  if (profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Headphones className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {channel === "telefonia" ? "Telefonia" : "WhatsApp"}
          </h1>
          <p className="text-muted-foreground">
            {channel === "telefonia"
              ? "Gerencie campanhas e discagem automática"
              : "Gerencie comunicações via WhatsApp"}
          </p>
        </div>
      </div>

      {channel === "telefonia" ? <TelefoniaTab /> : <WhatsAppTab />}
    </div>
  );
};

export default ContactCenterPage;
