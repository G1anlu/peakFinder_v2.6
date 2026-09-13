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
      gps_tracks: {
        Row: {
          altitude: number | null
          id: string
          is_downhill: boolean
          latitude: number
          longitude: number
          pvp_id: string | null
          recorded_at: string
          speed: number | null
          user_id: string | null
        }
        Insert: {
          altitude?: number | null
          id?: string
          is_downhill?: boolean
          latitude: number
          longitude: number
          pvp_id?: string | null
          recorded_at?: string
          speed?: number | null
          user_id?: string | null
        }
        Update: {
          altitude?: number | null
          id?: string
          is_downhill?: boolean
          latitude?: number
          longitude?: number
          pvp_id?: string | null
          recorded_at?: string
          speed?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_tracks_pvp_id_fkey"
            columns: ["pvp_id"]
            isOneToOne: false
            referencedRelation: "pvp_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_tracks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      lifts: {
        Row: {
          created_at: string
          id: number
          name: string | null
          resort_name: string | null
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: number
          name?: string | null
          resort_name?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          resort_name?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          coins: number
          created_at: string
          elo_rating: number
          email: string | null
          id: string
          onboarding_completed: boolean
          pvp_losses: number
          pvp_wins: number
          ski_level: string
          updated_at: string
          username: string | null
          visited_resorts: string[]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          elo_rating?: number
          email?: string | null
          id: string
          onboarding_completed?: boolean
          pvp_losses?: number
          pvp_wins?: number
          ski_level?: string
          updated_at?: string
          username?: string | null
          visited_resorts?: string[]
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          elo_rating?: number
          email?: string | null
          id?: string
          onboarding_completed?: boolean
          pvp_losses?: number
          pvp_wins?: number
          ski_level?: string
          updated_at?: string
          username?: string | null
          visited_resorts?: string[]
        }
        Relationships: []
      }
      pvp_duels: {
        Row: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          player_1_id?: string | null
          player_1_km?: number
          player_1_lifts?: number
          player_1_score?: number
          player_2_id?: string | null
          player_2_km?: number
          player_2_lifts?: number
          player_2_score?: number
          start_time?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          player_1_id?: string | null
          player_1_km?: number
          player_1_lifts?: number
          player_1_score?: number
          player_2_id?: string | null
          player_2_km?: number
          player_2_lifts?: number
          player_2_score?: number
          start_time?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pvp_duels_player_1_id_fkey"
            columns: ["player_1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_player_2_id_fkey"
            columns: ["player_2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_daily_lift_bonuses: {
        Row: {
          claimed_at: string
          coins_awarded: number
          date: string
          id: string
          lift_id: number
          lift_name: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          coins_awarded?: number
          date?: string
          id?: string
          lift_id: number
          lift_name?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          coins_awarded?: number
          date?: string
          id?: string
          lift_id?: number
          lift_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_lift_bonuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_coins: {
        Args: { _amount: number; _user_id: string }
        Returns: number
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      claim_lift_bonus: {
        Args: { _coins?: number; _lift_id: number; _lift_name?: string }
        Returns: {
          awarded: boolean
          coins: number
          lift_name: string
        }[]
      }
      delete_own_account: { Args: never; Returns: undefined }
      public_profile: {
        Args: { _id: string }
        Returns: {
          avatar_url: string
          bio: string
          elo_rating: number
          id: string
          is_friend: boolean
          ski_level: string
          username: string
          visited_resorts: string[]
        }[]
      }
      pvp_cancel_duel: {
        Args: { _duel_id: string }
        Returns: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_close_stale_duels: { Args: never; Returns: number }
      pvp_finalize: {
        Args: { _duel_id: string }
        Returns: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_finish_duel: {
        Args: { _duel_id: string }
        Returns: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_forfeit: {
        Args: { _duel_id: string }
        Returns: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_join_duel: {
        Args: never
        Returns: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_update_progress: {
        Args: { _duel_id: string; _km: number; _lifts: number; _score: number }
        Returns: {
          created_at: string
          date: string
          ended_at: string | null
          id: string
          player_1_id: string | null
          player_1_km: number
          player_1_lifts: number
          player_1_score: number
          player_2_id: string | null
          player_2_km: number
          player_2_lifts: number
          player_2_score: number
          start_time: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_duels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_friend: { Args: { friend_user_id: string }; Returns: undefined }
      search_users: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          elo_rating: number
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
