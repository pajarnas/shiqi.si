// Words for the /siam showcase. English is the original; SIAM_ZH is hand-written
// because the app's first audience reads Chinese.
import type { DeepPartial } from '~/i18n/merge';

const filing = (statement: string, evidence: string[]) => ({ statement, evidence });

export const SIAM_EN = {
  title: 'Couple Court',
  description:
    'An app where couples and friends settle fights in front of an AI judge: file a case, bring evidence, get a sealed verdict, appeal once. Try a case right here.',
  lede: 'Fighting over the dishes again? Take it to court. Both sides write a statement and bring evidence, an animal judge rules, and the verdict comes with an anti-forgery seal. Try a case below, right in your browser.',
  status: {
    label: 'IN DEVELOPMENT',
    text: 'iPhone first, Android later. Code name Siam; the final name isn’t decided yet.',
  },
  plaintiff: 'Plaintiff',
  defendant: 'Defendant',
  scenes: {
    title: 'What people take to court',
    lede: 'Small fights, taken very seriously. Pick one to try it in the courtroom below.',
    try: 'Try this case',
    items: [
      {
        id: 'dishes',
        title: 'Whose turn is the dishes?',
        blurb: 'A pan has been “soaking” in the sink since Wednesday.',
        a: filing(
          'We agreed in March to take turns, one night each. Monday and Tuesday were my nights and I did both. Wednesday was yours, and the pan is still in the sink on Friday.',
          ['Photo of the sink, Friday morning', 'Chat from March: “ok, turns it is”'],
        ),
        b: filing(
          'I always end up cooking, so the dishes should not always be on me. The pan is soaking, that is how you clean a pan.',
          [],
        ),
        makeup: 'The defendant washes the pan tonight, and you both put the turns on the fridge.',
      },
      {
        id: 'late',
        title: '40 minutes late to dinner',
        blurb: 'The table was booked for seven. Someone arrived at 7:40.',
        a: filing(
          'I booked the table for 7:00 two weeks ago and reminded you that morning. You arrived at 7:40 and the kitchen almost closed our order.',
          ['Booking confirmation for 7:00', 'Message at 9:12: “dinner at 7, don’t be late!”'],
        ),
        b: filing(
          'Sorry, I was late, I admit it. But the train stopped for 25 minutes and I texted as soon as it did.',
          ['Transit alert: line delayed 25 min', 'Text at 6:48: “train stuck, so sorry”'],
        ),
        makeup: 'The defendant picks the restaurant next time, books it, and arrives first.',
      },
      {
        id: 'cake',
        title: 'The last slice of cake',
        blurb: 'It had a name on it. Allegedly.',
        a: filing(
          'I wrote my name on the box and said I was saving the last slice for after work. When I got home the box was empty.',
          ['Photo of the box with my name on it', 'Photo of the empty box'],
        ),
        b: filing(
          'There was no name on the slice, only on the box, and you never finish anything you save anyway.',
          [],
        ),
        makeup: 'The defendant buys a whole new cake and gets one slice of it.',
      },
      {
        id: 'cold',
        title: 'Air conditioning at 22 or 26?',
        blurb: 'One is freezing, one is melting, both share a bedroom.',
        a: filing('At 22 I need two blankets. We said 26 at night because it also saves power.', [
          'Last month’s power bill',
        ]),
        b: filing(
          'At 26 I can’t sleep at all. I bought a fan to meet halfway and you turned it off.',
          ['Receipt for the fan', 'Sleep app: 4 hours 10 minutes'],
        ),
        makeup: 'Try 24 with the fan on low for one week, then come back to court.',
      },
      {
        id: 'spoiler',
        title: 'The finale spoiler',
        blurb: 'Eight seasons of waiting, ruined in one sentence.',
        a: filing(
          'We promised to watch the last episode together on Saturday. On Friday you texted me who dies.',
          ['Screenshot of the text, Friday 23:02', 'Our pact: “nobody watches without the other”'],
        ),
        b: filing('It was a reaction, not a spoiler. Everyone online already knew anyway.', []),
        makeup: 'The defendant hosts the rewatch: snacks, blanket, phone in another room.',
      },
      {
        id: 'read',
        title: 'Left on read',
        blurb: 'Seen at 14:03. Reply at 21:30.',
        a: filing(
          'I asked a simple question at two. You saw it right away and answered seven hours later, while posting stories in between.',
          ['Screenshot: seen 14:03', 'Screenshot of a story posted at 16:20'],
        ),
        b: filing(
          'I was in back-to-back meetings and the story was scheduled. I never ignore you on purpose.',
          ['Calendar for that afternoon'],
        ),
        makeup: 'A quick “busy, later!” costs five seconds. Both of you, from now on.',
      },
    ],
  },
  demo: {
    title: 'The courtroom',
    lede: 'A pocket version of the court that runs in this page. The real app hands both filings to an AI judge; here the judges only weigh evidence, detail, sweeping words, admissions and agreements, so every case is instant and free.',
    scene: 'Case',
    own: 'Your own case',
    caseTitle: 'What is the fight about?',
    caseTitleHint: 'Who forgot the anniversary',
    statement: 'Statement',
    statementHint: 'What happened, in your own words',
    evidence: 'Evidence',
    evidenceHint:
      'One item per line, up to {n}. Each side sees the other’s only after both have filed.',
    judge: 'Judge',
    start: 'Open the hearing',
    again: 'Clear the courtroom',
    needStatements: 'Both sides need a statement before the court can sit.',
    stages: [
      'Opening',
      'Plaintiff’s statement',
      'Defendant’s reply',
      'Evidence and cross-examination',
      'Debate',
      'Final statements',
      'Verdict',
    ],
    stageNow: 'Now: {stage}',
  },
  verdict: {
    heading: 'JUDGMENT',
    court: 'Couple Court · {instance}',
    first: 'First instance',
    second: 'Second instance (final)',
    caseNo: 'Case {code}',
    presiding: 'Presiding: {judge}',
    findings: 'The court finds',
    ruling: {
      A: 'The court rules for the plaintiff.',
      B: 'The court rules for the defendant.',
      draw: 'The court finds both sides equally right, and equally wrong.',
    },
    blame: 'Share of blame',
    blameRow: '{side} {pct}%',
    makeup: 'To make up',
    makeupOwn: 'Say sorry first, then do one small thing the other side asked for this week.',
    seal: 'SEALED',
    code: 'Anti-forgery code',
    hash: 'SHA-256 of this verdict',
    hashNote:
      'Change one word and the hash no longer matches. In the app the court also signs it with its Ed25519 key and prints a QR code; this demo stops at the hash.',
    finding: {
      evidence: '{side} backed the account with evidence ({n} items).',
      noEvidence: '{side} brought no evidence.',
      detail: '{side} gave a clear, specific account.',
      absolutes:
        '{side} used sweeping words like “always” and “never” ({n} times), which the court discounts.',
      admits: '{side} admitted part of the fault. Honesty noted; the blame moves accordingly.',
      agreement: '{side} pointed to an agreement both sides had made.',
    },
  },
  jury: {
    title: 'The public jury',
    text: 'In the app, both sides can let anonymous strangers review the case. Jurors are picked at random, read the judgment, vote and may leave a short opinion. From {quorum} votes the tally counts, and if {pct}% or more disagree, the judge admits error and the ruling is reversed.',
    button: 'Send to the jury',
    simulated: 'Simulated: these {n} jurors live in your browser.',
    counting: 'Jurors voting: {n} of {total}',
    draw: 'Draw',
    agree: '{pct}% of {n} jurors agree with the court.',
    upheld: 'The jury backs the court. The ruling stands.',
    admits:
      '{judge}: “The court got this one wrong. {pct}% of {n} jurors disagreed, so the ruling is reversed.”',
    opinions: 'What jurors said',
    instance: 'Public jury review (final)',
    superseded: 'Reversed by the public jury. The ruling below replaces it.',
    pool: {
      A: [
        'The plaintiff came with receipts. Case closed.',
        'An agreement is an agreement.',
        'Defendant, just say sorry and move on.',
        'Clear story, clear evidence. Plaintiff.',
      ],
      B: [
        'The defendant had a fair point here.',
        'Plaintiff is overreacting a little.',
        'Honestly I would have done what the defendant did.',
        'Not enough to blame the defendant for this one.',
      ],
      draw: [
        'Both of you, go hug it out.',
        'Six of one, half a dozen of the other.',
        'Nobody wins this one, and that is fine.',
      ],
    },
  },
  appeal: {
    title: 'Not happy? Appeal.',
    text: 'The losing side has 24 hours to appeal. The second instance must be a different judge, and its verdict is final.',
    draw: 'A draw can’t be appealed: nobody lost.',
    judge: 'Second-instance judge',
    button: 'File the appeal',
    outcome: {
      upheld: 'Appeal dismissed. The verdict is upheld.',
      partial: 'Partly reversed. The court changes the ruling.',
      reversed: 'Reversed. The other side wins on appeal.',
    },
  },
  judges: {
    title: 'The bench',
    lede: 'Six animal judges. Each rules on their own and never sees another judge’s verdict; on appeal they read only the first judgment. They differ in tone and in what they weigh most. Judge Slowpoke and Judge Hop are free; the other four are a one-time unlock.',
    items: {
      tortoise: {
        name: 'Judge Slowpoke',
        role: 'Senior judge',
        catchphrase: 'Slow down. The facts aren’t going anywhere.',
        bio: 'Slowest and steadiest. Lines up the timeline before ruling.',
      },
      hare: {
        name: 'Judge Hop',
        role: 'Fast-track judge',
        catchphrase: 'Three sentences and I’ll rule.',
        bio: 'Shortest judgments, sharpest point.',
      },
      cat: {
        name: 'Lord Meow',
        role: 'Presiding judge',
        catchphrase: 'Evidence, please. I only look at evidence.',
        bio: 'A little sharp-tongued, never unfair. Can’t stand claims without proof.',
      },
      dog: {
        name: 'Judge Woof',
        role: 'Mediating judge',
        catchphrase: 'Hug first, then we’ll talk about who’s right.',
        bio: 'Cares most about the relationship and writes the most heartfelt make-up plans.',
      },
      bird: {
        name: 'Chirp',
        role: 'Logic judge',
        catchphrase: 'That doesn’t match what you said a minute ago.',
        bio: 'Catches contradictions and exaggerations. Made for he-said, she-said cases.',
      },
      bear: {
        name: 'Chief Justice Bear',
        role: 'Chief justice',
        catchphrase: 'This court’s judgment is the final judgment.',
        bio: 'Stern but warm. Best on the bench for a final appeal.',
      },
    },
  },
  features: {
    title: 'What’s in the app',
    items: [
      {
        title: 'File a case in a minute',
        text: 'Name the fight, invite the other side with a link or QR code, and both of you file a statement.',
      },
      {
        title: 'Evidence, revealed together',
        text: 'Up to 9 photos or notes each. Neither side sees the other’s until both have filed, so nobody tailors their story.',
      },
      {
        title: 'Written or live hearing',
        text: 'Rule on paper, or hold a live voice hearing in seven stages with push-to-talk, a spoken judge and a clerk who keeps minutes. Now or scheduled.',
      },
      {
        title: 'Two instances, then final',
        text: 'The losing side may appeal within 24 hours to a different judge. Upheld, partly reversed or reversed.',
      },
      {
        title: 'A verdict you can’t fake',
        text: 'Every judgment carries a SHA-256 fingerprint signed by the court, a QR code and a seal. Export it as an image or PDF.',
      },
      {
        title: 'Medals for good conduct',
        text: 'Metal medals in the style of fitness awards, earned from real cases: first win, comeback on appeal, handshake draw.',
      },
      {
        title: 'A public jury',
        text: 'Let anonymous strangers review the case at random. If 90% of at least 20 jurors disagree, the judge admits error and the ruling is reversed.',
      },
    ],
  },
  steps: {
    title: 'How a case goes',
    items: [
      'File: name the fight and pick a judge.',
      'Invite: send the other side a link or QR code.',
      'Plead: both sides write a statement and attach up to 9 pieces of evidence.',
      'Hear: on paper, or live by voice, now or at a set time.',
      'Rule: the judge finds the facts, splits the blame and suggests how to make up.',
      'Appeal: the losing side has 24 hours; the second instance is final.',
    ],
  },
  medals: {
    title: 'Medals',
    lede: 'Earned from real records, never claimed by hand.',
    items: {
      first_win: { name: 'First win', text: 'Win your first case' },
      win_10: { name: 'Undefeated', text: 'Win 10 cases' },
      comeback: { name: 'Comeback', text: 'Win on appeal after losing' },
      draw: { name: 'Handshake', text: 'Get a draw' },
      accepted: { name: 'Good sport', text: 'Lose and accept the first ruling without appealing' },
      evidence: { name: 'Well-founded', text: 'File 3 or more pieces of evidence in one case' },
      hearing: { name: 'In person', text: 'Attend a full live hearing' },
      cases_10: { name: 'Regular', text: 'Take part in 10 cases' },
    },
  },
  shots: {
    title: 'Screenshots',
    lede: 'Straight from the app, running in the iPhone simulator.',
    empty: 'Screenshots from the first local test runs will appear here.',
  },
};

export const SIAM_ZH: DeepPartial<typeof SIAM_EN> = {
  title: '情侣法庭',
  description:
    '情侣和朋友吵架，交给 AI 法官来判：立案、举证、拿到带防伪印章的判决书，不服还能上诉一次。在这一页就能试一个案子。',
  lede: '又为谁洗碗吵起来了？上法庭吧。双方各写诉状、各交证据，动物法官当庭宣判，判决书带防伪印章。下面就能在浏览器里试一个案子。',
  status: {
    label: '开发中',
    text: '先上 iPhone，以后上 Android。代号 Siam，正式名字还没定。',
  },
  plaintiff: '原告',
  defendant: '被告',
  scenes: {
    title: '大家都为什么上法庭',
    lede: '小事，但很认真。挑一个，在下面的法庭里试一试。',
    try: '审这个案子',
    items: [
      {
        id: 'dishes',
        title: '今天轮到谁洗碗？',
        blurb: '一口锅从周三“泡”到了现在。',
        a: filing(
          '我们三月就说好轮流洗碗，一人一天。周一周二是我，我都洗了。周三轮到你，结果到周五锅还在水槽里。',
          ['周五早上水槽的照片', '三月的聊天记录：“好，那就轮流”'],
        ),
        b: filing('每次都是我做饭，碗总不能也每次都归我。锅是在泡着，泡着才好洗。', []),
        makeup: '被告今晚把锅洗了，两个人把轮值表贴在冰箱上。',
      },
      {
        id: 'late',
        title: '约会迟到 40 分钟',
        blurb: '订的是七点的位子，有人七点四十才到。',
        a: filing(
          '两周前我就订了七点的位子，当天早上还提醒了你。你七点四十才到，后厨差点不接我们的单。',
          ['七点的订座确认', '早上 9:12 的消息：“晚上七点，别迟到！”'],
        ),
        b: filing('对不起，我迟到了，我承认。但地铁停了 25 分钟，一停我就给你发消息了。', [
          '地铁通知：线路延误 25 分钟',
          '6:48 的消息：“地铁卡住了，真的对不起”',
        ]),
        makeup: '下次由被告选餐厅、订位子，并且第一个到。',
      },
      {
        id: 'cake',
        title: '最后一块蛋糕',
        blurb: '上面写了名字。据说。',
        a: filing('我在盒子上写了我的名字，还说了最后一块留着下班吃。回家一看，盒子空了。', [
          '写着我名字的盒子',
          '空盒子的照片',
        ]),
        b: filing('名字写在盒子上，又没写在蛋糕上。再说你留的东西从来都吃不完。', []),
        makeup: '被告买一整个新蛋糕，自己只能吃一块。',
      },
      {
        id: 'cold',
        title: '空调开 22 度还是 26 度？',
        blurb: '一个冻死，一个热死，偏偏睡一间房。',
        a: filing('开 22 度我得盖两床被子。我们说好晚上 26 度，还省电。', ['上个月的电费单']),
        b: filing('26 度我根本睡不着。我买了个风扇想各让一步，你把它关了。', [
          '风扇的购物小票',
          '睡眠 App：4 小时 10 分钟',
        ]),
        makeup: '先试一周：24 度，风扇开最小档，一周后再来开庭。',
      },
      {
        id: 'spoiler',
        title: '大结局被剧透了',
        blurb: '等了八季，一句话全毁了。',
        a: filing('我们答应好周六一起看最后一集。周五晚上你给我发消息，说了谁死了。', [
          '周五 23:02 那条消息的截图',
          '我们的约定：“谁也不许偷看”',
        ]),
        b: filing('那是我的感想，不算剧透。反正网上大家早就知道了。', []),
        makeup: '被告请客重看一遍：零食、毯子，手机放到别的房间。',
      },
      {
        id: 'read',
        title: '已读不回',
        blurb: '14:03 已读，21:30 才回。',
        a: filing(
          '下午两点我问了一个很简单的问题。你马上就已读了，七个小时以后才回，中间还发了朋友圈。',
          ['截图：14:03 已读', '16:20 发的朋友圈截图'],
        ),
        b: filing('那天下午会一个接一个，朋友圈是定时发的。我从不故意不理你。', ['那天下午的日程']),
        makeup: '回一句“在忙，晚点说！”只要五秒钟。以后两个人都这样。',
      },
    ],
  },
  demo: {
    title: '法庭',
    lede: '这是在这一页里运行的迷你法庭。真正的 App 会把双方材料交给 AI 法官；这里的法官只看证据、细节、绝对化的说法、认错和约定，所以每个案子都是当场出判决，也不花钱。',
    scene: '案子',
    own: '自己写一个案子',
    caseTitle: '为什么吵架？',
    caseTitleHint: '谁忘了纪念日',
    statement: '诉状',
    statementHint: '发生了什么，用你自己的话说',
    evidence: '证据',
    evidenceHint: '一行一份，最多 {n} 份。双方都提交以后，才能看到对方的证据。',
    judge: '法官',
    start: '开庭',
    again: '清场，重新来',
    needStatements: '双方都写了诉状，法庭才能开庭。',
    stages: ['开庭', '原告陈述', '被告答辩', '举证质证', '法庭辩论', '最后陈述', '宣判'],
    stageNow: '正在进行：{stage}',
  },
  verdict: {
    heading: '判决书',
    court: '情侣法庭 · {instance}',
    first: '一审',
    second: '二审（终审）',
    caseNo: '案号 {code}',
    presiding: '审判：{judge}',
    findings: '本庭查明',
    ruling: {
      A: '本庭判决：原告胜诉。',
      B: '本庭判决：被告胜诉。',
      draw: '本庭认为双方各有道理，也各有不对，判平局。',
    },
    blame: '责任划分',
    blameRow: '{side} {pct}%',
    makeup: '和好方案',
    makeupOwn: '先说一句对不起，再在这周做一件对方提过的小事。',
    seal: '已盖章',
    code: '防伪码',
    hash: '本判决书的 SHA-256',
    hashNote:
      '改动任何一个字，哈希就对不上。App 里法庭还会用 Ed25519 私钥签名并印上二维码；这个演示只做到哈希。',
    finding: {
      evidence: '{side}提交了证据（{n} 份），说法有据可查。',
      noEvidence: '{side}没有提交任何证据。',
      detail: '{side}陈述清楚、具体。',
      absolutes: '{side}用了“每次”“从来”这类绝对化的说法（{n} 处），本庭不予采信。',
      admits: '{side}承认了部分过错。诚实值得肯定，责任也相应调整。',
      agreement: '{side}指出了双方事先的约定。',
    },
  },
  jury: {
    title: '网友陪审团',
    text: 'App 里，双方都同意的话，案子会匿名交给随机挑选的网友复核。陪审员看完判决书投票，还可以留一句意见。满 {quorum} 票才算数；{pct}% 以上不同意判决，法官就认错并改判。',
    button: '交给网友陪审',
    simulated: '模拟：这 {n} 位陪审员都在你的浏览器里。',
    counting: '陪审员投票中：{n} / {total}',
    draw: '平局',
    agree: '{n} 位陪审员里，{pct}% 同意本庭判决。',
    upheld: '陪审团支持本庭，原判维持。',
    admits: '{judge}：“这次是本庭判错了。{n} 位陪审员里 {pct}% 不同意，现在改判。”',
    opinions: '陪审员说',
    instance: '网友复核（终审）',
    superseded: '已被网友陪审团改判，以下面的判决为准。',
    pool: {
      A: [
        '原告证据都摆出来了，没什么好说的。',
        '说好的事就得算数。',
        '被告，道个歉就过去了。',
        '原告说得清楚，证据也有，判原告。',
      ],
      B: [
        '被告说得也有道理。',
        '原告有点小题大做了。',
        '换我也会像被告那样做。',
        '这事怪不到被告头上。',
      ],
      draw: ['你俩抱一下就好了。', '半斤八两。', '这事没有赢家，也挺好。'],
    },
  },
  appeal: {
    title: '不服？上诉。',
    text: '败诉方可以在 24 小时内上诉。二审必须换一位法官，二审判决是终审。',
    draw: '平局不能上诉：没有人输。',
    judge: '二审法官',
    button: '提起上诉',
    outcome: {
      upheld: '驳回上诉，维持原判。',
      partial: '部分改判。',
      reversed: '改判。上诉方二审胜诉。',
    },
  },
  judges: {
    title: '法官席',
    lede: '六位动物法官。每位都独立判案，不会看到别的法官的判决；二审只看一审判决书。他们的区别在语气，和最看重什么。龟慢慢和兔跳跳免费，另外四位一次买断。',
    items: {
      tortoise: {
        name: '龟慢慢',
        role: '资深法官',
        catchphrase: '慢一点，事实跑不掉。',
        bio: '审案最慢，也最稳。会把时间线理顺再下结论。',
      },
      hare: {
        name: '兔跳跳',
        role: '速裁法官',
        catchphrase: '三句话说清楚，我就能判。',
        bio: '判决书最短，重点最准。',
      },
      cat: {
        name: '喵大人',
        role: '审判长',
        catchphrase: '证据呢？本喵只看证据。',
        bio: '嘴有点毒，但从不冤枉谁。最讨厌没有证据的指控。',
      },
      dog: {
        name: '旺法官',
        role: '调解法官',
        catchphrase: '先抱一下，再说谁对谁错。',
        bio: '最看重感情，和好方案写得最用心。',
      },
      bird: {
        name: '啾啾',
        role: '逻辑法官',
        catchphrase: '你刚才说的和上一句对不上哦。',
        bio: '专抓前后矛盾和夸大其词，适合各执一词的案子。',
      },
      bear: {
        name: '熊大法官',
        role: '首席大法官',
        catchphrase: '本庭的判决，就是最后的判决。',
        bio: '威严但温和，最适合坐镇二审终审。',
      },
    },
  },
  features: {
    title: 'App 里有什么',
    items: [
      {
        title: '一分钟立案',
        text: '写下吵架的事，用链接或二维码邀请对方，双方各自递交诉状。',
      },
      {
        title: '证据同时揭晓',
        text: '每方最多 9 份照片或文字。双方都提交之后才能互相看到，谁也没法看着对方改口供。',
      },
      {
        title: '书面审理或上庭',
        text: '可以书面判，也可以连麦开庭：七个环节，按住说话，法官开口发言，书记员记笔录。当场开或者约时间。',
      },
      {
        title: '两审终审',
        text: '败诉方 24 小时内可以上诉，换一位法官二审：维持原判、部分改判或改判。',
      },
      {
        title: '造不了假的判决书',
        text: '每份判决书都有法庭签名的 SHA-256 指纹、二维码和公章，可以导出成图片或 PDF。',
      },
      {
        title: '好好表现有勋章',
        text: '仿健身奖章的金属勋章，按真实记录颁发：首次胜诉、二审翻盘、握手言和。',
      },
      {
        title: '网友陪审团',
        text: '案子可以匿名交给随机的网友复核。至少 20 人投票、90% 以上不同意时，法官认错并改判。',
      },
    ],
  },
  steps: {
    title: '一个案子怎么走',
    items: [
      '立案：写下吵架的事，选一位法官。',
      '邀请：给对方发链接或二维码。',
      '递交：双方各写诉状，最多附 9 份证据。',
      '审理：书面或者连麦，当场或者约时间。',
      '宣判：法官查明事实、划分责任、给出和好方案。',
      '上诉：败诉方有 24 小时，二审是终审。',
    ],
  },
  medals: {
    title: '勋章',
    lede: '按真实记录颁发，不能手动领取。',
    items: {
      first_win: { name: '首次胜诉', text: '赢下第一个案子' },
      win_10: { name: '常胜将军', text: '累计胜诉 10 次' },
      comeback: { name: '二审翻盘', text: '上诉后改判胜诉' },
      draw: { name: '握手言和', text: '获得一次平局判决' },
      accepted: { name: '愿赌服输', text: '输了不上诉，一审判决直接生效' },
      evidence: { name: '有理有据', text: '在一个案子里提交 3 份以上证据' },
      hearing: { name: '出庭达人', text: '完整参加一次上庭审理' },
      cases_10: { name: '老当事人', text: '参与 10 个案子' },
    },
  },
  shots: {
    title: '截图',
    lede: '直接来自 App，在 iPhone 模拟器里运行。',
    empty: '第一批本地测试的截图会放在这里。',
  },
};
