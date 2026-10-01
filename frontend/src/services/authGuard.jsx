"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./authContext.js";

export default function RouteGuard({ children }) {
    const router = useRouter();
    const pathname = usePathname();

    const {
        user,
        loading,
        isAdmin,
    } = useAuth();

    useEffect(() => {
        if (loading) return;

        // Not logged in
        if (!user) {
            router.replace("/sign-in");
            return;
        }

        // Dashboard → Admin only
        if (pathname.startsWith("/dashboard") && !isAdmin) {
            router.replace("/unauthorized");
        }
    }, [loading, user, isAdmin, pathname, router]);

    // Authentication state is still being determined
    if (loading) {
        return null;
    }

    // Redirecting unauthenticated user
    if (!user) {
        return null;
    }

    // Redirecting non-admin user
    if (pathname.startsWith("/dashboard") && !isAdmin) {
        return null;
    }

    return children;
}

