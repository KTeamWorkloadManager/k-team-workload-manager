const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxSizing: "border-box",
  fontSize: 14,
  outline: "none",
  background: "#fafafa",
};

export default function BookingForm({
  newBooking, editingBookingId, bookingMessage, saving, teamMembers,
  projects, projectTasks,
  onNewBookingChange, onSave, onDelete, onCancel,
}) {
  const realMembers = teamMembers.filter((p) => p.id !== "jt");

  // Projects available to link: projects where the assigned person is the lead OR has a task,
  // plus the currently linked project so editing always shows the saved value
  const assignedTo = newBooking.assigned_to;
  const availableProjects = (projects || []).filter((p) => {
    if (p.completed && p.id !== newBooking.linked_project_id) return false;
    if (p.id === newBooking.linked_project_id) return true;
    if (p.primary_surveyor_id === assignedTo) return true;
    return (projectTasks || []).some((t) => t.project_id === p.id && t.assigned_to === assignedTo);
  });

  const linkedProjectId = newBooking.linked_project_id || "";
  const linkedTaskId = newBooking.linked_task_id || "";
  const availableTasks = linkedProjectId
    ? (projectTasks || []).filter(
        (t) => t.project_id === linkedProjectId && t.assigned_to === assignedTo &&
          (t.status !== "Complete" || t.id === linkedTaskId)
      )
    : [];

  function handleLinkedProjectChange(projectId) {
    const proj = (projects || []).find((p) => p.id === projectId);
    onNewBookingChange((s) => ({
      ...s,
      linked_project_id: projectId,
      linked_task_id: "",
      title: proj ? proj.name : s.title,
    }));
  }

  function handleLinkedTaskChange(taskId) {
    const task = (projectTasks || []).find((t) => t.id === taskId);
    const proj = (projects || []).find((p) => p.id === newBooking.linked_project_id);
    const autoTitle = task && proj ? `${proj.name} — ${task.title}` : newBooking.title;
    onNewBookingChange((s) => ({ ...s, linked_task_id: taskId, title: autoTitle }));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{editingBookingId ? "Edit Booking" : "New Booking"}</div>
        {editingBookingId && (
          <button
            onClick={onDelete}
            disabled={saving}
            style={{
              border: "1px solid #fca5a5",
              background: "#fff1f2",
              color: "#dc2626",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              opacity: saving ? 0.6 : 1,
            }}
          >
            Delete
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 14 }}>
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Booking title</label>
          <input
            value={newBooking.title}
            onChange={(e) => onNewBookingChange((s) => ({ ...s, title: e.target.value }))}
            style={inputStyle}
            placeholder="e.g. Site survey..."
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Type</label>
          <select
            value={newBooking.type}
            onChange={(e) => onNewBookingChange((s) => ({ ...s, type: e.target.value }))}
            style={inputStyle}
          >
            <option>Field</option>
            <option>Office</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Assigned to</label>
          <select
            value={newBooking.assigned_to}
            onChange={(e) => onNewBookingChange((s) => ({ ...s, assigned_to: e.target.value, linked_project_id: "", linked_task_id: "" }))}
            style={inputStyle}
          >
            {realMembers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Assistant</label>
          <select
            value={realMembers.some((p) => p.id === newBooking.assistant_assigned_to) || newBooking.assistant_assigned_to === "" ? newBooking.assistant_assigned_to : "other"}
            onChange={(e) => {
              if (e.target.value === "other") {
                onNewBookingChange((s) => ({ ...s, assistant_assigned_to: "other:" }));
              } else {
                onNewBookingChange((s) => ({ ...s, assistant_assigned_to: e.target.value }));
              }
            }}
            style={inputStyle}
          >
            <option value="">None</option>
            {realMembers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="other">Other...</option>
          </select>
          {newBooking.assistant_assigned_to?.startsWith("other:") && (
            <input
              value={newBooking.assistant_assigned_to.slice(6)}
              onChange={(e) => onNewBookingChange((s) => ({ ...s, assistant_assigned_to: `other:${e.target.value}` }))}
              placeholder="Enter name..."
              style={{ ...inputStyle, marginTop: 6 }}
            />
          )}
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Date</label>
          <input
            type="date"
            value={newBooking.date}
            onChange={(e) => onNewBookingChange((s) => ({ ...s, date: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Hours</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={newBooking.hours}
            onChange={(e) => onNewBookingChange((s) => ({ ...s, hours: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tentative</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#475569", paddingTop: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={newBooking.tentative}
              onChange={(e) => onNewBookingChange((s) => ({ ...s, tentative: e.target.checked }))}
              disabled={newBooking.type !== "Field"}
            />
            Mark as tentative
          </label>
        </div>

        <div style={{ gridColumn: "span 3" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Link to project</label>
          <select
            value={linkedProjectId}
            onChange={(e) => handleLinkedProjectChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">No project link</option>
            {availableProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.number} — {p.name}</option>
            ))}
          </select>
        </div>

        {linkedProjectId && (
          <div style={{ gridColumn: "span 3" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Link to task</label>
            <select
              value={linkedTaskId}
              onChange={(e) => handleLinkedTaskChange(e.target.value)}
              style={inputStyle}
            >
              <option value="">No specific task</option>
              {availableTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: bookingMessage.isError ? "#dc2626" : "#16a34a", fontWeight: 500 }}>
          {bookingMessage.text}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {(editingBookingId || onCancel) && (
            <button
              onClick={onCancel}
              style={{ border: "1px solid #e2e8f0", background: "white", borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            style={{ background: "#0f172a", color: "white", border: 0, borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : editingBookingId ? "Save Changes" : "Add Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
