/* =========================================================
 * Flow · 待办清单
 * 纯前端实现，localStorage 持久化，无任何依赖
 * ========================================================= */

const STORAGE_KEY = "flow-todo-tasks-v1";
const THEME_KEY = "flow-todo-theme";

const PRIORITY_TEXT = { high: "🔴 高", mid: "🟡 中", low: "🟢 低" };
const PRIORITY_RANK = { high: 0, mid: 1, low: 2 };

const $ = (sel) => document.querySelector(sel);

const els = {
  list: $("#taskList"),
  empty: $("#emptyState"),
  input: $("#taskInput"),
  addBtn: $("#addBtn"),
  priority: $("#prioritySelect"),
  due: $("#dueInput"),
  tag: $("#tagInput"),
  search: $("#searchInput"),
  sort: $("#sortSelect"),
  filters: $("#filters"),
  counter: $("#counterText"),
  progressLabel: $("#progressLabel"),
  progressPct: $("#progressPct"),
  progressFill: $("#progressFill"),
  themeToggle: $("#themeToggle"),
  exportBtn: $("#exportBtn"),
  clearDoneBtn: $("#clearDoneBtn"),
  todayText: $("#todayText"),
  tagList: $("#tagList"),
  template: $("#taskTemplate"),
};

/* ---------------- 状态 ---------------- */
let tasks = load();
let filter = "all";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? seed();
  } catch {
    return seed();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function seed() {
  return [
    { id: uid(), text: "欢迎使用 Flow 待办！双击我可以编辑", done: false, priority: "mid", due: "", tag: "指南", createdAt: Date.now() },
    { id: uid(), text: "拖动左侧 ⋮⋮ 可以调整任务顺序", done: false, priority: "low", due: "", tag: "指南", createdAt: Date.now() + 1 },
    { id: uid(), text: "按 T 键切换深色模式", done: true, priority: "high", due: todayStr(), tag: "指南", createdAt: Date.now() + 2 },
  ];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------------- 增删改查 ---------------- */
function addTask() {
  const text = els.input.value.trim();
  if (!text) {
    els.input.focus();
    return;
  }
  tasks.unshift({
    id: uid(),
    text,
    done: false,
    priority: els.priority.value,
    due: els.due.value,
    tag: els.tag.value.trim(),
    createdAt: Date.now(),
  });
  els.input.value = "";
  els.input.focus();
  save();
  render();
}

function deleteTask(id, li) {
  li.classList.add("leaving");
  setTimeout(() => {
    tasks = tasks.filter((t) => t.id !== id);
    save();
    render();
  }, 180);
}

function toggleDone(id) {
  const t = tasks.find((t) => t.id === id);
  if (t) {
    t.done = !t.done;
    save();
    render();
  }
}

function startEdit(id, li) {
  const t = tasks.find((t) => t.id === id);
  if (!t) return;
  const textEl = li.querySelector(".task-text");
  const editEl = li.querySelector(".task-edit");
  textEl.hidden = true;
  editEl.hidden = false;
  editEl.value = t.text;
  editEl.focus();
  editEl.select();

  const commit = () => {
    const v = editEl.value.trim();
    if (v) {
      t.text = v;
      save();
    }
    render();
  };
  editEl.onblur = commit;
  editEl.onkeydown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") render();
  };
}

/* ---------------- 渲染 ---------------- */
function visibleTasks() {
  let list = [...tasks];
  const q = els.search.value.trim().toLowerCase();

  if (filter === "active") list = list.filter((t) => !t.done);
  if (filter === "done") list = list.filter((t) => t.done);
  if (q) list = list.filter((t) => t.text.toLowerCase().includes(q) || (t.tag || "").toLowerCase().includes(q));

  const sortBy = els.sort.value;
  if (sortBy === "priority") list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  if (sortBy === "due") list.sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
  if (sortBy === "alpha") list.sort((a, b) => a.text.localeCompare(b.text, "zh"));
  if (sortBy === "created") list.sort((a, b) => b.createdAt - a.createdAt);

  return list;
}

function render() {
  const list = visibleTasks();
  els.list.innerHTML = "";
  els.empty.style.display = list.length ? "none" : "block";

  for (const t of list) {
    const li = els.template.content.firstElementChild.cloneNode(true);
    li.dataset.id = t.id;
    li.classList.toggle("done", t.done);
    if (t.due && !t.done && t.due < todayStr()) li.classList.add("overdue");

    li.querySelector(".task-check").checked = t.done;
    li.querySelector(".task-text").textContent = t.text;

    const pBadge = li.querySelector(".priority");
    pBadge.textContent = PRIORITY_TEXT[t.priority];
    pBadge.dataset.p = t.priority;

    const dueBadge = li.querySelector(".due");
    if (t.due) {
      dueBadge.textContent = "📅 " + t.due;
    } else {
      dueBadge.remove();
    }

    const tagBadge = li.querySelector(".tag");
    if (t.tag) {
      tagBadge.textContent = "# " + t.tag;
    } else {
      tagBadge.remove();
    }

    // 事件
    li.querySelector(".task-check").addEventListener("change", () => toggleDone(t.id));
    li.querySelector(".del-btn").addEventListener("click", () => deleteTask(t.id, li));
    li.querySelector(".edit-btn").addEventListener("click", () => startEdit(t.id, li));
    li.querySelector(".task-text").addEventListener("dblclick", () => startEdit(t.id, li));

    els.list.appendChild(li);
  }

  renderStats();
  renderTagSuggestions();
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  els.counter.textContent = `共 ${total} 项任务 · 已完成 ${done} · 未完成 ${total - done}`;
  els.progressPct.textContent = pct + "%";
  els.progressFill.style.width = pct + "%";

  const msgs = ["今天也要加油哦 💪", "完成一半啦，继续！", "快完成了，冲刺！", "全部搞定，太棒了！🎉"];
  els.progressLabel.textContent = pct >= 100 ? msgs[3] : pct >= 50 ? msgs[2] : pct > 0 ? msgs[1] : msgs[0];
}

function renderTagSuggestions() {
  const tags = [...new Set(tasks.map((t) => t.tag).filter(Boolean))];
  els.tagList.innerHTML = tags.map((t) => `<option value="${escapeHtml(t)}">`).join("");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- 拖拽排序 ---------------- */
let dragId = null;

els.list.addEventListener("dragstart", (e) => {
  const li = e.target.closest(".task");
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add("dragging");
});

els.list.addEventListener("dragend", (e) => {
  e.target.closest(".task")?.classList.remove("dragging");
  dragId = null;
});

els.list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const after = getAfterElement(e.clientY);
  const dragging = els.list.querySelector(".dragging");
  if (!dragging) return;
  if (after == null) {
    els.list.appendChild(dragging);
  } else {
    els.list.insertBefore(dragging, after);
  }
});

els.list.addEventListener("drop", () => {
  // 按当前 DOM 顺序重建 tasks 数组
  const order = [...els.list.querySelectorAll(".task")].map((li) => li.dataset.id);
  const map = new Map(tasks.map((t) => [t.id, t]));
  tasks = order.map((id) => map.get(id)).filter(Boolean);
  save();
});

function getAfterElement(y) {
  const items = [...els.list.querySelectorAll(".task:not(.dragging)")];
  return items.find((el) => y < el.getBoundingClientRect().top + el.offsetHeight / 2) ?? null;
}

/* ---------------- 主题 ---------------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}

/* ---------------- 事件绑定 ---------------- */
els.addBtn.addEventListener("click", addTask);
els.input.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });
els.tag.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });

els.filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  filter = btn.dataset.filter;
  els.filters.querySelectorAll(".filter").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

els.search.addEventListener("input", render);
els.sort.addEventListener("change", render);

els.themeToggle.addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
);

els.clearDoneBtn.addEventListener("click", () => {
  const doneCount = tasks.filter((t) => t.done).length;
  if (!doneCount) return;
  if (confirm(`确定清除 ${doneCount} 项已完成的任务吗？`)) {
    tasks = tasks.filter((t) => !t.done);
    save();
    render();
  }
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `todo-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "t" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  }
});

/* ---------------- 初始化 ---------------- */
els.todayText.textContent = new Date().toLocaleDateString("zh-CN", {
  year: "numeric", month: "long", day: "numeric", weekday: "long",
});
applyTheme(localStorage.getItem(THEME_KEY) || "light");
render();
