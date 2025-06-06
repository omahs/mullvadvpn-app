import React from 'react';

import { RoutePath } from '../../shared/routes';
import { ListItem, ListItemProps } from '../lib/components/list-item';
import { useHistory } from '../lib/history';

export type NavigationListItemProps = ListItemProps & {
  to: RoutePath;
};

function NavigationListItem({ to, children, ...props }: NavigationListItemProps) {
  const history = useHistory();
  const navigate = React.useCallback(() => history.push(to), [history, to]);

  return (
    <ListItem {...props}>
      <ListItem.Item>
        <ListItem.Trigger onClick={navigate}>
          <ListItem.Content>{children}</ListItem.Content>
        </ListItem.Trigger>
      </ListItem.Item>
    </ListItem>
  );
}
const NavigationListItemNamespace = Object.assign(NavigationListItem, {
  Label: ListItem.Label,
  Group: ListItem.Group,
  Text: ListItem.Text,
  Footer: ListItem.Footer,
  Icon: ListItem.Icon,
});

export { NavigationListItemNamespace as NavigationListItem };
