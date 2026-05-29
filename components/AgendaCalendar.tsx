"use client";

import { useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventChangeArg, EventClickArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import ptBr from "@fullcalendar/core/locales/pt-br";
import {
  type ConsultationRecord,
  eventsForCalendar,
} from "@/lib/consultations";

const DEFAULT_SLOT_MINUTES = 40;

export type AgendaCalendarProps = {
  events: ConsultationRecord[];
  onEventsChange: (events: ConsultationRecord[]) => void;
  /** Clique ou arraste em horário vazio — cria/atualiza evento na grade */
  onSlotSelect: (start: Date, end: Date) => void;
  onEventClick?: (event: ConsultationRecord) => void;
};

function endFromStart(start: Date, minutes = DEFAULT_SLOT_MINUTES): Date {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + minutes);
  return end;
}

export default function AgendaCalendar({
  events,
  onEventsChange,
  onSlotSelect,
  onEventClick,
}: AgendaCalendarProps) {
  const calendarEvents = useMemo(() => eventsForCalendar(events), [events]);

  const applySlotSelection = useCallback(
    (start: Date, end?: Date) => {
      const endDate =
        end && end.getTime() > start.getTime() ? end : endFromStart(start);
      onSlotSelect(start, endDate);
    },
    [onSlotSelect],
  );

  const handleDateClick = useCallback(
    (clickInfo: DateClickArg) => {
      const start = new Date(clickInfo.date);
      if (clickInfo.allDay) {
        start.setHours(8, 0, 0, 0);
      }
      applySlotSelection(start);
    },
    [applySlotSelection],
  );

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const id = clickInfo.event.id;
      const found = events.find((e) => String(e.id) === String(id));
      if (found && onEventClick) {
        onEventClick(found);
      }
    },
    [events, onEventClick],
  );

  const handleEventChange = useCallback(
    (changeInfo: EventChangeArg) => {
      const updated = changeInfo.event;
      if (!updated.id || !updated.start) return;

      onEventsChange(
        events.map((item) => {
          if (String(item.id) !== String(updated.id)) return item;
          const endAt = updated.end ?? updated.start!;
          return {
            ...item,
            start: updated.start!.toISOString(),
            end: endAt.toISOString(),
          };
        }),
      );
    },
    [events, onEventsChange],
  );

  return (
    <div className="agenda-calendar-root rounded-4xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 rounded-3xl bg-[#f2fff2] p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-[#2d652d]">Agenda inteligente</p>
          <p className="text-slate-600">
            Clique em um horário para abrir o agendamento
          </p>
        </div>
        <span className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#2d652d]">
          {calendarEvents.length} na grade
        </span>
      </div>
      <div className="fc-theme-standard min-h-[36rem]">
        <FullCalendar
          plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin]}
          initialView="timeGridWeek"
          height={640}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
          }}
          locale={ptBr}
          firstDay={0}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          allDaySlot={false}
          nowIndicator
          /* Com selectable=true o dateClick NÃO dispara (doc FullCalendar) */
          selectable={false}
          dateClick={handleDateClick}
          editable
          eventStartEditable
          eventDurationEditable
          dayMaxEvents
          weekends
          events={calendarEvents}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
        />
      </div>
    </div>
  );
}
