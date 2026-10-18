/* =========================================================
   LUMEN · 光屿
   Vanilla JS. No network required except the optional weather.
   ========================================================= */
(() => {
  "use strict";

  /* ---------------------------------------------------------
     01 · Utilities & storage
     --------------------------------------------------------- */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const pad = (value) => String(value).padStart(2, "0");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const KEYS = {
    settings: "lumen.settings.v1",
    photo: "lumen.wallpaper.v1",
    notes: "lumen.notes.v1",
    engine: "lumen.engine.v1",
    recent: "lumen.recent.v1",
    dock: "lumen.dock.v1",
    focus: "lumen.focus.v1",
    weatherCity: "lumen.weather.city.v1",
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readString(key, fallback = "") {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeString(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function makeId(prefix = "id") {
    const random = window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `${prefix}-${random}`;
  }

  function todayKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function normalizeUrl(raw) {
    let value = String(raw || "").trim();
    if (!value) return "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function openExternal(url) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  /* ---------------------------------------------------------
     02 · Global UI state
     --------------------------------------------------------- */
  const WALLPAPERS = [
    { id: "dusk", name: "流光暮色" },
    { id: "aurora", name: "极光夜航" },
    { id: "mist", name: "晨雾山野" },
    { id: "ember", name: "琥珀黄昏" },
    { id: "abyss", name: "深海微光" },
    { id: "moon", name: "月白" },
  ];

  const DEFAULT_SETTINGS = Object.freeze({
    wall: "dusk",
    blur: 2,
    dim: 18,
    motion: true,
    grain: true,
    dockMagnify: true,
    parallax: true,
  });

  const backdrop = $("#backdrop");
  const backdropCanvas = $("#backdropCanvas");
  const scenePhoto = $("#scenePhoto");
  const page = $(".page");

  let settings = loadSettings();
  let customPhoto = readString(KEYS.photo, "");
  let saveSettingsTimer = 0;

  function loadSettings() {
    const raw = readJSON(KEYS.settings, {});
    const next = { ...DEFAULT_SETTINGS };

    if (raw && typeof raw === "object") {
      if (WALLPAPERS.some((wallpaper) => wallpaper.id === raw.wall) || raw.wall === "custom") {
        next.wall = raw.wall;
      }
      if (Number.isFinite(Number(raw.blur))) next.blur = clamp(Math.round(Number(raw.blur)), 0, 40);
      if (Number.isFinite(Number(raw.dim))) next.dim = clamp(Math.round(Number(raw.dim)), 0, 65);
      ["motion", "grain", "dockMagnify", "parallax"].forEach((key) => {
        if (typeof raw[key] === "boolean") next[key] = raw[key];
      });
    }

    return next;
  }

  function saveSettingsSoon() {
    window.clearTimeout(saveSettingsTimer);
    saveSettingsTimer = window.setTimeout(() => {
      writeJSON(KEYS.settings, settings);
    }, 140);
  }

  function saveSettingsNow() {
    writeJSON(KEYS.settings, settings);
  }

  function setRangeFill(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    input.style.setProperty("--fill", `${((value - min) / (max - min)) * 100}%`);
  }

  function applyAppearance({ save = true } = {}) {
    if (settings.wall === "custom" && !customPhoto) settings.wall = "dusk";

    const theme = WALLPAPERS.find((wallpaper) => wallpaper.id === settings.wall)?.id || "dusk";
    backdrop.dataset.wall = theme;
    const usingPhoto = settings.wall === "custom" && Boolean(customPhoto);
    backdrop.classList.toggle("has-photo", usingPhoto);

    if (usingPhoto) {
      scenePhoto.style.backgroundImage = `url("${customPhoto.replace(/"/g, '\\"')}")`;
    } else {
      scenePhoto.style.backgroundImage = "";
    }

    backdrop.style.setProperty("--bg-blur", `${settings.blur}px`);
    backdrop.style.setProperty("--dim", (settings.dim / 100).toFixed(3));
    document.body.classList.toggle("no-grain", !settings.grain);
    document.body.classList.toggle("motion-off", !settings.motion);

    syncAppearanceControls();
    updateWallpaperSelection();

    if (!settings.parallax) resetParallax();

    if (save) saveSettingsSoon();
  }

  function syncAppearanceControls() {
    const blurRange = $("#blurRange");
    const dimRange = $("#dimRange");
    const blurValue = $("#blurValue");
    const dimValue = $("#dimValue");

    if (blurRange) {
      blurRange.value = String(settings.blur);
      setRangeFill(blurRange);
    }
    if (dimRange) {
      dimRange.value = String(settings.dim);
      setRangeFill(dimRange);
    }
    if (blurValue) blurValue.textContent = `${settings.blur} px`;
    if (dimValue) dimValue.textContent = `${settings.dim}%`;

    const motionToggle = $("#motionToggle");
    const grainToggle = $("#grainToggle");
    const dockMagToggle = $("#dockMagToggle");
    const parallaxToggle = $("#parallaxToggle");
    if (motionToggle) motionToggle.checked = settings.motion;
    if (grainToggle) grainToggle.checked = settings.grain;
    if (dockMagToggle) dockMagToggle.checked = settings.dockMagnify;
    if (parallaxToggle) parallaxToggle.checked = settings.parallax;
  }

  /* ---------------------------------------------------------
     03 · Wallpaper picker
     --------------------------------------------------------- */
  const wallpaperGrid = $("#wallpaperGrid");
  const uploadTile = $("#uploadTile");
  const wallpaperInput = $("#wallpaperInput");

  function renderWallpapers() {
    if (!wallpaperGrid) return;
    wallpaperGrid.innerHTML = "";

    WALLPAPERS.forEach((wallpaper) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wall-tile";
      button.dataset.wall = wallpaper.id;
      button.setAttribute("aria-label", `使用${wallpaper.name}背景`);
      button.innerHTML = `
        <span class="wall-art"></span>
        <span class="wall-name">${escapeHtml(wallpaper.name)}</span>
        <span class="wall-check" aria-hidden="true"><svg><use href="#i-check"/></svg></span>
      `;
      button.addEventListener("click", () => selectWallpaper(wallpaper.id));
      wallpaperGrid.appendChild(button);
    });

    if (customPhoto) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wall-tile wall-tile--wide is-custom";
      button.dataset.wall = "custom";
      button.setAttribute("aria-label", "使用我上传的图片作为背景");

      const art = document.createElement("span");
      art.className = "wall-art wall-art--photo";
      art.style.backgroundImage = `url("${customPhoto.replace(/"/g, '\\"')}")`;

      const name = document.createElement("span");
      name.className = "wall-name";
      name.textContent = "我的图片";

      const check = document.createElement("span");
      check.className = "wall-check";
      check.setAttribute("aria-hidden", "true");
      check.innerHTML = '<svg><use href="#i-check"/></svg>';

      button.append(art, name, check);
      button.addEventListener("click", () => selectWallpaper("custom"));
      wallpaperGrid.appendChild(button);
    }

    updateWallpaperSelection();
  }

  function updateWallpaperSelection() {
    if (!wallpaperGrid) return;
    $$(".wall-tile", wallpaperGrid).forEach((tile) => {
      const selected = tile.dataset.wall === settings.wall;
      tile.classList.toggle("is-active", selected);
      tile.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function selectWallpaper(id) {
    if (id === "custom" && !customPhoto) {
      wallpaperInput?.click();
      return;
    }
    settings.wall = id;
    applyAppearance();
  }

  async function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("decode-failed"));
      };
      image.src = objectUrl;
    });
  }

  async function compressWallpaper(file) {
    const image = await loadImageFile(file);
    const ratios = [
      { max: 2000, quality: 0.84 },
      { max: 1800, quality: 0.78 },
      { max: 1500, quality: 0.7 },
    ];
    let lastDataUrl = "";

    for (const ratio of ratios) {
      const scale = Math.min(1, ratio.max / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
      const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("canvas-unavailable");
      context.fillStyle = "#070b13";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      lastDataUrl = canvas.toDataURL("image/webp", ratio.quality);
      if (!lastDataUrl.startsWith("data:image/webp")) {
        lastDataUrl = canvas.toDataURL("image/jpeg", ratio.quality);
      }
      if (lastDataUrl.length < 2_400_000) break;
    }

    return lastDataUrl;
  }

  async function handleWallpaperFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("这不是一张图片，请换一个文件。", { icon: "i-info" });
      return;
    }

    let dataUrl = "";
    try {
      dataUrl = await compressWallpaper(file);
    } catch (error) {
      showToast("图片读取失败，试试 JPG 或 PNG 格式。", { icon: "i-info" });
      return;
    }

    if (!dataUrl) {
      showToast("图片处理失败，请换一张图片。", { icon: "i-info" });
      return;
    }

    customPhoto = dataUrl;
    settings.wall = "custom";
    const persisted = writeString(KEYS.photo, dataUrl);

    applyAppearance();
    renderWallpapers();
    if (!persisted) {
      showToast("图片较大，仅在本次打开中生效。", { icon: "i-info" });
    } else {
      showToast("背景已经换成你的图片。", { icon: "i-spark" });
    }
  }

  wallpaperInput?.addEventListener("change", () => {
    const file = wallpaperInput.files?.[0];
    wallpaperInput.value = "";
    handleWallpaperFile(file);
  });

  uploadTile?.addEventListener("click", () => wallpaperInput?.click());

  /* ---------------------------------------------------------
     04 · Clock, date and calendar icon
     --------------------------------------------------------- */
  const clockText = $("#clockText");
  const greetingText = $("#greetingText");
  const greetingIcon = $("#greetingIcon");
  const dateText = $("#dateText");
  const weekdayText = $("#weekdayText");
  const lunarText = $("#lunarText");

  const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const LUNAR_DAYS = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

  let previousMinute = "";
  let previousDay = "";

  function getGreeting(hour) {
    if (hour >= 4 && hour < 9) return "早安，晨光正好";
    if (hour >= 9 && hour < 12) return "上午好，慢慢展开";
    if (hour >= 12 && hour < 14) return "午安，歇一会儿";
    if (hour >= 14 && hour < 18) return "下午好，保持专注";
    if (hour >= 18 && hour < 23) return "晚上好，欢迎回来";
    return "夜深了，也别忘了休息";
  }

  function getDayNote(hour, day) {
    if (hour < 6) return "把夜色留给好梦";
    if (hour < 11) return "今日宜慢慢开始";
    if (hour < 18) return "把重要的事留在此刻";
    if (day === 0 || day === 6) return "周末宜虚度一点";
    return "今日宜慢下来";
  }

  function getLunarLabel(date) {
    try {
      const formatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" });
      const parts = formatter.formatToParts(date);
      const month = parts.find((part) => part.type === "month")?.value || "";
      const dayPart = Number(parts.find((part) => part.type === "day")?.value || 0);
      if (!month || !dayPart) return "";
      const day = LUNAR_DAYS[dayPart];
      if (!day) return "";
      return `农历${month}${day}`;
    } catch (error) {
      return "";
    }
  }

  function updateCalendarDock() {
    const now = new Date();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    $$(".dock-app--calendar").forEach((icon) => {
      const top = $(".cal-top", icon);
      const day = $(".cal-day", icon);
      if (top) top.textContent = months[now.getMonth()];
      if (day) day.textContent = String(now.getDate());
    });
  }

  function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = pad(now.getMinutes());
    const timeLabel = `${pad(hours)}:${minutes}`;

    if (timeLabel !== previousMinute) {
      previousMinute = timeLabel;
      if (clockText) {
        clockText.textContent = timeLabel;
        clockText.setAttribute("aria-label", `当前时间 ${timeLabel}`);
      }

      const greeting = getGreeting(hours);
      if (greetingText && greetingText.textContent !== greeting) {
        greetingText.textContent = greeting;
      }
      if (greetingIcon) {
        const icon = hours >= 6 && hours < 18 ? "i-sun" : "i-moon";
        if (greetingIcon.dataset.icon !== icon) {
          greetingIcon.dataset.icon = icon;
          greetingIcon.innerHTML = `<svg><use href="#${icon}"></use></svg>`;
        }
      }
    }

    const dayKey = todayKey(now);
    if (dayKey !== previousDay) {
      previousDay = dayKey;
      if (dateText) {
        dateText.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
      }
      if (weekdayText) weekdayText.textContent = WEEKDAYS[now.getDay()];
      if (lunarText) {
        const lunar = getLunarLabel(now);
        lunarText.textContent = lunar;
        lunarText.hidden = !lunar;
      }
      const dateNote = $(".date-note");
      if (dateNote) dateNote.textContent = getDayNote(hours, now.getDay());
      updateCalendarDock();
    }
  }

  /* ---------------------------------------------------------
     05 · Toasts
     --------------------------------------------------------- */
  const toastRegion = $("#toastRegion");

  function showToast(message, options = {}) {
    if (!toastRegion) return;
    const { icon = "i-info", actionLabel = "", onAction = null, duration = 3400 } = options;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<svg aria-hidden="true"><use href="#${escapeHtml(icon)}"/></svg><span class="toast-text"></span>`;
    $(".toast-text", toast).textContent = message;

    let timer = 0;
    const dismiss = () => {
      window.clearTimeout(timer);
      if (!toast.isConnected || toast.classList.contains("is-out")) return;
      toast.classList.add("is-out");
      window.setTimeout(() => toast.remove(), 300);
    };

    if (actionLabel && typeof onAction === "function") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "toast-action";
      action.textContent = actionLabel;
      action.addEventListener("click", () => {
        onAction();
        dismiss();
      });
      toast.appendChild(action);
    }

    toastRegion.appendChild(toast);
    while (toastRegion.children.length > 3) toastRegion.firstElementChild.remove();
    timer = window.setTimeout(dismiss, actionLabel ? Math.max(duration, 5200) : duration);
    toast.addEventListener("pointerenter", () => window.clearTimeout(timer));
    toast.addEventListener("pointerleave", () => {
      timer = window.setTimeout(dismiss, 1500);
    });
  }

  /* ---------------------------------------------------------
     06 · Search
     --------------------------------------------------------- */
  const ENGINES = {
    google: { label: "Google", href: "https://www.google.com/search?q=" },
    bing: { label: "Bing", href: "https://www.bing.com/search?q=" },
  };

  const searchForm = $("#searchForm");
  const searchInput = $("#searchInput");
  const engineSwitch = $("#engineSwitch");
  const searchPopover = $("#searchPopover");
  const suggestionList = $("#suggestionList");
  const popoverLabel = $("#popoverLabel");
  const searchFootEngine = $("#searchFootEngine");
  const searchZone = $(".search-zone");
  const searchGo = $(".search-go");

  let engine = ["google", "bing"].includes(readString(KEYS.engine, "google"))
    ? readString(KEYS.engine, "google")
    : "google";
  let recentSearches = readJSON(KEYS.recent, []);
  if (!Array.isArray(recentSearches)) recentSearches = [];
  recentSearches = recentSearches.filter((item) => typeof item === "string" && item.trim()).slice(0, 6);

  let popoverItems = [];
  let activeSuggestion = -1;
  let popoverOpen = false;
  let commandMode = false;

  function setEngine(nextEngine, { focusInput = false } = {}) {
    if (!ENGINES[nextEngine]) nextEngine = "google";
    engine = nextEngine;
    writeString(KEYS.engine, engine);

    if (engineSwitch) engineSwitch.dataset.active = engine;
    $$(".engine-option", engineSwitch || document).forEach((option) => {
      const isActive = option.dataset.engine === engine;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (searchFootEngine) {
      searchFootEngine.textContent = `${ENGINES[engine].label} 将在新标签页中打开`;
    }
    if (popoverOpen) buildSuggestions(commandMode);
    if (focusInput) searchInput?.focus({ preventScroll: true });
  }

  function addRecentSearch(query) {
    const clean = query.trim();
    if (!clean) return;
    recentSearches = [clean, ...recentSearches.filter((item) => item !== clean)].slice(0, 6);
    writeJSON(KEYS.recent, recentSearches);
  }

  function isLikelyUrl(query) {
    if (/\s/.test(query)) return false;
    if (/^(https?:\/\/)/i.test(query)) return true;
    if (/^localhost(:\d+)?(\/.*)?$/i.test(query)) return true;
    return /^[\w-]+(\.[\w-]+)+([/:?#][^\s]*)?$/i.test(query);
  }

  function performSearch(rawQuery, engineOverride = engine) {
    const query = String(rawQuery || "").trim();
    const selectedEngine = ENGINES[engineOverride] ? engineOverride : engine;
    if (!query) {
      searchInput?.focus();
      openPopover({ commands: true });
      return;
    }

    let destination;
    if (isLikelyUrl(query)) {
      destination = /^https?:\/\//i.test(query) ? query : `https://${query}`;
      try {
        const url = new URL(destination);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported");
      } catch (error) {
        destination = `${ENGINES[selectedEngine].href}${encodeURIComponent(query)}`;
      }
    } else {
      destination = `${ENGINES[selectedEngine].href}${encodeURIComponent(query)}`;
    }

    addRecentSearch(query);
    closePopover();
    openExternal(destination);
  }

  function openPopover({ commands = false } = {}) {
    if (!searchPopover) return;
    commandMode = commands;
    buildSuggestions(commandMode);
    searchPopover.hidden = false;
    popoverOpen = true;
    activeSuggestion = -1;
    searchInput?.setAttribute("aria-expanded", "true");
    searchInput?.removeAttribute("aria-activedescendant");
  }

  function closePopover() {
    if (!searchPopover) return;
    popoverOpen = false;
    commandMode = false;
    searchPopover.hidden = true;
    activeSuggestion = -1;
    popoverItems = [];
    searchInput?.setAttribute("aria-expanded", "false");
    searchInput?.removeAttribute("aria-activedescendant");
  }

  function makeSuggestionRow(item, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion";
    button.id = `suggestion-${index}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");
    button.dataset.index = String(index);

    const icon = document.createElement("span");
    icon.className = "suggestion-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<svg><use href="#${item.icon}"/></svg>`;

    const copy = document.createElement("span");
    copy.className = "suggestion-copy";
    const title = document.createElement("span");
    title.className = "suggestion-title";
    title.textContent = item.title;
    const subtitle = document.createElement("span");
    subtitle.className = "suggestion-sub";
    subtitle.textContent = item.subtitle;
    copy.append(title, subtitle);

    const tail = document.createElement("span");
    tail.className = "suggestion-tail";
    tail.setAttribute("aria-hidden", "true");
    tail.innerHTML = item.tail === "enter"
      ? "<kbd>↵</kbd>"
      : '<svg><use href="#i-arrow-up-right"/></svg>';

    button.append(icon, copy, tail);
    button.addEventListener("click", () => activateSuggestion(index));
    button.addEventListener("pointermove", () => setActiveSuggestion(index, false));
    return button;
  }

  function buildSuggestions(forceCommands = false) {
    if (!suggestionList) return;
    const query = searchInput?.value.trim() || "";
    suggestionList.innerHTML = "";
    popoverItems = [];

    if (!query || forceCommands) {
      popoverLabel.textContent = "快捷指令";
      popoverItems.push(
        { kind: "command", command: "note", title: "记一条备忘", subtitle: "把刚刚闪过的念头留下来", icon: "i-note" },
        { kind: "command", command: "focus", title: "开始一段专注", subtitle: "清空噪音，一次只做一件事", icon: "i-target" },
        { kind: "command", command: "background", title: "换一种心情", subtitle: "打开个性化，换一张背景", icon: "i-palette" },
      );

      if (recentSearches.length) {
        recentSearches.slice(0, 3).forEach((recent) => {
          popoverItems.push({
            kind: "recent",
            query: recent,
            title: recent,
            subtitle: "最近搜索",
            icon: "i-clock",
            tail: "enter",
          });
        });
      }
    } else {
      popoverLabel.textContent = "搜索建议";
      popoverItems.push({
        kind: "search",
        query,
        engine,
        title: query,
        subtitle: `用 ${ENGINES[engine].label} 搜索`,
        icon: "i-search",
        tail: "enter",
      });

      const alternateEngine = engine === "google" ? "bing" : "google";
      popoverItems.push({
        kind: "search",
        query,
        engine: alternateEngine,
        title: `换用 ${ENGINES[alternateEngine].label} 搜索`,
        subtitle: query,
        icon: "i-arrow-up-right",
        tail: "enter",
      });

      recentSearches
        .filter((recent) => recent !== query && recent.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .forEach((recent) => {
          popoverItems.push({
            kind: "recent",
            query: recent,
            title: recent,
            subtitle: "最近搜索",
            icon: "i-clock",
            tail: "enter",
          });
        });
    }

    popoverItems.forEach((item, index) => {
      suggestionList.appendChild(makeSuggestionRow(item, index));
    });
  }

  function setActiveSuggestion(index, shouldScroll = true) {
    if (!popoverItems.length) return;
    activeSuggestion = index;
    $$(".suggestion", suggestionList).forEach((row) => {
      const active = Number(row.dataset.index) === index;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-selected", active ? "true" : "false");
    });

    const activeRow = $(`.suggestion[data-index="${index}"]`, suggestionList);
    if (activeRow) {
      searchInput?.setAttribute("aria-activedescendant", activeRow.id);
      if (shouldScroll) activeRow.scrollIntoView({ block: "nearest" });
    }
  }

  function activateSuggestion(index) {
    const item = popoverItems[index];
    if (!item) return;

    if (item.kind === "search" || item.kind === "recent") {
      if (searchInput) searchInput.value = item.query;
      performSearch(item.query, item.engine || engine);
      return;
    }

    if (item.kind === "command") {
      closePopover();
      searchInput?.blur();
      runCommand(item.command);
    }
  }

  function runCommand(command) {
    if (command === "note") {
      focusNotesWidget();
    } else if (command === "focus") {
      focusFocusWidget();
    } else if (command === "background") {
      openSettings();
    }
  }

  function nextSuggestion(direction) {
    if (!popoverOpen) {
      openPopover();
      if (!popoverItems.length) return;
    }
    const length = popoverItems.length;
    let next = activeSuggestion + direction;
    if (next < 0) next = length - 1;
    if (next >= length) next = 0;
    setActiveSuggestion(next);
  }

  searchInput?.addEventListener("focus", () => {
    if (!popoverOpen) openPopover();
  });

  searchInput?.addEventListener("input", () => {
    commandMode = false;
    openPopover();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nextSuggestion(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nextSuggestion(-1);
    } else if (event.key === "Enter" && popoverOpen) {
      if (activeSuggestion >= 0) {
        event.preventDefault();
        activateSuggestion(activeSuggestion);
      } else {
        event.preventDefault();
        performSearch(searchInput.value);
      }
    } else if (event.key === "Escape") {
      if (popoverOpen) {
        event.preventDefault();
        closePopover();
      } else if (searchInput.value) {
        searchInput.value = "";
      }
    } else if (event.key === "Tab" && popoverOpen && !event.shiftKey) {
      closePopover();
    }
  });

  searchPopover?.addEventListener("mousedown", (event) => event.preventDefault());

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (popoverOpen && activeSuggestion >= 0 && event.submitter !== searchGo) {
      activateSuggestion(activeSuggestion);
      return;
    }
    performSearch(searchInput?.value || "");
  });

  $$(".engine-option").forEach((option) => {
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => setEngine(option.dataset.engine));
  });

  searchForm?.addEventListener("click", (event) => {
    if (!event.target.closest(".engine-option") && !event.target.closest(".search-go")) {
      searchInput?.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (popoverOpen && searchZone && !searchZone.contains(event.target)) closePopover();
    if (!dockMenu.hidden && !dockMenu.contains(event.target)) closeDockMenu();
  });

  document.addEventListener("focusin", (event) => {
    if (popoverOpen && searchZone && !searchZone.contains(event.target)) closePopover();
  });

  $("#openPaletteBtn")?.addEventListener("click", () => {
    if (!searchInput) return;
    searchInput.value = "";
    searchInput.focus({ preventScroll: true });
    openPopover({ commands: true });
  });

  /* ---------------------------------------------------------
     07 · Notes
     --------------------------------------------------------- */
  const notesCard = $(".notes-card");
  const noteForm = $("#noteForm");
  const noteInput = $("#noteInput");
  const noteList = $("#noteList");
  const noteEmpty = $("#noteEmpty");
  const notesCount = $("#notesCount");
  const clearDoneBtn = $("#clearDoneBtn");
  const saveState = $("#saveState");

  const DEFAULT_NOTES = [
    { id: makeId("note"), text: "整理这一周的设计灵感", done: false },
    { id: makeId("note"), text: "给重要的人回一条消息", done: false },
    { id: makeId("note"), text: "留半小时，只做一件事", done: true },
  ];

  let notes = readJSON(KEYS.notes, null);
  if (!Array.isArray(notes)) {
    notes = DEFAULT_NOTES;
    writeJSON(KEYS.notes, notes);
  } else {
    notes = notes
      .filter((note) => note && typeof note.text === "string")
      .slice(0, 80)
      .map((note) => ({
        id: String(note.id || makeId("note")),
        text: note.text.slice(0, 90),
        done: Boolean(note.done),
      }));
  }

  let saveStateTimer = 0;

  const bento = $(".bento");
  const widgetSwitcher = $("#widgetSwitcher");
  const widgetButtons = widgetSwitcher ? $$("button[data-widget]", widgetSwitcher) : [];
  const widgetPanels = [$(".notes-card"), $(".focus-card"), $(".side-stack")];
  let widgetScrollFrame = 0;

  function setActiveWidget(index) {
    widgetButtons.forEach((button) => {
      const active = Number(button.dataset.widget) === index;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function scrollToWidget(index, { smooth = true } = {}) {
    if (!bento || !widgetPanels[index]) return;
    const bentoRect = bento.getBoundingClientRect();
    const panelRect = widgetPanels[index].getBoundingClientRect();
    bento.scrollTo({
      left: bento.scrollLeft + panelRect.left - bentoRect.left,
      behavior: smooth && !reduceMotionQuery.matches ? "smooth" : "auto",
    });
    setActiveWidget(index);
  }

  function updateActiveWidgetFromScroll() {
    if (!bento) return;
    const edge = bento.getBoundingClientRect().left;
    let nearest = 0;
    let distance = Infinity;
    widgetPanels.forEach((panel, index) => {
      if (!panel) return;
      const nextDistance = Math.abs(panel.getBoundingClientRect().left - edge);
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    setActiveWidget(nearest);
  }

  bento?.addEventListener("scroll", () => {
    if (widgetScrollFrame) return;
    widgetScrollFrame = window.requestAnimationFrame(() => {
      widgetScrollFrame = 0;
      updateActiveWidgetFromScroll();
    });
  }, { passive: true });

  widgetSwitcher?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-widget]");
    if (!button) return;
    scrollToWidget(Number(button.dataset.widget));
  });

  // Placeholder — notes are declared below, so focus helpers run after init.
  function persistNotes() {
    writeJSON(KEYS.notes, notes);
    if (!saveState) return;
    saveState.classList.add("is-saving");
    saveState.lastChild.textContent = "正在保存";
    window.clearTimeout(saveStateTimer);
    saveStateTimer = window.setTimeout(() => {
      saveState.classList.remove("is-saving");
      saveState.lastChild.textContent = "自动保存在此设备";
    }, 1100);
  }

  function renderNotes() {
    if (!noteList) return;
    noteList.innerHTML = "";
    const doneCount = notes.filter((note) => note.done).length;

    notes.forEach((note) => {
      const item = document.createElement("li");
      item.className = `note-item${note.done ? " is-done" : ""}`;
      item.dataset.id = note.id;

      const check = document.createElement("button");
      check.type = "button";
      check.className = "note-check";
      check.setAttribute("aria-label", note.done ? `将「${note.text}」标记为未完成` : `完成「${note.text}」`);
      check.setAttribute("aria-pressed", note.done ? "true" : "false");
      check.innerHTML = '<svg aria-hidden="true"><use href="#i-check"/></svg>';

      const text = document.createElement("span");
      text.className = "note-text";
      text.textContent = note.text;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "note-delete";
      remove.setAttribute("aria-label", `删除备忘「${note.text}」`);
      remove.innerHTML = '<svg aria-hidden="true"><use href="#i-x"/></svg>';

      check.addEventListener("click", () => toggleNote(note.id));
      remove.addEventListener("click", () => deleteNote(note.id));

      item.append(check, text, remove);
      noteList.appendChild(item);
    });

    if (notesCount) notesCount.textContent = `${notes.length} 条`;
    if (noteEmpty) noteEmpty.hidden = notes.length > 0;
    if (clearDoneBtn) {
      clearDoneBtn.disabled = doneCount === 0;
      clearDoneBtn.textContent = doneCount > 0 ? `清除已完成 · ${doneCount}` : "清除已完成";
    }
  }

  function addNote(text) {
    const clean = text.trim();
    if (!clean) {
      noteForm?.classList.remove("is-shaking");
      void noteForm?.offsetWidth;
      noteForm?.classList.add("is-shaking");
      noteInput?.focus();
      return false;
    }

    notes.unshift({ id: makeId("note"), text: clean.slice(0, 90), done: false });
    persistNotes();
    renderNotes();
    if (noteList) noteList.scrollTop = 0;
    return true;
  }

  function toggleNote(id) {
    const note = notes.find((entry) => entry.id === id);
    if (!note) return;
    note.done = !note.done;
    persistNotes();
    renderNotes();
  }

  function deleteNote(id) {
    const index = notes.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const removed = notes[index];
    const row = noteList?.querySelector(`.note-item[data-id="${CSS.escape(id)}"]`);
    if (row) row.classList.add("is-removing");

    window.setTimeout(() => {
      notes = notes.filter((entry) => entry.id !== id);
      persistNotes();
      renderNotes();
      showToast("备忘已删除", {
        icon: "i-note",
        actionLabel: "撤销",
        onAction: () => {
          notes.splice(Math.min(index, notes.length), 0, removed);
          persistNotes();
          renderNotes();
        },
      });
    }, 180);
  }

  noteForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!noteInput) return;
    if (addNote(noteInput.value)) {
      noteInput.value = "";
      noteInput.focus();
    }
  });

  clearDoneBtn?.addEventListener("click", () => {
    const done = notes.filter((note) => note.done);
    if (!done.length) return;
    const snapshot = notes.slice();
    notes = notes.filter((note) => !note.done);
    persistNotes();
    renderNotes();
    showToast(`已清除 ${done.length} 条完成的备忘`, {
      icon: "i-check",
      actionLabel: "撤销",
      onAction: () => {
        notes = snapshot;
        persistNotes();
        renderNotes();
      },
    });
  });

  function focusNotesWidget() {
    if (window.matchMedia("(max-width: 880px)").matches) {
      scrollToWidget(0);
      window.setTimeout(() => noteInput?.focus({ preventScroll: true }), 340);
    } else {
      noteInput?.focus({ preventScroll: true });
    }
  }

  /* ---------------------------------------------------------
     08 · Focus timer
     --------------------------------------------------------- */
  const timerDial = $("#timerDial");
  const timerProgress = $("#timerProgress");
  const timerDisplay = $("#timerDisplay");
  const timerPhase = $("#timerPhase");
  const focusToggle = $("#focusToggle");
  const focusToggleLabel = $("#focusToggleLabel");
  const focusReset = $("#focusReset");
  const focusLine = $("#focusLine");
  const focusSessions = $("#focusSessions");
  const durationSwitch = $("#durationSwitch");
  const RING_LENGTH = 2 * Math.PI * 53;

  let focusStats = readJSON(KEYS.focus, {});
  if (!focusStats || typeof focusStats !== "object") focusStats = {};
  const allowedDurations = [25, 45, 60];
  let focusDuration = allowedDurations.includes(Number(focusStats.duration)) ? Number(focusStats.duration) : 25;
  let focusCount = focusStats.date === todayKey() && Number.isFinite(Number(focusStats.count))
    ? Math.max(0, Number(focusStats.count))
    : 0;
  let focusTotal = focusDuration * 60;
  let focusRemaining = focusTotal;
  let focusRunning = false;
  let focusEndsAt = 0;
  let focusTicker = 0;
  let focusCompletedThisRun = false;

  function formatFocusTime(seconds) {
    const safe = Math.max(0, Math.round(seconds));
    return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
  }

  function ensureFocusDay() {
    if (focusStats.date !== todayKey()) {
      focusStats = { date: todayKey(), count: 0, duration: focusDuration };
      focusCount = 0;
      writeJSON(KEYS.focus, focusStats);
    }
  }

  function persistFocusStats() {
    focusStats = { date: todayKey(), count: focusCount, duration: focusDuration };
    writeJSON(KEYS.focus, focusStats);
  }

  function renderFocus() {
    const ratio = focusTotal > 0 ? focusRemaining / focusTotal : 0;
    if (timerProgress) {
      timerProgress.style.strokeDashoffset = String(RING_LENGTH * (1 - ratio));
    }
    if (timerDisplay) timerDisplay.textContent = formatFocusTime(focusRemaining);
    if (timerPhase) {
      if (focusRunning) timerPhase.textContent = "FOCUS";
      else if (focusRemaining === 0) timerPhase.textContent = "DONE";
      else if (focusRemaining < focusTotal) timerPhase.textContent = "PAUSED";
      else timerPhase.textContent = "FOCUS";
    }

    if (timerDial) timerDial.classList.toggle("is-running", focusRunning);
    if (focusToggle) {
      focusToggle.classList.toggle("is-running", focusRunning);
      if (focusToggleLabel) {
        if (focusRunning) focusToggleLabel.textContent = "暂停一下";
        else if (focusRemaining === 0) focusToggleLabel.textContent = "再来一轮";
        else if (focusRemaining < focusTotal) focusToggleLabel.textContent = "继续专注";
        else focusToggleLabel.textContent = "开始专注";
      }
    }

    if (focusLine) {
      if (focusRunning) focusLine.innerHTML = "只在此刻，<br>只做此事。";
      else if (focusRemaining < focusTotal && focusRemaining > 0) focusLine.innerHTML = "留一点余白，<br>再继续。";
      else focusLine.innerHTML = "一次只做<br>一件事。";
    }
    if (focusSessions) focusSessions.textContent = `今日 ${focusCount} 轮`;

    $$("#durationSwitch button").forEach((button) => {
      const active = Number(button.dataset.minutes) === focusDuration;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    document.title = focusRunning ? `${formatFocusTime(focusRemaining)} · 专注中` : "LUMEN · 光屿";
  }

  function clearFocusTicker() {
    if (focusTicker) {
      window.clearInterval(focusTicker);
      focusTicker = 0;
    }
  }

  function startFocus() {
    if (focusRunning) return;
    if (focusRemaining <= 0) {
      focusRemaining = focusTotal;
      focusCompletedThisRun = false;
    }
    focusRunning = true;
    focusEndsAt = Date.now() + focusRemaining * 1000;
    clearFocusTicker();
    focusTicker = window.setInterval(tickFocus, 250);
    renderFocus();
  }

  function pauseFocus() {
    if (!focusRunning) return;
    focusRemaining = Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000));
    focusRunning = false;
    clearFocusTicker();
    renderFocus();
  }

  function tickFocus() {
    if (!focusRunning) return;
    const next = Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000));
    if (next !== focusRemaining) {
      focusRemaining = next;
      if (focusRemaining > 0) renderFocus();
    }
    if (focusRemaining <= 0) completeFocus();
  }

  function completeFocus() {
    if (focusCompletedThisRun) return;
    focusCompletedThisRun = true;
    focusRunning = false;
    clearFocusTicker();
    focusRemaining = 0;
    ensureFocusDay();
    focusCount += 1;
    persistFocusStats();
    renderFocus();
    playChime();
    showToast("这一段专注完成了，给自己一点掌声。", { icon: "i-spark", duration: 4800 });
  }

  function resetFocus() {
    clearFocusTicker();
    focusRunning = false;
    focusRemaining = focusTotal;
    focusCompletedThisRun = false;
    renderFocus();
  }

  function setFocusDuration(minutes) {
    if (!allowedDurations.includes(Number(minutes))) return;
    focusDuration = Number(minutes);
    focusTotal = focusDuration * 60;
    clearFocusTicker();
    focusRunning = false;
    focusRemaining = focusTotal;
    focusCompletedThisRun = false;
    persistFocusStats();
    renderFocus();
  }

  focusToggle?.addEventListener("click", () => {
    ensureFocusDay();
    if (focusRunning) pauseFocus();
    else startFocus();
  });

  focusReset?.addEventListener("click", resetFocus);

  durationSwitch?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-minutes]");
    if (!button) return;
    setFocusDuration(button.dataset.minutes);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && focusRunning) tickFocus();
  });

  function focusFocusWidget() {
    if (window.matchMedia("(max-width: 880px)").matches) {
      scrollToWidget(1);
    }
    if (!focusRunning) startFocus();
    else showToast("专注正在进行中，保持此刻。", { icon: "i-target" });
  }

  if (focusProgressInitNeeded()) {
    renderFocus();
  }

  function focusProgressInitNeeded() {
    if (timerProgress) timerProgress.style.strokeDasharray = String(RING_LENGTH);
    if (focusStats.date !== todayKey()) {
      ensureFocusDay();
    }
    focusDuration = allowedDurations.includes(Number(focusStats.duration)) ? Number(focusStats.duration) : focusDuration;
    focusTotal = focusDuration * 60;
    focusRemaining = focusTotal;
    return true;
  }

  /* ---------------------------------------------------------
     09 · Weather
     --------------------------------------------------------- */
  const WEATHER_CITIES = [
    {
      id: "beijing", name: "北京", latitude: 39.9042, longitude: 116.4074,
      fallback: { temp: 19, desc: "晴间多云", kind: "partly", high: 23, low: 13, isDay: false },
    },
    {
      id: "shanghai", name: "上海", latitude: 31.2304, longitude: 121.4737,
      fallback: { temp: 21, desc: "多云", kind: "cloudy", high: 24, low: 16, isDay: false },
    },
    {
      id: "chengdu", name: "成都", latitude: 30.5728, longitude: 104.0668,
      fallback: { temp: 17, desc: "阴", kind: "cloudy", high: 20, low: 14, isDay: false },
    },
    {
      id: "shenzhen", name: "深圳", latitude: 22.5431, longitude: 114.0579,
      fallback: { temp: 26, desc: "阵雨", kind: "rain", high: 29, low: 23, isDay: false },
    },
  ];

  const weatherCard = $("#weatherCard");
  const weatherCity = $("#weatherCity");
  const weatherTemp = $("#weatherTemp");
  const weatherDesc = $("#weatherDesc");
  const weatherRange = $("#weatherRange");
  const weatherArt = $("#weatherArt");

  let weatherCityIndex = Number(readJSON(KEYS.weatherCity, 0));
  if (!Number.isInteger(weatherCityIndex) || weatherCityIndex < 0 || weatherCityIndex >= WEATHER_CITIES.length) {
    weatherCityIndex = 0;
  }
  let weatherRequest = 0;
  let weatherData = null;

  function weatherKindFromCode(code) {
    if (code === 0) return { desc: "晴朗", kind: "clear" };
    if (code === 1 || code === 2) return { desc: "晴间多云", kind: "partly" };
    if (code === 3) return { desc: "多云", kind: "cloudy" };
    if (code === 45 || code === 48) return { desc: "有雾", kind: "fog" };
    if (code >= 51 && code <= 57) return { desc: "细雨", kind: "rain" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { desc: "有雨", kind: "rain" };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { desc: "飘雪", kind: "snow" };
    if (code >= 95) return { desc: "雷阵雨", kind: "storm" };
    return { desc: "多云", kind: "cloudy" };
  }

  function weatherArtMarkup(kind) {
    const drops = kind === "rain"
      ? '<span class="w-drop"></span><span class="w-drop"></span><span class="w-drop"></span>'
      : "";
    const snow = kind === "snow"
      ? '<span class="w-drop"></span><span class="w-drop"></span><span class="w-drop"></span>'
      : "";
    const bolt = kind === "storm" ? '<span class="w-bolt"></span>' : "";
    const fog = kind === "fog" ? '<span class="w-fog"></span>' : "";
    return `
      <span class="w-sun"></span>
      <span class="w-cloud w-cloud--back"></span>
      <span class="w-cloud"></span>
      ${drops}${snow}${bolt}${fog}
    `;
  }

  function updateWeatherView(data) {
    if (!data) return;
    if (weatherCity) weatherCity.textContent = data.city.name;
    if (weatherTemp) weatherTemp.textContent = String(Math.round(data.temp));
    if (weatherDesc) weatherDesc.textContent = data.desc;
    if (weatherRange) weatherRange.textContent = `最高 ${Math.round(data.high)}° · 最低 ${Math.round(data.low)}°`;
    if (weatherArt) {
      weatherArt.dataset.icon = data.kind;
      weatherArt.classList.toggle("is-night", !data.isDay);
      weatherArt.innerHTML = weatherArtMarkup(data.kind);
    }
    if (weatherCard) {
      weatherCard.setAttribute("aria-label", `${data.city.name}，${data.desc}，${Math.round(data.temp)} 度。点击切换城市`);
    }
  }

  function applyWeatherFallback(city) {
    const isDay = new Date().getHours() >= 6 && new Date().getHours() < 18;
    return {
      city,
      temp: city.fallback.temp,
      desc: city.fallback.desc,
      high: city.fallback.high,
      low: city.fallback.low,
      kind: city.fallback.kind,
      isDay,
    };
  }

  async function loadWeather(city) {
    const requestId = ++weatherRequest;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(city.latitude));
    url.searchParams.set("longitude", String(city.longitude));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    url.searchParams.set("timezone", "Asia/Shanghai");
    url.searchParams.set("forecast_days", "1");

    try {
      const response = await fetch(url.toString(), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("weather-request-failed");
      const payload = await response.json();
      if (requestId !== weatherRequest) return;
      const current = payload.current || {};
      const daily = payload.daily || {};
      const mapped = weatherKindFromCode(Number(current.weather_code));
      const data = {
        city,
        temp: Number(current.temperature_2m),
        desc: mapped.desc,
        kind: mapped.kind,
        high: Number(daily.temperature_2m_max?.[0]),
        low: Number(daily.temperature_2m_min?.[0]),
        isDay: Boolean(Number(current.is_day)),
      };
      if (!Number.isFinite(data.temp) || !Number.isFinite(data.high) || !Number.isFinite(data.low)) {
        throw new Error("weather-data-invalid");
      }
      weatherData = data;
      updateWeatherView(data);
    } catch (error) {
      if (requestId === weatherRequest) {
        const fallback = applyWeatherFallback(city);
        weatherData = fallback;
        updateWeatherView(fallback);
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function selectWeatherCity(index) {
    weatherCityIndex = (index + WEATHER_CITIES.length) % WEATHER_CITIES.length;
    writeJSON(KEYS.weatherCity, weatherCityIndex);
    const city = WEATHER_CITIES[weatherCityIndex];
    const fallback = applyWeatherFallback(city);
    updateWeatherView(fallback);
    loadWeather(city);
  }

  weatherCard?.addEventListener("click", () => {
    selectWeatherCity(weatherCityIndex + 1);
  });

  /* ---------------------------------------------------------
     10 · Ambient sea sound + chime
     --------------------------------------------------------- */
  const soundToggle = $("#soundToggle");
  const soundTag = $("#soundTag");
  const soundSub = $("#soundSub");
  let audioContext = null;
  let ocean = null;
  let soundPlaying = false;
  let soundFadeTimer = 0;

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("audio-unavailable");
      audioContext = new AudioContextClass();
    }
    return audioContext;
  }

  function makeNoiseBuffer(context, seconds, brown = true) {
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.018 * white) / 1.018;
        data[i] = last * 3.1;
      } else {
        data[i] = white * 0.42;
      }
    }
    return buffer;
  }

  function createOceanAudio() {
    const context = getAudioContext();
    const master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(context.destination);

    const sea = context.createBufferSource();
    sea.buffer = makeNoiseBuffer(context, 7.5, true);
    sea.loop = true;

    const seaFilter = context.createBiquadFilter();
    seaFilter.type = "lowpass";
    seaFilter.frequency.value = 540;
    seaFilter.Q.value = 0.7;

    const seaGain = context.createGain();
    seaGain.gain.value = 0.062;

    sea.connect(seaFilter);
    seaFilter.connect(seaGain);
    seaGain.connect(master);

    const swell = context.createOscillator();
    swell.type = "sine";
    swell.frequency.value = 0.075;
    const swellDepth = context.createGain();
    swellDepth.gain.value = 0.026;
    swell.connect(swellDepth);
    swellDepth.connect(seaGain.gain);
    swell.start();

    const filterSwell = context.createOscillator();
    filterSwell.type = "sine";
    filterSwell.frequency.value = 0.043;
    const filterSwellDepth = context.createGain();
    filterSwellDepth.gain.value = 280;
    filterSwell.connect(filterSwellDepth);
    filterSwellDepth.connect(seaFilter.frequency);
    filterSwell.start();

    const foam = context.createBufferSource();
    foam.buffer = makeNoiseBuffer(context, 5.5, false);
    foam.loop = true;

    const foamFilter = context.createBiquadFilter();
    foamFilter.type = "bandpass";
    foamFilter.frequency.value = 1250;
    foamFilter.Q.value = 0.55;

    const foamGain = context.createGain();
    foamGain.gain.value = 0.0058;
    foam.connect(foamFilter);
    foamFilter.connect(foamGain);
    foamGain.connect(master);

    const foamSwell = context.createOscillator();
    foamSwell.type = "sine";
    foamSwell.frequency.value = 0.11;
    const foamSwellDepth = context.createGain();
    foamSwellDepth.gain.value = 120;
    foamSwell.connect(foamSwellDepth);
    foamSwellDepth.connect(foamFilter.frequency);
    foamSwell.start();

    sea.start();
    foam.start();

    return { context, master, sources: [sea, foam, swell, filterSwell, foamSwell] };
  }

  function setSoundUI(playing) {
    if (soundToggle) {
      soundToggle.classList.toggle("is-playing", playing);
      soundToggle.setAttribute("aria-pressed", playing ? "true" : "false");
    }
    if (soundTag) soundTag.textContent = playing ? "ON" : "OFF";
    if (soundSub) soundSub.textContent = playing ? "正在轻轻拍岸" : "让思绪慢下来";
  }

  async function toggleOceanSound() {
    try {
      if (!ocean) ocean = createOceanAudio();
      const context = ocean.context;
      await context.resume();
      window.clearTimeout(soundFadeTimer);
      const now = context.currentTime;
      const gain = ocean.master.gain;
      gain.cancelScheduledValues(now);

      if (soundPlaying) {
        gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
        gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
        soundPlaying = false;
        setSoundUI(false);
      } else {
        gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
        gain.exponentialRampToValueAtTime(0.66, now + 2.2);
        soundPlaying = true;
        setSoundUI(true);
      }
    } catch (error) {
      showToast("这台设备暂时无法播放环境音。", { icon: "i-info" });
    }
  }

  soundToggle?.addEventListener("click", toggleOceanSound);

  function playChime() {
    try {
      const context = getAudioContext();
      context.resume();
      const now = context.currentTime;
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        const start = now + index * 0.13;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 1.9);
      });
    } catch (error) {
      /* A chime is a bonus, not a requirement. */
    }
  }

  /* ---------------------------------------------------------
     11 · Dock
     --------------------------------------------------------- */
  const DEFAULT_DOCK = [
    { id: "app-chrome", type: "chrome", name: "Chrome", url: "https://www.google.com/" },
    { id: "app-gmail", type: "gmail", name: "Gmail", url: "https://mail.google.com/" },
    { id: "app-calendar", type: "calendar", name: "日历", url: "https://calendar.google.com/" },
    { id: "app-youtube", type: "youtube", name: "YouTube", url: "https://www.youtube.com/" },
    { id: "app-figma", type: "figma", name: "Figma", url: "https://www.figma.com/" },
    { id: "app-notion", type: "notion", name: "Notion", url: "https://www.notion.so/" },
    { id: "app-github", type: "github", name: "GitHub", url: "https://github.com/" },
    { id: "app-spotify", type: "spotify", name: "Spotify", url: "https://open.spotify.com/" },
  ];

  const APP_COLORS = {
    sunset: ["#ffb66e", "#d86860"],
    ocean: ["#6bd5d1", "#4d7dd8"],
    violet: ["#c5a6ff", "#7359d8"],
    forest: ["#a8d7a8", "#4f9372"],
    rose: ["#ffb9c6", "#ce6e91"],
    graphite: ["#9aa5b4", "#424b59"],
  };

  const DEFAULT_APP_TYPES = new Set(DEFAULT_DOCK.map((app) => app.type));
  const dock = $("#dock");
  const dockTrack = $("#dockTrack");
  const dockTooltip = $("#dockTooltip");
  const dockAdd = $("#addAppBtn");
  const dockMenu = $("#dockMenu");
  const dockMenuTitle = $("#dockMenuTitle");
  const dockMenuOpen = $("#dockMenuOpen");
  const dockMenuRemove = $("#dockMenuRemove");
  let dockApps = loadDock();
  let dockMenuApp = null;

  function loadDock() {
    const raw = readJSON(KEYS.dock, null);
    if (!Array.isArray(raw)) return DEFAULT_DOCK.map((app) => ({ ...app }));

    const clean = [];
    raw.slice(0, 12).forEach((app) => {
      if (!app || typeof app !== "object") return;
      const name = String(app.name || "").trim().slice(0, 18);
      const url = normalizeUrl(app.url);
      if (!name || !url) return;

      if (DEFAULT_APP_TYPES.has(app.type)) {
        const known = DEFAULT_DOCK.find((entry) => entry.type === app.type);
        if (!known) return;
        clean.push({
          id: String(app.id || known.id),
          type: known.type,
          name,
          url,
        });
      } else if (app.type === "custom") {
        const color = APP_COLORS[app.color] ? app.color : "sunset";
        clean.push({
          id: String(app.id || makeId("app")),
          type: "custom",
          name,
          url,
          color,
          glyph: String(app.glyph || Array.from(name)[0] || "·").slice(0, 2),
        });
      }
    });

    return clean;
  }

  function persistDock() {
    return writeJSON(KEYS.dock, dockApps);
  }

  function dockIconMarkup(app) {
    if (app.type === "custom") {
      return '<span class="custom-glyph" aria-hidden="true"></span><span class="sr-only">自定义快捷方式</span>';
    }

    if (app.type === "calendar") {
      const now = new Date();
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      return `<span class="cal-top">${months[now.getMonth()]}</span><span class="cal-day">${now.getDate()}</span>`;
    }

    if (app.type === "gmail") {
      return `
        <span class="dock-art" aria-hidden="true">
          <span class="gmail-logo">
            <svg viewBox="0 0 32 24">
              <rect x="1.4" y="2.4" width="29.2" height="19.2" rx="3.4" fill="#fff" stroke="#EA4335" stroke-width="1.7" stroke-linejoin="round"/>
              <path d="M4 6.2 16 15l12-8.8" fill="none" stroke="#EA4335" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </span>
      `;
    }

    if (app.type === "figma") {
      return `
        <span class="dock-art" aria-hidden="true">
          <span class="figma-logo">
            <svg viewBox="0 0 38 56">
              <path fill="#F24E1E" d="M9.5 0H19v18.7H9.5a9.35 9.35 0 0 1 0-18.7Z"/>
              <path fill="#FF7262" d="M19 0h9.5a9.35 9.35 0 0 1 0 18.7H19V0Z"/>
              <path fill="#A259FF" d="M9.5 18.7H19v18.6H9.5a9.3 9.3 0 0 1 0-18.6Z"/>
              <path fill="#1ABCFE" d="M19 27.95a9.3 9.3 0 1 1 18.6 0 9.3 9.3 0 0 1-18.6 0Z"/>
              <path fill="#0ACF83" d="M9.5 37.3H19v9.3a9.3 9.3 0 1 1-9.5-9.3Z"/>
            </svg>
          </span>
        </span>
      `;
    }

    if (app.type === "notion") {
      return '<span class="dock-art" aria-hidden="true"><span class="notion-mark">N</span></span>';
    }

    if (app.type === "github") {
      return `
        <span class="dock-art" aria-hidden="true">
          <span class="github-logo">
            <svg viewBox="0 0 24 24">
              <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.6 11.6 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"/>
            </svg>
          </span>
        </span>
      `;
    }

    if (app.type === "spotify") {
      return `
        <span class="dock-art" aria-hidden="true">
          <span class="spotify-logo">
            <svg viewBox="0 0 24 24">
              <path d="M6 9.1c4.2-1.25 8.1-.8 11.8 1.15" fill="none" stroke-linecap="round"/>
              <path d="M6.7 12.5c3.3-1 6.7-.6 9.7 1.1" fill="none" stroke-linecap="round"/>
              <path d="M7.5 15.8c2.7-.75 5.2-.4 7.7 1" fill="none" stroke-linecap="round"/>
            </svg>
          </span>
        </span>
      `;
    }

    if (app.type === "youtube") {
      return '<span class="dock-art" aria-hidden="true"><span class="youtube-logo"></span></span>';
    }

    if (app.type === "chrome") {
      return '<span class="dock-art" aria-hidden="true"><span class="chrome-logo"></span></span>';
    }

    return "";
  }

  function renderDock() {
    if (!dockTrack || !dock) return;
    dockTrack.innerHTML = "";

    if (!dockApps.length) {
      const empty = document.createElement("span");
      empty.className = "dock-empty";
      empty.textContent = "程序坞空空的 · 点击加号添加";
      dockTrack.appendChild(empty);
    }

    dockApps.forEach((app) => {
      const item = document.createElement("div");
      item.className = "dock-item";
      item.dataset.appId = app.id;
      item.dataset.name = app.name;

      const link = document.createElement("a");
      link.className = "dock-link";
      link.href = app.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${app.name}，在新标签页打开`);

      const appIcon = document.createElement("span");
      appIcon.className = `dock-app dock-app--${app.type}`;
      appIcon.innerHTML = dockIconMarkup(app);

      if (app.type === "custom") {
        const [start, end] = APP_COLORS[app.color] || APP_COLORS.sunset;
        appIcon.style.setProperty("--app-a", start);
        appIcon.style.setProperty("--app-b", end);
        const glyph = $(".custom-glyph", appIcon);
        if (glyph) glyph.textContent = app.glyph || Array.from(app.name)[0] || "·";
      }

      link.appendChild(appIcon);
      item.appendChild(link);
      dockTrack.appendChild(item);

      link.addEventListener("click", () => {
        item.classList.remove("is-launching");
        void item.offsetWidth;
        item.classList.add("is-launching");
        window.setTimeout(() => item.classList.remove("is-launching"), 560);
        closeDockMenu();
      });

      link.addEventListener("focus", () => showDockTooltip(item));
      link.addEventListener("blur", () => {
        if (!dockHoveredItem) hideDockTooltip();
      });

      item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openDockMenu(app, event.clientX, event.clientY);
      });
    });

    fitDock();
    updateCalendarDock();
  }

  function persistAndRenderDock() {
    persistDock();
    renderDock();
  }

  function removeDockApp(id) {
    const index = dockApps.findIndex((app) => app.id === id);
    if (index < 0) return;
    const removed = dockApps[index];
    closeDockMenu();
    dockApps = dockApps.filter((app) => app.id !== id);
    persistAndRenderDock();
    showToast(`已移除「${removed.name}」`, {
      icon: "i-info",
      actionLabel: "撤销",
      onAction: () => {
        dockApps.splice(Math.min(index, dockApps.length), 0, removed);
        persistAndRenderDock();
      },
    });
  }

  /* Dock magnification -------------------------------------- */
  let dockFrame = 0;
  let dockHoveredItem = null;

  function leftWithin(element, ancestor) {
    let x = 0;
    let node = element;
    while (node && node !== ancestor) {
      x += node.offsetLeft || 0;
      node = node.offsetParent;
    }
    return x;
  }

  function resetDockTransforms() {
    $$(".dock-item, .dock-add", dock).forEach((item) => {
      item.style.transform = "";
    });
    hideDockTooltip();
  }

  function showDockTooltip(item) {
    if (!dockTooltip || !item) return;
    const label = item === dockAdd ? "添加应用" : item.dataset.name || "";
    if (!label) return;
    dockTooltip.textContent = label;
    dockTooltip.classList.add("is-visible");
    dockTooltip.setAttribute("aria-hidden", "false");

    const dockRect = dock.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const tooltipWidth = dockTooltip.offsetWidth;
    const center = itemRect.left - dockRect.left + itemRect.width / 2;
    const min = tooltipWidth / 2 + 7;
    const max = dockRect.width - tooltipWidth / 2 - 7;
    dockTooltip.style.left = `${clamp(center, min, max)}px`;
  }

  function hideDockTooltip() {
    if (!dockTooltip) return;
    dockTooltip.classList.remove("is-visible");
    dockTooltip.setAttribute("aria-hidden", "true");
    dockHoveredItem = null;
  }

  function onDockPointerMove(event) {
    if (event.pointerType === "touch") return;
    const hovered = event.target.closest?.(".dock-item, .dock-add") || null;
    if (hovered !== dockHoveredItem) {
      dockHoveredItem = hovered;
      if (hovered) showDockTooltip(hovered);
      else hideDockTooltip();
    } else if (hovered) {
      showDockTooltip(hovered);
    }

    if (!settings.dockMagnify || reduceMotionQuery.matches) {
      resetDockTransforms();
      if (hovered) showDockTooltip(hovered);
      return;
    }
    if (dockFrame) return;
    dockFrame = window.requestAnimationFrame(() => {
      dockFrame = 0;
      magnifyDock(event.clientX);
    });
  }

  function magnifyDock(pointerClientX) {
    if (!dock || !settings.dockMagnify) return;
    const entries = [...$$(".dock-item", dockTrack), dockAdd].filter(Boolean);
    if (!entries.length) return;

    const dockRect = dock.getBoundingClientRect();
    const pointerX = pointerClientX - dockRect.left;
    const centers = entries.map((entry) => leftWithin(entry, dock) + entry.offsetWidth / 2);
    const baseSize = entries[0].offsetWidth || 44;
    const sigma = Math.max(44, baseSize * 1.12);

    const scales = centers.map((center) => {
      const distance = (pointerX - center) / sigma;
      return 1 + 0.56 * Math.exp(-0.5 * distance * distance);
    });

    const extras = scales.map((scale, index) => entries[index].offsetWidth * (scale - 1));
    const totalExtra = extras.reduce((sum, extra) => sum + extra, 0);
    let consumed = 0;

    entries.forEach((entry, index) => {
      const scale = scales[index];
      const extra = extras[index];
      const shift = -totalExtra / 2 + consumed + extra / 2;
      const lift = -(scale - 1) * entry.offsetHeight * 0.6;
      entry.style.transform = `translate3d(${shift.toFixed(2)}px, ${lift.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
      consumed += extra;
    });

    if (dockHoveredItem && dockHoveredItem.isConnected) showDockTooltip(dockHoveredItem);
  }

  dock?.addEventListener("pointermove", onDockPointerMove);
  dock?.addEventListener("pointerleave", () => {
    hideDockTooltip();
    resetDockTransforms();
  });
  dock?.addEventListener("pointercancel", resetDockTransforms);

  function fitDock() {
    if (!dock) return;
    dock.style.removeProperty("--dock-size");
    dock.style.removeProperty("--dock-gap");
    resetDockTransforms();

    const available = Math.max(286, window.innerWidth - 20);
    let width = dock.getBoundingClientRect().width;
    if (width <= available) return;

    const computed = getComputedStyle(dock);
    let baseSize = parseFloat(computed.getPropertyValue("--dock-size")) || 44;
    let baseGap = parseFloat(computed.getPropertyValue("--dock-gap")) || 8;

    for (let attempt = 0; attempt < 6 && width > available; attempt += 1) {
      const ratio = Math.max(0.9, Math.min(0.985, available / width));
      baseSize = Math.max(24, baseSize * ratio);
      baseGap = Math.max(1.4, baseGap * ratio);
      dock.style.setProperty("--dock-size", `${baseSize.toFixed(2)}px`);
      dock.style.setProperty("--dock-gap", `${baseGap.toFixed(2)}px`);
      width = dock.getBoundingClientRect().width;
    }
  }

  /* Dock context menu --------------------------------------- */
  function openDockMenu(app, x, y) {
    if (!dockMenu) return;
    dockMenuApp = app;
    closeSearchPopoverIfOpen();
    dockMenuTitle.textContent = app.name;
    dockMenu.hidden = false;
    const rect = dockMenu.getBoundingClientRect();
    const left = clamp(x, 8, window.innerWidth - rect.width - 8);
    const top = clamp(y, 8, window.innerHeight - rect.height - 8);
    dockMenu.style.left = `${left}px`;
    dockMenu.style.top = `${top}px`;
    dockMenuOpen.focus({ preventScroll: true });
  }

  function closeDockMenu({ restoreFocus = false } = {}) {
    if (!dockMenu || dockMenu.hidden) return;
    const item = dockMenuApp ? dockTrack?.querySelector(`.dock-item[data-app-id="${CSS.escape(dockMenuApp.id)}"] .dock-link`) : null;
    dockMenu.hidden = true;
    dockMenuApp = null;
    if (restoreFocus && item) item.focus({ preventScroll: true });
  }

  function closeSearchPopoverIfOpen() {
    if (popoverOpen) closePopover();
  }

  dockMenuOpen?.addEventListener("click", () => {
    if (dockMenuApp) openExternal(dockMenuApp.url);
    closeDockMenu();
  });

  dockMenuRemove?.addEventListener("click", () => {
    if (dockMenuApp) removeDockApp(dockMenuApp.id);
  });

  dockMenu?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDockMenu({ restoreFocus: true });
    }
  });

  /* Dock — add app dialog -------------------------------- */
  const appDialog = $("#appDialog");
  const appForm = $("#appForm");
  const appNameInput = $("#appNameInput");
  const appUrlInput = $("#appUrlInput");
  const appFormError = $("#appFormError");
  const appSwatches = $("#appSwatches");
  let selectedAppColor = "sunset";

  function resetAppForm() {
    if (!appForm) return;
    appForm.reset();
    appFormError.textContent = "";
    appNameInput?.classList.remove("is-invalid");
    appUrlInput?.classList.remove("is-invalid");
    selectedAppColor = "sunset";
    $$(".swatch", appSwatches || document).forEach((swatch) => {
      const active = swatch.dataset.color === selectedAppColor;
      swatch.classList.toggle("is-active", active);
      swatch.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function openAppDialog() {
    closeDockMenu();
    closePopover();
    resetAppForm();
    if (typeof appDialog?.showModal === "function") {
      appDialog.showModal();
      window.setTimeout(() => appNameInput?.focus({ preventScroll: true }), 50);
    }
  }

  function closeAppDialog() {
    if (appDialog?.open) appDialog.close();
  }

  dockAdd?.addEventListener("click", openAppDialog);
  $("#appDialogClose")?.addEventListener("click", closeAppDialog);
  $("#appCancel")?.addEventListener("click", closeAppDialog);

  appSwatches?.addEventListener("click", (event) => {
    const swatch = event.target.closest(".swatch");
    if (!swatch) return;
    selectedAppColor = swatch.dataset.color;
    $$(".swatch", appSwatches).forEach((item) => {
      const active = item === swatch;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
    });
  });

  appForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = appNameInput?.value.trim() || "";
    const rawUrl = appUrlInput?.value.trim() || "";
    const url = normalizeUrl(rawUrl);

    appNameInput?.classList.toggle("is-invalid", !name);
    appUrlInput?.classList.toggle("is-invalid", !url);

    if (!name) {
      appFormError.textContent = "给这个入口取一个名字吧。";
      appNameInput?.focus();
      return;
    }
    if (!url) {
      appFormError.textContent = "请输入有效的网页地址，例如 https://example.com";
      appUrlInput?.focus();
      return;
    }
    if (dockApps.length >= 12) {
      appFormError.textContent = "程序坞已经住满 12 个应用了。";
      return;
    }

    const app = {
      id: makeId("custom"),
      type: "custom",
      name: name.slice(0, 18),
      url,
      color: selectedAppColor,
      glyph: Array.from(name)[0] || "·",
    };
    dockApps.push(app);
    persistAndRenderDock();
    closeAppDialog();
    showToast(`「${app.name}」已经加入程序坞。`, { icon: "i-spark" });
  });

  if (appDialog) {
    appDialog.addEventListener("click", (event) => {
      if (event.target !== appDialog) return;
      const rect = appDialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeAppDialog();
    });
    appDialog.addEventListener("close", resetAppForm);
  }

  appNameInput?.addEventListener("input", () => {
    appNameInput.classList.remove("is-invalid");
    if (appFormError) appFormError.textContent = "";
  });
  appUrlInput?.addEventListener("input", () => {
    appUrlInput.classList.remove("is-invalid");
    if (appFormError) appFormError.textContent = "";
  });

  /* ---------------------------------------------------------
     12 · Settings drawer
     --------------------------------------------------------- */
  const settingsDrawer = $("#settingsDrawer");
  const settingsOpen = $("#settingsOpen");
  const settingsClose = $("#settingsClose");
  const settingsDone = $("#settingsDone");
  const drawerBackdrop = $("#drawerBackdrop");
  let settingsIsOpen = false;
  let drawerCloseTimer = 0;
  let focusBeforeDrawer = null;

  function openSettings() {
    if (!settingsDrawer || settingsIsOpen) return;
    closeDockMenu();
    closePopover();
    settingsIsOpen = true;
    focusBeforeDrawer = document.activeElement;
    window.clearTimeout(drawerCloseTimer);

    if (page) page.inert = true;
    settingsDrawer.inert = false;
    drawerBackdrop.hidden = false;
    settingsDrawer.setAttribute("aria-hidden", "false");
    settingsOpen?.setAttribute("aria-expanded", "true");
    const drawerScroll = $(".drawer-scroll", settingsDrawer);
    if (drawerScroll) drawerScroll.scrollTop = 0;

    window.requestAnimationFrame(() => {
      settingsDrawer.classList.add("is-open");
      drawerBackdrop.classList.add("is-open");
    });
    settingsClose?.focus({ preventScroll: true });
  }

  function closeSettings({ restoreFocus = true } = {}) {
    if (!settingsDrawer || !settingsIsOpen) return;
    settingsIsOpen = false;
    settingsDrawer.classList.remove("is-open");
    drawerBackdrop.classList.remove("is-open");
    settingsDrawer.setAttribute("aria-hidden", "true");
    settingsOpen?.setAttribute("aria-expanded", "false");
    settingsDrawer.inert = true;
    if (page) page.inert = false;

    window.clearTimeout(drawerCloseTimer);
    drawerCloseTimer = window.setTimeout(() => {
      if (!settingsIsOpen) drawerBackdrop.hidden = true;
    }, 500);

    if (restoreFocus) {
      const target = focusBeforeDrawer && focusBeforeDrawer.isConnected ? focusBeforeDrawer : settingsOpen;
      target?.focus({ preventScroll: true });
    }
    saveSettingsNow();
  }

  settingsOpen?.addEventListener("click", openSettings);
  settingsClose?.addEventListener("click", () => closeSettings());
  settingsDone?.addEventListener("click", () => closeSettings());
  drawerBackdrop?.addEventListener("click", () => closeSettings());

  function trapDrawerFocus(event) {
    if (!settingsIsOpen || event.key !== "Tab" || !settingsDrawer) return;
    const focusable = $$("button, input, [href], select, textarea, [tabindex]:not([tabindex='-1'])", settingsDrawer)
      .filter((element) => !element.disabled && element.type !== "hidden" && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (document.activeElement === first || !settingsDrawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", trapDrawerFocus);

  $("#blurRange")?.addEventListener("input", (event) => {
    settings.blur = clamp(Number(event.target.value), 0, 40);
    applyAppearance();
  });

  $("#dimRange")?.addEventListener("input", (event) => {
    settings.dim = clamp(Number(event.target.value), 0, 65);
    applyAppearance();
  });

  $("#motionToggle")?.addEventListener("change", (event) => {
    settings.motion = event.target.checked;
    applyAppearance();
  });

  $("#grainToggle")?.addEventListener("change", (event) => {
    settings.grain = event.target.checked;
    applyAppearance();
  });

  $("#dockMagToggle")?.addEventListener("change", (event) => {
    settings.dockMagnify = event.target.checked;
    if (!settings.dockMagnify) resetDockTransforms();
    saveSettingsSoon();
  });

  $("#parallaxToggle")?.addEventListener("change", (event) => {
    settings.parallax = event.target.checked;
    if (!settings.parallax) resetParallax();
    saveSettingsSoon();
  });

  $("#resetAppearance")?.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    applyAppearance();
    renderWallpapers();
    showToast("外观已回到最初的样子。", { icon: "i-spark" });
  });

  /* ---------------------------------------------------------
     13 · Parallax, fullscreen, drag & drop
     --------------------------------------------------------- */
  let parallaxFrame = 0;
  let parallaxX = 0;
  let parallaxY = 0;

  function resetParallax() {
    parallaxX = 0;
    parallaxY = 0;
    backdrop.style.setProperty("--px", "0px");
    backdrop.style.setProperty("--py", "0px");
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || !settings.parallax || reduceMotionQuery.matches) return;
    parallaxX = (event.clientX / window.innerWidth - 0.5) * -18;
    parallaxY = (event.clientY / window.innerHeight - 0.5) * -13;
    if (parallaxFrame) return;
    parallaxFrame = window.requestAnimationFrame(() => {
      parallaxFrame = 0;
      backdrop.style.setProperty("--px", `${parallaxX.toFixed(2)}px`);
      backdrop.style.setProperty("--py", `${parallaxY.toFixed(2)}px`);
    });
  }, { passive: true });

  function updateFullscreenUI() {
    const active = Boolean(document.fullscreenElement);
    document.body.classList.toggle("is-fullscreen", active);
    const fullscreenBtn = $("#fullscreenBtn");
    if (fullscreenBtn) {
      fullscreenBtn.setAttribute("aria-label", active ? "退出全屏" : "进入全屏");
      fullscreenBtn.dataset.tip = active ? "退出全屏" : "全屏";
    }
  }

  $("#fullscreenBtn")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      showToast("当前浏览器暂时不允许进入全屏。", { icon: "i-info" });
    }
  });
  document.addEventListener("fullscreenchange", updateFullscreenUI);

  const dropOverlay = $("#dropOverlay");
  let dragDepth = 0;

  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  window.addEventListener("dragenter", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dropOverlay?.classList.add("is-visible");
  });

  window.addEventListener("dragover", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("dragleave", (event) => {
    if (!isFileDrag(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropOverlay?.classList.remove("is-visible");
  });

  window.addEventListener("drop", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = 0;
    dropOverlay?.classList.remove("is-visible");
    const file = Array.from(event.dataTransfer?.files || []).find((entry) => entry.type.startsWith("image/"));
    if (file) handleWallpaperFile(file);
    else showToast("请拖动一张图片进来。", { icon: "i-info" });
  });

  /* ---------------------------------------------------------
     14 · Global keyboard & cleanup
     --------------------------------------------------------- */
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement
      && (target.matches("input, textarea, select") || target.isContentEditable);

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (settingsIsOpen) closeSettings();
      if (appDialog?.open) return;
      searchInput?.focus({ preventScroll: true });
      searchInput?.select();
      openPopover();
      return;
    }

    if (event.key === "/" && !isTyping && !settingsIsOpen && !appDialog?.open) {
      event.preventDefault();
      searchInput?.focus({ preventScroll: true });
      return;
    }

    if (event.key === "Escape") {
      if (!dockMenu.hidden) {
        event.preventDefault();
        closeDockMenu({ restoreFocus: true });
        return;
      }
      if (settingsIsOpen) {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (popoverOpen) {
        closePopover();
        return;
      }
    }

  });

  window.addEventListener("resize", () => {
    closeDockMenu();
    window.clearTimeout(window.__lumenDockResize);
    window.__lumenDockResize = window.setTimeout(() => {
      fitDock();
      if (popoverOpen) closePopover();
    }, 130);
  });

  document.addEventListener("scroll", closeDockMenu, true);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateClock();
  });

  window.addEventListener("pagehide", () => {
    saveSettingsNow();
  });

  $(".brand")?.addEventListener("click", (event) => {
    event.preventDefault();
    closeDockMenu();
    if (settingsIsOpen) closeSettings();
    searchInput?.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------
     15 · Boot
     --------------------------------------------------------- */
  function init() {
    // Appearance first, so the scene is painted in the right mood.
    if (settings.wall === "custom" && !customPhoto) settings.wall = "dusk";
    applyAppearance({ save: false });
    renderWallpapers();
    updateClock();
    window.setInterval(updateClock, 1000);

    setEngine(engine);
    renderNotes();
    renderDock();
    renderFocus();
    updateActiveWidgetFromScroll();

    const city = WEATHER_CITIES[weatherCityIndex] || WEATHER_CITIES[0];
    updateWeatherView(applyWeatherFallback(city));
    loadWeather(city);

    // Keep the dock fitted after fonts/layout settle.
    window.setTimeout(fitDock, 80);
    window.setTimeout(() => resetDockTransforms(), 20);
  }

  init();
})();
