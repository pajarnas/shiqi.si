// A small set of original 1-bit icons, drawn as text so they stay reviewable
// in a diff. Legend:
//   #  ink        o  fill (paper, or transparent in patterns)
//   :  halftone   .  empty

export type IconCell = '#' | 'o' | ':' | '.';

export interface Icon {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
}

function icon(name: string, art: string): Icon {
  const rows = art
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
  const w = rows[0]?.length ?? 0;
  for (const r of rows) {
    if (r.length !== w)
      throw new Error(`Icon "${name}": row "${r}" is ${r.length} wide, expected ${w}`);
    if (!/^[#o:.]+$/.test(r)) throw new Error(`Icon "${name}": unknown character in "${r}"`);
  }
  return { name, w, h: rows.length, rows };
}

/** Cell at (x, y), treating anything outside as empty. */
export function cellAt(ic: Icon, x: number, y: number): IconCell {
  return (ic.rows[y]?.[x] ?? '.') as IconCell;
}

export const ICONS = {
  cursor: icon(
    'cursor',
    `
    #..........
    ##.........
    #o#........
    #oo#.......
    #ooo#......
    #oooo#.....
    #ooooo#....
    #oooooo#...
    #ooooooo#..
    #oooooooo#.
    #ooooo#####
    #oo#oo#....
    #o#.#oo#...
    ##..#oo#...
    #....#oo#..
    .....####..
  `,
  ),
  terminal: icon(
    'terminal',
    `
    ################
    #::::::::::::::#
    ################
    #oooooooooooooo#
    #o#oooooooooooo#
    #oo#ooooooooooo#
    #ooo#oooooooooo#
    #oo#ooooooooooo#
    #o#oo#####ooooo#
    #oooooooooooooo#
    ################
  `,
  ),
  heart: icon(
    'heart',
    `
    ..###...###..
    .#:::#.#:::#.
    #:::::#:::::#
    #:::::::::::#
    #:::::::::::#
    .#:::::::::#.
    ..#:::::::#..
    ...#:::::#...
    ....#:::#....
    .....#:#.....
    ......#......
  `,
  ),
  star: icon(
    'star',
    `
    .......#.......
    ......#o#......
    ......#o#......
    .....#ooo#.....
    ######ooo######
    #ooooooooooooo#
    .#ooooooooooo#.
    ..#ooooooooo#..
    ...#ooooooo#...
    ...#ooo#ooo#...
    ..#ooo#.#ooo#..
    ..#oo#...#oo#..
    .#o##.....##o#.
    .##.........##.
  `,
  ),
  floppy: icon(
    'floppy',
    `
    #############.
    #o#:::::::#oo#
    #o#::::##:#oo#
    #o#::::##:#oo#
    #o#:::::::#oo#
    #o#########oo#
    #oooooooooooo#
    #o##########o#
    #o#oooooooo#o#
    #o#o######o#o#
    #o#oooooooo#o#
    #o#o######o#o#
    #o#oooooooo#o#
    ##############
  `,
  ),
  folder: icon(
    'folder',
    `
    .#####..........
    #ooooo#########.
    #oooooooooooooo#
    ################
    #oooooooooooooo#
    #oooooooooooooo#
    #oooooooooooooo#
    #oooooooooooooo#
    #oooooooooooooo#
    #oooooooooooooo#
    ################
  `,
  ),
  envelope: icon(
    'envelope',
    `
    ################
    ##oooooooooooo##
    #o#oooooooooo#o#
    #oo#oooooooo#oo#
    #ooo#oooooo#ooo#
    #oooo#oooo#oooo#
    #ooooo####ooooo#
    #oooooooooooooo#
    #oooooooooooooo#
    ################
  `,
  ),
  magnifier: icon(
    'magnifier',
    `
    ...####.......
    ..#oooo#......
    .#o:oooo#.....
    #o:oooooo#....
    #oooooooo#....
    #oooooooo#....
    .#oooooo#.....
    ..#oooo##.....
    ...####.##....
    .........##...
    ..........##..
    ...........##.
    ............##
  `,
  ),
  mug: icon(
    'mug',
    `
    ...#..#..#....
    ....#..#..#...
    ...#..#..#....
    ..............
    ##########....
    #oooooooo####.
    #oooooooo#..#.
    #oooooooo#..#.
    #oooooooo####.
    #oooooooo#....
    .#oooooo#.....
    ..######......
  `,
  ),
  braces: icon(
    'braces',
    `
    ....##....##....
    ...#........#...
    ...#........#...
    ...#........#...
    ..#..........#..
    .#....#.#.....#.
    ..#..........#..
    ...#........#...
    ...#........#...
    ...#........#...
    ....##....##....
  `,
  ),
  bolt: icon(
    'bolt',
    `
    .....#####
    ....#ooo#.
    ....#oo#..
    ...#oo#...
    ..#ooo####
    .#oooooo#.
    #####oo#..
    ...#oo#...
    ...#o#....
    ..#o#.....
    ..##......
    ..#.......
  `,
  ),
  note: icon(
    'note',
    `
    .....#######
    .....#######
    .....#.....#
    .....#.....#
    .....#.....#
    .....#.....#
    .....#..####
    ..####.#####
    .#####.#####
    .#####..###.
    ..###.......
  `,
  ),
  leaf: icon(
    'leaf',
    `
    ..........####
    .......###ooo#
    .....##oooooo#
    ....#ooooo#oo#
    ...#oooo#ooo#.
    ..#ooo#oooo#..
    ..#oo#oooo#...
    .#oo#ooooo#...
    .#o#ooooo#....
    .##ooooo#.....
    .#######......
    #.............
  `,
  ),
  moon: icon(
    'moon',
    `
    ....####....
    ..##oo#.....
    .#ooo#......
    #ooo#.......
    #ooo#.......
    #ooo#.......
    #oooo#......
    #ooooo##..#.
    .#oooooo###.
    ..##oooo#...
    ....####....
  `,
  ),
  sun: icon(
    'sun',
    `
    .......#.......
    .#.....#.....#.
    ..#.........#..
    .....#####.....
    ....#:::::#....
    ...#:::::::#...
    ...#:::::::#...
    ####:::::::####
    ...#:::::::#...
    ...#:::::::#...
    ....#:::::#....
    .....#####.....
    ..#.........#..
    .#.....#.....#.
    .......#.......
  `,
  ),
  bee: icon(
    'bee',
    `
    .....###.###....
    ....#ooo#ooo#...
    ....#ooo#ooo#...
    .....###.###....
    ...#########....
    ..#o#o#o#ooo#...
    .#oo#o#o#oo#o#..
    ##oo#o#o#oooo#..
    .#oo#o#o#oooo#..
    ..#o#o#o#ooo#...
    ...#########....
    ....#...#.......
  `,
  ),
  flower: icon(
    'flower',
    `
    ...###.###...
    ..#ooo#ooo#..
    ..#ooo#ooo#..
    ...#ooooo#...
    .###oo#oo###.
    #ooo#:::#ooo#
    #ooo#:::#ooo#
    .###oo#oo###.
    ...#ooooo#...
    ..#ooo#ooo#..
    ..#ooo#ooo#..
    ...###.###...
  `,
  ),
  blob: icon(
    'blob',
    `
    ....######....
    ..##::::::##..
    .#::::::::::#.
    #::::::::::::#
    #::::::::::::#
    .#::::::::::#.
    ..##::::::##..
    ....######....
  `,
  ),
  clock: icon(
    'clock',
    `
    ...#######...
    ..#ooooooo#..
    .#oooo#oooo#.
    #ooooo#ooooo#
    #ooooo#ooooo#
    #ooooo#ooooo#
    #ooooo####oo#
    #ooooooooooo#
    #ooooooooooo#
    .#ooooooooo#.
    ..#ooooooo#..
    ...#######...
  `,
  ),
  dice: icon(
    'dice',
    `
    .###########.
    #ooooooooooo#
    #o##ooooo##o#
    #o##ooooo##o#
    #ooooooooooo#
    #ooooo##oooo#
    #ooooo##oooo#
    #ooooooooooo#
    #o##ooooo##o#
    #o##ooooo##o#
    #ooooooooooo#
    .###########.
  `,
  ),
  palette: icon(
    'palette',
    `
    ...#######....
    ..#ooooooo##..
    .#o##oo##ooo#.
    #oo##oo##oooo#
    #oooooooooo##.
    #o##oooooo#...
    #o##oooooo#...
    #oooooooooo#..
    .#oo##ooooo#..
    ..#o##oooo#...
    ...#######....
  `,
  ),
  swap: icon(
    'swap',
    `
    .........#....
    .........##...
    ############..
    .........##...
    .........#....
    ..............
    ....#.........
    ...##.........
    ..############
    ...##.........
    ....#.........
  `,
  ),
  book: icon(
    'book',
    `
    .#####.#####.
    #ooooo#ooooo#
    #o###o#o###o#
    #ooooo#ooooo#
    #o###o#o###o#
    #ooooo#ooooo#
    #o###o#o###o#
    #ooooo#ooooo#
    .#####.#####.
  `,
  ),
  picture: icon(
    'picture',
    `
    ##############
    #oooooooooooo#
    #oooooooo##oo#
    #oooooooo##oo#
    #oooo#ooooooo#
    #ooo#:#oooooo#
    #oo#:::#o#ooo#
    #o#:::::#:#oo#
    #::::::::::::#
    ##############
  `,
  ),
  glider: icon(
    'glider',
    `
    ....###.....
    ....###.....
    ....###.....
    ........###.
    ........###.
    ........###.
    ###.###.###.
    ###.###.###.
    ###.###.###.
  `,
  ),
  face: icon(
    'face',
    `
    ...#######...
    ..#ooooooo#..
    .#ooooooooo#.
    #ooo#ooo#ooo#
    #ooo#ooo#ooo#
    #ooooooooooo#
    #oo#ooooo#oo#
    #ooo#####ooo#
    .#ooooooooo#.
    ..#ooooooo#..
    ...#######...
  `,
  ),
  pencil: icon(
    'pencil',
    `
    ..........##..
    .........#oo#.
    ........#oooo#
    .......#oooo#.
    ......#oooo#..
    .....#oooo#...
    ....#oooo#....
    ...#oooo#.....
    ..#:ooo#......
    ..#::o#.......
    .#::::#.......
    .###.#........
    .##...........
  `,
  ),
  grid: icon(
    'grid',
    `
    #############
    #:::#ooo#ooo#
    #:::#ooo#ooo#
    #:::#ooo#ooo#
    #############
    #ooo#:::#ooo#
    #ooo#:::#ooo#
    #ooo#:::#ooo#
    #############
    #ooo#ooo#:::#
    #ooo#ooo#:::#
    #ooo#ooo#:::#
    #############
  `,
  ),
  theme: icon(
    'theme',
    `
    ...#######...
    ..#ooo#:::#..
    .#oooo#::::#.
    #ooooo#:::::#
    #ooooo#:::::#
    #ooooo#:::::#
    #ooooo#:::::#
    #ooooo#:::::#
    .#oooo#::::#.
    ..#ooo#:::#..
    ...#######...
  `,
  ),
  quiz: icon(
    'quiz',
    `
    ...######....
    ..#oooooo#...
    .#oo####oo#..
    .#o#....#o#..
    ..#.....#o#..
    .......#oo#..
    ......#oo#...
    .....#oo#....
    .....#oo#....
    ......##.....
    .....####....
    .....#oo#....
    .....####....
  `,
  ),
} as const satisfies Record<string, Icon>;

export type IconName = keyof typeof ICONS;

/** Icons that look good scattered across a wallpaper. */
export const PATTERN_ICONS: readonly IconName[] = [
  'cursor',
  'heart',
  'star',
  'floppy',
  'folder',
  'envelope',
  'magnifier',
  'mug',
  'braces',
  'bolt',
  'note',
  'leaf',
  'moon',
  'sun',
  'bee',
  'flower',
  'blob',
  'pencil',
  'clock',
  'face',
  'picture',
  'terminal',
];

export type IconLayer = 'ink' | 'fill' | 'tone';

/**
 * SVG path data for one layer of an icon, in icon-pixel units.
 * ink: '#' cells. fill: 'o' and ':' cells. tone: the dark half of ':' cells (checkerboard).
 */
export function iconPath(ic: Icon, layer: IconLayer): string {
  const on = (c: string | undefined, x: number, y: number) =>
    layer === 'ink'
      ? c === '#'
      : layer === 'fill'
        ? c === 'o' || c === ':'
        : c === ':' && (x + y) % 2 === 0;
  let d = '';
  ic.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!on(row[x], x, y)) {
        x++;
        continue;
      }
      let end = x + 1;
      // Merge horizontal runs, except for the checkerboard where runs are 1 wide.
      while (layer !== 'tone' && end < row.length && on(row[end], end, y)) end++;
      d += `M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return d;
}
