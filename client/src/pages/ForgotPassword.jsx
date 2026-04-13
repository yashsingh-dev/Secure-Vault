import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiOutlineEnvelope,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
} from 'react-icons/hi2';
import { AuthAPI } from '../api/auth.api';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    try {
      await AuthAPI.sendOTP({ email });
      toast.success('Check your email for verification code.');
      navigate('/verify-otp', { state: { email, purpose: 'reset-password' } });
    } catch (err) {
      if (err.message === 'OTP Cool Down') toast.error('Please wait for some time to resend OTP');
      else toast.error(err.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <Link to="/login" className="back-link">
        <HiOutlineArrowLeft />
        Back to login
      </Link>

      <h1 className="auth-heading">Forgot password?</h1>
      <p className="auth-subheading">
        No worries. Enter the email linked to your vault and we'll send you a
        verification code.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="forgot-email">
            Email address
          </label>
          <div className="input-wrapper">
            <HiOutlineEnvelope className="input-icon" />
            <input
              id="forgot-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              autoComplete="email"
            />
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>

        <button type="submit" className="btn-primary" disabled={isLoading}>
          <span>
            {isLoading && <div className="btn-loader" />}
            {isLoading ? 'Sending code...' : 'Send verification code'}
            {!isLoading && <HiOutlineArrowRight />}
          </span>
        </button>
      </form>
    </div>
  );
}
