/**
 * THE RIDER QUESTIONS, asked once on first use.
 *
 * WHAT THEY ARE FOR: learning what Metro Manila riders ride and what they go to shops
 * for, so the team collects the right shops next. It replaces the single "What do you
 * ride?" question, which was the same idea with less in it.
 *
 * CHOICES, NOT TYPING, wherever the answer will be counted. "Honda", "honda", "HONDA
 * CLICK" and "hondaa" are four different answers to a computer and one to a person;
 * a tap on "Honda" is the same answer every time. The model is the one typed field,
 * because there are hundreds of models and it is optional.
 *
 * WHERE THE ANSWERS GO: nowhere yet (DEMO). They are saved on the rider's phone only; the
 * confirmation screen after them is a demo stand-in for sending. They reach the team once
 * the database exists, sent without any name, email or position.
 *
 * The lists follow what the field team sees in shops. Changing one is editing a line here.
 */

export type RiderSurvey = {
  brand?: string;
  /** Free text, optional: "Click 125i", "Sniper 155". */
  model?: string;
  year?: string;
  visits?: string;
  services?: string[];
};

export const BRANDS = [
  'Honda',
  'Yamaha',
  'Suzuki',
  'Kawasaki',
  'Kymco',
  'Rusi',
  'Motorstar',
  'SYM',
  'TVS',
  'Bajaj',
  'CFMoto',
  'Other',
];

/** This year and the five before it one by one, then wider ranges. Worked out, not typed, so it never goes stale. */
export function yearOptions(now: Date): string[] {
  const y = now.getFullYear();
  return [
    ...Array.from({ length: 6 }, (_, i) => String(y - i)),
    `${y - 10}–${y - 6}`,
    `Before ${y - 10}`,
    'Not sure',
  ];
}

/** Visits to a repair, maintenance, parts or dealer shop in a year. */
export const VISITS = ['0–1', '2–4', '5–8', '9–12', 'More than 12'];

export const SERVICES = [
  'Change oil',
  'PMS / tune-up',
  'Tires',
  'Brakes',
  'Battery',
  'Chain and sprocket',
  'CVT cleaning',
  'Electrical',
  'Parts replacement',
  'Accessories',
  'Helmet and riding gear',
  'Other',
];

/**
 * REQUIRED ON FIRST USE (Clint, 1 Nov): the app opens only once these are answered. Brand,
 * year, visits and at least one service; the model stays optional (it is the one typed
 * field, and many riders will not know it).
 */
export function surveyComplete(s: RiderSurvey | undefined): boolean {
  return !!s && !!s.brand && !!s.year && !!s.visits && (s.services?.length ?? 0) > 0;
}
