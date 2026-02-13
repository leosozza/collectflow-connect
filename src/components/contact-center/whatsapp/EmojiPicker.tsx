import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

const EMOJI_CATEGORIES = [
  {
    name: "Rostos",
    emojis: ["😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😉", "🤔", "😅", "😎", "🥺", "😢", "😭", "😤", "🤗", "🙏", "👍", "👎", "👋"],
  },
  {
    name: "Gestos",
    emojis: ["✅", "❌", "⭐", "🔥", "💯", "❤️", "💰", "📌", "📎", "📞", "💬", "🎯", "⏰", "📅", "✍️", "🤝", "💪", "🎉", "⚠️", "🔔"],
  },
  {
    name: "Objetos",
    emojis: ["📄", "📊", "💳", "🏦", "📱", "💻", "📧", "📝", "🗂️", "📁", "🔗", "🔒", "🔑", "🏠", "🚗", "✈️", "🎁", "💎", "🛒", "📦"],
  },
];

const EmojiPicker = ({ onSelect, disabled }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={disabled} title="Emojis">
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" side="top" align="start">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.name} className="mb-2">
            <div className="text-[10px] font-medium text-muted-foreground mb-1 px-1">{cat.name}</div>
            <div className="grid grid-cols-10 gap-0.5">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelect(emoji)}
                  className="w-6 h-6 flex items-center justify-center text-base hover:bg-accent rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
