import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthAPI } from '../api/auth.api.js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { HiOutlineShieldCheck } from 'react-icons/hi2';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  // Prevent duplicate execution in React StrictMode
  const exchangeAttemptedRef = useRef(false);

  useEffect(() => {
    if (exchangeAttemptedRef.current) return;

    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      exchangeAttemptedRef.current = true;
      toast.error('Google sign-in was cancelled or denied.');
      navigate('/login', { replace: true });
      return;
    }

    if (!code) {
      exchangeAttemptedRef.current = true;
      toast.error('No authorization code received from Google.');
      navigate('/login', { replace: true });
      return;
    }

    exchangeAttemptedRef.current = true;

    const handleGoogleAuth = async () => {
      try {
        const response = await AuthAPI.googleLogin(code);

        if (response.payload?.is2FAEnabled) {
          toast.success('Check your email for verification code.');
          navigate('/verify-otp', {
            state: {
              email: response.payload.email,
              rememberMe: response.payload.rememberMe,
              purpose: 'login',
            },
            replace: true,
          });
        } else {
          login(response.payload);
          navigate('/', { replace: true });
        }
      } catch (err) {
        toast.error(err.message || 'Google authentication failed. Please try again.');
        navigate('/login', { replace: true });
      }
    };

    handleGoogleAuth();
  }, [searchParams, navigate, login, toast]);

  return (
    <div className="page-enter" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          color: '#22c55e',
          fontSize: '2rem',
          marginBottom: '1.5rem',
        }}
      >
        <HiOutlineShieldCheck />
      </div>
      <h2 className="auth-heading" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
        Verifying with Google
      </h2>
      <p className="auth-subheading" style={{ marginBottom: '2rem' }}>
        Securing your session and finalizing credentials...
      </p>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="btn-loader fast" style={{ width: '28px', height: '28px' }} />
      </div>
    </div>
  );
}
