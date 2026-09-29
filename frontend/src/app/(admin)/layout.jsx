
import RouteGuard from "@/services/authGuard.jsx";

export default function ProtectedLayout({ children }) {
    return (
        <RouteGuard>
            {children}
        </RouteGuard>
    );
}
