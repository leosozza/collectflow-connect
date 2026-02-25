import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import SupportPanel from "./SupportPanel";

const SupportFloatingButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <LifeBuoy className="w-6 h-6" />
      </Button>
      <SupportPanel open={open} onOpenChange={setOpen} />
    </>
  );
};

export default SupportFloatingButton;
