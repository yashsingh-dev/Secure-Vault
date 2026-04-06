import { useAuth } from '../context/AuthContext';
import { HiOutlineArrowRightOnRectangle, HiOutlineUser, HiOutlineShieldCheck } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout, logoutAll } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    navigate('/login');
  };

  return (
    <div className="dashboard-page page-enter">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <div className="dashboard-icon">
            <HiOutlineShieldCheck />
          </div>
          <h1 className="dashboard-title">Vault Dashboard</h1>
          <p className="dashboard-subtitle">Manage your secure session</p>
        </div>
        
        <div className="user-info-box">
          <div className="info-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <HiOutlineUser style={{ color: '#55556e', fontSize: '0.875rem' }} />
              <span className="info-label">Secure ID</span>
            </div>
            <p className="info-value">{user?.id}</p>
          </div>
        </div>

        <div className="dashboard-actions">
          <button 
            onClick={handleLogout}
            className="btn-logout btn-logout-device"
          >
            <HiOutlineArrowRightOnRectangle />
            <span>Logout this device</span>
          </button>
          
          <button 
            onClick={handleLogoutAll}
            className="btn-logout btn-logout-all"
          >
            <HiOutlineArrowRightOnRectangle />
            <span>Log out all sessions</span>
          </button>
        </div>
      </div>
    </div>
  );
}
