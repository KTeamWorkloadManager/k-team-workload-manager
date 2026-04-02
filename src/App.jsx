import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const teamMembers = [
  { id: "s1", name: "Frankie", weeklyCapacity: 40 },
  { id: "s4", name: "Jackson", weeklyCapacity: 40 },
  { id: "jt", name: "J team", weeklyCapacity: 999 },
  { id: "s5", name: "Leon", weeklyCapacity: 32, targetCapacity: 32, minCapacity: 16 },
  { id: "s3", name: "Oment", weeklyCapacity: 40 },
  { id: "s2", name: "Tony", weeklyCapacity: 40 },
].sort((a, b) => a.name.localeCompare(b.name));

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function ymd(date) {
  const yr = date.getFullYear();
  const mo = `${date.getMonth() + 1}`.padStart(2, "0");
  const da = `${date.getDate()}`.padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function startOfWeek(date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function formatDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}

function getMonthGrid(baseDate) {
  const firstOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startDay = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -startDay);
  return Array.from({ length: 35 }, (_, i) => addDays(gridStart, i));
}

function bookingColor(booking) {
  if (booking.type === "Field" && booking.tentative) return "#fecaca";
  return booking.type === "Field" ? "#ffedd5" : "#dbeafe";
}

function loadColor(percent) {
  if (percent > 100) return "#7f1d1d";
  if (percent >= 91) return "#f97316";
  if (percent >= 71) return "#16a34a";
  return "#93c5fd";
}

function cardStyle() {
  return {
    background: "white",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15, 23, 42, 0.08)",
    border: "1px solid #e5e7eb",
  };
}

function projectStatusRank(status) {
  if (status === "Complete") return 3;
  if (status === "Due") return 2;
  return 1;
}

function projectSort(a, b) {
  return (a.number || "").localeCompare(b.number || "", undefined, { numeric: true });
}

function groupTasksByProject(tasks, projects) {
  return [...projects]
    .sort(projectSort)
    .map((project) => ({
      ...project,
      tasks: tasks
        .filter((task) => task.project_id === project.id)
        .sort(
          (a, b) =>
            parseDate(a.due_date) - parseDate(b.due_date) ||
            projectStatusRank(b.status) - projectStatusRank(a.status)
        ),
    }));
}

function calcLoadPercent(hours, person, weeks = 1) {
  const baseCapacity = (person.targetCapacity || person.weeklyCapacity) * weeks;
  return Math.round((hours / baseCapacity) * 100);
}

function makeId(prefix) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function sumHoursInRange(bookings, startDate, endDate) {
  return bookings
    .filter((booking) => {
      const date = parseDate(booking.date);
      return date >= startDate && date <= endDate;
    })
    .reduce((sum, booking) => sum + Number(booking.hours || 0), 0);
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [selectedPersonId, setSelectedPersonId] = useState(teamMembers[0].id);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [draggedBookingId, setDraggedBookingId] = useState(null);
  const [overviewWeekStart, setOverviewWeekStart] = useState(startOfWeek(new Date()));
  const [personMonth, setPersonMonth] = useState(new Date());

  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newBooking, setNewBooking] = useState({
    title: "",
    type: "Office",
    date: ymd(new Date()),
    assigned_to: teamMembers[0].id,
    assistant_assigned_to: "",
    hours: 4,
    tentative: false,
  });

  const [editingBookingId, setEditingBookingId] = useState(null);
  const [bookingMessage, setBookingMessage] = useState("");

  const [projectDraft, setProjectDraft] = useState({
    number: "",
    name: "",
    primary_surveyor_id: "",
  });
  const [projectSaveMessage, setProjectSaveMessage] = useState("");
  const [taskDrafts, setTaskDrafts] = useState({});
  const [taskSaveMessage, setTaskSaveMessage] = useState("");

  const teamMap = useMemo(() => Object.fromEntries(teamMembers.map((p) => [p.id, p])), []);
  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const projectGroups = useMemo(() => groupTasksByProject(projectTasks, projects), [projectTasks, projects]);

  const currentPeriodStart = useMemo(() => startOfWeek(new Date()), []);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (!selectedProject) return;

    setProjectDraft({
      number: selectedProject.number || "",
      name: selectedProject.name || "",
      primary_surveyor_id: selectedProject.primary_surveyor_id || "",
    });
    setProjectSaveMessage("");
    setTaskSaveMessage("");

    const selectedProjectTasks = projectTasks.filter((task) => task.project_id === selectedProjectId);
    const nextDrafts = {};
    selectedProjectTasks.forEach((task) => {
      nextDrafts[task.id] = {
        title: task.title || "",
        assigned_to: task.assigned_to || selectedProject.primary_surveyor_id || "",
        due_date: task.due_date || "",
        status: task.status || "Coming",
      };
    });
    setTaskDrafts(nextDrafts);
  }, [selectedProjectId, projects, projectTasks]);

  async function loadAllData() {
    setLoading(true);

    const [projectsRes, tasksRes, bookingsRes] = await Promise.all([
      supabase.from("projects").select("*").order("number", { ascending: true }),
      supabase.from("project_tasks").select("*"),
      supabase.from("bookings").select("*"),
    ]);

    if (projectsRes.error) console.error(projectsRes.error);
    if (tasksRes.error) console.error(tasksRes.error);
    if (bookingsRes.error) console.error(bookingsRes.error);

    const nextProjects = projectsRes.data || [];
    setProjects(nextProjects);
    setProjectTasks(tasksRes.data || []);
    setBookings(bookingsRes.data || []);

    if (nextProjects.length) {
      const stillExists = nextProjects.some((p) => p.id === selectedProjectId);
      if (!selectedProjectId || !stillExists) {
        setSelectedProjectId(nextProjects[0].id);
      }
    } else {
      setSelectedProjectId(null);
    }

    setLoading(false);
  }

  const allWeeksLoad = useMemo(() => {
    const shownWeekEnd = addDays(overviewWeekStart, 6);

    const currentWeekEnd = addDays(currentPeriodStart, 6);
    const currentFortnightEnd = addDays(currentPeriodStart, 13);
    const currentFourWeekEnd = addDays(currentPeriodStart, 27);

    return teamMembers
      .filter((person) => person.id !== "jt")
      .map((person) => {
        const personBookings = bookings.filter(
          (booking) => booking.assigned_to === person.id || booking.assistant_assigned_to === person.id
        );

        const shownWeekHours = sumHoursInRange(personBookings, overviewWeekStart, shownWeekEnd);
        const currentWeekHours = sumHoursInRange(personBookings, currentPeriodStart, currentWeekEnd);
        const currentFortnightHours = sumHoursInRange(personBookings, currentPeriodStart, currentFortnightEnd);
        const currentFourWeekHours = sumHoursInRange(personBookings, currentPeriodStart, currentFourWeekEnd);

        const projectsLed = projects.filter((project) => project.primary_surveyor_id === person.id).sort(projectSort);

        return {
          ...person,
          bookings: personBookings,
          shownWeekHours,
          currentWeekHours,
          currentFortnightHours,
          currentFourWeekHours,
          shownWeekPercent: calcLoadPercent(shownWeekHours, person, 1),
          currentWeekPercent: calcLoadPercent(currentWeekHours, person, 1),
          currentFortnightPercent: calcLoadPercent(currentFortnightHours, person, 2),
          currentFourWeekPercent: calcLoadPercent(currentFourWeekHours, person, 4),
          projectsLed,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings, overviewWeekStart, projects, currentPeriodStart]);

  const selectedPerson = allWeeksLoad.find((person) => person.id === selectedPersonId) || allWeeksLoad[0];
  const selectedProject = projectGroups.find((project) => project.id === selectedProjectId) || projectGroups[0];

  const suggestionCards = useMemo(() => {
    const redPeople = allWeeksLoad.filter((person) => person.shownWeekPercent > 100);
    const lightBluePeople = allWeeksLoad.filter((person) => person.shownWeekPercent < 71);

    return redPeople
      .map((person) => {
        const weekEnd = addDays(overviewWeekStart, 6);
        const candidateBookings = bookings
          .filter(
            (booking) =>
              booking.assigned_to === person.id &&
              parseDate(booking.date) >= overviewWeekStart &&
              parseDate(booking.date) <= weekEnd
          )
          .sort((a, b) => parseDate(a.date) - parseDate(b.date));

        let best = null;

        candidateBookings.forEach((booking) => {
          lightBluePeople.forEach((target) => {
            if (target.id === person.id) return;

            const newSourcePct = calcLoadPercent(person.shownWeekHours - Number(booking.hours || 0), person, 1);
            const newTargetPct = calcLoadPercent(target.shownWeekHours + Number(booking.hours || 0), target, 1);
            const score = Math.abs(newSourcePct - 85) + Math.abs(newTargetPct - 85);

            if (!best || score < best.score) {
              best = {
                source: person,
                booking,
                target,
                newSourcePct,
                newTargetPct,
                score,
              };
            }
          });
        });

        return best;
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);
  }, [allWeeksLoad, bookings, overviewWeekStart]);

  async function moveBooking(bookingId, nextPersonId, nextDate) {
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_to: nextPersonId, date: nextDate })
      .eq("id", bookingId);

    if (error) {
      console.error(error);
      return;
    }

    await loadAllData();
  }

  async function applySuggestion(item) {
    await moveBooking(item.booking.id, item.target.id, item.booking.date);
  }

  async function saveProjectDetails() {
    if (!selectedProjectId) return;

    if (!projectDraft.number.trim() || !projectDraft.name.trim() || !projectDraft.primary_surveyor_id) {
      setProjectSaveMessage("Please fill in all project details first.");
      return;
    }

    const { error } = await supabase
      .from("projects")
      .update({
        number: projectDraft.number,
        name: projectDraft.name,
        primary_surveyor_id: projectDraft.primary_surveyor_id,
      })
      .eq("id", selectedProjectId);

    if (error) {
      console.error(error);
      setProjectSaveMessage("Could not save project details.");
      return;
    }

    setProjectSaveMessage("Project details saved.");
    await loadAllData();
  }

  async function saveProjectTask(taskId) {
    const draft = taskDrafts[taskId];
    if (!draft) return;

    if (!draft.title.trim() || !draft.assigned_to || !draft.due_date || !draft.status) {
      setTaskSaveMessage("Please complete all task fields before saving.");
      return;
    }

    const { error } = await supabase
      .from("project_tasks")
      .update({
        title: draft.title,
        assigned_to: draft.assigned_to,
        due_date: draft.due_date,
        status: draft.status,
      })
      .eq("id", taskId);

    if (error) {
      console.error(error);
      setTaskSaveMessage("Could not save task.");
      return;
    }

    setTaskSaveMessage("Task saved.");
    await loadAllData();
  }

  async function deleteProject(projectId) {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      console.error(error);
      return;
    }
    await loadAllData();
  }

  async function deleteProjectTask(taskId) {
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) {
      console.error(error);
      return;
    }
    await loadAllData();
  }

  async function createProject() {
    const nextNum = 24000 + projects.length + 1;
    const leadId = teamMembers.find((p) => p.id !== "jt")?.id || "s1";
    const projectId = makeId("p");
    const firstTaskId = makeId("pt");

    const { error: projectError } = await supabase.from("projects").insert({
      id: projectId,
      number: String(nextNum),
      name: `New Project ${projects.length + 1}`,
      deadline: ymd(addDays(new Date(), 14)),
      primary_surveyor_id: leadId,
    });

    if (projectError) {
      console.error(projectError);
      setProjectSaveMessage(`Could not add project: ${projectError.message}`);
      return;
    }

    const { error: taskError } = await supabase.from("project_tasks").insert({
      id: firstTaskId,
      title: "Initial task",
      project_id: projectId,
      assigned_to: leadId,
      due_date: ymd(addDays(new Date(), 3)),
      status: "Coming",
    });

    if (taskError) {
      console.error(taskError);
      setProjectSaveMessage(`Project created, but first task failed: ${taskError.message}`);
      await loadAllData();
      setSelectedProjectId(projectId);
      return;
    }

    await loadAllData();
    setSelectedProjectId(projectId);
    setProjectSaveMessage("New project created.");
  }

  async function addProjectTask() {
    if (!selectedProject) return;

    const { error } = await supabase.from("project_tasks").insert({
      id: makeId("pt"),
      title: `New task ${selectedProject.tasks.length + 1}`,
      project_id: selectedProject.id,
      assigned_to: selectedProject.primary_surveyor_id,
      due_date: selectedProject.deadline,
      status: "Coming",
    });

    if (error) {
      console.error(error);
      setTaskSaveMessage(`Could not add task: ${error.message}`);
      return;
    }

    setTaskSaveMessage("New task added.");
    await loadAllData();
  }

  async function createOrSaveBooking() {
    setBookingMessage("");

    if (!newBooking.title.trim()) {
      setBookingMessage("Please enter a booking title.");
      return;
    }

    const payload = {
      ...newBooking,
      hours: Number(newBooking.hours),
      assistant_assigned_to: newBooking.assistant_assigned_to || null,
      tentative: newBooking.type === "Field" ? newBooking.tentative : false,
    };

    if (editingBookingId) {
      const { error } = await supabase.from("bookings").update(payload).eq("id", editingBookingId);
      if (error) {
        console.error(error);
        setBookingMessage(`Could not save booking: ${error.message}`);
        return;
      }
      setBookingMessage("Booking saved.");
    } else {
      const { error } = await supabase.from("bookings").insert({
        id: makeId("b"),
        ...payload,
      });
      if (error) {
        console.error(error);
        setBookingMessage(`Could not add booking: ${error.message}`);
        return;
      }
      setBookingMessage("Booking added.");
    }

    setEditingBookingId(null);
    setNewBooking((current) => ({
      ...current,
      title: "",
      hours: 4,
      assistant_assigned_to: "",
      tentative: false,
    }));

    await loadAllData();
  }

  function editBooking(booking) {
    setEditingBookingId(booking.id);
    setBookingMessage("");
    setNewBooking({
      title: booking.title,
      type: booking.type,
      date: booking.date,
      assigned_to: booking.assigned_to,
      assistant_assigned_to: booking.assistant_assigned_to || "",
      hours: booking.hours,
      tentative: booking.tentative,
    });
    setTab("new");
  }

  async function deleteBooking() {
    if (!editingBookingId) return;

    const { error } = await supabase.from("bookings").delete().eq("id", editingBookingId);
    if (error) {
      console.error(error);
      return;
    }

    setEditingBookingId(null);
    setBookingMessage("Booking deleted.");
    setNewBooking({
      title: "",
      type: "Office",
      date: ymd(new Date()),
      assigned_to: teamMembers[0].id,
      assistant_assigned_to: "",
      hours: 4,
      tentative: false,
    });

    await loadAllData();
    setTab("new");
  }

  function goToProject(projectId) {
    setSelectedProjectId(projectId);
    setTab("projects");
  }

  const monthGrid = getMonthGrid(calendarMonth);
  const selectedMonthIndex = calendarMonth.getMonth();
  const week = Array.from({ length: 7 }, (_, i) => addDays(overviewWeekStart, i));
  const personMonthGrid = getMonthGrid(personMonth);
  const personMonthIndex = personMonth.getMonth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Inter, Arial, sans-serif" }}>
        Loading app...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "Inter, Arial, sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 1480, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>K Team Workload Manager</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[["overview", "Overview"], ["projects", "Projects"], ["calendar", "Calendar"], ["new", "Add Booking"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                border: "1px solid #cbd5e1",
                background: tab === key ? "#0f172a" : "white",
                color: tab === key ? "white" : "#0f172a",
                borderRadius: 14,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>Weekly Calendar</div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>{formatDate(ymd(week[0]))} to {formatDate(ymd(week[6]))}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setOverviewWeekStart((current) => addDays(current, -7))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>Prev Week</button>
                  <button onClick={() => setOverviewWeekStart(startOfWeek(new Date()))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>This Week</button>
                  <button onClick={() => setOverviewWeekStart((current) => addDays(current, 7))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>Next Week</button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "220px repeat(7, minmax(150px, 1fr))", gap: 8, minWidth: 1320 }}>
                  <div style={{ padding: 12, fontWeight: 700 }}>Surveyor</div>
                  {week.map((date) => (
                    <div key={ymd(date)} style={{ padding: 12, fontWeight: 700, background: "#f1f5f9", borderRadius: 12 }}>
                      {formatDate(ymd(date))}
                    </div>
                  ))}

                  {allWeeksLoad.map((person) => (
                    <React.Fragment key={person.id}>
                      <button
                        onClick={() => {
                          setSelectedPersonId(person.id);
                          setTab("person");
                        }}
                        style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, fontWeight: 700, textAlign: "left", background: "white", cursor: "pointer" }}
                      >
                        {person.name} <span style={{ color: loadColor(person.shownWeekPercent) }}>({person.shownWeekPercent}%)</span>
                      </button>

                      {week.map((date) => {
                        const dateKey = ymd(date);
                        const dayBookings = bookings
                          .filter(
                            (booking) =>
                              booking.date === dateKey &&
                              (booking.assigned_to === person.id || booking.assistant_assigned_to === person.id)
                          )
                          .sort((a, b) => a.title.localeCompare(b.title));

                        return (
                          <div
                            key={`${person.id}-${dateKey}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedBookingId) moveBooking(draggedBookingId, person.id, dateKey);
                              setDraggedBookingId(null);
                            }}
                            onClick={() => {
                              setEditingBookingId(null);
                              setBookingMessage("");
                              setNewBooking((current) => ({ ...current, assigned_to: person.id, assistant_assigned_to: "", date: dateKey }));
                              setTab("new");
                            }}
                            style={{ minHeight: 100, padding: 10, border: "1px solid #e5e7eb", borderRadius: 12, background: "#ffffff", cursor: "pointer" }}
                          >
                            <div style={{ display: "grid", gap: 8 }}>
                              {dayBookings.map((booking) => {
                                const isAssistant = booking.assistant_assigned_to === person.id;
                                return (
                                  <div
                                    key={`${booking.id}-${person.id}`}
                                    draggable={!isAssistant}
                                    onDragStart={(e) => {
                                      if (isAssistant) return;
                                      e.stopPropagation();
                                      setDraggedBookingId(booking.id);
                                    }}
                                    onDragEnd={() => setDraggedBookingId(null)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editBooking(booking);
                                    }}
                                    style={{ borderRadius: 10, padding: 8, background: bookingColor(booking), cursor: isAssistant ? "pointer" : "grab", opacity: isAssistant ? 0.9 : 1 }}
                                  >
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{booking.title}</div>
                                    <div style={{ fontSize: 12 }}>{booking.type} · {booking.hours}h{isAssistant ? " · Assistant" : ""}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "#475569" }}>
                <div><span style={{ display: "inline-block", width: 12, height: 12, background: "#dbeafe", borderRadius: 3, marginRight: 6 }} />Office</div>
                <div><span style={{ display: "inline-block", width: 12, height: 12, background: "#ffedd5", borderRadius: 3, marginRight: 6 }} />Field</div>
                <div><span style={{ display: "inline-block", width: 12, height: 12, background: "#fecaca", borderRadius: 3, marginRight: 6 }} />Tentative Field</div>
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Team Overview</div>
              <div style={{ display: "grid", gap: 12 }}>
                {allWeeksLoad.map((person) => (
                  <div key={person.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
                      <button
                        onClick={() => {
                          setSelectedPersonId(person.id);
                          setTab("person");
                        }}
                        style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", fontWeight: 700, fontSize: 18, cursor: "pointer", color: "#0f172a" }}
                      >
                        {person.name}
                      </button>

                      <div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Current week</div>
                        <div style={{ color: loadColor(person.currentWeekPercent), fontWeight: 800, fontSize: 24 }}>{person.currentWeekPercent}%</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {person.currentWeekHours}h / {(person.targetCapacity || person.weeklyCapacity)}h
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Current fortnight</div>
                        <div style={{ color: loadColor(person.currentFortnightPercent), fontWeight: 800, fontSize: 24 }}>{person.currentFortnightPercent}%</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {person.currentFortnightHours}h / {(person.targetCapacity || person.weeklyCapacity) * 2}h
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Current 4 weeks</div>
                        <div style={{ color: loadColor(person.currentFourWeekPercent), fontWeight: 800, fontSize: 24 }}>{person.currentFourWeekPercent}%</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {person.currentFourWeekHours}h / {(person.targetCapacity || person.weeklyCapacity) * 4}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Suggested Rebalancing</div>
              <div style={{ display: "grid", gap: 12 }}>
                {suggestionCards.length === 0 && <div style={{ color: "#64748b" }}>No rebalancing suggested right now.</div>}
                {suggestionCards.map((item) => (
                  <button key={item.source.id + item.booking.id} onClick={() => applySuggestion(item)} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>Move {item.booking.title}</div>
                      <span style={{ borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 700, background: "#f3f4f6", color: "#374151" }}>{item.booking.type}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#475569", display: "grid", gap: 4 }}>
                      <div><strong>Suggestion:</strong> {item.source.name} → {item.target.name}</div>
                      <div><strong>Effect:</strong> {item.source.name} {item.source.shownWeekPercent}% to {item.newSourcePct}%, {item.target.name} {item.target.shownWeekPercent}% to {item.newTargetPct}%</div>
                      <div style={{ marginTop: 8, color: "#0f172a", fontWeight: 600 }}>Click to apply suggestion</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "projects" && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Projects</div>
                <button onClick={createProject} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 600 }}>New</button>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {projectGroups.map((project) => {
                  const completeCount = project.tasks.filter((task) => task.status === "Complete").length;
                  const progress = project.tasks.length ? Math.round((completeCount / project.tasks.length) * 100) : 0;
                  return (
                    <button key={project.id} onClick={() => setSelectedProjectId(project.id)} style={{ textAlign: "left", border: selectedProjectId === project.id ? "2px solid #0f172a" : "1px solid #e5e7eb", background: "white", borderRadius: 16, padding: 14, cursor: "pointer" }}>
                      <div style={{ fontWeight: 700 }}>{project.number} — {project.name}</div>
                      <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{project.tasks.length} tasks · {progress}% complete</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {selectedProject && (
                <>
                  <div style={cardStyle()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>Project Details</div>
                      <button onClick={() => deleteProject(selectedProject.id)} style={{ border: "1px solid #ef4444", background: "white", color: "#b91c1c", borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 600 }}>Delete Project</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 6 }}>Project number</div>
                        <input
                          value={projectDraft.number}
                          onChange={(e) => setProjectDraft((current) => ({ ...current, number: e.target.value }))}
                          style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 6 }}>Project name</div>
                        <input
                          value={projectDraft.name}
                          onChange={(e) => setProjectDraft((current) => ({ ...current, name: e.target.value }))}
                          style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 6 }}>Lead</div>
                        <select
                          value={projectDraft.primary_surveyor_id}
                          onChange={(e) => setProjectDraft((current) => ({ ...current, primary_surveyor_id: e.target.value }))}
                          style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                        >
                          {teamMembers.map((person) => (
                            <option key={person.id} value={person.id}>{person.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
                      <div style={{ color: projectSaveMessage === "Project details saved." || projectSaveMessage === "New project created." ? "#166534" : "#64748b", fontSize: 14 }}>
                        {projectSaveMessage}
                      </div>
                      <button
                        onClick={saveProjectDetails}
                        style={{ background: "#0f172a", color: "white", border: 0, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 600 }}
                      >
                        Save Project Details
                      </button>
                    </div>
                  </div>

                  <div style={cardStyle()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>Project Tasks</div>
                      <button onClick={addProjectTask} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 600 }}>Add Task</button>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      {selectedProject.tasks.map((task) => {
                        const draft = taskDrafts[task.id] || {
                          title: task.title || "",
                          assigned_to: task.assigned_to || "",
                          due_date: task.due_date || "",
                          status: task.status || "Coming",
                        };

                        return (
                          <div
                            key={task.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 16,
                              padding: 14,
                              display: "grid",
                              gridTemplateColumns: "1.7fr 1fr 1fr 1fr auto auto",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14, marginBottom: 6 }}>Task</div>
                              <input
                                value={draft.title}
                                onChange={(e) =>
                                  setTaskDrafts((current) => ({
                                    ...current,
                                    [task.id]: { ...draft, title: e.target.value },
                                  }))
                                }
                                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 14, marginBottom: 6 }}>Assigned</div>
                              <select
                                value={draft.assigned_to}
                                onChange={(e) =>
                                  setTaskDrafts((current) => ({
                                    ...current,
                                    [task.id]: { ...draft, assigned_to: e.target.value },
                                  }))
                                }
                                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                              >
                                {teamMembers.map((person) => (
                                  <option key={person.id} value={person.id}>{person.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div style={{ fontSize: 14, marginBottom: 6 }}>Due date</div>
                              <input
                                type="date"
                                value={draft.due_date}
                                onChange={(e) =>
                                  setTaskDrafts((current) => ({
                                    ...current,
                                    [task.id]: { ...draft, due_date: e.target.value },
                                  }))
                                }
                                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 14, marginBottom: 6 }}>Status</div>
                              <select
                                value={draft.status}
                                onChange={(e) =>
                                  setTaskDrafts((current) => ({
                                    ...current,
                                    [task.id]: { ...draft, status: e.target.value },
                                  }))
                                }
                                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
                              >
                                <option>Complete</option>
                                <option>Due</option>
                                <option>Coming</option>
                              </select>
                            </div>

                            <div style={{ paddingTop: 28 }}>
                              <button
                                onClick={() => saveProjectTask(task.id)}
                                style={{
                                  background: "#0f172a",
                                  color: "white",
                                  border: 0,
                                  borderRadius: 12,
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Save
                              </button>
                            </div>

                            <div style={{ paddingTop: 28 }}>
                              <button
                                onClick={() => deleteProjectTask(task.id)}
                                style={{
                                  border: "1px solid #ef4444",
                                  background: "white",
                                  color: "#b91c1c",
                                  borderRadius: 12,
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 16, color: taskSaveMessage === "Task saved." || taskSaveMessage === "New task added." ? "#166534" : "#64748b", fontSize: 14 }}>
                      {taskSaveMessage}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "calendar" && (
          <div style={cardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Monthly Calendar</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>Click booking to edit. Click blank day space to add a booking.</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>Prev</button>
                <div style={{ fontWeight: 700 }}>{formatMonthLabel(calendarMonth)}</div>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>Next</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} style={{ fontWeight: 700, padding: 10 }}>{d}</div>)}

              {monthGrid.map((date) => {
                const dateKey = ymd(date);
                const dayBookings = bookings.filter((booking) => booking.date === dateKey).sort((a, b) => a.title.localeCompare(b.title));
                const inMonth = date.getMonth() === selectedMonthIndex;

                return (
                  <div
                    key={dateKey}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedBookingId) {
                        const booking = bookings.find((b) => b.id === draggedBookingId);
                        if (booking) moveBooking(booking.id, booking.assigned_to, dateKey);
                      }
                      setDraggedBookingId(null);
                    }}
                    onClick={() => {
                      setEditingBookingId(null);
                      setBookingMessage("");
                      setNewBooking((cur) => ({ ...cur, date: dateKey }));
                      setTab("new");
                    }}
                    style={{ minHeight: 140, padding: 8, border: "1px solid #e5e7eb", borderRadius: 12, background: inMonth ? "white" : "#f8fafc", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: inMonth ? "#0f172a" : "#94a3b8" }}>{date.getDate()}</div>
                    {dayBookings.map((booking) => (
                      <div
                        key={booking.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggedBookingId(booking.id);
                        }}
                        onDragEnd={() => setDraggedBookingId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          editBooking(booking);
                        }}
                        style={{ background: bookingColor(booking), borderRadius: 8, padding: 6, fontSize: 11, cursor: "grab" }}
                      >
                        <div style={{ fontWeight: 700 }}>{teamMap[booking.assigned_to]?.name}</div>
                        <div>{booking.title}</div>
                        <div>{booking.hours}h{booking.assistant_assigned_to ? ` · Asst: ${teamMap[booking.assistant_assigned_to]?.name}` : ""}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "person" && selectedPerson && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{selectedPerson.name}</div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>Personal workload view</div>
                </div>
                <div style={{ color: loadColor(selectedPerson.shownWeekPercent), fontWeight: 800, fontSize: 28 }}>{selectedPerson.shownWeekPercent}%</div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Projects they lead</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {selectedPerson.projectsLed.length === 0 && <div style={{ color: "#64748b" }}>No lead projects.</div>}
                    {selectedPerson.projectsLed.map((project) => (
                      <button key={project.id} onClick={() => goToProject(project.id)} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, textAlign: "left", background: "white", cursor: "pointer" }}>
                        <div style={{ fontWeight: 700 }}>{project.number} — {project.name}</div>
                        <div style={{ color: "#475569", fontSize: 14, marginTop: 8 }}>Deadline: {formatDate(project.deadline)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={cardStyle()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>Personal Calendar</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button onClick={() => setPersonMonth(new Date(personMonth.getFullYear(), personMonth.getMonth() - 1, 1))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>Prev</button>
                      <div style={{ fontWeight: 700 }}>{formatMonthLabel(personMonth)}</div>
                      <button onClick={() => setPersonMonth(new Date(personMonth.getFullYear(), personMonth.getMonth() + 1, 1))} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>Next</button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} style={{ fontWeight: 700, padding: 10 }}>{d}</div>)}

                    {personMonthGrid.map((date) => {
                      const dateKey = ymd(date);
                      const dayBookings = bookings
                        .filter((booking) => booking.date === dateKey && (booking.assigned_to === selectedPerson.id || booking.assistant_assigned_to === selectedPerson.id))
                        .sort((a, b) => a.title.localeCompare(b.title));

                      const dueTasks = projectTasks
                        .filter((task) => task.assigned_to === selectedPerson.id && task.due_date === dateKey && task.status !== "Complete")
                        .sort((a, b) => a.title.localeCompare(b.title));

                      const inMonth = date.getMonth() === personMonthIndex;

                      return (
                        <div
                          key={dateKey}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedBookingId) moveBooking(draggedBookingId, selectedPerson.id, dateKey);
                            setDraggedBookingId(null);
                          }}
                          onClick={() => {
                            setEditingBookingId(null);
                            setBookingMessage("");
                            setNewBooking((cur) => ({ ...cur, date: dateKey, assigned_to: selectedPerson.id, assistant_assigned_to: "" }));
                            setTab("new");
                          }}
                          style={{ minHeight: 160, padding: 8, border: "1px solid #e5e7eb", borderRadius: 12, background: inMonth ? "white" : "#f8fafc", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: inMonth ? "#0f172a" : "#94a3b8" }}>{date.getDate()}</div>

                          {dayBookings.map((booking) => {
                            const isAssistant = booking.assistant_assigned_to === selectedPerson.id;
                            return (
                              <div
                                key={`${booking.id}-${selectedPerson.id}`}
                                draggable={!isAssistant}
                                onDragStart={(e) => {
                                  if (isAssistant) return;
                                  e.stopPropagation();
                                  setDraggedBookingId(booking.id);
                                }}
                                onDragEnd={() => setDraggedBookingId(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  editBooking(booking);
                                }}
                                style={{ background: bookingColor(booking), borderRadius: 8, padding: 6, fontSize: 11, cursor: isAssistant ? "pointer" : "grab" }}
                              >
                                <div style={{ fontWeight: 700 }}>{booking.title}</div>
                                <div>{booking.hours}h{isAssistant ? " · Assistant" : ""}</div>
                              </div>
                            );
                          })}

                          {dueTasks.map((task) => (
                            <button
                              key={task.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                goToProject(task.project_id);
                              }}
                              style={{ border: "1px solid #7f1d1d", background: "#7f1d1d", color: "white", borderRadius: 8, padding: 6, fontSize: 11, textAlign: "left", cursor: "pointer" }}
                            >
                              <div style={{ fontWeight: 700 }}>Due: {task.title}</div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "new" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={cardStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{editingBookingId ? "Edit Booking" : "Add a New Booking"}</div>
                {editingBookingId && (
                  <button onClick={deleteBooking} style={{ border: "1px solid #ef4444", background: "white", color: "#b91c1c", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 600 }}>
                    Delete Booking
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 14 }}>
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Booking title</div>
                  <input value={newBooking.title} onChange={(e) => setNewBooking((s) => ({ ...s, title: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Type</div>
                  <select value={newBooking.type} onChange={(e) => setNewBooking((s) => ({ ...s, type: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}>
                    <option>Field</option>
                    <option>Office</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Assigned to</div>
                  <select value={newBooking.assigned_to} onChange={(e) => setNewBooking((s) => ({ ...s, assigned_to: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}>
                    {teamMembers.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Assistant</div>
                  <select value={newBooking.assistant_assigned_to} onChange={(e) => setNewBooking((s) => ({ ...s, assistant_assigned_to: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}>
                    <option value="">None</option>
                    {teamMembers.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Date</div>
                  <input type="date" value={newBooking.date} onChange={(e) => setNewBooking((s) => ({ ...s, date: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Hours</div>
                  <input type="number" value={newBooking.hours} onChange={(e) => setNewBooking((s) => ({ ...s, hours: e.target.value }))} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Tentative field</div>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#475569", paddingTop: 10 }}>
                    <input type="checkbox" checked={newBooking.tentative} onChange={(e) => setNewBooking((s) => ({ ...s, tentative: e.target.checked }))} disabled={newBooking.type !== "Field"} />
                    Mark as tentative
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
                <div style={{ color: bookingMessage === "Booking added." || bookingMessage === "Booking saved." || bookingMessage === "Booking deleted." ? "#166534" : "#64748b", fontSize: 14 }}>
                  {bookingMessage}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {editingBookingId && (
                    <button
                      onClick={() => {
                        setEditingBookingId(null);
                        setBookingMessage("");
                        setNewBooking({
                          title: "",
                          type: "Office",
                          date: ymd(new Date()),
                          assigned_to: teamMembers[0].id,
                          assistant_assigned_to: "",
                          hours: 4,
                          tentative: false,
                        });
                      }}
                      style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                  )}
                  <button onClick={createOrSaveBooking} style={{ background: "#0f172a", color: "white", border: 0, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 600 }}>
                    {editingBookingId ? "Save Booking" : "Add Booking"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}