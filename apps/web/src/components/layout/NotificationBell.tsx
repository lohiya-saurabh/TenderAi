import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  TriangleAlert,
  Clock,
  ShieldCheck,
  Info,
  Check,
} from 'lucide-react';
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  triggerNotificationScan,
  type NotificationItem,
} from '../../api/notifications.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '../ui/dropdown-menu.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Spinner } from '../common/Spinner.js';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await listNotifications({ limit: 20 });
      if (res.ok && res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Fallback gracefully on network hiccup
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setScanning(true);
      await triggerNotificationScan();
      await fetchNotifications();
    } finally {
      setScanning(false);
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      void markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);

    // Deep-link to relevant screen if metadata has bidId
    if (notif.metadata?.bidId && typeof notif.metadata.bidId === 'string') {
      navigate(`/bids/${notif.metadata.bidId}`);
    } else if (notif.category === 'EVIDENCE_EXPIRY') {
      navigate('/company-profile');
    }
  };

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'DEADLINE':
        return <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'REVIEW_REQUEST':
      case 'HIGH_RISK_FLAG':
        return <TriangleAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
      case 'EVIDENCE_EXPIRY':
        return <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />;
    }
  };

  const formatTimeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative h-8 w-8 px-0 border-border/60 hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 border border-border bg-[#121215] shadow-2xl z-50 text-foreground overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#18181b]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleTriggerScan}
              disabled={scanning}
              title="Scan for imminent deadlines"
            >
              {scanning ? <Spinner size="sm" className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
            </Button>

            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={handleMarkAllRead}
                disabled={loading}
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </Button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60 bg-[#121215]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="mt-1">Deadline reminders and review alerts will appear here.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-start gap-3 p-3.5 text-xs transition-colors cursor-pointer hover:bg-[#1a1a1f] ${
                  !notif.isRead ? 'bg-[#18181f]/80' : 'opacity-75'
                }`}
              >
                {renderCategoryIcon(notif.category)}

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`truncate ${!notif.isRead ? 'text-foreground font-semibold' : 'text-zinc-300 font-medium'}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimeAgo(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                {!notif.isRead && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={(e) => void handleMarkAsRead(notif.id, e)}
                    title="Mark as read"
                    aria-label="Mark notification as read"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
