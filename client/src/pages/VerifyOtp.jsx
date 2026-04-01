import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineArrowRight } from 'react-icons/hi2';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }
    // API call will be added later
    console.log('OTP verified:', code);
    navigate('/change-password', { state: { email, otp: code } });
  };

  const handleResend = () => {
    setTimer(RESEND_COOLDOWN);
    setOtp(Array(OTP_LENGTH).fill(''));
    focusInput(0);
    // API call will be added later
    console.log('Resend OTP to:', email);
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : 'your email';

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page-enter">
      <Link to="/forgot-password" className="back-link">
        <HiOutlineArrowLeft />
        Back
      </Link>

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

        <button type="submit" className="btn-primary">
          <span>
            Verify code
            <HiOutlineArrowRight />
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
            <button type="button" className="resend-btn" onClick={handleResend}>
              Resend
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
