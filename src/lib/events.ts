// File: src/lib/events.ts
// Tạo một hệ thống sự kiện đơn giản để thông báo giữa các components

export const EVENT_TYPES = {
  DATA_REFRESH_NEEDED: 'supabase.data.refresh',
  AUTH_CHANGED: 'supabase.auth.changed',
  AUTH_SIGNOUT: 'supabase.auth.signout',
  CONNECTION_LOST: 'supabase.connection.lost',
  CONNECTION_RESTORED: 'supabase.connection.restored'
};

class EventBus {
  private listeners: Record<string, Array<(...args: any[]) => void>> = {};

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Tạo singleton instance
export const eventBus = new EventBus();

// Kết nối với DOM events từ API
document.addEventListener('DOMContentLoaded', () => {
  // Kết nối với DOM events
  Object.values(EVENT_TYPES).forEach(eventType => {
    window.addEventListener(eventType, () => {
      console.log(`Global event: ${eventType}`);
      eventBus.emit(eventType);
    });
  });
});

// Hook để làm mới dữ liệu
export function useDataRefresh(callback: () => void) {
  const eventType = EVENT_TYPES.DATA_REFRESH_NEEDED;
  
  // Đăng ký lắng nghe sự kiện
  window.addEventListener(eventType, callback);
  
  // Cleanup
  return () => {
    window.removeEventListener(eventType, callback);
  };
}

// Phát ra sự kiện toàn cục
export function emitRefreshNeeded() {
  window.dispatchEvent(new Event(EVENT_TYPES.DATA_REFRESH_NEEDED));
} 