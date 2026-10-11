import React from "react";
import Modal from "./Modal";
import { IPL_2026_SCHEDULE } from "../data/staticData";

export default function ScheduleModal({ onClose }) {
  return (
    <Modal
      id="schedule-modal" onClose={onClose}
      title={<><span className="highlight">IPL 2026</span> — FULL SCHEDULE</>}
      wide={760} style={{ maxHeight: "92vh", overflowY: "auto" }}
    >
      <div id="schedule-list" className="schedule-list">
        {IPL_2026_SCHEDULE.map((m, i) => (
          <div key={i} className={`schedule-item${i < 3 ? " today" : ""}`}>
            <div className="schedule-date">
              {m.date}<br /><span className="schedule-time">{m.time}</span>
            </div>
            <div className="schedule-match">
              <span className={`${m.team1.toLowerCase()}-color team-pill`}>{m.team1}</span>
              <span className="vs">vs</span>
              <span className={`${m.team2.toLowerCase()}-color team-pill`}>{m.team2}</span>
            </div>
            <div className="schedule-venue">📍 {m.venue.split(",").pop().trim()}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
