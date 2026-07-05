import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

type User = {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  role: "owner" | "buyer" | "admin";
  verified: boolean;
  profile_complete: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<{ is_new: boolean; user: User }>;
  completeProfile: (name: string, email: string, role: "owner" | "buyer") => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await storage.getItem<string>("ghar_token", "");
      if (!token) {
        setUser(null);
        return;
      }
      const res = await api.me();
      setUser(res.user);
    } catch {
      setUser(null);
      await setToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const sendOtp = async (phone: string) => {
    await api.sendOtp(phone);
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await api.verifyOtp(phone, otp);
    await setToken(res.token);
    setUser(res.user);
    return { is_new: res.is_new, user: res.user };
  };

  const completeProfile = async (name: string, email: string, role: "owner" | "buyer") => {
    const res = await api.completeProfile(name, email, role);
    setUser(res.user);
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, sendOtp, verifyOtp, completeProfile, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
