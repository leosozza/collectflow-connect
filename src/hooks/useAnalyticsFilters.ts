import { useMemo } from "react";
import { useUrlState } from "./useUrlState";
import { format, subDays } from "date-fns";

export type AnalyticsRpcParams = {
  _tenant_id: string;
  _date_from: string | null;
  _date_to: string | null;
  _credor: string[] | null;
  _operator_ids: string[] | null;
  _channel: string[] | null;
  _score_min: number | null;
  _score_max: number | null;
};

const today = () => format(new Date(), "yyyy-MM-dd");
const daysAgo = (n: number) => format(subDays(new Date(), n), "yyyy-MM-dd");

export function useAnalyticsFilters(tenantId: string | undefined) {
  const [tab, setTab] = useUrlState("tab", "receita");
  const [dateFrom, setDateFrom] = useUrlState("from", daysAgo(30));
  const [dateTo, setDateTo] = useUrlState("to", today());
  const [credores, setCredores] = useUrlState("credores", [] as string[]);
  const [operators, setOperators] = useUrlState("operators", [] as string[]);
  const [channels, setChannels] = useUrlState("channels", [] as string[]);
  const [scoreMin, setScoreMin] = useUrlState("smin", "");
  const [scoreMax, setScoreMax] = useUrlState("smax", "");

  const rpcParams: AnalyticsRpcParams | null = useMemo(() => {
    if (!tenantId) return null;
    const sMin = scoreMin === "" ? null : Number(scoreMin);
    const sMax = scoreMax === "" ? null : Number(scoreMax);
    return {
      _tenant_id: tenantId,
      _date_from: dateFrom || null,
      _date_to: dateTo || null,
      _credor: credores.length > 0 ? credores : null,
      _operator_ids: operators.length > 0 ? operators : null,
      _channel: channels.length > 0 ? channels : null,
      _score_min: sMin === null || Number.isNaN(sMin) ? null : sMin,
      _score_max: sMax === null || Number.isNaN(sMax) ? null : sMax,
    };
  }, [tenantId, dateFrom, dateTo, credores, operators, channels, scoreMin, scoreMax]);

  const periodDays = useMemo(() => {
    if (!dateFrom || !dateTo) return 30;
    const a = new Date(dateFrom).getTime();
    const b = new Date(dateTo).getTime();
    return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  }, [dateFrom, dateTo]);

  return {
    tab,
    setTab,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    credores,
    setCredores,
    operators,
    setOperators,
    channels,
    setChannels,
    scoreMin,
    setScoreMin,
    scoreMax,
    setScoreMax,
    rpcParams,
    periodDays,
  };
}
