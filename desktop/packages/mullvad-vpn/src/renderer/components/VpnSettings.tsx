import { useCallback, useMemo } from 'react';
import { sprintf } from 'sprintf-js';
import styled from 'styled-components';

import { strings, urls } from '../../shared/constants';
import { IDnsOptions, TunnelProtocol } from '../../shared/daemon-rpc-types';
import { messages } from '../../shared/gettext';
import log from '../../shared/logging';
import { RoutePath } from '../../shared/routes';
import { useAppContext } from '../context';
import { Button } from '../lib/components';
import { useRelaySettingsUpdater } from '../lib/constraint-updater';
import { colors, spacings } from '../lib/foundations';
import { useHistory } from '../lib/history';
import { formatHtml } from '../lib/html-formatter';
import { useTunnelProtocol } from '../lib/relay-settings-hooks';
import { useBoolean } from '../lib/utility-hooks';
import { RelaySettingsRedux } from '../redux/settings/reducers';
import { useSelector } from '../redux/store';
import { AppNavigationHeader } from './';
import { AriaDescription, AriaDetails, AriaInput, AriaInputGroup, AriaLabel } from './AriaGroup';
import * as Cell from './cell';
import Selector, { SelectorItem } from './cell/Selector';
import CustomDnsSettings from './CustomDnsSettings';
import { ExternalLink } from './ExternalLink';
import InfoButton from './InfoButton';
import { BackAction } from './KeyboardNavigation';
import { Layout, SettingsContainer, SettingsContent, SettingsGroup, SettingsStack } from './Layout';
import { ModalAlert, ModalAlertType, ModalMessage } from './Modal';
import { NavigationContainer } from './NavigationContainer';
import { NavigationListItem } from './NavigationListItem';
import { NavigationScrollbars } from './NavigationScrollbars';
import SettingsHeader, { HeaderTitle } from './SettingsHeader';

const StyledInfoButton = styled(InfoButton)({
  marginRight: spacings.medium,
});

const StyledTitleLabel = styled(Cell.SectionTitle)({
  flex: 1,
});

const StyledSectionItem = styled(Cell.Container)({
  backgroundColor: colors.blue40,
});

const LanIpRanges = styled.ul({
  listStyle: 'disc outside',
  marginLeft: spacings.large,
});

const IndentedValueLabel = styled(Cell.ValueLabel)({
  marginLeft: spacings.medium,
});

export default function VpnSettings() {
  const { pop } = useHistory();

  return (
    <BackAction action={pop}>
      <Layout>
        <SettingsContainer>
          <NavigationContainer>
            <AppNavigationHeader
              title={
                // TRANSLATORS: Title label in navigation bar
                messages.pgettext('vpn-settings-view', 'VPN settings')
              }
            />

            <NavigationScrollbars>
              <SettingsHeader>
                <HeaderTitle>{messages.pgettext('vpn-settings-view', 'VPN settings')}</HeaderTitle>
              </SettingsHeader>

              <SettingsContent>
                <SettingsStack>
                  <SettingsGroup>
                    <AutoStart />
                    <AutoConnect />
                  </SettingsGroup>

                  <SettingsGroup>
                    <AllowLan />
                  </SettingsGroup>

                  <SettingsGroup>
                    <DnsBlockers />
                  </SettingsGroup>

                  <SettingsGroup>
                    <EnableIpv6 />
                  </SettingsGroup>

                  <SettingsGroup>
                    <KillSwitchInfo />
                    <LockdownMode />
                  </SettingsGroup>

                  <SettingsGroup>
                    <TunnelProtocolSetting />
                  </SettingsGroup>

                  <SettingsGroup>
                    <WireguardSettingsButton />
                    <OpenVpnSettingsButton />
                  </SettingsGroup>

                  <SettingsGroup>
                    <CustomDnsSettings />
                  </SettingsGroup>

                  <SettingsGroup>
                    <IpOverrideButton />
                  </SettingsGroup>
                </SettingsStack>
              </SettingsContent>
            </NavigationScrollbars>
          </NavigationContainer>
        </SettingsContainer>
      </Layout>
    </BackAction>
  );
}

function AutoStart() {
  const autoStart = useSelector((state) => state.settings.autoStart);
  const { setAutoStart: setAutoStartImpl } = useAppContext();

  const setAutoStart = useCallback(
    async (autoStart: boolean) => {
      try {
        await setAutoStartImpl(autoStart);
      } catch (e) {
        const error = e as Error;
        log.error(`Cannot set auto-start: ${error.message}`);
      }
    },
    [setAutoStartImpl],
  );

  return (
    <AriaInputGroup>
      <Cell.Container>
        <AriaLabel>
          <Cell.InputLabel>
            {messages.pgettext('vpn-settings-view', 'Launch app on start-up')}
          </Cell.InputLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch isOn={autoStart} onChange={setAutoStart} />
        </AriaInput>
      </Cell.Container>
    </AriaInputGroup>
  );
}

function AutoConnect() {
  const autoConnect = useSelector((state) => state.settings.guiSettings.autoConnect);
  const { setAutoConnect } = useAppContext();

  return (
    <AriaInputGroup>
      <Cell.Container>
        <AriaLabel>
          <Cell.InputLabel>
            {messages.pgettext('vpn-settings-view', 'Auto-connect')}
          </Cell.InputLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch isOn={autoConnect} onChange={setAutoConnect} />
        </AriaInput>
      </Cell.Container>
      <Cell.CellFooter>
        <AriaDescription>
          <Cell.CellFooterText>
            {messages.pgettext(
              'vpn-settings-view',
              'Automatically connect to a server when the app launches.',
            )}
          </Cell.CellFooterText>
        </AriaDescription>
      </Cell.CellFooter>
    </AriaInputGroup>
  );
}

function AllowLan() {
  const allowLan = useSelector((state) => state.settings.allowLan);
  const { setAllowLan } = useAppContext();

  return (
    <AriaInputGroup>
      <Cell.Container>
        <AriaLabel>
          <Cell.InputLabel>
            {messages.pgettext('vpn-settings-view', 'Local network sharing')}
          </Cell.InputLabel>
        </AriaLabel>
        <AriaDetails>
          <StyledInfoButton>
            <ModalMessage>
              {messages.pgettext(
                'vpn-settings-view',
                'This feature allows access to other devices on the local network, such as for sharing, printing, streaming, etc.',
              )}
            </ModalMessage>
            <ModalMessage>
              {messages.pgettext(
                'vpn-settings-view',
                'It does this by allowing network communication outside the tunnel to local multicast and broadcast ranges as well as to and from these private IP ranges:',
              )}
              <LanIpRanges>
                <li>10.0.0.0/8</li>
                <li>172.16.0.0/12</li>
                <li>192.168.0.0/16</li>
                <li>169.254.0.0/16</li>
                <li>fe80::/10</li>
                <li>fc00::/7</li>
              </LanIpRanges>
            </ModalMessage>
          </StyledInfoButton>
        </AriaDetails>
        <AriaInput>
          <Cell.Switch isOn={allowLan} onChange={setAllowLan} />
        </AriaInput>
      </Cell.Container>
    </AriaInputGroup>
  );
}

function useDns(setting: keyof IDnsOptions['defaultOptions']) {
  const dns = useSelector((state) => state.settings.dns);
  const { setDnsOptions } = useAppContext();

  const updateBlockSetting = useCallback(
    (enabled: boolean) =>
      setDnsOptions({
        ...dns,
        defaultOptions: {
          ...dns.defaultOptions,
          [setting]: enabled,
        },
      }),
    [setting, dns, setDnsOptions],
  );

  return [dns, updateBlockSetting] as const;
}

function DnsBlockers() {
  const dns = useSelector((state) => state.settings.dns);
  const customDnsFeatureName = messages.pgettext('vpn-settings-view', 'Use custom DNS server');

  const title = (
    <>
      <StyledTitleLabel as="label" disabled={dns.state === 'custom'}>
        {messages.pgettext('vpn-settings-view', 'DNS content blockers')}
      </StyledTitleLabel>
      <StyledInfoButton>
        <ModalMessage>
          {messages.pgettext(
            'vpn-settings-view',
            'When this feature is enabled it stops the device from contacting certain domains or websites known for distributing ads, malware, trackers and more.',
          )}
        </ModalMessage>
        <ModalMessage>
          {messages.pgettext(
            'vpn-settings-view',
            'This might cause issues on certain websites, services, and apps.',
          )}
        </ModalMessage>
        <ModalMessage>
          {formatHtml(
            sprintf(
              messages.pgettext(
                'vpn-settings-view',
                'Attention: this setting cannot be used in combination with <b>%(customDnsFeatureName)s</b>',
              ),
              { customDnsFeatureName },
            ),
          )}
        </ModalMessage>
      </StyledInfoButton>
    </>
  );

  return (
    <Cell.ExpandableSection sectionTitle={title} expandableId="dns-blockers">
      <BlockAds />
      <BlockTrackers />
      <BlockMalware />
      <BlockGambling />
      <BlockAdultContent />
      <BlockSocialMedia />
    </Cell.ExpandableSection>
  );
}

function BlockAds() {
  const [dns, setBlockAds] = useDns('blockAds');

  return (
    <AriaInputGroup>
      <StyledSectionItem disabled={dns.state === 'custom'}>
        <AriaLabel>
          <IndentedValueLabel>
            {
              // TRANSLATORS: Label for settings that enables ad blocking.
              messages.pgettext('vpn-settings-view', 'Ads')
            }
          </IndentedValueLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch
            isOn={dns.state === 'default' && dns.defaultOptions.blockAds}
            onChange={setBlockAds}
          />
        </AriaInput>
      </StyledSectionItem>
    </AriaInputGroup>
  );
}

function BlockTrackers() {
  const [dns, setBlockTrackers] = useDns('blockTrackers');

  return (
    <AriaInputGroup>
      <StyledSectionItem disabled={dns.state === 'custom'}>
        <AriaLabel>
          <IndentedValueLabel>
            {
              // TRANSLATORS: Label for settings that enables tracker blocking.
              messages.pgettext('vpn-settings-view', 'Trackers')
            }
          </IndentedValueLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch
            isOn={dns.state === 'default' && dns.defaultOptions.blockTrackers}
            onChange={setBlockTrackers}
          />
        </AriaInput>
      </StyledSectionItem>
    </AriaInputGroup>
  );
}

function BlockMalware() {
  const [dns, setBlockMalware] = useDns('blockMalware');

  return (
    <AriaInputGroup>
      <StyledSectionItem disabled={dns.state === 'custom'}>
        <AriaLabel>
          <IndentedValueLabel>
            {
              // TRANSLATORS: Label for settings that enables malware blocking.
              messages.pgettext('vpn-settings-view', 'Malware')
            }
          </IndentedValueLabel>
        </AriaLabel>
        <AriaDetails>
          <StyledInfoButton>
            <ModalMessage>
              {messages.pgettext(
                'vpn-settings-view',
                'Warning: The malware blocker is not an anti-virus and should not be treated as such, this is just an extra layer of protection.',
              )}
            </ModalMessage>
          </StyledInfoButton>
        </AriaDetails>
        <AriaInput>
          <Cell.Switch
            isOn={dns.state === 'default' && dns.defaultOptions.blockMalware}
            onChange={setBlockMalware}
          />
        </AriaInput>
      </StyledSectionItem>
    </AriaInputGroup>
  );
}

function BlockGambling() {
  const [dns, setBlockGambling] = useDns('blockGambling');

  return (
    <AriaInputGroup>
      <StyledSectionItem disabled={dns.state === 'custom'}>
        <AriaLabel>
          <IndentedValueLabel>
            {
              // TRANSLATORS: Label for settings that enables block of gamling related websites.
              messages.pgettext('vpn-settings-view', 'Gambling')
            }
          </IndentedValueLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch
            isOn={dns.state === 'default' && dns.defaultOptions.blockGambling}
            onChange={setBlockGambling}
          />
        </AriaInput>
      </StyledSectionItem>
    </AriaInputGroup>
  );
}

function BlockAdultContent() {
  const [dns, setBlockAdultContent] = useDns('blockAdultContent');

  return (
    <AriaInputGroup>
      <StyledSectionItem disabled={dns.state === 'custom'}>
        <AriaLabel>
          <IndentedValueLabel>
            {
              // TRANSLATORS: Label for settings that enables block of adult content.
              messages.pgettext('vpn-settings-view', 'Adult content')
            }
          </IndentedValueLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch
            isOn={dns.state === 'default' && dns.defaultOptions.blockAdultContent}
            onChange={setBlockAdultContent}
          />
        </AriaInput>
      </StyledSectionItem>
    </AriaInputGroup>
  );
}

function BlockSocialMedia() {
  const [dns, setBlockSocialMedia] = useDns('blockSocialMedia');

  return (
    <AriaInputGroup>
      <StyledSectionItem disabled={dns.state === 'custom'}>
        <AriaLabel>
          <IndentedValueLabel>
            {
              // TRANSLATORS: Label for settings that enables block of social media.
              messages.pgettext('vpn-settings-view', 'Social media')
            }
          </IndentedValueLabel>
        </AriaLabel>
        <AriaInput>
          <Cell.Switch
            isOn={dns.state === 'default' && dns.defaultOptions.blockSocialMedia}
            onChange={setBlockSocialMedia}
          />
        </AriaInput>
      </StyledSectionItem>
      {dns.state === 'custom' && <CustomDnsEnabledFooter />}
    </AriaInputGroup>
  );
}

function CustomDnsEnabledFooter() {
  const customDnsFeatureName = messages.pgettext('vpn-settings-view', 'Use custom DNS server');

  // TRANSLATORS: This is displayed when the custom DNS setting is turned on which makes the block
  // TRANSLATORS: ads/trackers settings disabled. The text enclosed in "<b></b>" will appear bold.
  // TRANSLATORS: Available placeholders:
  // TRANSLATORS: %(customDnsFeatureName)s - The name displayed next to the custom DNS toggle.
  const blockingDisabledText = messages.pgettext(
    'vpn-settings-view',
    'Disable <b>%(customDnsFeatureName)s</b> below to activate these settings.',
  );

  return (
    <Cell.CellFooter>
      <AriaDescription>
        <Cell.CellFooterText>
          {formatHtml(sprintf(blockingDisabledText, { customDnsFeatureName }))}
        </Cell.CellFooterText>
      </AriaDescription>
    </Cell.CellFooter>
  );
}

function EnableIpv6() {
  const enableIpv6 = useSelector((state) => state.settings.enableIpv6);
  const { setEnableIpv6: setEnableIpv6Impl } = useAppContext();

  const setEnableIpv6 = useCallback(
    async (enableIpv6: boolean) => {
      try {
        await setEnableIpv6Impl(enableIpv6);
      } catch (e) {
        const error = e as Error;
        log.error('Failed to update enable IPv6', error.message);
      }
    },
    [setEnableIpv6Impl],
  );

  return (
    <AriaInputGroup>
      <Cell.Container>
        <AriaLabel>
          <Cell.InputLabel>{messages.pgettext('vpn-settings-view', 'Enable IPv6')}</Cell.InputLabel>
        </AriaLabel>
        <AriaDetails>
          <StyledInfoButton>
            <ModalMessage>
              {messages.pgettext(
                'vpn-settings-view',
                'When this feature is enabled, IPv6 can be used alongside IPv4 in the VPN tunnel to communicate with internet services.',
              )}
            </ModalMessage>
            <ModalMessage>
              {messages.pgettext(
                'vpn-settings-view',
                'IPv4 is always enabled and the majority of websites and applications use this protocol. We do not recommend enabling IPv6 unless you know you need it.',
              )}
            </ModalMessage>
          </StyledInfoButton>
        </AriaDetails>
        <AriaInput>
          <Cell.Switch isOn={enableIpv6} onChange={setEnableIpv6} />
        </AriaInput>
      </Cell.Container>
    </AriaInputGroup>
  );
}

function KillSwitchInfo() {
  const [killSwitchInfoVisible, showKillSwitchInfo, hideKillSwitchInfo] = useBoolean(false);

  return (
    <>
      <AriaInputGroup>
        <Cell.Container>
          <AriaLabel>
            <Cell.InputLabel>
              {messages.pgettext('vpn-settings-view', 'Kill switch')}
            </Cell.InputLabel>
          </AriaLabel>
          <StyledInfoButton onClick={showKillSwitchInfo} />
          <AriaInput>
            <Cell.Switch isOn disabled />
          </AriaInput>
        </Cell.Container>
      </AriaInputGroup>
      <ModalAlert
        isOpen={killSwitchInfoVisible}
        type={ModalAlertType.info}
        buttons={[
          <Button key="back" onClick={hideKillSwitchInfo}>
            <Button.Text>{messages.gettext('Got it!')}</Button.Text>
          </Button>,
        ]}
        close={hideKillSwitchInfo}>
        <ModalMessage>
          {messages.pgettext(
            'vpn-settings-view',
            'This built-in feature prevents your traffic from leaking outside of the VPN tunnel if your network suddenly stops working or if the tunnel fails, it does this by blocking your traffic until your connection is reestablished.',
          )}
        </ModalMessage>
        <ModalMessage>
          {messages.pgettext(
            'vpn-settings-view',
            'The difference between the Kill Switch and Lockdown Mode is that the Kill Switch will prevent any leaks from happening during automatic tunnel reconnects, software crashes and similar accidents. With Lockdown Mode enabled, you must be connected to a Mullvad VPN server to be able to reach the internet. Manually disconnecting or quitting the app will block your connection.',
          )}
        </ModalMessage>
      </ModalAlert>
    </>
  );
}

function LockdownMode() {
  const blockWhenDisconnected = useSelector((state) => state.settings.blockWhenDisconnected);
  const { setBlockWhenDisconnected: setBlockWhenDisconnectedImpl } = useAppContext();

  const [confirmationDialogVisible, showConfirmationDialog, hideConfirmationDialog] =
    useBoolean(false);

  const setBlockWhenDisconnected = useCallback(
    async (blockWhenDisconnected: boolean) => {
      try {
        await setBlockWhenDisconnectedImpl(blockWhenDisconnected);
      } catch (e) {
        const error = e as Error;
        log.error('Failed to update block when disconnected', error.message);
      }
    },
    [setBlockWhenDisconnectedImpl],
  );

  const setLockDownMode = useCallback(
    async (newValue: boolean) => {
      if (newValue) {
        showConfirmationDialog();
      } else {
        await setBlockWhenDisconnected(false);
      }
    },
    [setBlockWhenDisconnected, showConfirmationDialog],
  );

  const confirmLockdownMode = useCallback(async () => {
    hideConfirmationDialog();
    await setBlockWhenDisconnected(true);
  }, [hideConfirmationDialog, setBlockWhenDisconnected]);

  return (
    <>
      <AriaInputGroup>
        <Cell.Container>
          <AriaLabel>
            <Cell.InputLabel>
              {messages.pgettext('vpn-settings-view', 'Lockdown mode')}
            </Cell.InputLabel>
          </AriaLabel>
          <AriaDetails>
            <StyledInfoButton>
              <ModalMessage>
                {messages.pgettext(
                  'vpn-settings-view',
                  'The difference between the Kill Switch and Lockdown Mode is that the Kill Switch will prevent any leaks from happening during automatic tunnel reconnects, software crashes and similar accidents.',
                )}
              </ModalMessage>
              <ModalMessage>
                {messages.pgettext(
                  'vpn-settings-view',
                  'With Lockdown Mode enabled, you must be connected to a Mullvad VPN server to be able to reach the internet. Manually disconnecting or quitting the app will block your connection.',
                )}
              </ModalMessage>
            </StyledInfoButton>
          </AriaDetails>
          <AriaInput>
            <Cell.Switch isOn={blockWhenDisconnected} onChange={setLockDownMode} />
          </AriaInput>
        </Cell.Container>
      </AriaInputGroup>
      <ModalAlert
        isOpen={confirmationDialogVisible}
        type={ModalAlertType.caution}
        buttons={[
          <Button variant="destructive" key="confirm" onClick={confirmLockdownMode}>
            <Button.Text>{messages.gettext('Enable anyway')}</Button.Text>
          </Button>,
          <Button key="back" onClick={hideConfirmationDialog}>
            <Button.Text>{messages.gettext('Back')}</Button.Text>
          </Button>,
        ]}
        close={hideConfirmationDialog}>
        <ModalMessage>
          {messages.pgettext(
            'vpn-settings-view',
            'Attention: enabling this will always require a Mullvad VPN connection in order to reach the internet.',
          )}
        </ModalMessage>
        <ModalMessage>
          {messages.pgettext(
            'vpn-settings-view',
            'The app’s built-in kill switch is always on. This setting will additionally block the internet if clicking Disconnect or Quit.',
          )}
        </ModalMessage>
      </ModalAlert>
    </>
  );
}

function TunnelProtocolSetting() {
  const tunnelProtocol = useTunnelProtocol();

  const relaySettingsUpdater = useRelaySettingsUpdater();

  const relaySettings = useSelector((state) => state.settings.relaySettings);
  const multihop = 'normal' in relaySettings ? relaySettings.normal.wireguard.useMultihop : false;
  const daita = useSelector((state) => state.settings.wireguard.daita?.enabled ?? false);
  const quantumResistant = useSelector((state) => state.settings.wireguard.quantumResistant);
  const openVpnDisabled = daita || multihop || quantumResistant;

  const featuresToDisableForOpenVpn = [];
  if (daita) {
    featuresToDisableForOpenVpn.push(strings.daita);
  }
  if (multihop) {
    featuresToDisableForOpenVpn.push(messages.pgettext('wireguard-settings-view', 'Multihop'));
  }
  if (quantumResistant) {
    featuresToDisableForOpenVpn.push(
      messages.pgettext('wireguard-settings-view', 'Quantum-resistant tunnel'),
    );
  }

  const setTunnelProtocol = useCallback(
    async (tunnelProtocol: TunnelProtocol) => {
      try {
        await relaySettingsUpdater((settings) => ({
          ...settings,
          tunnelProtocol,
        }));
      } catch (e) {
        const error = e as Error;
        log.error('Failed to update tunnel protocol constraints', error.message);
      }
    },
    [relaySettingsUpdater],
  );

  const tunnelProtocolItems: Array<SelectorItem<TunnelProtocol>> = useMemo(
    () => [
      {
        label: strings.wireguard,
        value: 'wireguard',
      },
      {
        label: strings.openvpn,
        value: 'openvpn',
        disabled: openVpnDisabled,
      },
    ],
    [openVpnDisabled],
  );

  return (
    <AriaInputGroup>
      <Selector
        title={messages.pgettext('vpn-settings-view', 'Tunnel protocol')}
        items={tunnelProtocolItems}
        value={tunnelProtocol}
        onSelect={setTunnelProtocol}
      />
      {openVpnDisabled && (
        <Cell.CellFooter>
          <AriaDescription>
            <Cell.CellFooterText>
              {sprintf(
                messages.pgettext(
                  'vpn-settings-view',
                  'To select %(openvpn)s, please disable these settings: %(featureList)s.',
                ),
                { openvpn: strings.openvpn, featureList: featuresToDisableForOpenVpn.join(', ') },
              )}
            </Cell.CellFooterText>
          </AriaDescription>
        </Cell.CellFooter>
      )}
      {tunnelProtocol === 'openvpn' && (
        <Cell.CellFooter>
          <AriaDescription>
            <Cell.CellFooterText>
              {sprintf(
                // TRANSLATORS: Footer text for tunnel protocol selector when OpenVPN is selected.
                // TRANSLATORS: Available placeholders:
                // TRANSLATORS: %(openvpn)s - Will be replaced with OpenVPN
                messages.pgettext(
                  'vpn-settings-view',
                  'Attention: We are removing support for %(openVpn)s.',
                ),
                { openVpn: strings.openvpn },
              )}{' '}
            </Cell.CellFooterText>
          </AriaDescription>
          <ExternalLink variant="labelTiny" to={urls.removingOpenVpnBlog}>
            <ExternalLink.Text>
              {sprintf(
                // TRANSLATORS: Link in tunnel protocol selector footer to blog post
                // TRANSLATORS: about OpenVPN support ending.
                messages.pgettext('vpn-settings-view', 'Read more'),
              )}
            </ExternalLink.Text>
            <ExternalLink.Icon icon="external" size="small" />
          </ExternalLink>
        </Cell.CellFooter>
      )}
    </AriaInputGroup>
  );
}

function mapRelaySettingsToProtocol(relaySettings: RelaySettingsRedux) {
  if ('normal' in relaySettings) {
    const { tunnelProtocol } = relaySettings.normal;
    return tunnelProtocol;
    // since the GUI doesn't display custom settings, just display the default ones.
    // If the user sets any settings, then those will be applied.
  } else if ('customTunnelEndpoint' in relaySettings) {
    return undefined;
  } else {
    throw new Error('Unknown type of relay settings.');
  }
}

function WireguardSettingsButton() {
  const tunnelProtocol = useSelector((state) =>
    mapRelaySettingsToProtocol(state.settings.relaySettings),
  );

  return (
    <NavigationListItem to={RoutePath.wireguardSettings} disabled={tunnelProtocol === 'openvpn'}>
      <NavigationListItem.Label>
        {sprintf(
          // TRANSLATORS: %(wireguard)s will be replaced with the string "WireGuard"
          messages.pgettext('vpn-settings-view', '%(wireguard)s settings'),
          { wireguard: strings.wireguard },
        )}
      </NavigationListItem.Label>
      <NavigationListItem.Icon icon="chevron-right" />
    </NavigationListItem>
  );
}

function OpenVpnSettingsButton() {
  const tunnelProtocol = useTunnelProtocol();

  return (
    <NavigationListItem to={RoutePath.openVpnSettings} disabled={tunnelProtocol === 'wireguard'}>
      <NavigationListItem.Label>
        {sprintf(
          // TRANSLATORS: %(openvpn)s will be replaced with the string "OpenVPN"
          messages.pgettext('vpn-settings-view', '%(openvpn)s settings'),
          { openvpn: strings.openvpn },
        )}
      </NavigationListItem.Label>
      <NavigationListItem.Icon icon="chevron-right" />
    </NavigationListItem>
  );
}

function IpOverrideButton() {
  return (
    <NavigationListItem to={RoutePath.settingsImport}>
      <NavigationListItem.Label>
        {messages.pgettext('vpn-settings-view', 'Server IP override')}
      </NavigationListItem.Label>
      <NavigationListItem.Icon icon="chevron-right" />
    </NavigationListItem>
  );
}
