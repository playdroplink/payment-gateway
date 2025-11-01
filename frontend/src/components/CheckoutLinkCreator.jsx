import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CheckoutLinkCreator.css';
import { API_BASE } from '../config/api';

function CheckoutLinkCreator({ merchantAddress, onLinkCreated }) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  
  const [formData, setFormData] = useState({
    product_name: '',
    description: '',
    payment_type: 'Free',
    amount: 0,
    currency: 'USD',
    stock: 'Unlimited',
    redirect_url: '',
    internal_name: '',
    waitlist_enabled: false,
    auto_expire_days: null,
    free_trial_days: null,
    initial_fee: 0,
    split_pay_installments: 0,
    cancellation_discount_percent: 0,
    cancellation_discount_type: 'First payment',
    ask_questions: false,
    questions: [],
    recurring_period: '1 month'
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (merchantAddress) {
      loadProducts();
    }
  }, [merchantAddress]);

  const loadProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/products`, {
        params: { merchant: merchantAddress }
      });
      setProducts(response.data);
    } catch (error) {
      // Only log errors that aren't network/connection issues to reduce console noise
      if (error.response) {
        console.error('Error loading products:', error.response.status, error.response.data);
      } else if (error.code !== 'ERR_NETWORK' && !error.message.includes('Network Error')) {
        console.error('Error loading products:', error.message);
      }
      // Silently fail for network errors when backend isn't available
    }
  };

  const createProduct = async () => {
    if (!newProductName.trim()) return;

    try {
      await axios.post(`${API_BASE}/products`, {
        name: newProductName,
        merchant_address: merchantAddress
      });
      const productName = newProductName.trim();
      setNewProductName('');
      setShowNewProduct(false);
      await loadProducts();
      
      // Auto-select the newly created product
      setFormData({ ...formData, product_name: productName });
      alert(`✅ Product "${productName}" created successfully!`);
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        alert('Network error: Please check if the backend server is running.');
      } else {
        console.error('Error creating product:', error);
        alert('Failed to create product: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleProductSelect = (product) => {
    if (product === 'new') {
      setShowNewProduct(true);
      setSelectedProduct('');
      setFormData({ ...formData, product_name: '' });
    } else {
      setFormData({ ...formData, product_name: product.name || product });
      setSelectedProduct(product.id || product);
      setShowNewProduct(false);
    }
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        { title: '', placeholder: '', optional: false }
      ]
    });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index][field] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!merchantAddress) {
      alert('Please enter a merchant address');
      return;
    }

    if (!formData.product_name.trim()) {
      alert('Please select or enter a product name');
      return;
    }

    try {
      // Handle stock conversion properly
      let stockValue = 0;
      if (formData.stock === 'Unlimited' || formData.stock === '' || !formData.stock) {
        stockValue = 0;
      } else {
        const parsed = parseInt(formData.stock);
        stockValue = isNaN(parsed) ? 0 : parsed;
      }
      
      const payload = {
        merchant_address: merchantAddress,
        product_name: formData.product_name.trim(),
        description: formData.description || '',
        amount: formData.payment_type === 'Free' ? 0 : (parseFloat(formData.amount) || 0),
        payment_type: formData.payment_type,
        stock: stockValue,
        redirect_url: formData.redirect_url || '',
        internal_name: formData.internal_name || '',
        questions: formData.ask_questions ? (formData.questions || []) : [],
        waitlist_enabled: formData.waitlist_enabled || false,
        auto_expire_days: formData.auto_expire_days || null,
        free_trial_days: formData.free_trial_days || null,
        initial_fee: parseFloat(formData.initial_fee) || 0,
        split_pay_installments: parseInt(formData.split_pay_installments) || 0,
        cancellation_discount_percent: parseFloat(formData.cancellation_discount_percent) || 0,
        cancellation_discount_type: formData.cancellation_discount_type || null
      };

      const response = await axios.post(`${API_BASE}/checkout-links`, payload);
      
      // Reset form after successful creation
      setFormData({
        product_name: '',
        description: '',
        payment_type: 'Free',
        amount: 0,
        currency: 'USD',
        stock: 'Unlimited',
        redirect_url: '',
        internal_name: '',
        waitlist_enabled: false,
        auto_expire_days: null,
        free_trial_days: null,
        initial_fee: 0,
        split_pay_installments: 0,
        cancellation_discount_percent: 0,
        cancellation_discount_type: 'First payment',
        ask_questions: false,
        questions: [],
        recurring_period: '1 month'
      });
      setShowAdvanced(false);
      
      alert(`✅ Checkout link created successfully!\n\nLink ID: ${response.data.link_id}\n\nYou can copy the link from the Dashboard.`);
      
      if (onLinkCreated) {
        onLinkCreated();
      }
    } catch (error) {
      console.error('Error creating checkout link:', error);
      
      // Better error handling
      let errorMessage = 'Failed to create checkout link: ';
      
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        errorMessage += 'Network Error - Please check if the backend server is running. ';
        errorMessage += `Backend URL: ${API_BASE}`;
      } else if (error.response) {
        // Server responded with error status
        errorMessage += error.response.data?.error || error.response.statusText || 'Server Error';
      } else if (error.request) {
        // Request made but no response
        errorMessage += 'No response from server. Please check your connection and backend server.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className="checkout-creator">
      <div className="creator-container">
        <div className="creator-left">
          <h2>Create checkout link</h2>
          
          <form onSubmit={handleSubmit}>
            {/* Product Selection */}
            <div className="form-group">
              <label>Product</label>
              <div className="product-select">
                <input
                  type="text"
                  list="products"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="Select or enter product name"
                  className="product-input"
                />
                <datalist id="products">
                  {products.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => setShowNewProduct(!showNewProduct)}
                  className="add-product-btn"
                >
                  +
                </button>
              </div>
              {showNewProduct && (
                <div className="new-product-form">
                  <input
                    type="text"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="New product name"
                    className="new-product-input"
                  />
                  <button type="button" onClick={createProduct}>Create</button>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Invoice for September coaching call"
                rows="3"
                maxLength={500}
              />
              <span className="char-count">{formData.description.length}/500</span>
            </div>

            {/* Pricing Options */}
            <div className="form-group">
              <label>Pricing</label>
              <div className="pricing-buttons">
                <button
                  type="button"
                  className={formData.payment_type === 'Free' ? 'active' : ''}
                  onClick={() => setFormData({ ...formData, payment_type: 'Free', amount: 0 })}
                >
                  Free
                </button>
                <button
                  type="button"
                  className={formData.payment_type === 'One-time' ? 'active' : ''}
                  onClick={() => setFormData({ ...formData, payment_type: 'One-time' })}
                >
                  One-time
                </button>
                <button
                  type="button"
                  className={formData.payment_type === 'Recurring' ? 'active' : ''}
                  onClick={() => setFormData({ ...formData, payment_type: 'Recurring' })}
                >
                  Recurring
                </button>
              </div>

              {formData.payment_type !== 'Free' && (
                <div className="amount-input-group">
                  <div className="amount-input-wrapper">
                    <span className="currency-symbol">π</span>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="amount-input"
                    />
                    {formData.payment_type === 'Recurring' && (
                      <select
                        value={formData.recurring_period}
                        onChange={(e) => setFormData({ ...formData, recurring_period: e.target.value })}
                        className="recurring-select"
                      >
                        <option value="1 month">/ 1 month</option>
                        <option value="3 months">/ 3 months</option>
                        <option value="6 months">/ 6 months</option>
                        <option value="1 year">/ 1 year</option>
                      </select>
                    )}
                  </div>
                  <div className="pi-badge">
                    <span>Pi Network</span>
                  </div>
                </div>
              )}

              {formData.payment_type === 'One-time' && formData.amount === 0 && (
                <div className="quick-amounts">
                  <button type="button" onClick={() => setFormData({ ...formData, amount: 5 })}>5 π</button>
                  <button type="button" onClick={() => setFormData({ ...formData, amount: 10 })}>10 π</button>
                  <button type="button" onClick={() => setFormData({ ...formData, amount: 25 })}>25 π</button>
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <div className="form-group">
              <button
                type="button"
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                Advanced options {showAdvanced ? '▼' : '▶'}
              </button>

              {showAdvanced && (
                <div className="advanced-options">
                  {/* Initial Fee (for Recurring) */}
                  {formData.payment_type === 'Recurring' && (
                    <div className="form-group">
                      <label>Initial fee</label>
                      <input
                        type="number"
                        value={formData.initial_fee}
                        onChange={(e) => setFormData({ ...formData, initial_fee: e.target.value })}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}

                  {/* Stock */}
                  <div className="form-group">
                    <label>Stock</label>
                    <div className="stock-input-wrapper">
                      <input
                        type="text"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        placeholder="Unlimited"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, stock: 'Unlimited' })}
                        className="infinity-btn"
                      >
                        ∞
                      </button>
                    </div>
                  </div>

                  {/* Free Trial (for Recurring) */}
                  {formData.payment_type === 'Recurring' && (
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.free_trial_days !== null}
                          onChange={(e) => setFormData({
                            ...formData,
                            free_trial_days: e.target.checked ? 7 : null
                          })}
                        />
                        Include a free trial
                      </label>
                      {formData.free_trial_days !== null && (
                        <select
                          value={formData.free_trial_days}
                          onChange={(e) => setFormData({
                            ...formData,
                            free_trial_days: parseInt(e.target.value)
                          })}
                          className="trial-select"
                        >
                          <option value={7}>7 days</option>
                          <option value={14}>14 days</option>
                          <option value={30}>30 days</option>
                        </select>
                      )}
                    </div>
                  )}

                  {/* Split Pay */}
                  {formData.payment_type === 'Recurring' && (
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.split_pay_installments > 0}
                          onChange={(e) => setFormData({
                            ...formData,
                            split_pay_installments: e.target.checked ? 6 : 0
                          })}
                        />
                        Enable split pay (Installments)
                      </label>
                      {formData.split_pay_installments > 0 && (
                        <input
                          type="number"
                          value={formData.split_pay_installments}
                          onChange={(e) => setFormData({
                            ...formData,
                            split_pay_installments: parseInt(e.target.value) || 0
                          })}
                          placeholder="Number of installments"
                          min="1"
                        />
                      )}
                    </div>
                  )}

                  {/* Cancellation Discount */}
                  {formData.payment_type === 'Recurring' && (
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.cancellation_discount_percent > 0}
                          onChange={(e) => setFormData({
                            ...formData,
                            cancellation_discount_percent: e.target.checked ? 10 : 0
                          })}
                        />
                        Offer a discount on cancellation
                      </label>
                      {formData.cancellation_discount_percent > 0 && (
                        <div className="discount-inputs">
                          <input
                            type="number"
                            value={formData.cancellation_discount_percent}
                            onChange={(e) => setFormData({
                              ...formData,
                              cancellation_discount_percent: parseFloat(e.target.value) || 0
                            })}
                            placeholder="10"
                            min="0"
                            max="100"
                          />
                          <span>%</span>
                          <select
                            value={formData.cancellation_discount_type}
                            onChange={(e) => setFormData({
                              ...formData,
                              cancellation_discount_type: e.target.value
                            })}
                          >
                            <option>First payment</option>
                            <option>Last payment</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Waitlist */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.waitlist_enabled}
                        onChange={(e) => setFormData({ ...formData, waitlist_enabled: e.target.checked })}
                      />
                      Add a waitlist
                    </label>
                  </div>

                  {/* Ask Questions */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.ask_questions}
                        onChange={(e) => setFormData({ ...formData, ask_questions: e.target.checked })}
                      />
                      Ask questions before checkout
                    </label>

                    {formData.ask_questions && (
                      <div className="questions-section">
                        {formData.questions.map((q, index) => (
                          <div key={index} className="question-item">
                            <span className="question-number">Question {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeQuestion(index)}
                              className="delete-question"
                            >
                              🗑️
                            </button>
                            <input
                              type="text"
                              value={q.title}
                              onChange={(e) => updateQuestion(index, 'title', e.target.value)}
                              placeholder="Question title"
                              className="question-title"
                            />
                            <input
                              type="text"
                              value={q.placeholder}
                              onChange={(e) => updateQuestion(index, 'placeholder', e.target.value)}
                              placeholder="Question placeholder"
                              className="question-placeholder"
                            />
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={q.optional}
                                onChange={(e) => updateQuestion(index, 'optional', e.target.checked)}
                              />
                              Optional
                            </label>
                          </div>
                        ))}
                        <button type="button" onClick={addQuestion} className="add-question-btn">
                          + Add another question
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Auto-expire */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.auto_expire_days !== null}
                        onChange={(e) => setFormData({
                          ...formData,
                          auto_expire_days: e.target.checked ? 7 : null
                        })}
                      />
                      Auto-expire access
                    </label>
                    {formData.auto_expire_days !== null && (
                      <select
                        value={formData.auto_expire_days}
                        onChange={(e) => setFormData({
                          ...formData,
                          auto_expire_days: parseInt(e.target.value) || null
                        })}
                        className="expire-select"
                      >
                        <option value={1}>After one day</option>
                        <option value={7}>After seven days</option>
                        <option value={30}>After thirty days</option>
                        <option value={90}>After ninety days</option>
                      </select>
                    )}
                  </div>

                  {/* Redirect */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!formData.redirect_url}
                        onChange={(e) => setFormData({
                          ...formData,
                          redirect_url: e.target.checked ? 'https://www.example.com' : ''
                        })}
                      />
                      Redirect after checkout
                    </label>
                    {formData.redirect_url && (
                      <input
                        type="url"
                        value={formData.redirect_url}
                        onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                        placeholder="https://www.example.com"
                      />
                    )}
                  </div>

                  {/* Internal Name */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!formData.internal_name}
                        onChange={(e) => setFormData({
                          ...formData,
                          internal_name: e.target.checked ? '' : ''
                        })}
                      />
                      Add internal name
                    </label>
                    {formData.internal_name !== undefined && (
                      <input
                        type="text"
                        value={formData.internal_name}
                        onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                        placeholder="This is for John on the sales team."
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="create-btn">
              Create checkout link
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CheckoutLinkCreator;

