export default function PageLoader() {
    return (
        <div
            role="status"
            aria-label="Loading"
            className="fixed inset-0 z-50 grid place-items-center bg-white/80 backdrop-blur-sm"
        >
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
    );
}