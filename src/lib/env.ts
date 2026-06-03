const PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
} as const;

const SERVER_ENV = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  OPENAI_OCR_MODEL: process.env.OPENAI_OCR_MODEL,
  OPENAI_DOCUMENT_MODEL: process.env.OPENAI_DOCUMENT_MODEL,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET
} as const;

export const REQUIRED_BROWSER_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
export const REQUIRED_SERVER_ENV = ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"] as const;
export const OCR_ENV = ["OPENAI_OCR_MODEL"] as const;

export type EnvKey =
  | keyof typeof PUBLIC_ENV
  | keyof typeof SERVER_ENV;

export type EnvironmentReadiness = {
  authReady: boolean;
  adminReady: boolean;
  chatReady: boolean;
  uploadReady: boolean;
  ocrReady: boolean;
  missingBrowserEnv: string[];
  missingServerEnv: string[];
};

function readEnvValue(key: EnvKey) {
  if (key in PUBLIC_ENV) {
    return PUBLIC_ENV[key as keyof typeof PUBLIC_ENV];
  }

  return SERVER_ENV[key as keyof typeof SERVER_ENV];
}

export function getMissingEnv(keys: readonly EnvKey[]) {
  return keys.filter((key) => !readEnvValue(key));
}

export function getEnvironmentReadiness(): EnvironmentReadiness {
  const missingBrowserEnv = getMissingEnv(REQUIRED_BROWSER_ENV);
  const missingServerEnv = getMissingEnv(REQUIRED_SERVER_ENV);

  return {
    authReady: missingBrowserEnv.length === 0,
    adminReady: missingBrowserEnv.length === 0 && missingServerEnv.length === 0,
    chatReady: missingBrowserEnv.length === 0 && missingServerEnv.length === 0,
    uploadReady: missingBrowserEnv.length === 0 && missingServerEnv.length === 0,
    ocrReady: missingServerEnv.length === 0,
    missingBrowserEnv,
    missingServerEnv
  };
}

export function assertEnv(keys: readonly EnvKey[], scope: string) {
  const missing = getMissingEnv(keys);

  if (missing.length) {
    throw new Error(`${scope} is not configured. Missing environment variables: ${missing.join(", ")}.`);
  }
}
