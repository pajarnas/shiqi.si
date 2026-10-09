// All text on the visitor admin page, kept in one place so it can move into
// the site's shared string tables.
export const VISITS_TEXT = {
  metaTitle: '访客记录',
  file: 'admin/visits',
  eyebrow: 'ADMIN',
  title: '访客记录',
  lede: (kept: number) =>
    `每次打开页面都会记下 IP、页面、浏览器和来源。最近 ${kept} 条留在 Redis 里，更早的自动丢掉。`,
  unavailable: '连不上 Redis，暂时看不到记录。',
  pagesTitle: '页面',
  pagesDesc: '只算人，不算搜索引擎爬虫。“总计”从开始记录算起；“最近”和“读者”只看保留下来的记录。',
  pagesEmpty: '还没有记录。',
  colPage: '页面',
  colTotal: '总计',
  colRecent: '最近',
  colReaders: '读者',
  colLast: '最后一次',
  recentTitle: '最近访问',
  recentDesc: (shown: number) => `最新的 ${shown} 条。点 IP 只看这个人，点“查”看 IP 归属地。`,
  colTime: '时间',
  colIp: 'IP',
  colAgent: '浏览器',
  colRef: '来源',
  lookup: '查',
  bot: '爬虫',
  showBots: '显示爬虫',
  hideBots: '隐藏爬虫',
  filteredBy: (ip: string) => `只看 ${ip}`,
  clearFilter: '看全部',
  stats: (people: number, ips: number, bots: number) =>
    `${people} 次人工访问 · ${ips} 个不同 IP · ${bots} 次爬虫`,
  timeZoneNote: (tz: string) => `时间按 ${tz} 显示。`,
} as const;
