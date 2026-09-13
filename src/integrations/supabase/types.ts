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
      favorites: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          region: string | null
          resort_name: string
          resort_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          region?: string | null
          resort_name: string
          resort_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          region?: string | null
          resort_name?: string
          resort_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Relationships: []
      }
      hotel_search_cache: {
        Row: {
          checkin_date: string
          checkout_date: string
          created_at: string
          guests: number
          id: string
          location_query: string
          response_data: Json
        }
        Insert: {
          checkin_date: string
          checkout_date: string
          created_at?: string
          guests?: number
          id?: string
          location_query: string
          response_data: Json
        }
        Update: {
          checkin_date?: string
          checkout_date?: string
          created_at?: string
          guests?: number
          id?: string
          location_query?: string
          response_data?: Json
        }
        Relationships: []
      }
      itineraries: {
        Row: {
          cost_breakdown: Json | null
          created_at: string
          efficiency_score: number | null
          end_date: string
          hotel_address: string | null
          hotel_name: string
          hotel_place_id: string
          hotel_provider: string
          hotel_rating: number | null
          id: string
          rental_address: string | null
          rental_name: string
          rental_place_id: string
          rental_provider: string
          rental_rating: number | null
          resort_lat: number
          resort_lng: number
          resort_name: string
          resort_slug: string
          start_date: string
          total_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_breakdown?: Json | null
          created_at?: string
          efficiency_score?: number | null
          end_date: string
          hotel_address?: string | null
          hotel_name: string
          hotel_place_id: string
          hotel_provider: string
          hotel_rating?: number | null
          id?: string
          rental_address?: string | null
          rental_name: string
          rental_place_id: string
          rental_provider: string
          rental_rating?: number | null
          resort_lat: number
          resort_lng: number
          resort_name: string
          resort_slug: string
          start_date: string
          total_days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_breakdown?: Json | null
          created_at?: string
          efficiency_score?: number | null
          end_date?: string
          hotel_address?: string | null
          hotel_name?: string
          hotel_place_id?: string
          hotel_provider?: string
          hotel_rating?: number | null
          id?: string
          rental_address?: string | null
          rental_name?: string
          rental_place_id?: string
          rental_provider?: string
          rental_rating?: number | null
          resort_lat?: number
          resort_lng?: number
          resort_name?: string
          resort_slug?: string
          start_date?: string
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          id: string
          onboarding_completed: boolean
          ski_level: string
          updated_at: string
          username: string | null
          visited_resorts: string[]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id: string
          onboarding_completed?: boolean
          ski_level?: string
          updated_at?: string
          username?: string | null
          visited_resorts?: string[]
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          onboarding_completed?: boolean
          ski_level?: string
          updated_at?: string
          username?: string | null
          visited_resorts?: string[]
        }
        Relationships: []
      }
      resort_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          lat: number
          lng: number
          payload: Json
          provider: string
          radius_m: number
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          kind: string
          lat: number
          lng: number
          payload: Json
          provider: string
          radius_m: number
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          lat?: number
          lng?: number
          payload?: Json
          provider?: string
          radius_m?: number
        }
        Relationships: []
      }
      ski_rentals: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          places: Json
          radius_m: number
          resort_key: string
          resort_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          places: Json
          radius_m?: number
          resort_key: string
          resort_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          places?: Json
          radius_m?: number
          resort_key?: string
          resort_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      delete_own_account: { Args: never; Returns: undefined }
      public_profile: {
        Args: { _id: string }
        Returns: {
          avatar_url: string
          bio: string
          id: string
          is_friend: boolean
          ski_level: string
          username: string
          visited_resorts: string[]
        }[]
      }
      remove_friend: { Args: { friend_user_id: string }; Returns: undefined }
      search_users: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          id: string
          username: string
        }[]
      }
    }
    Enums: {
      friend_status: "pending" | "accepted" | "declined"
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
      friend_status: ["pending", "accepted", "declined"],
    },
  },
} as const
