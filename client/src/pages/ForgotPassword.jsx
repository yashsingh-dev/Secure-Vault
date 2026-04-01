import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiOutlineEnvelope,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
} from 'react-icons/hi2';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    // API call will be added later
    console.log('OTP requested for:', email);
    navigate('/verify-otp', { state: { email } });
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

        <button type="submit" className="btn-primary">
          <span>
            Send verification code
            <HiOutlineArrowRight />
          </span>
        </button>
      </form>
    </div>
  );
}
