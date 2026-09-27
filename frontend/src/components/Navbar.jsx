'use client';

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SearchBar from "./SearchBar";
import { Bell, Home } from "lucide-react";
import ShoppingCartIcon from './ShoppingCartIcon.jsx'
import { useAuth } from "@/services/authContext.js";
import { logoutUser } from "@/services/auth.service.js";
import { LogoutButton } from "../components/LogoutButton.jsx"

const Navbar = () => {
    const router = useRouter();
    const { user, loading, setUser } = useAuth();

    const handleLogout = async () => {
        try {
            await logoutUser(); // clears the cookie / invalidates the session on Express
        } catch (err) {
            console.error("Logout failed:", err);
        } finally {
            setUser(null);
            router.push("/sign-in");
        }
    };

    return (
        <nav className="w-full flex items-center justify-between border-b border-gray-200 pb-4">
            {/* Left side */}
            <Link href="/" className="flex items-center">
                <Image src="/logo.png" alt="Trendlama" width={36} height={36} className="w-6 h-6 md:w-9 md:h-9" />
                <p className="hidden md:block text-md font-medium tracking-wider">TRENDLAMA.</p>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-6">
                <SearchBar />
                <Link href="/">
                    <Home className="w-4 h-4 text-gray-600" />
                </Link>
                <Bell className="w-4 h-4 text-gray-600" />
                <ShoppingCartIcon />

                {loading ? null : user ? (
                    <LogoutButton onLogout={handleLogout} />
                ) : (
                    <Link href="/sign-in">Sign in</Link>
                )}
            </div>
        </nav>
    )
}

export default Navbar;