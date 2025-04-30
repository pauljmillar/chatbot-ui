import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"
import mammoth from "mammoth"
import { toast } from "sonner"
import { uploadFile, deleteStorageFile } from "./storage/files"

export const getFileById = async (fileId: string) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single()

  if (error) {
    console.error("Error fetching file:", error)
    throw new Error(error.message)
  }

  if (!file) {
    throw new Error("File not found")
  }

  return file
}

export const getFileWorkspacesByWorkspaceId = async (workspaceId: string) => {
  console.log("Starting getFileWorkspacesByWorkspaceId:", workspaceId)

  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Query through file_workspaces with detailed logging
  const { data: files, error } = await supabase
    .from("file_workspaces")
    .select(
      `
      file_id,
      workspace_id,
      files!inner (
        id,
        name,
        type,
        sharing,
        size,
        tokens,
        created_at,
        updated_at,
        user_id,
        file_path
      )
    `
    )
    .eq("workspace_id", workspaceId)

  console.log("Raw file query result:", { files, error })

  if (error) {
    console.error("Error fetching workspace files:", error)
    throw new Error(error.message)
  }

  // Transform and log the result
  const transformedFiles = files.map(f => f.files)
  console.log("Transformed files:", transformedFiles)

  return {
    id: workspaceId,
    files: transformedFiles
  }
}

export const getFileWorkspacesByFileId = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select(
      `
      id, 
      name, 
      workspaces (*)
    `
    )
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const createFileBasedOnExtension = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "openai" | "local"
) => {
  const fileExtension = file.name.split(".").pop()

  if (fileExtension === "docx") {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({
      arrayBuffer
    })

    return createDocXFile(
      result.value,
      file,
      fileRecord,
      workspace_id,
      embeddingsProvider
    )
  } else {
    return createFile(file, fileRecord, workspace_id, embeddingsProvider)
  }
}

// For non-docx files
export const createFile = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "openai" | "local"
) => {
  console.log("Starting file creation process:", {
    fileName: file.name,
    fileRecord,
    workspace_id
  })

  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")
  console.log("Authenticated user:", user.id)

  // Verify workspace access - fixed query
  console.log("Checking workspace access for:", workspace_id)
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

  console.log("Workspace access check result:", {
    workspaceAccess,
    accessError
  })

  if (accessError || !workspaceAccess) {
    console.error("Workspace access error:", accessError)
    throw new Error("No access to this workspace")
  }

  // Log filename processing
  console.log("Processing filename:", fileRecord.name)
  let validFilename = fileRecord.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
  const extension = file.name.split(".").pop()
  const extensionIndex = validFilename.lastIndexOf(".")
  const baseName = validFilename.substring(
    0,
    extensionIndex < 0 ? undefined : extensionIndex
  )
  const maxBaseNameLength = 100 - (extension?.length || 0) - 1
  if (baseName.length > maxBaseNameLength) {
    fileRecord.name = baseName.substring(0, maxBaseNameLength) + "." + extension
  } else {
    fileRecord.name = baseName + "." + extension
  }
  console.log("Processed filename:", fileRecord.name)

  // Create file record with logging
  console.log("Creating file record:", { ...fileRecord, user_id: user.id })
  const { data: createdFile, error: fileError } = await supabase
    .from("files")
    .insert([{ ...fileRecord, user_id: user.id }])
    .select("*")
    .single()

  console.log("File record creation result:", { createdFile, fileError })

  if (fileError) {
    console.error("Error creating file record:", fileError)
    throw new Error(fileError.message)
  }

  // Create file workspace association with logging
  console.log("Creating file workspace association:", {
    file_id: createdFile.id,
    workspace_id,
    user_id: user.id
  })
  const { error: workspaceError } = await supabase
    .from("file_workspaces")
    .insert({
      file_id: createdFile.id,
      workspace_id: workspace_id,
      user_id: user.id
    })

  console.log("File workspace association result:", { workspaceError })

  if (workspaceError) {
    console.error("Error creating file workspace association:", workspaceError)
    await deleteFile(createdFile.id)
    throw new Error(workspaceError.message)
  }

  // Upload file to storage with logging
  console.log("Uploading file to storage")
  const filePath = await uploadFile(file, {
    name: createdFile.name,
    user_id: user.id,
    file_id: createdFile.name,
    workspace_id: workspace_id
  })
  console.log("File upload complete, path:", filePath)

  // Update file with path
  console.log("Updating file record with path")
  await updateFile(createdFile.id, {
    file_path: filePath
  })

  // Process file
  console.log("Starting file processing")
  const formData = new FormData()
  formData.append("file_id", createdFile.id)
  formData.append("embeddingsProvider", embeddingsProvider)

  const response = await fetch("/api/retrieval/process", {
    method: "POST",
    body: formData
  })

  console.log("File processing response:", response.status)

  if (!response.ok) {
    const jsonText = await response.text()
    const json = JSON.parse(jsonText)
    console.error(
      `Error processing file:${createdFile.id}, status:${response.status}, response:${json.message}`
    )
    toast.error("Failed to process file. Reason:" + json.message, {
      duration: 10000
    })
    await deleteFile(createdFile.id)
  }

  const fetchedFile = await getFileById(createdFile.id)
  console.log("Final fetched file:", fetchedFile)
  return fetchedFile
}

// // Handle docx files
export const createDocXFile = async (
  text: string,
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "openai" | "local"
) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Verify workspace access
  const { data: hasAccess } = await supabase
    .from("account_workspaces")
    .select(
      `
      account_id,
      account_members!inner(*)
    `
    )
    .eq("workspace_id", workspace_id)
    .eq("account_members.user_id", user.id)
    .single()

  if (!hasAccess) {
    throw new Error("No access to this workspace")
  }

  // Create file record
  const { data: createdFile, error: fileError } = await supabase
    .from("files")
    .insert([fileRecord])
    .select("*")
    .single()

  if (fileError) {
    console.error("Error creating file record:", fileError)
    throw new Error(fileError.message)
  }

  // Create file workspace association
  const { error: workspaceError } = await supabase
    .from("file_workspaces")
    .insert({
      file_id: createdFile.id,
      workspace_id: workspace_id,
      user_id: user.id
    })

  if (workspaceError) {
    console.error("Error creating file workspace association:", workspaceError)
    await deleteFile(createdFile.id)
    throw new Error(workspaceError.message)
  }

  // Upload file to storage
  const filePath = await uploadFile(file, {
    name: createdFile.name,
    user_id: user.id,
    file_id: createdFile.name,
    workspace_id: workspace_id
  })

  await updateFile(createdFile.id, {
    file_path: filePath
  })

  const response = await fetch("/api/retrieval/process/docx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: text,
      fileId: createdFile.id,
      embeddingsProvider,
      fileExtension: "docx"
    })
  })

  if (!response.ok) {
    const jsonText = await response.text()
    const json = JSON.parse(jsonText)
    console.error(
      `Error processing file:${createdFile.id}, status:${response.status}, response:${json.message}`
    )
    toast.error("Failed to process file. Reason:" + json.message, {
      duration: 10000
    })
    await deleteFile(createdFile.id)
  }

  const fetchedFile = await getFileById(createdFile.id)
  return fetchedFile
}

export const createFiles = async (
  files: TablesInsert<"files">[],
  workspace_id: string
) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Verify workspace access
  const { data: hasAccess } = await supabase
    .from("account_workspaces")
    .select("account_id")
    .eq("workspace_id", workspace_id)
    .eq("account_members.user_id", user.id)
    .single()

  if (!hasAccess) {
    throw new Error("No access to this workspace")
  }

  const { data: createdFiles, error } = await supabase
    .from("files")
    .insert(files)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  // Create file workspace associations
  const fileWorkspaces = createdFiles.map(file => ({
    user_id: user.id,
    file_id: file.id,
    workspace_id
  }))

  await createFileWorkspaces(fileWorkspaces)

  return createdFiles
}

export const createFileWorkspace = async (item: {
  user_id: string
  file_id: string
  workspace_id: string
}) => {
  const { data: createdFileWorkspace, error } = await supabase
    .from("file_workspaces")
    .insert([item])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdFileWorkspace
}

export const createFileWorkspaces = async (
  items: { user_id: string; file_id: string; workspace_id: string }[]
) => {
  const { data: createdFileWorkspaces, error } = await supabase
    .from("file_workspaces")
    .insert(items)
    .select("*")

  if (error) throw new Error(error.message)

  return createdFileWorkspaces
}

export const updateFile = async (
  fileId: string,
  file: TablesUpdate<"files">
) => {
  const { data: updatedFile, error } = await supabase
    .from("files")
    .update(file)
    .eq("id", fileId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedFile
}

export const deleteFile = async (fileId: string) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Get file info for storage deletion
  const { data: file } = await supabase
    .from("files")
    .select("file_path")
    .eq("id", fileId)
    .single()

  // Delete from storage if file path exists
  if (file?.file_path) {
    await deleteStorageFile(file.file_path)
  }

  const { error } = await supabase.from("files").delete().eq("id", fileId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export const deleteFileWorkspace = async (
  fileId: string,
  workspaceId: string
) => {
  // First verify auth
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error("User not authenticated")

  // Verify workspace access
  const { data: hasAccess } = await supabase
    .from("account_workspaces")
    .select(
      `
      account_id,
      account_members!inner(*)
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("account_members.user_id", user.id)
    .single()

  if (!hasAccess) {
    throw new Error("No access to this workspace")
  }

  const { error } = await supabase
    .from("file_workspaces")
    .delete()
    .eq("file_id", fileId)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)

  return true
}

// Function to migrate file paths
export const migrateFilePath = async (fileId: string, workspaceId: string) => {
  // Get the file details
  const { data: file, error: fileError } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single()

  if (fileError) {
    console.error("Error getting file:", fileError)
    throw new Error(fileError.message)
  }

  // Get the file data from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("files")
    .download(file.file_path)

  if (downloadError) {
    console.error("Error downloading file:", downloadError)
    throw new Error(downloadError.message)
  }

  // Create new path with workspace_id
  const newPath = `${workspaceId}/${file.name}`

  // Upload to new path
  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(newPath, fileData)

  if (uploadError) {
    console.error("Error uploading to new path:", uploadError)
    throw new Error(uploadError.message)
  }

  // Update file record with new path
  const { error: updateError } = await supabase
    .from("files")
    .update({ file_path: newPath })
    .eq("id", fileId)

  if (updateError) {
    console.error("Error updating file path:", updateError)
    throw new Error(updateError.message)
  }

  // Delete old file
  const { error: deleteError } = await supabase.storage
    .from("files")
    .remove([file.file_path])

  if (deleteError) {
    console.error("Error deleting old file:", deleteError)
    // Don't throw here, old file can be cleaned up later
  }

  return newPath
}

// Function to migrate all files in a workspace
export const migrateWorkspaceFiles = async (workspaceId: string) => {
  const { data: files, error } = await supabase
    .from("file_workspaces")
    .select("file_id")
    .eq("workspace_id", workspaceId)

  if (error) {
    console.error("Error getting workspace files:", error)
    throw new Error(error.message)
  }

  console.log(`Migrating ${files.length} files for workspace ${workspaceId}`)

  for (const file of files) {
    try {
      await migrateFilePath(file.file_id, workspaceId)
      console.log(`Migrated file ${file.file_id}`)
    } catch (e) {
      console.error(`Failed to migrate file ${file.file_id}:`, e)
    }
  }
}
