/**
 * Explicit Content and Username/Email Filter Utility for Node backend
 * Supports English & Hindi/Hinglish explicit word detection, leetspeak normalization,
 * and safe-name exception handling (preventing false positives for names like 'harshit').
 */

const EXPLICIT_WORDS = new Set([
  // English profane / explicit terms & common leetspeak variants
  'fuck', 'fucker', 'fucking', 'fuckhead', 'fack', 'fuk', 'fck', 'f4ck', 'phuck',
  'shit', 'shitting', 'shithead', 'sh1t', 'bitch', 'b1tch', 'btch',
  'ass', 'asshole', 'a$$hole', 'bastard', 'cunt', 'dick', 'd1ck', 'pussy', 'whore', 'slut', 'motherfucker',
  'cock', 'dildo', 'nigger', 'nigga', 'faggot', 'retard', 'blowjob', 'handjob', 'porn',
  'porno', 'sex', 'sexy', 'nude', 'nudes', 'hentai', 'penis', 'vagina', 'tit', 'tits',

  // Explicit body parts & anatomical / vulgar terms
  'boob', 'boobs', 'b00b', 'b00bs', 'breast', 'breasts', 'br3ast', 'br3asts',
  'nipple', 'nipples', 'n1pple', 'n!pple', 'poop', 'poops', 'p00p', 'p00ps', 'poopy',

  // Hindi / Hinglish profane / explicit terms & common variants
  'bhenchod', 'benchod', 'bhenchodh', 'bc', 'bchd', 'madarchod', 'mc', 'mchd', 'bhosdike', 'bhosdika',
  'bhosdi', 'bsdk', 'bkl', 'chutiya', 'chutiye', 'chut1ya', 'choot', 'chut', 'gaand', 'gand',
  'gandu', 'gandmaru', 'randi', 'randbaaz', 'harami', 'kutta', 'kuttiya', 'saala',
  'saali', 'kamina', 'kamine', 'lauda', 'loda', 'lavda', 'lode', 'lund', 'chudai',
  'chudwa', 'mutthal', 'raand', 'tatte', 'tatta', 'jhant', 'jhat'
]);

const SAFE_WORDS = [
  'harshit', 'harshita', 'harsh', 'classic', 'class', 'glass', 'assistant',
  'passion', 'compass', 'attitude', 'title', 'ditch', 'stitched', 'pushit', 'asset'
];

function normalizeText(text) {
  if (!text) return '';
  let str = text.toLowerCase();

  str = str
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/3/g, 'e')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');

  return str;
}

export function containsExplicitWord(text) {
  if (!text) return false;
  const normalized = normalizeText(text);

  let cleanStr = normalized.replace(/[^a-z0-9]/g, '');

  const words = normalized.split(/[^a-z0-9]+/);
  for (const word of words) {
    if (EXPLICIT_WORDS.has(word)) {
      return true;
    }
  }

  for (const safeWord of SAFE_WORDS) {
    if (cleanStr.includes(safeWord)) {
      cleanStr = cleanStr.replaceAll(safeWord, '');
    }
  }

  if (!cleanStr) return false;

  const textWith4AsU = cleanStr.replace(/4/g, 'u');
  const textWith4AsA = cleanStr.replace(/4/g, 'a');

  for (const explicitWord of EXPLICIT_WORDS) {
    if (explicitWord.length <= 2) {
      if (words.includes(explicitWord)) {
        return true;
      }
    } else {
      if (
        cleanStr.includes(explicitWord) ||
        textWith4AsU.includes(explicitWord) ||
        textWith4AsA.includes(explicitWord)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function checkExplicitUsername(username) {
  if (!username) {
    return { isValid: true, isExplicit: false, isNotLowercase: false, reason: null };
  }

  if (/[A-Z]/.test(username)) {
    return {
      isValid: false,
      isExplicit: false,
      isNotLowercase: true,
      reason: 'Username must contain lowercase letters only.'
    };
  }

  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return {
      isValid: false,
      isExplicit: false,
      isNotLowercase: false,
      reason: 'Username can only contain lowercase letters, numbers, underscores, hyphens, and dots.'
    };
  }

  if (containsExplicitWord(username)) {
    return {
      isValid: false,
      isExplicit: true,
      isNotLowercase: false,
      reason: 'Username contains inappropriate or explicit content (English/Hindi).'
    };
  }

  return { isValid: true, isExplicit: false, isNotLowercase: false, reason: null };
}

export function checkExplicitEmail(email) {
  if (!email) {
    return { isValid: true, isExplicit: false, reason: null };
  }

  const parts = email.split('@');
  const localPart = parts[0] || '';
  const domainPart = parts[1] || '';

  if (containsExplicitWord(localPart) || containsExplicitWord(domainPart)) {
    return {
      isValid: false,
      isExplicit: true,
      reason: 'Email address contains inappropriate or explicit content (English/Hindi).'
    };
  }

  return { isValid: true, isExplicit: false, reason: null };
}

export default {
  checkExplicitUsername,
  checkExplicitEmail,
  containsExplicitWord,
};
