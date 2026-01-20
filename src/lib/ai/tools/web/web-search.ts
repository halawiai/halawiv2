import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";

// Tavily API Types
export interface TavilySearchRequest {
  query: string;
  search_depth?: "basic" | "advanced";
  topic?: "general" | "news" | "finance";
  max_results?: number;
  include_answer?: boolean;
  include_images?: boolean;
  include_image_descriptions?: boolean;
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
  time_range?: "year" | "month" | "week" | "day";
  country?: string;
  start_date?: string;
  end_date?: string;
  max_tokens?: number;
  chunks_per_source?: number;
  include_favicon?: boolean;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  raw_content?: string;
  favicon?: string;
}

export interface TavilyImageResult {
  url: string;
  description?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
  images?: TavilyImageResult[] | string[];
  response_time: number;
  request_id: string;
}

// Legacy interface names for backward compatibility with UI components
export interface ExaSearchResult {
  id: string;
  title: string;
  url: string;
  publishedDate: string;
  author: string;
  text: string;
  image?: string;
  favicon?: string;
  score?: number;
}

export interface ExaSearchResponse {
  requestId: string;
  autopromptString: string;
  resolvedSearchType: string;
  results: ExaSearchResult[];
}

export const exaSearchSchema: JSONSchema7 = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query",
    },
    numResults: {
      type: "number",
      description: "Number of search results to return",
      default: 5,
      minimum: 1,
      maximum: 20,
    },
    type: {
      type: "string",
      enum: ["auto", "keyword", "neural"],
      description:
        "Search type - auto uses basic search, keyword for exact matches, neural uses advanced search",
      default: "auto",
    },
    category: {
      type: "string",
      enum: [
        "company",
        "research paper",
        "news",
        "linkedin profile",
        "github",
        "tweet",
        "movie",
        "song",
        "personal site",
        "pdf",
      ],
      description:
        "Category to focus the search on (not directly supported by Tavily, but used for context)",
    },
    includeDomains: {
      type: "array",
      items: { type: "string" },
      description: "List of domains to specifically include in search results",
      default: [],
    },
    excludeDomains: {
      type: "array",
      items: { type: "string" },
      description:
        "List of domains to specifically exclude from search results",
      default: [],
    },
    startPublishedDate: {
      type: "string",
      description: "Start date for published content (YYYY-MM-DD format)",
    },
    endPublishedDate: {
      type: "string",
      description: "End date for published content (YYYY-MM-DD format)",
    },
    maxCharacters: {
      type: "number",
      description:
        "Maximum characters to extract from each result (approximate)",
      default: 3000,
      minimum: 100,
      maximum: 10000,
    },
  },
  required: ["query"],
};

export const exaContentsSchema: JSONSchema7 = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      items: { type: "string" },
      description: "List of URLs to extract content from",
    },
    maxCharacters: {
      type: "number",
      description: "Maximum characters to extract from each URL",
      default: 3000,
      minimum: 100,
      maximum: 10000,
    },
    livecrawl: {
      type: "string",
      enum: ["always", "fallback", "preferred"],
      description:
        "Live crawling preference - always forces live crawl, fallback uses cache first, preferred tries live first",
      default: "preferred",
    },
  },
  required: ["urls"],
};

const API_KEY = process.env.TAVILY_API_KEY;
const BASE_URL = "https://api.tavily.com";

const fetchTavily = async (endpoint: string, body: any): Promise<any> => {
  if (!API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new Error("Invalid Tavily API key");
  }
  if (response.status === 429) {
    throw new Error("Tavily API usage limit exceeded");
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Tavily API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
    );
  }

  return await response.json();
};

// Transform Tavily response to match legacy Exa format for UI compatibility
const transformTavilyToExaFormat = (
  tavilyResponse: TavilySearchResponse,
): ExaSearchResponse => {
  return {
    requestId: tavilyResponse.request_id,
    autopromptString: tavilyResponse.answer || "",
    resolvedSearchType: "neural",
    results: tavilyResponse.results.map((result, index) => {
      // Extract image from images array if available
      let imageUrl: string | undefined;
      if (tavilyResponse.images && tavilyResponse.images.length > 0) {
        const imageItem = tavilyResponse.images[index];
        if (typeof imageItem === "string") {
          imageUrl = imageItem;
        } else if (imageItem?.url) {
          imageUrl = imageItem.url;
        }
      }

      return {
        id: result.url,
        title: result.title,
        url: result.url,
        publishedDate: result.published_date || "",
        author: "",
        text: result.content,
        image: imageUrl,
        favicon: result.favicon,
        score: result.score,
      };
    }),
  };
};

export const exaSearchToolForWorkflow = createTool({
  description:
    "Search the web using Tavily AI - performs real-time web searches optimized for AI applications. Returns high-quality, relevant results with full content extraction.",
  inputSchema: jsonSchemaToZod(exaSearchSchema),
  execute: async (params) => {
    // Normalize type parameter - ensure it's one of the valid enum values
    const normalizedType =
      params.type && ["auto", "keyword", "neural"].includes(params.type)
        ? params.type
        : "auto";

    const searchRequest: TavilySearchRequest = {
      query: params.query,
      search_depth:
        normalizedType === "neural"
          ? "advanced"
          : normalizedType === "keyword"
            ? "basic"
            : "basic",
      max_results: params.numResults || 5,
      include_answer: false,
      include_images: true,
      include_image_descriptions: false,
      include_raw_content: false,
      include_favicon: true,
    };

    // Add optional parameters if provided
    if (params.category === "news") {
      searchRequest.topic = "news";
    }
    if (params.includeDomains?.length) {
      searchRequest.include_domains = params.includeDomains;
    }
    if (params.excludeDomains?.length) {
      searchRequest.exclude_domains = params.excludeDomains;
    }
    if (params.startPublishedDate) {
      searchRequest.start_date = params.startPublishedDate;
    }
    if (params.endPublishedDate) {
      searchRequest.end_date = params.endPublishedDate;
    }

    const response = await fetchTavily("/search", searchRequest);
    return transformTavilyToExaFormat(response);
  },
});

export const exaContentsToolForWorkflow = createTool({
  description:
    "Extract detailed content from specific URLs using Tavily AI - retrieves full text content, metadata, and structured information from web pages.",
  inputSchema: jsonSchemaToZod(exaContentsSchema),
  execute: async (params) => {
    // Tavily doesn't have a direct /contents endpoint like Exa
    // We'll use the search endpoint with include_domains to get content from specific URLs
    // For each URL, we'll extract the domain and search for it
    const results = await Promise.all(
      params.urls.map(async (url) => {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;

          const searchRequest: TavilySearchRequest = {
            query: url,
            search_depth: "advanced",
            max_results: 1,
            include_domains: [domain],
            include_raw_content: true,
            include_favicon: true,
          };

          const response = await fetchTavily("/search", searchRequest);
          if (response.results && response.results.length > 0) {
            const result = response.results[0];
            // Find the result that matches the URL
            const matchingResult =
              response.results.find((r: TavilySearchResult) =>
                r.url.includes(urlObj.pathname),
              ) || result;

            return {
              id: url,
              title: matchingResult.title,
              url: matchingResult.url,
              publishedDate: matchingResult.published_date || "",
              author: "",
              text:
                matchingResult.raw_content?.substring(
                  0,
                  params.maxCharacters || 3000,
                ) || matchingResult.content,
              favicon: matchingResult.favicon,
              score: matchingResult.score,
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching content for ${url}:`, error);
          return null;
        }
      }),
    );

    return {
      results: results.filter((r) => r !== null),
    };
  },
});

export const exaSearchTool = createTool({
  description:
    "Search the web using Tavily AI - performs real-time web searches optimized for AI applications. Returns high-quality, relevant results with full content extraction.",
  inputSchema: jsonSchemaToZod(exaSearchSchema),
  execute: (params) => {
    return safe(async () => {
      // Normalize type parameter - ensure it's one of the valid enum values
      const normalizedType =
        params.type && ["auto", "keyword", "neural"].includes(params.type)
          ? params.type
          : "auto";

      const searchRequest: TavilySearchRequest = {
        query: params.query,
        search_depth:
          normalizedType === "neural"
            ? "advanced"
            : normalizedType === "keyword"
              ? "basic"
              : "basic",
        max_results: params.numResults || 5,
        include_answer: false,
        include_images: true,
        include_image_descriptions: false,
        include_raw_content: false,
        include_favicon: true,
      };

      // Add optional parameters if provided
      if (params.category === "news") {
        searchRequest.topic = "news";
      }
      if (params.includeDomains?.length) {
        searchRequest.include_domains = params.includeDomains;
      }
      if (params.excludeDomains?.length) {
        searchRequest.exclude_domains = params.excludeDomains;
      }
      if (params.startPublishedDate) {
        searchRequest.start_date = params.startPublishedDate;
      }
      if (params.endPublishedDate) {
        searchRequest.end_date = params.endPublishedDate;
      }

      const tavilyResponse = await fetchTavily("/search", searchRequest);
      const result = transformTavilyToExaFormat(tavilyResponse);

      return {
        ...result,
        guide: `Use the search results to answer the user's question. Summarize the content and ask if they have any additional questions about the topic.`,
      };
    })
      .ifFail((e) => {
        return {
          isError: true,
          error: e.message,
          solution:
            "A web search error occurred. First, explain to the user what caused this specific error and how they can resolve it. Then provide helpful information based on your existing knowledge to answer their question.",
        };
      })
      .unwrap();
  },
});

export const exaContentsTool = createTool({
  description:
    "Extract detailed content from specific URLs using Tavily AI - retrieves full text content, metadata, and structured information from web pages.",
  inputSchema: jsonSchemaToZod(exaContentsSchema),
  execute: async (params) => {
    return safe(async () => {
      // Tavily doesn't have a direct /contents endpoint like Exa
      // We'll use the search endpoint with include_domains to get content from specific URLs
      const results = await Promise.all(
        params.urls.map(async (url) => {
          try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;

            const searchRequest: TavilySearchRequest = {
              query: url,
              search_depth: "advanced",
              max_results: 1,
              include_domains: [domain],
              include_raw_content: true,
              include_favicon: true,
            };

            const response = await fetchTavily("/search", searchRequest);
            if (response.results && response.results.length > 0) {
              const result = response.results[0];
              // Find the result that matches the URL
              const matchingResult =
                response.results.find((r: TavilySearchResult) =>
                  r.url.includes(urlObj.pathname),
                ) || result;

              return {
                id: url,
                title: matchingResult.title,
                url: matchingResult.url,
                publishedDate: matchingResult.published_date || "",
                author: "",
                text:
                  matchingResult.raw_content?.substring(
                    0,
                    params.maxCharacters || 3000,
                  ) || matchingResult.content,
                favicon: matchingResult.favicon,
                score: matchingResult.score,
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching content for ${url}:`, error);
            return null;
          }
        }),
      );

      return {
        results: results.filter((r) => r !== null),
      };
    })
      .ifFail((e) => {
        return {
          isError: true,
          error: e.message,
          solution:
            "A web content extraction error occurred. First, explain to the user what caused this specific error and how they can resolve it. Then provide helpful information based on your existing knowledge to answer their question.",
        };
      })
      .unwrap();
  },
});
