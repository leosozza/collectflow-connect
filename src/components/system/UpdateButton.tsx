import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Botão pequeno e discreto ao lado do sininho.
 * - Faz polling no /index.html a cada 60s e compara um hash simples do HTML.
 * - Quando o hash muda (nova publicação), o botão começa a piscar.
 * - Ao clicar, limpa caches e força reload (equivalente a Ctrl+Shift+R).
 */
const POLL_INTERVAL_MS = 60_000;
// v2: chave nova força re-baseline para usuários que já tinham o hash antigo armazenado.
const STORAGE_KEY = "rivo-app-version-hash-v2";

const hashString = (str: string): string => {
  // FNV-1a 32-bit — leve e suficiente para detectar mudança no index.html
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
};

const fetchCurrentHash = async (): Promise<string | null> => {
  try {
    const resp = await fetch(`/index.html?_=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    // Mantém apenas as referências aos assets (mudam a cada build do Vite).
    const matches = text.match(/(?:src|href)="[^"]*\/assets\/[^"]+"/g);
    const signature = matches && matches.length ? matches.sort().join("|") : text;
    return hashString(signature);
  } catch {
    return null;
  }
};

const hardReload = async () => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }
  // Cache-buster na URL para forçar bypass do cache do navegador/CDN
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
  window.location.replace(url.toString());
};

const UpdateButton = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const baselineHashRef = useRef<string | null>(null);
  const toastShownRef = useRef(false);

  const check = useCallback(async () => {
    const current = await fetchCurrentHash();
    if (!current) return;

    if (!baselineHashRef.current) {
      const stored = (() => {
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
      })();
      if (stored && stored !== current) {
        // Já havia uma versão anterior conhecida e o servidor está em outra → há update
        baselineHashRef.current = stored;
        setHasUpdate(true);
        return;
      }
      baselineHashRef.current = current;
      try { localStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
      return;
    }

    if (current !== baselineHashRef.current) {
      setHasUpdate(true);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  const handleClick = useCallback(async () => {
    const current = await fetchCurrentHash();
    if (current) {
      try { localStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
    }
    await hardReload();
  }, []);

  // Toast único por sessão quando uma nova versão é detectada.
  useEffect(() => {
    if (!hasUpdate || toastShownRef.current) return;
    toastShownRef.current = true;
    toast("Nova versão disponível", {
      description: "Clique para atualizar agora",
      duration: Infinity,
      action: {
        label: "Atualizar",
        onClick: () => { void handleClick(); },
      },
    });
  }, [hasUpdate, handleClick]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label={hasUpdate ? "Nova versão disponível — clique para atualizar" : "Atualizar sistema"}
            className={cn(
              "h-8 w-8 relative transition-colors",
              hasUpdate
                ? "text-primary animate-pulse hover:text-primary/80"
                : "text-muted-foreground/60 hover:text-foreground"
            )}
          >
            <RefreshCw className="w-4 h-4" />
            {hasUpdate && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {hasUpdate ? "Nova versão disponível — clique para atualizar" : "Atualizar sistema"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default UpdateButton;
