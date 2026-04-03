import React from "react";
import { bookingColor, cardStyle, formatDate, loadBg, loadColor, ymd } from "../utils/helpers";

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

export default function OverviewTab({
  week, allWeeksLoad, bookings, draggedBookingId,
  suggestionCards, onPrevWeek, onNextWeek, onThisWeek,
  onDragStart, onDragEnd, onMoveBooking, onEditBooking,
  onAddBookingForPersonDate, onSelectPerson, onApplySuggestion,
}) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Weekly Calendar */}
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Weekly Calendar</div>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 14 }}>
              {formatDate(ymd(week[0]))} — {formatDate(ymd(week[6]))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={onPrevWeek} style={navBtn}>← Prev</button>
            <button onClick={onThisWeek} style={{ ...navBtn, background: "#0f172a", color: "white", border: "1px solid #0f172a" }}>Today</button>
            <button onClick={onNextWeek} style={navBtn}>Next →</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "200px repeat(7, minmax(140px, 1fr))", gap: 6, minWidth: 1200 }}>
            <div style={{ padding: "8px 12px", fontWeight: 700, fontSize: 13, color: "#64748b" }}>Surveyor</div>
            {week.map((date) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isToday = ymd(date) === ymd(new Date());
              return (
                <div
                  key={ymd(date)}
                  style={{
                    padding: "8px 10px",
                    fontWeight: 700,
                    fontSize: 12,
                    borderRadius: 10,
                    background: isToday ? "#0f172a" : isWeekend ? "#f8fafc" : "#f1f5f9",
                    color: isToday ? "white" : isWeekend ? "#94a3b8" : "#374151",
                    textAlign: "center",
                  }}
                >
                  {formatDate(ymd(date))}
                </div>
              );
            })}

            {allWeeksLoad.map((person) => (
              <React.Fragment key={person.id}>
                <button
                  onClick={() => onSelectPerson(person.id)}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    fontWeight: 700,
                    textAlign: "left",
                    background: "white",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{person.name}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: loadColor(person.shownWeekPercent),
                      background: loadBg(person.shownWeekPercent),
                      borderRadius: 8,
                      padding: "2px 7px",
                    }}
                  >
                    {person.shownWeekPercent}%
                  </span>
                </button>

                {week.map((date) => {
                  const dateKey = ymd(date);
                  const dayBookings = bookings
                    .filter((b) => b.date === dateKey && (b.assigned_to === person.id || b.assistant_assigned_to === person.id))
                    .sort((a, b) => a.title.localeCompare(b.title));
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div
                      key={`${person.id}-${dateKey}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedBookingId) onMoveBooking(draggedBookingId, person.id, dateKey);
                        onDragEnd();
                      }}
                      onClick={() => onAddBookingForPersonDate(person.id, dateKey)}
                      style={{
                        minHeight: 90,
                        padding: 6,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        background: isWeekend ? "#f8fafc" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        opacity: isWeekend ? 0.6 : 1,
                      }}
                    >
                      {dayBookings.map((booking) => {
                        const isAssistant = booking.assistant_assigned_to === person.id;
                        return (
                          <div
                            key={`${booking.id}-${person.id}`}
                            draggable={!isAssistant}
                            onDragStart={(e) => {
                              if (isAssistant) return;
                              e.stopPropagation();
                              onDragStart(booking.id);
                            }}
                            onDragEnd={onDragEnd}
                            onClick={(e) => { e.stopPropagation(); onEditBooking(booking); }}
                            style={{
                              borderRadius: 8,
                              padding: "5px 7px",
                              background: bookingColor(booking),
                              cursor: isAssistant ? "pointer" : "grab",
                              opacity: isAssistant ? 0.85 : 1,
                              borderLeft: isAssistant ? "3px solid rgba(0,0,0,0.15)" : "none",
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{booking.title}</div>
                            <div style={{ fontSize: 11, color: "#475569" }}>{booking.hours}h{isAssistant ? " · Asst" : ""}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "#64748b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 14, height: 14, background: "#dbeafe", borderRadius: 4, border: "1px solid #bfdbfe" }} />
            Office
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 14, height: 14, background: "#ffedd5", borderRadius: 4, border: "1px solid #fed7aa" }} />
            Field
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 14, height: 14, background: "#fecaca", borderRadius: 4, border: "1px solid #fca5a5" }} />
            Tentative Field
          </div>
        </div>
      </div>

      {/* Team Overview */}
      <div style={cardStyle()}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Team Overview</div>
        <div style={{ display: "grid", gap: 10 }}>
          {allWeeksLoad.map((person) => (
            <div key={person.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr 1fr", gap: 16, alignItems: "center" }}>
                <button
                  onClick={() => onSelectPerson(person.id)}
                  style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", fontWeight: 700, fontSize: 16, cursor: "pointer", color: "#0f172a" }}
                >
                  {person.name}
                </button>
                {[
                  { label: "This week", percent: person.currentWeekPercent, hours: person.currentWeekHours, weeks: 1 },
                  { label: "This fortnight", percent: person.currentFortnightPercent, hours: person.currentFortnightHours, weeks: 2 },
                  { label: "This 4 weeks", percent: person.currentFourWeekPercent, hours: person.currentFourWeekHours, weeks: 4 },
                ].map(({ label, percent, hours, weeks }) => (
                  <div key={label} style={{ background: loadBg(percent), borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{label}</div>
                    <div style={{ color: loadColor(percent), fontWeight: 800, fontSize: 22 }}>{percent}%</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
                      {hours}h / {person.weeklyCapacity * weeks}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Rebalancing */}
      <div style={cardStyle()}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Suggested Rebalancing</div>
        <div style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
          Suggestions for the currently displayed week
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {suggestionCards.length === 0 && (
            <div style={{ color: "#64748b", fontSize: 14, padding: "12px 0" }}>No rebalancing needed this week.</div>
          )}
          {suggestionCards.map((item) => (
            <button
              key={item.source.id + item.booking.id}
              onClick={() => onApplySuggestion(item)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "14px 18px",
                background: "white",
                cursor: "pointer",
                textAlign: "left",
                transition: "box-shadow 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Move "{item.booking.title}"</div>
                <span style={{ borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, background: item.booking.type === "Field" ? "#ffedd5" : "#dbeafe", color: "#374151" }}>
                  {item.booking.type}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 3 }}>
                <div><strong>{item.source.name}</strong> {item.source.shownWeekPercent}% → {item.newSourcePct}% &nbsp;·&nbsp; <strong>{item.target.name}</strong> {item.target.shownWeekPercent}% → {item.newTargetPct}%</div>
                <div style={{ color: "#0f172a", fontWeight: 600, marginTop: 4 }}>Click to apply →</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
