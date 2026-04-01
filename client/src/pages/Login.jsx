import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineEnvelope,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineArrowRight,
} from 'react-icons/hi2';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    rememberMe: false,
    termsAccepted: false,
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = 'Enter a valid email address';
    if (!form.password) newErrors.password = 'Password is required';
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
    // API call will be added later
    console.log('Login submitted:', form);
  };

  return (
    <div className="page-enter">
      <h1 className="auth-heading">Welcome back</h1>
      <p className="auth-subheading">
        Don't have an account yet?{' '}
        <Link to="/register">Create one free</Link>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">
            Email address
          </label>
          <div className="input-wrapper">
            <HiOutlineEnvelope className="input-icon" />
            <input
              id="login-email"
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
          <label className="form-label" htmlFor="login-password">
            Password
          </label>
          <div className="input-wrapper">
            <HiOutlineLockClosed className="input-icon" />
            <input
              id="login-password"
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
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
        </div>

        {/* Remember + Forgot */}
        <div className="form-row">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="remember-me"
              className="checkbox-input"
              name="rememberMe"
              checked={form.rememberMe}
              onChange={handleChange}
            />
            <label htmlFor="remember-me" className="checkbox-label">
              Remember me
            </label>
          </div>
          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>
        </div>

        {/* Terms */}
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="login-terms"
            className="checkbox-input"
            name="termsAccepted"
            checked={form.termsAccepted}
            onChange={handleChange}
          />
          <label htmlFor="login-terms" className="checkbox-label">
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
            Sign in to your vault
            <HiOutlineArrowRight />
          </span>
        </button>
      </form>
    </div>
  );
}
