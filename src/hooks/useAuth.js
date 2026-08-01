import { useCallback, useEffect, useState } from 'react';
import { getCurrentSession } from '../services/api';

export const useAuth = () => {
  const [adminUser, setAdminUser] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setIsSessionLoading(true);
    try {
      const session = await getCurrentSession();
      setAdminUser(session?.role === 'staff' || session?.role === 'manager' ? session : null);
      return session;
    } catch {
      setAdminUser(null);
      return null;
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return {
    adminUser,
    setAdminUser,
    isSessionLoading,
    refreshSession
  };
};
