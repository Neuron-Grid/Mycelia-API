export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
    graphql_public: {
        Tables: {
            [_ in never]: never
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            graphql: {
                Args: {
                    operationName?: string
                    query?: string
                    variables?: Json
                    extensions?: Json
                }
                Returns: Json
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
    public: {
        Tables: {
            daily_summaries: {
                Row: {
                    created_at: string
                    id: number
                    markdown: string
                    script_text: string | null
                    script_tts_duration_sec: number | null
                    soft_deleted: boolean
                    summary_date: string
                    summary_emb: string | null
                    summary_title: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    id?: never
                    markdown: string
                    script_text?: string | null
                    script_tts_duration_sec?: number | null
                    soft_deleted?: boolean
                    summary_date: string
                    summary_emb?: string | null
                    summary_title: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    id?: never
                    markdown?: string
                    script_text?: string | null
                    script_tts_duration_sec?: number | null
                    soft_deleted?: boolean
                    summary_date?: string
                    summary_emb?: string | null
                    summary_title?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'daily_summaries_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            daily_summary_items: {
                Row: {
                    feed_item_id: number
                    summary_id: number
                }
                Insert: {
                    feed_item_id: number
                    summary_id: number
                }
                Update: {
                    feed_item_id?: number
                    summary_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: 'daily_summary_items_feed_item_id_fkey'
                        columns: ['feed_item_id']
                        isOneToOne: false
                        referencedRelation: 'feed_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'daily_summary_items_summary_id_fkey'
                        columns: ['summary_id']
                        isOneToOne: false
                        referencedRelation: 'daily_summaries'
                        referencedColumns: ['id']
                    },
                ]
            }
            feed_item_favorites: {
                Row: {
                    created_at: string
                    feed_item_id: number
                    id: number
                    soft_deleted: boolean
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    feed_item_id: number
                    id?: never
                    soft_deleted?: boolean
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    feed_item_id?: number
                    id?: never
                    soft_deleted?: boolean
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'feed_item_favorites_feed_item_id_user_id_fkey'
                        columns: ['feed_item_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'feed_items'
                        referencedColumns: ['id', 'user_id']
                    },
                ]
            }
            feed_item_tags: {
                Row: {
                    created_at: string
                    feed_item_id: number
                    id: number
                    soft_deleted: boolean
                    tag_id: number
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    feed_item_id: number
                    id?: never
                    soft_deleted?: boolean
                    tag_id: number
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    feed_item_id?: number
                    id?: never
                    soft_deleted?: boolean
                    tag_id?: number
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'feed_item_tags_feed_item_id_user_id_fkey'
                        columns: ['feed_item_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'feed_items'
                        referencedColumns: ['id', 'user_id']
                    },
                    {
                        foreignKeyName: 'feed_item_tags_tag_id_user_id_fkey'
                        columns: ['tag_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'tags'
                        referencedColumns: ['id', 'user_id']
                    },
                ]
            }
            feed_items: {
                Row: {
                    created_at: string
                    description: string | null
                    id: number
                    link: string
                    link_hash: string | null
                    published_at: string | null
                    soft_deleted: boolean
                    title: string
                    title_emb: string | null
                    updated_at: string
                    user_id: string
                    user_subscription_id: number
                }
                Insert: {
                    created_at?: string
                    description?: string | null
                    id?: never
                    link: string
                    link_hash?: string | null
                    published_at?: string | null
                    soft_deleted?: boolean
                    title: string
                    title_emb?: string | null
                    updated_at?: string
                    user_id: string
                    user_subscription_id: number
                }
                Update: {
                    created_at?: string
                    description?: string | null
                    id?: never
                    link?: string
                    link_hash?: string | null
                    published_at?: string | null
                    soft_deleted?: boolean
                    title?: string
                    title_emb?: string | null
                    updated_at?: string
                    user_id?: string
                    user_subscription_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: 'feed_items_user_subscription_id_user_id_fkey'
                        columns: ['user_subscription_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'user_subscriptions'
                        referencedColumns: ['id', 'user_id']
                    },
                ]
            }
            podcast_episodes: {
                Row: {
                    audio_url: string
                    created_at: string
                    id: number
                    soft_deleted: boolean
                    summary_id: number
                    title: string
                    title_emb: string | null
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    audio_url: string
                    created_at?: string
                    id?: never
                    soft_deleted?: boolean
                    summary_id: number
                    title: string
                    title_emb?: string | null
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    audio_url?: string
                    created_at?: string
                    id?: never
                    soft_deleted?: boolean
                    summary_id?: number
                    title?: string
                    title_emb?: string | null
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'podcast_episodes_summary_id_fkey'
                        columns: ['summary_id']
                        isOneToOne: true
                        referencedRelation: 'daily_summaries'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'podcast_episodes_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            tags: {
                Row: {
                    color: string | null
                    created_at: string
                    description: string | null
                    id: number
                    parent_tag_id: number | null
                    soft_deleted: boolean
                    tag_emb: string | null
                    tag_name: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    color?: string | null
                    created_at?: string
                    description?: string | null
                    id?: never
                    parent_tag_id?: number | null
                    soft_deleted?: boolean
                    tag_emb?: string | null
                    tag_name: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    color?: string | null
                    created_at?: string
                    description?: string | null
                    id?: never
                    parent_tag_id?: number | null
                    soft_deleted?: boolean
                    tag_emb?: string | null
                    tag_name?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'tags_parent_tag_id_user_id_fkey'
                        columns: ['parent_tag_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'tags'
                        referencedColumns: ['id', 'user_id']
                    },
                    {
                        foreignKeyName: 'tags_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            user_settings: {
                Row: {
                    created_at: string
                    podcast_enabled: boolean
                    podcast_language: string
                    podcast_schedule_time: string | null
                    refresh_every: unknown
                    soft_deleted: boolean
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    podcast_enabled?: boolean
                    podcast_language?: string
                    podcast_schedule_time?: string | null
                    refresh_every?: unknown
                    soft_deleted?: boolean
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    podcast_enabled?: boolean
                    podcast_language?: string
                    podcast_schedule_time?: string | null
                    refresh_every?: unknown
                    soft_deleted?: boolean
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'user_settings_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: true
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            user_subscription_tags: {
                Row: {
                    created_at: string
                    id: number
                    soft_deleted: boolean
                    tag_id: number
                    updated_at: string
                    user_id: string
                    user_subscription_id: number
                }
                Insert: {
                    created_at?: string
                    id?: never
                    soft_deleted?: boolean
                    tag_id: number
                    updated_at?: string
                    user_id: string
                    user_subscription_id: number
                }
                Update: {
                    created_at?: string
                    id?: never
                    soft_deleted?: boolean
                    tag_id?: number
                    updated_at?: string
                    user_id?: string
                    user_subscription_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: 'user_subscription_tags_tag_id_user_id_fkey'
                        columns: ['tag_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'tags'
                        referencedColumns: ['id', 'user_id']
                    },
                    {
                        foreignKeyName: 'user_subscription_tags_user_subscription_id_user_id_fkey'
                        columns: ['user_subscription_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'user_subscriptions'
                        referencedColumns: ['id', 'user_id']
                    },
                ]
            }
            user_subscriptions: {
                Row: {
                    created_at: string
                    feed_title: string | null
                    feed_url: string
                    id: number
                    last_fetched_at: string | null
                    next_fetch_at: string | null
                    soft_deleted: boolean
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    feed_title?: string | null
                    feed_url: string
                    id?: never
                    last_fetched_at?: string | null
                    next_fetch_at?: string | null
                    soft_deleted?: boolean
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    feed_title?: string | null
                    feed_url?: string
                    id?: never
                    last_fetched_at?: string | null
                    next_fetch_at?: string | null
                    soft_deleted?: boolean
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'user_subscriptions_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            users: {
                Row: {
                    created_at: string
                    email: string
                    id: string
                    updated_at: string
                    username: string
                }
                Insert: {
                    created_at?: string
                    email: string
                    id: string
                    updated_at?: string
                    username: string
                }
                Update: {
                    created_at?: string
                    email?: string
                    id?: string
                    updated_at?: string
                    username?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            binary_quantize: {
                Args: { '': string } | { '': unknown }
                Returns: unknown
            }
            get_tag_hierarchy: {
                Args: { target_user_id: string }
                Returns: {
                    id: number
                    tag_name: string
                    parent_tag_id: number
                    description: string
                    color: string
                    level: number
                    path: string
                    children_count: number
                    subscription_count: number
                    feed_item_count: number
                }[]
            }
            get_tag_statistics: {
                Args: Record<PropertyKey, never>
                Returns: {
                    total_tags: number
                    root_tags: number
                    total_subscriptions: number
                    total_feed_items: number
                }[]
            }
            halfvec_avg: {
                Args: { '': number[] }
                Returns: unknown
            }
            halfvec_out: {
                Args: { '': unknown }
                Returns: unknown
            }
            halfvec_send: {
                Args: { '': unknown }
                Returns: string
            }
            halfvec_typmod_in: {
                Args: { '': unknown[] }
                Returns: number
            }
            hnsw_bit_support: {
                Args: { '': unknown }
                Returns: unknown
            }
            hnsw_halfvec_support: {
                Args: { '': unknown }
                Returns: unknown
            }
            hnsw_sparsevec_support: {
                Args: { '': unknown }
                Returns: unknown
            }
            hnswhandler: {
                Args: { '': unknown }
                Returns: unknown
            }
            ivfflat_bit_support: {
                Args: { '': unknown }
                Returns: unknown
            }
            ivfflat_halfvec_support: {
                Args: { '': unknown }
                Returns: unknown
            }
            ivfflathandler: {
                Args: { '': unknown }
                Returns: unknown
            }
            l2_norm: {
                Args: { '': unknown } | { '': unknown }
                Returns: number
            }
            l2_normalize: {
                Args: { '': string } | { '': unknown } | { '': unknown }
                Returns: unknown
            }
            search_all_content_by_vector: {
                Args: {
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                    target_user_id: string
                }
                Returns: {
                    content_type: string
                    id: number
                    title: string
                    content: string
                    similarity: number
                    metadata: Json
                }[]
            }
            search_feed_items_by_vector: {
                Args: {
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                    target_user_id: string
                }
                Returns: {
                    id: number
                    title: string
                    description: string
                    link: string
                    published_at: string
                    feed_title: string
                    similarity: number
                }[]
            }
            search_podcast_episodes_by_vector: {
                Args: {
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                    target_user_id: string
                }
                Returns: {
                    id: number
                    title: string
                    audio_url: string
                    summary_id: number
                    created_at: string
                    similarity: number
                }[]
            }
            search_summaries_by_vector: {
                Args: {
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                    target_user_id: string
                }
                Returns: {
                    id: number
                    summary_title: string
                    markdown: string
                    summary_date: string
                    script_text: string
                    similarity: number
                }[]
            }
            search_tags_by_vector: {
                Args: {
                    query_embedding: string
                    match_threshold: number
                    match_count: number
                    target_user_id: string
                }
                Returns: {
                    id: number
                    tag_name: string
                    parent_tag_id: number
                    similarity: number
                }[]
            }
            sparsevec_out: {
                Args: { '': unknown }
                Returns: unknown
            }
            sparsevec_send: {
                Args: { '': unknown }
                Returns: string
            }
            sparsevec_typmod_in: {
                Args: { '': unknown[] }
                Returns: number
            }
            vector_avg: {
                Args: { '': number[] }
                Returns: string
            }
            vector_dims: {
                Args: { '': string } | { '': unknown }
                Returns: number
            }
            vector_norm: {
                Args: { '': string }
                Returns: number
            }
            vector_out: {
                Args: { '': string }
                Returns: unknown
            }
            vector_send: {
                Args: { '': string }
                Returns: string
            }
            vector_typmod_in: {
                Args: { '': unknown[] }
                Returns: number
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
          ? R
          : never
      : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I
        }
          ? I
          : never
      : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U
        }
          ? U
          : never
      : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {},
    },
} as const
