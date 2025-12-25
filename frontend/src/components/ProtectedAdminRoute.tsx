// frontend/src/components/ProtectedAdminRoute.tsx
import { Navigate } from "react-router-dom";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const isUnlocked = localStorage.getItem("admin_unlocked") === "true";
  
  if (!isUnlocked) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <>{children}</>;
}
