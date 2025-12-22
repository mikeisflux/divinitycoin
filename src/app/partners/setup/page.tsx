// app/partners/setup/page.tsx
// Partner multi-step onboarding wizard

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type OnboardingStep = 'password' | 'company' | 'banking' | 'complete';

interface PartnerInfo {
  name: string;
  email: string;
  contactName: string;
  website: string;
  description: string;
  currentStep: number;
}

interface FormData {
  password: string;
  confirmPassword: string;
  contactName: string;
  website: string;
  description: string;
  paymentMethod: 'ach' | 'wire' | 'paypal';
  bankName: string;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  confirmAccountNumber: string;
  paypalEmail: string;
}

function SetupWizard() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('password');
  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmPassword: '',
    contactName: '',
    website: '',
    description: '',
    paymentMethod: 'ach',
    bankName: '',
    bankRoutingNumber: '',
    bankAccountNumber: '',
    confirmAccountNumber: '',
    paypalEmail: '',
  });

  const token = searchParams.get('token');

  const steps: { id: OnboardingStep; label: string; number: number }[] = [
    { id: 'password', label: 'Create Password', number: 1 },
    { id: 'company', label: 'Company Details', number: 2 },
    { id: 'banking', label: 'Payout Setup', number: 3 },
    { id: 'complete', label: 'Complete', number: 4 },
  ];

  useEffect(() => {
    if (!token) {
      setError('Invalid setup link. Please contact support.');
      setLoading(false);
      return;
    }
    verifyToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/partners/setup/verify?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setPartnerInfo(data);
        setFormData(prev => ({
          ...prev,
          contactName: data.contactName || '',
          website: data.website || '',
          description: data.description || '',
        }));
        // Determine current step based on saved progress
        if (data.currentStep >= 3) {
          setCurrentStep('banking');
        } else if (data.currentStep >= 2) {
          setCurrentStep('company');
        } else {
          setCurrentStep('password');
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid or expired setup link');
      }
    } catch {
      setError('Failed to verify setup link');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (): boolean => {
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasLowercase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password must include uppercase, lowercase, and numbers');
      return false;
    }
    return true;
  };

  const validateBanking = (): boolean => {
    if (formData.paymentMethod === 'paypal') {
      if (!formData.paypalEmail || !formData.paypalEmail.includes('@')) {
        setError('Please enter a valid PayPal email address');
        return false;
      }
    } else {
      if (!formData.bankName.trim()) {
        setError('Please enter your bank name');
        return false;
      }
      if (!/^\d{9}$/.test(formData.bankRoutingNumber)) {
        setError('Routing number must be exactly 9 digits');
        return false;
      }
      if (!/^\d{4,17}$/.test(formData.bankAccountNumber)) {
        setError('Account number must be between 4 and 17 digits');
        return false;
      }
      if (formData.bankAccountNumber !== formData.confirmAccountNumber) {
        setError('Account numbers do not match');
        return false;
      }
    }
    return true;
  };

  const handlePasswordSubmit = async () => {
    setError('');
    if (!validatePassword()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/partners/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          step: 'password',
          password: formData.password,
        }),
      });

      if (response.ok) {
        setCurrentStep('company');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save password');
      }
    } catch {
      setError('Failed to save password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompanySubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/partners/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          step: 'company',
          contactName: formData.contactName,
          website: formData.website,
          description: formData.description,
        }),
      });

      if (response.ok) {
        setCurrentStep('banking');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save company details');
      }
    } catch {
      setError('Failed to save company details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBankingSubmit = async () => {
    setError('');
    if (!validateBanking()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/partners/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          step: 'banking',
          paymentMethod: formData.paymentMethod,
          bankName: formData.bankName,
          bankRoutingNumber: formData.bankRoutingNumber,
          bankAccountNumber: formData.bankAccountNumber,
          paypalEmail: formData.paypalEmail,
        }),
      });

      if (response.ok) {
        setCurrentStep('complete');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save banking details');
      }
    } catch {
      setError('Failed to save banking details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !partnerInfo) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 mb-2">Setup Link Invalid</h1>
          <p className="text-neutral-600 mb-6">{error}</p>
          <Link
            href="/partners/login"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-600">D</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Complete Your Setup</h1>
          <p className="text-neutral-600 mt-2">Welcome, {partnerInfo?.name}</p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCurrent = step.id === currentStep;
              const isComplete = steps.findIndex(s => s.id === currentStep) > index;
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        isComplete
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-200 text-neutral-500'
                      }`}
                    >
                      {isComplete ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </div>
                    <span className={`text-xs mt-2 ${isCurrent ? 'text-primary-600 font-medium' : 'text-neutral-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 w-16 mx-2 ${
                        isComplete ? 'bg-green-500' : 'bg-neutral-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-xl p-8">
          {/* Step 1: Password */}
          {currentStep === 'password' && (
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Create Your Password</h2>
              <p className="text-neutral-600 mb-6">Set up secure access to your partner portal.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={partnerInfo?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Create a strong password"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Must be at least 8 characters with uppercase, lowercase, and numbers
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm your password"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handlePasswordSubmit}
                disabled={submitting}
                className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* Step 2: Company Details */}
          {currentStep === 'company' && (
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Company Details</h2>
              <p className="text-neutral-600 mb-6">Review and update your business information.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={partnerInfo?.name || ''}
                    disabled
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Primary Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourcompany.com"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Business Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Briefly describe your platform..."
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                  />
                </div>
              </div>

              <button
                onClick={handleCompanySubmit}
                disabled={submitting}
                className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* Step 3: Banking */}
          {currentStep === 'banking' && (
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Payout Setup</h2>
              <p className="text-neutral-600 mb-6">
                Add your banking details to receive settlement payments. Your information is encrypted and stored securely.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Bank-Level Security</p>
                    <p className="text-sm text-blue-700">
                      Your banking information is encrypted with AES-256 encryption and stored securely.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'ach', label: 'ACH Transfer', icon: '🏦' },
                      { value: 'wire', label: 'Wire Transfer', icon: '💸' },
                      { value: 'paypal', label: 'PayPal', icon: '💳' },
                    ].map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: method.value as 'ach' | 'wire' | 'paypal' })}
                        className={`p-3 rounded-lg border-2 text-center transition ${
                          formData.paymentMethod === method.value
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <span className="text-2xl">{method.icon}</span>
                        <p className="text-sm font-medium mt-1">{method.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.paymentMethod === 'paypal' ? (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      PayPal Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.paypalEmail}
                      onChange={(e) => setFormData({ ...formData, paypalEmail: e.target.value })}
                      placeholder="payments@yourcompany.com"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        placeholder="Chase, Bank of America, etc."
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Routing Number (ABA)
                      </label>
                      <input
                        type="text"
                        value={formData.bankRoutingNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                          setFormData({ ...formData, bankRoutingNumber: value });
                        }}
                        placeholder="9 digits"
                        maxLength={9}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Account Number
                      </label>
                      <input
                        type="password"
                        value={formData.bankAccountNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 17);
                          setFormData({ ...formData, bankAccountNumber: value });
                        }}
                        placeholder="Your account number"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Confirm Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.confirmAccountNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 17);
                          setFormData({ ...formData, confirmAccountNumber: value });
                        }}
                        placeholder="Re-enter account number"
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleBankingSubmit}
                disabled={submitting}
                className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving Securely...' : 'Complete Setup'}
              </button>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">You&apos;re All Set!</h2>
              <p className="text-neutral-600 mb-8">
                Your account is ready. You can now access your partner dashboard to generate API keys and start integrating.
              </p>

              <div className="bg-neutral-50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-neutral-900 mb-4">Next Steps:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">1</span>
                    <span className="text-neutral-600">Generate your API keys in the dashboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">2</span>
                    <span className="text-neutral-600">Review the integration documentation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">3</span>
                    <span className="text-neutral-600">Test with sandbox credentials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">4</span>
                    <span className="text-neutral-600">Go live and start earning!</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/partners/login"
                className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SetupFallback() {
  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

export default function PartnerOnboardingPage() {
  return (
    <Suspense fallback={<SetupFallback />}>
      <SetupWizard />
    </Suspense>
  );
}
