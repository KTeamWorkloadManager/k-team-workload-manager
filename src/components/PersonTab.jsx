import { useState } from "react";
import { bookingColor, cardStyle, formatDate, formatMonthLabel, loadBg, loadColor, ymd } from "../utils/helpers";

const navBtn = {
  border: "1px solid #e2e8f0",
  background: "white",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  color: "#374151",
};
const actionBtn = {
  border: "1px solid #e2e8f0",
  background: "white",
  borderRadius: 10,
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
const primaryBtn = {
  background: "#0f172a",
  color: "white",
  border: 0,
  borderRadius: 10,
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fafafa",
  outline: "none",
};

export default function PersonTab({
  selectedPerson, personMonth, personMonthGrid, bookings, projectTasks,
  draggedBookingId, onPrevMonth, onNextMonth, onDragStart, onDragEnd,
  onMoveBooking, onEditBooking, onAddBookingForPersonDate, onGoToProject,
  projects, teamMembers, savingProject, onCompleteTask, onCreateProjectForPerson,
  onMoveTaskDueDate,
}) {
  const personMonthIndex = personMonth.getMonth();
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [newProjectDraft, setNewProjectDraft] = useState({ number: "", name: "", leadId: "", comments: "" });
  const [newProjectError, setNewProjectError] = useState("");

  const realMembers = (teamMembers || []).filter((p) => p.id !== "jt");
  const activeProjectsLed = (selectedPerson.projectsLed || []).filter((p) => !p.completed);
  const completedProjectsLed = (selectedPerson.projectsLed || []).filter((p) => p.completed);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const noticeTasks = projectTasks
    .filter((t) => {
      if (t.assigned_to !== selectedPerson.id) return false;
      if (t.status !== "WIP") return false;
      const due = new Date(`${t.due_date}T00:00:00`);
      return due <= sevenDaysLater;
    })
    .sort((a, b) => new Date(`${a.due_date}T00:00:00`) - new Date(`${b.due_date}T00:00:00`));

  function getProjectName(projectId) {
    return (projects || []).find((p) => p.id === projectId)?.name || "";
  }

  const isOverdue = (dueDate) => new Date(`${dueDate}T00:00:00`) < today;

  function openNewProjectModal() {
    const maxNum = (projects || []).reduce((max, p) => {
      const n = parseInt(p.number, 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 24000);
    setNewProjectDraft({
      number: String(maxNum + 1),
      name: "",
      leadId: selectedPerson.id,
      comments: "",
    });
    setNewProjectError("");
    setShowNewProjectModal(true);
  }

  function handleCreateProject() {
    if (!newProjectDraft.number.trim()) { setNewProjectError("Project number is required."); return; }
    if (!newProjectDraft.name.trim()) { setNewProjectError("Project name is required."); return; }
    setShowNewProjectModal(false);
    onCreateProjectForPerson({
      number: newProjectDraft.number.trim(),
      name: newProjectDraft.name.trim(),
      leadId: newProjectDraft.leadId,
      comments: newProjectDraft.comments,
    });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Header card */}
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{selectedPerson.name}</div>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 14 }}>Personal workload view</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "This week", percent: selectedPerson.currentWeekPercent },
              { label: "This fortnight", percent: selectedPerson.currentFortnightPercent },
              { label: "This month", percent: selectedPerson.currentMonthPercent },
            ].map(({ label, percent }) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  background: loadBg(percent),
                  borderRadius: 12,
                  padding: "10px 18px",
                  minWidth: 100,
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{label}</div>
                <div style={{ color: loadColor(percent), fontWeight: 800, fontSize: 24 }}>{percent}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notice Panel — WIP tasks due within 7 days */}
      {noticeTasks.length > 0 && (
        <div style={{ ...cardStyle(), background: "#fffbeb", border: "1px solid #fcd34d" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#92400e" }}>
            Upcoming Due Tasks — next 7 days
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {noticeTasks.map((task) => {
              const projName = getProjectName(task.project_id);
              const overdue = isOverdue(task.due_date);
              return (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    border: `1px solid ${overdue ? "#fca5a5" : "#fcd34d"}`,
                    borderRadius: 12,
                    padding: "10px 14px",
                    background: overdue ? "#fff1f2" : "white",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</div>
                    {projName && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{projName}</div>}
                    <div style={{ fontSize: 12, color: overdue ? "#dc2626" : "#92400e", marginTop: 2, fontWeight: 600 }}>
                      {overdue ? "Overdue: " : "Due: "}{formatDate(task.due_date)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => onGoToProject(task.project_id)} style={actionBtn}>Edit</button>
                    {onCompleteTask && (
                      <button onClick={() => onCompleteTask(task.id)} style={{ ...primaryBtn, background: "#16a34a" }}>
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side-by-side: projects list + personal calendar */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Left: Projects they lead */}
        <div style={cardStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Projects Led</div>
            {onCreateProjectForPerson && (
              <button onClick={openNewProjectModal} style={{ ...actionBtn, fontSize: 12, padding: "5px 10px" }}>
                + New
              </button>
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {activeProjectsLed.length === 0 && (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>No active projects.</div>
            )}
            {activeProjectsLed.map((project) => (
              <button
                key={project.id}
                onClick={() => onGoToProject(project.id)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", textAlign: "left", background: "white", cursor: "pointer" }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{project.number} — {project.name}</div>
              </button>
            ))}
          </div>

          {completedProjectsLed.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setShowCompletedModal(true)}
                style={{ ...actionBtn, width: "100%", textAlign: "center", fontSize: 12 }}
              >
                View {completedProjectsLed.length} completed
              </button>
            </div>
          )}
        </div>

        {/* Right: Personal Calendar */}
        <div style={cardStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Personal Calendar</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={onPrevMonth} style={navBtn}>← Prev</button>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{formatMonthLabel(personMonth)}</div>
              <button onClick={onNextMonth} style={navBtn}>Next →</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} style={{ fontWeight: 700, fontSize: 12, padding: "6px 8px", textAlign: "center", color: d === "Sat" || d === "Sun" ? "#94a3b8" : "#374151" }}>
                {d}
              </div>
            ))}

            {personMonthGrid.map((date) => {
              const dateKey = ymd(date);
              const dayBookings = bookings
                .filter((b) => b.date === dateKey && (b.assigned_to === selectedPerson.id || b.assistant_assigned_to === selectedPerson.id))
                .sort((a, b) => a.title.localeCompare(b.title));
              // Only show due indicators for WIP tasks
              const dueTasks = projectTasks
                .filter((t) => t.assigned_to === selectedPerson.id && t.due_date === dateKey && t.status === "WIP")
                .sort((a, b) => a.title.localeCompare(b.title));
              const inMonth = date.getMonth() === personMonthIndex;
              const isToday = dateKey === ymd(new Date());
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <div
                  key={dateKey}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedBookingId) onMoveBooking(draggedBookingId, selectedPerson.id, dateKey);
                    else if (draggedTaskId && onMoveTaskDueDate) { onMoveTaskDueDate(draggedTaskId, dateKey); setDraggedTaskId(null); }
                    onDragEnd();
                  }}
                  onClick={() => onAddBookingForPersonDate(selectedPerson.id, dateKey)}
                  style={{
                    minHeight: 140,
                    padding: 6,
                    border: isToday ? "2px solid #0f172a" : "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: !inMonth ? "#f8fafc" : isWeekend ? "#fafafa" : "white",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    opacity: !inMonth ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isToday ? "white" : inMonth ? "#0f172a" : "#94a3b8",
                    background: isToday ? "#0f172a" : "transparent",
                    borderRadius: isToday ? "50%" : 0,
                    width: isToday ? 22 : "auto",
                    height: isToday ? 22 : "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    alignSelf: "flex-start",
                  }}>
                    {date.getDate()}
                  </div>

                  {dayBookings.map((booking) => {
                    const isAssistant = booking.assistant_assigned_to === selectedPerson.id;
                    return (
                      <div
                        key={`${booking.id}-${selectedPerson.id}`}
                        draggable={!isAssistant}
                        onDragStart={(e) => {
                          if (isAssistant) return;
                          e.stopPropagation();
                          onDragStart(booking.id);
                        }}
                        onDragEnd={onDragEnd}
                        onClick={(e) => { e.stopPropagation(); onEditBooking(booking); }}
                        style={{
                          background: bookingColor(booking),
                          borderRadius: 6,
                          padding: "4px 6px",
                          fontSize: 11,
                          cursor: isAssistant ? "pointer" : "grab",
                          borderLeft: isAssistant ? "3px solid rgba(0,0,0,0.15)" : "none",
                        }}
                      >
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{booking.title}</div>
                        <div style={{ color: "#475569" }}>{booking.hours}h{isAssistant ? " · Asst" : ""}</div>
                      </div>
                    );
                  })}

                  {dueTasks.map((task) => {
                    const projName = getProjectName(task.project_id);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDraggedTaskId(task.id); }}
                        onDragEnd={() => setDraggedTaskId(null)}
                        onClick={(e) => { e.stopPropagation(); onGoToProject(task.project_id); }}
                        style={{
                          border: 0,
                          background: "#7f1d1d",
                          color: "white",
                          borderRadius: 6,
                          padding: "4px 6px",
                          fontSize: 11,
                          textAlign: "left",
                          cursor: "grab",
                        }}
                      >
                        <div style={{ fontWeight: 700, lineHeight: 1.3 }}>Due: {task.title}{projName ? ` — ${projName}` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewProjectModal(false); }}
        >
          <div style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(15,23,42,0.25)", position: "relative" }}>
            <button
              onClick={() => setShowNewProjectModal(false)}
              style={{ position: "absolute", top: 16, right: 16, border: 0, background: "#f1f5f9", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#64748b", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>

            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>New Project</div>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Project number</label>
                  <input
                    value={newProjectDraft.number}
                    onChange={(e) => setNewProjectDraft((d) => ({ ...d, number: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Project name</label>
                  <input
                    value={newProjectDraft.name}
                    onChange={(e) => setNewProjectDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Enter project name..."
                    style={inputStyle}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Lead surveyor</label>
                <select
                  value={newProjectDraft.leadId}
                  onChange={(e) => setNewProjectDraft((d) => ({ ...d, leadId: e.target.value }))}
                  style={inputStyle}
                >
                  {realMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Comments</label>
                <textarea
                  rows={3}
                  value={newProjectDraft.comments}
                  onChange={(e) => setNewProjectDraft((d) => ({ ...d, comments: e.target.value }))}
                  placeholder="Any notes about this project..."
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            </div>

            {newProjectError && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#dc2626", fontWeight: 500 }}>{newProjectError}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNewProjectModal(false)} style={actionBtn}>Cancel</button>
              <button
                onClick={handleCreateProject}
                disabled={savingProject}
                style={{ ...primaryBtn, padding: "9px 20px", fontSize: 14, opacity: savingProject ? 0.6 : 1 }}
              >
                {savingProject ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed projects modal */}
      {showCompletedModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCompletedModal(false); }}
        >
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto", position: "relative", boxShadow: "0 8px 40px rgba(15,23,42,0.2)" }}>
            <button
              onClick={() => setShowCompletedModal(false)}
              style={{ position: "absolute", top: 16, right: 16, border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "#64748b", fontWeight: 700, lineHeight: 1 }}
            >
              ✕
            </button>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Completed Projects — {selectedPerson.name}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {completedProjectsLed.map((project) => (
                <div key={project.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                  <div style={{ fontWeight: 700, color: "#64748b", fontSize: 14 }}>{project.number} — {project.name}</div>
                  <button
                    onClick={() => { setShowCompletedModal(false); onGoToProject(project.id); }}
                    style={{ ...actionBtn, marginTop: 8, fontSize: 12, padding: "5px 10px" }}
                  >
                    Go to Project
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
