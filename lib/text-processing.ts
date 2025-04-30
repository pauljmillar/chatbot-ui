import { Tables } from "@/supabase/types"

interface Tweet {
  text: string
  date: number
  id: string
  [key: string]: any
}

export function cleanHtmlTags(text: string): string {
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "")
  // Fix HTML entities
  text = text.replace(/&amp;/g, "&")
  return text
}

export function cleanTweetText(text: string): string {
  // Remove RT prefix
  text = text.replace(/^RT\s+@\w+:\s*/g, "")
  // Remove @mentions
  text = text.replace(/@\w+/g, "")
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "")
  // Remove multiple spaces
  text = text.replace(/\s+/g, " ")
  return text.trim()
}

export function formatTweetsForVectorDB(jsonContent: string): string[] {
  try {
    // Parse JSON
    const tweets = JSON.parse(jsonContent) as Tweet[]

    const formatted = tweets
      .map(tweet => {
        const text = tweet.text || ""
        return cleanHtmlTags(cleanTweetText(text))
      })
      .filter(text => text.trim().length > 0)

    return formatted
  } catch (error) {
    console.error("Error formatting tweets:", error)
    return []
  }
}

function isTweetJSON(content: string): boolean {
  try {
    const data = JSON.parse(content)
    // Check if it's an array and has tweet-like objects
    return (
      Array.isArray(data) &&
      data.length > 0 &&
      data[0] &&
      typeof data[0] === "object" &&
      ("text" in data[0] || "content" in data[0])
    )
  } catch {
    return false
  }
}

export function preprocessFileContent(
  content: string,
  fileType: string
): string[] {
  // Try to detect and process tweet JSON
  if (fileType.includes("json") && isTweetJSON(content)) {
    return formatTweetsForVectorDB(content)
  }

  // For all other content, return as single chunk
  return [content]
}
