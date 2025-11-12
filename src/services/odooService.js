import axios from 'axios';
import logger from './logger';

const ODOO_URL = process.env.REACT_APP_ODOO_URL;
const ODOO_DB = process.env.REACT_APP_ODOO_DB;
const ODOO_USERNAME = process.env.REACT_APP_ODOO_USERNAME;
const ODOO_API_KEY = process.env.REACT_APP_ODOO_API_KEY;

// Log configuration at startup
logger.info('CONFIG', 'Odoo Service Configuration', {
  url: ODOO_URL,
  database: ODOO_DB,
  username: ODOO_USERNAME,
  hasApiKey: !!ODOO_API_KEY,
  apiKeyLength: ODOO_API_KEY ? ODOO_API_KEY.length : 0
});

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
   * Authenticate with Odoo using API Key (READ-ONLY - only establishes session)
   */
  async authenticate() {
    logger.info('AUTH', 'Starting authentication process...');
    logger.debug('AUTH', 'Authentication details', {
      url: `${ODOO_URL}/web/session/authenticate`,
      database: ODOO_DB,
      username: ODOO_USERNAME,
      hasApiKey: !!ODOO_API_KEY,
      apiKeyPrefix: ODOO_API_KEY ? ODOO_API_KEY.substring(0, 3) + '...' : 'NONE'
    });

    try {
      const requestPayload = {
        jsonrpc: '2.0',
        params: {
          db: ODOO_DB,
          login: ODOO_USERNAME,
          password: ODOO_API_KEY,
        },
      };

      logger.debug('AUTH', 'Sending authentication request', {
        url: `${ODOO_URL}/web/session/authenticate`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        payload: {
          ...requestPayload,
          params: {
            ...requestPayload.params,
            password: '***' // Don't log password
          }
        }
      });

      const startTime = Date.now();
      const response = await axios.post(
        `${ODOO_URL}/web/session/authenticate`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );
      const duration = Date.now() - startTime;

      logger.info('AUTH', `Authentication request completed in ${duration}ms`, {
        status: response.status,
        statusText: response.statusText,
        hasResult: !!response.data.result,
        hasError: !!response.data.error
      });

      logger.debug('AUTH', 'Response headers', response.headers);

      if (response.data.error) {
        logger.error('AUTH', 'Odoo returned an error', {
          error: response.data.error,
          errorMessage: response.data.error.data?.message,
          errorCode: response.data.error.code,
          fullResponse: response.data
        });
        throw new Error(response.data.error.data?.message || 'Authentication error from Odoo');
      }

      if (response.data.result && response.data.result.uid) {
        this.uid = response.data.result.uid;
        this.sessionId = response.data.result.session_id;

        logger.info('AUTH', 'Authentication SUCCESSFUL', {
          uid: this.uid,
          sessionId: this.sessionId ? this.sessionId.substring(0, 10) + '...' : 'NONE',
          username: response.data.result.username,
          isSystem: response.data.result.is_system,
          partnerDisplayName: response.data.result.partner_display_name
        });

        logger.debug('AUTH', 'Full authentication result', {
          ...response.data.result,
          session_id: this.sessionId ? this.sessionId.substring(0, 10) + '...' : 'NONE'
        });

        return true;
      } else {
        logger.error('AUTH', 'Authentication failed - No UID in response', {
          hasResult: !!response.data.result,
          result: response.data.result,
          fullResponse: response.data
        });
        throw new Error('Authentication failed - No UID returned');
      }
    } catch (error) {
      if (error.response) {
        logger.error('AUTH', 'HTTP Error during authentication', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        logger.error('AUTH', 'No response received from server', {
          message: error.message,
          code: error.code,
          url: `${ODOO_URL}/web/session/authenticate`
        });
      } else {
        logger.error('AUTH', 'Error setting up authentication request', {
          message: error.message,
          stack: error.stack
        });
      }

      // Additional diagnostic information
      if (error.code === 'ENOTFOUND') {
        logger.error('AUTH', 'DNS Resolution Failed', {
          message: 'Could not resolve hostname. Check if the Odoo URL is correct.',
          url: ODOO_URL
        });
      } else if (error.code === 'ECONNREFUSED') {
        logger.error('AUTH', 'Connection Refused', {
          message: 'Server refused the connection. Check if Odoo is running and accessible.',
          url: ODOO_URL
        });
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('AUTH', 'Connection Timeout', {
          message: 'Connection timed out. Check firewall, network, or IP restrictions.',
          url: ODOO_URL
        });
      }

      throw new Error(`Failed to authenticate with Odoo: ${error.message}`);
    }
  }

  /**
   * Call Odoo JSON-RPC API (READ-ONLY methods only)
   * Only allows: search, read, search_read
   */
  async call(model, method, args = [], kwargs = {}) {
    // Whitelist of read-only methods
    const READ_ONLY_METHODS = ['search', 'read', 'search_read', 'fields_get', 'name_search'];

    logger.debug('API_CALL', `Preparing API call: ${model}.${method}`, {
      model,
      method,
      argsLength: args.length,
      hasKwargs: Object.keys(kwargs).length > 0
    });

    if (!READ_ONLY_METHODS.includes(method)) {
      logger.error('API_CALL', 'Method not allowed (write operation blocked)', {
        model,
        method,
        allowedMethods: READ_ONLY_METHODS
      });
      throw new Error(`Method '${method}' is not allowed. This service is READ-ONLY.`);
    }

    if (!this.uid) {
      logger.warn('API_CALL', 'Not authenticated, authenticating now...');
      await this.authenticate();
    }

    try {
      const requestPayload = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: kwargs,
        },
      };

      logger.info('API_CALL', `Calling ${model}.${method}`, {
        url: `${ODOO_URL}/web/dataset/call_kw`,
        args: args,
        kwargs: kwargs
      });

      const startTime = Date.now();
      const response = await axios.post(
        `${ODOO_URL}/web/dataset/call_kw`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );
      const duration = Date.now() - startTime;

      logger.info('API_CALL', `API call completed in ${duration}ms`, {
        status: response.status,
        hasResult: !!response.data.result,
        hasError: !!response.data.error
      });

      if (response.data.error) {
        logger.error('API_CALL', 'Odoo API returned an error', {
          model,
          method,
          error: response.data.error,
          errorMessage: response.data.error.data?.message,
          errorCode: response.data.error.code,
          errorDebug: response.data.error.data?.debug
        });
        throw new Error(response.data.error.data.message || 'Odoo API error');
      }

      const result = response.data.result;
      logger.debug('API_CALL', `API call successful for ${model}.${method}`, {
        resultType: Array.isArray(result) ? 'array' : typeof result,
        resultLength: Array.isArray(result) ? result.length : undefined,
        resultSample: Array.isArray(result) && result.length > 0 ? result.slice(0, 3) : result
      });

      return result;
    } catch (error) {
      if (error.response) {
        logger.error('API_CALL', 'HTTP Error during API call', {
          model,
          method,
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        logger.error('API_CALL', 'No response received from server', {
          model,
          method,
          message: error.message,
          code: error.code
        });
      } else {
        logger.error('API_CALL', 'Error during API call', {
          model,
          method,
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  /**
   * Search for tags by name containing a specific string (READ-ONLY)
   */
  async searchTagsByName(tagName) {
    logger.info('TAGS', `Searching for tags containing: "${tagName}"`);
    try {
      const domain = [['name', 'ilike', tagName]];
      const tagIds = await this.call('project.tags', 'search', [domain]);
      logger.info('TAGS', `Found ${tagIds.length} tag(s)`, {
        tagName,
        tagIds
      });
      return tagIds;
    } catch (error) {
      logger.error('TAGS', `Error searching tags for "${tagName}"`, {
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Fetch tasks from project.task (READ-ONLY)
   */
  async fetchTasks(projectId = null, filterByPianificato = true) {
    logger.info('TASKS', 'Starting task fetch', {
      projectId,
      filterByPianificato
    });

    try {
      // Build domain filter
      let domain = [];

      if (projectId) {
        domain.push(['project_id', '=', projectId]);
        logger.debug('TASKS', `Filtering by project ID: ${projectId}`);
      }

      // Filter by tags containing 'Pianificato'
      if (filterByPianificato) {
        logger.info('TASKS', 'Filtering by "Pianificato" tag');
        const pianificatoTagIds = await this.searchTagsByName('Pianificato');
        if (pianificatoTagIds && pianificatoTagIds.length > 0) {
          // Use 'in' operator to find tasks with any of these tags
          domain.push(['tag_ids', 'in', pianificatoTagIds]);
          logger.info('TASKS', `Added tag filter with ${pianificatoTagIds.length} tag ID(s)`);
        } else {
          logger.warn('TASKS', 'No tags found containing "Pianificato" - no tasks will be returned!');
        }
      }

      logger.info('TASKS', 'Searching for tasks', { domain });

      // Search for task IDs (READ-ONLY operation)
      const taskIds = await this.call('project.task', 'search', [domain]);

      if (!taskIds || taskIds.length === 0) {
        logger.warn('TASKS', 'No tasks found matching criteria', { domain });
        return [];
      }

      logger.info('TASKS', `Found ${taskIds.length} task(s)`, {
        taskIds: taskIds.slice(0, 10) // Show first 10
      });

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

      logger.debug('TASKS', `Reading task data with fields: ${fields.join(', ')}`);

      const tasks = await this.call('project.task', 'read', [taskIds], {
        fields: fields,
      });

      logger.info('TASKS', `Successfully fetched ${tasks.length} task(s)`, {
        taskCount: tasks.length,
        sampleTask: tasks.length > 0 ? {
          id: tasks[0].id,
          name: tasks[0].name,
          hasStartDate: !!tasks[0].date_start,
          hasEndDate: !!tasks[0].date_end,
          hasDependencies: !!(tasks[0].depend_on_ids && tasks[0].depend_on_ids.length > 0)
        } : null
      });

      return tasks;
    } catch (error) {
      logger.error('TASKS', 'Error fetching tasks', {
        projectId,
        filterByPianificato,
        error: error.message,
        stack: error.stack
      });
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
    logger.info('SYNC', 'Starting getFormattedTasks', {
      projectId,
      filterByPianificato
    });

    const odooTasks = await this.fetchTasks(projectId, filterByPianificato);

    logger.info('SYNC', `Transforming ${odooTasks.length} Odoo tasks to app format`);
    const formattedTasks = this.transformTasksToAppFormat(odooTasks);

    logger.info('SYNC', `Sync completed successfully`, {
      odooTaskCount: odooTasks.length,
      formattedTaskCount: formattedTasks.length
    });

    logger.debug('SYNC', 'Sample formatted task', {
      sampleTask: formattedTasks.length > 0 ? formattedTasks[0] : null
    });

    return formattedTasks;
  }
}

// Export logger for external access
export { logger };

export default new OdooService();
