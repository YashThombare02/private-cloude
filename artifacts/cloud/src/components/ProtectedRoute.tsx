import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";

export function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      retry: false
    }
  });
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (error || !user) {
    setLocation("/login");
    return null;
  }

  if (requireAdmin && user.role !== "admin") {
    setLocation("/gallery");
    return null;
  }

  return <>{children}</>;
}
