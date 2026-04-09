import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import {
  addDays, calcLoadPercent, getMonthGrid, groupTasksByProject,
  makeId, projectSort, startOfWeek, sumHoursInRange, ymd,
} from "./utils/helpers";
import OverviewTab from "./components/OverviewTab";
import ProjectsTab from "./components/ProjectsTab";
import CalendarTab from "./components/CalendarTab";
import PersonTab from "./components/PersonTab";
import BookingModal from "./components/BookingModal";

// =============================================================================
// FALLBACK TEAM MEMBERS
// Change #1: Leon's weeklyCapacity is now 24. J team removed (Change #2).
// To manage team members from the database instead, run this SQL:
//
// CREATE TABLE team_members (
//   id TEXT PRIMARY KEY,
//   name TEXT NOT NULL,
//   weekly_capacity INTEGER NOT NULL
// );
// INSERT INTO team_members (id, name, weekly_capacity) VALUES
//   ('s1','Frankie',40), ('s4','Jackson',40),
//   ('s5','Leon',24), ('s3','Oment',40), ('s2','Tony',40);
// =============================================================================

const FALLBACK_TEAM_MEMBERS = [
  { id: "s1", name: "Frankie", weeklyCapacity: 40 },
  { id: "s4", name: "Jackson", weeklyCapacity: 40 },
  { id: "s5", name: "Leon", weeklyCapacity: 24 },
  { id: "s3", name: "Oment", weeklyCapacity: 40 },
  { id: "s2", name: "Tony", weeklyCapacity: 40 },
].sort((a, b) => a.name.localeCompare(b.name));

const FIRST_MEMBER_ID = FALLBACK_TEAM_MEMBERS[0]?.id || "s1";

// =============================================================================
// SQL TO RUN IN SUPABASE:
//
// -- Projects table additions (Change #5, #11):
// ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
// ALTER TABLE projects ADD COLUMN IF NOT EXISTS comments TEXT;
//
// -- Bookings table additions (Change #7):
// ALTER TABLE bookings ADD COLUMN IF NOT EXISTS linked_project_id TEXT;
// ALTER TABLE bookings ADD COLUMN IF NOT EXISTS linked_task_id TEXT;
//
// -- Project notes table (Change #10):
// CREATE TABLE project_notes (
//   id TEXT PRIMARY KEY,
//   project_id TEXT,
//   content TEXT,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
// =============================================================================

const EMPTY_BOOKING = {
  title: "",
  type: "Office",
  date: ymd(new Date()),
  assigned_to: FIRST_MEMBER_ID,
  assistant_assigned_to: "",
  hours: 4,
  tentative: false,
  linked_project_id: "",
  linked_task_id: "",
};

export default function App() {
  const [tab, setTab] = useState("overview");
  const [selectedPersonId, setSelectedPersonId] = useState(FIRST_MEMBER_ID);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [draggedBookingId, setDraggedBookingId] = useState(null);
  const [overviewWeekStart, setOverviewWeekStart] = useState(startOfWeek(new Date()));
  const [personMonth, setPersonMonth] = useState(new Date());

  const [teamMembers, setTeamMembers] = useState(FALLBACK_TEAM_MEMBERS);
  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [projectNotes, setProjectNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // Change #6: booking modal instead of tab
  const [bookingModal, setBookingModal] = useState({ open: false, date: "", personId: "" });
  const [newBooking, setNewBooking] = useState(EMPTY_BOOKING);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [bookingMessage, setBookingMessage] = useState({ text: "", isError: false });

  const [projectDraft, setProjectDraft] = useState({
    number: "",
    name: "",
    primary_surveyor_id: "",
    comments: "",
    completed: false,
  });
  const [projectSaveMessage, setProjectSaveMessage] = useState({ text: "", isError: false });
  const [taskDrafts, setTaskDrafts] = useState({});
  const [taskSaveMessage, setTaskSaveMessage] = useState({ text: "", isError: false });

  const teamMap = useMemo(() => Object.fromEntries(teamMembers.map((p) => [p.id, p])), [teamMembers]);
  const projectGroups = useMemo(() => groupTasksByProject(projectTasks, projects), [projectTasks, projects]);
  const currentPeriodStart = useMemo(() => startOfWeek(new Date()), []);

  const [currentMonthStart, currentMonthEnd, currentMonthWeeks] = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(0, 0, 0, 0);
    return [start, end, end.getDate() / 7];
  }, []);

  useEffect(() => {
    loadAllData();
  }, []);

  // Sync project draft when selected project changes
  useEffect(() => {
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    if (!selectedProject) return;

    setProjectDraft({
      number: selectedProject.number || "",
      name: selectedProject.name || "",
      primary_surveyor_id: selectedProject.primary_surveyor_id || "",
      comments: selectedProject.comments || "",
      completed: selectedProject.completed || false,
    });
    setProjectSaveMessage({ text: "", isError: false });
    setTaskSaveMessage({ text: "", isError: false });

    const drafts = {};
    projectTasks
      .filter((t) => t.project_id === selectedProjectId)
      .forEach((task) => {
        drafts[task.id] = {
          title: task.title || "",
          assigned_to: task.assigned_to || selectedProject.primary_surveyor_id || "",
          due_date: task.due_date || "",
          status: task.status || "To Do",
        };
      });
    setTaskDrafts(drafts);
  }, [selectedProjectId, projects, projectTasks]);

  async function loadAllData() {
    setLoading(true);

    const [tmRes, projectsRes, tasksRes, bookingsRes, notesRes] = await Promise.all([
      supabase.from("team_members").select("*"),
      supabase.from("projects").select("*").order("number", { ascending: true }),
      supabase.from("project_tasks").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("project_notes").select("*"),
    ]);

    // team_members is optional — fall back to hardcoded if the table doesn't exist
    if (!tmRes.error && tmRes.data?.length) {
      const mapped = tmRes.data
        .filter((m) => m.id !== "jt") // ensure J team is excluded even if still in DB
        .map((m) => ({
          id: m.id,
          name: m.name,
          weeklyCapacity: m.weekly_capacity,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setTeamMembers(mapped);
      const first = mapped[0];
      if (first) {
        setSelectedPersonId((cur) => cur || first.id);
        setNewBooking((cur) => ({ ...cur, assigned_to: cur.assigned_to || first.id }));
      }
    }

    if (projectsRes.error) setGlobalError(`Failed to load projects: ${projectsRes.error.message}`);
    if (tasksRes.error) setGlobalError(`Failed to load tasks: ${tasksRes.error.message}`);
    if (bookingsRes.error) setGlobalError(`Failed to load bookings: ${bookingsRes.error.message}`);
    // project_notes table is optional — don't error if it doesn't exist yet
    if (!notesRes.error && notesRes.data) {
      setProjectNotes(notesRes.data);
    }

    const nextProjects = projectsRes.data || [];
    setProjects(nextProjects);
    setProjectTasks(tasksRes.data || []);
    setBookings(bookingsRes.data || []);

    if (nextProjects.length) {
      setSelectedProjectId((cur) => {
        const stillExists = nextProjects.some((p) => p.id === cur);
        return cur && stillExists ? cur : nextProjects[0].id;
      });
    } else {
      setSelectedProjectId(null);
    }

    setLoading(false);
  }

  // --- Computed values ---

  const allWeeksLoad = useMemo(() => {
    const shownWeekEnd = addDays(overviewWeekStart, 6);
    const currentWeekEnd = addDays(currentPeriodStart, 6);
    const currentFortnightEnd = addDays(currentPeriodStart, 13);
    const currentFourWeekEnd = addDays(currentPeriodStart, 27);

    return teamMembers
      .map((person) => {
        const personBookings = bookings.filter(
          (b) => b.assigned_to === person.id || b.assistant_assigned_to === person.id
        );
        const shownWeekHours = sumHoursInRange(personBookings, overviewWeekStart, shownWeekEnd);
        const currentWeekHours = sumHoursInRange(personBookings, currentPeriodStart, currentWeekEnd);
        const currentFortnightHours = sumHoursInRange(personBookings, currentPeriodStart, currentFortnightEnd);
        const currentFourWeekHours = sumHoursInRange(personBookings, currentPeriodStart, currentFourWeekEnd);
        const currentMonthHours = sumHoursInRange(personBookings, currentMonthStart, currentMonthEnd);
        return {
          ...person,
          bookings: personBookings,
          shownWeekHours,
          currentWeekHours,
          currentFortnightHours,
          currentFourWeekHours,
          currentMonthHours,
          shownWeekPercent: calcLoadPercent(shownWeekHours, person, 1),
          currentWeekPercent: calcLoadPercent(currentWeekHours, person, 1),
          currentFortnightPercent: calcLoadPercent(currentFortnightHours, person, 2),
          currentFourWeekPercent: calcLoadPercent(currentFourWeekHours, person, 4),
          currentMonthPercent: calcLoadPercent(currentMonthHours, person, currentMonthWeeks),
          projectsLed: projects.filter((p) => p.primary_surveyor_id === person.id).sort(projectSort),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings, overviewWeekStart, projects, currentPeriodStart, currentMonthStart, currentMonthEnd, currentMonthWeeks, teamMembers]);

  const selectedPerson = allWeeksLoad.find((p) => p.id === selectedPersonId) || allWeeksLoad[0];

  const suggestionCards = useMemo(() => {
    const redPeople = allWeeksLoad.filter((p) => p.shownWeekPercent > 100);
    const lightPeople = allWeeksLoad.filter((p) => p.shownWeekPercent < 71);
    const weekEnd = addDays(overviewWeekStart, 6);

    return redPeople
      .map((person) => {
        const candidateBookings = bookings
          .filter((b) => {
            const d = new Date(`${b.date}T00:00:00`);
            return b.assigned_to === person.id && d >= overviewWeekStart && d <= weekEnd;
          })
          .sort((a, b) => new Date(`${a.date}T00:00:00`) - new Date(`${b.date}T00:00:00`));

        let best = null;
        candidateBookings.forEach((booking) => {
          lightPeople.forEach((target) => {
            if (target.id === person.id) return;
            const newSourcePct = calcLoadPercent(person.shownWeekHours - Number(booking.hours || 0), person, 1);
            const newTargetPct = calcLoadPercent(target.shownWeekHours + Number(booking.hours || 0), target, 1);
            const score = Math.abs(newSourcePct - 85) + Math.abs(newTargetPct - 85);
            if (!best || score < best.score) {
              best = { source: person, booking, target, newSourcePct, newTargetPct, score };
            }
          });
        });
        return best;
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);
  }, [allWeeksLoad, bookings, overviewWeekStart]);

  // --- Event handlers ---

  function openBookingModal(personId, dateKey) {
    setEditingBookingId(null);
    setBookingMessage({ text: "", isError: false });
    setNewBooking((cur) => ({
      ...EMPTY_BOOKING,
      assigned_to: personId || cur.assigned_to,
      date: dateKey || cur.date,
    }));
    setBookingModal({ open: true, date: dateKey || "", personId: personId || "" });
  }

  function closeBookingModal() {
    setBookingModal({ open: false, date: "", personId: "" });
    setEditingBookingId(null);
    setBookingMessage({ text: "", isError: false });
    setNewBooking({ ...EMPTY_BOOKING, assigned_to: teamMembers[0]?.id || FIRST_MEMBER_ID });
  }

  async function moveBooking(bookingId, nextPersonId, nextDate) {
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_to: nextPersonId, date: nextDate })
      .eq("id", bookingId);

    if (error) {
      setGlobalError(`Could not move booking: ${error.message}`);
      return;
    }
    setBookings((cur) =>
      cur.map((b) => b.id === bookingId ? { ...b, assigned_to: nextPersonId, date: nextDate } : b)
    );
  }

  async function saveProjectDetails() {
    if (!selectedProjectId) return;
    if (!projectDraft.number.trim() || !projectDraft.name.trim() || !projectDraft.primary_surveyor_id) {
      setProjectSaveMessage({ text: "Please fill in all project details first.", isError: true });
      return;
    }
    // MV7: prevent duplicate project numbers
    const duplicate = projects.find((p) => p.id !== selectedProjectId && String(p.number) === String(projectDraft.number).trim());
    if (duplicate) {
      setProjectSaveMessage({ text: `Project number ${projectDraft.number} is already used by "${duplicate.name}".`, isError: true });
      return;
    }
    setSavingProject(true);
    const { error } = await supabase
      .from("projects")
      .update({
        number: projectDraft.number,
        name: projectDraft.name,
        primary_surveyor_id: projectDraft.primary_surveyor_id,
        comments: projectDraft.comments,
        completed: projectDraft.completed,
      })
      .eq("id", selectedProjectId);
    setSavingProject(false);

    if (error) {
      setProjectSaveMessage({ text: `Could not save: ${error.message}`, isError: true });
      return;
    }
    setProjectSaveMessage({ text: "Project details saved.", isError: false });
    setProjects((cur) => cur.map((p) => p.id === selectedProjectId ? { ...p, ...projectDraft } : p));
  }

  async function saveProjectTask(taskId) {
    const draft = taskDrafts[taskId];
    if (!draft) return;
    if (!draft.title.trim() || !draft.assigned_to || !draft.due_date || !draft.status) {
      setTaskSaveMessage({ text: "Please complete all task fields before saving.", isError: true });
      return;
    }
    setSavingTask(true);
    const { error } = await supabase
      .from("project_tasks")
      .update({ title: draft.title, assigned_to: draft.assigned_to, due_date: draft.due_date, status: draft.status })
      .eq("id", taskId);
    setSavingTask(false);

    if (error) {
      setTaskSaveMessage({ text: `Could not save task: ${error.message}`, isError: true });
      return;
    }
    setTaskSaveMessage({ text: "Task saved.", isError: false });
    const updatedTasks = projectTasks.map((t) => t.id === taskId ? { ...t, ...draft } : t);
    setProjectTasks(updatedTasks);

    const task = projectTasks.find((t) => t.id === taskId);
    if (!task) return;
    const projectId = task.project_id;

    if (draft.status === "Complete") {
      // Auto-complete project when all its tasks are now Complete
      const relatedTasks = updatedTasks.filter((t) => t.project_id === projectId);
      const allComplete = relatedTasks.length > 0 && relatedTasks.every((t) => t.status === "Complete");
      if (allComplete) {
        const { error: projError } = await supabase.from("projects").update({ completed: true }).eq("id", projectId);
        if (projError) {
          setGlobalError(`Task saved, but could not close project: ${projError.message}`);
        } else {
          setProjects((cur) => cur.map((p) => p.id === projectId ? { ...p, completed: true } : p));
        }
      }
    } else {
      // Auto-reactivate project if a task is set back to non-Complete
      const project = projects.find((p) => p.id === projectId);
      if (project?.completed) {
        await supabase.from("projects").update({ completed: false }).eq("id", projectId);
        setProjects((cur) => cur.map((p) => p.id === projectId ? { ...p, completed: false } : p));
      }
    }
  }

  async function deleteProject(projectId) {
    const project = projects.find((p) => p.id === projectId);
    if (!window.confirm(`Delete project "${project?.name || projectId}"? This cannot be undone.`)) return;
    setSavingProject(true);
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    setSavingProject(false);

    if (error) {
      setGlobalError(`Could not delete project: ${error.message}`);
      return;
    }
    const remaining = projects.filter((p) => p.id !== projectId);
    setProjects(remaining);
    setProjectTasks((cur) => cur.filter((t) => t.project_id !== projectId));
    setSelectedProjectId(remaining.length ? remaining[0].id : null);
  }

  async function deleteProjectTask(taskId) {
    const task = projectTasks.find((t) => t.id === taskId);
    if (!window.confirm(`Delete task "${task?.title || taskId}"?`)) return;
    setSavingTask(true);
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    setSavingTask(false);

    if (error) {
      setGlobalError(`Could not delete task: ${error.message}`);
      return;
    }
    setProjectTasks((cur) => cur.filter((t) => t.id !== taskId));
    setTaskDrafts((cur) => { const next = { ...cur }; delete next[taskId]; return next; });
  }

  async function createProject() {
    const maxNum = projects.reduce((max, p) => { const n = parseInt(p.number, 10); return isNaN(n) ? max : Math.max(max, n); }, 24000);
    const nextNum = maxNum + 1;
    const leadId = teamMembers[0]?.id || "s1";
    const projectId = makeId("p");
    const firstTaskId = makeId("pt");
    const taskDueDate = ymd(addDays(new Date(), 3));

    setSavingProject(true);
    const { error: projectError } = await supabase.from("projects").insert({
      id: projectId,
      number: String(nextNum),
      name: `New Project ${projects.length + 1}`,
      primary_surveyor_id: leadId,
      completed: false,
      comments: "",
    });

    if (projectError) {
      setSavingProject(false);
      setProjectSaveMessage({ text: `Could not add project: ${projectError.message}`, isError: true });
      return;
    }

    const newProject = {
      id: projectId, number: String(nextNum), name: `New Project ${projects.length + 1}`,
      primary_surveyor_id: leadId, completed: false, comments: "",
    };

    const { error: taskError } = await supabase.from("project_tasks").insert({
      id: firstTaskId, title: "Initial task", project_id: projectId,
      assigned_to: leadId, due_date: taskDueDate, status: "To Do",
    });
    setSavingProject(false);

    const newTask = {
      id: firstTaskId, title: "Initial task", project_id: projectId,
      assigned_to: leadId, due_date: taskDueDate, status: "To Do",
    };

    if (taskError) {
      setProjectSaveMessage({ text: `Project created, but first task failed: ${taskError.message}`, isError: true });
    } else {
      setProjectTasks((cur) => [...cur, newTask]);
      setProjectSaveMessage({ text: "New project created.", isError: false });
    }
    setProjects((cur) => [...cur, newProject]);
    setSelectedProjectId(projectId);
    setTimeout(() => setProjectDraft({ number: "", name: "", primary_surveyor_id: leadId, comments: "", completed: false }), 0);
    setTab("projects");
  }

  async function createProjectForPerson({ number, name, leadId, comments = "" }) {
    const duplicate = projects.find((p) => String(p.number) === String(number));
    if (duplicate) {
      setGlobalError(`Project number ${number} is already in use by "${duplicate.name}".`);
      return;
    }
    const projectId = makeId("p");
    const firstTaskId = makeId("pt");
    const taskDueDate = ymd(addDays(new Date(), 3));

    setSavingProject(true);
    const { error: projectError } = await supabase.from("projects").insert({
      id: projectId,
      number: String(number),
      name,
      primary_surveyor_id: leadId,
      completed: false,
      comments,
    });

    if (projectError) {
      setSavingProject(false);
      setGlobalError(`Could not add project: ${projectError.message}`);
      return;
    }

    const newProject = {
      id: projectId, number: String(number), name,
      primary_surveyor_id: leadId, completed: false, comments,
    };

    const { error: taskError } = await supabase.from("project_tasks").insert({
      id: firstTaskId, title: "Initial task", project_id: projectId,
      assigned_to: leadId, due_date: taskDueDate, status: "To Do",
    });
    setSavingProject(false);

    const newTask = {
      id: firstTaskId, title: "Initial task", project_id: projectId,
      assigned_to: leadId, due_date: taskDueDate, status: "To Do",
    };

    if (!taskError) setProjectTasks((cur) => [...cur, newTask]);
    setProjects((cur) => [...cur, newProject]);
    setSelectedProjectId(projectId);
  }

  async function addProjectTask() {
    const selectedProject = projectGroups.find((p) => p.id === selectedProjectId);
    if (!selectedProject) return;

    const taskId = makeId("pt");
    const newTask = {
      id: taskId,
      title: `New task ${selectedProject.tasks.length + 1}`,
      project_id: selectedProject.id,
      assigned_to: selectedProject.primary_surveyor_id,
      due_date: ymd(addDays(new Date(), 7)),
      status: "To Do",
    };

    setSavingTask(true);
    const { error } = await supabase.from("project_tasks").insert(newTask);
    setSavingTask(false);

    if (error) {
      setTaskSaveMessage({ text: `Could not add task: ${error.message}`, isError: true });
      return;
    }
    setProjectTasks((cur) => [...cur, newTask]);
    setTaskDrafts((cur) => ({
      ...cur,
      [taskId]: { title: newTask.title, assigned_to: newTask.assigned_to, due_date: newTask.due_date, status: newTask.status },
    }));
    setTaskSaveMessage({ text: "New task added.", isError: false });
  }

  // Change #12: complete a task, cascade to next task and optionally close project
  async function completeTask(taskId) {
    const task = projectTasks.find((t) => t.id === taskId);
    if (!task) return;

    const { error: completeError } = await supabase
      .from("project_tasks").update({ status: "Complete" }).eq("id", taskId);
    if (completeError) {
      setGlobalError(`Could not complete task: ${completeError.message}`);
      return;
    }
    const updatedTasks = projectTasks.map((t) =>
      t.id === taskId ? { ...t, status: "Complete" } : t
    );
    setProjectTasks(updatedTasks);

    const projectId = task.project_id;
    const relatedTasks = updatedTasks.filter((t) => t.project_id === projectId);
    const allComplete = relatedTasks.every((t) => t.status === "Complete");

    if (allComplete) {
      const { error: projError } = await supabase
        .from("projects").update({ completed: true }).eq("id", projectId);
      if (projError) {
        setGlobalError(`Task completed, but could not close project: ${projError.message}`);
        return;
      }
      setProjects((cur) => cur.map((p) => p.id === projectId ? { ...p, completed: true } : p));
    } else {
      const nextTodo = relatedTasks
        .filter((t) => t.status === "To Do")
        .sort((a, b) => new Date(`${a.due_date}T00:00:00`) - new Date(`${b.due_date}T00:00:00`))[0];
      if (nextTodo) {
        const { error: nextError } = await supabase
          .from("project_tasks").update({ status: "WIP" }).eq("id", nextTodo.id);
        if (!nextError) {
          setProjectTasks((cur) =>
            cur.map((t) => t.id === nextTodo.id ? { ...t, status: "WIP" } : t)
          );
        }
      }
    }
  }

  async function createOrSaveBooking() {
    setBookingMessage({ text: "", isError: false });

    if (!newBooking.title.trim()) {
      setBookingMessage({ text: "Please enter a booking title.", isError: true });
      return;
    }
    const hours = Number(newBooking.hours);
    if (isNaN(hours) || hours <= 0) {
      setBookingMessage({ text: "Please enter a valid number of hours.", isError: true });
      return;
    }
    if (!newBooking.date) {
      setBookingMessage({ text: "Please select a date.", isError: true });
      return;
    }

    // Normalise assistant: "other:Name" → "Name", "other:" (blank) → null, "" → null
    const rawAssistant = newBooking.assistant_assigned_to || "";
    const assistantValue = rawAssistant.startsWith("other:")
      ? rawAssistant.slice(6).trim() || null
      : rawAssistant || null;

    const payload = {
      title: newBooking.title,
      type: newBooking.type,
      date: newBooking.date,
      assigned_to: newBooking.assigned_to,
      assistant_assigned_to: assistantValue,
      hours,
      tentative: newBooking.type === "Field" ? newBooking.tentative : false,
      linked_project_id: newBooking.linked_project_id || null,
      linked_task_id: newBooking.linked_task_id || null,
    };

    setSavingBooking(true);
    if (editingBookingId) {
      const { error } = await supabase.from("bookings").update(payload).eq("id", editingBookingId);
      setSavingBooking(false);
      if (error) {
        setBookingMessage({ text: `Could not save booking: ${error.message}`, isError: true });
        return;
      }
      setBookingMessage({ text: "Booking saved.", isError: false });
      setBookings((cur) => cur.map((b) => b.id === editingBookingId ? { ...b, ...payload } : b));
    } else {
      const id = makeId("b");
      const { error } = await supabase.from("bookings").insert({ id, ...payload });
      setSavingBooking(false);
      if (error) {
        setBookingMessage({ text: `Could not add booking: ${error.message}`, isError: true });
        return;
      }
      setBookingMessage({ text: "Booking added.", isError: false });
      setBookings((cur) => [...cur, { id, ...payload }]);
    }
    setEditingBookingId(null);
    // Close modal after successful save
    setTimeout(() => closeBookingModal(), 600);
  }

  function editBooking(booking) {
    setEditingBookingId(booking.id);
    setBookingMessage({ text: "", isError: false });
    const raw = booking.assistant_assigned_to || "";
    // If the stored value isn't a known member ID, treat it as a free-text "Other" name
    const isKnownMember = teamMembers.some((m) => m.id === raw);
    const assistantField = raw === "" || isKnownMember ? raw : `other:${raw}`;
    setNewBooking({
      title: booking.title,
      type: booking.type,
      date: booking.date,
      assigned_to: booking.assigned_to,
      assistant_assigned_to: assistantField,
      hours: booking.hours,
      tentative: booking.tentative,
      linked_project_id: booking.linked_project_id || "",
      linked_task_id: booking.linked_task_id || "",
    });
    setBookingModal({ open: true, date: booking.date, personId: booking.assigned_to });
  }

  async function deleteBooking() {
    if (!editingBookingId) return;
    setSavingBooking(true);
    const { error } = await supabase.from("bookings").delete().eq("id", editingBookingId);
    setSavingBooking(false);

    if (error) {
      setBookingMessage({ text: `Could not delete booking: ${error.message}`, isError: true });
      return;
    }
    setBookings((cur) => cur.filter((b) => b.id !== editingBookingId));
    setEditingBookingId(null);
    setBookingMessage({ text: "Booking deleted.", isError: false });
    setTimeout(() => closeBookingModal(), 600);
  }

  async function deleteProjectNote(noteId) {
    if (!window.confirm("Delete this note?")) return;
    const { error } = await supabase.from("project_notes").delete().eq("id", noteId);
    if (error) {
      setGlobalError(`Could not delete note: ${error.message}`);
      return;
    }
    setProjectNotes((cur) => cur.filter((n) => n.id !== noteId));
  }

  async function editProjectNote(noteId, content) {
    const { error } = await supabase.from("project_notes").update({ content }).eq("id", noteId);
    if (error) {
      setGlobalError(`Could not update note: ${error.message}`);
      return;
    }
    setProjectNotes((cur) => cur.map((n) => n.id === noteId ? { ...n, content } : n));
  }

  // Change #10: save project note
  async function saveProjectNote(projectId, content) {
    const id = makeId("pn");
    const { error, data } = await supabase
      .from("project_notes")
      .insert({ id, project_id: projectId, content })
      .select()
      .single();

    if (error) {
      setGlobalError(`Could not save note: ${error.message}`);
      return;
    }
    const note = data || { id, project_id: projectId, content, created_at: new Date().toISOString() };
    setProjectNotes((cur) => [...cur, note]);
  }

  function goToProject(projectId) {
    setSelectedProjectId(projectId);
    setTab("projects");
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(overviewWeekStart, i));
  const monthGrid = getMonthGrid(calendarMonth);
  const personMonthGrid = getMonthGrid(personMonth);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Inter, Arial, sans-serif" }}>
        Loading app...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "Inter, system-ui, Arial, sans-serif", color: "#0f172a" }}>
      {/* Top header bar */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 32px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: "-1px", padding: "8px 0" }}>K Team Workload Manager</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <img src="/images/kteam-logo.png" alt="K Team" style={{ height: 192, objectFit: "contain" }} />
            <img src="/images/everest-shield.png" alt="Everest Shield" style={{ height: 192, objectFit: "contain" }} />
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 32px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex", gap: 0 }}>
          {[["overview", "Overview"], ["projects", "Projects"], ["calendar", "Calendar"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                border: 0,
                borderBottom: tab === key ? "3px solid #0f172a" : "3px solid transparent",
                background: "transparent",
                color: tab === key ? "#0f172a" : "#64748b",
                padding: "14px 20px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 32px", display: "grid", gap: 0 }}>

        {globalError && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", color: "#991b1b", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 14 }}>{globalError}</span>
            <button onClick={() => setGlobalError("")} style={{ border: 0, background: "transparent", cursor: "pointer", fontWeight: 700, color: "#991b1b", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {tab === "overview" && (
          <OverviewTab
            week={week}
            allWeeksLoad={allWeeksLoad}
            bookings={bookings}
            overviewWeekStart={overviewWeekStart}
            draggedBookingId={draggedBookingId}
            suggestionCards={suggestionCards}
            onPrevWeek={() => setOverviewWeekStart((cur) => addDays(cur, -7))}
            onNextWeek={() => setOverviewWeekStart((cur) => addDays(cur, 7))}
            onThisWeek={() => setOverviewWeekStart(startOfWeek(new Date()))}
            onDragStart={setDraggedBookingId}
            onDragEnd={() => setDraggedBookingId(null)}
            onMoveBooking={moveBooking}
            onEditBooking={editBooking}
            onAddBookingForPersonDate={(personId, dateKey) => openBookingModal(personId, dateKey)}
            onSelectPerson={(personId) => { setSelectedPersonId(personId); setTab("person"); }}
            onApplySuggestion={(item) => moveBooking(item.booking.id, item.target.id, item.booking.date)}
          />
        )}

        {tab === "projects" && (
          <ProjectsTab
            projectGroups={projectGroups}
            selectedProjectId={selectedProjectId}
            projectDraft={projectDraft}
            projectSaveMessage={projectSaveMessage}
            taskDrafts={taskDrafts}
            taskSaveMessage={taskSaveMessage}
            savingProject={savingProject}
            savingTask={savingTask}
            teamMembers={teamMembers}
            projectNotes={projectNotes}
            onAddNote={saveProjectNote}
            onDeleteNote={deleteProjectNote}
            onEditNote={editProjectNote}
            onSelectProject={setSelectedProjectId}
            onCreateProject={createProject}
            onSaveProjectDetails={saveProjectDetails}
            onDeleteProject={deleteProject}
            onAddTask={addProjectTask}
            onSaveTask={saveProjectTask}
            onDeleteTask={deleteProjectTask}
            onProjectDraftChange={setProjectDraft}
            onTaskDraftChange={setTaskDrafts}
          />
        )}

        {tab === "calendar" && (
          <CalendarTab
            calendarMonth={calendarMonth}
            monthGrid={monthGrid}
            bookings={bookings}
            draggedBookingId={draggedBookingId}
            teamMap={teamMap}
            onPrevMonth={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNextMonth={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            onDragStart={setDraggedBookingId}
            onDragEnd={() => setDraggedBookingId(null)}
            onMoveBooking={moveBooking}
            onEditBooking={editBooking}
            onAddBookingForDate={(dateKey) => openBookingModal(null, dateKey)}
          />
        )}

        {tab === "person" && selectedPerson && (
          <PersonTab
            selectedPerson={selectedPerson}
            personMonth={personMonth}
            personMonthGrid={personMonthGrid}
            bookings={bookings}
            projectTasks={projectTasks}
            projects={projects}
            teamMembers={teamMembers}
            savingProject={savingProject}
            draggedBookingId={draggedBookingId}
            onPrevMonth={() => setPersonMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNextMonth={() => setPersonMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            onDragStart={setDraggedBookingId}
            onDragEnd={() => setDraggedBookingId(null)}
            onMoveBooking={moveBooking}
            onEditBooking={editBooking}
            onAddBookingForPersonDate={(personId, dateKey) => openBookingModal(personId, dateKey)}
            onGoToProject={goToProject}
            onCompleteTask={completeTask}
            onCreateProjectForPerson={createProjectForPerson}
          />
        )}
      </div>

      {/* Floating surveyor quick-nav — hidden on Personal Tab */}
      {tab !== "person" && (
        <div style={{ position: "fixed", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 500 }}>
          {teamMembers.map((member) => (
            <button
              key={member.id}
              title={member.name}
              onClick={() => { setSelectedPersonId(member.id); setTab("person"); }}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "2px solid white",
                background: "#0f172a",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 10px rgba(15,23,42,0.3)",
                flexShrink: 0,
              }}
            >
              {member.name[0]}
            </button>
          ))}
        </div>
      )}

      <BookingModal
        bookingModal={bookingModal}
        onCloseModal={closeBookingModal}
        newBooking={newBooking}
        editingBookingId={editingBookingId}
        bookingMessage={bookingMessage}
        saving={savingBooking}
        teamMembers={teamMembers}
        projects={projects}
        projectTasks={projectTasks}
        onNewBookingChange={setNewBooking}
        onSave={createOrSaveBooking}
        onDelete={deleteBooking}
      />
    </div>
  );
}
