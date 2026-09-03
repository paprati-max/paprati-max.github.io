// challenges.js — edit this list freely. Each completed challenge wipes the
// same slice off the map, so the only thing that matters is that they're
// roughly equal in effort.
//
//   id        unique, never reuse an old one mid-game
//   title     what the hostage sees first
//   text      the actual task
//   hold      optional: seconds the task must run before it can be banked
//   answer    optional: a typed answer, compared loosely (case/spacing ignored)
//
// A note on design: the hostages are unsupervised, so anything that can be
// faked will be. Tasks with a hold timer, or that need a stranger, a shop, or
// something physically nearby, hold up much better than trivia.

export const CHALLENGES = [
  {
    id: "c01",
    title: "Prove you're outside",
    text: "Film a slow 360° pan of everything around you. No captions, no narration — the others get to see it later and argue about it.",
    hold: 45
  },
  {
    id: "c02",
    title: "Talk to a stranger",
    text: "Get someone who isn't in the game to say the words 'good luck' on camera.",
    hold: 60
  },
  {
    id: "c03",
    title: "Star jumps",
    text: "One hundred star jumps between the two of you. Split them however you like.",
    hold: 90
  },
  {
    id: "c04",
    title: "Five different colours",
    text: "Find five objects within walking distance that are five clearly different colours. Photograph them together.",
    hold: 120
  },
  {
    id: "c05",
    title: "Read the street",
    text: "Type the name of the street you're standing on, exactly as it's written on the sign.",
    answer: null
  },
  {
    id: "c06",
    title: "Buy something",
    text: "Buy the cheapest single item you can find from a shop or vending machine. Keep the receipt.",
    hold: 180
  },
  {
    id: "c07",
    title: "Sit still",
    text: "Both of you sit on the ground in silence. Any talking and you start again.",
    hold: 150
  },
  {
    id: "c08",
    title: "Bells or engines",
    text: "Record thirty seconds of whatever you can hear. Don't add anything to it.",
    hold: 30
  },
  {
    id: "c09",
    title: "Highest point",
    text: "Walk to the highest spot you can reach on foot from here and take a photo looking down.",
    hold: 240
  },
  {
    id: "c10",
    title: "Somebody's front door",
    text: "Photograph the most interesting door within two minutes' walk. Interesting is your call and you'll have to defend it.",
    hold: 120
  },
  {
    id: "c11",
    title: "Count the cars",
    text: "Count every car that passes you in three minutes. Say the number out loud on camera at the end.",
    hold: 180
  },
  {
    id: "c12",
    title: "Last one",
    text: "Both of you, on camera, say where you think the others are right now. Then wait.",
    hold: 60
  }
];

// Bumped on every change. footer.js compares these across files and shouts
// if one of them is stale — see the note there.
export const BUILD = "v5 · 2026-09-03";
