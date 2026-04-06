import { useAuth } from '../context/AuthContext';
import { HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', background: '#090a0f', color: 'white' }}>
      <div style={{ padding: '2rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#22c55e' }}>Welcome Back!</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', textAlign: 'left', background: 'rgba(0, 0, 0, 0.2)', padding: '1.5rem', borderRadius: '8px' }}>
          <div>
            <p style={{ color: '#a0a0b0', fontSize: '0.875rem', marginBottom: '0.25rem' }}>User ID</p>
            <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#fff' }}>{user?.id}</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="btn-primary" 
          style={{ width: '100%', background: '#dc2626', border: '1px solid #dc2626', gap: '0.5rem', justifyContent: 'center' }}
        >
          <HiOutlineArrowRightOnRectangle />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
