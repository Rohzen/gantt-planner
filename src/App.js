import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Plus, Filter, Clock, AlertCircle, Upload, Download, RefreshCw } from 'lucide-react';
import odooService from './services/odooService';

const GanttPlanner = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [selectedResource, setSelectedResource] = useState('Tutti');
  const [selectedType, setSelectedType] = useState('Tutti');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState('replace');
  const [newTask, setNewTask] = useState({
    name: '',
    resource: 'Roberto',
    duration: 1,
    type: 'Consulenza',
    insertAfter: null
  });

  const resources = useMemo(() => {
    const uniqueResources = [...new Set(tasks.map(t => t.resource))];
    return ['Tutti', ...uniqueResources];
  }, [tasks]);

  const types = ['Tutti', 'Consulenza', 'Sviluppo'];

  // Fetch tasks from Odoo on component mount
  useEffect(() => {
    loadTasksFromOdoo();
  }, []);

  const loadTasksFromOdoo = async () => {
    setLoading(true);
    setError(null);
    try {
      const formattedTasks = await odooService.getFormattedTasks();
      setTasks(formattedTasks);
      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to load tasks from Odoo:', err);
      setError('Impossibile caricare i task da Odoo. Verifica le credenziali nel file .env');
    } finally {
      setLoading(false);
    }
  };

  const calculateEndDate = (startDate, duration) => {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + duration - 1);
    return end.toISOString().split('T')[0];
  };

  const getNextWorkday = (date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString().split('T')[0];
  };

  // Parse CSV properly handling quoted fields
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('Il file CSV è vuoto o non ha dati.');
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
      console.log('CSV Headers:', headers);

      // Detect CSV format
      const isOdooExport = headers.includes('Titolo') || headers.includes('Assegnato a') || headers.includes('Start Date');

      const newTasks = [];
      let maxId = Math.max(...tasks.map(t => t.id), 0);

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));

        if (values.length < 3) continue;

        let task;

        if (isOdooExport) {
          // Odoo export format: Titolo, Progetto, Assegnato a, Ore inizialmente pianificate, ..., Start Date, Data finale
          const titleIdx = headers.indexOf('Titolo');
          const assignedIdx = headers.indexOf('Assegnato a');
          const startDateIdx = headers.indexOf('Start Date');
          const endDateIdx = headers.indexOf('Data finale');
          const hoursIdx = headers.indexOf('Ore inizialmente pianificate');

          const name = values[titleIdx] || 'Untitled';
          const resource = values[assignedIdx] || 'Unassigned';
          const startDateStr = values[startDateIdx] || '';
          const endDateStr = values[endDateIdx] || '';
          const hours = parseFloat(values[hoursIdx]) || 4;

          // Parse dates
          let startDate = new Date().toISOString().split('T')[0];
          let duration = Math.max(1, Math.ceil(hours / 8)); // Convert hours to days

          if (startDateStr) {
            // Format: "2025-11-11 14:00:00" -> "2025-11-11"
            startDate = startDateStr.split(' ')[0];
          }

          if (startDateStr && endDateStr) {
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            duration = Math.max(1, diffDays || duration);
          }

          task = {
            id: ++maxId,
            name: name,
            resource: resource,
            startDate: startDate,
            duration: duration,
            type: 'Consulenza',
            dependencies: []
          };
        } else {
          // Simple format: Nome, Risorsa, DataInizio, Durata, Tipo
          task = {
            id: ++maxId,
            name: values[0] || 'Untitled',
            resource: values[1] || 'Unassigned',
            startDate: values[2] || new Date().toISOString().split('T')[0],
            duration: parseInt(values[3]) || 1,
            type: values[4] || 'Consulenza',
            dependencies: []
          };
        }

        newTasks.push(task);
      }

      if (newTasks.length === 0) {
        alert('Nessun task valido trovato nel file CSV.');
        return;
      }

      // Sort by start date and resource
      newTasks.sort((a, b) => {
        const dateCompare = new Date(a.startDate) - new Date(b.startDate);
        if (dateCompare !== 0) return dateCompare;
        return a.resource.localeCompare(b.resource);
      });

      if (uploadMode === 'replace') {
        setTasks(newTasks);
      } else {
        const combinedTasks = [...tasks, ...newTasks];
        setTasks(combinedTasks);
      }

      setShowUpload(false);
      event.target.value = '';
      alert(`${newTasks.length} task caricati con successo!`);
    } catch (error) {
      alert('Errore nel caricamento del file. Verifica il formato CSV.');
      console.error('CSV Upload Error:', error);
    }
  };

  const exportToCSV = () => {
    const headers = 'Nome,Risorsa,DataInizio,Durata,Tipo,Dipendenze\n';
    const rows = tasks.map(t => 
      `${t.name},${t.resource},${t.startDate},${t.duration},${t.type},"${t.dependencies.join(';')}"`
    ).join('\n');
    
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantt_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedResource !== 'Tutti') {
      filtered = filtered.filter(t => t.resource === selectedResource);
    }
    if (selectedType !== 'Tutti') {
      filtered = filtered.filter(t => t.type === selectedType);
    }
    return filtered;
  }, [tasks, selectedResource, selectedType]);

  const findNextAvailableSlot = (resource) => {
    const resourceTasks = tasks
      .filter(t => t.resource === resource)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    if (resourceTasks.length === 0) {
      return { date: new Date().toISOString().split('T')[0], afterTask: null };
    }

    const lastTask = resourceTasks[resourceTasks.length - 1];
    const lastEndDate = calculateEndDate(lastTask.startDate, lastTask.duration);
    const nextDate = getNextWorkday(lastEndDate);

    return { date: nextDate, afterTask: lastTask.id };
  };

  const getResourceSlots = (resource) => {
    const slots = findNextAvailableSlot(resource);
    const resourceTasks = tasks.filter(t => t.resource === resource);
    
    return {
      totalTasks: resourceTasks.length,
      nextAvailable: slots.date,
      lastTaskEnd: resourceTasks.length > 0 
        ? calculateEndDate(
            resourceTasks[resourceTasks.length - 1].startDate,
            resourceTasks[resourceTasks.length - 1].duration
          )
        : 'N/A'
    };
  };

  const addNewTask = () => {
    if (!newTask.name.trim()) return;

    const resourceTasks = tasks
      .filter(t => t.resource === newTask.resource)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    let insertIndex = -1;
    let newStartDate;

    if (newTask.insertAfter) {
      insertIndex = tasks.findIndex(t => t.id === parseInt(newTask.insertAfter));
      const insertAfterTask = tasks[insertIndex];
      const afterEndDate = calculateEndDate(insertAfterTask.startDate, insertAfterTask.duration);
      newStartDate = getNextWorkday(afterEndDate);
    } else {
      const slots = findNextAvailableSlot(newTask.resource);
      newStartDate = slots.date;
    }

    const newTaskObj = {
      id: Math.max(...tasks.map(t => t.id)) + 1,
      name: newTask.name,
      resource: newTask.resource,
      startDate: newStartDate,
      duration: parseInt(newTask.duration),
      type: newTask.type,
      dependencies: newTask.insertAfter ? [parseInt(newTask.insertAfter)] : []
    };

    const updatedTasks = [...tasks, newTaskObj];

    if (newTask.insertAfter) {
      const insertAfterDate = calculateEndDate(newStartDate, newTaskObj.duration);
      let currentDate = getNextWorkday(insertAfterDate);

      const tasksToShift = resourceTasks.filter(t => 
        new Date(t.startDate) > new Date(tasks[insertIndex].startDate)
      );

      tasksToShift.forEach(task => {
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          startDate: currentDate
        };
        currentDate = getNextWorkday(calculateEndDate(currentDate, task.duration));
      });
    }

    setTasks(updatedTasks);
    setNewTask({ name: '', resource: 'Roberto', duration: 1, type: 'Consulenza', insertAfter: null });
    setShowAddTask(false);
  };

  const getTimelineRange = () => {
    if (filteredTasks.length === 0) {
      const today = new Date();
      return { minDate: today, maxDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000) };
    }

    const dates = filteredTasks.map(t => new Date(t.startDate));
    const endDates = filteredTasks.map(t => new Date(calculateEndDate(t.startDate, t.duration)));
    const allDates = [...dates, ...endDates];
    
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 7);
    
    return { minDate, maxDate };
  };

  const generateDateRange = () => {
    const { minDate, maxDate } = getTimelineRange();
    const dates = [];
    const current = new Date(minDate);
    
    while (current <= maxDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const getTaskPosition = (task) => {
    const { minDate } = getTimelineRange();
    const startDate = new Date(task.startDate);
    const daysDiff = Math.floor((startDate - minDate) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  const dateRange = generateDateRange();
  const dayWidth = 40;

  const getTypeColor = (type) => {
    return type === 'Sviluppo' ? 'bg-green-500' : 'bg-blue-500';
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Gantt Interattivo - Pianificazione Risorse</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadTasksFromOdoo}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sincronizza Odoo
            </button>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Carica File
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Esporta CSV
            </button>
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuova Attività
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Errore:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {lastSync && !error && (
          <div className="mb-2 text-sm text-gray-600">
            Ultima sincronizzazione: {lastSync.toLocaleString('it-IT')}
          </div>
        )}

        {showUpload && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Carica File CSV</h3>
            <div className="mb-3">
              <p className="text-xs text-gray-600 mb-2">
                <strong>Formati supportati:</strong>
              </p>
              <p className="text-xs text-gray-600 mb-1">
                • Export Odoo: File esportati direttamente da Odoo project.task
              </p>
              <p className="text-xs text-gray-600 mb-2">
                • Formato semplice: Nome,Risorsa,DataInizio,Durata,Tipo
              </p>
              <p className="text-xs text-gray-500 italic">Esempio formato semplice: Nuova attività,Roberto,2024-11-15,3,Sviluppo</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="replace"
                  name="uploadMode"
                  value="replace"
                  checked={uploadMode === 'replace'}
                  onChange={(e) => setUploadMode(e.target.value)}
                />
                <label htmlFor="replace" className="text-sm">Sostituisci tutto</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="append"
                  name="uploadMode"
                  value="append"
                  checked={uploadMode === 'append'}
                  onChange={(e) => setUploadMode(e.target.value)}
                />
                <label htmlFor="append" className="text-sm">Aggiungi alle esistenti</label>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="text-sm"
              />
              <button
                onClick={() => setShowUpload(false)}
                className="ml-auto bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">Risorsa:</label>
            <select
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              {resources.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Tipo:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              {types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {selectedResource !== 'Tutti' && (
            <div className="flex items-center gap-4 ml-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Prossimo slot:</span>
                <span className="font-semibold text-green-600">
                  {new Date(getResourceSlots(selectedResource).nextAvailable).toLocaleDateString('it-IT')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700">Attività totali:</span>
                <span className="font-semibold text-blue-600">
                  {getResourceSlots(selectedResource).totalTasks}
                </span>
              </div>
            </div>
          )}
        </div>

        {showAddTask && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Aggiungi Nuova Attività</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-700 mb-1">Nome Attività</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({...newTask, name: e.target.value})}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="Es: Nuova implementazione"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Tipo</label>
                <select
                  value={newTask.type}
                  onChange={(e) => setNewTask({...newTask, type: e.target.value})}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="Consulenza">Consulenza</option>
                  <option value="Sviluppo">Sviluppo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Risorsa</label>
                <select
                  value={newTask.resource}
                  onChange={(e) => setNewTask({...newTask, resource: e.target.value})}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {resources.filter(r => r !== 'Tutti').map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Durata (giorni)</label>
                <input
                  type="number"
                  min="1"
                  value={newTask.duration}
                  onChange={(e) => setNewTask({...newTask, duration: e.target.value})}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Inserisci dopo (opzionale)</label>
                <select
                  value={newTask.insertAfter || ''}
                  onChange={(e) => setNewTask({...newTask, insertAfter: e.target.value})}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">Fine coda</option>
                  {tasks.filter(t => t.resource === newTask.resource).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={addNewTask}
                className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
              >
                Aggiungi
              </button>
              <button
                onClick={() => setShowAddTask(false)}
                className="bg-gray-300 text-gray-700 px-4 py-1 rounded text-sm hover:bg-gray-400"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Caricamento task da Odoo...</p>
          </div>
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nessun task trovato</p>
            <p className="text-sm text-gray-500 mt-2">Verifica la configurazione Odoo o carica un file CSV</p>
          </div>
        </div>
      )}

      {!loading && tasks.length > 0 && (
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          <div className="sticky top-0 bg-white border-b border-gray-300 z-10 flex">
            <div className="w-96 border-r border-gray-300 p-2 bg-gray-100">
              <span className="font-semibold text-sm text-gray-700">Attività</span>
            </div>
            <div className="flex">
              {dateRange.map((date, idx) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{ width: `${dayWidth}px` }}
                    className={`border-r border-gray-200 p-1 text-center ${isWeekend ? 'bg-gray-100' : 'bg-white'}`}
                  >
                    <div className="text-xs font-medium text-gray-600">
                      {date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString('it-IT', { weekday: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {filteredTasks.map((task, idx) => {
            const position = getTaskPosition(task);
            
            return (
              <div key={task.id} className={`flex border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <div className="w-96 border-r border-gray-300 p-2">
                  <div className="text-sm font-medium text-gray-800">{task.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{task.resource}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${task.type === 'Sviluppo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {task.type}
                    </span>
                  </div>
                </div>
                <div className="flex relative" style={{ height: '60px' }}>
                  {dateRange.map((date, dateIdx) => {
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <div
                        key={dateIdx}
                        style={{ width: `${dayWidth}px` }}
                        className={`border-r border-gray-200 ${isWeekend ? 'bg-gray-100' : ''}`}
                      />
                    );
                  })}
                  <div
                    className={`absolute top-2 h-10 ${getTypeColor(task.type)} rounded shadow-sm flex items-center justify-center text-white text-xs font-medium px-2`}
                    style={{
                      left: `${position * dayWidth}px`,
                      width: `${task.duration * dayWidth - 4}px`
                    }}
                  >
                    {task.duration}g
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <div className="bg-white border-t border-gray-200 p-3">
        <div className="flex items-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Consulenza</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Sviluppo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300"></div>
            <span>Weekend</span>
          </div>
          <span className="ml-auto">Totale attività visualizzate: <strong>{filteredTasks.length}</strong></span>
        </div>
      </div>
    </div>
  );
};

function App() {
  return <GanttPlanner />;
}

export default App;