/**
 * Every word the rider sees, in both languages.
 *
 * Two languages only for now: English and Taglish. A third, straight Filipino, waits until the wording settles, because each string added
 * now has to be written twice and would otherwise be written three times.
 *
 * Taglish wording is reviewed by a native speaker before it ships. Anything corrected
 * is corrected here, once.
 */

export type Language = 'en' | 'tl';

/** Keys are grouped by screen so a missing string is obvious at a glance. */
export type Strings = {
  appName: string;

  // Home
  nearestToYou: string;
  byDistance: string;
  findShop: string;
  findingLocation: string;
  help: string;
  noSignalUsing: (date: string) => string;

  // Status
  open: string;
  closed: string;
  unknown: string;
  openUntil: (time: string) => string;

  // Shop detail
  backToList: string;
  contact: string;
  call: string;
  message: string;
  directions: string;
  phone: string;
  otherContacts: string;
  noNumber: string;
  ratingCount: (n: number) => string;
  noRatingsYet: string;
  /** Takes the threshold from lib/ratings/rules.ts, so the sentence can never disagree with the rule. */
  averageHidden: (n: number) => string;
  noPhotoYet: string;
  address: string;
  hours: string;
  openAllDay: string;
  closedOn: (days: string) => string;
  /** Sunday first, matching JavaScript's getDay(). */
  dayNames: string[];
  rateThisShop: string;
  km: string;

  // Rate
  rateShop: (name: string) => string;
  whatHappened: string;
  whatHappenedHint: string;
  yourName: string;
  email: string;
  emailHelp: string;
  send: string;
  offlineTitle: string;
  offlineBody: string;

  // Onboarding
  welcomeTitle: string;
  welcomeBody: string;
  chooseLanguage: string;
  chooseArea: string;
  chooseAreaHelp: string;
  chooseTheme: string;
  themeLight: string;
  themeDark: string;
  continueLabel: string;
  back: string;
  finish: string;
  skip: string;
  changeLaterInSettings: string;

  // Settings
  settings: string;
  language: string;
  area: string;
  motorcycle: string;
  appearance: string;
  notSet: string;
  about: string;
  aboutBody: string;
  draftNotice: string;
  searchRadius: string;
  allCities: string;
  /** The picker entry meaning "measure from where I am standing". */
  currentLocation: string;
  developer: string;
  colours: string;
  replayTutorial: string;
  riderQuestions: string;
  done: string;
  cancel: string;

  // Contact card
  contactHow: string;

  // The panel switch

  // Rider questions
  qBrand: string;
  qModel: string;
  qModelHint: string;
  qYear: string;
  qVisits: string;
  qVisitsUnit: string;
  qServices: string;
  qServicesHint: string;
  surveyWhy: string;
  surveyThanksTitle: string;
  surveyThanksBody: string;
  answerNow: string;
  later: string;
  surveyReminder: string;
  dontAskAgain: string;
  showSearch: string;
  hideSearch: string;
  tourDrag: string;

  // Tutorial
  tourList: string;
  tourActions: string;
  tourBackToList: string;
  tourRadius: string;
  tourRecentre: string;
  tourHelp: string;
  tourTapHint: string;
  tourNext: string;
  tourBack: string;
  tourExit: string;
  tourFinish: string;
};

const en: Strings = {
  appName: 'Ayos',

  nearestToYou: 'Nearest to you',
  byDistance: 'BY DISTANCE',
  findShop: 'Find a shop by name',
  findingLocation: 'Finding your location…',
  help: 'How to use Ayos',
  noSignalUsing: (date) => `No signal. Showing the shop list from ${date}.`,

  open: 'Open',
  closed: 'Closed',
  unknown: 'Unknown',
  openUntil: (time) => `Open now · until ${time}`,

  backToList: 'Back to list',
  contact: 'Contact',
  call: 'Call',
  message: 'Message',
  directions: 'Directions',
  phone: 'Phone',
  otherContacts: 'Other ways to reach them',
  noNumber: 'No number on file',
  ratingCount: (n) => (n === 1 ? '1 rating' : `${n} ratings`),
  noRatingsYet: 'No ratings yet',
  averageHidden: (n) => `The average appears once there are ${n} ratings.`,
  noPhotoYet: 'No photo yet',
  address: 'Address',
  hours: 'Hours',
  openAllDay: 'Open 24 hours',
  closedOn: (days) => `Closed ${days}`,
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  rateThisShop: 'Rate this shop',
  km: 'KM',

  rateShop: (name) => `Rate ${name}`,
  whatHappened: 'What happened (optional)',
  whatHappenedHint: 'What did they do for you?',
  yourName: 'Your name',
  email: 'Email',
  emailHelp:
    'We will send you a link. Your rating stays hidden until you tap it. Your email is never shown to anyone.',
  send: 'Send',
  offlineTitle: 'When you have no signal',
  offlineBody:
    'Rating is turned off. We do not hold it to send later, so you never think it went through when it did not.',

  welcomeTitle: 'Find the nearest shop, even with no signal',
  welcomeBody:
    'Ayos keeps every Metro Manila shop on your phone, so the list opens instantly and the numbers work when your data does not.',
  chooseLanguage: 'Which language?',
  chooseArea: 'Where in Metro Manila?',
  chooseAreaHelp: 'We use this only to sort your first list. Your exact location is never stored.',
  chooseTheme: 'Light or dark?',
  themeLight: 'Light',
  themeDark: 'Dark',
  continueLabel: 'Continue',
  back: 'Back',
  finish: 'Start using Ayos',
  skip: 'Skip',
  changeLaterInSettings: 'You can change all of this later in Settings.',

  settings: 'Settings',
  language: 'Language',
  area: 'Area',
  motorcycle: 'Motorcycle',
  appearance: 'Appearance',
  notSet: 'Not set',
  about: 'About Ayos',
  aboutBody:
    'Ayos shows you the motorcycle shops nearest to you and keeps them on your phone, so the list opens and the numbers work even with no signal. It locates shops. It does not rate how good they are, and shops are always ordered by distance, never by rating.',
  draftNotice:
    "This is a draft build with sample functionalities. This is subject to changes so kalikutin mo lang hangga't gusto mo.",
  searchRadius: 'Search radius',
  allCities: 'All cities',
  currentLocation: 'Current location',
  developer: 'Build info',
  colours: 'Colours',
  replayTutorial: 'Show the tutorial again',
  riderQuestions: 'Rider questions',
  done: 'Done',
  cancel: 'Cancel',

  contactHow: 'How do you want to reach them?',


  qBrand: 'What brand is your motorcycle?',
  qModel: 'And the model?',
  qModelHint: 'e.g. Click 125i',
  qYear: 'What year did you buy it?',
  qVisits: 'How often do you go to a repair, parts or dealer shop in a year?',
  qVisitsUnit: 'times a year',
  qServices: 'What do you usually get or buy there?',
  qServicesHint: 'Pick all that apply.',
  surveyWhy:
    'This helps us find the right shops to add. Your answers stay on this phone; nothing is sent anywhere.',
  surveyThanksTitle: 'Thank you for downloading Ayos!',
  surveyThanksBody:
    'So we can help you better in the future, could you answer 4 quick questions about your motorcycle? It takes less than a minute, and your answers stay on this phone.',
  answerNow: 'Answer now',
  later: 'Later',
  surveyReminder: '4 quick questions about your motorcycle',
  dontAskAgain: "Don't ask again",
  showSearch: 'Show search',
  hideSearch: 'Hide search',
  tourDrag: 'Drag this bar down to see more of the map, or up to see more of the list.',

  tourList: 'These are the shops nearest to you. Tap one to see it.',
  tourActions: 'From here you can call the shop, text them, or get directions.',
  tourBackToList: 'Tap here to go back to the list.',
  tourRadius: 'Choose how far to look. Try it: tap one.',
  tourRecentre: 'Lost on the map? Tap this to go back to where you are.',
  tourHelp: 'Want to see this again? Tap ? any time, or find it in Settings.',
  tourTapHint: 'Tap the lit-up part',
  tourNext: 'Next',
  tourBack: 'Back',
  tourExit: 'Exit',
  tourFinish: 'Done',
};

const tl: Strings = {
  appName: 'Ayos',

  nearestToYou: "Malapit sa'yo",
  byDistance: 'AYON SA LAYO',
  findShop: 'Hanapin ang shop sa pangalan',
  findingLocation: 'Hinahanap ang location mo…',
  help: 'Paano gamitin ang Ayos',
  noSignalUsing: (date) => `Walang signal. Ipinapakita ang listahan noong ${date}.`,

  open: 'Bukas',
  closed: 'Sarado',
  unknown: 'Hindi sigurado',
  openUntil: (time) => `Bukas ngayon · hanggang ${time}`,

  backToList: 'Balik sa listahan',
  contact: 'Kontakin',
  call: 'Tawagan',
  message: 'I-text',
  directions: 'Daan',
  phone: 'Telepono',
  otherContacts: 'Ibang paraan para makontak sila',
  noNumber: 'Walang numero',
  ratingCount: (n) => (n === 1 ? '1 rating' : `${n} na rating`),
  noRatingsYet: 'Wala pang rating',
  averageHidden: (n) => `Lalabas ang average kapag umabot na sa ${n} na rating.`,
  noPhotoYet: 'Wala pang litrato',
  address: 'Address',
  hours: 'Oras',
  openAllDay: 'Bukas 24 oras',
  closedOn: (days) => `Sarado tuwing ${days}`,
  dayNames: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'],
  rateThisShop: 'I-rate ang shop na ito',
  km: 'KM',

  rateShop: (name) => `I-rate ang ${name}`,
  whatHappened: 'Kuwento mo (optional)',
  whatHappenedHint: "Ano'ng ginawa nila?",
  yourName: 'Pangalan mo',
  email: 'Email',
  emailHelp:
    "Padadalhan ka namin ng link. Hindi lalabas ang rating mo hangga't hindi mo pinipindot 'yon. Hindi namin ipapakita ang email mo kahit kanino.",
  send: 'Ipadala',
  offlineTitle: 'Kapag walang signal',
  offlineBody:
    'Naka-off ang pag-rate. Hindi namin itatabi para ipadala mamaya, para walang akalang naipasa na pero hindi pala.',

  welcomeTitle: 'Hanapin ang pinakamalapit na shop, kahit walang signal',
  welcomeBody:
    'Naka-save sa phone mo ang lahat ng shop sa Metro Manila, kaya bumubukas agad ang listahan at gumagana ang mga numero kahit walang data.',
  chooseLanguage: 'Anong lengguwahe?',
  chooseArea: 'Saan ka sa Metro Manila?',
  chooseAreaHelp:
    'Ginagamit lang ito para sa unang listahan mo. Hindi namin iniimbak ang eksaktong location mo.',
  chooseTheme: 'Light o dark?',
  themeLight: 'Light',
  themeDark: 'Dark',
  continueLabel: 'Tuloy',
  back: 'Balik',
  finish: 'Simulan na',
  skip: 'Laktawan',
  changeLaterInSettings: 'Pwede mo itong palitan mamaya sa Settings.',

  settings: 'Settings',
  language: 'Lengguwahe',
  area: 'Lugar',
  motorcycle: 'Motor',
  appearance: 'Itsura',
  notSet: 'Wala pa',
  about: 'Tungkol sa Ayos',
  aboutBody:
    "Ipinapakita ng Ayos ang mga motor shop na pinakamalapit sa'yo, at naka-save sila sa phone mo kaya bumubukas ang listahan at gumagana ang mga numero kahit walang signal. Naghahanap lang ito ng shop. Hindi nito hinuhusgahan kung magaling sila, at ayon sa layo ang pagkakasunod, hindi sa rating.",
  draftNotice:
    "This is a draft build with sample functionalities. This is subject to changes so kalikutin mo lang hangga't gusto mo.",
  searchRadius: 'Lawak ng hanap',
  allCities: 'Lahat ng lugar',
  /* Taglish as riders actually say it: the English word is the common one. */
  currentLocation: 'Kung nasaan ka',
  developer: 'Build info',
  colours: 'Kulay',
  replayTutorial: 'Ipakita ulit ang tutorial',
  riderQuestions: 'Mga tanong sa rider',
  done: 'Tapos na',
  cancel: 'Kanselahin',

  contactHow: 'Paano mo sila gustong kontakin?',


  qBrand: 'Anong brand ng motor mo?',
  qModel: 'Anong model?',
  qModelHint: 'hal. Click 125i',
  qYear: 'Kailan mo ito binili?',
  qVisits: 'Ilang beses ka pumupunta sa repair, parts o dealer shop sa isang taon?',
  qVisitsUnit: 'beses sa isang taon',
  qServices: 'Ano ang karaniwan mong pinapagawa o binibili doon?',
  qServicesHint: 'Piliin lahat ng tugma.',
  surveyWhy:
    'Tumutulong ito para malaman namin kung anong mga shop ang idadagdag. Naka-save lang sa phone mo ang sagot mo; walang ipinapadala kahit saan.',
  surveyThanksTitle: 'Salamat sa pag-download ng Ayos!',
  surveyThanksBody:
    'Para mas matulungan ka namin sa susunod, puwede mo bang sagutin ang 4 na mabilis na tanong tungkol sa motor mo? Wala pang isang minuto, at naka-save lang sa phone mo ang sagot mo.',
  answerNow: 'Sagutin na',
  later: 'Mamaya na',
  surveyReminder: '4 na mabilis na tanong tungkol sa motor mo',
  dontAskAgain: 'Huwag nang itanong',
  showSearch: 'Ipakita ang search',
  hideSearch: 'Itago ang search',
  tourDrag: 'Hilahin pababa ang bar na ito para makita ang mapa, o pataas para sa listahan.',

  tourList: "Ito ang mga shop na pinakamalapit sa'yo. Pindutin ang isa para makita.",
  tourActions: 'Dito ka puwedeng tumawag, mag-text, o humanap ng daan papunta sa shop.',
  tourBackToList: 'Pindutin ito para bumalik sa listahan.',
  tourRadius: 'Piliin kung gaano kalayo ang hahanapin. Subukan: pumindot ng isa.',
  tourRecentre: 'Nawala ka sa mapa? Pindutin ito para bumalik kung nasaan ka.',
  tourHelp: 'Gusto mong ulitin ito? Pindutin ang ? kahit kailan, o hanapin sa Settings.',
  tourTapHint: 'Pindutin ang naka-ilaw',
  tourNext: 'Sunod',
  tourBack: 'Balik',
  tourExit: 'Labas',
  tourFinish: 'Tapos na',
};

export const STRINGS: Record<Language, Strings> = { en, tl };

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English (United States)',
  tl: 'Taglish (Filipino)',
};

/**
 * Flags as the language marker.
 *
 * The one place an emoji earns its keep here: a flag is recognised faster than a word,
 * and a rider scanning Settings finds their language without reading. Everywhere else
 * in the app icons are drawn, not typed.
 */
export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: '🇺🇸',
  tl: '🇵🇭',
};
