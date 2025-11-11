import axios from 'axios';

const ODOO_URL = process.env.REACT_APP_ODOO_URL;
const ODOO_DB = process.env.REACT_APP_ODOO_DB;
const ODOO_USERNAME = process.env.REACT_APP_ODOO_USERNAME;
const ODOO_PASSWORD = process.env.REACT_APP_ODOO_PASSWORD;

/**
 * Odoo Service - READ-ONLY Integration
 *
 * This service provides read-only access to Odoo data.
 * It ONLY performs the following operations:
 * - authenticate: Login to Odoo
 * - search: Find record IDs based on filters
 * - read: Retrieve record data
 *
 * NO WRITE OPERATIONS are performed (create, write, unlink)
 */
class OdooService {
  constructor() {
    this.uid = null;
    this.sessionId = null;
  }

  /**
   * Authenticate with Odoo (READ-ONLY - only establishes session)
   */
  async authenticate() {
    try {
      const response = await axios.post(
        `${ODOO_URL}/web/session/authenticate`,
        {
          jsonrpc: '2.0',
          params: {
            db: ODOO_DB,
            login: ODOO_USERNAME,
            password: ODOO_PASSWORD,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      if (response.data.result && response.data.result.uid) {
        this.uid = response.data.result.uid;
        this.sessionId = response.data.result.session_id;
        return true;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Odoo authentication error:', error);
      throw new Error('Failed to authenticate with Odoo');
    }
  }

  /**
   * Call Odoo JSON-RPC API (READ-ONLY methods only)
   * Only allows: search, read, search_read
   */
  async call(model, method, args = [], kwargs = {}) {
    // Whitelist of read-only methods
    const READ_ONLY_METHODS = ['search', 'read', 'search_read', 'fields_get', 'name_search'];

    if (!READ_ONLY_METHODS.includes(method)) {
      throw new Error(`Method '${method}' is not allowed. This service is READ-ONLY.`);
    }

    if (!this.uid) {
      await this.authenticate();
    }

    try {
      const response = await axios.post(
        `${ODOO_URL}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: model,
            method: method,
            args: args,
            kwargs: kwargs,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error.data.message || 'Odoo API error');
      }

      return response.data.result;
    } catch (error) {
      console.error('Odoo API call error:', error);
      throw error;
    }
  }

  /**
   * Search for tags by name containing a specific string (READ-ONLY)
   */
  async searchTagsByName(tagName) {
    try {
      const domain = [['name', 'ilike', tagName]];
      const tagIds = await this.call('project.tags', 'search', [domain]);
      return tagIds;
    } catch (error) {
      console.error('Error searching tags:', error);
      return [];
    }
  }

  /**
   * Fetch tasks from project.task (READ-ONLY)
   */
  async fetchTasks(projectId = null, filterByPianificato = true) {
    try {
      // Build domain filter
      let domain = [];

      if (projectId) {
        domain.push(['project_id', '=', projectId]);
      }

      // Filter by tags containing 'Pianificato'
      if (filterByPianificato) {
        const pianificatoTagIds = await this.searchTagsByName('Pianificato');
        if (pianificatoTagIds && pianificatoTagIds.length > 0) {
          // Use 'in' operator to find tasks with any of these tags
          domain.push(['tag_ids', 'in', pianificatoTagIds]);
        } else {
          console.warn('No tags found containing "Pianificato"');
        }
      }

      // Search for task IDs (READ-ONLY operation)
      const taskIds = await this.call('project.task', 'search', [domain]);

      if (!taskIds || taskIds.length === 0) {
        return [];
      }

      // Read task data (READ-ONLY operation)
      const fields = [
        'name',
        'user_ids',
        'date_start',
        'date_end',
        'date_deadline',
        'project_id',
        'stage_id',
        'depend_on_ids',
        'planned_hours',
        'tag_ids',
      ];

      const tasks = await this.call('project.task', 'read', [taskIds], {
        fields: fields,
      });

      return tasks;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * Transform Odoo tasks to app format (Local transformation, no Odoo writes)
   */
  transformTasksToAppFormat(odooTasks) {
    return odooTasks.map((task, index) => {
      // Extract user name (user_ids is a many2many field, returns array of [id, name])
      let resource = 'Unassigned';
      if (task.user_ids && task.user_ids.length > 0) {
        // Get first assigned user
        resource = task.user_ids[0][1] || 'Unassigned';
      }

      // Calculate duration in days
      let duration = 1;
      let startDate = new Date().toISOString().split('T')[0];

      if (task.date_start && task.date_end) {
        startDate = task.date_start.split(' ')[0];
        const start = new Date(task.date_start);
        const end = new Date(task.date_end);
        const diffTime = Math.abs(end - start);
        duration = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      } else if (task.date_start) {
        startDate = task.date_start.split(' ')[0];
        duration = Math.ceil(task.planned_hours / 8) || 1; // Convert hours to days (8h workday)
      } else if (task.date_deadline) {
        // If only deadline is set, work backwards
        const deadline = new Date(task.date_deadline);
        duration = Math.ceil(task.planned_hours / 8) || 1;
        const start = new Date(deadline);
        start.setDate(start.getDate() - duration);
        startDate = start.toISOString().split('T')[0];
      }

      // Map dependencies
      const dependencies = [];
      if (task.depend_on_ids && task.depend_on_ids.length > 0) {
        // depend_on_ids contains IDs of tasks this task depends on
        dependencies.push(...task.depend_on_ids);
      }

      // Extract tag names
      const tags = [];
      if (task.tag_ids && task.tag_ids.length > 0) {
        task.tag_ids.forEach(tagData => {
          if (Array.isArray(tagData) && tagData.length > 1) {
            tags.push(tagData[1]); // Get tag name
          }
        });
      }

      return {
        id: task.id,
        name: task.name || 'Untitled Task',
        resource: resource,
        startDate: startDate,
        duration: duration,
        type: 'Consulenza', // Default type, can be customized based on project type
        dependencies: dependencies,
        odooId: task.id,
        projectId: task.project_id ? task.project_id[0] : null,
        projectName: task.project_id ? task.project_id[1] : null,
        stage: task.stage_id ? task.stage_id[1] : null,
        tags: tags,
      };
    });
  }

  /**
   * Get all tasks formatted for the app (READ-ONLY)
   * @param {number|null} projectId - Optional project ID to filter by
   * @param {boolean} filterByPianificato - Filter by 'Pianificato' tag (default: true)
   */
  async getFormattedTasks(projectId = null, filterByPianificato = true) {
    const odooTasks = await this.fetchTasks(projectId, filterByPianificato);
    return this.transformTasksToAppFormat(odooTasks);
  }
}

export default new OdooService();
