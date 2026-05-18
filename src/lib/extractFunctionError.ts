/**
 * Extracts the real error message from a Supabase Functions invocation.
 *
 * The supabase-js SDK returns a generic "Edge Function returned a non-2xx
 * status code" message for any HTTP error from `supabase.functions.invoke`.
 * The actual `{ error: "..." }` body is hidden inside `error.context`
 * (the raw `Response`) or `error.context.response`. This helper reads it
 * and returns a human-readable string the UI can show to operators.
 *
 * Usage:
 *   const { data, error } = await supabase.functions.invoke("foo", {...});
 *   if (error || data?.error) {
 *     const msg = await extractFunctionError(error, data, "Erro ao chamar foo");
 *     throw new Error(msg);
 *   }
 */
export async function extractFunctionError(
  error: any,
  data: any,
  fallback: string,
): Promise<string> {
  // 1) Sucesso parcial: data tem .error
  if (data?.error) return String(data.error);

  // 2) FunctionsHttpError do supabase-js: tentar ler o body da resposta
  const ctx = error?.context;
  const candidates: any[] = [];
  if (ctx) candidates.push(ctx);
  if (ctx?.response) candidates.push(ctx.response);

  for (const resp of candidates) {
    if (!resp || typeof resp !== "object") continue;
    try {
      const cloned = typeof resp.clone === "function" ? resp.clone() : resp;
      if (typeof cloned.json === "function") {
        const body = await cloned.json().catch(() => null);
        if (body?.error) {
          const extra = body?.httpStatus ? ` (provider HTTP ${body.httpStatus})` : "";
          return `${String(body.error)}${extra}`;
        }
        if (body?.message) return String(body.message);
      }
      if (typeof cloned.text === "function") {
        const cloned2 = typeof resp.clone === "function" ? resp.clone() : resp;
        const text = await cloned2.text?.().catch(() => "");
        if (text && text.length < 800) {
          try {
            const parsed = JSON.parse(text);
            if (parsed?.error) return String(parsed.error);
            if (parsed?.message) return String(parsed.message);
          } catch {
            return text;
          }
        }
      }
    } catch {
      // tenta próximo candidato
    }
  }

  // 3) Mensagem padrão do erro
  if (error?.message && error.message !== "Edge Function returned a non-2xx status code") {
    return error.message;
  }
  return fallback;
}
