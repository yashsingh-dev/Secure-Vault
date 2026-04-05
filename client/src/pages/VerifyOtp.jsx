//TODO: Solve bug of reset timer on reload page

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineArrowRight } from 'react-icons/hi2';
import { AuthAPI } from '../api/auth.api';
import { useToast } from '../context/ToastContext';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const rememberMe = location.state?.rememberMe || false;

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef([]);
  const toast = useToast();

  // Redirect if accessed directly without state
  useEffect(() => {
    if (!location.state || !location.state.email) {
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const focusInput = useCallback((index) => {
    inputRefs.current[index]?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (error) setError('');

    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance
    if (digit && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        focusInput(index - 1);
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }
    
    setIsVerifying(true);
    try {
      const response = await AuthAPI.verifyOTP({ email, otp: code, rememberMe });
      // toast.success('Login Success');
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (isResending) return;

    setIsResending(true);
    try {
      await AuthAPI.sendOTP({ email });
      toast.success('OTP sent, Please check your email');
      
      setTimer(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      focusInput(0);
    } catch (err) {
      toast.error(err.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : 'your email';

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <div className="page-enter">
      <button 
        type="button" 
        onClick={() => navigate(-1)} 
        className="back-link" 
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <HiOutlineArrowLeft />
        Back
      </button>

      <h1 className="auth-heading">Check your email</h1>
      <p className="auth-subheading">
        We sent a 6-digit verification code to{' '}
        <strong style={{ color: '#c0c0d0' }}>{maskedEmail}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <div className="otp-container">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              className={`otp-input ${digit ? 'filled' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>
        {error && (
          <p className="form-error" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <button 
          type="submit" 
          className="btn-primary" 
          disabled={isVerifying || !isOtpComplete}
        >
          <span>
            {isVerifying && <div className="btn-loader" />}
            Verify code
            {!isVerifying && <HiOutlineArrowRight />}
          </span>
        </button>
      </form>

      <div className="resend-row">
        {timer > 0 ? (
          <p className="resend-text">
            Resend code in <span className="timer">{formatTime(timer)}</span>
          </p>
        ) : (
          <p className="resend-text">
            Didn't receive the code?{' '}
            <button 
              type="button" 
              className="resend-btn" 
              onClick={handleResend}
              disabled={isResending}
              style={isResending ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {isResending ? 'Resending...' : 'Resend'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
