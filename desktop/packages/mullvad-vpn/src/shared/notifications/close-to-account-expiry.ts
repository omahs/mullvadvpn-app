import { sprintf } from 'sprintf-js';

import { messages } from '../../shared/gettext';
import { closeToExpiry, formatRemainingTime } from '../account-expiry';
import { urls } from '../constants';
import {
  InAppNotification,
  InAppNotificationProvider,
  SystemNotification,
  SystemNotificationCategory,
  SystemNotificationProvider,
  SystemNotificationSeverityType,
} from './notification';

interface CloseToAccountExpiryNotificationContext {
  accountExpiry: string;
  locale: string;
}

export class CloseToAccountExpiryNotificationProvider
  implements InAppNotificationProvider, SystemNotificationProvider
{
  public constructor(private context: CloseToAccountExpiryNotificationContext) {}

  public mayDisplay = () => closeToExpiry(this.context.accountExpiry);

  public getSystemNotification(): SystemNotification {
    const message = sprintf(
      // TRANSLATORS: The system notification displayed to the user when the account credit is close to expiry.
      // TRANSLATORS: Available placeholder:
      // TRANSLATORS: %(duration)s - remaining time, e.g. "2 days"
      messages.pgettext(
        'notifications',
        'Account credit expires in %(duration)s. Buy more credit.',
      ),
      {
        duration: formatRemainingTime(this.context.accountExpiry),
      },
    );

    return {
      message,
      category: SystemNotificationCategory.expiry,
      severity: SystemNotificationSeverityType.medium,
      action: {
        type: 'navigate-external',
        link: {
          text: messages.pgettext('notifications', 'Buy more'),
          to: urls.purchase,
          withAuth: true,
        },
      },
    };
  }

  public getInAppNotification(): InAppNotification {
    const subtitle = sprintf(
      messages.pgettext('in-app-notifications', '%(duration)s. Buy more credit.'),
      {
        duration: formatRemainingTime(this.context.accountExpiry, {
          capitalize: true,
          suffix: true,
        }),
      },
    );

    return {
      indicator: 'warning',
      title: messages.pgettext('in-app-notifications', 'ACCOUNT CREDIT EXPIRES SOON'),
      subtitle,
      action: {
        type: 'navigate-external',
        link: {
          to: urls.purchase,
          withAuth: true,
        },
      },
    };
  }
}
