import {
  createContext,
  useCallback,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { Farm } from '../types';

interface FarmContextType {
  currentFarm: Farm | null;
  setCurrentFarm: Dispatch<SetStateAction<Farm | null>>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [currentFarm, setCurrentFarmState] = useState<Farm | null>(() => {
    const saved = localStorage.getItem('currentFarmId');
    return saved ? JSON.parse(saved) : null;
  });

  const setCurrentFarm = useCallback((action: SetStateAction<Farm | null>) => {
    setCurrentFarmState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next) {
        localStorage.setItem('currentFarmId', JSON.stringify(next));
      } else {
        localStorage.removeItem('currentFarmId');
      }
      return next;
    });
  }, []);

  return (
    <FarmContext.Provider value={{ currentFarm, setCurrentFarm }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error('useFarm must be used within FarmProvider');
  return context;
}
