// app/admin/partners/[id]/edit/page.tsx
// Partner edit page

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface Partner {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  website: string | null;
  vpnIp: string | null;
  webhookUrl: string | null;
  description: string | null;
}

export default function EditPartnerPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    website: '',
    vpnIp: '',
    webhookUrl: '',
    description: '',
    status: 'PENDING',
  });

  useEffect(() => {
    fetchPartner();
  }, [partnerId]);

  async function fetchPartner() {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`);
      if (response.ok) {
        const data = await response.json();
        const partner: Partner = data.partner;
        setFormData({
          name: partner.name || '',
          contactName: partner.contactName || '',
          contactEmail: partner.contactEmail || '',
          website: partner.website || '',
          vpnIp: partner.vpnIp || '',
          webhookUrl: partner.webhookUrl || '',
          description: partner.description || '',
          status: partner.status || 'PENDING',
        });
      } else if (response.status === 404) {
        router.push('/admin/partners');
      }
    } catch (err) {
      console.error('Failed to fetch partner:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save partner' });
        return;
      }

      setMessage({ type: 'success', text: 'Partner updated successfully!' });
      setTimeout(() => {
        router.push(`/admin/partners/${partnerId}`);
      }, 1000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save partner' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Loading..." description="Please wait">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Edit Partner"
      description="Update partner information"
      actions={
        <Link
          href={`/admin/partners/${partnerId}`}
          className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-300 transition"
        >
          Cancel
        </Link>
      }
    >
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">
                Partner Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-neutral-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </div>

            <div>
              <label htmlFor="contactName" className="block text-sm font-medium text-neutral-700 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-neutral-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                id="contactEmail"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-neutral-700 mb-1">
                Website
              </label>
              <input
                type="url"
                id="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="vpnIp" className="block text-sm font-medium text-neutral-700 mb-1">
                VPN IP Address
              </label>
              <input
                type="text"
                id="vpnIp"
                value={formData.vpnIp}
                onChange={(e) => setFormData({ ...formData, vpnIp: e.target.value })}
                placeholder="10.10.0.2"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="webhookUrl" className="block text-sm font-medium text-neutral-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                id="webhookUrl"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://api.partner.com/webhooks/divinitycoin"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-neutral-200">
            <Link
              href={`/admin/partners/${partnerId}`}
              className="px-6 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 transition"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
