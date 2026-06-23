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
          created_at: string
          id: string
          nombre: string
          system_prompt: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          system_prompt: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          accion: string
          created_at: string
          id: string
          ip: string | null
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          registro_id?: string
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
          conversacion_id: string | null
          created_at: string
          documentos_adjuntos: Json | null
          folio_id: string | null
          id: string
          org_id: string
          role: string
          tokens_usados: number | null
          user_id: string | null
        }
        Insert: {
          agente?: string | null
          contenido?: string
          conversacion_id?: string | null
          created_at?: string
          documentos_adjuntos?: Json | null
          folio_id?: string | null
          id?: string
          org_id: string
          role: string
          tokens_usados?: number | null
          user_id?: string | null
        }
        Update: {
          agente?: string | null
          contenido?: string
          conversacion_id?: string | null
          created_at?: string
          documentos_adjuntos?: Json | null
          folio_id?: string | null
          id?: string
          org_id?: string
          role?: string
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
          norma?: string
          orden?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      diploma_sequence: {
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
          tipo: string
          year: number
        }
        Insert: {
          last_number?: number
          org_id: string
          tipo?: string
          year: number
        }
        Update: {
          last_number?: number
          org_id?: string
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
      org_documentos: {
        Row: {
          creado_por: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          es_version_actual: boolean
          id: string
          mime_type: string | null
          nombre: string
          org_id: string
          parent_doc_id: string | null
          sha256: string | null
          size_bytes: number | null
          storage_path: string
          tipo: string
          updated_at: string
          usar_en_ia: boolean
          version: string
          version_num: number
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          es_version_actual?: boolean
          id?: string
          mime_type?: string | null
          nombre: string
          org_id: string
          parent_doc_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path: string
          tipo: string
          updated_at?: string
          usar_en_ia?: boolean
          version?: string
          version_num?: number
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          es_version_actual?: boolean
          id?: string
          mime_type?: string | null
          nombre?: string
          org_id?: string
          parent_doc_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string
          tipo?: string
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
      organizations: {
        Row: {
          activo: boolean
          alerta_80_enviada: boolean
          cancelled_at: string | null
          codigo_formato: string
          consultas_ia_extras: number
          created_at: string
          curso_aviso_5d_enviado_at: string | null
          curso_expira_en: string | null
          dc3_adicionales_disponibles: number
          dc3_emitidos: number
          descripcion: string
          estado: Database["public"]["Enums"]["org_estado"]
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
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          terminos_aceptados_en: string | null
          terminos_version: string | null
          tiene_curso_pagado: boolean
          trial_expires_at: string | null
          umbral_npr_alto: number
          umbral_npr_medio: number
          updated_at: string
          usar_detectabilidad: boolean
          version_formato: string
        }
        Insert: {
          activo?: boolean
          alerta_80_enviada?: boolean
          cancelled_at?: string | null
          codigo_formato?: string
          consultas_ia_extras?: number
          created_at?: string
          curso_aviso_5d_enviado_at?: string | null
          curso_expira_en?: string | null
          dc3_adicionales_disponibles?: number
          dc3_emitidos?: number
          descripcion?: string
          estado?: Database["public"]["Enums"]["org_estado"]
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
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          terminos_aceptados_en?: string | null
          terminos_version?: string | null
          tiene_curso_pagado?: boolean
          trial_expires_at?: string | null
          umbral_npr_alto?: number
          umbral_npr_medio?: number
          updated_at?: string
          usar_detectabilidad?: boolean
          version_formato?: string
        }
        Update: {
          activo?: boolean
          alerta_80_enviada?: boolean
          cancelled_at?: string | null
          codigo_formato?: string
          consultas_ia_extras?: number
          created_at?: string
          curso_aviso_5d_enviado_at?: string | null
          curso_expira_en?: string | null
          dc3_adicionales_disponibles?: number
          dc3_emitidos?: number
          descripcion?: string
          estado?: Database["public"]["Enums"]["org_estado"]
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
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          terminos_aceptados_en?: string | null
          terminos_version?: string | null
          tiene_curso_pagado?: boolean
          trial_expires_at?: string | null
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
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string
          firma_url: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email: string
          firma_url?: string | null
          id: string
          nombre: string
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string
          firma_url?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archivar_version_folio: {
        Args: { p_folio_id: string; p_motivo?: string }
        Returns: string
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
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "folios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cumplimiento_curso:
        | {
            Args: { p_curso_id: string }
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
        | {
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      eliminar_documento_permanente: {
        Args: { p_doc_id: string }
        Returns: string
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      examen_validar_banco: { Args: { p_curso_id: string }; Returns: Json }
      get_user_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_diploma_folio: { Args: never; Returns: string }
      next_folio_code:
        | { Args: never; Returns: string }
        | { Args: { p_tipo: string }; Returns: string }
      next_ticket_code: { Args: { p_org_id: string }; Returns: string }
      purgar_documentos_eliminados: { Args: never; Returns: number }
      purgar_documentos_expirados: {
        Args: never
        Returns: {
          id: string
          storage_path: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      restaurar_documento: { Args: { p_doc_id: string }; Returns: boolean }
      todos_firmaron: { Args: { p_folio_id: string }; Returns: boolean }
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
      app_role: [
        "admin",
        "comite_tecnico",
        "operador",
        "lectura",
        "responsable_sanitario",
        "super_admin",
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
