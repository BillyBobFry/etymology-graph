export type StarterQuery = {
  term: string;
  description: string;
};

export const defaultStarterLangCode = "en";

export const etymologyStarterQueries: StarterQuery[] = [
  {
    term: "bread",
    description: "Trace a core inherited word"
  },
  {
    term: "wine",
    description: "Follow a borrowed lineage"
  },
  {
    term: "father",
    description: "Inspect a deep family term"
  },
  {
    term: "cheese",
    description: "Compare source paths"
  }
];

export const doubletStarterQueries: StarterQuery[] = [
  {
    term: "shirt",
    description: "Find same-language relatives"
  },
  {
    term: "chief",
    description: "Compare a borrowed route"
  },
  {
    term: "channel",
    description: "Open a shared-source case"
  },
  {
    term: "fragile",
    description: "Check a learned borrowing"
  }
];
