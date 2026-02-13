import { useAuth } from "@/hooks/useAuth";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";
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
    <div className="space-y-4">
      {channel === "telefonia" ? <ThreeCPlusPanel /> : <WhatsAppTab />}
    </div>
  );
};

export default ContactCenterPage;
