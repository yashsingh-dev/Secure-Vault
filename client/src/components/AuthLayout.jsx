import { Outlet, Navigate } from 'react-router-dom';
import { HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineFingerPrint, HiOutlineServerStack } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#090a0f', color: 'white' }}>Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-layout">
      {/* ─── Brand Panel (Desktop) ─── */}
      <div className="auth-brand-panel">
        <div className="brand-mesh">
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
          <div className="particle" />
        </div>
        <div className="grid-overlay" />

        <div className="brand-content">
          {/* Shield Graphic */}
          <div className="shield-graphic">
            <div className="shield-ring" />
            <div className="shield-ring" />
            <div className="shield-ring" />
            <div className="shield-center">
              <HiOutlineShieldCheck />
            </div>
          </div>

          <h1 className="brand-title">
            Your digital life,{' '}
            <span style={{ color: '#22c55e', WebkitTextFillColor: '#22c55e' }}>
              secured.
            </span>
          </h1>
          <p className="brand-description">
            Secure Vault protects your most sensitive data with military-grade
            encryption. Store passwords, files, and secrets with confidence.
          </p>

          <div className="brand-features">
            <div className="brand-feature">
              <div className="brand-feature-icon">
                <HiOutlineLockClosed />
              </div>
              <span>AES-256 end-to-end encryption</span>
            </div>
            <div className="brand-feature">
              <div className="brand-feature-icon">
                <HiOutlineFingerPrint />
              </div>
              <span>Multi-factor authentication</span>
            </div>
            <div className="brand-feature">
              <div className="brand-feature-icon">
                <HiOutlineServerStack />
              </div>
              <span>Zero-knowledge architecture</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Form Panel ─── */}
      <div className="auth-form-panel">
        <div className="auth-form-container page-enter">
          <MobileLogo />
          <Outlet />
          <div className="auth-footer">
            <p>© 2026 Secure Vault · All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileLogo() {
  return (
    <div className="mobile-logo">
      <div className="mobile-logo-icon">
        <HiOutlineShieldCheck />
      </div>
      <span className="mobile-logo-text">Secure Vault</span>
    </div>
  );
}
