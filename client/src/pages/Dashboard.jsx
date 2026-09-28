import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserAPI } from '../api/user.api';
import {
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlineCheckBadge,
  HiOutlineClipboardDocument,
  HiOutlineCheck,
  HiOutlineArrowRightOnRectangle,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineKey,
  HiOutlineArrowPath,
} from 'react-icons/hi2';

export default function Dashboard() {
  const { user, logout, logoutAll, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [alwaysRequireOtp, setAlwaysRequireOtp] = useState(
    Boolean(user?.settings?.alwaysRequireOtp)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Sync state when auth user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAlwaysRequireOtp(Boolean(user.settings?.alwaysRequireOtp));
    }
  }, [user]);

  // Eagerly refresh latest user profile on dashboard visit
  useEffect(() => {
    let isMounted = true;
    const fetchLatestProfile = async () => {
      try {
        const res = await UserAPI.getProfile();
        if (isMounted && res?.payload) {
          updateUser(res.payload);
          setName(res.payload.name || '');
          setAlwaysRequireOtp(Boolean(res.payload.settings?.alwaysRequireOtp));
        }
      } catch (err) {
        // Fall back seamlessly to authenticated session state
        console.warn('Profile refresh fallback:', err);
      }
    };

    fetchLatestProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const hasChanges =
    name.trim() !== (user?.name || '').trim() ||
    alwaysRequireOtp !== Boolean(user?.settings?.alwaysRequireOtp);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast.error('Name cannot be empty.');
      return;
    }
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters long.');
      return;
    }
    if (trimmedName.length > 50) {
      toast.error('Name cannot exceed 50 characters.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await UserAPI.updateProfile({
        name: trimmedName,
        alwaysRequireOtp,
      });

      if (res?.payload) {
        updateUser(res.payload);
        toast.success(res.message || 'Profile updated successfully.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyId = async () => {
    const idToCopy = user?.id || user?._id;
    if (!idToCopy) return;

    try {
      await navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      toast.info('Secure ID copied to clipboard.');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error('Failed to copy ID to clipboard.');
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login');
    } catch {
      toast.error('Failed to log out.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogoutAll = async () => {
    try {
      setIsLoggingOutAll(true);
      await logoutAll();
      navigate('/login');
    } catch {
      toast.error('Failed to log out all sessions.');
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Active now';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Active now';
    }
  };

  const initialChar = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="dashboard-page page-enter">
      <div className="dashboard-card">
        {/* Header with Avatar and Status Badges */}
        <div className="dashboard-header">
          <div className="dashboard-avatar-wrapper">
            <div className="dashboard-avatar">
              {initialChar}
            </div>
            {user?.isVerified && (
              <div className="dashboard-verified-badge" title="Verified Account">
                <HiOutlineCheckBadge />
              </div>
            )}
          </div>
          <h1 className="dashboard-title">{user?.name || 'Vault Dashboard'}</h1>
          <div className="dashboard-subtitle">
            {user?.isVerified && (
              <span className="badge-tag badge-tag-verified">
                <HiOutlineShieldCheck />
                <span>Verified</span>
              </span>
            )}
            <span className="badge-tag badge-tag-oauth">
              <HiOutlineKey />
              <span>{user?.googleLogin ? 'Google Account' : 'Password Vault'}</span>
            </span>
          </div>
        </div>

        {/* Profile Details Section */}
        <form onSubmit={handleSaveProfile}>
          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <HiOutlineUser />
              <span>Personal Information</span>
            </div>

            <div className="form-group-custom">
              <label className="input-label-custom" htmlFor="profile-name">
                Full Name
              </label>
              <div className="input-wrapper-custom">
                <HiOutlineUser className="input-icon-custom" />
                <input
                  id="profile-name"
                  type="text"
                  className="input-field-custom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={50}
                  required
                />
              </div>
            </div>

            <div className="form-group-custom">
              <label className="input-label-custom" htmlFor="profile-email">
                Email Address (Read-only)
              </label>
              <div className="input-wrapper-custom">
                <HiOutlineEnvelope className="input-icon-custom" />
                <input
                  id="profile-email"
                  type="email"
                  className="input-field-custom"
                  value={user?.email || ''}
                  disabled
                  readOnly
                />
                <span className="input-pill-badge">
                  <HiOutlineCheckBadge />
                  <span>{user?.isVerified ? 'Verified' : 'Pending'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Security & 2FA Configuration Section */}
          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <HiOutlineShieldCheck />
              <span>Security & Protection</span>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-title">Always Require OTP on Login</div>
                <div className="toggle-desc">
                  Demand a single-use verification code sent to your email on every login attempt.
                </div>
              </div>
              <label className="switch-label" htmlFor="otp-toggle">
                <input
                  id="otp-toggle"
                  type="checkbox"
                  checked={alwaysRequireOtp}
                  onChange={(e) => setAlwaysRequireOtp(e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <button
              type="submit"
              className="btn-save-profile"
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <HiOutlineArrowPath style={{ animation: 'fast-spin 0.6s linear infinite' }} />
                  <span>Saving Changes...</span>
                </>
              ) : hasChanges ? (
                <>
                  <HiOutlineCheck />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck />
                  <span>Up to Date</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Vault Telemetry Metadata Grid */}
        <div className="meta-grid">
          <div className="meta-card">
            <div className="meta-card-header">
              <span className="meta-card-label">
                <HiOutlineKey />
                <span>Secure ID</span>
              </span>
              <button
                type="button"
                className="copy-mini-btn"
                onClick={handleCopyId}
                title="Copy Secure ID"
              >
                {copiedId ? (
                  <HiOutlineCheck style={{ color: 'var(--color-vault-400)' }} />
                ) : (
                  <HiOutlineClipboardDocument />
                )}
              </button>
            </div>
            <div className="meta-card-value">
              {user?.id ? `${user.id.slice(0, 10)}...${user.id.slice(-6)}` : '—'}
            </div>
          </div>

          <div className="meta-card">
            <div className="meta-card-header">
              <span className="meta-card-label">
                <HiOutlineCalendar />
                <span>Member Since</span>
              </span>
            </div>
            <div className="meta-card-value">
              {formatDate(user?.createdAt)}
            </div>
          </div>

          <div className="meta-card">
            <div className="meta-card-header">
              <span className="meta-card-label">
                <HiOutlineClock />
                <span>Last Active</span>
              </span>
            </div>
            <div className="meta-card-value">
              {formatDateTime(user?.lastLogin)}
            </div>
          </div>

          <div className="meta-card">
            <div className="meta-card-header">
              <span className="meta-card-label">
                <HiOutlineShieldCheck />
                <span>Account Tier</span>
              </span>
            </div>
            <div className="meta-card-value" style={{ color: 'var(--color-vault-400)' }}>
              Standard Vault
            </div>
          </div>
        </div>

        {/* Device & Session Logout Actions */}
        <div className="dashboard-actions">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="btn-logout btn-logout-device"
          >
            <HiOutlineArrowRightOnRectangle />
            <span>{isLoggingOut ? 'Logging out...' : 'Logout this device'}</span>
          </button>

          <button
            type="button"
            onClick={handleLogoutAll}
            disabled={isLoggingOutAll}
            className="btn-logout btn-logout-all"
          >
            <HiOutlineArrowRightOnRectangle />
            <span>{isLoggingOutAll ? 'Terminating all sessions...' : 'Log out all sessions'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
