import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { TablesInsert, TablesUpdate } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { supabase } from "@/lib/supabase/browser-client"

export const getFoldersByWorkspaceId = async (workspaceId: string) => {
  const { data: folders, error } = await supabase
    .from("folders")
    .select("*")
    .eq("workspace_id", workspaceId)

  console.log("Folders query:", {
    workspaceId,
    folders,
    error,
    authState: (await supabase.auth.getUser()).data.user?.id
  })

  if (!folders) {
    throw new Error(error?.message || "Error fetching folders")
  }

  return folders
}

export const createFolder = async (folder: TablesInsert<"folders">) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  const { data: createdFolder, error } = await supabase
    .from("folders")
    .insert([folder])
    .select("*")
    .single()

  if (error) {
    console.error("Error creating folder:", error)
    throw new Error(error.message)
  }

  return createdFolder
}

export const updateFolder = async (
  folderId: string,
  folder: TablesUpdate<"folders">
) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  const { data: updatedFolder, error } = await supabase
    .from("folders")
    .update(folder)
    .eq("id", folderId)
    .select("*")
    .single()

  if (error) {
    console.error("Error updating folder:", error)
    throw new Error(error.message)
  }

  return updatedFolder
}

export const deleteFolder = async (
  folderId: string,
  supabaseClient: SupabaseClient<Database>
) => {
  const { error } = await supabaseClient
    .from("folders")
    .delete()
    .eq("id", folderId)

  if (error) throw new Error(error.message)
  return true
}
