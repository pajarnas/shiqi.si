import { Card, List, ListItem, PixelIcon } from '@shiqi/ui';
import { Link } from 'react-router';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { useI18n } from '~/i18n';
import { TOOLS } from '~/site';
import type { Route } from './+types/index';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.tools);

export default function ToolsIndex() {
  const { t } = useI18n();
  return (
    <PageWindow page="tools" title={t.tools.title} lede={t.tools.lede}>
      <Card>
        <List>
          {TOOLS.map((tool) => (
            <ListItem
              key={tool.path}
              as={Link}
              to={tool.path}
              icon={<PixelIcon name={tool.icon} />}
              title={t.entries[tool.key].title}
              description={t.entries[tool.key].description}
              meta="›"
            />
          ))}
        </List>
      </Card>
    </PageWindow>
  );
}
