// app/admin/gift-cards/generate/page.tsx
// Manual gift card generation page

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

export default function GenerateGiftCardPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    amount: 25,
    email: '',
    sendEmail: true,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const presetAmounts = [10, 25, 50, 100, 250, 500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/gift-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedCode(data.code);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to generate gift card');
      }
    } catch (err) {
      setError('Failed to generate gift card');
    } finally {
      setLoading(false);
    }
  };

  if (generatedCode) {
    return (
      <AdminLayout title="Gift Card Generated" description="Successfully created a new gift card">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Gift Card Created!</h2>
            <p className="text-neutral-600 mb-6">
              Amount: ${formData.amount.toFixed(2)}
            </p>

            <div className="bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-lg p-6 mb-6">
              <p className="text-sm text-neutral-500 mb-2">Gift Card Code</p>
              <p className="text-2xl font-mono font-bold text-neutral-900 tracking-wider">
                {generatedCode}
              </p>
            </div>

            {formData.sendEmail && formData.email && (
              <p className="text-sm text-green-600 mb-6">
                Email sent to {formData.email}
              </p>
            )}

            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                }}
                variant="outline"
              >
                Copy Code
              </Button>
              <Button onClick={() => router.push('/admin/gift-cards')}>
                View All Cards
              </Button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Generate Gift Card" description="Create a new gift card manually">
      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Amount
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {presetAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, amount }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.amount === amount
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">$</span>
                <input
                  type="number"
                  min="5"
                  max="500"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-32 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Recipient Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="recipient@example.com"
              />
            </div>

            {formData.email && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={formData.sendEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, sendEmail: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="sendEmail" className="text-sm text-neutral-700">
                  Send email with code to recipient
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Internal Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                placeholder="Reason for manual generation, etc."
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Gift Card'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/gift-cards')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
