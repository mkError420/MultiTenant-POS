import React, { useState, useEffect } from 'react';

// Simulated base URL for API requests
const API_BASE_URL = 'http://localhost:5000/api';

export default function Checkout() {
  // --- STATE MANAGEMENT ---
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxRate] = useState(0.1); // 10% Flat Tax Rate
  const [paymentMethod, setPaymentMethod] = useState('cash');
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message }
  const [receipt, setReceipt] = useState(null); // Receipts detail storage after checkout

  // --- API FETCH LOGIC ---
  
  // 1. Fetch products matching search string
  const fetchProducts = async (searchTerm = '') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products?search=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch products.');
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch customers for select options
  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      // Mocked fallback list if API customer endpoint is pending setup
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        // Fallback demo data
        setCustomers([
          { id: 1, name: 'Walk-in Customer', phone: '-' },
          { id: 2, name: 'John Doe', phone: '555-0199' },
          { id: 3, name: 'Alice Smith', phone: '555-0144' }
        ]);
      }
    } catch (e) {
      setCustomers([
        { id: 1, name: 'Walk-in Customer', phone: '-' },
        { id: 2, name: 'John Doe', phone: '555-0199' },
        { id: 3, name: 'Alice Smith', phone: '555-0144' }
      ]);
    }
  };

  // Fetch initial product list & customer directory
  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  // Debounced/delayed search triggers on input change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts(search);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // --- HELPER FUNCTIONS ---
  
  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // 3. Cart State Modifications
  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      triggerAlert('error', `"${product.name}" is currently out of stock.`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock_quantity) {
        triggerAlert('error', `Cannot exceed available inventory limit (${product.stock_quantity}) for "${product.name}".`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId, change) => {
    const targetItem = cart.find(item => item.id === productId);
    if (!targetItem) return;

    const newQty = targetItem.quantity + change;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > targetItem.stock_quantity) {
      triggerAlert('error', `Cannot exceed available stock limit (${targetItem.stock_quantity}) for "${targetItem.name}".`);
      return;
    }

    setCart(cart.map(item => 
      item.id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  // Financial Calculators
  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const getTax = () => getSubtotal() * taxRate;
  const getFinalTotal = () => (getSubtotal() - parseFloat(discount || 0)) + getTax();

  // --- SUBMIT CHECKOUT ---
  const handleCheckout = async () => {
    if (cart.length === 0) {
      triggerAlert('error', 'Checkout cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      // Structure POST payload matching backend schema requirements
      const payload = {
        customer_id: selectedCustomerId ? parseInt(selectedCustomerId) : null,
        discount: parseFloat(discount || 0),
        tax: getTax(),
        payment_method: paymentMethod,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };

      const response = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout transaction failed.');
      }

      // Successful Checkout routine
      setReceipt({
        sale_id: data.sale_id,
        items: [...cart],
        subtotal: getSubtotal(),
        discount: payload.discount,
        tax: payload.tax,
        total: data.final_amount,
        payment_method: paymentMethod,
        created_at: new Date().toLocaleString()
      });

      // Show warnings if inventory items hit low stock limit
      if (data.stock_alerts && data.stock_alerts.length > 0) {
        const warningNames = data.stock_alerts.map(a => a.name).join(', ');
        triggerAlert('success', `Transaction success! Note low stock threshold warnings on: ${warningNames}`);
      } else {
        triggerAlert('success', 'Checkout transaction completed successfully!');
      }

      // Flush States
      setCart([]);
      setDiscount(0);
      setSelectedCustomerId('');
      setMobileCartOpen(false);
      
      // Refresh local product stock list
      fetchProducts(search);

    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      
      {/* 1. Alerts Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center space-x-3 transition-all ${
          alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* 2. Page Title Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">POS Checkout</h2>
          <p className="text-sm text-slate-500">Scan SKU or search item names to build a customer cart</p>
        </div>
      </div>

      {/* 3. Split Screen Flex Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        
        {/* Left Side: Product Grid (2 columns on Desktop) */}
        <div className="lg:col-span-2 flex flex-col overflow-hidden">
          
          {/* Search Header Input bar */}
          <div className="mb-4 relative">
            <input
              type="text"
              placeholder="Search by product name or scan SKU code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <svg className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Product Items Scrolling Container */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-slate-400">
                No items found. Create items in inventory to begin.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {products.map((product) => {
                  const inCartItem = cart.find(item => item.id === product.id);
                  const remainingQty = product.stock_quantity - (inCartItem ? inCartItem.quantity : 0);
                  const isOutOfStock = remainingQty <= 0;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`group bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer relative overflow-hidden ${
                        isOutOfStock ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
                      }`}
                    >
                      {/* Cart Indicator Badge */}
                      {inCartItem && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow">
                          {inCartItem.quantity}
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {product.sku}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 mt-0.5 line-clamp-2">
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-extrabold text-slate-800">
                            ৳{parseFloat(product.price).toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            remainingQty <= product.low_stock_threshold
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            Qty: {remainingQty}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side / Cart Side Panel (Always visible on Desktop) */}
        <div className={`hidden lg:flex lg:col-span-1 bg-white border border-slate-200 rounded-2xl flex-col overflow-hidden shadow-sm`}>
          <CartPanelContent />
        </div>

      </div>

      {/* 4. MOBILE BOTTOM DRAWER STICKY NAV BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center shadow-2xl lg:hidden z-35">
        <div>
          <p className="text-xs text-slate-400 font-medium">Active Cart</p>
          <p className="text-lg font-bold text-slate-800">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} Items - <span className="text-indigo-600">৳{getFinalTotal().toFixed(2)}</span>
          </p>
        </div>
        <button
          onClick={() => setMobileCartOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-colors flex items-center space-x-2"
        >
          <span>View Cart</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile Cart Backdrop Drawer */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden">
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Active Checkout Cart</h3>
              <button
                onClick={() => setMobileCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 pb-16">
              <CartPanelContent />
            </div>
          </div>
        </div>
      )}

      {/* --- RECEIPT MODAL --- */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="text-center pb-4 border-b border-dashed border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Receipt</h3>
              <p className="text-xs text-slate-400 mt-1">Transaction ID: #{receipt.sale_id}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{receipt.created_at}</p>
            </div>
            
            {/* Items table */}
            <div className="my-4 flex-1 overflow-y-auto max-h-48 divide-y divide-slate-100 pr-1">
              {receipt.items.map(item => (
                <div key={item.id} className="py-2 flex justify-between text-xs text-slate-700">
                  <div>
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-slate-400 block">x{item.quantity} @ ৳{item.price}</span>
                  </div>
                  <span className="font-bold">৳{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Financials totals */}
            <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>৳{receipt.subtotal.toFixed(2)}</span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Discount:</span>
                  <span>-৳{receipt.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tax (10%):</span>
                <span>৳{receipt.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-800 border-t border-slate-100 pt-2">
                <span>Total Paid:</span>
                <span className="text-indigo-600">৳{parseFloat(receipt.total).toFixed(2)}</span>
              </div>
              <div className="text-center pt-2 text-[10px] text-slate-400">
                Paid via {receipt.payment_method.toUpperCase()}
              </div>
            </div>

            {/* Actions button */}
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // --- SUB-COMPONENT: CART PANEL DETAILS ---
  function CartPanelContent() {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Customer & Cart items header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Selected Customer
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Walk-in Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone !== '-' ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Selected products scrollpane */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-400 py-12">
              <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm font-medium">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                <div className="min-w-0 pr-3">
                  <h4 className="text-sm font-semibold text-slate-800 truncate">{item.name}</h4>
                  <span className="text-xs text-slate-500">৳{parseFloat(item.price).toFixed(2)}</span>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Quantity adjustments */}
                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="px-2 py-1 hover:bg-slate-200 text-slate-600 transition-colors font-bold"
                    >
                      -
                    </button>
                    <span className="px-2.5 py-1 text-xs font-bold text-slate-700">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="px-2 py-1 hover:bg-slate-200 text-slate-600 transition-colors font-bold"
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Clear line item */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove Item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation summary + Pay trigger button */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3 shrink-0">
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">৳{getSubtotal().toFixed(2)}</span>
            </div>
            
            {/* Discount Manual Inputs */}
            <div className="flex justify-between items-center">
              <span>Discount (৳)</span>
              <input
                type="number"
                min="0"
                max={getSubtotal()}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-right font-medium text-slate-700 bg-white"
              />
            </div>

            <div className="flex justify-between">
              <span>Tax (10%)</span>
              <span className="font-semibold">৳{getTax().toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-base font-extrabold text-slate-800 border-t border-slate-200/60 pt-2">
              <span>Final Total</span>
              <span className="text-indigo-600">৳{getFinalTotal().toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="pt-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'card', 'mobile_pay'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    paymentMethod === method
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {method === 'mobile_pay' ? 'Mobile' : method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Checkout Submit Trigger */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex justify-center items-center space-x-2 mt-4"
          >
            {submitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <>
                <span>Complete Checkout</span>
                <span className="font-extrabold bg-indigo-500 px-2 py-0.5 rounded text-xs">
                  ৳{getFinalTotal().toFixed(2)}
                </span>
              </>
            )}
          </button>

        </div>
      </div>
    );
  }
}
