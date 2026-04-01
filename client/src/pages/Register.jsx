import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineArrowRight,
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

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
  });
  const [errors, setErrors] = useState({});

  const strength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password]
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Full name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = 'Enter a valid email address';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 8)
      newErrors.password = 'Password must be at least 8 characters';
    if (!form.confirmPassword)
      newErrors.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';
    if (!form.termsAccepted)
      newErrors.termsAccepted = 'You must accept the terms';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    console.log('Register submitted:', form);
  };

  return (
    <div className="page-enter">
      <h1 className="auth-heading">Create your vault</h1>
      <p className="auth-subheading">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-name">
            Full name
          </label>
          <div className="input-wrapper">
            <HiOutlineUser className="input-icon" />
            <input
              id="register-name"
              className="form-input"
              type="text"
              name="name"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
            />
          </div>
          {errors.name && <p className="form-error">{errors.name}</p>}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-email">
            Email address
          </label>
          <div className="input-wrapper">
            <HiOutlineEnvelope className="input-icon" />
            <input
              id="register-email"
              className="form-input"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="form-error">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-password">
            Password
          </label>
          <div className="input-wrapper">
            <HiOutlineLockClosed className="input-icon" />
            <input
              id="register-password"
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

          {/* Strength indicator */}
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

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-confirm">
            Confirm password
          </label>
          <div className="input-wrapper">
            <HiOutlineLockClosed className="input-icon" />
            <input
              id="register-confirm"
              className="form-input"
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              placeholder="Re-enter your password"
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

        {/* Terms */}
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="register-terms"
            className="checkbox-input"
            name="termsAccepted"
            checked={form.termsAccepted}
            onChange={handleChange}
          />
          <label htmlFor="register-terms" className="checkbox-label">
            I agree to the{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Privacy Policy
            </a>
          </label>
        </div>
        {errors.termsAccepted && (
          <p className="form-error" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
            {errors.termsAccepted}
          </p>
        )}

        {/* Submit */}
        <button type="submit" className="btn-primary">
          <span>
            Create your vault
            <HiOutlineArrowRight />
          </span>
        </button>
      </form>
    </div>
  );
}
