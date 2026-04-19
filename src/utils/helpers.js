export function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

export function ymd(date) {
  const yr = date.getFullYear();
  const mo = `${date.getMonth() + 1}`.padStart(2, "0");
  const da = `${date.getDate()}`.padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

export function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function startOfWeek(date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = addDays(date, -mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function formatDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatMonthLabel(date) {
  return date.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}

export function getMonthGrid(baseDate) {
  const firstOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startDay = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -startDay);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function bookingColor(booking) {
  if (booking.type === "Field" && booking.tentative) return "#fecaca";
  return booking.type === "Field" ? "#ffedd5" : "#dbeafe";
}

export function loadColor(percent) {
  if (percent >= 100) return "#991b1b";
  if (percent >= 90) return "#ea580c";
  if (percent >= 80) return "#16a34a";
  return "#3b82f6";
}

export function loadBg(percent) {
  if (percent >= 100) return "#fee2e2";
  if (percent >= 90) return "#fff7ed";
  if (percent >= 80) return "#f0fdf4";
  return "#eff6ff";
}

export function cardStyle() {
  return {
    background: "white",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e5e7eb",
  };
}

export function projectStatusRank(status) {
  if (status === "Complete") return 3;
  if (status === "WIP") return 2;
  return 1;
}

export function projectSort(a, b) {
  return (a.number || "").localeCompare(b.number || "", undefined, { numeric: true });
}

export function groupTasksByProject(tasks, projects) {
  return [...projects]
    .sort(projectSort)
    .map((project) => ({
      ...project,
      tasks: tasks
        .filter((task) => task.project_id === project.id)
        .sort((a, b) => {
          const da = a.due_date ? parseDate(a.due_date) : new Date(9999, 0);
          const db = b.due_date ? parseDate(b.due_date) : new Date(9999, 0);
          return da - db || projectStatusRank(b.status) - projectStatusRank(a.status);
        }),
    }));
}

export function calcLoadPercent(hours, person, weeks = 1) {
  const baseCapacity = person.weeklyCapacity * weeks;
  if (!baseCapacity) return 0;
  return Math.round((hours / baseCapacity) * 100);
}

export function makeId(prefix) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function sumHoursInRange(bookings, startDate, endDate) {
  return bookings
    .filter((booking) => {
      const date = parseDate(booking.date);
      return date >= startDate && date <= endDate;
    })
    .reduce((sum, booking) => sum + Number(booking.hours || 0), 0);
}
