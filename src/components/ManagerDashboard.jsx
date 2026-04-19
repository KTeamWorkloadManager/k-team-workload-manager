import { useState, useMemo } from "react";
import emailjs from "@emailjs/browser";
import { addDays, cardStyle, formatDate, loadBg, loadColor } from "../utils/helpers";

// ─── EmailJS config ──────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";

// ─── Surveyor full names ──────────────────────────────────────────────────────
const SURVEYOR_FULL_NAMES = {
  s1: "Frankie Lardies",
  s4: "Jackson Savage",
  s5: "Leon Wang",
  s3: "Oment Li",
  s2: "Tony Deng",
};

function getEmailFromId(personId) {
  const fullName = SURVEYOR_FULL_NAMES[personId];
  if (!fullName) return null;
  const parts = fullName.toLowerCase().split(" ");
  return `${parts[0]}.${parts[1]}@everest.co.nz`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fafafa",
  outline: "none",
};
const btnPrimary = {
  background: "#0f172a",
  color: "white",
  border: 0,
  borderRadius: 10,
  padding: "8px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
const btnSecondary = {
  border: "1px solid #e2e8f0",
  background: "white",
  borderRadius: 10,
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  color: "#374151",
};
const btnDanger = {
  border: "1px solid #fca5a5",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};
const btnSuccess = {
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#16a34a",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};

export default function ManagerDashboard({
  allWeeksLoad, teamMembers, projects, projectTasks, bookings,
  managerTodos, managerNotes, managerJobs,
  onAddTodo, onUpdateTodo, onDeleteTodo,
  onSaveNote,
  onAddJob, onUpdateJob, onDeleteJob,
  onGoToProject, onSelectPerson,
  currentPeriodStart,
}) {
  // Panel 1 state
  const [newTodoText, setNewTodoText] = useState("");
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState("");

  // Panel 2 state
  const [editingNotePersonId, setEditingNotePersonId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Panel 4 state
  const [newJobText, setNewJobText] = useState("");
  const [editingJobId, setEditingJobId] = useState(null);
  const [editingJobText, setEditingJobText] = useState("");
  const [assignModalJob, setAssignModalJob] = useState(null);
  const [assignModalDescription, setAssignModalDescription] = useState("");
  const [assignPersonId, setAssignPersonId] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState({ text: "", isError: false });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysLater = addDays(today, 7);
  const weekEnd = addDays(currentPeriodStart, 6);

  const realMembers = (teamMembers || []).filter((p) => p.id !== "jt");

  // Panel 3: categorise projects as Red (overdue WIP) or Amber (WIP due this week)
  const { redProjects, amberProjects } = useMemo(() => {
    const red = [];
    const amber = [];
    (projects || []).filter((p) => !p.completed).forEach((project) => {
      const wipTasks = (projectTasks || []).filter((t) => t.project_id === project.id && t.status === "WIP");
      const hasOverdue = wipTasks.some((t) => t.due_date && new Date(`${t.due_date}T00:00:00`) < today);
      const hasDueSoon = wipTasks.some((t) => {
        const d = new Date(`${t.due_date}T00:00:00`);
        return t.due_date && d >= today && d <= sevenDaysLater;
      });
      if (hasOverdue) red.push(project);
      else if (hasDueSoon) amber.push(project);
    });
    return { redProjects: red, amberProjects: amber };
  }, [projects, projectTasks, today, sevenDaysLater]);

  function groupByLead(projectList) {
    const groups = {};
    projectList.forEach((p) => {
      const key = p.primary_surveyor_id || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }

  function getNoteForPerson(personId) {
    return (managerNotes || []).find((n) => n.surveyor_name === personId)?.notes || "";
  }

  // Panel 2: project breakdown for a person this week
  function getProjectBreakdown(personId) {
    const personBookings = (bookings || []).filter((b) => {
      const d = new Date(`${b.date}T00:00:00`);
      return (b.assigned_to === personId || b.assistant_assigned_to === personId) &&
        d >= currentPeriodStart && d <= weekEnd;
    });
    const totalHours = personBookings.reduce((sum, b) => sum + Number(b.hours || 0), 0);
    if (totalHours === 0) return { items: [], totalHours: 0 };

    const groups = {};
    personBookings.forEach((b) => {
      const key = b.linked_project_id || "__unlinked__";
      groups[key] = (groups[key] || 0) + Number(b.hours || 0);
    });

    const items = Object.entries(groups)
      .map(([projectId, hours]) => {
        const project = projectId === "__unlinked__" ? null : (projects || []).find((p) => p.id === projectId);
        return {
          projectId,
          label: project ? `${project.number} — ${project.name}` : "Other / unlinked",
          hours,
          pct: Math.round((hours / totalHours) * 100),
        };
      })
      .sort((a, b) => b.hours - a.hours);

    return { items, totalHours };
  }

  // Panel 2: note editing
  function startEditNote(personId) {
    setEditingNotePersonId(personId);
    setEditingNoteText(getNoteForPerson(personId));
  }

  async function submitNoteEdit(personId) {
    await onSaveNote(personId, editingNoteText);
    setEditingNotePersonId(null);
    setEditingNoteText("");
  }

  // Panel 4: email
  async function sendJobEmail(job, personId, description) {
    const fullName = SURVEYOR_FULL_NAMES[personId] || personId;
    const email = getEmailFromId(personId);
    if (!email) { setEmailMessage({ text: "Could not determine email address.", isError: true }); return; }

    setEmailSending(true);
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_name: fullName,
          to_email: email,
          from_name: "Kevin He",
          from_email: "kevin.he@everest.co.nz",
          job_content: description,
          message: `Hi ${fullName.split(" ")[0]},\n\nYou have been assigned the following job:\n\n${description}\n\nKind regards,\nKevin He`,
        },
        EMAILJS_PUBLIC_KEY
      );
      setEmailMessage({ text: `Email sent to ${fullName} (${email})`, isError: false });
      await onUpdateJob(job.id, { assigned_to: personId });
      setAssignModalJob(null);
    } catch (err) {
      setEmailMessage({ text: `Failed to send: ${err?.text || err?.message || String(err)}`, isError: true });
    }
    setEmailSending(false);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Fixed floating full-name surveyor buttons */}
      <div style={{ position: "fixed", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 500 }}>
        {realMembers.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelectPerson(member.id)}
            title={SURVEYOR_FULL_NAMES[member.id] || member.name}
            style={{
              border: "2px solid white",
              background: "#0f172a",
              color: "white",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              borderRadius: 20,
              padding: "7px 14px",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 10px rgba(15,23,42,0.3)",
            }}
          >
            {SURVEYOR_FULL_NAMES[member.id] || member.name}
          </button>
        ))}
      </div>

      {/* ── Panel 1: To-Do This Week ─────────────────────────────────────────── */}
      <div style={cardStyle()}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>To-Do This Week</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTodoText.trim()) { onAddTodo(newTodoText.trim()); setNewTodoText(""); }
            }}
            placeholder="Add a new to-do..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => { if (newTodoText.trim()) { onAddTodo(newTodoText.trim()); setNewTodoText(""); } }}
            style={btnPrimary}
          >
            Add
          </button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(managerTodos || []).length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>No to-dos yet.</div>
          )}
          {(managerTodos || []).map((todo) => (
            <div key={todo.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", background: "white" }}>
              {editingTodoId === todo.id ? (
                <>
                  <input
                    value={editingTodoText}
                    onChange={(e) => setEditingTodoText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onUpdateTodo(todo.id, editingTodoText); setEditingTodoId(null); }
                      if (e.key === "Escape") setEditingTodoId(null);
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                    autoFocus
                  />
                  <button onClick={() => { onUpdateTodo(todo.id, editingTodoText); setEditingTodoId(null); }} style={btnPrimary}>Save</button>
                  <button onClick={() => setEditingTodoId(null)} style={btnSecondary}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 14 }}>{todo.content}</div>
                  <button onClick={() => { setEditingTodoId(todo.id); setEditingTodoText(todo.content); }} style={{ ...btnSecondary, padding: "5px 10px", fontSize: 12 }}>Edit</button>
                  <button onClick={() => onDeleteTodo(todo.id)} style={btnSuccess}>Complete</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel 2: Team Workload ────────────────────────────────────────────── */}
      <div style={cardStyle()}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Team Workload</div>
        <div style={{ display: "grid", gap: 12 }}>
          {(allWeeksLoad || []).map((person) => {
            const noteText = getNoteForPerson(person.id);
            const isEditingNote = editingNotePersonId === person.id;
            const { items: projectItems, totalHours } = getProjectBreakdown(person.id);

            return (
              <div
                key={person.id}
                style={{ display: "grid", gridTemplateColumns: "200px 1fr 240px", gap: 16, alignItems: "start", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}
              >
                {/* Col 1: avatar + load bars */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {person.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{SURVEYOR_FULL_NAMES[person.id] || person.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{person.weeklyCapacity}h/week</div>
                    </div>
                  </div>
                  {[
                    { label: "Week", pct: person.currentWeekPercent },
                    { label: "Fortnight", pct: person.currentFortnightPercent },
                    { label: "Month", pct: person.currentMonthPercent },
                  ].map(({ label, pct }) => (
                    <div key={label} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                        <span>{label}</span>
                        <span style={{ color: loadColor(pct), fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ background: "#e5e7eb", borderRadius: 6, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: loadColor(pct), borderRadius: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Col 2: project breakdown */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>This week</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: loadColor(person.currentWeekPercent) }}>{person.currentWeekPercent}%</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{person.currentWeekHours}h / {person.weeklyCapacity}h</div>
                  </div>
                  {projectItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>No bookings this week.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 5 }}>
                      {projectItems.map((item) => (
                        <div key={item.projectId}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 2 }}>
                            <span style={{ color: "#374151", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }} title={item.label}>{item.label}</span>
                            <span style={{ fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>{item.pct}% · {item.hours}h</span>
                          </div>
                          <div style={{ background: "#e5e7eb", borderRadius: 4, height: 4, overflow: "hidden" }}>
                            <div style={{ width: `${item.pct}%`, height: "100%", background: "#0f172a", borderRadius: 4 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Col 3: manager notes */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Notes</div>
                  {isEditingNote ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <textarea
                        rows={3}
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => submitNoteEdit(person.id)} style={btnPrimary}>Save</button>
                        <button onClick={() => setEditingNotePersonId(null)} style={btnSecondary}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEditNote(person.id)}
                      style={{ fontSize: 13, color: noteText ? "#374151" : "#94a3b8", cursor: "pointer", padding: "8px 10px", border: "1px dashed #e2e8f0", borderRadius: 8, minHeight: 64, background: "#fafafa", whiteSpace: "pre-wrap" }}
                    >
                      {noteText || "Click to add notes..."}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Panel 3: Project Status Board ────────────────────────────────────── */}
      <div style={cardStyle()}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Project Status Board</div>
        {redProjects.length === 0 && amberProjects.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>No projects with overdue or soon-due WIP tasks.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Red column */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", display: "inline-block", flexShrink: 0 }} />
                Red — Overdue WIP Tasks ({redProjects.length})
              </div>
              {redProjects.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>None</div>}
              {Object.entries(groupByLead(redProjects)).map(([leadId, projs]) => {
                const memberName = SURVEYOR_FULL_NAMES[leadId] || (teamMembers || []).find((m) => m.id === leadId)?.name || leadId;
                return (
                  <div key={leadId} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>{memberName}</div>
                    {projs.map((p) => {
                      const overdueTasks = (projectTasks || []).filter((t) =>
                        t.project_id === p.id && t.status === "WIP" && t.due_date &&
                        new Date(`${t.due_date}T00:00:00`) < today
                      );
                      return (
                        <button
                          key={p.id}
                          onClick={() => onGoToProject(p.id)}
                          style={{ display: "block", width: "100%", textAlign: "left", border: "1px solid #fca5a5", background: "#fff1f2", borderRadius: 10, padding: "8px 12px", cursor: "pointer", marginBottom: 6 }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.number} — {p.name}</div>
                          {overdueTasks.map((t) => (
                            <div key={t.id} style={{ fontSize: 11, color: "#dc2626", marginTop: 4, paddingLeft: 8 }}>
                              • {t.title} — due {formatDate(t.due_date)}
                            </div>
                          ))}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Amber column */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#d97706", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d97706", display: "inline-block", flexShrink: 0 }} />
                Amber — Due This Week ({amberProjects.length})
              </div>
              {amberProjects.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>None</div>}
              {Object.entries(groupByLead(amberProjects)).map(([leadId, projs]) => {
                const memberName = SURVEYOR_FULL_NAMES[leadId] || (teamMembers || []).find((m) => m.id === leadId)?.name || leadId;
                return (
                  <div key={leadId} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>{memberName}</div>
                    {projs.map((p) => {
                      const dueSoonTasks = (projectTasks || []).filter((t) => {
                        if (t.project_id !== p.id || t.status !== "WIP" || !t.due_date) return false;
                        const d = new Date(`${t.due_date}T00:00:00`);
                        return d >= today && d <= sevenDaysLater;
                      });
                      return (
                        <button
                          key={p.id}
                          onClick={() => onGoToProject(p.id)}
                          style={{ display: "block", width: "100%", textAlign: "left", border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 10, padding: "8px 12px", cursor: "pointer", marginBottom: 6 }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.number} — {p.name}</div>
                          {dueSoonTasks.map((t) => (
                            <div key={t.id} style={{ fontSize: 11, color: "#92400e", marginTop: 4, paddingLeft: 8 }}>
                              • {t.title} — due {formatDate(t.due_date)}
                            </div>
                          ))}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Panel 4: Job Allocation ───────────────────────────────────────────── */}
      <div style={cardStyle()}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Job Allocation</div>

        {emailMessage.text && (
          <div style={{ background: emailMessage.isError ? "#fff1f2" : "#f0fdf4", border: `1px solid ${emailMessage.isError ? "#fca5a5" : "#86efac"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: emailMessage.isError ? "#dc2626" : "#16a34a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {emailMessage.text}
            <button onClick={() => setEmailMessage({ text: "", isError: false })} style={{ border: 0, background: "transparent", cursor: "pointer", fontWeight: 700, fontSize: 16, color: "inherit" }}>✕</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={newJobText}
            onChange={(e) => setNewJobText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newJobText.trim()) { onAddJob(newJobText.trim()); setNewJobText(""); }
            }}
            placeholder="Add a new job..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => { if (newJobText.trim()) { onAddJob(newJobText.trim()); setNewJobText(""); } }} style={btnPrimary}>Add</button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {(managerJobs || []).length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>No jobs yet.</div>
          )}
          {(managerJobs || []).map((job) => {
            const assignedName = job.assigned_to ? (SURVEYOR_FULL_NAMES[job.assigned_to] || job.assigned_to) : null;
            return (
              <div key={job.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", background: "white" }}>
                {editingJobId === job.id ? (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      value={editingJobText}
                      onChange={(e) => setEditingJobText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { onUpdateJob(job.id, { content: editingJobText }); setEditingJobId(null); }
                        if (e.key === "Escape") setEditingJobId(null);
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                      autoFocus
                    />
                    <button onClick={() => { onUpdateJob(job.id, { content: editingJobText }); setEditingJobId(null); }} style={btnPrimary}>Save</button>
                    <button onClick={() => setEditingJobId(null)} style={btnSecondary}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{job.content}</div>
                      {assignedName && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Assigned to: {assignedName}</div>}
                    </div>
                    <button
                      onClick={() => { setEditingJobId(job.id); setEditingJobText(job.content); }}
                      style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setAssignModalJob(job);
                        setAssignModalDescription(job.content);
                        setAssignPersonId(job.assigned_to || realMembers[0]?.id || "");
                        setEmailMessage({ text: "", isError: false });
                      }}
                      style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}
                    >
                      Assign & Email
                    </button>
                    <button onClick={() => onDeleteJob(job.id)} style={btnDanger}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Assign & Email Modal ──────────────────────────────────────────────── */}
      {assignModalJob && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignModalJob(null); }}
        >
          <div style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(15,23,42,0.25)", position: "relative" }}>
            <button
              onClick={() => setAssignModalJob(null)}
              style={{ position: "absolute", top: 16, right: 16, border: 0, background: "#f1f5f9", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#64748b", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>

            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Assign Job</div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Description</label>
              <textarea
                rows={4}
                value={assignModalDescription}
                onChange={(e) => setAssignModalDescription(e.target.value)}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Assign to</label>
              <select value={assignPersonId} onChange={(e) => setAssignPersonId(e.target.value)} style={inputStyle}>
                {realMembers.map((m) => (
                  <option key={m.id} value={m.id}>{SURVEYOR_FULL_NAMES[m.id] || m.name}</option>
                ))}
              </select>
            </div>

            {assignPersonId && (
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                Will send to: <strong>{getEmailFromId(assignPersonId) || "unknown"}</strong>
              </div>
            )}

            {emailMessage.text && (
              <div style={{ background: emailMessage.isError ? "#fff1f2" : "#f0fdf4", border: `1px solid ${emailMessage.isError ? "#fca5a5" : "#86efac"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: emailMessage.isError ? "#dc2626" : "#16a34a" }}>
                {emailMessage.text}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setAssignModalJob(null)} style={btnSecondary}>Cancel</button>
              <button
                onClick={() => sendJobEmail(assignModalJob, assignPersonId, assignModalDescription)}
                disabled={emailSending || !assignPersonId || !assignModalDescription.trim()}
                style={{ ...btnPrimary, opacity: emailSending || !assignPersonId || !assignModalDescription.trim() ? 0.6 : 1 }}
              >
                {emailSending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
