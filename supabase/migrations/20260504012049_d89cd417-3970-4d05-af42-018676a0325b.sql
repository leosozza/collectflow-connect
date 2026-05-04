REVOKE EXECUTE ON FUNCTION public.get_operator_received_total_for_tenant(uuid, uuid, date, date, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_operator_negotiated_and_received_for_tenant(uuid, uuid, date, date, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_campaign_scores(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_campaign_and_award_points(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_operator_received_total_for_tenant(uuid, uuid, date, date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_operator_negotiated_and_received_for_tenant(uuid, uuid, date, date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_campaign_scores(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_campaign_and_award_points(uuid) TO authenticated, service_role;