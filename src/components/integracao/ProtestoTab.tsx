import { useState } from "react";
import ProtestoConfigCard from "./protesto/ProtestoConfigCard";
import ProtestoTitleForm from "./protesto/ProtestoTitleForm";
import ProtestoBatchDialog from "./protesto/ProtestoBatchDialog";
import ProtestoTitlesList from "./protesto/ProtestoTitlesList";
import ProtestoLogsCard from "./protesto/ProtestoLogsCard";

const ProtestoTab = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      <ProtestoConfigCard />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Títulos a Protesto</h3>
        <ProtestoBatchDialog onCreated={handleRefresh} />
      </div>

      <ProtestoTitleForm onCreated={handleRefresh} />
      <ProtestoTitlesList refreshKey={refreshKey} />
      <ProtestoLogsCard refreshKey={refreshKey} />
    </div>
  );
};

export default ProtestoTab;
