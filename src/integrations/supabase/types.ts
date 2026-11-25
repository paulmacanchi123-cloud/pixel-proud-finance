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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          amount: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          details: string
          id: string
          operation: string
          requester_email: string | null
          requester_id: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          details?: string
          id?: string
          operation: string
          requester_email?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          details?: string
          id?: string
          operation?: string
          requester_email?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      department_permissions: {
        Row: {
          department_id: string
          permission: Database["public"]["Enums"]["iris_permission"]
        }
        Insert: {
          department_id: string
          permission: Database["public"]["Enums"]["iris_permission"]
        }
        Update: {
          department_id?: string
          permission?: Database["public"]["Enums"]["iris_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "department_permissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string
          head_user_id: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          head_user_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          head_user_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_state: {
        Row: {
          data: Json
          id: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data?: Json
          id?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      org_authz_config: {
        Row: {
          enforcement_unlocked: boolean
          id: number
          mode: string
          require_mfa_admin: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enforcement_unlocked?: boolean
          id?: number
          mode?: string
          require_mfa_admin?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enforcement_unlocked?: boolean
          id?: number
          mode?: string
          require_mfa_admin?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      org_change_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          reason: string | null
          result: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          result?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          result?: string
        }
        Relationships: []
      }
      org_legacy_map: {
        Row: {
          action: Database["public"]["Enums"]["org_action"] | null
          legacy_perm: Database["public"]["Enums"]["iris_permission"]
          note: string
          resource: string | null
          status: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["org_action"] | null
          legacy_perm: Database["public"]["Enums"]["iris_permission"]
          note?: string
          resource?: string | null
          status: string
        }
        Update: {
          action?: Database["public"]["Enums"]["org_action"] | null
          legacy_perm?: Database["public"]["Enums"]["iris_permission"]
          note?: string
          resource?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_legacy_map_resource_fkey"
            columns: ["resource"]
            isOneToOne: false
            referencedRelation: "org_resources"
            referencedColumns: ["code"]
          },
        ]
      }
      org_operation_steps: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          policy_code: string
          record_ref: string
          step: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          policy_code: string
          record_ref: string
          step: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          policy_code?: string
          record_ref?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_operation_steps_policy_code_fkey"
            columns: ["policy_code"]
            isOneToOne: false
            referencedRelation: "org_sod_policies"
            referencedColumns: ["code"]
          },
        ]
      }
      org_permissions: {
        Row: {
          action: Database["public"]["Enums"]["org_action"]
          id: string
          is_sensitive: boolean
          resource: string
          scope: Database["public"]["Enums"]["org_scope"]
        }
        Insert: {
          action: Database["public"]["Enums"]["org_action"]
          id?: string
          is_sensitive?: boolean
          resource: string
          scope: Database["public"]["Enums"]["org_scope"]
        }
        Update: {
          action?: Database["public"]["Enums"]["org_action"]
          id?: string
          is_sensitive?: boolean
          resource?: string
          scope?: Database["public"]["Enums"]["org_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "org_permissions_resource_fkey"
            columns: ["resource"]
            isOneToOne: false
            referencedRelation: "org_resources"
            referencedColumns: ["code"]
          },
        ]
      }
      org_position_roles: {
        Row: {
          position_id: string
          role_id: string
        }
        Insert: {
          position_id: string
          role_id: string
        }
        Update: {
          position_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_position_roles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "org_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_position_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_positions: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          description: string
          id: string
          is_active: boolean
          is_external: boolean
          name: string
          reports_to_id: string | null
          responsibilities: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          description?: string
          id?: string
          is_active?: boolean
          is_external?: boolean
          name: string
          reports_to_id?: string | null
          responsibilities?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          description?: string
          id?: string
          is_active?: boolean
          is_external?: boolean
          name?: string
          reports_to_id?: string | null
          responsibilities?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_positions_reports_to_id_fkey"
            columns: ["reports_to_id"]
            isOneToOne: false
            referencedRelation: "org_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_resources: {
        Row: {
          allowed_actions: Database["public"]["Enums"]["org_action"][]
          allowed_scopes: Database["public"]["Enums"]["org_scope"][]
          code: string
          description: string
          name: string
          sort_order: number
        }
        Insert: {
          allowed_actions: Database["public"]["Enums"]["org_action"][]
          allowed_scopes: Database["public"]["Enums"]["org_scope"][]
          code: string
          description?: string
          name: string
          sort_order?: number
        }
        Update: {
          allowed_actions?: Database["public"]["Enums"]["org_action"][]
          allowed_scopes?: Database["public"]["Enums"]["org_scope"][]
          code?: string
          description?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      org_role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_id: string
          require_mfa: boolean
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_id: string
          require_mfa?: boolean
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_id?: string
          require_mfa?: boolean
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "org_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_roles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          is_privileged: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          is_privileged?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          is_privileged?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_shadow_decisions: {
        Row: {
          first_seen: string
          hits: number
          last_seen: string
          legacy_result: boolean
          org_result: boolean
          perm: Database["public"]["Enums"]["iris_permission"]
          user_id: string
        }
        Insert: {
          first_seen?: string
          hits?: number
          last_seen?: string
          legacy_result: boolean
          org_result: boolean
          perm: Database["public"]["Enums"]["iris_permission"]
          user_id: string
        }
        Update: {
          first_seen?: string
          hits?: number
          last_seen?: string
          legacy_result?: boolean
          org_result?: boolean
          perm?: Database["public"]["Enums"]["iris_permission"]
          user_id?: string
        }
        Relationships: []
      }
      org_sod_exceptions: {
        Row: {
          approved_by: string
          created_at: string
          expires_at: string
          id: string
          justification: string
          kind: string
          policy_code: string | null
          record_ref: string | null
          revoked_at: string | null
          revoked_by: string | null
          rule_id: string | null
          starts_at: string
          user_id: string
        }
        Insert: {
          approved_by: string
          created_at?: string
          expires_at: string
          id?: string
          justification: string
          kind: string
          policy_code?: string | null
          record_ref?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          rule_id?: string | null
          starts_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string
          created_at?: string
          expires_at?: string
          id?: string
          justification?: string
          kind?: string
          policy_code?: string | null
          record_ref?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          rule_id?: string | null
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_sod_exceptions_policy_code_fkey"
            columns: ["policy_code"]
            isOneToOne: false
            referencedRelation: "org_sod_policies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_sod_exceptions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "org_sod_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sod_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_sod_policies: {
        Row: {
          amount_threshold: number | null
          code: string
          description: string
          enforced: boolean
          name: string
          steps: Json
        }
        Insert: {
          amount_threshold?: number | null
          code: string
          description?: string
          enforced?: boolean
          name: string
          steps: Json
        }
        Update: {
          amount_threshold?: number | null
          code?: string
          description?: string
          enforced?: boolean
          name?: string
          steps?: Json
        }
        Relationships: []
      }
      org_sod_rules: {
        Row: {
          description: string
          id: string
          is_active: boolean
          role_a_id: string
          role_b_id: string
          severity: string
        }
        Insert: {
          description: string
          id?: string
          is_active?: boolean
          role_a_id: string
          role_b_id: string
          severity?: string
        }
        Update: {
          description?: string
          id?: string
          is_active?: boolean
          role_a_id?: string
          role_b_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_sod_rules_role_a_id_fkey"
            columns: ["role_a_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sod_rules_role_b_id_fkey"
            columns: ["role_b_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_user_denies: {
        Row: {
          created_at: string
          created_by: string
          permission_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          permission_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          permission_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_user_denies_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "org_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_user_denies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_user_positions: {
        Row: {
          assigned_by: string
          created_at: string
          department_id: string | null
          end_reason: string | null
          ended_at: string | null
          ends_at: string | null
          id: string
          is_primary: boolean
          position_id: string
          starts_at: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          department_id?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          is_primary?: boolean
          position_id: string
          starts_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          department_id?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          is_primary?: boolean
          position_id?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_user_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_user_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "org_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_user_positions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_user_roles: {
        Row: {
          created_at: string
          department_id: string | null
          department_is_explicit: boolean
          granted_by: string
          id: string
          justification: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          department_is_explicit?: boolean
          granted_by: string
          id?: string
          justification: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          department_is_explicit?: boolean
          granted_by?: string
          id?: string
          justification?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email: string
          full_name?: string
          id: string
          must_change_password?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          granted: boolean
          permission: Database["public"]["Enums"]["iris_permission"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          granted: boolean
          permission: Database["public"]["Enums"]["iris_permission"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          granted?: boolean
          permission?: Database["public"]["Enums"]["iris_permission"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["iris_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission_legacy: {
        Args: {
          _perm: Database["public"]["Enums"]["iris_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ceo: { Args: { _user_id: string }; Returns: boolean }
      mark_password_changed: { Args: never; Returns: undefined }
      my_permissions: {
        Args: never
        Returns: Database["public"]["Enums"]["iris_permission"][]
      }
      org_actor: { Args: never; Returns: string }
      org_assert_admin: { Args: { _resource: string }; Returns: string }
      org_assign_position: {
        Args: {
          _department: string
          _ends_at: string
          _is_primary: boolean
          _position: string
          _reason: string
          _user: string
        }
        Returns: string
      }
      org_assign_role: {
        Args: {
          _department: string
          _justification: string
          _role: string
          _user: string
          _valid_until: string
        }
        Returns: string
      }
      org_audit_insert: {
        Args: { _action: string; _details: Json; _target: string }
        Returns: undefined
      }
      org_authz_diff: {
        Args: never
        Returns: {
          department_code: string
          email: string
          legacy_result: boolean
          legacy_source: string
          map_status: string
          mapped_to: string
          org_result: boolean
          perm: Database["public"]["Enums"]["iris_permission"]
          user_id: string
        }[]
      }
      org_can_audit: { Args: never; Returns: boolean }
      org_can_read_catalog: { Args: never; Returns: boolean }
      org_can_see_user: {
        Args: { _global_only?: boolean; _resource: string; _target: string }
        Returns: boolean
      }
      org_check: {
        Args: {
          _action: Database["public"]["Enums"]["org_action"]
          _any_scope?: boolean
          _dept?: string
          _owner?: string
          _resource: string
          _user: string
        }
        Returns: boolean
      }
      org_check_me: {
        Args: {
          _action: Database["public"]["Enums"]["org_action"]
          _dept?: string
          _owner?: string
          _resource: string
        }
        Returns: boolean
      }
      org_create_sod_exception: {
        Args: {
          _days: number
          _justification: string
          _kind: string
          _policy: string
          _record: string
          _rule: string
          _user: string
        }
        Returns: string
      }
      org_effective_permissions: {
        Args: { _user: string }
        Returns: {
          action: Database["public"]["Enums"]["org_action"]
          assignment_id: string
          department_id: string
          require_mfa: boolean
          resource: string
          role_code: string
          role_id: string
          role_name: string
          scope: Database["public"]["Enums"]["org_scope"]
        }[]
      }
      org_end_position: {
        Args: { _assignment: string; _reason: string }
        Returns: undefined
      }
      org_get_authz_config: {
        Args: never
        Returns: {
          enforcement_unlocked: boolean
          mode: string
          require_mfa_admin: boolean
          updated_at: string
        }[]
      }
      org_is_active_user: { Args: { _uid: string }; Returns: boolean }
      org_list_users: {
        Args: never
        Returns: {
          department_id: string
          email: string
          full_name: string
          id: string
          is_ceo: boolean
          status: Database["public"]["Enums"]["account_status"]
        }[]
      }
      org_log: {
        Args: {
          _action: string
          _after: Json
          _before: Json
          _entity: string
          _entity_id: string
          _reason: string
        }
        Returns: undefined
      }
      org_log_denied: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _error: string
        }
        Returns: undefined
      }
      org_me_can_see_department: { Args: { _dept: string }; Returns: boolean }
      org_me_can_see_department_perms: {
        Args: { _dept: string }
        Returns: boolean
      }
      org_me_has_permission: {
        Args: { _perm: Database["public"]["Enums"]["iris_permission"] }
        Returns: boolean
      }
      org_me_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      org_me_is_ceo: { Args: never; Returns: boolean }
      org_migration_plan: {
        Args: never
        Returns: {
          department_code: string
          email: string
          granted: boolean
          legacy_perm: Database["public"]["Enums"]["iris_permission"]
          map_status: string
          note: string
          org_action: string
          org_resource: string
          proposed_role: string
          source: string
          user_id: string
        }[]
      }
      org_my_permissions: {
        Args: never
        Returns: {
          action: Database["public"]["Enums"]["org_action"]
          department_id: string
          require_mfa: boolean
          resource: string
          scope: Database["public"]["Enums"]["org_scope"]
        }[]
      }
      org_need_reason: { Args: { _reason: string }; Returns: undefined }
      org_permission_mapped: {
        Args: {
          _perm: Database["public"]["Enums"]["iris_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      org_revoke_role: {
        Args: { _assignment: string; _reason: string }
        Returns: undefined
      }
      org_revoke_sod_exception: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      org_role_is_privileged: { Args: { _role: string }; Returns: boolean }
      org_set_authz_mode: {
        Args: { _mode: string; _reason: string }
        Returns: undefined
      }
      org_set_department_active: {
        Args: { _active: boolean; _id: string; _reason: string }
        Returns: undefined
      }
      org_set_department_head: {
        Args: { _dept: string; _reason: string; _user: string }
        Returns: undefined
      }
      org_set_position_active: {
        Args: { _active: boolean; _id: string; _reason: string }
        Returns: undefined
      }
      org_set_position_roles: {
        Args: { _position: string; _role_ids: string[] }
        Returns: undefined
      }
      org_set_require_mfa_admin: {
        Args: { _on: boolean; _reason: string }
        Returns: undefined
      }
      org_set_role_active: {
        Args: { _active: boolean; _id: string; _reason: string }
        Returns: undefined
      }
      org_set_role_permission: {
        Args: {
          _enabled: boolean
          _permission: string
          _require_mfa: boolean
          _role: string
        }
        Returns: undefined
      }
      org_set_user_deny: {
        Args: {
          _deny: boolean
          _permission: string
          _reason: string
          _user: string
        }
        Returns: undefined
      }
      org_set_user_department: {
        Args: { _department: string; _reason: string; _user: string }
        Returns: undefined
      }
      org_shadow_report: {
        Args: never
        Returns: {
          email: string
          first_seen: string
          hits: number
          last_seen: string
          legacy_result: boolean
          org_result: boolean
          perm: Database["public"]["Enums"]["iris_permission"]
          user_id: string
        }[]
      }
      org_sod_conflicts_if: {
        Args: { _also?: string[]; _new: string[]; _user: string }
        Returns: {
          description: string
          rule_id: string
          severity: string
        }[]
      }
      org_unresolved_conflicts: {
        Args: { _user: string }
        Returns: {
          description: string
          role_a_id: string
          role_b_id: string
          rule_id: string
          severity: string
        }[]
      }
      org_upsert_department: {
        Args: {
          _code: string
          _description: string
          _id: string
          _name: string
          _parent_id: string
          _sort: number
        }
        Returns: string
      }
      org_upsert_position: {
        Args: {
          _code: string
          _department_id: string
          _description: string
          _id: string
          _is_external: boolean
          _name: string
          _reports_to_id: string
          _responsibilities: string[]
          _sort: number
        }
        Returns: string
      }
      org_upsert_role: {
        Args: {
          _code: string
          _description: string
          _id: string
          _is_privileged: boolean
          _name: string
        }
        Returns: string
      }
      org_user_conflicts: {
        Args: { _user: string }
        Returns: {
          description: string
          role_a_id: string
          role_b_id: string
          rule_id: string
          severity: string
        }[]
      }
      org_user_dept: { Args: { _uid: string }; Returns: string }
      org_user_effective_permissions: {
        Args: { _user: string }
        Returns: {
          action: Database["public"]["Enums"]["org_action"]
          assignment_id: string
          department_id: string
          require_mfa: boolean
          resource: string
          role_code: string
          role_name: string
          scope: Database["public"]["Enums"]["org_scope"]
          source: string
        }[]
      }
      org_valid_assignments: {
        Args: { _user: string }
        Returns: {
          department_id: string
          id: string
          role_id: string
        }[]
      }
      write_audit: {
        Args: { _action: string; _details: Json; _target: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "disabled"
      app_role: "ceo"
      approval_status: "pending" | "approved" | "rejected"
      iris_permission:
        | "view"
        | "create"
        | "edit"
        | "delete"
        | "export"
        | "manage_accounts"
        | "view_patrimony"
        | "manage_investments"
        | "approve_operations"
        | "manage_users"
        | "view_audit"
      org_action:
        | "consultar"
        | "crear"
        | "editar"
        | "eliminar"
        | "aprobar"
        | "exportar"
        | "administrar"
        | "auditar"
      org_scope: "global" | "departamento" | "propio"
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
      account_status: ["active", "suspended", "disabled"],
      app_role: ["ceo"],
      approval_status: ["pending", "approved", "rejected"],
      iris_permission: [
        "view",
        "create",
        "edit",
        "delete",
        "export",
        "manage_accounts",
        "view_patrimony",
        "manage_investments",
        "approve_operations",
        "manage_users",
        "view_audit",
      ],
      org_action: [
        "consultar",
        "crear",
        "editar",
        "eliminar",
        "aprobar",
        "exportar",
        "administrar",
        "auditar",
      ],
      org_scope: ["global", "departamento", "propio"],
    },
  },
} as const
