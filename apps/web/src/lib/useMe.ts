"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

export interface Me {
  user_id: string;
  email: string;
  company_id: string;
  role: "admin" | "seller";
  phone?: string | null;
  is_install_manager?: boolean;
}

let cache: Me | null = null;
let pending: Promise<Me> | null = null;

async function load(): Promise<Me> {
  if (cache) return cache;
  if (pending) return pending;
  pending = api.get<Me>("/whoami").then((v) => {
    cache = v;
    pending = null;
    return v;
  });
  return pending;
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    load()
      .then(setMe)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}` : String(e)));
  }, []);

  return { me, error, isAdmin: me?.role === "admin", isSeller: me?.role === "seller" };
}

export function clearMeCache() {
  cache = null;
}
