import { FileItemChunk } from "@/types"
import { encode } from "gpt-tokenizer"
import { JSONLoader } from "langchain/document_loaders/fs/json"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { CHUNK_OVERLAP, CHUNK_SIZE } from "."
import { cleanHtmlTags, cleanTweetText } from "@/lib/text-processing"

export const processJSON = async (json: Blob): Promise<FileItemChunk[]> => {
  const text = await json.text()
  console.log("Processing JSON file:", {
    contentLength: text.length,
    preview: text.substring(0, 200)
  })

  try {
    const tweets = JSON.parse(text)
    console.log("Parsed JSON:", {
      isArray: Array.isArray(tweets),
      length: tweets.length,
      firstItem: tweets[0] ? Object.keys(tweets[0]) : null
    })

    if (
      Array.isArray(tweets) &&
      tweets.length > 0 &&
      tweets[0] &&
      typeof tweets[0] === "object" &&
      "text" in tweets[0]
    ) {
      console.log("Detected tweet format, cleaning tweets...")
      const cleanedTweets = tweets
        .map(tweet => {
          const tweetText = tweet.text || ""
          const cleaned = cleanHtmlTags(cleanTweetText(tweetText))
          return cleaned
        })
        .filter(text => text.trim().length > 0)

      console.log("Cleaned tweets:", {
        originalCount: tweets.length,
        cleanedCount: cleanedTweets.length,
        sampleClean: cleanedTweets[0]?.substring(0, 100)
      })

      return cleanedTweets.map(content => ({
        content,
        tokens: encode(content).length
      }))
    }
  } catch (e) {
    console.error("Error processing tweets:", e)
  }

  console.log("Falling back to default JSON processing")
  const loader = new JSONLoader(json)
  const docs = await loader.load()
  let completeText = docs.map(doc => doc.pageContent).join(" ")

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP
  })
  const splitDocs = await splitter.createDocuments([completeText])

  return splitDocs.map(doc => ({
    content: doc.pageContent,
    tokens: encode(doc.pageContent).length
  }))
}
