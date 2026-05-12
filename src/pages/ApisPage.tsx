import { useState } from "react";
import { Code2, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import ApiDocsPage from "./ApiDocsPage";
import McpDocsPage from "./McpDocsPage";

const API_TABS = [
  { key: "rest", label: "API REST", icon: Code2 },
  { key: "mcp", label: "Servidor MCP", icon: Server },
];

const ApisPage = () => {
  const [activeTab, setActiveTab] = useState("rest");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sub-tabs for APIs */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px w-full">
        {API_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all relative rounded-t-lg",
                isActive
                  ? "bg-primary/10 text-primary border-b-[3px] border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-[3px] border-transparent"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div>
        {activeTab === "rest" && <ApiDocsPage />}
        {activeTab === "mcp" && <McpDocsPage />}
      </div>
    </div>
  );
};

export default ApisPage;
