// Rules are stored as the text typed into the options page rather than as a
// parsed array, so field order, indentation and line breaks come back exactly as
// they were written.
export const RULES_STORAGE_KEY = "rulesText";
export const EMPTY_RULES_TEXT = "[]";

export async function readRulesText() {
  const stored = await chrome.storage.sync.get(RULES_STORAGE_KEY);
  const text = stored[RULES_STORAGE_KEY];
  return typeof text === "string" ? text : EMPTY_RULES_TEXT;
}

export async function writeRulesText(text) {
  await chrome.storage.sync.set({ [RULES_STORAGE_KEY]: text });
}
