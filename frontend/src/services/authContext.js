"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getme } from "./user.service.js";
import { handleApiError } from "../services/handleApiError.js";

const AuthContext = createContext(null);

export const ADMIN_ROLE_ID = 1;
export const CUSTOMER_ROLE_ID = 2; // confirm against your roles table

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getme()
            .then((data) => setUser(data.user))
            .catch((err) => {
                setUser(null);
                // 401/403 just means "not logged in", so stay quiet.
                // Network and 5xx errors still show a toast.
                handleApiError(err, { ignoreStatuses: [401, 403] });
            })
            .finally(() => setLoading(false));
    }, []);

    const roleId = Number(user?.role_id);
    const isAdmin = roleId === ADMIN_ROLE_ID;
    const isCustomer = roleId === CUSTOMER_ROLE_ID;

    return (
        <AuthContext.Provider
            value={{ user, setUser, loading, isAdmin, isCustomer }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);