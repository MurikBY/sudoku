export type InfoGuideLang = "en" | "ua" | "by";

export type GuideRubricId = "difficulty" | "assists" | "friends" | "other";

export type GuideAssistPreviewId =
  | "highlightPeers"
  | "highlightSameDigit"
  | "mistakeFeedback"
  | "dimCompletedDigits"
  | "unitCompleteAnimation"
  | "autoClearNotes"
  | "stickyDigit";

type GuideTocItem = {
  id: GuideRubricId;
  title: string;
  lead: string;
};

type GuideDifficultyLevel = {
  level: "Easy" | "Medium" | "Hard";
  techniques: string;
};

type GuideAssistItem = {
  previewId: GuideAssistPreviewId;
  label: string;
  description: string;
};

type GuideFaqItem = {
  question: string;
  answer: string;
};

type GuideSection = {
  title: string;
  body: string;
};

export type InfoGuideCopy = {
  title: string;
  goHome: string;
  back: string;
  tocIntro: string;
  toc: GuideTocItem[];
  difficulty: {
    techniquesLink: string;
    levels: GuideDifficultyLevel[];
  };
  assists: {
    intro: string;
    items: GuideAssistItem[];
  };
  friends: {
    sections: GuideSection[];
  };
  other: {
    paragraphs: string[];
    items: GuideFaqItem[];
  };
};

export const INFO_GUIDE_LANGS: {
  code: InfoGuideLang;
  label: string;
}[] = [
  { code: "en", label: "EN" },
  { code: "by", label: "BY" },
  { code: "ua", label: "UA" },
];

const STORAGE_KEY = "sudoku.infoGuide.lang";

export function loadInfoGuideLang(): InfoGuideLang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "ua" || raw === "by") {
      return raw;
    }
  } catch {
    // localStorage may be unavailable
  }
  return "en";
}

export function saveInfoGuideLang(lang: InfoGuideLang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

const ASSIST_LABELS = {
  highlightPeers: "Highlight row / column / box",
  highlightSameDigit: "Highlight same digit",
  mistakeFeedback: "Highlight mistakes",
  dimCompletedDigits: "Dim completed digits",
  unitCompleteAnimation: "Flash completed r/c/b",
  autoClearNotes: "Auto-clear notes",
  stickyDigit: "Long-press to lock digit",
} as const;

const COPY_BY_LANG: Record<InfoGuideLang, InfoGuideCopy> = {
  en: {
    title: "Guide",
    goHome: "Go home",
    back: "Back",
    tocIntro: "Pick a topic below to open its guide page.",
    toc: [
      {
        id: "difficulty",
        title: "Difficulty",
        lead: "What Easy, Medium, and Hard mean: the techniques, and how much of that path the puzzle takes",
      },
      {
        id: "assists",
        title: "Settings",
        lead: "What each setting does, and how party games use the host’s settings",
      },
      {
        id: "friends",
        title: "Play with Friends",
        lead: "Create or join a lobby, share one puzzle, then compare times and finishes afterward",
      },
      {
        id: "other",
        title: "Other",
        lead: "Settings, continue versus a new game, Game Review export, what counts in stats, and a few edge cases",
      },
    ],
    difficulty: {
      techniquesLink: "Learn each move.",
      levels: [
        {
          level: "Easy",
          techniques:
            "Naked and hidden singles only. You scan a row, column, or box and the next digit is forced: one candidate left in a cell, or a digit with only one possible cell in that unit. The path never needs pairs or wings.",
        },
        {
          level: "Medium",
          techniques:
            "Singles are not enough. The path uses naked/hidden pairs, pointing pairs, and box/line reduction. Candidates interact across units: a locked pair clears extras, a digit confined to one line inside a box leaves the rest of that line.",
        },
        {
          level: "Hard",
          techniques:
            "The path needs X-Wing, Swordfish, XY-Wing, or XYZ-Wing – and more than one such move, over a longer solve. A single advanced pattern that then collapses to singles is not Hard.",
        },
      ],
    },
    assists: {
      intro:
        "Chosen in Settings before you start. In a party game, only the host’s settings apply. Tap a name to see what it does.",
      items: [
        {
          previewId: "highlightPeers",
          label: ASSIST_LABELS.highlightPeers,
          description: "Shades the peers of the selected cell to help you scan constraints.",
        },
        {
          previewId: "highlightSameDigit",
          label: ASSIST_LABELS.highlightSameDigit,
          description:
            "Highlights every cell that already shows the same digit as the selection. Cells with that digit in pencil notes are highlighted too, but more faintly.",
        },
        {
          previewId: "mistakeFeedback",
          label: ASSIST_LABELS.mistakeFeedback,
          description:
            "Marks wrong digits, shows the mistakes counter, and gives a short error flash and vibration when available.\n\nWhile this setting is on, any correctly entered digit is locked: you cannot change it or clear it.",
        },
        {
          previewId: "dimCompletedDigits",
          label: ASSIST_LABELS.dimCompletedDigits,
          description:
            "Greys out and blocks a number on the pad once all nine correct copies are on the board.",
        },
        {
          previewId: "unitCompleteAnimation",
          label: ASSIST_LABELS.unitCompleteAnimation,
          description:
            "Briefly flashes a row, column, or box when you finish filling it correctly.",
        },
        {
          previewId: "autoClearNotes",
          label: ASSIST_LABELS.autoClearNotes,
          description:
            "When you place a digit, removes that digit from pencil notes in the same row, column, and box.\n\nIf the move is a mistake, peer notes are left alone.",
        },
        {
          previewId: "stickyDigit",
          label: ASSIST_LABELS.stickyDigit,
          description:
            "Long-press a digit on the number pad to lock it. Then tap empty cells to place that digit instantly.\n\nIn Pencil mode you can also drag across empty cells to add that note; tap a cell to remove it.\n\nTap any other pad digit to unlock, or long-press another digit to lock that one instead.",
        },
      ],
    },
    friends: {
      sections: [
        {
          title: "Host and lobby",
          body: "Choose who will host. The host opens a lobby through Play with Friends / Create and shares the invite code; everyone else joins through Play with Friends / Join. Any number of players can take part.",
        },
        {
          title: "Settings and start",
          body: "The shared game uses the difficulty the host picks in the lobby and the host’s Settings. When the host starts, everyone gets the same puzzle.",
        },
        {
          title: "Play and stats",
          body: "During the game, Lobby Stats in the header shows a short live snapshot for each player. After the round, full lobby comparison is in Stats / Games.",
        },
      ],
    },
    other: {
      paragraphs: [
        "Solo games use the difficulty under NEW GAME. Games with friends use the difficulty the host picks in the lobby. Settings apply to both.",
        "Continue last game restores only your most recent unfinished puzzle. Starting a new game abandons the previous unfinished one.",
        "Mistakes and hints are always counted for results and statistics, even when Highlight mistakes is off.",
        "In Game Review, Copy / Download Board for AI Help exports the step on screen: digits and pencil notes, not the solution. Copy puts the JSON on the clipboard. Download sends the same file to this Telegram bot chat so you can forward it.",
      ],
      items: [
        {
          question: "Why can’t I start on another phone?",
          answer:
            "Only one device can play at a time. If you open the app elsewhere, starting or continuing is blocked until the first device leaves or its lock expires after about 30 seconds.",
        },
      ],
    },
  },
  ua: {
    title: "Довідка",
    goHome: "Додому",
    back: "Назад",
    tocIntro: "Оберіть тему нижче, щоб відкрити її сторінку.",
    toc: [
      {
        id: "difficulty",
        title: "Складність",
        lead: "Що означають Easy, Medium і Hard: техніки, і скільки цієї роботи в шляху розв’язання",
      },
      {
        id: "assists",
        title: "Налаштування",
        lead: "Що робить кожен пункт, і як у партії діють налаштування хоста",
      },
      {
        id: "friends",
        title: "Гра з друзями",
        lead: "Створіть або зайдіть у лобі, грайте один пазл, потім порівняйте час і фініші",
      },
      {
        id: "other",
        title: "Інше",
        lead: "Settings, continue проти нової гри, експорт з Game Review, що йде в статистику, та крайні випадки",
      },
    ],
    difficulty: {
      techniquesLink: "Розберіть кожен прийом у Learning.",
      levels: [
        {
          level: "Easy",
          techniques:
            "Лише naked і hidden singles. Дивитеся на рядок, стовпець або квадрат – наступна цифра однозначна: у клітинці один кандидат, або цифра має лише одну можливу клітинку в цій одиниці. Шлях ніколи не потребує pairs чи wings.",
        },
        {
          level: "Medium",
          techniques:
            "Одних singles уже не вистачить. Шлях використовує naked/hidden pairs, pointing pairs і box/line reduction. Кандидати взаємодіють між одиницями: locked pair прибирає зайве, цифра, обмежена однією лінією в квадраті, зникає з решти цієї лінії.",
        },
        {
          level: "Hard",
          techniques:
            "Шлях потребує X-Wing, Swordfish, XY-Wing або XYZ-Wing – і не одного такого ходу, а довшого розв’язання. Один складний прийом, після якого сітка сама добирається singles, – це ще не Hard.",
        },
      ],
    },
    assists: {
      intro:
        "Обираються в Settings перед стартом. У спільній грі діють лише налаштування хоста. Натисніть назву, щоб побачити ефект.",
      items: [
        {
          previewId: "highlightPeers",
          label: ASSIST_LABELS.highlightPeers,
          description: "Підсвічує рядок, стовпець і квадрат вибраної клітинки.",
        },
        {
          previewId: "highlightSameDigit",
          label: ASSIST_LABELS.highlightSameDigit,
          description:
            "Підсвічує всі клітинки з такою ж цифрою, як у вибраній. Клітинки з цією цифрою в позначках олівцем теж підсвічуються, але слабше.",
        },
        {
          previewId: "mistakeFeedback",
          label: ASSIST_LABELS.mistakeFeedback,
          description:
            "Показує помилкові цифри, лічильник помилок і коротке сповіщення з вібрацією, якщо вона доступна.\n\nПоки цей пункт увімкнено, будь-яка правильно вписана цифра зафіксована: її не можна змінити або стерти.",
        },
        {
          previewId: "dimCompletedDigits",
          label: ASSIST_LABELS.dimCompletedDigits,
          description:
            "Затемнює і блокує цифру на панелі, коли вона вже правильно стоїть у всіх дев’яти клітинках.",
        },
        {
          previewId: "unitCompleteAnimation",
          label: ASSIST_LABELS.unitCompleteAnimation,
          description: "Коротко спалахує рядок, стовпець або квадрат після правильного заповнення.",
        },
        {
          previewId: "autoClearNotes",
          label: ASSIST_LABELS.autoClearNotes,
          description:
            "Після заповнення клітинки цифрою прибирає її з позначок олівцем у тому ж рядку, стовпці й квадраті.\n\nЯкщо хід визнано помилковим, позначки сусідів не чіпаються.",
        },
        {
          previewId: "stickyDigit",
          label: ASSIST_LABELS.stickyDigit,
          description:
            "Утримуйте цифру на панелі, щоб її зафіксувати. Далі натискайте порожні клітинки – цифра ставиться одразу.\n\nУ режимі Pencil можна також провести пальцем по порожніх клітинках, щоб додати позначку; зняти її можна лише тапом.\n\nКороткий тап по будь-якій іншій цифрі на панелі знімає фіксацію.",
        },
      ],
    },
    friends: {
      sections: [
        {
          title: "Хост і лобі",
          body: "Оберіть, хто буде хостом. Хост відкриває лобі через Play with Friends / Create і надсилає запрошувальний код; усі інші заходять через Play with Friends / Join. Кількість гравців не обмежена.",
        },
        {
          title: "Налаштування та старт",
          body: "Спільна гра використовує складність, яку хост обирає в лобі, і Settings хоста. Коли хост стартує, усі отримують один і той самий пазл.",
        },
        {
          title: "Гра та статистика",
          body: "Під час гри кнопка Lobby Stats у шапці показує коротку актуальну статистику кожного гравця. Після фінішу порівняльна статистика всього лобі доступна в Stats / Games.",
        },
      ],
    },
    other: {
      paragraphs: [
        "Соло гра використовує складність під NEW GAME. Гра з друзями – складність, яку хост обирає в лобі. Settings діють і там, і там.",
        "Continue last game відновлює лише останню незавершену гру. Нова гра завершує попередню незавершену як abandoned.",
        "Помилки й підказки завжди враховуються в результатах і статистиці, навіть якщо Highlight mistakes вимкнено.",
        "У Game Review рядок Copy / Download Board for AI Help експортує поточний крок: цифри й позначки олівцем, без розв’язку. Copy копіює JSON. Download надсилає той самий файл у чат цього Telegram-бота, щоб його можна було переслати.",
      ],
      items: [
        {
          question: "Чому не можу почати на іншому телефоні?",
          answer:
            "Одночасно можна грати лише з одного пристрою. На іншому старт або continue блокуються, доки перший пристрій не вийде або не мине близько 30 секунд блокування.",
        },
      ],
    },
  },
  by: {
    title: "Даведка",
    goHome: "Дадому",
    back: "Назад",
    tocIntro: "Абярыце тэму ніжэй, каб адкрыць яе старонку.",
    toc: [
      {
        id: "difficulty",
        title: "Складанасць",
        lead: "Што значаць Easy, Medium і Hard: тэхнікі, і колькі гэтай працы ў шляху развязвання",
      },
      {
        id: "assists",
        title: "Налады",
        lead: "Што робіць кожны пункт, і як у партыі дзейнічаюць налады хоста",
      },
      {
        id: "friends",
        title: "Гульня з сябрамі",
        lead: "Стварыце або зайдзіце ў лобі, гуляйце адзін пазл, потым параўнайце час і фінішы",
      },
      {
        id: "other",
        title: "Іншае",
        lead: "Settings, continue супраць новай гульні, экспарт з Game Review, што ідзе ў статыстыку, і крайнія выпадкі",
      },
    ],
    difficulty: {
      techniquesLink: "Разбярыце кожны прыём у Learning.",
      levels: [
        {
          level: "Easy",
          techniques:
            "Толькі naked і hidden singles. Глядзіце на радок, слупок або квадрат – наступная лічба адназначная: у клетцы адзін кандыдат, або лічба мае толькі адну магчымую клетку ў гэтай адзінцы. Шлях ніколі не патрабуе pairs ці wings.",
        },
        {
          level: "Medium",
          techniques:
            "Адных singles ужо не хопіць. Шлях ужывае naked/hidden pairs, pointing pairs і box/line reduction. Кандыдаты ўзаемадзейнічаюць паміж адзінкамі: locked pair прыбірае лішняе, лічба, абмежаваная адной лініяй у квадраце, знікае з рэшты гэтай лініі.",
        },
        {
          level: "Hard",
          techniques:
            "Шлях патрабуе X-Wing, Swordfish, XY-Wing або XYZ-Wing – і не аднаго такога ходу, а даўжэйшага развязвання. Адзін складаны прыём, пасля якога сетка сама дабіраецца singles, – гэта яшчэ не Hard.",
        },
      ],
    },
    assists: {
      intro:
        "Абіраюцца ў Settings перад стартам. У супольнай гульні дзейнічаюць толькі налады хоста. Націсніце назву, каб убачыць эфект.",
      items: [
        {
          previewId: "highlightPeers",
          label: ASSIST_LABELS.highlightPeers,
          description: "Падсвечвае радок, слупок і квадрат выбранай клеткі.",
        },
        {
          previewId: "highlightSameDigit",
          label: ASSIST_LABELS.highlightSameDigit,
          description:
            "Падсвечвае ўсе клеткі з такой самай лічбай, як у выбранай. Клеткі з гэтай лічбай у пазнаках алоўкам таксама падсвечваюцца, але слабей.",
        },
        {
          previewId: "mistakeFeedback",
          label: ASSIST_LABELS.mistakeFeedback,
          description:
            "Паказвае памылковыя лічбы, лічыльнік памылак і кароткае апавяшчэнне з вібрацыяй, калі яна даступная.\n\nПакуль гэты пункт уключаны, любая правільна ўпісаная лічба зафіксаваная: яе нельга змяніць або сцерці.",
        },
        {
          previewId: "dimCompletedDigits",
          label: ASSIST_LABELS.dimCompletedDigits,
          description:
            "Зацямняе і блакуе лічбу на панэлі, калі яна ўжо правільна стаіць ва ўсіх дзевяці клетках.",
        },
        {
          previewId: "unitCompleteAnimation",
          label: ASSIST_LABELS.unitCompleteAnimation,
          description: "Каротка ўспыхвае радок, слупок або квадрат пасля правільнага запаўнення.",
        },
        {
          previewId: "autoClearNotes",
          label: ASSIST_LABELS.autoClearNotes,
          description:
            "Пасля запаўнення клеткі лічбай прыбірае яе з пазнак алоўкам у тым жа радку, слупку і квадраце.\n\nКалі ход прызнаны памылковым, пазнакі суседзяў не чапаюцца.",
        },
        {
          previewId: "stickyDigit",
          label: ASSIST_LABELS.stickyDigit,
          description:
            "Утрымлівайце лічбу на панэлі, каб яе зафіксаваць. Далей націскайце пустыя клеткі – лічба ставіцца адразу.\n\nУ рэжыме Pencil можна таксама правесці пальцам па пустых клетках, каб дадаць пазнаку; зняць яе можна толькі тапам.\n\nКароткі тап па любой іншай лічбе на панэлі здымае фіксацыю.",
        },
      ],
    },
    friends: {
      sections: [
        {
          title: "Хост і лобі",
          body: "Абярыце, хто будзе хостам. Хост адкрывае лобі праз Play with Friends / Create і дасылае запрашальны код; усе астатнія заходзяць праз Play with Friends / Join. Колькасць гульцоў не абмежаваная.",
        },
        {
          title: "Налады і старт",
          body: "Супольная гульня выкарыстоўвае складанасць, якую хост абірае ў лобі, і Settings хоста. Калі хост стартуе, усе атрымліваюць адзін і той жа пазл.",
        },
        {
          title: "Гульня і статыстыка",
          body: "Падчас гульні кнопка Lobby Stats у шапцы паказвае кароткую актуальную статыстыку кожнага гульца. Пасля фінішу параўнальная статыстыка ўсяго лобі даступная ў Stats / Games.",
        },
      ],
    },
    other: {
      paragraphs: [
        "Сола гульня выкарыстоўвае складанасць пад NEW GAME. Гульня з сябрамі – складанасць, якую хост абірае ў лобі. Settings дзейнічаюць і там, і там.",
        "Continue last game аднаўляе толькі апошнюю незавершаную гульню. Новая гульня завяршае папярэднюю незавершаную як abandoned.",
        "Памылкі і падказкі заўсёды ўлічваюцца ў выніках і статыстыцы, нават калі Highlight mistakes выключаны.",
        "У Game Review радок Copy / Download Board for AI Help экспартуе бягучы крок: лічбы і пазнакі алоўкам, без развязку. Copy капіюе JSON. Download дасылае той самы файл у чат гэтага Telegram-бота, каб яго можна было пераслаць.",
      ],
      items: [
        {
          question: "Чаму не магу пачаць на іншым тэлефоне?",
          answer:
            "Адначасова можна гуляць толькі з адной прылады. На іншай старт або continue блакуюцца, пакуль першая прылада не выйдзе або не міне каля 30 секунд блакавання.",
        },
      ],
    },
  },
};

export function infoGuideCopy(lang: InfoGuideLang): InfoGuideCopy {
  return COPY_BY_LANG[lang];
}
