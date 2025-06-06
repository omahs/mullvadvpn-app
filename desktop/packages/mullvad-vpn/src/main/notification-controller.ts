import { app, NativeImage, nativeImage, Notification as ElectronNotification } from 'electron';
import os from 'os';
import path from 'path';

import { TunnelState } from '../shared/daemon-rpc-types';
import log from '../shared/logging';
import {
  ConnectedNotificationProvider,
  ConnectingNotificationProvider,
  DaemonDisconnectedNotificationProvider,
  DisconnectedNotificationProvider,
  ErrorNotificationProvider,
  ReconnectingNotificationProvider,
  SystemNotification,
  SystemNotificationAction,
  SystemNotificationCategory,
  SystemNotificationProvider,
  SystemNotificationSeverityType,
} from '../shared/notifications';
import { RoutePath } from '../shared/routes';
import { Scheduler } from '../shared/scheduler';

const THROTTLE_DELAY = 500;

export interface Notification {
  specification: SystemNotification;
  notification: ElectronNotification;
}

export interface NotificationSender {
  notify(notification: SystemNotification): void;
  closeNotificationsInCategory(category: SystemNotificationCategory): void;
}

export interface NotificationControllerDelegate {
  openApp(): void;
  openLink(url: string, withAuth?: boolean): Promise<void>;
  openRoute(url: RoutePath): void;
  /**
   * We have experienced issues where the
   * notification dot wasn't removed and logging the reason for it to be showing we can narrow the
   * causes down.
   *
   * @param reason Used for debug purposes, it is currently all relevant notification messages..
   */
  showNotificationIcon(value: boolean, reason?: string): void;
}

enum NotificationSuppressReason {
  development,
  windowVisible,
  preference,
  alreadyPresented,
}

export default class NotificationController {
  private reconnecting = false;

  private presentedNotifications: { [key: string]: boolean } = {};
  private activeNotifications: Set<Notification> = new Set();
  private dismissedNotifications: Set<SystemNotification> = new Set();
  private throttledNotifications: Map<SystemNotification, Scheduler> = new Map();

  private notificationTitle =
    process.platform === 'linux' && process.env.NODE_ENV !== 'test' ? app.name : '';
  private notificationIcon?: NativeImage;

  constructor(private notificationControllerDelegate: NotificationControllerDelegate) {
    let usePngIcon;
    if (process.platform === 'linux') {
      usePngIcon = true;
    } else if (process.platform === 'win32') {
      usePngIcon = parseInt(os.release().split('.')[0], 10) >= 10;
    } else {
      usePngIcon = false;
    }

    if (usePngIcon) {
      const PATH_PREFIX = process.env.NODE_ENV === 'development' ? '../' : '';
      const basePath = path.resolve(path.join(__dirname, PATH_PREFIX, 'assets/images'));
      // `nativeImage` is undefined when running tests
      this.notificationIcon = nativeImage?.createFromPath(
        path.join(basePath, 'icon-notification.png'),
      );
    }
  }

  public dispose() {
    this.throttledNotifications.forEach((scheduler) => scheduler.cancel());

    this.activeNotifications.forEach((notification) => notification.notification.close());
    this.activeNotifications.clear();
  }

  public notifyTunnelState(
    tunnelState: TunnelState,
    hasExcludedApps: boolean,
    isWindowVisible: boolean,
    areSystemNotificationsEnabled: boolean,
  ): boolean {
    const notificationProviders: SystemNotificationProvider[] = [
      new ConnectingNotificationProvider({ tunnelState, reconnecting: this.reconnecting }),
      new ConnectedNotificationProvider(tunnelState),
      new ReconnectingNotificationProvider(tunnelState),
      new DisconnectedNotificationProvider({ tunnelState }),
      new ErrorNotificationProvider({ tunnelState, hasExcludedApps }),
    ];

    const notificationProvider = notificationProviders.find((notification) =>
      notification.mayDisplay(),
    );

    this.reconnecting =
      tunnelState.state === 'disconnecting' && tunnelState.details === 'reconnect';

    if (notificationProvider) {
      const notification = notificationProvider.getSystemNotification();

      if (notification) {
        return this.notify(notification, isWindowVisible, areSystemNotificationsEnabled);
      } else {
        log.error(
          `Notification providers mayDisplay() returned true but getSystemNotification() returned undefined for ${notificationProvider.constructor.name}`,
        );
      }
    } else {
      this.closeNotificationsInCategory(SystemNotificationCategory.tunnelState);
    }

    return false;
  }

  public notifyDaemonDisconnected(windowVisible: boolean, infoNotificationsEnabled: boolean) {
    this.notify(
      new DaemonDisconnectedNotificationProvider().getSystemNotification(),
      windowVisible,
      infoNotificationsEnabled,
    );
  }

  // Closes still relevant notifications but still lets them affect notification dot in tray icon.
  public dismissActiveNotifications() {
    this.activeNotifications.forEach((notification) => {
      notification.notification.close();
    });
    this.updateNotificationIcon();
  }

  public closeNotificationsInCategory(
    category: SystemNotificationCategory,
    severity?: SystemNotificationSeverityType,
  ) {
    this.activeNotifications.forEach((notification) => {
      if (notification.specification.category === category) {
        notification.notification.removeAllListeners('close');
        notification.notification.close();
        this.activeNotifications.delete(notification);
      }
    });
    this.dismissedNotifications.forEach((notification) => {
      if (
        notification.category === category &&
        (severity === undefined || severity >= notification.severity)
      ) {
        this.dismissedNotifications.delete(notification);
      }
    });
    this.updateNotificationIcon();
  }

  public notify(
    systemNotification: SystemNotification,
    windowVisible: boolean,
    infoNotificationsEnabled: boolean,
  ): boolean {
    const notificationSuppressReason = this.evaluateNotification(
      systemNotification,
      windowVisible,
      infoNotificationsEnabled,
    );
    if (notificationSuppressReason !== undefined) {
      if (
        notificationSuppressReason === NotificationSuppressReason.preference ||
        notificationSuppressReason === NotificationSuppressReason.windowVisible
      ) {
        this.dismissedNotifications.add(systemNotification);
        this.updateNotificationIcon();
      }

      return false;
    }

    // Cancel throttled notifications within the same category
    if (systemNotification.category !== undefined) {
      this.throttledNotifications.forEach((scheduler, specification) => {
        if (specification.category === systemNotification.category) {
          scheduler.cancel();
          this.throttledNotifications.delete(specification);
        }
      });
    }

    if (systemNotification.throttle) {
      const scheduler = new Scheduler();
      scheduler.schedule(() => {
        this.throttledNotifications.delete(systemNotification);
        this.notifyImpl(systemNotification);
      }, THROTTLE_DELAY);

      this.throttledNotifications.set(systemNotification, scheduler);
      return true;
    } else {
      this.notifyImpl(systemNotification);
      return true;
    }
  }

  private notifyImpl(systemNotification: SystemNotification): Notification {
    // Remove notifications in the same category if specified
    if (systemNotification.category !== undefined) {
      this.closeNotificationsInCategory(systemNotification.category, systemNotification.severity);
    }

    const notification = this.createNotification(systemNotification);
    this.addActiveNotification(notification);
    notification.notification.show();

    // Close notification of low severity automatically
    if (systemNotification.severity === SystemNotificationSeverityType.info) {
      setTimeout(() => notification.notification.close(), 4000);
    }

    return notification;
  }

  private createNotification(systemNotification: SystemNotification): Notification {
    const notification = this.createElectronNotification(systemNotification);

    // Action buttons are only available on macOS.
    if (process.platform === 'darwin') {
      if (systemNotification.action) {
        notification.actions = [{ type: 'button', text: systemNotification.action.link.text }];
        notification.on('action', () => this.performAction(systemNotification.action));
      }
      notification.on('click', () => this.notificationControllerDelegate.openApp());
    } else if (
      !(
        process.platform === 'win32' &&
        systemNotification.severity === SystemNotificationSeverityType.high
      )
    ) {
      if (systemNotification.action) {
        notification.on('click', () => this.performAction(systemNotification.action));
      } else {
        notification.on('click', () => this.notificationControllerDelegate.openApp());
      }
    }

    return { specification: systemNotification, notification };
  }

  private createElectronNotification(systemNotification: SystemNotification): ElectronNotification {
    return new ElectronNotification({
      title: this.notificationTitle,
      body: systemNotification.message,
      silent: true,
      icon: this.notificationIcon,
      timeoutType:
        systemNotification.severity == SystemNotificationSeverityType.high ? 'never' : 'default',
    });
  }

  private performAction(action?: SystemNotificationAction) {
    if (action) {
      if (action.type === 'navigate-external') {
        void this.notificationControllerDelegate.openLink(action.link.to, action.link.withAuth);
      }

      if (action.type === 'navigate-internal') {
        void this.notificationControllerDelegate.openRoute(action.link.to);
        this.notificationControllerDelegate.openApp();
      }
    }
  }

  private addActiveNotification(notification: Notification) {
    notification.notification.on('close', () => {
      this.dismissedNotifications.add(notification.specification);
      this.activeNotifications.delete(notification);
      this.updateNotificationIcon();
    });
    this.activeNotifications.add(notification);
    this.updateNotificationIcon();
  }

  private updateNotificationIcon() {
    const activeNotifications = [...this.activeNotifications].map(
      (notification) => notification.specification,
    );
    const notifications = [...activeNotifications, ...this.dismissedNotifications].filter(
      (notification) => notification.severity >= SystemNotificationSeverityType.medium,
    );

    if (notifications.length > 0) {
      const reason = notifications.map((notification) => `"${notification.message}"`).join(',');
      this.notificationControllerDelegate.showNotificationIcon(true, reason);
    } else {
      this.notificationControllerDelegate.showNotificationIcon(false);
    }
  }

  private evaluateNotification(
    notification: SystemNotification,
    isWindowVisible: boolean,
    areSystemNotificationsEnabled: boolean,
  ): NotificationSuppressReason | undefined {
    if (notification.suppressInDevelopment && process.env.NODE_ENV === 'development') {
      return NotificationSuppressReason.development;
    } else if (isWindowVisible) {
      return NotificationSuppressReason.windowVisible;
    } else if (
      !areSystemNotificationsEnabled &&
      notification.severity <= SystemNotificationSeverityType.low
    ) {
      return NotificationSuppressReason.preference;
    } else if (this.suppressDueToAlreadyPresented(notification)) {
      return NotificationSuppressReason.alreadyPresented;
    }

    return undefined;
  }

  private suppressDueToAlreadyPresented(notification: SystemNotification) {
    const presented = this.presentedNotifications;
    if (notification.presentOnce?.value) {
      if (presented[notification.presentOnce.name]) {
        return true;
      } else {
        presented[notification.presentOnce.name] = true;
        return false;
      }
    } else {
      return false;
    }
  }
}
