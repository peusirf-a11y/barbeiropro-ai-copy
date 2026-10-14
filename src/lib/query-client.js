import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const is404 = error?.status === 404 || error?.response?.status === 404 || (error?.message && String(error.message).includes('404'));
        if (is404) return false;
        return failureCount < 1;
      },
    },
  },
});