// User — the human identity on this machine. Thin: identity + bio +
// communication preferences + a pointer at the active Settings
// profile. Everything configuration-shaped (connections, presets,
// budgets, privacy, defaults) lives on Settings so profile switching
// is a pointer flip.
//
// ── Why preferences are deeper than they look ──────────────────────
// terseResponses=true is too coarse. The actual signal that matters
// is response *depth* — how much context the human can absorb without
// it costing them. A 100-word answer and a 1000-word answer that
// convey the same information are not equivalent if the human cannot
// track the 1000.
//
// `responseDefault` sets the floor. `elaborateOnAsk=true` says the
// worker may go deeper *when explicitly asked*, not preemptively.
// `accommodations[]` is a free-form list of relevant traits the
// worker should plan around — entries here are NOT corrective rules
// (those would be Constraints), they are honest context that shapes
// how the worker calibrates.

import type { GalleryDataReference, JsonObject } from '../types';

export type ResponseDepth = 'minimal' | 'concise' | 'detailed';

export type UserAccommodation = {
  id: string;
  label: string;
  note: string;
};

export type UserPreferences = {
  responseDefault: ResponseDepth;
  elaborateOnAsk: boolean;
  emojiOk: boolean;
  /** Free-form traits the worker should calibrate around. Not constraints. */
  accommodations: UserAccommodation[];
  timezone?: string;
  /**
   * @deprecated retained for one release — `responseDefault: 'concise'|'minimal'`
   * supersedes this. Treat true as `responseDefault='concise'` when both are set.
   */
  terseResponses?: boolean;
};

export type User = {
  id: string;
  email: string;
  displayName?: string;
  /**
   * One-line self-description. Rolls into the userBaseline system
   * message so workers know who they are talking to without re-asking
   * each session. Keep it short.
   */
  bio?: string;
  activeSettingsId: string;
  createdAt: string;
  preferences: UserPreferences;
};

export const userMockData: User[] = [
  {
    id: 'user_local',
    email: 'trjk@cyberfear.com',
    displayName: 'josiah',
    bio:
      'Directs technical work through agents. Evaluates outcomes by behavior, not by reading code. Strong views on agent alignment; minimal patience for verbose prose-about-prose.',
    activeSettingsId: 'settings_default',
    createdAt: '2026-03-01T00:00:00Z',
    preferences: {
      responseDefault: 'concise',
      elaborateOnAsk: true,
      emojiOk: false,
      timezone: 'America/Chicago',
      accommodations: [
        {
          id: 'acc_adhd',
          label: 'ADHD',
          note: 'Long context degrades tracking. ~100 words conveys what 1000 conveys, only better. The worker should default short and expand only when explicitly asked. Bullets and structure that aid scanning are fine; padding for "thoroughness" is not.',
        },
        {
          id: 'acc_non_coder',
          label: 'Not an engineer',
          note: 'Does not write code. Recognizes outcomes by whether they work. Trust their systems-level reasoning; do not assume they want code-level walkthroughs unless they ask. Their input is goal-shaped, not implementation-shaped.',
        },
      ],
    },
  },
];

export const userSchema: JsonObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'User',
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'email', 'activeSettingsId', 'createdAt', 'preferences'],
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
      displayName: { type: 'string' },
      bio: { type: 'string' },
      activeSettingsId: { type: 'string' },
      createdAt: { type: 'string' },
      preferences: {
        type: 'object',
        additionalProperties: false,
        required: ['responseDefault', 'elaborateOnAsk', 'emojiOk', 'accommodations'],
        properties: {
          responseDefault: {
            type: 'string',
            enum: ['minimal', 'concise', 'detailed'],
          },
          elaborateOnAsk: { type: 'boolean' },
          emojiOk: { type: 'boolean' },
          accommodations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'label', 'note'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                note: { type: 'string' },
              },
            },
          },
          timezone: { type: 'string' },
          terseResponses: { type: 'boolean' },
        },
      },
    },
  },
};

export const userReferences: GalleryDataReference[] = [
  {
    kind: 'has-many',
    label: 'Settings',
    targetSource: 'cart/component-gallery/data/settings.ts',
    sourceField: 'id',
    targetField: 'userId',
    summary:
      'Users own one or more Settings profiles (work / personal / strict-client / etc.). Each profile bundles its own connections, presets, budgets, and privacy policy.',
  },
  {
    kind: 'references',
    label: 'Active settings',
    targetSource: 'cart/component-gallery/data/settings.ts',
    sourceField: 'activeSettingsId',
    targetField: 'id',
    summary: 'Points at the currently-active profile. Swapping this is how profile switching happens.',
  },
  {
    kind: 'has-many',
    label: 'Agent memories',
    targetSource: 'cart/component-gallery/data/agent-memory.ts',
    sourceField: 'id',
    targetField: 'userId',
    summary:
      'Agent memories stay on User, not Settings — memories are identity-grain, not profile-grain. (Same human across profiles keeps the same accumulated project memory.)',
  },
  {
    kind: 'references',
    label: 'Bio + accommodations feed system messages',
    targetSource: 'cart/component-gallery/data/system-message.ts',
    sourceField: 'bio + preferences.accommodations[]',
    targetField: 'body (interpolated)',
    summary:
      'Bio and accommodations are interpolated into the user-baseline system message at request-resolve time. Keeps "be terse, ADHD, don\'t over-explain" in one place instead of repeating across every role.',
  },
];
