import { forwardRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

// Safely read the reCAPTCHA site key from Vite or CRA environment variables
const RECAPTCHA_SITE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RECAPTCHA_SITE_KEY) ||
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.REACT_APP_RECAPTCHA_SITE_KEY) ||
  '';


/**
 * Reusable Google reCAPTCHA v2 Checkbox Field component
 * Seamlessly matches Secure Vault's dark cybersecurity design theme
 */
const RecaptchaField = forwardRef(function RecaptchaField(
  { onChange, onExpired, error, className = '' },
  ref
) {
  if (!RECAPTCHA_SITE_KEY) {
    return (
      <div
        className="recaptcha-missing-warning"
        style={{
          margin: '1rem 0',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          fontSize: '0.85rem',
          textAlign: 'center'
        }}
      >
        <span>reCAPTCHA site key is missing. Please set <code>VITE_RECAPTCHA_SITE_KEY</code> in <code>.env</code>.</span>
      </div>
    );
  }

  return (
    <div className={`recaptcha-container ${className}`} style={{ margin: '1.25rem 0', width: '100%' }}>
      <div
        className="recaptcha-inner"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '78px',
          borderRadius: '6px',
          overflow: 'hidden'
        }}
      >
        <ReCAPTCHA
          ref={ref}
          sitekey={RECAPTCHA_SITE_KEY}
          onChange={onChange}
          onExpired={onExpired}
          theme="dark"
        />
      </div>
      {error && (
        <p
          className="form-error"
          style={{
            marginTop: '0.5rem',
            textAlign: 'center',
            fontSize: '0.825rem'
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default RecaptchaField;
