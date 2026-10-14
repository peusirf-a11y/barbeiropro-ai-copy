import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Hook para autenticação de cliente final na área pública (/cliente/:slug).
const tokenKey = (companyId) => `bt_customer_token_${companyId}`;

export function useCustomerAuth(companyId) {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFromToken = useCallback(async (storedToken) => {
    if (!companyId) {
      setCustomer(null);
      setToken(null);
      setLoading(false);
      return;
    }
    if (!storedToken) {
      setCustomer(null);
      setToken(null);
      setLoading(false);
      return;
    }

    // Timeout de segurança de 2 segundos para evitar spinner infinito caso a API demore
    let timeoutReached = false;
    const timer = setTimeout(() => {
      timeoutReached = true;
      setLoading(false);
    }, 2000);

    try {
      const res = await base44.functions.invoke('customerAuth', {
        action: 'me',
        company_id: companyId,
        token: storedToken,
      });
      if (timeoutReached) return;
      clearTimeout(timer);

      if (res?.data?.customer) {
        setCustomer(res.data.customer);
        setToken(storedToken);
      } else {
        localStorage.removeItem(tokenKey(companyId));
        setCustomer(null);
        setToken(null);
      }
    } catch {
      if (!timeoutReached) {
        clearTimeout(timer);
        localStorage.removeItem(tokenKey(companyId));
        setCustomer(null);
        setToken(null);
      }
    } finally {
      if (!timeoutReached) {
        setLoading(false);
      }
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const stored = localStorage.getItem(tokenKey(companyId));
    loadFromToken(stored);
  }, [companyId, loadFromToken]);

  const login = useCallback((newToken, customerData) => {
    if (!companyId) return;
    localStorage.setItem(tokenKey(companyId), newToken);
    setToken(newToken);
    setCustomer(customerData);
  }, [companyId]);

  const logout = useCallback(() => {
    if (!companyId) return;
    localStorage.removeItem(tokenKey(companyId));
    setToken(null);
    setCustomer(null);
  }, [companyId]);

  return { customer, token, loading, login, logout };
}