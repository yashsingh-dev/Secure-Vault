import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserAPI } from '../api/user.api';
import { AuthAPI } from '../api/auth.api';
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
  HiOutlineComputerDesktop,
  HiOutlineDevicePhoneMobile,
  HiOutlineDeviceTablet,
  HiOutlineGlobeAlt,
  HiOutlineTrash,
  HiOutlineFingerPrint,
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

  // Active Sessions State
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  // Sync state when auth user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAlwaysRequireOtp(Boolean(user.settings?.alwaysRequireOtp));
    }
  }, [user]);

  // Ensure dashboard always uses dark theme
  useEffect(() => {
    document.documentElement.classList.remove('light');
  }, []);

  // Eagerly refresh latest user profile and active sessions on dashboard visit
  const fetchSessions = async (isManual = false) => {
    try {
      if (isManual) setIsRefreshingSessions(true);
      else setIsLoadingSessions(true);

      const res = await AuthAPI.getSessions();
      if (res?.payload?.sessions) {
        setSessions(res.payload.sessions);
      }
    } catch (err) {
      console.warn('Failed to load active sessions:', err);
    } finally {
      setIsLoadingSessions(false);
      setIsRefreshingSessions(false);
    }
  };

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
    fetchSessions();

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

  const handleRevokeSession = async (sessionId, isCurrent) => {
    try {
      setRevokingSessionId(sessionId);
      const res = await AuthAPI.revokeSession(sessionId);

      if (res?.payload?.isCurrent || isCurrent) {
        toast.info('Current session terminated. Signing out...');
        await logout();
        navigate('/login');
        return;
      }

      toast.success(res?.message || 'Session revoked successfully.');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      toast.error(err.message || 'Failed to revoke session. Please try again.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Active now';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now - d) / 1000);

      if (diffSecs < 60) return 'Active just now';
      if (diffSecs < 3600) {
        const mins = Math.floor(diffSecs / 60);
        return `${mins}m ago`;
      }
      if (diffSecs < 86400) {
        const hours = Math.floor(diffSecs / 3600);
        return `${hours}h ago`;
      }
      const days = Math.floor(diffSecs / 86400);
      if (days < 7) {
        return `${days}d ago`;
      }
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Active recently';
    }
  };

  const getDeviceIcon = (deviceType) => {
    const type = (deviceType || '').toLowerCase();
    if (type.includes('mobile') || type.includes('phone') || type.includes('ios') || type.includes('android')) {
      return <HiOutlineDevicePhoneMobile />;
    }
    if (type.includes('tablet') || type.includes('pad')) {
      return <HiOutlineDeviceTablet />;
    }
    return <HiOutlineComputerDesktop />;
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

        {/* Active Sessions & Devices Section */}
        <div className="dashboard-section">
          <div className="sessions-header-wrapper">
            <div className="sessions-title-group">
              <HiOutlineFingerPrint />
              <span>Active Sessions & Devices</span>
              {sessions.length > 0 && (
                <span className="sessions-count-badge">
                  {sessions.length} {sessions.length === 1 ? 'Device' : 'Devices'}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-refresh-sessions"
              onClick={() => fetchSessions(true)}
              disabled={isRefreshingSessions || isLoadingSessions}
              title="Refresh active sessions"
            >
              <HiOutlineArrowPath
                style={{
                  animation:
                    isRefreshingSessions || isLoadingSessions
                      ? 'fast-spin 0.6s linear infinite'
                      : 'none',
                }}
              />
            </button>
          </div>

          {isLoadingSessions ? (
            <div className="sessions-loading-state">
              <div className="session-skeleton" />
              <div className="session-skeleton" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="sessions-empty-state">
              No active sessions detected.
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`session-card ${session.isCurrent ? 'session-card-current' : ''}`}
                >
                  <div className="session-info-left">
                    <div className="session-icon-box">
                      {getDeviceIcon(session.device)}
                    </div>
                    <div className="session-details">
                      <div className="session-title-line">
                        <span className="session-device-name">
                          {session.browser || 'Browser'} on {session.os || 'Unknown OS'}
                        </span>
                        {session.id && (
                          <span
                            className="session-id-pill"
                            title={`Full Session ID: ${session.id}\nClick to copy`}
                            onClick={() => {
                              navigator.clipboard.writeText(session.id);
                              toast.info(`Session ID copied: ...${session.id.slice(-6)}`);
                            }}
                          >
                            <HiOutlineKey className="session-id-pill-icon" />
                            <span>...{session.id.slice(-6)}</span>
                          </span>
                        )}
                        {session.isCurrent && (
                          <span className="session-current-pill">
                            <span className="session-current-dot" />
                            Current Device
                          </span>
                        )}
                      </div>
                      <div className="session-meta-line">
                        <span className="session-meta-item">
                          <HiOutlineGlobeAlt />
                          <span className="session-ip-mono">{session.ip}</span>
                        </span>
                        <span className="session-meta-item">
                          <HiOutlineClock />
                          <span>
                            {session.isCurrent ? 'Active now' : formatRelativeTime(session.lastActive)}
                          </span>
                        </span>
                        <span className="session-meta-item">
                          <HiOutlineCalendar />
                          <span>{formatDate(session.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="session-actions">
                    {session.isCurrent ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="btn-revoke-session"
                        title="Sign out from this device"
                      >
                        <HiOutlineArrowRightOnRectangle />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(session.id, session.isCurrent)}
                        disabled={revokingSessionId === session.id}
                        className="btn-revoke-session"
                        title="Revoke and terminate this device session"
                      >
                        {revokingSessionId === session.id ? (
                          <>
                            <HiOutlineArrowPath style={{ animation: 'fast-spin 0.6s linear infinite' }} />
                            <span>Revoking...</span>
                          </>
                        ) : (
                          <>
                            <HiOutlineTrash />
                            <span>Revoke</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
