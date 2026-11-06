import type { CoachHint, CoachHouse, CoachTechnique } from "@/lib/play/coachHint";
import type { InfoGuideLang } from "@/content/infoGuideCopy";
import { rowCol } from "@/lib/play/sudokuGrid";

type LineKind = "row" | "column";
type WingSees = "both wings" | "all three";

type CoachHintStrings = {
  showMore: string;
  closeAriaLabel: string;
  techniqueName: Record<CoachTechnique, string>;
  mistakeL1: string;
  mistakeL2: string;
  notesEmptyL1: string;
  notesProblemL1: string;
  lookAtMarkedCell: string;
  lookAtMarkedCells: string;
  lookForTechnique: (name: string) => string;
  lookInHouse: (house: CoachHouse, houseIndex: number) => string;
  notesIllegal: (digit: number, house: CoachHouse) => string;
  notesEmptyCell: string;
  notesEmptyNeeds: (joined: string) => string;
  notesIncomplete: (joined: string) => string;
  joinDigits: (digits: number[]) => string;
  digitLabel: (digit: number) => string;
  nakedPairL2: (house: CoachHouse) => string;
  hiddenPairL2: (house: CoachHouse) => string;
  pointingPairL2: (digitLabel: string) => string;
  boxLineL2: (house: CoachHouse, digitLabel: string) => string;
  fishL2: (count: 2 | 3, base: LineKind, digitLabel: string, cover: LineKind) => string;
  wingL2: string;
  nakedSingleL3: (digit: number) => string;
  hiddenSingleL3: (house: CoachHouse, digitLabel: string) => string;
  nakedPairL3: (slashed: string, house: CoachHouse) => string;
  hiddenPairL3: (slashed: string, joined: string) => string;
  pointingPairL3: (digitLabel: string, house: CoachHouse, n: number) => string;
  boxLineL3: (house: CoachHouse, digitLabel: string) => string;
  fishDetail: (
    name: "X-Wing" | "Swordfish",
    digitLabel: string,
    base: LineKind,
    baseNumbers: number[],
    coverNumbers: number[],
  ) => string;
  wingL3: (
    name: "XY-Wing" | "XYZ-Wing",
    pivotLabel: string,
    firstWing: string,
    secondWing: string,
    digitLabel: string,
    sees: WingSees,
  ) => string;
};

const TECHNIQUE_NAMES: Record<CoachTechnique, string> = {
  naked_single: "naked single",
  hidden_single: "hidden single",
  naked_pair: "naked pair",
  hidden_pair: "hidden pair",
  pointing_pair: "pointing pair",
  box_line_reduction: "box/line reduction",
  x_wing: "X-Wing",
  swordfish: "Swordfish",
  xy_wing: "XY-Wing",
  xyz_wing: "XYZ-Wing",
};

function joinWithAnd(digits: number[], andWord: string): string {
  if (digits.length === 0) {
    throw new Error("coach hint missing digits");
  }
  if (digits.length === 1) {
    return String(digits[0]);
  }
  if (digits.length === 2) {
    return `${digits[0]} ${andWord} ${digits[1]}`;
  }
  return `${digits.slice(0, -1).join(", ")} ${andWord} ${digits[digits.length - 1]}`;
}

function accusativeDigitLabel(digitLabel: string, nominative: string, accusative: string): string {
  const prefix = `${nominative} `;
  if (!digitLabel.startsWith(prefix)) {
    throw new Error(`expected "${nominative}" digit label, got ${digitLabel}`);
  }
  return `${accusative} ${digitLabel.slice(prefix.length)}`;
}

function uaDigitAccusative(digitLabel: string): string {
  return accusativeDigitLabel(digitLabel, "цифра", "цифру");
}

function byDigitAccusative(digitLabel: string): string {
  return accusativeDigitLabel(digitLabel, "лічба", "лічбу");
}

function joinEnDigits(digits: number[]): string {
  if (digits.length === 0) {
    throw new Error("coach hint missing digits");
  }
  if (digits.length === 1) {
    return String(digits[0]);
  }
  if (digits.length === 2) {
    return `${digits[0]} and ${digits[1]}`;
  }
  return `${digits.slice(0, -1).join(", ")}, and ${digits[digits.length - 1]}`;
}

function enHouseWord(house: CoachHouse): string {
  if (house === "row") {
    return "row";
  }
  if (house === "col") {
    return "column";
  }
  return "box";
}

function enLineNoun(kind: LineKind, count: number): string {
  if (count === 1) {
    return kind;
  }
  if (kind === "row") {
    return "rows";
  }
  return "columns";
}

function enNumberedLines(
  kind: LineKind,
  numbers: number[],
  joinDigits: (digits: number[]) => string,
): string {
  return `${enLineNoun(kind, numbers.length)} ${joinDigits(numbers)}`;
}

function enFishCount(count: 2 | 3): string {
  return count === 2 ? "two" : "three";
}

const EN: CoachHintStrings = {
  showMore: "Show more",
  closeAriaLabel: "Close",
  techniqueName: TECHNIQUE_NAMES,
  mistakeL1: "There's a mistake.",
  mistakeL2: "Look at the marked cells.",
  notesEmptyL1: "Empty cells still need pencil marks.",
  notesProblemL1: "There's a problem in your pencil marks.",
  lookAtMarkedCell: "Look at the marked cell.",
  lookAtMarkedCells: "Look at the marked cells.",
  lookForTechnique: (name) => `Look for a ${name}.`,
  lookInHouse: (house, houseIndex) => `Look in ${enHouseWord(house)} ${houseIndex + 1}.`,
  notesIllegal: (digit, house) => `${digit} is already in this ${enHouseWord(house)}.`,
  notesEmptyCell: "This cell needs pencil marks.",
  notesEmptyNeeds: (joined) => `This cell needs ${joined}.`,
  notesIncomplete: (joined) => `Your pencil marks are missing ${joined}.`,
  joinDigits: joinEnDigits,
  digitLabel: (digit) => `digit ${digit}`,
  nakedPairL2: (house) =>
    `Two cells in this ${enHouseWord(house)} can only be the same two digits, so those digits cannot stay as candidates in the other cells.`,
  hiddenPairL2: (house) =>
    `Two digits in this ${enHouseWord(house)} can only go in two cells, so those two cells cannot keep any other candidates.`,
  pointingPairL2: (digitLabel) => `In this box, ${digitLabel} sits on one line.`,
  boxLineL2: (house, digitLabel) =>
    `On this ${enHouseWord(house)}, ${digitLabel} can only go in this box.`,
  fishL2: (count, base, digitLabel, cover) => {
    const countWord = enFishCount(count);
    return `In ${countWord} ${enLineNoun(base, count)}, ${digitLabel} can only go in the same ${countWord} ${enLineNoun(cover, count)}.`;
  },
  wingL2: "These three cells are a pivot and two wings that share a digit.",
  nakedSingleL3: (digit) => `This cell can only be ${digit}.`,
  hiddenSingleL3: (house, digitLabel) =>
    `In this ${enHouseWord(house)}, ${digitLabel} can only go in this cell.`,
  nakedPairL3: (slashed, house) =>
    `These two cells are a ${slashed} naked pair. Those digits cannot stay as candidates in the other cells of this ${enHouseWord(house)}.`,
  hiddenPairL3: (slashed, joined) =>
    `These two cells are a ${slashed} hidden pair. Remove every candidate except ${joined} from these two cells.`,
  pointingPairL3: (digitLabel, house, n) =>
    `In this box, ${digitLabel} can only go in ${enHouseWord(house)} ${n}, so you can eliminate ${digitLabel} from the rest of ${enHouseWord(house)} ${n}.`,
  boxLineL3: (house, digitLabel) =>
    `On this ${enHouseWord(house)}, ${digitLabel} can only go in this box, so you can eliminate ${digitLabel} from the rest of the box.`,
  fishDetail: (name, digitLabel, base, baseNumbers, coverNumbers) => {
    const cover: LineKind = base === "row" ? "column" : "row";
    const article = name === "X-Wing" ? "an" : "a";
    const cellPhrase = name === "X-Wing" ? "These four cells" : "These cells";
    const those = cover === "row" ? "those rows" : "those columns";
    return `${cellPhrase} are ${article} ${name} on ${digitLabel}. In ${enNumberedLines(base, baseNumbers, joinEnDigits)}, ${digitLabel} can only appear in ${enNumberedLines(cover, coverNumbers, joinEnDigits)}, so you can eliminate ${digitLabel} from the rest of ${those}.`;
  },
  wingL3: (name, pivotLabel, firstWing, secondWing, digitLabel, sees) =>
    `The ${pivotLabel} cell is the ${name} pivot. The ${firstWing} and ${secondWing} cells are its wings; both contain ${digitLabel}, so ${digitLabel} can be eliminated from any cell that sees ${sees}.`,
};

function uaHouseLocative(house: CoachHouse): string {
  if (house === "row") {
    return "рядку";
  }
  if (house === "col") {
    return "стовпці";
  }
  return "квадраті";
}

function uaHouseGenitive(house: CoachHouse): string {
  if (house === "row") {
    return "рядка";
  }
  if (house === "col") {
    return "стовпця";
  }
  return "квадрата";
}

function uaLineLocative(kind: LineKind, count: number): string {
  if (kind === "row") {
    return count === 1 ? "рядку" : "рядках";
  }
  return count === 1 ? "стовпці" : "стовпцях";
}

function uaThoseLines(kind: LineKind): string {
  return kind === "row" ? "цих рядків" : "цих стовпців";
}

function uaFishCount(count: 2 | 3): string {
  return count === 2 ? "двох" : "трьох";
}

function uaNumberedLines(kind: LineKind, numbers: number[]): string {
  return `${uaLineLocative(kind, numbers.length)} ${joinWithAnd(numbers, "і")}`;
}

const UA: CoachHintStrings = {
  showMore: "Показати більше",
  closeAriaLabel: "Закрити",
  techniqueName: TECHNIQUE_NAMES,
  mistakeL1: "Є помилка.",
  mistakeL2: "Подивись на позначені клітинки.",
  notesEmptyL1: "Порожні клітинки ще потребують позначок олівцем.",
  notesProblemL1: "У позначках олівцем є проблема.",
  lookAtMarkedCell: "Подивись на позначену клітинку.",
  lookAtMarkedCells: "Подивись на позначені клітинки.",
  lookForTechnique: (name) => `Шукай ${name}.`,
  lookInHouse: (house, houseIndex) => `Шукай у ${uaHouseLocative(house)} ${houseIndex + 1}.`,
  notesIllegal: (digit, house) => `${digit} уже стоїть у цьому ${uaHouseLocative(house)}.`,
  notesEmptyCell: "Цій клітинці потрібні позначки олівцем.",
  notesEmptyNeeds: (joined) => `Цій клітинці потрібні ${joined}.`,
  notesIncomplete: (joined) => `У позначках олівцем бракує ${joined}.`,
  joinDigits: (digits) => joinWithAnd(digits, "і"),
  digitLabel: (digit) => `цифра ${digit}`,
  nakedPairL2: (house) =>
    `Дві клітинки в цьому ${uaHouseLocative(house)} можуть бути лише тими самими двома цифрами, тож ці цифри не можуть лишатися кандидатами в інших клітинках.`,
  hiddenPairL2: (house) =>
    `Дві цифри в цьому ${uaHouseLocative(house)} можуть стояти лише в двох клітинках, тож ці дві клітинки не можуть тримати інших кандидатів.`,
  pointingPairL2: (digitLabel) => `У цьому квадраті ${digitLabel} стоїть на одній лінії.`,
  boxLineL2: (house, digitLabel) =>
    `У цьому ${uaHouseLocative(house)} ${digitLabel} може стояти лише в цьому квадраті.`,
  fishL2: (count, base, digitLabel, cover) =>
    `У ${uaFishCount(count)} ${uaLineLocative(base, count)} ${digitLabel} може стояти лише в тих самих ${uaFishCount(count)} ${uaLineLocative(cover, count)}.`,
  wingL2: "Ці три клітинки – опора і два крила, що мають спільну цифру.",
  nakedSingleL3: (digit) => `У цій клітинці може бути лише ${digit}.`,
  hiddenSingleL3: (house, digitLabel) =>
    `У цьому ${uaHouseLocative(house)} ${digitLabel} може стояти лише в цій клітинці.`,
  nakedPairL3: (slashed, house) =>
    `Ці дві клітинки – naked pair ${slashed}. Ці цифри не можуть лишатися кандидатами в інших клітинках цього ${uaHouseGenitive(house)}.`,
  hiddenPairL3: (slashed, joined) =>
    `Ці дві клітинки – hidden pair ${slashed}. Прибери всіх кандидатів, крім ${joined}, із цих двох клітинок.`,
  pointingPairL3: (digitLabel, house, n) =>
    `У цьому квадраті ${digitLabel} може стояти лише у ${uaHouseLocative(house)} ${n}, тож ${uaDigitAccusative(digitLabel)} можна прибрати з решти ${uaHouseGenitive(house)} ${n}.`,
  boxLineL3: (house, digitLabel) =>
    `У цьому ${uaHouseLocative(house)} ${digitLabel} може стояти лише в цьому квадраті, тож ${uaDigitAccusative(digitLabel)} можна прибрати з решти квадрата.`,
  fishDetail: (name, digitLabel, base, baseNumbers, coverNumbers) => {
    const cover: LineKind = base === "row" ? "column" : "row";
    const cellPhrase = name === "X-Wing" ? "Ці чотири клітинки" : "Ці клітинки";
    return `${cellPhrase} – ${name} на ${uaDigitAccusative(digitLabel)}. У ${uaNumberedLines(base, baseNumbers)} ${digitLabel} може стояти лише в ${uaNumberedLines(cover, coverNumbers)}, тож ${uaDigitAccusative(digitLabel)} можна прибрати з решти ${uaThoseLines(cover)}.`;
  },
  wingL3: (name, pivotLabel, firstWing, secondWing, digitLabel, sees) => {
    const seesPhrase = sees === "both wings" ? "обидва крила" : "усі три";
    return `Клітинка ${pivotLabel} – опора ${name}. Клітинки ${firstWing} і ${secondWing} – її крила; обидві містять ${uaDigitAccusative(digitLabel)}, тож ${uaDigitAccusative(digitLabel)} можна прибрати з будь-якої клітинки, що бачить ${seesPhrase}.`;
  },
};

function byHouseLocative(house: CoachHouse): string {
  if (house === "row") {
    return "радку";
  }
  if (house === "col") {
    return "слупку";
  }
  return "квадраце";
}

function byHouseGenitive(house: CoachHouse): string {
  if (house === "row") {
    return "радка";
  }
  if (house === "col") {
    return "слупка";
  }
  return "квадрата";
}

function byLineLocative(kind: LineKind, count: number): string {
  if (kind === "row") {
    return count === 1 ? "радку" : "радках";
  }
  return count === 1 ? "слупку" : "слупках";
}

function byThoseLines(kind: LineKind): string {
  return kind === "row" ? "гэтых радкоў" : "гэтых слупкоў";
}

function byFishCount(count: 2 | 3): string {
  return count === 2 ? "двух" : "трох";
}

function byNumberedLines(kind: LineKind, numbers: number[]): string {
  return `${byLineLocative(kind, numbers.length)} ${joinWithAnd(numbers, "і")}`;
}

const BY: CoachHintStrings = {
  showMore: "Паказаць больш",
  closeAriaLabel: "Закрыць",
  techniqueName: TECHNIQUE_NAMES,
  mistakeL1: "Ёсць памылка.",
  mistakeL2: "Паглядзі на пазначаныя клеткі.",
  notesEmptyL1: "Пустыя клеткі яшчэ патрабуюць пазнак алоўкам.",
  notesProblemL1: "У пазнаках алоўкам ёсць праблема.",
  lookAtMarkedCell: "Паглядзі на пазначаную клетку.",
  lookAtMarkedCells: "Паглядзі на пазначаныя клеткі.",
  lookForTechnique: (name) => `Шукай ${name}.`,
  lookInHouse: (house, houseIndex) => `Шукай у ${byHouseLocative(house)} ${houseIndex + 1}.`,
  notesIllegal: (digit, house) => `${digit} ужо стаіць у гэтым ${byHouseLocative(house)}.`,
  notesEmptyCell: "Гэтай клетцы патрэбныя пазнакі алоўкам.",
  notesEmptyNeeds: (joined) => `Гэтай клетцы патрэбныя ${joined}.`,
  notesIncomplete: (joined) => `У пазнаках алоўкам бракуе ${joined}.`,
  joinDigits: (digits) => joinWithAnd(digits, "і"),
  digitLabel: (digit) => `лічба ${digit}`,
  nakedPairL2: (house) =>
    `Дзве клеткі ў гэтым ${byHouseLocative(house)} могуць быць толькі тымі самымі дзвюма лічбамі, таму гэтыя лічбы не могуць заставацца кандыдатамі ў іншых клетках.`,
  hiddenPairL2: (house) =>
    `Дзве лічбы ў гэтым ${byHouseLocative(house)} могуць стаяць толькі ў дзвюх клетках, таму гэтыя дзве клеткі не могуць трымаць іншых кандыдатаў.`,
  pointingPairL2: (digitLabel) => `У гэтым квадраце ${digitLabel} стаіць на адной лініі.`,
  boxLineL2: (house, digitLabel) =>
    `У гэтым ${byHouseLocative(house)} ${digitLabel} можа стаяць толькі ў гэтым квадраце.`,
  fishL2: (count, base, digitLabel, cover) =>
    `У ${byFishCount(count)} ${byLineLocative(base, count)} ${digitLabel} можа стаяць толькі ў тых самых ${byFishCount(count)} ${byLineLocative(cover, count)}.`,
  wingL2: "Гэтыя тры клеткі – апора і два крылы, што маюць супольную лічбу.",
  nakedSingleL3: (digit) => `У гэтай клетцы можа быць толькі ${digit}.`,
  hiddenSingleL3: (house, digitLabel) =>
    `У гэтым ${byHouseLocative(house)} ${digitLabel} можа стаяць толькі ў гэтай клетцы.`,
  nakedPairL3: (slashed, house) =>
    `Гэтыя дзве клеткі – naked pair ${slashed}. Гэтыя лічбы не могуць заставацца кандыдатамі ў іншых клетках гэтага ${byHouseGenitive(house)}.`,
  hiddenPairL3: (slashed, joined) =>
    `Гэтыя дзве клеткі – hidden pair ${slashed}. Прыбяры ўсіх кандыдатаў, акрамя ${joined}, з гэтых дзвюх клетак.`,
  pointingPairL3: (digitLabel, house, n) =>
    `У гэтым квадраце ${digitLabel} можа стаяць толькі ў ${byHouseLocative(house)} ${n}, таму ${byDigitAccusative(digitLabel)} можна прыбраць з астатку ${byHouseGenitive(house)} ${n}.`,
  boxLineL3: (house, digitLabel) =>
    `У гэтым ${byHouseLocative(house)} ${digitLabel} можа стаяць толькі ў гэтым квадраце, таму ${byDigitAccusative(digitLabel)} можна прыбраць з астатку квадрата.`,
  fishDetail: (name, digitLabel, base, baseNumbers, coverNumbers) => {
    const cover: LineKind = base === "row" ? "column" : "row";
    const cellPhrase = name === "X-Wing" ? "Гэтыя чатыры клеткі" : "Гэтыя клеткі";
    return `${cellPhrase} – ${name} на ${byDigitAccusative(digitLabel)}. У ${byNumberedLines(base, baseNumbers)} ${digitLabel} можа стаяць толькі ў ${byNumberedLines(cover, coverNumbers)}, таму ${byDigitAccusative(digitLabel)} можна прыбраць з астатку ${byThoseLines(cover)}.`;
  },
  wingL3: (name, pivotLabel, firstWing, secondWing, digitLabel, sees) => {
    const seesPhrase = sees === "both wings" ? "абодва крылы" : "усе тры";
    return `Клетка ${pivotLabel} – апора ${name}. Клеткі ${firstWing} і ${secondWing} – яе крылы; абедзве маюць ${byDigitAccusative(digitLabel)}, таму ${byDigitAccusative(digitLabel)} можна прыбраць з любой клеткі, што бачыць ${seesPhrase}.`;
  },
};

const COPY_BY_LANG: Record<InfoGuideLang, CoachHintStrings> = {
  en: EN,
  ua: UA,
  by: BY,
};

export function coachHintChrome(lang: InfoGuideLang): {
  showMore: string;
  closeAriaLabel: string;
} {
  const copy = COPY_BY_LANG[lang];
  return { showMore: copy.showMore, closeAriaLabel: copy.closeAriaLabel };
}

export function coachHintText(hint: CoachHint, level: 1 | 2 | 3, lang: InfoGuideLang): string {
  return dropTrailingPeriodIfSingleSentence(coachHintCopy(hint, level, COPY_BY_LANG[lang]));
}

function dropTrailingPeriodIfSingleSentence(text: string): string {
  if (!text.endsWith(".")) {
    return text;
  }
  const withoutPeriod = text.slice(0, -1);
  if (withoutPeriod.includes(".")) {
    return text;
  }
  return withoutPeriod;
}

function coachHintCopy(hint: CoachHint, level: 1 | 2 | 3, copy: CoachHintStrings): string {
  if (hint.kind === "mistake") {
    if (level === 1) {
      return copy.mistakeL1;
    }
    return copy.mistakeL2;
  }
  if (hint.kind === "notes") {
    return notesIssueLine(hint, level, copy);
  }
  if (hint.technique === null) {
    throw new Error("technique coach hint missing technique");
  }
  const name = copy.techniqueName[hint.technique];
  if (level === 1) {
    return copy.lookForTechnique(name);
  }
  if (level === 2) {
    return lookWhere(hint, copy);
  }
  return detailLine(hint, copy);
}

function notesIssueLine(hint: CoachHint, level: 1 | 2 | 3, copy: CoachHintStrings): string {
  if (hint.notes_issue === null) {
    throw new Error("notes coach hint missing notes_issue");
  }
  if (level === 1) {
    if (hint.notes_issue === "empty") {
      return copy.notesEmptyL1;
    }
    return copy.notesProblemL1;
  }
  if (level === 2) {
    return copy.lookAtMarkedCell;
  }
  if (hint.notes_issue === "illegal") {
    if (hint.digit === null || hint.house === null) {
      throw new Error("illegal notes hint missing digit or house");
    }
    return copy.notesIllegal(hint.digit, hint.house);
  }
  if (hint.notes_issue === "empty") {
    if (hint.digits.length === 0) {
      return copy.notesEmptyCell;
    }
    return copy.notesEmptyNeeds(copy.joinDigits(hint.digits));
  }
  return copy.notesIncomplete(copy.joinDigits(hint.digits));
}

function pairHouse(hint: CoachHint): CoachHouse {
  if (hint.house === null) {
    throw new Error("pair coach hint missing house");
  }
  return hint.house;
}

function pointingPairLine(hint: CoachHint): { house: CoachHouse; n: number } {
  if (hint.focus_cells.length < 2) {
    throw new Error("pointing pair missing focus cells");
  }
  const rows = new Set(hint.focus_cells.map((index) => rowCol(index).row));
  const cols = new Set(hint.focus_cells.map((index) => rowCol(index).col));
  if (cols.size === 1) {
    const col = [...cols][0];
    if (col === undefined) {
      throw new Error("pointing pair column missing");
    }
    return { house: "col", n: col + 1 };
  }
  if (rows.size === 1) {
    const row = [...rows][0];
    if (row === undefined) {
      throw new Error("pointing pair row missing");
    }
    return { house: "row", n: row + 1 };
  }
  throw new Error("pointing pair focus cells are not on one line");
}

function lookWhere(hint: CoachHint, copy: CoachHintStrings): string {
  if (hint.technique === "naked_single") {
    return copy.lookAtMarkedCell;
  }
  if (hint.technique === "naked_pair") {
    return copy.nakedPairL2(pairHouse(hint));
  }
  if (hint.technique === "hidden_pair") {
    return copy.hiddenPairL2(pairHouse(hint));
  }
  if (hint.technique === "pointing_pair") {
    if (hint.digit === null) {
      throw new Error("pointing pair coach hint missing digit");
    }
    return copy.pointingPairL2(copy.digitLabel(hint.digit));
  }
  if (hint.technique === "box_line_reduction") {
    if (hint.digit === null) {
      throw new Error("box/line coach hint missing digit");
    }
    return copy.boxLineL2(pairHouse(hint), copy.digitLabel(hint.digit));
  }
  if (hint.technique === "x_wing" || hint.technique === "swordfish") {
    return fishLookWhere(hint, copy);
  }
  if (hint.technique === "xy_wing" || hint.technique === "xyz_wing") {
    return copy.wingL2;
  }
  if (hint.house !== null && hint.house_index !== null) {
    return copy.lookInHouse(hint.house, hint.house_index);
  }
  return copy.lookAtMarkedCells;
}

function slashedDigits(digits: number[]): string {
  if (digits.length === 0) {
    throw new Error("coach hint missing digits");
  }
  return digits.join("/");
}

function fishBaseKind(hint: CoachHint): LineKind {
  if (hint.house === "row") {
    return "row";
  }
  if (hint.house === "col") {
    return "column";
  }
  throw new Error("fish coach hint missing house");
}

function fishCoverKind(base: LineKind): LineKind {
  return base === "row" ? "column" : "row";
}

function fishLookWhere(hint: CoachHint, copy: CoachHintStrings): string {
  if (hint.digit === null) {
    throw new Error("fish coach hint missing digit");
  }
  const base = fishBaseKind(hint);
  const cover = fishCoverKind(base);
  const count = hint.technique === "swordfish" ? 3 : 2;
  return copy.fishL2(count, base, copy.digitLabel(hint.digit), cover);
}

function fishFocusLines(hint: CoachHint): { rows: number[]; cols: number[] } {
  const rows = [...new Set(hint.focus_cells.map((index) => rowCol(index).row))];
  const cols = [...new Set(hint.focus_cells.map((index) => rowCol(index).col))];
  if (rows.length === 0 || cols.length === 0) {
    throw new Error("fish coach hint missing focus cells");
  }
  return { rows, cols };
}

function fishDetailLine(
  hint: CoachHint,
  name: "X-Wing" | "Swordfish",
  copy: CoachHintStrings,
): string {
  if (hint.digit === null) {
    throw new Error(`${name} coach hint missing digit`);
  }
  const base = fishBaseKind(hint);
  const { rows, cols } = fishFocusLines(hint);
  const baseNumbers = (base === "row" ? rows : cols).map((index) => index + 1);
  const coverNumbers = (base === "row" ? cols : rows).map((index) => index + 1);
  if (baseNumbers.length === 0) {
    throw new Error("fish coach hint missing line numbers");
  }
  return copy.fishDetail(name, copy.digitLabel(hint.digit), base, baseNumbers, coverNumbers);
}

function detailLine(hint: CoachHint, copy: CoachHintStrings): string {
  const technique = hint.technique;
  if (technique === null) {
    throw new Error("technique coach hint missing technique");
  }
  if (technique === "naked_single") {
    if (hint.digit === null) {
      throw new Error("naked single coach hint missing digit");
    }
    return copy.nakedSingleL3(hint.digit);
  }
  if (technique === "hidden_single") {
    if (hint.digit === null) {
      throw new Error("hidden single coach hint missing digit");
    }
    return copy.hiddenSingleL3(pairHouse(hint), copy.digitLabel(hint.digit));
  }
  if (technique === "naked_pair") {
    return copy.nakedPairL3(slashedDigits(hint.digits), pairHouse(hint));
  }
  if (technique === "hidden_pair") {
    return copy.hiddenPairL3(slashedDigits(hint.digits), copy.joinDigits(hint.digits));
  }
  if (technique === "pointing_pair") {
    if (hint.digit === null) {
      throw new Error("pointing pair coach hint missing digit");
    }
    const line = pointingPairLine(hint);
    return copy.pointingPairL3(copy.digitLabel(hint.digit), line.house, line.n);
  }
  if (technique === "box_line_reduction") {
    if (hint.digit === null) {
      throw new Error("box/line coach hint missing digit");
    }
    return copy.boxLineL3(pairHouse(hint), copy.digitLabel(hint.digit));
  }
  if (technique === "x_wing") {
    return fishDetailLine(hint, "X-Wing", copy);
  }
  if (technique === "swordfish") {
    return fishDetailLine(hint, "Swordfish", copy);
  }
  if (technique === "xy_wing") {
    return wingTechniqueLine(hint, "XY-Wing", "both wings", copy);
  }
  if (technique === "xyz_wing") {
    return wingTechniqueLine(hint, "XYZ-Wing", "all three", copy);
  }
  throw new Error(`unhandled coach technique: ${technique}`);
}

function candidateSetLabel(digits: number[]): string {
  if (digits.length === 0) {
    throw new Error("coach hint missing digits");
  }
  return `(${digits.join(", ")})`;
}

function wingTechniqueLine(
  hint: CoachHint,
  name: "XY-Wing" | "XYZ-Wing",
  sees: WingSees,
  copy: CoachHintStrings,
): string {
  if (hint.digit === null) {
    throw new Error(`${name} coach hint missing digit`);
  }
  const sharedDigit = hint.digit;
  const pivotDigits = [...hint.digits].sort((left, right) => left - right);
  const axisDigits = pivotDigits.filter((digit) => digit !== sharedDigit);
  if (axisDigits.length !== 2) {
    throw new Error(`${name} pivot digits do not yield two wings`);
  }
  const wingLabels = axisDigits
    .map((digit) => candidateSetLabel([digit, sharedDigit].sort((left, right) => left - right)))
    .sort((left, right) => left.localeCompare(right));
  const firstWing = wingLabels[0];
  const secondWing = wingLabels[1];
  if (firstWing === undefined || secondWing === undefined) {
    throw new Error(`${name} missing wing labels`);
  }
  return copy.wingL3(
    name,
    candidateSetLabel(pivotDigits),
    firstWing,
    secondWing,
    copy.digitLabel(sharedDigit),
    sees,
  );
}

export function coachOutlineCells(hint: CoachHint, level: 1 | 2 | 3): number[] {
  if (level === 1) {
    return [];
  }
  if (hint.kind === "mistake") {
    return hint.error_indices;
  }
  if (hint.kind === "notes") {
    if (level === 2) {
      return hint.focus_cells;
    }
    return hint.outline_cells;
  }
  if (level === 2) {
    return hint.outline_cells;
  }
  return hint.focus_cells;
}

export function coachElimCells(hint: CoachHint, level: 1 | 2 | 3): number[] {
  if (level !== 3 || hint.kind !== "technique") {
    return [];
  }
  return hint.elim_cells;
}

export function coachMaxLevel(hint: CoachHint): 2 | 3 {
  return hint.kind === "mistake" ? 2 : 3;
}
