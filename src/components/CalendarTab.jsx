import { bookingColor, cardStyle, formatMonthLabel, ymd } from "../utils/helpers";

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

export default function CalendarTab({
  calendarMonth, monthGrid, bookings, draggedBookingId, teamMap,
  onPrevMonth, onNextMonth, onDragStart, onDragEnd, onMoveBooking,
  onEditBooking, onAddBookingForDate,
}) {
  const selectedMonthIndex = calendarMonth.getMonth();

  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Monthly Calendar</div>
          <div style={{ color: "#64748b", marginTop: 3, fontSize: 14 }}>Click a booking to edit. Click a blank day to add one.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onPrevMonth} style={navBtn}>← Prev</button>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 120, textAlign: "center" }}>{formatMonthLabel(calendarMonth)}</div>
          <button onClick={onNextMonth} style={navBtn}>Next →</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} style={{ fontWeight: 700, fontSize: 12, padding: "6px 8px", textAlign: "center", color: d === "Sat" || d === "Sun" ? "#94a3b8" : "#374151" }}>
            {d}
          </div>
        ))}

        {monthGrid.map((date) => {
          const dateKey = ymd(date);
          const dayBookings = bookings
            .filter((b) => b.date === dateKey)
            .sort((a, b) => a.title.localeCompare(b.title));
          const inMonth = date.getMonth() === selectedMonthIndex;
          const isToday = dateKey === ymd(new Date());
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <div
              key={dateKey}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedBookingId) {
                  const booking = bookings.find((b) => b.id === draggedBookingId);
                  if (booking) onMoveBooking(booking.id, booking.assigned_to, dateKey);
                }
                onDragEnd();
              }}
              onClick={() => onAddBookingForDate(dateKey)}
              style={{
                minHeight: 120,
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

              {dayBookings.map((booking) => (
                <div
                  key={booking.id}
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); onDragStart(booking.id); }}
                  onDragEnd={onDragEnd}
                  onClick={(e) => { e.stopPropagation(); onEditBooking(booking); }}
                  style={{ background: bookingColor(booking), borderRadius: 6, padding: "4px 6px", fontSize: 11, cursor: "grab" }}
                >
                  <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{teamMap[booking.assigned_to]?.name}</div>
                  <div style={{ color: "#475569" }}>{booking.title} · {booking.hours}h</div>
                  {booking.assistant_assigned_to && (
                    <div style={{ color: "#64748b", fontSize: 10 }}>
                      Asst: {booking.assistant_assigned_to.startsWith("other:") ? booking.assistant_assigned_to.slice(6) || "Other" : teamMap[booking.assistant_assigned_to]?.name || booking.assistant_assigned_to}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
