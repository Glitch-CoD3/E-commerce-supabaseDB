"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const useUpdateQuery = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "" || value === false) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      // Any filter change should go back to page 1
      if (!("page" in updates)) params.delete("page");

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );
};