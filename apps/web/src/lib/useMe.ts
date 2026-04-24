"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

export type Role = "admin" | "seller" | "homologation" | "installer" | "scheduler";

export interface Me {
  user_id: string;
  email: string;
  company_id: string;
  role: Role;
  phone?: string | null;
  is_install_manager?: boolean;
}

const ROLE_PHASES: Record<Role, Set<number>> = {
  admin: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
  seller: new Set([1, 2, 3, 4]),
  homologation: new Set([5, 6, 7, 10, 11]),
  installer: new Set([9]),
  scheduler: new Set([2, 3, 4, 8, 12]),
};

export function canEditPhase(role: Role | undefined, phase: number): boolean {
  if (!role) return false;
  return ROLE_PHASES[role].has(phase);
}

export function canEditProject(role: Role | undefined): boolean {
  return role === "admin" || role === "seller" || role === "scheduler";
}

export function canCreateClient(role: Role | undefined): boolean {
  return role === "admin" || role === "seller";
}

export function canUploadInstallPhoto(role: Role | undefined): boolean {
  return role === "admin" || role === "installer";
}

export function canSendRescheduleNotice(role: Role | undefined): boolean {
  return role === "admin" || role === "scheduler" || role === "installer";
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

  return {
    me, error,
    isAdmin: me?.role === "admin",
    isSeller: me?.role === "seller",
    isHomologation: me?.role === "homologation",
    isInstaller: me?.role === "installer",
    isScheduler: me?.role === "scheduler",
  };
}

export function clearMeCache() {
  cache = null;
}
