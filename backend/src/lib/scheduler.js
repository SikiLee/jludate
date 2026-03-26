import { ensureSchema, surveyPool } from 'lib/db';
import { getCurrentScheduledRunKey, runMatchingEngine } from 'lib/matching';
import { getMatchScheduleSettings, isMatchScheduleDueInShanghai } from 'lib/siteConfig';

let schedulerStarted = false;
let intervalHandler;
let running = false;
let lastMinuteKey = null;

function getMinuteKey(date = new Date()) {
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  return `${local.getFullYear()}-${local.getMonth() + 1}-${local.getDate()}-${local.getHours()}-${local.getMinutes()}`;
}

async function runScheduledMatch() {
  if (running) {
    return;
  }

  running = true;

  try {
    await runMatchingEngine({
      runType: 'scheduled',
      runKey: getCurrentScheduledRunKey(),
      initiatedBy: 'scheduler'
    });
  } catch (error) {
    console.error('Scheduled matching failed:', error);
  } finally {
    running = false;
  }
}

async function tick() {
  await ensureSchema();

  const now = new Date();
  const matchSchedule = await getMatchScheduleSettings(surveyPool);
  if (!isMatchScheduleDueInShanghai(matchSchedule, now)) {
    return;
  }

  const minuteKey = getMinuteKey(now);
  if (minuteKey === lastMinuteKey) {
    return;
  }

  lastMinuteKey = minuteKey;
  await runScheduledMatch();
}

export function startWeeklyScheduler() {
  if (schedulerStarted) {
    return;
  }

  if (process.env.DISABLE_WEEKLY_SCHEDULER === 'true') {
    return;
  }

  schedulerStarted = true;

  tick().catch((error) => {
    console.error('Initial scheduler tick failed:', error);
  });

  intervalHandler = setInterval(() => {
    tick().catch((error) => {
      console.error('Scheduler tick failed:', error);
    });
  }, 30000);

  if (typeof intervalHandler?.unref === 'function') {
    intervalHandler.unref();
  }
}
