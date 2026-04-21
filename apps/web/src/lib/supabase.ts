import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");
