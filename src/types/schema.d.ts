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
            feed_item_favorites: {
                Row: {
                    created_at: string
                    feed_item_id: number
                    id: number
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    feed_item_id: number
                    id?: never
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    feed_item_id?: number
                    id?: never
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'fk_feed_item_favorites_item'
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
                    tag_id: number
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    feed_item_id: number
                    id?: never
                    tag_id: number
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    feed_item_id?: number
                    id?: never
                    tag_id?: number
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'fk_fitags_item'
                        columns: ['feed_item_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'feed_items'
                        referencedColumns: ['id', 'user_id']
                    },
                    {
                        foreignKeyName: 'fk_fitags_tag'
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
                    title: string
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
                    title: string
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
                    title?: string
                    updated_at?: string
                    user_id?: string
                    user_subscription_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: 'fk_feed_items_subscription'
                        columns: ['user_subscription_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'user_subscriptions'
                        referencedColumns: ['id', 'user_id']
                    },
                ]
            }
            tags: {
                Row: {
                    created_at: string
                    id: number
                    parent_tag_id: number | null
                    tag_name: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    id?: never
                    parent_tag_id?: number | null
                    tag_name: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    id?: never
                    parent_tag_id?: number | null
                    tag_name?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'fk_tags_parent'
                        columns: ['parent_tag_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'tags'
                        referencedColumns: ['id', 'user_id']
                    },
                    {
                        foreignKeyName: 'fk_tags_user'
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
                    refresh_every: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    refresh_every?: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    refresh_every?: string
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
                    tag_id: number
                    updated_at: string
                    user_id: string
                    user_subscription_id: number
                }
                Insert: {
                    created_at?: string
                    id?: never
                    tag_id: number
                    updated_at?: string
                    user_id: string
                    user_subscription_id: number
                }
                Update: {
                    created_at?: string
                    id?: never
                    tag_id?: number
                    updated_at?: string
                    user_id?: string
                    user_subscription_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: 'fk_ustags_subscription'
                        columns: ['user_subscription_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'user_subscriptions'
                        referencedColumns: ['id', 'user_id']
                    },
                    {
                        foreignKeyName: 'fk_ustags_tag'
                        columns: ['tag_id', 'user_id']
                        isOneToOne: false
                        referencedRelation: 'tags'
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
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'fk_user_subscriptions_user'
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
            [_ in never]: never
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
