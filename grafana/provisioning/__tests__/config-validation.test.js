/**
 * Configuration validation tests for Grafana provisioning
 * 
 * Tests validate:
 * - YAML/JSON structure
 * - Required fields
 * - Dashboard panel configuration
 * - Datasource configuration
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Grafana Configuration Validation', () => {
  describe('Datasource Configuration', () => {
    let datasourceConfig;

    beforeAll(() => {
      const configPath = path.join(__dirname, '../datasources/postgres.yml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      datasourceConfig = yaml.load(fileContents);
    });

    it('should have valid YAML structure', () => {
      expect(datasourceConfig).toBeDefined();
      expect(datasourceConfig.apiVersion).toBe(1);
    });

    it('should configure PostgreSQL datasource', () => {
      expect(datasourceConfig.datasources).toHaveLength(1);
      const datasource = datasourceConfig.datasources[0];
      
      expect(datasource.name).toBe('PostgreSQL');
      expect(datasource.type).toBe('grafana-postgresql-datasource');
      expect(datasource.uid).toBe('postgres');
    });

    it('should have correct connection settings', () => {
      const datasource = datasourceConfig.datasources[0];
      
      expect(datasource.url).toBe('postgres:5432');
      expect(datasource.user).toBe('medusa_user');
      expect(datasource.jsonData.database).toBe('medusa_hovedopgave');
    });

    it('should enable TimescaleDB', () => {
      const datasource = datasourceConfig.datasources[0];
      
      expect(datasource.jsonData.timescaledb).toBe(true);
    });

    it('should be set as default datasource', () => {
      const datasource = datasourceConfig.datasources[0];
      
      expect(datasource.isDefault).toBe(true);
    });

    it('should have security configuration', () => {
      const datasource = datasourceConfig.datasources[0];
      
      expect(datasource.secureJsonData).toBeDefined();
      expect(datasource.secureJsonData.password).toBeDefined();
      expect(datasource.jsonData.sslmode).toBe('disable');
    });
  });

  describe('Dashboard Provider Configuration', () => {
    let dashboardConfig;

    beforeAll(() => {
      const configPath = path.join(__dirname, '../dashboards/dashboards.yml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      dashboardConfig = yaml.load(fileContents);
    });

    it('should have valid YAML structure', () => {
      expect(dashboardConfig).toBeDefined();
      expect(dashboardConfig.apiVersion).toBe(1);
    });

    it('should configure dashboard provider', () => {
      expect(dashboardConfig.providers).toHaveLength(1);
      const provider = dashboardConfig.providers[0];
      
      expect(provider.name).toBe('Medusa Dashboards');
      expect(provider.orgId).toBe(1);
      expect(provider.type).toBe('file');
    });

    it('should have correct path configuration', () => {
      const provider = dashboardConfig.providers[0];
      
      expect(provider.options.path).toBe('/etc/grafana/provisioning/dashboards');
    });

    it('should have reasonable update interval', () => {
      const provider = dashboardConfig.providers[0];
      
      expect(provider.updateIntervalSeconds).toBe(30);
      expect(provider.updateIntervalSeconds).toBeGreaterThan(0);
      expect(provider.updateIntervalSeconds).toBeLessThan(3600);
    });

    it('should disable UI updates', () => {
      const provider = dashboardConfig.providers[0];
      
      expect(provider.allowUiUpdates).toBe(false);
    });
  });

  describe('Metrics Dashboard Configuration', () => {
    let dashboard;

    beforeAll(() => {
      const dashboardPath = path.join(__dirname, '../dashboards/metrics.json');
      const fileContents = fs.readFileSync(dashboardPath, 'utf8');
      dashboard = JSON.parse(fileContents);
    });

    it('should have valid JSON structure', () => {
      expect(dashboard).toBeDefined();
      expect(dashboard.title).toBe('Search & Embedding Metrics');
    });

    it('should have correct metadata', () => {
      expect(dashboard.uid).toBe('metrics');
      expect(dashboard.id).toBeNull();
      expect(dashboard.editable).toBe(true);
    });

    it('should have appropriate tags', () => {
      expect(dashboard.tags).toEqual(['medusa', 'search', 'embeddings']);
    });

    it('should have 30-second refresh interval', () => {
      expect(dashboard.refresh).toBe('30s');
    });

    it('should show last 24 hours by default', () => {
      expect(dashboard.time.from).toBe('now-24h');
      expect(dashboard.time.to).toBe('now');
    });

    describe('Panel Configuration', () => {
      it('should have 5 panels', () => {
        expect(dashboard.panels).toHaveLength(5);
      });

      it('should have Search Volume panel', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Search Volume');
        
        expect(panel).toBeDefined();
        expect(panel.type).toBe('timeseries');
        expect(panel.datasource.uid).toBe('postgres');
      });

      it('should have Avg Search Duration panel', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Avg Search Duration (24h)');
        
        expect(panel).toBeDefined();
        expect(panel.type).toBe('stat');
        expect(panel.fieldConfig.defaults.unit).toBe('ms');
      });

      it('should have Embedding Success Rate panel', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Embedding Success Rate (24h)');
        
        expect(panel).toBeDefined();
        expect(panel.type).toBe('stat');
        expect(panel.fieldConfig.defaults.unit).toBe('percent');
      });

      it('should have Search Duration Breakdown panel', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Search Duration Breakdown');
        
        expect(panel).toBeDefined();
        expect(panel.type).toBe('timeseries');
      });

      it('should have Top Search Queries panel', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Top Search Queries (24h)');
        
        expect(panel).toBeDefined();
        expect(panel.type).toBe('table');
      });

      it('all panels should reference postgres datasource', () => {
        dashboard.panels.forEach((panel) => {
          expect(panel.datasource.uid).toBe('postgres');
          expect(panel.datasource.type).toBe('postgres');
        });
      });

      it('all panels should have SQL queries', () => {
        dashboard.panels.forEach((panel) => {
          expect(panel.targets).toBeDefined();
          expect(panel.targets.length).toBeGreaterThan(0);
          
          panel.targets.forEach((target) => {
            expect(target.rawSql).toBeDefined();
            expect(target.rawSql.length).toBeGreaterThan(0);
          });
        });
      });

      it('panels should have proper grid positioning', () => {
        dashboard.panels.forEach((panel) => {
          expect(panel.gridPos).toBeDefined();
          expect(panel.gridPos.h).toBeGreaterThan(0);
          expect(panel.gridPos.w).toBeGreaterThan(0);
          expect(panel.gridPos.x).toBeGreaterThanOrEqual(0);
          expect(panel.gridPos.y).toBeGreaterThanOrEqual(0);
        });
      });
    });

    describe('Query Validation', () => {
      it('Search Volume query should use time_bucket', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Search Volume');
        const query = panel.targets[0].rawSql;
        
        expect(query).toContain('time_bucket');
        expect(query).toContain('search_metrics');
      });

      it('Duration queries should calculate averages', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Avg Search Duration (24h)');
        const query = panel.targets[0].rawSql;
        
        expect(query).toContain('AVG');
        expect(query).toContain('total_duration_ms');
      });

      it('Success rate query should calculate percentage', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Embedding Success Rate (24h)');
        const query = panel.targets[0].rawSql;
        
        expect(query).toContain('COUNT(*) FILTER');
        expect(query).toContain('success = true');
        expect(query).toContain('* 100.0');
      });

      it('Top queries should order by count', () => {
        const panel = dashboard.panels.find((p) => p.title === 'Top Search Queries (24h)');
        const query = panel.targets[0].rawSql;
        
        expect(query).toContain('ORDER BY searches DESC');
        expect(query).toContain('LIMIT 20');
      });
    });
  });

  describe('File System Validation', () => {
    it('should have all required configuration files', () => {
      const requiredFiles = [
        'datasources/postgres.yml',
        'dashboards/dashboards.yml',
        'dashboards/metrics.json',
      ];

      requiredFiles.forEach((file) => {
        const filePath = path.join(__dirname, '..', file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should have readable configuration files', () => {
      const configFiles = [
        'datasources/postgres.yml',
        'dashboards/dashboards.yml',
        'dashboards/metrics.json',
      ];

      configFiles.forEach((file) => {
        const filePath = path.join(__dirname, '..', file);
        expect(() => {
          fs.readFileSync(filePath, 'utf8');
        }).not.toThrow();
      });
    });
  });
});