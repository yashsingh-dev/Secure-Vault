import { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', className: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', className: 'weak' };
  if (score <= 2) return { level: 2, label: 'Fair', className: 'fair' };
  if (score <= 3) return { level: 3, label: 'Good', className: 'good' };
  return { level: 4, label: 'Strong', className: 'strong' };
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const otp = location.state?.otp || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const strength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 8)
      newErrors.password = 'Password must be at least 8 characters';
    if (!form.confirmPassword)
      newErrors.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    // API call will be added later
    console.log('Password changed:', { email, otp, password: form.password });
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="page-enter" style={{ textAlign: 'center' }}>
        <div className="success-icon">
          <HiOutlineCheckCircle />
        </div>
        <h1 className="auth-heading">Password updated</h1>
        <p className="auth-subheading" style={{ marginBottom: '2rem' }}>
          Your vault password has been successfully reset. You can now sign in
          with your new credentials.
        </p>
        <button
          className="btn-primary"
          onClick={() => navigate('/login')}
        >
          <span>
            Back to sign in
            <HiOutlineArrowRight />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Link to="/forgot-password" className="back-link">
        <HiOutlineArrowLeft />
        Back
      </Link>

      <h1 className="auth-heading">Set new password</h1>
      <p className="auth-subheading">
        Create a strong password for your vault. Make sure it's at least 8
        characters long.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="new-password">
            New password
          </label>
          <div className="input-wrapper">
            <HiOutlineLockClosed className="input-icon" />
            <input
              id="new-password"
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
            </button>
          </div>
          {errors.password && <p className="form-error">{errors.password}</p>}

          {form.password && (
            <div className="password-strength">
              <div className="strength-bars">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`strength-bar ${
                      i <= strength.level ? `active ${strength.className}` : ''
                    }`}
                  />
                ))}
              </div>
              <span className={`strength-text ${strength.className}`}>
                {strength.label} password
              </span>
            </div>
          )}
        </div>

        {/* Confirm */}
        <div className="form-group">
          <label className="form-label" htmlFor="confirm-new-password">
            Confirm new password
          </label>
          <div className="input-wrapper">
            <HiOutlineLockClosed className="input-icon" />
            <input
              id="confirm-new-password"
              className="form-input"
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              placeholder="Re-enter your new password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="form-error">{errors.confirmPassword}</p>
          )}
        </div>

        <button type="submit" className="btn-primary">
          <span>
            Reset password
            <HiOutlineArrowRight />
          </span>
        </button>
      </form>
    </div>
  );
}
