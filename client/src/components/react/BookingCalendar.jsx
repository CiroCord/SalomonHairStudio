import React, { useState, useLayoutEffect } from 'react';

const BookingCalendar = ({ onDateSelect, onMonthChange, availability = null, renderDayContent, enableAllDates = false, theme = 'dark' }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Nombres de días y meses en español
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Notificar al padre cuando cambia el mes (o al montar) para cargar disponibilidad
  useLayoutEffect(() => {
    if (onMonthChange) {
      onMonthChange(currentDate.getFullYear(), currentDate.getMonth());
    }
  }, [currentDate, onMonthChange]);

  // Lógica para obtener los días del mes
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Generar array de días (incluyendo espacios vacíos al inicio)
  const daysArray = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const newSelectedDate = new Date(year, month, day);
    setSelectedDate(newSelectedDate);
    if (onDateSelect) {
      onDateSelect(newSelectedDate);
    }
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (day) => {
    return selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  };

  return (
    <div className={`w-full max-w-4xl mx-auto rounded-2xl shadow-xl overflow-hidden border font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-gray-100'}`}>
      {/* Header del Calendario */}
      <div className={`flex items-center justify-between px-4 md:px-8 py-4 md:py-6 bg-transparent border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="flex items-center gap-4">
          <h2 className={`text-3xl font-bold capitalize ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
            {monthNames[month]} <span className={`${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} font-normal`}>{year}</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrevMonth}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <button 
            onClick={handleNextMonth}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      </div>

      {/* Grid de Días de la Semana */}
      <div className={`grid grid-cols-7 border-b ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
        {daysOfWeek.map((day) => (
          <div key={day} className={`py-2 md:py-3 text-center text-xs md:text-sm font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid de Días del Mes */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {daysArray.map((day, index) => {
          // Días pasados
          const dateToCheck = new Date(year, month, day);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Ignorar hora actual para comparar solo fecha

          const isLoading = availability === null;
          const isPast = dateToCheck < today;
          const isFull = !isLoading && availability && availability[day] === 'full'; // Verificar si está agotado según backend
          const isClosed = !isLoading && availability && availability[day] === 'closed';
          const isFranco = !isLoading && availability && availability[day] === 'franco';
          const isDisabled = !day || isLoading || (!enableAllDates && (isPast || isFull || isClosed || isFranco));

          return (
            <div 
              key={index} 
              onClick={() => !isDisabled && handleDayClick(day)}
              className={`
                min-h-[60px] md:min-h-[100px] p-1 md:p-3 border-b border-r relative transition-all duration-200
                ${theme === 'dark' ? 'border-white/5' : 'border-gray-50'}
                ${!day ? (theme === 'dark' ? 'bg-white/5 cursor-default' : 'bg-gray-50/30 cursor-default') : ''}
                ${!isDisabled && !isLoading ? (theme === 'dark' ? 'cursor-pointer hover:bg-yellow-500/10' : 'cursor-pointer hover:bg-yellow-50/50') : ''}
                ${day && isClosed && !isLoading ? (theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50') : ''}
                ${day && isFranco && !isLoading ? (theme === 'dark' ? 'bg-zinc-800/50' : 'bg-gray-100') : ''}
                ${day && !isClosed && isDisabled && !isLoading ? (theme === 'dark' ? 'bg-zinc-900/50 opacity-50' : 'bg-gray-100 cursor-not-allowed') : ''}
                ${isSelected(day) ? 'bg-yellow-500/20 ring-2 ring-inset ring-yellow-500 z-10' : ''}
              `}
            >
              {day && (
                <>
                  {isLoading ? (
                    // SKELETON LOADER (Círculo y línea)
                    <div className="flex flex-col items-center justify-center h-full w-full absolute inset-0 gap-1">
                        <div className={`w-6 h-6 rounded-full animate-pulse ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                        <div className={`h-1.5 w-8 rounded animate-pulse ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                    </div>
                  ) : (
                    <>
                      <span 
                        className={`
                          text-xs md:text-sm font-medium w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full mb-1
                          ${isToday(day)
                            ? (theme === 'dark' ? 'bg-yellow-500 text-zinc-900 shadow-md font-bold' : 'bg-zinc-900 text-white shadow-md')
                            : isSelected(day) ? (theme === 'dark' ? 'text-yellow-500 font-bold' : 'text-zinc-900 font-bold') : ''}
                          ${!isToday(day) && !isSelected(day) && (isDisabled || isClosed || isFranco) ? (theme === 'dark' ? 'text-gray-600' : 'text-gray-400') : ''}
                          ${!isToday(day) && !isSelected(day) && !isDisabled ? (theme === 'dark' ? 'text-gray-300' : 'text-gray-700') : ''}
                        `}
                      >
                        {day}
                      </span>
                      {/* Contenido Personalizado (Resumen de servicios) */}
                      {renderDayContent && renderDayContent(day, new Date(year, month, day))}
                    </>
                  )}
                </>
              )}
              
              {/* Etiqueta AGOTADO */}
              {!isLoading && day && isFull && !isPast && (
                <div className="absolute bottom-1 left-0 right-0 text-center px-1">
                  <span className={`block w-full text-[8px] md:text-[10px] font-bold px-1 py-0.5 rounded-full border truncate ${theme === 'dark' ? 'text-red-400 bg-red-900/30 border-red-900/50' : 'text-red-600 bg-red-100 border-red-200'}`}>
                    AGOTADO
                  </span>
                </div>
              )}
              
              {/* Etiqueta CERRADO */}
              {!isLoading && day && isClosed && !isPast && (
                <div className="absolute bottom-1 left-0 right-0 text-center px-1">
                  <span className={`block w-full text-[8px] md:text-[10px] font-bold px-1 py-0.5 rounded-full border truncate ${theme === 'dark' ? 'text-red-400 bg-red-900/30 border-red-900/50' : 'text-red-600 bg-red-100 border-red-200'}`}>
                    CERRADO
                  </span>
                </div>
              )}

              {/* Etiqueta FRANCO */}
              {!isLoading && day && isFranco && (
                <div className="absolute bottom-1 left-0 right-0 text-center px-1">
                  <span className={`block w-full text-[8px] md:text-[10px] font-bold px-1 py-0.5 rounded-full border truncate ${theme === 'dark' ? 'text-gray-400 bg-zinc-700/50 border-zinc-600' : 'text-gray-600 bg-gray-200 border-gray-300'}`}>
                    FRANCO
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingCalendar;
