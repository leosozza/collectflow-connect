import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClientData {
  nome_completo: string;
  cpf: string;
  credor: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  data_quitacao: string | null;
  status: string;
}

function generateCSV(clients: ClientData[]): string {
  const header = "Nome Completo;CPF;Credor;Parcela;Valor Parcela;Valor Pago;Data Vencimento;Data Quitação;Status";
  const rows = clients.map(c =>
    `${c.nome_completo};${c.cpf};${c.credor};${c.numero_parcela};${c.valor_parcela};${c.valor_pago};${c.data_vencimento};${c.data_quitacao || ""};${c.status}`
  );
  return [header, ...rows].join("\n");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resend = new Resend(resendApiKey);
    const { clients, recipientEmail, adminEmail } = await req.json() as {
      clients: ClientData[];
      recipientEmail: string;
      adminEmail: string;
    };

    if (!clients || clients.length === 0) {
      throw new Error("Nenhum cliente fornecido");
    }

    const csv = generateCSV(clients);
    const csvBase64 = base64Encode(new TextEncoder().encode(csv));

    const recipients: string[] = [];
    if (adminEmail) recipients.push(adminEmail);
    if (recipientEmail && recipientEmail !== adminEmail) recipients.push(recipientEmail);

    if (recipients.length === 0) {
      throw new Error("Nenhum e-mail de destino fornecido");
    }

    const now = new Date().toLocaleDateString("pt-BR");

    const emailResponse = await resend.emails.send({
      from: "RIVO CONNECT <noreply@resend.dev>",
      to: recipients,
      subject: `Clientes Quitados excluídos do Sistema RIVO CONNECT - ${now}`,
      html: `
        <h2>Clientes Quitados excluídos do Sistema RIVO CONNECT</h2>
        <p>Segue em anexo a planilha com <strong>${clients.length}</strong> cliente(s) quitado(s) que foram excluídos do sistema em ${now}.</p>
        <p>Este é um e-mail automático gerado pelo sistema RIVO CONNECT.</p>
      `,
      attachments: [
        {
          filename: `clientes_quitados_${now.replace(/\//g, "-")}.csv`,
          content: csvBase64,
        },
      ],
    });

    console.log("Relatório enviado:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro no send-quitados-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
