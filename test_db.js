const { createClient } = require('@supabase/supabase-js');
const url = "https://hulwcntfioqifopyjcvv.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bHdjbnRmaW9xaWZvcHlqY3Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDEyNzksImV4cCI6MjA4NTk3NzI3OX0.ehRJRjakzY34UvVgKPXC1i3s2TbX-kIICrjZddfDen0";
const supabase = createClient(url, key);

async function check() {
  // First, get the mapping of tipo_divida_id to names
  const { data: tipos } = await supabase.from("tipos_divida").select("*");
  console.log("Tipos de dívida:", tipos);

  // Get count of clients per tipo_divida_id
  const { data: clients } = await supabase.from("clients").select("tipo_divida_id, id");
  
  const countMap = {};
  clients.forEach(c => {
    const t = c.tipo_divida_id || 'NULL';
    countMap[t] = (countMap[t] || 0) + 1;
  });
  console.log("Counts per tipo_divida_id in clients:", countMap);
}
check().catch(console.error);
