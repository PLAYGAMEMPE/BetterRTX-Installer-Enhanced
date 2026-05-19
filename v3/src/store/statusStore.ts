import { create } from 'zustand';

export type StatusType = 'info' | 'error' | 'loading' | 'success';

export interface StatusMessage {
  id: string;
  message: string;
  type: StatusType;
  timestamp: number;
}

interface StatusState {
  messages: StatusMessage[];
  timers: Map<string, NodeJS.Timeout>;
  addMessage: (message: Omit<StatusMessage, 'id' | 'timestamp'>) => void;
  removeMessage: (id: string) => void;
  clearTimer: (id: string) => void;
}

const AUTO_DISMISS_DELAY = 5000; // 5 seconds

export const useStatusStore = create<StatusState>((set, get) => ({
  messages: [],
  timers: new Map(),
  addMessage: (message) => {
    const id = new Date().toISOString() + Math.random();
    const timestamp = Date.now();
    const newMessage: StatusMessage = { ...message, id, timestamp };
    
    set((state) => ({ 
      messages: [...state.messages, newMessage] 
    }));

    // Set up auto-dismiss timer (except for loading messages)
    if (message.type !== 'loading') {
      const timer = setTimeout(() => {
        get().removeMessage(id);
      }, AUTO_DISMISS_DELAY);
      
      set((state) => {
        const newTimers = new Map(state.timers);
        newTimers.set(id, timer);
        return { timers: newTimers };
      });
    }
  },
  removeMessage: (id) => {
    const { timers } = get();
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
    }
    
    set((state) => {
      const newTimers = new Map(state.timers);
      newTimers.delete(id);
      return {
        messages: state.messages.filter((msg) => msg.id !== id),
        timers: newTimers
      };
    });
  },
  clearTimer: (id) => {
    const { timers } = get();
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      set((state) => {
        const newTimers = new Map(state.timers);
        newTimers.delete(id);
        return { timers: newTimers };
      });
    }
  }
}));
