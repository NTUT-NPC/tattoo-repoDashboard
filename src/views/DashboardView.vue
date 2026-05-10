<template>
  <main class="dashboard">
    <header class="header">
      <div class="header-main">
        <h1>
          <img class="header-logo" src="/logo.svg" alt="Tattoo logo" />
          <span>{{ t('app.title') }}</span>
        </h1>
        <p><code>NTUT-NPC/tattoo</code> · {{ t('header.refreshSuffix', { sec: refreshIntervalSec }) }}</p>
      </div>
      <div class="meta" role="status" aria-live="polite">
        <span class="refresh-ring" :aria-label="t('header.nextRefreshCountdown')">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle class="refresh-ring-track" cx="20" cy="20" r="16" />
            <circle
              class="refresh-ring-progress"
              cx="20"
              cy="20"
              r="16"
              :style="{ strokeDashoffset: `${refreshRingDashOffset}px` }"
            />
          </svg>
          <span class="refresh-ring-number">{{ refreshCountdownSec }}</span>
        </span>
        <span :class="['chip', isUpdating ? 'updating' : 'ok']">{{ isUpdating ? t('header.updating') : t('header.synced') }}</span>
        <span class="token-state meta-pill" :class="{ active: hasTokenSaved }">
          {{ hasTokenSaved ? t('header.tokenOn') : t('header.anonymous') }}
        </span>
        <span class="time meta-pill">{{ lastUpdatedText }}</span>
        <button
          type="button"
          class="settings-btn meta-pill"
          :aria-label="showTokenPanel ? t('aria.closeSettings') : t('aria.openSettings')"
          @click="showTokenPanel = !showTokenPanel"
        >
          ⚙
        </button>
      </div>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="grid-section">
      <div class="section-heading">
        <h2>{{ t('section.openPrs') }}</h2>
      </div>
      <div class="grid">
        <div
          v-for="pr in prs"
          :key="pr.id"
          class="card-slot"
          :data-pr-id="pr.id"
          @click="openPrDetails(pr, $event)"
        >
          <PrCard :pr="pr" :activity-display-mode="activityDisplayMode" :date-display-mode="dateDisplayMode" />
        </div>
      </div>
    </section>

    <section class="merged-section">
      <button type="button" class="merged-toggle" @click="toggleMergedSection">
        <span>{{ t('section.recentlyMerged') }}</span>
        <span>{{ showRecentlyMerged ? '▾' : '▸' }}</span>
      </button>
      <div v-if="showRecentlyMerged" class="merged-list">
        <a
          v-for="pr in recentlyMergedPrs"
          :key="`merged-${pr.id}`"
          class="merged-item"
          :href="pr.url"
          target="_blank"
          rel="noreferrer noopener"
        >
          <span class="merged-item-title">#{{ pr.number }} · {{ pr.title }}</span>
          <span class="merged-item-time">{{ t('section.mergedAt', { time: formatMergedAt(pr.mergedAt ?? pr.updatedAt) }) }}</span>
        </a>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="settings-modal">
        <section
          v-if="showTokenPanel"
          class="settings-mask"
          aria-live="polite"
          @click="handleSettingsMaskClick"
        >
          <div class="settings-card" role="dialog" aria-modal="true" :aria-label="t('aria.settingsDialog')">
            <div class="settings-toolbar">
              <div>
                <h2>{{ t('settings.title') }}</h2>
                <p class="settings-toolbar-status">{{ tokenMessage }}</p>
              </div>
              <button type="button" class="close-btn" :aria-label="t('aria.closeSettingsDialog')" @click="showTokenPanel = false">✕</button>
            </div>
            <div class="settings-layout">
              <nav class="settings-nav" :aria-label="t('settings.title')" role="tablist">
                <button
                  id="settings-tab-general"
                  type="button"
                  role="tab"
                  :aria-selected="activeSettingsTab === 'general'"
                  aria-controls="settings-panel-general"
                  :class="{ active: activeSettingsTab === 'general' }"
                  @click="activeSettingsTab = 'general'"
                >
                  {{ t('settings.section.general') }}
                </button>
                <button
                  id="settings-tab-alerts"
                  type="button"
                  role="tab"
                  :aria-selected="activeSettingsTab === 'alerts'"
                  aria-controls="settings-panel-alerts"
                  :class="{ active: activeSettingsTab === 'alerts' }"
                  @click="activeSettingsTab = 'alerts'"
                >
                  {{ t('settings.section.alerts') }}
                </button>
                <button
                  id="settings-tab-access"
                  type="button"
                  role="tab"
                  :aria-selected="activeSettingsTab === 'access'"
                  aria-controls="settings-panel-access"
                  :class="{ active: activeSettingsTab === 'access' }"
                  @click="activeSettingsTab = 'access'"
                >
                  {{ t('settings.section.access') }}
                </button>
                <button
                  id="settings-tab-animation"
                  type="button"
                  role="tab"
                  :aria-selected="activeSettingsTab === 'animation'"
                  aria-controls="settings-panel-animation"
                  :class="{ active: activeSettingsTab === 'animation' }"
                  @click="activeSettingsTab = 'animation'"
                >
                  {{ t('settings.section.animation') }}
                </button>
                <button
                  id="settings-tab-refresh"
                  type="button"
                  role="tab"
                  :aria-selected="activeSettingsTab === 'refresh'"
                  aria-controls="settings-panel-refresh"
                  :class="{ active: activeSettingsTab === 'refresh' }"
                  @click="activeSettingsTab = 'refresh'"
                >
                  {{ t('settings.section.refresh') }}
                </button>
              </nav>

              <div class="settings-content">
                <section
                  v-show="activeSettingsTab === 'general'"
                  id="settings-panel-general"
                  class="settings-section"
                  role="tabpanel"
                  aria-labelledby="settings-tab-general"
                >
                  <div class="settings-section-heading">
                    <h3>{{ t('settings.section.general') }}</h3>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <label for="language-mode" class="setting-title">{{ t('settings.language') }}</label>
                    </div>
                    <div class="settings-control">
                      <select id="language-mode" v-model="languageMode" @change="applyLanguageMode">
                        <option value="auto">{{ t('settings.language.auto') }}</option>
                        <option value="zh">{{ t('settings.language.zh') }}</option>
                        <option value="en">{{ t('settings.language.en') }}</option>
                        <option value="wzh">{{ t('settings.language.wzh') }}</option>
                      </select>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.activityDisplayMode') }}</span>
                      <span class="setting-hint">{{ t('settings.activityHint') }}</span>
                    </div>
                    <div class="settings-control">
                      <div class="segmented-control" role="radiogroup" :aria-label="t('settings.activityDisplayMode')">
                        <label :class="{ active: activityDisplayMode === 'separate' }">
                          <input v-model="activityDisplayMode" type="radio" value="separate" @change="applyActivityDisplayMode" />
                          <span>{{ t('settings.activityMode.separate') }}</span>
                        </label>
                        <label :class="{ active: activityDisplayMode === 'latest' }">
                          <input v-model="activityDisplayMode" type="radio" value="latest" @change="applyActivityDisplayMode" />
                          <span>{{ t('settings.activityMode.latest') }}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.dateDisplayMode') }}</span>
                      <span class="setting-hint">{{ t('settings.dateHint') }}</span>
                    </div>
                    <div class="settings-control">
                      <div class="segmented-control" role="radiogroup" :aria-label="t('settings.dateDisplayMode')">
                        <label :class="{ active: dateDisplayMode === 'smart' }">
                          <input v-model="dateDisplayMode" type="radio" value="smart" @change="applyDateDisplayMode" />
                          <span>{{ t('settings.dateMode.smart') }}</span>
                        </label>
                        <label :class="{ active: dateDisplayMode === 'full' }">
                          <input v-model="dateDisplayMode" type="radio" value="full" @change="applyDateDisplayMode" />
                          <span>{{ t('settings.dateMode.full') }}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.recentlyMergedDefaultOpen') }}</span>
                    </div>
                    <div class="settings-control settings-control-actions">
                      <label class="toggle-control" for="recently-merged-default-open">
                        <input
                          id="recently-merged-default-open"
                          v-model="recentlyMergedOpenByDefault"
                          type="checkbox"
                          @change="applyRecentlyMergedOpenByDefault"
                        />
                        <span>{{ t('settings.recentlyMergedDefaultOpen.toggle') }}</span>
                      </label>
                    </div>
                  </div>
                </section>

                <section
                  v-show="activeSettingsTab === 'alerts'"
                  id="settings-panel-alerts"
                  class="settings-section"
                  role="tabpanel"
                  aria-labelledby="settings-tab-alerts"
                >
                  <div class="settings-section-heading">
                    <h3>{{ t('settings.section.alerts') }}</h3>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.desktopNotification') }}</span>
                      <span class="setting-hint">{{ t('settings.desktopNotification.permissionState', { state: desktopNotificationPermissionText }) }}</span>
                      <span class="setting-hint">{{ t('settings.desktopNotification.hint') }}</span>
                    </div>
                    <div class="settings-control settings-control-actions">
                      <label class="toggle-control" for="desktop-notification-enabled">
                        <input
                          id="desktop-notification-enabled"
                          v-model="desktopNotificationEnabled"
                          type="checkbox"
                          @change="applyDesktopNotificationSetting"
                        />
                        <span>{{ t('settings.desktopNotification.toggle') }}</span>
                      </label>
                      <button type="button" class="secondary" @click="requestDesktopNotificationPermission">{{ t('settings.desktopNotification.requestPermission') }}</button>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.wakeLock') }}</span>
                      <span class="setting-hint">{{ t('settings.wakeLock.status', { state: wakeLockStatusText }) }}</span>
                      <span class="setting-hint">{{ t('settings.wakeLock.hint') }}</span>
                    </div>
                    <div class="settings-control settings-control-actions">
                      <label class="toggle-control" for="screen-wake-lock-enabled">
                        <input
                          id="screen-wake-lock-enabled"
                          v-model="screenWakeLockEnabled"
                          type="checkbox"
                          :disabled="!isWakeLockSupported"
                          @change="applyScreenWakeLockSetting"
                        />
                        <span>{{ t('settings.wakeLock.toggle') }}</span>
                      </label>
                    </div>
                  </div>
                </section>

                <section
                  v-show="activeSettingsTab === 'access'"
                  id="settings-panel-access"
                  class="settings-section"
                  role="tabpanel"
                  aria-labelledby="settings-tab-access"
                >
                  <div class="settings-section-heading">
                    <h3>{{ t('settings.section.access') }}</h3>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <label for="github-token" class="setting-title">{{ t('settings.githubToken') }}</label>
                      <span class="setting-hint">
                        {{ t('settings.githubToken.howtoPrefix') }}
                        <a href="https://github.com/NTUT-NPC/tattoo-repoDashboard#%E5%AE%8C%E6%95%B4-github-token-%E7%94%B3%E8%AB%8B%E6%95%99%E5%AD%B8%E5%BB%BA%E8%AD%B0%E5%85%88%E7%9C%8B" target="_blank" rel="noreferrer noopener">
                          {{ t('settings.githubToken.readmeLink') }}
                        </a>
                        {{ t('settings.githubToken.howtoSuffix') }}
                      </span>
                    </div>
                    <div class="settings-control settings-control-actions token-entry">
                      <input
                        id="github-token"
                        v-model="tokenInput"
                        type="password"
                        :placeholder="t('settings.githubToken.placeholder')"
                        autocomplete="off"
                        spellcheck="false"
                      />
                      <button type="button" @click="saveToken">{{ t('settings.githubToken.save') }}</button>
                      <button type="button" class="secondary" @click="clearToken">{{ t('settings.githubToken.clear') }}</button>
                    </div>
                  </div>
                </section>

                <section
                  v-show="activeSettingsTab === 'animation'"
                  id="settings-panel-animation"
                  class="settings-section"
                  role="tabpanel"
                  aria-labelledby="settings-tab-animation"
                >
                  <div class="settings-section-heading">
                    <h3>{{ t('settings.section.animation') }}</h3>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.animationPreview') }}</span>
                    </div>
                    <div class="settings-control settings-control-actions">
                      <button type="button" class="secondary" @click="previewLatestPrStatusAnimation">{{ t('settings.animationPreview.button') }}</button>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.statusAnimationSound') }}</span>
                      <span class="setting-hint">{{ t('settings.statusAnimationSound.current', { name: statusAnimationSoundLabel }) }}</span>
                    </div>
                    <div class="settings-control settings-control-actions">
                      <label class="toggle-control" for="status-animation-sound-enabled">
                        <input
                          id="status-animation-sound-enabled"
                          v-model="statusAnimationSoundEnabled"
                          type="checkbox"
                          @change="applyStatusAnimationSoundEnabled"
                        />
                        <span>{{ t('settings.statusAnimationSound.toggle') }}</span>
                      </label>
                      <input
                        id="status-animation-sound-file"
                        class="file-input"
                        type="file"
                        accept="audio/*"
                        @change="uploadStatusAnimationSound"
                      />
                      <label class="file-picker" for="status-animation-sound-file">{{ t('settings.statusAnimationSound.upload') }}</label>
                      <button type="button" class="secondary" @click="previewStatusAnimationSound">{{ t('settings.statusAnimationSound.preview') }}</button>
                      <button type="button" class="secondary" @click="clearCustomStatusAnimationSound">{{ t('settings.statusAnimationSound.reset') }}</button>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <label for="status-animation-close-delay" class="setting-title">{{ t('settings.statusAnimationCloseDelay') }}</label>
                      <span class="setting-hint">{{ t('settings.statusAnimationCloseDelay.range', { min: MIN_STATUS_ANIMATION_CLOSE_DELAY_SEC, max: MAX_STATUS_ANIMATION_CLOSE_DELAY_SEC, def: DEFAULT_STATUS_ANIMATION_CLOSE_DELAY_SEC }) }}</span>
                      <span class="setting-hint">{{ t('settings.statusAnimationCloseDelay.hint') }}</span>
                    </div>
                    <div class="settings-control settings-control-actions number-action">
                      <input
                        id="status-animation-close-delay"
                        v-model.number="statusAnimationCloseDelayInputSec"
                        type="number"
                        :min="MIN_STATUS_ANIMATION_CLOSE_DELAY_SEC"
                        :max="MAX_STATUS_ANIMATION_CLOSE_DELAY_SEC"
                        step="1"
                      />
                      <button type="button" @click="applyStatusAnimationCloseDelay">{{ t('settings.apply') }}</button>
                    </div>
                  </div>
                </section>

                <section
                  v-show="activeSettingsTab === 'refresh'"
                  id="settings-panel-refresh"
                  class="settings-section"
                  role="tabpanel"
                  aria-labelledby="settings-tab-refresh"
                >
                  <div class="settings-section-heading">
                    <h3>{{ t('settings.section.refresh') }}</h3>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <label for="refresh-interval" class="setting-title">{{ t('settings.refreshInterval') }}</label>
                      <span class="setting-hint">{{ t('settings.refreshInterval.range', { min: MIN_REFRESH_INTERVAL_SEC, max: MAX_REFRESH_INTERVAL_SEC }) }}</span>
                    </div>
                    <div class="settings-control settings-control-actions number-action">
                      <input
                        id="refresh-interval"
                        v-model.number="refreshIntervalInput"
                        type="number"
                        :min="MIN_REFRESH_INTERVAL_SEC"
                        :max="MAX_REFRESH_INTERVAL_SEC"
                        step="1"
                      />
                      <button type="button" @click="applyRefreshInterval">{{ t('settings.refreshInterval.apply') }}</button>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-copy">
                      <span class="setting-title">{{ t('settings.autoUpdateCheck') }}</span>
                      <span class="setting-hint">{{ t('settings.autoUpdateCheck.range', { min: MIN_AUTO_UPDATE_CHECK_INTERVAL_MIN, max: MAX_AUTO_UPDATE_CHECK_INTERVAL_MIN, def: DEFAULT_AUTO_UPDATE_CHECK_INTERVAL_MIN }) }}</span>
                      <span class="setting-hint">
                        {{ t('settings.projectRepo') }}
                        <a href="https://github.com/NTUT-NPC/tattoo-repoDashboard" target="_blank" rel="noreferrer noopener">
                          github.com/NTUT-NPC/tattoo-repoDashboard
                        </a>
                      </span>
                    </div>
                    <div class="settings-control settings-control-actions">
                      <label class="toggle-control" for="auto-update-check-enabled">
                        <input id="auto-update-check-enabled" v-model="autoUpdateCheckEnabled" type="checkbox" @change="applyAutoUpdateCheckEnabled" />
                        <span>{{ t('settings.autoUpdateCheck.toggle') }}</span>
                      </label>
                      <div class="number-action">
                        <label class="sr-only" for="auto-update-check-interval">{{ t('settings.autoUpdateCheckInterval') }}</label>
                        <input id="auto-update-check-interval" v-model.number="autoUpdateCheckIntervalMinInput" type="number" :min="MIN_AUTO_UPDATE_CHECK_INTERVAL_MIN" :max="MAX_AUTO_UPDATE_CHECK_INTERVAL_MIN" step="1" />
                        <button type="button" @click="applyAutoUpdateCheckInterval">{{ t('settings.apply') }}</button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </Transition>

      <Transition name="settings-modal">
        <section
          v-if="showOnboardingModal"
          class="settings-mask"
          aria-live="polite"
          @click="handleOnboardingMaskClick"
        >
          <div class="settings-card onboarding-card" role="dialog" aria-modal="true" :aria-label="t('onboarding.title')">
            <div class="settings-toolbar">
              <h2>{{ t('onboarding.title') }}</h2>
            </div>
            <div class="settings-content">
              <p class="token-hint">{{ t('onboarding.body') }}</p>
              <div class="token-controls">
                <button type="button" class="secondary" @click="continueWithAnonymousMode">{{ t('onboarding.anonymous') }}</button>
                <button type="button" @click="openSettingsFromOnboarding">{{ t('onboarding.goToSettings') }}</button>
              </div>
            </div>
          </div>
        </section>
      </Transition>

      <Transition name="detail-modal">
        <section
          v-if="selectedPr"
          class="detail-mask"
          aria-live="polite"
          @click="handleDetailMaskClick"
        >
          <div class="detail-card-wrap">
            <button type="button" class="close-btn close-btn-floating" :aria-label="t('aria.closeDetails')" @click="closePrDetails">✕</button>
            <PrCard
              :pr="selectedPr"
              cinematic
              :effect="detailEffect"
              :ci-summary="detailCiSummary"
              :show-effect="detailShowEffect"
              :date-display-mode="dateDisplayMode"
            />
          </div>
        </section>
      </Transition>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import PrCard from '../components/PrCard.vue';
import {
  fetchPrCards,
  fetchRecentlyMergedPrCards,
  fetchPullRequestMergeState,
  hasSavedGithubToken,
  isUsingEnvironmentGithubToken,
  saveGithubToken,
  validateGithubToken,
  type PullRequestCard,
} from '../services/githubApi.ts';
import { useI18n, type MessageKey } from '../services/i18n.ts';

const REFRESH_INTERVAL_MS = 30_000;
const DEFAULT_REFRESH_INTERVAL_SEC = REFRESH_INTERVAL_MS / 1000;
const MIN_REFRESH_INTERVAL_SEC = 5;
const MAX_REFRESH_INTERVAL_SEC = 300;
const REFRESH_INTERVAL_STORAGE_KEY = 'tattoo-dashboard-refresh-interval-sec';
const ACTIVITY_DISPLAY_MODE_STORAGE_KEY = 'tattoo-dashboard-activity-display-mode';
const DATE_DISPLAY_MODE_STORAGE_KEY = 'tattoo-dashboard-date-display-mode';
const DESKTOP_NOTIFICATION_STORAGE_KEY = 'tattoo-dashboard-desktop-notification-enabled';
const SCREEN_WAKE_LOCK_STORAGE_KEY = 'tattoo-dashboard-screen-wake-lock-enabled';
const STATUS_ANIMATION_SOUND_ENABLED_STORAGE_KEY = 'tattoo-dashboard-status-animation-sound-enabled';
const STATUS_ANIMATION_SOUND_DATA_URL_STORAGE_KEY = 'tattoo-dashboard-status-animation-sound-data-url';
const STATUS_ANIMATION_SOUND_NAME_STORAGE_KEY = 'tattoo-dashboard-status-animation-sound-name';
const DEFAULT_STATUS_ANIMATION_SOUND_PATH = '/cash.mp3';
const DEFAULT_STATUS_ANIMATION_SOUND_NAME = 'cash.mp3';
const DEFAULT_STATUS_ANIMATION_CLOSE_DELAY_SEC = 8;
const MIN_STATUS_ANIMATION_CLOSE_DELAY_SEC = 3;
const MAX_STATUS_ANIMATION_CLOSE_DELAY_SEC = 20;
const STATUS_ANIMATION_CLOSE_DELAY_STORAGE_KEY = 'tattoo-dashboard-pr-status-close-delay-sec';
const ONBOARDING_DISMISSED_STORAGE_KEY = 'tattoo-dashboard-onboarding-dismissed';
const AUTO_UPDATE_CHECK_ENABLED_STORAGE_KEY = 'tattoo-dashboard-auto-update-check-enabled';
const AUTO_UPDATE_CHECK_INTERVAL_MIN_STORAGE_KEY = 'tattoo-dashboard-auto-update-check-interval-min';
const RECENTLY_MERGED_OPEN_BY_DEFAULT_STORAGE_KEY = 'tattoo-dashboard-recently-merged-open-by-default';
const DEFAULT_AUTO_UPDATE_CHECK_INTERVAL_MIN = 10;
const MIN_AUTO_UPDATE_CHECK_INTERVAL_MIN = 1;
const MAX_AUTO_UPDATE_CHECK_INTERVAL_MIN = 1000;

type ActivityDisplayMode = 'separate' | 'latest';
type DateDisplayMode = 'smart' | 'full';
type SettingsTab = 'general' | 'alerts' | 'access' | 'animation' | 'refresh';
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>;
  };
};

const { t, intlLocale, resolvedLocale, languageMode, setLanguageMode } = useI18n();

const prs = ref<PullRequestCard[]>([]);
const selectedPr = ref<PullRequestCard | null>(null);
const errorKey = ref<MessageKey | ''>('');
const isUpdating = ref(false);
const lastUpdatedAt = ref<Date | null>(null);
const showTokenPanel = ref(false);
const activeSettingsTab = ref<SettingsTab>('general');
const hasTokenSaved = ref(false);
const tokenInput = ref('');
const tokenMessageState = ref<
  | { type: 'key'; key: MessageKey; params?: Record<string, string | number> }
  | { type: 'text'; text: string }
>({
  type: 'key',
  key: 'message.token.anonymous',
});
const showOnboardingModal = ref(false);
const refreshIntervalSec = ref(DEFAULT_REFRESH_INTERVAL_SEC);
const refreshIntervalInput = ref(DEFAULT_REFRESH_INTERVAL_SEC);
const refreshCountdownSec = ref(DEFAULT_REFRESH_INTERVAL_SEC);
const statusAnimationCloseDelaySec = ref(DEFAULT_STATUS_ANIMATION_CLOSE_DELAY_SEC);
const statusAnimationCloseDelayInputSec = ref(DEFAULT_STATUS_ANIMATION_CLOSE_DELAY_SEC);
const activityDisplayMode = ref<ActivityDisplayMode>('separate');
const dateDisplayMode = ref<DateDisplayMode>('smart');
const desktopNotificationEnabled = ref(false);
const screenWakeLockEnabled = ref(false);
const statusAnimationSoundEnabled = ref(true);
const customStatusAnimationSoundDataUrl = ref('');
const customStatusAnimationSoundName = ref('');
const detailEffect = ref<'new_pr' | 'ci_complete' | 'merged'>('ci_complete');
const detailCiSummary = ref<Array<{ name: string; result: 'success' | 'failure' }>>([]);
const detailShowEffect = ref(false);
const autoUpdateCheckEnabled = ref(false);
const autoUpdateCheckIntervalMin = ref(DEFAULT_AUTO_UPDATE_CHECK_INTERVAL_MIN);
const autoUpdateCheckIntervalMinInput = ref(DEFAULT_AUTO_UPDATE_CHECK_INTERVAL_MIN);
const recentlyMergedPrs = ref<PullRequestCard[]>([]);
const showRecentlyMerged = ref(false);
const recentlyMergedOpenByDefault = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let previewCloseTimer: ReturnType<typeof setTimeout> | null = null;
let nextRefreshAt: number | null = null;
let wakeLockSentinel: WakeLockSentinel | null = null;
let statusAnimationAudio: HTMLAudioElement | null = null;
let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;
let latestRepoDashboardPushSha = '';

let refreshInFlight: Promise<void> | null = null;
let refreshQueued = false;
let isFirstRefresh = true;

function setTokenMessage(key: MessageKey, params?: Record<string, string | number>) {
  tokenMessageState.value = { type: 'key', key, params };
}

function setTokenMessageText(text: string) {
  tokenMessageState.value = { type: 'text', text };
}

const tokenMessage = computed(() => {
  if (tokenMessageState.value.type === 'text') return tokenMessageState.value.text;
  return t(tokenMessageState.value.key, tokenMessageState.value.params);
});
const error = computed(() => (errorKey.value ? t(errorKey.value as MessageKey) : ''));
const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return t('header.notUpdatedYet');
  return t('header.lastUpdated', { time: lastUpdatedAt.value.toLocaleString(intlLocale.value) });
});
const refreshRingDashOffset = computed(() => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const safeInterval = Math.max(1, refreshIntervalSec.value);
  const progress = Math.min(1, Math.max(0, refreshCountdownSec.value / safeInterval));

  return circumference * (1 - progress);
});
const desktopNotificationPermissionText = computed(() => {
  if (!('Notification' in window)) return t('notification.permission.unsupported');

  if (Notification.permission === 'granted') return t('notification.permission.granted');
  if (Notification.permission === 'denied') return t('notification.permission.denied');
  return t('notification.permission.default');
});
const isWakeLockSupported = computed(() => Boolean((navigator as NavigatorWithWakeLock).wakeLock));
const wakeLockStatusText = computed(() => {
  if (!isWakeLockSupported.value) return t('wakeLock.unsupported');
  if (!screenWakeLockEnabled.value) return t('wakeLock.off');
  return wakeLockSentinel ? t('wakeLock.onActive') : t('wakeLock.onPending');
});
const statusAnimationSoundUrl = computed(() => customStatusAnimationSoundDataUrl.value || DEFAULT_STATUS_ANIMATION_SOUND_PATH);
const statusAnimationSoundLabel = computed(() => customStatusAnimationSoundName.value || DEFAULT_STATUS_ANIMATION_SOUND_NAME);

function applyLanguageMode() {
  setLanguageMode(languageMode.value);
  setTokenMessage('message.languageApplied');
}

function readRefreshIntervalFromStorage() {
  const raw = window.localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_REFRESH_INTERVAL_SEC;
  if (parsed < MIN_REFRESH_INTERVAL_SEC || parsed > MAX_REFRESH_INTERVAL_SEC) {
    return DEFAULT_REFRESH_INTERVAL_SEC;
  }

  return parsed;
}

function readActivityDisplayModeFromStorage(): ActivityDisplayMode {
  const raw = window.localStorage.getItem(ACTIVITY_DISPLAY_MODE_STORAGE_KEY);
  return raw === 'latest' ? 'latest' : 'separate';
}

function readDateDisplayModeFromStorage(): DateDisplayMode {
  const raw = window.localStorage.getItem(DATE_DISPLAY_MODE_STORAGE_KEY);
  return raw === 'full' ? 'full' : 'smart';
}

function readDesktopNotificationSettingFromStorage() {
  return window.localStorage.getItem(DESKTOP_NOTIFICATION_STORAGE_KEY) === 'true';
}

function readScreenWakeLockSettingFromStorage() {
  return window.localStorage.getItem(SCREEN_WAKE_LOCK_STORAGE_KEY) === 'true';
}

function readStatusAnimationSoundEnabledFromStorage() {
  const raw = window.localStorage.getItem(STATUS_ANIMATION_SOUND_ENABLED_STORAGE_KEY);
  if (raw === null) return true;
  return raw === 'true';
}

function readStatusAnimationSoundDataUrlFromStorage() {
  return window.localStorage.getItem(STATUS_ANIMATION_SOUND_DATA_URL_STORAGE_KEY) ?? '';
}

function readStatusAnimationSoundNameFromStorage() {
  return window.localStorage.getItem(STATUS_ANIMATION_SOUND_NAME_STORAGE_KEY) ?? '';
}

function readStatusAnimationCloseDelayFromStorage() {
  const raw = window.localStorage.getItem(STATUS_ANIMATION_CLOSE_DELAY_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_STATUS_ANIMATION_CLOSE_DELAY_SEC;
  if (parsed < MIN_STATUS_ANIMATION_CLOSE_DELAY_SEC || parsed > MAX_STATUS_ANIMATION_CLOSE_DELAY_SEC) {
    return DEFAULT_STATUS_ANIMATION_CLOSE_DELAY_SEC;
  }

  return parsed;
}
function readAutoUpdateCheckEnabledFromStorage() {
  return window.localStorage.getItem(AUTO_UPDATE_CHECK_ENABLED_STORAGE_KEY) === 'true';
}
function readAutoUpdateCheckIntervalMinFromStorage() {
  const raw = Number(window.localStorage.getItem(AUTO_UPDATE_CHECK_INTERVAL_MIN_STORAGE_KEY));
  if (!Number.isInteger(raw)) return DEFAULT_AUTO_UPDATE_CHECK_INTERVAL_MIN;
  if (raw < MIN_AUTO_UPDATE_CHECK_INTERVAL_MIN || raw > MAX_AUTO_UPDATE_CHECK_INTERVAL_MIN) return DEFAULT_AUTO_UPDATE_CHECK_INTERVAL_MIN;
  return raw;
}
function readRecentlyMergedOpenByDefaultFromStorage() {
  return window.localStorage.getItem(RECENTLY_MERGED_OPEN_BY_DEFAULT_STORAGE_KEY) === 'true';
}
function applyRecentlyMergedOpenByDefault() {
  window.localStorage.setItem(RECENTLY_MERGED_OPEN_BY_DEFAULT_STORAGE_KEY, String(recentlyMergedOpenByDefault.value));
  showRecentlyMerged.value = recentlyMergedOpenByDefault.value;
  refreshRecentlyMergedPrsIfNeeded();
}
function toggleMergedSection() {
  showRecentlyMerged.value = !showRecentlyMerged.value;
  refreshRecentlyMergedPrsIfNeeded();
}
function formatMergedAt(value: string) {
  return new Date(value).toLocaleString(intlLocale.value);
}

async function refreshRecentlyMergedPrs() {
  recentlyMergedPrs.value = await fetchRecentlyMergedPrCards();
}
function refreshRecentlyMergedPrsIfNeeded() {
  if (!showRecentlyMerged.value || recentlyMergedPrs.value.length > 0) return;

  void refreshRecentlyMergedPrs().catch((e) => {
    console.error(e);
    errorKey.value = hasTokenSaved.value ? 'error.refreshFailedWithToken' : 'error.refreshFailedAnonymous';
  });
}
function applyAutoUpdateCheckEnabled() {
  window.localStorage.setItem(AUTO_UPDATE_CHECK_ENABLED_STORAGE_KEY, String(autoUpdateCheckEnabled.value));
  restartAutoUpdateTimer();
  setTokenMessage(autoUpdateCheckEnabled.value ? 'message.autoUpdate.enabled' : 'message.autoUpdate.disabled');
}
function applyAutoUpdateCheckInterval() {
  if (!Number.isInteger(autoUpdateCheckIntervalMinInput.value)) {
    setTokenMessage('message.autoUpdate.intervalInteger');
    return;
  }
  if (autoUpdateCheckIntervalMinInput.value < MIN_AUTO_UPDATE_CHECK_INTERVAL_MIN || autoUpdateCheckIntervalMinInput.value > MAX_AUTO_UPDATE_CHECK_INTERVAL_MIN) {
    setTokenMessage('message.autoUpdate.intervalRange', {
      min: MIN_AUTO_UPDATE_CHECK_INTERVAL_MIN,
      max: MAX_AUTO_UPDATE_CHECK_INTERVAL_MIN,
    });
    return;
  }
  autoUpdateCheckIntervalMin.value = autoUpdateCheckIntervalMinInput.value;
  window.localStorage.setItem(AUTO_UPDATE_CHECK_INTERVAL_MIN_STORAGE_KEY, String(autoUpdateCheckIntervalMin.value));
  restartAutoUpdateTimer();
  setTokenMessage('message.autoUpdate.intervalApplied', { min: autoUpdateCheckIntervalMin.value });
}

async function checkRepoDashboardUpdate() {
  if (!autoUpdateCheckEnabled.value) return;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const envToken = (window.localStorage.getItem('github_api_token') ?? '').trim();
  if (envToken) headers.Authorization = `Bearer ${envToken}`;
  const branchResponse = await fetch('https://api.github.com/repos/NTUT-NPC/tattoo-repoDashboard/commits?per_page=1', { headers });
  if (!branchResponse.ok) return;
  const commits = await branchResponse.json();
  const latestSha = commits?.[0]?.sha ?? '';
  if (!latestSha) return;
  if (!latestRepoDashboardPushSha) {
    latestRepoDashboardPushSha = latestSha;
    return;
  }
  if (latestSha === latestRepoDashboardPushSha) return;

  const runsResp = await fetch('https://api.github.com/repos/NTUT-NPC/tattoo-repoDashboard/actions/runs?per_page=20', { headers });
  if (!runsResp.ok) return;
  const runsPayload = await runsResp.json();
  const hasRunning = (runsPayload.workflow_runs ?? []).some((run: any) => run?.status !== 'completed');
  if (hasRunning) {
    setTimeout(() => {
      void checkRepoDashboardUpdate();
    }, 5 * 60 * 1000);
    return;
  }
  latestRepoDashboardPushSha = latestSha;
  window.location.reload();
}

function restartAutoUpdateTimer() {
  if (autoUpdateTimer) clearInterval(autoUpdateTimer);
  if (!autoUpdateCheckEnabled.value) return;
  autoUpdateTimer = setInterval(() => {
    void checkRepoDashboardUpdate();
  }, autoUpdateCheckIntervalMin.value * 60 * 1000);
}

function applyActivityDisplayMode() {
  window.localStorage.setItem(ACTIVITY_DISPLAY_MODE_STORAGE_KEY, activityDisplayMode.value);
  setTokenMessage(activityDisplayMode.value === 'latest' ? 'message.activity.latest' : 'message.activity.separate');
}

function applyDateDisplayMode() {
  window.localStorage.setItem(DATE_DISPLAY_MODE_STORAGE_KEY, dateDisplayMode.value);
  setTokenMessage(dateDisplayMode.value === 'full' ? 'message.date.full' : 'message.date.smart');
}

function scheduleNextRefreshCountdown() {
  nextRefreshAt = Date.now() + refreshIntervalSec.value * 1000;
  refreshCountdownSec.value = refreshIntervalSec.value;
}

function notifyStatusAnimationEvent(params: {
  pr: PullRequestCard;
  effect: 'new_pr' | 'ci_complete' | 'merged';
}) {
  if (!desktopNotificationEnabled.value || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notification = new Notification(t('desktopNotification.title', { number: params.pr.number }), {
    body: t(`desktopNotification.body.${params.effect}`),
    icon: 'favicon.svg',
    tag: `tattoo-animation-${params.effect}-${params.pr.id}`,
    renotify: true,
  });

  notification.onclick = () => {
    if (params.effect === 'merged') {
      window.open(params.pr.url, '_blank', 'noopener,noreferrer');
      notification.close();
      return;
    }

    window.focus();
    const dashboardUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const dashboardTab = window.open(dashboardUrl, 'tattoo-dashboard');
    dashboardTab?.focus();
    notification.close();
  };
}

async function requestDesktopNotificationPermission() {
  if (!('Notification' in window)) {
    setTokenMessage('message.notification.unsupported');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setTokenMessage('message.notification.granted');
    return;
  }

  setTokenMessage(permission === 'denied' ? 'message.notification.denied' : 'message.notification.default');
}

async function applyDesktopNotificationSetting() {
  window.localStorage.setItem(DESKTOP_NOTIFICATION_STORAGE_KEY, String(desktopNotificationEnabled.value));

  if (!desktopNotificationEnabled.value) {
    setTokenMessage('message.notification.disabled');
    return;
  }

  await requestDesktopNotificationPermission();
  if ('Notification' in window && Notification.permission === 'granted') {
    setTokenMessage('message.notification.enabled');
  }
}

async function requestScreenWakeLock() {
  if (!isWakeLockSupported.value) {
    setTokenMessage('message.wakeLock.unsupported');
    return;
  }

  if (document.visibilityState !== 'visible') return;
  if (wakeLockSentinel) return;

  try {
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
    wakeLockSentinel = await navigatorWithWakeLock.wakeLock?.request('screen') ?? null;
    if (wakeLockSentinel) {
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
    }
  } catch (wakeLockError) {
    console.warn('failed to acquire wake lock', wakeLockError);
    setTokenMessage('message.wakeLock.failed');
  }
}

async function releaseScreenWakeLock() {
  if (!wakeLockSentinel) return;

  try {
    await wakeLockSentinel.release();
  } catch (wakeLockError) {
    console.warn('failed to release wake lock', wakeLockError);
  } finally {
    wakeLockSentinel = null;
  }
}

async function syncScreenWakeLock() {
  if (screenWakeLockEnabled.value) {
    await requestScreenWakeLock();
    return;
  }

  await releaseScreenWakeLock();
}

async function applyScreenWakeLockSetting() {
  window.localStorage.setItem(SCREEN_WAKE_LOCK_STORAGE_KEY, String(screenWakeLockEnabled.value));
  await syncScreenWakeLock();
  setTokenMessage(screenWakeLockEnabled.value ? 'message.wakeLock.enabled' : 'message.wakeLock.disabled');
}

function applyStatusAnimationSoundEnabled() {
  window.localStorage.setItem(STATUS_ANIMATION_SOUND_ENABLED_STORAGE_KEY, String(statusAnimationSoundEnabled.value));
  setTokenMessage(statusAnimationSoundEnabled.value ? 'message.statusAnimation.soundEnabled' : 'message.statusAnimation.soundDisabled');
}

async function uploadStatusAnimationSound(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('audio/')) {
    setTokenMessage('message.statusAnimation.soundInvalidFile');
    input.value = '';
    return;
  }

  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('read-audio-file-failed'));
    reader.readAsDataURL(file);
  }).catch((readError) => {
    console.warn('failed to read status animation sound file', readError);
    return '';
  });

  if (!fileDataUrl) {
    setTokenMessage('message.statusAnimation.soundReadFailed');
    input.value = '';
    return;
  }

  customStatusAnimationSoundDataUrl.value = fileDataUrl;
  customStatusAnimationSoundName.value = file.name;
  window.localStorage.setItem(STATUS_ANIMATION_SOUND_DATA_URL_STORAGE_KEY, customStatusAnimationSoundDataUrl.value);
  window.localStorage.setItem(STATUS_ANIMATION_SOUND_NAME_STORAGE_KEY, customStatusAnimationSoundName.value);
  statusAnimationAudio = null;
  setTokenMessage('message.statusAnimation.soundUploaded', { name: file.name });
  input.value = '';
}

function clearCustomStatusAnimationSound() {
  customStatusAnimationSoundDataUrl.value = '';
  customStatusAnimationSoundName.value = '';
  window.localStorage.removeItem(STATUS_ANIMATION_SOUND_DATA_URL_STORAGE_KEY);
  window.localStorage.removeItem(STATUS_ANIMATION_SOUND_NAME_STORAGE_KEY);
  statusAnimationAudio = null;
  setTokenMessage('message.statusAnimation.soundReset', { name: DEFAULT_STATUS_ANIMATION_SOUND_NAME });
}

async function playStatusAnimationSound() {
  if (!statusAnimationSoundEnabled.value) return;

  const soundUrl = statusAnimationSoundUrl.value;
  if (!soundUrl) return;

  if (!statusAnimationAudio || statusAnimationAudio.src !== new URL(soundUrl, window.location.href).href) {
    statusAnimationAudio = new Audio(soundUrl);
    statusAnimationAudio.preload = 'auto';
  }

  statusAnimationAudio.currentTime = 0;
  try {
    await statusAnimationAudio.play();
  } catch (playError) {
    console.warn('failed to play status animation sound', playError);
  }
}

function previewStatusAnimationSound() {
  void playStatusAnimationSound();
  setTokenMessage('message.statusAnimation.soundPreview', { name: statusAnimationSoundLabel.value });
}

function handleVisibilityChange() {
  if (!screenWakeLockEnabled.value) return;
  if (document.visibilityState !== 'visible') return;
  void requestScreenWakeLock();
}

function updateRefreshCountdown() {
  if (!nextRefreshAt) {
    refreshCountdownSec.value = refreshIntervalSec.value;
    return;
  }

  const diffSec = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
  refreshCountdownSec.value = diffSec;
}

function restartRefreshTimer() {
  if (timer) clearInterval(timer);

  scheduleNextRefreshCountdown();
  timer = setInterval(async () => {
    await refresh();
    scheduleNextRefreshCountdown();
  }, refreshIntervalSec.value * 1000);
}

async function executeRefreshCycle() {
  isUpdating.value = true;

  try {
    const previousPrs = [...prs.value];
    const latestPrs = await fetchPrCards();
    prs.value = latestPrs;
    if (showRecentlyMerged.value) {
      await refreshRecentlyMergedPrs();
    }

    if (!isFirstRefresh) {
      const animationEvent = await findStatusAnimationEvent(previousPrs, latestPrs);
      if (animationEvent) {
        triggerPrStatusAnimation(animationEvent);
        notifyStatusAnimationEvent(animationEvent);
      }
    }

    isFirstRefresh = false;
    lastUpdatedAt.value = new Date();
    errorKey.value = '';

    if (selectedPr.value) {
      const latest = prs.value.find((item) => item.id === selectedPr.value?.id) ?? null;
      selectedPr.value = latest;
    }
  } catch (e) {
    console.error(e);
    errorKey.value = hasTokenSaved.value ? 'error.refreshFailedWithToken' : 'error.refreshFailedAnonymous';
  } finally {
    isUpdating.value = false;
  }
}

async function refresh() {
  if (refreshInFlight) {
    refreshQueued = true;
    return refreshInFlight;
  }

  refreshInFlight = executeRefreshCycle();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
    if (refreshQueued) {
      refreshQueued = false;
      void refresh();
    }
  }
}

function openPrDetails(pr: PullRequestCard, event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('a, button')) return;
  selectedPr.value = pr;
  detailShowEffect.value = false;
}


function closePrDetails() {
  selectedPr.value = null;
  detailShowEffect.value = false;
  if (previewCloseTimer) clearTimeout(previewCloseTimer);
  previewCloseTimer = null;
}

function handleDetailMaskClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  if (target.closest('.pr-card.cinematic') || target.closest('.close-btn')) {
    return;
  }

  closePrDetails();
}

function handleSettingsMaskClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  if (target.closest('.settings-card') || target.closest('.settings-btn')) {
    return;
  }

  showTokenPanel.value = false;
}

function handleOnboardingMaskClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target || target.closest('.onboarding-card')) return;
  continueWithAnonymousMode();
}

function dismissOnboardingModal() {
  showOnboardingModal.value = false;
  window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
}

function continueWithAnonymousMode() {
  dismissOnboardingModal();
}

function openSettingsFromOnboarding() {
  dismissOnboardingModal();
  activeSettingsTab.value = 'access';
  showTokenPanel.value = true;
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  if (selectedPr.value) {
    closePrDetails();
    return;
  }

  if (showTokenPanel.value) {
    showTokenPanel.value = false;
  }
}

async function saveToken() {
  const validation = validateGithubToken(tokenInput.value);
  if (!validation.valid) {
    setTokenMessage(validation.reason === 'empty' ? 'message.token.empty' : 'message.token.invalidFormat');
    return;
  }

  saveGithubToken(tokenInput.value);
  tokenInput.value = '';
  hasTokenSaved.value = hasSavedGithubToken();
  setTokenMessage('message.token.saved');
  await refresh();
}

async function clearToken() {
  tokenInput.value = '';
  saveGithubToken('');
  hasTokenSaved.value = false;
  setTokenMessage(isUsingEnvironmentGithubToken() ? 'message.token.clearedToEnv' : 'message.token.clearedAnonymous');
  await refresh();
}

function buildCiSummary(pr: PullRequestCard): Array<{ name: string; result: 'success' | 'failure' }> {
  if (!pr.ciStates.length) {
    return [{ name: 'CI', result: 'success' }];
  }

  return pr.ciStates.map((item) => {
    const conclusion = (item.conclusion ?? item.status ?? '').toLowerCase();
    const result = conclusion === 'success' ? 'success' : 'failure';
    return { name: item.name, result };
  });
}

function areAllCiStatesCompleted(pr: PullRequestCard) {
  if (!pr.ciStates.length) return false;

  return pr.ciStates.every((item) => {
    const status = (item.status ?? '').toLowerCase();
    const conclusion = (item.conclusion ?? '').toLowerCase();
    return status === 'completed' || Boolean(conclusion);
  });
}

function triggerPrStatusAnimation(params: {
  pr: PullRequestCard;
  effect: 'new_pr' | 'ci_complete' | 'merged';
  message: string;
  ciSummary?: Array<{ name: string; result: 'success' | 'failure' }>;
}) {
  if (previewCloseTimer) clearTimeout(previewCloseTimer);

  showTokenPanel.value = false;
  selectedPr.value = {
    ...params.pr,
    updatedAt: new Date().toISOString(),
  };
  detailEffect.value = params.effect;
  detailCiSummary.value = params.ciSummary ?? [];
  detailShowEffect.value = true;
  setTokenMessageText(params.message);
  if (params.effect === 'merged') {
    void playStatusAnimationSound();
  }

  previewCloseTimer = setTimeout(() => {
    closePrDetails();
    previewCloseTimer = null;
  }, statusAnimationCloseDelaySec.value * 1000);
}

async function findStatusAnimationEvent(previousPrs: PullRequestCard[], currentPrs: PullRequestCard[]) {
  if (!previousPrs.length) return null;

  const previousById = new Map(previousPrs.map((pr) => [pr.id, pr]));

  const newPr = currentPrs.find((pr) => !previousById.has(pr.id));
  if (newPr) {
    return {
      pr: newPr,
      effect: 'new_pr' as const,
      message: t('message.animation.newPr', { number: newPr.number }),
    };
  }

  for (const pr of currentPrs) {
    const previous = previousById.get(pr.id);
    if (!previous) continue;

    if (!areAllCiStatesCompleted(previous) && areAllCiStatesCompleted(pr)) {
      return {
        pr,
        effect: 'ci_complete' as const,
        ciSummary: buildCiSummary(pr),
        message: t('message.animation.ciComplete', { number: pr.number }),
      };
    }
  }

  const currentIds = new Set(currentPrs.map((pr) => pr.id));
  const removedPrs = previousPrs.filter((pr) => !currentIds.has(pr.id));

  for (const removedPr of removedPrs) {
    try {
      const mergeState = await fetchPullRequestMergeState(removedPr.number);
      if (mergeState.merged) {
        return {
          pr: removedPr,
          effect: 'merged' as const,
          message: t('message.animation.merged', { number: removedPr.number }),
        };
      }
    } catch (mergeError) {
      console.warn(`failed to check merge state for PR #${removedPr.number}`, mergeError);
    }
  }

  return null;
}

function previewLatestPrStatusAnimation() {
  const latestPr = prs.value[0];
  if (!latestPr) {
    setTokenMessage('message.preview.noPr');
    return;
  }

  triggerPrStatusAnimation({
    pr: latestPr,
    effect: 'ci_complete',
    ciSummary: buildCiSummary(latestPr),
    message: t('message.preview.done', { number: latestPr.number }),
  });
}

function applyStatusAnimationCloseDelay() {
  if (!Number.isInteger(statusAnimationCloseDelayInputSec.value)) {
    setTokenMessage('message.statusAnimation.closeDelayInteger');
    return;
  }

  if (
    statusAnimationCloseDelayInputSec.value < MIN_STATUS_ANIMATION_CLOSE_DELAY_SEC
    || statusAnimationCloseDelayInputSec.value > MAX_STATUS_ANIMATION_CLOSE_DELAY_SEC
  ) {
    setTokenMessage('message.statusAnimation.closeDelayRange', {
      min: MIN_STATUS_ANIMATION_CLOSE_DELAY_SEC,
      max: MAX_STATUS_ANIMATION_CLOSE_DELAY_SEC,
    });
    return;
  }

  statusAnimationCloseDelaySec.value = statusAnimationCloseDelayInputSec.value;
  window.localStorage.setItem(STATUS_ANIMATION_CLOSE_DELAY_STORAGE_KEY, String(statusAnimationCloseDelaySec.value));
  setTokenMessage('message.statusAnimation.closeDelayApplied', { sec: statusAnimationCloseDelaySec.value });
}

function applyRefreshInterval() {
  if (!Number.isInteger(refreshIntervalInput.value)) {
    setTokenMessage('message.refreshInterval.integer');
    return;
  }

  if (refreshIntervalInput.value < MIN_REFRESH_INTERVAL_SEC || refreshIntervalInput.value > MAX_REFRESH_INTERVAL_SEC) {
    setTokenMessage('message.refreshInterval.range', { min: MIN_REFRESH_INTERVAL_SEC, max: MAX_REFRESH_INTERVAL_SEC });
    return;
  }

  refreshIntervalSec.value = refreshIntervalInput.value;
  window.localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(refreshIntervalSec.value));
  restartRefreshTimer();
  setTokenMessage('message.refreshInterval.applied', { sec: refreshIntervalSec.value });
}

onMounted(async () => {
  activityDisplayMode.value = readActivityDisplayModeFromStorage();
  dateDisplayMode.value = readDateDisplayModeFromStorage();
  desktopNotificationEnabled.value = readDesktopNotificationSettingFromStorage();
  screenWakeLockEnabled.value = readScreenWakeLockSettingFromStorage();
  statusAnimationSoundEnabled.value = readStatusAnimationSoundEnabledFromStorage();
  customStatusAnimationSoundDataUrl.value = readStatusAnimationSoundDataUrlFromStorage();
  customStatusAnimationSoundName.value = readStatusAnimationSoundNameFromStorage();
  refreshIntervalSec.value = readRefreshIntervalFromStorage();
  refreshIntervalInput.value = refreshIntervalSec.value;
  statusAnimationCloseDelaySec.value = readStatusAnimationCloseDelayFromStorage();
  statusAnimationCloseDelayInputSec.value = statusAnimationCloseDelaySec.value;
  autoUpdateCheckEnabled.value = readAutoUpdateCheckEnabledFromStorage();
  autoUpdateCheckIntervalMin.value = readAutoUpdateCheckIntervalMinFromStorage();
  autoUpdateCheckIntervalMinInput.value = autoUpdateCheckIntervalMin.value;
  recentlyMergedOpenByDefault.value = readRecentlyMergedOpenByDefaultFromStorage();
  showRecentlyMerged.value = recentlyMergedOpenByDefault.value;
  showOnboardingModal.value = window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) !== 'true';

  hasTokenSaved.value = hasSavedGithubToken();
  setTokenMessage(
    hasTokenSaved.value
      ? (isUsingEnvironmentGithubToken() ? 'message.token.detectedEnv' : 'message.token.detectedSaved')
      : 'message.token.anonymous',
  );

  await refresh();
  restartRefreshTimer();
  await syncScreenWakeLock();
  countdownTimer = setInterval(updateRefreshCountdown, 1000);
  updateRefreshCountdown();
  window.addEventListener('keydown', handleEscape);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  restartAutoUpdateTimer();
  void checkRepoDashboardUpdate();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (countdownTimer) clearInterval(countdownTimer);
  if (previewCloseTimer) clearTimeout(previewCloseTimer);
  if (autoUpdateTimer) clearInterval(autoUpdateTimer);
  void releaseScreenWakeLock();
  window.removeEventListener('keydown', handleEscape);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<style scoped>
.dashboard { max-width: 1200px; margin: 0 auto; padding: .75rem; }
.header-main { min-width: 0; }
.header { display:flex; justify-content:space-between; gap:1rem; align-items:center; margin-bottom:1rem; }
.header-main h1 { margin:0; color:#f8fafc; font-size: 1.45rem; display: flex; align-items: center; gap: .55rem; }
.header-logo { width: 1.7rem; height: 1.7rem; flex: 0 0 auto; }
.header-main p { margin:.2rem 0 0; color:#94a3b8; font-size: .9rem; }
.refresh-ring {
  width: 2rem;
  height: 2rem;
  display: inline-grid;
  place-items: center;
  position: relative;
  color: #bfdbfe;
  flex: 0 0 auto;
}

.refresh-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.refresh-ring-track,
.refresh-ring-progress {
  fill: none;
  stroke-width: 3;
}

.refresh-ring-track { stroke: #1e293b; }

.refresh-ring-progress {
  stroke: #60a5fa;
  stroke-linecap: round;
  stroke-dasharray: 100.53px;
  transition: stroke-dashoffset .25s linear;
}

.refresh-ring-number {
  position: absolute;
  font-size: .68rem;
  font-weight: 700;
  line-height: 1;
}
code { color:#93c5fd; }
.meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: .45rem;
  padding: .3rem;
  border-radius: 999px;
  border: 1px solid rgba(71, 85, 105, .5);
  background: rgba(15, 23, 42, .55);
}

.meta-pill {
  border-radius: 999px;
  border: 1px solid #334155;
  background: linear-gradient(135deg, rgba(15, 23, 42, .95), rgba(30, 41, 59, .9));
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, .12);
}

.settings-btn {
  width: 31px;
  height: 31px;
  color: #cbd5e1;
  cursor: pointer;
  font-size: .95rem;
  line-height: 1;
  display: inline-grid;
  place-items: center;
  transition: border-color .2s ease, transform .2s ease, color .2s ease;
}

.settings-btn:hover {
  border-color: #60a5fa;
  color: #dbeafe;
  transform: translateY(-1px);
}

.settings-btn:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.token-state { font-size: .72rem; color: #94a3b8; padding: .25rem .52rem; }
.token-state.active { color: #86efac; border-color: rgba(34, 197, 94, .45); }
.chip { font-weight:700; border-radius:999px; padding:.2rem .6rem; font-size:.8rem; }
.chip.ok { background:#052e16; color:#86efac; }
.chip.updating { background:#172554; color:#93c5fd; }
.time { color:#cbd5e1; font-size:.78rem; padding: .25rem .55rem; }
.token-label { display: block; margin-bottom: .45rem; color: #cbd5e1; font-size: .88rem; }
.token-controls { display: flex; gap: .5rem; flex-wrap: wrap; }
.token-controls input { flex: 1; min-width: 240px; background: #020617; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; padding: .45rem .55rem; }
.token-controls select { flex: 1; min-width: 240px; background: #020617; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; padding: .45rem .55rem; }
.refresh-controls input { max-width: 190px; min-width: 0; }
.token-controls button { background: #1d4ed8; color: #dbeafe; border: 1px solid #2563eb; border-radius: 8px; padding: .42rem .62rem; font-weight: 600; cursor: pointer; }
.token-controls button.secondary { background: #1e293b; color: #cbd5e1; border-color: #334155; }
.token-hint { margin: .45rem 0 0; font-size: .8rem; color: #cbd5e1; }
.notification-controls {
  align-items: center;
}

.toggle-control {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  color: #e2e8f0;
  font-size: .88rem;
}

.toggle-control input {
  min-width: 1rem;
}
.error { border:1px solid #dc2626; color:#fecaca; background:#3f1119; border-radius:10px; padding:.6rem .8rem; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:.65rem; }
.grid-section {
  display: grid;
  gap: .65rem;
}
.section-heading h2 {
  margin: 0;
  font-size: .95rem;
  opacity: .85;
}
.card-slot { min-width: 0; cursor: zoom-in; }
.merged-section {
  margin-top: .9rem;
  border: 1px solid #253453;
  border-radius: 12px;
  background: rgba(8, 14, 28, .65);
}
.merged-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  padding: .65rem .8rem;
  font-weight: 700;
}
.merged-list { display: grid; gap: .45rem; padding: 0 .8rem .8rem; }
.merged-item { display: grid; text-decoration: none; color: inherit; gap: .15rem; padding: .45rem; border-radius: 8px; background: rgba(255,255,255,.03); }
.merged-item-title { font-size: .9rem; }
.merged-item-time { font-size: .78rem; opacity: .75; }

.detail-mask {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 20% 10%, rgba(56, 189, 248, .12), transparent 36%),
    radial-gradient(circle at 80% 90%, rgba(96, 165, 250, .11), transparent 44%),
    rgba(2, 6, 23, 0.76);
  backdrop-filter: blur(8px);
  z-index: 70;
  display: grid;
  justify-items: center;
  align-items: center;
  padding: 1rem;
}

.settings-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.76);
  backdrop-filter: blur(4px);
  z-index: 75;
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  overflow-y: auto;
}

.settings-card {
  width: min(100%, 1100px);
  min-height: min(86vh, 860px);
  max-height: 94vh;
  border: 1px solid #2b3f72;
  border-radius: 14px;
  background: #111a33;
  box-shadow: 0 22px 60px rgba(2, 6, 23, .62);
  display: grid;
  grid-template-rows: auto 1fr;
}

@supports (height: 100dvh) {
  .settings-card {
    min-height: min(calc(86dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom)), 860px);
    max-height: calc(94dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}

.onboarding-card {
  width: min(100%, 680px);
  min-height: auto;
}

.onboarding-card .settings-content {
  padding: .9rem .95rem 1.1rem;
}

.settings-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: .8rem;
  padding: .85rem .95rem;
  border-bottom: 1px solid rgba(59, 130, 246, .18);
}

.settings-toolbar h2 {
  margin: 0;
  color: #dbeafe;
  font-size: 1.02rem;
}

.settings-toolbar-status {
  margin: .2rem 0 0;
  max-width: min(720px, 70vw);
  color: #a7f3d0;
  font-size: .78rem;
  line-height: 1.35;
}

.settings-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr);
  background: rgba(15, 23, 42, .28);
}

.settings-nav {
  min-height: 0;
  padding: .85rem .75rem;
  border-right: 1px solid rgba(148, 163, 184, .16);
  background: rgba(2, 6, 23, .26);
  display: grid;
  align-content: start;
  gap: .4rem;
}

.settings-nav button {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  font-size: .84rem;
  font-weight: 700;
  line-height: 1.2;
  padding: .55rem .65rem;
  text-align: left;
}

.settings-nav button:hover,
.settings-nav button:focus-visible {
  border-color: rgba(96, 165, 250, .36);
  background: rgba(30, 41, 59, .78);
  color: #eff6ff;
  outline: none;
}

.settings-nav button.active {
  border-color: rgba(34, 197, 94, .48);
  background: rgba(20, 83, 45, .34);
  color: #dcfce7;
}

.settings-content {
  padding: .35rem .95rem 1.1rem;
  overflow-y: auto;
  min-height: 0;
  scroll-behavior: smooth;
}

.settings-section {
  scroll-margin-top: .55rem;
  padding: .7rem 0 .35rem;
}

.settings-section-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0 0 .35rem;
  padding: .55rem 0 .45rem;
  background: linear-gradient(180deg, #111a33 70%, rgba(17, 26, 51, 0));
}

.settings-section-heading h3 {
  margin: 0;
  color: #f8fafc;
  font-size: .9rem;
  letter-spacing: 0;
}

.settings-row {
  display: grid;
  grid-template-columns: minmax(220px, .8fr) minmax(260px, 1.2fr);
  gap: .9rem;
  align-items: start;
  padding: .82rem 0;
}

.settings-row + .settings-row {
  border-top: 1px solid rgba(51, 65, 85, .72);
}

.settings-copy {
  min-width: 0;
  display: grid;
  gap: .28rem;
}

.setting-title {
  display: block;
  color: #e2e8f0;
  font-size: .88rem;
  font-weight: 800;
  line-height: 1.3;
}

.setting-hint {
  color: #aab7ca;
  font-size: .78rem;
  line-height: 1.45;
}

.setting-hint a {
  color: #93c5fd;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.settings-control {
  min-width: 0;
  display: grid;
  gap: .55rem;
}

.settings-control select,
.settings-control input[type="number"],
.settings-control input[type="password"] {
  width: 100%;
  min-height: 38px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #020617;
  color: #e2e8f0;
  font: inherit;
  padding: .48rem .62rem;
}

.settings-control select:focus-visible,
.settings-control input:focus-visible {
  border-color: #60a5fa;
  outline: 2px solid rgba(96, 165, 250, .28);
  outline-offset: 1px;
}

.settings-control-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem;
}

.settings-control-actions > .toggle-control {
  flex: 1 1 260px;
}

.settings-control button,
.file-picker {
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #1d4ed8;
  color: #dbeafe;
  cursor: pointer;
  font-size: .84rem;
  font-weight: 800;
  line-height: 1.2;
  padding: .55rem .72rem;
}

.settings-control button.secondary,
.file-picker {
  border-color: #3f4d63;
  background: #1e293b;
  color: #d7dde8;
}

.settings-control button:hover,
.file-picker:hover {
  filter: brightness(1.08);
}

.number-action {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.number-action input[type="number"] {
  max-width: 160px;
}

.token-entry input[type="password"] {
  flex: 1 1 280px;
}

.segmented-control {
  display: grid;
  gap: .45rem;
}

.segmented-control label {
  position: relative;
  display: grid;
  min-height: 38px;
  align-items: center;
  border: 1px solid #334155;
  border-radius: 8px;
  background: rgba(2, 6, 23, .72);
  color: #cbd5e1;
  cursor: pointer;
  font-size: .8rem;
  font-weight: 700;
  line-height: 1.35;
  padding: .55rem .68rem;
}

.segmented-control label.active {
  border-color: rgba(34, 197, 94, .58);
  background: rgba(20, 83, 45, .34);
  color: #dcfce7;
}

.segmented-control input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.segmented-control label:focus-within {
  outline: 2px solid rgba(96, 165, 250, .42);
  outline-offset: 2px;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.settings-modal-enter-active,
.settings-modal-leave-active {
  transition: background-color .24s ease, backdrop-filter .24s ease;
}

.settings-modal-enter-from,
.settings-modal-leave-to {
  background: rgba(2, 6, 23, 0);
  backdrop-filter: blur(0);
}

.settings-modal-enter-active .settings-card,
.settings-modal-leave-active .settings-card {
  transition: transform .24s ease, opacity .24s ease;
}

.settings-modal-enter-from .settings-card,
.settings-modal-leave-to .settings-card {
  transform: translateY(18px) scale(.985);
  opacity: 0;
}

.detail-card-wrap {
  width: min(1120px, calc(100vw - 2rem));
  max-height: 92vh;
  margin-inline: auto;
  position: relative;
  transform-origin: center;
  z-index: 1;
  border: 1px solid rgba(148, 197, 255, .28);
  border-radius: 16px;
  background: rgba(15, 23, 42, .5);
  box-shadow: 0 26px 62px rgba(0, 0, 0, .45), inset 0 1px 0 rgba(255, 255, 255, .04);
  padding: .65rem;
}

.detail-toolbar {
  display: flex;
  justify-content: flex-end;
  position: sticky;
  top: 0;
  z-index: 3;
  margin: -.2rem -.2rem 0;
  padding: .2rem;
  background: linear-gradient(180deg, rgba(15, 23, 42, .88), rgba(15, 23, 42, 0));
  border-radius: 12px 12px 0 0;
}
.detail-modal-enter-active,
.detail-modal-leave-active {
  transition: background-color .34s ease, backdrop-filter .34s ease;
}

.detail-modal-enter-from,
.detail-modal-leave-to {
  background: rgba(2, 6, 23, 0);
  backdrop-filter: blur(0);
}

.detail-modal-enter-active .detail-card-wrap,
.detail-modal-leave-active .detail-card-wrap {
  transition: transform .46s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.detail-modal-enter-from .detail-card-wrap {
  transform: translateY(-110vh);
}

.detail-modal-leave-to .detail-card-wrap {
  transform: translateY(110vh);
}

.showcase-card.enter {
  animation: card-drop-in .9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.showcase-confetti {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 2;
}

.close-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid #475569;
  background: rgba(15, 23, 42, .92);
  color: #e2e8f0;
  cursor: pointer;
}
.close-btn-floating {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 4;
}

@media (max-width: 950px) and (orientation: landscape) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .detail-card-wrap { width: min(1120px, calc(100vw - 2rem)); }
  .settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .settings-nav {
    display: flex;
    gap: .35rem;
    overflow-x: auto;
    padding: .55rem .65rem;
    border-right: 0;
    border-bottom: 1px solid rgba(148, 163, 184, .16);
  }

  .settings-nav button {
    width: auto;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .settings-content {
    padding: .25rem .75rem .95rem;
  }

  .settings-row {
    grid-template-columns: 1fr;
    gap: .55rem;
    padding: .78rem 0;
  }

  .settings-control-actions > .toggle-control {
    flex-basis: 100%;
  }

  .number-action {
    flex-wrap: wrap;
  }

  .number-action input[type="number"] {
    max-width: 150px;
  }
}

@media (max-width: 640px) {
  .dashboard { padding: .55rem; }
  .header { flex-direction:column; align-items:stretch; gap: .45rem; margin-bottom: .7rem; }
  .header-main h1 { font-size: 1.08rem; line-height: 1.2; }
  .header-logo { width: 1.35rem; height: 1.35rem; }
  .header-main p { display: none; }
  .meta { justify-content:flex-start; gap: .3rem; }
  .meta .time,
  .meta .token-state { display: none; }
  .refresh-ring { width: 1.7rem; height: 1.7rem; }
  .chip { font-size: .72rem; padding: .16rem .42rem; }
  .settings-btn { width: 28px; height: 28px; }
  .settings-card {
    width: 100%;
    min-height: calc(100vh - 1.1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    max-height: calc(100vh - 1.1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    border-radius: 12px;
  }

  .settings-toolbar {
    padding: .75rem .8rem;
  }

  .settings-toolbar-status {
    max-width: calc(100vw - 5.2rem);
  }

  @supports (height: 100dvh) {
    .settings-card {
      min-height: calc(100dvh - 1.1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      max-height: calc(100dvh - 1.1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
  }
  .detail-mask { padding: .55rem; }
  .detail-card-wrap {
    width: min(1120px, calc(100vw - 1.1rem));
    max-height: calc(100vh - 1.1rem);
    border-radius: 14px;
    padding: .45rem;
  }
  .close-btn-floating {
    top: 8px;
    right: 8px;
  }
}
</style>
