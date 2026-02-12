import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Notification, markNotificationRead } from "@/services/notificationService";

interface AgreementCelebrationProps {
  notification: Notification | null;
  onDismiss: () => void;
}

const AgreementCelebration = ({ notification, onDismiss }: AgreementCelebrationProps) => {
  const handleClose = async () => {
    if (notification) {
      await markNotificationRead(notification.id).catch(() => {});
    }
    onDismiss();
  };

  return (
    <Dialog open={!!notification} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", delay: 0.15, stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Trophy className="w-8 h-8 text-primary" />
              </motion.div>

              <DialogHeader className="items-center">
                <DialogTitle className="text-xl">
                  🎉 Parabéns! Novo acordo realizado!
                </DialogTitle>
                <DialogDescription className="text-base mt-2">
                  {notification.message}
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="w-full sm:justify-center">
                <Button onClick={handleClose}>Fechar</Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default AgreementCelebration;
