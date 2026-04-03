import React, { useState } from "react";
import { cardStyle } from "../utils/helpers";

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
const primaryBtn = {
  background: "#0f172a",
  color: "white",
  border: 0,
  borderRadius: 10,
  padding: "9px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};
const actionBtn = {
  border: "1px solid #e2e8f0",
  background: "white",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
const deleteBtn = {
  border: "1px solid #fca5a5",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

function formatNoteDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_COLORS = {
  Complete: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  WIP: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  "To Do": { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

export default function ProjectsTab({
  projectGroups, selectedProjectId, projectDraft, projectSaveMessage,
  taskDrafts, taskSaveMessage, savingProject, savingTask, teamMembers,
  projectNotes, onAddNote, onDeleteNote, onEditNote,
  onSelectProject, onCreateProject, onSaveProjectDetails, onDeleteProject,
  onAddTask, onSaveTask, onDeleteTask, onProjectDraftChange, onTaskDraftChange,
}) {
  const [personFilter, setPersonFilter] = useState("");
  const [view, setView] = useState("active");
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const realMembers = teamMembers.filter((p) => p.id !== "jt");

  const activeProjects = projectGroups.filter((p) => !p.completed);
  const completedProjects = projectGroups.filter((p) => p.completed);
  const filteredActive = personFilter ? activeProjects.filter((p) => p.primary_surveyor_id === personFilter) : activeProjects;
  const filteredCompleted = personFilter ? completedProjects.filter((p) => p.primary_surveyor_id === personFilter) : completedProjects;
  const displayedList = view === "completed" ? filteredCompleted : filteredActive;
  const selectedProject = projectGroups.find((p) => p.id === selectedProjectId) || projectGroups[0];

  const selectedNotes = (projectNotes || [])
    .filter((n) => n.project_id === selectedProjectId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  function handleSaveNote() {
    if (!noteText.trim()) return;
    onAddNote(selectedProjectId, noteText.trim());
    setNoteText("");
    setShowNoteForm(false);
  }

  function renderProjectButton(project) {
    const completeCount = project.tasks.filter((t) => t.status === "Complete").length;
    const total = project.tasks.length;
    const progress = total ? Math.round((completeCount / total) * 100) : 0;
    const lead = realMembers.find((m) => m.id === project.primary_surveyor_id);
    const isSelected = selectedProjectId === project.id;

    return (
      <button
        key={project.id}
        onClick={() => onSelectProject(project.id)}
        style={{
          textAlign: "left",
          border: isSelected ? "2px solid #0f172a" : "1px solid #e5e7eb",
          background: isSelected ? "#f8fafc" : "white",
          borderRadius: 14,
          padding: "12px 14px",
          cursor: "pointer",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: project.completed ? "#64748b" : "#0f172a" }}>
          {project.number} — {project.name}
        </div>
        {lead && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{lead.name}</div>
        )}
        {total > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 3 }}>
              <span>{completeCount}/{total} tasks</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 99 }}>
              <div style={{ height: 4, width: `${progress}%`, background: progress === 100 ? "#16a34a" : "#0f172a", borderRadius: 99, transition: "width 0.3s" }} />
            </div>
          </div>
        )}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
      {/* Sidebar */}
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Projects</div>
          {view === "active" && (
            <button onClick={onCreateProject} disabled={savingProject} style={{ ...actionBtn, opacity: savingProject ? 0.6 : 1 }}>
              + New
            </button>
          )}
        </div>

        {/* Active / Completed toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
          {["active", "completed"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: 8,
                border: 0,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                background: view === v ? "white" : "transparent",
                color: view === v ? "#0f172a" : "#64748b",
                boxShadow: view === v ? "0 1px 4px rgba(15,23,42,0.1)" : "none",
              }}
            >
              {v === "active" ? `Active (${filteredActive.length})` : `Completed (${filteredCompleted.length})`}
            </button>
          ))}
        </div>

        {/* Person filter */}
        <div style={{ marginBottom: 14 }}>
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            style={{ ...inputStyle, fontSize: 13 }}
          >
            <option value="">All team members</option>
            {realMembers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {displayedList.map(renderProjectButton)}
          {displayedList.length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
              {view === "completed" ? "No completed projects." : "No active projects."}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
        {selectedProject && (
          <>
            {/* Project Details */}
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Project Details</div>
                <button onClick={() => onDeleteProject(selectedProject.id)} disabled={savingProject} style={{ ...deleteBtn, opacity: savingProject ? 0.6 : 1 }}>
                  Delete Project
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Project number</label>
                  <input
                    value={projectDraft.number}
                    onChange={(e) => onProjectDraftChange((cur) => ({ ...cur, number: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Project name</label>
                  <input
                    value={projectDraft.name}
                    onChange={(e) => onProjectDraftChange((cur) => ({ ...cur, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Lead surveyor</label>
                  <select
                    value={projectDraft.primary_surveyor_id}
                    onChange={(e) => onProjectDraftChange((cur) => ({ ...cur, primary_surveyor_id: e.target.value }))}
                    style={inputStyle}
                  >
                    {realMembers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Comments</label>
                <textarea
                  rows={3}
                  value={projectDraft.comments || ""}
                  onChange={(e) => onProjectDraftChange((cur) => ({ ...cur, comments: e.target.value }))}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Any notes about this project..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: projectSaveMessage.isError ? "#dc2626" : "#16a34a", fontWeight: 500 }}>
                  {projectSaveMessage.text}
                </div>
                <button onClick={onSaveProjectDetails} disabled={savingProject} style={{ ...primaryBtn, opacity: savingProject ? 0.6 : 1 }}>
                  {savingProject ? "Saving..." : "Save Project"}
                </button>
              </div>
            </div>

            {/* Project Notes */}
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Notes</div>
                {!showNoteForm && (
                  <button onClick={() => setShowNoteForm(true)} disabled={savingProject} style={{ ...actionBtn, opacity: savingProject ? 0.6 : 1 }}>
                    + Add Note
                  </button>
                )}
              </div>

              {selectedNotes.length === 0 && !showNoteForm && (
                <div style={{ color: "#94a3b8", fontSize: 14 }}>No notes yet.</div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {selectedNotes.map((note) => (
                  <div key={note.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fafafa" }}>
                    {editingNoteId === note.id ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <textarea
                          rows={3}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => { onEditNote(note.id, editingNoteText); setEditingNoteId(null); }}
                            disabled={savingProject || !editingNoteText.trim()}
                            style={{ ...primaryBtn, opacity: (savingProject || !editingNoteText.trim()) ? 0.6 : 1 }}
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingNoteId(null)} style={actionBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>{formatNoteDate(note.created_at)}</div>
                          <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{note.content}</div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.content); }}
                            disabled={savingProject}
                            style={{ border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b", fontSize: 12, padding: "4px 8px", borderRadius: 8, fontWeight: 600 }}
                            title="Edit"
                          >
                            Edit
                          </button>
                          {onDeleteNote && (
                            <button
                              onClick={() => onDeleteNote(note.id)}
                              disabled={savingProject}
                              style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: "4px 6px" }}
                              title="Delete"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showNoteForm && (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write a note..."
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleSaveNote} disabled={savingProject || !noteText.trim()} style={{ ...primaryBtn, opacity: (savingProject || !noteText.trim()) ? 0.6 : 1 }}>
                      Save Note
                    </button>
                    <button onClick={() => { setShowNoteForm(false); setNoteText(""); }} style={actionBtn}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Project Tasks */}
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Tasks</div>
                <button onClick={onAddTask} disabled={savingTask} style={{ ...actionBtn, opacity: savingTask ? 0.6 : 1 }}>
                  + Add Task
                </button>
              </div>

              {selectedProject.tasks.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 14 }}>No tasks yet.</div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {selectedProject.tasks.map((task) => {
                  const draft = taskDrafts[task.id] || {
                    title: task.title || "",
                    assigned_to: task.assigned_to || "",
                    due_date: task.due_date || "",
                    status: task.status || "To Do",
                  };
                  const statusStyle = STATUS_COLORS[draft.status] || STATUS_COLORS["To Do"];

                  return (
                    <div
                      key={task.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: "14px 16px",
                        display: "grid",
                        gridTemplateColumns: "1.7fr 1fr 1fr 1fr auto auto",
                        gap: 10,
                        alignItems: "end",
                        background: "#fafafa",
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>Task</label>
                        <input
                          value={draft.title}
                          onChange={(e) => onTaskDraftChange((cur) => ({ ...cur, [task.id]: { ...draft, title: e.target.value } }))}
                          style={{ ...inputStyle, background: "white" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>Assigned</label>
                        <select
                          value={draft.assigned_to}
                          onChange={(e) => onTaskDraftChange((cur) => ({ ...cur, [task.id]: { ...draft, assigned_to: e.target.value } }))}
                          style={{ ...inputStyle, background: "white" }}
                        >
                          {realMembers.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>Due date</label>
                        <input
                          type="date"
                          value={draft.due_date}
                          onChange={(e) => onTaskDraftChange((cur) => ({ ...cur, [task.id]: { ...draft, due_date: e.target.value } }))}
                          style={{ ...inputStyle, background: "white" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>Status</label>
                        <select
                          value={draft.status}
                          onChange={(e) => onTaskDraftChange((cur) => ({ ...cur, [task.id]: { ...draft, status: e.target.value } }))}
                          style={{ ...inputStyle, background: "white", color: statusStyle.color, fontWeight: 600 }}
                        >
                          <option>Complete</option>
                          <option>WIP</option>
                          <option>To Do</option>
                        </select>
                      </div>
                      <button onClick={() => onSaveTask(task.id)} disabled={savingTask} style={{ ...primaryBtn, opacity: savingTask ? 0.6 : 1 }}>
                        {savingTask ? "..." : "Save"}
                      </button>
                      <button onClick={() => onDeleteTask(task.id)} disabled={savingTask} style={{ ...deleteBtn, opacity: savingTask ? 0.6 : 1 }}>
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>

              {taskSaveMessage.text && (
                <div style={{ marginTop: 12, fontSize: 13, color: taskSaveMessage.isError ? "#dc2626" : "#16a34a", fontWeight: 500 }}>
                  {taskSaveMessage.text}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
