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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      gait_tests: {
        Row: {
          asymmetry_score: number | null
          average_left_weight: number | null
          average_right_weight: number | null
          created_at: string | null
          diagnoses: Json | null
          id: string
          lateral_stability_score: number | null
          left_knee_rom: number | null
          overall_status: string | null
          recommended_exercises: Json | null
          right_knee_rom: number | null
          sensor_data: Json | null
          step_count: number | null
          test_date: string | null
          test_duration: number | null
          user_id: string
          weight_distribution_score: number | null
        }
        Insert: {
          asymmetry_score?: number | null
          average_left_weight?: number | null
          average_right_weight?: number | null
          created_at?: string | null
          diagnoses?: Json | null
          id?: string
          lateral_stability_score?: number | null
          left_knee_rom?: number | null
          overall_status?: string | null
          recommended_exercises?: Json | null
          right_knee_rom?: number | null
          sensor_data?: Json | null
          step_count?: number | null
          test_date?: string | null
          test_duration?: number | null
          user_id: string
          weight_distribution_score?: number | null
        }
        Update: {
          asymmetry_score?: number | null
          average_left_weight?: number | null
          average_right_weight?: number | null
          created_at?: string | null
          diagnoses?: Json | null
          id?: string
          lateral_stability_score?: number | null
          left_knee_rom?: number | null
          overall_status?: string | null
          recommended_exercises?: Json | null
          right_knee_rom?: number | null
          sensor_data?: Json | null
          step_count?: number | null
          test_date?: string | null
          test_duration?: number | null
          user_id?: string
          weight_distribution_score?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      weekly_checkins: {
        Row: {
          checkin_date: string
          created_at: string | null
          daily_activity_score: number | null
          gait_test_id: string | null
          id: string
          next_checkin_date: string
          pain_score: number | null
          recommended_exercise_id: string | null
          stair_difficulty: number | null
          stiffness_score: number | null
          user_id: string
          walking_difficulty: number | null
        }
        Insert: {
          checkin_date?: string
          created_at?: string | null
          daily_activity_score?: number | null
          gait_test_id?: string | null
          id?: string
          next_checkin_date: string
          pain_score?: number | null
          recommended_exercise_id?: string | null
          stair_difficulty?: number | null
          stiffness_score?: number | null
          user_id: string
          walking_difficulty?: number | null
        }
        Update: {
          checkin_date?: string
          created_at?: string | null
          daily_activity_score?: number | null
          gait_test_id?: string | null
          id?: string
          next_checkin_date?: string
          pain_score?: number | null
          recommended_exercise_id?: string | null
          stair_difficulty?: number | null
          stiffness_score?: number | null
          user_id?: string
          walking_difficulty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkins_gait_test_id_fkey"
            columns: ["gait_test_id"]
            isOneToOne: false
            referencedRelation: "gait_tests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_checkin: { Args: { _user_id: string }; Returns: boolean }
      days_until_checkin: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
