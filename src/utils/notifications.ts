// Notification utilities for DeFi Sentinel

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

class NotificationManager {
  private notifications: Notification[] = [];
  private listeners: Set<(notifications: Notification[]) => void> = new Set();

  add(type: NotificationType, title: string, message: string): string {
    const id = crypto.randomUUID();
    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };

    this.notifications.unshift(notification);
    this.notify();
    
    // Auto-remove after 10 seconds for success/info
    if (type === 'success' || type === 'info') {
      setTimeout(() => this.remove(id), 10000);
    }

    return id;
  }

  success(title: string, message: string) {
    return this.add('success', title, message);
  }

  error(title: string, message: string) {
    return this.add('error', title, message);
  }

  warning(title: string, message: string) {
    return this.add('warning', title, message);
  }

  info(title: string, message: string) {
    return this.add('info', title, message);
  }

  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notify();
  }

  markAsRead(id: string) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notify();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.notify();
  }

  clear() {
    this.notifications = [];
    this.notify();
  }

  getAll() {
    return [...this.notifications];
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.getAll()));
  }
}

export const notifications = new NotificationManager();
export default notifications;
