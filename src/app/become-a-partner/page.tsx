// app/become-a-partner/page.tsx
// Partner application form

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

interface FormData {
  // Contact Info
  contactName: string;
  contactEmail: string;
  contactPhone: string;

  // Business Info
  businessName: string;
  businessType: string;
  taxId: string;

  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;

  // Platform Info
  websiteUrl: string;
  platformDescription: string;
  expectedMonthlyVolume: string;

  // Agreement
  agreeToTerms: boolean;
}

export default function BecomeAPartnerPage() {
  const [formData, setFormData] = useState<FormData>({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    businessName: '',
    businessType: 'llc',
    taxId: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    websiteUrl: '',
    platformDescription: '',
    expectedMonthlyVolume: '',
    agreeToTerms: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partners/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit application');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-50 py-24">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-4">
                Application Submitted!
              </h1>
              <p className="text-lg text-neutral-600 mb-8">
                Thank you for your interest in becoming a DivinityCoin partner.
                Our team will review your application and contact you within 2-3 business days.
              </p>
              <p className="text-neutral-500">
                Check your email at <strong>{formData.contactEmail}</strong> for a confirmation.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900">
            Become a <span className="text-primary-600">Partner</span>
          </h1>
          <p className="mt-6 text-xl text-neutral-600">
            Join our network of platforms and offer DivinityCoin credits to your users.
          </p>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-8">

                {/* Contact Information */}
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-6 pb-2 border-b">
                    Contact Information
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="contactName" className="block text-sm font-medium text-neutral-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="contactName"
                        name="contactName"
                        required
                        value={formData.contactName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label htmlFor="contactEmail" className="block text-sm font-medium text-neutral-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="contactEmail"
                        name="contactEmail"
                        required
                        value={formData.contactEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="john@company.com"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="contactPhone" className="block text-sm font-medium text-neutral-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="contactPhone"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Business Information */}
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-6 pb-2 border-b">
                    Business Information
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="businessName" className="block text-sm font-medium text-neutral-700 mb-2">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        id="businessName"
                        name="businessName"
                        required
                        value={formData.businessName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="Acme Platforms Inc."
                      />
                    </div>
                    <div>
                      <label htmlFor="businessType" className="block text-sm font-medium text-neutral-700 mb-2">
                        Business Type *
                      </label>
                      <select
                        id="businessType"
                        name="businessType"
                        required
                        value={formData.businessType}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                      >
                        <option value="llc">LLC</option>
                        <option value="corporation">Corporation</option>
                        <option value="partnership">Partnership</option>
                        <option value="sole_proprietor">Sole Proprietor</option>
                        <option value="nonprofit">Non-Profit</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="taxId" className="block text-sm font-medium text-neutral-700 mb-2">
                        Tax ID / EIN *
                      </label>
                      <input
                        type="text"
                        id="taxId"
                        name="taxId"
                        required
                        value={formData.taxId}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="XX-XXXXXXX"
                      />
                      <p className="mt-1 text-sm text-neutral-500">
                        Your Employer Identification Number (EIN) or Tax ID
                      </p>
                    </div>
                  </div>
                </div>

                {/* Business Address */}
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-6 pb-2 border-b">
                    Business Address
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="addressLine1" className="block text-sm font-medium text-neutral-700 mb-2">
                        Address Line 1 *
                      </label>
                      <input
                        type="text"
                        id="addressLine1"
                        name="addressLine1"
                        required
                        value={formData.addressLine1}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label htmlFor="addressLine2" className="block text-sm font-medium text-neutral-700 mb-2">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        id="addressLine2"
                        name="addressLine2"
                        value={formData.addressLine2}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-neutral-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          required
                          value={formData.city}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="New York"
                        />
                      </div>
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-neutral-700 mb-2">
                          State / Province *
                        </label>
                        <input
                          type="text"
                          id="state"
                          name="state"
                          required
                          value={formData.state}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="NY"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="zipCode" className="block text-sm font-medium text-neutral-700 mb-2">
                          ZIP / Postal Code *
                        </label>
                        <input
                          type="text"
                          id="zipCode"
                          name="zipCode"
                          required
                          value={formData.zipCode}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="10001"
                        />
                      </div>
                      <div>
                        <label htmlFor="country" className="block text-sm font-medium text-neutral-700 mb-2">
                          Country *
                        </label>
                        <select
                          id="country"
                          name="country"
                          required
                          value={formData.country}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="GB">United Kingdom</option>
                          <option value="AU">Australia</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platform Information */}
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-6 pb-2 border-b">
                    Platform Information
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="websiteUrl" className="block text-sm font-medium text-neutral-700 mb-2">
                        Website URL *
                      </label>
                      <input
                        type="url"
                        id="websiteUrl"
                        name="websiteUrl"
                        required
                        value={formData.websiteUrl}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="https://yourplatform.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="platformDescription" className="block text-sm font-medium text-neutral-700 mb-2">
                        Platform Description *
                      </label>
                      <textarea
                        id="platformDescription"
                        name="platformDescription"
                        required
                        rows={4}
                        value={formData.platformDescription}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                        placeholder="Describe your platform, what you do, and how you plan to use DivinityCoin..."
                      />
                    </div>
                    <div>
                      <label htmlFor="expectedMonthlyVolume" className="block text-sm font-medium text-neutral-700 mb-2">
                        Expected Monthly Transaction Volume
                      </label>
                      <select
                        id="expectedMonthlyVolume"
                        name="expectedMonthlyVolume"
                        value={formData.expectedMonthlyVolume}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                      >
                        <option value="">Select an estimate</option>
                        <option value="under_1k">Under $1,000</option>
                        <option value="1k_10k">$1,000 - $10,000</option>
                        <option value="10k_50k">$10,000 - $50,000</option>
                        <option value="50k_100k">$50,000 - $100,000</option>
                        <option value="over_100k">Over $100,000</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="bg-neutral-50 p-6 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleChange}
                      required
                      className="mt-1 w-5 h-5 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-700">
                      I agree to the DivinityCoin{' '}
                      <a href="/terms" className="text-primary-600 hover:underline" target="_blank">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" className="text-primary-600 hover:underline" target="_blank">
                        Privacy Policy
                      </a>
                      . I confirm that all information provided is accurate and I am authorized to act on behalf of this business.
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" size="lg" disabled={loading || !formData.agreeToTerms}>
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
