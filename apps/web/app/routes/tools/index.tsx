import { Card, List, ListItem, PixelIcon } from '@shiqi/ui';
import { Link } from 'react-router';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { TOOLS } from '~/site';

export const meta = () =>
  pageMeta('工具', '时间戳、颜色、编码、UUID、JSON：全在浏览器里算，不上传任何东西。');

export default function ToolsIndex() {
  return (
    <PageWindow
      file="tools/"
      eyebrow="TOOLS"
      title="工具"
      lede="顺手的小工具。所有计算都在你的浏览器里完成，不上传任何东西。"
    >
      <Card>
        <List>
          {TOOLS.map((t) => (
            <ListItem
              key={t.path}
              as={Link}
              to={t.path}
              icon={<PixelIcon name={t.icon} />}
              title={t.title}
              description={t.description}
              meta="›"
            />
          ))}
        </List>
      </Card>
    </PageWindow>
  );
}
