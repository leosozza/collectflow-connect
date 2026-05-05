import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase.from("clients").select("id, external_id, cod_contrato, numero_parcela, valor_parcela, status").eq("cpf", "30960301895").order("cod_contrato").order("numero_parcela");
if (error) console.error(error);
else console.table(data);
