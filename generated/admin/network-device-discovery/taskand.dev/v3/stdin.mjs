// Odczyt dokładnie jednego obiektu JSON ze stdin; niepoprawny JSON -> exit 2.
import { stdin } from "node:process";

export async function readStdinJson() {
  let data = "";
  const timer = setInterval(() => {}, 60000); // podtrzymuje pętlę zdarzeń
  try {
    for await (const chunk of stdin) data += chunk;
  } catch {
    clearInterval(timer);
    process.exit(2);
  }
  clearInterval(timer);
  const trimmed = data.trim();
  if (trimmed === "") return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    process.exit(2);
  } catch {
    process.exit(2);
  }
}
