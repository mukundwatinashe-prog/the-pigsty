import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
export const CURRENT_FARM_STORAGE_KEY = 'currentFarmId';
export const FARM_STORAGE_CLEARED_EVENT = 'pigtrack:farm-storage-cleared';

function readStoredFarm(): Farm | null {
  const saved = localStorage.getItem(CURRENT_FARM_STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as Farm;
  } catch {
    localStorage.removeItem(CURRENT_FARM_STORAGE_KEY);
    return null;
  }
}

/** Clear persisted farm selection (e.g. on logout). */
export function clearStoredFarm(): void {
  localStorage.removeItem(CURRENT_FARM_STORAGE_KEY);
  window.dispatchEvent(new Event(FARM_STORAGE_CLEARED_EVENT));
}

export function FarmProvider({ children }: { children: ReactNode }) {
  const [currentFarm, setCurrentFarmState] = useState<Farm | null>(readStoredFarm);

  const setCurrentFarm = useCallback((action: SetStateAction<Farm | null>) => {
    setCurrentFarmState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next) {
        localStorage.setItem(CURRENT_FARM_STORAGE_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(CURRENT_FARM_STORAGE_KEY);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CURRENT_FARM_STORAGE_KEY) return;
      setCurrentFarmState(readStoredFarm());
    };
    const onCleared = () => setCurrentFarmState(null);
    window.addEventListener('storage', onStorage);
    window.addEventListener(FARM_STORAGE_CLEARED_EVENT, onCleared);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(FARM_STORAGE_CLEARED_EVENT, onCleared);
    };
  }, []);

  return (
    <FarmContext.Provider value={{ currentFarm, setCurrentFarm }}>
      {children}
    </FarmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with FarmProvider
export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error('useFarm must be used within FarmProvider');
  return context;
}
