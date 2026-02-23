// messages

type Role = "system" | "user" | "assistant";

type TextMessage = {
  role: Role;
  content: string;
};

type ImageUrl = {
  url: string;
  detail?: "auto" | "low" | "high";
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: ImageUrl };

type VisionMessage = {
  role: "user";
  content: ContentPart[];
};

type ChatMessage = TextMessage | VisionMessage;

// requests

type ChatCompletionRequestBase = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  frequency_penalty?: number;
  presence_penalty?: number;
};

type ChatCompletionRequestNonStreaming = ChatCompletionRequestBase & {
  stream?: false;
};

type ChatCompletionRequestStreaming = ChatCompletionRequestBase & {
  stream: true;
};

type ChatCompletionRequest =
  | ChatCompletionRequestNonStreaming
  | ChatCompletionRequestStreaming;

// responses (non-streaming)

type ChatCompletionChoice = {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason: "stop" | "length" | null;
};

type UsageStats = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type ChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: UsageStats;
};

// responses (streaming)

type ChatCompletionChunkDelta = {
  role?: "assistant";
  content?: string;
};

type ChatCompletionChunkChoice = {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: "stop" | "length" | null;
};

type ChatCompletionChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: UsageStats;
};

// models

type Model = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
};

type ModelListResponse = {
  object: "list";
  data: Model[];
};

// errors

type ProxyErrorCode =
  | "invalid_request"
  | "model_not_found"
  | "upstream_error"
  | "internal_error"
  | "auth_error"
  | "rate_limit_exceeded";

type ProxyError = {
  error: {
    message: string;
    type: ProxyErrorCode;
    code: number;
  };
};

export type {
  Role,
  ChatMessage,
  TextMessage,
  VisionMessage,
  ContentPart,
  ImageUrl,
  ChatCompletionRequest,
  ChatCompletionRequestNonStreaming,
  ChatCompletionRequestStreaming,
  ChatCompletionRequestBase,
  ChatCompletionChoice,
  UsageStats,
  ChatCompletionResponse,
  ChatCompletionChunkDelta,
  ChatCompletionChunkChoice,
  ChatCompletionChunk,
  Model,
  ModelListResponse,
  ProxyErrorCode,
  ProxyError,
};
