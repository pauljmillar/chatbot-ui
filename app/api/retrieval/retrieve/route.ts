import { generateLocalEmbedding } from "@/lib/generate-local-embedding"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

export async function POST(request: Request) {
  const json = await request.json()
  const { userInput, fileIds, embeddingsProvider, sourceCount } = json as {
    userInput: string
    fileIds: string[]
    embeddingsProvider: "openai" | "local"
    sourceCount: number
  }

  const uniqueFileIds = [...new Set(fileIds)]

  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const profile = await getServerProfile()

    if (embeddingsProvider === "openai") {
      if (profile.use_azure_openai) {
        checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")
      } else {
        checkApiKey(profile.openai_api_key, "OpenAI")
      }
    }

    let chunks: any[] = []

    let openai
    if (profile.use_azure_openai) {
      openai = new OpenAI({
        apiKey: profile.azure_openai_api_key || "",
        baseURL: `${profile.azure_openai_endpoint}/openai/deployments/${profile.azure_openai_embeddings_id}`,
        defaultQuery: { "api-version": "2023-12-01-preview" },
        defaultHeaders: { "api-key": profile.azure_openai_api_key }
      })
    } else {
      openai = new OpenAI({
        apiKey: profile.openai_api_key || "",
        organization: profile.openai_organization_id
      })
    }

    const { data: fileItemsDetail, error: detailError } = await supabaseAdmin
      .from("file_items")
      .select("id, file_id, content")
      .in("file_id", uniqueFileIds)
      .limit(3)

    console.log("Content check:", {
      samples: fileItemsDetail?.map(item => ({
        fileId: item.file_id,
        contentPreview: item.content.substring(0, 100)
      }))
    })

    if (embeddingsProvider === "openai") {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userInput
      })

      const openaiEmbedding = response.data.map(item => item.embedding)[0]

      console.log("Attempting vector search:", {
        fileIds: uniqueFileIds,
        sourceCount,
        embeddingsProvider,
        hasEmbedding: Boolean(openaiEmbedding)
      })

      console.log("Pre-search check:", {
        fileIds: uniqueFileIds,
        embeddingLength: openaiEmbedding?.length
      })

      const { data: fileItemsCheck, error: checkError } = await supabaseAdmin
        .from("file_items")
        .select("id, file_id")
        .in("file_id", uniqueFileIds)
        .limit(1)

      console.log("File items check:", {
        hasItems: fileItemsCheck && fileItemsCheck.length > 0,
        firstItem: fileItemsCheck?.[0],
        error: checkError?.message
      })

      const { data: items, error: searchError } = await supabaseAdmin.rpc(
        "match_file_items_openai",
        {
          query_embedding: openaiEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        }
      )

      console.log("Search results:", {
        error: searchError?.message,
        itemCount: items?.length,
        firstItem: items?.[0]
          ? {
              fileId: items[0].file_id,
              similarity: items[0].similarity,
              contentPreview: items[0].content.substring(0, 100)
            }
          : null
      })

      if (searchError) {
        throw searchError
      }

      chunks = items

      console.log("Vector search results:", {
        matchCount: chunks?.length,
        fileIds: uniqueFileIds,
        matches: chunks?.map(chunk => ({
          fileId: chunk.file_id,
          similarity: chunk.similarity,
          content: chunk.content.substring(0, 100) + "..."
        }))
      })
    } else if (embeddingsProvider === "local") {
      const localEmbedding = await generateLocalEmbedding(userInput)

      const { data: localFileItems, error: localFileItemsError } =
        await supabaseAdmin.rpc("match_file_items_local", {
          query_embedding: localEmbedding as any,
          match_count: sourceCount,
          file_ids: uniqueFileIds
        })

      if (localFileItemsError) {
        throw localFileItemsError
      }

      chunks = localFileItems
    }

    const mostSimilarChunks = chunks?.sort(
      (a, b) => b.similarity - a.similarity
    )

    return new Response(JSON.stringify({ results: mostSimilarChunks }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
