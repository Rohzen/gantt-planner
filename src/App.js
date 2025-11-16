import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Plus, Filter, Clock, AlertCircle, Upload, Download, RefreshCw, FileText, LogOut, Settings, LayoutList, Users } from 'lucide-react';
import odooService from './services/odooService';
import LogViewer from './components/LogViewer';
import PasswordAuth from './components/PasswordAuth';
import OdooConfigDialog from './components/OdooConfigDialog';

const GanttPlanner = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showOdooConfig, setShowOdooConfig] = useState(false);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [syncMode, setSyncMode] = useState('replace');
  const [syncSuccess, setSyncSuccess] = useState(null);

  const [selectedResource, setSelectedResource] = useState('Tutti');
  const [selectedType, setSelectedType] = useState('Tutti');
  const [selectedWeek, setSelectedWeek] = useState('Tutte');
  const [allocatedPercentage, setAllocatedPercentage] = useState(100);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState('replace');
  const [viewMode, setViewMode] = useState('task'); // 'task' or 'resource'
  const [timeScale, setTimeScale] = useState('day'); // 'day', 'week', 'month', 'year'
  const [normalizeStartDates, setNormalizeStartDates] = useState(false);
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

  // Check authentication on mount
  useEffect(() => {
    const authenticated = sessionStorage.getItem('gantt_authenticated');
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Load tasks from localStorage on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    const savedTasks = localStorage.getItem('gantt_tasks');
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks);
        setTasks(parsedTasks);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load saved tasks:', err);
        loadTasksFromOdoo();
      }
    } else {
      loadTasksFromOdoo();
    }
  }, [isAuthenticated]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('gantt_tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  // Recalculate tasks when allocation percentage changes
  useEffect(() => {
    if (tasks.length > 0 && allocatedPercentage !== 100) {
      const recalculatedTasks = recalculateTasksWithAllocation(tasks, allocatedPercentage);
      // Only update if there are actual changes
      const hasChanges = recalculatedTasks.some((rt) => {
        const originalTask = tasks.find(t => t.id === rt.id);
        return !originalTask || rt.duration !== originalTask.duration || rt.startDate !== originalTask.startDate;
      });
      if (hasChanges) {
        setTasks(recalculatedTasks);
      }
    } else if (allocatedPercentage === 100 && tasks.some(t => t.originalDuration && t.duration !== t.originalDuration)) {
      // Reset to original durations when at 100%
      const resetTasks = recalculateTasksWithAllocation(tasks, 100);
      setTasks(resetTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocatedPercentage]);

  const loadTasksFromOdoo = async () => {
    setLoading(true);
    setError(null);
    setSyncSuccess(null);
    try {
      const formattedTasks = await odooService.getFormattedTasks();
      // Ensure each task has originalDuration set
      const tasksWithOriginalDuration = formattedTasks.map(task => ({
        ...task,
        originalDuration: task.originalDuration || task.duration
      }));

      if (syncMode === 'replace') {
        setTasks(tasksWithOriginalDuration);
      } else {
        // Append mode: merge with existing tasks, avoiding duplicates by odooId
        const existingOdooIds = new Set(tasks.filter(t => t.odooId).map(t => t.odooId));
        const newTasks = tasksWithOriginalDuration.filter(t => !existingOdooIds.has(t.odooId));

        // Update maxId for new tasks
        let maxId = Math.max(...tasks.map(t => t.id), 0);
        const updatedNewTasks = newTasks.map(task => ({
          ...task,
          id: ++maxId
        }));

        setTasks([...tasks, ...updatedNewTasks]);
      }

      setLastSync(new Date());
      setSyncSuccess(`${tasksWithOriginalDuration.length} task sincronizzati da Odoo (${syncMode === 'replace' ? 'sostituiti' : 'aggiunti'})`);
      setShowSyncOptions(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSyncSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to load tasks from Odoo:', err);
      setError(err.message || 'Impossibile caricare i task da Odoo. Verifica la configurazione.');
    } finally {
      setLoading(false);
    }
  };

  const handleOdooSync = () => {
    // Check if Odoo config exists
    const savedConfig = localStorage.getItem('odoo_config');
    if (!savedConfig) {
      // No config found, show dialog
      setShowOdooConfig(true);
    } else {
      // Config exists, show sync options
      setShowSyncOptions(true);
    }
  };

  const handleOdooConfigSave = (config) => {
    // After saving config, show sync options
    setShowSyncOptions(true);
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

  // Recalculate and reschedule all tasks based on allocated percentage
  const recalculateTasksWithAllocation = (tasksToRecalculate, percentage) => {
    // Group tasks by resource
    const tasksByResource = {};
    tasksToRecalculate.forEach(task => {
      if (!tasksByResource[task.resource]) {
        tasksByResource[task.resource] = [];
      }
      tasksByResource[task.resource].push(task);
    });

    // Recalculate and reschedule for each resource
    const recalculatedTasks = [];
    Object.keys(tasksByResource).forEach(resource => {
      const resourceTasks = tasksByResource[resource].sort((a, b) =>
        new Date(a.startDate) - new Date(b.startDate)
      );

      let currentDate = resourceTasks.length > 0
        ? resourceTasks[0].startDate
        : new Date().toISOString().split('T')[0];

      resourceTasks.forEach((task, index) => {
        // Ensure originalDuration is set
        const originalDuration = task.originalDuration || task.duration;

        // Calculate adjusted duration based on allocation percentage
        // If allocation is 50%, a 5-day task becomes 10 days
        const adjustedDuration = Math.ceil(originalDuration / (percentage / 100));

        // For the first task, keep its original start date
        // For subsequent tasks, schedule after the previous task
        if (index === 0) {
          currentDate = task.startDate;
        }

        const recalculatedTask = {
          ...task,
          originalDuration: originalDuration,
          duration: adjustedDuration,
          startDate: currentDate
        };

        recalculatedTasks.push(recalculatedTask);

        // Calculate next available date for this resource
        const endDate = calculateEndDate(currentDate, adjustedDuration);
        currentDate = getNextWorkday(endDate);
      });
    });

    return recalculatedTasks;
  };

  // Week helper functions
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getWeekEnd = (weekStart) => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  };

  const formatWeek = (weekStart) => {
    const weekEnd = getWeekEnd(weekStart);
    return `${weekStart.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedResource !== 'Tutti') {
      filtered = filtered.filter(t => t.resource === selectedResource);
    }
    if (selectedType !== 'Tutti') {
      filtered = filtered.filter(t => t.type === selectedType);
    }

    // Normalize start dates if flag is active
    if (normalizeStartDates) {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.map(task => {
        const taskStartDate = task.startDate;
        if (taskStartDate < today) {
          // Calculate original end date
          const originalEndDate = calculateEndDate(task.startDate, task.duration);

          // If the task already ended, skip it or set minimal duration
          if (originalEndDate < today) {
            return {
              ...task,
              startDate: today,
              duration: 0 // Task already completed
            };
          }

          // Calculate remaining days from today to original end date
          const todayDate = new Date(today);
          const endDate = new Date(originalEndDate);
          const diffTime = endDate - todayDate;
          const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include end date

          return {
            ...task,
            startDate: today,
            duration: Math.max(1, remainingDays) // At least 1 day
          };
        }
        return task;
      });
    }

    return filtered;
  }, [tasks, selectedResource, selectedType, normalizeStartDates]);

  // Group tasks by resource for Resource Timeline view
  const tasksByResource = useMemo(() => {
    const grouped = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.resource]) {
        grouped[task.resource] = [];
      }
      grouped[task.resource].push(task);
    });
    // Sort tasks within each resource by start date
    Object.keys(grouped).forEach(resource => {
      grouped[resource].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    });
    return grouped;
  }, [filteredTasks]);

  const getAvailableWeeks = useMemo(() => {
    if (filteredTasks.length === 0) return [];

    const weeks = new Set();
    filteredTasks.forEach(task => {
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(calculateEndDate(task.startDate, task.duration));

      let current = getWeekStart(taskStart);
      const endWeek = getWeekStart(taskEnd);

      while (current <= endWeek) {
        weeks.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 7);
      }
    });

    return Array.from(weeks).sort().map(weekStr => {
      const weekDate = new Date(weekStr);
      return {
        value: weekStr,
        label: formatWeek(weekDate)
      };
    });
  }, [filteredTasks]);

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
            originalDuration: duration,
            type: 'Consulenza',
            dependencies: []
          };
        } else {
          // Simple format: Nome, Risorsa, DataInizio, Durata, Tipo
          const taskDuration = parseInt(values[3]) || 1;
          task = {
            id: ++maxId,
            name: values[0] || 'Untitled',
            resource: values[1] || 'Unassigned',
            startDate: values[2] || new Date().toISOString().split('T')[0],
            duration: taskDuration,
            originalDuration: taskDuration,
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

    const taskDuration = parseInt(newTask.duration);
    const newTaskObj = {
      id: Math.max(...tasks.map(t => t.id)) + 1,
      name: newTask.name,
      resource: newTask.resource,
      startDate: newStartDate,
      duration: taskDuration,
      originalDuration: taskDuration,
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

  const timelineRange = useMemo(() => {
    // If a specific week is selected, show only that week
    if (selectedWeek !== 'Tutte') {
      const weekStart = new Date(selectedWeek);
      const weekEnd = getWeekEnd(weekStart);
      return { minDate: weekStart, maxDate: weekEnd };
    }

    // Otherwise show all tasks
    if (filteredTasks.length === 0) {
      const today = new Date();
      return { minDate: today, maxDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000) };
    }

    const dates = filteredTasks.map(t => new Date(t.startDate + 'T00:00:00'));
    const endDates = filteredTasks.map(t => new Date(calculateEndDate(t.startDate, t.duration) + 'T00:00:00'));
    const allDates = [...dates, ...endDates];

    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 7);

    return { minDate, maxDate };
  }, [filteredTasks, selectedWeek]);

  const dateRange = useMemo(() => {
    const { minDate, maxDate } = timelineRange;
    const dates = [];
    const current = new Date(minDate);

    while (current <= maxDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [timelineRange]);

  // Calculate day width based on time scale
  const dayWidth = useMemo(() => {
    switch (timeScale) {
      case 'week': return 40 / 7; // Smaller for weekly view
      case 'month': return 40 / 30; // Even smaller for monthly view
      case 'year': return 40 / 365; // Tiny for yearly view
      default: return 40; // Day view
    }
  }, [timeScale]);

  // Group dates for header display based on time scale
  const headerGroups = useMemo(() => {
    if (timeScale === 'day') {
      // For day view, show each day individually
      return dateRange.map(date => ({
        label: date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        sublabel: date.toLocaleDateString('it-IT', { weekday: 'short' }),
        width: dayWidth,
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      }));
    }

    if (timeScale === 'week') {
      // Group by weeks
      const groups = [];
      let currentWeek = null;
      let weekStart = null;
      let weekDays = 0;

      dateRange.forEach((date, idx) => {
        const weekNum = getWeekStart(date).toISOString().split('T')[0];

        if (weekNum !== currentWeek) {
          if (currentWeek !== null) {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            groups.push({
              label: `${weekStart.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}`,
              sublabel: `Sett. ${getWeekNumber(weekStart)}`,
              width: weekDays * dayWidth,
              isWeekend: false
            });
          }
          currentWeek = weekNum;
          weekStart = new Date(date);
          weekDays = 1;
        } else {
          weekDays++;
        }
      });

      // Add last week
      if (currentWeek !== null) {
        groups.push({
          label: `${weekStart.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}`,
          sublabel: `Sett. ${getWeekNumber(weekStart)}`,
          width: weekDays * dayWidth,
          isWeekend: false
        });
      }

      return groups;
    }

    if (timeScale === 'month') {
      // Group by months
      const groups = [];
      let currentMonth = null;
      let monthDays = 0;

      dateRange.forEach((date, idx) => {
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

        if (monthKey !== currentMonth) {
          if (currentMonth !== null) {
            groups.push({
              label: dateRange[idx - 1].toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
              sublabel: '',
              width: monthDays * dayWidth,
              isWeekend: false
            });
          }
          currentMonth = monthKey;
          monthDays = 1;
        } else {
          monthDays++;
        }
      });

      // Add last month
      if (currentMonth !== null) {
        groups.push({
          label: dateRange[dateRange.length - 1].toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
          sublabel: '',
          width: monthDays * dayWidth,
          isWeekend: false
        });
      }

      return groups;
    }

    if (timeScale === 'year') {
      // Group by years/quarters
      const groups = [];
      let currentQuarter = null;
      let quarterDays = 0;

      dateRange.forEach((date, idx) => {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const quarterKey = `${date.getFullYear()}-Q${quarter}`;

        if (quarterKey !== currentQuarter) {
          if (currentQuarter !== null) {
            const prevDate = dateRange[idx - 1];
            const prevQuarter = Math.floor(prevDate.getMonth() / 3) + 1;
            groups.push({
              label: `Q${prevQuarter} ${prevDate.getFullYear()}`,
              sublabel: '',
              width: quarterDays * dayWidth,
              isWeekend: false
            });
          }
          currentQuarter = quarterKey;
          quarterDays = 1;
        } else {
          quarterDays++;
        }
      });

      // Add last quarter
      if (currentQuarter !== null) {
        const lastDate = dateRange[dateRange.length - 1];
        const lastQuarter = Math.floor(lastDate.getMonth() / 3) + 1;
        groups.push({
          label: `Q${lastQuarter} ${lastDate.getFullYear()}`,
          sublabel: '',
          width: quarterDays * dayWidth,
          isWeekend: false
        });
      }

      return groups;
    }

    return [];
  }, [dateRange, timeScale, dayWidth]);

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getTaskPosition = (task) => {
    const startDate = new Date(task.startDate + 'T00:00:00');
    const minDate = new Date(timelineRange.minDate);
    minDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.round((startDate - minDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysDiff);
  };

  const getTypeColor = (type) => {
    return type === 'Sviluppo' ? 'bg-green-500' : 'bg-blue-500';
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('gantt_authenticated');
    setIsAuthenticated(false);
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <PasswordAuth onAuthenticated={handleAuthenticated} />;
  }

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
              onClick={() => setShowLogViewer(true)}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              title="Visualizza log di sincronizzazione"
            >
              <FileText className="w-4 h-4" />
              Log
            </button>
            <button
              onClick={() => setShowOdooConfig(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              title="Configura credenziali Odoo"
            >
              <Settings className="w-4 h-4" />
              Config Odoo
            </button>
            <button
              onClick={handleOdooSync}
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              Logout
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

        {syncSuccess && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-green-800">
              <RefreshCw className="w-5 h-5" />
              <span className="font-semibold">Sincronizzazione completata!</span>
              <span>{syncSuccess}</span>
            </div>
          </div>
        )}

        {lastSync && !error && (
          <div className="mb-2 text-sm text-gray-600">
            Ultima sincronizzazione: {lastSync.toLocaleString('it-IT')}
          </div>
        )}

        {showSyncOptions && (
          <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Opzioni Sincronizzazione Odoo</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="syncReplace"
                  name="syncMode"
                  value="replace"
                  checked={syncMode === 'replace'}
                  onChange={(e) => setSyncMode(e.target.value)}
                />
                <label htmlFor="syncReplace" className="text-sm">Sostituisci tutto (elimina task esistenti)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="syncAppend"
                  name="syncMode"
                  value="append"
                  checked={syncMode === 'append'}
                  onChange={(e) => setSyncMode(e.target.value)}
                />
                <label htmlFor="syncAppend" className="text-sm">Aggiungi (mantieni task esistenti)</label>
              </div>
              <button
                onClick={loadTasksFromOdoo}
                disabled={loading}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-purple-300"
              >
                {loading ? 'Sincronizzazione...' : 'Sincronizza Ora'}
              </button>
              <button
                onClick={() => setShowSyncOptions(false)}
                className="bg-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-400"
              >
                Annulla
              </button>
            </div>
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

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">Vista:</label>
            <div className="flex border border-gray-300 rounded overflow-hidden">
              <button
                onClick={() => setViewMode('task')}
                className={`flex items-center gap-1 px-3 py-1 text-sm ${viewMode === 'task' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              >
                <LayoutList className="w-4 h-4" />
                Attività
              </button>
              <button
                onClick={() => setViewMode('resource')}
                className={`flex items-center gap-1 px-3 py-1 text-sm border-l border-gray-300 ${viewMode === 'resource' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
              >
                <Users className="w-4 h-4" />
                Risorse
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Scala:</label>
            <select
              value={timeScale}
              onChange={(e) => setTimeScale(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="day">Giorno</option>
              <option value="week">Settimana</option>
              <option value="month">Mese</option>
              <option value="year">Anno</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Allocazione:</label>
            <select
              value={allocatedPercentage}
              onChange={(e) => setAllocatedPercentage(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1 text-sm bg-yellow-50"
            >
              <option value={100}>100%</option>
              <option value={80}>80%</option>
              <option value={70}>70%</option>
              <option value={60}>60%</option>
              <option value={50}>50%</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Settimana:</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="Tutte">Tutte</option>
              {getAvailableWeeks.map(week => (
                <option key={week.value} value={week.value}>{week.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="normalizeStartDates"
              checked={normalizeStartDates}
              onChange={(e) => setNormalizeStartDates(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="normalizeStartDates" className="text-sm font-medium text-gray-700">
              Normalizza date inizio
            </label>
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
              <span className="font-semibold text-sm text-gray-700">
                {viewMode === 'resource' ? 'Risorsa' : 'Attività'}
              </span>
            </div>
            <div className="flex">
              {headerGroups.map((group, idx) => {
                return (
                  <div
                    key={idx}
                    style={{ width: `${group.width}px`, minWidth: `${group.width}px` }}
                    className={`border-r border-gray-200 p-1 text-center ${group.isWeekend ? 'bg-gray-100' : 'bg-white'}`}
                  >
                    <div className="text-xs font-medium text-gray-600">
                      {group.label}
                    </div>
                    {group.sublabel && (
                      <div className="text-xs text-gray-500">
                        {group.sublabel}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {viewMode === 'task' ? (
            // TASK VIEW - Original view showing one row per task
            <>
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
            </>
          ) : (
            // RESOURCE VIEW - Show one row per resource with all their tasks
            <>
              {Object.keys(tasksByResource).sort().map((resource, idx) => {
                const resourceTasks = tasksByResource[resource];
                const taskCount = resourceTasks.length;

                // Check for overlapping tasks and calculate lanes
                const lanes = [];
                resourceTasks.forEach(task => {
                  const taskStart = new Date(task.startDate);
                  const taskEnd = new Date(calculateEndDate(task.startDate, task.duration));

                  // Find the first lane where this task doesn't overlap
                  let laneIndex = 0;
                  while (laneIndex < lanes.length) {
                    const overlaps = lanes[laneIndex].some(existingTask => {
                      const existingStart = new Date(existingTask.startDate);
                      const existingEnd = new Date(calculateEndDate(existingTask.startDate, existingTask.duration));
                      return !(taskEnd < existingStart || taskStart > existingEnd);
                    });
                    if (!overlaps) break;
                    laneIndex++;
                  }

                  if (!lanes[laneIndex]) lanes[laneIndex] = [];
                  lanes[laneIndex].push(task);
                  task._lane = laneIndex; // Store lane index for rendering
                });

                const rowHeight = Math.max(80, (lanes.length * 20) + 20); // Dynamic height based on lanes

                return (
                  <div key={resource} className={`flex border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="w-96 border-r border-gray-300 p-2">
                      <div className="text-sm font-bold text-gray-800">{resource}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{taskCount} attività</span>
                      </div>
                    </div>
                    <div className="flex relative" style={{ minHeight: `${rowHeight}px` }}>
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
                      {/* Render all tasks for this resource */}
                      {resourceTasks.map((task, taskIdx) => {
                        const position = getTaskPosition(task);
                        const laneIndex = task._lane || 0;
                        const verticalOffset = laneIndex * 20; // 20px per lane

                        return (
                          <div
                            key={task.id}
                            className={`absolute h-4 ${getTypeColor(task.type)} rounded shadow-sm flex items-center justify-start text-white text-xs font-medium px-1 cursor-pointer hover:opacity-90`}
                            style={{
                              top: `${8 + verticalOffset}px`,
                              left: `${position * dayWidth}px`,
                              width: `${Math.max(task.duration * dayWidth - 4, 20)}px`,
                              zIndex: taskIdx
                            }}
                            title={`${task.name}\n${task.type}\n${task.duration} giorni\nInizio: ${new Date(task.startDate).toLocaleDateString('it-IT')}`}
                          >
                            <span className="truncate text-xs">{task.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
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

      <LogViewer isOpen={showLogViewer} onClose={() => setShowLogViewer(false)} />
      <OdooConfigDialog
        isOpen={showOdooConfig}
        onClose={() => setShowOdooConfig(false)}
        onSave={handleOdooConfigSave}
      />
    </div>
  );
};

function App() {
  return <GanttPlanner />;
}

export default App;