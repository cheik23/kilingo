/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievementCatalog from "../achievementCatalog.js";
import type * as achievementEngine from "../achievementEngine.js";
import type * as achievementProgress from "../achievementProgress.js";
import type * as achievements from "../achievements.js";
import type * as aiCharacters from "../aiCharacters.js";
import type * as aiConversation from "../aiConversation.js";
import type * as aiConversationStore from "../aiConversationStore.js";
import type * as aiScenarios from "../aiScenarios.js";
import type * as analytics from "../analytics.js";
import type * as asrEngine from "../asrEngine.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as chunkingCore from "../chunkingCore.js";
import type * as connectors_books from "../connectors/books.js";
import type * as connectors_dailymotion from "../connectors/dailymotion.js";
import type * as connectors_deezer from "../connectors/deezer.js";
import type * as connectors_deezerCatalog from "../connectors/deezerCatalog.js";
import type * as connectors_geniusLyrics from "../connectors/geniusLyrics.js";
import type * as connectors_googleBooksCatalog from "../connectors/googleBooksCatalog.js";
import type * as connectors_googlebooks from "../connectors/googlebooks.js";
import type * as connectors_groqChat from "../connectors/groqChat.js";
import type * as connectors_groqTranslate from "../connectors/groqTranslate.js";
import type * as connectors_groqWhisper from "../connectors/groqWhisper.js";
import type * as connectors_index from "../connectors/index.js";
import type * as connectors_internetArchive from "../connectors/internetArchive.js";
import type * as connectors_itunes from "../connectors/itunes.js";
import type * as connectors_itunesCatalog from "../connectors/itunesCatalog.js";
import type * as connectors_jamendo from "../connectors/jamendo.js";
import type * as connectors_lrclibLyrics from "../connectors/lrclibLyrics.js";
import type * as connectors_musicbrainz from "../connectors/musicbrainz.js";
import type * as connectors_podcastFeed from "../connectors/podcastFeed.js";
import type * as connectors_podcasts from "../connectors/podcasts.js";
import type * as connectors_qwenTranslate from "../connectors/qwenTranslate.js";
import type * as connectors_radio from "../connectors/radio.js";
import type * as connectors_rss from "../connectors/rss.js";
import type * as connectors_sleepAudio from "../connectors/sleepAudio.js";
import type * as connectors_tmdbCatalog from "../connectors/tmdbCatalog.js";
import type * as connectors_tvmaze from "../connectors/tvmaze.js";
import type * as connectors_types from "../connectors/types.js";
import type * as connectors_urbanDictionary from "../connectors/urbanDictionary.js";
import type * as connectors_wikimedia from "../connectors/wikimedia.js";
import type * as connectors_youtube from "../connectors/youtube.js";
import type * as crossSeed from "../crossSeed.js";
import type * as customization from "../customization.js";
import type * as customizationCatalog from "../customizationCatalog.js";
import type * as dailyChallenge from "../dailyChallenge.js";
import type * as dailyChallengeStore from "../dailyChallengeStore.js";
import type * as dynamicDict from "../dynamicDict.js";
import type * as dynamicMemory from "../dynamicMemory.js";
import type * as favorites from "../favorites.js";
import type * as gamification from "../gamification.js";
import type * as http from "../http.js";
import type * as landingStats from "../landingStats.js";
import type * as languages from "../languages.js";
import type * as leaderboard from "../leaderboard.js";
import type * as learning from "../learning.js";
import type * as lyricsCache from "../lyricsCache.js";
import type * as lyricsTranslate from "../lyricsTranslate.js";
import type * as media from "../media.js";
import type * as mediaHub from "../mediaHub.js";
import type * as mediaHub2 from "../mediaHub2.js";
import type * as mediaHub3 from "../mediaHub3.js";
import type * as mediaHub4 from "../mediaHub4.js";
import type * as mediaJobOps from "../mediaJobOps.js";
import type * as mediaJobRun from "../mediaJobRun.js";
import type * as mediaJobs from "../mediaJobs.js";
import type * as mediaResolver from "../mediaResolver.js";
import type * as mediaRetranslate from "../mediaRetranslate.js";
import type * as notifications from "../notifications.js";
import type * as ovAdmin from "../ovAdmin.js";
import type * as ovEnv from "../ovEnv.js";
import type * as ovLanguages from "../ovLanguages.js";
import type * as ovLibrary from "../ovLibrary.js";
import type * as ovProxy from "../ovProxy.js";
import type * as ovRights from "../ovRights.js";
import type * as ovSearch from "../ovSearch.js";
import type * as ovSources from "../ovSources.js";
import type * as ovStudio from "../ovStudio.js";
import type * as ovStudioEngine from "../ovStudioEngine.js";
import type * as ovStudioOps from "../ovStudioOps.js";
import type * as quizEngine from "../quizEngine.js";
import type * as referrals from "../referrals.js";
import type * as slang from "../slang.js";
import type * as slangSeed from "../slangSeed.js";
import type * as slangSeed2025 from "../slangSeed2025.js";
import type * as slangSeedAfrica from "../slangSeedAfrica.js";
import type * as stats from "../stats.js";
import type * as subtitles from "../subtitles.js";
import type * as textTranslate from "../textTranslate.js";
import type * as users from "../users.js";
import type * as youtubePipeline from "../youtubePipeline.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievementCatalog: typeof achievementCatalog;
  achievementEngine: typeof achievementEngine;
  achievementProgress: typeof achievementProgress;
  achievements: typeof achievements;
  aiCharacters: typeof aiCharacters;
  aiConversation: typeof aiConversation;
  aiConversationStore: typeof aiConversationStore;
  aiScenarios: typeof aiScenarios;
  analytics: typeof analytics;
  asrEngine: typeof asrEngine;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  chunkingCore: typeof chunkingCore;
  "connectors/books": typeof connectors_books;
  "connectors/dailymotion": typeof connectors_dailymotion;
  "connectors/deezer": typeof connectors_deezer;
  "connectors/deezerCatalog": typeof connectors_deezerCatalog;
  "connectors/geniusLyrics": typeof connectors_geniusLyrics;
  "connectors/googleBooksCatalog": typeof connectors_googleBooksCatalog;
  "connectors/googlebooks": typeof connectors_googlebooks;
  "connectors/groqChat": typeof connectors_groqChat;
  "connectors/groqTranslate": typeof connectors_groqTranslate;
  "connectors/groqWhisper": typeof connectors_groqWhisper;
  "connectors/index": typeof connectors_index;
  "connectors/internetArchive": typeof connectors_internetArchive;
  "connectors/itunes": typeof connectors_itunes;
  "connectors/itunesCatalog": typeof connectors_itunesCatalog;
  "connectors/jamendo": typeof connectors_jamendo;
  "connectors/lrclibLyrics": typeof connectors_lrclibLyrics;
  "connectors/musicbrainz": typeof connectors_musicbrainz;
  "connectors/podcastFeed": typeof connectors_podcastFeed;
  "connectors/podcasts": typeof connectors_podcasts;
  "connectors/qwenTranslate": typeof connectors_qwenTranslate;
  "connectors/radio": typeof connectors_radio;
  "connectors/rss": typeof connectors_rss;
  "connectors/sleepAudio": typeof connectors_sleepAudio;
  "connectors/tmdbCatalog": typeof connectors_tmdbCatalog;
  "connectors/tvmaze": typeof connectors_tvmaze;
  "connectors/types": typeof connectors_types;
  "connectors/urbanDictionary": typeof connectors_urbanDictionary;
  "connectors/wikimedia": typeof connectors_wikimedia;
  "connectors/youtube": typeof connectors_youtube;
  crossSeed: typeof crossSeed;
  customization: typeof customization;
  customizationCatalog: typeof customizationCatalog;
  dailyChallenge: typeof dailyChallenge;
  dailyChallengeStore: typeof dailyChallengeStore;
  dynamicDict: typeof dynamicDict;
  dynamicMemory: typeof dynamicMemory;
  favorites: typeof favorites;
  gamification: typeof gamification;
  http: typeof http;
  landingStats: typeof landingStats;
  languages: typeof languages;
  leaderboard: typeof leaderboard;
  learning: typeof learning;
  lyricsCache: typeof lyricsCache;
  lyricsTranslate: typeof lyricsTranslate;
  media: typeof media;
  mediaHub: typeof mediaHub;
  mediaHub2: typeof mediaHub2;
  mediaHub3: typeof mediaHub3;
  mediaHub4: typeof mediaHub4;
  mediaJobOps: typeof mediaJobOps;
  mediaJobRun: typeof mediaJobRun;
  mediaJobs: typeof mediaJobs;
  mediaResolver: typeof mediaResolver;
  mediaRetranslate: typeof mediaRetranslate;
  notifications: typeof notifications;
  ovAdmin: typeof ovAdmin;
  ovEnv: typeof ovEnv;
  ovLanguages: typeof ovLanguages;
  ovLibrary: typeof ovLibrary;
  ovProxy: typeof ovProxy;
  ovRights: typeof ovRights;
  ovSearch: typeof ovSearch;
  ovSources: typeof ovSources;
  ovStudio: typeof ovStudio;
  ovStudioEngine: typeof ovStudioEngine;
  ovStudioOps: typeof ovStudioOps;
  quizEngine: typeof quizEngine;
  referrals: typeof referrals;
  slang: typeof slang;
  slangSeed: typeof slangSeed;
  slangSeed2025: typeof slangSeed2025;
  slangSeedAfrica: typeof slangSeedAfrica;
  stats: typeof stats;
  subtitles: typeof subtitles;
  textTranslate: typeof textTranslate;
  users: typeof users;
  youtubePipeline: typeof youtubePipeline;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
