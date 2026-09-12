/**
 * Every word the rider sees, in both languages.
 *
 * Two languages only for now: English and Taglish. The spec's third option
 * (straight Filipino) waits until the wording settles, because each string added
 * now has to be written twice and would otherwise be written three times.
 *
 * The Taglish is a first pass by a non-native speaker and needs the co-founder's
 * review before it ships. Anything he corrects is corrected here, once.
 */

export type Language = 'en' | 'tl';

/** Keys are grouped by screen so a missing string is obvious at a glance. */
export type Strings = {
  appName: string;

  // Home
  nearestToYou: string;
  byDistance: string;
  findShop: string;
  savedOnPhone: (count: string) => string;
  updatedToday: string;
  noSignalUsing: (date: string) => string;
  radiusWidened: (from: string, to: string) => string;
  radiusPill: (radius: string, count: number) => string;
  noMapOffline: string;

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
  averageHidden: string;
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
  chooseBike: string;
  chooseBikeHelp: string;
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
  developer: string;
};

const en: Strings = {
  appName: 'Ayos',

  nearestToYou: 'Nearest to you',
  byDistance: 'BY DISTANCE',
  findShop: 'Find a shop by name',
  savedOnPhone: (count) => `${count} shops`,
  updatedToday: 'saved on this phone · updated today',
  noSignalUsing: (date) => `No signal. Using the copy saved ${date}.`,
  radiusWidened: (from, to) =>
    `Only a few shops within ${from}, so we widened the search to ${to}.`,
  radiusPill: (radius, count) => `${radius} · ${count} shops`,
  noMapOffline: 'No map without a signal. Every shop, distance and number is still here.',

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
  averageHidden: 'The average appears once there are 5 ratings.',
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
  chooseBike: 'What do you ride?',
  chooseBikeHelp: 'This helps us learn what riders in Metro Manila actually ride, so we collect the right shops.',
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
  developer: 'Build info',
};

const tl: Strings = {
  appName: 'Ayos',

  nearestToYou: "Malapit sa'yo",
  byDistance: 'AYON SA LAYO',
  findShop: 'Hanapin ang shop sa pangalan',
  savedOnPhone: (count) => `${count} na shop`,
  updatedToday: 'naka-save sa phone mo · updated ngayon',
  noSignalUsing: (date) => `Walang signal. Ginagamit ang naka-save noong ${date}.`,
  radiusWidened: (from, to) =>
    `Kulang ang nakita sa ${from}, kaya pinalawak namin hanggang ${to}.`,
  radiusPill: (radius, count) => `${radius} · ${count} na shop`,
  noMapOffline:
    'Walang mapa habang walang signal. Nandito pa rin lahat ng shop, layo at numero.',

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
  averageHidden: 'Lalabas ang average kapag umabot na sa 5 na rating.',
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
  chooseBike: 'Anong sinasakyan mo?',
  chooseBikeHelp:
    'Nakakatulong ito para malaman namin kung anong motor talaga ang ginagamit sa Metro Manila, para tama ang mga shop na kokolektahin namin.',
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
  developer: 'Build info',
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
