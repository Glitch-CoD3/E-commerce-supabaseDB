// context/AuthContext.jsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getme } from "./user.service.js";
import { number } from "zod";

const AuthContext = createContext(null);
export const ADMIN_ROLE_ID = 1; // confirm 1 is admin in your roles table
export const CUSTOMER_ROLE_ID = 1;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getme()
            .then((data) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const isAdmin = Number(user?.role_id) === ADMIN_ROLE_ID;
    const isCustomer = Number(user?.role_id) === CUSTOMER_ROLE_ID;

    return (
        <AuthContext.Provider value={{ user, setUser, loading, isAdmin, isCustomer }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);