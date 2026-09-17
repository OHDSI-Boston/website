/**
 * config.js — the one place to edit URLs and endpoints.
 *
 * Nothing secret belongs in this file. It ships to every visitor's browser.
 * The signup endpoint below is a public Google Apps Script web-app URL; the
 * Sheet credentials live inside the Apps Script deployment, never here.
 * See ../../google-apps-script/README.md.
 */

export const CONFIG = {
  /* ---------------------------------------------------------------- links */
  /* TODO: replace the empty strings with real URLs.
     Any link left empty renders as a disabled placeholder rather than a
     broken link, so the site is safe to deploy before these are decided. */
  links: {
    ohdsi:        'https://ohdsi.org',
    ohdsiForums:  'https://forums.ohdsi.org',
    github:       '',   // e.g. https://github.com/<org>/<repo>
    runAStudy:    '',   // "Help us run a study"
    proposeQuestion: '', // "Propose a question"
    calendar:     '',   // optional: meetup / calendar link
    contactEmail: ''    // optional: shown as a fallback if signup fails
  },

  /* --------------------------------------------------------------- signup */
  signup: {
    /* Public Google Apps Script web-app URL (ends in /exec). Not a secret. */
    endpoint: 'https://script.google.com/macros/s/AKfycbzsgtMBgyXbCkvfwZb3wL9sb3fEBjMTuGPS0JAnKItRltje4FuB0LqPq9NflBq1wG76/exec'
  },

  /* ------------------------------------------------------------ night sky */
  sky: {
    revolutionSeconds: 3600,        // one full turn of the star field per hour
    shootingStarMeanSeconds: 180,   // random wait between shooting stars, mean
    dayCycleSeconds: 1200           // sunrise → sunset → night → sunrise, 20 minutes
  },

  /* ---------------------------------------------------------- story tuning */
  story: {
    /* Fraction of each step's scroll distance spent holding the scene
       (split between its start and end); the rest is the transition. */
    hold: 0.34,
    /* Exponential smoothing applied to scroll progress. 0 = no smoothing. */
    smoothing: 0.16,
    /* Cast sizes. The narrow variant is used below `narrowBreakpoint`. */
    cast:       { people: 14, quanta: 9, sites: 8, archive: 35 },   // archive + 1 = 6 × 6 grid
    castNarrow: { people: 10, quanta: 9, sites: 6, archive: 15 },   // archive + 1 = 4 × 4 grid
    narrowBreakpoint: 700
  }
};

/** True when the visitor has asked the OS for reduced motion. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
