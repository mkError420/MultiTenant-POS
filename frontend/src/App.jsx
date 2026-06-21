import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './components/Dashboard';
import Checkout from './components/Checkout';
import Inventory from './components/Inventory';
import Suppliers from './components/Suppliers';
import Customers from './components/Customers';
import SalesHistory from './components/SalesHistory';
import ManageStaff from './components/ManageStaff';
import Settings from './components/Settings';
import ManageShops from './components/ManageShops';
import SystemUsers from './components/SystemUsers';
import HeldBills from './components/HeldBills';
import OtherCost from './components/OtherCost';
import TotalRevenue from './components/TotalRevenue';
import Wastage from './components/Wastage';

const API_BASE_URL = 'http://localhost:5000/api';

// Decode JWT payload without verifying signature (verification is done server-side)
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// Get the default landing path based on role
function getDefaultPath(role) {
  if (role === 'super_admin') return '/dashboard';
  return '/checkout';
}

export default function App() {
  const [user, setUser] = useState(null);       // null = not logged in
  const [loading, setLoading] = useState(true); // checking stored token on startup
  const [currentPath, setCurrentPath] = useState('/checkout');
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [heldBillsCount, setHeldBillsCount] = useState(0);
  const [resumedHeldBill, setResumedHeldBill] = useState(null);

  // On mount: verify existing token against the backend
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      setLoading(false);
      return;
    }

    // Quick local expiry check first
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp * 1000 <= Date.now()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }

    // Verify the token is accepted by the real backend
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Token rejected by server');
      })
      .then((data) => {
        // Build user object from server response
        const userObj = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          shop_id: data.shop_id,
          shop_name: data.shop_name || 'Global System',
        };
        localStorage.setItem('user', JSON.stringify(userObj));
        setUser(userObj);
        setCurrentPath(getDefaultPath(userObj.role));
      })
      .catch(() => {
        // Invalid/mock token — force logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch low-stock alerts and shop name whenever user or path changes
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const loadSessionDetails = async () => {
      try {
        // Only fetch shop details for non-super-admins
        if (user.role !== 'super_admin') {
          const shopResponse = await fetch(`${API_BASE_URL}/shops/my-shop`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (shopResponse.ok) {
            const shopData = await shopResponse.json();
            setUser((prev) => {
              const updated = {
                ...prev,
                shop_name: shopData.name,
                shop_email: shopData.email,
                shop_phone: shopData.phone,
                shop_address: shopData.address
              };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }

          // Fetch low stock warnings
          const stockResponse = await fetch(`${API_BASE_URL}/products?low_stock=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (stockResponse.ok) {
            setLowStockAlerts(await stockResponse.json());
          }

          // Fetch expiring alerts
          const expiringResponse = await fetch(`${API_BASE_URL}/products?expiring=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (expiringResponse.ok) {
            setExpiryAlerts(await expiringResponse.json());
          }

          // Fetch held bills count
          const heldResponse = await fetch(`${API_BASE_URL}/held-bills`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (heldResponse.ok) {
            const heldData = await heldResponse.json();
            setHeldBillsCount(heldData.filter(bill => bill.status === 'held').length);
          }
        }
      } catch (e) {
        console.error('Session detail load failed:', e);
      }
    };

    loadSessionDetails();
  }, [user?.role, currentPath]);

  // Called by Login component on successful authentication
  const handleLoginSuccess = (userObj) => {
    setUser(userObj);
    setCurrentPath(getDefaultPath(userObj.role));
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setLowStockAlerts([]);
    setExpiryAlerts([]);
  };

  // Routing Handler
  const renderPageContent = () => {
    // Super admin guard: redirect to their panel if they navigate to shop-only pages
    if (user.role === 'super_admin') {
      switch (currentPath) {
        case '/dashboard': return <Dashboard />;
        case '/shops':     return <ManageShops />;
        case '/users':     return <SystemUsers />;
        case '/products':  return <Inventory />;
        case '/wastage':   return <Wastage />;
        case '/other-cost': return <OtherCost />;
        case '/total-revenue': return <TotalRevenue />;
        case '/settings':  return <Settings />;
        default:           return <Dashboard />;
      }
    }

    switch (currentPath) {
      case '/dashboard': return <Dashboard />;
      case '/checkout':  return <Checkout resumedHeldBill={resumedHeldBill} onClearResumedHeldBill={() => setResumedHeldBill(null)} onHeldBillsChange={(count) => setHeldBillsCount(count)} />;
      case '/held-bills': return <HeldBills onResume={(bill) => { setResumedHeldBill(bill); setCurrentPath('/checkout'); }} onHeldBillsChange={(count) => setHeldBillsCount(count)} />;
      case '/products':  return <Inventory />;
      case '/suppliers': return <Suppliers />;
      case '/customers': return <Customers />;
      case '/sales':     return <SalesHistory />;
      case '/other-cost': return <OtherCost />;
      case '/total-revenue': return <TotalRevenue />;
      case '/wastage': return <Wastage />;
      case '/staff':     return <ManageStaff />;
      case '/settings':  return <Settings />;
      default:           return <Checkout resumedHeldBill={resumedHeldBill} onClearResumedHeldBill={() => setResumedHeldBill(null)} onHeldBillsChange={(count) => setHeldBillsCount(count)} />;
    }
  };

  // Startup loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/40 animate-pulse">
            <span className="text-white font-bold text-sm">POS</span>
          </div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in — show Login page
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Logged in — show dashboard
  return (
    <DashboardLayout
      user={user}
      lowStockItems={lowStockAlerts}
      expiryItems={expiryAlerts}
      heldBillsCount={heldBillsCount}
      currentPath={currentPath}
      onNavigate={(path) => setCurrentPath(path)}
      onLogout={handleLogout}
    >
      {renderPageContent()}
    </DashboardLayout>
  );
}
