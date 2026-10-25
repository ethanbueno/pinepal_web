import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// roles is optional. Example: <ProtectedRoute roles={["admin"]}> ... </ProtectedRoute>
function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // wrong role: go back to the home page (it shows the right home for each role)
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
