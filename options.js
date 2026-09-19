import { parseRules } from "./duplicate-tabs.js";
import {
  EMPTY_RULES_TEXT,
  readRulesText,
  writeRulesText,
} from "./rules-storage.js";

const rulesField = document.querySelector("#rules");
const saveButton = document.querySelector("#save");
const shortcutHint = document.querySelector("#save-shortcut");
const status = document.querySelector("#status");

const onMac = navigator.userAgent.includes("Mac");

function setStatus(state, message) {
  status.dataset.state = state;
  status.textContent = message;
}

async function loadRules() {
  try {
    rulesField.value = await readRulesText();
  } catch (error) {
    rulesField.value = EMPTY_RULES_TEXT;
    setStatus("error", `Could not read saved rules: ${error.message}`);
  }
}

async function saveRules() {
  const text = rulesField.value;
  const { rules, errors } = parseRules(text);

  if (errors.length > 0) {
    setStatus("error", errors.join("\n"));
    return;
  }

  try {
    await writeRulesText(text);
  } catch (error) {
    setStatus("error", `Could not save: ${error.message}`);
    return;
  }

  const count = rules.length;
  setStatus(
    "saved",
    count === 0
      ? "Saved. No rules, so only exact duplicates are closed."
      : `Saved ${count} rule${count === 1 ? "" : "s"}.`,
  );
}

saveButton.addEventListener("click", () => {
  void saveRules();
});

rulesField.addEventListener("input", () => {
  setStatus("", "");
});

shortcutHint.textContent = onMac ? "⌘S" : "Ctrl+S";

// The page is an editor, so the browser's own save-page shortcut gives way to
// saving the rules.
document.addEventListener("keydown", (event) => {
  const modifier = onMac ? event.metaKey : event.ctrlKey;
  if (!modifier || event.altKey || event.key.toLowerCase() !== "s") return;

  event.preventDefault();
  void saveRules();
});

await loadRules();
