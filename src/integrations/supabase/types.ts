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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_accounts: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          marketplace_id: string
          name: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          marketplace_id: string
          name: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          marketplace_id?: string
          name?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_accounts_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_credentials: {
        Row: {
          affiliate_account_id: string
          created_at: string
          credential_type: string
          encrypted_payload: string | null
          expires_at: string | null
          id: string
          provider: string
          secret_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_account_id: string
          created_at?: string
          credential_type?: string
          encrypted_payload?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          secret_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_account_id?: string
          created_at?: string
          credential_type?: string
          encrypted_payload?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          secret_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_credentials_affiliate_account_id_fkey"
            columns: ["affiliate_account_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          affiliate_url: string | null
          created_at: string
          id: string
          marketplace_id: string | null
          original_url: string
          product_id: string | null
          status: Database["public"]["Enums"]["link_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          created_at?: string
          id?: string
          marketplace_id?: string | null
          original_url: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_url?: string | null
          created_at?: string
          id?: string
          marketplace_id?: string | null
          original_url?: string
          product_id?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          automation_id: string
          configuration: Json
          created_at: string
          id: string
          operator: string
          type: string
          updated_at: string
          value: string | null
        }
        Insert: {
          automation_id: string
          configuration?: Json
          created_at?: string
          id?: string
          operator?: string
          type: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          automation_id?: string
          configuration?: Json
          created_at?: string
          id?: string
          operator?: string
          type?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          configuration: Json
          created_at: string
          description: string | null
          destination_id: string | null
          id: string
          last_run_at: string | null
          name: string
          source_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          description?: string | null
          destination_id?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          description?: string | null
          destination_id?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          name: string
          preview_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          name: string
          preview_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          name?: string
          preview_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      converted_offers: {
        Row: {
          created_at: string | null
          id: string
          links: Json
          mode: string
          processed_text: string
          response_time_ms: number | null
          source_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          links?: Json
          mode?: string
          processed_text: string
          response_time_ms?: number | null
          source_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          links?: Json
          mode?: string
          processed_text?: string
          response_time_ms?: number | null
          source_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          identifier: string | null
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["destination_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          identifier?: string | null
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["destination_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          identifier?: string | null
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["destination_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplaces: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      meli_queue: {
        Row: {
          created_at: string | null
          id: string
          last_error: string | null
          mode: string
          result_links: Json | null
          source_links: Json
          source_text: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_error?: string | null
          mode?: string
          result_links?: Json | null
          source_links?: Json
          source_text: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_error?: string | null
          mode?: string
          result_links?: Json | null
          source_links?: Json
          source_text?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meli_sessions: {
        Row: {
          alert_email: string | null
          cookies: string | null
          created_at: string
          id: string
          last_error: string | null
          last_validated_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_email?: string | null
          cookies?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_email?: string | null
          cookies?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monitors: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          last_activity_at: string | null
          name: string
          source_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          last_activity_at?: string | null
          name: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          last_activity_at?: string | null
          name?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitors_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_media: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          position: number
          type: Database["public"]["Enums"]["media_type"]
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          position?: number
          type?: Database["public"]["Enums"]["media_type"]
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          position?: number
          type?: Database["public"]["Enums"]["media_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_media_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          affiliate_url: string | null
          captured_at: string
          coupon: string | null
          created_at: string
          currency: string
          discount_percentage: number | null
          id: string
          marketplace_id: string | null
          original_price: number | null
          original_url: string | null
          processed_at: string | null
          product_id: string | null
          sale_price: number | null
          source_id: string | null
          status: Database["public"]["Enums"]["offer_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          captured_at?: string
          coupon?: string | null
          created_at?: string
          currency?: string
          discount_percentage?: number | null
          id?: string
          marketplace_id?: string | null
          original_price?: number | null
          original_url?: string | null
          processed_at?: string | null
          product_id?: string | null
          sale_price?: number | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_url?: string | null
          captured_at?: string
          coupon?: string | null
          created_at?: string
          currency?: string
          discount_percentage?: number | null
          id?: string
          marketplace_id?: string | null
          original_price?: number | null
          original_url?: string | null
          processed_at?: string | null
          product_id?: string | null
          sale_price?: number | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_sessions: {
        Row: {
          cookies: string
          created_at: string
          id: string
          platform: string
          updated_at: string
          user_agent: string
          user_id: string | null
        }
        Insert: {
          cookies: string
          created_at?: string
          id?: string
          platform: string
          updated_at?: string
          user_agent: string
          user_id?: string | null
        }
        Update: {
          cookies?: string
          created_at?: string
          id?: string
          platform?: string
          updated_at?: string
          user_agent?: string
          user_id?: string | null
        }
        Relationships: []
      }
      processed_messages: {
        Row: {
          content_hash: string
          created_at: string
          external_message_id: string | null
          id: string
          processed_at: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          processed_at?: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          processed_at?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_messages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          marketplace_id: string | null
          product_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          marketplace_id?: string | null
          product_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          marketplace_id?: string | null
          product_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          automation_id: string | null
          content: string | null
          created_at: string
          destination_id: string | null
          discussion_chat_id: number | null
          discussion_message_id: number | null
          error_message: string | null
          id: string
          offer_id: string | null
          published_at: string | null
          remote_chat_id: number | null
          remote_message_id: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          content?: string | null
          created_at?: string
          destination_id?: string | null
          discussion_chat_id?: number | null
          discussion_message_id?: number | null
          error_message?: string | null
          id?: string
          offer_id?: string | null
          published_at?: string | null
          remote_chat_id?: number | null
          remote_message_id?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_id?: string | null
          content?: string | null
          created_at?: string
          destination_id?: string | null
          discussion_chat_id?: number | null
          discussion_message_id?: number | null
          error_message?: string | null
          id?: string
          offer_id?: string | null
          published_at?: string | null
          remote_chat_id?: number | null
          remote_message_id?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          identifier: string | null
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["source_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          identifier?: string | null
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          identifier?: string | null
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_all_user_offers: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      account_status: "disconnected" | "connected" | "error"
      destination_type: "telegram" | "whatsapp" | "other"
      entity_status: "active" | "paused" | "error"
      job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      link_status: "pending" | "generated" | "error"
      media_type: "image" | "video" | "thumbnail"
      offer_status:
        | "captured"
        | "processing"
        | "processed"
        | "approved"
        | "rejected"
        | "published"
        | "error"
      publication_status:
        | "pending"
        | "processing"
        | "published"
        | "failed"
        | "cancelled"
      source_type:
        | "telegram"
        | "whatsapp"
        | "api"
        | "feed"
        | "manual"
        | "amazon"
        | "shopee"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["disconnected", "connected", "error"],
      destination_type: ["telegram", "whatsapp", "other"],
      entity_status: ["active", "paused", "error"],
      job_status: ["pending", "processing", "completed", "failed", "cancelled"],
      link_status: ["pending", "generated", "error"],
      media_type: ["image", "video", "thumbnail"],
      offer_status: [
        "captured",
        "processing",
        "processed",
        "approved",
        "rejected",
        "published",
        "error",
      ],
      publication_status: [
        "pending",
        "processing",
        "published",
        "failed",
        "cancelled",
      ],
      source_type: ["telegram", "whatsapp", "api", "feed", "manual", "amazon", "shopee"],
    },
  },
} as const
