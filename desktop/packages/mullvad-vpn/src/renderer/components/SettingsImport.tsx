import { useCallback, useEffect, useState } from 'react';
import { sprintf } from 'sprintf-js';
import styled from 'styled-components';

import { messages } from '../../shared/gettext';
import { RoutePath } from '../../shared/routes';
import { useScheduler } from '../../shared/scheduler';
import { useAppContext } from '../context';
import useActions from '../lib/actionsHook';
import { Button, Flex, Icon, IconProps, LabelTiny } from '../lib/components';
import { colors, spacings } from '../lib/foundations';
import { TransitionType, useHistory } from '../lib/history';
import { useBoolean, useEffectEvent } from '../lib/utility-hooks';
import settingsImportActions from '../redux/settings-import/actions';
import { useSelector } from '../redux/store';
import { AppNavigationHeader } from './';
import { ButtonGroup } from './ButtonGroup';
import { measurements, normalText } from './common-styles';
import { BackAction } from './KeyboardNavigation';
import { Footer, Layout, SettingsContainer } from './Layout';
import { ModalAlert, ModalAlertType } from './Modal';
import SettingsHeader, { HeaderSubTitle, HeaderTitle } from './SettingsHeader';

type ImportStatus = { successful: boolean } & ({ type: 'file'; name: string } | { type: 'text' });

export default function SettingsImport() {
  const history = useHistory();
  const {
    clearAllRelayOverrides,
    importSettingsFile,
    importSettingsText,
    showOpenDialog,
    getPathBaseName,
  } = useAppContext();
  const { clearSettingsImportForm, unsetSubmitSettingsImportForm } =
    useActions(settingsImportActions);

  // Status of the text form which is used to for example submit it.
  const textForm = useSelector((state) => state.settingsImport);

  // "Clear" button will be disabled if there are no imported overrides.
  const activeOverrides = useSelector((state) => state.settings.relayOverrides.length > 0);

  const [clearDialogVisible, showClearDialog, hideClearDialog] = useBoolean();

  // Keeps the status of the last import and is cleared 10 seconds after being set.
  const [importStatus, setImportStatusImpl] = useState<ImportStatus>();
  const importStatusResetScheduler = useScheduler();

  const setImportStatus = useCallback(
    (status?: ImportStatus) => {
      // Cancel scheduled status clearing.
      importStatusResetScheduler.cancel();
      setImportStatusImpl(status);

      // The status text should be cleared after 10 seconds.
      if (status !== undefined) {
        importStatusResetScheduler.schedule(() => setImportStatusImpl(undefined), 10_000);
      }
    },
    [importStatusResetScheduler],
  );

  const confirmClear = useCallback(() => {
    hideClearDialog();
    void clearAllRelayOverrides();
    setImportStatus(undefined);
  }, [clearAllRelayOverrides, hideClearDialog, setImportStatus]);

  const navigateTextImport = useCallback(() => {
    history.push(RoutePath.settingsTextImport, { transition: TransitionType.show });
  }, [history]);

  const importFile = useCallback(async () => {
    const file = await showOpenDialog({
      properties: ['openFile'],
      buttonLabel: messages.gettext('Import'),
      filters: [{ name: 'Mullvad settings file', extensions: ['json'] }],
    });
    const path = file.filePaths[0];
    const name = await getPathBaseName(path);
    try {
      await importSettingsFile(path);
      setImportStatus({ successful: true, type: 'file', name });
    } catch {
      setImportStatus({ successful: false, type: 'file', name });
    }
  }, [getPathBaseName, importSettingsFile, setImportStatus, showOpenDialog]);

  const onMount = useEffectEvent(async () => {
    if (history.action === 'POP' && textForm.submit && textForm.value !== '') {
      try {
        await importSettingsText(textForm.value);
        setImportStatus({ successful: true, type: 'text' });
        clearSettingsImportForm();
      } catch {
        setImportStatus({ successful: false, type: 'text' });
        unsetSubmitSettingsImportForm();
      }
    }
  });

  useEffect(() => void onMount(), []);

  return (
    <BackAction action={history.pop}>
      <Layout>
        <SettingsContainer>
          <AppNavigationHeader
            title={
              // TRANSLATORS: Title label in navigation bar. This is for a feature that lets
              // TRANSLATORS: users import server IP settings.
              messages.pgettext('settings-import', 'Server IP override')
            }>
            <AppNavigationHeader.InfoButton
              title={messages.pgettext('settings-import', 'Server IP override')}
              variant="secondary"
              message={[
                messages.pgettext(
                  'settings-import',
                  'On some networks, where various types of censorship are being used, our server IP addresses are sometimes blocked.',
                ),
                messages.pgettext(
                  'settings-import',
                  'To circumvent this you can import a file or a text, provided by our support team, with new IP addresses that override the default addresses of the servers in the Select location view.',
                ),
                messages.pgettext(
                  'settings-import',
                  'If you are having issues connecting to VPN servers, please contact support.',
                ),
              ]}
            />
          </AppNavigationHeader>
          <Flex $flexDirection="column" $flex={1}>
            <SettingsHeader>
              <HeaderTitle>
                {messages.pgettext('settings-import', 'Server IP override')}
              </HeaderTitle>
              <HeaderSubTitle>
                {messages.pgettext(
                  'settings-import',
                  'Import files or text with new IP addresses for the servers in the Select location view.',
                )}
              </HeaderSubTitle>
            </SettingsHeader>

            <Flex $flexDirection="column" $flex={1}>
              <ButtonGroup $gap="small" $margin="medium">
                <Button onClick={navigateTextImport}>
                  <Button.Text>
                    {messages.pgettext('settings-import', 'Import via text')}
                  </Button.Text>
                </Button>
                <Button onClick={importFile}>
                  <Button.Text>{messages.pgettext('settings-import', 'Import file')}</Button.Text>
                </Button>
              </ButtonGroup>

              <SettingsImportStatus status={importStatus} />
            </Flex>

            <Footer>
              <Button variant="destructive" onClick={showClearDialog} disabled={!activeOverrides}>
                <Button.Text>
                  {messages.pgettext('settings-import', 'Clear all overrides')}
                </Button.Text>
              </Button>
            </Footer>

            <ModalAlert
              isOpen={clearDialogVisible}
              type={ModalAlertType.warning}
              gridButtons={[
                <Button key="cancel" onClick={hideClearDialog}>
                  <Button.Text>{messages.gettext('Cancel')}</Button.Text>
                </Button>,
                <Button key="confirm" onClick={confirmClear} variant="destructive">
                  <Button.Text>{messages.gettext('Clear')}</Button.Text>
                </Button>,
              ]}
              close={hideClearDialog}
              title={messages.pgettext('settings-import', 'Clear all overrides?')}
              message={messages.pgettext(
                'settings-import',
                'Clearing the imported overrides changes the server IPs, in the Select location view, back to default.',
              )}
            />
          </Flex>
        </SettingsContainer>
      </Layout>
    </BackAction>
  );
}

const StyledStatusContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
  margin: `18px ${measurements.horizontalViewMargin}`,
});

const StyledStatusTitle = styled.div(normalText, {
  display: 'flex',
  alignItems: 'center',
  fontWeight: 'bold',
  lineHeight: '20px',
  color: colors.white,
  gap: spacings.tiny,
});

interface ImportStatusProps {
  status?: ImportStatus;
}

// This component renders the status title, subtitle and icon depending on active overrides and
// import result.
function SettingsImportStatus(props: ImportStatusProps) {
  const activeOverrides = useSelector((state) => state.settings.relayOverrides.length > 0);

  let title;
  if (props.status?.successful) {
    title = messages.pgettext('settings-import', 'IMPORT SUCCESSFUL');
  } else if (activeOverrides && props.status?.successful !== false) {
    title = messages.pgettext('settings-import', 'OVERRIDES ACTIVE');
  } else {
    title = messages.pgettext('settings-import', 'NO OVERRIDES IMPORTED');
  }

  let iconProps: Pick<IconProps, 'icon' | 'color'> | undefined = undefined;
  let subtitle;
  if (props.status !== undefined) {
    iconProps = props.status.successful
      ? {
          icon: 'checkmark',
          color: 'green',
        }
      : { icon: 'cross', color: 'red' };

    if (props.status.successful) {
      subtitle =
        props.status.type === 'file'
          ? sprintf(
              messages.pgettext(
                'settings-import',
                'Import of file %(fileName)s was successful, overrides are now active.',
              ),
              { fileName: props.status.name },
            )
          : messages.pgettext(
              'settings-import',
              'Import of text was successful, overrides are now active.',
            );
    } else {
      subtitle =
        props.status.type === 'file'
          ? sprintf(
              messages.pgettext(
                'settings-import',
                'Import of file %(fileName)s was unsuccessful, please try again.',
              ),
              { fileName: props.status.name },
            )
          : messages.pgettext(
              'settings-import',
              'Import of text was unsuccessful, please try again.',
            );
    }
  }

  return (
    <StyledStatusContainer>
      <StyledStatusTitle data-testid="status-title">
        {title}
        {iconProps !== undefined && <Icon {...iconProps} size="medium" />}
      </StyledStatusTitle>
      {subtitle !== undefined && (
        <LabelTiny data-testid="status-subtitle" color="whiteAlpha60">
          {subtitle}
        </LabelTiny>
      )}
    </StyledStatusContainer>
  );
}
