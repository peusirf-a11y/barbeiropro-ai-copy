import { createContext, useContext, useState, useEffect } from 'react';

const BookingSessionContext = createContext();

/**
 * Persiste seleção de booking (serviço, profissional, horário, etc.)
 * mesmo durante login/cadastro/refresh.
 *
 * Storage: sessionStorage (limpo ao fechar aba)
 */
export function BookingSessionProvider({ children }) {
  const [booking, setBooking] = useState(null);

  // Carrega do sessionStorage no mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('booking_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reconstrói Dates (sessionStorage serializa como strings)
        if (parsed.selected?.date) parsed.selected.date = new Date(parsed.selected.date);
        setBooking(parsed);
      }
    } catch (e) {
      console.warn('[BookingSessionContext] Failed to load from sessionStorage:', e.message);
    }
  }, []);

  // Persiste toda mudança
  const updateBooking = (updates) => {
    setBooking(prev => {
      const next = { ...prev, ...updates };
      try {
        sessionStorage.setItem('booking_session', JSON.stringify(next));
      } catch (e) {
        console.warn('[BookingSessionContext] Failed to persist:', e.message);
      }
      return next;
    });
  };

  const clearBooking = () => {
    setBooking(null);
    sessionStorage.removeItem('booking_session');
  };

  return (
    <BookingSessionContext.Provider value={{ booking, updateBooking, clearBooking }}>
      {children}
    </BookingSessionContext.Provider>
  );
}

export function useBookingSession() {
  const ctx = useContext(BookingSessionContext);
  if (!ctx) throw new Error('useBookingSession deve estar dentro de BookingSessionProvider');
  return ctx;
}