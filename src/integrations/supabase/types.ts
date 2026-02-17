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
          approved_by: string | null
          checkout_token: string | null
          client_cpf: string
          client_name: string
          created_at: string
          created_by: string
          credor: string
          discount_percent: number | null
          first_due_date: string
          id: string
          new_installment_value: number
          new_installments: number
          notes: string | null
          original_total: number
          portal_origin: boolean
          proposed_total: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          checkout_token?: string | null
          client_cpf: string
          client_name: string
          created_at?: string
          created_by: string
          credor: string
          discount_percent?: number | null
          first_due_date: string
          id?: string
          new_installment_value?: number
          new_installments?: number
          notes?: string | null
          original_total?: number
          portal_origin?: boolean
          proposed_total?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          checkout_token?: string | null
          client_cpf?: string
          client_name?: string
          created_at?: string
          created_by?: string
          credor?: string
          discount_percent?: number | null
          first_due_date?: string
          id?: string
          new_installment_value?: number
          new_installments?: number
          notes?: string | null
          original_total?: number
          portal_origin?: boolean
          proposed_total?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_tenant_id_fkey"
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
            foreignKeyName: "call_dispositions_tenant_id_fkey"
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
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          client_cpf: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          client_cpf?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf: string
          created_at: string
          credor: string
          data_vencimento: string
          email: string | null
          endereco: string | null
          external_id: string | null
          id: string
          nome_completo: string
          numero_parcela: number
          observacoes: string | null
          operator_id: string | null
          phone: string | null
          propensity_score: number | null
          quebra: number | null
          status: Database["public"]["Enums"]["client_status"]
          status_cobranca_id: string | null
          status_cobranca_locked_at: string | null
          status_cobranca_locked_by: string | null
          tenant_id: string | null
          tipo_devedor_id: string | null
          tipo_divida_id: string | null
          total_parcelas: number
          uf: string | null
          updated_at: string
          valor_entrada: number
          valor_pago: number
          valor_parcela: number
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf: string
          created_at?: string
          credor?: string
          data_vencimento: string
          email?: string | null
          endereco?: string | null
          external_id?: string | null
          id?: string
          nome_completo: string
          numero_parcela?: number
          observacoes?: string | null
          operator_id?: string | null
          phone?: string | null
          propensity_score?: number | null
          quebra?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          status_cobranca_id?: string | null
          status_cobranca_locked_at?: string | null
          status_cobranca_locked_by?: string | null
          tenant_id?: string | null
          tipo_devedor_id?: string | null
          tipo_divida_id?: string | null
          total_parcelas?: number
          uf?: string | null
          updated_at?: string
          valor_entrada?: number
          valor_pago?: number
          valor_parcela?: number
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf?: string
          created_at?: string
          credor?: string
          data_vencimento?: string
          email?: string | null
          endereco?: string | null
          external_id?: string | null
          id?: string
          nome_completo?: string
          numero_parcela?: number
          observacoes?: string | null
          operator_id?: string | null
          phone?: string | null
          propensity_score?: number | null
          quebra?: number | null
          status?: Database["public"]["Enums"]["client_status"]
          status_cobranca_id?: string | null
          status_cobranca_locked_at?: string | null
          status_cobranca_locked_by?: string | null
          tenant_id?: string | null
          tipo_devedor_id?: string | null
          tipo_divida_id?: string | null
          total_parcelas?: number
          uf?: string | null
          updated_at?: string
          valor_entrada?: number
          valor_pago?: number
          valor_parcela?: number
        }
        Relationships: [
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
          instance_id: string
          last_message_at: string | null
          remote_name: string
          remote_phone: string
          sla_deadline_at: string | null
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
          instance_id: string
          last_message_at?: string | null
          remote_name?: string
          remote_phone: string
          sla_deadline_at?: string | null
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
          instance_id?: string
          last_message_at?: string | null
          remote_name?: string
          remote_phone?: string
          sla_deadline_at?: string | null
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
          bairro: string | null
          banco: string | null
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
          razao_social: string
          signature_enabled: boolean | null
          signature_type: string | null
          status: string
          telefone: string | null
          template_acordo: string | null
          template_descricao_divida: string | null
          template_quitacao: string | null
          template_recibo: string | null
          tenant_id: string
          tipo_conta: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
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
          razao_social: string
          signature_enabled?: boolean | null
          signature_type?: string | null
          status?: string
          telefone?: string | null
          template_acordo?: string | null
          template_descricao_divida?: string | null
          template_quitacao?: string | null
          template_recibo?: string | null
          tenant_id: string
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
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
          razao_social?: string
          signature_enabled?: boolean | null
          signature_type?: string | null
          status?: string
          telefone?: string | null
          template_acordo?: string | null
          template_descricao_divida?: string | null
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
          callback_data: Json | null
          client_id: string | null
          created_at: string
          data_vencimento: string
          id: string
          id_geral: string
          id_parcela: string | null
          id_status: number | null
          linha_digitavel: string | null
          link_boleto: string | null
          link_cartao: string | null
          pix_copia_cola: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          callback_data?: Json | null
          client_id?: string | null
          created_at?: string
          data_vencimento: string
          id?: string
          id_geral: string
          id_parcela?: string | null
          id_status?: number | null
          linha_digitavel?: string | null
          link_boleto?: string | null
          link_cartao?: string | null
          pix_copia_cola?: string | null
          status?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
          valor: number
        }
        Update: {
          callback_data?: Json | null
          client_id?: string | null
          created_at?: string
          data_vencimento?: string
          id?: string
          id_geral?: string
          id_parcela?: string | null
          id_status?: number | null
          linha_digitavel?: string | null
          link_boleto?: string | null
          link_cartao?: string | null
          pix_copia_cola?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
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
          created_at: string
          full_name: string
          id: string
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
          created_at?: string
          full_name?: string
          id?: string
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
          created_at?: string
          full_name?: string
          id?: string
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
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      get_my_profile_id: { Args: never; Returns: string }
      get_my_tenant_id: { Args: never; Returns: string }
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
      onboard_tenant: {
        Args: { _name: string; _plan_id: string; _slug: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "operador"
      client_status: "pendente" | "pago" | "quebrado"
      tenant_role: "super_admin" | "admin" | "operador"
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
      client_status: ["pendente", "pago", "quebrado"],
      tenant_role: ["super_admin", "admin", "operador"],
    },
  },
} as const
