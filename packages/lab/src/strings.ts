// The words the lab frame shows. Each lab passes its own (translated) copy.

export const LAB_STRINGS = {
  toolbar: {
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    speed: 'Simulation speed',
    reset: 'Reset',
    clock: 'Simulated time {time}',
    timeline: 'Rewind or replay the simulated time',
    rewound: 'Rewound. Play replays what happened; any action starts a new history from here.',
    goLive: 'Jump to now',
  },
  scenarios: {
    open: 'Pick a story',
    intro: '',
    start: 'Start',
    exit: 'Exit',
    progress: 'Step {n} of {total}',
    play: 'Play',
    lockIn: 'Lock in',
    back: 'Back',
    replay: 'Replay',
    next: 'Next',
    continueWith: 'Continue: {title}',
    finished: 'That is the whole story.',
    source: 'Based on',
  },
  story: {
    title: 'What happened',
    waiting: 'Playing until the next event…',
    none: 'Nothing worth stopping for happened.',
    quiet: '{n} more events like these went by without a stop.',
    continue: 'Continue',
    skip: 'Skip to the end',
    auto: 'Go on by itself',
  },
  events: {
    showData: 'Show every message',
    empty: 'Nothing has happened yet.',
  },
};

export type LabStrings = typeof LAB_STRINGS;
