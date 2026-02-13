import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, Phone, MessageCircle } from "lucide-react";
import TelefoniaTab from "@/components/contact-center/TelefoniaTab";
import WhatsAppTab from "@/components/contact-center/WhatsAppTab";

const ContactCenterPage = () => {
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
          <h1 className="text-2xl font-bold text-foreground">Contact Center</h1>
          <p className="text-muted-foreground">Gerencie telefonia e canais de comunicação</p>
        </div>
      </div>

      <Tabs defaultValue="telefonia">
        <TabsList>
          <TabsTrigger value="telefonia" className="gap-2">
            <Phone className="w-4 h-4" />
            Telefonia
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </TabsTrigger>
        </TabsList>
        <TabsContent value="telefonia">
          <TelefoniaTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContactCenterPage;
