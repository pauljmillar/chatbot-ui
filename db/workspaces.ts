import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"

export const getHomeWorkspaceByUserId = async (userId: string) => {
  const { data: homeWorkspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", userId)
    .eq("is_home", true)
    .single()

  if (!homeWorkspace) {
    throw new Error(error.message)
  }

  return homeWorkspace.id
}

export const getWorkspaceById = async (workspaceId: string) => {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single()

  if (!workspace) {
    throw new Error(error.message)
  }

  return workspace
}

export const getWorkspacesByUserId = async (userId: string) => {
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (!workspaces) {
    throw new Error(error.message)
  }

  return workspaces
}

export const getWorkspacesByAccountMembership = async (userId: string) => {
  // Check auth state
  const {
    data: { user }
  } = await supabase.auth.getUser()
  console.log("Current auth state:", {
    providedUserId: userId,
    authenticatedUserId: user?.id,
    isAuthenticated: !!user
  })

  const { data: memberships, error: memberError } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)

  console.log("Membership query:", {
    memberships,
    memberError,
    sql: `SELECT account_id FROM account_members WHERE user_id = '${userId}'`
  })

  if (!memberships?.length) {
    console.log("No memberships found for user:", userId)
    return []
  }

  // Then check workspaces
  const { data: workspaces, error } = await supabase
    .from("account_workspaces")
    .select(
      `
      workspace:workspaces!inner(*)
    `
    )
    .in(
      "account_id",
      memberships.map(m => m.account_id)
    )

  console.log("Workspace query result:", { workspaces, error })

  if (!workspaces) throw new Error(error?.message)
  return workspaces.map(w => w.workspace)
}

export const getHomeWorkspaceByAccountMembership = async (userId: string) => {
  // First get account IDs
  const { data: memberships } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)

  const accountIds = memberships?.map(m => m.account_id) || []

  const { data: workspaces, error } = await supabase
    .from("account_workspaces")
    .select(`workspace:workspaces(*)`)
    .in("account_id", accountIds)
    .eq("workspace.is_home", true)
    .single()

  if (!workspaces) throw new Error(error?.message)
  return workspaces.workspace.id
}

export const createWorkspace = async (
  workspace: TablesInsert<"workspaces">
) => {
  const { data: createdWorkspace, error } = await supabase
    .from("workspaces")
    .insert([workspace])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdWorkspace
}

export const updateWorkspace = async (
  workspaceId: string,
  workspace: TablesUpdate<"workspaces">
) => {
  const { data: updatedWorkspace, error } = await supabase
    .from("workspaces")
    .update(workspace)
    .eq("id", workspaceId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedWorkspace
}

export const deleteWorkspace = async (workspaceId: string) => {
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}
