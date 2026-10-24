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
      addon_archivos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string
          id: string
          mime_type: string | null
          nombre: string
          orden: number
          producto: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          id?: string
          mime_type?: string | null
          nombre: string
          orden?: number
          producto: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          id?: string
          mime_type?: string | null
          nombre?: string
          orden?: number
          producto?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      addon_purchases: {
        Row: {
          id: string
          metadata: Json | null
          monto_usd: number
          org_id: string
          producto: string
          purchased_at: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          monto_usd: number
          org_id: string
          producto: string
          purchased_at?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          monto_usd?: number
          org_id?: string
          producto?: string
          purchased_at?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_purchases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts: {
        Row: {
          activo: boolean
          aprobado_en: string | null
          aprobado_por: string | null
          created_at: string
          estado: string
          id: string
          motivo_cambio: string | null
          nombre: string
          sha256: string | null
          system_prompt: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          activo?: boolean
          aprobado_en?: string | null
          aprobado_por?: string | null
          created_at?: string
          estado?: string
          id?: string
          motivo_cambio?: string | null
          nombre: string
          sha256?: string | null
          system_prompt: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Update: {
          activo?: boolean
          aprobado_en?: string | null
          aprobado_por?: string | null
          created_at?: string
          estado?: string
          id?: string
          motivo_cambio?: string | null
          nombre?: string
          sha256?: string | null
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompts_nombre_fkey"
            columns: ["nombre"]
            isOneToOne: false
            referencedRelation: "ia_skills"
            referencedColumns: ["clave"]
          },
        ]
      }
      audit_trail: {
        Row: {
          accion: string
          autorizado_por: string | null
          created_at: string
          id: string
          ip: string | null
          motivo: string | null
          org_id: string | null
          origen: string
          registro_id: string
          solicitado_por: string | null
          suplencias: Json | null
          tabla: string
          user_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          autorizado_por?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          motivo?: string | null
          org_id?: string | null
          origen?: string
          registro_id: string
          solicitado_por?: string | null
          suplencias?: Json | null
          tabla: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          autorizado_por?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          motivo?: string | null
          org_id?: string | null
          origen?: string
          registro_id?: string
          solicitado_por?: string | null
          suplencias?: Json | null
          tabla?: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_items: {
        Row: {
          agregado_por: string | null
          auditoria_id: string
          created_at: string
          entidad_id: string
          id: string
          incluir_evidencias: boolean
          org_id: string
          tipo: string
        }
        Insert: {
          agregado_por?: string | null
          auditoria_id: string
          created_at?: string
          entidad_id: string
          id?: string
          incluir_evidencias?: boolean
          org_id: string
          tipo: string
        }
        Update: {
          agregado_por?: string | null
          auditoria_id?: string
          created_at?: string
          entidad_id?: string
          id?: string
          incluir_evidencias?: boolean
          org_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_items_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias_externas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias_externas: {
        Row: {
          activado_en: string | null
          activado_por: string | null
          auditor_email: string
          auditor_nombre: string
          auditor_organizacion: string | null
          auditor_user_id: string | null
          cerrado_en: string | null
          cerrado_por: string | null
          creado_por: string | null
          created_at: string
          duplicado_de: string | null
          estado: string
          expira_en: string
          id: string
          inicia_en: string
          motivo_cierre: string | null
          nombre: string
          org_id: string
          permite_descarga: boolean
        }
        Insert: {
          activado_en?: string | null
          activado_por?: string | null
          auditor_email: string
          auditor_nombre: string
          auditor_organizacion?: string | null
          auditor_user_id?: string | null
          cerrado_en?: string | null
          cerrado_por?: string | null
          creado_por?: string | null
          created_at?: string
          duplicado_de?: string | null
          estado?: string
          expira_en: string
          id?: string
          inicia_en?: string
          motivo_cierre?: string | null
          nombre: string
          org_id: string
          permite_descarga?: boolean
        }
        Update: {
          activado_en?: string | null
          activado_por?: string | null
          auditor_email?: string
          auditor_nombre?: string
          auditor_organizacion?: string | null
          auditor_user_id?: string | null
          cerrado_en?: string | null
          cerrado_por?: string | null
          creado_por?: string | null
          created_at?: string
          duplicado_de?: string | null
          estado?: string
          expira_en?: string
          id?: string
          inicia_en?: string
          motivo_cierre?: string | null
          nombre?: string
          org_id?: string
          permite_descarga?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_externas_duplicado_de_fkey"
            columns: ["duplicado_de"]
            isOneToOne: false
            referencedRelation: "auditorias_externas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditorias_externas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_areas: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          org_id: string
          responsable_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          org_id: string
          responsable_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          org_id?: string
          responsable_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_areas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_areas_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_assignment_processes: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          org_id: string
          process_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          org_id: string
          process_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          org_id?: string
          process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_assignment_processes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_assignment_processes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_assignment_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_contradictions: {
        Row: {
          afecta_cumplimiento: boolean
          afirmacion_a: string
          afirmacion_b: string
          area_id: string | null
          autoridad_requerida: string | null
          created_at: string
          decision_final: string | null
          descripcion: string | null
          document_id: string | null
          estado: string
          fuente_a: string | null
          fuente_b: string | null
          fundamento: string | null
          id: string
          item_a_id: string | null
          item_b_id: string | null
          org_id: string
          proceso_id: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          riesgo_potencial: string | null
          session_id: string | null
          tema: string | null
          turn_id: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          afecta_cumplimiento?: boolean
          afirmacion_a: string
          afirmacion_b: string
          area_id?: string | null
          autoridad_requerida?: string | null
          created_at?: string
          decision_final?: string | null
          descripcion?: string | null
          document_id?: string | null
          estado?: string
          fuente_a?: string | null
          fuente_b?: string | null
          fundamento?: string | null
          id?: string
          item_a_id?: string | null
          item_b_id?: string | null
          org_id: string
          proceso_id?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          riesgo_potencial?: string | null
          session_id?: string | null
          tema?: string | null
          turn_id?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          afecta_cumplimiento?: boolean
          afirmacion_a?: string
          afirmacion_b?: string
          area_id?: string | null
          autoridad_requerida?: string | null
          created_at?: string
          decision_final?: string | null
          descripcion?: string | null
          document_id?: string | null
          estado?: string
          fuente_a?: string | null
          fuente_b?: string | null
          fundamento?: string | null
          id?: string
          item_a_id?: string | null
          item_b_id?: string | null
          org_id?: string
          proceso_id?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          riesgo_potencial?: string | null
          session_id?: string | null
          tema?: string | null
          turn_id?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_contradictions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "brain_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_item_a_id_fkey"
            columns: ["item_a_id"]
            isOneToOne: false
            referencedRelation: "brain_knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_item_b_id_fkey"
            columns: ["item_b_id"]
            isOneToOne: false
            referencedRelation: "brain_knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_contradictions_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_documents: {
        Row: {
          actualizado_por: string | null
          archivo_id: string | null
          archivo_nombre: string | null
          area_id: string | null
          codigo: string | null
          created_at: string
          enlace_comentario: string | null
          enlace_evidencia: string | null
          enlace_por_confirmar: boolean
          enlace_revision_detectada: string | null
          estado: string
          estado_confianza: string | null
          estado_evidencia: string | null
          estado_propuesto: string | null
          estado_propuesto_en: string | null
          fecha_documento: string | null
          id: string
          import_batch_id: string | null
          import_row_reference: number | null
          import_status: string | null
          nombre: string
          notas: string | null
          org_id: string
          origen: string
          proceso_id: string | null
          requiere_confirmacion: boolean
          revision: string | null
          storage_path: string | null
          tipo: string
          tipo_clave: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          archivo_id?: string | null
          archivo_nombre?: string | null
          area_id?: string | null
          codigo?: string | null
          created_at?: string
          enlace_comentario?: string | null
          enlace_evidencia?: string | null
          enlace_por_confirmar?: boolean
          enlace_revision_detectada?: string | null
          estado?: string
          estado_confianza?: string | null
          estado_evidencia?: string | null
          estado_propuesto?: string | null
          estado_propuesto_en?: string | null
          fecha_documento?: string | null
          id?: string
          import_batch_id?: string | null
          import_row_reference?: number | null
          import_status?: string | null
          nombre: string
          notas?: string | null
          org_id: string
          origen?: string
          proceso_id?: string | null
          requiere_confirmacion?: boolean
          revision?: string | null
          storage_path?: string | null
          tipo?: string
          tipo_clave?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          archivo_id?: string | null
          archivo_nombre?: string | null
          area_id?: string | null
          codigo?: string | null
          created_at?: string
          enlace_comentario?: string | null
          enlace_evidencia?: string | null
          enlace_por_confirmar?: boolean
          enlace_revision_detectada?: string | null
          estado?: string
          estado_confianza?: string | null
          estado_evidencia?: string | null
          estado_propuesto?: string | null
          estado_propuesto_en?: string | null
          fecha_documento?: string | null
          id?: string
          import_batch_id?: string | null
          import_row_reference?: number | null
          import_status?: string | null
          nombre?: string
          notas?: string | null
          org_id?: string
          origen?: string
          proceso_id?: string | null
          requiere_confirmacion?: boolean
          revision?: string | null
          storage_path?: string | null
          tipo?: string
          tipo_clave?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_documents_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "org_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_documents_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_documents_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "brain_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_documents_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_enlace_descartes: {
        Row: {
          archivo_id: string
          created_at: string
          descartado_por: string | null
          documento_id: string
          id: string
          org_id: string
        }
        Insert: {
          archivo_id: string
          created_at?: string
          descartado_por?: string | null
          documento_id: string
          id?: string
          org_id: string
        }
        Update: {
          archivo_id?: string
          created_at?: string
          descartado_por?: string | null
          documento_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_enlace_descartes_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "org_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_enlace_descartes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "brain_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_enlace_descartes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_exports: {
        Row: {
          contradicciones_incluidas: number
          created_at: string
          filtros: Json | null
          gaps_incluidos: number
          generado_por: string | null
          id: string
          items_incluidos: number
          memoria_viva_incluida: number
          nombre_archivo: string
          org_id: string
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          contradicciones_incluidas?: number
          created_at?: string
          filtros?: Json | null
          gaps_incluidos?: number
          generado_por?: string | null
          id?: string
          items_incluidos?: number
          memoria_viva_incluida?: number
          nombre_archivo: string
          org_id: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          contradicciones_incluidas?: number
          created_at?: string
          filtros?: Json | null
          gaps_incluidos?: number
          generado_por?: string | null
          id?: string
          items_incluidos?: number
          memoria_viva_incluida?: number
          nombre_archivo?: string
          org_id?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_exports_generado_por_fkey"
            columns: ["generado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_exports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_extracciones: {
        Row: {
          archivo_id: string
          created_at: string
          documento_id: string | null
          id: string
          metodo: string
          modelo: string
          modelo_ia: string | null
          org_id: string
          paginas_leidas: number | null
          paginas_totales: number | null
          sha256: string
          skills_usadas: Json | null
          solicitado_por: string
          texto: string | null
          truncado: boolean
        }
        Insert: {
          archivo_id: string
          created_at?: string
          documento_id?: string | null
          id?: string
          metodo: string
          modelo: string
          modelo_ia?: string | null
          org_id: string
          paginas_leidas?: number | null
          paginas_totales?: number | null
          sha256: string
          skills_usadas?: Json | null
          solicitado_por: string
          texto?: string | null
          truncado?: boolean
        }
        Update: {
          archivo_id?: string
          created_at?: string
          documento_id?: string | null
          id?: string
          metodo?: string
          modelo?: string
          modelo_ia?: string | null
          org_id?: string
          paginas_leidas?: number | null
          paginas_totales?: number | null
          sha256?: string
          skills_usadas?: Json | null
          solicitado_por?: string
          texto?: string | null
          truncado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brain_extracciones_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "org_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_extracciones_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "brain_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_extracciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_gaps: {
        Row: {
          area_id: string | null
          assignment_sugerido_id: string | null
          cerrada_en: string | null
          created_at: string
          descripcion: string
          estado: string
          id: string
          org_id: string
          por_que_importa: string | null
          prioridad: string
          proceso_id: string | null
          rol_sugerido: string | null
          session_id: string | null
          tipo_brecha: string
          tipo_conocimiento: string | null
          turn_id: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          assignment_sugerido_id?: string | null
          cerrada_en?: string | null
          created_at?: string
          descripcion: string
          estado?: string
          id?: string
          org_id: string
          por_que_importa?: string | null
          prioridad?: string
          proceso_id?: string | null
          rol_sugerido?: string | null
          session_id?: string | null
          tipo_brecha?: string
          tipo_conocimiento?: string | null
          turn_id?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          assignment_sugerido_id?: string | null
          cerrada_en?: string | null
          created_at?: string
          descripcion?: string
          estado?: string
          id?: string
          org_id?: string
          por_que_importa?: string | null
          prioridad?: string
          proceso_id?: string | null
          rol_sugerido?: string | null
          session_id?: string | null
          tipo_brecha?: string
          tipo_conocimiento?: string | null
          turn_id?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_gaps_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_gaps_assignment_sugerido_id_fkey"
            columns: ["assignment_sugerido_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_gaps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_gaps_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_gaps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_gaps_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_import_batches: {
        Row: {
          actualizado_por: string | null
          created_at: string
          estado: string
          filas_importadas: number
          formato: string
          id: string
          imported_by: string | null
          mapeo: Json
          nombre_archivo: string
          org_id: string
          storage_path: string | null
          tipo: string
          total_filas: number
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          created_at?: string
          estado?: string
          filas_importadas?: number
          formato: string
          id?: string
          imported_by?: string | null
          mapeo?: Json
          nombre_archivo: string
          org_id: string
          storage_path?: string | null
          tipo?: string
          total_filas?: number
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          created_at?: string
          estado?: string
          filas_importadas?: number
          formato?: string
          id?: string
          imported_by?: string | null
          mapeo?: Json
          nombre_archivo?: string
          org_id?: string
          storage_path?: string | null
          tipo?: string
          total_filas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_import_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_import_propuestas: {
        Row: {
          area_id: string | null
          batch_id: string
          created_at: string
          estado: string
          evidencia: string | null
          id: string
          nivel_confianza: string | null
          nombre: string
          org_id: string
          proceso_id: string | null
          tipo: string
        }
        Insert: {
          area_id?: string | null
          batch_id: string
          created_at?: string
          estado?: string
          evidencia?: string | null
          id?: string
          nivel_confianza?: string | null
          nombre: string
          org_id: string
          proceso_id?: string | null
          tipo: string
        }
        Update: {
          area_id?: string | null
          batch_id?: string
          created_at?: string
          estado?: string
          evidencia?: string | null
          id?: string
          nivel_confianza?: string | null
          nombre?: string
          org_id?: string
          proceso_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_import_propuestas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_import_propuestas_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "brain_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_import_propuestas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_import_propuestas_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_interview_assignments: {
        Row: {
          area_id: string | null
          asignado_automaticamente: boolean
          capa: string | null
          created_at: string
          dominios_conocimiento: string[]
          estado: string
          id: string
          nivel_autoridad: string | null
          nombre_externo: string | null
          org_id: string
          prioridad: string
          profile_id: string | null
          puesto: string | null
          razon_asignacion: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          asignado_automaticamente?: boolean
          capa?: string | null
          created_at?: string
          dominios_conocimiento?: string[]
          estado?: string
          id?: string
          nivel_autoridad?: string | null
          nombre_externo?: string | null
          org_id: string
          prioridad?: string
          profile_id?: string | null
          puesto?: string | null
          razon_asignacion?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          asignado_automaticamente?: boolean
          capa?: string | null
          created_at?: string
          dominios_conocimiento?: string[]
          estado?: string
          id?: string
          nivel_autoridad?: string | null
          nombre_externo?: string | null
          org_id?: string
          prioridad?: string
          profile_id?: string | null
          puesto?: string | null
          razon_asignacion?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_interview_assignments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_interview_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          role: string
          session_id: string
          turn_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          role: string
          session_id: string
          turn_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          role?: string
          session_id?: string
          turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_interview_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_messages_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_interview_sessions: {
        Row: {
          actualizado_por: string | null
          assignment_id: string | null
          capa: string | null
          created_at: string
          created_by: string | null
          entrevistado_area: string | null
          entrevistado_nombre: string | null
          entrevistado_profile_id: string | null
          entrevistado_puesto: string | null
          estado: string
          finalizada_en: string | null
          id: string
          iniciada_en: string
          interview_thread_id: string
          items_capturados: number
          metadata: Json
          nivel_autoridad: string | null
          objetivo_actual: string | null
          org_id: string
          preguntas_realizadas: number
          resumen: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          assignment_id?: string | null
          capa?: string | null
          created_at?: string
          created_by?: string | null
          entrevistado_area?: string | null
          entrevistado_nombre?: string | null
          entrevistado_profile_id?: string | null
          entrevistado_puesto?: string | null
          estado?: string
          finalizada_en?: string | null
          id?: string
          iniciada_en?: string
          interview_thread_id?: string
          items_capturados?: number
          metadata?: Json
          nivel_autoridad?: string | null
          objetivo_actual?: string | null
          org_id: string
          preguntas_realizadas?: number
          resumen?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          assignment_id?: string | null
          capa?: string | null
          created_at?: string
          created_by?: string | null
          entrevistado_area?: string | null
          entrevistado_nombre?: string | null
          entrevistado_profile_id?: string | null
          entrevistado_puesto?: string | null
          estado?: string
          finalizada_en?: string | null
          id?: string
          iniciada_en?: string
          interview_thread_id?: string
          items_capturados?: number
          metadata?: Json
          nivel_autoridad?: string | null
          objetivo_actual?: string | null
          org_id?: string
          preguntas_realizadas?: number
          resumen?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_interview_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_sessions_entrevistado_profile_id_fkey"
            columns: ["entrevistado_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_interview_turns: {
        Row: {
          completed_at: string | null
          contradictions_created: number
          created_at: string
          current_objective: Json | null
          error: string | null
          estado: string
          gaps_created: number
          id: string
          institutional_effects: boolean
          interviewees_suggested: number
          knowledge_created: number
          modelo_ia: string | null
          operations: Json
          org_id: string
          session_id: string
          skills_usadas: Json | null
          transcript_persisted: boolean
        }
        Insert: {
          completed_at?: string | null
          contradictions_created?: number
          created_at?: string
          current_objective?: Json | null
          error?: string | null
          estado?: string
          gaps_created?: number
          id: string
          institutional_effects?: boolean
          interviewees_suggested?: number
          knowledge_created?: number
          modelo_ia?: string | null
          operations?: Json
          org_id: string
          session_id: string
          skills_usadas?: Json | null
          transcript_persisted?: boolean
        }
        Update: {
          completed_at?: string | null
          contradictions_created?: number
          created_at?: string
          current_objective?: Json | null
          error?: string | null
          estado?: string
          gaps_created?: number
          id?: string
          institutional_effects?: boolean
          interviewees_suggested?: number
          knowledge_created?: number
          modelo_ia?: string | null
          operations?: Json
          org_id?: string
          session_id?: string
          skills_usadas?: Json | null
          transcript_persisted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brain_interview_turns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_interview_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_knowledge_items: {
        Row: {
          actualizado_por: string | null
          afecta_cumplimiento: boolean | null
          area_id: string | null
          codigo: string | null
          comentario_validacion: string | null
          contenido: string
          contexto: Json | null
          created_at: string
          created_from_turn_id: string | null
          estado: string
          estado_cambiado_en: string | null
          estado_cambiado_por: string | null
          folio_id: string | null
          id: string
          marco_validado: boolean
          motivo_estado: string | null
          motivo_invalidacion: string | null
          motivo_revision: string | null
          org_id: string
          proceso_id: string | null
          requiere_revision: boolean
          revision_comentario: string | null
          revision_confirmada: string | null
          revision_confirmada_en: string | null
          revision_confirmada_por: string | null
          riesgo_id: string | null
          sustituido_por_id: string | null
          tipo: string
          turn_id: string | null
          ultima_suplencia: Json | null
          updated_at: string
          validado_en: string | null
          validado_por: string | null
        }
        Insert: {
          actualizado_por?: string | null
          afecta_cumplimiento?: boolean | null
          area_id?: string | null
          codigo?: string | null
          comentario_validacion?: string | null
          contenido: string
          contexto?: Json | null
          created_at?: string
          created_from_turn_id?: string | null
          estado?: string
          estado_cambiado_en?: string | null
          estado_cambiado_por?: string | null
          folio_id?: string | null
          id?: string
          marco_validado?: boolean
          motivo_estado?: string | null
          motivo_invalidacion?: string | null
          motivo_revision?: string | null
          org_id: string
          proceso_id?: string | null
          requiere_revision?: boolean
          revision_comentario?: string | null
          revision_confirmada?: string | null
          revision_confirmada_en?: string | null
          revision_confirmada_por?: string | null
          riesgo_id?: string | null
          sustituido_por_id?: string | null
          tipo: string
          turn_id?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          validado_en?: string | null
          validado_por?: string | null
        }
        Update: {
          actualizado_por?: string | null
          afecta_cumplimiento?: boolean | null
          area_id?: string | null
          codigo?: string | null
          comentario_validacion?: string | null
          contenido?: string
          contexto?: Json | null
          created_at?: string
          created_from_turn_id?: string | null
          estado?: string
          estado_cambiado_en?: string | null
          estado_cambiado_por?: string | null
          folio_id?: string | null
          id?: string
          marco_validado?: boolean
          motivo_estado?: string | null
          motivo_invalidacion?: string | null
          motivo_revision?: string | null
          org_id?: string
          proceso_id?: string | null
          requiere_revision?: boolean
          revision_comentario?: string | null
          revision_confirmada?: string | null
          revision_confirmada_en?: string | null
          revision_confirmada_por?: string | null
          riesgo_id?: string | null
          sustituido_por_id?: string | null
          tipo?: string
          turn_id?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          validado_en?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_knowledge_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_created_from_turn_id_fkey"
            columns: ["created_from_turn_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_riesgo_id_fkey"
            columns: ["riesgo_id"]
            isOneToOne: false
            referencedRelation: "riesgos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_sustituido_por_id_fkey"
            columns: ["sustituido_por_id"]
            isOneToOne: false
            referencedRelation: "brain_knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_items_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_knowledge_sources: {
        Row: {
          archivo_id: string | null
          cita_textual: string | null
          created_at: string
          descripcion: string | null
          documento_codigo: string | null
          documento_id: string | null
          documento_revision: string | null
          extraccion_id: string | null
          id: string
          knowledge_item_id: string
          metodo: string | null
          nombre_fuente: string | null
          org_id: string
          pagina: number | null
          parrafo: number | null
          profile_id: string | null
          seccion: string | null
          session_id: string | null
          tipo_fuente: string
          ultima_suplencia: Json | null
        }
        Insert: {
          archivo_id?: string | null
          cita_textual?: string | null
          created_at?: string
          descripcion?: string | null
          documento_codigo?: string | null
          documento_id?: string | null
          documento_revision?: string | null
          extraccion_id?: string | null
          id?: string
          knowledge_item_id: string
          metodo?: string | null
          nombre_fuente?: string | null
          org_id: string
          pagina?: number | null
          parrafo?: number | null
          profile_id?: string | null
          seccion?: string | null
          session_id?: string | null
          tipo_fuente: string
          ultima_suplencia?: Json | null
        }
        Update: {
          archivo_id?: string | null
          cita_textual?: string | null
          created_at?: string
          descripcion?: string | null
          documento_codigo?: string | null
          documento_id?: string | null
          documento_revision?: string | null
          extraccion_id?: string | null
          id?: string
          knowledge_item_id?: string
          metodo?: string | null
          nombre_fuente?: string | null
          org_id?: string
          pagina?: number | null
          parrafo?: number | null
          profile_id?: string | null
          seccion?: string | null
          session_id?: string | null
          tipo_fuente?: string
          ultima_suplencia?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_knowledge_sources_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "org_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_sources_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "brain_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_sources_extraccion_id_fkey"
            columns: ["extraccion_id"]
            isOneToOne: false
            referencedRelation: "brain_extracciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_sources_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "brain_knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_sources_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_knowledge_sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_memoria_viva: {
        Row: {
          area_id: string | null
          contenido: string
          created_at: string
          created_by: string | null
          estado: string
          id: string
          notas: string | null
          org_id: string
          proceso_id: string | null
          tipo: string
          titulo: string
          ultima_suplencia: Json | null
          updated_at: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          area_id?: string | null
          contenido: string
          created_at?: string
          created_by?: string | null
          estado?: string
          id?: string
          notas?: string | null
          org_id: string
          proceso_id?: string | null
          tipo?: string
          titulo: string
          ultima_suplencia?: Json | null
          updated_at?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          area_id?: string | null
          contenido?: string
          created_at?: string
          created_by?: string | null
          estado?: string
          id?: string
          notas?: string | null
          org_id?: string
          proceso_id?: string | null
          tipo?: string
          titulo?: string
          ultima_suplencia?: Json | null
          updated_at?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_memoria_viva_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_memoria_viva_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_memoria_viva_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_memoria_viva_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_process_areas: {
        Row: {
          area_id: string
          created_at: string
          id: string
          org_id: string
          process_id: string
          rol: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          org_id: string
          process_id: string
          rol?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          org_id?: string
          process_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_process_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_process_areas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_process_areas_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_processes: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          folio_id: string | null
          id: string
          marco_regulatorio: string | null
          nombre: string
          org_id: string
          owner_area_id: string | null
          tiene_folio: boolean
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          folio_id?: string | null
          id?: string
          marco_regulatorio?: string | null
          nombre: string
          org_id: string
          owner_area_id?: string | null
          tiene_folio?: boolean
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          folio_id?: string | null
          id?: string
          marco_regulatorio?: string | null
          nombre?: string
          org_id?: string
          owner_area_id?: string | null
          tiene_folio?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_processes_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_processes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_processes_owner_area_id_fkey"
            columns: ["owner_area_id"]
            isOneToOne: false
            referencedRelation: "brain_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_session_processes: {
        Row: {
          created_at: string
          id: string
          org_id: string
          process_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          process_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          process_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_session_processes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_session_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brain_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_session_processes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brain_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_vinculos: {
        Row: {
          creado_por: string | null
          created_at: string | null
          entidad_id: string
          entidad_tipo: string
          id: string
          knowledge_item_id: string
          nota: string | null
          org_id: string
          relacion: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string | null
          entidad_id: string
          entidad_tipo: string
          id?: string
          knowledge_item_id: string
          nota?: string | null
          org_id: string
          relacion: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string | null
          entidad_id?: string
          entidad_tipo?: string
          id?: string
          knowledge_item_id?: string
          nota?: string | null
          org_id?: string
          relacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_vinculos_entidad_tipo_fkey"
            columns: ["entidad_tipo"]
            isOneToOne: false
            referencedRelation: "vinculo_tipos_entidad"
            referencedColumns: ["tipo"]
          },
          {
            foreignKeyName: "brain_vinculos_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "brain_knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_vinculos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capacitacion_progreso: {
        Row: {
          completado: boolean
          completado_en: string | null
          created_at: string
          curso_id: string
          id: string
          leccion_id: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completado?: boolean
          completado_en?: string | null
          created_at?: string
          curso_id: string
          id?: string
          leccion_id: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completado?: boolean
          completado_en?: string | null
          created_at?: string
          curso_id?: string
          id?: string
          leccion_id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversaciones: {
        Row: {
          agente: string
          created_at: string
          created_by: string | null
          folio_id: string | null
          id: string
          mensajes_count: number
          org_id: string
          tiene_riesgos_insertados: boolean
          titulo: string
          ultimo_mensaje_en: string
        }
        Insert: {
          agente?: string
          created_at?: string
          created_by?: string | null
          folio_id?: string | null
          id?: string
          mensajes_count?: number
          org_id: string
          tiene_riesgos_insertados?: boolean
          titulo?: string
          ultimo_mensaje_en?: string
        }
        Update: {
          agente?: string
          created_at?: string
          created_by?: string | null
          folio_id?: string | null
          id?: string
          mensajes_count?: number
          org_id?: string
          tiene_riesgos_insertados?: boolean
          titulo?: string
          ultimo_mensaje_en?: string
        }
        Relationships: []
      }
      chat_mensajes: {
        Row: {
          agente: string | null
          contenido: string
          contexto_usado: Json | null
          conversacion_id: string | null
          created_at: string
          documentos_adjuntos: Json | null
          folio_id: string | null
          id: string
          modelo_ia: string | null
          org_id: string
          role: string
          skills_usadas: Json | null
          tokens_usados: number | null
          user_id: string | null
        }
        Insert: {
          agente?: string | null
          contenido?: string
          contexto_usado?: Json | null
          conversacion_id?: string | null
          created_at?: string
          documentos_adjuntos?: Json | null
          folio_id?: string | null
          id?: string
          modelo_ia?: string | null
          org_id: string
          role: string
          skills_usadas?: Json | null
          tokens_usados?: number | null
          user_id?: string | null
        }
        Update: {
          agente?: string | null
          contenido?: string
          contexto_usado?: Json | null
          conversacion_id?: string | null
          created_at?: string
          documentos_adjuntos?: Json | null
          folio_id?: string | null
          id?: string
          modelo_ia?: string | null
          org_id?: string
          role?: string
          skills_usadas?: Json | null
          tokens_usados?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_uso_mensual: {
        Row: {
          mensajes_consumidos: number
          month: number
          org_id: string
          updated_at: string
          year: number
        }
        Insert: {
          mensajes_consumidos?: number
          month: number
          org_id: string
          updated_at?: string
          year: number
        }
        Update: {
          mensajes_consumidos?: number
          month?: number
          org_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      comite_comentarios: {
        Row: {
          contenido: string
          created_at: string
          folio_id: string
          id: string
          org_id: string
          resuelto: boolean
          resuelto_en: string | null
          resuelto_por: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          folio_id: string
          id?: string
          org_id: string
          resuelto?: boolean
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          folio_id?: string
          id?: string
          org_id?: string
          resuelto?: boolean
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      comite_votos: {
        Row: {
          comentario: string | null
          created_at: string
          folio_id: string
          id: string
          org_id: string
          updated_at: string
          user_id: string
          voto: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          folio_id: string
          id?: string
          org_id: string
          updated_at?: string
          user_id: string
          voto: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          folio_id?: string
          id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
          voto?: string
        }
        Relationships: []
      }
      curso_diplomas: {
        Row: {
          alumno_email: string
          alumno_nombre: string
          calificacion: number
          created_at: string
          curso_id: string
          curso_norma: string
          curso_titulo: string
          duracion_horas: number | null
          fecha_emision: string
          folio: string
          hash_verificacion: string
          id: string
          intento_id: string | null
          modulos_aprobados: Json
          org_id: string | null
          pdf_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alumno_email: string
          alumno_nombre: string
          calificacion: number
          created_at?: string
          curso_id: string
          curso_norma: string
          curso_titulo: string
          duracion_horas?: number | null
          fecha_emision?: string
          folio: string
          hash_verificacion: string
          id?: string
          intento_id?: string | null
          modulos_aprobados?: Json
          org_id?: string | null
          pdf_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alumno_email?: string
          alumno_nombre?: string
          calificacion?: number
          created_at?: string
          curso_id?: string
          curso_norma?: string
          curso_titulo?: string
          duracion_horas?: number | null
          fecha_emision?: string
          folio?: string
          hash_verificacion?: string
          id?: string
          intento_id?: string | null
          modulos_aprobados?: Json
          org_id?: string | null
          pdf_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curso_diplomas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_diplomas_intento_id_fkey"
            columns: ["intento_id"]
            isOneToOne: false
            referencedRelation: "curso_examen_intentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_diplomas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_evaluacion_preguntas: {
        Row: {
          activo: boolean
          bloque: string
          created_at: string
          curso_id: string
          id: string
          justificacion: string
          opcion_a: string
          opcion_b: string
          opcion_c: string
          opcion_d: string
          orden: number
          pregunta: string
          respuesta_correcta: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bloque: string
          created_at?: string
          curso_id: string
          id?: string
          justificacion?: string
          opcion_a: string
          opcion_b: string
          opcion_c: string
          opcion_d: string
          orden?: number
          pregunta: string
          respuesta_correcta: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bloque?: string
          created_at?: string
          curso_id?: string
          id?: string
          justificacion?: string
          opcion_a?: string
          opcion_b?: string
          opcion_c?: string
          opcion_d?: string
          orden?: number
          pregunta?: string
          respuesta_correcta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curso_evaluacion_preguntas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_examen_intentos: {
        Row: {
          aprobado: boolean
          bloque_resumen: Json
          calificacion: number
          correctas: number
          created_at: string
          curso_id: string
          duracion_seg: number | null
          finished_at: string | null
          id: string
          num_intento: number
          org_id: string | null
          preguntas_ids: string[]
          respuestas: Json
          started_at: string
          tab_blur_count: number
          tiempo_limite_seg: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aprobado?: boolean
          bloque_resumen?: Json
          calificacion?: number
          correctas?: number
          created_at?: string
          curso_id: string
          duracion_seg?: number | null
          finished_at?: string | null
          id?: string
          num_intento?: number
          org_id?: string | null
          preguntas_ids?: string[]
          respuestas?: Json
          started_at?: string
          tab_blur_count?: number
          tiempo_limite_seg?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aprobado?: boolean
          bloque_resumen?: Json
          calificacion?: number
          correctas?: number
          created_at?: string
          curso_id?: string
          duracion_seg?: number | null
          finished_at?: string | null
          id?: string
          num_intento?: number
          org_id?: string | null
          preguntas_ids?: string[]
          respuestas?: Json
          started_at?: string
          tab_blur_count?: number
          tiempo_limite_seg?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curso_examen_intentos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_examen_intentos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_lecciones: {
        Row: {
          activo: boolean
          archivo_storage: string | null
          created_at: string
          id: string
          leccion_id: string
          modulo_id: string
          orden: number
          proximamente: boolean
          tipo: string
          titulo: string
          updated_at: string
          url_video: string | null
        }
        Insert: {
          activo?: boolean
          archivo_storage?: string | null
          created_at?: string
          id?: string
          leccion_id: string
          modulo_id: string
          orden?: number
          proximamente?: boolean
          tipo?: string
          titulo: string
          updated_at?: string
          url_video?: string | null
        }
        Update: {
          activo?: boolean
          archivo_storage?: string | null
          created_at?: string
          id?: string
          leccion_id?: string
          modulo_id?: string
          orden?: number
          proximamente?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
          url_video?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curso_lecciones_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "curso_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_modulos: {
        Row: {
          activo: boolean
          created_at: string
          curso_id: string
          descripcion: string
          id: string
          orden: number
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          curso_id: string
          descripcion?: string
          id?: string
          orden?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          curso_id?: string
          descripcion?: string
          id?: string
          orden?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curso_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string
          duracion_horas: number | null
          id: string
          modulo_clave: string | null
          norma: string
          orden: number
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          duracion_horas?: number | null
          id?: string
          modulo_clave?: string | null
          norma: string
          orden?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          duracion_horas?: number | null
          id?: string
          modulo_clave?: string | null
          norma?: string
          orden?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_modulo_clave_fkey"
            columns: ["modulo_clave"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["clave"]
          },
        ]
      }
      dc3_solicitudes: {
        Row: {
          alumno_nombre: string | null
          calificacion: number | null
          created_at: string
          curso_id: string | null
          curso_norma: string | null
          curso_titulo: string | null
          dc3_url: string | null
          diploma_id: string | null
          email_destino: string
          enviado_en: string | null
          enviado_por: string | null
          estado: string
          fuente: string
          id: string
          intento_id: string | null
          notas_admin: string | null
          org_id: string | null
          org_nombre: string | null
          plan_org: string | null
          solicitado_en: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alumno_nombre?: string | null
          calificacion?: number | null
          created_at?: string
          curso_id?: string | null
          curso_norma?: string | null
          curso_titulo?: string | null
          dc3_url?: string | null
          diploma_id?: string | null
          email_destino: string
          enviado_en?: string | null
          enviado_por?: string | null
          estado?: string
          fuente: string
          id?: string
          intento_id?: string | null
          notas_admin?: string | null
          org_id?: string | null
          org_nombre?: string | null
          plan_org?: string | null
          solicitado_en?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alumno_nombre?: string | null
          calificacion?: number | null
          created_at?: string
          curso_id?: string | null
          curso_norma?: string | null
          curso_titulo?: string | null
          dc3_url?: string | null
          diploma_id?: string | null
          email_destino?: string
          enviado_en?: string | null
          enviado_por?: string | null
          estado?: string
          fuente?: string
          id?: string
          intento_id?: string | null
          notas_admin?: string | null
          org_id?: string | null
          org_nombre?: string | null
          plan_org?: string | null
          solicitado_en?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dc3_solicitudes_diploma_id_fkey"
            columns: ["diploma_id"]
            isOneToOne: false
            referencedRelation: "curso_diplomas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc3_solicitudes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      diploma_sequence: {
        Row: {
          last_number: number
          org_id: string | null
          year: number
        }
        Insert: {
          last_number?: number
          org_id?: string | null
          year: number
        }
        Update: {
          last_number?: number
          org_id?: string | null
          year?: number
        }
        Relationships: []
      }
      documento_reservas: {
        Row: {
          actor: string
          archivo_path: string
          creado_en: string
          folio: string
          id: string
          nombre_archivo: string
          org_id: string
          registro: Json
          tipo: string
        }
        Insert: {
          actor: string
          archivo_path: string
          creado_en?: string
          folio: string
          id?: string
          nombre_archivo: string
          org_id: string
          registro: Json
          tipo: string
        }
        Update: {
          actor?: string
          archivo_path?: string
          creado_en?: string
          folio?: string
          id?: string
          nombre_archivo?: string
          org_id?: string
          registro?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_reservas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_tipos: {
        Row: {
          activo: boolean
          clave: string
          claves_codigo: string[]
          created_at: string
          es_propio: boolean
          es_registro: boolean
          id: string
          nombre: string
          orden: number
          org_id: string | null
          sinonimos: string[]
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clave: string
          claves_codigo?: string[]
          created_at?: string
          es_propio?: boolean
          es_registro?: boolean
          id?: string
          nombre: string
          orden?: number
          org_id?: string | null
          sinonimos?: string[]
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clave?: string
          claves_codigo?: string[]
          created_at?: string
          es_propio?: boolean
          es_registro?: boolean
          id?: string
          nombre?: string
          orden?: number
          org_id?: string | null
          sinonimos?: string[]
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_tipos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_tipos_config: {
        Row: {
          id: string
          org_id: string
          posicion_tipo_en_codigo: number
          revisado_en: string | null
          revisado_por: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          posicion_tipo_en_codigo?: number
          revisado_en?: string | null
          revisado_por?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          posicion_tipo_en_codigo?: number
          revisado_en?: string | null
          revisado_por?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_tipos_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_generados: {
        Row: {
          archivo_path: string | null
          archivo_sha256: string | null
          created_at: string
          folio: string
          formato_id: string | null
          formato_version: number | null
          generado_en: string
          generado_por: string | null
          id: string
          identidad_id: string | null
          identidad_version: number | null
          nombre_archivo: string
          org_id: string
          tipo: string
        }
        Insert: {
          archivo_path?: string | null
          archivo_sha256?: string | null
          created_at?: string
          folio: string
          formato_id?: string | null
          formato_version?: number | null
          generado_en?: string
          generado_por?: string | null
          id?: string
          identidad_id?: string | null
          identidad_version?: number | null
          nombre_archivo?: string
          org_id: string
          tipo: string
        }
        Update: {
          archivo_path?: string | null
          archivo_sha256?: string | null
          created_at?: string
          folio?: string
          formato_id?: string | null
          formato_version?: number | null
          generado_en?: string
          generado_por?: string | null
          id?: string
          identidad_id?: string | null
          identidad_version?: number | null
          nombre_archivo?: string
          org_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_generados_formato_id_fkey"
            columns: ["formato_id"]
            isOneToOne: false
            referencedRelation: "org_formatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_generados_identidad_id_fkey"
            columns: ["identidad_id"]
            isOneToOne: false
            referencedRelation: "org_identidad_documental"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_generados_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      folio_comite: {
        Row: {
          cargo: string
          created_at: string
          fecha_firma: string | null
          firma_por: string | null
          firma_suplencia: Json | null
          firmado: boolean
          folio_id: string
          hash_documento: string
          id: string
          ip_firma: string
          nombre: string
          responsabilidad: string
          texto_compromiso: string
          user_agent: string
          user_id: string | null
        }
        Insert: {
          cargo: string
          created_at?: string
          fecha_firma?: string | null
          firma_por?: string | null
          firma_suplencia?: Json | null
          firmado?: boolean
          folio_id: string
          hash_documento?: string
          id?: string
          ip_firma?: string
          nombre: string
          responsabilidad: string
          texto_compromiso?: string
          user_agent?: string
          user_id?: string | null
        }
        Update: {
          cargo?: string
          created_at?: string
          fecha_firma?: string | null
          firma_por?: string | null
          firma_suplencia?: Json | null
          firmado?: boolean
          folio_id?: string
          hash_documento?: string
          id?: string
          ip_firma?: string
          nombre?: string
          responsabilidad?: string
          texto_compromiso?: string
          user_agent?: string
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
          org_id: string
          periodo_key: string
          tipo: string
          year: number
        }
        Insert: {
          last_number?: number
          org_id: string
          periodo_key: string
          tipo?: string
          year: number
        }
        Update: {
          last_number?: number
          org_id?: string
          periodo_key?: string
          tipo?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "folio_sequence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_versiones: {
        Row: {
          creado_por: string | null
          created_at: string
          folio_id: string
          id: string
          motivo_revision: string
          snapshot_folio: Json
          snapshot_riesgos: Json
          version: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          folio_id: string
          id?: string
          motivo_revision?: string
          snapshot_folio: Json
          snapshot_riesgos?: Json
          version: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          folio_id?: string
          id?: string
          motivo_revision?: string
          snapshot_folio?: Json
          snapshot_riesgos?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "folio_versiones_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
        ]
      }
      folios: {
        Row: {
          alcance: string | null
          beneficio_clinico: string
          cancelado_en: string | null
          cancelado_por: string | null
          clase_dispositivo: string
          clasificacion_categoria: string
          clasificacion_condicion_venta: string
          clasificacion_riesgo_sanitario: string
          clasificacion_tipo: string
          codigo: string
          codigo_consecutivo: number | null
          codigo_periodo: string | null
          conclusion: string | null
          control_cambios_id: string | null
          created_at: string
          created_by: string | null
          desviacion_id: string | null
          dictamen_autoemitido: boolean
          dictamen_por: string | null
          dictamen_suplencia: Json | null
          estado: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre: string | null
          fecha_inicio: string
          id: string
          justificacion_tecnica: string | null
          metodologia_folio: string
          motivo_cancelacion: string | null
          motivo_cancelacion_codigo: string | null
          norma_folio: string
          normas_aplicables: string[]
          numero_lote: string
          numero_modelo: string
          numero_version: string
          org_id: string
          origen: string
          proceso_equipo: string
          riesgo_residual_global: string
          tipo_folio: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        Insert: {
          alcance?: string | null
          beneficio_clinico?: string
          cancelado_en?: string | null
          cancelado_por?: string | null
          clase_dispositivo?: string
          clasificacion_categoria?: string
          clasificacion_condicion_venta?: string
          clasificacion_riesgo_sanitario?: string
          clasificacion_tipo?: string
          codigo: string
          codigo_consecutivo?: number | null
          codigo_periodo?: string | null
          conclusion?: string | null
          control_cambios_id?: string | null
          created_at?: string
          created_by?: string | null
          desviacion_id?: string | null
          dictamen_autoemitido?: boolean
          dictamen_por?: string | null
          dictamen_suplencia?: Json | null
          estado?: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre?: string | null
          fecha_inicio?: string
          id?: string
          justificacion_tecnica?: string | null
          metodologia_folio?: string
          motivo_cancelacion?: string | null
          motivo_cancelacion_codigo?: string | null
          norma_folio?: string
          normas_aplicables?: string[]
          numero_lote?: string
          numero_modelo?: string
          numero_version?: string
          org_id?: string
          origen?: string
          proceso_equipo: string
          riesgo_residual_global?: string
          tipo_folio?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Update: {
          alcance?: string | null
          beneficio_clinico?: string
          cancelado_en?: string | null
          cancelado_por?: string | null
          clase_dispositivo?: string
          clasificacion_categoria?: string
          clasificacion_condicion_venta?: string
          clasificacion_riesgo_sanitario?: string
          clasificacion_tipo?: string
          codigo?: string
          codigo_consecutivo?: number | null
          codigo_periodo?: string | null
          conclusion?: string | null
          control_cambios_id?: string | null
          created_at?: string
          created_by?: string | null
          desviacion_id?: string | null
          dictamen_autoemitido?: boolean
          dictamen_por?: string | null
          dictamen_suplencia?: Json | null
          estado?: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre?: string | null
          fecha_inicio?: string
          id?: string
          justificacion_tecnica?: string | null
          metodologia_folio?: string
          motivo_cancelacion?: string | null
          motivo_cancelacion_codigo?: string | null
          norma_folio?: string
          normas_aplicables?: string[]
          numero_lote?: string
          numero_modelo?: string
          numero_version?: string
          org_id?: string
          origen?: string
          proceso_equipo?: string
          riesgo_residual_global?: string
          tipo_folio?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_config_org: {
        Row: {
          cambiado_en: string
          cambiado_por: string | null
          composicion_riesgos: string
          org_id: string
          usar_conocimiento_cerebro: boolean
        }
        Insert: {
          cambiado_en?: string
          cambiado_por?: string | null
          composicion_riesgos?: string
          org_id: string
          usar_conocimiento_cerebro?: boolean
        }
        Update: {
          cambiado_en?: string
          cambiado_por?: string | null
          composicion_riesgos?: string
          org_id?: string
          usar_conocimiento_cerebro?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ia_config_org_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_skill_casos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          debe: string
          entrada: string
          id: string
          no_debe: string
          norma: string
          requiere_herramientas: boolean
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          debe: string
          entrada: string
          id?: string
          no_debe: string
          norma: string
          requiere_herramientas?: boolean
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          debe?: string
          entrada?: string
          id?: string
          no_debe?: string
          norma?: string
          requiere_herramientas?: boolean
        }
        Relationships: []
      }
      ia_skill_pruebas: {
        Row: {
          caso_id: string
          composicion: Json
          corrida_id: string
          creado_por: string | null
          created_at: string
          evaluado_en: string | null
          evaluado_por: string | null
          id: string
          modelo_ia: string | null
          norma: string
          nota: string | null
          org_id: string
          referencia: Json | null
          respuesta: string | null
          respuesta_referencia: string | null
          resultado: string
        }
        Insert: {
          caso_id: string
          composicion: Json
          corrida_id: string
          creado_por?: string | null
          created_at?: string
          evaluado_en?: string | null
          evaluado_por?: string | null
          id?: string
          modelo_ia?: string | null
          norma: string
          nota?: string | null
          org_id: string
          referencia?: Json | null
          respuesta?: string | null
          respuesta_referencia?: string | null
          resultado?: string
        }
        Update: {
          caso_id?: string
          composicion?: Json
          corrida_id?: string
          creado_por?: string | null
          created_at?: string
          evaluado_en?: string | null
          evaluado_por?: string | null
          id?: string
          modelo_ia?: string | null
          norma?: string
          nota?: string | null
          org_id?: string
          referencia?: Json | null
          respuesta?: string | null
          respuesta_referencia?: string | null
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_skill_pruebas_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "ia_skill_casos"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_skills: {
        Row: {
          activo: boolean
          ambito: string
          clave: string
          descripcion: string | null
          modelo_ia: string | null
          modulo: string | null
          nombre: string
          norma: string | null
        }
        Insert: {
          activo?: boolean
          ambito: string
          clave: string
          descripcion?: string | null
          modelo_ia?: string | null
          modulo?: string | null
          nombre: string
          norma?: string | null
        }
        Update: {
          activo?: boolean
          ambito?: string
          clave?: string
          descripcion?: string | null
          modelo_ia?: string | null
          modulo?: string | null
          nombre?: string
          norma?: string | null
        }
        Relationships: []
      }
      impersonation_logs: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          ip: string | null
          motivo: string
          org_id: string
          org_nombre: string
          started_at: string
          super_admin_email: string
          super_admin_id: string
          ticket_id: string | null
          tipo_cierre: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          ip?: string | null
          motivo: string
          org_id: string
          org_nombre: string
          started_at?: string
          super_admin_email: string
          super_admin_id: string
          ticket_id?: string | null
          tipo_cierre?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          ip?: string | null
          motivo?: string
          org_id?: string
          org_nombre?: string
          started_at?: string
          super_admin_email?: string
          super_admin_id?: string
          ticket_id?: string | null
          tipo_cierre?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definiciones: {
        Row: {
          activo: boolean
          capturistas: string[]
          codigo: string
          created_at: string
          created_by: string | null
          definicion: string
          estado: string
          formula: string
          frecuencia: string
          fuente: string
          id: string
          meta: number
          nivel: string
          nombre: string
          org_id: string
          peso: number
          proceso: string
          puesto_id: string
          regla_actuacion: string
          tendencia: string
          unidad: string
          updated_at: string
          updated_by: string | null
          validado_en: string | null
          validado_por: string | null
        }
        Insert: {
          activo?: boolean
          capturistas?: string[]
          codigo: string
          created_at?: string
          created_by?: string | null
          definicion?: string
          estado?: string
          formula?: string
          frecuencia?: string
          fuente?: string
          id?: string
          meta?: number
          nivel?: string
          nombre: string
          org_id?: string
          peso?: number
          proceso?: string
          puesto_id: string
          regla_actuacion?: string
          tendencia?: string
          unidad?: string
          updated_at?: string
          updated_by?: string | null
          validado_en?: string | null
          validado_por?: string | null
        }
        Update: {
          activo?: boolean
          capturistas?: string[]
          codigo?: string
          created_at?: string
          created_by?: string | null
          definicion?: string
          estado?: string
          formula?: string
          frecuencia?: string
          fuente?: string
          id?: string
          meta?: number
          nivel?: string
          nombre?: string
          org_id?: string
          peso?: number
          proceso?: string
          puesto_id?: string
          regla_actuacion?: string
          tendencia?: string
          unidad?: string
          updated_at?: string
          updated_by?: string | null
          validado_en?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definiciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_definiciones_org_id_puesto_id_fkey"
            columns: ["org_id", "puesto_id"]
            isOneToOne: false
            referencedRelation: "puestos"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      kpi_evidencias: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          id: string
          nombre: string
          org_id: string
          path: string
          periodo_fin: string
          periodo_inicio: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nombre: string
          org_id?: string
          path: string
          periodo_fin: string
          periodo_inicio: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          org_id?: string
          path?: string
          periodo_fin?: string
          periodo_inicio?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_evidencias_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_puesto: {
        Row: {
          activo: boolean
          capturistas: string[]
          codigo: string
          created_at: string
          created_by: string | null
          estado: string
          formula: string
          frecuencia: string
          fuente: string
          id: string
          meta: number
          nombre: string
          objetivo: string
          org_id: string
          peso: number
          puesto_id: string
          tendencia: string
          unidad: string
          updated_at: string
          updated_by: string | null
          validado_en: string | null
          validado_por: string | null
        }
        Insert: {
          activo?: boolean
          capturistas?: string[]
          codigo: string
          created_at?: string
          created_by?: string | null
          estado?: string
          formula?: string
          frecuencia?: string
          fuente?: string
          id?: string
          meta?: number
          nombre: string
          objetivo?: string
          org_id?: string
          peso?: number
          puesto_id: string
          tendencia?: string
          unidad?: string
          updated_at?: string
          updated_by?: string | null
          validado_en?: string | null
          validado_por?: string | null
        }
        Update: {
          activo?: boolean
          capturistas?: string[]
          codigo?: string
          created_at?: string
          created_by?: string | null
          estado?: string
          formula?: string
          frecuencia?: string
          fuente?: string
          id?: string
          meta?: number
          nombre?: string
          objetivo?: string
          org_id?: string
          peso?: number
          puesto_id?: string
          tendencia?: string
          unidad?: string
          updated_at?: string
          updated_by?: string | null
          validado_en?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_puesto_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_puesto_org_id_puesto_id_fkey"
            columns: ["org_id", "puesto_id"]
            isOneToOne: false
            referencedRelation: "puestos"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      kpi_puesto_aporta: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          id: string
          kpi_definicion_id: string
          kpi_puesto_id: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kpi_definicion_id: string
          kpi_puesto_id: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kpi_definicion_id?: string
          kpi_puesto_id?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_puesto_aporta_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_puesto_aporta_org_id_kpi_definicion_id_fkey"
            columns: ["org_id", "kpi_definicion_id"]
            isOneToOne: false
            referencedRelation: "kpi_definiciones"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "kpi_puesto_aporta_org_id_kpi_puesto_id_fkey"
            columns: ["org_id", "kpi_puesto_id"]
            isOneToOne: false
            referencedRelation: "kpi_puesto"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      kpi_reporte_config: {
        Row: {
          alcance: string
          autorizadores: string[]
          created_at: string
          created_by: string | null
          id: string
          metodologia: string
          motivo: string
          objetivo: string
          org_id: string
          textos_fijos: boolean
          version: number
        }
        Insert: {
          alcance?: string
          autorizadores?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          metodologia?: string
          motivo: string
          objetivo?: string
          org_id: string
          textos_fijos?: boolean
          version: number
        }
        Update: {
          alcance?: string
          autorizadores?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          metodologia?: string
          motivo?: string
          objetivo?: string
          org_id?: string
          textos_fijos?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_reporte_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_reportes: {
        Row: {
          alcance: string
          alcance_procesos: string[]
          alcance_puestos: string[]
          analisis: Json
          anulado_en: string | null
          anulado_por: string | null
          codigo: string
          conclusiones: string
          created_at: string
          created_by: string | null
          datos_snapshot: Json | null
          elaboro_por: string | null
          emision_preparada: Json | null
          emitido_en: string | null
          emitido_por: string | null
          estado: string
          etapa: string
          firmantes: Json | null
          formato_snapshot: Json | null
          id: string
          metodologia: string
          motivo_anulacion: string | null
          objetivo: string
          org_id: string
          periodo_fin: string
          periodo_inicio: string
          revisiones: Json
          revisores: string[]
          tipo_periodo: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          alcance?: string
          alcance_procesos?: string[]
          alcance_puestos?: string[]
          analisis?: Json
          anulado_en?: string | null
          anulado_por?: string | null
          codigo: string
          conclusiones?: string
          created_at?: string
          created_by?: string | null
          datos_snapshot?: Json | null
          elaboro_por?: string | null
          emision_preparada?: Json | null
          emitido_en?: string | null
          emitido_por?: string | null
          estado?: string
          etapa?: string
          firmantes?: Json | null
          formato_snapshot?: Json | null
          id?: string
          metodologia?: string
          motivo_anulacion?: string | null
          objetivo?: string
          org_id: string
          periodo_fin: string
          periodo_inicio: string
          revisiones?: Json
          revisores?: string[]
          tipo_periodo: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          alcance?: string
          alcance_procesos?: string[]
          alcance_puestos?: string[]
          analisis?: Json
          anulado_en?: string | null
          anulado_por?: string | null
          codigo?: string
          conclusiones?: string
          created_at?: string
          created_by?: string | null
          datos_snapshot?: Json | null
          elaboro_por?: string | null
          emision_preparada?: Json | null
          emitido_en?: string | null
          emitido_por?: string | null
          estado?: string
          etapa?: string
          firmantes?: Json | null
          formato_snapshot?: Json | null
          id?: string
          metodologia?: string
          motivo_anulacion?: string | null
          objetivo?: string
          org_id?: string
          periodo_fin?: string
          periodo_inicio?: string
          revisiones?: Json
          revisores?: string[]
          tipo_periodo?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_reportes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_reportes_historial: {
        Row: {
          archivado_en: string
          archivado_por: string | null
          codigo: string
          contenido: Json
          estado: string
          id: string
          motivo: string
          org_id: string
          reporte_id: string
          version: number
        }
        Insert: {
          archivado_en?: string
          archivado_por?: string | null
          codigo: string
          contenido: Json
          estado: string
          id?: string
          motivo: string
          org_id: string
          reporte_id: string
          version: number
        }
        Update: {
          archivado_en?: string
          archivado_por?: string | null
          codigo?: string
          contenido?: Json
          estado?: string
          id?: string
          motivo?: string
          org_id?: string
          reporte_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_reportes_historial_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_reportes_historial_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "kpi_reportes"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_resultado_evidencia: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          evidencia_id: string
          id: string
          org_id: string
          resultado_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          evidencia_id: string
          id?: string
          org_id?: string
          resultado_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          evidencia_id?: string
          id?: string
          org_id?: string
          resultado_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_resultado_evidencia_org_id_evidencia_id_fkey"
            columns: ["org_id", "evidencia_id"]
            isOneToOne: false
            referencedRelation: "kpi_evidencias"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "kpi_resultado_evidencia_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_resultado_evidencia_resultado_id_fkey"
            columns: ["resultado_id"]
            isOneToOne: false
            referencedRelation: "kpi_resultados"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_resultados: {
        Row: {
          activo: boolean
          capturado_en: string
          capturado_por: string
          comentario: string
          created_at: string
          created_by: string | null
          cumplimiento: number | null
          denominador: number | null
          descripcion_evento: string
          estado: string
          evidencia_path: string | null
          fecha_evento: string | null
          id: string
          kpi_definicion_id: string | null
          kpi_puesto_id: string | null
          meta_copia: number
          numerador: number
          org_id: string
          periodo_fin: string | null
          periodo_inicio: string
          referencia_fuente: string
          revisado_en: string | null
          revisado_por: string | null
          semaforo: string
          tendencia_copia: string
          unidad_copia: string
          updated_at: string
          updated_by: string | null
          valor: number | null
        }
        Insert: {
          activo?: boolean
          capturado_en?: string
          capturado_por: string
          comentario?: string
          created_at?: string
          created_by?: string | null
          cumplimiento?: number | null
          denominador?: number | null
          descripcion_evento?: string
          estado?: string
          evidencia_path?: string | null
          fecha_evento?: string | null
          id?: string
          kpi_definicion_id?: string | null
          kpi_puesto_id?: string | null
          meta_copia: number
          numerador?: number
          org_id?: string
          periodo_fin?: string | null
          periodo_inicio: string
          referencia_fuente?: string
          revisado_en?: string | null
          revisado_por?: string | null
          semaforo?: string
          tendencia_copia: string
          unidad_copia: string
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
        }
        Update: {
          activo?: boolean
          capturado_en?: string
          capturado_por?: string
          comentario?: string
          created_at?: string
          created_by?: string | null
          cumplimiento?: number | null
          denominador?: number | null
          descripcion_evento?: string
          estado?: string
          evidencia_path?: string | null
          fecha_evento?: string | null
          id?: string
          kpi_definicion_id?: string | null
          kpi_puesto_id?: string | null
          meta_copia?: number
          numerador?: number
          org_id?: string
          periodo_fin?: string | null
          periodo_inicio?: string
          referencia_fuente?: string
          revisado_en?: string | null
          revisado_por?: string | null
          semaforo?: string
          tendencia_copia?: string
          unidad_copia?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_resultados_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_resultados_org_id_kpi_definicion_id_fkey"
            columns: ["org_id", "kpi_definicion_id"]
            isOneToOne: false
            referencedRelation: "kpi_definiciones"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "kpi_resultados_org_id_kpi_puesto_id_fkey"
            columns: ["org_id", "kpi_puesto_id"]
            isOneToOne: false
            referencedRelation: "kpi_puesto"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      modulos: {
        Row: {
          activo: boolean
          clave: string
          descripcion: string | null
          estado: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          clave: string
          descripcion?: string | null
          estado?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          clave?: string
          descripcion?: string | null
          estado?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      onboarding_estado: {
        Row: {
          clave: string
          completado_en: string
          created_at: string
          id: string
          org_id: string | null
          saltado: boolean
          user_id: string
        }
        Insert: {
          clave: string
          completado_en?: string
          created_at?: string
          id?: string
          org_id?: string | null
          saltado?: boolean
          user_id: string
        }
        Update: {
          clave?: string
          completado_en?: string
          created_at?: string
          id?: string
          org_id?: string | null
          saltado?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_estado_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_autoridad_calidad: {
        Row: {
          autorizadores: string[]
          created_at: string
          created_by: string
          id: string
          modo: string
          motivo: string
          org_id: string
          version: number
        }
        Insert: {
          autorizadores?: string[]
          created_at?: string
          created_by: string
          id?: string
          modo: string
          motivo: string
          org_id: string
          version: number
        }
        Update: {
          autorizadores?: string[]
          created_at?: string
          created_by?: string
          id?: string
          modo?: string
          motivo?: string
          org_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_autoridad_calidad_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_documentos: {
        Row: {
          clasificacion: string
          copia_no_controlada: boolean
          copia_no_controlada_evidencia: string | null
          copia_no_controlada_propuesta: boolean
          creado_por: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          es_version_actual: boolean
          id: string
          mime_type: string | null
          motivo_retiro: string | null
          nombre: string
          nombre_archivo_original: string | null
          org_id: string
          parent_doc_id: string | null
          retirado_en: string | null
          retirado_por: string | null
          sha256: string | null
          sha256_servidor: string | null
          sha256_verificado_en: string | null
          size_bytes: number | null
          storage_path: string
          tipo: string
          tipo_clave: string | null
          ultima_suplencia: Json | null
          updated_at: string
          usar_en_ia: boolean
          version: string
          version_num: number
        }
        Insert: {
          clasificacion?: string
          copia_no_controlada?: boolean
          copia_no_controlada_evidencia?: string | null
          copia_no_controlada_propuesta?: boolean
          creado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          es_version_actual?: boolean
          id?: string
          mime_type?: string | null
          motivo_retiro?: string | null
          nombre: string
          nombre_archivo_original?: string | null
          org_id: string
          parent_doc_id?: string | null
          retirado_en?: string | null
          retirado_por?: string | null
          sha256?: string | null
          sha256_servidor?: string | null
          sha256_verificado_en?: string | null
          size_bytes?: number | null
          storage_path: string
          tipo: string
          tipo_clave?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          usar_en_ia?: boolean
          version?: string
          version_num?: number
        }
        Update: {
          clasificacion?: string
          copia_no_controlada?: boolean
          copia_no_controlada_evidencia?: string | null
          copia_no_controlada_propuesta?: boolean
          creado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          es_version_actual?: boolean
          id?: string
          mime_type?: string | null
          motivo_retiro?: string | null
          nombre?: string
          nombre_archivo_original?: string | null
          org_id?: string
          parent_doc_id?: string | null
          retirado_en?: string | null
          retirado_por?: string | null
          sha256?: string | null
          sha256_servidor?: string | null
          sha256_verificado_en?: string | null
          size_bytes?: number | null
          storage_path?: string
          tipo?: string
          tipo_clave?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          usar_en_ia?: boolean
          version?: string
          version_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_documentos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_folio_tipos: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          es_personalizado: boolean
          id: string
          nombre: string
          orden: number
          org_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          es_personalizado?: boolean
          id?: string
          nombre: string
          orden?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          es_personalizado?: boolean
          id?: string
          nombre?: string
          orden?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_folio_tipos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_formatos: {
        Row: {
          codigo: string
          created_at: string
          created_by: string | null
          firmas: Json
          id: string
          motivo: string
          org_id: string
          tipo: string
          titulo: string
          version: number
          version_formato: string
          vigente_desde: string | null
        }
        Insert: {
          codigo?: string
          created_at?: string
          created_by?: string | null
          firmas?: Json
          id?: string
          motivo: string
          org_id: string
          tipo: string
          titulo?: string
          version: number
          version_formato?: string
          vigente_desde?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          created_by?: string | null
          firmas?: Json
          id?: string
          motivo?: string
          org_id?: string
          tipo?: string
          titulo?: string
          version?: number
          version_formato?: string
          vigente_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_formatos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_identidad_documental: {
        Row: {
          created_at: string
          created_by: string | null
          domicilio: string
          id: string
          leyenda_confidencialidad: string
          leyenda_copia: string
          motivo: string
          org_id: string
          pie: string
          razon_social: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domicilio?: string
          id?: string
          leyenda_confidencialidad?: string
          leyenda_copia?: string
          motivo: string
          org_id: string
          pie?: string
          razon_social?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domicilio?: string
          id?: string
          leyenda_confidencialidad?: string
          leyenda_copia?: string
          motivo?: string
          org_id?: string
          pie?: string
          razon_social?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_identidad_documental_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_pendientes_semaforo: {
        Row: {
          gestion_naranja: number
          gestion_rojo: number
          operativo_naranja: number
          operativo_rojo: number
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          gestion_naranja?: number
          gestion_rojo?: number
          operativo_naranja?: number
          operativo_rojo?: number
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          gestion_naranja?: number
          gestion_rojo?: number
          operativo_naranja?: number
          operativo_rojo?: number
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_pendientes_semaforo_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_suplencias: {
        Row: {
          aceptada_en: string | null
          aviso_rs_enviado_en: string | null
          aviso_rs_error: string | null
          aviso_rs_requerido: boolean
          categoria: string
          created_at: string
          created_by: string | null
          documento_respaldo: string | null
          estado: string
          facultades: string[]
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo: string
          motivo_terminacion: string | null
          org_id: string
          registrada_por: string | null
          respondida_por: string | null
          revocada_en: string | null
          revocada_por: string | null
          rol_sustituido: string
          rs_titular_cargo: string | null
          rs_titular_nombre: string | null
          rs_titular_user_id: string | null
          suplente_cargo: string
          suplente_nombre: string
          suplente_user_id: string
          terminada_en: string | null
          titular_cargo: string | null
          titular_nombre: string | null
          titular_user_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aceptada_en?: string | null
          aviso_rs_enviado_en?: string | null
          aviso_rs_error?: string | null
          aviso_rs_requerido?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          documento_respaldo?: string | null
          estado?: string
          facultades: string[]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo: string
          motivo_terminacion?: string | null
          org_id: string
          registrada_por?: string | null
          respondida_por?: string | null
          revocada_en?: string | null
          revocada_por?: string | null
          rol_sustituido?: string
          rs_titular_cargo?: string | null
          rs_titular_nombre?: string | null
          rs_titular_user_id?: string | null
          suplente_cargo?: string
          suplente_nombre?: string
          suplente_user_id: string
          terminada_en?: string | null
          titular_cargo?: string | null
          titular_nombre?: string | null
          titular_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aceptada_en?: string | null
          aviso_rs_enviado_en?: string | null
          aviso_rs_error?: string | null
          aviso_rs_requerido?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          documento_respaldo?: string | null
          estado?: string
          facultades?: string[]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo?: string
          motivo_terminacion?: string | null
          org_id?: string
          registrada_por?: string | null
          respondida_por?: string | null
          revocada_en?: string | null
          revocada_por?: string | null
          rol_sustituido?: string
          rs_titular_cargo?: string | null
          rs_titular_nombre?: string | null
          rs_titular_user_id?: string | null
          suplente_cargo?: string
          suplente_nombre?: string
          suplente_user_id?: string
          terminada_en?: string | null
          titular_cargo?: string | null
          titular_nombre?: string | null
          titular_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_suplencias_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_suplencias_org_id_suplente_user_id_fkey"
            columns: ["org_id", "suplente_user_id"]
            isOneToOne: false
            referencedRelation: "org_members"
            referencedColumns: ["org_id", "user_id"]
          },
        ]
      }
      organization_features: {
        Row: {
          activado_en: string
          activo: boolean
          created_at: string
          expira_en: string | null
          feature_key: string
          id: string
          notas: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          activado_en?: string
          activo?: boolean
          created_at?: string
          expira_en?: string | null
          feature_key: string
          id?: string
          notas?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          activado_en?: string
          activo?: boolean
          created_at?: string
          expira_en?: string | null
          feature_key?: string
          id?: string
          notas?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          activo: boolean
          alerta_80_enviada: boolean
          billing_interval: string | null
          cancelled_at: string | null
          codigo_formato: string
          consultas_ia_extras: number
          created_at: string
          curso_aviso_5d_enviado_at: string | null
          curso_expira_en: string | null
          dc3_adicionales_disponibles: number
          dc3_emitidos: number
          descripcion: string
          es_prueba: boolean
          estado: Database["public"]["Enums"]["org_estado"]
          folio_digitos_consecutivo: number
          folio_formato_periodo: string
          folio_prefijo: string
          id: string
          ip_aceptacion: string | null
          logo_url: string
          max_users: number
          metodologia: string
          nombre: string
          norma_aplicable: string
          onboarding_completado: boolean
          onboarding_completado_at: string | null
          onboarding_completado_por: string | null
          onboarding_saltado: boolean
          pending_price_id: string | null
          plan: string
          privacidad_aceptada_en: string | null
          privacidad_version: string | null
          razon_social: string | null
          rfc: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          terminos_aceptados_en: string | null
          terminos_version: string | null
          tiene_curso_pagado: boolean
          trial_expires_at: string | null
          ultima_suplencia: Json | null
          umbral_npr_alto: number
          umbral_npr_medio: number
          updated_at: string
          usar_detectabilidad: boolean
          version_formato: string
        }
        Insert: {
          activo?: boolean
          alerta_80_enviada?: boolean
          billing_interval?: string | null
          cancelled_at?: string | null
          codigo_formato?: string
          consultas_ia_extras?: number
          created_at?: string
          curso_aviso_5d_enviado_at?: string | null
          curso_expira_en?: string | null
          dc3_adicionales_disponibles?: number
          dc3_emitidos?: number
          descripcion?: string
          es_prueba?: boolean
          estado?: Database["public"]["Enums"]["org_estado"]
          folio_digitos_consecutivo?: number
          folio_formato_periodo?: string
          folio_prefijo?: string
          id?: string
          ip_aceptacion?: string | null
          logo_url?: string
          max_users?: number
          metodologia?: string
          nombre: string
          norma_aplicable?: string
          onboarding_completado?: boolean
          onboarding_completado_at?: string | null
          onboarding_completado_por?: string | null
          onboarding_saltado?: boolean
          pending_price_id?: string | null
          plan?: string
          privacidad_aceptada_en?: string | null
          privacidad_version?: string | null
          razon_social?: string | null
          rfc?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          terminos_aceptados_en?: string | null
          terminos_version?: string | null
          tiene_curso_pagado?: boolean
          trial_expires_at?: string | null
          ultima_suplencia?: Json | null
          umbral_npr_alto?: number
          umbral_npr_medio?: number
          updated_at?: string
          usar_detectabilidad?: boolean
          version_formato?: string
        }
        Update: {
          activo?: boolean
          alerta_80_enviada?: boolean
          billing_interval?: string | null
          cancelled_at?: string | null
          codigo_formato?: string
          consultas_ia_extras?: number
          created_at?: string
          curso_aviso_5d_enviado_at?: string | null
          curso_expira_en?: string | null
          dc3_adicionales_disponibles?: number
          dc3_emitidos?: number
          descripcion?: string
          es_prueba?: boolean
          estado?: Database["public"]["Enums"]["org_estado"]
          folio_digitos_consecutivo?: number
          folio_formato_periodo?: string
          folio_prefijo?: string
          id?: string
          ip_aceptacion?: string | null
          logo_url?: string
          max_users?: number
          metodologia?: string
          nombre?: string
          norma_aplicable?: string
          onboarding_completado?: boolean
          onboarding_completado_at?: string | null
          onboarding_completado_por?: string | null
          onboarding_saltado?: boolean
          pending_price_id?: string | null
          plan?: string
          privacidad_aceptada_en?: string | null
          privacidad_version?: string | null
          razon_social?: string | null
          rfc?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          terminos_aceptados_en?: string | null
          terminos_version?: string | null
          tiene_curso_pagado?: boolean
          trial_expires_at?: string | null
          ultima_suplencia?: Json | null
          umbral_npr_alto?: number
          umbral_npr_medio?: number
          updated_at?: string
          usar_detectabilidad?: boolean
          version_formato?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          concepto: string
          created_at: string
          hosted_invoice_url: string | null
          id: string
          invoice_pdf_url: string | null
          metadata: Json | null
          monto_usd: number
          org_id: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          concepto: string
          created_at?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          metadata?: Json | null
          monto_usd: number
          org_id: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          concepto?: string
          created_at?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          metadata?: Json | null
          monto_usd?: number
          org_id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limites: {
        Row: {
          clave: string
          plan: string
          updated_at: string
          valor: Json
        }
        Insert: {
          clave: string
          plan: string
          updated_at?: string
          valor: Json
        }
        Update: {
          clave?: string
          plan?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_limites_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["clave"]
          },
        ]
      }
      plan_modulos: {
        Row: {
          modulo: string
          plan: string
        }
        Insert: {
          modulo: string
          plan: string
        }
        Update: {
          modulo?: string
          plan?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modulos_modulo_fkey"
            columns: ["modulo"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "plan_modulos_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["clave"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean
          clave: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          clave: string
          nombre: string
        }
        Update: {
          activo?: boolean
          clave?: string
          nombre?: string
        }
        Relationships: []
      }
      precios: {
        Row: {
          id: string
          modulo: string | null
          moneda: string
          monto: number
          periodo: string
          plan: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          id?: string
          modulo?: string | null
          moneda?: string
          monto: number
          periodo: string
          plan: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          id?: string
          modulo?: string | null
          moneda?: string
          monto?: number
          periodo?: string
          plan?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precios_modulo_fkey"
            columns: ["modulo"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "precios_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["clave"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          cargo: string | null
          created_at: string
          desactivado_en: string | null
          desactivado_por: string | null
          email: string
          firma_url: string | null
          id: string
          motivo_desactivacion: string | null
          nombre: string
          org_activa_id: string | null
          perfil_confirmado_en: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cargo?: string | null
          created_at?: string
          desactivado_en?: string | null
          desactivado_por?: string | null
          email: string
          firma_url?: string | null
          id: string
          motivo_desactivacion?: string | null
          nombre: string
          org_activa_id?: string | null
          perfil_confirmado_en?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cargo?: string | null
          created_at?: string
          desactivado_en?: string | null
          desactivado_por?: string | null
          email?: string
          firma_url?: string | null
          id?: string
          motivo_desactivacion?: string | null
          nombre?: string
          org_activa_id?: string | null
          perfil_confirmado_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_activa_id_fkey"
            columns: ["org_activa_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      puestos: {
        Row: {
          activo: boolean
          area: string
          codigo: string
          created_at: string
          created_by: string | null
          id: string
          nombre: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          area?: string
          codigo: string
          created_at?: string
          created_by?: string | null
          id?: string
          nombre: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          area?: string
          codigo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "puestos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      riesgos: {
        Row: {
          accion_implementada: string | null
          accion_propuesta: string | null
          anexos: Json | null
          causa_potencial: string
          controles_actuales: string | null
          controles_deteccion: string
          controles_prevencion: string
          created_at: string
          det_residual: number
          deteccion: number
          detectabilidad_aplicable: boolean
          dictamen: Database["public"]["Enums"]["dictamen_tipo"]
          efecto_dano: string
          etapa_proceso: string
          fecha_compromiso: string | null
          fecha_evidencia: string | null
          fecha_verificacion: string | null
          folio_id: string
          ia_origen: Json | null
          id: string
          justificacion_aceptabilidad: string
          npr: number | null
          npr_residual: number | null
          numero_id: number
          ocu_residual: number
          ocurrencia: number
          peligro: string
          peligro_modo_falla: string
          requiere_accion: boolean
          responsable: string | null
          resultado_verificacion: string
          secuencia_eventos: string
          sev_residual: number
          severidad: number
          situacion_peligrosa: string
          tipo_escala_severidad: string
          ultima_suplencia: Json | null
          updated_at: string
          verificado_por: string
        }
        Insert: {
          accion_implementada?: string | null
          accion_propuesta?: string | null
          anexos?: Json | null
          causa_potencial?: string
          controles_actuales?: string | null
          controles_deteccion?: string
          controles_prevencion?: string
          created_at?: string
          det_residual?: number
          deteccion?: number
          detectabilidad_aplicable?: boolean
          dictamen?: Database["public"]["Enums"]["dictamen_tipo"]
          efecto_dano?: string
          etapa_proceso?: string
          fecha_compromiso?: string | null
          fecha_evidencia?: string | null
          fecha_verificacion?: string | null
          folio_id: string
          ia_origen?: Json | null
          id?: string
          justificacion_aceptabilidad?: string
          npr?: number | null
          npr_residual?: number | null
          numero_id?: number
          ocu_residual?: number
          ocurrencia?: number
          peligro?: string
          peligro_modo_falla?: string
          requiere_accion?: boolean
          responsable?: string | null
          resultado_verificacion?: string
          secuencia_eventos?: string
          sev_residual?: number
          severidad?: number
          situacion_peligrosa?: string
          tipo_escala_severidad?: string
          ultima_suplencia?: Json | null
          updated_at?: string
          verificado_por?: string
        }
        Update: {
          accion_implementada?: string | null
          accion_propuesta?: string | null
          anexos?: Json | null
          causa_potencial?: string
          controles_actuales?: string | null
          controles_deteccion?: string
          controles_prevencion?: string
          created_at?: string
          det_residual?: number
          deteccion?: number
          detectabilidad_aplicable?: boolean
          dictamen?: Database["public"]["Enums"]["dictamen_tipo"]
          efecto_dano?: string
          etapa_proceso?: string
          fecha_compromiso?: string | null
          fecha_evidencia?: string | null
          fecha_verificacion?: string | null
          folio_id?: string
          ia_origen?: Json | null
          id?: string
          justificacion_aceptabilidad?: string
          npr?: number | null
          npr_residual?: number | null
          numero_id?: number
          ocu_residual?: number
          ocurrencia?: number
          peligro?: string
          peligro_modo_falla?: string
          requiere_accion?: boolean
          responsable?: string | null
          resultado_verificacion?: string
          secuencia_eventos?: string
          sev_residual?: number
          severidad?: number
          situacion_peligrosa?: string
          tipo_escala_severidad?: string
          ultima_suplencia?: Json | null
          updated_at?: string
          verificado_por?: string
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tend_areas: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          hvac_id: string | null
          id: string
          iso: string
          migrado_desde: string | null
          nombre: string
          org_id: string
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          hvac_id?: string | null
          id?: string
          iso: string
          migrado_desde?: string | null
          nombre: string
          org_id: string
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          hvac_id?: string | null
          id?: string
          iso?: string
          migrado_desde?: string | null
          nombre?: string
          org_id?: string
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_areas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_areas_org_id_hvac_id_fkey"
            columns: ["org_id", "hvac_id"]
            isOneToOne: false
            referencedRelation: "tend_sistemas_hvac"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_avisos_control: {
        Row: {
          suplencia_id: string
          terminado_en: string | null
          tomado_en: string
        }
        Insert: {
          suplencia_id: string
          terminado_en?: string | null
          tomado_en?: string
        }
        Update: {
          suplencia_id?: string
          terminado_en?: string | null
          tomado_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "tend_avisos_control_suplencia_id_fkey"
            columns: ["suplencia_id"]
            isOneToOne: true
            referencedRelation: "org_suplencias"
            referencedColumns: ["id"]
          },
        ]
      }
      tend_cambios_filtro: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          instrumento_id: string
          migrado_desde: string | null
          nota: string
          org_id: string
          retirado_en: string | null
          retirado_motivo: string | null
          retirado_por: string | null
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          instrumento_id: string
          migrado_desde?: string | null
          nota?: string
          org_id: string
          retirado_en?: string | null
          retirado_motivo?: string | null
          retirado_por?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          instrumento_id?: string
          migrado_desde?: string | null
          nota?: string
          org_id?: string
          retirado_en?: string | null
          retirado_motivo?: string | null
          retirado_por?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_cambios_filtro_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_cambios_filtro_org_id_instrumento_id_fkey"
            columns: ["org_id", "instrumento_id"]
            isOneToOne: false
            referencedRelation: "tend_instrumentos"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          migrado_desde: string | null
          org_id: string
          permitir_autoemision: boolean
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          migrado_desde?: string | null
          org_id: string
          permitir_autoemision?: boolean
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          migrado_desde?: string | null
          org_id?: string
          permitir_autoemision?: boolean
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tend_extracciones: {
        Row: {
          confirmado_en: string | null
          confirmado_por: string | null
          created_at: string
          error: string | null
          estado: string
          foto_path: string
          id: string
          modelo_ia: string | null
          modulo: string
          org_id: string
          registro_id: string
          semana_id: string | null
          skills_usadas: Json
          solicitado_por: string
          tokens_input: number
          tokens_output: number
          valores_confirmados: Json | null
          valores_propuestos: Json | null
        }
        Insert: {
          confirmado_en?: string | null
          confirmado_por?: string | null
          created_at?: string
          error?: string | null
          estado?: string
          foto_path: string
          id?: string
          modelo_ia?: string | null
          modulo: string
          org_id: string
          registro_id: string
          semana_id?: string | null
          skills_usadas?: Json
          solicitado_por: string
          tokens_input?: number
          tokens_output?: number
          valores_confirmados?: Json | null
          valores_propuestos?: Json | null
        }
        Update: {
          confirmado_en?: string | null
          confirmado_por?: string | null
          created_at?: string
          error?: string | null
          estado?: string
          foto_path?: string
          id?: string
          modelo_ia?: string | null
          modulo?: string
          org_id?: string
          registro_id?: string
          semana_id?: string | null
          skills_usadas?: Json
          solicitado_por?: string
          tokens_input?: number
          tokens_output?: number
          valores_confirmados?: Json | null
          valores_propuestos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_extracciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_extracciones_org_id_registro_id_fkey"
            columns: ["org_id", "registro_id"]
            isOneToOne: false
            referencedRelation: "tend_registros"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_extracciones_org_id_semana_id_fkey"
            columns: ["org_id", "semana_id"]
            isOneToOne: false
            referencedRelation: "tend_semanas"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_formato: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          firmantes: Json
          firmantes_elegibles: Json | null
          id: string
          logo: string | null
          migrado_desde: string | null
          org_id: string
          tabla_iso: Json
          textos: Json
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
          version: number
          version_formato: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          firmantes?: Json
          firmantes_elegibles?: Json | null
          id?: string
          logo?: string | null
          migrado_desde?: string | null
          org_id: string
          tabla_iso?: Json
          textos?: Json
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          version_formato?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          firmantes?: Json
          firmantes_elegibles?: Json | null
          id?: string
          logo?: string | null
          migrado_desde?: string | null
          org_id?: string
          tabla_iso?: Json
          textos?: Json
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          version_formato?: string
        }
        Relationships: [
          {
            foreignKeyName: "tend_formato_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tend_ia_control: {
        Row: {
          bloqueado: boolean
          mensaje: string | null
          org_id: string
          status: number | null
          updated_at: string
        }
        Insert: {
          bloqueado?: boolean
          mensaje?: string | null
          org_id: string
          status?: number | null
          updated_at?: string
        }
        Update: {
          bloqueado?: boolean
          mensaje?: string | null
          org_id?: string
          status?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tend_ia_control_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tend_instrumentos: {
        Row: {
          activo: boolean
          area_estado: string
          area_id: string | null
          area_libre: string | null
          area_nota: string | null
          baseline_pa: number | null
          baseline_tolerancia_pct: number | null
          clase_instrumento: string | null
          codigo: string
          codigo_bitacora: string | null
          created_at: string
          created_by: string | null
          descripcion_equipo: string | null
          dp_final_fabricante: number | null
          escala_max: number | null
          escala_min: number | null
          escala_unidad: string | null
          especificacion: string | null
          id: string
          lie_pa: number | null
          lse_pa: number | null
          migrado_desde: string | null
          op_max_pa: number | null
          op_min_pa: number | null
          org_id: string
          parametro: string
          spec_criterio_interno: boolean
          spec_estado: string | null
          spec_fecha_validacion: string | null
          spec_lie: number | null
          spec_lie_estricto: boolean
          spec_lie_hr: number | null
          spec_lse: number | null
          spec_lse_estricto: boolean
          spec_lse_hr: number | null
          spec_nota: string | null
          spec_referencia: string | null
          spec_texto: string | null
          spec_texto_hr: string | null
          tipo: string
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          area_estado?: string
          area_id?: string | null
          area_libre?: string | null
          area_nota?: string | null
          baseline_pa?: number | null
          baseline_tolerancia_pct?: number | null
          clase_instrumento?: string | null
          codigo: string
          codigo_bitacora?: string | null
          created_at?: string
          created_by?: string | null
          descripcion_equipo?: string | null
          dp_final_fabricante?: number | null
          escala_max?: number | null
          escala_min?: number | null
          escala_unidad?: string | null
          especificacion?: string | null
          id?: string
          lie_pa?: number | null
          lse_pa?: number | null
          migrado_desde?: string | null
          op_max_pa?: number | null
          op_min_pa?: number | null
          org_id: string
          parametro: string
          spec_criterio_interno?: boolean
          spec_estado?: string | null
          spec_fecha_validacion?: string | null
          spec_lie?: number | null
          spec_lie_estricto?: boolean
          spec_lie_hr?: number | null
          spec_lse?: number | null
          spec_lse_estricto?: boolean
          spec_lse_hr?: number | null
          spec_nota?: string | null
          spec_referencia?: string | null
          spec_texto?: string | null
          spec_texto_hr?: string | null
          tipo: string
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          area_estado?: string
          area_id?: string | null
          area_libre?: string | null
          area_nota?: string | null
          baseline_pa?: number | null
          baseline_tolerancia_pct?: number | null
          clase_instrumento?: string | null
          codigo?: string
          codigo_bitacora?: string | null
          created_at?: string
          created_by?: string | null
          descripcion_equipo?: string | null
          dp_final_fabricante?: number | null
          escala_max?: number | null
          escala_min?: number | null
          escala_unidad?: string | null
          especificacion?: string | null
          id?: string
          lie_pa?: number | null
          lse_pa?: number | null
          migrado_desde?: string | null
          op_max_pa?: number | null
          op_min_pa?: number | null
          org_id?: string
          parametro?: string
          spec_criterio_interno?: boolean
          spec_estado?: string | null
          spec_fecha_validacion?: string | null
          spec_lie?: number | null
          spec_lie_estricto?: boolean
          spec_lie_hr?: number | null
          spec_lse?: number | null
          spec_lse_estricto?: boolean
          spec_lse_hr?: number | null
          spec_nota?: string | null
          spec_referencia?: string | null
          spec_texto?: string | null
          spec_texto_hr?: string | null
          tipo?: string
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_instrumentos_org_id_area_id_fkey"
            columns: ["org_id", "area_id"]
            isOneToOne: false
            referencedRelation: "tend_areas"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_instrumentos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tend_norma_especificaciones: {
        Row: {
          activo: boolean
          apartado: string | null
          clase_iso: string
          created_at: string
          id: string
          lie: number | null
          lie_estricto: boolean
          lse: number | null
          lse_estricto: boolean
          norma: string
          nota: string | null
          sin_valor: boolean
          texto: string
          unidad: string | null
          updated_at: string
          updated_by: string | null
          variable: string
        }
        Insert: {
          activo?: boolean
          apartado?: string | null
          clase_iso: string
          created_at?: string
          id?: string
          lie?: number | null
          lie_estricto?: boolean
          lse?: number | null
          lse_estricto?: boolean
          norma: string
          nota?: string | null
          sin_valor?: boolean
          texto: string
          unidad?: string | null
          updated_at?: string
          updated_by?: string | null
          variable: string
        }
        Update: {
          activo?: boolean
          apartado?: string | null
          clase_iso?: string
          created_at?: string
          id?: string
          lie?: number | null
          lie_estricto?: boolean
          lse?: number | null
          lse_estricto?: boolean
          norma?: string
          nota?: string | null
          sin_valor?: boolean
          texto?: string
          unidad?: string | null
          updated_at?: string
          updated_by?: string | null
          variable?: string
        }
        Relationships: []
      }
      tend_objetivos_presion: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          cuarto_x_id: string | null
          cuarto_y_id: string | null
          id: string
          instrumento_id: string | null
          iso: string | null
          lie_pa: number | null
          limite_normativo_pa: number | null
          lse_pa: number | null
          migrado_desde: string | null
          nombre: string
          org_id: string
          par_cuartos_id: string | null
          tipo: string
          ultima_suplencia: Json | null
          unidad: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          cuarto_x_id?: string | null
          cuarto_y_id?: string | null
          id?: string
          instrumento_id?: string | null
          iso?: string | null
          lie_pa?: number | null
          limite_normativo_pa?: number | null
          lse_pa?: number | null
          migrado_desde?: string | null
          nombre: string
          org_id: string
          par_cuartos_id?: string | null
          tipo?: string
          ultima_suplencia?: Json | null
          unidad?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          cuarto_x_id?: string | null
          cuarto_y_id?: string | null
          id?: string
          instrumento_id?: string | null
          iso?: string | null
          lie_pa?: number | null
          limite_normativo_pa?: number | null
          lse_pa?: number | null
          migrado_desde?: string | null
          nombre?: string
          org_id?: string
          par_cuartos_id?: string | null
          tipo?: string
          ultima_suplencia?: Json | null
          unidad?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_objetivos_presion_org_id_cuarto_x_id_fkey"
            columns: ["org_id", "cuarto_x_id"]
            isOneToOne: false
            referencedRelation: "tend_areas"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_objetivos_presion_org_id_cuarto_y_id_fkey"
            columns: ["org_id", "cuarto_y_id"]
            isOneToOne: false
            referencedRelation: "tend_areas"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_objetivos_presion_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_objetivos_presion_org_id_instrumento_id_fkey"
            columns: ["org_id", "instrumento_id"]
            isOneToOne: false
            referencedRelation: "tend_instrumentos"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_registros: {
        Row: {
          activo: boolean
          area_id: string | null
          codigo_area_libre: string | null
          created_at: string
          created_by: string | null
          etapa: string | null
          hvac_id: string | null
          id: string
          instrumento_id: string | null
          iso: string | null
          lie: number | null
          lie_hr: number | null
          lie_t: number | null
          lse: number | null
          lse_hr: number | null
          lse_t: number | null
          migrado_desde: string | null
          modulo: string
          nombre: string
          nombre_area_libre: string | null
          org_id: string
          par_cuartos_id: string | null
          retirado_en: string | null
          retirado_motivo: string | null
          retirado_por: string | null
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          area_id?: string | null
          codigo_area_libre?: string | null
          created_at?: string
          created_by?: string | null
          etapa?: string | null
          hvac_id?: string | null
          id?: string
          instrumento_id?: string | null
          iso?: string | null
          lie?: number | null
          lie_hr?: number | null
          lie_t?: number | null
          lse?: number | null
          lse_hr?: number | null
          lse_t?: number | null
          migrado_desde?: string | null
          modulo: string
          nombre: string
          nombre_area_libre?: string | null
          org_id: string
          par_cuartos_id?: string | null
          retirado_en?: string | null
          retirado_motivo?: string | null
          retirado_por?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          area_id?: string | null
          codigo_area_libre?: string | null
          created_at?: string
          created_by?: string | null
          etapa?: string | null
          hvac_id?: string | null
          id?: string
          instrumento_id?: string | null
          iso?: string | null
          lie?: number | null
          lie_hr?: number | null
          lie_t?: number | null
          lse?: number | null
          lse_hr?: number | null
          lse_t?: number | null
          migrado_desde?: string | null
          modulo?: string
          nombre?: string
          nombre_area_libre?: string | null
          org_id?: string
          par_cuartos_id?: string | null
          retirado_en?: string | null
          retirado_motivo?: string | null
          retirado_por?: string | null
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_registros_org_id_area_id_fkey"
            columns: ["org_id", "area_id"]
            isOneToOne: false
            referencedRelation: "tend_areas"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_registros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_registros_org_id_hvac_id_fkey"
            columns: ["org_id", "hvac_id"]
            isOneToOne: false
            referencedRelation: "tend_sistemas_hvac"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_registros_org_id_instrumento_id_fkey"
            columns: ["org_id", "instrumento_id"]
            isOneToOne: false
            referencedRelation: "tend_instrumentos"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_registros_at: {
        Row: {
          anulacion_en_suplencia: boolean
          anulacion_suplencia_id: string | null
          anulado_cargo: string | null
          anulado_email: string | null
          anulado_en: string | null
          anulado_nombre: string | null
          anulado_por: string | null
          autoemitido: boolean
          codigo: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          datos_snapshot: Json | null
          dictamen_global: string | null
          elaborado_cargo: string | null
          elaborado_nombre: string | null
          elaborado_version_por: string | null
          emitido_at: string | null
          emitido_by: string | null
          emitido_by_email: string | null
          emitido_cargo: string | null
          emitido_nombre: string | null
          emitido_por: string | null
          en_suplencia: boolean
          estado: string
          fecha: string
          firmantes_at: Json | null
          formato_snapshot: Json | null
          ia_origen: Json | null
          id: string
          instrumentos: Json
          justificaciones: Json
          migrado_desde: string | null
          modificadores_version: string[]
          motivo_anulacion: string | null
          motivo_version: string | null
          org_id: string
          periodo_desde: string
          periodo_etiqueta: string | null
          periodo_hasta: string
          rs_sustituido_nombre: string | null
          seleccion: Json | null
          sistema: string
          suplencia_id: string | null
          texto: Json
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
          updated_by_email: string | null
          usuario_email: string | null
          usuario_id: string | null
          version: number
        }
        Insert: {
          anulacion_en_suplencia?: boolean
          anulacion_suplencia_id?: string | null
          anulado_cargo?: string | null
          anulado_email?: string | null
          anulado_en?: string | null
          anulado_nombre?: string | null
          anulado_por?: string | null
          autoemitido?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          datos_snapshot?: Json | null
          dictamen_global?: string | null
          elaborado_cargo?: string | null
          elaborado_nombre?: string | null
          elaborado_version_por?: string | null
          emitido_at?: string | null
          emitido_by?: string | null
          emitido_by_email?: string | null
          emitido_cargo?: string | null
          emitido_nombre?: string | null
          emitido_por?: string | null
          en_suplencia?: boolean
          estado?: string
          fecha?: string
          firmantes_at?: Json | null
          formato_snapshot?: Json | null
          ia_origen?: Json | null
          id?: string
          instrumentos?: Json
          justificaciones?: Json
          migrado_desde?: string | null
          modificadores_version?: string[]
          motivo_anulacion?: string | null
          motivo_version?: string | null
          org_id: string
          periodo_desde: string
          periodo_etiqueta?: string | null
          periodo_hasta: string
          rs_sustituido_nombre?: string | null
          seleccion?: Json | null
          sistema: string
          suplencia_id?: string | null
          texto?: Json
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          version?: number
        }
        Update: {
          anulacion_en_suplencia?: boolean
          anulacion_suplencia_id?: string | null
          anulado_cargo?: string | null
          anulado_email?: string | null
          anulado_en?: string | null
          anulado_nombre?: string | null
          anulado_por?: string | null
          autoemitido?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          datos_snapshot?: Json | null
          dictamen_global?: string | null
          elaborado_cargo?: string | null
          elaborado_nombre?: string | null
          elaborado_version_por?: string | null
          emitido_at?: string | null
          emitido_by?: string | null
          emitido_by_email?: string | null
          emitido_cargo?: string | null
          emitido_nombre?: string | null
          emitido_por?: string | null
          en_suplencia?: boolean
          estado?: string
          fecha?: string
          firmantes_at?: Json | null
          formato_snapshot?: Json | null
          ia_origen?: Json | null
          id?: string
          instrumentos?: Json
          justificaciones?: Json
          migrado_desde?: string | null
          modificadores_version?: string[]
          motivo_anulacion?: string | null
          motivo_version?: string | null
          org_id?: string
          periodo_desde?: string
          periodo_etiqueta?: string | null
          periodo_hasta?: string
          rs_sustituido_nombre?: string | null
          seleccion?: Json | null
          sistema?: string
          suplencia_id?: string | null
          texto?: Json
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tend_at_anulacion_suplencia_fk"
            columns: ["org_id", "anulacion_suplencia_id"]
            isOneToOne: false
            referencedRelation: "org_suplencias"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_at_suplencia_fk"
            columns: ["org_id", "suplencia_id"]
            isOneToOne: false
            referencedRelation: "org_suplencias"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_registros_at_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tend_registros_at_historial: {
        Row: {
          codigo: string
          created_at: string
          created_by: string | null
          datos: Json
          fecha: string
          id: string
          migrado_desde: string | null
          operacion: string
          org_id: string
          registro_id: string
          updated_at: string
          updated_by: string | null
          usuario_email: string | null
          usuario_id: string | null
          version: number
        }
        Insert: {
          codigo: string
          created_at?: string
          created_by?: string | null
          datos: Json
          fecha?: string
          id?: string
          migrado_desde?: string | null
          operacion?: string
          org_id: string
          registro_id: string
          updated_at?: string
          updated_by?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          version: number
        }
        Update: {
          codigo?: string
          created_at?: string
          created_by?: string | null
          datos?: Json
          fecha?: string
          id?: string
          migrado_desde?: string | null
          operacion?: string
          org_id?: string
          registro_id?: string
          updated_at?: string
          updated_by?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tend_registros_at_historial_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_registros_at_historial_org_id_registro_id_fkey"
            columns: ["org_id", "registro_id"]
            isOneToOne: false
            referencedRelation: "tend_registros_at"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_semanas: {
        Row: {
          activo: boolean
          anio: string
          created_at: string
          created_by: string | null
          foto_path: string | null
          id: string
          lecturas: Json
          lecturas_hr: Json | null
          mes: string
          migrado_desde: string | null
          objetivo_presion_id: string | null
          observaciones: string
          org_id: string
          registro_id: string
          retirado_en: string | null
          retirado_motivo: string | null
          retirado_por: string | null
          saved_at: string
          semana_inicio: string
          source: string
          ultima_suplencia: Json | null
          unidad: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          anio: string
          created_at?: string
          created_by?: string | null
          foto_path?: string | null
          id?: string
          lecturas?: Json
          lecturas_hr?: Json | null
          mes: string
          migrado_desde?: string | null
          objetivo_presion_id?: string | null
          observaciones?: string
          org_id: string
          registro_id: string
          retirado_en?: string | null
          retirado_motivo?: string | null
          retirado_por?: string | null
          saved_at?: string
          semana_inicio: string
          source?: string
          ultima_suplencia?: Json | null
          unidad: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          anio?: string
          created_at?: string
          created_by?: string | null
          foto_path?: string | null
          id?: string
          lecturas?: Json
          lecturas_hr?: Json | null
          mes?: string
          migrado_desde?: string | null
          objetivo_presion_id?: string | null
          observaciones?: string
          org_id?: string
          registro_id?: string
          retirado_en?: string | null
          retirado_motivo?: string | null
          retirado_por?: string | null
          saved_at?: string
          semana_inicio?: string
          source?: string
          ultima_suplencia?: Json | null
          unidad?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_semanas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tend_semanas_org_id_objetivo_presion_id_fkey"
            columns: ["org_id", "objetivo_presion_id"]
            isOneToOne: false
            referencedRelation: "tend_objetivos_presion"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tend_semanas_org_id_registro_id_fkey"
            columns: ["org_id", "registro_id"]
            isOneToOne: false
            referencedRelation: "tend_registros"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      tend_sistemas_hvac: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          descripcion: string
          etapas: string[]
          id: string
          migrado_desde: string | null
          nombre_uma: string
          org_id: string
          ultima_suplencia: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          descripcion?: string
          etapas?: string[]
          id?: string
          migrado_desde?: string | null
          nombre_uma: string
          org_id: string
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string
          etapas?: string[]
          id?: string
          migrado_desde?: string | null
          nombre_uma?: string
          org_id?: string
          ultima_suplencia?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tend_sistemas_hvac_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_mensajes: {
        Row: {
          autor_email: string
          autor_id: string
          autor_nombre: string
          created_at: string
          es_interno: boolean
          es_soporte: boolean
          id: string
          mensaje: string
          ticket_id: string
        }
        Insert: {
          autor_email: string
          autor_id: string
          autor_nombre: string
          created_at?: string
          es_interno?: boolean
          es_soporte?: boolean
          id?: string
          mensaje: string
          ticket_id: string
        }
        Update: {
          autor_email?: string
          autor_id?: string
          autor_nombre?: string
          created_at?: string
          es_interno?: boolean
          es_soporte?: boolean
          id?: string
          mensaje?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_mensajes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sequence: {
        Row: {
          last_number: number
          org_id: string
          year: number
        }
        Insert: {
          last_number?: number
          org_id: string
          year: number
        }
        Update: {
          last_number?: number
          org_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sequence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asignado_a: string | null
          asignado_a_email: string | null
          asunto: string
          categoria: Database["public"]["Enums"]["ticket_categoria"]
          cerrado_at: string | null
          codigo: string
          created_at: string
          created_by: string
          created_by_email: string
          created_by_nombre: string
          descripcion: string
          estado: Database["public"]["Enums"]["ticket_estado"]
          id: string
          impersonation_log_id: string | null
          org_id: string
          primera_respuesta_at: string | null
          prioridad: Database["public"]["Enums"]["ticket_prioridad"]
          resuelto_at: string | null
          sla_resolucion_at: string
          sla_respuesta_at: string
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          asignado_a_email?: string | null
          asunto: string
          categoria?: Database["public"]["Enums"]["ticket_categoria"]
          cerrado_at?: string | null
          codigo: string
          created_at?: string
          created_by: string
          created_by_email: string
          created_by_nombre: string
          descripcion: string
          estado?: Database["public"]["Enums"]["ticket_estado"]
          id?: string
          impersonation_log_id?: string | null
          org_id: string
          primera_respuesta_at?: string | null
          prioridad?: Database["public"]["Enums"]["ticket_prioridad"]
          resuelto_at?: string | null
          sla_resolucion_at: string
          sla_respuesta_at: string
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          asignado_a_email?: string | null
          asunto?: string
          categoria?: Database["public"]["Enums"]["ticket_categoria"]
          cerrado_at?: string | null
          codigo?: string
          created_at?: string
          created_by?: string
          created_by_email?: string
          created_by_nombre?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["ticket_estado"]
          id?: string
          impersonation_log_id?: string | null
          org_id?: string
          primera_respuesta_at?: string | null
          prioridad?: Database["public"]["Enums"]["ticket_prioridad"]
          resuelto_at?: string | null
          sla_resolucion_at?: string
          sla_respuesta_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_impersonation_log_id_fkey"
            columns: ["impersonation_log_id"]
            isOneToOne: false
            referencedRelation: "impersonation_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      vinculo_tipos_entidad: {
        Row: {
          activo: boolean
          descripcion: string | null
          modulo: string
          tabla: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          modulo: string
          tabla: string
          tipo: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          modulo?: string
          tabla?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculo_tipos_entidad_modulo_fkey"
            columns: ["modulo"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["clave"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acceso_curso_org: {
        Args: { p_curso_id: string; p_org: string }
        Returns: string
      }
      admin_set_modulo: {
        Args: {
          _activo: boolean
          _clave: string
          _motivo: string
          _org: string
        }
        Returns: undefined
      }
      anular_kpi_reporte: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      anular_kpi_resultado: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      aplicar_kpis_excel: {
        Args: { _borrador?: boolean; _motivo: string; _paquete: Json }
        Returns: undefined
      }
      aplicar_resultados_excel: {
        Args: { _celdas: Json; _motivo: string }
        Returns: number
      }
      archivar_version_folio: {
        Args: { p_folio_id: string; p_motivo?: string }
        Returns: string
      }
      asignar_capturistas: {
        Args: {
          _capturistas: string[]
          _codigo: string
          _motivo: string
          _tabla: string
        }
        Returns: undefined
      }
      auditor_caratula: {
        Args: { p_auditoria_id: string; p_descargar?: boolean }
        Returns: Json
      }
      auditor_mis_expedientes: {
        Args: never
        Returns: {
          auditor_nombre: string
          expira_en: string
          id: string
          inicia_en: string
          items: Json
          nombre: string
          org_nombre: string
          permite_descarga: boolean
        }[]
      }
      auditor_persona: { Args: { p_id: string }; Returns: Json }
      auditor_registrar_descarga_folio: {
        Args: { p_item_id: string }
        Returns: Json
      }
      auditor_registrar_folio_pdf: {
        Args: { p_descargar: boolean; p_item_id: string }
        Returns: Json
      }
      auditor_registrar_pdf_generado: {
        Args: { p_descargar: boolean; p_item_id: string }
        Returns: Json
      }
      auditor_ver_item: { Args: { p_item_id: string }; Returns: Json }
      auditoria_actividad: {
        Args: { p_auditoria_id: string }
        Returns: {
          accion: string
          archivo: string
          es_auditor: boolean
          fecha: string
          ip: string
          item_id: string
          modo: string
          persona: string
          sha256: string
          tipo: string
        }[]
      }
      auditoria_validar_acceso: {
        Args: { p_item_id: string; p_user: string }
        Returns: Json
      }
      brain_resolver_enlace: {
        Args: {
          p_archivo_id: string
          p_confirmar: boolean
          p_documento_id: string
        }
        Returns: undefined
      }
      brain_sugerencias_enlace: {
        Args: never
        Returns: {
          archivo_id: string
          archivo_nombre: string
          codigo: string
          documento_id: string
          documento_nombre: string
          nombre_archivo: string
          revision: string
        }[]
      }
      brain_turn_claim_operation: {
        Args: {
          p_clave: string
          p_org_id: string
          p_stale_seconds?: number
          p_turn_id: string
        }
        Returns: Json
      }
      brain_turn_set_operation: {
        Args: {
          p_clave: string
          p_error?: string
          p_org_id: string
          p_resultado: Json
          p_status?: string
          p_turn_id: string
        }
        Returns: undefined
      }
      cambiar_rol_miembro: {
        Args: {
          _motivo: string
          _rol: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      cancelar_folio: {
        Args: {
          p_folio_id: string
          p_motivo_codigo: string
          p_motivo_texto: string
        }
        Returns: {
          alcance: string | null
          beneficio_clinico: string
          cancelado_en: string | null
          cancelado_por: string | null
          clase_dispositivo: string
          clasificacion_categoria: string
          clasificacion_condicion_venta: string
          clasificacion_riesgo_sanitario: string
          clasificacion_tipo: string
          codigo: string
          codigo_consecutivo: number | null
          codigo_periodo: string | null
          conclusion: string | null
          control_cambios_id: string | null
          created_at: string
          created_by: string | null
          desviacion_id: string | null
          dictamen_autoemitido: boolean
          dictamen_por: string | null
          dictamen_suplencia: Json | null
          estado: Database["public"]["Enums"]["estado_folio"]
          fecha_cierre: string | null
          fecha_inicio: string
          id: string
          justificacion_tecnica: string | null
          metodologia_folio: string
          motivo_cancelacion: string | null
          motivo_cancelacion_codigo: string | null
          norma_folio: string
          normas_aplicables: string[]
          numero_lote: string
          numero_modelo: string
          numero_version: string
          org_id: string
          origen: string
          proceso_equipo: string
          riesgo_residual_global: string
          tipo_folio: string | null
          ultima_suplencia: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "folios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_reserva_emision_kpi_word: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      capturar_kpi_resultado: {
        Args: {
          _comentario: string
          _denominador: number
          _descripcion_evento: string
          _evidencia_path: string
          _fecha_evento: string
          _kpi_id: string
          _motivo: string
          _numerador: number
          _periodo_fin: string
          _periodo_inicio: string
          _resultado_id?: string
          _tabla: string
        }
        Returns: string
      }
      cerrar_mis_soportes: {
        Args: { _log_id?: string; _tipo: string }
        Returns: number
      }
      clasificar_tipo_documento: {
        Args: { p_codigo: string; p_org: string; p_tipo: string }
        Returns: string
      }
      clasificar_tipos_documento: {
        Args: { p_items: Json; p_org: string }
        Returns: Json
      }
      codigo_tokens: { Args: { _t: string }; Returns: string }
      configurar_modelo_skill: {
        Args: { _clave: string; _modelo: string; _motivo: string }
        Returns: undefined
      }
      confirmar_catalogo_documentos: { Args: never; Returns: string }
      confirmar_documento_archivo: {
        Args: { _folio: string; _sha256: string }
        Returns: undefined
      }
      confirmar_emision_kpi_word: {
        Args: { _id: string; _logo: Json; _sha256: string; _token: string }
        Returns: Json
      }
      confirmar_perfil: {
        Args: { _cargo: string; _nombre: string }
        Returns: undefined
      }
      congelar_logo_kpi_word: {
        Args: { _id: string; _logo: Json; _token: string }
        Returns: undefined
      }
      conocimiento_usado_en: {
        Args: { _id: string }
        Returns: {
          fecha: string
          folio: string
          folio_id: string
          nota: string
          riesgo: string
          riesgo_id: string
        }[]
      }
      contexto_borrador_kpi_word: { Args: { _id: string }; Returns: Json }
      contexto_cerebro: {
        Args: {
          _folio_id: string
          _limite?: number
          _org: string
          _texto: string
        }
        Returns: {
          area: string
          codigo: string
          contenido: string
          fuente: Json
          id: string
          proceso: string
          tipo: string
          validado_en: string
          validado_por: string
        }[]
      }
      contexto_org_actual: {
        Args: never
        Returns: {
          es_super_admin: boolean
          org_id: string
          rol_en_org: string
          soporte_log_id: string
        }[]
      }
      crear_kpi_reporte: {
        Args: {
          _inicio: string
          _procesos?: string[]
          _puestos?: string[]
          _tipo: string
        }
        Returns: string
      }
      crear_sesion_entrevista: {
        Args: {
          p_assignment_id?: string
          p_capa?: string
          p_entrevistado_area?: string
          p_entrevistado_nombre?: string
          p_entrevistado_profile_id?: string
          p_entrevistado_puesto?: string
          p_nivel_autoridad?: string
          p_proceso_ids?: string[]
        }
        Returns: Json
      }
      cumplimiento_curso: {
        Args: { p_curso_id: string; p_org_id?: string }
        Returns: {
          aprobado: boolean
          diploma_folio: string
          diploma_hash: string
          email: string
          fecha_aprobacion: string
          intentos: number
          mejor_calificacion: number
          nombre: string
          rol: string
          user_id: string
        }[]
      }
      curso_modulo_en_vista_previa: {
        Args: { p_modulo_id: string }
        Returns: boolean
      }
      curso_total_lecciones: { Args: { p_curso_id: string }; Returns: number }
      cursos_ids_modulo: {
        Args: { p_modulo: string }
        Returns: {
          id: string
        }[]
      }
      designar_suplencia: {
        Args: {
          _categoria: string
          _fin: string
          _inicio: string
          _motivo: string
          _rol: Database["public"]["Enums"]["app_role"]
          _suplente: string
          _titular: string
        }
        Returns: string
      }
      dictaminar_folio_efectivo: {
        Args: { _conclusion: string; _folio: string; _motivo?: string }
        Returns: undefined
      }
      documental_puede_editar: { Args: never; Returns: boolean }
      documento_tipos_uso: {
        Args: never
        Returns: {
          archivos: number
          clave: string
          documentos: number
        }[]
      }
      documentos_retenidos: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          motivo: string
        }[]
      }
      duplicar_auditoria: {
        Args: {
          p_auditor_email: string
          p_auditor_nombre: string
          p_auditor_organizacion: string
          p_expira_en: string
          p_inicia_en: string
          p_nombre: string
          p_origen: string
          p_permite_descarga: boolean
        }
        Returns: Json
      }
      eliminar_documento_permanente: {
        Args: { p_doc_id: string }
        Returns: string
      }
      emitir_kpi_reporte: { Args: { _id: string }; Returns: Json }
      enviar_kpi_reporte: { Args: { _id: string }; Returns: undefined }
      examen_calificar: {
        Args: {
          p_duracion_seg?: number
          p_intento_id: string
          p_respuestas: Json
          p_tab_blur_count?: number
        }
        Returns: Json
      }
      examen_iniciar: { Args: { p_curso_id: string }; Returns: Json }
      examen_validar_acceso: {
        Args: { p_curso_id: string }
        Returns: undefined
      }
      examen_validar_banco: { Args: { p_curso_id: string }; Returns: Json }
      firmar_folio_suplencia: {
        Args: {
          _agente: string
          _compromiso: string
          _folio: string
          _hash: string
          _ip: string
        }
        Returns: string
      }
      folios_revision_corte: { Args: { p_ahora?: string }; Returns: string }
      get_user_org_id: { Args: never; Returns: string }
      guardar_autoridad_calidad: {
        Args: { _autorizadores: string[]; _modo: string; _motivo: string }
        Returns: string
      }
      guardar_formato_documento: {
        Args: {
          _codigo: string
          _firmas: Json
          _motivo: string
          _tipo: string
          _titulo: string
          _version: string
          _vigente_desde: string
        }
        Returns: string
      }
      guardar_identidad_documental: {
        Args: {
          _confidencialidad: string
          _copia: string
          _domicilio: string
          _motivo: string
          _pie: string
          _razon_social: string
        }
        Returns: string
      }
      guardar_kpi_reporte: {
        Args: { _datos: Json; _id: string }
        Returns: undefined
      }
      guardar_kpi_reporte_config: {
        Args: {
          _alcance: string
          _autorizadores: string[]
          _metodologia: string
          _motivo: string
          _objetivo: string
        }
        Returns: string
      }
      guardar_kpi_reporte_textos: {
        Args: {
          _alcance: string
          _autorizadores: string[]
          _metodologia: string
          _motivo: string
          _objetivo: string
          _textos_fijos: boolean
        }
        Returns: string
      }
      guardar_kpi_resultado: {
        Args: {
          _comentario: string
          _denominador: number
          _descripcion_evento: string
          _fecha_evento: string
          _kpi_id: string
          _motivo: string
          _numerador: number
          _periodo_inicio: string
          _referencia: string
          _resultado_id?: string
          _tabla: string
        }
        Returns: string
      }
      guardar_kpis: {
        Args: { _motivo: string; _paquete: Json }
        Returns: undefined
      }
      guardar_semaforo_pendientes: {
        Args: {
          _gestion_naranja: number
          _gestion_rojo: number
          _operativo_naranja: number
          _operativo_rojo: number
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ia_skill_casos_faltantes: {
        Args: { p_prompt_id: string }
        Returns: number
      }
      is_super_admin: { Args: never; Returns: boolean }
      kpi_acceso: {
        Args: { _escritura?: boolean; _org: string; _validar?: boolean }
        Returns: boolean
      }
      kpi_acumulado_interno: {
        Args: { _fin: string; _ini: string; _org: string }
        Returns: {
          codigo: string
          cumplimiento: number
          frecuencia: string
          kid: string
          meta: number
          metas: number[]
          n_res: number
          nivel: string
          nombre: string
          peso: number
          proceso: string
          puesto_id: string
          semaforo: string
          subperiodos: Json
          tabla: string
          tendencia: string
          unidad: string
          valor: number
        }[]
      }
      kpi_aplicar_interno: {
        Args: { _borrador?: boolean; _motivo: string; _paquete: Json }
        Returns: undefined
      }
      kpi_calcular: {
        Args: {
          _den: number
          _meta: number
          _num: number
          _tendencia: string
          _unidad: string
        }
        Returns: Record<string, unknown>
      }
      kpi_excel_fecha: { Args: { _valor: string }; Returns: string }
      kpi_excel_numero: { Args: { _valor: string }; Returns: number }
      kpi_excel_periodo: {
        Args: { _fecha: string; _frecuencia: string }
        Returns: {
          fin: string
          inicio: string
        }[]
      }
      kpi_periodo: {
        Args: { _fecha: string; _frecuencia: string }
        Returns: Record<string, unknown>
      }
      kpi_puede_capturar: {
        Args: { _capturistas: string[]; _org: string }
        Returns: boolean
      }
      kpi_reporte_autoriza: {
        Args: { _org: string; _u: string }
        Returns: string
      }
      kpi_reporte_faltantes: {
        Args: { _r: Database["public"]["Tables"]["kpi_reportes"]["Row"] }
        Returns: string
      }
      kpi_reporte_preparar: { Args: { _motivo: string }; Returns: string }
      kpi_resumen_periodo: {
        Args: { _filtros?: Json; _inicio: string; _tipo: string }
        Returns: Json
      }
      kpi_semaforo_cumplimiento: { Args: { _c: number }; Returns: string }
      kpi_ultimo_cerrado: {
        Args: { _frecuencia: string; _hoy: string }
        Returns: Record<string, unknown>
      }
      ligar_kpi_evidencia: {
        Args: { _evidencia_id: string; _resultados: string[] }
        Returns: number
      }
      listar_documentos_archivados: {
        Args: {
          _desde?: string
          _folio?: string
          _hasta?: string
          _pagina?: number
          _tipo?: string
          _usuario?: string
        }
        Returns: Json
      }
      mi_acceso_curso: { Args: { p_curso_id: string }; Returns: string }
      mi_autoridad_calidad: { Args: never; Returns: Json }
      mi_ia_en_prueba: { Args: never; Returns: boolean }
      mi_org_tiene_modulo: { Args: { _modulo: string }; Returns: boolean }
      mi_plan_limite: { Args: { p_clave: string }; Returns: Json }
      mis_cursos_certificados: {
        Args: never
        Returns: {
          id: string
          modulo_clave: string
          titulo: string
        }[]
      }
      mis_modulos: {
        Args: never
        Returns: {
          clave: string
          descripcion: string
          estado: string
          nombre: string
          orden: number
          tiene_acceso: boolean
        }[]
      }
      mis_organizaciones: {
        Args: never
        Returns: {
          es_activa: boolean
          nombre: string
          org_id: string
          rol: string
        }[]
      }
      mis_roles_efectivos: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      next_diploma_folio: { Args: { p_org_id: string }; Returns: string }
      next_folio_code:
        | { Args: never; Returns: string }
        | { Args: { p_tipo: string }; Returns: string }
        | { Args: { p_org_id: string; p_tipo: string }; Returns: string }
      next_ticket_code: { Args: { p_org_id: string }; Returns: string }
      nombres_personas: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          nombre: string
        }[]
      }
      normalizar_email_auditor: { Args: { _e: string }; Returns: string }
      normalizar_txt: { Args: { _t: string }; Returns: string }
      nueva_version_kpi_reporte: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      org_documento_retencion: { Args: { p_id: string }; Returns: string }
      org_has_curso_access: { Args: { _org_id: string }; Returns: boolean }
      org_suplencia_aviso_resultado: {
        Args: { _enviado: boolean; _error?: string; _id: string }
        Returns: undefined
      }
      org_suplencias_acceso: {
        Args: { _escritura?: boolean; _org: string }
        Returns: boolean
      }
      org_suplencias_auditar_vencimientos: { Args: never; Returns: number }
      org_tiene_modulo: {
        Args: { _modulo: string; _org: string }
        Returns: boolean
      }
      pendientes_cerebro: { Args: never; Returns: Json }
      pendientes_color: {
        Args: {
          _dias: number
          _gn: number
          _gr: number
          _on: number
          _or: number
          _perfil: string
          _vencida: boolean
        }
        Returns: string
      }
      pendientes_configuracion: {
        Args: never
        Returns: {
          clave: string
          detalle: string
          hecho: boolean
          modulo: string
          obligatorio: boolean
          quien: string
          ruta: string
          titulo: string
        }[]
      }
      pendientes_riesgos: { Args: never; Returns: Json }
      pendientes_usuario: {
        Args: { _alcance?: string }
        Returns: {
          color: string
          dias: number
          fecha_limite: string
          modulo: string
          nace_en: string
          perfil: string
          registro: string
          ruta: string
          tipo: string
          titulo: string
        }[]
      }
      plan_limite: { Args: { p_clave: string; p_org: string }; Returns: Json }
      preparar_documento_archivo: {
        Args: { _nombre_archivo: string; _tipo: string }
        Returns: Json
      }
      preparar_emision_kpi_word: { Args: { _id: string }; Returns: Json }
      previsualizar_resultados_excel: { Args: { _celdas: Json }; Returns: Json }
      publicar_skill: {
        Args: { p_motivo: string; p_prompt_id: string }
        Returns: undefined
      }
      puede_administrar_usuarios: { Args: never; Returns: boolean }
      puede_editar_catalogo_documentos: { Args: never; Returns: boolean }
      puede_ver_auditoria: { Args: { _org: string }; Returns: boolean }
      purgar_documentos_eliminados: { Args: never; Returns: number }
      purgar_documentos_expirados: {
        Args: never
        Returns: {
          id: string
          storage_path: string
        }[]
      }
      quitar_documento_tipo: { Args: { p_id: string }; Returns: string }
      reclamar_emision_kpi_word: {
        Args: { _id: string; _token: string }
        Returns: boolean
      }
      reclasificar_documentos: { Args: never; Returns: Json }
      recompactar_riesgos: { Args: { p_folio_id: string }; Returns: Json }
      reeditar_codigos_folios: {
        Args: {
          p_actor: string
          p_cambios: Json
          p_motivo: string
          p_org_id: string
        }
        Returns: Json
      }
      registrar_cambio_contrasena: {
        Args: { _origen: string }
        Returns: undefined
      }
      registrar_documento_generado: {
        Args: { _nombre_archivo: string; _tipo: string }
        Returns: Json
      }
      registrar_kpi_evidencia: {
        Args: {
          _nombre: string
          _path: string
          _periodo_fin: string
          _periodo_inicio: string
        }
        Returns: string
      }
      reordenar_riesgos: {
        Args: { p_folio_id: string; p_orden: string[] }
        Returns: Json
      }
      responder_suplencia: {
        Args: { _aceptar: boolean; _id: string }
        Returns: undefined
      }
      restaurar_documento: { Args: { p_doc_id: string }; Returns: boolean }
      restaurar_documento_tipos: { Args: never; Returns: number }
      retirar_documento: {
        Args: { p_doc_id: string; p_motivo: string }
        Returns: undefined
      }
      revisar_kpi_reporte: {
        Args: { _aprobar: boolean; _comentario?: string; _id: string }
        Returns: undefined
      }
      revisar_kpi_resultado: {
        Args: { _id: string; _motivo?: string }
        Returns: undefined
      }
      rol_efectivo: {
        Args: {
          _rol: Database["public"]["Enums"]["app_role"]
          _usuario: string
        }
        Returns: boolean
      }
      same_org_member: { Args: { _user_id: string }; Returns: boolean }
      seed_documento_tipos: { Args: { _org_id: string }; Returns: number }
      seed_org_folio_tipos: {
        Args: { _norma: string; _org_id: string }
        Returns: undefined
      }
      set_org_activa: { Args: { _org: string }; Returns: undefined }
      suplencia_contexto: {
        Args: {
          _rol: Database["public"]["Enums"]["app_role"]
          _usuario: string
        }
        Returns: Json
      }
      suplencias_traslape: {
        Args: {
          _fin: string
          _inicio: string
          _rol: Database["public"]["Enums"]["app_role"]
        }
        Returns: number
      }
      tend_acceso: {
        Args: { _escritura?: boolean; _org: string; _roles?: string[] }
        Returns: boolean
      }
      tend_aviso_terminar: {
        Args: { _enviado: boolean; _error?: string; _id: string }
        Returns: undefined
      }
      tend_aviso_tomar: { Args: { _id: string }; Returns: boolean }
      tend_confirmar_extraccion: {
        Args: { _id: string; _motivo?: string; _semana: Json }
        Returns: string
      }
      tend_corregir_fecha_semana: {
        Args: { _id: string; _inicio: string; _motivo?: string }
        Returns: undefined
      }
      tend_editar_instrumento: {
        Args: { _cambios: Json; _id: string; _motivo: string }
        Returns: undefined
      }
      tend_exportar_crudo: {
        Args: { _desde: string; _hasta: string; _registro: string }
        Returns: Json
      }
      tend_extraccion_resultado: {
        Args: {
          _error?: string
          _id: string
          _input?: number
          _modelo: string
          _output?: number
          _propuesta: Json
          _skills: Json
        }
        Returns: undefined
      }
      tend_firmante_autorizante: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      tend_guardar_norma: {
        Args: { _id: string; _motivo: string; _valores: Json }
        Returns: undefined
      }
      tend_guardar_semana: {
        Args: { _motivo?: string; _registro: string; _semana: Json }
        Returns: string
      }
      tend_importar_atdiafra: {
        Args: {
          _autorizado_por: string
          _conteos: Json
          _motivo: string
          _org: string
          _paquete: Json
        }
        Returns: Json
      }
      tend_importar_catalogo_excel: {
        Args: { _motivo: string; _paquete: Json }
        Returns: Json
      }
      tend_media_trimestre: {
        Args: never
        Returns: {
          instrumento_id: string
          media: number
          n: number
        }[]
      }
      tend_resolver_instrumentos: {
        Args: { _instrumentos: Json; _org: string; _seleccion: Json }
        Returns: Json
      }
      tend_retirar: {
        Args: { _id: string; _motivo: string; _tipo: string }
        Returns: undefined
      }
      tend_retirar_registro_completo: {
        Args: { _confirmacion: string; _id: string; _motivo: string }
        Returns: number
      }
      tend_semana_en_emitido: {
        Args: { _org: string; _semana: string }
        Returns: boolean
      }
      tend_suplencia: {
        Args: { _facultad: string; _org: string }
        Returns: string
      }
      tend_usuarios_firmantes: {
        Args: never
        Returns: {
          cargo: string
          id: string
          nombre: string
          puede_autorizar: boolean
        }[]
      }
      tend_validar_elegibles: {
        Args: { _config: Json; _org: string }
        Returns: undefined
      }
      tend_validar_firmantes_at:
        | {
            Args: {
              _elegibles: Json
              _emitir?: boolean
              _firmantes: Json
              _org: string
            }
            Returns: Json
          }
        | {
            Args: {
              _autor: string
              _elegibles: Json
              _emitir: boolean
              _firmantes: Json
              _org: string
            }
            Returns: Json
          }
      terminar_suplencia: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      todos_firmaron: { Args: { p_folio_id: string }; Returns: boolean }
      validar_kpi: {
        Args: { _id: string; _motivo: string; _tabla: string }
        Returns: undefined
      }
      verificar_diploma: {
        Args: { p_hash: string }
        Returns: {
          alumno_nombre: string
          calificacion: number
          curso_norma: string
          curso_titulo: string
          fecha_emision: string
          folio: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "comite_tecnico"
        | "operador"
        | "lectura"
        | "responsable_sanitario"
        | "super_admin"
        | "aseguramiento_calidad"
      dictamen_tipo: "Aceptable" | "No Aceptable" | "Pendiente"
      estado_folio:
        | "Borrador"
        | "En Firma"
        | "Aprobado"
        | "Cerrado"
        | "Cancelado"
      org_estado: "pendiente" | "activo" | "suspendido" | "cancelado"
      origen_riesgo:
        | "Diseño"
        | "Proceso"
        | "Queja / Devolución"
        | "Desviación"
        | "Control de Cambios"
      ticket_categoria:
        | "Bug"
        | "Consulta"
        | "Solicitud de Mejora"
        | "Capacitación"
        | "Acceso"
        | "Otro"
      ticket_estado:
        | "Abierto"
        | "En Atención"
        | "Esperando Cliente"
        | "Resuelto"
        | "Cerrado"
      ticket_prioridad: "Baja" | "Normal" | "Alta" | "Crítica"
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
      app_role: [
        "admin",
        "comite_tecnico",
        "operador",
        "lectura",
        "responsable_sanitario",
        "super_admin",
        "aseguramiento_calidad",
      ],
      dictamen_tipo: ["Aceptable", "No Aceptable", "Pendiente"],
      estado_folio: [
        "Borrador",
        "En Firma",
        "Aprobado",
        "Cerrado",
        "Cancelado",
      ],
      org_estado: ["pendiente", "activo", "suspendido", "cancelado"],
      origen_riesgo: [
        "Diseño",
        "Proceso",
        "Queja / Devolución",
        "Desviación",
        "Control de Cambios",
      ],
      ticket_categoria: [
        "Bug",
        "Consulta",
        "Solicitud de Mejora",
        "Capacitación",
        "Acceso",
        "Otro",
      ],
      ticket_estado: [
        "Abierto",
        "En Atención",
        "Esperando Cliente",
        "Resuelto",
        "Cerrado",
      ],
      ticket_prioridad: ["Baja", "Normal", "Alta", "Crítica"],
    },
  },
} as const
