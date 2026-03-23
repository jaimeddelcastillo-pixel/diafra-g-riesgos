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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_trail: {
        Row: {
          accion: string
          created_at: string
          id: string
          ip: string | null
          registro_id: string
          tabla: string
          user_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          ip?: string | null
          registro_id: string
          tabla: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          ip?: string | null
          registro_id?: string
          tabla?: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: []
      }
      folio_comite: {
        Row: {
          cargo: string
          created_at: string
          fecha_firma: string | null
          firmado: boolean
          folio_id: string
          id: string
          nombre: string
          responsabilidad: string
          user_id: string | null
        }
        Insert: {
          cargo: string
          created_at?: string
          fecha_firma?: string | null
          firmado?: boolean
          folio_id: string
          id?: string
          nombre: string
          responsabilidad: string
          user_id?: string | null
        }
        Update: {
          cargo?: string
          created_at?: string
          fecha_firma?: string | null
          firmado?: boolean
          folio_id?: string
          id?: string
          nombre?: string
          responsabilidad?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folio_comite_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_sequence: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      folios: {
        Row: {
          alcance: string | null
          codigo: string
          conclusion: string | null
          control_cambios_id: string | null
          created_at: string
          created_by: string | null
          desviacion_id: string | null
          estado: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre: string | null
          fecha_inicio: string
          id: string
          justificacion_tecnica: string | null
          origen: Database["public"]["Enums"]["origen_riesgo"]
          proceso_equipo: string
          updated_at: string
        }
        Insert: {
          alcance?: string | null
          codigo: string
          conclusion?: string | null
          control_cambios_id?: string | null
          created_at?: string
          created_by?: string | null
          desviacion_id?: string | null
          estado?: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre?: string | null
          fecha_inicio?: string
          id?: string
          justificacion_tecnica?: string | null
          origen: Database["public"]["Enums"]["origen_riesgo"]
          proceso_equipo: string
          updated_at?: string
        }
        Update: {
          alcance?: string | null
          codigo?: string
          conclusion?: string | null
          control_cambios_id?: string | null
          created_at?: string
          created_by?: string | null
          desviacion_id?: string | null
          estado?: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre?: string | null
          fecha_inicio?: string
          id?: string
          justificacion_tecnica?: string | null
          origen?: Database["public"]["Enums"]["origen_riesgo"]
          proceso_equipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email: string
          id: string
          nombre: string
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      riesgos: {
        Row: {
          accion_implementada: string | null
          accion_propuesta: string | null
          anexos: Json | null
          causa_potencial: string
          controles_actuales: string | null
          created_at: string
          det_residual: number
          deteccion: number
          dictamen: Database["public"]["Enums"]["dictamen_tipo"]
          efecto_dano: string
          etapa_proceso: string
          fecha_compromiso: string | null
          fecha_evidencia: string | null
          folio_id: string
          id: string
          npr: number | null
          npr_residual: number | null
          numero_id: number
          ocu_residual: number
          ocurrencia: number
          peligro_modo_falla: string
          requiere_accion: boolean
          responsable: string | null
          sev_residual: number
          severidad: number
          updated_at: string
        }
        Insert: {
          accion_implementada?: string | null
          accion_propuesta?: string | null
          anexos?: Json | null
          causa_potencial?: string
          controles_actuales?: string | null
          created_at?: string
          det_residual?: number
          deteccion?: number
          dictamen?: Database["public"]["Enums"]["dictamen_tipo"]
          efecto_dano?: string
          etapa_proceso?: string
          fecha_compromiso?: string | null
          fecha_evidencia?: string | null
          folio_id: string
          id?: string
          npr?: number | null
          npr_residual?: number | null
          numero_id?: number
          ocu_residual?: number
          ocurrencia?: number
          peligro_modo_falla?: string
          requiere_accion?: boolean
          responsable?: string | null
          sev_residual?: number
          severidad?: number
          updated_at?: string
        }
        Update: {
          accion_implementada?: string | null
          accion_propuesta?: string | null
          anexos?: Json | null
          causa_potencial?: string
          controles_actuales?: string | null
          created_at?: string
          det_residual?: number
          deteccion?: number
          dictamen?: Database["public"]["Enums"]["dictamen_tipo"]
          efecto_dano?: string
          etapa_proceso?: string
          fecha_compromiso?: string | null
          fecha_evidencia?: string | null
          folio_id?: string
          id?: string
          npr?: number | null
          npr_residual?: number | null
          numero_id?: number
          ocu_residual?: number
          ocurrencia?: number
          peligro_modo_falla?: string
          requiere_accion?: boolean
          responsable?: string | null
          sev_residual?: number
          severidad?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riesgos_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_folio_code: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "comite_tecnico" | "operador" | "lectura"
      dictamen_tipo: "Aceptable" | "No Aceptable" | "Pendiente"
      estado_folio: "Borrador" | "En Firma" | "Aprobado" | "Cerrado"
      origen_riesgo:
        | "Diseño"
        | "Proceso"
        | "Queja / Devolución"
        | "Desviación"
        | "Control de Cambios"
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
      app_role: ["admin", "comite_tecnico", "operador", "lectura"],
      dictamen_tipo: ["Aceptable", "No Aceptable", "Pendiente"],
      estado_folio: ["Borrador", "En Firma", "Aprobado", "Cerrado"],
      origen_riesgo: [
        "Diseño",
        "Proceso",
        "Queja / Devolución",
        "Desviación",
        "Control de Cambios",
      ],
    },
  },
} as const
