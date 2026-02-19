import { supabase } from "@/integrations/supabase/client";

export interface WorkflowFlow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  is_active: boolean;
  nodes: any[];
  edges: any[];
  trigger_type: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  tenant_id: string;
  workflow_id: string;
  client_id: string;
  current_node_id: string | null;
  status: string;
  execution_log: any[];
  next_run_at: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export async function fetchWorkflows(tenantId: string): Promise<WorkflowFlow[]> {
  const { data, error } = await supabase
    .from("workflow_flows" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any) || [];
}

export async function createWorkflow(workflow: Partial<WorkflowFlow>): Promise<WorkflowFlow> {
  const { data, error } = await supabase
    .from("workflow_flows" as any)
    .insert(workflow as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateWorkflow(id: string, updates: Partial<WorkflowFlow>): Promise<WorkflowFlow> {
  const { data, error } = await supabase
    .from("workflow_flows" as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase
    .from("workflow_flows" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchExecutions(tenantId: string, workflowId?: string): Promise<WorkflowExecution[]> {
  let query = supabase
    .from("workflow_executions" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (workflowId) query = query.eq("workflow_id", workflowId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as any) || [];
}

export async function fetchExecutionStats(tenantId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("workflow_executions" as any)
    .select("status")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo.toISOString());
  if (error) throw error;

  const items = (data as any[]) || [];
  return {
    running: items.filter((e) => e.status === "running").length,
    waiting: items.filter((e) => e.status === "waiting").length,
    done: items.filter((e) => e.status === "done").length,
    error: items.filter((e) => e.status === "error").length,
  };
}
