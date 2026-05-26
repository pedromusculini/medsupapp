"use client";

import FullCalendar from "@fullcalendar/react";
import type { DateSelectArg, EventChangeArg, EventInput } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import ptBr from "@fullcalendar/core/locales/pt-br";
import "@fullcalendar/common/main.css";

interface AgendaCalendarProps {
  events: EventInput[];
  onEventsChange: (events: EventInput[]) => void;
}

export default function AgendaCalendar({ events, onEventsChange }: AgendaCalendarProps) {
  function handleDateSelect(selectInfo: DateSelectArg) {
    const title = "Nova consulta";
    onEventsChange([
      ...events,
      {
        id: String(Date.now()),
        title,
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        allDay: false,
        backgroundColor: "#90EE90",
        borderColor: "#228B22",
      },
    ]);
    selectInfo.view.calendar.unselect();
  }

  function handleEventChange(changeInfo: EventChangeArg) {
    const updatedEvent = changeInfo.event;
    onEventsChange(
      events.map((item) =>
        item.id === updatedEvent.id
          ? {
              ...item,
              start: updatedEvent.startStr,
              end: updatedEvent.endStr,
            }
          : item,
      ),
    );
  }

  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 rounded-3xl bg-[#f2fff2] p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-[#2d652d]">Agenda inteligente</p>
          <p className="text-slate-600">Selecione um horário para adicionar uma consulta. Arraste para reagendar.</p>
        </div>
        <span className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#2d652d]">
          Uso rápido
        </span>
      </div>
      <div className="min-h-155">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "title",
            center: "dayGridMonth,timeGridWeek,timeGridDay",
            right: "prev,next today",
          }}
          buttonText={{
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
          }}
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          selectable={true}
          editable={true}
          selectMirror={true}
          dayMaxEvents={true}
          eventColor="#90EE90"
          events={events}
          select={handleDateSelect}
          eventChange={handleEventChange}
          locale={ptBr}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5, 6],
            startTime: "08:00",
            endTime: "18:00",
          }}
        />
      </div>
    </div>
  );
}
