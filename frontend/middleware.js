"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./src/services/authContext.js";

export default function RouteGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    // Not logged in
    if (!user) {
      router.replace("/login");
      return;
    }

    // Admin-only route
    if (pathname.startsWith("/dashboard")) {
      if (String(user.roleId) !== "1") {
        router.replace("/unauthorized");
        return;
      }
    }
  }, [authLoading, user, pathname, router]);

  if (authLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  // Prevent dashboard from rendering for non-admin
  if (
    pathname.startsWith("/dashboard") &&
    String(user.roleId) !== "1"
  ) {
    return null;
  }

  return children;
}