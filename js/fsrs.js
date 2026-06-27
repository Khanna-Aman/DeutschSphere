// js/fsrs.js — Free Spaced Repetition Scheduler (FSRS-5) Pure Client-Side Implementation
// Zero dependencies. Models each card with Stability (S), Difficulty (D), and State.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

// ==========================================
// FSRS CARD STATES
// ==========================================
export const State = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3
};

// ==========================================
// FSRS RATING GRADES
// ==========================================
export const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4
};

// ==========================================
// DEFAULT FSRS-5 PARAMETERS (w[0..18])
// ==========================================
const DEFAULT_WEIGHTS = [
  0.4072,   // w0  — initial stability for Again
  1.1829,   // w1  — initial stability for Hard
  3.1262,   // w2  — initial stability for Good
  15.4722,  // w3  — initial stability for Easy
  7.2102,   // w4  — difficulty weight
  0.5316,   // w5  — difficulty weight
  1.0651,   // w6  — difficulty mean reversion
  0.0589,   // w7  — stability factor for hard
  1.5747,   // w8  — stability factor for good
  0.2753,   // w9  — stability factor for easy
  1.0120,   // w10 — stability decay base
  1.9395,   // w11 — stability penalty for failure
  0.1100,   // w12 — failure stability factor
  0.2900,   // w13 — failure stability additive
  2.2700,   // w14 — failure stability power
  0.2000,   // w15 — hard penalty
  2.9466,   // w16 — easy bonus
  0.5100,   // w17 — short-term stability modifier
  0.6400    // w18 — short-term stability modifier
];

// ==========================================
// HELPER: Clamp a value between min and max
// ==========================================
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ==========================================
// HELPER: Days elapsed between two timestamps
// ==========================================
function daysBetween(earlier, later) {
  return Math.max(0, (later - earlier) / (24 * 60 * 60 * 1000));
}

// ==========================================
// FSRS CLASS
// ==========================================
export class FSRS {
  /**
   * @param {object} options
   * @param {number[]} options.w — FSRS-5 weight parameters (19 values)
   * @param {number} options.requestRetention — Desired retention rate (0-1, default 0.9)
   * @param {number} options.maximumInterval — Maximum scheduling interval in days (default 36500)
   */
  constructor(options = {}) {
    this.w = options.w || [...DEFAULT_WEIGHTS];
    this.requestRetention = options.requestRetention || 0.9;
    this.maximumInterval = options.maximumInterval || 36500; // ~100 years
  }

  // ==========================================
  // PUBLIC: Create a blank new card record
  // ==========================================
  createCard(now = Date.now()) {
    return {
      state: State.New,
      difficulty: 0,
      stability: 0,
      due: now,
      lastReview: 0,
      reps: 0,
      lapses: 0,
      // Backward compat fields for Leitner display
      box: 1,
      nextReview: now,
      lastReviewed: 0
    };
  }

  // ==========================================
  // PUBLIC: Review a card with a given rating
  // Returns a new card object (immutable — does not mutate input)
  // ==========================================
  /**
   * @param {object} card — Current card state
   * @param {number} rating — Rating.Again(1), Rating.Hard(2), Rating.Good(3), Rating.Easy(4)
   * @param {number} now — Current timestamp in ms (default Date.now())
   * @returns {object} Updated card with new scheduling
   */
  reviewCard(card, rating, now = Date.now()) {
    // Clone card to avoid mutation
    const updated = { ...card };
    const elapsedDays = card.lastReview > 0 ? daysBetween(card.lastReview, now) : 0;

    updated.reps = (card.reps || 0) + 1;
    updated.lastReview = now;
    updated.lastReviewed = now; // backward compat alias

    if (card.state === State.New) {
      // First review — initialize stability and difficulty
      updated.difficulty = this._initDifficulty(rating);
      updated.stability = this._initStability(rating);

      if (rating === Rating.Again) {
        updated.state = State.Learning;
        updated.lapses = (card.lapses || 0) + 1;
        updated.stability = this._initStability(Rating.Again);
      } else {
        updated.state = rating === Rating.Easy ? State.Review : State.Learning;
      }
    } else if (card.state === State.Learning || card.state === State.Relearning) {
      // Learning/Relearning phase
      if (rating === Rating.Again) {
        updated.difficulty = this._nextDifficulty(card.difficulty, rating);
        updated.stability = this._initStability(Rating.Again);
        updated.lapses = (card.lapses || 0) + 1;
        updated.state = State.Relearning;
      } else if (rating === Rating.Hard) {
        updated.difficulty = this._nextDifficulty(card.difficulty, rating);
        updated.stability = this._initStability(Rating.Hard);
        updated.state = State.Learning;
      } else {
        // Good or Easy — graduate to Review
        updated.difficulty = this._nextDifficulty(card.difficulty, rating);
        updated.stability = rating === Rating.Easy
          ? this._initStability(Rating.Easy)
          : this._initStability(Rating.Good);
        updated.state = State.Review;
      }
    } else {
      // Review phase — full FSRS update
      const retrievability = this.getRetrievability(card, now);
      updated.difficulty = this._nextDifficulty(card.difficulty, rating);

      if (rating === Rating.Again) {
        // Lapse — card forgotten
        updated.lapses = (card.lapses || 0) + 1;
        updated.stability = this._nextForgetStability(card.stability, card.difficulty, retrievability);
        updated.state = State.Relearning;
      } else {
        // Successful recall
        updated.stability = this._nextRecallStability(
          card.stability, card.difficulty, retrievability, rating
        );
        updated.state = State.Review;
      }
    }

    // Schedule next review
    const intervalDays = this._nextInterval(updated.stability);
    updated.due = now + (intervalDays * 24 * 60 * 60 * 1000);
    updated.nextReview = updated.due; // backward compat alias

    // Derive backward-compat box from FSRS state
    updated.box = this._deriveBox(updated);

    return updated;
  }

  // ==========================================
  // PUBLIC: Calculate retrievability (memory strength) at a given time
  // Returns 0-1 where 1 = perfect retention
  // ==========================================
  /**
   * @param {object} card — Card with stability and lastReview fields
   * @param {number} now — Current timestamp in ms
   * @returns {number} Retrievability 0-1
   */
  getRetrievability(card, now = Date.now()) {
    if (!card || card.state === State.New || !card.lastReview || card.stability <= 0) {
      return 0;
    }
    const elapsedDays = daysBetween(card.lastReview, now);
    // FSRS power forgetting curve: R = (1 + t / (9 * S))^(-1)
    return Math.pow(1 + elapsedDays / (9 * card.stability), -1);
  }

  // ==========================================
  // PUBLIC: Convert old Leitner card data to FSRS format
  // ==========================================
  /**
   * @param {object} leitnerCard — { box: 1-5, nextReview, lastReviewed }
   * @param {number} now — Current timestamp
   * @returns {object} FSRS-compatible card record
   */
  migrateLeitnerCard(leitnerCard, now = Date.now()) {
    const box = leitnerCard.box || 1;
    const lastReviewed = leitnerCard.lastReviewed || 0;

    // Map Leitner box to approximate FSRS stability (days)
    // Box 1 = new/failed, Box 2 = 2d, Box 3 = 5d, Box 4 = 9d, Box 5 = 15d
    const stabilityMap = { 1: 0.4, 2: 2.0, 3: 5.0, 4: 9.0, 5: 15.0 };
    const difficultyMap = { 1: 7.0, 2: 6.0, 3: 5.0, 4: 4.5, 5: 4.0 };

    let state;
    if (box <= 1 && lastReviewed <= 0) {
      state = State.New;
    } else if (box <= 1) {
      state = State.Relearning;
    } else if (box >= 5) {
      state = State.Review;
    } else {
      state = box <= 2 ? State.Learning : State.Review;
    }

    return {
      state,
      difficulty: difficultyMap[box] || 5.0,
      stability: stabilityMap[box] || 0.4,
      due: leitnerCard.nextReview || now,
      lastReview: lastReviewed,
      reps: box > 1 ? box : 0,
      lapses: box === 1 && lastReviewed > 0 ? 1 : 0,
      // Backward compat
      box,
      nextReview: leitnerCard.nextReview || now,
      lastReviewed: lastReviewed
    };
  }

  // ==========================================
  // PRIVATE: Initial difficulty for first review
  // D0 = w4 - exp(w5 * (rating - 1)) + 1
  // ==========================================
  _initDifficulty(rating) {
    const d = this.w[4] - Math.exp(this.w[5] * (rating - 1)) + 1;
    return clamp(d, 1, 10);
  }

  // ==========================================
  // PRIVATE: Initial stability for first review
  // S0 = w[rating - 1]
  // ==========================================
  _initStability(rating) {
    return Math.max(this.w[rating - 1], 0.1);
  }

  // ==========================================
  // PRIVATE: Next difficulty after a review
  // D' = w7 * D0(3) + (1 - w7) * (D - w6 * (rating - 3))
  // Mean reversion towards initial difficulty of a "Good" rating
  // ==========================================
  _nextDifficulty(currentD, rating) {
    const d0 = this._initDifficulty(Rating.Good);
    const delta = currentD - this.w[6] * (rating - 3);
    const newD = this.w[7] * d0 + (1 - this.w[7]) * delta;
    return clamp(newD, 1, 10);
  }

  // ==========================================
  // PRIVATE: Next stability after successful recall
  // S' = S * (exp(w8) * (11 - D) * S^(-w9) * (exp(w10 * (1 - R)) - 1) * modifier + 1)
  // ==========================================
  _nextRecallStability(s, d, r, rating) {
    let hardPenalty = 1;
    let easyBonus = 1;

    if (rating === Rating.Hard) {
      hardPenalty = this.w[15];
    } else if (rating === Rating.Easy) {
      easyBonus = this.w[16];
    }

    const newS = s * (
      Math.exp(this.w[8]) *
      (11 - d) *
      Math.pow(s, -this.w[9]) *
      (Math.exp(this.w[10] * (1 - r)) - 1) *
      hardPenalty *
      easyBonus +
      1
    );

    return clamp(newS, 0.1, this.maximumInterval);
  }

  // ==========================================
  // PRIVATE: Next stability after a lapse (forgotten)
  // S' = w11 * D^(-w12) * ((S + 1)^w13 - 1) * exp(w14 * (1 - R))
  // ==========================================
  _nextForgetStability(s, d, r) {
    const newS = this.w[11] *
      Math.pow(d, -this.w[12]) *
      (Math.pow(s + 1, this.w[13]) - 1) *
      Math.exp(this.w[14] * (1 - r));

    return clamp(newS, 0.1, s); // Never exceed previous stability on forget
  }

  // ==========================================
  // PRIVATE: Calculate next interval from stability
  // I = round(S × 9 × (1/R − 1))  where R = desired retention (requestRetention)
  // ==========================================
  _nextInterval(stability) {
    const interval = stability * 9 * (1 / this.requestRetention - 1);
    return clamp(Math.round(Math.max(interval, 1)), 1, this.maximumInterval);
  }

  // ==========================================
  // PRIVATE: Derive backward-compatible box number from FSRS state
  // New→1, Learning→2, Review(low S)→3, Review(mid S)→4, Review(high S)/Mastered→5
  // ==========================================
  _deriveBox(card) {
    switch (card.state) {
      case State.New:
        return 1;
      case State.Learning:
      case State.Relearning:
        return 2;
      case State.Review: {
        if (card.stability >= 15) return 5;
        if (card.stability >= 7) return 4;
        return 3;
      }
      default:
        return 1;
    }
  }
}

// ==========================================
// MODULE-LEVEL SINGLETON INSTANCE
// ==========================================
export const fsrs = new FSRS();
