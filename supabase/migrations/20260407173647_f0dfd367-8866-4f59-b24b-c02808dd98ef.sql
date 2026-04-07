
DROP TRIGGER IF EXISTS trg_sync_client_phones ON public.clients;
CREATE TRIGGER trg_sync_client_phones
  AFTER INSERT OR UPDATE OF phone, phone2, phone3
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_phones();
