import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';

import NotificationController from '../../src/main/notification-controller';
import { TunnelState } from '../../src/shared/daemon-rpc-types';
import { ErrorStateCause } from '../../src/shared/daemon-rpc-types';
import { FirewallPolicyErrorType } from '../../src/shared/daemon-rpc-types';
import {
  UnsupportedVersionNotificationProvider,
  UpdateAvailableNotificationProvider,
} from '../../src/shared/notifications';
import { RoutePath } from '../../src/shared/routes';

function createController() {
  return new NotificationController({
    openApp: () => {
      /* no-op */
    },
    openLink: (_url: string, _withAuth?: boolean) => Promise.resolve(),
    openRoute: (_url: RoutePath) => {
      /* no-op */
    },
    showNotificationIcon: (_value: boolean) => {
      /* no-op */
    },
  });
}

describe('System notifications', () => {
  let sandbox: sinon.SinonSandbox;

  before(() => {
    sandbox = sinon.createSandbox();
    // @ts-expect-error Way too many methods to mock.
    sandbox.stub(NotificationController.prototype, 'createElectronNotification').returns({
      show: () => {
        /* no-op */
      },
      close: () => {
        /* no-op */
      },
      on: () => {
        /* no-op */
      },
      removeAllListeners: () => {
        /* no-op */
      },
    });
  });

  it('should evaluate unspupported version notification to show', () => {
    const controller1 = createController();
    const controller2 = createController();
    const notification = new UnsupportedVersionNotificationProvider({
      supported: false,
      consistent: true,
      suggestedIsBeta: false,
    });

    expect(notification.mayDisplay()).to.be.true;

    const systemNotification = notification.getSystemNotification();
    const result1 = controller1.notify(systemNotification, false, true);
    const result2 = controller2.notify(systemNotification, false, false);

    expect(result1).to.be.true;
    expect(result2).to.be.true;
  });

  it('should evaluate update available notification to show', () => {
    const controller1 = createController();
    const controller2 = createController();
    const notification = new UpdateAvailableNotificationProvider({
      suggestedUpgrade: {
        changelog: [],
        version: '2100.1',
      },
      suggestedIsBeta: false,
    });

    expect(notification.mayDisplay()).to.be.true;

    const systemNotification = notification.getSystemNotification();
    const result1 = controller1.notify(systemNotification, false, true);
    const result2 = controller2.notify(systemNotification, false, false);

    expect(result1).to.be.true;
    expect(result2).to.be.true;
  });

  it('should show unsupported version notification only once', () => {
    const controller = createController();
    const notification = new UnsupportedVersionNotificationProvider({
      supported: false,
      consistent: true,
      suggestedIsBeta: false,
    });

    const systemNotification = notification.getSystemNotification();
    const result1 = controller.notify(systemNotification, false, true);
    const result2 = controller.notify(systemNotification, false, true);

    expect(result1).to.be.true;
    expect(result2).to.be.false;
  });

  it('should not show notification when window is open', () => {
    const controller = createController();
    const notification = new UnsupportedVersionNotificationProvider({
      supported: false,
      consistent: true,
      suggestedIsBeta: false,
    });

    const systemNotification = notification.getSystemNotification();
    const result = controller.notify(systemNotification, true, true);

    expect(result).to.be.false;
  });

  it('Tunnel state notifications should respect notification setting', () => {
    const controller = createController();

    const disconnectedState: TunnelState = { state: 'disconnected', lockedDown: false };
    const connectingState: TunnelState = { state: 'connecting', featureIndicators: undefined };
    const result1 = controller.notifyTunnelState(disconnectedState, false, false, true);
    const result2 = controller.notifyTunnelState(disconnectedState, false, false, false);
    const result3 = controller.notifyTunnelState(connectingState, false, false, true);
    const result4 = controller.notifyTunnelState(connectingState, false, false, false);

    expect(result1).to.be.true;
    expect(result2).to.be.false;
    expect(result3).to.be.true;
    expect(result4).to.be.false;

    const blockingErrorState: TunnelState = {
      state: 'error',
      details: {
        cause: ErrorStateCause.isOffline,
      },
    };
    const result5 = controller.notifyTunnelState(blockingErrorState, false, false, false);
    expect(result5).to.be.false;

    const nonBlockingErrorState: TunnelState = {
      state: 'error',
      details: {
        cause: ErrorStateCause.isOffline,
        blockingError: {
          type: FirewallPolicyErrorType.generic,
        },
      },
    };
    const result6 = controller.notifyTunnelState(nonBlockingErrorState, false, false, false);
    expect(result6).to.be.true;
  });
});
