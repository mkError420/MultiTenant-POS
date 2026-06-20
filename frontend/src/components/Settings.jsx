import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function Settings() {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userObj.role === 'super_admin';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_rate: '10.00',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = isSuperAdmin ? `${API_BASE_URL}/auth/me` : `${API_BASE_URL}/shops/my-shop`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(isSuperAdmin ? 'Failed to retrieve account settings.' : 'Failed to retrieve shop settings.');
      }
      const data = await response.json();
      
      if (isSuperAdmin) {
        setFormData({
          name: data.name || '',
          email: data.email || '',
          phone: '',
          address: '',
          tax_rate: '10.00',
          password: '',
          confirmPassword: ''
        });
      } else {
        setFormData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          tax_rate: data.tax_rate !== undefined ? data.tax_rate : '10.00',
          password: '',
          confirmPassword: ''
        });
      }
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      triggerAlert('error', isSuperAdmin ? 'Name and email are required.' : 'Shop name and email are required.');
      return;
    }

    if (isSuperAdmin && formData.password) {
      if (formData.password.length < 6) {
        triggerAlert('error', 'Password must be at least 6 characters long.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        triggerAlert('error', 'Passwords do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url = isSuperAdmin ? `${API_BASE_URL}/auth/me` : `${API_BASE_URL}/shops/my-shop`;
      
      const bodyData = isSuperAdmin 
        ? { name: formData.name, email: formData.email, password: formData.password || undefined }
        : { name: formData.name, email: formData.email, phone: formData.phone, address: formData.address, tax_rate: formData.tax_rate };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || (isSuperAdmin ? 'Failed to update account details.' : 'Failed to update shop details.'));

      if (isSuperAdmin && resData.token && resData.user) {
        localStorage.setItem('token', resData.token);
        localStorage.setItem('user', JSON.stringify(resData.user));
      }

      triggerAlert('success', isSuperAdmin ? 'Account settings saved successfully!' : 'Shop settings saved successfully!');
      
      // Update local storage token values if necessary, or let it reload
      // Trigger a page refresh to update the global header brand name
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${
          alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          {isSuperAdmin ? 'Account Settings' : 'Shop Settings'}
        </h2>
        <p className="text-sm text-slate-500">
          {isSuperAdmin 
            ? 'Configure profile details and system administrator credentials' 
            : 'Configure profile details, invoice labels, and shop contact cards'}
        </p>
      </div>

      {/* Main Settings Form Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              {isSuperAdmin ? 'Administrator Full Name *' : 'Shop Display Name *'}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              {isSuperAdmin ? 'Administrator Email *' : 'Official Shop Email *'}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
            />
          </div>

          {!isSuperAdmin ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contact Phone number
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Store Physical Address
                </label>
                <textarea
                  name="address"
                  rows="3"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 123 Main Street, Suite 400"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sales Tax Rate (%) *
                </label>
                <input
                  type="number"
                  name="tax_rate"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.tax_rate}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 10.00"
                />
              </div>
            </>
          ) : (
            <>
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-1">Change Password</h3>
                <p className="text-xs text-slate-400 mb-4">Leave blank if you do not want to change your password.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Must match new password"
                />
              </div>
            </>
          )}

          {/* Action button */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-6 rounded-xl text-sm shadow-md transition-colors flex items-center space-x-2"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
