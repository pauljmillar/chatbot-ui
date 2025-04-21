import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"

interface AccountTable {
  id: string
  name: string
  created_at: string
  updated_at: string | null
}

interface ProfileTable {
  user_id: string
  system_role: string | null
  id: string
  display_name: string
  username: string
}

interface WorkspaceView {
  workspace: {
    id: string
    name: string
  }
}

export interface AdminAccountView extends Tables<"accounts"> {
  members: {
    user: ProfileTable
    role: string
  }[]
  workspaces: {
    workspace: {
      id: string
      name: string
    }
  }[]
}

export const isAdmin = async (userId: string): Promise<boolean> => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("system_role")
    .eq("user_id", userId)
    .single()

  if (error) throw new Error(error.message)
  return profile.system_role === "admin"
}

export const listAllAccounts = async (): Promise<AdminAccountView[]> => {
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("*")

  if (accountsError) throw new Error(accountsError.message)

  const enrichedAccounts = await Promise.all(
    accounts.map(async account => {
      const { data: members } = await supabase
        .from("account_members")
        .select(
          `
        role,
        user:profiles(
          id,
          user_id,
          system_role,
          display_name,
          username
        )
      `
        )
        .eq("account_id", account.id)

      const { data: workspaces } = await supabase
        .from("account_workspaces")
        .select("workspace:workspaces(id, name)")
        .eq("account_id", account.id)

      return {
        ...account,
        members: members || [],
        workspaces: workspaces || []
      }
    })
  )

  return enrichedAccounts as AdminAccountView[]
}

export const listAllWorkspaces = async () => {
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return workspaces
}

export const assignWorkspaceToAccount = async (
  accountId: string,
  workspaceId: string
): Promise<void> => {
  const { error } = await supabase.from("account_workspaces").insert([
    {
      account_id: accountId,
      workspace_id: workspaceId,
      granted_by: (await supabase.auth.getUser()).data.user?.id
    }
  ])

  if (error) throw new Error(error.message)
}

export const removeWorkspaceFromAccount = async (
  accountId: string,
  workspaceId: string
) => {
  const { error } = await supabase
    .from("account_workspaces")
    .delete()
    .match({ account_id: accountId, workspace_id: workspaceId })

  if (error) throw new Error(error.message)
  return true
}

export const getAccessRequests = async () => {
  const { data: requests, error } = await supabase
    .from("workspace_access_requests")
    .select(
      `
      *,
      requester:profiles!workspace_access_requests_requested_by_fkey(*),
      reviewer:profiles!workspace_access_requests_reviewed_by_fkey(*)
    `
    )
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return requests
}

export const createAccount = async (
  name: string
): Promise<Tables<"accounts">> => {
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert([{ name }])
    .select()
    .single()

  if (accountError) throw new Error(accountError.message)
  return account
}

interface UserProfile {
  id: string
  user_id: string
  display_name: string
  username: string
}

export const listAllUsers = async () => {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, username")
    .order("display_name")

  if (error) throw new Error(error.message)
  return users
}

export const addAccountMember = async (
  accountId: string,
  userId: string,
  role: "admin" | "member"
) => {
  const { error } = await supabase.from("account_members").insert([
    {
      account_id: accountId,
      user_id: userId,
      role
    }
  ])

  if (error) throw new Error(error.message)
}

export const removeAccountMember = async (
  accountId: string,
  userId: string
) => {
  const { error } = await supabase
    .from("account_members")
    .delete()
    .match({ account_id: accountId, user_id: userId })

  if (error) throw new Error(error.message)
  return true
}
