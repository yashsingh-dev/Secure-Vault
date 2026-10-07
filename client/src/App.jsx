import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import ChangePassword from './pages/ChangePassword';
import GoogleCallback from './pages/GoogleCallback';

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />

      {/* Protected dashboard */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      {/* Auth flow pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/change-password/:token" element={<ChangePassword />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />
      </Route>

      {/* Redirect unknown routes to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
