import BookingForm from "./BookingForm";

export default function BookingModal({
  bookingModal, onCloseModal,
  newBooking, editingBookingId, bookingMessage, saving, teamMembers,
  projects, projectTasks,
  onNewBookingChange, onSave, onDelete,
}) {
  if (!bookingModal.open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCloseModal(); }}
    >
      <div
        style={{
          position: "relative",
          background: "white",
          borderRadius: 20,
          padding: 28,
          maxWidth: 720,
          width: "100%",
          boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
        }}
      >
        <button
          onClick={onCloseModal}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            border: 0,
            background: "#f1f5f9",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            color: "#64748b",
            fontSize: 16,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Close"
        >
          ✕
        </button>

        <BookingForm
          newBooking={newBooking}
          editingBookingId={editingBookingId}
          bookingMessage={bookingMessage}
          saving={saving}
          teamMembers={teamMembers}
          projects={projects}
          projectTasks={projectTasks}
          onNewBookingChange={onNewBookingChange}
          onSave={onSave}
          onDelete={onDelete}
          onCancel={onCloseModal}
        />
      </div>
    </div>
  );
}
