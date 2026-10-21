/**
 * focus-timer.js - مؤقت التركيز وتقنية بومودورو
 * Timestamp-based study timer with Web Audio API sound alerts and focus session logging.
 * @module modules/focus-timer
 */

import { add, getAll, getAllFromIndex } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm } from '../utils/ui.js';
import { sanitizeHTML } from '../utils/validation.js';
import { formatDuration, formatDurationText } from '../utils/formatting.js';

let timerInterval = null;
let state = {
  phase: 'study', // 'study', 'shortBreak', 'longBreak'
  running: false,
  totalDuration: 25 * 60, // seconds
  remaining: 25 * 60,
  startedAt: null,
  pauseOffset: 0,
  sessionsCompleted: 0,
  subjectId: '',
};

export async function render(container) {
  const subjects = (await getAll('subjects')) || [];
  const todaySessions = await getTodaySessions();

  // Web Audio synth beep
  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function getPhaseSettings() {
    const studyMin = Number(localStorage.getItem('pomodoro_study')) || 25;
    const breakMin = Number(localStorage.getItem('pomodoro_short_break')) || 5;
    const longBreakMin = Number(localStorage.getItem('pomodoro_long_break')) || 15;
    return { studyMin, breakMin, longBreakMin };
  }

  function updateDisplay() {
    const digitsEl = container.querySelector('#timer-digits');
    const circleEl = container.querySelector('#timer-circle-progress');
    const playBtn = container.querySelector('#btn-timer-toggle');
    const phaseEl = container.querySelector('#timer-phase-title');

    if (!digitsEl || !circleEl) return;

    digitsEl.textContent = formatDuration(Math.max(0, Math.ceil(state.remaining)));

    // Circumference = 2 * PI * r = 2 * PI * 100 = 628.3
    const circumference = 628.3;
    const progress = state.totalDuration > 0 ? (state.totalDuration - state.remaining) / state.totalDuration : 0;
    const offset = circumference * (1 - progress);
    circleEl.style.strokeDashoffset = offset;

    let phaseName = 'جلسة مذاكرة وتركيز';
    let phaseColor = 'var(--color-primary, #3657C8)';
    if (state.phase === 'shortBreak') {
      phaseName = 'استراحة قصيرة ☕';
      phaseColor = 'var(--color-secondary, #24A58A)';
    } else if (state.phase === 'longBreak') {
      phaseName = 'استراحة طويلة 🎉';
      phaseColor = '#8b5cf6';
    }

    phaseEl.textContent = phaseName;
    circleEl.style.stroke = phaseColor;

    if (playBtn) {
      playBtn.innerHTML = state.running ? icon('pause', 28) : icon('play', 28);
    }
  }

  function tick() {
    if (!state.running) return;
    const now = Date.now();
    const elapsed = Math.floor((now - state.startedAt) / 1000) + state.pauseOffset;
    state.remaining = state.totalDuration - elapsed;

    if (state.remaining <= 0) {
      completePhase();
    } else {
      updateDisplay();
    }
  }

  async function completePhase() {
    clearInterval(timerInterval);
    state.running = false;
    state.remaining = 0;
    updateDisplay();
    playBeep();

    if (state.phase === 'study') {
      state.sessionsCompleted++;
      toast('🎉 أحسنت! اكتملت جلسة المذاكرة بنجاح', 'success', 5000);

      // Save to IndexedDB
      try {
        await add('focusSessions', {
          subjectId: state.subjectId || '',
          startedAt: Date.now() - state.totalDuration * 1000,
          duration: state.totalDuration,
          completed: true,
        });
      } catch (err) {
        console.warn('Failed to save session:', err);
      }

      // Determine next phase
      const { breakMin, longBreakMin } = getPhaseSettings();
      if (state.sessionsCompleted % 4 === 0) {
        setPhase('longBreak', longBreakMin * 60);
      } else {
        setPhase('shortBreak', breakMin * 60);
      }
    } else {
      toast('انتهت الاستراحة. حان وقت جلسة تركيز جديدة!', 'info', 5000);
      const { studyMin } = getPhaseSettings();
      setPhase('study', studyMin * 60);
    }

    renderStats();
  }

  function setPhase(phase, durationSeconds) {
    state.phase = phase;
    state.totalDuration = durationSeconds;
    state.remaining = durationSeconds;
    state.running = false;
    state.pauseOffset = 0;
    state.startedAt = null;
    clearInterval(timerInterval);
    updateDisplay();
  }

  function toggleTimer() {
    if (state.running) {
      // Pause
      state.pauseOffset += Math.floor((Date.now() - state.startedAt) / 1000);
      state.running = false;
      clearInterval(timerInterval);
      updateDisplay();
    } else {
      // Start
      state.startedAt = Date.now();
      state.running = true;
      clearInterval(timerInterval);
      timerInterval = setInterval(tick, 500);
      updateDisplay();
    }
  }

  function resetTimer() {
    state.running = false;
    clearInterval(timerInterval);
    state.pauseOffset = 0;
    state.startedAt = null;
    state.remaining = state.totalDuration;
    updateDisplay();
  }

  async function getTodaySessions() {
    try {
      const all = (await getAll('focusSessions')) || [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startTs = startOfToday.getTime();
      return all.filter((s) => s.startedAt >= startTs && s.completed);
    } catch (e) {
      return [];
    }
  }

  function renderStats() {
    getTodaySessions().then((sessions) => {
      const totalSec = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const statsBox = container.querySelector('#today-focus-stats');
      if (statsBox) {
        statsBox.innerHTML = `
          <div style="font-size: 14px; font-weight: 700; color: var(--color-text);">إحصاءات اليوم:</div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">
            جلسات مكتملة: <b>${sessions.length}</b> • إجمالي وقت التركيز: <b>${formatDurationText(totalSec)}</b>
          </div>
        `;
      }
    });
  }

  const { studyMin } = getPhaseSettings();
  if (!state.running && state.remaining === 25 * 60) {
    state.totalDuration = studyMin * 60;
    state.remaining = studyMin * 60;
  }

  container.innerHTML = `
    <div class="timer-container">
      <div>
        <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0; text-align: center;">مؤقت التركيز Pomodoro</h2>
        <span style="font-size: 13px; color: var(--color-text-secondary); display: block; text-align: center;">فترات مذاكرة واستراحات منتظمة لتعزيز الفهم والإنتاجية</span>
      </div>

      <!-- Subject Selector -->
      <div style="width: 100%; max-width: 320px;">
        <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; text-align: center;">المادة التي تدرسها حالياً</label>
        <select id="timer-subject-select" style="width: 100%; padding: 10px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 14px; text-align: center;">
          <option value="">(مذاكرة عامة)</option>
          ${subjects.map((s) => `<option value="${s.id}" ${s.id === state.subjectId ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>`).join('')}
        </select>
      </div>

      <!-- Circular Timer Display -->
      <div class="timer-circle-wrap">
        <svg class="timer-svg" viewBox="0 0 220 220">
          <circle class="timer-circle-bg" cx="110" cy="110" r="100" />
          <circle id="timer-circle-progress" class="timer-circle-progress" cx="110" cy="110" r="100" 
            stroke-dasharray="628.3" stroke-dashoffset="0" />
        </svg>
        <div class="timer-display">
          <span id="timer-digits" class="timer-digits">${formatDuration(state.remaining)}</span>
          <span id="timer-phase-title" class="timer-phase">جلسة مذاكرة</span>
          <span style="font-size: 11px; color: var(--color-text-secondary); margin-top: 4px;">جلسة ${state.sessionsCompleted + 1} من 4</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="timer-controls">
        <button id="btn-timer-reset" class="btn btn-secondary" style="width: 48px; height: 48px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center;" title="إعادة ضبط">
          ${icon('refresh', 20)}
        </button>

        <button id="btn-timer-toggle" class="timer-btn-main" title="بدء / إيقاف مؤقت">
          ${icon(state.running ? 'pause' : 'play', 28)}
        </button>

        <button id="btn-timer-skip" class="btn btn-secondary" style="width: 48px; height: 48px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center;" title="تخطي المرحلة">
          ${icon('chevron-left', 22)}
        </button>
      </div>

      <!-- Today Stats Card -->
      <div id="today-focus-stats" style="width: 100%; max-width: 320px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 14px; text-align: center;">
        جاري حساب ساعات التركيز...
      </div>

      <!-- iOS Background Notice -->
      <div style="font-size: 11px; color: var(--color-text-secondary); text-align: center; max-width: 320px; line-height: 1.5; background: var(--color-bg); padding: 10px; border-radius: 8px;">
        💡 ملاحظة: يعتمد المؤقت على التوقيت الفعلي للجهاز، في حال قفل الشاشة أو التبديل بين التطبيقات سيواصل الحساب بدقة عند عودتك.
      </div>
    </div>
  `;

  // Attach controls
  container.querySelector('#btn-timer-toggle').addEventListener('click', toggleTimer);
  container.querySelector('#btn-timer-reset').addEventListener('click', resetTimer);
  container.querySelector('#btn-timer-skip').addEventListener('click', async () => {
    const ok = await confirm('تخطي المرحلة', 'هل تريد إنهاء المرحلة الحالية والانتقال للمرحلة التالية؟', 'تخطي', 'إلغاء');
    if (ok) completePhase();
  });

  const subjSelect = container.querySelector('#timer-subject-select');
  subjSelect.addEventListener('change', (e) => {
    state.subjectId = e.target.value;
  });

  updateDisplay();
  renderStats();

  return () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };
}
