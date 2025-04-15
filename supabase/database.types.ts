accounts: {
  Row: {
    id: string
    created_at: string
    updated_at: string | null
  }
  Insert: {
    id?: string
    created_at?: string
    updated_at?: string | null
  }
  Update: {
    id?: string
    created_at?: string
    updated_at?: string | null
  }
}
account_members: {
  Row: {
    account_id: string
    user_id: string
    role: string
    created_at: string
    updated_at: string | null
  }
  Insert: {
    account_id: string
    user_id: string
    role: string
    created_at?: string
    updated_at?: string | null
  }
  Update: {
    account_id?: string
    user_id?: string
    role?: string
    created_at?: string
    updated_at?: string | null
  }
}
