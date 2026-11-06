import type { InfoGuideLang } from "@/content/infoGuideCopy";

export type TechniqueArticleId =
  | "pencil"
  | "naked_single"
  | "hidden_single"
  | "naked_pair"
  | "hidden_pair"
  | "pointing_pair"
  | "box_line_reduction"
  | "x_wing"
  | "swordfish"
  | "xy_wing"
  | "xyz_wing";

export type TechniqueArticleCopy = {
  id: TechniqueArticleId;
  name: string;
  oneLiner: string;
  idea: string[];
  example: string[];
  confirmation: string;
  hasPractice: boolean;
};

export type TechniquesGuideCopy = {
  indexIntro: string;
  practiceThis: string;
  practiceFind: (name: string) => string;
  practiceFillNotes: string;
  practiceGotIt: string;
  articles: TechniqueArticleCopy[];
};

export type TechniqueProgressCounts = {
  poolSize: number;
  solvedCount: number;
};

export const TECHNIQUE_ARTICLE_ORDER: readonly TechniqueArticleId[] = [
  "pencil",
  "naked_single",
  "hidden_single",
  "naked_pair",
  "hidden_pair",
  "pointing_pair",
  "box_line_reduction",
  "x_wing",
  "swordfish",
  "xy_wing",
  "xyz_wing",
] as const;

export const TECHNIQUE_EN_NAMES: readonly { id: TechniqueArticleId; name: string }[] = [
  { id: "box_line_reduction", name: "box/line reduction" },
  { id: "pointing_pair", name: "pointing pair" },
  { id: "hidden_single", name: "hidden single" },
  { id: "naked_single", name: "naked single" },
  { id: "hidden_pair", name: "hidden pair" },
  { id: "naked_pair", name: "naked pair" },
  { id: "xyz_wing", name: "XYZ-Wing" },
  { id: "xy_wing", name: "XY-Wing" },
  { id: "swordfish", name: "Swordfish" },
  { id: "x_wing", name: "X-Wing" },
];

const COPY_BY_LANG: Record<InfoGuideLang, TechniquesGuideCopy> = {
  en: {
    indexIntro:
      "Choose a technique to see how it works on a real grid. We invite you to learn the theory and examples, then practice on special puzzles where the next move is the technique you are studying.",
    practiceThis: "Practice this",
    practiceFind: (name) => `Find ${name}`,
    practiceFillNotes: "Fill the missing pencil marks",
    practiceGotIt: "Got it",
    articles: [
      {
        id: "pencil",
        name: "Pencil marks",
        oneLiner: "A note is a digit that can still go in that empty cell.",
        idea: [
          "Without pencil marks there is nothing to do on medium and hard.",
          "During a game, turn on Pencil at the bottom right. Then a tap on a keypad digit writes a note, not a final digit.",
        ],
        example: [
          "On this board r1c3 can only be 4 and 5 – write those in pencil so you can see them.",
        ],
        confirmation: "r1c3 now has 4 and 5.",
        hasPractice: true,
      },
      {
        id: "naked_single",
        name: "Naked single",
        oneLiner: "If only one digit can go in an empty cell, write it in.",
        idea: [
          "Pick an empty cell and see which digits can still go there. If there's only one – write it in. That's a naked single.",
        ],
        example: [
          "In the highlighted cell only 4 can stand, because every other digit already appears in its row, column, or box.",
        ],
        confirmation: "r5c6 is 4.",
        hasPractice: true,
      },
      {
        id: "hidden_single",
        name: "Hidden single",
        oneLiner: "If a digit can go in only one cell of a row, column, or box, it belongs there.",
        idea: [
          "Pick any row, column, or box. If some digit can go in only one cell there – that's a hidden single.",
        ],
        example: [
          "Look at row 8 on the board above. In that whole row, 6 can stand only in r8c4 – write it in.",
        ],
        confirmation: "6 belongs in r8c4.",
        hasPractice: true,
      },
      {
        id: "naked_pair",
        name: "Naked pair",
        oneLiner:
          "Two cells that can hold only the same two digits lock those digits in that row, column, or box.",
        idea: [
          "In one house (row/column/box), find two cells that can hold only two identical digits. Then in the rest of that house those digits cannot stand.",
        ],
        example: [
          "Look at box 6 on the board above.",
          "In r6c8 and r6c9 only 4 and 8 can stand. That means none of the other cells in this box can hold 4 or 8. You can strike them from the candidates in r4c8 and r4c9.",
          "The same is true for row 6 – you can strike candidates 4 and 8 from there too (but in this puzzle they are already gone).",
        ],
        confirmation: "4 is gone from the rest of box 6. The pair still holds 4 and 8.",
        hasPractice: true,
      },
      {
        id: "hidden_pair",
        name: "Hidden pair",
        oneLiner:
          "Two digits that appear as candidates only in the same two cells of a house own those cells; erase every other note there.",
        idea: [
          "Look at the candidates in every empty cell of one house (row/column/box). Hunt for two digits that, in this house, can stand only in the same two cells.",
          "We do not yet know in which of these two cells which digit will stand, but we do know no other digits will stand in those two cells. You can erase the extra candidates from them.",
        ],
        example: [
          "Look at row 8.",
          "Digit 6 can stand only in r8c4 and r8c8. Digit 8 too. So both of those cells will be either 6 or 8.",
          "Conclusion: every other candidate in those two cells can go: 2, 5, and 7.",
        ],
        confirmation: "r8c4 and r8c8 keep only 6 and 8.",
        hasPractice: true,
      },
      {
        id: "pointing_pair",
        name: "Pointing pair",
        oneLiner: "If a digit in a box sits on only one line, it leaves that line outside the box.",
        idea: [
          "This is the same logic as box/line reduction, only the other way around.",
          "Choose a box and one of the candidate digits in it. If every cell in the box where that digit can stand sits on one line, then that digit cannot stand anywhere else on that line.",
          "You can strike it as a candidate from every cell of that line outside the box.",
        ],
        example: [
          "Look at box 4. Digit 5 in this box can stand only on row 4: r4c1, r4c2, and r4c3.",
          "So 5 cannot stand on the rest of row 4 outside this box. Strike 5 from r4c7.",
        ],
        confirmation: "5 is gone from row 4 outside box 4.",
        hasPractice: true,
      },
      {
        id: "box_line_reduction",
        name: "Box/line reduction",
        oneLiner: "If a digit on a line sits only inside one box, it leaves the rest of that box.",
        idea: [
          "Logic of pointing pair, only the other way around.",
          "Find a row or a column where one digit sits as a candidate only inside one box.",
          "That pattern means this digit in that box can stand only in those 2–3 cells. You can strike it from every other cell of the box.",
        ],
        example: [
          "Look at column 8. Digit 5 can stand only in the top-right box: r1c8 and r3c8. So 5 cannot stand in the rest of that box off column 8. Strike 5 from r3c7.",
        ],
        confirmation: "5 is gone from the top-right box off column 8.",
        hasPractice: true,
      },
      {
        id: "x_wing",
        name: "X-Wing",
        oneLiner:
          "A digit that makes a rectangle in two lines leaves the other cells of the crossing lines.",
        idea: [
          "Like pointing pair, only bigger: the digit is locked in two rows and two columns at once.",
          "Choose one digit. Find two columns in each of which this digit can stand only in two rows, and those rows are the same for both columns. Those four cells make a rectangle.",
          "We do not know yet which 2 of these 4 cells will hold our digit, but exactly 2 of these 4 will. So from the rest of these 2 rows you can strike that digit.",
          "The same technique can start from rows: two rows in each of which this digit can stand only in two columns, and those columns are the same for both rows – then you strike it from the rest of those columns.",
        ],
        example: [
          "Look at digit 3 in columns 2 and 8. It can stand only in rows 6 and 7: r6c2, r6c8, r7c2, and r7c8. So 3 cannot stand in the rest of rows 6 and 7. Strike it there.",
        ],
        confirmation: "3 is gone from the rest of rows 6 and 7.",
        hasPractice: true,
      },
      {
        id: "swordfish",
        name: "Swordfish",
        oneLiner:
          "A digit that lives in three lines only on the same three crossing lines leaves the rest of those crossing lines.",
        idea: [
          "Like X-Wing, only bigger: 3 lines instead of 2.",
          "Choose one digit. Find three rows in each of which this digit can stand only in three columns, and those columns are the same for all three rows.",
          "We do not know yet which cells of those rows will take the digit, but we know it cannot stand anywhere else on those three columns. From the remaining cells of these columns you can strike this digit.",
          "The same technique can start from columns: three columns in each of which this digit can stand only in three rows, and those rows are the same for all three columns – then you strike it from the rest of those rows.",
        ],
        example: [
          "Look at digit 9 in rows 1, 5, and 9.",
          "In row 1 it can stand only in r1c3 and r1c7. In row 5 – only in r5c3 and r5c6. In row 9 – only in r9c6 and r9c7. All three rows are locked to the same columns 3, 6, and 7.",
          "So 9 cannot stand in those columns outside the three rows. Strike it from r2c3, r2c7, r4c6, and r6c7.",
        ],
        confirmation: "9 is gone from columns 3, 6, and 7 outside rows 1, 5, and 9.",
        hasPractice: true,
      },
      {
        id: "xy_wing",
        name: "XY-Wing",
        oneLiner:
          "A pivot {X,Y} and two wings {X,Z} and {Y,Z}: any cell that sees both wings loses Z.",
        idea: [
          "You need a combination of three cells. First find the pivot: any cell with exactly two candidates {X,Y}. Then look at every cell the pivot sees – the rest of its row, column, and box (20 cells).",
          "Among them, find two cells with candidates {X,Z} and {Y,Z}: each shares one digit with the pivot, plus one digit in common. Those two cells are the wings.",
          "Now find a cell that both wings see. Strike candidate Z from it: that digit is guaranteed to stand in one of the two wings.",
        ],
        example: [
          "In this example the pivot is r3c2 {4,5}. The wings are r3c7 {3,4} and r9c2 {3,5}. Each wing has one of the pivot digits plus one digit in common. Both wings see r9c7 – strike 3 from there, because 3 is guaranteed to stand in one of the wings.",
        ],
        confirmation: "3 is gone from r9c7.",
        hasPractice: true,
      },
      {
        id: "xyz_wing",
        name: "XYZ-Wing",
        oneLiner:
          "A pivot {X,Y,Z} and wings {X,Z} and {Y,Z}: a cell that sees the pivot and both wings loses Z.",
        idea: [
          "Like XY-Wing, only the pivot has three candidates {X,Y,Z}. First find the pivot: any cell with exactly three candidates. Then look at every cell the pivot sees – the rest of its row, column, and box (20 cells).",
          "Among them, find two cells with candidates {X,Z} and {Y,Z}: each shares two digits with the pivot, including the shared Z. Those two cells are the wings.",
          "Now find a cell that sees the pivot and both wings. Strike candidate Z from it: whichever of X, Y, or Z the pivot takes, Z still stands in one of those three cells.",
        ],
        example: [
          "In this example the pivot is r6c7 {3,6,8}. The wings are r3c7 {6,8} and r6c8 {3,8}. Each wing has two of the pivot digits, and they share 8. r4c7 sees the pivot and both wings – strike 8 from there, because 8 is guaranteed to stand in one of those three cells.",
        ],
        confirmation: "8 is gone from r4c7.",
        hasPractice: true,
      },
    ],
  },
  ua: {
    indexIntro:
      "Оберіть техніку, щоб побачити, як вона працює на сітці. Ми пропонуємо вивчити теорію та приклади застосування, а потім потренуватися на спеціальних пазлах, де наступний хід – це техніка, яку ви вивчаєте.",
    practiceThis: "Practice this",
    practiceFind: (name) => `Знайдіть ${name}`,
    practiceFillNotes: "Заповніть відсутні позначки олівцем",
    practiceGotIt: "Зрозуміло",
    articles: [
      {
        id: "pencil",
        name: "Позначки олівцем",
        oneLiner: "Позначка – цифра, яка ще може стояти в цій порожній клітинці.",
        idea: [
          "Без позначок олівцем на medium і hard робити нічого.",
          "Під час гри ввімкніть Pencil внизу справа. Тоді натискання цифри на клавіатурі впише позначку, а не фінальну цифру.",
        ],
        example: [
          "На цій дошці в клітинці r1c3 можуть бути лише 4 і 5 – запишіть їх олівцем для наочності.",
        ],
        confirmation: "У r1c3 тепер 4 і 5.",
        hasPractice: true,
      },
      {
        id: "naked_single",
        name: "Naked single",
        oneLiner: "Якщо в порожню клітинку пасує лише одна цифра – вписуйте її.",
        idea: [
          "Оберіть порожню клітинку й подивіться, які цифри туди ще можуть стати. Якщо така цифра тільки одна – вписуйте її. Це і є naked single.",
        ],
        example: [
          "У виділеній клітинці може стояти лише 4, бо всі інші цифри вже стоять у рядку, стовпці або квадраті цієї клітинки.",
        ],
        confirmation: "r5c6 – це 4.",
        hasPractice: true,
      },
      {
        id: "hidden_single",
        name: "Hidden single",
        oneLiner:
          "Якщо цифра в рядку, стовпці чи квадраті пасує лише в одну клітинку – вона саме там.",
        idea: [
          "Оберіть будь-який рядок, стовпець або квадрат. Якщо якась цифра може стояти в ньому лише в одній клітинці – це hidden single.",
        ],
        example: [
          "Подивіться на рядок 8 на дошці вище. У всьому рядку цифра 6 може стояти лише в r8c4 – вписуйте її туди.",
        ],
        confirmation: "6 належить r8c4.",
        hasPractice: true,
      },
      {
        id: "naked_pair",
        name: "Naked pair",
        oneLiner:
          "Дві клітинки, у яких можуть стояти лише ті самі дві цифри, замикають їх у цьому рядку, стовпці чи квадраті.",
        idea: [
          "В одному домі (рядку/стовпці/квадраті) знайдіть дві клітинки, у яких можуть стояти лише дві однакові цифри. Тоді в решті цього дому цих цифр уже не буде.",
        ],
        example: [
          "Подивіться на квадрат 6 на дошці вище.",
          "У r6c8 і r6c9 можуть стояти лише 4 і 8. Це означає, що в усіх інших клітинках цього квадрата цифр 4 і 8 уже не буде. Їх можна викреслити з кандидатів у r4c8 і r4c9.",
          "Те саме справедливо і для рядка 6 – звідти кандидатів 4 і 8 теж можна викреслювати (але в цьому пазлі їх там і так немає).",
        ],
        confirmation: "4 зникла з решти квадрата 6. Пара досі тримає 4 і 8.",
        hasPractice: true,
      },
      {
        id: "hidden_pair",
        name: "Hidden pair",
        oneLiner:
          "Дві цифри, які в домі стоять кандидатами лише в тих самих двох клітинках, забирають ці клітинки; зітріть там усі інші notes.",
        idea: [
          "Подивіться на кандидатів у всіх порожніх клітинках одного дому (рядка/стовпця/квадрата). Шукайте дві цифри, які в цьому домі можуть стояти лише в одних і тих самих двох клітинках.",
          "Ми ще не знаємо, в якій із цих двох клітинок яка цифра стоятиме, але точно знаємо, що інших цифр у цих двох клітинках не буде. Інших кандидатів із цих клітинок можна видаляти.",
        ],
        example: [
          "Подивіться на рядок 8.",
          "Цифра 6 може стояти лише в клітинках r8c4 і r8c8. Цифра 8 теж. Отже, в обох цих клітинках буде або 6, або 8.",
          "Висновок: усіх інших кандидатів із цих двох клітинок можна видаляти (2, 5 і 7).",
        ],
        confirmation: "r8c4 і r8c8 тримають лише 6 і 8.",
        hasPractice: true,
      },
      {
        id: "pointing_pair",
        name: "Pointing pair",
        oneLiner:
          "Якщо цифра в квадраті сидить лише на одній лінії, вона йде з цієї лінії поза квадратом.",
        idea: [
          "Це та сама логіка, що й box/line reduction, тільки навпаки.",
          "Оберіть квадрат і одну з цифр-кандидатів у ньому. Якщо всі клітинки квадрата, де може стояти ця цифра, лежать на одній лінії, значить на цій лінії цієї цифри більше ніде не буде.",
          "Цю цифру можна викреслити як кандидата з усіх клітинок цієї лінії за межами цього квадрата.",
        ],
        example: [
          "Подивіться на квадрат 4. Цифра 5 у цьому квадраті може стояти лише на рядку 4: r4c1, r4c2 і r4c3.",
          "Тож на решті рядка 4 поза цим квадратом 5 бути не може. Викресліть 5 з r4c7.",
        ],
        confirmation: "5 зникла з рядка 4 поза box 4.",
        hasPractice: true,
      },
      {
        id: "box_line_reduction",
        name: "Box/line reduction",
        oneLiner:
          "Якщо цифра на лінії сидить лише всередині одного квадрата, вона йде з решти цього квадрата.",
        idea: [
          "Логіка, що й pointing pair, тільки навпаки.",
          "Знайдіть такий рядок або стовпець, де одна з цифр стоїть кандидатом лише в межах одного квадрата.",
          "Такий візерунок гарантує, що ця цифра в цьому квадраті може стояти лише в цих 2–3 клітинках. З усіх інших клітинок цього квадрата цю цифру можна прибрати.",
        ],
        example: [
          "Подивіться на стовпець 8. Цифра 5 може стояти лише у верхньому правому квадраті: r1c8 і r3c8. Тож у решті цього квадрата поза стовпцем 8 її бути не може. Викресліть 5 з r3c7.",
        ],
        confirmation: "5 зникла з верхнього правого квадрата поза стовпцем 8.",
        hasPractice: true,
      },
      {
        id: "x_wing",
        name: "X-Wing",
        oneLiner:
          "Цифра, що малює прямокутник на двох лініях, йде з інших клітинок поперечних ліній.",
        idea: [
          "Як pointing pair, тільки масштабніше: цифра замкнена одразу в двох рядках і двох стовпцях.",
          "Оберіть одну цифру. Знайдіть два стовпці, у кожному з яких ця цифра може стояти лише в двох рядках, і ці рядки в обох стовпцях одні й ті самі. Чотири клітинки дають прямокутник.",
          "Ми ще не знаємо, у яких саме 2 з 4 цих клітинок стоятиме наша цифра, але точно в 2 з цих 4. Отже, з решти цих 2 рядків цю цифру можна викреслити.",
          "Той самий прийом можна починати з рядків: два рядки, у кожному з яких ця цифра може стояти лише в двох стовпцях, і ці стовпці в обох рядках одні й ті самі – тоді викреслюєте її з решти цих стовпців.",
        ],
        example: [
          "Подивіться на цифру 3 у стовпцях 2 і 8. Вона може стояти лише в рядках 6 і 7: r6c2, r6c8, r7c2 і r7c8. Тож у решті рядків 6 і 7 її бути не може. Викресліть її там.",
        ],
        confirmation: "3 зникла з решти рядків 6 і 7.",
        hasPractice: true,
      },
      {
        id: "swordfish",
        name: "Swordfish",
        oneLiner:
          "Цифра, яка в трьох лініях живе лише на тих самих трьох поперечних, йде з решти цих поперечних.",
        idea: [
          "Як X-Wing, тільки масштабніше: 3 лінії замість 2.",
          "Оберіть одну цифру. Знайдіть три рядки, у кожному з яких ця цифра може стояти лише в трьох стовпцях, і ці стовпці в усіх трьох рядках одні й ті самі.",
          "Ми ще не знаємо, у яких саме клітинках цих рядків вона стане, але знаємо, що ніде більше на цих трьох стовпцях її бути не може. З решти клітинок цих стовпців цю цифру можна викреслювати.",
          "Той самий прийом можна починати зі стовпців: три стовпці, у кожному з яких ця цифра може стояти лише в трьох рядках, і ці рядки в усіх трьох стовпцях одні й ті самі – тоді викреслюєте її з решти цих рядків.",
        ],
        example: [
          "Подивіться на цифру 9 у рядках 1, 5 і 9.",
          "У рядку 1 вона може стояти лише в r1c3 і r1c7. У рядку 5 – лише в r5c3 і r5c6. У рядку 9 – лише в r9c6 і r9c7. Усі три рядки замкнені на ті самі стовпці 3, 6 і 7.",
          "Тож у цих стовпцях поза трьома рядками 9 бути не може. Викресліть її з r2c3, r2c7, r4c6 і r6c7.",
        ],
        confirmation: "9 зникла зі стовпців 3, 6 і 7 поза рядками 1, 5 і 9.",
        hasPractice: true,
      },
      {
        id: "xy_wing",
        name: "XY-Wing",
        oneLiner:
          "Pivot {X,Y} і два крила {X,Z} та {Y,Z}: клітинка, яка бачить обидва крила, втрачає Z.",
        idea: [
          "Потрібна комбінація з трьох клітинок. Спочатку шукаємо pivot: беремо будь-яку клітинку, де всього 2 кандидати {X,Y}. Далі дивимось на всі клітинки, які «бачить» pivot – це всі клітинки того ж рядка, стовпця і квадрата (20 клітинок).",
          "Серед них треба знайти такі, у яких кандидати {X,Z} і {Y,Z}: у кожної по одній цифрі pivot плюс ще одна спільна. Ці дві клітинки називаються крилами.",
          "Тепер шукаємо клітинку, яку «бачать» обидва крила – з неї можна викреслити кандидата Z, бо ця цифра гарантовано вже буде в цьому стовпці/рядку через два крила.",
        ],
        example: [
          "У цьому прикладі pivot – це r3c2 {4,5}. Крила: r3c7 {3,4} і r9c2 {3,5}. В обох крил одна з цифр pivot плюс одна спільна. Обидва крила бачать клітинку r9c7 – звідти можна викреслити 3, бо вона гарантовано буде в одному з крил.",
        ],
        confirmation: "3 зникла з r9c7.",
        hasPractice: true,
      },
      {
        id: "xyz_wing",
        name: "XYZ-Wing",
        oneLiner:
          "Pivot {X,Y,Z} і крила {X,Z} та {Y,Z}: клітинка, яка бачить pivot і обидва крила, втрачає Z.",
        idea: [
          "Як XY-Wing, тільки в pivot три кандидати {X,Y,Z}. Спочатку шукаємо pivot: беремо будь-яку клітинку, де рівно три кандидати. Далі дивимось на всі клітинки, які «бачить» pivot – це всі клітинки того ж рядка, стовпця і квадрата (20 клітинок).",
          "Серед них треба знайти такі, у яких кандидати {X,Z} і {Y,Z}: у кожної по дві цифри pivot, включно зі спільною Z. Ці дві клітинки називаються крилами.",
          "Тепер шукаємо клітинку, яка бачить pivot і обидва крила – з неї можна викреслити кандидата Z: яку б із X, Y чи Z не взяв pivot, Z усе одно стоятиме в одній із цих трьох клітинок.",
        ],
        example: [
          "У цьому прикладі pivot – це r6c7 {3,6,8}. Крила: r3c7 {6,8} і r6c8 {3,8}. В обох крил дві цифри pivot, і вони ділять 8. r4c7 бачить pivot і обидва крила – звідти можна викреслити 8, бо вона гарантовано буде в одній із цих трьох клітинок.",
        ],
        confirmation: "8 зникла з r4c7.",
        hasPractice: true,
      },
    ],
  },
  by: {
    indexIntro:
      "Абярыце тэхніку, каб убачыць, як яна працуе на сетцы. Мы прапануем вывучыць тэорыю і прыклады выкарыстання, а потым патрэніравацца на спецыяльных пазлах, дзе наступны ход – гэта тэхніка, якую вы вывучаеце.",
    practiceThis: "Practice this",
    practiceFind: (name) => `Знайдзіце ${name}`,
    practiceFillNotes: "Запоўніце адсутныя пазнакі алоўкам",
    practiceGotIt: "Зразумела",
    articles: [
      {
        id: "pencil",
        name: "Пазнакі алоўкам",
        oneLiner: "Пазнака – лічба, якая яшчэ можа стаяць у гэтай пустой клетцы.",
        idea: [
          "Без пазнак алоўкам на medium і hard рабіць няма чаго.",
          "Падчас гульні ўключыце Pencil унізе справа. Тады націсканне лічбы на клавіятуры ўпіша пазнаку, а не фінальную лічбу.",
        ],
        example: [
          "На гэтай дошцы ў клетцы r1c3 могуць быць толькі 4 і 5 – запішыце іх алоўкам для нагляднасці.",
        ],
        confirmation: "У r1c3 цяпер 4 і 5.",
        hasPractice: true,
      },
      {
        id: "naked_single",
        name: "Naked single",
        oneLiner: "Калі ў пустую клетку пасуе толькі адна лічба – упісвайце яе.",
        idea: [
          "Абярыце пустую клетку і паглядзіце, якія лічбы туды яшчэ могуць стаць. Калі такая лічба толькі адна – упісвайце яе. Гэта і ёсць naked single.",
        ],
        example: [
          "У вылучанай клетцы можа стаяць толькі 4, бо ўсе іншыя лічбы ўжо стаяць у радку, слупку або квадраце гэтай клеткі.",
        ],
        confirmation: "r5c6 – гэта 4.",
        hasPractice: true,
      },
      {
        id: "hidden_single",
        name: "Hidden single",
        oneLiner:
          "Калі лічба ў радку, слупку ці квадраце пасуе толькі ў адну клетку – яна менавіта там.",
        idea: [
          "Абярыце любы радок, слупок або квадрат. Калі нейкая лічба можа стаяць у ім толькі ў адной клетцы – гэта hidden single.",
        ],
        example: [
          "Паглядзіце на радок 8 на дошцы вышэй. Ва ўсім радку лічба 6 можа стаяць толькі ў r8c4 – ставім яе туды.",
        ],
        confirmation: "6 належыць r8c4.",
        hasPractice: true,
      },
      {
        id: "naked_pair",
        name: "Naked pair",
        oneLiner:
          "Дзве клеткі, у якіх могуць стаяць толькі тыя самыя дзве лічбы, замыкаюць іх у гэтым радку, слупку ці квадраце.",
        idea: [
          "У адным доме (радку/слупку/квадраце) знайдзіце дзве клеткі, у якіх могуць стаяць толькі дзве аднолькавыя лічбы. Тады ў рэшце гэтага дома гэтых лічбаў ужо не будзе.",
        ],
        example: [
          "Паглядзіце на квадрат 6 на дошцы вышэй.",
          "У r6c8 і r6c9 могуць стаяць толькі 4 і 8. Гэта значыць, што ва ўсіх астатніх клетках гэтага квадрата лічбаў 4 і 8 ужо не будзе. Іх можна выкрасліць з кандыдатаў у r4c8 і r4c9.",
          "Тое самае справядліва і для радка 6 – адтуль кандыдатаў 4 і 8 таксама можна выкрасліць (але ў гэтым пазле іх там і так няма).",
        ],
        confirmation: "4 знікла з рэшты квадрата 6. Пара дасюль трымае 4 і 8.",
        hasPractice: true,
      },
      {
        id: "hidden_pair",
        name: "Hidden pair",
        oneLiner:
          "Дзве лічбы, якія ў доме стаяць кандыдатамі толькі ў тых самых двух клетках, забіраюць гэтыя клеткі; сцірыце там усе іншыя notes.",
        idea: [
          "Паглядзіце на кандыдатаў ва ўсіх пустых клетках аднаго дома (радка/слупка/квадрата). Шукайце дзве лічбы, якія ў гэтым доме могуць стаяць толькі ў адных і тых жа двух клетках.",
          "Мы пакуль не ведаем, у якой з гэтых двух клетак якая лічба будзе стаяць, але дакладна ведаем, што іншых лічбаў у гэтых двух клетках не будзе. Іншых кандыдатаў з гэтых клетак можна выдаляць.",
        ],
        example: [
          "Паглядзіце на радок 8.",
          "Лічба 6 можа стаяць толькі ў клетках r8c4 і r8c8. Лічба 8 таксама. Значыць, у абедзвюх гэтых клетках будзе або 6, або 8.",
          "Выснова: усіх астатніх кандыдатаў з гэтых двух клетак можна выдаляць (2, 5 і 7).",
        ],
        confirmation: "r8c4 і r8c8 трымаюць толькі 6 і 8.",
        hasPractice: true,
      },
      {
        id: "pointing_pair",
        name: "Pointing pair",
        oneLiner:
          "Калі лічба ў квадраце сядзіць толькі на адной лініі, яна сыходзіць з гэтай лініі па-за квадратам.",
        idea: [
          "Гэта тая самая логіка, што і box/line reduction, толькі наадварот.",
          "Выберыце квадрат і адну з лічбаў-кандыдатаў у ім. Калі ўсе клеткі квадрата, дзе можа стаяць гэтая лічба, ляжаць на адной лініі, значыць на гэтай лініі гэтай лічбы больш нідзе не будзе.",
          "Гэтую лічбу можна выкрасліць як кандыдата з усіх клетак гэтай лініі па-за гэтым квадратам.",
        ],
        example: [
          "Паглядзіце на квадрат 4. Лічба 5 у гэтым квадраце можа стаяць толькі на радку 4: r4c1, r4c2 і r4c3.",
          "Таму на рэшце радка 4 па-за гэтым квадратам 5 быць не можа. Выкрасліце 5 з r4c7.",
        ],
        confirmation: "5 знікла з радка 4 па-за box 4.",
        hasPractice: true,
      },
      {
        id: "box_line_reduction",
        name: "Box/line reduction",
        oneLiner:
          "Калі лічба на лініі сядзіць толькі ўнутры аднаго квадрата, яна сыходзіць з рэшты гэтага квадрата.",
        idea: [
          "Логіка, што і pointing pair, толькі наадварот.",
          "Знайдзіце такі радок або слупок, дзе адна з лічбаў стаіць кандыдатам толькі ў межах аднаго квадрата.",
          "Такі ўзор гарантуе, што гэтая лічба ў гэтым квадраце можа стаяць толькі ў гэтых 2–3 клетках. З усіх астатніх клетак гэтага квадрата гэтую лічбу можна прыбраць.",
        ],
        example: [
          "Паглядзіце на слупок 8. Лічба 5 можа стаяць толькі ў верхнім правым квадраце: r1c8 і r3c8. Таму ў рэшце гэтага квадрата па-за слупком 8 яе быць не можа. Выкрасліце 5 з r3c7.",
        ],
        confirmation: "5 знікла з верхняга правага квадрата па-за слупком 8.",
        hasPractice: true,
      },
      {
        id: "x_wing",
        name: "X-Wing",
        oneLiner:
          "Лічба, што малюе прамавугольнік на двух лініях, сыходзіць з іншых клетак папярочных ліній.",
        idea: [
          "Як pointing pair, толькі маштабней: лічба замкнёная адразу ў двух радках і двух слупках.",
          "Абярыце адну лічбу. Знайдзіце два слупкі, у кожным з якіх гэтая лічба можа стаяць толькі ў двух радках, і гэтыя радкі ў абодвух слупкоў адны і тыя ж. Чатыры клеткі даюць прамавугольнік.",
          "Мы пакуль не ведаем, у якіх менавіта 2 з 4 гэтых клетак будзе стаяць наша лічба, але дакладна ў 2 з гэтых 4. Значыць, з рэшты гэтых 2 радкоў гэтую лічбу можна выкрасліць.",
          "Той самы прыём можна пачынаць і з радкоў: два радкі, у кожным з якіх гэтая лічба можа стаяць толькі ў двух слупках, і гэтыя слупкі ў абодвух радкоў адны і тыя ж – тады выкрасліваеце яе з рэшты гэтых слупкоў.",
        ],
        example: [
          "Паглядзіце на лічбу 3 у слупках 2 і 8. Яна можа стаяць толькі ў радках 6 і 7: r6c2, r6c8, r7c2 і r7c8. Таму ў рэшце радкоў 6 і 7 яе быць не можа. Выкрасліце яе там.",
        ],
        confirmation: "3 знікла з рэшты радкоў 6 і 7.",
        hasPractice: true,
      },
      {
        id: "swordfish",
        name: "Swordfish",
        oneLiner:
          "Лічба, якая ў трох лініях жыве толькі на тых самых трох папярочных, сыходзіць з рэшты гэтых папярочных.",
        idea: [
          "Як X-Wing, толькі маштабней: 3 лініі замест 2.",
          "Абярыце адну лічбу. Знайдзіце тры радкі, у кожным з якіх гэтая лічба можа стаяць толькі ў трох слупках, і гэтыя слупкі ва ўсіх трох радках адны і тыя ж.",
          "Мы пакуль не ведаем, у якіх менавіта клетках гэтых радкоў яна стане, але ведаем, што нідзе больш на гэтых трох слупках яе быць не можа. З астатніх клетак гэтых слупкоў гэтую лічбу можна выкрасліць.",
          "Той самы прыём можна пачынаць і са слупкоў: тры слупкі, у кожным з якіх гэтая лічба можа стаяць толькі ў трох радках, і гэтыя радкі ва ўсіх трох слупках адны і тыя ж – тады выкрасліваеце яе з рэшты гэтых радкоў.",
        ],
        example: [
          "Паглядзіце на лічбу 9 у радках 1, 5 і 9.",
          "У радку 1 яна можа стаяць толькі ў r1c3 і r1c7. У радку 5 – толькі ў r5c3 і r5c6. У радку 9 – толькі ў r9c6 і r9c7. Усе тры радкі замкнёныя на тыя самыя слупкі 3, 6 і 7.",
          "Таму ў гэтых слупках па-за трыма радкамі 9 быць не можа. Выкрасліце яе з r2c3, r2c7, r4c6 і r6c7.",
        ],
        confirmation: "9 знікла са слупкоў 3, 6 і 7 па-за радкамі 1, 5 і 9.",
        hasPractice: true,
      },
      {
        id: "xy_wing",
        name: "XY-Wing",
        oneLiner:
          "Pivot {X,Y} і два крылы {X,Z} і {Y,Z}: клетка, якая бачыць абодва крылы, губляе Z.",
        idea: [
          "Трэба знайсці камбінацыю з трох клетак. Спачатку шукаем pivot: бяром любую клетку, дзе ўсяго 2 кандыдаты {X,Y}. Далей глядзім на ўсе клеткі, якія «бачыць» pivot – гэта ўсе клеткі таго ж радка, слупка і квадрата (20 клетак).",
          "Сярод іх трэба знайсці такія, у якіх кандыдаты {X,Z} і {Y,Z}: у кожнай па адной лічбе pivot плюс яшчэ адна супольная. Гэтыя дзве клеткі называюцца крыламі.",
          "Цяпер шукаем клетку, якую «бачаць» абодва крылы – з яе можна выкрасліць кандыдата Z, бо гэтая лічба гарантавана ўжо будзе ў гэтым слупку/радку з-за двух крылаў.",
        ],
        example: [
          "У гэтым прыкладзе pivot – гэта r3c2 {4,5}. Крылы: r3c7 {3,4} і r9c2 {3,5}. У абодвух крылаў адна з лічбаў pivot плюс адна супольная. Абодва крылы бачаць клетку r9c7 – адтуль можна выкрасліць 3, бо яна гарантавана будзе ў адным з крылаў.",
        ],
        confirmation: "3 знікла з r9c7.",
        hasPractice: true,
      },
      {
        id: "xyz_wing",
        name: "XYZ-Wing",
        oneLiner:
          "Pivot {X,Y,Z} і крылы {X,Z} і {Y,Z}: клетка, якая бачыць pivot і абодва крылы, губляе Z.",
        idea: [
          "Як XY-Wing, толькі ў pivot тры кандыдаты {X,Y,Z}. Спачатку шукаем pivot: бяром любую клетку, дзе роўна тры кандыдаты. Далей глядзім на ўсе клеткі, якія «бачыць» pivot – гэта ўсе клеткі таго ж радка, слупка і квадрата (20 клетак).",
          "Сярод іх трэба знайсці такія, у якіх кандыдаты {X,Z} і {Y,Z}: у кожнай па дзве лічбы pivot, уключна з супольнай Z. Гэтыя дзве клеткі называюцца крыламі.",
          "Цяпер шукаем клетку, якая бачыць pivot і абодва крылы – з яе можна выкрасліць кандыдата Z: якую б з X, Y ці Z ні ўзяў pivot, Z усё роўна будзе стаяць у адной з гэтых трох клетак.",
        ],
        example: [
          "У гэтым прыкладзе pivot – гэта r6c7 {3,6,8}. Крылы: r3c7 {6,8} і r6c8 {3,8}. У абодвух крылаў дзве лічбы pivot, і яны дзеляць 8. r4c7 бачыць pivot і абодва крылы – адтуль можна выкрасліць 8, бо яна гарантавана будзе ў адной з гэтых трох клетак.",
        ],
        confirmation: "8 знікла з r4c7.",
        hasPractice: true,
      },
    ],
  },
};

for (const lang of ["en", "ua", "by"] as const) {
  const articleIds = COPY_BY_LANG[lang].articles.map((article) => article.id);
  if (
    articleIds.length !== TECHNIQUE_ARTICLE_ORDER.length ||
    articleIds.some((articleId, index) => articleId !== TECHNIQUE_ARTICLE_ORDER[index])
  ) {
    throw new Error(`techniques copy article order mismatch for ${lang}`);
  }
  for (const article of COPY_BY_LANG[lang].articles) {
    if (article.idea.length === 0 || article.example.length === 0) {
      throw new Error(`techniques article ${article.id} missing idea or example`);
    }
  }
}

export function lessonStartBrief(
  lang: InfoGuideLang,
  articleId: TechniqueArticleId,
): { title: string; body: string; gotIt: string } {
  const copy = techniquesGuideCopy(lang);
  const article = techniqueArticle(lang, articleId);
  return {
    title: articleId === "pencil" ? copy.practiceFillNotes : copy.practiceFind(article.name),
    body: article.oneLiner,
    gotIt: copy.practiceGotIt,
  };
}

export function techniquesGuideCopy(lang: InfoGuideLang): TechniquesGuideCopy {
  return COPY_BY_LANG[lang];
}

export function techniqueArticle(
  lang: InfoGuideLang,
  articleId: TechniqueArticleId,
): TechniqueArticleCopy {
  const article = COPY_BY_LANG[lang].articles.find((item) => item.id === articleId);
  if (article === undefined) {
    throw new Error(`missing techniques article: ${articleId}`);
  }
  return article;
}

export function lessonProgressByTechnique(
  items: readonly { technique: string; pool_size: number; solved_count: number }[],
): Record<TechniqueArticleId, TechniqueProgressCounts> {
  const byTechnique = new Map(items.map((item) => [item.technique, item] as const));
  const record = {} as Record<TechniqueArticleId, TechniqueProgressCounts>;
  for (const articleId of TECHNIQUE_ARTICLE_ORDER) {
    const item = byTechnique.get(articleId);
    if (item === undefined) {
      throw new Error(`missing lesson progress: ${articleId}`);
    }
    record[articleId] = {
      poolSize: item.pool_size,
      solvedCount: item.solved_count,
    };
  }
  return record;
}

export function completedLessonTally(
  progress: Record<TechniqueArticleId, TechniqueProgressCounts>,
): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const articleId of TECHNIQUE_ARTICLE_ORDER) {
    const counts = progress[articleId];
    if (counts === undefined) {
      throw new Error(`missing lesson progress: ${articleId}`);
    }
    completed += counts.solvedCount;
    total += counts.poolSize;
  }
  return { completed, total };
}
