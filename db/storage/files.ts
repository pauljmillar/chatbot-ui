import { supabase } from "@/lib/supabase/browser-client"
import { toast } from "sonner"

export const uploadFile = async (
  file: File,
  options: {
    name: string
    user_id: string
    file_id: string
    workspace_id: string
  }
) => {
  console.log("Starting file upload to storage:", options)

  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Verify workspace access
  const { data: workspaceAccess, error: accessError } = await supabase
    .from("account_workspaces")
    .select(
      `
      workspace_id,
      account_id,
      accounts!inner (
        account_members!inner (
          user_id
        )
      )
    `
    )
    .eq("workspace_id", options.workspace_id)
    .eq("accounts.account_members.user_id", user.id)
    .single()

  if (accessError || !workspaceAccess) {
    console.error("Storage workspace access error:", accessError)
    throw new Error("No access to this workspace")
  }

  const SIZE_LIMIT = parseInt(
    process.env.NEXT_PUBLIC_USER_FILE_SIZE_LIMIT || "10000000"
  )

  if (file.size > SIZE_LIMIT) {
    throw new Error(
      `File must be less than ${Math.floor(SIZE_LIMIT / 1000000)}MB`
    )
  }

  // Use workspace_id/filename pattern consistently
  const filePath = `${options.workspace_id}/${options.name}`
  console.log("Uploading to path:", filePath)

  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(filePath, file)

  if (uploadError) {
    console.error("Error uploading file:", uploadError)
    throw new Error(uploadError.message)
  }

  console.log("File upload successful")
  return filePath
}

export const downloadFile = async (filePath: string) => {
  console.log("Starting file download:", filePath)

  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Extract workspace_id from file path
  const workspace_id = filePath.split("/")[0]
  console.log("Extracted workspace_id:", workspace_id)

  // Verify workspace access
  const { data: workspaceAccess, error: accessError } = await supabase
    .from("account_workspaces")
    .select(
      `
      workspace_id,
      account_id,
      accounts!inner (
        account_members!inner (
          user_id
        )
      )
    `
    )
    .eq("workspace_id", workspace_id)
    .eq("accounts.account_members.user_id", user.id)
    .single()

  if (accessError || !workspaceAccess) {
    console.error("Storage workspace access error:", accessError)
    throw new Error("No access to this workspace")
  }

  const { data, error } = await supabase.storage
    .from("files")
    .download(filePath)

  if (error) {
    console.error("Error downloading file:", error)
    throw new Error(error.message)
  }

  console.log("File download successful")
  return data
}

export const deleteStorageFile = async (filePath: string) => {
  console.log("Starting file deletion:", filePath)

  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Extract workspace_id from file path
  const workspace_id = filePath.split("/")[0]
  console.log("Extracted workspace_id:", workspace_id)

  // Verify workspace access
  const { data: workspaceAccess, error: accessError } = await supabase
    .from("account_workspaces")
    .select(
      `
      workspace_id,
      account_id,
      accounts!inner (
        account_members!inner (
          user_id
        )
      )
    `
    )
    .eq("workspace_id", workspace_id)
    .eq("accounts.account_members.user_id", user.id)
    .single()

  if (accessError || !workspaceAccess) {
    console.error("Storage workspace access error:", accessError)
    throw new Error("No access to this workspace")
  }

  const { error } = await supabase.storage.from("files").remove([filePath])

  if (error) {
    console.error("Error deleting file from storage:", error)
    throw new Error(error.message)
  }

  console.log("File deletion successful")
  return true
}

export const getFileFromStorage = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(filePath, 60 * 60 * 24) // 24hrs

  if (error) {
    console.error(`Error uploading file with path: ${filePath}`, error)
    throw new Error("Error downloading file")
  }

  return data.signedUrl
}
