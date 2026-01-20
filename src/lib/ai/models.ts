import "server-only";

import { createGroq } from "@ai-sdk/groq";
import { LanguageModel } from "ai";
import { ChatModel } from "app-types/chat";
import logger from "logger";

// Ensure baseURL doesn't have trailing slash
const getGroqBaseURL = () => {
  const baseURL = process.env.GROQ_BASE_URL;
  if (baseURL) {
    return baseURL.replace(/\/+$/, ""); // Remove trailing slashes
  }
  return undefined; // Use SDK default
};

const groqBaseURL = getGroqBaseURL() || "https://api.groq.com/openai/v1";
logger.info(
  `Groq configuration: baseURL=${groqBaseURL}, hasAPIKey=${!!process.env.GROQ_API_KEY}`,
);

// Custom fetch to log actual requests for debugging
const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  logger.info(`Groq API Request: ${init?.method || "GET"} ${url}`);

  try {
    const response = await fetch(input, init);
    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Unable to read error");
      logger.error(
        `Groq API Error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    return response;
  } catch (error) {
    logger.error(`Groq API Request failed:`, error);
    throw error;
  }
};

const groq = createGroq({
  baseURL: groqBaseURL,
  apiKey: process.env.GROQ_API_KEY,
  fetch: customFetch,
});

const staticModels = {
  groq: {
    "kimi-k2-instruct": groq("moonshotai/kimi-k2-instruct"),
    "llama-4-scout-17b": groq("meta-llama/llama-4-scout-17b-16e-instruct"),
    "gpt-oss-20b": groq("openai/gpt-oss-20b"),
    "gpt-oss-120b": groq("openai/gpt-oss-120b"),
    "qwen3-32b": groq("qwen/qwen3-32b"),
    compound: groq("groq/compound"),
    "compound-mini": groq("groq/compound-mini"),
  },
};

const staticUnsupportedModels = new Set<LanguageModel>([]);

const staticFilePartSupportByModel = new Map<
  LanguageModel,
  readonly string[]
>();

const allModels = { ...staticModels };

const allUnsupportedModels = new Set([...staticUnsupportedModels]);

export const isToolCallUnsupportedModel = (model: LanguageModel) => {
  return allUnsupportedModels.has(model);
};

const isImageInputUnsupportedModel = (_model: LanguageModel) => {
  // Groq models don't support image input currently
  return true;
};

export const isGroqModel = (model?: ChatModel): boolean => {
  if (!model) return false;
  return model.provider === "groq";
};

export const getFilePartSupportedMimeTypes = (model: LanguageModel) => {
  return staticFilePartSupportByModel.get(model) ?? [];
};

const fallbackModel = staticModels.groq["gpt-oss-120b"];

export const customModelProvider = {
  modelsInfo: Object.entries(allModels).map(([provider, models]) => ({
    provider,
    models: Object.entries(models).map(([name, model]) => ({
      name,
      isToolCallUnsupported: isToolCallUnsupportedModel(model),
      isImageInputUnsupported: isImageInputUnsupportedModel(model),
      supportedFileMimeTypes: [...getFilePartSupportedMimeTypes(model)],
    })),
    hasAPIKey: checkProviderAPIKey(provider as keyof typeof staticModels),
  })),
  getModel: (model?: ChatModel): LanguageModel => {
    if (!model) return fallbackModel;
    return allModels[model.provider]?.[model.model] || fallbackModel;
  },
};

function checkProviderAPIKey(provider: keyof typeof staticModels) {
  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY;
    return !!key && key != "****";
  }
  return false;
}
