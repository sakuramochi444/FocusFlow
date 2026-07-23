"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Task = { id: number; title: string; estimate: number; done: boolean };
type CheckState = "idle" | "checking" | "ok" | "warn";
type FocusSession = {
  id: number;
  taskId: number;
  taskTitle: string;
  minutes: number;
  startedAt: string;
  endedAt: string;
};
type UserProfile = {
  name: string;
  role: string;
  dailyGoalSessions: number;
  onboardingComplete: boolean;
};
type VisibleSections = {
  overview: boolean;
  tasks: boolean;
  smartBreak: boolean;
  notificationDigest: boolean;
  insights: boolean;
  meeting: boolean;
};
type AppSettings = {
  focusMinutes: number;
  breakMinutes: number;
  breakReminderMinutes: number;
  autoQuiet: boolean;
  completionSound: boolean;
  visible: VisibleSections;
};

const DEFAULT_SETTINGS: AppSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  breakReminderMinutes: 45,
  autoQuiet: true,
  completionSound: true,
  visible: {
    overview: true,
    tasks: true,
    smartBreak: true,
    notificationDigest: true,
    insights: true,
    meeting: true,
  },
};

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  role: "",
  dailyGoalSessions: 4,
  onboardingComplete: false,
};

const INITIAL_TASKS: Task[] = [
  { id: 1, title: "提案書の構成を仕上げる", estimate: 2, done: false },
  { id: 2, title: "ユーザー調査メモを整理", estimate: 1, done: true },
  { id: 3, title: "レビューコメントに返信", estimate: 1, done: false },
];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}時間${mins}分` : `${hours}時間`;
}

function getInitial(name: string) {
  return name.trim().slice(0, 1) || "F";
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sessionDateKey(session: FocusSession) {
  return dateKey(new Date(session.endedAt));
}

function sumMinutesForDate(sessions: FocusSession[], key: string) {
  return sessions.filter((session) => sessionDateKey(session) === key).reduce((total, session) => total + session.minutes, 0);
}

function buildWeekStats(sessions: FocusSession[]) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const key = dateKey(date);
    const daySessions = sessions.filter((session) => sessionDateKey(session) === key);
    return {
      key,
      day: index === 6 ? "今日" : ["日", "月", "火", "水", "木", "金", "土"][date.getDay()],
      minutes: daySessions.reduce((total, session) => total + session.minutes, 0),
      sessions: daySessions.length,
    };
  });
}

function countFocusStreak(sessions: FocusSession[]) {
  const activeDays = new Set(sessions.map(sessionDateKey));
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    if (!activeDays.has(dateKey(addDays(new Date(), -offset)))) break;
    streak += 1;
  }
  return streak;
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    home: "⌂", timer: "◷", chart: "▥", meeting: "◉", settings: "⚙",
    play: "▶", pause: "Ⅱ", reset: "↻", bell: "♧", leaf: "♨",
    plus: "+", check: "✓", spark: "✦", sound: "◖", network: "⌁",
  };
  return <span className="icon" aria-hidden="true">{icons[name] ?? "•"}</span>;
}

export function FocusDashboard() {
  const [hydrated, setHydrated] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [duration, setDuration] = useState(25);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeTask, setActiveTask] = useState(1);
  const [taskInput, setTaskInput] = useState("");
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [quiet, setQuiet] = useState(true);
  const [queued, setQueued] = useState(4);
  const [idleMinutes, setIdleMinutes] = useState(47);
  const [breakDone, setBreakDone] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [toast, setToast] = useState("");
  const lastActivity = useRef(Date.now() - 47 * 60 * 1000);
  const sessionStartedAt = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("focusflow-state");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (Array.isArray(data.focusSessions)) setFocusSessions(data.focusSessions);
        const restoredProfile = { ...DEFAULT_PROFILE, ...data.profile };
        setProfile(restoredProfile);
        setOnboardingOpen(!restoredProfile.onboardingComplete);
        if (data.settings) {
          const restored = {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            visible: { ...DEFAULT_SETTINGS.visible, ...data.settings.visible },
          };
          setSettings(restored);
          setQuiet(restored.autoQuiet);
          setDuration(restored.focusMinutes);
          setSeconds(restored.focusMinutes * 60);
        }
      } else {
        setOnboardingOpen(true);
      }
    } catch { /* device storage can be unavailable in private mode */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("focusflow-state", JSON.stringify({ tasks, focusSessions, settings, profile })); } catch { /* noop */ }
  }, [hydrated, tasks, focusSessions, settings, profile]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current > 1) return current - 1;
        setRunning(false);
        if (mode === "focus") {
          const endedAt = new Date();
          const active = tasks.find((task) => task.id === activeTask);
          const recordedMinutes = Math.max(1, duration);
          const startedAt = sessionStartedAt.current ?? new Date(endedAt.getTime() - recordedMinutes * 60000).toISOString();
          const nextSession: FocusSession = {
            id: endedAt.getTime(),
            taskId: activeTask,
            taskTitle: active?.title ?? "未選択のタスク",
            minutes: recordedMinutes,
            startedAt,
            endedAt: endedAt.toISOString(),
          };
          setFocusSessions((items) => [...items, nextSession].slice(-500));
          sessionStartedAt.current = null;
          if (settings.completionSound) {
            try {
              const audio = new AudioContext();
              const oscillator = audio.createOscillator();
              const gain = audio.createGain();
              gain.gain.value = 0.035; oscillator.frequency.value = 660;
              oscillator.connect(gain); gain.connect(audio.destination);
              oscillator.start(); oscillator.stop(audio.currentTime + 0.18);
              window.setTimeout(() => audio.close(), 400);
            } catch { /* sound may be blocked until the first user interaction */ }
          }
          setToast("集中セッション完了。少し休みましょう！");
          setMode("break");
          setDuration(settings.breakMinutes);
          return settings.breakMinutes * 60;
        }
        setToast("休憩終了。次の集中を始められます");
        setMode("focus");
        setDuration(settings.focusMinutes);
        return settings.focusMinutes * 60;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, mode, duration, activeTask, tasks, settings.breakMinutes, settings.focusMinutes, settings.completionSound]);

  useEffect(() => {
    const activity = () => { lastActivity.current = Date.now(); };
    ["mousemove", "keydown", "touchstart", "scroll"].forEach((event) =>
      window.addEventListener(event, activity, { passive: true })
    );
    const check = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivity.current) / 60000);
      setIdleMinutes(elapsed < 2 ? 47 : Math.min(99, 47 + elapsed));
    }, 30000);
    return () => {
      window.clearInterval(check);
      ["mousemove", "keydown", "touchstart", "scroll"].forEach((event) =>
        window.removeEventListener(event, activity)
      );
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (running) return;
    const minutes = mode === "focus" ? settings.focusMinutes : settings.breakMinutes;
    setDuration(minutes);
    setSeconds(minutes * 60);
  }, [settings.focusMinutes, settings.breakMinutes, mode, running]);

  const setTimerDuration = (minutes: number, nextMode: "focus" | "break" = mode) => {
    setRunning(false); setDuration(minutes); setSeconds(minutes * 60); setMode(nextMode); sessionStartedAt.current = null;
  };

  const progress = 1 - seconds / (duration * 60);
  const completed = tasks.filter((task) => task.done).length;
  const displayName = profile.name.trim() || "あなた";
  const todayKey = dateKey(new Date());
  const yesterdayKey = dateKey(addDays(new Date(), -1));
  const todayMinutes = sumMinutesForDate(focusSessions, todayKey);
  const yesterdayMinutes = sumMinutesForDate(focusSessions, yesterdayKey);
  const todaySessions = focusSessions.filter((session) => sessionDateKey(session) === todayKey);
  const weekStats = buildWeekStats(focusSessions);
  const weekTotalMinutes = weekStats.reduce((total, item) => total + item.minutes, 0);
  const weekGoalMinutes = profile.dailyGoalSessions * settings.focusMinutes * 7;
  const weekRemainingMinutes = Math.max(0, weekGoalMinutes - weekTotalMinutes);
  const focusScore = Math.min(100, Math.round((todaySessions.length / Math.max(1, profile.dailyGoalSessions)) * 100));
  const streak = countFocusStreak(focusSessions);
  const recentSessions = [...focusSessions].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()).slice(0, 3);
  const bestPeriod = todaySessions.length
    ? ["午前", "午後", "夜"].reduce((best, label) => {
        const range = label === "午前" ? [5, 12] : label === "午後" ? [12, 18] : [18, 24];
        const count = todaySessions.filter((session) => {
          const hour = new Date(session.endedAt).getHours();
          return hour >= range[0] && hour < range[1];
        }).length;
        return count > best.count ? { label, count } : best;
      }, { label: "午前", count: 0 }).label
    : "未記録";

  const toggleTask = (id: number) => {
    setTasks((items) => items.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  };

  const addTask = () => {
    const title = taskInput.trim();
    if (!title) return;
    setTasks((items) => [...items, { id: Date.now(), title, estimate: 1, done: false }]);
    setTaskInput("");
  };

  const startFocus = () => {
    setRunning((value) => !value);
    if (!running) {
      if (mode === "focus" && !sessionStartedAt.current) sessionStartedAt.current = new Date().toISOString();
      if (settings.autoQuiet) {
        setQuiet(true);
        setToast("集中モードON — 通知をまとめます");
      }
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="FocusFlow ホーム">
          <span className="brand-mark"><Icon name="spark" /></span>
          <span>FocusFlow</span>
        </a>
        <nav className="main-nav" aria-label="メインナビゲーション">
          <a className="nav-item active" href="#top"><Icon name="home" /><span>今日</span></a>
          <a className="nav-item" href="#timer"><Icon name="timer" /><span>フォーカス</span></a>
          <a className="nav-item" href="#insights"><Icon name="chart" /><span>インサイト</span></a>
          <button className="nav-item" onClick={() => setMeetingOpen(true)}><Icon name="meeting" /><span>会議チェック</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-streak"><span>今週のリズム</span><strong>{streak}日連続</strong><small>目標 {profile.dailyGoalSessions} ポモドーロ/日</small></div>
          <button className="nav-item" onClick={() => setSettingsOpen(true)}><Icon name="settings" /><span>設定</span></button>
          <div className="profile"><span className="avatar">{getInitial(displayName)}</span><span><strong>{displayName}</strong><small>{profile.role || "ローカル保存"}</small></span><span className="online" /></div>
        </div>
      </aside>

      <main id="top" className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">7月23日 木曜日</p><h1>おはようございます、{displayName}さん</h1><p>今日も、いいリズムをつくりましょう。</p></div>
          <div className="top-actions">
            <button className={`quiet-pill ${quiet ? "on" : ""}`} onClick={() => setQuiet(!quiet)} aria-pressed={quiet}>
              <span className="status-dot" /><span><b>通知抑制</b><small>{quiet ? "集中時に自動ON" : "オフ"}</small></span><span className="switch" />
            </button>
            <button className="icon-button" aria-label="通知"><Icon name="bell" /><span className="badge">{queued}</span></button>
          </div>
        </header>

        {settings.visible.overview && <section className="overview-grid" aria-label="今日の概要">
          <div className="metric-card primary"><span className="metric-icon"><Icon name="timer" /></span><div><span>今日の集中</span><strong>{formatMinutes(todayMinutes)}</strong><small><b>{todayMinutes >= yesterdayMinutes ? "+" : ""}{todayMinutes - yesterdayMinutes}分</b> 昨日より</small></div></div>
          <div className="metric-card"><span className="metric-icon purple"><Icon name="check" /></span><div><span>完了タスク</span><strong>{completed} / {tasks.length}</strong><small>あと{tasks.length - completed}件で完了</small></div></div>
          <div className="metric-card"><span className="metric-icon amber"><Icon name="spark" /></span><div><span>フォーカススコア</span><strong>{focusScore} <em>/ 100</em></strong><small><b>{todaySessions.length}回完了</b> {bestPeriod}がベスト</small></div></div>
          <div className="metric-card"><span className="metric-icon green"><Icon name="leaf" /></span><div><span>連続作業</span><strong>{idleMinutes}分</strong><small>{idleMinutes >= settings.breakReminderMinutes ? "そろそろ小休憩を" : "良いペースです"}</small></div></div>
        </section>}

        <div className={`workspace-grid ${settings.visible.tasks || settings.visible.smartBreak || settings.visible.notificationDigest ? "" : "single"}`}>
          <section id="timer" className="card timer-card">
            <div className="card-heading"><div><span className="section-kicker">FOCUS SESSION</span><h2>深く集中する</h2></div><div className="segmented"><button className={mode === "focus" ? "selected" : ""} onClick={() => setTimerDuration(settings.focusMinutes, "focus")}>集中</button><button className={mode === "break" ? "selected" : ""} onClick={() => setTimerDuration(settings.breakMinutes, "break")}>休憩</button></div></div>
            <div className="timer-body">
              <div className="timer-ring" style={{ "--progress": `${progress * 360}deg` } as React.CSSProperties}>
                <div className="timer-inner"><span>{mode === "focus" ? "集中時間" : "休憩時間"}</span><strong>{formatTime(seconds)}</strong><small>{running ? "セッション進行中" : "準備できました"}</small></div>
              </div>
              <div className="timer-controls">
                <button className="round secondary" onClick={() => setTimerDuration(duration)} aria-label="リセット"><Icon name="reset" /></button>
                <button className="round primary" onClick={startFocus} aria-label={running ? "一時停止" : "開始"}><Icon name={running ? "pause" : "play"} /></button>
                <button className="round secondary" onClick={() => { setDuration((value) => value + 5); setSeconds((s) => Math.max(60, s + 5 * 60)); }} aria-label="5分追加">+5</button>
              </div>
              <div className="timer-presets">
                {[15, 25, 45, 60].map((value) => <button key={value} className={duration === value ? "active" : ""} onClick={() => setTimerDuration(value, "focus")}>{value}分</button>)}
              </div>
            </div>
            <div className="current-task"><span className="task-color" /><span><small>集中するタスク</small><strong>{tasks.find((task) => task.id === activeTask)?.title ?? "タスクを選択"}</strong></span><select value={activeTask} onChange={(e) => setActiveTask(Number(e.target.value))} aria-label="集中するタスクを選択">{tasks.filter(t => !t.done).map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div>
          </section>

          {settings.visible.tasks && <section className="card task-card">
            <div className="card-heading"><div><span className="section-kicker">TODAY&apos;S TASKS</span><h2>今日のタスク</h2></div><span className="count-pill">{completed}/{tasks.length}</span></div>
            <div className="progress-track"><span style={{ width: `${Math.max(8, completed / tasks.length * 100)}%` }} /></div>
            <div className="task-list">
              {tasks.map((task) => (
                <div key={task.id} className={`task-row ${task.done ? "done" : ""}`}>
                  <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={`${task.title}を${task.done ? "未完了" : "完了"}にする`}>{task.done && <Icon name="check" />}</button>
                  <button className="task-title" onClick={() => setActiveTask(task.id)}><span>{task.title}</span><small>予定 {task.estimate} ポモドーロ</small></button>
                  {!task.done && <button className="task-play" onClick={() => { setActiveTask(task.id); document.getElementById("timer")?.scrollIntoView({ behavior: "smooth" }); }} aria-label={`${task.title}を開始`}><Icon name="play" /></button>}
                </div>
              ))}
            </div>
            <div className="add-task"><Icon name="plus" /><input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="タスクを追加..." aria-label="新しいタスク" /><button onClick={addTask}>追加</button></div>
          </section>}

          {settings.visible.smartBreak && <section className={`card break-card ${idleMinutes >= settings.breakReminderMinutes ? "needs-break" : ""}`}>
            <div className="break-visual"><span className="steam">〰</span><span className="cup">▰</span></div>
            <div><span className="section-kicker">SMART BREAK</span><h2>{breakDone ? "いい休憩でした！" : "ひと息入れませんか？"}</h2><p>{breakDone ? "目と肩を休められました。準備ができたら再開しましょう。" : `${idleMinutes}分間、集中が続いています。90秒だけ窓の外を見て、肩を回すのがおすすめです。`}</p><div className="break-actions"><button className="button dark" onClick={() => { setBreakDone(true); setTimerDuration(settings.breakMinutes, "break"); setRunning(true); }}>{settings.breakMinutes}分休憩する</button><button className="text-button" onClick={() => setIdleMinutes(0)}>あとで</button></div></div>
          </section>}

          {settings.visible.notificationDigest && <section className="card quiet-card">
            <div className="card-heading"><div><span className="section-kicker">NOTIFICATION DIGEST</span><h2>静かな集中</h2></div><span className={`live-dot ${quiet ? "active" : ""}`}>{quiet ? "ON" : "OFF"}</span></div>
            <p>集中時間中の通知を受け止めて、終了後にまとめてお知らせします。</p>
            <div className="digest-row"><div className="digest-icons"><span>✉</span><span>♟</span><span>●</span></div><div><strong>{queued}件を保留中</strong><small>メール 2 ・ チャット 2</small></div><button onClick={() => { setQueued(0); setToast("保留中の通知を確認しました"); }}>確認</button></div>
            <label className="toggle-row"><span><strong>集中開始時に自動でON</strong><small>ブラウザ内の通知を一時保留</small></span><input type="checkbox" checked={quiet} onChange={() => setQuiet(!quiet)} /><span className="toggle-ui" /></label>
          </section>}
        </div>

        {(settings.visible.insights || settings.visible.meeting) && <section id="insights" className={`insights-grid ${settings.visible.insights && settings.visible.meeting ? "" : "single"}`}>
          {settings.visible.insights && <div className="card chart-card">
            <div className="card-heading"><div><span className="section-kicker">WEEKLY INSIGHT</span><h2>集中のリズム</h2></div><span className="week-select">今週⌄</span></div>
            <div className="chart-summary"><strong>{formatMinutes(weekTotalMinutes)}</strong><span>目標まで <b>{formatMinutes(weekRemainingMinutes)}</b></span></div>
            <div className="bar-chart" aria-label="1週間の集中時間グラフ">
              {weekStats.map((item, index) => <div className="bar-column" key={item.key}><span className="bar-value">{item.minutes >= 60 ? `${Math.floor(item.minutes/60)}h${item.minutes%60 || ""}` : `${item.minutes}m`}</span><div className={`bar ${index === weekStats.length - 1 ? "today" : ""}`} style={{ height: `${Math.max(18, item.minutes / Math.max(60, settings.focusMinutes * profile.dailyGoalSessions) * 100)}%` }} /><small>{item.day}</small></div>)}
            </div>
            <div className="session-history">
              <div><strong>最近の記録</strong><small>{focusSessions.length}セッション保存中</small></div>
              {recentSessions.length ? recentSessions.map((session) => (
                <span key={session.id}><b>{session.taskTitle}</b><small>{formatMinutes(session.minutes)} ・ {new Date(session.endedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</small></span>
              )) : <p>まだ集中記録がありません。タイマーを完了するとここに残ります。</p>}
            </div>
          </div>}
          {settings.visible.meeting && <div className="card meeting-card">
            <div className="meeting-top"><div className="calendar-tile"><strong>23</strong><span>JUL</span></div><div><span className="section-kicker">NEXT MEETING</span><h2>デザインレビュー</h2><p>10:30 — 11:00 ・ あと18分</p></div></div>
            <div className="attendees"><span>美</span><span>健</span><span>彩</span><small>+2</small></div>
            <button className="button meeting-button" onClick={() => setMeetingOpen(true)}><Icon name="meeting" /> 会議前チェックを開始</button>
            <small className="meeting-note"><span className="status-dot" /> カメラ・マイク・通信を約10秒で確認</small>
          </div>}
        </section>}

        <footer><span><Icon name="spark" /> FocusFlow</span><p>集中と休息を、あなたらしいリズムで。</p><span>端末に自動保存済み ✓</span></footer>
      </main>

      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
        <a className="active" href="#top"><Icon name="home" /><span>今日</span></a><a href="#timer"><Icon name="timer" /><span>集中</span></a><button onClick={() => setMeetingOpen(true)}><Icon name="meeting" /><span>会議</span></button><a href="#insights"><Icon name="chart" /><span>記録</span></a><button onClick={() => setSettingsOpen(true)}><Icon name="settings" /><span>設定</span></button>
      </nav>
      {meetingOpen && <MeetingChecker onClose={() => setMeetingOpen(false)} />}
      {onboardingOpen && <OnboardingModal profile={profile} settings={settings} onComplete={(nextProfile, nextSettings) => {
        setProfile(nextProfile); setSettings(nextSettings); setQuiet(nextSettings.autoQuiet);
        setTimerDuration(nextSettings.focusMinutes, "focus"); setOnboardingOpen(false); setToast("初期設定を保存しました");
      }} />}
      {settingsOpen && <SettingsModal settings={settings} profile={profile} tasks={tasks} focusSessions={focusSessions} onChange={setSettings} onProfileChange={setProfile} onClose={() => setSettingsOpen(false)} onReset={() => {
        setTasks(INITIAL_TASKS); setFocusSessions([]); setSettings(DEFAULT_SETTINGS); setProfile(DEFAULT_PROFILE); setQuiet(DEFAULT_SETTINGS.autoQuiet); setOnboardingOpen(true);
        setTimerDuration(DEFAULT_SETTINGS.focusMinutes, "focus"); setToast("設定とローカルデータを初期化しました");
      }} />}
      {toast && <div className="toast" role="status"><Icon name="check" />{toast}</div>}
    </div>
  );
}

function OnboardingModal({
  profile, settings, onComplete,
}: {
  profile: UserProfile;
  settings: AppSettings;
  onComplete: (profile: UserProfile, settings: AppSettings) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [dailyGoalSessions, setDailyGoalSessions] = useState(profile.dailyGoalSessions);
  const [focusMinutes, setFocusMinutes] = useState(settings.focusMinutes);
  const [breakMinutes, setBreakMinutes] = useState(settings.breakMinutes);
  const [nameTouched, setNameTouched] = useState(false);
  const trimmedName = name.trim();
  const guideItems = [
    { title: "1. タスクを選ぶ", detail: "今日やることを追加して、集中するタスクを1つ決めます。" },
    { title: "2. タイマーを回す", detail: "集中と休憩を切り替えながら、作業ログを端末に残します。" },
    { title: "3. 必要な項目だけ見る", detail: "設定からグラフ、会議チェック、通知抑制などを表示切替できます。" },
  ];
  const complete = () => {
    setNameTouched(true);
    if (!trimmedName) return;
    onComplete(
      { name: trimmedName, role: role.trim(), dailyGoalSessions, onboardingComplete: true },
      { ...settings, focusMinutes, breakMinutes },
    );
  };

  return (
    <div className="modal-backdrop onboarding-backdrop" role="presentation">
      <div className="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-hero">
          <span className="brand-mark"><Icon name="spark" /></span>
          <span className="section-kicker">WELCOME TO FOCUSFLOW</span>
          <h2 id="onboarding-title">最初に、あなた用の作業環境を整えます</h2>
          <p>この設定は端末内だけに保存されます。あとから設定画面でいつでも変更できます。</p>
        </div>

        <div className="guide-grid">
          {guideItems.map((item) => (
            <div className="guide-card" key={item.title}>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>

        <div className="setup-form">
          <label className="text-setting"><span><strong>表示名</strong><small>挨拶やプロフィールに表示します</small></span><input value={name} onBlur={() => setNameTouched(true)} onChange={(event) => setName(event.target.value)} placeholder="例: 佐藤 悠" autoFocus /></label>
          {nameTouched && !trimmedName && <p className="form-error">表示名を入力してください</p>}
          <label className="text-setting"><span><strong>作業タイプ</strong><small>例: 開発、デザイン、学習、事務作業</small></span><input value={role} onChange={(event) => setRole(event.target.value)} placeholder="例: Web開発" /></label>
          <div className="settings-form-grid compact">
            <label className="select-setting"><span><strong>集中時間</strong><small>1回の作業時間</small></span><select value={focusMinutes} onChange={(event) => setFocusMinutes(Number(event.target.value))}>{[15, 25, 45, 60, 90].map(value => <option value={value} key={value}>{value}分</option>)}</select></label>
            <label className="select-setting"><span><strong>休憩時間</strong><small>集中後の休憩</small></span><select value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value))}>{[3, 5, 10, 15].map(value => <option value={value} key={value}>{value}分</option>)}</select></label>
            <label className="select-setting"><span><strong>1日の目標</strong><small>ポモドーロ数</small></span><select value={dailyGoalSessions} onChange={(event) => setDailyGoalSessions(Number(event.target.value))}>{[2, 3, 4, 6, 8].map(value => <option value={value} key={value}>{value}回</option>)}</select></label>
          </div>
        </div>

        <button className="button dark full onboarding-start" onClick={complete}>FocusFlowを始める</button>
      </div>
    </div>
  );
}

function SettingsModal({
  settings, profile, tasks, focusSessions, onChange, onProfileChange, onClose, onReset,
}: {
  settings: AppSettings;
  profile: UserProfile;
  tasks: Task[];
  focusSessions: FocusSession[];
  onChange: (settings: AppSettings) => void;
  onProfileChange: (profile: UserProfile) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const update = <K extends keyof AppSettings,>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };
  const updateVisible = (key: keyof VisibleSections, value: boolean) => {
    onChange({ ...settings, visible: { ...settings.visible, [key]: value } });
  };
  const exportData = () => {
    const payload = { app: "FocusFlow", exportedAt: new Date().toISOString(), tasks, focusSessions, settings, profile };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const resetData = () => {
    if (window.confirm("タスク、集中回数、すべての設定を初期状態に戻しますか？")) {
      localStorage.removeItem("focusflow-state");
      onReset(); onClose();
    }
  };
  const sections: Array<{ key: keyof VisibleSections; label: string; detail: string }> = [
    { key: "overview", label: "今日の概要", detail: "集中時間・タスク・スコア" },
    { key: "tasks", label: "今日のタスク", detail: "タスク一覧と追加フォーム" },
    { key: "smartBreak", label: "休憩リマインダー", detail: "連続作業に応じた休憩提案" },
    { key: "notificationDigest", label: "通知ダイジェスト", detail: "保留中の通知と抑制状態" },
    { key: "insights", label: "週間インサイト", detail: "集中時間の週間グラフ" },
    { key: "meeting", label: "次の会議", detail: "会議予定と事前チェック" },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header">
          <div><span className="section-kicker">PREFERENCES</span><h2 id="settings-title">FocusFlowの設定</h2><p>表示と集中リズムを、この端末に合わせます。</p></div>
          <button className="modal-close" onClick={onClose} aria-label="設定を閉じる">×</button>
        </div>

        <div className="settings-scroll">
          <section className="settings-section">
            <div className="settings-section-title"><span className="settings-section-icon"><Icon name="home" /></span><span><strong>プロフィール</strong><small>初回設定で入力した情報を変更できます</small></span></div>
            <div className="profile-settings-grid">
              <label className="text-setting"><span><strong>表示名</strong><small>挨拶とサイドバーに表示</small></span><input value={profile.name} onChange={(event) => onProfileChange({ ...profile, name: event.target.value })} placeholder="表示名" /></label>
              <label className="text-setting"><span><strong>作業タイプ</strong><small>プロフィールの補足ラベル</small></span><input value={profile.role} onChange={(event) => onProfileChange({ ...profile, role: event.target.value })} placeholder="例: Web開発" /></label>
              <label className="select-setting"><span><strong>1日の目標</strong><small>目標ポモドーロ数</small></span><select value={profile.dailyGoalSessions} onChange={(event) => onProfileChange({ ...profile, dailyGoalSessions: Number(event.target.value) })}>{[2, 3, 4, 6, 8].map(value => <option value={value} key={value}>{value}回</option>)}</select></label>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><span className="settings-section-icon"><Icon name="chart" /></span><span><strong>ホームに表示する項目</strong><small>不要なカードを隠して画面を整理できます</small></span></div>
            <div className="visibility-grid">
              {sections.map((section) => (
                <label className="setting-card" key={section.key}>
                  <span><strong>{section.label}</strong><small>{section.detail}</small></span>
                  <input type="checkbox" checked={settings.visible[section.key]} onChange={(event) => updateVisible(section.key, event.target.checked)} />
                  <span className="toggle-ui" />
                </label>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><span className="settings-section-icon"><Icon name="timer" /></span><span><strong>集中と休憩</strong><small>自分に合う基本時間を設定します</small></span></div>
            <div className="settings-form-grid">
              <label className="select-setting"><span><strong>集中時間</strong><small>新しいセッションの標準時間</small></span><select value={settings.focusMinutes} onChange={(event) => update("focusMinutes", Number(event.target.value))}>{[15, 25, 45, 60, 90].map(value => <option value={value} key={value}>{value}分</option>)}</select></label>
              <label className="select-setting"><span><strong>休憩時間</strong><small>集中終了後の休憩時間</small></span><select value={settings.breakMinutes} onChange={(event) => update("breakMinutes", Number(event.target.value))}>{[3, 5, 10, 15].map(value => <option value={value} key={value}>{value}分</option>)}</select></label>
              <label className="select-setting"><span><strong>休憩を提案</strong><small>連続作業がこの時間を超えたら表示</small></span><select value={settings.breakReminderMinutes} onChange={(event) => update("breakReminderMinutes", Number(event.target.value))}>{[30, 45, 60, 90].map(value => <option value={value} key={value}>{value}分後</option>)}</select></label>
            </div>
            <label className="setting-row"><span><strong>集中時に通知抑制を自動ON</strong><small>セッション開始時にアプリ内通知を保留します</small></span><input type="checkbox" checked={settings.autoQuiet} onChange={(event) => update("autoQuiet", event.target.checked)} /><span className="toggle-ui" /></label>
            <label className="setting-row"><span><strong>終了音を鳴らす</strong><small>集中セッションの終了時に短い音で知らせます</small></span><input type="checkbox" checked={settings.completionSound} onChange={(event) => update("completionSound", event.target.checked)} /><span className="toggle-ui" /></label>
          </section>

          <section className="settings-section data-section">
            <div className="settings-section-title"><span className="settings-section-icon"><Icon name="home" /></span><span><strong>この端末のデータ</strong><small>サーバーへの送信やアカウント登録はありません</small></span><span className="local-badge">LOCAL ONLY</span></div>
            <div className="data-summary"><span><b>{tasks.length}</b> タスク</span><span><b>{focusSessions.length}</b> 集中セッション</span><span><b>{formatMinutes(focusSessions.reduce((total, session) => total + session.minutes, 0))}</b> 記録</span></div>
            <div className="data-actions"><button className="button soft" onClick={exportData}>バックアップを書き出す</button><button className="danger-button" onClick={resetData}>すべて初期化</button></div>
          </section>
        </div>
        <div className="settings-footer"><span>変更はこの端末へ自動保存されます</span><button className="button dark" onClick={onClose}>完了</button></div>
      </div>
    </div>
  );
}

function MeetingChecker({ onClose }: { onClose: () => void }) {
  const [states, setStates] = useState<Record<string, CheckState>>({ mic: "idle", camera: "idle", sound: "idle", network: "idle" });
  const [message, setMessage] = useState("4項目をまとめて確認します");
  const streamRef = useRef<MediaStream | null>(null);
  const allOk = useMemo(() => Object.values(states).every((value) => value === "ok"), [states]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const runChecks = useCallback(async () => {
    setMessage("デバイスに接続しています…");
    setStates({ mic: "checking", camera: "checking", sound: "checking", network: "checking" });
    try {
      const started = performance.now();
      await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
      const latency = performance.now() - started;
      setStates((s) => ({ ...s, network: latency < 1500 ? "ok" : "warn" }));
    } catch { setStates((s) => ({ ...s, network: "warn" })); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      setStates((s) => ({ ...s, mic: stream.getAudioTracks().length ? "ok" : "warn", camera: stream.getVideoTracks().length ? "ok" : "warn" }));
    } catch { setStates((s) => ({ ...s, mic: "warn", camera: "warn" })); }
    try {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain(); gain.gain.value = 0.025; oscillator.frequency.value = 523;
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.2);
      setStates((s) => ({ ...s, sound: "ok" }));
      window.setTimeout(() => audio.close(), 500);
    } catch { setStates((s) => ({ ...s, sound: "warn" })); }
    setMessage("チェックが完了しました");
  }, []);

  const items = [
    { key: "mic", label: "マイク", detail: "入力デバイス", icon: "◉" },
    { key: "camera", label: "カメラ", detail: "映像アクセス", icon: "▣" },
    { key: "sound", label: "スピーカー", detail: "テスト音", icon: "◖" },
    { key: "network", label: "通信状態", detail: "応答速度", icon: "⌁" },
  ];
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="meeting-title">
        <button className="modal-close" onClick={onClose} aria-label="閉じる">×</button>
        <span className="modal-icon"><Icon name="meeting" /></span><span className="section-kicker">MEETING CHECK</span><h2 id="meeting-title">会議の準備を整える</h2><p>{message}</p>
        <div className="check-grid">{items.map((item) => <div className="check-item" key={item.key}><span className="check-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><Status state={states[item.key]} /></div>)}</div>
        {allOk && <div className="all-clear"><Icon name="check" /><span><strong>準備OKです</strong><small>安心して会議に参加できます</small></span></div>}
        <button className="button dark full" onClick={runChecks}>{Object.values(states).some(s => s === "checking") ? "確認中…" : allOk ? "もう一度チェック" : "一括チェックを開始"}</button>
        <small className="privacy-note">カメラやマイクの内容は保存・送信されません</small>
      </div>
    </div>
  );
}

function Status({ state }: { state: CheckState }) {
  const labels = { idle: "未確認", checking: "確認中", ok: "OK", warn: "要確認" };
  return <span className={`check-status ${state}`}>{state === "checking" && <span className="spinner" />}{labels[state]}</span>;
}
