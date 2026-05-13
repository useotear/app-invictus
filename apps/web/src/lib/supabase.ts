import { createClient } from "@supabase/supabase-js";

type RuntimeEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_API_URL?: string;
};

declare global {
  interface Window {
    __INVICTUS_ENV__?: RuntimeEnv;
  }
}

function publicEnv(name: keyof RuntimeEnv) {
  if (typeof window !== "undefined") {
    const value = window.__INVICTUS_ENV__?.[name];
    if (value) return value;
  }
  return process.env[name] || "";
}

export const supabase = createClient(
  publicEnv("NEXT_PUBLIC_SUPABASE_URL"),
  publicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
);

const rawApiUrl = publicEnv("NEXT_PUBLIC_API_URL") || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");
