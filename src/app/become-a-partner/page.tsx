// app/become-a-partner/page.tsx
// Partner information and contact page

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function BecomeAPartnerPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    website: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Create mailto link with form data
    const subject = encodeURIComponent(`Partnership Inquiry from ${formData.company || formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n` +
      `Company: ${formData.company}\n` +
      `Website: ${formData.website}\n\n` +
      `Message:\n${formData.message}`
    );

    window.location.href = `mailto:support@divinitycoin.com?subject=${subject}&body=${body}`;

    setLoading(false);
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900">
              Become a <span className="text-primary-600">DivinityCoin</span> Partner
            </h1>
            <p className="mt-6 text-xl text-neutral-600 leading-relaxed">
              Integrate DivinityCoin into your platform and offer your users a seamless way
              to fund creators and projects. Join our growing network of partner platforms.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-neutral-900 text-center mb-16">
            Why Partner with DivinityCoin?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  New Revenue Stream
                </h3>
                <p className="text-neutral-600">
                  Accept DivinityCoin credits as payment on your platform, expanding how users can fund projects and creators.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Easy Integration
                </h3>
                <p className="text-neutral-600">
                  Our simple API makes integration straightforward. We provide comprehensive documentation and support.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Secure & Reliable
                </h3>
                <p className="text-neutral-600">
                  Enterprise-grade security with encrypted communications, rate limiting, and comprehensive audit logging.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-neutral-900 text-center mb-16">
            How Integration Works
          </h2>

          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">Apply for Partnership</h3>
                <p className="text-neutral-600">
                  Fill out the contact form below with your platform details. Our team will review your application
                  and reach out within 2-3 business days.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">Technical Onboarding</h3>
                <p className="text-neutral-600">
                  Once approved, we'll provide you with API credentials, documentation, and a dedicated VPN connection
                  for secure communication between our systems.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">Integrate Our API</h3>
                <p className="text-neutral-600">
                  Use our REST API to validate and redeem credit codes, place holds on credits for pledges,
                  and manage user balances on your platform.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">Go Live</h3>
                <p className="text-neutral-600">
                  After testing in our sandbox environment, you're ready to go live. We'll monitor the integration
                  and provide ongoing support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">
                Powerful API Features
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <svg className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-neutral-900">Code Validation & Redemption</h4>
                    <p className="text-neutral-600 mt-1">Validate credit codes and redeem them to add funds to user accounts.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <svg className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-neutral-900">Credit Holds for Pledges</h4>
                    <p className="text-neutral-600 mt-1">Place holds on credits for crowdfunding pledges, then capture or release based on project outcome.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <svg className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-neutral-900">Balance Management</h4>
                    <p className="text-neutral-600 mt-1">Query user balances including available credits and active holds.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <svg className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-neutral-900">Webhooks</h4>
                    <p className="text-neutral-600 mt-1">Receive real-time notifications for important events like refunds and code revocations.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-2xl p-8 text-sm font-mono text-neutral-300 overflow-x-auto">
              <div className="text-neutral-500 mb-4"># Redeem a credit code</div>
              <div>
                <span className="text-green-400">POST</span> /internal/validate
              </div>
              <div className="mt-4 text-neutral-400">
{`{
  "code": "XXXX-XXXX-XXXX-XXXX",
  "platformUserId": "user_123",
  "email": "user@example.com"
}`}
              </div>
              <div className="mt-6 text-neutral-500"># Response</div>
              <div className="mt-2 text-neutral-400">
{`{
  "success": true,
  "amount": 50.00,
  "newBalance": 150.00
}`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-24 bg-neutral-50" id="contact">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900">
              Get in Touch
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Interested in becoming a partner? Fill out the form below and we'll be in touch soon.
            </p>
          </div>

          {submitted ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Thank You!
                </h3>
                <p className="text-neutral-600">
                  Your email client should have opened. If not, please email us directly at{' '}
                  <a href="mailto:support@divinitycoin.com" className="text-primary-600 hover:underline">
                    support@divinitycoin.com
                  </a>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-neutral-700 mb-2">
                        Company/Platform Name
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                        placeholder="Acme Inc"
                      />
                    </div>
                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-neutral-700 mb-2">
                        Website URL
                      </label>
                      <input
                        type="url"
                        id="website"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-neutral-700 mb-2">
                      Tell Us About Your Platform *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition resize-none"
                      placeholder="Describe your platform, how you'd use DivinityCoin, and any questions you have..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <p className="text-sm text-neutral-500">
                      Or email us directly at{' '}
                      <a href="mailto:support@divinitycoin.com" className="text-primary-600 hover:underline">
                        support@divinitycoin.com
                      </a>
                    </p>
                    <Button type="submit" size="lg" disabled={loading}>
                      {loading ? 'Sending...' : 'Send Inquiry'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
