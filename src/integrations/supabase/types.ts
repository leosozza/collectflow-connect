export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievement_templates: {
        Row: {
          created_at: string
          credor_id: string | null
          criteria_type: string
          criteria_value: number
          description: string
          icon: string
          id: string
          is_active: boolean
          points_reward: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credor_id?: string | null
          criteria_type?: string
          criteria_value?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          points_reward?: number
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credor_id?: string | null
          criteria_type?: string
          criteria_value?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          points_reward?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_templates_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          profile_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          profile_id: string
          tenant_id: string
          title: string
        }
        Update: {
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          profile_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_meetings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          meeting_type: string
          meeting_url: string | null
          notes: string | null
          participants_count: number
          scheduled_at: string
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_type?: string
          meeting_url?: string | null
          notes?: string | null
          participants_count?: number
          scheduled_at: string
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_type?: string
          meeting_url?: string | null
          notes?: string | null
          participants_count?: number
          scheduled_at?: string
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_staff: {
        Row: {
          created_at: string
          department: string
          full_name: string
          id: string
          role_title: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string
          full_name: string
          id?: string
          role_title?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          full_name?: string
          id?: string
          role_title?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agreement_signatures: {
        Row: {
          agreement_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          signature_data: string | null
          signature_type: string
          signed_at: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          agreement_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          signature_data?: string | null
          signature_type?: string
          signed_at?: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          agreement_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          signature_data?: string | null
          signature_type?: string
          signed_at?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_signatures_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          approval_reason: string | null
          approved_by: string | null
          checkout_token: string | null
          client_cpf: string
          client_name: string
          created_at: string
          created_by: string
          credor: string
          custom_installment_dates: Json | null
          custom_installment_values: Json | null
          discount_percent: number | null
          entrada_date: string | null
          entrada_value: number | null
          first_due_date: string
          id: string
          new_installment_value: number
          new_installments: number
          notes: string | null
          original_total: number
          portal_origin: boolean
          previous_agreement_id: string | null
          proposed_total: number
          requires_approval: boolean
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_reason?: string | null
          approved_by?: string | null
          checkout_token?: string | null
          client_cpf: string
          client_name: string
          created_at?: string
          created_by: string
          credor: string
          custom_installment_dates?: Json | null
          custom_installment_values?: Json | null
          discount_percent?: number | null
          entrada_date?: string | null
          entrada_value?: number | null
          first_due_date: string
          id?: string
          new_installment_value?: number
          new_installments?: number
          notes?: string | null
          original_total?: number
          portal_origin?: boolean
          previous_agreement_id?: string | null
          proposed_total?: number
          requires_approval?: boolean
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_reason?: string | null
          approved_by?: string | null
          checkout_token?: string | null
          client_cpf?: string
          client_name?: string
          created_at?: string
          created_by?: string
          credor?: string
          custom_installment_dates?: Json | null
          custom_installment_values?: Json | null
          discount_percent?: number | null
          entrada_date?: string | null
          entrada_value?: number | null
          first_due_date?: string
          id?: string
          new_installment_value?: number
          new_installments?: number
          notes?: string | null
          original_total?: number
          portal_origin?: boolean
          previous_agreement_id?: string | null
          proposed_total?: number
          requires_approval?: boolean
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_previous_agreement_id_fkey"
            columns: ["previous_agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          context: string
          created_at: string
          credor_id: string | null
          gender: string
          id: string
          identifier: string
          is_active: boolean
          is_default: boolean
          name: string
          personality: Json
          profile_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          context?: string
          created_at?: string
          credor_id?: string | null
          gender?: string
          id?: string
          identifier: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          personality?: Json
          profile_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          context?: string
          created_at?: string
          credor_id?: string | null
          gender?: string
          id?: string
          identifier?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          personality?: Json
          profile_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          cpf_cnpj: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          asaas_customer_id: string
          cpf_cnpj: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_field_config: {
        Row: {
          credor_id: string | null
          field_key: string
          id: string
          label: string
          sort_order: number
          tenant_id: string
          visible: boolean
        }
        Insert: {
          credor_id?: string | null
          field_key: string
          id?: string
          label: string
          sort_order?: number
          tenant_id: string
          visible?: boolean
        }
        Update: {
          credor_id?: string | null
          field_key?: string
          id?: string
          label?: string
          sort_order?: number
          tenant_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_field_config_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_field_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_sessions: {
        Row: {
          ai_session_id: string | null
          assigned_to: string | null
          client_cpf: string
          client_id: string | null
          closed_at: string | null
          created_at: string
          credor: string | null
          current_actor: string | null
          current_channel: string | null
          id: string
          opened_at: string
          origin_actor: string | null
          origin_channel: string
          portal_session_id: string | null
          source_call_id: string | null
          source_conversation_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          ai_session_id?: string | null
          assigned_to?: string | null
          client_cpf: string
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          credor?: string | null
          current_actor?: string | null
          current_channel?: string | null
          id?: string
          opened_at?: string
          origin_actor?: string | null
          origin_channel: string
          portal_session_id?: string | null
          source_call_id?: string | null
          source_conversation_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          ai_session_id?: string | null
          assigned_to?: string | null
          client_cpf?: string
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          credor?: string | null
          current_actor?: string | null
          current_channel?: string | null
          id?: string
          opened_at?: string
          origin_actor?: string | null
          origin_channel?: string
          portal_session_id?: string | null
          source_call_id?: string | null
          source_conversation_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_sessions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          tenant_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          tenant_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          tenant_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_disposition_types: {
        Row: {
          active: boolean
          behavior: string
          blocklist_days: number
          blocklist_mode: string
          channel: string
          color: string
          created_at: string
          group_name: string
          id: string
          impact: string
          is_blocklist: boolean
          is_callback: boolean
          is_conversion: boolean
          is_cpc: boolean
          is_schedule: boolean
          is_unknown: boolean
          key: string
          label: string
          schedule_allow_other_number: boolean
          schedule_days_limit: number
          sort_order: number
          tenant_id: string
          threecplus_qualification_id: number | null
        }
        Insert: {
          active?: boolean
          behavior?: string
          blocklist_days?: number
          blocklist_mode?: string
          channel?: string
          color?: string
          created_at?: string
          group_name?: string
          id?: string
          impact?: string
          is_blocklist?: boolean
          is_callback?: boolean
          is_conversion?: boolean
          is_cpc?: boolean
          is_schedule?: boolean
          is_unknown?: boolean
          key: string
          label: string
          schedule_allow_other_number?: boolean
          schedule_days_limit?: number
          sort_order?: number
          tenant_id: string
          threecplus_qualification_id?: number | null
        }
        Update: {
          active?: boolean
          behavior?: string
          blocklist_days?: number
          blocklist_mode?: string
          channel?: string
          color?: string
          created_at?: string
          group_name?: string
          id?: string
          impact?: string
          is_blocklist?: boolean
          is_callback?: boolean
          is_conversion?: boolean
          is_cpc?: boolean
          is_schedule?: boolean
          is_unknown?: boolean
          key?: string
          label?: string
          schedule_allow_other_number?: boolean
          schedule_days_limit?: number
          sort_order?: number
          tenant_id?: string
          threecplus_qualification_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_disposition_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_dispositions: {
        Row: {
          client_id: string
          created_at: string
          disposition_type: string
          id: string
          notes: string | null
          operator_id: string
          scheduled_callback: string | null
          tenant_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          disposition_type: string
          id?: string
          notes?: string | null
          operator_id: string
          scheduled_callback?: string | null
          tenant_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          disposition_type?: string
          id?: string
          notes?: string | null
          operator_id?: string
          scheduled_callback?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_dispositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_dispositions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_dispositions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          agent_name: string | null
          call_id_external: string | null
          called_at: string
          campaign_name: string | null
          client_cpf: string | null
          client_id: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          operator_id: string | null
          phone: string | null
          recording_url: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          agent_name?: string | null
          call_id_external?: string | null
          called_at?: string
          campaign_name?: string | null
          client_cpf?: string | null
          client_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          operator_id?: string | null
          phone?: string | null
          recording_url?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          agent_name?: string | null
          call_id_external?: string | null
          called_at?: string
          campaign_name?: string | null
          client_cpf?: string | null
          client_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          operator_id?: string | null
          phone?: string | null
          recording_url?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_credores: {
        Row: {
          campaign_id: string
          created_at: string
          credor_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          credor_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          credor_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_credores_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "gamification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_credores_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_credores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_participants: {
        Row: {
          campaign_id: string
          id: string
          operator_id: string
          rank: number | null
          score: number
          source_id: string | null
          source_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          operator_id: string
          rank?: number | null
          score?: number
          source_id?: string | null
          source_type?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          operator_id?: string
          rank?: number | null
          score?: number
          source_id?: string | null
          source_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "gamification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          is_internal: boolean
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          status: string
          tenant_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          is_internal?: boolean
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          status?: string
          tenant_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          is_internal?: boolean
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_attachments: {
        Row: {
          client_cpf: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          manual_payment_id: string | null
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          client_cpf: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          manual_payment_id?: string | null
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          client_cpf?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          manual_payment_id?: string | null
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_attachments_manual_payment_id_fkey"
            columns: ["manual_payment_id"]
            isOneToOne: false
            referencedRelation: "manual_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_events: {
        Row: {
          client_cpf: string
          client_id: string | null
          created_at: string | null
          event_channel: string | null
          event_source: string
          event_type: string
          event_value: string | null
          id: string
          metadata: Json | null
          session_id: string | null
          tenant_id: string
        }
        Insert: {
          client_cpf: string
          client_id?: string | null
          created_at?: string | null
          event_channel?: string | null
          event_source: string
          event_type: string
          event_value?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string | null
          tenant_id: string
        }
        Update: {
          client_cpf?: string
          client_id?: string | null
          created_at?: string | null
          event_channel?: string | null
          event_source?: string
          event_type?: string
          event_value?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "atendimento_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_phones: {
        Row: {
          cpf: string
          created_at: string | null
          id: string
          is_whatsapp: boolean | null
          phone_number: string
          phone_type: string | null
          priority: number | null
          raw_metadata: Json | null
          source: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cpf: string
          created_at?: string | null
          id?: string
          is_whatsapp?: boolean | null
          phone_number: string
          phone_type?: string | null
          priority?: number | null
          raw_metadata?: Json | null
          source?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string | null
          id?: string
          is_whatsapp?: boolean | null
          phone_number?: string
          phone_type?: string | null
          priority?: number | null
          raw_metadata?: Json | null
          source?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_phones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_update_logs: {
        Row: {
          changes: Json
          client_id: string
          created_at: string | null
          id: string
          source: string
          tenant_id: string
          updated_by: string | null
        }
        Insert: {
          changes?: Json
          client_id: string
          created_at?: string | null
          id?: string
          source?: string
          tenant_id: string
          updated_by?: string | null
        }
        Update: {
          changes?: Json
          client_id?: string
          created_at?: string | null
          id?: string
          source?: string
          tenant_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_update_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_update_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cod_contrato: string | null
          cpf: string
          created_at: string
          credor: string
          custom_data: Json | null
          data_pagamento: string | null
          data_quitacao: string | null
          data_vencimento: string
          debtor_category_id: string | null
          email: string | null
          endereco: string | null
          enrichment_data: Json | null
          external_id: string | null
          id: string
          model_name: string | null
          nome_completo: string
          numero_parcela: number
          observacoes: string | null
          operator_id: string | null
          phone: string | null
          phone2: string | null
          phone3: string | null
          preferred_channel: string | null
          propensity_score: number | null
          quebra: number | null
          score_confidence: string | null
          score_reason: string | null
          score_updated_at: string | null
          status: Database["public"]["Enums"]["client_status"]
          status_cobranca_id: string | null
          status_cobranca_locked_at: string | null
          status_cobranca_locked_by: string | null
          suggested_queue: string | null
          tenant_id: string | null
          tipo_devedor_id: string | null
          tipo_divida_id: string | null
          total_parcelas: number
          uf: string | null
          updated_at: string
          valor_atualizado: number | null
          valor_entrada: number
          valor_pago: number
          valor_parcela: number
          valor_saldo: number | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cod_contrato?: string | null
          cpf: string
          created_at?: string
          credor?: string
          custom_data?: Json | null
          data_pagamento?: string | null
          data_quitacao?: string | null
          data_vencimento: string
          debtor_category_id?: string | null
          email?: string | null
          endereco?: string | null
          enrichment_data?: Json | null
          external_id?: string | null
          id?: string
          model_name?: string | null
          nome_completo: string
          numero_parcela?: number
          observacoes?: string | null
          operator_id?: string | null
          phone?: string | null
          phone2?: string | null
          phone3?: string | null
          preferred_channel?: string | null
          propensity_score?: number | null
          quebra?: number | null
          score_confidence?: string | null
          score_reason?: string | null
          score_updated_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          status_cobranca_id?: string | null
          status_cobranca_locked_at?: string | null
          status_cobranca_locked_by?: string | null
          suggested_queue?: string | null
          tenant_id?: string | null
          tipo_devedor_id?: string | null
          tipo_divida_id?: string | null
          total_parcelas?: number
          uf?: string | null
          updated_at?: string
          valor_atualizado?: number | null
          valor_entrada?: number
          valor_pago?: number
          valor_parcela?: number
          valor_saldo?: number | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cod_contrato?: string | null
          cpf?: string
          created_at?: string
          credor?: string
          custom_data?: Json | null
          data_pagamento?: string | null
          data_quitacao?: string | null
          data_vencimento?: string
          debtor_category_id?: string | null
          email?: string | null
          endereco?: string | null
          enrichment_data?: Json | null
          external_id?: string | null
          id?: string
          model_name?: string | null
          nome_completo?: string
          numero_parcela?: number
          observacoes?: string | null
          operator_id?: string | null
          phone?: string | null
          phone2?: string | null
          phone3?: string | null
          preferred_channel?: string | null
          propensity_score?: number | null
          quebra?: number | null
          score_confidence?: string | null
          score_reason?: string | null
          score_updated_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          status_cobranca_id?: string | null
          status_cobranca_locked_at?: string | null
          status_cobranca_locked_by?: string | null
          suggested_queue?: string | null
          tenant_id?: string | null
          tipo_devedor_id?: string | null
          tipo_divida_id?: string | null
          total_parcelas?: number
          uf?: string | null
          updated_at?: string
          valor_atualizado?: number | null
          valor_entrada?: number
          valor_pago?: number
          valor_parcela?: number
          valor_saldo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_debtor_category_id_fkey"
            columns: ["debtor_category_id"]
            isOneToOne: false
            referencedRelation: "debtor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_status_cobranca_id_fkey"
            columns: ["status_cobranca_id"]
            isOneToOne: false
            referencedRelation: "tipos_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tipo_devedor_id_fkey"
            columns: ["tipo_devedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_devedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tipo_divida_id_fkey"
            columns: ["tipo_divida_id"]
            isOneToOne: false
            referencedRelation: "tipos_divida"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_rules: {
        Row: {
          channel: string
          created_at: string | null
          credor_id: string | null
          days_offset: number
          id: string
          is_active: boolean | null
          message_template: string
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          credor_id?: string | null
          days_offset?: number
          id?: string
          is_active?: boolean | null
          message_template: string
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          credor_id?: string | null
          days_offset?: number
          id?: string
          is_active?: boolean | null
          message_template?: string
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_rules_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_grades: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          tiers: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
          tiers?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          tiers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_grades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_disposition_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          conversation_id: string
          disposition_type_id: string
          id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          conversation_id: string
          disposition_type_id: string
          id?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          conversation_id?: string
          disposition_type_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_disposition_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_disposition_assignments_disposition_type_id_fkey"
            columns: ["disposition_type_id"]
            isOneToOne: false
            referencedRelation: "call_disposition_types"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tag_assignments: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tag_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "conversation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          id: string
          instance_id: string | null
          last_message_at: string | null
          remote_name: string
          remote_phone: string
          sla_deadline_at: string | null
          sla_notified_at: string | null
          status: string
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          last_message_at?: string | null
          remote_name?: string
          remote_phone: string
          sla_deadline_at?: string | null
          sla_notified_at?: string | null
          status?: string
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          last_message_at?: string | null
          remote_name?: string
          remote_phone?: string
          sla_deadline_at?: string | null
          sla_notified_at?: string | null
          status?: string
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credores: {
        Row: {
          agencia: string | null
          aging_discount_tiers: Json | null
          bairro: string | null
          banco: string | null
          carteira_mode: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          complemento: string | null
          conta: string | null
          contato_responsavel: string | null
          created_at: string
          desconto_maximo: number | null
          email: string | null
          endereco: string | null
          entrada_minima_tipo: string | null
          entrada_minima_valor: number | null
          gateway_ambiente: string | null
          gateway_ativo: string | null
          gateway_status: string | null
          gateway_token: string | null
          honorarios_grade: Json | null
          id: string
          indice_correcao_monetaria: string | null
          inscricao_estadual: string | null
          juros_mes: number | null
          multa: number | null
          nome_fantasia: string | null
          numero: string | null
          parcelas_max: number | null
          parcelas_min: number | null
          pix_chave: string | null
          portal_enabled: boolean | null
          portal_hero_subtitle: string | null
          portal_hero_title: string | null
          portal_logo_url: string | null
          portal_primary_color: string | null
          prazo_dias_acordo: number | null
          razao_social: string
          signature_enabled: boolean | null
          signature_type: string | null
          sla_hours: number | null
          status: string
          telefone: string | null
          template_acordo: string | null
          template_descricao_divida: string | null
          template_notificacao_extrajudicial: string | null
          template_quitacao: string | null
          template_recibo: string | null
          tenant_id: string
          tipo_conta: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          aging_discount_tiers?: Json | null
          bairro?: string | null
          banco?: string | null
          carteira_mode?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          complemento?: string | null
          conta?: string | null
          contato_responsavel?: string | null
          created_at?: string
          desconto_maximo?: number | null
          email?: string | null
          endereco?: string | null
          entrada_minima_tipo?: string | null
          entrada_minima_valor?: number | null
          gateway_ambiente?: string | null
          gateway_ativo?: string | null
          gateway_status?: string | null
          gateway_token?: string | null
          honorarios_grade?: Json | null
          id?: string
          indice_correcao_monetaria?: string | null
          inscricao_estadual?: string | null
          juros_mes?: number | null
          multa?: number | null
          nome_fantasia?: string | null
          numero?: string | null
          parcelas_max?: number | null
          parcelas_min?: number | null
          pix_chave?: string | null
          portal_enabled?: boolean | null
          portal_hero_subtitle?: string | null
          portal_hero_title?: string | null
          portal_logo_url?: string | null
          portal_primary_color?: string | null
          prazo_dias_acordo?: number | null
          razao_social: string
          signature_enabled?: boolean | null
          signature_type?: string | null
          sla_hours?: number | null
          status?: string
          telefone?: string | null
          template_acordo?: string | null
          template_descricao_divida?: string | null
          template_notificacao_extrajudicial?: string | null
          template_quitacao?: string | null
          template_recibo?: string | null
          tenant_id: string
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          aging_discount_tiers?: Json | null
          bairro?: string | null
          banco?: string | null
          carteira_mode?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          complemento?: string | null
          conta?: string | null
          contato_responsavel?: string | null
          created_at?: string
          desconto_maximo?: number | null
          email?: string | null
          endereco?: string | null
          entrada_minima_tipo?: string | null
          entrada_minima_valor?: number | null
          gateway_ambiente?: string | null
          gateway_ativo?: string | null
          gateway_status?: string | null
          gateway_token?: string | null
          honorarios_grade?: Json | null
          id?: string
          indice_correcao_monetaria?: string | null
          inscricao_estadual?: string | null
          juros_mes?: number | null
          multa?: number | null
          nome_fantasia?: string | null
          numero?: string | null
          parcelas_max?: number | null
          parcelas_min?: number | null
          pix_chave?: string | null
          portal_enabled?: boolean | null
          portal_hero_subtitle?: string | null
          portal_hero_title?: string | null
          portal_logo_url?: string | null
          portal_primary_color?: string | null
          prazo_dias_acordo?: number | null
          razao_social?: string
          signature_enabled?: boolean | null
          signature_type?: string | null
          sla_hours?: number | null
          status?: string
          telefone?: string | null
          template_acordo?: string | null
          template_descricao_divida?: string | null
          template_notificacao_extrajudicial?: string | null
          template_quitacao?: string | null
          template_recibo?: string | null
          tenant_id?: string
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          company_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          opportunity_id: string | null
          responsible_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          responsible_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          responsible_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          city: string | null
          created_at: string
          custom_data: Json | null
          employees_count: number | null
          estimated_value: number | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          responsible_id: string | null
          segment: string | null
          suggested_plan: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          custom_data?: Json | null
          employees_count?: number | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          responsible_id?: string | null
          segment?: string | null
          suggested_plan?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          custom_data?: Json | null
          employees_count?: number | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          responsible_id?: string | null
          segment?: string | null
          suggested_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_companies_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_custom_fields: {
        Row: {
          created_at: string
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          is_visible_in_list: boolean
          options: Json | null
          position: number
        }
        Insert: {
          created_at?: string
          entity_type?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_visible_in_list?: boolean
          options?: Json | null
          position?: number
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_visible_in_list?: boolean
          options?: Json | null
          position?: number
        }
        Relationships: []
      }
      crm_lead_score_rules: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          rule_name: string
          score_change: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          rule_name: string
          score_change?: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          rule_name?: string
          score_change?: number
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          company_name: string | null
          converted_company_id: string | null
          created_at: string
          custom_data: Json | null
          email: string | null
          id: string
          lead_origin: string | null
          lead_score: number
          name: string
          notes: string | null
          phone: string | null
          responsible_id: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          company_name?: string | null
          converted_company_id?: string | null
          created_at?: string
          custom_data?: Json | null
          email?: string | null
          id?: string
          lead_origin?: string | null
          lead_score?: number
          name: string
          notes?: string | null
          phone?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          company_name?: string | null
          converted_company_id?: string | null
          created_at?: string
          custom_data?: Json | null
          email?: string | null
          id?: string
          lead_origin?: string | null
          lead_score?: number
          name?: string
          notes?: string | null
          phone?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          company_id: string | null
          created_at: string
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          position: number
          responsible_id: string | null
          stage_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          position?: number
          responsible_id?: string | null
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          position?: number
          responsible_id?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          created_at: string | null
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_active: boolean | null
          options: Json | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          options?: Json | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          options?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      debtor_categories: {
        Row: {
          cor: string | null
          created_at: string | null
          credor_id: string
          descricao: string | null
          id: string
          nome: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          credor_id: string
          descricao?: string | null
          id?: string
          nome: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          credor_id?: string
          descricao?: string | null
          id?: string
          nome?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtor_categories_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtor_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      disposition_automations: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string
          disposition_type: string
          id: string
          is_active: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string
          disposition_type: string
          id?: string
          is_active?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string
          disposition_type?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposition_automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_jobs: {
        Row: {
          cost_per_client: number
          created_at: string
          enriched: number
          failed: number
          id: string
          processed: number
          status: string
          tenant_id: string
          total_clients: number
          total_cost: number
          updated_at: string
        }
        Insert: {
          cost_per_client?: number
          created_at?: string
          enriched?: number
          failed?: number
          id?: string
          processed?: number
          status?: string
          tenant_id: string
          total_clients?: number
          total_cost?: number
          updated_at?: string
        }
        Update: {
          cost_per_client?: number
          created_at?: string
          enriched?: number
          failed?: number
          id?: string
          processed?: number
          status?: string
          tenant_id?: string
          total_clients?: number
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_logs: {
        Row: {
          cpf: string
          created_at: string
          data_returned: Json | null
          id: string
          job_id: string
          status: string
        }
        Insert: {
          cpf: string
          created_at?: string
          data_returned?: Json | null
          id?: string
          job_id: string
          status?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          data_returned?: Json | null
          id?: string
          job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_membros: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          profile_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          profile_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          created_at: string
          id: string
          lider_id: string | null
          meta_mensal: number | null
          nome: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lider_id?: string | null
          meta_mensal?: number | null
          nome: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lider_id?: string | null
          meta_mensal?: number | null
          nome?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by: string
          description: string
          expense_date: string
          id?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      field_mappings: {
        Row: {
          created_at: string | null
          credor: string | null
          id: string
          is_default: boolean | null
          mappings: Json
          name: string
          source: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credor?: string | null
          id?: string
          is_default?: boolean | null
          mappings?: Json
          name: string
          source?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credor?: string | null
          id?: string
          is_default?: boolean | null
          mappings?: Json
          name?: string
          source?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          metric: string
          period: string
          prize_description: string | null
          start_date: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          metric: string
          period: string
          prize_description?: string | null
          start_date: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          metric?: string
          period?: string
          prize_description?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_participants: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          profile_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          profile_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          credor: string | null
          errors: Json | null
          id: string
          imported_by: string | null
          inserted: number
          metadata: Json | null
          skipped: number
          source: string
          tenant_id: string
          total_records: number
          updated: number
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          credor?: string | null
          errors?: Json | null
          id?: string
          imported_by?: string | null
          inserted?: number
          metadata?: Json | null
          skipped?: number
          source?: string
          tenant_id: string
          total_records?: number
          updated?: number
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          credor?: string | null
          errors?: Json | null
          id?: string
          imported_by?: string | null
          inserted?: number
          metadata?: Json | null
          skipped?: number
          source?: string
          tenant_id?: string
          total_records?: number
          updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payments: {
        Row: {
          agreement_id: string
          amount_paid: number
          created_at: string
          id: string
          installment_number: number
          notes: string | null
          payment_date: string
          payment_method: string
          receiver: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          agreement_id: string
          amount_paid: number
          created_at?: string
          id?: string
          installment_number: number
          notes?: string | null
          payment_date: string
          payment_method: string
          receiver: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          agreement_id?: string
          amount_paid?: number
          created_at?: string
          id?: string
          installment_number?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receiver?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          channel: string
          client_id: string | null
          created_at: string | null
          email_to: string | null
          error_message: string | null
          id: string
          message_body: string | null
          phone: string | null
          rule_id: string | null
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          channel: string
          client_id?: string | null
          created_at?: string | null
          email_to?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          phone?: string | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          channel?: string
          client_id?: string | null
          created_at?: string | null
          email_to?: string | null
          error_message?: string | null
          id?: string
          message_body?: string | null
          phone?: string | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "collection_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      negociarie_cobrancas: {
        Row: {
          agreement_id: string | null
          callback_data: Json | null
          client_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          id_geral: string
          id_parcela: string | null
          id_status: number | null
          installment_key: string | null
          linha_digitavel: string | null
          link_boleto: string | null
          link_cartao: string | null
          pix_copia_cola: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          agreement_id?: string | null
          callback_data?: Json | null
          client_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          id_geral: string
          id_parcela?: string | null
          id_status?: number | null
          installment_key?: string | null
          linha_digitavel?: string | null
          link_boleto?: string | null
          link_cartao?: string | null
          pix_copia_cola?: string | null
          status?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          agreement_id?: string | null
          callback_data?: Json | null
          client_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          id_geral?: string
          id_parcela?: string | null
          id_status?: number | null
          installment_key?: string | null
          linha_digitavel?: string | null
          link_boleto?: string | null
          link_cartao?: string | null
          pix_copia_cola?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negociarie_cobrancas_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociarie_cobrancas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociarie_cobrancas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_goals: {
        Row: {
          created_at: string
          created_by: string
          credor_id: string | null
          id: string
          month: number
          operator_id: string
          target_amount: number
          tenant_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          credor_id?: string | null
          id?: string
          month: number
          operator_id: string
          target_amount?: number
          tenant_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          credor_id?: string | null
          id?: string
          month?: number
          operator_id?: string
          target_amount?: number
          tenant_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_goals_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_instances: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          profile_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          profile_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_points: {
        Row: {
          breaks_count: number
          id: string
          month: number
          operator_id: string
          payments_count: number
          points: number
          tenant_id: string
          total_received: number
          updated_at: string
          year: number
        }
        Insert: {
          breaks_count?: number
          id?: string
          month: number
          operator_id: string
          payments_count?: number
          points?: number
          tenant_id: string
          total_received?: number
          updated_at?: string
          year: number
        }
        Update: {
          breaks_count?: number
          id?: string
          month?: number
          operator_id?: string
          payments_count?: number
          points?: number
          tenant_id?: string
          total_received?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_points_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_points_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          asaas_status: string | null
          billing_type: string | null
          boleto_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          gateway_response: Json | null
          gateway_transaction_id: string | null
          id: string
          invoice_pdf_url: string | null
          invoice_url: string | null
          metadata: Json | null
          paid_at: string | null
          payment_gateway: string | null
          payment_method: string | null
          payment_type: string
          pix_copy_paste: string | null
          pix_qr_code: string | null
          refunded_at: string | null
          status: string
          tenant_id: string
          token_package_id: string | null
          tokens_granted: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          asaas_status?: string | null
          billing_type?: string | null
          boleto_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_type: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          refunded_at?: string | null
          status?: string
          tenant_id: string
          token_package_id?: string | null
          tokens_granted?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          asaas_status?: string | null
          billing_type?: string | null
          boleto_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_type?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          refunded_at?: string | null
          status?: string
          tenant_id?: string
          token_package_id?: string | null
          tokens_granted?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_token_package_id_fkey"
            columns: ["token_package_id"]
            isOneToOne: false
            referencedRelation: "token_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          base_role: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          permissions: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_role?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_role?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          limits: Json | null
          name: string
          price_monthly: number | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name: string
          price_monthly?: number | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          price_monthly?: number | null
          slug?: string
        }
        Relationships: []
      }
      portal_payments: {
        Row: {
          agreement_id: string
          amount: number
          created_at: string
          id: string
          negociarie_id_geral: string | null
          payment_data: Json | null
          payment_method: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agreement_id: string
          amount?: number
          created_at?: string
          id?: string
          negociarie_id_geral?: string | null
          payment_data?: Json | null
          payment_method?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          amount?: number
          created_at?: string
          id?: string
          negociarie_id_geral?: string | null
          payment_data?: Json | null
          payment_method?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          commission_grade_id: string | null
          commission_rate: number
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          permission_profile_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          threecplus_agent_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          commission_grade_id?: string | null
          commission_rate?: number
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          permission_profile_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          threecplus_agent_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          commission_grade_id?: string | null
          commission_rate?: number
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          permission_profile_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          threecplus_agent_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_commission_grade_id_fkey"
            columns: ["commission_grade_id"]
            isOneToOne: false
            referencedRelation: "commission_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protest_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          details: Json | null
          id: string
          message: string | null
          protest_title_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          message?: string | null
          protest_title_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          message?: string | null
          protest_title_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protest_logs_protest_title_id_fkey"
            columns: ["protest_title_id"]
            isOneToOne: false
            referencedRelation: "protest_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protest_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protest_titles: {
        Row: {
          cancelled_at: string | null
          cartorio: string | null
          cenprot_protocol: string | null
          client_id: string | null
          cpf: string
          created_at: string
          created_by: string | null
          credor: string
          data_vencimento: string
          especie: string | null
          id: string
          nome_devedor: string
          numero_titulo: string | null
          protested_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          cancelled_at?: string | null
          cartorio?: string | null
          cenprot_protocol?: string | null
          client_id?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          credor: string
          data_vencimento: string
          especie?: string | null
          id?: string
          nome_devedor: string
          numero_titulo?: string | null
          protested_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cancelled_at?: string | null
          cartorio?: string | null
          cenprot_protocol?: string | null
          client_id?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          credor?: string
          data_vencimento?: string
          especie?: string | null
          id?: string
          nome_devedor?: string
          numero_titulo?: string | null
          protested_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "protest_titles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protest_titles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          shortcut: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          shortcut: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          shortcut?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metric: string
          name: string
          period: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric?: string
          name: string
          period?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric?: string
          name?: string
          period?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rivocoin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          profile_id: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rivocoin_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rivocoin_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rivocoin_wallets: {
        Row: {
          balance: number
          id: string
          profile_id: string
          tenant_id: string
          total_earned: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          profile_id: string
          tenant_id: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          profile_id?: string
          tenant_id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rivocoin_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rivocoin_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sa_modules: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
          route_path: string | null
          sidebar_group: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          route_path?: string | null
          sidebar_group: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          route_path?: string | null
          sidebar_group?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      sa_user_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          granted_by: string | null
          id: string
          module_slug: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          module_slug: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          module_slug?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sa_user_permissions_module_slug_fkey"
            columns: ["module_slug"]
            isOneToOne: false
            referencedRelation: "sa_modules"
            referencedColumns: ["slug"]
          },
        ]
      }
      scripts_abordagem: {
        Row: {
          canal: string
          conteudo: string
          created_at: string
          credor_id: string | null
          id: string
          is_active: boolean
          tenant_id: string
          tipo_devedor_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          canal?: string
          conteudo?: string
          created_at?: string
          credor_id?: string | null
          id?: string
          is_active?: boolean
          tenant_id: string
          tipo_devedor_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Update: {
          canal?: string
          conteudo?: string
          created_at?: string
          credor_id?: string | null
          id?: string
          is_active?: boolean
          tenant_id?: string
          tipo_devedor_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_abordagem_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_abordagem_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_abordagem_tipo_devedor_id_fkey"
            columns: ["tipo_devedor_id"]
            isOneToOne: false
            referencedRelation: "tipos_devedor"
            referencedColumns: ["id"]
          },
        ]
      }
      serasa_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          details: Json | null
          id: string
          message: string | null
          serasa_record_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          message?: string | null
          serasa_record_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          message?: string | null
          serasa_record_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serasa_logs_serasa_record_id_fkey"
            columns: ["serasa_record_id"]
            isOneToOne: false
            referencedRelation: "serasa_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serasa_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      serasa_records: {
        Row: {
          client_id: string | null
          cpf: string
          created_at: string
          created_by: string | null
          credor: string
          data_vencimento: string
          id: string
          natureza_operacao: string | null
          negativated_at: string | null
          nome_devedor: string
          numero_contrato: string | null
          rejection_reason: string | null
          removed_at: string | null
          serasa_protocol: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          client_id?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          credor: string
          data_vencimento: string
          id?: string
          natureza_operacao?: string | null
          negativated_at?: string | null
          nome_devedor: string
          numero_contrato?: string | null
          rejection_reason?: string | null
          removed_at?: string | null
          serasa_protocol?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          client_id?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          credor?: string
          data_vencimento?: string
          id?: string
          natureza_operacao?: string | null
          negativated_at?: string | null
          nome_devedor?: string
          numero_contrato?: string | null
          rejection_reason?: string | null
          removed_at?: string | null
          serasa_protocol?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "serasa_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serasa_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          price: number
          price_type: string
          service_code: string
          tokens_required: number
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          price?: number
          price_type?: string
          service_code: string
          tokens_required?: number
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          price?: number
          price_type?: string
          service_code?: string
          tokens_required?: number
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_usage_logs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_data: Json | null
          output_data: Json | null
          service_code: string
          status: string
          target_entity_id: string | null
          target_entity_type: string | null
          tenant_id: string
          tokens_consumed: number
          usage_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          service_code: string
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          tenant_id: string
          tokens_consumed?: number
          usage_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          service_code?: string
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          tenant_id?: string
          tokens_consumed?: number
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          price_paid: number
          product_id: string
          profile_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          price_paid: number
          product_id: string
          profile_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          price_paid?: number
          product_id?: string
          profile_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_rivocoins: number
          stock: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_rivocoins?: number
          stock?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_rivocoins?: number
          stock?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_staff: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_schedule_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          preferred_date: string
          status: string
          subject: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          preferred_date: string
          status?: string
          subject: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          preferred_date?: string
          status?: string
          subject?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_schedule_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          priority: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          category: string | null
          created_at: string | null
          depends_on: string[] | null
          description: string | null
          icon: string | null
          id: string
          is_core: boolean | null
          name: string
          parent_slug: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          description?: string | null
          icon?: string | null
          id?: string
          is_core?: boolean | null
          name: string
          parent_slug?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          description?: string | null
          icon?: string | null
          id?: string
          is_core?: boolean | null
          name?: string
          parent_slug?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      tenant_modules: {
        Row: {
          enabled: boolean | null
          enabled_at: string | null
          enabled_by: string | null
          id: string
          module_id: string
          tenant_id: string
        }
        Insert: {
          enabled?: boolean | null
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          module_id: string
          tenant_id: string
        }
        Update: {
          enabled?: boolean | null
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          module_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_services: {
        Row: {
          activated_at: string
          cancelled_at: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          quantity: number
          service_id: string
          status: string
          tenant_id: string
          unit_price_override: number | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          cancelled_at?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          service_id: string
          status?: string
          tenant_id: string
          unit_price_override?: number | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          cancelled_at?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string
          status?: string
          tenant_id?: string
          unit_price_override?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_tokens: {
        Row: {
          auto_recharge_amount: number | null
          auto_recharge_enabled: boolean | null
          created_at: string
          id: string
          last_consumption_at: string | null
          last_purchase_at: string | null
          lifetime_consumed: number
          lifetime_purchased: number
          low_balance_threshold: number | null
          reserved_balance: number
          tenant_id: string
          token_balance: number
          updated_at: string
        }
        Insert: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          created_at?: string
          id?: string
          last_consumption_at?: string | null
          last_purchase_at?: string | null
          lifetime_consumed?: number
          lifetime_purchased?: number
          low_balance_threshold?: number | null
          reserved_balance?: number
          tenant_id: string
          token_balance?: number
          updated_at?: string
        }
        Update: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          created_at?: string
          id?: string
          last_consumption_at?: string | null
          last_purchase_at?: string | null
          lifetime_consumed?: number
          lifetime_purchased?: number
          low_balance_threshold?: number | null
          reserved_balance?: number
          tenant_id?: string
          token_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cnpj: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan_id: string | null
          primary_color: string | null
          settings: Json | null
          slug: string
          status: string
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan_id?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan_id?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_devedor: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_devedor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_divida: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_divida_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_status: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          regras: Json | null
          tenant_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          regras?: Json | null
          tenant_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          regras?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      token_packages: {
        Row: {
          bonus_tokens: number
          created_at: string
          description: string | null
          discount_percentage: number | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          token_amount: number
        }
        Insert: {
          bonus_tokens?: number
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price: number
          token_amount: number
        }
        Update: {
          bonus_tokens?: number
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          token_amount?: number
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          service_code: string | null
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          service_code?: string | null
          tenant_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          service_code?: string | null
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          action_detail: string | null
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          page_path: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action_detail?: string | null
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action_detail?: string | null
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          actions: string[]
          created_at: string
          id: string
          module: string
          profile_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actions?: string[]
          created_at?: string
          id?: string
          module: string
          profile_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actions?: string[]
          created_at?: string
          id?: string
          module?: string
          profile_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          api_key: string
          created_at: string
          id: string
          instance_name: string
          instance_url: string
          is_default: boolean
          name: string
          phone_number: string | null
          provider: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_url: string
          is_default?: boolean
          name?: string
          phone_number?: string | null
          provider?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_url?: string
          is_default?: boolean
          name?: string
          phone_number?: string | null
          provider?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          current_node_id: string | null
          error_message: string | null
          execution_log: Json | null
          id: string
          next_run_at: string | null
          started_at: string
          status: string
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          current_node_id?: string | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          next_run_at?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          workflow_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          current_node_id?: string | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          next_run_at?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_flows: {
        Row: {
          created_at: string
          description: string | null
          edges: Json | null
          id: string
          is_active: boolean | null
          name: string
          nodes: Json | null
          tenant_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          edges?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          nodes?: Json | null
          tenant_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          edges?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          nodes?: Json | null
          tenant_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_flows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_tokens: {
        Args: {
          p_amount: number
          p_description: string
          p_metadata?: Json
          p_reference_id?: string
          p_tenant_id: string
          p_transaction_type: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
          transaction_id: string
        }[]
      }
      check_token_balance: {
        Args: { p_required_amount: number; p_tenant_id: string }
        Returns: {
          current_balance: number
          has_sufficient_balance: boolean
          shortfall: number
        }[]
      }
      consume_tokens: {
        Args: {
          p_amount: number
          p_description: string
          p_metadata?: Json
          p_reference_id?: string
          p_reference_type?: string
          p_service_code: string
          p_tenant_id: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
          transaction_id: string
        }[]
      }
      create_notification: {
        Args: {
          _message: string
          _reference_id?: string
          _reference_type?: string
          _tenant_id: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      get_analytics_payments: {
        Args: { _tenant_id: string }
        Returns: {
          agreement_id: string
          created_at: string
          created_by: string
          credor: string
          original_total: number
          proposed_total: number
          status: string
          total_pago: number
        }[]
      }
      get_dashboard_stats: {
        Args: { _month?: number; _user_id?: string; _year?: number }
        Returns: {
          acordos_dia: number
          acordos_mes: number
          total_negociado: number
          total_negociado_mes: number
          total_pendente: number
          total_projetado: number
          total_quebra: number
          total_recebido: number
        }[]
      }
      get_dashboard_vencimentos: {
        Args: { _target_date: string; _user_id?: string }
        Returns: {
          agreement_id: string
          agreement_status: string
          client_cpf: string
          client_name: string
          credor: string
          numero_parcela: number
          valor_parcela: number
        }[]
      }
      get_my_enabled_modules: { Args: never; Returns: string[] }
      get_my_permission_profile: {
        Args: never
        Returns: {
          base_role: string
          id: string
          is_default: boolean
          name: string
          permissions: Json
        }[]
      }
      get_my_permissions: {
        Args: never
        Returns: {
          actions: string[]
          module: string
        }[]
      }
      get_my_profile_id: { Args: never; Returns: string }
      get_my_sa_permissions: {
        Args: never
        Returns: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module_slug: string
        }[]
      }
      get_my_tenant_id: { Args: never; Returns: string }
      get_my_tenant_role: { Args: never; Returns: string }
      get_tenant_token_summary: {
        Args: { p_tenant_id: string }
        Returns: {
          available: number
          balance: number
          last_30_days_consumed: number
          reserved: number
          total_consumed: number
          total_purchased: number
        }[]
      }
      get_user_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_tenant_data: {
        Args: never
        Returns: {
          tu_created_at: string
          tu_id: string
          tu_role: Database["public"]["Enums"]["tenant_role"]
          tu_tenant_id: string
          tu_user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_agreement_by_token: {
        Args: { _token: string }
        Returns: {
          checkout_token: string
          client_cpf: string
          client_name: string
          credor: string
          discount_percent: number
          entrada_date: string
          entrada_value: number
          first_due_date: string
          id: string
          new_installment_value: number
          new_installments: number
          notes: string
          original_total: number
          portal_origin: boolean
          proposed_total: number
          status: string
          tenant_id: string
        }[]
      }
      lookup_invite_by_token: {
        Args: { _token: string }
        Returns: {
          created_by: string
          expires_at: string
          id: string
          role: string
          tenant_id: string
          used_by: string
        }[]
      }
      lookup_tenant_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          plan_id: string
          primary_color: string
          slug: string
        }[]
      }
      onboard_tenant: {
        Args: { _cnpj?: string; _name: string; _plan_id: string; _slug: string }
        Returns: string
      }
      seed_default_permission_profiles: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "operador"
      client_status: "pendente" | "pago" | "quebrado" | "vencido" | "em_acordo"
      tenant_role:
        | "super_admin"
        | "admin"
        | "operador"
        | "gerente"
        | "supervisor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operador"],
      client_status: ["pendente", "pago", "quebrado", "vencido", "em_acordo"],
      tenant_role: [
        "super_admin",
        "admin",
        "operador",
        "gerente",
        "supervisor",
      ],
    },
  },
} as const
