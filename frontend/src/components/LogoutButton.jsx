'use client';

import { useState, useRef, useEffect } from "react";
import { LogOut } from "lucide-react";

export const LogoutButton = ({ onLogout }) => {
    const [confirming, setConfirming] = useState(false);
    const ref = useRef(null);

    // Close the confirm state if the user clicks elsewhere
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setConfirming(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative flex items-center">
            <button
                onClick={() => (confirming ? onLogout() : setConfirming(true))}
                className={`
                    group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium
                    transition-all duration-150
                    ${confirming
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-gray-100 text-gray-600  hover:border-gray-200 hover:bg-gray-50"}
                `}
            >
                <LogOut
                    className={`h-3.5 w-3.5 transition-transform duration-150 ${confirming ? "" : "group-hover:-translate-x-0.5"}`}
                />
                {confirming ? "Confirm" : "Logout"}
            </button>
        </div>
    );
};
