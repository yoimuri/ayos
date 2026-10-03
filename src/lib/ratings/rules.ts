/**
 * THE ONE NUMBER BEHIND "the average appears once there are N ratings".
 *
 * Below this many confirmed ratings, a shop shows its rating COUNT but not its average,
 * so two five-star reviews from the owner's friends cannot make a shop look established.
 *
 * 5 for now: every shop starts at zero ratings, and a higher bar would leave nearly every
 * shop without an average for months. The point of this file is that changing it is a
 * one-line edit: every screen and every sentence that mentions the threshold reads it
 * from here.
 */
export const MIN_RATINGS_FOR_AVERAGE = 5;
