import fs from "node:fs";
import path from "node:path";

const templates = [
  ["Drake Hotline Bling", "preference contrast", ["choosing between two options", "rejecting boring work for a fun distraction"], "confident and playful"],
  ["Distracted Boyfriend", "temptation and distraction", ["someone looking away from a task", "new object competing with responsibility"], "relatable and teasing"],
  ["This Is Fine", "ironic understatement", ["messy room or stressful scene", "calm face during chaos"], "dry and deadpan"],
  ["Expanding Brain", "escalating intelligence", ["a simple idea becoming overcomplicated", "creative upgrade or clever hack"], "clever and escalating"],
  ["Woman Yelling at Cat", "miscommunication", ["two subjects reacting differently", "argument versus confused calm"], "expressive and dramatic"],
  ["Success Kid", "small victory", ["celebrating a tiny win", "completed task or lucky moment"], "triumphant and wholesome"],
  ["Change My Mind", "bold hot take", ["person seated confidently", "opinion or campus debate"], "provocative but friendly"],
  ["Two Buttons", "impossible choice", ["person deciding between two stressful options", "deadline or exam dilemma"], "anxious and relatable"],
  ["One Does Not Simply", "difficulty warning", ["someone attempting a difficult task", "last-minute studying or setup"], "dramatic and knowing"],
  ["Mocking SpongeBob", "sarcastic repetition", ["someone making a silly claim", "overconfident excuse"], "sassy and playful"],
  ["Gru's Plan", "plan derailment", ["a step-by-step plan goes wrong", "group project or presentation"], "chaotic and self-aware"],
  ["Bernie Asking", "polite request", ["person waiting or asking for help", "attendance, Wi-Fi, or deadline"], "earnest and campus-relatable"],
  ["Galaxy Brain", "overthinking upgrade", ["ordinary action with increasingly clever versions", "study or productivity hack"], "smart and absurd"],
  ["Leonardo DiCaprio Cheers", "quiet celebration", ["person smiling or holding a drink", "surviving a small social victory"], "cool and amused"],
  ["Is This a Pigeon?", "confident mislabeling", ["person looking at an object", "confusing a simple thing for something else"], "confused and innocent"],
  ["Disaster Girl", "knowing mischief", ["childlike smile near a mess", "someone enjoying a harmless disaster"], "mischievous and PG-13"],
  ["Running Away Balloon", "abandoning responsibility", ["person or object moving away", "escaping chores, class, or a deadline"], "light and escapist"],
  ["Waiting Skeleton", "long wait", ["person waiting or sitting still", "slow Wi-Fi, results, or a reply"], "patiently dramatic"],
  ["Boardroom Meeting", "bad idea rejection", ["people around a table", "team discussion or group project"], "workplace satire"],
  ["Always Has Been", "revelation", ["two people looking at a scene", "realizing a relatable truth"], "cosmic and deadpan"],
];

const campusMoments = [
  ["the assignment portal", "opened the submission page", "the deadline was actually tonight"],
  ["the last slice of pizza", "said I was not hungry", "heard someone say ‘free food’"],
  ["the Wi-Fi symbol", "planned a focused study session", "the lecture video finally loaded"],
  ["the presentation clicker", "practiced the first slide", "the faculty panel said ‘any questions?’"],
  ["attendance", "arrived early for once", "the professor started counting"],
];

const corpus = [];
for (let templateIndex = 0; templateIndex < templates.length; templateIndex += 1) {
  const [template_name, humor_style, sceneTags, tone] = templates[templateIndex];
  for (let variant = 0; variant < campusMoments.length; variant += 1) {
    const [subject, setup, twist] = campusMoments[(variant + templateIndex) % campusMoments.length];
    const examples = [
      `${setup}. ${twist}.`,
      `Me: ${setup}. Also me when I see ${subject}: immediately invested.`,
      `Nobody: absolutely nobody. Me when ${twist}:`,
    ];
    corpus.push({
      id: `${String(templateIndex + 1).padStart(2, "0")}-${String(variant + 1).padStart(2, "0")}`,
      template_name,
      humor_style,
      when_to_use: [...sceneTags, subject, "campus life", "faculty-safe"],
      example_captions: examples,
      tone,
    });
  }
}

const output = path.resolve(process.cwd(), "data/meme-corpus.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(corpus, null, 2) + "\n");
console.log(`Wrote ${corpus.length} meme entries to ${output}`);
